import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Loader2, PenLine } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { CertificadoAssinante } from '@/entities/CertificadoAssinante';
import { useAssinantes } from '@/hooks/useGestaoFormacao';
import ImagemUpload from './ImagemUpload';

// Lista de signatários (globais quando cursoId=null; específicos quando cursoId definido).
export function AssinantesLista({ cursoId = null, assinantes = [], user, vazio = 'Ainda não há signatários.' }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const lista = assinantes.filter(a => (a.curso_id || null) === cursoId).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  const [form, setForm] = useState({ open: false, assinante: null });
  const [confirm, setConfirm] = useState(null);
  const [ocupado, setOcupado] = useState(null);
  const refrescar = () => qc.invalidateQueries({ queryKey: ['certificado_assinante'] });

  const mover = async (idx, dir) => {
    const j = idx + dir; if (j < 0 || j >= lista.length) return;
    setOcupado(lista[idx].id);
    try {
      const nova = lista.map((x, k) => ({ id: x.id, antes: x.ordem, ordem: k + 1 }));
      [nova[idx].ordem, nova[j].ordem] = [nova[j].ordem, nova[idx].ordem];
      await Promise.all(nova.filter(x => x.ordem !== x.antes).map(x => CertificadoAssinante.update(x.id, { ordem: x.ordem })));
      await refrescar();
    } catch (e) { toast({ title: 'Não foi possível reordenar', description: e?.message, variant: 'destructive' }); }
    finally { setOcupado(null); }
  };
  const alternar = async (a) => {
    setOcupado(a.id);
    try { await CertificadoAssinante.update(a.id, { ativo: !a.ativo }); await refrescar(); }
    catch (e) { toast({ title: 'Não foi possível actualizar', description: e?.message, variant: 'destructive' }); }
    finally { setOcupado(null); }
  };
  const apagar = async () => {
    const a = confirm; setConfirm(null); setOcupado(a.id);
    try { await CertificadoAssinante.delete(a.id); toast({ title: 'Signatário removido' }); await refrescar(); }
    catch (e) { toast({ title: 'Não foi possível remover', description: e?.message, variant: 'destructive' }); }
    finally { setOcupado(null); }
  };

  return (
    <div className="space-y-3">
      {lista.length === 0 ? (
        <p className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">{vazio}</p>
      ) : (
        <ul className="divide-y rounded-md border dark:divide-slate-800 dark:border-slate-700">
          {lista.map((a, i) => (
            <li key={a.id} className={`flex items-center gap-3 px-3 py-2.5 ${a.ativo === false ? 'opacity-60' : ''}`}>
              <div className="flex h-10 w-20 shrink-0 items-center justify-center overflow-hidden rounded border bg-white dark:border-slate-700">
                {a.assinatura_url ? <img src={a.assinatura_url} alt="" className="max-h-full max-w-full object-contain" /> : <PenLine className="h-4 w-4 text-slate-300" aria-hidden="true" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{a.nome}</p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">{a.cargo || 'Sem cargo'}</p>
              </div>
              <div className="flex items-center gap-2 pr-1"><Label htmlFor={`ass-${a.id}`} className="text-xs text-slate-500">Activo</Label><Switch id={`ass-${a.id}`} checked={a.ativo !== false} disabled={ocupado === a.id} onCheckedChange={() => alternar(a)} /></div>
              <div className="flex shrink-0 items-center gap-0.5">
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Subir" disabled={i === 0 || !!ocupado} onClick={() => mover(i, -1)}>{ocupado === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}</Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Descer" disabled={i === lista.length - 1 || !!ocupado} onClick={() => mover(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Editar" onClick={() => setForm({ open: true, assinante: a })}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700" aria-label="Remover" onClick={() => setConfirm(a)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Button variant="outline" size="sm" onClick={() => setForm({ open: true, assinante: null })}><Plus className="h-4 w-4" aria-hidden="true" />Adicionar signatário</Button>

      <AssinanteForm
        isOpen={form.open}
        onClose={() => setForm({ open: false, assinante: null })}
        assinante={form.assinante}
        cursoId={cursoId}
        proximaOrdem={(lista.at(-1)?.ordem ?? 0) + 1}
        user={user}
        onSaved={() => { toast({ title: form.assinante ? 'Signatário actualizado' : 'Signatário adicionado' }); refrescar(); }}
      />
      <ConfirmModal isOpen={!!confirm} onClose={() => setConfirm(null)} onConfirm={apagar} variant="destructive" title="Remover signatário?" confirmText="Remover"
        message={`"${confirm?.nome}" deixa de aparecer nos próximos certificados. Os já emitidos não mudam.`} />
    </div>
  );
}

function AssinanteForm({ isOpen, onClose, assinante, cursoId, proximaOrdem, user, onSaved }) {
  const [form, setForm] = useState({ nome: '', cargo: '', assinatura_url: null, ativo: true });
  const [aGuardar, setAGuardar] = useState(false);
  const [erro, setErro] = useState('');
  useEffect(() => {
    if (!isOpen) return;
    setErro('');
    setForm({ nome: assinante?.nome || '', cargo: assinante?.cargo || '', assinatura_url: assinante?.assinatura_url || null, ativo: assinante ? assinante.ativo !== false : true });
  }, [isOpen, assinante]);

  const submeter = async (e) => {
    e.preventDefault();
    if (!form.nome.trim()) { setErro('O nome é obrigatório.'); return; }
    setAGuardar(true); setErro('');
    const payload = { nome: form.nome.trim(), cargo: form.cargo.trim() || null, assinatura_url: form.assinatura_url || null, ativo: !!form.ativo };
    try {
      if (assinante) await CertificadoAssinante.update(assinante.id, payload);
      else await CertificadoAssinante.create({ ...payload, curso_id: cursoId, ordem: proximaOrdem, created_by: user?.email || null, empresa_id: user?.empresa_id || null });
      onSaved?.(); onClose();
    } catch (err) { setErro(err?.message || String(err)); }
    finally { setAGuardar(false); }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o && !aGuardar) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submeter} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{assinante ? 'Editar signatário' : 'Novo signatário'}</DialogTitle>
            <DialogDescription>Quem assina o certificado (instrutor, director). A imagem da assinatura é opcional.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5"><Label htmlFor="asf-nome">Nome <span className="text-red-600">*</span></Label><Input id="asf-nome" value={form.nome} onChange={(e) => setForm(f => ({ ...f, nome: e.target.value }))} required autoFocus /></div>
          <div className="space-y-1.5"><Label htmlFor="asf-cargo">Cargo</Label><Input id="asf-cargo" value={form.cargo} onChange={(e) => setForm(f => ({ ...f, cargo: e.target.value }))} placeholder="Ex.: Director de Operações" /></div>
          <ImagemUpload label="Assinatura (imagem)" value={form.assinatura_url} onChange={(v) => setForm(f => ({ ...f, assinatura_url: v }))} ajuda="PNG com fundo transparente, assinatura a preto/azul." altura="h-16" />
          <div className="flex items-center justify-between rounded-md border px-3 py-2 dark:border-slate-700"><Label htmlFor="asf-ativo" className="cursor-pointer">Activo</Label><Switch id="asf-ativo" checked={form.ativo} onCheckedChange={(v) => setForm(f => ({ ...f, ativo: v }))} /></div>
          {erro && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{erro}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={aGuardar}>Cancelar</Button>
            <Button type="submit" disabled={aGuardar}>{aGuardar && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}{assinante ? 'Guardar' : 'Adicionar'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Separador "Signatários" da gestão: os globais (entram em todos os cursos que não os desliguem).
export default function AssinantesGlobais({ user }) {
  const { data: assinantes = [], isLoading } = useAssinantes();
  return (
    <Card className="dark:border-slate-800 dark:bg-slate-900">
      <CardHeader>
        <CardTitle className="text-base">Signatários globais</CardTitle>
        <CardDescription>Assinam todos os certificados por defeito (máx. 4 por certificado, pela ordem abaixo). Cada curso pode desligá-los ou juntar signatários próprios no seu separador Certificado.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-sm text-slate-500">A carregar…</p> : <AssinantesLista cursoId={null} assinantes={assinantes} user={user} vazio="Ainda não há signatários globais. Adicione, por exemplo, o Director de Operações." />}
      </CardContent>
    </Card>
  );
}
