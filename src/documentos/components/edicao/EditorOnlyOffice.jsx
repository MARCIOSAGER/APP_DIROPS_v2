// Editor do .docx no navegador (ONLYOFFICE Docs), em ecrã inteiro.
//
// O que acontece ao gravar: o ONLYOFFICE grava sozinho enquanto se escreve (na cache dele); quando a última pessoa
// fecha o editor, o Document Server chama o nosso servidor (callback, estado 2) e é AÍ que nasce a revisão nova —
// sempre em RASCUNHO, nunca por cima da versão em vigor. Leva uns segundos (e o PDF, se ligado, uns minutos).
// Por isso, ao fechar, refrescam-se as versões algumas vezes em vez de uma só.
import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { pedirConfigEditor, carregarApiOnlyOffice, resolverApiJs } from './onlyofficeLogica';

const REFRESCOS_MS = [8000, 20000, 60000, 180000];

export default function EditorOnlyOffice({ versaoId, documentoId, titulo, onFechar }) {
  const qc = useQueryClient();
  const idBruto = useId();
  const alvoId = 'oo-editor-' + idBruto.replace(/[^a-zA-Z0-9_-]/g, '');
  const editorRef = useRef(null);
  const hostRef = useRef(null);
  const alteradoRef = useRef(false);
  const [estado, setEstado] = useState('a_carregar');   // a_carregar | pronto | erro
  const [erro, setErro] = useState('');
  const [porGravar, setPorGravar] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let vivo = true;
    setEstado('a_carregar'); setErro('');
    (async () => {
      try {
        const resp = await pedirConfigEditor(versaoId);
        if (!vivo) return;
        const src = resolverApiJs(resp?.onlyoffice_url, window.location.origin);
        if (!src) throw new Error('O endereço do servidor de edição não está configurado.');
        const DocsAPI = await carregarApiOnlyOffice(src);
        if (!vivo) return;
        const config = {
          ...resp.config,
          events: {
            onAppReady: () => { if (vivo) setEstado('pronto'); },
            onDocumentStateChange: (e) => {
              const sujo = !!e?.data;
              if (sujo) alteradoRef.current = true;
              if (vivo) setPorGravar(sujo);
            },
            onError: (e) => {
              const d = e?.data || {};
              console.error('[ONLYOFFICE] erro', d.errorCode, d.errorDescription);
              if (vivo) { setErro(d.errorDescription ? `O editor comunicou um erro: ${d.errorDescription}` : 'O editor comunicou um erro.'); setEstado('erro'); }
            },
            onRequestClose: () => fechar(),
          },
        };
        // o DocEditor troca o elemento por um iframe: cria-se um alvo novo a cada tentativa
        const host = hostRef.current;
        if (!host) return;
        host.innerHTML = '';
        const alvo = document.createElement('div');
        alvo.id = alvoId + '-' + tentativa;
        host.appendChild(alvo);
        editorRef.current = new DocsAPI.DocEditor(alvo.id, config);
      } catch (e) {
        if (!vivo) return;
        setErro(e?.message || 'O servidor de edição está indisponível.');
        setEstado('erro');
      }
    })();
    return () => {
      vivo = false;
      try { editorRef.current?.destroyEditor?.(); } catch { /* já destruído */ }
      editorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versaoId, tentativa]);

  const fechar = useCallback(() => {
    try { editorRef.current?.destroyEditor?.(); } catch { /* */ }
    editorRef.current = null;
    // a revisão nova só existe depois do callback do Document Server — refrescar algumas vezes
    for (const ms of REFRESCOS_MS) {
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ['gd', 'versoes', documentoId] });
        qc.invalidateQueries({ queryKey: ['gd', 'documento', documentoId] });
      }, ms);
    }
    onFechar?.({ alterado: alteradoRef.current });
  }, [qc, documentoId, onFechar]);

  // Esc não fecha (o Word usa-o); fecha-se no botão. Aviso do navegador se sair com alterações por sincronizar.
  useEffect(() => {
    const antes = (e) => { if (porGravar) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', antes);
    return () => window.removeEventListener('beforeunload', antes);
  }, [porGravar]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-white dark:bg-slate-950" role="dialog" aria-modal="true" aria-label={`Editar ${titulo || 'documento'} no navegador`}>
      <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2 dark:border-slate-800 dark:bg-slate-900">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{titulo || 'Documento'}</p>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Ao fechar, as alterações ficam numa revisão nova em rascunho. A versão em vigor não muda.
          </p>
        </div>
        {estado === 'pronto' && (
          <span className="hidden items-center gap-1.5 text-xs text-slate-600 sm:inline-flex dark:text-slate-400" aria-live="polite">
            {porGravar
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />A sincronizar…</>
              : <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />Sincronizado</>}
          </span>
        )}
        <Button size="sm" variant="outline" onClick={fechar}>
          <X className="mr-1.5 h-4 w-4" aria-hidden="true" />Fechar
        </Button>
      </div>

      <div className="relative min-h-0 flex-1">
        {estado === 'a_carregar' && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />A abrir o editor…
          </div>
        )}
        {estado === 'erro' && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div role="alert" className="max-w-md rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
              <p className="flex items-start gap-2 font-semibold">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />Não foi possível abrir o editor
              </p>
              <p className="mt-2">{erro}</p>
              <p className="mt-2 text-amber-800/80 dark:text-amber-200/70">
                Pode continuar pelo caminho de sempre: descarregar o .docx, editar no Word e carregar a revisão nova.
              </p>
              <div className="mt-4 flex gap-2">
                <Button size="sm" onClick={() => setTentativa(t => t + 1)}>Tentar de novo</Button>
                <Button size="sm" variant="outline" onClick={fechar}>Fechar</Button>
              </div>
            </div>
          </div>
        )}
        <div ref={hostRef} className={estado === 'erro' ? 'hidden' : 'h-full w-full [&>*]:h-full'} />
      </div>
    </div>
  );
}
