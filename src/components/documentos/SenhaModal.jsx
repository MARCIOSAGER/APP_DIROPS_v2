import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, AlertTriangle } from 'lucide-react';
import useSubmitGuard from '@/hooks/useSubmitGuard';

export default function SenhaModal({ isOpen, onClose, onConfirm, titulo, tipo = 'pasta' }) {
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const { isSubmitting, guardedSubmit } = useSubmitGuard();

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!senha) {
      setErro('Por favor, insira a senha');
      return;
    }

    guardedSubmit(async () => {
      await onConfirm(senha);
      setSenha('');
      setErro('');
    });
  };

  const handleClose = () => {
    setSenha('');
    setErro('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-red-600" />
            Conteúdo Protegido
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-900">Área de Segurança</p>
              <p className="text-xs text-yellow-700 mt-1">
                Este {tipo} está protegido{tipo === 'pasta' ? 'a' : ''}. Insira a senha para acessar.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="senha-protecao" className="font-medium">
              Senha de Acesso
            </Label>
            <Input
              id="senha-protecao"
              type="password"
              value={senha}
              onChange={(e) => {
                setSenha(e.target.value);
                setErro('');
              }}
              placeholder="Digite a senha"
              className="text-center text-lg tracking-widest"
              autoFocus />

            {erro &&
            <p className="text-sm text-red-600">{erro}</p>
            }
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-red-600 text-slate-50 px-4 py-2 text-sm font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow h-9 hover:bg-red-700">
              <Lock className="w-4 h-4 mr-2" />
              {isSubmitting ? 'A verificar...' : 'Desbloquear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>);

}