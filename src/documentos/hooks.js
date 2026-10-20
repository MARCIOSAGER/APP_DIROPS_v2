// Camada de dados do Portal de Documentos. Tudo passa pelo PostgREST com a sessão do portal: o que cada utilizador
// vê é decidido no servidor (migrações 136a/136b/136c), não aqui. Molde: src/universidade/hooks.js.
import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { docsAcesso } from './api';
import { registarPerfisPersonalizados, ehNomePerfilPersonalizado } from '@/lib/portalDocumentos';

const MIN = 60 * 1000;
const naLista = (v) => (Array.isArray(v) ? v : []);

// ── configuração do portal ──────────────────────────────────────────────────
export function useConfigPortalDocs() {
  return useQuery({
    queryKey: ['gd', 'config'],
    staleTime: 5 * MIN,
    queryFn: async () => {
      const { data, error } = await supabase.from('documentos_config').select('*').eq('id', 'geral').maybeSingle();
      if (error) throw error;
      return data || {};
    },
  });
}
export async function guardarConfigPortalDocs(patch) {
  const { error } = await supabase.from('documentos_config').update({ ...patch, updated_date: new Date().toISOString() }).eq('id', 'geral');
  if (error) throw error;
}

// ── permissões (perfil → páginas), afinadas na gestão ───────────────────────
export function usePermissoesPortalDocs() {
  return useQuery({
    queryKey: ['gd', 'permissoes'],
    staleTime: 5 * MIN,
    queryFn: async () => {
      // '*' para funcionar antes e depois da migração 179 (perfis personalizados: label, cor, descricao, nivel)
      const { data, error } = await supabase.from('documentos_permissao').select('*');
      if (error) return {};
      registarPerfisPersonalizados(naLista(data));
      const mapa = {};
      for (const r of naLista(data)) if (Array.isArray(r.paginas)) mapa[r.perfil] = r.paginas;
      return mapa;
    },
  });
}
// Criar ou alterar um perfil personalizado (migração 179). O nome técnico (doc_…) não muda depois de criado.
export async function guardarPerfilPersonalizadoDocs({ perfil, label, cor, descricao, nivel, paginas }, actor) {
  if (!ehNomePerfilPersonalizado(perfil)) throw new Error('Nome técnico inválido (tem de começar por «doc_» e ter só letras, números e _).');
  if (!String(label || '').trim()) throw new Error('Indique o nome do perfil.');
  if (!['leitor', 'editor', 'gestor'].includes(nivel)) throw new Error('Escolha o nível base (leitor, editor ou gestor).');
  const { error } = await supabase.from('documentos_permissao').upsert({
    perfil, label: String(label).trim(), cor: cor || null, descricao: String(descricao || '').trim() || null, nivel,
    personalizado: true, paginas: Array.isArray(paginas) ? paginas : [], updated_by: actor?.email || null, updated_date: new Date().toISOString(),
  }, { onConflict: 'perfil' });
  if (error) {
    if (/column|schema cache|PGRST204/i.test(error.message || '')) throw new Error('A base de dados ainda não tem os perfis personalizados (migração 179 por aplicar).');
    throw new Error(error.message || 'Não foi possível guardar o perfil.');
  }
}
export async function apagarPerfilPersonalizadoDocs(perfil) {
  if (!ehNomePerfilPersonalizado(perfil)) throw new Error('Só se apagam perfis personalizados.');
  const { error } = await supabase.from('documentos_permissao').delete().eq('perfil', perfil).eq('personalizado', true);
  if (error) throw new Error(error.message || 'Não foi possível apagar o perfil.');
}
export async function guardarPermissoesPortalDocs(perfil, paginas, actor) {
  const { error } = await supabase.from('documentos_permissao').upsert({ perfil, paginas, updated_by: actor?.email || null }, { onConflict: 'perfil' });
  if (error) throw new Error(error.message || 'Não foi possível guardar.');
}

// ── aeroportos e tipos ──────────────────────────────────────────────────────
export function useAeroportosDocs() {
  return useQuery({
    queryKey: ['gd', 'aeroportos'],
    staleTime: 10 * MIN,
    queryFn: async () => {
      // Lista própria do portal (migração 145). Deixámos de ler a tabela do DIROPS: o portal é independente e os
      // aeroportos editam-se aqui dentro, como na Universidade. Os identificadores são os mesmos, por isso os
      // documentos e as pastas que já apontavam para o FNMO continuam a apontar para o mesmo sítio.
      const { data, error } = await supabase.from('documentos_aeroporto').select('*').eq('ativo', true).order('ordem').order('codigo_icao');
      if (error) throw error;
      return naLista(data);
    },
  });
}
export function useTiposDocumento() {
  return useQuery({
    queryKey: ['gd', 'tipos'],
    staleTime: 10 * MIN,
    queryFn: async () => {
      const { data, error } = await supabase.from('documento_tipo').select('*').eq('ativo', true).order('ordem');
      if (error) throw error;
      return naLista(data);
    },
  });
}
export function useResponsaveisAeroporto() {
  return useQuery({
    queryKey: ['gd', 'responsaveis'],
    staleTime: 10 * MIN,
    queryFn: async () => {
      const { data, error } = await supabase.from('documentos_aeroporto_responsavel').select('aeroporto_id,email,nome');
      if (error) return [];
      return naLista(data);
    },
  });
}

// ── pastas ──────────────────────────────────────────────────────────────────
export function usePastasDocs() {
  return useQuery({
    queryKey: ['gd', 'pastas'],
    staleTime: 2 * MIN,
    queryFn: async () => {
      const { data, error } = await supabase.from('pasta').select('*').is('deleted_at', null).order('ordem').order('nome');
      if (error) throw error;
      return naLista(data);
    },
  });
}
// Árvore de pastas a partir da lista plana (a raiz são as que não têm pai visível).
export function useArvorePastas() {
  const { data: pastas = [], ...resto } = usePastasDocs();
  const arvore = useMemo(() => {
    const porId = new Map(pastas.map(p => [p.id, { ...p, filhas: [] }]));
    const raiz = [];
    for (const p of porId.values()) {
      const pai = p.pasta_pai_id ? porId.get(p.pasta_pai_id) : null;
      if (pai) pai.filhas.push(p); else raiz.push(p);
    }
    return raiz;
  }, [pastas]);
  return { ...resto, data: pastas, arvore };
}

