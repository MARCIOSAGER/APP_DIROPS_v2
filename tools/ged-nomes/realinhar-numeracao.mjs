// Realinha a numeração do GED com o código do NOME DO FICHEIRO entregue (só a sequência: mesma classe, aeroporto e
// manual). Só move quando o código do ficheiro é único e o número de destino fica livre. Também consolida o PSCI FNCT
// (o 001 é a mesma edição de 15/03/2026 que o 002) e aplica trocas manuais. Escreve a lista de correções para as equipas.
//   node tools/ged-nomes/realinhar-numeracao.mjs            (simulação)
//   node tools/ged-nomes/realinhar-numeracao.mjs --apply
import fs from 'node:fs';
import path from 'node:path';
const SVC = fs.readFileSync('C:/dirops/sga-onpremise/secrets/service_role_key.txt', 'utf8').trim();
const H = { apikey: SVC, Authorization: 'Bearer ' + SVC, 'Content-Type': 'application/json', Prefer: 'return=representation' };
const B = 'http://127.0.0.1:3000';
const APPLY = process.argv.includes('--apply');
const req = async (m, p, body) => { const r = await fetch(B + p, { method: m, headers: H, body: body ? JSON.stringify(body) : undefined }); const t = await r.text(); if (!r.ok) throw new Error(`${m} ${p}: ${r.status} ${t}`); return t ? JSON.parse(t) : null; };
// documentos consolidados hoje (a versão em vigor veio de outro ficheiro): não se realinham pelo ficheiro
const NAO_MEXER = new Set(['MA-FNMO-MOA-001']);
const RE_COD = /\b([A-Z]{2,4})-([A-Z]{4})-([A-Z]{2,6})-(\d{3})\b/;
const agora = new Date().toISOString();
const BACKUP = 'tools/ged-nomes/backup-realinhamento-2026-10-15.json';

// ── 0) PSCI FNCT: o 001 fica com o histórico (v1 Out/2024 vem do 002); o 002 vai para a lixeira ──
async function consolidarPsci() {
  const [d1] = await req('GET', '/documento?numero=eq.PL-FNCT-PSCI-001&deleted_at=is.null&select=id,documento_versao(*)');
  const [d2] = await req('GET', '/documento?numero=eq.PL-FNCT-PSCI-002&deleted_at=is.null&select=id,documento_versao(*)');
  if (!d1 || !d2) { console.log('PSCI: já consolidado (ou não encontrado) — salta'); return; }
  const antiga = d2.documento_versao.find(v => /Out\/2024/.test(v.rotulo || ''));
  const vig = d1.documento_versao.find(v => v.estado === 'em_vigor');
  const fonte = d1.documento_versao.find(v => v.estado === 'fonte');
  console.log('PSCI: PL-FNCT-PSCI-001 ← v1 Out/2024 (do 002) · v2 15/03/2026 em vigor · v3 fonte .docx; PL-FNCT-PSCI-002 → lixeira');
  if (!APPLY) return;
  await req('PATCH', `/documento_versao?id=eq.${vig.id}`, { versao: 1002 });
  if (fonte) await req('PATCH', `/documento_versao?id=eq.${fonte.id}`, { versao: 1003 });
  await req('PATCH', `/documento_versao?id=eq.${antiga.id}`, { documento_id: d1.id, versao: 1, estado: 'obsoleto' });
  await req('PATCH', `/documento_versao?id=eq.${vig.id}`, { versao: 2, rotulo: 'Versão 15/03/2026' });
  if (fonte) await req('PATCH', `/documento_versao?id=eq.${fonte.id}`, { versao: 3, rotulo: 'Fonte editável (.docx) — 15/03/2026' });
  await req('PATCH', `/documento?id=eq.${d1.id}`, { versao_atual: 2, titulo: 'Plano de Salvamento e Combate a Incêndio', updated_date: agora });
  await req('PATCH', `/documento?id=eq.${d2.id}`, { deleted_at: agora, deleted_by: 'mesma edição que PL-FNCT-PSCI-001 (versão Out/2024 passou para o 001)' });
}

await consolidarPsci();

