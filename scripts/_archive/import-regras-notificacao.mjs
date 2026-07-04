#!/usr/bin/env node
// Importa RegraNotificacao do Base44 -> on-premise regra_notificacao, FORÇANDO
// canal_envio=['email'] (WhatsApp não é usado on-premise) e limpando os campos
// de WhatsApp. id = UUID v5 determinístico. Rode APÓS apagar as regras vazias.
import crypto from 'crypto';
import fs from 'fs';
import { BASE44_API_KEY, BASE44_APP_ID, BASE44_API_URL } from './config.mjs';

const SGA = '128bc692-3fae-4825-9c55-40565dbedcfb';
const NS = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const PGRST = 'http://127.0.0.1:3000';
const SERVICE = fs.readFileSync('C:\\dirops\\sga-onpremise\\secrets\\service_role_key.txt', 'utf8').trim();
const hdr = { Authorization: 'Bearer ' + SERVICE, apikey: SERVICE, 'Content-Type': 'application/json' };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const B44_RE = /^[0-9a-f]{24}$/i;
function uuidV5(name) {
  const ns = Buffer.from(NS.replace(/-/g, ''), 'hex');
  const h = crypto.createHash('sha1').update(Buffer.concat([ns, Buffer.from(String(name), 'utf8')])).digest();
  const b = Buffer.from(h.subarray(0, 16)); b[6] = (b[6] & 0x0f) | 0x50; b[8] = (b[8] & 0x3f) | 0x80;
  const x = b.toString('hex');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20, 32)}`;
}
const tId = (v) => (typeof v === 'string' && B44_RE.test(v) ? uuidV5(v) : v);

const res = await fetch(`${BASE44_API_URL}/api/apps/${BASE44_APP_ID}/entities/RegraNotificacao?limit=200`, { headers: { api_key: BASE44_API_KEY, 'Content-Type': 'application/json' } });
const raw = await res.json();
const rows = Array.isArray(raw) ? raw : (raw.rows || raw.results || raw.data || []);
console.log(`${rows.length} regras no Base44`);

const mapped = rows.map(r => ({
  id: uuidV5(r.id),
  nome: r.nome || 'Regra',
  evento_gatilho: r.evento_gatilho || null,
  canal_envio: ['email'],                          // FORÇA email (ignora whatsapp)
  destinatarios_perfis: Array.isArray(r.destinatarios_perfis) ? r.destinatarios_perfis : [],
  destinatarios_usuarios_ids: Array.isArray(r.destinatarios_usuarios_ids) ? r.destinatarios_usuarios_ids.map(tId) : [],
  grupo_whatsapp_id: null,                          // limpo (whatsapp)
  mensagem_template_whatsapp: null,                 // limpo (whatsapp)
  mensagem_template_email_assunto: r.mensagem_template_email_assunto || null,
  mensagem_template_email_corpo: r.mensagem_template_email_corpo || null,
  template_html_aeroportos: r.template_html_aeroportos || null,
  prompt_ia_personalizado: r.prompt_ia_personalizado || null,
  aeroporto_icao_relatorio: r.aeroporto_icao_relatorio || null,
  ativo: r.ativo !== false,
  empresa_id: SGA,
  created_date: r.created_date || new Date().toISOString(),
  updated_date: r.updated_date || r.created_date || new Date().toISOString(),
}));

const post = await fetch(PGRST + '/regra_notificacao', {
  method: 'POST',
  headers: { ...hdr, Prefer: 'return=minimal,resolution=ignore-duplicates' },
  body: JSON.stringify(mapped),
});
console.log(post.ok ? `Importadas ${mapped.length} regras (canal=email).` : `ERRO ${post.status}: ${(await post.text()).slice(0, 300)}`);