// ── documentos ──────────────────────────────────────────────────────────────
const COLS_DOC = 'id,titulo,descricao,numero,categoria,tipo_id,classe_codigo,processo_codigo,classificado,estado,versao,versao_atual,aeroporto_id,pasta_id,entidade_emissora,responsavel_email,publicacao_em,em_vigor_desde,expira_em,data_publicacao,data_expiracao,tags,nivel_confidencialidade,bloquear_download,requer_senha_adicional,usar_storage_privado,arquivo_privado_uri,arquivo_url,created_by,created_date,updated_date,exige_leitura,leitura_perfis,leitura_prazo_dias,estrutura_ref';

export function useDocumentosDocs({ pastaId, aeroportoId, estado, tipoId, texto, limite = 500 } = {}) {
  return useQuery({
    queryKey: ['gd', 'documentos', { pastaId, aeroportoId, estado, tipoId, texto, limite }],
    staleTime: MIN,
    queryFn: async () => {
      let q = supabase.from('documento').select(COLS_DOC).is('deleted_at', null).is('voo_ligado_id', null);
      if (pastaId) q = q.eq('pasta_id', pastaId);
      if (aeroportoId) q = q.eq('aeroporto_id', aeroportoId);
      if (estado) q = q.eq('estado', estado);
      if (tipoId) q = q.eq('tipo_id', tipoId);
      if (texto && texto.trim()) {
        const t = texto.trim().replace(/[%,]/g, ' ');
        q = q.or(`titulo.ilike.%${t}%,numero.ilike.%${t}%,descricao.ilike.%${t}%`);
      }
      const { data, error } = await q.order('updated_date', { ascending: false }).limit(limite);
      if (error) throw error;
      return naLista(data);
    },
  });
}

