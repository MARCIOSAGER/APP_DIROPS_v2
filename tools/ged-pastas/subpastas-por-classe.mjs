// OBSOLETO (2026-10-08): substituído por pastas-setor-classe.mjs (Aeroporto → Setor → Classe). Correr este desfazia a estrutura.
console.error("OBSOLETO: use tools/ged-pastas/pastas-setor-classe.mjs"); process.exit(1);
// Cria, dentro de cada pasta-raiz de aeroporto, uma SUBPASTA por CLASSE de documento e move os documentos para lá.
// Antes: Aeroporto → (tudo solto).  Depois: Aeroporto → [MA — Manual, PL — Plano, ...] → documentos.
// Idempotente (reaproveita subpastas já criadas pelo nome). Guarda backup do pasta_id de cada documento antes de mexer.
//   node tools/ged-pastas/subpastas-por-classe.mjs            (simulação; não grava)
//   node tools/ged-pastas/subpastas-por-classe.mjs --apply    (grava)
import fs from 'node:fs';
import crypto from 'node:crypto';

const SVC = fs.readFileSync('C:/dirops/sga-onpremise/secrets/service_role_key.txt', 'utf8').trim();
const H = { apikey: SVC, Authorization: 'Bearer ' + SVC, 'Content-Type': 'application/json' };
const B = 'http://127.0.0.1:3000';
const APPLY = process.argv.includes('--apply');

const AER = [
  { icao: 'FNLU', pastaRaiz: 'd3171d67-1839-4701-8be0-6f8ce4b6406c', aeroporto_id: '7b031fd6-0388-5a61-a8d4-5250ff932a3f', cor: '#2563eb' },
  { icao: 'FNCT', pastaRaiz: '270269b5-340b-4cfa-bb2f-a4eb186a4969', aeroporto_id: '2f1c676c-7ed8-529b-9c11-af691197511e', cor: '#16a34a' },
  { icao: 'FNUB', pastaRaiz: '0dfb82d8-4b0f-4919-a7b1-22feb66547a9', aeroporto_id: '39646957-c5bc-5c55-b5b6-6d52f63a4981', cor: '#ea580c' },
  { icao: 'FNMO', pastaRaiz: 'da5f2c22-8fba-496c-9fed-10ba2ac1e0c1', aeroporto_id: 'f60f0524-241e-5d70-a845-04775b4067f3', cor: '#7c3aed' },
];
// Ordem de apresentação das subpastas: manuais/planos → procedimentos → normas → formulários → instruções → outros.
const ORDEM = ['MA', 'PL', 'PR', 'POP', 'NRM', 'RE', 'RINT', 'FR', 'FTO', 'FX', 'DO', 'LT', 'MT', 'CR', 'CRO', 'MP', 'MQ', 'PT'];
const SEM_CLASSE = '__sem__';

const get = async (path) => { const r = await fetch(B + path, { headers: H }); if (!r.ok) throw new Error(`${r.status} ${await r.text()}`); return r.json(); };

(async () => {
  const classes = await get('/documento_classe?select=codigo,nome&limit=100');
  const nomeClasse = Object.fromEntries(classes.map(c => [c.codigo, c.nome]));
  // Os documentos AVSEC-restritos vivem na pasta «AVSEC — Acesso restrito» (tools/ged-pastas/avsec-pasta.mjs): ficam de fora aqui.
  const procAvsec = new Set((await get('/documento_processo?setor_codigo=eq.AVSEC&select=codigo')).map(p => p.codigo));
  const docs = (await get('/documento?voo_ligado_id=is.null&deleted_at=is.null&select=id,aeroporto_id,classe_codigo,pasta_id,processo_codigo,classificacao_categoria,nivel_confidencialidade&limit=3000'))
    .filter(d => !(d.classificacao_categoria || d.nivel_confidencialidade === 'secreto' || procAvsec.has(d.processo_codigo)));
  const subExistentes = await get(`/pasta?deleted_at=is.null&pasta_pai_id=in.(${AER.map(a => a.pastaRaiz).join(',')})&select=id,nome,pasta_pai_id`);

  // backup do estado actual (documento → pasta_id) — só na 1.ª vez em modo apply, mas geramos sempre para registo.
  const backup = docs.map(d => ({ id: d.id, pasta_id: d.pasta_id }));
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const ficheiroBackup = `C:/dirops/APP_DIROPS_v2/tools/ged-pastas/backup-pasta-id-${stamp}.json`;
  if (APPLY) fs.writeFileSync(ficheiroBackup, JSON.stringify(backup, null, 2), 'utf8');

  let criadas = 0, movidos = 0;
  for (const a of AER) {
    const meus = docs.filter(d => d.aeroporto_id === a.aeroporto_id);
    const porClasse = {};
    for (const d of meus) { const c = d.classe_codigo || SEM_CLASSE; (porClasse[c] = porClasse[c] || []).push(d); }
    const codigos = Object.keys(porClasse).sort((x, y) => {
      if (x === SEM_CLASSE) return 1; if (y === SEM_CLASSE) return -1;
      const ix = ORDEM.indexOf(x), iy = ORDEM.indexOf(y);
      return (ix < 0 ? 99 : ix) - (iy < 0 ? 99 : iy) || x.localeCompare(y);
    });
    console.log(`\n== ${a.icao} (${meus.length} docs, ${codigos.length} subpastas) ==`);
    for (let i = 0; i < codigos.length; i++) {
      const cod = codigos[i];
      const nome = cod === SEM_CLASSE ? 'Sem classe' : `${cod} — ${nomeClasse[cod] || cod}`;
      let sub = subExistentes.find(p => p.pasta_pai_id === a.pastaRaiz && p.nome === nome);
      if (!sub) {
        const corpo = {
          id: crypto.randomUUID(), nome, aeroporto_id: a.aeroporto_id, pasta_pai_id: a.pastaRaiz,
          ordem: i, cor: a.cor, nivel_acesso: [], herdar_permissoes: true,
        };
        if (APPLY) {
          const r = await fetch(B + '/pasta', { method: 'POST', headers: { ...H, Prefer: 'return=representation' }, body: JSON.stringify(corpo) });
          if (!r.ok) throw new Error(`criar pasta ${nome}: ${r.status} ${await r.text()}`);
          sub = (await r.json())[0];
        } else sub = { id: corpo.id, nome };
        subExistentes.push({ id: sub.id, nome, pasta_pai_id: a.pastaRaiz });
        criadas++;
        console.log(`  + criada  ${nome}  (${porClasse[cod].length} docs)`);
      } else {
        console.log(`  = existe  ${nome}  (${porClasse[cod].length} docs)`);
      }
      // mover os documentos desta classe para a subpasta (só os que ainda não lá estão)
      const mover = porClasse[cod].filter(d => d.pasta_id !== sub.id).map(d => d.id);
      if (mover.length && APPLY) {
        for (let j = 0; j < mover.length; j += 50) {
          const lote = mover.slice(j, j + 50);
          const r = await fetch(B + `/documento?id=in.(${lote.join(',')})`, { method: 'PATCH', headers: H, body: JSON.stringify({ pasta_id: sub.id }) });
          if (!r.ok) throw new Error(`mover docs ${nome}: ${r.status} ${await r.text()}`);
        }
      }
      movidos += mover.length;
    }
  }
  console.log(`\n${APPLY ? 'APLICADO' : 'SIMULAÇÃO'}: ${criadas} subpastas, ${movidos} documentos movidos.`);
  if (APPLY) console.log('Backup:', ficheiroBackup);
  else console.log('(correr com --apply para gravar)');
})().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
