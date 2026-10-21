// Lógica pura da cópia assinada (sem rede, sem DOM) — testada em __tests__/copiaAssinadaLogica.test.js.
//
// A cópia assinada é um PDF de distribuição: o original aprovado com as assinaturas do fluxo (nome, papel, data,
// código e, se a pessoa a tiver, a rubrica) e o código de verificação. A PROVA continua a ser a assinatura
// electrónica registada na base; a cópia é a forma legível dela. O código de verificação vem do PDF ORIGINAL
// assinado (documento_ficheiro papel 'pdf'), nunca da cópia: a cópia pode ser refeita, o original não muda.
import { nomeFicheiroDoc } from './nomeDocumento';

const SEM_MIGRACAO_186 = 'A cópia assinada ainda não está activa no servidor: falta aplicar a migração 186. Avise a gestão do portal.';

/** A RPC/tabela da migração 186 ainda não existe? (mesmo critério de tabelaEmFalta no editor estruturado) */
export function falta186(error) {
  const t = `${error?.code || ''} ${error?.message || ''}`;
  return /42P01|42883|PGRST202|PGRST205|does not exist|Could not find the (table|function)/i.test(t);
}

export function erro186(error, acao) {
  if (falta186(error)) return new Error(SEM_MIGRACAO_186);
  const msg = String(error?.message || error || '');
  if (/row-level security|permission denied|42501/i.test(msg)) return new Error(`Sem permissão para ${acao}.`);
  return new Error(`Não foi possível ${acao}: ${msg || 'erro desconhecido'}.`);
}
export const MENSAGEM_SEM_186 = SEM_MIGRACAO_186;

/** «Rev.NN»: o número da revisão com dois algarismos (o rótulo livre não serve para nome de ficheiro). */
export function rotuloRevCurto(versao) {
  const n = String(versao?.versao ?? '').trim();
  if (!n) return '';
  return /^\d+$/.test(n) ? `Rev.${n.padStart(2, '0')}` : `Rev.${n}`;
}

/** «<código> — <título> (Rev.NN) — assinado.pdf», seguro para Windows/HTTP. */
export function nomeCopiaAssinada(documento, versao) {
  const base = nomeFicheiroDoc(documento || {}, { comExtensao: false });
  const rev = rotuloRevCurto(versao);
  const nome = `${base}${rev ? ` (${rev})` : ''} — assinado`;
  return `${nome.replace(/[\\/:*?"<>|\x00-\x1f]+/g, '-').replace(/\s{2,}/g, ' ').trim()}.pdf`;
}

/** Chave no balde private-uploads: só caracteres seguros (o nome bonito vai à parte, em p_nome). */
export function caminhoCopiaAssinada({ documentoId, nome, agora = new Date() }) {
  const seguro = String(nome || 'copia-assinada.pdf')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]/g, '_').replace(/\.{2,}/g, '.').replace(/_{2,}/g, '_').replace(/^[._]+/, '') || 'copia-assinada.pdf';
  return `copias-assinadas/${agora.getFullYear()}/${documentoId}/${agora.getTime()}_${seguro}`;
}

const tempo = (v) => { const t = new Date(v || 0).getTime(); return Number.isNaN(t) ? 0 : t; };

/**
 * O PDF original assinado de uma versão: o ficheiro 'pdf' cujo sha256 é o da ÚLTIMA assinatura (a aprovação);
 * sem correspondência, o PDF da ronda mais recente. null se a versão não tem PDF no fluxo.
 */
