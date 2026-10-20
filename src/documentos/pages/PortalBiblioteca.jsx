// Biblioteca do Portal de Documentos — o coração da consulta: aeroporto → pastas → subpastas → documentos.
// A vista por omissão é uma TABELA DENSA: com duas centenas de documentos, uma linha diz de uma vez o que um
// cartão obriga a percorrer. A grelha continua a existir, mas como alternativa explícita.
// Cada linha mostra sempre o que a lei manda ver de relance: número, estado, versão e entrada em vigor, validade.
// Este ficheiro guarda também as peças reutilizadas pelas outras páginas do portal (símbolos de cor, selos de
// estado e validade, tabela, cartões, estados vazios/erro, realce do termo pesquisado e o painel lateral).
// O servidor é que decide o que cada pessoa vê (migrações 136a/136b/136c): aqui filtra-se só para o interface
// fazer sentido. Hoje cada pasta pertence a um único aeroporto, mas a página está escrita para vários.
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, ArrowUp, BookMarked, Building2, ChevronDown, ChevronLeft, ChevronRight, Download,
  Eye, ExternalLink, FileText, Folder, FolderOpen, FolderTree, Inbox, KeyRound, LayoutGrid, Library,
  Lock, RefreshCw, Rows3, Search, SlidersHorizontal, Table2, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { fmtData, fmtDataHora } from '@/lib/safeDate';
import {
  PORTAL_BASE, ESTADOS_DOCUMENTO, ESTADO_LABEL, ESTADO_COR, estadoValidade, diasParaExpirar,
} from '@/lib/portalDocumentos';
import { obterUrlAssinadaDocumento } from '@/functions/obterUrlAssinadaDocumento';
import { registrarAcessoDocumento } from '@/functions/registrarAcessoDocumento';
import { formatoFicheiroDoc } from '../nomeDocumento';
import { ESTRUTURAS, seccoesDoDocumento } from '../estruturaDossier';
import { useAeroportosDocs, useTiposDocumento, useArvorePastas, useDocumentosDocs } from '../hooks';
// A codificação (migração 157) chega por um pedido próprio e leve: a lista de documentos não traz as colunas
// `classe_codigo`/`processo_codigo` e não vale engordá-la para quem só quer percorrer pastas.
import { useDocumentosCodificados, useCodificacao } from '../hooksCodificacao';

// ── símbolos de cor ─────────────────────────────────────────────────────────
// Cada decisão de cor tem um nome e traz os dois modos consigo. As páginas usam os símbolos; nunca se escreve
// uma cor solta dentro de um bloco de tema, porque é assim que o modo escuro fica a meio.
export const tk = {
  superficie: 'bg-white dark:bg-slate-900',
  superficieBaixa: 'bg-slate-50 dark:bg-slate-900/60',
  borda: 'border-slate-200 dark:border-slate-800',
  divisoria: 'divide-slate-200 dark:divide-slate-800',
  tinta: 'text-slate-900 dark:text-slate-100',
  tintaMedia: 'text-slate-700 dark:text-slate-300',
  tintaFraca: 'text-slate-500 dark:text-slate-400',
  tintaTenue: 'text-slate-400 dark:text-slate-500',
  acento: 'text-teal-700 dark:text-teal-300',
  acentoFundo: 'bg-teal-50 dark:bg-teal-950/60',
  acentoBorda: 'border-teal-300 dark:border-teal-800',
  aviso: 'text-amber-700 dark:text-amber-300',
  avisoFundo: 'bg-amber-50 dark:bg-amber-950/50',
  avisoBorda: 'border-amber-200 dark:border-amber-900',
  avisoLinha: 'border-amber-500 dark:border-amber-600',   // hairline forte, só para a faixa de aviso
  perigo: 'text-red-700 dark:text-red-300',
  perigoFundo: 'bg-red-50 dark:bg-red-950/50',
  perigoBorda: 'border-red-200 dark:border-red-900',
  bom: 'text-emerald-700 dark:text-emerald-300',
  bomFundo: 'bg-emerald-50 dark:bg-emerald-950/50',
  foco: 'focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 dark:focus-visible:ring-teal-400',
  hover: 'hover:bg-slate-50 dark:hover:bg-slate-800/60',
  seleccionada: 'bg-teal-50 dark:bg-teal-950/40',
  mono: 'font-mono tabular-nums',
};

// ── peças partilhadas pelas páginas de consulta ─────────────────────────────
export const cartao = `rounded-2xl border ${tk.borda} ${tk.superficie}`;
export const urlDoc = (id) => `${PORTAL_BASE}/documento/${id}`;
// Selo do formato do ficheiro (PDF, DOCX, XLSX, PPTX, PNG…) — Biblioteca, Pesquisa, Emendas e Gestão.
const COR_FORMATO = {
  PDF: 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-400/20',
  DOCX: 'bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-400/20',
  DOC: 'bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-400/20',
  XLSX: 'bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-500/10 dark:text-green-300 dark:ring-green-400/20',
  XLS: 'bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-500/10 dark:text-green-300 dark:ring-green-400/20',
  CSV: 'bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-500/10 dark:text-green-300 dark:ring-green-400/20',
  PPTX: 'bg-orange-50 text-orange-700 ring-orange-600/20 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-400/20',
  PPT: 'bg-orange-50 text-orange-700 ring-orange-600/20 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-400/20',
  PNG: 'bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-400/20',
  JPG: 'bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-400/20',
};
export function SeloFormato({ doc }) {
  const f = formatoFicheiroDoc(doc);
  if (!f) return <span className="text-xs text-slate-400" title="Sem ficheiro">—</span>;
  return <span title={`Ficheiro ${f}`} className={cn('inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset', COR_FORMATO[f] || 'bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-700/40 dark:text-slate-300 dark:ring-slate-500/30')}>{f}</span>;
}

// Abre a ficha do documento; Ctrl/⌘ (ou Shift) + clique abre-a noutro separador, como num link normal.
export function abrirDocumento(navigate, id, e) {
  if (e && (e.ctrlKey || e.metaKey || e.shiftKey)) { window.open(urlDoc(id), '_blank', 'noopener'); return; }
  navigate(urlDoc(id));
}
// `extras` leva os filtros que a biblioteca lê do endereço (manual, classe, estado…): é assim que uma ficha pode
// mandar alguém para «os outros documentos deste manual» sem a biblioteca precisar de uma rota própria.
export const urlBiblioteca = (aeroporto, pasta, extras) => {
  const p = new URLSearchParams();
  if (aeroporto) p.set('aeroporto', aeroporto);
  if (pasta) p.set('pasta', pasta);
  for (const [k, v] of Object.entries(extras || {})) if (v) p.set(k, String(v));
  const q = p.toString();
  return `${PORTAL_BASE}/biblioteca${q ? `?${q}` : ''}`;
};

// ── tamanho do texto (escolhido em «A minha conta») ─────────────────────────
// Guardado neste navegador e aplicado no <html> sem depender de CSS do portal: a escala multiplica o tamanho
// base, que continua a acompanhar a largura do ecrã. Fica aqui porque é o módulo comum às páginas de consulta,
// e é aplicado ao carregar a primeira página do portal.
export const TAMANHOS_TEXTO_DOCS = [
  { value: 'pequeno', label: 'Pequeno', escala: 0.92 },
  { value: 'normal', label: 'Normal (acompanha o ecrã)', escala: 1 },
  { value: 'grande', label: 'Grande', escala: 1.12 },
];
const CHAVE_TEXTO = 'gd:texto';
export function preferenciaTextoDocs() {
  try {
    const v = localStorage.getItem(CHAVE_TEXTO);
    return TAMANHOS_TEXTO_DOCS.some(t => t.value === v) ? v : 'normal';
  } catch { return 'normal'; }
}
export function aplicarEscalaDocs(valor = preferenciaTextoDocs()) {
  if (typeof document === 'undefined') return;
  const t = TAMANHOS_TEXTO_DOCS.find(x => x.value === valor) || TAMANHOS_TEXTO_DOCS[1];
  document.documentElement.style.fontSize = t.escala === 1 ? '' : `calc(clamp(16px, 0.208vw + 13px, 18px) * ${t.escala})`;
}
export function guardarPreferenciaTextoDocs(valor) {
  try { localStorage.setItem(CHAVE_TEXTO, valor); } catch { /* navegador sem armazenamento */ }
  aplicarEscalaDocs(valor);
}
if (typeof document !== 'undefined') aplicarEscalaDocs();

// ── densidade das linhas (guardada por pessoa, neste navegador) ─────────────
// 48 px por omissão. Quem passa o dia na biblioteca aperta para 40; quem a usa em pista, com luvas, abre para 56.
export const DENSIDADES = [
  { value: 'compacta', label: 'Compacta', altura: 40, px: '40 px' },
  { value: 'normal', label: 'Normal', altura: 48, px: '48 px' },
  { value: 'folgada', label: 'Folgada', altura: 56, px: '56 px' },
];
const CHAVE_DENSIDADE = 'gd:densidade';
export function preferenciaDensidadeDocs() {
  try {
    const v = localStorage.getItem(CHAVE_DENSIDADE);
    return DENSIDADES.some(d => d.value === v) ? v : 'normal';
  } catch { return 'normal'; }
}
export function guardarPreferenciaDensidadeDocs(valor) {
  try { localStorage.setItem(CHAVE_DENSIDADE, valor); } catch { /* navegador sem armazenamento */ }
}
export const alturaDensidade = (valor) => (DENSIDADES.find(d => d.value === valor) || DENSIDADES[1]).altura;

// As cores claras vêm de ESTADO_COR/estadoValidade; aqui junta-se a variante escura, que a biblioteca não traz.
const ESCURO_ESTADO = {
  rascunho: 'dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
  em_revisao: 'dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200',
  aprovado: 'dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-200',
  em_vigor: 'dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200',
  obsoleto: 'dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400',
  fonte: 'dark:border-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-200',
};
const ESCURO_VALIDADE = {
  sem_validade: 'dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400',
  expirado: 'dark:border-red-900 dark:bg-red-950/50 dark:text-red-200',
  expira_30: 'dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200',
  expira_90: 'dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-200',
  valido: 'dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200',
};
const chip = 'inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium leading-5';

export function EstadoChip({ estado, className }) {
  const chave = estado || 'rascunho';
  return (
    <span className={cn(chip, 'whitespace-nowrap', ESTADO_COR[chave] || ESTADO_COR.rascunho, ESCURO_ESTADO[chave] || ESCURO_ESTADO.rascunho, className)}>
      {ESTADO_LABEL[chave] || chave}
    </span>
  );
}

// Validade com forma própria além da cor: diz quantos dias faltam, ou que já expirou, ou que não expira.
export function textoValidade(documento) {
  const dias = diasParaExpirar(documento);
  if (dias === null) return 'Sem validade';
  if (dias < 0) { const d = Math.abs(dias); return `Expirou há ${d} ${d === 1 ? 'dia' : 'dias'}`; }
  if (dias === 0) return 'Expira hoje';
  if (dias <= 90) return `Expira em ${dias} ${dias === 1 ? 'dia' : 'dias'}`;
  return `Válido até ${fmtData(documento?.expira_em || documento?.data_expiracao)}`;
}

// Por omissão não mostra nada quando o documento não tem validade (seria ruído nas listas); `sempre` força.
export function ValidadeChip({ documento, sempre = false, className }) {
  const v = estadoValidade(documento);
  if (v.chave === 'sem_validade' && !sempre) return null;
  return <span className={cn(chip, 'whitespace-nowrap', v.cor, ESCURO_VALIDADE[v.chave], className)}>{textoValidade(documento)}</span>;
}

