import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Trash2, RotateCcw, AlertTriangle, ClipboardCheck, FileText,
  Plane, Search, Loader2, CheckCircle, XCircle
} from 'lucide-react';

import { Inspecao } from '@/entities/Inspecao';
import { Proforma } from '@/entities/Proforma';
import { Voo } from '@/entities/Voo';
import { ItemChecklist } from '@/entities/ItemChecklist';
import { Aeroporto } from '@/entities/Aeroporto';
import { User } from '@/entities/User';
import { useCompanyView } from '@/lib/CompanyViewContext';
import { isSuperAdmin, getAeroportosPermitidos } from '@/components/lib/userUtils';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { useI18n } from '@/components/lib/i18n';

export default function Lixeira() {
  const { t } = useI18n();
  const { effectiveEmpresaId } = useCompanyView();
  const [currentUser, setCurrentUser] = useState(null);
  const [aeroportos, setAeroportos] = useState([]);
  const [activeTab, setActiveTab] = useState('inspecoes');
  const [isLoading, setIsLoading] = useState(true);
  const [busca, setBusca] = useState('');

  // Data
  const [inspecoesCanceladas, setInspecoesCanceladas] = useState([]);
  const [proformasCanceladas, setProformasCanceladas] = useState([]);
  const [checklistInativos, setChecklistInativos] = useState([]);

  // Action state
  const [actionLoading, setActionLoading] = useState(null);
  const [confirmInfo, setConfirmInfo] = useState({ isOpen: false, type: '', item: null, action: '' });
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    loadData();
  }, [effectiveEmpresaId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const user = await User.me();
      setCurrentUser(user);

      const empresaIdFiltro = effectiveEmpresaId || user.empresa_id;
      const aeroportosData = await (empresaIdFiltro ? Aeroporto.filter({ empresa_id: empresaIdFiltro }) : Aeroporto.list());
      const aeroportosFiltrados = getAeroportosPermitidos(user, aeroportosData, effectiveEmpresaId);
      setAeroportos(aeroportosFiltrados);
      const idsPermitidos = new Set(aeroportosFiltrados.map(a => a.id));

      // Load cancelled inspections
      const allInspecoes = await Inspecao.list('-updated_date');
      let canceladas = allInspecoes.filter(i => i.status === 'cancelada');
      if (!isSuperAdmin(user) || effectiveEmpresaId) {
        canceladas = canceladas.filter(i => idsPermitidos.has(i.aeroporto_id));
      }
      setInspecoesCanceladas(canceladas);

      // Load cancelled proformas
      const allProformas = await Proforma.list('-created_date');
      let proformasCancelled = allProformas.filter(p => p.status === 'cancelada');
      if (!isSuperAdmin(user) || effectiveEmpresaId) {
        proformasCancelled = proformasCancelled.filter(p => idsPermitidos.has(p.aeroporto_id));
      }
      setProformasCanceladas(proformasCancelled);

      // Load inactive checklist items
      const allChecklist = await ItemChecklist.list();
      const inativos = allChecklist.filter(i => i.status === 'inativo');
      setChecklistInativos(inativos);

    } catch (error) {
      console.error('Erro ao carregar lixeira:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async (type, item) => {
    setActionLoading(item.id);
    try {
      if (type === 'inspecao') {
        await Inspecao.update(item.id, { status: 'em_andamento' });
      } else if (type === 'proforma') {
        await Proforma.update(item.id, { status: 'emitida' });
      } else if (type === 'checklist') {
        await ItemChecklist.update(item.id, { status: 'ativo' });
      }
      setMessage({ type: 'success', text: 'Item restaurado com sucesso.' });
      await loadData();
    } catch (error) {
      console.error('Erro ao restaurar:', error);
      setMessage({ type: 'error', text: 'Erro ao restaurar item.' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeletePermanent = async () => {
    const { type, item } = confirmInfo;
    setConfirmInfo({ isOpen: false, type: '', item: null, action: '' });
    setActionLoading(item.id);
    try {
      if (type === 'inspecao') {
        await Inspecao.delete(item.id);
      } else if (type === 'proforma') {
        await Proforma.delete(item.id);
      } else if (type === 'checklist') {
        await ItemChecklist.delete(item.id);
      }
      setMessage({ type: 'success', text: 'Item eliminado permanentemente.' });
      await loadData();
    } catch (error) {
      console.error('Erro ao eliminar:', error);
      setMessage({ type: 'error', text: 'Erro ao eliminar item. Pode haver dados dependentes.' });
    } finally {
      setActionLoading(null);
    }
  };

  const getAeroportoNome = (id) => {
    return aeroportos.find(a => a.id === id)?.nome || id || '—';
  };

  const totalItens = inspecoesCanceladas.length + proformasCanceladas.length + checklistInativos.length;

  const filteredInspecoes = useMemo(() => {
    if (!busca.trim()) return inspecoesCanceladas;
    const q = busca.toLowerCase();
    return inspecoesCanceladas.filter(i =>
      i.tipo_inspecao_nome?.toLowerCase().includes(q) ||
      getAeroportoNome(i.aeroporto_id).toLowerCase().includes(q) ||
      i.inspetor_responsavel?.toLowerCase().includes(q)
    );
  }, [inspecoesCanceladas, busca, aeroportos]);

  const filteredProformas = useMemo(() => {
    if (!busca.trim()) return proformasCanceladas;
    const q = busca.toLowerCase();
    return proformasCanceladas.filter(p =>
      p.numero_proforma?.toLowerCase().includes(q) ||
      p.companhia_nome?.toLowerCase().includes(q)
    );
  }, [proformasCanceladas, busca]);

  const filteredChecklist = useMemo(() => {
    if (!busca.trim()) return checklistInativos;
    const q = busca.toLowerCase();
    return checklistInativos.filter(c =>
      c.item?.toLowerCase().includes(q) ||
      c.criterio?.toLowerCase().includes(q)
    );
  }, [checklistInativos, busca]);

  return (
    <div className="p-6 bg-slate-50 dark:bg-slate-950 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-3">
              <Trash2 className="w-8 h-8 text-slate-500 dark:text-slate-400" />
              {t('page.lixeira.title')}
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              {t('page.lixeira.subtitle')}
            </p>
          </div>
          <Badge variant="outline" className="text-lg px-4 py-2">
            {totalItens} {totalItens === 1 ? 'item' : 'itens'}
          </Badge>
        </div>

        {/* Message */}
        {message.text && (
          <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
            message.type === 'success' ? 'bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300' : 'bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
          }`}>
            {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            {message.text}
            <button onClick={() => setMessage({ type: '', text: '' })} className="ml-auto text-sm underline">Fechar</button>
          </div>
        )}

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Pesquisar na lixeira..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Warning */}
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            A eliminação permanente não pode ser desfeita. Restaurar um item devolve-o ao seu módulo original com o status anterior.
          </p>
        </div>

        {isLoading ? (
          <div className="text-center py-16">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400 mb-3" />
            <p className="text-slate-500 dark:text-slate-400">A carregar itens da lixeira...</p>
          </div>
        ) : totalItens === 0 ? (
          <div className="text-center py-16">
            <Trash2 className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <h3 className="text-lg font-medium text-slate-600 dark:text-slate-400">Lixeira vazia</h3>
            <p className="text-slate-400 dark:text-slate-500">Não existem itens cancelados ou inativos.</p>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="inspecoes" className="flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4" />
                Inspeções ({inspecoesCanceladas.length})
              </TabsTrigger>
              <TabsTrigger value="proformas" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Proformas ({proformasCanceladas.length})
              </TabsTrigger>
              <TabsTrigger value="checklist" className="flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4" />
                Itens Checklist ({checklistInativos.length})
              </TabsTrigger>
            </TabsList>

            {/* Inspeções Canceladas */}
            <TabsContent value="inspecoes">
              {filteredInspecoes.length === 0 ? (
                <EmptyTab label="inspeções canceladas" />
              ) : (
                <div className="space-y-3">
                  {filteredInspecoes.map(insp => (
                    <TrashItem
                      key={insp.id}
                      icon={<ClipboardCheck className="w-5 h-5 text-purple-500" />}
                      title={insp.tipo_inspecao_nome || 'Inspeção'}
                      subtitle={`${getAeroportoNome(insp.aeroporto_id)} • ${insp.data_inspecao ? new Date(insp.data_inspecao).toLocaleDateString('pt-PT') : '—'}`}
                      detail={`Inspetor: ${insp.inspetor_responsavel || '—'}`}
                      isLoading={actionLoading === insp.id}
                      onRestore={() => handleRestore('inspecao', insp)}
                      onDelete={() => setConfirmInfo({ isOpen: true, type: 'inspecao', item: insp, action: 'delete' })}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Proformas Canceladas */}
            <TabsContent value="proformas">
              {filteredProformas.length === 0 ? (
                <EmptyTab label="proformas canceladas" />
              ) : (
                <div className="space-y-3">
                  {filteredProformas.map(prof => (
                    <TrashItem
                      key={prof.id}
                      icon={<FileText className="w-5 h-5 text-blue-500" />}
                      title={`Proforma ${prof.numero_proforma || '—'}`}
                      subtitle={`${prof.companhia_nome || '—'} • ${prof.created_date ? new Date(prof.created_date).toLocaleDateString('pt-PT') : '—'}`}
                      detail={prof.periodo_inicio && prof.periodo_fim ? `Período: ${new Date(prof.periodo_inicio).toLocaleDateString('pt-PT')} — ${new Date(prof.periodo_fim).toLocaleDateString('pt-PT')}` : null}
                      isLoading={actionLoading === prof.id}
                      onRestore={() => handleRestore('proforma', prof)}
                      onDelete={() => setConfirmInfo({ isOpen: true, type: 'proforma', item: prof, action: 'delete' })}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Itens Checklist Inativos */}
            <TabsContent value="checklist">
              {filteredChecklist.length === 0 ? (
                <EmptyTab label="itens de checklist inativos" />
              ) : (
                <div className="space-y-3">
                  {filteredChecklist.map(item => (
                    <TrashItem
                      key={item.id}
                      icon={<ClipboardCheck className="w-5 h-5 text-orange-500" />}
                      title={item.item || 'Item de Checklist'}
                      subtitle={`Critério: ${item.criterio || '—'}`}
                      detail={item.categoria ? `Categoria: ${item.categoria}` : null}
                      isLoading={actionLoading === item.id}
                      onRestore={() => handleRestore('checklist', item)}
                      onDelete={() => setConfirmInfo({ isOpen: true, type: 'checklist', item, action: 'delete' })}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Confirm Delete Modal */}
      {confirmInfo.isOpen && (
        <ConfirmModal
          isOpen={confirmInfo.isOpen}
          onClose={() => setConfirmInfo({ isOpen: false, type: '', item: null, action: '' })}
          onConfirm={handleDeletePermanent}
          title="Eliminar Permanentemente"
          message="Esta ação não pode ser desfeita. O item e todos os dados associados serão removidos do sistema. Tem a certeza?"
          confirmText="Eliminar"
          variant="destructive"
        />
      )}
    </div>
  );
}

function TrashItem({ icon, title, subtitle, detail, isLoading, onRestore, onDelete }) {
  return (
    <Card className="border-slate-200 dark:border-slate-700">
      <CardContent className="p-4 flex items-center gap-4">
        <div className="flex-shrink-0 p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-900 dark:text-slate-100 truncate">{title}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
          {detail && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{detail}</p>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={onRestore}
            disabled={isLoading}
            className="text-green-600 hover:text-green-700 hover:bg-green-50"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-1" />}
            Restaurar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onDelete}
            disabled={isLoading}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Eliminar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyTab({ label }) {
  return (
    <div className="text-center py-12">
      <Trash2 className="w-10 h-10 mx-auto text-slate-300 mb-3" />
      <p className="text-slate-500 dark:text-slate-400">Não existem {label}.</p>
    </div>
  );
}
