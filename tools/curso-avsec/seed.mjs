#!/usr/bin/env node
// Carrega (ou actualiza) os 2 cursos AVSEC + a trilha AVSEC, via PostgREST (service role). Idempotente.
//   node tools/curso-avsec/seed.mjs [--dry]
import fs from 'node:fs';
import { CURSOS, TRILHA } from './conteudo.mjs';

const PGRST = 'http://127.0.0.1:3000';
const SERVICE = fs.readFileSync('C:\\dirops\\sga-onpremise\\secrets\\service_role_key.txt', 'utf8').trim();
const HDR = { Authorization: 'Bearer ' + SERVICE, apikey: SERVICE, 'Content-Type': 'application/json' };
const DRY = process.argv.includes('--dry');
const log = (m) => console.log('[seed-avsec] ' + m);
const enc = encodeURIComponent;

async function q(p) { const r = await fetch(PGRST + p, { headers: HDR }); if (!r.ok) throw new Error(`GET ${p} → ${r.status} ${await r.text()}`); return r.json(); }
async function post(t, body) { if (DRY) return [{ id: 'dry-' + Math.random().toString(36).slice(2), ...body }]; const r = await fetch(`${PGRST}/${t}`, { method: 'POST', headers: { ...HDR, Prefer: 'return=representation' }, body: JSON.stringify(body) }); if (!r.ok) throw new Error(`POST ${t} → ${r.status} ${await r.text()}`); return r.json(); }
async function patch(t, id, body) { if (DRY) return [{ id, ...body }]; const r = await fetch(`${PGRST}/${t}?id=eq.${id}`, { method: 'PATCH', headers: { ...HDR, Prefer: 'return=representation' }, body: JSON.stringify(body) }); if (!r.ok) throw new Error(`PATCH ${t} → ${r.status} ${await r.text()}`); return r.json(); }
async function del(t, filtro) { if (DRY) return; const r = await fetch(`${PGRST}/${t}?${filtro}`, { method: 'DELETE', headers: HDR }); if (!r.ok) throw new Error(`DELETE ${t} → ${r.status}`); }

