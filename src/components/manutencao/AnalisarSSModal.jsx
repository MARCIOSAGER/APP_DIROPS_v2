import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Select from '@/components/ui/select';
import {
  FileText,
  User,
  Calendar,
  MapPin,
  Image,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Wrench,
  Loader2,
  ClipboardCheck
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { OrdemServico } from '@/entities/OrdemServico';
import { SolicitacaoServico } from '@/entities/SolicitacaoServico';
import useSubmitGuard from '@/hooks/useSubmitGuard';

const STATUS_CONFIG = {
  aberta: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock, label: 'Aberta' },
  em_analise: { color: 'bg-blue-100 text-blue-800 border-blue-200', icon: Search, label: 'Em Análise' },
  aprovada: { color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle, label: 'Aprovada' },
  rejeitada: { color: 'bg-red-100 text-red-800 border-red-200', icon: XCircle, label: 'Rejeitada' }
};

const PRIORIDADE_CONFIG = {
  baixa: { color: 'bg-gray-100 text-gray-800 border-gray-200', label: 'Baixa' },
  media: { color: 'bg-blue-100 text-blue-800 border-blue-200', label: 'Média' },
  alta: { color: 'bg-orange-100 text-orange-800 border-orange-200', label: 'Alta' },
  urgente: { color: 'bg-red-100 text-red-800 border-red-200', label: 'Urgente' }
};

const categoriaOptions = [
  { value: 'infraestrutura', label: 'Infraestrutura' },
  { value: 'equipamentos', label: 'Equipamentos' },
  { value: 'sinalizacao', label: 'Sinalização' },
  { value: 'pavimento', label: 'Pavimento' },
  { value: 'drenagem', label: 'Drenagem' },
  { value: 'iluminacao', label: 'Iluminação' },
  { value: 'outros', label: 'Outros' }
];

const prioridadeOptions = [
  { value: 'baixa', label: 'Baixa' },
  { value: 'media', label: 'Média' },
  { value: 'alta', label: 'Alta' },
  { value: 'urgente', label: 'Urgente' }
];

const tipoExecucaoOptions = [
  { value: 'interna', label: 'Interna' },
  { value: 'terceirizado', label: 'Terceirizado' }
];

