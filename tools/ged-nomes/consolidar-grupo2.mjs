// Consolidação dos documentos repetidos «grupo 2» (13/10/2026): versões do mesmo documento passam a histórico de um só,
// .docx passam a fonte editável, cópias vão para a lixeira, títulos genéricos ganham a entidade. Backup antes de mexer.
//   node tools/ged-nomes/consolidar-grupo2.mjs           (simulação)
//   node tools/ged-nomes/consolidar-grupo2.mjs --apply
import fs from 'node:fs';
const SVC = fs.readFileSync('C:/dirops/sga-onpremise/secrets/service_role_key.txt', 'utf8').trim();
const H = { apikey: SVC, Authorization: 'Bearer ' + SVC, 'Content-Type': 'application/json', Prefer: 'return=representation' };
const B = 'http://127.0.0.1:3000';
const APPLY = process.argv.includes('--apply');
const req = async (m, p, body) => { const r = await fetch(B + p, { method: m, headers: H, body: body ? JSON.stringify(body) : undefined }); const t = await r.text(); if (!r.ok) throw new Error(`${m} ${p}: ${r.status} ${t}`); return t ? JSON.parse(t) : null; };
const agora = new Date().toISOString();

// ordem: [numero, papel, rótulo] — papel: 'historico' (versões ficam obsoletas), 'vigor' (a versão actual passa a em vigor), 'fonte' (.docx)
const FUSOES = [
  { principal: 'MA-FNMO-MOA-001', ordem: [['MA-FNMO-MOA-001', 'historico', 'Revisão 00 — Jul/2025'], ['MA-FNMO-MOA-002', 'historico', 'Revisão 00 — Jan/2026'], ['MA-FNMO-MOA-003', 'vigor', 'Revisão 00 — Fev/2026']] },
  { principal: 'PL-FNCT-PSCI-002', ordem: [['PL-FNCT-PSCI-002', 'historico', 'Versão Out/2024'], ['PL-FNCT-PSCI-003', 'vigor', 'Versão 15/03/2026'], ['PL-FNCT-PSCI-004', 'fonte', 'Fonte editável (.docx) — 15/03/2026']] },
  { principal: 'PL-FNCT-PEA-001', ordem: [['PL-FNCT-PEA-001', 'historico', 'Versão Out/2024'], ['PL-FNCT-PEA-005', 'vigor', 'Versão 15/03/2026']], lixeira: ['PL-FNCT-PEA-002', 'PL-FNCT-PEA-003', 'PL-FNCT-PEA-004'] },
  { principal: 'PT-FNMO-PSA-003', titulo: 'Planta do Terminal de Passageiros — R/C', ordem: [['PT-FNMO-PSA-003', 'historico', 'Fev/2025'], ['PT-FNMO-PSA-002', 'vigor', 'Mai/2025']] },
  { principal: 'PT-FNMO-PSA-001', titulo: 'Planta do Terminal de Passageiros — 1º andar', ordem: [['PT-FNMO-PSA-001', 'historico', 'Fev/2025'], ['PT-FNMO-PSA-004', 'vigor', 'Mai/2025']] },
  { principal: 'LT-FNLU-PSA-002', ordem: [['LT-FNLU-PSA-002', 'vigor', 'Revisão 02 — 25/05/2025'], ['LT-FNLU-PSA-005', 'fonte', 'Fonte editável (.docx)']], novoNumero: 'LT-FNLU-PCA-002', novoProcesso: 'PCA' },
  { principal: 'FR-FNMO-PEA-001', ordem: [['FR-FNMO-PEA-001', 'vigor', null], ['FR-FNMO-PSCI-002', 'fonte', 'Fonte editável (.docx)']] },
];
const SO_LIXEIRA = [['MQ-FNMO-PEA-003', 'mesmo mapa que MQ-FNMO-PEA-001'], ['MQ-FNMO-PEA-004', 'mesmo mapa que MQ-FNMO-PEA-002']];
const TITULOS = [
  ['DO-FNUB-MOA-009', 'Acordo de Cooperação com o SIC — Huíla'],
  ['DO-FNUB-MOA-010', 'Acordo de Cooperação com a AGT'],
  ['DO-FNUB-MOA-013', 'Acordo de Cooperação com a MAF — Huíla'],
  ['DO-FNUB-MOA-015', 'Acordo de Cooperação com a Delta Jet Aviação'],
];

