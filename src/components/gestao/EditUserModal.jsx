
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { User, Save, X } from 'lucide-react';
import useSubmitGuard from '@/hooks/useSubmitGuard';
import { useI18n } from '@/components/lib/i18n';

const PERFIL_OPTIONS_KEYS = [
  { value: 'administrador', key: 'gestao.perfil.administrador' },
  { value: 'operacoes', key: 'gestao.perfil.operacoes' },
  { value: 'safety', key: 'gestao.perfil.safety' },
  { value: 'infraestrutura', key: 'gestao.perfil.infraestrutura' },
  { value: 'credenciamento', key: 'gestao.perfil.credenciamento' },
  { value: 'gestor_empresa', key: 'gestao.perfil.gestorEmpresa' },
  { value: 'visualizador', key: 'gestao.perfil.visualizador' }
];

const STATUS_OPTIONS_KEYS = [
  { value: 'ativo', key: 'gestao.status.ativo' },
  { value: 'inativo', key: 'gestao.status.inativo' },
  { value: 'pendente', key: 'gestao.status.pendente' }
];

export default function EditUserModal({ isOpen, onClose, user, aeroportos, empresas, onSave }) {
  const { t } = useI18n();
  const [formData, setFormData] = useState({});
  const { isSubmitting, guardedSubmit } = useSubmitGuard();

  const PERFIL_OPTIONS = PERFIL_OPTIONS_KEYS.map(p => ({ value: p.value, label: t(p.key) }));
  const STATUS_OPTIONS = STATUS_OPTIONS_KEYS.map(s => ({ value: s.value, label: t(s.key) }));

  useEffect(() => {
    if (user && isOpen) {
      // CONVERTER IDs PARA CÓDIGOS ICAO AO CARREGAR
      const aeroportosDoUsuario = (user.aeroportos_acesso || []).map(idOuIcao => {
        const aeroporto = aeroportos.find(a => a.id === idOuIcao || a.codigo_icao === idOuIcao);
        return aeroporto ? aeroporto.codigo_icao : null;
      }).filter(Boolean); // Remover nulos

      // Garantir que perfis é sempre um array
      let perfisArray = [];
      if (user.perfis && Array.isArray(user.perfis) && user.perfis.length > 0) {
        perfisArray = user.perfis;
      } else if (user.perfil) {
        perfisArray = [user.perfil];
      } else {
        perfisArray = ['visualizador']; // Default
      }

      setFormData({
        full_name: user.full_name || '',
        email: user.email || '',
        telefone: user.telefone || '',
        perfis: perfisArray,
        status: user.status || 'ativo',
        aeroportos_acesso: [...new Set(aeroportosDoUsuario)], // Garantir que são únicos ao carregar
        empresa_id: user.empresa_id || ''
      });
    } else {
      setFormData({});
    }
  }, [user, isOpen, aeroportos]); // Adicionado 'aeroportos' como dependência

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePerfilToggle = (perfil) => {
    setFormData(prev => {
      const currentPerfis = Array.isArray(prev.perfis) ? prev.perfis : [];
      const newPerfis = currentPerfis.includes(perfil)
        ? currentPerfis.filter(p => p !== perfil)
        : [...currentPerfis, perfil];

      return { ...prev, perfis: newPerfis };
    });
  };

  const handleAeroportoToggle = (aeroportoIcao) => {
    setFormData(prev => {
      const currentAeroportos = Array.isArray(prev.aeroportos_acesso) ? prev.aeroportos_acesso : [];
      const newAeroportos = currentAeroportos.includes(aeroportoIcao)
        ? currentAeroportos.filter(icao => icao !== aeroportoIcao)
        : [...currentAeroportos, aeroportoIcao];

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

    // Ensure perfis is always defined as array, potentially empty if none selected
    // Garantir que a lista de aeroportos é única antes de salvar
    const dataToSave = {
      ...formData,
      perfis: Array.isArray(formData.perfis) ? formData.perfis : [],
      aeroportos_acesso: [...new Set(formData.aeroportos_acesso || [])]
    };

    guardedSubmit(async () => {
      await onSave(user.id, dataToSave);
    });
  };

  if (!user) return null;

  const empresaOptions = [
    { value: '', label: t('gestao.editUser.nenhumaEmpresa') },
    ...empresas.map(e => ({ value: e.id, label: e.nome }))
  ];

  const currentPerfis = Array.isArray(formData.perfis) ? formData.perfis : [];
  const currentAeroportos = Array.isArray(formData.aeroportos_acesso) ? formData.aeroportos_acesso : [];

  // Filtrar aeroportos pela empresa selecionada
  const aeroportosFiltrados = formData.empresa_id
    ? aeroportos.filter(a => a.empresa_id === formData.empresa_id)
    : aeroportos;
  const allAeroportosSelected = aeroportosFiltrados.length > 0 && currentAeroportos.length === aeroportosFiltrados.length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600" />
            {t('gestao.editUser.title')}
          </DialogTitle>
          <DialogDescription>
            {t('gestao.editUser.description')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          {/* Adicionado um contêiner com altura máxima e rolagem */}
          <div className="space-y-4 p-4 max-h-[65vh] overflow-y-auto pr-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="full_name">{t('gestao.editUser.fullName')}</Label>
                <Input
                  id="full_name"
                  value={formData.full_name || ''}
                  onChange={(e) => handleChange('full_name', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="email">{t('gestao.editUser.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email || ''}
                  disabled
                  className="bg-gray-100"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="telefone">{t('gestao.editUser.telefone')}</Label>
              <Input
                id="telefone"
                value={formData.telefone || ''}
                onChange={(e) => handleChange('telefone', e.target.value)}
              />
            </div>

            <div>
              <Label>{t('gestao.editUser.perfisAcesso')}</Label>
              <div className="grid grid-cols-2 gap-2 mt-2 p-3 border rounded-lg bg-slate-50">
                {PERFIL_OPTIONS.map(perfil => (
                  <div key={perfil.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`perfil-${perfil.value}`}
                      checked={currentPerfis.includes(perfil.value)}
                      onCheckedChange={() => handlePerfilToggle(perfil.value)}
                    />
                    <Label htmlFor={`perfil-${perfil.value}`} className="text-sm font-normal cursor-pointer">
                      {perfil.label}
                    </Label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {t('gestao.editUser.perfisHint')}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="status">{t('gestao.editUser.status')}</Label>
                <select
                  id="status"
                  value={formData.status || 'ativo'}
                  onChange={(e) => handleChange('status', e.target.value)}
                  className="w-full h-10 px-3 py-2 border border-slate-200 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="empresa">{t('gestao.editUser.empresaAssociada')}</Label>
                <select
                  id="empresa"
                  value={formData.empresa_id || ''}
                  onChange={(e) => {
                    handleChange('empresa_id', e.target.value);
                    // Limpar aeroportos ao mudar empresa
                    setFormData(prev => ({ ...prev, empresa_id: e.target.value, aeroportos_acesso: [] }));
                  }}
                  className="w-full h-10 px-3 py-2 border border-slate-200 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  {empresaOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <Label>{t('gestao.editUser.aeroportosAcesso')}</Label>
              <div className="space-y-2 mt-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                {/* Opção Selecionar Todos */}
                <div className="flex items-center space-x-2 pb-2 border-b">
                  <Checkbox
                    id="select-all-aeroportos"
                    checked={allAeroportosSelected}
                    onCheckedChange={handleSelectAllAeroportos}
                  />
                  <Label htmlFor="select-all-aeroportos" className="text-sm font-medium cursor-pointer">
                    {t('gestao.editUser.selecionarTodos')}
                  </Label>
                </div>

                {/* Lista de aeroportos individuais (filtrado por empresa) */}
                <div className="grid grid-cols-1 gap-2 pt-2">
                  {aeroportosFiltrados.map(aeroporto => (
                    <div key={aeroporto.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`edit-aeroporto-${aeroporto.id}`}
                        checked={currentAeroportos.includes(aeroporto.codigo_icao)}
                        onCheckedChange={() => handleAeroportoToggle(aeroporto.codigo_icao)}
                      />
                      <Label htmlFor={`edit-aeroporto-${aeroporto.id}`} className="text-sm font-normal cursor-pointer">
                        {aeroporto.nome} ({aeroporto.codigo_icao})
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {t('gestao.editUser.aeroportosHint')}
              </p>
            </div>
          </div>

          <DialogFooter className="border-t pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              <X className="w-4 h-4 mr-1" />
              {t('gestao.editUser.cancelar')}
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Save className="w-4 h-4 mr-1" />
              {isSubmitting ? t('gestao.editUser.guardando') : t('gestao.editUser.salvar')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
