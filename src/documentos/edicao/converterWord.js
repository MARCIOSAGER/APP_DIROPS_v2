// «Converter para o editor»: lê um .docx (POP, PR, PL, LT…) e devolve um documento estruturado (contrato.js) com o
// relatório da conversão. Lógica pura e testável — sem React nem rede. O mammoth só se carrega aqui, por import
// dinâmico, para não pesar no pacote principal.
//
// Etapas:
//  1. mammoth → HTML. Os estilos do Word são classificados por nome (Título/Heading 1-4, estilos próprios com
//     «Título»/«Capítulo»/«Heading» no nome → títulos com o nível inferido do padrão; «Title» → título do documento;
//     toc*/índice → descartado; Caption/Legenda → legenda). O alinhamento do Word passa por marcadores no texto.
//     Imagens → data: URL reduzidas (imagens.js), com limite de tamanho total.
//  2. Limpeza do HTML: índice (ligações #_Toc), «intencionalmente em branco», tabulações, numeração dos títulos,
//     legendas «Figura n —»/«Tabela n —» junto à imagem/tabela, «NOTA:»/«ATENÇÃO:»/«AVISO:» → caixas.
//  3. Partir em blocos pelos títulos de nível 1. O que vem antes do primeiro título (capa, controlo de revisões,
//     lista de distribuição, índice, páginas efectivas, acto de aprovação) é descartado — os geradores fazem as suas —
//     mas o histórico de revisões, se estiver numa tabela «Revisão | Data | Descrição», passa para `historico`.
//  4. Cada bloco: limparHtmlColado + generateJSON(extensoesContrato()) → conteúdo ProseMirror do contrato.
//  5. Encaixe nas secções do modelo por semelhança de título (acentos/maiúsculas/sinónimos). Vários blocos podem cair
//     na mesma secção (cada um com o título original como título de nível 2); o que não encaixa fica como secção
//     extra (obrigatoria:false) na posição em que estava no Word. O mapeamento pode ser mudado (montarDocumento).
import { generateJSON } from '@tiptap/core';
import { extensoesContrato } from './extensoes';
import { limparHtmlColado } from './limparColagem';
import { docVazio, hojeISO, prepararNovaRevisao, proximaRevisao, textoDoNo, SCHEMA_VERSAO } from './contrato';
import { reduzirImagemSrc } from './imagens';

/** Classes de documento que NÃO se convertem: formulários (paginação, caixas, campos) e manuais (editor Word). */
export const CLASSES_SEM_CONVERSAO = ['FR', 'FX', 'MQ', 'MA'];
export const CLASSES_FORMULARIO = ['FR', 'FX', 'MQ'];
/** Tamanho máximo (em caracteres de data: URL) de todas as imagens juntas no rascunho. */
export const LIMITE_IMAGENS_TOTAL = 8 * 1024 * 1024;
/** Uma imagem que, já reduzida, passe disto conta como «grande» no relatório. */
export const IMAGEM_GRANDE = 600 * 1024;
export const DESCRICAO_CONVERSAO = 'Conversão do Word para o editor estruturado';

// ── texto ───────────────────────────────────────────────────────────────────
/** minúsculas, sem acentos, sem pontuação, espaços simples */
export function normalizarTitulo(t) {
  return String(t || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Caracteres não brancos (medida do texto preservado). */
const contarTexto = (t) => String(t || '').replace(/\s+/g, '').length;

/** Caracteres não brancos dos nós de texto de um conteúdo ProseMirror (sem separadores de tabela). */
export function contarTextoNo(n) {
  if (!n || typeof n !== 'object') return 0;
  if (n.type === 'text') return contarTexto(n.text);
  const legenda = n.attrs?.legenda ? contarTexto(n.attrs.legenda) : 0;
  return legenda + (Array.isArray(n.content) ? n.content.reduce((k, f) => k + contarTextoNo(f), 0) : 0);
}

const RE_NUM_TITULO =/^\s*(?:(?:cap[ií]tulo|chapter)\s+(?:\d+|[ivxlc]+)\s*(?:[-–—.:]\s*)?|(?:\d+(?:\.\d+)*\.?|[ivxlc]+\.|[a-z]\)|[a-z]\.)(?=\s|$)\s*|[-–—•·]\s+)/i;

/** Tira a numeração escrita do título («1.  OBJECTIVO», «3.1 Manuais», «CAPÍTULO 2 - X», «- INTRODUÇÃO»). */
export function limparTitulo(t) {
  let s = String(t || '').replace(/[\t ]+/g, ' ').replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 3; i++) {
    const n = s.replace(RE_NUM_TITULO, '').trim();
    if (n === s || !n) break;
    s = n;
  }
  return s.replace(/\s*[:.]\s*$/, '').trim();
}

// ── estilos do Word ─────────────────────────────────────────────────────────
const RE_TOC = /^(toc|table of contents|table of figures|índice|indice|sumário|sumario)\b/i;
const RE_NAO_TITULO = /par\.|par[aá]grafo|em branco|corpo|body|list|lista|legenda|caption|toc|índice|indice|sum[aá]rio|tabela|table|rodap|header|footer|cabe[cç]alho|nota/i;

/**
 * Classifica um estilo de parágrafo do Word pelo nome. Devolve
 *  { tipo: 'titulo', nivel } | { tipo: 'toc' } | { tipo: 'tituloDocumento' } | { tipo: 'legenda' } | null.
 * Exportado para os testes.
 */
export function classificarEstilo(nome) {
  const n = String(nome || '').trim();
  if (!n) return null;
  const m = /^(?:heading|t[ií]tulo)\s*([1-9])$/i.exec(n);
  if (m) return { tipo: 'titulo', nivel: Number(m[1]) };
  if (RE_TOC.test(n)) return { tipo: 'toc' };
  if (/^(title|t[ií]tulo|subtitle|subt[ií]tulo)$/i.test(n)) return { tipo: 'tituloDocumento' };
  if (/^(caption|legenda)$/i.test(n)) return { tipo: 'legenda' };
  if (!/t[ií]tulo|heading|cap[ií]tulo|chapter|title/i.test(n)) return null;
  if (RE_NAO_TITULO.test(n.replace(/t[ií]tulo|title|heading/gi, ''))) return null;
  // estilos próprios: o nível sai do padrão escrito no nome
  if (/cap[ií]tulo|chapter/i.test(n)) return { tipo: 'titulo', nivel: 1 };
  if (/\b\d+\.\d+\.\d+/.test(n)) return { tipo: 'titulo', nivel: 3 };
  if (/\b\d+\.\d+\b/.test(n)) return { tipo: 'titulo', nivel: 2 };
  if (/\(\d+\)|(^|\s)[a-z]\.(\s|$)|(^|\s)[ivx]+\.(\s|$)/i.test(n)) return { tipo: 'titulo', nivel: 4 };
  const fim = /\b([1-4])\s*$/.exec(n);
  if (fim) return { tipo: 'titulo', nivel: Number(fim[1]) };
  return { tipo: 'titulo', nivel: 1 };
}

/**
 * Níveis das listas pela indentação. Muitos Word numeram todos os níveis com o mesmo nível de lista (ilvl 0) e
 * fazem o «a)» e o «(i)» só com o recuo do parágrafo; o mammoth achataria tudo num nível. Em cada sequência de
 * parágrafos numerados (os vazios não a cortam), se os recuos distinguem mais níveis do que o Word declarou, o nível
 * passa a ser a ordem do recuo (0, 1, 2 — o contrato vai até 3 níveis). Percorre também as células das tabelas.
 */
/** Parágrafo que vai sair como título (estilo de título e não parece frase) — os títulos numerados não são listas. */
function ehTituloMammoth(p) {
  const cls = classificarEstilo(p.styleName || '');
  if (cls?.tipo !== 'titulo') return false;
  return !pareceFrase(textoParagrafoMammoth(p), { proprio: !/^(heading|t[ií]tulo)\s*[1-9]$/i.test(p.styleName || '') });
}

