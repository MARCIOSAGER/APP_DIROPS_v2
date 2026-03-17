
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Select from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Send, AlertCircle, ArrowLeft, Loader2, Building, Mail, Plane, User, Car } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Link } from 'react-router-dom';

import { submitCredenciamentoPublico } from '@/functions/submitCredenciamentoPublico';
import { Aeroporto } from '@/entities/Aeroporto';
import { Empresa } from '@/entities/Empresa';
import SuccessModal from '../components/shared/SuccessModal';
import useSubmitGuard from '@/hooks/useSubmitGuard';

export default function CredenciamentoPublico() {
  const [formData, setFormData] = useState({
    empresa_solicitante_id: '',
    email_notificacao: '',
    tipo_credencial: 'pessoa',
    periodo_validade: 'permanente',
    aeroporto_id: '',
    justificativa_acesso: '',
    nome_completo: '',
    funcao_empresa: '',
    matricula_viatura: '',
    modelo_viatura: '',
  });
  
  const [empresas, setEmpresas] = useState([]);
  const [aeroportos, setAeroportos] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [successInfo, setSuccessInfo] = useState(null);
  const [error, setError] = useState('');
  const { guardedSubmit } = useSubmitGuard();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [empresasData, aeroportosData] = await Promise.all([
        Empresa.list(),
        Aeroporto.list()
      ]);
      
      setEmpresas(empresasData.filter(e => e.status === 'ativa'));
      setAeroportos(aeroportosData.filter(a => a.pais === 'AO'));
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setError('Erro ao carregar dados. Recarregue a página.');
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const validateForm = () => {
    const requiredFields = ['empresa_solicitante_id', 'email_notificacao', 'aeroporto_id', 'justificativa_acesso'];
    if (formData.tipo_credencial === 'pessoa') {
        requiredFields.push('nome_completo', 'funcao_empresa');
    } else {
        requiredFields.push('matricula_viatura', 'modelo_viatura');
    }

    for (const field of requiredFields) {
        if (!formData[field] || formData[field].trim() === '') {
            setError(`O campo "${field.replace('_', ' ')}" é obrigatório.`);
            return false;
        }
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email_notificacao)) {
      setError('Por favor, insira um email válido para notificação.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    guardedSubmit(async () => {
    setIsLoading(true);
    setError('');

    try {
      const { data, error: submitError } = await submitCredenciamentoPublico(formData);

      if (submitError || !data.success) {
        throw new Error(data?.error || submitError?.message || 'Erro ao enviar solicitação');
      }

      setSuccessInfo({ protocolo: data.protocolo });
    } catch (error) {
      console.error('Erro ao submeter solicitação:', error);
      setError(error.message || 'Erro ao enviar solicitação. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
    });
  };

  if (isLoadingData) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <Card className="w-full max-w-md"><CardContent className="flex flex-col items-center justify-center py-16">
          <Loader2 className="animate-spin h-12 w-12 text-blue-600 dark:text-blue-400 mb-4" />
          <p className="text-slate-600 dark:text-slate-400">A carregar dados...</p>
        </CardContent></Card>
      </div>
    );
  }

  if (successInfo) {
    return (
      <SuccessModal
        title="Solicitação de Credencial Enviada!"
        message="A sua solicitação foi recebida. Irá receber um email de notificação com os próximos passos."
        buttonText="Voltar ao Portal de Serviços"
        redirectPath={createPageUrl('portalservicos')}
      />
    );
  }
  
  const empresaOptions = empresas.map(e => ({ value: e.id, label: e.nome }));
  const aeroportoOptions = aeroportos.map(a => ({ value: a.id, label: a.nome }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-blue-950 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        <div className="mb-6">
          <Link to={createPageUrl('portalservicos')}>
            <Button variant="outline" className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Voltar ao Portal de Serviços
            </Button>
          </Link>
        </div>
        <Card className="w-full">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4"><img src="/logo-dirops.png" alt="DIROPS Logo" className="h-12" /></div>
            <CardTitle className="text-2xl font-bold text-slate-900 dark:text-slate-100">Formulário de Solicitação de Credencial</CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-400 mt-2">Preencha os dados abaixo para iniciar um novo pedido de credenciamento.</CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="empresa"><Building className="inline-block w-4 h-4 mr-1" />Empresa Solicitante *</Label>
                  <Select
                    options={empresaOptions}
                    value={formData.empresa_solicitante_id}
                    onValueChange={(v) => handleChange('empresa_solicitante_id', v)}
                    placeholder="Selecione a empresa"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email_notificacao"><Mail className="inline-block w-4 h-4 mr-1" />E-mail para Notificação *</Label>
                  <Input id="email_notificacao" type="email" value={formData.email_notificacao} onChange={(e) => handleChange('email_notificacao', e.target.value)} placeholder="email.contato@empresa.com" />
                </div>
              </div>

              <div className="space-y-2">
                  <Label><Plane className="inline-block w-4 h-4 mr-1" />Aeroporto da Credencial *</Label>
                  <Select
                    options={aeroportoOptions}
                    value={formData.aeroporto_id}
                    onValueChange={(v) => handleChange('aeroporto_id', v)}
                    placeholder="Selecione o aeroporto"
                  />
              </div>
              
              <div className="space-y-3">
                <Label>Tipo de Credencial *</Label>
                <RadioGroup value={formData.tipo_credencial} onValueChange={(v) => handleChange('tipo_credencial', v)} className="flex gap-6">
                  <div className="flex items-center space-x-2"><RadioGroupItem value="pessoa" id="pessoa" /><Label htmlFor="pessoa" className="flex items-center gap-2"><User className="w-4 h-4" />Pessoa</Label></div>
                  <div className="flex items-center space-x-2"><RadioGroupItem value="viatura" id="viatura" /><Label htmlFor="viatura" className="flex items-center gap-2"><Car className="w-4 h-4" />Viatura</Label></div>
                </RadioGroup>
              </div>

              {formData.tipo_credencial === 'pessoa' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-md bg-slate-50 dark:bg-slate-800">
                  <div className="space-y-2"><Label htmlFor="nome_completo">Nome Completo *</Label><Input id="nome_completo" value={formData.nome_completo} onChange={(e) => handleChange('nome_completo', e.target.value)} /></div>
                  <div className="space-y-2"><Label htmlFor="funcao_empresa">Função na Empresa *</Label><Input id="funcao_empresa" value={formData.funcao_empresa} onChange={(e) => handleChange('funcao_empresa', e.target.value)} /></div>
                </div>
              )}
              
              {formData.tipo_credencial === 'viatura' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-md bg-slate-50 dark:bg-slate-800">
                  <div className="space-y-2"><Label htmlFor="matricula_viatura">Matrícula da Viatura *</Label><Input id="matricula_viatura" value={formData.matricula_viatura} onChange={(e) => handleChange('matricula_viatura', e.target.value)} /></div>
                  <div className="space-y-2"><Label htmlFor="modelo_viatura">Modelo da Viatura *</Label><Input id="modelo_viatura" value={formData.modelo_viatura} onChange={(e) => handleChange('modelo_viatura', e.target.value)} /></div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="justificativa">Justificativa do Acesso *</Label>
                <Textarea id="justificativa" value={formData.justificativa_acesso} onChange={(e) => handleChange('justificativa_acesso', e.target.value)} placeholder="Descreva o motivo da necessidade da credencial..." />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button type="button" variant="outline" className="flex-1" onClick={() => window.location.href = createPageUrl('servicos')}><ArrowLeft className="w-4 h-4 mr-2" />Voltar</Button>
                <Button type="submit" disabled={isLoading} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
                  {isLoading ? <><Loader2 className="animate-spin h-4 w-4 mr-2" />A Enviar...</> : <><Send className="w-4 h-4 mr-2" />Enviar Solicitação</>}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
