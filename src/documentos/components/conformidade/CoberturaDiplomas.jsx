// A cobertura por diploma: a primeira coisa que se vê na matriz de conformidade (migração 159).
//
// Desenho: não são cartões grandes nem números a liderar com zeros. É uma lista densa, uma linha por diploma,
// com a barra a ilustrar e os números ao lado — e o que está a vermelho é sempre a mesma coisa: requisitos sem
// nada a apontar. Clicar numa linha filtra a matriz por esse diploma, porque é assim que o trabalho acontece:
// abre-se o Manual de Operações e vai-se aos buracos.
//
// Um diploma reservado (o NTA 32 só se obtém por pedido formal à ANAC, com credenciação) aparece com os
// requisitos a zero e diz porquê, em vez de parecer um diploma esquecido.
import React from 'react';
import { CircleSlash, FileLock2, Scale } from 'lucide-react';
import { cn } from '@/lib/utils';
import { tk, cartao, Vazio, Falha, Esqueleto } from '../../pages/PortalBiblioteca';
import { BarraCobertura, Selo } from './comuns';

function Linha({ d, escolhido, aoEscolher }) {
  const total = Number(d.requisitos) || 0;
  const descobertos = Number(d.descobertos) || 0;
  const criticos = Number(d.criticos_descobertos) || 0;
  const reconfirmar = Number(d.a_reconfirmar) || 0;

  return (
    <li>
      <button
        type="button"
        aria-pressed={escolhido}
        onClick={() => aoEscolher(escolhido ? '' : d.diploma_codigo)}
        className={cn('block w-full px-4 py-3 text-left transition-colors', tk.hover, tk.foco,
          escolhido && tk.seleccionada)}
      >
        <span className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <span className={cn('min-w-0 flex-1 font-medium', tk.tinta)}>{d.diploma_nome}</span>
          {total > 0 && (
            <span className={cn('shrink-0 text-sm tabular-nums', tk.tintaFraca)}>
              <span className={cn('font-semibold', descobertos ? tk.tinta : tk.bom)}>{d.pct}%</span>
              {' '}de {total} {total === 1 ? 'requisito' : 'requisitos'}
            </span>
          )}
        </span>

        {total > 0 ? (
          <>
            <BarraCobertura
              className="mt-2"
              total={total}
              cobertos={d.cobertos}
              parciais={d.parciais}
              naoAplicaveis={d.nao_aplicaveis}
            />
            <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              {descobertos > 0 && (
                <span className={cn('inline-flex items-center gap-1 text-sm font-medium', tk.perigo)}>
                  <CircleSlash className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="tabular-nums">{descobertos}</span> sem nada a apontar
                  {criticos > 0 && <span className="font-semibold">({criticos} {criticos === 1 ? 'crítico' : 'críticos'})</span>}
                </span>
              )}
              {reconfirmar > 0 && (
                <span className={cn('text-sm', tk.aviso)}>
                  <span className="tabular-nums">{reconfirmar}</span> {reconfirmar === 1 ? 'prova' : 'provas'} a reconfirmar
                </span>
              )}
              {descobertos === 0 && reconfirmar === 0 && (
                <span className={cn('text-sm', tk.bom)}>Todos os requisitos têm parágrafo apontado.</span>
              )}
            </span>
          </>
        ) : (
          <span className={cn('mt-1.5 flex flex-wrap items-center gap-2 text-sm', tk.tintaFraca)}>
            {d.reservado
              ? (<>
                  <Selo tom="neutro" icone={FileLock2}>Reservado</Selo>
                  Só se obtém por pedido formal à ANAC, com credenciação. Sem o texto, não há requisitos a carregar.
                </>)
              : 'Sem requisitos carregados. Carregue-os para o diploma passar a contar na cobertura.'}
          </span>
        )}
      </button>
    </li>
  );
}

export default function CoberturaDiplomas({ query, escolhido, aoEscolher, className }) {
  const linhas = query?.data || [];

  return (
    <section className={cn(cartao, 'overflow-hidden', className)} aria-labelledby="gd-cobertura-titulo">
      <h2 id="gd-cobertura-titulo" className={cn('flex items-center gap-2 border-b px-4 py-3 text-sm font-semibold', tk.borda, tk.tinta)}>
        <Scale className={cn('h-4 w-4', tk.acento)} aria-hidden="true" />
        Cobertura por diploma
      </h2>

      {query?.isLoading ? (
        <Esqueleto linhas={3} />
      ) : query?.isError ? (
        <Falha
          titulo="Não foi possível calcular a cobertura"
          texto={query.error?.message || 'Tente de novo; se continuar, avise a gestão do portal.'}
          onTentar={() => query.refetch?.()}
          className="py-10"
        />
      ) : linhas.length === 0 ? (
        <Vazio
          icone={Scale}
          titulo="Nenhum diploma carregado"
          texto="A matriz organiza-se por diploma: o instrutivo, o NTA, o despacho. Sem diplomas não há requisitos, e sem requisitos não há o que apontar aos documentos."
          className="py-10"
        />
      ) : (
        <ul className={cn('divide-y', tk.divisoria)}>
          {linhas.map(d => (
            <Linha key={d.diploma_codigo} d={d} escolhido={escolhido === d.diploma_codigo} aoEscolher={aoEscolher} />
          ))}
        </ul>
      )}
    </section>
  );
}
