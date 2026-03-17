import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { UserPlus, Save, X, Mail, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { User as UserEntity } from '@/entities/User';
import { sendEmailDirect } from '@/functions/sendEmailDirect';
import { emailTemplates } from '@/lib/emailTemplates';
import useSubmitGuard from '@/hooks/useSubmitGuard';

const PERFIL_OPTIONS = [
  { value: 'administrador', label: 'Administrador' },
  { value: 'operacoes', label: 'Operações' },
  { value: 'infraestrutura', label: 'Infraestrutura' },
  { value: 'credenciamento', label: 'Credenciamento' },
  { value: 'gestor_empresa', label: 'Gestor de Empresa' },
  { value: 'visualizador', label: 'Visualizador' }
];

export default function AddUserModal({ isOpen, onClose, aeroportos, empresas, onSuccess }) {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    telefone: '',
    perfis: ['visualizador'],
    empresa_id: '',
    aeroportos_acesso: []
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const { guardedSubmit } = useSubmitGuard();

  useEffect(() => {
    if (isOpen) {
      setFormData({
        full_name: '',
        email: '',
        telefone: '',
        perfis: ['visualizador'],
        empresa_id: '',
        aeroportos_acesso: []
      });
      setError(null);
    }
  }, [isOpen]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePerfilToggle = (perfil) => {
    setFormData(prev => {
      const current = prev.perfis || [];
      const newPerfis = current.includes(perfil)
        ? current.filter(p => p !== perfil)
        : [...current, perfil];
      return { ...prev, perfis: newPerfis };
    });
  };

  const handleAeroportoToggle = (aeroportoIcao) => {
    setFormData(prev => {
      const current = prev.aeroportos_acesso || [];
      const newAeroportos = current.includes(aeroportoIcao)
        ? current.filter(icao => icao !== aeroportoIcao)
        : [...current, aeroportoIcao];
      return { ...prev, aeroportos_acesso: newAeroportos };
    });
  };

  const handleSelectAllAeroportos = (checked) => {
    const aeroportosDaEmpresa = formData.empresa_id
      ? aeroportos.filter(a => a.empresa_id === formData.empresa_id)
      : aeroportos;
    setFormData(prev => ({
      ...prev,
      aeroportos_acesso: checked ? aeroportosDaEmpresa.map(a => a.codigo_icao) : []
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.full_name?.trim() || !formData.email?.trim()) {
      setError('Nome e email são obrigatórios.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      setError('Formato de email inválido.');
      return;
    }

    if (formData.telefone?.trim() && !/^[+]?[\d\s()-]{7,20}$/.test(formData.telefone.trim())) {
      setError('Formato de telefone inválido.');
      return;
    }

    if (formData.perfis.length === 0) {
      setError('Selecione pelo menos um perfil.');
      return;
    }

    if (formData.aeroportos_acesso.length === 0) {
      setError('Selecione pelo menos um aeroporto.');
      return;
    }

    guardedSubmit(async () => {
    setSaving(true);

    try {
      // 1. Create auth user (confirmed) + profile via admin Edge Function
      const tempPassword = crypto.randomUUID().slice(0, 16) + 'A1!';
      const cleanEmail = formData.email.trim().toLowerCase();
      const cleanName = formData.full_name.trim();
      const { data: fnData, error: fnError } = await supabase.functions.invoke('admin-user', {
        body: {
          action: 'create',
          email: cleanEmail,
          password: tempPassword,
          full_name: cleanName,
          perfis: formData.perfis,
          empresa_id: formData.empresa_id || null,
          aeroportos_acesso: [...new Set(formData.aeroportos_acesso)],
        },
      });

      if (fnError || fnData?.error) {
        const errMsg = fnData?.error || fnError?.message || 'Erro ao criar utilizador';
        if (errMsg.includes('already been registered') || errMsg.includes('already registered')) {
          setError('Este email já está registado no sistema.');
        } else {
          setError(errMsg);
        }
        setSaving(false);
        return;
      }

      // 2. Update profile with telefone (if provided)
      if (formData.telefone && fnData?.user_id) {
        await supabase
          .from('users')
          .update({ telefone: formData.telefone })
          .eq('auth_id', fnData.user_id);
      }

      // 3. Send password reset email so user can set their own password
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(formData.email, {
        redirectTo: `${window.location.origin}/AlterarSenha`,
      });

      if (resetError) {
        console.warn('[AddUser] Password reset email error:', resetError.message);
      }

      // 4. Send welcome/invitation email
      try {
        const empresaNome = formData.empresa_id
          ? empresas.find(e => e.id === formData.empresa_id)?.nome || ''
          : '';
        const perfisLabel = formData.perfis
          .map(p => PERFIL_OPTIONS.find(o => o.value === p)?.label || p)
          .join(', ');

        await sendEmailDirect({
          to: formData.email,
          subject: 'Bem-vindo ao DIROPS — O seu acesso foi criado',
          html: emailTemplates.user_invited
            ? emailTemplates.user_invited({ nome: formData.full_name, empresa: empresaNome, perfis: perfisLabel })
            : generateInviteEmail(formData.full_name, empresaNome, perfisLabel),
        });
      } catch (emailErr) {
        console.warn('[AddUser] Welcome email error:', emailErr.message);
        // Non-blocking — user was still created
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('[AddUser] Error:', err);
      setError('Erro inesperado: ' + err.message);
    } finally {
      setSaving(false);
    }
    });
  };

  const currentPerfis = formData.perfis || [];
  const currentAeroportos = formData.aeroportos_acesso || [];

  const aeroportosFiltrados = formData.empresa_id
    ? aeroportos.filter(a => a.empresa_id === formData.empresa_id)
    : aeroportos;
  const allAeroportosSelected = aeroportosFiltrados.length > 0 && currentAeroportos.length === aeroportosFiltrados.length;

  const empresaOptions = [
    { value: '', label: 'Nenhuma empresa (Superadmin)' },
    ...empresas.map(e => ({ value: e.id, label: e.nome }))
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-green-600" />
            Adicionar Novo Utilizador
          </DialogTitle>
          <DialogDescription>
            Crie uma conta para o utilizador. Ele receberá um email para definir a sua senha.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 p-4 max-h-[65vh] overflow-y-auto pr-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="add_full_name">Nome Completo *</Label>
                <Input
                  id="add_full_name"
                  value={formData.full_name}
                  onChange={(e) => handleChange('full_name', e.target.value)}
                  placeholder="Ex: João Silva"
                  required
                />
              </div>
              <div>
                <Label htmlFor="add_email">Email *</Label>
                <Input
                  id="add_email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="joao@empresa.com"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="add_telefone">Telefone</Label>
              <Input
                id="add_telefone"
                value={formData.telefone}
                onChange={(e) => handleChange('telefone', e.target.value)}
                placeholder="+244 9XX XXX XXX"
              />
            </div>

            <div>
              <Label>Empresa Associada</Label>
              <select
                value={formData.empresa_id}
                onChange={(e) => {
                  setFormData(prev => ({
                    ...prev,
                    empresa_id: e.target.value,
                    aeroportos_acesso: []
                  }));
                }}
                className="w-full h-10 px-3 py-2 border border-slate-200 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {empresaOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <Label>Perfis de Acesso *</Label>
              <div className="grid grid-cols-2 gap-2 mt-2 p-3 border rounded-lg bg-slate-50">
                {PERFIL_OPTIONS.map(perfil => (
                  <div key={perfil.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`add-perfil-${perfil.value}`}
                      checked={currentPerfis.includes(perfil.value)}
                      onCheckedChange={() => handlePerfilToggle(perfil.value)}
                    />
                    <Label htmlFor={`add-perfil-${perfil.value}`} className="text-sm font-normal cursor-pointer">
                      {perfil.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>Aeroportos de Acesso *</Label>
              <div className="space-y-2 mt-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                <div className="flex items-center space-x-2 pb-2 border-b">
                  <Checkbox
                    id="add-select-all-aeroportos"
                    checked={allAeroportosSelected}
                    onCheckedChange={handleSelectAllAeroportos}
                  />
                  <Label htmlFor="add-select-all-aeroportos" className="text-sm font-medium cursor-pointer">
                    Selecionar Todos
                  </Label>
                </div>
                <div className="grid grid-cols-1 gap-2 pt-2">
                  {aeroportosFiltrados.map(aeroporto => (
                    <div key={aeroporto.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`add-aeroporto-${aeroporto.id}`}
                        checked={currentAeroportos.includes(aeroporto.codigo_icao)}
                        onCheckedChange={() => handleAeroportoToggle(aeroporto.codigo_icao)}
                      />
                      <Label htmlFor={`add-aeroporto-${aeroporto.id}`} className="text-sm font-normal cursor-pointer">
                        {aeroporto.nome} ({aeroporto.codigo_icao})
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Mail className="w-4 h-4 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-700">
                  <p className="font-medium">O que acontece ao criar:</p>
                  <ul className="mt-1 space-y-0.5 text-xs">
                    <li>1. Uma conta é criada com o email informado</li>
                    <li>2. O utilizador recebe um email para definir a sua senha</li>
                    <li>3. A conta fica imediatamente ativa com os perfis e aeroportos selecionados</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              <X className="w-4 h-4 mr-1" />
              Cancelar
            </Button>
            <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white">
              {saving ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4 mr-1" />
              )}
              {saving ? 'A criar...' : 'Criar Utilizador'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function generateInviteEmail(nome, empresa, perfis) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <div style="background:linear-gradient(135deg,#1e3a5f 0%,#1a3050 100%);border-radius:12px 12px 0 0;padding:30px 40px;text-align:center;">
      <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:1px;">DIROPS</h1>
      <p style="margin:4px 0 0;color:#93c5fd;font-size:12px;">Sistema de Gestao Aeroportuaria</p>
    </div>
    <div style="background:#ffffff;padding:32px 40px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
      <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;">Bem-vindo, ${nome}!</h2>
      <p style="color:#475569;font-size:14px;line-height:1.6;">
        A sua conta no DIROPS foi criada por um administrador.
      </p>
      ${empresa ? `<p style="color:#475569;font-size:14px;"><strong>Empresa:</strong> ${empresa}</p>` : ''}
      <p style="color:#475569;font-size:14px;"><strong>Perfis:</strong> ${perfis}</p>
      <p style="color:#475569;font-size:14px;line-height:1.6;">
        Verifique a sua caixa de entrada — enviámos um email separado com um link para definir a sua senha.
        Após definir a senha, aceda ao sistema em:
      </p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${typeof window !== 'undefined' ? window.location.origin : 'https://app.marciosager.com'}"
           style="background:#1e3a5f;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;display:inline-block;">
          Aceder ao DIROPS
        </a>
      </div>
    </div>
    <div style="background:#f8fafc;border-radius:0 0 12px 12px;padding:20px 40px;border:1px solid #e2e8f0;border-top:none;text-align:center;">
      <p style="margin:0;color:#94a3b8;font-size:11px;">Este email foi enviado automaticamente pelo DIROPS.</p>
    </div>
  </div>
</body>
</html>`;
}
