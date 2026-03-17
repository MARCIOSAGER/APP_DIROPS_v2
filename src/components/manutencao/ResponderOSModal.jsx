import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, AlertTriangle, UploadCloud, X, Loader2 } from 'lucide-react';
import { UploadFile } from '@/integrations/Core';
import useSubmitGuard from '@/hooks/useSubmitGuard';

const ACAO_CONFIG = {
  aceitar: {
    status: 'em_execucao',
    color: 'bg-green-100 text-green-800',
    icon: CheckCircle,
    label: 'Aceitar e Iniciar Execução',
    titulo: 'Aceitar Ordem de Serviço'
  },
  rejeitar: {
    status: 'rejeitada',
    color: 'bg-red-100 text-red-800',
    icon: XCircle,
    label: 'Rejeitar Ordem',
    titulo: 'Rejeitar Ordem de Serviço'
  },
  verificar: {
    status: 'concluida',
    color: 'bg-orange-100 text-orange-800',
    icon: AlertTriangle,
    label: 'Aprovar e Concluir',
    titulo: 'Verificar e Aprovar Ordem de Serviço'
  },
  concluir: {
    status: 'aguardando_verificacao',
    color: 'bg-blue-100 text-blue-800',
    icon: CheckCircle,
    label: 'Submeter para Verificação',
    titulo: 'Concluir Execução da Ordem de Serviço'
  }
};

