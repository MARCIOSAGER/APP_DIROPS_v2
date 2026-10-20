#!/usr/bin/env node
// ============================================================================
// Portal de Documentos — reconhecimento óptico (OCR) dos documentos DIGITALIZADOS, para entrarem na pesquisa
// dentro do conteúdo (migração 151).
//
//   PORQUE EXISTE: o `indexar-conteudo.mjs` lê a camada de texto dos PDF. Um PDF digitalizado não tem camada de
//   texto nenhuma — é uma fotografia de papel. Esse indexador não falha com eles: marca-os
//   `documento_conteudo_indice.precisa_ocr` e deixa-os na vista `documentos_conteudo_pendente`. Este guião é o
//   segundo passo: pega nessa lista, manda o OCRmyPDF ler as imagens, e grava o texto reconhecido em
//   `documento_pagina_texto`, uma linha por página, como todo o resto do índice.
//
//   O ORIGINAL NUNCA É TOCADO. É prova documental. O ficheiro é COPIADO para uma pasta temporária, o OCRmyPDF
//   corre sobre a cópia e escreve o PDF reconhecido também na pasta temporária (que é apagada no fim — só nos
//   interessa o texto). Por garantia, a impressão digital SHA-256 do original é medida antes e depois; se tiver
//   mudado, o guião recusa-se a gravar e grita.
//
//   `--force-ocr` de propósito: estes ficheiros estão classificados como SEM camada de texto, mas muitos trazem
//   uns poucos caracteres de lixo (marcas de digitalizador, metadados colados). Com `--skip-text`, o OCRmyPDF
//   saltaria essas páginas por elas «já terem texto» e ficariam de fora em silêncio. O `--force-ocr` rasteriza e
//   lê tudo: para uma página que é só imagem o resultado é o mesmo, e nenhuma página se perde por engano.
//
//   QUALIDADE ANTES DE QUANTIDADE: um índice de pesquisa com texto errado é pior do que não haver índice. Cada
//   documento passa por uma avaliação (caracteres por página, proporção de letras, proporção de palavras com
//   sentido). Se o texto sair a cheirar a ruído, NÃO é gravado: o documento fica como `sem_texto` com a razão
//   escrita, e aparece no relatório com a marca DUVIDOSA para ser visto por olho humano.
//
//   Idempotente: numa segunda passagem salta tudo o que já está indexado por OCR com a mesma impressão digital
//   do ficheiro. `--forcar` repete. `--dry` lê e mede tudo, e não grava uma linha.
//
//   PRÉ-REQUISITOS no servidor (já instalados em SRVKMS001, 2026-10-02):
//     • Python 3.12.10            C:\Program Files\Python312
//     • OCRmyPDF 17.13.0          C:\Program Files\Python312\Scripts\ocrmypdf.exe
//     • Tesseract 5.4.0 + «por»   C:\Program Files\Tesseract-OCR
//     • Ghostscript 10.08.0       C:\Program Files\gs\gs10.08.0\bin
//   Nenhum deles está no PATH da máquina, e não é preciso que esteja: o guião resolve os caminhos absolutos e
//   monta o PATH só para o processo filho. Assim corre igual à mão ou pelo Agendador de Tarefas.
//
//   Exemplos:
//     node scripts/documentos/ocr-indexar.mjs --dry            # ensaio: reconhece tudo, mostra, não grava
//     node scripts/documentos/ocr-indexar.mjs                  # reconhece e grava o que falta
//     node scripts/documentos/ocr-indexar.mjs --limite=3        # aos pedaços
//     node scripts/documentos/ocr-indexar.mjs --ids=<uuid> --forcar
//     node scripts/documentos/ocr-indexar.mjs --listar          # só a lista de candidatos, sem reconhecer nada
// ============================================================================
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';

// ── configuração ────────────────────────────────────────────────────────────
const PGRST = process.env.PGRST_URL || 'http://127.0.0.1:3000';
const STORAGE_ROOT = process.env.STORAGE_ROOT || 'C:\\dirops\\sga-onpremise\\storage';
const PRIVADO = path.join(STORAGE_ROOT, 'private-uploads');
const CHAVE = process.env.SERVICE_ROLE_KEY_FILE || 'C:\\dirops\\sga-onpremise\\secrets\\service_role_key.txt';

