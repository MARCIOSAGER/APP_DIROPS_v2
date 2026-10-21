import fs from 'node:fs'; import crypto from 'node:crypto';
const S = process.argv[2]; const ST = 'C:/dirops/sga-onpremise/storage/private-uploads/';
const SVC = fs.readFileSync('C:/dirops/sga-onpremise/secrets/service_role_key.txt', 'utf8').trim();
const H = { apikey: SVC, Authorization: 'Bearer ' + SVC, 'Content-Type': 'application/json' };
const req = async (m, p, b) => { const r = await fetch('http://127.0.0.1:3000' + p, { method: m, headers: { ...H, Prefer: 'return=representation' }, body: b ? JSON.stringify(b) : undefined }); const t = await r.text(); if (!r.ok) throw new Error(`${m} ${p} ${r.status} ${t}`); return t ? JSON.parse(t) : null; };
const NOTA = {
  'FR-FNCA-MOA-017': 'código no cabeçalho: «FNHU - 008» → FR-FNCA-MOA-017',
  'FR-FNCA-MOA-019': 'código no documento: «FNCA-010» → FR-FNCA-MOA-019',
  'FR-FNHU-PGRF-020': 'código no cabeçalho: FR-FNHU-OPS-020 → FR-FNHU-PGRF-020',
  'FR-FNHU-MOA-015': 'nome interno da folha Excel: FR-FNCA-MOA-014 → FR-FNHU-MOA-015',
  'LT-FNCA-MGSO-001': 'código no cabeçalho: LT-FNCA-SO-001 → LT-FNCA-MGSO-001',
  'LT-FNHU-MGSO-001': 'código no cabeçalho: LT-FNHU-SO-001 → LT-FNHU-MGSO-001',
  'MA-FNCA-MOA-001': 'código nas págs. 15 e 21: MA-FNCT-MOA-001 → MA-FNCA-MOA-001',
  'MA-FNHU-MOA-001': 'índice (p.8) e títulos 5.4/5.5 (p.107): «Maria Mabu Café»/«Cabinda» → Albano Machado/Huambo; código nas págs. 15 e 21: MA-FNCT → MA-FNHU',
  'NRM-FNCA-NOCLA-001': 'índice (p.4): «Aeroporto Internacional da Mukanka» → Aeroporto Maria Mambo Café',
  'PL-FNCA-PRAFS-001': 'p.12: LT-FNUB-PRAFS-002 → LT-FNCA-PRAFS-002',
  'POP-FNCA-MOA-001': 'capa (p.2): «Aeroporto Welwitschia Mirabilis» → Aeroporto Maria Mambo Café',
  'POP-FNHU-MOA-002': 'p.2: «De exclusivo uso no FNCA» → FNHU',
};
const mapa = JSON.parse(fs.readFileSync(S + '/mapa.json', 'utf8')); const backup = [];
for (const m of mapa) {
  const [d] = await req('GET', `/documento?numero=eq.${m.numero}&deleted_at=is.null&select=id,arquivo_privado_uri,sha256`);
  const vs = await req('GET', `/documento_versao?documento_id=eq.${d.id}&arquivo_uri=eq.${encodeURIComponent(m.stored)}&select=id,versao,sha256,tamanho,nota`);
  if (vs.length !== 1) throw new Error(m.numero + ': versões ' + vs.length);
  const buf = fs.readFileSync(ST + m.stored); const sha = crypto.createHash('sha256').update(buf).digest('hex');
  backup.push({ numero: m.numero, documento: d, versao: vs[0] });
  const nota = `${vs[0].nota ? vs[0].nota + ' ' : ''}Correcção de 21/10/2026 (restos de cópia de outro aeroporto / código alinhado com o GED): ${NOTA[m.numero]}.`;
  await req('PATCH', `/documento_versao?id=eq.${vs[0].id}`, { sha256: sha, tamanho: buf.length, nota });
  if (d.sha256) await req('PATCH', `/documento?id=eq.${d.id}`, { sha256: sha, updated_date: new Date().toISOString() });
  console.log('ok', m.numero.padEnd(20), sha.slice(0, 12));
}
fs.writeFileSync('C:/dirops/APP_DIROPS_v2/tools/ingest-ged/fnhu-fnca/backup-correccoes-2026-10-21.json', JSON.stringify(backup, null, 1));
