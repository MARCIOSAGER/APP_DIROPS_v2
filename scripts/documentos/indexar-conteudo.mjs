#!/usr/bin/env node
// ============================================================================
// Portal de Documentos — enche o índice de pesquisa DENTRO do conteúdo dos ficheiros (migração 151).
//
//   O que faz: para cada documento do GED, abre o ficheiro em `private-uploads`, extrai o texto PÁGINA A PÁGINA e
//   grava uma linha por página em `documento_pagina_texto`. É por página porque o `tsvector` do PostgreSQL não
//   passa de 1 MB (nem de 16.383 posições): um manual digitalizado num só tsvector truncaria em silêncio. Como
//   efeito lateral feliz, a pesquisa passa a poder dizer «encontrado na página 47».
//
//   Motores, por ordem de preferência (o mais exacto e mais barato primeiro):
//     • PDF com camada de texto  → pdfjs-dist (já é dependência do projecto), sem reconhecimento óptico;
//     • PDF digitalizado         → reconhecimento óptico, SE existir no servidor (ocrmypdf, ou pdftoppm+tesseract).
//                                  Se não existir, NÃO falha: marca `precisa_ocr` e entra na lista do fim;
//     • Word (.docx/.doc/.odt/.rtf/.pptx) → LibreOffice converte para PDF e depois é o caminho do PDF. Convertemos
//                                  para PDF em vez de para .txt de propósito: o .txt perde as páginas, e dizer
//                                  «página 12» errada é pior do que não dizer nada;
//     • Excel (.xlsx/.xls/.csv)  → pacote `xlsx` (já é dependência), um bloco por FOLHA, com o nome da folha no
//                                  rótulo; aqui a noção de página não existe e não se inventa.
//
//   Idempotente: guarda o SHA-256 do ficheiro e a versão do extractor em `documento_conteudo_indice`; numa segunda
//   passagem salta tudo o que não mudou. Pode correr por partes (--limite, --desde, --so, --ids).
//
//   PRÉ-REQUISITO: a migração 151 tem de estar aplicada (tabelas, configuração `portugues_sem_acentos`, função de
//   pesquisa). Sem ela, o script avisa e sai sem escrever nada. O `--dry` funciona sempre: lê ficheiros, não grava.
//
//   Exemplos:
//     node scripts/documentos/indexar-conteudo.mjs --dry                 # ensaio: mede tudo, não grava
//     node scripts/documentos/indexar-conteudo.mjs                       # indexa o que falta
//     node scripts/documentos/indexar-conteudo.mjs --so=pdf --limite=50  # aos pedaços
//     node scripts/documentos/indexar-conteudo.mjs --forcar --ids=<uuid> # reindexa um documento
//     node scripts/documentos/indexar-conteudo.mjs --listar-ocr          # só a lista dos digitalizados
// ============================================================================
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { pathToFileURL } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// ── configuração ────────────────────────────────────────────────────────────
const PGRST = process.env.PGRST_URL || 'http://127.0.0.1:3000';
const STORAGE_ROOT = process.env.STORAGE_ROOT || 'C:\\dirops\\sga-onpremise\\storage';
const PRIVADO = path.join(STORAGE_ROOT, 'private-uploads');
const CHAVE = process.env.SERVICE_ROLE_KEY_FILE || 'C:\\dirops\\sga-onpremise\\secrets\\service_role_key.txt';
const SOFFICE = [process.env.SOFFICE_PATH, 'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
  'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe'].filter(Boolean).find(p => fs.existsSync(p)) || '';

// Versão do extractor: subir este número obriga a reindexar tudo na próxima passagem (mudou a forma de extrair).
const VERSAO_EXTRACTOR = 1;

// Limite de cada bloco indexado, em bytes. A migração 151 tem um CHECK a 100.000; ficamos em 60.000 para que
// nenhuma página, por grande que seja, chegue perto do 1 MB do tsvector nem das 16.383 posições (acima disso o
// PostgreSQL descarta posições em silêncio e a pesquisa por frase passa a mentir).
const MAX_BYTES_BLOCO = 60000;

// Quando é que um PDF «não tem texto»: pouco texto no total, ou quase nada por página. Os ficheiros digitalizados
// dão tipicamente 0–5 caracteres por página (lixo de metadados); os que têm camada de texto dão centenas.
const MIN_CARACTERES_TOTAL = 80;
const MIN_CARACTERES_POR_PAGINA = 16;

