import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import Select from '@/components/ui/select';
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Timer, Send, Loader2, CheckCircle2, XCircle, MinusCircle, Award, Trophy, AlertTriangle, RotateCcw, ArrowUp, ArrowDown, Lock, ClipboardList, Maximize2, Hourglass, MessageSquareText } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { quizApi } from '@/lib/quizApi';
import { fmtData } from '../formacaoUtils';
import { TIPOS_PERGUNTA, fmtTempo, descreverResposta, coordsPct } from './quizUtils';

// Avaliação do aluno: intro (regras e tentativas) -> perguntas (uma por página, temporizador,
// gravação automática, modo sem consulta) -> resultado (nota, certificado, revisão).
export default function QuizPlayer({ quizId, matricula, onVoltarCurso, onVerCertificados }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [estado, setEstado] = useState(null);
  const [erro, setErro] = useState('');
  const [fase, setFase] = useState('intro'); // intro | a_fazer | resultado
  const [tentativa, setTentativa] = useState(null);
  const [respostas, setRespostas] = useState({});
  const [idx, setIdx] = useState(0);
  const [resultado, setResultado] = useState(null);
  const [aIniciar, setAIniciar] = useState(false);
  const [aSubmeter, setASubmeter] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [agora, setAgora] = useState(Date.now());
  const [saidas, setSaidas] = useState(0);
  const [alertas, setAlertas] = useState(0);      // acções bloqueadas (cópia, atalhos, devtools) no modo sem consulta
  const [devtools, setDevtools] = useState(false);
  const saveTimer = useRef(null);
  const respostasRef = useRef(respostas);
  respostasRef.current = respostas;
  const submeterRef = useRef(null);

  const carregarEstado = useCallback(async () => {
    try {
      const e = await quizApi.estado(quizId);
      setEstado(e); setErro('');
      if (e.tentativa_em_curso && fase === 'intro' && !resultado) {
        setTentativa({ id: e.tentativa_em_curso.id, numero: e.tentativa_em_curso.numero, prazo: e.tentativa_em_curso.prazo, perguntas: e.tentativa_em_curso.perguntas, modo_sem_consulta: e.quiz.modo_sem_consulta });
        setRespostas(e.tentativa_em_curso.respostas || {});
        setFase('a_fazer');
      }
    } catch (err) { setErro(err?.message || String(err)); }
  }, [quizId, fase, resultado]);
  useEffect(() => { if (matricula) carregarEstado(); }, [quizId, matricula?.id]);

  // temporizador
  useEffect(() => { if (fase !== 'a_fazer') return; const t = setInterval(() => setAgora(Date.now()), 1000); return () => clearInterval(t); }, [fase]);
  const restante = tentativa?.prazo ? Math.max(0, Math.round((new Date(tentativa.prazo).getTime() - agora) / 1000)) : null;
  useEffect(() => { if (fase === 'a_fazer' && restante === 0 && !aSubmeter) submeterRef.current?.(true); }, [restante, fase]);

  // gravação automática das respostas
  const responder = (pid, valor) => {
    setRespostas(r => {
      const n = { ...r, [pid]: valor };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => { if (tentativa?.id) quizApi.guardar(tentativa.id, n).catch(() => {}); }, 1500);
      return n;
    });
  };

  // modo sem consulta: ecrã inteiro + registo de saídas + bloqueio de cópia/menu de contexto/atalhos de
  // ferramentas de programador + detecção heurística de DevTools (tudo registado na tentativa; o gabarito
  // nunca chega ao browser antes da submissão — a correcção é no servidor).
  useEffect(() => {
    if (fase !== 'a_fazer' || !tentativa?.modo_sem_consulta) return;
    const evento = (tipo, extra) => quizApi.guardar(tentativa.id, undefined, { tipo, ...(extra || {}) }).catch(() => {});
    const registar = () => {
      if (document.visibilityState === 'hidden' || !document.hasFocus()) { setSaidas(s => s + 1); evento('saida'); }
    };
    const bloquear = (e) => { e.preventDefault(); setAlertas(a => a + 1); evento('bloqueado', { accao: e.type }); };
    const teclas = (e) => {
      const k = String(e.key || '').toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;
      const proibida = k === 'f12' || (ctrl && e.shiftKey && ['i', 'j', 'c', 'k'].includes(k)) || (ctrl && ['u', 's', 'p'].includes(k)) || (ctrl && !e.shiftKey && ['c', 'x'].includes(k) && !(e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)));
      if (proibida) { e.preventDefault(); e.stopPropagation(); setAlertas(a => a + 1); evento('atalho_bloqueado', { tecla: (ctrl ? 'Ctrl+' : '') + (e.shiftKey ? 'Shift+' : '') + k }); }
    };
    let devAberto = false;
    const sonda = setInterval(() => {
      const aberto = !document.fullscreenElement && ((window.outerWidth - window.innerWidth) > 200 || (window.outerHeight - window.innerHeight) > 200);
      if (aberto && !devAberto) { devAberto = true; setDevtools(true); setAlertas(a => a + 1); evento('devtools_aberto'); }
      if (!aberto && devAberto) { devAberto = false; setDevtools(false); }
    }, 2000);
    document.addEventListener('visibilitychange', registar);
    window.addEventListener('blur', registar);
    document.addEventListener('contextmenu', bloquear);
    document.addEventListener('copy', bloquear);
    document.addEventListener('cut', bloquear);
    document.addEventListener('keydown', teclas, true);
    return () => { clearInterval(sonda); document.removeEventListener('visibilitychange', registar); window.removeEventListener('blur', registar); document.removeEventListener('contextmenu', bloquear); document.removeEventListener('copy', bloquear); document.removeEventListener('cut', bloquear); document.removeEventListener('keydown', teclas, true); };
  }, [fase, tentativa]);

  const pedirEcraInteiro = () => { try { document.documentElement.requestFullscreen?.(); } catch { /* */ } };
  const sairEcraInteiro = () => { try { if (document.fullscreenElement) document.exitFullscreen?.(); } catch { /* */ } };

  const iniciar = async () => {
    setAIniciar(true); setErro('');
    try {
      const r = await quizApi.iniciar(quizId);
      setTentativa({ id: r.tentativa_id, numero: r.numero, prazo: r.prazo, perguntas: r.perguntas, modo_sem_consulta: r.modo_sem_consulta });
      setRespostas(r.respostas || {}); setIdx(0); setResultado(null); setSaidas(0); setFase('a_fazer');
      if (r.modo_sem_consulta) pedirEcraInteiro();
    } catch (err) { setErro(err?.message || String(err)); }
    finally { setAIniciar(false); }
  };

  const submeter = async (automatico = false) => {
    if (!tentativa || aSubmeter) return;
    setASubmeter(true); setConfirmar(false);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    try {
      const r = await quizApi.submeter(tentativa.id, respostasRef.current);
      setResultado(r); setFase('resultado'); sairEcraInteiro();
      if (automatico) toast({ title: 'Tempo esgotado', description: 'A avaliação foi submetida automaticamente.' });
      qc.invalidateQueries({ queryKey: ['matricula'] }); qc.invalidateQueries({ queryKey: ['certificado'] });
      const e = await quizApi.estado(quizId).catch(() => null); if (e) setEstado(e);
    } catch (err) {
      setErro(err?.message || String(err));
      if (err?.status === 409) { const e = await quizApi.estado(quizId).catch(() => null); if (e) { setEstado(e); setFase('intro'); } }
    } finally { setASubmeter(false); }
  };
  submeterRef.current = submeter;

  if (!matricula) {
    return <Card className="dark:border-slate-800 dark:bg-slate-900"><CardContent className="flex flex-col items-center gap-3 py-12 text-center"><Lock className="h-8 w-8 text-slate-400" aria-hidden="true" /><p className="text-slate-700 dark:text-slate-300">Precisa de estar inscrito no curso para fazer a avaliação.</p><Button onClick={onVoltarCurso}><ArrowLeft className="h-4 w-4" aria-hidden="true" />Ir para o curso</Button></CardContent></Card>;
  }
  if (!estado && !erro) return <div className="space-y-3"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;
  if (!estado && erro) return <Card className="dark:border-slate-800 dark:bg-slate-900"><CardContent className="flex flex-col items-center gap-3 py-12 text-center"><AlertTriangle className="h-8 w-8 text-amber-500" aria-hidden="true" /><p className="text-slate-700 dark:text-slate-300">{erro}</p><Button variant="outline" onClick={carregarEstado}>Tentar novamente</Button><Button variant="ghost" onClick={onVoltarCurso}><ArrowLeft className="h-4 w-4" aria-hidden="true" />Voltar ao curso</Button></CardContent></Card>;

  const quiz = estado.quiz;

  // ── INTRO ─────────────────────────────────────────────────────────────
  if (fase === 'intro') {
    const regras = [
      [`${quiz.n_perguntas} ${quiz.n_perguntas === 1 ? 'pergunta' : 'perguntas'}`],
      [`Nota mínima ${quiz.nota_minima}%`],
      [quiz.tentativas_max ? `${estado.tentativas_restantes} de ${quiz.tentativas_max} tentativas disponíveis` : 'Tentativas ilimitadas'],
      [quiz.tempo_limite_min ? `Tempo limite: ${quiz.tempo_limite_min} min` : 'Sem tempo limite'],
      quiz.modo_sem_consulta ? ['Sem consulta: ecrã inteiro; saídas da janela são registadas'] : null,
      quiz.gera_certificado ? ['Aprovar conclui o curso e emite o certificado'] : null,
    ].filter(Boolean);
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Button variant="ghost" onClick={onVoltarCurso} className="-ml-2 text-slate-600 dark:text-slate-300"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Curso</Button>
        <Card className="dark:border-slate-800 dark:bg-slate-900">
          <CardContent className="space-y-5 p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-950/40"><ClipboardList className="h-6 w-6 text-violet-600 dark:text-violet-400" aria-hidden="true" /></div>
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 md:text-2xl">{quiz.titulo}</h1>
                {quiz.descricao && <p className="mt-1 whitespace-pre-line text-slate-600 dark:text-slate-400">{quiz.descricao}</p>}
              </div>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">{regras.map(([r]) => <li key={r} className="flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-300"><CheckCircle2 className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />{r}</li>)}</ul>
            {estado.aprovado && (
              <div className="flex items-center gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/40">
                <Trophy className="h-6 w-6 text-emerald-600" aria-hidden="true" />
                <p className="flex-1 text-sm text-emerald-900 dark:text-emerald-100">Já aprovou esta avaliação{estado.melhor_nota != null ? ` com ${estado.melhor_nota}%` : ''}.</p>
                {onVerCertificados && quiz.gera_certificado && <Button variant="outline" size="sm" onClick={onVerCertificados}><Award className="h-4 w-4" aria-hidden="true" />Certificados</Button>}
              </div>
            )}
            {!estado.aprovado && estado.correcao_pendente && (
              <div className="flex items-center gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40">
                <Hourglass className="h-6 w-6 text-amber-600" aria-hidden="true" />
                <p className="flex-1 text-sm text-amber-900 dark:text-amber-100">A sua tentativa tem respostas abertas à espera de correcção pelo instrutor. Receberá a nota final quando estiver corrigida.</p>
              </div>
            )}
            {estado.tentativas.length > 0 && (
              <div>
                <p className="mb-1.5 text-sm font-medium text-slate-800 dark:text-slate-200">Tentativas anteriores</p>
                <ul className="divide-y rounded-md border text-sm dark:divide-slate-800 dark:border-slate-700">{estado.tentativas.map(t => (
                  <li key={t.id} className="flex items-center justify-between px-3 py-2"><span className="text-slate-600 dark:text-slate-300">Tentativa {t.numero} · {fmtData(t.submetida_em)}</span><span className="flex items-center gap-2"><span className="font-semibold tabular-nums">{t.nota != null ? `${t.nota}%` : '—'}</span>{t.estado === 'expirada' ? <Badge variant="outline" className="border-amber-300 text-amber-700">Tempo esgotado</Badge> : t.correcao_pendente ? <Badge variant="outline" className="border-amber-300 text-amber-700"><Hourglass className="mr-1 h-3 w-3" aria-hidden="true" />Aguarda correcção</Badge> : t.aprovado ? <Badge className="bg-emerald-600 hover:bg-emerald-600">Aprovado</Badge> : <Badge variant="destructive">Reprovado</Badge>}</span></li>
                ))}</ul>
              </div>
            )}
            {(erro || estado.motivo) && <p role="alert" className="flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"><AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />{erro || estado.motivo}</p>}
            <div className="flex flex-wrap items-center gap-2">
              <Button size="lg" onClick={iniciar} disabled={!estado.pode_iniciar || aIniciar}>{aIniciar ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : quiz.modo_sem_consulta ? <Maximize2 className="h-4 w-4" aria-hidden="true" /> : <ArrowRight className="h-4 w-4" aria-hidden="true" />}{estado.tentativa_em_curso ? 'Retomar avaliação' : estado.tentativas.length ? 'Nova tentativa' : 'Iniciar avaliação'}</Button>
              <Button variant="ghost" onClick={onVoltarCurso}>Voltar ao curso</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── RESULTADO ─────────────────────────────────────────────────────────
  if (fase === 'resultado' && resultado) {
    const perguntasPorId = Object.fromEntries((tentativa?.perguntas || []).map(p => [p.id, p]));
    const temGabarito = Array.isArray(resultado.revisao) && resultado.revisao.some(r => 'gabarito' in r);
    const pendente = !!resultado.pendente && resultado.aprovado !== true;
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Card className={cn('dark:border-slate-800 dark:bg-slate-900', resultado.aprovado ? 'border-emerald-200' : pendente ? 'border-amber-200' : 'border-red-200')}>
          <CardContent className="space-y-4 p-6 text-center">
            {resultado.aprovado ? <Trophy className="mx-auto h-12 w-12 text-emerald-600" aria-hidden="true" /> : pendente ? <Hourglass className="mx-auto h-12 w-12 text-amber-500" aria-hidden="true" /> : <XCircle className="mx-auto h-12 w-12 text-red-500" aria-hidden="true" />}
            <div>
              <p className="text-4xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{resultado.nota}%{pendente && <span className="ml-2 align-middle text-base font-normal text-slate-500">provisória</span>}</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{resultado.pontos} de {resultado.pontos_max} pontos · nota mínima {resultado.nota_minima}%{pendente && resultado.nota_max_possivel != null ? ` · até ${resultado.nota_max_possivel}% após correcção` : ''}</p>
            </div>
            {resultado.fora_de_tempo ? <Badge variant="outline" className="border-amber-300 text-amber-700">Submetida fora do tempo — não conta como aprovação</Badge> : resultado.aprovado ? <Badge className="bg-emerald-600 px-3 py-1 text-sm hover:bg-emerald-600">Aprovado</Badge> : pendente ? <Badge variant="outline" className="border-amber-300 px-3 py-1 text-sm text-amber-700">Aguarda correcção</Badge> : <Badge variant="destructive" className="px-3 py-1 text-sm">Reprovado</Badge>}
            {pendente && <p className="text-sm text-slate-600 dark:text-slate-400">{resultado.pendentes === 1 ? 'Há 1 resposta aberta' : `Há ${resultado.pendentes} respostas abertas`} à espera de correcção pelo instrutor. A nota final e o resultado ficam disponíveis quando a correcção terminar.</p>}
            {resultado.feedback && !pendente && <p className="text-slate-700 dark:text-slate-300">{resultado.feedback}</p>}
            {resultado.certificado_numero && (
              <div className="flex flex-col items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40 sm:flex-row sm:justify-center">
                <Award className="h-5 w-5 text-amber-600" aria-hidden="true" />
                <span className="text-sm text-amber-900 dark:text-amber-100">Certificado <span className="font-mono">{resultado.certificado_numero}</span> emitido.</span>
                {onVerCertificados && <Button size="sm" variant="outline" onClick={onVerCertificados}>Ver certificado</Button>}
              </div>
            )}
            <div className="flex flex-wrap justify-center gap-2">
              {!resultado.aprovado && !pendente && (resultado.tentativas_restantes === null || resultado.tentativas_restantes > 0) && (
                <Button onClick={() => { setFase('intro'); setResultado(null); carregarEstado(); }}><RotateCcw className="h-4 w-4" aria-hidden="true" />Tentar novamente{resultado.tentativas_restantes != null ? ` (${resultado.tentativas_restantes})` : ''}</Button>
              )}
              <Button variant="outline" onClick={onVoltarCurso}><ArrowLeft className="h-4 w-4" aria-hidden="true" />Voltar ao curso</Button>
            </div>
          </CardContent>
        </Card>
        {Array.isArray(resultado.revisao) && resultado.revisao.length > 0 && (
          <Card className="dark:border-slate-800 dark:bg-slate-900"><CardContent className="p-0">
            <div className="border-b px-5 py-3 dark:border-slate-800"><p className="font-semibold text-slate-900 dark:text-slate-100">Revisão</p><p className="text-xs text-slate-500 dark:text-slate-400">{temGabarito ? 'Resposta correcta e explicação por pergunta.' : 'A correcção detalhada não é mostrada nesta avaliação.'}</p></div>
            <ol className="divide-y dark:divide-slate-800">{resultado.revisao.map((r, i) => {
              const p = perguntasPorId[r.pergunta_id];
              return (
                <li key={r.pergunta_id} className="flex gap-3 px-5 py-4">
                  {r.pendente ? <Hourglass className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-label="Aguarda correcção" /> : r.correta ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-label="Correcta" /> : r.parcial ? <MinusCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-label="Parcialmente correcta" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" aria-label="Errada" />}
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{i + 1}. {p?.enunciado || 'Pergunta'}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{r.pendente ? 'Pontos por atribuir' : `${r.pontos_obtidos} / ${r.pontos_max} pontos`}</p>
                    {p && (p.tipo === 'hotspot' || p.tipo === 'rotulos') && p.imagem_url && <ImagemRevisao p={p} resposta={r.resposta} gabarito={'gabarito' in r ? r.gabarito : null} />}
                    <p className="text-sm text-slate-700 dark:text-slate-300"><span className="text-slate-500">A sua resposta: </span>{p?.tipo === 'aberta' && r.resposta ? <span className="whitespace-pre-line">{String(r.resposta)}</span> : (descreverResposta(p, r.resposta) || <em className="text-slate-400">sem resposta</em>)}</p>
                    {'gabarito' in r && !r.correta && p?.tipo !== 'aberta' && p?.tipo !== 'hotspot' && <p className="text-sm text-emerald-800 dark:text-emerald-300"><span className="text-slate-500">Correcta: </span>{descreverResposta(p, r.gabarito, true)}</p>}
                    {r.comentario && <p className="flex items-start gap-1.5 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-900 dark:bg-blue-950/40 dark:text-blue-100"><MessageSquareText className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><span><span className="font-medium">Instrutor: </span>{r.comentario}</span></p>}
                    {r.feedback && <p className="text-sm italic text-slate-600 dark:text-slate-400">{r.feedback}</p>}
                    {r.explicacao && <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-300">{r.explicacao}</p>}
                  </div>
                </li>
              );
            })}</ol>
          </CardContent></Card>
        )}
      </div>
    );
  }

  // ── A FAZER ───────────────────────────────────────────────────────────
  const perguntas = tentativa?.perguntas || [];
  const p = perguntas[idx];
  const respondida = (q) => { const v = respostas[q.id]; return v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length) && !(typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length); };
  const nRespondidas = perguntas.filter(respondida).length;
  const pouco = restante != null && restante <= 120;
  return (
    <div className={cn('mx-auto max-w-3xl space-y-4', tentativa?.modo_sem_consulta && 'sem-consulta')}>
      {devtools && (
        <div role="alert" className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 p-6 text-center text-white">
          <div className="max-w-md space-y-3"><AlertTriangle className="mx-auto h-10 w-10 text-amber-400" aria-hidden="true" /><p className="text-lg font-semibold">Ferramentas de programador detectadas</p><p className="text-sm text-slate-300">Esta avaliação é feita sem consulta. Feche as ferramentas de programador (F12) para continuar — a ocorrência ficou registada na sua tentativa e é visível ao instrutor.</p><p className="text-xs text-slate-400">O cronómetro continua a contar.</p></div>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0"><p className="truncate text-sm font-medium text-slate-700 dark:text-slate-300">{quiz.titulo}</p><p className="text-xs text-slate-500 dark:text-slate-400">Pergunta {idx + 1} de {perguntas.length} · {nRespondidas} respondidas</p></div>
        <div className="flex items-center gap-2">
          {tentativa?.modo_sem_consulta && saidas > 0 && <Badge variant="outline" className="border-amber-300 text-amber-700"><AlertTriangle className="mr-1 h-3 w-3" aria-hidden="true" />{saidas} {saidas === 1 ? 'saída do ecrã' : 'saídas do ecrã'}</Badge>}
          {tentativa?.modo_sem_consulta && alertas > 0 && <Badge variant="outline" className="border-red-300 text-red-700" title="Cópia, menu de contexto, atalhos de ferramentas de programador ou DevTools — registado na tentativa"><AlertTriangle className="mr-1 h-3 w-3" aria-hidden="true" />{alertas} {alertas === 1 ? 'acção bloqueada' : 'acções bloqueadas'}</Badge>}
          {restante != null && <span className={cn('inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-sm tabular-nums', pouco ? 'border-red-300 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300' : 'border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-300')} aria-live={pouco ? 'polite' : 'off'}><Timer className="h-4 w-4" aria-hidden="true" />{fmtTempo(restante)}</span>}
        </div>
      </div>
      <Progress value={perguntas.length ? (nRespondidas / perguntas.length) * 100 : 0} className="h-1.5" aria-label="Progresso da avaliação" />
      <div className="flex flex-wrap gap-1" aria-label="Navegação entre perguntas">{perguntas.map((q, i) => (
        <button key={q.id} type="button" onClick={() => setIdx(i)} aria-label={`Pergunta ${i + 1}${respondida(q) ? ', respondida' : ''}`} aria-current={i === idx ? 'true' : undefined}
          className={cn('h-8 w-8 rounded-md border text-xs font-medium tabular-nums transition-colors', i === idx ? 'border-blue-600 bg-blue-600 text-white' : respondida(q) ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300')}>{i + 1}</button>
      ))}</div>

      {p && (
        <Card className="dark:border-slate-800 dark:bg-slate-900"><CardContent className="space-y-4 p-5 md:p-6">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400"><span className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">{TIPOS_PERGUNTA[p.tipo]?.label || p.tipo}</span><span>{p.pontos} {p.pontos === 1 ? 'ponto' : 'pontos'}</span></div>
          <p className="whitespace-pre-line text-base font-medium leading-relaxed text-slate-900 dark:text-slate-100 md:text-lg">{p.enunciado}</p>
          {p.imagem_url && p.tipo !== 'hotspot' && p.tipo !== 'rotulos' && <img src={p.imagem_url} alt="" className="max-h-80 w-auto max-w-full rounded-md border dark:border-slate-700" />}
          <Resposta key={p.id} p={p} valor={respostas[p.id]} onChange={(v) => responder(p.id, v)} semConsulta={!!tentativa?.modo_sem_consulta} />
        </CardContent></Card>
      )}

      {erro && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{erro}</p>}
      <div className="flex flex-col gap-2 rounded-xl border bg-white p-3 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="outline" disabled={idx === 0} onClick={() => setIdx(i => i - 1)}><ChevronLeft className="h-4 w-4" aria-hidden="true" />Anterior</Button>
        <Button onClick={() => setConfirmar(true)} disabled={aSubmeter} variant={idx === perguntas.length - 1 ? 'default' : 'secondary'}>{aSubmeter ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}Submeter avaliação</Button>
        <Button variant="outline" disabled={idx >= perguntas.length - 1} onClick={() => setIdx(i => i + 1)}>Próxima<ChevronRight className="h-4 w-4" aria-hidden="true" /></Button>
      </div>

      <Dialog open={confirmar} onOpenChange={setConfirmar}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Submeter a avaliação?</DialogTitle><DialogDescription>{nRespondidas < perguntas.length ? `Tem ${perguntas.length - nRespondidas} ${perguntas.length - nRespondidas === 1 ? 'pergunta sem resposta' : 'perguntas sem resposta'}. Depois de submeter não pode alterar.` : 'Depois de submeter não pode alterar as respostas.'}</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setConfirmar(false)}>Continuar a responder</Button><Button onClick={() => submeter(false)} disabled={aSubmeter}>{aSubmeter && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}Submeter</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Componentes de resposta por tipo ──────────────────────────────────────
function Resposta({ p, valor, onChange, semConsulta = false }) {
  switch (p.tipo) {
    case 'escolha_unica': case 'vf':
      return (
        <div className="space-y-2" role="radiogroup" aria-label="Opções">{(p.opcoes || []).map(o => (
          <label key={o.id} className={cn('flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800', valor === o.id && 'border-blue-500 bg-blue-50 dark:bg-blue-950/40')}>
            <input type="radio" name={`q-${p.id}`} className="h-4 w-4 accent-blue-600" checked={valor === o.id} onChange={() => onChange(o.id)} />
            <span className="text-sm text-slate-800 dark:text-slate-200">{o.texto}</span>
          </label>
        ))}</div>
      );
    case 'escolha_multipla': {
      const sel = new Set(Array.isArray(valor) ? valor : []);
      return (
        <div className="space-y-2">
          <p className="text-xs text-slate-500 dark:text-slate-400">Seleccione todas as correctas.</p>
          {(p.opcoes || []).map(o => (
            <label key={o.id} className={cn('flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800', sel.has(o.id) && 'border-blue-500 bg-blue-50 dark:bg-blue-950/40')}>
              <Checkbox checked={sel.has(o.id)} onCheckedChange={(v) => { const n = new Set(sel); if (v) n.add(o.id); else n.delete(o.id); onChange([...n]); }} aria-label={o.texto} />
              <span className="text-sm text-slate-800 dark:text-slate-200">{o.texto}</span>
            </label>
          ))}
        </div>
      );
    }
    case 'lacuna':
      return <Input value={valor || ''} onChange={(e) => onChange(e.target.value)} placeholder="Escreva a resposta" className="max-w-md" aria-label="Resposta" autoComplete="off" />;
    case 'numerica':
      return <div className="flex items-center gap-2"><Input inputMode="decimal" value={valor ?? ''} onChange={(e) => onChange(e.target.value)} placeholder="Valor" className="max-w-[200px]" aria-label="Valor" autoComplete="off" />{p.unidade && <span className="text-sm text-slate-500">{p.unidade}</span>}</div>;
    case 'ordenacao': {
      const servida = (p.opcoes || []).map(o => o.id);
      const ordem = Array.isArray(valor) && valor.length === servida.length ? valor : servida;
      const texto = Object.fromEntries((p.opcoes || []).map(o => [o.id, o.texto]));
      const mover = (i, d) => { const j = i + d; if (j < 0 || j >= ordem.length) return; const a = [...ordem]; [a[i], a[j]] = [a[j], a[i]]; onChange(a); };
      return (
        <div className="space-y-2">
          <p className="text-xs text-slate-500 dark:text-slate-400">Use as setas para colocar os itens pela ordem correcta (do primeiro ao último).</p>
          <ol className="space-y-1.5">{ordem.map((id, i) => (
            <li key={id} className="flex items-center gap-2 rounded-md border bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
              <span className="w-6 text-sm tabular-nums text-slate-400">{i + 1}.</span><span className="flex-1 text-sm text-slate-800 dark:text-slate-200">{texto[id]}</span>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Subir" disabled={i === 0} onClick={() => mover(i, -1)}><ArrowUp className="h-4 w-4" /></Button>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Descer" disabled={i === ordem.length - 1} onClick={() => mover(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
            </li>
          ))}</ol>
          {!Array.isArray(valor) && <Button type="button" variant="outline" size="sm" onClick={() => onChange(servida)}>Confirmar esta ordem</Button>}
        </div>
      );
    }
    case 'correspondencia': {
      const v = valor && typeof valor === 'object' ? valor : {};
      const ops = (p.direita || []).map(d => ({ value: d.id, label: d.texto }));
      return (
        <div className="space-y-2">{(p.esquerda || []).map(e => (
          <div key={e.id} className="grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
            <span className="text-sm text-slate-800 dark:text-slate-200">{e.texto}</span><span className="hidden text-slate-400 sm:block">↔</span>
            <Select value={v[e.id] || ''} onValueChange={(val) => onChange({ ...v, [e.id]: val })} placeholder="Escolha…" searchable={false} options={ops} />
          </div>
        ))}</div>
      );
    }
    case 'hotspot':
      return (
        <div className="space-y-2">
          <p className="text-xs text-slate-500 dark:text-slate-400">Clique (ou toque) no ponto certo da imagem. Pode corrigir clicando noutro sítio.</p>
          <ImagemClicavel src={p.imagem_url} onClick={(c) => onChange({ x: Math.round(c.x * 10) / 10, y: Math.round(c.y * 10) / 10 })} marcador={valor && Number.isFinite(Number(valor.x)) ? valor : null} />
          {valor && Number.isFinite(Number(valor.x)) && <p className="text-xs text-slate-500 dark:text-slate-400">Ponto marcado.</p>}
        </div>
      );
    case 'rotulos': {
      const v = valor && typeof valor === 'object' ? valor : {};
      const rot = Object.fromEntries((p.rotulos || []).map(r => [r.id, r.texto]));
      const ops = (p.rotulos || []).map(r => ({ value: r.id, label: r.texto }));
      return (
        <div className="space-y-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">Para cada zona numerada na imagem, escolha o rótulo correspondente.</p>
          <div className="relative w-full overflow-hidden rounded-md border bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
            <img src={p.imagem_url} alt="" className="block h-auto max-h-[480px] w-full object-contain" draggable={false} />
            {(p.zonas || []).map((z, i) => (
              <div key={z.id} className={cn('absolute rounded-sm border-2', v[z.id] ? 'border-emerald-500 bg-emerald-500/15' : 'border-blue-500 bg-blue-500/15')} style={{ left: `${z.x}%`, top: `${z.y}%`, width: `${z.w}%`, height: `${z.h}%` }} aria-hidden="true">
                <span className={cn('absolute left-0 top-0 max-w-full truncate rounded-br px-1 text-[11px] font-semibold leading-4 text-white', v[z.id] ? 'bg-emerald-600' : 'bg-blue-600')}>{i + 1}{v[z.id] ? ` · ${rot[v[z.id]] ?? ''}` : ''}</span>
              </div>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">{(p.zonas || []).map((z, i) => (
            <div key={z.id} className="flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">{i + 1}</span>
              <div className="min-w-0 flex-1"><Select value={v[z.id] || ''} onValueChange={(val) => onChange({ ...v, [z.id]: val })} placeholder={`Rótulo da zona ${i + 1}…`} searchable={false} options={ops} /></div>
            </div>
          ))}</div>
        </div>
      );
    }
    case 'aberta': {
      const max = Number(p.max_chars) > 0 ? Number(p.max_chars) : 2000;
      const txt = valor == null ? '' : String(valor);
      return (
        <div className="space-y-1.5">
          <Textarea value={txt} onChange={(e) => onChange(e.target.value.slice(0, max))} rows={6} maxLength={max} placeholder="Escreva a sua resposta…" aria-label="Resposta" onPaste={(e) => { if (semConsulta) e.preventDefault(); }} onDrop={(e) => { if (semConsulta) e.preventDefault(); }} />
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400"><span>Esta resposta é corrigida pelo instrutor; a nota fica pendente até à correcção.</span><span className="tabular-nums">{txt.length}/{max}</span></div>
        </div>
      );
    }
    default: return null;
  }
}

// Imagem que devolve a posição (%) do clique e mostra o marcador.
function ImagemClicavel({ src, onClick, marcador }) {
  const ref = useRef(null);
  return (
    <button type="button" ref={ref} className="relative block w-full cursor-crosshair overflow-hidden rounded-md border bg-slate-100 text-left dark:border-slate-700 dark:bg-slate-800" onClick={(e) => onClick(coordsPct(e, ref.current))} aria-label="Imagem: clique no ponto certo">
      <img src={src} alt="" className="block h-auto max-h-[480px] w-full object-contain" draggable={false} />
      {marcador && <span className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-red-600 shadow-md ring-2 ring-red-600/40" style={{ left: `${marcador.x}%`, top: `${marcador.y}%` }} aria-hidden="true" />}
    </button>
  );
}

// Revisão de hotspot/rotulos: ponto do aluno e zonas correctas (quando o gabarito é mostrado).
function ImagemRevisao({ p, resposta, gabarito }) {
  const zonasCertas = p.tipo === 'hotspot' ? (Array.isArray(gabarito) ? gabarito : []) : (p.zonas || []);
  const rot = Object.fromEntries((p.rotulos || []).map(r => [r.id, r.texto]));
  const v = resposta && typeof resposta === 'object' ? resposta : {};
  return (
    <div className="relative w-full max-w-xl overflow-hidden rounded-md border bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
      <img src={p.imagem_url} alt="" className="block h-auto max-h-80 w-full object-contain" draggable={false} />
      {zonasCertas.map((z, i) => {
        const certo = p.tipo === 'rotulos' && gabarito && v[z.id] && rot[v[z.id]] === gabarito[z.id];
        return (
          <div key={z.id || i} className={cn('absolute rounded-sm border-2', p.tipo === 'hotspot' || certo ? 'border-emerald-500 bg-emerald-500/15' : gabarito ? 'border-red-500 bg-red-500/10' : 'border-blue-500 bg-blue-500/10')} style={{ left: `${z.x}%`, top: `${z.y}%`, width: `${z.w}%`, height: `${z.h}%` }} aria-hidden="true">
            {p.tipo === 'rotulos' && <span className="absolute left-0 top-0 max-w-full truncate rounded-br bg-slate-900/80 px-1 text-[11px] font-semibold leading-4 text-white">{i + 1} · {rot[v[z.id]] ?? '—'}{gabarito && !certo && gabarito[z.id] ? ` (certo: ${gabarito[z.id]})` : ''}</span>}
          </div>
        );
      })}
      {p.tipo === 'hotspot' && Number.isFinite(Number(v.x)) && <span className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-red-600 shadow-md" style={{ left: `${v.x}%`, top: `${v.y}%` }} aria-hidden="true" />}
    </div>
  );
}
