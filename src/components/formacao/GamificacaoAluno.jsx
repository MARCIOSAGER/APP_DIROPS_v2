import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Award, Footprints, GraduationCap, Medal, Trophy, Target, Star, Users, Timer, MessageCircle, RefreshCw, Sparkles, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PontosFormacao } from '@/entities/PontosFormacao';
import { AlunoDistintivo } from '@/entities/AlunoDistintivo';
import { Distintivo } from '@/entities/Distintivo';

const ICONES = { footprints: Footprints, 'graduation-cap': GraduationCap, medal: Medal, trophy: Trophy, target: Target, star: Star, users: Users, timer: Timer, 'message-circle': MessageCircle, 'refresh-cw': RefreshCw, award: Award };
export const NIVEIS = [
  { nome: 'Iniciante', min: 0 }, { nome: 'Aprendiz', min: 100 }, { nome: 'Praticante', min: 300 }, { nome: 'Especialista', min: 700 }, { nome: 'Mestre', min: 1500 },
];
export function nivelDe(pontos) {
  const p = Number(pontos) || 0;
  let n = NIVEIS[0], prox = NIVEIS[1];
  for (let i = 0; i < NIVEIS.length; i++) if (p >= NIVEIS[i].min) { n = NIVEIS[i]; prox = NIVEIS[i + 1] || null; }
  const pct = prox ? Math.round(((p - n.min) / (prox.min - n.min)) * 100) : 100;
  return { nivel: n, proximo: prox, pct: Math.max(0, Math.min(100, pct)) };
}

export function useGamificacao(email) {
  const e = String(email || '').toLowerCase();
  return useQuery({
    queryKey: ['pontos_formacao', e],
    enabled: !!e,
    queryFn: async () => {
      const [pontos, meus, todos] = await Promise.all([
        PontosFormacao.filter({ aluno_email: e }, '-created_date', 500).catch(() => []),
        AlunoDistintivo.filter({ aluno_email: e }, '-atribuido_em').catch(() => []),
        Distintivo.list('ordem').catch(() => []),
      ]);
      let ranking = [];
      try { const { supabase } = await import('@/lib/supabaseClient'); const r = await supabase.rpc?.('ranking_formacao', { p_limite: 5 }); ranking = Array.isArray(r?.data) ? r.data : []; } catch { ranking = []; }
      return { pontos, total: pontos.reduce((s, p) => s + (Number(p.pontos) || 0), 0), meus, todos, ranking };
    },
    staleTime: 60 * 1000, refetchOnWindowFocus: false,
  });
}

// Cartão de gamificação do aluno: pontos, nível, distintivos e top 5 da empresa.
export default function GamificacaoAluno({ email, compacto = false }) {
  const { data, isLoading } = useGamificacao(email);
  if (!email) return null;
  if (isLoading) return <Skeleton className="h-28 w-full" />;
  if (!data) return null;
  const { nivel, proximo, pct } = nivelDe(data.total);
  const ganhos = new Set(data.meus.map(d => d.codigo));
  const eu = data.ranking.find(r => String(r.aluno_email).toLowerCase() === String(email).toLowerCase());
  const ultimos = data.pontos.slice(0, 3);
  return (
    <Card className="overflow-hidden border-amber-200 bg-gradient-to-br from-amber-50 via-white to-white dark:border-amber-900 dark:from-amber-950/30 dark:via-slate-900 dark:to-slate-900">
      <CardContent className={cn('grid gap-4 p-4', compacto ? 'md:grid-cols-[1fr_auto]' : 'md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.8fr)]')}>
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white shadow"><Sparkles className="h-6 w-6" aria-hidden="true" /></div>
            <div className="min-w-0">
              <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{data.total} <span className="text-sm font-medium text-slate-500">pontos</span></p>
              <p className="text-sm text-slate-600 dark:text-slate-300">Nível <strong>{nivel.nome}</strong>{eu ? ` · ${eu.posicao}.º na empresa` : ''}</p>
            </div>
          </div>
          <div className="mt-3">
            <div className="h-2 overflow-hidden rounded-full bg-amber-100 dark:bg-amber-950/60"><div className="h-full rounded-full bg-amber-500" style={{ width: `${pct}%` }} /></div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{proximo ? `Faltam ${proximo.min - data.total} pontos para ${proximo.nome}` : 'Nível máximo atingido'} · aula +10 · curso +50 · avaliação +30 (100% +20) · presença +20</p>
          </div>
          {!compacto && ultimos.length > 0 && <ul className="mt-2 space-y-0.5 text-xs text-slate-500 dark:text-slate-400">{ultimos.map(p => <li key={p.id}>+{p.pontos} · {p.descricao || p.tipo}</li>)}</ul>}
        </div>
        {!compacto && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Distintivos · {ganhos.size}/{data.todos.length}</p>
            <ul className="flex flex-wrap gap-2">{data.todos.map(d => { const I = ICONES[d.icone] || Award; const tem = ganhos.has(d.codigo); return (
              <li key={d.codigo} title={`${d.nome} — ${d.descricao}${tem ? '' : ' (por conquistar)'}`} className={cn('flex h-10 w-10 items-center justify-center rounded-full border', tem ? 'border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-300' : 'border-dashed border-slate-300 text-slate-300 dark:border-slate-700 dark:text-slate-600')} aria-label={`${d.nome}${tem ? ' conquistado' : ' por conquistar'}`}><I className="h-5 w-5" aria-hidden="true" /></li>
            ); })}</ul>
          </div>
        )}
        {!compacto && data.ranking.length > 0 && (
          <div>
            <p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"><Crown className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />Top 5 da empresa</p>
            <ol className="space-y-1 text-sm">{data.ranking.slice(0, 5).map(r => <li key={r.aluno_email} className={cn('flex items-center justify-between gap-2 rounded px-2 py-0.5', String(r.aluno_email).toLowerCase() === String(email).toLowerCase() && 'bg-amber-100/70 font-semibold dark:bg-amber-950/40')}><span className="truncate"><span className="mr-1.5 tabular-nums text-slate-400">{r.posicao}.</span>{r.aluno_nome}</span><span className="shrink-0 tabular-nums text-slate-600 dark:text-slate-300">{r.pontos}</span></li>)}</ol>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
