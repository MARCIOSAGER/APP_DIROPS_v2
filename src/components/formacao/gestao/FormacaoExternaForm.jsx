import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Select from '@/components/ui/select';
import { Loader2, Upload, FileText, X } from 'lucide-react';
import { FormacaoExterna } from '@/entities/FormacaoExterna';
import { uploadFicheiro } from './ImagemUpload';

export const TIPO_EXTERNA = { externa: 'Externa (outra entidade)', presencial: 'Presencial (SGA)', outra: 'Outra' };
export const RESULTADO_EXTERNA = { aprovado: 'Aprovado', participou: 'Participou (sem avaliação)', reprovado: 'Reprovado' };

const VAZIO = { titulo: '', entidade: '', tipo: 'externa', curso_id: '', data_realizacao: '', valido_ate: '', carga_horaria: '', resultado: 'aprovado', numero_certificado: '', certificado_url: null, observacoes: '' };
const soData = (v) => (v ? String(v).slice(0, 10) : '');

// Registo de formação presencial/externa de um colaborador. Com "equivale ao curso" conta na matriz.
export default function FormacaoExternaForm({ isOpen, onClose, registo, aluno, cursos = [], user, onSaved }) {
  const [form, setForm] = useState(VAZIO);
  const [aGuardar, setAGuardar] = useState(false);
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    setErro('');
    setForm(registo ? { ...VAZIO, ...registo, curso_id: registo.curso_id || '', data_realizacao: soData(registo.data_realizacao), valido_ate: soData(registo.valido_ate), carga_horaria: registo.carga_horaria ?? '' } : VAZIO);
  }, [isOpen, registo]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const cursoSel = cursos.find(c => c.id === form.curso_id);

  const escolherFicheiro = async (e) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    setAEnviar(true);
    try { set('certificado_url', await uploadFicheiro(file)); }
    catch (err) { setErro(err?.message || String(err)); }
    finally { setAEnviar(false); }
  };

  const submeter = async (e) => {
    e.preventDefault();
    if (!form.titulo.trim()) { setErro('Indique o título da formação.'); return; }
    if (!form.data_realizacao) { setErro('Indique a data de realização.'); return; }
    setAGuardar(true); setErro('');
    const payload = {
      aluno_email: String(aluno.email).toLowerCase(), aluno_nome: aluno.full_name || aluno.nome || null,
      titulo: form.titulo.trim(), entidade: form.entidade.trim() || null, tipo: form.tipo, curso_id: form.curso_id || null,
      data_realizacao: form.data_realizacao, valido_ate: form.valido_ate || null,
      carga_horaria: form.carga_horaria === '' ? null : Number(String(form.carga_horaria).replace(',', '.')) || null,
      resultado: form.resultado, numero_certificado: form.numero_certificado.trim() || null, certificado_url: form.certificado_url || null,
      observacoes: form.observacoes.trim() || null, updated_by: user?.email || null,
    };
    try {
      const saved = registo ? await FormacaoExterna.update(registo.id, payload) : await FormacaoExterna.create({ ...payload, created_by: user?.email || null, empresa_id: user?.empresa_id || null });
      onSaved?.(saved, !registo);
      onClose();
    } catch (err) { setErro(err?.message || String(err)); }
    finally { setAGuardar(false); }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o && !aGuardar) onClose(); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={submeter} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{registo ? 'Editar formação externa' : 'Registar formação externa'}</DialogTitle>
            <DialogDescription>{aluno?.full_name || aluno?.email}. Formação presencial ou noutra entidade; se equivaler a um curso do catálogo, conta na matriz como concluído.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="fe-titulo">Título <span className="text-red-600">*</span></Label><Input id="fe-titulo" value={form.titulo} onChange={(e) => set('titulo', e.target.value)} placeholder="Ex.: Mercadorias Perigosas — Cat. 6" autoFocus /></div>
            <div className="space-y-1.5"><Label htmlFor="fe-ent">Entidade formadora</Label><Input id="fe-ent" value={form.entidade} onChange={(e) => set('entidade', e.target.value)} placeholder="ANAC, IATA, SGA…" /></div>
            <div className="space-y-1.5"><Label>Tipo</Label><Select value={form.tipo} onValueChange={(v) => set('tipo', v)} searchable={false} options={Object.entries(TIPO_EXTERNA).map(([value, label]) => ({ value, label }))} /></div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Equivale ao curso do catálogo (opcional)</Label>
              <Select value={form.curso_id || ''} onValueChange={(v) => set('curso_id', v === '__nenhum' ? '' : v)} placeholder="Nenhum — só fica no histórico" options={[{ value: '__nenhum', label: 'Nenhum — só fica no histórico' }, ...cursos.map(c => ({ value: c.id, label: c.titulo }))]} />
              {cursoSel?.validade_meses && !form.valido_ate && <p className="text-xs text-slate-500 dark:text-slate-400">Validade calculada automaticamente: {cursoSel.validade_meses} meses após a data de realização.</p>}
            </div>
            <div className="space-y-1.5"><Label htmlFor="fe-data">Data de realização <span className="text-red-600">*</span></Label><Input id="fe-data" type="date" value={form.data_realizacao} onChange={(e) => set('data_realizacao', e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="fe-val">Válido até</Label><Input id="fe-val" type="date" value={form.valido_ate} onChange={(e) => set('valido_ate', e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="fe-horas">Carga horária (h)</Label><Input id="fe-horas" inputMode="decimal" value={form.carga_horaria} onChange={(e) => set('carga_horaria', e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Resultado</Label><Select value={form.resultado} onValueChange={(v) => set('resultado', v)} searchable={false} options={Object.entries(RESULTADO_EXTERNA).map(([value, label]) => ({ value, label }))} /></div>
            <div className="space-y-1.5"><Label htmlFor="fe-num">Nº do certificado</Label><Input id="fe-num" value={form.numero_certificado} onChange={(e) => set('numero_certificado', e.target.value)} /></div>
            <div className="space-y-1.5">
              <Label>Certificado (PDF ou imagem)</Label>
              <div className="flex items-center gap-2">
                <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={escolherFicheiro} aria-label="Carregar certificado" />
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={aEnviar}>{aEnviar ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}{form.certificado_url ? 'Substituir' : 'Carregar'}</Button>
                {form.certificado_url && <><a href={form.certificado_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-blue-700 underline dark:text-blue-300"><FileText className="h-4 w-4" aria-hidden="true" />Ver</a><Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Remover certificado" onClick={() => set('certificado_url', null)}><X className="h-4 w-4" /></Button></>}
              </div>
            </div>
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="fe-obs">Observações</Label><Textarea id="fe-obs" rows={2} value={form.observacoes} onChange={(e) => set('observacoes', e.target.value)} /></div>
          </div>
          {erro && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{erro}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={aGuardar}>Cancelar</Button>
            <Button type="submit" disabled={aGuardar}>{aGuardar && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}{registo ? 'Guardar' : 'Registar'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
