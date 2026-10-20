import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ShieldCheck, AlertTriangle, Hourglass, ClipboardCheck, Users, Mail, UserPlus, Grid3x3, GraduationCap } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { useDadosMatriz, useTodosCertificados, useTentativasTodas, useQuizzesTodos, useAtividadeTodas, useAeroportosUc } from '@/hooks/useGestaoFormacao';
import { matrizFormacao } from '@/lib/formacaoEstado';
import { indicadoresFormacao } from '@/lib/formacaoIndicadores';
import { exportarPdf, fmtDataCurta } from '@/lib/formacaoExport';
import { fmtData } from '../formacaoUtils';
import BotoesExportar from './BotoesExportar';
import InscreverEmFaltaDialog from './InscreverEmFaltaDialog';
import LembreteDialog from './LembreteDialog';

const COR = { inscricoes: '#2563eb', conclusoes: '#059669', certificados: '#d97706' };
const corPct = (p) => (p == null ? 'text-slate-400' : p >= 90 ? 'text-emerald-600' : p >= 70 ? 'text-amber-600' : 'text-red-600');
const barraPct = (p) => (p == null ? 'bg-slate-300' : p >= 90 ? 'bg-emerald-500' : p >= 70 ? 'bg-amber-500' : 'bg-red-500');
const fmtPct = (p) => (p == null ? '—' : `${p}%`);

// Perfis de função do DIROPS (é por eles que a formação obrigatória é atribuída); os perfis de acesso à Universidade (formando/instrutor) gerem-se em Acessos.
const PERFIL_LABEL = { admin_universidade: 'Administrador da Universidade', administrador: 'Administrador', instrutor: 'Instrutor', formando: 'Formando', operacoes: 'Operações', safety: 'Safety', infraestrutura: 'Infraestrutura', credenciamento: 'Credenciamento', gestor_empresa: 'Gestor de empresa', visualizador: 'Visualizador', documentos_ged: 'Documentos (GED)', '(sem perfil)': '(sem perfil)' };
const rotuloPerfil = (k) => PERFIL_LABEL[k] || k;

function BarrasConformidade({ titulo, descricao, itens, vazio, rotulo = (k) => k }) {
  return (
    <Card className="dark:border-slate-800 dark:bg-slate-900">
      <CardHeader className="pb-2"><CardTitle className="text-base">{titulo}</CardTitle><CardDescription>{descricao}</CardDescription></CardHeader>
      <CardContent>
        {itens.length === 0 ? <p className="py-4 text-center text-sm text-slate-500">{vazio}</p> : (
          <ul className="space-y-2">{itens.map(i => (
            <li key={i.chave}>
              <div className="flex items-baseline justify-between gap-2 text-sm"><span className="truncate font-medium text-slate-800 dark:text-slate-200">{rotulo(i.chave)}</span><span className={cn('shrink-0 tabular-nums', corPct(i.pct))}>{fmtPct(i.pct)} <span className="text-xs text-slate-500">({i.validos}/{i.devidos} · {i.pessoas} {i.pessoas === 1 ? 'pessoa' : 'pessoas'})</span></span></div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="progressbar" aria-valuenow={i.pct ?? 0} aria-valuemin={0} aria-valuemax={100} aria-label={`${rotulo(i.chave)}: ${fmtPct(i.pct)}`}><div className={cn('h-full rounded-full', barraPct(i.pct))} style={{ width: `${i.pct ?? 0}%` }} /></div>
            </li>
          ))}</ul>
        )}
      </CardContent>
    </Card>
  );
}

