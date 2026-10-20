// Editor TipTap de uma secção do documento estruturado, limitado aos nós e marcas do contrato
// (src/documentos/edicao/contrato.js): parágrafo, títulos 2-4, listas, tabela, imagem, quebra, linha horizontal,
// citação (nota/aviso); negrito, itálico, sublinhado. Colar do Word passa por limparHtmlColado; imagens entram
// como data: URL JPEG reduzida (≤ 1600 px).
import React, { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Image from '@tiptap/extension-image';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import {
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Heading2, Heading3, Heading4, Pilcrow,
  Table as TableIcon, ImagePlus, Minus, Quote, Undo2, Redo2, Rows3, Columns3, Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { limparHtmlColado } from './limparColagem';
import { imagemDeFicheiro, reduzirImagemSrc, LIMITE_DATA_URL } from './imagens';
import { docVazio } from './contrato';

// Imagem com largura opcional (attrs.width do contrato), sempre em bloco, com data: URL permitido.
const ImagemContrato = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: { default: null, parseHTML: el => el.getAttribute('width') || null, renderHTML: a => (a.width ? { width: a.width } : {}) },
    };
  },
}).configure({ inline: false, allowBase64: true });

export const extensoesContrato = () => [
  StarterKit.configure({
    heading: { levels: [2, 3, 4] },
    code: false,
    codeBlock: false,
    strike: false,
  }),
  Underline,
  ImagemContrato,
  Table.configure({ resizable: false }),
  TableRow,
  TableHeader,
  TableCell,
];

// Estilo do texto no editor e na pré-visualização (o projecto não tem o plugin de tipografia do Tailwind).
export const ESTILO_PROSA = `
.prose-gd { line-height: 1.6; font-size: 0.95rem; }
.prose-gd > * + * { margin-top: 0.6em; }
.prose-gd h2 { font-size: 1.2rem; font-weight: 700; margin-top: 1em; }
.prose-gd h3 { font-size: 1.05rem; font-weight: 700; margin-top: 0.9em; }
.prose-gd h4 { font-size: 0.95rem; font-weight: 700; font-style: italic; margin-top: 0.8em; }
.prose-gd ul { list-style: disc; padding-left: 1.5em; }
.prose-gd ol { list-style: decimal; padding-left: 1.5em; }
.prose-gd li > p { margin: 0; }
.prose-gd blockquote { border-left: 4px solid #f59e0b; background: rgba(245,158,11,.08); padding: .5em .9em; border-radius: 0 .375rem .375rem 0; }
.prose-gd hr { border: 0; border-top: 1px solid #cbd5e1; margin: 1em 0; }
.prose-gd table { border-collapse: collapse; width: 100%; table-layout: fixed; }
.prose-gd th, .prose-gd td { border: 1px solid #cbd5e1; padding: .35em .5em; vertical-align: top; }
.prose-gd th { background: rgba(15,118,110,.08); font-weight: 600; text-align: left; }
.prose-gd img { max-width: 100%; height: auto; display: block; margin: .5em 0; }
.prose-gd img.ProseMirror-selectednode { outline: 3px solid #0f766e; }
.prose-gd .selectedCell { background: rgba(15,118,110,.12); }
.prose-gd p.is-editor-empty:first-child::before { content: attr(data-placeholder); color: #94a3b8; float: left; height: 0; pointer-events: none; }
`;

function BotaoBarra({ activo, onClick, titulo, children, disabled }) {
  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      aria-pressed={activo}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800',
        activo && 'bg-teal-50 text-teal-900 dark:bg-teal-950/60 dark:text-teal-100',
      )}
    >{children}</button>
  );
}
const Sep = () => <span className="mx-1 h-6 w-px bg-slate-200 dark:bg-slate-700" aria-hidden="true" />;

