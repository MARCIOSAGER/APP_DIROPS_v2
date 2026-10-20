// Fluxo de aprovação de documentos (migração 156) — camada de dados.
//
// O percurso é: o elaborador carrega o PDF **e** o ficheiro editável → o revisor assina → o director assina → a
// revisão fica aprovada. Cada acto é uma assinatura avançada: nome, data/hora, SIGNIFICADO do acto, impressão
// digital do ficheiro assinado, HMAC sobre o texto canónico e um elo para a assinatura anterior do documento.
//
// A regra que manda em todo este ficheiro: **o botão nunca é a autorização**. As funções que movem o fluxo
// (`documento_fluxo_assinar`, `_devolver`, `_cancelar`) NÃO estão concedidas a `authenticated` — vivem atrás da
// rota `/functions/documentos-aprovacao`, que deriva o email do token e verifica a senha dentro da base de dados.
// Daqui só se pode:
//   • LER (o PostgREST aplica as políticas da 156: cada um vê o que lhe compete);
//   • ABRIR um fluxo (`documento_fluxo_abrir`, a única função concedida — abrir não é acto de autoridade);
//   • PREPARAR o fluxo enquanto está com o elaborador (revisor, director, resumo — lista fechada de colunas);
//   • CARREGAR ficheiros (`documento_ficheiro`, INSERT com as políticas próprias de cada papel).
// Tudo o que é acto assinado passa por `docsFluxo()`, e a senha vai **no corpo** do pedido, nunca no endereço.
//
// Molde: src/documentos/api.js (chamada às functions) e src/documentos/apiCodificacao.js (leituras/escritas).
import { supabase } from '@/lib/supabaseClient';
import { sanitizeFilename, validateFileType } from '@/lib/sanitize';
import { impressaoDigital } from './hooks';
import { PORTAL_BASE } from '@/lib/portalDocumentos';

const BASE = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const naLista = (v) => (Array.isArray(v) ? v : []);
const texto = (v) => (String(v ?? '').trim() ? String(v).trim() : null);
const minuscula = (v) => (String(v ?? '').trim() ? String(v).trim().toLowerCase() : null);

// ── endereços ───────────────────────────────────────────────────────────────
// `/documentos/aprovacao/:fluxo_id` é o endereço onde o botão do email aterra (contrato §8). Não se muda sem
// mudar também os emails que já foram enviados — e esses não se reescrevem.
export const FLUXO_BASE = `${PORTAL_BASE}/aprovacao`;
export const enderecoFluxo = (fluxoId) => `${FLUXO_BASE}/${fluxoId}`;
export const enderecoPercurso = (documentoId) => `${PORTAL_BASE}/documento/${documentoId}/assinaturas`;
export const enderecoVerificacao = (codigo) => `${PORTAL_BASE}/assinatura/${encodeURIComponent(codigo)}`;

// ── vocabulário do fluxo ────────────────────────────────────────────────────
// Seis estados, e cada um responde a «de quem está à espera?». Os rótulos ficam aqui e não espalhados pelos
// ecrãs: a frase que a pessoa lê na lista tem de ser a mesma que lê no detalhe e no email.
export const ESTADOS_FLUXO = [
  { chave: 'rascunho', label: 'Rascunho', de: 'elaborador' },
  { chave: 'aguarda_revisao', label: 'Aguarda revisão', de: 'revisor' },
  { chave: 'aguarda_aprovacao', label: 'Aguarda aprovação', de: 'director' },
  { chave: 'devolvido', label: 'Devolvido', de: 'elaborador' },
  { chave: 'aprovado', label: 'Aprovado', de: null },
  { chave: 'cancelado', label: 'Cancelado', de: null },
];
export const ESTADO_FLUXO_LABEL = Object.fromEntries(ESTADOS_FLUXO.map(e => [e.chave, e.label]));
export const ESTADOS_VIVOS = ['rascunho', 'aguarda_revisao', 'aguarda_aprovacao', 'devolvido'];
export const ehFluxoVivo = (estado) => ESTADOS_VIVOS.includes(String(estado || ''));

