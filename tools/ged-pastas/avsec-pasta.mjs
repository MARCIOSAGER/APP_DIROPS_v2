// OBSOLETO (2026-10-08): substituído por pastas-setor-classe.mjs (Aeroporto → Setor → Classe). Correr este desfazia a estrutura.
console.error("OBSOLETO: use tools/ged-pastas/pastas-setor-classe.mjs"); process.exit(1);
// Cria em cada aeroporto a pasta «AVSEC — Acesso restrito» (nivel_acesso = {avsec}) com subpastas por CLASSE e move
// para lá os documentos AVSEC-restritos (mesma regra de doc_e_restrito_avsec: classificado OU secreto OU manual do
// setor AVSEC). Subpastas de classe normais que fiquem vazias são enviadas para a lixeira (soft delete).
// Idempotente; backup do pasta_id de cada documento movido.
//   node tools/ged-pastas/avsec-pasta.mjs            (simulação)
//   node tools/ged-pastas/avsec-pasta.mjs --apply
import fs from 'node:fs';
import crypto from 'node:crypto';

const SVC = fs.readFileSync('C:/dirops/sga-onpremise/secrets/service_role_key.txt', 'utf8').trim();
const H = { apikey: SVC, Authorization: 'Bearer ' + SVC, 'Content-Type': 'application/json' };
const B = 'http://127.0.0.1:3000';
const APPLY = process.argv.includes('--apply');
const NOME_AVSEC = 'AVSEC — Acesso restrito';

const AER = [
  { icao: 'FNLU', pastaRaiz: 'd3171d67-1839-4701-8be0-6f8ce4b6406c', aeroporto_id: '7b031fd6-0388-5a61-a8d4-5250ff932a3f' },
  { icao: 'FNCT', pastaRaiz: '270269b5-340b-4cfa-bb2f-a4eb186a4969', aeroporto_id: '2f1c676c-7ed8-529b-9c11-af691197511e' },
  { icao: 'FNUB', pastaRaiz: '0dfb82d8-4b0f-4919-a7b1-22feb66547a9', aeroporto_id: '39646957-c5bc-5c55-b5b6-6d52f63a4981' },
  { icao: 'FNMO', pastaRaiz: 'da5f2c22-8fba-496c-9fed-10ba2ac1e0c1', aeroporto_id: 'f60f0524-241e-5d70-a845-04775b4067f3' },
];
const ORDEM = ['MA', 'PL', 'PR', 'POP', 'NRM', 'RE', 'RINT', 'FR', 'FTO', 'FX', 'DO', 'LT', 'MT', 'CR', 'CRO', 'MP', 'MQ', 'PT'];

const get = async (p) => { const r = await fetch(B + p, { headers: H }); if (!r.ok) throw new Error(`${r.status} ${await r.text()}`); return r.json(); };
const post = async (t, body) => { const r = await fetch(B + '/' + t, { method: 'POST', headers: { ...H, Prefer: 'return=representation' }, body: JSON.stringify(body) }); if (!r.ok) throw new Error(`${t}: ${r.status} ${await r.text()}`); return (await r.json())[0]; };
const patch = async (p, body) => { const r = await fetch(B + p, { method: 'PATCH', headers: H, body: JSON.stringify(body) }); if (!r.ok) throw new Error(`${p}: ${r.status} ${await r.text()}`); };

