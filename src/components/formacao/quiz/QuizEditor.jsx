import React, { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import Select from '@/components/ui/select';
import { Plus, Trash2, ArrowUp, ArrowDown, Loader2, Save, ClipboardList, Dices, Search, BarChart3, Download, Settings2, HelpCircle, AlertTriangle, Hourglass, ClipboardCheck, Eye, Pencil, Database } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { Quiz } from '@/entities/Quiz';
import { QuizItem } from '@/entities/QuizItem';
import { useQuizzesCurso, useQuizItens, usePerguntas, useTentativasQuiz } from '@/hooks/useQuizGestao';
import { fmtData } from '../formacaoUtils';
import { TIPOS_PERGUNTA, fmtTempo, resumoItens } from './quizUtils';
import PerguntaForm from './PerguntaForm';
import BancoPerguntas from './BancoPerguntas';
import CorrecaoTentativa from './CorrecaoTentativa';
import BotoesExportar from '../gestao/BotoesExportar';
import { exportarPdf, fmtDataCurta } from '@/lib/formacaoExport';

// Separador "Avaliação" do curso: uma ou mais avaliações (quiz) com regras, perguntas e resultados.
export default function QuizEditor({ curso, user }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: quizzes = [], isLoading } = useQuizzesCurso(curso.id);
  const [selId, setSelId] = useState(null);
  const [aCriar, setACriar] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const quiz = quizzes.find(q => q.id === selId) || quizzes[0] || null;
  const refrescar = () => qc.invalidateQueries({ queryKey: ['quiz'] });

  const criar = async () => {
    setACriar(true);
    try {
      const novo = await Quiz.create({
        curso_id: curso.id, titulo: quizzes.length ? `Avaliação ${quizzes.length + 1}` : 'Avaliação final', descricao: null,
        nota_minima: 70, tentativas_max: 2, tempo_limite_min: null, baralhar_perguntas: true, baralhar_opcoes: true, rever_apos: true,
        modo_sem_consulta: false, requer_aulas_concluidas: true, gera_certificado: true, ativo: false, feedback_faixas: [], ordem: quizzes.length + 1,
        created_by: user?.email || null,
      });
      await refrescar(); setSelId(novo.id);
      toast({ title: 'Avaliação criada', description: 'Defina as regras, junte perguntas e active quando estiver pronta.' });
    } catch (e) { toast({ title: 'Não foi possível criar', description: e?.message, variant: 'destructive' }); }
    finally { setACriar(false); }
  };
  const apagar = async () => {
    setConfirm(false);
    try { await Quiz.delete(quiz.id); toast({ title: 'Avaliação apagada' }); setSelId(null); await refrescar(); }
    catch (e) { toast({ title: 'Não foi possível apagar', description: e?.message, variant: 'destructive' }); }
  };

  if (isLoading) return <div className="space-y-3"><Skeleton className="h-10 w-64" /><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {quizzes.length > 1 && (
            <div className="w-64"><Select value={quiz?.id || ''} onValueChange={setSelId} searchable={false} options={quizzes.map(q => ({ value: q.id, label: q.titulo + (q.ativo ? '' : ' (inactiva)') }))} /></div>
          )}
          {quiz && <Badge variant={quiz.ativo ? 'default' : 'outline'} className={quiz.ativo ? 'bg-emerald-600 hover:bg-emerald-600' : 'border-amber-300 text-amber-700 dark:text-amber-400'}>{quiz.ativo ? 'Activa para os alunos' : 'Inactiva'}</Badge>}
        </div>
        <Button variant={quizzes.length ? 'outline' : 'default'} onClick={criar} disabled={aCriar}>{aCriar ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}Nova avaliação</Button>
      </div>

      {!quiz ? (
        <Card className="border-dashed dark:border-slate-800 dark:bg-slate-900"><CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <ClipboardList className="h-8 w-8 text-slate-400" aria-hidden="true" />
          <p className="font-medium text-slate-900 dark:text-slate-100">Este curso ainda não tem avaliação</p>
          <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">Crie a avaliação, defina nota mínima, tentativas e tempo, junte perguntas do banco e active-a. Ao aprovar, o aluno conclui o curso e recebe o certificado automaticamente.</p>
        </CardContent></Card>
      ) : (
        <Tabs defaultValue="regras">
          <TabsList className="h-auto w-full justify-start overflow-x-auto sm:w-auto">
            <TabsTrigger value="regras" className="gap-1.5 py-1.5"><Settings2 className="h-4 w-4" aria-hidden="true" />Regras</TabsTrigger>
            <TabsTrigger value="perguntas" className="gap-1.5 py-1.5"><HelpCircle className="h-4 w-4" aria-hidden="true" />Perguntas</TabsTrigger>
            <TabsTrigger value="banco" className="gap-1.5 py-1.5"><Database className="h-4 w-4" aria-hidden="true" />Banco do curso</TabsTrigger>
            <TabsTrigger value="resultados" className="gap-1.5 py-1.5"><BarChart3 className="h-4 w-4" aria-hidden="true" />Resultados</TabsTrigger>
          </TabsList>
          <TabsContent value="regras" className="mt-4"><RegrasQuiz key={quiz.id} quiz={quiz} user={user} onApagar={() => setConfirm(true)} /></TabsContent>
          <TabsContent value="perguntas" className="mt-4"><PerguntasQuiz key={quiz.id} quiz={quiz} curso={curso} user={user} /></TabsContent>
          <TabsContent value="banco" className="mt-4 space-y-3">
            <p className="text-sm text-slate-500 dark:text-slate-400">Todas as perguntas deste curso e as globais: editar, duplicar, activar/desactivar, importar de Excel. Para as juntar à avaliação use "Escolher do banco" no separador Perguntas.</p>
            <BancoPerguntas cursoId={curso.id} user={user} />
          </TabsContent>
          <TabsContent value="resultados" className="mt-4"><ResultadosQuiz key={quiz.id} quiz={quiz} curso={curso} /></TabsContent>
        </Tabs>
      )}
      <ConfirmModal isOpen={confirm} onClose={() => setConfirm(false)} onConfirm={apagar} variant="destructive" title="Apagar avaliação?" confirmText="Apagar"
        message={`"${quiz?.titulo}" e todas as tentativas dos alunos serão apagadas. Os certificados já emitidos mantêm-se.`} />
    </div>
  );
}

