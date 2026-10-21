// Estrutura de pastas do GED: Aeroporto → SETOR → CLASSE → documentos.
// O setor de um documento vem do seu manual (documento_processo.setor_codigo); os AVSEC-restritos (classificado OU
// secreto OU manual do setor AVSEC — mesma regra de doc_e_restrito_avsec) vão SEMPRE para a pasta AVSEC, que leva
// nivel_acesso = {avsec} (invisível a quem não é gestor nem credenciado — migr 175). Sem manual/setor → «Geral».
// Pastas de classe antigas que fiquem vazias vão para a lixeira (soft delete). Idempotente; backup dos movimentos.
// Substitui subpastas-por-classe.mjs e avsec-pasta.mjs.
//   node tools/ged-pastas/pastas-setor-classe.mjs            (simulação)
//   node tools/ged-pastas/pastas-setor-classe.mjs --apply
import fs from 'node:fs';
import crypto from 'node:crypto';

const SVC = fs.readFileSync('C:/dirops/sga-onpremise/secrets/service_role_key.txt', 'utf8').trim();
const H = { apikey: SVC, Authorization: 'Bearer ' + SVC, 'Content-Type': 'application/json' };
const B = 'http://127.0.0.1:3000';
const APPLY = process.argv.includes('--apply');

const AER = [
  { icao: 'FNLU', pastaRaiz: 'd3171d67-1839-4701-8be0-6f8ce4b6406c', aeroporto_id: '7b031fd6-0388-5a61-a8d4-5250ff932a3f' },
  { icao: 'FNCT', pastaRaiz: '270269b5-340b-4cfa-bb2f-a4eb186a4969', aeroporto_id: '2f1c676c-7ed8-529b-9c11-af691197511e' },
  { icao: 'FNUB', pastaRaiz: '0dfb82d8-4b0f-4919-a7b1-22feb66547a9', aeroporto_id: '39646957-c5bc-5c55-b5b6-6d52f63a4981' },
  { icao: 'FNMO', pastaRaiz: 'da5f2c22-8fba-496c-9fed-10ba2ac1e0c1', aeroporto_id: 'f60f0524-241e-5d70-a845-04775b4067f3' },
  { icao: 'FNHU', pastaRaiz: 'ebbcd90b-d1fd-473f-ada1-4c9a5ae83344', aeroporto_id: '8f02727e-3eef-5bd5-a0d8-247dd2c6c70e' },
  { icao: 'FNCA', pastaRaiz: '514eae85-5cd6-4442-b8f1-35dc3b82c6dd', aeroporto_id: 'c10c0ab9-e40b-5961-8af7-480b2ab6bea1' },
];
const ORDEM_CLASSE = ['MA', 'PL', 'PR', 'POP', 'NRM', 'RE', 'RINT', 'FR', 'FTO', 'FX', 'DO', 'LT', 'MT', 'CR', 'CRO', 'MP', 'MQ', 'PT', 'TR'];
const NOME_AVSEC = 'AVSEC — Acesso restrito';
const DESC_AVSEC = 'Documentos de segurança da aviação (AVSEC). Visível só a gestores e a pessoal credenciado.';

const get = async (p) => { const r = await fetch(B + p, { headers: H }); if (!r.ok) throw new Error(`${r.status} ${await r.text()}`); return r.json(); };
const post = async (t, body) => { const r = await fetch(B + '/' + t, { method: 'POST', headers: { ...H, Prefer: 'return=representation' }, body: JSON.stringify(body) }); if (!r.ok) throw new Error(`${t}: ${r.status} ${await r.text()}`); return (await r.json())[0]; };
const patch = async (p, body) => { const r = await fetch(B + p, { method: 'PATCH', headers: H, body: JSON.stringify(body) }); if (!r.ok) throw new Error(`${p}: ${r.status} ${await r.text()}`); };

