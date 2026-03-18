import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Select from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, User, FileText, AlertCircle, List } from 'lucide-react';

import { ProcessoAuditoria } from '@/entities/ProcessoAuditoria';
import { ItemAuditoria } from '@/entities/ItemAuditoria';
import useSubmitGuard from '@/hooks/useSubmitGuard';
import { useI18n } from '@/components/lib/i18n';

export default function FormProcessoAuditoria({
  isOpen,
  onClose,
  tipos,
  aeroportos,
  onSubmit,
  processoInicial = null,
  tipoAuditoriaInicial = null,
  currentUser = null
}) {
  const { t } = useI18n();
  const [isLoading, setIsLoading] = useState(false);
  const { guardedSubmit } = useSubmitGuard();
  const [message, setMessage] = useState({ type: '', text: '' });
  const [itensDisponiveis, setItensDisponiveis] = useState([]);
  const [itensSelecionados, setItensSelecionados] = useState(processoInicial?.itens_selecionados || []);
  const [isLoadingItens, setIsLoadingItens] = useState(false);
  
  const [formData, setFormData] = useState({
    tipo_auditoria_id: processoInicial?.tipo_auditoria_id || tipoAuditoriaInicial?.id || '',
    aeroporto_id: processoInicial?.aeroporto_id || '',
    data_auditoria: processoInicial?.data_auditoria || '',
    auditor_responsavel: processoInicial?.auditor_responsavel || '',
    equipe_auditoria: processoInicial?.equipe_auditoria?.join(', ') || '',
    observacoes_gerais: processoInicial?.observacoes_gerais || ''
  });

  useEffect(() => {
    if (formData.tipo_auditoria_id) {
      loadItensAuditoria(formData.tipo_auditoria_id);
    } else {
      setItensDisponiveis([]);
      setItensSelecionados([]);
    }
  }, [formData.tipo_auditoria_id]);

  const loadItensAuditoria = async (tipoId) => {
    setIsLoadingItens(true);
    try {
      const itens = await ItemAuditoria.filter({ tipo_auditoria_id: tipoId, status: 'ativo' }, 'numero', 500);
      const sortedItens = itens.sort((a, b) => (parseInt(a.numero) || 0) - (parseInt(b.numero) || 0));
      setItensDisponiveis(sortedItens);
      
      if (!processoInicial && sortedItens.length > 0) {
        setItensSelecionados(sortedItens.map(item => item.id));
      }
    } catch (error) {
      console.error('Erro ao carregar itens:', error);
      setMessage({ type: 'error', text: t('formAuditoria.erroItens') });
    } finally {
      setIsLoadingItens(false);
    }
  };

  const toggleItemSelecionado = (itemId) => {
    setItensSelecionados(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const selecionarTodos = () => {
    setItensSelecionados(itensDisponiveis.map(item => item.id));
  };

  const desselecionarTodos = () => {
    setItensSelecionados([]);
  };

  const selecionarAleatorio = (quantidade) => {
    if (itensDisponiveis.length === 0) return;
    
    const quantidadeReal = Math.min(quantidade, itensDisponiveis.length);
    const shuffled = [...itensDisponiveis].sort(() => Math.random() - 0.5);
    const selecionados = shuffled.slice(0, quantidadeReal).map(item => item.id);
    setItensSelecionados(selecionados);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.tipo_auditoria_id || !formData.aeroporto_id || !formData.data_auditoria || !formData.auditor_responsavel) {
      setMessage({
        type: 'error',
        text: t('formAuditoria.camposObrigatorios')
      });
      return;
    }

    if (itensSelecionados.length === 0) {
      setMessage({
        type: 'error',
        text: t('formAuditoria.selecioneItem')
      });
      return;
    }

    guardedSubmit(async () => {
    setIsLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const dataToSubmit = {
        ...formData,
        equipe_auditoria: formData.equipe_auditoria 
          ? formData.equipe_auditoria.split(',').map(nome => nome.trim()).filter(Boolean)
          : [],
        itens_selecionados: itensSelecionados
      };

      let novoProcesso;
      if (processoInicial) {
        await ProcessoAuditoria.update(processoInicial.id, dataToSubmit);
        novoProcesso = { ...processoInicial, ...dataToSubmit };
      } else {
        novoProcesso = await ProcessoAuditoria.create({ ...dataToSubmit, empresa_id: currentUser?.empresa_id });
      }

      setMessage({
        type: 'success',
        text: `Processo de auditoria ${processoInicial ? 'atualizado' : 'criado'} com sucesso! A abrir checklist...`
      });

      // Chama a função onSubmit passada pelo pai com o processo criado/atualizado
      // Isto irá acionar a abertura do checklist na página principal
      onSubmit(novoProcesso);

    } catch (error) {
      console.error('Erro ao salvar processo:', error);
      setMessage({
        type: 'error',
        text: 'Erro ao salvar o processo de auditoria. Tente novamente.'
      });
    } finally {
      setIsLoading(false);
    }
    });
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };
  
  const tipoAuditoriaOptions = (tipos || [])
    .filter(t => t.status === 'ativo')
    .map(tipo => ({
      value: tipo.id,
      label: `${tipo.nome}${tipo.categoria ? ` (${tipo.categoria.replace('_', ' ')})` : ''}`
    }));

  const aeroportoOptions = (aeroportos || []).map(aeroporto => ({
    value: aeroporto.codigo_icao,
    label: `${aeroporto.nome} (${aeroporto.codigo_icao})`
  }));

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            {processoInicial ? t('formAuditoria.editarProcesso') : t('formAuditoria.novaAuditoria')}
          </DialogTitle>
        </DialogHeader>

        {message.text && (
          <Alert variant={message.type === 'error' ? 'destructive' : 'default'} 
                className={message.type === 'success' ? 'bg-green-50 border-green-200' : ''}>
            {message.type === 'error' && <AlertCircle className="h-4 w-4" />}
            <AlertDescription className={message.type === 'success' ? 'text-green-800' : ''}>
              {message.text}
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 flex-1 overflow-y-auto pr-2">
          {/* Informações Básicas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tipo_auditoria">{t('formAuditoria.tipoAuditoria')}</Label>
              <Select
                options={tipoAuditoriaOptions}
                value={formData.tipo_auditoria_id}
                onValueChange={(value) => handleInputChange('tipo_auditoria_id', value)}
                placeholder={t('formAuditoria.selecioneTipo')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="aeroporto">{t('formAuditoria.aeroporto')}</Label>
              <Select
                options={aeroportoOptions}
                value={formData.aeroporto_id}
                onValueChange={(value) => handleInputChange('aeroporto_id', value)}
                placeholder={t('formAuditoria.selecioneAeroporto')}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="data_auditoria">{t('formAuditoria.dataAuditoria')}</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="data_auditoria"
                  type="date"
                  value={formData.data_auditoria}
                  onChange={(e) => handleInputChange('data_auditoria', e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="auditor_responsavel">{t('formAuditoria.auditorResponsavel')}</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="auditor_responsavel"
                  placeholder={t('formAuditoria.nomeAuditor')}
                  value={formData.auditor_responsavel}
                  onChange={(e) => handleInputChange('auditor_responsavel', e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="equipe_auditoria">{t('formAuditoria.equipeAuditoria')}</Label>
            <Input
              id="equipe_auditoria"
              placeholder={t('formAuditoria.equipePlaceholder')}
              value={formData.equipe_auditoria}
              onChange={(e) => handleInputChange('equipe_auditoria', e.target.value)}
            />
            <p className="text-xs text-slate-500">
              {t('formAuditoria.equipeExemplo')}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes_gerais">{t('formAuditoria.observacoesGerais')}</Label>
            <Textarea
              id="observacoes_gerais"
              placeholder={t('formAuditoria.observacoesPlaceholder')}
              value={formData.observacoes_gerais}
              onChange={(e) => handleInputChange('observacoes_gerais', e.target.value)}
              rows={4}
            />
          </div>

          {/* Seleção de Itens do Checklist */}
          {formData.tipo_auditoria_id && (
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-base flex items-center gap-2">
                      <List className="w-5 h-5 text-blue-600" />
                      {t('formAuditoria.itensChecklist')} ({itensSelecionados.length}/{itensDisponiveis.length} {t('formAuditoria.selecionados')})
                    </CardTitle>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={selecionarTodos}
                      disabled={isLoadingItens}
                    >
                      {t('formAuditoria.selecionarTodos')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={desselecionarTodos}
                      disabled={isLoadingItens}
                    >
                      {t('formAuditoria.limpar')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => selecionarAleatorio(5)}
                      disabled={isLoadingItens}
                    >
                      5 {t('formAuditoria.aleatorios')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => selecionarAleatorio(10)}
                      disabled={isLoadingItens}
                    >
                      10 {t('formAuditoria.aleatorios')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => selecionarAleatorio(20)}
                      disabled={isLoadingItens}
                    >
                      20 {t('formAuditoria.aleatorios')}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {isLoadingItens ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-slate-600">{t('formAuditoria.carregandoItens')}</p>
                  </div>
                ) : itensDisponiveis.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-slate-600">{t('formAuditoria.nenhumItem')}</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2">
                    {itensDisponiveis.map((item) => (
                      <div key={item.id} className="flex items-start gap-3 p-2 hover:bg-slate-50 rounded">
                        <Checkbox
                          id={`item-${item.id}`}
                          checked={itensSelecionados.includes(item.id)}
                          onCheckedChange={() => toggleItemSelecionado(item.id)}
                          className="mt-1"
                        />
                        <label 
                          htmlFor={`item-${item.id}`} 
                          className="flex-1 cursor-pointer text-sm leading-relaxed"
                        >
                          <span className="font-medium text-slate-700">{t('formAuditoria.item')} {item.numero}:</span>{' '}
                          <span className="text-slate-600">{item.item}</span>
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <DialogFooter className="flex-shrink-0 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              {t('formAuditoria.cancelar')}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading
                ? (processoInicial ? t('formAuditoria.aAtualizar') : t('formAuditoria.aCriar'))
                : (processoInicial ? t('formAuditoria.atualizar') : t('formAuditoria.criarAuditoria'))
              }
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}