const todos = [...new Set([...FUSOES.flatMap(f => [...f.ordem.map(o => o[0]), ...(f.lixeira || [])]), ...SO_LIXEIRA.map(x => x[0]), ...TITULOS.map(x => x[0])])];
const docs = await req('GET', `/documento?numero=in.(${todos.join(',')})&deleted_at=is.null&select=*,documento_versao(*)`);
const por = new Map(docs.map(d => [d.numero, d]));
const numeroDe = (docId) => docs.find(d => d.id === docId)?.numero;
const faltam = todos.filter(n => !por.has(n)); if (faltam.length) throw new Error('não encontrados: ' + faltam.join(', '));
const ocupado = await req('GET', '/documento?numero=eq.LT-FNLU-PCA-002&deleted_at=is.null&select=id');
if (ocupado.length) throw new Error('LT-FNLU-PCA-002 já existe — escolher outro número');
if (APPLY && !fs.existsSync('tools/ged-nomes/backup-grupo2-2026-10-13.json')) fs.writeFileSync('tools/ged-nomes/backup-grupo2-2026-10-13.json', JSON.stringify(docs, null, 2));

for (const f of FUSOES) {
  const p = por.get(f.principal);
  const plano = []; const fontes = [];
  for (const [num, papel, rotulo] of f.ordem) {
    const d = por.get(num);
    const vs = [...d.documento_versao].sort((a, b) => a.versao - b.versao);
    for (const v of vs) {
      if (v.estado === 'fonte' || papel === 'fonte') { fontes.push({ v, rotulo: papel === 'fonte' ? rotulo : v.rotulo }); continue; }
      const actual = v.versao === d.versao_atual;
      const estado = papel === 'vigor' && actual ? 'em_vigor' : 'obsoleto';
      plano.push({ v, estado, rotulo: actual && rotulo ? rotulo : v.rotulo, doc: d });
    }
  }
  let n = 0;
  for (const x of plano) x.novo = ++n;
  for (const x of fontes) { x.novo = ++n; x.estado = 'fonte'; }
  const vV = plano.find(x => x.estado === 'em_vigor');
  console.log(`\n${f.principal}${f.novoNumero ? ' → ' + f.novoNumero : ''}${f.titulo ? ' «' + f.titulo + '»' : ''}`);
  for (const x of [...plano, ...fontes]) console.log(`   v${x.novo} ${x.estado.padEnd(8)} ${x.rotulo || ''}  (de ${numeroDe(x.v.documento_id)} v${x.v.versao})`);
  const outros = [...new Set([...f.ordem.map(o => o[0]).filter(x => x !== f.principal), ...(f.lixeira || [])])];
  console.log('   lixeira: ' + (outros.join(', ') || '—'));
  if (!vV) throw new Error('sem versão em vigor em ' + f.principal);
  if (!APPLY) continue;
  // Só pode haver UMA versão em vigor por documento (documento_versao_uma_em_vigor): primeiro despromove-se tudo
  // ao mudar de documento (números temporários), depois números finais, e só no fim a que fica em vigor.
  for (const x of [...plano, ...fontes]) await req('PATCH', `/documento_versao?id=eq.${x.v.id}`, { documento_id: p.id, versao: 1000 + x.novo, estado: x.estado === 'em_vigor' ? 'obsoleto' : x.estado });
  for (const x of [...plano, ...fontes]) await req('PATCH', `/documento_versao?id=eq.${x.v.id}`, { versao: x.novo, estado: x.estado === 'em_vigor' ? 'obsoleto' : x.estado, ...(x.rotulo ? { rotulo: x.rotulo } : {}) });
  await req('PATCH', `/documento_versao?id=eq.${vV.v.id}`, { estado: 'em_vigor' });
  const patch = { versao_atual: vV.novo, estado: 'em_vigor', arquivo_privado_uri: vV.doc.arquivo_privado_uri, updated_date: agora };
  if (vV.doc.em_vigor_desde) patch.em_vigor_desde = vV.doc.em_vigor_desde;
  if (f.titulo) patch.titulo = f.titulo;
  if (f.novoNumero) { patch.numero = f.novoNumero; patch.processo_codigo = f.novoProcesso; }
  await req('PATCH', `/documento?id=eq.${p.id}`, patch);
  for (const num of outros) await req('PATCH', `/documento?id=eq.${por.get(num).id}`, { deleted_at: agora, deleted_by: `consolidado em ${f.novoNumero || f.principal}` });
}
console.log('\nSó lixeira:'); for (const [num, porque] of SO_LIXEIRA) { console.log(`   ${num} (${porque})`); if (APPLY) await req('PATCH', `/documento?id=eq.${por.get(num).id}`, { deleted_at: agora, deleted_by: porque }); }
console.log('Títulos:'); for (const [num, t] of TITULOS) { console.log(`   ${num} → ${t}`); if (APPLY) await req('PATCH', `/documento?id=eq.${por.get(num).id}`, { titulo: t, updated_date: agora }); }
console.log(APPLY ? '\nAPLICADO (backup tools/ged-nomes/backup-grupo2-2026-10-13.json)' : '\nSIMULAÇÃO — correr com --apply');
