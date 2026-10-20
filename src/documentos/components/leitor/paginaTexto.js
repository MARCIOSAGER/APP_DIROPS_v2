// Pesquisa DENTRO do documento aberto, e as peças de texto que ela precisa.
//
// Procura-se no índice `documento_pagina_texto` (migração 151) e não no PDF carregado no navegador. Porquê:
// o índice está numa coluna `tsvector` com índice GIN, o servidor responde num salto e devolve logo a PÁGINA —
// enquanto varrer o PDF à mão obriga a extrair o texto das 160 páginas no browser, o que num portátil de serviço
// leva segundos e aquece o ventilador. O `documento_pagina_texto` é também o que a pesquisa global já usa, pelo
// que a mesma palavra dá o mesmo resultado nos dois sítios — se divergissem, a pessoa deixava de acreditar em
// nenhum dos dois.
//
// Sem rede, a mesma pesquisa corre sobre o índice guardado ao lado da cópia offline. O resultado diz sempre de
// onde veio (`fonte`), porque «não encontrei» tem significados diferentes conforme a origem.
//
// Nada aqui produz HTML: os excertos saem em pedaços de texto marcados (`{ texto, achado }`) e o ecrã desenha o
// realce como elemento React. É a mesma regra da pesquisa global — com a razão explicada lá: o `ts_headline` do
// PostgreSQL não escapa o texto em volta.
import { supabase } from '@/lib/supabaseClient';
import { obterPaginasOffline } from '@/lib/documentosOffline';

// A configuração de pesquisa criada pela migração 151 (português com os acentos removidos antes do stemmer).
const CONFIG_FTS = 'portugues_sem_acentos';
// Quantas páginas se listam, e para quantas delas se traz o texto. São dois números diferentes de propósito: a
// LISTA das páginas com o termo tem de estar completa (é a resposta à pergunta «onde está isto?»), mas o texto
// de cada página pesa até 100 kB e trazer 80 deles por causa da palavra «aeroporto» seriam megabytes para
// desenhar três linhas de excerto. Lista inteira, excertos nas primeiras.
const MAX_PAGINAS_RESPOSTA = 300;
const MAX_PAGINAS_COM_EXCERTO = 12;
export const MINIMO_TERMO = 2;

// Dobra o texto para comparar sem acentos nem maiúsculas MANTENDO o comprimento — é o que permite devolver
// posições que ainda servem para cortar o texto original. Uma normalização NFD normal muda o comprimento e as
// posições deixavam de casar; por isso dobra-se caractere a caractere.
export function dobrar(texto) {
  const s = String(texto || '');
  let fora = '';
  for (const ch of s) {
    const limpo = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
    // uma letra dobrada pode render zero (um acento isolado) ou mais de um caractere (ligaduras): mantém-se
    // sempre exactamente um para o índice não escorregar
    fora += ((limpo[0] || ch).toLowerCase()[0] || ch[0]);
    for (let i = 1; i < ch.length; i += 1) fora += ' ';
  }
  return fora;
}

