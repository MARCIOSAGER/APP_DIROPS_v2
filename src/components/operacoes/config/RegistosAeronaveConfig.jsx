import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, Trash2, Search, FileDown, Filter, X, Upload, Plane, Building } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Select from '@/components/ui/select';
import Combobox from '@/components/ui/combobox';
import { RegistoAeronave } from '@/entities/RegistoAeronave';
import { Voo } from '@/entities/Voo';
import { CompanhiaAerea } from '@/entities/CompanhiaAerea';
import { User } from '@/entities/User';
import { downloadAsCSV } from '@/components/lib/export';
import AlertModal from '@/components/shared/AlertModal';
import UploadCsvModal from '@/components/shared/UploadCsvModal';
import SortableTableHeader from '@/components/shared/SortableTableHeader';
import { normalizeAircraftRegistration, formatAircraftRegistration } from '@/components/lib/utils';
import useSubmitGuard from '@/hooks/useSubmitGuard';

export const FormRegisto = ({ registo, onSave, onCancel, modelos, companhias, isSubmitting }) => {
  const { guardedSubmit } = useSubmitGuard();
  // Inicializar com dados do registo (se estiver editando)
  const [formData, setFormData] = useState(registo || {
    registo: '',
    id_modelo_aeronave: '',
    id_companhia_aerea: '',
    mtow_kg: 0,
    total_assentos: 0, // Corrigido: Inicializar com 0
    num_first: 0,
    num_business: 0,
    num_premium: 0,
    num_economy: 0
  });

  const handleChange = (field, value) => {
    let updatedData = { ...formData, [field]: value };

    // Auto-fill total_assentos based on selected model
    if (field === 'id_modelo_aeronave' && value) {
      const selectedModel = modelos.find((m) => m.id === value);
      if (selectedModel && selectedModel.total_assentos_modelo) {
        updatedData.total_assentos = selectedModel.total_assentos_modelo;
      }
    }

    setFormData(updatedData);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // CRÍTICO: Normalizar o registo antes de enviar
    const registoNormalizado = normalizeAircraftRegistration(formData.registo);

    if (!registoNormalizado) {
      alert('Por favor, forneça um registo válido.');
      return;
    }

    // VALIDAÇÃO CRÍTICA: MTOW deve ser no mínimo 1000 kg
    const mtowValue = parseFloat(formData.mtow_kg);
    if (!mtowValue || mtowValue < 1000) {
      alert('⚠️ ATENÇÃO: O MTOW (Peso Máximo de Descolagem) deve ser no mínimo 1000 kg.\n\nNenhuma aeronave comercial ou de transporte tem peso inferior a 1000 kg.\n\nPor favor, verifique e corrija o valor inserido.');
      return;
    }

    guardedSubmit(async () => {
      // NOVO: Garantir que todos os campos numéricos sejam números válidos
      const dataToSave = {
        ...formData,
        registo: registoNormalizado,
        registo_normalizado: registoNormalizado,
        // Converter strings vazias ou valores inválidos para 0
        mtow_kg: mtowValue,
        total_assentos: parseFloat(formData.total_assentos) || 0,
        num_first: parseFloat(formData.num_first) || 0,
        num_business: parseFloat(formData.num_business) || 0,
        num_premium: parseFloat(formData.num_premium) || 0,
        num_economy: parseFloat(formData.num_economy) || 0
      };

      await onSave(dataToSave);
    });
  };

  const modeloOptions = useMemo(() => modelos.map((m) => ({
    value: m.id,
    label: `${m.modelo} (${m.codigo_icao})`
  })), [modelos]);

  const companhiaOptions = useMemo(() => companhias.map((c) => ({
    value: c.id,
    label: `${c.nome} (${c.codigo_icao})`
  })), [companhias]);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Matrícula / Registo *</Label>
        <Input
          value={formData.registo || ''}
          onChange={(e) => handleChange('registo', e.target.value)}
          placeholder="Ex: D2-EUA, D2 EUA, d2eua (será normalizado automaticamente)"
          required />

        <p className="text-xs text-slate-500 mt-1">
          Será salvo como: {normalizeAircraftRegistration(formData.registo) || '(digite o registo)'}
        </p>
      </div>
      <div>
        <Label>Modelo da Aeronave *</Label>
        <Combobox
          options={modeloOptions}
          value={formData.id_modelo_aeronave || ''}
          onValueChange={(value) => handleChange('id_modelo_aeronave', value)}
          placeholder="Selecione o modelo..." />

      </div>
      <div>
        <Label>Companhia Aérea Proprietária *</Label>
        <Combobox
          options={companhiaOptions}
          value={formData.id_companhia_aerea || ''}
          onValueChange={(value) => handleChange('id_companhia_aerea', value)}
          placeholder="Selecione a companhia..." />

      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>MTOW (kg) *</Label>
          <Input
            type="number"
            min="1000"
            step="1"
            value={formData.mtow_kg || ''}
            onChange={(e) => handleChange('mtow_kg', e.target.value)}
            placeholder="Ex: 75000"
            required />
          <p className="text-xs text-amber-600 mt-1 font-medium">
            ⚠️ Mínimo: 1000 kg (4 dígitos obrigatórios)
          </p>
        </div>
        <div>
          <Label>Total de Assentos</Label>
          <Input
            type="number"
            value={formData.total_assentos || ''}
            onChange={(e) => handleChange('total_assentos', e.target.value)} // Corrigido: Passar o valor bruto do input
          />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-4">
        <div>
          <Label>Assentos Primeira Classe</Label>
          <Input
            type="number"
            value={formData.num_first || ''}
            onChange={(e) => handleChange('num_first', e.target.value)} // Corrigido: Passar o valor bruto do input
          />
        </div>
        <div>
          <Label>Assentos Executiva</Label>
          <Input
            type="number"
            value={formData.num_business || ''}
            onChange={(e) => handleChange('num_business', e.target.value)} // Corrigido: Passar o valor bruto do input
          />
        </div>
        <div>
          <Label>Assentos Premium</Label>
          <Input
            type="number"
            value={formData.num_premium || ''}
            onChange={(e) => handleChange('num_premium', e.target.value)} // Corrigido: Passar o valor bruto do input
          />
        </div>
        <div>
          <Label>Assentos Económica</Label>
          <Input
            type="number"
            value={formData.num_economy || ''}
            onChange={(e) => handleChange('num_economy', e.target.value)} // Corrigido: Passar o valor bruto do input
          />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancelar</Button>
        <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
          {isSubmitting ? 'Salvando...' : 'Salvar'}
        </Button>
      </DialogFooter>
    </form>);

};

