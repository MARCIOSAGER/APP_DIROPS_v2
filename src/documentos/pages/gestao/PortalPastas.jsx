// Gestão das pastas: a árvore completa à esquerda, a ficha da pasta escolhida à direita — nome, descrição, pasta
// acima, aeroporto, ordem, cor, permissões próprias e a lista densa dos documentos que estão lá dentro.
// A pasta escolhida vive no endereço (?pasta=), por isso qualquer ficha é partilhável.
// A coluna antiga `nivel_acesso` está morta e não aparece aqui. O servidor é que decide quem vê (migrações
// 136a/136b/136c): isto só escreve as regras e mostra o seu efeito em texto simples.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, Archive, ChevronDown, ChevronRight, CornerUpRight, Eye, FileText, Folder, FolderPlus,
  FolderTree, Info, Loader2, Lock, Palette, RefreshCw, Save, Search, ShieldCheck, Users, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import Select from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabaseClient';
import { PORTAL_BASE, PERFIS_PORTAL_DOCS, PERFIL_DOC_LABEL, ehAdminPortal } from '@/lib/portalDocumentos';
import { useAeroportosDocs, usePastasDocs, useDocumentosDocs, useRecarregarDocs, auditarDocs } from '../../hooks';
import { EstadoChip, ValidadeChip, Vazio, Falha, mapaPorId, nomeAero, urlBiblioteca, versaoDoc } from '../PortalBiblioteca';
import { PaginaGestao } from '../../PortalLayout';
import {
  GD, Painel, Cabecalho, Tabela, Th, Tr, Td, LinhasEsqueleto, LinhaMensagem, Ficha, ZonaRisco,
  useDensidade, useFiltrosUrl, CelulaDocumento, textoVigor,
} from './PortalGestaoPainel';

const CORES = ['#0d9488', '#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#84cc16', '#64748b'];
const listaEmails = (texto) => [...new Set(String(texto || '').split(/[,;\s]+/).map(e => e.trim().toLowerCase()).filter(e => e.includes('@')))];
const vazioOuNulo = (lista) => (Array.isArray(lista) && lista.length ? lista : null);

// Árvore a partir da lista plana (inclui as filhas, para a indentação e para travar ciclos ao mover).
function construirArvore(pastas) {
  const porId = new Map(pastas.map(p => [p.id, { ...p, filhas: [] }]));
  const raiz = [];
  for (const p of porId.values()) {
    const pai = p.pasta_pai_id ? porId.get(p.pasta_pai_id) : null;
    if (pai) pai.filhas.push(p); else raiz.push(p);
  }
  const ordenar = (lista) => {
    lista.sort((a, b) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0) || String(a.nome || '').localeCompare(String(b.nome || ''), 'pt'));
    lista.forEach(n => ordenar(n.filhas));
  };
  ordenar(raiz);
  return { raiz, porId };
}
const caminhoDe = (porId, id) => {
  const partes = [];
  let actual = id ? porId.get(id) : null;
  let n = 0;
  while (actual && n < 20) { partes.unshift(actual.nome); actual = actual.pasta_pai_id ? porId.get(actual.pasta_pai_id) : null; n += 1; }
  return partes.join(' / ');
};
// Descendentes de uma pasta (não se pode mover uma pasta para dentro de si própria).
function descendentes(porId, id) {
  const fora = new Set([id]);
  const andar = (pai) => (porId.get(pai)?.filhas || []).forEach(f => { fora.add(f.id); andar(f.id); });
  andar(id);
  return fora;
}
const temPermissoesProprias = (p) => p?.perfis_permitidos != null || p?.aeroportos_permitidos != null || p?.emails_permitidos != null;

// Permissões efectivas: sobe a cadeia até encontrar permissões explícitas (ou herança desligada). Espelha a
// função pasta_permissoes_efetivas da migração 136b, para a explicação na página dizer a verdade.
function permissoesEfetivas(porId, id) {
  let actual = id ? porId.get(id) : null;
  let aeroporto = actual?.aeroporto_id || null;
  let n = 0;
  while (actual && n < 20) {
    if (!aeroporto) aeroporto = actual.aeroporto_id || null;
    if (temPermissoesProprias(actual)) {
      return { fonte: actual, perfis: actual.perfis_permitidos, aeroportos: actual.aeroportos_permitidos, emails: actual.emails_permitidos, aeroporto, explicitas: true };
    }
    if (actual.herdar_permissoes === false) break;
    actual = actual.pasta_pai_id ? porId.get(actual.pasta_pai_id) : null;
    n += 1;
  }
  return { fonte: null, perfis: null, aeroportos: null, emails: null, aeroporto, explicitas: false };
}

