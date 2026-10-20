// Avisos/notícias da página inicial do portal: criar, editar, publicar/despublicar, destacar, remover.
import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Megaphone, Plus, Pencil, Trash2, Loader2, Star, EyeOff, Mail, Send, AlertTriangle } from 'lucide-react';
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
import ConfirmModal from '@/components/shared/ConfirmModal';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import { useAvisos } from '../../hooks';
import { univAcesso } from '../../api';
import { useTodosCursos } from '@/hooks/useGestaoFormacao';
import { PaginaGestao } from '../../PortalLayout';
import { listaEmails, emailsInvalidos } from '@/lib/universidade';

const PUBLICOS = [{ value: 'todos', label: 'Todos os utilizadores' }, { value: 'formandos', label: 'Só formandos' }, { value: 'gestores', label: 'Só gestores (instrutores e administradores)' }];
const paraInputData = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : '');
const vazio = () => ({ titulo: '', corpo: '', destaque: false, publicado: true, publicado_em: new Date().toISOString(), expira_em: null, publico: 'todos', ligacao_url: '', ligacao_texto: '' });

export default function PortalAvisos() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: avisos = [], isLoading } = useAvisos({ gestao: true });
  const [form, setForm] = useState(null);
  const [aGuardar, setAGuardar] = useState(false);
  const [aRemover, setARemover] = useState(null);
  const agora = Date.now();
  const refrescar = () => qc.invalidateQueries({ queryKey: ['universidade_aviso'] });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  // envio por email (o servidor envia um email por pessoa em segundo plano; aqui acompanha-se o progresso)
  const [enviar, setEnviar] = useState(null);
  const [publico, setPublico] = useState('todos');
  const [aEnviar, setAEnviar] = useState(false);
  const [emailsLista, setEmailsLista] = useState('');
  const listaOk = listaEmails(emailsLista); const listaInvalidos = emailsInvalidos(emailsLista);
  const { data: cursos = [] } = useTodosCursos();
  const aEnviarAlgum = avisos.some(a => a.envio?.estado === 'a_enviar');
  useEffect(() => { if (!aEnviarAlgum) return undefined; const t = setInterval(() => qc.invalidateQueries({ queryKey: ['universidade_aviso'] }), 5000); return () => clearInterval(t); }, [aEnviarAlgum, qc]);
  const PUBLICOS_EMAIL = [{ value: 'todos', label: 'Todos os utilizadores activos' }, { value: 'formandos', label: 'Só formandos (perfil formando)' }, { value: 'gestores', label: 'Instrutores e administradores' }, { value: 'lista', label: 'Pessoas específicas (lista de emails)' }, ...cursos.filter(c => !c.deleted_at).map(c => ({ value: `curso:${c.id}`, label: `Inscritos em: ${c.titulo}` }))];
  const enviarEmail = async () => {
    if (!enviar) return;
    setAEnviar(true);
    try {
      if (publico === 'lista' && (!listaOk.length || listaInvalidos.length)) { toast({ title: listaInvalidos.length ? `Email inválido: ${listaInvalidos.join(', ')}` : 'Indique pelo menos um email', variant: 'destructive' }); setAEnviar(false); return; }
      const r = await univAcesso('enviar_aviso', { aviso_id: enviar.id, publico, ...(publico === 'lista' ? { emails: listaOk } : {}) });
      toast({ title: 'Envio iniciado', description: `${r.total} destinatário(s), ${r.entregaveis} entregável(is) pelo relay da SGA. O progresso aparece no aviso.` });
      setEnviar(null); refrescar();
    } catch (e) { toast({ title: 'Não foi possível enviar', description: e?.message, variant: 'destructive' }); } finally { setAEnviar(false); }
  };
  const textoEnvio = (env) => {
    if (!env) return null;
    if (env.estado === 'a_enviar') return `A enviar por email… ${env.enviados} de ${env.total}`;
    const quando = env.concluido_em ? new Date(env.concluido_em).toLocaleString('pt-PT') : '';
    return `Email ${env.estado === 'erro' ? 'falhou' : 'enviado'} ${quando} · ${env.enviados} de ${env.total}${env.nao_entregaveis ? ` (${env.nao_entregaveis} externo(s) não entregável(is))` : ''}${env.falhas?.length ? ` · ${env.falhas.length} falha(s)` : ''}`;
  };

  const guardar = async (e) => {
    e.preventDefault();
    if (!form.titulo.trim()) return;
    setAGuardar(true);
    const payload = { titulo: form.titulo.trim(), corpo: form.corpo?.trim() || null, destaque: !!form.destaque, publicado: !!form.publicado, publicado_em: form.publicado_em || new Date().toISOString(), expira_em: form.expira_em ? new Date(`${paraInputData(form.expira_em)}T23:59:59`).toISOString() : null, publico: form.publico || 'todos', ligacao_url: form.ligacao_url?.trim() || null, ligacao_texto: form.ligacao_texto?.trim() || null };
    try {
      if (form.id) { const { error } = await supabase.from('universidade_aviso').update(payload).eq('id', form.id); if (error) throw error; }
      else { const { error } = await supabase.from('universidade_aviso').insert({ ...payload, autor_email: user?.email, autor_nome: user?.full_name || user?.email }); if (error) throw error; }
      toast({ title: form.id ? 'Aviso actualizado' : 'Aviso publicado' }); setForm(null); refrescar();
    } catch (err) { toast({ title: 'Não foi possível guardar', description: err?.message, variant: 'destructive' }); } finally { setAGuardar(false); }
  };
  const remover = async () => {
    const a = aRemover; if (!a) return;
    const { error } = await supabase.from('universidade_aviso').update({ deleted_at: new Date().toISOString(), publicado: false }).eq('id', a.id);
    if (error) toast({ title: 'Não foi possível remover', description: error.message, variant: 'destructive' }); else { toast({ title: 'Aviso removido' }); refrescar(); }
  };
  const alternar = async (a, campo) => {
    const { error } = await supabase.from('universidade_aviso').update({ [campo]: !a[campo] }).eq('id', a.id);
    if (error) toast({ title: 'Não foi possível alterar', description: error.message, variant: 'destructive' }); else refrescar();
  };

  return (
    <PaginaGestao titulo="Avisos" descricao="Mensagens na página inicial da Universidade: novidades, novos cursos, prazos e lembretes." accoes={<Button onClick={() => setForm(vazio())}><Plus className="h-4 w-4" aria-hidden="true" />Novo aviso</Button>}>
      {isLoading ? <Skeleton className="h-40 w-full" /> : avisos.length === 0 ? (
        <Card className="dark:border-slate-800 dark:bg-slate-900"><CardContent className="flex flex-col items-center gap-3 py-14 text-center"><Megaphone className="h-8 w-8 text-slate-400" aria-hidden="true" /><p className="font-medium">Ainda não há avisos</p><p className="text-sm text-slate-500">Publique o primeiro para o ver na página inicial.</p><Button onClick={() => setForm(vazio())}><Plus className="h-4 w-4" aria-hidden="true" />Novo aviso</Button></CardContent></Card>
      ) : (
        <ul className="grid gap-3">{avisos.map(a => { const expirado = a.expira_em && new Date(a.expira_em).getTime() < agora; const visivel = a.publicado && !expirado && new Date(a.publicado_em).getTime() <= agora; return (
          <li key={a.id}><Card className={cn('dark:bg-slate-900', a.destaque ? 'border-amber-300 dark:border-amber-800' : 'dark:border-slate-800', !visivel && 'opacity-70')}><CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-start">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-slate-900 dark:text-slate-100">{a.titulo}</p>{a.destaque && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">Destaque</span>}<span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', visivel ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300')}>{visivel ? 'Visível' : expirado ? 'Expirado' : a.publicado ? 'Agendado' : 'Rascunho'}</span><span className="text-[11px] text-slate-500">{PUBLICOS.find(p => p.value === a.publico)?.label || a.publico}</span></div>
              {a.corpo && <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm text-slate-600 dark:text-slate-300">{a.corpo}</p>}
              {a.envio && <p className={cn('mt-1 flex items-center gap-1.5 text-xs', a.envio.estado === 'a_enviar' ? 'text-blue-700 dark:text-blue-300' : a.envio.estado === 'erro' ? 'text-red-600' : 'text-emerald-700 dark:text-emerald-300')}>{a.envio.estado === 'a_enviar' ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Mail className="h-3.5 w-3.5" aria-hidden="true" />}{textoEnvio(a.envio)}</p>}
              <p className="mt-1 text-xs text-slate-500">Publicado {new Date(a.publicado_em).toLocaleDateString('pt-PT')}{a.expira_em ? ` · expira ${new Date(a.expira_em).toLocaleDateString('pt-PT')}` : ''}{a.autor_nome ? ` · ${a.autor_nome}` : ''}{a.ligacao_url ? ` · ligação: ${a.ligacao_url}` : ''}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-1.5">
              <Button variant="outline" size="sm" disabled={a.envio?.estado === 'a_enviar'} onClick={() => { setPublico(a.publico === 'gestores' ? 'gestores' : a.publico === 'formandos' ? 'formandos' : 'todos'); setEnviar(a); }} title="Enviar este aviso por email"><Mail className="h-4 w-4" aria-hidden="true" />Email</Button>
              <Button variant="outline" size="sm" onClick={() => alternar(a, 'destaque')} title={a.destaque ? 'Tirar destaque' : 'Destacar'}><Star className={cn('h-4 w-4', a.destaque && 'fill-amber-400 text-amber-500')} aria-hidden="true" /></Button>
              <Button variant="outline" size="sm" onClick={() => alternar(a, 'publicado')} title={a.publicado ? 'Despublicar' : 'Publicar'}><EyeOff className="h-4 w-4" aria-hidden="true" />{a.publicado ? 'Despublicar' : 'Publicar'}</Button>
              <Button variant="outline" size="sm" onClick={() => setForm({ ...a, expira_em: a.expira_em || null })}><Pencil className="h-4 w-4" aria-hidden="true" />Editar</Button>
              <Button variant="outline" size="sm" className="text-red-600" onClick={() => setARemover(a)}><Trash2 className="h-4 w-4" aria-hidden="true" /></Button>
            </div>
          </CardContent></Card></li>
        ); })}</ul>
      )}

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{form?.id ? 'Editar aviso' : 'Novo aviso'}</DialogTitle><DialogDescription>Aparece na página inicial de quem tiver acesso ao público escolhido.</DialogDescription></DialogHeader>
          {form && (
            <form onSubmit={guardar} className="space-y-3">
              <div className="space-y-1.5"><Label htmlFor="av-titulo">Título *</Label><Input id="av-titulo" value={form.titulo} onChange={e => set('titulo', e.target.value)} maxLength={140} required /></div>
              <div className="space-y-1.5"><Label htmlFor="av-corpo">Texto</Label><Textarea id="av-corpo" value={form.corpo || ''} onChange={e => set('corpo', e.target.value)} rows={5} maxLength={3000} /></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label>Público</Label><Select options={PUBLICOS} value={form.publico} onValueChange={v => set('publico', v)} /></div>
                <div className="space-y-1.5"><Label htmlFor="av-exp">Expira em</Label><Input id="av-exp" type="date" value={paraInputData(form.expira_em)} onChange={e => set('expira_em', e.target.value || null)} /></div>
                <div className="space-y-1.5"><Label htmlFor="av-url">Ligação (opcional)</Label><Input id="av-url" value={form.ligacao_url || ''} onChange={e => set('ligacao_url', e.target.value)} placeholder="/universidade/formacao?curso=… ou https://…" /></div>
                <div className="space-y-1.5"><Label htmlFor="av-lt">Texto da ligação</Label><Input id="av-lt" value={form.ligacao_texto || ''} onChange={e => set('ligacao_texto', e.target.value)} placeholder="Ver o curso" /></div>
              </div>
              <div className="flex flex-wrap gap-6 pt-1">
                <label className="flex items-center gap-2 text-sm"><Switch checked={!!form.destaque} onCheckedChange={v => set('destaque', v)} />Destaque (fundo âmbar, no topo)</label>
                <label className="flex items-center gap-2 text-sm"><Switch checked={!!form.publicado} onCheckedChange={v => set('publicado', v)} />Publicado</label>
              </div>
              <DialogFooter><Button type="button" variant="outline" onClick={() => setForm(null)}>Cancelar</Button><Button type="submit" disabled={aGuardar || !form.titulo.trim()}>{aGuardar ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}{form.id ? 'Guardar' : 'Publicar'}</Button></DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!enviar} onOpenChange={(o) => { if (!o && !aEnviar) setEnviar(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Mail className="h-5 w-5 text-violet-600" aria-hidden="true" />Enviar aviso por email</DialogTitle><DialogDescription>«{enviar?.titulo}» — o servidor envia um email individual a cada pessoa (o relay da SGA não aceita envios em massa), em segundo plano.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Destinatários</Label><Select options={PUBLICOS_EMAIL} value={publico} onValueChange={setPublico} /></div>
            {publico === 'lista' && <div className="space-y-1.5"><Label htmlFor="av-emails">Emails (um por linha ou separados por vírgula)</Label><Textarea id="av-emails" rows={4} value={emailsLista} onChange={e => setEmailsLista(e.target.value)} placeholder={'ana.silva@sga.co.ao\njoao.mateus@sga.co.ao'} className="font-mono text-xs" />{listaInvalidos.length > 0 ? <p className="text-xs text-red-600">Inválido: {listaInvalidos.join(', ')}</p> : <p className="text-xs text-slate-500">{listaOk.length} destinatário(s).</p>}</div>}
            <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span>Só endereços @sga.co.ao recebem (os externos contam como «não entregáveis»). O email leva o título, o texto e o botão da ligação do aviso. Fica registado na auditoria.</span></p>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEnviar(null)} disabled={aEnviar}>Cancelar</Button><Button onClick={enviarEmail} disabled={aEnviar}>{aEnviar ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}Enviar agora</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmModal isOpen={!!aRemover} onClose={() => setARemover(null)} onConfirm={remover} title="Remover aviso" message={`Remover «${aRemover?.titulo}»? Deixa de aparecer na página inicial.`} confirmText="Remover" variant="destructive" />
    </PaginaGestao>
  );
}