// ── codificação (migração 157) ──────────────────────────────────────────────
// O número de um documento codifica duas coisas: a CLASSE (o prefixo — o que o documento é) e o PROCESSO (o
// terceiro segmento — de que manual ou programa faz parte). Nas listas mostra-se o processo, que é o que ajuda a
// situar o documento; a classe já se lê no prefixo do número e repeti-la seria ruído.
// Os documentos chegam com `processo_nome`/`classe_nome` colados pelo `useDocumentosCodificados`; sem eles, estas
// peças não desenham nada e a lista fica exactamente como estava.
export const textoProcesso = (doc) => (doc?.processo_codigo ? (doc.processo_nome || doc.processo_codigo) : '');
export const tituloProcesso = (doc) => (doc?.processo_codigo
  ? (doc.processo_nome ? `${doc.processo_codigo} — ${doc.processo_nome}` : `Manual ou programa ${doc.processo_codigo} (ainda sem nome na codificação)`)
  : '');
export const textoClasse = (doc) => (doc?.classe_codigo ? (doc.classe_nome || doc.classe_codigo) : '');
export const tituloClasse = (doc) => (doc?.classe_codigo
  ? (doc.classe_nome ? `${doc.classe_codigo} — ${doc.classe_nome}` : `Classe ${doc.classe_codigo}`)
  : '');

