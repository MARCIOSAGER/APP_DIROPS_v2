// Painel de gestão do portal: indicadores rápidos, perguntas dos formandos sem resposta, atalhos e últimos eventos.
import React from 'react';
import { Link } from 'react-router-dom';
import { Users, UserPlus, Mail, BookOpen, Award, CalendarDays, Inbox, ScrollText, ArrowRight, AlertTriangle, CheckCircle2, Activity, Presentation, ShieldCheck, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import { useTodosCursos, useDadosMatriz, useTodosCertificados, useSessoesTodas } from '@/hooks/useGestaoFormacao';
import { PORTAL_BASE, resumoAcessos, descreverAcao, CORES_BADGE, urlCursoPortal } from '@/lib/universidade';
import { useAcessos, useEstadoAcessos, useTicketsUniversidade, useAuditoriaUniversidade, usePerguntasSemResposta } from '../../hooks';
import { PaginaGestao, NAV_GESTAO } from '../../PortalLayout';

function Kpi({ icon: Icon, label, valor, sub, to, cor = 'text-slate-900 dark:text-slate-100', loading }) {
  const inner = (
    <CardContent className="p-4">
      <div className="flex items-center justify-between"><p className="text-xs text-slate-500 dark:text-slate-400">{label}</p><Icon className="h-4 w-4 text-slate-400" aria-hidden="true" /></div>
      {loading ? <Skeleton className="mt-2 h-7 w-12" /> : <p className={cn('mt-1 text-2xl font-bold tabular-nums', cor)}>{valor}</p>}
      {sub && <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{sub}</p>}
    </CardContent>
  );
  const cls = 'dark:border-slate-800 dark:bg-slate-900 transition-shadow hover:shadow-md';
  return to ? <Link to={to} className="block"><Card className={cls}>{inner}</Card></Link> : <Card className={cls}>{inner}</Card>;
}

export default function PortalGestaoPainel() {
  const { user } = useAuth();
  const acessosQ = useAcessos();
  const estadoQ = useEstadoAcessos();
  const cursosQ = useTodosCursos();
  const matrizQ = useDadosMatriz();
  const certsQ = useTodosCertificados();
  const sessoesQ = useSessoesTodas();
  const ticketsQ = useTicketsUniversidade();
  const auditQ = useAuditoriaUniversidade({ limite: 8 });
  const perguntasQ = usePerguntasSemResposta(6);
  const agora = Date.now(); const d30 = agora - 30 * 86400000;
  const ac = acessosQ.data ? resumoAcessos(acessosQ.data) : null;
  const cursos = cursosQ.data || [];
  const cursosById = Object.fromEntries(cursos.map(c => [c.id, c]));
  const matriculas = matrizQ.data?.matriculas || [];
  const certs = (certsQ.data || []).filter(c => !c.revogado_em);
  const sessoesProx = (sessoesQ.data?.sessoes || []).filter(s => s.estado !== 'cancelada' && new Date(s.inicio).getTime() >= agora);
  const ticketsAbertos = (ticketsQ.data || []).filter(t => ['aberta', 'em_analise'].includes(t.status));
  const backendOff = acessosQ.isError && acessosQ.error?.status === 404;
  const perguntas = perguntasQ.data;

  return (
    <PaginaGestao titulo="Gestão da Universidade" descricao={`Olá ${user?.full_name?.split(' ')[0] || ''}. Estado da Universidade hoje, ${new Date().toLocaleDateString('pt-PT')}.`}
      accoes={<><Button asChild variant="outline"><Link to={`${PORTAL_BASE}/gestao/cursos`}><Presentation className="h-4 w-4" aria-hidden="true" />Cursos e conteúdos</Link></Button><Button asChild><Link to={`${PORTAL_BASE}/gestao/acessos`}><UserPlus className="h-4 w-4" aria-hidden="true" />Convidar</Link></Button></>}>
      {backendOff && <div role="alert" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><span>O serviço de acessos e convites ainda não está activo no servidor: falta reiniciar o serviço <code>dirops-functions-v2</code>. Tudo o resto funciona.</span></div>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <Kpi icon={UserPlus} label="Pedidos pendentes" valor={ac ? ac.pendentes : '—'} cor={ac?.pendentes ? 'text-amber-600' : undefined} to={`${PORTAL_BASE}/gestao/acessos`} loading={acessosQ.isLoading} />
        <Kpi icon={Mail} label="Convites por aceitar" valor={ac ? ac.porAceitar : '—'} to={`${PORTAL_BASE}/gestao/acessos?tab=convites`} loading={acessosQ.isLoading} />
        <Kpi icon={Users} label="Utilizadores activos" valor={ac ? ac.ativos : '—'} sub={ac ? `${ac.formandos} só formandos · ${ac.semLogin30d} sem login 30 d` : undefined} to={`${PORTAL_BASE}/gestao/acessos?tab=utilizadores`} loading={acessosQ.isLoading} />
        <Kpi icon={MessageSquare} label="Perguntas sem resposta" valor={perguntas ? perguntas.total : '—'} cor={perguntas?.total ? 'text-amber-600' : undefined} sub="comentários de formandos" loading={perguntasQ.isLoading} />
        <Kpi icon={BookOpen} label="Cursos publicados" valor={cursos.filter(c => c.publicado).length} sub={`${cursos.length} no total`} to={`${PORTAL_BASE}/gestao/cursos`} loading={cursosQ.isLoading} />
        <Kpi icon={Activity} label="Matrículas activas" valor={matriculas.filter(m => m.estado === 'ativo').length} sub={`${matriculas.filter(m => m.concluido_em && new Date(m.concluido_em).getTime() >= d30).length} conclusões em 30 d`} to={`${PORTAL_BASE}/gestao/relatorios`} loading={matrizQ.isLoading} />
        <Kpi icon={Award} label="Certificados 30 d" valor={certs.filter(c => new Date(c.emitido_em).getTime() >= d30).length} sub={`${certs.length} válidos no total`} to={`${PORTAL_BASE}/gestao/relatorios`} loading={certsQ.isLoading} />
        <Kpi icon={Inbox} label="Tickets abertos" valor={ticketsAbertos.length} cor={ticketsAbertos.length ? 'text-amber-600' : undefined} sub={`${sessoesProx.length} sessões futuras`} to={`${PORTAL_BASE}/gestao/suporte`} loading={ticketsQ.isLoading} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          <Card className={cn('dark:bg-slate-900', perguntas?.total ? 'border-amber-200 dark:border-amber-900' : 'dark:border-slate-800')}>
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><MessageSquare className="h-4 w-4 text-violet-600" aria-hidden="true" />Perguntas dos formandos sem resposta</CardTitle><CardDescription>Comentários nas aulas a que nenhum instrutor respondeu ainda. Cada pergunta nova chega também por email ao instrutor do curso.</CardDescription></CardHeader>
            <CardContent className="p-0">
              {perguntasQ.isLoading ? <div className="space-y-2 p-4"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div> : !perguntas?.itens?.length ? <p className="flex items-center gap-2 p-4 text-sm text-slate-500"><CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />Não há perguntas por responder.</p> : (
                <ul className="divide-y dark:divide-slate-800">{perguntas.itens.map(c => { const curso = cursosById[c.curso_id || c.aula?.curso_id]; return (
                  <li key={c.id} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                    <div className="min-w-0 flex-1"><p className="line-clamp-2 text-slate-800 dark:text-slate-100">{c.texto}</p><p className="truncate text-xs text-slate-500">{c.autor_nome || c.autor_email} · {curso?.titulo ? `${curso.titulo} · ` : ''}{c.aula?.titulo || 'aula'} · {new Date(c.created_date).toLocaleString('pt-PT')}</p></div>
                    {(c.curso_id || c.aula?.curso_id) && c.aula_id && <Button asChild size="sm" variant="outline"><Link to={urlCursoPortal(c.curso_id || c.aula.curso_id, `&aula=${c.aula_id}`)}>Responder</Link></Button>}
                  </li>
                ); })}{perguntas.total > perguntas.itens.length && <li className="px-4 py-2 text-xs text-slate-500">+ {perguntas.total - perguntas.itens.length} pergunta(s) mais antiga(s).</li>}</ul>
              )}
            </CardContent>
          </Card>

          <Card className="dark:border-slate-800 dark:bg-slate-900">
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="flex items-center gap-2 text-base"><ScrollText className="h-4 w-4 text-violet-600" aria-hidden="true" />Últimos eventos</CardTitle><Button asChild variant="ghost" size="sm"><Link to={`${PORTAL_BASE}/gestao/auditoria`}>Auditoria completa<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></Button></CardHeader>
            <CardContent className="p-0">
              {auditQ.isLoading ? <div className="space-y-2 p-4"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div> : (auditQ.data || []).length === 0 ? <p className="p-4 text-sm text-slate-500">Sem eventos.</p> : (
                <ul className="divide-y dark:divide-slate-800">{(auditQ.data || []).map(l => { const d = descreverAcao(l.acao); return (
                  <li key={l.id} className="flex items-start gap-3 px-4 py-2.5 text-sm"><span className={cn('mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold', CORES_BADGE[d.cor])}>{d.label}</span><div className="min-w-0 flex-1"><p className="truncate text-slate-800 dark:text-slate-100">{l.detalhe || l.alvo}</p><p className="text-xs text-slate-500">{l.actor_nome || l.actor_email} · {new Date(l.quando).toLocaleString('pt-PT')}</p></div></li>
                ); })}</ul>
              )}
            </CardContent>
          </Card>
        </div>
        <div className="space-y-6">
          <Card className="dark:border-slate-800 dark:bg-slate-900">
            <CardHeader className="pb-2"><CardTitle className="text-base">Áreas de gestão</CardTitle></CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">{NAV_GESTAO.filter(n => !n.end).map(n => <Link key={n.to} to={n.to} className="flex items-center gap-2 rounded-lg border p-3 text-sm font-medium hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"><n.icon className="h-4 w-4 text-violet-600" aria-hidden="true" />{n.label}</Link>)}</CardContent>
          </Card>
          <Card className="dark:border-slate-800 dark:bg-slate-900">
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-4 w-4 text-violet-600" aria-hidden="true" />Próximas sessões</CardTitle></CardHeader>
            <CardContent className="p-0">
              {sessoesQ.isLoading ? <div className="p-4"><Skeleton className="h-8 w-full" /></div> : sessoesProx.length === 0 ? <p className="p-4 text-sm text-slate-500">Sem sessões agendadas.</p> : <ul className="divide-y dark:divide-slate-800">{sessoesProx.slice(0, 5).map(s => <li key={s.id} className="px-4 py-2 text-sm"><p className="truncate font-medium text-slate-800 dark:text-slate-100">{s.titulo}</p><p className="text-xs text-slate-500">{cursosById[s.curso_id]?.titulo ? `${cursosById[s.curso_id].titulo} · ` : ''}{new Date(s.inicio).toLocaleString('pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p></li>)}</ul>}
            </CardContent>
          </Card>
          <Card className="dark:border-slate-800 dark:bg-slate-900">
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-violet-600" aria-hidden="true" />Estado do sistema</CardTitle></CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              {estadoQ.isLoading ? <Skeleton className="h-10 w-full" /> : estadoQ.isError ? <p className="flex items-center gap-2 text-amber-700 dark:text-amber-300"><AlertTriangle className="h-4 w-4" aria-hidden="true" />Serviço de acessos indisponível (reiniciar dirops-functions-v2).</p> : (
                <>
                  <p className="flex items-center gap-2">{estadoQ.data?.smtp ? <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" /> : <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" />}Envio de email {estadoQ.data?.smtp ? `configurado (${estadoQ.data?.remetente?.address || 'remetente do servidor'})` : 'não configurado no servidor'}</p>
                  <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />Serviço de acessos activo (patch {estadoQ.data?.patch}){estadoQ.data?.auth_isolada ? (estadoQ.data?.auth_uc ? ' · autenticação independente activa' : ' · ATENÇÃO: serviço de autenticação da Universidade em baixo (dirops-auth-uc-v2)') : ''}</p>
                  <p className="text-xs text-slate-500">Só entrega a {(estadoQ.data?.dominios_internos || []).map(d => '@' + d).join(', ')}; para outros emails copie o link do convite.</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PaginaGestao>
  );
}
