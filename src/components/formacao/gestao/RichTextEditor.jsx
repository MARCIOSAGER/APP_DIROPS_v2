import React, { useEffect, useRef, useState } from 'react';
import { Bold, Italic, Underline, Heading2, Heading3, List, ListOrdered, Link2, Quote, RemoveFormatting, Code2, Image, Table2, Info, AlertTriangle, Lightbulb, ChevronsDownUp, Columns2, HelpCircle, ListChecks, LayoutTemplate } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

// Blocos de autoria (Fase G): HTML com classes que o leitor estiliza (.prose-aula em index.css) e que o
// sanitizer deixa passar (details/summary/class). Inseridos com insertHTML no ponto do cursor.
export const BLOCOS = [
  { id: 'callout-info', label: 'Nota informativa', icon: Info, html: '<div class="callout callout-info"><div class="callout-corpo"><p class="callout-titulo">Nota</p><p>Texto da nota…</p></div></div><p><br></p>' },
  { id: 'callout-atencao', label: 'Atenção / aviso', icon: AlertTriangle, html: '<div class="callout callout-atencao"><div class="callout-corpo"><p class="callout-titulo">Atenção</p><p>Texto do aviso…</p></div></div><p><br></p>' },
  { id: 'callout-perigo', label: 'Perigo / proibido', icon: AlertTriangle, html: '<div class="callout callout-perigo"><div class="callout-corpo"><p class="callout-titulo">Perigo</p><p>Texto…</p></div></div><p><br></p>' },
  { id: 'callout-dica', label: 'Dica / boa prática', icon: Lightbulb, html: '<div class="callout callout-dica"><div class="callout-corpo"><p class="callout-titulo">Dica</p><p>Texto da dica…</p></div></div><p><br></p>' },
  { id: 'acordeao', label: 'Acordeão (abre/fecha)', icon: ChevronsDownUp, html: '<details class="acordeao"><summary>Título do bloco</summary><p>Conteúdo escondido até o aluno abrir…</p></details><p><br></p>' },
  { id: 'pergunta', label: 'Pergunta com resposta escondida', icon: HelpCircle, html: '<details class="pergunta-inline"><summary>Pergunta: …?</summary><p><strong>Resposta:</strong> …</p></details><p><br></p>' },
  { id: 'colunas', label: 'Duas colunas', icon: Columns2, html: '<div class="colunas"><div><p><strong>Coluna 1</strong></p><p>Texto…</p></div><div><p><strong>Coluna 2</strong></p><p>Texto…</p></div></div><p><br></p>' },
  { id: 'passos', label: 'Passos numerados', icon: ListChecks, html: '<ol class="passos"><li>Primeiro passo…</li><li>Segundo passo…</li><li>Terceiro passo…</li></ol><p><br></p>' },
  { id: 'tabela', label: 'Tabela 3×3', icon: Table2, html: '<table><thead><tr><th>Coluna A</th><th>Coluna B</th><th>Coluna C</th></tr></thead><tbody><tr><td>…</td><td>…</td><td>…</td></tr><tr><td>…</td><td>…</td><td>…</td></tr></tbody></table><p><br></p>' },
  { id: 'figura', label: 'Imagem com legenda', icon: Image, prompt: 'Endereço da imagem (https://… ou /storage/…)', html: (url) => `<figure><img src="${url}" alt="" /><figcaption>Legenda da imagem</figcaption></figure><p><br></p>` },
];

// Editor de texto simples (contentEditable + execCommand) para aulas de leitura.
// Guarda HTML; o leitor do aluno sanitiza com DOMPurify antes de mostrar.
const ACCOES = [
  { cmd: 'bold', icon: Bold, label: 'Negrito' },
  { cmd: 'italic', icon: Italic, label: 'Itálico' },
  { cmd: 'underline', icon: Underline, label: 'Sublinhado' },
  { cmd: 'formatBlock', arg: 'H2', icon: Heading2, label: 'Título' },
  { cmd: 'formatBlock', arg: 'H3', icon: Heading3, label: 'Subtítulo' },
  { cmd: 'insertUnorderedList', icon: List, label: 'Lista' },
  { cmd: 'insertOrderedList', icon: ListOrdered, label: 'Lista numerada' },
  { cmd: 'formatBlock', arg: 'BLOCKQUOTE', icon: Quote, label: 'Citação' },
  { cmd: 'createLink', icon: Link2, label: 'Ligação' },
  { cmd: 'removeFormat', icon: RemoveFormatting, label: 'Limpar formatação' },
];