export function ajustarNiveisListas(no) {
  const filhos = no?.children;
  if (!Array.isArray(filhos)) return no;
  // recuo em «degraus» de ~2 mm (120 twips): 425 e 426 são o mesmo recuo
  const recuo = (p) => Math.round((Number(p.indent?.start ?? p.indent?.left ?? 0) || 0) / 120);
  const vazioP = (p) => p.type === 'paragraph' && !p.numbering && !textoParagrafoMammoth(p) && !JSON.stringify(p.children || []).includes('"image"');
  const fechar = (seq) => {
    if (!seq.length) return;
    const recuos = [...new Set(seq.map(recuo))].sort((a, b) => a - b);
    const nivelWord = (p) => Number(p.numbering.level ?? 0) || 0;
    const niveis = [...new Set(seq.map(nivelWord))].sort((a, b) => a - b);
    // o recuo distingue mais níveis do que o Word declarou → manda o recuo; senão os níveis do Word (sem buracos)
    const porRecuo = recuos.length > niveis.length;
    // nunca saltar níveis (o mammoth criaria itens vazios a fazer de pais): no máximo um a mais que o anterior
    let anterior = -1;
    for (const p of seq) {
      // relativo ao primeiro item da sequência (que é sempre nível 0)
      const base = Math.max(0, porRecuo ? recuos.indexOf(recuo(p)) - recuos.indexOf(recuo(seq[0])) : niveis.indexOf(nivelWord(p)) - niveis.indexOf(nivelWord(seq[0])));
      const nivel = Math.min(2, base, anterior + 1);
      if (String(nivel) !== String(p.numbering.level)) p.numbering = { ...p.numbering, level: String(nivel) };
      anterior = nivel;
    }
  };
  let seq = [];
  for (const f of filhos) {
    if (f?.type === 'paragraph' && f.numbering && !ehTituloMammoth(f)) { seq.push(f); continue; }
    if (f?.type === 'paragraph' && vazioP(f)) continue;
    fechar(seq);
    seq = [];
    if (f && f.type !== 'paragraph') ajustarNiveisListas(f);
  }
  fechar(seq);
  return no;
}

/** Texto de um parágrafo do modelo interno do mammoth (runs → text/tab). */
export function textoParagrafoMammoth(p) {
  let t = '';
  const visitar = (n) => {
    if (!n) return;
    if (n.type === 'text') t += n.value || '';
    else if (n.type === 'tab') t += ' ';
    else if (Array.isArray(n.children)) n.children.forEach(visitar);
  };
  visitar(p);
  return t.replace(/\s+/g, ' ').trim();
}

/**
 * Um parágrafo com estilo de título que é, na verdade, texto: termina em «;»/«,»/« e», ou é comprido demais.
 * Nos estilos próprios (não «Título N» do Word) também conta o ponto final num texto longo.
 */
export function pareceFrase(texto, { proprio = false } = {}) {
  const t = String(texto || '').trim();
  if (!t) return false;
  if (/[;,]$|\s(e|ou)$/i.test(t)) return true;
  if (t.length > (proprio ? 110 : 200)) return true;
  if (proprio && t.length > 60 && /[.:]$/.test(t)) return true;
  return false;
}

const ESTILOS_COMUNS =/^(normal|list paragraph|body text( \d)?|no spacing|normal \(web\)|table paragraph|default|default paragraph font|estilo\d*|corpo de texto|par[aá]grafo da lista|sem espa[cç]amento|footnote text|header|footer)$/i;

const MARCA_AL = '';
const FIM_AL = '';
const ALINHAMENTO_WORD = { center: 'center', right: 'right', end: 'right', both: 'justify', distribute: 'justify' };

const STYLE_MAP = [
  "p[style-name='gd-h1'] => h1:fresh",
  "p[style-name='gd-h2'] => h2:fresh",
  "p[style-name='gd-h3'] => h3:fresh",
  "p[style-name='gd-h4'] => h4:fresh",
  "p[style-name='gd-h5'] => p.gd-forte:fresh",
  "p[style-name='gd-toc'] => !",
  "p[style-name='gd-titulo-doc'] => p.gd-titulo-doc:fresh",
  "p[style-name='gd-legenda'] => p.gd-legenda:fresh",
  "r[style-name='Strong'] => strong",
  "r[style-name='Forte'] => strong",
];

// ── secções do modelo: sinónimos ────────────────────────────────────────────
const SINONIMOS = {
  objectivo: ['objectivo', 'objetivo', 'objectivos', 'objetivos', 'finalidade', 'proposito', 'objecto', 'objeto'],
  objecto: ['objecto', 'objeto', 'objectivo', 'objetivo', 'finalidade'],
  ambito: ['ambito', 'aplicabilidade', 'area de aplicacao', 'areas de aplicacao', 'ambito de aplicacao', 'campo de aplicacao', 'escopo', 'ambito e aplicabilidade', 'aplicacao'],
  referencias: ['referencias', 'documentos de referencia', 'referencias normativas', 'legislacao', 'normas de referencia', 'bibliografia', 'documentos relacionados', 'legislacao aplicavel', 'referencias e legislacao'],
  definicoes: ['definicoes', 'abreviaturas', 'siglas', 'acronimos', 'definicoes e abreviaturas', 'terminologia', 'glossario', 'definicoes e siglas', 'siglas e abreviaturas', 'termos e definicoes', 'definicoes e acronimos'],
  responsabilidades: ['responsabilidades', 'responsabilidade', 'atribuicoes', 'responsabilidades e autoridades', 'funcoes e responsabilidades'],
  organizacao: ['organizacao', 'organizacao e responsabilidades', 'responsabilidades', 'estrutura organizacional', 'organizacao do plano'],
  procedimento: ['procedimento', 'procedimentos', 'descricao', 'descricao do procedimento', 'desenvolvimento', 'modo operatorio', 'metodologia', 'descricao das actividades', 'descricao das atividades'],
  accoes: ['accoes', 'acoes', 'accoes e procedimentos', 'procedimentos', 'procedimento', 'procedimentos em caso de emergencia', 'resposta'],
  actividades: ['actividades', 'atividades', 'actividades e calendario', 'calendario', 'programacao', 'programacao anual', 'cronograma', 'plano de actividades'],
  monitorizacao: ['monitorizacao', 'monitorizacao e indicadores', 'indicadores', 'avaliacao', 'acompanhamento', 'monitoramento'],
  comunicacoes: ['comunicacoes', 'comunicacao', 'contactos', 'meios de comunicacao'],
  registos: ['registos', 'registros', 'registo', 'registro', 'arquivo', 'registos e arquivo'],
  anexos: ['anexos', 'anexo', 'apendices', 'apendice', 'lista de anexos'],
  introducao: ['introducao', 'apresentacao', 'generalidades', 'enquadramento', 'nota introdutoria'],
  disposicoes: ['disposicoes', 'disposicoes gerais', 'articulado', 'normas'],
  sancoes: ['sancoes', 'incumprimento', 'incumprimento e sancoes', 'penalidades'],
  entrada_vigor: ['entrada em vigor', 'vigencia', 'disposicoes finais'],
  lista: ['lista', 'lista de contactos', 'contactos', 'itens', 'lista de verificacao'],
  conteudo: ['conteudo'],
  partes: ['partes', 'enquadramento', 'partes envolvidas'],
};

/** Semelhança (0..1) entre um título do Word e uma secção do modelo ({ chave, titulo }). */
export function semelhancaTitulo(tituloWord, seccao) {
  const t = normalizarTitulo(limparTitulo(tituloWord));
  if (!t) return 0;
  const candidatos = [normalizarTitulo(seccao?.titulo), ...(SINONIMOS[seccao?.chave] || [])].filter(Boolean);
  let melhor = 0;
  const palavrasT = new Set(t.split(' ').filter(p => p.length > 2));
  for (const c of candidatos) {
    if (t === c) return 1;
    // «Objectivo geral», «Referências normativas e legislação»: o título começa pelo sinónimo
    if (t.startsWith(`${c} `)) {
      // «Referências normativas» é forte; «Aplicabilidade e teor dos treinamentos» já é outra coisa
      const aMais = t.slice(c.length).trim().split(' ').filter(p => p.length > 2).length;
      melhor = Math.max(melhor, aMais <= 1 ? 0.85 : 0.62);
    } else if (c.startsWith(`${t} `)) melhor = Math.max(melhor, 0.8);
    else if (` ${t} `.includes(` ${c} `) && c.length >= 6) melhor = Math.max(melhor, 0.7);
    const palavrasC = new Set(c.split(' ').filter(p => p.length > 2));
    if (palavrasC.size && palavrasT.size) {
      let comuns = 0;
      for (const p of palavrasC) if (palavrasT.has(p)) comuns++;
      const j = comuns / new Set([...palavrasC, ...palavrasT]).size;
      melhor = Math.max(melhor, j);
    }
  }
  return melhor;
}

export const LIMIAR_ENCAIXE = 0.6;

/** Secções do modelo que se escrevem à mão (sem o histórico automático). */
export const seccoesDoModelo = (modelo) => (modelo?.schema?.seccoes || []).filter(s => !s.automatica);

/** Melhor secção do modelo para um título do Word → { chave, confianca } ou { chave: null }. */
export function encaixarTitulo(tituloWord, modelo) {
  let melhor = { chave: null, confianca: 0 };
  for (const s of seccoesDoModelo(modelo)) {
    const c = semelhancaTitulo(tituloWord, s);
    if (c > melhor.confianca) melhor = { chave: s.chave, confianca: c };
  }
  return melhor.confianca >= LIMIAR_ENCAIXE ? melhor : { chave: null, confianca: melhor.confianca };
}

