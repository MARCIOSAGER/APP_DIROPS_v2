// Contrato do documento estruturado (editor próprio do GED, «Redigir documentos»).
// É a única forma que circula entre o editor (assistente + TipTap), os geradores de PDF/DOCX
// (gerarPdfEstruturado.js / gerarDocxEstruturado.js) e a tabela documento_rascunho_estruturado (coluna `conteudo`).
// Nada fora do que aqui está descrito pode entrar no editor: os geradores só garantem estes nós e marcas.

/**
 * @typedef {'POP'|'PR'|'PL'|'MA'|'FR'|'LT'|'RE'|'DO'} ModeloEstruturado
 *
 * @typedef {Object} CabecalhoEstruturado
 * @property {string} numero         ex. 'POP-FNLU-OPS-001' (codificação classe-aeroporto-processo-sequência)
 * @property {string} titulo
 * @property {string} revisao        ex. '00', '01'… (texto, para manter os zeros à esquerda)
 * @property {string} data           data da revisão em ISO (AAAA-MM-DD)
 * @property {string} aeroporto      código ICAO, ex. 'FNLU'
 * @property {string} aeroportoNome
 * @property {string} elaboradoPor
 * @property {string} verificadoPor
 * @property {string} aprovadoPor
 * @property {string} [classificacao] ex. 'Uso interno', 'Restrito'
 *
 * @typedef {Object} SeccaoEstruturada
 * @property {string} id             identificador estável da secção dentro do documento
 * @property {string} chave          chave da secção no modelo (ex. 'objectivo')
 * @property {string} titulo
 * @property {boolean} obrigatoria
 * @property {Object} conteudo       documento ProseMirror/TipTap ({ type: 'doc', content: [...] })
 *
 * @typedef {Object} EntradaHistorico
 * @property {string} revisao
 * @property {string} data           ISO (AAAA-MM-DD)
 * @property {string} descricao
 * @property {string} autor
 *
 * @typedef {Object} DocumentoEstruturado
 * @property {1} schema
 * @property {ModeloEstruturado} modelo
 * @property {CabecalhoEstruturado} cabecalho
 * @property {SeccaoEstruturada[]} seccoes
 * @property {EntradaHistorico[]} historico   o «Histórico de revisões» do documento (não é uma secção)
 * @property {Object} [extras]  só do editor (processo, pastaId, modeloId, documentoId); os geradores ignoram-no
 */

export const SCHEMA_VERSAO = 1;

/** Modelos (= códigos de documento_classe) com editor estruturado. */
export const MODELOS = ['POP', 'PR', 'PL', 'MA', 'FR', 'LT', 'RE', 'DO'];

/** Nós ProseMirror permitidos. Os geradores só garantem estes. */
export const NOS_PERMITIDOS = [
  'doc', 'paragraph', 'text', 'heading', 'bulletList', 'orderedList', 'listItem',
  'table', 'tableRow', 'tableHeader', 'tableCell', 'image', 'hardBreak', 'horizontalRule', 'blockquote',
];
/** Marcas permitidas. */
export const MARCAS_PERMITIDAS = ['bold', 'italic', 'underline'];
/** Níveis de título permitidos dentro de uma secção (o título da secção é o nível principal). */
export const NIVEIS_TITULO = [2, 3, 4];

export const CAMPOS_CABECALHO = ['numero', 'titulo', 'revisao', 'data', 'aeroporto', 'aeroportoNome', 'elaboradoPor', 'verificadoPor', 'aprovadoPor', 'classificacao'];
/** Campos do cabeçalho sem os quais não se gera rascunho. */
export const CAMPOS_CABECALHO_OBRIGATORIOS = ['numero', 'titulo', 'revisao', 'data', 'aeroporto', 'elaboradoPor'];

export const ROTULO_CAMPO = {
  numero: 'Número', titulo: 'Título', revisao: 'Revisão', data: 'Data', aeroporto: 'Aeroporto',
  aeroportoNome: 'Nome do aeroporto', elaboradoPor: 'Elaborado por', verificadoPor: 'Verificado por',
  aprovadoPor: 'Aprovado por', classificacao: 'Classificação',
};

const RE_DATA = /^\d{4}-\d{2}-\d{2}/;
const RE_ICAO = /^[A-Z]{4}$/;
const RE_IMG_SRC = /^(data:image\/(png|jpe?g|gif|webp);base64,|https?:\/\/|\/)/i;

/** Documento ProseMirror vazio (um parágrafo vazio). */
export const docVazio = () => ({ type: 'doc', content: [{ type: 'paragraph' }] });