// Versão do extractor. É 1 de propósito, o mesmo número do `indexar-conteudo.mjs`: os dois escrevem na mesma
// tabela de estado e têm de se entender a saltar o trabalho já feito. Quem distingue os dois é a coluna `motor`
// ('pdf-texto' lá, 'pdf-ocr' aqui).
const VERSAO_EXTRACTOR = 1;
const MOTOR = 'pdf-ocr';

// Limite de cada bloco gravado, em bytes. A migração 151 tem um CHECK a 100.000 bytes; ficamos nos 60.000 para
// que nenhuma página chegue perto do 1 MB do tsvector nem das 16.383 posições (acima disso o PostgreSQL descarta
// posições em silêncio e a pesquisa por frase passa a mentir).
const MAX_BYTES_BLOCO = 60000;
const MAX_BYTES_CHECK = 100000; // o que a tabela aceita; serve de rede de segurança final

// Limiares de qualidade. Medidos no ensaio de 2026-10-02 sobre os acordos operacionais e as políticas do SGSO:
// uma página de texto digitalizada e bem lida dá 700–3.000 caracteres, >75% de letras e >80% de palavras com
// sentido. Ruído de reconhecimento falhado dá dezenas de caracteres e uma sopa de pontuação.
const MIN_CAR_POR_PAGINA = 120;
const MIN_FRAC_LETRAS = 0.55;
const MIN_FRAC_PALAVRAS = 0.50;
const MIN_CARACTERES_TOTAL = 200;

// ── argumentos ──────────────────────────────────────────────────────────────
const arg = (nome, omissao = null) => {
  const p = process.argv.find(a => a.startsWith(`--${nome}=`));
  return p ? p.slice(nome.length + 3) : omissao;
};
const tem = (nome) => process.argv.includes(`--${nome}`);
const DRY = tem('dry');
const FORCAR = tem('forcar') || tem('forçar');
const SO_LISTAR = tem('listar');
const LIMITE = Number(arg('limite', '0')) || 0;
const FILTRO_IDS = (arg('ids', '') || '').split(',').map(s => s.trim()).filter(Boolean);
const IDIOMA = arg('idioma', 'por');
// Quantos processos o OCRmyPDF pode usar. Por omissão 2, e não «todos»: este servidor já teve alarmes de
// vigilância por CPU saturado, e uma passagem de reconhecimento óptico a 100% de CPU durante uma hora é
// exactamente o género de coisa que os dispara.
const TRABALHOS = Math.max(1, Number(arg('trabalhos', '2')) || 2);
const TEMPO_LIMITE_MS = Math.max(1, Number(arg('minutos-por-doc', '45')) || 45) * 60 * 1000;

const log = (m) => console.log(`[ocr-indexar] ${m}`);
const aviso = (m) => console.warn(`[ocr-indexar] ${m}`);

// ── ferramentas externas: caminhos absolutos, PATH só para o processo filho ──
const primeiroQueExiste = (...candidatos) => candidatos.filter(Boolean).find(p => fs.existsSync(p)) || '';

const PYTHON = primeiroQueExiste(
  process.env.PYTHON_PATH,
  'C:\\Program Files\\Python312\\python.exe',
  'C:\\Python312\\python.exe',
);
const OCRMYPDF = primeiroQueExiste(
  process.env.OCRMYPDF_PATH,
  'C:\\Program Files\\Python312\\Scripts\\ocrmypdf.exe',
  'C:\\Python312\\Scripts\\ocrmypdf.exe',
);
const TESSERACT_DIR = primeiroQueExiste(
  process.env.TESSERACT_DIR,
  'C:\\Program Files\\Tesseract-OCR',
  'C:\\Program Files (x86)\\Tesseract-OCR',
);
const GS_DIR = (() => {
  if (process.env.GHOSTSCRIPT_DIR) return process.env.GHOSTSCRIPT_DIR;
  const raiz = 'C:\\Program Files\\gs';
  if (!fs.existsSync(raiz)) return '';
  // a última versão por ordem alfabética serve: só há uma instalada, e se houver duas a mais recente ganha
  const versoes = fs.readdirSync(raiz).filter(v => fs.existsSync(path.join(raiz, v, 'bin', 'gswin64c.exe'))).sort();
  return versoes.length ? path.join(raiz, versoes[versoes.length - 1], 'bin') : '';
})();

