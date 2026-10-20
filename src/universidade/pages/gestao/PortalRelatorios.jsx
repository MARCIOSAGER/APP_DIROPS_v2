// Relatórios da Universidade: conformidade, actividade mensal, cursos, avaliações, horas de estudo por colaborador,
// certificados, sessões e presenças. Exportação Excel (várias folhas) e PDF com o logo da SGA.
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, ShieldCheck, Users, Award, CalendarDays, Clock, BookOpen, ClipboardCheck, AlertTriangle, Hourglass } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import Select from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import { useDadosMatriz, useTodosCertificados, useTentativasTodas, useQuizzesTodos, useAtividadeTodas, useSessoesTodas, useAeroportosUc } from '@/hooks/useGestaoFormacao';
import { matrizFormacao } from '@/lib/formacaoEstado';
import { indicadoresFormacao } from '@/lib/formacaoIndicadores';
import { fmtPeriodoSessao, MODALIDADE, ocupacaoSessao } from '@/lib/formacaoSessoes';
import BotoesExportar from '@/components/formacao/gestao/BotoesExportar';
import { exportarExcel, exportarPdf, fmtDataCurta } from '@/lib/formacaoExport';
import { PORTAL_BASE } from '@/lib/universidade';
import { PaginaGestao } from '../../PortalLayout';

const fmtPct = (p) => (p == null ? '—' : `${p}%`);
const corPct = (p) => (p == null ? 'text-slate-400' : p >= 90 ? 'text-emerald-600' : p >= 70 ? 'text-amber-600' : 'text-red-600');
const horas = (s) => Math.round(((Number(s) || 0) / 3600) * 10) / 10;
const MESES_OPC = [{ value: '6', label: 'Últimos 6 meses' }, { value: '12', label: 'Últimos 12 meses' }, { value: '24', label: 'Últimos 24 meses' }];

function Kpi({ icon: Icon, l, v, sub, cls }) {
  return <Card className="dark:border-slate-800 dark:bg-slate-900"><CardContent className="p-3"><div className="flex items-center justify-between"><p className="text-xs text-slate-500 dark:text-slate-400">{l}</p><Icon className="h-4 w-4 text-slate-400" aria-hidden="true" /></div><p className={cn('mt-1 text-2xl font-bold tabular-nums', cls || 'text-slate-900 dark:text-slate-100')}>{v}</p>{sub && <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{sub}</p>}</CardContent></Card>;
}
function Seccao({ titulo, descricao, children }) {
  return <Card className="dark:border-slate-800 dark:bg-slate-900"><CardHeader className="pb-2"><CardTitle className="text-base">{titulo}</CardTitle>{descricao && <CardDescription>{descricao}</CardDescription>}</CardHeader><CardContent className="p-0">{children}</CardContent></Card>;
}
const Vazio = ({ t }) => <p className="px-6 py-6 text-sm text-slate-500">{t}</p>;