// Que acto é que se pratica a partir de cada estado. É a tradução da tabela de transições da base de dados; a
// base volta a verificá-la, por isso isto é só para o ecrã saber que botão mostrar.
export const ACTO_DO_ESTADO = {
  rascunho: 'elaboracao',
  devolvido: 'elaboracao',          // afinado em `actoPendente` quando a devolução foi para o revisor
  aguarda_revisao: 'revisao',
  aguarda_aprovacao: 'aprovacao',
};
export function actoPendente(fluxo) {
  if (!fluxo) return null;
  if (fluxo.estado === 'devolvido') return fluxo.devolvido_para === 'revisor' ? 'revisao' : 'elaboracao';
  return ACTO_DO_ESTADO[fluxo.estado] || null;
}

export const PAPEL_LABEL = {
  elaborador: 'Elaborador',
  revisor: 'Revisor',
  director_aeroporto: 'Director do aeroporto',
};
export const papelRotulo = (p) => PAPEL_LABEL[p] || p || '';

// Rótulos de recurso quando `documento_acto` ainda não chegou (primeira pintura, ou rede em falta). O texto
// verdadeiro vem sempre da base de dados: é dado, não literal do código.
export const ACTO_PADRAO = {
  elaboracao: { rotulo: 'Elaborar e submeter', papel: 'elaborador', ordem: 1 },
  revisao: { rotulo: 'Revisto', papel: 'revisor', ordem: 2 },
  aprovacao: { rotulo: 'Aprovar', papel: 'director_aeroporto', ordem: 3 },
};

// ── erros em português, com caminho de recuperação ──────────────────────────
// Três famílias que merecem tradução: a migração não aplicada (acontece a quem experimenta antes do dono aplicar
// o SQL), a recusa por permissão, e os índices únicos que protegem «um fluxo vivo por revisão». Tudo o mais que
// venha da base vem já numa frase escrita para humanos (as funções da 156 usam RAISE EXCEPTION em português) —
// nesse caso passa-se tal e qual, porque reescrevê-la só a tornaria mais vaga.
const SEM_MIGRACAO = 'O fluxo de aprovação ainda não está instalado no servidor (migração 156). Avise a gestão do portal.';

export function erroFluxo(error, acao = 'concluir a operação') {
  if (!error) return new Error(`Não foi possível ${acao}.`);
  const msg = String(error.message || error.error || '');
  const cod = String(error.code || '');
  if (/does not exist|could not find|42P01|42883|42703|PGRST202|PGRST204/i.test(cod + ' ' + msg)) return new Error(SEM_MIGRACAO);
  if (cod === '23505' || /duplicate key|unique/i.test(msg)) {
    if (/versao_viva/i.test(msg)) return new Error('Esta revisão já tem um fluxo de aprovação a decorrer. Abra o fluxo que existe em vez de criar outro.');
    if (/emenda_viva/i.test(msg)) return new Error('Esta emenda já tem um fluxo de aprovação a decorrer.');
    if (/papel_unico|doc_ficheiro_papel/i.test(msg)) return new Error('Já carregou esse ficheiro nesta volta. Substitua-o em vez de o carregar outra vez.');
    if (/acto_unico/i.test(msg)) return new Error('Este acto já foi assinado nesta volta. Recarregue o ecrã para ver o estado actual.');
    return new Error(`Não foi possível ${acao}: já existe um registo igual.`);
  }
  if (cod === '23514' || cod === '23503' || cod === 'P0001' || cod === 'P0002') {
    // mensagem das funções da 156: já está escrita em português e diz o que fazer
    return new Error(msg || `Não foi possível ${acao}.`);
  }
  if (cod === '42501' || /row-level security|permission denied|insufficient_privilege/i.test(msg)) {
    if (/row-level security|permission denied for/i.test(msg)) {
      return new Error(`Não foi possível ${acao}: não tem permissão para esta operação neste documento.`);
    }
    return new Error(msg || `Não foi possível ${acao}: sem permissão.`);
  }
  return new Error(msg || `Não foi possível ${acao}.`);
}

