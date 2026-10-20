// Links partilháveis com pessoas de fora do portal (auditores, ANAC). Esta página é a vista geral de tudo o que
// está aberto — é aqui que se faz a revisão periódica dos links vivos: o que dão acesso, quanto tempo falta e
// quantas descargas já tiveram. O caminho curto para partilhar um documento é o botão na ficha do documento.
// Documentos secretos não podem ter link: o interface diz porquê e desactiva o botão, em vez de deixar ir até ao
// erro do servidor. O endereço é servido fora do portal (rotas /s/, /p/ e /v/) e nunca exige conta: quem tiver o
// endereço entra.
import React, { useMemo, useState } from 'react';
import {
  AlertTriangle, Ban, Check, Copy, ExternalLink, FileText, Folder, Info, Link2, Loader2,
  RefreshCw, Search, ShieldAlert, Plus, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Select from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { useAuth } from '@/lib/AuthContext';
import { cn, copyToClipboard } from '@/lib/utils';
import { fmtData, fmtDataHora } from '@/lib/safeDate';
import { supabase } from '@/lib/supabaseClient';
import {
  useDocumentosDocs, usePastasDocs, useAeroportosDocs, useLinksPartilhaDocs, useEnderecosLinksDocs,
  useRecarregarDocs, auditarDocs,
} from '../../hooks';
import { Vazio, Falha, mapaPorId, nomeAero, FichasFiltro } from '../PortalBiblioteca';
import { PaginaGestao } from '../../PortalLayout';
import {
  GD, Painel, Cabecalho, Tabela, Th, Tr, Td, AccoesLinha, LinhasEsqueleto, LinhaMensagem, Ficha,
  ResumoFiltros, ComutadorDensidade, useDensidade, useFiltrosUrl,
} from './PortalGestaoPainel';

const VALIDADES = [
  { value: '1', label: '24 horas' },
  { value: '7', label: '7 dias (recomendado)' },
  { value: '30', label: '30 dias (máximo)' },
];
const ESTADO_FILTRO_LABEL = { activos: 'activos', expirados: 'expirados ou esgotados', revogados: 'revogados', todos: 'todos' };
const COLUNAS = 6;

function estadoLink(l) {
  if (l.revogado_em) return { chave: 'revogado', label: 'Revogado', cor: 'border-slate-300 bg-slate-200 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300' };
  if (l.expira_em && new Date(l.expira_em).getTime() < Date.now()) return { chave: 'expirado', label: 'Expirado', cor: 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400' };
  if (l.max_downloads != null && Number(l.downloads_count || 0) >= Number(l.max_downloads)) return { chave: 'esgotado', label: 'Limite atingido', cor: 'border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200' };
  return { chave: 'activo', label: 'Activo', cor: 'border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200' };
}
const prefixo = (l) => ((l.aeroportos_ids?.length || l.pastas_ids?.length) ? '/v/' : (l.pasta_id ? '/p/' : '/s/'));
const enderecoDe = (l, tokens, base) => {
  const token = tokens?.[l.id];
  if (!token) return '';
  return `${base || window.location.origin}${prefixo(l)}${token}`;
};
// Dias que faltam (negativo = já passou). Um link sem data de fim visível é um risco que ninguém vê.
function diasRestantes(v) {
  if (!v) return null;
  const t = new Date(v).getTime();
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / 86400000);
}
function validadeEmPalavras(v) {
  const d = diasRestantes(v);
  if (d === null) return 'Sem data de fim';
  if (d < 0) return `Expirou há ${Math.abs(d)} dia${Math.abs(d) === 1 ? '' : 's'}`;
  if (d === 0) return 'Expira hoje';
  return `Faltam ${d} dia${d === 1 ? '' : 's'}`;
}
// Data por extenso para a frase da consequência («até 1 de Novembro de 2026»), sempre com rede contra datas nulas.
function dataEmPalavras(v) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' });
}
const dataDaqui = (dias) => dataEmPalavras(new Date(Date.now() + Number(dias || 0) * 86400000));