// Explicação em texto simples de quem vê a pasta.
function QuemVe({ pasta, porId, mapaAero }) {
  // A pré-visualização tem de contar com as alterações ainda não guardadas: substitui-se a pasta no mapa.
  const mapa = useMemo(() => {
    const m = new Map(porId);
    const guardada = porId.get(pasta.id);
    if (guardada) m.set(pasta.id, { ...guardada, ...pasta });
    return m;
  }, [porId, pasta]);
  const ef = permissoesEfetivas(mapa, pasta.id);
  const proprias = temPermissoesProprias(pasta);
  const caminhoDeMapa = (id) => caminhoDe(mapa, id);
  const nomes = (ids) => (ids || []).map(id => nomeAero(mapaAero, id)).join(', ');
  const perfis = (ps) => (ps || []).map(p => PERFIL_DOC_LABEL[p] || p).join(', ');
  const linhas = [];

  if (ef.explicitas) {
    const vazias = !(ef.perfis?.length) && !(ef.aeroportos?.length) && !(ef.emails?.length);
    if (vazias) {
      linhas.push('Nenhum perfil, aeroporto ou email foi autorizado: só administradores do portal vêem esta pasta.');
    } else {
      if (ef.perfis?.length) linhas.push(`Perfis autorizados: ${perfis(ef.perfis)}.`);
      if (ef.aeroportos?.length) linhas.push(`Membros destes aeroportos: ${nomes(ef.aeroportos)}.`);
      if (ef.emails?.length) linhas.push(`Pessoas indicadas pelo email (${ef.emails.length}): ${ef.emails.slice(0, 4).join(', ')}${ef.emails.length > 4 ? '…' : ''} — entram mesmo que não cumpram as regras acima.`);
      if (ef.perfis?.length && ef.aeroportos?.length) linhas.push('É preciso cumprir as duas condições ao mesmo tempo: ter um dos perfis E ser membro de um dos aeroportos.');
    }
    if (!proprias && ef.fonte) linhas.unshift(`Herda as permissões de «${caminhoDeMapa(ef.fonte.id)}».`);
  } else {
    linhas.push(ef.aeroporto
      ? `Sem permissões próprias: vêem-na os membros de ${nomeAero(mapaAero, ef.aeroporto)} (tabela de acessos por aeroporto e respectivos responsáveis).`
      : 'Sem permissões próprias e sem aeroporto: vêem-na todos os membros do portal.');
    if (pasta.herdar_permissoes === false) linhas.push('A herança está desligada, por isso não se procuram permissões nas pastas acima.');
  }
  linhas.push('Os administradores do portal vêem sempre tudo.');

  return (
    <div className="rounded-lg border border-teal-200 bg-teal-50/70 p-3 text-sm text-teal-900 dark:border-teal-900 dark:bg-teal-950/30 dark:text-teal-100">
      <p className="flex items-center gap-1.5 font-medium"><Eye className="h-4 w-4" aria-hidden="true" />Quem vê esta pasta</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[13px] leading-relaxed">{linhas.map((l, i) => <li key={i}>{l}</li>)}</ul>
    </div>
  );
}