// ── a rota dos actos assinados ──────────────────────────────────────────────
// A senha vai no CORPO, nunca na query string, e nunca é registada em nenhum log do cliente. As mensagens de erro
// vêm da rota já escritas (contrato §6) — mostram-se tal e qual; o `status` segue no erro para o ecrã saber quando
// deve mandar recarregar (409) ou dizer que a conta está travada (429).
async function docsFluxo(action, body = {}) {
  let token = ANON;
  try { const { data } = await supabase.auth.getSession(); if (data?.session?.access_token) token = data.session.access_token; } catch { /* sem sessão */ }
  let r;
  try {
    r = await fetch(`${BASE}/functions/v1/documentos-aprovacao`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, apikey: ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...body }),
    });
  } catch {
    throw new Error('Sem ligação ao servidor. Verifique a rede e tente novamente — nada foi assinado.');
  }
  let json = null;
  try { json = await r.json(); } catch { /* sem corpo */ }
  if (!r.ok) {
    const err = new Error(json?.error || (r.status === 404
      ? 'O serviço de aprovações ainda não está activo no servidor (é preciso reiniciar o serviço dirops-functions-v2).'
      : `Falha no pedido (${r.status}).`));
    err.status = r.status;
    err.estado = json?.estado || null;
    throw err;
  }
  return json || {};
}
export { docsFluxo };

// ════════════════════════════════════════════════════════════════════════════
// LEITURAS
// ════════════════════════════════════════════════════════════════════════════

// Os três actos, com o rótulo do botão e o SIGNIFICADO que vai assinado. Vem da base de dados de propósito: a
// frase do significado tem de ser a mesma no ecrã, no carimbo do PDF e no email, e tem de poder ser corrigida
// sem reescrever a aplicação.
export async function lerActos() {
  const { data, error } = await supabase.from('documento_acto').select('*').eq('activo', true).order('ordem');
  if (error) throw erroFluxo(error, 'carregar os actos do fluxo');
  return naLista(data);
}

// A vista de trabalho: fluxos a decorrer, de quem se espera e há quanto tempo. É a mesma vista que alimenta o
// painel do gestor e os lembretes do agendador — uma só verdade sobre «o que está travado».
export async function lerPendentes({ limite = 500 } = {}) {
  const { data, error } = await supabase.from('documento_aprovacao_pendente').select('*').limit(limite);
  if (error) throw erroFluxo(error, 'carregar as aprovações pendentes');
  // `desde` ascendente: quem está à espera há mais tempo aparece primeiro. Ordena-se aqui porque a vista é
  // pequena e porque o PostgREST não ordena por expressões (parado_ha é um intervalo calculado).
  return naLista(data).sort((a, b) => new Date(a.desde || 0) - new Date(b.desde || 0));
}

const COLS_FLUXO = 'id,documento_id,versao_id,emenda_id,estado,ronda,devolvido_para,elaborador_email,revisor_email,director_email,aeroporto_id,resumo,nota,editavel_ausente,editavel_ausente_motivo,submetido_em,revisto_em,aprovado_em,encerrado_em,created_date,updated_date';

export async function lerFluxo(id) {
  if (!id) return null;
  const { data, error } = await supabase.from('documento_aprovacao').select(COLS_FLUXO).eq('id', id).maybeSingle();
  if (error) throw erroFluxo(error, 'carregar o fluxo');
  return data || null;
}

// Todos os fluxos de um documento, do mais recente para o mais antigo (o percurso, incluindo os cancelados).
export async function lerFluxosDocumento(documentoId) {
  if (!documentoId) return [];
  const { data, error } = await supabase.from('documento_aprovacao').select(COLS_FLUXO)
    .eq('documento_id', documentoId).order('created_date', { ascending: false });
  if (error) throw erroFluxo(error, 'carregar os fluxos do documento');
  return naLista(data);
}

// O rasto: um passo por acontecimento, pela ordem do tempo. Inclui as devoluções COM MOTIVO e os avisos enviados.
export async function lerPassos(fluxoId) {
  if (!fluxoId) return [];
  const { data, error } = await supabase.from('documento_aprovacao_passo')
    .select('id,fluxo_id,ronda,acao,de_estado,para_estado,por_email,por_nome,motivo,assinatura_id,detalhes,em')
    .eq('fluxo_id', fluxoId).order('em', { ascending: true });
  if (error) throw erroFluxo(error, 'carregar o percurso do fluxo');
  return naLista(data);
}

// Os avisos já enviados nesta ronda. Serve a uma pergunta concreta de auditoria: «avisaram-no, e quando?».
export async function lerAvisos(fluxoId) {
  if (!fluxoId) return [];
  const { data, error } = await supabase.from('documento_aprovacao_aviso')
    .select('id,ronda,tipo,para_email,assunto,anexou_pdf,enviado,erro,em')
    .eq('fluxo_id', fluxoId).order('em', { ascending: false });
  if (error) return [];      // os avisos são informação acessória: a falta deles não estraga o ecrã
  return naLista(data);
}

