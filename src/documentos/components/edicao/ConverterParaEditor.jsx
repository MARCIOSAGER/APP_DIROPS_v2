// «Converter para o editor» na ficha do documento: botão (leve) que abre o diálogo de conversão, carregado à parte
// (DialogoConverterWord.jsx — conversor, mammoth e pré-visualização só descem quando se abre).
// Só para editores/gestores, com versão .docx, sem rascunho do editor já ligado, e fora dos formulários (FR/FX/MQ) e
// dos manuais (MA), que continuam no Word — para esses mostra só uma nota curta.
// Nada é gravado no documento nem nas versões existentes: só nasce uma linha em documento_rascunho_estruturado.
import React, { Suspense, lazy, useMemo, useState } from 'react';
import { Info, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { T } from '../../PortalLayout';
import { ehVersaoFonte } from '../../compararVersoes';
import { modeloPadraoDe } from '../../edicao/modelosPadrao';

const DialogoConverterWord = lazy(() => import('./DialogoConverterWord'));

const nomeDe = (v) => String(v?.arquivo_nome || v?.arquivo_uri || '').toLowerCase().split('?')[0];
export const ehDocxVersao = (v) => nomeDe(v).endsWith('.docx') || /wordprocessingml/i.test(String(v?.mime || ''));

/** Versões .docx por ordem (fontes mais recentes primeiro, depois as outras). */
export function versoesDocx(versoes = []) {
  return versoes.filter(v => ehDocxVersao(v) && (v.arquivo_uri || v.arquivo_url))
    .sort((a, b) => (Number(ehVersaoFonte(b)) - Number(ehVersaoFonte(a))) || (Number(b.versao) - Number(a.versao)));
}

/** Formulários e manuais não se convertem (o mesmo que podeConverterClasse em edicao/converterWord.js). */
export function motivoSemConversao(classe) {
  const c = String(classe || '').toUpperCase();
  if (['FR', 'FX', 'MQ'].includes(c)) return 'formulario';
  if (c === 'MA') return 'manual';
  return '';
}

// ── botão na ficha ──────────────────────────────────────────────────────────
export default function ConverterParaEditor({ doc, versoes, user, temRascunho }) {
  const [aberto, setAberto] = useState(false);
  const docx = useMemo(() => versoesDocx(versoes), [versoes]);
  if (!doc || temRascunho || !docx.length) return null;
  const motivo = motivoSemConversao(doc.classe_codigo);
  if (motivo) {
    return (
      <p className={cn('flex items-center gap-1.5 text-xs', T.tintaFraca)}>
        <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {motivo === 'manual'
          ? 'Os manuais continuam a editar-se no Word (Editar no navegador): não passam para o editor de secções.'
          : 'Os formulários editam-se no Word: caixas, campos e paginação não passam para o editor de secções.'}
      </p>
    );
  }
  if (!modeloPadraoDe(doc.classe_codigo)) return null;
  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setAberto(true)} title="Lê o Word deste documento e prepara um rascunho no editor de secções. O documento e as versões não mudam.">
        <Wand2 className="mr-1.5 h-4 w-4" aria-hidden="true" />Converter para o editor
      </Button>
      {aberto && (
        <Suspense fallback={null}>
          <DialogoConverterWord doc={doc} versoes={versoes} docx={docx} user={user} onFechar={() => setAberto(false)} />
        </Suspense>
      )}
    </>
  );
}