// ── páginas do Word que os geradores fazem sozinhos ─────────────────────────
const PRELIMINARES = [
  { tipo: 'indice', re: /^(?:[a-z]\s*[-–—.)]\s*)?(?:indice|sumario|conteudo|table of contents|contents)(?:\s|$)/ },
  { tipo: 'revisoes', re: /^(?:[a-z]\s*[-–—.)]\s*)?(?:controlo|controle|registo|registro|historico|quadro|folha|lista) (?:de |das |dos )?(?:revis|alterac|actualizac|atualizac|emend|modificac|edic)/ },
  { tipo: 'revisoes', re: /^(?:[a-z]\s*[-–—.)]\s*)?(?:revisoes|historico|alteracoes)$/ },
  { tipo: 'distribuicao', re: /^(?:[a-z]\s*[-–—.)]\s*)?(?:lista|controlo|controle|registo|quadro) de distribuicao/ },
  { tipo: 'controlo', re: /^(?:[a-z]\s*[-–—.)]\s*)?folha de (?:controlo|controle|rosto|aprovacao|assinaturas)/ },
  { tipo: 'paginas', re: /^(?:[a-z]\s*[-–—.)]\s*)?(?:lista|registo|controlo|controle) (?:de |das )?paginas/ },
  { tipo: 'paginas', re: /^paginas efectivas|^paginas efetivas/ },
  { tipo: 'aprovacao', re: /^(?:[a-z]\s*[-–—.)]\s*)?(?:acto|ato|termo|despacho|pagina) de aprovacao/ },
  { tipo: 'branco', re: /intencionalmente (?:deixada )?em branco|pagina em branco/ },
];
export const ROTULO_DESCARTE = {
  capa: 'Capa', indice: 'Índice', revisoes: 'Controlo de revisões', distribuicao: 'Lista de distribuição',
  controlo: 'Folha de controlo', paginas: 'Lista de páginas efectivas', aprovacao: 'Acto de aprovação',
  branco: 'Página em branco', tituloDocumento: 'Título do documento', assinatura: 'Assinatura final',
};

/** Tipo de página preliminar (índice, controlo de revisões, …) pelo título, ou null. */
export function tipoPreliminar(titulo) {
  // «A – ÍNDICE», «B. Controlo de revisões»: a letra de ordem não conta
  const t = normalizarTitulo(limparTitulo(titulo)).replace(/^[a-z] (?=\S{3})/, '');
  if (!t || t.length > 80) return null;
  for (const p of PRELIMINARES) if (p.re.test(t)) return p.tipo;
  return null;
}

// ── histórico de revisões ───────────────────────────────────────────────────
const RE_COL_REV = /^(rev|revisao|revisoes|edicao|versao|n revisao|n da revisao|no revisao|nr revisao|n o revisao|ed|emenda|n)$/;
const MESES = { jan: 1, fev: 2, feb: 2, mar: 3, abr: 4, apr: 4, mai: 5, may: 5, jun: 6, jul: 7, ago: 8, aug: 8, set: 9, sep: 9, out: 10, oct: 10, nov: 11, dez: 12, dec: 12 };

