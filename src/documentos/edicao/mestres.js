// Modelos-mestre do editor estruturado («Redigir documentos»).
//
// Um mestre é um rascunho estruturado SEM documento (documento_rascunho_estruturado.documento_id nulo) com
// `conteudo.extras.mestre = true`. O texto leva campos `{{…}}` que se preenchem por aeroporto; `extras.alvos` diz
// para que documentos existentes o mestre gera uma revisão. O mestre nunca gera documento nem PDF oficial: gera
// rascunhos estruturados ligados a cada documento-alvo, que seguem o caminho normal (gerar rascunho → aprovação).
//
// Lógica pura (sem React nem rede), para se poder testar.
//
// Campos:
//   {{aeroporto.nome}} {{aeroporto.icao}} {{aeroporto.iata}} {{aeroporto.cidade}}
//   {{aeroporto.director}} {{aeroporto.director_cargo}} {{documento.numero}}
//   {{local.<nome>}}  → extras.valoresLocais[icao][nome]
import { proximaRevisao, hojeISO } from './contrato.js';

export const CAMPOS_AEROPORTO = [
  { campo: 'aeroporto.nome', rotulo: 'Nome do aeroporto' },
  { campo: 'aeroporto.icao', rotulo: 'Código ICAO' },
  { campo: 'aeroporto.iata', rotulo: 'Código IATA' },
  { campo: 'aeroporto.cidade', rotulo: 'Cidade' },
  { campo: 'aeroporto.director', rotulo: 'Director' },
  { campo: 'aeroporto.director_cargo', rotulo: 'Cargo do director' },
  { campo: 'documento.numero', rotulo: 'Número do documento' },
];

/** `{{ campo }}` — grupo 1 = nome do campo (ex. 'aeroporto.nome', 'local.frequencia_torre'). */
const RE_CAMPO = /\{\{\s*([A-Za-z_][\w]*(?:\.[\w-]+)+)\s*\}\}/g;

/** Texto que fica no lugar de um campo sem valor (visível no PDF, para ninguém o deixar passar). */
export const marcaFalta = (campo) => `[falta: ${campo}]`;

/** Chaves que nunca se percorrem nem substituem (dados técnicos, imagens, identificadores). */
const CHAVES_INTOCAVEIS = new Set(['type', 'src', 'id', 'chave', 'extras', 'marks', 'textAlign', 'level', 'tipo', 'colspan', 'rowspan', 'colwidth', 'width', 'start', 'schema', 'modelo']);

const vazio = (v) => v === undefined || v === null || String(v).trim() === '';
const minus = (v) => String(v ?? '').trim().toLowerCase();

export const ehMestre = (conteudo) => !!(conteudo && conteudo.extras && conteudo.extras.mestre === true);

/** Lista de alvos do mestre (sempre uma lista). */
export const alvosDoMestre = (conteudo) => (Array.isArray(conteudo?.extras?.alvos) ? conteudo.extras.alvos : []);
/** Diferenças por rever (sempre uma lista de textos). */
export const diferencasDoMestre = (conteudo) => (Array.isArray(conteudo?.extras?.diferencas) ? conteudo.extras.diferencas.filter(d => !vazio(d)).map(String) : []);

/** Nomes dos campos locais usados em extras.valoresLocais (todos os aeroportos), por ordem alfabética. */
export function camposLocaisDoMestre(conteudo) {
  const vl = conteudo?.extras?.valoresLocais;
  const s = new Set();
  if (vl && typeof vl === 'object') for (const porAero of Object.values(vl)) if (porAero && typeof porAero === 'object') Object.keys(porAero).forEach(k => s.add(k));
  return [...s].sort((a, b) => a.localeCompare(b, 'pt'));
}

/**
 * Director do aeroporto: o responsável principal (documentos_aeroporto_responsavel), com o nome da conta (users)
 * se a conhecermos; senão o nome do responsável; senão o gestor_nome do aeroporto.
 * @returns {{ email: string|null, nome: string, cargo: string }}
 */
