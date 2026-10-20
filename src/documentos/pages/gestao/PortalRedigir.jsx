// Gestão › Redigir documentos: os rascunhos do editor estruturado (POP, programas, planos, manuais…) e o botão
// «Novo a partir de modelo». Um documento gerado aqui pode ser revisto aqui: «Rever» abre a revisão seguinte com
// uma entrada nova no histórico. Nada entra em vigor por aqui — gerar cria uma versão em rascunho que segue a
// aprovação normal.
import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FilePlus2, FilePen, History, ExternalLink, Trash2, Loader2, PenLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import { fmtDataHora } from '@/lib/safeDate';
import { PORTAL_BASE } from '@/lib/portalDocumentos';
import { PaginaGestao, T, Ref, EstadoVazio, EstadoErro, EsqueletoLinhas } from '../../PortalLayout';
import { useAeroportosDocs } from '../../hooks';
import {
  useRascunhosEstruturados, useRecarregarRascunhos, apagarRascunhoEstruturado, reverRascunhoEstruturado, tabelaEmFalta,
} from '../../edicao/hooksEstruturado';
import { rotuloEstadoRascunho, proximaRevisao } from '../../edicao/assistente';

const SELO = {
  gerado: 'border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-200',
  em_edicao: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200',
};

export const rotaRedigir = (id = 'novo') => `${PORTAL_BASE}/gestao/redigir/${id}`;