/** Data do Word → ISO (AAAA-MM-DD) ou '' (dd/mm/aa, dd-mm-aaaa, aaaa-mm-dd, «12 de Março de 2024», «Mar 2024»). */
export function dataParaISO(texto) {
  const t = String(texto || '').trim();
  const p = (n) => String(n).padStart(2, '0');
  const ano = (a) => { const n = Number(a); return a.length <= 2 ? (n > 70 ? 1900 + n : 2000 + n) : n; };
  let m = /(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(t);
  if (m) return `${m[1]}-${p(m[2])}-${p(m[3])}`;
  m = /(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/.exec(t);
  if (m && Number(m[2]) <= 12) return `${ano(m[3])}-${p(m[2])}-${p(m[1])}`;
  const n = normalizarTitulo(t);
  m = /(?:(\d{1,2}) (?:de )?)?([a-z]{3})[a-z]* (?:de )?(\d{4})/.exec(n);
  if (m && MESES[m[2]]) return `${m[3]}-${p(MESES[m[2]])}-${p(m[1] || 1)}`;
  return '';
}

const textoCelula = (c) => {
  const ps = c?.querySelectorAll ? [...c.querySelectorAll('p,li')] : [];
  const t = ps.length ? ps.map(p => p.textContent).join(' ') : String(c?.textContent || '');
  return t.replace(/[\t ]+/g, ' ').replace(/\s+/g, ' ').trim();
};

/**
 * Lê uma tabela «Revisão | Data | Descrição [| Autor]» → lista de EntradaHistorico, ou null se a tabela não for de
 * revisões. Aceita a primeira linha como cabeçalho.
 */
export function historicoDeTabela(tabela) {
  const linhas = [...(tabela?.querySelectorAll?.('tr') || [])].filter(tr => tr.closest('table') === tabela);
  if (linhas.length < 2) return null;
  const cab = [...linhas[0].children].map(c => normalizarTitulo(textoCelula(c)));
  const iRev = cab.findIndex(c => RE_COL_REV.test(c) || /^(n )?(da )?revis/.test(c));
  const iData = cab.findIndex(c => /^data/.test(c));
  const iDesc = cab.findIndex(c => /descri|alterac|actualizac|atualizac|natureza|motivo|modifica|observ|assunto|conteudo/.test(c));
  // a revisão abre a tabela (1.ª ou 2.ª coluna) e vem antes da descrição — senão é outra tabela (p.ex. lista de anexos)
  if (iRev < 0 || iData < 0 || iDesc < 0 || iRev > 1 || iRev > iDesc) return null;
  const iAutor = cab.findIndex(c => /autor|elaborad|responsav|executad|redigid|nome/.test(c));
  const entradas = [];
  for (const tr of linhas.slice(1)) {
    const cel = [...tr.children].map(textoCelula);
    const revisao = cel[iRev] || '';
    const descricao = cel[iDesc] || '';
    if (!revisao && !descricao) continue;
    if (!revisao) continue;
    entradas.push({
      revisao: /^\d$/.test(revisao) ? revisao.padStart(2, '0') : revisao,
      data: dataParaISO(cel[iData] || ''),
      descricao,
      autor: iAutor >= 0 ? cel[iAutor] || '' : '',
    });
  }
  return entradas;
}

// ── DOM ─────────────────────────────────────────────────────────────────────
function novoDom(html) {
  if (typeof DOMParser === 'undefined') throw new Error('A conversão do Word precisa de um navegador (DOMParser).');
  return new DOMParser().parseFromString(`<!doctype html><html><body>${html}</body></html>`, 'text/html');
}

const textoDe = (el) => String(el?.textContent || '').replace(/[ ]/g, ' ');
const vazio = (el) => !textoDe(el).trim() && !el.querySelector?.('img,table');

/** Marcadores de alinhamento → atributo style no bloco; tira os que sobrarem. */
function aplicarAlinhamentos(body) {
  const re = new RegExp(`${MARCA_AL}([a-z]+)${FIM_AL}`, 'g');
  const walker = body.ownerDocument.createTreeWalker(body, 4 /* NodeFilter.SHOW_TEXT */);
  const nos = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.nodeValue.includes(MARCA_AL)) nos.push(n);
  for (const n of nos) {
    let al = null;
    n.nodeValue = n.nodeValue.replace(re, (_, a) => { al = a; return ''; });
    const bloco = n.parentElement?.closest('p,h1,h2,h3,h4,h5,h6');
    if (al && bloco && !bloco.closest('li')) bloco.setAttribute('style', `text-align: ${al}`);
  }
}

/** Ligações do índice do Word: parágrafos/itens que são só uma entrada do índice. */
function removerIndice(body, rel) {
  const ehToc = (el) => {
    const a = el.querySelector('a[href^="#_Toc" i], a[href^="#_TOC" i], a[href^="#_Ref" i]');
    if (!a) return false;
    const t = textoDe(el).trim();
    const ta = textoDe(a).trim();
    return ta.length >= t.length * 0.6 || /\s\d{1,3}\s*$/.test(t);
  };
  let n = 0;
  // listas que são índice (a maioria dos itens são entradas): sai a lista toda
  body.querySelectorAll('ol,ul').forEach(l => {
    if (!l.isConnected || l.parentElement?.closest('ol,ul')) return;
    const itens = [...l.querySelectorAll('li')];
    const tocs = itens.filter(ehToc).length;
    if (itens.length && tocs / itens.length >= 0.5) { n += textoDe(l).length; l.remove(); }
  });
  body.querySelectorAll('p').forEach(p => { if (p.isConnected && ehToc(p)) { n += textoDe(p).length; p.remove(); } });
  if (n) rel.descartados.push({ tipo: 'indice', titulo: ROTULO_DESCARTE.indice, caracteres: n });
}

/** Ligações internas, marcadores (bookmarks), tabulações. */
function limparMiudezas(body) {
  body.querySelectorAll('a').forEach(a => {
    const href = a.getAttribute('href') || '';
    if (!a.textContent && !a.querySelector('img')) { a.remove(); return; }
    if (!href || href.startsWith('#')) { while (a.firstChild) a.parentNode.insertBefore(a.firstChild, a); a.remove(); }
  });
  const walker = body.ownerDocument.createTreeWalker(body, 4);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (/[\t]/.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(/\t+/g, ' ');
  }
  // sup/sub: o contrato não tem estas marcas; o texto fica
  body.querySelectorAll('sup,sub,s,del').forEach(el => { while (el.firstChild) el.parentNode.insertBefore(el.firstChild, el); el.remove(); });
  // parágrafos estilo «forte» (títulos de nível 5/6) → negrito
  body.querySelectorAll('p.gd-forte').forEach(p => { const b = p.ownerDocument.createElement('strong'); while (p.firstChild) b.appendChild(p.firstChild); p.appendChild(b); p.removeAttribute('class'); });
}

const RE_LEGENDA = /^\s*(figura|fig\.?|imagem|ilustra[cç][aã]o|gr[aá]fico|tabela|quadro)\s*(?:n\.?\s*[ºo°]?\s*)?(\d+(?:[.-]\d+)?)?\s*[-–—:.]?\s*(.*)$/i;

/** Parágrafo de legenda («Figura 2 – Planta», «Tabela 1: …») → { tipo: 'figura'|'tabela', texto } ou null. */
export function lerLegenda(texto, { exigirNumero = true } = {}) {
  const t = String(texto || '').replace(/\s+/g, ' ').trim();
  if (!t || t.length > 220) return null;
  const m = RE_LEGENDA.exec(t);
  if (!m) return null;
  if (exigirNumero && !m[2]) return null;
  const resto = String(m[3] || '').trim();
  if (!resto) return null;
  const tipo = /tabela|quadro/i.test(m[1]) ? 'tabela' : 'figura';
  return { tipo, texto: resto };
}

/** Imagens sozinhas num parágrafo + legendas vizinhas → <figure>/<table data-legenda>. */
function tratarLegendas(body, rel) {
  const dom = body.ownerDocument;
  const proximoBloco = (el, dir) => { let s = dir > 0 ? el.nextElementSibling : el.previousElementSibling; while (s && vazio(s) && s.tagName === 'P') s = dir > 0 ? s.nextElementSibling : s.previousElementSibling; return s; };
  const legendaDe = (el, tipo) => {
    if (!el || el.tagName !== 'P') return null;
    const l = lerLegenda(textoDe(el), { exigirNumero: !el.classList.contains('gd-legenda') });
    return l && l.tipo === tipo ? l : null;
  };
  // tabelas: legenda por cima (habitual) ou por baixo
  body.querySelectorAll('table').forEach(tb => {
    if (tb.parentElement?.closest('table')) return;
    for (const dir of [-1, 1]) {
      const viz = proximoBloco(tb, dir);
      const l = legendaDe(viz, 'tabela');
      if (l) { tb.setAttribute('data-legenda', l.texto); viz.remove(); rel.legendas++; break; }
    }
  });
  // imagens: só as que estão sozinhas num parágrafo (ou soltas no corpo)
  body.querySelectorAll('img').forEach(img => {
    if (img.closest('table,li')) return;
    let bloco = img.parentElement;
    if (bloco === body) { const p = dom.createElement('p'); img.replaceWith(p); p.appendChild(img); bloco = p; }
    if (!bloco || bloco.tagName !== 'P' || textoDe(bloco).trim() || bloco.querySelectorAll('img').length !== 1) return;
    for (const dir of [1, -1]) {
      const viz = proximoBloco(bloco, dir);
      const l = legendaDe(viz, 'figura');
      if (l) {
        const fig = dom.createElement('figure');
        const cap = dom.createElement('figcaption');
        cap.textContent = l.texto;
        fig.appendChild(img);
        fig.appendChild(cap);
        bloco.replaceWith(fig);
        viz.remove();
        rel.legendas++;
        break;
      }
    }
  });
  // legendas do estilo «Legenda» que ficaram sozinhas → parágrafo normal em itálico
  body.querySelectorAll('p.gd-legenda').forEach(p => { p.removeAttribute('class'); const i = dom.createElement('em'); while (p.firstChild) i.appendChild(p.firstChild); p.appendChild(i); });
}

/**
 * Lista numerada interrompida só por uma imagem (ou parágrafos vazios): no Word a numeração continua («1.», imagem,
 * «2.»); o mammoth abre uma lista nova a contar do 1 → a segunda lista recebe start.
 */
function continuarNumeracao(body) {
  const soImagem = (el) => el && ((el.tagName === 'P' && !textoDe(el).trim()) || el.tagName === 'FIGURE');
  [...body.children].forEach(ol => {
    if (ol.tagName !== 'OL') return;
    let el = ol.previousElementSibling;
    let viuImagem = false;
    while (soImagem(el)) { if (el.querySelector?.('img') || el.tagName === 'FIGURE') viuImagem = true; el = el.previousElementSibling; }
    if (!viuImagem || el?.tagName !== 'OL') return;
    const inicio = Number(el.getAttribute('start')) || 1;
    const itens = [...el.children].filter(c => c.tagName === 'LI').length;
    ol.setAttribute('start', String(inicio + itens));
  });
}

const CAIXAS_TEXTO = [
  { tipo: 'aviso', re: /^\s*(aviso|perigo|importante)\s*[:!–—-]\s*/i },
  { tipo: 'atencao', re: /^\s*(aten[cç][aã]o|cuidado)\s*[:!–—-]\s*/i },
  { tipo: 'nota', re: /^\s*(nota|obs\.?|observa[cç][aã]o)\s*(\d+\s*)?[:–—-]\s*/i },
];

/** «NOTA: …», «ATENÇÃO: …», «AVISO: …» em parágrafo próprio → caixa de destaque do contrato (sem o rótulo). */
function tratarCaixas(body) {
  const dom = body.ownerDocument;
  [...body.children].forEach(p => {
    if (p.tagName !== 'P') return;
    const t = textoDe(p);
    const c = CAIXAS_TEXTO.find(x => x.re.test(t));
    if (!c) return;
    // tira o rótulo do primeiro nó de texto (pode estar dentro de <strong>)
    let resto = c.re.exec(t)[0].length;
    const walker = dom.createTreeWalker(p, 4);
    for (let n = walker.nextNode(); n && resto > 0; n = walker.nextNode()) {
      const v = n.nodeValue.replace(/ /g, ' ');
      const tira = Math.min(resto, v.length);
      n.nodeValue = v.slice(tira);
      resto -= tira;
    }
    p.querySelectorAll('strong,b,em,i,u').forEach(m => { if (!m.textContent && !m.querySelector('img')) m.remove(); });
    if (!textoDe(p).trim()) return;
    const bq = dom.createElement('blockquote');
    bq.setAttribute('data-tipo', c.tipo);
    p.replaceWith(bq);
    bq.appendChild(p);
  });
}

/** Linhas vazias no fim das tabelas (os modelos do Word deixam muitas); tabelas aninhadas/largas → aviso. */
function tratarTabelas(body, rel) {
  body.querySelectorAll('table').forEach(tb => {
    if (tb.parentElement?.closest('table')) { rel.tabelas.aninhadas++; return; }
    rel.tabelas.total++;
    const linhas = [...tb.querySelectorAll('tr')].filter(tr => tr.closest('table') === tb);
    for (let i = linhas.length - 1; i > 0; i--) {
      if (textoDe(linhas[i]).trim() || linhas[i].querySelector('img')) break;
      linhas[i].remove();
    }
    if (tb.querySelector('[colspan],[rowspan]')) rel.tabelas.celulasUnidas++;
    const colunas = Math.max(0, ...linhas.map(tr => [...tr.children].reduce((n, c) => n + (Number(c.getAttribute('colspan')) || 1), 0)));
    if (colunas > 8) rel.tabelas.largas++;
  });
}

const tituloDeBloco = (el) => limparTitulo(textoDe(el));

/** Corpo do Word → lista de segmentos { titulo, tituloOriginal, elementos[] } partidos pelos <h1>. */
function partirPorTitulos(body) {
  const segmentos = [];
  let actual = { titulo: '', tituloOriginal: '', elementos: [], preambulo: true };
  for (const el of [...body.childNodes]) {
    if (el.nodeType === 3) { if (el.nodeValue.trim()) { const p = body.ownerDocument.createElement('p'); p.textContent = el.nodeValue; actual.elementos.push(p); } continue; }
    if (el.nodeType !== 1) continue;
    if (el.tagName === 'H1') {
      segmentos.push(actual);
      const orig = textoDe(el).replace(/\s+/g, ' ').trim();
      actual = { titulo: tituloDeBloco(el), tituloOriginal: orig, elementos: [], preambulo: false };
      continue;
    }
    actual.elementos.push(el);
  }
  segmentos.push(actual);
  return segmentos;
}

const RE_TITULO_GENERICO = /^(introducao|generalidades|disposicoes gerais|apresentacao|enquadramento|aspectos gerais|consideracoes gerais|parte geral)$/;

/** Sobe os títulos de um nível (h3→h2, h4→h3) nos elementos de topo. */
function subirTitulos(elementos) {
  return elementos.map(el => {
    const m = /^H([3-4])$/.exec(el.tagName);
    if (!m) return el;
    const n = el.ownerDocument.createElement(`h${Number(m[1]) - 1}`);
    while (el.firstChild) n.appendChild(el.firstChild);
    const st = el.getAttribute('style');
    if (st) n.setAttribute('style', st);
    return n;
  });
}

/**
 * Um capítulo genérico («Introdução», «Generalidades») ou sem encaixe que junta várias secções do modelo como
 * títulos de nível 2 (Objectivo, Âmbito, Referências…) → parte-se pelos títulos de nível 2.
 */
function subdividirPorH2(seg, modelo, rel) {
  if (!modelo || seg.preambulo) return [seg];
  const h2s = seg.elementos.filter(e => e.tagName === 'H2');
  if (h2s.length < 2) return [seg];
  const doH1 = encaixarTitulo(seg.titulo, modelo);
  if (doH1.chave && doH1.confianca >= 0.8) return [seg];
  const generico = RE_TITULO_GENERICO.test(normalizarTitulo(seg.titulo));
  const chaves = new Set(h2s.map(h => encaixarTitulo(tituloDeBloco(h), modelo)).filter(e => e.chave && e.confianca >= 0.85).map(e => e.chave));
  if (!(chaves.size >= 2 || (generico && chaves.size >= 1))) return [seg];
  const out = [{ ...seg, elementos: [] }];
  for (const el of seg.elementos) {
    if (el.tagName === 'H2') {
      out.push({ titulo: tituloDeBloco(el), tituloOriginal: textoDe(el).replace(/\s+/g, ' ').trim(), elementos: [], preambulo: false, de: seg.tituloOriginal || seg.titulo });
      continue;
    }
    out[out.length - 1].elementos.push(el);
  }
  rel.subdivididos.push(seg.tituloOriginal || seg.titulo);
  const [primeiro, ...resto] = out;
  return [...(primeiro.elementos.length ? [primeiro] : []), ...resto.map(s => ({ ...s, elementos: subirTitulos(s.elementos) }))];
}

/** Parágrafo curto que funciona como título de uma página preliminar (sem estilo de título no Word). */
function pseudoTituloPreliminar(el) {
  if (!el || !['P', 'H2', 'H3', 'H4'].includes(el.tagName)) return null;
  const t = textoDe(el).replace(/\s+/g, ' ').trim();
  if (!t || t.length > 90) return null;
  return tipoPreliminar(t);
}

/**
 * Preâmbulo (antes do primeiro título de nível 1): tira a capa, o índice, o controlo de revisões… Devolve os
 * elementos que sobram (conteúdo verdadeiro) e acrescenta o histórico encontrado.
 */
function tratarPreambulo(elementos, rel, historico, { semTitulos }) {
  const restam = [];
  let tipoActual = null; // dentro de uma página preliminar
  let capa = true; // até ao primeiro texto «a sério», é capa
  let capaChars = 0;
  for (const el of elementos) {
    const pt = pseudoTituloPreliminar(el);
    if (pt) {
      tipoActual = pt;
      capa = false;
      rel.descartados.push({ tipo: pt, titulo: textoDe(el).replace(/\s+/g, ' ').trim(), caracteres: 0 });
      continue;
    }
    if (tipoActual) {
      const ultimo = rel.descartados[rel.descartados.length - 1];
      ultimo.caracteres += contarTexto(textoDe(el));
      if (el.tagName === 'TABLE') { const h = historicoDeTabela(el); if (h?.length) historico.push(...h); }
      // um título de nível 2+ que não é preliminar fecha a página preliminar
      if (/^H[2-4]$/.test(el.tagName)) { tipoActual = null; ultimo.caracteres -= contarTexto(textoDe(el)); restam.push(el); }
      continue;
    }
    if (el.tagName === 'TABLE') {
      const h = historicoDeTabela(el);
      if (h) { if (h.length) historico.push(...h); rel.descartados.push({ tipo: 'revisoes', titulo: 'Tabela de revisões', caracteres: contarTexto(textoDe(el)) }); continue; }
    }
    if (capa && !semTitulos) {
      // a capa: logótipos, número, título, entidade — texto curto antes de qualquer conteúdo
      const t = contarTexto(textoDe(el));
      // curto e sem ponto final (uma frase do texto já não é capa)
      const curto = el.tagName === 'P' && t <= 140 && !/[.;:]$/.test(textoDe(el).trim());
      if ((el.tagName === 'P' && !t) || (curto && capaChars + t <= 600) || el.classList?.contains('gd-titulo-doc')) {
        capaChars += t;
        continue;
      }
      capa = false;
    }
    restam.push(el);
  }
  if (capaChars || elementos.length > restam.length) {
    const descartadoCapa = elementos.length - restam.length;
    if (capaChars && descartadoCapa) rel.descartados.unshift({ tipo: 'capa', titulo: ROTULO_DESCARTE.capa, caracteres: capaChars });
  }
  return restam;
}

/** Assinatura no fim do documento (imagem + «O DIRECTOR…» + nome) — o gerador faz o quadro de aprovação. */
function tirarAssinaturaFinal(elementos, rel) {
  const RE_CARGO = /director|directora|diretor|aprovad|assinatura|o chefe|a chefe|administrador|presidente/i;
  const RE_LOCAL_DATA = /^[a-zà-ú]+,? (aos )?\d{1,2}|^data:|^\d{1,2} de [a-zç]+ de \d{4}/i;
  const curtoOuImagem = (el) => {
    const t = textoDe(el).replace(/\s+/g, ' ').trim();
    return el.tagName === 'P' && ((!t && !!el.querySelector('img')) || (!!t && t.length <= 70));
  };
  // o cargo («O DIRECTOR DO AEROPORTO») tem de estar nos últimos parágrafos; corta-se a partir dele, mais a imagem
  // da assinatura e o «Luanda, …» logo acima — o texto do documento antes disso fica
  let iCargo = -1;
  for (let i = elementos.length - 1; i >= Math.max(0, elementos.length - 4); i--) {
    if (!curtoOuImagem(elementos[i])) break;
    if (RE_CARGO.test(textoDe(elementos[i]))) iCargo = i;
  }
  if (iCargo < 0) return elementos;
  let corte = iCargo;
  while (corte > 0 && curtoOuImagem(elementos[corte - 1])) {
    const t = textoDe(elementos[corte - 1]).replace(/\s+/g, ' ').trim();
    if (t && !RE_LOCAL_DATA.test(t)) break;
    corte--;
  }
  const chars = elementos.slice(corte).reduce((n, e) => n + contarTexto(textoDe(e)), 0);
  rel.descartados.push({ tipo: 'assinatura', titulo: ROTULO_DESCARTE.assinatura, caracteres: chars });
  return elementos.slice(0, corte);
}

// ── HTML → conteúdo do contrato ─────────────────────────────────────────────
let EXT = null;
const extensoes = () => (EXT ||= extensoesContrato());

/** Desce os títulos (h2→h3…) dentro de um conteúdo ProseMirror. */
export function descerTitulos(conteudo, passos = 1) {
  const visitar = (n) => {
    if (!n || typeof n !== 'object') return n;
    const c = Array.isArray(n.content) ? n.content.map(visitar) : n.content;
    if (n.type === 'heading') return { ...n, attrs: { ...(n.attrs || {}), level: Math.min(4, Number(n.attrs?.level || 2) + passos) }, content: c };
    return c === n.content ? n : { ...n, content: c };
  };
  return visitar(conteudo);
}

/** Títulos 2-4 sem a numeração escrita (o editor numera sozinho). */
function limparNumeracaoTitulos(conteudo) {
  const visitar = (n) => {
    if (!n || typeof n !== 'object') return n;
    if (n.type === 'heading' && Array.isArray(n.content) && n.content[0]?.type === 'text') {
      const primeiro = n.content[0];
      const original = primeiro.text;
      let novo = original.replace(/^[\s ]+/, '');
      for (let k = 0; k < 3; k++) { const x = novo.replace(RE_NUM_TITULO, ''); if (x === novo) break; novo = x; }
      const content = [{ ...primeiro, text: novo }, ...n.content.slice(1)].filter(t => t.type !== 'text' || t.text);
      // dois pontos no fim
      const ult = content[content.length - 1];
      if (ult?.type === 'text') content[content.length - 1] = { ...ult, text: ult.text.replace(/\s*:\s*$/, '') };
      const limpo = content.filter(t => t.type !== 'text' || t.text);
      return limpo.length ? { ...n, content: limpo } : { type: 'paragraph' };
    }
    return Array.isArray(n.content) ? { ...n, content: n.content.map(visitar) } : n;
  };
  return visitar(conteudo);
}

const LISTAS = ['bulletList', 'orderedList'];
const paragrafoVazio = (n) => n?.type === 'paragraph' && !(n.content || []).some(t => (t.type === 'text' && t.text.trim()) || t.type === 'image');
/** Item «oco»: parágrafo vazio + listas aninhadas (o Word saltou um nível: 1 → a) sem passar pelo •). */
const itemOco = (it) => it?.type === 'listItem' && paragrafoVazio(it.content?.[0]) && (it.content || []).slice(1).length > 0
  && it.content.slice(1).every(c => LISTAS.includes(c.type));

/**
 * Listas com níveis saltados: o item oco junta as suas sublistas ao item anterior; uma lista só de itens ocos é
 * substituída pelas sublistas (sobe um nível).
 */
export function corrigirListas(no) {
  if (!no || typeof no !== 'object' || !Array.isArray(no.content)) return no;
  let content = no.content.map(corrigirListas);
  if (LISTAS.includes(no.type)) {
    const itens = [];
    for (const it of content) {
      if (itemOco(it) && itens.length) {
        const ant = itens[itens.length - 1];
        itens[itens.length - 1] = { ...ant, content: [...ant.content, ...it.content.slice(1)] };
      } else itens.push(it);
    }
    content = itens;
  }
  // dentro de um item (ou no corpo): lista feita só de itens ocos → as sublistas sobem para o lugar dela
  content = content.flatMap(c => (LISTAS.includes(c.type) && c.content?.length && c.content.every(itemOco) ? c.content.flatMap(it => it.content.slice(1)) : [c]));
  return { ...no, content };
}

/** Tira parágrafos vazios repetidos e os do início/fim. */
function compactar(conteudo) {
  const c = (conteudo?.content || []).filter((n, i, a) => {
    const vazioP = n.type === 'paragraph' && !(n.content || []).length;
    if (!vazioP) return true;
    const ant = a[i - 1];
    return !(ant && ant.type === 'paragraph' && !(ant.content || []).length);
  });
  while (c.length && c[0].type === 'paragraph' && !(c[0].content || []).length) c.shift();
  while (c.length && c[c.length - 1].type === 'paragraph' && !(c[c.length - 1].content || []).length) c.pop();
  return { type: 'doc', content: c.length ? c : [{ type: 'paragraph' }] };
}

/** HTML de um bloco → documento ProseMirror do contrato. */
export function htmlParaConteudo(html) {
  const limpo = limparHtmlColado(html);
  const json = generateJSON(limpo, extensoes());
  return compactar(corrigirListas(limparNumeracaoTitulos(json)));
}

function htmlDe(elementos) {
  return elementos.map(el => el.outerHTML || '').join('');
}

// ── imagens ─────────────────────────────────────────────────────────────────
const TIPOS_IMAGEM_WEB = /^image\/(png|jpe?g|gif|webp|bmp)$/i;

function reduzirPorOmissao() {
  // só num navegador a sério (o jsdom tem Image mas nunca carrega imagens)
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  if (/jsdom/i.test(String(globalThis.navigator?.userAgent || ''))) return null;
  return async (src) => (await reduzirImagemSrc(src)).src;
}

const comPrazo = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('prazo')), ms))]);

