// A barra do leitor: onde estou, como ando, quanto vejo — e os atalhos ditos em voz alta.
//
// Ordem deliberada da esquerda para a direita: o que abre painéis, depois a navegação (que é o que se usa mais),
// depois o zoom, e por fim a cópia offline. Todos os alvos têm 44px de lado, porque isto é usado de pé, com uma
// mão, num tablet de serviço.
//
// A caixa da página é um `input` e não só um rótulo: «ir para a página N» é um pedido frequente num manual de 160
// páginas e não deve obrigar a folhear. Escreve-se o número e dá-se Enter; sair da caixa também confirma.
import React, { useEffect, useState } from 'react';
import {
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Keyboard, ListTree, Maximize, Search, ZoomIn, ZoomOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { tk } from '@/documentos/pages/PortalBiblioteca';

export const ATALHOS = [
  ['Página seguinte', '→  ou  Page Down'],
  ['Página anterior', '←  ou  Page Up'],
  ['Primeira página', 'Home'],
  ['Última página', 'End'],
  ['Procurar no documento', '/'],
  ['Acerto seguinte / anterior na página', 'n  /  Shift + n'],
  ['Aproximar / afastar', '+  /  −'],
  ['Voltar à largura da página', '0'],
  ['Fechar os painéis abertos', 'Esc'],
];

// Um botão que abre um painel diz `aria-expanded`; um que liga/desliga um estado diz `aria-pressed`. Dizer os
// dois no mesmo botão deixa o leitor de ecrã a anunciar duas coisas diferentes sobre a mesma coisa.
function Carregador({ accao, titulo, children, disabled, activo, controla }) {
  return (
    <button
      type="button"
      onClick={accao}
      disabled={disabled}
      title={titulo}
      aria-label={titulo}
      aria-pressed={controla || activo === undefined ? undefined : activo}
      aria-expanded={controla ? !!activo : undefined}
      aria-controls={controla}
      className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border', tk.foco,
        disabled ? cn('cursor-not-allowed border-transparent', tk.tintaTenue)
          : activo ? cn(tk.acentoBorda, tk.acentoFundo, tk.acento)
            : cn('border-transparent', tk.tintaMedia, tk.hover))}
    >
      {children}
    </button>
  );
}