(async () => {
  const procAvsec = new Set((await get('/documento_processo?setor_codigo=eq.AVSEC&select=codigo')).map(p => p.codigo));
  const restrito = (d) => !!d.classificacao_categoria || d.nivel_confidencialidade === 'secreto' || procAvsec.has(d.processo_codigo);
  const nomeClasse = Object.fromEntries((await get('/documento_classe?select=codigo,nome')).map(c => [c.codigo, c.nome]));
  const docs = await get('/documento?voo_ligado_id=is.null&deleted_at=is.null&select=id,aeroporto_id,classe_codigo,pasta_id,processo_codigo,classificacao_categoria,nivel_confidencialidade&limit=3000');
  const pastas = await get('/pasta?deleted_at=is.null&select=id,nome,pasta_pai_id,aeroporto_id,nivel_acesso,ordem&limit=1000');

  const movidos = [];
  let criadas = 0, apagadas = 0;
  for (const a of AER) {
    const meus = docs.filter(d => d.aeroporto_id === a.aeroporto_id && restrito(d));
    console.log(`\n== ${a.icao}: ${meus.length} documentos AVSEC restritos`);
    if (!meus.length) continue;

    let raizAvsec = pastas.find(p => p.pasta_pai_id === a.pastaRaiz && p.nome === NOME_AVSEC);
    if (!raizAvsec) {
      const corpo = { id: crypto.randomUUID(), nome: NOME_AVSEC, aeroporto_id: a.aeroporto_id, pasta_pai_id: a.pastaRaiz, ordem: -1, cor: '#b91c1c', nivel_acesso: ['avsec'], herdar_permissoes: true, descricao: 'Documentos de segurança da aviação (AVSEC). Visível só a gestores e a pessoal credenciado.' };
      raizAvsec = APPLY ? await post('pasta', corpo) : corpo;
      pastas.push(raizAvsec); criadas++;
      console.log(`  + criada  ${NOME_AVSEC}`);
    } else console.log(`  = existe  ${NOME_AVSEC}`);

    const porClasse = {};
    for (const d of meus) (porClasse[d.classe_codigo || '__sem__'] = porClasse[d.classe_codigo || '__sem__'] || []).push(d);
    const cods = Object.keys(porClasse).sort((x, y) => (ORDEM.indexOf(x) < 0 ? 99 : ORDEM.indexOf(x)) - (ORDEM.indexOf(y) < 0 ? 99 : ORDEM.indexOf(y)));
    for (let i = 0; i < cods.length; i++) {
      const cod = cods[i];
      const nome = cod === '__sem__' ? 'Sem classe' : `${cod} — ${nomeClasse[cod] || cod}`;
      let sub = pastas.find(p => p.pasta_pai_id === raizAvsec.id && p.nome === nome);
      if (!sub) {
        const corpo = { id: crypto.randomUUID(), nome, aeroporto_id: a.aeroporto_id, pasta_pai_id: raizAvsec.id, ordem: i, cor: '#b91c1c', nivel_acesso: ['avsec'], herdar_permissoes: true };
        sub = APPLY ? await post('pasta', corpo) : corpo;
        pastas.push(sub); criadas++;
      }
      const mover = porClasse[cod].filter(d => d.pasta_id !== sub.id);
      console.log(`  ${nome}: ${porClasse[cod].length} docs (${mover.length} a mover)`);
      for (const d of mover) movidos.push({ id: d.id, de: d.pasta_id, para: sub.id });
      if (APPLY && mover.length) {
        for (let j = 0; j < mover.length; j += 50) await patch(`/documento?id=in.(${mover.slice(j, j + 50).map(d => d.id).join(',')})`, { pasta_id: sub.id });
      }
      for (const d of mover) d.pasta_id = sub.id;
    }

    // subpastas de classe NORMAIS (filhas directas da raiz do aeroporto) que ficaram sem documentos -> lixeira
    const normais = pastas.filter(p => p.pasta_pai_id === a.pastaRaiz && p.nome !== NOME_AVSEC);
    for (const p of normais) {
      const resta = docs.filter(d => d.pasta_id === p.id).length;
      const filhas = pastas.filter(x => x.pasta_pai_id === p.id).length;
      if (resta === 0 && filhas === 0) {
        console.log(`  - vazia -> lixeira: ${p.nome}`);
        if (APPLY) await patch(`/pasta?id=eq.${p.id}`, { deleted_at: new Date().toISOString() });
        apagadas++;
      }
    }
  }
  if (APPLY && movidos.length) {
    const f = `C:/dirops/APP_DIROPS_v2/tools/ged-pastas/backup-avsec-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    fs.writeFileSync(f, JSON.stringify(movidos, null, 2));
    console.log('\nBackup:', f);
  }
  console.log(`\n${APPLY ? 'APLICADO' : 'SIMULAÇÃO'}: ${criadas} pastas criadas, ${movidos.length} documentos movidos, ${apagadas} pastas vazias para a lixeira.`);
})().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
