// Regime AVSEC dos documentos (migração 158) — camada de dados.
//
// O Programa de Segurança do Aeroporto não se rege pelas regras dos manuais comuns. O Instrutivo 32.039.001.A
// (Despacho n.º 4442/25, Diário da República II Série n.º 108, de 12 de Junho de 2025) impõe-lhe três peças que
// este ficheiro serve, e que não existem em nenhum outro documento do portal:
//
//   • LISTA DE PÁGINAS EFECTIVAS — XIII, alínea k): «Ter no início do volume, uma "Lista de Páginas Efectivas"
//     para actualização, cancelamento ou inserção de páginas, com as respectivas revisões e datas de efectivação».
//     Uma edição por revisão do volume (`documento_lep`), com uma linha por página (`documento_lep_pagina`).
//   • CONFERÊNCIA SEMESTRAL — XIV, n.º 2, alínea i): «Estabelecer semestralmente conferência e actualização de
//     páginas com base na "Lista de Páginas Efectivas", a fim de garantir que nenhuma página dos programas seja
//     retirada, inserida, modificada ou tenham alguma alteração manuscrita». Os quatro achados são da lei.
//   • REGISTO DE CREDENCIADOS — XIV, n.º 2, alíneas d), e) e j): manter o registo de quem pode possuir cópia,
//     disponibilizar cópias apenas a esses, e garantir que o programa só é manuseado por credenciados.
//
// Três coisas atravessam todo este ficheiro:
//
//   1. OS ACTOS NÃO SÃO UPDATE. Emitir uma LPE, abrir um ciclo, confirmar, conferir, fechar e revogar são funções
//      do servidor (RPC), porque cada uma tem uma regra que o interface não pode garantir: só uma LPE emitida por
//      documento, só o detentor confirma a sua cópia, um achado sem páginas afectadas é recusado, uma revogação
//      sem motivo escrito é recusada. Aqui só se chamam e se traduz a recusa para português.
//   2. O REGISTO NÃO SE APAGA. `documento_conferencia_registo` é append-only (padrão da migração 149): só se lê.
//      Não há nesta camada nenhuma função que o altere — de propósito, e não por esquecimento.
//   3. A CREDENCIAL BLOQUEIA A ENTREGA NO SERVIDOR. Entregar cópia de documento classificado a quem não está
//      credenciado é recusado por gatilho, não por validação de formulário. A mensagem `CREDENCIAL_EM_FALTA` que
//      vem do servidor é traduzida abaixo em texto que diz o que fazer.
//
// Molde: src/documentos/api.js e src/documentos/apiCodificacao.js.
import { supabase } from '@/lib/supabaseClient';

const naLista = (v) => (Array.isArray(v) ? v : []);
const texto = (v) => (String(v ?? '').trim() ? String(v).trim() : null);
const soData = (v) => (v && String(v).trim() ? String(v).slice(0, 10) : null);
const email = (v) => String(v ?? '').trim().toLowerCase() || null;
const hojeIso = () => new Date().toISOString().slice(0, 10);

// ── traduzir as recusas do servidor ─────────────────────────────────────────
// A recusa mais importante é a da alínea e): não se entrega cópia a quem não está credenciado. Vem do gatilho com
// o prefixo `CREDENCIAL_EM_FALTA`, e o texto já explica o que fazer — mostra-se como está, sem o prefixo.
export function erroAvsec(error, acao) {
  const msg = String(error?.message || '');
  if (/CREDENCIAL_EM_FALTA/.test(msg)) {
    return new Error(msg.replace(/^.*?CREDENCIAL_EM_FALTA:\s*/s, ''));
  }
  if (error?.code === '42501' || /insufficient_privilege|policy|permission|denied|row-level/i.test(msg)) {
    return new Error(`Não foi possível ${acao}: não tem permissão. O regime AVSEC é do gestor documental e do responsável pela guarda e controlo do programa.`);
  }
  if (error?.code === '23505' || /duplicate|unique/i.test(msg)) {
    if (/documento_lep_uma_emitida/i.test(msg)) return new Error(`Não foi possível ${acao}: já existe uma Lista de Páginas Efectivas emitida para este documento. Emita a nova — a anterior passa a substituída no mesmo instante.`);
    if (/documento_credenciado_activo/i.test(msg)) return new Error(`Não foi possível ${acao}: esta pessoa já tem uma credencial activa com este âmbito. Altere a que existe em vez de criar outra.`);
    if (/documento_lep_pagina/i.test(msg)) return new Error(`Não foi possível ${acao}: essa página já está nesta lista. Uma página aparece uma só vez na Lista de Páginas Efectivas.`);
    return new Error(`Não foi possível ${acao}: já existe um registo igual.`);
  }
  if (error?.code === '23514' || /check constraint|check_violation/i.test(msg)) {
    return new Error(msg.replace(/^.*?:\s*/s, '') || `Não foi possível ${acao}: os dados não cumprem uma regra do regime.`);
  }
  if (error?.code === '23503' || /foreign key/i.test(msg)) {
    return new Error(`Não foi possível ${acao}: há registos agarrados a este. Revogue ou devolva em vez de apagar.`);
  }
  if (/does not exist|42703|42P01|42883/i.test(msg) || ['42703', '42P01', '42883'].includes(error?.code)) {
    return new Error(`Não foi possível ${acao}: o regime AVSEC ainda não está instalado no servidor (migração 158).`);
  }
  return new Error(msg || `Não foi possível ${acao}.`);
}
// Verdadeiro quando a falha é «a migração 158 ainda não foi aplicada»: o ecrã mostra um aviso em vez de um erro.
export const faltaMigracao = (error) => /ainda não está instalado no servidor/.test(String(error?.message || ''));

