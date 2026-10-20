// Gera um relatório HTML de COMPLETUDE + VERSÕES do GED por aeroporto (depois converte-se a PDF com LibreOffice).
import fs from 'node:fs';
const SVC = fs.readFileSync('C:/dirops/sga-onpremise/secrets/service_role_key.txt', 'utf8').trim();
const H = { apikey: SVC, Authorization: 'Bearer ' + SVC };
const B = 'http://127.0.0.1:3000';
const AER = [
  { icao: 'FNLU', id: '7b031fd6-0388-5a61-a8d4-5250ff932a3f', nome: 'Aeroporto Internacional 4 de Fevereiro (Luanda)' },
  { icao: 'FNCT', id: '2f1c676c-7ed8-529b-9c11-af691197511e', nome: 'Aeroporto da Catumbela' },
  { icao: 'FNUB', id: '39646957-c5bc-5c55-b5b6-6d52f63a4981', nome: 'Aeroporto da Mukanka (Lubango)' },
  { icao: 'FNMO', id: 'f60f0524-241e-5d70-a845-04775b4067f3', nome: 'Aeroporto Welwitschia Mirabilis (Namibe)' },
];
const EXIG = [
  ['MOA', 'Manual de Operações do Aeródromo'], ['MGSO', 'Manual de Gestão da Segurança Operacional (SGSO)'],
  ['PEA', 'Plano de Emergência do Aeródromo'], ['PSCI', 'Plano de Salvamento e Combate a Incêndio'],
  ['PGRF', 'Plano de Gestão do Risco de Fauna'], ['PRAFS', 'Plano de Remoção de Aeronave Fora de Serviço'],
  ['SMGCS', 'Sistema de Orientação e Controlo na Superfície'], ['PBZPA', 'Plano Básico da Zona de Protecção'],
  ['PMA', 'Programa de Manutenção do Aeroporto'], ['PFOA', 'Programa de Formação do Operador'],
  ['PSA', 'Programa de Segurança do Aeroporto (AVSEC)'], ['PCA', 'Plano de Contingência do Aeroporto'],
];
const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

const docs = await (await fetch(B + '/documento?voo_ligado_id=is.null&deleted_at=is.null&select=numero,titulo,classe_codigo,processo_codigo,estado,versao_atual,aeroporto_id,classificado&limit=3000', { headers: H })).json();
let logo = '';
try { logo = 'data:image/png;base64,' + fs.readFileSync('C:/dirops/APP_DIROPS_v2/public/logo-sga.png').toString('base64'); } catch {}

const hoje = new Date().toLocaleDateString('pt-PT');
let html = `<!doctype html><html lang="pt"><head><meta charset="utf-8"><style>
body{font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;font-size:11px;margin:24px}
h1{color:#1B407B;font-size:20px;margin:0 0 2px} h2{color:#1B407B;font-size:15px;margin:22px 0 6px;border-bottom:2px solid #1B407B;padding-bottom:3px}
h3{font-size:12px;margin:12px 0 4px;color:#334155}
table{border-collapse:collapse;width:100%;margin:6px 0 10px;font-size:10.5px}
th,td{border:1px solid #cbd5e1;padding:3px 6px;text-align:left} th{background:#1B407B;color:#fff;font-weight:600}
.falta{background:#fee2e2;color:#b91c1c;font-weight:700;text-align:center}
.ok{text-align:center;color:#166534} .num{text-align:right}
.aviso{background:#fffbeb;border-left:3px solid #d97706;padding:6px 10px;margin:6px 0;font-size:10.5px}
.cab{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #1B407B;padding-bottom:8px;margin-bottom:10px}
.meta{color:#64748b;font-size:10px} .dup{color:#b45309}
</style></head><body>
<div class="cab"><div><h1>Relatório de Completude e Versões — GED</h1><div class="meta">Portal de Documentos · Sociedade Gestora de Aeroportos, S.A. · ${hoje}</div></div>${logo ? `<img src="${logo}" style="height:46px">` : ''}</div>
<p class="meta">Análise automática: presença dos manuais/planos exigidos por aeroporto e estado das versões. <b>Nota:</b> a presença é determinada pela codificação (3.º segmento do número); não avalia se o <i>conteúdo</i> cumpre a norma. Documentos classificados (AVSEC) contam na totalidade mas só são visíveis a credenciados.</p>`;

