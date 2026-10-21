// Lógica pura do assistente «Redigir documentos» (sem React nem rede, para se poder testar).
// Passos: modelo → cabeçalho → secções → pré-visualizar/gerar.
import {
  seccoesObrigatoriasEmFalta, camposCabecalhoEmFalta, conteudoVazio, validarDocumentoEstruturado,
  ROTULO_CAMPO, proximaRevisao, prepararNovaRevisao, garantirHistoricoInicial, novoDocumentoEstruturado,
} from './contrato';
import { nomeFicheiroDoc } from '../nomeDocumento';

export const PASSOS = [
  { chave: 'modelo', titulo: 'Modelo' },
  { chave: 'cabecalho', titulo: 'Cabeçalho' },
  { chave: 'seccoes', titulo: 'Secções' },
  { chave: 'previsualizar', titulo: 'Pré-visualizar e gerar' },
];

export const indicePasso = (chave) => Math.max(0, PASSOS.findIndex(p => p.chave === chave));

/** Classe dos modelos com editor estruturado → modelo (da tabela, ou o padrão). */
export function escolherModelo(modelos, classe) {
  return (modelos || []).find(m => m.classe_codigo === classe && m.activo !== false) || null;
}

/** Dados que só o editor usa (processo, pasta, modelo). Ficam em `conteudo.extras`; os geradores ignoram-nos. */
export const extrasDe = (doc) => (doc && typeof doc.extras === 'object' && doc.extras) || {};

/**
 * Problemas que impedem avançar do passo indicado (lista de textos; vazia = pode avançar).
 * O passo das secções não bloqueia: as obrigatórias em falta só bloqueiam o «Gerar rascunho».
 */
export function problemasDoPasso(passo, { doc, aeroportoId } = {}) {
  if (passo === 'modelo') return doc?.modelo ? [] : ['Escolha o tipo de documento.'];
  if (passo === 'cabecalho') {
    const p = [];
    if (!aeroportoId) p.push('Escolha o aeroporto.');
    for (const k of camposCabecalhoEmFalta(doc)) if (k !== 'aeroporto' || !aeroportoId) p.push(`Falta preencher: ${ROTULO_CAMPO[k] || k}.`);
    return [...new Set(p)];
  }
  if (passo === 'seccoes') return [];
  if (passo === 'previsualizar') return problemasParaGerar(doc);
  return [];
}

/** Tudo o que falta para se poder gerar o rascunho (validação estrita do contrato). */
export function problemasParaGerar(doc) {
  const v = validarDocumentoEstruturado(doc, { estrito: true });
  const extras = extrasDe(doc);
  const p = [...v.erros];
  if (!extras.documentoId && !extras.processo) p.push('Escolha o manual ou programa (processo) no cabeçalho — é preciso para criar o documento.');
  return p;
}

/** Estado de preenchimento para o indicador do passo «Secções». */
export function resumoPreenchimento(doc) {
  const seccoes = doc?.seccoes || [];
  const preenchidas = seccoes.filter(s => !conteudoVazio(s.conteudo)).length;
  const emFalta = seccoesObrigatoriasEmFalta(doc);
  return {
    total: seccoes.length,
    preenchidas,
    obrigatorias: seccoes.filter(s => s.obrigatoria).length,
    obrigatoriasEmFalta: emFalta.length,
    emFalta,
    pronto: emFalta.length === 0,
  };
}

/** Estado de uma secção para a navegação: 'feita' | 'falta' (obrigatória vazia) | 'opcional' (opcional vazia). */
export function estadoSeccao(s) {
  if (!conteudoVazio(s?.conteudo)) return 'feita';
  return s?.obrigatoria ? 'falta' : 'opcional';
}

/** Substitui o conteúdo de uma secção (imutável). */
export function actualizarSeccao(doc, id, conteudo) {
  return { ...doc, seccoes: (doc?.seccoes || []).map(s => (s.id === id ? { ...s, conteudo } : s)) };
}

/** Actualiza campos do cabeçalho (imutável). */
export function actualizarCabecalho(doc, patch) {
  return { ...doc, cabecalho: { ...(doc?.cabecalho || {}), ...patch } };
}

/** Nome base dos ficheiros gerados, no padrão do GED (nomeFicheiroDoc): «POP-FNLU-OPS-001 — Título (Rev.01)». */
export function nomeBaseFicheiro(doc) {
  const c = doc?.cabecalho || {};
  const base = nomeFicheiroDoc({ numero: c.numero, titulo: c.titulo }, { comExtensao: false });
  return `${base} (Rev.${String(c.revisao || '00').replace(/[^\w]/g, '')})`;
}

/** Rótulo da documento_versao gerada («Rev. 01»). */
export const rotuloVersao = (doc) => `Rev. ${doc?.cabecalho?.revisao || '00'}`;

/** Nota da versão: a descrição da última entrada do histórico. */
export function notaVersao(doc) {
  const h = doc?.historico || [];
  const ult = h[h.length - 1];
  return ult?.descricao ? `${ult.descricao} (redigido no editor)` : 'Redigido no editor de documentos';
}

/**
 * Antes de gerar: garante que há entrada no histórico para a revisão actual (a primeira emissão cria-a; uma
 * revisão já a tem desde «Rever»). Se a última entrada é de outra revisão, acrescenta uma.
 */
export function prepararParaGerar(doc, { autor = '' } = {}) {
  let d = garantirHistoricoInicial(doc, { autor });
  const rev = d?.cabecalho?.revisao || '00';
  const h = d.historico || [];
  if (!h.some(e => String(e.revisao) === String(rev))) {
    d = { ...d, historico: [...h, { revisao: rev, data: d.cabecalho?.data || '', descricao: 'Revisão do documento', autor: autor || d.cabecalho?.elaboradoPor || '' }] };
  }
  return d;
}

/**
 * Rever um documento já gerado: parte do conteúdo que foi gerado (ou do actual), aumenta a revisão e acrescenta
 * a entrada ao histórico.
 */
export function iniciarRevisao(rascunho, { descricao, autor, data } = {}) {
  const base = rascunho?.conteudo_gerado || rascunho?.conteudo;
  return prepararNovaRevisao(base, { descricao, autor, data });
}

export { proximaRevisao, novoDocumentoEstruturado };

/** Texto curto do estado do rascunho para a lista. */
export function rotuloEstadoRascunho(r) {
  if (r?.estado === 'gerado') return 'Rascunho gerado';
  return r?.documento_id ? 'Em revisão no editor' : 'Em edição';
}
