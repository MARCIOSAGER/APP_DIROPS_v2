#!/usr/bin/env node
// Lê o TEXTO de cada ficheiro de um plano e procura marcas de aeroporto, para distinguir docs mesmo-ICAO de
// templates de OUTRO aeroporto. PDF via pdftotext; docx/xlsx/pptx via unzip.
//   node tools/ingest-ged/verificar.mjs --plano tools/ingest-ged/plano-FNUB.json --icao FNUB
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const PLANO = arg('--plano'); const ICAO = (arg('--icao') || '').toUpperCase();
if (!PLANO || !ICAO) { console.error('--plano <f> --icao FNUB obrigatórios'); process.exit(1); }
const plano = JSON.parse(fs.readFileSync(path.resolve(PLANO), 'utf8'));

// marcas por aeroporto (ICAO + cidade/designação)
const MARCAS = {
  FNLU: /FNLU|Luanda|4\s*de\s*Fevereiro|Quatro\s*de\s*Fevereiro|\bAIL\b/gi,
  FNCT: /FNCT|Catumbela|Paulo\s*Teixeira/gi,
  FNMO: /FNMO|Namibe|Welwitschia|Mirabilis/gi,
  FNUB: /FNUB|Lubango|Mukanka/gi,
};
const conta = (txt, re) => (txt.match(re) || []).length;
function texto(abs, fmt) {
  try {
    if (fmt === 'pdf') return execSync(`pdftotext -q -enc UTF-8 "${abs}" -`, { maxBuffer: 80e6 }).toString('utf8');
    if (fmt === 'docx' || fmt === 'doc') return execSync(`unzip -p "${abs}" word/document.xml`, { maxBuffer: 80e6 }).toString('utf8');
    if (fmt === 'pptx') { try { return execSync(`unzip -p "${abs}" "ppt/slides/*.xml"`, { maxBuffer: 80e6 }).toString('utf8'); } catch { return ''; } }
    if (fmt === 'xlsx' || fmt === 'xls') { try { return execSync(`unzip -p "${abs}" xl/sharedStrings.xml`, { maxBuffer: 80e6 }).toString('utf8'); } catch { return ''; } }
    return '';
  } catch { return ''; }
}

const res = [];
for (const d of plano) {
  const t = texto(d.principal_abs, d.formato);
  const c = {}; for (const k of Object.keys(MARCAS)) c[k] = conta(t, MARCAS[k]);
  const meu = c[ICAO] || 0;
  const outros = Object.entries(c).filter(([k]) => k !== ICAO).reduce((s, [, v]) => s + v, 0);
  let v;
  if (['jpg', 'jpeg', 'png', 'mp4', 'kml', 'kmz'].includes(d.formato) || !t) v = 'IMAGEM/sem-texto';
  else if (outros > 0 && meu === 0) v = 'OUTRO-AEROPORTO';
  else if (outros > 0 && meu > 0) v = 'MISTO';
  else if (meu > 0) v = ICAO;
  else v = 'GENERICO';
  res.push({ numero: d.numero, titulo: d.titulo, formato: d.formato, c, meu, outros, verdito: v });
}
const ordem = { 'OUTRO-AEROPORTO': 0, MISTO: 1, GENERICO: 2, 'IMAGEM/sem-texto': 3, [ICAO]: 4 };
res.sort((a, b) => ordem[a.verdito] - ordem[b.verdito] || b.outros - a.outros);
const n = (x) => res.filter(r => r.verdito === x).length;
console.log(`[${ICAO}] ${res.length} docs · ${ICAO}: ${n(ICAO)} · MISTO: ${n('MISTO')} · OUTRO-AEROPORTO: ${n('OUTRO-AEROPORTO')} · GENÉRICO: ${n('GENERICO')} · imagem/sem-texto: ${n('IMAGEM/sem-texto')}\n`);
console.log('A REVER (outro aeroporto ou misto):');
for (const r of res.filter(r => r.verdito === 'OUTRO-AEROPORTO' || r.verdito === 'MISTO')) {
  const marcas = Object.entries(r.c).filter(([, v]) => v > 0).map(([k, v]) => `${k}:${v}`).join(' ');
  console.log(`  [${r.verdito}] ${r.numero}  ${r.titulo}  (${marcas})`);
}
const out = PLANO.replace(/plano-/, 'verificacao-');
fs.writeFileSync(out, JSON.stringify(res, null, 2), 'utf8');
console.log(`\n(detalhe em ${out})`);