// matriz de completude global
html += `<h2>1. Completude por aeroporto (manuais/planos exigidos)</h2><table><tr><th>Manual / Plano</th>${AER.map(a => `<th>${a.icao}</th>`).join('')}</tr>`;
for (const [cod, nome] of EXIG) {
  html += `<tr><td>${cod} — ${esc(nome)}</td>`;
  for (const a of AER) { const n = docs.filter(d => d.aeroporto_id === a.id && d.processo_codigo === cod).length; html += n > 0 ? `<td class="ok">${n}</td>` : `<td class="falta">FALTA</td>`; }
  html += `</tr>`;
}
html += `</table>`;
const faltas = [];
for (const a of AER) for (const [cod] of EXIG) if (!docs.some(d => d.aeroporto_id === a.id && d.processo_codigo === cod)) faltas.push(`${a.icao}: ${cod}`);
if (faltas.length) html += `<div class="aviso"><b>Lacunas a verificar (${faltas.length}):</b> ${faltas.join(' · ')}. Confirmar se faltam mesmo ou se estão codificados noutro manual.</div>`;

// por aeroporto: totais, versões, duplicados
html += `<h2>2. Detalhe por aeroporto</h2>`;
for (const a of AER) {
  const meus = docs.filter(d => d.aeroporto_id === a.id);
  const emv = meus.filter(d => d.estado === 'em_vigor').length, rasc = meus.filter(d => d.estado === 'rascunho').length, cls = meus.filter(d => d.classificado).length, mv = meus.filter(d => (d.versao_atual || 1) > 1);
  // duplicados: mesmo título normalizado (>1) dentro do aeroporto
  const porTit = {}; for (const d of meus) { const k = norm(d.titulo); (porTit[k] = porTit[k] || []).push(d); }
  const dups = Object.values(porTit).filter(g => g.length > 1);
  html += `<h3>${a.icao} — ${esc(a.nome)}</h3><p class="meta">Total: <b>${meus.length}</b> documentos · em vigor: ${emv} · rascunho: ${rasc} · classificados (AVSEC): ${cls} · com histórico de versões: ${mv.length}</p>`;
  if (mv.length) { html += `<table><tr><th>Número</th><th>Título</th><th class="num">Versão actual</th></tr>${mv.map(d => `<tr><td>${esc(d.numero)}</td><td>${esc(d.titulo)}</td><td class="num">${d.versao_atual}</td></tr>`).join('')}</table>`; }
  if (dups.length) { html += `<div class="aviso dup"><b>Possíveis duplicados (mesmo título, ${dups.length} grupo(s)):</b></div><table><tr><th>Título</th><th>Números</th></tr>${dups.map(g => `<tr><td>${esc(g[0].titulo)}</td><td>${g.map(x => esc(x.numero)).join(', ')}</td></tr>`).join('')}</table>`; }
}
html += `<p class="meta" style="margin-top:20px">Gerado automaticamente pelo Portal de Documentos (DIROPS/SGA). Para a conformidade de conteúdo contra as normas (NTA 32, ICAO, RTA), usar o módulo Conformidade com os requisitos semeados e validação do responsável.</p></body></html>`;

fs.writeFileSync('C:/dirops/APP_DIROPS_v2/tools/ingest-ged/relatorio-completude.html', html, 'utf8');
console.log('HTML escrito: tools/ingest-ged/relatorio-completude.html (' + docs.length + ' documentos analisados, ' + faltas.length + ' lacunas)');