export function directorDoAeroporto(aeroporto, responsaveis = [], utilizadores = []) {
  const doAero = (Array.isArray(responsaveis) ? responsaveis : [])
    .filter(r => r && (!aeroporto?.id || !r.aeroporto_id || r.aeroporto_id === aeroporto.id));
  const r = doAero.find(x => x.principal) || doAero[0] || null;
  const u = r ? (Array.isArray(utilizadores) ? utilizadores : []).find(x => minus(x?.email) === minus(r.email)) : null;
  const nome = String(u?.full_name || r?.full_name || r?.nome || aeroporto?.gestor_nome || '').trim();
  const cargo = String(r?.cargo || aeroporto?.gestor_cargo || '').trim();
  return { email: r?.email ? minus(r.email) : null, nome, cargo };
}

/**
 * Mapa campo → valor para um aeroporto (e o documento-alvo). Valores vazios não entram (contam como em falta).
 * `utilizadores` (opcional) = linhas de users {email, full_name} para o nome do director.
 */
export function camposDoAeroporto(aeroporto, responsaveis = [], documento = null, utilizadores = []) {
  const dir = directorDoAeroporto(aeroporto, responsaveis, utilizadores);
  const v = {
    'aeroporto.nome': aeroporto?.nome,
    'aeroporto.icao': aeroporto?.codigo_icao,
    'aeroporto.iata': aeroporto?.codigo_iata,
    'aeroporto.cidade': aeroporto?.cidade,
    'aeroporto.director': dir.nome,
    'aeroporto.director_cargo': dir.cargo,
    'documento.numero': documento?.numero,
  };
  const out = {};
  for (const [k, val] of Object.entries(v)) if (!vazio(val)) out[k] = String(val).trim();
  return out;
}

/** Junta os campos locais do aeroporto ({{local.x}}) ao mapa de valores. */
export function comValoresLocais(valores, conteudoMestre, icao) {
  const locais = conteudoMestre?.extras?.valoresLocais?.[icao] || {};
  const out = { ...valores };
  for (const [k, val] of Object.entries(locais)) if (!vazio(val)) out[`local.${k}`] = String(val).trim();
  return out;
}

function substituirTexto(s, valores, emFalta) {
  return s.replace(RE_CAMPO, (_, campo) => {
    if (Object.prototype.hasOwnProperty.call(valores, campo) && !vazio(valores[campo])) return String(valores[campo]);
    emFalta.add(campo);
    return marcaFalta(campo);
  });
}

function percorrer(v, fn, chave) {
  if (typeof v === 'string') return fn(v);
  if (Array.isArray(v)) return v.map(x => percorrer(x, fn));
  if (v && typeof v === 'object') {
    const out = {};
    for (const [k, x] of Object.entries(v)) out[k] = CHAVES_INTOCAVEIS.has(k) ? x : percorrer(x, fn, k);
    return out;
  }
  return v;
}

/**
 * Cópia do documento com os {{…}} substituídos em textos, títulos, células, legendas, alt/title das imagens,
 * cabeçalho e histórico. `extras` não é tocado. Campos sem valor ficam «[falta: campo]».
 * @returns {{ doc: Object, emFalta: string[], avisos: string[] }}
 */
export function substituirCampos(doc, valores = {}) {
  const emFalta = new Set();
  const novo = percorrer(doc, (s) => (s.includes('{{') ? substituirTexto(s, valores || {}, emFalta) : s));
  if (doc && doc.extras !== undefined) novo.extras = doc.extras;
  const lista = [...emFalta];
  return { doc: novo, emFalta: lista, avisos: lista.map(c => `Campo sem valor: ${c}`) };
}

/** Campos {{…}} usados no documento (sem repetir, pela ordem em que aparecem). `extras` não conta. */
export function camposUsados(doc) {
  const s = new Set();
  percorrer(doc, (t) => { for (const m of t.matchAll(RE_CAMPO)) s.add(m[1]); return t; });
  return [...s];
}

