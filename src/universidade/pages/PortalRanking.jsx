// Ranking e gamificação: pontos, nível, distintivos (cartão partilhado) + tabela dos melhores da empresa e regras dos pontos.
import React from 'react';
import { Trophy, Sparkles, Medal, BookOpen, CheckCircle2, ClipboardCheck, CalendarCheck, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import GamificacaoAluno, { NIVEIS } from '@/components/formacao/GamificacaoAluno';
import { useRankingPortal } from '../hooks';

const REGRAS = [
  { i: BookOpen, t: 'Aula concluída', p: 10 }, { i: CheckCircle2, t: 'Curso concluído', p: 50 }, { i: ClipboardCheck, t: 'Avaliação aprovada', p: 30, extra: '+20 com 100 %' },
  { i: CalendarCheck, t: 'Presença numa sessão', p: 20 }, { i: MessageSquare, t: 'Comentário numa aula', p: 2, extra: 'até 5 por aula' }, { i: Medal, t: 'Distintivo conquistado', p: null, extra: 'pontos do distintivo' },
];

export default function PortalRanking() {
  const { user } = useAuth();
  const { data: ranking = [], isLoading } = useRankingPortal(25);
  const meu = String(user?.email || '').toLowerCase();
  return (
    <div className="space-y-6">
      <div><h1 className="flex items-center gap-3 text-2xl font-bold text-slate-900 dark:text-slate-100 md:text-3xl"><Trophy className="h-8 w-8 text-amber-500" aria-hidden="true" />Ranking e conquistas</h1><p className="mt-1 text-slate-600 dark:text-slate-400">Pontos, níveis e distintivos da sua formação — e os colegas que vão à frente.</p></div>
      <GamificacaoAluno email={user?.email} />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card className="dark:border-slate-800 dark:bg-slate-900">
          <CardHeader className="pb-2"><CardTitle className="text-base">Os melhores da empresa</CardTitle><CardDescription>Ordenado por pontos; em caso de empate, pelo número de distintivos.</CardDescription></CardHeader>
          <CardContent className="p-0">
            {isLoading ? <div className="space-y-2 p-4"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div> : ranking.length === 0 ? <p className="p-5 text-sm text-slate-500">Ainda ninguém pontuou.</p> : (
              <div className="overflow-x-auto"><Table>
                <TableHeader><TableRow><TableHead className="w-14">#</TableHead><TableHead>Colaborador</TableHead><TableHead className="text-right">Pontos</TableHead><TableHead className="text-right">Distintivos</TableHead></TableRow></TableHeader>
                <TableBody>{ranking.map(r => { const eu = String(r.aluno_email).toLowerCase() === meu; return (
                  <TableRow key={r.aluno_email} className={cn(eu && 'bg-violet-50/70 dark:bg-violet-950/30')}>
                    <TableCell><span className={cn('inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold', r.posicao === 1 ? 'bg-amber-400 text-amber-950' : r.posicao === 2 ? 'bg-slate-300 text-slate-800' : r.posicao === 3 ? 'bg-orange-300 text-orange-950' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300')}>{r.posicao}</span></TableCell>
                    <TableCell className="font-medium text-slate-900 dark:text-slate-100">{r.aluno_nome}{eu && <span className="ml-1 text-xs font-normal text-violet-700 dark:text-violet-300">(eu)</span>}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.pontos}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.distintivos}</TableCell>
                  </TableRow>
                ); })}</TableBody>
              </Table></div>
            )}
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card className="dark:border-slate-800 dark:bg-slate-900">
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-amber-500" aria-hidden="true" />Como ganhar pontos</CardTitle></CardHeader>
            <CardContent><ul className="divide-y dark:divide-slate-800">{REGRAS.map(r => <li key={r.t} className="flex items-center gap-3 py-2 text-sm"><r.i className="h-4 w-4 shrink-0 text-violet-600" aria-hidden="true" /><span className="flex-1 text-slate-700 dark:text-slate-200">{r.t}{r.extra && <span className="ml-1 text-xs text-slate-500">({r.extra})</span>}</span>{r.p != null && <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">+{r.p}</span>}</li>)}</ul></CardContent>
          </Card>
          <Card className="dark:border-slate-800 dark:bg-slate-900">
            <CardHeader className="pb-2"><CardTitle className="text-base">Níveis</CardTitle></CardHeader>
            <CardContent><ul className="space-y-1.5">{NIVEIS.map(n => <li key={n.nome} className="flex items-center justify-between text-sm"><span className="font-medium text-slate-800 dark:text-slate-100">{n.nome}</span><span className="tabular-nums text-slate-500">a partir de {n.min} pts</span></li>)}</ul></CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