// Os ficheiros de uma revisão. As políticas da 156 decidem o que volta: as linhas `pdf` por `pode_ver_documento()`
// e as `editavel` por `pode_ver_editavel()`. Quem não tem direito ao editável simplesmente não recebe a linha —
// não há nada a explicar a quem não tem de saber que ela existe.
export async function lerFicheiros({ versaoId, documentoId } = {}) {
  if (!versaoId && !documentoId) return [];
  let q = supabase.from('documento_ficheiro')
    .select('id,documento_id,versao_id,papel,ronda,bucket,caminho,nome,mime,tamanho,sha256,carregado_por,created_date');
  if (versaoId) q = q.eq('versao_id', versaoId);
  else q = q.eq('documento_id', documentoId);
  const { data, error } = await q.order('ronda', { ascending: false }).order('created_date', { ascending: false });
  if (error) throw erroFluxo(error, 'carregar os ficheiros da revisão');
  return naLista(data);
}

// Tenho direito ao ficheiro editável deste documento? Pergunta-se à base porque a ausência da linha é ambígua:
// pode ser que não exista editável, pode ser que exista e eu não o possa ver. Sem esta resposta o ecrã não sabe
// distinguir «não há» de «não é para si» — e essas duas coisas mostram-se de maneiras diferentes.
export async function podeVerEditavel(documentoId) {
  if (!documentoId) return false;
  const { data, error } = await supabase.rpc('pode_ver_editavel', { p_doc: documentoId });
  if (error) return false;
  return data === true;
}

// As assinaturas de um documento, prontas a mostrar: acto, nome (e substituição), data/hora, código, e se o
// ficheiro de hoje continua a ser o que foi assinado.
export async function lerAssinaturas({ documentoId, fluxoId } = {}) {
  if (!documentoId && !fluxoId) return [];
  let q = supabase.from('documento_assinaturas_vista').select('*');
  if (fluxoId) q = q.eq('fluxo_id', fluxoId);
  else q = q.eq('documento_id', documentoId);
  const { data, error } = await q;
  if (error) throw erroFluxo(error, 'carregar as assinaturas');
  return naLista(data).sort((a, b) => new Date(a.assinado_em || 0) - new Date(b.assinado_em || 0));
}

// A cadeia, percorrida pela ordem do tempo. `ligacao_confere = false` significa que FALTA uma assinatura ou que
// foi intercalada uma — é assim que se detecta uma data retroactivada ou um registo limpo à mão.
export async function lerCadeia(documentoId) {
  if (!documentoId) return [];
  const { data, error } = await supabase.rpc('documento_assinatura_cadeia', { p_documento: documentoId });
  if (error) throw erroFluxo(error, 'verificar a cadeia de assinaturas');
  return naLista(data);
}

// Três perguntas independentes sobre uma assinatura: o HMAC confere? o ficheiro de hoje é o que foi assinado? o
// elo está bem formado? Uma pode falhar sem as outras — e é justamente o caso misto que interessa apanhar.
export async function verificarAssinatura(assinaturaId) {
  if (!assinaturaId) return null;
  const { data, error } = await supabase.rpc('documento_assinatura_verificar', { p_assinatura: assinaturaId });
  if (error) throw erroFluxo(error, 'verificar a assinatura');
  return data || null;
}

export async function assinaturaPorCodigo(codigo) {
  const c = String(codigo || '').trim().toUpperCase();
  if (!c) return null;
  const { data, error } = await supabase.rpc('documento_assinatura_por_codigo', { p_codigo: c });
  if (error) throw erroFluxo(error, 'procurar a assinatura por código');
  return data || null;
}

// As linhas exactas do carimbo, produzidas pela base. Não se compõem no cliente: se cada sítio escrevesse o seu,
// a frase do significado acabava por divergir entre o PDF, o email e o ecrã — e é essa frase que a norma exige.
export async function lerCarimbo(assinaturaId) {
  if (!assinaturaId) return null;
  const { data, error } = await supabase.rpc('documento_assinatura_carimbo', { p_assinatura: assinaturaId });
  if (error) return null;
  return data || null;
}