// ── classificação (Instrutivo 32.009.001.A, n.º 3) ──────────────────────────
// A lista vem do servidor com o TEXTO DA LEI, e é esse texto que se mostra a quem classifica. Não há aqui uma
// escala «confidencial < reservado < secreto»: a lei não a tem, tem categorias.
export async function lerCategoriasClassificacao() {
  const { data, error } = await supabase.from('documento_classificacao_categoria')
    .select('codigo,designacao,texto_lei,fonte,ordem,ativo').order('ordem');
  if (error) throw erroAvsec(error, 'carregar as categorias de classificação');
  return naLista(data);
}

export async function classificarDocumento(documentoId, categoria, actor) {
  if (!documentoId) throw new Error('Documento desconhecido.');
  const patch = categoria
    ? { classificacao_categoria: categoria, classificacao_em: new Date().toISOString(), classificacao_por: actor?.email || null }
    : { classificacao_categoria: null, classificacao_em: null, classificacao_por: null };
  const { error } = await supabase.from('documento').update({ ...patch, updated_date: new Date().toISOString() }).eq('id', documentoId);
  if (error) throw erroAvsec(error, categoria ? 'classificar o documento' : 'retirar a classificação');
}

// ── documentos no regime ────────────────────────────────────────────────────
const COLS_AVSEC = 'documento_id,volume,volume_titulo,total_volumes,guarda_nome,guarda_email,guarda_telefone,guarda_fax,anac_informada_em,local_guarda,prazo_submissao_dias,prazo_resposta_dias,limiar_republicacao_pct,meses_conferencia,meses_revisao_total,meses_validade_credencial,revisao_total_ultima,nota,criado_por,created_date,updated_by,updated_date';

export async function lerPainelAvsec() {
  const { data, error } = await supabase.from('documento_avsec_painel').select('*').order('numero');
  if (error) throw erroAvsec(error, 'carregar os documentos do regime AVSEC');
  return naLista(data);
}
export async function lerRegimeAvsec(documentoId) {
  if (!documentoId) return null;
  const { data, error } = await supabase.from('documento_avsec').select(COLS_AVSEC).eq('documento_id', documentoId).maybeSingle();
  if (error) throw erroAvsec(error, 'carregar o regime do documento');
  return data || null;
}
// Candidatos: documentos cuja numeração os liga à segurança da aviação mas que ainda não estão no regime. A
// migração 158 trouxe só os programas (classe PR) de propósito — uma ficha de registo não tem Lista de Páginas
// Efectivas nem se confere página a página, e metê-la no regime bloquearia a sua distribuição.
export async function lerCandidatosAvsec({ limite = 200 } = {}) {
  const { data, error } = await supabase.from('documento')
    .select('id,numero,titulo,estado,aeroporto_id,classe_codigo,processo_codigo,classificacao_categoria,versao_atual')
    .in('processo_codigo', ['PSA', 'AVSE'])
    .is('deleted_at', null).is('voo_ligado_id', null)
    .order('numero').limit(limite);
  if (error) throw erroAvsec(error, 'carregar os candidatos ao regime');
  return naLista(data);
}

