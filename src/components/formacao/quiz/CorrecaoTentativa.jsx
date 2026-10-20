import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Save, CheckCircle2, XCircle, MinusCircle, Hourglass, AlertTriangle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { quizApi } from '@/lib/quizApi';
import { TIPOS_PERGUNTA, descreverResposta } from './quizUtils';

// Painel do instrutor: revê uma tentativa pergunta a pergunta e atribui pontos/comentário às
// respostas abertas. Ao guardar, o servidor recalcula a nota e, se aprovar, conclui o curso.
export default function CorrecaoTentativa({ tentativaId, isOpen, onClose, onCorrigida }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [correcoes, setCorrecoes] = useState({});
  const [aGuardar, setAGuardar] = useState(false);

  useEffect(() => {
    if (!isOpen || !tentativaId) return;
    setDados(null); setErro(''); setCorrecoes({});
    quizApi.correcao(tentativaId).then(d => {
      setDados(d);
      const iniciais = {};
      for (const r of d.revisao || []) if (r.tipo === 'aberta') iniciais[r.pergunta_id] = { pontos: d.correcoes?.[r.pergunta_id]?.pontos ?? '', comentario: d.correcoes?.[r.pergunta_id]?.comentario ?? '' };
      setCorrecoes(iniciais);
    }).catch(e => setErro(e?.message || String(e)));
  }, [isOpen, tentativaId]);

  const abertas = (dados?.revisao || []).filter(r => r.tipo === 'aberta' && r.respondida);
  const porPreencher = abertas.filter(r => !Number.isFinite(Number(correcoes[r.pergunta_id]?.pontos)) || correcoes[r.pergunta_id]?.pontos === '');
  const invalidas = abertas.filter(r => { const v = Number(correcoes[r.pergunta_id]?.pontos); return correcoes[r.pergunta_id]?.pontos !== '' && (v < 0 || v > r.pontos_max); });

  const guardar = async () => {
    setAGuardar(true); setErro('');
    try {
      const payload = {};
      for (const r of abertas) { const c = correcoes[r.pergunta_id]; if (c && c.pontos !== '' && Number.isFinite(Number(c.pontos))) payload[r.pergunta_id] = { pontos: Number(c.pontos), comentario: c.comentario || null }; }
      const res = await quizApi.corrigir(tentativaId, payload);
      qc.invalidateQueries({ queryKey: ['tentativa'] }); qc.invalidateQueries({ queryKey: ['matricula'] }); qc.invalidateQueries({ queryKey: ['certificado'] });
      toast({ title: res.pendente ? 'Correcção guardada (ainda há respostas por corrigir)' : res.aprovado ? `Aprovado com ${res.nota}%` : `Corrigida: ${res.nota}% (reprovado)`, description: res.certificado_numero ? `Certificado ${res.certificado_numero} emitido.` : undefined });
      onCorrigida?.(res);
      onClose();
    } catch (e) { setErro(e?.message || String(e)); }
    finally { setAGuardar(false); }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o && !aGuardar) onClose(); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Corrigir tentativa</DialogTitle>
          <DialogDescription>{dados ? <>{dados.aluno_nome || dados.aluno_email} · tentativa {dados.tentativa?.numero} · nota actual <span className="font-semibold tabular-nums">{dados.tentativa?.nota ?? '—'}%</span> (mínima {dados.nota_minima}%){dados.pendentes > 0 && <> · <span className="text-amber-700">{dados.pendentes} por corrigir</span></>}</> : 'A carregar a tentativa…'}</DialogDescription>
        </DialogHeader>
        {dados && Array.isArray(dados.eventos) && dados.eventos.length > 0 && (() => { const n = (t) => dados.eventos.filter(e => e && e.tipo === t).length; const saidas = n('saida'), bloq = n('bloqueado') + n('atalho_bloqueado'), dev = n('devtools_aberto'); return (
          <p role="status" className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-3 py-2 text-xs', dev || bloq > 3 || saidas > 3 ? 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200' : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200')}>
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /><span className="font-semibold">Integridade (modo sem consulta):</span>
            <span>{saidas} {saidas === 1 ? 'saída do ecrã' : 'saídas do ecrã'}</span><span>{bloq} {bloq === 1 ? 'acção bloqueada' : 'acções bloqueadas'} (cópia/atalhos)</span><span>{dev} {dev === 1 ? 'abertura de DevTools' : 'aberturas de DevTools'}</span>
            <span className="text-[11px] opacity-80">A correcção é feita no servidor; estes registos servem para o instrutor avaliar a fiabilidade da tentativa.</span>
          </p>
        ); })()}
        {!dados && !erro && <div className="space-y-2"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>}
        {erro && <p role="alert" className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"><AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />{erro}</p>}
        {dados && (
          <ol className="divide-y rounded-md border dark:divide-slate-800 dark:border-slate-700">{(dados.revisao || []).map((r, i) => {
            const p = (dados.perguntas || []).find(x => x.id === r.pergunta_id);
            const aberta = r.tipo === 'aberta';
            const c = correcoes[r.pergunta_id] || { pontos: '', comentario: '' };
            const inval = aberta && c.pontos !== '' && (Number(c.pontos) < 0 || Number(c.pontos) > r.pontos_max);
            return (
              <li key={r.pergunta_id} className="space-y-2 px-4 py-3">
                <div className="flex items-start gap-2">
                  {r.pendente ? <Hourglass className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-label="Pendente" /> : r.correta ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-label="Correcta" /> : r.parcial ? <MinusCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-label="Parcial" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" aria-label="Errada" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{i + 1}. {p?.enunciado || 'Pergunta'}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{TIPOS_PERGUNTA[r.tipo]?.label || r.tipo} · {r.pendente ? `${r.pontos_max} pontos por atribuir` : `${r.pontos_obtidos} / ${r.pontos_max} pontos`}</p>
                  </div>
                </div>
                {aberta ? (
                  <div className="space-y-2 pl-6">
                    <div className="whitespace-pre-line rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-800 dark:bg-slate-800 dark:text-slate-200">{r.respondida ? String(r.resposta) : <em className="text-slate-400">sem resposta</em>}</div>
                    {p?.opcoes?.[0]?.rubrica && <p className="text-xs text-slate-600 dark:text-slate-400"><span className="font-medium">Critérios:</span> {p.opcoes[0].rubrica}</p>}
                    {r.respondida && (
                      <div className="grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)]">
                        <div className="space-y-1"><Label htmlFor={`ct-p-${r.pergunta_id}`}>Pontos (0–{r.pontos_max})</Label><Input id={`ct-p-${r.pergunta_id}`} type="number" min="0" max={r.pontos_max} step="0.5" value={c.pontos} onChange={(e) => setCorrecoes(cs => ({ ...cs, [r.pergunta_id]: { ...c, pontos: e.target.value } }))} className={cn(inval && 'border-red-500')} aria-invalid={inval || undefined} /></div>
                        <div className="space-y-1"><Label htmlFor={`ct-c-${r.pergunta_id}`}>Comentário ao aluno (opcional)</Label><Textarea id={`ct-c-${r.pergunta_id}`} rows={2} value={c.comentario} onChange={(e) => setCorrecoes(cs => ({ ...cs, [r.pergunta_id]: { ...c, comentario: e.target.value } }))} /></div>
                      </div>
                    )}
                    {inval && <p className="text-xs text-red-600">Os pontos têm de estar entre 0 e {r.pontos_max}.</p>}
                  </div>
                ) : (
                  <div className="pl-6 text-sm text-slate-700 dark:text-slate-300">
                    <span className="text-slate-500">Resposta: </span>{descreverResposta(p, r.resposta) || <em className="text-slate-400">sem resposta</em>}
                    {!r.correta && r.gabarito != null && r.tipo !== 'hotspot' && <span className="ml-2 text-emerald-800 dark:text-emerald-300">(correcta: {descreverResposta(p, r.gabarito, true)})</span>}
                  </div>
                )}
              </li>
            );
          })}</ol>
        )}
        {dados && abertas.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">Esta tentativa não tem respostas abertas para corrigir.</p>}
        <DialogFooter className="items-center gap-2 sm:justify-between">
          <div className="text-xs text-slate-500 dark:text-slate-400">{porPreencher.length > 0 ? <Badge variant="outline" className="border-amber-300 text-amber-700">{porPreencher.length} sem pontos atribuídos</Badge> : abertas.length > 0 ? 'Todas as respostas abertas têm pontos.' : null}</div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={aGuardar}>Fechar</Button>
            <Button type="button" onClick={guardar} disabled={aGuardar || !dados || abertas.length === 0 || invalidas.length > 0}>{aGuardar ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}Guardar correcção</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
