// Página inicial do portal — apresentação limpa: cabeçalho da Universidade com identidade SGA e o que fazer a seguir,
// formação obrigatória pendente (só se houver), cursos em destaque como conteúdo principal, e uma faixa discreta com
// sessões, ranking e certificados. Avisos aparecem como lista compacta.
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Award, BookOpen, CalendarDays, Compass, PlayCircle, Trophy, LifeBuoy, AlertTriangle, Megaphone, ShieldCheck, ChevronRight, Sparkles, MapPin, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import { ESTADOS } from '@/lib/formacaoEstado';
import { gradienteCategoria, NIVEL_LABEL, fmtHoras } from '@/components/formacao/formacaoUtils';
import { useGamificacao, nivelDe } from '@/components/formacao/GamificacaoAluno';
import { PORTAL_BASE, saudacao, primeiroNome, urlCursoPortal } from '@/lib/universidade';
import { useConfigPortal, useResumoAluno, useAvisos, useSessoesPortal } from '../hooks';
import { ehGestor, usePodeVer } from '../PortalLayout';
import { rotuloModalidade, fmtDataHora } from './PortalSessoes';
import { imagemPortal } from '../imagens';
import { estiloVeu, corVeu, intensidadeVeu, rgba } from '@/lib/veuCabecalho';

const cartao = 'rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900';

function Titulo({ children, para, rotulo = 'Ver tudo' }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{children}</h2>
      {para && <Link to={para} className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline dark:text-blue-300">{rotulo}<ChevronRight className="h-4 w-4" aria-hidden="true" /></Link>}
    </div>
  );
}
function Estat({ valor, label, loading }) {
  return <div className="min-w-[5.5rem]"><p className="text-2xl font-semibold tabular-nums text-white">{loading ? '…' : valor}</p><p className="text-xs text-white/70">{label}</p></div>;
}

