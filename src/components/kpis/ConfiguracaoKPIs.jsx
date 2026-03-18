
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Plus, Settings, Edit, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { TipoKPI } from '@/entities/TipoKPI';
import AlertModal from '@/components/shared/AlertModal';
import useSubmitGuard from '@/hooks/useSubmitGuard';
import { useI18n } from '@/components/lib/i18n';

// Componente para o formulário (poderia ser movido para seu próprio ficheiro se complexo)
const FormTipoKPI = ({ tipoInicial, onSuccess, onCancel }) => {
  const { isSubmitting, guardedSubmit } = useSubmitGuard();
  const { t } = useI18n();
  const [tipo, setTipo] = useState(tipoInicial || {
    nome: '',
    codigo: '', // 'codigo' is still part of the state as it's needed for update/creation
    descricao: '',
    categoria: 'operacional',
    unidade_medida: 'minutos',
    meta_objetivo: 0,
    cor_identificacao: '#3B82F6',
    status: 'ativo'
  });

  // Gerar código automaticamente baseado no nome
  const generateCode = (nome) => {
    return nome
      .toUpperCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove acentos
      .replace(/[^A-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    guardedSubmit(async () => {
    try {
      const dataToSubmit = { ...tipo };
      // Gera o código automaticamente apenas na criação se ainda não existir
      if (!dataToSubmit.id) { // This means it's a new KPI
        dataToSubmit.codigo = generateCode(dataToSubmit.nome);
      }

      if (dataToSubmit.id) {
        await TipoKPI.update(dataToSubmit.id, dataToSubmit);
      } else {
        await TipoKPI.create(dataToSubmit);
      }
      onSuccess();
    } catch (error) {
      console.error("Erro ao salvar tipo de KPI:", error);
    }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg">
      <h3 className="text-lg font-semibold">{tipo.id ? t('kpis.config.editar') : t('kpis.config.novo')} {t('kpis.tiposKPI').replace(/s$/, '')}</h3>
       <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('kpis.config.nome')}</label>
                <input 
                  value={tipo.nome} 
                  onChange={e => setTipo({...tipo, nome: e.target.value})}
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                  placeholder="Ex: Tempo da 1ª Bagagem"
                  required 
                />
            </div>
        </div>
        <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('kpis.config.descricao')}</label>
            <textarea 
              value={tipo.descricao} 
              onChange={e => setTipo({...tipo, descricao: e.target.value})} 
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
              rows="3"
              placeholder="Descrição detalhada do KPI..."
            />
        </div>
        <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('tarifas.category')}</label>
                <select
                  value={tipo.categoria}
                  onChange={e => setTipo({...tipo, categoria: e.target.value})}
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                    <option value="operacional">{t('kpis.config.operacional')}</option>
                    <option value="qualidade">{t('kpis.config.qualidade')}</option>
                    <option value="seguranca">{t('kpis.config.seguranca')}</option>
                    <option value="eficiencia">{t('kpis.config.eficiencia')}</option>
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('kpis.config.unidade')}</label>
                <select
                  value={tipo.unidade_medida}
                  onChange={e => setTipo({...tipo, unidade_medida: e.target.value})}
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                    <option value="minutos">{t('kpis.config.minutos')}</option>
                    <option value="segundos">{t('kpis.config.segundos')}</option>
                    <option value="horas">{t('kpis.config.horas')}</option>
                    <option value="percentual">{t('kpis.config.percentual')}</option>
                    <option value="quantidade">{t('kpis.config.quantidade')}</option>
                    <option value="taxa">{t('kpis.config.taxa')}</option>
                    <option value="score">{t('kpis.config.score')}</option>
                </select>
            </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('kpis.config.meta')}</label>
                <input 
                  type="number" 
                  value={tipo.meta_objetivo} 
                  onChange={e => setTipo({...tipo, meta_objetivo: Number(e.target.value)})} 
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                  placeholder="Ex: 15"
                />
                <p className="text-xs text-slate-500 mt-1">{t('kpis.config.metaEm')} {tipo.unidade_medida}</p>
            </div>
             <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Cor de Identificação</label>
                <input 
                  type="color" 
                  value={tipo.cor_identificacao} 
                  onChange={e => setTipo({...tipo, cor_identificacao: e.target.value})} 
                  className="w-full p-1 h-10 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                />
            </div>
        </div>
        <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('kpis.config.status')}</label>
            <select
              value={tipo.status}
              onChange={e => setTipo({...tipo, status: e.target.value})}
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
                <option value="ativo">{t('kpis.config.ativo')}</option>
                <option value="inativo">{t('kpis.config.inativo')}</option>
            </select>
        </div>
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>{t('kpis.config.cancelar')}</Button>
        <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
          {isSubmitting ? t('kpis.config.aGuardar') : (tipo.id ? t('kpis.config.atualizar') : t('kpis.config.criar'))}
        </Button>
      </div>
    </form>
  );
};

