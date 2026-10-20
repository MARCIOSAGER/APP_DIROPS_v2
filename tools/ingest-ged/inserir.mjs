#!/usr/bin/env node
// Insere no GED os documentos de um plano-<ICAO>.json (genérico). Idempotente por número.
// Ficheiros têm de estar já no private-uploads (correr copiar.ps1 antes).
//   node tools/ingest-ged/inserir.mjs --plano tools/ingest-ged/plano-FNUB.json [--data 2026-03-15] [--dry] [--limit N]
import fs from 'node:fs';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const PLANO = arg('--plano'); if (!PLANO) { console.error('--plano <ficheiro> obrigatório'); process.exit(1); }
const DATA = arg('--data', new Date().toISOString().slice(0, 10));
const CLASSIFICAR = arg('--classificar', null); // código de categoria (ex.: 3.b) → documento classificado (parede AVSEC)
const DRY = process.argv.includes('--dry');
const li = process.argv.indexOf('--limit');
const LIMIT = li >= 0 ? Number(process.argv[li + 1]) : Infinity;

const PGRST = 'http://127.0.0.1:3000';
const SVC = fs.readFileSync('C:/dirops/sga-onpremise/secrets/service_role_key.txt', 'utf8').trim();
const HDR = { apikey: SVC, Authorization: 'Bearer ' + SVC, 'Content-Type': 'application/json' };
const plano = JSON.parse(fs.readFileSync(path.resolve(PLANO), 'utf8'));
const get = async (p) => { const r = await fetch(PGRST + p, { headers: HDR }); if (!r.ok) throw new Error(`${p} → ${r.status}`); return r.json(); };
const post = async (t, body) => { const r = await fetch(`${PGRST}/${t}`, { method: 'POST', headers: { ...HDR, Prefer: 'return=representation' }, body: JSON.stringify(body) }); if (!r.ok) throw new Error(`POST ${t} → ${r.status} ${await r.text()}`); return (await r.json())[0]; };
const nomeFich = (d, ext) => `${d.numero} - ${d.titulo}.${ext}`.replace(/[\\/:*?"<>|]+/g, '-');

const classes = await get('/documento_classe?select=codigo,tipo_codigo');
const tipos = await get('/documento_tipo?select=codigo,id');
const tipoIdDeClasse = (c) => { const tc = classes.find(x => x.codigo === c)?.tipo_codigo; return tipos.find(t => t.codigo === tc)?.id || tipos.find(t => t.codigo === 'outro')?.id || null; };

let feitos = 0, saltados = 0, i = 0;
for (const d of plano) {
  if (i++ >= LIMIT) break;
  const existe = await get('/documento?numero=eq.' + encodeURIComponent(d.numero) + '&deleted_at=is.null&select=id&limit=1');
  if (existe.length) { saltados++; console.log(`salta (já existe): ${d.numero}`); continue; }
  const temFonte = !!d.stored_fonte;
  const versaoAtual = temFonte ? 2 : 1;
  if (DRY) { console.log(`[dry] ${d.numero} · v${versaoAtual} · ${d.estado} · ${d.titulo}`); feitos++; continue; }
  const doc = await post('documento', {
    titulo: d.titulo, numero: d.numero, aeroporto_id: d.aeroporto_id, pasta_id: d.pasta_id,
    classe_codigo: d.classe, processo_codigo: d.processo, tipo_id: tipoIdDeClasse(d.classe),
    estado: d.estado, usar_storage_privado: true, arquivo_privado_uri: d.stored_principal, arquivo_url: null,
    publicacao_em: DATA, em_vigor_desde: d.estado === 'em_vigor' ? DATA : null,
    versao_atual: versaoAtual, nivel_confidencialidade: 'interno',
    classificacao_categoria: CLASSIFICAR || null,
    created_by: 'importação ' + d.icao + ' ' + DATA, descricao: null, tags: [],
  });
  if (temFonte) {
    await post('documento_versao', { documento_id: doc.id, versao: 1, rotulo: 'Fonte editável (.docx)', arquivo_uri: d.stored_fonte, arquivo_nome: nomeFich(d, d.fonte_formato), mime: d.fonte_mime, estado: 'fonte', criado_por: 'importação ' + d.icao });
    await post('documento_versao', { documento_id: doc.id, versao: 2, rotulo: 'Versão ' + DATA, arquivo_uri: d.stored_principal, arquivo_nome: nomeFich(d, d.formato), mime: d.mime, estado: d.estado, criado_por: 'importação ' + d.icao });
  } else {
    await post('documento_versao', { documento_id: doc.id, versao: 1, rotulo: 'Versão ' + DATA, arquivo_uri: d.stored_principal, arquivo_nome: nomeFich(d, d.formato), mime: d.mime, estado: d.estado, criado_por: 'importação ' + d.icao });
  }
  feitos++; console.log(`✓ ${d.numero} · ${d.titulo}`);
}
console.log(`\nInseridos: ${feitos} · saltados (já existiam): ${saltados}`);
