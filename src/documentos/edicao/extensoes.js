// Extensões TipTap do editor estruturado do GED, limitadas ao contrato (contrato.js): alinhamento de parágrafos e
// títulos, caixas Nota/Atenção/Aviso (blockquote.attrs.tipo), imagem e tabela com legenda, quebra de página,
// listas até 3 níveis (Tab / Shift+Tab). Servem o editor e a pré-visualização (generateHTML).
import { Extension, Node, mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Image from '@tiptap/extension-image';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import { ALINHAMENTOS, TIPOS_CAIXA, NIVEIS_LISTA_MAX } from './contrato';

const textoOuNulo = (v) => { const t = String(v ?? '').trim(); return t || null; };

/** Alinhamento de parágrafos e títulos (attrs.textAlign; 'left' grava-se como null). */
export const Alinhamento = Extension.create({
  name: 'gdAlinhamento',
  addGlobalAttributes() {
    return [{
      types: ['paragraph', 'heading'],
      attributes: {
        textAlign: {
          default: null,
          parseHTML: (el) => {
            const a = String(el.style?.textAlign || el.getAttribute('align') || '').toLowerCase();
            return ['center', 'right', 'justify'].includes(a) ? a : null;
          },
          renderHTML: (a) => (a.textAlign && a.textAlign !== 'left' ? { style: `text-align: ${a.textAlign}` } : {}),
        },
      },
    }];
  },
  addCommands() {
    return {
      definirAlinhamento: (alinhamento) => ({ commands }) => {
        if (!ALINHAMENTOS.includes(alinhamento)) return false;
        const v = alinhamento === 'left' ? null : alinhamento;
        return ['paragraph', 'heading'].map(t => commands.updateAttributes(t, { textAlign: v })).some(Boolean);
      },
    };
  },
});

/** Caixas de destaque: blockquote com attrs.tipo ('nota' | 'atencao' | 'aviso'). */
export const Caixas = Extension.create({
  name: 'gdCaixas',
  addGlobalAttributes() {
    return [{
      types: ['blockquote'],
      attributes: {
        tipo: {
          default: 'nota',
          parseHTML: (el) => { const t = el.getAttribute('data-tipo'); return TIPOS_CAIXA.includes(t) ? t : 'nota'; },
          renderHTML: (a) => ({ 'data-tipo': TIPOS_CAIXA.includes(a.tipo) ? a.tipo : 'nota' }),
        },
      },
    }];
  },
  addCommands() {
    return {
      definirCaixa: (tipo) => ({ editor, commands }) => {
        if (!TIPOS_CAIXA.includes(tipo)) return false;
        if (editor.isActive('blockquote')) return commands.updateAttributes('blockquote', { tipo });
        return commands.wrapIn('blockquote', { tipo });
      },
      tirarCaixa: () => ({ commands }) => commands.lift('blockquote'),
    };
  },
});

/** Imagem em bloco, com largura opcional e legenda («Figura N — legenda» por baixo). */
export const ImagemContrato = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: { default: null, parseHTML: el => el.getAttribute('width') || null, renderHTML: a => (a.width ? { width: a.width } : {}) },
      legenda: { default: null, parseHTML: el => textoOuNulo(el.getAttribute('data-legenda')), renderHTML: () => ({}) },
    };
  },
  parseHTML() {
    return [
      {
        tag: 'figure',
        getAttrs: (el) => {
          const img = el.querySelector('img[src]');
          if (!img) return false;
          return {
            src: img.getAttribute('src'),
            alt: img.getAttribute('alt'),
            title: img.getAttribute('title'),
            width: img.getAttribute('width') || null,
            legenda: textoOuNulo(el.querySelector('figcaption')?.textContent),
          };
        },
      },
      ...(this.parent?.() || []),
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    const img = ['img', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)];
    const legenda = textoOuNulo(node.attrs.legenda);
    if (!legenda) return img;
    return ['figure', { class: 'gd-figura', 'data-legenda': '' }, img, ['figcaption', {}, legenda]];
  },
}).configure({ inline: false, allowBase64: true });

