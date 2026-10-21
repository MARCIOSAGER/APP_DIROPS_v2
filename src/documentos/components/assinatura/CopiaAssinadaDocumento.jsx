// «Cópia assinada» na página do documento, junto às versões: para a revisão aprovada mais recente mostra a data, o
// código de verificação, «Verificar» (abre /vd/<código> num separador novo) e «Descarregar» (nome padrão, não o
// UUID). Gestores e editores podem gerar a cópia quando falta, ou gerá-la de novo (por exemplo, depois de um
// signatário carregar a rubrica). A geração corre no navegador: hooksCopiaAssinada.gerarERegistarCopiaAssinada.
import React, { useMemo, useState } from 'react';
import { AlertTriangle, Download, ExternalLink, FileSignature, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { fmtDataHora } from '@/lib/safeDate';
import { T, MONO } from '../../PortalLayout';
import { useFluxosDocumento, rotuloRevisao } from '../../hooksFluxo';
import {
  useCopiaAssinada, useRecarregarCopiaAssinada, gerarERegistarCopiaAssinada, descarregarCopiaAssinada, falta186, MENSAGEM_SEM_186,
} from '../../hooksCopiaAssinada';
import { nomeCopiaAssinada } from '../../copiaAssinadaLogica';

const tempo = (v) => { const t = new Date(v || 0).getTime(); return Number.isNaN(t) ? 0 : t; };

export default function CopiaAssinadaDocumento({ doc, versoes, podeGerar, user, className }) {
  const fluxosQ = useFluxosDocumento(doc?.id);
  const aprovado = useMemo(() => (fluxosQ.data || [])
    .filter(f => f.estado === 'aprovado' && f.versao_id)
    .sort((a, b) => tempo(b.aprovado_em || b.updated_date) - tempo(a.aprovado_em || a.updated_date))[0] || null, [fluxosQ.data]);
  const versao = useMemo(() => (versoes || []).find(v => v.id === aprovado?.versao_id) || null, [versoes, aprovado]);
  const copiaQ = useCopiaAssinada(aprovado?.versao_id || null);
  const recarregar = useRecarregarCopiaAssinada();
  const [progresso, setProgresso] = useState('');
  const [aGerar, setAGerar] = useState(false);
  const [aDescarregar, setADescarregar] = useState(false);
  const [erro, setErro] = useState('');

  if (!aprovado) return null; // sem revisão aprovada no fluxo, não há cópia assinada

  const semMigracao = copiaQ.isError && falta186(copiaQ.error);
  const copia = copiaQ.data || null;
  const nome = nomeCopiaAssinada(doc, versao || { versao: '' });
  const rev = versao ? rotuloRevisao(versao) : '';

  const gerar = async () => {
    setAGerar(true); setErro(''); setProgresso('A preparar…');
    try {
      await gerarERegistarCopiaAssinada(aprovado.versao_id, { onProgresso: setProgresso, actor: user });
      recarregar(aprovado.versao_id);
    } catch (e) {
      setErro(e?.message || 'Não foi possível gerar a cópia assinada.');
    } finally { setAGerar(false); setProgresso(''); }
  };

  const descarregar = async () => {
    setADescarregar(true); setErro('');
    try { await descarregarCopiaAssinada(copia, copia?.nome || nome); }
    catch (e) { setErro(e?.message || 'Não foi possível descarregar a cópia assinada.'); }
    finally { setADescarregar(false); }
  };

  const urlVerificar = copia?.codigo ? `${window.location.origin}/vd/${encodeURIComponent(copia.codigo)}` : null;

  return (
    <div className={cn('space-y-2 border-b px-4 py-3', T.linha, className)}>
      <div className="flex items-center gap-2">
        <FileSignature className={cn('h-4 w-4 shrink-0', T.tintaFraca)} aria-hidden="true" />
        <p className={cn('text-sm font-medium', T.tinta)}>Cópia assinada{rev ? ` — revisão ${rev}` : ''}</p>
      </div>

      {semMigracao ? (
        <p className={cn('text-sm', T.ambar)}>{MENSAGEM_SEM_186}</p>
      ) : copiaQ.isLoading ? (
        <p className={cn('inline-flex items-center gap-2 text-sm', T.tintaFraca)}><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />A verificar…</p>
      ) : copia ? (
        <div className="space-y-2">
          <p className={cn('text-sm', T.tintaMedia)}>
            Gerada em {fmtDataHora(copia.criado_em)}
            {copia.codigo && <> · código de verificação <span style={MONO} className="font-medium">{copia.codigo}</span></>}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="min-h-[2.5rem]" onClick={descarregar} disabled={aDescarregar}>
              {aDescarregar ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}Descarregar cópia assinada
            </Button>
            {urlVerificar && (
              <Button asChild variant="outline" className="min-h-[2.5rem]">
                <a href={urlVerificar} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" aria-hidden="true" />Verificar</a>
              </Button>
            )}
            {podeGerar && (
              <Button variant="ghost" className="min-h-[2.5rem]" onClick={gerar} disabled={aGerar}>
                {aGerar ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}Gerar de novo
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className={cn('text-sm', T.tintaFraca)}>
            {copiaQ.isError ? (copiaQ.error?.message || 'Não foi possível saber se existe cópia assinada.') : 'A revisão aprovada ainda não tem cópia assinada.'}
          </p>
          {podeGerar && (
            <Button className="min-h-[2.5rem]" onClick={gerar} disabled={aGerar}>
              {aGerar ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileSignature className="h-4 w-4" aria-hidden="true" />}Gerar cópia assinada
            </Button>
          )}
        </div>
      )}

      {aGerar && progresso && <p role="status" className={cn('text-sm', T.tintaFraca)}>{progresso}</p>}
      {erro && (
        <p role="alert" className={cn('flex items-start gap-2 text-sm', T.vermelho)}>
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{erro}
        </p>
      )}
    </div>
  );
}
