// Editor TipTap de uma secção do documento estruturado, limitado aos nós e marcas do contrato
// (src/documentos/edicao/contrato.js; extensões em extensoes.js): parágrafo, títulos 2-4 (numerados enquanto se
// escreve), alinhamento, listas até 3 níveis, caixas Nota/Atenção/Aviso, tabela (com legenda, juntar/separar
// células), galeria «Fotos lado a lado» (fotos em grelha sem bordas), imagem (com legenda), quebra de página, linha horizontal; negrito, itálico, sublinhado. Sem fontes,
// tamanhos nem cores livres (padrão SGA). Procurar e substituir (Ctrl+F / Ctrl+H), contagem de palavras e ecrã
// inteiro. Colar do Word passa por limparHtmlColado; imagens entram como data: URL JPEG reduzida (≤ 1600 px).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import {
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Heading2, Heading3, Heading4, Pilcrow,
  Table as TableIcon, ImagePlus, Minus, Undo2, Redo2, Trash2, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  IndentIncrease, IndentDecrease, Info, TriangleAlert, OctagonAlert, ChevronDown, ChevronUp, SeparatorHorizontal,
  Search, Maximize2, Minimize2, BetweenHorizontalStart, BetweenHorizontalEnd, BetweenVerticalStart,
  BetweenVerticalEnd, TableCellsMerge, TableCellsSplit, PanelTop, Captions, X, Replace, ReplaceAll, SquareDashed, Images,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { limparHtmlColado } from './limparColagem';
import { imagemDeFicheiro, reduzirImagemSrc, LIMITE_DATA_URL } from './imagens';
import { docVazio, NIVEIS_LISTA_MAX, FOTOS_POR_LINHA } from './contrato';
import { extensoesContrato, nivelListaNaSeleccao, emGaleria as selEmGaleria } from './extensoes';
import { normalizarNiveisTitulos } from './comum';
import {
  Procurar, definirTermo, irParaOcorrencia, substituirActual, substituirTodas, estadoProcurar, contarPalavras,
} from './procurar';

export { extensoesContrato };

// Ícones das caixas (SVG lucide em data: URL, cor fixa por tipo).
const icone = (cor, corpo) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='${cor}' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'>${corpo}</svg>`)}")`;
const ICONE_NOTA = icone('#1d4ed8', "<circle cx='12' cy='12' r='10'/><path d='M12 16v-4'/><path d='M12 8h.01'/>");
const ICONE_ATENCAO = icone('#b45309', "<path d='m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3'/><path d='M12 9v4'/><path d='M12 17h.01'/>");
const ICONE_AVISO = icone('#b91c1c', "<path d='M12 16h.01'/><path d='M12 8v4'/><path d='M15.312 2a2 2 0 0 1 1.414.586l4.688 4.688A2 2 0 0 1 22 8.688v6.624a2 2 0 0 1-.586 1.414l-4.688 4.688a2 2 0 0 1-1.414.586H8.688a2 2 0 0 1-1.414-.586l-4.688-4.688A2 2 0 0 1 2 15.312V8.688a2 2 0 0 1 .586-1.414l4.688-4.688A2 2 0 0 1 8.688 2z'/>");

