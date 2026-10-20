import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { History, Save, RotateCcw, GitCompare, Loader2, Plus, Minus, Pencil } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabaseClient';
import { CursoVersao } from '@/entities/CursoVersao';
import { fmtData, podeEditarCurso, fmtMinutos } from '../formacaoUtils';
import { diferencasVersao } from '@/lib/formacaoVersoes';

export function useVersoesCurso(cursoId) {
  return useQuery({
    queryKey: ['curso_versao', cursoId],
    enabled: !!cursoId,
    queryFn: () => CursoVersao.filter({ curso_id: cursoId }, '-numero', null, null, 'id,curso_id,numero,notas,resumo,origem,criado_por,created_date'),
    staleTime: 30 * 1000, refetchOnWindowFocus: false,
  });
}

// Separador "Versões": histórico de snapshots do conteúdo, guardar nova versão, comparar e restaurar.
export default function VersoesTab({ curso, modulos = [], aulas = [], user, matriculas = [] }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: versoes = [], isLoading } = useVersoesCurso(curso.id);
  const editavel = podeEditarCurso(user, curso);
  const [guardar, setGuardar] = useState(false);
  const [notas, setNotas] = useState('');
  const [busy, setBusy] = useState(null);
  const [restaurar, setRestaurar] = useState(null);
  const [comparar, setComparar] = useState(null); // { versao, snapshot }
  const porVersao = useMemo(() => { const m = new Map(); for (const x of matriculas) m.set(x.versao || 1, (m.get(x.versao || 1) || 0) + 1); return m; }, [matriculas]);
  const refrescar = () => Promise.all([qc.invalidateQueries({ queryKey: ['curso_versao'] }), qc.invalidateQueries({ queryKey: ['curso'] }), qc.invalidateQueries({ queryKey: ['matricula'] }), qc.invalidateQueries({ queryKey: ['quiz'] })]);

  const guardarVersao = async () => {
    setBusy('guardar');
    try {
      const { data, error } = await supabase.rpc('criar_versao_curso', { p_curso: curso.id, p_notas: notas.trim() || null });
      if (error) throw new Error(error.message);
      toast({ title: `Versão ${data?.numero ?? ''} guardada`, description: 'As novas inscrições passam a ficar associadas a esta versão.' });
      setGuardar(false); setNotas(''); await refrescar();
    } catch (e) { toast({ title: 'Não foi possível guardar a versão', description: e?.message || String(e), variant: 'destructive' }); }
    finally { setBusy(null); }
  };
  const restaurarVersao = async (v) => {
    setBusy(v.id);
    try {
      const { data, error } = await supabase.rpc('restaurar_versao_curso', { p_versao: v.id });
      if (error) throw new Error(error.message);
      toast({ title: `Conteúdo restaurado da versão ${v.numero}`, description: `Ficou registado como versão ${data?.numero ?? ''}.` });
      await refrescar();
    } catch (e) { toast({ title: 'Não foi possível restaurar', description: e?.message || String(e), variant: 'destructive' }); }
    finally { setBusy(null); setRestaurar(null); }
  };
  const abrirComparacao = async (v) => {
    setBusy(v.id);
    try {
      const rows = await CursoVersao.filter({ id: v.id }, null, null, null, 'id,numero,snapshot');
      setComparar({ versao: v, dif: diferencasVersao(rows[0]?.snapshot, { modulos, aulas }) });
    } catch (e) { toast({ title: 'Não foi possível comparar', description: e?.message || String(e), variant: 'destructive' }); }
    finally { setBusy(null); }
  };

  if (isLoading) return <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-40 w-full" /></div>;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600 dark:text-slate-400">Versão actual do curso: <strong>v{curso.versao_atual || 1}</strong> · {versoes.length === 0 ? 'ainda sem versões guardadas' : `${versoes.length} ${versoes.length === 1 ? 'versão guardada' : 'versões guardadas'}`}. Cada inscrição e certificado ficam ligados à versão em vigor na altura.</p>
        {editavel && <Button size="sm" onClick={() => setGuardar(true)}><Save className="h-4 w-4" aria-hidden="true" />Guardar versão</Button>}
      </div>
      <Card className="dark:border-slate-800 dark:bg-slate-900">
        <CardContent className="p-0">
          {versoes.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center"><History className="h-8 w-8 text-slate-300" aria-hidden="true" /><p className="max-w-md text-sm text-slate-500 dark:text-slate-400">Guarde uma versão antes de alterar o conteúdo publicado: fica um retrato dos módulos, aulas, banco de perguntas e avaliações, que pode comparar ou restaurar mais tarde.</p></div>
          ) : (
            <div className="overflow-x-auto"><Table>
              <TableHeader><TableRow><TableHead>Versão</TableHead><TableHead>Guardada</TableHead><TableHead>Notas</TableHead><TableHead className="text-right">Módulos</TableHead><TableHead className="text-right">Aulas</TableHead><TableHead className="text-right">Perguntas</TableHead><TableHead className="text-right">Duração</TableHead><TableHead className="text-right">Inscrições</TableHead><TableHead className="text-right">Acções</TableHead></TableRow></TableHeader>
              <TableBody>{versoes.map(v => (
                <TableRow key={v.id}>
                  <TableCell><span className="font-semibold">v{v.numero}</span>{v.numero === (curso.versao_atual || 1) && <Badge className="ml-2 border-0 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">actual</Badge>}{v.origem === 'restauro' && <Badge variant="outline" className="ml-2">restauro</Badge>}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{fmtData(v.created_date)}<p className="text-xs text-slate-500">{v.criado_por || ''}</p></TableCell>
                  <TableCell className="max-w-[280px] text-sm text-slate-600 dark:text-slate-300"><p className="line-clamp-2">{v.notas || '—'}</p></TableCell>
                  <TableCell className="text-right tabular-nums">{v.resumo?.modulos ?? '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">{v.resumo?.aulas ?? '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">{v.resumo?.perguntas ?? '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">{v.resumo?.duracao_min ? fmtMinutos(Number(v.resumo.duracao_min)) : '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">{porVersao.get(v.numero) || 0}</TableCell>
                  <TableCell className="text-right"><div className="flex justify-end gap-1">
                    <Button variant="outline" size="sm" disabled={busy === v.id} onClick={() => abrirComparacao(v)}>{busy === v.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <GitCompare className="h-4 w-4" aria-hidden="true" />}Comparar</Button>
                    {editavel && <Button variant="ghost" size="sm" disabled={busy === v.id} onClick={() => setRestaurar(v)}><RotateCcw className="h-4 w-4" aria-hidden="true" />Restaurar</Button>}
                  </div></TableCell>
                </TableRow>
              ))}</TableBody>
            </Table></div>
          )}
        </CardContent>
      </Card>

      <Dialog open={guardar} onOpenChange={(o) => { if (!o && busy !== 'guardar') setGuardar(false); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Guardar versão v{Math.max(curso.versao_atual || 1, (versoes[0]?.numero || 0)) + (versoes.length ? 1 : 0)}</DialogTitle><DialogDescription>Retrato do conteúdo actual (módulos, aulas, perguntas, avaliações). Descreva o que mudou para os colegas saberem.</DialogDescription></DialogHeader>
          <div className="space-y-1.5"><Label htmlFor="vf-notas">Notas da versão</Label><Textarea id="vf-notas" rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ex.: actualização do módulo 3 ao Instrutivo 22A.117.001.A; novas perguntas de RCAM" autoFocus /></div>
          <DialogFooter><Button variant="outline" onClick={() => setGuardar(false)} disabled={busy === 'guardar'}>Cancelar</Button><Button onClick={guardarVersao} disabled={busy === 'guardar'}>{busy === 'guardar' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}Guardar versão</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!comparar} onOpenChange={(o) => { if (!o) setComparar(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Versão v{comparar?.versao.numero} vs conteúdo actual</DialogTitle><DialogDescription>Módulos e aulas que existem só na versão guardada, só no conteúdo actual, ou que mudaram de título/tipo/duração.</DialogDescription></DialogHeader>
          {comparar && <Diferencas dif={comparar.dif} numero={comparar.versao.numero} />}
          <DialogFooter><Button variant="outline" onClick={() => setComparar(null)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmModal isOpen={!!restaurar} onClose={() => setRestaurar(null)} onConfirm={() => restaurarVersao(restaurar)} title={`Restaurar a versão v${restaurar?.numero}?`} message="Os módulos, aulas, banco de perguntas e avaliações voltam ao retrato guardado. Aulas que entretanto foram criadas são apagadas (e o progresso dos alunos nessas aulas perde-se); avaliações a mais ficam inactivas. É gravada uma nova versão 'restauro' — nada se perde do histórico." confirmText="Restaurar" variant="destructive" />
    </div>
  );
}

function Diferencas({ dif, numero }) {
  const secs = [
    { titulo: `Só na versão v${numero} (foram removidas depois)`, itens: dif.removidas, icon: Minus, cls: 'text-red-700 dark:text-red-300' },
    { titulo: 'Novas no conteúdo actual', itens: dif.novas, icon: Plus, cls: 'text-emerald-700 dark:text-emerald-300' },
    { titulo: 'Alteradas', itens: dif.alteradas, icon: Pencil, cls: 'text-amber-700 dark:text-amber-300' },
  ];
  if (!dif.removidas.length && !dif.novas.length && !dif.alteradas.length) return <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">Sem diferenças de módulos/aulas entre a versão v{numero} e o conteúdo actual.</p>;
  return (
    <div className="space-y-3">
      {secs.filter(s => s.itens.length).map(s => (
        <div key={s.titulo}>
          <p className={cn('mb-1 flex items-center gap-1.5 text-sm font-semibold', s.cls)}><s.icon className="h-4 w-4" aria-hidden="true" />{s.titulo} ({s.itens.length})</p>
          <ul className="space-y-1 text-sm">{s.itens.map(i => <li key={i.id} className="rounded border px-2 py-1 dark:border-slate-700"><span className="text-xs uppercase text-slate-500">{i.tipo === 'modulo' ? 'Módulo' : 'Aula'}</span> · {i.titulo}{i.detalhe ? <span className="text-slate-500"> — {i.detalhe}</span> : null}</li>)}</ul>
        </div>
      ))}
    </div>
  );
}
