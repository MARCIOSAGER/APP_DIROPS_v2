#!/usr/bin/env node
// Carrega (ou actualiza) os modelos-mestre do editor estruturado em documento_rascunho_estruturado, via PostgREST
// com a service_role. Lê tools/mestres/mestre-*.json; cada ficheiro é o DocumentoEstruturado do mestre (ou
// { conteudo: <documento> }). Idempotente por extras.chave (se faltar, usa o nome do ficheiro).
//
//   node tools/mestres/carregar-mestres.mjs            → simulação (--dry, por omissão): valida e diz o que faria
//   node tools/mestres/carregar-mestres.mjs --apply    → grava
//
// Um mestre fica: documento_id NULO, aeroporto_id NULO, criado_por = oaeroportos@sga.co.ao (o elaborador),
// estado 'em_edicao', conteudo.extras.mestre = true. Nunca toca em documentos nem em versões.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validarDocumentoEstruturado } from '../../src/documentos/edicao/contrato.js';
import { camposUsados, alvosDoMestre } from '../../src/documentos/edicao/mestres.js';

const __dir = path.dirname(fileURLToPath(import.meta.url));
export const ELABORADOR = 'oaeroportos@sga.co.ao';
export const REVISOR = 'cpascoal@sga.co.ao';
const PGRST = process.env.PGRST_URL || 'http://127.0.0.1:3000';
const T = 'documento_rascunho_estruturado';
const CAMPOS_CONHECIDOS = /^(aeroporto\.(nome|icao|iata|cidade|director|director_cargo)|documento\.numero|local\.[\w-]+)$/;

/** Normaliza o conteúdo de um ficheiro de mestre (puro). Devolve { chave, conteudo, problemas, avisos }. */
export function normalizarMestre(json, nomeFicheiro = '') {
  const conteudo = JSON.parse(JSON.stringify(json?.conteudo && json.conteudo.seccoes ? json.conteudo : json || {}));
  const ex = (conteudo.extras = { ...(conteudo.extras || {}) });
  const chave = String(ex.chave || json?.chave || path.basename(nomeFicheiro, '.json').replace(/^mestre-/, '')).trim();
  ex.chave = chave;
  ex.mestre = true;
  if (!ex.elaboradoEmail) ex.elaboradoEmail = ELABORADOR;
  if (!ex.verificadoEmail) ex.verificadoEmail = REVISOR;
  ex.aprovadoEmail = '';
  delete ex.documentoId;
  conteudo.cabecalho = { ...(conteudo.cabecalho || {}) };
  if (!conteudo.cabecalho.aprovadoPor) conteudo.cabecalho.aprovadoPor = '{{aeroporto.director}}';
  if (!conteudo.cabecalho.numero) conteudo.cabecalho.numero = '{{documento.numero}}';
  if (!conteudo.cabecalho.aeroporto) conteudo.cabecalho.aeroporto = '{{aeroporto.icao}}';
  if (!conteudo.cabecalho.aeroportoNome) conteudo.cabecalho.aeroportoNome = '{{aeroporto.nome}}';
  if (!Array.isArray(conteudo.historico)) conteudo.historico = [];

  const problemas = [];
  const avisos = [];
  if (!chave) problemas.push('sem chave');
  const v = validarDocumentoEstruturado(conteudo);
  problemas.push(...v.erros);
  avisos.push(...v.avisos.filter(a => !/ICAO/.test(a)));
  const alvos = alvosDoMestre(conteudo);
  if (!alvos.length) problemas.push('sem alvos (extras.alvos)');
  alvos.forEach((a, i) => { if (!a?.documento_id || !a?.numero || !a?.icao) problemas.push(`alvo ${i + 1}: falta documento_id, numero ou icao`); });
  const desconhecidos = camposUsados(conteudo).filter(c => !CAMPOS_CONHECIDOS.test(c));
  if (desconhecidos.length) problemas.push(`campos desconhecidos: ${desconhecidos.join(', ')}`);
  const locais = camposUsados(conteudo).filter(c => c.startsWith('local.')).map(c => c.slice(6));
  for (const a of alvos) {
    const vl = ex.valoresLocais?.[a.icao] || {};
    const falta = locais.filter(n => !String(vl[n] ?? '').trim());
    if (falta.length) avisos.push(`${a.icao}: sem valor para ${falta.map(n => `local.${n}`).join(', ')}`);
  }
  return { chave, conteudo, problemas, avisos };
}

/** Linha a gravar na tabela. */
export const linhaDoMestre = (conteudo) => ({
  documento_id: null, aeroporto_id: null, modelo: conteudo.modelo, conteudo,
  criado_por: ELABORADOR, actualizado_por: ELABORADOR, estado: 'em_edicao',
});

