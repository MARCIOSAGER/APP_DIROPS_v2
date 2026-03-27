
import React, { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, ClipboardCheck, FileText, CheckCircle, Clock } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { Inspecao } from '@/entities/Inspecao';
import { TipoInspecao } from '@/entities/TipoInspecao';
import { Aeroporto } from '@/entities/Aeroporto';
import { getAeroportosPermitidos, filtrarDadosPorAeroportoId } from '@/components/lib/userUtils';
import { useCompanyView } from '@/lib/CompanyViewContext';
import { useI18n } from '@/components/lib/i18n';
import { useAuth } from '@/lib/AuthContext';
import { useInspecoes } from '@/hooks/useInspecoes';

import InspecoesList from '../components/inspecoes/InspecoesList';
import FormInspecao from '../components/inspecoes/FormInspecao';
import TiposInspecaoConfig from '../components/inspecoes/TiposInspecaoConfig';

export default function Inspecoes() {
  const { t } = useI18n();
  const { effectiveEmpresaId } = useCompanyView();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const empId = effectiveEmpresaId || currentUser?.empresa_id;

  // Primary data via TanStack Query
  const { data: inspecoesRaw = [], isLoading: isQueryLoading } = useInspecoes({ empresaId: empId });

  // Secondary data: aeroportos, tiposInspecao (kept as useState per instructions)
  const [tiposInspecao, setTiposInspecao] = useState([]);
  const [aeroportos, setAeroportos] = useState([]);
  const [aeroportosAll, setAeroportosAll] = useState([]);
  const [secondaryLoaded, setSecondaryLoaded] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedTipo, setSelectedTipo] = useState(null);
  const [activeTab, setActiveTab] = useState('inspecoes');

  // Derived filtered inspecoes
  const inspecoes = useMemo(() => {
    if (!secondaryLoaded) return [];
    const inspecoesAtivas = inspecoesRaw.filter(i => i.status !== 'cancelada');
    return filtrarDadosPorAeroportoId(currentUser, inspecoesAtivas, 'aeroporto_id', aeroportosAll, effectiveEmpresaId);
  }, [inspecoesRaw, secondaryLoaded, aeroportosAll, currentUser, effectiveEmpresaId]);

  const isLoading = isQueryLoading && !secondaryLoaded;

  // Load secondary data
  useEffect(() => {
    (async () => {
      try {
        const [tiposData, aeroportosData] = await Promise.all([
          TipoInspecao.list(),
          empId ? Aeroporto.filter({ empresa_id: empId }) : Aeroporto.list()
        ]);
        setAeroportosAll(aeroportosData);
        setAeroportos(getAeroportosPermitidos(currentUser, aeroportosData, effectiveEmpresaId));
        setTiposInspecao(tiposData);
        setSecondaryLoaded(true);
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
      }
    })();
  }, [effectiveEmpresaId]);

  const loadData = () => {
    queryClient.invalidateQueries({ queryKey: ['inspecoes', empId] });
  };

  const handleNovaInspecao = (tipo) => {
    setSelectedTipo(tipo);
    setIsFormOpen(true);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setSelectedTipo(null);
    loadData();
  };

  return (
    <div className="p-6 bg-slate-50 dark:bg-slate-950 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">{t('page.inspecoes.title')}</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">{t('page.inspecoes.subtitle')}</p>
          </div>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{t('inspecoes.total')}</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{inspecoes.length}</p>
                </div>
                <ClipboardCheck className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{t('inspecoes.concluidas')}</p>
                  <p className="text-3xl font-bold text-green-600">
                    {inspecoes.filter(i => i.status === 'concluida').length}
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{t('inspecoes.em_andamento')}</p>
                  <p className="text-3xl font-bold text-orange-600">
                    {inspecoes.filter(i => i.status === 'em_andamento').length}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{t('inspecoes.taxa_conformidade')}</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {inspecoes.length > 0 ? 
                      `${Math.round((inspecoes.filter(i => i.status === 'aprovada').length / inspecoes.length) * 100)}%`
                      : '0%'}
                  </p>
                </div>
                <FileText className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="inspecoes" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="inspecoes" className="flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4" />
              {t('inspecoes.tab_inspecoes')}
            </TabsTrigger>
            <TabsTrigger value="nova" className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              {t('inspecoes.tab_nova')}
            </TabsTrigger>
            <TabsTrigger value="configurar" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              {t('inspecoes.tab_configurar')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="inspecoes" className="space-y-6">
            <InspecoesList 
              inspecoes={inspecoes}
              tiposInspecao={tiposInspecao}
              aeroportos={aeroportos}
              isLoading={isLoading}
              onReload={loadData}
            />
          </TabsContent>

          <TabsContent value="nova" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tiposInspecao.filter(ti => ti.status === 'ativo').map((tipo) => (
                <Card key={tipo.id} className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => handleNovaInspecao(tipo)}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ClipboardCheck className="w-5 h-5 text-blue-600" />
                      {tipo.nome}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-slate-600 dark:text-slate-400 text-sm mb-3">{tipo.descricao}</p>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                        {t('inspecoes.frequencia')}: {(tipo.frequencia || '').replace('_', ' ')}
                      </span>
                      <Button size="sm">
                        {t('inspecoes.iniciar')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            {tiposInspecao.filter(ti => ti.status === 'ativo').length === 0 && (
              <Card>
                <CardContent className="text-center py-12">
                  <ClipboardCheck className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                  <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    {t('inspecoes.nenhum_tipo_configurado')}
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 mb-4">
                    {t('inspecoes.configurar_tipos_primeiro')}
                  </p>
                  <Button onClick={() => document.querySelector('button[data-state="inactive"][value="configurar"]')?.click()}>
                    {t('inspecoes.tab_configurar')}
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="configurar" className="space-y-6">
            <TiposInspecaoConfig 
              tiposInspecao={tiposInspecao}
              onUpdate={loadData}
            />
          </TabsContent>
        </Tabs>

        {isFormOpen && selectedTipo && (
          <FormInspecao
            isOpen={isFormOpen}
            onClose={handleFormClose}
            tipoInspecao={selectedTipo}
            aeroportos={aeroportos}
            currentUser={currentUser}
          />
        )}
      </div>
    </div>
  );
}