(async () => {
  const setores = await get('/documento_setor?ativo=eq.true&select=codigo,nome,cor,ordem');
  const setorPorCod = Object.fromEntries(setores.map(s => [s.codigo, s]));
  const processos = await get('/documento_processo?select=codigo,setor_codigo');
  const setorDoProc = Object.fromEntries(processos.map(p => [p.codigo, p.setor_codigo]));
  const nomeClasse = Object.fromEntries((await get('/documento_classe?select=codigo,nome')).map(c => [c.codigo, c.nome]));
  const docs = await get('/documento?voo_ligado_id=is.null&deleted_at=is.null&select=id,aeroporto_id,classe_codigo,pasta_id,processo_codigo,classificacao_categoria,nivel_confidencialidade&limit=3000');
  const pastas = await get('/pasta?deleted_at=is.null&select=id,nome,pasta_pai_id,aeroporto_id,nivel_acesso,ordem&limit=2000');

  const restrito = (d) => !!d.classificacao_categoria || d.nivel_confidencialidade === 'secreto' || setorDoProc[d.processo_codigo] === 'AVSEC';
  const setorDe = (d) => (restrito(d) ? 'AVSEC' : (setorPorCod[setorDoProc[d.processo_codigo]] ? setorDoProc[d.processo_codigo] : 'GERAL'));
  const nomePastaSetor = (cod) => (cod === 'AVSEC' ? NOME_AVSEC : (setorPorCod[cod]?.nome || cod));

  const garantir = async (paiId, nome, extra) => {
    let p = pastas.find(x => x.pasta_pai_id === paiId && x.nome === nome);
    if (p) {
      // acerta ordem/cor/nível se mudaram (ex.: a pasta AVSEC criada antes com ordem -1)
      const dif = {};
      if (extra.ordem !== undefined && p.ordem !== extra.ordem) dif.ordem = extra.ordem;
      if (APPLY && Object.keys(dif).length) { await patch(`/pasta?id=eq.${p.id}`, dif); Object.assign(p, dif); }
      return { p, nova: false };
    }
    const corpo = { id: crypto.randomUUID(), nome, pasta_pai_id: paiId, herdar_permissoes: true, nivel_acesso: [], ...extra };
    p = APPLY ? await post('pasta', corpo) : corpo;
    pastas.push(p);
    return { p, nova: true };
  };

  const movidos = []; let criadas = 0, apagadas = 0;
  for (const a of AER) {
    const meus = docs.filter(d => d.aeroporto_id === a.aeroporto_id);
    const porSetor = {};
    for (const d of meus) (porSetor[setorDe(d)] = porSetor[setorDe(d)] || []).push(d);
    const cods = Object.keys(porSetor).sort((x, y) => (setorPorCod[x]?.ordem ?? 99) - (setorPorCod[y]?.ordem ?? 99));
    console.log(`\n== ${a.icao} (${meus.length} docs)`);

    for (const sc of cods) {
      const avsec = sc === 'AVSEC';
      const { p: ps, nova } = await garantir(a.pastaRaiz, nomePastaSetor(sc), {
        aeroporto_id: a.aeroporto_id, ordem: setorPorCod[sc]?.ordem ?? 99,
        cor: avsec ? '#b91c1c' : (setorPorCod[sc]?.cor || '#64748b'),
        ...(avsec ? { nivel_acesso: ['avsec'], descricao: DESC_AVSEC } : { descricao: setorPorCod[sc]?.nome ? `Setor: ${setorPorCod[sc].nome}.` : null }),
      });
      if (nova) criadas++;
      const porClasse = {};
      for (const d of porSetor[sc]) (porClasse[d.classe_codigo || '__sem__'] = porClasse[d.classe_codigo || '__sem__'] || []).push(d);
      const cls = Object.keys(porClasse).sort((x, y) => (ORDEM_CLASSE.indexOf(x) < 0 ? 99 : ORDEM_CLASSE.indexOf(x)) - (ORDEM_CLASSE.indexOf(y) < 0 ? 99 : ORDEM_CLASSE.indexOf(y)));
      const resumo = [];
      for (let i = 0; i < cls.length; i++) {
        const c = cls[i];
        const nome = c === '__sem__' ? 'Sem classe' : `${c} — ${nomeClasse[c] || c}`;
        const { p: pc, nova: n2 } = await garantir(ps.id, nome, { aeroporto_id: a.aeroporto_id, ordem: i, cor: avsec ? '#b91c1c' : (setorPorCod[sc]?.cor || '#64748b'), ...(avsec ? { nivel_acesso: ['avsec'] } : {}) });
        if (n2) criadas++;
        const mover = porClasse[c].filter(d => d.pasta_id !== pc.id);
        for (const d of mover) movidos.push({ id: d.id, de: d.pasta_id, para: pc.id });
        if (APPLY && mover.length) for (let j = 0; j < mover.length; j += 50) await patch(`/documento?id=in.(${mover.slice(j, j + 50).map(d => d.id).join(',')})`, { pasta_id: pc.id });
        for (const d of mover) d.pasta_id = pc.id;
        resumo.push(`${c === '__sem__' ? '?' : c}:${porClasse[c].length}`);
      }
      console.log(`  ${nova ? '+' : '='} ${nomePastaSetor(sc)} (${porSetor[sc].length}) → ${resumo.join('  ')}`);
    }

    // limpeza: pastas (em qualquer nível abaixo da raiz) sem documentos e sem filhas → lixeira; repete até estabilizar
    let mudou = true;
    while (mudou) {
      mudou = false;
      for (const p of pastas.filter(x => x.aeroporto_id === a.aeroporto_id && x.id !== a.pastaRaiz && !x._apagada)) {
        const temDocs = docs.some(d => d.pasta_id === p.id);
        const temFilhas = pastas.some(x => x.pasta_pai_id === p.id && !x._apagada);
        if (!temDocs && !temFilhas) {
          console.log(`  - vazia → lixeira: ${p.nome}`);
          if (APPLY) await patch(`/pasta?id=eq.${p.id}`, { deleted_at: new Date().toISOString() });
          p._apagada = true; apagadas++; mudou = true;
        }
      }
    }
  }
  if (APPLY && movidos.length) {
    const f = `C:/dirops/APP_DIROPS_v2/tools/ged-pastas/backup-setor-classe-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    fs.writeFileSync(f, JSON.stringify(movidos, null, 2));
    console.log('\nBackup:', f);
  }
  console.log(`\n${APPLY ? 'APLICADO' : 'SIMULAÇÃO'}: ${criadas} pastas criadas, ${movidos.length} documentos movidos, ${apagadas} pastas vazias para a lixeira.`);
})().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