/**
 * Revisão em vigor de um documento existente (texto, ex. '02'), ou null se não houver forma de a saber.
 * Ordem: rótulo da última versão «Rev. 03» → documento.versao numérica → versao_atual - 1.
 */
export function revisaoActualDoDocumento(documento, ultimaVersao = null) {
  const pad = (n) => String(n).padStart(2, '0');
  const m = /\brev\.?\s*(\d{1,3})\b/i.exec(String(ultimaVersao?.rotulo || ''));
  if (m) return pad(Number(m[1]));
  const v = String(documento?.versao ?? '').trim();
  if (/^\d+$/.test(v)) return pad(Number(v));
  const va = Number(documento?.versao_atual);
  if (Number.isFinite(va) && va >= 1) return pad(va - 1);
  return null;
}

/**
 * Revisão que vai sair para o alvo:
 *  - rascunho do editor já gerado → a seguinte à gerada;
 *  - rascunho do editor em edição → a desse rascunho (já é a revisão nova);
 *  - alvo.revisao (revisão em vigor indicada no mestre) → a seguinte;
 *  - senão a seguinte à revisão em vigor do documento; sem informação → '00'.
 */
export function revisaoParaAlvo({ alvo, documento, ultimaVersao, rascunhoExistente } = {}) {
  const r = rascunhoExistente;
  if (r) {
    const gerada = r.conteudo_gerado?.cabecalho?.revisao || (r.estado === 'gerado' ? r.conteudo?.cabecalho?.revisao || r.revisao : null);
    if (r.estado === 'gerado' && !vazio(gerada)) return proximaRevisao(gerada);
    const emEdicao = r.conteudo?.cabecalho?.revisao || r.revisao;
    if (!vazio(emEdicao)) return String(emEdicao);
  }
  if (!vazio(alvo?.revisao)) return proximaRevisao(alvo.revisao);
  const actual = revisaoActualDoDocumento(documento, ultimaVersao);
  return actual === null ? '00' : proximaRevisao(actual);
}

/** Descrição da entrada do histórico que a padronização acrescenta. */
export const descricaoPadronizacao = (tituloMestre) => `Padronização a partir do modelo-mestre ${String(tituloMestre || '').trim() || 'sem título'}`.trim();

/** Extras do mestre que não passam para os rascunhos gerados. */
const EXTRAS_SO_DO_MESTRE = ['mestre', 'alvos', 'diferencas', 'valoresLocais', 'chave', 'documentoId', 'pastaId'];

/**
 * Conteúdo do rascunho estruturado de UM alvo, a partir do mestre.
 * @param {Object} mestre             linha do rascunho-mestre ({ id, conteudo }) ou o próprio conteúdo
 * @param {Object} alvo               { icao, aeroporto_id, documento_id, numero, revisao?, historico? }
 * @param {Object} aeroporto          linha de documentos_aeroporto
 * @param {Object[]} responsaveis     linhas de documentos_aeroporto_responsavel desse aeroporto
 * @param {Object} documentoExistente linha de documento (+ opcional ultimaVersao: { rotulo })
 * @param {Object} rascunhoExistente  rascunho estruturado já ligado ao documento (ou null)
 * @param {Object} [opcoes]           { data, autor, utilizadores }
 * @returns {{ conteudo: Object, revisao: string, director: Object, emFalta: string[], avisos: string[] }}
 */
