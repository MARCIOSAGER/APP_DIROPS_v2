import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import Select from '@/components/ui/select';
import { GraduationCap, Search, BookOpen, CheckCircle2, Award, ListChecks, ArrowRight, RefreshCw, Compass, PlayCircle, Route, AlertTriangle, RotateCcw, PanelLeftOpen, PanelLeftClose, Globe } from 'lucide-react';
import { useModoFoco, setModoFoco, preferenciaModoFoco, guardarPreferenciaModoFoco } from '@/lib/modoFoco';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { PageLoading } from '@/components/ui/loading-spinner';
import {
  useCursosPublicados, useAulasResumo, useMinhasMatriculas, useMeuProgresso, useMeusCertificados, useFormacaoMutations, useTrilhasAluno,
} from '@/hooks/useFormacao';
import { cursoObrigatorioPara, estadoFormacao, ESTADOS, refrescamentosDe } from '@/lib/formacaoEstado';
import TrilhasAluno from '@/components/formacao/TrilhasAluno';
import CursoCard from '@/components/formacao/CursoCard';
import CursoDetalhe from '@/components/formacao/CursoDetalhe';
import AulaPlayer from '@/components/formacao/AulaPlayer';
import GamificacaoAluno from '@/components/formacao/GamificacaoAluno';
import CertificadosTab from '@/components/formacao/CertificadosTab';
import QuizPlayer from '@/components/formacao/quiz/QuizPlayer';
import { useQuizzesCurso } from '@/hooks/useQuizGestao';
import { gradienteCategoria, NIVEL_LABEL } from '@/components/formacao/formacaoUtils';

const TABS = ['catalogo', 'meus', 'trilhas', 'certificados'];

