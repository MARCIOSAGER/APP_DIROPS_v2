// Auditoria da numeração do GED (só leitura). Para cada documento activo compara o número no GED com o código que vem
// no NOME DO FICHEIRO original (guardado em arquivo_privado_uri e nos planos de importação), e procura:
//   1) renumerados   — número no GED ≠ código do ficheiro
//   2) código repetido — o mesmo código em ficheiros de documentos diferentes
//   3) buracos        — séries (classe-aeroporto-manual) com números em falta
//   node tools/ged-nomes/auditar-numeracao.mjs   → escreve tools/ged-nomes/auditoria-numeracao.csv e um resumo
import fs from 'node:fs';
import path from 'node:path';
const SVC = fs.readFileSync('C:/dirops/sga-onpremise/secrets/service_role_key.txt', 'utf8').trim();
const H = { apikey: SVC, Authorization: 'Bearer ' + SVC };
const B = 'http://127.0.0.1:3000';
const RE_COD = /\b([A-Z]{2,4})-([A-Z]{4})-([A-Z]{2,6})-(\d{3})\b/;

// nome do ficheiro original: primeiro pelos planos de importação (caminho completo), senão pelo nome guardado
const origem = new Map();
for (const f of fs.readdirSync('tools/ingest-ged').filter(x => /^plano.*\.json$/.test(x))) {
  let j; try { j = JSON.parse(fs.readFileSync(path.join('tools/ingest-ged', f), 'utf8')); } catch { continue; }
  const arr = Array.isArray(j) ? j : (j.documentos || j.itens || []);
  for (const d of arr) if (d.numero && d.principal_abs) origem.set(d.numero + '|' + (d.aeroporto_id || ''), path.basename(d.principal_abs));
}
const docs = await (await fetch(B + '/documento?voo_ligado_id=is.null&deleted_at=is.null&select=id,numero,titulo,aeroporto_id,arquivo_privado_uri&limit=5000', { headers: H })).json();

const linhas = [];
const porCodFicheiro = new Map();
for (const d of docs) {
  const fich = origem.get(d.numero + '|' + d.aeroporto_id) || String(d.arquivo_privado_uri || '').replace(/^[0-9a-f]{9}_/, '');
  const m = fich.match(RE_COD);
  const codFich = m ? m[0] : '';
  if (codFich) { if (!porCodFicheiro.has(codFich)) porCodFicheiro.set(codFich, []); porCodFicheiro.get(codFich).push(d); }
  linhas.push({ d, fich, codFich });
}

const renumerados = linhas.filter(l => l.codFich && l.codFich !== l.d.numero);
const repetidos = [...porCodFicheiro.entries()].filter(([, l]) => l.length > 1);

// buracos por série
const series = new Map();
for (const d of docs) {
  const m = String(d.numero || '').match(/^([A-Z]{2,4}-[A-Z]{4}-[A-Z]{2,6})-(\d{3})$/); if (!m) continue;
  if (!series.has(m[1])) series.set(m[1], []); series.get(m[1]).push(Number(m[2]));
}
const buracos = [];
for (const [s, nums] of series) {
  const max = Math.max(...nums); const set = new Set(nums);
  const falta = []; for (let i = 1; i <= max; i++) if (!set.has(i)) falta.push(String(i).padStart(3, '0'));
  if (falta.length) buracos.push({ serie: s, existentes: nums.length, max, falta });
}

const csv = [['Tipo', 'Número no GED', 'Código no ficheiro', 'Título', 'Ficheiro original'].join(';')];
for (const l of renumerados) csv.push(['Renumerado', l.d.numero, l.codFich, l.d.titulo, l.fich].map(x => `"${String(x).replace(/"/g, '""')}"`).join(';'));
for (const [c, l] of repetidos) for (const d of l) csv.push(['Código repetido', d.numero, c, d.titulo, ''].map(x => `"${String(x).replace(/"/g, '""')}"`).join(';'));
for (const b of buracos) csv.push(['Buraco na série', b.serie, '', `faltam: ${b.falta.join(', ')} (até ${b.max})`, ''].map(x => `"${x}"`).join(';'));
fs.writeFileSync('tools/ged-nomes/auditoria-numeracao.csv', '\uFEFF' + csv.join('\r\n'));

const porAero = (lista, f) => lista.reduce((m, x) => { const a = (f(x).match(/-([A-Z]{4})-/) || [])[1] || '?'; m[a] = (m[a] || 0) + 1; return m; }, {});
console.log(`Documentos activos: ${docs.length} · com código legível no ficheiro: ${linhas.filter(l => l.codFich).length}`);
console.log(`1) Renumerados (GED ≠ ficheiro): ${renumerados.length}`, porAero(renumerados, l => l.d.numero));
console.log(`2) Códigos repetidos em ficheiros: ${repetidos.length} códigos`, porAero(repetidos, r => r[0]));
console.log(`3) Séries com buracos: ${buracos.length} de ${series.size} séries`, porAero(buracos, b => b.serie + '-'));
console.log('\nExemplos de renumerados:'); renumerados.slice(0, 12).forEach(l => console.log(`   ${l.d.numero.padEnd(20)} ficheiro: ${l.codFich.padEnd(20)} ${l.d.titulo.slice(0, 40)}`));
console.log('\nExemplos de buracos:'); buracos.slice(0, 10).forEach(b => console.log(`   ${b.serie.padEnd(16)} tem ${b.existentes}, até ${b.max}; faltam ${b.falta.slice(0, 8).join(', ')}${b.falta.length > 8 ? '…' : ''}`));
console.log('\nRelatório completo: tools/ged-nomes/auditoria-numeracao.csv');
