// Guia de Operação e Resolução de Problemas das Plataformas SGA (para a equipa de TI).
// Complementa o Caderno Técnico (o que existe) com o que fazer: falhas, correcções, recuperação e expansão.
// Gerar: node tools/caderno-tecnico/guia/gerar-guia.mjs  → Guia_Operacao_Plataformas_SGA.pdf (Chrome headless, 2 passagens)
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { conteudo, CAP, ANX, FALHAS, esc, tabela } from './conteudo.mjs';

const DIR = 'C:/dirops/APP_DIROPS_v2/tools/caderno-tecnico/guia/';
const HOJE = '21/10/2026';
const VERSAO = '1.0';
const TITULO = 'Guia de Operação e Resolução de Problemas';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PY = process.env.PYTHON || 'C:/Program Files/Python312/python.exe';
const logo = 'data:image/png;base64,' + fs.readFileSync('C:/dirops/APP_DIROPS_v2/public/logo-sga.png').toString('base64');

// mesmo estilo do Caderno Técnico (CSS lido do gerador do caderno, para os dois documentos não divergirem)
const gerCaderno = fs.readFileSync('C:/dirops/APP_DIROPS_v2/tools/caderno-tecnico/gerar.mjs', 'utf8');
const CSS = gerCaderno.slice(gerCaderno.indexOf('<style>') + 7, gerCaderno.indexOf('</style>'))
  .replace(/\$\{VERSAO\}/g, VERSAO).replace(/\$\{HOJE\}/g, HOJE)
  .replace('Caderno Técnico das Plataformas SGA', TITULO + ' — Plataformas SGA');

const GRAV = { alta: '<span class="prio-alta">Alta</span>', media: '<span class="prio-media">Média</span>', baixa: '<span class="prio-baixa">Baixa</span>' };

function montar(paginas) {
  const pg = (id) => (paginas[id] ? String(paginas[id]) : '');
  const linha = ([id, t], anexo) => `<li class="${anexo ? 'anx' : ''}"><span class="t">${esc(t)}</span><span class="pt"></span><span class="p">${pg(id)}</span></li>`;
  const indice = `<ul class="indice">${CAP.map(c => linha(c, false)).join('')}</ul><ul class="indice">${ANX.map(c => linha(c, true)).join('')}</ul>`;
  const resumo = tabela(['Ficha', 'Falha', 'Gravidade'], FALHAS.map(([id, t, g]) => [`<b>${id}</b>`, esc(t), GRAV[g]]), 'mini');
  const corpo = conteudo({ logo, HOJE, VERSAO })
    .replace('@@INDICE@@', indice).replace('@@RESUMO@@', resumo);
  return `<!doctype html><html lang="pt"><head><meta charset="utf-8"><title>${TITULO} — Plataformas SGA</title><style>${CSS}
.falha { margin-bottom: 5mm; border-top: 1px solid #cbd5e1; padding-top: 1mm; }
table.ficha td { border-bottom: 1px solid #e2e8f0; } table.ficha td.r { width: 32mm; color: #475569; font-weight: 600; background: #f8fafc !important; }
ol { margin: 1mm 0 3mm; padding-left: 5mm; }
</style></head><body>${corpo}</body></html>`;
}

const HTML = DIR + 'Guia_Operacao_Plataformas_SGA.html';
const PDF = DIR + 'Guia_Operacao_Plataformas_SGA.pdf';
const imprimir = (html) => {
  fs.writeFileSync(HTML, html, 'utf8');
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${PDF.replace(/\//g, '\\')}`, 'file:///' + HTML], { stdio: 'ignore', timeout: 180000 });
};
// páginas dos capítulos: o título exacto numa linha de cada página (PyMuPDF)
function paginasDosCapitulos() {
  const out = execFileSync(PY, ['-c', 'import pymupdf,json,sys\nd=pymupdf.open(sys.argv[1])\nsys.stdout.buffer.write(json.dumps([p.get_text() for p in d]).encode())', PDF], { encoding: 'utf8', maxBuffer: 64 * 1048576 });
  const paginas = JSON.parse(out);
  const mapa = {};
  for (const [id, titulo] of [...CAP, ...ANX]) {
    for (let i = 2; i < paginas.length; i++) if (paginas[i].split(/\r?\n/).some(l => l.trim() === titulo)) { mapa[id] = i + 1; break; }
  }
  return { mapa, total: paginas.length };
}
let mapa = {}, conf, voltas = 0;
do { imprimir(montar(mapa)); conf = paginasDosCapitulos(); const igual = JSON.stringify(conf.mapa) === JSON.stringify(mapa); mapa = conf.mapa; if (igual) break; } while (++voltas < 5);
const faltam = [...CAP, ...ANX].filter(([id]) => !conf.mapa[id]).map(([, t]) => t);
console.log('PDF:', PDF, fs.statSync(PDF).size, 'bytes,', conf.total, 'páginas,', voltas + 1, 'passagens', faltam.length ? '· sem página: ' + faltam.join(', ') : '· índice completo e estável', JSON.stringify(conf.mapa));