// Trazer um documento para o regime, ou guardar os seus parâmetros. Os prazos nascem com os valores da lei (é o
// servidor que os põe por omissão): aqui só se envia o que a pessoa escreveu.
export async function guardarRegimeAvsec(documentoId, campos = {}, actor) {
  if (!documentoId) throw new Error('Escolha o documento.');
  const linha = {
    volume: texto(campos.volume),
    volume_titulo: texto(campos.volume_titulo),
    total_volumes: Number.isFinite(Number(campos.total_volumes)) && Number(campos.total_volumes) > 0 ? Math.round(Number(campos.total_volumes)) : null,
    guarda_nome: texto(campos.guarda_nome),
    guarda_email: email(campos.guarda_email),
    guarda_telefone: texto(campos.guarda_telefone),
    guarda_fax: texto(campos.guarda_fax),
    anac_informada_em: soData(campos.anac_informada_em),
    local_guarda: texto(campos.local_guarda),
    revisao_total_ultima: soData(campos.revisao_total_ultima),
    nota: texto(campos.nota),
    updated_by: actor?.email || null,
    updated_date: new Date().toISOString(),
  };
  for (const [chave, minimo] of [['prazo_submissao_dias', 1], ['prazo_resposta_dias', 1], ['limiar_republicacao_pct', 1], ['meses_conferencia', 1], ['meses_revisao_total', 1]]) {
    const n = Number(campos[chave]);
    if (Number.isFinite(n) && n >= minimo) linha[chave] = Math.round(n);
  }
  // nulo é uma escolha válida: credencial sem termo
  if (campos.meses_validade_credencial === null || campos.meses_validade_credencial === '') linha.meses_validade_credencial = null;
  else if (Number.isFinite(Number(campos.meses_validade_credencial))) linha.meses_validade_credencial = Math.round(Number(campos.meses_validade_credencial));

  const existe = await lerRegimeAvsec(documentoId);
  if (existe) {
    const { error } = await supabase.from('documento_avsec').update(linha).eq('documento_id', documentoId);
    if (error) throw erroAvsec(error, 'guardar o regime do documento');
    return;
  }
  const { error } = await supabase.from('documento_avsec')
    .insert({ ...linha, documento_id: documentoId, criado_por: actor?.email || null });
  if (error) throw erroAvsec(error, 'trazer o documento para o regime AVSEC');
}

// ── Lista de Páginas Efectivas ──────────────────────────────────────────────
const COLS_LEP = 'id,documento_id,revisao,versao_id,emenda_id,volume,emitida_em,estado,emitida_por,substituida_em,nota,criado_por,created_date,updated_date';
const COLS_LEP_PAGINA = 'id,lep_id,pagina,ordem,volume,capitulo,titulo,revisao,efectiva_em,accao,nota';

export async function lerEdicoesLep(documentoId) {
  if (!documentoId) return [];
  const { data, error } = await supabase.from('documento_lep').select(COLS_LEP)
    .eq('documento_id', documentoId).order('emitida_em', { ascending: false }).order('revisao', { ascending: false });
  if (error) throw erroAvsec(error, 'carregar as Listas de Páginas Efectivas');
  return naLista(data);
}
export async function lerLepActuais() {
  const { data, error } = await supabase.from('documento_lep_actual').select('*');
  if (error) throw erroAvsec(error, 'carregar as Listas de Páginas Efectivas em vigor');
  return naLista(data);
}
export async function lerPaginasLep(lepId) {
  if (!lepId) return [];
  const { data, error } = await supabase.from('documento_lep_pagina').select(COLS_LEP_PAGINA)
    .eq('lep_id', lepId).order('ordem').order('pagina');
  if (error) throw erroAvsec(error, 'carregar as páginas da lista');
  return naLista(data);
}

export async function criarEdicaoLep({ documentoId, revisao, volume, emitida_em, versao_id, emenda_id, nota }, actor) {
  if (!documentoId) throw new Error('Escolha o documento.');
  if (!texto(revisao)) throw new Error('Indique a revisão do volume a que esta lista pertence.');
  const { data, error } = await supabase.from('documento_lep').insert({
    documento_id: documentoId,
    revisao: texto(revisao),
    volume: texto(volume),
    emitida_em: soData(emitida_em) || hojeIso(),
    versao_id: versao_id || null,
    emenda_id: emenda_id || null,
    nota: texto(nota),
    estado: 'rascunho',
    criado_por: actor?.email || null,
  }).select('id,revisao,estado').maybeSingle();
  if (error) throw erroAvsec(error, 'criar a Lista de Páginas Efectivas');
  return data || {};
}

