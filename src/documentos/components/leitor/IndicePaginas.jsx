// Índice do documento aberto: as secções que o próprio PDF declara (os marcadores) e a lista de páginas em
// miniatura. Serve a pergunta «onde é que isto está?» sem obrigar a folhear.
//
// As miniaturas desenham-se só quando entram na vista (IntersectionObserver) e uma de cada vez: num manual de
// 160 páginas, desenhar tudo de uma vez num portátil de serviço bloqueia o separador por segundos.
import React, { useEffect, useRef, useState } from 'react';
import { ChevronRight, ListTree, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { tk } from '@/documentos/pages/PortalBiblioteca';

function Miniatura({ pdf, numero, largura = 92 }) {
  const ref = useRef(null);
  const [visivel, setVisivel] = useState(false);
  const [pronta, setPronta] = useState(false);

  useEffect(() => {
    const no = ref.current;
    if (!no || visivel) return undefined;
    if (typeof IntersectionObserver === 'undefined') { setVisivel(true); return undefined; }
    const obs = new IntersectionObserver((entradas) => {
      if (entradas.some(e => e.isIntersecting)) { setVisivel(true); obs.disconnect(); }
    }, { rootMargin: '200px' });
    obs.observe(no);
    return () => obs.disconnect();
  }, [visivel]);

  useEffect(() => {
    if (!visivel || !pdf || pronta) return undefined;
    let vivo = true;
    (async () => {
      try {
        const pag = await pdf.getPage(numero);
        if (!vivo || !ref.current) return;
        const base = pag.getViewport({ scale: 1 });
        const vp = pag.getViewport({ scale: largura / base.width });
        const canvas = ref.current;
        canvas.width = Math.floor(vp.width);
        canvas.height = Math.floor(vp.height);
        canvas.style.height = `${Math.floor(vp.height)}px`;
        await pag.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
        if (vivo) setPronta(true);
      } catch { /* uma miniatura que não sai não impede navegar pelo número */ }
    })();
    return () => { vivo = false; };
  }, [visivel, pdf, numero, largura, pronta]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      style={{ width: largura, height: Math.round(largura * 1.41) }}
      className={cn('shrink-0 rounded border bg-white', tk.borda)}
    />
  );
}

export default function IndicePaginas({ pdf, total, pagina, onIr, secoes, paginasComAcerto, rotulos, aoFechar }) {
  const listaRef = useRef(null);

  // Manter a página em uso à vista quando ela muda por outra via (teclado, pesquisa, endereço).
  useEffect(() => {
    const alvo = listaRef.current?.querySelector(`[data-pagina="${pagina}"]`);
    alvo?.scrollIntoView({ block: 'nearest' });
  }, [pagina]);

  const paginas = Array.from({ length: Math.max(0, total) }, (_, i) => i + 1);

  return (
    <nav
      id="gd-leitor-indice"
      aria-label="Índice do documento"
      className={cn('flex max-h-[72vh] w-56 shrink-0 flex-col border-r', tk.borda, tk.superficieBaixa)}
    >
      <p className={cn('flex items-center gap-2 border-b px-3 py-2 text-xs font-semibold uppercase tracking-wider', tk.borda, tk.tintaFraca)}>
        <ListTree className="h-3.5 w-3.5" aria-hidden="true" />Índice
      </p>

      {Array.isArray(secoes) && secoes.length > 0 && (
        <div className={cn('border-b', tk.borda)}>
          <p className={cn('px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider', tk.tintaFraca)}>Secções</p>
          <ul className="max-h-48 overflow-y-auto pb-1">
            {secoes.map((s, i) => (
              <li key={`${s.titulo}-${i}`}>
                <button
                  type="button"
                  onClick={() => onIr(s.pagina)}
                  className={cn('flex min-h-[2.75rem] w-full items-center gap-1.5 px-3 py-1.5 text-left text-sm', tk.hover, tk.foco, tk.tintaMedia)}
                  style={{ paddingLeft: `${0.75 + (s.nivel || 0) * 0.75}rem` }}
                >
                  <ChevronRight className={cn('h-3 w-3 shrink-0', tk.tintaTenue)} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{s.titulo}</span>
                  <span className={cn('shrink-0 text-xs', tk.mono, tk.tintaFraca)}>{s.pagina}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className={cn('px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider', tk.tintaFraca)}>
        Páginas <span className={tk.mono}>({total})</span>
      </p>
      <ul ref={listaRef} className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {paginas.map(n => {
          const activa = n === pagina;
          const acerto = paginasComAcerto?.has?.(n);
          return (
            <li key={n}>
              <button
                type="button"
                data-pagina={n}
                aria-current={activa ? 'true' : undefined}
                onClick={() => onIr(n)}
                className={cn('mb-1 flex w-full items-center gap-2 rounded-lg border p-1.5 text-left', tk.foco,
                  activa ? cn(tk.acentoBorda, tk.acentoFundo) : cn('border-transparent', tk.hover))}
              >
                <Miniatura pdf={pdf} numero={n} />
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-sm font-semibold', tk.mono, activa ? tk.acento : tk.tintaMedia)}>{n}</span>
                  {rotulos?.get?.(n) && rotulos.get(n) !== `Página ${n}` && (
                    <span className={cn('mt-0.5 block text-xs leading-tight', tk.tintaFraca)}>{rotulos.get(n)}</span>
                  )}
                  {acerto && (
                    <span className={cn('mt-1 inline-flex items-center gap-1 text-xs font-medium', tk.acento)}>
                      <Search className="h-3 w-3" aria-hidden="true" />tem o termo
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={aoFechar}
        className={cn('min-h-[2.75rem] border-t px-3 text-sm', tk.borda, tk.tintaFraca, tk.hover, tk.foco)}
      >
        Fechar o índice
      </button>
    </nav>
  );
}