function ListaVencimentos({ titulo, cor, itens }) {
  return (
    <div className="rounded-md border p-3 dark:border-slate-700">
      <div className="flex items-baseline justify-between"><p className="text-sm font-medium text-slate-800 dark:text-slate-200">{titulo}</p><p className={cn('text-2xl font-bold tabular-nums', cor)}>{itens.length}</p></div>
      {itens.length > 0 && <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">{itens.slice(0, 6).map((i, k) => <li key={k} className="flex justify-between gap-2"><span className="truncate">{i.user.full_name || i.user.email} · <span className="text-slate-500">{i.curso.titulo}</span></span><span className="shrink-0 tabular-nums">{i.dias < 0 ? `há ${Math.abs(i.dias)} d` : `${i.dias} d`}</span></li>)}{itens.length > 6 && <li className="text-slate-400">… e mais {itens.length - 6}</li>}</ul>}
    </div>
  );
}

// Visão geral da formação: conformidade, vencimentos, pendências por curso, avaliações, actividade, externas.
export default function VisaoGeral({ user, onAbrirCurso, onIrTab }) {
  const { toast } = useToast();
  const { data, isLoading } = useDadosMatriz();
  const { data: certificados = [] } = useTodosCertificados();
  const { data: tentativas = [] } = useTentativasTodas();
  const { data: quizzes = [] } = useQuizzesTodos();
  const { data: atividades = [] } = useAtividadeTodas();
  // Só aeroportos da SGA (mesmo critério do resto do sistema: isSGA === true)
  const { data: aeroportosUc = [] } = useAeroportosUc(); const aeroportosSGA = aeroportosUc.map(a => ({ codigo_icao: a.codigo, nome: a.nome }));
  const [emFalta, setEmFalta] = useState(null);   // null | cursoId | 'todos'
  const [lembrete, setLembrete] = useState(null);

  const matriz = useMemo(() => (data ? matrizFormacao(data) : null), [data]);
  const ind = useMemo(() => (matriz ? indicadoresFormacao({ matriz, cursos: data.cursos, matriculas: data.matriculas, tentativas, quizzes, certificados, externas: data.externas, atividades, aeroportos: aeroportosSGA }) : null), [matriz, data, tentativas, quizzes, certificados, atividades, aeroportosSGA]);

  if (isLoading || !matriz || !ind) return <div className="space-y-3"><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></div>;

  const t = ind.totais;
  const kpis = [
    { l: 'Conformidade', v: fmtPct(ind.conformidade.pct), cls: corPct(ind.conformidade.pct), sub: `${ind.conformidade.validos} de ${ind.conformidade.devidos} obrigatórios válidos`, icon: ShieldCheck },
    { l: 'Em falta', v: t.em_falta || 0, cls: 'text-red-600', sub: 'obrigatórios sem inscrição', icon: AlertTriangle },
    { l: 'Expirados', v: t.expirado || 0, cls: 'text-red-600', sub: 'certificações a renovar', icon: AlertTriangle },
    { l: 'A expirar 30 d', v: ind.vencimentos.d30.length, cls: 'text-amber-600', sub: `${ind.vencimentos.d60.length} a 60 d · ${ind.vencimentos.d90.length} a 90 d`, icon: Hourglass },
    { l: 'Por corrigir', v: ind.porCorrigir, cls: ind.porCorrigir ? 'text-amber-600' : 'text-slate-900 dark:text-slate-100', sub: 'respostas abertas', icon: ClipboardCheck },
    { l: 'Com pendências', v: ind.comPendencias, cls: ind.comPendencias ? 'text-red-600' : 'text-slate-900 dark:text-slate-100', sub: `de ${ind.colaboradores} colaboradores`, icon: Users },
  ];
  const cursosObrig = ind.porCurso.filter(c => c.obrigatorioPara > 0);
  const cursosAval = ind.porCurso.filter(c => c.tentativas > 0);

  const exportarPdfGeral = () => exportarPdf({ base: 'Formacao_visao_geral', titulo: 'Formação — visão geral', subtitulo: 'Universidade Corporativa', paisagem: true, empresaId: user?.empresa_id, geradoPor: user?.email,
    meta: [`${ind.colaboradores} colaboradores · ${data.cursos.length} cursos publicados`],
    seccoes: [
      { titulo: 'Resumo', pares: kpis.map(k => ({ label: k.l, value: String(k.v) })) },
      { titulo: 'Conformidade por perfil', colunas: [{ label: 'Perfil', width: 60 }, { label: 'Pessoas', width: 20, align: 'right' }, { label: 'Devidos', width: 20, align: 'right' }, { label: 'Válidos', width: 20, align: 'right' }, { label: 'Em falta', width: 20, align: 'right' }, { label: 'Expirados', width: 22, align: 'right' }, { label: 'Conformidade', width: 26, align: 'right' }], linhas: ind.porPerfil.map(p => [rotuloPerfil(p.chave), p.pessoas, p.devidos, p.validos, p.emFalta, p.expirados, fmtPct(p.pct)]), vazio: 'Sem cursos obrigatórios.' },
      { titulo: 'Conformidade por aeroporto', colunas: [{ label: 'Aeroporto', width: 60 }, { label: 'Pessoas', width: 20, align: 'right' }, { label: 'Devidos', width: 20, align: 'right' }, { label: 'Válidos', width: 20, align: 'right' }, { label: 'Conformidade', width: 26, align: 'right' }], linhas: ind.porAeroporto.map(p => [p.chave, p.pessoas, p.devidos, p.validos, fmtPct(p.pct)]), vazio: 'Sem cursos obrigatórios.' },
      { titulo: 'Vencimentos (próximos 90 dias e expirados)', colunas: [{ label: 'Janela', width: 26 }, { label: 'Colaborador', width: 60 }, { label: 'Curso', width: 70 }, { label: 'Válido até', width: 24 }, { label: 'Dias', width: 20, align: 'right' }], linhas: [...ind.vencimentos.expirados.map(i => ['Expirado', i.user.full_name || i.user.email, i.curso.titulo, fmtDataCurta(i.validoAte), i.dias]), ...ind.vencimentos.d30.map(i => ['0–30 d', i.user.full_name || i.user.email, i.curso.titulo, fmtDataCurta(i.validoAte), i.dias]), ...ind.vencimentos.d60.map(i => ['31–60 d', i.user.full_name || i.user.email, i.curso.titulo, fmtDataCurta(i.validoAte), i.dias]), ...ind.vencimentos.d90.map(i => ['61–90 d', i.user.full_name || i.user.email, i.curso.titulo, fmtDataCurta(i.validoAte), i.dias])], vazio: 'Sem vencimentos nos próximos 90 dias.' },
      { titulo: 'Cursos obrigatórios — pendências', colunas: [{ label: 'Curso', width: 70 }, { label: 'Obrig. p/', width: 20, align: 'right' }, { label: 'Em falta', width: 20, align: 'right' }, { label: 'Atrasados', width: 22, align: 'right' }, { label: 'A expirar', width: 20, align: 'right' }, { label: 'Expirados', width: 22, align: 'right' }, { label: 'Válidos', width: 18, align: 'right' }, { label: 'Conformidade', width: 26, align: 'right' }], linhas: cursosObrig.map(c => [c.curso.titulo, c.obrigatorioPara, c.em_falta, c.atrasado, c.a_expirar, c.expirado, c.valido, fmtPct(c.conformidadePct)]), vazio: 'Nenhum curso marcado como obrigatório.' },
      { titulo: 'Avaliações por curso', colunas: [{ label: 'Curso', width: 80 }, { label: 'Tentativas', width: 24, align: 'right' }, { label: 'Aprovação', width: 24, align: 'right' }, { label: 'Nota média', width: 24, align: 'right' }, { label: 'Por corrigir', width: 26, align: 'right' }, { label: 'Tempo médio p/ concluir', width: 40, align: 'right' }], linhas: cursosAval.map(c => [c.curso.titulo, c.tentativas, fmtPct(c.aprovacaoPct), c.notaMedia != null ? `${c.notaMedia}%` : '—', c.porCorrigir, c.tempoMedioDias != null ? `${c.tempoMedioDias} d` : '—']), vazio: 'Ainda sem tentativas.' },
      { titulo: 'Actividade (12 meses)', colunas: [{ label: 'Mês', width: 30 }, { label: 'Inscrições', width: 26, align: 'right' }, { label: 'Conclusões', width: 26, align: 'right' }, { label: 'Certificados', width: 26, align: 'right' }], linhas: ind.atividade.map(a => [a.label, a.inscricoes, a.conclusoes, a.certificados]) },
      { titulo: 'Formação externa', pares: [{ label: 'Registos', value: String(ind.externas.total) }, { label: 'A expirar (90 d)', value: String(ind.externas.aExpirar90) }, { label: 'Expirados', value: String(ind.externas.expiradas) }] },
    ] });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600 dark:text-slate-400">Estado da formação hoje, {fmtData(new Date().toISOString())}. Conformidade = obrigatórios válidos ÷ obrigatórios devidos.</p>
        <div className="flex gap-2"><BotoesExportar onPdf={exportarPdfGeral} /><Button variant="outline" size="sm" onClick={() => onIrTab?.('matriz')}><Grid3x3 className="h-4 w-4" aria-hidden="true" />Matriz</Button></div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{kpis.map(k => { const Icon = k.icon; return (
        <Card key={k.l} className="dark:border-slate-800 dark:bg-slate-900"><CardContent className="p-3">
          <div className="flex items-center justify-between"><p className="text-xs text-slate-500 dark:text-slate-400">{k.l}</p><Icon className="h-4 w-4 text-slate-400" aria-hidden="true" /></div>
          <p className={cn('mt-1 text-2xl font-bold tabular-nums', k.cls)}>{k.v}</p><p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{k.sub}</p>
        </CardContent></Card>
      ); })}</div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BarrasConformidade titulo="Conformidade por perfil" descricao="Obrigatórios válidos sobre os devidos, por perfil da Universidade (formando, instrutor, administrador) — é por estes perfis que a formação obrigatória se atribui, em «Editar dados» do curso. Os perfis de acesso à Universidade (formando, instrutor) gerem-se em Acessos." itens={ind.porPerfil} vazio="Nenhum curso está marcado como obrigatório." rotulo={rotuloPerfil} />
        <BarrasConformidade titulo="Conformidade por aeroporto" descricao="Segundo o aeroporto de cada formando na Universidade (editável em Acessos › Editar e em A minha conta)." itens={ind.porAeroporto} vazio={aeroportosSGA.length === 0 ? 'Nenhum aeroporto está marcado como SGA em Configurações → Aeroportos.' : 'Nenhum curso está marcado como obrigatório.'} />
      </div>

      <Card className="dark:border-slate-800 dark:bg-slate-900">
        <CardHeader className="pb-2"><CardTitle className="text-base">Vencimentos</CardTitle><CardDescription>Certificações e formações externas com validade, por janela de dias. Os lembretes automáticos saem a 30 e 7 dias.</CardDescription></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <ListaVencimentos titulo="Expirados" cor="text-red-600" itens={ind.vencimentos.expirados} />
          <ListaVencimentos titulo="0 – 30 dias" cor="text-amber-600" itens={ind.vencimentos.d30} />
          <ListaVencimentos titulo="31 – 60 dias" cor="text-amber-500" itens={ind.vencimentos.d60} />
          <ListaVencimentos titulo="61 – 90 dias" cor="text-slate-700 dark:text-slate-200" itens={ind.vencimentos.d90} />
        </CardContent>
      </Card>

      <Card className="dark:border-slate-800 dark:bg-slate-900">
        <CardHeader className="pb-2"><CardTitle className="text-base">Cursos obrigatórios — pendências</CardTitle><CardDescription>Inscreva quem falta e lembre quem está atrasado directamente daqui.</CardDescription></CardHeader>
        <CardContent className="p-0">
          {cursosObrig.length === 0 ? <p className="px-6 py-6 text-sm text-slate-500">Nenhum curso está marcado como obrigatório. Defina em Editar dados do curso.</p> : (
            <div className="overflow-x-auto"><Table>
              <TableHeader><TableRow><TableHead>Curso</TableHead><TableHead className="text-right">Obrig. p/</TableHead><TableHead className="text-right">Em falta</TableHead><TableHead className="text-right">Atrasados</TableHead><TableHead className="text-right">A expirar</TableHead><TableHead className="text-right">Expirados</TableHead><TableHead className="text-right">Válidos</TableHead><TableHead className="text-right">Conformidade</TableHead><TableHead className="text-right">Acções</TableHead></TableRow></TableHeader>
              <TableBody>{cursosObrig.map(c => (
                <TableRow key={c.curso.id}>
                  <TableCell><button type="button" className="text-left font-medium text-slate-900 hover:underline dark:text-slate-100" onClick={() => onAbrirCurso?.(c.curso.id, 'alunos')}>{c.curso.titulo}</button></TableCell>
                  <TableCell className="text-right tabular-nums">{c.obrigatorioPara}</TableCell>
                  <TableCell className={cn('text-right font-semibold tabular-nums', c.em_falta ? 'text-red-600' : 'text-slate-400')}>{c.em_falta}</TableCell>
                  <TableCell className={cn('text-right font-semibold tabular-nums', c.atrasado ? 'text-amber-600' : 'text-slate-400')}>{c.atrasado}</TableCell>
                  <TableCell className={cn('text-right tabular-nums', c.a_expirar ? 'text-amber-600' : 'text-slate-400')}>{c.a_expirar}</TableCell>
                  <TableCell className={cn('text-right tabular-nums', c.expirado ? 'text-red-600' : 'text-slate-400')}>{c.expirado}</TableCell>
                  <TableCell className="text-right tabular-nums text-emerald-700 dark:text-emerald-400">{c.valido}</TableCell>
                  <TableCell className={cn('text-right font-semibold tabular-nums', corPct(c.conformidadePct))}>{fmtPct(c.conformidadePct)}</TableCell>
                  <TableCell className="text-right"><div className="flex justify-end gap-0.5">
                    {c.em_falta > 0 && <Button variant="ghost" size="sm" onClick={() => setEmFalta(c.curso.id)}><UserPlus className="h-4 w-4" aria-hidden="true" />Inscrever</Button>}
                    {c.atrasados.length > 0 && <Button variant="ghost" size="sm" onClick={() => setLembrete(c.atrasados.map(a => ({ curso: c.curso, matricula: a.matricula, email: a.user.email, nome: a.user.full_name })))}><Mail className="h-4 w-4" aria-hidden="true" />Lembrar</Button>}
                  </div></TableCell>
                </TableRow>
              ))}</TableBody>
            </Table></div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="dark:border-slate-800 dark:bg-slate-900">
          <CardHeader className="pb-2"><CardTitle className="text-base">Avaliações por curso</CardTitle><CardDescription>Tentativas submetidas, aprovação, nota média e tempo médio até concluir.</CardDescription></CardHeader>
          <CardContent className="p-0">
            {cursosAval.length === 0 ? <p className="px-6 py-6 text-sm text-slate-500">Ainda não há tentativas submetidas.</p> : (
              <div className="overflow-x-auto"><Table>
                <TableHeader><TableRow><TableHead>Curso</TableHead><TableHead className="text-right">Tent.</TableHead><TableHead className="text-right">Aprovação</TableHead><TableHead className="text-right">Nota média</TableHead><TableHead className="text-right">Por corrigir</TableHead><TableHead className="text-right">Tempo médio</TableHead><TableHead className="text-right">Estudo (h)</TableHead></TableRow></TableHeader>
                <TableBody>{cursosAval.map(c => (
                  <TableRow key={c.curso.id}>
                    <TableCell><button type="button" className="text-left font-medium text-slate-900 hover:underline dark:text-slate-100" onClick={() => onAbrirCurso?.(c.curso.id, 'avaliacao')}>{c.curso.titulo}</button></TableCell>
                    <TableCell className="text-right tabular-nums">{c.tentativas}</TableCell>
                    <TableCell className={cn('text-right font-semibold tabular-nums', corPct(c.aprovacaoPct))}>{fmtPct(c.aprovacaoPct)}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.notaMedia != null ? `${c.notaMedia}%` : '—'}</TableCell>
                    <TableCell className={cn('text-right tabular-nums', c.porCorrigir ? 'font-semibold text-amber-600' : 'text-slate-400')}>{c.porCorrigir}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.tempoMedioDias != null ? `${c.tempoMedioDias} d` : '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.horasEstudo || '—'}</TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table></div>
            )}
          </CardContent>
        </Card>
        <Card className="dark:border-slate-800 dark:bg-slate-900">
          <CardHeader className="pb-2"><CardTitle className="text-base">Actividade nos últimos 12 meses</CardTitle><CardDescription>Inscrições, conclusões e certificados emitidos por mês.</CardDescription></CardHeader>
          <CardContent>
            <div className="h-64" role="img" aria-label="Gráfico de inscrições, conclusões e certificados por mês">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ind.atividade} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip /><Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="inscricoes" name="Inscrições" fill={COR.inscricoes} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="conclusoes" name="Conclusões" fill={COR.conclusoes} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="certificados" name="Certificados" fill={COR.certificados} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
              <span className="inline-flex items-center gap-1"><GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />Formação externa: <strong>{ind.externas.total}</strong></span>
              <span>a expirar em 90 d: <strong className={ind.externas.aExpirar90 ? 'text-amber-600' : ''}>{ind.externas.aExpirar90}</strong></span>
              <span>expiradas: <strong className={ind.externas.expiradas ? 'text-red-600' : ''}>{ind.externas.expiradas}</strong></span>
              <span>colaboradores com inscrições: <strong>{ind.inscritos}</strong></span>
              <span>horas de estudo registadas: <strong>{ind.horasEstudo}</strong></span>
            </div>
          </CardContent>
        </Card>
      </div>

      <InscreverEmFaltaDialog isOpen={!!emFalta} onClose={() => setEmFalta(null)} matriz={matriz} cursoId={emFalta && emFalta !== 'todos' ? emFalta : null} user={user} onDone={(n) => toast({ title: n === 1 ? '1 inscrição criada' : `${n} inscrições criadas` })} />
      <LembreteDialog isOpen={!!lembrete} onClose={() => setLembrete(null)} alvos={lembrete || []} user={user} />
    </div>
  );
}
