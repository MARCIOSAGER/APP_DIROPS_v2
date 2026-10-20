// Ajuda e suporte: primeiros passos, perguntas frequentes, problemas comuns, estado dos serviços e pedido de apoio (ticket).
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { LifeBuoy, BookOpen, CheckCircle2, AlertTriangle, Loader2, Send, Activity, RefreshCw, Mail, Inbox, Compass, Award, CalendarDays, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Select from '@/components/ui/select';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { enviarTicketSuporte } from '@/functions/enviarTicketSuporte';
import { PORTAL_BASE, urlCursoPortal, mailtoDe, listaEmails } from '@/lib/universidade';
import { useConfigPortal, useMeusTickets } from '../hooks';

const FAQ = [
  { q: 'Como me inscrevo num curso?', a: 'Abra Cursos, escolha o curso e carregue em «Inscrever-me». Os cursos obrigatórios para a sua função aparecem destacados no início e em «A minha formação».' },
  { q: 'Onde fico a saber o que é obrigatório para mim?', a: 'Na página inicial, no bloco «Formação obrigatória e certificações a tratar», e em Cursos com a etiqueta «Obrigatório». Os prazos e as validades também aparecem aí.' },
  { q: 'Como concluo uma aula?', a: 'Cada aula tem um botão «Concluir aula» no fim (vídeos concluem-se ao ver até ao fim; leituras longas quando chega à última página). O progresso do curso actualiza-se sozinho.' },
  { q: 'A avaliação tem limite de tempo ou de tentativas?', a: 'Depende do curso: o instrutor define tempo, número de tentativas e nota mínima, e isso aparece antes de começar. Em «modo sem consulta» a avaliação bloqueia a cópia e regista saídas da página.' },
  { q: 'Quando recebo o certificado?', a: 'Assim que conclui todas as aulas e é aprovado na avaliação final, o certificado é emitido automaticamente e fica em Certificados (PDF com o logo da SGA). Alguns certificados têm validade e avisamos por email antes de expirar.' },
  { q: 'O que são as sessões?', a: 'Formações presenciais, online (Teams/Meet) ou híbridas marcadas pelos instrutores. Inscreve-se em Sessões ou dentro do curso; recebe uma convocatória por email com o convite de calendário.' },
  { q: 'Como funcionam os pontos e o ranking?', a: 'Ganha pontos ao concluir aulas, cursos e avaliações e ao participar nas sessões. Os distintivos marcam etapas (primeira aula, primeiro certificado, etc.). O ranking mostra os melhores da empresa.' },
  { q: 'Esqueci a senha. E agora?', a: 'Na página de entrada use «Esqueci a senha»: recebe um email com um link para criar uma nova (só para emails da SGA). Se o seu email não for da SGA, peça ao gestor da Universidade.' },
  { q: 'Posso usar no telemóvel?', a: 'Sim. O portal adapta-se ao ecrã do telemóvel e os vídeos funcionam em ecrã inteiro. Para ler textos longos, o modo livro é mais confortável.' },
  { q: 'O vídeo não carrega ou fica preto.', a: 'Actualize a página com Ctrl+Shift+R (Cmd+Shift+R no Mac). Se continuar, verifique se a rede permite o YouTube ou tente noutro navegador (Edge ou Chrome actualizados).' },
];
const PROBLEMAS = [
  { t: 'Página em branco ou botão que não responde', d: 'Actualize com Ctrl+Shift+R para carregar a versão mais recente. Se persistir, feche e abra o navegador.' },
  { t: 'Progresso da aula não guardou', d: 'Confirme que carregou em «Concluir aula». O progresso depende de ligação à rede; sem rede, o botão fica desactivado.' },
  { t: 'Não consigo entrar na avaliação', d: 'A avaliação exige todas as aulas concluídas. Verifique na página do curso quais faltam.' },
  { t: 'Certificado não aparece', d: 'Confirme que a avaliação está aprovada. Se o instrutor tiver perguntas de resposta aberta, o certificado só sai depois da correcção manual.' },
  { t: 'Conta a aguardar aprovação', d: 'O seu pedido está com um gestor. Se demorar mais de dois dias úteis, escreva para o suporte abaixo.' },
];
const TIPOS = [{ value: 'acesso', label: 'Acesso e senha' }, { value: 'curso', label: 'Curso ou aula' }, { value: 'video', label: 'Vídeo ou conteúdo que não abre' }, { value: 'avaliacao', label: 'Avaliação' }, { value: 'certificado', label: 'Certificado' }, { value: 'sessao', label: 'Sessão presencial/online' }, { value: 'outro', label: 'Outro' }];
const TIPO_LABEL = Object.fromEntries(TIPOS.map(t => [t.value, t.label]));
const ESTADO_TICKET = { aberta: { l: 'Aberto', c: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200' }, em_analise: { l: 'Em análise', c: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200' }, resolvida: { l: 'Resolvido', c: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200' }, fechada: { l: 'Fechado', c: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200' } };
const BASE = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');

async function medir(fn) { const t0 = performance.now(); try { const ok = await fn(); return { ok: !!ok, ms: Math.round(performance.now() - t0) }; } catch { return { ok: false, ms: Math.round(performance.now() - t0) }; } }
async function verificarServicos() {
  const [bd, auth, fn] = await Promise.all([
    medir(async () => { const { error } = await supabase.from('universidade_config_publica').select('nome_portal').limit(1); return !error; }),
    medir(async () => { const r = await fetch(`${BASE}/auth/v1/health`, { cache: 'no-store' }); return r.ok; }),
    medir(async () => { const r = await fetch(`${BASE}/functions/v1/lms-upload`, { cache: 'no-store' }); return r.ok || r.status === 401 || r.status === 403; }),
  ]);
  return { bd, auth, fn, quando: new Date() };
}

export default function PortalAjuda() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: cfg } = useConfigPortal();
  const { data: tickets = [], isLoading: aCarregarTickets } = useMeusTickets(user?.email);
  const [tipo, setTipo] = useState('curso'); const [assunto, setAssunto] = useState(''); const [mensagem, setMensagem] = useState('');
  const [aEnviar, setAEnviar] = useState(false); const [enviado, setEnviado] = useState(null); const [erro, setErro] = useState(null);
  const [servicos, setServicos] = useState(null); const [aVerificar, setAVerificar] = useState(false);
  const guiaId = cfg?.guia_curso_id;
  // «Pedir suporte» no menu de ajuda abre /ajuda#suporte: numa SPA o browser não desce sozinho até à âncora.
  React.useEffect(() => {
    if (window.location.hash === '#suporte') setTimeout(() => document.getElementById('suporte')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
  }, []);

  const submeter = async (e) => {
    e.preventDefault();
    if (assunto.trim().length < 5 || mensagem.trim().length < 10) { setErro('Descreva o assunto (mín. 5 caracteres) e a mensagem (mín. 10).'); return; }
    setAEnviar(true); setErro(null);
    try {
      const r = await enviarTicketSuporte({ assunto: `[${TIPO_LABEL[tipo] || 'Universidade'}] ${assunto.trim()}`, categoria: 'universidade', mensagem: `${mensagem.trim()}\n\n— Enviado a partir do portal da Universidade (${window.location.href})`, destino: listaEmails(cfg?.email_suporte) });
      setEnviado(r.numero_ticket); setAssunto(''); setMensagem(''); qc.invalidateQueries({ queryKey: ['ticket_suporte'] });
    } catch (err) { setErro(err?.message || 'Não foi possível enviar o pedido. Tente novamente.'); } finally { setAEnviar(false); }
  };
  const verificar = async () => { setAVerificar(true); try { setServicos(await verificarServicos()); } finally { setAVerificar(false); } };
  const Estado = ({ s, nome }) => <li className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm dark:border-slate-800"><span className="flex items-center gap-2">{s.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" /> : <AlertTriangle className="h-4 w-4 text-red-600" aria-hidden="true" />}{nome}</span><span className="text-xs tabular-nums text-slate-500">{s.ok ? `OK · ${s.ms} ms` : 'Sem resposta'}</span></li>;

  return (
    <div className="space-y-8">
      <div><h1 className="flex items-center gap-3 text-2xl font-bold text-slate-900 dark:text-slate-100 md:text-3xl"><LifeBuoy className="h-8 w-8 text-violet-600" aria-hidden="true" />Ajuda e suporte</h1><p className="mt-1 text-slate-600 dark:text-slate-400">Tudo o que precisa para usar a Universidade e a quem recorrer se algo falhar.</p></div>

      <section className="grid gap-4 md:grid-cols-4">
        {[{ i: Compass, t: '1. Explore o catálogo', d: 'Veja os cursos e o que é obrigatório para si.', to: `${PORTAL_BASE}/formacao` }, { i: BookOpen, t: '2. Faça as aulas', d: 'Vídeos, leituras e actividades; conclua cada aula.', to: `${PORTAL_BASE}/formacao?tab=meus` }, { i: Award, t: '3. Avaliação e certificado', d: 'Aprovado? O certificado sai na hora.', to: `${PORTAL_BASE}/formacao?tab=certificados` }, { i: CalendarDays, t: '4. Sessões', d: 'Inscreva-se nas presenciais e online.', to: `${PORTAL_BASE}/sessoes` }].map(x => (
          <Link key={x.t} to={x.to} className="group rounded-xl border bg-white p-4 transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900"><x.i className="h-6 w-6 text-violet-600" aria-hidden="true" /><p className="mt-2 font-semibold text-slate-900 group-hover:text-violet-800 dark:text-slate-100">{x.t}</p><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{x.d}</p></Link>
        ))}
      </section>
      {guiaId && <Card className="border-violet-200 bg-violet-50/60 dark:border-violet-900 dark:bg-violet-950/30"><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><BookOpen className="mt-0.5 h-5 w-5 text-violet-700 dark:text-violet-300" aria-hidden="true" /><div><p className="font-semibold text-slate-900 dark:text-slate-100">Curso «Como usar a Universidade Corporativa»</p><p className="text-sm text-slate-600 dark:text-slate-300">Um percurso guiado, passo a passo, para quem nunca usou a plataforma. Demora cerca de uma hora e dá certificado.</p></div></div><Button asChild><Link to={urlCursoPortal(guiaId)}>Abrir o curso</Link></Button></CardContent></Card>}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Perguntas frequentes</h2>
          <Card className="dark:border-slate-800 dark:bg-slate-900"><CardContent className="p-2 md:p-4">
            <Accordion type="single" collapsible className="w-full">{FAQ.map((f, i) => <AccordionItem key={i} value={`faq-${i}`}><AccordionTrigger className="text-left text-sm font-medium">{f.q}</AccordionTrigger><AccordionContent className="text-sm text-slate-600 dark:text-slate-300">{f.a}</AccordionContent></AccordionItem>)}</Accordion>
          </CardContent></Card>
          <h2 className="pt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">Problemas comuns</h2>
          <ul className="grid gap-2">{PROBLEMAS.map(p => <li key={p.t} className="rounded-lg border bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-900"><p className="font-medium text-slate-900 dark:text-slate-100">{p.t}</p><p className="mt-0.5 text-slate-600 dark:text-slate-300">{p.d}</p></li>)}</ul>
        </section>

        <section id="suporte" className="scroll-mt-24 space-y-4">
          <Card className="dark:border-slate-800 dark:bg-slate-900">
            <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Send className="h-4 w-4 text-violet-600" aria-hidden="true" />Pedir apoio</CardTitle><CardDescription>Abre um ticket para a equipa da Universidade{cfg?.email_suporte ? ` (${cfg.email_suporte})` : ''}. Responde-se por email.</CardDescription></CardHeader>
            <CardContent>
              {enviado ? (
                <div className="space-y-3 text-center"><CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" aria-hidden="true" /><p className="font-medium text-slate-900 dark:text-slate-100">Pedido {enviado} registado</p><p className="text-sm text-slate-500">Vai receber a resposta em {user?.email}.</p><Button variant="outline" onClick={() => setEnviado(null)}>Novo pedido</Button></div>
              ) : (
                <form onSubmit={submeter} className="space-y-3" noValidate>
                  <div className="space-y-1.5"><Label>Tipo</Label><Select options={TIPOS} value={tipo} onValueChange={setTipo} /></div>
                  <div className="space-y-1.5"><Label htmlFor="tk-assunto">Assunto</Label><Input id="tk-assunto" value={assunto} onChange={e => setAssunto(e.target.value)} maxLength={140} placeholder="ex.: Vídeo da aula 3 do GRF não abre" required /></div>
                  <div className="space-y-1.5"><Label htmlFor="tk-msg">O que aconteceu?</Label><Textarea id="tk-msg" value={mensagem} onChange={e => setMensagem(e.target.value)} rows={5} maxLength={4000} placeholder="Descreva os passos, o curso/aula e a mensagem de erro, se houver." required /></div>
                  {erro && <p role="alert" className="flex items-center gap-2 text-sm text-red-700 dark:text-red-300"><AlertTriangle className="h-4 w-4" aria-hidden="true" />{erro}</p>}
                  <Button type="submit" className="w-full" disabled={aEnviar}>{aEnviar ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}Enviar pedido</Button>
                  {cfg?.email_suporte && <p className="text-center text-xs text-slate-500">Ou escreva directamente para <a href={mailtoDe(cfg.email_suporte)} className="underline">{cfg.email_suporte}</a>.</p>}
                </form>
              )}
            </CardContent>
          </Card>

          <Card className="dark:border-slate-800 dark:bg-slate-900">
            <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Inbox className="h-4 w-4 text-violet-600" aria-hidden="true" />Os meus pedidos</CardTitle></CardHeader>
            <CardContent className="p-0">
              {aCarregarTickets ? <p className="p-4 text-sm text-slate-500">A carregar…</p> : tickets.length === 0 ? <p className="p-4 text-sm text-slate-500">Ainda não fez pedidos de apoio.</p> : (
                <ul className="divide-y dark:divide-slate-800">{tickets.slice(0, 10).map(t => { const e = ESTADO_TICKET[t.status] || { l: t.status, c: 'bg-slate-100 text-slate-700' }; return (
                  <li key={t.id} className="space-y-1 p-3 text-sm"><div className="flex items-center justify-between gap-2"><p className="min-w-0 truncate font-medium text-slate-900 dark:text-slate-100">{t.assunto}</p><span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${e.c}`}>{e.l}</span></div><p className="text-xs text-slate-500">{t.numero_ticket} · {new Date(t.created_date).toLocaleDateString('pt-PT')}</p>{t.resposta && <p className="rounded bg-slate-50 p-2 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200"><strong>Resposta{t.respondido_por ? ` (${t.respondido_por})` : ''}:</strong> {t.resposta}</p>}</li>
                ); })}</ul>
              )}
            </CardContent>
          </Card>

          <Card className="dark:border-slate-800 dark:bg-slate-900">
            <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4 text-violet-600" aria-hidden="true" />Estado dos serviços</CardTitle><CardDescription>Se algo falhar, verifique aqui antes de pedir apoio.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {servicos && <ul className="space-y-1.5"><Estado s={servicos.bd} nome="Base de dados e conteúdos" /><Estado s={servicos.auth} nome="Autenticação (login)" /><Estado s={servicos.fn} nome="Serviços (avaliações, uploads, email)" /><li className="text-xs text-slate-500">Verificado às {servicos.quando.toLocaleTimeString('pt-PT')}</li></ul>}
              <Button variant="outline" size="sm" onClick={verificar} disabled={aVerificar}>{aVerificar ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}{servicos ? 'Verificar de novo' : 'Verificar agora'}</Button>
              <p className="text-xs text-slate-500">Problemas de acesso? <Link to={`${PORTAL_BASE}/conta`} className="inline-flex items-center gap-1 underline"><KeyRound className="h-3 w-3" aria-hidden="true" />Alterar a senha</Link> · <a href={mailtoDe(cfg?.email_suporte || 'oaeroportos@sga.co.ao')} className="inline-flex items-center gap-1 underline"><Mail className="h-3 w-3" aria-hidden="true" />Contactar o suporte</a></p>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
