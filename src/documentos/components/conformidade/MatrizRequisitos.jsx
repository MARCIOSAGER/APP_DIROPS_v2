// A matriz: uma linha por requisito, com o que a cumpre à vista (migração 159).
//
// É a resposta à pergunta que a ANAC faz — «onde está, no vosso Manual de Operações, o que cumpre o parágrafo
// X?» — e por isso a coluna que mais importa é a última que se olha: «onde está». Quando está vazia, está
// vazia a vermelho, porque é um buraco de conformidade e não um campo em falta.
//
// Desenho (docs/desenho-portal-documentos.md): tabela densa, cabeçalho fixo, sem zebra, acções sempre focáveis
// por teclado (nunca só visíveis ao passar o rato), e o requisito aberto mostra as provas por extenso sem sair
// da lista. O parágrafo em monoespaçado com algarismos tabulares, porque é uma referência.
import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, CircleSlash, FileText, Pencil, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { fmtData } from '@/lib/safeDate';
import { PORTAL_BASE } from '@/lib/portalDocumentos';
import { tk, cartao, urlDoc, pessoaDeEmail, Vazio, Falha, EsqueletoTabela } from '../../pages/PortalBiblioteca';
import { Artigo, ReferenciaProva, SeloCobertura, SeloCritico, SeloGrau, SeloReconfirmar } from './comuns';

const COLS = 5;

// Resumo de «onde está», para a linha fechada. Mostra a primeira prova por extenso e conta as outras: o detalhe
// de todas abre-se na linha, e repetir aqui cinco referências tornaria a tabela ilegível.
function OndeEsta({ r }) {
  const provas = r.provas || [];
  if (!provas.length) {
    return (
      <span className={cn('inline-flex items-center gap-1.5 text-sm font-medium', tk.perigo)}>
        <CircleSlash className="h-4 w-4 shrink-0" aria-hidden="true" />Nada a apontar
      </span>
    );
  }
  const p = provas[0];
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="flex min-w-0 items-baseline gap-1.5">
        <FileText className={cn('h-3.5 w-3.5 shrink-0 translate-y-0.5', tk.tintaFraca)} aria-hidden="true" />
        <span style={{ fontVariantNumeric: 'tabular-nums' }} className={cn('truncate text-sm', tk.mono, tk.tintaMedia)}>
          {p.documento_numero || p.documento_titulo || 'documento'}
        </span>
      </span>
      <span className="flex flex-wrap items-baseline gap-x-2">
        <ReferenciaProva prova={p} />
        {provas.length > 1 && (
          <span className={cn('text-sm', tk.tintaFraca)}>
            e {provas.length - 1} {provas.length - 1 === 1 ? 'outra' : 'outras'}
          </span>
        )}
      </span>
    </span>
  );
}

// ── detalhe de uma prova, na linha aberta ───────────────────────────────────
function Prova({ p, podeMexer, aoEditar }) {
  return (
    <li className={cn('flex flex-wrap items-start justify-between gap-x-4 gap-y-2 py-2.5')}>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <SeloGrau grau={p.grau} />
          <Link to={urlDoc(p.documento_id)} className={cn('font-medium hover:underline', tk.acento, tk.foco)}>
            <span style={{ fontVariantNumeric: 'tabular-nums' }} className={tk.mono}>{p.documento_numero || '—'}</span>
            {p.documento_titulo ? ` · ${p.documento_titulo}` : ''}
          </Link>
          {p.desactualizada && <SeloReconfirmar />}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <ReferenciaProva prova={p} />
          <span className={cn('text-sm', tk.tintaFraca)}>
            revisão <span className="tabular-nums">v{p.versao ?? '—'}</span>
            {p.versao_actual && p.versao_actual !== p.versao ? ` (o documento vai na v${p.versao_actual})` : ''}
            {p.verificado_em ? ` · reconfirmada em ${fmtData(p.verificado_em)}` : ''}
            {p.verificado_por ? ` por ${pessoaDeEmail(p.verificado_por)}` : ''}
          </span>
        </p>
        {p.citacao && (
          <blockquote className={cn('mt-1.5 border-l-2 pl-3 text-sm italic', tk.acentoBorda, tk.tintaMedia)}>
            “{p.citacao}”
          </blockquote>
        )}
        {p.nota && <p className={cn('mt-1 text-sm', tk.tintaMedia)}>{p.nota}</p>}
      </div>
      {podeMexer && (
        <Button size="sm" variant="ghost" onClick={() => aoEditar(p)}
          aria-label={`Editar a prova em ${p.documento_numero || 'documento'}`}>
          <Pencil className="h-4 w-4" aria-hidden="true" />Editar
        </Button>
      )}
    </li>
  );
}