// ── conversão ───────────────────────────────────────────────────────────────
async function carregarMammoth() {
  const m = await import('mammoth');
  return m.default && m.default.convertToHtml ? m.default : m;
}

/**
 * Converte o .docx em blocos (secções do Word) + histórico + relatório. Não junta ao modelo — ver montarDocumento.
 * @param {{ arrayBuffer: ArrayBuffer, modelo?: Object, reduzirImagem?: (dataUrl) => Promise<string>|null,
 *           limiteImagens?: number, onProgresso?: (fase: string) => void }} p
 */
export async function lerDocx({ arrayBuffer, modelo = null, reduzirImagem, limiteImagens = LIMITE_IMAGENS_TOTAL, onProgresso } = {}) {
  if (!arrayBuffer) throw new Error('Ficheiro .docx em falta.');
  const passo = (t) => { try { onProgresso?.(t); } catch { /* */ } };
  const reduzir = reduzirImagem === undefined ? reduzirPorOmissao() : reduzirImagem;
  const mammoth = await carregarMammoth();

  const rel = {
    blocos: [], descartados: [], avisos: [], estilosDesconhecidos: [],
    imagens: { total: 0, convertidas: 0, reduzidas: 0, perdidas: 0, grandes: 0, bytes: 0, foraDoLimite: 0 },
    tabelas: { total: 0, celulasUnidas: 0, aninhadas: 0, largas: 0 },
    legendas: 0, caixas: 0, tituloWord: '', titulos: { 1: 0, 2: 0, 3: 0, 4: 0 }, titulosComoTexto: 0, subdivididos: [],
    texto: { bruto: 0, final: 0, descartado: 0, percentagem: 0, percentagemConteudo: 0 },
  };
  const estilosVistos = new Map();

  const transform = mammoth.transforms.paragraph((p) => {
    const nome = p.styleName || '';
    let cls = classificarEstilo(nome);
    // estilo de título usado como item de lista ou frase (planos com estilos próprios): fica texto/lista
    if (cls?.tipo === 'titulo' && pareceFrase(textoParagrafoMammoth(p), { proprio: !/^(heading|t[ií]tulo)\s*[1-9]$/i.test(nome) })) {
      cls = null;
      rel.titulosComoTexto++;
    }
    // 'gd-texto' não está no styleMap: sai parágrafo (ou item de lista, se o Word o numerou)
    let styleName = cls === null && /t[ií]tulo|heading|title|cap[ií]tulo/i.test(nome) ? 'gd-texto' : p.styleName;
    if (cls?.tipo === 'titulo') { styleName = cls.nivel <= 4 ? `gd-h${cls.nivel}` : 'gd-h5'; rel.titulos[Math.min(4, cls.nivel)] = (rel.titulos[Math.min(4, cls.nivel)] || 0) + (cls.nivel <= 4 ? 1 : 0); }
    else if (cls?.tipo === 'toc') styleName = 'gd-toc';
    else if (cls?.tipo === 'tituloDocumento') styleName = 'gd-titulo-doc';
    else if (cls?.tipo === 'legenda') styleName = 'gd-legenda';
    else if (nome && styleName !== 'gd-texto' && !ESTILOS_COMUNS.test(nome)) estilosVistos.set(nome, (estilosVistos.get(nome) || 0) + 1);
    const al = ALINHAMENTO_WORD[String(p.alignment || '').toLowerCase()];
    // listas e títulos ficam sem alinhamento (só centrados/à direita interessam nos títulos)
    const usaAl = al && !p.numbering && !(cls?.tipo === 'titulo' && al === 'justify');
    const children = usaAl
      ? [{ type: 'run', children: [{ type: 'text', value: `${MARCA_AL}${al}${FIM_AL}` }] }, ...(p.children || [])]
      : p.children;
    return { ...p, styleName, children };
  });

  let totalImagens = 0;
  const convertImage = mammoth.images.imgElement(async (image) => {
    rel.imagens.total++;
    const tipo = String(image.contentType || '').toLowerCase();
    if (!TIPOS_IMAGEM_WEB.test(tipo)) {
      rel.imagens.perdidas++;
      rel.avisos.push(`Imagem em formato ${tipo.replace('image/', '').toUpperCase() || 'desconhecido'} (desenho do Word/EMF) não se converte — volte a inseri-la como PNG ou JPEG.`);
      return { src: '' };
    }
    let src = `data:${tipo === 'image/jpg' ? 'image/jpeg' : tipo};base64,${await image.read('base64')}`;
    if (reduzir) {
      try {
        const r = await comPrazo(reduzir(src), 20000);
        if (r && r.length < src.length) { src = r; rel.imagens.reduzidas++; } else if (r && /^data:image\/bmp/.test(src)) src = r;
      } catch { /* fica a original */ }
    }
    if (/^data:image\/bmp/i.test(src)) { rel.imagens.perdidas++; return { src: '' }; }
    if (totalImagens + src.length > limiteImagens) {
      rel.imagens.foraDoLimite++;
      rel.imagens.perdidas++;
      return { src: '' };
    }
    totalImagens += src.length;
    if (src.length > IMAGEM_GRANDE) rel.imagens.grandes++;
    rel.imagens.convertidas++;
    passo(`A converter as imagens (${rel.imagens.total})…`);
    return { src, alt: image.altText || '' };
  });

  passo('A ler o Word…');
  const r = await mammoth.convertToHtml(
    { arrayBuffer, buffer: arrayBuffer },
    { styleMap: STYLE_MAP, transformDocument: (d) => transform(ajustarNiveisListas(d)), convertImage, ignoreEmptyParagraphs: true, includeDefaultStyleMap: true },
  );
  rel.imagens.bytes = totalImagens;
  if (rel.imagens.foraDoLimite) rel.avisos.push(`${rel.imagens.foraDoLimite} imagem(ns) ficaram de fora: o total das imagens passava de ${Math.round(limiteImagens / 1048576)} MB. Insira-as no editor depois (são reduzidas automaticamente).`);
  if (rel.imagens.grandes) rel.avisos.push(`${rel.imagens.grandes} imagem(ns) continuam grandes (> ${Math.round(IMAGEM_GRANDE / 1024)} KB) — o rascunho fica mais pesado.`);
  const ignorados = new Set();
  for (const m of r.messages || []) {
    const t = String(m.message || '');
    if (/Unrecognised (paragraph|run) style/i.test(t)) continue;
    if (/unrecognised element was ignored: (w|v|wp|mc|wps|wpg|o):(\S+)/i.test(t)) ignorados.add(/ignored: (\S+)/.exec(t)[1]);
  }
  const perdidos = [...ignorados].filter(e => /txbx|textbox|shape|pict|object|fld|sdt|drawing|AlternateContent|ffData|checkBox/i.test(e));
  if (perdidos.length) rel.avisos.push(`Elementos do Word que não passam para o editor (caixas de texto, formas, campos de formulário): ${perdidos.slice(0, 6).join(', ')}. Confira o texto dessas zonas.`);
  rel.estilosDesconhecidos = [...estilosVistos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([nome, usos]) => ({ nome, usos }));

  passo('A organizar as secções…');
  const dom = novoDom(r.value);
  const body = dom.body;
  rel.texto.bruto = contarTexto(textoDe(body).replace(new RegExp(`${MARCA_AL}[a-z]+${FIM_AL}`, 'g'), ''));
  aplicarAlinhamentos(body);
  removerIndice(body, rel);
  limparMiudezas(body);
  // título do documento (estilo «Title» do Word): o cabeçalho do GED já o tem
  body.querySelectorAll('p.gd-titulo-doc').forEach((p, i) => {
    if (i === 0) rel.tituloWord = textoDe(p).replace(/\s+/g, ' ').trim();
    rel.descartados.push({ tipo: 'tituloDocumento', titulo: ROTULO_DESCARTE.tituloDocumento, caracteres: contarTexto(textoDe(p)) });
    p.remove();
  });
  // «intencionalmente em branco»
  body.querySelectorAll('p').forEach(p => {
    if (/^\s*(p[aá]gina\s+)?intencionalmente\s+(deixada\s+)?em\s+branco\.?\s*$/i.test(textoDe(p))) {
      rel.descartados.push({ tipo: 'branco', titulo: ROTULO_DESCARTE.branco, caracteres: contarTexto(textoDe(p)) });
      p.remove();
    }
  });
  tratarTabelas(body, rel);
  tratarLegendas(body, rel);
  continuarNumeracao(body);
  tratarCaixas(body);
  rel.caixas = body.querySelectorAll('blockquote').length;
  // parágrafos vazios (o Word usa-os como espaçamento)
  body.querySelectorAll('p').forEach(p => { if (vazio(p) && !p.closest('td,th,li')) p.remove(); });
  // itens de lista vazios (parágrafos numerados sem texto) e listas que ficam sem itens
  [...body.querySelectorAll('li')].reverse().forEach(li => { if (vazio(li) && !li.querySelector('li')) li.remove(); });
  [...body.querySelectorAll('ul,ol')].reverse().forEach(l => { if (!l.querySelector('li')) l.remove(); });

  const historico = [];
  const segmentos = partirPorTitulos(body).flatMap(seg => subdividirPorH2(seg, modelo, rel));
  const semTitulos = segmentos.length === 1;
  const blocos = [];
  segmentos.forEach((seg, i) => {
    let elementos = seg.elementos;
    if (i === segmentos.length - 1) elementos = tirarAssinaturaFinal(elementos, rel);
    if (seg.preambulo) {
      elementos = tratarPreambulo(elementos, rel, historico, { semTitulos });
    } else {
      const tp = tipoPreliminar(seg.titulo);
      if (tp) {
        const tabelas = elementos.filter(e => e.tagName === 'TABLE');
        for (const t of tabelas) { const h = historicoDeTabela(t); if (h?.length) historico.push(...h); }
        rel.descartados.push({ tipo: tp, titulo: seg.tituloOriginal || seg.titulo, caracteres: contarTexto(seg.tituloOriginal) + elementos.reduce((n, e) => n + contarTexto(textoDe(e)), 0) });
        return;
      }
      // tabela de revisões solta numa secção (p.ex. no fim): sai para o histórico
      elementos = elementos.filter(e => {
        if (e.tagName !== 'TABLE') return true;
        const h = historicoDeTabela(e);
        if (!h) return true;
        historico.push(...h);
        rel.descartados.push({ tipo: 'revisoes', titulo: 'Tabela de revisões', caracteres: contarTexto(textoDe(e)) });
        return false;
      });
    }
    if (seg.preambulo && !elementos.length) return;
    const conteudo = htmlParaConteudo(htmlDe(elementos));
    blocos.push({
      id: `b${blocos.length + 1}`,
      titulo: seg.preambulo ? (semTitulos ? '' : 'Introdução') : (seg.titulo || seg.tituloOriginal || `Secção ${blocos.length + 1}`),
      tituloOriginal: seg.preambulo ? '' : seg.tituloOriginal,
      preambulo: !!seg.preambulo,
      conteudo,
      caracteres: contarTextoNo(conteudo),
    });
  });

  // histórico: sem repetidos (a mesma tabela pode estar na capa e no fim), pela ordem do Word
  const vistos = new Set();
  const hist = historico.filter(h => { const k = `${h.revisao}|${h.data}|${h.descricao}`; if (vistos.has(k)) return false; vistos.add(k); return true; });

  rel.texto.descartado = rel.descartados.reduce((n, d) => n + (d.caracteres || 0), 0);
  // tabelas e imagens que chegaram ao documento (as das páginas descartadas não contam)
  const contar = (n, tipo) => (!n || typeof n !== 'object' ? 0 : (n.type === tipo ? 1 : 0) + (n.content || []).reduce((k, f) => k + contar(f, tipo), 0));
  rel.tabelas.total = blocos.reduce((n, b) => n + contar(b.conteudo, 'table'), 0);
  rel.imagens.noDocumento = blocos.reduce((n, b) => n + contar(b.conteudo, 'image'), 0);
  if (rel.tabelas.aninhadas) rel.avisos.push(`${rel.tabelas.aninhadas} tabela(s) dentro de outras tabelas — confira o resultado (o editor não as trata bem).`);
  if (rel.tabelas.largas) rel.avisos.push(`${rel.tabelas.largas} tabela(s) com mais de 8 colunas — podem não caber na largura da página.`);
  if (rel.estilosDesconhecidos.length) rel.avisos.push(`Estilos do Word sem correspondência (ficaram como texto normal): ${rel.estilosDesconhecidos.slice(0, 6).map(e => `«${e.nome}»`).join(', ')}.`);
  if (semTitulos) rel.avisos.push('O Word não tem títulos de nível 1 (estilo «Título 1»): todo o texto foi para uma só secção. Pode reorganizá-lo no editor.');

  return { blocos: atribuirDestinos(blocos, modelo, { semTitulos }), historico: hist, relatorio: rel };
}