export function useDocumentoDocs(id) {
  return useQuery({
    queryKey: ['gd', 'documento', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('documento').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useVersoesDocumento(documentoId) {
  return useQuery({
    queryKey: ['gd', 'versoes', documentoId],
    enabled: !!documentoId,
    queryFn: async () => {
      const { data, error } = await supabase.from('documento_versao').select('*').eq('documento_id', documentoId).order('versao', { ascending: false });
      if (error) throw error;
      return naLista(data);
    },
  });
}

// Pesquisa em texto integral (coluna `pesquisa`, tsvector com título, número, descrição e etiquetas).
export function usePesquisaDocs(termo, { limite = 100 } = {}) {
  const t = String(termo || '').trim();
  return useQuery({
    queryKey: ['gd', 'pesquisa', t, limite],
    enabled: t.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase.from('documento').select(COLS_DOC)
        .is('deleted_at', null).is('voo_ligado_id', null)
        .textSearch('pesquisa', t, { type: 'websearch', config: 'portuguese' })
        .limit(limite);
      if (error) {
        // fallback simples se a pesquisa por texto integral falhar (ex.: termo com sintaxe inválida)
        const { data: d2 } = await supabase.from('documento').select(COLS_DOC).is('deleted_at', null).is('voo_ligado_id', null)
          .or(`titulo.ilike.%${t}%,numero.ilike.%${t}%`).limit(limite);
        return naLista(d2);
      }
      return naLista(data);
    },
  });
}

// ── leituras («li e tomei conhecimento») ────────────────────────────────────
export function useMinhasLeituras(email) {
  return useQuery({
    queryKey: ['gd', 'leituras', email],
    enabled: !!email,
    staleTime: MIN,
    queryFn: async () => {
      const { data, error } = await supabase.from('documento_leitura').select('documento_id,versao,lido_em').eq('email', String(email).toLowerCase());
      if (error) return [];
      return naLista(data);
    },
  });
}
export async function confirmarLeitura(documentoId, email, versao = null) {
  const { error } = await supabase.from('documento_leitura').insert({
    documento_id: documentoId, email: String(email).toLowerCase(), versao, lido_em: new Date().toISOString(), endereco_ip: 'client',
  });
  if (error && !String(error.message || '').includes('duplicate')) throw error;
}
export function useLeiturasDocumento(documentoId) {
  return useQuery({
    queryKey: ['gd', 'leituras-doc', documentoId],
    enabled: !!documentoId,
    queryFn: async () => {
      const { data, error } = await supabase.from('documento_leitura').select('email,versao,lido_em').eq('documento_id', documentoId).order('lido_em', { ascending: false });
      if (error) return [];
      return naLista(data);
    },
  });
}

// ── acessos (pedidos, convites, utilizadores do portal) ─────────────────────
export function useAcessosDocs(enabled = true) {
  return useQuery({
    queryKey: ['gd', 'acessos'],
    enabled,
    staleTime: 30 * 1000,
    queryFn: async () => docsAcesso('listar'),
  });
}
export async function guardarPerfisDocumentos(u, perfis, actor) {
  return docsAcesso('perfis', { email: u?.email, perfis, actor: actor?.email });
}
export async function revogarAcessoDocs(u, actor) {
  return docsAcesso('revogar', { email: u?.email, actor: actor?.email });
}
export async function excluirContaDocs(u, actor) {
  return docsAcesso('excluir', { email: u?.email, actor: actor?.email });
}
export async function convidarParaDocs(emails, { mensagem, perfis } = {}) {
  return docsAcesso('convites', { emails, mensagem, ...(Array.isArray(perfis) && perfis.length ? { perfis } : {}) });
}

// ── auditoria ───────────────────────────────────────────────────────────────
export function useAuditoriaDocs({ de, ate, limite = 1000 } = {}) {
  return useQuery({
    queryKey: ['gd', 'auditoria', de, ate, limite],
    staleTime: MIN,
    queryFn: async () => {
      let q = supabase.from('log_acesso_documento').select('*').order('data_hora_acesso', { ascending: false }).limit(limite);
      if (de) q = q.gte('data_hora_acesso', de);
      if (ate) q = q.lte('data_hora_acesso', ate);
      const { data, error } = await q;
      if (error) return [];
      return naLista(data);
    },
  });
}
export async function auditarDocs(actor, { acao, entidade = 'documento', id, detalhes }) {
  try {
    await supabase.from('log_auditoria').insert({
      usuario_email: actor?.email || 'desconhecido', usuario_nome: actor?.full_name || actor?.email || '',
      entidade, acao, modulo: 'Documentos', id_registro: id || null, detalhes: detalhes || '', created_date: new Date().toISOString(),
    });
  } catch { /* a auditoria nunca pode travar a acção do utilizador */ }
}

// ── links partilháveis ──────────────────────────────────────────────────────
export function useLinksPartilhaDocs() {
  return useQuery({
    queryKey: ['gd', 'links'],
    staleTime: MIN,
    queryFn: async () => {
      const { data, error } = await supabase.from('documento_link_partilha')
        .select('id,documento_id,pasta_id,pastas_ids,aeroportos_ids,criado_por,criado_em,expira_em,revogado_em,downloads_count,max_downloads,recursivo')
        .order('criado_em', { ascending: false }).limit(300);
      if (error) return [];
      return naLista(data);
    },
  });
}

// Invalidação simples depois de gravar (as páginas chamam isto em vez de recarregar tudo).
export function useRecarregarDocs() {
  const qc = useQueryClient();
  return (chave) => qc.invalidateQueries({ queryKey: chave ? ['gd', chave] : ['gd'] });
}

// ── acrescentado para as páginas de gestão (painel e relatórios) ────────────
// Confirmações de leitura de todos os documentos que o utilizador pode ver (a regra 136b dá aos gestores as
// leituras dos documentos que vêem e a cada pessoa as suas). Serve a cobertura de leitura e os indicadores.
export function useTodasLeiturasDocs({ limite = 5000 } = {}) {
  return useQuery({
    queryKey: ['gd', 'leituras-todas', limite],
    staleTime: 2 * MIN,
    queryFn: async () => {
      const { data, error } = await supabase.from('documento_leitura')
        .select('documento_id,email,versao,lido_em').order('lido_em', { ascending: false }).limit(limite);
      if (error) return [];
      return naLista(data);
    },
  });
}

// Quem é membro de cada aeroporto (documentos_acesso_aeroporto): denominador da cobertura de leitura.
export function useAcessoAeroportoDocs() {
  return useQuery({
    queryKey: ['gd', 'acesso-aeroporto'],
    staleTime: 10 * MIN,
    queryFn: async () => {
      const { data, error } = await supabase.from('documentos_acesso_aeroporto').select('email,aeroporto_id');
      if (error) return [];
      return naLista(data);
    },
  });
}

// Endereços dos links partilháveis: o token (que `useLinksPartilhaDocs` não traz, para a lista não andar com
// segredos) e a base pública devolvida pelo servidor (Cloudflare), precisos só para copiar o endereço na gestão.
export function useEnderecosLinksDocs() {
  return useQuery({
    queryKey: ['gd', 'links-enderecos'],
    staleTime: MIN,
    queryFn: async () => {
      const [r, cfg] = await Promise.all([
        supabase.from('documento_link_partilha').select('id,token').order('criado_em', { ascending: false }).limit(300),
        supabase.functions.invoke('share-link-config').catch(() => ({ data: null })),
      ]);
      const tokens = {};
      for (const l of naLista(r?.data)) tokens[l.id] = l.token;
      return { tokens, base: cfg?.data?.base_url || '' };
    },
  });
}

// ── aeroportos do portal: lista própria, responsáveis (quem aprova) e membros (quem vê) ──
// A lista de aeroportos passou a ser do portal (migração 145, tabela `documentos_aeroporto`): cria-se, edita-se e
// desactiva-se aqui dentro. Os identificadores foram copiados do DIROPS, por isso os documentos e as pastas que já
// existiam continuam a apontar para o mesmo aeroporto.
// Quem pode gravar é decidido pelo servidor; a mensagem abaixo traduz a recusa em português em vez de mostrar o
// erro cru da política.
const erroAeroporto = (error, acao) => {
  const msg = String(error?.message || '');
  if (error?.code === '42501' || /policy|permission|denied|row-level/i.test(msg)) {
    return new Error(`Não foi possível ${acao}: não tem permissão para esta alteração no portal.`);
  }
  if (error?.code === '23505' || /duplicate|unique/i.test(msg)) {
    return new Error(`Não foi possível ${acao}: já existe um registo com esses dados.`);
  }
  if (error?.code === '23503' || /foreign key|violates/i.test(msg)) {
    return new Error(`Não foi possível ${acao}: há documentos ou pastas agarrados a este aeroporto. Desactive-o em vez de o apagar.`);
  }
  return new Error(msg || `Não foi possível ${acao}.`);
};
const minuscula = (e) => String(e || '').trim().toLowerCase();

// Todos os aeroportos do portal, incluindo os desactivados (o ecrã de gestão tem de os poder ver e repor).
// `useAeroportosDocs` continua a devolver só os activos, que é o que as listas e os selectores querem.
export function useAeroportosDocsTodos() {
  return useQuery({
    queryKey: ['gd', 'aeroportos-todos'],
    staleTime: 2 * MIN,
    queryFn: async () => {
      const { data, error } = await supabase.from('documentos_aeroporto').select('*').order('ordem').order('codigo_icao');
      if (error) throw error;
      return naLista(data);
    },
  });
}
// Criar ou alterar um aeroporto do portal. Sem `id` cria; com `id` altera.
export async function guardarAeroportoDocs({ id, codigo_icao, nome, cidade, provincia, ordem, ativo, observacoes }, actor) {
  const codigo = String(codigo_icao || '').trim().toUpperCase();
  if (!codigo || !String(nome || '').trim()) throw new Error('O código ICAO e o nome são obrigatórios.');
  const linha = {
    codigo_icao: codigo,
    nome: String(nome).trim(),
    cidade: cidade?.trim() || null,
    provincia: provincia?.trim() || null,
    ordem: Number.isFinite(Number(ordem)) ? Number(ordem) : 0,
    ativo: ativo !== false,
    observacoes: observacoes?.trim() || null,
    updated_by: actor?.email || null,
  };
  const q = id
    ? supabase.from('documentos_aeroporto').update(linha).eq('id', id)
    : supabase.from('documentos_aeroporto').insert(linha);
  const { error } = await q;
  if (error) throw erroAeroporto(error, id ? 'guardar o aeroporto' : 'criar o aeroporto');
}
// Desactivar (deixa de aparecer nas listas, mas os documentos e as pastas ficam ligados a ele) ou repor.
export async function activarAeroportoDocs(id, ativo, actor) {
  const { error } = await supabase.from('documentos_aeroporto')
    .update({ ativo: !!ativo, updated_by: actor?.email || null }).eq('id', id);
  if (error) throw erroAeroporto(error, ativo ? 'repor o aeroporto' : 'desactivar o aeroporto');
}
// Apagar de vez: só quando nada está agarrado (o servidor recusa pela chave estrangeira, e a mensagem explica-o).
export async function apagarAeroportoDocs(id) {
  const { error } = await supabase.from('documentos_aeroporto').delete().eq('id', id);
  if (error) throw erroAeroporto(error, 'apagar o aeroporto');
}

export async function acrescentarResponsavelAeroporto(aeroportoId, { email, nome, cargo, telefone } = {}) {
  const alvo = minuscula(email);
  if (!aeroportoId || !alvo.includes('@')) throw new Error('Indique o aeroporto e um email válido.');
  const { error } = await supabase.from('documentos_aeroporto_responsavel').upsert({
    aeroporto_id: aeroportoId, email: alvo,
    nome: nome?.trim() || null, cargo: cargo?.trim() || null, telefone: telefone?.trim() || null,
  }, { onConflict: 'aeroporto_id,email' });
  if (error) throw erroAeroporto(error, 'acrescentar o responsável');
}
export async function removerResponsavelAeroporto(aeroportoId, email) {
  const { error } = await supabase.from('documentos_aeroporto_responsavel')
    .delete().eq('aeroporto_id', aeroportoId).eq('email', minuscula(email));
  if (error) throw erroAeroporto(error, 'remover o responsável');
}
// Vários emails de uma vez (cola-se uma lista); devolve quantos ficaram.
export async function acrescentarMembrosAeroporto(aeroportoId, emails = []) {
  const lista = [...new Set((Array.isArray(emails) ? emails : [emails]).map(minuscula).filter(e => e.includes('@')))];
  if (!aeroportoId || !lista.length) throw new Error('Indique o aeroporto e pelo menos um email válido.');
  const { error } = await supabase.from('documentos_acesso_aeroporto')
    .upsert(lista.map(email => ({ email, aeroporto_id: aeroportoId })), { onConflict: 'email,aeroporto_id' });
  if (error) throw erroAeroporto(error, 'dar acesso a estas pessoas');
  return lista.length;
}
export async function removerMembroAeroporto(aeroportoId, email) {
  const { error } = await supabase.from('documentos_acesso_aeroporto')
    .delete().eq('aeroporto_id', aeroportoId).eq('email', minuscula(email));
  if (error) throw erroAeroporto(error, 'retirar o acesso');
}

// Responsáveis com a ficha completa (nome, cargo, telefone): o `useResponsaveisAeroporto` traz só o essencial
// para decidir quem aprova, e é usado em listas; este serve o ecrã de gestão dos aeroportos.
export function useResponsaveisAeroportoDetalhe() {
  return useQuery({
    queryKey: ['gd', 'responsaveis-detalhe'],
    staleTime: 2 * MIN,
    queryFn: async () => {
      const { data, error } = await supabase.from('documentos_aeroporto_responsavel')
        .select('aeroporto_id,email,nome,cargo,telefone,created_date').order('nome');
      if (error) throw error;
      return naLista(data);
    },
  });
}

// ── Registo de Emendas (migração 150) ───────────────────────────────────────
// O Instrutivo 22C.107.001.A não deixa isto ao gosto de ninguém: o Anexo 3 fixa as SETE colunas do Registo de
// Emendas, o Apêndice 1 §1.5 exige folha de controlo numerada e datada e dá aos detentores 30 dias para
// confirmarem, e o §1.7 separa dois percursos — a emenda carece de aprovação prévia da ANAC, a corrigenda não.
// Há duas leituras do mesmo registo, e as duas são precisas:
//   • a VISTA `documento_registo_emendas` tem exactamente as colunas do Anexo 3, com estes nomes e acentos. É a
//     fonte do que se mostra na tabela legal e do que se exporta para a ANAC — nunca se reescrevem os títulos.
//   • a TABELA `documento_emenda` tem o percurso (rascunho → enviada à ANAC → aprovada → distribuída) e as datas
//     de cada passo. É a fonte do detalhe e de todas as gravações.
// A vista traz já a contagem de confirmações, por isso a lista não precisa de ir buscar as confirmações todas.

// Os títulos do Anexo 3, pela ordem do anexo. Servem de cabeçalho na tabela e nas exportações: quem receber o
// ficheiro tem de reconhecer o formato à primeira vista.
export const COLUNAS_ANEXO3 = [
  'Nº', 'Data da Modificação', 'Data de Inserção', 'Inserido por',
  'Páginas Afectadas', 'Resumo da Modificação', 'Aprovado por',
];

export const ESTADOS_EMENDA = ['rascunho', 'enviada_anac', 'aprovada_anac', 'distribuida', 'cancelada'];

const hojeIso = () => new Date().toISOString().slice(0, 10);
const soData = (v) => (v && String(v).trim() ? String(v).slice(0, 10) : null);
const textoOuNulo = (v) => (String(v ?? '').trim() ? String(v).trim() : null);

const erroEmenda = (error, acao) => {
  const msg = String(error?.message || '');
  if (error?.code === '42501' || /policy|permission|denied|row-level/i.test(msg)) {
    return new Error(`Não foi possível ${acao}: não tem permissão para emendar este documento.`);
  }
  if (error?.code === '23505' || /duplicate|unique/i.test(msg)) {
    return new Error(`Não foi possível ${acao}: já existe uma emenda com esse número neste documento.`);
  }
  return new Error(msg || `Não foi possível ${acao}.`);
};

// A vista do Anexo 3. Sem `documentoId` traz as emendas de todos os documentos que o utilizador pode ver.
// A ordenação faz-se aqui (documento, depois número): o ORDER BY de dentro da vista não sobrevive ao PostgREST,
// e os nomes com acentos não são seguros num parâmetro de ordenação.
export function useRegistoEmendas({ documentoId, limite = 2000 } = {}) {
  return useQuery({
    queryKey: ['gd', 'registo-emendas', documentoId || 'todos', limite],
    staleTime: MIN,
    queryFn: async () => {
      let q = supabase.from('documento_registo_emendas').select('*').limit(limite);
      if (documentoId) q = q.eq('documento_id', documentoId);
      const { data, error } = await q;
      if (error) throw error;
      return naLista(data).sort((a, b) => (
        String(a.documento_id).localeCompare(String(b.documento_id)) || (Number(a['Nº']) - Number(b['Nº']))
      ));
    },
  });
}

// A tabela, com o percurso perante a ANAC e as datas de cada passo. Alimenta o detalhe e a gravação.
const COLS_EMENDA = 'id,documento_id,numero,tipo,modo,data_modificacao,data_insercao,inserido_por,paginas_afectadas,resumo,aprovado_por,aprovado_em,versao_resultante,estado,enviada_anac_em,aprovada_anac_em,distribuida_em,prazo_confirmacao,folha_controlo,criado_por,created_date,updated_date';
export function useEmendasDocs({ documentoId, limite = 2000 } = {}) {
  return useQuery({
    queryKey: ['gd', 'emendas', documentoId || 'todos', limite],
    staleTime: MIN,
    queryFn: async () => {
      let q = supabase.from('documento_emenda').select(COLS_EMENDA).order('numero', { ascending: false }).limit(limite);
      if (documentoId) q = q.eq('documento_id', documentoId);
      const { data, error } = await q;
      if (error) throw error;
      return naLista(data);
    },
  });
}

// Quem confirmou, por emenda. A regra 150 dá ao gestor as confirmações dos documentos que vê e a cada pessoa as
// suas — não é preciso filtrar aqui, e também não convém: quem é gestor precisa da lista toda.
export function useConfirmacoesEmendas({ limite = 5000 } = {}) {
  return useQuery({
    queryKey: ['gd', 'emendas-confirmacoes', limite],
    staleTime: MIN,
    queryFn: async () => {
      const { data, error } = await supabase.from('documento_emenda_confirmacao')
        .select('emenda_id,email,nome,confirmado_em').order('confirmado_em', { ascending: false }).limit(limite);
      if (error) throw error;
      return naLista(data);
    },
  });
}

// Criar ou alterar uma emenda. Sem `id` cria — e cria-se sem `numero`, sem `folha_controlo` e sem `estado`, porque
// é o gatilho da base de dados que numera consecutivamente e que faz a corrigenda nascer já aprovada (§1.7).
export async function guardarEmenda(e, actor) {
  if (!e?.documento_id) throw new Error('Escolha o documento a que a emenda pertence.');
  if (!textoOuNulo(e.resumo)) throw new Error('O resumo da modificação é obrigatório: é a sexta coluna do Registo de Emendas.');
  const modo = e.modo === 'paginas' ? 'paginas' : 'documento';
  if (modo === 'paginas' && !textoOuNulo(e.paginas_afectadas)) {
    throw new Error('Por páginas substituídas tem de dizer quais saem e quais entram: é a quinta coluna do Registo de Emendas.');
  }
  const prazo = Number(e.prazo_confirmacao);
  const linha = {
    documento_id: e.documento_id,
    tipo: e.tipo === 'corrigenda' ? 'corrigenda' : 'emenda',
    modo,
    data_modificacao: soData(e.data_modificacao) || hojeIso(),
    data_insercao: soData(e.data_insercao),
    // o Anexo 3 pede o nome em maiúsculas (§1.5.e.iv); a vista também o faz, mas guarda-se já assim
    inserido_por: textoOuNulo(e.inserido_por)?.toUpperCase() || null,
    paginas_afectadas: modo === 'paginas' ? textoOuNulo(e.paginas_afectadas) : null,
    resumo: String(e.resumo).trim(),
    aprovado_por: textoOuNulo(e.aprovado_por),
    versao_resultante: textoOuNulo(e.versao_resultante),
    prazo_confirmacao: Number.isFinite(prazo) && prazo > 0 ? Math.round(prazo) : 30,
  };
  if (e.id) {
    const { error } = await supabase.from('documento_emenda')
      .update({ ...linha, updated_date: new Date().toISOString() }).eq('id', e.id);
    if (error) throw erroEmenda(error, 'guardar a emenda');
    return { id: e.id };
  }
  const { data, error } = await supabase.from('documento_emenda')
    .insert({ ...linha, criado_por: actor?.email || null })
    .select('id,numero,estado,folha_controlo').maybeSingle();
  if (error) throw erroEmenda(error, 'registar a emenda');
  return data || {};
}

// Andar no percurso. Cada passo deixa a sua data: é isso que se mostra à ANAC quando pergunta quando foi enviada,
// quando foi aprovada e quando foi distribuída. A distribuição é também o início da contagem dos 30 dias.
export async function marcarEstadoEmenda(emenda, estado, actor) {
  if (!emenda?.id) throw new Error('Emenda desconhecida.');
  if (!ESTADOS_EMENDA.includes(estado)) throw new Error('Estado desconhecido.');
  const agora = new Date().toISOString();
  const patch = { estado, updated_date: agora };
  if (estado === 'enviada_anac' && !emenda.enviada_anac_em) patch.enviada_anac_em = hojeIso();
  if (estado === 'aprovada_anac') {
    if (!emenda.aprovada_anac_em) patch.aprovada_anac_em = hojeIso();
    if (!emenda.aprovado_em) patch.aprovado_em = agora;
    if (!textoOuNulo(emenda.aprovado_por)) patch.aprovado_por = actor?.full_name || actor?.email || null;
  }
  if (estado === 'distribuida') {
    if (!emenda.distribuida_em) patch.distribuida_em = agora;
    // a data de inserção é a terceira coluna do Anexo 3: é o dia em que a emenda entrou no manual
    if (!emenda.data_insercao) patch.data_insercao = hojeIso();
    if (!textoOuNulo(emenda.inserido_por)) patch.inserido_por = (actor?.full_name || actor?.email || '').toUpperCase() || null;
  }
  const { error } = await supabase.from('documento_emenda').update(patch).eq('id', emenda.id);
  if (error) throw erroEmenda(error, 'mudar o estado da emenda');
}

// A confirmação do detentor (Apêndice 1, §1.5): é por EMENDA, não por documento, e tem de caber nos 30 dias.
export async function confirmarEmendaInserida(emendaId, user) {
  const email = String(user?.email || '').trim().toLowerCase();
  if (!emendaId || !email) throw new Error('Precisa de estar autenticado para confirmar.');
  const { error } = await supabase.from('documento_emenda_confirmacao').insert({
    emenda_id: emendaId, email, nome: user?.full_name || null, confirmado_em: new Date().toISOString(), endereco_ip: 'client',
  });
  if (error && !/duplicate|unique/i.test(String(error.message || ''))) throw erroEmenda(error, 'registar a confirmação');
}

// Modo habitual de emendar deste documento: é sugestão para as próximas emendas, não obrigação (decisão do dono).
export async function guardarModoEmendaPadrao(documentoId, modo) {
  const valor = modo === 'paginas' ? 'paginas' : 'documento';
  const { error } = await supabase.from('documento')
    .update({ modo_emenda_padrao: valor, updated_date: new Date().toISOString() }).eq('id', documentoId);
  if (error) throw erroEmenda(error, 'guardar o modo de emenda do documento');
}

// ── impressão digital dos ficheiros (SHA-256) ───────────────────────────────
// O servidor on-premise é servido por HTTP, onde `crypto.subtle` NÃO existe (é a mesma pedra em que tropeçou a
// validação de senhas — ver src/lib/hashPassword.js). Por isso há dois caminhos: o do navegador, quando está
// disponível, e um SHA-256 em JavaScript puro, incremental, para o resto. Os dois devolvem o mesmo hex minúsculo.
// Incremental de propósito: um manual de 50 MB é lido em pedaços de 4 MB, devolvendo o fio ao navegador entre
// pedaços, para o ecrã não congelar enquanto se calcula.
const K_SHA = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
const rotr32 = (x, n) => (x >>> n) | (x << (32 - n));

function criarSha256() {
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
  const w = new Uint32Array(64);
  const resto = new Uint8Array(64);
  let restoLen = 0;
  let bytesTotais = 0;

  const bloco = (b, off) => {
    for (let t = 0; t < 16; t += 1) {
      const i = off + t * 4;
      w[t] = ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
    }
    for (let t = 16; t < 64; t += 1) {
      const s0 = rotr32(w[t - 15], 7) ^ rotr32(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = rotr32(w[t - 2], 17) ^ rotr32(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }
    let a = h0, b1 = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let t = 0; t < 64; t += 1) {
      const S1 = rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K_SHA[t] + w[t]) >>> 0;
      const S0 = rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22);
      const maj = (a & b1) ^ (a & c) ^ (b1 & c);
      const t2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b1; b1 = a; a = (t1 + t2) >>> 0;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b1) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  };

  return {
    actualizar(bytes) {
      bytesTotais += bytes.length;
      let i = 0;
      if (restoLen) {
        const falta = 64 - restoLen;
        if (bytes.length < falta) { resto.set(bytes, restoLen); restoLen += bytes.length; return; }
        resto.set(bytes.subarray(0, falta), restoLen);
        bloco(resto, 0);
        restoLen = 0;
        i = falta;
      }
      for (; i + 64 <= bytes.length; i += 64) bloco(bytes, i);
      if (i < bytes.length) { resto.set(bytes.subarray(i), 0); restoLen = bytes.length - i; }
    },
    final() {
      const bits = bytesTotais * 8;
      const enchimento = (56 - ((restoLen + 1) % 64) + 64) % 64;
      const cauda = new Uint8Array(restoLen + 1 + enchimento + 8);
      cauda.set(resto.subarray(0, restoLen));
      cauda[restoLen] = 0x80;
      const dv = new DataView(cauda.buffer);
      dv.setUint32(cauda.length - 8, Math.floor(bits / 0x100000000) >>> 0, false);
      dv.setUint32(cauda.length - 4, bits >>> 0, false);
      for (let i = 0; i + 64 <= cauda.length; i += 64) bloco(cauda, i);
      const hex = (x) => `0000000${(x >>> 0).toString(16)}`.slice(-8);
      return hex(h0) + hex(h1) + hex(h2) + hex(h3) + hex(h4) + hex(h5) + hex(h6) + hex(h7);
    },
  };
}

const PEDACO_BYTES = 4 * 1024 * 1024;

// Impressão digital de um ficheiro (File ou Blob). Devolve hex minúsculo, ou null se não houver ficheiro.
// Nunca atira: um erro a ler o ficheiro não pode travar um carregamento que de resto corre bem.
export async function impressaoDigital(ficheiro) {
  if (!ficheiro || typeof ficheiro.slice !== 'function') return null;
  try {
    const subtle = (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) || null;
    if (subtle) {
      try {
        const buf = await ficheiro.arrayBuffer();
        const h = await subtle.digest('SHA-256', buf);
        return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('');
      } catch { /* HTTP sem crypto.subtle, ou ficheiro grande: cai para o JS puro */ }
    }
    const estado = criarSha256();
    const total = ficheiro.size || 0;
    for (let i = 0; i < total; i += PEDACO_BYTES) {
      const parte = new Uint8Array(await ficheiro.slice(i, Math.min(i + PEDACO_BYTES, total)).arrayBuffer());
      estado.actualizar(parte);
      await new Promise(r => setTimeout(r, 0));   // devolve o fio ao navegador entre pedaços
    }
    return estado.final();
  } catch {
    return null;
  }
}

// Já existe algum documento com este ficheiro? Devolve os que colidem (no máximo 5), para se avisar quem carrega.
// NÃO serve para rejeitar: o carregamento segue, o par fica marcado e alguém decide (desenho do Paperless).
export async function documentosComMesmoFicheiro(sha256, { excepto } = {}) {
  const h = String(sha256 || '').trim().toLowerCase();
  if (h.length !== 64) return [];
  try {
    let q = supabase.from('documento').select('id,titulo,numero,estado,pasta_id,aeroporto_id,created_date,created_by')
      .eq('sha256', h).is('deleted_at', null).limit(5);
    if (excepto) q = q.neq('id', excepto);
    const { data, error } = await q;
    if (error) return [];
    return naLista(data);
  } catch { return []; }
}

// Grava a impressão digital no documento (e na revisão, quando se sabe qual é).
export async function gravarImpressaoDigital(documentoId, sha256, { versao, tamanho } = {}) {
  const h = String(sha256 || '').trim().toLowerCase();
  if (!documentoId || h.length !== 64) return;
  const { error } = await supabase.from('documento')
    .update({ sha256: h, sha256_em: new Date().toISOString() }).eq('id', documentoId);
  if (error) throw error;
  if (versao != null) {
    await supabase.from('documento_versao')
      .update({ sha256: h, ...(tamanho ? { tamanho } : {}) })
      .eq('documento_id', documentoId).eq('versao', versao);
  }
}

// ── documentos repetidos ────────────────────────────────────────────────────
// Pares com o ficheiro byte a byte igual (vista `documento_duplicado`, migração 152). O servidor só devolve os
// pares de documentos que a pessoa pode ver.
export function useDuplicadosDocs() {
  return useQuery({
    queryKey: ['gd', 'duplicados'],
    staleTime: MIN,
    queryFn: async () => {
      const { data, error } = await supabase.from('documento_duplicado').select('*').order('entrou_em', { ascending: false }).limit(500);
      if (error) throw error;
      return naLista(data);
    },
  });
}
// Documentos com ficheiro mas ainda sem impressão digital (os 217 que já estavam no portal antes da 152).
export function useSemImpressaoDigital({ limite = 500 } = {}) {
  return useQuery({
    queryKey: ['gd', 'sem-impressao', limite],
    staleTime: MIN,
    queryFn: async () => {
      const { data, error } = await supabase.from('documento')
        .select('id,titulo,numero,versao_atual,arquivo_privado_uri,arquivo_url')
        .is('deleted_at', null).is('voo_ligado_id', null).is('sha256', null)
        .not('arquivo_privado_uri', 'is', null)
        .order('updated_date', { ascending: false }).limit(limite);
      if (error) throw error;
      return naLista(data);
    },
  });
}
// «São dois exemplares legítimos»: o par sai da lista de trabalho e fica dito quem o disse e quando.
export async function decidirDuplicado({ sha256, documentoId, parId, nota }, actor) {
  const { error } = await supabase.from('documento_duplicado_decisao').insert({
    sha256: String(sha256 || '').toLowerCase(),
    documento_id: documentoId, par_id: parId,
    decisao: 'ambos_legitimos', nota: nota?.trim() || null, por_email: actor?.email || null,
  });
  if (error) throw new Error(error.message || 'Não foi possível guardar a decisão.');
}
export async function reabrirDuplicado(decisaoId) {
  const { error } = await supabase.from('documento_duplicado_decisao').delete().eq('id', decisaoId);
  if (error) throw new Error(error.message || 'Não foi possível reabrir o par.');
}

// ── entrada em vigor agendada (migração 152) ─────────────────────────────────
// O agendamento vive na revisão: `documento_versao.vigor_desde` com a revisão em «aprovado». Até à data é a
// revisão anterior que está em vigor; na data, o agendador (de 15 em 15 min) chama a função que faz a passagem.
export function useAgendamentosVigor() {
  return useQuery({
    queryKey: ['gd', 'agendamentos-vigor'],
    staleTime: MIN,
    queryFn: async () => {
      const { data, error } = await supabase.from('documento_versao')
        .select('id,documento_id,versao,rotulo,estado,vigor_desde,vigor_ate,agendada_por,agendada_em,agendamento_nota,arquivo_uri,arquivo_nome')
        .not('vigor_desde', 'is', null).eq('estado', 'aprovado')
        .order('vigor_desde', { ascending: true }).limit(500);
      if (error) throw error;
      return naLista(data);
    },
  });
}
// Marca (ou muda) a data de entrada em vigor de uma revisão. A revisão passa a «aprovado» e espera a data.
export async function agendarVigorVersao({ versaoId, data, nota }, actor) {
  if (!versaoId || !data) throw new Error('Indique a revisão e a data de entrada em vigor.');
  const { error } = await supabase.from('documento_versao').update({
    vigor_desde: data, estado: 'aprovado', vigor_ate: null,
    agendada_por: actor?.email || null, agendada_em: new Date().toISOString(),
    agendamento_nota: nota?.trim() || null,
  }).eq('id', versaoId);
  if (error) throw new Error(error.message || 'Não foi possível marcar a data.');
}
export async function cancelarAgendamentoVigor(versaoId) {
  const { error } = await supabase.from('documento_versao')
    .update({ vigor_desde: null, agendamento_nota: null }).eq('id', versaoId);
  if (error) throw new Error(error.message || 'Não foi possível retirar a data.');
}
// Linha do tempo de um documento: que revisão esteve em vigor de que dia a que dia (vista `documento_vigencia`).
export function useVigenciaDocumento(documentoId) {
  return useQuery({
    queryKey: ['gd', 'vigencia', documentoId],
    enabled: !!documentoId,
    queryFn: async () => {
      const { data, error } = await supabase.from('documento_vigencia')
        .select('*').eq('documento_id', documentoId).order('vigor_de', { ascending: false });
      if (error) throw error;
      return naLista(data);
    },
  });
}

// ── retenção e eliminação autorizada (migração 153) ─────────────────────────
export function usePoliticasRetencao() {
  return useQuery({
    queryKey: ['gd', 'retencao-politicas'],
    staleTime: 5 * MIN,
    queryFn: async () => {
      const { data, error } = await supabase.from('documento_retencao_politica')
        .select('*').order('prioridade', { ascending: false }).order('nome');
      if (error) throw error;
      return naLista(data);
    },
  });
}
export async function guardarPoliticaRetencao(p, actor) {
  const linha = {
    nome: String(p.nome || '').trim(),
    tipo_id: p.tipo_id || null,
    aplica_tags: Array.isArray(p.aplica_tags) ? p.aplica_tags.filter(Boolean) : [],
    prazo_meses: Math.min(1200, Math.max(1, Number(p.prazo_meses) || 12)),
    contar_de: p.contar_de || 'em_vigor_desde',
    acao_no_fim: p.acao_no_fim || 'rever',
    fundamento_legal: p.fundamento_legal?.trim() || null,
    minimo_legal: !!p.minimo_legal,
    prioridade: Number.isFinite(Number(p.prioridade)) ? Number(p.prioridade) : 0,
    ativo: p.ativo !== false,
    nota: p.nota?.trim() || null,
    updated_by: actor?.email || null,
    updated_date: new Date().toISOString(),
  };
  if (!linha.nome) throw new Error('Dê um nome à política (é por ele que se distingue das outras).');
  const q = p.id
    ? supabase.from('documento_retencao_politica').update(linha).eq('id', p.id)
    : supabase.from('documento_retencao_politica').insert({ ...linha, criado_por: actor?.email || null });
  const { error } = await q;
  if (error) {
    const msg = String(error.message || '');
    if (/duplicate|unique/i.test(msg)) throw new Error('Já existe uma política com esse nome.');
    if (error.code === '42501' || /policy|permission|denied|row-level/i.test(msg)) {
      throw new Error('Só um administrador do portal pode alterar as políticas de retenção.');
    }
    throw new Error(msg || 'Não foi possível guardar a política.');
  }
}
export async function apagarPoliticaRetencao(id) {
  const { error } = await supabase.from('documento_retencao_politica').delete().eq('id', id);
  if (error) throw new Error(error.message || 'Não foi possível apagar a política.');
}

// Documento a documento: política aplicável, data base e quando termina o prazo (vista `documento_retencao`).
export function useRetencaoDocs({ limite = 1000 } = {}) {
  return useQuery({
    queryKey: ['gd', 'retencao', limite],
    staleTime: MIN,
    queryFn: async () => {
      const { data, error } = await supabase.from('documento_retencao')
        .select('*').order('prazo_termina_em', { ascending: true, nullsFirst: false }).limit(limite);
      if (error) throw error;
      return naLista(data);
    },
  });
}
// O registo de eliminações: o que se propôs, quem autorizou, quando e com que fundamento.
export function useEliminacoesDocs({ limite = 500 } = {}) {
  return useQuery({
    queryKey: ['gd', 'eliminacoes', limite],
    staleTime: 30 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from('documento_eliminacao')
        .select('*').order('proposto_em', { ascending: false }).limit(limite);
      if (error) throw error;
      return naLista(data);
    },
  });
}
// As transições passam todas pelo servidor: é ele que assina quem autorizou, a partir da sessão — nunca o
// formulário. Daí serem chamadas de função e não escritas directas na tabela.
const erroEliminacao = (error, acao) => {
  const msg = String(error?.message || error?.hint || '');
  if (/permission|denied|42501/i.test(msg)) return new Error(`Não foi possível ${acao}: não tem permissão para esta decisão.`);
  return new Error(msg || `Não foi possível ${acao}.`);
};
export async function proporEliminacao(documentoId, motivo) {
  const { data, error } = await supabase.rpc('documento_eliminacao_propor', { p_documento: documentoId, p_motivo: motivo });
  if (error) throw erroEliminacao(error, 'propor a eliminação');
  return data;
}
export async function autorizarEliminacao(id, fundamento) {
  const { data, error } = await supabase.rpc('documento_eliminacao_autorizar', { p_id: id, p_fundamento: fundamento });
  if (error) throw erroEliminacao(error, 'autorizar a eliminação');
  return data;
}
export async function recusarEliminacao(id, fundamento) {
  const { data, error } = await supabase.rpc('documento_eliminacao_recusar', { p_id: id, p_fundamento: fundamento || null });
  if (error) throw erroEliminacao(error, 'recusar a proposta');
  return data;
}
export async function executarEliminacao(id) {
  const { data, error } = await supabase.rpc('documento_eliminacao_executar', { p_id: id });
  if (error) throw erroEliminacao(error, 'executar a eliminação');
  return data;
}

// ── pesquisa DENTRO do conteúdo dos ficheiros (migração 151) ────────────────
// Até aqui a pesquisa só via título, número, descrição e etiquetas. Isto procura no texto extraído dos ficheiros,
// que está indexado UMA LINHA POR PÁGINA — não por documento — porque o `tsvector` do PostgreSQL não passa de
// 1 MB nem de 16.383 posições, e um manual digitalizado de 200 páginas rebentaria ou truncaria em silêncio.
// Por ser por página, a resposta traz de borla a página onde o termo aparece.
//
// O servidor devolve só documentos que a pessoa pode ver (a função é SECURITY INVOKER e passa pelas mesmas
// políticas do documento): quem não pode abrir o manual também não pode encontrar o texto dele.
//
// O excerto vem com o termo entre ⟦ e ⟧ — sentinelas, não HTML. A documentação do PostgreSQL avisa que o
// resultado do `ts_headline` não é seguro para HTML; o ecrã parte nestes caracteres e desenha <mark> como
// elemento, pelo que nunca há HTML de origem desconhecida a entrar na página.
export const MARCA_INICIO = '⟦';
export const MARCA_FIM = '⟧';

export function usePesquisaConteudoDocs(termo, { limite = 60, paginasPorDoc = 3 } = {}) {
  const t = String(termo || '').trim();
  return useQuery({
    queryKey: ['gd', 'pesquisa-conteudo', t, limite, paginasPorDoc],
    enabled: t.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('documentos_pesquisa_conteudo', {
        p_termo: t, p_limite: limite, p_paginas_por_doc: paginasPorDoc,
      });
      // Antes de a migração 151 estar aplicada a função não existe: a pesquisa por metadados continua a servir,
      // e a tira de âmbito (useCoberturaConteudoDocs) diz que o conteúdo ainda não está indexado.
      if (error) return [];
      const achados = naLista(data).filter(r => r?.documento_id);
      if (!achados.length) return [];
      // segunda ida ao servidor para trazer as colunas que a lista mostra; a RPC devolve só o identificador e os
      // excertos, para não duplicar o modelo do documento em dois sítios
      const { data: docs, error: e2 } = await supabase.from('documento').select(COLS_DOC)
        .in('id', achados.map(r => r.documento_id)).is('deleted_at', null).is('voo_ligado_id', null);
      if (e2) throw e2;
      const porId = new Map(naLista(docs).map(d => [d.id, d]));
      return achados.map(r => {
        const d = porId.get(r.documento_id);
        if (!d) return null;
        return {
          ...d,
          conteudo: {
            relevancia: Number(r.relevancia) || 0,
            paginas: Number(r.paginas_com_termo) || 0,
            pagina: r.pagina ?? null,
            paginaFonte: r.pagina_fonte ?? null,
            rotulo: r.rotulo || '',
            excerto: r.excerto || '',
            excertos: Array.isArray(r.excertos) ? r.excertos : [],
          },
        };
      }).filter(Boolean);
    },
  });
}

// Quanto do acervo já tem o conteúdo indexado. Serve a frase de âmbito por cima dos resultados: sem ela, alguém
// conclui que «não existe» aquilo que apenas ainda não foi indexado — e numa auditoria isso é uma afirmação falsa.
export function useCoberturaConteudoDocs() {
  return useQuery({
    queryKey: ['gd', 'cobertura-conteudo'],
    staleTime: 10 * MIN,
    queryFn: async () => {
      const conta = async (fn) => { try { const { count } = await fn(); return count || 0; } catch { return 0; } };
      const [total, indexados, semTexto] = await Promise.all([
        conta(() => supabase.from('documento').select('id', { count: 'exact', head: true })
          .is('deleted_at', null).is('voo_ligado_id', null)),
        conta(() => supabase.from('documento_conteudo_indice').select('documento_id', { count: 'exact', head: true })
          .eq('estado', 'indexado')),
        conta(() => supabase.from('documento_conteudo_indice').select('documento_id', { count: 'exact', head: true })
          .eq('precisa_ocr', true)),
      ]);
      return { total, indexados, semTexto, disponivel: indexados > 0 };
    },
  });
}
