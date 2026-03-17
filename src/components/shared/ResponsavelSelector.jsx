
import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { User } from '@/entities/User';
import { useI18n } from '@/components/lib/i18n';

export default function ResponsavelSelector({
  aeroporto,
  value,
  onValueChange,
  label,
  placeholder,
  includeEmpty = true,
  emptyLabel
}) {
  const [usuarios, setUsuarios] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { t } = useI18n();

  const displayLabel = label || t('shared.responsavel');
  const displayPlaceholder = placeholder || t('shared.selecionar_responsavel');
  const displayEmptyLabel = emptyLabel || t('shared.nenhum_responsavel');

  useEffect(() => {
    loadUsuarios();
  }, []);

  const loadUsuarios = async () => {
    try {
      const usuariosData = await User.list();
      const usuariosAtivos = usuariosData.filter(u => u.status === 'ativo');
      setUsuarios(usuariosAtivos);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const usuariosFiltrados = usuarios; // No filtering needed in public mode

  if (isLoading) {
    return (
      <div>
        <Label>{displayLabel}</Label>
        <Select disabled>
          <SelectTrigger>
            <SelectValue placeholder={t('shared.carregando')} />
          </SelectTrigger>
        </Select>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>{displayLabel}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger>
          <SelectValue placeholder={displayPlaceholder} />
        </SelectTrigger>
        <SelectContent>
          {includeEmpty && (
            <SelectItem value={null}>{displayEmptyLabel}</SelectItem>
          )}
          {usuariosFiltrados.map(usuario => (
            <SelectItem key={usuario.id} value={usuario.email}>
              <div className="flex items-center gap-2">
                <span>{usuario.full_name}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">({usuario.email})</span>
                {['administrador', 'chefe'].includes(usuario.perfil) && (
                  <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-1 rounded">
                    {usuario.perfil}
                  </span>
                )}
              </div>
            </SelectItem>
          ))}
          {usuariosFiltrados.length === 0 && (
            <SelectItem value={null} disabled>
              {t('shared.nenhum_usuario_disponivel')}
            </SelectItem>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
