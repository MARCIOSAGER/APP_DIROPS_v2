import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, X, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function GerenciarAcessoModal({ isOpen, onClose, documento, onSave }) {
  const [usuarios, setUsuarios] = useState(documento?.usuarios_acesso_explicito || []);
  const [novoEmail, setNovoEmail] = useState('');
  const [erro, setErro] = useState('');

  const validarEmail = (email) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };

  const adicionarUsuario = () => {
    setErro('');
    
    if (!novoEmail.trim()) {
      setErro('Digite um e-mail válido');
      return;
    }

    if (!validarEmail(novoEmail)) {
      setErro('Formato de e-mail inválido');
      return;
    }

    if (usuarios.includes(novoEmail.toLowerCase())) {
      setErro('Este e-mail já foi adicionado');
      return;
    }

    setUsuarios([...usuarios, novoEmail.toLowerCase()]);
    setNovoEmail('');
  };

  const removerUsuario = (email) => {
    setUsuarios(usuarios.filter(u => u !== email));
  };

  const handleSave = () => {
    onSave(usuarios);
    onClose();
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      adicionarUsuario();
    }
  };

  if (!documento) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            <DialogTitle>Gerenciar Acesso ao Documento</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informações do Documento */}
          <Card className="bg-slate-50 border-slate-200">
            <CardContent className="pt-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-700">Documento</p>
                <p className="text-base font-semibold text-slate-900">{documento.titulo}</p>
                <p className="text-xs text-slate-500">
                  Proprietário: {documento.created_by}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Adicionar Usuário */}
          <div className="space-y-2">
            <Label htmlFor="novo-email">Adicionar Acesso</Label>
            <div className="flex gap-2">
              <Input
                id="novo-email"
                type="email"
                placeholder="email@exemplo.com"
                value={novoEmail}
                onChange={(e) => {
                  setNovoEmail(e.target.value);
                  setErro('');
                }}
                onKeyPress={handleKeyPress}
                className="flex-1"
              />
              <Button 
                onClick={adicionarUsuario}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {erro && (
              <p className="text-sm text-red-600">{erro}</p>
            )}
          </div>

          {/* Lista de Usuários com Acesso */}
          <div className="space-y-2">
            <Label>Usuários com Acesso</Label>
            {usuarios.length === 0 ? (
              <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
                <Users className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                <p className="text-sm">Nenhum usuário específico adicionado</p>
                <p className="text-xs mt-1">O acesso será controlado apenas pelos perfis</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {usuarios.map((email) => (
                  <div
                    key={email}
                    className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <span className="text-sm font-medium text-slate-700">{email}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removerUsuario(email)}
                      className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Informação sobre Acesso por Perfil */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-4">
              <div className="flex items-start gap-2">
                <div className="bg-blue-600 rounded-full p-1 mt-0.5">
                  <Users className="w-3 h-3 text-white" />
                </div>
                <div className="flex-1 text-xs text-blue-900">
                  <p className="font-semibold mb-1">Controle Híbrido de Acesso</p>
                  <p>
                    Os usuários adicionados acima terão acesso explícito a este documento, 
                    <strong> além</strong> dos usuários que já têm acesso através dos perfis configurados 
                    ({documento.nivel_acesso?.join(', ') || 'nenhum'}).
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Botões de Ação */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white">
              Salvar Alterações
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}