// Quem andou a mexer no editável deste documento. Existe separado dos acessos ao documento porque o editável é
// o ficheiro que permite ALTERAR o conteúdo: é o mais sensível dos dois, e a lista das suas aberturas — e das
// recusas — é a que interessa a quem responde pela segurança do conteúdo. Só de inserção, como o resto da
// auditoria; as políticas da 156 dão a cada um os seus acessos e aos gestores os dos documentos que vêem.
export async function lerAcessosEditavel(documentoId, { limite = 200 } = {}) {
  if (!documentoId) return [];
  const { data, error } = await supabase.from('documento_ficheiro_acesso')
    .select('id,ficheiro_id,versao_id,papel,acao,email,nome,endereco_ip,equipamento,motivo,em')
    .eq('documento_id', documentoId).eq('papel', 'editavel')
    .order('em', { ascending: false }).limit(limite);
  if (error) return [];
  return naLista(data);
}

// Quem pode assinar como director deste aeroporto hoje: o titular e o suplente com nomeação viva.
export async function lerDirectoresAeroporto(aeroportoId) {
  if (!aeroportoId) return [];
  const { data, error } = await supabase.rpc('doc_directores_aeroporto', { p_aeroporto: aeroportoId });
  if (error) return [];
  return naLista(data);
}

// A autoridade sobre «mostro o botão?». A função de assinar volta a chamá-la do lado do servidor, por isso isto
// é conveniência do interface e nunca permissão: um `pode: false` esconde o botão, mas um `pode: true` não
// autoriza nada por si.
export async function quemPode(fluxoId, acto, email) {
  if (!fluxoId || !acto || !email) return { pode: false, motivo: null };
  const { data, error } = await supabase.rpc('documento_fluxo_quem_pode', {
    p_fluxo: fluxoId, p_acto: acto, p_email: minuscula(email),
  });
  if (error) return { pode: false, motivo: null, erro: erroFluxo(error, 'saber quem pode assinar').message };
  const linha = naLista(data)[0] || {};
  return { pode: linha.pode === true, papel: linha.papel || null, em_substituicao_de: linha.em_substituicao_de || null, suplencia_id: linha.suplencia_id || null, motivo: linha.motivo || null };
}

// As minhas portas de director: onde sou responsável de aeroporto e onde sou suplente com nomeação viva. Serve
// para a caixa de entrada reconhecer os fluxos que me compete assinar pela SEGUNDA porta — a que existe para o
// fluxo não morrer quando o director muda ou se ausenta.
export async function lerMinhasPortasDirector(email) {
  const e = minuscula(email);
  if (!e) return { aeroportos: [], suplencias: [] };
  const hoje = new Date().toISOString().slice(0, 10);
  const [resp, sup] = await Promise.all([
    supabase.from('documentos_aeroporto_responsavel').select('aeroporto_id,email').ilike('email', e),
    supabase.from('documentos_aeroporto_suplente').select('id,aeroporto_id,titular_email,email,nome,de,ate,motivo,nomeado_por')
      .is('revogado_em', null).lte('de', hoje).gte('ate', hoje).ilike('email', e),
  ]);
  return {
    aeroportos: naLista(resp.data).map(r => r.aeroporto_id).filter(Boolean),
    suplencias: naLista(sup.data),
  };
}

// ════════════════════════════════════════════════════════════════════════════
// ESCRITAS QUE NÃO SÃO ACTOS DE AUTORIDADE (vão directas ao PostgREST)
// ════════════════════════════════════════════════════════════════════════════

// Abrir o fluxo. Não produz assinatura e não move nada: é só dizer quem vai rever e quem vai aprovar. Com
// `directorEmail` vazio, a base preenche-o com o responsável do aeroporto do documento.
export async function abrirFluxo({ documentoId, versaoId, emendaId, revisorEmail, directorEmail, resumo }) {
  if (!documentoId) throw new Error('Escolha o documento.');
  if (!versaoId) throw new Error('Escolha a revisão que vai a aprovação: o fluxo pertence a uma revisão, não ao documento todo.');
  const rev = minuscula(revisorEmail);
  if (!rev) throw new Error('Indique quem vai rever. O revisor não se pode trocar depois de o fluxo seguir.');
  if (rev && minuscula(directorEmail) === rev) {
    throw new Error('O revisor e o director têm de ser pessoas diferentes: é a separação de funções que a assinatura não consegue provar sozinha.');
  }
  const { data, error } = await supabase.rpc('documento_fluxo_abrir', {
    p_documento: documentoId,
    p_versao: versaoId,
    p_emenda: emendaId || null,
    p_revisor: rev,
    p_director: minuscula(directorEmail),
    p_resumo: texto(resumo),
  });
  if (error) throw erroFluxo(error, 'abrir o fluxo de aprovação');
  return data;   // uuid do fluxo
}

