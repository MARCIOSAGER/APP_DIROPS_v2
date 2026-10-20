#!/usr/bin/env node
// Insere no GED os documentos do plano.json (pasta FNLU, aeroporto FNLU). Idempotente: salta números já existentes.
// Os ficheiros têm de estar já no private-uploads (correr copiar.ps1 antes).
//   node tools/ingest-fnlu/inserir.mjs [--dry] [--limit N]
import fs from 'node:fs';

const PGRST = 'http://127.0.0.1:3000';
const SVC = fs.readFileSync('C:/dirops/sga-onpremise/secrets/service_role_key.txt', 'utf8').trim();
const HDR = { apikey: SVC, Authorization: 'Bearer ' + SVC, 'Content-Type': 'application/json' };
const FNLU_AERO = '7b031fd6-0388-5a61-a8d4-5250ff932a3f';
const FNLU_PASTA = 'd3171d67-1839-4701-8be0-6f8ce4b6406c';
const PUB = '2026-03-15';
const DRY = process.argv.includes('--dry');
const li = process.argv.indexOf('--limit');
const LIMIT = li >= 0 ? Number(process.argv[li + 1]) : Infinity;

const plano = JSON.parse(fs.readFileSync('C:/dirops/APP_DIROPS_v2/tools/ingest-fnlu/plano.json', 'utf8'));
const get = async (p) => { const r = await fetch(PGRST + p, { headers: HDR }); if (!r.ok) throw new Error(`${p} → ${r.status}`); return r.json(); };
const post = async (t, body) => { const r = await fetch(`${PGRST}/${t}`, { method: 'POST', headers: { ...HDR, Prefer: 'return=representation' }, body: JSON.stringify(body) }); if (!r.ok) throw new Error(`POST ${t} → ${r.status} ${await r.text()}`); return (await r.json())[0]; };

const classes = await get('/documento_classe?select=codigo,tipo_codigo');
const tipos = await get('/documento_tipo?select=codigo,id');
const tipoIdDeClasse = (c) => { const tc = classes.find(x => x.codigo === c)?.tipo_codigo; return tipos.find(t => t.codigo === tc)?.id || tipos.find(t => t.codigo === 'outro')?.id || null; };
const nomeFich = (d, ext) => `${d.numero} - ${d.titulo}.${ext}`.replace(/[\\/:*?"<>|]+/g, '-');

let feitos = 0, saltados = 0, i = 0;
for (const d of plano) {
  if (i++ >= LIMIT) break;
  const existe = await get('/documento?numero=eq.' + encodeURIComponent(d.numero) + '&deleted_at=is.null&select=id&limit=1');
  if (existe.length) { saltados++; console.log(`salta (já existe): ${d.numero}`); continue; }
  const temFonte = !!d.stored_fonte;
  const versaoAtual = temFonte ? 2 : 1;
  if (DRY) { console.log(`[dry] ${d.numero} · v${versaoAtual} · ${d.estado} · ${d.titulo}`); feitos++; continue; }
  const doc = await post('documento', {
    titulo: d.titulo, numero: d.numero, aeroporto_id: FNLU_AERO, pasta_id: FNLU_PASTA,
    classe_codigo: d.classe, processo_codigo: d.processo, tipo_id: tipoIdDeClasse(d.classe),
    estado: d.estado, usar_storage_privado: true, arquivo_privado_uri: d.stored_principal, arquivo_url: null,
    publicacao_em: PUB, em_vigor_desde: d.estado === 'em_vigor' ? PUB : null,
    versao_atual: versaoAtual, nivel_confidencialidade: 'interno',
    created_by: 'importação FNLU 15.03.2026', descricao: null, tags: [],
  });
  if (temFonte) {
    await post('documento_versao', { documento_id: doc.id, versao: 1, rotulo: 'Fonte editável (.docx)', arquivo_uri: d.stored_fonte, arquivo_nome: nomeFich(d, d.fonte_formato), mime: d.fonte_mime, estado: 'fonte', criado_por: 'importação FNLU' });
    await post('documento_versao', { documento_id: doc.id, versao: 2, rotulo: 'Versão 15.03.2026', arquivo_uri: d.stored_principal, arquivo_nome: nomeFich(d, d.formato), mime: d.mime, estado: d.estado, criado_por: 'importação FNLU' });
  } else {
    await post('documento_versao', { documento_id: doc.id, versao: 1, rotulo: 'Versão 15.03.2026', arquivo_uri: d.stored_principal, arquivo_nome: nomeFich(d, d.formato), mime: d.mime, estado: d.estado, criado_por: 'importação FNLU' });
  }
  feitos++; console.log(`✓ ${d.numero} · ${d.titulo}`);
}
console.log(`\nInseridos: ${feitos} · saltados (já existiam): ${saltados}`);
