import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Trash2, AlertTriangle, CheckCircle, Search } from 'lucide-react';
import { verificarDuplicacoesTipoKPI } from '@/functions/verificarDuplicacoesTipoKPI';
import { removerDuplicacoesTipoKPI } from '@/functions/removerDuplicacoesTipoKPI';
import { useI18n } from '@/components/lib/i18n';

export default function DiagnosticoDuplicacoesModal({ isOpen, onClose, onSuccess }) {
  const { t } = useI18n();
  const [isLoading, setIsLoading] = useState(false);
  const [diagnostico, setDiagnostico] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [isRemoving, setIsRemoving] = useState(false);

  const handleVerificar = async () => {
    setIsLoading(true);
    setDiagnostico(null);
    setSelectedIds([]);
    
    try {
      const response = await verificarDuplicacoesTipoKPI();
      
      if (response.status === 200) {
        setDiagnostico(response.data);
      } else {
        alert('Erro ao verificar duplicações: ' + (response.data?.error || 'Erro desconhecido'));
      }
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro ao verificar duplicações');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemover = async () => {
    if (selectedIds.length === 0) {
      alert('Selecione pelo menos um registo para remover');
      return;
    }

    if (!confirm(`Tem certeza que deseja remover ${selectedIds.length} registo(s) duplicado(s)?`)) {
      return;
    }

    setIsRemoving(true);
    
    try {
      const response = await removerDuplicacoesTipoKPI({ ids_para_remover: selectedIds });
      
      if (response.status === 200) {
        alert(`${response.data.quantidade_removida} registo(s) removido(s) com sucesso!`);
        setSelectedIds([]);
        await handleVerificar(); // Verificar novamente
        if (onSuccess) onSuccess();
      } else {
        alert('Erro ao remover: ' + (response.data?.error || 'Erro desconhecido'));
      }
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro ao remover duplicações');
    } finally {
      setIsRemoving(false);
    }
  };

  const toggleId = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            {t('kpis.diag_titulo')}
          </DialogTitle>
          <DialogDescription>
            {t('kpis.diag_descricao')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={handleVerificar} disabled={isLoading} className="flex items-center gap-2">
              <Search className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? t('kpis.diag_verificando') : t('kpis.diag_verificar')}
            </Button>
            
            {selectedIds.length > 0 && (
              <Button 
                variant="destructive" 
                onClick={handleRemover} 
                disabled={isRemoving}
                className="flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {t('kpis.diag_remover_selecionados')} ({selectedIds.length})
              </Button>
            )}
          </div>

          {diagnostico && (
            <>
              <Alert className={diagnostico.tem_duplicacoes ? 'border-orange-200 bg-orange-50' : 'border-green-200 bg-green-50'}>
                {diagnostico.tem_duplicacoes ? (
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                ) : (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                )}
                <AlertDescription className={diagnostico.tem_duplicacoes ? 'text-orange-800' : 'text-green-800'}>
                  <strong>{t('kpis.diag_total_tipos')}:</strong> {diagnostico.total_tipos_kpi}
                  <br />
                  {diagnostico.tem_duplicacoes ? (
                    <>
                      <strong>{t('kpis.diag_dup_codigo')}:</strong> {diagnostico.duplicacoes_por_codigo.length}
                      <br />
                      <strong>{t('kpis.diag_dup_nome')}:</strong> {diagnostico.duplicacoes_por_nome.length}
                    </>
                  ) : (
                    t('kpis.diag_sem_duplicacoes')
                  )}
                </AlertDescription>
              </Alert>

              {diagnostico.duplicacoes_por_codigo.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg">{t('kpis.diag_dup_codigo')}</h3>
                  {diagnostico.duplicacoes_por_codigo.map((dup, idx) => (
                    <div key={idx} className="border rounded-lg p-4 space-y-2 bg-red-50">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-red-900">
                          {t('kpis.diag_codigo')}: {dup.codigo} ({dup.quantidade} {t('kpis.diag_registos')})
                        </h4>
                      </div>
                      
                      <div className="space-y-2">
                        {dup.registos.map((reg) => (
                          <div key={reg.id} className="flex items-start gap-3 p-3 bg-white rounded border">
                            <Checkbox
                              checked={selectedIds.includes(reg.id)}
                              onCheckedChange={() => toggleId(reg.id)}
                            />
                            <div className="flex-1">
                              <p className="font-medium">{reg.nome}</p>
                              <p className="text-xs text-slate-600">ID: {reg.id}</p>
                              <p className="text-xs text-slate-500">
                                {t('kpis.diag_criado_em')}: {new Date(reg.created_date).toLocaleString('pt-AO')} {t('kpis.diag_por')} {reg.created_by}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {diagnostico.duplicacoes_por_nome.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg">{t('kpis.diag_dup_nome')}</h3>
                  {diagnostico.duplicacoes_por_nome.map((dup, idx) => (
                    <div key={idx} className="border rounded-lg p-4 space-y-2 bg-yellow-50">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-yellow-900">
                          {t('kpis.diag_nome')}: {dup.nome} ({dup.quantidade} {t('kpis.diag_registos')})
                        </h4>
                      </div>
                      
                      <div className="space-y-2">
                        {dup.registos.map((reg) => (
                          <div key={reg.id} className="flex items-start gap-3 p-3 bg-white rounded border">
                            <Checkbox
                              checked={selectedIds.includes(reg.id)}
                              onCheckedChange={() => toggleId(reg.id)}
                            />
                            <div className="flex-1">
                              <p className="font-medium">{t('kpis.diag_codigo')}: {reg.codigo}</p>
                              <p className="text-xs text-slate-600">ID: {reg.id}</p>
                              <p className="text-xs text-slate-500">
                                {t('kpis.diag_criado_em')}: {new Date(reg.created_date).toLocaleString('pt-AO')} {t('kpis.diag_por')} {reg.created_by}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {!diagnostico && !isLoading && (
            <div className="text-center py-8 text-slate-500">
              <AlertTriangle className="w-16 h-16 mx-auto text-slate-300 mb-4" />
              <p>{t('kpis.diag_instrucao')}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}