// ── nó da árvore ────────────────────────────────────────────────────────────
function No({ no, nivel, seleccionada, aoSelecionar, aberto, alternar, contar }) {
  const temFilhas = no.filhas.length > 0;
  const expandido = aberto.has(no.id);
  const n = contar(no.id);
  return (
    <li>
      <div className={cn('flex items-center gap-1 rounded-lg', seleccionada === no.id && GD.linhaActiva)} style={{ paddingLeft: `${nivel * 0.75}rem` }}>
        {temFilhas ? (
          <button type="button" onClick={() => alternar(no.id)} aria-expanded={expandido} aria-label={expandido ? `Fechar ${no.nome}` : `Abrir ${no.nome}`}
            className={cn('flex h-9 w-6 shrink-0 items-center justify-center rounded', GD.meta, GD.foco, 'hover:text-slate-700 dark:hover:text-slate-200')}>
            {expandido ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
          </button>
        ) : <span className="h-9 w-6 shrink-0" aria-hidden="true" />}
        <button type="button" onClick={() => aoSelecionar(no.id)} aria-current={seleccionada === no.id ? 'true' : undefined}
          className={cn('flex min-h-[2.25rem] min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 text-left text-sm', GD.foco,
            seleccionada === no.id ? 'font-semibold text-teal-900 dark:text-teal-100' : cn(GD.tintaMedia, 'hover:bg-slate-50 dark:hover:bg-slate-800'))}>
          <Folder className="h-4 w-4 shrink-0" style={no.cor ? { color: no.cor } : undefined} aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">{no.nome}</span>
          {temPermissoesProprias(no) && <Lock className={cn('h-3 w-3 shrink-0', GD.alerta)} aria-label="com permissões próprias" />}
          {n > 0 && <span className={cn('shrink-0 text-xs tabular-nums', GD.meta)}>{n}</span>}
        </button>
      </div>
      {temFilhas && expandido && (
        <ul>{no.filhas.map(f => <No key={f.id} no={f} nivel={nivel + 1} seleccionada={seleccionada} aoSelecionar={aoSelecionar} aberto={aberto} alternar={alternar} contar={contar} />)}</ul>
      )}
    </li>
  );
}

// ── criar pasta ─────────────────────────────────────────────────────────────
function DialogNovaPasta({ paiId, porId, aeroportos, actor, onFechar, onFeito }) {
  const { toast } = useToast();
  const pai = paiId ? porId.get(paiId) : null;
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [aeroportoId, setAeroportoId] = useState(pai?.aeroporto_id || '');
  const [cor, setCor] = useState(CORES[0]);
  const [busy, setBusy] = useState(false);
  const criar = async () => {
    if (!nome.trim()) { toast({ title: 'Indique o nome da pasta', variant: 'destructive' }); return; }
    setBusy(true);
    try {
      const irmas = pai ? pai.filhas : [...porId.values()].filter(p => !p.pasta_pai_id);
      const { data, error } = await supabase.from('pasta').insert({
        nome: nome.trim(), descricao: descricao.trim() || null, cor,
        pasta_pai_id: paiId || null, aeroporto_id: aeroportoId || null,
        ordem: irmas.length, herdar_permissoes: true, created_date: new Date().toISOString(),
      }).select('id,nome').single();
      if (error) throw error;
      await auditarDocs(actor, { acao: 'pasta_criada', entidade: 'pasta', id: data.id, detalhes: `Pasta criada: ${pai ? `${caminhoDe(porId, pai.id)} / ` : ''}${data.nome}` });
      toast({ title: 'Pasta criada', description: 'Herda as permissões da pasta acima enquanto não tiver regras próprias.' });
      onFeito(data.id);
    } catch (e) {
      toast({ title: 'Não foi possível criar a pasta', description: e?.message || String(e), variant: 'destructive' });
    } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FolderPlus className="h-5 w-5 text-teal-600" aria-hidden="true" />{pai ? 'Nova subpasta' : 'Nova pasta'}</DialogTitle>
          <DialogDescription className="break-words">{pai ? `Dentro de «${caminhoDe(porId, pai.id)}».` : 'Pasta de primeiro nível.'}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5"><Label htmlFor="np-nome">Nome *</Label><Input id="np-nome" value={nome} onChange={e => setNome(e.target.value)} maxLength={160} autoComplete="off" /></div>
          <div className="space-y-1.5"><Label htmlFor="np-desc">Descrição</Label><Textarea id="np-desc" value={descricao} onChange={e => setDescricao(e.target.value)} rows={2} maxLength={500} /></div>
          <div className="space-y-1.5">
            <Label>Aeroporto</Label>
            <Select options={[{ value: '', label: '— sem aeroporto (para todos os membros) —' }, ...aeroportos.map(a => ({ value: a.id, label: nomeAero(mapaPorId(aeroportos), a.id) }))]} value={aeroportoId} onValueChange={setAeroportoId} />
            <p className={cn('text-sm', GD.meta)}>Sem permissões próprias, é o aeroporto que decide quem vê a pasta.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-2">{CORES.map(c => (
              <button key={c} type="button" onClick={() => setCor(c)} aria-label={`Cor ${c}`} aria-pressed={cor === c}
                className={cn('h-9 w-9 rounded-full border-2', GD.foco, cor === c ? 'border-slate-900 dark:border-white' : 'border-transparent')} style={{ backgroundColor: c }} />
            ))}</div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onFechar} disabled={busy}>Cancelar</Button>
          <Button onClick={criar} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FolderPlus className="h-4 w-4" aria-hidden="true" />}Criar pasta</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── página ──────────────────────────────────────────────────────────────────
