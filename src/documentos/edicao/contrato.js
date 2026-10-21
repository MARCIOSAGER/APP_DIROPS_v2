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

/*
 * Nós e atributos do conteúdo das secções (documento ProseMirror, { type: 'doc', content: [...] }):
 *
 *  - paragraph       attrs.textAlign?: 'left'|'center'|'right'|'justify'  (omisso/null = 'left')
 *  - heading         attrs.level: 2|3|4 (o título da secção é o nível 1); attrs.textAlign? como o paragraph.
 *                    Numeração automática «4.1», «4.1.1» (secção 4) — ver numerarTitulos em comum.js.
 *  - bulletList / orderedList → listItem (paragraph + listas aninhadas). Até 3 níveis de lista:
 *                    numerada 1. → a) → i.  ;  marcas • → – → ▪   (o nível conta listas de qualquer tipo).
 *                    orderedList.attrs.start? (número inicial, omisso = 1).
 *  - blockquote      caixa de destaque; attrs.tipo?: 'nota'|'atencao'|'aviso' (omisso/null = 'nota').
 *                    Rótulos: «Nota» (azul), «Atenção» (âmbar), «Aviso» (vermelho).
 *  - table           attrs.legenda?: string → «Tabela N — legenda» POR CIMA da tabela (numeração automática).
 *                    tableRow → tableHeader | tableCell (attrs.colspan, attrs.rowspan, attrs.colwidth).
 *                    tableHeader na 1.ª linha = linha de cabeçalho.
 *  - image           attrs.src (data:image/... base64 ou URL), attrs.alt?, attrs.title?, attrs.width? ('100%' ou px),
 *                    attrs.legenda?: string → «Figura N — legenda» POR BAIXO da imagem (numeração automática).
 *  - pageBreak       { type: 'pageBreak' } (bloco, sem conteúdo) → quebra de página.
 *  - horizontalRule, hardBreak, text.
 *  Marcas: bold, italic, underline.
 *  Só as tabelas/imagens com legenda não vazia são numeradas; a numeração corre o documento todo (todas as secções,
 *  por ordem) — ver numerarLegendas().
 */

export const SCHEMA_VERSAO = 1;

/** Modelos (= códigos de documento_classe) com editor estruturado. */
export const MODELOS = ['POP', 'PR', 'PL', 'MA', 'FR', 'LT', 'RE', 'NRM', 'DO'];

/** Nós ProseMirror permitidos. Os geradores só garantem estes. */
export const NOS_PERMITIDOS = [
  'doc', 'paragraph', 'text', 'heading', 'bulletList', 'orderedList', 'listItem',
  'table', 'tableRow', 'tableHeader', 'tableCell', 'image', 'hardBreak', 'horizontalRule', 'blockquote', 'pageBreak',
];
/** Alinhamentos de parágrafo/título (attrs.textAlign). Omisso = 'left'. */
export const ALINHAMENTOS = ['left', 'center', 'right', 'justify'];
/** Tipos de caixa de destaque (blockquote.attrs.tipo). Omisso = 'nota'. */
export const TIPOS_CAIXA = ['nota', 'atencao', 'aviso'];
export const ROTULO_CAIXA = { nota: 'Nota', atencao: 'Atenção', aviso: 'Aviso' };
/** Profundidade máxima de listas aninhadas. */
export const NIVEIS_LISTA_MAX = 3;
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

/** Tipo de caixa efectivo de um blockquote (omisso ou desconhecido → 'nota'). */
export function tipoCaixa(no) {
  const t = no?.attrs?.tipo;
  return TIPOS_CAIXA.includes(t) ? t : 'nota';
}

/** Alinhamento efectivo de um parágrafo/título (omisso ou desconhecido → 'left'). */
export function alinhamentoDe(no) {
  const a = no?.attrs?.textAlign;
  return ALINHAMENTOS.includes(a) ? a : 'left';
}