/**
 * Destino inicial de cada bloco: a secção do modelo mais parecida (ou '' = secção extra). O preâmbulo vai para a
 * primeira secção do modelo se ela ficar vazia; sem títulos no Word, tudo vai para a secção principal.
 */
export function atribuirDestinos(blocos, modelo, { semTitulos = false } = {}) {
  const sm = seccoesDoModelo(modelo);
  const out = blocos.map(b => {
    if (b.preambulo) return { ...b, destino: '', confianca: 0 };
    const e = encaixarTitulo(b.titulo, modelo);
    return { ...b, destino: e.chave || '', confianca: e.confianca };
  });
  // secção já encaixada com força (título igual/sinónimo) → os blocos fracos para a mesma secção ficam extra
  const forte = new Map();
  for (const b of out) if (b.destino && b.confianca >= 0.8) forte.set(b.destino, Math.max(forte.get(b.destino) || 0, b.confianca));
  for (const b of out) if (b.destino && forte.has(b.destino) && b.confianca < 0.8) { b.destino = ''; }
  const usados = new Set(out.map(b => b.destino).filter(Boolean));
  for (const b of out) {
    if (!b.preambulo) continue;
    if (semTitulos) {
      const principal = sm.find(s => ['procedimento', 'lista', 'conteudo', 'disposicoes', 'accoes', 'actividades', 'campos'].includes(s.chave))
        || sm.find(s => s.obrigatoria) || sm[0];
      b.destino = principal?.chave || '';
      b.confianca = 0;
    } else {
      const intro = sm.find(s => s.chave === 'introducao');
      if (intro && !usados.has('introducao')) b.destino = 'introducao';
      else if (sm[0] && !usados.has(sm[0].chave)) b.destino = sm[0].chave;
    }
  }
  return out;
}

