#!/usr/bin/env node
// Plano GENÉRICO de importação de uma pasta de documentos para o GED (qualquer aeroporto).
//   node tools/ingest-ged/plano.mjs --icao FNCT --raiz "docs/00-ANAC-ICVM/03-MOA FNCT rev15.03.2026"
// Regras: pares docx+PDF → PDF em vigor + docx "Fonte editável"; o aeroporto do número é FORÇADO ao --icao;
// "AGUARDANDO/MINUTA/DRAFT" → rascunho; Listas Mestre em ficheiro ficam de fora. NÃO grava nada (só plano.json).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const ICAO = (arg('--icao') || '').toUpperCase();
const RAIZ = arg('--raiz');
if (!ICAO || !RAIZ) { console.error('Uso: --icao FNCT --raiz "<pasta>"'); process.exit(1); }
const RAIZ_ABS = path.resolve(RAIZ).replace(/\\/g, '/');

const PGRST = 'http://127.0.0.1:3000';
const SVC = fs.readFileSync('C:/dirops/sga-onpremise/secrets/service_role_key.txt', 'utf8').trim();
const HDR = { apikey: SVC, Authorization: 'Bearer ' + SVC };
const get = async (p) => { const r = await fetch(PGRST + p, { headers: HDR }); if (!r.ok) throw new Error(`${p} → ${r.status}`); return r.json(); };