// O OCRmyPDF chama o tesseract e o ghostscript pelo PATH. Montamos um PATH para o filho em vez de mexer no PATH
// da máquina (que exigiria elevação e mudaria o ambiente de todos os serviços).
const ENV_FILHO = {
  ...process.env,
  PATH: [
    OCRMYPDF ? path.dirname(OCRMYPDF) : '',
    PYTHON ? path.dirname(PYTHON) : '',
    TESSERACT_DIR,
    GS_DIR,
    process.env.PATH || '',
  ].filter(Boolean).join(path.delimiter),
  // alguns builds do tesseract não encontram o tessdata sem isto
  ...(TESSERACT_DIR && !process.env.TESSDATA_PREFIX
    ? { TESSDATA_PREFIX: path.join(TESSERACT_DIR, 'tessdata') } : {}),
};

const execp = (file, args, opts = {}) => new Promise((resolve) => {
  execFile(file, args, {
    maxBuffer: 32 * 1024 * 1024, windowsHide: true, env: ENV_FILHO, ...opts,
  }, (err, stdout, stderr) => resolve({
    code: err ? (err.code ?? 1) : 0,
    matou: !!(err && err.killed),
    stdout: String(stdout || ''),
    stderr: String(stderr || '') + (err && !stderr ? String(err.message) : ''),
  }));
});

// Como se invoca o OCRmyPDF: o executável, se existir; senão o módulo pelo Python.
const comandoOcr = (args) => (OCRMYPDF ? [OCRMYPDF, args] : [PYTHON, ['-m', 'ocrmypdf', ...args]]);

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
const rmrf = (p) => { try { fs.rmSync(p, { recursive: true, force: true }); } catch { /* o sistema limpa depois */ } };
const sha256 = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const bytes = (s) => Buffer.byteLength(s, 'utf8');

// Limpa o texto reconhecido. É a MESMA limpeza do `indexar-conteudo.mjs`, de propósito: as duas metades do índice
// têm de ficar comparáveis. Tira os dois sentinelas do realce (⟦ ⟧) para a função de pesquisa os poder usar como
// marcas sem ambiguidade, tira caracteres de controlo, junta espaços e desfaz o hífen invisível.
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
  if (bytes(texto) <= maxBytes) return [texto];
  const partes = [];
  let resto = texto;
  while (bytes(resto) > maxBytes) {
    let corte = Math.floor(maxBytes / Math.max(1, bytes(resto) / resto.length));
    while (corte > 1 && bytes(resto.slice(0, corte)) > maxBytes) corte = Math.floor(corte * 0.95);
    const janela = resto.slice(0, corte);
    const quebra = Math.max(janela.lastIndexOf('\n'), janela.lastIndexOf(' '));
    const fim = quebra > corte * 0.5 ? quebra : corte;
    partes.push(resto.slice(0, fim).trim());
    resto = resto.slice(fim).trim();
  }
  if (resto) partes.push(resto);
  return partes.filter(Boolean);
}

