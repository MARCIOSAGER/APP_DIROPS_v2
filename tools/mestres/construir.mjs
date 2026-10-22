// Constrói os mestres (contrato do editor estruturado) a partir das fontes em texto (tools/mestres/fontes/*.md).
// Uso: node tools/mestres/construir.mjs   → escreve tools/mestres/mestre-<chave>.json e valida-os (modo estrito).
//
// Formato das fontes:
//   <<<META ... META>>>   bloco JSON com { chave, modelo, titulo, revisao, data, alvos, diferencas, valoresLocais, ... }
//   # chave: Título        começa uma secção (chave do modelo; chave desconhecida = secção extra, não obrigatória)
//   ## / ### / ####        títulos de nível 2-4
//   - item / 1. item / a) item   listas (2 espaços de indentação por nível; linhas indentadas seguintes continuam o item)
//   > nota|atencao|aviso: texto   caixa de destaque (linhas «> » seguintes = parágrafos da mesma caixa)
//   Tabela: legenda        (opcional) antes de uma tabela «| a | b |» — a 1.ª linha é o cabeçalho; «<br>» = quebra
//   ---pagina              quebra de página
//   **negrito**, *itálico*; [justify]/[center]/[right] no início de um parágrafo = alinhamento
//
// Imagens (ficheiros em tools/mestres/imagens/<chave>/…, FORA do Git; extraídas por extrair-imagens.py):
//   ![legenda](imagem.<nome>){60%}   imagem PRÓPRIA de cada aeroporto: src = '{{imagem.<nome>}}' no mestre e o ficheiro
//                                    imagens/<chave>/<ICAO>/<nome>.jpg vai para extras.imagensLocais[ICAO][nome]
//                                    (data URL). Ao gerar, aeroporto sem esse ficheiro = imagem (e legenda) fora.
//   ![legenda](comum.<nome>){60%}    imagem igual para todos: imagens/<chave>/comum/<nome>.jpg embutida no mestre.
//   A legenda (pode ter {{campos}}) é opcional («![](…)» = sem legenda, sem número de figura); {largura} é opcional
//   (25%…100% ou px). Uma linha só com a imagem = bloco image.
//   Fotos: 2                         galeria «Fotos lado a lado» (2 ou 3 por linha; omisso = até 3): as linhas «![…](…)»
//                                    seguintes (até uma linha em branco) são as fotos, uma por célula.
//   Numa tabela, uma célula «![](comum.x)» leva a imagem em vez de texto.
//   Tabela: legenda [larguras 230/260/150]   larguras das colunas (px do editor; proporções no PDF/Word).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));

function inline(txt) {
  const out = [];
  const re = /(\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*)/g;
  let i = 0;
  let m;
  const push = (t, marks) => { if (t) out.push(marks ? { type: 'text', text: t, marks } : { type: 'text', text: t }); };
  const comBr = (t, marks) => t.split('<br>').forEach((p, k) => { if (k) out.push({ type: 'hardBreak' }); push(p, marks); });
  while ((m = re.exec(txt))) {
    comBr(txt.slice(i, m.index));
    if (m[2]) comBr(m[2], [{ type: 'bold' }]); else comBr(m[3], [{ type: 'italic' }]);
    i = m.index + m[0].length;
  }
  comBr(txt.slice(i));
  return out;
}

function para(t, attrs) {
  const c = inline(t.trim());
  const p = { type: 'paragraph' };
  if (attrs) p.attrs = attrs;
  if (c.length) p.content = c;
  return p;
}

const RE_ITEM = /^( *)(-|\d+[.)]|[a-z]\))\s+(.*)$/;
const RE_ESPECIAL = /^(#{2,4}\s|>|\||Tabela:|---pagina|Fotos:|!\[)/;
const RE_IMAGEM = /^!\[([^\]]*)\]\((imagem|comum)\.([\w-]+)\)(?:\{([^}]+)\})?\s*$/;

