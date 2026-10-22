// Gestão de acessos ao portal: pedidos (aprovar/rejeitar), convites (enviar, reenviar, copiar link, cancelar) e utilizadores (revogar/reactivar).
import React, { useMemo, useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { UserPlus, UserCheck, UserX, Mail, Copy, RefreshCw, Ban, Search, Loader2, CheckCircle2, AlertTriangle, Clock, ShieldCheck, Link2, RotateCcw, Filter, UserCog, Info, Pencil, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Select from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { useAuth } from '@/lib/AuthContext';
import { perfisPortal, contaGlobal, PERFIS_UNIVERSIDADE } from '@/lib/universidade';
import { cn } from '@/lib/utils';
import { emailValido, emailInterno, estadoConvite, ESTADO_PEDIDO, CORES_BADGE, resumoAcessos, PAGINAS_PORTAL, PERFIS_PORTAL } from '@/lib/universidade';
import { PERFIL_UC_LABEL, NIVEIS_PERFIL_UC, CORES_PERFIL_UC, slugPerfilUc, perfisPersonalizadosUc, nivelDoPerfilUc, paginasPadraoUc, ehPerfilUniversidade, contarComPerfil, perfisEscolhidosUc } from '@/lib/universidade';
import { useAcessos, guardarPerfisUniversidade, usePermissoesPortal, guardarPermissoesPortal, editarUtilizadorPortal, excluirUtilizadorPortal, useAeroportosUc, useFormandoUc, guardarPerfilPersonalizadoUc, apagarPerfilPersonalizadoUc, auditarPortal } from '../../hooks';
import { useTodosCursos } from '@/hooks/useGestaoFormacao';
import { univAcesso } from '../../api';
import { PaginaGestao } from '../../PortalLayout';

const PERFIL_LABEL = { admin_universidade: 'Administrador da Universidade', administrador: 'Administrador', instrutor: 'Instrutor', formando: 'Formando', operacoes: 'Operações', safety: 'Safety', infraestrutura: 'Infraestrutura', credenciamento: 'Credenciamento', gestor_empresa: 'Gestor de empresa', visualizador: 'Visualizador', documentos_ged: 'GED' };
const PERFIS_FILTRO = [{ value: 'universidade', label: 'Com perfis da Universidade' }, { value: 'formando', label: 'Só formandos' }, { value: 'instrutor', label: 'Só instrutores' }, { value: 'admin_universidade', label: 'Administradores da Universidade' }, { value: 'todos', label: 'Todos os utilizadores' }];
const temPerfil = (u, p) => Array.isArray(u.perfis) && u.perfis.includes(p);
const passaPerfil = (u, f) => f === 'todos' ? true : f === 'universidade' ? (Array.isArray(u.perfis) && u.perfis.some(ehPerfilUniversidade)) : temPerfil(u, f);
// rótulo de um perfil (os próprios da Universidade primeiro: PERFIL_UC_LABEL inclui-os depois de carregados)
const rotuloPerfil = (p) => PERFIL_UC_LABEL[p] || PERFIL_LABEL[p] || p;
const corPerfil = (p) => perfisPersonalizadosUc().find(x => x.perfil === p)?.cor || null;
function ChipPerfil({ perfil }) {
  const cor = corPerfil(perfil);
  return <span className="mr-1 inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">{cor && <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: cor }} aria-hidden="true" />}{rotuloPerfil(perfil)}</span>;
}
// Escolha de um perfil próprio num convite/aprovação. Os de nível instrutor, como o instrutor, só um administrador os dá.
function EscolhaPerfilProprio({ admin, proprio, setProprio, formando, setFormando, id }) {
  const opcoes = perfisPersonalizadosUc().filter(p => admin || p.nivel !== 'instrutor');
  if (!opcoes.length) return null;
  return (
    <div className="space-y-1.5 rounded-lg border p-3 dark:border-slate-800">
      <Label htmlFor={id}>Perfil próprio (opcional)</Label>
      <Select id={id} value={proprio} onValueChange={setProprio} searchable={false} options={[{ value: '', label: '— nenhum —' }, ...opcoes.map(p => ({ value: p.perfil, label: `${p.label} · nível ${p.nivel}` }))]} />
      {proprio && <label className="flex items-center gap-2 text-sm"><Checkbox checked={formando} onCheckedChange={v => setFormando(!!v)} />Também Formando (soma as páginas do formando às do perfil)</label>}
    </div>
  );
}
const fmt = (iso) => (iso ? new Date(iso).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const fmtD = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-PT') : '—');
const Badge = ({ cor, children }) => <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold', CORES_BADGE[cor] || CORES_BADGE.slate)}>{children}</span>;

async function copiar(texto) { try { await navigator.clipboard.writeText(texto); return true; } catch { try { const ta = document.createElement('textarea'); ta.value = texto; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); return true; } catch { return false; } } }

