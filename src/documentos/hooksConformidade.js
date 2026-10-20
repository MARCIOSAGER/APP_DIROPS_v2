// Hooks das duas pontes da migração 159: documento ↔ curso, e matriz de conformidade requisito → parágrafo.
// A camada de dados está em `apiConformidade.js`; aqui guarda-se em cache, conta-se e filtra-se.
//
// As chaves de cache começam todas por 'gd', como as do resto do portal, para o `useRecarregarDocs()` que já
// existe limpar isto também e não haver dois botões de recarregar com comportamentos diferentes.
//
// Duas decisões que valem a pena explicar:
//   • a matriz e a cobertura vêm de RPC do servidor, não se recalculam aqui. É no servidor que estão as regras de
//     acesso aos documentos, e por isso é lá que a cobertura é verdadeira: quem não vê um documento não pode ver
//     uma prova que aponte para ele, e a sua cobertura reflecte isso;
//   • os filtros da matriz são contados no cliente sobre a matriz já carregada (algumas centenas de linhas), o
//     que permite mostrar em cada ficha de filtro quantos resultados daria — e é esse número que faz com que
//     ninguém escolha um filtro para ver «0 resultados».
// Molde: src/documentos/hooks.js, src/documentos/hooksCodificacao.js.
import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  lerLigacoes, lerCursosDisponiveis, lerImpactoFormacao, lerDiplomas, lerCobertura, lerMatriz,
  lerProvasDoDocumento, ligarDocumentoCurso, guardarLigacao, desligarDocumentoCurso, conferirLigacao,
  marcarAlerta, guardarDiploma, guardarRequisito, activarRequisito, apagarRequisito, guardarProva,
  reconfirmarProva, apagarProva,
  RELACOES, ACCOES_REVISAO, ESTADOS_ALERTA, GRAUS, ESTADOS_COBERTURA, CRITICIDADES,
} from './apiConformidade';

const MIN = 60 * 1000;
const VAZIO = [];
const naLista = (v) => (Array.isArray(v) ? v : VAZIO);

export {
  RELACOES, ACCOES_REVISAO, ESTADOS_ALERTA, GRAUS, ESTADOS_COBERTURA, CRITICIDADES,
  ligarDocumentoCurso, guardarLigacao, desligarDocumentoCurso, conferirLigacao, marcarAlerta,
  guardarDiploma, guardarRequisito, activarRequisito, apagarRequisito, guardarProva, reconfirmarProva, apagarProva,
};

// ── ponte 1: documento ↔ curso ──────────────────────────────────────────────
export function useLigacoesDocumento(documentoId) {
  return useQuery({
    queryKey: ['gd', 'formacao', 'ligacoes', documentoId || 'todos'],
    enabled: !!documentoId,
    staleTime: 2 * MIN,
    retry: 0,
    queryFn: () => lerLigacoes({ documentoId }),
  });
}

export function useLigacoesTodas({ limite = 1000 } = {}) {
  return useQuery({
    queryKey: ['gd', 'formacao', 'ligacoes-todas', limite],
    staleTime: 2 * MIN,
    retry: 0,
    queryFn: () => lerLigacoes({ limite }),
  });
}

// Os cursos da Universidade, só para escolher. `staleTime` largo: a lista de cursos muda-se raramente, e este
// pedido serve apenas para preencher um selector.
export function useCursosDisponiveis() {
  return useQuery({
    queryKey: ['gd', 'formacao', 'cursos'],
    staleTime: 10 * MIN,
    retry: 0,
    queryFn: lerCursosDisponiveis,
  });
}

export function useImpactoFormacao(estado = 'aberto') {
  return useQuery({
    queryKey: ['gd', 'formacao', 'impacto', estado || 'todos'],
    staleTime: MIN,
    retry: 0,
    queryFn: () => lerImpactoFormacao(estado),
  });
}

export function useRecarregarFormacao() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['gd', 'formacao'] });
}

// A conta que decide tudo, feita uma só vez e no mesmo sítio para o GED e para a formação: se a revisão em vigor
// é maior do que a conferida, o conteúdo do curso pode estar a ensinar o que já não se faz.
export const SITUACAO = {
  conferido: { label: 'Conferido', tom: 'bom' },
  desactualizado: { label: 'Por rever', tom: 'perigo' },
  nunca_conferido: { label: 'Nunca conferido', tom: 'aviso' },
};
export const porRever = (l) => l?.situacao === 'desactualizado' || l?.situacao === 'nunca_conferido';

// ── ponte 2: conformidade ───────────────────────────────────────────────────
export function useDiplomas() {
  return useQuery({
    queryKey: ['gd', 'conformidade', 'diplomas'],
    staleTime: 10 * MIN,
    retry: 0,
    queryFn: lerDiplomas,
  });
}

export function useCoberturaConformidade() {
  return useQuery({
    queryKey: ['gd', 'conformidade', 'cobertura'],
    staleTime: MIN,
    retry: 0,
    queryFn: lerCobertura,
  });
}

export function useMatrizConformidade(diploma = null) {
  return useQuery({
    queryKey: ['gd', 'conformidade', 'matriz', diploma || 'todos'],
    staleTime: MIN,
    retry: 0,
    queryFn: () => lerMatriz(diploma),
  });
}

