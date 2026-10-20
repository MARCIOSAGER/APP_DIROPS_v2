#!/usr/bin/env node
// Auditoria automática dos cursos da Universidade Corporativa: dados, ficheiros (HTTP + MIME), vídeos (ffprobe/oEmbed),
// PDFs (pdf.js), pacotes SCORM (manifest) e H5P (bibliotecas), leituras (sanitizer), perguntas (validação + correcção
// simulada com o motor do servidor), quizzes, instrutores/perfis, e lógica de matrícula na BD em transacção descartada.
//   node tools/auditoria-cursos.mjs [--md docs/auditoria-cursos.md] [--so "<parte do título>"]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dir = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(__dir, '..');
const PGRST = 'http://127.0.0.1:3000', WEB = 'http://127.0.0.1', FUNCS = 'http://127.0.0.1:4001';
const STORAGE_DIR = 'C:\\dirops\\sga-onpremise\\storage';
const SERVICE = fs.readFileSync('C:\\dirops\\sga-onpremise\\secrets\\service_role_key.txt', 'utf8').trim();
const HDR = { Authorization: 'Bearer ' + SERVICE, apikey: SERVICE, 'Content-Type': 'application/json' };
const LmsQuiz = require('C:/dirops/sga-onpremise/functions/dirops-functions/lms-quiz.js');
const FFPROBE = 'C:\\dirops\\sga-onpremise\\installers\\ffmpeg\\bin\\ffprobe.exe';
const args = process.argv.slice(2);
const MD = args.includes('--md') ? args[args.indexOf('--md') + 1] : null;
const SO = args.includes('--so') ? args[args.indexOf('--so') + 1].toLowerCase() : null;
const enc = encodeURIComponent;