// Estilo do texto no editor e na pré-visualização (o projecto não tem o plugin de tipografia do Tailwind).
// Numeração dos títulos: um antepassado .gd-numerar com --gd-sec: "4" → «4.1», «4.1.1» (como numerarTitulos).
// Legendas: um antepassado com counter-reset: gd-fig N gd-tab M (continua a numeração das secções anteriores).
export const ESTILO_PROSA = `
.prose-gd { line-height: 1.6; font-size: 0.95rem; }
.prose-gd > * + * { margin-top: 0.6em; }
.prose-gd h2 { font-size: 1.2rem; font-weight: 700; margin-top: 1em; }
.prose-gd h3 { font-size: 1.05rem; font-weight: 700; margin-top: 0.9em; }
.prose-gd h4 { font-size: 0.95rem; font-weight: 700; font-style: italic; margin-top: 0.8em; }
.gd-numerar .prose-gd { counter-reset: gd-h2 gd-h3 gd-h4; }
.gd-numerar .prose-gd > h2, .gd-numerar .prose-gd > blockquote > h2 { counter-increment: gd-h2; counter-set: gd-h3 0 gd-h4 0; }
.gd-numerar .prose-gd > h3, .gd-numerar .prose-gd > blockquote > h3 { counter-increment: gd-h3; counter-set: gd-h4 0; }
.gd-numerar .prose-gd > h4, .gd-numerar .prose-gd > blockquote > h4 { counter-increment: gd-h4; }
.gd-numerar .prose-gd > h2::before, .gd-numerar .prose-gd > blockquote > h2::before { content: var(--gd-sec) "." counter(gd-h2) "\\00a0\\00a0"; }
.gd-numerar .prose-gd > h3::before, .gd-numerar .prose-gd > blockquote > h3::before { content: var(--gd-sec) "." counter(gd-h2) "." counter(gd-h3) "\\00a0\\00a0"; }
.gd-numerar .prose-gd > h4::before, .gd-numerar .prose-gd > blockquote > h4::before { content: var(--gd-sec) "." counter(gd-h2) "." counter(gd-h3) "." counter(gd-h4) "\\00a0\\00a0"; }
.gd-numerar .prose-gd h2::before, .gd-numerar .prose-gd h3::before, .gd-numerar .prose-gd h4::before { color: #0f766e; font-style: normal; font-variant-numeric: tabular-nums; }
.prose-gd ul { list-style: disc; padding-left: 1.5em; }
.prose-gd ol { list-style: decimal; padding-left: 1.5em; }
.prose-gd :is(ul,ol) :is(ul,ol) { margin-top: .15em; }
.prose-gd :is(ul,ol) ol { list-style-type: lower-alpha; }
.prose-gd :is(ul,ol) ol > li::marker { content: counter(list-item, lower-alpha) ") "; }
.prose-gd :is(ul,ol) :is(ul,ol) ol { list-style-type: lower-roman; }
.prose-gd :is(ul,ol) :is(ul,ol) ol > li::marker { content: counter(list-item, lower-roman) ". "; }
.prose-gd :is(ul,ol) ul > li::marker { content: "\\2013\\00a0 "; }
.prose-gd :is(ul,ol) :is(ul,ol) ul > li::marker { content: "\\25aa\\00a0 "; }
.prose-gd li > p { margin: 0; }
.prose-gd blockquote { position: relative; border-left: 4px solid #2563eb; background: rgba(37,99,235,.07); padding: 1.9em .9em .55em; border-radius: 0 .375rem .375rem 0; }
.prose-gd blockquote::before { content: "Nota"; position: absolute; top: .5em; left: .9em; padding-left: 1.35em; font-size: .72rem; line-height: 1rem; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: #1d4ed8; background: ${ICONE_NOTA} no-repeat left center / 1rem 1rem; }
.prose-gd blockquote[data-tipo="atencao"] { border-left-color: #d97706; background: rgba(245,158,11,.10); }
.prose-gd blockquote[data-tipo="atencao"]::before { content: "Atenção"; color: #b45309; background-image: ${ICONE_ATENCAO}; }
.prose-gd blockquote[data-tipo="aviso"] { border-left-color: #dc2626; background: rgba(220,38,38,.07); }
.prose-gd blockquote[data-tipo="aviso"]::before { content: "Aviso"; color: #b91c1c; background-image: ${ICONE_AVISO}; }
.prose-gd hr { border: 0; border-top: 1px solid #cbd5e1; margin: 1em 0; }
.prose-gd table { border-collapse: collapse; width: 100%; table-layout: fixed; }
.prose-gd th, .prose-gd td { border: 1px solid #cbd5e1; padding: .35em .5em; vertical-align: top; }
.prose-gd th { background: rgba(15,118,110,.08); font-weight: 600; text-align: left; }
.prose-gd table > caption { caption-side: top; counter-increment: gd-tab; text-align: left; font-size: .85rem; padding: 0 0 .3em; color: #334155; }
.prose-gd table > caption::before { content: "Tabela " counter(gd-tab) " \\2014  "; font-weight: 700; }
.prose-gd img { max-width: 100%; height: auto; display: block; margin: .5em 0; }
.prose-gd figure.gd-figura { counter-increment: gd-fig; margin: .5em 0; }
.prose-gd figure.gd-figura img { margin: 0; }
.prose-gd figure.gd-figura figcaption { font-size: .85rem; color: #334155; text-align: center; padding-top: .3em; }
.prose-gd figure.gd-figura figcaption::before { content: "Figura " counter(gd-fig) " \\2014  "; font-weight: 700; }
.prose-gd table.gd-fotos { border-collapse: separate; border-spacing: .9rem .4rem; margin-left: -.9rem; width: calc(100% + 1.8rem); }
.prose-gd table.gd-fotos td, .prose-gd table.gd-fotos th { border: 0; padding: 0; background: none; font-weight: normal; vertical-align: top; text-align: center; }
.prose-gd table.gd-fotos img { margin: 0 auto; }
.prose-gd table.gd-fotos img:not([width]) { width: 100%; }
.prose-gd table.gd-fotos td > p { font-size: .85rem; text-align: center; }
.prose-gd table.gd-fotos figure.gd-figura { margin: 0; }
.ProseMirror[contenteditable="true"] table.gd-fotos { outline: 1px dashed #cbd5e1; outline-offset: .25rem; }
.ProseMirror[contenteditable="true"] table.gd-fotos td { outline: 1px dashed #e2e8f0; min-height: 4rem; height: 4rem; }
.ProseMirror[contenteditable="true"] table.gd-fotos td:not(:has(img)) > p:only-child:has(> br:only-child)::before { content: "Clique aqui e use «Inserir imagem»"; color: #94a3b8; font-size: .75rem; pointer-events: none; }
.ProseMirror[contenteditable="true"] table.gd-fotos td:not(:has(img)) > p:only-child:has(> br:only-child) { display: flex; align-items: center; justify-content: center; min-height: 4rem; margin: 0; }
.prose-gd img.ProseMirror-selectednode, .prose-gd figure.ProseMirror-selectednode img { outline: 3px solid #0f766e; }
.prose-gd .selectedCell { background: rgba(15,118,110,.12); }
.prose-gd .gd-quebra-pagina { display: flex; align-items: center; gap: .75em; margin: 1.1em 0; color: #64748b; font-size: .7rem; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; user-select: none; }
.prose-gd .gd-quebra-pagina::before, .prose-gd .gd-quebra-pagina::after { content: ""; flex: 1; border-top: 2px dashed #94a3b8; }
.prose-gd .gd-quebra-pagina.ProseMirror-selectednode { outline: 2px solid #0f766e; outline-offset: 2px; }
.prose-gd .gd-achado { background: rgba(250,204,21,.45); border-radius: 2px; }
.prose-gd .gd-achado-actual { background: rgba(249,115,22,.55); box-shadow: 0 0 0 1px rgba(194,65,12,.7); }
.prose-gd p.is-editor-empty:first-child::before { content: attr(data-placeholder); color: #94a3b8; float: left; height: 0; pointer-events: none; }
`;

