
import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, RefreshCw, FileDown, Settings, AlertTriangle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useQueryClient } from '@tanstack/react-query';

import { Credenciamento as CredenciamentoEntity } from '@/entities/Credenciamento';
import { Empresa } from '@/entities/Empresa';
import { Aeroporto } from '@/entities/Aeroporto';
import { AreaAcesso } from '@/entities/AreaAcesso';
import { useAuth } from '@/lib/AuthContext';
import { useCredenciamentos } from '@/hooks/useCredenciamentos';

import CredenciamentoStats from '../components/credenciamento/CredenciamentoStats';
import CredenciamentoList from '../components/credenciamento/CredenciamentoList';
import FormCredenciamento from '../components/credenciamento/FormCredenciamento';
import ConfiguracaoCredenciamento from '../components/credenciamento/ConfiguracaoCredenciamento';
import SendEmailModal from '../components/shared/SendEmailModal';
import { downloadAsCSV } from '../components/lib/export';
import AlertModal from '../components/shared/AlertModal';
import { hasUserProfile } from '@/components/lib/userUtils';
import { useI18n } from '@/components/lib/i18n';

export default function Credenciamento() {
  const { t } = useI18n();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [empresas, setEmpresas] = useState([]);
  const [aeroportos, setAeroportos] = useState([]);
  const [areasAcesso, setAreasAcesso] = useState([]);
  const [secondaryLoading, setSecondaryLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCredenciamento, setEditingCredenciamento] = useState(null);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('credenciamentos');
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [alertInfo, setAlertInfo] = useState({ isOpen: false, title: '', message: '' });

  // Pagination state (internal users only)
  const PAGE_SIZE = 50;
  const [currentPage, setCurrentPage] = useState(1);

  const isGestorEmpresa = hasUserProfile(currentUser, 'gestor_empresa');

  // Primary data via useQuery
  const {
    data: credResult,
    isLoading: credLoading,
  } = useCredenciamentos({
    empresaId: currentUser?.empresa_id,
    isGestorEmpresa,
    page: currentPage,
    pageSize: PAGE_SIZE,
  });

  const credenciamentos = credResult?.data ?? [];
  const totalPages = credResult?.totalPages ?? 1;
  const totalRegistos = credResult?.total ?? 0;
  const isLoading = credLoading || secondaryLoading;

  // Secondary data loading (aeroportos, empresas, areas)
  useEffect(() => {
    let cancelled = false;
    const loadSecondary = async () => {
      setSecondaryLoading(true);
      setHasError(false);
      setErrorMessage('');

      if (isGestorEmpresa) {
        // Gestor empresa: load with fallbacks
        let aeroportosData = [];
        let areasData = [];
        let empresasData = [];

        try {
          aeroportosData = await (currentUser.empresa_id ? Aeroporto.filter({ empresa_id: currentUser.empresa_id }) : Aeroporto.list());
          aeroportosData = aeroportosData.filter(a => a.pais === 'AO');
        } catch (aerError) {
          console.warn('Erro ao carregar aeroportos, usando fallback:', aerError);
          aeroportosData = [
            { codigo_icao: 'FNLU', nome: 'Aeroporto Internacional 4 de Fevereiro - Luanda', pais: 'AO' },
            { codigo_icao: 'FNUB', nome: 'Aeroporto de Cabinda', pais: 'AO' },
            { codigo_icao: 'FNHU', nome: 'Aeroporto de Huambo', pais: 'AO' }
          ];
        }

        try {
          areasData = await AreaAcesso.list();
        } catch (areasError) {
          console.warn('Erro ao carregar areas, usando fallback:', areasError);
          areasData = [
            { id: '1', nome: 'Terminal de Passageiros', status: 'ativo' },
            { id: '2', nome: 'Área de Carga', status: 'ativo' },
            { id: '3', nome: 'Pista', status: 'ativo' }
          ];
        }

        if (currentUser.empresa_id) {
          try {
            const empresaData = await Empresa.get(currentUser.empresa_id);
            empresasData = empresaData ? [empresaData] : [];
          } catch (empresaError) {
            console.warn('Erro ao carregar empresa:', empresaError);
            empresasData = [{
              id: currentUser.empresa_id,
              nome: 'Minha Empresa',
              email_principal: currentUser.email || 'empresa@exemplo.com',
              responsavel_nome: currentUser.full_name || 'Responsavel',
              responsavel_email: currentUser.email || 'responsavel@exemplo.com'
            }];
          }
        }

        if (!cancelled) {
          setAeroportos(aeroportosData);
          setAreasAcesso(areasData);
          setEmpresas(empresasData);
        }
      } else {
        // Internal user
        try {
          const [empresasData, aeroportosData, areasAcessoData] = await Promise.all([
            Empresa.list(),
            currentUser?.empresa_id ? Aeroporto.filter({ empresa_id: currentUser.empresa_id }) : Aeroporto.list(),
            AreaAcesso.list()
          ]);

          if (!cancelled) {
            setEmpresas(empresasData);
            setAeroportos(aeroportosData.filter(a => a.pais === 'AO'));
            setAreasAcesso(areasAcessoData);
          }
        } catch (error) {
          console.error('Erro ao carregar dados:', error);
          if (!cancelled) {
            setHasError(true);
            if (error.message?.includes('403') || error.response?.status === 403) {
              setErrorMessage('Acesso negado. Algumas funcionalidades podem nao estar disponiveis.');
            } else {
              setErrorMessage('Nao foi possivel carregar os dados. Verifique a sua conexao ou tente novamente mais tarde.');
            }
          }
        }
      }

      if (!cancelled) setSecondaryLoading(false);
    };

    loadSecondary();
    return () => { cancelled = true; };
  }, []);

  const loadData = useCallback((page) => {
    if (page && page !== currentPage) {
      setCurrentPage(page);
    }
    queryClient.invalidateQueries({ queryKey: ['credenciamentos'] });
  }, [queryClient, currentPage]);

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    setCurrentPage(newPage);
  };

  const handleFormSubmit = async (formData) => {
    try {
      // FILTRO CRÍTICO: Se for gestor de empresa, forçar empresa_solicitante_id
      if (hasUserProfile(currentUser, 'gestor_empresa') && currentUser.empresa_id) {
        formData.empresa_solicitante_id = currentUser.empresa_id;
      }

      // O número do protocolo será gerado automaticamente no backend
      if (!editingCredenciamento) {
        formData.data_solicitacao = new Date().toISOString();
        formData.status = 'pendente';
      }

      if (editingCredenciamento) {
        await CredenciamentoEntity.update(editingCredenciamento.id, formData);
      } else {
        await CredenciamentoEntity.create(formData);
      }

      setIsFormOpen(false);
      setEditingCredenciamento(null);
      loadData(1);
    } catch (error) {
      console.error('Erro ao salvar credenciamento:', error);
      setAlertInfo({ 
        isOpen: true, 
        title: 'Erro ao Salvar', 
        message: 'Ocorreu um erro ao salvar o credenciamento.' 
      });
    }
  };

  const handleEdit = (credenciamento) => {
    // FILTRO CRÍTICO: Verificar se o gestor de empresa pode editar este credenciamento
    if (hasUserProfile(currentUser, 'gestor_empresa') && currentUser.empresa_id) {
      if (credenciamento.empresa_solicitante_id !== currentUser.empresa_id) {
        setAlertInfo({ 
          isOpen: true, 
          title: 'Permissão Negada', 
          message: 'Você não tem permissão para editar este credenciamento.' 
        });
        return;
      }
    }
    
    setEditingCredenciamento(credenciamento);
    setIsFormOpen(true);
  };

  const handleExportCSV = () => {
    if (credenciamentos.length === 0) {
      setAlertInfo({ 
        isOpen: true, 
        title: 'Exportação', 
        message: 'Não há credenciamentos disponíveis para exportar.' 
      });
      return;
    }

    try {
      const dataToExport = credenciamentos.map(c => ({
        'Protocolo': c.protocolo_numero || '',
        'Empresa': getEmpresaNome(c.empresa_solicitante_id) || '',
        'Tipo': c.tipo_credencial === 'pessoa' ? 'Pessoa' : 'Viatura',
        'Nome/Matrícula': c.nome_completo || c.matricula_viatura || '',
        'Aeroporto': getAeroportoNome(c.aeroporto_id) || '',
        'Status': c.status || '',
        'Data Solicitação': c.data_solicitacao ? new Date(c.data_solicitacao).toLocaleDateString('pt-AO') : ''
      }));

      const success = downloadAsCSV(dataToExport, `credenciamentos_${new Date().toISOString().split('T')[0]}`);
      if (!success) {
        // Agora mostra um alerta se a função de exportação falhar
        setAlertInfo({ 
          isOpen: true, 
          title: 'Erro de Exportação', 
          message: 'Não foi possível gerar o ficheiro para exportação. Verifique se os dados estão corretos.' 
        });
      }
    } catch (error) {
      console.error("Erro ao preparar dados para exportação:", error);
      setAlertInfo({ 
        isOpen: true, 
        title: 'Erro de Exportação', 
        message: 'Ocorreu um erro inesperado ao preparar os dados para exportação.' 
      });
    }
  };

  const getEmpresaNome = (empresaId) => {
    const empresa = empresas.find(e => e.id === empresaId);
    return empresa ? empresa.nome : 'N/A';
  };

  const getAeroportoNome = (aeroportoId) => {
    const aeroporto = aeroportos.find(a => a.codigo_icao === aeroportoId);
    return aeroporto ? aeroporto.nome : aeroportoId || 'N/A';
  };

  return (
    <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-950 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">{t('page.credenciamento.title')}</h1>
            <p className="text-slate-600 dark:text-slate-400">
              {isGestorEmpresa
                ? t('credenciamento.subtitleGestor')
                : t('credenciamento.subtitleInterno')
              }
            </p>
          </div>
          <div className="flex flex-wrap gap-2 w-full lg:w-auto">
            <Button variant="outline" onClick={loadData} disabled={isLoading} className="border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              {t('credenciamento.atualizar')}
            </Button>
            <Button variant="outline" onClick={handleExportCSV} className="border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
              <FileDown className="w-4 h-4 mr-2" />
              {t('credenciamento.exportarCSV')}
            </Button>
            <Button onClick={() => { setEditingCredenciamento(null); setIsFormOpen(true); }} className="bg-blue-500 hover:bg-blue-600 text-white">
              <Plus className="w-4 h-4 mr-2" />
              {t('credenciamento.novaSolicitacao')}
            </Button>
          </div>
        </div>

        {hasError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        <CredenciamentoStats credenciamentos={credenciamentos} isLoading={isLoading} />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="credenciamentos">{t('credenciamento.tabCredenciamentos')}</TabsTrigger>
            {!isGestorEmpresa && (
              <TabsTrigger value="configuracao">
                <Settings className="w-4 h-4 mr-2" />
                {t('credenciamento.tabConfiguracao')}
              </TabsTrigger>
            )}
          </TabsList>
          
          <TabsContent value="credenciamentos" className="space-y-6">
            <CredenciamentoList
              credenciamentos={credenciamentos}
              empresas={empresas}
              aeroportos={aeroportos}
              isLoading={isLoading}
              onEdit={handleEdit}
              currentUser={currentUser}
            />
            {/* Pagination (internal users) */}
            {!isGestorEmpresa && totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  {t('common.pagina') || 'Pagina'} {currentPage} {t('common.de') || 'de'} {totalPages} ({totalRegistos} {t('common.registos') || 'registos'})
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage <= 1}
                  >
                    {t('common.anterior') || 'Anterior'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                  >
                    {t('common.seguinte') || 'Seguinte'}
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {!isGestorEmpresa && (
            <TabsContent value="configuracao" className="space-y-6">
              <ConfiguracaoCredenciamento 
                initialEmpresas={empresas}
                initialAreasAcesso={areasAcesso}
                onUpdate={loadData}
              />
            </TabsContent>
          )}
        </Tabs>
      </div>

      {isFormOpen && (
        <FormCredenciamento
          isOpen={isFormOpen}
          onClose={() => { setIsFormOpen(false); setEditingCredenciamento(null); }}
          onSubmit={handleFormSubmit}
          credenciamentoInicial={editingCredenciamento}
          empresas={empresas}
          aeroportos={aeroportos}
          areasAcesso={areasAcesso}
          currentUser={currentUser}
        />
      )}

      {isEmailModalOpen && (
        <SendEmailModal
          isOpen={isEmailModalOpen}
          onClose={() => setIsEmailModalOpen(false)}
        />
      )}

      {/* Alerta Modal */}
      <AlertModal
        isOpen={alertInfo.isOpen}
        onClose={() => setAlertInfo({ isOpen: false, title: '', message: '' })}
        title={alertInfo.title}
        message={alertInfo.message}
      />
    </div>
  );
}
