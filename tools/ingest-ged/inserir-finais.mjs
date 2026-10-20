#!/usr/bin/env node
// Insere documentos FINAIS (plano-FINAIS-*.json): o PDF final passa a VERSÃO EM VIGOR; onde já existe um documento
// com esse número, as versões anteriores ficam 'obsoleto' e o rascunho não se perde (fica no histórico). O .docx
// final fica como "Fonte editável". Ficheiros já têm de estar no private-uploads (copiar.ps1 antes).
//   node tools/ingest-ged/inserir-finais.mjs --plano tools/ingest-ged/plano-FINAIS-FNLU.json
import fs from 'node:fs';
import path from 'node:path';
const arg = (k) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : null; };
const PLANO = arg('--plano'); if (!PLANO) { console.error('--plano obrigatório'); process.exit(1); }
const DATA = arg('--data') || new Date().toISOString().slice(0, 10);
const PGRST = 'http://127.0.0.1:3000';
const SVC = fs.readFileSync('C:/dirops/sga-onpremise/secrets/service_role_key.txt', 'utf8').trim();
const H = { apikey: SVC, Authorization: 'Bearer ' + SVC, 'Content-Type': 'application/json' };
const plano = JSON.parse(fs.readFileSync(path.resolve(PLANO), 'utf8'));
const get = async (p) => { const r = await fetch(PGRST + p, { headers: H }); if (!r.ok) throw new Error(`${p} → ${r.status}`); return r.json(); };
const post = async (t, b) => { const r = await fetch(`${PGRST}/${t}`, { method: 'POST', headers: { ...H, Prefer: 'return=representation' }, body: JSON.stringify(b) }); if (!r.ok) throw new Error(`POST ${t} → ${r.status} ${await r.text()}`); return (await r.json())[0]; };
const patch = async (q, b) => { const r = await fetch(`${PGRST}/${q}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(b) }); if (!r.ok) throw new Error(`PATCH ${q} → ${r.status} ${await r.text()}`); };
const classes = await get('/documento_classe?select=codigo,tipo_codigo');
const tipos = await get('/documento_tipo?select=codigo,id');
const tipoId = (c) => { const tc = classes.find(x => x.codigo === c)?.tipo_codigo; return tipos.find(t => t.codigo === tc)?.id || tipos.find(t => t.codigo === 'outro')?.id || null; };
const nf = (d, ext) => `${d.numero} - ${d.titulo}.${ext}`.replace(/[\\/:*?"<>|]+/g, '-');

for (const d of plano) {
  const ex = await get('/documento?numero=eq.' + encodeURIComponent(d.numero) + '&deleted_at=is.null&select=id,versao_atual,titulo&limit=1');
  if (ex.length) {
    const doc = ex[0];
    const vs = await get('/documento_versao?documento_id=eq.' + doc.id + '&select=versao,estado&order=versao.desc');
    const maxV = vs.reduce((m, v) => Math.max(m, v.versao), 0);
    // versões anteriores em vigor → obsoleto
    await patch('documento_versao?documento_id=eq.' + doc.id + '&estado=eq.em_vigor', { estado: 'obsoleto' });
    const vPdf = maxV + 1;
    await post('documento_versao', { documento_id: doc.id, versao: vPdf, rotulo: d.rotulo, arquivo_uri: d.stored_principal, arquivo_nome: nf(d, 'pdf'), mime: d.mime, estado: 'em_vigor', criado_por: 'final ANAC ' + DATA });
    if (d.stored_fonte) await post('documento_versao', { documento_id: doc.id, versao: vPdf + 1, rotulo: 'Fonte editável (.docx) — ' + d.rotulo, arquivo_uri: d.stored_fonte, arquivo_nome: nf(d, 'docx'), mime: d.fonte_mime, estado: 'fonte', criado_por: 'final ANAC' });
    await patch('documento?id=eq.' + doc.id, { titulo: d.titulo, arquivo_privado_uri: d.stored_principal, usar_storage_privado: true, arquivo_url: null, versao_atual: vPdf, estado: 'em_vigor', em_vigor_desde: DATA, publicacao_em: DATA, updated_by: 'final ANAC ' + DATA });
    console.log(`✓ actualizado ${d.numero} → v${vPdf} em vigor (anterior «${doc.titulo}» passou a versão ${maxV} obsoleta)`);
  } else {
    const doc = await post('documento', { titulo: d.titulo, numero: d.numero, aeroporto_id: d.aeroporto_id, pasta_id: d.pasta_id, classe_codigo: d.classe, processo_codigo: d.processo, tipo_id: tipoId(d.classe), estado: 'em_vigor', usar_storage_privado: true, arquivo_privado_uri: d.stored_principal, arquivo_url: null, publicacao_em: DATA, em_vigor_desde: DATA, versao_atual: d.stored_fonte ? 2 : 1, nivel_confidencialidade: 'interno', created_by: 'final ANAC ' + DATA, tags: [] });
    if (d.stored_fonte) { await post('documento_versao', { documento_id: doc.id, versao: 1, rotulo: 'Fonte editável (.docx)', arquivo_uri: d.stored_fonte, arquivo_nome: nf(d, 'docx'), mime: d.fonte_mime, estado: 'fonte', criado_por: 'final ANAC' });
      await post('documento_versao', { documento_id: doc.id, versao: 2, rotulo: d.rotulo, arquivo_uri: d.stored_principal, arquivo_nome: nf(d, 'pdf'), mime: d.mime, estado: 'em_vigor', criado_por: 'final ANAC' }); }
    else await post('documento_versao', { documento_id: doc.id, versao: 1, rotulo: d.rotulo, arquivo_uri: d.stored_principal, arquivo_nome: nf(d, 'pdf'), mime: d.mime, estado: 'em_vigor', criado_por: 'final ANAC' });
    console.log(`✓ novo ${d.numero} em vigor`);
  }
}
console.log('\nFinais FNLU aplicados.');
