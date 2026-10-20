#!/usr/bin/env node
// Plano de importação da pasta FNLU "Versao 15.03.2026" para o GED (pasta FNLU, aeroporto FNLU).
// Regras (decisões do dono 2026-10-06):
//   • pares docx+PDF do mesmo documento → PDF é a versão em vigor; o docx fica como versão "Fonte editável".
//   • o aeroporto do número é FORÇADO a FNLU (os ficheiros reutilizam códigos FNMO/FNCT/DREA que colidiriam).
//   • ficheiros "AGUARDANDO" entram como rascunho; as 3 "Listas Mestre" em ficheiro ficam de fora.
// Este script NÃO grava nada — só imprime o plano e escreve tools/ingest-fnlu/plano.json.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const RAIZ = 'C:/dirops/APP_DIROPS_v2/docs/FNLU/02-Versao 15.03.2026';
const MIME = { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', doc: 'application/msword', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', xls: 'application/vnd.ms-excel', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' };
const slug = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '').slice(0, 60);
const hash9 = () => crypto.randomBytes(5).toString('hex').slice(0, 9);
const nomeStore = (numero, titulo, extensao) => `${hash9()}_${numero}-${slug(titulo)}.${extensao}`;
const PGRST = 'http://127.0.0.1:3000';
const SVC = fs.readFileSync('C:/dirops/sga-onpremise/secrets/service_role_key.txt', 'utf8').trim();
const HDR = { apikey: SVC, Authorization: 'Bearer ' + SVC };
const FNLU = '7b031fd6-0388-5a61-a8d4-5250ff932a3f';

