// Hooks do regime AVSEC (migração 158). A camada de dados está em `apiAvsec.js`; aqui guarda-se em cache, cruza-se
// e conta-se.
//
// As chaves de cache começam por 'gd', como as do resto do portal, para o `useRecarregarDocs()` que já existe
// limpar isto também — dois botões de recarregar com comportamentos diferentes seriam um defeito.
//
// Duas decisões que explicam a forma deste ficheiro:
//
//   1. `useRegimeAvsec()` DEVOLVE UM OBJECTO, NÃO UMA LISTA. O ecrã do regime precisa, ao mesmo tempo, dos
//      documentos, das cópias, dos credenciados e dos ciclos: pedi-los em sítios diferentes dava quatro estados de
//      carregamento a piscar uns depois dos outros. Pedem-se juntos e cruzam-se aqui uma só vez.
//   2. A CADUCIDADE NÃO ESPERA PELO SERVIDOR. `documento_credenciado_vista` já calcula o estado efectivo, mas as
//      contagens por estado fazem-se aqui porque são de dezenas de linhas — uma vista nova para contar seria mais
//      peça para manter do que valor a acrescentar (mesma razão que em `hooksCodificacao.js`).
import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  lerCategoriasClassificacao, lerPainelAvsec, lerRegimeAvsec, lerCandidatosAvsec,
  lerEdicoesLep, lerLepActuais, lerPaginasLep, compararEdicoesLep,
  lerCredenciados, lerCredenciaisACaducar, lerCopiasControladas, lerFormandosElegiveis,
  lerCiclosConferencia, lerItensConferencia, lerMeusItensConferencia, lerRegistoConferencias,
  faltaMigracao,
} from './apiAvsec';

const MIN = 60 * 1000;
const VAZIO = [];
const naLista = (v) => (Array.isArray(v) ? v : VAZIO);

// Uma falha por falta de migração não se tenta de novo: o servidor não vai mudar de ideias entre tentativas.
const semRepetirSeFaltaMigracao = (tentativa, erro) => !faltaMigracao(erro) && tentativa < 1;

// ── classificação ───────────────────────────────────────────────────────────
export function useCategoriasClassificacao() {
  return useQuery({
    queryKey: ['gd', 'avsec', 'categorias'],
    staleTime: 30 * MIN,
    retry: semRepetirSeFaltaMigracao,
    queryFn: lerCategoriasClassificacao,
  });
}

// ── documentos no regime ────────────────────────────────────────────────────
export function usePainelAvsec() {
  return useQuery({
    queryKey: ['gd', 'avsec', 'painel'],
    staleTime: MIN,
    retry: semRepetirSeFaltaMigracao,
    queryFn: lerPainelAvsec,
  });
}
export function useRegimeDocumento(documentoId) {
  return useQuery({
    queryKey: ['gd', 'avsec', 'regime', documentoId || ''],
    enabled: !!documentoId,
    staleTime: MIN,
    retry: semRepetirSeFaltaMigracao,
    queryFn: () => lerRegimeAvsec(documentoId),
  });
}
export function useCandidatosAvsec() {
  return useQuery({
    queryKey: ['gd', 'avsec', 'candidatos'],
    staleTime: 5 * MIN,
    retry: semRepetirSeFaltaMigracao,
    queryFn: () => lerCandidatosAvsec(),
  });
}

// ── Lista de Páginas Efectivas ──────────────────────────────────────────────
export function useEdicoesLep(documentoId) {
  return useQuery({
    queryKey: ['gd', 'avsec', 'lep', documentoId || ''],
    enabled: !!documentoId,
    staleTime: MIN,
    retry: semRepetirSeFaltaMigracao,
    queryFn: () => lerEdicoesLep(documentoId),
  });
}
export function useLepActuais() {
  return useQuery({
    queryKey: ['gd', 'avsec', 'lep-actuais'],
    staleTime: MIN,
    retry: semRepetirSeFaltaMigracao,
    queryFn: lerLepActuais,
  });
}
export function usePaginasLep(lepId) {
  return useQuery({
    queryKey: ['gd', 'avsec', 'lep-paginas', lepId || ''],
    enabled: !!lepId,
    staleTime: 30 * 1000,
    retry: semRepetirSeFaltaMigracao,
    queryFn: () => lerPaginasLep(lepId),
  });
}
// A comparação entre duas edições. Só corre quando as duas estão escolhidas e são diferentes: comparar uma lista
// consigo mesma devolveria 200 linhas «igual», que é ruído.
export function useComparacaoLep(lepA, lepB) {
  const pronto = !!lepA && !!lepB && lepA !== lepB;
  return useQuery({
    queryKey: ['gd', 'avsec', 'lep-comparar', lepA || '', lepB || ''],
    enabled: pronto,
    staleTime: 5 * MIN,
    retry: semRepetirSeFaltaMigracao,
    queryFn: () => compararEdicoesLep(lepA, lepB),
  });
}

