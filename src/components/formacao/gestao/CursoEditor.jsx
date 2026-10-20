import React, { useState } from 'react';
import { urlFormacao } from '@/lib/universidade';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Pencil, Eye, Layers, Users, Award, Loader2, ClipboardList, BarChart3, CalendarDays, History } from 'lucide-react';
import AnaliticaCurso from './AnaliticaCurso';
import SessoesTab from './SessoesTab';
import VersoesTab from './VersoesTab';
import { useToast } from '@/components/ui/use-toast';
import { Curso } from '@/entities/Curso';
import { useCursoConteudo } from '@/hooks/useFormacao';
import { useTodosCursos, useMatriculasCurso } from '@/hooks/useGestaoFormacao';
import { NIVEL_LABEL, fmtHoras, podeEditarCurso, nomeResponsavel } from '../formacaoUtils';
import CursoForm from './CursoForm';
import ConteudoEditor from './ConteudoEditor';
import AlunosTab from './AlunosTab';
import CertificadoConfig from './CertificadoConfig';
import QuizEditor from '../quiz/QuizEditor';

const TABS = ['conteudo', 'avaliacao', 'sessoes', 'alunos', 'certificado', 'analitica', 'versoes'];

// Editor de um curso: cabeçalho (publicar, editar dados, ver como aluno) + separadores.
export default function CursoEditor({ cursoId, tab, onTab, user, onVoltar }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading, isError, refetch } = useCursoConteudo(cursoId);
  const { data: todos = [] } = useTodosCursos();
  const { data: mats } = useMatriculasCurso(cursoId);
  const [editar, setEditar] = useState(false);
  const [aPublicar, setAPublicar] = useState(false);
  const curso = data?.curso;
  const tabAtual = TABS.includes(tab) ? tab : 'conteudo';
  const categorias = [...new Set(todos.map(c => c.categoria).filter(Boolean))].sort();

  const refrescar = () => Promise.all([qc.invalidateQueries({ queryKey: ['curso'] }), qc.invalidateQueries({ queryKey: ['matricula'] })]);

  const publicar = async (v) => {
    setAPublicar(true);
    try {
      await Curso.update(curso.id, { publicado: !!v, updated_by: user?.email || null });
      toast({ title: v ? 'Curso publicado no catálogo' : 'Curso retirado do catálogo (rascunho)' });
      await refrescar();
    } catch (e) {
      toast({ title: 'Não foi possível actualizar', description: e?.message, variant: 'destructive' });
    } finally {
      setAPublicar(false);
    }
  };

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-9 w-32" /><Skeleton className="h-16 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }
  if (isError || !curso) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={onVoltar}><ArrowLeft className="h-4 w-4" aria-hidden="true" />Cursos</Button>
        <Card className="dark:border-slate-800 dark:bg-slate-900"><CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-slate-700 dark:text-slate-300">Não foi possível carregar este curso.</p>
          <Button variant="outline" onClick={() => refetch()}>Tentar novamente</Button>
        </CardContent></Card>
      </div>
    );
  }

  const nAulas = data.aulas.length;

  return (
    <div className="space-y-5">
      <Button variant="ghost" onClick={onVoltar} className="-ml-2 text-slate-600 dark:text-slate-300"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Cursos</Button>

      <div className="flex flex-col gap-4 rounded-xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-start md:justify-between md:p-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {curso.publicado
              ? <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Publicado</Badge>
              : <Badge variant="outline" className="border-amber-300 text-amber-700 dark:text-amber-400">Rascunho</Badge>}
            {curso.categoria && <Badge variant="secondary">{curso.categoria}</Badge>}
            {curso.nivel && <Badge variant="outline" className="dark:border-slate-700">{NIVEL_LABEL[curso.nivel] || curso.nivel}</Badge>}
            <Badge variant="outline" className="dark:border-slate-700" title="Versão actual do conteúdo (separador Versões)">v{curso.versao_atual || 1}</Badge>
          </div>
          <h1 className="mt-2 text-xl font-bold leading-tight text-slate-900 dark:text-slate-100 md:text-2xl">{curso.titulo}</h1>
          {!podeEditarCurso(user, curso) && <p role="status" className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">Só leitura — curso de {nomeResponsavel(curso)}. Para o editar peça ao responsável que o adicione como co-instrutor, ou a um administrador.</p>}
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {data.modulos.length} {data.modulos.length === 1 ? 'módulo' : 'módulos'} · {nAulas} {nAulas === 1 ? 'aula' : 'aulas'}
            {curso.carga_horaria ? ` · ${fmtHoras(curso.carga_horaria)}` : ''}{curso.instrutor_nome ? ` · ${curso.instrutor_nome}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          <div className="flex items-center gap-2 rounded-md border px-3 py-1.5 dark:border-slate-700">
            <Label htmlFor="ce-pub" className="cursor-pointer text-sm">Publicado</Label>
            {aPublicar ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-hidden="true" /> : <Switch id="ce-pub" checked={!!curso.publicado} onCheckedChange={publicar} disabled={nAulas === 0 && !curso.publicado} />}
          </div>
          <Button variant="outline" onClick={() => setEditar(true)}><Pencil className="h-4 w-4" aria-hidden="true" />Editar dados</Button>
          <Button asChild variant="outline">
            <a href={urlFormacao(`?curso=${curso.id}`)} target="_blank" rel="noopener noreferrer"><Eye className="h-4 w-4" aria-hidden="true" />Ver como aluno</a>
          </Button>
        </div>
      </div>
      {nAulas === 0 && !curso.publicado && <p className="text-xs text-slate-500 dark:text-slate-400">Adicione pelo menos uma aula para poder publicar o curso.</p>}

      <Tabs value={tabAtual} onValueChange={onTab}>
        <TabsList className="h-auto w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="conteudo" className="gap-1.5 py-1.5"><Layers className="h-4 w-4" aria-hidden="true" />Conteúdo</TabsTrigger>
          <TabsTrigger value="avaliacao" className="gap-1.5 py-1.5"><ClipboardList className="h-4 w-4" aria-hidden="true" />Avaliação</TabsTrigger>
          <TabsTrigger value="sessoes" className="gap-1.5 py-1.5"><CalendarDays className="h-4 w-4" aria-hidden="true" />Sessões</TabsTrigger>
          <TabsTrigger value="alunos" className="gap-1.5 py-1.5"><Users className="h-4 w-4" aria-hidden="true" />Alunos</TabsTrigger>
          <TabsTrigger value="certificado" className="gap-1.5 py-1.5"><Award className="h-4 w-4" aria-hidden="true" />Certificado</TabsTrigger>
          <TabsTrigger value="analitica" className="gap-1.5 py-1.5"><BarChart3 className="h-4 w-4" aria-hidden="true" />Analítica</TabsTrigger>
          <TabsTrigger value="versoes" className="gap-1.5 py-1.5"><History className="h-4 w-4" aria-hidden="true" />Versões</TabsTrigger>
        </TabsList>
        <TabsContent value="conteudo" className="mt-4"><ConteudoEditor curso={curso} modulos={data.modulos} aulas={data.aulas} /></TabsContent>
        <TabsContent value="avaliacao" className="mt-4"><QuizEditor curso={curso} user={user} /></TabsContent>
        <TabsContent value="sessoes" className="mt-4"><SessoesTab curso={curso} aulas={data.aulas} user={user} /></TabsContent>
        <TabsContent value="alunos" className="mt-4"><AlunosTab curso={curso} modulos={data.modulos} aulas={data.aulas} user={user} /></TabsContent>
        <TabsContent value="certificado" className="mt-4"><CertificadoConfig curso={curso} modulos={data.modulos} aulas={data.aulas} user={user} /></TabsContent>
        <TabsContent value="analitica" className="mt-4"><AnaliticaCurso curso={curso} user={user} /></TabsContent>
        <TabsContent value="versoes" className="mt-4"><VersoesTab curso={curso} modulos={data.modulos} aulas={data.aulas} user={user} matriculas={mats?.matriculas || []} /></TabsContent>
      </Tabs>

      <CursoForm isOpen={editar} onClose={() => setEditar(false)} curso={curso} categorias={categorias} user={user} onSaved={refrescar} />
    </div>
  );
}
