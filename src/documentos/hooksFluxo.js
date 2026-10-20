// Hooks do fluxo de aprovação (migração 156). A camada de dados está em `apiFluxo.js`; aqui guarda-se em cache,
// cruza-se o que vem de tabelas diferentes e decide-se — para o INTERFACE, nunca para a autorização — que botão
// faz sentido mostrar a quem está a olhar.
//
// As chaves de cache começam todas por 'gd', como o resto do portal, para o `useRecarregarDocs()` que já existe
// limpar isto também e não haver dois botões de recarregar com comportamentos diferentes.
//
// Duas decisões que atravessam o ficheiro:
//
//   • DEPOIS DE UM ACTO, INVALIDA-SE TUDO O QUE O ACTO TOCA. Assinar muda o fluxo, o rasto, as assinaturas, a
//     revisão, a emenda e a lista de pendentes. Em vez de corrigir cada cache à mão (e esquecer uma), invalida-se
//     o ramo inteiro: é uma consulta a mais e uma classe de bugs a menos.
//
//   • «QUEM PODE» PERGUNTA-SE AO SERVIDOR. `documento_fluxo_quem_pode()` é a autoridade e sabe da segunda porta
//     do director (titular ou suplente com nomeação viva), que o cliente não tem como adivinhar. O ecrã usa-a
//     para decidir se mostra o botão; a função de assinar volta a chamá-la.
//
// Molde: src/documentos/hooks.js e src/documentos/hooksCodificacao.js.
import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import {
  lerActos, lerPendentes, lerFluxo, lerFluxosDocumento, lerPassos, lerAvisos, lerFicheiros,
  lerAssinaturas, lerCadeia, verificarAssinatura, assinaturaPorCodigo, lerCarimbo,
  lerDirectoresAeroporto, quemPode, lerMinhasPortasDirector, podeVerEditavel, lerAcessosEditavel,
  abrirFluxo, guardarPreparacao, carregarFicheiroFluxo, substituirFicheiroFluxo,
  assinar, devolver, cancelar, actoPendente, ACTO_PADRAO, ehFluxoVivo,
} from './apiFluxo';

const MIN = 60 * 1000;
const VAZIO = [];
const naLista = (v) => (Array.isArray(v) ? v : VAZIO);
const minuscula = (v) => String(v || '').trim().toLowerCase();

export {
  abrirFluxo, guardarPreparacao, carregarFicheiroFluxo, substituirFicheiroFluxo,
  assinar, devolver, cancelar, verificarAssinatura, assinaturaPorCodigo, lerCarimbo,
};

// ── recarregar ──────────────────────────────────────────────────────────────
// Um só ponto de invalidação. Chamado depois de cada acto e disponível aos ecrãs para o botão «Tentar de novo».
export function useRecarregarFluxo() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['gd', 'fluxo'] });
    // a aprovação fecha a revisão e preenche a emenda: as duas listas do portal ficam desactualizadas
    qc.invalidateQueries({ queryKey: ['gd', 'versoes'] });
    qc.invalidateQueries({ queryKey: ['gd', 'emendas'] });
    qc.invalidateQueries({ queryKey: ['gd', 'registo-emendas'] });
    qc.invalidateQueries({ queryKey: ['gd', 'documento'] });
  };
}

// ── vocabulário dos actos ───────────────────────────────────────────────────
// O rótulo do botão e o significado que vai assinado vêm da base de dados. Com a rede em falta usam-se os
// rótulos de recurso, mas o SIGNIFICADO nunca se inventa: sem ele não se mostra o painel de assinatura, porque
// é justamente a frase que a pessoa tem de ler antes de assinar.
export function useActosFluxo() {
  const q = useQuery({ queryKey: ['gd', 'fluxo', 'actos'], staleTime: 30 * MIN, queryFn: lerActos });
  const porCodigo = useMemo(() => {
    const m = new Map();
    for (const a of naLista(q.data)) m.set(a.codigo, a);
    return m;
  }, [q.data]);
  return { ...q, porCodigo, acto: (c) => porCodigo.get(c) || (c ? { codigo: c, ...ACTO_PADRAO[c], significado: '' } : null) };
}