// ── escolher o alvo: pesquisa com poucos resultados de cada vez ──────────────
// Uma caixa de selecção com duzentos e dezassete nomes compridos é desconfortável: aqui escreve-se parte do
// título ou do número e vêem-se seis resultados, com o número em monoespaçado por baixo do título.
function Escolher({ tipo, itens, escolhido, aoEscolher, aoLimpar, rotuloDe, numeroDe, metaDe, secretoDe }) {
  const [texto, setTexto] = useState('');
  const t = texto.trim().toLowerCase();
  const resultados = useMemo(() => {
    const base = t
      ? itens.filter(i => `${rotuloDe(i)} ${numeroDe(i) || ''} ${metaDe(i) || ''}`.toLowerCase().includes(t))
      : itens;
    return { lista: base.slice(0, 6), total: base.length };
  }, [itens, t, rotuloDe, numeroDe, metaDe]);

  if (escolhido) {
    const secreto = secretoDe?.(escolhido);
    return (
      <div className={cn('rounded-lg border p-3', secreto ? 'border-red-200 dark:border-red-900' : GD.borda)}>
        <div className="flex items-start gap-2">
          {tipo === 'documento' ? <FileText className={cn('mt-0.5 h-4 w-4 shrink-0', GD.meta)} aria-hidden="true" /> : <Folder className={cn('mt-0.5 h-4 w-4 shrink-0', GD.meta)} aria-hidden="true" />}
          <div className="min-w-0 flex-1">
            <p className={cn('truncate font-medium', GD.tinta)}>{rotuloDe(escolhido)}</p>
            {numeroDe(escolhido) && <p className={cn('truncate text-sm', GD.ref, GD.meta)}>{numeroDe(escolhido)}</p>}
            {metaDe(escolhido) && <p className={cn('truncate text-sm', GD.meta)}>{metaDe(escolhido)}</p>}
          </div>
          <Button variant="outline" size="sm" onClick={aoLimpar}>Mudar</Button>
        </div>
        {secreto && (
          <p className="mt-2 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Este documento está classificado como <strong>secreto</strong>: por regra do portal não pode sair por link
            partilhável, e o servidor recusa o pedido. Baixe a classificação em Documentos ou entregue-o por outro meio.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className={cn('pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2', GD.meta)} aria-hidden="true" />
        <Input
          value={texto} onChange={e => setTexto(e.target.value)} autoFocus
          placeholder={tipo === 'documento' ? 'Escreva parte do título ou do número…' : 'Escreva parte do nome da pasta…'}
          aria-label={tipo === 'documento' ? 'Procurar o documento a partilhar' : 'Procurar a pasta a partilhar'}
          className="pl-9"
        />
      </div>
      {resultados.total === 0 ? (
        <p className={cn('rounded-lg border px-3 py-6 text-center text-sm', GD.borda, GD.meta)}>
          Nada corresponde a «{texto}». Verifique o número ou escreva menos palavras.
        </p>
      ) : (
        <>
          <ul className={cn('divide-y overflow-hidden rounded-lg border', GD.borda, GD.divisoria)}>
            {resultados.lista.map(i => {
              const secreto = secretoDe?.(i);
              return (
                <li key={i.id}>
                  <button type="button" onClick={() => aoEscolher(i)}
                    className={cn('flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60', GD.foco)}>
                    {tipo === 'documento' ? <FileText className={cn('mt-0.5 h-4 w-4 shrink-0', GD.meta)} aria-hidden="true" /> : <Folder className={cn('mt-0.5 h-4 w-4 shrink-0', GD.meta)} aria-hidden="true" />}
                    <span className="min-w-0 flex-1">
                      <span className={cn('block truncate text-sm font-medium', GD.tinta)}>{rotuloDe(i)}</span>
                      {numeroDe(i) && <span className={cn('block truncate text-sm', GD.ref, GD.meta)}>{numeroDe(i)}</span>}
                      {metaDe(i) && <span className={cn('block truncate text-sm', GD.meta)}>{metaDe(i)}</span>}
                    </span>
                    {secreto && <span className="shrink-0 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">secreto</span>}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className={cn('text-sm', GD.meta)}>
            {resultados.total > resultados.lista.length
              ? `${resultados.total} correspondem; a mostrar os primeiros ${resultados.lista.length}. Escreva mais para afinar.`
              : `${resultados.total} resultado${resultados.total === 1 ? '' : 's'}.`}
          </p>
        </>
      )}
    </div>
  );
}

// ── criar link ──────────────────────────────────────────────────────────────
// Primeiro o alvo (concreto), só depois as condições. No fim, a consequência explicada em palavras.
function DialogNovoLink({ documentos, pastas, mapaAero, actor, onFechar, onFeito }) {
  const { toast } = useToast();
  const [tipo, setTipo] = useState('documento');
  const [doc, setDoc] = useState(null);
  const [pasta, setPasta] = useState(null);
  const [dias, setDias] = useState('7');
  const [senha, setSenha] = useState('');
  const [maxDownloads, setMaxDownloads] = useState('');
  const [recursivo, setRecursivo] = useState('sim');
  const [busy, setBusy] = useState(false);
  const [criado, setCriado] = useState(null);

  const alvo = tipo === 'documento' ? doc : pasta;
  const secreto = tipo === 'documento' && doc?.nivel_confidencialidade === 'secreto';
  const podeCriar = !!alvo && !secreto;
  const nomeAlvo = alvo ? (tipo === 'documento' ? alvo.titulo : alvo.nome) : '';
  const caminhoPastaCurto = (p) => {
    const porId = mapaPorId(pastas);
    const partes = [];
    let actual = p;
    let n = 0;
    while (actual && n < 8) { partes.unshift(actual.nome); actual = actual.pasta_pai_id ? porId.get(actual.pasta_pai_id) : null; n += 1; }
    return partes.join(' / ');
  };

  const criar = async () => {
    setBusy(true);
    try {
      const body = {
        dias_validade: Number(dias),
        password: senha || null,
        max_downloads: maxDownloads ? parseInt(maxDownloads, 10) : null,
      };
      if (tipo === 'pasta') { body.pasta_id = pasta.id; body.recursivo = recursivo === 'sim'; }
      else body.documento_id = doc.id;
      const { data, error } = await supabase.functions.invoke('share-link-create', { body });
      if (error) throw new Error(error.message || 'Falha ao criar o link.');
      if (data?.error) throw new Error(data.error);
      setCriado(data);
      await auditarDocs(actor, {
        acao: 'link_criado', entidade: tipo === 'pasta' ? 'pasta' : 'documento', id: alvo.id,
        detalhes: `Link partilhável criado (${dias} dia(s)${senha ? ', com senha' : ''}${body.max_downloads ? `, máx. ${body.max_downloads} descargas` : ''}) para ${tipo === 'pasta' ? `a pasta ${nomeAlvo}` : `o documento «${nomeAlvo}»`}`,
      });
      onFeito();
    } catch (e) {
      toast({ title: 'Não foi possível criar o link', description: e?.message || String(e), variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const copiar = async () => {
    const ok = await copyToClipboard(criado?.url || '');
    toast({ title: ok ? 'Endereço copiado' : 'Não foi possível copiar', description: ok ? undefined : 'Seleccione o endereço e copie manualmente.', variant: ok ? undefined : 'destructive' });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-h-[92vh] w-full max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Link2 className="h-5 w-5 text-teal-600" aria-hidden="true" />{criado ? 'Link criado' : 'Novo link partilhável'}</DialogTitle>
          <DialogDescription>
            {criado ? 'Entregue o endereço a quem precisa.' : 'Dá acesso a um documento ou a uma pasta a quem não tem conta no portal. Fica tudo registado na auditoria.'}
          </DialogDescription>
        </DialogHeader>

        {criado ? (
          <div className="space-y-3">
            {/* a consequência em palavras, antes do endereço */}
            <p className={cn('rounded-lg border p-3 text-sm', GD.borda, GD.superficieFraca, GD.tintaMedia)}>
              Quem tiver este endereço abre <strong className={GD.tinta}>{nomeAlvo}</strong>
              {criado.expira_em ? <> até <strong className={GD.tinta}>{dataEmPalavras(criado.expira_em)}</strong></> : ''}, sem precisar de conta no portal
              {criado.tem_password ? ', depois de introduzir a senha' : ''}
              {criado.max_downloads ? `, e pode descarregar no máximo ${criado.max_downloads} vez(es)` : ''}.
              {tipo === 'pasta' && (criado.recursivo ? ' Inclui as subpastas.' : ' Só os documentos directos da pasta.')}
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="nl-url">Endereço</Label>
              <div className="flex gap-2">
                <Input id="nl-url" readOnly value={criado.url || ''} onFocus={e => e.target.select()} className={cn('min-w-0 text-sm', GD.ref)} />
                <Button variant="outline" onClick={copiar} className="shrink-0"><Copy className="h-4 w-4" aria-hidden="true" />Copiar</Button>
              </div>
            </div>
            {criado.tem_password && (
              <p className={cn('flex items-start gap-2 rounded-lg border p-3 text-sm', GD.avisoSuave)}>
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                Envie a senha por <strong>outro canal</strong> — telefone, mensagem ou pessoalmente. Senha e endereço no mesmo
                email é o mesmo que não ter senha.
              </p>
            )}
            <p className={cn('flex items-start gap-2 text-sm', GD.meta)}>
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Para endereços externos, copie o endereço e envie-o pelo seu próprio email: o relay da SGA só entrega a @sga.co.ao.
              Enquanto o link estiver vivo, qualquer pessoa com o endereço entra — pode revogá-lo a qualquer momento nesta página.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* 1. o alvo */}
            <fieldset className="space-y-2">
              <legend className={cn('text-sm font-semibold', GD.tinta)}>1. O que vai partilhar</legend>
              <div className="flex flex-wrap gap-1.5">
                <Ficha activa={tipo === 'documento'} aoClicar={() => { setTipo('documento'); setPasta(null); }}>Um documento</Ficha>
                <Ficha activa={tipo === 'pasta'} aoClicar={() => { setTipo('pasta'); setDoc(null); }}>Uma pasta</Ficha>
              </div>
              {tipo === 'documento' ? (
                <Escolher
                  tipo="documento" itens={documentos} escolhido={doc}
                  aoEscolher={setDoc} aoLimpar={() => setDoc(null)}
                  rotuloDe={d => d.titulo} numeroDe={d => d.numero}
                  metaDe={d => nomeAero(mapaAero, d.aeroporto_id)}
                  secretoDe={d => d.nivel_confidencialidade === 'secreto'}
                />
              ) : (
                <Escolher
                  tipo="pasta" itens={pastas} escolhido={pasta}
                  aoEscolher={setPasta} aoLimpar={() => setPasta(null)}
                  rotuloDe={p => p.nome} numeroDe={() => ''}
                  metaDe={p => caminhoPastaCurto(p)}
                />
              )}
            </fieldset>

            {/* 2. as condições, só depois de haver alvo */}
            {alvo && !secreto && (
              <fieldset className="space-y-3">
                <legend className={cn('text-sm font-semibold', GD.tinta)}>2. Até quando e com que limites</legend>
                {tipo === 'pasta' && (
                  <div className="space-y-1.5">
                    <Label>Subpastas</Label>
                    <Select options={[{ value: 'sim', label: 'Incluir as subpastas (o auditor navega a árvore)' }, { value: 'nao', label: 'Só os documentos directos da pasta' }]} value={recursivo} onValueChange={setRecursivo} />
                    <p className={cn('text-sm', GD.meta)}>Documentos secretos ou com senha própria aparecem na listagem mas não se abrem sem a senha do documento.</p>
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5"><Label>Validade</Label><Select options={VALIDADES} value={dias} onValueChange={setDias} /></div>
                  <div className="space-y-1.5"><Label htmlFor="nl-max">Máximo de descargas</Label><Input id="nl-max" type="number" min={1} max={1000} value={maxDownloads} onChange={e => setMaxDownloads(e.target.value)} placeholder="sem limite" /></div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nl-senha">Senha do link (opcional)</Label>
                  <Input id="nl-senha" type="text" value={senha} onChange={e => setSenha(e.target.value)} autoComplete="off" placeholder="uma frase curta, enviada em separado" />
                  <p className={cn('text-sm', GD.meta)}>Com senha, quem abrir o endereço tem de a introduzir. Envie-a por outro canal que não o mesmo email.</p>
                </div>
                <p className={cn('rounded-lg border p-3 text-sm', GD.borda, GD.superficieFraca, GD.tintaMedia)}>
                  Ao criar: quem tiver o endereço abre <strong className={GD.tinta}>{nomeAlvo}</strong> até <strong className={GD.tinta}>{dataDaqui(dias)}</strong>, sem conta no portal
                  {senha ? ', depois de introduzir a senha' : ''}
                  {maxDownloads ? `, no máximo ${maxDownloads} descarga(s)` : ''}.
                </p>
              </fieldset>
            )}
          </div>
        )}

        <DialogFooter>
          {criado
            ? <Button onClick={onFechar}>Fechar</Button>
            : <>
              <Button variant="outline" onClick={onFechar} disabled={busy}>Cancelar</Button>
              <Button onClick={criar} disabled={busy || !podeCriar}>{busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Link2 className="h-4 w-4" aria-hidden="true" />}Criar link</Button>
            </>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── página ──────────────────────────────────────────────────────────────────
export default function PortalLinks() {
  const { user } = useAuth();
  const { toast } = useToast();
  const recarregar = useRecarregarDocs();
  const linksQ = useLinksPartilhaDocs();
  const enderecosQ = useEnderecosLinksDocs();
  const docsQ = useDocumentosDocs({ limite: 1000 });
  const pastasQ = usePastasDocs();
  const aeroportosQ = useAeroportosDocs();
  const [altura, setAltura] = useDensidade();

  const [{ estado: filtro, q }, definir, limparFiltros] = useFiltrosUrl({ estado: 'activos', q: '' });
  const [novo, setNovo] = useState(false);
  const [confirmar, setConfirmar] = useState(null);
  const [aRevogar, setARevogar] = useState(null);
  const [copiado, setCopiado] = useState(null);

  const docs = docsQ.data || [];
  const pastas = pastasQ.data || [];
  const mapaDocs = useMemo(() => mapaPorId(docs), [docs]);
  const mapaPastas = useMemo(() => mapaPorId(pastas), [pastas]);
  const mapaAero = useMemo(() => mapaPorId(aeroportosQ.data || []), [aeroportosQ.data]);
  const tokens = enderecosQ.data?.tokens || {};
  const base = enderecosQ.data?.base || '';

  // O que o link dá acesso — sempre dito por extenso, nunca só «documento».
  const alvoDe = (l) => {
    if (l.documento_id) {
      const d = mapaDocs.get(l.documento_id);
      return { icone: FileText, texto: d?.titulo || 'Documento que já não vê (apagado ou fora do seu acesso)', numero: d?.numero || '', tipo: 'Documento', meta: d ? nomeAero(mapaAero, d.aeroporto_id) : '' };
    }
    if (l.pasta_id) {
      const p = mapaPastas.get(l.pasta_id);
      return { icone: Folder, texto: p?.nome || 'Pasta', numero: '', tipo: l.recursivo ? 'Pasta e subpastas' : 'Pasta (só documentos directos)', meta: p ? nomeAero(mapaAero, p.aeroporto_id) : '' };
    }
    const nP = l.pastas_ids?.length || 0;
    const nA = l.aeroportos_ids?.length || 0;
    return { icone: Folder, texto: [nP ? `${nP} pasta(s)` : '', nA ? `${nA} aeroporto(s)` : ''].filter(Boolean).join(' · ') || 'Selecção de pastas', numero: '', tipo: 'Selecção', meta: '' };
  };

  const todos = linksQ.data || [];
  const contagens = useMemo(() => {
    const c = { activos: 0, expirados: 0, revogados: 0, todos: todos.length };
    for (const l of todos) {
      const e = estadoLink(l).chave;
      if (e === 'activo') c.activos += 1;
      else if (e === 'revogado') c.revogados += 1;
      else c.expirados += 1;
    }
    return c;
  }, [todos]);

  const links = useMemo(() => {
    const t = String(q || '').trim().toLowerCase();
    return todos.filter(l => {
      const e = estadoLink(l).chave;
      if (filtro === 'activos' && e !== 'activo') return false;
      if (filtro === 'revogados' && e !== 'revogado') return false;
      if (filtro === 'expirados' && !['expirado', 'esgotado'].includes(e)) return false;
      if (!t) return true;
      const a = alvoDe(l);
      return [a.texto, a.numero, l.criado_por].some(v => String(v || '').toLowerCase().includes(t));
    });
  }, [todos, filtro, q, mapaDocs, mapaPastas]);

  const copiar = async (l) => {
    const url = enderecoDe(l, tokens, base);
    if (!url) { toast({ title: 'Endereço indisponível', description: 'Actualize a página; se continuar, o link pode ter sido removido.', variant: 'destructive' }); return; }
    const ok = await copyToClipboard(url);
    if (ok) { setCopiado(l.id); setTimeout(() => setCopiado(null), 2000); }
    else toast({ title: 'Não foi possível copiar', description: url, variant: 'destructive' });
  };

  const revogar = async (l) => {
    setARevogar(l.id);
    try {
      const { data, error } = await supabase.functions.invoke('share-link-revoke', { body: { link_id: l.id } });
      if (error) throw new Error(error.message || 'Falha ao revogar.');
      if (data?.error) throw new Error(data.error);
      await auditarDocs(user, { acao: 'link_revogado', entidade: l.pasta_id ? 'pasta' : 'documento', id: l.documento_id || l.pasta_id, detalhes: `Link partilhável revogado (${alvoDe(l).texto})` });
      toast({ title: 'Link revogado', description: 'O endereço deixou de funcionar imediatamente.' });
      recarregar('links');
      recarregar('links-enderecos');
    } catch (e) {
      toast({ title: 'Não foi possível revogar', description: e?.message || String(e), variant: 'destructive' });
    } finally { setARevogar(null); }
  };

  const descargas = todos.reduce((s, l) => s + Number(l.downloads_count || 0), 0);
  const aExpirar = todos.filter(l => estadoLink(l).chave === 'activo' && (diasRestantes(l.expira_em) ?? 99) <= 2).length;

  return (
    <PaginaGestao
      titulo="Links partilháveis"
      descricao="Endereços que dão acesso a um documento ou a uma pasta sem conta no portal — para auditores externos e para o regulador. Use sempre a validade mais curta possível."
      accoes={<>
        <ComutadorDensidade valor={altura} aoMudar={setAltura} />
        <Button variant="outline" onClick={() => { recarregar('links'); recarregar('links-enderecos'); }} disabled={linksQ.isFetching}><RefreshCw className={cn('h-4 w-4', linksQ.isFetching && 'animate-spin')} aria-hidden="true" />Actualizar</Button>
        <Button onClick={() => setNovo(true)}><Plus className="h-4 w-4" aria-hidden="true" />Novo link</Button>
      </>}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={cn('text-sm tabular-nums', GD.tintaMedia)}>
          {linksQ.isLoading ? 'A carregar…' : <>{contagens.activos} link(s) activo(s){aExpirar ? <span className={GD.alerta}> · {aExpirar} termina(m) nas próximas 48 horas</span> : ''} · {descargas} descarga(s) no total</>}
        </p>
        <details className="text-sm">
          <summary className={cn('cursor-pointer rounded px-1', GD.acento, GD.foco)}>O que é um link partilhável</summary>
          <p className={cn('mt-2 max-w-3xl rounded-lg border p-3 text-[13px] leading-relaxed', GD.borda, GD.superficieFraca, GD.tintaMedia)}>
            Quem tiver o endereço entra, sem conta e sem perfil: trate-o como a chave de um cofre. Os documentos
            classificados como <strong>secretos</strong> não podem ter link (o servidor recusa). Um link de pasta mostra os
            documentos dessa pasta — os que têm senha própria continuam a pedi-la. Revogar corta o acesso no momento.
          </p>
        </details>
      </div>

      <Painel>
        <div className={cn('flex flex-wrap items-center gap-2 border-b p-3', GD.borda)}>
          <div className="relative min-w-[14rem] flex-1">
            <Search className={cn('pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2', GD.meta)} aria-hidden="true" />
            <Input value={q} onChange={e => definir({ q: e.target.value })} placeholder="Procurar por documento, pasta ou quem criou…" aria-label="Procurar nos links" className="pl-9" />
          </div>
          <FichasFiltro
            titulo="Estado"
            opcoes={[
              { value: 'activos', label: 'Activos', total: contagens.activos },
              { value: 'expirados', label: 'Expirados ou esgotados', total: contagens.expirados },
              { value: 'revogados', label: 'Revogados', total: contagens.revogados },
              { value: 'todos', label: 'Todos', total: contagens.todos },
            ]}
            valor={filtro}
            aoEscolher={v => definir({ estado: v || 'todos' })}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
          <p className={cn('text-sm tabular-nums', GD.tintaMedia)}>{links.length} link{links.length === 1 ? '' : 's'} à vista</p>
          <ResumoFiltros
            aplicados={[
              q && { chave: 'q', rotulo: `Texto: ${q}`, aoRemover: () => definir({ q: '' }) },
              filtro !== 'todos' && { chave: 'estado', rotulo: `Estado: ${ESTADO_FILTRO_LABEL[filtro] || filtro}`, aoRemover: () => definir({ estado: 'todos' }) },
            ].filter(Boolean)}
            aoLimparTudo={() => limparFiltros()}
          />
        </div>

        <Tabela altura={altura} rotulo="Links partilháveis">
          <thead>
            <tr>
              <Th>O que dá acesso</Th>
              <Th>Validade</Th>
              <Th numerico estreito>Descargas</Th>
              <Th>Estado</Th>
              <Th className="hidden lg:table-cell">Criado por</Th>
              <Th numerico>Acções</Th>
            </tr>
          </thead>
          {linksQ.isLoading ? <LinhasEsqueleto linhas={5} colunas={COLUNAS} altura={altura} />
            : linksQ.isError ? (
              <LinhaMensagem colunas={COLUNAS}>
                <Falha titulo="Não foi possível carregar os links" texto={`${linksQ.error?.message || 'O servidor não respondeu.'} Sem esta lista não é possível revogar links: tente de novo.`} onTentar={() => linksQ.refetch()} />
              </LinhaMensagem>
            ) : links.length === 0 ? (
              <LinhaMensagem colunas={COLUNAS}>
                <Vazio
                  icone={Link2}
                  titulo={todos.length ? 'Nenhum link neste estado' : 'Ainda não há links partilháveis'}
                  texto={todos.length
                    ? 'Mude o estado nas fichas acima (há links noutros estados) ou limpe a pesquisa.'
                    : 'Crie um link quando precisar de dar acesso a quem não tem conta no portal — um auditor externo ou a ANAC.'}
                >
                  {todos.length
                    ? <Button variant="outline" onClick={() => definir({ estado: 'todos', q: '' })}><X className="h-4 w-4" aria-hidden="true" />Ver todos os links</Button>
                    : <Button onClick={() => setNovo(true)}><Plus className="h-4 w-4" aria-hidden="true" />Novo link</Button>}
                </Vazio>
              </LinhaMensagem>
            ) : (
              <tbody>
                {links.map(l => {
                  const a = alvoDe(l);
                  const Icone = a.icone;
                  const e = estadoLink(l);
                  const url = enderecoDe(l, tokens, base);
                  const dias = diasRestantes(l.expira_em);
                  return (
                    <Tr key={l.id}>
                      <Td className="max-w-[24rem]">
                        <div className="flex items-start gap-2">
                          <Icone className={cn('mt-0.5 h-4 w-4 shrink-0', GD.meta)} aria-hidden="true" />
                          <div className="min-w-0">
                            {a.numero && <span className={cn('block truncate text-xs', GD.ref, GD.meta)}>{a.numero}</span>}
                            <span className={cn('block truncate font-medium', GD.tinta)}>{a.texto}</span>
                            <span className={cn('block truncate text-sm', GD.meta)}>{[a.tipo, a.meta].filter(Boolean).join(' · ')}</span>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <span className={cn('block text-sm font-medium', e.chave === 'activo' && dias !== null && dias <= 2 ? GD.alerta : dias !== null && dias < 0 ? GD.meta : GD.tintaMedia)}>
                          {validadeEmPalavras(l.expira_em)}
                        </span>
                        <span className={cn('block text-xs tabular-nums', GD.meta)}>{fmtDataHora(l.expira_em)}</span>
                      </Td>
                      <Td numerico className={cn('text-sm', GD.meta)}>
                        {Number(l.downloads_count || 0)}{l.max_downloads != null ? ` / ${l.max_downloads}` : ''}
                      </Td>
                      <Td><span className={cn('inline-flex rounded-full border px-2 py-0.5 text-xs font-medium', e.cor)}>{e.label}</span></Td>
                      <Td className={cn('hidden max-w-[12rem] text-sm lg:table-cell', GD.meta)}>
                        <span className="block truncate">{l.criado_por || '—'}</span>
                        <span className="block truncate tabular-nums">{fmtData(l.criado_em)}</span>
                      </Td>
                      <Td>
                        <AccoesLinha
                          destrutivas={!l.revogado_em && (
                            <Button size="sm" variant="ghost" className={GD.perigo} disabled={aRevogar === l.id}
                              onClick={() => setConfirmar({ t: 'Revogar link', m: `Revogar o link de «${a.texto}»? O endereço deixa de funcionar imediatamente para quem já o tem — e isso inclui quem esteja a usá-lo agora. Não se desfaz: se for preciso, crie um link novo.`, f: () => revogar(l) })}>
                              {aRevogar === l.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Ban className="h-4 w-4" aria-hidden="true" />}Revogar
                            </Button>
                          )}
                        >
                          <Button size="sm" variant="outline" onClick={() => copiar(l)} disabled={!url || e.chave === 'revogado'}>
                            {copiado === l.id ? <Check className={cn('h-4 w-4', GD.bom)} aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}Copiar
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => url && window.open(url, '_blank', 'noopener')} disabled={!url || e.chave !== 'activo'}>
                            <ExternalLink className="h-4 w-4" aria-hidden="true" />Abrir
                          </Button>
                        </AccoesLinha>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            )}
        </Tabela>
      </Painel>

      {enderecosQ.isError && (
        <p className={cn('flex items-start gap-2 rounded-lg border p-3 text-sm', GD.avisoSuave)}>
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />Não foi possível obter os endereços dos links existentes; pode revogar mas não copiar. Actualize a página.
        </p>
      )}

      {novo && (
        <DialogNovoLink
          documentos={docs}
          pastas={pastas}
          mapaAero={mapaAero}
          actor={user}
          onFechar={() => setNovo(false)}
          onFeito={() => { recarregar('links'); recarregar('links-enderecos'); }}
        />
      )}
      <ConfirmModal isOpen={!!confirmar} onClose={() => setConfirmar(null)} onConfirm={() => confirmar?.f?.()} title={confirmar?.t} message={confirmar?.m} confirmText={confirmar?.t} variant="destructive" />
    </PaginaGestao>
  );
}
