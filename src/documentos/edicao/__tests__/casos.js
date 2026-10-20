// Casos extremos para os testes dos geradores (não é um ficheiro de teste).
import { exemploPop } from '../exemploPop';

const p = (text) => ({ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] });
const cel = (text, cab = false) => ({ type: cab ? 'tableHeader' : 'tableCell', content: [p(text)] });

export function tabelaGrande(n = 60) {
  return {
    type: 'table',
    content: [
      { type: 'tableRow', content: ['N.º', 'Ponto de verificação', 'Estado', 'Observações'].map((t) => cel(t, true)) },
      ...Array.from({ length: n }, (_, i) => ({
        type: 'tableRow',
        content: [cel(String(i + 1)), cel(`Luz de eixo de pista n.º ${i + 1} — verificação de intensidade e alinhamento`), cel(i % 7 === 0 ? 'Não conforme' : 'Conforme'), cel(i % 9 === 0 ? 'Substituída a lâmpada; reposição confirmada pela manutenção às 14h20.' : '')],
      })),
    ],
  };
}

export function casoExtremo(logo) {
  const longo = 'A'.repeat(900) + 'çãéõº'.repeat(40);
  return {
    ...exemploPop,
    cabecalho: { ...exemploPop.cabecalho, titulo: 'Caso extremo com um título bastante comprido para testar a quebra de linha na capa e o corte no cabeçalho das páginas', classificacao: '' },
    seccoes: [
      { id: 'v', chave: 'vazia', titulo: 'Secção vazia', obrigatoria: true, conteudo: { type: 'doc', content: [{ type: 'paragraph' }] } },
      { id: 'sem', chave: 'semconteudo', titulo: 'Secção sem conteúdo nenhum', obrigatoria: false, conteudo: null },
      { id: 't', chave: 'tabela', titulo: 'Tabela com 60 linhas', obrigatoria: true, conteudo: { type: 'doc', content: [p('Tabela grande que parte entre páginas e repete o cabeçalho:'), tabelaGrande(60)] } },
      { id: 'd', chave: 'desconhecido', titulo: 'Nó desconhecido', obrigatoria: false, conteudo: { type: 'doc', content: [
        { type: 'mermaid', content: [{ type: 'text', text: 'Texto dentro de um nó desconhecido (deve aparecer como texto simples).' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Inline desconhecido: ' }, { type: 'mention', attrs: { id: 'x' }, content: [{ type: 'text', text: '@pessoa' }] }, { type: 'emoji', attrs: { name: 'x' } }] },
        { type: 'callout' },
        p('Caracteres especiais: ç ã é õ º ª « » – — “aspas” € … ≥ ≤ → ✓ 😀 ș'),
      ] } },
      { id: 'l', chave: 'longo', titulo: 'Texto muito longo sem espaços', obrigatoria: false, conteudo: { type: 'doc', content: [p(longo), {
        type: 'table', content: [{ type: 'tableRow', content: [cel('curta'), cel(longo.slice(0, 400))] }],
      }] } },
      { id: 'i', chave: 'imagem', titulo: 'Imagens e listas aninhadas', obrigatoria: false, conteudo: { type: 'doc', content: [
        { type: 'image', attrs: { src: logo, alt: 'Figura 1 — Logo SGA (largura 50%)', width: '50%' } },
        { type: 'image', attrs: { src: 'data:image/png;base64,QUJD', alt: 'Imagem corrompida' } },
        { type: 'orderedList', content: [
          { type: 'listItem', content: [p('Primeiro nível'), { type: 'orderedList', content: [
            { type: 'listItem', content: [p('Segundo nível'), { type: 'orderedList', content: [{ type: 'listItem', content: [p('Terceiro nível')] }] }] },
            { type: 'listItem', content: [p('Segundo nível, item b'), { type: 'bulletList', content: [{ type: 'listItem', content: [p('Marcador dentro de numerada')] }] }] },
          ] }] },
        ] },
        { type: 'table', content: [
          { type: 'tableRow', content: [{ type: 'tableHeader', attrs: { rowspan: 2 }, content: [p('Rowspan 2')] }, cel('a'), cel('b')] },
          { type: 'tableRow', content: [{ type: 'tableCell', attrs: { colspan: 2 }, content: [p('colspan 2')] }] },
        ] },
        { type: 'blockquote', content: [p('Nota: caixa com várias linhas. '.repeat(12)), { type: 'bulletList', content: [{ type: 'listItem', content: [p('lista dentro da nota')] }] }] },
      ] } },
    ],
    historico: [],
  };
}
