import { PERFIL_UC_LABEL, perfisUcTexto } from '@/lib/universidade';
import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { ArrowLeft, Mail, Award, ClipboardList, History, ExternalLink, Plus, Pencil, Trash2, RotateCcw, UserPlus, ChevronDown, ChevronRight, Clock, CheckCircle2, Circle, Download, Car, BookOpen, GraduationCap, Loader2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { cn } from '@/lib/utils';
import { Matricula } from '@/entities/Matricula';
import { FormacaoExterna } from '@/entities/FormacaoExterna';
import { supabase } from '@/lib/supabaseClient';
import { sendEmailDirect } from '@/functions/sendEmailDirect';
import { getPublicBaseUrl, prepararCertParaPdf } from '@/lib/certificadoEmissao';
import { ENTREGAVEL } from '@/lib/formacaoLembrete';
import { matrizFormacao } from '@/lib/formacaoEstado';
import { useFichaAluno, useTodosCursos, useTrilhas } from '@/hooks/useGestaoFormacao';
import { fmtData, fmtMinutos } from '../formacaoUtils';
import { ChipEstado } from './MatrizFormacao';
import LembreteDialog from './LembreteDialog';
import FormacaoExternaForm, { TIPO_EXTERNA, RESULTADO_EXTERNA } from './FormacaoExternaForm';
import CorrecaoTentativa from '../quiz/CorrecaoTentativa';
import BotoesExportar from './BotoesExportar';
import { exportarExcel, exportarPdf, fmtDataCurta, diasTexto } from '@/lib/formacaoExport';
import { ESTADOS } from '@/lib/formacaoEstado';

const TIPO_NOTIF = { inscricao: 'Inscrição', certificado: 'Certificado emitido', lembrete: 'Lembrete automático', lembrete_manual: 'Lembrete do instrutor', a_expirar_30: 'A expirar (30 d)', a_expirar_7: 'A expirar (7 d)', expirado: 'Expirado', em_falta: 'Obrigatório em falta' };
const iniciais = (nome) => String(nome || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('');
const fmtSeg = (s) => { const n = Number(s) || 0; if (!n) return '—'; return n < 3600 ? `${Math.round(n / 60)} min` : `${Math.floor(n / 3600)} h ${Math.round((n % 3600) / 60)} min`; };

// Ficha do colaborador: todos os cursos (com progresso por aula e tempo), avaliações, certificados,
// formação externa, licenças do Safety e histórico de notificações. Acções: inscrever, lembrete, reabrir, remover.
export default function FichaAluno({ email, user, onVoltar, onAbrirCurso }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading, isError } = useFichaAluno(email);
  const { data: cursosTodos = [] } = useTodosCursos();
  const { data: trilhasData } = useTrilhas();
  const [tab, setTab] = useState('cursos');
  const [mostrarTodos, setMostrarTodos] = useState(false);
  const [aberto, setAberto] = useState({});
  const [lembrete, setLembrete] = useState(null);      // [{curso, matricula, email, nome}]
  const [externaForm, setExternaForm] = useState(null); // { registo }
  const [confirm, setConfirm] = useState(null);         // { tipo: 'remover'|'reabrir'|'apagar_externa', alvo }
  const [correcao, setCorrecao] = useState(null);
  const [ocupado, setOcupado] = useState(null);

  const aluno = data?.aluno || { email, full_name: data?.matriculas?.[0]?.aluno_nome || email, perfis: [] };
  const cursos = useMemo(() => {
    const pub = cursosTodos.filter(c => c.publicado && !c.deleted_at);
    const ids = new Set(pub.map(c => c.id));
    for (const m of data?.matriculas || []) { const c = cursosTodos.find(x => x.id === m.curso_id); if (c && !ids.has(c.id)) { pub.push(c); ids.add(c.id); } }
    return pub.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  }, [cursosTodos, data]);
  const linha = useMemo(() => {
    if (!data) return null;
    return matrizFormacao({ users: [aluno], cursos, matriculas: data.matriculas, trilhas: trilhasData?.trilhas || [], trilhaCursos: trilhasData?.trilhaCursos || [], externas: data.externas }).linhas[0];
  }, [data, aluno, cursos, trilhasData]);
  const aulasPorCurso = useMemo(() => { const m = {}; for (const a of data?.aulas || []) (m[a.curso_id] ||= []).push(a); return m; }, [data]);
  const progPorMatricula = useMemo(() => { const m = {}; for (const p of data?.progresso || []) (m[p.matricula_id] ||= []).push(p); return m; }, [data]);
  const quizPorId = useMemo(() => Object.fromEntries((data?.quizzes || []).map(q => [q.id, q])), [data]);
  const cursoPorId = useMemo(() => Object.fromEntries(cursosTodos.map(c => [c.id, c])), [cursosTodos]);

  const refrescar = () => Promise.all([qc.invalidateQueries({ queryKey: ['matricula'] }), qc.invalidateQueries({ queryKey: ['certificado'] }), qc.invalidateQueries({ queryKey: ['formacao_externa'] }), qc.invalidateQueries({ queryKey: ['tentativa'] })]);

  const inscrever = async (curso) => {
    setOcupado(curso.id);
    try {
      await Matricula.create({ curso_id: curso.id, aluno_email: String(aluno.email).toLowerCase(), aluno_nome: aluno.full_name || null, estado: 'ativo', progresso_pct: 0, origem: 'gestor', empresa_id: user?.empresa_id || null, created_by: user?.email || null });
      if (ENTREGAVEL.test(aluno.email)) {
        const base = await getPublicBaseUrl().catch(() => '');
        sendEmailDirect({ to: aluno.email, subject: `[Formação] Foi inscrito no curso "${curso.titulo}"`, html: `<div style="font-family:Segoe UI,Arial,sans-serif;color:#0f172a"><p>Foi inscrito(a) no curso <strong>${curso.titulo}</strong> da Universidade Corporativa.${curso.prazo_dias ? ` Tem <strong>${curso.prazo_dias} dias</strong> para o concluir.` : ''}</p><p><a href="${base}/universidade/formacao?curso=${curso.id}" style="background:#4f46e5;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Começar o curso</a></p></div>` }).catch(() => {});
      }
      toast({ title: 'Inscrito', description: curso.titulo });
      await refrescar();
    } catch (e) { toast({ title: 'Não foi possível inscrever', description: e?.message, variant: 'destructive' }); }
    finally { setOcupado(null); }
  };
  const confirmar = async () => {
    const c = confirm; setConfirm(null); if (!c) return;
    setOcupado(c.alvo.id);
    try {
      if (c.tipo === 'remover') { await Matricula.delete(c.alvo.id); toast({ title: 'Matrícula removida' }); }
      else if (c.tipo === 'reabrir') { const { error } = await supabase.rpc('reabrir_matricula', { p_matricula: c.alvo.id }); if (error) throw new Error(error.message); toast({ title: 'Matrícula reaberta para recertificação', description: `ciclo ${(c.alvo.ciclo || 1) + 1}` }); }
      else if (c.tipo === 'apagar_externa') { await FormacaoExterna.update(c.alvo.id, { deleted_at: new Date().toISOString(), updated_by: user?.email || null }); toast({ title: 'Registo apagado' }); }
      await refrescar();
    } catch (e) { toast({ title: 'Não foi possível concluir a acção', description: e?.message, variant: 'destructive' }); }
    finally { setOcupado(null); }
  };
  const descarregar = async (cert) => {
    setOcupado(cert.id);
    try { const [{ gerarCertificadoPdf, nomeFicheiroCertificado }, input] = await Promise.all([import('@/lib/certificadoPdf'), prepararCertParaPdf(cert)]); (await gerarCertificadoPdf(input)).save(nomeFicheiroCertificado(cert)); }
    catch (e) { toast({ title: 'Não foi possível gerar o PDF', description: e?.message, variant: 'destructive' }); }
    finally { setOcupado(null); }
  };

  if (isLoading || !data) return <div className="space-y-3"><Skeleton className="h-24 w-full" /><Skeleton className="h-72 w-full" /></div>;
  if (isError) return <Card className="dark:border-slate-800 dark:bg-slate-900"><CardContent className="flex flex-col items-center gap-3 py-12 text-center"><AlertTriangle className="h-8 w-8 text-amber-500" aria-hidden="true" /><p>Não foi possível carregar a ficha.</p><Button variant="outline" onClick={onVoltar}><ArrowLeft className="h-4 w-4" aria-hidden="true" />Voltar</Button></CardContent></Card>;

  const celulas = (linha?.celulas || []).filter(c => mostrarTodos || c.estado !== 'nao_inscrito');
  const res = linha?.resumo || {};
  const kpis = [
    ['Pendências', linha?.pendencias ?? 0, (linha?.pendencias ?? 0) > 0 ? 'text-red-600' : 'text-slate-900 dark:text-slate-100'],
    ['Válidos / concluídos', (res.valido || 0) + (res.concluido || 0), 'text-emerald-600'],
    ['Em curso', (res.em_curso || 0) + (res.atrasado || 0), 'text-blue-600'],
    ['Certificados', data.certificados.filter(c => !c.revogado_em).length, 'text-amber-600'],
    ['Formação externa', data.externas.length, 'text-violet-600'],
  ];
  const pendentesLembrete = (linha?.celulas || []).filter(c => ['em_falta', 'expirado', 'a_expirar', 'atrasado', 'em_curso'].includes(c.estado));

  const cursosExport = () => (linha?.celulas || []).filter(c => c.estado !== 'nao_inscrito').map(c => { const m = c.matricula; const prog = m ? (progPorMatricula[m.id] || []) : []; const seg = prog.reduce((s, p) => s + (Number(p.segundos) || 0), 0); return [c.curso.titulo, c.obrigatorio ? 'Sim' : 'Não', ESTADOS[c.estado]?.label || c.estado, c.origem === 'externa' ? 'Formação externa' : m ? 'Curso da Universidade' : '', m ? Math.round(Number(m.progresso_pct) || 0) : '', m ? `${prog.length}/${(aulasPorCurso[c.curso.id] || []).length}` : '', seg ? fmtSeg(seg) : '', m ? (m.ciclo || 1) : '', m ? fmtDataCurta(m.created_date) : '', m?.concluido_em ? fmtDataCurta(m.concluido_em) : c.externa ? fmtDataCurta(c.externa.data_realizacao) : '', c.validoAte ? fmtDataCurta(c.validoAte) : '', c.validoAte ? diasTexto(c.validoAte) : '']; });
  const CAB_CURSOS = ['Curso', 'Obrigatório', 'Estado', 'Origem', 'Progresso (%)', 'Aulas', 'Tempo', 'Ciclo', 'Inscrito em', 'Concluído em', 'Válido até', 'Dias'];
  const avalExport = () => data.tentativas.map(t => { const qz = quizPorId[t.quiz_id]; const cs = qz ? cursoPorId[qz.curso_id] : null; return [qz?.titulo || 'Avaliação', cs?.titulo || '', t.numero, t.ciclo || 1, fmtDataCurta(t.submetida_em || t.iniciada_em), t.nota != null ? t.nota : '', t.estado === 'em_curso' ? 'Em curso' : t.estado === 'expirada' ? 'Tempo esgotado' : t.correcao_pendente ? 'Por corrigir' : t.aprovado ? 'Aprovado' : 'Reprovado', t.tempo_gasto_s != null ? fmtSeg(t.tempo_gasto_s) : '']; });
  const certExport = () => data.certificados.map(x => [x.numero, x.curso_titulo, fmtDataCurta(x.emitido_em), x.valido_ate ? fmtDataCurta(x.valido_ate) : '', x.valido_ate ? diasTexto(x.valido_ate) : '', x.ciclo || 1, x.revogado_em ? 'Revogado' : 'Válido']);
  const extExport = () => data.externas.map(x => [x.titulo, x.entidade || '', TIPO_EXTERNA[x.tipo] || x.tipo, fmtDataCurta(x.data_realizacao), x.valido_ate ? fmtDataCurta(x.valido_ate) : '', x.valido_ate ? diasTexto(x.valido_ate) : '', RESULTADO_EXTERNA[x.resultado] || x.resultado, x.curso_id ? (cursoPorId[x.curso_id]?.titulo || '') : '', x.numero_certificado || '']);
  const licExport = () => data.licencas.map(l => [l.numero_licenca || '', l.aeroporto || '', l.data_treinamento ? fmtDataCurta(l.data_treinamento) : '', l.data_validade ? fmtDataCurta(l.data_validade) : '', l.data_validade ? diasTexto(l.data_validade) : '', l.resultado || '', l.status || '', l.certificado_id ? 'Curso da Universidade' : 'Registo manual']);
  const baseNome = `Ficha_${aluno.full_name || aluno.email}`;
  const exportarXlsx = () => exportarExcel(baseNome, [
    { nome: 'Cursos', cabecalho: CAB_CURSOS, linhas: cursosExport(), larguras: [34, 10, 12, 16, 12, 8, 10, 6, 12, 12, 12, 16] },
    { nome: 'Avaliações', cabecalho: ['Avaliação', 'Curso', 'Tentativa', 'Ciclo', 'Data', 'Nota (%)', 'Resultado', 'Tempo'], linhas: avalExport(), larguras: [30, 30, 9, 6, 12, 9, 14, 10] },
    { nome: 'Certificados', cabecalho: ['Número', 'Curso', 'Emitido', 'Válido até', 'Dias', 'Ciclo', 'Estado'], linhas: certExport(), larguras: [20, 34, 12, 12, 16, 6, 10] },
    { nome: 'Formação externa', cabecalho: ['Formação', 'Entidade', 'Tipo', 'Data', 'Válido até', 'Dias', 'Resultado', 'Equivale a', 'Nº certificado'], linhas: extExport(), larguras: [32, 18, 18, 12, 12, 16, 14, 30, 16] },
    { nome: 'Licenças Safety', cabecalho: ['Nº licença', 'Aeroporto', 'Treino', 'Validade', 'Dias', 'Resultado', 'Estado', 'Origem'], linhas: licExport(), larguras: [12, 10, 12, 12, 16, 12, 10, 16] },
  ]);
  const exportarPdfFicha = () => exportarPdf({ base: baseNome, titulo: 'Ficha de formação', subtitulo: aluno.full_name || aluno.email, empresaId: user?.empresa_id, geradoPor: user?.email,
    meta: [aluno.email, perfisUcTexto(aluno.perfis) ? `Perfis: ${perfisUcTexto(aluno.perfis)}` : ''].filter(Boolean),
    seccoes: [
      { titulo: 'Resumo', pares: kpis.map(([l, v]) => ({ label: l, value: String(v) })) },
      { titulo: 'Cursos', colunas: [{ label: 'Curso', width: 50 }, { label: 'Obrig.', width: 12 }, { label: 'Estado', width: 20 }, { label: '%', width: 9, align: 'right' }, { label: 'Ciclo', width: 10, align: 'right' }, { label: 'Inscrito', width: 18 }, { label: 'Concluído', width: 18 }, { label: 'Válido até', width: 18 }, { label: 'Dias', width: 22 }], linhas: cursosExport().map(r => [r[0], r[1], r[2], r[4], r[7], r[8], r[9], r[10], r[11]]), vazio: 'Sem cursos.' },
      { titulo: 'Avaliações', colunas: [{ label: 'Avaliação', width: 60 }, { label: 'Tent.', width: 12, align: 'right' }, { label: 'Ciclo', width: 12, align: 'right' }, { label: 'Data', width: 22 }, { label: 'Nota', width: 14, align: 'right' }, { label: 'Resultado', width: 28 }, { label: 'Tempo', width: 20 }], linhas: avalExport().map(r => [r[0], r[2], r[3], r[4], r[5] !== '' ? `${r[5]}%` : '', r[6], r[7]]), vazio: 'Sem avaliações.' },
      { titulo: 'Certificados', colunas: [{ label: 'Número', width: 34 }, { label: 'Curso', width: 62 }, { label: 'Emitido', width: 20 }, { label: 'Válido até', width: 20 }, { label: 'Dias', width: 22 }, { label: 'Estado', width: 18 }], linhas: certExport().map(r => [r[0], r[1], r[2], r[3], r[4], r[6]]), vazio: 'Sem certificados.' },
      { titulo: 'Formação externa / presencial', colunas: [{ label: 'Formação', width: 50 }, { label: 'Entidade', width: 26 }, { label: 'Data', width: 18 }, { label: 'Válido até', width: 18 }, { label: 'Dias', width: 22 }, { label: 'Resultado', width: 20 }, { label: 'Equivale a', width: 30 }], linhas: extExport().map(r => [r[0], r[1], r[3], r[4], r[5], r[6], r[7]]), vazio: 'Sem registos.' },
      { titulo: 'Licenças de condução (Safety)', colunas: [{ label: 'Nº licença', width: 24 }, { label: 'Aeroporto', width: 22 }, { label: 'Treino', width: 20 }, { label: 'Validade', width: 20 }, { label: 'Dias', width: 22 }, { label: 'Resultado', width: 22 }, { label: 'Estado', width: 20 }, { label: 'Origem', width: 30 }], linhas: licExport(), vazio: 'Sem licenças.' },
    ] });

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={onVoltar} className="-ml-2 text-slate-600 dark:text-slate-300"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Voltar</Button>
      <Card className="dark:border-slate-800 dark:bg-slate-900"><CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-violet-100 text-lg font-bold text-violet-800 dark:bg-violet-950/60 dark:text-violet-200" aria-hidden="true">{iniciais(aluno.full_name)}</div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold text-slate-900 dark:text-slate-100 md:text-2xl">{aluno.full_name || aluno.email}</h1>
          <p className="truncate text-sm text-slate-600 dark:text-slate-400">{aluno.email}{aluno.status && aluno.status !== 'ativo' ? ` · ${aluno.status}` : ''}{!data.aluno ? ' · sem conta de utilizador activa' : ''}</p>
          <div className="mt-1 flex flex-wrap gap-1">{(aluno.perfis || []).filter(p => PERFIL_UC_LABEL[p]).map(p => <Badge key={p} variant="secondary" className="font-normal">{PERFIL_UC_LABEL[p]}</Badge>)}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <BotoesExportar onExcel={exportarXlsx} onPdf={exportarPdfFicha} />
          <Button variant="outline" size="sm" disabled={pendentesLembrete.length === 0} onClick={() => setLembrete(pendentesLembrete.map(c => ({ curso: c.curso, matricula: c.matricula, email: aluno.email, nome: aluno.full_name, externas: data.externas })))}><Mail className="h-4 w-4" aria-hidden="true" />Lembrete{pendentesLembrete.length > 1 ? ` (${pendentesLembrete.length})` : ''}</Button>
          <Button size="sm" onClick={() => setExternaForm({ registo: null })}><Plus className="h-4 w-4" aria-hidden="true" />Formação externa</Button>
        </div>
      </CardContent></Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">{kpis.map(([l, v, cls]) => <Card key={l} className="dark:border-slate-800 dark:bg-slate-900"><CardContent className="p-3"><p className="text-xs text-slate-500 dark:text-slate-400">{l}</p><p className={cn('text-xl font-bold tabular-nums', cls)}>{v}</p></CardContent></Card>)}</div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="cursos" className="gap-1.5 py-1.5"><BookOpen className="h-4 w-4" aria-hidden="true" />Cursos</TabsTrigger>
          <TabsTrigger value="avaliacoes" className="gap-1.5 py-1.5"><ClipboardList className="h-4 w-4" aria-hidden="true" />Avaliações{data.tentativas.length > 0 && <span className="rounded-full bg-slate-200 px-1.5 text-[11px] tabular-nums dark:bg-slate-700">{data.tentativas.length}</span>}</TabsTrigger>
          <TabsTrigger value="certificados" className="gap-1.5 py-1.5"><Award className="h-4 w-4" aria-hidden="true" />Certificados</TabsTrigger>
          <TabsTrigger value="externa" className="gap-1.5 py-1.5"><GraduationCap className="h-4 w-4" aria-hidden="true" />Formação externa</TabsTrigger>
          <TabsTrigger value="historico" className="gap-1.5 py-1.5"><History className="h-4 w-4" aria-hidden="true" />Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="cursos" className="mt-4 space-y-3">
          <label className="flex items-center gap-2 text-sm"><Switch checked={mostrarTodos} onCheckedChange={setMostrarTodos} aria-label="Mostrar cursos não inscritos" /><span>Mostrar também cursos em que não está inscrito</span></label>
          <Card className="dark:border-slate-800 dark:bg-slate-900"><CardContent className="p-0">
            {celulas.length === 0 ? <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">Sem cursos inscritos nem obrigatórios.</p> : (
              <div className="overflow-x-auto"><Table>
                <TableHeader><TableRow><TableHead className="w-8" /><TableHead>Curso</TableHead><TableHead>Estado</TableHead><TableHead className="min-w-[170px]">Progresso</TableHead><TableHead>Tempo</TableHead><TableHead>Ciclo</TableHead><TableHead>Inscrito</TableHead><TableHead>Concluído</TableHead><TableHead>Válido até</TableHead><TableHead>Dias</TableHead><TableHead className="text-right">Acções</TableHead></TableRow></TableHeader>
                <TableBody>{celulas.map(c => {
                  const m = c.matricula; const aulas = aulasPorCurso[c.curso.id] || []; const prog = m ? (progPorMatricula[m.id] || []) : [];
                  const feitasIds = new Set(prog.map(p => p.aula_id)); const pct = m ? Math.round(Number(m.progresso_pct) || 0) : 0;
                  const seg = prog.reduce((s, p) => s + (Number(p.segundos) || 0), 0); const exp = !!aberto[c.curso.id]; const busy = ocupado === c.curso.id || (m && ocupado === m.id);
                  return (
                    <React.Fragment key={c.curso.id}>
                      <TableRow>
                        <TableCell className="pr-0">{m && <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={exp ? 'Ocultar aulas' : 'Ver aulas'} aria-expanded={exp} onClick={() => setAberto(a => ({ ...a, [c.curso.id]: !exp }))}>{exp ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</Button>}</TableCell>
                        <TableCell><button type="button" className="text-left font-medium text-slate-900 hover:underline dark:text-slate-100" onClick={() => onAbrirCurso?.(c.curso.id)}>{c.curso.titulo}</button>{c.obrigatorio && <span className="ml-1 text-xs text-red-600" title="Obrigatório">*</span>}<p className="text-xs text-slate-500">{c.curso.categoria || ''}{c.curso.validade_meses ? ` · validade ${c.curso.validade_meses} m` : ''}</p></TableCell>
                        <TableCell><ChipEstado estado={c.estado} dias={c.dias} validoAte={c.validoAte} pct={m ? pct : null} />{c.origem === 'externa' && <span className="ml-1 text-[11px] text-violet-700 dark:text-violet-300" title={c.externa?.titulo}>via formação externa</span>}</TableCell>
                        <TableCell>{m ? <div className="flex items-center gap-2"><Progress value={pct} className="h-1.5 flex-1" aria-label={`Progresso ${pct}%`} /><span className="w-16 text-right text-xs tabular-nums text-slate-600 dark:text-slate-300">{feitasIds.size}/{aulas.length} · {pct}%</span></div> : <span className="text-xs text-slate-400">—</span>}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs tabular-nums text-slate-600 dark:text-slate-300">{m ? fmtSeg(seg) : '—'}</TableCell>
                        <TableCell className="tabular-nums">{m ? (m.ciclo || 1) : '—'}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-slate-600 dark:text-slate-300">{m ? fmtData(m.created_date) : '—'}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-slate-600 dark:text-slate-300">{m?.concluido_em ? fmtData(m.concluido_em) : c.externa ? fmtData(c.externa.data_realizacao) : '—'}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-slate-600 dark:text-slate-300">{c.validoAte ? fmtData(c.validoAte) : (c.estado === 'concluido' ? 'sem validade' : '—')}</TableCell>
                        <TableCell className={`whitespace-nowrap text-xs tabular-nums ${c.estado === 'expirado' ? 'font-medium text-red-600' : c.estado === 'a_expirar' ? 'font-medium text-amber-600' : 'text-slate-600 dark:text-slate-300'}`}>{c.validoAte ? diasTexto(c.validoAte) : '—'}</TableCell>
                        <TableCell className="text-right"><div className="flex justify-end gap-0.5">
                          {!m && <Button variant="outline" size="sm" disabled={busy} onClick={() => inscrever(c.curso)}>{busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <UserPlus className="h-4 w-4" aria-hidden="true" />}Inscrever</Button>}
                          {['em_falta', 'expirado', 'a_expirar', 'atrasado', 'em_curso'].includes(c.estado) && <Button variant="ghost" size="sm" onClick={() => setLembrete([{ curso: c.curso, matricula: m, email: aluno.email, nome: aluno.full_name, externas: data.externas }])} title="Enviar lembrete por email"><Mail className="h-4 w-4" aria-hidden="true" />Lembrete</Button>}
                          {m && m.estado === 'concluido' && <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirm({ tipo: 'reabrir', alvo: m })} title="Reabrir num novo ciclo (recertificação)"><RotateCcw className="h-4 w-4" aria-hidden="true" />Reabrir</Button>}
                          {m && <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700" aria-label={`Remover matrícula em ${c.curso.titulo}`} disabled={busy} onClick={() => setConfirm({ tipo: 'remover', alvo: m })}><Trash2 className="h-4 w-4" /></Button>}
                        </div></TableCell>
                      </TableRow>
                      {m && exp && (
                        <TableRow className="bg-slate-50/60 hover:bg-slate-50/60 dark:bg-slate-800/40"><TableCell /><TableCell colSpan={10} className="py-2">
                          {aulas.length === 0 ? <p className="text-xs text-slate-500">Este curso ainda não tem aulas.</p> : (
                            <ul className="grid gap-1 sm:grid-cols-2">{aulas.map(a => { const p = prog.find(x => x.aula_id === a.id); return (
                              <li key={a.id} className="flex items-center gap-2 text-sm">{p ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-label="Concluída" /> : <Circle className="h-4 w-4 shrink-0 text-slate-300" aria-label="Por fazer" />}<span className="min-w-0 flex-1 truncate">{a.titulo}</span><span className="shrink-0 text-xs tabular-nums text-slate-500">{p ? `${fmtData(p.concluida_em)}${p.segundos ? ` · ${fmtSeg(p.segundos)}` : ''}` : (a.duracao_min ? fmtMinutos(a.duracao_min) : '')}</span></li>
                            ); })}</ul>
                          )}
                        </TableCell></TableRow>
                      )}
                    </React.Fragment>
                  );
                })}</TableBody>
              </Table></div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="avaliacoes" className="mt-4">
          <Card className="dark:border-slate-800 dark:bg-slate-900"><CardContent className="p-0">
            {data.tentativas.length === 0 ? <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">Ainda não fez avaliações.</p> : (
              <div className="overflow-x-auto"><Table>
                <TableHeader><TableRow><TableHead>Avaliação</TableHead><TableHead>Tent.</TableHead><TableHead>Ciclo</TableHead><TableHead>Data</TableHead><TableHead>Nota</TableHead><TableHead>Resultado</TableHead><TableHead>Tempo</TableHead><TableHead className="text-right"></TableHead></TableRow></TableHeader>
                <TableBody>{data.tentativas.map(t => { const qz = quizPorId[t.quiz_id]; const cs = qz ? cursoPorId[qz.curso_id] : null; return (
                  <TableRow key={t.id}>
                    <TableCell><p className="font-medium text-slate-900 dark:text-slate-100">{qz?.titulo || 'Avaliação'}</p><p className="text-xs text-slate-500">{cs?.titulo || ''}</p></TableCell>
                    <TableCell className="tabular-nums">{t.numero}</TableCell><TableCell className="tabular-nums">{t.ciclo || 1}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-slate-600 dark:text-slate-300">{fmtData(t.submetida_em || t.iniciada_em)}</TableCell>
                    <TableCell className="font-semibold tabular-nums">{t.nota != null ? `${t.nota}%` : '—'}</TableCell>
                    <TableCell>{t.estado === 'em_curso' ? <Badge variant="outline">Em curso</Badge> : t.estado === 'expirada' ? <Badge variant="outline" className="border-amber-300 text-amber-700">Tempo esgotado</Badge> : t.correcao_pendente ? <Badge variant="outline" className="border-amber-300 text-amber-700">Por corrigir</Badge> : t.aprovado ? <Badge className="bg-emerald-600 hover:bg-emerald-600">Aprovado</Badge> : <Badge variant="destructive">Reprovado</Badge>}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs tabular-nums">{t.tempo_gasto_s != null ? fmtSeg(t.tempo_gasto_s) : '—'}</TableCell>
                    <TableCell className="text-right">{t.estado !== 'em_curso' && <Button size="sm" variant={t.correcao_pendente ? 'default' : 'ghost'} onClick={() => setCorrecao(t.id)}>{t.correcao_pendente ? 'Corrigir' : 'Ver'}</Button>}</TableCell>
                  </TableRow>
                ); })}</TableBody>
              </Table></div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="certificados" className="mt-4">
          <Card className="dark:border-slate-800 dark:bg-slate-900"><CardContent className="p-0">
            {data.certificados.length === 0 ? <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">Sem certificados emitidos.</p> : (
              <div className="overflow-x-auto"><Table>
                <TableHeader><TableRow><TableHead>Número</TableHead><TableHead>Curso</TableHead><TableHead>Emitido</TableHead><TableHead>Válido até</TableHead><TableHead>Ciclo</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Acções</TableHead></TableRow></TableHeader>
                <TableBody>{data.certificados.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.numero}</TableCell><TableCell>{c.curso_titulo}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{fmtData(c.emitido_em)}</TableCell><TableCell className="whitespace-nowrap text-xs">{c.valido_ate ? fmtData(c.valido_ate) : '—'}</TableCell><TableCell className="tabular-nums">{c.ciclo || 1}</TableCell>
                    <TableCell>{c.revogado_em ? <Badge variant="destructive">Revogado</Badge> : <Badge className="bg-emerald-600 hover:bg-emerald-600">Válido</Badge>}</TableCell>
                    <TableCell className="text-right"><div className="flex justify-end gap-0.5">
                      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Descarregar certificado ${c.numero}`} disabled={ocupado === c.id} onClick={() => descarregar(c)}>{ocupado === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}</Button>
                      {c.token && <Button asChild variant="ghost" size="icon" className="h-8 w-8"><a href={`/cert/${c.token}`} target="_blank" rel="noreferrer" aria-label="Abrir página de validação"><ExternalLink className="h-4 w-4" /></a></Button>}
                    </div></TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table></div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="externa" className="mt-4 space-y-4">
          <Card className="dark:border-slate-800 dark:bg-slate-900"><CardContent className="p-0">
            <div className="flex items-center justify-between border-b px-4 py-3 dark:border-slate-800"><p className="font-semibold text-slate-900 dark:text-slate-100">Formação presencial / externa</p><Button size="sm" onClick={() => setExternaForm({ registo: null })}><Plus className="h-4 w-4" aria-hidden="true" />Registar</Button></div>
            {data.externas.length === 0 ? <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">Sem registos. Formações feitas fora da Universidade (ANAC, fornecedores, presenciais) entram aqui e, se equivalerem a um curso, contam na matriz.</p> : (
              <div className="overflow-x-auto"><Table>
                <TableHeader><TableRow><TableHead>Formação</TableHead><TableHead>Entidade</TableHead><TableHead>Tipo</TableHead><TableHead>Data</TableHead><TableHead>Válido até</TableHead><TableHead>Resultado</TableHead><TableHead>Equivale a</TableHead><TableHead className="text-right">Acções</TableHead></TableRow></TableHeader>
                <TableBody>{data.externas.map(x => (
                  <TableRow key={x.id}>
                    <TableCell><p className="font-medium text-slate-900 dark:text-slate-100">{x.titulo}</p>{x.numero_certificado && <p className="text-xs text-slate-500">cert. {x.numero_certificado}</p>}</TableCell>
                    <TableCell>{x.entidade || '—'}</TableCell><TableCell className="text-xs">{TIPO_EXTERNA[x.tipo] || x.tipo}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{fmtData(x.data_realizacao)}</TableCell><TableCell className="whitespace-nowrap text-xs">{x.valido_ate ? fmtData(x.valido_ate) : '—'}</TableCell>
                    <TableCell><Badge variant={x.resultado === 'reprovado' ? 'destructive' : 'outline'} className={x.resultado === 'aprovado' ? 'border-emerald-300 text-emerald-700' : ''}>{RESULTADO_EXTERNA[x.resultado] || x.resultado}</Badge></TableCell>
                    <TableCell className="text-xs">{x.curso_id ? (cursoPorId[x.curso_id]?.titulo || 'curso') : '—'}</TableCell>
                    <TableCell className="text-right"><div className="flex justify-end gap-0.5">
                      {x.certificado_url && <Button asChild variant="ghost" size="icon" className="h-8 w-8"><a href={x.certificado_url} target="_blank" rel="noreferrer" aria-label="Ver certificado"><ExternalLink className="h-4 w-4" /></a></Button>}
                      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Editar ${x.titulo}`} onClick={() => setExternaForm({ registo: x })}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700" aria-label={`Apagar ${x.titulo}`} disabled={ocupado === x.id} onClick={() => setConfirm({ tipo: 'apagar_externa', alvo: x })}><Trash2 className="h-4 w-4" /></Button>
                    </div></TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table></div>
            )}
          </CardContent></Card>
          <Card className="dark:border-slate-800 dark:bg-slate-900"><CardContent className="p-0">
            <div className="flex items-center gap-2 border-b px-4 py-3 dark:border-slate-800"><Car className="h-4 w-4 text-slate-500" aria-hidden="true" /><p className="font-semibold text-slate-900 dark:text-slate-100">Licenças de condução no lado ar (Safety)</p></div>
            {data.licencas.length === 0 ? <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">Sem licenças registadas no módulo Safety.</p> : (
              <div className="overflow-x-auto"><Table>
                <TableHeader><TableRow><TableHead>Nº licença</TableHead><TableHead>Aeroporto</TableHead><TableHead>Treino</TableHead><TableHead>Validade</TableHead><TableHead>Resultado</TableHead><TableHead>Estado</TableHead><TableHead>Origem</TableHead></TableRow></TableHeader>
                <TableBody>{data.licencas.map(l => (
                  <TableRow key={l.id}><TableCell className="font-mono text-xs">{l.numero_licenca || '—'}</TableCell><TableCell>{l.aeroporto || '—'}</TableCell><TableCell className="whitespace-nowrap text-xs">{l.data_treinamento ? fmtData(l.data_treinamento) : '—'}</TableCell><TableCell className="whitespace-nowrap text-xs">{l.data_validade ? fmtData(l.data_validade) : '—'}</TableCell><TableCell className="text-xs">{l.resultado || '—'}</TableCell><TableCell><Badge variant="outline" className={l.status === 'Ativa' ? 'border-emerald-300 text-emerald-700' : l.status === 'Cancelada' || l.status === 'Suspensa' ? 'border-red-300 text-red-700' : ''}>{l.status || '—'}</Badge></TableCell><TableCell className="text-xs">{l.certificado_id ? 'Curso da Universidade' : 'Registo manual'}</TableCell></TableRow>
                ))}</TableBody>
              </Table></div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          <Card className="dark:border-slate-800 dark:bg-slate-900"><CardContent className="p-0">
            {data.notificacoes.length === 0 ? <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">Sem notificações enviadas.</p> : (
              <ul className="divide-y dark:divide-slate-800">{data.notificacoes.map(n => (
                <li key={n.id} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                  <div className="min-w-0 flex-1"><p className="text-slate-900 dark:text-slate-100">{TIPO_NOTIF[n.tipo] || n.tipo}{n.curso_id && cursoPorId[n.curso_id] ? ` · ${cursoPorId[n.curso_id].titulo}` : ''}</p><p className="text-xs text-slate-500">{fmtData(n.enviada_em)}{n.detalhe?.por ? ` · por ${n.detalhe.por}` : ''}{n.detalhe?.mensagem ? ` · "${n.detalhe.mensagem}"` : ''}</p></div>
                  {n.entregue === false ? <Badge variant="outline" className="border-amber-300 text-amber-700">Não entregue</Badge> : <Badge variant="outline" className="border-emerald-300 text-emerald-700">Enviado</Badge>}
                </li>
              ))}</ul>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <LembreteDialog isOpen={!!lembrete} onClose={() => setLembrete(null)} alvos={lembrete || []} user={user} onDone={() => qc.invalidateQueries({ queryKey: ['matricula', 'ficha'] })} />
      <FormacaoExternaForm isOpen={!!externaForm} onClose={() => setExternaForm(null)} registo={externaForm?.registo || null} aluno={aluno} cursos={cursosTodos.filter(c => !c.deleted_at)} user={user} onSaved={async (_, nova) => { toast({ title: nova ? 'Formação externa registada' : 'Registo actualizado' }); await refrescar(); }} />
      <CorrecaoTentativa tentativaId={correcao} isOpen={!!correcao} onClose={() => setCorrecao(null)} onCorrigida={() => refrescar()} />
      <ConfirmModal isOpen={!!confirm} onClose={() => setConfirm(null)} onConfirm={confirmar} variant={confirm?.tipo === 'reabrir' ? undefined : 'destructive'}
        title={confirm?.tipo === 'reabrir' ? 'Reabrir para recertificação?' : confirm?.tipo === 'apagar_externa' ? 'Apagar registo de formação externa?' : 'Remover matrícula?'}
        confirmText={confirm?.tipo === 'reabrir' ? 'Reabrir' : confirm?.tipo === 'apagar_externa' ? 'Apagar' : 'Remover'}
        message={confirm?.tipo === 'reabrir' ? 'O colaborador volta ao início do curso num novo ciclo. O progresso das aulas é limpo; certificados e tentativas anteriores ficam no histórico.' : confirm?.tipo === 'apagar_externa' ? `"${confirm?.alvo?.titulo}" deixa de contar na matriz.` : 'O colaborador perde o acesso ao curso e o progresso registado. O certificado já emitido (se existir) mantém-se válido.'} />
    </div>
  );
}
