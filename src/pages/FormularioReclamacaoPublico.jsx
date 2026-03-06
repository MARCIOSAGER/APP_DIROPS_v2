
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Select from '@/components/ui/select'; // Corrected import
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Loader,
  Upload,
  CheckCircle, 
  AlertCircle,
  Phone,
  Mail,
  Globe,
  ArrowLeft
} from 'lucide-react';
import SuccessModal from '../components/shared/SuccessModal';

import { Reclamacao } from '@/entities/Reclamacao';
import { HistoricoReclamacao } from '@/entities/HistoricoReclamacao';
import { Aeroporto } from '@/entities/Aeroporto';
import { UploadFile, SendEmail } from '@/integrations/Core';

const generateProtocolo = () => `REC-${new Date().getFullYear()}${String(Date.now()).slice(-6)}`;

export default function FormularioReclamacaoPublico() {
  const [aeroportos, setAeroportos] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [protocolo, setProtocolo] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  
  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    reclamante_nome: '',
    reclamante_contacto: '',
    aeroporto_id: '',
    categoria_reclamacao: '',
    anexos: [],
  });

  useEffect(() => {
    loadAeroportos();
  }, []);

  const loadAeroportos = async () => {
    try {
      const aeroportosData = await Aeroporto.list();
      // Filtrar apenas aeroportos de Angola para reclamações
      const aeroportosAngola = aeroportosData.filter(a => a.pais === 'AO');
      setAeroportos(aeroportosAngola);
    } catch (error) {
      console.error('Erro ao carregar aeroportos:', error);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (message) setMessage('');
  };

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    
    setIsUploading(true);
    try {
      const uploadPromises = files.map(file => UploadFile({ file }));
      const results = await Promise.all(uploadPromises);
      const urls = results.map(r => r.file_url);
      setFormData(prev => ({ ...prev, anexos: [...prev.anexos, ...urls] }));
    } catch (error) {
      setMessage('Erro ao carregar ficheiro. Tente novamente.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    if (!acceptedTerms) {
      setMessage('Por favor, aceite as condições para continuar.');
      setIsLoading(false);
      return;
    }

    try {
      const protocolo_numero = generateProtocolo();
      const data_recebimento = new Date().toISOString();
      
      const novaReclamacao = await Reclamacao.create({
        ...formData,
        canal_entrada: 'formulario_web',
        prioridade: 'media',
        protocolo_numero,
        data_recebimento,
        status: 'recebida',
        area_responsavel: 'sem_direcionamento'
      });

      // Registar no histórico
      await HistoricoReclamacao.create({
        reclamacao_id: novaReclamacao.id,
        data_evento: data_recebimento,
        tipo_evento: 'criacao',
        detalhes: `Reclamação criada através do formulário público com protocolo ${protocolo_numero}.`,
        usuario_email: 'sistema@sga.co.ao',
      });

      // Enviar notificação por email para os operadores
      try {
        const aeroportoNome = aeroportos.find(a => a.codigo_icao === formData.aeroporto_id)?.nome || formData.aeroporto_id;
        
        await SendEmail({
          from_name: 'DIROPS-SGA - Formulário Público',
          to: 'operacoes@sga.co.ao', // Email centralizador - pode ser configurado
          subject: `Nova Reclamação Pública - ${protocolo_numero}`,
          body: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="text-align: center; margin-bottom: 30px; padding: 20px; background-color: #f8fafc; border-radius: 8px;">
                <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/563d28706_logoSGA.png" alt="DIROPS-SGA Logo" style="height: 60px; margin-bottom: 20px;">
                <h1 style="color: #dc2626; margin: 0; font-size: 24px;">Nova Reclamação Recebida</h1>
                <p style="color: #64748b; margin: 5px 0;">Formulário Público</p>
              </div>

              <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; border-left: 4px solid #dc2626; margin: 20px 0;">
                <h2 style="color: #dc2626; margin-top: 0;">Protocolo: ${protocolo_numero}</h2>
                <p><strong>Título:</strong> ${formData.titulo}</p>
                <p><strong>Aeroporto:</strong> ${aeroportoNome}</p>
                <p><strong>Categoria:</strong> ${formData.categoria_reclamacao}</p>
                <p><strong>Prioridade:</strong> media</p> <!-- Hardcoded -->
              </div>

              <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #1e40af; margin-top: 0;">Dados do Reclamante:</h3>
                <p><strong>Nome:</strong> ${formData.reclamante_nome || 'Não informado'}</p>
                <p><strong>Contacto:</strong> ${formData.reclamante_contacto || 'Não informado'}</p>
              </div>

              <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #1e40af; margin-top: 0;">Descrição:</h3>
                <p style="white-space: pre-wrap;">${formData.descricao}</p>
              </div>

              ${formData.anexos.length > 0 ? `
                <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="color: #1e40af; margin-top: 0;">Anexos (${formData.anexos.length}):</h3>
                  ${formData.anexos.map((url, i) => `<p><a href="${url}" target="_blank">Anexo ${i+1}</a></p>`).join('')}
                </div>
              ` : ''}

              <div style="text-align: center; margin: 30px 0; padding: 20px; background-color: #fef3c7; border-radius: 8px;">
                <p style="color: #92400e; margin: 0; font-weight: bold;">⚠️ Ação Necessária</p>
                <p style="color: #92400e; margin: 5px 0;">Esta reclamação precisa ser direcionada para a área responsável.</p>
                <p style="color: #92400e; margin: 5px 0; font-size: 14px;">Aceda ao sistema DIROPS-SGA para processar esta reclamação.</p>
              </div>

              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #64748b;">
                <p><strong>Sistema DIROPS-SGA</strong><br>
                Direcção de Operações - Serviços de Gestão Aeroportária</p>
              </div>
            </div>
          `
        });
      } catch (emailError) {
        console.error('Erro ao enviar email de notificação:', emailError);
        // Não interromper o fluxo se houver erro no email
      }

      setProtocolo(protocolo_numero);
      setIsSubmitted(true);
      
      // Limpar formulário (only fields in new formData state)
      setFormData({
        titulo: '',
        descricao: '',
        reclamante_nome: '',
        reclamante_contacto: '',
        aeroporto_id: '',
        categoria_reclamacao: '',
        anexos: [],
      });
      setAcceptedTerms(false);
      
    } catch (error) {
      console.error('Erro ao submeter reclamação:', error);
      setMessage('Erro ao enviar a reclamação. Verifique os dados e tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <SuccessModal
        title="Reclamação Enviada!"
        message={`A sua reclamação foi registada com o protocolo ${protocolo}. Irá receber um email de confirmação.`}
        buttonText="Voltar ao Portal de Serviços"
        redirectPath={createPageUrl('portalservicos')}
      />
    );
  }
  
  const aeroportoOptions = aeroportos.map(a => ({
    value: a.codigo_icao,
    label: `${a.nome} (${a.codigo_icao})`
  }));

  const categoriaOptions = [
    { value: 'infraestrutura', label: 'Infraestrutura' },
    { value: 'servico_aeroportuario', label: 'Serviço Aeroportuário' },
    { value: 'servico_cia_aerea', label: 'Serviço Cia Aérea' },
    { value: 'limpeza', label: 'Limpeza' },
    { value: 'seguranca', label: 'Segurança' },
    { value: 'outros', label: 'Outros' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="mb-6">
          <Link to={createPageUrl('portalservicos')}>
            <Button variant="outline" className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Voltar ao Portal de Serviços
            </Button>
          </Link>
        </div>

        {/* Mensagens de Feedback */}
        {message && (
          <Alert variant={isSubmitted ? "default" : "destructive"}>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}

        {/* Formulário */}
        <Card className="w-full border-0 shadow-lg">
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle>
                Dados da Reclamação
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <Card>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Informações Básicas */}
                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="titulo">Assunto da Reclamação *</Label>
                    <Input
                      id="titulo"
                      value={formData.titulo}
                      onChange={(e) => handleInputChange('titulo', e.target.value)}
                      placeholder="Descreva brevemente o motivo da reclamação"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="aeroporto_id">Aeroporto *</Label>
                    <Select 
                      id="aeroporto_id"
                      options={aeroportoOptions}
                      value={formData.aeroporto_id} 
                      onValueChange={(value) => handleInputChange('aeroporto_id', value)}
                      placeholder="Selecione o aeroporto"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="categoria_reclamacao">Categoria *</Label>
                    <Select
                      id="categoria_reclamacao"
                      options={categoriaOptions}
                      value={formData.categoria_reclamacao} 
                      onValueChange={(value) => handleInputChange('categoria_reclamacao', value)}
                      placeholder="Selecione a categoria"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="descricao">Descrição Detalhada *</Label>
                    <Textarea
                      id="descricao"
                      value={formData.descricao}
                      onChange={(e) => handleInputChange('descricao', e.target.value)}
                      placeholder="Descreva a sua situação de forma detalhada, incluindo local, data/hora e circunstâncias..."
                      required
                      rows={5}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Dados do Reclamante (Opcionais) */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-4 text-slate-700">
                  Dados de Contacto (Opcional)
                </h3>
                <p className="text-sm text-slate-500 mb-4">
                  Forneça os seus dados se desejar receber uma resposta da nossa equipa
                </p>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="reclamante_nome">Nome Completo</Label>
                    <Input
                      id="reclamante_nome"
                      value={formData.reclamante_nome}
                      onChange={(e) => handleInputChange('reclamante_nome', e.target.value)}
                      placeholder="O seu nome completo"
                    />
                  </div>
                  <div>
                    <Label htmlFor="reclamante_contacto">Email ou Telefone</Label>
                    <Input
                      id="reclamante_contacto"
                      value={formData.reclamante_contacto}
                      onChange={(e) => handleInputChange('reclamante_contacto', e.target.value)}
                      placeholder="exemplo@email.com ou +244 xxx xxx xxx"
                    />
                  </div>
                </div>
              </div>

              {/* Anexos */}
              <div className="border-t pt-6">
                <Label>Anexos (Opcional)</Label>
                <p className="text-sm text-slate-500 mb-3">
                  Anexe fotos ou documentos que ajudem a esclarecer a situação
                </p>
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center">
                  <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <Input
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                    accept="image/*,.pdf,.doc,.docx"
                  />
                  <Label 
                    htmlFor="file-upload" 
                    className="cursor-pointer text-blue-600 hover:text-blue-800"
                  >
                    Clique para selecionar ficheiros
                  </Label>
                  <p className="text-xs text-slate-500 mt-1">
                    Formatos aceites: Imagens, PDF, Word (máx. 10MB cada)
                  </p>
                  
                  {isUploading && (
                    <p className="text-sm text-blue-600 mt-2">A carregar ficheiros...</p>
                  )}
                  
                  {formData.anexos.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <h4 className="text-sm font-medium text-slate-700">Ficheiros anexados:</h4>
                      {formData.anexos.map((url, i) => (
                        <div key={i} className="flex items-center justify-between bg-slate-50 rounded p-2">
                          <span className="text-sm text-slate-600">Anexo {i+1}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setFormData(prev => ({
                              ...prev,
                              anexos: prev.anexos.filter((_, index) => index !== i)
                            }))}
                            className="text-red-600 hover:text-red-800"
                          >
                            Remover
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Termos */}
              <div className="border-t pt-6">
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-4">
                    <h4 className="font-semibold text-slate-800 mb-3">
                      Informações Importantes sobre o Tratamento da Reclamação:
                    </h4>
                    <ul className="space-y-2 text-sm text-slate-700">
                      <li className="flex items-start">
                        <CheckCircle className="w-4 h-4 text-green-600 mr-2 mt-1 flex-shrink-0" />
                        <span>A sua reclamação será analisada pela nossa equipa especializada.</span>
                      </li>
                      <li className="flex items-start">
                        <CheckCircle className="w-4 h-4 text-green-600 mr-2 mt-1 flex-shrink-0" />
                        <span>Receberá uma resposta no prazo máximo de 5 dias úteis.</span>
                      </li>
                      <li className="flex items-start">
                        <CheckCircle className="w-4 h-4 text-green-600 mr-2 mt-1 flex-shrink-0" />
                        <span>Os seus dados pessoais são tratados conforme a política de privacidade.</span>
                      </li>
                      <li className="flex items-start">
                        <CheckCircle className="w-4 h-4 text-green-600 mr-2 mt-1 flex-shrink-0" />
                        <span>Receberá um número de protocolo para acompanhar o estado da reclamação.</span>
                      </li>
                    </ul>
                    
                    <div className="flex items-center space-x-2 mt-4 pt-3 border-t border-blue-200">
                      <Checkbox 
                        id="termos-publico"
                        checked={acceptedTerms}
                        onCheckedChange={setAcceptedTerms}
                      />
                      <Label htmlFor="termos-publico" className="text-sm font-medium leading-none cursor-pointer">
                        Li e aceito as condições de tratamento da reclamação
                      </Label>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>

            {/* Botões */}
            <CardFooter className="flex justify-end">
              <Button 
                type="submit" 
                disabled={isLoading || !acceptedTerms}
                className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-6"
              >
                {isLoading ? (
                  <>
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                    A Enviar...
                  </>
                ) : (
                  'Enviar Reclamação'
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* Informações de Contacto */}
        <div className="mt-8 text-center text-sm text-slate-500 p-4 bg-white rounded-lg shadow-sm">
          <h3 className="font-semibold text-slate-700 mb-2">Outros Meios de Contacto</h3>
          <div className="flex flex-col md:flex-row justify-center items-center gap-x-6 gap-y-2">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-slate-500" />
              <span>+244 932 043 077</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-slate-500" />
              <span>oaeroportos@sga.co.ao</span>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-slate-500" />
              <span>www.sga.co.ao</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
