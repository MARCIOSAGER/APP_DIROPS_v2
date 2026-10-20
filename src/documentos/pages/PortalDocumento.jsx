// Ficha de um documento (/documentos/documento/:id).
// A página lê-se de cima para baixo: quem é o documento (número, título, estado, versão e entrada em vigor),
// o que fazer com ele (abrir, descarregar, confirmar a leitura, partilhar com externos), o ficheiro ao centro e
// as provas à direita em separadores (versões, quem confirmou, acessos). As acções que fecham portas ficam
// sozinhas no fim, depois de espaço em branco deliberado, para ninguém lhes dar sem querer.
// A faixa de largura total do topo é a ÚNICA de todo o produto e está reservada a uma coisa: o documento que se
// está a ver não é o que está em vigor. Se tudo avisasse, nada avisaria.
// Se o documento pedir senha, ela é validada SEMPRE no servidor (documentos-acesso › senha) — nunca aqui.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import IniciarFluxo from '../components/fluxo/IniciarFluxo';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle, ArrowLeft, Building2, Check, CheckCircle2, Copy, Download, ExternalLink, Eye, FileText,
  History, KeyRound, Library, Link2, Loader2, Lock, ShieldAlert, ShieldCheck, Tag, Users, X,
  Stamp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle,
  AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { cn, copyToClipboard } from '@/lib/utils';
import { fmtData, fmtDataHora } from '@/lib/safeDate';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { PORTAL_BASE, ehGestorDocs, ehEditorDocs, estadoValidade } from '@/lib/portalDocumentos';
import { obterUrlAssinadaDocumento } from '@/functions/obterUrlAssinadaDocumento';
import { registrarAcessoDocumento } from '@/functions/registrarAcessoDocumento';
import { validarSenhaDocs } from '@/documentos/api';
import {
  useDocumentoDocs, useVersoesDocumento, useMinhasLeituras, useLeiturasDocumento, confirmarLeitura,
  useAeroportosDocs, useTiposDocumento, usePastasDocs, useRecarregarDocs,
  useLinksPartilhaDocs, useEnderecosLinksDocs, useRegistoEmendas, auditarDocs,
} from '../hooks';
import { protegerPdfAvsec, hashCurtoSenha, ehAvsecRestrito } from '../pdfProtegido';
// O Registo de Emendas é o mesmo bloco aqui e na gestão (as sete colunas do Anexo 3 vêm da vista): uma só
// implementação, para o formato legal não poder divergir entre os dois ecrãs.
import { RegistoEmendasDocumento } from './gestao/PortalEmendas';
// As duas pontes da migração 159. Ficam depois do ficheiro e antes da zona de risco, em largura total: são
// relações do documento com o resto da casa (a formação que o ensina, os requisitos legais que ele cumpre) e não
// «provas» como as versões ou as confirmações — por isso não entram nos separadores da direita.
import FormacaoDoDocumento from '../components/conformidade/FormacaoDoDocumento';
import RequisitosDoDocumento from '../components/conformidade/RequisitosDoDocumento';
import {
  tk, cartao, EstadoChip, ValidadeChip, Falha, Vazio, mapaPorId, nomeAero, rotuloTipo, versaoDoc,
  emVigorDesde, pessoaDeEmail, urlBiblioteca,
} from './PortalBiblioteca';
// Classe e processo (migração 157): o número do documento já os dizia, mas em código. Aqui dizem-se por palavras.
import { useClassesDocs, useProcessosDocs, nomeClasse, nomeProcesso } from '../hooksCodificacao';
import { nomeFicheiroDoc } from '../nomeDocumento';
// O leitor próprio (pdf.js) substitui o <iframe> do visualizador nativo. É ele que torna a página um estado desta
// aplicação — sem isso não há «abrir na página 47», nem realçar o termo, nem ler uma cópia guardada sem rede.
import LeitorPdf from '../components/leitor/LeitorPdf';
import { BotaoCompararVersoes } from '../components/edicao/CompararVersoes';
// Reserva para edição (check-out) e «Carregar nova versão (rascunho)» — Fase F0 do plano de edição.
import ReservaDocumento from '../components/edicao/ReservaDocumento';
import BotaoEditarNavegador from '../components/edicao/BotaoEditarNavegador';
import { useReservaDocumento, reservaActiva, reservadaPorMim } from '../hooksEdicao';
import { rascunhoDoDocumento } from '../edicao/hooksEstruturado';

const PROVAS_GESTAO = ['leituras', 'acessos'];
// O registo de emendas não é prova de gestão: é a peça que a lei manda ter à mão de quem usa o manual, e é
// também onde cada detentor confirma, dentro de trinta dias, que inseriu a emenda (Instrutivo 22C.107.001.A,
// Apêndice 1, §1.5). Por isso o separador existe para todos.
const PROVAS_TODOS = ['versoes', 'emendas'];

const IMAGENS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'];
const CONFIDENCIALIDADE = { interno: 'Interno', confidencial: 'Confidencial', secreto: 'Secreto' };
const DIAS_PARTILHA = [1, 7, 14, 30];     // tecto de 30 dias, imposto também pelo servidor
const DIAS_SUGERIDO = 7;

const extensaoDe = (nome) => String(nome || '').split('?')[0].split('#')[0].split('.').pop().toLowerCase();
function tamanhoLegivel(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} kB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
const linkActivo = (l) => !l.revogado_em && (!l.expira_em || new Date(l.expira_em) > new Date());
// Versão «fonte editável»: o ficheiro de origem (p.ex. o .docx que deu o PDF em vigor). Não é uma revisão da
// sequência — é o mesmo documento noutro formato. Reconhece-se pelo estado «fonte» ou pelo rótulo «Fonte editável».
const ehVersaoFonte = (v) => v?.estado === 'fonte' || /^\s*fonte\s*edit/i.test(String(v?.rotulo || ''));

function Campo({ rotulo, children }) {
  if (children === null || children === undefined || children === '') return null;
  return (
    <div className="min-w-0">
      <dt className={cn('text-xs font-semibold uppercase tracking-wider', tk.tintaFraca)}>{rotulo}</dt>
      <dd className={cn('mt-0.5 break-words text-sm', tk.tintaMedia)}>{children}</dd>
    </div>
  );
}

function Painel({ titulo, icone: Icone, children, className }) {
  return (
    <section className={cn(cartao, className)}>
      <h2 className={cn('flex items-center gap-2 border-b px-4 py-3 text-sm font-semibold', tk.borda, tk.tinta)}>
        {Icone && <Icone className={cn('h-4 w-4', tk.acento)} aria-hidden="true" />}{titulo}
      </h2>
      {children}
    </section>
  );
}

// ── a única faixa de largura total do produto ───────────────────────────────
// Forma própria, que não se repete em mais lado nenhum: sangra até às margens do conteúdo, sem cantos
// arredondados, com listas diagonais de aviso à esquerda e hairlines fortes em cima e em baixo.
function FaixaSubstituido({ titulo, texto, acao }) {
  return (
    <div role="alert" className={cn('-mx-4 border-y-2 md:-mx-6', tk.avisoLinha, tk.avisoFundo, tk.aviso)}>
      <div className="mx-auto flex max-w-screen-2xl items-stretch gap-3 px-4 py-3 md:px-6">
        <span
          aria-hidden="true"
          className="w-2.5 shrink-0 rounded-sm"
          style={{ backgroundImage: 'repeating-linear-gradient(45deg, currentColor 0 5px, transparent 5px 10px)' }}
        />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em]">
            <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />{titulo}
          </p>
          <p className={cn('mt-1 text-sm', tk.tinta)}>{texto}</p>
          {acao}
        </div>
      </div>
    </div>
  );
}