export default function PortalInicio() {
  const { user } = useAuth();
  const { data: cfg } = useConfigPortal();
  const r = useResumoAluno(user);
  const { data: avisos = [] } = useAvisos();
  const sessoesQ = useSessoesPortal(user?.email);
  const gam = useGamificacao(user?.email);
  const podeVer = usePodeVer();
  const gestor = ehGestor(user);
  const agora = Date.now();
  const proximas = (sessoesQ.data?.sessoes || []).filter(s => new Date(s.fim || s.inicio).getTime() >= agora && s.estado !== 'cancelada').slice(0, 3);
  const inscritas = new Set((sessoesQ.data?.inscricoes || []).filter(i => i.estado !== 'cancelada').map(i => i.sessao_id));
  const nivel = gam.data ? nivelDe(gam.data.total) : null;
  const eu = gam.data?.ranking?.find(x => String(x.aluno_email).toLowerCase() === String(user?.email).toLowerCase());
  const nomePortal = cfg?.nome_portal || 'Universidade Corporativa';
  const guiaId = cfg?.guia_curso_id;
  const continuar = r.continuar?.curso ? r.continuar : null;
  const imagem = imagemPortal(cfg, 'inicio');

  return (
    <div className="space-y-12">
      {/* ── Apresentação ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl text-white" style={{ backgroundColor: corVeu(cfg) }}>
        <picture className="pointer-events-none absolute inset-0" aria-hidden="true">
          {imagem.urlPequena && <source media="(max-width: 767px)" srcSet={imagem.urlPequena} />}
          <img src={imagem.url} alt="" className="h-full w-full object-cover object-center" loading="eager" fetchPriority="high" />
        </picture>
        <div className="pointer-events-none absolute inset-0" style={estiloVeu(corVeu(cfg), intensidadeVeu(cfg))} aria-hidden="true" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24" style={{ backgroundImage: `linear-gradient(to top, ${rgba(corVeu(cfg), 0.7)}, transparent)` }} aria-hidden="true" />
        {imagem.credito && <p className="absolute bottom-3 right-4 z-10 text-[10px] text-white/50">{imagem.credito}</p>}
        <div className="relative grid gap-10 p-8 md:p-12 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-center">
          <div className="max-w-2xl">
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">{nomePortal}</h1>
            <p className="mt-4 max-w-xl text-lg text-blue-100/90">{cfg?.texto_boas_vindas || cfg?.slogan || 'Formação ao seu ritmo: cursos, procedimentos e certificados da SGA.'}</p>
            <p className="mt-6 text-sm text-blue-200/80">{saudacao()}, {primeiroNome(user?.full_name || user?.email)}.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              {podeVer('formacao') && <Button asChild size="lg" className="bg-white hover:bg-blue-50" style={{ color: corVeu(cfg) }}><Link to={`${PORTAL_BASE}/formacao`}><Compass className="h-4 w-4" aria-hidden="true" />Ver o catálogo</Link></Button>}
              {podeVer('formacao') && <Button asChild size="lg" variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10"><Link to={`${PORTAL_BASE}/formacao?tab=meus`}><BookOpen className="h-4 w-4" aria-hidden="true" />A minha formação</Link></Button>}
              {gestor && podeVer('gestao') && <Button asChild size="lg" variant="ghost" className="text-blue-100 hover:bg-white/10 hover:text-white"><Link to={`${PORTAL_BASE}/gestao`}><ShieldCheck className="h-4 w-4" aria-hidden="true" />Gestão</Link></Button>}
            </div>
            <div className="mt-10 flex flex-wrap gap-8 border-t border-white/10 pt-6">
              <Estat valor={r.emCurso.length} label="em curso" loading={r.carregando} />
              <Estat valor={r.concluidos.length} label="concluídos" loading={r.carregando} />
              <Estat valor={r.certsValidos.length} label="certificados" loading={r.carregando} />
              <Estat valor={gam.data?.total ?? 0} label={nivel ? `pontos · ${nivel.nivel.nome}` : 'pontos'} loading={gam.isLoading} />
            </div>
          </div>

          {continuar ? (
            <Link to={urlCursoPortal(continuar.curso.id, continuar.proximaId ? `&aula=${continuar.proximaId}` : '')} className="group block rounded-2xl border border-white/20 p-6 backdrop-blur-md transition-[filter] hover:brightness-110" style={{ backgroundColor: rgba(corVeu(cfg), 0.65) }}>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-200">Continuar a aprender</p>
              <p className="mt-2 text-xl font-semibold leading-snug">{continuar.curso.titulo}</p>
              <p className="mt-1 text-sm text-blue-100/80">{continuar.nFeitas} de {continuar.total} aulas concluídas</p>
              <div className="mt-4 flex items-center gap-3"><Progress value={continuar.total ? Math.round((continuar.nFeitas / continuar.total) * 100) : 0} className="h-1.5 flex-1 bg-white/20 [&>div]:bg-white" /><span className="text-sm tabular-nums text-white/90">{Math.round(Number(continuar.matricula.progresso_pct) || 0)}%</span></div>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-white"><PlayCircle className="h-4 w-4" aria-hidden="true" />Retomar<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></span>
            </Link>
          ) : guiaId ? (
            <Link to={urlCursoPortal(guiaId)} className="group block rounded-2xl border border-white/20 p-6 backdrop-blur-md transition-[filter] hover:brightness-110" style={{ backgroundColor: rgba(corVeu(cfg), 0.65) }}>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-200">Primeira vez aqui?</p>
              <p className="mt-2 text-xl font-semibold leading-snug">Como usar a Universidade Corporativa</p>
              <p className="mt-1 text-sm text-blue-100/80">Um percurso guiado de cerca de uma hora, com certificado.</p>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-white"><PlayCircle className="h-4 w-4" aria-hidden="true" />Começar<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></span>
            </Link>
          ) : null}
        </div>
      </section>

      {/* ── Formação obrigatória (só quando há pendências) ─────────────── */}
      {r.pendenciasObrig.length > 0 && (
        <section className={cn(cartao, 'border-amber-200 dark:border-amber-900')}>
          <div className="flex items-center gap-2 border-b border-amber-100 px-5 py-3 dark:border-amber-900/60"><AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" /><p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Formação obrigatória a tratar</p></div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {r.pendenciasObrig.map(c => {
              const info = r.infoCurso[c.id]; const e = ESTADOS[info.estado];
              const detalhe = info.estado === 'a_expirar' ? `expira em ${info.dias} dias` : info.estado === 'expirado' ? 'validade terminada' : info.estado === 'atrasado' ? `prazo ultrapassado há ${Math.abs(info.dias)} dias` : 'obrigatório para a sua função';
              return (
                <li key={c.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="min-w-0 flex-1"><p className="truncate font-medium text-slate-900 dark:text-slate-100">{c.titulo}</p><p className="text-xs text-slate-500"><span className={cn('font-medium', e.cor === 'red' ? 'text-red-600' : 'text-amber-700 dark:text-amber-300')}>{e.label}</span> · {detalhe}</p></div>
                  <Button asChild size="sm" variant="outline"><Link to={urlCursoPortal(c.id)}>{info.estado === 'em_falta' ? 'Inscrever-me' : info.estado === 'atrasado' ? 'Continuar' : 'Recertificar'}<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></Button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ── Cursos em destaque ────────────────────────────────────────── */}
      {podeVer('formacao') && (
        <section>
          <Titulo para={`${PORTAL_BASE}/formacao`} rotulo="Catálogo completo">Cursos em destaque</Titulo>
          {r.carregando ? <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-64 w-full rounded-2xl" />)}</div> : r.novos.length === 0 ? <p className="text-sm text-slate-500">Ainda não há cursos publicados.</p> : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {r.novos.map(c => { const m = r.matriculaPorCurso[c.id]; const info = r.infoCurso[c.id]; return (
                <Link key={c.id} to={urlCursoPortal(c.id)} className={cn(cartao, 'group flex flex-col overflow-hidden transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500')}>
                  <div className={`relative aspect-[16/9] bg-gradient-to-br ${gradienteCategoria(c.categoria)}`}>
                    {c.capa_url && <img src={c.capa_url} alt="" className="h-full w-full object-cover" loading="lazy" />}
                    {info?.obrigatorio && <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Obrigatório</span>}
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-5">
                    {c.categoria && <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">{c.categoria}</p>}
                    <p className="line-clamp-2 text-base font-semibold leading-snug text-slate-900 group-hover:text-blue-800 dark:text-slate-100 dark:group-hover:text-blue-300">{c.titulo}</p>
                    <p className="flex flex-wrap gap-x-3 text-xs text-slate-500 dark:text-slate-400"><span>{fmtHoras(c.carga_horaria)}</span>{c.nivel && <span>{NIVEL_LABEL[c.nivel] || c.nivel}</span>}{c.instrutor_nome && <span className="truncate">{c.instrutor_nome}</span>}</p>
                    <div className="mt-auto pt-2">{m ? <div className="flex items-center gap-2 text-xs"><Progress value={Math.round(Number(m.progresso_pct) || 0)} className="h-1.5 flex-1" /><span className="tabular-nums text-slate-600 dark:text-slate-300">{m.estado === 'concluido' ? 'Concluído' : `${Math.round(Number(m.progresso_pct) || 0)}%`}</span></div> : <span className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 dark:text-blue-300">Ver curso<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></span>}</div>
                  </div>
                </Link>
              ); })}
            </div>
          )}
        </section>
      )}

      {/* ── Sessões · Ranking · Certificados ──────────────────────────── */}
      <section className="grid gap-5 lg:grid-cols-3">
        {podeVer('sessoes') && (
          <div className={cn(cartao, 'p-5')}>
            <div className="mb-3 flex items-center justify-between"><p className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100"><CalendarDays className="h-4 w-4 text-blue-600" aria-hidden="true" />Próximas sessões</p><Link to={`${PORTAL_BASE}/sessoes`} className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-300">Agenda</Link></div>
            {sessoesQ.isLoading ? <Skeleton className="h-16 w-full" /> : proximas.length === 0 ? <p className="text-sm text-slate-500">Sem sessões agendadas.</p> : (
              <ul className="space-y-2.5">{proximas.map(s => { const c = r.cursosById[s.curso_id]; return (
                <li key={s.id} className="flex items-start gap-3 text-sm">
                  <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"><span className="text-[9px] font-semibold uppercase leading-none">{new Date(s.inicio).toLocaleDateString('pt-PT', { month: 'short' }).replace('.', '')}</span><span className="text-base font-bold leading-tight tabular-nums">{new Date(s.inicio).getDate()}</span></div>
                  <div className="min-w-0 flex-1"><p className="truncate font-medium text-slate-900 dark:text-slate-100">{s.titulo}</p><p className="truncate text-xs text-slate-500">{c?.titulo ? `${c.titulo} · ` : ''}{fmtDataHora(s.inicio)} · {s.modalidade === 'online' ? <Video className="inline h-3 w-3" aria-hidden="true" /> : <MapPin className="inline h-3 w-3" aria-hidden="true" />} {rotuloModalidade(s)}{inscritas.has(s.id) ? ' · inscrito' : ''}</p></div>
                </li>
              ); })}</ul>
            )}
          </div>
        )}
        {podeVer('ranking') && (
          <div className={cn(cartao, 'p-5')}>
            <div className="mb-3 flex items-center justify-between"><p className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100"><Trophy className="h-4 w-4 text-amber-500" aria-hidden="true" />Ranking</p><Link to={`${PORTAL_BASE}/ranking`} className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-300">Ver tudo</Link></div>
            {gam.isLoading ? <Skeleton className="h-16 w-full" /> : !gam.data?.ranking?.length ? <p className="text-sm text-slate-500">Conclua uma aula para entrar no ranking.</p> : (
              <ol className="space-y-2">{gam.data.ranking.slice(0, 3).map(x => { const souEu = String(x.aluno_email).toLowerCase() === String(user?.email).toLowerCase(); return (
                <li key={x.aluno_email} className="flex items-center gap-3 text-sm"><span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold', x.posicao === 1 ? 'bg-amber-400 text-amber-950' : x.posicao === 2 ? 'bg-slate-300 text-slate-800' : 'bg-orange-300 text-orange-950')}>{x.posicao}</span><span className={cn('min-w-0 flex-1 truncate', souEu ? 'font-semibold text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-200')}>{x.aluno_nome}{souEu ? ' (eu)' : ''}</span><span className="tabular-nums text-slate-500">{x.pontos} pts</span></li>
              ); })}</ol>
            )}
            {eu && eu.posicao > 3 && <p className="mt-3 text-xs text-slate-500"><Sparkles className="mr-1 inline h-3 w-3 text-amber-500" aria-hidden="true" />Está em {eu.posicao}.º com {eu.pontos} pontos.</p>}
          </div>
        )}
        {podeVer('formacao') && (
          <div className={cn(cartao, 'p-5')}>
            <div className="mb-3 flex items-center justify-between"><p className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100"><Award className="h-4 w-4 text-emerald-600" aria-hidden="true" />Certificados</p><Link to={`${PORTAL_BASE}/formacao?tab=certificados`} className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-300">Ver todos</Link></div>
            {r.certsValidos.length === 0 ? <p className="text-sm text-slate-500">Conclua um curso e a avaliação para emitir o primeiro.</p> : (
              <ul className="space-y-2.5">{r.certsValidos.slice(0, 3).map(c => (
                <li key={c.id} className="text-sm"><p className="truncate font-medium text-slate-900 dark:text-slate-100">{c.curso_titulo}</p><p className="text-xs text-slate-500">N.º {c.numero}{c.emitido_em ? ` · ${new Date(c.emitido_em).toLocaleDateString('pt-PT')}` : ''}{c.valido_ate ? ` · válido até ${new Date(c.valido_ate).toLocaleDateString('pt-PT')}` : ''}</p></li>
              ))}</ul>
            )}
          </div>
        )}
      </section>

      {/* ── Avisos (compacto) ─────────────────────────────────────────── */}
      {avisos.length > 0 && (
        <section>
          <Titulo>Avisos</Titulo>
          <ul className={cn(cartao, 'divide-y divide-slate-100 dark:divide-slate-800')}>
            {avisos.slice(0, 4).map(a => (
              <li key={a.id} className="flex gap-3 px-5 py-4">
                <Megaphone className={cn('mt-0.5 h-4 w-4 shrink-0', a.destaque ? 'text-amber-600' : 'text-blue-600')} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900 dark:text-slate-100">{a.titulo}</p>
                  {a.corpo && <p className="mt-0.5 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{a.corpo}</p>}
                  <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-slate-500"><span>{new Date(a.publicado_em).toLocaleDateString('pt-PT')}</span>{a.ligacao_url && (a.ligacao_url.startsWith('/') ? <Link to={a.ligacao_url} className="font-medium text-blue-700 hover:underline dark:text-blue-300">{a.ligacao_texto || 'Saber mais'}</Link> : <a href={a.ligacao_url} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-700 hover:underline dark:text-blue-300">{a.ligacao_texto || 'Saber mais'}</a>)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Ajuda (discreto) ──────────────────────────────────────────── */}
      {podeVer('ajuda') && (
        <p className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-slate-200 pt-6 text-sm text-slate-500 dark:border-slate-800">
          <Link to={`${PORTAL_BASE}/ajuda`} className="inline-flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-white"><LifeBuoy className="h-4 w-4" aria-hidden="true" />Ajuda e suporte</Link>
          {guiaId && <Link to={urlCursoPortal(guiaId)} className="inline-flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-white"><BookOpen className="h-4 w-4" aria-hidden="true" />Como usar a Universidade</Link>}
          <Link to={`${PORTAL_BASE}/conta`} className="hover:text-slate-900 dark:hover:text-white">A minha conta</Link>
        </p>
      )}
    </div>
  );
}
