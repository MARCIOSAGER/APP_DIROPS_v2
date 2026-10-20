import React, { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Presentation, Plus, Search, BookOpen, Pencil, Trash2, Award, PenLine, Layers, Users, GraduationCap, ShieldAlert, Loader2, HelpCircle, Grid3x3, Route, LayoutDashboard, ShieldCheck } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { PageLoading } from '@/components/ui/loading-spinner';
import { hasUserProfile, isAdminProfile } from '@/components/lib/userUtils';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { Curso } from '@/entities/Curso';
import { createPageUrl } from '@/utils';
import { useTodosCursos, useEstatisticasCursos } from '@/hooks/useGestaoFormacao';
import { gradienteCategoria, NIVEL_LABEL, fmtHoras, podeEditarCurso, nomeResponsavel } from '@/components/formacao/formacaoUtils';
import CursoForm from '@/components/formacao/gestao/CursoForm';
import CursoEditor from '@/components/formacao/gestao/CursoEditor';
import CertificadosEmitidos from '@/components/formacao/gestao/CertificadosEmitidos';
import AssinantesGlobais from '@/components/formacao/gestao/AssinantesGlobais';
import BancoPerguntas from '@/components/formacao/quiz/BancoPerguntas';
import MatrizFormacao from '@/components/formacao/gestao/MatrizFormacao';
import TrilhasGestao from '@/components/formacao/gestao/TrilhasGestao';
import FichaAluno from '@/components/formacao/gestao/FichaAluno';
import AlunosGestao from '@/components/formacao/gestao/AlunosGestao';
import VisaoGeral from '@/components/formacao/gestao/VisaoGeral';
import InstrutoresGestao from '@/components/formacao/gestao/InstrutoresGestao';

const TABS = ['geral', 'cursos', 'alunos', 'matriz', 'trilhas', 'perguntas', 'certificados', 'assinantes', 'instrutores'];