// Universidade Corporativa — área do aluno.
// Estado de navegação vive na URL (?tab= | ?curso= | ?curso=&aula=) para deep-link e botão "voltar".
export default function Formacao({ portal = false }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const cursoId = params.get('curso');
  const aulaId = params.get('aula');
  const quizId = params.get('quiz');
  // modo foco: numa aula ou avaliação escondem-se os menus da aplicação (preferência do utilizador)
  const emAula = !!(cursoId && (aulaId || quizId));
  useEffect(() => { if (!emAula) { setModoFoco(false); return undefined; } setModoFoco(preferenciaModoFoco()); return () => setModoFoco(false); }, [emAula]);
  const tab = TABS.includes(params.get('tab')) ? params.get('tab') : 'catalogo';
  const email = user?.email;
  const { data: quizzesCurso = [] } = useQuizzesCurso(cursoId, { apenasAtivos: true });

  const cursosQ = useCursosPublicados();
  const resumoQ = useAulasResumo();
  const matriculasQ = useMinhasMatriculas(email);
  const matriculas = matriculasQ.data || [];
  const matriculaIds = useMemo(() => matriculas.map(m => m.id), [matriculas]);
  const progressoQ = useMeuProgresso(email, matriculaIds);
  const certificadosQ = useMeusCertificados(email);
  const trilhasQ = useTrilhasAluno();
  const trilhas = trilhasQ.data?.trilhas || [];
  const trilhaCursos = trilhasQ.data?.trilhaCursos || [];
  const { inscrever, marcarAula, desmarcarAula, recertificar } = useFormacaoMutations(user);

  const cursos = cursosQ.data || [];
  const resumo = resumoQ.data || {};
  const progresso = progressoQ.data || [];
  const certificados = certificadosQ.data || [];
  const cursosById = useMemo(() => Object.fromEntries(cursos.map(c => [c.id, c])), [cursos]);
  const matriculaPorCurso = useMemo(() => Object.fromEntries(matriculas.map(m => [m.curso_id, m])), [matriculas]);

  const [inscrevendoId, setInscrevendoId] = useState(null);
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState('todas');
  const [nivel, setNivel] = useState('todos');

  // ── navegação ────────────────────────────────────────────────────────────
  const irTab = useCallback((t) => setParams(t === 'catalogo' ? {} : { tab: t }, { replace: true }), [setParams]);
  const abrirCurso = useCallback((c) => setParams({ curso: c.id }), [setParams]);
  const abrirAula = useCallback((cId, aId) => setParams({ curso: cId, aula: aId }), [setParams]);
  const voltarCatalogo = useCallback(() => setParams({}), [setParams]);

  const handleInscrever = useCallback(async (curso, abrirDepois = false) => {
    if (inscrevendoId) return;
    setInscrevendoId(curso.id);
    try {
      await inscrever(curso);
      toast({ title: 'Inscrição concluída', description: `Já pode começar "${curso.titulo}".` });
      if (abrirDepois) abrirCurso(curso);
    } catch (e) {
      toast({ title: 'Não foi possível inscrever-se', description: e?.message || String(e), variant: 'destructive' });
    } finally {
      setInscrevendoId(null);
    }
  }, [inscrevendoId, inscrever, toast, abrirCurso]);

  const [recertificandoId, setRecertificandoId] = useState(null);
  // Recertificar: se existir um curso de refrescamento publicado, o aluno faz esse (mais curto) e a
  // conclusão renova o curso inicial; senão, reabre o próprio curso num novo ciclo.
  const handleRecertificar = useCallback(async (curso) => {
    const m = matriculaPorCurso[curso.id];
    if (recertificandoId) return;
    const refr = refrescamentosDe(curso.id, cursos).find(r => r.publicado) || null;
    if (!refr && !m) return;
    setRecertificandoId(curso.id);
    try {
      if (refr) {
        const mr = matriculaPorCurso[refr.id];
        if (!mr) await inscrever({ ...refr, _origem: 'recertificacao' });
        else if (mr.estado === 'concluido') await recertificar(mr);
        toast({ title: 'Refrescamento', description: `Vai fazer "${refr.titulo}" para renovar "${curso.titulo}".` });
        abrirCurso(refr);
      } else {
        await recertificar(m);
        toast({ title: 'Recertificação iniciada', description: `Novo ciclo de "${curso.titulo}". Boa formação!` });
        abrirCurso(curso);
      }
    } catch (e) {
      toast({ title: 'Não foi possível iniciar a recertificação', description: e?.message || String(e), variant: 'destructive' });
    } finally {
      setRecertificandoId(null);
    }
  }, [matriculaPorCurso, recertificandoId, recertificar, inscrever, cursos, toast, abrirCurso]);

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ['trilha'] });
    qc.invalidateQueries({ queryKey: ['curso'] });
    qc.invalidateQueries({ queryKey: ['aula'] });
    qc.invalidateQueries({ queryKey: ['matricula'] });
    qc.invalidateQueries({ queryKey: ['progresso_aula'] });
    qc.invalidateQueries({ queryKey: ['certificado'] });
  };

  // ── derivados ────────────────────────────────────────────────────────────
  const categorias = useMemo(() => [...new Set(cursos.map(c => c.categoria).filter(Boolean))].sort(), [cursos]);
  const niveis = useMemo(() => [...new Set(cursos.map(c => c.nivel).filter(Boolean))], [cursos]);
  const cursosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return cursos.filter(c =>
      (categoria === 'todas' || c.categoria === categoria) &&
      (nivel === 'todos' || c.nivel === nivel) &&
      (!q || [c.titulo, c.descricao, c.categoria, c.instrutor_nome].some(v => String(v || '').toLowerCase().includes(q))),
    );
  }, [cursos, busca, categoria, nivel]);

  // Obrigatoriedade + validade por curso (para badges, secção "Formação obrigatória" e recertificação).
  const infoCurso = useMemo(() => {
    const out = {};
    for (const c of cursos) {
      const obrigatorio = cursoObrigatorioPara(c, user, { trilhas, trilhaCursos });
      const refrescamentos = refrescamentosDe(c.id, cursos).map(r => matriculaPorCurso[r.id]).filter(Boolean);
      out[c.id] = { obrigatorio, ...estadoFormacao(c, matriculaPorCurso[c.id], { obrigatorio, refrescamentos }) };
    }
    return out;
  }, [cursos, user, trilhas, trilhaCursos, matriculaPorCurso]);
  const pendenciasObrig = useMemo(() => cursos
    .filter(c => ['em_falta', 'expirado', 'a_expirar', 'atrasado'].includes(infoCurso[c.id]?.estado) && (infoCurso[c.id]?.obrigatorio || matriculaPorCurso[c.id]))
    .sort((a, b) => (ESTADOS[infoCurso[a.id].estado].ordem - ESTADOS[infoCurso[b.id].estado].ordem)), [cursos, infoCurso, matriculaPorCurso]);

  const emCurso = matriculas.filter(m => m.estado === 'ativo' && cursosById[m.curso_id]);
  const concluidos = matriculas.filter(m => m.estado === 'concluido' && cursosById[m.curso_id]);
  const certsValidos = certificados.filter(c => !c.revogado_em);
  const certPorMatricula = new Set(certificados.map(c => c.matricula_id).filter(Boolean));
  const pendentes = concluidos.filter(m => !certPorMatricula.has(m.id)).map(m => ({ matricula: m, curso: cursosById[m.curso_id] }));

  // "Continuar a aprender": matrícula activa mais recente + próxima aula por fazer.
  const continuar = useMemo(() => {
    const m = [...emCurso].sort((a, b) => String(b.updated_date || '').localeCompare(String(a.updated_date || '')))[0];
    if (!m) return null;
    const curso = cursosById[m.curso_id];
    const ids = resumo[m.curso_id]?.ids || [];
    const feitas = new Set(progresso.filter(p => p.matricula_id === m.id).map(p => p.aula_id));
    const proximaId = ids.find(id => !feitas.has(id)) || null;
    const nFeitas = ids.filter(id => feitas.has(id)).length;
    return { matricula: m, curso, proximaId, nFeitas, total: ids.length };
  }, [emCurso, cursosById, resumo, progresso]);

  if (!user) return <PageLoading label="A carregar…" />;

  const carregando = cursosQ.isLoading || matriculasQ.isLoading;
  const matriculaAtual = cursoId ? matriculaPorCurso[cursoId] : null;
  const progressoAtual = matriculaAtual ? progresso.filter(p => p.matricula_id === matriculaAtual.id) : [];

  return (
    <div className={portal ? '' : 'min-h-screen bg-slate-50 p-4 dark:bg-slate-950 md:p-6'}>
      <div className={portal ? 'space-y-6' : 'mx-auto max-w-7xl space-y-6'}>
        {emAula && <BarraFoco />}
        {cursoId && quizId ? (
          <QuizPlayer
            key={quizId}
            quizId={quizId}
            matricula={matriculaAtual}
            onVoltarCurso={() => setParams({ curso: cursoId })}
            onVerCertificados={() => irTab('certificados')}
          />
        ) : cursoId && aulaId ? (
          <AulaPlayer
            cursoId={cursoId}
            aulaId={aulaId}
            matricula={matriculaAtual}
            progresso={progressoAtual}
            quizzes={quizzesCurso}
            onIrParaAula={(aId) => abrirAula(cursoId, aId)}
            onIrParaQuiz={(qId) => setParams({ curso: cursoId, quiz: qId })}
            onVoltarCurso={() => setParams({ curso: cursoId })}
            onVerCertificados={() => irTab('certificados')}
            marcarAula={marcarAula}
            desmarcarAula={desmarcarAula}
          />
        ) : cursoId ? (
          <CursoDetalhe
            cursoId={cursoId}
            matricula={matriculaAtual}
            progresso={progressoAtual}
            quizzes={quizzesCurso}
            info={infoCurso[cursoId]}
            onVoltar={voltarCatalogo}
            onAbrirAula={(aId) => abrirAula(cursoId, aId)}
            onAbrirQuiz={(qId) => setParams({ curso: cursoId, quiz: qId })}
            onInscrever={(c) => handleInscrever(c)}
            onRecertificar={handleRecertificar}
            inscrevendo={inscrevendoId === cursoId}
            recertificando={recertificandoId === cursoId}
          />
        ) : (
          <>
            {/* ── Cabeçalho (só fora do portal — o portal tem a sua própria moldura) ── */}
            {!portal && (
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="flex items-center gap-3 text-2xl font-bold text-slate-900 dark:text-slate-100 md:text-3xl">
                  <GraduationCap className="h-8 w-8 text-violet-600 dark:text-violet-400" aria-hidden="true" />
                  Universidade Corporativa
                </h1>
                <p className="mt-1 text-slate-600 dark:text-slate-400">Formação ao seu ritmo: cursos, procedimentos e certificados da SGA.</p>
              </div>
              <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline"><a href="/universidade"><Globe className="h-4 w-4" aria-hidden="true" />Site da Universidade</a></Button>
              <Button variant="outline" onClick={refrescar} disabled={carregando} aria-label="Actualizar">
                <RefreshCw className={`h-4 w-4 ${carregando ? 'animate-spin' : ''}`} aria-hidden="true" />Actualizar
              </Button>
              </div>
            </div>
            )}

            {/* ── Indicadores ────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Tile icon={PlayCircle} cor="text-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-400" label="Em curso" valor={emCurso.length} loading={carregando} />
              <Tile icon={CheckCircle2} cor="text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400" label="Concluídos" valor={concluidos.length} loading={carregando} />
              <Tile icon={ListChecks} cor="text-cyan-600 bg-cyan-50 dark:bg-cyan-950/40 dark:text-cyan-400" label="Aulas concluídas" valor={progresso.length} loading={carregando || progressoQ.isLoading} />
              <Tile icon={Award} cor="text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400" label="Certificados" valor={certsValidos.length} loading={certificadosQ.isLoading} />
            </div>

            {/* ── Formação obrigatória / validade ────────────── */}
            {pendenciasObrig.length > 0 && (
              <Card className="border-amber-200 dark:border-amber-900 dark:bg-slate-900">
                <CardContent className="space-y-3 p-4 md:p-5">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden="true" />
                    <p className="font-semibold text-slate-900 dark:text-slate-100">Formação obrigatória e certificações a tratar</p>
                  </div>
                  <ul className="divide-y dark:divide-slate-800">
                    {pendenciasObrig.map(c => {
                      const info = infoCurso[c.id]; const e = ESTADOS[info.estado];
                      const cor = e.cor === 'red' ? 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200';
                      const detalhe = info.estado === 'a_expirar' ? `expira em ${info.dias} dias` : info.estado === 'expirado' ? 'validade terminada' : info.estado === 'atrasado' ? `prazo ultrapassado há ${Math.abs(info.dias)} dias` : 'obrigatório para a sua função';
                      return (
                        <li key={c.id} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-slate-900 dark:text-slate-100">{c.titulo}</p>
                            <p className="text-xs"><span className={`rounded px-1.5 py-0.5 font-medium ${cor}`}>{e.label}</span><span className="ml-2 text-slate-500 dark:text-slate-400">{detalhe}</span></p>
                          </div>
                          {info.estado === 'em_falta' ? (
                            <Button size="sm" onClick={() => handleInscrever({ ...c, _origem: 'obrigatorio' }, true)} disabled={inscrevendoId === c.id}>Inscrever-me<ArrowRight className="h-4 w-4" aria-hidden="true" /></Button>
                          ) : info.estado === 'atrasado' ? (
                            <Button size="sm" onClick={() => abrirCurso(c)}>Continuar<ArrowRight className="h-4 w-4" aria-hidden="true" /></Button>
                          ) : (
                            <Button size="sm" onClick={() => handleRecertificar(c)} disabled={recertificandoId === c.id}><RotateCcw className="h-4 w-4" aria-hidden="true" />Recertificar</Button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* ── Continuar a aprender ───────────────────────── */}
            {continuar?.curso && (
              <Card className="overflow-hidden border-0 shadow-md">
                <div className={`bg-gradient-to-r ${gradienteCategoria(continuar.curso.categoria)} p-5 text-white md:p-6`}>
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/80">Continuar a aprender</p>
                  <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-xl font-bold leading-tight md:text-2xl">{continuar.curso.titulo}</h2>
                      <p className="mt-1 text-sm text-white/85">{continuar.nFeitas} de {continuar.total} aulas concluídas</p>
                      <div className="mt-3 flex items-center gap-3">
                        <Progress value={continuar.total ? Math.round((continuar.nFeitas / continuar.total) * 100) : 0} className="h-2 max-w-xs flex-1 bg-white/25 [&>div]:bg-white" />
                        <span className="text-sm font-medium tabular-nums">{Math.round(Number(continuar.matricula.progresso_pct) || 0)}%</span>
                      </div>
                    </div>
                    <Button
                      size="lg"
                      className="bg-white text-slate-900 hover:bg-white/90"
                      onClick={() => continuar.proximaId ? abrirAula(continuar.curso.id, continuar.proximaId) : abrirCurso(continuar.curso)}
                    >
                      Retomar<ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {/* ── Separadores ────────────────────────────────── */}
            <Tabs value={tab} onValueChange={irTab}>
              <TabsList className="h-auto w-full justify-start overflow-x-auto sm:w-auto">
                <TabsTrigger value="catalogo" className="gap-1.5 py-1.5"><Compass className="h-4 w-4" aria-hidden="true" />Catálogo<Contagem n={cursos.length} /></TabsTrigger>
                <TabsTrigger value="meus" className="gap-1.5 py-1.5"><BookOpen className="h-4 w-4" aria-hidden="true" />Os meus cursos<Contagem n={matriculas.length} /></TabsTrigger>
                <TabsTrigger value="trilhas" className="gap-1.5 py-1.5"><Route className="h-4 w-4" aria-hidden="true" />Trilhas<Contagem n={trilhas.length} /></TabsTrigger>
                <TabsTrigger value="certificados" className="gap-1.5 py-1.5"><Award className="h-4 w-4" aria-hidden="true" />Certificados<Contagem n={certsValidos.length} /></TabsTrigger>
              </TabsList>

              {/* Catálogo */}
              <TabsContent value="catalogo" className="mt-4 space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                    <Input
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Pesquisar cursos…"
                      aria-label="Pesquisar cursos"
                      className="pl-9 dark:bg-slate-900"
                    />
                  </div>
                  {categorias.length > 0 && (
                    <div className="w-full md:w-56">
                      <Select
                        value={categoria}
                        onValueChange={setCategoria}
                        placeholder="Categoria"
                        searchable={false}
                        options={[{ value: 'todas', label: 'Todas as categorias' }, ...categorias.map(c => ({ value: c, label: c }))]}
                      />
                    </div>
                  )}
                  {niveis.length > 1 && (
                    <div className="w-full md:w-48">
                      <Select
                        value={nivel}
                        onValueChange={setNivel}
                        placeholder="Nível"
                        searchable={false}
                        options={[{ value: 'todos', label: 'Todos os níveis' }, ...niveis.map(n => ({ value: n, label: NIVEL_LABEL[n] || n }))]}
                      />
                    </div>
                  )}
                </div>

                {cursosQ.isLoading ? (
                  <GrelhaSkeleton />
                ) : cursosQ.isError ? (
                  <Vazio icone={BookOpen} titulo="Não foi possível carregar o catálogo" texto={cursosQ.error?.message} accao={<Button variant="outline" onClick={() => cursosQ.refetch()}>Tentar novamente</Button>} />
                ) : cursos.length === 0 ? (
                  <Vazio icone={BookOpen} titulo="O catálogo ainda está vazio" texto="Os cursos publicados pela Gestão de Formação aparecem aqui." />
                ) : cursosFiltrados.length === 0 ? (
                  <Vazio icone={Search} titulo="Nenhum curso corresponde à pesquisa" texto="Experimente outras palavras ou limpe os filtros." accao={<Button variant="outline" onClick={() => { setBusca(''); setCategoria('todas'); setNivel('todos'); }}>Limpar filtros</Button>} />
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {cursosFiltrados.map(c => (
                      <CursoCard
                        key={c.id}
                        curso={c}
                        resumo={resumo[c.id]}
                        matricula={matriculaPorCurso[c.id]}
                        info={infoCurso[c.id]}
                        onAbrir={abrirCurso}
                        onInscrever={(curso) => handleInscrever(curso, true)}
                        onRecertificar={handleRecertificar}
                        inscrevendo={inscrevendoId === c.id}
                        recertificando={recertificandoId === c.id}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Os meus cursos */}
              <TabsContent value="meus" className="mt-4 space-y-6">
                {matriculas.length > 0 && <GamificacaoAluno email={user?.email} />}
                {matriculasQ.isLoading ? (
                  <GrelhaSkeleton />
                ) : matriculas.length === 0 ? (
                  <Vazio icone={BookOpen} titulo="Ainda não está inscrito em nenhum curso" texto="Escolha um curso no catálogo e comece hoje." accao={<Button onClick={() => irTab('catalogo')}><Compass className="h-4 w-4" aria-hidden="true" />Explorar o catálogo</Button>} />
                ) : (
                  <>
                    <Seccao titulo="Em curso" n={emCurso.length}>
                      {emCurso.length === 0
                        ? <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum curso em andamento.</p>
                        : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{emCurso.map(m => <CursoCard key={m.id} curso={cursosById[m.curso_id]} resumo={resumo[m.curso_id]} matricula={m} info={infoCurso[m.curso_id]} onAbrir={abrirCurso} onInscrever={() => {}} onRecertificar={handleRecertificar} />)}</div>}
                    </Seccao>
                    <Seccao titulo="Concluídos" n={concluidos.length}>
                      {concluidos.length === 0
                        ? <p className="text-sm text-slate-500 dark:text-slate-400">Ainda não concluiu nenhum curso.</p>
                        : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{concluidos.map(m => <CursoCard key={m.id} curso={cursosById[m.curso_id]} resumo={resumo[m.curso_id]} matricula={m} info={infoCurso[m.curso_id]} onAbrir={abrirCurso} onInscrever={() => {}} onRecertificar={handleRecertificar} recertificando={recertificandoId === m.curso_id} />)}</div>}
                    </Seccao>
                  </>
                )}
              </TabsContent>

              {/* Trilhas */}
              <TabsContent value="trilhas" className="mt-4">
                <TrilhasAluno trilhas={trilhas} trilhaCursos={trilhaCursos} cursosById={cursosById} matriculaPorCurso={matriculaPorCurso} user={user} onAbrirCurso={abrirCurso} onInscrever={(c) => handleInscrever(c, true)} inscrevendoId={inscrevendoId} />
              </TabsContent>

              {/* Certificados */}
              <TabsContent value="certificados" className="mt-4">
                <CertificadosTab
                  certificados={certificados}
                  pendentes={pendentes}
                  loading={certificadosQ.isLoading}
                  onExplorar={() => irTab('catalogo')}
                  onAbrirCurso={abrirCurso}
                />
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}

// Barra discreta para ligar/desligar o modo foco (menus escondidos) durante a aula/avaliação.
function BarraFoco() {
  const foco = useModoFoco();
  const alternar = () => { setModoFoco(!foco); guardarPreferenciaModoFoco(!foco); };
  return (
    <div className="-mb-3 flex items-center justify-end">
      <Button variant="ghost" size="sm" onClick={alternar} className="h-7 gap-1.5 px-2 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100" aria-pressed={foco} title={foco ? 'Voltar a mostrar o menu e o cabeçalho da aplicação' : 'Esconder o menu e o cabeçalho para se concentrar na aula'}>
        {foco ? <PanelLeftOpen className="h-3.5 w-3.5" aria-hidden="true" /> : <PanelLeftClose className="h-3.5 w-3.5" aria-hidden="true" />}{foco ? 'Mostrar menus' : 'Modo foco'}
      </Button>
    </div>
  );
}

function Tile({ icon: Icon, cor, label, valor, loading }) {
  return (
    <Card className="dark:border-slate-800 dark:bg-slate-900">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${cor}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{label}</p>
          {loading ? <Skeleton className="mt-1 h-6 w-10" /> : <p className="text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{valor}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function Contagem({ n }) {
  if (!n) return null;
  return <span className="ml-0.5 rounded-full bg-slate-200 px-1.5 text-[11px] font-semibold tabular-nums text-slate-700 dark:bg-slate-700 dark:text-slate-200">{n}</span>;
}

function Seccao({ titulo, n, children }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{titulo} <span className="font-normal text-slate-500 dark:text-slate-400">({n})</span></h2>
      {children}
    </section>
  );
}

function Vazio({ icone: Icon, titulo, texto, accao }) {
  return (
    <Card className="dark:border-slate-800 dark:bg-slate-900">
      <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
          <Icon className="h-7 w-7 text-slate-400" aria-hidden="true" />
        </div>
        <p className="font-medium text-slate-900 dark:text-slate-100">{titulo}</p>
        {texto && <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">{texto}</p>}
        {accao}
      </CardContent>
    </Card>
  );
}

function GrelhaSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map(i => (
        <Card key={i} className="overflow-hidden dark:border-slate-800 dark:bg-slate-900">
          <Skeleton className="aspect-video w-full rounded-none" />
          <CardContent className="space-y-2 p-4"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-full" /><Skeleton className="h-9 w-full" /></CardContent>
        </Card>
      ))}
    </div>
  );
}
