#!/usr/bin/env node
// Build de um curso-html5: valida o course.json, gera a página (JSON embebido), copia player + assets,
// escreve o imsmanifest.xml (SCORM 1.2) e o .zip pronto a carregar na Universidade Corporativa.
//   node tools/curso-html5/build.mjs tools/curso-html5/cursos/<slug> [--out tools/curso-html5/dist] [--sem-zip]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dir = path.dirname(fileURLToPath(import.meta.url));
const L = require(path.join(__dir, 'player', 'logica.cjs'));
const args = process.argv.slice(2);
const dirCurso = args.find(a => !a.startsWith('--'));
if (!dirCurso) { console.error('uso: node build.mjs <pasta do curso com course.json> [--out <pasta>] [--sem-zip]'); process.exit(1); }
const outBase = args.includes('--out') ? args[args.indexOf('--out') + 1] : path.join(__dir, 'dist');
const semZip = args.includes('--sem-zip');

const raw = fs.readFileSync(path.join(dirCurso, 'course.json'), 'utf8');
let cursoJson; try { cursoJson = JSON.parse(raw); } catch (e) { console.error('course.json inválido:', e.message); process.exit(1); }
const erros = L.validarCurso(cursoJson);
if (erros.length) { console.error('course.json com erros:\n - ' + erros.join('\n - ')); process.exit(1); }
const curso = L.normalizarCurso(cursoJson);
if (!curso.identidade.logo) curso.identidade.logo = 'assets/logo-sga.png';
const out = path.join(outBase, curso.slug);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'assets'), { recursive: true });

// player
for (const [de, para] of [['app.js', 'app.js'], ['logica.cjs', 'logica.js'], ['styles.css', 'styles.css']]) fs.copyFileSync(path.join(__dir, 'player', de), path.join(out, para));
const json = JSON.stringify(curso).replace(/<\/script/gi, '<\\/script');
const html = fs.readFileSync(path.join(__dir, 'player', 'index.html'), 'utf8').replace('{{TITULO}}', escapeHtml(curso.titulo)).replace('{{COURSE_JSON}}', json);
fs.writeFileSync(path.join(out, 'index.html'), html);

