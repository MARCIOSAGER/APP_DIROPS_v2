import React, { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import Select from '@/components/ui/select';
import { Loader2, Search, UserPlus } from 'lucide-react';
import { Matricula } from '@/entities/Matricula';
import { sendEmailDirect } from '@/functions/sendEmailDirect';
import { getPublicBaseUrl } from '@/lib/certificadoEmissao';
import { ENTREGAVEL } from '@/lib/formacaoLembrete';

// Inscreve em massa os colaboradores com formação obrigatória "em falta" (matriz), agrupados por curso.
// cursoId (opcional) limita a um curso. Cria matrículas com origem 'obrigatorio' e avisa por email (@sga.co.ao).
export default function InscreverEmFaltaDialog({ isOpen, onClose, matriz, cursoId = null, user, onDone }) {
  const qc = useQueryClient();
  const [sel, setSel] = useState(() => new Set());
  const [busca, setBusca] = useState('');
  const [perfil, setPerfil] = useState('todos');
  const [curso, setCurso] = useState(cursoId || 'todos');
  const [aGuardar, setAGuardar] = useState(false);
  const [erro, setErro] = useState('');

  const itens = useMemo(() => {
    if (!matriz) return [];
    const out = [];
    for (const l of matriz.linhas) for (const cel of l.celulas) {
      if (cel.estado !== 'em_falta') continue;
      if (cursoId && cel.curso.id !== cursoId) continue;
      out.push({ chave: `${cel.curso.id}|${l.user.email.toLowerCase()}`, user: l.user, curso: cel.curso });
    }
    return out;
  }, [matriz, cursoId]);
  const perfis = useMemo(() => [...new Set(itens.flatMap(i => i.user.perfis || []))].sort(), [itens]);
  const cursos = useMemo(() => { const m = new Map(); for (const i of itens) m.set(i.curso.id, i.curso); return [...m.values()]; }, [itens]);

  useEffect(() => { if (isOpen) { setSel(new Set(itens.map(i => i.chave))); setBusca(''); setPerfil('todos'); setCurso(cursoId || 'todos'); setErro(''); } }, [isOpen, itens, cursoId]);

  const q = busca.trim().toLowerCase();
  const visiveis = itens.filter(i => (curso === 'todos' || i.curso.id === curso) && (perfil === 'todos' || (i.user.perfis || []).includes(perfil)) && (!q || [i.user.full_name, i.user.email].some(v => String(v || '').toLowerCase().includes(q))));
  const grupos = useMemo(() => { const m = new Map(); for (const i of visiveis) { if (!m.has(i.curso.id)) m.set(i.curso.id, { curso: i.curso, itens: [] }); m.get(i.curso.id).itens.push(i); } return [...m.values()]; }, [visiveis]);
  const nSel = itens.filter(i => sel.has(i.chave)).length;
  const alternar = (chave, v) => setSel(s => { const n = new Set(s); if (v) n.add(chave); else n.delete(chave); return n; });
  const alternarGrupo = (g, v) => setSel(s => { const n = new Set(s); for (const i of g.itens) { if (v) n.add(i.chave); else n.delete(i.chave); } return n; });

  const inscrever = async () => {
    const escolhidos = itens.filter(i => sel.has(i.chave));
    if (!escolhidos.length) { setErro('Seleccione pelo menos um colaborador.'); return; }
    setAGuardar(true); setErro('');
    try {
      const agora = new Date().toISOString();
      await Matricula.bulkCreate(escolhidos.map(i => ({ curso_id: i.curso.id, aluno_email: i.user.email.toLowerCase(), aluno_nome: i.user.full_name || null, estado: 'ativo', progresso_pct: 0, origem: 'obrigatorio', empresa_id: user?.empresa_id || null, created_by: user?.email || null, created_date: agora })));
      const base = await getPublicBaseUrl().catch(() => '');
      Promise.allSettled(escolhidos.filter(i => ENTREGAVEL.test(i.user.email)).map(i => sendEmailDirect({
        to: i.user.email, subject: `[Formação] Foi inscrito no curso obrigatório "${i.curso.titulo}"`,
        html: `<div style="font-family:Segoe UI,Arial,sans-serif;color:#0f172a"><p>Olá ${i.user.full_name || ''},</p><p>Foi inscrito(a) no curso obrigatório <strong>${i.curso.titulo}</strong>.${i.curso.prazo_dias ? ` Tem <strong>${i.curso.prazo_dias} dias</strong> para o concluir.` : ''}</p><p><a href="${base}/universidade/formacao?curso=${i.curso.id}" style="background:#4f46e5;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Começar o curso</a></p><p style="color:#64748b;font-size:12px">Universidade Corporativa · SGA.</p></div>`,
      })));
      await qc.invalidateQueries({ queryKey: ['matricula'] });
      onDone?.(escolhidos.length);
      onClose();
    } catch (e) { setErro(e?.message || String(e)); }
    finally { setAGuardar(false); }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o && !aGuardar) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Inscrever formação obrigatória em falta</DialogTitle>
          <DialogDescription>{itens.length === 0 ? 'Não há colaboradores com formação obrigatória em falta.' : `${itens.length} ${itens.length === 1 ? 'inscrição em falta' : 'inscrições em falta'}. Cada colaborador recebe um email individual (só @sga.co.ao é entregue).`}</DialogDescription>
        </DialogHeader>
        {itens.length > 0 && (
          <>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" /><Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar colaborador…" aria-label="Pesquisar colaborador" className="pl-9" /></div>
              {!cursoId && cursos.length > 1 && <div className="w-full sm:w-56"><Select value={curso} onValueChange={setCurso} searchable={false} options={[{ value: 'todos', label: 'Todos os cursos' }, ...cursos.map(c => ({ value: c.id, label: c.titulo }))]} /></div>}
              {perfis.length > 1 && <div className="w-full sm:w-44"><Select value={perfil} onValueChange={setPerfil} searchable={false} options={[{ value: 'todos', label: 'Todos os perfis' }, ...perfis.map(p => ({ value: p, label: p }))]} /></div>}
            </div>
            <div className="max-h-[50vh] space-y-3 overflow-y-auto rounded-md border p-2 dark:border-slate-700">
              {grupos.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Nenhum resultado para os filtros.</p>}
              {grupos.map(g => {
                const todos = g.itens.every(i => sel.has(i.chave));
                return (
                  <div key={g.curso.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-md bg-slate-50 px-2 py-1.5 text-sm font-medium dark:bg-slate-800">
                      <Checkbox checked={todos} onCheckedChange={(v) => alternarGrupo(g, !!v)} aria-label={`Seleccionar todos de ${g.curso.titulo}`} />
                      <span className="flex-1 truncate">{g.curso.titulo}</span><span className="text-xs font-normal text-slate-500">{g.itens.filter(i => sel.has(i.chave)).length}/{g.itens.length}</span>
                    </label>
                    <ul className="mt-1 grid gap-0.5 sm:grid-cols-2">{g.itens.map(i => (
                      <li key={i.chave}><label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"><Checkbox checked={sel.has(i.chave)} onCheckedChange={(v) => alternar(i.chave, !!v)} aria-label={`${i.user.full_name || i.user.email} — ${g.curso.titulo}`} /><span className="min-w-0 flex-1"><span className="block truncate">{i.user.full_name || i.user.email}</span><span className="block truncate text-xs text-slate-500">{(i.user.perfis || []).join(', ') || i.user.email}</span></span></label></li>
                    ))}</ul>
                  </div>
                );
              })}
            </div>
          </>
        )}
        {erro && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{erro}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={aGuardar}>Cancelar</Button>
          <Button onClick={inscrever} disabled={aGuardar || nSel === 0}>{aGuardar ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <UserPlus className="h-4 w-4" aria-hidden="true" />}Inscrever{nSel ? ` (${nSel})` : ''}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
