import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { ArrowLeft, ChevronLeft, ChevronRight, CheckCircle2, Circle, ListVideo, Loader2, Award, Check, Undo2, Lock, ClipboardList } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { useCursoConteudo, useAtividadeAulas, registarAtividade } from '@/hooks/useFormacao';
import ConteudoAula from './ConteudoAula';
import ComentariosAula from './ComentariosAula';
import { TIPO_AULA, fmtMinutos, fmtData, ordenarConteudo, conclusaoManual } from './formacaoUtils';

// Leitor de aulas: conteúdo + navegação anterior/próxima + marcar concluída + índice lateral.
export default function AulaPlayer({ cursoId, aulaId, matricula, progresso = [], quizzes = [], onIrParaAula, onIrParaQuiz, onVoltarCurso, onVerCertificados, marcarAula, desmarcarAula }) {
  const avaliacaoObrigatoria = quizzes.some(q => q.gera_certificado);
  const { toast } = useToast();
  const { data, isLoading, isError } = useCursoConteudo(cursoId);
  const { arvore, sequencia } = useMemo(() => ordenarConteudo(data?.modulos, data?.aulas), [data]);
  const idsAulas = useMemo(() => new Set(sequencia.map(a => a.id)), [sequencia]);
  // Só conta progresso de aulas que ainda existem (ignora órfãos de aulas apagadas).
  const progressoValido = useMemo(() => progresso.filter(p => idsAulas.has(p.aula_id)), [progresso, idsAulas]);
  const feitas = useMemo(() => new Set(progressoValido.map(p => p.aula_id)), [progressoValido]);

  const idx = sequencia.findIndex(a => a.id === aulaId);
  const aula = idx >= 0 ? sequencia[idx] : null;
  const anterior = idx > 0 ? sequencia[idx - 1] : null;
  const proxima = idx >= 0 && idx < sequencia.length - 1 ? sequencia[idx + 1] : null;
  const total = sequencia.length;
  const nFeitas = feitas.size;
  const pct = total ? Math.round((nFeitas / total) * 100) : 0;
  const feita = aula ? feitas.has(aula.id) : false;
  const concluido = matricula?.estado === 'concluido';
  const moduloIdx = aula ? arvore.findIndex(m => m.id === aula.modulo_id) : -1;

  const [aGuardar, setAGuardar] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const abertaEm = useRef(Date.now()); // para registar o tempo passado na aula
  // actividade: posição do vídeo (retoma) e tempo activo enviado em batidas de 30 s
  const { data: atividades = [] } = useAtividadeAulas(matricula?.id);
  const posicaoInicial = useMemo(() => atividades.find(a => a.aula_id === aulaId)?.posicao_s ?? null, [atividades, aulaId]);
  const posicaoRef = useRef(null);
  const acumRef = useRef(0);
  useEffect(() => {
    if (!matricula?.id || !aulaId) return undefined;
    posicaoRef.current = null; acumRef.current = 0;
    registarAtividade({ matriculaId: matricula.id, aulaId, deltaS: 0 });
    const tick = setInterval(() => { if (document.visibilityState === 'visible') acumRef.current += 1; }, 1000);
    const enviar = () => { const d = acumRef.current; acumRef.current = 0; if (d > 0 || posicaoRef.current != null) registarAtividade({ matriculaId: matricula.id, aulaId, deltaS: d, posicaoS: posicaoRef.current }); };
    const flush = setInterval(enviar, 30000);
    const aoEsconder = () => { if (document.visibilityState === 'hidden') enviar(); };
    document.addEventListener('visibilitychange', aoEsconder);
    return () => { clearInterval(tick); clearInterval(flush); document.removeEventListener('visibilitychange', aoEsconder); enviar(); };
  }, [matricula?.id, aulaId]);

  useEffect(() => {
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { /* */ }
    setDrawerOpen(false);
    abertaEm.current = Date.now();
  }, [aulaId]);

  const ir = (id) => { setDrawerOpen(false); onIrParaAula(id); };

  const concluir = async () => {
    if (!aula || !matricula || aGuardar) return;
    setAGuardar(true);
    try {
      const nova = await marcarAula({ matricula, aula, progressoAtual: progressoValido, totalAulas: total, bloquearConclusao: avaliacaoObrigatoria, segundos: Math.round((Date.now() - abertaEm.current) / 1000) });
      if (nova.estado === 'concluido' && !concluido) {
        toast({ title: 'Parabéns, curso concluído!', description: `Terminou todas as aulas de "${data?.curso?.titulo}".` });
      } else if (Number(nova.progresso_pct) >= 100 && avaliacaoObrigatoria && !concluido) {
        toast({ title: 'Todas as aulas concluídas', description: 'Falta a avaliação final para concluir o curso.' });
      } else if (proxima) {
        ir(proxima.id);
      } else {
        toast({ title: 'Aula concluída', description: 'Progresso guardado.' });
      }
    } catch (e) {
      toast({ title: 'Não foi possível guardar o progresso', description: e?.message || String(e), variant: 'destructive' });
    } finally {
      setAGuardar(false);
    }
  };

  // O pacote SCORM/xAPI reportou completed/passed: concluir a aula sem intervenção do aluno.
  const concluirAutomatico = async (snap) => {
    if (!aula || !matricula || feita || aula.conclusao !== 'automatica') return;
    try {
      const seg = snap?.tempo_s > 0 ? snap.tempo_s : Math.round((Date.now() - abertaEm.current) / 1000);
      const nova = await marcarAula({ matricula, aula, progressoAtual: progressoValido, totalAulas: total, bloquearConclusao: avaliacaoObrigatoria, segundos: seg });
      if (nova.estado === 'concluido' && !concluido) toast({ title: 'Parabéns, curso concluído!', description: `Terminou todas as aulas de "${data?.curso?.titulo}".` });
      else toast({ title: 'Aula concluída pelo conteúdo', description: snap?.nota != null ? `Resultado reportado pelo pacote: ${snap.nota}%.` : 'O pacote reportou a conclusão da aula.' });
    } catch (e) {
      toast({ title: 'Não foi possível guardar a conclusão reportada pelo conteúdo', description: e?.message || String(e), variant: 'destructive' });
    }
  };

  const desfazer = async () => {
    if (!aula || !matricula || aGuardar) return;
    setAGuardar(true);
    try {
      await desmarcarAula({ matricula, aula, progressoAtual: progressoValido, totalAulas: total, bloquearConclusao: avaliacaoObrigatoria });
    } catch (e) {
      toast({ title: 'Não foi possível actualizar o progresso', description: e?.message || String(e), variant: 'destructive' });
    } finally {
      setAGuardar(false);
    }
  };

  if (!matricula) {
    return (
      <Card className="dark:border-slate-800 dark:bg-slate-900"><CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <Lock className="h-8 w-8 text-slate-400" aria-hidden="true" />
        <p className="text-slate-700 dark:text-slate-300">Precisa de estar inscrito neste curso para ver as aulas.</p>
        <Button onClick={onVoltarCurso}><ArrowLeft className="h-4 w-4" aria-hidden="true" />Ir para o curso</Button>
      </CardContent></Card>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-full max-w-md" />
        <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          <div className="space-y-4"><Skeleton className="aspect-video w-full" /><Skeleton className="h-16 w-full" /></div>
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (isError || !aula) {
    return (
      <Card className="dark:border-slate-800 dark:bg-slate-900"><CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <p className="text-slate-700 dark:text-slate-300">Aula não encontrada. Pode ter sido removida ou movida.</p>
        <Button variant="outline" onClick={onVoltarCurso}><ArrowLeft className="h-4 w-4" aria-hidden="true" />Voltar ao curso</Button>
      </CardContent></Card>
    );
  }

  const T = TIPO_AULA[aula.tipo] || TIPO_AULA.texto;
  const TipoIcon = T.icon;
  const todasFeitas = total > 0 && nFeitas >= total;
  const lista = <ListaConteudo arvore={arvore} feitas={feitas} atualId={aula.id} onIr={ir} quizzes={quizzes} onIrParaQuiz={onIrParaQuiz} desbloqueado={todasFeitas || concluido} />;

  return (
    <div className="space-y-4">
      {/* Barra superior */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <Button variant="ghost" size="sm" onClick={onVoltarCurso} className="-ml-2 text-slate-600 dark:text-slate-300">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />Curso
        </Button>
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700 dark:text-slate-300">{data?.curso?.titulo}</p>
        <div className="hidden items-center gap-2 sm:flex" aria-label={`Progresso do curso: ${nFeitas} de ${total} aulas`}>
          <Progress value={pct} className="h-1.5 w-32" />
          <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">{nFeitas}/{total} · {pct}%</span>
        </div>
        <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setDrawerOpen(true)}>
          <ListVideo className="h-4 w-4" aria-hidden="true" />Conteúdo
        </Button>
      </div>

      {!concluido && todasFeitas && quizzes.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-900 dark:bg-violet-950/40 sm:flex-row sm:items-center">
          <ClipboardList className="h-8 w-8 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-violet-900 dark:text-violet-100">Todas as aulas concluídas</p>
            <p className="text-sm text-violet-800/80 dark:text-violet-200/80">{avaliacaoObrigatoria ? 'Faça a avaliação final para concluir o curso e receber o certificado.' : 'A avaliação do curso está disponível.'}</p>
          </div>
          <Button size="sm" onClick={() => onIrParaQuiz?.(quizzes[0].id)}>Fazer a avaliação</Button>
        </div>
      )}
      {concluido && (
        <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40 sm:flex-row sm:items-center">
          <Award className="h-8 w-8 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-emerald-900 dark:text-emerald-100">Curso concluído{matricula.concluido_em ? ` em ${fmtData(matricula.concluido_em)}` : ''}</p>
            <p className="text-sm text-emerald-800/80 dark:text-emerald-200/80">O certificado é emitido pela Gestão de Formação e fica disponível no separador Certificados.</p>
          </div>
          {onVerCertificados && <Button variant="outline" size="sm" onClick={onVerCertificados} className="border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-100 dark:bg-transparent dark:text-emerald-200">Ver certificados</Button>}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* ── Conteúdo ─────────────────────────────────────── */}
        <main className="min-w-0 space-y-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {moduloIdx >= 0 ? `Módulo ${moduloIdx + 1} · ${aula.modulo?.titulo}` : 'Aula'} · {idx + 1} de {total}
            </p>
            <h1 className="mt-1 text-xl font-bold leading-tight text-slate-900 dark:text-slate-100 md:text-2xl">{aula.titulo}</h1>
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
              <TipoIcon className="h-4 w-4" aria-hidden="true" />{T.label}{aula.duracao_min ? ` · ${fmtMinutos(aula.duracao_min)}` : ''}
            </p>
          </div>

          <ConteudoAula aula={aula} posicaoInicial={posicaoInicial} onPosicao={(seg) => { posicaoRef.current = Math.round(seg); }} matricula={matricula} onConclusaoAutomatica={concluirAutomatico} />

          {/* Barra de acções */}
          <div className="flex flex-col gap-3 rounded-xl border bg-white p-3 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between sm:p-4">
            <Button variant="outline" disabled={!anterior} onClick={() => anterior && ir(anterior.id)} className="order-2 sm:order-1">
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />Anterior
            </Button>
            <div className="order-1 flex items-center justify-center gap-2 sm:order-2">
              {!feita && !conclusaoManual(aula) ? (
                <span className="inline-flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                  <Circle className="h-5 w-5 text-slate-400" aria-hidden="true" />{aula.tipo === 'presencial' || aula.conclusao === 'presenca' ? 'Concluída quando o instrutor marcar a presença' : 'Concluída automaticamente pelo conteúdo'}
                </span>
              ) : feita ? (
                <>
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-5 w-5" aria-hidden="true" />Aula concluída
                  </span>
                  <Button variant="ghost" size="sm" onClick={desfazer} disabled={aGuardar} aria-label="Desmarcar aula como concluída">
                    {aGuardar ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Undo2 className="h-4 w-4" aria-hidden="true" />}Desmarcar
                  </Button>
                </>
              ) : (
                <Button size="lg" onClick={concluir} disabled={aGuardar} className="w-full sm:w-auto">
                  {aGuardar ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
                  {proxima ? 'Concluir e avançar' : 'Concluir aula'}
                </Button>
              )}
            </div>
            <Button variant={feita && proxima ? 'default' : 'outline'} disabled={!proxima} onClick={() => proxima && ir(proxima.id)} className="order-3">
              Próxima<ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>

          <ComentariosAula aula={aula} curso={data?.curso} />
        </main>

        {/* ── Índice (desktop) ─────────────────────────────── */}
        <aside className="hidden lg:order-first lg:block">
          <Card className="lg:sticky lg:top-[var(--topo-fixo,1.5rem)] lg:max-h-[calc(100vh-var(--topo-fixo,1.5rem)-1.5rem)] lg:overflow-y-auto dark:border-slate-800 dark:bg-slate-900">
            <CardContent className="p-3">
              <div className="mb-3 flex items-center justify-between px-2">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Conteúdo do curso</p>
                <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">{nFeitas}/{total}</span>
              </div>
              {lista}
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* ── Índice (mobile) ──────────────────────────────── */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle className="flex items-center justify-between">
              <span>Conteúdo do curso</span>
              <span className="text-sm font-normal tabular-nums text-slate-500">{nFeitas}/{total}</span>
            </DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-3 pb-6">{lista}</div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function ListaConteudo({ arvore, feitas, atualId, onIr, quizzes = [], onIrParaQuiz, desbloqueado = false }) {
  return (
    <nav aria-label="Aulas do curso" className="space-y-4">
      {arvore.map((m, mi) => (
        <div key={m.id}>
          <p className="mb-1 truncate px-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {String(mi + 1).padStart(2, '0')} · {m.titulo}
          </p>
          <ul className="space-y-0.5">
            {m.aulas.map(a => {
              const atual = a.id === atualId;
              const done = feitas.has(a.id);
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => onIr(a.id)}
                    aria-current={atual ? 'true' : undefined}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm transition-colors',
                      atual
                        ? 'bg-blue-50 font-medium text-blue-900 dark:bg-blue-950/60 dark:text-blue-100'
                        : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
                    )}
                  >
                    {done
                      ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-label="Concluída" />
                      : <Circle className={cn('h-4 w-4 shrink-0', atual ? 'text-blue-500' : 'text-slate-300 dark:text-slate-600')} aria-hidden="true" />}
                    <span className="min-w-0 flex-1 truncate">{a.titulo}</span>
                    {a.duracao_min ? <span className="shrink-0 text-xs text-slate-400">{fmtMinutos(a.duracao_min)}</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {quizzes.length > 0 && (
        <div>
          <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">Avaliação</p>
          <ul className="space-y-0.5">{quizzes.map(q => {
            const bloq = q.requer_aulas_concluidas !== false && !desbloqueado;
            return (
              <li key={q.id}>
                <button type="button" onClick={() => !bloq && onIrParaQuiz?.(q.id)} disabled={bloq} title={bloq ? 'Conclua todas as aulas primeiro' : undefined}
                  className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-300 dark:hover:bg-slate-800">
                  {bloq ? <Lock className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" /> : <ClipboardList className="h-4 w-4 shrink-0 text-violet-600" aria-hidden="true" />}
                  <span className="min-w-0 flex-1 truncate">{q.titulo}</span>
                </button>
              </li>
            );
          })}</ul>
        </div>
      )}
    </nav>
  );
}