// ── a caixa de entrada ──────────────────────────────────────────────────────
// A vista `documento_aprovacao_pendente` diz de quem se espera (`espera_por`). Mas o director tem DUAS portas: o
// endereço nomeado no fluxo, e quem hoje responde pelo aeroporto — titular ou suplente com nomeação viva. A
// vista só conhece a primeira, por isso cruzam-se aqui as minhas portas de director, senão o fluxo ficava
// invisível a quem o tem mesmo de assinar (e era exactamente nesse momento que alguém emprestava a senha).
export function usePortasDirector() {
  const { user } = useAuth();
  const email = minuscula(user?.email);
  return useQuery({
    queryKey: ['gd', 'fluxo', 'portas-director', email],
    enabled: !!email,
    staleTime: 10 * MIN,
    queryFn: () => lerMinhasPortasDirector(email),
  });
}

export function useFluxosPendentes() {
  const { user } = useAuth();
  const email = minuscula(user?.email);
  const q = useQuery({ queryKey: ['gd', 'fluxo', 'pendentes'], staleTime: MIN, queryFn: () => lerPendentes() });
  const portasQ = usePortasDirector();

  const grupos = useMemo(() => {
    const linhas = naLista(q.data);
    const aeroportos = new Set(naLista(portasQ.data?.aeroportos));
    const suplencias = new Map(naLista(portasQ.data?.suplencias).map(s => [s.aeroporto_id, s]));

    const comigo = [];
    const meus = [];
    for (const l of linhas) {
      const esperaMim = minuscula(l.espera_por) === email;
      // um rascunho espera pelo elaborador, mas a vista não o diz (ninguém foi ainda avisado de nada)
      const rascunhoMeu = l.estado === 'rascunho' && minuscula(l.elaborador_email) === email;
      // segunda porta: o fluxo aguarda aprovação e eu respondo por este aeroporto (titular ou suplente)
      const porAeroporto = l.estado === 'aguarda_aprovacao' && !!l.aeroporto_id
        && (aeroportos.has(l.aeroporto_id) || suplencias.has(l.aeroporto_id));
      // a separação de funções vale aqui também: quem elaborou não revê nem aprova o mesmo documento
      const souElaborador = minuscula(l.elaborador_email) === email;
      const podeAssinarPorAeroporto = porAeroporto && !souElaborador;

      if (esperaMim || rascunhoMeu || podeAssinarPorAeroporto) {
        comigo.push({
          ...l,
          _porSuplencia: podeAssinarPorAeroporto && !esperaMim && suplencias.has(l.aeroporto_id)
            ? suplencias.get(l.aeroporto_id) : null,
          _porAeroporto: podeAssinarPorAeroporto && !esperaMim,
        });
      }
      if (souElaborador) meus.push(l);
    }
    return { comigo, meus, todos: linhas };
  }, [q.data, portasQ.data, email]);

  return { ...q, ...grupos, carregandoPortas: portasQ.isLoading };
}

// ── um fluxo ────────────────────────────────────────────────────────────────
export function useFluxo(id) {
  return useQuery({
    queryKey: ['gd', 'fluxo', 'um', id],
    enabled: !!id,
    staleTime: 30 * 1000,
    queryFn: () => lerFluxo(id),
  });
}

export function usePassosFluxo(fluxoId) {
  return useQuery({
    queryKey: ['gd', 'fluxo', 'passos', fluxoId],
    enabled: !!fluxoId,
    staleTime: 30 * 1000,
    queryFn: () => lerPassos(fluxoId),
  });
}

export function useAvisosFluxo(fluxoId) {
  return useQuery({
    queryKey: ['gd', 'fluxo', 'avisos', fluxoId],
    enabled: !!fluxoId,
    staleTime: MIN,
    queryFn: () => lerAvisos(fluxoId),
  });
}

