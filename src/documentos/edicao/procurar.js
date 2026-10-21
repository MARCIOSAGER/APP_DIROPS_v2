// Procurar e substituir no editor (Ctrl+F / Ctrl+H): plugin ProseMirror com realce das ocorrências (decorations).
// A pesquisa ignora maiúsculas e acentos («accao» encontra «acção») e corre bloco de texto a bloco de texto,
// atravessando mudanças de formatação (negrito a meio de uma palavra não a esconde).
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export const chaveProcurar = new PluginKey('gdProcurar');

/** Forma de comparação de um carácter: minúscula e sem acento, mantendo o comprimento (1 → 1). */
function normalizarCar(c) {
  const sem = c.normalize('NFD').replace(/[̀-ͯ]/g, '');
  const base = sem.length === 1 ? sem : c;
  const min = base.toLowerCase();
  return min.length === 1 ? min : base;
}
export function normalizarTexto(t) {
  let r = '';
  for (const c of String(t || '')) r += c.length === 1 ? normalizarCar(c) : c;
  return r;
}

/** Ocorrências de `termo` no documento ProseMirror → [{ from, to }]. */
export function encontrarOcorrencias(doc, termo) {
  const alvo = normalizarTexto(termo);
  const res = [];
  if (!alvo) return res;
  doc.descendants((no, pos) => {
    if (!no.isTextblock) return true;
    let texto = '';
    const mapa = [];
    no.forEach((filho, off) => {
      if (filho.isText) {
        const t = filho.text;
        for (let i = 0; i < t.length; i++) mapa.push(pos + 1 + off + i);
        texto += t;
      } else { texto += '￼'; mapa.push(pos + 1 + off); }
    });
    const norm = normalizarTexto(texto);
    let i = norm.indexOf(alvo);
    while (i !== -1) {
      res.push({ from: mapa[i], to: mapa[i + alvo.length - 1] + 1 });
      i = norm.indexOf(alvo, i + alvo.length);
    }
    return false;
  });
  return res;
}

const estadoVazio = { termo: '', resultados: [], actual: -1 };

function decoracoes(doc, st) {
  if (!st.resultados.length) return DecorationSet.empty;
  return DecorationSet.create(doc, st.resultados.map((r, i) => Decoration.inline(r.from, r.to, {
    class: i === st.actual ? 'gd-achado gd-achado-actual' : 'gd-achado',
  })));
}

/** Estado actual da pesquisa ({ termo, resultados, actual }). */
export const estadoProcurar = (state) => chaveProcurar.getState(state) || estadoVazio;

export const Procurar = Extension.create({
  name: 'gdProcurar',
  addOptions() { return { aoAbrir: null }; },
  addProseMirrorPlugins() {
    return [new Plugin({
      key: chaveProcurar,
      state: {
        init: () => estadoVazio,
        apply(tr, prev) {
          const meta = tr.getMeta(chaveProcurar);
          if (!meta && !tr.docChanged) return prev;
          const termo = meta && 'termo' in meta ? meta.termo : prev.termo;
          const resultados = termo ? encontrarOcorrencias(tr.doc, termo) : [];
          let actual = meta && 'actual' in meta ? meta.actual : prev.actual;
          if (!resultados.length) actual = -1;
          else if (actual < 0) actual = 0;
          else if (actual >= resultados.length) actual = resultados.length - 1;
          return { termo, resultados, actual };
        },
      },
      props: {
        decorations(state) { return decoracoes(state.doc, estadoProcurar(state)); },
      },
    })];
  },
  addKeyboardShortcuts() {
    const abrir = (modo) => () => { this.options.aoAbrir?.(modo); return !!this.options.aoAbrir; };
    return { 'Mod-f': abrir('procurar'), 'Mod-h': abrir('substituir') };
  },
});

/** Define o termo a procurar (sem mexer na selecção). */
export function definirTermo(view, termo) {
  view.dispatch(view.state.tr.setMeta(chaveProcurar, { termo: String(termo || ''), actual: 0 }));
}

/** Vai para a ocorrência `indice` (com volta), selecciona-a e faz scroll até ela. */
export function irParaOcorrencia(view, indice) {
  const st = estadoProcurar(view.state);
  const n = st.resultados.length;
  if (!n) return;
  const i = ((indice % n) + n) % n;
  const r = st.resultados[i];
  const tr = view.state.tr.setMeta(chaveProcurar, { actual: i });
  tr.setSelection(TextSelection.create(tr.doc, r.from, r.to)).scrollIntoView();
  view.dispatch(tr);
}

/** Substitui a ocorrência actual e avança para a seguinte. */
export function substituirActual(view, texto) {
  const st = estadoProcurar(view.state);
  const r = st.resultados[st.actual];
  if (!r) return;
  const tr = view.state.tr.insertText(String(texto ?? ''), r.from, r.to);
  tr.setMeta(chaveProcurar, { actual: st.actual });
  view.dispatch(tr);
  const novo = estadoProcurar(view.state);
  if (novo.resultados.length) irParaOcorrencia(view, Math.min(st.actual, novo.resultados.length - 1));
}

/** Substitui todas as ocorrências (uma só acção de anular). Devolve quantas substituiu. */
export function substituirTodas(view, texto) {
  const st = estadoProcurar(view.state);
  if (!st.resultados.length) return 0;
  const tr = view.state.tr;
  for (let i = st.resultados.length - 1; i >= 0; i--) {
    const r = st.resultados[i];
    tr.insertText(String(texto ?? ''), r.from, r.to);
  }
  view.dispatch(tr);
  return st.resultados.length;
}

/** Contagem de palavras de um documento ProseMirror. */
export function contarPalavras(doc) {
  const t = doc.textBetween(0, doc.content.size, ' ', ' ');
  const m = t.match(/[\p{L}\p{N}][\p{L}\p{N}'’\-.,/:]*/gu);
  return m ? m.length : 0;
}
