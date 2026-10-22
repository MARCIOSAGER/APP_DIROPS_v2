#!/usr/bin/env node
// PATCH 34 — perfis próprios da Universidade (migração 188, tools/uc-perfis/188_uc_perfis_personalizados.sql).
//
// O servidor tinha listas fixas dos perfis da Universidade (formando / instrutor / admin_universidade). Passa a
// conhecer os perfis personalizados «uc_…» criados pelo administrador, cada um sobre um NÍVEL BASE (formando ou
// instrutor), lidos de universidade_permissao (personalizado = true) e refrescados no máximo a cada 30 s — o mesmo
// molde do patch 29 do Portal de Documentos (DOCS_PERFIS/DOCS_NIVEL).
//
// O que muda, ponto a ponto:
//   1) bloco novo antes de requireGestorFormacao: UNIV_NIVEL (perfil → nível), univPerfisRefrescar(),
//      univPerfilProprio(), univEhInstrutor().
//   2) requireGestorFormacao (carregar conteúdos, corrigir avaliações): nível instrutor conta como instrutor e
//      admin_universidade passa a ser aceite (coerente com pode_gerir_formacao() na base de dados).
//   3) univCaller (gestão de acessos/avisos da Universidade): nível instrutor conta como instrutor.
//   4) destinatários dos avisos: «formandos» inclui quem tem perfil próprio; «gestores» inclui o nível instrutor.
//   5) aprovar pedido / convidar: aceitam perfis próprios existentes; um perfil de nível instrutor, como o
//      instrutor, só um administrador o atribui.
//   6) acção «perfis»: recebe body.personalizados (nomes uc_…); os perfis próprios antigos ou apagados saem.
//   7) acção «excluir» (perfil mantido no DIROPS): também lhe tira os perfis próprios da Universidade.
// Sem a migração 188 aplicada, a lista de perfis próprios fica vazia e tudo funciona como antes.
//
// Uso:  node patch34-uc-perfis.mjs --verificar   (confirma as âncoras e que o resultado compila; não escreve)
//       node patch34-uc-perfis.mjs               (aplica, com backup server.js.bak-patch34-<data>)
//       SERVER_JS=<caminho> node patch34-uc-perfis.mjs …   (outro ficheiro — p.ex. uma cópia para testar)
// Idempotente: se o marcador PATCH 34 já lá estiver, não faz nada. Depois: Restart-Service dirops-functions-v2.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const SERVER = process.env.SERVER_JS || 'C:/dirops/sga-onpremise/functions/dirops-functions/server.js';
const verificar = process.argv.includes('--verificar');
const MARCADOR = '// PATCH 34: perfis próprios da Universidade';

const src = fs.readFileSync(SERVER, 'utf8');
if (src.includes(MARCADOR)) {
  console.log('[patch34] já aplicado — nada a fazer.');
  process.exit(0);
}

const ANCORA_PERFIS_CONVITE = `      if (perfis.includes('instrutor') && !who.admin) return sendJSON(res, 403, { error: 'só um administrador pode atribuir o perfil de instrutor' });
      perfis = perfis.filter(p => ['formando', 'instrutor'].includes(p)); if (!perfis.length) perfis = ['formando'];
`;
const NOVO_PERFIS_CONVITE = `      // PATCH 34: perfis próprios (uc_…) existentes também; os de nível instrutor, como o instrutor, só um administrador os dá
      if ((perfis.includes('instrutor') || perfis.some(p => UNIV_NIVEL[p] === 'instrutor')) && !who.admin) return sendJSON(res, 403, { error: 'só um administrador pode atribuir o perfil de instrutor ou um perfil próprio de nível instrutor' });
      perfis = [...new Set(perfis.filter(p => ['formando', 'instrutor'].includes(p) || univPerfilProprio(p)))]; if (!perfis.length) perfis = ['formando'];
`;