export default function PortalRelatorios() {
  const { user } = useAuth();
  const [meses, setMeses] = useState('12');
  const { data, isLoading } = useDadosMatriz();
  const { data: certificados = [] } = useTodosCertificados();
  const { data: tentativas = [] } = useTentativasTodas();
  const { data: quizzes = [] } = useQuizzesTodos();
  const { data: atividades = [] } = useAtividadeTodas();
  const { data: sessoesData } = useSessoesTodas();
  const matriz = useMemo(() => (data ? matrizFormacao(data) : null), [data]);
  const ind = useMemo(() => (matriz ? indicadoresFormacao({ matriz, cursos: data.cursos, matriculas: data.matriculas, tentativas, quizzes, certificados, externas: data.externas, atividades, meses: Number(meses) }) : null), [matriz, data, tentativas, quizzes, certificados, atividades, meses]);

  // horas de estudo por colaborador (via matrícula → aluno)
  const porPessoa = useMemo(() => {
    if (!data) return [];
    const mat = new Map(data.matriculas.map(m => [m.id, m]));
    const acc = new Map();
    for (const a of atividades) { const m = mat.get(a.matricula_id); if (!m) continue; const k = String(m.aluno_email).toLowerCase(); const x = acc.get(k) || { email: k, nome: m.aluno_nome || k, segundos: 0, cursos: new Set() }; x.segundos += Number(a.tempo_s) || 0; x.cursos.add(m.curso_id); acc.set(k, x); }
    const concl = new Map(); for (const m of data.matriculas) if (m.estado === 'concluido') { const k = String(m.aluno_email).toLowerCase(); concl.set(k, (concl.get(k) || 0) + 1); }
    return [...acc.values()].map(x => ({ ...x, horas: horas(x.segundos), cursos: x.cursos.size, concluidos: concl.get(x.email) || 0 })).sort((a, b) => b.segundos - a.segundos);
  }, [data, atividades]);
  // sessões realizadas com presenças
  const sessoes = useMemo(() => {
    const ss = sessoesData?.sessoes || []; const ins = sessoesData?.inscricoes || []; const cursos = new Map((data?.cursos || []).map(c => [c.id, c.titulo]));
    const agora = Date.now();
    return ss.filter(s => s.estado !== 'cancelada').map(s => { const o = ocupacaoSessao(s, ins); return { ...s, cursoTitulo: cursos.get(s.curso_id) || '', inscritos: o.inscritos, presentes: o.presentes, presencaPct: o.inscritos ? Math.round((o.presentes / o.inscritos) * 100) : null, passada: new Date(s.fim || s.inicio).getTime() < agora }; }).sort((a, b) => new Date(b.inicio) - new Date(a.inicio));
  }, [sessoesData, data]);
  const certsValidos = certificados.filter(c => !c.revogado_em);
  // conclusões por aeroporto (aeroporto do formando na Universidade): quem completou que cursos
  const { data: aeroportosUc = [] } = useAeroportosUc();
  const porAeroportoConcl = useMemo(() => {
    if (!data) return [];
    const nomes = new Map(aeroportosUc.map(a => [a.codigo, `${a.codigo} · ${a.nome}`]));
    const cursosNome = new Map((data.cursos || []).map(c => [c.id, c.titulo]));
    const concl = new Map();
    for (const m of data.matriculas || []) if (m.estado === 'concluido') { const k = String(m.aluno_email).toLowerCase(); if (!concl.has(k)) concl.set(k, new Set()); concl.get(k).add(m.curso_id); }
    const conf = new Map((ind?.porAeroporto || []).map(p => [p.chave, p]));
    const grupos = new Map();
    for (const u of data.users || []) {
      const cod = (u.aeroportos_acesso || [])[0] || '';
      const chave = cod ? (nomes.get(cod) || cod) : '(sem aeroporto)';
      const g = grupos.get(chave) || { chave, pessoas: 0, concluiram: 0, conclusoes: 0, lista: [] };
      g.pessoas++;
      const cs = concl.get(String(u.email).toLowerCase());
      if (cs && cs.size) { g.concluiram++; g.conclusoes += cs.size; g.lista.push({ nome: u.full_name || u.email, email: u.email, cursos: [...cs].map(id => cursosNome.get(id) || '').filter(Boolean) }); }
      grupos.set(chave, g);
    }
    return [...grupos.values()].map(g => ({ ...g, conformidade: conf.get(g.chave)?.pct ?? null, lista: g.lista.sort((a, b) => a.nome.localeCompare(b.nome)) })).sort((a, b) => b.pessoas - a.pessoas);
  }, [data, aeroportosUc, ind]);
  const certsPorMes = useMemo(() => (ind?.atividade || []).map(a => ({ mes: a.label, certificados: a.certificados })), [ind]);

  if (isLoading || !ind) return <PaginaGestao titulo="Relatórios"><div className="space-y-3"><Skeleton className="h-24 w-full" /><Skeleton className="h-72 w-full" /></div></PaginaGestao>;
  const t = ind.totais;
  const cursosTab = ind.porCurso;
  const cursosAval = cursosTab.filter(c => c.tentativas > 0);
  const cursosObrig = cursosTab.filter(c => c.obrigatorioPara > 0);
  const ultimasSessoes = sessoes.filter(s => s.passada).slice(0, 30);
  const excel = () => exportarExcel('Universidade_relatorio', [
    { nome: 'Resumo', cabecalho: ['Indicador', 'Valor'], linhas: [['Conformidade', fmtPct(ind.conformidade.pct)], ['Obrigatórios válidos', ind.conformidade.validos], ['Obrigatórios devidos', ind.conformidade.devidos], ['Colaboradores', ind.colaboradores], ['Inscritos', ind.inscritos], ['Em falta', t.em_falta || 0], ['Expirados', t.expirado || 0], ['A expirar 30 d', ind.vencimentos.d30.length], ['Certificados válidos', certsValidos.length], ['Horas de estudo', ind.horasEstudo], ['Por corrigir', ind.porCorrigir]], larguras: [30, 16] },
    { nome: 'Conformidade perfil', cabecalho: ['Perfil', 'Pessoas', 'Devidos', 'Válidos', 'Em falta', 'Expirados', 'Conformidade'], linhas: ind.porPerfil.map(p => [p.chave, p.pessoas, p.devidos, p.validos, p.emFalta, p.expirados, fmtPct(p.pct)]) },
    { nome: 'Por aeroporto', cabecalho: ['Aeroporto', 'Formandos', 'Concluíram ≥ 1 curso', 'Conclusões', 'Conformidade'], linhas: porAeroportoConcl.map(g => [g.chave, g.pessoas, g.concluiram, g.conclusoes, g.conformidade == null ? '—' : fmtPct(g.conformidade)]) },
    { nome: 'Conclusões por pessoa', cabecalho: ['Aeroporto', 'Colaborador', 'Email', 'Cursos concluídos'], linhas: porAeroportoConcl.flatMap(g => g.lista.map(p => [g.chave, p.nome, p.email, p.cursos.join('; ')])) },
    { nome: 'Cursos', cabecalho: ['Curso', 'Obrig. p/', 'Em falta', 'Atrasados', 'Em curso', 'Válidos', 'A expirar', 'Expirados', 'Conformidade', 'Inscritos', 'Concluídos', 'Tempo médio (d)', 'Tentativas', 'Aprovação', 'Nota média', 'Horas estudo'], linhas: cursosTab.map(c => [c.curso.titulo, c.obrigatorioPara, c.em_falta, c.atrasado, c.em_curso, c.valido, c.a_expirar, c.expirado, fmtPct(c.conformidadePct), c.inscritos, c.concluidos, c.tempoMedioDias ?? '', c.tentativas, fmtPct(c.aprovacaoPct), c.notaMedia ?? '', c.horasEstudo]), larguras: [44, 10, 10, 10, 10, 10, 10, 10, 12, 10, 10, 14, 10, 10, 10, 12] },
    { nome: 'Actividade mensal', cabecalho: ['Mês', 'Inscrições', 'Conclusões', 'Certificados'], linhas: ind.atividade.map(a => [a.label, a.inscricoes, a.conclusoes, a.certificados]) },
    { nome: 'Horas por colaborador', cabecalho: ['Colaborador', 'Email', 'Horas', 'Cursos com actividade', 'Cursos concluídos'], linhas: porPessoa.map(p => [p.nome, p.email, p.horas, p.cursos, p.concluidos]), larguras: [30, 34, 10, 20, 18] },
    { nome: 'Vencimentos', cabecalho: ['Janela', 'Colaborador', 'Email', 'Curso', 'Válido até', 'Dias'], linhas: [...ind.vencimentos.expirados.map(i => ['Expirado', i.user.full_name || '', i.user.email, i.curso.titulo, fmtDataCurta(i.validoAte), i.dias]), ...ind.vencimentos.d30.map(i => ['0–30 d', i.user.full_name || '', i.user.email, i.curso.titulo, fmtDataCurta(i.validoAte), i.dias]), ...ind.vencimentos.d60.map(i => ['31–60 d', i.user.full_name || '', i.user.email, i.curso.titulo, fmtDataCurta(i.validoAte), i.dias]), ...ind.vencimentos.d90.map(i => ['61–90 d', i.user.full_name || '', i.user.email, i.curso.titulo, fmtDataCurta(i.validoAte), i.dias])], larguras: [12, 30, 34, 44, 14, 8] },
    { nome: 'Certificados', cabecalho: ['Número', 'Colaborador', 'Email', 'Curso', 'Emitido', 'Válido até', 'Revogado'], linhas: certificados.map(c => [c.numero, c.aluno_nome, c.aluno_email, c.curso_titulo, fmtDataCurta(c.emitido_em), c.valido_ate ? fmtDataCurta(c.valido_ate) : '', c.revogado_em ? fmtDataCurta(c.revogado_em) : '']), larguras: [16, 30, 34, 44, 12, 12, 12] },
    { nome: 'Sessões', cabecalho: ['Sessão', 'Curso', 'Quando', 'Modalidade', 'Local', 'Formador', 'Inscritos', 'Presentes', 'Presença'], linhas: sessoes.map(s => [s.titulo, s.cursoTitulo, fmtPeriodoSessao(s), MODALIDADE[s.modalidade]?.curto || s.modalidade, s.local || '', s.formador_nome || '', s.inscritos, s.presentes, fmtPct(s.presencaPct)]), larguras: [34, 34, 30, 12, 20, 24, 10, 10, 10] },
  ]);
  const pdf = () => exportarPdf({ base: 'Universidade_relatorio', titulo: 'Universidade Corporativa — relatório de formação', subtitulo: `Últimos ${meses} meses · ${new Date().toLocaleDateString('pt-PT')}`, paisagem: true, empresaId: user?.empresa_id, geradoPor: user?.email,
    meta: [`${ind.colaboradores} colaboradores · ${data.cursos.length} cursos publicados · ${certsValidos.length} certificados válidos`],
    seccoes: [
      { titulo: 'Resumo', pares: [{ label: 'Conformidade', value: fmtPct(ind.conformidade.pct) }, { label: 'Obrigatórios válidos / devidos', value: `${ind.conformidade.validos} / ${ind.conformidade.devidos}` }, { label: 'Em falta', value: String(t.em_falta || 0) }, { label: 'Expirados', value: String(t.expirado || 0) }, { label: 'A expirar 30 d', value: String(ind.vencimentos.d30.length) }, { label: 'Horas de estudo', value: `${ind.horasEstudo} h` }, { label: 'Inscritos', value: String(ind.inscritos) }, { label: 'Por corrigir', value: String(ind.porCorrigir) }] },
      { titulo: 'Conformidade por perfil', colunas: [{ label: 'Perfil', width: 60 }, { label: 'Pessoas', width: 20, align: 'right' }, { label: 'Devidos', width: 20, align: 'right' }, { label: 'Válidos', width: 20, align: 'right' }, { label: 'Em falta', width: 20, align: 'right' }, { label: 'Expirados', width: 22, align: 'right' }, { label: 'Conformidade', width: 26, align: 'right' }], linhas: ind.porPerfil.map(p => [p.chave, p.pessoas, p.devidos, p.validos, p.emFalta, p.expirados, fmtPct(p.pct)]), vazio: 'Sem cursos obrigatórios.' },
      { titulo: 'Cursos', colunas: [{ label: 'Curso', width: 70 }, { label: 'Inscritos', width: 20, align: 'right' }, { label: 'Concluídos', width: 22, align: 'right' }, { label: 'Em curso', width: 20, align: 'right' }, { label: 'Conformidade', width: 26, align: 'right' }, { label: 'Tentativas', width: 22, align: 'right' }, { label: 'Aprovação', width: 22, align: 'right' }, { label: 'Nota média', width: 22, align: 'right' }, { label: 'Horas', width: 18, align: 'right' }], linhas: cursosTab.map(c => [c.curso.titulo, c.inscritos, c.concluidos, c.em_curso, fmtPct(c.conformidadePct), c.tentativas, fmtPct(c.aprovacaoPct), c.notaMedia != null ? `${c.notaMedia}%` : '—', c.horasEstudo]) },
      { titulo: `Actividade (${meses} meses)`, colunas: [{ label: 'Mês', width: 30 }, { label: 'Inscrições', width: 26, align: 'right' }, { label: 'Conclusões', width: 26, align: 'right' }, { label: 'Certificados', width: 26, align: 'right' }], linhas: ind.atividade.map(a => [a.label, a.inscricoes, a.conclusoes, a.certificados]) },
      { titulo: 'Horas de estudo por colaborador (top 40)', colunas: [{ label: 'Colaborador', width: 70 }, { label: 'Horas', width: 20, align: 'right' }, { label: 'Cursos', width: 20, align: 'right' }, { label: 'Concluídos', width: 24, align: 'right' }], linhas: porPessoa.slice(0, 40).map(p => [p.nome, p.horas, p.cursos, p.concluidos]), vazio: 'Ainda sem actividade registada.' },
      { titulo: 'Vencimentos (90 dias e expirados)', colunas: [{ label: 'Janela', width: 26 }, { label: 'Colaborador', width: 60 }, { label: 'Curso', width: 70 }, { label: 'Válido até', width: 24 }, { label: 'Dias', width: 20, align: 'right' }], linhas: [...ind.vencimentos.expirados.map(i => ['Expirado', i.user.full_name || i.user.email, i.curso.titulo, fmtDataCurta(i.validoAte), i.dias]), ...ind.vencimentos.d30.map(i => ['0–30 d', i.user.full_name || i.user.email, i.curso.titulo, fmtDataCurta(i.validoAte), i.dias]), ...ind.vencimentos.d60.map(i => ['31–60 d', i.user.full_name || i.user.email, i.curso.titulo, fmtDataCurta(i.validoAte), i.dias]), ...ind.vencimentos.d90.map(i => ['61–90 d', i.user.full_name || i.user.email, i.curso.titulo, fmtDataCurta(i.validoAte), i.dias])], vazio: 'Sem vencimentos nos próximos 90 dias.' },
      { titulo: 'Sessões realizadas', colunas: [{ label: 'Sessão', width: 60 }, { label: 'Curso', width: 60 }, { label: 'Quando', width: 50 }, { label: 'Modalidade', width: 22 }, { label: 'Inscritos', width: 20, align: 'right' }, { label: 'Presentes', width: 20, align: 'right' }, { label: 'Presença', width: 20, align: 'right' }], linhas: ultimasSessoes.map(s => [s.titulo, s.cursoTitulo, fmtPeriodoSessao(s), MODALIDADE[s.modalidade]?.curto || s.modalidade, s.inscritos, s.presentes, fmtPct(s.presencaPct)]), vazio: 'Sem sessões realizadas.' },
    ] });

  return (
    <PaginaGestao titulo="Relatórios" descricao="Conformidade, actividade, cursos, avaliações, horas de estudo, certificados e sessões. Exporte para Excel ou PDF (logo SGA)." accoes={<><div className="w-44"><Select options={MESES_OPC} value={meses} onValueChange={setMeses} /></div><BotoesExportar onExcel={excel} onPdf={pdf} /><Button asChild variant="outline" size="sm"><Link to={`${PORTAL_BASE}/gestao/cursos?tab=matriz`}>Matriz</Link></Button></>}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <Kpi icon={ShieldCheck} l="Conformidade" v={fmtPct(ind.conformidade.pct)} cls={corPct(ind.conformidade.pct)} sub={`${ind.conformidade.validos} de ${ind.conformidade.devidos} obrigatórios válidos`} />
        <Kpi icon={Users} l="Colaboradores" v={ind.colaboradores} sub={`${ind.inscritos} com inscrições`} />
        <Kpi icon={AlertTriangle} l="Em falta" v={t.em_falta || 0} cls={t.em_falta ? 'text-red-600' : undefined} sub="obrigatórios sem inscrição" />
        <Kpi icon={Hourglass} l="A expirar 30 d" v={ind.vencimentos.d30.length} cls={ind.vencimentos.d30.length ? 'text-amber-600' : undefined} sub={`${t.expirado || 0} já expirados`} />
        <Kpi icon={Award} l="Certificados válidos" v={certsValidos.length} sub={`${certificados.length - certsValidos.length} revogados`} />
        <Kpi icon={Clock} l="Horas de estudo" v={`${ind.horasEstudo} h`} sub="tempo registado nas aulas" />
        <Kpi icon={ClipboardCheck} l="Por corrigir" v={ind.porCorrigir} cls={ind.porCorrigir ? 'text-amber-600' : undefined} sub="respostas abertas" />
        <Kpi icon={CalendarDays} l="Sessões" v={sessoes.length} sub={`${sessoes.filter(s => s.passada).length} realizadas`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Seccao titulo={`Actividade mensal (${meses} meses)`} descricao="Inscrições, conclusões e certificados por mês.">
          <div className="h-64 px-2 pb-2"><ResponsiveContainer width="100%" height="100%"><BarChart data={ind.atividade} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Legend wrapperStyle={{ fontSize: 12 }} /><Bar dataKey="inscricoes" name="Inscrições" fill="#7c3aed" radius={[3, 3, 0, 0]} /><Bar dataKey="conclusoes" name="Conclusões" fill="#10b981" radius={[3, 3, 0, 0]} /><Bar dataKey="certificados" name="Certificados" fill="#f59e0b" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div>
        </Seccao>
        <Seccao titulo="Conformidade por perfil" descricao="Obrigatórios válidos sobre os devidos.">
          {ind.porPerfil.length === 0 ? <Vazio t="Nenhum curso está marcado como obrigatório." /> : <ul className="divide-y px-4 dark:divide-slate-800">{ind.porPerfil.map(p => <li key={p.chave} className="py-2.5"><div className="flex items-center justify-between text-sm"><span className="font-medium text-slate-800 dark:text-slate-100">{p.chave} <span className="font-normal text-slate-500">· {p.pessoas} pessoa(s)</span></span><span className={cn('font-semibold tabular-nums', corPct(p.pct))}>{fmtPct(p.pct)}</span></div><div className="mt-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800"><div className={cn('h-2 rounded-full', p.pct == null ? 'bg-slate-300' : p.pct >= 90 ? 'bg-emerald-500' : p.pct >= 70 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: `${p.pct ?? 0}%` }} /></div><p className="mt-0.5 text-xs text-slate-500">{p.validos} válidos · {p.emFalta} em falta · {p.expirados} expirados de {p.devidos}</p></li>)}</ul>}
        </Seccao>
      </div>

      <Seccao titulo="Conclusões por aeroporto" descricao="Formandos por aeroporto e quem já concluiu cursos. O aeroporto define-se em Acessos › Editar ou em A minha conta.">
        {porAeroportoConcl.length === 0 ? <Vazio t="Sem dados." /> : (
          <div className="overflow-x-auto"><Table>
            <TableHeader><TableRow><TableHead className="pl-6">Aeroporto</TableHead><TableHead className="text-right">Formandos</TableHead><TableHead className="text-right">Concluíram ≥ 1 curso</TableHead><TableHead className="text-right">Conclusões</TableHead><TableHead className="pr-6 text-right">Conformidade</TableHead></TableRow></TableHeader>
            <TableBody>{porAeroportoConcl.map(g => {
              // «FNLU · Aeroporto …» → código em destaque + nome
              const [codigo, ...resto] = String(g.chave).split(' · ');
              const nome = resto.join(' · ');
              const zero = (v) => (v ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500');
              return (
                <React.Fragment key={g.chave}>
                  <TableRow>
                    <TableCell className="pl-6"><span className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">{nome ? codigo : ''}</span>{nome && <span className="ml-2 text-slate-700 dark:text-slate-300">{nome}</span>}{!nome && <span className="font-medium text-slate-900 dark:text-slate-100">{codigo}</span>}</TableCell>
                    <TableCell className={cn('text-right tabular-nums', zero(g.pessoas))}>{g.pessoas}</TableCell>
                    <TableCell className={cn('text-right tabular-nums', zero(g.concluiram))}>{g.concluiram}</TableCell>
                    <TableCell className={cn('text-right tabular-nums', zero(g.conclusoes))}>{g.conclusoes}</TableCell>
                    <TableCell className={cn('pr-6 text-right font-semibold tabular-nums', g.conformidade == null ? 'text-slate-400' : corPct(g.conformidade))}>{g.conformidade == null ? '—' : fmtPct(g.conformidade)}</TableCell>
                  </TableRow>
                  {g.lista.length > 0 && <TableRow className="hover:bg-transparent"><TableCell colSpan={5} className="pl-6 pt-0"><details><summary className="cursor-pointer text-xs text-violet-700 dark:text-violet-300">Quem concluiu ({g.lista.length})</summary><ul className="mt-1 space-y-0.5 text-xs text-slate-600 dark:text-slate-300">{g.lista.map(p => <li key={p.email}><span className="font-medium text-slate-800 dark:text-slate-200">{p.nome}</span> — {p.cursos.join('; ')}</li>)}</ul></details></TableCell></TableRow>}
                </React.Fragment>
              );
            })}</TableBody></Table></div>
        )}
      </Seccao>
      <Seccao titulo="Cursos" descricao="Cobertura, conclusões e avaliações por curso.">
        {cursosTab.length === 0 ? <Vazio t="Sem cursos publicados." /> : <div className="overflow-x-auto"><Table>
          <TableHeader><TableRow><TableHead>Curso</TableHead><TableHead className="text-right">Inscritos</TableHead><TableHead className="text-right">Concluídos</TableHead><TableHead className="text-right">Em curso</TableHead><TableHead className="text-right">Obrig. p/</TableHead><TableHead className="text-right">Conformidade</TableHead><TableHead className="text-right">Tentativas</TableHead><TableHead className="text-right">Aprovação</TableHead><TableHead className="text-right">Nota média</TableHead><TableHead className="text-right">Tempo médio</TableHead><TableHead className="text-right">Horas</TableHead></TableRow></TableHeader>
          <TableBody>{cursosTab.map(c => <TableRow key={c.curso.id}><TableCell className="font-medium text-slate-900 dark:text-slate-100">{c.curso.titulo}</TableCell><TableCell className="text-right tabular-nums">{c.inscritos}</TableCell><TableCell className="text-right tabular-nums text-emerald-700 dark:text-emerald-400">{c.concluidos}</TableCell><TableCell className="text-right tabular-nums">{c.em_curso}</TableCell><TableCell className="text-right tabular-nums">{c.obrigatorioPara || '—'}</TableCell><TableCell className={cn('text-right font-semibold tabular-nums', corPct(c.conformidadePct))}>{fmtPct(c.conformidadePct)}</TableCell><TableCell className="text-right tabular-nums">{c.tentativas}</TableCell><TableCell className="text-right tabular-nums">{fmtPct(c.aprovacaoPct)}</TableCell><TableCell className="text-right tabular-nums">{c.notaMedia != null ? `${c.notaMedia}%` : '—'}</TableCell><TableCell className="text-right tabular-nums">{c.tempoMedioDias != null ? `${c.tempoMedioDias} d` : '—'}</TableCell><TableCell className="text-right tabular-nums">{c.horasEstudo}</TableCell></TableRow>)}</TableBody>
        </Table></div>}
      </Seccao>

      <div className="grid gap-4 lg:grid-cols-2">
        <Seccao titulo="Horas de estudo por colaborador" descricao="Tempo registado nas aulas (top 20).">
          {porPessoa.length === 0 ? <Vazio t="Ainda sem actividade registada." /> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Colaborador</TableHead><TableHead className="text-right">Horas</TableHead><TableHead className="text-right">Cursos</TableHead><TableHead className="text-right">Concluídos</TableHead></TableRow></TableHeader><TableBody>{porPessoa.slice(0, 20).map(p => <TableRow key={p.email}><TableCell><p className="font-medium text-slate-900 dark:text-slate-100">{p.nome}</p><p className="text-xs text-slate-500">{p.email}</p></TableCell><TableCell className="text-right tabular-nums">{p.horas}</TableCell><TableCell className="text-right tabular-nums">{p.cursos}</TableCell><TableCell className="text-right tabular-nums">{p.concluidos}</TableCell></TableRow>)}</TableBody></Table></div>}
        </Seccao>
        <Seccao titulo="Certificados emitidos por mês">
          <div className="h-64 px-2 pb-2"><ResponsiveContainer width="100%" height="100%"><BarChart data={certsPorMes} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="mes" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="certificados" name="Certificados" fill="#f59e0b" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div>
        </Seccao>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Seccao titulo="Cursos obrigatórios — pendências" descricao="Onde estão as faltas e os atrasos.">
          {cursosObrig.length === 0 ? <Vazio t="Nenhum curso está marcado como obrigatório." /> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Curso</TableHead><TableHead className="text-right">Obrig. p/</TableHead><TableHead className="text-right">Em falta</TableHead><TableHead className="text-right">Atrasados</TableHead><TableHead className="text-right">A expirar</TableHead><TableHead className="text-right">Expirados</TableHead><TableHead className="text-right">Válidos</TableHead></TableRow></TableHeader><TableBody>{cursosObrig.map(c => <TableRow key={c.curso.id}><TableCell className="font-medium">{c.curso.titulo}</TableCell><TableCell className="text-right tabular-nums">{c.obrigatorioPara}</TableCell><TableCell className={cn('text-right font-semibold tabular-nums', c.em_falta ? 'text-red-600' : 'text-slate-400')}>{c.em_falta}</TableCell><TableCell className={cn('text-right tabular-nums', c.atrasado ? 'text-amber-600' : 'text-slate-400')}>{c.atrasado}</TableCell><TableCell className={cn('text-right tabular-nums', c.a_expirar ? 'text-amber-600' : 'text-slate-400')}>{c.a_expirar}</TableCell><TableCell className={cn('text-right tabular-nums', c.expirado ? 'text-red-600' : 'text-slate-400')}>{c.expirado}</TableCell><TableCell className="text-right tabular-nums text-emerald-700 dark:text-emerald-400">{c.valido}</TableCell></TableRow>)}</TableBody></Table></div>}
        </Seccao>
        <Seccao titulo="Avaliações por curso" descricao="Tentativas submetidas, taxa de aprovação e nota média.">
          {cursosAval.length === 0 ? <Vazio t="Ainda sem tentativas." /> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Curso</TableHead><TableHead className="text-right">Tentativas</TableHead><TableHead className="text-right">Aprovação</TableHead><TableHead className="text-right">Nota média</TableHead><TableHead className="text-right">Por corrigir</TableHead></TableRow></TableHeader><TableBody>{cursosAval.map(c => <TableRow key={c.curso.id}><TableCell className="font-medium">{c.curso.titulo}</TableCell><TableCell className="text-right tabular-nums">{c.tentativas}</TableCell><TableCell className={cn('text-right font-semibold tabular-nums', corPct(c.aprovacaoPct))}>{fmtPct(c.aprovacaoPct)}</TableCell><TableCell className="text-right tabular-nums">{c.notaMedia != null ? `${c.notaMedia}%` : '—'}</TableCell><TableCell className={cn('text-right tabular-nums', c.porCorrigir ? 'text-amber-600' : 'text-slate-400')}>{c.porCorrigir}</TableCell></TableRow>)}</TableBody></Table></div>}
        </Seccao>
      </div>

      <Seccao titulo="Sessões e presenças" descricao="Sessões presenciais, online e híbridas (mais recentes primeiro).">
        {sessoes.length === 0 ? <Vazio t="Ainda não há sessões." /> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Sessão</TableHead><TableHead>Curso</TableHead><TableHead>Quando</TableHead><TableHead>Modalidade</TableHead><TableHead>Formador</TableHead><TableHead className="text-right">Inscritos</TableHead><TableHead className="text-right">Presentes</TableHead><TableHead className="text-right">Presença</TableHead></TableRow></TableHeader><TableBody>{sessoes.slice(0, 30).map(s => <TableRow key={s.id}><TableCell className="font-medium">{s.titulo}{!s.passada && <span className="ml-2 rounded bg-blue-100 px-1.5 text-[11px] font-semibold text-blue-800 dark:bg-blue-950/60 dark:text-blue-200">futura</span>}</TableCell><TableCell className="text-sm text-slate-600 dark:text-slate-300">{s.cursoTitulo}</TableCell><TableCell className="text-sm">{fmtPeriodoSessao(s)}</TableCell><TableCell className="text-sm">{MODALIDADE[s.modalidade]?.curto || s.modalidade}</TableCell><TableCell className="text-sm">{s.formador_nome || '—'}</TableCell><TableCell className="text-right tabular-nums">{s.inscritos}</TableCell><TableCell className="text-right tabular-nums">{s.passada ? s.presentes : '—'}</TableCell><TableCell className={cn('text-right font-semibold tabular-nums', s.passada ? corPct(s.presencaPct) : 'text-slate-400')}>{s.passada ? fmtPct(s.presencaPct) : '—'}</TableCell></TableRow>)}</TableBody></Table></div>}
      </Seccao>
      <p className="text-xs text-slate-500"><BarChart3 className="mr-1 inline h-3 w-3" aria-hidden="true" />Os mesmos dados alimentam a Visão geral de <Link to={`${PORTAL_BASE}/gestao/cursos`} className="underline">Cursos e conteúdos</Link>, o relatório semanal por email e a matriz colaborador × curso. <BookOpen className="ml-2 mr-1 inline h-3 w-3" aria-hidden="true" />Conformidade = obrigatórios válidos ÷ obrigatórios devidos.</p>
    </PaginaGestao>
  );
}
