import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import Select from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Curso } from '@/entities/Curso';
import { Checkbox } from '@/components/ui/checkbox';
import { useUtilizadoresComPerfis, ehInstrutor, useTodosCursos } from '@/hooks/useGestaoFormacao';

const lower = (s) => String(s || '').toLowerCase();
import { NIVEL_LABEL } from '../formacaoUtils';
import { PERFIS_UNIVERSIDADE, PERFIL_UC_LABEL } from '@/lib/universidade';
import ImagemUpload from './ImagemUpload';

const VAZIO = { titulo: '', descricao: '', categoria: '', nivel: 'iniciante', instrutor_nome: '', instrutor_email: '', carga_horaria: '', capa_url: null, publicado: false, ordem: '', validade_meses: '', prazo_dias: '', obrigatorio_todos: false, obrigatorio_perfis: [], sincroniza_licenca_conducao: false, instrutores: [], tipo_formacao: 'inicial', curso_base_id: '', creditos: '' };

// Criar / editar os dados de um curso (o conteúdo edita-se no CursoEditor).
export default function CursoForm({ isOpen, onClose, curso, categorias = [], user, onSaved }) {
  const { toast } = useToast();
  // Obrigatoriedade por perfil da Universidade (não pelos perfis de função do DIROPS): Formando, Instrutor, Administrador da Universidade.
  // + perfis próprios da Universidade (migração 188), quando carregados
  const perfisOpcoes = PERFIS_UNIVERSIDADE.map(p => ({ value: p, label: PERFIL_UC_LABEL[p] || p }));
  const { data: utilizadores = [] } = useUtilizadoresComPerfis();
  const instrutores = utilizadores.filter(ehInstrutor);
  const { data: cursosTodos = [] } = useTodosCursos();
  const cursosBase = cursosTodos.filter(c => !c.deleted_at && c.tipo_formacao !== 'refrescamento' && c.id !== curso?.id);
  const [form, setForm] = useState(VAZIO);
  const [aGuardar, setAGuardar] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setErro('');
    setForm(curso ? {
      titulo: curso.titulo || '',
      descricao: curso.descricao || '',
      categoria: curso.categoria || '',
      nivel: curso.nivel || 'iniciante',
      instrutor_nome: curso.instrutor_nome || '',
      instrutor_email: curso.instrutor_email || '',
      carga_horaria: curso.carga_horaria ?? '',
      capa_url: curso.capa_url || null,
      publicado: !!curso.publicado,
      ordem: curso.ordem ?? '',
      validade_meses: curso.validade_meses ?? '',
      prazo_dias: curso.prazo_dias ?? '',
      obrigatorio_todos: !!curso.obrigatorio_todos,
      sincroniza_licenca_conducao: !!curso.sincroniza_licenca_conducao,
      instrutores: Array.isArray(curso.instrutores) ? curso.instrutores.map(lower) : [],
      tipo_formacao: curso.tipo_formacao || 'inicial',
      curso_base_id: curso.curso_base_id || '',
      creditos: curso.creditos || '',
      obrigatorio_perfis: Array.isArray(curso.obrigatorio_perfis) ? curso.obrigatorio_perfis : [],
    } : { ...VAZIO, instrutor_nome: user?.full_name || '', instrutor_email: user?.email || '' });
  }, [isOpen, curso, user]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submeter = async (e) => {
    e.preventDefault();
    if (!form.titulo.trim()) { setErro('O título é obrigatório.'); return; }
    setAGuardar(true); setErro('');
    const payload = {
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim() || null,
      categoria: form.categoria.trim() || null,
      nivel: form.nivel || null,
      instrutor_nome: form.instrutor_nome.trim() || null,
      instrutor_email: form.instrutor_email.trim().toLowerCase() || null,
      capa_url: form.capa_url || null,
      publicado: !!form.publicado,
      ordem: form.ordem === '' ? 0 : Number(form.ordem),
      validade_meses: form.validade_meses === '' ? null : Math.max(1, parseInt(form.validade_meses, 10) || 1),
      prazo_dias: form.prazo_dias === '' ? null : Math.max(1, parseInt(form.prazo_dias, 10) || 1),
      obrigatorio_todos: !!form.obrigatorio_todos,
      obrigatorio_perfis: form.obrigatorio_todos ? [] : form.obrigatorio_perfis,
      sincroniza_licenca_conducao: !!form.sincroniza_licenca_conducao,
      instrutores: [...new Set(form.instrutores.map(lower).filter(Boolean))],
      tipo_formacao: form.tipo_formacao === 'refrescamento' && form.curso_base_id ? 'refrescamento' : 'inicial',
      curso_base_id: form.tipo_formacao === 'refrescamento' && form.curso_base_id ? form.curso_base_id : null,
      creditos: String(form.creditos || '').trim() || null,
      updated_by: user?.email || null,
    };
    try {
      const saved = curso
        ? await Curso.update(curso.id, payload)
        : await Curso.create({ ...payload, created_by: user?.email || null, empresa_id: user?.empresa_id || null });
      toast({ title: curso ? 'Curso actualizado' : 'Curso criado', description: saved.titulo });
      onSaved?.(saved, !curso);
      onClose();
    } catch (err) {
      setErro(err?.message || String(err));
    } finally {
      setAGuardar(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o && !aGuardar) onClose(); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={submeter} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{curso ? 'Editar curso' : 'Novo curso'}</DialogTitle>
            <DialogDescription>Dados gerais do curso. Os módulos e aulas gerem-se depois, no editor de conteúdo.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cf-titulo">Título <span className="text-red-600">*</span></Label>
              <Input id="cf-titulo" value={form.titulo} onChange={(e) => set('titulo', e.target.value)} required autoFocus />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cf-desc">Descrição</Label>
              <Textarea id="cf-desc" rows={4} value={form.descricao} onChange={(e) => set('descricao', e.target.value)} placeholder="O que o aluno vai aprender, a quem se destina…" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cf-cat">Categoria</Label>
              <Input id="cf-cat" list="cf-categorias" value={form.categoria} onChange={(e) => set('categoria', e.target.value)} placeholder="Ex.: Safety, Operações" />
              <datalist id="cf-categorias">{categorias.map(c => <option key={c} value={c} />)}</datalist>
            </div>
            <div className="space-y-1.5">
              <Label>Nível</Label>
              <Select value={form.nivel} onValueChange={(v) => set('nivel', v)} searchable={false}
                options={Object.entries(NIVEL_LABEL).map(([value, label]) => ({ value, label }))} />
            </div>
            {instrutores.length > 0 && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Instrutor responsável</Label>
                <Select value={instrutores.some(u => lower(u.email) === lower(form.instrutor_email)) ? lower(form.instrutor_email) : (form.instrutor_email ? '__outro' : '')}
                  onValueChange={(v) => { const u = instrutores.find(x => lower(x.email) === v); if (u) setForm(f => ({ ...f, instrutor_nome: u.full_name || u.email, instrutor_email: lower(u.email), instrutores: f.instrutores.filter(e => e !== lower(u.email)) })); }}
                  placeholder="Escolher um instrutor habilitado…"
                  options={[...instrutores.map(u => ({ value: lower(u.email), label: `${u.full_name || u.email} (${u.email})` })), { value: '__outro', label: 'Outro — escrever nome e email à mão' }]} />
                <p className="text-xs text-slate-500 dark:text-slate-400">Só o responsável, os co-instrutores e os administradores podem editar este curso. Os instrutores habilitados definem-se no separador Instrutores.</p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="cf-instr">Instrutor (nome)</Label>
              <Input id="cf-instr" value={form.instrutor_nome} onChange={(e) => set('instrutor_nome', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cf-instr-email">Instrutor (email)</Label>
              <Input id="cf-instr-email" type="email" value={form.instrutor_email} onChange={(e) => set('instrutor_email', e.target.value)} />
            </div>
            {instrutores.filter(u => lower(u.email) !== lower(form.instrutor_email)).length > 0 && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Co-instrutores (também podem editar o curso)</Label>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {instrutores.filter(u => lower(u.email) !== lower(form.instrutor_email)).map(u => { const e = lower(u.email); const on = form.instrutores.includes(e); return (
                    <label key={u.id || e} className="flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm dark:border-slate-700">
                      <input type="checkbox" className="h-4 w-4 accent-blue-600" checked={on} onChange={(ev) => set('instrutores', ev.target.checked ? [...form.instrutores, e] : form.instrutores.filter(x => x !== e))} aria-label={`Co-instrutor ${u.full_name || u.email}`} />
                      <span className="min-w-0 truncate">{u.full_name || u.email}<span className="block truncate text-xs text-slate-500">{u.email}</span></span>
                    </label>
                  ); })}
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="cf-carga">Carga horária (horas)</Label>
              <Input id="cf-carga" type="number" value={form.carga_horaria} readOnly disabled placeholder="Calculada a partir das aulas" />
              <p className="text-xs text-slate-500 dark:text-slate-400">Calculada automaticamente: soma das durações das aulas (e das sessões ligadas a aulas presenciais), arredondada para cima à hora. Aparece no catálogo e no certificado.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cf-ordem">Ordem no catálogo</Label>
              <Input id="cf-ordem" type="number" min="0" step="1" value={form.ordem} onChange={(e) => set('ordem', e.target.value)} placeholder="0" />
            </div>
            <div className="sm:col-span-2">
              <ImagemUpload label="Imagem de capa" value={form.capa_url} onChange={(v) => set('capa_url', v)} ajuda="Opcional. Recomendado 16:9 (ex.: 1280×720). Sem imagem usa-se uma cor por categoria." />
            </div>

            <div className="space-y-3 rounded-lg border p-3 dark:border-slate-700 sm:col-span-2">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Obrigatoriedade, validade e prazo</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="cf-validade">Validade da certificação (meses)</Label>
                  <Input id="cf-validade" type="number" min="1" step="1" value={form.validade_meses} onChange={(e) => set('validade_meses', e.target.value)} placeholder="vazio = sem validade" />
                  <p className="text-xs text-slate-500 dark:text-slate-400">Ex.: 12 para recertificação anual. Aparece no certificado e gera alertas 30 e 7 dias antes.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cf-prazo">Prazo para concluir (dias após a inscrição)</Label>
                  <Input id="cf-prazo" type="number" min="1" step="1" value={form.prazo_dias} onChange={(e) => set('prazo_dias', e.target.value)} placeholder="vazio = sem prazo" />
                  <p className="text-xs text-slate-500 dark:text-slate-400">Passado o prazo, o aluno aparece como "atrasado" na matriz e recebe lembretes.</p>
                </div>
              </div>
              <div className="grid gap-3 rounded-md border px-3 py-2 dark:border-slate-700 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Tipo de formação</Label>
                  <Select value={form.tipo_formacao} onValueChange={(v) => set('tipo_formacao', v)} searchable={false} options={[{ value: 'inicial', label: 'Formação inicial' }, { value: 'refrescamento', label: 'Refrescamento (recorrente)' }]} />
                </div>
                {form.tipo_formacao === 'refrescamento' && (
                  <div className="space-y-1.5">
                    <Label>Refrescamento do curso</Label>
                    <Select value={form.curso_base_id || ''} onValueChange={(v) => set('curso_base_id', v)} placeholder="Escolha o curso inicial…" options={cursosBase.map(c => ({ value: c.id, label: c.titulo }))} />
                  </div>
                )}
                <p className="text-xs text-slate-500 dark:text-slate-400 sm:col-span-2">{form.tipo_formacao === 'refrescamento' ? 'Concluir este curso renova a validade do curso inicial na matriz e no certificado. Quem tem a certificação a expirar é encaminhado para aqui em vez de repetir o curso completo. Sem validade própria, usa a do curso inicial.' : 'Curso completo, feito pela primeira vez. Pode depois criar um curso de refrescamento, mais curto, ligado a este.'}</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cf-creditos">Fontes / créditos do curso</Label>
                <Input id="cf-creditos" value={form.creditos || ''} onChange={(e) => set('creditos', e.target.value)} placeholder="Normas, documentos e autores em que o curso se baseia" />
              </div>
              <div className="flex items-center justify-between rounded-md border px-3 py-2 dark:border-slate-700">
                <div>
                  <Label htmlFor="cf-obrig-todos" className="cursor-pointer">Obrigatório para todos os colaboradores</Label>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Quem não estiver inscrito aparece "em falta" na matriz e é notificado.</p>
                </div>
                <Switch id="cf-obrig-todos" checked={form.obrigatorio_todos} onCheckedChange={(v) => set('obrigatorio_todos', !!v)} />
              </div>
              <div className="flex items-center justify-between rounded-md border px-3 py-2 dark:border-slate-700">
                <div>
                  <Label htmlFor="cf-sync-lic" className="cursor-pointer">Sincronizar com Licenças de Condução (Safety)</Label>
                  <p className="text-xs text-slate-500 dark:text-slate-400">A licença de condução no lado ar (Safety) só é criada ou renovada quando o colaborador tem certificados válidos de todos os cursos com esta opção ligada (hoje: Safety/SGSO e Condução no Lado Ar). A validade é a menor dos certificados.</p>
                </div>
                <Switch id="cf-sync-lic" checked={form.sincroniza_licenca_conducao} onCheckedChange={(v) => set('sincroniza_licenca_conducao', !!v)} />
              </div>
              {!form.obrigatorio_todos && (
                <div className="space-y-1.5">
                  <Label>Obrigatório para os perfis</Label>
                  {perfisOpcoes.length === 0 ? <p className="text-xs text-slate-500">Sem perfis disponíveis.</p> : (
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {perfisOpcoes.map(p => {
                        const on = form.obrigatorio_perfis.map(x => String(x).toLowerCase()).includes(String(p.value).toLowerCase());
                        return (
                          <label key={p.value} className="flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
                            <Checkbox checked={on} onCheckedChange={(v) => set('obrigatorio_perfis', v ? [...form.obrigatorio_perfis, p.value] : form.obrigatorio_perfis.filter(x => String(x).toLowerCase() !== String(p.value).toLowerCase()))} aria-label={p.label} />
                            <span>{p.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3 dark:border-slate-700 sm:col-span-2">
              <div>
                <Label htmlFor="cf-pub" className="cursor-pointer">Publicado no catálogo</Label>
                <p className="text-xs text-slate-500 dark:text-slate-400">Rascunhos só são visíveis na gestão.</p>
              </div>
              <Switch id="cf-pub" checked={form.publicado} onCheckedChange={(v) => set('publicado', v)} />
            </div>
          </div>

          {erro && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{erro}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={aGuardar}>Cancelar</Button>
            <Button type="submit" disabled={aGuardar}>
              {aGuardar && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {curso ? 'Guardar' : 'Criar curso'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
