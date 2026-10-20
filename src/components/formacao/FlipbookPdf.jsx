import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
// O worker é servido como .js a partir de public/pdfjs (cópia de node_modules/pdfjs-dist/build/pdf.worker.min.mjs): o nginx
// entrega .mjs como application/octet-stream e, com X-Content-Type-Options: nosniff, o Chrome recusa o module worker.
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, ZoomIn, ZoomOut, LayoutGrid, Loader2, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.js';

// "Flipbook" de PDF dentro da plataforma (pdf.js): páginas lado a lado como um livro aberto, virar com botões,
// teclado, clique nas margens ou deslize, miniaturas, zoom, ecrã inteiro e memória da página. Sem sair da app.
const cacheRender = new Map(); // `${docId}:${pagina}:${largura}` -> ImageBitmap/canvas
export default function FlipbookPdf({ url, titulo, chave, onErro }) {
  const outerRef = useRef(null), viewRef = useRef(null), esqRef = useRef(null), dirRef = useRef(null);
  const [doc, setDoc] = useState(null);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(() => { try { return Math.max(1, Number(localStorage.getItem('pdf:' + chave)) || 1); } catch { return 1; } });
  const [largura, setLargura] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [cheio, setCheio] = useState(false);
  const [miniaturas, setMiniaturas] = useState(false);
  const [aRender, setARender] = useState(false);
  const [virando, setVirando] = useState(null);
  const [erro, setErro] = useState('');
  const docId = useRef(Math.random().toString(36).slice(2));
  const toque = useRef(null);
  const duas = largura >= 900 && zoom <= 1;
  const viewH = cheio ? window.innerHeight - 150 : Math.max(440, Math.round(window.innerHeight * 0.68));

  useEffect(() => {
    let cancel = false;
    setDoc(null); setErro('');
    pdfjsLib.getDocument({ url, cMapUrl: undefined, disableAutoFetch: false }).promise.then(d => { if (cancel) return; setDoc(d); setTotal(d.numPages); }).catch(e => { if (!cancel) { setErro(e?.message || 'PDF inválido'); onErro?.(e); } });
    return () => { cancel = true; };
  }, [url]);
  useEffect(() => {
    const ro = new ResizeObserver(() => { if (viewRef.current) setLargura(viewRef.current.clientWidth); });
    if (viewRef.current) { ro.observe(viewRef.current); setLargura(viewRef.current.clientWidth); }
    const f = () => setCheio(!!document.fullscreenElement && document.fullscreenElement === outerRef.current);
    document.addEventListener('fullscreenchange', f);
    return () => { ro.disconnect(); document.removeEventListener('fullscreenchange', f); };
  }, []);
  useEffect(() => { try { localStorage.setItem('pdf:' + chave, String(pagina)); } catch { /* */ } }, [pagina, chave]);

  // largura de cada página (em CSS px) para caber na vista
  const pagW = duas ? Math.floor((largura - 24) / 2) : Math.floor(Math.min(largura, largura * zoom));
  const renderPagina = useCallback(async (n, canvas, w) => {
    if (!doc || !canvas || n < 1 || n > total) return;
    const key = `${docId.current}:${n}:${w}`;
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const scale = w / base.width;
    const vp = page.getViewport({ scale });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(vp.width * dpr); canvas.height = Math.floor(vp.height * dpr);
    canvas.style.width = `${Math.floor(vp.width)}px`; canvas.style.height = `${Math.floor(vp.height)}px`;
    const ctx = canvas.getContext('2d');
    if (cacheRender.has(key)) { ctx.drawImage(cacheRender.get(key), 0, 0); return; }
    await page.render({ canvasContext: ctx, viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null }).promise;
    try { const copia = document.createElement('canvas'); copia.width = canvas.width; copia.height = canvas.height; copia.getContext('2d').drawImage(canvas, 0, 0); cacheRender.set(key, copia); if (cacheRender.size > 24) cacheRender.delete(cacheRender.keys().next().value); } catch { /* */ }
  }, [doc, total]);

  // páginas visíveis: em modo livro a página 1 fica sozinha à direita (capa), depois pares (2-3, 4-5…)
  const esquerda = duas ? (pagina % 2 === 0 ? pagina : pagina - 1) : pagina;
  const direita = duas ? (pagina % 2 === 0 ? pagina + 1 : pagina) : null;
  useEffect(() => {
    if (!doc || !pagW) return;
    let cancel = false; setARender(true);
    (async () => {
      try {
        if (duas) { if (esquerda >= 1) await renderPagina(esquerda, esqRef.current, pagW); if (direita <= total) await renderPagina(direita, dirRef.current, pagW); }
        else await renderPagina(pagina, esqRef.current, pagW);
        // pré-carregar as seguintes
        [pagina + 1, pagina + 2].forEach(n => { if (n <= total) doc.getPage(n).catch(() => {}); });
      } catch (e) { if (!cancel) setErro(e?.message || 'Falha ao desenhar a página'); }
      finally { if (!cancel) setARender(false); }
    })();
    return () => { cancel = true; };
  }, [doc, pagina, pagW, duas, esquerda, direita, total, renderPagina]);

  const ir = (n) => { const alvo = Math.max(1, Math.min(total, n)); if (alvo === pagina) return; setVirando(alvo > pagina ? 'dir' : 'esq'); setPagina(alvo); setTimeout(() => setVirando(null), 480); };
  const passo = duas ? 2 : 1;
  const teclas = (e) => { if (e.target.tagName === 'INPUT') return; if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); ir(pagina + passo); } else if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); ir(pagina - passo); } else if (e.key === 'Home') ir(1); else if (e.key === 'End') ir(total); else if (e.key === '+') setZoom(z => Math.min(2, z + 0.25)); else if (e.key === '-') setZoom(z => Math.max(1, z - 0.25)); };
  const alternarCheio = () => { try { if (document.fullscreenElement) document.exitFullscreen(); else outerRef.current?.requestFullscreen?.(); } catch { /* */ } };
  const pct = total ? Math.round((Math.min(total, direita && direita <= total ? direita : pagina) / total) * 100) : 0;

  if (erro) return (
    <div className="flex h-[40vh] flex-col items-center justify-center gap-3 rounded-xl border bg-slate-50 text-center dark:border-slate-700 dark:bg-slate-900">
      <FileText className="h-10 w-10 text-slate-400" aria-hidden="true" /><p className="max-w-sm px-4 text-sm text-slate-600 dark:text-slate-400">Não foi possível apresentar o PDF como livro ({erro}). Abra-o em nova aba ou descarregue-o.</p>
    </div>
  );
  return (
    <div ref={outerRef} className={cn('flex flex-col rounded-xl border bg-[#eae6dd] shadow-sm outline-none dark:border-slate-800 dark:bg-slate-950', cheio && 'h-screen rounded-none p-3')} tabIndex={0} onKeyDown={teclas} role="region" aria-label={`Documento: ${titulo}`} aria-roledescription="livro">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs text-slate-700 dark:text-slate-300">
        <span className="inline-flex min-w-0 items-center gap-1.5 font-medium"><FileText className="h-4 w-4 text-amber-700" aria-hidden="true" /><span className="truncate">{titulo}</span>{aRender && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" aria-hidden="true" />}</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.max(1, z - 0.25))} disabled={zoom <= 1} aria-label="Reduzir"><ZoomOut className="h-4 w-4" /></Button>
          <span className="w-10 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.min(2, z + 0.25))} disabled={zoom >= 2} aria-label="Ampliar"><ZoomIn className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className={cn('h-7 w-7', miniaturas && 'bg-black/10')} onClick={() => setMiniaturas(m => !m)} aria-pressed={miniaturas} aria-label="Miniaturas das páginas"><LayoutGrid className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={alternarCheio} aria-label={cheio ? 'Sair do ecrã inteiro' : 'Ecrã inteiro'}>{cheio ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</Button>
        </div>
      </div>
      <div ref={viewRef} className="relative mx-3 overflow-auto" style={{ height: viewH, perspective: '1800px' }}
        onTouchStart={(e) => { toque.current = e.touches[0].clientX; }} onTouchEnd={(e) => { if (toque.current == null) return; const dx = e.changedTouches[0].clientX - toque.current; toque.current = null; if (Math.abs(dx) > 50) ir(pagina + (dx < 0 ? passo : -passo)); }}>
        {!doc && <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />A abrir o documento…</div>}
        {doc && (
          <div className={cn('flex min-h-full items-start justify-center gap-0', zoom > 1 ? 'w-max min-w-full' : '')}>
            {duas && (esquerda >= 1 ? <canvas ref={esqRef} className="block bg-white shadow-[6px_0_18px_-8px_rgba(0,0,0,.45)]" aria-label={`Página ${esquerda}`} /> : <div style={{ width: pagW }} aria-hidden="true" />)}
            {!duas && <canvas ref={esqRef} className="block bg-white shadow-lg" aria-label={`Página ${pagina}`} />}
            {duas && (direita <= total ? <canvas ref={dirRef} className="block bg-white shadow-[-6px_0_18px_-8px_rgba(0,0,0,.45)]" aria-label={`Página ${direita}`} /> : <div style={{ width: pagW }} aria-hidden="true" />)}
          </div>
        )}
        {duas && doc && <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-1/2 w-8 -translate-x-1/2 bg-gradient-to-r from-transparent via-black/15 to-transparent" />}
        {virando && <div aria-hidden="true" className={cn('pointer-events-none absolute inset-y-0 w-1/2 bg-gradient-to-r from-black/20 to-transparent', virando === 'dir' ? 'right-0 rotate-180' : 'left-0')} style={{ animation: 'livro-sombra .45s ease-out both' }} />}
        {zoom <= 1 && <>
          <button type="button" className="absolute inset-y-0 left-0 w-[10%] cursor-w-resize opacity-0 focus-visible:opacity-100" onClick={() => ir(pagina - passo)} aria-label="Página anterior" disabled={pagina <= 1} />
          <button type="button" className="absolute inset-y-0 right-0 w-[10%] cursor-e-resize opacity-0 focus-visible:opacity-100" onClick={() => ir(pagina + passo)} aria-label="Página seguinte" disabled={pagina >= total} />
        </>}
      </div>
      {miniaturas && doc && <Miniaturas doc={doc} total={total} atual={pagina} onIr={(n) => { ir(n); }} renderPagina={renderPagina} />}
      <div className="flex items-center gap-3 px-3 py-3">
        <Button variant="outline" size="sm" onClick={() => ir(pagina - passo)} disabled={pagina <= 1} aria-label="Página anterior"><ChevronLeft className="h-4 w-4" aria-hidden="true" />Anterior</Button>
        <div className="flex-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10"><div className="h-full rounded-full bg-amber-600 transition-[width]" style={{ width: `${pct}%` }} /></div>
          <p className="mt-1 flex items-center justify-center gap-1 text-xs tabular-nums text-slate-600 dark:text-slate-400">Página <Input type="number" min={1} max={total || 1} value={pagina} onChange={(e) => { const n = Number(e.target.value); if (n >= 1 && n <= total) setPagina(n); }} className="h-6 w-14 px-1 text-center text-xs" aria-label="Ir para a página" /> de {total || '…'}{duas && direita <= total && ` (${esquerda}–${direita})`} · {pct}%</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => ir(pagina + passo)} disabled={pagina >= total} aria-label="Página seguinte">Seguinte<ChevronRight className="h-4 w-4" aria-hidden="true" /></Button>
      </div>
      <style>{'@keyframes livro-sombra{from{opacity:.9}to{opacity:0}}'}</style>
    </div>
  );
}