/**
 * Junta os blocos às secções do modelo (pelo `destino` de cada bloco) → documento estruturado.
 * Secções do modelo por ordem do modelo; secções extra (destino '') na posição em que estavam no Word.
 */
export function montarDocumento({ blocos, modelo, cabecalho = {}, historico = [], extras = {} }) {
  const sm = seccoesDoModelo(modelo);
  const porChave = new Map(sm.map(s => [s.chave, []]));
  for (const b of blocos) if (b.destino && porChave.has(b.destino)) porChave.get(b.destino).push(b);

  const juntar = (lista) => {
    if (!lista.length) return docVazio();
    if (lista.length === 1) return lista[0].conteudo;
    const content = [];
    for (const b of lista) {
      const titulo = String(b.titulo || '').trim();
      if (titulo) content.push({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: titulo }] });
      content.push(...(descerTitulos(b.conteudo, titulo ? 1 : 0).content || []));
    }
    return { type: 'doc', content };
  };

  // Ordem: as secções do modelo, pela ordem do modelo. Cada secção extra entra logo ANTES da secção do modelo onde
  // caiu o bloco seguinte do Word (fica entre as duas secções que a rodeavam no Word); as do fim entram a seguir à
  // última secção que recebeu texto.
  const seccoes = sm.map((s, i) => ({ id: `s${i + 1}-${s.chave}`, chave: s.chave, titulo: s.titulo, obrigatoria: !!s.obrigatoria, conteudo: juntar(porChave.get(s.chave)) }));
  const encaixa = (b) => !!(b?.destino && porChave.has(b.destino));
  let nExtra = 0;
  const pendentes = []; // extras à espera da próxima secção encaixada
  const extraDe = (b) => {
    nExtra++;
    return { id: `x${nExtra}-${b.id}`, chave: `extra_${nExtra}`, titulo: String(b.titulo || '').trim() || 'Secção', obrigatoria: false, conteudo: b.conteudo };
  };
  // os anexos são sempre a última secção: uma «Lista de anexos» no início do Word não serve de referência
  const ancora = (b) => encaixa(b) && b.destino !== 'anexos';
  let ultimo = null; // chave da última secção do modelo que recebeu texto (pela ordem do Word)
  for (const b of blocos) {
    if (!encaixa(b)) { pendentes.push(extraDe(b)); continue; }
    if (!ancora(b)) continue;
    if (pendentes.length) {
      seccoes.splice(seccoes.findIndex(s => s.chave === b.destino), 0, ...pendentes);
      pendentes.length = 0;
    }
    ultimo = b.destino;
  }
  if (pendentes.length) {
    // os extras do fim: a seguir à última secção que recebeu texto (e aos extras que já lá estejam a seguir)
    let i = ultimo ? seccoes.findIndex(s => s.chave === ultimo) + 1 : seccoes.length;
    while (i < seccoes.length && /^extra_/.test(seccoes[i].chave)) i++;
    seccoes.splice(i, 0, ...pendentes);
  }

  return {
    schema: SCHEMA_VERSAO,
    modelo: modelo?.classe_codigo || 'POP',
    cabecalho: {
      numero: '', titulo: '', revisao: '00', data: hojeISO(), aeroporto: '', aeroportoNome: '',
      elaboradoPor: '', verificadoPor: '', aprovadoPor: '', classificacao: '',
      ...cabecalho,
    },
    seccoes,
    historico,
    extras,
  };
}