/** Data de hoje em ISO local (AAAA-MM-DD). */
export function hojeISO(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Cria a secção do contrato a partir da secção do modelo. */
export function seccaoDoModelo(s, i = 0) {
  return {
    id: `s${i + 1}-${s.chave}`,
    chave: s.chave,
    titulo: s.titulo,
    obrigatoria: !!s.obrigatoria,
    conteudo: docVazio(),
  };
}

/**
 * Documento estruturado novo a partir de um modelo ({ classe_codigo, schema: { seccoes: [...] } }).
 * Secções marcadas `automatica` (ex. histórico de revisões) não entram em `seccoes`: vêm de `historico`.
 */
export function novoDocumentoEstruturado(modelo, cabecalho = {}) {
  const seccoes = (modelo?.schema?.seccoes || []).filter(s => !s.automatica).map(seccaoDoModelo);
  return {
    schema: SCHEMA_VERSAO,
    modelo: modelo?.classe_codigo || 'POP',
    cabecalho: {
      numero: '', titulo: '', revisao: '00', data: hojeISO(), aeroporto: '', aeroportoNome: '',
      elaboradoPor: '', verificadoPor: '', aprovadoPor: '', classificacao: '',
      ...cabecalho,
    },
    seccoes,
    historico: [],
  };
}

/** Texto simples de um nó ProseMirror (para pesquisa, contagens e pré-visualizações). */
export function textoDoNo(no) {
  if (!no || typeof no !== 'object') return '';
  if (no.type === 'text') return String(no.text || '');
  if (no.type === 'hardBreak') return '\n';
  const filhos = Array.isArray(no.content) ? no.content.map(textoDoNo) : [];
  const bloco = ['paragraph', 'heading', 'listItem', 'tableRow', 'blockquote'].includes(no.type);
  return filhos.join(no.type === 'tableRow' ? ' | ' : '') + (bloco ? '\n' : '');
}

/** Uma secção conta como preenchida quando tem texto, uma imagem, uma tabela ou uma linha horizontal. */
export function conteudoVazio(conteudo) {
  if (!conteudo || typeof conteudo !== 'object') return true;
  let tem = false;
  const visitar = (n) => {
    if (tem || !n || typeof n !== 'object') return;
    if (n.type === 'image' || n.type === 'table' || n.type === 'horizontalRule') { tem = true; return; }
    if (n.type === 'text' && String(n.text || '').trim()) { tem = true; return; }
    if (Array.isArray(n.content)) n.content.forEach(visitar);
  };
  visitar(conteudo);
  return !tem;
}

/** Secções obrigatórias ainda por preencher (lista de { id, chave, titulo }). */
export function seccoesObrigatoriasEmFalta(doc) {
  return (doc?.seccoes || []).filter(s => s.obrigatoria && conteudoVazio(s.conteudo)).map(({ id, chave, titulo }) => ({ id, chave, titulo }));
}

/** Campos obrigatórios do cabeçalho em falta (lista de chaves). */
export function camposCabecalhoEmFalta(doc) {
  const c = doc?.cabecalho || {};
  return CAMPOS_CABECALHO_OBRIGATORIOS.filter(k => !String(c[k] ?? '').trim());
}

/**
 * Revisão seguinte: '00'→'01', '09'→'10', '99'→'100', '1'→'2' (mantém a largura), 'A'→'B'.
 * Vazio ou irreconhecível → '00'.
 */
export function proximaRevisao(rev) {
  const r = String(rev ?? '').trim();
  if (/^\d+$/.test(r)) return String(Number(r) + 1).padStart(r.length, '0');
  if (/^[A-Ya-y]$/.test(r)) return String.fromCharCode(r.charCodeAt(0) + 1);
  return '00';
}

function validarNo(no, caminho, erros) {
  if (!no || typeof no !== 'object' || typeof no.type !== 'string') { erros.push(`${caminho}: nó inválido`); return; }
  if (!NOS_PERMITIDOS.includes(no.type)) { erros.push(`${caminho}: nó «${no.type}» não é permitido`); return; }
  if (no.type === 'heading') {
    const lv = Number(no.attrs?.level);
    if (!NIVEIS_TITULO.includes(lv)) erros.push(`${caminho}: título de nível ${no.attrs?.level ?? '?'} (só 2 a 4)`);
  }
  if (no.type === 'image') {
    const src = String(no.attrs?.src || '');
    if (!RE_IMG_SRC.test(src)) erros.push(`${caminho}: imagem sem origem válida (data: URL de imagem ou URL do armazenamento)`);
  }
  if (no.type === 'text') {
    if (typeof no.text !== 'string') erros.push(`${caminho}: texto inválido`);
    for (const m of no.marks || []) {
      if (!MARCAS_PERMITIDAS.includes(m?.type)) erros.push(`${caminho}: marca «${m?.type}» não é permitida`);
    }
  }
  if (no.content !== undefined) {
    if (!Array.isArray(no.content)) { erros.push(`${caminho}: content tem de ser uma lista`); return; }
    no.content.forEach((f, i) => validarNo(f, `${caminho}/${f?.type || i}[${i}]`, erros));
  }
}

/**
 * Valida um documento estruturado contra o contrato.
 * `estrito` (por omissão false) junta como erros as secções obrigatórias vazias e os campos obrigatórios do
 * cabeçalho em falta — é o modo usado antes de «Gerar rascunho». Sem ele, só a forma é verificada (é o modo da
 * gravação automática: um rascunho a meio é válido).
 * @param {DocumentoEstruturado} doc
 * @returns {{ valido: boolean, erros: string[], avisos: string[] }}
 */
export function validarDocumentoEstruturado(doc, { estrito = false } = {}) {
  const erros = [];
  const avisos = [];
  if (!doc || typeof doc !== 'object') return { valido: false, erros: ['Documento vazio'], avisos };
  if (doc.schema !== SCHEMA_VERSAO) erros.push(`schema tem de ser ${SCHEMA_VERSAO}`);
  if (!MODELOS.includes(doc.modelo)) erros.push(`modelo «${doc.modelo}» desconhecido`);

  const c = doc.cabecalho;
  if (!c || typeof c !== 'object') erros.push('cabeçalho em falta');
  else {
    for (const k of CAMPOS_CABECALHO) if (c[k] !== undefined && c[k] !== null && typeof c[k] !== 'string') erros.push(`cabeçalho.${k} tem de ser texto`);
    if (c.data && !RE_DATA.test(c.data)) erros.push('cabeçalho.data tem de estar em ISO (AAAA-MM-DD)');
    if (c.aeroporto && !RE_ICAO.test(c.aeroporto)) avisos.push(`«${c.aeroporto}» não parece um código ICAO`);
    if (estrito) for (const k of camposCabecalhoEmFalta(doc)) erros.push(`Falta preencher: ${ROTULO_CAMPO[k] || k}`);
  }

  if (!Array.isArray(doc.seccoes)) erros.push('seccoes tem de ser uma lista');
  else {
    const ids = new Set();
    doc.seccoes.forEach((s, i) => {
      const onde = `seccoes[${i}]`;
      if (!s || typeof s !== 'object') { erros.push(`${onde}: inválida`); return; }
      if (!s.id) erros.push(`${onde}: sem id`);
      else if (ids.has(s.id)) erros.push(`${onde}: id repetido «${s.id}»`);
      ids.add(s.id);
      if (!s.chave) erros.push(`${onde}: sem chave`);
      if (!String(s.titulo || '').trim()) erros.push(`${onde}: sem título`);
      if (!s.conteudo || s.conteudo.type !== 'doc') erros.push(`${onde}: conteúdo tem de ser um documento ProseMirror (type 'doc')`);
      else validarNo(s.conteudo, `${onde}(${s.chave || i})`, erros);
    });
    if (estrito) for (const s of seccoesObrigatoriasEmFalta(doc)) erros.push(`Secção obrigatória por preencher: ${s.titulo}`);
  }

  if (!Array.isArray(doc.historico)) erros.push('historico tem de ser uma lista');
  else doc.historico.forEach((h, i) => {
    if (!h || typeof h !== 'object') { erros.push(`historico[${i}]: inválido`); return; }
    if (!String(h.revisao ?? '').trim()) erros.push(`historico[${i}]: sem revisão`);
    if (h.data && !RE_DATA.test(h.data)) erros.push(`historico[${i}]: data tem de estar em ISO`);
  });

  return { valido: erros.length === 0, erros, avisos };
}

/**
 * Prepara a revisão seguinte de um documento já gerado por este editor: aumenta a revisão, actualiza a data,
 * limpa quem verificou/aprovou (a nova revisão ainda não foi verificada) e acrescenta a entrada ao histórico.
 * Não altera o original.
 */
export function prepararNovaRevisao(doc, { descricao = '', autor = '', data = hojeISO() } = {}) {
  const revisao = proximaRevisao(doc?.cabecalho?.revisao);
  return {
    ...doc,
    cabecalho: { ...(doc?.cabecalho || {}), revisao, data, verificadoPor: '', aprovadoPor: '' },
    historico: [...(doc?.historico || []), { revisao, data, descricao: descricao || 'Revisão do documento', autor }],
  };
}

/** Entrada inicial do histórico (primeira emissão), se ainda não houver nenhuma. */
export function garantirHistoricoInicial(doc, { autor = '' } = {}) {
  if ((doc?.historico || []).length) return doc;
  const c = doc?.cabecalho || {};
  return { ...doc, historico: [{ revisao: c.revisao || '00', data: c.data || hojeISO(), descricao: 'Emissão inicial', autor: autor || c.elaboradoPor || '' }] };
}