/** Contexto da construção de um mestre (pasta das imagens e o que se usou). */
let CTX = { dirImagens: null, usadasLocais: new Set(), usadasComuns: new Set() };

const dataUrl = (ficheiro) => `data:image/${/\.png$/i.test(ficheiro) ? 'png' : 'jpeg'};base64,${fs.readFileSync(ficheiro).toString('base64')}`;
function ficheiroImagem(pasta, nome) {
  for (const ext of ['.jpg', '.jpeg', '.png']) { const p = path.join(pasta, nome + ext); if (fs.existsSync(p)) return p; }
  return null;
}

function noImagem(linha) {
  const m = RE_IMAGEM.exec(linha.trim());
  if (!m) throw new Error(`imagem mal escrita: «${linha}»`);
  const [, legenda, tipo, nome, largura] = m;
  let src;
  if (tipo === 'imagem') { src = `{{imagem.${nome}}}`; CTX.usadasLocais.add(nome); }
  else {
    const fic = CTX.dirImagens && ficheiroImagem(path.join(CTX.dirImagens, 'comum'), nome);
    if (!fic) throw new Error(`falta a imagem comum ${nome} (imagens/<chave>/comum/${nome}.jpg)`);
    src = dataUrl(fic);
    CTX.usadasComuns.add(nome);
  }
  const attrs = { src };
  if (largura) attrs.width = largura.trim();
  if (legenda.trim()) attrs.legenda = legenda.trim();
  return { type: 'image', attrs };
}

const conteudoCelula = (c) => (RE_IMAGEM.test(c.trim()) ? [noImagem(c)] : [para(c)]);

function montarLista(itens, nivel, pos) {
  const listas = [];
  let atual = null;
  while (pos.i < itens.length) {
    const it = itens[pos.i];
    if (it.ind < nivel) break;
    if (it.ind > nivel) {
      const sub = montarLista(itens, it.ind, pos);
      if (!atual) throw new Error(`lista começa indentada: ${it.texto}`);
      atual.content[atual.content.length - 1].content.push(...sub);
      continue;
    }
    if (!atual || atual.type !== it.tipo) {
      atual = { type: it.tipo, content: [] };
      if (it.tipo === 'orderedList' && it.num && it.num !== 1) atual.attrs = { start: it.num };
      listas.push(atual);
    }
    atual.content.push({ type: 'listItem', content: [para(it.texto)] });
    pos.i++;
  }
  return listas;
}