// Componente principal de configuração
export default function ConfiguracaoKPIs({ isOpen, onClose, onUpdate }) {
  const { t } = useI18n();
  const [tiposKPI, setTiposKPI] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [editingTipo, setEditingTipo] = useState(null);
  const [deleteInfo, setDeleteInfo] = useState({ isOpen: false, id: null });

  useEffect(() => {
    if (isOpen) {
      loadTipos();
    }
  }, [isOpen]);

  const loadTipos = async () => {
    setIsLoading(true);
    try {
      const tiposData = await TipoKPI.list();
      setTiposKPI(tiposData);
    } catch (error) {
      console.error('Erro ao carregar tipos de KPI:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSuccess = () => {
    loadTipos();
    setIsFormVisible(false);
    setEditingTipo(null);
    if(onUpdate) onUpdate();
  };

  const handleEdit = (tipo) => {
    setEditingTipo(tipo);
    setIsFormVisible(true);
  };
  
  const handleDelete = (id) => {
    setDeleteInfo({ isOpen: true, id });
  };
  
  const handleDeleteConfirm = async () => {
    try {
      await TipoKPI.delete(deleteInfo.id);
      handleSuccess();
    } catch (error) {
      console.error("Erro ao deletar tipo de KPI:", error);
    } finally {
      setDeleteInfo({ isOpen: false, id: null });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-6 h-6 text-blue-600" />
            {t('kpis.config.configTiposKPI')}
          </DialogTitle>
        </DialogHeader>

        {isFormVisible ? (
          <FormTipoKPI 
            tipoInicial={editingTipo}
            onSuccess={handleSuccess}
            onCancel={() => { setIsFormVisible(false); setEditingTipo(null); }}
          />
        ) : (
          <>
            <Button onClick={() => { setEditingTipo(null); setIsFormVisible(true); }} className="mb-4">
              <Plus className="w-4 h-4 mr-2" /> {t('kpis.config.novoTipoKPI')}
            </Button>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold mb-2">{t('kpis.config.tiposExistentes')}</h3>
              {isLoading ? <p>{t('kpis.config.aCarregar')}</p> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('kpis.config.nome')}</TableHead>
                      <TableHead>{t('tarifas.category')}</TableHead>
                      <TableHead>{t('kpis.meta')}</TableHead>
                      <TableHead>{t('kpis.config.status')}</TableHead>
                      <TableHead>{t('tarifas.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tiposKPI.map(tipo => (
                      <TableRow key={tipo.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: tipo.cor_identificacao }}
                            />
                            {tipo.nome}
                          </div>
                        </TableCell>
                        <TableCell><Badge>{tipo.categoria}</Badge></TableCell>
                        <TableCell>{tipo.meta_objetivo} {tipo.unidade_medida || ''}</TableCell>
                        <TableCell>
                          <Badge variant={tipo.status === 'ativo' ? 'default' : 'secondary'}>
                            {tipo.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(tipo)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleDelete(tipo.id)}
                              className="text-red-600 hover:text-red-800 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </>
        )}
        
        <AlertModal
            isOpen={deleteInfo.isOpen}
            onClose={() => setDeleteInfo({ isOpen: false, id: null })}
            onConfirm={handleDeleteConfirm}
            title={t('kpis.config.confirmarExclusao')}
            message={t('kpis.config.confirmarExclusaoMsg')}
            type="warning"
            showCancel
        />
      </DialogContent>
    </Dialog>
  );
}