// Preparar o fluxo: revisor, director, resumo e nota. A base só aceita estas colunas de `authenticated`, e só
// enquanto o fluxo está com o elaborador (rascunho ou devolvido) — trocar o revisor a meio é trocar o juiz
// depois de ver a sentença.
export async function guardarPreparacao(fluxoId, { revisorEmail, directorEmail, resumo, nota } = {}) {
  if (!fluxoId) throw new Error('Fluxo desconhecido.');
  const patch = { updated_date: new Date().toISOString() };
  if (revisorEmail !== undefined) patch.revisor_email = minuscula(revisorEmail);
  if (directorEmail !== undefined) patch.director_email = minuscula(directorEmail);
  if (resumo !== undefined) patch.resumo = texto(resumo);
  if (nota !== undefined) patch.nota = texto(nota);
  const { error } = await supabase.from('documento_aprovacao').update(patch).eq('id', fluxoId);
  if (error) throw erroFluxo(error, 'guardar a preparação do fluxo');
}

// ── carregar os dois ficheiros da revisão ───────────────────────────────────
// O editável vive SEMPRE sob `editaveis/<ano>/<documento_id>/`, no armazenamento privado: é prefixo reservado, e
// a base recusa um caminho com esse prefixo nas colunas que as rotas públicas de partilha lêem. O PDF vive fora
// dele, pela mesma razão ao contrário — o papel decide o sítio, e o sítio decide o papel.
const BUCKET = 'private-uploads';
export const PASTA_EDITAVEIS = 'editaveis';
export const LIMITE_MB = 50;                       // `client_max_body_size` da rota /storage no nginx
const LIMITE_BYTES = LIMITE_MB * 1024 * 1024;
export function caminhoFicheiroFluxo({ papel, documentoId, nome }) {
  const ano = new Date().getFullYear();
  const seguro = sanitizeFilename(nome || 'ficheiro');
  const selo = Date.now();
  return papel === 'editavel'
    ? `${PASTA_EDITAVEIS}/${ano}/${documentoId}/${selo}_${seguro}`
    : `fluxo/${ano}/${documentoId}/${selo}_${seguro}`;
}

const EXT_EDITAVEL = ['.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt', '.odt', '.ods', '.odp'];
const extensaoDe = (nome) => {
  const n = String(nome || '');
  const i = n.lastIndexOf('.');
  return i < 0 ? '' : n.slice(i).toLowerCase();
};