// O motivo da última devolução. Não se esconde no histórico: é a primeira coisa que quem recebe o documento de
// volta precisa de ler, por isso sobe ao cabeçalho do ecrã.
export function devolucaoActual(fluxo, passos) {
  if (!fluxo || fluxo.estado !== 'devolvido') return null;
  const devolucoes = naLista(passos).filter(p => p.acao === 'devolvido');
  const ultima = devolucoes[devolucoes.length - 1];
  if (!ultima) return null;
  return {
    motivo: ultima.motivo || '',
    por: ultima.por_nome || ultima.por_email || '',
    em: ultima.em,
    para: ultima.detalhes?.para || fluxo.devolvido_para || 'elaborador',
  };
}

export function useFicheirosFluxo({ versaoId, documentoId } = {}) {
  return useQuery({
    queryKey: ['gd', 'fluxo', 'ficheiros', versaoId || null, documentoId || null],
    enabled: !!(versaoId || documentoId),
    staleTime: 30 * 1000,
    queryFn: () => lerFicheiros({ versaoId, documentoId }),
  });
}

// Tenho direito ao editável? Pergunta separada de propósito: a ausência da linha em `documento_ficheiro` é
// ambígua (pode não existir, pode existir e não ser para mim) e as duas coisas mostram-se de maneiras
// diferentes — uma com o motivo registado, a outra com nada, nem botão desactivado nem explicação.
export function usePodeVerEditavel(documentoId) {
  return useQuery({
    queryKey: ['gd', 'fluxo', 'pode-editavel', documentoId],
    enabled: !!documentoId,
    staleTime: 5 * MIN,
    queryFn: () => podeVerEditavel(documentoId),
  });
}

// O par de ficheiros da volta corrente. Segue a mesma regra da função que assina: toma-se o da ronda actual e,
// se nela não entrou ficheiro novo, o da ronda mais recente antes desta.
export function parDaRonda(ficheiros, ronda) {
  const r = Number(ronda) || 1;
  const escolher = (papel) => naLista(ficheiros)
    .filter(f => f.papel === papel && (Number(f.ronda) || 1) <= r)
    .sort((a, b) => (Number(b.ronda) || 1) - (Number(a.ronda) || 1) || new Date(b.created_date || 0) - new Date(a.created_date || 0))[0] || null;
  const pdf = escolher('pdf');
  const editavel = escolher('editavel');
  return {
    pdf,
    editavel,
    pdfDestaRonda: !!pdf && (Number(pdf.ronda) || 1) === r,
    editavelDestaRonda: !!editavel && (Number(editavel.ronda) || 1) === r,
  };
}

// ── quem pode assinar, agora, neste fluxo ───────────────────────────────────
// Devolve também o `acto` pendente e o `papel` com que a pessoa assinaria — é o papel que o painel de assinatura
// mostra antes de pedir a senha («Vai assinar como Director do aeroporto»), e não se adivinha a partir do estado.
export function useQuemPode(fluxo) {
  const { user } = useAuth();
  const email = minuscula(user?.email);
  const acto = actoPendente(fluxo);
  const q = useQuery({
    queryKey: ['gd', 'fluxo', 'quem-pode', fluxo?.id, acto, email, fluxo?.estado, fluxo?.ronda],
    enabled: !!(fluxo?.id && acto && email && ehFluxoVivo(fluxo?.estado)),
    staleTime: 30 * 1000,
    queryFn: () => quemPode(fluxo.id, acto, email),
  });
  return { ...q, acto, dados: q.data || { pode: false, motivo: null } };
}

// Devolver: quem tem o documento em mãos. O revisor devolve só ao elaborador; o director devolve a qualquer um
// dos dois. Em rascunho não há nada para devolver — ainda não saiu de casa.
export function podeDevolver(fluxo, quem) {
  if (!fluxo || !quem?.pode) return false;
  return fluxo.estado === 'aguarda_revisao' || fluxo.estado === 'aguarda_aprovacao';
}
export function destinosDevolucao(fluxo) {
  if (fluxo?.estado === 'aguarda_aprovacao') return ['elaborador', 'revisor'];
  if (fluxo?.estado === 'aguarda_revisao') return ['elaborador'];
  return [];
}