export function pdfOriginalDaVersao(ficheiros, linhasAssinatura) {
  const pdfs = (Array.isArray(ficheiros) ? ficheiros : []).filter(f => f && f.papel === 'pdf');
  if (!pdfs.length) return null;
  const linhas = (Array.isArray(linhasAssinatura) ? linhasAssinatura : []).slice().sort((a, b) => tempo(b.assinado_em) - tempo(a.assinado_em));
  const ultima = linhas.find(l => l.acto === 'aprovacao') || linhas[0] || null;
  if (ultima?.ficheiro_sha256) {
    const igual = pdfs.find(f => String(f.sha256 || '').toLowerCase() === String(ultima.ficheiro_sha256).toLowerCase());
    if (igual) return igual;
  }
  return pdfs.slice().sort((a, b) => (Number(b.ronda) || 1) - (Number(a.ronda) || 1) || tempo(b.created_date) - tempo(a.created_date))[0];
}

/**
 * Estruturado ou ficheiro? Gera-se do conteúdo do editor só quando há a certeza de que o PDF aprovado é o que o
 * editor gerou para ESTA versão: rascunho com versao_gerada_id = versão, conteúdo guardado, e (quando se sabe) o
 * sha256 da versão gerada igual ao do original assinado. Se o fluxo trocou o PDF depois (devolução, outro
 * ficheiro), a cópia faz-se a partir do ficheiro — nunca se reconstrói um conteúdo que não foi o assinado.
 */
export function escolherModoCopia({ rascunho, versaoId, versaoSha, shaOriginal } = {}) {
  const conteudo = rascunho?.conteudo_gerado || rascunho?.conteudo || null;
  if (!rascunho || !versaoId || String(rascunho.versao_gerada_id || '') !== String(versaoId)) return { modo: 'ficheiro', conteudo: null };
  if (!conteudo || typeof conteudo !== 'object' || !conteudo.cabecalho) return { modo: 'ficheiro', conteudo: null };
  const a = String(versaoSha || '').toLowerCase();
  const b = String(shaOriginal || '').toLowerCase();
  if (a && b && a !== b) return { modo: 'ficheiro', conteudo: null };
  return { modo: 'estruturado', conteudo };
}

/** Rubricas devolvidas pela RPC → { email(minúsculas): dataURL }. */
export function rubricasPorEmail(linhas) {
  const m = {};
  for (const r of Array.isArray(linhas) ? linhas : []) {
    const e = String(r?.email || '').toLowerCase();
    if (e && typeof r?.imagem === 'string' && r.imagem.startsWith('data:image/')) m[e] = r.imagem;
  }
  return m;
}

/** As linhas de assinatura que contam para a cópia: as da versão, do fluxo aprovado (o mais recente), por ordem. */
export function linhasDaVersao(linhas, versaoId, fluxoId = null) {
  let l = (Array.isArray(linhas) ? linhas : []).filter(x => x && String(x.versao_id || '') === String(versaoId || ''));
  if (fluxoId) {
    const doFluxo = l.filter(x => String(x.fluxo_id || '') === String(fluxoId));
    if (doFluxo.length) l = doFluxo;
  } else {
    // várias voltas/fluxos na mesma versão: fica o do último acto de aprovação
    const ap = l.filter(x => x.acto === 'aprovacao').sort((a, b) => tempo(b.assinado_em) - tempo(a.assinado_em))[0];
    if (ap?.fluxo_id) l = l.filter(x => String(x.fluxo_id || '') === String(ap.fluxo_id));
  }
  return l.sort((a, b) => (Number(a.acto_ordem) || 0) - (Number(b.acto_ordem) || 0) || tempo(a.assinado_em) - tempo(b.assinado_em));
}

/** Resultado de uma RPC que devolve «linha ou null» — o PostgREST pode mandar objecto, array ou null. */
export function umaLinha(data) {
  if (Array.isArray(data)) return data[0] || null;
  return data && typeof data === 'object' ? data : null;
}

/** Código de verificação (12 primeiros hex, 4-4-4) — cópia local para o ecrã não depender do gerador. */
export function codigoDeSha(sha) {
  const h = String(sha || '').toLowerCase().replace(/[^0-9a-f]/g, '').slice(0, 12);
  if (h.length < 12) return '';
  return `${h.slice(0, 4)}-${h.slice(4, 8)}-${h.slice(8, 12)}`.toUpperCase();
}
