// Procurar dentro do documento aberto. A caixa, a lista de páginas e o que cada estado quer dizer.
//
// Apresentação apenas: quem procura é o leitor (LeitorPdf), porque o termo também serve para realçar a página e
// para marcar as páginas no índice. O painel diz sempre DE ONDE veio a resposta — do servidor, da cópia offline,
// ou de nenhum dos dois porque o conteúdo deste ficheiro ainda não foi indexado. «Não encontrei» sem dizer onde
// procurou é uma afirmação que não se pode citar numa auditoria.
import React, { useEffect, useRef } from 'react';
import { Loader2, Search, SearchX, WifiOff, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { tk } from '@/documentos/pages/PortalBiblioteca';
import { MINIMO_TERMO } from './paginaTexto';

function Excerto({ pedacos }) {
  return (
    <span className={cn('block text-sm leading-relaxed', tk.tintaMedia)}>
      {pedacos.map((p, i) => (p.achado
        ? <mark key={i} className="rounded bg-amber-200 px-0.5 text-slate-900 dark:bg-amber-400/40 dark:text-amber-50">{p.texto}</mark>
        : <React.Fragment key={i}>{p.texto}</React.Fragment>))}
    </span>
  );
}

export default function PesquisaNoDocumento({
  termo, onTermo, aProcurar, resultados, fonte, paginaActual, onIr, aoFechar, indexado, focar,
}) {
  const caixaRef = useRef(null);
  // Só rouba o foco quando foi a pessoa a abrir o painel. Quem chega pela pesquisa global vem ler: atirar-lhe o
  // foco para dentro de uma caixa de escrita desligava-lhe os atalhos do leitor sem o ter pedido.
  useEffect(() => { if (focar) caixaRef.current?.focus(); }, [focar]);

  const curto = termo.trim().length > 0 && termo.trim().length < MINIMO_TERMO;
  const totalPaginas = resultados?.length || 0;

  return (
    <section
      id="gd-leitor-pesquisa"
      aria-label="Procurar dentro do documento"
      className={cn('flex max-h-[72vh] w-72 shrink-0 flex-col border-r', tk.borda, tk.superficieBaixa)}
    >
      <div className={cn('flex items-center gap-1 border-b p-2', tk.borda)}>
        <div className="relative min-w-0 flex-1">
          <Search className={cn('pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2', tk.tintaTenue)} aria-hidden="true" />
          <Input
            ref={caixaRef}
            type="search"
            value={termo}
            onChange={e => onTermo(e.target.value)}
            placeholder="Procurar no documento"
            aria-label="Procurar dentro deste documento"
            aria-describedby="gd-pesquisa-estado"
            className="min-h-[2.75rem] pl-8"
          />
        </div>
        <button
          type="button"
          onClick={aoFechar}
          aria-label="Fechar a pesquisa no documento"
          className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-lg', tk.tintaFraca, tk.hover, tk.foco)}
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {/* o estado é anunciado: quem usa leitor de ecrã não vê a lista a encher-se */}
      <p id="gd-pesquisa-estado" role="status" aria-live="polite" className={cn('px-3 py-2 text-sm', tk.tintaFraca)}>
        {curto ? `Escreva pelo menos ${MINIMO_TERMO} letras.`
          : aProcurar ? <span className="inline-flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />A procurar…</span>
            : !termo.trim() ? (indexado === 0
              ? 'O conteúdo deste ficheiro ainda não foi indexado, por isso não há onde procurar dentro dele.'
              : 'Procura no texto do ficheiro e diz em que páginas está.')
              : totalPaginas === 0 ? 'Nenhuma página com este termo.'
                : totalPaginas === 1 ? 'Encontrado em 1 página.' : `Encontrado em ${totalPaginas} páginas.`}
      </p>

      {fonte === 'offline' && (
        <p className={cn('mx-2 mb-2 flex items-start gap-2 rounded-lg border px-2.5 py-2 text-xs', tk.avisoBorda, tk.avisoFundo, tk.tintaMedia)}>
          <WifiOff className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', tk.aviso)} aria-hidden="true" />
          Procurado no índice guardado com a cópia offline, não no servidor.
        </p>
      )}
      {fonte === 'indisponivel' && termo.trim().length >= MINIMO_TERMO && (
        <p className={cn('mx-2 mb-2 flex items-start gap-2 rounded-lg border px-2.5 py-2 text-xs', tk.avisoBorda, tk.avisoFundo, tk.tintaMedia)}>
          <SearchX className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', tk.aviso)} aria-hidden="true" />
          Sem rede e sem índice guardado: não foi possível procurar dentro do ficheiro. O realce continua a
          funcionar na página que está a ver.
        </p>
      )}

      <ul className={cn('min-h-0 flex-1 divide-y overflow-y-auto border-t', tk.divisoria, tk.borda)}>
        {(resultados || []).map(r => {
          const activa = r.paginaFonte === paginaActual;
          return (
            <li key={`${r.pagina}-${r.paginaFonte}`}>
              <button
                type="button"
                onClick={() => onIr(r.paginaFonte)}
                aria-current={activa ? 'true' : undefined}
                className={cn('min-h-[2.75rem] w-full px-3 py-2.5 text-left', tk.foco, activa ? tk.seleccionada : tk.hover)}
              >
                <span className={cn('block text-xs font-semibold uppercase tracking-wider', activa ? tk.acento : tk.tintaFraca)}>
                  {r.rotulo}
                </span>
                {r.excertos.length > 0
                  ? r.excertos.map((pedacos, i) => <Excerto key={i} pedacos={pedacos} />)
                  : (
                    <span className={cn('mt-0.5 block text-sm', tk.tintaFraca)}>
                      {r.temTexto
                        ? 'Casa pela forma da palavra (plural, conjugação).'
                        : 'Tem o termo — abra a página para o ver realçado.'}
                    </span>
                  )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