// As palavras que valem a pena realçar. Tira os operadores que o `websearch_to_tsquery` entende (-, or, "),
// porque o que se realça é a palavra, não a sintaxe da pesquisa.
export function palavrasDoTermo(termo) {
  return Array.from(new Set(
    dobrar(termo)
      .replace(/["'()]/g, ' ')
      .split(/[\s,;:.!?/\\|]+/)
      .map(p => p.replace(/^-+/, '').trim())
      .filter(p => p.length >= MINIMO_TERMO && !['or', 'and', 'not'].includes(p)),
  ));
}

// Posições de todas as ocorrências das palavras num texto já dobrado, sem se sobreporem.
export function ocorrencias(textoDobrado, palavras) {
  const achados = [];
  for (const p of palavras) {
    let i = textoDobrado.indexOf(p);
    while (i !== -1) {
      achados.push({ inicio: i, fim: i + p.length });
      i = textoDobrado.indexOf(p, i + p.length);
    }
  }
  achados.sort((a, b) => a.inicio - b.inicio || b.fim - a.fim);
  const limpos = [];
  for (const a of achados) {
    const ultimo = limpos[limpos.length - 1];
    if (ultimo && a.inicio < ultimo.fim) { ultimo.fim = Math.max(ultimo.fim, a.fim); continue; }
    limpos.push({ ...a });
  }
  return limpos;
}

// Um excerto por ocorrência (no máximo `maximo`), em pedaços para o ecrã desenhar: `{ texto, achado }`.
export function excertosDe(texto, termo, { raio = 90, maximo = 3 } = {}) {
  const original = String(texto || '').replace(/\s+/g, ' ').trim();
  const palavras = palavrasDoTermo(termo);
  if (!original || !palavras.length) return [];
  const dobrado = dobrar(original);
  const achados = ocorrencias(dobrado, palavras).slice(0, maximo);
  return achados.map(({ inicio, fim }) => {
    const de = Math.max(0, inicio - raio);
    const ate = Math.min(original.length, fim + raio);
    const pedacos = [];
    if (de > 0) pedacos.push({ texto: '… ', achado: false });
    if (inicio > de) pedacos.push({ texto: original.slice(de, inicio), achado: false });
    pedacos.push({ texto: original.slice(inicio, fim), achado: true });
    if (ate > fim) pedacos.push({ texto: original.slice(fim, ate), achado: false });
    if (ate < original.length) pedacos.push({ texto: ' …', achado: false });
    return pedacos;
  });
}

const naLista = (d) => (Array.isArray(d) ? d : []);

// Todas as páginas indexadas de um documento — serve o índice lateral e a cópia offline da pesquisa.
export async function obterPaginasDocumento(documentoId) {
  if (!documentoId) return [];
  const { data, error } = await supabase
    .from('documento_pagina_texto')
    .select('pagina,pagina_fonte,rotulo,texto')
    .eq('documento_id', documentoId)
    .order('pagina', { ascending: true });
  if (error) throw error;
  return naLista(data);
}

// Só os rótulos das páginas indexadas, sem o texto: é o que o índice lateral mostra ao lado do número («Folha
// «Janeiro»», «Página 47 (parte 2)»), e serve também para saber se há conteúdo indexado onde procurar. Sem o
// `texto`, isto são alguns kB mesmo num manual de 200 páginas.
export async function obterRotulos(documentoId) {
  if (!documentoId) return [];
  const { data, error } = await supabase
    .from('documento_pagina_texto')
    .select('pagina,pagina_fonte,rotulo')
    .eq('documento_id', documentoId)
    .order('pagina', { ascending: true });
  if (error) return [];
  return naLista(data);
}

// O texto de uma página, para o pôr à disposição de quem lê por leitor de ecrã: a camada de texto do pdf.js
// marca os seus <span> como `presentation` e um canvas não se lê, pelo que sem isto a página seria, para essas
// pessoas, uma imagem muda. Com índice guardado, funciona igualmente sem rede.
export async function obterTextoPagina(documentoId, paginaFonte) {
  if (!documentoId || !paginaFonte) return '';
  const junta = (linhas) => naLista(linhas).map(l => l.texto).filter(Boolean).join('\n\n');
  if (navigator.onLine !== false) {
    try {
      const { data, error } = await supabase
        .from('documento_pagina_texto')
        .select('pagina,texto')
        .eq('documento_id', documentoId)
        .eq('pagina_fonte', paginaFonte)
        .order('pagina', { ascending: true });
      if (error) throw error;
      if (naLista(data).length) return junta(data);
    } catch { /* cai na cópia offline */ }
  }
  const offline = await obterPaginasOffline(documentoId);
  return junta(offline.filter(l => (l.pagina_fonte ?? l.pagina) === paginaFonte));
}

// `pagina_fonte` é a página REAL do ficheiro; `pagina` é o ordinal do bloco indexado e pode não coincidir (uma
// página gigante é partida em dois). Para abrir no sítio certo vale sempre a fonte.
const montar = (l, termo, temTexto) => ({
  pagina: l.pagina,
  paginaFonte: l.pagina_fonte ?? l.pagina,
  rotulo: l.rotulo || `Página ${l.pagina_fonte ?? l.pagina}`,
  // O servidor casa por radical («segurança» acha «seguranças»); o excerto é recortado aqui pela forma
  // literal. Quando só casa o radical, a página fica sem excerto — e continua a aparecer, porque o termo
  // está lá: esconder a página seria mentir sobre o que o servidor encontrou.
  excertos: temTexto ? excertosDe(l.texto, termo) : [],
  temTexto,
});

const porPagina = (a, b) => (a.paginaFonte || 0) - (b.paginaFonte || 0);

// Pesquisa no documento aberto. Tenta o servidor; se ele não responder (sem rede, ou a migração 151 ainda não
// aplicada nesta instalação), cai no índice guardado com a cópia offline.
export async function pesquisarNoDocumento(documentoId, termo) {
  const alvo = String(termo || '').trim();
  if (!documentoId || alvo.length < MINIMO_TERMO) return { resultados: [], fonte: 'nenhuma' };

  if (navigator.onLine !== false) {
    try {
      const pedido = (colunas, limite) => supabase
        .from('documento_pagina_texto')
        .select(colunas)
        .eq('documento_id', documentoId)
        .textSearch('pesquisa', alvo, { type: 'websearch', config: CONFIG_FTS })
        .order('pagina', { ascending: true })
        .limit(limite);
      const [lista, comTexto] = await Promise.all([
        pedido('pagina,pagina_fonte,rotulo', MAX_PAGINAS_RESPOSTA),
        pedido('pagina,pagina_fonte,rotulo,texto', MAX_PAGINAS_COM_EXCERTO),
      ]);
      if (lista.error) throw lista.error;
      const textos = new Map(naLista(comTexto.data).map(l => [l.pagina, l.texto]));
      const resultados = naLista(lista.data)
        .map(l => montar({ ...l, texto: textos.get(l.pagina) }, alvo, textos.has(l.pagina)))
        .sort(porPagina);
      return { resultados, fonte: 'servidor' };
    } catch { /* cai para a cópia offline */ }
  }

  const linhas = await obterPaginasOffline(documentoId);
  if (!linhas.length) return { resultados: [], fonte: 'indisponivel' };
  const palavras = palavrasDoTermo(alvo);
  const resultados = linhas
    .filter(l => { const d = dobrar(l.texto); return palavras.some(p => d.includes(p)); })
    .map(l => montar(l, alvo, true))
    .sort(porPagina);
  return { resultados, fonte: 'offline' };
}
