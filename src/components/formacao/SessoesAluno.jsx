import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarDays, MapPin, User, Users, Loader2, CheckCircle2, XCircle, Clock, Video, ExternalLink } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { useSessoesAluno, inscreverSessao, cancelarInscricaoSessao, registarEntradaSessao } from '@/hooks/useFormacao';
import { ESTADO_INSCRICAO, ESTADO_SESSAO, MODALIDADE, PLATAFORMAS, ocupacaoSessao, faseSessao, podeInscrever, fmtPeriodoSessao, temLink, linkAberto, modoDe, localTexto } from '@/lib/formacaoSessoes';
import { Materiais } from './ConteudoAula';

// Lista de sessões (presenciais / online / híbridas) de um curso com inscrição/cancelamento pelo aluno.
// aulaId (opcional): mostra só as sessões ligadas a essa aula presencial.
export default function SessoesAluno({ cursoId, matricula, aulaId = null, compacto = false }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useSessoesAluno(cursoId, matricula?.aluno_email);
  const [busy, setBusy] = useState(null);
  if (isLoading) return <div className="space-y-2"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>;
  const todas = data?.sessoes || [];
  const inscricoes = data?.inscricoes || [];
  const sessoes = (aulaId ? todas.filter(s => s.aula_id === aulaId) : todas).filter(s => s.estado !== 'cancelada' || inscricoes.some(i => i.sessao_id === s.id && i.estado !== 'cancelado'));
  if (sessoes.length === 0) return compacto ? null : <p className="text-sm text-slate-500 dark:text-slate-400">Ainda não há sessões agendadas para este curso. O instrutor avisará por email quando marcar uma.</p>;

  const refrescar = () => Promise.all([qc.invalidateQueries({ queryKey: ['sessao_formacao'] }), qc.invalidateQueries({ queryKey: ['matricula'] }), qc.invalidateQueries({ queryKey: ['progresso_aula'] })]);
  const inscrever = async (s, modo = null) => {
    if (!matricula) { toast({ title: 'Inscreva-se primeiro no curso', description: 'A inscrição na sessão exige matrícula no curso.' }); return; }
    setBusy(s.id);
    try {
      const i = await inscreverSessao(s.id, modo);
      toast({ title: i?.estado === 'lista_espera' ? 'Ficou em lista de espera' : 'Inscrição na sessão confirmada', description: i?.estado === 'lista_espera' ? 'A sala está cheia; será promovido(a) se surgir uma vaga.' : `${fmtPeriodoSessao(s)}${modo === 'online' || s.modalidade === 'online' ? ' · online' : ''}` });
      await refrescar();
    } catch (e) { toast({ title: 'Não foi possível inscrever', description: e?.message || String(e), variant: 'destructive' }); }
    finally { setBusy(null); }
  };
  const cancelar = async (i) => {
    setBusy(i.sessao_id);
    try { await cancelarInscricaoSessao(i.id); toast({ title: 'Inscrição cancelada' }); await refrescar(); }
    catch (e) { toast({ title: 'Não foi possível cancelar', description: e?.message || String(e), variant: 'destructive' }); }
    finally { setBusy(null); }
  };
  const entrar = (s) => { registarEntradaSessao(s.id).catch(() => {}); window.open(String(s.link_online).trim(), '_blank', 'noopener,noreferrer'); };

  return (
    <ul className="space-y-2">
      {sessoes.map(s => {
        const minha = inscricoes.find(i => i.sessao_id === s.id && i.estado !== 'cancelado') || null;
        const oc = ocupacaoSessao(s, []);
        const fase = faseSessao(s);
        const est = minha ? ESTADO_INSCRICAO[minha.estado] : null;
        const mod = MODALIDADE[s.modalidade] || MODALIDADE.presencial;
        const modo = minha ? modoDe(s, minha) : null;
        const mostraLink = minha && ['inscrito', 'presente'].includes(minha.estado) && temLink(s) && (s.modalidade === 'online' || modo === 'online' || s.modalidade === 'hibrida');
        const materiais = Array.isArray(s.materiais) ? s.materiais.filter(m => m && m.url) : [];
        const podeIns = podeInscrever(s, minha);
        return (
          <li key={s.id} className={cn('rounded-xl border bg-white p-3 dark:border-slate-800 dark:bg-slate-900', minha?.estado === 'presente' && 'border-emerald-200 dark:border-emerald-900')}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-slate-900 dark:text-slate-100">{s.titulo}</p>
                  <Badge className={cn('border-0', mod.cor)}>{s.modalidade !== 'presencial' && <Video className="mr-1 h-3 w-3" aria-hidden="true" />}{mod.curto}</Badge>
                  {s.estado !== 'agendada' && <Badge className={cn('border-0', ESTADO_SESSAO[s.estado]?.cor)}>{ESTADO_SESSAO[s.estado]?.label}</Badge>}
                  {est && <Badge className={cn('border-0', est.cor)}>{minha.estado === 'presente' ? <CheckCircle2 className="mr-1 h-3 w-3" aria-hidden="true" /> : minha.estado === 'ausente' ? <XCircle className="mr-1 h-3 w-3" aria-hidden="true" /> : null}{est.label}{s.modalidade === 'hibrida' && modo ? ` · ${modo === 'online' ? 'online' : 'presencial'}` : ''}</Badge>}
                  {fase === 'a_decorrer' && s.estado === 'agendada' && <Badge variant="outline" className="border-emerald-300 text-emerald-700">A decorrer</Badge>}
                </div>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600 dark:text-slate-300">
                  <span className="inline-flex items-center gap-1"><CalendarDays className="h-4 w-4 text-slate-400" aria-hidden="true" />{fmtPeriodoSessao(s)}</span>
                  {s.modalidade !== 'online' && localTexto(s) && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4 text-slate-400" aria-hidden="true" />{localTexto(s)}</span>}
                  {s.modalidade !== 'presencial' && <span className="inline-flex items-center gap-1"><Video className="h-4 w-4 text-slate-400" aria-hidden="true" />{PLATAFORMAS[s.plataforma] || 'Videochamada'}</span>}
                  {s.formador_nome && <span className="inline-flex items-center gap-1"><User className="h-4 w-4 text-slate-400" aria-hidden="true" />{s.formador_nome}</span>}
                  {oc.vagas != null && s.modalidade !== 'online' && <span className="inline-flex items-center gap-1"><Users className="h-4 w-4 text-slate-400" aria-hidden="true" />{oc.vagas} {oc.vagas === 1 ? 'lugar na sala' : 'lugares na sala'}</span>}
                </p>
                {s.descricao && !compacto && <p className="text-sm text-slate-600 dark:text-slate-400">{s.descricao}</p>}
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {mostraLink && <Button size="sm" className={cn(linkAberto(s) ? 'bg-teal-700 hover:bg-teal-700' : '')} variant={linkAberto(s) ? 'default' : 'outline'} onClick={() => entrar(s)} title={linkAberto(s) ? 'A sessão está a decorrer' : 'A ligação abre 30 min antes; pode testar já'}><Video className="h-4 w-4" aria-hidden="true" />Entrar na sessão<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></Button>}
                {minha && ['inscrito', 'lista_espera'].includes(minha.estado) && fase !== 'passada' && s.estado === 'agendada' && (
                  <Button variant="outline" size="sm" disabled={busy === s.id} onClick={() => cancelar(minha)}>{busy === s.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}Cancelar inscrição</Button>
                )}
                {podeIns && s.modalidade !== 'hibrida' && (
                  <Button size="sm" disabled={busy === s.id} onClick={() => inscrever(s)}>{busy === s.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CalendarDays className="h-4 w-4" aria-hidden="true" />}Inscrever-me</Button>
                )}
                {podeIns && s.modalidade === 'hibrida' && (
                  <>
                    <Button size="sm" disabled={busy === s.id} onClick={() => inscrever(s, 'presencial')}>{busy === s.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <MapPin className="h-4 w-4" aria-hidden="true" />}Na sala</Button>
                    <Button size="sm" variant="outline" disabled={busy === s.id} onClick={() => inscrever(s, 'online')}><Video className="h-4 w-4" aria-hidden="true" />Online</Button>
                  </>
                )}
                {!minha && !podeIns && fase === 'passada' && <span className="inline-flex items-center gap-1 text-xs text-slate-500"><Clock className="h-3.5 w-3.5" aria-hidden="true" />Já decorreu</span>}
              </div>
            </div>
            {materiais.length > 0 && minha && <div className="mt-3"><Materiais itens={materiais} titulo="Materiais da sessão" /></div>}
          </li>
        );
      })}
    </ul>
  );
}