export default function EditorSeccao({ conteudo, onChange, placeholder, className, editavel = true }) {
  const { toast } = useToast();
  const ficheiroRef = useRef(null);
  const reduzindo = useRef(new Set());
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const emitido = useRef(null); // último conteúdo que saiu daqui (não se volta a meter no editor)

  const inserirFicheiros = async (ed, ficheiros, pos) => {
    for (const f of ficheiros) {
      try {
        const { src, largura } = await imagemDeFicheiro(f);
        const no = { type: 'image', attrs: { src, alt: (f.name || '').replace(/\.[^.]+$/, ''), width: largura > 800 ? '100%' : null } };
        if (typeof pos === 'number') ed.chain().focus().insertContentAt(pos, no).run();
        else ed.chain().focus().insertContent(no).run();
      } catch (e) {
        toast({ title: 'Imagem não inserida', description: e?.message || String(e), variant: 'destructive' });
      }
    }
  };

  // Imagens que chegaram grandes por colagem de HTML (Word): reduzem-se depois de entrar.
  const reduzirGrandes = (ed) => {
    ed.state.doc.descendants((no, pos) => {
      const src = no.type.name === 'image' ? String(no.attrs.src || '') : '';
      if (!src.startsWith('data:') || src.length <= LIMITE_DATA_URL || reduzindo.current.has(src)) return;
      reduzindo.current.add(src);
      reduzirImagemSrc(src).then(({ src: novo }) => {
        if (ed.isDestroyed) return;
        // a posição pode ter mudado: procura-se a imagem de novo pelo src
        ed.state.doc.descendants((n2, p2) => {
          if (n2.type.name === 'image' && n2.attrs.src === src) {
            ed.view.dispatch(ed.state.tr.setNodeMarkup(p2, undefined, { ...n2.attrs, src: novo }));
            return false;
          }
          return true;
        });
      }).catch(() => { /* fica como veio */ }).finally(() => reduzindo.current.delete(src));
    });
  };

  const editor = useEditor({
    extensions: extensoesContrato(),
    content: conteudo || docVazio(),
    editable: editavel,
    editorProps: {
      attributes: {
        class: 'prose-gd min-h-[18rem] px-4 py-3 focus:outline-none',
        'aria-label': placeholder || 'Texto da secção',
      },
      transformPastedHTML: (html) => limparHtmlColado(html),
      handlePaste: (view, event) => {
        const fs = [...(event.clipboardData?.files || [])].filter(f => /^image\//.test(f.type));
        if (!fs.length) return false;
        event.preventDefault();
        inserirFicheiros(editorRef.current, fs);
        return true;
      },
      handleDrop: (view, event) => {
        const fs = [...(event.dataTransfer?.files || [])].filter(f => /^image\//.test(f.type));
        if (!fs.length) return false;
        event.preventDefault();
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        inserirFicheiros(editorRef.current, fs, pos);
        return true;
      },
    },
    onUpdate: ({ editor: ed }) => {
      reduzirGrandes(ed);
      const json = ed.getJSON();
      emitido.current = json;
      onChangeRef.current?.(json);
    },
  });
  const editorRef = useRef(null);
  editorRef.current = editor;

  // Mudar de secção: o mesmo componente recebe outro conteúdo (a chave do pai também força remontagem).
  useEffect(() => {
    if (!editor || editor.isDestroyed || conteudo === emitido.current) return;
    const actual = JSON.stringify(editor.getJSON());
    const novo = JSON.stringify(conteudo || docVazio());
    if (actual !== novo) editor.commands.setContent(conteudo || docVazio(), false);
  }, [editor, conteudo]);

  useEffect(() => { editor?.setEditable(editavel); }, [editor, editavel]);

  if (!editor) return <div className={cn('min-h-[18rem] rounded-lg border border-slate-200 dark:border-slate-800', className)} />;

  const c = () => editor.chain().focus();
  const emTabela = editor.isActive('table');

  return (
    <div className={cn('rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900', className)}>
      <style>{ESTILO_PROSA}</style>
      {editavel && (
        <div role="toolbar" aria-label="Formatação" className="sticky top-[var(--topo-fixo,0px)] z-10 flex flex-wrap items-center gap-0.5 rounded-t-lg border-b border-slate-200 bg-slate-50/95 px-2 py-1 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
          <BotaoBarra titulo="Parágrafo" activo={editor.isActive('paragraph')} onClick={() => c().setParagraph().run()}><Pilcrow className="h-4 w-4" /></BotaoBarra>
          <BotaoBarra titulo="Título" activo={editor.isActive('heading', { level: 2 })} onClick={() => c().toggleHeading({ level: 2 }).run()}><Heading2 className="h-4 w-4" /></BotaoBarra>
          <BotaoBarra titulo="Subtítulo" activo={editor.isActive('heading', { level: 3 })} onClick={() => c().toggleHeading({ level: 3 }).run()}><Heading3 className="h-4 w-4" /></BotaoBarra>
          <BotaoBarra titulo="Subtítulo menor" activo={editor.isActive('heading', { level: 4 })} onClick={() => c().toggleHeading({ level: 4 }).run()}><Heading4 className="h-4 w-4" /></BotaoBarra>
          <Sep />
          <BotaoBarra titulo="Negrito (Ctrl+B)" activo={editor.isActive('bold')} onClick={() => c().toggleBold().run()}><Bold className="h-4 w-4" /></BotaoBarra>
          <BotaoBarra titulo="Itálico (Ctrl+I)" activo={editor.isActive('italic')} onClick={() => c().toggleItalic().run()}><Italic className="h-4 w-4" /></BotaoBarra>
          <BotaoBarra titulo="Sublinhado (Ctrl+U)" activo={editor.isActive('underline')} onClick={() => c().toggleUnderline().run()}><UnderlineIcon className="h-4 w-4" /></BotaoBarra>
          <Sep />
          <BotaoBarra titulo="Lista com marcas" activo={editor.isActive('bulletList')} onClick={() => c().toggleBulletList().run()}><List className="h-4 w-4" /></BotaoBarra>
          <BotaoBarra titulo="Lista numerada (passos)" activo={editor.isActive('orderedList')} onClick={() => c().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></BotaoBarra>
          <BotaoBarra titulo="Nota ou aviso (citação)" activo={editor.isActive('blockquote')} onClick={() => c().toggleBlockquote().run()}><Quote className="h-4 w-4" /></BotaoBarra>
          <BotaoBarra titulo="Linha horizontal" onClick={() => c().setHorizontalRule().run()}><Minus className="h-4 w-4" /></BotaoBarra>
          <Sep />
          <BotaoBarra titulo="Inserir tabela (3×3)" onClick={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><TableIcon className="h-4 w-4" /></BotaoBarra>
          {emTabela && <>
            <BotaoBarra titulo="Acrescentar linha" onClick={() => c().addRowAfter().run()}><Rows3 className="h-4 w-4" /></BotaoBarra>
            <BotaoBarra titulo="Acrescentar coluna" onClick={() => c().addColumnAfter().run()}><Columns3 className="h-4 w-4" /></BotaoBarra>
            <BotaoBarra titulo="Apagar linha" onClick={() => c().deleteRow().run()}><Rows3 className="h-4 w-4 text-red-600" /></BotaoBarra>
            <BotaoBarra titulo="Apagar coluna" onClick={() => c().deleteColumn().run()}><Columns3 className="h-4 w-4 text-red-600" /></BotaoBarra>
            <BotaoBarra titulo="Apagar tabela" onClick={() => c().deleteTable().run()}><Trash2 className="h-4 w-4 text-red-600" /></BotaoBarra>
          </>}
          <BotaoBarra titulo="Inserir imagem" onClick={() => ficheiroRef.current?.click()}><ImagePlus className="h-4 w-4" /></BotaoBarra>
          <Sep />
          <BotaoBarra titulo="Anular (Ctrl+Z)" disabled={!editor.can().undo()} onClick={() => c().undo().run()}><Undo2 className="h-4 w-4" /></BotaoBarra>
          <BotaoBarra titulo="Refazer (Ctrl+Y)" disabled={!editor.can().redo()} onClick={() => c().redo().run()}><Redo2 className="h-4 w-4" /></BotaoBarra>
          <input
            ref={ficheiroRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden"
            onChange={(e) => { const fs = [...(e.target.files || [])]; e.target.value = ''; if (fs.length) inserirFicheiros(editor, fs); }}
          />
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