/** Tabela com legenda opcional («Tabela N — legenda» por cima, em <caption>). */
export const TabelaContrato = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      legenda: {
        default: null,
        parseHTML: el => textoOuNulo(el.getAttribute('data-legenda') || el.querySelector(':scope > caption')?.textContent),
        renderHTML: () => ({}),
      },
    };
  },
  parseHTML() {
    // a <caption> é atributo da tabela: não pode entrar como conteúdo
    return [{ tag: 'table' }, { tag: 'caption', ignore: true }];
  },
  renderHTML(props) {
    const r = this.parent(props);
    const legenda = textoOuNulo(props.node.attrs.legenda);
    if (!legenda || !Array.isArray(r) || r[0] !== 'table') return r;
    const t = [...r];
    t.splice(2, 0, ['caption', { contenteditable: 'false', 'data-legenda': '' }, legenda]);
    return t;
  },
}).configure({ resizable: false });

/** Quebra de página: nó de bloco sem conteúdo. */
export const QuebraPagina = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,
  parseHTML() { return [{ tag: 'div[data-quebra-pagina]' }]; },
  renderHTML() {
    return ['div', { 'data-quebra-pagina': '', class: 'gd-quebra-pagina' }, ['span', {}, 'Quebra de página']];
  },
  addCommands() {
    return {
      inserirQuebraPagina: () => ({ chain, state }) => {
        const { $to } = state.selection;
        const noFim = $to.depth === 0 || $to.after(1) >= state.doc.content.size;
        return chain().insertContent(noFim ? [{ type: 'pageBreak' }, { type: 'paragraph' }] : { type: 'pageBreak' }).run();
      },
    };
  },
  addKeyboardShortcuts() {
    return { 'Mod-Enter': () => this.editor.commands.inserirQuebraPagina() };
  },
});

/** Quantas listas envolvem a selecção (0 = fora de lista). */
export function nivelListaNaSeleccao(state) {
  const { $from } = state.selection;
  let n = 0;
  for (let d = $from.depth; d > 0; d--) {
    const nome = $from.node(d).type.name;
    if (nome === 'bulletList' || nome === 'orderedList') n++;
  }
  return n;
}

/** Está dentro de uma célula de tabela mais perto do que de um item de lista? */
function celulaMaisPerto(state) {
  const { $from } = state.selection;
  for (let d = $from.depth; d > 0; d--) {
    const nome = $from.node(d).type.name;
    if (nome === 'listItem') return false;
    if (nome === 'tableCell' || nome === 'tableHeader') return true;
  }
  return false;
}

/**
 * Listas até NIVEIS_LISTA_MAX níveis: Tab desce, Shift+Tab sobe. Na tabela o Tab continua a andar de célula em célula;
 * fora de lista e de tabela o Tab não faz nada (não sai do editor a meio do texto).
 */
export const ListasMultinivel = Extension.create({
  name: 'gdListasMultinivel',
  priority: 1000,
  addCommands() {
    return {
      aumentarNivelLista: () => ({ state, commands }) => {
        if (nivelListaNaSeleccao(state) >= NIVEIS_LISTA_MAX) return false;
        return commands.sinkListItem('listItem');
      },
      diminuirNivelLista: () => ({ commands }) => commands.liftListItem('listItem'),
    };
  },
  addKeyboardShortcuts() {
    const tratar = (sobe) => () => {
      const { state } = this.editor;
      if (celulaMaisPerto(state)) return false; // a tabela trata (célula seguinte/anterior)
      if (this.editor.isActive('listItem')) {
        if (sobe) this.editor.commands.diminuirNivelLista();
        else this.editor.commands.aumentarNivelLista();
      }
      return true;
    };
    return { Tab: tratar(false), 'Shift-Tab': tratar(true) };
  },
});

/** Extensões que definem o esquema do contrato (editor e pré-visualização). */
export const extensoesContrato = () => [
  StarterKit.configure({
    heading: { levels: [2, 3, 4] },
    code: false,
    codeBlock: false,
    strike: false,
  }),
  Underline,
  Alinhamento,
  Caixas,
  ImagemContrato,
  TabelaContrato,
  TableRow,
  TableHeader,
  TableCell,
  QuebraPagina,
  ListasMultinivel,
];
