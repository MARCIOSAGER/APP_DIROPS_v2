// As duas pontes do Portal de Documentos (migração 159), camada de dados.
//
// PONTE 1 — DOCUMENTO ↔ CURSO. Um procedimento que muda tem quase sempre uma aula que o ensina. A ligação diz a
//   sua direcção (o curso ENSINA o documento, o documento é a FONTE do curso, ou é leitura de REFERÊNCIA) e
//   guarda a revisão contra a qual o conteúdo do curso foi conferido. Se a revisão em vigor é maior do que a
//   conferida, o curso está por rever — e isso tem de se ver, porque é matéria de segurança operacional.
//   Quem publica uma revisão não tem de se lembrar de avisar ninguém: o servidor abre o alerta (gatilho da 159).
//
// PONTE 2 — CONFORMIDADE REQUISITO → PARÁGRAFO. A ANAC inspecciona por requisito, não por documento. Aqui
//   lêem-se os diplomas, os requisitos e as PROVAS (requisito → documento → revisão → página/parágrafo), e
//   pede-se ao servidor a matriz e a cobertura já calculadas (`conformidade_matriz`, `conformidade_cobertura`),
//   porque é lá que estão as regras de acesso: a cobertura que cada pessoa vê é a dos documentos a que tem acesso.
//
// Nada neste ficheiro escreve na Universidade Corporativa. Os cursos lêem-se (`curso`), nunca se alteram.
// Molde: src/documentos/api.js, src/documentos/apiCodificacao.js.
import { supabase } from '@/lib/supabaseClient';

const naLista = (v) => (Array.isArray(v) ? v : []);
const texto = (v) => (String(v ?? '').trim() ? String(v).trim() : null);
const inteiro = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};

// Traduz a recusa do servidor em português, em vez de mostrar o erro cru. A falta das tabelas tem mensagem
// própria: é o caso de quem abre o ecrã antes de a migração 159 estar aplicada, e convém dizê-lo em claro.
export function erroConformidade(error, acao) {
  const msg = String(error?.message || '');
  if (error?.code === '42501' || /policy|permission|denied|row-level/i.test(msg)) {
    return new Error(`Não foi possível ${acao}: não tem permissão. A matriz de conformidade é da gestão documental; as ligações à formação são também de quem gere a formação.`);
  }
  if (error?.code === '23505' || /duplicate|unique/i.test(msg)) {
    return new Error(`Não foi possível ${acao}: já existe um registo igual (o mesmo requisito no mesmo sítio do mesmo documento, ou o mesmo curso já ligado a este documento).`);
  }
  if (error?.code === '23503' || /foreign key/i.test(msg)) {
    return new Error(`Não foi possível ${acao}: o documento, o curso ou o requisito indicado já não existe. Recarregue a página.`);
  }
  if (error?.code === '42703' || error?.code === '42P01' || error?.code === 'PGRST202' || /does not exist|not find the (table|function)/i.test(msg)) {
    return new Error(`Não foi possível ${acao}: a ligação à formação e a matriz de conformidade ainda não estão instaladas no servidor (migração 159).`);
  }
  return new Error(msg || `Não foi possível ${acao}.`);
}

// ════════════════════════════════════════════════════════════════════════════
// PONTE 1 — DOCUMENTO ↔ CURSO
// ════════════════════════════════════════════════════════════════════════════

// Vocabulário fechado, igual ao do servidor. O rótulo longo explica a escolha a quem a faz pela primeira vez:
// é aqui que as pessoas erram, e uma lista de três palavras soltas não as ajuda.
export const RELACOES = [
  { value: 'ensina', label: 'O curso ensina este documento', curto: 'Ensina',
    longo: 'A formação existe para que as pessoas saibam cumprir este documento. Se o documento muda, o curso tem de ser revisto.' },
  { value: 'fonte', label: 'Este documento é a fonte do curso', curto: 'Fonte',
    longo: 'O conteúdo do curso foi escrito a partir deste documento. Uma revisão do documento desactualiza o material.' },
  { value: 'referencia', label: 'Leitura de referência do curso', curto: 'Referência',
    longo: 'O curso remete para este documento como leitura de apoio, sem o ensinar directamente.' },
];

