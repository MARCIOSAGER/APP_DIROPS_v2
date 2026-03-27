import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Folder, Lock, Shield, Eye, EyeOff } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import useSubmitGuard from '@/hooks/useSubmitGuard';
import Select from '@/components/ui/select';
import { useI18n } from '@/components/lib/i18n';
import { hashPassword } from '@/lib/hashPassword';

const CORES_PASTAS = [
'#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#84cc16'];


const PERFIL_OPTIONS = [
{ value: 'administrador', label: 'Administrador' },
{ value: 'operacoes', label: 'Operações' },
{ value: 'financeiro', label: 'Financeiro' },
{ value: 'infraestrutura', label: 'Infraestrutura' },
{ value: 'safety', label: 'Safety' },
{ value: 'avsec', label: 'AVSEC' },
{ value: 'visualizador', label: 'Visualizador' }];


export default function FormPasta({ isOpen, onClose, onSubmit, pastaInitial = null, aeroportos = [], pastaPai = null }) {
  const { t } = useI18n();
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    cor: CORES_PASTAS[0],
    nivel_acesso: ['visualizador'],
    ordem: 0,
    aeroporto_id: '',
    protegida_senha: false,
    senha: ''
  });
  const [confirmaSenha, setConfirmaSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erroSenha, setErroSenha] = useState('');
  const { isSubmitting, guardedSubmit } = useSubmitGuard();

  useEffect(() => {
    if (pastaInitial) {
      setFormData(pastaInitial);
    } else {
      setFormData({
        nome: '',
        descricao: '',
        cor: CORES_PASTAS[0],
        nivel_acesso: ['visualizador'],
        ordem: 0,
        aeroporto_id: pastaPai?.aeroporto_id || '',
        protegida_senha: false,
        senha: ''
      });
    }
  }, [pastaInitial, isOpen, pastaPai]);

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validar senhas se a pasta estiver protegida
    if (formData.protegida_senha) {
      if (!formData.senha) {
        setErroSenha('Por favor, digite uma senha');
        return;
      }
      if (formData.senha !== confirmaSenha) {
        setErroSenha('As senhas não coincidem');
        return;
      }
      if (formData.senha.length < 6) {
        setErroSenha('A senha deve ter pelo menos 6 caracteres');
        return;
      }
    }

    guardedSubmit(async () => {
      const dataToSubmit = { ...formData };
      // Hash the password before storing so it is never saved as plaintext
      if (dataToSubmit.protegida_senha && dataToSubmit.senha) {
        dataToSubmit.senha_hash = await hashPassword(dataToSubmit.senha);
        delete dataToSubmit.senha;
      }
      await onSubmit(dataToSubmit);
    });
  };

  const handleNivelAcessoToggle = (perfil) => {
    setFormData((prev) => ({
      ...prev,
      nivel_acesso: prev.nivel_acesso.includes(perfil) ?
      prev.nivel_acesso.filter((p) => p !== perfil) :
      [...prev.nivel_acesso, perfil]
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Folder className="w-5 h-5" style={{ color: formData.cor }} />
            {pastaInitial ? 'Editar' : 'Nova'} Pasta
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome da Pasta</Label>
            <Input
              value={formData.nome}
              onChange={(e) => setFormData((prev) => ({ ...prev, nome: e.target.value }))}
              placeholder="Ex: Manuais Operacionais"
              required />

          </div>

          <div className="space-y-2">
            <Label>Descrição (Opcional)</Label>
            <Input
              value={formData.descricao}
              onChange={(e) => setFormData((prev) => ({ ...prev, descricao: e.target.value }))}
              placeholder="Breve descrição da pasta" />

          </div>

          <div className="space-y-2">
            <Label>Aeroporto {pastaPai ? '(Herdado da pasta pai)' : '(Opcional)'}</Label>
            {pastaPai &&
            <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded mb-2">
                📁 Subpastas herdam automaticamente o aeroporto da pasta pai
              </div>
            }
            <Select
              options={[
              { value: '', label: 'Geral (Todos os aeroportos)' },
              ...aeroportos.map((aero) => ({
                value: aero.codigo_icao,
                label: `${aero.codigo_icao} - ${aero.nome}`
              }))]
              }
              value={formData.aeroporto_id}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, aeroporto_id: value }))}
              disabled={!!pastaPai} />

          </div>

          <div className="space-y-2">
            <Label>Ordem de Exibição</Label>
            <Input
              type="number"
              value={formData.ordem}
              onChange={(e) => setFormData((prev) => ({ ...prev, ordem: parseInt(e.target.value) || 0 }))}
              placeholder="0" />

          </div>

          <div className="space-y-2">
            <Label>Cor da Pasta</Label>
            <div className="flex gap-2">
              {CORES_PASTAS.map((cor) =>
              <button
                key={cor}
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, cor }))}
                className={`w-8 h-8 rounded-full border-2 transition-all ${
                formData.cor === cor ? 'border-slate-900 scale-110' : 'border-slate-200'}`
                }
                style={{ backgroundColor: cor }} />

              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Níveis de Acesso</Label>
            <div className="grid grid-cols-2 gap-2">
              {PERFIL_OPTIONS.map((perfil) =>
              <label key={perfil.value} className="flex items-center space-x-2 cursor-pointer">
                  <Checkbox
                  checked={formData.nivel_acesso.includes(perfil.value)}
                  onCheckedChange={() => handleNivelAcessoToggle(perfil.value)} />

                  <span className="text-sm">{perfil.label}</span>
                </label>
              )}
            </div>
          </div>

          {/* Proteção por Senha */}
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-red-600" />
              <h3 className="font-semibold text-slate-900">Segurança Avançada</h3>
            </div>

            <div className="flex items-center space-x-2 bg-red-50 p-3 rounded-lg">
              <Checkbox
                id="protegida"
                checked={formData.protegida_senha}
                onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, protegida_senha: checked }))} />

              <label htmlFor="protegida" className="text-sm font-medium text-red-900 cursor-pointer">
                Proteger esta pasta com senha
              </label>
            </div>

            {formData.protegida_senha &&
            <div className="space-y-3 pl-4 border-l-2 border-red-300">
                <div className="space-y-2">
                  <Label>Senha de Proteção *</Label>
                  <div className="relative">
                    <Input
                    type={mostrarSenha ? "text" : "password"}
                    value={formData.senha || ''}
                    onChange={(e) => {
                      setFormData((prev) => ({ ...prev, senha: e.target.value }));
                      setErroSenha('');
                    }}
                    placeholder="Digite uma senha forte"
                    required={formData.protegida_senha}
                    className="pr-10" />

                    <button
                    type="button"
                    onClick={() => setMostrarSenha(!mostrarSenha)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">

                      {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Confirmar Senha *</Label>
                  <Input
                  type={mostrarSenha ? "text" : "password"}
                  value={confirmaSenha}
                  onChange={(e) => {
                    setConfirmaSenha(e.target.value);
                    setErroSenha('');
                  }}
                  placeholder="Digite a senha novamente"
                  required={formData.protegida_senha} />

                </div>

                {erroSenha &&
              <p className="text-sm text-red-600 flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    {erroSenha}
                  </p>
              }

                <p className="text-xs text-slate-500">
                  <Lock className="w-3 h-3 inline mr-1" />
                  Esta senha será necessária para acessar o conteúdo da pasta (mínimo 6 caracteres)
                </p>
              </div>
            }
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('btn.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-blue-600 text-slate-50 px-4 py-2 text-sm font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow h-9 hover:bg-blue-700">
              {isSubmitting ? t('btn.loading') : (pastaInitial ? t('page.documentos.updateFolder') : t('page.documentos.createFolder'))}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>);

}