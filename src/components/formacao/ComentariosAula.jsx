import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageCircle, Send, Trash2, Reply, Pin, Loader2, GraduationCap } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';
import { AulaComentario } from '@/entities/AulaComentario';
import { sendEmailDirect } from '@/functions/sendEmailDirect';
import { urlCursoPortal, emailInterno } from '@/lib/universidade';
import { useConfigPortal } from '@/universidade/hooks';
import { fmtData, podeEditarCurso } from './formacaoUtils';

export function useComentariosAula(aulaId) {
  return useQuery({
    queryKey: ['aula_comentario', aulaId],
    enabled: !!aulaId,
    queryFn: () => AulaComentario.filter({ aula_id: aulaId, deleted_at: null }, 'created_date').catch(() => []),
    staleTime: 30 * 1000, refetchOnWindowFocus: false,
  });
}

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const instrutoresDe = (curso) => [...new Set([curso?.instrutor_email, ...(Array.isArray(curso?.instrutores) ? curso.instrutores : [])].map(e => String(e || '').trim().toLowerCase()).filter(e => e.includes('@')))];
function emailHtml({ titulo, linhas, citacao, botao, rodape }) {
  return `<div style="font-family:Segoe UI,Arial,sans-serif;color:#0f172a;max-width:600px"><h2 style="font-size:18px;margin:0 0 10px">${esc(titulo)}</h2>${linhas.map(l => `<p style="margin:0 0 8px;color:#334155;font-size:14px;line-height:1.6">${l}</p>`).join('')}${citacao ? `<blockquote style="margin:12px 0;padding:10px 14px;border-left:4px solid #7c3aed;background:#f8fafc;border-radius:6px;white-space:pre-wrap;color:#0f172a">${esc(citacao)}</blockquote>` : ''}${botao ? `<p style="margin:18px 0"><a href="${botao.url}" style="display:inline-block;background:#004A99;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">${esc(botao.texto)}</a></p>` : ''}<p style="margin-top:16px;color:#94a3b8;font-size:12px">${esc(rodape || 'Universidade Corporativa · SGA')}</p></div>`;
}