export default function ResponderOSModal({ isOpen, onClose, ordem, acao, onSubmit, currentUser }) {
  const [observacoes, setObservacoes] = useState('');
  const [observacoesConclusao, setObservacoesConclusao] = useState('');
  const [custosReais, setCustosReais] = useState('');
  const [fotosAntes, setFotosAntes] = useState([]);
  const [fotosDepois, setFotosDepois] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { guardedSubmit } = useSubmitGuard();
  const [isUploading, setIsUploading] = useState(false);

  const acaoConfig = ACAO_CONFIG[acao] || ACAO_CONFIG.aceitar;
  const AcaoIcon = acaoConfig.icon;

  const handleFileUpload = async (e, tipo) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    setIsUploading(true);
    try {
      for (const file of files) {
        const { file_url } = await UploadFile({ file });
        if (tipo === 'antes') {
          setFotosAntes(prev => [...prev, file_url]);
        } else {
          setFotosDepois(prev => [...prev, file_url]);
        }
      }
    } catch (err) {
      console.error('Erro ao fazer upload:', err);
      alert('Erro ao fazer upload de ficheiro.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveFoto = (tipo, index) => {
    if (tipo === 'antes') {
      setFotosAntes(prev => prev.filter((_, i) => i !== index));
    } else {
      setFotosDepois(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (acao === 'rejeitar' && !observacoes.trim()) {
      alert('Justificativa é obrigatória para rejeição');
      return;
    }

    guardedSubmit(async () => {
    setIsSubmitting(true);
    try {
      const payload = {
        ordem_id: ordem.id,
        status: acaoConfig.status,
        observacoes: observacoes,
        acao: acao
      };

      // Set timestamps and extra fields based on action
      if (acao === 'aceitar') {
        payload.data_inicio_execucao = new Date().toISOString();
        if (fotosAntes.length > 0) {
          payload.fotos_antes = [...(ordem.fotos_antes || []), ...fotosAntes];
        }
      }

      if (acao === 'concluir') {
        payload.data_conclusao = new Date().toISOString();
        payload.observacoes_conclusao = observacoesConclusao || observacoes;
        if (custosReais) {
          payload.custos_reais = parseFloat(custosReais);
        }
        if (fotosDepois.length > 0) {
          payload.fotos_depois = [...(ordem.fotos_depois || []), ...fotosDepois];
        }
      }

      if (acao === 'verificar') {
        payload.data_verificacao = new Date().toISOString();
        payload.verificado_por = currentUser?.email || currentUser?.full_name || '';
      }

      await onSubmit(payload);
      onClose();
    } catch (error) {
      console.error('Erro ao responder OS:', error);
      alert('Erro ao processar resposta');
    } finally {
      setIsSubmitting(false);
    }
    });
  };

  if (!ordem) return null;

  const renderFotoUpload = (tipo, fotos, label) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors text-sm text-slate-600">
          <UploadCloud className="w-4 h-4" />
          {isUploading ? 'A enviar...' : 'Selecionar ficheiros'}
          <input
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFileUpload(e, tipo)}
            disabled={isUploading}
          />
        </label>
        {isUploading && <Loader2 className="w-4 h-4 animate-spin text-slate-500" />}
      </div>
      {fotos.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {fotos.map((url, index) => (
            <div key={index} className="relative group">
              <img
                src={url}
                alt={`Foto ${index + 1}`}
                className="w-20 h-20 object-cover rounded-lg border border-slate-200"
              />
              <button
                type="button"
                onClick={() => handleRemoveFoto(tipo, index)}
                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AcaoIcon className="w-5 h-5" />
            {acaoConfig.titulo} - {ordem.numero_ordem}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Resumo da OS */}
          <Alert>
            <AlertDescription>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span><strong>Título:</strong> {ordem.titulo}</span>
                  <Badge className={acaoConfig.color}>
                    {acaoConfig.label}
                  </Badge>
                </div>
                <p><strong>Descrição:</strong> {ordem.descricao_problema}</p>
                <p><strong>Prioridade:</strong> <span className="capitalize">{ordem.prioridade}</span></p>
                {ordem.prazo_estimado && (
                  <p><strong>Prazo:</strong> {new Date(ordem.prazo_estimado).toLocaleDateString('pt-AO')}</p>
                )}
              </div>
            </AlertDescription>
          </Alert>

          {/* Fotos Antes - shown when accepting */}
          {acao === 'aceitar' && renderFotoUpload('antes', fotosAntes, 'Fotos do Estado Atual (Antes)')}

          {/* Campo de Observações */}
          <div className="space-y-2">
            <Label htmlFor="observacoes">
              {acao === 'rejeitar' ? 'Justificativa para Rejeição *' : 'Observações'}
            </Label>
            <Textarea
              id="observacoes"
              placeholder={
                acao === 'rejeitar'
                  ? 'Por favor, informe o motivo da rejeição...'
                  : acao === 'aceitar'
                  ? 'Descreva como pretende executar esta ordem...'
                  : acao === 'verificar'
                  ? 'Observações sobre a verificação realizada...'
                  : 'Descreva os trabalhos realizados...'
              }
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={4}
              required={acao === 'rejeitar'}
            />
          </div>

          {/* Extra fields when concluding */}
          {acao === 'concluir' && (
            <>
              {renderFotoUpload('depois', fotosDepois, 'Fotos Após Execução (Depois)')}

              <div className="space-y-2">
                <Label htmlFor="observacoes_conclusao">Observações da Conclusão</Label>
                <Textarea
                  id="observacoes_conclusao"
                  placeholder="Descreva detalhadamente os trabalhos realizados, materiais utilizados, etc."
                  value={observacoesConclusao}
                  onChange={(e) => setObservacoesConclusao(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="custos_reais">Custos Reais (AOA)</Label>
                <Input
                  id="custos_reais"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={custosReais}
                  onChange={(e) => setCustosReais(e.target.value)}
                />
              </div>
            </>
          )}

          {/* Alertas específicos por ação */}
          {acao === 'aceitar' && (
            <Alert>
              <CheckCircle className="w-4 h-4" />
              <AlertDescription>
                Ao aceitar, você se torna responsável por esta ordem de serviço. O status será alterado para "Em Execução".
              </AlertDescription>
            </Alert>
          )}

          {acao === 'rejeitar' && (
            <Alert>
              <XCircle className="w-4 h-4" />
              <AlertDescription>
                A ordem será rejeitada e retornará ao status "Pendente" para nova atribuição. Uma justificativa é obrigatória.
              </AlertDescription>
            </Alert>
          )}

          {acao === 'verificar' && (
            <Alert>
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>
                A ordem será verificada, aprovada e marcada como "Concluída". Seu nome será registado como verificador.
              </AlertDescription>
            </Alert>
          )}

          {acao === 'concluir' && (
            <Alert>
              <CheckCircle className="w-4 h-4" />
              <AlertDescription>
                A ordem será submetida para verificação pelo supervisor. Adicione fotos do resultado e os custos reais, se aplicável.
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || isUploading}
              className={`text-white ${
                acao === 'rejeitar' ? 'bg-red-600 hover:bg-red-700' :
                acao === 'aceitar' ? 'bg-green-600 hover:bg-green-700' :
                acao === 'verificar' ? 'bg-orange-600 hover:bg-orange-700' :
                'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isSubmitting ? 'Processando...' : acaoConfig.label}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
