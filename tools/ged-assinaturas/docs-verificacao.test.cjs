'use strict';
// Testes da lógica pura de docs-verificacao.js (página /vd/ e troca pela cópia assinada).
//   node --test tools/ged-assinaturas/docs-verificacao.test.js
// O módulo vive na pasta das funções; DOCS_VERIFICACAO_JS permite apontar para uma cópia.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');

const V = require(process.env.DOCS_VERIFICACAO_JS || 'C:/dirops/sga-onpremise/functions/dirops-functions/docs-verificacao.js');

test('normalizarCodigo: forma canónica, tolerâncias e recusas', () => {
  assert.deepEqual(V.normalizarCodigo('7f3a-91c2-0b4d'), { codigo: '7F3A-91C2-0B4D', tipo: 'revisao' });
  assert.deepEqual(V.normalizarCodigo(' 7F3A 91C2 0B4D '), { codigo: '7F3A-91C2-0B4D', tipo: 'revisao' });
  assert.deepEqual(V.normalizarCodigo('7F3A91C2OB4D'), { codigo: '7F3A-91C2-0B4D', tipo: 'revisao' }, 'O lido como 0');
  assert.deepEqual(V.normalizarCodigo('AB12-CD34-EFIL'), { codigo: 'AB12-CD34-EF11', tipo: 'revisao' }, 'I/L lidos como 1');
  assert.deepEqual(V.normalizarCodigo('QZJY-ABCD-WXYZ'), { codigo: 'QZJY-ABCD-WXYZ', tipo: 'assinatura' });
  assert.equal(V.normalizarCodigo('ABC'), null);
  assert.equal(V.normalizarCodigo('7F3A-91C2-0B4D-99'), null);
  assert.equal(V.normalizarCodigo(null), null);
  assert.equal(V.normalizarCodigo('<script>alert(1)</script>'), null);
});