export default function AnalisarSSModal({ isOpen, onClose, solicitacao, aeroportos, currentUser, onSuccess, onApproved, onRejected }) {
  const [action, setAction] = useState(null); // 'aprovar' | 'rejeitar'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { guardedSubmit } = useSubmitGuard();
  const [motivoRejeicao, setMotivoRejeicao] = useState('');
  const [osForm, setOsForm] = useState({
    titulo: '',
    descricao_problema: '',
    aeroporto_id: '',
    categoria_manutencao: '',
    prioridade: 'media',
    tipo_execucao: 'interna',
    fornecedor: '',
    contato_fornecedor: ''
  });

  useEffect(() => {
    if (isOpen && solicitacao) {
      setAction(null);
      setMotivoRejeicao('');
      setOsForm({
        titulo: solicitacao.titulo || '',
        descricao_problema: solicitacao.descricao || '',
        aeroporto_id: solicitacao.aeroporto_id || '',
        categoria_manutencao: '',
        prioridade: solicitacao.prioridade_sugerida || 'media',
        tipo_execucao: 'interna',
        fornecedor: '',
        contato_fornecedor: ''
      });
    }
  }, [isOpen, solicitacao]);

  if (!solicitacao) return null;

  const statusConfig = STATUS_CONFIG[solicitacao.status] || STATUS_CONFIG.aberta;
  const prioridadeConfig = PRIORIDADE_CONFIG[solicitacao.prioridade_sugerida] || PRIORIDADE_CONFIG.media;
  const StatusIcon = statusConfig.icon;

  const getAeroportoNome = (aeroportoId) => {
    const aeroporto = aeroportos?.find(a => a.id === aeroportoId);
    return aeroporto?.nome || aeroportoId || '-';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return format(parseISO(dateStr), 'dd/MM/yyyy HH:mm', { locale: pt });
    } catch {
      return dateStr;
    }
  };

  const handleOsChange = (field, value) => {
    setOsForm(prev => ({ ...prev, [field]: value }));
  };

  const aeroportoOptions = (aeroportos || []).map(a => ({
    value: a.id,
    label: `${a.nome} (${a.codigo_icao})`
  }));

  const generateNumeroOrdem = async () => {
    const year = new Date().getFullYear();
    try {
      const existingOS = await OrdemServico.list({
        empresa_id: currentUser?.empresa_id
      });
      const count = existingOS.length + 1;
      return `OS-${year}-${String(count).padStart(4, '0')}`;
    } catch {
      return `OS-${year}-0001`;
    }
  };

  const handleRejeitar = async () => {
    if (!motivoRejeicao.trim()) {
      alert('O motivo da rejeição é obrigatório.');
      return;
    }

    guardedSubmit(async () => {
      setIsSubmitting(true);
      try {
        await SolicitacaoServico.update(solicitacao.id, {
          status: 'rejeitada',
          motivo_rejeicao: motivoRejeicao,
          analisado_por: currentUser?.full_name,
          data_analise: new Date().toISOString()
        });
        if (onRejected) onRejected(solicitacao, motivoRejeicao);
        onSuccess();
        onClose();
      } catch (error) {
        console.error('Erro ao rejeitar solicitação:', error);
        alert('Erro ao rejeitar solicitação.');
      } finally {
        setIsSubmitting(false);
      }
    });
  };

  const handleAprovar = async () => {
    if (!osForm.categoria_manutencao) {
      alert('A categoria de manutenção é obrigatória.');
      return;
    }
    if (!osForm.titulo.trim()) {
      alert('O título da OS é obrigatório.');
      return;
    }

    guardedSubmit(async () => {
      setIsSubmitting(true);
      try {
        const numero_ordem = await generateNumeroOrdem();

        const osData = {
          numero_ordem,
          titulo: osForm.titulo,
          descricao_problema: osForm.descricao_problema,
          aeroporto_id: osForm.aeroporto_id,
          categoria_manutencao: osForm.categoria_manutencao,
          prioridade: osForm.prioridade,
          tipo_execucao: osForm.tipo_execucao,
          solicitacao_id: solicitacao.id,
          empresa_id: currentUser?.empresa_id,
          data_abertura: new Date().toISOString(),
          status: 'pendente'
        };

        if (osForm.tipo_execucao === 'terceirizado') {
          osData.fornecedor = osForm.fornecedor;
          osData.contato_fornecedor = osForm.contato_fornecedor;
        }

        const newOS = await OrdemServico.create(osData);

        await SolicitacaoServico.update(solicitacao.id, {
          status: 'aprovada',
          ordem_servico_id: newOS.id,
          analisado_por: currentUser?.full_name,
          data_analise: new Date().toISOString()
        });

        if (onApproved) onApproved(solicitacao, { ...osData, id: newOS.id });
        onSuccess();
        onClose();
      } catch (error) {
        console.error('Erro ao aprovar solicitação:', error);
        alert('Erro ao aprovar solicitação e criar OS.');
      } finally {
        setIsSubmitting(false);
      }
    });
  };

  const fotos = solicitacao.fotos || [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-blue-600" />
              Analisar Solicitação
            </div>
            <div className="flex gap-2">
              <Badge className={`${statusConfig.color} border`}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {statusConfig.label}
              </Badge>
              <Badge className={`${prioridadeConfig.color} border`}>
                {prioridadeConfig.label}
              </Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Detalhes da SS */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Detalhes da Solicitação
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold text-slate-900 mb-2">{solicitacao.titulo}</h4>
                <p className="text-slate-600 whitespace-pre-wrap">{solicitacao.descricao}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600">Aeroporto:</span>
                  <span className="font-medium">{getAeroportoNome(solicitacao.aeroporto_id)}</span>
                </div>

                {solicitacao.localizacao && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-600">Localização:</span>
                    <span className="font-medium">{solicitacao.localizacao}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600">Solicitante:</span>
                  <span className="font-medium">{solicitacao.solicitante_nome || '-'}</span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600">Data:</span>
                  <span className="font-medium">{formatDate(solicitacao.created_date)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Fotos */}
          {fotos.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Image className="w-5 h-5" />
                  Fotos ({fotos.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {fotos.map((foto, index) => (
                    <a
                      key={index}
                      href={foto.file_url || foto}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block overflow-hidden rounded-lg border border-slate-200 hover:border-blue-400 transition-colors"
                    >
                      <img
                        src={foto.file_url || foto}
                        alt={`Foto ${index + 1}`}
                        className="w-full h-32 object-cover"
                      />
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          {!action && (
            <div className="flex gap-3 justify-center">
              <Button
                onClick={() => setAction('aprovar')}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Aprovar e Criar OS
              </Button>
              <Button
                onClick={() => setAction('rejeitar')}
                variant="destructive"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Rejeitar
              </Button>
            </div>
          )}

          {/* Rejeitar Form */}
          {action === 'rejeitar' && (
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-red-700">
                  <XCircle className="w-5 h-5" />
                  Rejeitar Solicitação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Motivo da Rejeição *</Label>
                  <Textarea
                    value={motivoRejeicao}
                    onChange={(e) => setMotivoRejeicao(e.target.value)}
                    placeholder="Descreva o motivo da rejeição..."
                    rows={4}
                    required
                  />
                </div>
                <div className="flex gap-3 justify-end">
                  <Button variant="outline" onClick={() => setAction(null)} disabled={isSubmitting}>
                    Voltar
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleRejeitar}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        A Rejeitar...
                      </>
                    ) : (
                      'Confirmar Rejeição'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Aprovar Form - Criar OS */}
          {action === 'aprovar' && (
            <Card className="border-green-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-green-700">
                  <Wrench className="w-5 h-5" />
                  Criar Ordem de Serviço
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Título *</Label>
                    <Input
                      value={osForm.titulo}
                      onChange={(e) => handleOsChange('titulo', e.target.value)}
                      placeholder="Título da OS..."
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Aeroporto *</Label>
                    <Select
                      options={aeroportoOptions}
                      value={osForm.aeroporto_id}
                      onValueChange={(value) => handleOsChange('aeroporto_id', value)}
                      placeholder="Selecionar aeroporto"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Descrição do Problema *</Label>
                  <Textarea
                    value={osForm.descricao_problema}
                    onChange={(e) => handleOsChange('descricao_problema', e.target.value)}
                    placeholder="Descrição detalhada do problema..."
                    rows={3}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Categoria *</Label>
                    <Select
                      options={categoriaOptions}
                      value={osForm.categoria_manutencao}
                      onValueChange={(value) => handleOsChange('categoria_manutencao', value)}
                      placeholder="Selecionar categoria"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Prioridade *</Label>
                    <Select
                      options={prioridadeOptions}
                      value={osForm.prioridade}
                      onValueChange={(value) => handleOsChange('prioridade', value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Tipo de Execução</Label>
                    <Select
                      options={tipoExecucaoOptions}
                      value={osForm.tipo_execucao}
                      onValueChange={(value) => handleOsChange('tipo_execucao', value)}
                    />
                  </div>
                </div>

                {osForm.tipo_execucao === 'terceirizado' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Fornecedor</Label>
                      <Input
                        value={osForm.fornecedor}
                        onChange={(e) => handleOsChange('fornecedor', e.target.value)}
                        placeholder="Nome do fornecedor..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Contacto do Fornecedor</Label>
                      <Input
                        value={osForm.contato_fornecedor}
                        onChange={(e) => handleOsChange('contato_fornecedor', e.target.value)}
                        placeholder="Telefone ou email..."
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-3 justify-end">
                  <Button variant="outline" onClick={() => setAction(null)} disabled={isSubmitting}>
                    Voltar
                  </Button>
                  <Button
                    onClick={handleAprovar}
                    disabled={isSubmitting}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        A Criar OS...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Aprovar e Criar OS
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