// ── credenciados e cópias ───────────────────────────────────────────────────
export function useFormandosAvsecElegiveis() {
  return useQuery({
    queryKey: ['gd', 'avsec', 'formandos-elegiveis'],
    staleTime: MIN,
    retry: semRepetirSeFaltaMigracao,
    queryFn: lerFormandosElegiveis,
  });
}
export function useCredenciados() {
  return useQuery({
    queryKey: ['gd', 'avsec', 'credenciados'],
    staleTime: MIN,
    retry: semRepetirSeFaltaMigracao,
    queryFn: lerCredenciados,
  });
}
export function useCredenciaisACaducar(dias = 60) {
  return useQuery({
    queryKey: ['gd', 'avsec', 'credenciais-caducar', dias],
    staleTime: 5 * MIN,
    retry: semRepetirSeFaltaMigracao,
    queryFn: () => lerCredenciaisACaducar(dias),
  });
}
export function useCopiasControladas({ documentoId } = {}) {
  return useQuery({
    queryKey: ['gd', 'avsec', 'copias', documentoId || 'todas'],
    staleTime: MIN,
    retry: semRepetirSeFaltaMigracao,
    queryFn: () => lerCopiasControladas({ documentoId }),
  });
}

// ── conferência ─────────────────────────────────────────────────────────────
export function useCiclosConferencia({ documentoId } = {}) {
  return useQuery({
    queryKey: ['gd', 'avsec', 'ciclos', documentoId || 'todos'],
    staleTime: MIN,
    retry: semRepetirSeFaltaMigracao,
    queryFn: () => lerCiclosConferencia({ documentoId }),
  });
}
export function useItensConferencia(cicloId) {
  return useQuery({
    queryKey: ['gd', 'avsec', 'itens', cicloId || ''],
    enabled: !!cicloId,
    staleTime: 30 * 1000,
    retry: semRepetirSeFaltaMigracao,
    queryFn: () => lerItensConferencia(cicloId),
  });
}
// O que esta pessoa tem para confirmar. As regras do servidor já limitam o que cada um vê.
export function useMinhasConferencias() {
  return useQuery({
    queryKey: ['gd', 'avsec', 'minhas-conferencias'],
    staleTime: MIN,
    retry: semRepetirSeFaltaMigracao,
    queryFn: lerMeusItensConferencia,
  });
}
export function useRegistoConferencias({ documentoId, itemId, limite = 1000 } = {}) {
  return useQuery({
    queryKey: ['gd', 'avsec', 'registo', documentoId || '', itemId || '', limite],
    staleTime: 30 * 1000,
    retry: semRepetirSeFaltaMigracao,
    queryFn: () => lerRegistoConferencias({ documentoId, itemId, limite }),
  });
}

export function useRecarregarAvsec() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['gd', 'avsec'] });
}

// ── contas e rótulos ────────────────────────────────────────────────────────
export const ROTULO_ESTADO_CREDENCIAL = {
  activo: 'Activa', caducado: 'Caducada', suspenso: 'Suspensa', revogado: 'Revogada',
};
export const ROTULO_ESTADO_COPIA = {
  activa: 'Em poder do detentor', devolvida: 'Devolvida', extraviada: 'Extraviada', destruida: 'Destruída',
};
export const ROTULO_SUPORTE = { fisico: 'Volume físico', digital: 'Cópia digital' };
export const ROTULO_ACCAO_PAGINA = {
  original: 'Original', inserida: 'Inserida', actualizada: 'Actualizada', cancelada: 'Cancelada',
};
export const ROTULO_DIFERENCA = {
  igual: 'Sem alteração', substituida: 'Substituída', acrescentada: 'Entra', retirada: 'Sai', cancelada: 'Cancelada',
};
export const ROTULO_ESTADO_LEP = { rascunho: 'Rascunho', emitida: 'Em vigor', substituida: 'Substituída' };
export const ROTULO_ESTADO_CICLO = { aberto: 'Aberto', fechado: 'Fechado', cancelado: 'Cancelado' };
export const ROTULO_ESTADO_ITEM = { pendente: 'Por conferir', conferida: 'Conferida', nao_conferida: 'Não conferida' };
export const ROTULO_ACTO = {
  aberta: 'Ciclo aberto', confirmada_detentor: 'Confirmada pelo detentor', conferida: 'Conferida',
  nao_conferida: 'Ficou por conferir', reaberta: 'Reaberta',
};

export const nomeSemestre = (ano, semestre) => `${semestre === 1 ? '1.º' : '2.º'} semestre de ${ano}`;
export const semestreDe = (data = new Date()) => (data.getMonth() <= 5 ? 1 : 2);

// Estado efectivo de uma credencial, para o caso de a linha vir da tabela e não da vista.
export function estadoCredencial(c, hoje = new Date()) {
  if (!c) return 'activo';
  if (c.estado_efectivo) return c.estado_efectivo;
  if (c.estado === 'revogado') return 'revogado';
  if (c.estado === 'suspenso') return 'suspenso';
  if (c.valida_ate && new Date(`${String(c.valida_ate).slice(0, 10)}T23:59:59`) < hoje) return 'caducado';
  return 'activo';
}
export const credencialUtil = (c) => estadoCredencial(c) === 'activo';

