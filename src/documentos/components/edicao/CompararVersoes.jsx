// «Comparar versões» — o que mudou entre duas revisões de um documento, página a página.
//
// O texto vem dos PDFs (pdf.js, no navegador, a partir do mesmo endereço assinado com que o leitor abre o ficheiro);
// a comparação em si é a função pura de compararVersoes.js, a correr num Web Worker. Uma fonte editável (.docx) não
// se compara directamente: usa-se o PDF da mesma revisão, ou — sem ele — a pré-visualização em PDF que o servidor
// gera a partir do Word.
//
// Acessibilidade: inserções e remoções não se distinguem só pela cor — a inserção vai sublinhada, com «+» e com o
// elemento <ins>; a remoção riscada, com «−» e <del>; e cada uma leva um rótulo para leitores de ecrã.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowLeftRight, ChevronDown, ChevronUp, FileMinus2, FilePen, FilePlus2, GitCompareArrows, Images,
  Loader2, Minus, Plus,
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import Select from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { tk } from '@/documentos/pages/PortalBiblioteca';
import {
  compararDocumentos, ehVersaoFonte, pdfDaVersao, versoesPorOmissao, QUEBRA,
} from '@/documentos/compararVersoes';
import { urlDoFicheiroVersao } from '@/documentos/ficheiroVersao';
import { abrirPdfDeUrl, extrairPaginas, textoEmCache } from './extrairTextoPdf';

const ROTULO_ESTADO = {
  em_vigor: 'em vigor', aprovado: 'aprovada', rascunho: 'rascunho', obsoleto: 'obsoleta', fonte: 'fonte editável',
  em_revisao: 'em revisão', em_aprovacao: 'em aprovação',
};
const chaveVersao = (v) => (v ? String(v.versao) : '');
const nomeVersao = (v) => (v ? `v${v.versao}` : '—');
const chaveFicheiro = (v) => String(v?.arquivo_uri || v?.arquivo_url || `versao-${v?.versao}`);

// A comparação fora da thread principal; se o navegador recusar o worker, corre aqui mesmo (com o mesmo resultado).
function compararNoWorker(paginasA, paginasB, opcoes) {
  return new Promise((resolve, reject) => {
    const local = () => { try { resolve(compararDocumentos(paginasA, paginasB, opcoes)); } catch (e) { reject(e); } };
    let w;
    try { w = new Worker(new URL('./comparar.worker.js', import.meta.url), { type: 'module' }); } catch { local(); return; }
    const fim = () => { clearTimeout(t); try { w.terminate(); } catch { /* */ } };
    const t = setTimeout(() => { fim(); reject(new Error('A comparação demorou demasiado. As versões podem ser muito diferentes.')); }, 120000);
    w.onmessage = (ev) => { fim(); if (ev.data?.ok) resolve(ev.data.resultado); else reject(new Error(ev.data?.erro || 'Falhou a comparação.')); };
    w.onerror = (ev) => { ev.preventDefault?.(); fim(); local(); };
    w.postMessage({ id: 1, paginasA, paginasB, opcoes });
  });
}

// ── texto marcado ─────────────────────────────────────────────────────────
function TextoComQuebras({ texto }) {
  const partes = String(texto).split(QUEBRA);
  return partes.map((p, i) => (
    <React.Fragment key={i}>{i > 0 && <br />}{p}</React.Fragment>
  ));
}

function Pedacos({ pedacos }) {
  return pedacos.map((p, i) => {
    const anterior = pedacos[i - 1];
    const espaco = i > 0 && !String(anterior?.texto).endsWith(QUEBRA) && !String(p.texto).startsWith(QUEBRA) ? ' ' : '';
    if (p.tipo === 'ins') {
      return (
        <React.Fragment key={i}>{espaco}
          <ins className="rounded-sm bg-emerald-100 px-0.5 text-emerald-950 underline decoration-emerald-700 decoration-2 underline-offset-2 dark:bg-emerald-900/50 dark:text-emerald-50 dark:decoration-emerald-300">
            <span className="sr-only">[acrescentado: </span>
            <span aria-hidden="true" className="mr-0.5 select-none text-[0.7em] font-bold align-super">+</span>
            <TextoComQuebras texto={p.texto} />
            <span className="sr-only">]</span>
          </ins>
        </React.Fragment>
      );
    }
    if (p.tipo === 'del') {
      return (
        <React.Fragment key={i}>{espaco}
          <del className="rounded-sm bg-red-100 px-0.5 text-red-900 line-through decoration-red-700 decoration-2 dark:bg-red-900/40 dark:text-red-100 dark:decoration-red-300">
            <span className="sr-only">[removido: </span>
            <span aria-hidden="true" className="mr-0.5 select-none text-[0.7em] font-bold align-super no-underline">−</span>
            <TextoComQuebras texto={p.texto} />
            <span className="sr-only">]</span>
          </del>
        </React.Fragment>
      );
    }
    return <React.Fragment key={i}>{espaco}<TextoComQuebras texto={p.texto} /></React.Fragment>;
  });
}