export default function BarraLeitor({
  pagina, total, onIr, escala, onEscala, onAjustar,
  indiceAberto, onIndice, pesquisaAberta, onPesquisa,
  acertos, acertoActivo, onAcerto, offline,
}) {
  const [campo, setCampo] = useState(String(pagina || 1));
  useEffect(() => { setCampo(String(pagina || 1)); }, [pagina]);

  const confirmar = () => {
    const n = parseInt(campo, 10);
    if (Number.isFinite(n) && n >= 1 && n <= total) onIr(n);
    else setCampo(String(pagina));
  };

  return (
    <div className={cn('flex flex-wrap items-center gap-x-1 gap-y-2 border-b px-2 py-2', tk.borda, tk.superficieBaixa)}>
      <Carregador accao={onIndice} titulo="Índice de páginas e secções" activo={indiceAberto} controla="gd-leitor-indice">
        <ListTree className="h-5 w-5" aria-hidden="true" />
      </Carregador>
      <Carregador accao={onPesquisa} titulo="Procurar dentro do documento (tecla /)" activo={pesquisaAberta} controla="gd-leitor-pesquisa">
        <Search className="h-5 w-5" aria-hidden="true" />
      </Carregador>

      <span className={cn('mx-1 hidden h-6 w-px sm:block', 'bg-slate-200 dark:bg-slate-800')} aria-hidden="true" />

      <Carregador accao={() => onIr(1)} titulo="Primeira página (Home)" disabled={pagina <= 1}>
        <ChevronsLeft className="h-5 w-5" aria-hidden="true" />
      </Carregador>
      <Carregador accao={() => onIr(pagina - 1)} titulo="Página anterior (← ou Page Up)" disabled={pagina <= 1}>
        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
      </Carregador>

      <span className={cn('inline-flex items-center gap-1.5 px-1 text-sm', tk.tintaMedia)}>
        <label htmlFor="gd-leitor-pagina" className="sr-only">Ir para a página</label>
        <input
          id="gd-leitor-pagina"
          type="text"
          inputMode="numeric"
          value={campo}
          onChange={e => setCampo(e.target.value.replace(/[^0-9]/g, ''))}
          onBlur={confirmar}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); confirmar(); } }}
          className={cn('h-11 w-14 rounded-lg border px-2 text-center text-sm', tk.mono, tk.borda, tk.superficie, tk.tinta, tk.foco)}
        />
        <span className={cn('whitespace-nowrap', tk.tintaFraca)}>de <span className={tk.mono}>{total || '—'}</span></span>
      </span>

      <Carregador accao={() => onIr(pagina + 1)} titulo="Página seguinte (→ ou Page Down)" disabled={!total || pagina >= total}>
        <ChevronRight className="h-5 w-5" aria-hidden="true" />
      </Carregador>
      <Carregador accao={() => onIr(total)} titulo="Última página (End)" disabled={!total || pagina >= total}>
        <ChevronsRight className="h-5 w-5" aria-hidden="true" />
      </Carregador>

      {acertos > 0 && (
        <span className={cn('ml-1 inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium', tk.acentoBorda, tk.acentoFundo, tk.acento)}>
          <span role="status" aria-live="polite">
            {acertos === 1 ? '1 acerto nesta página' : `acerto ${acertoActivo + 1} de ${acertos} nesta página`}
          </span>
          <button
            type="button"
            onClick={() => onAcerto(-1)}
            aria-label="Acerto anterior nesta página (Shift + n)"
            className={cn('flex h-11 w-11 items-center justify-center rounded', tk.foco, tk.hover)}
          ><ChevronLeft className="h-4 w-4" aria-hidden="true" /></button>
          <button
            type="button"
            onClick={() => onAcerto(1)}
            aria-label="Acerto seguinte nesta página (n)"
            className={cn('flex h-11 w-11 items-center justify-center rounded', tk.foco, tk.hover)}
          ><ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
        </span>
      )}

      <span className="flex-1" />

      <Carregador accao={() => onEscala(escala - 0.25)} titulo="Afastar (tecla −)" disabled={escala <= 0.5}>
        <ZoomOut className="h-5 w-5" aria-hidden="true" />
      </Carregador>
      <span className={cn('w-12 text-center text-xs', tk.mono, tk.tintaFraca)}>{Math.round(escala * 100)}%</span>
      <Carregador accao={() => onEscala(escala + 0.25)} titulo="Aproximar (tecla +)" disabled={escala >= 3}>
        <ZoomIn className="h-5 w-5" aria-hidden="true" />
      </Carregador>
      <Carregador accao={onAjustar} titulo="Ajustar à largura (tecla 0)" disabled={escala === 1}>
        <Maximize className="h-5 w-5" aria-hidden="true" />
      </Carregador>

      <details className="relative">
        <summary
          className={cn('flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-lg', tk.tintaMedia, tk.hover, tk.foco)}
          title="Atalhos de teclado"
          aria-label="Atalhos de teclado"
        >
          <Keyboard className="h-5 w-5" aria-hidden="true" />
        </summary>
        <div className={cn('absolute right-0 top-12 z-20 w-72 max-w-[calc(100vw-2rem)] rounded-xl border p-3 shadow-lg', tk.borda, tk.superficie)}>
          <p className={cn('mb-2 text-xs font-semibold uppercase tracking-wider', tk.tintaFraca)}>Atalhos de teclado</p>
          <dl className="space-y-1.5">
            {ATALHOS.map(([que, tecla]) => (
              <div key={que} className="flex items-baseline justify-between gap-3">
                <dt className={cn('text-sm', tk.tintaMedia)}>{que}</dt>
                <dd className={cn('shrink-0 rounded border px-1.5 py-0.5 text-xs', tk.mono, tk.borda, tk.tintaFraca)}>{tecla}</dd>
              </div>
            ))}
          </dl>
          <p className={cn('mt-2 text-xs', tk.tintaFraca)}>
            Funcionam quando o foco está no leitor ou em nenhum campo de escrita.
          </p>
        </div>
      </details>

      {offline}
    </div>
  );
}