test('codigoDeSha: 12 primeiros hex do SHA-256, maiúsculas, 4-4-4', () => {
  const sha = crypto.createHash('sha256').update('pdf original').digest('hex');
  const c = V.codigoDeSha(sha);
  assert.match(c, /^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
  assert.equal(c.replace(/-/g, ''), sha.slice(0, 12).toUpperCase());
  assert.equal(V.codigoDeSha(sha.toUpperCase()), c);
  assert.equal(V.codigoDeSha('xyz'), null);
  // ida e volta: o código impresso volta a normalizar para si próprio
  assert.equal(V.normalizarCodigo(c).codigo, c);
});

test('escHtml escapa os cinco caracteres', () => {
  assert.equal(V.escHtml(`<a href="x" onclick='y'>&</a>`), '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;');
  assert.equal(V.escHtml(null), '');
});

test('datas em hora de Luanda (UTC+1)', () => {
  assert.equal(V.fmtDataHora('2026-10-21T23:30:00Z'), '22/10/2026 00:30');
  assert.equal(V.fmtData('2026-03-05'), '05/03/2026');
  assert.equal(V.fmtDataHora('lixo'), '');
});

const ficha = {
  existe: true, codigo: 'AB12-CD34-EF56', restrito: false, numero: 'MOA-FNLU-001',
  titulo: 'Manual <script>alert(1)</script>', aeroporto: 'Luanda (FNLU)', revisao: 'Revisão 03', estado: 'em_vigor',
  em_vigor_desde: '2026-10-01', aprovado_em: '2026-09-30T10:00:00Z',
  original: { sha256: 'ab12cd34ef56'.padEnd(64, '0') }, copia: { sha256: 'c'.repeat(64), criado_em: '2026-09-30T11:00:00Z' },
  assinaturas: [{ nome: 'Ana "A" <b>', papel: 'director_aeroporto', acto: 'aprovacao', significado: 'Aprovo.', assinado_em: '2026-09-30T10:00:00Z', codigo: 'QZJY-ABCD-WXYZ', mesmo_ficheiro: true }],
};

test('paginaHtml: estado em vigor, dados escapados, comparação com as duas impressões', () => {
  const h = V.paginaHtml(ficha, { codigo: 'AB12-CD34-EF56' });
  assert.match(h, /Revisão em vigor/);
  assert.ok(!h.includes('<script>alert(1)</script>'), 'título tem de sair escapado');
  assert.ok(h.includes('Manual &lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(h.includes('Ana &quot;A&quot; &lt;b&gt;'));
  assert.ok(h.includes('data-orig="' + ficha.original.sha256 + '"'));
  assert.ok(h.includes('data-copia="' + 'c'.repeat(64) + '"'));
  assert.ok(h.includes('Director do aeroporto'));
  assert.ok(!/@/.test(h.replace(/@media/g, '')), 'sem emails na página');
});

test('paginaHtml: substituída (âmbar) indica a revisão em vigor', () => {
  const h = V.paginaHtml(Object.assign({}, ficha, { estado: 'substituida', revisao_em_vigor: { revisao: 'Revisão 04' } }), {});
  assert.match(h, /Revisão substituída — a revisão em vigor é Revisão 04/);
  assert.ok(h.includes('#b45309'));
});

test('paginaHtml: código não encontrado (vermelho), sem script de comparação', () => {
  const h = V.paginaHtml({ existe: false }, { codigo: '"><img src=x>' });
  assert.match(h, /Código não encontrado/);
  assert.ok(h.includes('#b91c1c'));
  assert.ok(!h.includes('<script>'));
  assert.ok(!h.includes('"><img src=x>'), 'o código ecoado no formulário sai escapado');
});

test('paginaHtml: AVSEC não revela título, assinaturas nem impressões', () => {
  const h = V.paginaHtml({ existe: true, codigo: 'FE98-DC76-BA54', restrito: true, numero: 'PSA-FNLU', revisao: 'Revisão 02', estado: 'em_vigor', nota: 'documento de acesso restrito' }, {});
  assert.match(h, /acesso restrito/);
  assert.match(h, /PSA-FNLU/);
  assert.ok(!h.includes('Assinaturas') && !h.includes('SHA-256)') && !h.includes('<script>'));
});

test('estadoVisual cobre os estados da base', () => {
  for (const e of ['em_vigor', 'aprovado', 'substituida', 'retirado', 'aprovacao_em_curso', 'ficheiro_nao_aprovado', 'rejeitado', 'outro']) {
    const v = V.estadoVisual({ existe: true, estado: e });
    assert.ok(v.titulo && v.msg && v.classe, e);
  }
  assert.equal(V.estadoVisual({ existe: true, estado: 'em_vigor' }).classe, 'ok');
  assert.equal(V.estadoVisual(null).classe, 'erro');
});

test('SHA-256 em JS puro do browser coincide com o do Node', () => {
  const sha256Puro = new Function(V.SHA256_JS + '; return sha256Puro;')();
  const amostras = [Buffer.alloc(0), Buffer.from('abc'), Buffer.alloc(55, 7), Buffer.alloc(56, 7), Buffer.alloc(64, 1), crypto.randomBytes(100000)];
  for (const b of amostras) {
    const ab = b.buffer.slice(b.byteOffset, b.byteOffset + b.length);
    assert.equal(sha256Puro(ab), crypto.createHash('sha256').update(b).digest('hex'), 'tamanho ' + b.length);
  }
});

test('formasDaChave e chaveDoCaminho', () => {
  const f = V.formasDaChave('/Incurs%C3%A3o.pdf');
  assert.ok(f.includes('Incurs%C3%A3o.pdf') && f.includes('Incursão.pdf'.normalize('NFC')));
  const raiz = path.resolve('C:/st');
  assert.deepEqual(V.chaveDoCaminho(raiz, path.join(raiz, 'private-uploads', 'copias-assinadas', '2026', 'a.pdf')),
    { bucket: 'private-uploads', key: 'copias-assinadas/2026/a.pdf' });
  assert.equal(V.chaveDoCaminho(raiz, path.resolve('C:/outro/a.pdf')), null);
  assert.equal(V.pedeOriginal(new URL('http://x/a?original=1')), true);
  assert.equal(V.pedeOriginal(new URL('http://x/a')), false);
});

// ── rota e troca de ficheiro, com dependências falsas ──
function resFalso() {
  const r = { status: 0, headers: {}, corpo: '' };
  r.writeHead = (s, h) => { r.status = s; Object.assign(r.headers, h || {}); };
  r.end = (c) => { r.corpo = c || ''; };
  return r;
}
const req = (u) => ({ method: 'GET', url: u, headers: { 'user-agent': 't' }, socket: { remoteAddress: '1.2.3.4' } });

test('rota /vd: redirecciona para a forma canónica, 200 com ficha, 404 sem ela', async () => {
  const chamadas = [];
  const D = V.criar({
    postgrest: async (p, m, b) => {
      chamadas.push([p, b]);
      if (p === '/rpc/doc_verificacao_por_codigo') return { ok: true, status: 200, body: b.p_codigo === 'AB12-CD34-EF56' ? ficha : { existe: false } };
      return { ok: true, status: 201, body: null };
    },
    sgaLogoImg: () => '<img alt="SGA">',
  });
  let r = resFalso(); await D.rota(req('/vd/ab12cd34ef56'), r, new URL('http://x/vd/ab12cd34ef56'));
  assert.equal(r.status, 302); assert.equal(r.headers.Location, '/vd/AB12-CD34-EF56');
  r = resFalso(); await D.rota(req('/vd/?codigo=ab12%20cd34%20ef56'), r, new URL('http://x/vd/?codigo=ab12%20cd34%20ef56'));
  assert.equal(r.status, 302); assert.equal(r.headers.Location, '/vd/AB12-CD34-EF56');
  r = resFalso(); await D.rota(req('/vd/AB12-CD34-EF56'), r, new URL('http://x/vd/AB12-CD34-EF56'));
  assert.equal(r.status, 200); assert.match(r.corpo, /Revisão em vigor/);
  assert.match(r.headers['Content-Security-Policy'], /default-src 'none'/);
  r = resFalso(); await D.rota(req('/vd/0000-0000-0000'), r, new URL('http://x/vd/0000-0000-0000'));
  assert.equal(r.status, 404); assert.match(r.corpo, /Código não encontrado/);
  r = resFalso(); await D.rota(req('/vd/'), r, new URL('http://x/vd/'));
  assert.equal(r.status, 200); assert.match(r.corpo, /Verificar uma revisão/);
  r = resFalso(); await D.rota(req('/vd/xx'), r, new URL('http://x/vd/xx'));
  assert.equal(r.status, 400);
  assert.ok(chamadas.some(([p]) => p === '/log_acesso_documento'), 'regista a verificação');
});

test('copiaServida: troca pela cópia vigente, respeita ?original=1 e falha para o original', async () => {
  const raiz = path.resolve('C:/st');
  const original = path.join(raiz, 'private-uploads', 'ec71_LT.pdf');
  const copia = path.join(raiz, 'private-uploads', 'copias-assinadas', '2026', 'x.pdf');
  let resposta = { ok: true, status: 200, body: { caminho: 'copias-assinadas/2026/x.pdf', bucket: 'private-uploads' } };
  const D = V.criar({
    STORAGE_ROOT: raiz,
    postgrest: async (p, m, b) => { assert.equal(p, '/rpc/doc_copia_assinada_por_chave'); assert.ok(b.p_chaves.includes('ec71_LT.pdf')); return resposta; },
    resolveStoragePath: (bucket, key) => (key === 'copias-assinadas/2026/x.pdf' ? copia : null),
  });
  assert.equal(await D.copiaServida(original, null), copia);
  assert.equal(await D.copiaServida(original, new URL('http://x/?original=1')), original);
  assert.equal(await D.copiaServida(path.join(raiz, 'uploads', 'a.png'), null), path.join(raiz, 'uploads', 'a.png'), 'balde público não é tocado');
  const D2 = V.criar({ STORAGE_ROOT: raiz, postgrest: async () => ({ ok: false, status: 404, body: { code: 'PGRST202' } }), resolveStoragePath: () => null });
  assert.equal(await D2.copiaServida(original, null), original, 'sem a migração 186 serve o original');
  const D3 = V.criar({ STORAGE_ROOT: raiz, postgrest: async () => ({ ok: true, status: 200, body: { caminho: 'sumiu.pdf' } }), resolveStoragePath: () => null });
  assert.equal(await D3.copiaServida(original, null), original, 'cópia registada sem ficheiro no disco → original');
  resposta = { ok: true, status: 200, body: null };
});