export function DialogoRever({ rascunho, onFechar, onFeito }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [descricao, setDescricao] = useState('');
  const [busy, setBusy] = useState(false);
  const proxima = proximaRevisao(rascunho?.revisao || rascunho?.conteudo?.cabecalho?.revisao);
  const confirmar = async () => {
    if (!descricao.trim()) { toast({ title: 'Diga o que muda nesta revisão', description: 'A descrição vai para o histórico de revisões do documento.', variant: 'destructive' }); return; }
    setBusy(true);
    try {
      const r = await reverRascunhoEstruturado(rascunho, { descricao: descricao.trim(), autor: user?.full_name || user?.email || '' }, user);
      onFeito(r);
    } catch (e) {
      toast({ title: 'Não foi possível abrir a revisão', description: e?.message || String(e), variant: 'destructive' });
    } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onFechar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><History className="h-5 w-5 text-teal-600" aria-hidden="true" />Rever com o editor</DialogTitle>
          <DialogDescription>
            Abre a revisão <strong>{proxima}</strong> de {rascunho?.numero || rascunho?.titulo || 'este documento'} a partir do texto da última revisão gerada.
            A revisão em vigor não muda até a nova ser aprovada.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="rev-desc">O que muda nesta revisão *</Label>
          <Textarea id="rev-desc" rows={3} value={descricao} onChange={e => setDescricao(e.target.value)} maxLength={500} placeholder="Ex.: Actualização das responsabilidades do Chefe de Turno e do passo 4." />
          <p className={cn('text-sm', T.tintaFraca)}>Fica no histórico de revisões do documento.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onFechar} disabled={busy}>Cancelar</Button>
          <Button onClick={confirmar} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <PenLine className="h-4 w-4" aria-hidden="true" />}Abrir a revisão {proxima}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PortalRedigir() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: rascunhos = [], isLoading, isError, error, refetch } = useRascunhosEstruturados();
  const { data: aeroportos = [] } = useAeroportosDocs();
  const recarregar = useRecarregarRascunhos();
  const [rever, setRever] = useState(null);
  const [apagar, setApagar] = useState(null);

  const aero = useMemo(() => new Map(aeroportos.map(a => [a.id, a.codigo_icao || a.nome])), [aeroportos]);
  const novo = () => navigate(rotaRedigir('novo'));

  const confirmarApagar = async () => {
    const r = apagar; setApagar(null);
    try { await apagarRascunhoEstruturado(r.id); toast({ title: 'Rascunho apagado' }); recarregar(); }
    catch (e) { toast({ title: 'Não foi possível apagar', description: e?.message || String(e), variant: 'destructive' }); }
  };

  return (
    <PaginaGestao
      titulo="Redigir documentos"
      descricao="Escreva procedimentos, programas e planos secção a secção, a partir dos modelos da SGA. Gerar cria uma revisão em rascunho (PDF + Word) que segue para aprovação."
      accoes={<Button onClick={novo}><FilePlus2 className="h-4 w-4" aria-hidden="true" />Novo a partir de modelo</Button>}
    >
      <div className={T.caixa}>
        {isLoading ? <EsqueletoLinhas linhas={4} /> : isError ? (
          <EstadoErro
            titulo={tabelaEmFalta(error) || /migra/i.test(error?.message || '') ? 'O editor ainda não está activo no servidor' : 'Não foi possível carregar os rascunhos'}
            texto={error?.message}
            onTentar={() => refetch()}
          />
        ) : !rascunhos.length ? (
          <EstadoVazio icone={FilePen} titulo="Ainda não há documentos a ser redigidos" texto="Comece por um modelo: o assistente pede o cabeçalho e guia-o secção a secção, com ajuda e exemplos.">
            <Button onClick={novo}><FilePlus2 className="h-4 w-4" aria-hidden="true" />Novo a partir de modelo</Button>
          </EstadoVazio>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={cn('border-b text-left', T.linha, T.tintaFraca)}>
                  <th className="px-4 py-2.5 font-medium">Número</th>
                  <th className="px-4 py-2.5 font-medium">Título</th>
                  <th className="px-4 py-2.5 font-medium">Rev.</th>
                  <th className="px-4 py-2.5 font-medium">Aeroporto</th>
                  <th className="px-4 py-2.5 font-medium">Estado</th>
                  <th className="px-4 py-2.5 font-medium">Actualizado</th>
                  <th className="px-4 py-2.5 font-medium"><span className="sr-only">Acções</span></th>
                </tr>
              </thead>
              <tbody className={cn('divide-y', T.divisoria)}>
                {rascunhos.map(r => (
                  <tr key={r.id} className={T.realce}>
                    <td className="whitespace-nowrap px-4 py-2.5">{r.numero ? <Ref className="font-semibold">{r.numero}</Ref> : <span className={cn('italic', T.tintaFraca)}>sem número</span>}</td>
                    <td className="px-4 py-2.5">
                      <Link to={rotaRedigir(r.id)} className={cn('font-medium hover:underline', T.tinta, T.foco)}>{r.titulo || 'Sem título'}</Link>
                      <span className={cn('ml-2 text-xs', T.tintaFraca)}>{r.modelo}</span>
                    </td>
                    <td className="px-4 py-2.5 tabular-nums">{r.revisao || '—'}</td>
                    <td className="px-4 py-2.5">{aero.get(r.aeroporto_id) || '—'}</td>
                    <td className="px-4 py-2.5"><span className={cn('inline-flex rounded-md border px-2 py-0.5 text-xs font-medium', SELO[r.estado] || SELO.em_edicao)}>{rotuloEstadoRascunho(r)}</span></td>
                    <td className={cn('whitespace-nowrap px-4 py-2.5', T.tintaFraca)}>{fmtDataHora(r.actualizado_em)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right">
                      <div className="flex justify-end gap-1">
                        {r.estado === 'gerado'
                          ? <Button size="sm" variant="outline" onClick={() => setRever(r)}><History className="h-4 w-4" aria-hidden="true" />Rever</Button>
                          : <Button size="sm" variant="outline" asChild><Link to={rotaRedigir(r.id)}><FilePen className="h-4 w-4" aria-hidden="true" />Continuar</Link></Button>}
                        {r.documento_id && <Button size="sm" variant="ghost" asChild title="Abrir o documento no portal"><Link to={`${PORTAL_BASE}/documento/${r.documento_id}`}><ExternalLink className="h-4 w-4" aria-hidden="true" /><span className="sr-only">Abrir o documento</span></Link></Button>}
                        <Button size="sm" variant="ghost" onClick={() => setApagar(r)} title="Apagar o rascunho do editor"><Trash2 className="h-4 w-4 text-red-600" aria-hidden="true" /><span className="sr-only">Apagar</span></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {rever && <DialogoRever rascunho={rever} onFechar={() => setRever(null)} onFeito={(r) => { setRever(null); recarregar(); navigate(rotaRedigir(r.id)); }} />}
      <ConfirmModal
        isOpen={!!apagar}
        onClose={() => setApagar(null)}
        onConfirm={confirmarApagar}
        variant="destructive"
        title="Apagar o rascunho do editor?"
        message={apagar?.documento_id
          ? 'O documento e as revisões já gravadas ficam como estão; perde-se apenas o texto editável no editor (as próximas revisões terão de ser carregadas como ficheiro).'
          : 'O texto escrito neste rascunho perde-se. O documento ainda não tinha sido criado.'}
        confirmText="Apagar"
      />
    </PaginaGestao>
  );
}