// Gestão de Formação (instrutor/admin): cursos, certificados emitidos e signatários.
// Estado na URL: ?tab= | ?curso=<id>&ctab=conteudo|alunos|certificado
export default function GestaoFormacao({ portal = false }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const cursoId = params.get('curso');
  const alunoEmail = params.get('aluno');
  const ctab = params.get('ctab') || 'conteudo';
  const tab = TABS.includes(params.get('tab')) ? params.get('tab') : 'geral';

  const cursosQ = useTodosCursos();
  const statsQ = useEstatisticasCursos();
  const cursos = cursosQ.data || [];
  const stats = statsQ.data || {};

  const [form, setForm] = useState({ open: false, curso: null });
  const [confirm, setConfirm] = useState(null);
  const [busca, setBusca] = useState('');
  const [ocupado, setOcupado] = useState(null);

  const podeGerir = !!user && (isAdminProfile(user) || hasUserProfile(user, 'instrutor'));
  const categorias = useMemo(() => [...new Set(cursos.map(c => c.categoria).filter(Boolean))].sort(), [cursos]);

  const irTab = useCallback((t) => setParams(t === 'geral' ? {} : { tab: t }, { replace: true }), [setParams]);
  const abrirCurso = useCallback((id, t = 'conteudo') => setParams({ curso: id, ctab: t }), [setParams]);
  const refrescar = () => Promise.all([qc.invalidateQueries({ queryKey: ['curso'] }), qc.invalidateQueries({ queryKey: ['matricula'] }), qc.invalidateQueries({ queryKey: ['aula'] })]);

  const publicar = async (c, v) => {
    setOcupado(c.id);
    try {
      await Curso.update(c.id, { publicado: !!v, updated_by: user?.email || null });
      toast({ title: v ? 'Curso publicado' : 'Curso passou a rascunho', description: c.titulo });
      await refrescar();
    } catch (e) { toast({ title: 'Não foi possível actualizar', description: e?.message, variant: 'destructive' }); }
    finally { setOcupado(null); }
  };

  const apagar = async () => {
    const c = confirm; setConfirm(null); setOcupado(c.id);
    try {
      await Curso.update(c.id, { deleted_at: new Date().toISOString(), publicado: false, updated_by: user?.email || null });
      toast({ title: 'Curso apagado', description: c.titulo });
      await refrescar();
    } catch (e) { toast({ title: 'Não foi possível apagar', description: e?.message, variant: 'destructive' }); }
    finally { setOcupado(null); }
  };

  if (!user) return <PageLoading label="A carregar…" />;

  if (!podeGerir) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 dark:bg-slate-950">
        <Card className="mx-auto max-w-lg dark:border-slate-800 dark:bg-slate-900"><CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <ShieldAlert className="h-8 w-8 text-amber-500" aria-hidden="true" />
          <p className="font-medium text-slate-900 dark:text-slate-100">Sem permissão para gerir formação</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">Esta área é para administradores e utilizadores com o perfil "instrutor".</p>
          <Button asChild variant="outline"><a href={portal ? '/universidade' : createPageUrl('Formacao')}><GraduationCap className="h-4 w-4" aria-hidden="true" />Ir para a Universidade Corporativa</a></Button>
        </CardContent></Card>
      </div>
    );
  }

  const q = busca.trim().toLowerCase();
  const lista = cursos.filter(c => !q || [c.titulo, c.categoria, c.instrutor_nome].some(v => String(v || '').toLowerCase().includes(q)));
  const nPublicados = cursos.filter(c => c.publicado).length;

  return (
    <div className={portal ? '' : 'min-h-screen bg-slate-50 p-4 dark:bg-slate-950 md:p-6'}>
      <div className={portal ? 'space-y-6' : 'mx-auto max-w-7xl space-y-6'}>
        {alunoEmail ? (
          <FichaAluno email={alunoEmail} user={user} onVoltar={() => setParams(cursoId ? { curso: cursoId, ctab: 'alunos' } : { tab: 'alunos' })} onAbrirCurso={(id) => setParams({ curso: id, ctab: 'alunos' })} />
        ) : cursoId ? (
          <CursoEditor cursoId={cursoId} tab={ctab} onTab={(t) => setParams({ curso: cursoId, ctab: t }, { replace: true })} user={user} onVoltar={() => setParams({ tab: 'cursos' })} />
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="flex items-center gap-3 text-2xl font-bold text-slate-900 dark:text-slate-100 md:text-3xl">
                  <Presentation className="h-8 w-8 text-violet-700 dark:text-violet-400" aria-hidden="true" />
                  Gestão de Formação
                </h1>
                <p className="mt-1 text-slate-600 dark:text-slate-400">Crie cursos, organize módulos e aulas, acompanhe alunos e emita certificados.</p>
              </div>
              <div className="flex gap-2">
                <Button asChild variant="outline"><a href={portal ? '/universidade' : createPageUrl('Formacao')}><GraduationCap className="h-4 w-4" aria-hidden="true" />Ver como aluno</a></Button>
                <Button onClick={() => setForm({ open: true, curso: null })}><Plus className="h-4 w-4" aria-hidden="true" />Novo curso</Button>
              </div>
            </div>

            <Tabs value={tab} onValueChange={irTab}>
              <TabsList className="h-auto w-full justify-start overflow-x-auto sm:w-auto">
                <TabsTrigger value="geral" className="gap-1.5 py-1.5"><LayoutDashboard className="h-4 w-4" aria-hidden="true" />Visão geral</TabsTrigger>
                <TabsTrigger value="cursos" className="gap-1.5 py-1.5"><BookOpen className="h-4 w-4" aria-hidden="true" />Cursos{cursos.length > 0 && <span className="ml-0.5 rounded-full bg-slate-200 px-1.5 text-[11px] font-semibold tabular-nums text-slate-700 dark:bg-slate-700 dark:text-slate-200">{cursos.length}</span>}</TabsTrigger>
                <TabsTrigger value="alunos" className="gap-1.5 py-1.5"><Users className="h-4 w-4" aria-hidden="true" />Alunos</TabsTrigger>
                <TabsTrigger value="matriz" className="gap-1.5 py-1.5"><Grid3x3 className="h-4 w-4" aria-hidden="true" />Matriz</TabsTrigger>
                <TabsTrigger value="trilhas" className="gap-1.5 py-1.5"><Route className="h-4 w-4" aria-hidden="true" />Trilhas</TabsTrigger>
                <TabsTrigger value="perguntas" className="gap-1.5 py-1.5"><HelpCircle className="h-4 w-4" aria-hidden="true" />Banco de perguntas</TabsTrigger>
                <TabsTrigger value="certificados" className="gap-1.5 py-1.5"><Award className="h-4 w-4" aria-hidden="true" />Certificados</TabsTrigger>
                <TabsTrigger value="assinantes" className="gap-1.5 py-1.5"><PenLine className="h-4 w-4" aria-hidden="true" />Signatários</TabsTrigger>
                {isAdminProfile(user) && <TabsTrigger value="instrutores" className="gap-1.5 py-1.5"><ShieldCheck className="h-4 w-4" aria-hidden="true" />Instrutores</TabsTrigger>}
              </TabsList>

              <TabsContent value="geral" className="mt-4"><VisaoGeral user={user} onAbrirCurso={abrirCurso} onIrTab={irTab} /></TabsContent>
              <TabsContent value="cursos" className="mt-4 space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-600 dark:text-slate-400">{nPublicados} publicados · {cursos.length - nPublicados} rascunhos</p>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                    <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar cursos…" aria-label="Pesquisar cursos" className="w-64 pl-9 dark:bg-slate-900" />
                  </div>
                </div>

                {cursosQ.isLoading ? (
                  <div className="space-y-2">{[0, 1, 2].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
                ) : lista.length === 0 ? (
                  <Card className="dark:border-slate-800 dark:bg-slate-900"><CardContent className="flex flex-col items-center gap-3 py-14 text-center">
                    <BookOpen className="h-8 w-8 text-slate-400" aria-hidden="true" />
                    <p className="font-medium text-slate-900 dark:text-slate-100">{cursos.length === 0 ? 'Ainda não há cursos' : 'Nenhum curso corresponde à pesquisa'}</p>
                    {cursos.length === 0 && <Button onClick={() => setForm({ open: true, curso: null })}><Plus className="h-4 w-4" aria-hidden="true" />Criar o primeiro curso</Button>}
                  </CardContent></Card>
                ) : (
                  <Card className="dark:border-slate-800 dark:bg-slate-900"><CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Curso</TableHead>
                            <TableHead>Conteúdo</TableHead>
                            <TableHead>Alunos</TableHead>
                            <TableHead>Publicado</TableHead>
                            <TableHead className="text-right">Acções</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {lista.map(c => {
                            const s = stats[c.id] || { modulos: 0, aulas: 0, inscritos: 0, concluidos: 0 };
                            return (
                              <TableRow key={c.id}>
                                <TableCell>
                                  <button type="button" onClick={() => abrirCurso(c.id)} className="flex items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-md">
                                    <div className={`relative h-12 w-20 shrink-0 overflow-hidden rounded-md bg-gradient-to-br ${gradienteCategoria(c.categoria)}`}>
                                      {c.capa_url ? <img src={c.capa_url} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <BookOpen className="absolute inset-0 m-auto h-5 w-5 text-white/80" aria-hidden="true" />}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-medium text-slate-900 hover:text-blue-700 dark:text-slate-100 dark:hover:text-blue-300">{c.titulo}</p>
                                      <p className="text-xs text-slate-500 dark:text-slate-400">
                                        {[c.categoria, c.nivel ? NIVEL_LABEL[c.nivel] || c.nivel : null, c.carga_horaria ? fmtHoras(c.carga_horaria) : null, c.instrutor_nome].filter(Boolean).join(' · ') || 'Sem categoria'}
                                      </p>
                                    </div>
                                  </button>
                                </TableCell>
                                <TableCell className="whitespace-nowrap text-sm text-slate-600 dark:text-slate-300"><span className="inline-flex items-center gap-1.5"><Layers className="h-4 w-4 text-slate-400" aria-hidden="true" />{s.modulos} mód. · {s.aulas} aulas</span></TableCell>
                                <TableCell className="whitespace-nowrap text-sm text-slate-600 dark:text-slate-300"><span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4 text-slate-400" aria-hidden="true" />{s.inscritos} · {s.concluidos} concl.</span></TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    {ocupado === c.id ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-hidden="true" /> : <Switch checked={!!c.publicado} onCheckedChange={(v) => publicar(c, v)} disabled={(!c.publicado && s.aulas === 0) || !podeEditarCurso(user, c)} aria-label={`Publicar ${c.titulo}`} />}
                                    {c.publicado ? <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Publicado</Badge> : <Badge variant="outline" className="border-amber-300 text-amber-700 dark:text-amber-400">Rascunho</Badge>}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-0.5">
                                    <Button variant="outline" size="sm" onClick={() => abrirCurso(c.id)}><Layers className="h-4 w-4" aria-hidden="true" />Conteúdo</Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Editar dados" disabled={!podeEditarCurso(user, c)} title={podeEditarCurso(user, c) ? undefined : `Só leitura: curso de ${nomeResponsavel(c)}`} onClick={() => setForm({ open: true, curso: c })}><Pencil className="h-4 w-4" /></Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700" aria-label="Apagar curso" disabled={ocupado === c.id || !podeEditarCurso(user, c)} onClick={() => setConfirm(c)}><Trash2 className="h-4 w-4" /></Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent></Card>
                )}
              </TabsContent>

              <TabsContent value="alunos" className="mt-4"><AlunosGestao user={user} onAbrirAluno={(email) => setParams({ aluno: email })} /></TabsContent>
              <TabsContent value="matriz" className="mt-4"><MatrizFormacao user={user} onAbrirAluno={(email) => setParams({ aluno: email })} /></TabsContent>
              <TabsContent value="trilhas" className="mt-4"><TrilhasGestao user={user} /></TabsContent>
              <TabsContent value="perguntas" className="mt-4 space-y-3">
                <p className="text-sm text-slate-600 dark:text-slate-400">Perguntas <strong>globais</strong>, reutilizáveis em qualquer curso. As perguntas de um curso específico gerem-se no separador Avaliação desse curso.</p>
                <BancoPerguntas cursoId={null} user={user} />
              </TabsContent>
              <TabsContent value="certificados" className="mt-4"><CertificadosEmitidos user={user} /></TabsContent>
              <TabsContent value="assinantes" className="mt-4"><AssinantesGlobais user={user} /></TabsContent>
              {isAdminProfile(user) && <TabsContent value="instrutores" className="mt-4"><InstrutoresGestao user={user} /></TabsContent>}
            </Tabs>
          </>
        )}

        <CursoForm
          isOpen={form.open}
          onClose={() => setForm({ open: false, curso: null })}
          curso={form.curso}
          categorias={categorias}
          user={user}
          onSaved={(saved, novo) => { refrescar(); if (novo) abrirCurso(saved.id); }}
        />
        <ConfirmModal
          isOpen={!!confirm}
          onClose={() => setConfirm(null)}
          onConfirm={apagar}
          variant="destructive"
          title="Apagar curso?"
          confirmText="Apagar"
          message={`"${confirm?.titulo}" deixa de aparecer no catálogo e na gestão. ${stats[confirm?.id]?.inscritos ? `Tem ${stats[confirm.id].inscritos} aluno(s) inscrito(s), que perdem o acesso. ` : ''}Os certificados já emitidos mantêm-se válidos.`}
        />
      </div>
    </div>
  );
}