// ── separador «acessos» (só gestão) ─────────────────────────────────────────
// Consulta local: a camada de dados partilhada não tem o registo por documento e não lhe mexo nesta passagem.
// Fica com a chave ['gd', …] para seguir as invalidações do resto do portal.
const ACCAO = { visualizacao: 'Viu', download: 'Descarregou', impressao: 'Imprimiu' };
function Acessos({ documentoId }) {
  const q = useQuery({
    queryKey: ['gd', 'acessos-documento', documentoId],
    enabled: !!documentoId,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from('log_acesso_documento')
        .select('usuario_email,usuario_nome,tipo_acesso,data_hora_acesso')
        .eq('documento_id', documentoId)
        .order('data_hora_acesso', { ascending: false })
        .limit(200);
      if (error) throw error;
      return Array.isArray(data) ? data : [];
    },
  });

  if (q.isLoading) return <div className="space-y-2 p-4">{[0, 1, 2].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>;
  if (q.isError) return <Falha titulo="Não foi possível ver o registo de acessos" texto="O registo existe no servidor, mas não chegou aqui. Tente de novo." onTentar={() => q.refetch?.()} className="py-10" />;
  if (!q.data?.length) return <Vazio icone={Eye} titulo="Sem acessos registados" texto="Ninguém abriu nem descarregou este documento desde que passou a ser servido pelo portal." className="py-10" />;
  return (
    <ul className={cn('max-h-80 divide-y overflow-y-auto', tk.divisoria)}>
      {q.data.map((a, i) => (
        <li key={`${a.usuario_email}-${a.data_hora_acesso}-${i}`} className="flex items-center gap-3 px-4 py-2.5">
          <span className="min-w-0 flex-1">
            <span className={cn('block truncate text-sm', tk.tinta)}>{a.usuario_nome || pessoaDeEmail(a.usuario_email) || a.usuario_email}</span>
            <span className={cn('block truncate text-xs', tk.tintaFraca)}>{a.usuario_email}</span>
          </span>
          <span className="shrink-0 text-right">
            <span className={cn('block text-xs font-medium', a.tipo_acesso === 'download' ? tk.acento : tk.tintaMedia)}>{ACCAO[a.tipo_acesso] || a.tipo_acesso}</span>
            <span className={cn('block text-xs', tk.mono, tk.tintaFraca)}>{fmtDataHora(a.data_hora_acesso)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

// ── partilha com externos (só gestão) ──────────────────────────────────────
// Atalho a partir do documento; a vista geral de todos os links continua a ser Gestão › Links.
// Montado só quando a gestão abre o painel — assim os pedidos de links não correm para quem só está a ler.
function PartilhaExterna({ doc, aoFechar }) {
  const recarregar = useRecarregarDocs();
  const linksQ = useLinksPartilhaDocs();
  const enderecosQ = useEnderecosLinksDocs();

  const [dias, setDias] = useState(DIAS_SUGERIDO);
  const [senha, setSenha] = useState('');
  const [maxDescargas, setMaxDescargas] = useState('');
  const [aCriar, setACriar] = useState(false);
  const [erro, setErro] = useState('');
  const [criado, setCriado] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const [aAnular, setAAnular] = useState(null);     // link à espera de confirmação
  const [anulando, setAnulando] = useState(false);
  const [copiadoId, setCopiadoId] = useState('');

  const secreto = doc?.nivel_confidencialidade === 'secreto';
  const tokens = enderecosQ.data?.tokens || {};
  const base = enderecosQ.data?.base || '';
  const enderecoDe = (l) => (tokens[l.id] ? `${base || window.location.origin}/s/${tokens[l.id]}` : '');
  const activos = useMemo(
    () => (linksQ.data || []).filter(l => l.documento_id === doc?.id && linkActivo(l)),
    [linksQ.data, doc?.id],
  );

  const criar = async (e) => {
    e?.preventDefault?.();
    if (secreto || aCriar) return;
    setACriar(true); setErro('');
    try {
      const { data, error } = await supabase.functions.invoke('share-link-create', {
        body: {
          documento_id: doc.id,
          dias_validade: dias,
          password: senha || null,
          max_downloads: maxDescargas ? parseInt(maxDescargas, 10) : null,
        },
      });
      if (error) throw new Error(error.message || 'Não foi possível criar o endereço.');
      if (data?.error) throw new Error(data.error);
      setCriado(data);
      setSenha(''); setMaxDescargas('');
      recarregar('links'); recarregar('links-enderecos');
    } catch (err) {
      setErro(err?.message || 'Não foi possível criar o endereço.');
    } finally { setACriar(false); }
  };

  const copiar = async () => {
    const url = criado?.url || '';
    if (!url) return;
    if (await copyToClipboard(url)) { setCopiado(true); setTimeout(() => setCopiado(false), 2000); }
    else setErro('Não foi possível copiar. Seleccione o endereço e copie à mão.');
  };

  const anular = async () => {
    if (!aAnular) return;
    setAnulando(true);
    try {
      const { data, error } = await supabase.functions.invoke('share-link-revoke', { body: { link_id: aAnular.id } });
      if (error) throw new Error(error.message || 'Não foi possível anular.');
      if (data?.error) throw new Error(data.error);
      if (criado && aAnular.id === criado.id) setCriado(null);
      recarregar('links');
      setAAnular(null);
    } catch (err) {
      setErro(err?.message || 'Não foi possível anular o endereço.');
    } finally { setAnulando(false); }
  };

  return (
    <section id="gd-partilha" className={cn(cartao, 'overflow-hidden')} aria-label="Partilhar com externos">
      <div className={cn('flex items-start gap-2 border-b px-4 py-3', tk.borda)}>
        <Link2 className={cn('mt-0.5 h-4 w-4 shrink-0', tk.acento)} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 className={cn('text-sm font-semibold', tk.tinta)}>Partilhar com externo</h2>
          <p className={cn('text-sm', tk.tintaFraca)}>Um endereço temporário para quem não tem conta no portal — a ANAC, um auditor.</p>
        </div>
        <button type="button" onClick={aoFechar} aria-label="Fechar a partilha" className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-lg', tk.tintaFraca, tk.foco, tk.hover)}>
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {secreto ? (
        <div className={cn('m-4 flex items-start gap-3 rounded-xl border p-4', tk.perigoBorda, tk.perigoFundo)}>
          <ShieldAlert className={cn('mt-0.5 h-5 w-5 shrink-0', tk.perigo)} aria-hidden="true" />
          <div>
            <p className={cn('text-sm font-semibold', tk.perigo)}>Este documento está classificado como secreto.</p>
            <p className={cn('mt-1 text-sm', tk.tintaMedia)}>
              Documentos secretos não podem sair por endereço partilhável — o servidor recusa o pedido. Para dar
              acesso a alguém de fora, baixe a classificação em Gestão › Documentos ou entregue o ficheiro por outra via,
              deixando registo de quem o recebeu.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4 p-4">
          {/* o que já está aberto — ver isto é tão importante como criar mais um */}
          <div>
            <h3 className={cn('text-xs font-semibold uppercase tracking-wider', tk.tintaFraca)}>Endereços activos deste documento</h3>
            {linksQ.isLoading ? (
              <Skeleton className="mt-2 h-14 w-full rounded-xl" />
            ) : activos.length === 0 ? (
              <p className={cn('mt-1 text-sm', tk.tintaFraca)}>Nenhum. Nada deste documento está aberto a quem não tem conta.</p>
            ) : (
              <ul className={cn('mt-2 divide-y rounded-xl border', tk.divisoria, tk.borda)}>
                {activos.map(l => (
                  <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className={cn('block text-sm', tk.tinta)}>
                        Válido até <span className={tk.mono}>{fmtData(l.expira_em)}</span>
                      </span>
                      <span className={cn('block text-xs', tk.tintaFraca)}>
                        {`criado por ${pessoaDeEmail(l.criado_por) || 'alguém'} em ${fmtData(l.criado_em)}`}
                        {l.max_downloads ? ` · ${l.downloads_count || 0} de ${l.max_downloads} descargas` : ` · ${l.downloads_count || 0} descargas`}
                      </span>
                    </span>
                    {enderecoDe(l) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          if (await copyToClipboard(enderecoDe(l))) { setCopiadoId(l.id); setTimeout(() => setCopiadoId(''), 2000); }
                          else setErro('Não foi possível copiar. Abra Gestão › Links para copiar o endereço à mão.');
                        }}
                      >
                        {copiadoId === l.id ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                        {copiadoId === l.id ? 'Copiado' : 'Copiar'}
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className={tk.perigo} onClick={() => setAAnular(l)}>Anular</Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {erro && (
            <p role="alert" className={cn('flex items-start gap-2 text-sm', tk.perigo)}>
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{erro}
            </p>
          )}

          {criado?.url ? (
            <div className={cn('rounded-xl border p-4', tk.borda, tk.bomFundo)}>
              <p className={cn('flex items-center gap-2 text-sm font-semibold', tk.bom)}>
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />Endereço criado
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Input value={criado.url} readOnly aria-label="Endereço partilhável" className={cn('min-w-[12rem] flex-1 text-xs', tk.mono)} onFocus={e => e.target.select()} />
                <Button variant="outline" onClick={copiar} className="min-h-[2.75rem]">
                  {copiado ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                  {copiado ? 'Copiado' : 'Copiar'}
                </Button>
              </div>
              <p className={cn('mt-3 text-sm', tk.tintaMedia)}>
                Quem tiver este endereço abre o documento até <strong className={tk.tinta}>{fmtData(criado.expira_em)}</strong>, sem precisar de conta nem de senha do portal.
                {criado.max_downloads ? ` Fecha-se sozinho depois de ${criado.max_downloads} descargas.` : ''}
                {' '}Depois dessa data deixa de funcionar e ninguém mais entra por ele.
              </p>
              {criado.tem_password && (
                <p className={cn('mt-2 flex items-start gap-2 text-sm', tk.aviso)}>
                  <KeyRound className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  Envie a senha por outro canal — uma chamada, uma mensagem. Senha e endereço no mesmo email valem o mesmo que não ter senha.
                </p>
              )}
              <Button variant="ghost" size="sm" className="mt-2" onClick={() => setCriado(null)}>Criar outro endereço</Button>
            </div>
          ) : (
            <form onSubmit={criar} className="space-y-4">
              <fieldset>
                <legend className={cn('text-sm font-medium', tk.tinta)}>Durante quantos dias?</legend>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {DIAS_PARTILHA.map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDias(d)}
                      aria-pressed={dias === d}
                      className={cn('inline-flex min-h-[2.75rem] items-center gap-1.5 rounded-full border px-4 text-sm', tk.foco,
                        dias === d ? cn(tk.acentoBorda, tk.acentoFundo, tk.acento, 'font-semibold') : cn(tk.borda, tk.tintaMedia, tk.hover))}
                    >
                      {d === 1 ? '1 dia' : `${d} dias`}{d === DIAS_SUGERIDO ? ' · sugerido' : ''}
                    </button>
                  ))}
                </div>
                <p className={cn('mt-1.5 text-sm', tk.tintaFraca)}>O máximo são 30 dias. Uma auditoria costuma resolver-se em 7.</p>
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="gd-senha-link">Senha (opcional)</Label>
                  <Input id="gd-senha-link" type="text" value={senha} onChange={e => setSenha(e.target.value)} autoComplete="off" placeholder="uma frase curta" className="mt-1" />
                  <p className={cn('mt-1 text-sm', tk.tintaFraca)}>Com senha, quem abrir o endereço tem de a escrever. Mande-a por outro canal.</p>
                </div>
                <div>
                  <Label htmlFor="gd-max-link">Limite de descargas (opcional)</Label>
                  <Input id="gd-max-link" type="number" min={1} max={1000} value={maxDescargas} onChange={e => setMaxDescargas(e.target.value)} placeholder="sem limite" className="mt-1" />
                  <p className={cn('mt-1 text-sm', tk.tintaFraca)}>Ao atingir o limite, o endereço fecha-se sozinho.</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" disabled={aCriar} className="min-h-[2.75rem]">
                  {aCriar ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Link2 className="h-4 w-4" aria-hidden="true" />}Criar o endereço
                </Button>
                <p className={cn('text-sm', tk.tintaFraca)}>Fica registado na auditoria quem o criou e quando.</p>
              </div>
            </form>
          )}
        </div>
      )}

      <AlertDialog open={!!aAnular} onOpenChange={o => { if (!o) setAAnular(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anular este endereço?</AlertDialogTitle>
            <AlertDialogDescription>
              Quem o tiver deixa de conseguir abrir o documento a partir de agora, mesmo a meio de uma consulta.
              Não há como voltar atrás: para dar acesso outra vez, cria-se um endereço novo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {erro && (
            <p role="alert" className={cn('flex items-start gap-2 text-sm', tk.perigo)}>
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{erro}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={anulando}>Deixar como está</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); anular(); }} disabled={anulando}>
              {anulando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}Anular o endereço
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

// ── zona de risco, no fim da página ────────────────────────────────────────
function ZonaRisco({ doc }) {
  const recarregar = useRecarregarDocs();
  const linksQ = useLinksPartilhaDocs();
  const [aberto, setAberto] = useState(false);
  const [aAnular, setAAnular] = useState(false);
  const [erro, setErro] = useState('');
  const activos = useMemo(() => (linksQ.data || []).filter(l => l.documento_id === doc?.id && linkActivo(l)), [linksQ.data, doc?.id]);
  if (!activos.length) return null;

  const anularTodos = async () => {
    setAAnular(true); setErro('');
    try {
      for (const l of activos) {
        const { data, error } = await supabase.functions.invoke('share-link-revoke', { body: { link_id: l.id } });
        if (error) throw new Error(error.message || 'Não foi possível anular.');
        if (data?.error) throw new Error(data.error);
      }
      recarregar('links');
      setAberto(false);
    } catch (e) {
      setErro(e?.message || 'Não foi possível anular todos os endereços.');
    } finally { setAAnular(false); }
  };

  return (
    <section aria-label="Acções com consequências" className={cn('mt-16 border-t pt-8', tk.borda)}>
      <h2 className={cn('text-sm font-semibold uppercase tracking-wider', tk.perigo)}>Fechar o acesso externo</h2>
      <p className={cn('mt-2 max-w-2xl text-sm', tk.tintaFraca)}>
        Este documento tem {activos.length === 1 ? '1 endereço activo' : `${activos.length} endereços activos`} para pessoas de fora.
        Anular todos corta o acesso imediatamente, mesmo a quem esteja a consultá-lo neste momento. Não se desfaz.
      </p>
      {erro && <p role="alert" className={cn('mt-2 text-sm', tk.perigo)}>{erro}</p>}
      <Button variant="outline" className={cn('mt-4 min-h-[2.75rem]', tk.perigo, tk.perigoBorda)} onClick={() => setAberto(true)}>
        <ShieldAlert className="h-4 w-4" aria-hidden="true" />Anular todos os endereços
      </Button>

      <AlertDialog open={aberto} onOpenChange={setAberto}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anular {activos.length === 1 ? 'o endereço activo' : `os ${activos.length} endereços activos`}?</AlertDialogTitle>
            <AlertDialogDescription>
              Ninguém de fora volta a abrir este documento por endereço partilhável. Quem estiver a consultá-lo perde
              o acesso. Para dar acesso outra vez, cria-se um endereço novo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {erro && (
            <p role="alert" className={cn('flex items-start gap-2 text-sm', tk.perigo)}>
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{erro}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={aAnular}>Deixar como está</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); anularTodos(); }} disabled={aAnular}>
              {aAnular ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}Anular todos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

export default function PortalDocumento() {
  const { id } = useParams();
  const [sp, setSp] = useSearchParams();
  const { user } = useAuth();
  const gestor = ehGestorDocs(user);
  const editor = ehEditorDocs(user);
  const recarregar = useRecarregarDocs();
  // separador no endereço; quem não faz gestão não tem os separadores de prova e cai nas versões
  const abaPedida = sp.get('prova') || 'versoes';
  const aba = (gestor ? [...PROVAS_TODOS, ...PROVAS_GESTAO] : PROVAS_TODOS).includes(abaPedida) ? abaPedida : 'versoes';
  const partilhaAberta = sp.get('partilhar') === '1';
  // «Pedir aprovação»: abre o formulário do fluxo (elaborador → revisor → director) para a revisão em rascunho.
  const aprovacaoAberta = sp.get('aprovar') === '1';
  const navigate = useNavigate();
  // A pesquisa por conteúdo manda cá a página onde encontrou o termo (e o termo). Era o remate que faltava: até
  // aqui estes parâmetros chegavam ao endereço e ninguém os lia — a ficha abria sempre na primeira página e a
  // pessoa tinha de ir procurar à mão a página que o servidor já lhe tinha dito.
  const paginaPedida = Number.parseInt(sp.get('pagina') || '', 10) || null;
  const termoPedido = sp.get('termo') || '';

  const docQ = useDocumentoDocs(id);
  const reserva = useReservaDocumento(editor ? id : null).data;
  // «Rever com o editor» só para documentos redigidos no editor estruturado (tabela da migração 182)
  const estruturadoQ = useQuery({
    queryKey: ['docs-rascunho-estruturado-doc', id],
    queryFn: () => rascunhoDoDocumento(id).catch(() => null),
    enabled: !!id && editor,
    staleTime: 60_000,
  });
  const versoesQ = useVersoesDocumento(id);
  const aeroQ = useAeroportosDocs();
  const tiposQ = useTiposDocumento();
  const classesQ = useClassesDocs();
  const processosQ = useProcessosDocs();
  const pastasQ = usePastasDocs();
  const minhasQ = useMinhasLeituras(user?.email);
  const leiturasQ = useLeiturasDocumento(gestor ? id : null);
  const emendasQ = useRegistoEmendas({ documentoId: id });

  const doc = docQ.data || null;
  const versoes = versoesQ.data || [];
  const mapaAero = useMemo(() => mapaPorId(aeroQ.data), [aeroQ.data]);
  const mapaTipos = useMemo(() => mapaPorId(tiposQ.data), [tiposQ.data]);
  const mapaPastas = useMemo(() => mapaPorId(pastasQ.data), [pastasQ.data]);
  // Codificação: código → registo. Um código sem nome mostra-se pelo código, nunca em branco.
  const mapaClasses = useMemo(() => new Map((classesQ.data || []).map(c => [c.codigo, c])), [classesQ.data]);
  const mapaProcessos = useMemo(() => new Map((processosQ.data || []).map(p => [p.codigo, p])), [processosQ.data]);

  const actualizar = (patch, { replace = false } = {}) => {
    const p = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) { if (v) p.set(k, v); else p.delete(k); }
    setSp(p, { replace });
  };

  // ── senha adicional ───────────────────────────────────────────────────────
  const [senha, setSenha] = useState('');
  const [autorizado, setAutorizado] = useState(false);
  const [aValidar, setAValidar] = useState(false);
  const [erroSenha, setErroSenha] = useState('');
  const trancado = !!doc?.requer_senha_adicional && !autorizado;

  const submeterSenha = async (e) => {
    e.preventDefault();
    if (!senha) return;
    setAValidar(true); setErroSenha('');
    try {
      const r = await validarSenhaDocs('documento', id, senha);
      const ok = r?.ok === true || r?.valido === true || r?.autorizado === true;
      if (ok) { setAutorizado(true); setSenha(''); }
      else setErroSenha(r?.error || r?.message || 'Senha incorrecta.');
    } catch (err) {
      setErroSenha(err?.message || 'Não foi possível validar a senha.');
    } finally { setAValidar(false); }
  };

  // ── registo de acesso (uma vez por abertura) ──────────────────────────────
  const registado = useRef(null);
  useEffect(() => {
    if (!id || registado.current === id) return;
    registado.current = id;
    registrarAcessoDocumento({ documento_id: id, tipo_acesso: 'visualizacao' }).catch(() => { /* o registo nunca trava a consulta */ });
  }, [id]);

  // ── ficheiro (URL assinada de curta duração) ──────────────────────────────
  const [url, setUrl] = useState('');
  const [erroUrl, setErroUrl] = useState('');
  const [aCarregarUrl, setACarregarUrl] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [senhaModal, setSenhaModal] = useState(null); // { senha } do PDF AVSEC protegido acabado de gerar
  const [aProteger, setAProteger] = useState(false);
  const [copiada, setCopiada] = useState(false);
  useEffect(() => {
    let vivo = true;
    if (!id || !doc || trancado) { setUrl(''); return undefined; }
    if (!doc.arquivo_privado_uri && !doc.arquivo_url) { setUrl(''); return undefined; }
    setACarregarUrl(true); setErroUrl('');
    obterUrlAssinadaDocumento({ documento_id: id })
      .then(r => { if (vivo) setUrl(r?.url || ''); })
      .catch(err => { if (vivo) setErroUrl(err?.message || 'Não foi possível abrir o ficheiro.'); })
      .finally(() => { if (vivo) setACarregarUrl(false); });
    return () => { vivo = false; };
  }, [id, doc, trancado, tentativa]);

  const vActual = String(versaoDoc(doc));
  const versaoActual = versoes.find(v => String(v.versao) === vActual) || versoes[0] || null;
  const nomeFicheiro = versaoActual?.arquivo_nome || doc?.arquivo_privado_uri || doc?.arquivo_url || '';
  const ext = extensaoDe(nomeFicheiro);
  const ehPdf = ext === 'pdf' || String(versaoActual?.mime || '').includes('pdf');
  const ehImagem = IMAGENS.includes(ext) || String(versaoActual?.mime || '').startsWith('image/');
  const semDescarga = !!doc?.bloquear_download;
  // documento de segurança da aviação → a descarga sai com tarja + senha gerada (need-to-know)
  const setorCodigo = doc?.processo_codigo ? mapaProcessos.get(doc.processo_codigo)?.setor_codigo : null;
  const avsecRestrito = ehAvsecRestrito(doc, { setorCodigo });

  const baixarBytes = (bytes, nome, mime = 'application/pdf') => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([bytes], { type: mime }));
    a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };

  const descarregar = async () => {
    if (!url) return;
    try { await registrarAcessoDocumento({ documento_id: id, tipo_acesso: 'download' }); } catch { /* idem */ }
    const a = document.createElement('a');
    a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    // Nome padronizado e limpo (Código — Título.ext), não o nome cru do ficheiro carregado.
    a.download = nomeFicheiroDoc({ ...doc, arquivo_nome: nomeFicheiro });
    document.body.appendChild(a); a.click(); a.remove();
  };

  // PDF AVSEC protegido: carimba a tarja, gera senha, encripta, descarrega e mostra a senha (uma vez).
  const descarregarProtegido = async () => {
    if (!url || aProteger) return;
    setAProteger(true);
    try {
      const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
      const rodape = `${doc.numero || ''} · ${user?.email || ''} · ${new Date().toLocaleString('pt-PT')}`;
      const { bytes: protegido, senha } = await protegerPdfAvsec(bytes, { rodape });
      baixarBytes(protegido, nomeFicheiroDoc({ ...doc, arquivo_nome: nomeFicheiro }));
      try { await registrarAcessoDocumento({ documento_id: id, tipo_acesso: 'download' }); } catch { /* idem */ }
      try { const h = await hashCurtoSenha(senha); await auditarDocs(user, { acao: 'avsec_pdf_protegido', entidade: 'documento', id, detalhes: `PDF AVSEC protegido gerado (${doc.numero || ''}) · hash curto da senha: ${h}` }); } catch { /* o log não trava a entrega */ }
      setCopiada(false); setSenhaModal({ senha });
    } catch (e) {
      setErroUrl(e?.message || 'Não foi possível gerar o PDF protegido.');
    } finally { setAProteger(false); }
  };

  // ── «li e tomei conhecimento» ─────────────────────────────────────────────
  const minhas = useMemo(() => (minhasQ.data || []).filter(l => l.documento_id === id), [minhasQ.data, id]);
  const confirmacaoActual = minhas.find(l => String(l.versao ?? '') === vActual) || (minhas.length && !minhas.some(l => l.versao) ? minhas[0] : null);
  const confirmacaoAntiga = !confirmacaoActual && minhas.length ? minhas.slice().sort((a, b) => String(b.lido_em).localeCompare(String(a.lido_em)))[0] : null;
  const [aConfirmar, setAConfirmar] = useState(false);
  const [erroConfirmar, setErroConfirmar] = useState('');
  const confirmar = async () => {
    if (!user?.email) return;
    setAConfirmar(true); setErroConfirmar('');
    try {
      await confirmarLeitura(id, user.email, vActual);
      recarregar('leituras'); recarregar('leituras-doc');
      await minhasQ.refetch?.();
    } catch (err) {
      setErroConfirmar(err?.message || 'Não foi possível registar a confirmação. Tente novamente.');
    } finally { setAConfirmar(false); }
  };

  // ── caminho até à pasta (migalhas) ────────────────────────────────────────
  const caminho = useMemo(() => {
    const lista = []; const visto = new Set();
    let p = doc?.pasta_id ? mapaPastas.get(doc.pasta_id) : null;
    while (p && !visto.has(p.id)) { visto.add(p.id); lista.unshift(p); p = p.pasta_pai_id ? mapaPastas.get(p.pasta_pai_id) : null; }
    return lista;
  }, [doc?.pasta_id, mapaPastas]);

  if (docQ.isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-6 w-48" />
        <div className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-9 w-2/3" /><Skeleton className="h-6 w-80" /></div>
        <Skeleton className="h-12 w-full max-w-xl rounded-xl" />
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-6">
          <Skeleton className="h-[60vh] w-full rounded-2xl" />
          <Skeleton className="mt-5 h-72 w-full rounded-2xl lg:mt-0" />
        </div>
      </div>
    );
  }
  if (docQ.isError) {
    return (
      <div className={cartao}>
        <Falha
          titulo="Não foi possível abrir o documento"
          texto="O servidor não devolveu a ficha. Pode ser a rede, ou o documento já não estar disponível para a sua conta. Tente de novo."
          onTentar={() => docQ.refetch?.()}
        />
      </div>
    );
  }
  if (!doc) {
    return (
      <div className={cartao}>
        <Vazio icone={FileText} titulo="Documento não encontrado" texto="Pode ter sido removido, substituído por uma versão nova, ou não está entre os documentos a que tem acesso.">
          <Button asChild variant="outline"><Link to={`${PORTAL_BASE}/biblioteca`}><Library className="h-4 w-4" aria-hidden="true" />Voltar à Biblioteca</Link></Button>
        </Vazio>
      </div>
    );
  }

  const validade = estadoValidade(doc);
  const tipo = rotuloTipo(mapaTipos, doc.tipo_id);
  const ligacaoPasta = urlBiblioteca(doc.aeroporto_id || 'geral', doc.pasta_id || '');
  const rotuloVersao = String(versaoActual?.rotulo || '').trim();
  const cartucho = [
    `v${vActual}`,
    rotuloVersao && rotuloVersao.length <= 24 && rotuloVersao.toLowerCase() !== `v${vActual}`.toLowerCase() ? rotuloVersao : '',
    emVigorDesde(doc) ? `Em vigor desde ${fmtData(emVigorDesde(doc))}` : 'Sem data de entrada em vigor',
  ].filter(Boolean).join(' · ');

  // A ficha mostra sempre o ficheiro da versão em uso. A faixa aparece quando essa versão já não é a que manda.
  // Só contam versões aprovadas ou em vigor: um rascunho mais adiantado não substitui nada e não deve alarmar.
  // E a FONTE EDITÁVEL (o .docx de origem do PDF em vigor) NÃO é uma revisão mais nova — é o mesmo documento noutro
  // formato — por isso fica fora da sequência de versões e nunca dispara o aviso «versão substituída».
  const versaoMaisRecente = versoes
    .filter(v => !ehVersaoFonte(v) && (!v.estado || v.estado === 'aprovado' || v.estado === 'em_vigor'))
    .reduce((max, v) => (Number(v.versao) > Number(max?.versao ?? -Infinity) ? v : max), null);
  const temVersaoNova = !!versaoMaisRecente && Number(versaoMaisRecente.versao) > Number(vActual);
  const substituido = doc.estado === 'obsoleto' || temVersaoNova;

  // ── quem pode ficar com uma cópia no dispositivo ──────────────────────────
  // Três recusas, e cada uma tem de ser dita por palavras — um botão desactivado sem explicação é uma porta sem
  // placa. Só leitura: a cópia é precisamente o que o «bloquear download» impede. Secreto: não sai do servidor
  // para disco de ninguém. Substituído: guardar uma versão que já não manda é fabricar de propósito a cópia
  // velha que esta funcionalidade existe para evitar.
  const podeOffline = !semDescarga && doc.nivel_confidencialidade !== 'secreto' && !substituido;
  const razaoSemOffline = semDescarga
    ? 'Este documento está marcado como só leitura: o ficheiro não fica guardado no dispositivo.'
    : doc.nivel_confidencialidade === 'secreto'
      ? 'Documentos classificados como secretos não ficam guardados em dispositivos.'
      : substituido
        ? 'Só se guardam documentos em vigor. Esta versão foi substituída — guardá-la era criar de propósito a cópia velha.'
        : '';

  return (
    <div className="space-y-5">
      {substituido && (
        <FaixaSubstituido
          titulo="Está a ver uma versão substituída"
          texto={temVersaoNova
            ? `Esta ficha mostra a versão ${vActual}. Já existe a versão ${versaoMaisRecente.versao} registada: não use este ficheiro para operar sem confirmar com a gestão documental qual é a que está em vigor.`
            : 'Este documento está marcado como obsoleto: foi retirado ou substituído. Não o use para operar nem o distribua; procure na Biblioteca o que está em vigor.'}
          acao={<Button asChild size="sm" variant="outline" className="mt-2"><Link to={ligacaoPasta}><Library className="h-4 w-4" aria-hidden="true" />Ver o que está em vigor nesta pasta</Link></Button>}
        />
      )}

      {/* migalhas + voltar */}
      <div className="flex flex-wrap items-center gap-2">
        <nav aria-label="Caminho de navegação" className="min-w-0 flex-1">
          <ol className={cn('flex flex-wrap items-center gap-x-1 gap-y-1 text-sm', tk.tintaFraca)}>
            <li><Link to={`${PORTAL_BASE}/biblioteca`} className={cn('inline-flex min-h-[2.25rem] items-center gap-1.5 font-medium hover:underline', tk.acento, tk.foco)}><Library className="h-4 w-4" aria-hidden="true" />Biblioteca</Link></li>
            {doc.aeroporto_id && <li className="flex items-center gap-1"><span aria-hidden="true">/</span><Link to={urlBiblioteca(doc.aeroporto_id, '')} className={cn('font-medium hover:underline', tk.acento, tk.foco)}>{mapaAero.get(doc.aeroporto_id)?.codigo_icao || 'Aeroporto'}</Link></li>}
            {caminho.map(p => (
              <li key={p.id} className="flex min-w-0 items-center gap-1"><span aria-hidden="true">/</span><Link to={urlBiblioteca(doc.aeroporto_id || 'geral', p.id)} className={cn('min-w-0 truncate font-medium hover:underline', tk.acento, tk.foco)}>{p.nome}</Link></li>
            ))}
          </ol>
        </nav>
        <Button asChild variant="ghost" size="sm"><Link to={ligacaoPasta}><ArrowLeft className="h-4 w-4" aria-hidden="true" />Voltar à pasta</Link></Button>
      </div>

      {/* ── identidade e validade ─────────────────────────────────────── */}
      <header>
        <p className={cn('text-sm', tk.mono, tk.tintaFraca)}>{doc.numero || 'sem número atribuído'}</p>
        <h1 className={cn('mt-1 text-2xl font-bold leading-tight tracking-tight md:text-3xl', tk.tinta)}>{doc.titulo}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <EstadoChip estado={doc.estado} />
          <span className={cn('text-sm', tk.mono, tk.tintaMedia)}>{cartucho}</span>
          <ValidadeChip documento={doc} sempre />
          {doc.nivel_confidencialidade && doc.nivel_confidencialidade !== 'interno' && (
            <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium', tk.perigoBorda, tk.perigoFundo, tk.perigo)}>
              <ShieldCheck className="h-3 w-3" aria-hidden="true" />{CONFIDENCIALIDADE[doc.nivel_confidencialidade]}
            </span>
          )}
          {semDescarga && (
            <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium', tk.borda, tk.tintaMedia)}>
              <Lock className="h-3 w-3" aria-hidden="true" />Só leitura
            </span>
          )}
        </div>
        {doc.descricao && <p className={cn('mt-3 max-w-3xl text-sm', tk.tintaMedia)}>{doc.descricao}</p>}
        <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
          <Campo rotulo="Aeroporto"><span className="inline-flex items-center gap-1.5"><Building2 className={cn('h-3.5 w-3.5', tk.tintaTenue)} aria-hidden="true" />{nomeAero(mapaAero, doc.aeroporto_id)}</span></Campo>
          <Campo rotulo="Tipo">{tipo || doc.categoria || '—'}</Campo>
          {/* As duas dimensões escondidas no número (migração 157). O manual é ligação, não só texto: quem está a
              ler um apêndice quer ver o resto do manual, e é esse o salto que a numeração sempre prometeu. */}
          <Campo rotulo="Classe">{doc.classe_codigo ? nomeClasse(mapaClasses, doc.classe_codigo) : '—'}</Campo>
          <Campo rotulo="Manual ou programa">
            {doc.processo_codigo
              ? (
                <Link
                  to={urlBiblioteca(doc.aeroporto_id || 'geral', '', { manual: doc.processo_codigo })}
                  className={cn('hover:underline', tk.acento)}
                  title={`Ver os outros documentos de ${nomeProcesso(mapaProcessos, doc.processo_codigo)}`}
                >
                  {nomeProcesso(mapaProcessos, doc.processo_codigo)}
                </Link>
              )
              : '—'}
          </Campo>
          <Campo rotulo="Emissor">{doc.entidade_emissora || '—'}</Campo>
          <Campo rotulo="Responsável">{doc.responsavel_email ? <a href={`mailto:${doc.responsavel_email}`} className={cn('hover:underline', tk.acento)}>{pessoaDeEmail(doc.responsavel_email)}</a> : '—'}</Campo>
          <Campo rotulo="Validade">{doc.expira_em || doc.data_expiracao ? `${fmtData(doc.expira_em || doc.data_expiracao)}${validade.dias !== undefined && validade.dias !== null ? ` · ${validade.label.toLowerCase()}` : ''}` : 'Sem validade'}</Campo>
          <Campo rotulo="Publicado">{fmtData(doc.publicacao_em || doc.data_publicacao || doc.em_vigor_desde)}</Campo>
          <Campo rotulo="Última alteração">{fmtDataHora(doc.updated_date)}</Campo>
          <Campo rotulo="Carregado por">{doc.created_by || '—'}</Campo>
        </dl>
        {Array.isArray(doc.tags) && doc.tags.length > 0 && (
          <p className="mt-3 flex flex-wrap items-center gap-1.5">
            <Tag className={cn('h-3.5 w-3.5', tk.tintaTenue)} aria-hidden="true" />
            {doc.tags.map(tg => <span key={tg} className={cn('rounded-full border px-2 py-0.5 text-xs', tk.borda, tk.tintaMedia)}>{tg}</span>)}
          </p>
        )}
      </header>

      {/* ── acções normais ────────────────────────────────────────────── */}
      <div className={cn('flex flex-wrap items-center gap-2 border-y py-3', tk.borda)}>
        {confirmacaoActual ? (
          <span className={cn('inline-flex min-h-[2.75rem] items-center gap-2 rounded-xl border px-3 text-sm', tk.borda, tk.bomFundo, tk.bom)}>
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Leitura confirmada em {fmtDataHora(confirmacaoActual.lido_em)}{confirmacaoActual.versao ? ` · v${confirmacaoActual.versao}` : ''}</span>
          </span>
        ) : (
          <Button className="min-h-[2.75rem]" onClick={confirmar} disabled={aConfirmar || !user?.email || trancado}>
            {aConfirmar ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}Li e tomei conhecimento
          </Button>
        )}
        {!trancado && url && (
          <Button variant="outline" asChild className="min-h-[2.75rem]">
            <a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" aria-hidden="true" />Abrir noutro separador</a>
          </Button>
        )}
        {!trancado && url && !semDescarga && (
          avsecRestrito && ehPdf
            ? <Button variant="outline" className="min-h-[2.75rem]" onClick={descarregarProtegido} disabled={aProteger}>{aProteger ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Lock className="h-4 w-4" aria-hidden="true" />}PDF Protegido</Button>
            : <Button variant="outline" className="min-h-[2.75rem]" onClick={descarregar}><Download className="h-4 w-4" aria-hidden="true" />Descarregar</Button>
        )}
        {gestor && (
          <Button
            variant="outline"
            className="min-h-[2.75rem]"
            aria-expanded={partilhaAberta}
            aria-controls="gd-partilha"
            onClick={() => actualizar({ partilhar: partilhaAberta ? '' : '1' })}
          >
            <Link2 className="h-4 w-4" aria-hidden="true" />Partilhar com externo
          </Button>
        )}
        {gestor && (
          <Button
            variant="outline"
            className="min-h-[2.75rem]"
            aria-expanded={aprovacaoAberta}
            aria-controls="gd-aprovacao"
            onClick={() => actualizar({ aprovar: aprovacaoAberta ? '' : '1' })}
          >
            <Stamp className="h-4 w-4" aria-hidden="true" />Pedir aprovação
          </Button>
        )}
        <Button asChild variant="ghost" className="min-h-[2.75rem]"><Link to={`${PORTAL_BASE}/leituras`}>As minhas leituras</Link></Button>
      </div>

      {erroConfirmar && (
        <p role="alert" className={cn('flex items-start gap-2 text-sm', tk.perigo)}>
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{erroConfirmar}
        </p>
      )}
      {confirmacaoAntiga && !confirmacaoActual && (
        <p className={cn('flex items-start gap-2 rounded-xl border p-3 text-sm', tk.avisoBorda, tk.avisoFundo, tk.tintaMedia)}>
          <AlertTriangle className={cn('mt-0.5 h-4 w-4 shrink-0', tk.aviso)} aria-hidden="true" />
          Confirmou a versão {confirmacaoAntiga.versao || '—'} em {fmtData(confirmacaoAntiga.lido_em)}. Entretanto saiu a versão {vActual}: confirme outra vez depois de a ler.
        </p>
      )}

      <ReservaDocumento doc={doc} user={user} gestor={gestor} editor={editor} onPedirAprovacao={() => actualizar({ aprovar: '1' })} />
      {editor && (
        <div className="flex flex-wrap gap-2">
          <BotaoEditarNavegador documentoId={doc.id} versoes={versoes} titulo={doc.titulo} reservadoPorMim={reservaActiva(reserva) && reservadaPorMim(reserva, user?.email)} onFechado={recarregar} />
          {estruturadoQ.data && (
            <Button asChild size="sm" variant="outline"><Link to={`${PORTAL_BASE}/gestao/redigir/documento/${doc.id}`}>Rever com o editor</Link></Button>
          )}
        </div>
      )}

      {gestor && partilhaAberta && <PartilhaExterna doc={doc} aoFechar={() => actualizar({ partilhar: '' })} />}
      {gestor && aprovacaoAberta && (
        <section id="gd-aprovacao" className={cn(cartao, 'p-5')} aria-label="Pedir aprovação">
          <IniciarFluxo documento={doc} onFechar={() => actualizar({ aprovar: '' })} onCriado={(fluxoId) => navigate(`${PORTAL_BASE}/aprovacao/${fluxoId}`)} />
        </section>
      )}

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-6">
        {/* ── o ficheiro, ao centro ───────────────────────────────────── */}
        <section className={cn(cartao, 'overflow-hidden')} aria-label="Ficheiro">
          {trancado ? (
            <form onSubmit={submeterSenha} className="mx-auto max-w-sm space-y-3 px-5 py-10 text-center">
              <KeyRound className={cn('mx-auto h-9 w-9', tk.aviso)} aria-hidden="true" />
              <p className={cn('font-medium', tk.tinta)}>Este documento pede uma senha</p>
              <p className={cn('text-sm', tk.tintaFraca)}>A senha é verificada no servidor. Se não a tem, peça-a ao responsável do documento.</p>
              <div className="space-y-1.5 text-left">
                <Label htmlFor="doc-senha">Senha do documento</Label>
                <Input id="doc-senha" type="password" value={senha} onChange={e => setSenha(e.target.value)} autoComplete="off" required />
              </div>
              {erroSenha && <p role="alert" className={cn('flex items-start gap-2 text-left text-sm', tk.perigo)}><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{erroSenha}</p>}
              <Button type="submit" className="min-h-[2.75rem] w-full" disabled={aValidar || !senha}>{aValidar ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <KeyRound className="h-4 w-4" aria-hidden="true" />}Abrir documento</Button>
            </form>
          ) : ehPdf ? (
            // O leitor trata dos seus próprios estados (a preparar, falhou, sem ficheiro) porque também sabe uma
            // coisa que a ficha não sabe: se existe uma cópia guardada neste dispositivo para usar quando a rede
            // não responde.
            <LeitorPdf
              documentoId={id}
              doc={doc}
              url={url}
              erroUrl={erroUrl}
              aCarregarUrl={aCarregarUrl}
              onRetentar={() => setTentativa(n => n + 1)}
              descarregar={semDescarga ? null : (avsecRestrito && ehPdf ? descarregarProtegido : descarregar)}
              paginaPedida={paginaPedida}
              termoPedido={termoPedido}
              onPagina={(n) => actualizar({ pagina: n > 1 ? String(n) : '' }, { replace: true })}
              semDescarga={semDescarga}
              permiteOffline={podeOffline}
              razaoSemOffline={razaoSemOffline}
            />
          ) : erroUrl ? (
            <Falha titulo="Não foi possível abrir o ficheiro" texto={erroUrl} onTentar={() => setTentativa(n => n + 1)} />
          ) : aCarregarUrl ? (
            <div className="p-4"><Skeleton className="h-[60vh] w-full rounded-xl" /></div>
          ) : !url ? (
            <Vazio icone={FileText} titulo="Este documento ainda não tem ficheiro" texto="O registo existe, mas o ficheiro não foi carregado ou já não está disponível. Fale com a gestão documental." />
          ) : ehImagem ? (
            <div className={cn('max-h-[72vh] overflow-auto p-4', tk.superficieBaixa)}><img src={url} alt={doc.titulo} className="mx-auto max-w-full" /></div>
          ) : (
            <Vazio
              icone={FileText}
              titulo={`Sem pré-visualização para ${ext ? ext.toUpperCase() : 'este tipo de ficheiro'}`}
              texto={semDescarga
                ? 'Este documento está marcado como só leitura e o formato não abre no navegador. Peça à gestão documental uma versão em PDF.'
                : 'Ficheiros do Word, Excel e PowerPoint não abrem no navegador. Descarregue para os ver no Office.'}
            >
              {!semDescarga && (avsecRestrito && ehPdf
                ? <Button onClick={descarregarProtegido} disabled={aProteger}>{aProteger ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Lock className="h-4 w-4" aria-hidden="true" />}PDF Protegido</Button>
                : <Button onClick={descarregar}><Download className="h-4 w-4" aria-hidden="true" />Descarregar</Button>)}
            </Vazio>
          )}
        </section>

        {/* ── as provas, à direita ────────────────────────────────────── */}
        <aside className="mt-5 lg:mt-0 lg:sticky lg:top-[var(--topo-fixo,5rem)]">
          <Tabs value={aba} onValueChange={v => actualizar({ prova: v === 'versoes' ? '' : v }, { replace: true })}>
            <TabsList className="w-full justify-start">
              <TabsTrigger value="versoes">Versões{versoes.length ? ` (${versoes.length})` : ''}</TabsTrigger>
              <TabsTrigger value="emendas">Emendas{(emendasQ.data || []).length ? ` (${emendasQ.data.length})` : ''}</TabsTrigger>
              {gestor && <TabsTrigger value="leituras">Confirmações{(leiturasQ.data || []).length ? ` (${leiturasQ.data.length})` : ''}</TabsTrigger>}
              {gestor && <TabsTrigger value="acessos">Acessos</TabsTrigger>}
            </TabsList>

            <TabsContent value="versoes" className="mt-3">
              <Painel titulo="Histórico de versões" icone={History}>
                <BotaoCompararVersoes doc={doc} versoes={versoes} vActual={vActual} desactivado={trancado} />
                {versoesQ.isLoading ? (
                  <div className="space-y-2 p-4">{[0, 1].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
                ) : versoesQ.isError ? (
                  <Falha titulo="Não foi possível carregar as versões" texto="O histórico não chegou. Tente de novo." onTentar={() => versoesQ.refetch?.()} className="py-10" />
                ) : versoes.length === 0 ? (
                  <Vazio icone={History} titulo="Sem versões registadas" texto={`Este documento está na versão ${vActual}; as anteriores não foram registadas no portal.`} className="py-10" />
                ) : (
                  <ul className={cn('max-h-80 divide-y overflow-y-auto', tk.divisoria)}>
                    {versoes.map(v => {
                      const actual = String(v.versao) === vActual;
                      return (
                        <li key={`${v.versao}-${v.arquivo_uri || v.id || ''}`} className="flex flex-wrap items-start gap-x-3 gap-y-1 px-4 py-3">
                          <span className={cn('inline-flex h-7 min-w-[3rem] items-center justify-center rounded-md px-2 text-xs font-semibold', tk.mono,
                            actual ? cn(tk.acentoFundo, tk.acento) : cn(tk.superficieBaixa, tk.tintaMedia))}>v{v.versao}</span>
                          <span className="min-w-0 flex-1">
                            <span className={cn('block text-sm font-medium', tk.tinta)}>
                              {v.rotulo || v.arquivo_nome || `Versão ${v.versao}`}
                              {actual && <span className={cn('ml-2 text-xs font-normal', tk.acento)}>em uso</span>}
                            </span>
                            {v.nota && <span className={cn('mt-0.5 block text-xs', tk.tintaFraca)}>{v.nota}</span>}
                            <span className={cn('mt-0.5 flex flex-wrap gap-x-2.5 text-xs', tk.tintaTenue)}>
                              <span className={tk.mono}>{fmtData(v.aprovado_em || v.created_date)}</span>
                              {v.aprovado_por && <span>aprovada por {pessoaDeEmail(v.aprovado_por)}</span>}
                              {!v.aprovado_por && v.criado_por && <span>carregada por {pessoaDeEmail(v.criado_por)}</span>}
                              {tamanhoLegivel(v.tamanho) && <span>{tamanhoLegivel(v.tamanho)}</span>}
                            </span>
                          </span>
                          {v.estado && <EstadoChip estado={ehVersaoFonte(v) ? 'fonte' : v.estado} />}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Painel>
            </TabsContent>

            {/* ── registo de emendas: o formato do Anexo 3, e a confirmação de quem o tem de inserir ── */}
            <TabsContent value="emendas" className="mt-3">
              <RegistoEmendasDocumento documento={doc} documentoId={id} user={user} podeConfirmar={!!user?.email} />
            </TabsContent>

            {gestor && (
              <TabsContent value="leituras" className="mt-3">
                <Painel titulo="Quem já confirmou" icone={Users}>
                  {leiturasQ.isLoading ? (
                    <div className="space-y-2 p-4">{[0, 1, 2].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
                  ) : (leiturasQ.data || []).length === 0 ? (
                    <Vazio icone={Users} titulo="Ainda ninguém confirmou" texto="Quando alguém usar o botão «Li e tomei conhecimento», aparece aqui com a data e a versão." className="py-10" />
                  ) : (
                    <ul className={cn('max-h-80 divide-y overflow-y-auto', tk.divisoria)}>
                      {leiturasQ.data.map((l, i) => (
                        <li key={`${l.email}-${l.lido_em}-${i}`} className="flex items-center gap-3 px-4 py-2.5">
                          <span className="min-w-0 flex-1">
                            <span className={cn('block truncate text-sm', tk.tinta)}>{pessoaDeEmail(l.email)}</span>
                            <span className={cn('block truncate text-xs', tk.tintaFraca)}>{l.email}</span>
                          </span>
                          <span className={cn('shrink-0 text-right text-xs', tk.mono, tk.tintaFraca)}>
                            {fmtDataHora(l.lido_em)}{l.versao ? ` · v${l.versao}` : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Painel>
              </TabsContent>
            )}

            {gestor && (
              <TabsContent value="acessos" className="mt-3">
                <Painel titulo="Quem abriu e descarregou" icone={Eye}>
                  <Acessos documentoId={id} />
                </Painel>
              </TabsContent>
            )}
          </Tabs>
        </aside>
      </div>

      {/* ── o documento e o resto da casa: a formação que o ensina, a lei que ele cumpre ── */}
      <FormacaoDoDocumento documento={doc} podeLigar={gestor} />
      <RequisitosDoDocumento documento={doc} podeMexer={gestor} />

      {/* ── espaço deliberado, e só depois o que fecha portas ─────────── */}
      {gestor && <ZonaRisco doc={doc} />}

      {/* ── PDF AVSEC protegido: a senha mostra-se uma vez ───────────── */}
      <AlertDialog open={!!senhaModal} onOpenChange={o => { if (!o) { setSenhaModal(null); setCopiada(false); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><Lock className="h-5 w-5 text-blue-700" aria-hidden="true" />PDF protegido gerado</AlertDialogTitle>
            <AlertDialogDescription>
              Ficheiro <span className="font-medium">{nomeFicheiroDoc({ ...doc, arquivo_nome: nomeFicheiro })}</span> descarregado e protegido com a senha abaixo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-1 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-center dark:border-slate-700 dark:bg-slate-900/40">
            <span className="select-all font-mono text-lg font-bold tracking-[0.2em] text-slate-900 dark:text-slate-100">{senhaModal?.senha}</span>
          </div>
          <div className="flex justify-center">
            <Button variant="outline" size="sm" onClick={async () => { await copyToClipboard(senhaModal?.senha || ''); setCopiada(true); }}>
              {copiada ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}{copiada ? 'Copiada' : 'Copiar senha'}
            </Button>
          </div>
          <div className={cn('rounded-lg border p-3 text-sm', 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200')}>
            <p className="mb-1 font-semibold">Procedimento seguro de entrega</p>
            <ul className="list-disc space-y-0.5 pl-5">
              <li>Envie o ficheiro PDF pelo canal oficial.</li>
              <li>Envie a senha em <strong>canal separado</strong> (SMS, chamada, outra plataforma).</li>
              <li>Nunca envie a senha e o ficheiro no mesmo canal.</li>
            </ul>
          </div>
          <p className={cn('text-xs', tk.meta)}>
            A senha ficou registada no log de auditoria (só administradores) em <strong>hash curto</strong>. A senha em claro <strong>não é guardada</strong> — se fechar sem a anotar, tem de gerar o PDF outra vez.
          </p>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => { setSenhaModal(null); setCopiada(false); }}>Anotei — OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