// Cancelar: o elaborador ou um gestor do portal, enquanto o fluxo está vivo. Um gestor cancela mas **não assina
// no lugar de ninguém** — não há caminho para isso em sítio nenhum do modelo.
export function podeCancelar(fluxo, { email, gestor } = {}) {
  if (!fluxo || !ehFluxoVivo(fluxo.estado)) return false;
  return !!gestor || minuscula(fluxo.elaborador_email) === minuscula(email);
}

// ── assinaturas e cadeia ────────────────────────────────────────────────────
export function useAssinaturasDocumento(documentoId) {
  return useQuery({
    queryKey: ['gd', 'fluxo', 'assinaturas', 'doc', documentoId],
    enabled: !!documentoId,
    staleTime: MIN,
    queryFn: () => lerAssinaturas({ documentoId }),
  });
}

export function useAssinaturasFluxo(fluxoId) {
  return useQuery({
    queryKey: ['gd', 'fluxo', 'assinaturas', 'fluxo', fluxoId],
    enabled: !!fluxoId,
    staleTime: 30 * 1000,
    queryFn: () => lerAssinaturas({ fluxoId }),
  });
}

// A cadeia do documento, com os dois sinais que só ela dá: `elo_confere` (esta assinatura está bem formada) e
// `ligacao_confere` (não falta nenhuma e nenhuma foi intercalada).
export function useCadeiaAssinaturas(documentoId) {
  const q = useQuery({
    queryKey: ['gd', 'fluxo', 'cadeia', documentoId],
    enabled: !!documentoId,
    staleTime: MIN,
    queryFn: () => lerCadeia(documentoId),
  });
  const resumo = useMemo(() => {
    const linhas = naLista(q.data);
    const partida = linhas.filter(l => l.elo_confere === false || l.ligacao_confere === false);
    const trocados = linhas.filter(l => l.ficheiro_intacto === false);
    return {
      total: linhas.length,
      intacta: linhas.length > 0 && partida.length === 0,
      partida,
      trocados,
      // a primeira assinatura onde a cadeia parte: é daí para a frente que o registo deixa de se poder garantir
      primeiraQuebra: partida[0] || null,
    };
  }, [q.data]);
  return { ...q, porId: useMemo(() => new Map(naLista(q.data).map(l => [l.assinatura_id, l])), [q.data]), resumo };
}

// Verificação de UMA assinatura, pedida só quando alguém a abre. Não se verifica a lista toda de uma vez: cada
// verificação recalcula um HMAC no servidor, e a lista já traz `ficheiro_intacto` da vista.
export function useVerificarAssinatura(assinaturaId, { enabled = true } = {}) {
  return useQuery({
    queryKey: ['gd', 'fluxo', 'verificar', assinaturaId],
    enabled: !!assinaturaId && enabled,
    staleTime: 5 * MIN,
    queryFn: () => verificarAssinatura(assinaturaId),
  });
}

// Acessos ao editável: aberturas, descargas e RECUSAS. As recusas são o sinal que interessa — alguém a tentar
// chegar ao ficheiro que permite alterar o conteúdo é precisamente o que se quer ver escrito.
export function useAcessosEditavel(documentoId) {
  return useQuery({
    queryKey: ['gd', 'fluxo', 'acessos-editavel', documentoId],
    enabled: !!documentoId,
    staleTime: MIN,
    queryFn: () => lerAcessosEditavel(documentoId),
  });
}