const achados = []; // { curso, nivel: 'ERRO'|'AVISO'|'OK'|'INFO', area, msg }
const add = (curso, nivel, area, msg) => achados.push({ curso, nivel, area, msg });
const q = async (p) => { const r = await fetch(PGRST + p, { headers: HDR }); if (!r.ok) throw new Error(`GET ${p} → ${r.status} ${await r.text()}`); return r.json(); };
const cacheHead = new Map();
const MIME = { '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.pdf': 'application/pdf', '.mp4': 'video/mp4', '.webm': 'video/webm', '.vtt': 'text/vtt', '.json': 'application/json', '.html': 'text/html', '.zip': 'application/zip', '.js': 'text/javascript', '.css': 'text/css' };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let orcamentoHttpStorage = Number(process.env.AUDIT_HTTP_STORAGE || 20); // o backend limita pedidos/min por IP: o resto verifica-se em disco
const localDe = (url) => { const m = String(url || '').match(/^\/storage\/v1\/object\/public\/([^?#]+)/); return m ? path.join(STORAGE_DIR, decodeURIComponent(m[1]).replace(/\//g, path.sep)) : null; };
async function head(url) {
  if (cacheHead.has(url)) return cacheHead.get(url);
  let res;
  const local = localDe(url);
  if (local && (orcamentoHttpStorage <= 0 || !fs.existsSync(local))) {
    // verificação em disco (mesmo ficheiro que o servidor entrega)
    if (fs.existsSync(local) && fs.statSync(local).isFile()) res = { ok: true, status: 200, tipo: MIME[path.extname(local).toLowerCase()] || 'application/octet-stream', tamanho: fs.statSync(local).size, disco: true };
    else if (fs.existsSync(local) && fs.statSync(local).isDirectory()) res = { ok: true, status: 200, tipo: 'inode/directory', tamanho: 0, disco: true };
    else res = { ok: false, status: 404, tipo: '', disco: true };
    cacheHead.set(url, res); return res;
  }
  if (local) orcamentoHttpStorage--;
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    try {
      const abs = /^https?:/i.test(url) ? url : WEB + url;
      let r = await fetch(abs, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(20000) });
      if (r.status === 405 || r.status === 501) r = await fetch(abs, { method: 'GET', headers: { Range: 'bytes=0-0' }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
      if (r.status === 429) { await sleep(61000); continue; }
      res = { ok: r.ok, status: r.status, tipo: r.headers.get('content-type') || '', tamanho: Number(r.headers.get('content-length') || 0) };
      break;
    } catch (e) { res = { ok: false, status: 0, tipo: '', erro: e.message }; }
  }
  if (!res) res = { ok: false, status: 429, tipo: '', erro: 'rate limit' };
  cacheHead.set(url, res); return res;
}
const ytId = (url) => { try { const u = new URL(url); if (/youtu\.be$/.test(u.hostname)) return u.pathname.slice(1); if (/youtube\.com$/.test(u.hostname)) return u.searchParams.get('v') || (u.pathname.match(/\/(?:embed|shorts|live|v)\/([^/?]+)/) || [])[1] || null; } catch { /* */ } return null; };
async function oembed(id) {
  try { const r = await fetch(`https://www.youtube.com/oembed?url=${enc('https://www.youtube.com/watch?v=' + id)}&format=json`, { signal: AbortSignal.timeout(20000) }); if (!r.ok) return { ok: false, status: r.status }; const j = await r.json(); return { ok: true, titulo: j.title, canal: j.author_name }; } catch (e) { return { ok: false, erro: e.message }; }
}
async function pdfPaginas(local) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(fs.readFileSync(local));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true, isEvalSupported: false }).promise;
  const n = doc.numPages; await doc.destroy(); return n;
}
function ffprobe(local) {
  try { const out = execFileSync(FFPROBE, ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,pix_fmt,width,height:format=duration', '-of', 'json', local], { encoding: 'utf8', timeout: 60000 }); return JSON.parse(out); } catch (e) { return { erro: e.message }; }
}
// sanitizer igual ao de ConteudoAula
let purify = null;
async function sanitizar(html) {
  if (!purify) { const { JSDOM } = await import('jsdom'); const createDOMPurify = (await import('dompurify')).default; purify = createDOMPurify(new JSDOM('').window); }
  return purify.sanitize(html, { ALLOWED_TAGS: ['b', 'i', 'u', 's', 'em', 'strong', 'small', 'sup', 'sub', 'mark', 'a', 'p', 'br', 'hr', 'span', 'div', 'section', 'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'blockquote', 'pre', 'code', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption', 'img', 'figure', 'figcaption', 'details', 'summary'], ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'src', 'alt', 'width', 'height', 'colspan', 'rowspan', 'title', 'open'], ALLOW_DATA_ATTR: false, FORBID_CONTENTS: ['script', 'style'] });
}
const textoDe = (html) => String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

// resposta perfeita para uma pergunta (a partir do gabarito) na forma que o aluno envia
function respostaPerfeita(p, servida) {
  const ops = Array.isArray(p.opcoes) ? p.opcoes : [];
  switch (p.tipo) {
    case 'escolha_unica': case 'vf': return (ops.find(o => o.correta) || {}).id;
    case 'escolha_multipla': return ops.filter(o => o.correta).map(o => o.id);
    case 'lacuna': return ops[0] && ops[0].texto;
    case 'numerica': return ops[0] && ops[0].valor;
    case 'ordenacao': return ops.map(o => o.id);
    case 'correspondencia': return Object.fromEntries(ops.map(o => [o.id, o.id]));
    case 'hotspot': { const z = ops[0]; return z ? { x: z.x + z.w / 2, y: z.y + z.h / 2 } : null; }
    case 'rotulos': { const mapa = servida.mapa_rotulos || {}; const out = {}; for (const [lid, zid] of Object.entries(mapa)) out[zid] = lid; return out; }
    case 'aberta': return 'Resposta de teste da auditoria.';
    default: return null;
  }
}

(async () => {
  const t0 = Date.now();
  const [cursos, modulos, aulas, perguntas, quizzes, itens, assinantes, users, regras, sessoes] = await Promise.all([
    q('/curso?deleted_at=is.null&select=*&order=titulo'), q('/modulo?select=*&order=ordem'), q('/aula?select=*&order=ordem'), q('/pergunta?select=*'), q('/quiz?select=*'), q('/quiz_item?select=*'),
    q('/certificado_assinante?select=id,nome,cargo,curso_id,ativo'), q('/users?select=email,perfis,status&limit=5000').catch(() => []), q('/regra_permissao?select=perfil').catch(() => []), q('/sessao_formacao?deleted_at=is.null&select=*').catch(() => []),
  ]);
  const perfisValidos = new Set(regras.map(r => r.perfil));
  const pagesConfig = fs.existsSync(path.join(RAIZ, 'src', 'pages.config.js')) ? fs.readFileSync(path.join(RAIZ, 'src', 'pages.config.js'), 'utf8') : '';
  // backend ao vivo
  try { const caps = await (await fetch(FUNCS + '/functions/lms-upload', { signal: AbortSignal.timeout(5000) })).json(); add('(sistema)', 'INFO', 'backend', `capacidades: libreoffice=${caps.libreoffice} ffmpeg=${caps.ffmpeg} kinds=${Object.keys(caps.kinds || {}).join(',')}`); if (!caps.kinds || !caps.kinds.h5p) add('(sistema)', 'AVISO', 'backend', 'o backend em execução ainda não tem o patch 10 (upload .h5p) — falta reiniciar dirops-functions-v2'); } catch (e) { add('(sistema)', 'ERRO', 'backend', 'functions (4001) não responde: ' + e.message); }
  add('(sistema)', 'INFO', 'assinantes', `${assinantes.filter(a => a.ativo !== false).length} assinantes de certificado activos (${assinantes.filter(a => !a.curso_id).length} globais)`);

  for (const c of cursos) {
    if (SO && !c.titulo.toLowerCase().includes(SO)) continue;
    const T = c.titulo;
    const mods = modulos.filter(m => m.curso_id === c.id).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
    const idsMod = new Set(mods.map(m => m.id));
    const auls = aulas.filter(a => idsMod.has(a.modulo_id));
    const perg = perguntas.filter(p => p.curso_id === c.id);
    const qz = quizzes.filter(x => x.curso_id === c.id);
    // ---- curso
    if (!c.descricao || c.descricao.length < 120) add(T, 'AVISO', 'curso', 'descrição curta ou em falta');
    if (/curso de exemplo|pode ser removido/i.test(c.descricao || '')) add(T, 'ERRO', 'curso', 'descrição ainda diz "curso de exemplo"');
    if (!c.categoria) add(T, 'AVISO', 'curso', 'sem categoria');
    if (c.publicado && !c.capa_url) add(T, 'AVISO', 'curso', 'sem capa (o cartão usa cor da categoria)');
    if (c.capa_url) { const h = await head(c.capa_url); if (!h.ok) add(T, 'ERRO', 'curso', `capa inacessível (${h.status}) ${c.capa_url}`); else if (!/^image\//.test(h.tipo)) add(T, 'AVISO', 'curso', `capa com MIME ${h.tipo}`); }
    const minutos = auls.reduce((s, a) => s + (Number(a.duracao_min) || 0), 0);
    const esperado = minutos > 0 ? Math.ceil(minutos / 60) : null;
    if (Number(c.carga_horaria) !== esperado && !(c.carga_horaria == null && esperado == null)) add(T, 'ERRO', 'curso', `carga_horaria=${c.carga_horaria} mas as aulas somam ${minutos} min (esperado ${esperado})`);
    if (c.instrutor_email) { const u = users.find(x => x.email && x.email.toLowerCase() === c.instrutor_email.toLowerCase()); if (!u) add(T, 'AVISO', 'curso', `instrutor ${c.instrutor_email} não existe em users`); else if (!(u.perfis || []).some(p => ['instrutor', 'administrador', 'admin'].includes(p))) add(T, 'AVISO', 'curso', `instrutor ${c.instrutor_email} sem perfil instrutor/administrador`); else if (u.status && u.status !== 'ativo') add(T, 'AVISO', 'curso', `instrutor ${c.instrutor_email} está ${u.status}`); } else add(T, 'AVISO', 'curso', 'sem instrutor responsável');
    for (const p of c.obrigatorio_perfis || []) if (!perfisValidos.has(p)) add(T, 'ERRO', 'curso', `perfil obrigatório desconhecido: ${p}`);
    if (c.tipo_formacao === 'refrescamento' && !c.curso_base_id) add(T, 'ERRO', 'curso', 'refrescamento sem curso base');
    if (c.publicado && mods.length === 0) add(T, 'ERRO', 'curso', 'publicado sem módulos');
    // ---- módulos
    mods.forEach((m, i) => { if (m.ordem !== i + 1) add(T, 'AVISO', 'módulos', `ordem não contígua: "${m.titulo}" tem ordem ${m.ordem} (posição ${i + 1})`); if (!auls.some(a => a.modulo_id === m.id)) add(T, 'ERRO', 'módulos', `módulo "${m.titulo}" sem aulas`); if (!m.descricao) add(T, 'AVISO', 'módulos', `módulo "${m.titulo}" sem descrição`); });
    // ---- aulas
    for (const a of auls) {
      const L = `aula "${a.titulo.slice(0, 60)}"`;
      if (!a.duracao_min || Number(a.duracao_min) <= 0) add(T, 'AVISO', 'aulas', `${L}: sem duração (carga horária incompleta)`);
      if (a.tipo === 'presencial' && a.conclusao !== 'presenca') add(T, 'ERRO', 'aulas', `${L}: presencial com conclusão ${a.conclusao}`);
      if (a.tipo !== 'presencial' && a.conclusao === 'presenca') add(T, 'ERRO', 'aulas', `${L}: conclusão por presença numa aula ${a.tipo}`);
      if (a.conclusao === 'automatica' && !(a.tipo === 'html5' && a.opcoes && a.opcoes.norma)) add(T, 'ERRO', 'aulas', `${L}: conclusão automática sem pacote com norma — nunca concluirá`);
      const precisaUrl = ['video', 'pdf', 'html5', 'link'].includes(a.tipo);
      if (precisaUrl && !a.conteudo_url) { add(T, 'ERRO', 'aulas', `${L}: sem conteúdo (URL)`); continue; }
      if (a.tipo === 'texto' || a.tipo === 'presencial') {
        const html = a.conteudo_texto || '';
        if (a.tipo === 'texto' && textoDe(html).length < 200) add(T, 'AVISO', 'aulas', `${L}: texto muito curto (${textoDe(html).length} caracteres)`);
        if (html) {
          const limpo = await sanitizar(html); const antes = textoDe(html).length, depois = textoDe(limpo).length;
          if (antes && depois < antes * 0.95) add(T, 'ERRO', 'aulas', `${L}: o sanitizer remove ${antes - depois} caracteres (HTML com tags não permitidas)`);
          for (const m of html.matchAll(/<img[^>]+src="([^"]+)"/g)) { const h = await head(m[1]); if (!h.ok) add(T, 'ERRO', 'aulas', `${L}: imagem inacessível (${h.status}) ${m[1]}`); }
          if (/<(script|style|iframe)/i.test(html)) add(T, 'AVISO', 'aulas', `${L}: contém script/style/iframe (removidos ao mostrar)`);
        }
      }
      if (a.tipo === 'video') {
        const id = ytId(a.conteudo_url);
        if (id) { const o = await oembed(id); if (!o.ok) add(T, 'ERRO', 'aulas', `${L}: vídeo YouTube ${id} indisponível (${o.status || o.erro})`); if (!a.creditos) add(T, 'AVISO', 'aulas', `${L}: vídeo externo sem créditos`); }
        else if (/vimeo\.com/.test(a.conteudo_url)) { const h = await head(a.conteudo_url); if (!h.ok) add(T, 'ERRO', 'aulas', `${L}: Vimeo inacessível (${h.status})`); }
        else {
          const h = await head(a.conteudo_url);
          if (!h.ok) add(T, 'ERRO', 'aulas', `${L}: vídeo inacessível (${h.status}) ${a.conteudo_url}`);
          else if (!/^video\//.test(h.tipo)) add(T, 'ERRO', 'aulas', `${L}: MIME do vídeo é ${h.tipo}`);
          const local = localDe(a.conteudo_url);
          if (local && fs.existsSync(local) && fs.existsSync(FFPROBE)) {
            const info = ffprobe(local);
            if (info.erro) add(T, 'ERRO', 'aulas', `${L}: ffprobe falhou (${info.erro.slice(0, 80)})`);
            else { const v = (info.streams || []).find(s => s.codec_type === 'video'), au = (info.streams || []).find(s => s.codec_type === 'audio'); if (!v) add(T, 'ERRO', 'aulas', `${L}: ficheiro sem faixa de vídeo`); else { if (v.codec_name !== 'h264') add(T, 'AVISO', 'aulas', `${L}: codec ${v.codec_name} (o browser pode não reproduzir; ideal H.264)`); if (v.pix_fmt && v.pix_fmt !== 'yuv420p') add(T, 'AVISO', 'aulas', `${L}: pix_fmt ${v.pix_fmt} (ideal yuv420p)`); } if (au && !['aac', 'mp3'].includes(au.codec_name)) add(T, 'AVISO', 'aulas', `${L}: áudio ${au.codec_name}`); const dur = Number(info.format && info.format.duration); if (dur && a.duracao_min && Math.abs(dur / 60 - a.duracao_min) > Math.max(3, a.duracao_min * 0.5)) add(T, 'AVISO', 'aulas', `${L}: duração real ${Math.round(dur / 60)} min vs ${a.duracao_min} min indicados`); }
          } else if (local && !fs.existsSync(local)) add(T, 'ERRO', 'aulas', `${L}: ficheiro não existe em disco ${local}`);
        }
        if (a.legendas_url) { const h = await head(a.legendas_url); if (!h.ok) add(T, 'ERRO', 'aulas', `${L}: legendas inacessíveis (${h.status})`); else { try { const t = await (await fetch(WEB + a.legendas_url)).text(); if (!/^WEBVTT/.test(t.trim())) add(T, 'ERRO', 'aulas', `${L}: legendas não começam por WEBVTT`); } catch { /* */ } } }
        if (a.poster_url) { const h = await head(a.poster_url); if (!h.ok) add(T, 'ERRO', 'aulas', `${L}: poster inacessível (${h.status})`); }
      }
      if (a.tipo === 'pdf') {
        const h = await head(a.conteudo_url);
        if (!h.ok) add(T, 'ERRO', 'aulas', `${L}: PDF inacessível (${h.status}) ${a.conteudo_url}`);
        else if (!/pdf/.test(h.tipo)) add(T, 'ERRO', 'aulas', `${L}: MIME ${h.tipo} (esperado application/pdf)`);
        const local = localDe(a.conteudo_url);
        if (local && fs.existsSync(local)) { try { const n = await pdfPaginas(local); if (!n) add(T, 'ERRO', 'aulas', `${L}: PDF sem páginas`); else if (n > 120) add(T, 'AVISO', 'aulas', `${L}: PDF com ${n} páginas (pesado para leitura em aula)`); if (fs.statSync(local).size > 60 * 1024 * 1024) add(T, 'AVISO', 'aulas', `${L}: PDF com ${Math.round(fs.statSync(local).size / 1048576)} MB`); } catch (e) { add(T, 'ERRO', 'aulas', `${L}: pdf.js não abre o PDF (${e.message.slice(0, 80)})`); } }
        else if (local) add(T, 'ERRO', 'aulas', `${L}: ficheiro não existe em disco`);
      }
      if (a.tipo === 'html5') {
        const norma = a.opcoes && a.opcoes.norma;
        const h = await head(a.conteudo_url.endsWith('/') ? a.conteudo_url + (norma === 'h5p' ? 'h5p.json' : 'index.html') : a.conteudo_url);
        if (!h.ok) add(T, 'ERRO', 'aulas', `${L}: pacote inacessível (${h.status}) ${a.conteudo_url}`);
        const local = localDe(a.conteudo_url);
        if (local) {
          const dir = a.conteudo_url.endsWith('/') ? local : path.dirname(local);
          if (!fs.existsSync(dir)) add(T, 'ERRO', 'aulas', `${L}: pasta do pacote não existe`);
          else if (norma === 'h5p') {
            const hj = path.join(dir, 'h5p.json'), cj = path.join(dir, 'content', 'content.json');
            if (!fs.existsSync(hj) || !fs.existsSync(cj)) add(T, 'ERRO', 'aulas', `${L}: H5P sem h5p.json/content.json`);
            else { try { const meta = JSON.parse(fs.readFileSync(hj, 'utf8')); JSON.parse(fs.readFileSync(cj, 'utf8')); for (const d of meta.preloadedDependencies || []) { const lib = `${d.machineName}-${d.majorVersion}.${d.minorVersion}`; if (!fs.existsSync(path.join(dir, lib, 'library.json'))) add(T, 'ERRO', 'aulas', `${L}: biblioteca H5P em falta ${lib}`); } if (meta.mainLibrary && !(meta.preloadedDependencies || []).some(d => d.machineName === meta.mainLibrary)) add(T, 'ERRO', 'aulas', `${L}: mainLibrary ${meta.mainLibrary} não está nas dependências`); if (a.conclusao === 'automatica' && !/^H5P\.(MultiChoice|SingleChoiceSet|TrueFalse|Blanks|DragQuestion|DragText|MarkTheWords|QuestionSet|Summary|InteractiveVideo|CoursePresentation|Essay|ImageHotspotQuestion|MemoryGame|Flashcards|Crossword|ArithmeticQuiz|SortParagraphs|ImagePair|ImageSequencing|MultiMediaChoice|Questionnaire|BranchingScenario|InteractiveBook|Dictation|SpeakTheWords|FindTheWords|AdvancedBlanks|Cornell|GuessTheAnswer|PersonalityQuiz)$/.test(meta.mainLibrary || '')) add(T, 'ERRO', 'aulas', `${L}: conclusão automática mas ${meta.mainLibrary} não reporta pontuação — o aluno nunca conclui`); } catch (e) { add(T, 'ERRO', 'aulas', `${L}: H5P JSON inválido (${e.message.slice(0, 60)})`); } }
          } else if (norma === 'scorm12' || norma === 'scorm2004') {
            const man = path.join(dir, 'imsmanifest.xml');
            if (!fs.existsSync(man)) add(T, 'ERRO', 'aulas', `${L}: SCORM sem imsmanifest.xml na pasta do index`);
            else { const xml = fs.readFileSync(man, 'utf8'); const sv = (xml.match(/<(?:\w+:)?schemaversion>\s*([^<]+)</i) || [])[1] || ''; const detect = /2004|1\.3|CAM/i.test(sv) ? 'scorm2004' : 'scorm12'; if (detect !== norma) add(T, 'AVISO', 'aulas', `${L}: manifest diz ${sv || '?'} (${detect}) mas a aula está como ${norma}`); }
            if (!fs.existsSync(local) && !a.conteudo_url.endsWith('/')) add(T, 'ERRO', 'aulas', `${L}: index não existe em disco`);
          } else if (norma === 'xapi') { if (!fs.existsSync(path.join(dir, 'tincan.xml'))) add(T, 'AVISO', 'aulas', `${L}: xAPI sem tincan.xml`); }
          else if (!norma && a.conclusao === 'automatica') add(T, 'ERRO', 'aulas', `${L}: automática sem norma`);
        }
      }
      if (a.tipo === 'link') {
        if (/^\//.test(a.conteudo_url)) { const key = a.conteudo_url.split('?')[0].replace(/^\//, ''); if (pagesConfig && !new RegExp(`"${key}"\\s*:`).test(pagesConfig)) add(T, 'ERRO', 'aulas', `${L}: página interna "${key}" não existe`); }
        else { const h = await head(a.conteudo_url); if (!h.ok) add(T, 'AVISO', 'aulas', `${L}: ligação externa respondeu ${h.status || h.erro}`); }
      }
      for (const m of Array.isArray(a.materiais) ? a.materiais : []) { if (!m || !m.url) { add(T, 'ERRO', 'aulas', `${L}: material sem URL`); continue; } const h = await head(m.url); if (!h.ok) add(T, 'ERRO', 'aulas', `${L}: material "${m.nome || m.url}" inacessível (${h.status})`); }
    }
    // ---- perguntas + correcção simulada
    for (const p of perg) {
      const P = `pergunta "${String(p.enunciado).slice(0, 50)}"`;
      const erros = LmsQuiz.validarPergunta(p);
      if (erros.length) { add(T, 'ERRO', 'perguntas', `${P}: ${erros.join('; ')}`); continue; }
      if (p.imagem_url) { const h = await head(p.imagem_url); if (!h.ok) add(T, 'ERRO', 'perguntas', `${P}: imagem inacessível (${h.status})`); }
      if (['hotspot', 'rotulos'].includes(p.tipo)) for (const z of p.opcoes || []) if ([z.x, z.y, z.w, z.h].some(v => !(Number(v) >= 0 && Number(v) <= 100)) || z.x + z.w > 100.5 || z.y + z.h > 100.5) add(T, 'ERRO', 'perguntas', `${P}: zona ${z.id} fora da imagem (${z.x},${z.y},${z.w},${z.h})`);
      if (!p.explicacao && p.tipo !== 'aberta') add(T, 'AVISO', 'perguntas', `${P}: sem explicação para a revisão`);
      try {
        const base = p.tipo === 'rotulos' ? LmsQuiz.prepararRotulos(p) : p;
        const servida = LmsQuiz.prepararParaAluno(base, true);
        if (JSON.stringify(servida).match(/"correta"|gabarito|"rotulo"/)) add(T, 'ERRO', 'perguntas', `${P}: a versão servida ao aluno contém o gabarito`);
        const cheia = LmsQuiz.corrigirTentativa([base], { [p.id]: respostaPerfeita(p, base) });
        const vazia = LmsQuiz.corrigirTentativa([base], {});
        const c = cheia.porPergunta[0];
        if (p.tipo === 'aberta') { if (!c.pendente) add(T, 'ERRO', 'perguntas', `${P}: resposta aberta não fica pendente`); }
        else { if (!c.correta) add(T, 'ERRO', 'perguntas', `${P}: a resposta perfeita não dá nota máxima (${c.pontos_obtidos}/${c.pontos_max})`); if (vazia.porPergunta[0].pontos_obtidos !== 0) add(T, 'ERRO', 'perguntas', `${P}: resposta vazia dá pontos`); }
      } catch (e) { add(T, 'ERRO', 'perguntas', `${P}: o motor de correcção rebentou (${e.message.slice(0, 80)})`); }
    }
    // ---- quizzes
    if (c.publicado && qz.filter(x => x.ativo && x.gera_certificado).length === 0) add(T, 'AVISO', 'quiz', 'sem avaliação activa que gere certificado');
    for (const z of qz) {
      const its = itens.filter(i => i.quiz_id === z.id);
      if (!its.length) add(T, 'ERRO', 'quiz', `quiz "${z.titulo}" sem itens`);
      for (const it of its) { if (it.modo === 'fixa') { const pp = perg.find(x => x.id === it.pergunta_id); if (!pp) add(T, 'ERRO', 'quiz', `quiz "${z.titulo}": item aponta para pergunta inexistente ou de outro curso`); else if (!pp.ativo) add(T, 'AVISO', 'quiz', `quiz "${z.titulo}": pergunta inactiva "${pp.enunciado.slice(0, 40)}"`); } else { const n = perg.filter(x => x.ativo && (!it.categoria || x.categoria === it.categoria)).length; if (n < (it.quantidade || 1)) add(T, 'ERRO', 'quiz', `quiz "${z.titulo}": sorteio pede ${it.quantidade} de "${it.categoria}" mas só há ${n}`); } }
      if (!(z.nota_minima > 0 && z.nota_minima <= 100)) add(T, 'ERRO', 'quiz', `quiz "${z.titulo}": nota mínima ${z.nota_minima}`);
      const montadas = LmsQuiz.montarPerguntas(z, its, perg);
      if (montadas.length === 0) add(T, 'ERRO', 'quiz', `quiz "${z.titulo}": a montagem não produz perguntas`);
      const totalPontos = montadas.reduce((s, p) => s + (Number(p.pontos) || 1), 0);
      add(T, 'INFO', 'quiz', `quiz "${z.titulo}": ${montadas.length} perguntas (${totalPontos} pontos), mínimo ${z.nota_minima}%, ${z.tentativas_max ?? '∞'} tentativas, ${z.tempo_limite_min ?? '—'} min, sem consulta=${!!z.modo_sem_consulta}, certificado=${!!z.gera_certificado}`);
    }
    // ---- certificado
    const cc = c.certificado_config || {};
    if (qz.some(x => x.gera_certificado)) { if (!assinantes.some(a => a.ativo !== false && (!a.curso_id || a.curso_id === c.id))) add(T, 'ERRO', 'certificado', 'sem assinantes activos'); if (cc.logo_url) { const h = await head(cc.logo_url); if (!h.ok) add(T, 'ERRO', 'certificado', `logo inacessível (${h.status})`); } if (cc.arte_url) { const h = await head(cc.arte_url); if (!h.ok) add(T, 'ERRO', 'certificado', `arte inacessível (${h.status})`); } }
    // ---- sessões
    for (const s of sessoes.filter(x => x.curso_id === c.id)) { if (s.aula_id && !auls.some(a => a.id === s.aula_id && a.tipo === 'presencial')) add(T, 'ERRO', 'sessões', `sessão "${s.titulo}" ligada a aula inexistente/não presencial`); if (s.modalidade !== 'presencial' && !s.link_online) add(T, 'AVISO', 'sessões', `sessão "${s.titulo}" online/híbrida sem ligação`); for (const m of Array.isArray(s.materiais) ? s.materiais : []) { const h = await head(m.url); if (!h.ok) add(T, 'ERRO', 'sessões', `sessão "${s.titulo}": material inacessível`); } }
    if (auls.some(a => a.tipo === 'presencial') && !sessoes.some(x => x.curso_id === c.id && x.estado === 'agendada' && new Date(x.fim) > new Date())) add(T, 'AVISO', 'sessões', 'tem aula presencial mas nenhuma sessão futura agendada — os alunos não conseguem concluir o curso');
    add(T, 'INFO', 'resumo', `${mods.length} módulos · ${auls.length} aulas (${Object.entries(auls.reduce((o, a) => { o[a.tipo] = (o[a.tipo] || 0) + 1; return o; }, {})).map(([k, v]) => `${k}:${v}`).join(', ')}) · ${minutos} min → ${c.carga_horaria} h · ${perg.length} perguntas · publicado=${c.publicado}`);
  }

  // ---- relatório
  const ordem = { ERRO: 0, AVISO: 1, INFO: 2, OK: 3 };
  const porCurso = {};
  for (const a of achados) (porCurso[a.curso] ||= []).push(a);
  const nErro = achados.filter(a => a.nivel === 'ERRO').length, nAviso = achados.filter(a => a.nivel === 'AVISO').length;
  const linhas = [`# Auditoria dos cursos — ${new Date().toLocaleString('pt-PT')}`, '', `**${cursos.length} cursos · ${nErro} erros · ${nAviso} avisos** (${Math.round((Date.now() - t0) / 1000)} s)`, ''];
  for (const [curso, lista] of Object.entries(porCurso)) {
    linhas.push(`## ${curso}`, '');
    for (const a of lista.sort((x, y) => ordem[x.nivel] - ordem[y.nivel])) linhas.push(`- ${a.nivel === 'ERRO' ? '❌' : a.nivel === 'AVISO' ? '⚠️' : 'ℹ️'} **${a.area}** — ${a.msg}`);
    linhas.push('');
  }
  const md = linhas.join('\n');
  console.log(md);
  if (MD) { fs.mkdirSync(path.dirname(MD), { recursive: true }); fs.writeFileSync(MD, md); console.log(`\nrelatório: ${MD}`); }
  process.exit(nErro ? 2 : 0);
})().catch(e => { console.error('[auditoria] ERRO fatal:', e.stack || e.message); process.exit(1); });
