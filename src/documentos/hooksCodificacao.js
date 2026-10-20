// Hooks da codificação documental (classes e processos, migração 157). A camada de dados está em
// `apiCodificacao.js`; aqui só se guarda em cache, se conta e se cola a codificação aos documentos.
//
// As chaves de cache começam todas por 'gd', como as do resto do portal, para o `useRecarregarDocs()` que já
// existe limpar isto também e não haver dois botões de recarregar com comportamentos diferentes.
//
// O ponto mais útil deste ficheiro é o `useDocumentosCodificados`: a lista de documentos do portal não traz as
// colunas `classe_codigo`/`processo_codigo` (COLS_DOC, em hooks.js), e em vez de engordar essa consulta pede-se
// uma tabela leve de id → códigos e colam-se os NOMES a cada documento. Daí para a frente qualquer peça do
// interface lê `doc.processo_nome` sem precisar de receber mapas por propriedade.
// Molde: src/documentos/hooks.js.
import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import {
  lerClasses, lerProcessos, lerCodificacaoDocumentos, numeroSeguinte,
  guardarClasse, guardarProcesso, criarProcesso, confirmarNomeProcesso,
  lerSetores, guardarSetor,
} from './apiCodificacao';

const MIN = 60 * 1000;
const VAZIO = [];
const naLista = (v) => (Array.isArray(v) ? v : VAZIO);

export { guardarClasse, guardarProcesso, criarProcesso, confirmarNomeProcesso, guardarSetor };

// ── as duas tabelas ─────────────────────────────────────────────────────────
export function useClassesDocs() {
  return useQuery({
    queryKey: ['gd', 'codificacao', 'classes'],
    staleTime: 10 * MIN,
    queryFn: lerClasses,
  });
}
export function useProcessosDocs() {
  return useQuery({
    queryKey: ['gd', 'codificacao', 'processos'],
    staleTime: 10 * MIN,
    queryFn: lerProcessos,
  });
}
export function useSetoresDocs() {
  return useQuery({
    queryKey: ['gd', 'codificacao', 'setores'],
    staleTime: 10 * MIN,
    queryFn: lerSetores,
  });
}
// id do documento → { classe_codigo, processo_codigo }
export function useCodificacaoDocumentos({ limite = 5000 } = {}) {
  return useQuery({
    queryKey: ['gd', 'codificacao', 'documentos', limite],
    staleTime: 5 * MIN,
    queryFn: () => lerCodificacaoDocumentos({ limite }),
  });
}

export function useRecarregarCodificacao() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['gd', 'codificacao'] });
}

// ── rótulos ─────────────────────────────────────────────────────────────────
// Um processo sem nome mostra-se pelo código, nunca em branco: um espaço vazio numa lista parece avaria.
export const nomeProcesso = (mapa, cod) => (cod ? (mapa?.get?.(cod)?.nome || cod) : '');
export const nomeClasse = (mapa, cod) => (cod ? (mapa?.get?.(cod)?.nome || cod) : '');
export const nomeSetor = (mapa, cod) => (cod ? (mapa?.get?.(cod)?.nome || cod) : '');
// O setor de um documento vem do seu manual: processo → setor_codigo → setor.
export const setorDeProcesso = (mapaProcessos, mapaSetores, processoCod) => {
  const sc = processoCod ? mapaProcessos?.get?.(processoCod)?.setor_codigo : null;
  return sc ? (mapaSetores?.get?.(sc) || null) : null;
};
export const processoPorNomear = (p) => !String(p?.nome || '').trim();
// Um nome ADIVINHADO não vale o mesmo que um nome LIDO do documento, e a migração 163 guardou essa diferença em
// `nome_confirmado` em vez de a deixar na cabeça de quem escreveu a migração. Um processo sem nome nenhum também
// está à espera de alguém: as duas situações pedem a mesma coisa — confirmação — e contam-se juntas.
export const processoPorConfirmar = (p) => p?.nome_confirmado === false || processoPorNomear(p);
const mapaPorCodigo = (lista) => new Map(naLista(lista).map(x => [x.codigo, x]));
const ordenar = (a, b) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0) || String(a.codigo).localeCompare(String(b.codigo), 'pt');