export default function RegistosAeronaveConfig({ registos, modelos, companhias, onReload }) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRegisto, setEditingRegisto] = useState(null);
  const [alertInfo, setAlertInfo] = useState({ isOpen: false, type: 'info', title: '', message: '' });
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState(null); // Added state for current user

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await User.me();
        setCurrentUser(user);
      } catch (error) {
        console.error('Erro ao carregar utilizador:', error);
      }
    };
    loadUser();
  }, []);

  const isAdmin = currentUser?.role === 'admin' ||
  currentUser?.perfis && currentUser.perfis.includes('administrador');

  // Filters state
  const [filtros, setFiltros] = useState({
    companhia: 'todos',
    modelo: 'todos',
    busca: ''
  });

  // Sorting state
  const [sortField, setSortField] = useState('registo');
  const [sortDirection, setSortDirection] = useState('asc');

  const clearAllFilters = () => {
    setFiltros({
      companhia: 'todos',
      modelo: 'todos',
      busca: ''
    });
  };

  const handleSort = (field, direction) => {
    setSortField(field);
    setSortDirection(direction);
  };

  // Memoized filtered and sorted registos
  const registosFiltrados = useMemo(() => {
    let filtered = registos.filter((r) => {
      const modelo = modelos.find((m) => m.id === r.id_modelo_aeronave);
      const companhia = companhias.find((c) => c.id === r.id_companhia_aerea);

      const matchesSearch = filtros.busca === '' ||
      r.registo?.toLowerCase().includes(filtros.busca.toLowerCase()) ||
      modelo?.modelo?.toLowerCase().includes(filtros.busca.toLowerCase()) ||
      companhia?.nome?.toLowerCase().includes(filtros.busca.toLowerCase());

      const matchesModel = filtros.modelo === 'todos' || r.id_modelo_aeronave === filtros.modelo;
      const matchesCompany = filtros.companhia === 'todos' || r.id_companhia_aerea === filtros.companhia;

      return matchesSearch && matchesModel && matchesCompany;
    });

    // Enriquecer os registos com informações dos modelos e companhias
    const enrichedAndFiltered = filtered.map((r) => {
      const modelo = modelos.find((m) => m.id === r.id_modelo_aeronave);
      const companhia = companhias.find((c) => c.id === r.id_companhia_aerea);

      return {
        ...r,
        modelo_nome: modelo?.modelo || modelo?.codigo_iata || modelo?.codigo_icao || 'Modelo não encontrado',
        companhia_nome: companhia?.nome || 'Companhia não encontrada'
      };
    });

    // Sort
    const sorted = [...enrichedAndFiltered].sort((a, b) => {
      let aValue, bValue;

      // Handle sorting for enriched fields, otherwise use direct field
      if (sortField === 'modelo') {
        aValue = a.modelo_nome;
        bValue = b.modelo_nome;
      } else if (sortField === 'companhia') {
        aValue = a.companhia_nome;
        bValue = b.companhia_nome;
      } else if (['mtow_kg', 'total_assentos'].includes(sortField)) {
        aValue = parseFloat(a[sortField]) || 0;
        bValue = parseFloat(b[sortField]) || 0;
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      } else if (sortField === 'updated_date') {
        aValue = new Date(a.updated_date || a.created_date).getTime();
        bValue = new Date(b.updated_date || b.created_date).getTime();
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      } else
      {
        aValue = a[sortField];
        bValue = b[sortField];
      }

      if (aValue === null || aValue === undefined) aValue = '';
      if (bValue === null || bValue === undefined) bValue = '';

      aValue = String(aValue).toLowerCase();
      bValue = String(bValue).toLowerCase();

      if (sortDirection === 'asc') {
        return aValue.localeCompare(bValue, 'pt');
      } else {
        return bValue.localeCompare(aValue, 'pt');
      }
    });

    return sorted;
  }, [registos, modelos, companhias, filtros.busca, filtros.modelo, filtros.companhia, sortField, sortDirection]);

  const handleSave = async (dataFromForm) => {
    setAlertInfo({ isOpen: false, type: 'info', title: '', message: '' });
    setIsSubmitting(true);

    try {
      const registoNormalizado = dataFromForm.registo;

      if (!registoNormalizado) {
        throw new Error('Por favor, forneça um registo válido para a aeronave.');
      }

      // Validar duplicidade primeiro na lista local (rápido)
      let registoDuplicado = registos.find((r) => {
        const rNormalizado = normalizeAircraftRegistration(r.registo);
        return rNormalizado === registoNormalizado && (!editingRegisto || r.id !== editingRegisto.id);
      });

      // Se não encontrou localmente, verificar DIRETAMENTE na BD (evita race conditions)
      if (!registoDuplicado && !editingRegisto) {
        const existingInDB = await RegistoAeronave.filter({ registo: registoNormalizado });
        if (existingInDB && existingInDB.length > 0) {
          registoDuplicado = existingInDB[0];
        }
      }

      if (registoDuplicado) {
        const modelo = modelos.find(m => m.id === registoDuplicado.id_modelo_aeronave);
        const companhia = companhias.find(c => c.id === registoDuplicado.id_companhia_aerea);
        
        setAlertInfo({
          isOpen: true,
          type: 'error',
          title: '❌ Matrícula Duplicada',
          message: `A matrícula "${dataFromForm.registo}" (normalizada: "${registoNormalizado}") já está registada.\n\nRegisto existente: ${formatAircraftRegistration(registoDuplicado.registo)}\nModelo: ${modelo?.modelo || 'N/A'}\nCompanhia: ${companhia?.nome || 'N/A'}\n\n⚠️ Cada aeronave deve ter uma matrícula única.\n\n💡 Por favor, verifique a matrícula ou edite o registo existente.`
        });
        setIsSubmitting(false);
        return;
      }

      let savedRegisto;
      if (editingRegisto) {
        await RegistoAeronave.update(editingRegisto.id, dataFromForm);
        savedRegisto = { ...editingRegisto, ...dataFromForm };
        setAlertInfo({
          isOpen: true,
          type: 'success',
          title: 'Sucesso!',
          message: `Registo "${registoNormalizado}" atualizado com sucesso.`
        });
      } else {
        savedRegisto = await RegistoAeronave.create(dataFromForm);
        
        // Enviar notificação por email aos administradores
        try {
          const modelo = modelos.find(m => m.id === dataFromForm.id_modelo_aeronave);
          const companhia = companhias.find(c => c.id === dataFromForm.id_companhia_aerea);
          
          const { notifyAdminsCreation } = await import('@/components/lib/notificacoes');
          await notifyAdminsCreation('registo', savedRegisto, currentUser, {
            modeloNome: modelo?.modelo || 'N/A',
            companhiaNome: companhia?.nome || 'N/A'
          });
        } catch (emailError) {
          console.error('Erro ao enviar notificação por email:', emailError);
          // Não interromper o fluxo mesmo se houver erro no email
        }
        
        setAlertInfo({
          isOpen: true,
          type: 'success',
          title: 'Sucesso!',
          message: `Registo "${registoNormalizado}" criado com sucesso.`
        });
      }

      onReload();
      setIsFormOpen(false);
      setEditingRegisto(null);
    } catch (error) {
      console.error("Erro ao salvar registo:", error);

      const errorMessage = error.message?.toLowerCase() || '';
      const errorDetails = error.response?.data?.message?.toLowerCase() || '';
      const status = error.response?.status;

      if (
        errorMessage.includes('duplicate') ||
        errorMessage.includes('unique') ||
        errorMessage.includes('already exists') ||
        errorDetails.includes('duplicate') ||
        errorDetails.includes('unique') ||
        status === 409 ||
        status === 500
      ) {
        setAlertInfo({
          isOpen: true,
          type: 'error',
          title: '❌ Matrícula Duplicada',
          message: `A matrícula "${dataFromForm.registo}" já está registada no sistema.\n\n⚠️ Cada aeronave deve ter uma matrícula única.\n\n💡 Por favor, utilize uma matrícula diferente ou edite o registo existente.`
        });
      } else {
        setAlertInfo({
          isOpen: true,
          type: 'error',
          title: 'Erro!',
          message: `Não foi possível salvar o registo. Erro: ${error.message || 'Erro desconhecido'}.`
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportCSV = () => {
    const dataToExport = registosFiltrados.map((r) => ({
      'ID': r.id,
      'Matrícula': formatAircraftRegistration(r.registo),
      'Modelo': r.modelo_nome,
      'Companhia': r.companhia_nome,
      'MTOW (kg)': r.mtow_kg,
      'Assentos Total': r.total_assentos || '',
      'First': r.num_first || '',
      'Business': r.num_business || '',
      'Premium': r.num_premium || '',
      'Economy': r.num_economy || '',
      'Última Atualização': r.updated_by ? r.updated_by.split('@')[0] : r.created_by ? r.created_by.split('@')[0] : 'N/A'
    }));
    downloadAsCSV(dataToExport, `registos_aeronave_${new Date().toISOString().split('T')[0]}`);
  };

  const handleDelete = async (registo) => {// Changed parameter to full registo object
    if (!isAdmin) {
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Acesso Negado',
        message: 'Apenas administradores podem excluir registos de aeronaves.'
      });
      return;
    }

    try {
      const voosComRegisto = await Voo.filter({
        registo_aeronave: registo.registo
      }).catch(() => []);

      if (voosComRegisto.length > 0) {
        setAlertInfo({
          isOpen: true,
          type: 'error',
          title: 'Não É Possível Excluir',
          message: `Este registo não pode ser excluído porque existem ${voosComRegisto.length} voo(s) registado(s) com esta aeronave. Por favor, remova ou migre os voos primeiro.`
        });
        return;
      }

      setAlertInfo({
        isOpen: true,
        type: 'warning',
        title: 'Confirmar Exclusão',
        message: `Tem certeza que deseja excluir o registo ${formatAircraftRegistration(registo.registo)}? Esta ação não pode ser desfeita.`,
        showCancel: true,
        confirmText: 'Excluir',
        onConfirm: async () => {
          setAlertInfo((prev) => ({ ...prev, isOpen: false })); // Close current alert
          try {
            await RegistoAeronave.delete(registo.id); // Use registo.id for deletion
            onReload();
            setAlertInfo({ // Using setAlertInfo for success
              isOpen: true,
              type: 'success',
              title: 'Registo Excluído!',
              message: `O registo ${formatAircraftRegistration(registo.registo)} foi excluído com sucesso.`
            });
          } catch (error) {
            console.error("Erro ao apagar registo:", error);

            const errorMessage = error.message?.toLowerCase() || '';
            const errorDetails = error.response?.data?.message?.toLowerCase() || '';
            const status = error.response?.status;

            if (
            errorMessage.includes('constraint') ||
            errorMessage.includes('foreign key') ||
            errorMessage.includes('is referenced') ||
            errorDetails.includes('constraint') ||
            errorDetails.includes('foreign key') ||
            status === 409)
            {
              setAlertInfo({
                isOpen: true,
                type: 'error',
                title: 'Não é Possível Apagar',
                message: 'Este registo não pode ser apagado porque está em uso por voos existentes. Por favor, remova primeiro os voos associados a esta aeronave.'
              });
            } else {
              setAlertInfo({
                isOpen: true,
                type: 'error',
                title: 'Erro!',
                message: 'Não foi possível apagar o registo. Tente novamente mais tarde.'
              });
            }
          }
        }
      });
    } catch (error) {
      console.error('Erro ao excluir registo:', error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro',
        message: error.message || 'Erro ao excluir o registo.'
      });
    }
  };

  const hasActiveFilters = filtros.busca !== '' || filtros.modelo !== 'todos' || filtros.companhia !== 'todos';

  const modeloFilterOptions = useMemo(() => [
  { value: 'todos', label: 'Todos os Modelos' },
  ...modelos.map((modelo) => ({
    value: modelo.id,
    label: modelo.modelo || modelo.codigo_iata || modelo.codigo_icao || `Modelo ${modelo.id}`
  }))],
  [modelos]);

  const companhiaFilterOptions = useMemo(() => [
  { value: 'todos', label: 'Todas as Companhias' },
  ...companhias.map((companhia) => ({
    value: companhia.id,
    label: companhia.nome || `Companhia ${companhia.id}`
  }))],
  [companhias]);

  return (
    <Card>
      <CardHeader className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <CardTitle className="text-xl md:text-2xl font-bold text-slate-800">Registos de Aeronaves</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setIsUploadModalOpen(true)} className="border-slate-300 text-slate-700 hover:bg-slate-100">
            <Upload className="w-4 h-4 mr-2" />
            Upload CSV
          </Button>
          <Button variant="outline" onClick={handleExportCSV} className="border-slate-300 text-slate-700 hover:bg-slate-100">
            <FileDown className="w-4 h-4 mr-2" />
            Exportar CSV ({registosFiltrados.length})
          </Button>
          <Button
            onClick={() => {setEditingRegisto(null);setIsFormOpen(true);}}
            className="bg-blue-600 hover:bg-blue-700 text-white">

            <Plus className="w-4 h-4 mr-2" /> Novo Registo
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Card className="mb-6 border-slate-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Filter className="w-5 h-5 text-slate-500" />
                Filtros e Pesquisa
              </CardTitle>
              {hasActiveFilters &&
              <Button
                variant="outline"
                size="sm"
                onClick={clearAllFilters}
                className="text-red-600 border-red-200 hover:bg-red-50">

                  <X className="w-4 h-4 mr-1" />
                  Limpar Filtros
                </Button>
              }
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <Label htmlFor="search-matricula">Pesquisar por Matrícula, Modelo ou Companhia</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    id="search-matricula"
                    placeholder="Pesquisar..."
                    value={filtros.busca}
                    onChange={(e) => setFiltros((prev) => ({ ...prev, busca: e.target.value }))}
                    className="pl-9" />

                </div>
              </div>
              <div>
                <Label htmlFor="modelo-filter">Modelo</Label>
                <Combobox
                  id="modelo-filter"
                  options={modeloFilterOptions}
                  value={filtros.modelo}
                  onValueChange={(v) => setFiltros((prev) => ({ ...prev, modelo: v }))}
                  placeholder="Selecione o modelo..." />

              </div>
              <div>
                <Label htmlFor="companhia-filter">Companhia</Label>
                <Combobox
                  id="companhia-filter"
                  options={companhiaFilterOptions}
                  value={filtros.companhia}
                  onValueChange={(v) => setFiltros((prev) => ({ ...prev, companhia: v }))}
                  placeholder="Selecione a companhia..." />

              </div>
            </div>
          </CardContent>
        </Card>
        
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHeader
                  field="registo"
                  label="Matrícula"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort} />

                <TableHead>Modelo</TableHead>
                <TableHead>Companhia</TableHead>
                <SortableTableHeader
                  field="mtow_kg"
                  label="MTOW (kg)"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort} />

                <SortableTableHeader
                  field="total_assentos"
                  label="Assentos"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort} />

                <SortableTableHeader
                  field="updated_date"
                  label="Última Atualização"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort} />

                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registosFiltrados.map((registo) =>
              <TableRow key={registo.id}>
                  <TableCell className="font-mono font-medium">{formatAircraftRegistration(registo.registo)}</TableCell>
                  <TableCell>{registo.modelo_nome}</TableCell>
                  <TableCell>{registo.companhia_nome}</TableCell>
                  <TableCell>{new Intl.NumberFormat('pt-AO').format(registo.mtow_kg)}</TableCell>
                  <TableCell>{registo.total_assentos || 0}</TableCell>
                  <TableCell className="text-xs text-slate-500">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-slate-600 font-medium">
                        {(registo.updated_by || registo.created_by)?.split('@')[0] || 'Sistema'}
                      </span>
                      <span className="text-slate-400">
                        {new Date(registo.updated_date || registo.created_date).toLocaleString('pt-PT', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => {setEditingRegisto(registo);setIsFormOpen(true);}}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    {isAdmin &&
                  <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleDelete(registo)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                  }
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRegisto ? 'Editar' : 'Adicionar'} Registo de Aeronave</DialogTitle>
          </DialogHeader>
          <FormRegisto
            registo={editingRegisto}
            modelos={modelos}
            companhias={companhias}
            onSave={handleSave}
            onCancel={() => {setIsFormOpen(false);setEditingRegisto(null);}}
            isSubmitting={isSubmitting} />

        </DialogContent>
      </Dialog>

      <AlertModal
        isOpen={alertInfo.isOpen}
        onClose={() => setAlertInfo({ ...alertInfo, isOpen: false })}
        type={alertInfo.type}
        title={alertInfo.title}
        message={alertInfo.message}
        showCancel={alertInfo.showCancel}
        onConfirm={alertInfo.onConfirm} />

      
      {isUploadModalOpen &&
      <UploadCsvModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        entityName="RegistoAeronave"
        entitySchema={RegistoAeronave.schema()}
        templateHeaders={Object.keys(RegistoAeronave.schema().properties)}
        onImportComplete={(result) => {
          setIsUploadModalOpen(false);
          if (result.type === 'success') {
            setAlertInfo({
              isOpen: true,
              type: 'success',
              title: 'Importação Concluída!',
              message: result.text
            });
            onReload();
          } else if (result.type === 'error') {
            setAlertInfo({
              isOpen: true,
              type: 'error',
              title: 'Erro na Importação',
              message: result.text
            });
          }
        }} />

      }
    </Card>);

}