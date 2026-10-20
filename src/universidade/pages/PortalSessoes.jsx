// Agenda de sessões (presenciais, online e híbridas) de todos os cursos, com inscrição/cancelamento e link de entrada.
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarDays, MapPin, Video, Users, Loader2, XCircle, ExternalLink, User as UserIcon, CheckCircle2, Clock, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import { useCursosPublicados, useMinhasMatriculas, inscreverSessao, cancelarInscricaoSessao, registarEntradaSessao } from '@/hooks/useFormacao';
import { MODALIDADE, PLATAFORMAS, ESTADO_INSCRICAO, faseSessao, podeInscrever, fmtPeriodoSessao, temLink, linkAberto, localTexto } from '@/lib/formacaoSessoes';
import { PORTAL_BASE, urlCursoPortal } from '@/lib/universidade';
import { useSessoesPortal } from '../hooks';

export const rotuloModalidade = (s) => { const m = MODALIDADE?.[s?.modalidade]; return (typeof m === 'string' ? m : m?.curto || m?.label) || (s?.modalidade || 'Presencial'); };
export const fmtDataHora = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); };

function Sessao({ s, curso, inscricao, matricula, busy, onInscrever, onCancelar }) {
  const fase = faseSessao(s);
  const m = MODALIDADE[s.modalidade] || MODALIDADE.presencial;
  const activa = inscricao && inscricao.estado !== 'cancelado';
  const est = activa ? ESTADO_INSCRICAO[inscricao.estado] : null;
  const podeIns = podeInscrever(s, inscricao);
  const abrirLink = async () => { registarEntradaSessao(s.id); window.open(s.link_online, '_blank', 'noopener'); };
  const d = new Date(s.inicio);
  return (
    <li className={cn('flex flex-col gap-3 p-4 md:flex-row md:items-start', s.estado === 'cancelada' && 'opacity-60')}>
      <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-violet-50 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200"><span className="text-[10px] font-semibold uppercase">{d.toLocaleDateString('pt-PT', { month: 'short' }).replace('.', '')}</span><span className="text-xl font-bold leading-none tabular-nums">{d.getDate()}</span><span className="text-[10px]">{d.toLocaleDateString('pt-PT', { weekday: 'short' }).replace('.', '')}</span></div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-slate-900 dark:text-slate-100">{s.titulo}</p><span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', m.cor)}>{m.curto}</span>{s.estado === 'cancelada' && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700">Cancelada</span>}{est && <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', est.cor)}>{est.label}{inscricao.modo && s.modalidade === 'hibrida' ? ` · ${inscricao.modo}` : ''}</span>}</div>
        {curso && <Link to={urlCursoPortal(curso.id)} className="text-sm text-violet-700 hover:underline dark:text-violet-300">{curso.titulo}</Link>}
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-slate-300"><span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" aria-hidden="true" />{fmtPeriodoSessao(s)}</span>{s.modalidade !== 'online' && localTexto(s) && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{localTexto(s)}</span>}{s.modalidade !== 'presencial' && <span className="inline-flex items-center gap-1"><Video className="h-3.5 w-3.5" aria-hidden="true" />{PLATAFORMAS[s.plataforma] || 'Videochamada'}</span>}{s.formador_nome && <span className="inline-flex items-center gap-1"><UserIcon className="h-3.5 w-3.5" aria-hidden="true" />{s.formador_nome}</span>}{s.vagas != null && s.modalidade !== 'online' && <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" aria-hidden="true" />{s.vagas} lugares</span>}</p>
        {s.descricao && <p className="text-sm text-slate-500 dark:text-slate-400">{s.descricao}</p>}
      </div>
      <div className="flex shrink-0 flex-wrap gap-2 md:flex-col md:items-end">
        {activa && temLink(s) && linkAberto(s) && <Button size="sm" onClick={abrirLink}><ExternalLink className="h-4 w-4" aria-hidden="true" />Entrar na sessão</Button>}
        {activa && fase === 'futura' && <Button size="sm" variant="outline" disabled={busy === s.id} onClick={() => onCancelar(inscricao)}>{busy === s.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <XCircle className="h-4 w-4" aria-hidden="true" />}Cancelar inscrição</Button>}
        {!activa && podeIns && matricula && s.modalidade === 'hibrida' && <><Button size="sm" disabled={busy === s.id} onClick={() => onInscrever(s, 'presencial')}>{busy === s.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <MapPin className="h-4 w-4" aria-hidden="true" />}Presencial</Button><Button size="sm" variant="outline" disabled={busy === s.id} onClick={() => onInscrever(s, 'online')}><Video className="h-4 w-4" aria-hidden="true" />Online</Button></>}
        {!activa && podeIns && matricula && s.modalidade !== 'hibrida' && <Button size="sm" disabled={busy === s.id} onClick={() => onInscrever(s, null)}>{busy === s.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}Inscrever-me</Button>}
        {!activa && podeIns && !matricula && curso && <Button asChild size="sm" variant="outline"><Link to={urlCursoPortal(curso.id)}>Inscrever-me no curso<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></Button>}
      </div>
    </li>
  );
}