// Distintivo discreto: cinzento e sem ícone. Numa lista de duas centenas de linhas a cor está reservada ao estado
// e à validade — é isso que decide se o documento se pode usar hoje.
export function ProcessoChip({ doc, className }) {
  if (!doc?.processo_codigo) return null;
  return (
    <span
      title={tituloProcesso(doc)}
      className={cn(chip, 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300', className)}
    >
      <span className="truncate">{textoProcesso(doc)}</span>
    </span>
  );
}

export const mapaPorId = (lista) => new Map((Array.isArray(lista) ? lista : []).map(x => [x.id, x]));
export const rotuloTipo = (mapa, id) => (id && mapa?.get(id)?.nome) || '';
export const rotuloAero = (mapa, id) => {
  const a = id ? mapa?.get(id) : null;
  return a ? (a.codigo_icao || a.nome || '') : '';
};
export const nomeAero = (mapa, id) => {
  const a = id ? mapa?.get(id) : null;
  if (!a) return 'Documentos gerais';
  return a.codigo_icao ? `${a.codigo_icao} · ${a.nome}` : a.nome;
};
export const dataDoc = (doc) => doc?.publicacao_em || doc?.data_publicacao || doc?.em_vigor_desde || doc?.updated_date || doc?.created_date || null;
export const versaoDoc = (doc) => doc?.versao_atual || doc?.versao || '1';
export const emVigorDesde = (doc) => doc?.em_vigor_desde || doc?.publicacao_em || doc?.data_publicacao || null;
// Nome legível a partir do email do responsável (o portal não tem a tabela de pessoas à mão).
export const pessoaDeEmail = (email) => {
  const base = String(email || '').trim();
  if (!base) return '';
  const local = base.includes('@') ? base.split('@')[0] : base;
  return local.replace(/[._-]+/g, ' ').replace(/(^|\s)\S/g, c => c.toUpperCase());
};

// Realça o termo pesquisado no texto. Devolve um vector de pedaços (texto e <mark>), pronto para JSX.
export function realcar(texto, termo) {
  const t = String(texto ?? '');
  const q = String(termo || '').trim();
  if (q.length < 2) return t;
  const palavras = [...new Set(q.split(/\s+/).filter(p => p.length >= 2).map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))];
  if (!palavras.length) return t;
  const partes = t.split(new RegExp(`(${palavras.join('|')})`, 'gi'));
  return partes.map((p, i) => (i % 2 === 1
    ? <mark key={`m${i}`} className="rounded bg-amber-200 px-0.5 text-slate-900 dark:bg-amber-400/40 dark:text-amber-50">{p}</mark>
    : p));
}

export function Vazio({ icone: Icone = Inbox, titulo, texto, children, className }) {
  return (
    <div className={cn('flex flex-col items-center gap-3 px-6 py-14 text-center', className)}>
      <Icone className={cn('h-9 w-9', tk.tintaTenue)} aria-hidden="true" />
      <p className={cn('font-medium', tk.tinta)}>{titulo}</p>
      {texto && <p className={cn('max-w-md text-sm', tk.tintaFraca)}>{texto}</p>}
      {children}
    </div>
  );
}

export function Falha({ titulo = 'Não foi possível carregar', texto = 'Pode ser uma falha momentânea da rede ou das permissões. Tente de novo; se continuar, avise a gestão documental.', onTentar, className }) {
  return (
    <div className={cn('flex flex-col items-center gap-3 px-6 py-14 text-center', className)} role="alert">
      <AlertTriangle className={cn('h-9 w-9', tk.aviso)} aria-hidden="true" />
      <p className={cn('font-medium', tk.tinta)}>{titulo}</p>
      <p className={cn('max-w-md text-sm', tk.tintaFraca)}>{texto}</p>
      {onTentar && <Button variant="outline" onClick={onTentar}><RefreshCw className="h-4 w-4" aria-hidden="true" />Tentar de novo</Button>}
    </div>
  );
}

export function Esqueleto({ linhas = 5, className }) {
  return (
    <div className={cn('space-y-2 p-4', className)} aria-busy="true" aria-live="polite">
      <span className="sr-only">A carregar…</span>
      {Array.from({ length: linhas }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
    </div>
  );
}

// Linhas-esqueleto com as dimensões reais da tabela: o conteúdo entra sem a página saltar.
export function EsqueletoTabela({ linhas = 8, altura = 48, cabecalho = true }) {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">A carregar os documentos…</span>
      {cabecalho && <div className={cn('border-b px-3', tk.borda, tk.superficieBaixa)} style={{ height: 40 }} />}
      <ul className={cn('divide-y', tk.divisoria)}>
        {Array.from({ length: linhas }).map((_, i) => (
          <li key={i} className="flex items-center gap-4 px-3" style={{ height: altura }}>
            <div className="min-w-0 flex-1 space-y-1">
              <Skeleton className="h-4" style={{ width: `${55 + ((i * 7) % 30)}%` }} />
              {altura >= 48 && <Skeleton className="h-3 w-24" />}
            </div>
            <Skeleton className="hidden h-5 w-24 rounded-full sm:block" />
            <Skeleton className="hidden h-4 w-20 md:block" />
            <Skeleton className="hidden h-4 w-24 xl:block" />
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── tabela densa ────────────────────────────────────────────────────────────
// Cabeçalho fixo, divisória de 1 px, sem zebra. A selecção de uma linha abre o painel lateral (nunca modal).
// As acções de linha estão sempre presentes e focáveis por teclado — nada aparece só ao passar o rato.
const COLUNAS = [
  { chave: 'nome', label: 'Nome', largura: '', ordenavel: true },
  { chave: 'formato', label: 'Tipo', largura: 'w-[4.75rem]', esconde: 'hidden sm:table-cell', ordenavel: true },
  { chave: 'estado', label: 'Estado', largura: 'w-[7rem]', esconde: 'hidden sm:table-cell', ordenavel: true },
  { chave: 'versao', label: 'Versão / em vigor', largura: 'w-[9.5rem]', esconde: 'hidden lg:table-cell', ordenavel: true },
  { chave: 'validade', label: 'Validade', largura: 'w-[9rem]', esconde: 'hidden md:table-cell', ordenavel: true },
  { chave: 'responsavel', label: 'Responsável', largura: 'w-[10rem]', esconde: 'hidden min-[1920px]:table-cell', ordenavel: true },
  { chave: 'actualizado', label: 'Actualizado', largura: 'w-[7.5rem]', esconde: 'hidden xl:table-cell', ordenavel: true },
];

const valorOrdem = (d, chave) => {
  switch (chave) {
    case 'estado': return ESTADO_LABEL[d.estado] || '';
    case 'versao': return String(emVigorDesde(d) || '');
    case 'validade': { const n = diasParaExpirar(d); return n === null ? Number.MAX_SAFE_INTEGER : n; }
    case 'responsavel': return String(d.responsavel_email || '').toLowerCase();
    case 'actualizado': return String(d.updated_date || d.created_date || '');
    case 'formato': return formatoFicheiroDoc(d) || '~';
    default: return String(d.titulo || '').toLowerCase();
  }
};
export function ordenarDocs(docs, chave = 'actualizado', dir = 'desc') {
  const sinal = dir === 'asc' ? 1 : -1;
  return [...docs].sort((a, b) => {
    const va = valorOrdem(a, chave); const vb = valorOrdem(b, chave);
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * sinal;
    return String(va).localeCompare(String(vb), 'pt') * sinal;
  });
}

// O cabeçalho fica fixo abaixo da barra do portal (4 rem) e é o comando de ordenação.
function Cabecalho({ col, ordem, dir, aoOrdenar }) {
  const activa = ordem === col.chave;
  const comum = cn('sticky top-16 z-10 border-b text-left text-xs font-semibold uppercase tracking-wide',
    tk.borda, tk.superficie, tk.tintaFraca, col.largura, col.esconde);
  if (!col.ordenavel || !aoOrdenar) return <th scope="col" className={cn(comum, 'px-3 py-2')}>{col.label}</th>;
  return (
    <th scope="col" aria-sort={activa ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={comum}>
      <button
        type="button"
        onClick={() => aoOrdenar(col.chave)}
        className={cn('flex w-full items-center gap-1 px-3 py-2.5 text-left uppercase', tk.foco, activa ? tk.acento : 'hover:text-slate-900 dark:hover:text-white')}
      >
        {/* o título da coluna parte em duas linhas em vez de ser cortado com «…» (colunas de largura fixa) */}
        <span className="whitespace-normal break-words leading-tight">{col.label}</span>
        <ArrowUp className={cn('h-3 w-3 shrink-0 transition-transform', activa ? (dir === 'asc' ? '' : 'rotate-180') : 'opacity-0')} aria-hidden="true" />
      </button>
    </th>
  );
}

export function TabelaDocumentos({
  docs, tipos, aeroportos, termo, densidade = 'normal', ordem, dir = 'desc', aoOrdenar,
  seleccionado, aoSeleccionar, esconder = [], mostrarAeroporto = false, idPainel,
}) {
  const altura = alturaDensidade(densidade);
  const compacta = altura < 48;
  const fora = new Set(esconder);
  const colunas = COLUNAS.filter(c => !fora.has(c.chave));
  const cel = cn('px-3 align-middle text-sm', tk.tintaMedia);

  return (
    <table className={cn('w-full table-fixed border-collapse text-left',
      // os cantos acompanham o cartão sem `overflow-hidden`, que estragaria o cabeçalho fixo
      '[&>thead>tr>th:first-child]:rounded-tl-2xl [&>thead>tr>th:last-child]:rounded-tr-2xl',
      '[&>tbody>tr:last-child>td:first-child]:rounded-bl-2xl [&>tbody>tr:last-child>td:last-child]:rounded-br-2xl')}
    >
      <caption className="sr-only">Documentos: nome e número, estado, versão e entrada em vigor, validade, responsável e data da última alteração.</caption>
      <thead>
        <tr>
          {colunas.map(c => <Cabecalho key={c.chave} col={c} ordem={ordem} dir={dir} aoOrdenar={aoOrdenar} />)}
          <th scope="col" className={cn('sticky top-16 z-10 w-[3.5rem] border-b px-3 py-2', tk.borda, tk.superficie)}>
            <span className="sr-only">Abrir</span>
          </th>
        </tr>
      </thead>
      <tbody className={cn('divide-y', tk.divisoria)}>
        {docs.map(d => {
          const escolhido = seleccionado === d.id;
          const tipo = rotuloTipo(tipos, d.tipo_id);
          const aero = rotuloAero(aeroportos, d.aeroporto_id);
          return (
            <tr
              key={d.id}
              data-escolhido={escolhido ? 'sim' : undefined}
              onClick={aoSeleccionar ? (e) => aoSeleccionar(d.id, e) : undefined}
              className={cn('group transition-colors', escolhido ? tk.seleccionada : tk.hover, aoSeleccionar && 'cursor-pointer')}
              style={{ minHeight: altura }}
            >
              {/* Nome + número em monoespaçado por baixo. Em ecrã pequeno junta o que as colunas escondidas diriam. */}
              <td className={cn('px-3 py-1.5 align-middle')}>
                <button
                  type="button"
                  onClick={aoSeleccionar ? (e) => { e.stopPropagation(); aoSeleccionar(d.id, e); } : undefined}
                  aria-expanded={aoSeleccionar && idPainel ? escolhido : undefined}
                  aria-controls={aoSeleccionar && idPainel ? idPainel : undefined}
                  className={cn('block w-full min-w-0 rounded text-left', tk.foco, !aoSeleccionar && 'cursor-default')}
                >
                  {/* Título legível: até duas linhas em qualquer densidade (a densidade só mexe no espaçamento). Tooltip com o título inteiro. */}
                  <span title={d.titulo || undefined} className={cn('block font-medium leading-[1.25] line-clamp-2', tk.tinta)}>{realcar(d.titulo, termo)}</span>
                  <span className={cn('mt-0.5 flex items-center gap-2 text-sm leading-[1.2]', tk.tintaFraca)}>
                    {/* O número é o identificador — nunca trunca; é o texto do processo que cede espaço. */}
                    {d.numero
                      ? <span className={cn('shrink-0 whitespace-nowrap', tk.mono)} title={d.numero}>{realcar(d.numero, termo)}</span>
                      : <span className="shrink-0 italic">sem número</span>}
                    {/* manual ou programa a que pertence: texto simples, não um selo — é contexto, não estado */}
                    {d.replicaDe && (
                      <span className="shrink-0 rounded border border-sky-300 bg-sky-50 px-1.5 text-xs font-medium text-sky-800 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200"
                        title={`Réplica: o documento vive em ${d.replicaDe.replace(':', ' · ')} e é aí que se revê; esta entrada acompanha-o.`}>
                        Réplica · {d.replicaDe.replace(':', ' ')}
                      </span>
                    )}
                    {textoProcesso(d) && <span className="hidden min-w-0 truncate md:inline" title={tituloProcesso(d)}>· {textoProcesso(d)}</span>}
                    {mostrarAeroporto && aero && <span className="hidden shrink-0 items-center gap-1 lg:inline-flex"><Building2 className="h-3.5 w-3.5" aria-hidden="true" />{aero}</span>}
                  </span>
                  {/* o que fica escondido nas colunas estreitas aparece aqui, para a linha nunca mentir */}
                  <span className="mt-1 flex flex-wrap items-center gap-1.5 sm:hidden">
                    <EstadoChip estado={d.estado} />
                    <ValidadeChip documento={d} />
                  </span>
                  <span className="mt-1 hidden flex-wrap items-center gap-1.5 sm:flex md:hidden">
                    <ValidadeChip documento={d} />
                  </span>
                </button>
              </td>

              {colunas.some(c => c.chave === 'formato') && (
                <td className={cn(cel, 'hidden sm:table-cell')}><SeloFormato doc={d} /></td>
              )}
              {colunas.some(c => c.chave === 'estado') && (
                <td className={cn(cel, 'hidden sm:table-cell')}><EstadoChip estado={d.estado} /></td>
              )}
              {colunas.some(c => c.chave === 'versao') && (
                <td className={cn(cel, 'hidden lg:table-cell')}>
                  <span className={cn('block leading-[1.2]', tk.mono, tk.tinta)}>v{versaoDoc(d)}</span>
                  <span className={cn('block text-sm leading-[1.2]', tk.tintaFraca)}>{emVigorDesde(d) ? `desde ${fmtData(emVigorDesde(d))}` : 'sem data'}</span>
                </td>
              )}
              {colunas.some(c => c.chave === 'validade') && (
                <td className={cn(cel, 'hidden md:table-cell')}><ValidadeChip documento={d} sempre /></td>
              )}
              {colunas.some(c => c.chave === 'responsavel') && (
                <td className={cn(cel, 'hidden min-[1920px]:table-cell')}>
                  <span className="block truncate" title={d.responsavel_email || undefined}>{pessoaDeEmail(d.responsavel_email) || '—'}</span>
                </td>
              )}
              {colunas.some(c => c.chave === 'actualizado') && (
                <td className={cn(cel, 'hidden xl:table-cell', tk.mono)}>{fmtData(d.updated_date || d.created_date)}</td>
              )}

              <td className="px-2 align-middle">
                <div className="flex items-center justify-end gap-0.5">
                  {d.requer_senha_adicional && <KeyRound role="img" aria-label="Pede senha" className={cn('h-3.5 w-3.5 shrink-0', tk.tintaTenue)} />}
                  {d.bloquear_download && <Lock role="img" aria-label="Só leitura, sem descarga" className={cn('h-3.5 w-3.5 shrink-0', tk.tintaTenue)} />}
                  <Link
                    to={urlDoc(d.id)}
                    onClick={e => e.stopPropagation()}
                    aria-label={`Abrir ${d.titulo}`}
                    title="Abrir a ficha do documento"
                    className={cn('flex h-11 w-9 items-center justify-center rounded-lg', tk.tintaFraca, tk.foco, 'hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white')}
                  >
                    <ChevronRight className="h-5 w-5" aria-hidden="true" />
                  </Link>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// Linha de documento (vista em lista simples). `aeroportos`/`tipos` são mapas id→registo.
export function LinhaDoc({ doc, tipos, aeroportos, termo, mostrarAeroporto = false, extra }) {
  const tipo = rotuloTipo(tipos, doc.tipo_id);
  const aero = mostrarAeroporto ? rotuloAero(aeroportos, doc.aeroporto_id) : '';
  return (
    <li>
      <Link
        to={urlDoc(doc.id)}
        className={cn('flex items-start gap-3 px-4 py-3 transition-colors', tk.hover, 'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-600 dark:focus-visible:ring-teal-400')}
      >
        <FileText className={cn('mt-0.5 h-5 w-5 shrink-0', tk.tintaTenue)} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className={cn('block font-medium leading-snug', tk.tinta)}>{realcar(doc.titulo, termo)}</span>
          <span className={cn('mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm', tk.tintaFraca)}>
            {doc.numero && <span className={tk.mono}>{realcar(doc.numero, termo)}</span>}
            {tipo && <span>{tipo}</span>}
            {/* o manual ou programa de que faz parte: contexto, por isso texto simples e não um selo */}
            {textoProcesso(doc) && <span className="max-w-[18rem] truncate" title={tituloProcesso(doc)}>{textoProcesso(doc)}</span>}
            {aero && <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" aria-hidden="true" />{aero}</span>}
            <span className={tk.mono}>v{versaoDoc(doc)}</span>
            <span className={tk.mono}>{fmtData(dataDoc(doc))}</span>
          </span>
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <EstadoChip estado={doc.estado} />
            <ValidadeChip documento={doc} />
            {doc.bloquear_download && <span className={cn(chip, 'border-slate-200 bg-slate-100 text-slate-600', ESCURO_ESTADO.rascunho)}><Lock className="h-3 w-3" aria-hidden="true" />Só leitura</span>}
            {doc.requer_senha_adicional && <span className={cn(chip, 'border-slate-200 bg-slate-100 text-slate-600', ESCURO_ESTADO.rascunho)}><KeyRound className="h-3 w-3" aria-hidden="true" />Com senha</span>}
            {extra}
          </span>
        </span>
        <ChevronRight className={cn('mt-1.5 h-4 w-4 shrink-0', tk.tintaTenue)} aria-hidden="true" />
      </Link>
    </li>
  );
}

// Cartão de documento (vista em grelha).
export function CartaoDoc({ doc, tipos, aeroportos, termo, mostrarAeroporto = true }) {
  const tipo = rotuloTipo(tipos, doc.tipo_id);
  const aero = mostrarAeroporto ? rotuloAero(aeroportos, doc.aeroporto_id) : '';
  return (
    <Link
      to={urlDoc(doc.id)}
      className={cn(cartao, 'flex min-h-[11rem] flex-col gap-2 p-4 transition-shadow hover:shadow-md', tk.foco)}
    >
      <span className={cn('flex items-center gap-2 text-sm', tk.tintaFraca)}>
        <FileText className={cn('h-4 w-4 shrink-0', tk.acento)} aria-hidden="true" />
        {tipo || 'Documento'}
      </span>
      <span className={cn('line-clamp-3 font-semibold leading-snug', tk.tinta)}>{realcar(doc.titulo, termo)}</span>
      {doc.numero && <span className={cn('text-sm', tk.mono, tk.tintaFraca)}>{realcar(doc.numero, termo)}</span>}
      <span className={cn('mt-auto flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm', tk.tintaFraca)}>
        {aero && <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" aria-hidden="true" />{aero}</span>}
        <span className={tk.mono}>v{versaoDoc(doc)}</span>
        <span className={tk.mono}>{emVigorDesde(doc) ? fmtData(emVigorDesde(doc)) : fmtData(dataDoc(doc))}</span>
      </span>
      <span className="flex flex-wrap items-center gap-1.5">
        <EstadoChip estado={doc.estado} />
        <ValidadeChip documento={doc} sempre />
        <ProcessoChip doc={doc} className="max-w-full" />
      </span>
    </Link>
  );
}

// Lista de documentos nas três apresentações. A tabela é a de omissão; a grelha e a lista são alternativas.
export function ListaDocumentos({ docs, tipos, aeroportos, termo, vista = 'tabela', mostrarAeroporto = false, ...resto }) {
  if (vista === 'grelha') {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {docs.map(d => <CartaoDoc key={d.id} doc={d} tipos={tipos} aeroportos={aeroportos} termo={termo} mostrarAeroporto={mostrarAeroporto} />)}
      </div>
    );
  }
  if (vista === 'lista') {
    return (
      <ul className={cn(cartao, 'divide-y overflow-hidden', tk.divisoria)}>
        {docs.map(d => <LinhaDoc key={d.id} doc={d} tipos={tipos} aeroportos={aeroportos} termo={termo} mostrarAeroporto={mostrarAeroporto} />)}
      </ul>
    );
  }
  return (
    <div className={cartao}>
      <TabelaDocumentos docs={docs} tipos={tipos} aeroportos={aeroportos} termo={termo} mostrarAeroporto={mostrarAeroporto} {...resto} />
    </div>
  );
}

// ── filtros partilhados (tipo, estado, validade) ────────────────────────────
export const OPCOES_ESTADO = [{ value: '', label: 'Estado: todos' }, ...ESTADOS_DOCUMENTO.map(e => ({ value: e.chave, label: e.label }))];
export const OPCOES_VALIDADE = [
  { value: '', label: 'Validade: todas' },
  { value: 'expirado', label: 'Expirados' },
  { value: '30', label: 'A expirar em 30 dias' },
  { value: '60', label: 'A expirar em 60 dias' },
  { value: '90', label: 'A expirar em 90 dias' },
  { value: 'valido', label: 'Dentro da validade' },
  { value: 'sem_validade', label: 'Sem validade' },
];
export function correspondeValidade(doc, filtro) {
  if (!filtro) return true;
  const dias = diasParaExpirar(doc);
  if (filtro === 'sem_validade') return dias === null;
  if (dias === null) return false;
  if (filtro === 'expirado') return dias < 0;
  if (filtro === 'valido') return dias >= 0;
  const limite = Number(filtro);
  return Number.isFinite(limite) ? dias >= 0 && dias <= limite : true;
}
export const opcoesTipo = (tipos) => [{ value: '', label: 'Tipo: todos' }, ...(tipos || []).map(t => ({ value: t.id, label: t.nome }))];
// `__sem` é o valor para «documentos sem tipo atribuído» — hoje são a maioria, e vale poder isolá-los.
export const SEM_TIPO = '__sem';
export const correspondeTipo = (doc, filtro) => !filtro || (filtro === SEM_TIPO ? !doc.tipo_id : doc.tipo_id === filtro);

// ── filtros pela codificação: «por manual» e «por classe» ───────────────────
// São estes dois que fazem a diferença numa inspecção: ninguém pergunta «que documentos do tipo formulário há?»,
// pergunta «o que é que o Plano de Emergência leva dentro?». Os documentos antigos fora do padrão não têm código
// e por isso não entram em nenhuma ficha — o que é verdade e não um defeito.
export const correspondeProcesso = (doc, filtro) => !filtro || doc.processo_codigo === filtro;
export const correspondeClasse = (doc, filtro) => !filtro || doc.classe_codigo === filtro;
// Uma ficha por código, com a contagem que daria. O rótulo leva o código à frente porque é o que está escrito no
// número do documento e é por ele que as pessoas o chamam; o nome vem a seguir, para quem ainda não o decora.
export function fichasCodigo(lista, registos, campo) {
  const docs = Array.isArray(lista) ? lista : [];
  return (Array.isArray(registos) ? registos : []).map(r => ({
    value: r.codigo,
    label: r.nome ? `${r.codigo} · ${r.nome}` : r.codigo,
    titulo: r.nome ? `${r.codigo} — ${r.nome}` : `Código ${r.codigo}, ainda sem nome na codificação`,
    total: docs.reduce((n, d) => n + (d[campo] === r.codigo ? 1 : 0), 0),
  }));
}
export const rotuloCodigo = (mapa, cod) => {
  const r = cod ? mapa?.get?.(cod) : null;
  return r?.nome ? `${cod} · ${r.nome}` : (cod || '');
};

// Fichas de filtro: cada valor possível com a contagem que daria, calculada já com os outros filtros aplicados.
// Mostra só o que tem resultados (e o que estiver escolhido, mesmo a zero, para se poder desfazer).
// Um rótulo comprido (o nome inteiro de um manual) é cortado em vez de rebentar a fila; `o.titulo`, quando vem,
// dá o texto completo ao passar o rato e aos leitores de ecrã.
export function FichasFiltro({ titulo, opcoes, valor, aoEscolher }) {
  const visiveis = opcoes.filter(o => o.total > 0 || o.value === valor);
  if (!visiveis.length) return null;
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
      {/* w-24: «AEROPORTO» em maiúsculas com tracking não cabia em w-16 e ficava tapado pelo filtro ao lado. */}
      <span className={cn('w-24 shrink-0 text-xs font-semibold uppercase tracking-wide', tk.tintaFraca)}>{titulo}</span>
      <div className="flex flex-wrap gap-1.5">
        {visiveis.map(o => {
          const activa = o.value === valor;
          return (
            <button
              key={o.value || 'todos'}
              type="button"
              aria-pressed={activa}
              title={o.titulo || undefined}
              onClick={() => aoEscolher(activa ? '' : o.value)}
              className={cn('inline-flex min-h-[2.25rem] max-w-full items-center gap-1.5 rounded-full border px-3 text-sm transition-colors', tk.foco,
                activa ? cn(tk.acentoBorda, tk.acentoFundo, tk.acento, 'font-semibold') : cn(tk.borda, tk.superficie, tk.tintaMedia, tk.hover))}
            >
              <span className="max-w-[18rem] truncate">{o.label}</span>
              <span className={cn('tabular-nums', activa ? '' : tk.tintaTenue)}>{o.total}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Resumo do que está aplicado: cada filtro sai sozinho, e há sempre «Limpar tudo».
export function ResumoFiltros({ aplicados, aoLimparTudo }) {
  if (!aplicados.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2" role="status">
      <span className={cn('text-xs font-semibold uppercase tracking-wide', tk.tintaFraca)}>A filtrar por</span>
      {aplicados.map(f => (
        <span key={f.chave} className={cn('inline-flex min-h-[2rem] items-center gap-1 rounded-full border pl-3 pr-1 text-sm', tk.acentoBorda, tk.acentoFundo, tk.acento)}>
          <span className="max-w-[16rem] truncate">{f.rotulo}</span>
          <button type="button" onClick={f.aoRemover} aria-label={`Remover o filtro ${f.rotulo}`} className={cn('flex h-7 w-7 items-center justify-center rounded-full hover:bg-teal-100 dark:hover:bg-teal-900/60', tk.foco)}>
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </span>
      ))}
      <Button variant="ghost" size="sm" onClick={aoLimparTudo}>Limpar tudo</Button>
    </div>
  );
}

// ── painel lateral de pré-visualização ─────────────────────────────────────
// Triagem sem perder a lista: em ecrã grande é a terceira coluna; em ecrã pequeno encosta ao fundo, sem fundo
// escurecido e sem prender o foco — não é uma janela modal, a lista continua a funcionar por trás.
const IMAGENS_PAINEL = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'];
const extDe = (nome) => String(nome || '').split('?')[0].split('#')[0].split('.').pop().toLowerCase();

function LinhaMeta({ rotulo, children }) {
  if (children === null || children === undefined || children === '') return null;
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-2 py-1.5">
      <dt className={cn('text-xs font-semibold uppercase tracking-wide', tk.tintaFraca)}>{rotulo}</dt>
      <dd className={cn('break-words text-sm', tk.tintaMedia)}>{children}</dd>
    </div>
  );
}

export function PainelDocumento({ doc, tipos, aeroportos, pastas, aoFechar, id = 'painel-documento' }) {
  const [url, setUrl] = useState('');
  const [erro, setErro] = useState('');
  const [aCarregar, setACarregar] = useState(false);

  // Troca de documento: limpa o que estava à vista.
  useEffect(() => { setUrl(''); setErro(''); setACarregar(false); }, [doc?.id]);

  // A pré-visualização só carrega quando a pessoa a pede. Duas razões: num telemóvel em pista não se puxam
  // ficheiros a cada linha que se toca, e cada abertura fica no registo de acessos — percorrer a lista não pode
  // encher a auditoria de aberturas que ninguém fez.
  const preVisualizar = async () => {
    if (!doc?.id || aCarregar) return;
    setACarregar(true); setErro('');
    try {
      const r = await obterUrlAssinadaDocumento({ documento_id: doc.id });
      setUrl(r?.url || '');
      registrarAcessoDocumento({ documento_id: doc.id, tipo_acesso: 'visualizacao' }).catch(() => { /* o registo nunca trava a consulta */ });
    } catch (e) {
      setErro(e?.message || 'Não foi possível abrir o ficheiro.');
    } finally { setACarregar(false); }
  };

  const descarregar = async () => {
    if (!url) return;
    try { await registrarAcessoDocumento({ documento_id: doc.id, tipo_acesso: 'download' }); } catch { /* idem */ }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (!doc) return null;
  const ext = extDe(doc.arquivo_privado_uri || doc.arquivo_url);
  const ehPdf = ext === 'pdf';
  const ehImagem = IMAGENS_PAINEL.includes(ext);
  const temFicheiro = !!(doc.arquivo_privado_uri || doc.arquivo_url);
  const pasta = doc.pasta_id ? pastas?.get?.(doc.pasta_id) : null;

  return (
    <aside
      id={id}
      aria-label={`Pré-visualização de ${doc.titulo}`}
      className={cn('fixed inset-x-0 bottom-0 z-30 flex max-h-[62vh] flex-col overflow-hidden rounded-t-2xl border-t shadow-2xl',
        'xl:sticky xl:inset-x-auto xl:bottom-auto xl:top-[var(--topo-fixo,5rem)] xl:z-auto xl:max-h-[calc(100vh-7rem)] xl:rounded-2xl xl:border xl:shadow-none',
        tk.borda, tk.superficie)}
    >
      <div className={cn('flex items-start gap-2 border-b px-4 py-3', tk.borda)}>
        <div className="min-w-0 flex-1">
          <p className={cn('truncate text-sm', tk.mono, tk.tintaFraca)}>{doc.numero || 'sem número'}</p>
          <h2 className={cn('mt-0.5 line-clamp-2 font-semibold leading-snug', tk.tinta)}>{doc.titulo}</h2>
          <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <EstadoChip estado={doc.estado} />
            <ValidadeChip documento={doc} sempre />
          </p>
        </div>
        <button type="button" onClick={aoFechar} aria-label="Fechar a pré-visualização" className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-lg', tk.tintaFraca, tk.foco, tk.hover)}>
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={cn('border-b px-4 py-3', tk.borda)}>
          <p className={cn('text-sm', tk.mono, tk.tintaMedia)}>
            v{versaoDoc(doc)}{emVigorDesde(doc) ? ` · Em vigor desde ${fmtData(emVigorDesde(doc))}` : ''}
          </p>
        </div>

        {/* pré-visualização */}
        <div className={cn('border-b', tk.borda, tk.superficieBaixa)}>
          {doc.requer_senha_adicional ? (
            <p className={cn('flex items-start gap-2 px-4 py-6 text-sm', tk.tintaFraca)}>
              <KeyRound className={cn('mt-0.5 h-4 w-4 shrink-0', tk.aviso)} aria-hidden="true" />
              Este documento pede uma senha. Abra a ficha para a introduzir — a senha é verificada no servidor.
            </p>
          ) : !temFicheiro ? (
            <p className={cn('px-4 py-6 text-sm', tk.tintaFraca)}>O registo existe, mas não tem ficheiro carregado. Fale com a gestão documental.</p>
          ) : erro ? (
            <div className="px-4 py-6">
              <p className={cn('flex items-start gap-2 text-sm', tk.perigo)}>
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{erro}
              </p>
              <Button variant="outline" size="sm" className="mt-3" onClick={preVisualizar}><RefreshCw className="h-4 w-4" aria-hidden="true" />Tentar de novo</Button>
            </div>
          ) : aCarregar ? (
            <div className="p-4"><Skeleton className="h-48 w-full rounded-xl" /></div>
          ) : !url ? (
            <div className="px-4 py-6 text-center">
              <Button variant="outline" onClick={preVisualizar} className="w-full">
                <Eye className="h-4 w-4" aria-hidden="true" />Pré-visualizar aqui
              </Button>
              <p className={cn('mt-2 text-sm', tk.tintaFraca)}>Abre o ficheiro neste painel, sem sair da lista. A abertura fica no registo de acessos.</p>
            </div>
          ) : ehPdf ? (
            <iframe src={`${url}#${doc.bloquear_download ? 'toolbar=0&' : ''}view=FitH`} title={`Pré-visualização de ${doc.titulo}`} className="h-48 w-full border-0 bg-white xl:h-72 dark:bg-slate-950" />
          ) : ehImagem ? (
            <img src={url} alt={doc.titulo} className="max-h-48 w-full object-contain xl:max-h-72" />
          ) : (
            <p className={cn('px-4 py-6 text-sm', tk.tintaFraca)}>
              Os ficheiros {ext ? ext.toUpperCase() : 'deste tipo'} não abrem no navegador. Descarregue-o para o ver no Office.
            </p>
          )}
        </div>

        <dl className={cn('divide-y px-4 py-2', tk.divisoria)}>
          <LinhaMeta rotulo="Aeroporto">{nomeAero(aeroportos, doc.aeroporto_id)}</LinhaMeta>
          <LinhaMeta rotulo="Pasta">{pasta?.nome || null}</LinhaMeta>
          <LinhaMeta rotulo="Tipo">{rotuloTipo(tipos, doc.tipo_id) || doc.categoria || null}</LinhaMeta>
          {/* as duas dimensões escondidas no número (migração 157): o que o documento é, e de que manual faz parte */}
          <LinhaMeta rotulo="Classe">{textoClasse(doc) ? <span title={tituloClasse(doc)}>{textoClasse(doc)}</span> : null}</LinhaMeta>
          <LinhaMeta rotulo="Manual">{textoProcesso(doc) ? <span title={tituloProcesso(doc)}>{textoProcesso(doc)}</span> : null}</LinhaMeta>
          <LinhaMeta rotulo="Responsável">{doc.responsavel_email ? pessoaDeEmail(doc.responsavel_email) : null}</LinhaMeta>
          <LinhaMeta rotulo="Emissor">{doc.entidade_emissora || null}</LinhaMeta>
          <LinhaMeta rotulo="Actualizado">{fmtDataHora(doc.updated_date)}</LinhaMeta>
        </dl>
      </div>

      <div className={cn('flex flex-wrap gap-2 border-t px-4 py-3', tk.borda)}>
        <Button asChild className="min-h-[2.75rem] flex-1"><Link to={urlDoc(doc.id)}><ExternalLink className="h-4 w-4" aria-hidden="true" />Abrir a ficha</Link></Button>
        {url && !doc.bloquear_download && (
          <Button variant="outline" className="min-h-[2.75rem]" onClick={descarregar}><Download className="h-4 w-4" aria-hidden="true" />Descarregar</Button>
        )}
      </div>
    </aside>
  );
}

// ── biblioteca ──────────────────────────────────────────────────────────────
const CHAVE_GERAL = 'geral'; // documentos e pastas sem aeroporto atribuído
const chaveAero = (id) => id || CHAVE_GERAL;
const POR_PAGINA = 50;

function Migalhas({ caminho, aeroporto, aoEscolher, estrutura }) {
  if (estrutura) {
    // vista «Estrutura do MOA/PSA»: Biblioteca › FNLU › Estrutura do MOA › AP.13 · Formulários e Fichas
    caminho = [];
  }
  return (
    <nav aria-label="Caminho de navegação" className="min-w-0">
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm">
        <li>
          <button type="button" onClick={() => aoEscolher(null, null)} className={cn('inline-flex min-h-[2.25rem] items-center gap-1.5 rounded px-1 font-medium hover:underline', tk.acento, tk.foco)}>
            <Library className="h-4 w-4" aria-hidden="true" />Biblioteca
          </button>
        </li>
        {aeroporto && (
          <li className="flex items-center gap-1">
            <ChevronRight className={cn('h-4 w-4', tk.tintaTenue)} aria-hidden="true" />
            <button type="button" onClick={() => aoEscolher(aeroporto.chave, null)} className={cn('min-h-[2.25rem] rounded px-1', tk.foco, caminho.length || estrutura ? cn('font-medium hover:underline', tk.acento) : tk.tintaMedia)}>
              {aeroporto.codigo}
            </button>
          </li>
        )}
        {estrutura && (
          <li className="flex items-center gap-1">
            <ChevronRight className={cn('h-4 w-4', tk.tintaTenue)} aria-hidden="true" />
            {estrutura.seccao
              ? <button type="button" onClick={estrutura.aoAbrirRaiz} className={cn('min-h-[2.25rem] rounded px-1 font-medium hover:underline', tk.acento, tk.foco)}>{estrutura.nome}</button>
              : <span aria-current="page" className={cn('px-1 py-0.5', tk.tintaMedia)}>{estrutura.nome}</span>}
          </li>
        )}
        {estrutura?.seccao && (
          <li className="flex min-w-0 items-center gap-1">
            <ChevronRight className={cn('h-4 w-4 shrink-0', tk.tintaTenue)} aria-hidden="true" />
            <span aria-current="page" className={cn('truncate px-1 py-0.5', tk.tintaMedia)}>{estrutura.seccao}</span>
          </li>
        )}
        {caminho.map((p, i) => (
          <li key={p.id} className="flex min-w-0 items-center gap-1">
            <ChevronRight className={cn('h-4 w-4 shrink-0', tk.tintaTenue)} aria-hidden="true" />
            {i === caminho.length - 1
              ? <span aria-current="page" className={cn('truncate px-1 py-0.5', tk.tintaMedia)}>{p.nome}</span>
              : <button type="button" onClick={() => aoEscolher(aeroporto?.chave, p.id)} className={cn('min-h-[2.25rem] truncate rounded px-1 font-medium hover:underline', tk.acento, tk.foco)}>{p.nome}</button>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

// Nó da árvore de pastas (só em ecrã grande). Recursivo, navegável por teclado (são botões normais).
function NoArvore({ no, pastaSel, aberto: estaAberto, alternar, aoEscolher, contar, nivel = 0 }) {
  const temFilhas = (no.filhas || []).length > 0;
  const aberto = estaAberto(no.id);
  const activa = pastaSel === no.id;
  const total = contar(no);
  return (
    <li>
      <div className={cn('flex items-center gap-0.5 rounded-lg', activa && tk.acentoFundo)} style={{ paddingLeft: `${nivel * 0.75}rem` }}>
        {temFilhas ? (
          <button type="button" onClick={() => alternar(no.id)} aria-expanded={aberto} aria-label={aberto ? `Fechar ${no.nome}` : `Abrir ${no.nome}`} className={cn('rounded p-1.5', tk.tintaFraca, tk.foco, 'hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200')}>
            {aberto ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
          </button>
        ) : <span className="w-7" aria-hidden="true" />}
        <button
          type="button"
          onClick={() => aoEscolher(no.id)}
          aria-current={activa ? 'true' : undefined}
          className={cn('flex min-h-[2.5rem] min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 py-2 text-left text-sm', tk.foco,
            activa ? cn('font-semibold', tk.acento) : cn(tk.tintaMedia, 'hover:text-slate-900 dark:hover:text-white'))}
        >
          {activa ? <FolderOpen className={cn('h-4 w-4 shrink-0', tk.acento)} aria-hidden="true" /> : <Folder className={cn('h-4 w-4 shrink-0', tk.tintaTenue)} aria-hidden="true" />}
          <span className="truncate">{no.nome}</span>
          {total > 0 && <span className={cn('ml-auto shrink-0 tabular-nums text-xs', tk.tintaTenue)}>{total}</span>}
        </button>
      </div>
      {temFilhas && aberto && (
        <ul className="space-y-0.5">
          {no.filhas.map(f => <NoArvore key={f.id} no={f} pastaSel={pastaSel} aberto={estaAberto} alternar={alternar} aoEscolher={aoEscolher} contar={contar} nivel={nivel + 1} />)}
        </ul>
      )}
    </li>
  );
}

function CartaoPasta({ pasta, total, aoAbrir }) {
  return (
    <button
      type="button"
      onClick={() => aoAbrir(pasta.id)}
      className={cn(cartao, 'flex min-h-[5.5rem] w-full items-start gap-3 p-4 text-left transition-shadow hover:shadow-md', tk.foco)}
    >
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={pasta.cor ? { backgroundColor: `${pasta.cor}22`, color: pasta.cor } : undefined}>
        <Folder className={cn('h-5 w-5', !pasta.cor && tk.acento)} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate font-medium', tk.tinta)}>{pasta.nome}</span>
        {pasta.descricao && <span className={cn('mt-0.5 line-clamp-2 block text-sm', tk.tintaFraca)}>{pasta.descricao}</span>}
        <span className={cn('mt-1 block text-sm', tk.tintaTenue)}>{total === 1 ? '1 documento' : `${total} documentos`}{(pasta.filhas || []).length ? ` · ${pasta.filhas.length} ${pasta.filhas.length === 1 ? 'subpasta' : 'subpastas'}` : ''}</span>
      </span>
      <ChevronRight className={cn('mt-1 h-4 w-4 shrink-0', tk.tintaTenue)} aria-hidden="true" />
    </button>
  );
}

// Secção do dossier MOA/PSA (vista de navegação; os documentos continuam nas pastas de sempre).
function CartaoSeccao({ seccao, total, aoAbrir }) {
  const rotulo = seccao.ref === '01' ? null : seccao.ref;
  return (
    <button
      type="button"
      onClick={() => aoAbrir(seccao.ref)}
      disabled={!total}
      className={cn(cartao, 'flex min-h-[4.5rem] w-full items-center gap-3 p-3.5 text-left transition-shadow', tk.foco,
        total ? 'hover:shadow-md' : 'cursor-default opacity-55')}
    >
      <span className={cn('flex h-9 min-w-[3.25rem] shrink-0 items-center justify-center rounded-lg px-1.5 text-xs font-bold tabular-nums', tk.acentoFundo, tk.acento)}>
        {rotulo || <BookMarked className="h-4 w-4" aria-hidden="true" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block font-medium leading-snug', tk.tinta)}>{seccao.nome}</span>
        <span className={cn('mt-0.5 block text-sm tabular-nums', tk.tintaTenue)}>{total === 1 ? '1 documento' : total ? `${total} documentos` : 'sem documentos'}</span>
      </span>
      {total > 0 && <ChevronRight className={cn('h-4 w-4 shrink-0', tk.tintaTenue)} aria-hidden="true" />}
    </button>
  );
}

// Confirmação de leitura: só os documentos marcados para isso (documento.exige_leitura), e só aos perfis indicados
// em leitura_perfis (vazio = a toda a gente que vê o documento). Sem marca, nenhum documento fica "por confirmar".
export const pedeConfirmacao = (doc, user) => {
  if (!doc?.exige_leitura) return false;
  const alvo = Array.isArray(doc.leitura_perfis) ? doc.leitura_perfis.filter(Boolean) : [];
  if (!alvo.length) return true;
  const meus = Array.isArray(user?.perfis) ? user.perfis : [];
  return alvo.some(p => meus.includes(p));
};

// Comutador de densidade das linhas (40/48/56), guardado por pessoa.
function ComutadorDensidade({ valor, aoMudar }) {
  return (
    <div className={cn('flex items-center gap-0.5 rounded-lg border p-0.5', tk.borda)} role="group" aria-label="Altura das linhas">
      <Rows3 className={cn('ml-1 h-4 w-4 shrink-0', tk.tintaTenue)} aria-hidden="true" />
      {DENSIDADES.map(d => (
        <button
          key={d.value}
          type="button"
          onClick={() => aoMudar(d.value)}
          aria-pressed={valor === d.value}
          title={`Linhas de ${d.px}`}
          className={cn('min-h-[2.25rem] rounded-md px-2 text-sm tabular-nums', tk.foco,
            valor === d.value ? cn(tk.acentoFundo, tk.acento, 'font-semibold') : cn(tk.tintaFraca, 'hover:text-slate-900 dark:hover:text-white'))}
        >
          {d.altura}
          <span className="sr-only"> px — {d.label}</span>
        </button>
      ))}
    </div>
  );
}

export default function PortalBiblioteca() {
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const aeroSel = sp.get('aeroporto') || '';
  const pastaSel = sp.get('pasta') || '';
  const vista = sp.get('vista') === 'grelha' ? 'grelha' : 'tabela';
  const fTipo = sp.get('tipo') || '';
  const fEstado = sp.get('estado') || '';
  const fValidade = sp.get('validade') || '';
  const fManual = sp.get('manual') || '';          // processo: de que manual ou programa faz parte
  const fClasse = sp.get('classe') || '';          // classe: o que o documento é
  const texto = sp.get('f') || '';
  const semSub = sp.get('sub') === '0';
  const ordem = sp.get('ord') || 'actualizado';
  const dir = sp.get('dir') === 'asc' ? 'asc' : 'desc';
  const pagina = Math.max(1, Number(sp.get('pag')) || 1);
  const selId = sp.get('sel') || '';
  const est = ESTRUTURAS[sp.get('est')] ? sp.get('est') : '';   // vista «Estrutura do MOA / do PSA»
  const secSel = est ? (sp.get('sec') || '') : '';

  const [caixa, setCaixa] = useState(texto);            // caixa local; o endereço recebe-a depois da pausa
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [densidade, setDensidade] = useState(preferenciaDensidadeDocs);
  const [estadoNos, setEstadoNos] = useState({});       // id → aberto/fechado quando a pessoa clica

  const aeroQ = useAeroportosDocs();
  const tiposQ = useTiposDocumento();
  const pastasQ = useArvorePastas();
  const docsQ = useDocumentosDocs({ limite: 1000 });

  const cod = useCodificacao();

  const pastas = pastasQ.data || [];
  const arvore = pastasQ.arvore || [];
  // Os documentos chegam com a classe e o manual colados: daqui para baixo qualquer peça lê `doc.processo_nome`
  // sem receber mapas por propriedade, e enquanto a codificação não tiver carregado a lista é a mesma de antes.
  const docs = useDocumentosCodificados(docsQ.data || []);
  const mapaAero = useMemo(() => mapaPorId(aeroQ.data), [aeroQ.data]);
  const mapaTipos = useMemo(() => mapaPorId(tiposQ.data), [tiposQ.data]);
  const mapaPastas = useMemo(() => mapaPorId(pastas), [pastas]);

  const aCarregar = pastasQ.isLoading || docsQ.isLoading;
  const falhou = pastasQ.isError || docsQ.isError;
  const recarregar = useCallback(() => { pastasQ.refetch?.(); docsQ.refetch?.(); }, [pastasQ, docsQ]);

  // Todo o estado vive no endereço, para qualquer vista ser partilhável e citável num relatório de auditoria.
  // Qualquer mudança que altere a lista volta à primeira página (menos quando é a própria página a mudar).
  const actualizar = useCallback((patch, { replace = false } = {}) => {
    const p = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) { if (v) p.set(k, v); else p.delete(k); }
    if (!('pag' in patch)) p.delete('pag');
    setSp(p, { replace });
  }, [sp, setSp]);
  // Mudar de pasta limpa a selecção e o âmbito: a escolha «só nesta pasta» é da pasta onde foi feita.
  const escolher = useCallback((aeroporto, pasta) => actualizar({ aeroporto: aeroporto || '', pasta: pasta || '', sel: '', sub: '', est: '', sec: '' }), [actualizar]);
  // A estrutura do dossier é outra forma de olhar para os mesmos documentos do aeroporto: não há pasta activa.
  const escolherEstrutura = useCallback((dossier, seccao) => actualizar({ est: dossier || '', sec: seccao || '', pasta: '', sel: '', sub: '' }), [actualizar]);

  useEffect(() => { setCaixa(texto); }, [texto]);
  useEffect(() => {
    if (caixa === texto) return undefined;
    const t = setTimeout(() => actualizar({ f: caixa }, { replace: true }), 300);
    return () => clearTimeout(t);
  }, [caixa, texto, actualizar]);

  const mudarDensidade = (v) => { setDensidade(v); guardarPreferenciaDensidadeDocs(v); };
  const ordenarPor = (chave) => actualizar(chave === ordem
    ? { dir: dir === 'asc' ? 'desc' : 'asc' }
    : { ord: chave === 'actualizado' ? '' : chave, dir: chave === 'nome' || chave === 'responsavel' ? 'asc' : 'desc' });

  const porId = mapaPastas;
  // Aeroporto efectivo de cada pasta: o próprio, ou o do pai mais próximo que o tenha.
  const aeroDaPasta = useMemo(() => {
    const m = new Map();
    const resolver = (p, visto) => {
      if (!p) return null;
      if (m.has(p.id)) return m.get(p.id);
      if (visto.has(p.id)) return null; // protege contra pastas em ciclo
      visto.add(p.id);
      const r = p.aeroporto_id || (p.pasta_pai_id ? resolver(porId.get(p.pasta_pai_id), visto) : null) || null;
      m.set(p.id, r);
      return r;
    };
    pastas.forEach(p => resolver(p, new Set()));
    return m;
  }, [pastas, porId]);
  // O aeroporto de um documento: o seu, ou o da pasta onde está.
  const aeroDoDoc = useCallback((d) => d.aeroporto_id || (d.pasta_id ? aeroDaPasta.get(d.pasta_id) : null) || null, [aeroDaPasta]);

  // Aeroportos com conteúdo visível (pastas ou documentos) e respectivas contagens.
  const aeroportos = useMemo(() => {
    const m = new Map();
    const garantir = (id) => {
      const chave = chaveAero(id);
      if (!m.has(chave)) {
        const a = id ? mapaAero.get(id) : null;
        m.set(chave, {
          chave, id: id || null,
          codigo: a?.codigo_icao || (id ? 'Aeroporto' : 'Geral'),
          nome: a?.nome || (id ? 'Aeroporto' : 'Documentos gerais'),
          docs: 0, pastas: 0,
        });
      }
      return m.get(chave);
    };
    for (const p of pastas) garantir(aeroDaPasta.get(p.id)).pastas += 1;
    for (const d of docs) garantir(aeroDoDoc(d)).docs += 1;
    return [...m.values()].sort((a, b) => String(a.codigo).localeCompare(String(b.codigo), 'pt'));
  }, [pastas, docs, aeroDaPasta, aeroDoDoc, mapaAero]);

  // Com um único aeroporto não vale a pena pedir que o escolham.
  useEffect(() => {
    if (aeroSel || aCarregar || aeroportos.length !== 1) return;
    actualizar({ aeroporto: aeroportos[0].chave }, { replace: true });
  }, [aeroSel, aCarregar, aeroportos, actualizar]);

  const aeroActual = aeroportos.find(a => a.chave === aeroSel) || null;
  const pastaActual = pastaSel ? porId.get(pastaSel) : null;

  // Caminho (migalhas) da pasta seleccionada até à raiz.
  const caminho = useMemo(() => {
    const lista = []; const visto = new Set();
    let p = pastaActual;
    while (p && !visto.has(p.id)) { visto.add(p.id); lista.unshift(p); p = p.pasta_pai_id ? porId.get(p.pasta_pai_id) : null; }
    return lista;
  }, [pastaActual, porId]);

  // Documentos por pasta e contagem com descendentes (para os números da árvore e dos cartões).
  const docsPorPasta = useMemo(() => {
    const m = new Map();
    for (const d of docs) { const k = d.pasta_id || ''; if (!m.has(k)) m.set(k, []); m.get(k).push(d); }
    return m;
  }, [docs]);
  const filhasDe = useMemo(() => {
    const m = new Map();
    for (const p of pastas) { const k = p.pasta_pai_id || ''; if (!m.has(k)) m.set(k, []); m.get(k).push(p.id); }
    return m;
  }, [pastas]);
  const subarvore = useCallback((raiz) => {
    const ids = new Set(); const fila = [raiz];
    while (fila.length) {
      const id = fila.pop();
      if (!id || ids.has(id)) continue;
      ids.add(id);
      for (const f of (filhasDe.get(id) || [])) fila.push(f);
    }
    return ids;
  }, [filhasDe]);
  const contarComFilhas = useCallback((no) => {
    let total = (docsPorPasta.get(no.id) || []).length;
    for (const f of (no.filhas || [])) total += contarComFilhas(f);
    return total;
  }, [docsPorPasta]);

  const arvoreBruta = useMemo(() => arvore.filter(p => chaveAero(aeroDaPasta.get(p.id)) === aeroSel), [arvore, aeroDaPasta, aeroSel]);
  // Pasta-raiz «transparente»: quando o aeroporto tem uma só pasta-raiz (ex.: «FNLU — Aeroporto 4 de Fevereiro»),
  // sem documentos soltos e com subpastas, ela É o aeroporto — mostrá-la seria um clique a mais para nada. Os setores
  // aparecem logo ao abrir o aeroporto, na árvore, nos cartões e nas migalhas.
  const raizTransparente = useMemo(() => (
    arvoreBruta.length === 1 && (arvoreBruta[0].filhas || []).length > 0 && !(docsPorPasta.get(arvoreBruta[0].id) || []).length
      ? arvoreBruta[0] : null
  ), [arvoreBruta, docsPorPasta]);
  const arvoreDoAeroporto = raizTransparente ? raizTransparente.filhas : arvoreBruta;
  // Endereços antigos que apontem para a raiz transparente caem no próprio aeroporto.
  useEffect(() => {
    if (raizTransparente && pastaSel === raizTransparente.id) actualizar({ pasta: '' }, { replace: true });
  }, [raizTransparente, pastaSel, actualizar]);
  const caminhoVisivel = useMemo(() => (raizTransparente ? caminho.filter(p => p.id !== raizTransparente.id) : caminho), [caminho, raizTransparente]);
  const subpastas = useMemo(() => {
    if (!aeroSel) return [];
    if (pastaActual) {
      // a árvore guarda as filhas; procura o nó correspondente para reaproveitar contagens
      const encontrar = (lista) => { for (const n of lista) { if (n.id === pastaActual.id) return n; const r = encontrar(n.filhas || []); if (r) return r; } return null; };
      return (encontrar(arvoreDoAeroporto)?.filhas) || [];
    }
    return arvoreDoAeroporto;
  }, [aeroSel, pastaActual, arvoreDoAeroporto]);

  // Estrutura do dossier: secção de cada documento do aeroporto (guardada em estrutura_ref ou pelas regras).
  const docsDoAero = useMemo(() => (aeroSel ? docs.filter(d => chaveAero(aeroDoDoc(d)) === aeroSel) : []), [aeroSel, docs, aeroDoDoc]);
  // Cada documento pode estar em várias secções (a casa + réplicas): conta uma vez por secção e uma vez por dossier.
  const seccaoDe = useMemo(() => { const m = new Map(); for (const d of docsDoAero) m.set(d.id, seccoesDoDocumento(d)); return m; }, [docsDoAero]);
  const contagemSeccoes = useMemo(() => {
    const m = {};
    for (const refs of seccaoDe.values()) {
      for (const ref of refs) m[ref] = (m[ref] || 0) + 1;
      for (const dossier of new Set(refs.map(r => r.split(':')[0]))) m[dossier] = (m[dossier] || 0) + 1;
    }
    return m;
  }, [seccaoDe]);
  // O PSA só aparece a quem vê documentos AVSEC (a parede de acesso já os esconde aos outros).
  // Só pela casa dos documentos: uma réplica (ex.: o mapa do PEA no PCA) não abre a vista do PSA a quem não vê AVSEC.
  const estruturasVisiveis = useMemo(() => {
    const casas = new Set([...seccaoDe.values()].map(refs => refs[0].split(':')[0]));
    return Object.keys(ESTRUTURAS).filter(k => casas.has(k));
  }, [seccaoDe]);
  const seccaoActual = useMemo(() => {
    if (!est || !secSel) return null;
    for (const g of ESTRUTURAS[est].grupos) for (const x of g.seccoes) if (x.ref === secSel) return x;
    return null;
  }, [est, secSel]);
  const nomeEstrutura = est ? `Estrutura do ${est}` : '';
  const rotuloSeccao = seccaoActual ? `${secSel === '01' ? '' : secSel + ' · '}${seccaoActual.nome}` : '';

  // Âmbito da lista: por omissão a pasta com as subpastas (é o que um auditor espera), ou só a pasta se pedirem.
  const docsDoNivel = useMemo(() => {
    if (!aeroSel) return [];
    if (est) {
      const alvo = secSel ? `${est}:${secSel}` : null;
      // réplicas: o documento aparece aqui marcado com a sua casa (onde se revê), sem deixar de ser o mesmo
      return docsDoAero.flatMap(d => {
        const refs = seccaoDe.get(d.id) || [];
        const aqui = refs.filter(r => (alvo ? r === alvo : r.startsWith(`${est}:`)));
        if (!aqui.length) return [];
        return [aqui.includes(refs[0]) ? d : { ...d, replicaDe: refs[0] }];
      });
    }
    if (pastaSel) {
      if (semSub) return docsPorPasta.get(pastaSel) || [];
      const ids = subarvore(pastaSel);
      return docs.filter(d => d.pasta_id && ids.has(d.pasta_id));
    }
    const semPasta = (docsPorPasta.get('') || []).filter(d => chaveAero(aeroDoDoc(d)) === aeroSel);
    if (semSub) return semPasta;
    return docs.filter(d => chaveAero(aeroDoDoc(d)) === aeroSel);
  }, [aeroSel, pastaSel, semSub, docs, docsPorPasta, subarvore, aeroDoDoc, est, secSel, docsDoAero, seccaoDe]);

  // Filtros: cada um aplicado por si, para as fichas poderem contar «quantos daria este valor».
  const t = texto.trim().toLowerCase();
  const passaTexto = useCallback((d) => !t || `${d.titulo || ''} ${d.numero || ''} ${d.descricao || ''}`.toLowerCase().includes(t), [t]);
  const base = useMemo(() => docsDoNivel.filter(passaTexto), [docsDoNivel, passaTexto]);

  // Cada filtro é um teste com nome. Assim a lista final é a conjunção de todos, e a contagem de cada ficha é a
  // conjunção de todos MENOS o seu — sem isto, uma ficha diria sempre o total e deixaria de ser uma previsão.
  const testes = useMemo(() => ({
    tipo: (d) => correspondeTipo(d, fTipo),
    estado: (d) => !fEstado || d.estado === fEstado,
    validade: (d) => correspondeValidade(d, fValidade),
    manual: (d) => correspondeProcesso(d, fManual),
    classe: (d) => correspondeClasse(d, fClasse),
  }), [fTipo, fEstado, fValidade, fManual, fClasse]);
  const excepto = useCallback((chave) => {
    const outros = Object.entries(testes).filter(([k]) => k !== chave).map(([, fn]) => fn);
    return base.filter(d => outros.every(fn => fn(d)));
  }, [base, testes]);

  const filtrados = useMemo(() => base.filter(d => Object.values(testes).every(fn => fn(d))), [base, testes]);

  const contar = useCallback((lista, teste) => lista.reduce((n, d) => n + (teste(d) ? 1 : 0), 0), []);
  const fichasEstado = useMemo(() => {
    const lista = excepto('estado');
    return ESTADOS_DOCUMENTO.map(e => ({ value: e.chave, label: e.label, total: contar(lista, d => d.estado === e.chave) }));
  }, [excepto, contar]);
  const fichasValidade = useMemo(() => {
    const lista = excepto('validade');
    return OPCOES_VALIDADE.filter(o => o.value).map(o => ({ value: o.value, label: o.label, total: contar(lista, d => correspondeValidade(d, o.value)) }));
  }, [excepto, contar]);
  const fichasTipo = useMemo(() => {
    const lista = excepto('tipo');
    const semTipo = contar(lista, d => !d.tipo_id);
    const lst = (tiposQ.data || []).map(x => ({ value: x.id, label: x.nome, total: contar(lista, d => d.tipo_id === x.id) }));
    return semTipo > 0 || fTipo === SEM_TIPO ? [...lst, { value: SEM_TIPO, label: 'Sem tipo', total: semTipo }] : lst;
  }, [excepto, fTipo, tiposQ.data, contar]);
  const fichasManual = useMemo(() => fichasCodigo(excepto('manual'), cod.processos, 'processo_codigo'), [excepto, cod.processos]);
  const fichasClasse = useMemo(() => fichasCodigo(excepto('classe'), cod.classes, 'classe_codigo'), [excepto, cod.classes]);

  const rotuloDe = (lista, v) => lista.find(o => o.value === v)?.label || v;
  const aplicados = [
    t && { chave: 'f', rotulo: `Texto: «${texto}»`, aoRemover: () => { setCaixa(''); actualizar({ f: '' }); } },
    fEstado && { chave: 'estado', rotulo: `Estado: ${ESTADO_LABEL[fEstado] || fEstado}`, aoRemover: () => actualizar({ estado: '' }) },
    fValidade && { chave: 'validade', rotulo: rotuloDe(OPCOES_VALIDADE, fValidade), aoRemover: () => actualizar({ validade: '' }) },
    fTipo && { chave: 'tipo', rotulo: `Tipo: ${fTipo === SEM_TIPO ? 'sem tipo' : (rotuloTipo(mapaTipos, fTipo) || fTipo)}`, aoRemover: () => actualizar({ tipo: '' }) },
    fManual && { chave: 'manual', rotulo: `Manual: ${rotuloCodigo(cod.mapaProcessos, fManual)}`, aoRemover: () => actualizar({ manual: '' }) },
    fClasse && { chave: 'classe', rotulo: `Classe: ${rotuloCodigo(cod.mapaClasses, fClasse)}`, aoRemover: () => actualizar({ classe: '' }) },
    semSub && { chave: 'sub', rotulo: pastaSel ? 'Só nesta pasta' : 'Só os documentos sem pasta', aoRemover: () => actualizar({ sub: '' }) },
  ].filter(Boolean);
  const comFiltros = aplicados.some(f => f.chave !== 'sub');
  const limparTudo = () => { setCaixa(''); actualizar({ tipo: '', estado: '', validade: '', manual: '', classe: '', f: '' }); };

  const ordenados = useMemo(() => ordenarDocs(filtrados, ordem, dir), [filtrados, ordem, dir]);
  const paginas = Math.max(1, Math.ceil(ordenados.length / POR_PAGINA));
  const pag = Math.min(pagina, paginas);
  const inicio = (pag - 1) * POR_PAGINA;
  const visiveis = ordenados.slice(inicio, inicio + POR_PAGINA);

  const docSel = useMemo(() => (selId ? docs.find(d => d.id === selId) || null : null), [selId, docs]);
  // Clicar num documento abre-o (a ficha com o leitor) — é o que se espera de uma biblioteca. Ctrl/⌘+clique abre
  // noutro separador. O painel lateral antigo só aparece se um endereço antigo trouxer ?sel=.
  const seleccionar = (id, e) => abrirDocumento(navigate, id, e);

  // Por omissão as pastas do caminho actual estão abertas; o clique na seta manda por cima disso.
  const caminhoIds = useMemo(() => new Set(caminho.map(p => p.id)), [caminho]);
  const noAberto = useCallback((id) => (id in estadoNos ? estadoNos[id] : caminhoIds.has(id)), [estadoNos, caminhoIds]);
  const alternarNo = (id) => setEstadoNos(prev => ({ ...prev, [id]: !(id in prev ? prev[id] : caminhoIds.has(id)) }));
  const subirNivel = () => {
    if (est) { if (secSel) escolherEstrutura(est, ''); else escolher(aeroSel, ''); return; }
    if (pastaActual) escolher(aeroSel, pastaActual.pasta_pai_id || '');
    else escolher(null, null);
  };

  // O que a lista está a mostrar, dito em palavras ao lado do título da secção.
  const ambito = est
    ? (seccaoActual ? `${nomeEstrutura} · ${rotuloSeccao}` : `${nomeEstrutura}, todas as secções`)
    : pastaActual
    ? `${pastaActual.nome}${semSub ? '' : ' e subpastas'}`
    : (semSub ? `${aeroActual?.codigo || 'aeroporto'}, só o que não está em pasta` : `todo o ${aeroActual?.codigo || 'aeroporto'}`);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className={cn('text-2xl font-bold tracking-tight', tk.tinta)}>Biblioteca</h1>
          <p className={cn('mt-1 text-sm', tk.tintaFraca)}>Manuais, procedimentos e normas organizados por aeroporto e por pasta.</p>
        </div>
        <Button asChild variant="outline"><Link to={`${PORTAL_BASE}/pesquisa`}><Search className="h-4 w-4" aria-hidden="true" />Pesquisar em tudo</Link></Button>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Migalhas caminho={caminhoVisivel} aeroporto={aeroActual} aoEscolher={escolher}
          estrutura={est ? { nome: nomeEstrutura, seccao: rotuloSeccao, aoAbrirRaiz: () => escolherEstrutura(est, '') } : null} />
        {(aeroSel || pastaSel || est) && (
          <Button variant="ghost" size="sm" className="lg:hidden" onClick={subirNivel}><ArrowLeft className="h-4 w-4" aria-hidden="true" />Voltar</Button>
        )}
      </div>

      {falhou ? (
        <div className={cartao}><Falha onTentar={recarregar} /></div>
      ) : !aeroSel ? (
        /* ── Nível 1: escolher o aeroporto ───────────────────────────── */
        aCarregar ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}</div>
        ) : aeroportos.length === 0 ? (
          <div className={cartao}><Vazio icone={FolderTree} titulo="Ainda não há documentos para consultar" texto="Quando a gestão documental publicar os primeiros manuais e procedimentos dos seus aeroportos, eles aparecem aqui." /></div>
        ) : (
          <>
            <p className={cn('text-sm', tk.tintaFraca)}>Escolha o aeroporto para ver as pastas.</p>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {aeroportos.map(a => (
                <button key={a.chave} type="button" onClick={() => escolher(a.chave, null)} className={cn(cartao, 'flex items-center gap-4 p-5 text-left transition-shadow hover:shadow-md', tk.foco)}>
                  <span className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl', tk.acentoFundo, tk.acento)}><Building2 className="h-6 w-6" aria-hidden="true" /></span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-lg font-semibold', tk.tinta)}>{a.codigo}</span>
                    <span className={cn('block truncate text-sm', tk.tintaFraca)}>{a.nome}</span>
                    <span className={cn('mt-1 block text-sm tabular-nums', tk.tintaTenue)}>{a.docs === 1 ? '1 documento' : `${a.docs} documentos`} · {a.pastas === 1 ? '1 pasta' : `${a.pastas} pastas`}</span>
                  </span>
                  <ChevronRight className={cn('h-5 w-5 shrink-0', tk.tintaTenue)} aria-hidden="true" />
                </button>
              ))}
            </div>
          </>
        )
      ) : (
        /* ── Níveis seguintes: árvore + tabela + painel lateral ───────── */
        <div className={cn('lg:grid lg:gap-6', docSel
          ? 'lg:grid-cols-[17rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)_21rem]'
          : 'lg:grid-cols-[17rem_minmax(0,1fr)]')}
        >
          <aside className="hidden lg:block">
            <nav aria-label="Pastas" className={cn(cartao, 'p-2 lg:sticky lg:top-[var(--topo-fixo,1.5rem)]')}>
              <p className={cn('px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider', tk.tintaFraca)}>{aeroActual?.codigo || 'Pastas'}</p>
              <button type="button" onClick={() => escolher(aeroSel, '')} aria-current={!pastaSel && !est ? 'true' : undefined} className={cn('flex min-h-[2.75rem] w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm', tk.foco, !pastaSel && !est ? cn(tk.acentoFundo, tk.acento, 'font-semibold') : cn(tk.tintaMedia, tk.hover))}>
                <Library className="h-4 w-4 shrink-0" aria-hidden="true" />Todos deste aeroporto
              </button>
              {pastasQ.isLoading ? (
                <div className="space-y-2 p-2">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-8 w-full" />)}</div>
              ) : arvoreDoAeroporto.length === 0 ? (
                <p className={cn('px-3 py-4 text-sm', tk.tintaFraca)}>Este aeroporto ainda não tem pastas.</p>
              ) : (
                <ul className="mt-1 space-y-0.5">
                  {arvoreDoAeroporto.map(p => <NoArvore key={p.id} no={p} pastaSel={pastaSel} aberto={noAberto} alternar={alternarNo} aoEscolher={(id) => escolher(aeroSel, id)} contar={contarComFilhas} />)}
                </ul>
              )}
              {estruturasVisiveis.length > 0 && (
                <div className={cn('mt-2 border-t pt-2', tk.borda)}>
                  <p className={cn('px-3 pb-1 pt-1 text-xs font-semibold uppercase tracking-wider', tk.tintaFraca)}>Estrutura do dossier</p>
                  <ul className="space-y-0.5">
                    {estruturasVisiveis.map(k => (
                      <li key={k}>
                        <button type="button" onClick={() => escolherEstrutura(k, '')} aria-current={est === k && !secSel ? 'true' : undefined}
                          className={cn('flex min-h-[2.5rem] w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm', tk.foco,
                            est === k && !secSel ? cn(tk.acentoFundo, tk.acento, 'font-semibold') : cn(tk.tintaMedia, tk.hover))}>
                          <BookMarked className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span className="truncate">Estrutura do {k}</span>
                          <span className={cn('ml-auto shrink-0 text-xs tabular-nums', tk.tintaTenue)}>{contagemSeccoes[k]}</span>
                        </button>
                        {est === k && (
                          <ul className="mb-1 space-y-0.5">
                            {ESTRUTURAS[k].grupos.flatMap(g => g.seccoes).filter(x => contagemSeccoes[`${k}:${x.ref}`]).map(x => (
                              <li key={x.ref}>
                                <button type="button" onClick={() => escolherEstrutura(k, x.ref)} aria-current={secSel === x.ref ? 'true' : undefined} title={x.nome}
                                  className={cn('flex min-h-[2.25rem] w-full items-center gap-2 rounded-lg py-1.5 pl-6 pr-3 text-left text-sm', tk.foco,
                                    secSel === x.ref ? cn(tk.acentoFundo, tk.acento, 'font-semibold') : cn(tk.tintaMedia, tk.hover))}>
                                  <span className="w-11 shrink-0 text-xs font-semibold tabular-nums">{x.ref}</span>
                                  <span className="truncate">{x.nome}</span>
                                  <span className={cn('ml-auto shrink-0 text-xs tabular-nums', tk.tintaTenue)}>{contagemSeccoes[`${k}:${x.ref}`]}</span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </nav>
          </aside>

          <div className={cn('mt-5 min-w-0 space-y-4 lg:mt-0', docSel && 'pb-[64vh] xl:pb-0')}>
            {/* subpastas do nível actual — cartões, porque aqui a decisão é «onde entrar» */}
            {est && !secSel && (
              <section className="space-y-5">
                <p className={cn('text-sm', tk.tintaFraca)}>
                  {ESTRUTURAS[est].nome}, organizado como o dossier entregue à ANAC. É só uma forma de navegar: cada documento continua na sua pasta, com o mesmo número, versões e acessos.
                </p>
                {ESTRUTURAS[est].grupos.map(g => (
                  <div key={g.chave}>
                    <h2 className={cn('mb-3 text-sm font-semibold uppercase tracking-wide', tk.tintaFraca)}>{g.nome}</h2>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {g.seccoes.map(x => <CartaoSeccao key={x.ref} seccao={x} total={contagemSeccoes[`${est}:${x.ref}`] || 0} aoAbrir={(ref) => escolherEstrutura(est, ref)} />)}
                    </div>
                  </div>
                ))}
              </section>
            )}
            {!est && !pastaSel && estruturasVisiveis.length > 0 && (
              <section>
                <h2 className={cn('mb-3 text-sm font-semibold uppercase tracking-wide', tk.tintaFraca)}>Estrutura do dossier</h2>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {estruturasVisiveis.map(k => (
                    <button key={k} type="button" onClick={() => escolherEstrutura(k, '')} className={cn(cartao, 'flex min-h-[4.5rem] w-full items-center gap-3 p-4 text-left transition-shadow hover:shadow-md', tk.foco)}>
                      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', tk.acentoFundo, tk.acento)}><BookMarked className="h-5 w-5" aria-hidden="true" /></span>
                      <span className="min-w-0 flex-1">
                        <span className={cn('block font-medium', tk.tinta)}>Estrutura do {k}</span>
                        <span className={cn('mt-0.5 block text-sm', tk.tintaTenue)}>Manual, anexos e apêndices · {contagemSeccoes[k]} documentos</span>
                      </span>
                      <ChevronRight className={cn('h-4 w-4 shrink-0', tk.tintaTenue)} aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </section>
            )}
            {!est && subpastas.length > 0 && (
              <section>
                <h2 className={cn('mb-3 text-sm font-semibold uppercase tracking-wide', tk.tintaFraca)}>Pastas</h2>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {subpastas.map(p => <CartaoPasta key={p.id} pasta={p} total={contarComFilhas(p)} aoAbrir={(id) => escolher(aeroSel, id)} />)}
                </div>
              </section>
            )}

            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className={cn('min-w-0 text-sm font-semibold uppercase tracking-wide', tk.tintaFraca)}>
                  Documentos<span className="normal-case"> · {ambito}</span>
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  <ComutadorDensidade valor={densidade} aoMudar={mudarDensidade} />
                  <div className={cn('flex items-center gap-0.5 rounded-lg border p-0.5', tk.borda)} role="group" aria-label="Forma de apresentação">
                    {[{ v: 'tabela', Icone: Table2, label: 'Tabela' }, { v: 'grelha', Icone: LayoutGrid, label: 'Grelha' }].map(({ v, Icone, label }) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => actualizar({ vista: v === 'tabela' ? '' : v })}
                        aria-pressed={vista === v}
                        className={cn('flex min-h-[2.25rem] items-center gap-1.5 rounded-md px-2 text-sm', tk.foco,
                          vista === v ? cn(tk.acentoFundo, tk.acento, 'font-semibold') : cn(tk.tintaFraca, 'hover:text-slate-900 dark:hover:text-white'))}
                      >
                        <Icone className="h-4 w-4" aria-hidden="true" />{label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* filtrar: caixa de texto + fichas com contagem */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[14rem] flex-1">
                  <Search className={cn('pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2', tk.tintaTenue)} aria-hidden="true" />
                  <Input value={caixa} onChange={e => setCaixa(e.target.value)} placeholder="Filtrar por título ou número…" aria-label="Filtrar os documentos desta lista" className="h-11 pl-9" />
                </div>
                <Button variant="outline" onClick={() => setFiltrosAbertos(v => !v)} aria-expanded={filtrosAbertos} aria-controls="gd-fichas-filtro" className="h-11">
                  <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />Filtros
                  {aplicados.length > 0 && <span className={cn('ml-1 rounded-full px-1.5 text-xs font-semibold tabular-nums', tk.acentoFundo, tk.acento)}>{aplicados.length}</span>}
                  <ChevronDown className={cn('h-4 w-4 transition-transform', filtrosAbertos && 'rotate-180')} aria-hidden="true" />
                </Button>
              </div>

              {filtrosAbertos && (
                <div id="gd-fichas-filtro" className={cn(cartao, 'space-y-3 p-4')}>
                  <FichasFiltro titulo="Estado" opcoes={fichasEstado} valor={fEstado} aoEscolher={v => actualizar({ estado: v })} />
                  <FichasFiltro titulo="Validade" opcoes={fichasValidade} valor={fValidade} aoEscolher={v => actualizar({ validade: v })} />
                  <FichasFiltro titulo="Tipo" opcoes={fichasTipo} valor={fTipo} aoEscolher={v => actualizar({ tipo: v })} />
                  {/* as duas dimensões do número: de que manual faz parte, e o que o documento é */}
                  <FichasFiltro titulo="Manual" opcoes={fichasManual} valor={fManual} aoEscolher={v => actualizar({ manual: v })} />
                  <FichasFiltro titulo="Classe" opcoes={fichasClasse} valor={fClasse} aoEscolher={v => actualizar({ classe: v })} />
                  <label className={cn('flex min-h-[2.75rem] w-fit items-center gap-2 text-sm', tk.tintaMedia)}>
                    <input type="checkbox" checked={!semSub} onChange={e => actualizar({ sub: e.target.checked ? '' : '0' })} className="h-4 w-4 rounded border-slate-300 text-teal-700 dark:border-slate-600" />
                    {pastaSel ? 'Incluir os documentos das subpastas' : 'Incluir os documentos de todas as pastas do aeroporto'}
                  </label>
                </div>
              )}

              <ResumoFiltros aplicados={aplicados} aoLimparTudo={limparTudo} />

              {/* contagem real, nunca «vários resultados» */}
              {!aCarregar && ordenados.length > 0 && (
                <p className={cn('text-sm tabular-nums', tk.tintaFraca)} role="status">
                  {inicio + 1}-{Math.min(inicio + POR_PAGINA, ordenados.length)} de {ordenados.length}
                  {comFiltros && ordenados.length !== docsDoNivel.length ? ` (${docsDoNivel.length} sem filtros)` : ''}
                </p>
              )}

              {aCarregar ? (
                <div className={cartao}><EsqueletoTabela altura={alturaDensidade(densidade)} /></div>
              ) : visiveis.length === 0 ? (
                <div className={cartao}>
                  {docsDoNivel.length === 0
                    ? <Vazio icone={FileText} titulo="Ainda não há documentos neste âmbito" texto={subpastas.length > 0 ? 'Abra uma das pastas acima, ou use «Todos deste aeroporto» para ver tudo de uma vez.' : 'Quando a gestão documental publicar aqui um documento, ele aparece nesta lista.'} />
                    : (
                      <Vazio icone={Search} titulo="Nenhum documento corresponde aos filtros" texto="Os filtros aplicados não deixam passar nada deste âmbito.">
                        <div className="flex flex-wrap justify-center gap-2">
                          <Button variant="outline" onClick={limparTudo}><X className="h-4 w-4" aria-hidden="true" />Limpar tudo</Button>
                          <Button asChild variant="ghost"><Link to={`${PORTAL_BASE}/pesquisa${texto ? `?q=${encodeURIComponent(texto)}` : ''}`}><Search className="h-4 w-4" aria-hidden="true" />Pesquisar em todo o portal</Link></Button>
                        </div>
                      </Vazio>
                    )}
                </div>
              ) : vista === 'grelha' ? (
                <ListaDocumentos docs={visiveis} tipos={mapaTipos} aeroportos={mapaAero} termo={texto} vista="grelha" mostrarAeroporto={!pastaSel} />
              ) : (
                <div className={cartao}>
                  <TabelaDocumentos
                    docs={visiveis}
                    tipos={mapaTipos}
                    aeroportos={mapaAero}
                    termo={texto}
                    densidade={densidade}
                    ordem={ordem}
                    dir={dir}
                    aoOrdenar={ordenarPor}
                    seleccionado={selId}
                    aoSeleccionar={seleccionar}
                    esconder={docSel ? ['responsavel', 'actualizado'] : []}
                    mostrarAeroporto={!pastaSel}
                    idPainel={undefined}
                  />
                </div>
              )}

              {paginas > 1 && (
                <nav aria-label="Páginas de resultados" className="flex flex-wrap items-center justify-between gap-2">
                  <Button variant="outline" disabled={pag <= 1} onClick={() => actualizar({ pag: String(pag - 1) })}>
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />Anteriores
                  </Button>
                  <p className={cn('text-sm tabular-nums', tk.tintaFraca)}>Página {pag} de {paginas}</p>
                  <Button variant="outline" disabled={pag >= paginas} onClick={() => actualizar({ pag: String(pag + 1) })}>
                    Seguintes<ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </nav>
              )}
            </section>
          </div>

          {docSel && (
            <PainelDocumento
              id="gd-painel"
              doc={docSel}
              tipos={mapaTipos}
              aeroportos={mapaAero}
              pastas={mapaPastas}
              aoFechar={() => actualizar({ sel: '', pag: String(pag) }, { replace: true })}
            />
          )}
        </div>
      )}
    </div>
  );
}