const trocas = [
  {
    nome: 'bloco UNIV_NIVEL / univPerfisRefrescar',
    ancora: 'async function requireGestorFormacao(req) {\n',
    novo: `${MARCADOR} (migração 188) — perfis personalizados «uc_…» sobre um NÍVEL BASE
// (formando | instrutor), guardados em universidade_permissao. Lista viva, refrescada no máximo a cada 30 s; enquanto a
// migração não estiver aplicada fica vazia e tudo funciona como antes. Igual ao DOCS_NIVEL do Portal de Documentos.
const UNIV_RE_PROPRIO = /^uc_[a-z0-9_]{2,40}$/;
const UNIV_NIVEL = {};
let _univPerfisAt = 0;
async function univPerfisRefrescar(forcar) {
  if (!forcar && Date.now() - _univPerfisAt < 30000) return;
  _univPerfisAt = Date.now();
  try {
    const r = await postgrest('/universidade_permissao?personalizado=eq.true&select=perfil,nivel', 'GET');
    if (!r.ok || !Array.isArray(r.body)) return;            // migração 188 por aplicar: sem perfis próprios
    for (const k of Object.keys(UNIV_NIVEL)) delete UNIV_NIVEL[k];
    for (const x of r.body) if (UNIV_RE_PROPRIO.test(String(x.perfil || '')) && ['formando', 'instrutor'].includes(x.nivel)) UNIV_NIVEL[x.perfil] = x.nivel;
  } catch { /* fica com o que tinha */ }
}
const univPerfilProprio = (p) => Object.prototype.hasOwnProperty.call(UNIV_NIVEL, p);
const univEhInstrutor = (perfis) => (Array.isArray(perfis) ? perfis : []).some(p => p === 'instrutor' || UNIV_NIVEL[p] === 'instrutor');

async function requireGestorFormacao(req) {
`,
  },
  {
    nome: 'requireGestorFormacao (nível instrutor)',
    ancora: "  const ok = p.role === 'admin' || p.role === 'superadmin' || perfis.includes('administrador') || perfis.includes('instrutor');\n",
    novo: `  // PATCH 34: perfis próprios de nível instrutor contam como instrutor; admin_universidade também (= pode_gerir_formacao() na BD)
  await univPerfisRefrescar();
  const ok = p.role === 'admin' || p.role === 'superadmin' || perfis.includes('administrador') || perfis.includes('admin_universidade') || univEhInstrutor(perfis);
`,
  },
  {
    nome: 'univCaller (nível instrutor)',
    ancora: "  const gestor = admin || perfis.includes('instrutor');\n  if (!gestor) return { error: 403, msg: 'apenas administradores ou instrutores podem gerir os acessos da Universidade' };\n",
    novo: `  await univPerfisRefrescar(); // PATCH 34: perfis próprios de nível instrutor contam como instrutor
  const gestor = admin || univEhInstrutor(perfis);
  if (!gestor) return { error: 403, msg: 'apenas administradores ou instrutores podem gerir os acessos da Universidade' };
`,
  },
  {
    nome: 'destinatários dos avisos (formandos/gestores)',
    ancora: "  const tem = (x, perfil) => Array.isArray(x.perfis) && x.perfis.includes(perfil);\n  const filtrados = p === 'formandos' ? users.filter(x => tem(x, 'formando'))\n    : p === 'gestores' ? users.filter(x => tem(x, 'instrutor') || tem(x, 'administrador') || x.role === 'admin')\n",
    novo: `  const tem = (x, perfil) => Array.isArray(x.perfis) && x.perfis.includes(perfil);
  await univPerfisRefrescar(); // PATCH 34: perfis próprios — todos são formandos; os de nível instrutor também gestores
  const filtrados = p === 'formandos' ? users.filter(x => tem(x, 'formando') || (Array.isArray(x.perfis) && x.perfis.some(univPerfilProprio)))
    : p === 'gestores' ? users.filter(x => univEhInstrutor(x.perfis) || tem(x, 'administrador') || x.role === 'admin')
`,
  },
  { nome: 'aprovar + convidar (perfis próprios)', ancora: ANCORA_PERFIS_CONVITE, novo: NOVO_PERFIS_CONVITE, vezes: 2 },
  {
    nome: 'acção perfis (body.personalizados)',
    ancora: "      const UNIV = ['formando', 'instrutor', 'admin_universidade'];\n      const atuais = Array.isArray(u.perfis) ? u.perfis : [];\n      const novos = [...atuais.filter(p => !UNIV.includes(p)), ...(body.formando ? ['formando'] : []), ...(body.instrutor ? ['instrutor'] : []), ...(body.admin ? ['admin_universidade'] : [])];\n",
    novo: `      // PATCH 34: + perfis próprios pedidos em body.personalizados (só os que existem); os uc_… antigos ou apagados saem
      await univPerfisRefrescar(true);
      const UNIV = ['formando', 'instrutor', 'admin_universidade', ...Object.keys(UNIV_NIVEL)];
      const atuais = Array.isArray(u.perfis) ? u.perfis : [];
      const proprios = [...new Set((Array.isArray(body.personalizados) ? body.personalizados : []).map(String).filter(univPerfilProprio))];
      const novos = [...atuais.filter(p => !UNIV.includes(p) && !UNIV_RE_PROPRIO.test(p)), ...(body.formando ? ['formando'] : []), ...(body.instrutor ? ['instrutor'] : []), ...(body.admin ? ['admin_universidade'] : []), ...proprios];
`,
  },
  {
    nome: 'acção excluir (perfil mantido no DIROPS)',
    ancora: "{ perfis: perfisU.filter(p => p !== 'formando' && p !== 'instrutor' && p !== 'admin_universidade'), updated_date: univAgora() }",
    novo: "{ perfis: perfisU.filter(p => p !== 'formando' && p !== 'instrutor' && p !== 'admin_universidade' && !UNIV_RE_PROPRIO.test(p)) /* PATCH 34 */, updated_date: univAgora() }",
  },
];

let saida = src;
let falhas = 0;
for (const t of trocas) {
  const esperado = t.vezes || 1;
  const n = saida.split(t.ancora).length - 1;
  if (n !== esperado) { console.error(`[patch34] âncora «${t.nome}» encontrada ${n} vezes (esperada ${esperado}).`); falhas += 1; continue; }
  saida = saida.split(t.ancora).join(t.novo);
  console.log(`[patch34] ok: ${t.nome}${esperado > 1 ? ` (${esperado}×)` : ''}`);
}
if (falhas) { console.error('[patch34] NÃO aplicado.'); process.exit(1); }

// o resultado tem de compilar
const tmp = path.join(os.tmpdir(), `server.patch34-${process.pid}.js`);
fs.writeFileSync(tmp, saida, 'utf8');
try {
  execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
  console.log('[patch34] ok: node --check (server.js modificado)');
} catch (e) {
  console.error('[patch34] o resultado NÃO compila:\n' + String(e.stderr || e.message));
  process.exit(1);
} finally {
  try { fs.unlinkSync(tmp); } catch { /* */ }
}

if (verificar) { console.log('[patch34] --verificar: aplica sem problemas (nada foi escrito).'); process.exit(0); }

const carimbo = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const bak = path.join(path.dirname(SERVER), `server.js.bak-patch34-${carimbo}`);
fs.copyFileSync(SERVER, bak);
fs.writeFileSync(SERVER, saida, 'utf8');
console.log(`[patch34] aplicado. Backup: ${bak}`);
console.log('[patch34] Falta: Restart-Service dirops-functions-v2 (e a migração 188, se ainda não estiver aplicada).');