// ── 1) realinhamento pela sequência do ficheiro ──
const origem = new Map();
for (const f of fs.readdirSync('tools/ingest-ged').filter(x => /^plano.*\.json$/.test(x))) {
  let j; try { j = JSON.parse(fs.readFileSync(path.join('tools/ingest-ged', f), 'utf8')); } catch { continue; }
  for (const d of (Array.isArray(j) ? j : (j.documentos || j.itens || []))) if (d.numero && d.principal_abs) origem.set(d.numero + '|' + (d.aeroporto_id || ''), path.basename(d.principal_abs));
}
const docs = await req('GET', '/documento?voo_ligado_id=is.null&deleted_at=is.null&select=id,numero,titulo,aeroporto_id,arquivo_privado_uri&limit=5000');
const codDe = new Map(); const contagemCod = new Map();
for (const d of docs) {
  const fich = origem.get(d.numero + '|' + d.aeroporto_id) || String(d.arquivo_privado_uri || '').replace(/^[0-9a-f]{9}_/, '');
  const m = fich.match(RE_COD); if (!m) continue;
  codDe.set(d.id, m[0]); contagemCod.set(m[0], (contagemCod.get(m[0]) || 0) + 1);
}
const serie = (n) => String(n).replace(/-\d{3}$/, '');
let moves = [];
for (const d of docs) {
  const c = codDe.get(d.id);
  if (!c || c === d.numero) continue;
  if (serie(c) !== serie(d.numero)) continue;          // aeroporto/manual/classe diferentes = esperado, não se mexe
  if (contagemCod.get(c) > 1) continue;                 // código repetido na origem → lista de correções
  if (NAO_MEXER.has(d.numero)) continue;
  moves.push({ d, para: c, porque: 'código do ficheiro' });
}
// trocas manuais (código repetido na origem, decidido com o dono)
const manuais = [
  ['LT-FNLU-PSA-003', 'LT-FNLU-PSA-004', 'Lista de Provedores: o ficheiro repete o código da Lista de Contactos (PSA-002)'],
  // ficheiros SEM código no nome que, na importação, ficaram com o 001 e empurraram a série: passam para o fim
  ['DO-FNCT-MOA-001', 'DO-FNCT-MOA-021', 'Resistência do Pavimento: ficheiro sem código ocupava o 001'],
  ['FR-FNCT-PMA-001', 'FR-FNCT-PMA-009', 'Modelo da Ficha de Vistoria: ficheiro sem código ocupava o 001'],
  ['LT-FNCT-PEA-001', 'LT-FNCT-PEA-006', 'Listas dos meios da Marinha: ficheiro sem código ocupava o 001'],
];

for (const [de, para, porque] of manuais) { const d = docs.find(x => x.numero === de); if (d && !moves.some(m => m.d.id === d.id)) moves.push({ d, para, porque }); }

// validação: destino livre (ou libertado por outro que também se move) e sem dois para o mesmo
let estavel = false;
while (!estavel) {
  estavel = true;
  const quemMove = new Set(moves.map(m => m.d.id));
  const ocupados = new Set(docs.filter(d => !quemMove.has(d.id)).map(d => d.numero));
  const vistos = new Map();
  for (const m of moves) vistos.set(m.para, (vistos.get(m.para) || 0) + 1);
  const antes = moves.length;
  moves = moves.filter(m => !ocupados.has(m.para) && vistos.get(m.para) === 1);
  if (moves.length !== antes) estavel = false;
}
console.log(`\nRealinhamento: ${moves.length} documentos`);
for (const m of moves.sort((a, b) => a.para.localeCompare(b.para))) console.log(`   ${m.d.numero.padEnd(20)} → ${m.para.padEnd(20)} ${m.d.titulo.slice(0, 45)}`);

// lista de correções para as equipas (ficam por corrigir nos ficheiros de origem)
const correcoes = [['Documento no GED', 'Título', 'Problema no ficheiro de origem']];
for (const [c, n] of contagemCod) if (n > 1) for (const d of docs.filter(x => codDe.get(x.id) === c)) correcoes.push([d.numero, d.titulo, `o nome do ficheiro usa o código ${c}, repetido noutro documento`]);
correcoes.push(['LT-FNLU-PSA-002', 'Lista de Contactos de Emergência', 'o cabeçalho do PDF diz LT-FNLU-PCA-002 (devia ser PSA)']);
correcoes.push(['PL-FNCT-PFOA-002', 'Plano de Treinamento 2024 2025 (Excel)', 'tem pessoas do FNLU (Soraya Sousa, Francisca da Ressurreição): confirmar se é o plano de Luanda arquivado na Catumbela']);
const moved = new Set(moves.map(m => m.d.id));
for (const d of docs) { const c = codDe.get(d.id); if (c && c !== d.numero && serie(c) === serie(d.numero) && !moved.has(d.id) && contagemCod.get(c) === 1) correcoes.push([d.numero, d.titulo, `o ficheiro diz ${c} mas esse número está ocupado no GED`]); }
const csv = '\uFEFF' + correcoes.map(l => l.map(x => `"${String(x).replace(/"/g, '""')}"`).join(';')).join('\r\n');
fs.writeFileSync('tools/ged-nomes/correcoes-para-equipas.csv', csv);
console.log(`\nCorreções para as equipas: ${correcoes.length - 1} linhas → tools/ged-nomes/correcoes-para-equipas.csv`);

if (!APPLY) { console.log('\nSIMULAÇÃO — correr com --apply'); process.exit(0); }
if (!fs.existsSync(BACKUP)) fs.writeFileSync(BACKUP, JSON.stringify(moves.map(m => ({ id: m.d.id, de: m.d.numero, para: m.para })), null, 2));
for (const m of moves) await req('PATCH', `/documento?id=eq.${m.d.id}`, { numero: `${m.d.numero}~tmp` });
for (const m of moves) await req('PATCH', `/documento?id=eq.${m.d.id}`, { numero: m.para, updated_date: agora });
console.log(`\nAPLICADO: ${moves.length} renumerados (backup ${BACKUP})`);