export const ACCOES_REVISAO = [
  { value: 'avisar', label: 'Avisar quem gere a formação', curto: 'Avisar',
    longo: 'Abre um alerta e fica por aí. Serve para documentos cuja revisão raramente muda o que se ensina.' },
  { value: 'revisar_conteudo', label: 'Rever o conteúdo do curso', curto: 'Rever conteúdo',
    longo: 'O material do curso tem de ser conferido e corrigido antes de voltar a ser dado.' },
  { value: 'recertificar', label: 'Recertificar quem já concluiu', curto: 'Recertificar',
    longo: 'Quem concluiu o curso aprendeu o procedimento antigo: tem de repetir a formação.' },
];

export const ESTADOS_ALERTA = [
  { value: 'aberto', label: 'Aberto' },
  { value: 'em_revisao', label: 'Em revisão' },
  { value: 'resolvido', label: 'Resolvido' },
  { value: 'sem_impacto', label: 'Sem impacto no curso' },
];

export const rotulo = (lista, valor) => lista.find(o => o.value === valor)?.curto
  || lista.find(o => o.value === valor)?.label || valor || '';

// As ligações de um documento (ou todas), com os dois lados já colados pela vista do servidor.
export async function lerLigacoes({ documentoId, cursoId, limite = 1000 } = {}) {
  let q = supabase.from('documento_curso_painel').select('*').limit(limite);
  if (documentoId) q = q.eq('documento_id', documentoId);
  if (cursoId) q = q.eq('curso_id', cursoId);
  const { data, error } = await q;
  if (error) throw erroConformidade(error, 'carregar as ligações à formação');
  return naLista(data).sort((a, b) => String(a.curso_titulo || '').localeCompare(String(b.curso_titulo || ''), 'pt'));
}

// Os cursos da Universidade, só para escolher. Lê-se a tabela do LMS e não se lhe toca.
export async function lerCursosDisponiveis() {
  const { data, error } = await supabase.from('curso')
    .select('id,titulo,categoria,publicado,instrutor_nome,instrutor_email,validade_meses,obrigatorio_todos,obrigatorio_perfis')
    .is('deleted_at', null)
    .order('titulo');
  if (error) throw erroConformidade(error, 'carregar os cursos da Universidade');
  return naLista(data);
}

export async function ligarDocumentoCurso({ documento_id, curso_id, relacao, acao_na_revisao, notas, versao_conferida } = {}, actor) {
  if (!documento_id) throw new Error('Documento desconhecido.');
  if (!curso_id) throw new Error('Escolha o curso a ligar a este documento.');
  const linha = {
    documento_id,
    curso_id,
    relacao: RELACOES.some(r => r.value === relacao) ? relacao : 'ensina',
    acao_na_revisao: ACCOES_REVISAO.some(a => a.value === acao_na_revisao) ? acao_na_revisao : 'avisar',
    notas: texto(notas),
    versao_conferida: inteiro(versao_conferida),
    criado_por: actor?.email || null,
  };
  const { data, error } = await supabase.from('documento_curso').insert(linha).select('id').maybeSingle();
  if (error) throw erroConformidade(error, 'ligar o curso a este documento');
  return data?.id || null;
}

export async function guardarLigacao(id, { relacao, acao_na_revisao, notas } = {}) {
  if (!id) throw new Error('Ligação desconhecida.');
  const patch = { updated_date: new Date().toISOString() };
  if (relacao !== undefined) patch.relacao = RELACOES.some(r => r.value === relacao) ? relacao : 'ensina';
  if (acao_na_revisao !== undefined) patch.acao_na_revisao = ACCOES_REVISAO.some(a => a.value === acao_na_revisao) ? acao_na_revisao : 'avisar';
  if (notas !== undefined) patch.notas = texto(notas);
  const { error } = await supabase.from('documento_curso').update(patch).eq('id', id);
  if (error) throw erroConformidade(error, 'guardar a ligação');
}