// A revisão seguinte parte da anterior: ninguém reescreve 200 linhas para mudar sete. As canceladas não passam.
export async function clonarEdicaoLep(lepId, { revisao, emitida_em, emenda_id } = {}) {
  if (!lepId) throw new Error('Escolha a lista de partida.');
  if (!texto(revisao)) throw new Error('Indique a revisão da nova lista.');
  const { data, error } = await supabase.rpc('documento_lep_clonar', {
    p_lep: lepId, p_revisao: texto(revisao), p_emitida_em: soData(emitida_em) || hojeIso(), p_emenda: emenda_id || null,
  });
  if (error) throw erroAvsec(error, 'partir da revisão anterior');
  return typeof data === 'string' ? data : (data?.[0] ?? null);
}

export async function emitirEdicaoLep(lepId) {
  if (!lepId) throw new Error('Escolha a lista a emitir.');
  const { error } = await supabase.rpc('documento_lep_emitir', { p_lep: lepId });
  if (error) throw erroAvsec(error, 'emitir a Lista de Páginas Efectivas');
}

export async function guardarPaginaLep(pagina, { lepId } = {}) {
  const alvo = pagina?.lep_id || lepId;
  if (!alvo) throw new Error('Lista desconhecida.');
  if (!texto(pagina?.pagina)) throw new Error('Indique a página (pode ser «3-4» ou «A-1»: a lei não exige números).');
  if (!texto(pagina?.revisao)) throw new Error('Indique a revisão desta página — é o que a alínea k) manda registar.');
  if (!soData(pagina?.efectiva_em)) throw new Error('Indique a data de efectivação da página — é o que a alínea k) manda registar.');
  const linha = {
    lep_id: alvo,
    pagina: texto(pagina.pagina),
    ordem: Number.isFinite(Number(pagina.ordem)) ? Math.round(Number(pagina.ordem)) : 0,
    volume: texto(pagina.volume),
    capitulo: texto(pagina.capitulo),
    titulo: texto(pagina.titulo),
    revisao: texto(pagina.revisao),
    efectiva_em: soData(pagina.efectiva_em),
    accao: ['original', 'inserida', 'actualizada', 'cancelada'].includes(pagina.accao) ? pagina.accao : 'original',
    nota: texto(pagina.nota),
  };
  if (pagina.id) {
    const { error } = await supabase.from('documento_lep_pagina').update(linha).eq('id', pagina.id);
    if (error) throw erroAvsec(error, 'guardar a página');
    return pagina.id;
  }
  const { data, error } = await supabase.from('documento_lep_pagina').insert(linha).select('id').maybeSingle();
  if (error) throw erroAvsec(error, 'acrescentar a página');
  return data?.id || null;
}

export async function apagarPaginaLep(id) {
  if (!id) return;
  const { error } = await supabase.from('documento_lep_pagina').delete().eq('id', id);
  if (error) throw erroAvsec(error, 'apagar a página');
}

// Várias páginas de uma vez, a partir de texto colado. Serve o caso real: a LPE de um volume vem de um ficheiro
// Word ou de uma folha de cálculo, e escrever 200 linhas à mão no navegador não é trabalho de pessoas.
export async function acrescentarPaginasLep(lepId, linhas = []) {
  if (!lepId) throw new Error('Lista desconhecida.');
  const prontas = naLista(linhas).filter(l => texto(l?.pagina)).map((l, i) => ({
    lep_id: lepId,
    pagina: texto(l.pagina),
    ordem: Number.isFinite(Number(l.ordem)) ? Math.round(Number(l.ordem)) : i + 1,
    volume: texto(l.volume),
    capitulo: texto(l.capitulo),
    titulo: texto(l.titulo),
    revisao: texto(l.revisao) || '00',
    efectiva_em: soData(l.efectiva_em) || hojeIso(),
    accao: ['original', 'inserida', 'actualizada', 'cancelada'].includes(l.accao) ? l.accao : 'original',
    nota: texto(l.nota),
  }));
  if (!prontas.length) throw new Error('Não há páginas para acrescentar.');
  const { error } = await supabase.from('documento_lep_pagina').insert(prontas);
  if (error) throw erroAvsec(error, 'acrescentar as páginas');
  return prontas.length;
}