// Sobe um ficheiro e prende-o à revisão. Pela ordem: valida o tipo, calcula a impressão digital (JavaScript puro
// — o servidor é HTTP e não há `crypto.subtle`), envia para o armazenamento e só depois insere a linha. A ordem
// importa: se a inserção falhar, fica um ficheiro órfão no disco e não uma linha a apontar para o vazio.
// A RONDA não vem daqui: é estado do fluxo e a base lê-a do fluxo vivo (um pedido atrasado escreveria por cima
// do par da volta anterior).
export async function carregarFicheiroFluxo({ documentoId, versaoId, papel, ficheiro }) {
  if (!documentoId || !versaoId) throw new Error('Fluxo sem documento ou sem revisão.');
  if (!ficheiro) throw new Error('Escolha um ficheiro.');
  const p = papel === 'editavel' ? 'editavel' : 'pdf';
  const nome = sanitizeFilename(ficheiro.name);
  const ext = extensaoDe(nome);

  if (p === 'pdf' && ext !== '.pdf') {
    throw new Error('O que se aprova, se carimba e se distribui é o PDF. Converta o ficheiro para PDF antes de o carregar.');
  }
  if (p === 'editavel' && !EXT_EDITAVEL.includes(ext)) {
    throw new Error(`O ficheiro editável é a semente da revisão seguinte: aceita-se ${EXT_EDITAVEL.join(', ')}. Um PDF não serve para isso.`);
  }
  const v = await validateFileType(ficheiro);
  if (!v.valid) throw new Error(`${v.reason}. Verifique se o ficheiro não está corrompido.`);

  // O limite é do servidor (nginx aceita 50 MB nesta rota) e é melhor dizê-lo agora do que deixar a pessoa
  // esperar por um envio que o servidor vai cortar com um erro que não lhe diz nada.
  if ((ficheiro.size || 0) > LIMITE_BYTES) {
    throw new Error(`Este ficheiro tem ${Math.round(ficheiro.size / 1048576)} MB e o limite de envio é ${LIMITE_MB} MB. Um manual muito grande costuma ficar pequeno se as imagens forem reduzidas antes de gerar o PDF; se não for possível, fale com a gestão do portal.`);
  }

  const sha256 = await impressaoDigital(ficheiro);
  if (!sha256 || sha256.length !== 64) {
    throw new Error('Não foi possível calcular a impressão digital do ficheiro. Sem ela não há o que assinar — tente de novo.');
  }

  const caminho = caminhoFicheiroFluxo({ papel: p, documentoId, nome });
  const envio = await supabase.storage.from(BUCKET).upload(caminho, ficheiro, {
    contentType: ficheiro.type || (p === 'pdf' ? 'application/pdf' : 'application/octet-stream'),
    upsert: false,
  });
  if (envio.error) {
    throw new Error(`Não foi possível enviar o ficheiro para o armazenamento: ${envio.error.message || 'falha no envio'}.`);
  }

  const { data, error } = await supabase.from('documento_ficheiro').insert({
    documento_id: documentoId,
    versao_id: versaoId,
    papel: p,
    bucket: BUCKET,
    caminho,
    nome,
    mime: ficheiro.type || null,
    tamanho: ficheiro.size || null,
    sha256,
  }).select('id,papel,ronda,nome,tamanho,sha256,caminho,bucket,created_date').maybeSingle();
  if (error) throw erroFluxo(error, p === 'pdf' ? 'guardar o PDF da revisão' : 'guardar o ficheiro editável');
  return data;
}

// Substituir um ficheiro ainda não assinado desta volta. Passa pela rota do backend porque `authenticated` não
// tem DELETE em `documento_ficheiro` — e não tem de propósito: um ficheiro trocado por baixo de uma assinatura é
// precisamente o que o desenho da 156 existe para impedir. O servidor só deixa apagar o que ninguém assinou.
// Dois passos, e o segundo pode falhar depois do primeiro ter passado. Nesse caso o ficheiro antigo já saiu e o
// novo não entrou — a revisão fica sem esse papel. Não é perda de prova (o ficheiro retirado nunca foi assinado,
// senão o servidor teria recusado), mas é um estado que a pessoa tem de perceber, e por isso a mensagem di-lo em
// vez de se limitar a repetir o erro do envio.
export async function substituirFicheiroFluxo({ fluxoId, ficheiroId, documentoId, versaoId, papel, ficheiro }) {
  await docsFluxo('substituir_ficheiro', { fluxo_id: fluxoId, ficheiro_id: ficheiroId });
  try {
    return await carregarFicheiroFluxo({ documentoId, versaoId, papel, ficheiro });
  } catch (e) {
    const err = new Error(`${e?.message || 'Não foi possível enviar o ficheiro novo.'} O ficheiro anterior já foi retirado: esta revisão está sem ${papel === 'editavel' ? 'ficheiro editável' : 'PDF'} até voltar a carregar.`);
    err.cause = e;
    throw err;
  }
}

// ── abrir ou descarregar um ficheiro do fluxo ───────────────────────────────
// Sempre pela rota do backend, nunca por um endereço directo do armazenamento: é lá que se confirma
// `pode_ver_editavel()` e, sobretudo, é lá que CADA abertura, descarga **e recusa** fica registada em
// `documento_ficheiro_acesso`. O editável é o ficheiro que permite alterar o conteúdo — é o que mais precisa de
// deixar rasto.
export async function urlFicheiroFluxo(ficheiroId, { modo = 'abrir' } = {}) {
  const r = await docsFluxo('ficheiro', { ficheiro_id: ficheiroId, modo });
  const url = r?.url || '';
  if (!url) throw new Error('O servidor não devolveu o endereço do ficheiro.');
  return url;
}