export function lerFicheiros(dir = __dir) {
  return fs.readdirSync(dir).filter(n => /^mestre-.*\.json$/i.test(n)).sort()
    .map(n => ({ nome: n, json: JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8').replace(/^\uFEFF/, '')) }));
}

/**
 * Corre a carga. `fetch` e `chave` injectáveis (testes). Em dry nunca escreve: só GET.
 * @returns {Promise<{ criar: string[], actualizar: string[], invalidos: Object[], avisos: Object[], gravados: number }>}
 */
export async function carregarMestres({ dir = __dir, aplicar = false, fetch: f = globalThis.fetch, servico, log = console.log } = {}) {
  const key = servico ?? fs.readFileSync('C:/dirops/sga-onpremise/secrets/service_role_key.txt', 'utf8').trim();
  const H = { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json' };
  const get = async (p) => { const r = await f(`${PGRST}${p}`, { headers: H }); if (!r.ok) throw new Error(`GET ${p} → ${r.status} ${await r.text()}`); return r.json(); };

  const ficheiros = lerFicheiros(dir);
  const existentes = await get(`/${T}?documento_id=is.null&conteudo->extras->>mestre=eq.true&select=id,conteudo->extras->>chave`);
  const porChave = new Map(existentes.map(e => [e.chave, e.id]));
  const res = { criar: [], actualizar: [], invalidos: [], avisos: [], gravados: 0 };

  // os documentos-alvo têm de existir (e não estar apagados)
  const todosAlvos = [];
  const normal = ficheiros.map(({ nome, json }) => { const n = normalizarMestre(json, nome); todosAlvos.push(...alvosDoMestre(n.conteudo)); return { nome, ...n }; });
  const ids = [...new Set(todosAlvos.map(a => a.documento_id).filter(Boolean))];
  const docs = ids.length ? await get(`/documento?id=in.(${ids.join(',')})&select=id,numero,aeroporto_id,deleted_at`) : [];
  const docMap = new Map(docs.map(d => [d.id, d]));

  for (const m of normal) {
    for (const a of alvosDoMestre(m.conteudo)) {
      const d = docMap.get(a.documento_id);
      if (!d || d.deleted_at) m.problemas.push(`alvo ${a.icao} ${a.numero}: documento não existe ou está apagado`);
      else if (a.aeroporto_id && d.aeroporto_id !== a.aeroporto_id) m.problemas.push(`alvo ${a.icao} ${a.numero}: o documento é de outro aeroporto`);
      else if (d.numero && a.numero && d.numero !== a.numero) m.avisos.push(`alvo ${a.icao}: número no GED é ${d.numero}, o mestre vai usar ${a.numero}`);
    }
    if (m.avisos.length) res.avisos.push({ ficheiro: m.nome, avisos: m.avisos });
    if (m.problemas.length) { res.invalidos.push({ ficheiro: m.nome, problemas: m.problemas }); log(`✗ ${m.nome}: ${m.problemas.join('; ')}`); continue; }
    const id = porChave.get(m.chave);
    (id ? res.actualizar : res.criar).push(m.chave);
    log(`${id ? '↻ actualizar' : '+ criar'} ${m.chave} — ${m.conteudo.cabecalho?.titulo || ''} (${alvosDoMestre(m.conteudo).length} aeroportos)${m.avisos.length ? ` · ${m.avisos.length} aviso(s)` : ''}`);
    if (!aplicar) continue;
    const corpo = linhaDoMestre(m.conteudo);
    const r = id
      ? await f(`${PGRST}/${T}?id=eq.${id}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify({ conteudo: corpo.conteudo, modelo: corpo.modelo, actualizado_por: ELABORADOR }) })
      : await f(`${PGRST}/${T}`, { method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(corpo) });
    if (!r.ok) throw new Error(`${id ? 'PATCH' : 'POST'} ${m.chave} → ${r.status} ${await r.text()}`);
    res.gravados += 1;
  }
  log(`${aplicar ? 'GRAVADO' : 'SIMULAÇÃO (nada gravado; use --apply)'}: ${res.criar.length} a criar, ${res.actualizar.length} a actualizar, ${res.invalidos.length} inválido(s).`);
  for (const a of res.avisos) log(`  ! ${a.ficheiro}: ${a.avisos.join(' | ')}`);
  return res;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const aplicar = process.argv.includes('--apply');
  carregarMestres({ aplicar }).then(r => { if (r.invalidos.length) process.exitCode = 2; }).catch(e => { console.error(e.message || e); process.exitCode = 1; });
}