// A comparação entre duas edições: o que entra, o que sai, o que foi substituído. É a lista de trabalho de quem
// vai actualizar uma cópia controlada na mão.
export async function compararEdicoesLep(lepA, lepB) {
  if (!lepA || !lepB) return [];
  const { data, error } = await supabase.rpc('documento_lep_comparar', { p_lep_a: lepA, p_lep_b: lepB });
  if (error) throw erroAvsec(error, 'comparar as duas listas');
  return naLista(data);
}

// ── credenciados ────────────────────────────────────────────────────────────
const COLS_CRED = 'id,email,nome,cargo,entidade,interno,aeroporto_id,processo_codigo,credenciado_em,valida_ate,autorizado_por,autorizado_cargo,necessidade_saber,sigilo_aceite_em,sigilo_aceite_nota,estado,revogado_em,revogado_por,revogacao_motivo,nota,criado_por,created_date,updated_by,updated_date';

export async function lerCredenciados() {
  const { data, error } = await supabase.from('documento_credenciado_vista').select('*')
    .order('estado').order('nome');
  if (error) throw erroAvsec(error, 'carregar o registo de credenciados');
  return naLista(data);
}

// Formandos com a Formação AVSEC concluída (certificado) e ainda SEM credencial activa — sugestões para credenciar.
// RPC SECURITY DEFINER (migração 174): não depende da RLS dos certificados e só responde a gestores do portal.
export async function lerFormandosElegiveis() {
  const { data, error } = await supabase.rpc('avsec_formandos_elegiveis');
  if (error) throw erroAvsec(error, 'carregar os formandos elegíveis');
  return naLista(data);
}

// Criar ou alterar uma credencial. Três campos são obrigatórios porque a lei os obriga: quem autorizou (alínea j)),
// a necessidade de saber (alínea b)) e o nome de quem é credenciado (alínea d), que fala de um registo de pessoas).
export async function guardarCredencial(c, actor) {
  if (!email(c?.email)) throw new Error('Indique o correio electrónico da pessoa a credenciar.');
  if (!texto(c?.nome)) throw new Error('Indique o nome completo: o registo da alínea d) é nominal.');
  if (!texto(c?.autorizado_por)) throw new Error('Indique quem autorizou a credencial — a alínea j) exige autorização do responsável da empresa.');
  if (!texto(c?.necessidade_saber)) throw new Error('Escreva porque é que esta pessoa precisa de ter o documento: é o princípio da necessidade de conhecimento (alínea b)).');
  const linha = {
    email: email(c.email),
    nome: texto(c.nome),
    cargo: texto(c.cargo),
    entidade: texto(c.entidade),
    interno: c.interno !== false,
    aeroporto_id: c.aeroporto_id || null,
    processo_codigo: texto(c.processo_codigo),
    credenciado_em: soData(c.credenciado_em) || hojeIso(),
    valida_ate: soData(c.valida_ate),
    autorizado_por: texto(c.autorizado_por),
    autorizado_cargo: texto(c.autorizado_cargo),
    necessidade_saber: texto(c.necessidade_saber),
    nota: texto(c.nota),
    updated_by: actor?.email || null,
    updated_date: new Date().toISOString(),
  };
  if (c.estado === 'suspenso' || c.estado === 'activo') linha.estado = c.estado;
  if (c.id) {
    const { error } = await supabase.from('documento_credenciado').update(linha).eq('id', c.id);
    if (error) throw erroAvsec(error, 'guardar a credencial');
    return c.id;
  }
  const { data, error } = await supabase.from('documento_credenciado')
    .insert({ ...linha, criado_por: actor?.email || null }).select('id').maybeSingle();
  if (error) throw erroAvsec(error, 'credenciar a pessoa');
  return data?.id || null;
}

// Revogar não é apagar: a linha fica, com motivo, data e quem. A função devolve quantas cópias essa pessoa ainda
// tem na mão — que é a pergunta seguinte, e a razão de ser desta função não ser um UPDATE qualquer.
export async function revogarCredencial(id, motivo) {
  if (!id) throw new Error('Credencial desconhecida.');
  if (!texto(motivo)) throw new Error('Escreva o motivo da revogação.');
  const { data, error } = await supabase.rpc('documento_credenciado_revogar', { p_id: id, p_motivo: texto(motivo) });
  if (error) throw erroAvsec(error, 'revogar a credencial');
  const linha = Array.isArray(data) ? data[0] : data;
  return Number(linha?.copias_activas ?? 0);
}

