import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAnaliticaCurso } from '@/hooks/useGestaoFormacao';
import { analiticaCurso, fmtSegundos } from '@/lib/formacaoAnalitica';
import { exportarPdf, exportarExcel } from '@/lib/formacaoExport';
import { TIPOS_PERGUNTA } from '../quiz/quizUtils';
import BotoesExportar from './BotoesExportar';

const fmtPct = (p) => (p == null ? '—' : `${p}%`);
const corPct = (p, inv = false) => (p == null ? 'text-slate-400' : (inv ? p <= 40 : p >= 80) ? 'text-emerald-600' : (inv ? p <= 70 : p >= 50) ? 'text-amber-600' : 'text-red-600');

// Analítica de um curso: funil por aula, tempo de estudo, dificuldade das perguntas (com tendência) e comparação por aeroporto.
export default function AnaliticaCurso({ curso, user }) {
  const { data, isLoading } = useAnaliticaCurso(curso.id);
  const [soSGA, setSoSGA] = useState(true);
  const an = useMemo(() => (data ? analiticaCurso({ ...data, aeroportos: soSGA ? data.aeroportosSGA : null }) : null), [data, soSGA]);
  if (isLoading || !an) return <div className="space-y-3"><Skeleton className="h-20 w-full" /><Skeleton className="h-72 w-full" /></div>;

  const r = an.resumo;
  const kpis = [
    ['Inscritos', r.inscritos, ''], ['Concluídos', r.concluidos, 'text-emerald-600'], ['Taxa de conclusão', fmtPct(r.taxaConclusao), corPct(r.taxaConclusao)],
    ['Progresso médio', fmtPct(r.progressoMedioPct), ''], ['Tempo médio de estudo', fmtSegundos(r.tempoMedioTotalS), ''], ['Previsto', fmtSegundos(r.duracaoPrevistaS), 'text-slate-500'],
    ['Dias até concluir', r.diasMedioConclusao != null ? `${r.diasMedioConclusao} d` : '—', ''], ['Não começaram', r.naoComecaram, r.naoComecaram ? 'text-amber-600' : ''],
  ];
  const maxAband = Math.max(1, ...an.porAula.map(a => a.abandonos));

  const exportarXlsx = () => exportarExcel(`Analitica_${curso.titulo}`, [
    { nome: 'Resumo', cabecalho: ['Indicador', 'Valor'], linhas: kpis.map(([l, v]) => [l, v]), larguras: [28, 16] },
    { nome: 'Por aula', cabecalho: ['#', 'Módulo', 'Aula', 'Concluída (%)', 'Alunos', 'Tempo médio (s)', 'Previsto (s)', 'Visitas médias', 'Pararam aqui'], linhas: an.porAula.map(a => [a.indice + 1, a.modulo, a.aula.titulo, a.pctConcluida ?? '', a.alunos, a.tempoMedioS ?? '', a.duracaoPrevistaS ?? '', a.visitasMedia ?? '', a.abandonos]), larguras: [4, 26, 40, 12, 8, 14, 12, 12, 12] },
    { nome: 'Perguntas', cabecalho: ['Pergunta', 'Tipo', 'Respostas', 'Certas', 'Parciais', 'Sem resposta', 'Acerto (%)', 'Tendência (pp)'], linhas: an.porPergunta.map(p => [p.enunciado, TIPOS_PERGUNTA[p.tipo]?.label || p.tipo || '', p.n, p.certas, p.parciais, p.sem, p.pct ?? '', p.tendencia ?? '']), larguras: [60, 16, 10, 8, 8, 12, 10, 12] },
    { nome: 'Por aeroporto', cabecalho: ['Aeroporto', 'Inscritos', 'Concluídos', 'Conclusão (%)', 'Tentativas', 'Aprovação (%)', 'Nota média', 'Tempo médio (s)'], linhas: an.porAeroporto.map(g => [g.chave, g.inscritos, g.concluidos, g.taxaConclusao ?? '', g.tentativas, g.aprovacaoPct ?? '', g.notaMedia ?? '', g.tempoMedioS ?? '']), larguras: [40, 10, 10, 12, 10, 12, 10, 14] },
    { nome: 'Por mês', cabecalho: ['Mês', 'Inscrições', 'Conclusões', 'Tentativas', 'Horas de estudo'], linhas: an.porMes.map(m => [m.label, m.inscricoes, m.conclusoes, m.tentativas, m.horas]) },
  ]);
  const exportarPdfAn = () => exportarPdf({ base: `Analitica_${curso.titulo}`, titulo: `Analítica — ${curso.titulo}`, subtitulo: 'Universidade Corporativa', paisagem: true, empresaId: user?.empresa_id, geradoPor: user?.email,
    seccoes: [
      { titulo: 'Resumo', pares: kpis.map(([l, v]) => ({ label: l, value: String(v) })) },
      { titulo: 'Funil por aula', colunas: [{ label: '#', width: 10, align: 'right' }, { label: 'Aula', width: 90 }, { label: 'Concluída', width: 22, align: 'right' }, { label: 'Tempo médio', width: 26, align: 'right' }, { label: 'Previsto', width: 22, align: 'right' }, { label: 'Visitas', width: 18, align: 'right' }, { label: 'Pararam aqui', width: 26, align: 'right' }], linhas: an.porAula.map(a => [a.indice + 1, a.aula.titulo, fmtPct(a.pctConcluida), fmtSegundos(a.tempoMedioS), fmtSegundos(a.duracaoPrevistaS), a.visitasMedia ?? '—', a.abandonos]) },
      { titulo: 'Dificuldade das perguntas (acerto mais baixo primeiro)', colunas: [{ label: 'Pergunta', width: 140 }, { label: 'Resp.', width: 16, align: 'right' }, { label: 'Acerto', width: 18, align: 'right' }, { label: 'Sem resp.', width: 22, align: 'right' }, { label: 'Tendência', width: 24, align: 'right' }], linhas: an.porPergunta.map(p => [p.enunciado, p.n, fmtPct(p.pct), p.sem, p.tendencia == null ? '—' : `${p.tendencia > 0 ? '+' : ''}${p.tendencia} pp`]), vazio: 'Sem tentativas.' },
      { titulo: 'Por aeroporto', colunas: [{ label: 'Aeroporto', width: 70 }, { label: 'Inscritos', width: 20, align: 'right' }, { label: 'Concluídos', width: 22, align: 'right' }, { label: 'Conclusão', width: 22, align: 'right' }, { label: 'Tentativas', width: 22, align: 'right' }, { label: 'Aprovação', width: 22, align: 'right' }, { label: 'Nota média', width: 22, align: 'right' }], linhas: an.porAeroporto.map(g => [g.chave, g.inscritos, g.concluidos, fmtPct(g.taxaConclusao), g.tentativas, fmtPct(g.aprovacaoPct), g.notaMedia != null ? `${g.notaMedia}%` : '—']), vazio: 'Sem dados.' },
      { titulo: 'Por mês', colunas: [{ label: 'Mês', width: 30 }, { label: 'Inscrições', width: 24, align: 'right' }, { label: 'Conclusões', width: 24, align: 'right' }, { label: 'Tentativas', width: 24, align: 'right' }, { label: 'Horas de estudo', width: 30, align: 'right' }], linhas: an.porMes.map(m => [m.label, m.inscricoes, m.conclusoes, m.tentativas, m.horas]) },
    ] });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600 dark:text-slate-400">Tempo de estudo medido enquanto a aula está visível no ecrã (batidas de 30 s); posição do vídeo e visitas por aula.</p>
        <div className="flex items-center gap-3"><label className="flex items-center gap-2 text-sm"><Switch checked={soSGA} onCheckedChange={setSoSGA} aria-label="Só aeroportos da SGA" /><span>Só aeroportos SGA</span></label><BotoesExportar onExcel={exportarXlsx} onPdf={exportarPdfAn} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">{kpis.map(([l, v, cls]) => <Card key={l} className="dark:border-slate-800 dark:bg-slate-900"><CardContent className="p-3"><p className="text-xs text-slate-500 dark:text-slate-400">{l}</p><p className={cn('text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100', cls)}>{v}</p></CardContent></Card>)}</div>

      <Card className="dark:border-slate-800 dark:bg-slate-900">
        <CardHeader className="pb-2"><CardTitle className="text-base">Funil por aula</CardTitle><CardDescription>Percentagem de inscritos que concluiu cada aula, tempo médio face ao previsto e onde os alunos em curso pararam.</CardDescription></CardHeader>
        <CardContent className="p-0">
          {an.porAula.length === 0 ? <p className="px-6 py-6 text-sm text-slate-500">Este curso ainda não tem aulas.</p> : (
            <div className="overflow-x-auto"><Table>
              <TableHeader><TableRow><TableHead className="w-10">#</TableHead><TableHead>Aula</TableHead><TableHead className="min-w-[200px]">Concluída</TableHead><TableHead className="text-right">Tempo médio</TableHead><TableHead className="text-right">Previsto</TableHead><TableHead className="text-right">Visitas</TableHead><TableHead className="min-w-[140px]">Pararam aqui</TableHead></TableRow></TableHeader>
              <TableBody>
                {an.naoComecaram > 0 && <TableRow className="bg-amber-50/60 dark:bg-amber-950/20"><TableCell className="tabular-nums text-slate-400">0</TableCell><TableCell className="text-sm italic text-slate-600 dark:text-slate-300">Inscritos que ainda não concluíram nenhuma aula</TableCell><TableCell /><TableCell /><TableCell /><TableCell /><TableCell><span className="font-semibold tabular-nums text-amber-700">{an.naoComecaram}</span></TableCell></TableRow>}
                {an.porAula.map(a => (
                  <TableRow key={a.aula.id}>
                    <TableCell className="tabular-nums text-slate-500">{a.indice + 1}</TableCell>
                    <TableCell><p className="text-sm font-medium text-slate-900 dark:text-slate-100">{a.aula.titulo}</p><p className="text-xs text-slate-500">{a.modulo}</p></TableCell>
                    <TableCell><div className="flex items-center gap-2"><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className={cn('h-full rounded-full', (a.pctConcluida ?? 0) >= 80 ? 'bg-emerald-500' : (a.pctConcluida ?? 0) >= 50 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: `${a.pctConcluida ?? 0}%` }} /></div><span className="w-24 text-right text-xs tabular-nums text-slate-600 dark:text-slate-300">{a.concluida}/{r.inscritos} · {fmtPct(a.pctConcluida)}</span></div></TableCell>
                    <TableCell className={cn('text-right text-sm tabular-nums', a.tempoMedioS && a.duracaoPrevistaS && a.tempoMedioS < a.duracaoPrevistaS * 0.4 ? 'text-amber-600' : 'text-slate-700 dark:text-slate-200')} title={a.tempoMedioS && a.duracaoPrevistaS && a.tempoMedioS < a.duracaoPrevistaS * 0.4 ? 'Muito abaixo do previsto: aula pouco vista?' : undefined}>{fmtSegundos(a.tempoMedioS)}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-slate-500">{fmtSegundos(a.duracaoPrevistaS)}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{a.visitasMedia ?? '—'}</TableCell>
                    <TableCell><div className="flex items-center gap-2"><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-amber-500" style={{ width: `${(a.abandonos / maxAband) * 100}%` }} /></div><span className={cn('w-6 text-right text-xs tabular-nums', a.abandonos ? 'font-semibold text-amber-700' : 'text-slate-400')}>{a.abandonos}</span></div></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table></div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="dark:border-slate-800 dark:bg-slate-900">
          <CardHeader className="pb-2"><CardTitle className="text-base">Dificuldade das perguntas</CardTitle><CardDescription>Acerto por pergunta em todas as tentativas submetidas; tendência = variação entre os dois últimos meses com respostas.</CardDescription></CardHeader>
          <CardContent className="p-0">
            {an.porPergunta.length === 0 ? <p className="px-6 py-6 text-sm text-slate-500">Ainda não há tentativas submetidas.</p> : (
              <div className="max-h-[420px] overflow-auto"><Table>
                <TableHeader><TableRow><TableHead>Pergunta</TableHead><TableHead className="text-right">Resp.</TableHead><TableHead className="text-right">Acerto</TableHead><TableHead className="text-right">Sem resp.</TableHead><TableHead className="text-right">Tendência</TableHead></TableRow></TableHeader>
                <TableBody>{an.porPergunta.map(p => (
                  <TableRow key={p.pergunta_id}>
                    <TableCell className="max-w-[420px]"><p className="line-clamp-2 text-sm">{p.enunciado}</p><p className="text-xs text-slate-500">{TIPOS_PERGUNTA[p.tipo]?.label || ''}</p></TableCell>
                    <TableCell className="text-right tabular-nums">{p.n}</TableCell>
                    <TableCell className={cn('text-right font-semibold tabular-nums', corPct(p.pct))}>{fmtPct(p.pct)}</TableCell>
                    <TableCell className={cn('text-right tabular-nums', p.sem ? 'text-amber-600' : 'text-slate-400')}>{p.sem}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.tendencia == null ? <Minus className="ml-auto h-4 w-4 text-slate-300" aria-label="Sem tendência" /> : <span className={cn('inline-flex items-center gap-1', p.tendencia > 0 ? 'text-emerald-600' : p.tendencia < 0 ? 'text-red-600' : 'text-slate-500')}>{p.tendencia > 0 ? <TrendingUp className="h-4 w-4" aria-hidden="true" /> : p.tendencia < 0 ? <TrendingDown className="h-4 w-4" aria-hidden="true" /> : <Minus className="h-4 w-4" aria-hidden="true" />}{p.tendencia > 0 ? '+' : ''}{p.tendencia} pp</span>}</TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table></div>
            )}
          </CardContent>
        </Card>
        <Card className="dark:border-slate-800 dark:bg-slate-900">
          <CardHeader className="pb-2"><CardTitle className="text-base">Por aeroporto</CardTitle><CardDescription>Segundo o aeroporto de cada formando na Universidade.</CardDescription></CardHeader>
          <CardContent className="p-0">
            {an.porAeroporto.length === 0 ? <p className="px-6 py-6 text-sm text-slate-500">Sem inscritos com aeroporto atribuído.</p> : (
              <div className="max-h-[420px] overflow-auto"><Table>
                <TableHeader><TableRow><TableHead>Aeroporto</TableHead><TableHead className="text-right">Inscr.</TableHead><TableHead className="text-right">Concl.</TableHead><TableHead className="text-right">Conclusão</TableHead><TableHead className="text-right">Aprovação</TableHead><TableHead className="text-right">Nota média</TableHead><TableHead className="text-right">Tempo médio</TableHead></TableRow></TableHeader>
                <TableBody>{an.porAeroporto.map(g => (
                  <TableRow key={g.chave}><TableCell className="text-sm font-medium">{g.chave}</TableCell><TableCell className="text-right tabular-nums">{g.inscritos}</TableCell><TableCell className="text-right tabular-nums">{g.concluidos}</TableCell><TableCell className={cn('text-right font-semibold tabular-nums', corPct(g.taxaConclusao))}>{fmtPct(g.taxaConclusao)}</TableCell><TableCell className={cn('text-right tabular-nums', corPct(g.aprovacaoPct))}>{fmtPct(g.aprovacaoPct)}</TableCell><TableCell className="text-right tabular-nums">{g.notaMedia != null ? `${g.notaMedia}%` : '—'}</TableCell><TableCell className="text-right tabular-nums">{fmtSegundos(g.tempoMedioS)}</TableCell></TableRow>
                ))}</TableBody>
              </Table></div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="dark:border-slate-800 dark:bg-slate-900">
        <CardHeader className="pb-2"><CardTitle className="text-base">Últimos 12 meses</CardTitle><CardDescription>Inscrições, conclusões, tentativas de avaliação e horas de estudo por mês.</CardDescription></CardHeader>
        <CardContent>
          <div className="h-64" role="img" aria-label="Gráfico mensal de inscrições, conclusões, tentativas e horas de estudo">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={an.porMes} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="inscricoes" name="Inscrições" fill="#2563eb" radius={[3, 3, 0, 0]} /><Bar dataKey="conclusoes" name="Conclusões" fill="#059669" radius={[3, 3, 0, 0]} /><Bar dataKey="tentativas" name="Tentativas" fill="#7c3aed" radius={[3, 3, 0, 0]} /><Bar dataKey="horas" name="Horas de estudo" fill="#d97706" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