async function seedCurso(bundle, instr) {
  const { curso: meta, modulos, perguntas, quiz } = bundle;
  let [curso] = await q('/curso?titulo=eq.' + enc(meta.titulo) + '&deleted_at=is.null&select=*&limit=1');
  const dados = { ...meta, instrutor_email: instr.instrutor_email || null, instrutor_nome: instr.instrutor_nome || null, empresa_id: instr.empresa_id || null, updated_by: 'sistema' };
  if (curso) { [curso] = await patch('curso', curso.id, dados); log(`curso actualizado: ${curso.titulo}`); }
  else { [curso] = await post('curso', { ...dados, created_by: 'sistema' }); log(`curso criado: ${curso.titulo}`); }
  const cid = curso.id;

  const modsExist = DRY ? [] : await q('/modulo?curso_id=eq.' + cid + '&select=id,titulo');
  const aulasExist = DRY ? [] : await q('/aula?curso_id=eq.' + cid + '&select=id,titulo');
  let nAulas = 0;
  for (let mi = 0; mi < modulos.length; mi++) {
    const m = modulos[mi];
    let mod = modsExist.find(x => x.titulo === m.titulo);
    const dMod = { curso_id: cid, titulo: m.titulo, descricao: m.descricao || null, ordem: mi + 1 };
    if (mod) [mod] = await patch('modulo', mod.id, dMod); else [mod] = await post('modulo', dMod);
    for (let ai = 0; ai < m.aulas.length; ai++) {
      const a = m.aulas[ai];
      const dAula = { modulo_id: mod.id, curso_id: cid, titulo: a.titulo, tipo: a.tipo, ordem: ai + 1, duracao_min: a.duracao_min ?? null,
        conteudo_url: a.conteudo_url ?? null, conteudo_texto: a.conteudo_texto ?? null, legendas_url: a.legendas_url ?? null, poster_url: a.poster_url ?? null,
        materiais: a.materiais || [], conclusao: a.conclusao || 'manual', creditos: a.creditos ?? null, opcoes: a.opcoes || {} };
      const ex = aulasExist.find(x => x.titulo === a.titulo);
      if (ex) await patch('aula', ex.id, dAula); else await post('aula', dAula);
      nAulas++;
    }
  }
  log(`  ${modulos.length} módulos, ${nAulas} aulas`);

  const pergExist = DRY ? [] : await q('/pergunta?curso_id=eq.' + cid + '&select=id,enunciado');
  const ids = [];
  for (const p of perguntas) {
    const d = { curso_id: cid, categoria: p.categoria, tipo: p.tipo, enunciado: p.enunciado, opcoes: p.opcoes, pontos: p.pontos ?? 1, explicacao: p.explicacao ?? null, imagem_url: p.imagem_url ?? null, ativo: true, created_by: 'sistema' };
    const ex = pergExist.find(x => x.enunciado === p.enunciado);
    const [row] = ex ? await patch('pergunta', ex.id, d) : await post('pergunta', d);
    ids.push(row.id);
  }
  log(`  ${ids.length} perguntas no banco`);

  let [qz] = DRY ? [] : await q('/quiz?curso_id=eq.' + cid + '&select=id,titulo&limit=1');
  const dQuiz = { ...quiz, curso_id: cid };
  if (qz) [qz] = await patch('quiz', qz.id, dQuiz); else [qz] = await post('quiz', dQuiz);
  if (!DRY) await del('quiz_item', 'quiz_id=eq.' + qz.id);
  for (let i = 0; i < ids.length; i++) await post('quiz_item', { quiz_id: qz.id, ordem: i + 1, modo: 'fixa', pergunta_id: ids[i] });
  log(`  quiz "${qz.titulo}" com ${ids.length} itens`);
  return cid;
}

(async () => {
  const grf = await q('/curso?titulo=like.' + enc('Global Reporting Format*') + '&deleted_at=is.null&select=instrutor_email,instrutor_nome,empresa_id&limit=1');
  const instr = grf[0] || {};

  const idPorTitulo = {};
  for (const b of CURSOS) idPorTitulo[b.curso.titulo] = await seedCurso(b, instr);

  // a trilha AVSEC
  let [trilha] = await q('/trilha?titulo=eq.' + enc(TRILHA.titulo) + '&deleted_at=is.null&select=id,titulo&limit=1');
  const dT = { titulo: TRILHA.titulo, descricao: TRILHA.descricao || null, sequencial: !!TRILHA.sequencial, publicado: true, ordem: 10, obrigatorio_todos: false, obrigatorio_perfis: [], empresa_id: instr.empresa_id || null, updated_by: 'sistema' };
  if (trilha) [trilha] = await patch('trilha', trilha.id, dT); else [trilha] = await post('trilha', { ...dT, created_by: 'sistema' });
  if (!DRY) await del('trilha_curso', 'trilha_id=eq.' + trilha.id);
  for (let k = 0; k < TRILHA.cursos.length; k++) { const cid = idPorTitulo[TRILHA.cursos[k]]; if (cid) await post('trilha_curso', { trilha_id: trilha.id, curso_id: cid, ordem: k + 1, obrigatorio: true }); }
  log(`trilha "${TRILHA.titulo}" com ${TRILHA.cursos.length} curso(s)`);

  if (!DRY) { const cs = await q('/curso?categoria=eq.' + enc('Segurança da Aviação (AVSEC)') + '&deleted_at=is.null&select=titulo,carga_horaria,publicado&order=ordem'); for (const c of cs) log(`✓ ${c.titulo} — ${c.carga_horaria}h · publicado=${c.publicado}`); }
  log('fim');
})().catch(e => { console.error('[seed-avsec] ERRO', e.message); process.exit(1); });