export function prepararParaAeroporto(mestre, alvo, aeroporto, responsaveis, documentoExistente, rascunhoExistente, opcoes = {}) {
  const base = mestre?.conteudo || mestre || {};
  const mestreId = mestre?.conteudo ? mestre.id || null : null;
  const exM = base.extras || {};
  const data = opcoes.data || hojeISO();
  const icao = String(alvo?.icao || aeroporto?.codigo_icao || '').toUpperCase();
  const numero = String(alvo?.numero || documentoExistente?.numero || '').trim();
  const avisos = [];

  const docParaCampos = { ...(documentoExistente || {}), numero };
  const valores = comValoresLocais(camposDoAeroporto(aeroporto, responsaveis, docParaCampos, opcoes.utilizadores), base, icao);
  const director = directorDoAeroporto(aeroporto, responsaveis, opcoes.utilizadores);
  if (!director.email) avisos.push(`O aeroporto ${icao || '?'} não tem responsável principal: o «Aprovado por» fica em branco e o fluxo usa o responsável que a base encontrar.`);
  if (documentoExistente?.aeroporto_id && alvo?.aeroporto_id && documentoExistente.aeroporto_id !== alvo.aeroporto_id) {
    avisos.push(`O documento ${numero} pertence a outro aeroporto que não ${icao}.`);
  }

  const revisao = revisaoParaAlvo({ alvo, documento: documentoExistente, ultimaVersao: documentoExistente?.ultimaVersao, rascunhoExistente });
  const r = rascunhoExistente;
  const historicoBase = (r && Array.isArray((r.conteudo_gerado || r.conteudo)?.historico) && (r.conteudo_gerado || r.conteudo).historico.length)
    ? (r.conteudo_gerado || r.conteudo).historico
    : (Array.isArray(alvo?.historico) ? alvo.historico : []);
  const tituloMestre = String(base.cabecalho?.titulo || '').replace(RE_CAMPO, (_, c) => valores[c] || c);
  const historico = [
    ...historicoBase.filter(h => String(h?.revisao) !== String(revisao)),
    { revisao, data, descricao: descricaoPadronizacao(tituloMestre), autor: opcoes.autor || base.cabecalho?.elaboradoPor || '' },
  ];

  const cab = base.cabecalho || {};
  const semSubst = {
    ...base,
    cabecalho: {
      ...cab,
      numero,
      revisao,
      data,
      aeroporto: icao,
      aeroportoNome: aeroporto?.nome || cab.aeroportoNome || '',
      aprovadoPor: vazio(cab.aprovadoPor) ? '{{aeroporto.director}}' : cab.aprovadoPor,
    },
    historico,
  };
  const { doc, emFalta, avisos: avisosCampos } = substituirCampos(semSubst, valores);

  const extras = Object.fromEntries(Object.entries(exM).filter(([k]) => !EXTRAS_SO_DO_MESTRE.includes(k)));
  doc.extras = {
    ...extras,
    documentoId: alvo?.documento_id || documentoExistente?.id || null,
    processo: documentoExistente?.processo_codigo || extras.processo || null,
    origemMestre: mestreId,
    verificadoEmail: exM.verificadoEmail || null,
    aprovadoEmail: director.email || null,
    elaboradoEmail: exM.elaboradoEmail || null,
  };
  return { conteudo: doc, revisao, director, emFalta, avisos: [...avisos, ...avisosCampos] };
}

/**
 * Problemas que impedem «Preparar para submissão» (abrir o fluxo) — lista vazia = pode.
 * O elaborador de um fluxo é SEMPRE quem o abre (documento_fluxo_abrir usa auth.email()).
 */
export function problemasPrepararSubmissao({ eu, conteudoMestre, director } = {}) {
  const p = [];
  const ex = conteudoMestre?.extras || {};
  const elab = minus(ex.elaboradoEmail);
  if (elab && minus(eu) !== elab) p.push(`Quem abre o fluxo fica como elaborador. Este mestre é elaborado por ${ex.elaboradoEmail}: a preparação para submissão tem de ser feita com essa conta.`);
  if (!minus(ex.verificadoEmail)) p.push('Falta o revisor (verificadoEmail) no mestre.');
  if (minus(ex.verificadoEmail) && minus(ex.verificadoEmail) === minus(eu)) p.push('Quem elabora não pode ser o revisor.');
  if (director?.email && minus(director.email) === minus(ex.verificadoEmail)) p.push('O revisor e o director do aeroporto são a mesma pessoa.');
  return p;
}

/** Resumo do fluxo (o que o revisor e o director lêem): a descrição da última entrada do histórico. */
export function resumoDoFluxo(conteudo) {
  const h = conteudo?.historico || [];
  return h[h.length - 1]?.descricao || 'Padronização a partir de modelo-mestre';
}
