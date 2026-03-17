import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { User, Mail, Calendar, Wrench } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { OrdemServico } from '@/entities/OrdemServico';
import useSubmitGuard from '@/hooks/useSubmitGuard';

export default function AtribuirOSModal({ isOpen, onClose, ordem, onSuccess, onAssigned }) {
  const [formData, setFormData] = useState({
    responsavel_email: '',
    prazo_estimado: '',
    observacoes_atribuicao: '',
    cc_emails: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { guardedSubmit } = useSubmitGuard();
  const [availableUsers, setAvailableUsers] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      loadUsers();
      setFormData({
        responsavel_email: '',
        prazo_estimado: '',
        observacoes_atribuicao: '',
        cc_emails: ''
      });
    }
  }, [isOpen]);

  const loadUsers = async () => {
    try {
      const { User } = await import('@/entities/User');
      const users = await User.list();
      const filteredUsers = users.filter((u) =>
      u.email && ['infraestrutura', 'chefe', 'administrador'].includes(u.perfil)
      );
      setAvailableUsers(filteredUsers);
    } catch (error) {
      console.error('Erro ao carregar utilizadores:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.responsavel_email) {
      alert('Email do responsável é obrigatório');
      return;
    }

    guardedSubmit(async () => {
      setIsSubmitting(true);
      try {
        const updateData = {
          responsavel_manutencao: formData.responsavel_email,
          status: 'atribuida',
          data_atribuicao: new Date().toISOString(),
          observacoes_atribuicao: formData.observacoes_atribuicao
        };

        if (formData.prazo_estimado) {
          updateData.prazo_estimado = formData.prazo_estimado;
        }

        await OrdemServico.update(ordem.id, updateData);
        const assignedUser = availableUsers.find(u => u.email === formData.responsavel_email);
        if (onAssigned) onAssigned(ordem, formData.responsavel_email, assignedUser?.full_name || formData.responsavel_email);
        onSuccess();
        onClose();
      } catch (error) {
        console.error('Erro ao atribuir OS:', error);
        alert('Erro ao atribuir ordem de serviço');
      } finally {
        setIsSubmitting(false);
      }
    });
  };

  const filteredUsers = availableUsers.filter((user) =>
  user.email?.toLowerCase().includes(formData.responsavel_email.toLowerCase()) ||
  user.full_name?.toLowerCase().includes(formData.responsavel_email.toLowerCase())
  );

  if (!ordem) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-orange-600" />
            Atribuir OS - {ordem.numero_ordem}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Alert>
            <AlertDescription>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <p><strong>Título:</strong> {ordem.titulo}</p>
                <p><strong>Prioridade:</strong> {ordem.prioridade}</p>
                <p><strong>Categoria:</strong> {ordem.categoria_manutencao}</p>
                <p><strong>Data:</strong> {format(new Date(ordem.created_date), 'dd/MM/yyyy', { locale: pt })}</p>
              </div>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="responsavel_email" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Email do Responsável *
            </Label>
            <div className="relative">
              <Input
                id="responsavel_email"
                type="email"
                placeholder="responsavel@empresa.com"
                value={formData.responsavel_email}
                onChange={(e) => {
                  setFormData({ ...formData, responsavel_email: e.target.value });
                  setShowSuggestions(e.target.value.length > 0);
                }}
                onFocus={() => setShowSuggestions(formData.responsavel_email.length > 0)}
                required />

              {showSuggestions && filteredUsers.length > 0 &&
              <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-32 overflow-y-auto">
                  {filteredUsers.slice(0, 5).map((user) =>
                <div
                  key={user.email}
                  className="px-3 py-2 hover:bg-slate-50 cursor-pointer text-sm"
                  onClick={() => {
                    setFormData({ ...formData, responsavel_email: user.email });
                    setShowSuggestions(false);
                  }}>

                      <div className="font-medium">{user.full_name}</div>
                      <div className="text-slate-500">{user.email}</div>
                    </div>
                )}
                </div>
              }
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="prazo_estimado" className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Prazo Estimado
              </Label>
              <Input
                id="prazo_estimado"
                type="date"
                value={formData.prazo_estimado}
                onChange={(e) => setFormData({ ...formData, prazo_estimado: e.target.value })} />

            </div>
            <div className="space-y-2">
              <Label htmlFor="cc_emails" className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                CC (opcional)
              </Label>
              <Input
                id="cc_emails"
                type="text"
                placeholder="email1@empresa.com"
                value={formData.cc_emails}
                onChange={(e) => setFormData({ ...formData, cc_emails: e.target.value })} />

            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes_atribuicao">Observações</Label>
            <Textarea
              id="observacoes_atribuicao"
              placeholder="Instruções específicas..."
              value={formData.observacoes_atribuicao}
              onChange={(e) => setFormData({ ...formData, observacoes_atribuicao: e.target.value })}
              rows={3} />

          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
              {isSubmitting ? 'A Atribuir...' : 'Atribuir Ordem'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>);

}