const MIME = { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', doc: 'application/msword', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', xls: 'application/vnd.ms-excel', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', kml: 'application/vnd.google-earth.kml+xml', kmz: 'application/vnd.google-earth.kmz', mp4: 'video/mp4' };
const RE_EXT = /\.(pdf|docx?|xlsx?|pptx?|jpe?g|png|kmz?|mp4)$/i;
const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
const ext = (f) => (f.match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase();
const slug = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '').slice(0, 60);
const hash9 = () => crypto.randomBytes(5).toString('hex').slice(0, 9);
const nomeStore = (numero, titulo, extensao) => `${hash9()}_${numero}-${slug(titulo)}.${extensao}`;

function processoDaPasta(rel) {
  const u = rel.toUpperCase();
  if (u.includes('AP.03') || /\bPEA\b/.test(u)) return 'PEA';
  if (u.includes('AP.04') || /\bPSCI\b/.test(u)) return 'PSCI';
  if (u.includes('AP.05') || u.includes('PMAM')) return 'PMA';
  if (u.includes('AP.06') || /\bPGRF\b/.test(u)) return 'PGRF';
  if (u.includes('AP.07') || u.includes('PBZPA')) return 'PBZPA';
  if (u.includes('AP.08') || u.includes('PRAFS')) return 'PRAFS';
  if (u.includes('AP.09') || u.includes('SMGCS')) return 'SMGCS';
  if (u.includes('AP.10') || u.includes('MSGSO') || /\bMGSO\b/.test(u)) return 'MGSO';
  if (u.includes('AP.11') || u.includes('PFOA')) return 'PFOA';
  if (u.includes('AP.12') || /\bRST\b/.test(u)) return 'RST';
  return 'MOA';
}
function classeInferida(nome) {
  const u = nome.toUpperCase();
  if (/\bCV[- ]/.test(u) || u.startsWith('CV')) return 'DO';
  if (u.includes('NOME')) return 'DO';
  if (u.includes('PROTOCOLO') || u.includes('ACORDO')) return 'DO';
  if (u.includes('MAPA') || u.includes('CARTA ADC') || u.includes('CARTA PDC') || u.includes('CARTA DE OBST')) return 'MP';
  if (u.includes('QUADRICULA') || u.includes('QUADRÍCULA')) return 'MQ';
  if (u.includes('LISTA')) return 'LT';
  if (u.includes('MANUAL')) return 'MA';
  if (u.includes('PROCEDIMENTO') || /\bPOP\b/.test(u)) return 'POP';
  if (u.includes('PLANO')) return 'PL';
  if (u.includes('PROGRAMA')) return 'PR';
  if (u.includes('RELAT')) return 'RE';
  if (u.includes('MATRIZ')) return 'MT';
  if (u.includes('CRONOGRAMA')) return 'CR';
  if (u.includes('FORM') || u.includes('FICHA') || u.includes('REGISTO')) return 'FR';
  return 'DO';
}
function codigoDoNome(nome) {
  let s = nome.replace(RE_EXT, '');
  s = s.replace(/^\s*(?:AN|AP)\s*\.?\s*\d{1,2}\s*\.?\s*\d{0,3}\s*[#^N]*\s*/i, '');
  const colado = s.match(/\b([A-Z]{2,4})-([A-Z]{4})([A-Z]{2,8})-(\d{1,3})\b/);
  if (colado) return { classe: colado[1].toUpperCase(), processo: colado[3].toUpperCase(), seq: +colado[4] };
  const full = s.match(/\b([A-Z]{2,4})-([A-Z0-9]{3,5})-([A-Z]{2,8})-(\d{1,3})\b/);
  if (full) return { classe: full[1].toUpperCase(), processo: full[3].toUpperCase(), seq: +full[4] };
  return null;
}
function tituloLimpo(nome) {
  let t = nome.replace(RE_EXT, '');
  t = t.replace(/^\s*(?:AN|AP)\s*\.?\s*\d{1,2}\s*\.?\s*\d{0,3}\s*[#^N]*\s*/i, '');
  t = t.replace(/\b[A-Z]{2,4}-[A-Z0-9]{3,8}-?[A-Z0-9]{0,8}-?\d{0,3}\b/g, ' ');
  t = t.replace(/\b(rev\.?\s*\d+|vers[aã]o\s*[\d.]+)/gi, ' ');
  t = t.replace(/[._#-]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  t = t.replace(/^\d{1,2}(\s+\d{1,3})*\s+/, '').trim();
  return t || nome.replace(RE_EXT, '');
}
const ehRascunho = (nome) => /AGUARDAND|MINUTA|DRAFT|RASCUNHO/i.test(nome);
const ehListaMestre = (nome) => /Lista\s*Mestr[ae]/i.test(nome);

function walk(dir, rel = '') {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) out = out.concat(walk(full, r));
    else if (RE_EXT.test(e.name)) out.push({ full: full.replace(/\\/g, '/'), rel: r, dir: rel, nome: e.name });
  }
  return out;
}

(async () => {
  const aero = await get('/documentos_aeroporto?codigo_icao=eq.' + ICAO + '&select=id,nome&limit=1');
  if (!aero.length) throw new Error('Aeroporto ' + ICAO + ' não existe em documentos_aeroporto');
  const aeroId = aero[0].id;
  const procSet = new Set((await get('/documento_processo?select=codigo')).map(x => x.codigo));
  const classeSet = new Set((await get('/documento_classe?select=codigo')).map(x => x.codigo));
  const pastas = await get('/pasta?aeroporto_id=eq.' + aeroId + '&pasta_pai_id=is.null&deleted_at=is.null&select=id,nome');
  const pasta = pastas.find(p => p.nome.toUpperCase().startsWith(ICAO)) || pastas[0];
  if (!pasta) throw new Error('Sem pasta-raiz para ' + ICAO + ' (crie-a primeiro)');

  const ficheiros = walk(RAIZ_ABS).filter(f => !ehListaMestre(f.nome));
  const grupos = new Map();
  for (const f of ficheiros) {
    const base = norm(f.nome.replace(RE_EXT, ''));
    const chave = f.dir + '||' + base;
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(f);
  }
  const usados = new Set();
  const seqLivre = (c, p, pref) => { if (pref) { const k = `${c}|${p}|${pref}`; if (!usados.has(k)) { usados.add(k); return pref; } } let n = 1; while (usados.has(`${c}|${p}|${n}`)) n++; usados.add(`${c}|${p}|${n}`); return n; };

  const plano = [];
  for (const [, fs_] of grupos) {
    const pdf = fs_.find(x => ext(x.full) === 'pdf');
    const docx = fs_.find(x => /^docx?$/.test(ext(x.full)));
    const xlsx = fs_.find(x => /^xlsx?$/.test(ext(x.full)));
    const outro = fs_.find(x => !['pdf', 'docx', 'doc', 'xlsx', 'xls'].includes(ext(x.full)));
    const principal = pdf || xlsx || docx || outro || fs_[0];
    const fonte = (pdf && docx) ? docx : null;
    const proc = processoDaPasta(principal.dir);
    const cod = codigoDoNome(principal.nome);
    // classe e manual do código só valem se existirem nas tabelas; senão inferem-se do nome/pasta
    const classe = (cod?.classe && classeSet.has(cod.classe)) ? cod.classe : classeInferida(principal.nome);
    const processo = (cod?.processo && procSet.has(cod.processo)) ? cod.processo : proc;
    const seq = seqLivre(classe, processo, cod?.seq);
    const numero = `${classe}-${ICAO}-${processo}-${String(seq).padStart(3, '0')}`;
    const titulo = tituloLimpo(principal.nome);
    const extP = ext(principal.full);
    plano.push({
      icao: ICAO, aeroporto_id: aeroId, pasta_id: pasta.id,
      numero, classe, processo, titulo, estado: ehRascunho(principal.nome) ? 'rascunho' : 'em_vigor',
      ficheiro_principal: principal.rel, principal_abs: principal.full, formato: extP, mime: MIME[extP] || 'application/octet-stream',
      stored_principal: nomeStore(numero, titulo, extP),
      fonte_editavel: fonte ? fonte.rel : null, fonte_abs: fonte ? fonte.full : null, fonte_formato: fonte ? ext(fonte.full) : null,
      fonte_mime: fonte ? (MIME[ext(fonte.full)] || 'application/octet-stream') : null, stored_fonte: fonte ? nomeStore(numero, titulo + '-fonte', ext(fonte.full)) : null,
      pasta_origem: principal.dir,
    });
  }
  plano.sort((a, b) => a.numero.localeCompare(b.numero));
  const out = `C:/dirops/APP_DIROPS_v2/tools/ingest-ged/plano-${ICAO}.json`;
  fs.writeFileSync(out, JSON.stringify(plano, null, 2), 'utf8');
  console.log(`[${ICAO}] pasta destino: "${pasta.nome}" (${pasta.id})`);
  console.log(`Ficheiros: ${ficheiros.length} · Documentos: ${plano.length} · com fonte docx: ${plano.filter(p => p.stored_fonte).length} · rascunhos: ${plano.filter(p => p.estado === 'rascunho').length}`);
  for (const p of plano) console.log(`  ${p.numero}  [${p.formato}${p.stored_fonte ? '+docx' : ''}]${p.estado === 'rascunho' ? ' (RASCUNHO)' : ''}  ${p.titulo}`);
  console.log(`\nPlano em ${out} (pré-visualização; nada gravado).`);
})().catch(e => { console.error('ERRO', e.message); process.exit(1); });