// Registar o dever de sigilo (Instrutivo 32.009.001.A, n.º 4, alínea b)): quem recebe matéria classificada fica
// vinculado. Guarda-se a data em que ficou documentado, não uma assinatura — não temos assinatura avançada.
export async function registarSigilo(id, nota, actor) {
  if (!id) throw new Error('Credencial desconhecida.');
  const { error } = await supabase.from('documento_credenciado').update({
    sigilo_aceite_em: new Date().toISOString(),
    sigilo_aceite_nota: texto(nota) || 'Dever de sigilo registado no portal.',
    updated_by: actor?.email || null,
    updated_date: new Date().toISOString(),
  }).eq('id', id);
  if (error) throw erroAvsec(error, 'registar o dever de sigilo');
}

export async function lerCredenciaisACaducar(dias = 60) {
  const { data, error } = await supabase.rpc('documentos_credenciais_a_caducar', { p_dias: Math.max(0, Math.round(Number(dias) || 0)) });
  if (error) throw erroAvsec(error, 'carregar as credenciais a caducar');
  return naLista(data);
}

// ── cópias controladas ──────────────────────────────────────────────────────
const COLS_COPIA = 'id,documento_id,numero,credenciado_id,detentor_email,detentor_nome,detentor_cargo,entidade,aeroporto_id,suporte,local_guarda,revisao,lep_id,entregue_em,entregue_por,recebido_em,devolvida_em,devolvida_por,estado,estado_nota,nota,criado_por,created_date,updated_date';

export async function lerCopiasControladas({ documentoId } = {}) {
  let q = supabase.from('documento_copia_controlada').select(COLS_COPIA).order('documento_id').order('numero');
  if (documentoId) q = q.eq('documento_id', documentoId);
  const { data, error } = await q;
  if (error) throw erroAvsec(error, 'carregar as cópias controladas');
  return naLista(data);
}

// Entregar uma cópia. O número deixa-se ao servidor (numera consecutivamente por documento) e a credencial é
// verificada lá: se a pessoa não estiver credenciada, a gravação é recusada com a mensagem da alínea e).
export async function guardarCopiaControlada(c, actor) {
  if (!c?.documento_id) throw new Error('Escolha o documento.');
  if (!email(c?.detentor_email)) throw new Error('Indique o correio electrónico do detentor.');
  if (!texto(c?.detentor_nome)) throw new Error('Indique o nome do detentor: o registo da alínea d) é nominal.');
  const linha = {
    documento_id: c.documento_id,
    detentor_email: email(c.detentor_email),
    detentor_nome: texto(c.detentor_nome),
    detentor_cargo: texto(c.detentor_cargo),
    entidade: texto(c.entidade),
    aeroporto_id: c.aeroporto_id || null,
    suporte: c.suporte === 'digital' ? 'digital' : 'fisico',
    local_guarda: texto(c.local_guarda),
    revisao: texto(c.revisao),
    lep_id: c.lep_id || null,
    entregue_em: soData(c.entregue_em) || hojeIso(),
    entregue_por: texto(c.entregue_por) || actor?.full_name || actor?.email || null,
    recebido_em: soData(c.recebido_em),
    nota: texto(c.nota),
    updated_by: actor?.email || null,
    updated_date: new Date().toISOString(),
  };
  if (c.id) {
    const { error } = await supabase.from('documento_copia_controlada').update(linha).eq('id', c.id);
    if (error) throw erroAvsec(error, 'guardar a cópia controlada');
    return c.id;
  }
  const { data, error } = await supabase.from('documento_copia_controlada')
    .insert({ ...linha, criado_por: actor?.email || null }).select('id,numero').maybeSingle();
  if (error) throw erroAvsec(error, 'registar a entrega da cópia');
  return data || {};
}

// Devolver, dar por extraviada ou destruída. Continua a ser possível depois de a credencial caducar — recolher uma
// cópia de quem já não está credenciado é precisamente o que tem de poder acontecer.
export async function mudarEstadoCopia(copia, estado, nota, actor) {
  if (!copia?.id) throw new Error('Cópia desconhecida.');
  if (!['activa', 'devolvida', 'extraviada', 'destruida'].includes(estado)) throw new Error('Estado desconhecido.');
  const patch = { estado, estado_nota: texto(nota), updated_by: actor?.email || null, updated_date: new Date().toISOString() };
  if (estado === 'devolvida') {
    patch.devolvida_em = copia.devolvida_em || hojeIso();
    patch.devolvida_por = copia.devolvida_por || actor?.full_name || actor?.email || null;
  }
  if (estado === 'activa') { patch.devolvida_em = null; patch.devolvida_por = null; }
  const { error } = await supabase.from('documento_copia_controlada').update(patch).eq('id', copia.id);
  if (error) throw erroAvsec(error, 'mudar o estado da cópia');
}