// ── o documento por trás do fluxo ───────────────────────────────────────────
// O ecrã de assinatura precisa do número, do título, do aeroporto, da revisão e da emenda. São quatro tabelas, e
// pedem-se numa só consulta de cada para não se fazer uma cascata de pedidos encadeados.
export function useContextoFluxo(fluxo) {
  const documentoId = fluxo?.documento_id || null;
  const versaoId = fluxo?.versao_id || null;
  const emendaId = fluxo?.emenda_id || null;
  const aeroportoId = fluxo?.aeroporto_id || null;

  const docQ = useQuery({
    queryKey: ['gd', 'fluxo', 'ctx-doc', documentoId],
    enabled: !!documentoId,
    staleTime: MIN,
    queryFn: async () => {
      const { data, error } = await supabase.from('documento')
        .select('id,numero,titulo,estado,versao_atual,aeroporto_id,pasta_id,responsavel_email,created_by,bloquear_download,editavel_restrito_a')
        .eq('id', documentoId).maybeSingle();
      if (error) throw error;
      return data || null;
    },
  });
  const versaoQ = useQuery({
    queryKey: ['gd', 'fluxo', 'ctx-versao', versaoId],
    enabled: !!versaoId,
    staleTime: MIN,
    queryFn: async () => {
      const { data, error } = await supabase.from('documento_versao')
        .select('id,versao,rotulo,estado,nota,arquivo_nome,sha256,vigor_desde,aprovado_por,aprovado_em')
        .eq('id', versaoId).maybeSingle();
      if (error) throw error;
      return data || null;
    },
  });
  const emendaQ = useQuery({
    queryKey: ['gd', 'fluxo', 'ctx-emenda', emendaId],
    enabled: !!emendaId,
    staleTime: MIN,
    queryFn: async () => {
      const { data, error } = await supabase.from('documento_emenda')
        .select('id,numero,tipo,resumo,estado,paginas_afectadas,versao_resultante').eq('id', emendaId).maybeSingle();
      if (error) throw error;
      return data || null;
    },
  });
  const aeroportoQ = useQuery({
    queryKey: ['gd', 'fluxo', 'ctx-aeroporto', aeroportoId],
    enabled: !!aeroportoId,
    staleTime: 10 * MIN,
    queryFn: async () => {
      const { data, error } = await supabase.from('documentos_aeroporto')
        .select('id,codigo_icao,nome').eq('id', aeroportoId).maybeSingle();
      if (error) return null;
      return data || null;
    },
  });

  return {
    documento: docQ.data || null,
    versao: versaoQ.data || null,
    emenda: emendaQ.data || null,
    aeroporto: aeroportoQ.data || null,
    isLoading: docQ.isLoading || versaoQ.isLoading,
    isError: docQ.isError,
    refetch: () => { docQ.refetch?.(); versaoQ.refetch?.(); emendaQ.refetch?.(); },
  };
}

// Rótulo da revisão: o `rotulo` quando existe, senão o número. Nunca em branco — um espaço vazio numa lista de
// revisões parece avaria.
export const rotuloRevisao = (versao) => String(versao?.rotulo || versao?.versao || '—');

// ── fluxos de um documento ──────────────────────────────────────────────────
export function useFluxosDocumento(documentoId) {
  const q = useQuery({
    queryKey: ['gd', 'fluxo', 'do-documento', documentoId],
    enabled: !!documentoId,
    staleTime: MIN,
    queryFn: () => lerFluxosDocumento(documentoId),
  });
  const vivo = useMemo(() => naLista(q.data).find(f => ehFluxoVivo(f.estado)) || null, [q.data]);
  return { ...q, vivo };
}

// ── directores do aeroporto (para o formulário de arranque) ─────────────────
export function useDirectoresAeroporto(aeroportoId) {
  return useQuery({
    queryKey: ['gd', 'fluxo', 'directores', aeroportoId],
    enabled: !!aeroportoId,
    staleTime: 10 * MIN,
    queryFn: () => lerDirectoresAeroporto(aeroportoId),
  });
}

// Pessoas que se podem escolher para revisor e para director. Lê-se `users` porque é onde estão os nomes; a
// lista é curta (o portal tem dezenas de contas, não milhares) e o servidor já filtra o que cada um pode ver.
export function usePessoasFluxo() {
  return useQuery({
    queryKey: ['gd', 'fluxo', 'pessoas'],
    staleTime: 10 * MIN,
    queryFn: async () => {
      const { data, error } = await supabase.from('users')
        .select('id,email,full_name,perfis,status').eq('status', 'ativo').order('full_name');
      if (error) return [];
      return naLista(data).filter(u => u.email);
    },
  });
}