export async function descarregarFicheiroFluxo(ficheiro) {
  const url = await urlFicheiroFluxo(ficheiro?.id, { modo: 'descarregar' });
  const a = document.createElement('a');
  a.href = url;
  a.download = ficheiro?.nome || '';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// ════════════════════════════════════════════════════════════════════════════
// OS ACTOS (rota do backend — a senha é verificada DENTRO da base de dados)
// ════════════════════════════════════════════════════════════════════════════

// Assinar. A pessoa já está autenticada e volta a escrever a senha da conta: é o que transforma um clique num
// acto de autoridade. A senha vai no corpo, não é guardada em estado nenhum depois da chamada, e cinco falhas em
// quinze minutos travam a conta (a base conta-as, não o ecrã).
export async function assinar({ fluxoId, acto, senha, nota, semEditavelMotivo }) {
  if (!fluxoId) throw new Error('Fluxo desconhecido.');
  if (!acto) throw new Error('Acto desconhecido.');
  if (!String(senha || '')) throw new Error('Escreva a senha da sua conta para assinar.');
  return docsFluxo('assinar', {
    fluxo_id: fluxoId,
    acto,
    senha: String(senha),
    nota: texto(nota),
    sem_editavel_motivo: texto(semEditavelMotivo),
  });
}

export const MOTIVO_MINIMO = 10;

// Devolver, com motivo. Não produz assinatura nem carimbo: devolver não é afirmar autoridade sobre o conteúdo, é
// mandá-lo para trás. O que a devolução tem de deixar é o motivo, escrito, no percurso — por isso é obrigatório
// aqui, no ecrã e na base.
export async function devolver({ fluxoId, motivo, para = 'elaborador' }) {
  const m = texto(motivo);
  if (!m || m.length < MOTIVO_MINIMO) {
    throw new Error(`Escreva o motivo da devolução (pelo menos ${MOTIVO_MINIMO} caracteres): é o que a outra pessoa precisa de ler para corrigir.`);
  }
  if (!['elaborador', 'revisor'].includes(para)) throw new Error('Devolve-se ao elaborador ou ao revisor.');
  return docsFluxo('devolver', { fluxo_id: fluxoId, motivo: m, para });
}

export async function cancelar({ fluxoId, motivo }) {
  const m = texto(motivo);
  if (!m || m.length < MOTIVO_MINIMO) {
    throw new Error(`Escreva porque está a cancelar (pelo menos ${MOTIVO_MINIMO} caracteres). As assinaturas já dadas mantêm-se: cancelar diz que o percurso não seguiu, não que o acto não aconteceu.`);
  }
  return docsFluxo('cancelar', { fluxo_id: fluxoId, motivo: m });
}

// ── utilitários de apresentação que dependem dos dados ──────────────────────
// «Parado há»: a vista devolve um intervalo do PostgreSQL, que chega como texto ('3 days 04:12:33') ou objecto.
// Em vez de o interpretar, conta-se a partir de `desde`, que é uma data e não deixa dúvidas.
export function diasParado(linha, agora = new Date()) {
  const desde = linha?.desde || linha?.updated_date || linha?.created_date;
  if (!desde) return null;
  const d = new Date(desde);
  if (Number.isNaN(d.getTime())) return null;
  return Math.max(0, Math.floor((agora - d) / 86400000));
}
export function textoParado(linha, agora = new Date()) {
  const dias = diasParado(linha, agora);
  if (dias === null) return '';
  if (dias === 0) return 'hoje';
  return `há ${dias} ${dias === 1 ? 'dia' : 'dias'}`;
}

// Tamanho de ficheiro em palavras curtas. Zero bytes mostra-se como «vazio» e não como «0 B»: é um sinal de
// avaria no carregamento, não uma medida.
export function tamanhoFicheiro(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return 'tamanho desconhecido';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} kB`;
  return `${(n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

// Impressão digital abreviada, para se poder comparar à vista sem encher a linha.
export const shaCurto = (sha) => {
  const s = String(sha || '');
  return s.length >= 16 ? `${s.slice(0, 8)}…${s.slice(-4)}` : s;
};
