import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Layers, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { Modulo } from '@/entities/Modulo';
import { Aula } from '@/entities/Aula';
import { TIPO_AULA, fmtMinutos, ordenarConteudo } from '../formacaoUtils';
import { ModuloForm, AulaForm } from './ConteudoForms';

// Editor de conteúdo do curso: módulos > aulas, com criar/editar/apagar/reordenar.
export default function ConteudoEditor({ curso, modulos = [], aulas = [] }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { arvore } = useMemo(() => ordenarConteudo(modulos, aulas), [modulos, aulas]);
  const [moduloForm, setModuloForm] = useState({ open: false, modulo: null });
  const [aulaForm, setAulaForm] = useState({ open: false, aula: null, moduloId: null });
  const [confirm, setConfirm] = useState(null); // { tipo: 'modulo'|'aula', item }
  const [aMover, setAMover] = useState(null);

  const refrescar = () => qc.invalidateQueries({ queryKey: ['curso', curso.id, 'conteudo'] }).then(() => qc.invalidateQueries({ queryKey: ['aula'] }));

  // Troca a ordem com o vizinho (normaliza 1..n antes, para listas com ordens repetidas).
  const mover = async (Entidade, lista, idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= lista.length) return;
    setAMover(lista[idx].id);
    try {
      const nova = lista.map((x, k) => ({ id: x.id, antes: x.ordem, ordem: k + 1 }));
      [nova[idx].ordem, nova[j].ordem] = [nova[j].ordem, nova[idx].ordem];
      await Promise.all(nova.filter(x => x.ordem !== x.antes).map(x => Entidade.update(x.id, { ordem: x.ordem })));
      await refrescar();
    } catch (e) {
      toast({ title: 'Não foi possível reordenar', description: e?.message, variant: 'destructive' });
    } finally {
      setAMover(null);
    }
  };

  const apagar = async () => {
    const { tipo, item } = confirm;
    setConfirm(null);
    try {
      if (tipo === 'modulo') await Modulo.delete(item.id); else await Aula.delete(item.id);
      toast({ title: tipo === 'modulo' ? 'Módulo apagado' : 'Aula apagada' });
      await refrescar();
    } catch (e) {
      toast({ title: 'Não foi possível apagar', description: e?.message, variant: 'destructive' });
    }
  };

  const proximaOrdemModulo = (arvore.at(-1)?.ordem ?? 0) + 1;
  const proximaOrdemAula = (moduloId) => ((arvore.find(m => m.id === moduloId)?.aulas.at(-1)?.ordem ?? 0) + 1);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {arvore.length} {arvore.length === 1 ? 'módulo' : 'módulos'} · {aulas.length} {aulas.length === 1 ? 'aula' : 'aulas'}
        </p>
        <Button onClick={() => setModuloForm({ open: true, modulo: null })}><Plus className="h-4 w-4" aria-hidden="true" />Novo módulo</Button>
      </div>

      {arvore.length === 0 ? (
        <Card className="border-dashed dark:border-slate-800 dark:bg-slate-900">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Layers className="h-8 w-8 text-slate-400" aria-hidden="true" />
            <p className="font-medium text-slate-900 dark:text-slate-100">Este curso ainda não tem conteúdo</p>
            <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">Comece por criar um módulo (ex.: "Introdução") e depois adicione as aulas.</p>
            <Button onClick={() => setModuloForm({ open: true, modulo: null })}><Plus className="h-4 w-4" aria-hidden="true" />Criar o primeiro módulo</Button>
          </CardContent>
        </Card>
      ) : (
        <ol className="space-y-4">
          {arvore.map((m, mi) => (
            <li key={m.id}>
              <Card className="dark:border-slate-800 dark:bg-slate-900">
                <CardContent className="p-0">
                  <div className="flex items-start gap-3 border-b p-4 dark:border-slate-800">
                    <span className="mt-0.5 w-7 shrink-0 text-sm font-semibold text-slate-400">{String(mi + 1).padStart(2, '0')}</span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100">{m.titulo}</h3>
                      {m.descricao && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{m.descricao}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <Button variant="ghost" size="icon" aria-label="Subir módulo" disabled={mi === 0 || !!aMover} onClick={() => mover(Modulo, arvore, mi, -1)}>{aMover === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}</Button>
                      <Button variant="ghost" size="icon" aria-label="Descer módulo" disabled={mi === arvore.length - 1 || !!aMover} onClick={() => mover(Modulo, arvore, mi, 1)}><ArrowDown className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" aria-label="Editar módulo" onClick={() => setModuloForm({ open: true, modulo: m })}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" aria-label="Apagar módulo" className="text-red-600 hover:text-red-700" onClick={() => setConfirm({ tipo: 'modulo', item: m })}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>

                  {m.aulas.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">Sem aulas neste módulo.</p>
                  ) : (
                    <ul className="divide-y dark:divide-slate-800">
                      {m.aulas.map((a, ai) => {
                        const T = TIPO_AULA[a.tipo] || TIPO_AULA.texto; const Icon = T.icon;
                        return (
                          <li key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                            <Icon className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm text-slate-800 dark:text-slate-200">{a.titulo}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">{T.label}{a.duracao_min ? ` · ${fmtMinutos(a.duracao_min)}` : ''}{a.tipo !== 'texto' && !a.conteudo_url ? ' · sem conteúdo' : ''}</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-0.5">
                              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Subir aula" disabled={ai === 0 || !!aMover} onClick={() => mover(Aula, m.aulas, ai, -1)}>{aMover === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}</Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Descer aula" disabled={ai === m.aulas.length - 1 || !!aMover} onClick={() => mover(Aula, m.aulas, ai, 1)}><ArrowDown className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Editar aula" onClick={() => setAulaForm({ open: true, aula: a, moduloId: m.id })}><Pencil className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700" aria-label="Apagar aula" onClick={() => setConfirm({ tipo: 'aula', item: a })}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <div className="border-t px-4 py-2 dark:border-slate-800">
                    <Button variant="ghost" size="sm" onClick={() => setAulaForm({ open: true, aula: null, moduloId: m.id })}><Plus className="h-4 w-4" aria-hidden="true" />Adicionar aula</Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      )}

      <ModuloForm
        isOpen={moduloForm.open}
        onClose={() => setModuloForm({ open: false, modulo: null })}
        curso={curso}
        modulo={moduloForm.modulo}
        proximaOrdem={proximaOrdemModulo}
        onSaved={() => { toast({ title: moduloForm.modulo ? 'Módulo actualizado' : 'Módulo criado' }); refrescar(); }}
      />
      <AulaForm
        isOpen={aulaForm.open}
        onClose={() => setAulaForm({ open: false, aula: null, moduloId: null })}
        curso={curso}
        modulos={arvore}
        aula={aulaForm.aula}
        moduloId={aulaForm.moduloId}
        proximaOrdem={proximaOrdemAula(aulaForm.aula?.modulo_id || aulaForm.moduloId)}
        onSaved={() => { toast({ title: aulaForm.aula ? 'Aula actualizada' : 'Aula criada' }); refrescar(); }}
      />
      <ConfirmModal
        isOpen={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={apagar}
        variant="destructive"
        title={confirm?.tipo === 'modulo' ? 'Apagar módulo?' : 'Apagar aula?'}
        confirmText="Apagar"
        message={confirm?.tipo === 'modulo'
          ? `"${confirm.item.titulo}" e as suas ${confirm.item.aulas?.length || 0} aulas serão apagados. O progresso dos alunos nessas aulas também. Esta acção não pode ser anulada.`
          : `"${confirm?.item?.titulo}" será apagada, incluindo o progresso dos alunos nela. Esta acção não pode ser anulada.`}
      />
    </div>
  );
}