// Actualizar a revisão que a cópia tem na mão — é o fecho do ciclo da alínea g): depois de inserir e cancelar as
// páginas afectadas, a cópia passa a estar na revisão nova.
export async function actualizarRevisaoCopia(copiaId, { revisao, lep_id }, actor) {
  if (!copiaId) throw new Error('Cópia desconhecida.');
  const { error } = await supabase.from('documento_copia_controlada').update({
    revisao: texto(revisao), lep_id: lep_id || null,
    updated_by: actor?.email || null, updated_date: new Date().toISOString(),
  }).eq('id', copiaId);
  if (error) throw erroAvsec(error, 'actualizar a revisão da cópia');
}

// ── conferência semestral ───────────────────────────────────────────────────
export const ACHADOS_LEI = [
  { chave: 'achado_retirada', campo: 'p_retirada', label: 'Página retirada', lei: 'alínea i): «nenhuma página … seja retirada»' },
  { chave: 'achado_insercao', campo: 'p_insercao', label: 'Página inserida', lei: 'alínea i): «… inserida»' },
  { chave: 'achado_modificacao', campo: 'p_modificacao', label: 'Página modificada', lei: 'alínea i): «… modificada»' },
  { chave: 'achado_manuscrita', campo: 'p_manuscrita', label: 'Alteração manuscrita', lei: 'alínea i): «… ou tenham alguma alteração manuscrita»' },
  { chave: 'achado_nao_localizada', campo: 'p_nao_localizada', label: 'Cópia não localizada', lei: 'não está na lei — é nosso, e é o pior dos achados' },
];

export async function lerCiclosConferencia({ documentoId } = {}) {
  let q = supabase.from('documento_conferencia_resumo').select('*').order('ano', { ascending: false }).order('semestre', { ascending: false });
  if (documentoId) q = q.eq('documento_id', documentoId);
  const { data, error } = await q;
  if (error) throw erroAvsec(error, 'carregar os ciclos de conferência');
  return naLista(data);
}

const COLS_ITEM = 'id,ciclo_id,copia_id,lep_id,estado,detentor_confirmado_em,detentor_confirmado_por,detentor_nota,conferida_em,conferida_por,achado_retirada,achado_insercao,achado_modificacao,achado_manuscrita,achado_nao_localizada,conforme,paginas_afectadas,accao_corretiva,nota,created_date,updated_date';
export async function lerItensConferencia(cicloId) {
  if (!cicloId) return [];
  const { data, error } = await supabase.from('documento_conferencia_item').select(COLS_ITEM).eq('ciclo_id', cicloId).order('created_date');
  if (error) throw erroAvsec(error, 'carregar as cópias deste ciclo');
  return naLista(data);
}

// Os itens pendentes da própria pessoa, em todos os ciclos abertos: é o que a lista «as minhas cópias» mostra a um
// detentor. As regras do servidor já limitam o que cada um vê, por isso não se filtra aqui por email.
export async function lerMeusItensConferencia() {
  const { data, error } = await supabase.from('documento_conferencia_item')
    .select(COLS_ITEM).eq('estado', 'pendente').order('created_date');
  if (error) throw erroAvsec(error, 'carregar as suas conferências pendentes');
  return naLista(data);
}

export async function abrirCicloConferencia({ documentoId, ano, semestre, prazo } = {}) {
  if (!documentoId) throw new Error('Escolha o documento.');
  const { data, error } = await supabase.rpc('documento_conferencia_abrir', {
    p_documento: documentoId,
    p_ano: Number.isFinite(Number(ano)) ? Math.round(Number(ano)) : null,
    p_semestre: [1, 2].includes(Number(semestre)) ? Number(semestre) : null,
    p_prazo: soData(prazo),
  });
  if (error) throw erroAvsec(error, 'abrir o ciclo de conferência');
  return typeof data === 'string' ? data : (data?.[0] ?? null);
}

export async function abrirSemestreTodos({ ano, semestre } = {}) {
  const { data, error } = await supabase.rpc('documentos_conferencias_abrir_semestre', {
    p_ano: Number.isFinite(Number(ano)) ? Math.round(Number(ano)) : null,
    p_semestre: [1, 2].includes(Number(semestre)) ? Number(semestre) : null,
  });
  if (error) throw erroAvsec(error, 'abrir a conferência do semestre');
  return naLista(data);
}

