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
import { useI18n } from '@/components/lib/i18n';

export default function AtribuirOSModal({ isOpen, onClose, ordem, onSuccess, onAssigned }) {
  const { t } = useI18n();
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
      const empId = ordem?.empresa_id;
      const users = empId
        ? await User.filter({ empresa_id: empId })
        : await User.list();
      const filteredUsers = users.filter((u) =>
        u.email && u.status !== 'inativo' &&
        u.perfis?.some(p => ['infraestrutura', 'chefe', 'administrador'].includes(p))
      );
      setAvailableUsers(filteredUsers);
    } catch (error) {
      console.error('Erro ao carregar utilizadores:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.responsavel_email) {
      alert(t('atribuirOS.emailObrigatorio'));
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
        alert(t('atribuirOS.erroAtribuir'));
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
            {t('atribuirOS.titulo')} - {ordem.numero_ordem}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Alert>
            <AlertDescription>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <p><strong>{t('atribuirOS.tituloLabel')}</strong> {ordem.titulo}</p>
                <p><strong>{t('atribuirOS.prioridadeLabel')}</strong> {ordem.prioridade}</p>
                <p><strong>{t('atribuirOS.categoriaLabel')}</strong> {ordem.categoria_manutencao}</p>
                <p><strong>{t('atribuirOS.dataLabel')}</strong> {(ordem.data_abertura || ordem.created_date) ? format(new Date(ordem.data_abertura || ordem.created_date), 'dd/MM/yyyy', { locale: pt }) : 'N/A'}</p>
              </div>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="responsavel_email" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              {t('atribuirOS.emailResponsavel')}
            </Label>
            <div className="relative">
              <Input
                id="responsavel_email"
                type="email"
                placeholder={t('atribuirOS.emailPlaceholder')}
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
                {t('atribuirOS.prazoEstimado')}
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
                {t('atribuirOS.ccOpcional')}
              </Label>
              <Input
                id="cc_emails"
                type="text"
                placeholder={t('atribuirOS.ccPlaceholder')}
                value={formData.cc_emails}
                onChange={(e) => setFormData({ ...formData, cc_emails: e.target.value })} />

            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes_atribuicao">{t('atribuirOS.observacoes')}</Label>
            <Textarea
              id="observacoes_atribuicao"
              placeholder={t('atribuirOS.observacoesPlaceholder')}
              value={formData.observacoes_atribuicao}
              onChange={(e) => setFormData({ ...formData, observacoes_atribuicao: e.target.value })}
              rows={3} />

          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('atribuirOS.cancelar')}
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
              {isSubmitting ? t('atribuirOS.atribuindo') : t('atribuirOS.atribuirOrdem')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>);

}