// ── a codificação toda, já contada ──────────────────────────────────────────
// Devolve as duas listas com `total` (quantos documentos pertencem a cada código) e os mapas por código.
// A contagem é feita aqui e não no servidor porque a tabela leve são duas colunas de duas centenas de linhas:
// uma vista nova para contar seria mais peça para manter do que valor a acrescentar.
export function useCodificacao() {
  const classesQ = useClassesDocs();
  const processosQ = useProcessosDocs();
  const setoresQ = useSetoresDocs();
  const codQ = useCodificacaoDocumentos();

  const dados = useMemo(() => {
    const porClasse = new Map();
    const porProcesso = new Map();
    let semClasse = 0;
    let semProcesso = 0;
    for (const d of naLista(codQ.data)) {
      if (d.classe_codigo) porClasse.set(d.classe_codigo, (porClasse.get(d.classe_codigo) || 0) + 1); else semClasse += 1;
      if (d.processo_codigo) porProcesso.set(d.processo_codigo, (porProcesso.get(d.processo_codigo) || 0) + 1); else semProcesso += 1;
    }
    const classes = naLista(classesQ.data).map(c => ({ ...c, total: porClasse.get(c.codigo) || 0 })).sort(ordenar);
    const processos = naLista(processosQ.data).map(p => ({ ...p, total: porProcesso.get(p.codigo) || 0 })).sort(ordenar);
    const mapaProcessos = mapaPorCodigo(processos);
    // total de documentos por setor = soma dos totais dos manuais desse setor
    const porSetor = new Map();
    for (const p of processos) { const sc = p.setor_codigo; if (sc) porSetor.set(sc, (porSetor.get(sc) || 0) + (p.total || 0)); }
    const setores = naLista(setoresQ.data).map(s => ({ ...s, total: porSetor.get(s.codigo) || 0 })).sort(ordenar);
    return {
      classes,
      processos,
      setores,
      mapaClasses: mapaPorCodigo(classes),
      mapaProcessos,
      mapaSetores: mapaPorCodigo(setores),
      porNomear: processos.filter(processoPorNomear),
      porConfirmar: processos.filter(processoPorConfirmar),
      totalDocumentos: naLista(codQ.data).length,
      semClasse,
      semProcesso,
      // A coluna `descricao` das classes só existe depois de aplicada a sql/161_codificacao_extras.sql. Em vez de
      // perguntar ao servidor se ela existe, olha-se para as linhas que já chegaram: `select *` traz a chave
      // quando a coluna existe. Sem ela, o ecrã esconde o campo e continua a funcionar.
      temDescricaoClasse: naLista(classesQ.data).some(c => 'descricao' in (c || {})),
    };
  }, [classesQ.data, processosQ.data, setoresQ.data, codQ.data]);

  return {
    ...dados,
    isLoading: classesQ.isLoading || processosQ.isLoading || codQ.isLoading || setoresQ.isLoading,
    isFetching: classesQ.isFetching || processosQ.isFetching || codQ.isFetching || setoresQ.isFetching,
    isError: classesQ.isError || processosQ.isError || setoresQ.isError,
    error: classesQ.error || processosQ.error || codQ.error,
    recarregar: () => { classesQ.refetch?.(); processosQ.refetch?.(); codQ.refetch?.(); setoresQ.refetch?.(); },
  };
}

// Só o que se pode escolher num formulário (as linhas desactivadas continuam a valer para os documentos antigos,
// mas não se propõem para documentos novos).
export function useCodificacaoActiva() {
  const cod = useCodificacao();
  const classesActivas = useMemo(() => cod.classes.filter(c => c.ativo !== false), [cod.classes]);
  const processosActivos = useMemo(() => cod.processos.filter(p => p.ativo !== false), [cod.processos]);
  return { ...cod, classesActivas, processosActivos };
}

