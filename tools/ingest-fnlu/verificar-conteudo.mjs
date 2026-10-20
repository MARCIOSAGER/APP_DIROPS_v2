#!/usr/bin/env node
// Lê o TEXTO de cada ficheiro importado e procura marcas de aeroporto, para distinguir documentos mesmo-FNLU
// de templates de outro aeroporto (FNMO/Namibe, FNCT/Catumbela...) por adaptar. PDF via pdftotext; docx/xlsx via unzip.
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const plano = JSON.parse(fs.readFileSync('C:/dirops/APP_DIROPS_v2/tools/ingest-fnlu/plano.json', 'utf8'));
const conta = (txt, re) => (txt.match(re) || []).length;
const M = {
  FNLU: /FNLU|Luanda|4\s*de\s*Fevereiro|Quatro\s*de\s*Fevereiro|\bAIL\b/gi,
  FNMO: /FNMO|Namibe|Welwitschia|Mirabilis/gi,
  FNCT: /FNCT|Catumbela/gi,
  FNUB: /FNUB|Lubango|Mukanka/gi,
};
function texto(abs, fmt) {
  try {
    if (fmt === 'pdf') return execSync(`pdftotext -q -enc UTF-8 "${abs}" -`, { maxBuffer: 50e6 }).toString('utf8');
    if (fmt === 'docx' || fmt === 'doc') return execSync(`unzip -p "${abs}" word/document.xml`, { maxBuffer: 50e6 }).toString('utf8');
    if (fmt === 'xlsx' || fmt === 'xls') { try { return execSync(`unzip -p "${abs}" xl/sharedStrings.xml`, { maxBuffer: 50e6 }).toString('utf8'); } catch { return ''; } }
    return '';
  } catch { return ''; }
}

const res = [];
for (const d of plano) {
  const t = texto(d.principal_abs, d.formato);
  const c = { FNLU: conta(t, M.FNLU), FNMO: conta(t, M.FNMO), FNCT: conta(t, M.FNCT), FNUB: conta(t, M.FNUB) };
  const outros = c.FNMO + c.FNCT + c.FNUB;
  let verdito;
  if (d.formato === 'jpg' || d.formato === 'jpeg' || d.formato === 'png' || !t) verdito = 'IMAGEM/sem-texto';
  else if (outros > 0 && c.FNLU === 0) verdito = 'OUTRO-AEROPORTO';           // só outro aeroporto
  else if (outros > 0 && c.FNLU > 0) verdito = 'MISTO';                         // FNLU + sobras de outro
  else if (c.FNLU > 0) verdito = 'FNLU';
  else verdito = 'GENERICO';                                                    // sem marca nenhuma
  res.push({ numero: d.numero, titulo: d.titulo, formato: d.formato, ...c, outros, verdito });
}

const ordem = { 'OUTRO-AEROPORTO': 0, MISTO: 1, GENERICO: 2, 'IMAGEM/sem-texto': 3, FNLU: 4 };
res.sort((a, b) => ordem[a.verdito] - ordem[b.verdito] || b.outros - a.outros);

const n = (v) => res.filter(r => r.verdito === v).length;
console.log(`82 documentos · FNLU: ${n('FNLU')} · MISTO (FNLU+sobras): ${n('MISTO')} · OUTRO-AEROPORTO: ${n('OUTRO-AEROPORTO')} · GENÉRICO: ${n('GENERICO')} · imagem/sem-texto: ${n('IMAGEM/sem-texto')}\n`);
console.log('A REVER (contêm marcas de outro aeroporto ou sem marca FNLU):');
for (const r of res.filter(r => r.verdito !== 'FNLU')) {
  const marcas = [r.FNMO && `FNMO:${r.FNMO}`, r.FNCT && `FNCT:${r.FNCT}`, r.FNUB && `FNUB:${r.FNUB}`, r.FNLU && `FNLU:${r.FNLU}`].filter(Boolean).join(' ');
  console.log(`  [${r.verdito}] ${r.numero}  ${r.titulo}  (${marcas || 'sem marcas'}) [${r.formato}]`);
}
fs.writeFileSync('C:/dirops/APP_DIROPS_v2/tools/ingest-fnlu/verificacao.json', JSON.stringify(res, null, 2), 'utf8');
console.log('\n(detalhe completo em tools/ingest-fnlu/verificacao.json)');
