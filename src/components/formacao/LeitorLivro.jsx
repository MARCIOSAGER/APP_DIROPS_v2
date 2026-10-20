import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, AArrowUp, AArrowDown, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

// Leitor "em livro" para aulas de texto longas: o HTML é paginado com colunas CSS (uma, duas ou — em ecrã inteiro largo —
// três páginas por vista), vira-se com botões, teclado (← →), clique nas margens ou deslize; tamanho de letra, ecrã inteiro
// e memória da página (localStorage). Sem dependências — o conteúdo já vem sanitizado.
//
// Geometria (a chave para as páginas não ficarem desalinhadas): o bloco de conteúdo tem largura fixa igual à vista e
// padding PAD_X; com `column-count` explícito o navegador usa colunas de largura exacta (avail + GAP) / n - GAP, logo o
// passo entre colunas é (avail + GAP) / n e o passo entre páginas é avail + GAP, independentemente de arredondamentos.
const GAP = 56, PAD_X = 32, PAD_Y = 28;
const colunasPara = (w, cheio) => (cheio && w >= 1500 ? 3 : w >= 860 ? 2 : 1);
const emEcraInteiro = (el) => !!document.fullscreenElement && document.fullscreenElement === el;

export default function LeitorLivro({ html, titulo, chave }) {
  const outerRef = useRef(null), viewRef = useRef(null), contentRef = useRef(null);
  const [pagina, setPagina] = useState(() => { try { return Number(localStorage.getItem('livro:' + chave)) || 0; } catch { return 0; } });
  const [total, setTotal] = useState(1);
  const [fonte, setFonte] = useState(() => { try { return Number(localStorage.getItem('livro:fonte')) || 16; } catch { return 16; } });
  const [largura, setLargura] = useState(0);
  const [cheio, setCheio] = useState(false);
  const [virando, setVirando] = useState(null); // 'esq' | 'dir'
  const toque = useRef(null);
  const n = colunasPara(largura, cheio);
  const avail = Math.max(0, largura - 2 * PAD_X);
  const pitch = (avail + GAP) / n;   // distância entre inícios de colunas consecutivas
  const passo = avail + GAP;         // distância entre páginas (n colunas)

  const medir = useCallback(() => {
    const v = viewRef.current; if (!v) return;
    const w = v.clientWidth;
    setLargura(prev => (prev === w ? prev : w));          // a largura vem sempre da vista (o conteúdo só existe depois)
    if (!w || !contentRef.current) return;
    // depois de o layout aplicar as colunas, o scrollWidth (colunas de overflow incluídas) dá o número de colunas
    requestAnimationFrame(() => {
      const c = contentRef.current; if (!c) return;
      const nn = colunasPara(w, emEcraInteiro(outerRef.current));
      const pt = (Math.max(1, w - 2 * PAD_X) + GAP) / nn;
      const cols = Math.max(1, Math.round((c.scrollWidth - PAD_X + GAP) / pt));
      setTotal(Math.max(1, Math.ceil(cols / nn)));
    });
  }, []);
  useLayoutEffect(() => { medir(); }, [medir, html, fonte, largura, n, cheio]);
  useEffect(() => {
    const ro = new ResizeObserver(() => medir()); if (viewRef.current) ro.observe(viewRef.current);
    const f = () => setCheio(emEcraInteiro(outerRef.current));
    document.addEventListener('fullscreenchange', f);
    return () => { ro.disconnect(); document.removeEventListener('fullscreenchange', f); };
  }, [medir]);
  useEffect(() => { if (pagina > total - 1) setPagina(Math.max(0, total - 1)); }, [total, pagina]);
  useEffect(() => { try { localStorage.setItem('livro:' + chave, String(pagina)); } catch { /* */ } }, [pagina, chave]);
  useEffect(() => { try { localStorage.setItem('livro:fonte', String(fonte)); } catch { /* */ } }, [fonte]);

  const ir = (p) => { const alvo = Math.max(0, Math.min(total - 1, p)); if (alvo === pagina) return; setVirando(alvo > pagina ? 'dir' : 'esq'); setPagina(alvo); setTimeout(() => setVirando(null), 480); };
  const teclas = (e) => { if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); ir(pagina + 1); } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); ir(pagina - 1); } else if (e.key === 'Home') ir(0); else if (e.key === 'End') ir(total - 1); };
  const alternarCheio = () => { try { if (document.fullscreenElement) document.exitFullscreen(); else outerRef.current?.requestFullscreen?.(); } catch { /* */ } };
  const pct = total > 1 ? Math.round(((pagina + 1) / total) * 100) : 100;
  const primeira = pagina * n + 1, ultima = Math.min(pagina * n + n, total * n);

  return (
    <div ref={outerRef} className={cn('flex flex-col rounded-xl border bg-[#f5f1e8] shadow-sm outline-none dark:border-slate-800 dark:bg-slate-950', cheio && 'h-screen w-screen rounded-none border-0')} tabIndex={0} onKeyDown={teclas} role="region" aria-label={`Leitor: ${titulo}`} aria-roledescription="livro">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
        <span className="inline-flex items-center gap-1.5 font-medium"><BookOpen className="h-4 w-4 text-amber-700" aria-hidden="true" />{titulo}</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setFonte(f => Math.max(13, f - 1))} aria-label="Diminuir letra" disabled={fonte <= 13}><AArrowDown className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setFonte(f => Math.min(22, f + 1))} aria-label="Aumentar letra" disabled={fonte >= 22}><AArrowUp className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={alternarCheio} aria-label={cheio ? 'Sair do ecrã inteiro' : 'Ecrã inteiro'}>{cheio ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</Button>
        </div>
      </div>
      <div className={cn('relative flex-1', cheio ? 'min-h-0' : 'mx-3 mb-3')} style={{ perspective: '1600px' }}>
        <div ref={viewRef} className={cn('relative overflow-hidden bg-[#fdfcf8] shadow-[0_2px_12px_rgba(0,0,0,.12),inset_0_0_40px_rgba(0,0,0,.04)] dark:bg-slate-900', cheio ? 'h-full rounded-none' : 'h-[68vh] min-h-[440px] rounded-md')}
          onTouchStart={(e) => { toque.current = e.touches[0].clientX; }} onTouchEnd={(e) => { if (toque.current == null) return; const dx = e.changedTouches[0].clientX - toque.current; toque.current = null; if (Math.abs(dx) > 50) ir(pagina + (dx < 0 ? 1 : -1)); }}>
          {largura > 0 && (
            <div ref={contentRef} className="prose-aula text-slate-800 dark:text-slate-200" style={{ width: `${largura}px`, maxWidth: 'none', height: '100%', columnCount: n, columnGap: `${GAP}px`, columnFill: 'auto', fontSize: `${fonte}px`, lineHeight: 1.7, padding: `${PAD_Y}px ${PAD_X}px`, boxSizing: 'border-box', transform: `translateX(-${pagina * passo}px)`, transition: 'transform .45s cubic-bezier(.2,.7,.2,1)' }} dangerouslySetInnerHTML={{ __html: html }} />
          )}
          {Array.from({ length: Math.max(0, n - 1) }, (_, k) => (
            <div key={k} aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-10 -translate-x-1/2 bg-gradient-to-r from-transparent via-black/10 to-transparent" style={{ left: `${PAD_X + (k + 1) * pitch - GAP / 2}px` }} />
          ))}
          {virando && <div aria-hidden="true" className={cn('pointer-events-none absolute inset-y-0 w-1/2 bg-gradient-to-r from-black/15 to-transparent', virando === 'dir' ? 'right-0 rotate-180' : 'left-0')} style={{ animation: 'livro-sombra .45s ease-out both' }} />}
          <button type="button" className="absolute inset-y-0 left-0 w-[12%] cursor-w-resize opacity-0 focus-visible:opacity-100" onClick={() => ir(pagina - 1)} aria-label="Página anterior" disabled={pagina === 0} />
          <button type="button" className="absolute inset-y-0 right-0 w-[12%] cursor-e-resize opacity-0 focus-visible:opacity-100" onClick={() => ir(pagina + 1)} aria-label="Página seguinte" disabled={pagina >= total - 1} />
        </div>
      </div>
      <div className={cn('flex items-center gap-3 px-3', cheio ? 'py-2' : 'pb-3')}>
        <Button variant="outline" size="sm" onClick={() => ir(pagina - 1)} disabled={pagina === 0} aria-label="Página anterior"><ChevronLeft className="h-4 w-4" aria-hidden="true" />Anterior</Button>
        <div className="flex-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10"><div className="h-full rounded-full bg-amber-600 transition-[width]" style={{ width: `${pct}%` }} /></div>
          <p className="mt-1 text-center text-xs tabular-nums text-slate-600 dark:text-slate-400">{n > 1 ? `Páginas ${primeira}–${ultima} de ${total * n}` : `Página ${pagina + 1} de ${total}`} · {pct}%</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => ir(pagina + 1)} disabled={pagina >= total - 1} aria-label="Página seguinte">Seguinte<ChevronRight className="h-4 w-4" aria-hidden="true" /></Button>
      </div>
      <style>{'@keyframes livro-sombra{from{opacity:.9}to{opacity:0}}'}</style>
    </div>
  );
}