// Resultado de um convite: estado do envio + link para copiar (indispensável para emails externos).
function ResultadoConvite({ r, onFechar }) {
  const { toast } = useToast();
  if (!r) return null;
  const enviado = r.envio?.enviado;
  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="flex items-center gap-2">{enviado ? <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" /> : <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden="true" />}{enviado ? 'Convite enviado' : 'Convite criado — email não enviado'}</DialogTitle>
          <DialogDescription>{enviado ? `${r.convite?.email} recebeu um email com o link para criar a senha.` : `Motivo: ${r.envio?.motivo || 'desconhecido'}. Entregue o link abaixo por outro meio (Teams, WhatsApp…).`}</DialogDescription></DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="link-convite">Link do convite (válido até {fmtD(r.convite?.expira_em)})</Label>
          <div className="flex gap-2"><Input id="link-convite" readOnly value={r.link || ''} onFocus={e => e.target.select()} className="font-mono text-xs" /><Button variant="outline" onClick={async () => toast({ title: (await copiar(r.link)) ? 'Link copiado' : 'Copie manualmente o link' })}><Copy className="h-4 w-4" aria-hidden="true" />Copiar</Button></div>
          <p className="text-xs text-slate-500">{r.conta_nova ? 'Foi criada uma conta nova.' : 'A conta já existia; o perfil foi actualizado.'} O link é de uso único e só funciona uma vez.</p>
        </div>
        <DialogFooter><Button onClick={onFechar}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DialogAprovar({ pedido, admin, cursosById = {}, onFechar, onFeito }) {
  const { toast } = useToast();
  const [instrutor, setInstrutor] = useState(false); const [mensagem, setMensagem] = useState(''); const [busy, setBusy] = useState(false);
  const [proprio, setProprio] = useState(''); const [formando, setFormando] = useState(true);
  const interesse = (pedido.cursos_interesse || []).map(id => cursosById[id]).filter(Boolean);
  const [inscrever, setInscrever] = useState(true);
  const submeter = async () => {
    setBusy(true);
    try { const r = await univAcesso('aprovar', { pedido_id: pedido.id, perfis: perfisEscolhidosUc({ formando, instrutor, proprio }), mensagem, inscrever: inscrever && interesse.length > 0 }); onFeito(r); }
    catch (e) { toast({ title: 'Não foi possível aprovar', description: e.message, variant: 'destructive' }); } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Aprovar pedido de {pedido.nome}</DialogTitle><DialogDescription>Cria a conta ({pedido.email}) e envia o convite para definir a senha.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-950"><p><strong>Empresa:</strong> {pedido.empresa || '—'} · <strong>Departamento:</strong> {pedido.departamento || '—'} · <strong>Função:</strong> {pedido.funcao || '—'}</p><p><strong>Aeroporto:</strong> {pedido.aeroporto || '—'} · <strong>Telefone:</strong> {pedido.telefone || '—'} · <strong>Responsável:</strong> {pedido.chefia || '—'}</p>{pedido.motivo && <p className="mt-1 text-slate-600 dark:text-slate-300">«{pedido.motivo}»</p>}</div>
          {interesse.length > 0 && <label className="flex items-start gap-2 rounded-lg border p-3 text-sm dark:border-slate-800"><Checkbox checked={inscrever} onCheckedChange={v => setInscrever(!!v)} className="mt-0.5" /><span><span className="block font-medium">Inscrever já nos cursos de interesse ({interesse.length})</span><span className="text-xs text-slate-500">{interesse.map(c => c.titulo).join(' · ')}</span></span></label>}
          <div className="space-y-2"><p className="text-sm font-medium">Perfil</p>{!proprio && <label className="flex items-center gap-2 text-sm"><Checkbox checked disabled />Formando — acesso à Universidade</label>}{admin && <label className="flex items-center gap-2 text-sm"><Checkbox checked={instrutor} onCheckedChange={v => setInstrutor(!!v)} />Instrutor — também gere cursos e alunos</label>}<EscolhaPerfilProprio id="ap-proprio" admin={admin} proprio={proprio} setProprio={setProprio} formando={formando} setFormando={setFormando} /></div>
          <div className="space-y-1.5"><Label htmlFor="ap-msg">Mensagem no email (opcional)</Label><Textarea id="ap-msg" value={mensagem} onChange={e => setMensagem(e.target.value)} rows={2} maxLength={500} placeholder="ex.: Comece pelo curso de Condução no Lado Ar." /></div>
          {!emailInterno(pedido.email) && <p className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />Email externo: o relay da SGA não entrega. Vai receber o link para copiar e enviar por outro meio.</p>}
        </div>
        <DialogFooter><Button variant="outline" onClick={onFechar}>Cancelar</Button><Button onClick={submeter} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <UserCheck className="h-4 w-4" aria-hidden="true" />}Aprovar e convidar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
function DialogRejeitar({ pedido, onFechar, onFeito }) {
  const { toast } = useToast();
  const [motivo, setMotivo] = useState(''); const [avisar, setAvisar] = useState(true); const [busy, setBusy] = useState(false);
  const submeter = async () => {
    setBusy(true);
    try { await univAcesso('rejeitar', { pedido_id: pedido.id, motivo, avisar }); onFeito(); }
    catch (e) { toast({ title: 'Não foi possível rejeitar', description: e.message, variant: 'destructive' }); } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Rejeitar pedido de {pedido.nome}</DialogTitle><DialogDescription>{pedido.email}</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label htmlFor="rj-motivo">Motivo (opcional, vai no email)</Label><Textarea id="rj-motivo" value={motivo} onChange={e => setMotivo(e.target.value)} rows={3} maxLength={500} /></div>
          <label className="flex items-center gap-2 text-sm"><Switch checked={avisar} onCheckedChange={setAvisar} />Avisar o requerente por email{!emailInterno(pedido.email) ? ' (email externo: não será entregue)' : ''}</label>
        </div>
        <DialogFooter><Button variant="outline" onClick={onFechar}>Cancelar</Button><Button variant="destructive" onClick={submeter} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <UserX className="h-4 w-4" aria-hidden="true" />}Rejeitar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
function DialogConvidar({ admin, onFechar, onFeito }) {
  const { toast } = useToast();
  const [f, setF] = useState({ nome: '', email: '', telefone: '', mensagem: '', instrutor: false, enviar: true, proprio: '', formando: true }); const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF(v => ({ ...v, [k]: e.target.value }));
  const submeter = async () => {
    if (!emailValido(f.email)) { toast({ title: 'Email inválido', variant: 'destructive' }); return; }
    setBusy(true);
    try { const r = await univAcesso('convidar', { nome: f.nome, email: f.email, telefone: f.telefone, mensagem: f.mensagem, perfis: perfisEscolhidosUc({ formando: f.formando, instrutor: f.instrutor, proprio: f.proprio }), enviar: f.enviar }); onFeito(r); }
    catch (e) { toast({ title: 'Não foi possível convidar', description: e.message, variant: 'destructive' }); } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Convidar para a Universidade</DialogTitle><DialogDescription>Cria a conta (se não existir) e envia o link para criar a senha. Quem já tem conta entra com as credenciais que tem.</DialogDescription></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="cv-nome">Nome completo</Label><Input id="cv-nome" value={f.nome} onChange={set('nome')} autoComplete="off" /></div>
          <div className="space-y-1.5"><Label htmlFor="cv-email">Email *</Label><Input id="cv-email" type="email" value={f.email} onChange={set('email')} autoComplete="off" placeholder="nome@sga.co.ao" /></div>
          <div className="space-y-1.5"><Label htmlFor="cv-tel">Telefone</Label><Input id="cv-tel" value={f.telefone} onChange={set('telefone')} autoComplete="off" /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="cv-msg">Mensagem no email (opcional)</Label><Textarea id="cv-msg" value={f.mensagem} onChange={set('mensagem')} rows={2} maxLength={500} /></div>
          <div className="space-y-2 sm:col-span-2">{!f.proprio && <label className="flex items-center gap-2 text-sm"><Checkbox checked disabled />Formando — acesso à Universidade</label>}{admin && <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.instrutor} onCheckedChange={v => setF(x => ({ ...x, instrutor: !!v }))} />Instrutor — também gere cursos e alunos</label>}<EscolhaPerfilProprio id="cv-proprio" admin={admin} proprio={f.proprio} setProprio={v => setF(x => ({ ...x, proprio: v }))} formando={f.formando} setFormando={v => setF(x => ({ ...x, formando: v }))} /><label className="flex items-center gap-2 text-sm"><Switch checked={f.enviar} onCheckedChange={v => setF(x => ({ ...x, enviar: v }))} />Enviar o convite por email agora</label></div>
          {f.email && !emailInterno(f.email) && <p className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300 sm:col-span-2"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />Email externo: o relay da SGA não entrega. Vai receber o link para copiar e enviar por outro meio.</p>}
        </div>
        <DialogFooter><Button variant="outline" onClick={onFechar}>Cancelar</Button><Button onClick={submeter} disabled={busy || !f.email}>{busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <UserPlus className="h-4 w-4" aria-hidden="true" />}Convidar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Perfis da Universidade de um utilizador existente (administradores): Formando, Instrutor e Administrador da Universidade.
function DialogPerfis({ u, actor, onFechar, onFeito }) {
  const { toast } = useToast();
  const perfis = Array.isArray(u.perfis) ? u.perfis : [];
  const [formando, setFormando] = useState(perfis.includes('formando'));
  const [instrutor, setInstrutor] = useState(perfis.includes('instrutor'));
  const [adminUc, setAdminUc] = useState(perfis.includes('admin_universidade'));
  const disponiveis = perfisPersonalizadosUc();
  const [proprios, setProprios] = useState(() => perfis.filter(p => disponiveis.some(d => d.perfil === p)));
  const alternarProprio = (p, v) => setProprios(l => (v ? [...new Set([...l, p])] : l.filter(x => x !== p)));
  const [busy, setBusy] = useState(false);
  const global = contaGlobal(u); // conta global (acesso total): perfis não editáveis no portal
  const submeter = async () => {
    setBusy(true);
    try { await guardarPerfisUniversidade(u, { formando, instrutor, admin: adminUc, personalizados: proprios }, actor); toast({ title: 'Perfis actualizados', description: `${u.full_name || u.email}: ${[formando && 'formando', instrutor && 'instrutor', adminUc && 'administrador da Universidade', ...proprios.map(rotuloPerfil)].filter(Boolean).join(' + ') || 'sem perfis da Universidade'}.` }); onFeito(); }
    catch (e) { toast({ title: 'Não foi possível guardar', description: e?.message, variant: 'destructive' }); } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent>
        <DialogHeader><DialogTitle className="flex items-center gap-2"><UserCog className="h-5 w-5 text-violet-600" aria-hidden="true" />Perfis de {u.full_name || u.email}</DialogTitle><DialogDescription>{u.email}</DialogDescription></DialogHeader>
        <div className="space-y-3">
          {global && <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />Conta global (acesso total): os perfis não se alteram no portal.</p>}
          <label className="flex items-start gap-3 rounded-lg border p-3 text-sm dark:border-slate-800"><Checkbox disabled={global} checked={formando} onCheckedChange={v => setFormando(!!v)} className="mt-0.5" /><span><span className="block font-medium">Formando</span><span className="text-xs text-slate-500">Acesso à Universidade como aluno (cursos, sessões, certificados). Todas as contas activas entram como alunos.</span></span></label>
          <label className="flex items-start gap-3 rounded-lg border p-3 text-sm dark:border-slate-800"><Checkbox disabled={global} checked={instrutor} onCheckedChange={v => setInstrutor(!!v)} className="mt-0.5" /><span><span className="block font-medium">Instrutor</span><span className="text-xs text-slate-500">Gere cursos, alunos, sessões, acessos e relatórios; os cursos ficam ligados ao instrutor responsável.</span></span></label>
          <label className="flex items-start gap-3 rounded-lg border border-violet-200 bg-violet-50/40 p-3 text-sm dark:border-violet-900 dark:bg-violet-950/20"><Checkbox disabled={global} checked={adminUc} onCheckedChange={v => setAdminUc(!!v)} className="mt-0.5" /><span><span className="block font-medium">Administrador da Universidade</span><span className="text-xs text-slate-500 dark:text-slate-400">Gere tudo no portal: acessos, perfis, páginas por perfil, configurações, avisos, auditoria e relatórios.</span></span></label>
          {disponiveis.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Perfis próprios</legend>
              {disponiveis.map(p => (
                <label key={p.perfil} className="flex items-start gap-3 rounded-lg border p-3 text-sm dark:border-slate-800">
                  <Checkbox disabled={global} checked={proprios.includes(p.perfil)} onCheckedChange={v => alternarProprio(p.perfil, !!v)} className="mt-0.5" />
                  <span><span className="flex items-center gap-1.5 font-medium">{p.cor && <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.cor }} aria-hidden="true" />}{p.label}<span className="rounded border px-1 text-[11px] font-normal text-slate-500 dark:border-slate-700">nível {p.nivel}</span></span>{p.descricao && <span className="text-xs text-slate-500">{p.descricao}</span>}</span>
                </label>
              ))}
              <p className="text-xs text-slate-500">Quem só tem perfis próprios (sem Formando nem Instrutor) vê apenas as páginas desses perfis.</p>
            </fieldset>
          )}
        </div>
        <DialogFooter><Button variant="outline" onClick={onFechar}>Cancelar</Button><Button onClick={submeter} disabled={busy || global}>{busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <UserCog className="h-4 w-4" aria-hidden="true" />}Guardar perfis</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Editar dados básicos de um utilizador (administradores).
function DialogEditarUtilizador({ u, actor, onFechar, onFeito }) {
  const { toast } = useToast();
  const [nome, setNome] = useState(u.full_name || '');
  const [telefone, setTelefone] = useState(u.telefone || '');
  const { data: aeroportosUc = [] } = useAeroportosUc();
  const { data: fUc } = useFormandoUc(u.email);
  const [aero, setAero] = useState(''); const [dep, setDep] = useState(''); const [fun, setFun] = useState('');
  useEffect(() => { if (fUc) { setAero(fUc.aeroporto || ''); setDep(fUc.departamento || ''); setFun(fUc.funcao || ''); } }, [fUc]);
  const [busy, setBusy] = useState(false);
  const submeter = async () => {
    if (!nome.trim()) { toast({ title: 'Indique o nome', variant: 'destructive' }); return; }
    setBusy(true);
    try { await editarUtilizadorPortal(u, { full_name: nome, telefone, aeroporto: aero, departamento: dep, funcao: fun }, actor); toast({ title: 'Utilizador actualizado' }); onFeito(); }
    catch (e) { toast({ title: 'Não foi possível guardar', description: e?.message, variant: 'destructive' }); } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent>
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Pencil className="h-5 w-5 text-violet-600" aria-hidden="true" />Editar utilizador</DialogTitle><DialogDescription>{u.email}</DialogDescription></DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1.5"><Label htmlFor="ed-nome">Nome completo</Label><Input id="ed-nome" value={nome} onChange={e => setNome(e.target.value)} autoComplete="off" /></div>
          <div className="space-y-1.5"><Label htmlFor="ed-tel">Telefone</Label><Input id="ed-tel" value={telefone} onChange={e => setTelefone(e.target.value)} autoComplete="off" /></div>
          <div className="space-y-1.5"><Label>Aeroporto</Label><Select value={aero} onValueChange={setAero} placeholder="—" options={[{ value: '', label: '— sem aeroporto —' }, ...aeroportosUc.map(a => ({ value: a.codigo, label: `${a.codigo} · ${a.nome}` }))]} /><p className="text-xs text-slate-500">Usado nos relatórios por aeroporto.</p></div>
          <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="ed-dep">Departamento</Label><Input id="ed-dep" value={dep} onChange={e => setDep(e.target.value)} autoComplete="off" /></div><div className="space-y-1.5"><Label htmlFor="ed-fun">Função</Label><Input id="ed-fun" value={fun} onChange={e => setFun(e.target.value)} autoComplete="off" /></div></div>
          <div className="space-y-1.5"><Label htmlFor="ed-email">Email</Label><Input id="ed-email" value={u.email} readOnly className="bg-slate-50 dark:bg-slate-950" /><p className="text-xs text-slate-500">O email não se altera aqui (peça ao suporte técnico). Os perfis mudam-se no botão «Perfis».</p></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onFechar} disabled={busy}>Cancelar</Button><Button onClick={submeter} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Pencil className="h-4 w-4" aria-hidden="true" />}Guardar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Criar ou editar um perfil próprio (migração 188). O nome técnico (uc_…) nasce do nome e não muda depois.
function DialogPerfilProprio({ existente, actor, onFechar, onFeito }) {
  const { toast } = useToast();
  const [label, setLabel] = useState(existente?.label || '');
  const [descricao, setDescricao] = useState(existente?.descricao || '');
  const [cor, setCor] = useState(existente?.cor || CORES_PERFIL_UC[0]);
  const [nivel, setNivel] = useState(existente?.nivel || 'formando');
  const [busy, setBusy] = useState(false);
  const chave = existente?.chave || slugPerfilUc(label);
  const repetido = !existente && (PERFIS_PORTAL.some(p => p.chave === chave) || PERFIS_UNIVERSIDADE.includes(chave));
  const guardar = async () => {
    setBusy(true);
    try {
      await guardarPerfilPersonalizadoUc({ perfil: chave, label, cor, descricao, nivel, paginas: existente ? undefined : [...paginasPadraoUc(nivel)] }, actor);
      await auditarPortal(actor, { acao: existente ? 'perfil_alterado' : 'perfil_criado', entidade: 'universidade_permissao', id: chave, detalhes: `Perfil próprio «${label.trim()}» (${chave}), nível ${nivel}`, dados: { perfil: chave, label: label.trim(), nivel, cor, descricao: descricao.trim() || null, antes: existente || null } });
      toast({ title: existente ? 'Perfil actualizado' : 'Perfil criado', description: existente ? undefined : 'Começa com as páginas do nível base; ajuste-as na matriz e guarde. Atribua-o às pessoas em «Utilizadores › Perfis» ou num convite.' });
      onFeito();
    } catch (e) {
      toast({ title: 'Não foi possível guardar o perfil', description: e?.message || String(e), variant: 'destructive' });
    } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-h-[92vh] w-full max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-violet-600" aria-hidden="true" />{existente ? `Editar «${existente.label}»` : 'Novo perfil'}</DialogTitle>
          <DialogDescription>Um perfil próprio tem, nos dados, os poderes de um nível base e escolhe as páginas que a pessoa vê no portal.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ucp-nome">Nome *</Label>
            <Input id="ucp-nome" value={label} onChange={e => setLabel(e.target.value)} maxLength={60} placeholder="ex.: Coordenador de formação do aeroporto" autoComplete="off" />
            {!existente && label.trim() && <p className={cn('text-xs', repetido ? 'text-red-600 dark:text-red-400' : 'text-slate-500')}>{repetido ? 'Já existe um perfil com este nome.' : <>Nome técnico: <span className="font-mono">{chave}</span></>}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ucp-desc">Descrição</Label>
            <Textarea id="ucp-desc" value={descricao} onChange={e => setDescricao(e.target.value)} rows={2} maxLength={200} placeholder="ex.: Acompanha os formandos do seu aeroporto e as sessões presenciais" />
          </div>
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">Nível base (o que pode fazer nos dados) *</legend>
            {NIVEIS_PERFIL_UC.map(n => (
              <label key={n.chave} className={cn('flex cursor-pointer items-start gap-3 rounded-lg border p-2.5 text-sm dark:border-slate-800', nivel === n.chave && 'border-violet-600 ring-1 ring-violet-600 dark:border-violet-500')}>
                <input type="radio" name="ucp-nivel" className="mt-1" checked={nivel === n.chave} onChange={() => setNivel(n.chave)} />
                <span><span className="block font-medium">{n.label}</span><span className="text-xs text-slate-500">{n.descricao}</span></span>
              </label>
            ))}
            {existente && existente.nivel !== nivel && <p className="text-xs text-amber-700 dark:text-amber-300">Mudar o nível muda já o que as pessoas com este perfil podem fazer nos dados.</p>}
            <p className="text-xs text-slate-500">Administração não é nível de perfis próprios: para administrar a Universidade dê o perfil Administrador da Universidade.</p>
          </fieldset>
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">Cor</legend>
            <div className="flex flex-wrap gap-2">
              {CORES_PERFIL_UC.map(c => (
                <button key={c} type="button" onClick={() => setCor(c)} aria-pressed={cor === c} aria-label={`Cor ${c}`}
                  className={cn('h-8 w-8 rounded-full border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600', cor === c ? 'border-slate-900 dark:border-white' : 'border-transparent')}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </fieldset>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onFechar} disabled={busy}>Cancelar</Button>
          <Button onClick={guardar} disabled={busy || !label.trim() || repetido || chave.length < 5}>{busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}{existente ? 'Guardar' : 'Criar perfil'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Matriz perfis × páginas do portal (administradores editam; instrutores vêem) + perfis próprios (criar, editar, apagar).
function PerfisPaginas({ admin, actor, utilizadores = [] }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: permissoes, isLoading } = usePermissoesPortal();
  const [edicao, setEdicao] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dialogo, setDialogo] = useState(null);      // { existente? }
  const [apagar, setApagar] = useState(null);
  // colunas editáveis: formando, instrutor e os perfis próprios (o administrador vê tudo e não se configura)
  const editaveis = PERFIS_PORTAL.filter(p => p.chave !== 'administrador');
  const base = useMemo(() => Object.fromEntries(editaveis.map(p => [p.chave, permissoes?.[p.chave] || paginasPadraoUc(p.chave)])), [permissoes, editaveis.map(p => p.chave).join(',')]);
  const atual = edicao || base;
  const alterado = JSON.stringify(atual) !== JSON.stringify(base);
  const tem = (perfil, chave) => perfil === 'administrador' ? true : (atual[perfil] || []).includes(chave);
  const alternar = (perfil, chave) => setEdicao(e => { const x = { ...(e || base) }; const lista = new Set(x[perfil] || []); if (lista.has(chave)) lista.delete(chave); else lista.add(chave); x[perfil] = PAGINAS_PORTAL.map(p => p.chave).filter(k => lista.has(k)); return x; });
  const recarregar = () => qc.invalidateQueries({ queryKey: ['universidade_permissao'] });
  const guardar = async () => {
    setBusy(true);
    try {
      for (const p of editaveis) await guardarPermissoesPortal(p.chave, atual[p.chave] || [], actor);
      await auditarPortal(actor, { acao: 'permissoes_alteradas', entidade: 'universidade_permissao', detalhes: 'Páginas por perfil do portal alteradas', dados: { depois: atual } });
      await recarregar(); setEdicao(null);
      toast({ title: 'Permissões guardadas', description: 'Aplicam-se de imediato ao menu e às páginas de cada perfil.' });
    } catch (e) { toast({ title: 'Não foi possível guardar', description: e?.message, variant: 'destructive' }); } finally { setBusy(false); }
  };
  const repor = () => setEdicao(Object.fromEntries(editaveis.map(p => [p.chave, [...paginasPadraoUc(p.chave)]])));
  const removerPerfil = async (p) => {
    const n = contarComPerfil(utilizadores, p.chave);
    try {
      await apagarPerfilPersonalizadoUc(p.chave);
      await auditarPortal(actor, { acao: 'perfil_apagado', entidade: 'universidade_permissao', id: p.chave, detalhes: `Perfil próprio «${p.label}» (${p.chave}) apagado${n ? ` — retirado a ${n} pessoa(s)` : ''}`, dados: { perfil: p.chave, label: p.label, nivel: p.nivel, pessoas: n } });
      setEdicao(null); await recarregar(); qc.invalidateQueries({ queryKey: ['universidade_acessos'] });
      toast({ title: 'Perfil apagado', description: n ? `Retirado a ${n} pessoa(s); quem não tinha outro perfil da Universidade ficou Formando.` : undefined });
    } catch (e) {
      toast({ title: 'Não foi possível apagar', description: e?.message || String(e), variant: 'destructive' });
    } finally { setApagar(null); }
  };
  if (isLoading) return <Skeleton className="h-64 w-full" />;
  const grupos = ['Formando', 'Gestão'];
  const nApagar = apagar ? contarComPerfil(utilizadores, apagar.chave) : 0;
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
        <p><strong>Como funciona.</strong> Todos os utilizadores activos contam como <strong>Formando</strong> no portal. <strong>Instrutor</strong> soma as suas páginas às do formando. Os <strong>perfis próprios</strong> têm o nível base que escolher (formando ou instrutor) e as páginas da sua coluna; quem só tem perfis próprios vê apenas as páginas desses perfis. <strong>Administrador da Universidade</strong> vê tudo e não se configura. As páginas Início e A minha conta estão sempre disponíveis.</p>
        <p className="mt-1 text-xs text-blue-800/80 dark:text-blue-200/80">Os dados continuam protegidos pelas regras da base de dados: um instrutor sem a página «Configurações» não a abre; um formando (ou perfil de nível formando) nunca vê dados de gestão, mesmo que a página lhe seja dada.</p>
      </div>
      <Card className="dark:border-slate-800 dark:bg-slate-900"><CardContent className="p-0"><div className="overflow-x-auto"><Table>
        <TableHeader><TableRow><TableHead>Página</TableHead>{PERFIS_PORTAL.map(p => (
          <TableHead key={p.chave} className="w-36 text-center align-top">
            <span className="flex items-center justify-center gap-1.5">{p.personalizado && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.cor || '#475569' }} aria-hidden="true" />}{p.label}</span>
            <span className="block text-[11px] font-normal text-slate-400">{p.descricao}</span>
            {p.personalizado && (
              <span className="mt-1 flex items-center justify-center gap-1">
                <span className="rounded border px-1 text-[11px] font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300">nível {p.nivel}</span>
                {admin && <>
                  <button type="button" onClick={() => setDialogo({ existente: p })} disabled={alterado} className="rounded p-1 text-slate-500 hover:text-slate-900 disabled:opacity-40 dark:hover:text-white" aria-label={`Editar o perfil ${p.label}`} title={alterado ? 'Guarde primeiro as alterações à matriz' : 'Editar'}><Pencil className="h-3.5 w-3.5" aria-hidden="true" /></button>
                  <button type="button" onClick={() => setApagar(p)} disabled={alterado} className="rounded p-1 text-red-600 hover:text-red-800 disabled:opacity-40 dark:text-red-400" aria-label={`Apagar o perfil ${p.label}`} title={alterado ? 'Guarde primeiro as alterações à matriz' : 'Apagar'}><Trash2 className="h-3.5 w-3.5" aria-hidden="true" /></button>
                </>}
              </span>
            )}
          </TableHead>
        ))}</TableRow></TableHeader>
        <TableBody>{grupos.map(g => (<React.Fragment key={g}>
          <TableRow className="bg-slate-50 dark:bg-slate-800/60"><TableCell colSpan={1 + PERFIS_PORTAL.length} className="py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{g === 'Formando' ? 'Páginas do formando' : 'Páginas de gestão'}</TableCell></TableRow>
          {PAGINAS_PORTAL.filter(p => p.grupo === g).map(p => (
            <TableRow key={p.chave}>
              <TableCell><p className="font-medium text-slate-900 dark:text-slate-100">{p.label}</p><p className="text-xs text-slate-500">{p.descricao}</p></TableCell>
              {PERFIS_PORTAL.map(pf => <TableCell key={pf.chave} className="text-center"><Checkbox checked={tem(pf.chave, p.chave)} disabled={!admin || pf.chave === 'administrador' || (nivelDoPerfilUc(pf.chave) === 'formando' && p.grupo === 'Gestão')} onCheckedChange={() => alternar(pf.chave, p.chave)} aria-label={`${p.label} — ${pf.label}`} /></TableCell>)}
            </TableRow>
          ))}
        </React.Fragment>))}</TableBody>
      </Table></div></CardContent></Card>
      {admin ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={guardar} disabled={busy || !alterado}>{busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}Guardar permissões</Button>
          <Button variant="outline" onClick={repor} disabled={busy}>Repor predefinições</Button>
          <Button variant="outline" onClick={() => setDialogo({})} disabled={busy || alterado} title={alterado ? 'Guarde primeiro as alterações à matriz' : undefined}><Plus className="h-4 w-4" aria-hidden="true" />Novo perfil</Button>
          {alterado && <span className="text-xs text-amber-700 dark:text-amber-300">Alterações por guardar.</span>}
        </div>
      ) : <p className="text-xs text-slate-500">Só administradores alteram as permissões e os perfis próprios.</p>}
      {dialogo && <DialogPerfilProprio existente={dialogo.existente} actor={actor} onFechar={() => setDialogo(null)} onFeito={() => { setDialogo(null); setEdicao(null); recarregar(); }} />}
      {apagar && (
        <ConfirmModal isOpen onClose={() => setApagar(null)} onConfirm={() => removerPerfil(apagar)} title={`Apagar o perfil «${apagar.label}»?`} confirmText="Apagar perfil" variant="destructive"
          message={nApagar > 0
            ? `${nApagar} pessoa(s) têm este perfil. Ao apagar, o perfil é-lhes retirado (e aos convites por aceitar); quem não tiver outro perfil da Universidade passa a Formando. Não se pode desfazer.`
            : 'Ninguém tem este perfil. Convites por aceitar com este perfil passam a Formando. Não se pode desfazer.'} />
      )}
    </div>
  );
}

export default function PortalAcessos() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const tab = ['pedidos', 'convites', 'utilizadores', 'perfis'].includes(params.get('tab')) ? params.get('tab') : 'pedidos';
  const { data, isLoading, isError, error } = useAcessos();
  usePermissoesPortal(); // os perfis próprios só se conhecem quando universidade_permissao carrega (rótulos, filtros, diálogos)
  const filtrosPerfil = [...PERFIS_FILTRO.slice(0, -1), ...perfisPersonalizadosUc().map(p => ({ value: p.perfil, label: `Perfil: ${p.label}` })), PERFIS_FILTRO[PERFIS_FILTRO.length - 1]];
  const { data: cursosLista = [] } = useTodosCursos();
  const cursosById = useMemo(() => Object.fromEntries(cursosLista.map(c => [c.id, c])), [cursosLista]);
  const [busca, setBusca] = useState('');
  const [soPendentes, setSoPendentes] = useState(true);
  const [soActivos, setSoActivos] = useState(true);
  const [perfilFiltro, setPerfilFiltro] = useState('universidade');
  const [aprovar, setAprovar] = useState(null); const [rejeitar, setRejeitar] = useState(null); const [convidar, setConvidar] = useState(false);
  const [resultado, setResultado] = useState(null); const [confirmar, setConfirmar] = useState(null); const [busy, setBusy] = useState(null);
  const [perfisDe, setPerfisDe] = useState(null);
  const [editarDe, setEditarDe] = useState(null);
  const excluir = async (u) => {
    setBusy(u.id);
    try { const r = await excluirUtilizadorPortal(u, user); toast({ title: 'Utilizador excluído', description: `${u.email} deixou de ter conta na Universidade.` }); refrescar(); }
    catch (e) { toast({ title: 'Não foi possível excluir', description: e?.message, variant: 'destructive' }); } finally { setBusy(null); }
  };
  const admin = perfisPortal(user).admin; // administrador da Universidade (perfil admin_universidade)
  const degradado = !!data?.degradado;
  const refrescar = () => qc.invalidateQueries({ queryKey: ['universidade_acessos'] });
  const q = busca.trim().toLowerCase();
  const filtra = (campos) => !q || campos.some(v => String(v || '').toLowerCase().includes(q));
  const pedidos = useMemo(() => (data?.pedidos || []).filter(p => (!soPendentes || p.estado === 'pendente') && filtra([p.nome, p.email, p.funcao, p.aeroporto])), [data, soPendentes, q]);
  const convites = useMemo(() => (data?.convites || []).filter(c => filtra([c.nome, c.email, c.criado_por])), [data, q]);
  const utilizadores = useMemo(() => (data?.utilizadores || []).filter(u => (!soActivos || u.status === 'ativo') && passaPerfil(u, perfilFiltro) && filtra([u.full_name, u.email, ...(u.perfis || [])])), [data, soActivos, perfilFiltro, q]);
  const resumo = data ? resumoAcessos(data) : null;

  const accao = async (nome, body, ok) => {
    setBusy(body.convite_id || body.user_id || nome);
    try { const r = await univAcesso(nome, body); toast({ title: ok }); refrescar(); return r; }
    catch (e) { toast({ title: 'Não foi possível concluir', description: e.message, variant: 'destructive' }); return null; } finally { setBusy(null); }
  };
  const reenviar = async (c) => { const r = await accao('reenviar', { convite_id: c.id }, 'Convite reenviado'); if (r) setResultado(r); };

  return (
    <PaginaGestao titulo="Acessos à Universidade" descricao="Aprove pedidos, envie convites e gira quem tem acesso ao portal." accoes={<Button onClick={() => setConvidar(true)}><UserPlus className="h-4 w-4" aria-hidden="true" />Convidar</Button>}>
      {degradado && <div role="status" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><span>Modo limitado: o serviço de acessos ainda não está activo no servidor (reiniciar dirops-functions-v2). Pode ver as listas e alterar perfis; aprovar, convidar, revogar e reenviar ficam disponíveis depois do reinício.</span></div>}
      {isError && <div role="alert" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><span>{error?.message}</span></div>}
      {resumo && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[{ l: 'Pedidos pendentes', v: resumo.pendentes, i: Clock, c: resumo.pendentes ? 'text-amber-600' : '' }, { l: 'Convites por aceitar', v: resumo.porAceitar, i: Mail }, { l: 'Utilizadores activos', v: resumo.ativos, i: UserCheck }, { l: 'Sem login há 30 dias', v: resumo.semLogin30d, i: Ban }].map(k => (
            <Card key={k.l} className="dark:border-slate-800 dark:bg-slate-900"><CardContent className="p-3"><div className="flex items-center justify-between"><p className="text-xs text-slate-500">{k.l}</p><k.i className="h-4 w-4 text-slate-400" aria-hidden="true" /></div><p className={cn('mt-1 text-2xl font-bold tabular-nums', k.c)}>{k.v}</p></CardContent></Card>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[16rem] flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" /><Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Procurar por nome, email, função…" className="pl-9" aria-label="Procurar" /></div>
        <Button variant="outline" size="sm" onClick={refrescar}><RefreshCw className="h-4 w-4" aria-hidden="true" />Actualizar</Button>
      </div>

      <Tabs value={tab} onValueChange={(t) => setParams({ tab: t }, { replace: true })}>
        <TabsList className="h-auto w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="pedidos" className="gap-1.5 py-1.5">Pedidos{resumo?.pendentes ? <span className="rounded-full bg-amber-500 px-1.5 text-[11px] font-semibold text-white">{resumo.pendentes}</span> : null}</TabsTrigger>
          <TabsTrigger value="convites" className="gap-1.5 py-1.5">Convites</TabsTrigger>
          <TabsTrigger value="utilizadores" className="gap-1.5 py-1.5">Utilizadores</TabsTrigger>
          <TabsTrigger value="perfis" className="gap-1.5 py-1.5"><ShieldCheck className="h-4 w-4" aria-hidden="true" />Perfis e páginas</TabsTrigger>
        </TabsList>

        <TabsContent value="pedidos" className="mt-4 space-y-3">
          <label className="flex items-center gap-2 text-sm"><Switch checked={soPendentes} onCheckedChange={setSoPendentes} />Só pendentes</label>
          <Card className="dark:border-slate-800 dark:bg-slate-900"><CardContent className="p-0">
            {isLoading ? <div className="space-y-2 p-4"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div> : pedidos.length === 0 ? <p className="p-5 text-sm text-slate-500">{soPendentes ? 'Não há pedidos pendentes.' : 'Sem pedidos.'}</p> : (
              <div className="overflow-x-auto"><Table>
                <TableHeader><TableRow><TableHead>Requerente</TableHead><TableHead>Entidade / função / cursos</TableHead><TableHead>Pedido</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Acções</TableHead></TableRow></TableHeader>
                <TableBody>{pedidos.map(p => { const e = ESTADO_PEDIDO[p.estado] || ESTADO_PEDIDO.pendente; return (
                  <TableRow key={p.id}>
                    <TableCell><p className="font-medium text-slate-900 dark:text-slate-100">{p.nome}</p><p className="text-xs text-slate-500">{p.email}{p.telefone ? ` · ${p.telefone}` : ''}</p>{!emailInterno(p.email) && <p className="text-[11px] text-amber-700 dark:text-amber-300">email externo</p>}</TableCell>
                    <TableCell className="text-sm"><p>{[p.empresa, p.departamento].filter(Boolean).join(' · ') || '—'}</p><p className="text-xs text-slate-500">{[p.funcao, p.aeroporto].filter(Boolean).join(' · ')}</p>{p.chefia && <p className="text-xs text-slate-500">Resp.: {p.chefia}</p>}{(p.cursos_interesse || []).length > 0 && <p className="mt-1 max-w-xs truncate text-xs text-violet-700 dark:text-violet-300" title={(p.cursos_interesse || []).map(id => cursosById[id]?.titulo || id).join(', ')}>Cursos: {(p.cursos_interesse || []).map(id => cursosById[id]?.titulo || '?').join(', ')}</p>}{p.motivo && <p className="mt-1 max-w-xs truncate text-xs text-slate-500" title={p.motivo}>«{p.motivo}»</p>}</TableCell>
                    <TableCell className="text-xs text-slate-500">{fmt(p.created_date)}{p.respondido_em ? <><br />resp. {fmt(p.respondido_em)}<br />{p.respondido_por}</> : null}</TableCell>
                    <TableCell><Badge cor={e.cor}>{e.label}</Badge>{p.motivo_rejeicao && <p className="mt-1 max-w-[12rem] truncate text-xs text-slate-500" title={p.motivo_rejeicao}>{p.motivo_rejeicao}</p>}</TableCell>
                    <TableCell className="text-right">{p.estado === 'pendente' ? <div className="flex justify-end gap-1.5"><Button size="sm" onClick={() => setAprovar(p)}><UserCheck className="h-4 w-4" aria-hidden="true" />Aprovar</Button><Button size="sm" variant="outline" onClick={() => setRejeitar(p)}><UserX className="h-4 w-4" aria-hidden="true" />Rejeitar</Button></div> : <span className="text-xs text-slate-400">—</span>}</TableCell>
                  </TableRow>
                ); })}</TableBody>
              </Table></div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="convites" className="mt-4 space-y-3">
          <Card className="dark:border-slate-800 dark:bg-slate-900"><CardContent className="p-0">
            {isLoading ? <div className="space-y-2 p-4"><Skeleton className="h-8 w-full" /></div> : convites.length === 0 ? <p className="p-5 text-sm text-slate-500">Ainda não foram enviados convites.</p> : (
              <div className="overflow-x-auto"><Table>
                <TableHeader><TableRow><TableHead>Convidado</TableHead><TableHead>Perfis</TableHead><TableHead>Enviado</TableHead><TableHead>Validade</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Acções</TableHead></TableRow></TableHeader>
                <TableBody>{convites.map(c => { const e = estadoConvite(c); const aberto = ['pendente', 'nao_enviado', 'expirado'].includes(e.chave); return (
                  <TableRow key={c.id}>
                    <TableCell><p className="font-medium text-slate-900 dark:text-slate-100">{c.nome || c.email}</p><p className="text-xs text-slate-500">{c.email}</p></TableCell>
                    <TableCell className="text-xs">{(c.perfis || []).map(rotuloPerfil).join(', ')}</TableCell>
                    <TableCell className="text-xs text-slate-500">{c.enviado ? fmt(c.enviado_em) : <span className="text-amber-700 dark:text-amber-300" title={c.motivo_nao_enviado || ''}>não enviado</span>}<br />por {c.criado_por || '—'}{c.reenvios ? ` · ${c.reenvios} reenvio(s)` : ''}</TableCell>
                    <TableCell className="text-xs text-slate-500">{fmtD(c.expira_em)}</TableCell>
                    <TableCell><Badge cor={e.cor}>{e.label}</Badge>{c.aceite_em && <p className="text-[11px] text-slate-500">{fmt(c.aceite_em)}</p>}</TableCell>
                    <TableCell className="text-right">{aberto ? <div className="flex justify-end gap-1.5"><Button size="sm" variant="outline" disabled={busy === c.id} onClick={() => reenviar(c)} title="Gera um link novo e envia (ou dá-o para copiar)">{busy === c.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Link2 className="h-4 w-4" aria-hidden="true" />}Novo link</Button><Button size="sm" variant="ghost" disabled={busy === c.id} onClick={() => setConfirmar({ t: 'Cancelar convite', m: `Cancelar o convite de ${c.email}? O link deixa de funcionar.`, f: () => accao('cancelar_convite', { convite_id: c.id }, 'Convite cancelado') })}>Cancelar</Button></div> : <span className="text-xs text-slate-400">—</span>}</TableCell>
                  </TableRow>
                ); })}</TableBody>
              </Table></div>
            )}
          </CardContent></Card>
          <p className="text-xs text-slate-500">«Novo link» substitui o link anterior (uso único) e reenvia o email quando possível; para emails externos copie o link na janela seguinte.</p>
        </TabsContent>

        <TabsContent value="utilizadores" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-4 text-sm"><div className="w-56"><Select options={filtrosPerfil} value={perfilFiltro} onValueChange={setPerfilFiltro} /></div><label className="flex items-center gap-2"><Switch checked={soActivos} onCheckedChange={setSoActivos} />Só activos</label><span className="text-xs text-slate-500"><Filter className="mr-1 inline h-3 w-3" aria-hidden="true" />{utilizadores.length} utilizador(es)</span></div>
          <Card className="dark:border-slate-800 dark:bg-slate-900"><CardContent className="p-0">
            {isLoading ? <div className="space-y-2 p-4"><Skeleton className="h-8 w-full" /></div> : utilizadores.length === 0 ? <p className="p-5 text-sm text-slate-500">Sem utilizadores.</p> : (
              <div className="overflow-x-auto"><Table>
                <TableHeader><TableRow><TableHead>Utilizador</TableHead><TableHead>Perfis</TableHead><TableHead>Estado</TableHead><TableHead>Último login</TableHead><TableHead>Desde</TableHead>{admin && <TableHead className="text-right">Acções</TableHead>}</TableRow></TableHeader>
                <TableBody>{utilizadores.map(u => { const perfis = u.perfis || []; const eu = String(u.email).toLowerCase() === String(user?.email).toLowerCase(); return (
                  <TableRow key={u.id}>
                    <TableCell><p className="font-medium text-slate-900 dark:text-slate-100">{u.full_name || u.email}</p><p className="text-xs text-slate-500">{u.email}</p></TableCell>
                    <TableCell className="text-xs">{perfis.filter(p => PERFIS_UNIVERSIDADE.includes(p)).length ? perfis.filter(p => PERFIS_UNIVERSIDADE.includes(p)).map(p => <ChipPerfil key={p} perfil={p} />) : <span className="text-slate-400">aluno</span>}</TableCell>
                    <TableCell><Badge cor={u.status === 'ativo' ? 'emerald' : u.status === 'pendente' ? 'amber' : 'slate'}>{u.status === 'ativo' ? 'Activo' : u.status === 'pendente' ? 'Pendente' : 'Inactivo'}</Badge>{u.acesso_uc === 'sem_conta' ? <p className="text-[11px] text-slate-500">sem conta na Universidade</p> : u.banido && <p className="text-[11px] text-red-600">{u.acesso_uc ? 'acesso à Universidade revogado' : 'login bloqueado'}</p>}</TableCell>
                    <TableCell className="text-xs text-slate-500">{u.ultimo_login ? fmt(u.ultimo_login) : <span className="text-amber-700 dark:text-amber-300">nunca entrou</span>}</TableCell>
                    <TableCell className="text-xs text-slate-500">{fmtD(u.created_date)}</TableCell>
                    {admin && <TableCell className="text-right"><div className="flex justify-end gap-1.5"><Button size="sm" variant="outline" onClick={() => setEditarDe(u)} title="Editar nome e telefone"><Pencil className="h-4 w-4" aria-hidden="true" />Editar</Button>{!eu && <Button size="sm" variant="outline" onClick={() => setPerfisDe(u)} title="Perfis da Universidade (formando, instrutor, perfis próprios)"><UserCog className="h-4 w-4" aria-hidden="true" />Perfis</Button>}{eu || contaGlobal(u) ? <span className="self-center text-xs text-slate-400" title="Conta global (acesso total)"><ShieldCheck className="inline h-4 w-4" aria-hidden="true" /></span> : u.acesso_uc === 'sem_conta' ? <span className="self-center text-xs text-slate-400" title="Sem conta na Universidade: use «Convidar»">—</span> : (u.acesso_uc ? u.acesso_uc === 'activo' : u.status === 'ativo') ? <Button size="sm" variant="outline" className="text-red-600" disabled={busy === u.id} onClick={() => setConfirmar({ t: 'Revogar acesso', m: `Revogar o acesso de ${u.email}? Deixa de conseguir entrar na Universidade até ser reactivado.`, f: () => accao('revogar', { user_id: u.id }, 'Acesso revogado'), destrutivo: true })}>{busy === u.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Ban className="h-4 w-4" aria-hidden="true" />}Revogar</Button> : <Button size="sm" variant="outline" disabled={busy === u.id} onClick={() => accao('reativar', { user_id: u.id }, 'Acesso reactivado')}>{busy === u.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RotateCcw className="h-4 w-4" aria-hidden="true" />}Reactivar</Button>}{!eu && !contaGlobal(u) && <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700" disabled={busy === u.id} title="Excluir a conta de acesso e o perfil" aria-label={`Excluir ${u.full_name || u.email}`} onClick={() => setConfirmar({ t: 'Excluir utilizador', m: `Excluir ${u.full_name || u.email} (${u.email})? A conta da Universidade é removida. O histórico de formação (matrículas, certificados) mantém-se associado ao email. Para uma suspensão temporária use «Revogar».`, f: () => excluir(u), destrutivo: true })}><Trash2 className="h-4 w-4" aria-hidden="true" /></Button>}</div></TableCell>}
                  </TableRow>
                ); })}</TableBody>
              </Table></div>
            )}
          </CardContent></Card>
          {!admin && <p className="text-xs text-slate-500">Revogar e reactivar acessos é reservado a administradores.</p>}
        </TabsContent>

        <TabsContent value="perfis" className="mt-4"><PerfisPaginas admin={admin} actor={user} utilizadores={data?.utilizadores || []} /></TabsContent>
      </Tabs>

      {aprovar && <DialogAprovar pedido={aprovar} admin={admin} cursosById={cursosById} onFechar={() => setAprovar(null)} onFeito={(r) => { setAprovar(null); setResultado(r); if (r?.inscritos) toast({ title: `Inscrito(a) em ${r.inscritos} curso(s) de interesse` }); refrescar(); }} />}
      {rejeitar && <DialogRejeitar pedido={rejeitar} onFechar={() => setRejeitar(null)} onFeito={() => { setRejeitar(null); toast({ title: 'Pedido rejeitado' }); refrescar(); }} />}
      {convidar && <DialogConvidar admin={admin} onFechar={() => setConvidar(false)} onFeito={(r) => { setConvidar(false); setResultado(r); refrescar(); }} />}
      {perfisDe && <DialogPerfis u={perfisDe} actor={user} onFechar={() => setPerfisDe(null)} onFeito={() => { setPerfisDe(null); refrescar(); }} />}
      {editarDe && <DialogEditarUtilizador u={editarDe} actor={user} onFechar={() => setEditarDe(null)} onFeito={() => { setEditarDe(null); refrescar(); }} />}
      <ResultadoConvite r={resultado} onFechar={() => setResultado(null)} />
      <ConfirmModal isOpen={!!confirmar} onClose={() => setConfirmar(null)} onConfirm={() => confirmar?.f?.()} title={confirmar?.t} message={confirmar?.m} confirmText={confirmar?.t} variant={confirmar?.destrutivo ? 'destructive' : 'default'} />
    </PaginaGestao>
  );
}
