import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Mail } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { enviarLembrete, ENTREGAVEL } from '@/lib/formacaoLembrete';

// Envia lembretes manuais a um ou vários colaboradores (um email por pessoa) com mensagem opcional.
// alvos: [{ curso, matricula?, email, nome, externas? }]
export default function LembreteDialog({ isOpen, onClose, alvos = [], user, onDone }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [mensagem, setMensagem] = useState('');
  const [aEnviar, setAEnviar] = useState(false);
  const [progresso, setProgresso] = useState(0);
  useEffect(() => { if (isOpen) { setMensagem(''); setProgresso(0); } }, [isOpen]);

  const entregaveis = alvos.filter(a => ENTREGAVEL.test(a.email || a.matricula?.aluno_email || ''));
  const um = alvos.length === 1 ? alvos[0] : null;

  const enviar = async () => {
    setAEnviar(true);
    let ok = 0, falhas = 0;
    for (const a of alvos) {
      try { const r = await enviarLembrete({ curso: a.curso, matricula: a.matricula || null, email: a.email || a.matricula?.aluno_email, nome: a.nome, por: user?.email, mensagem, externas: a.externas || [] }); if (r.entregue) ok++; }
      catch { falhas++; }
      setProgresso(p => p + 1);
    }
    setAEnviar(false);
    qc.invalidateQueries({ queryKey: ['notificacao_formacao'] });
    const naoEntregues = alvos.length - entregaveis.length;
    toast({ title: ok === 1 ? 'Lembrete enviado' : `${ok} lembretes enviados`, description: [naoEntregues ? `${naoEntregues} sem entrega (email fora de @sga.co.ao, ficou só registado)` : null, falhas ? `${falhas} falharam` : null].filter(Boolean).join(' · ') || undefined, variant: falhas && !ok ? 'destructive' : undefined });
    onDone?.({ ok, falhas });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o && !aEnviar) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{um ? 'Enviar lembrete' : `Enviar ${alvos.length} lembretes`}</DialogTitle>
          <DialogDescription>
            {um ? <>{um.nome || um.email || um.matricula?.aluno_email} · <strong>{um.curso?.titulo}</strong>. </> : <>Um email individual por colaborador, com o estado de cada um no curso. </>}
            O texto é gerado conforme o estado (em falta, por concluir, a expirar, expirado).{alvos.length !== entregaveis.length && <> <span className="text-amber-700 dark:text-amber-300">{alvos.length - entregaveis.length} {alvos.length - entregaveis.length === 1 ? 'endereço não é' : 'endereços não são'} @sga.co.ao e não {alvos.length - entregaveis.length === 1 ? 'será entregue' : 'serão entregues'} (fica registado).</span></>}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5"><Label htmlFor="lb-msg">Mensagem adicional (opcional)</Label><Textarea id="lb-msg" rows={3} value={mensagem} onChange={(e) => setMensagem(e.target.value)} placeholder="Ex.: A auditoria da ANAC é em Novembro; conclua até dia 15." /></div>
        {aEnviar && alvos.length > 1 && <p className="text-xs text-slate-500" role="status">A enviar… {progresso}/{alvos.length}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={aEnviar}>Cancelar</Button>
          <Button onClick={enviar} disabled={aEnviar || alvos.length === 0}>{aEnviar ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Mail className="h-4 w-4" aria-hidden="true" />}Enviar{alvos.length > 1 ? ` (${alvos.length})` : ''}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