// ── avaliação da qualidade ──────────────────────────────────────────────────
// Três medidas simples e honestas sobre o texto todo do documento:
//   fracLetras   — quanto do texto (sem espaços) são letras, incluindo as acentuadas. Ruído de OCR é pontuação.
//   fracPalavras — quantas das «palavras» têm cara de palavra (três ou mais letras seguidas).
//   carPorPagina — densidade. Uma página de contrato lida bem dá centenas de caracteres.
function avaliar(paginas) {
  const texto = paginas.map(p => p.texto).join('\n');
  const semEspacos = texto.replace(/\s+/g, '');
  const letras = (texto.match(/[\p{L}]/gu) || []).length;
  const palavras = texto.split(/[^\p{L}\p{N}ºª'’-]+/u).filter(Boolean);
  const comSentido = palavras.filter(p => /[\p{L}]{3,}/u.test(p)).length;
  const comTexto = paginas.filter(p => p.texto).length;
  return {
    caracteres: texto.length,
    paginasComTexto: comTexto,
    carPorPagina: comTexto ? Math.round(texto.length / comTexto) : 0,
    fracLetras: semEspacos.length ? letras / semEspacos.length : 0,
    fracPalavras: palavras.length ? comSentido / palavras.length : 0,
    palavras: palavras.length,
  };
}

function veredicto(m) {
  const razoes = [];
  if (m.caracteres < MIN_CARACTERES_TOTAL) razoes.push(`só ${m.caracteres} caracteres no documento todo`);
  if (m.carPorPagina < MIN_CAR_POR_PAGINA) razoes.push(`${m.carPorPagina} car./página (abaixo de ${MIN_CAR_POR_PAGINA})`);
  if (m.fracLetras < MIN_FRAC_LETRAS) razoes.push(`só ${(m.fracLetras * 100).toFixed(0)}% do texto são letras`);
  if (m.fracPalavras < MIN_FRAC_PALAVRAS) razoes.push(`só ${(m.fracPalavras * 100).toFixed(0)}% das palavras têm cara de palavra`);
  return { boa: razoes.length === 0, razoes };
}

// ── reconhecimento óptico de um ficheiro ────────────────────────────────────
const TMP = path.join(os.tmpdir(), 'gd-ocr');

// Devolve as páginas reconhecidas. Trabalha SEMPRE numa cópia: o original é prova documental e é aberto apenas
// para leitura (copyFileSync lê, não escreve), e a sua impressão digital é conferida à saída.
async function reconhecer(original) {
  const antes = sha256(original);
  fs.mkdirSync(TMP, { recursive: true });
  const dir = fs.mkdtempSync(path.join(TMP, 'doc-'));
  const copia = path.join(dir, 'entrada.pdf');
  const saidaPdf = path.join(dir, 'reconhecido.pdf'); // é descartado: só queremos o texto
  const sidecar = path.join(dir, 'texto.txt');
  try {
    fs.copyFileSync(original, copia);

    const [exe, args] = comandoOcr([
      '-l', IDIOMA,
      '--force-ocr',          // ver o cabeçalho: --skip-text saltaria páginas com lixo de digitalizador
      '--rotate-pages',       // páginas digitalizadas de lado passam a ser legíveis
      '--deskew',             // endireita o papel torto; melhora muito a leitura das linhas
      '--output-type', 'pdf', // não precisamos de PDF/A: o PDF de saída vai para o lixo
      '--optimize', '0',      // não vale optimizar imagens de um ficheiro que vamos apagar
      '--jobs', String(TRABALHOS),
      '--quiet',
      '--sidecar', sidecar,   // o texto reconhecido, páginas separadas por \f (salto de página)
      copia, saidaPdf,
    ]);
    const r = await execp(exe, args, { timeout: TEMPO_LIMITE_MS });

    if (!fs.existsSync(sidecar)) {
      if (r.matou) throw new Error(`o reconhecimento passou do tempo limite (${TEMPO_LIMITE_MS / 60000} min)`);
      throw new Error('o OCRmyPDF não produziu texto: ' + (r.stderr || r.stdout || `código ${r.code}`).trim().slice(0, 300));
    }

    const bruto = fs.readFileSync(sidecar, 'utf8');
    const paginas = bruto.split('\f').map((t, i) => ({ pagina_fonte: i + 1, texto: limpar(t) }));
    // o sidecar acaba muitas vezes com um \f final, que dá uma página vazia de fim de ficheiro
    while (paginas.length && !paginas[paginas.length - 1].texto) paginas.pop();

    const depois = sha256(original);
    if (antes !== depois) {
      throw new Error('ALARME: a impressão digital do ficheiro ORIGINAL mudou durante o reconhecimento — nada será gravado');
    }
    return { paginas, aviso: (r.stderr || '').trim().slice(0, 300) };
  } finally {
    rmrf(dir);
  }
}

// Numera os blocos (1..n) e parte os que não cabem no orçamento de bytes, dizendo-o no rótulo.
function numerar(paginas) {
  const linhas = [];
  let n = 0;
  for (const p of paginas) {
    if (!p.texto) continue;
    const pedacos = partir(p.texto);
    pedacos.forEach((texto, i) => {
      n += 1;
      linhas.push({
        pagina: n,
        pagina_fonte: p.pagina_fonte,
        rotulo: pedacos.length > 1 ? `Página ${p.pagina_fonte} (parte ${i + 1} de ${pedacos.length})` : `Página ${p.pagina_fonte}`,
        texto,
      });
    });
  }
  return linhas;
}

// ── gravação ────────────────────────────────────────────────────────────────
async function gravar(documentoId, linhas, resumo) {
  // rede de segurança final: nada passa o CHECK octet_length <= 100000 da migração 151
  const grande = linhas.find(l => bytes(l.texto) > MAX_BYTES_CHECK);
  if (grande) throw new Error(`bloco ${grande.pagina} com ${bytes(grande.texto)} bytes passa o limite da tabela`);

  // apagar antes de inserir mantém a operação repetível (a chave é documento_id + pagina)
  await q(`/documento_pagina_texto?documento_id=eq.${encodeURIComponent(documentoId)}`, 'DELETE', undefined, 'return=minimal');
  for (let i = 0; i < linhas.length; i += 40) {
    const lote = linhas.slice(i, i + 40).map(l => ({ documento_id: documentoId, ...l }));
    await q('/documento_pagina_texto', 'POST', lote, 'return=minimal');
  }
  await q('/documento_conteudo_indice?on_conflict=documento_id', 'POST', [{ documento_id: documentoId, ...resumo }],
    'resolution=merge-duplicates,return=minimal');
}

async function marcar(documentoId, resumo) {
  await q('/documento_conteudo_indice?on_conflict=documento_id', 'POST', [{ documento_id: documentoId, ...resumo }],
    'resolution=merge-duplicates,return=minimal');
}

// ── pré-voo ─────────────────────────────────────────────────────────────────
const faltam = [];
if (!OCRMYPDF && !PYTHON) faltam.push('OCRmyPDF (nem o executável nem o Python para o invocar)');
if (!TESSERACT_DIR) faltam.push('Tesseract');
if (!GS_DIR) faltam.push('Ghostscript');
if (faltam.length) {
  aviso(`falta no servidor: ${faltam.join(', ')}.`);
  aviso('instale (Python 3.12 + «pip install ocrmypdf» + Tesseract com o idioma «por» + Ghostscript) e volte a correr.');
  process.exit(1);
}
if (TESSERACT_DIR && !fs.existsSync(path.join(TESSERACT_DIR, 'tessdata', 'por.traineddata'))) {
  aviso(`o Tesseract está instalado mas falta o idioma português (por.traineddata) em ${path.join(TESSERACT_DIR, 'tessdata')}.`);
  aviso('sem ele o texto sai em inglês mal lido, com os acentos todos trocados — pior do que não ter índice.');
  process.exit(1);
}

let versaoOcr = '(desconhecida)';
{
  const [exe, args] = comandoOcr(['--version']);
  const v = await execp(exe, args, { timeout: 120000 });
  if (v.code !== 0) {
    aviso(`o OCRmyPDF não arrancou: ${(v.stderr || v.stdout || `código ${v.code}`).trim().slice(0, 300)}`);
    process.exit(1);
  }
  versaoOcr = v.stdout.trim().split(/\r?\n/)[0] || versaoOcr;
}

try { await q('/documento_pagina_texto?select=documento_id&limit=1'); } catch {
  aviso('a migração 151_pesquisa_conteudo.sql não está aplicada (não encontro a tabela documento_pagina_texto).');
  process.exit(2);
}

// ── candidatos ──────────────────────────────────────────────────────────────
// Quem decide que um documento é digitalizado é o `indexar-conteudo.mjs`: lê a camada de texto, não encontra
// nenhuma, e marca `precisa_ocr`. Aqui só pegamos nessa lista — não voltamos a adivinhar.
const indices = await q('/documento_conteudo_indice?select=documento_id,estado,motor,ficheiro_sha256,versao_extractor,paginas,precisa_ocr,mensagem&limit=5000');
const docs = await q('/documento?select=id,titulo,numero,arquivo_privado_uri&voo_ligado_id=is.null&deleted_at=is.null&limit=5000');
const porId = new Map(docs.map(d => [d.id, d]));
const indicePorId = new Map(indices.map(i => [i.documento_id, i]));

let alvos = indices
  .filter(i => porId.has(i.documento_id))                                  // documentos vivos e não de voo
  .filter(i => i.precisa_ocr === true || i.estado === 'sem_texto')          // os digitalizados
  .map(i => ({ ...porId.get(i.documento_id), indice: i }));

// `--ids` manda: serve para reconhecer um documento à mão, mesmo que não esteja marcado
if (FILTRO_IDS.length) {
  alvos = FILTRO_IDS.map(id => (porId.has(id)
    ? { ...porId.get(id), indice: indicePorId.get(id) || null }
    : (aviso(`--ids: ${id} não é um documento vivo do portal; ignorado`), null))).filter(Boolean);
}
alvos.sort((a, b) => (a.indice?.paginas || 0) - (b.indice?.paginas || 0)); // os pequenos primeiro: falha-se depressa
if (LIMITE) alvos = alvos.slice(0, LIMITE);

log(`OCRmyPDF ${versaoOcr} · Tesseract em ${TESSERACT_DIR} · Ghostscript em ${GS_DIR}`);
log(`idioma «${IDIOMA}» · ${TRABALHOS} processo(s) · limite de ${TEMPO_LIMITE_MS / 60000} min por documento`);
log(`${alvos.length} documento(s) digitalizado(s) nesta passagem (de ${indices.filter(i => i.precisa_ocr).length} marcados no portal).`);
if (DRY) log('ENSAIO (--dry): reconhece, mede e mostra. NÃO grava uma única linha na base de dados.');

if (SO_LISTAR) {
  for (const d of alvos) {
    console.log(`  • ${(d.numero || '(sem número)').padEnd(18)} ${String(d.indice?.paginas ?? '?').padStart(3)} págs  ${d.titulo}`);
  }
  process.exit(0);
}

// ── corrida ─────────────────────────────────────────────────────────────────
const contas = { indexados: 0, duvidosos: 0, saltados: 0, sem_ficheiro: 0, erros: 0, paginas: 0, caracteres: 0 };
const duvidosos = [];
const falhados = [];
const t0 = Date.now();

for (const [n, d] of alvos.entries()) {
  const prefixo = `(${n + 1}/${alvos.length}) ${d.numero || d.titulo || d.id}`;
  const uri = String(d.arquivo_privado_uri || '').trim();
  const ficheiro = uri ? path.join(PRIVADO, ...uri.split(/[\\/]/)) : '';

  if (!uri || !fs.existsSync(ficheiro)) {
    contas.sem_ficheiro += 1;
    falhados.push({ d, motivo: uri ? 'o ficheiro não está em private-uploads' : 'documento sem ficheiro' });
    log(`${prefixo} — SEM FICHEIRO (${uri || 'nenhum'})`);
    continue;
  }
  if (path.extname(uri).toLowerCase() !== '.pdf') {
    falhados.push({ d, motivo: `extensão ${path.extname(uri) || '(nenhuma)'}: o reconhecimento óptico só trata PDF` });
    log(`${prefixo} — NÃO É PDF (${path.extname(uri) || 'sem extensão'})`);
    continue;
  }

  const stat = fs.statSync(ficheiro);
  const hash = sha256(ficheiro);
  const ja = d.indice;
  // idempotência: já reconhecido por OCR, mesmo ficheiro, mesma versão do extractor → não se repete uma hora de CPU
  if (!FORCAR && ja && ja.estado === 'indexado' && ja.motor === MOTOR
      && ja.ficheiro_sha256 === hash && ja.versao_extractor === VERSAO_EXTRACTOR) {
    contas.saltados += 1;
    log(`${prefixo} — já reconhecido (salta; use --forcar para repetir)`);
    continue;
  }

  const ti = Date.now();
  try {
    const { paginas, aviso: avisoOcr } = await reconhecer(ficheiro);
    const m = avaliar(paginas);
    const v = veredicto(m);
    const linhas = numerar(paginas);
    const segundos = ((Date.now() - ti) / 1000).toFixed(0);
    const esperadas = ja?.paginas ?? null;

    const resumoBase = {
      versao_extractor: VERSAO_EXTRACTOR, motor: MOTOR,
      ficheiro_nome: uri, ficheiro_bytes: stat.size, ficheiro_sha256: hash,
      paginas: paginas.length, indexado_em: new Date().toISOString(),
    };

    if (!v.boa || !linhas.length) {
      // o texto não presta: NÃO entra no índice. Fica a razão escrita e a marca para olho humano.
      contas.duvidosos += 1;
      duvidosos.push({ d, m, razoes: v.razoes, amostra: (paginas.find(p => p.texto)?.texto || '').slice(0, 200) });
      aviso(`${prefixo} — DUVIDOSO em ${segundos}s: ${v.razoes.join('; ')} → NÃO indexado`);
      if (!DRY) {
        await marcar(d.id, {
          ...resumoBase, estado: 'sem_texto', paginas_indexadas: 0, caracteres: 0, precisa_ocr: true,
          mensagem: `reconhecimento óptico de qualidade duvidosa, não indexado: ${v.razoes.join('; ')}`.slice(0, 500),
        }).catch(e => aviso(`${prefixo}: ${e.message}`));
      }
      continue;
    }

    contas.indexados += 1;
    contas.paginas += linhas.length;
    contas.caracteres += m.caracteres;
    log(`${prefixo} — ${DRY ? '[ensaio] ' : ''}${paginas.length} págs reconhecidas, ${linhas.length} blocos, `
      + `${m.caracteres.toLocaleString('pt-PT')} car. (~${m.carPorPagina}/pág, ${(m.fracLetras * 100).toFixed(0)}% letras) em ${segundos}s`
      + (esperadas !== null && esperadas !== paginas.length ? `  ⚠ o portal contava ${esperadas} páginas` : ''));
    if (DRY) {
      const amostra = (paginas.find(p => p.texto)?.texto || '').replace(/\s+/g, ' ').slice(0, 150);
      console.log(`      «${amostra}…»`);
    }
    if (avisoOcr) console.log(`      (OCRmyPDF: ${avisoOcr.replace(/\s+/g, ' ').slice(0, 160)})`);

    if (!DRY) {
      await gravar(d.id, linhas, {
        ...resumoBase, estado: 'indexado', paginas_indexadas: linhas.length, caracteres: m.caracteres,
        precisa_ocr: false,
        mensagem: `texto obtido por reconhecimento óptico (${versaoOcr}, idioma ${IDIOMA}); `
          + `~${m.carPorPagina} car./página, ${(m.fracLetras * 100).toFixed(0)}% letras`,
      });
    }
  } catch (e) {
    contas.erros += 1;
    falhados.push({ d, motivo: e.message });
    aviso(`${prefixo} — ERRO: ${e.message}`);
    if (!DRY) {
      await marcar(d.id, {
        estado: 'erro', motor: MOTOR, versao_extractor: VERSAO_EXTRACTOR, ficheiro_nome: uri,
        ficheiro_bytes: stat.size, ficheiro_sha256: hash, precisa_ocr: true,
        mensagem: `reconhecimento óptico falhou: ${e.message}`.slice(0, 500),
        indexado_em: new Date().toISOString(),
      }).catch(err => aviso(`${prefixo}: ${err.message}`));
    }
  }
}

rmrf(TMP);

// ── relatório ───────────────────────────────────────────────────────────────
const minutos = ((Date.now() - t0) / 60000).toFixed(1);
console.log('');
log(`fim em ${minutos} min — ${DRY ? 'reconhecidos (ensaio)' : 'indexados'}=${contas.indexados} `
  + `duvidosos=${contas.duvidosos} saltados=${contas.saltados} sem ficheiro=${contas.sem_ficheiro} erros=${contas.erros}`);
log(`${contas.paginas} blocos de página, ${contas.caracteres.toLocaleString('pt-PT')} caracteres de texto português.`);
if (DRY) log('nada foi gravado. Corra sem --dry para encher o índice.');

if (duvidosos.length) {
  console.log('');
  log(`QUALIDADE DUVIDOSA — NÃO FORAM INDEXADOS (${duvidosos.length})`);
  log('um índice de pesquisa com texto errado é pior do que não haver índice; estes ficam para olho humano.');
  for (const x of duvidosos) {
    console.log(`  • ${x.d.numero || '(sem número)'} — ${x.d.titulo}`);
    console.log(`      ${x.razoes.join('; ')}`);
    if (x.amostra) console.log(`      saiu: «${x.amostra.replace(/\s+/g, ' ')}…»`);
  }
}
if (falhados.length) {
  console.log('');
  log(`FICARAM DE FORA (${falhados.length})`);
  for (const x of falhados) console.log(`  • ${x.d.numero || '(sem número)'} — ${x.d.titulo}: ${x.motivo}`);
}
