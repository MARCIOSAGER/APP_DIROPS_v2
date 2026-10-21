// Peças do assistente quando o rascunho é um modelo-mestre: o aviso com as diferenças por rever e a barra de
// «Campos disponíveis», que insere {{…}} onde está o cursor (no texto da secção ou num campo do cabeçalho).
import React from 'react';
import { AlertTriangle, Braces } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { T } from '../../PortalLayout';
import { CAMPOS_AEROPORTO, camposLocaisDoMestre } from '../../edicao/mestres';

export function AvisoMestre({ diferencas = [] }) {
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100" role="status">
      <p className="flex items-center gap-2 font-semibold">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
        {diferencas.length
          ? `${diferencas.length} ${diferencas.length === 1 ? 'diferença entre aeroportos por rever' : 'diferenças entre aeroportos por rever'}`
          : 'Modelo-mestre: o texto é comum a todos os aeroportos-alvo'}
      </p>
      {diferencas.length > 0 && <ul className="ml-6 mt-1.5 list-disc space-y-0.5">{diferencas.map((d, i) => <li key={i}>{d}</li>)}</ul>}
      <p className="mt-1.5 text-amber-900/80 dark:text-amber-200/80">
        Este rascunho não gera documento nem PDF oficial: no fim, «Gerar para os aeroportos» cria um rascunho por documento-alvo, já preenchido.
      </p>
    </div>
  );
}

/** Insere texto onde está o cursor (editor ProseMirror ou campo de texto). Devolve false se não houver cursor. */
function inserirNoCursor(texto) {
  const el = document.activeElement;
  const editavel = el && (el.isContentEditable || el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && /^(text|search|)$/i.test(el.type || '')));
  if (!editavel || el.disabled || el.readOnly) return false;
  // execCommand mantém o desfazer do navegador e é lido pelo ProseMirror e pelo React como escrita normal
  return document.execCommand('insertText', false, texto);
}

export function BarraCampos({ doc }) {
  const { toast } = useToast();
  const locais = camposLocaisDoMestre(doc);
  const botoes = [...CAMPOS_AEROPORTO, ...locais.map(n => ({ campo: `local.${n}`, rotulo: n.replace(/_/g, ' ') }))];
  const inserir = async (campo) => {
    const t = `{{${campo}}}`;
    if (inserirNoCursor(t)) return;
    try { await navigator.clipboard?.writeText(t); } catch { /* sem área de transferência */ }
    toast({ title: 'Clique primeiro onde quer o campo', description: `${t} ficou copiado: pode colá-lo com Ctrl+V.` });
  };
  return (
    <div className={cn(T.caixa, 'flex flex-wrap items-center gap-1.5 px-3 py-2')} role="toolbar" aria-label="Campos disponíveis">
      <span className={cn('mr-1 inline-flex items-center gap-1.5 text-sm font-medium', T.tintaMedia)}><Braces className="h-4 w-4" aria-hidden="true" />Campos disponíveis</span>
      {botoes.map(b => (
        <button
          key={b.campo}
          type="button"
          title={`Insere {{${b.campo}}} no cursor`}
          onMouseDown={e => e.preventDefault()}
          onClick={() => inserir(b.campo)}
          className={cn('rounded-md border border-slate-300 bg-white px-2 py-1 text-xs hover:border-teal-500 hover:bg-teal-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-teal-950/50', T.foco)}
        >
          {b.rotulo}
        </button>
      ))}
    </div>
  );
}
