import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import Select from '@/components/ui/select';
import { Loader2, Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { Pergunta } from '@/entities/Pergunta';
import ImagemUpload from '../gestao/ImagemUpload';
import ZonasImagem from './ZonasImagem';
import { TIPOS_PERGUNTA, opcoesIniciais, validarPergunta, normalizarOpcoes, novoId } from './quizUtils';

const FAMILIA = (t) => (t === 'escolha_unica' || t === 'escolha_multipla' ? 'escolha' : t);

// Criar / editar uma pergunta do banco, com editor específico por tipo.
export default function PerguntaForm({ isOpen, onClose, pergunta, cursoId, categorias = [], user, onSaved }) {
  const [form, setForm] = useState(null);
  const [aGuardar, setAGuardar] = useState(false);
  const [erros, setErros] = useState([]);

  useEffect(() => {
    if (!isOpen) return;
    setErros([]);
    setForm(pergunta ? {
      tipo: pergunta.tipo, enunciado: pergunta.enunciado || '', imagem_url: pergunta.imagem_url || null, categoria: pergunta.categoria || '',
      pontos: pergunta.pontos ?? 1, explicacao: pergunta.explicacao || '', ativo: pergunta.ativo !== false, global: !pergunta.curso_id,
      opcoes: Array.isArray(pergunta.opcoes) && pergunta.opcoes.length ? pergunta.opcoes.map(o => ({ ...o })) : opcoesIniciais(pergunta.tipo),
    } : { tipo: 'escolha_unica', enunciado: '', imagem_url: null, categoria: '', pontos: 1, explicacao: '', ativo: true, global: !cursoId, opcoes: opcoesIniciais('escolha_unica') });
  }, [isOpen, pergunta, cursoId]);

  if (!form) return null;
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setOps = (fn) => setForm(f => ({ ...f, opcoes: fn(f.opcoes) }));
  const mudarTipo = (t) => setForm(f => ({ ...f, tipo: t, opcoes: FAMILIA(t) === FAMILIA(f.tipo) && FAMILIA(t) === 'escolha' ? f.opcoes.map(o => ({ ...o })) : opcoesIniciais(t) }));

  const submeter = async (e) => {
    e.preventDefault();
    const candidato = { ...form, opcoes: normalizarOpcoes(form.tipo, form.opcoes) };
    const errs = validarPergunta(candidato);
    if (form.tipo === 'escolha_unica' && candidato.opcoes.filter(o => o.correta).length > 1) errs.push('Escolha única só pode ter 1 opção correcta.');
    if (errs.length) { setErros(errs); return; }
    setAGuardar(true); setErros([]);
    const payload = {
      tipo: form.tipo, enunciado: form.enunciado.trim(), imagem_url: form.imagem_url || null, categoria: form.categoria.trim() || null,
      pontos: Number(form.pontos) > 0 ? Number(form.pontos) : 1, explicacao: form.explicacao.trim() || null, ativo: !!form.ativo,
      opcoes: candidato.opcoes, curso_id: form.global ? null : (cursoId || null), updated_by: user?.email || null,
    };
    try {
      const saved = pergunta ? await Pergunta.update(pergunta.id, payload) : await Pergunta.create({ ...payload, created_by: user?.email || null });
      onSaved?.(saved, !pergunta);
      onClose();
    } catch (err) {
      setErros([err?.message || String(err)]);
    } finally {
      setAGuardar(false);
    }
  };

  const T = TIPOS_PERGUNTA[form.tipo];

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o && !aGuardar) onClose(); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={submeter} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{pergunta ? 'Editar pergunta' : 'Nova pergunta'}</DialogTitle>
            <DialogDescription>{T?.ajuda}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={mudarTipo} searchable={false} options={Object.entries(TIPOS_PERGUNTA).map(([value, t]) => ({ value, label: t.label }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-cat">Categoria</Label>
              <Input id="pf-cat" list="pf-categorias" value={form.categoria} onChange={(e) => set('categoria', e.target.value)} placeholder="Ex.: RCR, Jet blast" />
              <datalist id="pf-categorias">{categorias.map(c => <option key={c} value={c} />)}</datalist>
              <p className="text-xs text-slate-500 dark:text-slate-400">Serve para sortear perguntas por tema.</p>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="pf-enun">Enunciado <span className="text-red-600">*</span></Label>
              <Textarea id="pf-enun" rows={3} value={form.enunciado} onChange={(e) => set('enunciado', e.target.value)} autoFocus />
            </div>
            <div className="sm:col-span-2">
              <ImagemUpload label={T?.imagem ? 'Imagem (obrigatória)' : 'Imagem no enunciado (opcional)'} value={form.imagem_url} onChange={(v) => set('imagem_url', v)} ajuda={T?.imagem ? 'O aluno responde sobre esta imagem. Use uma foto ou esquema nítido (recomendado ≥ 1200 px de largura).' : 'Foto, esquema ou captura; aparece por cima das opções.'} altura="h-20" />
            </div>
          </div>

          <div className="rounded-md border p-3 dark:border-slate-700">
            <p className="mb-2 text-sm font-medium text-slate-800 dark:text-slate-200">Resposta</p>
            {(form.tipo === 'escolha_unica' || form.tipo === 'escolha_multipla') && (
              <div className="space-y-2">
                {form.opcoes.map((o, i) => (
                  <div key={o.id} className="flex items-start gap-2">
                    {form.tipo === 'escolha_unica' ? (
                      <input type="radio" name="pf-correta" className="mt-2.5 h-4 w-4 accent-blue-600" checked={!!o.correta} onChange={() => setOps(ops => ops.map(x => ({ ...x, correta: x.id === o.id })))} aria-label={`Opção ${i + 1} correcta`} />
                    ) : (
                      <Checkbox className="mt-2.5" checked={!!o.correta} onCheckedChange={(v) => setOps(ops => ops.map(x => (x.id === o.id ? { ...x, correta: !!v } : x)))} aria-label={`Opção ${i + 1} correcta`} />
                    )}
                    <div className="flex-1 space-y-1">
                      <Input value={o.texto || ''} onChange={(e) => setOps(ops => ops.map(x => (x.id === o.id ? { ...x, texto: e.target.value } : x)))} placeholder={`Opção ${i + 1}`} />
                      <Input value={o.feedback || ''} onChange={(e) => setOps(ops => ops.map(x => (x.id === o.id ? { ...x, feedback: e.target.value } : x)))} placeholder="Feedback ao escolher esta opção (opcional)" className="h-8 text-xs" />
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="mt-1 h-8 w-8 text-red-600" aria-label="Remover opção" disabled={form.opcoes.length <= 2} onClick={() => setOps(ops => ops.filter(x => x.id !== o.id))}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" disabled={form.opcoes.length >= 8} onClick={() => setOps(ops => [...ops, { id: novoId(), texto: '', correta: false }])}><Plus className="h-4 w-4" aria-hidden="true" />Adicionar opção</Button>
                <p className="text-xs text-slate-500 dark:text-slate-400">{form.tipo === 'escolha_unica' ? 'Marque a opção correcta.' : 'Marque todas as correctas. O aluno perde pontos por cada errada seleccionada.'} As opções são baralhadas para o aluno se o quiz o permitir.</p>
              </div>
            )}
            {form.tipo === 'vf' && (
              <div className="flex flex-wrap gap-4">
                {form.opcoes.map(o => (
                  <label key={o.id} className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 dark:border-slate-700">
                    <input type="radio" name="pf-vf" className="h-4 w-4 accent-blue-600" checked={!!o.correta} onChange={() => setOps(ops => ops.map(x => ({ ...x, correta: x.id === o.id })))} />
                    <span className="text-sm">{o.texto} é a resposta correcta</span>
                  </label>
                ))}
              </div>
            )}
            {form.tipo === 'lacuna' && (
              <div className="space-y-2">
                {form.opcoes.map((o, i) => (
                  <div key={o.id} className="flex items-center gap-2">
                    <Input value={o.texto || ''} onChange={(e) => setOps(ops => ops.map(x => (x.id === o.id ? { ...x, texto: e.target.value } : x)))} placeholder={i === 0 ? 'Resposta correcta' : 'Outra forma aceite (sinónimo, sigla…)'} />
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-600" aria-label="Remover" disabled={form.opcoes.length <= 1} onClick={() => setOps(ops => ops.filter(x => x.id !== o.id))}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => setOps(ops => [...ops, { id: novoId(), texto: '' }])}><Plus className="h-4 w-4" aria-hidden="true" />Outra resposta aceite</Button>
                <p className="text-xs text-slate-500 dark:text-slate-400">A comparação ignora maiúsculas, acentos e espaços a mais.</p>
              </div>
            )}
            {form.tipo === 'numerica' && (
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5"><Label htmlFor="pf-valor">Valor correcto</Label><Input id="pf-valor" inputMode="decimal" value={form.opcoes[0]?.valor ?? ''} onChange={(e) => setOps(ops => [{ ...(ops[0] || {}), valor: e.target.value }])} placeholder="Ex.: 25" /></div>
                <div className="space-y-1.5"><Label htmlFor="pf-tol">Tolerância (±)</Label><Input id="pf-tol" inputMode="decimal" value={form.opcoes[0]?.tolerancia ?? 0} onChange={(e) => setOps(ops => [{ ...(ops[0] || {}), tolerancia: e.target.value }])} /></div>
                <div className="space-y-1.5"><Label htmlFor="pf-un">Unidade (opcional)</Label><Input id="pf-un" value={form.opcoes[0]?.unidade ?? ''} onChange={(e) => setOps(ops => [{ ...(ops[0] || {}), unidade: e.target.value }])} placeholder="km/h, mm, m" /></div>
              </div>
            )}
            {form.tipo === 'ordenacao' && (
              <div className="space-y-2">
                {form.opcoes.map((o, i) => (
                  <div key={o.id} className="flex items-center gap-2">
                    <span className="w-6 text-right text-sm text-slate-400">{i + 1}.</span>
                    <Input value={o.texto || ''} onChange={(e) => setOps(ops => ops.map(x => (x.id === o.id ? { ...x, texto: e.target.value } : x)))} placeholder={`Item na posição ${i + 1}`} />
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Subir" disabled={i === 0} onClick={() => setOps(ops => { const a = [...ops]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; return a; })}><ArrowUp className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Descer" disabled={i === form.opcoes.length - 1} onClick={() => setOps(ops => { const a = [...ops]; [a[i + 1], a[i]] = [a[i], a[i + 1]]; return a; })}><ArrowDown className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-600" aria-label="Remover" disabled={form.opcoes.length <= 2} onClick={() => setOps(ops => ops.filter(x => x.id !== o.id))}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" disabled={form.opcoes.length >= 10} onClick={() => setOps(ops => [...ops, { id: novoId(), texto: '' }])}><Plus className="h-4 w-4" aria-hidden="true" />Adicionar item</Button>
                <p className="text-xs text-slate-500 dark:text-slate-400">Escreva os itens pela ordem correcta. O aluno recebe-os baralhados e ganha pontos por cada posição certa.</p>
              </div>
            )}
            {form.tipo === 'correspondencia' && (
              <div className="space-y-2">
                {form.opcoes.map((o, i) => (
                  <div key={o.id} className="flex items-center gap-2">
                    <Input value={o.esquerda || ''} onChange={(e) => setOps(ops => ops.map(x => (x.id === o.id ? { ...x, esquerda: e.target.value } : x)))} placeholder={`Termo ${i + 1}`} />
                    <span className="text-slate-400">↔</span>
                    <Input value={o.direita || ''} onChange={(e) => setOps(ops => ops.map(x => (x.id === o.id ? { ...x, direita: e.target.value } : x)))} placeholder="Correspondência" />
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-600" aria-label="Remover" disabled={form.opcoes.length <= 2} onClick={() => setOps(ops => ops.filter(x => x.id !== o.id))}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" disabled={form.opcoes.length >= 10} onClick={() => setOps(ops => [...ops, { id: novoId(), esquerda: '', direita: '' }])}><Plus className="h-4 w-4" aria-hidden="true" />Adicionar par</Button>
                <p className="text-xs text-slate-500 dark:text-slate-400">O aluno vê os termos à esquerda e escolhe a correspondência numa lista baralhada.</p>
              </div>
            )}
            {(form.tipo === 'hotspot' || form.tipo === 'rotulos') && (
              form.imagem_url
                ? <ZonasImagem src={form.imagem_url} zonas={form.opcoes} onChange={(zs) => set('opcoes', zs)} comRotulo={form.tipo === 'rotulos'} />
                : <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">Carregue primeiro a imagem (acima) para desenhar as zonas.</p>
            )}
            {form.tipo === 'aberta' && (
              <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)]">
                <div className="space-y-1.5"><Label htmlFor="pf-max">Máx. de caracteres</Label><Input id="pf-max" type="number" min="50" step="50" value={form.opcoes[0]?.max_chars ?? 1000} onChange={(e) => setOps(ops => [{ ...(ops[0] || {}), max_chars: e.target.value }])} /></div>
                <div className="space-y-1.5"><Label htmlFor="pf-rub">Critérios de correcção (só o instrutor vê)</Label><Textarea id="pf-rub" rows={3} value={form.opcoes[0]?.rubrica ?? ''} onChange={(e) => setOps(ops => [{ ...(ops[0] || {}), rubrica: e.target.value }])} placeholder="Ex.: deve referir os 4 pilares do SGSO; 1 ponto por pilar…" /></div>
                <p className="text-xs text-slate-500 dark:text-slate-400 sm:col-span-2">A resposta fica pendente até ser corrigida em Avaliação → Resultados. Enquanto houver perguntas por corrigir, a nota do aluno é provisória.</p>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5"><Label htmlFor="pf-pontos">Pontos</Label><Input id="pf-pontos" type="number" min="0.5" step="0.5" value={form.pontos} onChange={(e) => set('pontos', e.target.value)} /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="pf-exp">Explicação (mostrada na revisão)</Label><Textarea id="pf-exp" rows={2} value={form.explicacao} onChange={(e) => set('explicacao', e.target.value)} placeholder="Porque é esta a resposta certa…" /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-md border px-3 py-2 dark:border-slate-700"><Label htmlFor="pf-ativo" className="cursor-pointer">Activa</Label><Switch id="pf-ativo" checked={form.ativo} onCheckedChange={(v) => set('ativo', v)} /></div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2 dark:border-slate-700">
              <div><Label htmlFor="pf-global" className="cursor-pointer">Global (todos os cursos)</Label><p className="text-xs text-slate-500 dark:text-slate-400">Desligado: só neste curso.</p></div>
              <Switch id="pf-global" checked={form.global} onCheckedChange={(v) => set('global', v)} disabled={!cursoId} />
            </div>
          </div>

          {erros.length > 0 && (
            <ul role="alert" className="list-disc space-y-0.5 rounded-md bg-red-50 px-3 py-2 pl-7 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{erros.map((e, i) => <li key={i}>{e}</li>)}</ul>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={aGuardar}>Cancelar</Button>
            <Button type="submit" disabled={aGuardar}>{aGuardar && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}{pergunta ? 'Guardar' : 'Criar pergunta'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
