import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Info, Share2, UserCheck } from 'lucide-react';

export default function InfoConviteModal({ isOpen, onClose }) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="w-6 h-6 text-blue-600" />
            Como Convidar um Novo Utilizador
          </DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4 text-sm text-slate-700">
          <p className="font-semibold">Para adicionar um novo utilizador à aplicação, siga estes 2 passos simples:</p>
          
          <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg border">
            <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-blue-100 text-blue-600">
                    <Share2 className="w-5 h-5" />
                </div>
            </div>
            <div>
              <h4 className="font-bold text-slate-800">Passo 1: Enviar o Convite Oficial</h4>
              <p>Utilize o botão <strong className="text-blue-700">"Share"</strong> no canto superior direito do ecrã para enviar um convite da plataforma para o e-mail do novo utilizador. É este passo que cria a conta de acesso.</p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg border">
            <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-green-100 text-green-600">
                    <UserCheck className="w-5 h-5" />
                </div>
            </div>
            <div>
                <h4 className="font-bold text-slate-800">Passo 2: Configurar as Permissões</h4>
                <p>Depois de o utilizador aceitar o convite e definir a sua senha, ele aparecerá na lista de "Utilizadores Ativos". Encontre-o e clique em <strong className="text-green-700">"Editar"</strong> para definir o seu Perfil, Aeroportos de Acesso e outras permissões.</p>
            </div>
          </div>
          
        </div>
        <DialogFooter>
          <Button onClick={onClose} className="w-full">Entendido</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}