export default function MatrizRequisitos({
  query, lista, abertos, aoAbrir, podeMexer = false,
  aoApontar, aoEditarRequisito, aoEditarProva, aoLimparFiltros, haFiltros,
}) {
  const linhas = lista || [];

  if (query?.isLoading) {
    return <section className={cn(cartao, 'overflow-hidden')}><EsqueletoTabela linhas={8} altura={56} /></section>;
  }
  if (query?.isError) {
    return (
      <section className={cn(cartao, 'overflow-hidden')}>
        <Falha
          titulo="Não foi possível carregar a matriz"
          texto={query.error?.message || 'Tente de novo; se continuar, avise a gestão do portal.'}
          onTentar={() => query.refetch?.()}
        />
      </section>
    );
  }
  if (!linhas.length) {
    return (
      <section className={cn(cartao, 'overflow-hidden')}>
        <Vazio
          icone={CircleSlash}
          titulo={haFiltros ? 'Nenhum requisito com estes filtros' : 'Nenhum requisito carregado'}
          texto={haFiltros
            ? 'Os filtros aplicados não deixam passar nenhum requisito. Limpe-os para voltar a ver a matriz toda.'
            : 'A matriz vive de requisitos: o parágrafo do diploma, o que ele obriga, e o documento que lhe responde. Carregue o primeiro requisito para começar.'}
        >
          {haFiltros
            ? <Button variant="outline" onClick={aoLimparFiltros}>Limpar os filtros</Button>
            : (podeMexer && <Button onClick={() => aoEditarRequisito(null)}><Plus className="h-4 w-4" aria-hidden="true" />Carregar um requisito</Button>)}
        </Vazio>
      </section>
    );
  }

  return (
    <section className={cn(cartao, 'overflow-hidden')} aria-label="Matriz de conformidade">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[56rem] border-collapse text-left">
          <caption className="sr-only">
            Requisitos por diploma, com o estado de cobertura e o documento, revisão e parágrafo que os cumprem.
          </caption>
          <thead className={cn('sticky top-0 z-10 border-b', tk.borda, tk.superficieBaixa)}>
            <tr className={cn('text-xs font-semibold uppercase tracking-wide', tk.tintaFraca)}>
              <th scope="col" className="w-[10rem] px-3 py-2.5">Parágrafo</th>
              <th scope="col" className="px-3 py-2.5">Requisito</th>
              <th scope="col" className="w-[12rem] px-3 py-2.5">Estado</th>
              <th scope="col" className="w-[18rem] px-3 py-2.5">Onde está</th>
              <th scope="col" className="w-[9rem] px-3 py-2.5 text-right">Acções</th>
            </tr>
          </thead>
          {linhas.map(r => {
            const aberto = abertos?.has?.(r.requisito_id);
            const buraco = r.estado === 'descoberto' || r.estado === 'planeado';
            return (
              <tbody key={r.requisito_id} className={cn('border-b', tk.borda)}>
                <tr className={cn(tk.hover, buraco && 'bg-red-50/60 dark:bg-red-950/20')}>
                  <td className="px-3 py-3 align-top">
                    <button
                      type="button"
                      onClick={() => aoAbrir(r.requisito_id)}
                      aria-expanded={!!aberto}
                      className={cn('flex items-baseline gap-1 text-left', tk.foco)}
                    >
                      {aberto
                        ? <ChevronDown className={cn('h-4 w-4 shrink-0 translate-y-0.5', tk.tintaFraca)} aria-hidden="true" />
                        : <ChevronRight className={cn('h-4 w-4 shrink-0 translate-y-0.5', tk.tintaFraca)} aria-hidden="true" />}
                      <Artigo valor={r.artigo} />
                      <span className="sr-only">{aberto ? 'Fechar o detalhe' : 'Abrir o detalhe'} de {r.titulo}</span>
                    </button>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <p className={cn('font-medium', tk.tinta)}>{r.titulo}</p>
                    <p className={cn('mt-0.5 text-sm', tk.tintaFraca)}>
                      {r.diploma_codigo}{r.processo_nome ? ` · ${r.processo_nome}` : ''}
                    </p>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <SeloCobertura estado={r.estado} />
                      {r.a_reconfirmar && <SeloReconfirmar />}
                      <SeloCritico criticidade={r.criticidade} />
                    </span>
                  </td>
                  <td className="px-3 py-3 align-top"><OndeEsta r={r} /></td>
                  <td className="px-3 py-3 align-top text-right">
                    <span className="inline-flex flex-wrap justify-end gap-1">
                      {podeMexer && (
                        <Button size="sm" variant={buraco ? 'default' : 'outline'} onClick={() => aoApontar(r)}>
                          <Plus className="h-4 w-4" aria-hidden="true" />Apontar
                        </Button>
                      )}
                      {podeMexer && (
                        <Button size="sm" variant="ghost" onClick={() => aoEditarRequisito(r)}
                          aria-label={`Editar o requisito ${r.titulo}`}>
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      )}
                    </span>
                  </td>
                </tr>

                {aberto && (
                  <tr className={tk.superficieBaixa}>
                    <td colSpan={COLS} className="px-3 py-3 sm:px-6">
                      {r.texto && <p className={cn('max-w-prose text-sm', tk.tintaMedia)}>{r.texto}</p>}
                      {r.notas && (
                        <p className={cn('mt-2 max-w-prose text-sm italic', tk.tintaFraca)}>
                          Nota interna: {r.notas}
                        </p>
                      )}
                      {r.fonte && (
                        <p className={cn('mt-1 text-sm', tk.tintaFraca)}>
                          Texto vindo de {r.fonte} — confirmar contra o original antes de citar à ANAC.
                        </p>
                      )}

                      <h3 className={cn('mt-3 text-xs font-semibold uppercase tracking-wide', tk.tintaFraca)}>
                        Onde está a resposta
                      </h3>
                      {(r.provas || []).length === 0 ? (
                        <p className={cn('mt-1.5 flex flex-wrap items-center gap-2 text-sm font-medium', tk.perigo)}>
                          <CircleSlash className="h-4 w-4 shrink-0" aria-hidden="true" />
                          Nenhum documento aponta para este requisito.
                          {podeMexer && (
                            <Button size="sm" variant="outline" onClick={() => aoApontar(r)}>
                              <Plus className="h-4 w-4" aria-hidden="true" />Apontar um parágrafo
                            </Button>
                          )}
                        </p>
                      ) : (
                        <ul className={cn('mt-1 divide-y', tk.divisoria)}>
                          {(r.provas || []).map(p => (
                            <Prova key={p.id} p={p} podeMexer={podeMexer} aoEditar={(pr) => aoEditarProva(r, pr)} />
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            );
          })}
        </table>
      </div>
      <p className={cn('border-t px-4 py-2.5 text-sm', tk.borda, tk.tintaFraca)}>
        {linhas.length} {linhas.length === 1 ? 'requisito' : 'requisitos'} nesta vista.
        {' '}A cobertura é a dos documentos a que tem acesso: o servidor não mostra provas de documentos que não pode ver.
        {' '}<Link to={`${PORTAL_BASE}/biblioteca`} className={cn('font-medium hover:underline', tk.acento, tk.foco)}>Ir à Biblioteca</Link>
      </p>
    </section>
  );
}