// Os documentos de um manual ou programa (ou de uma classe). Serve o ecrã da codificação: quem vai dar nome ao
// processo «PMB» decide num segundo quando vê que lá dentro estão o «Plano de Manutenção de Balizagem» e os
// procedimentos das luzes. Nomear um código às cegas é o que produz nomes inventados; por isso a lista está ali.
// Só corre quando alguém abre a linha.
function useDocumentosPorCodigo(coluna, codigo, limite) {
  return useQuery({
    queryKey: ['gd', 'codificacao', 'docs', coluna, codigo || '', limite],
    enabled: !!codigo,
    staleTime: 2 * MIN,
    queryFn: async () => {
      const { data, error } = await supabase.from('documento')
        .select('id,numero,titulo,estado,aeroporto_id')
        .eq(coluna, codigo)
        .is('deleted_at', null).is('voo_ligado_id', null)
        .order('numero')
        .limit(limite);
      if (error) return VAZIO;
      return naLista(data);
    },
  });
}
export const useDocumentosDoProcesso = (codigo, { limite = 60 } = {}) => useDocumentosPorCodigo('processo_codigo', codigo, limite);
export const useDocumentosDaClasse = (codigo, { limite = 60 } = {}) => useDocumentosPorCodigo('classe_codigo', codigo, limite);

// ── colar a codificação a uma lista de documentos ───────────────────────────
// Acrescenta a cada documento `classe_codigo`, `classe_nome`, `processo_codigo` e `processo_nome`. Devolve a mesma
// lista enquanto não houver codificação carregada (nada pisca nem salta por causa disto) e preserva tudo o que o
// documento já traz — a pesquisa, por exemplo, anexa-lhe os excertos encontrados dentro do ficheiro.
export function useDocumentosCodificados(lista) {
  const codQ = useCodificacaoDocumentos();
  const classesQ = useClassesDocs();
  const processosQ = useProcessosDocs();

  const porDocumento = useMemo(() => {
    const m = new Map();
    for (const d of naLista(codQ.data)) m.set(d.id, d);
    return m;
  }, [codQ.data]);
  const mapaClasses = useMemo(() => mapaPorCodigo(classesQ.data), [classesQ.data]);
  const mapaProcessos = useMemo(() => mapaPorCodigo(processosQ.data), [processosQ.data]);

  return useMemo(() => {
    const docs = naLista(lista);
    if (!porDocumento.size || !docs.length) return docs;
    return docs.map(d => {
      const c = d.classe_codigo || porDocumento.get(d.id)?.classe_codigo || null;
      const p = d.processo_codigo || porDocumento.get(d.id)?.processo_codigo || null;
      if (!c && !p) return d;
      return {
        ...d,
        classe_codigo: c,
        processo_codigo: p,
        classe_nome: c ? (mapaClasses.get(c)?.nome || null) : null,
        processo_nome: p ? (mapaProcessos.get(p)?.nome || null) : null,
      };
    });
  }, [lista, porDocumento, mapaClasses, mapaProcessos]);
}

// ── o número seguinte livre ─────────────────────────────────────────────────
// Só pergunta ao servidor quando as três peças estão escolhidas. `staleTime` curto: entre abrir o formulário e
// gravar, alguém pode ter ficado com o número — a sugestão tem de ser fresca, e é por isso que ela se mostra como
// sugestão e não como número já reservado.
export function useNumeroSeguinte(classe, aeroporto, processo) {
  const pronto = !!(classe && aeroporto && processo);
  return useQuery({
    queryKey: ['gd', 'codificacao', 'proximo', classe || '', aeroporto || '', processo || ''],
    enabled: pronto,
    staleTime: 15 * 1000,
    retry: 0,
    queryFn: () => numeroSeguinte(classe, aeroporto, processo),
  });
}