function Miniaturas({ doc, total, atual, onIr, renderPagina }) {
  const refs = useRef({});
  useEffect(() => {
    let cancel = false;
    (async () => { for (let n = 1; n <= total && !cancel; n++) { const c = refs.current[n]; if (c && !c.dataset.ok) { try { await renderPagina(n, c, 96); c.dataset.ok = '1'; } catch { /* */ } } } })();
    return () => { cancel = true; };
  }, [doc, total, renderPagina]);
  return (
    <div className="mx-3 flex gap-2 overflow-x-auto rounded-md bg-black/5 p-2 dark:bg-white/5" role="list" aria-label="Miniaturas">
      {Array.from({ length: total }, (_, i) => i + 1).map(n => (
        <button key={n} type="button" role="listitem" onClick={() => onIr(n)} className={cn('shrink-0 rounded border-2 bg-white p-0.5 text-[10px] text-slate-600', n === atual ? 'border-amber-600' : 'border-transparent hover:border-slate-400')} aria-label={`Página ${n}`} aria-current={n === atual ? 'page' : undefined}>
          <canvas ref={(el) => { refs.current[n] = el; }} className="block" style={{ width: 96, height: 128 }} /><span className="block text-center">{n}</span>
        </button>
      ))}
    </div>
  );
}