export function useProvasDoDocumento(documentoId) {
  return useQuery({
    queryKey: ['gd', 'conformidade', 'provas-documento', documentoId || ''],
    enabled: !!documentoId,
    staleTime: 2 * MIN,
    retry: 0,
    queryFn: () => lerProvasDoDocumento(documentoId),
  });
}

export function useRecarregarConformidade() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['gd', 'conformidade'] });
}

// ── a matriz, filtrada e contada ────────────────────────────────────────────
// Devolve a lista filtrada e, para cada ficha de filtro, quantos resultados daria com os OUTROS filtros já
// aplicados. É esse número que evita que alguém escolha um filtro e caia num ecrã vazio.
const correspondeTexto = (r, termo) => {
  if (!termo) return true;
  const t = termo.toLowerCase();
  return [r.artigo, r.titulo, r.texto, r.diploma_codigo, r.diploma_nome, r.processo_nome, r.notas]
    .some(v => String(v || '').toLowerCase().includes(t));
};
const correspondeEstado = (r, f) => {
  if (!f) return true;
  if (f === 'a_reconfirmar') return r.a_reconfirmar === true;
  if (f === 'buracos') return r.estado === 'descoberto' || r.estado === 'planeado';
  return r.estado === f;
};
const correspondeCrit = (r, f) => !f || r.criticidade === f;
const correspondeProcesso = (r, f) => !f || (f === '__sem' ? !r.processo_codigo : r.processo_codigo === f);
const correspondeDiploma = (r, f) => !f || r.diploma_codigo === f;

export function useMatrizFiltrada(matriz, filtros = {}) {
  const { diploma = '', estado = '', criticidade = '', processo = '', termo = '' } = filtros;
  return useMemo(() => {
    const todas = naLista(matriz);
    const passa = (r, excepto) => (
      (excepto === 'diploma' || correspondeDiploma(r, diploma))
      && (excepto === 'estado' || correspondeEstado(r, estado))
      && (excepto === 'criticidade' || correspondeCrit(r, criticidade))
      && (excepto === 'processo' || correspondeProcesso(r, processo))
      && correspondeTexto(r, termo)
    );
    const lista = todas.filter(r => passa(r, null));

    const contar = (campo, teste) => todas.filter(r => passa(r, campo) && teste(r)).length;
    const opcoesEstado = [
      { value: '', label: 'Todos', total: contar('estado', () => true) },
      { value: 'buracos', label: 'Sem nada a apontar', total: contar('estado', r => r.estado === 'descoberto' || r.estado === 'planeado') },
      { value: 'a_reconfirmar', label: 'A reconfirmar', total: contar('estado', r => r.a_reconfirmar === true) },
      { value: 'parcial', label: 'Coberto em parte', total: contar('estado', r => r.estado === 'parcial') },
      { value: 'coberto', label: 'Coberto', total: contar('estado', r => r.estado === 'coberto') },
      { value: 'nao_aplicavel', label: 'Não aplicável', total: contar('estado', r => r.estado === 'nao_aplicavel') },
    ];
    const opcoesCriticidade = [
      { value: '', label: 'Todas', total: contar('criticidade', () => true) },
      ...CRITICIDADES.map(c => ({ value: c.value, label: c.label, total: contar('criticidade', r => r.criticidade === c.value) })),
    ];
    const codigosProcesso = Array.from(new Set(todas.map(r => r.processo_codigo).filter(Boolean)));
    const opcoesProcesso = [
      { value: '', label: 'Todos', total: contar('processo', () => true) },
      ...codigosProcesso.map(c => ({
        value: c,
        label: todas.find(r => r.processo_codigo === c)?.processo_nome || c,
        total: contar('processo', r => r.processo_codigo === c),
      })).sort((a, b) => b.total - a.total || String(a.label).localeCompare(String(b.label), 'pt')),
      { value: '__sem', label: 'Sem manual indicado', total: contar('processo', r => !r.processo_codigo) },
    ];

    const buracos = lista.filter(r => r.estado === 'descoberto' || r.estado === 'planeado');
    return {
      lista,
      total: todas.length,
      opcoesEstado,
      opcoesCriticidade,
      opcoesProcesso,
      buracos: buracos.length,
      buracosCriticos: buracos.filter(r => r.criticidade === 'alta').length,
      aReconfirmar: lista.filter(r => r.a_reconfirmar).length,
    };
  }, [matriz, diploma, estado, criticidade, processo, termo]);
}

// Total da casa, para a tira de indicadores: soma das coberturas de todos os diplomas.
export function useTotaisCobertura(cobertura) {
  return useMemo(() => {
    const linhas = naLista(cobertura);
    const soma = (campo) => linhas.reduce((t, l) => t + (Number(l[campo]) || 0), 0);
    const requisitos = soma('requisitos');
    const cobertos = soma('cobertos');
    return {
      diplomas: linhas.length,
      requisitos,
      cobertos,
      parciais: soma('parciais'),
      descobertos: soma('descobertos'),
      aReconfirmar: soma('a_reconfirmar'),
      criticosDescobertos: soma('criticos_descobertos'),
      pct: requisitos ? Math.round((100 * cobertos) / requisitos) : 0,
    };
  }, [cobertura]);
}