export default function PortalSessoes() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useSessoesPortal(user?.email);
  const { data: cursos = [] } = useCursosPublicados();
  const { data: matriculas = [] } = useMinhasMatriculas(user?.email);
  const [busy, setBusy] = useState(null);
  const cursosById = useMemo(() => Object.fromEntries(cursos.map(c => [c.id, c])), [cursos]);
  const matPorCurso = useMemo(() => Object.fromEntries(matriculas.map(m => [m.curso_id, m])), [matriculas]);
  const inscPorSessao = useMemo(() => { const o = {}; for (const i of data?.inscricoes || []) { if (!o[i.sessao_id] || i.estado !== 'cancelado') o[i.sessao_id] = i; } return o; }, [data]);
  const sessoes = data?.sessoes || [];
  const proximas = sessoes.filter(s => faseSessao(s) !== 'passada' && (s.estado !== 'cancelada' || (inscPorSessao[s.id] && inscPorSessao[s.id].estado !== 'cancelado')));
  const passadas = sessoes.filter(s => faseSessao(s) === 'passada').reverse();
  const minhas = proximas.filter(s => inscPorSessao[s.id] && inscPorSessao[s.id].estado !== 'cancelado');
  const refrescar = () => Promise.all([qc.invalidateQueries({ queryKey: ['sessao_formacao'] }), qc.invalidateQueries({ queryKey: ['sessao_inscricao'] })]);
  const inscrever = async (s, modo) => {
    setBusy(s.id);
    try { const i = await inscreverSessao(s.id, modo); toast({ title: i?.estado === 'lista_espera' ? 'Ficou em lista de espera' : 'Inscrição confirmada', description: i?.estado === 'lista_espera' ? 'A sala está cheia; avisamos se abrir vaga.' : 'Recebe a convocatória por email.' }); await refrescar(); }
    catch (e) { toast({ title: 'Não foi possível inscrever', description: e?.message || String(e), variant: 'destructive' }); } finally { setBusy(null); }
  };
  const cancelar = async (i) => {
    setBusy(i.sessao_id);
    try { await cancelarInscricaoSessao(i.id); toast({ title: 'Inscrição cancelada' }); await refrescar(); }
    catch (e) { toast({ title: 'Não foi possível cancelar', description: e?.message || String(e), variant: 'destructive' }); } finally { setBusy(null); }
  };
  const Lista = ({ itens, vazio }) => (
    <Card className="dark:border-slate-800 dark:bg-slate-900"><CardContent className="p-0">{itens.length === 0 ? <p className="p-5 text-sm text-slate-500">{vazio}</p> : <ul className="divide-y dark:divide-slate-800">{itens.map(s => <Sessao key={s.id} s={s} curso={cursosById[s.curso_id]} inscricao={inscPorSessao[s.id]} matricula={matPorCurso[s.curso_id]} busy={busy} onInscrever={inscrever} onCancelar={cancelar} />)}</ul>}</CardContent></Card>
  );

  return (
    <div className="space-y-8">
      <div><h1 className="flex items-center gap-3 text-2xl font-bold text-slate-900 dark:text-slate-100 md:text-3xl"><CalendarDays className="h-8 w-8 text-violet-600" aria-hidden="true" />Sessões de formação</h1><p className="mt-1 text-slate-600 dark:text-slate-400">Formações presenciais, online e híbridas marcadas pelos instrutores. Para se inscrever precisa de estar inscrito no curso.</p></div>
      {isLoading ? <div className="space-y-3"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div> : (
        <>
          {minhas.length > 0 && <section className="space-y-3"><h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">As minhas próximas sessões</h2><Lista itens={minhas} vazio="" /></section>}
          <section className="space-y-3"><h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Agenda</h2><Lista itens={proximas.filter(s => !minhas.includes(s))} vazio="Não há sessões agendadas de momento. Os instrutores avisam por email quando marcarem novas sessões." /></section>
          <section className="space-y-3"><h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Sessões recentes</h2><Lista itens={passadas.slice(0, 10)} vazio="Sem sessões nos últimos 60 dias." /></section>
        </>
      )}
      <p className="text-sm text-slate-500">Não encontra a sessão que procura? Veja a página do curso em <Link to={`${PORTAL_BASE}/formacao`} className="underline">Cursos</Link> ou fale com o instrutor.</p>
    </div>
  );
}