// Perguntas e comentários dos alunos por aula, com respostas (1 nível) e destaque para o instrutor.
// Emails (desligáveis nas configurações do portal): pergunta nova → instrutores do curso; resposta do instrutor → autor da pergunta.
export default function ComentariosAula({ aula, curso }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: lista = [], isLoading } = useComentariosAula(aula?.id);
  const { data: cfg } = useConfigPortal();
  const [texto, setTexto] = useState('');
  const [respondendo, setRespondendo] = useState(null); // parent id
  const [busy, setBusy] = useState(null);
  const email = String(user?.email || '').toLowerCase();
  const gestor = podeEditarCurso(user, curso);
  const avisar = !cfg || cfg.enviar_comentarios !== false;
  const instrutores = useMemo(() => instrutoresDe(curso).filter(e => e !== email), [curso, email]);
  const threads = useMemo(() => {
    const raiz = lista.filter(c => !c.parent_id).sort((a, b) => (b.fixado === a.fixado ? new Date(a.created_date) - new Date(b.created_date) : b.fixado ? 1 : -1));
    return raiz.map(r => ({ ...r, respostas: lista.filter(c => c.parent_id === r.id) }));
  }, [lista]);
  const refrescar = () => qc.invalidateQueries({ queryKey: ['aula_comentario', aula.id] });

  // Aviso por email (best-effort: nunca impede a publicação). Só chega a endereços internos (relay da SGA).
  const notificar = async (t, parentId) => {
    if (!avisar) return { enviado: false, motivo: 'desligado' };
    const link = `${window.location.origin}${urlCursoPortal(curso?.id || aula.curso_id, `&aula=${aula.id}`)}`;
    const nome = user?.full_name || email;
    const rodape = cfg?.rodape_email;
    try {
      if (!gestor) {
        const to = instrutores.filter(emailInterno);
        if (!to.length) return { enviado: false, motivo: 'sem instrutor interno' };
        await sendEmailDirect({ to, subject: `[Formação] ${parentId ? 'Novo comentário' : 'Nova pergunta'} em «${curso?.titulo || 'curso'}» — ${aula.titulo}`, from_name: cfg?.email_remetente_nome || undefined, reply_to: emailInterno(email) ? email : undefined,
          html: emailHtml({ titulo: parentId ? 'Novo comentário numa aula' : 'Nova pergunta de um formando', linhas: [`<strong>${esc(nome)}</strong> (${esc(email)}) escreveu na aula <strong>${esc(aula.titulo)}</strong> do curso <strong>${esc(curso?.titulo || '')}</strong>:`], citacao: t, botao: { texto: 'Responder na aula', url: link }, rodape }) });
        return { enviado: true, para: to };
      }
      if (parentId) {
        const pai = lista.find(c => c.id === parentId);
        const dest = String(pai?.autor_email || '').toLowerCase();
        if (!dest || dest === email || !emailInterno(dest)) return { enviado: false, motivo: 'autor externo ou o próprio' };
        await sendEmailDirect({ to: dest, subject: `[Formação] O instrutor respondeu à sua pergunta — ${curso?.titulo || aula.titulo}`, from_name: cfg?.email_remetente_nome || undefined, reply_to: cfg?.email_resposta || (emailInterno(email) ? email : undefined),
          html: emailHtml({ titulo: 'O instrutor respondeu', linhas: [`Olá ${esc((pai?.autor_nome || dest).split(' ')[0])}, <strong>${esc(nome)}</strong> respondeu à sua pergunta na aula <strong>${esc(aula.titulo)}</strong>:`], citacao: t, botao: { texto: 'Ver a resposta na aula', url: link }, rodape }) });
        return { enviado: true, para: [dest] };
      }
      return { enviado: false, motivo: 'comentário do instrutor sem destinatário' };
    } catch (e) { console.warn('[comentários] email não enviado:', e?.message || e); return { enviado: false, motivo: e?.message }; }
  };

  const publicar = async (parentId = null) => {
    const t = texto.trim();
    if (!t || !email) return;
    setBusy('novo');
    try {
      await AulaComentario.create({ aula_id: aula.id, curso_id: curso?.id || aula.curso_id || null, parent_id: parentId, autor_email: email, autor_nome: user?.full_name || email, texto: t, instrutor: gestor });
      setTexto(''); setRespondendo(null); await refrescar();
      const r = await notificar(t, parentId);
      if (r.enviado) toast({ title: parentId && gestor ? 'Resposta publicada' : 'Comentário publicado', description: gestor ? 'O formando foi avisado por email.' : 'O instrutor recebeu a sua pergunta por email.' });
    } catch (e) { toast({ title: 'Não foi possível publicar', description: e?.message || String(e), variant: 'destructive' }); }
    finally { setBusy(null); }
  };
  const apagar = async (c) => {
    setBusy(c.id);
    try { await AulaComentario.update(c.id, { deleted_at: new Date().toISOString() }); await refrescar(); }
    catch (e) { toast({ title: 'Não foi possível apagar', description: e?.message || String(e), variant: 'destructive' }); }
    finally { setBusy(null); }
  };
  const fixar = async (c) => {
    setBusy(c.id);
    try { await AulaComentario.update(c.id, { fixado: !c.fixado }); await refrescar(); }
    catch (e) { toast({ title: 'Não foi possível fixar', description: e?.message || String(e), variant: 'destructive' }); }
    finally { setBusy(null); }
  };

  const Item = ({ c, resposta = false }) => (
    <div className={cn('rounded-lg border p-3 dark:border-slate-800', c.instrutor ? 'border-violet-200 bg-violet-50/60 dark:border-violet-900 dark:bg-violet-950/20' : 'bg-white dark:bg-slate-900', resposta && 'ml-6')}>
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span className="font-medium text-slate-800 dark:text-slate-200">{c.autor_nome || c.autor_email}</span>
        {c.instrutor && <Badge className="border-0 bg-violet-600 text-white hover:bg-violet-600"><GraduationCap className="mr-1 h-3 w-3" aria-hidden="true" />Instrutor</Badge>}
        {c.fixado && <Badge variant="outline" className="border-amber-300 text-amber-700"><Pin className="mr-1 h-3 w-3" aria-hidden="true" />Fixado</Badge>}
        <span>{fmtData(c.created_date)}</span>
        <span className="ml-auto flex items-center gap-1">
          {!resposta && email && <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => { setRespondendo(respondendo === c.id ? null : c.id); setTexto(''); }}><Reply className="h-3.5 w-3.5" aria-hidden="true" />Responder</Button>}
          {gestor && !resposta && <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={c.fixado ? 'Desafixar' : 'Fixar no topo'} disabled={busy === c.id} onClick={() => fixar(c)}><Pin className={cn('h-3.5 w-3.5', c.fixado && 'fill-current text-amber-600')} /></Button>}
          {(gestor || c.autor_email?.toLowerCase() === email) && <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600" aria-label="Apagar comentário" disabled={busy === c.id} onClick={() => apagar(c)}><Trash2 className="h-3.5 w-3.5" /></Button>}
        </span>
      </div>
      <p className="mt-1.5 whitespace-pre-line text-sm text-slate-800 dark:text-slate-200">{c.texto}</p>
    </div>
  );

  const semResposta = threads.filter(t => !t.instrutor && !t.respostas.some(r => r.instrutor)).length;
  const ajuda = gestor
    ? `Visível para todos os inscritos no curso. As suas respostas aparecem destacadas como instrutor${avisar ? ' e o formando é avisado por email' : ''}.`
    : `Visível para todos os inscritos no curso. ${avisar && instrutores.length ? `O instrutor (${instrutores.length === 1 ? instrutores[0] : instrutores.length + ' pessoas'}) recebe a sua pergunta por email.` : 'O instrutor vê a pergunta quando abrir a aula.'}`;

  return (
    <Card className="dark:border-slate-800 dark:bg-slate-900">
      <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><MessageCircle className="h-4 w-4 text-slate-500" aria-hidden="true" />Perguntas e comentários{threads.length > 0 && <span className="text-sm font-normal text-slate-500">({threads.length})</span>}{gestor && semResposta > 0 && <Badge variant="outline" className="border-amber-300 text-amber-700">{semResposta} sem resposta</Badge>}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? <Skeleton className="h-16 w-full" /> : threads.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">Ainda não há comentários nesta aula. Tem dúvidas? Pergunte aqui — o instrutor e os colegas podem responder.</p> : threads.map(t => (
          <div key={t.id} className="space-y-2">
            <Item c={t} />
            {t.respostas.map(r => <Item key={r.id} c={r} resposta />)}
            {respondendo === t.id && (
              <div className="ml-6 space-y-2">
                <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={2} placeholder={`Responder a ${t.autor_nome || t.autor_email}…`} aria-label="Resposta" autoFocus />
                <div className="flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={() => { setRespondendo(null); setTexto(''); }}>Cancelar</Button><Button size="sm" disabled={!texto.trim() || busy === 'novo'} onClick={() => publicar(t.id)}>{busy === 'novo' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}Responder</Button></div>
              </div>
            )}
          </div>
        ))}
        {email && respondendo == null && (
          <div className="space-y-2 border-t pt-3 dark:border-slate-800">
            <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={2} placeholder="Escreva uma pergunta ou comentário sobre esta aula…" aria-label="Novo comentário" maxLength={4000} />
            <div className="flex items-center justify-between gap-2"><p className="text-xs text-slate-500">{ajuda}</p><Button size="sm" disabled={!texto.trim() || busy === 'novo'} onClick={() => publicar(null)}>{busy === 'novo' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}Publicar</Button></div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
