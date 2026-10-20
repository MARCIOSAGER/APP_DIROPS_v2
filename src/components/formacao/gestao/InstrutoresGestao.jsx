import { PERFIL_UC_LABEL } from '@/lib/universidade';
import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { UserPlus, UserMinus, Search, Loader2, ShieldCheck, Info, Pencil, AlertTriangle } from 'lucide-react';
import Select from '@/components/ui/select';
import { Curso } from '@/entities/Curso';
import { useToast } from '@/components/ui/use-toast';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { User } from '@/entities/User';
import { useUtilizadoresComPerfis, useTodosCursos, ehInstrutor } from '@/hooks/useGestaoFormacao';

const lower = (s) => String(s || '').toLowerCase();

// Instrutores habilitados (perfil 'instrutor'): quem pode criar cursos e gerir os seus. Só administradores.
export default function InstrutoresGestao({ user }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: utilizadores = [], isLoading } = useUtilizadoresComPerfis();
  const { data: cursos = [] } = useTodosCursos();
  const [adicionar, setAdicionar] = useState(false);
  const [busca, setBusca] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [editar, setEditar] = useState(null);
  const [ocupado, setOcupado] = useState(null);

  const instrutores = useMemo(() => utilizadores.filter(ehInstrutor).sort((a, b) => String(a.full_name || a.email).localeCompare(String(b.full_name || b.email))), [utilizadores]);
  const cursosDe = (u) => cursos.filter(c => !c.deleted_at && [c.instrutor_email, c.created_by, ...(c.instrutores || [])].map(lower).includes(lower(u.email)));
  const candidatos = useMemo(() => { const q = busca.trim().toLowerCase(); return utilizadores.filter(u => !ehInstrutor(u) && (!q || [u.full_name, u.email].some(v => lower(v).includes(q)))).slice(0, 50); }, [utilizadores, busca]);

  const alterar = async (u, dar) => {
    setOcupado(u.id);
    try {
      const perfis = (Array.isArray(u.perfis) ? u.perfis : []).filter(p => p !== 'instrutor');
      await User.update(u.id, { perfis: dar ? [...perfis, 'instrutor'] : perfis });
      toast({ title: dar ? 'Instrutor adicionado' : 'Instrutor removido', description: `${u.full_name || u.email}${dar ? ' passa a poder criar cursos e gerir os seus.' : ' deixa de ter acesso à Gestão de Formação (mantém o acesso como aluno).'}` });
      await qc.invalidateQueries({ queryKey: ['users'] });
      if (dar) setAdicionar(false);
    } catch (e) { toast({ title: 'Não foi possível alterar o perfil', description: e?.message, variant: 'destructive' }); }
    finally { setOcupado(null); }
  };

  if (isLoading) return <div className="space-y-3"><Skeleton className="h-16 w-full" /><Skeleton className="h-56 w-full" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100 sm:flex-row sm:items-start">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div>
          <p><strong>Regras.</strong> Um instrutor pode criar cursos e gerir (conteúdo, avaliação, alunos, certificados) os cursos de que é responsável, co-instrutor ou criador. Nos outros cursos vê tudo mas não altera. Administradores podem tudo. Use <strong>Editar</strong> para definir de que cursos cada instrutor é responsável ou co-instrutor (o mesmo que "Editar dados" em cada curso).</p>
          <p className="mt-1 text-xs text-blue-800/80 dark:text-blue-200/80">O perfil «instrutor» dá-se aqui, em Acessos › Perfis do site da Universidade ou ao aprovar/convidar.</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-slate-600 dark:text-slate-400"><ShieldCheck className="mr-1 inline h-4 w-4" aria-hidden="true" />{instrutores.length} {instrutores.length === 1 ? 'instrutor habilitado' : 'instrutores habilitados'}{user?.email ? ' · os administradores não precisam do perfil' : ''}</p>
        <Button onClick={() => { setBusca(''); setAdicionar(true); }}><UserPlus className="h-4 w-4" aria-hidden="true" />Adicionar instrutor</Button>
      </div>
      <Card className="dark:border-slate-800 dark:bg-slate-900"><CardContent className="p-0">
        {instrutores.length === 0 ? <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">Ainda não há instrutores. Só os administradores podem criar cursos.</p> : (
          <div className="overflow-x-auto"><Table>
            <TableHeader><TableRow><TableHead>Instrutor</TableHead><TableHead>Perfis</TableHead><TableHead>Cursos que gere</TableHead><TableHead className="text-right">Acções</TableHead></TableRow></TableHeader>
            <TableBody>{instrutores.map(u => { const cs = cursosDe(u); return (
              <TableRow key={u.id}>
                <TableCell><p className="font-medium text-slate-900 dark:text-slate-100">{u.full_name || u.email}</p><p className="text-xs text-slate-500">{u.email}</p></TableCell>
                <TableCell><div className="flex flex-wrap gap-1">{(u.perfis || []).filter(p => PERFIL_UC_LABEL[p]).map(p => <Badge key={p} variant="secondary" className="font-normal">{PERFIL_UC_LABEL[p]}</Badge>)}</div></TableCell>
                <TableCell className="text-sm">{cs.length === 0 ? <span className="text-slate-400">nenhum</span> : <span title={cs.map(c => c.titulo).join(', ')}>{cs.length} {cs.length === 1 ? 'curso' : 'cursos'}: <span className="text-slate-600 dark:text-slate-300">{cs.slice(0, 3).map(c => c.titulo).join(', ')}{cs.length > 3 ? '…' : ''}</span></span>}</TableCell>
                <TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => setEditar(u)} aria-label={`Editar cursos de ${u.full_name || u.email}`}><Pencil className="h-4 w-4" aria-hidden="true" />Editar</Button><Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" disabled={ocupado === u.id || lower(u.email) === lower(user?.email)} onClick={() => setConfirm(u)} title={lower(u.email) === lower(user?.email) ? 'Não pode remover o seu próprio perfil' : 'Remover o perfil de instrutor'}>{ocupado === u.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <UserMinus className="h-4 w-4" aria-hidden="true" />}Remover</Button></TableCell>
              </TableRow>
            ); })}</TableBody>
          </Table></div>
        )}
      </CardContent></Card>

      <Dialog open={adicionar} onOpenChange={(o) => { if (!o && !ocupado) setAdicionar(false); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Adicionar instrutor</DialogTitle><DialogDescription>Escolha um utilizador activo. Recebe o perfil "instrutor" e passa a poder criar cursos.</DialogDescription></DialogHeader>
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" /><Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou email…" aria-label="Pesquisar utilizador" className="pl-9" autoFocus /></div>
          <ul className="max-h-72 divide-y overflow-y-auto rounded-md border dark:divide-slate-800 dark:border-slate-700">
            {candidatos.length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-500">{utilizadores.length === 0 ? 'Não foi possível ler a lista de utilizadores (precisa de ser administrador).' : 'Nenhum utilizador corresponde.'}</li>}
            {candidatos.map(u => (
              <li key={u.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0"><p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{u.full_name || u.email}</p><p className="truncate text-xs text-slate-500">{u.email}{(u.perfis || []).length ? ` · ${u.perfis.join(', ')}` : ''}</p></div>
                <Button size="sm" variant="outline" disabled={!!ocupado} onClick={() => alterar(u, true)} aria-label={`Tornar ${u.full_name || u.email} instrutor`}>{ocupado === u.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <UserPlus className="h-4 w-4" aria-hidden="true" />}Adicionar</Button>
              </li>
            ))}
          </ul>
          <DialogFooter><Button variant="outline" onClick={() => setAdicionar(false)} disabled={!!ocupado}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      {editar && <EditarInstrutor u={editar} cursos={cursos} onFechar={() => setEditar(null)} />}
      <ConfirmModal isOpen={!!confirm} onClose={() => setConfirm(null)} onConfirm={() => { const u = confirm; setConfirm(null); alterar(u, false); }} variant="destructive" title="Remover instrutor?" confirmText="Remover"
        message={`${confirm?.full_name || confirm?.email} deixa de poder criar e gerir cursos. Os cursos de que é responsável mantêm-se; passe-os a outro instrutor em "Editar dados".`} />
    </div>
  );
}

const PAPEIS = [{ value: 'nenhum', label: '—' }, { value: 'co', label: 'Co-instrutor' }, { value: 'responsavel', label: 'Responsável' }];
const papelDe = (c, email) => (lower(c.instrutor_email) === email ? 'responsavel' : (c.instrutores || []).map(lower).includes(email) ? 'co' : 'nenhum');

// Editar um instrutor: de que cursos é responsável ou co-instrutor (escreve em curso.instrutor_email / curso.instrutores).
function EditarInstrutor({ u, cursos, onFechar }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const email = lower(u.email);
  const lista = useMemo(() => cursos.filter(c => !c.deleted_at).sort((a, b) => String(a.titulo).localeCompare(String(b.titulo))), [cursos]);
  const [papeis, setPapeis] = useState(() => Object.fromEntries(lista.map(c => [c.id, papelDe(c, email)])));
  const [ocupado, setOcupado] = useState(false);
  const alterados = lista.filter(c => papeis[c.id] !== papelDe(c, email));
  const ficamSemResponsavel = alterados.filter(c => papelDe(c, email) === 'responsavel' && papeis[c.id] !== 'responsavel');
  const guardar = async () => {
    setOcupado(true);
    try {
      for (const c of alterados) {
        const novo = papeis[c.id];
        const co = (c.instrutores || []).map(lower).filter(e => e !== email);
        const patch = { instrutores: novo === 'co' ? [...co, email] : co };
        if (novo === 'responsavel') { patch.instrutor_email = email; patch.instrutor_nome = u.full_name || email; }
        else if (papelDe(c, email) === 'responsavel') { patch.instrutor_email = null; patch.instrutor_nome = null; }
        await Curso.update(c.id, patch);
      }
      await qc.invalidateQueries({ queryKey: ['curso'] });
      toast({ title: 'Cursos do instrutor actualizados', description: `${u.full_name || u.email}: ${alterados.length} curso(s) alterado(s).` });
      onFechar();
    } catch (e) { toast({ title: 'Não foi possível guardar', description: e?.message, variant: 'destructive' }); }
    finally { setOcupado(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => { if (!o && !ocupado) onFechar(); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>Editar instrutor — {u.full_name || u.email}</DialogTitle><DialogDescription>{u.email}</DialogDescription></DialogHeader>
        <p className="text-sm text-slate-600 dark:text-slate-400">Escolha o papel deste instrutor em cada curso. O <strong>responsável</strong> recebe as perguntas dos formandos e assina por omissão; os <strong>co-instrutores</strong> gerem o curso da mesma forma.</p>
        <div className="max-h-[50vh] overflow-y-auto rounded-md border dark:border-slate-700">
          {lista.length === 0 ? <p className="p-4 text-sm text-slate-500">Não há cursos.</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>Curso</TableHead><TableHead>Responsável actual</TableHead><TableHead className="w-44">Papel</TableHead></TableRow></TableHeader>
              <TableBody>{lista.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="text-sm font-medium text-slate-900 dark:text-slate-100">{c.titulo}{!c.publicado && <span className="ml-2 rounded bg-slate-100 px-1.5 text-[11px] font-normal text-slate-600 dark:bg-slate-800 dark:text-slate-300">rascunho</span>}</TableCell>
                  <TableCell className="text-xs text-slate-500">{c.instrutor_nome || c.instrutor_email || '—'}{(c.instrutores || []).length ? ` · co: ${c.instrutores.length}` : ''}</TableCell>
                  <TableCell><Select options={PAPEIS} value={papeis[c.id]} onValueChange={(v) => setPapeis(x => ({ ...x, [c.id]: v }))} /></TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          )}
        </div>
        {ficamSemResponsavel.length > 0 && <p className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />{ficamSemResponsavel.map(c => c.titulo).join(', ')}: fica sem responsável. Defina outro em "Editar dados" do curso ou atribua-o a outro instrutor aqui.</p>}
        <DialogFooter><Button variant="outline" onClick={onFechar} disabled={ocupado}>Cancelar</Button><Button onClick={guardar} disabled={ocupado || alterados.length === 0}>{ocupado ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Pencil className="h-4 w-4" aria-hidden="true" />}Guardar{alterados.length ? ` (${alterados.length})` : ''}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