/** Texto final (secções + histórico) — para a percentagem de texto preservado. */
export function contarTextoDocumento(doc) {
  // os títulos das secções extra vêm do Word; os das secções do modelo não (o título do Word está no bloco)
  const s = (doc?.seccoes || []).reduce((n, x) => {
    const t = contarTextoNo(x.conteudo);
    return n + t + (/^extra_/.test(x.chave) ? contarTexto(x.titulo) : 0);
  }, 0);
  const h = (doc?.historico || []).filter(x => x.descricao !== DESCRICAO_CONVERSAO).reduce((n, x) => n + contarTexto(`${x.revisao}${x.descricao}`), 0);
  return s + h;
}

/**
 * Revisão da conversão: parte da última revisão do histórico do Word (ou da indicada), passa à seguinte e acrescenta
 * a entrada «Conversão do Word para o editor estruturado».
 */
export function aplicarRevisaoConversao(doc, { revisaoActual = '', autor = '', data = hojeISO() } = {}) {
  const h = doc?.historico || [];
  const base = String(h[h.length - 1]?.revisao || revisaoActual || '').trim();
  // sem revisão conhecida: a do Word conta como 00 e a conversão é a 01
  const comBase = { ...doc, cabecalho: { ...(doc?.cabecalho || {}), revisao: base || '00' } };
  return prepararNovaRevisao(comBase, { descricao: DESCRICAO_CONVERSAO, autor, data });
}

/** Resumo do relatório para o ecrã (por bloco: origem → destino). */
export function resumoEncaixe(blocos, modelo) {
  const sm = seccoesDoModelo(modelo);
  return blocos.map(b => ({
    id: b.id,
    origem: b.tituloOriginal || b.titulo || '(texto antes do primeiro título)',
    destino: b.destino ? (sm.find(s => s.chave === b.destino)?.titulo || b.destino) : 'Secção extra',
    chave: b.destino,
    confianca: b.confianca,
    caracteres: b.caracteres,
  }));
}

/** Percentagens de texto preservado (sobre o texto bruto do Word, e sobre o que não foi descartado de propósito). */
export function calcularPreservado(relatorio, doc, blocos = []) {
  // o título do Word de um bloco que ficou sozinho numa secção do modelo passou a ser o título dessa secção
  const porDestino = new Map();
  for (const b of blocos) if (b.destino) porDestino.set(b.destino, (porDestino.get(b.destino) || 0) + 1);
  const titulos = blocos.filter(b => b.destino && porDestino.get(b.destino) === 1).reduce((n, b) => n + contarTexto(limparTitulo(b.tituloOriginal || '')), 0);
  const final = contarTextoDocumento(doc) + titulos;
  const bruto = relatorio.texto.bruto || 0;
  const util = Math.max(1, bruto - (relatorio.texto.descartado || 0));
  relatorio.texto.final = final;
  relatorio.texto.percentagem = bruto ? Math.round((final / bruto) * 1000) / 10 : 100;
  relatorio.texto.percentagemConteudo = Math.min(100, Math.round((final / util) * 1000) / 10);
  return relatorio.texto;
}

/**
 * Converte um .docx num documento estruturado do contrato.
 * @param {{ arrayBuffer: ArrayBuffer, modelo: Object, cabecalhoBase?: Object, extras?: Object, autor?: string,
 *           revisaoActual?: string, reduzirImagem?: Function|null, limiteImagens?: number, onProgresso?: Function }} p
 * @returns {Promise<{ doc: Object, blocos: Object[], historicoWord: Object[], relatorio: Object }>}
 */
export async function converterDocxParaEstruturado({ arrayBuffer, modelo, cabecalhoBase = {}, extras = {}, autor = '', revisaoActual = '', reduzirImagem, limiteImagens, onProgresso } = {}) {
  const { blocos, historico, relatorio } = await lerDocx({ arrayBuffer, modelo, reduzirImagem, limiteImagens, onProgresso });
  const base = montarDocumento({ blocos, modelo, cabecalho: cabecalhoBase, historico, extras });
  const doc = aplicarRevisaoConversao(base, { revisaoActual, autor });
  calcularPreservado(relatorio, doc, blocos);
  relatorio.blocos = resumoEncaixe(blocos, modelo);
  relatorio.historico = historico.length;
  relatorio.seccoesEncaixadas = new Set(blocos.map(b => b.destino).filter(Boolean)).size;
  relatorio.seccoesExtra = blocos.filter(b => !b.destino).length;
  relatorio.obrigatoriasVazias = doc.seccoes.filter(s => s.obrigatoria && !textoDoNo(s.conteudo).trim() && !JSON.stringify(s.conteudo).includes('"image"')).map(s => s.titulo);
  return { doc, blocos, historicoWord: historico, relatorio };
}

/** Pode converter-se? → { pode, motivo } (formulários e manuais não). */
export function podeConverterClasse(classe) {
  const c = String(classe || '').toUpperCase();
  if (CLASSES_FORMULARIO.includes(c)) return { pode: false, motivo: 'formulario' };
  if (c === 'MA') return { pode: false, motivo: 'manual' };
  return { pode: true, motivo: '' };
}

export { proximaRevisao };