// Os achados de uma conferência, por nome, prontos a mostrar. Devolve lista vazia quando está conforme — e é essa
// a resposta certa, porque a lei pergunta se há achados, não qual é a nota.
export function achadosDe(item) {
  if (!item) return VAZIO;
  const out = [];
  if (item.achado_retirada) out.push('Página retirada');
  if (item.achado_insercao) out.push('Página inserida');
  if (item.achado_modificacao) out.push('Página modificada');
  if (item.achado_manuscrita) out.push('Alteração manuscrita');
  if (item.achado_nao_localizada) out.push('Cópia não localizada');
  return out;
}

// ── o regime todo, cruzado ──────────────────────────────────────────────────
// Um pedido por tabela, cruzados aqui. O que sai é o que os três separadores do ecrã precisam, já contado.
export function useRegimeAvsec() {
  const painelQ = usePainelAvsec();
  const copiasQ = useCopiasControladas();
  const credQ = useCredenciados();
  const ciclosQ = useCiclosConferencia();
  const lepQ = useLepActuais();

  const dados = useMemo(() => {
    const documentos = naLista(painelQ.data);
    const copias = naLista(copiasQ.data);
    const credenciados = naLista(credQ.data);
    const ciclos = naLista(ciclosQ.data);
    const lepActuais = naLista(lepQ.data);

    const copiasPorDoc = new Map();
    for (const c of copias) {
      if (!copiasPorDoc.has(c.documento_id)) copiasPorDoc.set(c.documento_id, []);
      copiasPorDoc.get(c.documento_id).push(c);
    }
    const ciclosPorDoc = new Map();
    for (const z of ciclos) {
      if (!ciclosPorDoc.has(z.documento_id)) ciclosPorDoc.set(z.documento_id, []);
      ciclosPorDoc.get(z.documento_id).push(z);
    }
    const lepPorDoc = new Map(lepActuais.map(l => [l.documento_id, l]));

    // Cópias em poder de quem já não tem credencial válida. É a pergunta da alínea e) feita ao contrário, e a mais
    // importante deste ecrã: o gatilho impede entregas novas, mas uma credencial pode caducar depois da entrega.
    const credPorEmail = new Map();
    for (const c of credenciados) {
      const chave = String(c.email || '').toLowerCase();
      const lista = credPorEmail.get(chave) || [];
      lista.push(c);
      credPorEmail.set(chave, lista);
    }
    const semCredencial = copias.filter(c => {
      if (c.estado !== 'activa') return false;
      const lista = credPorEmail.get(String(c.detentor_email || '').toLowerCase()) || [];
      return !lista.some(credencialUtil);
    });

    const ciclosAbertos = ciclos.filter(z => z.estado === 'aberto');
    const foraDePrazo = ciclosAbertos.filter(z => z.prazo_ultrapassado);
    const porConferir = ciclosAbertos.reduce((s, z) => s + (Number(z.pendentes) || 0), 0);
    const comAchados = ciclos.reduce((s, z) => s + ((Number(z.conferidas) || 0) - (Number(z.conformes) || 0)), 0);

    return {
      documentos: documentos.map(d => ({
        ...d,
        copias: copiasPorDoc.get(d.documento_id) || VAZIO,
        ciclos: ciclosPorDoc.get(d.documento_id) || VAZIO,
        lep: lepPorDoc.get(d.documento_id) || null,
      })),
      copias,
      credenciados,
      ciclos,
      lepActuais,
      semCredencial,
      ciclosAbertos,
      foraDePrazo,
      contagens: {
        documentos: documentos.length,
        semLep: documentos.filter(d => !d.lep_id).length,
        semGuarda: documentos.filter(d => !d.guarda_email).length,
        copiasActivas: copias.filter(c => c.estado === 'activa').length,
        copiasExtraviadas: copias.filter(c => c.estado === 'extraviada').length,
        copiasDesactualizadas: documentos.reduce((s, d) => s + (Number(d.copias_desactualizadas) || 0), 0),
        credenciaisActivas: credenciados.filter(credencialUtil).length,
        credenciaisCaducadas: credenciados.filter(c => estadoCredencial(c) === 'caducado').length,
        credenciaisRevogadas: credenciados.filter(c => estadoCredencial(c) === 'revogado').length,
        semCredencial: semCredencial.length,
        ciclosAbertos: ciclosAbertos.length,
        foraDePrazo: foraDePrazo.length,
        porConferir,
        comAchados,
      },
    };
  }, [painelQ.data, copiasQ.data, credQ.data, ciclosQ.data, lepQ.data]);

  const consultas = [painelQ, copiasQ, credQ, ciclosQ, lepQ];
  const erro = consultas.map(q => q.error).find(Boolean) || null;
  return {
    ...dados,
    isLoading: consultas.some(q => q.isLoading),
    isFetching: consultas.some(q => q.isFetching),
    isError: consultas.some(q => q.isError),
    error: erro,
    faltaMigracao: faltaMigracao(erro),
    recarregar: () => consultas.forEach(q => q.refetch?.()),
  };
}