/**
 * Numeração automática das legendas: percorre o documento por ordem (todas as secções de um DocumentoEstruturado,
 * ou um único doc ProseMirror) e devolve um Map nó → 'Figura N' (image) / 'Tabela N' (table). Só entram os nós com
 * attrs.legenda não vazia; figuras e tabelas têm contadores separados. A chave é o próprio objecto do nó (o mesmo
 * que os geradores percorrem). O texto final é `${map.get(no)} — ${legenda}`.
 * @param {DocumentoEstruturado|Object} doc
 * @returns {Map<Object, string>}
 */
export function numerarLegendas(doc) {
  const mapa = new Map();
  let fig = 0;
  let tab = 0;
  const visitar = (n) => {
    if (!n || typeof n !== 'object') return;
    const legenda = String(n.attrs?.legenda ?? '').trim();
    if (legenda && n.type === 'image') mapa.set(n, `Figura ${++fig}`);
    else if (legenda && n.type === 'table') mapa.set(n, `Tabela ${++tab}`);
    if (Array.isArray(n.content)) n.content.forEach(visitar);
  };
  if (Array.isArray(doc?.seccoes)) doc.seccoes.forEach(s => visitar(s?.conteudo));
  else visitar(doc);
  return mapa;
}

/** Texto completo da legenda («Figura 2 — Planta da placa») ou '' se o nó não tiver legenda. */
export function textoLegenda(mapa, no) {
  const r = mapa?.get?.(no);
  return r ? `${r} — ${String(no.attrs.legenda).trim()}` : '';
}

/** Quantas figuras e tabelas legendadas há nas secções anteriores à secção `indice` (para continuar a numeração). */
export function legendasAntesDe(doc, indice) {
  let figuras = 0;
  let tabelas = 0;
  (doc?.seccoes || []).slice(0, Math.max(0, indice)).forEach(s => {
    for (const r of numerarLegendas(s?.conteudo).values()) { if (r.startsWith('Figura')) figuras++; else tabelas++; }
  });
  return { figuras, tabelas };
}

const TIPOS_LISTA = ['bulletList', 'orderedList'];

function validarNo(no, caminho, erros, avisos = [], nivelLista = 0) {
  if (!no || typeof no !== 'object' || typeof no.type !== 'string') { erros.push(`${caminho}: nó inválido`); return; }
  if (!NOS_PERMITIDOS.includes(no.type)) { erros.push(`${caminho}: nó «${no.type}» não é permitido`); return; }
  if (no.type === 'paragraph' || no.type === 'heading') {
    const a = no.attrs?.textAlign;
    if (a !== undefined && a !== null && !ALINHAMENTOS.includes(a)) erros.push(`${caminho}: alinhamento «${a}» não é permitido`);
  }
  if (no.type === 'blockquote') {
    const t = no.attrs?.tipo;
    if (t !== undefined && t !== null && !TIPOS_CAIXA.includes(t)) erros.push(`${caminho}: caixa do tipo «${t}» não é permitida (nota, atencao, aviso)`);
  }
  if ((no.type === 'image' || no.type === 'table') && no.attrs?.legenda !== undefined && no.attrs?.legenda !== null && typeof no.attrs.legenda !== 'string') {
    erros.push(`${caminho}: legenda tem de ser texto`);
  }
  if (no.type === 'pageBreak' && Array.isArray(no.content) && no.content.length) erros.push(`${caminho}: a quebra de página não tem conteúdo`);
  if (TIPOS_LISTA.includes(no.type)) {
    nivelLista += 1;
    if (nivelLista === NIVEIS_LISTA_MAX + 1) avisos.push(`${caminho}: lista com mais de ${NIVEIS_LISTA_MAX} níveis (os níveis a mais saem como o 3.º)`);
  }
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
    no.content.forEach((f, i) => validarNo(f, `${caminho}/${f?.type || i}[${i}]`, erros, avisos, nivelLista));
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
      else validarNo(s.conteudo, `${onde}(${s.chave || i})`, erros, avisos);
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