function BotaoBarra({ activo, onClick, titulo, children, disabled, className }) {
  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      aria-pressed={activo === undefined ? undefined : !!activo}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 min-w-8 items-center justify-center gap-0.5 rounded-md px-1.5 text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800',
        activo && 'bg-teal-50 text-teal-900 dark:bg-teal-950/60 dark:text-teal-100',
        className,
      )}
    >{children}</button>
  );
}
const Sep = () => <span className="mx-1 h-6 w-px bg-slate-200 dark:bg-slate-700" aria-hidden="true" />;

const CAIXAS = [
  { tipo: 'nota', rotulo: 'Nota', Icone: Info, cor: 'text-blue-700' },
  { tipo: 'atencao', rotulo: 'Atenção', Icone: TriangleAlert, cor: 'text-amber-700' },
  { tipo: 'aviso', rotulo: 'Aviso', Icone: OctagonAlert, cor: 'text-red-700' },
];

const GRELHA_MAX = 8;

/** Escolha de linhas × colunas para inserir uma tabela. */
function EscolherTabela({ onEscolher }) {
  const [aberto, setAberto] = useState(false);
  const [sobre, setSobre] = useState({ l: 3, c: 3 });
  const [linhas, setLinhas] = useState(3);
  const [colunas, setColunas] = useState(3);
  const escolher = (l, c) => { setAberto(false); onEscolher(Math.max(1, Math.min(50, l)), Math.max(1, Math.min(12, c))); };
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          type="button" title="Inserir tabela" aria-label="Inserir tabela"
          className="inline-flex h-8 items-center justify-center gap-0.5 rounded-md px-1.5 text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        ><TableIcon className="h-4 w-4" /><ChevronDown className="h-3 w-3 opacity-60" /></button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start" onCloseAutoFocus={(e) => e.preventDefault()}>
        <p className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-300">Inserir tabela · <span className="tabular-nums">{sobre.l} × {sobre.c}</span> <span className="text-slate-400">(linhas × colunas)</span></p>
        <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${GRELHA_MAX}, 1.1rem)` }} onMouseLeave={() => setSobre({ l: linhas, c: colunas })}>
          {Array.from({ length: GRELHA_MAX * GRELHA_MAX }, (_, k) => {
            const l = Math.floor(k / GRELHA_MAX) + 1;
            const c = (k % GRELHA_MAX) + 1;
            const dentro = l <= sobre.l && c <= sobre.c;
            return (
              <button
                key={k} type="button" aria-label={`${l} linhas × ${c} colunas`}
                onMouseEnter={() => setSobre({ l, c })} onFocus={() => setSobre({ l, c })}
                onClick={() => escolher(l, c)}
                className={cn('h-[1.1rem] w-[1.1rem] rounded-[3px] border', dentro ? 'border-teal-600 bg-teal-100 dark:bg-teal-900' : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800')}
              />
            );
          })}
        </div>
        <form className="mt-3 flex items-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-700" onSubmit={(e) => { e.preventDefault(); escolher(linhas, colunas); }}>
          <label className="text-xs text-slate-600 dark:text-slate-300">Linhas
            <Input type="number" min={1} max={50} value={linhas} onChange={(e) => setLinhas(Number(e.target.value) || 1)} className="mt-1 h-8 w-16" />
          </label>
          <label className="text-xs text-slate-600 dark:text-slate-300">Colunas
            <Input type="number" min={1} max={12} value={colunas} onChange={(e) => setColunas(Number(e.target.value) || 1)} className="mt-1 h-8 w-16" />
          </label>
          <Button type="submit" size="sm" className="h-8">Inserir</Button>
        </form>
        <p className="mt-2 text-[11px] text-slate-500">A primeira linha fica como cabeçalho.</p>
      </PopoverContent>
    </Popover>
  );
}

/** «Fotos lado a lado»: quantas fotos por linha (2 ou 3) e quantas linhas (1 a 3). */
function EscolherGaleria({ onEscolher }) {
  const [aberto, setAberto] = useState(false);
  const [colunas, setColunas] = useState(2);
  const [linhas, setLinhas] = useState(1);
  const opcao = (activo) => cn(
    'h-8 min-w-9 rounded-md border px-2 text-sm tabular-nums transition-colors',
    activo ? 'border-teal-600 bg-teal-50 font-semibold text-teal-900 dark:bg-teal-950/60 dark:text-teal-100' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200',
  );
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          type="button" title="Fotos lado a lado" aria-label="Fotos lado a lado"
          className="inline-flex h-8 items-center justify-center gap-0.5 rounded-md px-1.5 text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        ><Images className="h-4 w-4" /><ChevronDown className="h-3 w-3 opacity-60" /></button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start" onCloseAutoFocus={(e) => e.preventDefault()}>
        <p className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-300">Fotos lado a lado</p>
        <div className="space-y-2.5">
          <div role="group" aria-label="Fotos por linha" className="flex items-center gap-1.5">
            <span className="w-24 text-xs text-slate-600 dark:text-slate-300">Fotos por linha</span>
            {FOTOS_POR_LINHA.map((n) => (
              <button key={n} type="button" aria-pressed={colunas === n} className={opcao(colunas === n)} onClick={() => setColunas(n)}>{n}</button>
            ))}
          </div>
          <div role="group" aria-label="Linhas" className="flex items-center gap-1.5">
            <span className="w-24 text-xs text-slate-600 dark:text-slate-300">Linhas</span>
            {[1, 2, 3].map((n) => (
              <button key={n} type="button" aria-pressed={linhas === n} className={opcao(linhas === n)} onClick={() => setLinhas(n)}>{n}</button>
            ))}
          </div>
          {/* miniatura da grelha escolhida */}
          <div className="grid gap-1 rounded-md border border-dashed border-slate-300 p-1.5 dark:border-slate-600" style={{ gridTemplateColumns: `repeat(${colunas}, 1fr)` }} aria-hidden="true">
            {Array.from({ length: colunas * linhas }, (_, k) => <span key={k} className="h-5 rounded-sm bg-slate-200 dark:bg-slate-700" />)}
          </div>
          <Button type="button" size="sm" className="h-8 w-full" onClick={() => { setAberto(false); onEscolher(colunas, linhas); }}>
            Inserir {colunas * linhas} {colunas * linhas === 1 ? 'foto' : 'fotos'}
          </Button>
        </div>
        <p className="mt-2 text-[11px] leading-snug text-slate-500">Depois clique numa célula e use «Inserir imagem». Cada foto pode ter a sua legenda.</p>
      </PopoverContent>
    </Popover>
  );
}

/** Barra de procurar e substituir. */
function BarraProcurar({ editor, modo, setModo, onFechar, termoInicial }) {
  const [termo, setTermo] = useState(termoInicial || '');
  const [subst, setSubst] = useState('');
  const campoRef = useRef(null);
  const st = estadoProcurar(editor.state);
  const n = st.resultados.length;

  useEffect(() => { definirTermo(editor.view, termo); }, [editor, termo]);
  useEffect(() => { campoRef.current?.focus(); campoRef.current?.select(); }, [modo, termoInicial]);
  useEffect(() => { if (termoInicial) setTermo(termoInicial); }, [termoInicial]);

  const seguinte = () => irParaOcorrencia(editor.view, st.actual + 1);
  const anterior = () => irParaOcorrencia(editor.view, st.actual - 1);
  const teclas = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onFechar(); }
    else if (e.key === 'Enter' && e.currentTarget === campoRef.current) { e.preventDefault(); if (e.shiftKey) anterior(); else seguinte(); }
  };

  return (
    <div role="search" aria-label="Procurar no texto" className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 bg-white px-2 py-1.5 dark:border-slate-800 dark:bg-slate-900">
      <Search className="h-4 w-4 text-slate-400" aria-hidden="true" />
      <Input ref={campoRef} value={termo} onChange={(e) => setTermo(e.target.value)} onKeyDown={teclas} placeholder="Procurar…" aria-label="Procurar" className="h-8 w-56" />
      <span className="min-w-[4.5rem] text-xs tabular-nums text-slate-500" aria-live="polite">
        {termo ? (n ? `${st.actual + 1} de ${n}` : 'Sem resultados') : ''}
      </span>
      <BotaoBarra titulo="Anterior (Shift+Enter)" disabled={!n} onClick={anterior}><ChevronUp className="h-4 w-4" /></BotaoBarra>
      <BotaoBarra titulo="Seguinte (Enter)" disabled={!n} onClick={seguinte}><ChevronDown className="h-4 w-4" /></BotaoBarra>
      {modo === 'substituir' ? (
        <>
          <Sep />
          <Input value={subst} onChange={(e) => setSubst(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') teclas(e); else if (e.key === 'Enter') { e.preventDefault(); substituirActual(editor.view, subst); } }} placeholder="Substituir por…" aria-label="Substituir por" className="h-8 w-56" />
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1" disabled={!n} onClick={() => substituirActual(editor.view, subst)}><Replace className="h-3.5 w-3.5" />Substituir</Button>
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1" disabled={!n} onClick={() => substituirTodas(editor.view, subst)}><ReplaceAll className="h-3.5 w-3.5" />Substituir tudo</Button>
        </>
      ) : (
        <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setModo('substituir')}>Substituir… <span className="ml-1 text-slate-400">Ctrl+H</span></Button>
      )}
      <BotaoBarra titulo="Fechar (Esc)" onClick={onFechar} className="ml-auto"><X className="h-4 w-4" /></BotaoBarra>
    </div>
  );
}

/**
 * @param {Object} props
 * @param {Object} props.conteudo        documento ProseMirror da secção
 * @param {(json:Object)=>void} props.onChange
 * @param {number} [props.numeroSeccao]  número da secção no documento (numera os títulos «4.1», «4.1.1»)
 * @param {number} [props.figurasAntes]  figuras legendadas nas secções anteriores (continua a numeração)
 * @param {number} [props.tabelasAntes]  tabelas legendadas nas secções anteriores
 */
export default function EditorSeccao({
  conteudo, onChange, placeholder, className, editavel = true, numeroSeccao, figurasAntes = 0, tabelasAntes = 0,
}) {
  const { toast } = useToast();
  // H2/H3/H4 sem saltar níveis: o título da secção é o nível 1; um H4 sem H3 antes fica H3 (ou H2) — nunca «2.0.0.1».
  const aplicarTitulo = (pedido) => {
    if (!editor) return;
    if (editor.isActive('heading', { level: pedido })) { editor.chain().focus().setParagraph().run(); return; }
    let ultimo = 1; const ate = editor.state.selection.from;
    editor.state.doc.descendants((n, pos) => {
      if (pos >= ate) return false;
      if (n.type.name === 'heading') ultimo = n.attrs.level;
      return n.type.name === 'doc' || n.type.name === 'blockquote';
    });
    const nivel = Math.min(pedido, ultimo + 1);
    editor.chain().focus().setHeading({ level: nivel }).run();
    if (nivel !== pedido) toast({ title: `Ficou como H${nivel}`, description: `Os níveis não se saltam: para usar H${pedido}, ponha antes um H${pedido - 1}.` });
  };
  const ficheiroRef = useRef(null);
  const reduzindo = useRef(new Set());
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const emitido = useRef(null); // último conteúdo que saiu daqui (não se volta a meter no editor)
  const [procurar, setProcurar] = useState(null); // null | 'procurar' | 'substituir'
  const [termoInicial, setTermoInicial] = useState('');
  const [cheio, setCheio] = useState(false);
  const [legenda, setLegenda] = useState(null); // { alvo: 'image'|'table', valor }
  const editorRef = useRef(null);

  const abrirProcurar = useCallback((modo) => {
    const ed = editorRef.current;
    if (ed) {
      const { from, to } = ed.state.selection;
      const sel = from !== to ? ed.state.doc.textBetween(from, to, ' ') : '';
      if (sel && sel.length <= 80 && !/\n/.test(sel)) setTermoInicial(sel);
    }
    setProcurar(modo);
  }, []);
  const abrirRef = useRef(abrirProcurar);
  abrirRef.current = abrirProcurar;

  const inserirFicheiros = async (ed, ficheiros, pos) => {
    let k = 0;
    for (const f of ficheiros) {
      try {
        const { src, largura } = await imagemDeFicheiro(f);
        const alt = (f.name || '').replace(/\.[^.]+$/, '');
        const no = { type: 'image', attrs: { src, alt, width: largura > 800 ? '100%' : null } };
        // galeria «Fotos lado a lado»: a foto vai para a célula do cursor (100% da célula); as seguintes, para as
        // células seguintes (acrescenta-se uma linha se a galeria acabar)
        if (typeof pos !== 'number' && selEmGaleria(ed.state)) {
          if (k > 0 && !ed.commands.goToNextCell()) ed.chain().addRowAfter().goToNextCell().run();
          if (ed.chain().focus().colocarFotoNaGaleria({ src, alt }).run()) { k++; continue; }
        }
        if (typeof pos === 'number') ed.chain().focus().insertContentAt(pos, no).run();
        else ed.chain().focus().insertContent(no).run();
      } catch (e) {
        toast({ title: 'Imagem não inserida', description: e?.message || String(e), variant: 'destructive' });
      }
    }
  };

  // Imagens que chegaram grandes por colagem de HTML (Word): reduzem-se depois de entrar.
  const reduzirGrandes = (ed) => {
    ed.state.doc.descendants((no) => {
      const src = no.type.name === 'image' ? String(no.attrs.src || '') : '';
      if (!src.startsWith('data:') || src.length <= LIMITE_DATA_URL || reduzindo.current.has(src)) return;
      reduzindo.current.add(src);
      reduzirImagemSrc(src).then(({ src: novo }) => {
        if (ed.isDestroyed) return;
        // a posição pode ter mudado: procura-se a imagem de novo pelo src
        ed.state.doc.descendants((n2, p2) => {
          if (n2.type.name === 'image' && n2.attrs.src === src) {
            ed.view.dispatch(ed.state.tr.setNodeMarkup(p2, undefined, { ...n2.attrs, src: novo }));
            return false;
          }
          return true;
        });
      }).catch(() => { /* fica como veio */ }).finally(() => reduzindo.current.delete(src));
    });
  };

  const extensoes = useMemo(() => [
    ...extensoesContrato(),
    Procurar.configure({ aoAbrir: (modo) => abrirRef.current?.(modo) }),
  ], []);

  const editor = useEditor({
    extensions: extensoes,
    content: conteudo ? normalizarNiveisTitulos(conteudo) : docVazio(),
    editable: editavel,
    editorProps: {
      attributes: {
        class: 'prose-gd min-h-[18rem] px-4 py-3 focus:outline-none',
        'aria-label': placeholder || 'Texto da secção',
      },
      transformPastedHTML: (html) => limparHtmlColado(html),
      handlePaste: (view, event) => {
        const fs = [...(event.clipboardData?.files || [])].filter(f => /^image\//.test(f.type));
        if (!fs.length) return false;
        // Word põe no clipboard o HTML e uma imagem do bloco: havendo HTML, prefere-se o texto
        const html = event.clipboardData?.getData('text/html') || '';
        if (html && limparHtmlColado(html).replace(/<[^>]*>/g, '').replace(/&nbsp;|\s/g, '')) return false;
        event.preventDefault();
        inserirFicheiros(editorRef.current, fs);
        return true;
      },
      handleDrop: (view, event) => {
        const fs = [...(event.dataTransfer?.files || [])].filter(f => /^image\//.test(f.type));
        if (!fs.length) return false;
        event.preventDefault();
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        inserirFicheiros(editorRef.current, fs, pos);
        return true;
      },
    },
    onUpdate: ({ editor: ed }) => {
      reduzirGrandes(ed);
      const json = ed.getJSON();
      emitido.current = json;
      onChangeRef.current?.(json);
    },
  });
  editorRef.current = editor;

  // Mudar de secção: o mesmo componente recebe outro conteúdo (a chave do pai também força remontagem).
  useEffect(() => {
    if (!editor || editor.isDestroyed || conteudo === emitido.current) return;
    const actual = JSON.stringify(editor.getJSON());
    const novo = JSON.stringify(conteudo || docVazio());
    if (actual !== novo) editor.commands.setContent(conteudo || docVazio(), false);
  }, [editor, conteudo]);

  useEffect(() => { editor?.setEditable(editavel); }, [editor, editavel]);

  // Ecrã inteiro: Esc sai (se não houver diálogo aberto); a página por trás não faz scroll.
  useEffect(() => {
    if (!cheio) return undefined;
    const tecla = (e) => {
      if (e.key !== 'Escape' || legenda || e.defaultPrevented) return;
      if (document.querySelector('[role="dialog"][data-state="open"], [role="menu"][data-state="open"]')) return;
      setCheio(false);
    };
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', tecla);
    return () => { window.removeEventListener('keydown', tecla); document.body.style.overflow = antes; };
  }, [cheio, legenda]);

  const docActual = editor?.state.doc;
  const palavras = useMemo(() => (docActual ? contarPalavras(docActual) : 0), [docActual]);

  if (!editor) return <div className={cn('min-h-[18rem] rounded-lg border border-slate-200 dark:border-slate-800', className)} />;

  const c = () => editor.chain().focus();
  const emTabela = editor.isActive('table');
  const galeria = emTabela && selEmGaleria(editor.state);
  const emImagem = editor.isActive('image');
  const emLista = editor.isActive('listItem');
  const nivelLista = emLista ? nivelListaNaSeleccao(editor.state) : 0;
  const caixaActiva = editor.isActive('blockquote') ? (editor.getAttributes('blockquote').tipo || 'nota') : null;
  const CaixaIcone = (CAIXAS.find(x => x.tipo === caixaActiva) || CAIXAS[0]).Icone;
  const alinhamento = ['center', 'right', 'justify'].find(a => editor.isActive({ textAlign: a })) || 'left';
  const pode = editor.can();

  const fecharProcurar = () => {
    definirTermo(editor.view, '');
    setProcurar(null);
    setTermoInicial('');
    editor.commands.focus();
  };

  const abrirLegenda = (alvo) => setLegenda({ alvo, valor: editor.getAttributes(alvo).legenda || '' });
  const gravarLegenda = (e) => {
    e?.preventDefault();
    const v = String(legenda?.valor || '').trim();
    c().updateAttributes(legenda.alvo, { legenda: v || null }).run();
    setLegenda(null);
  };

  const numerar = typeof numeroSeccao === 'number' && numeroSeccao > 0;

  return (
    <div
      className={cn(
        'gd-legendas rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900',
        numerar && 'gd-numerar',
        cheio && 'fixed inset-0 z-50 flex flex-col rounded-none border-0',
        className,
      )}
      style={{ counterReset: `gd-fig ${figurasAntes} gd-tab ${tabelasAntes}`, ...(numerar ? { '--gd-sec': `"${numeroSeccao}"` } : {}) }}
    >
      <style>{ESTILO_PROSA}</style>
      {editavel && (
        <div className={cn('z-10 rounded-t-lg border-b border-slate-200 bg-slate-50/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95', cheio ? 'rounded-none' : 'sticky top-[var(--topo-fixo,0px)]')}>
          <div role="toolbar" aria-label="Formatação" className="flex flex-wrap items-center gap-0.5 px-2 py-1">
            <BotaoBarra titulo="Parágrafo" activo={editor.isActive('paragraph')} onClick={() => c().setParagraph().run()}><Pilcrow className="h-4 w-4" /></BotaoBarra>
            <BotaoBarra titulo="Título" activo={editor.isActive('heading', { level: 2 })} onClick={() => aplicarTitulo(2)}><Heading2 className="h-4 w-4" /></BotaoBarra>
            <BotaoBarra titulo="Subtítulo" activo={editor.isActive('heading', { level: 3 })} onClick={() => aplicarTitulo(3)}><Heading3 className="h-4 w-4" /></BotaoBarra>
            <BotaoBarra titulo="Subtítulo menor" activo={editor.isActive('heading', { level: 4 })} onClick={() => aplicarTitulo(4)}><Heading4 className="h-4 w-4" /></BotaoBarra>
            <Sep />
            <BotaoBarra titulo="Negrito (Ctrl+B)" activo={editor.isActive('bold')} onClick={() => c().toggleBold().run()}><Bold className="h-4 w-4" /></BotaoBarra>
            <BotaoBarra titulo="Itálico (Ctrl+I)" activo={editor.isActive('italic')} onClick={() => c().toggleItalic().run()}><Italic className="h-4 w-4" /></BotaoBarra>
            <BotaoBarra titulo="Sublinhado (Ctrl+U)" activo={editor.isActive('underline')} onClick={() => c().toggleUnderline().run()}><UnderlineIcon className="h-4 w-4" /></BotaoBarra>
            <Sep />
            <BotaoBarra titulo="Alinhar à esquerda" activo={alinhamento === 'left'} onClick={() => c().definirAlinhamento('left').run()}><AlignLeft className="h-4 w-4" /></BotaoBarra>
            <BotaoBarra titulo="Centrar" activo={alinhamento === 'center'} onClick={() => c().definirAlinhamento('center').run()}><AlignCenter className="h-4 w-4" /></BotaoBarra>
            <BotaoBarra titulo="Alinhar à direita" activo={alinhamento === 'right'} onClick={() => c().definirAlinhamento('right').run()}><AlignRight className="h-4 w-4" /></BotaoBarra>
            <BotaoBarra titulo="Justificar" activo={alinhamento === 'justify'} onClick={() => c().definirAlinhamento('justify').run()}><AlignJustify className="h-4 w-4" /></BotaoBarra>
            <Sep />
            <BotaoBarra titulo="Lista com marcas" activo={editor.isActive('bulletList')} onClick={() => c().toggleBulletList().run()}><List className="h-4 w-4" /></BotaoBarra>
            <BotaoBarra titulo="Lista numerada (passos)" activo={editor.isActive('orderedList')} onClick={() => c().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></BotaoBarra>
            <BotaoBarra titulo="Diminuir nível (Shift+Tab)" disabled={!emLista} onClick={() => c().diminuirNivelLista().run()}><IndentDecrease className="h-4 w-4" /></BotaoBarra>
            <BotaoBarra
              titulo={nivelLista >= NIVEIS_LISTA_MAX ? `Aumentar nível (máximo ${NIVEIS_LISTA_MAX} níveis)` : 'Aumentar nível (Tab)'}
              disabled={!emLista || nivelLista >= NIVEIS_LISTA_MAX || !pode.sinkListItem('listItem')}
              onClick={() => c().aumentarNivelLista().run()}
            ><IndentIncrease className="h-4 w-4" /></BotaoBarra>
            <Sep />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" title="Caixa de destaque (Nota, Atenção, Aviso)" aria-label="Caixa de destaque"
                  className={cn('inline-flex h-8 items-center gap-0.5 rounded-md px-1.5 text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800', caixaActiva && 'bg-teal-50 text-teal-900 dark:bg-teal-950/60 dark:text-teal-100')}
                ><CaixaIcone className="h-4 w-4" /><ChevronDown className="h-3 w-3 opacity-60" /></button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" onCloseAutoFocus={(e) => e.preventDefault()}>
                <DropdownMenuLabel className="text-xs text-slate-500">Caixa de destaque</DropdownMenuLabel>
                {CAIXAS.map(({ tipo, rotulo, Icone, cor }) => (
                  <DropdownMenuItem key={tipo} onSelect={() => c().definirCaixa(tipo).run()} className="gap-2">
                    <Icone className={cn('h-4 w-4', cor)} />{rotulo}{caixaActiva === tipo && <span className="ml-auto text-xs text-slate-400">actual</span>}
                  </DropdownMenuItem>
                ))}
                {caixaActiva && <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => c().tirarCaixa().run()} className="gap-2"><X className="h-4 w-4" />Tirar da caixa</DropdownMenuItem>
                </>}
              </DropdownMenuContent>
            </DropdownMenu>
            <BotaoBarra titulo="Linha horizontal" onClick={() => c().setHorizontalRule().run()}><Minus className="h-4 w-4" /></BotaoBarra>
            <BotaoBarra titulo="Quebra de página (Ctrl+Enter)" onClick={() => c().inserirQuebraPagina().run()}><SeparatorHorizontal className="h-4 w-4" /></BotaoBarra>
            <Sep />
            <EscolherTabela onEscolher={(rows, cols) => c().insertTable({ rows, cols, withHeaderRow: true }).run()} />
            <EscolherGaleria onEscolher={(colunas, linhas) => c().inserirGaleria({ colunas, linhas }).run()} />
            {galeria && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" title="Acções da galeria de fotos" className="inline-flex h-8 items-center gap-1 rounded-md bg-teal-50 px-2 text-xs font-medium text-teal-900 hover:bg-teal-100 dark:bg-teal-950/60 dark:text-teal-100">
                    Galeria<ChevronDown className="h-3 w-3 opacity-70" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-60" onCloseAutoFocus={(e) => e.preventDefault()}>
                  <DropdownMenuItem className="gap-2" onSelect={() => c().addColumnAfter().run()}><BetweenVerticalEnd className="h-4 w-4" />Acrescentar foto (coluna)</DropdownMenuItem>
                  <DropdownMenuItem className="gap-2" disabled={!pode.deleteColumn()} onSelect={() => c().deleteColumn().run()}><Trash2 className="h-4 w-4 text-red-600" />Remover foto (coluna)</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="gap-2" onSelect={() => c().addRowAfter().run()}><BetweenHorizontalEnd className="h-4 w-4" />Acrescentar linha</DropdownMenuItem>
                  <DropdownMenuItem className="gap-2" disabled={!pode.deleteRow()} onSelect={() => c().deleteRow().run()}><Trash2 className="h-4 w-4 text-red-600" />Remover linha</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="gap-2 text-red-700 focus:text-red-700" onSelect={() => c().deleteTable().run()}><Trash2 className="h-4 w-4" />Apagar galeria</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {emTabela && !galeria && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" title="Acções da tabela" className="inline-flex h-8 items-center gap-1 rounded-md bg-teal-50 px-2 text-xs font-medium text-teal-900 hover:bg-teal-100 dark:bg-teal-950/60 dark:text-teal-100">
                    Tabela<ChevronDown className="h-3 w-3 opacity-70" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-60" onCloseAutoFocus={(e) => e.preventDefault()}>
                  <DropdownMenuItem className="gap-2" onSelect={() => c().addRowBefore().run()}><BetweenHorizontalStart className="h-4 w-4" />Inserir linha acima</DropdownMenuItem>
                  <DropdownMenuItem className="gap-2" onSelect={() => c().addRowAfter().run()}><BetweenHorizontalEnd className="h-4 w-4" />Inserir linha abaixo</DropdownMenuItem>
                  <DropdownMenuItem className="gap-2" onSelect={() => c().deleteRow().run()}><Trash2 className="h-4 w-4 text-red-600" />Apagar linha</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="gap-2" onSelect={() => c().addColumnBefore().run()}><BetweenVerticalStart className="h-4 w-4" />Inserir coluna à esquerda</DropdownMenuItem>
                  <DropdownMenuItem className="gap-2" onSelect={() => c().addColumnAfter().run()}><BetweenVerticalEnd className="h-4 w-4" />Inserir coluna à direita</DropdownMenuItem>
                  <DropdownMenuItem className="gap-2" onSelect={() => c().deleteColumn().run()}><Trash2 className="h-4 w-4 text-red-600" />Apagar coluna</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="gap-2" disabled={!pode.mergeCells()} onSelect={() => c().mergeCells().run()}><TableCellsMerge className="h-4 w-4" />Juntar células</DropdownMenuItem>
                  <DropdownMenuItem className="gap-2" disabled={!pode.splitCell()} onSelect={() => c().splitCell().run()}><TableCellsSplit className="h-4 w-4" />Separar células</DropdownMenuItem>
                  <DropdownMenuItem className="gap-2" onSelect={() => c().toggleHeaderRow().run()}><PanelTop className="h-4 w-4" />Linha de cabeçalho (ligar/desligar)</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="gap-2" onSelect={() => abrirLegenda('table')}><Captions className="h-4 w-4" />Legenda da tabela…</DropdownMenuItem>
                  <DropdownMenuItem className="gap-2 text-red-700 focus:text-red-700" onSelect={() => c().deleteTable().run()}><Trash2 className="h-4 w-4" />Apagar tabela</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <BotaoBarra titulo="Inserir imagem" onClick={() => ficheiroRef.current?.click()}><ImagePlus className="h-4 w-4" /></BotaoBarra>
            {emImagem && (
              <>
                <BotaoBarra titulo="Legenda da imagem…" activo onClick={() => abrirLegenda('image')}>
                  <Captions className="h-4 w-4" /><span className="text-xs font-medium">Legenda…</span>
                </BotaoBarra>
                <span className="ml-1 text-xs text-slate-500" aria-hidden="true">Tamanho</span>
                {['25%', '50%', '75%', '100%'].map((w) => {
                  const actual = editor.getAttributes('image').width || '100%';
                  return (
                    <BotaoBarra key={w} titulo={`Largura da imagem: ${w} ${galeria ? 'da célula' : 'do texto'}`} activo={actual === w}
                      onClick={() => c().updateAttributes('image', { width: w === '100%' ? null : w }).run()}>
                      <span className="text-xs font-medium">{w}</span>
                    </BotaoBarra>
                  );
                })}
              </>
            )}
            <Sep />
            <BotaoBarra titulo="Anular (Ctrl+Z)" disabled={!pode.undo()} onClick={() => c().undo().run()}><Undo2 className="h-4 w-4" /></BotaoBarra>
            <BotaoBarra titulo="Refazer (Ctrl+Y)" disabled={!pode.redo()} onClick={() => c().redo().run()}><Redo2 className="h-4 w-4" /></BotaoBarra>
            <Sep />
            <BotaoBarra titulo="Procurar e substituir (Ctrl+F / Ctrl+H)" activo={!!procurar} onClick={() => (procurar ? fecharProcurar() : abrirProcurar('procurar'))}><Search className="h-4 w-4" /></BotaoBarra>
            <BotaoBarra titulo={cheio ? 'Sair do ecrã inteiro (Esc)' : 'Ecrã inteiro'} activo={cheio} onClick={() => setCheio(v => !v)}>
              {cheio ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </BotaoBarra>
            <input
              ref={ficheiroRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden"
              onChange={(e) => { const fs = [...(e.target.files || [])]; e.target.value = ''; if (fs.length) inserirFicheiros(editor, fs); }}
            />
          </div>
          {procurar && (
            <BarraProcurar editor={editor} modo={procurar} setModo={setProcurar} onFechar={fecharProcurar} termoInicial={termoInicial} />
          )}
        </div>
      )}
      <div className={cn(cheio && 'flex-1 overflow-auto bg-slate-100 py-6 dark:bg-slate-950')}>
        <div className={cn(cheio && 'mx-auto min-h-full max-w-4xl rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900')}>
          <EditorContent editor={editor} />
        </div>
      </div>
      {editavel && (
        <div className="flex items-center gap-3 rounded-b-lg border-t border-slate-200 bg-slate-50/80 px-3 py-1 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/80">
          <span className="tabular-nums">{palavras} {palavras === 1 ? 'palavra' : 'palavras'}</span>
          {emLista && <span>· nível de lista {nivelLista} de {NIVEIS_LISTA_MAX} (Tab / Shift+Tab)</span>}
          <span className="ml-auto hidden items-center gap-1 lg:inline-flex"><SquareDashed className="h-3 w-3" />Ctrl+Enter quebra de página · Ctrl+F procurar</span>
        </div>
      )}
      <Dialog open={!!legenda} onOpenChange={(o) => { if (!o) setLegenda(null); }}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={gravarLegenda}>
            <DialogHeader>
              <DialogTitle>{legenda?.alvo === 'table' ? 'Legenda da tabela' : 'Legenda da imagem'}</DialogTitle>
              <DialogDescription>
                {legenda?.alvo === 'table'
                  ? 'Sai por cima da tabela como «Tabela N — legenda». A numeração é automática.'
                  : 'Sai por baixo da imagem como «Figura N — legenda». A numeração é automática.'}
                {' '}Deixe vazio para tirar a legenda.
              </DialogDescription>
            </DialogHeader>
            <Input
              autoFocus className="my-4" maxLength={200} value={legenda?.valor || ''}
              onChange={(e) => setLegenda(l => ({ ...l, valor: e.target.value }))}
              placeholder={legenda?.alvo === 'table' ? 'ex. Responsabilidades por função' : 'ex. Planta da placa de estacionamento'}
              aria-label="Legenda"
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setLegenda(null)}>Cancelar</Button>
              <Button type="submit">Guardar legenda</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