// ── Regras ──────────────────────────────────────────────────────────────
function RegrasQuiz({ quiz, user, onApagar }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const inicial = useMemo(() => ({
    titulo: quiz.titulo || '', descricao: quiz.descricao || '', nota_minima: quiz.nota_minima ?? 70,
    tentativas_max: quiz.tentativas_max ?? '', tempo_limite_min: quiz.tempo_limite_min ?? '',
    baralhar_perguntas: quiz.baralhar_perguntas !== false, baralhar_opcoes: quiz.baralhar_opcoes !== false, rever_apos: quiz.rever_apos !== false,
    modo_sem_consulta: !!quiz.modo_sem_consulta, requer_aulas_concluidas: quiz.requer_aulas_concluidas !== false, gera_certificado: !!quiz.gera_certificado,
    ativo: !!quiz.ativo, feedback_faixas: Array.isArray(quiz.feedback_faixas) ? quiz.feedback_faixas : [],
  }), [quiz]);
  const [form, setForm] = useState(inicial);
  const [aGuardar, setAGuardar] = useState(false);
  useEffect(() => setForm(inicial), [inicial]);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const sujo = JSON.stringify(form) !== JSON.stringify(inicial);

  const guardar = async () => {
    if (!form.titulo.trim()) { toast({ title: 'O título é obrigatório', variant: 'destructive' }); return; }
    setAGuardar(true);
    try {
      await Quiz.update(quiz.id, {
        titulo: form.titulo.trim(), descricao: form.descricao.trim() || null, nota_minima: Number(form.nota_minima) || 0,
        tentativas_max: form.tentativas_max === '' ? null : Math.max(1, parseInt(form.tentativas_max, 10) || 1),
        tempo_limite_min: form.tempo_limite_min === '' ? null : Math.max(1, parseInt(form.tempo_limite_min, 10) || 1),
        baralhar_perguntas: form.baralhar_perguntas, baralhar_opcoes: form.baralhar_opcoes, rever_apos: form.rever_apos,
        modo_sem_consulta: form.modo_sem_consulta, requer_aulas_concluidas: form.requer_aulas_concluidas, gera_certificado: form.gera_certificado,
        ativo: form.ativo, feedback_faixas: form.feedback_faixas.filter(f => String(f.mensagem || '').trim()), updated_by: user?.email || null,
      });
      toast({ title: 'Regras guardadas' });
      await qc.invalidateQueries({ queryKey: ['quiz'] });
    } catch (e) { toast({ title: 'Não foi possível guardar', description: e?.message, variant: 'destructive' }); }
    finally { setAGuardar(false); }
  };

  const Sw = ({ k, label, ajuda }) => (
    <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 dark:border-slate-700">
      <div><Label htmlFor={`rq-${k}`} className="cursor-pointer">{label}</Label>{ajuda && <p className="text-xs text-slate-500 dark:text-slate-400">{ajuda}</p>}</div>
      <Switch id={`rq-${k}`} checked={!!form[k]} onCheckedChange={(v) => set(k, !!v)} />
    </div>
  );

  return (
    <div className="space-y-4">
      <Card className="dark:border-slate-800 dark:bg-slate-900">
        <CardHeader><CardTitle className="text-base">Identificação e aprovação</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="rq-titulo">Título</Label><Input id="rq-titulo" value={form.titulo} onChange={(e) => set('titulo', e.target.value)} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="rq-desc">Instruções para o aluno</Label><Textarea id="rq-desc" rows={2} value={form.descricao} onChange={(e) => set('descricao', e.target.value)} placeholder="Ex.: Prova sem consulta. Leia cada pergunta com atenção." /></div>
          <div className="space-y-1.5"><Label htmlFor="rq-nota">Nota mínima para aprovar (%)</Label><Input id="rq-nota" type="number" min="0" max="100" step="1" value={form.nota_minima} onChange={(e) => set('nota_minima', e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="rq-tent">Tentativas máximas</Label><Input id="rq-tent" type="number" min="1" step="1" value={form.tentativas_max} onChange={(e) => set('tentativas_max', e.target.value)} placeholder="vazio = ilimitadas" /></div>
          <div className="space-y-1.5"><Label htmlFor="rq-tempo">Tempo limite (minutos)</Label><Input id="rq-tempo" type="number" min="1" step="1" value={form.tempo_limite_min} onChange={(e) => set('tempo_limite_min', e.target.value)} placeholder="vazio = sem limite" /></div>
        </CardContent>
      </Card>
      <Card className="dark:border-slate-800 dark:bg-slate-900">
        <CardHeader><CardTitle className="text-base">Comportamento</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Sw k="baralhar_perguntas" label="Baralhar perguntas" ajuda="Ordem diferente em cada tentativa." />
          <Sw k="baralhar_opcoes" label="Baralhar opções" ajuda="Excepto Verdadeiro/Falso." />
          <Sw k="rever_apos" label="Mostrar correcção após submeter" ajuda="Desligado: o aluno só vê a nota." />
          <Sw k="modo_sem_consulta" label="Modo sem consulta" ajuda="Ecrã inteiro e registo de saídas da janela." />
          <Sw k="requer_aulas_concluidas" label="Exigir todas as aulas concluídas" ajuda="Só pode iniciar quem terminou o curso." />
          <Sw k="gera_certificado" label="Aprovar conclui o curso e emite o certificado" ajuda="Automático, no momento da aprovação." />
          <Sw k="ativo" label="Activa (visível para os alunos)" ajuda="Desligue enquanto prepara as perguntas." />
        </CardContent>
      </Card>
      <Card className="dark:border-slate-800 dark:bg-slate-900">
        <CardHeader><CardTitle className="text-base">Mensagens por faixa de nota</CardTitle><CardDescription>Opcional. Ex.: 0–69 "Reveja o módulo X", 70–100 "Parabéns".</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          {form.feedback_faixas.map((f, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <Input type="number" min="0" max="100" value={f.min ?? 0} onChange={(e) => set('feedback_faixas', form.feedback_faixas.map((x, k) => (k === i ? { ...x, min: Number(e.target.value) } : x)))} className="w-20" aria-label="Mínimo" />
              <span className="text-slate-400">a</span>
              <Input type="number" min="0" max="100" value={f.max ?? 100} onChange={(e) => set('feedback_faixas', form.feedback_faixas.map((x, k) => (k === i ? { ...x, max: Number(e.target.value) } : x)))} className="w-20" aria-label="Máximo" />
              <Input value={f.mensagem || ''} onChange={(e) => set('feedback_faixas', form.feedback_faixas.map((x, k) => (k === i ? { ...x, mensagem: e.target.value } : x)))} placeholder="Mensagem" className="min-w-[200px] flex-1" />
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-600" aria-label="Remover faixa" onClick={() => set('feedback_faixas', form.feedback_faixas.filter((_, k) => k !== i))}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => set('feedback_faixas', [...form.feedback_faixas, { min: 0, max: 100, mensagem: '' }])}><Plus className="h-4 w-4" aria-hidden="true" />Adicionar faixa</Button>
        </CardContent>
      </Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" className="text-red-600 hover:text-red-700" onClick={onApagar}><Trash2 className="h-4 w-4" aria-hidden="true" />Apagar avaliação</Button>
        <Button onClick={guardar} disabled={!sujo || aGuardar}>{aGuardar ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}Guardar regras</Button>
      </div>
    </div>
  );
}

// ── Perguntas (composição) ──────────────────────────────────────────────
function PerguntasQuiz({ quiz, curso, user }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: itens = [], isLoading } = useQuizItens(quiz.id);
  const { data: perguntas = [] } = usePerguntas(curso.id);
  const porId = useMemo(() => Object.fromEntries(perguntas.map(p => [p.id, p])), [perguntas]);
  const categorias = useMemo(() => [...new Set(perguntas.filter(p => p.ativo !== false).map(p => p.categoria).filter(Boolean))].sort(), [perguntas]);
  const [escolher, setEscolher] = useState(false);
  const [sorteio, setSorteio] = useState(false);
  const [nova, setNova] = useState(false);
  const [editar, setEditar] = useState(null); // pergunta em edição
  const [ocupado, setOcupado] = useState(null);
  const refrescar = () => qc.invalidateQueries({ queryKey: ['quiz_item', quiz.id] });
  const proximaOrdem = (itens.at(-1)?.ordem ?? 0) + 1;
  const { n, pontos } = resumoItens(itens, porId);
  const jaNoQuiz = new Set(itens.filter(i => i.modo === 'fixa').map(i => i.pergunta_id));

  const adicionarFixas = async (ids) => {
    if (!ids.length) return;
    try {
      await QuizItem.bulkCreate(ids.map((id, k) => ({ quiz_id: quiz.id, modo: 'fixa', pergunta_id: id, ordem: proximaOrdem + k })));
      toast({ title: ids.length === 1 ? 'Pergunta adicionada' : `${ids.length} perguntas adicionadas` }); await refrescar();
    } catch (e) { toast({ title: 'Não foi possível adicionar', description: e?.message, variant: 'destructive' }); }
  };
  const adicionarSorteio = async ({ categoria, quantidade }) => {
    try {
      await QuizItem.create({ quiz_id: quiz.id, modo: 'aleatoria', categoria, quantidade, ordem: proximaOrdem });
      toast({ title: 'Sorteio adicionado' }); await refrescar();
    } catch (e) { toast({ title: 'Não foi possível adicionar', description: e?.message, variant: 'destructive' }); }
  };
  const remover = async (it) => {
    setOcupado(it.id);
    try { await QuizItem.delete(it.id); await refrescar(); }
    catch (e) { toast({ title: 'Não foi possível remover', description: e?.message, variant: 'destructive' }); }
    finally { setOcupado(null); }
  };
  const mover = async (idx, dir) => {
    const j = idx + dir; if (j < 0 || j >= itens.length) return;
    setOcupado(itens[idx].id);
    try {
      const nova = itens.map((x, k) => ({ id: x.id, antes: x.ordem, ordem: k + 1 }));
      [nova[idx].ordem, nova[j].ordem] = [nova[j].ordem, nova[idx].ordem];
      await Promise.all(nova.filter(x => x.ordem !== x.antes).map(x => QuizItem.update(x.id, { ordem: x.ordem })));
      await refrescar();
    } catch (e) { toast({ title: 'Não foi possível reordenar', description: e?.message, variant: 'destructive' }); }
    finally { setOcupado(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600 dark:text-slate-400">{n} {n === 1 ? 'pergunta' : 'perguntas'} por tentativa{pontos ? ` · ${pontos} pontos nas fixas` : ''}{itens.some(i => i.modo === 'aleatoria') ? ' · inclui sorteio' : ''}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setNova(true)}><Plus className="h-4 w-4" aria-hidden="true" />Nova pergunta</Button>
          <Button variant="outline" size="sm" onClick={() => setEscolher(true)}><Search className="h-4 w-4" aria-hidden="true" />Escolher do banco</Button>
          <Button variant="outline" size="sm" onClick={() => setSorteio(true)} disabled={!categorias.length} title={!categorias.length ? 'Crie perguntas com categoria para sortear' : undefined}><Dices className="h-4 w-4" aria-hidden="true" />Sorteio por categoria</Button>
        </div>
      </div>
      <Card className="dark:border-slate-800 dark:bg-slate-900"><CardContent className="p-0">
        {isLoading ? <div className="space-y-2 p-4">{[0, 1].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
        : itens.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <HelpCircle className="h-8 w-8 text-slate-400" aria-hidden="true" />
            <p className="font-medium text-slate-900 dark:text-slate-100">Ainda sem perguntas</p>
            <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">Junte perguntas fixas do banco ou um sorteio (ex.: 10 perguntas da categoria "GRF"). Cada aluno recebe a mesma composição, baralhada se as regras o permitirem.</p>
          </div>
        ) : (
          <ol className="divide-y dark:divide-slate-800">
            {itens.map((it, i) => {
              const p = it.modo === 'fixa' ? porId[it.pergunta_id] : null;
              const T = p ? (TIPOS_PERGUNTA[p.tipo] || TIPOS_PERGUNTA.escolha_unica) : null;
              const Icon = T ? T.icon : Dices;
              return (
                <li key={it.id} className="flex items-start gap-3 px-4 py-3">
                  <span className="mt-0.5 w-6 shrink-0 text-right text-sm text-slate-400">{i + 1}.</span>
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    {it.modo === 'fixa' ? (
                      p ? (
                        <>
                          <p className="line-clamp-2 text-sm text-slate-900 dark:text-slate-100">{p.enunciado}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{T.label} · {Number(p.pontos) || 1} pt{p.categoria ? ` · ${p.categoria}` : ''}{p.ativo === false ? ' · INACTIVA (não sai)' : ''}</p>
                        </>
                      ) : <p className="flex items-center gap-1.5 text-sm text-amber-700 dark:text-amber-400"><AlertTriangle className="h-4 w-4" aria-hidden="true" />Pergunta apagada ou sem acesso</p>
                    ) : (
                      <>
                        <p className="text-sm text-slate-900 dark:text-slate-100">Sorteio: {it.quantidade} {it.quantidade === 1 ? 'pergunta' : 'perguntas'} da categoria <strong>{it.categoria}</strong></p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{perguntas.filter(x => x.ativo !== false && x.categoria === it.categoria).length} disponíveis no banco</p>
                      </>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    {it.modo === 'fixa' && p && <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Editar pergunta" title="Editar enunciado, opções e resposta" disabled={!!ocupado} onClick={() => setEditar(p)}><Pencil className="h-4 w-4" /></Button>}
                    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Subir" disabled={i === 0 || !!ocupado} onClick={() => mover(i, -1)}>{ocupado === it.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}</Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Descer" disabled={i === itens.length - 1 || !!ocupado} onClick={() => mover(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700" aria-label="Remover" disabled={!!ocupado} onClick={() => remover(it)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent></Card>

      <EscolherPerguntasDialog isOpen={escolher} onClose={() => setEscolher(false)} perguntas={perguntas.filter(p => p.ativo !== false && !jaNoQuiz.has(p.id))} onEscolher={adicionarFixas} />
      <SorteioDialog isOpen={sorteio} onClose={() => setSorteio(false)} categorias={categorias} perguntas={perguntas} onAdicionar={adicionarSorteio} />
      <PerguntaForm isOpen={nova} onClose={() => setNova(false)} pergunta={null} cursoId={curso.id} categorias={categorias} user={user}
        onSaved={async (saved) => { await qc.invalidateQueries({ queryKey: ['pergunta'] }); await adicionarFixas([saved.id]); }} />
      <PerguntaForm isOpen={!!editar} onClose={() => setEditar(null)} pergunta={editar} cursoId={curso.id} categorias={categorias} user={user}
        onSaved={async () => { await qc.invalidateQueries({ queryKey: ['pergunta'] }); toast({ title: 'Pergunta actualizada', description: 'As próximas tentativas usam a versão nova; as já iniciadas mantêm a anterior.' }); }} />
    </div>
  );
}

function EscolherPerguntasDialog({ isOpen, onClose, perguntas, onEscolher }) {
  const [busca, setBusca] = useState('');
  const [sel, setSel] = useState({});
  const [aAdicionar, setAAdicionar] = useState(false);
  const q = busca.trim().toLowerCase();
  const lista = perguntas.filter(p => !q || String(p.enunciado || '').toLowerCase().includes(q) || String(p.categoria || '').toLowerCase().includes(q));
  const ids = Object.keys(sel).filter(k => sel[k]);
  const fechar = () => { setSel({}); setBusca(''); onClose(); };
  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o) fechar(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Escolher perguntas do banco</DialogTitle><DialogDescription>Perguntas activas do curso e globais que ainda não estão nesta avaliação.</DialogDescription></DialogHeader>
        <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" /><Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar…" className="pl-9" aria-label="Pesquisar perguntas" /></div>
        <div className="max-h-80 overflow-y-auto rounded-md border dark:border-slate-700">
          {lista.length === 0 ? <p className="p-4 text-center text-sm text-slate-500">Nenhuma pergunta disponível.</p> : lista.map(p => {
            const T = TIPOS_PERGUNTA[p.tipo] || TIPOS_PERGUNTA.escolha_unica;
            return (
              <label key={p.id} className="flex cursor-pointer items-start gap-3 border-b px-3 py-2 last:border-b-0 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
                <Checkbox className="mt-0.5" checked={!!sel[p.id]} onCheckedChange={(v) => setSel(s => ({ ...s, [p.id]: !!v }))} aria-label={`Seleccionar: ${p.enunciado}`} />
                <span className="min-w-0 flex-1"><span className="line-clamp-2 text-sm text-slate-900 dark:text-slate-100">{p.enunciado}</span><span className="text-xs text-slate-500 dark:text-slate-400">{T.label} · {Number(p.pontos) || 1} pt{p.categoria ? ` · ${p.categoria}` : ''}{!p.curso_id ? ' · global' : ''}</span></span>
              </label>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={fechar} disabled={aAdicionar}>Cancelar</Button>
          <Button onClick={async () => { setAAdicionar(true); try { await onEscolher(ids); fechar(); } finally { setAAdicionar(false); } }} disabled={!ids.length || aAdicionar}>{aAdicionar && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}Adicionar{ids.length ? ` (${ids.length})` : ''}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SorteioDialog({ isOpen, onClose, categorias, perguntas, onAdicionar }) {
  const [categoria, setCategoria] = useState('');
  const [quantidade, setQuantidade] = useState(5);
  const [aAdicionar, setAAdicionar] = useState(false);
  useEffect(() => { if (isOpen) setCategoria(categorias[0] || ''); }, [isOpen, categorias]);
  const disponiveis = perguntas.filter(p => p.ativo !== false && p.categoria === categoria).length;
  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Sorteio por categoria</DialogTitle><DialogDescription>Cada tentativa recebe N perguntas aleatórias da categoria, sem repetir as fixas.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Categoria</Label><Select value={categoria} onValueChange={setCategoria} searchable={false} options={categorias.map(c => ({ value: c, label: c }))} /></div>
          <div className="space-y-1.5"><Label htmlFor="sq-n">Quantidade</Label><Input id="sq-n" type="number" min="1" max={Math.max(1, disponiveis)} value={quantidade} onChange={(e) => setQuantidade(e.target.value)} /><p className="text-xs text-slate-500 dark:text-slate-400">{disponiveis} perguntas activas nesta categoria.</p></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={aAdicionar}>Cancelar</Button>
          <Button onClick={async () => { setAAdicionar(true); try { await onAdicionar({ categoria, quantidade: Math.max(1, Math.min(disponiveis || 1, parseInt(quantidade, 10) || 1)) }); onClose(); } finally { setAAdicionar(false); } }} disabled={!categoria || !disponiveis || aAdicionar}>{aAdicionar && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}Adicionar sorteio</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Resultados ──────────────────────────────────────────────────────────
function ResultadosQuiz({ quiz, curso }) {
  const { toast } = useToast();
  const { data: tentativas = [], isLoading } = useTentativasQuiz(quiz.id);
  const { data: perguntas = [] } = usePerguntas(curso.id);
  const porId = useMemo(() => Object.fromEntries(perguntas.map(p => [p.id, p])), [perguntas]);
  const [corrigir, setCorrigir] = useState(null); // id da tentativa aberta no diálogo de correcção
  const fechadas = [...tentativas.filter(t => t.estado !== 'em_curso')].sort((a, b) => (b.correcao_pendente ? 1 : 0) - (a.correcao_pendente ? 1 : 0));
  const porCorrigir = fechadas.filter(t => t.correcao_pendente).length;
  const alunos = new Set(fechadas.map(t => t.aluno_email)).size;
  const media = fechadas.length ? Math.round((fechadas.reduce((s, t) => s + (Number(t.nota) || 0), 0) / fechadas.length) * 10) / 10 : null;
  const aprovados = new Set(fechadas.filter(t => t.aprovado).map(t => t.aluno_email)).size;
  const porPergunta = useMemo(() => {
    const acc = {};
    for (const t of fechadas) for (const r of (Array.isArray(t.respostas) ? t.respostas : [])) {
      if (r.pendente) continue; // abertas por corrigir não contam para o acerto
      const a = (acc[r.pergunta_id] ||= { n: 0, certas: 0, sem: 0 }); a.n++; if (r.correta) a.certas++; if (!r.respondida) a.sem++;
    }
    return Object.entries(acc).map(([id, a]) => ({ id, ...a, pct: a.n ? Math.round((a.certas / a.n) * 100) : 0, enunciado: porId[id]?.enunciado || '(pergunta removida do banco)' })).sort((x, y) => x.pct - y.pct);
  }, [fechadas, porId]);

  const exportar = async () => {
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(fechadas.map(t => ({
        Aluno: t.aluno_nome || '', Email: t.aluno_email, Tentativa: t.numero, Estado: t.correcao_pendente ? 'por corrigir' : t.estado, 'Nota (%)': t.nota, Aprovado: t.correcao_pendente ? 'Pendente' : t.aprovado ? 'Sim' : 'Não',
        Pontos: t.pontos, 'Pontos máx.': t.pontos_max, Início: t.iniciada_em, Submissão: t.submetida_em, 'Tempo (min)': t.tempo_gasto_s != null ? Math.round(t.tempo_gasto_s / 60) : '',
        'Saídas do ecrã': (Array.isArray(t.eventos) ? t.eventos : []).filter(e => e.tipo === 'saida').length,
      }))), 'Tentativas');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(porPergunta.map(p => ({ Pergunta: p.enunciado, Respostas: p.n, Certas: p.certas, 'Sem resposta': p.sem, 'Acerto (%)': p.pct }))), 'Por pergunta');
      XLSX.writeFile(wb, `Resultados_${(quiz.titulo || 'avaliacao').replace(/[^\w-]+/g, '_')}.xlsx`);
    } catch (e) { toast({ title: 'Não foi possível exportar', description: e?.message, variant: 'destructive' }); }
  };

  const exportarPdfResultados = () => exportarPdf({ base: `Resultados_${quiz.titulo}`, titulo: `Resultados — ${quiz.titulo}`, subtitulo: curso.titulo, paisagem: true, geradoPor: undefined,
    meta: [`Nota mínima ${quiz.nota_minima}%${quiz.tentativas_max ? ` · ${quiz.tentativas_max} tentativas` : ''}${quiz.tempo_limite_min ? ` · ${quiz.tempo_limite_min} min` : ''}`],
    seccoes: [
      { titulo: 'Resumo', pares: [{ label: 'Tentativas', value: String(fechadas.length) }, { label: 'Alunos', value: String(alunos) }, { label: 'Nota média', value: media != null ? `${media}%` : '—' }, { label: 'Aprovados', value: `${aprovados}${alunos ? ` (${Math.round((aprovados / alunos) * 100)}%)` : ''}` }, { label: 'Por corrigir', value: String(porCorrigir) }] },
      { titulo: 'Tentativas', colunas: [{ label: 'Aluno', width: 50 }, { label: 'Email', width: 52 }, { label: 'Tent.', width: 12, align: 'right' }, { label: 'Nota', width: 14, align: 'right' }, { label: 'Resultado', width: 28 }, { label: 'Data', width: 22 }, { label: 'Tempo', width: 16 }, { label: 'Saídas', width: 14, align: 'right' }],
        linhas: fechadas.map(t => [t.aluno_nome || '', t.aluno_email, t.numero, t.nota != null ? `${t.nota}%` : '', t.estado === 'expirada' ? 'Tempo esgotado' : t.correcao_pendente ? 'Por corrigir' : t.aprovado ? 'Aprovado' : 'Reprovado', fmtDataCurta(t.submetida_em || t.iniciada_em), t.tempo_gasto_s != null ? fmtTempo(t.tempo_gasto_s) : '', (Array.isArray(t.eventos) ? t.eventos : []).filter(e => e.tipo === 'saida').length || '']), vazio: 'Ainda não há tentativas submetidas.' },
      { titulo: 'Acerto por pergunta', colunas: [{ label: 'Pergunta', width: 150 }, { label: 'Respostas', width: 22, align: 'right' }, { label: 'Certas', width: 18, align: 'right' }, { label: 'Sem resposta', width: 26, align: 'right' }, { label: 'Acerto', width: 18, align: 'right' }], linhas: porPergunta.map(p => [p.enunciado, p.n, p.certas, p.sem, `${p.pct}%`]), vazio: 'Sem dados.' },
    ] });

  if (isLoading) return <Skeleton className="h-48 w-full" />;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[['Tentativas', fechadas.length], ['Alunos', alunos], ['Nota média', media != null ? `${media}%` : '—'], ['Aprovados', `${aprovados}${alunos ? ` (${Math.round((aprovados / alunos) * 100)}%)` : ''}`], ['Por corrigir', porCorrigir]].map(([l, v]) => (
          <Card key={l} className={`dark:border-slate-800 dark:bg-slate-900 ${l === 'Por corrigir' && v > 0 ? 'border-amber-300 dark:border-amber-800' : ''}`}><CardContent className="p-4"><p className="text-xs text-slate-500 dark:text-slate-400">{l}</p><p className={`text-xl font-bold tabular-nums ${l === 'Por corrigir' && v > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-slate-900 dark:text-slate-100'}`}>{v}</p></CardContent></Card>
        ))}
      </div>
      {porCorrigir > 0 && <p className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"><Hourglass className="h-4 w-4 shrink-0" aria-hidden="true" />{porCorrigir === 1 ? 'Há 1 tentativa com respostas abertas por corrigir.' : `Há ${porCorrigir} tentativas com respostas abertas por corrigir.`} Os alunos só recebem a nota final (e o certificado) depois da correcção.</p>}
      <div className="flex justify-end gap-2"><Button variant="outline" size="sm" onClick={exportar} disabled={!fechadas.length}><Download className="h-4 w-4" aria-hidden="true" />Exportar Excel</Button><BotoesExportar onPdf={exportarPdfResultados} disabled={!fechadas.length} /></div>
      <Card className="dark:border-slate-800 dark:bg-slate-900"><CardContent className="p-0">
        {fechadas.length === 0 ? <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">Ainda não há tentativas submetidas.</p> : (
          <div className="overflow-x-auto"><Table>
            <TableHeader><TableRow><TableHead>Aluno</TableHead><TableHead>Tent.</TableHead><TableHead>Nota</TableHead><TableHead>Resultado</TableHead><TableHead>Data</TableHead><TableHead>Tempo</TableHead><TableHead>Saídas</TableHead><TableHead className="text-right">Correcção</TableHead></TableRow></TableHeader>
            <TableBody>
              {fechadas.map(t => (
                <TableRow key={t.id}>
                  <TableCell><p className="font-medium text-slate-900 dark:text-slate-100">{t.aluno_nome || t.aluno_email}</p><p className="text-xs text-slate-500">{t.aluno_email}</p></TableCell>
                  <TableCell className="tabular-nums">{t.numero}</TableCell>
                  <TableCell className="font-semibold tabular-nums">{t.nota != null ? `${t.nota}%` : '—'}</TableCell>
                  <TableCell>{t.estado === 'expirada' ? <Badge variant="outline" className="border-amber-300 text-amber-700">Tempo esgotado</Badge> : t.correcao_pendente ? <Badge variant="outline" className="border-amber-300 text-amber-700"><Hourglass className="mr-1 h-3 w-3" aria-hidden="true" />Por corrigir</Badge> : t.aprovado ? <Badge className="bg-emerald-600 hover:bg-emerald-600">Aprovado</Badge> : <Badge variant="destructive">Reprovado</Badge>}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">{fmtData(t.submetida_em || t.iniciada_em)}</TableCell>
                  <TableCell className="tabular-nums">{t.tempo_gasto_s != null ? fmtTempo(t.tempo_gasto_s) : '—'}</TableCell>
                  <TableCell className="tabular-nums">{(Array.isArray(t.eventos) ? t.eventos : []).filter(e => e.tipo === 'saida').length || '—'}</TableCell>
                  <TableCell className="text-right">{t.correcao_pendente ? <Button size="sm" onClick={() => setCorrigir(t.id)}><ClipboardCheck className="h-4 w-4" aria-hidden="true" />Corrigir</Button> : <Button size="sm" variant="ghost" onClick={() => setCorrigir(t.id)} aria-label={`Ver tentativa ${t.numero} de ${t.aluno_nome || t.aluno_email}`}><Eye className="h-4 w-4" aria-hidden="true" />Ver</Button>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table></div>
        )}
      </CardContent></Card>
      {porPergunta.length > 0 && (
        <Card className="dark:border-slate-800 dark:bg-slate-900">
          <CardHeader><CardTitle className="text-base">Acerto por pergunta</CardTitle><CardDescription>Perguntas com acerto baixo podem estar mal formuladas ou o tema precisa de reforço.</CardDescription></CardHeader>
          <CardContent className="p-0"><Table>
            <TableHeader><TableRow><TableHead>Pergunta</TableHead><TableHead className="text-right">Respostas</TableHead><TableHead className="text-right">Acerto</TableHead></TableRow></TableHeader>
            <TableBody>{porPergunta.map(p => (
              <TableRow key={p.id}><TableCell className="max-w-[520px]"><p className="line-clamp-2 text-sm">{p.enunciado}</p></TableCell><TableCell className="text-right tabular-nums">{p.n}</TableCell><TableCell className={`text-right font-semibold tabular-nums ${p.pct < 40 ? 'text-red-600' : p.pct < 70 ? 'text-amber-600' : 'text-emerald-600'}`}>{p.pct}%</TableCell></TableRow>
            ))}</TableBody>
          </Table></CardContent>
        </Card>
      )}
      <CorrecaoTentativa tentativaId={corrigir} isOpen={!!corrigir} onClose={() => setCorrigir(null)} />
    </div>
  );
}