const TIPO = {
  alterada: { icone: FilePen, rotulo: 'alterada', cor: 'text-amber-700 dark:text-amber-300' },
  acrescentada: { icone: FilePlus2, rotulo: 'página nova', cor: 'text-emerald-700 dark:text-emerald-300' },
  removida: { icone: FileMinus2, rotulo: 'página removida', cor: 'text-red-700 dark:text-red-300' },
};

function tituloEntrada(e, vA, vB) {
  if (e.tipo === 'removida') return `Página ${e.paginaA} da ${nomeVersao(vA)}`;
  if (e.tipo === 'acrescentada') return `Página ${e.paginaB} da ${nomeVersao(vB)}`;
  return e.paginaA && e.paginaA !== e.paginaB
    ? `Página ${e.paginaB} (era a ${e.paginaA})`
    : `Página ${e.paginaB}`;
}

// ── imagem de uma página (lado a lado) ───────────────────────────────────
function ImagemPagina({ obterPdf, numero, legenda }) {
  const canvasRef = useRef(null);
  const [estado, setEstado] = useState('a-carregar');
  useEffect(() => {
    let vivo = true; let tarefa = null;
    setEstado('a-carregar');
    (async () => {
      try {
        const pdf = await obterPdf();
        if (!vivo) return;
        if (!pdf || numero < 1 || numero > pdf.numPages) { setEstado('fora'); return; }
        const pagina = await pdf.getPage(numero);
        const canvas = canvasRef.current;
        if (!vivo || !canvas) return;
        const largura = Math.min(canvas.parentElement?.clientWidth || 520, 720);
        const base = pagina.getViewport({ scale: 1 });
        const escala = largura / base.width;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const vp = pagina.getViewport({ scale: escala * dpr });
        canvas.width = vp.width; canvas.height = vp.height;
        canvas.style.width = `${vp.width / dpr}px`; canvas.style.height = `${vp.height / dpr}px`;
        tarefa = pagina.render({ canvasContext: canvas.getContext('2d'), viewport: vp });
        await tarefa.promise;
        if (vivo) setEstado('pronta');
      } catch (e) {
        if (vivo && e?.name !== 'RenderingCancelledException') setEstado('erro');
      }
    })();
    return () => { vivo = false; tarefa?.cancel?.(); };
  }, [obterPdf, numero]);
  return (
    <figure className="min-w-0">
      <figcaption className={cn('mb-1 text-xs font-medium', tk.tintaFraca)}>{legenda}</figcaption>
      <div className={cn('relative overflow-hidden rounded-lg border bg-white', tk.borda)}>
        {estado === 'a-carregar' && <div className={cn('flex h-40 items-center justify-center text-xs', tk.tintaFraca)}><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />A desenhar a página…</div>}
        {estado === 'erro' && <div className={cn('flex h-40 items-center justify-center text-xs', tk.perigo)}>Não foi possível desenhar a página.</div>}
        {estado === 'fora' && <div className={cn('flex h-40 items-center justify-center text-xs', tk.tintaFraca)}>Sem página correspondente.</div>}
        <canvas ref={canvasRef} className={cn('mx-auto block max-w-full', estado !== 'pronta' && 'hidden')} aria-label={legenda} />
      </div>
    </figure>
  );
}