export async function desligarDocumentoCurso(id) {
  if (!id) throw new Error('Ligação desconhecida.');
  const { error } = await supabase.from('documento_curso').delete().eq('id', id);
  if (error) throw erroConformidade(error, 'desligar o curso deste documento');
}

// «Vi a revisão nova e o conteúdo do curso está em dia»: marca a ligação e fecha os alertas abertos por ela, numa
// só chamada ao servidor, para os dois não ficarem meio feitos.
export async function conferirLigacao(id, { versao, nota } = {}) {
  if (!id) throw new Error('Ligação desconhecida.');
  const { data, error } = await supabase.rpc('documento_curso_conferir', {
    p_ligacao: id, p_versao: inteiro(versao), p_nota: texto(nota),
  });
  if (error) throw erroConformidade(error, 'confirmar que o curso está em dia');
  const linha = Array.isArray(data) ? data[0] : data;
  return { versao: linha?.versao_conferida ?? null, alertasFechados: Number(linha?.alertas_fechados) || 0 };
}

// O que a gestão da formação tem de ver: alertas com o documento, o curso e quantas pessoas concluíram o curso
// ANTES de a revisão entrar em vigor (é esse número que decide entre corrigir a aula e recertificar gente).
export async function lerImpactoFormacao(estado = 'aberto') {
  const { data, error } = await supabase.rpc('documento_formacao_impacto', { p_estado: estado || 'todos' });
  if (error) throw erroConformidade(error, 'carregar o impacto das revisões na formação');
  return naLista(data);
}

export async function marcarAlerta(id, estado, { nota } = {}, actor) {
  if (!id) throw new Error('Alerta desconhecido.');
  if (!ESTADOS_ALERTA.some(e => e.value === estado)) throw new Error('Estado desconhecido.');
  const patch = { estado, nota: texto(nota) };
  if (estado === 'resolvido' || estado === 'sem_impacto') {
    patch.resolvido_por = actor?.email || null;
    patch.resolvido_em = new Date().toISOString();
  } else {
    patch.resolvido_por = null;
    patch.resolvido_em = null;
  }
  const { error } = await supabase.from('documento_curso_alerta').update(patch).eq('id', id);
  if (error) throw erroConformidade(error, 'mudar o estado do alerta');
}

// ════════════════════════════════════════════════════════════════════════════
// PONTE 2 — MATRIZ DE CONFORMIDADE
// ════════════════════════════════════════════════════════════════════════════

// O grau de cada prova. «Não aplicável» é uma resposta legítima a um inspector — desde que fundamentada —, e por
// isso é um grau e não a ausência de prova.
export const GRAUS = [
  { value: 'cumpre', label: 'Cumpre', longo: 'Este parágrafo do documento cumpre o requisito.' },
  { value: 'parcial', label: 'Cumpre em parte', longo: 'Cobre parte do requisito; falta o resto noutro sítio.' },
  { value: 'planeado', label: 'Planeado', longo: 'Está decidido onde vai ficar, mas ainda não está escrito.' },
  { value: 'nao_aplicavel', label: 'Não aplicável', longo: 'O requisito não se aplica a esta organização, e a nota diz porquê.' },
];

// O estado de cobertura de um requisito, como o servidor o devolve. `descoberto` é o que importa: é o buraco.
export const ESTADOS_COBERTURA = [
  { value: 'descoberto', label: 'Sem nada a apontar' },
  { value: 'planeado', label: 'Planeado' },
  { value: 'parcial', label: 'Coberto em parte' },
  { value: 'coberto', label: 'Coberto' },
  { value: 'nao_aplicavel', label: 'Não aplicável' },
];

export const CRITICIDADES = [
  { value: 'alta', label: 'Alta' },
  { value: 'media', label: 'Média' },
  { value: 'baixa', label: 'Baixa' },
];

export async function lerDiplomas() {
  const { data, error } = await supabase.from('conformidade_diploma').select('*').order('ordem').order('codigo');
  if (error) throw erroConformidade(error, 'carregar os diplomas');
  return naLista(data);
}

