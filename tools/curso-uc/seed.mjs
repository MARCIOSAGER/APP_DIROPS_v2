#!/usr/bin/env node
// Carrega (ou actualiza) o curso "Como usar a Universidade Corporativa" via PostgREST (service role):
// curso, módulos, aulas, banco de perguntas, quiz e itens. Idempotente: procura por título/enunciado.
//   node tools/curso-uc/seed.mjs [--dry]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CURSO, MODULOS, PERGUNTAS, QUIZ } from './conteudo.mjs';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const PGRST = 'http://127.0.0.1:3000';
const SERVICE = fs.readFileSync('C:\\dirops\\sga-onpremise\\secrets\\service_role_key.txt', 'utf8').trim();
const HDR = { Authorization: 'Bearer ' + SERVICE, apikey: SERVICE, 'Content-Type': 'application/json' };
const DRY = process.argv.includes('--dry');
const log = (m) => console.log('[seed-uc] ' + m);

async function q(p) { const r = await fetch(PGRST + p, { headers: HDR }); if (!r.ok) throw new Error(`GET ${p} → ${r.status} ${await r.text()}`); return r.json(); }
async function post(t, body) { if (DRY) return [{ id: 'dry-' + Math.random().toString(36).slice(2), ...body }]; const r = await fetch(`${PGRST}/${t}`, { method: 'POST', headers: { ...HDR, Prefer: 'return=representation' }, body: JSON.stringify(body) }); if (!r.ok) throw new Error(`POST ${t} → ${r.status} ${await r.text()}`); return r.json(); }
async function patch(t, id, body) { if (DRY) return [{ id, ...body }]; const r = await fetch(`${PGRST}/${t}?id=eq.${id}`, { method: 'PATCH', headers: { ...HDR, Prefer: 'return=representation' }, body: JSON.stringify(body) }); if (!r.ok) throw new Error(`PATCH ${t} → ${r.status} ${await r.text()}`); return r.json(); }
const enc = encodeURIComponent;

(async () => {
  // instrutor: o mesmo do curso GRF (dono)
  const grf = await q('/curso?titulo=like.' + enc('Global Reporting Format*') + '&deleted_at=is.null&select=instrutor_email,instrutor_nome,empresa_id&limit=1');
  const instr = grf[0] || {};
  // curso
  let [curso] = await q('/curso?titulo=eq.' + enc(CURSO.titulo) + '&deleted_at=is.null&select=*&limit=1');
  const dadosCurso = { ...CURSO, instrutor_email: instr.instrutor_email || null, instrutor_nome: instr.instrutor_nome || null, empresa_id: instr.empresa_id || null, updated_by: 'sistema' };
  if (curso) { [curso] = await patch('curso', curso.id, dadosCurso); log(`curso actualizado: ${curso.titulo}`); }
  else { [curso] = await post('curso', { ...dadosCurso, created_by: 'sistema' }); log(`curso criado: ${curso.titulo}`); }
  const cid = curso.id;
  // módulos + aulas
  const modsExist = DRY ? [] : await q('/modulo?curso_id=eq.' + cid + '&select=id,titulo,ordem');
  const aulasExist = DRY ? [] : await q('/aula?curso_id=eq.' + cid + '&select=id,titulo,modulo_id');
  let nAulas = 0;
  for (let mi = 0; mi < MODULOS.length; mi++) {
    const m = MODULOS[mi];
    let mod = modsExist.find(x => x.titulo === m.titulo);
    const dadosMod = { curso_id: cid, titulo: m.titulo, descricao: m.descricao || null, ordem: mi + 1 };
    if (mod) [mod] = await patch('modulo', mod.id, dadosMod); else [mod] = await post('modulo', dadosMod);
    for (let ai = 0; ai < m.aulas.length; ai++) {
      const a = m.aulas[ai];
      const dadosAula = { modulo_id: mod.id, curso_id: cid, titulo: a.titulo, tipo: a.tipo, ordem: ai + 1, duracao_min: a.duracao_min ?? null,
        conteudo_url: a.conteudo_url ?? null, conteudo_texto: a.conteudo_texto ?? null, legendas_url: a.legendas_url ?? null, poster_url: a.poster_url ?? null,
        materiais: a.materiais || [], conclusao: a.conclusao || 'manual', creditos: a.creditos ?? null, opcoes: a.opcoes || {} };
      const ex = aulasExist.find(x => x.titulo === a.titulo);
      if (ex) await patch('aula', ex.id, dadosAula); else await post('aula', dadosAula);
      nAulas++;
    }
  }
  log(`${MODULOS.length} módulos, ${nAulas} aulas`);
  // banco de perguntas
  const pergExist = DRY ? [] : await q('/pergunta?curso_id=eq.' + cid + '&select=id,enunciado');
  const ids = [];
  for (const p of PERGUNTAS) {
    const dados = { curso_id: cid, categoria: p.categoria, tipo: p.tipo, enunciado: p.enunciado, opcoes: p.opcoes, pontos: p.pontos ?? 1, explicacao: p.explicacao ?? null, imagem_url: p.imagem_url ?? null, ativo: true, created_by: 'sistema' };
    const ex = pergExist.find(x => x.enunciado === p.enunciado);
    const [row] = ex ? await patch('pergunta', ex.id, dados) : await post('pergunta', dados);
    ids.push(row.id);
  }
  log(`${ids.length} perguntas no banco`);
  // quiz + itens (fixos, pela ordem do banco)
  let [quiz] = DRY ? [] : await q('/quiz?curso_id=eq.' + cid + '&select=id,titulo&limit=1');
  const dadosQuiz = { ...QUIZ, curso_id: cid };
  if (quiz) [quiz] = await patch('quiz', quiz.id, dadosQuiz); else [quiz] = await post('quiz', dadosQuiz);
  if (!DRY) { const r = await fetch(`${PGRST}/quiz_item?quiz_id=eq.${quiz.id}`, { method: 'DELETE', headers: HDR }); if (!r.ok) throw new Error('DELETE quiz_item ' + r.status); }
  for (let i = 0; i < ids.length; i++) await post('quiz_item', { quiz_id: quiz.id, ordem: i + 1, modo: 'fixa', pergunta_id: ids[i] });
  log(`quiz "${quiz.titulo}" com ${ids.length} itens`);
  // carga horária: os triggers recalculam; confirmar
  if (!DRY) { const [c] = await q('/curso?id=eq.' + cid + '&select=carga_horaria,publicado,versao_atual'); log(`carga_horaria=${c.carga_horaria} h · publicado=${c.publicado} · versão ${c.versao_atual}`); }
  log('fim');
})().catch(e => { console.error('[seed-uc] ERRO', e.message); process.exit(1); });