// ── o diálogo ────────────────────────────────────────────────────────────
export default function CompararVersoes({ aberto, onFechar, doc, versoes = [], vActual }) {
  const [chaveA, setChaveA] = useState('');
  const [chaveB, setChaveB] = useState('');
  const [ignorarRepetidas, setIgnorarRepetidas] = useState(true);
  const [paginas, setPaginas] = useState(null);       // { a, b, chaveA, chaveB }
  const [progresso, setProgresso] = useState(null);   // { texto, feitas, total }
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState(null);
  const [aComparar, setAComparar] = useState(false);
  const [sel, setSel] = useState(0);
  const [verImagens, setVerImagens] = useState(false);
  const pdfs = useRef(new Map());                      // chave do ficheiro -> Promise<PDFDocumentProxy>
  const detalheRef = useRef(null);

  // por omissão: em vigor × rascunho mais recente, ou as duas últimas revisões
  useEffect(() => {
    if (!aberto) return;
    const { a, b } = versoesPorOmissao(versoes, vActual);
    setChaveA(chaveVersao(a)); setChaveB(chaveVersao(b));
    setSel(0); setVerImagens(false);
  }, [aberto]);

  // fechar o diálogo (ou sair da página) liberta os PDFs abertos
  const largarPdfs = useCallback(() => {
    for (const p of pdfs.current.values()) p.then(d => d?.destroy?.()).catch(() => {});
    pdfs.current.clear();
  }, []);
  useEffect(() => { if (!aberto) largarPdfs(); }, [aberto, largarPdfs]);
  useEffect(() => largarPdfs, [largarPdfs]);

  const vA = versoes.find(v => chaveVersao(v) === chaveA) || null;
  const vB = versoes.find(v => chaveVersao(v) === chaveB) || null;
  const fA = useMemo(() => pdfDaVersao(vA, versoes), [vA, versoes]);
  const fB = useMemo(() => pdfDaVersao(vB, versoes), [vB, versoes]);

  const opcoes = useMemo(() => versoes
    .filter(v => pdfDaVersao(v, versoes))
    .sort((x, y) => Number(y.versao) - Number(x.versao))
    .map(v => ({
      value: chaveVersao(v),
      label: `v${v.versao} — ${v.rotulo || v.arquivo_nome || `Versão ${v.versao}`}${v.estado ? ` (${ROTULO_ESTADO[ehVersaoFonte(v) ? 'fonte' : v.estado] || v.estado})` : ''}`,
    })), [versoes]);

  const obterPdf = useCallback((ficheiro) => {
    const chave = chaveFicheiro(ficheiro.versao);
    let p = pdfs.current.get(chave);
    if (!p) {
      p = urlDoFicheiroVersao(ficheiro.versao, doc).then(url => abrirPdfDeUrl(url));
      p.catch(() => pdfs.current.delete(chave));
      pdfs.current.set(chave, p);
    }
    return p;
  }, [doc]);

  const obterPdfA = useCallback(() => (fA ? obterPdf(fA) : Promise.resolve(null)), [obterPdf, fA]);
  const obterPdfB = useCallback(() => (fB ? obterPdf(fB) : Promise.resolve(null)), [obterPdf, fB]);

  // 1) extrair o texto das duas versões
  const mesmoFicheiro = fA && fB && chaveFicheiro(fA.versao) === chaveFicheiro(fB.versao);
  useEffect(() => {
    if (!aberto || !fA || !fB || mesmoFicheiro) { setPaginas(null); return undefined; }
    const ctrl = new AbortController();
    setErro(''); setResultado(null); setPaginas(null); setSel(0);
    (async () => {
      try {
        const lados = [['a', fA, vA], ['b', fB, vB]];
        const fora = {};
        for (let i = 0; i < lados.length; i += 1) {
          const [lado, ficheiro, original] = lados[i];
          const chave = chaveFicheiro(ficheiro.versao);
          const etiqueta = `${nomeVersao(original)}${ficheiro.substituta ? ` (PDF da ${nomeVersao(ficheiro.versao)})` : ''}`;
          if (!textoEmCache(chave)) {
            setProgresso({
              texto: ficheiro.preVisualizacao
                ? `A converter a ${etiqueta} para PDF no servidor…`
                : `A descarregar a ${etiqueta}…`,
              feitas: 0, total: 0, passo: i + 1,
            });
          }
          const pdf = textoEmCache(chave) ? null : await obterPdf(ficheiro);
          if (ctrl.signal.aborted) return;
          fora[lado] = await extrairPaginas(pdf, {
            chave, sinal: ctrl.signal,
            aoProgresso: (feitas, total) => setProgresso({ texto: `A ler o texto da ${etiqueta}`, feitas, total, passo: i + 1 }),
          });
        }
        if (!ctrl.signal.aborted) { setPaginas(fora); setProgresso(null); }
      } catch (e) {
        if (e?.name === 'AbortError' || ctrl.signal.aborted) return;
        setProgresso(null);
        setErro(e?.message || 'Não foi possível ler as versões.');
      }
    })();
    return () => ctrl.abort();
  }, [aberto, fA, fB, mesmoFicheiro]);

  // 2) comparar (no worker) — volta a correr ao mudar «ignorar cabeçalhos», sem voltar a extrair
  useEffect(() => {
    if (!paginas) return undefined;
    let vivo = true;
    setAComparar(true);
    compararNoWorker(paginas.a, paginas.b, { ignorarRepetidas })
      .then(r => { if (vivo) { setResultado(r); setSel(0); } })
      .catch(e => { if (vivo) setErro(e?.message || 'Falhou a comparação.'); })
      .finally(() => { if (vivo) setAComparar(false); });
    return () => { vivo = false; };
  }, [paginas, ignorarRepetidas]);

  const entradas = resultado?.entradas || [];
  const actual = entradas[Math.min(sel, Math.max(0, entradas.length - 1))] || null;
  const ir = (i) => {
    const alvo = Math.max(0, Math.min(entradas.length - 1, i));
    setSel(alvo);
    detalheRef.current?.scrollTo?.({ top: 0 });
    document.getElementById(`cmp-entrada-${alvo}`)?.scrollIntoView?.({ block: 'nearest' });
  };
  const teclas = (e) => {
    if (e.target?.closest?.('input,textarea,[role="listbox"],[role="combobox"]')) return;
    if (e.key === 'j' || (e.altKey && e.key === 'ArrowDown')) { e.preventDefault(); ir(sel + 1); }
    if (e.key === 'k' || (e.altKey && e.key === 'ArrowUp')) { e.preventDefault(); ir(sel - 1); }
  };

  const r = resultado?.resumo;
  const semTexto = r && (r.semTextoA > r.paginasA * 0.6 || r.semTextoB > r.paginasB * 0.6);
  const percentagem = progresso?.total ? Math.round((progresso.feitas / progresso.total) * 100) : null;

  const notaFicheiro = (v, f) => {
    if (!v) return null;
    if (!f) return <span className={tk.perigo}>Esta versão não tem PDF nem documento Office que se possa comparar.</span>;
    if (f.substituta) return <span>{ehVersaoFonte(v) ? 'Fonte editável' : 'Ficheiro não PDF'}: compara-se o PDF da mesma revisão ({nomeVersao(f.versao)}).</span>;
    if (f.preVisualizacao) return <span>Não há PDF desta revisão: usa-se a pré-visualização em PDF gerada pelo servidor (pode demorar).</span>;
    return null;
  };

  return (
    <Dialog open={aberto} onOpenChange={(o) => { if (!o) onFechar?.(); }}>
      <DialogContent
        className="flex h-[92vh] max-h-[92vh] w-[calc(100%-2rem)] max-w-[min(96vw,1400px)] flex-col gap-0 overflow-hidden p-0"
        onKeyDown={teclas}
      >
        <DialogHeader className={cn('space-y-3 border-b px-5 pb-4 pt-5 text-left', tk.borda)}>
          <DialogTitle className="flex items-center gap-2 pr-8">
            <GitCompareArrows className={cn('h-5 w-5', tk.acento)} aria-hidden="true" />Comparar versões
          </DialogTitle>
          <DialogDescription className={cn('text-xs', tk.tintaFraca)}>
            Compara o texto dos PDFs, página a página. Uma página inserida não desalinha as seguintes: o texto que só mudou de página não conta como alteração.
          </DialogDescription>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[14rem] flex-1">
              <label htmlFor="cmp-versao-a" className={cn('mb-1 block text-xs font-semibold', tk.tintaMedia)}>Versão anterior</label>
              <Select id="cmp-versao-a" options={opcoes} value={chaveA} onValueChange={setChaveA} placeholder="Escolha a versão" searchable={opcoes.length > 8} />
              <p className={cn('mt-1 min-h-[1rem] text-xs', tk.tintaFraca)}>{notaFicheiro(vA, fA)}</p>
            </div>
            <Button
              type="button" variant="outline" size="sm" className="mb-6"
              onClick={() => { setChaveA(chaveB); setChaveB(chaveA); }}
              disabled={!chaveA || !chaveB}
              aria-label="Trocar as versões"
              title="Trocar as versões"
            >
              <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
            </Button>
            <div className="min-w-[14rem] flex-1">
              <label htmlFor="cmp-versao-b" className={cn('mb-1 block text-xs font-semibold', tk.tintaMedia)}>Versão nova</label>
              <Select id="cmp-versao-b" options={opcoes} value={chaveB} onValueChange={setChaveB} placeholder="Escolha a versão" searchable={opcoes.length > 8} />
              <p className={cn('mt-1 min-h-[1rem] text-xs', tk.tintaFraca)}>{notaFicheiro(vB, fB)}</p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col">
          {opcoes.length < 2 ? (
            <Aviso texto="Este documento só tem uma versão com PDF: não há com que comparar." />
          ) : !vA || !vB ? (
            <Aviso texto="Escolha as duas versões a comparar." />
          ) : chaveA === chaveB || mesmoFicheiro ? (
            <Aviso texto={chaveA === chaveB ? 'Escolheu a mesma versão dos dois lados.' : `As duas escolhas usam o mesmo ficheiro (${nomeVersao(fA.versao)}): o texto é idêntico.`} />
          ) : !fA || !fB ? (
            <Aviso texto="Uma das versões não tem ficheiro que se possa comparar." tom="perigo" />
          ) : erro ? (
            <Aviso texto={erro} tom="perigo" />
          ) : progresso || !paginas || (aComparar && !resultado) ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6" role="status" aria-live="polite">
              <Loader2 className={cn('h-6 w-6 animate-spin', tk.acento)} aria-hidden="true" />
              <p className={cn('text-sm font-medium', tk.tinta)}>
                {progresso ? progresso.texto : 'A comparar…'}
                {progresso?.total ? ` — página ${progresso.feitas} de ${progresso.total}` : ''}
              </p>
              {progresso && <p className={cn('text-xs', tk.tintaFraca)}>Passo {progresso.passo} de 2{percentagem !== null ? ` · ${percentagem}%` : ''}</p>}
              {percentagem !== null && <Progress value={percentagem} className="h-2 w-full max-w-md" aria-label="Progresso da leitura" />}
            </div>
          ) : resultado ? (
            <>
              {/* resumo */}
              <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-5 py-3 text-sm', tk.borda, tk.superficieBaixa)} aria-live="polite">
                <span className={cn('font-medium', tk.tinta)}>
                  {nomeVersao(vA)} <span className={tk.tintaFraca}>({r.paginasA} p.)</span> → {nomeVersao(vB)} <span className={tk.tintaFraca}>({r.paginasB} p.)</span>
                </span>
                {r.identicas ? (
                  <span className={cn('font-medium', tk.bom)}>O texto é igual nas duas versões.</span>
                ) : (
                  <>
                    <Contador icone={FilePlus2} n={r.acrescentadas} um="página nova" varios="páginas novas" cor="text-emerald-700 dark:text-emerald-300" />
                    <Contador icone={FileMinus2} n={r.removidas} um="página removida" varios="páginas removidas" cor="text-red-700 dark:text-red-300" />
                    <Contador icone={FilePen} n={r.alteradas} um="página alterada" varios="páginas alteradas" cor="text-amber-700 dark:text-amber-300" />
                    <span className={tk.tintaMedia}><strong className={tk.mono}>{r.alteracoes}</strong> {r.alteracoes === 1 ? 'alteração' : 'alterações'}</span>
                    <span className={cn('text-xs', tk.tintaFraca)}>
                      <span className={tk.mono}>+{r.palavrasInseridas}</span> / <span className={tk.mono}>−{r.palavrasRemovidas}</span> palavras
                    </span>
                  </>
                )}
                <label className={cn('ml-auto flex cursor-pointer items-center gap-2 text-xs', tk.tintaMedia)}>
                  <Checkbox checked={ignorarRepetidas} onCheckedChange={v => setIgnorarRepetidas(!!v)} />
                  Ignorar cabeçalhos e rodapés repetidos
                </label>
                {aComparar && <Loader2 className={cn('h-4 w-4 animate-spin', tk.acento)} aria-label="A comparar" />}
              </div>
              {(r.modo === 'paginas' || semTexto) && (
                <div className={cn('flex items-start gap-2 border-b px-5 py-2 text-xs', tk.borda, tk.avisoFundo, tk.aviso)}>
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    {semTexto
                      ? 'Grande parte das páginas não tem texto (PDF digitalizado): a comparação de texto fica incompleta — veja as páginas lado a lado.'
                      : 'As versões são muito diferentes: as páginas foram emparelhadas por semelhança antes de comparar o texto.'}
                  </span>
                </div>
              )}

              {r.identicas ? (
                <Aviso texto={`Não há diferenças de texto entre a ${nomeVersao(vA)} e a ${nomeVersao(vB)}${ignorarRepetidas ? ' (ignorando cabeçalhos e rodapés repetidos)' : ''}. Diferenças só de imagens ou formatação não aparecem aqui.`} />
              ) : (
                <div className="grid min-h-0 flex-1 grid-cols-[minmax(13rem,18rem)_1fr]">
                  {/* lista de páginas com diferenças */}
                  <nav aria-label="Páginas com diferenças" className={cn('min-h-0 overflow-y-auto border-r', tk.borda)}>
                    <ol className={cn('divide-y', tk.divisoria)}>
                      {entradas.map((e, i) => {
                        const T = TIPO[e.tipo];
                        return (
                          <li key={e.chave}>
                            <button
                              id={`cmp-entrada-${i}`}
                              type="button"
                              onClick={() => ir(i)}
                              aria-current={i === sel ? 'true' : undefined}
                              className={cn('flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm', tk.foco, tk.hover, i === sel && tk.seleccionada)}
                            >
                              <T.icone className={cn('mt-0.5 h-4 w-4 shrink-0', T.cor)} aria-hidden="true" />
                              <span className="min-w-0">
                                <span className={cn('block font-medium', tk.tinta)}>{tituloEntrada(e, vA, vB)}</span>
                                <span className={cn('block text-xs', tk.tintaFraca)}>
                                  {T.rotulo}{e.tipo === 'alterada' ? ` · ${e.alteracoes} ${e.alteracoes === 1 ? 'alteração' : 'alterações'}` : ''}
                                </span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ol>
                  </nav>

                  {/* detalhe */}
                  <section ref={detalheRef} className="min-h-0 overflow-y-auto" aria-label="Diferenças da página escolhida">
                    {actual && (
                      <div className="px-5 py-4">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <h3 className={cn('text-base font-semibold', tk.tinta)}>{tituloEntrada(actual, vA, vB)}</h3>
                          <span className={cn('text-xs font-medium', TIPO[actual.tipo].cor)}>{TIPO[actual.tipo].rotulo}</span>
                          {actual.tipo === 'removida' && actual.paginaB && (
                            <span className={cn('text-xs', tk.tintaFraca)}>(estava antes da p. {actual.paginaB} da {nomeVersao(vB)})</span>
                          )}
                          <div className="ml-auto flex items-center gap-1">
                            <Button type="button" variant="outline" size="sm" onClick={() => setVerImagens(v => !v)} aria-pressed={verImagens}>
                              <Images className="h-4 w-4" aria-hidden="true" />{verImagens ? 'Esconder páginas' : 'Ver páginas lado a lado'}
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => ir(sel - 1)} disabled={sel <= 0} title="Diferença anterior (k)">
                              <ChevronUp className="h-4 w-4" aria-hidden="true" /><span className="sr-only">Diferença anterior</span>
                            </Button>
                            <span className={cn('px-1 text-xs', tk.mono, tk.tintaFraca)}>{sel + 1}/{entradas.length}</span>
                            <Button type="button" variant="outline" size="sm" onClick={() => ir(sel + 1)} disabled={sel >= entradas.length - 1} title="Diferença seguinte (j)">
                              <ChevronDown className="h-4 w-4" aria-hidden="true" /><span className="sr-only">Diferença seguinte</span>
                            </Button>
                          </div>
                        </div>

                        <Legenda />

                        {verImagens && (
                          <div className="mb-4 grid grid-cols-2 gap-3">
                            {actual.tipo !== 'acrescentada' && actual.paginaA
                              ? <ImagemPagina obterPdf={obterPdfA} numero={actual.paginaA} legenda={`${nomeVersao(vA)} · página ${actual.paginaA}`} />
                              : <SemPagina texto={`Não existe na ${nomeVersao(vA)}.`} />}
                            {actual.tipo !== 'removida' && actual.paginaB
                              ? <ImagemPagina obterPdf={obterPdfB} numero={actual.paginaB} legenda={`${nomeVersao(vB)} · página ${actual.paginaB}`} />
                              : <SemPagina texto={`Não existe na ${nomeVersao(vB)}.`} />}
                          </div>
                        )}

                        <div className={cn('space-y-2 text-sm leading-relaxed', tk.tinta)}>
                          {actual.itens.map((it, k) => {
                            if (it.tipo === 'salto') {
                              return <p key={k} className={cn('select-none text-center text-xs', tk.tintaTenue)} aria-label="linhas sem alterações">⋯ sem alterações ⋯</p>;
                            }
                            if (it.tipo === 'contexto') {
                              return <p key={k} className={tk.tintaFraca}>{it.texto}</p>;
                            }
                            return (
                              <div key={k} className={cn('rounded-md border-l-4 border-amber-500 py-1.5 pl-3 pr-2 dark:border-amber-400', tk.superficieBaixa)}>
                                <Pedacos pedacos={it.pedacos} />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </section>
                </div>
              )}
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Contador({ icone: Icone, n, um, varios, cor }) {
  return (
    <span className={cn('inline-flex items-center gap-1', n ? cor : tk.tintaTenue)}>
      <Icone className="h-4 w-4" aria-hidden="true" />
      <strong className={tk.mono}>{n}</strong> {n === 1 ? um : varios}
    </span>
  );
}

function Legenda() {
  return (
    <p className={cn('mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs', tk.tintaFraca)}>
      <span className="inline-flex items-center gap-1">
        <Plus className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
        <ins className="rounded-sm bg-emerald-100 px-1 text-emerald-950 underline decoration-emerald-700 decoration-2 underline-offset-2 dark:bg-emerald-900/50 dark:text-emerald-50">acrescentado</ins>
      </span>
      <span className="inline-flex items-center gap-1">
        <Minus className="h-3.5 w-3.5 text-red-700 dark:text-red-300" aria-hidden="true" />
        <del className="rounded-sm bg-red-100 px-1 text-red-900 line-through decoration-red-700 decoration-2 dark:bg-red-900/40 dark:text-red-100">removido</del>
      </span>
      <span>Linhas a cinzento: contexto sem alterações.</span>
      <span>Teclas j / k: diferença seguinte / anterior.</span>
    </p>
  );
}

function SemPagina({ texto }) {
  return (
    <div className={cn('flex h-40 items-center justify-center rounded-lg border border-dashed text-xs', tk.borda, tk.tintaFraca)}>{texto}</div>
  );
}

function Aviso({ texto, tom }) {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-10">
      <p className={cn('flex max-w-xl items-start gap-2 text-sm', tom === 'perigo' ? tk.perigo : tk.tintaMedia)} role={tom === 'perigo' ? 'alert' : undefined}>
        {tom === 'perigo' && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}{texto}
      </p>
    </div>
  );
}

// Botão + diálogo, prontos a pôr no histórico de versões da ficha do documento. Só aparece quando há pelo menos duas
// revisões com PDF diferentes (as fontes editáveis contam pelo PDF da sua revisão) e o documento não está trancado.
export function BotaoCompararVersoes({ doc, versoes = [], vActual, desactivado = false, className }) {
  const [aberto, setAberto] = useState(false);
  const ficheiros = useMemo(() => new Set(versoes
    .map(v => pdfDaVersao(v, versoes))
    .filter(Boolean)
    .map(f => chaveFicheiro(f.versao))), [versoes]);
  if (desactivado || ficheiros.size < 2) return null;
  return (
    <div className={cn('flex items-center justify-between gap-2 border-b px-4 py-2', tk.borda, className)}>
      <span className={cn('text-xs', tk.tintaFraca)}>O que mudou entre duas revisões?</span>
      <Button type="button" size="sm" variant="outline" onClick={() => setAberto(true)}>
        <GitCompareArrows className="h-4 w-4" aria-hidden="true" />Comparar versões
      </Button>
      {aberto && <CompararVersoes aberto={aberto} onFechar={() => setAberto(false)} doc={doc} versoes={versoes} vActual={vActual} />}
    </div>
  );
}