const EXT_PDF = ['.pdf'];
const EXT_OFFICE = ['.docx', '.doc', '.odt', '.rtf', '.pptx', '.ppt', '.odp'];
const EXT_FOLHA = ['.xlsx', '.xls', '.xlsm', '.ods', '.csv'];

// ── argumentos ──────────────────────────────────────────────────────────────
const arg = (nome, omissao = null) => {
  const p = process.argv.find(a => a.startsWith(`--${nome}=`));
  return p ? p.slice(nome.length + 3) : omissao;
};
const tem = (nome) => process.argv.includes(`--${nome}`);
const DRY = tem('dry');
const FORCAR = tem('forcar') || tem('forçar');
const SO_LISTAR_OCR = tem('listar-ocr');
const COM_OCR = tem('ocr');
const LIMITE = Number(arg('limite', '0')) || 0;
const DESDE = Number(arg('desde', '0')) || 0;
const FILTRO_EXT = (arg('so', '') || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  .map(s => (s.startsWith('.') ? s : `.${s}`));
const FILTRO_IDS = (arg('ids', '') || '').split(',').map(s => s.trim()).filter(Boolean);

const log = (m) => console.log(`[indexar-conteudo] ${m}`);
const aviso = (m) => console.warn(`[indexar-conteudo] ${m}`);

// ── PostgREST ───────────────────────────────────────────────────────────────
if (!fs.existsSync(CHAVE)) { aviso(`não encontrei a chave de serviço em ${CHAVE}.`); process.exit(1); }
const SERVICE = fs.readFileSync(CHAVE, 'utf8').trim();
const HDR = { Authorization: `Bearer ${SERVICE}`, apikey: SERVICE, 'Content-Type': 'application/json' };

async function q(p, method = 'GET', body, prefer) {
  const r = await fetch(PGRST + p, {
    method,
    headers: { ...HDR, ...(prefer ? { Prefer: prefer } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${method} ${p.split('?')[0]} HTTP ${r.status} — ${(await r.text()).slice(0, 400)}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

// ── utilitários ─────────────────────────────────────────────────────────────
const execp = (file, args, opts = {}) => new Promise((resolve) => {
  execFile(file, args, { maxBuffer: 32 * 1024 * 1024, windowsHide: true, ...opts }, (err, stdout, stderr) => {
    resolve({ code: err ? (err.code || 1) : 0, stdout: String(stdout || ''), stderr: String(stderr || '') + (err && !stderr ? String(err.message) : '') });
  });
});
const rmrf = (p) => { try { fs.rmSync(p, { recursive: true, force: true }); } catch { /* o sistema limpa depois */ } };
const sha256 = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const existeNoCaminho = async (exe) => {
  const r = await execp(process.platform === 'win32' ? 'where' : 'which', [exe]);
  return r.code === 0 ? String(r.stdout).split(/\r?\n/)[0].trim() : '';
};

// Limpa o texto extraído. Tira os dois sentinelas do realce (⟦ ⟧) para que a função de pesquisa os possa usar como
// marcas sem ambiguidade, tira caracteres de controlo (que não pertencem a texto e estragam o JSON e o tsvector),
// junta espaços e desfaz o hífen invisível que os PDF deixam no fim das linhas.
const limpar = (s) => String(s ?? '')
  .replace(/[\u27E6\u27E7]/g, '')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
  .replace(/\u00AD/g, '')
  .replace(/\uFFFD/g, '')
  .replace(/[ \t\u00A0\u2000-\u200B]+/g, ' ')
  .replace(/ ?\n ?/g, '\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

// Parte um bloco grande em pedaços dentro do orçamento de bytes, cortando em mudança de linha ou espaço — nunca a
// meio de uma palavra, que daria lexemas inventados.
function partir(texto, maxBytes = MAX_BYTES_BLOCO) {
  if (Buffer.byteLength(texto, 'utf8') <= maxBytes) return [texto];
  const partes = [];
  let resto = texto;
  while (Buffer.byteLength(resto, 'utf8') > maxBytes) {
    // aproximação por caracteres e depois aperto, para não andar a medir byte a byte
    let corte = Math.floor(maxBytes / Math.max(1, Buffer.byteLength(resto, 'utf8') / resto.length));
    while (corte > 1 && Buffer.byteLength(resto.slice(0, corte), 'utf8') > maxBytes) corte = Math.floor(corte * 0.95);
    const janela = resto.slice(0, corte);
    const quebra = Math.max(janela.lastIndexOf('\n'), janela.lastIndexOf(' '));
    const fim = quebra > corte * 0.5 ? quebra : corte;
    partes.push(resto.slice(0, fim).trim());
    resto = resto.slice(fim).trim();
  }
  if (resto) partes.push(resto);
  return partes.filter(Boolean);
}

// ── pdfjs: texto página a página ────────────────────────────────────────────
let pdfjs = null;
async function carregarPdfjs() {
  if (pdfjs) return pdfjs;
  const base = require.resolve('pdfjs-dist/package.json').replace(/package\.json$/, '');
  pdfjs = await import(pathToFileURL(path.join(base, 'legacy', 'build', 'pdf.mjs')).href);
  return pdfjs;
}

async function paginasDoPdf(ficheiro) {
  const lib = await carregarPdfjs();
  const doc = await lib.getDocument({
    data: new Uint8Array(fs.readFileSync(ficheiro)),
    isEvalSupported: false,
    useSystemFonts: false,
    verbosity: 0,
  }).promise;
  const paginas = [];
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const p = await doc.getPage(i);
      const tc = await p.getTextContent();
      const bruto = tc.items.map(it => (it.str || '') + (it.hasEOL ? '\n' : '')).join('');
      p.cleanup();
      paginas.push({ pagina_fonte: i, texto: limpar(bruto) });
    }
  } finally {
    await doc.destroy().catch(() => {});
  }
  return paginas;
}

const temCamadaDeTexto = (paginas) => {
  const total = paginas.reduce((n, p) => n + p.texto.length, 0);
  return total >= MIN_CARACTERES_TOTAL && total / Math.max(1, paginas.length) >= MIN_CARACTERES_POR_PAGINA;
};

// ── LibreOffice: Office → PDF (para herdar as páginas reais) ─────────────────
const TMP = path.join(os.tmpdir(), 'gd-indexar');
fs.mkdirSync(TMP, { recursive: true });
const PERFIL_LO = path.join(TMP, 'lo-profile');

async function officeParaPdf(ficheiro) {
  if (!SOFFICE) throw new Error('o LibreOffice não está instalado no servidor (soffice.exe não encontrado)');
  const saida = fs.mkdtempSync(path.join(TMP, 'lo-'));
  // o soffice escolhe o filtro de importação pela extensão, por isso o nome temporário mantém-na
  const copia = path.join(saida, 'entrada' + path.extname(ficheiro).toLowerCase());
  fs.copyFileSync(ficheiro, copia);
  const r = await execp(SOFFICE, ['--headless', '--norestore', '--nologo',
    '-env:UserInstallation=file:///' + PERFIL_LO.replace(/\\/g, '/'),
    '--convert-to', 'pdf', '--outdir', saida, copia], { timeout: 10 * 60 * 1000 });
  const pdf = (fs.existsSync(saida) ? fs.readdirSync(saida) : []).find(f => f.toLowerCase().endsWith('.pdf'));
  if (!pdf) { rmrf(saida); throw new Error('a conversão em PDF falhou: ' + ((r.stderr || r.stdout) || 'sem saída do LibreOffice').slice(0, 240)); }
  return { pdf: path.join(saida, pdf), limpar: () => rmrf(saida) };
}

// ── folhas de cálculo: um bloco por folha ───────────────────────────────────
function blocosDaFolha(ficheiro) {
  const XLSX = require('xlsx');
  const wb = XLSX.readFile(ficheiro, { cellDates: true, cellFormula: false, cellHTML: false });
  const blocos = [];
  for (const nome of wb.SheetNames) {
    const folha = wb.Sheets[nome];
    if (!folha) continue;
    const texto = limpar(XLSX.utils.sheet_to_csv(folha, { FS: ' | ', blankrows: false }));
    if (!texto) continue;
    // o nome da folha vai também para o texto: quem procura «Janeiro» encontra a folha «Janeiro»
    blocos.push({ pagina_fonte: null, rotulo: `Folha «${nome}»`, texto: `${nome}\n${texto}` });
  }
  return blocos;
}

// ── reconhecimento óptico, só se existir no servidor ────────────────────────
let ocrDisponivel = null;
async function detectarOcr() {
  if (ocrDisponivel !== null) return ocrDisponivel;
  const ocrmypdf = await existeNoCaminho('ocrmypdf');
  if (ocrmypdf) { ocrDisponivel = { motor: 'ocrmypdf', ocrmypdf }; return ocrDisponivel; }
  const tesseract = (await existeNoCaminho('tesseract'))
    || ['C:\\Program Files\\Tesseract-OCR\\tesseract.exe', 'C:\\Program Files (x86)\\Tesseract-OCR\\tesseract.exe'].find(p => fs.existsSync(p)) || '';
  const pdftoppm = await existeNoCaminho('pdftoppm');
  if (tesseract && pdftoppm) { ocrDisponivel = { motor: 'tesseract', tesseract, pdftoppm }; return ocrDisponivel; }
  ocrDisponivel = null;
  return null;
}

// ocrmypdf: --sidecar escreve o texto reconhecido num ficheiro à parte (é o que a pesquisa de mercado recomenda).
// O texto do sidecar vem separado por \f (salto de página), o que nos devolve as páginas.
async function ocrComOcrmypdf(ferramentas, ficheiro) {
  const dir = fs.mkdtempSync(path.join(TMP, 'ocr-'));
  const saidaPdf = path.join(dir, 'saida.pdf');
  const sidecar = path.join(dir, 'texto.txt');
  const r = await execp(ferramentas.ocrmypdf, ['-l', 'por', '--sidecar', sidecar, '--skip-text', '--quiet', ficheiro, saidaPdf], { timeout: 30 * 60 * 1000 });
  if (!fs.existsSync(sidecar)) { rmrf(dir); throw new Error('ocrmypdf não produziu texto: ' + (r.stderr || r.stdout).slice(0, 240)); }
  const bruto = fs.readFileSync(sidecar, 'utf8');
  rmrf(dir);
  return bruto.split('\f').map((t, i) => ({ pagina_fonte: i + 1, texto: limpar(t) }));
}

// Alternativa sem ocrmypdf: pdftoppm desenha cada página em PNG, tesseract lê cada PNG. Mais lento, mesmo resultado.
async function ocrComTesseract(ferramentas, ficheiro, nPaginas) {
  const dir = fs.mkdtempSync(path.join(TMP, 'ocr-'));
  const paginas = [];
  try {
    for (let i = 1; i <= nPaginas; i++) {
      const base = path.join(dir, `p${i}`);
      const d = await execp(ferramentas.pdftoppm, ['-r', '300', '-f', String(i), '-l', String(i), '-png', '-singlefile', ficheiro, base], { timeout: 5 * 60 * 1000 });
      if (!fs.existsSync(base + '.png')) throw new Error(`pdftoppm falhou na página ${i}: ` + (d.stderr || '').slice(0, 160));
      const t = await execp(ferramentas.tesseract, [base + '.png', base, '-l', 'por', '--psm', '1'], { timeout: 10 * 60 * 1000 });
      if (!fs.existsSync(base + '.txt')) throw new Error(`tesseract falhou na página ${i}: ` + (t.stderr || '').slice(0, 160));
      paginas.push({ pagina_fonte: i, texto: limpar(fs.readFileSync(base + '.txt', 'utf8')) });
    }
  } finally { rmrf(dir); }
  return paginas;
}

// ── extracção, por documento ────────────────────────────────────────────────
// Devolve { estado, motor, paginas, blocos[], precisa_ocr, mensagem }.
async function extrair(ficheiro, ext) {
  if (EXT_FOLHA.includes(ext)) {
    const blocos = blocosDaFolha(ficheiro);
    if (!blocos.length) return { estado: 'sem_texto', motor: 'folha-calculo', paginas: 0, blocos: [], precisa_ocr: false, mensagem: 'folhas vazias' };
    return { estado: 'indexado', motor: 'folha-calculo', paginas: blocos.length, blocos, precisa_ocr: false };
  }

  let pdf = ficheiro;
  let motor = 'pdf-texto';
  let aLimpar = null;
  if (EXT_OFFICE.includes(ext)) {
    const c = await officeParaPdf(ficheiro);
    pdf = c.pdf; aLimpar = c.limpar; motor = 'libreoffice-pdf';
  } else if (!EXT_PDF.includes(ext)) {
    return { estado: 'nao_suportado', motor: null, paginas: 0, blocos: [], precisa_ocr: false, mensagem: `extensão ${ext || '(nenhuma)'} sem extractor` };
  }

  try {
    let paginas;
    try {
      paginas = await paginasDoPdf(pdf);
    } catch (e) {
      // PDF cifrado (é o caso do PSA e do PCA, que vêm com senha): não é um erro nosso, é um facto do ficheiro.
      // Fica como «não suportado» com a razão à vista, e deixa de ser tentado em cada passagem.
      if (/password|encrypt/i.test(String(e?.message || e)) || e?.name === 'PasswordException') {
        return {
          estado: 'nao_suportado', motor, paginas: 0, blocos: [], precisa_ocr: false,
          mensagem: 'PDF protegido por senha: o conteúdo não se pode extrair sem a senha',
        };
      }
      throw e;
    }
    const nPaginas = paginas.length;

    if (!temCamadaDeTexto(paginas)) {
      // digitalizado: o reconhecimento óptico é a única via. Se não estiver no servidor, não falha — fica na lista.
      const ferramentas = await detectarOcr();
      if (!ferramentas) {
        return {
          estado: 'sem_texto', motor, paginas: nPaginas, blocos: [], precisa_ocr: true,
          mensagem: 'PDF sem camada de texto; não há reconhecimento óptico instalado no servidor',
        };
      }
      if (!COM_OCR) {
        return {
          estado: 'sem_texto', motor, paginas: nPaginas, blocos: [], precisa_ocr: true,
          mensagem: `PDF sem camada de texto; há ${ferramentas.motor} instalado — correr de novo com --ocr`,
        };
      }
      paginas = ferramentas.motor === 'ocrmypdf'
        ? await ocrComOcrmypdf(ferramentas, pdf)
        : await ocrComTesseract(ferramentas, pdf, nPaginas);
      motor = 'pdf-ocr';
      if (!temCamadaDeTexto(paginas)) {
        return { estado: 'sem_texto', motor, paginas: nPaginas, blocos: [], precisa_ocr: true, mensagem: 'o reconhecimento óptico não devolveu texto útil' };
      }
    }

    const blocos = paginas
      .filter(p => p.texto)
      .map(p => ({ pagina_fonte: p.pagina_fonte, rotulo: `Página ${p.pagina_fonte}`, texto: p.texto }));
    if (!blocos.length) return { estado: 'sem_texto', motor, paginas: nPaginas, blocos: [], precisa_ocr: true, mensagem: 'nenhuma página com texto' };
    return { estado: 'indexado', motor, paginas: nPaginas, blocos, precisa_ocr: false };
  } finally {
    if (aLimpar) aLimpar();
  }
}

// Numera os blocos (1..n) e parte os que não cabem no orçamento de bytes, dizendo-o no rótulo.
function numerar(blocos) {
  const linhas = [];
  let n = 0;
  for (const b of blocos) {
    const pedacos = partir(b.texto);
    pedacos.forEach((texto, i) => {
      n += 1;
      linhas.push({
        pagina: n,
        pagina_fonte: b.pagina_fonte,
        rotulo: pedacos.length > 1 ? `${b.rotulo} (parte ${i + 1} de ${pedacos.length})` : b.rotulo,
        texto,
      });
    });
  }
  return linhas;
}

// ── gravação ────────────────────────────────────────────────────────────────
async function gravar(documentoId, linhas, resumo) {
  await q(`/documento_pagina_texto?documento_id=eq.${encodeURIComponent(documentoId)}`, 'DELETE', undefined, 'return=minimal');
  for (let i = 0; i < linhas.length; i += 40) {
    const lote = linhas.slice(i, i + 40).map(l => ({ documento_id: documentoId, ...l }));
    await q('/documento_pagina_texto', 'POST', lote, 'return=minimal');
  }
  await q('/documento_conteudo_indice?on_conflict=documento_id', 'POST', [{ documento_id: documentoId, ...resumo }],
    'resolution=merge-duplicates,return=minimal');
}

// ── pré-voo: a migração 151 está aplicada? ──────────────────────────────────
async function migracaoAplicada() {
  try { await q('/documento_pagina_texto?select=documento_id&limit=1'); return true; } catch { return false; }
}

// ── corrida ─────────────────────────────────────────────────────────────────
const aplicada = await migracaoAplicada();
if (!aplicada && !DRY) {
  aviso('a migração 151_pesquisa_conteudo.sql ainda não está aplicada (a tabela documento_pagina_texto não existe).');
  aviso('aplique-a primeiro e volte a correr. Entretanto, --dry mede tudo sem gravar nada.');
  process.exit(2);
}
if (!aplicada) aviso('a migração 151 ainda não está aplicada — ensaio apenas (nada seria gravado de qualquer forma).');

const docs = await q('/documento?select=id,titulo,numero,arquivo_privado_uri,arquivo_url,versao_atual'
  + '&voo_ligado_id=is.null&deleted_at=is.null&order=created_date.asc&limit=5000');
const indices = aplicada
  ? await q('/documento_conteudo_indice?select=documento_id,ficheiro_sha256,versao_extractor,estado&limit=5000')
  : [];
const porId = new Map(indices.map(i => [i.documento_id, i]));

let alvos = docs;
if (FILTRO_IDS.length) alvos = alvos.filter(d => FILTRO_IDS.includes(d.id));
if (FILTRO_EXT.length) alvos = alvos.filter(d => FILTRO_EXT.includes(path.extname(String(d.arquivo_privado_uri || '')).toLowerCase()));
if (DESDE) alvos = alvos.slice(DESDE);
if (LIMITE) alvos = alvos.slice(0, LIMITE);

const ocr = await detectarOcr();
log(`${docs.length} documentos no GED; ${alvos.length} nesta passagem.`);
log(`LibreOffice: ${SOFFICE || 'NÃO encontrado (Word e Excel antigos ficam de fora)'}`);
log(`reconhecimento óptico: ${ocr ? ocr.motor : 'NÃO instalado — os digitalizados ficam na lista do fim'}`);
if (DRY) log('ensaio (--dry): lê os ficheiros, não grava nada.');

const contas = { indexados: 0, saltados: 0, sem_texto: 0, sem_ficheiro: 0, nao_suportado: 0, erros: 0, paginas: 0, caracteres: 0 };
const paraOcr = [];
const falhados = [];

if (SO_LISTAR_OCR) {
  const lista = indices.filter(i => i.estado === 'sem_texto');
  const titulos = new Map(docs.map(d => [d.id, d]));
  log(`digitalizados à espera de reconhecimento óptico: ${lista.length}`);
  for (const i of lista) {
    const d = titulos.get(i.documento_id);
    console.log(`  • ${d ? (d.numero || '(sem número)') : i.documento_id} — ${d ? d.titulo : ''}`);
  }
  process.exit(0);
}

for (const [n, d] of alvos.entries()) {
  const uri = String(d.arquivo_privado_uri || '').trim();
  const prefixo = `(${n + 1}/${alvos.length}) ${d.numero || d.titulo || d.id}`;
  const ext = path.extname(uri).toLowerCase();
  const ficheiro = uri ? path.join(PRIVADO, ...uri.split(/[\\/]/)) : '';

  if (!uri || !fs.existsSync(ficheiro)) {
    contas.sem_ficheiro += 1;
    falhados.push({ d, motivo: uri ? 'ficheiro não está em private-uploads' : 'documento sem ficheiro' });
    log(`${prefixo} — SEM FICHEIRO (${uri || 'nenhum'})`);
    if (!DRY) await q('/documento_conteudo_indice?on_conflict=documento_id', 'POST', [{
      documento_id: d.id, estado: 'sem_ficheiro', versao_extractor: VERSAO_EXTRACTOR, ficheiro_nome: uri || null,
      mensagem: uri ? 'o ficheiro não está em private-uploads' : 'documento sem ficheiro carregado',
      indexado_em: new Date().toISOString(),
    }], 'resolution=merge-duplicates,return=minimal').catch(e => aviso(`${prefixo}: ${e.message}`));
    continue;
  }

  const stat = fs.statSync(ficheiro);
  const hash = sha256(ficheiro);
  const ja = porId.get(d.id);
  // idempotência: mesmo ficheiro, mesmo extractor, e um estado que não valha a pena repetir
  if (!FORCAR && ja && ja.ficheiro_sha256 === hash && ja.versao_extractor === VERSAO_EXTRACTOR
      && ['indexado', 'nao_suportado'].includes(ja.estado)) {
    contas.saltados += 1;
    continue;
  }
  // os «sem_texto» também se saltam, excepto quando desta vez trazemos reconhecimento óptico
  if (!FORCAR && ja && ja.ficheiro_sha256 === hash && ja.versao_extractor === VERSAO_EXTRACTOR
      && ja.estado === 'sem_texto' && !(COM_OCR && ocr)) {
    contas.saltados += 1;
    paraOcr.push({ d, mensagem: 'já marcado como digitalizado' });
    continue;
  }

  try {
    const r = await extrair(ficheiro, ext);
    const linhas = r.estado === 'indexado' ? numerar(r.blocos) : [];
    const caracteres = linhas.reduce((s, l) => s + l.texto.length, 0);
    const resumo = {
      estado: r.estado, motor: r.motor, versao_extractor: VERSAO_EXTRACTOR,
      ficheiro_nome: uri, ficheiro_bytes: stat.size, ficheiro_sha256: hash,
      paginas: r.paginas, paginas_indexadas: linhas.length, caracteres,
      precisa_ocr: !!r.precisa_ocr, mensagem: r.mensagem || null, indexado_em: new Date().toISOString(),
    };

    if (r.estado === 'indexado') {
      contas.indexados += 1; contas.paginas += linhas.length; contas.caracteres += caracteres;
      log(`${prefixo} — ${DRY ? '[ensaio] ' : ''}${linhas.length} págs, ${caracteres} car. (${r.motor})`);
    } else if (r.estado === 'sem_texto') {
      contas.sem_texto += 1;
      if (r.precisa_ocr) paraOcr.push({ d, mensagem: r.mensagem });
      log(`${prefixo} — SEM TEXTO: ${r.mensagem}`);
    } else {
      contas.nao_suportado += 1;
      falhados.push({ d, motivo: r.mensagem });
      log(`${prefixo} — ${r.estado}: ${r.mensagem}`);
    }

    if (!DRY) await gravar(d.id, linhas, resumo);
  } catch (e) {
    contas.erros += 1;
    falhados.push({ d, motivo: e.message });
    aviso(`${prefixo} — ERRO: ${e.message}`);
    if (!DRY) await q('/documento_conteudo_indice?on_conflict=documento_id', 'POST', [{
      documento_id: d.id, estado: 'erro', versao_extractor: VERSAO_EXTRACTOR, ficheiro_nome: uri,
      ficheiro_bytes: stat.size, ficheiro_sha256: hash, mensagem: String(e.message).slice(0, 500),
      indexado_em: new Date().toISOString(),
    }], 'resolution=merge-duplicates,return=minimal').catch(err => aviso(`${prefixo}: ${err.message}`));
  }
}

rmrf(PERFIL_LO);

// ── relatório ───────────────────────────────────────────────────────────────
console.log('');
log(`fim — indexados=${contas.indexados} saltados=${contas.saltados} sem texto=${contas.sem_texto} `
  + `sem ficheiro=${contas.sem_ficheiro} não suportados=${contas.nao_suportado} erros=${contas.erros}`);
log(`${contas.paginas} páginas gravadas, ${contas.caracteres.toLocaleString('pt-PT')} caracteres.`);

if (paraOcr.length) {
  console.log('');
  log(`PRECISAM DE RECONHECIMENTO ÓPTICO (${paraOcr.length}) — ficam marcados em documento_conteudo_indice.precisa_ocr`);
  log('e aparecem na vista documentos_conteudo_pendente. Nenhum destes falhou: só não tem texto para extrair.');
  for (const x of paraOcr) console.log(`  • ${x.d.numero || '(sem número)'} — ${x.d.titulo}`);
  if (!ocr) log('instale ocrmypdf (ou tesseract + poppler) com o idioma «por» e volte a correr com --ocr.');
}
if (falhados.length) {
  console.log('');
  log(`FICARAM DE FORA POR OUTRA RAZÃO (${falhados.length})`);
  for (const x of falhados) console.log(`  • ${x.d.numero || '(sem número)'} — ${x.d.titulo}: ${x.motivo}`);
}
