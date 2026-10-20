// Suporte da Universidade: tickets abertos pelos formandos no portal (categoria "universidade"); resposta por email e mudança de estado.
import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Inbox, Search, Loader2, Send, Paperclip, CheckCircle2, Clock, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import Select from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { ehAdminPortal } from '@/lib/universidade';
import { sendEmailDirect } from '@/functions/sendEmailDirect';
import { cn } from '@/lib/utils';
import { emailInterno } from '@/lib/universidade';
import { useTicketsUniversidade, useConfigPortal } from '../../hooks';
import { PaginaGestao } from '../../PortalLayout';

const ESTADOS = [{ value: 'aberta', label: 'Aberto' }, { value: 'em_analise', label: 'Em análise' }, { value: 'resolvida', label: 'Resolvido' }, { value: 'fechada', label: 'Fechado' }];
const COR = { aberta: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200', em_analise: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200', resolvida: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200', fechada: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200' };
const label = (s) => ESTADOS.find(e => e.value === s)?.label || s;
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export default function PortalSuporteGestao() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: cfg } = useConfigPortal();
  const admin = ehAdminPortal(user);
  const [todos, setTodos] = useState(false);
  const { data: tickets = [], isLoading, isFetching, refetch } = useTicketsUniversidade({ todos: admin && todos });
  const [estado, setEstado] = useState('abertos'); const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState(null); const [resposta, setResposta] = useState(''); const [novoEstado, setNovoEstado] = useState('resolvida'); const [enviarEmail, setEnviarEmail] = useState(true); const [busy, setBusy] = useState(false);
  const q = busca.trim().toLowerCase();
  const lista = useMemo(() => tickets.filter(t => (estado === 'todos' || (estado === 'abertos' ? ['aberta', 'em_analise'].includes(t.status) : t.status === estado)) && (!q || [t.numero_ticket, t.assunto, t.solicitante_nome, t.solicitante_email, t.mensagem].some(v => String(v || '').toLowerCase().includes(q)))), [tickets, estado, q]);
  const abrir = (t) => { setAberto(t); setResposta(t.resposta || ''); setNovoEstado(['aberta', 'em_analise'].includes(t.status) ? 'resolvida' : t.status); setEnviarEmail(emailInterno(t.solicitante_email)); };

  const guardar = async () => {
    if (!aberto) return;
    setBusy(true);
    try {
      const patch = { status: novoEstado, resposta: resposta.trim() || null, respondido_por: user?.full_name || user?.email, respondido_em: new Date().toISOString() };
      const { error } = await supabase.from('ticket_suporte').update(patch).eq('id', aberto.id);
      if (error) throw error;
      let aviso = '';
      if (enviarEmail && resposta.trim() && aberto.solicitante_email) {
        try {
          await sendEmailDirect({ to: aberto.solicitante_email, subject: `Re: ${aberto.numero_ticket} — ${aberto.assunto}`, from_name: cfg?.email_remetente_nome || undefined, reply_to: cfg?.email_resposta || cfg?.email_suporte || undefined,
            html: `<div style="font-family:Segoe UI,Arial,sans-serif;color:#0f172a;max-width:600px"><p>Olá ${esc((aberto.solicitante_nome || '').split(' ')[0])},</p><p>Sobre o seu pedido <strong>${esc(aberto.numero_ticket)}</strong> («${esc(aberto.assunto)}»):</p><div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;white-space:pre-wrap">${esc(resposta.trim())}</div><p style="margin-top:12px">Estado: <strong>${esc(label(novoEstado))}</strong>.</p><p style="color:#64748b;font-size:12px">${esc(cfg?.rodape_email || 'Universidade Corporativa · SGA')} · ${esc(user?.full_name || user?.email || '')}</p></div>` });
          aviso = ' e resposta enviada por email';
        } catch (e) { aviso = ` (email não enviado: ${e?.message || 'falha'})`; }
      }
      toast({ title: `Ticket ${label(novoEstado).toLowerCase()}${aviso}` });
      setAberto(null); qc.invalidateQueries({ queryKey: ['ticket_suporte'] });
    } catch (e) { toast({ title: 'Não foi possível guardar', description: e?.message, variant: 'destructive' }); } finally { setBusy(false); }
  };
  const abertos = tickets.filter(t => ['aberta', 'em_analise'].includes(t.status)).length;

  return (
    <PaginaGestao titulo="Suporte" descricao={`Pedidos de apoio feitos no portal. Responda aqui: o formando recebe a resposta por email.`} accoes={<Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}><RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} aria-hidden="true" />Actualizar</Button>}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[16rem] flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" /><Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Procurar por número, assunto, pessoa…" className="pl-9" aria-label="Procurar" /></div>
        <div className="w-44"><Select options={[{ value: 'abertos', label: `Abertos (${abertos})` }, { value: 'todos', label: 'Todos' }, ...ESTADOS]} value={estado} onValueChange={setEstado} /></div>
        {admin && <label className="flex items-center gap-2 text-sm"><Switch checked={todos} onCheckedChange={setTodos} />Todos os tickets (não só da Universidade)</label>}
      </div>
      <Card className="dark:border-slate-800 dark:bg-slate-900"><CardContent className="p-0">
        {isLoading ? <div className="space-y-2 p-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div> : lista.length === 0 ? <div className="flex flex-col items-center gap-2 py-12 text-center"><Inbox className="h-8 w-8 text-slate-400" aria-hidden="true" /><p className="font-medium">Sem tickets</p><p className="text-sm text-slate-500">{estado === 'abertos' ? 'Não há pedidos por responder.' : 'Nada para mostrar com estes filtros.'}</p></div> : (
          <ul className="divide-y dark:divide-slate-800">{lista.map(t => (
            <li key={t.id}><button type="button" onClick={() => abrir(t)} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60">
              <span className={cn('mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold', COR[t.status] || COR.fechada)}>{label(t.status)}</span>
              <span className="min-w-0 flex-1"><span className="block truncate font-medium text-slate-900 dark:text-slate-100">{t.assunto}</span><span className="block truncate text-xs text-slate-500">{t.numero_ticket} · {t.solicitante_nome || t.solicitante_email} · {new Date(t.created_date).toLocaleString('pt-PT')}{t.categoria && t.categoria !== 'universidade' ? ` · ${t.categoria}` : ''}{Array.isArray(t.anexos) && t.anexos.length ? ` · ${t.anexos.length} anexo(s)` : ''}</span></span>
              {t.resposta ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" /> : <Clock className="h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />}
            </button></li>
          ))}</ul>
        )}
      </CardContent></Card>

      <Dialog open={!!aberto} onOpenChange={(o) => !o && setAberto(null)}>
        <DialogContent className="max-w-2xl">
          {aberto && (
            <>
              <DialogHeader><DialogTitle>{aberto.numero_ticket} — {aberto.assunto}</DialogTitle><DialogDescription>{aberto.solicitante_nome} · {aberto.solicitante_email} · {new Date(aberto.created_date).toLocaleString('pt-PT')}</DialogDescription></DialogHeader>
              <div className="space-y-4">
                <div className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-950">{aberto.mensagem}</div>
                {Array.isArray(aberto.anexos) && aberto.anexos.length > 0 && <ul className="flex flex-wrap gap-2 text-sm">{aberto.anexos.map((a, i) => <li key={i}><a href={a.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded border px-2 py-1 hover:bg-slate-50 dark:border-slate-700"><Paperclip className="h-3.5 w-3.5" aria-hidden="true" />{a.nome || 'anexo'}</a></li>)}</ul>}
                {aberto.resposta && aberto.respondido_em && <p className="text-xs text-slate-500">Última resposta por {aberto.respondido_por} em {new Date(aberto.respondido_em).toLocaleString('pt-PT')}.</p>}
                <div className="space-y-1.5"><Label htmlFor="tk-resp">Resposta</Label><Textarea id="tk-resp" value={resposta} onChange={e => setResposta(e.target.value)} rows={5} maxLength={4000} placeholder="Explique a solução ou peça mais informação." /></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5"><Label>Novo estado</Label><Select options={ESTADOS} value={novoEstado} onValueChange={setNovoEstado} /></div>
                  <label className="flex items-center gap-2 self-end pb-2 text-sm"><Switch checked={enviarEmail} onCheckedChange={setEnviarEmail} disabled={!emailInterno(aberto.solicitante_email)} />Enviar resposta por email{!emailInterno(aberto.solicitante_email) && <span className="text-xs text-amber-700 dark:text-amber-300">(email externo)</span>}</label>
                </div>
                {!resposta.trim() && enviarEmail && <p className="flex items-center gap-2 text-xs text-slate-500"><AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />Sem texto de resposta só o estado é actualizado (não sai email).</p>}
              </div>
              <DialogFooter><Button variant="outline" onClick={() => setAberto(null)}>Cancelar</Button><Button onClick={guardar} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}Guardar{enviarEmail && resposta.trim() ? ' e enviar' : ''}</Button></DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </PaginaGestao>
  );
}