const RE_EXT = /\.(pdf|docx?|xlsx?|jpe?g|png)$/i;
const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
const ext = (f) => (f.match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase();

// manual (processo) a partir do nome da subpasta
function processoDaPasta(rel) {
  const u = rel.toUpperCase();
  if (u.includes('AP.03') || u.includes('PEA')) return 'PEA';
  if (u.includes('AP.04') || u.includes('PSCI')) return 'PSCI';
  if (u.includes('AP.05') || u.includes('PMAM')) return 'PMA';
  if (u.includes('AP.06') || u.includes('PGRF')) return 'PGRF';
  if (u.includes('AP.07') || u.includes('PBZPA')) return 'PBZPA';
  if (u.includes('AP.08') || u.includes('PRAFS')) return 'PRAFS';
  if (u.includes('AP.09') || u.includes('SMGCS')) return 'SMGCS';
  if (u.includes('AP.10') || u.includes('MSGSO') || u.includes('MGSO')) return 'MGSO';
  if (u.includes('AP.11') || u.includes('PFOA')) return 'PFOA';
  if (u.includes('AP.12') || u.includes('RST')) return 'RST';
  return 'MOA'; // 01-MOA, AN.05, AN.07, AP.02 (cartas e mapas), raiz
}
// classe a partir do nome do ficheiro quando não há código
function classeInferida(nome, proc) {
  const u = nome.toUpperCase();
  if (/\bCV[- ]/.test(u) || u.startsWith('CV')) return 'DO';
  if (u.includes('NOME')) return 'DO';
  if (u.includes('PROTOCOLO') || u.includes('ACORDO') || u.includes('CARTA DE ACORDO')) return 'DO';
  if (u.includes('MAPA') || u.includes('CARTA ADC') || u.includes('CARTA PDC') || u.includes('CARTA DE OBST')) return 'MP';
  if (u.includes('QUADRICULA') || u.includes('QUADRÍCULA')) return 'MQ';
  if (u.includes('LISTA')) return 'LT';
  if (u.includes('MANUAL')) return 'MA';
  if (u.includes('PLANO') || u.includes('PROGRAMA')) return 'PL';
  if (u.includes('FORM') || u.includes('FICHA') || u.includes('REGISTO')) return 'FR';
  return 'DO';
}
// extrai código do nome (força FNLU); devolve {classe, processo, seq} ou null
function codigoDoNome(nome) {
  let s = nome.replace(RE_EXT, '');
  // tira prefixo tipo "AP.13.001 #" / "AP.03.001#"
  s = s.replace(/^\s*(?:AN|AP)\s*\.?\s*\d{1,2}\s*\.?\s*\d{0,3}\s*#?\s*/i, '');
  // código colado tipo MA-FNLUMOA-001  →  MA-FNLU-MOA-001
  const colado = s.match(/\b([A-Z]{2,4})-([A-Z]{4})([A-Z]{2,8})-(\d{1,3})\b/);
  if (colado) return { classe: colado[1].toUpperCase(), processo: colado[3].toUpperCase(), seq: +colado[4] };
  // código completo CLASSE-ICAO-PROCESSO-SEQ
  const full = s.match(/\b([A-Z]{2,4})-([A-Z0-9]{3,5})-([A-Z]{2,8})-(\d{1,3})\b/);
  if (full) return { classe: full[1].toUpperCase(), processo: full[3].toUpperCase(), seq: +full[4] };
  return null;
}
// título limpo: tira prefixo AP/AN, código, rev, extensão
function tituloLimpo(nome) {
  let t = nome.replace(RE_EXT, '');
  t = t.replace(/^\s*(?:AN|AP)\s*\.?\s*\d{1,2}\s*\.?\s*\d{0,3}\s*#?\s*/i, '');
  t = t.replace(/\b[A-Z]{2,4}-[A-Z0-9]{3,8}-?[A-Z0-9]{0,8}-?\d{0,3}\b/g, ' '); // qualquer código
  t = t.replace(/\b(rev\.?\s*\d+|vers[aã]o\s*[\d.]+|rev\.?\s*vers[aã]o[\d. ]*)/gi, ' ');
  t = t.replace(/[._#-]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  t = t.replace(/^\d{1,2}(\s+\d{1,3})*\s+/, '').trim(); // tira prefixo de ordenação "4 6 ", "2 1 ", "3 3 "
  return t || nome.replace(RE_EXT, '');
}

const PULAR = [ // Listas Mestre em ficheiro (a plataforma gera a sua) + revisão antiga do MOA (2022; fica a Rev.03)
  'LT-FNMO-MOA-001 - Lista Mestre de Documentos MOA rev.00',
  'LT-OPS-001 - Lista Mestra de Documentos MOA',
  'LT-SGA-0000-003 - Lista Mestre de Documentos SGA',
  'MOA Rev02_05.12.2022',
];

// recolher ficheiros
function walk(dir, rel = '') {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) out = out.concat(walk(full, r));
    else if (RE_EXT.test(e.name)) out.push({ full, rel: r, dir: rel, nome: e.name });
  }
  return out;
}

const ficheiros = walk(RAIZ).filter(f => !PULAR.some(p => f.nome.startsWith(p.slice(0, 25))));
// agrupar por (pasta + base sem extensão) → junta docx+pdf
const grupos = new Map();
for (const f of ficheiros) {
  const base = norm(f.nome.replace(RE_EXT, ''));
  const chave = f.dir + '||' + base;
  if (!grupos.has(chave)) grupos.set(chave, []);
  grupos.get(chave).push(f);
}

// atribuir seq livres por classe-processo (FNLU está vazio, só evitar colisão no lote)
const usados = new Set();
function seqLivre(classe, proc, pref) {
  if (pref) { const k = `${classe}|${proc}|${pref}`; if (!usados.has(k)) { usados.add(k); return pref; } }
  let n = 1; while (usados.has(`${classe}|${proc}|${n}`)) n++; usados.add(`${classe}|${proc}|${n}`); return n;
}

const plano = [];
for (const [, fs_] of grupos) {
  const pdf = fs_.find(x => ext(x.full) === 'pdf');
  const docx = fs_.find(x => /^docx?$/.test(ext(x.full)));
  const xlsx = fs_.find(x => /^xlsx?$/.test(ext(x.full)));
  const outro = fs_.find(x => ['jpg', 'jpeg', 'png'].includes(ext(x.full)));
  const principal = pdf || xlsx || docx || outro || fs_[0];
  const fonte = (pdf && docx) ? docx : null; // docx como versão quando há PDF
  const proc = processoDaPasta(principal.dir);
  const cod = codigoDoNome(principal.nome);
  const classe = cod?.classe || classeInferida(principal.nome, proc);
  const processo = cod?.processo || proc;
  const seq = seqLivre(classe, processo, cod?.seq);
  const numero = `${classe}-FNLU-${processo}-${String(seq).padStart(3, '0')}`;
  const rascunho = /AGUARDAND/i.test(principal.nome);
  const titulo = tituloLimpo(principal.nome);
  const extP = ext(principal.full);
  const storedP = nomeStore(numero, titulo, extP);
  const storedF = fonte ? nomeStore(numero, titulo + '-fonte', ext(fonte.full)) : null;
  plano.push({
    numero, classe, processo, titulo,
    estado: rascunho ? 'rascunho' : 'em_vigor',
    ficheiro_principal: principal.rel, principal_abs: principal.full.replace(/\\/g, '/'),
    formato: extP, mime: MIME[extP] || 'application/octet-stream',
    stored_principal: storedP,
    fonte_editavel: fonte ? fonte.rel : null, fonte_abs: fonte ? fonte.full.replace(/\\/g, '/') : null,
    fonte_formato: fonte ? ext(fonte.full) : null, fonte_mime: fonte ? (MIME[ext(fonte.full)] || 'application/octet-stream') : null,
    stored_fonte: storedF,
    pasta_origem: principal.dir,
  });
}
plano.sort((a, b) => a.numero.localeCompare(b.numero));

fs.writeFileSync('C:/dirops/APP_DIROPS_v2/tools/ingest-fnlu/plano.json', JSON.stringify(plano, null, 2), 'utf8');
console.log(`Ficheiros: ${ficheiros.length} · Documentos a inserir: ${plano.length} · com fonte .docx anexa: ${plano.filter(p => p.fonte_editavel).length} · rascunhos: ${plano.filter(p => p.estado === 'rascunho').length}\n`);
for (const p of plano) console.log(`  ${p.numero}  [${p.formato}${p.fonte_editavel ? '+docx' : ''}]${p.estado === 'rascunho' ? ' (RASCUNHO)' : ''}  ${p.titulo}`);
console.log(`\nPlano escrito em tools/ingest-fnlu/plano.json (pré-visualização; nada gravado).`);