export default function PortalPastas() {
  const { user } = useAuth();
  const { toast } = useToast();
  const recarregar = useRecarregarDocs();
  const admin = ehAdminPortal(user);
  const [altura] = useDensidade();

  const pastasQ = usePastasDocs();
  const aeroportosQ = useAeroportosDocs();
  const docsQ = useDocumentosDocs({ limite: 1000 });
  const aeroportos = aeroportosQ.data || [];
  const mapaAero = useMemo(() => mapaPorId(aeroportos), [aeroportos]);
  const { raiz, porId } = useMemo(() => construirArvore(pastasQ.data || []), [pastasQ.data]);

  // A pasta escolhida vive no endereço: a ficha é partilhável e o botão «voltar» do navegador funciona.
  const [{ pasta: pastaUrl }, definir] = useFiltrosUrl({ pasta: '' });
  const [aberto, setAberto] = useState(new Set());
  const [filtroArvore, setFiltroArvore] = useState('');
  const [nova, setNova] = useState(null);      // { paiId } | null
  const [confirmar, setConfirmar] = useState(null);
  const [form, setForm] = useState(null);      // cópia editável da pasta seleccionada
  const [emailsTexto, setEmailsTexto] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendente, setPendente] = useState(null); // pasta criada agora, à espera de aparecer na lista recarregada

  const pasta = pastaUrl ? porId.get(pastaUrl) : null;
  const alternar = (id) => setAberto(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const contarDocs = (id) => (docsQ.data || []).filter(d => d.pasta_id === id).length;
  const docsDaPasta = useMemo(() => (pasta ? (docsQ.data || []).filter(d => d.pasta_id === pasta.id) : []), [docsQ.data, pasta]);

  // Carrega os campos da pasta no formulário sempre que a pasta do endereço muda (ou chega da base de dados).
  const carregarForm = (p) => {
    setForm(p ? {
      nome: p.nome || '', descricao: p.descricao || '', cor: p.cor || '', ordem: Number(p.ordem) || 0,
      pasta_pai_id: p.pasta_pai_id || '', aeroporto_id: p.aeroporto_id || '',
      herdar_permissoes: p.herdar_permissoes !== false,
      restringir: temPermissoesProprias(p),
      perfis_permitidos: p.perfis_permitidos || [],
      aeroportos_permitidos: p.aeroportos_permitidos || [],
    } : null);
    setEmailsTexto((p?.emails_permitidos || []).join(', '));
  };
  const escolher = (id) => {
    definir({ pasta: id || '' }, { substituir: false });
    setAberto(s => {
      const n = new Set(s);
      let actual = porId.get(id);
      let i = 0;
      while (actual?.pasta_pai_id && i < 20) { n.add(actual.pasta_pai_id); actual = porId.get(actual.pasta_pai_id); i += 1; }
      return n;
    });
  };
  // Carrega a ficha quando muda a pasta do endereço — e nunca por cima de alterações ainda não guardadas (a lista
  // pode ser recarregada por trás, por exemplo ao voltar ao separador do navegador).
  const fichaDe = useRef(null);
  useEffect(() => {
    if (!pastaUrl) { if (fichaDe.current !== null) { fichaDe.current = null; carregarForm(null); } return; }
    const p = porId.get(pastaUrl);
    if (!p || fichaDe.current === pastaUrl) return;
    fichaDe.current = pastaUrl;
    carregarForm(p);
  }, [pastaUrl, porId]);

  // Quando a pasta recém-criada chega na lista recarregada, abre-se logo a sua ficha.
  useEffect(() => {
    if (pendente && porId.has(pendente)) { escolher(pendente); setPendente(null); }
  }, [pendente, porId]);

  const set = (k, v) => setForm(x => ({ ...x, [k]: v }));
  const alternarLista = (k, valor) => setForm(x => {
    const actual = new Set(x[k] || []);
    if (actual.has(valor)) actual.delete(valor); else actual.add(valor);
    return { ...x, [k]: [...actual] };
  });

  const guardar = async () => {
    if (!pasta || !form) return;
    if (!form.nome.trim()) { toast({ title: 'Indique o nome da pasta', variant: 'destructive' }); return; }
    setBusy(true);
    try {
      const emails = listaEmails(emailsTexto);
      const patch = {
        nome: form.nome.trim(),
        descricao: form.descricao.trim() || null,
        cor: form.cor || null,
        ordem: Number(form.ordem) || 0,
        pasta_pai_id: form.pasta_pai_id || null,
        aeroporto_id: form.aeroporto_id || null,
        herdar_permissoes: !!form.herdar_permissoes,
        // «Restringir» desligado = sem permissões próprias (colunas a null): a pasta volta a herdar ou a valer
        // pela regra do aeroporto. Guardar listas vazias, no servidor, seria fechar a pasta a todos.
        perfis_permitidos: form.restringir ? vazioOuNulo(form.perfis_permitidos) : null,
        aeroportos_permitidos: form.restringir ? vazioOuNulo(form.aeroportos_permitidos) : null,
        emails_permitidos: form.restringir ? vazioOuNulo(emails) : null,
        updated_date: new Date().toISOString(),
      };
      const { error } = await supabase.from('pasta').update(patch).eq('id', pasta.id);
      if (error) throw error;
      await auditarDocs(user, { acao: 'pasta_alterada', entidade: 'pasta', id: pasta.id, detalhes: `Pasta alterada: ${patch.nome}${form.restringir ? ' (permissões próprias)' : ' (sem permissões próprias)'}` });
      toast({ title: 'Pasta guardada', description: 'As regras aplicam-se de imediato a quem consulta.' });
      recarregar();
    } catch (e) {
      toast({ title: 'Não foi possível guardar', description: e?.message || String(e), variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const arquivar = async () => {
    if (!pasta) return;
    setBusy(true);
    try {
      const { error } = await supabase.from('pasta').update({ deleted_at: new Date().toISOString() }).eq('id', pasta.id);
      if (error) throw error;
      await auditarDocs(user, { acao: 'pasta_arquivada', entidade: 'pasta', id: pasta.id, detalhes: `Pasta arquivada: ${caminhoDe(porId, pasta.id)}` });
      toast({ title: 'Pasta arquivada', description: 'Deixa de aparecer na biblioteca. Os documentos continuam a existir.' });
      definir({ pasta: '' });
      setForm(null);
      recarregar();
    } catch (e) {
      toast({ title: 'Não foi possível arquivar', description: e?.message || String(e), variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const alterado = useMemo(() => {
    if (!pasta || !form) return false;
    const base = {
      nome: pasta.nome || '', descricao: pasta.descricao || '', cor: pasta.cor || '', ordem: Number(pasta.ordem) || 0,
      pasta_pai_id: pasta.pasta_pai_id || '', aeroporto_id: pasta.aeroporto_id || '',
      herdar_permissoes: pasta.herdar_permissoes !== false, restringir: temPermissoesProprias(pasta),
      perfis_permitidos: pasta.perfis_permitidos || [], aeroportos_permitidos: pasta.aeroportos_permitidos || [],
    };
    const emailsIguais = JSON.stringify(listaEmails(emailsTexto)) === JSON.stringify(pasta.emails_permitidos || []);
    return JSON.stringify(base) !== JSON.stringify({ ...form, nome: form.nome, descricao: form.descricao }) || !emailsIguais;
  }, [pasta, form, emailsTexto]);

  const foraDeMover = useMemo(() => (pasta ? descendentes(porId, pasta.id) : new Set()), [pasta, porId]);
  const opcoesPai = useMemo(() => [
    { value: '', label: '— primeiro nível —' },
    ...[...porId.values()].filter(p => !foraDeMover.has(p.id)).map(p => ({ value: p.id, label: caminhoDe(porId, p.id) })).sort((a, b) => a.label.localeCompare(b.label, 'pt')),
  ], [porId, foraDeMover]);
  const opcoesAero = useMemo(() => [{ value: '', label: '— sem aeroporto —' }, ...aeroportos.map(a => ({ value: a.id, label: nomeAero(mapaAero, a.id) }))], [aeroportos, mapaAero]);

  const total = (pastasQ.data || []).length;
  const comRegras = (pastasQ.data || []).filter(temPermissoesProprias).length;
  const semAeroporto = (pastasQ.data || []).filter(p => !p.aeroporto_id && !temPermissoesProprias(p)).length;

  // Filtro da árvore: mostra as pastas cujo caminho contém o texto (e mantém a hierarquia visível).
  const arvoreFiltrada = useMemo(() => {
    const t = filtroArvore.trim().toLowerCase();
    if (!t) return raiz;
    const combina = (no) => {
      const filhas = (no.filhas || []).map(combina).filter(Boolean);
      const eu = String(no.nome || '').toLowerCase().includes(t);
      return eu || filhas.length ? { ...no, filhas } : null;
    };
    return raiz.map(combina).filter(Boolean);
  }, [raiz, filtroArvore]);
  useEffect(() => {
    if (filtroArvore.trim()) setAberto(new Set((pastasQ.data || []).map(p => p.id)));
  }, [filtroArvore, pastasQ.data]);

  return (
    <PaginaGestao
      titulo="Pastas"
      descricao="A estrutura da biblioteca e as permissões de cada pasta. As subpastas herdam as permissões da pasta acima enquanto não tiverem regras próprias."
      accoes={<>
        <Button variant="outline" onClick={() => recarregar('pastas')} disabled={pastasQ.isFetching}><RefreshCw className={cn('h-4 w-4', pastasQ.isFetching && 'animate-spin')} aria-hidden="true" />Actualizar</Button>
        <Button onClick={() => setNova({ paiId: null })}><FolderPlus className="h-4 w-4" aria-hidden="true" />Nova pasta</Button>
      </>}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={cn('text-sm tabular-nums', GD.tintaMedia)}>
          {pastasQ.isLoading ? 'A carregar…' : <>{total} pasta{total === 1 ? '' : 's'} · {comRegras} com permissões próprias{semAeroporto ? ` · ${semAeroporto} sem aeroporto nem regras (vêem-nas todos os membros)` : ''}</>}
        </p>
        <details className="text-sm">
          <summary className={cn('cursor-pointer rounded px-1', GD.acento, GD.foco)}>Como funcionam as permissões</summary>
          <ol className={cn('mt-2 max-w-3xl list-decimal space-y-1 rounded-lg border p-3 pl-7 text-[13px] leading-relaxed', GD.borda, GD.superficieFraca, GD.tintaMedia)}>
            <li>Uma pasta <strong>sem regras próprias</strong> sobe a árvore até encontrar a primeira pasta que as tenha — é essa que manda.</li>
            <li>Se nenhuma pasta acima tiver regras, vêem-na os <strong>membros do aeroporto da pasta</strong>; sem aeroporto, todos os membros do portal.</li>
            <li>Com regras próprias, é preciso cumprir <strong>todas</strong> as condições indicadas (perfil <em>e</em> aeroporto); os <strong>emails</strong> indicados entram sempre.</li>
            <li>Desligar a herança impede que as pastas acima decidam por esta.</li>
            <li>Os administradores do portal vêem tudo; rascunhos e revisões só aparecem a quem edita.</li>
          </ol>
        </details>
      </div>

      <div className="grid gap-5 lg:grid-cols-[19rem_minmax(0,1fr)]">
        {/* ── árvore ── */}
        <Painel className="lg:sticky lg:top-[var(--topo-fixo,1.5rem)] lg:self-start">
          <Cabecalho icone={FolderTree} titulo="Árvore de pastas" contagem={pastasQ.isLoading ? null : total} />
          <div className={cn('border-b p-2', GD.borda)}>
            <div className="relative">
              <Search className={cn('pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2', GD.meta)} aria-hidden="true" />
              <Input value={filtroArvore} onChange={e => setFiltroArvore(e.target.value)} placeholder="Filtrar pastas…" aria-label="Filtrar as pastas pelo nome" className="h-9 pl-8" />
            </div>
          </div>
          <div className="max-h-[32rem] overflow-auto p-1.5">
            {pastasQ.isLoading ? <div className="space-y-2 p-1.5">{[0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="h-9 w-full" />)}</div>
              : pastasQ.isError ? <Falha texto={`${pastasQ.error?.message || 'Não foi possível carregar as pastas.'} Sem a árvore não é possível editar permissões.`} onTentar={() => pastasQ.refetch()} />
                : raiz.length === 0 ? (
                  <Vazio icone={FolderTree} titulo="Ainda não há pastas" texto="A biblioteca organiza-se por pastas, uma por aeroporto e assunto. Crie a primeira." className="py-8">
                    <Button onClick={() => setNova({ paiId: null })}><FolderPlus className="h-4 w-4" aria-hidden="true" />Nova pasta</Button>
                  </Vazio>
                ) : arvoreFiltrada.length === 0 ? (
                  <Vazio icone={Search} titulo="Nenhuma pasta com esse nome" texto="Experimente outro texto ou limpe o filtro." className="py-8">
                    <Button variant="outline" size="sm" onClick={() => setFiltroArvore('')}><X className="h-4 w-4" aria-hidden="true" />Limpar filtro</Button>
                  </Vazio>
                ) : (
                  <ul>{arvoreFiltrada.map(n => <No key={n.id} no={n} nivel={0} seleccionada={pastaUrl} aoSelecionar={escolher} aberto={aberto} alternar={alternar} contar={contarDocs} />)}</ul>
                )}
          </div>
        </Painel>

        {/* ── ficha da pasta ── */}
        <div className="min-w-0 space-y-4">
          {!pasta ? (
            <Painel>
              <Vazio icone={Folder} titulo="Escolha uma pasta" texto="Na árvore ao lado, escolha a pasta que quer renomear, mover, arquivar ou cujas permissões quer acertar. O endereço guarda a escolha, por isso pode partilhar a ficha de uma pasta." />
            </Painel>
          ) : (
            <>
              <Painel>
                <Cabecalho
                  caixaAlta={false}
                  titulo={<span className="inline-flex items-center gap-2"><Folder className="h-4 w-4" style={pasta.cor ? { color: pasta.cor } : undefined} aria-hidden="true" />{caminhoDe(porId, pasta.id)}</span>}
                  descricao={`${contarDocs(pasta.id)} documento(s) directo(s) · ${pasta.filhas.length} subpasta(s) · ${nomeAero(mapaAero, pasta.aeroporto_id)}`}
                  accoes={<Button asChild variant="outline" size="sm"><Link to={urlBiblioteca(pasta.aeroporto_id || '', pasta.id)}><Eye className="h-4 w-4" aria-hidden="true" />Ver na biblioteca</Link></Button>}
                />
                <div className="grid gap-4 p-3 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="pa-nome">Nome</Label><Input id="pa-nome" value={form?.nome || ''} onChange={e => set('nome', e.target.value)} maxLength={160} autoComplete="off" /></div>
                  <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="pa-desc">Descrição</Label><Textarea id="pa-desc" value={form?.descricao || ''} onChange={e => set('descricao', e.target.value)} rows={2} maxLength={500} /></div>
                  <div className="space-y-1.5">
                    <Label>Pasta acima (mover)</Label>
                    <Select options={opcoesPai} value={form?.pasta_pai_id || ''} onValueChange={v => set('pasta_pai_id', v)} />
                    <p className={cn('flex items-start gap-1 text-sm', GD.meta)}><CornerUpRight className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />Mover muda também quem vê a pasta, se ela herdar permissões.</p>
                  </div>
                  <div className="space-y-1.5"><Label>Aeroporto</Label><Select options={opcoesAero} value={form?.aeroporto_id || ''} onValueChange={v => set('aeroporto_id', v)} /></div>
                  <div className="space-y-1.5"><Label htmlFor="pa-ordem">Ordem</Label><Input id="pa-ordem" type="number" min={0} max={999} value={form?.ordem ?? 0} onChange={e => set('ordem', e.target.value)} className="max-w-[8rem]" /><p className={cn('text-sm', GD.meta)}>Número menor aparece primeiro entre as pastas do mesmo nível.</p></div>
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5"><Palette className={cn('h-4 w-4', GD.meta)} aria-hidden="true" />Cor</Label>
                    <div className="flex flex-wrap gap-2">
                      {CORES.map(c => (
                        <button key={c} type="button" onClick={() => set('cor', c)} aria-label={`Cor ${c}`} aria-pressed={form?.cor === c}
                          className={cn('h-9 w-9 rounded-full border-2', GD.foco, form?.cor === c ? 'border-slate-900 dark:border-white' : 'border-transparent')} style={{ backgroundColor: c }} />
                      ))}
                      <button type="button" onClick={() => set('cor', '')} aria-label="Sem cor" className={cn('flex h-9 w-9 items-center justify-center rounded-full border-2', GD.meta, GD.foco, !form?.cor ? 'border-slate-900 dark:border-white' : GD.borda)}><X className="h-4 w-4" aria-hidden="true" /></button>
                    </div>
                  </div>
                </div>
              </Painel>

              <Painel>
                <Cabecalho
                  icone={ShieldCheck}
                  titulo="Permissões da pasta"
                  descricao="Sem regras próprias a pasta herda de cima. Ligue a restrição só quando esta pasta tiver de ser mais fechada do que a pasta onde está."
                />
                <div className="space-y-4 p-3">
                  <div className="flex items-start justify-between gap-4">
                    <div><Label htmlFor="pa-herdar" className="font-medium">Herdar permissões da pasta acima</Label><p className={cn('text-sm', GD.meta)}>Desligado: a pasta não aceita as regras das pastas acima e passa a valer a regra do seu aeroporto (ou as suas regras próprias).</p></div>
                    <Switch id="pa-herdar" checked={!!form?.herdar_permissoes} onCheckedChange={v => set('herdar_permissoes', v)} />
                  </div>
                  <div className={cn('flex items-start justify-between gap-4 border-t pt-4', GD.borda)}>
                    <div><Label htmlFor="pa-restr" className="font-medium">Dar a esta pasta permissões próprias</Label><p className={cn('text-sm', GD.meta)}>Ligado: só quem cumprir as condições abaixo vê a pasta (e as subpastas que herdarem dela).</p></div>
                    <Switch id="pa-restr" checked={!!form?.restringir} onCheckedChange={v => set('restringir', v)} />
                  </div>

                  {form?.restringir && (
                    <div className={cn('space-y-4 rounded-lg border p-3', GD.borda)}>
                      <fieldset className="space-y-2">
                        <legend className="flex items-center gap-1.5 text-sm font-medium"><Users className={cn('h-4 w-4', GD.meta)} aria-hidden="true" />Perfis do portal autorizados</legend>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {PERFIS_PORTAL_DOCS.map(p => (
                            <label key={p.chave} className={cn('flex items-start gap-2 rounded-lg border p-2.5 text-sm', GD.borda)}>
                              <Checkbox className="mt-0.5" checked={(form.perfis_permitidos || []).includes(p.chave)} onCheckedChange={() => alternarLista('perfis_permitidos', p.chave)} aria-label={p.label} />
                              <span><span className="block font-medium">{p.label}</span><span className={cn('text-sm', GD.meta)}>{p.descricao}</span></span>
                            </label>
                          ))}
                        </div>
                        <p className={cn('text-sm', GD.meta)}>Nenhum escolhido = o perfil não é usado como condição.</p>
                      </fieldset>
                      <fieldset className={cn('space-y-2 border-t pt-3', GD.borda)}>
                        <legend className="text-sm font-medium">Aeroportos autorizados</legend>
                        <div className="flex flex-wrap gap-1.5">
                          {aeroportos.map(a => (
                            <Ficha key={a.id} activa={(form.aeroportos_permitidos || []).includes(a.id)} aoClicar={() => alternarLista('aeroportos_permitidos', a.id)} titulo={nomeAero(mapaAero, a.id)}>
                              {a.codigo_icao || a.nome}
                            </Ficha>
                          ))}
                        </div>
                        <p className={cn('text-sm', GD.meta)}>Nenhum escolhido = o aeroporto não é usado como condição. Conta a pessoa ser membro do aeroporto (ou sua responsável).</p>
                      </fieldset>
                      <div className={cn('space-y-1.5 border-t pt-3', GD.borda)}>
                        <Label htmlFor="pa-emails">Pessoas sempre autorizadas (emails)</Label>
                        <Textarea id="pa-emails" value={emailsTexto} onChange={e => setEmailsTexto(e.target.value)} rows={2} placeholder="nome@sga.co.ao, outro@sga.co.ao" />
                        <p className={cn('text-sm', GD.meta)}>Separados por vírgula. Entram mesmo que não cumpram as condições de perfil e aeroporto — útil para auditores internos e chefias.</p>
                      </div>
                    </div>
                  )}

                  <QuemVe pasta={{ ...pasta, ...(form || {}), perfis_permitidos: form?.restringir ? vazioOuNulo(form.perfis_permitidos) : null, aeroportos_permitidos: form?.restringir ? vazioOuNulo(form.aeroportos_permitidos) : null, emails_permitidos: form?.restringir ? vazioOuNulo(listaEmails(emailsTexto)) : null }} porId={porId} mapaAero={mapaAero} />

                  {pasta.filhas.length > 0 && (
                    <p className={cn('flex items-start gap-2 text-sm', GD.meta)}>
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      {pasta.filhas.filter(f => !temPermissoesProprias(f)).length} de {pasta.filhas.length} subpasta(s) herdam estas regras; as restantes têm permissões próprias e não são afectadas.
                    </p>
                  )}
                </div>
              </Painel>

              {/* ── acções normais, separadas das irreversíveis ── */}
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={guardar} disabled={busy || !alterado}>{busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}Guardar pasta</Button>
                <Button variant="outline" onClick={() => carregarForm(pasta)} disabled={busy || !alterado}><X className="h-4 w-4" aria-hidden="true" />Descartar alterações</Button>
                <Button variant="outline" onClick={() => setNova({ paiId: pasta.id })}><FolderPlus className="h-4 w-4" aria-hidden="true" />Nova subpasta</Button>
                {alterado && <span className={cn('text-sm', GD.alerta)}>Alterações por guardar.</span>}
              </div>

              {/* ── documentos que estão nesta pasta ── */}
              <Painel>
                <Cabecalho
                  icone={FileText}
                  titulo="Documentos nesta pasta"
                  contagem={docsQ.isLoading ? null : docsDaPasta.length}
                  descricao="Directos, sem contar os das subpastas. Para mudar um documento de pasta, abra-o em Documentos."
                  accoes={docsDaPasta.length > 0 && <Button asChild variant="outline" size="sm"><Link to={`${PORTAL_BASE}/gestao/documentos?pasta=${pasta.id}`}>Abrir em Documentos<ChevronRight className="h-4 w-4" aria-hidden="true" /></Link></Button>}
                />
                <Tabela altura={altura} alturaMax="24rem" rotulo="Documentos directos desta pasta">
                  <thead>
                    <tr>
                      <Th>Documento</Th>
                      <Th>Estado</Th>
                      <Th numerico estreito>Versão</Th>
                      <Th className="hidden sm:table-cell">Em vigor desde</Th>
                      <Th className="hidden md:table-cell">Validade</Th>
                    </tr>
                  </thead>
                  {docsQ.isLoading ? <LinhasEsqueleto linhas={3} colunas={5} altura={altura} />
                    : docsQ.isError ? (
                      <LinhaMensagem colunas={5}>
                        <Falha titulo="Não foi possível contar os documentos" texto={`${docsQ.error?.message || 'Falha de rede.'} A estrutura e as permissões das pastas não são afectadas.`} onTentar={() => docsQ.refetch()} />
                      </LinhaMensagem>
                    ) : docsDaPasta.length === 0 ? (
                      <LinhaMensagem colunas={5}>
                        <Vazio icone={FileText} titulo="Pasta sem documentos directos" texto={pasta.filhas.length ? 'Os documentos podem estar nas subpastas. Escolha uma subpasta na árvore.' : 'Crie o documento em Documentos e escolha esta pasta.'} className="py-8">
                          <Button asChild variant="outline" size="sm"><Link to={`${PORTAL_BASE}/gestao/documentos?pasta=${pasta.id}`}>Criar aqui um documento</Link></Button>
                        </Vazio>
                      </LinhaMensagem>
                    ) : (
                      <tbody>
                        {docsDaPasta.slice(0, 50).map(d => (
                          <Tr key={d.id}>
                            <Td className="max-w-[24rem]"><CelulaDocumento doc={d} /></Td>
                            <Td><EstadoChip estado={d.estado} /></Td>
                            <Td numerico className={cn('text-sm', GD.ref, GD.meta)}>{versaoDoc(d)}</Td>
                            <Td className={cn('hidden text-sm tabular-nums sm:table-cell', GD.meta)}>{textoVigor(d)}</Td>
                            <Td className="hidden md:table-cell"><ValidadeChip documento={d} sempre /></Td>
                          </Tr>
                        ))}
                      </tbody>
                    )}
                </Tabela>
                {docsDaPasta.length > 50 && <p className={cn('px-3 py-2 text-sm', GD.meta)}>A mostrar os primeiros 50 de {docsDaPasta.length}.</p>}
              </Painel>

              {admin ? (
                <ZonaRisco texto="Arquivar esconde a pasta da biblioteca. Os documentos continuam a existir, mas ficam sem pasta visível até serem movidos. Só quem administra a base de dados pode repor a pasta.">
                  <Button variant="outline" className={cn('border-red-200 dark:border-red-900', GD.perigo)} disabled={busy}
                    onClick={() => setConfirmar({
                      t: 'Arquivar pasta',
                      m: `Arquivar «${caminhoDe(porId, pasta.id)}»?${pasta.filhas.length ? ` Tem ${pasta.filhas.length} subpasta(s), que deixam de aparecer na biblioteca.` : ''}${contarDocs(pasta.id) ? ` Os ${contarDocs(pasta.id)} documento(s) continuam a existir mas ficam sem pasta visível.` : ''} A pasta pode ser reposta por quem administra a base de dados.`,
                      f: arquivar,
                    })}>
                    <Archive className="h-4 w-4" aria-hidden="true" />Arquivar pasta
                  </Button>
                </ZonaRisco>
              ) : (
                <p className={cn('flex items-start gap-1.5 text-sm', GD.meta)}>
                  <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />Arquivar pastas é reservado a administradores do portal.
                </p>
              )}
            </>
          )}

          {docsQ.isError && !pasta && (
            <p className={cn('flex items-start gap-2 rounded-lg border p-3 text-sm', GD.avisoSuave)}>
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />Não foi possível contar os documentos de cada pasta ({docsQ.error?.message || 'falha de rede'}). A estrutura das pastas não é afectada.
            </p>
          )}
        </div>
      </div>

      {nova && (
        <DialogNovaPasta
          paiId={nova.paiId}
          porId={porId}
          aeroportos={aeroportos}
          actor={user}
          onFechar={() => setNova(null)}
          onFeito={(id) => { setNova(null); setPendente(id); recarregar('pastas'); }}
        />
      )}
      <ConfirmModal isOpen={!!confirmar} onClose={() => setConfirmar(null)} onConfirm={() => confirmar?.f?.()} title={confirmar?.t} message={confirmar?.m} confirmText={confirmar?.t} variant="destructive" />
    </PaginaGestao>
  );
}