export default function RichTextEditor({ value, onChange, placeholder = 'Escreva o conteúdo da aula…', minHeight = 'min-h-[260px]' }) {
  const ref = useRef(null);
  const [modoHtml, setModoHtml] = useState(false);
  const ultimo = useRef(value || '');

  // Sincroniza o conteúdo só quando muda "de fora" (evita saltar o cursor a cada tecla).
  useEffect(() => {
    if (modoHtml || !ref.current) return;
    if ((value || '') !== ultimo.current) {
      ref.current.innerHTML = value || '';
      ultimo.current = value || '';
    }
  }, [value, modoHtml]);

  useEffect(() => {
    if (!modoHtml && ref.current && ref.current.innerHTML !== (value || '')) {
      ref.current.innerHTML = value || '';
      ultimo.current = value || '';
    }
  }, [modoHtml, value]);

  const emitir = () => {
    const html = ref.current?.innerHTML || '';
    ultimo.current = html;
    onChange(html);
  };

  const inserirBloco = (b) => {
    let html = b.html;
    if (b.prompt) { const v = window.prompt(b.prompt); if (!v) return; if (!/^(https?:\/\/|\/)/i.test(v.trim())) return; html = b.html(v.trim().replace(/"/g, '&quot;')); }
    ref.current?.focus();
    const ok = document.execCommand('insertHTML', false, html);
    if (!ok && ref.current) ref.current.insertAdjacentHTML('beforeend', html);
    emitir();
  };

  const exec = (a) => {
    ref.current?.focus();
    if (a.cmd === 'createLink') {
      const url = window.prompt('Endereço da ligação (https://…)');
      if (!url) return;
      document.execCommand('createLink', false, url);
    } else if (a.cmd === 'formatBlock') {
      document.execCommand('formatBlock', false, a.arg);
    } else {
      document.execCommand(a.cmd, false, null);
    }
    emitir();
  };

  return (
    <div className="overflow-hidden rounded-md border dark:border-slate-700">
      <div className="flex flex-wrap items-center gap-0.5 border-b bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800">
        {ACCOES.map((a) => (
          <button
            key={a.label}
            type="button"
            title={a.label}
            aria-label={a.label}
            disabled={modoHtml}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec(a)}
            className="rounded p-1.5 text-slate-600 hover:bg-slate-200 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <a.icon className="h-4 w-4" aria-hidden="true" />
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-slate-300 dark:bg-slate-600" aria-hidden="true" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" disabled={modoHtml} onMouseDown={(e) => e.preventDefault()} className="inline-flex items-center gap-1 rounded px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-700" aria-label="Inserir bloco">
              <LayoutTemplate className="h-4 w-4" aria-hidden="true" />Inserir bloco
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel>Blocos de conteúdo</DropdownMenuLabel>
            {BLOCOS.slice(0, 4).map(b => <DropdownMenuItem key={b.id} onSelect={() => inserirBloco(b)}><b.icon className="mr-2 h-4 w-4" aria-hidden="true" />{b.label}</DropdownMenuItem>)}
            <DropdownMenuSeparator />
            {BLOCOS.slice(4).map(b => <DropdownMenuItem key={b.id} onSelect={() => inserirBloco(b)}><b.icon className="mr-2 h-4 w-4" aria-hidden="true" />{b.label}</DropdownMenuItem>)}
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="mx-1 h-5 w-px bg-slate-300 dark:bg-slate-600" aria-hidden="true" />
        <button
          type="button"
          title="Editar HTML"
          aria-pressed={modoHtml}
          onClick={() => setModoHtml(v => !v)}
          className={cn('rounded p-1.5 text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700', modoHtml && 'bg-slate-200 dark:bg-slate-700')}
        >
          <Code2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {modoHtml ? (
        <Textarea value={value || ''} onChange={(e) => onChange(e.target.value)} className={cn('rounded-none border-0 font-mono text-xs focus-visible:ring-0', minHeight)} spellCheck={false} />
      ) : (
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="Conteúdo da aula"
          data-placeholder={placeholder}
          onInput={emitir}
          onBlur={emitir}
          className={cn(
            'prose-aula max-w-none bg-white p-4 text-[15px] leading-7 text-slate-800 outline-none dark:bg-slate-900 dark:text-slate-200 [&_details]:pointer-events-auto',
            'empty:before:pointer-events-none empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)]',
            '[&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:mt-3 [&_h3]:text-lg [&_h3]:font-semibold',
            '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-2',
            '[&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-blue-300 [&_blockquote]:pl-4 [&_blockquote]:italic',
            '[&_a]:text-blue-700 [&_a]:underline dark:[&_a]:text-blue-300',
            minHeight,
          )}
        />
      )}
    </div>
  );
}