function parseBlocos(linhas) {
  const blocos = [];
  let i = 0;
  while (i < linhas.length) {
    const l = linhas[i];
    if (!l.trim()) { i++; continue; }
    let m;
    if ((m = /^(#{2,4})\s+(.*)$/.exec(l))) { blocos.push({ type: 'heading', attrs: { level: m[1].length }, content: inline(m[2].trim()) }); i++; continue; }
    if (l.trim() === '---pagina') { blocos.push({ type: 'pageBreak' }); i++; continue; }
    if ((m = /^>\s*(nota|atencao|aviso):\s*(.*)$/.exec(l))) {
      const ps = [m[2]];
      i++;
      while (i < linhas.length && /^>/.test(linhas[i])) { const t = linhas[i].replace(/^>\s?/, ''); if (t.trim()) ps.push(t); i++; }
      blocos.push({ type: 'blockquote', attrs: { tipo: m[1] }, content: ps.map(p => para(p)) });
      continue;
    }
    if (/^!\[/.test(l)) { blocos.push(noImagem(l)); i++; continue; }
    if ((m = /^Fotos:\s*(\d)?\s*$/.exec(l))) {
      i++;
      const fotos = [];
      while (i < linhas.length && /^!\[/.test(linhas[i])) { fotos.push(noImagem(linhas[i])); i++; }
      const cols = Number(m[1]) || Math.min(3, fotos.length);
      const rows = [];
      for (let k = 0; k < fotos.length; k += cols) {
        const cels = fotos.slice(k, k + cols).map(f => ({ type: 'tableCell', content: [f, { type: 'paragraph' }] }));
        while (cels.length < cols) cels.push({ type: 'tableCell', content: [{ type: 'paragraph' }] });
        rows.push({ type: 'tableRow', content: cels });
      }
      blocos.push({ type: 'table', attrs: { estilo: 'fotos' }, content: rows });
      continue;
    }
    if (/^Tabela:/.test(l) || /^\|/.test(l)) {
      let legenda = null;
      let larguras = null;
      if (/^Tabela:/.test(l)) {
        legenda = l.replace(/^Tabela:\s*/, '').trim();
        const ml = /\s*\[larguras ([\d/]+)\]$/.exec(legenda);
        if (ml) { larguras = ml[1].split('/').map(Number); legenda = legenda.slice(0, ml.index).trim(); }
        i++;
      }
      const rows = [];
      while (i < linhas.length && /^\|/.test(linhas[i])) {
        rows.push(linhas[i].trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim()));
        i++;
      }
      const t = { type: 'table', content: rows.map((r, k) => ({ type: 'tableRow', content: r.map((c, ci) => ({ type: k === 0 ? 'tableHeader' : 'tableCell', ...(larguras?.[ci] ? { attrs: { colwidth: [larguras[ci]] } } : {}), content: k === 0 ? [para(c)] : conteudoCelula(c) })) })) };
      if (legenda) t.attrs = { legenda };
      blocos.push(t);
      continue;
    }
    if (RE_ITEM.test(l)) {
      const itens = [];
      while (i < linhas.length && linhas[i].trim() && (RE_ITEM.test(linhas[i]) || /^ {2,}\S/.test(linhas[i]))) {
        const mm = RE_ITEM.exec(linhas[i]);
        if (mm) itens.push({ ind: Math.floor(mm[1].length / 2), tipo: mm[2] === '-' ? 'bulletList' : 'orderedList', num: /^\d+/.test(mm[2]) ? parseInt(mm[2], 10) : null, texto: mm[3] });
        else itens[itens.length - 1].texto += ' ' + linhas[i].trim();
        i++;
      }
      blocos.push(...montarLista(itens, 0, { i: 0 }));
      continue;
    }
    let t = l;
    i++;
    while (i < linhas.length && linhas[i].trim() && !RE_ITEM.test(linhas[i]) && !RE_ESPECIAL.test(linhas[i])) { t += ' ' + linhas[i].trim(); i++; }
    let attrs;
    const ma = /^\[(center|right|justify)\]\s*(.*)$/.exec(t);
    if (ma) { attrs = { textAlign: ma[1] }; t = ma[2]; }
    blocos.push(para(t, attrs));
  }
  return blocos;
}

/**
 * @param {string} fonte
 * @param {Object[]} modelos
 * @param {{ dirImagens?: string }} [opcoes]  pasta imagens/<chave> (omissa = tools/mestres/imagens/<chave>)
 * O resultado traz __imagens { locais, comuns, faltam } (informação; o script tira-o antes de gravar).
 */
export function construir(fonte, modelos, opcoes = {}) {
  const meta = JSON.parse(/<<<META([\s\S]*?)META>>>/.exec(fonte)[1]);
  CTX = { dirImagens: opcoes.dirImagens || path.join(AQUI, 'imagens', meta.chave), usadasLocais: new Set(), usadasComuns: new Set() };
  const corpo = fonte.replace(/<<<META[\s\S]*?META>>>/, '').replace(/\r/g, '');
  const partes = corpo.split(/^# /m).slice(1);
  const modelo = modelos.find(m => m.classe_codigo === meta.modelo);
  const doModelo = new Map((modelo?.schema?.seccoes || []).filter(s => !s.automatica).map(s => [s.chave, s]));
  const seccoes = partes.map((p, k) => {
    const [cab, ...resto] = p.split('\n');
    const mm = /^([a-z_]+):\s*(.*)$/.exec(cab.trim());
    if (!mm) throw new Error(`${meta.chave}: cabeçalho de secção inválido «${cab}»`);
    const chave = mm[1];
    const sm = doModelo.get(chave);
    return { id: `s${k + 1}-${chave}`, chave, titulo: (mm[2] || sm?.titulo || chave).trim(), obrigatoria: !!sm?.obrigatoria, conteudo: { type: 'doc', content: parseBlocos(resto) } };
  });
  for (const [chave, sm] of doModelo) if (sm.obrigatoria && !seccoes.some(s => s.chave === chave)) throw new Error(`${meta.chave}: falta a secção obrigatória ${chave}`);
  const { titulo, modelo: mod, revisao, data, classificacao, ...extras } = meta;
  // imagens próprias de cada aeroporto-alvo (só as usadas no texto)
  const faltam = [];
  if (CTX.usadasLocais.size) {
    const imagensLocais = {};
    for (const a of meta.alvos || []) {
      const porAero = {};
      for (const nome of CTX.usadasLocais) {
        const fic = ficheiroImagem(path.join(CTX.dirImagens, a.icao), nome);
        if (fic) porAero[nome] = dataUrl(fic); else faltam.push(`${a.icao}:${nome}`);
      }
      imagensLocais[a.icao] = porAero;
    }
    extras.imagensLocais = imagensLocais;
  }
  return {
    schema: 1,
    modelo: mod,
    cabecalho: {
      numero: '{{documento.numero}}', titulo, revisao, data,
      aeroporto: '{{aeroporto.icao}}', aeroportoNome: '{{aeroporto.nome}}',
      elaboradoPor: 'Marcio Sager', verificadoPor: 'Cesar Manuel Pascoal', aprovadoPor: '{{aeroporto.director}}',
      classificacao: classificacao || 'Uso interno',
    },
    seccoes,
    historico: [],
    __imagens: { locais: [...CTX.usadasLocais], comuns: [...CTX.usadasComuns], faltam },
    extras: {
      mestre: true,
      elaboradoEmail: 'oaeroportos@sga.co.ao', verificadoEmail: 'cpascoal@sga.co.ao', aprovadoEmail: '',
      ...extras,
    },
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const { MODELOS_PADRAO } = await import('../../src/documentos/edicao/modelosPadrao.js');
  const { validarDocumentoEstruturado } = await import('../../src/documentos/edicao/contrato.js');
  const dir = path.join(AQUI, 'fontes');
  let erro = false;
  for (const f of fs.readdirSync(dir).filter(n => n.endsWith('.md')).sort()) {
    const { __imagens: im, ...doc } = construir(fs.readFileSync(path.join(dir, f), 'utf8'), MODELOS_PADRAO);
    const v = validarDocumentoEstruturado(doc, { estrito: true });
    const destino = path.join(AQUI, `mestre-${doc.extras.chave}.json`);
    const json = JSON.stringify(doc, null, 1) + '\n';
    fs.writeFileSync(destino, json);
    const kb = (n) => `${Math.round(n / 1024)} KB`;
    const tamLocais = JSON.stringify(doc.extras.imagensLocais || {}).length;
    console.log(`${v.valido ? 'OK  ' : 'ERRO'} ${path.basename(destino)}  ${kb(Buffer.byteLength(json))}  secções=${doc.seccoes.length}${v.erros.length ? '  ' + v.erros.join('; ') : ''}${v.avisos.length ? '  avisos: ' + v.avisos.join('; ') : ''}`);
    if (im.locais.length || im.comuns.length) console.log(`     imagens: ${im.comuns.length} comuns, ${im.locais.length} locais (${im.locais.join(', ')}; ${kb(tamLocais)} em extras.imagensLocais)${im.faltam.length ? '  sem imagem: ' + im.faltam.join(', ') : ''}`);
    if (!v.valido) erro = true;
  }
  if (erro) process.exit(1);
}
