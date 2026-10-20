import { PERFIS_UNIVERSIDADE, PERFIL_UC_LABEL } from '@/lib/universidade';
import React, { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import Select from '@/components/ui/select';
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Loader2, Route, ChevronDown, ChevronUp, Lock } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { Trilha } from '@/entities/Trilha';
import { TrilhaCurso } from '@/entities/TrilhaCurso';
import { useTrilhas, useTodosCursos } from '@/hooks/useGestaoFormacao';
import ImagemUpload from './ImagemUpload';

// Trilhas de formação: sequências de cursos (ex.: "Integração de novo colaborador").
export default function TrilhasGestao({ user }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useTrilhas();
  const { data: cursos = [] } = useTodosCursos();
  const trilhas = (data?.trilhas || []).filter(t => !t.deleted_at);
  const trilhaCursos = data?.trilhaCursos || [];
  const cursosById = useMemo(() => Object.fromEntries(cursos.map(c => [c.id, c])), [cursos]);
  const [form, setForm] = useState({ open: false, trilha: null });
  const [confirm, setConfirm] = useState(null);
  const [aberta, setAberta] = useState(null);
  const [ocupado, setOcupado] = useState(null);
  const refrescar = () => qc.invalidateQueries({ queryKey: ['trilha'] });

  const apagar = async () => {
    const t = confirm; setConfirm(null); setOcupado(t.id);
    try { await Trilha.update(t.id, { deleted_at: new Date().toISOString(), publicado: false, updated_by: user?.email || null }); toast({ title: 'Trilha apagada' }); await refrescar(); }
    catch (e) { toast({ title: 'Não foi possível apagar', description: e?.message, variant: 'destructive' }); }
    finally { setOcupado(null); }
  };
  const publicar = async (t, v) => {
    setOcupado(t.id);
    try { await Trilha.update(t.id, { publicado: !!v, updated_by: user?.email || null }); await refrescar(); }
    catch (e) { toast({ title: 'Não foi possível actualizar', description: e?.message, variant: 'destructive' }); }
    finally { setOcupado(null); }
  };

  if (isLoading) return <div className="space-y-3">{[0, 1].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600 dark:text-slate-400">Uma trilha agrupa cursos por ordem. Pode ser sequencial (o curso seguinte só abre depois do anterior) e obrigatória para perfis.</p>
        <Button onClick={() => setForm({ open: true, trilha: null })}><Plus className="h-4 w-4" aria-hidden="true" />Nova trilha</Button>
      </div>
      {trilhas.length === 0 ? (
        <Card className="border-dashed dark:border-slate-800 dark:bg-slate-900"><CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <Route className="h-8 w-8 text-slate-400" aria-hidden="true" />
          <p className="font-medium text-slate-900 dark:text-slate-100">Ainda não há trilhas</p>
          <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">Exemplo: "Integração de novo colaborador" com SGSO → Condução no Lado Ar → GRF.</p>
        </CardContent></Card>
      ) : trilhas.map(t => {
        const itens = trilhaCursos.filter(tc => tc.trilha_id === t.id).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
        const expandida = aberta === t.id;
        return (
          <Card key={t.id} className="dark:border-slate-800 dark:bg-slate-900"><CardContent className="p-0">
            <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <button type="button" onClick={() => setAberta(expandida ? null : t.id)} className="flex min-w-0 flex-1 items-start gap-3 text-left" aria-expanded={expandida}>
                {expandida ? <ChevronUp className="mt-1 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" /> : <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{t.titulo}</p>
                    {t.publicado ? <Badge className="bg-emerald-600 hover:bg-emerald-600">Publicada</Badge> : <Badge variant="outline" className="border-amber-300 text-amber-700 dark:text-amber-400">Rascunho</Badge>}
                    {(t.obrigatorio_todos || (t.obrigatorio_perfis || []).length > 0) && <Badge variant="secondary">Obrigatória{t.obrigatorio_todos ? ' (todos)' : `: ${(t.obrigatorio_perfis || []).map(p => PERFIL_UC_LABEL[p] || p).join(', ')}`}</Badge>}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{itens.length} {itens.length === 1 ? 'curso' : 'cursos'} · {t.sequencial ? 'sequencial' : 'ordem livre'}{t.descricao ? ` · ${t.descricao}` : ''}</p>
                </div>
              </button>
              <div className="flex shrink-0 items-center gap-1">
                {ocupado === t.id ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-hidden="true" /> : <Switch checked={!!t.publicado} onCheckedChange={(v) => publicar(t, v)} disabled={itens.length === 0 && !t.publicado} aria-label={`Publicar ${t.titulo}`} />}
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Editar trilha" onClick={() => setForm({ open: true, trilha: t })}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700" aria-label="Apagar trilha" onClick={() => setConfirm(t)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
            {expandida && <CursosDaTrilha trilha={t} itens={itens} cursos={cursos} cursosById={cursosById} onChanged={refrescar} />}
          </CardContent></Card>
        );
      })}
      <TrilhaForm isOpen={form.open} onClose={() => setForm({ open: false, trilha: null })} trilha={form.trilha} user={user} proximaOrdem={trilhas.length + 1} onSaved={(t, nova) => { toast({ title: nova ? 'Trilha criada' : 'Trilha actualizada' }); refrescar(); if (nova) setAberta(t.id); }} />
      <ConfirmModal isOpen={!!confirm} onClose={() => setConfirm(null)} onConfirm={apagar} variant="destructive" title="Apagar trilha?" confirmText="Apagar" message={`"${confirm?.titulo}" deixa de aparecer aos alunos. As matrículas e certificados dos cursos mantêm-se.`} />
    </div>
  );
}

function CursosDaTrilha({ trilha, itens, cursos, cursosById, onChanged }) {
  const { toast } = useToast();
  const [novo, setNovo] = useState('');
  const [ocupado, setOcupado] = useState(null);
  const disponiveis = cursos.filter(c => !c.deleted_at && !itens.some(i => i.curso_id === c.id));
  const proximaOrdem = (itens.at(-1)?.ordem ?? 0) + 1;
  const acao = async (fn, id) => { setOcupado(id || 'x'); try { await fn(); await onChanged(); } catch (e) { toast({ title: 'Não foi possível actualizar', description: e?.message, variant: 'destructive' }); } finally { setOcupado(null); } };
  const mover = (idx, dir) => { const j = idx + dir; if (j < 0 || j >= itens.length) return; acao(async () => { const nova = itens.map((x, k) => ({ id: x.id, antes: x.ordem, ordem: k + 1 })); [nova[idx].ordem, nova[j].ordem] = [nova[j].ordem, nova[idx].ordem]; await Promise.all(nova.filter(x => x.ordem !== x.antes).map(x => TrilhaCurso.update(x.id, { ordem: x.ordem }))); }, itens[idx].id); };
  return (
    <div className="border-t px-4 py-3 dark:border-slate-800">
      {itens.length === 0 ? <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">Sem cursos. Adicione abaixo, pela ordem pretendida.</p> : (
        <ol className="mb-3 space-y-1">{itens.map((it, i) => { const c = cursosById[it.curso_id]; return (
          <li key={it.id} className="flex items-center gap-2 rounded-md border px-3 py-2 dark:border-slate-700">
            <span className="w-6 text-sm tabular-nums text-slate-400">{i + 1}.</span>
            <span className="min-w-0 flex-1 truncate text-sm text-slate-900 dark:text-slate-100">{c?.titulo || 'Curso removido'}{c && !c.publicado ? <span className="ml-2 text-xs text-amber-600">(rascunho)</span> : null}</span>
            <label className="flex items-center gap-1.5 text-xs text-slate-500"><Checkbox checked={it.obrigatorio !== false} onCheckedChange={(v) => acao(() => TrilhaCurso.update(it.id, { obrigatorio: !!v }), it.id)} aria-label="Obrigatório na trilha" />Obrigatório</label>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Subir" disabled={i === 0 || !!ocupado} onClick={() => mover(i, -1)}>{ocupado === it.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}</Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Descer" disabled={i === itens.length - 1 || !!ocupado} onClick={() => mover(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700" aria-label="Remover da trilha" disabled={!!ocupado} onClick={() => acao(() => TrilhaCurso.delete(it.id), it.id)}><Trash2 className="h-4 w-4" /></Button>
          </li>
        ); })}</ol>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex-1"><Select value={novo} onValueChange={setNovo} placeholder={disponiveis.length ? 'Escolher curso para adicionar…' : 'Todos os cursos já estão na trilha'} options={disponiveis.map(c => ({ value: c.id, label: c.titulo + (c.publicado ? '' : ' (rascunho)') }))} /></div>
        <Button variant="outline" size="sm" disabled={!novo || !!ocupado} onClick={() => acao(async () => { await TrilhaCurso.create({ trilha_id: trilha.id, curso_id: novo, ordem: proximaOrdem, obrigatorio: true }); setNovo(''); })}><Plus className="h-4 w-4" aria-hidden="true" />Adicionar curso</Button>
      </div>
      {trilha.sequencial && itens.length > 1 && <p className="mt-2 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400"><Lock className="h-3 w-3" aria-hidden="true" />Trilha sequencial: cada curso só desbloqueia quando o anterior estiver concluído.</p>}
    </div>
  );
}

function TrilhaForm({ isOpen, onClose, trilha, user, proximaOrdem, onSaved }) {
  // Obrigatoriedade por perfil da Universidade (não pelos perfis de função do DIROPS)
  const perfisOpcoes = PERFIS_UNIVERSIDADE.map(p => ({ value: p, label: PERFIL_UC_LABEL[p] }));
  const [form, setForm] = useState(null);
  const [aGuardar, setAGuardar] = useState(false);
  const [erro, setErro] = useState('');
  useEffect(() => {
    if (!isOpen) return;
    setErro('');
    setForm({ titulo: trilha?.titulo || '', descricao: trilha?.descricao || '', capa_url: trilha?.capa_url || null, publicado: !!trilha?.publicado, sequencial: trilha ? trilha.sequencial !== false : true, obrigatorio_todos: !!trilha?.obrigatorio_todos, obrigatorio_perfis: Array.isArray(trilha?.obrigatorio_perfis) ? trilha.obrigatorio_perfis : [] });
  }, [isOpen, trilha]);
  if (!form) return null;
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const submeter = async (e) => {
    e.preventDefault();
    if (!form.titulo.trim()) { setErro('O título é obrigatório.'); return; }
    setAGuardar(true); setErro('');
    const payload = { titulo: form.titulo.trim(), descricao: form.descricao.trim() || null, capa_url: form.capa_url || null, publicado: form.publicado, sequencial: form.sequencial, obrigatorio_todos: form.obrigatorio_todos, obrigatorio_perfis: form.obrigatorio_todos ? [] : form.obrigatorio_perfis, updated_by: user?.email || null };
    try {
      const saved = trilha ? await Trilha.update(trilha.id, payload) : await Trilha.create({ ...payload, ordem: proximaOrdem, created_by: user?.email || null, empresa_id: user?.empresa_id || null });
      onSaved?.(saved, !trilha); onClose();
    } catch (err) { setErro(err?.message || String(err)); }
    finally { setAGuardar(false); }
  };
  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o && !aGuardar) onClose(); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <form onSubmit={submeter} className="space-y-4">
          <DialogHeader><DialogTitle>{trilha ? 'Editar trilha' : 'Nova trilha'}</DialogTitle><DialogDescription>Depois de criar, adicione os cursos pela ordem pretendida.</DialogDescription></DialogHeader>
          <div className="space-y-1.5"><Label htmlFor="tf-titulo">Título <span className="text-red-600">*</span></Label><Input id="tf-titulo" value={form.titulo} onChange={(e) => set('titulo', e.target.value)} required autoFocus placeholder="Ex.: Integração de novo colaborador" /></div>
          <div className="space-y-1.5"><Label htmlFor="tf-desc">Descrição</Label><Textarea id="tf-desc" rows={3} value={form.descricao} onChange={(e) => set('descricao', e.target.value)} /></div>
          <ImagemUpload label="Imagem de capa" value={form.capa_url} onChange={(v) => set('capa_url', v)} ajuda="Opcional, 16:9." />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-md border px-3 py-2 dark:border-slate-700"><div><Label htmlFor="tf-seq" className="cursor-pointer">Sequencial</Label><p className="text-xs text-slate-500">Cursos desbloqueiam por ordem.</p></div><Switch id="tf-seq" checked={form.sequencial} onCheckedChange={(v) => set('sequencial', !!v)} /></div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2 dark:border-slate-700"><div><Label htmlFor="tf-pub" className="cursor-pointer">Publicada</Label><p className="text-xs text-slate-500">Visível aos alunos.</p></div><Switch id="tf-pub" checked={form.publicado} onCheckedChange={(v) => set('publicado', !!v)} /></div>
          </div>
          <div className="space-y-3 rounded-lg border p-3 dark:border-slate-700">
            <div className="flex items-center justify-between"><div><Label htmlFor="tf-obrig" className="cursor-pointer">Obrigatória para todos</Label><p className="text-xs text-slate-500">Os cursos obrigatórios da trilha contam na matriz.</p></div><Switch id="tf-obrig" checked={form.obrigatorio_todos} onCheckedChange={(v) => set('obrigatorio_todos', !!v)} /></div>
            {!form.obrigatorio_todos && perfisOpcoes.length > 0 && (
              <div className="space-y-1.5"><Label>Obrigatória para os perfis</Label>
                <div className="grid gap-1.5 sm:grid-cols-2">{perfisOpcoes.map(p => { const on = form.obrigatorio_perfis.map(x => String(x).toLowerCase()).includes(String(p.value).toLowerCase()); return (
                  <label key={p.value} className="flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"><Checkbox checked={on} onCheckedChange={(v) => set('obrigatorio_perfis', v ? [...form.obrigatorio_perfis, p.value] : form.obrigatorio_perfis.filter(x => String(x).toLowerCase() !== String(p.value).toLowerCase()))} aria-label={p.label} /><span>{p.label}</span></label>
                ); })}</div>
              </div>
            )}
          </div>
          {erro && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{erro}</p>}
          <DialogFooter><Button type="button" variant="outline" onClick={onClose} disabled={aGuardar}>Cancelar</Button><Button type="submit" disabled={aGuardar}>{aGuardar && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}{trilha ? 'Guardar' : 'Criar trilha'}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