// Cobertura por diploma, calculada no servidor. Devolve também os buracos críticos e as provas a reconfirmar.
export async function lerCobertura() {
  const { data, error } = await supabase.rpc('conformidade_cobertura');
  if (error) throw erroConformidade(error, 'calcular a cobertura');
  return naLista(data);
}

// A matriz: uma linha por requisito, com as provas lá dentro em JSON. A ordenação dos artigos vem do servidor
// («1.10» depois de «1.9», e não antes), por isso não se reordena aqui.
export async function lerMatriz(diploma = null) {
  const { data, error } = await supabase.rpc('conformidade_matriz', { p_diploma: texto(diploma) });
  if (error) throw erroConformidade(error, 'carregar a matriz de conformidade');
  return naLista(data).map(r => ({ ...r, provas: Array.isArray(r.provas) ? r.provas : [] }));
}

// Varredura automática: pede ao servidor que sugira correspondências requisito→página por semelhança de texto.
// Cria provas «planeado — por confirmar»; é aditiva, idempotente e nunca toca no que uma pessoa confirmou. Só gestor.
export async function sugerirCorrespondencias() {
  const { data, error } = await supabase.rpc('conformidade_sugerir_automatico');
  if (error) throw erroConformidade(error, 'sugerir correspondências automáticas');
  return data || {};
}

// As provas que apontam para um documento, com o requisito a que respondem. Serve a ficha do documento:
// «este manual é a resposta a estes requisitos».
export async function lerProvasDoDocumento(documentoId) {
  if (!documentoId) return [];
  const { data, error } = await supabase.from('conformidade_prova')
    .select('*,conformidade_requisito(id,diploma_codigo,artigo,titulo,criticidade)')
    .eq('documento_id', documentoId)
    .order('created_date', { ascending: false });
  if (error) throw erroConformidade(error, 'carregar os requisitos deste documento');
  return naLista(data);
}

export async function guardarDiploma({ codigo, nome, entidade, referencia, url, notas, ordem, ativo, reservado } = {}) {
  const cod = String(codigo ?? '').trim().toUpperCase();
  if (!cod) throw new Error('Indique o código pelo qual o diploma se cita (ex.: INSTR-22C.107.001.A).');
  if (!texto(nome)) throw new Error('O diploma tem de ter um nome: é o que aparece a quem consulta a matriz.');
  const linha = {
    codigo: cod,
    nome: texto(nome),
    entidade: texto(entidade) || 'ANAC',
    referencia: texto(referencia),
    url: texto(url),
    notas: texto(notas),
    ordem: Number.isFinite(Number(ordem)) ? Number(ordem) : 99,
    ativo: ativo !== false,
    reservado: reservado === true,
    updated_date: new Date().toISOString(),
  };
  const { error } = await supabase.from('conformidade_diploma').upsert(linha, { onConflict: 'codigo' });
  if (error) throw erroConformidade(error, 'guardar o diploma');
  return cod;
}

export async function guardarRequisito(r, actor) {
  if (!r?.diploma_codigo) throw new Error('Escolha o diploma a que o requisito pertence.');
  if (!texto(r.titulo)) throw new Error('O requisito tem de ter um título: é por ele que se procura na matriz.');
  const linha = {
    diploma_codigo: r.diploma_codigo,
    // o artigo pode ficar em branco: há exigências apuradas cujo parágrafo ainda não está confirmado, e inventar
    // um número numa matriz que vai à ANAC é pior do que deixá-lo vazio
    artigo: String(r.artigo ?? '').trim(),
    titulo: String(r.titulo).trim(),
    texto: texto(r.texto),
    processo_codigo: texto(r.processo_codigo),
    criticidade: CRITICIDADES.some(c => c.value === r.criticidade) ? r.criticidade : 'media',
    obrigatorio: r.obrigatorio !== false,
    notas: texto(r.notas),
    ordem: Number.isFinite(Number(r.ordem)) ? Number(r.ordem) : null,
    ativo: r.ativo !== false,
    updated_date: new Date().toISOString(),
  };
  if (r.id) {
    const { error } = await supabase.from('conformidade_requisito').update(linha).eq('id', r.id);
    if (error) throw erroConformidade(error, 'guardar o requisito');
    return r.id;
  }
  const { data, error } = await supabase.from('conformidade_requisito')
    .insert({ ...linha, fonte: texto(r.fonte), criado_por: actor?.email || null })
    .select('id').maybeSingle();
  if (error) throw erroConformidade(error, 'criar o requisito');
  return data?.id || null;
}

