import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Circle, Clock, Layers, ListChecks, Loader2, Lock, User, Calendar, Award, RotateCcw, ClipboardList, Timer, CalendarDays } from 'lucide-react';
import SessoesAluno from './SessoesAluno';
import { useCursoConteudo } from '@/hooks/useFormacao';
import { gradienteCategoria, fmtHoras, fmtMinutos, fmtData, NIVEL_LABEL, TIPO_AULA, ordenarConteudo } from './formacaoUtils';

// Página do curso: descrição, conteúdo (módulos > aulas) e cartão de acção (inscrever / continuar).
export default function CursoDetalhe({ cursoId, matricula, progresso = [], quizzes = [], info, onVoltar, onAbrirAula, onAbrirQuiz, onInscrever, onRecertificar, inscrevendo, recertificando }) {
  const { data, isLoading, isError, refetch } = useCursoConteudo(cursoId);
  const { arvore, sequencia } = useMemo(() => ordenarConteudo(data?.modulos, data?.aulas), [data]);
  const feitas = useMemo(() => new Set(progresso.map(p => p.aula_id)), [progresso]);
  const curso = data?.curso;

  const nFeitas = sequencia.filter(a => feitas.has(a.id)).length;
  const total = sequencia.length;
  const pct = total ? Math.round((nFeitas / total) * 100) : 0;
  const proxima = sequencia.find(a => !feitas.has(a.id)) || sequencia[0];
  const inscrito = !!matricula;
  const concluido = matricula?.estado === 'concluido';
  const minutos = sequencia.reduce((s, a) => s + (Number(a.duracao_min) || 0), 0);
  const todasFeitas = total > 0 && nFeitas >= total;
  const avaliacaoObrigatoria = quizzes.some(q => q.gera_certificado);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-32" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-4"><Skeleton className="h-8 w-2/3" /><Skeleton className="h-20 w-full" /><Skeleton className="h-64 w-full" /></div>
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    );
  }
  if (isError || !curso) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={onVoltar}><ArrowLeft className="h-4 w-4" aria-hidden="true" />Catálogo</Button>
        <Card className="dark:border-slate-800 dark:bg-slate-900"><CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-slate-700 dark:text-slate-300">Não foi possível carregar este curso. Pode ter sido removido ou ainda não está publicado.</p>
          <Button variant="outline" onClick={() => refetch()}>Tentar novamente</Button>
        </CardContent></Card>
      </div>
    );
  }

  const grad = gradienteCategoria(curso.categoria);

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={onVoltar} className="-ml-2 text-slate-600 dark:text-slate-300">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />Catálogo
      </Button>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* ── Coluna principal ─────────────────────────────────── */}
        <div className="space-y-6">
          <header className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {curso.categoria && <Badge variant="secondary">{curso.categoria}</Badge>}
              {curso.nivel && <Badge variant="outline" className="dark:border-slate-700">{NIVEL_LABEL[curso.nivel] || curso.nivel}</Badge>}
              {concluido && <Badge className="bg-emerald-600 text-white hover:bg-emerald-600"><CheckCircle2 className="mr-1 h-3 w-3" aria-hidden="true" />Concluído</Badge>}
              {info?.obrigatorio && <Badge className="bg-amber-500 text-white hover:bg-amber-500">Obrigatório</Badge>}
            </div>
            {(info?.estado === 'expirado' || info?.estado === 'a_expirar') && (
              <div className={`flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center ${info.estado === 'expirado' ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40' : 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40'}`}>
                <p className="flex-1 text-sm text-slate-800 dark:text-slate-200">
                  {info.estado === 'expirado' ? `A sua certificação expirou em ${fmtData(info.validoAte)}.` : `A sua certificação expira em ${info.dias} dias (${fmtData(info.validoAte)}).`} Faça a recertificação: o curso reabre num novo ciclo e, ao concluir, recebe um certificado novo.
                </p>
                {onRecertificar && <Button size="sm" onClick={() => onRecertificar(curso)} disabled={recertificando}>{recertificando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RotateCcw className="h-4 w-4" aria-hidden="true" />}Recertificar</Button>}
              </div>
            )}
            <h1 className="text-2xl font-bold leading-tight text-slate-900 dark:text-slate-100 md:text-3xl">{curso.titulo}</h1>
            {curso.descricao && <p className="max-w-3xl whitespace-pre-line text-slate-600 dark:text-slate-400">{curso.descricao}</p>}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
              {curso.instrutor_nome && <span className="inline-flex items-center gap-1.5"><User className="h-4 w-4" aria-hidden="true" />{curso.instrutor_nome}</span>}
              <span className="inline-flex items-center gap-1.5"><Layers className="h-4 w-4" aria-hidden="true" />{arvore.length} {arvore.length === 1 ? 'módulo' : 'módulos'}</span>
              <span className="inline-flex items-center gap-1.5"><ListChecks className="h-4 w-4" aria-hidden="true" />{total} {total === 1 ? 'aula' : 'aulas'}</span>
              {(curso.carga_horaria || minutos) ? <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4" aria-hidden="true" />{curso.carga_horaria ? fmtHoras(curso.carga_horaria) : fmtMinutos(minutos)}</span> : null}
            </div>
          </header>

          <Card className="dark:border-slate-800 dark:bg-slate-900">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                <span>Conteúdo do curso</span>
                {inscrito && total > 0 && <span className="text-sm font-normal text-slate-500 dark:text-slate-400">{nFeitas} de {total} concluídas</span>}
              </CardTitle>
              {!inscrito && total > 0 && (
                <p className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400"><Lock className="h-3.5 w-3.5" aria-hidden="true" />Inscreva-se para aceder às aulas.</p>
              )}
            </CardHeader>
            <CardContent className="pt-0">
              {total === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">Este curso ainda não tem aulas publicadas.</p>
              ) : (
                <Accordion type="multiple" defaultValue={arvore.map(m => m.id)} className="w-full">
                  {arvore.map((m, mi) => {
                    const mFeitas = m.aulas.filter(a => feitas.has(a.id)).length;
                    const mMin = m.aulas.reduce((s, a) => s + (Number(a.duracao_min) || 0), 0);
                    return (
                      <AccordionItem key={m.id} value={m.id} className="dark:border-slate-800">
                        <AccordionTrigger className="py-3 hover:no-underline">
                          <div className="flex flex-1 items-center justify-between gap-3 pr-2 text-left">
                            <span className="font-medium text-slate-900 dark:text-slate-100">
                              <span className="mr-2 text-slate-400">{String(mi + 1).padStart(2, '0')}</span>{m.titulo}
                            </span>
                            <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                              {inscrito ? `${mFeitas}/${m.aulas.length}` : m.aulas.length} {m.aulas.length === 1 ? 'aula' : 'aulas'}{mMin ? ` · ${fmtMinutos(mMin)}` : ''}
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pb-2">
                          {m.descricao && <p className="mb-2 px-1 text-sm text-slate-500 dark:text-slate-400">{m.descricao}</p>}
                          <ul className="space-y-1">
                            {m.aulas.map(a => {
                              const T = TIPO_AULA[a.tipo] || TIPO_AULA.texto;
                              const Icon = T.icon;
                              const feita = feitas.has(a.id);
                              return (
                                <li key={a.id}>
                                  <button
                                    type="button"
                                    disabled={!inscrito}
                                    onClick={() => onAbrirAula(a.id)}
                                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors enabled:hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70 dark:enabled:hover:bg-slate-800"
                                    aria-label={`${feita ? 'Concluída: ' : ''}${a.titulo}`}
                                  >
                                    {inscrito ? (
                                      feita ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" /> : <Circle className="h-5 w-5 shrink-0 text-slate-300 dark:text-slate-600" aria-hidden="true" />
                                    ) : (
                                      <Lock className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                                    )}
                                    <Icon className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                                    <span className="min-w-0 flex-1 truncate text-sm text-slate-800 dark:text-slate-200">{a.titulo}</span>
                                    <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">{T.label}{a.duracao_min ? ` · ${fmtMinutos(a.duracao_min)}` : ''}</span>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              )}
            </CardContent>
          </Card>

          {sequencia.some(a => a.tipo === 'presencial') && (
            <Card className="dark:border-slate-800 dark:bg-slate-900">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-4 w-4 text-violet-600 dark:text-violet-400" aria-hidden="true" />Sessões presenciais</CardTitle>
                <p className="text-sm text-slate-500 dark:text-slate-400">{inscrito ? 'Inscreva-se numa sessão; a presença, marcada pelo formador, conclui a aula presencial.' : 'Inscreva-se no curso para se poder inscrever numa sessão.'}</p>
              </CardHeader>
              <CardContent className="pt-0"><SessoesAluno cursoId={cursoId} matricula={matricula} /></CardContent>
            </Card>
          )}

          {quizzes.length > 0 && (
            <Card className="border-violet-200 dark:border-violet-900 dark:bg-slate-900">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base"><ClipboardList className="h-4 w-4 text-violet-600 dark:text-violet-400" aria-hidden="true" />Avaliação</CardTitle>
                {avaliacaoObrigatoria && <p className="text-sm text-slate-500 dark:text-slate-400">O curso conclui, e o certificado é emitido, ao aprovar na avaliação.</p>}
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {quizzes.map(q => {
                  const bloqueada = !inscrito || (q.requer_aulas_concluidas !== false && !todasFeitas && !concluido);
                  return (
                    <div key={q.id} className="flex flex-col gap-3 rounded-lg border p-3 dark:border-slate-700 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-900 dark:text-slate-100">{q.titulo}</p>
                        <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                          <span>Nota mínima {q.nota_minima}%</span>
                          <span>{q.tentativas_max ? `${q.tentativas_max} ${q.tentativas_max === 1 ? 'tentativa' : 'tentativas'}` : 'Tentativas ilimitadas'}</span>
                          {q.tempo_limite_min && <span className="inline-flex items-center gap-1"><Timer className="h-3 w-3" aria-hidden="true" />{q.tempo_limite_min} min</span>}
                          {q.modo_sem_consulta && <span>Sem consulta</span>}
                        </p>
                        {bloqueada && inscrito && <p className="mt-1 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400"><Lock className="h-3 w-3" aria-hidden="true" />Conclua todas as aulas para desbloquear.</p>}
                      </div>
                      <Button onClick={() => onAbrirQuiz?.(q.id)} disabled={bloqueada} variant={todasFeitas && !concluido ? 'default' : 'outline'}>
                        {concluido ? 'Ver avaliação' : 'Fazer avaliação'}<ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Cartão lateral (acção) ──────────────────────────── */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <Card className="overflow-hidden dark:border-slate-800 dark:bg-slate-900">
            <div className={`relative aspect-video w-full bg-gradient-to-br ${grad}`}>
              {curso.capa_url ? <img src={curso.capa_url} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <BookOpen className="absolute inset-0 m-auto h-12 w-12 text-white/70" aria-hidden="true" />}
            </div>
            <CardContent className="space-y-4 p-5">
              {inscrito ? (
                <>
                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-900 dark:text-slate-100">{concluido ? 'Curso concluído' : 'O seu progresso'}</span>
                      <span className="tabular-nums text-slate-600 dark:text-slate-300">{pct}%</span>
                    </div>
                    <Progress value={pct} className="h-2" aria-label={`Progresso ${pct}%`} />
                    <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{nFeitas} de {total} aulas concluídas</p>
                  </div>
                  {total > 0 && (
                    concluido ? (
                      <Button className="w-full" variant="outline" onClick={() => onAbrirAula(sequencia[0].id)}>
                        <RotateCcw className="h-4 w-4" aria-hidden="true" />Rever desde o início
                      </Button>
                    ) : todasFeitas && quizzes.length > 0 ? (
                      <Button className="w-full" size="lg" onClick={() => onAbrirQuiz?.(quizzes[0].id)}>
                        <ClipboardList className="h-4 w-4" aria-hidden="true" />Fazer a avaliação
                      </Button>
                    ) : (
                      <Button className="w-full" size="lg" onClick={() => onAbrirAula(proxima.id)}>
                        {nFeitas > 0 ? 'Continuar' : 'Começar o curso'}<ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    )
                  )}
                  {nFeitas > 0 && !concluido && proxima && (
                    <p className="text-center text-xs text-slate-500 dark:text-slate-400">Próxima: <span className="font-medium text-slate-700 dark:text-slate-300">{proxima.titulo}</span></p>
                  )}
                </>
              ) : (
                <>
                  <Button className="w-full" size="lg" onClick={() => onInscrever(curso)} disabled={inscrevendo || total === 0}>
                    {inscrevendo ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}Inscrever-se
                  </Button>
                  <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                    {total === 0 ? 'Disponível assim que o instrutor publicar as aulas.' : 'Acesso imediato · avance ao seu ritmo'}
                  </p>
                </>
              )}

              <dl className="space-y-2 border-t pt-4 text-sm dark:border-slate-800">
                {curso.instrutor_nome && <Facto icon={User} label="Instrutor" value={curso.instrutor_nome} />}
                {curso.carga_horaria && <Facto icon={Clock} label="Carga horária" value={`${fmtHoras(curso.carga_horaria)} · ${total} aulas`} />}
                {curso.nivel && <Facto icon={Layers} label="Nível" value={NIVEL_LABEL[curso.nivel] || curso.nivel} />}
                {matricula?.created_date && <Facto icon={Calendar} label="Inscrito em" value={fmtData(matricula.created_date)} />}
                {matricula?.concluido_em && <Facto icon={Award} label="Concluído em" value={fmtData(matricula.concluido_em)} />}
                {matricula?.valido_ate && <Facto icon={Calendar} label="Válido até" value={fmtData(matricula.valido_ate)} />}
                {!matricula?.valido_ate && curso.validade_meses && <Facto icon={Calendar} label="Validade" value={`${curso.validade_meses} meses após conclusão`} />}
                {(matricula?.ciclo || 1) > 1 && <Facto icon={RotateCcw} label="Ciclo" value={`${matricula.ciclo}.ª certificação`} />}
              </dl>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Facto({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
      <dt className="w-28 shrink-0 text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="min-w-0 flex-1 font-medium text-slate-800 dark:text-slate-200">{value}</dd>
    </div>
  );
}
