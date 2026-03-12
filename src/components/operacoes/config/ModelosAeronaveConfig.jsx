import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Trash2, Search } from 'lucide-react'; // Kept Pencil, as it was already used.
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import SortableTableHeader from '@/components/shared/SortableTableHeader';
import AlertModal from '@/components/shared/AlertModal';
import { ModeloAeronave } from '@/entities/ModeloAeronave';
import { User } from '@/entities/User'; // Added User import

export default function ModelosAeronaveConfig({ modelos, onReload }) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingModelo, setEditingModelo] = useState(null);
  const [busca, setBusca] = useState('');
  const [sortField, setSortField] = useState('modelo');
  const [sortDirection, setSortDirection] = useState('asc');

  const [formData, setFormData] = useState({
    modelo: '',
    codigo_iata: '',
    codigo_icao: '',
    mtow_kg: 0,
    comprimento_m: 0,
    envergadura_m: 0,
    ac_code: ''
  });

  const [currentUser, setCurrentUser] = useState(null);
  const [alertInfo, setAlertInfo] = useState({ isOpen: false, type: 'info', title: '', message: '' });
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, modelo: null });

  // Effect to load current user on component mount
  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await User.me();
        setCurrentUser(user);
      } catch (error) {
        console.error('Erro ao carregar utilizador:', error);
        // Optionally, handle error UI for user
      }
    };
    loadUser();
  }, []);

  const isAdmin = currentUser?.role === 'admin' ||
  currentUser?.perfis && currentUser.perfis.includes('administrador');

  const handleSort = (field, direction) => {
    setSortField(field);
    setSortDirection(direction);
  };

  const modelosFiltrados = useMemo(() => {
    let filtered = modelos.filter((m) =>
    !busca ||
    m.modelo?.toLowerCase().includes(busca.toLowerCase()) ||
    m.codigo_icao?.toLowerCase().includes(busca.toLowerCase()) ||
    m.codigo_iata?.toLowerCase().includes(busca.toLowerCase())
    );

    // Ordenação
    filtered.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [modelos, busca, sortField, sortDirection]);

  const handleOpenForm = (modelo = null) => {
    if (modelo) {
      setEditingModelo(modelo);
      setFormData(modelo);
    } else {
      setEditingModelo(null);
      setFormData({
        modelo: '',
        codigo_iata: '',
        codigo_icao: '',
        mtow_kg: 0,
        comprimento_m: 0,
        envergadura_m: 0,
        ac_code: ''
      });
    }
    setIsFormOpen(true);
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // Validar duplicidade de código IATA
      const codigoIataNormalizado = formData.codigo_iata.trim().toUpperCase();
      let modeloDuplicado = modelos.find(
        (m) => m.codigo_iata?.trim().toUpperCase() === codigoIataNormalizado && 
        (!editingModelo || m.id !== editingModelo.id)
      );

      // Verificar também diretamente na BD para evitar race conditions
      if (!modeloDuplicado && !editingModelo) {
        const existingInDB = await ModeloAeronave.filter({ codigo_iata: codigoIataNormalizado });
        if (existingInDB && existingInDB.length > 0) {
          modeloDuplicado = existingInDB[0];
        }
      }

      if (modeloDuplicado) {
        setAlertInfo({
          isOpen: true,
          type: 'error',
          title: 'Código IATA Duplicado',
          message: `O código IATA "${codigoIataNormalizado}" já está registado para o modelo "${modeloDuplicado.modelo}". Cada modelo deve ter um código IATA único. Por favor, verifique o código ou edite o modelo existente.`
        });
        return;
      }

      if (editingModelo) {
        await ModeloAeronave.update(editingModelo.id, formData);
        setAlertInfo({ isOpen: true, type: 'success', title: 'Sucesso', message: 'Modelo atualizado com sucesso!' });
      } else {
        await ModeloAeronave.create(formData);
        setAlertInfo({ isOpen: true, type: 'success', title: 'Sucesso', message: 'Modelo criado com sucesso!' });
      }
      setIsFormOpen(false);
      onReload();
    } catch (error) {
      console.error('Erro ao salvar modelo:', error);
      
      const errorMessage = error.message?.toLowerCase() || '';
      const errorDetails = error.response?.data?.message?.toLowerCase() || '';
      const status = error.response?.status;

      if (
        errorMessage.includes('duplicate') ||
        errorMessage.includes('unique') ||
        errorMessage.includes('already exists') ||
        errorDetails.includes('duplicate') ||
        errorDetails.includes('unique') ||
        status === 409
      ) {
        setAlertInfo({
          isOpen: true,
          type: 'error',
          title: 'Código IATA Duplicado',
          message: `O código IATA "${formData.codigo_iata}" já está registado no sistema. Cada modelo deve ter um código IATA único. Por favor, utilize um código diferente ou edite o modelo existente.`
        });
      } else {
        setAlertInfo({
          isOpen: true,
          type: 'error',
          title: 'Erro',
          message: `Erro ao salvar modelo: ${error.message || 'Ocorreu um erro desconhecido.'}`
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (modelo) => {
    if (!isAdmin) {
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Acesso Negado',
        message: 'Apenas administradores podem excluir modelos de aeronaves.'
      });
      return;
    }

    setDeleteConfirm({ isOpen: true, modelo });
  };

  const confirmDelete = async () => {
    const modelo = deleteConfirm.modelo;
    setDeleteConfirm({ isOpen: false, modelo: null });

    let aeronavesComModelo = [];
    try {
      // Verificar se há registos de aeronaves associados
      const { RegistoAeronave } = await import('@/entities/RegistoAeronave');
      aeronavesComModelo = await RegistoAeronave.filter({
        id_modelo_aeronave: modelo.id
      }).catch(err => {
        console.warn('Erro ao verificar dependências:', err);
        return [];
      });

      if (aeronavesComModelo.length > 0) {
        setAlertInfo({
          isOpen: true,
          type: 'error',
          title: 'Não É Possível Excluir',
          message: `Este modelo não pode ser excluído porque existem ${aeronavesComModelo.length} aeronave(s) registada(s) com ele. Por favor, remova ou migre as aeronaves primeiro.`
        });
        return;
      }

      await ModeloAeronave.delete(modelo.id);
      onReload();
      setAlertInfo({
        isOpen: true,
        type: 'success',
        title: 'Modelo Excluído',
        message: `O modelo ${modelo.modelo} foi excluído com sucesso.`
      });
    } catch (error) {
      console.error('Erro ao excluir modelo:', error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro ao Excluir',
        message: error.message || 'Não foi possível excluir o modelo.'
      });
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Modelos de Aeronave</CardTitle>
          <Button onClick={() => handleOpenForm()} size="sm" className="bg-blue-600 text-slate-50 px-3 text-sm font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:bg-blue-500/90 h-9">
            <Plus className="w-4 h-4 mr-2" />
            Novo Modelo
          </Button>
        </CardHeader>
        <CardContent>
          {/* Filtro de Busca */}
          <div className="mb-4">
            <Label>Pesquisar</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Modelo, código ICAO, código IATA..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-8" />

            </div>
          </div>

          {/* Tabela */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHeader
                    field="modelo"
                    label="Modelo"
                    currentSortField={sortField}
                    currentSortDirection={sortDirection}
                    onSort={handleSort} />

                  <SortableTableHeader
                    field="codigo_icao"
                    label="ICAO"
                    currentSortField={sortField}
                    currentSortDirection={sortDirection}
                    onSort={handleSort} />

                  <SortableTableHeader
                    field="codigo_iata"
                    label="IATA"
                    currentSortField={sortField}
                    currentSortDirection={sortDirection}
                    onSort={handleSort} />

                  <SortableTableHeader
                    field="mtow_kg"
                    label="MTOW (kg)"
                    currentSortField={sortField}
                    currentSortDirection={sortDirection}
                    onSort={handleSort} />

                  <SortableTableHeader
                    field="envergadura_m"
                    label="Envergadura (m)"
                    currentSortField={sortField}
                    currentSortDirection={sortDirection}
                    onSort={handleSort} />

                  <TableHead>Última Atualização</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {modelosFiltrados.map((modelo) =>
                <TableRow key={modelo.id}>
                    <TableCell className="font-medium">{modelo.modelo}</TableCell>
                    <TableCell>{modelo.codigo_icao}</TableCell>
                    <TableCell>{modelo.codigo_iata}</TableCell>
                    <TableCell>{new Intl.NumberFormat('pt-AO').format(modelo.mtow_kg)}</TableCell>
                    <TableCell>{modelo.envergadura_m}</TableCell>
                    <TableCell className="text-xs text-slate-500">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-slate-600 font-medium">
                          {(modelo.updated_by || modelo.created_by)?.split('@')[0] || 'Sistema'}
                        </span>
                        <span className="text-slate-400">
                          {new Date(modelo.updated_date || modelo.created_date).toLocaleString('pt-PT', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenForm(modelo)}>

                          <Pencil className="h-4 w-4" />
                        </Button>
                        {isAdmin &&
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(modelo)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50">

                            <Trash2 className="h-4 w-4" />
                          </Button>
                      }
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog de Formulário */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingModelo ? 'Editar Modelo' : 'Novo Modelo'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Modelo *</Label>
                <Input value={formData.modelo} onChange={(e) => setFormData({ ...formData, modelo: e.target.value })} required placeholder="Ex: Airbus A320" />
              </div>
              <div>
                <Label>Código ICAO *</Label>
                <Input value={formData.codigo_icao} onChange={(e) => setFormData({ ...formData, codigo_icao: e.target.value })} required placeholder="Ex: A320" />
              </div>
              <div>
                <Label>Código IATA *</Label>
                <Input value={formData.codigo_iata} onChange={(e) => setFormData({ ...formData, codigo_iata: e.target.value })} required placeholder="Ex: 320" />
              </div>
              <div>
                <Label>MTOW (kg) *</Label>
                <Input type="number" value={formData.mtow_kg} onChange={(e) => setFormData({ ...formData, mtow_kg: Number(e.target.value) })} required />
              </div>
              <div>
                <Label>Comprimento (m)</Label>
                <Input type="number" step="0.01" value={formData.comprimento_m} onChange={(e) => setFormData({ ...formData, comprimento_m: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Envergadura (m) *</Label>
                <Input type="number" step="0.01" value={formData.envergadura_m} onChange={(e) => setFormData({ ...formData, envergadura_m: Number(e.target.value) })} required />
              </div>
              <div>
                <Label>AC Code</Label>
                <Input value={formData.ac_code} onChange={(e) => setFormData({ ...formData, ac_code: e.target.value })} placeholder="Ex: C" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)} disabled={isSubmitting}>Cancelar</Button>
              <Button type="submit" disabled={isSubmitting} className="bg-green-600 text-slate-50 px-4 py-2 text-sm font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:bg-green-600/90 h-10">{isSubmitting ? 'Salvando...' : 'Salvar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, modelo: null })}
        onConfirm={confirmDelete}
        type="warning"
        title="Confirmar Exclusão"
        message={`Tem certeza que deseja excluir o modelo ${deleteConfirm.modelo?.modelo} (${deleteConfirm.modelo?.codigo_iata})?`}
        confirmText="Sim, Excluir"
        showCancel
      />

      <AlertModal
        isOpen={alertInfo.isOpen}
        onClose={() => setAlertInfo({ ...alertInfo, isOpen: false })}
        type={alertInfo.type}
        title={alertInfo.title}
        message={alertInfo.message}
      />
    </>);

}