// Desactivar em vez de apagar é a regra do portal: um requisito apagado leva consigo as provas, e com elas a
// memória de onde a resposta estava.
export async function activarRequisito(id, ativo) {
  if (!id) throw new Error('Requisito desconhecido.');
  const { error } = await supabase.from('conformidade_requisito')
    .update({ ativo: ativo !== false, updated_date: new Date().toISOString() }).eq('id', id);
  if (error) throw erroConformidade(error, 'alterar o requisito');
}

export async function apagarRequisito(id) {
  if (!id) throw new Error('Requisito desconhecido.');
  const { error } = await supabase.from('conformidade_requisito').delete().eq('id', id);
  if (error) throw erroConformidade(error, 'apagar o requisito');
}

// A prova: o requisito apontado a um documento, a uma revisão e a uma página/parágrafo. A revisão em branco é
// preenchida pelo servidor com a que está em vigor no momento (gatilho da 159) — é isso que, mais tarde, permite
// dizer que a prova é anterior à revisão actual.
export async function guardarProva(p, actor) {
  if (!p?.requisito_id) throw new Error('Requisito desconhecido.');
  if (!p?.documento_id) throw new Error('Escolha o documento onde está a resposta a este requisito.');
  const grau = GRAUS.some(g => g.value === p.grau) ? p.grau : 'cumpre';
  if (grau === 'nao_aplicavel' && !texto(p.nota)) {
    throw new Error('Um requisito dado como não aplicável tem de dizer porquê: é a primeira coisa que um inspector pergunta.');
  }
  const linha = {
    requisito_id: p.requisito_id,
    documento_id: p.documento_id,
    versao_id: p.versao_id || null,
    versao: inteiro(p.versao),
    capitulo: texto(p.capitulo),
    paragrafo: texto(p.paragrafo),
    pagina: inteiro(p.pagina),
    pagina_fim: inteiro(p.pagina_fim),
    citacao: texto(p.citacao),
    grau,
    nota: texto(p.nota),
    updated_date: new Date().toISOString(),
  };
  if (p.id) {
    const { error } = await supabase.from('conformidade_prova').update(linha).eq('id', p.id);
    if (error) throw erroConformidade(error, 'guardar a prova');
    return p.id;
  }
  const { data, error } = await supabase.from('conformidade_prova')
    .insert({ ...linha, criado_por: actor?.email || null })
    .select('id').maybeSingle();
  if (error) throw erroConformidade(error, 'registar a prova');
  return data?.id || null;
}

// Reconfirmar: a prova continua válida na revisão que está agora em vigor. Guarda quem o disse e quando — é essa
// assinatura que distingue uma matriz viva de uma folha de cálculo que ninguém revê.
export async function reconfirmarProva(prova, versaoActual, actor) {
  if (!prova?.id) throw new Error('Prova desconhecida.');
  const { error } = await supabase.from('conformidade_prova').update({
    versao: inteiro(versaoActual) || prova.versao || null,
    verificado_por: actor?.email || null,
    verificado_em: new Date().toISOString(),
    updated_date: new Date().toISOString(),
  }).eq('id', prova.id);
  if (error) throw erroConformidade(error, 'reconfirmar a prova');
}

export async function apagarProva(id) {
  if (!id) throw new Error('Prova desconhecida.');
  const { error } = await supabase.from('conformidade_prova').delete().eq('id', id);
  if (error) throw erroConformidade(error, 'retirar a prova');
}