export async function confirmarConferencia(itemId, nota) {
  if (!itemId) throw new Error('Conferência desconhecida.');
  const { error } = await supabase.rpc('documento_conferencia_confirmar', { p_item: itemId, p_nota: texto(nota) });
  if (error) throw erroAvsec(error, 'confirmar a cópia');
}

// Registar a conferência de uma cópia. Os cinco achados vão como estão: o servidor recusa um achado sem páginas
// afectadas, porque a alínea g) manda anotar as páginas na Lista de Páginas Efectivas, e «havia páginas
// modificadas» sem dizer quais não corrige nada.
export async function registarConferencia(itemId, { achados = {}, paginas, accao, nota } = {}) {
  if (!itemId) throw new Error('Conferência desconhecida.');
  const { error } = await supabase.rpc('documento_conferencia_registar', {
    p_item: itemId,
    p_retirada: !!achados.achado_retirada,
    p_insercao: !!achados.achado_insercao,
    p_modificacao: !!achados.achado_modificacao,
    p_manuscrita: !!achados.achado_manuscrita,
    p_nao_localizada: !!achados.achado_nao_localizada,
    p_paginas: texto(paginas),
    p_accao: texto(accao),
    p_nota: texto(nota),
  });
  if (error) throw erroAvsec(error, 'registar a conferência');
}

// Fechar o ciclo. O que ficou pendente passa a «não conferida» — o que não foi feito fica tão visível como o que
// foi, e com linha no registo inviolável.
export async function fecharCicloConferencia(cicloId, nota) {
  if (!cicloId) throw new Error('Ciclo desconhecido.');
  const { data, error } = await supabase.rpc('documento_conferencia_fechar', { p_ciclo: cicloId, p_nota: texto(nota) });
  if (error) throw erroAvsec(error, 'fechar o ciclo de conferência');
  const linha = Array.isArray(data) ? data[0] : data;
  return { conferidas: Number(linha?.conferidas ?? 0), naoConferidas: Number(linha?.nao_conferidas ?? 0) };
}

// O registo inviolável. Só leitura — não existe nesta camada nenhuma função que o altere, e isso é a sua razão de
// ser (padrão da migração 149: `authenticated` perde UPDATE e DELETE).
export async function lerRegistoConferencias({ documentoId, itemId, limite = 1000 } = {}) {
  let q = supabase.from('documento_conferencia_registo')
    .select('id,item_id,ciclo_id,copia_id,documento_id,acto,por_email,estado_antes,estado_depois,achados,paginas_afectadas,nota,em')
    .order('em', { ascending: false }).limit(limite);
  if (documentoId) q = q.eq('documento_id', documentoId);
  if (itemId) q = q.eq('item_id', itemId);
  const { data, error } = await q;
  if (error) throw erroAvsec(error, 'carregar o registo de conferências');
  return naLista(data);
}

// ── leitura de uma lista de páginas colada ──────────────────────────────────
// Aceita o que as pessoas colam de um Word ou de uma folha de cálculo: separado por tabulações, por ponto e vírgula
// ou por vírgulas. Primeira coluna a página, segunda a revisão, terceira a data; o resto é título.
// NÃO rejeita linhas estranhas — devolve-as marcadas, para a pessoa corrigir no ecrã. Rejeitar à entrada faria com
// que a pessoa fosse colar noutro sítio, que é o pior resultado possível.
export function lerPaginasColadas(bruto, { revisaoPadrao = '00', dataPadrao = null } = {}) {
  const linhas = String(bruto || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const out = [];
  let ordem = 0;
  for (const l of linhas) {
    const partes = l.split(/\t|;|,(?=\s*\S)/).map(p => p.trim());
    const pagina = partes[0];
    if (!pagina) continue;
    ordem += 1;
    const rev = partes[1] || revisaoPadrao;
    const dataBruta = partes[2] || dataPadrao || '';
    const data = normalizarData(dataBruta);
    out.push({
      ordem,
      pagina,
      revisao: rev,
      efectiva_em: data,
      titulo: partes.slice(3).join(' ').trim() || null,
      accao: 'original',
      aviso: !data ? 'Sem data de efectivação — a alínea k) manda registá-la.' : null,
    });
  }
  return out;
}

// Datas como as pessoas as escrevem: 2026-03-14, 14/03/2026, 14-03-2026.
function normalizarData(v) {
  const s = String(v || '').trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (m) return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
  return null;
}