// assets do curso + logo SGA por omissão
const assetsCurso = path.join(dirCurso, 'assets');
if (fs.existsSync(assetsCurso)) copiarDir(assetsCurso, path.join(out, 'assets'));
const logoDestino = path.join(out, curso.identidade.logo.replace(/\//g, path.sep));
if (!fs.existsSync(logoDestino)) {
  const cand = [path.join(__dir, '..', '..', 'public', 'logo-sga.png'), path.join(__dir, 'assets', 'logo-sga.png')].find(p => fs.existsSync(p));
  if (cand) { fs.mkdirSync(path.dirname(logoDestino), { recursive: true }); fs.copyFileSync(cand, logoDestino); }
  else console.warn('aviso: logo não encontrado (' + curso.identidade.logo + ')');
}

// manifest SCORM 1.2
const ficheiros = listar(out).map(f => path.relative(out, f).replace(/\\/g, '/')).filter(f => f !== 'imsmanifest.xml');
const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="MANIFEST-${curso.slug}" version="${escapeHtml(curso.versao || '1.0')}"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2" xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd http://www.imsglobal.org/xsd/imsmd_rootv1p2p1 imsmd_rootv1p2p1.xsd http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata>
  <organizations default="ORG-${curso.slug}">
    <organization identifier="ORG-${curso.slug}">
      <title>${escapeHtml(curso.titulo)}</title>
      <item identifier="ITEM-1" identifierref="RES-1" isvisible="true">
        <title>${escapeHtml(curso.titulo)}</title>
        <adlcp:masteryscore>${Number(curso.nota_minima) || 0}</adlcp:masteryscore>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES-1" type="webcontent" adlcp:scormtype="sco" href="index.html">
${ficheiros.map(f => `      <file href="${escapeHtml(f)}"/>`).join('\n')}
    </resource>
  </resources>
</manifest>
`;
fs.writeFileSync(path.join(out, 'imsmanifest.xml'), manifest);

// zip
let zipPath = null;
if (!semZip) { zipPath = path.join(outBase, curso.slug + '.zip'); escreverZip(out, zipPath); }
const prog = L.calcularProgresso(curso, {});
console.log(`curso "${curso.titulo}" (${curso.slug}) — ${curso.modulos.length} módulos · ${prog.paginas} páginas · ${prog.interativos} actividades`);
console.log('página : ' + path.join(out, 'index.html'));
if (zipPath) console.log('SCORM  : ' + zipPath + ' (' + Math.round(fs.statSync(zipPath).size / 1024) + ' KB)');

// ---------------- utilitários ----------------
function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function copiarDir(de, para) { fs.mkdirSync(para, { recursive: true }); for (const e of fs.readdirSync(de, { withFileTypes: true })) { const a = path.join(de, e.name), b = path.join(para, e.name); if (e.isDirectory()) copiarDir(a, b); else fs.copyFileSync(a, b); } }
function listar(dir) { const out = []; for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) out.push(...listar(p)); else out.push(p); } return out; }

// zip mínimo (deflate) sem dependências: cabeçalhos locais + directório central
function escreverZip(dir, destino) {
  const entradas = listar(dir).map(f => ({ nome: path.relative(dir, f).replace(/\\/g, '/'), dados: fs.readFileSync(f) }));
  const partes = [], central = []; let offset = 0;
  const dosTime = (d) => ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xffff;
  const dosDate = (d) => (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff;
  const agora = new Date();
  for (const e of entradas) {
    const nome = Buffer.from(e.nome, 'utf8'), comp = zlib.deflateRawSync(e.dados, { level: 9 }), crc = crc32(e.dados);
    const cab = Buffer.alloc(30);
    cab.writeUInt32LE(0x04034b50, 0); cab.writeUInt16LE(20, 4); cab.writeUInt16LE(0x0800, 6); cab.writeUInt16LE(8, 8);
    cab.writeUInt16LE(dosTime(agora), 10); cab.writeUInt16LE(dosDate(agora), 12); cab.writeUInt32LE(crc, 14); cab.writeUInt32LE(comp.length, 18); cab.writeUInt32LE(e.dados.length, 22); cab.writeUInt16LE(nome.length, 26); cab.writeUInt16LE(0, 28);
    partes.push(cab, nome, comp);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6); cd.writeUInt16LE(0x0800, 8); cd.writeUInt16LE(8, 10);
    cd.writeUInt16LE(dosTime(agora), 12); cd.writeUInt16LE(dosDate(agora), 14); cd.writeUInt32LE(crc, 16); cd.writeUInt32LE(comp.length, 20); cd.writeUInt32LE(e.dados.length, 24); cd.writeUInt16LE(nome.length, 28);
    cd.writeUInt16LE(0, 30); cd.writeUInt16LE(0, 32); cd.writeUInt16LE(0, 34); cd.writeUInt16LE(0, 36); cd.writeUInt32LE(0, 38); cd.writeUInt32LE(offset, 42);
    central.push(cd, nome);
    offset += cab.length + nome.length + comp.length;
  }
  const cdBuf = Buffer.concat(central), fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0); fim.writeUInt16LE(0, 4); fim.writeUInt16LE(0, 6); fim.writeUInt16LE(entradas.length, 8); fim.writeUInt16LE(entradas.length, 10); fim.writeUInt32LE(cdBuf.length, 12); fim.writeUInt32LE(offset, 16); fim.writeUInt16LE(0, 20);
  fs.writeFileSync(destino, Buffer.concat([...partes, cdBuf, fim]));
}
var TABELA_CRC = null;
function crc32(buf) {
  if (!TABELA_CRC) { TABELA_CRC = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; TABELA_CRC[n] = c; } }
  let crc = -1; for (let i = 0; i < buf.length; i++) crc = TABELA_CRC[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}
