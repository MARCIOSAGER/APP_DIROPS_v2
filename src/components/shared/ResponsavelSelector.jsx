
import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { User } from '@/entities/User';

export default function ResponsavelSelector({ 
  aeroporto, 
  value, 
  onValueChange, 
  label = "Responsável",
  placeholder = "Selecionar responsável...",
  includeEmpty = true,
  emptyLabel = "Nenhum responsável específico"
}) {
  const [usuarios, setUsuarios] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

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
        <Label>{label}</Label>
        <Select disabled>
          <SelectTrigger>
            <SelectValue placeholder="Carregando..." />
          </SelectTrigger>
        </Select>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {includeEmpty && (
            <SelectItem value={null}>{emptyLabel}</SelectItem>
          )}
          {usuariosFiltrados.map(usuario => (
            <SelectItem key={usuario.id} value={usuario.email}>
              <div className="flex items-center gap-2">
                <span>{usuario.full_name}</span>
                <span className="text-xs text-slate-500">({usuario.email})</span>
                {['administrador', 'chefe'].includes(usuario.perfil) && (
                  <span className="text-xs bg-blue-100 text-blue-800 px-1 rounded">
                    {usuario.perfil}
                  </span>
                )}
              </div>
            </SelectItem>
          ))}
          {usuariosFiltrados.length === 0 && (
            <SelectItem value={null} disabled>
              Nenhum usuário disponível
            </SelectItem>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
