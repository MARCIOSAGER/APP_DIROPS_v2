
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Select from '@/components/ui/select';
import { Eye, Edit, CheckCircle, UserCheck, Mail, Trash2, Filter, X, Shield, FileDown } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Checkbox } from '@/components/ui/checkbox';

import { Credenciamento } from '@/entities/Credenciamento';
import { User } from '@/entities/User';
import { SendEmail } from '@/integrations/Core';
import { hasUserProfile } from '@/components/lib/userUtils'; // Added import

import CredenciamentoDetailModal from './CredenciamentoDetailModal';
import VerificarCredenciamentoModal from './VerificarCredenciamentoModal';
import AprovarCredenciamentoModal from './AprovarCredenciamentoModal';
import SendEmailModal from '../shared/SendEmailModal';
import AlertModal from '../shared/AlertModal';

// Helper function for CSV export
const downloadAsCSV = (data, filename) => {
  if (!data || data.length === 0) return;

  const header = Object.keys(data[0]).join(',');
  const rows = data.map(obj => Object.values(obj).map(value => {
    // Basic CSV escape: double quotes and wrap in quotes if contains comma or quote
    let stringValue = String(value);
    if (stringValue.includes(',') || stringValue.includes('"')) {
      stringValue = `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  }).join(','));

  const csvContent = [header, ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) { // feature detection
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    document.body.removeChild(link);
    link.click();
  }
};

const STATUS_CONFIG = {
  pendente: { color: 'bg-yellow-100 text-yellow-800', label: 'Pendente' },
  em_verificacao: { color: 'bg-blue-100 text-blue-800', label: 'Em Verificação' },
  aguardando_aprovacao_diretor: { color: 'bg-purple-100 text-purple-800', label: 'Aguardando Aprovação' },
  aprovado: { color: 'bg-green-100 text-green-800', label: 'Aprovado' },
  aguardando_pagamento: { color: 'bg-orange-100 text-orange-800', label: 'Aguardando Pagamento' },
  pagamento_confirmado: { color: 'bg-cyan-100 text-cyan-800', label: 'Pagamento Confirmado' },
  rejeitado: { color: 'bg-red-100 text-red-800', label: 'Rejeitado' },
  credenciado: { color: 'bg-emerald-100 text-emerald-800', label: 'Credenciado' },
  expirado: { color: 'bg-gray-100 text-gray-800', label: 'Expirado' },
  inativo: { color: 'bg-slate-100 text-slate-800', label: 'Inativo' }
};

export default function CredenciamentoList({
  credenciamentos,
  empresas,
  aeroportos,
  isLoading,
  onReload,
  onEdit,
  currentUser
}) {
  const [filters, setFilters] = useState(() => {
    const initialFilters = {
      search: '',
      status: 'todos',
      tipo: 'todos',
      empresa: 'todos',
      aeroporto: 'todos'
    };

    // If the current user is a 'gestor_empresa', pre-set the company filter
    if (hasUserProfile(currentUser, 'gestor_empresa') && currentUser.empresa_id) {
      initialFilters.empresa = currentUser.empresa_id;
    }
    return initialFilters;
  });

  const [selectedCredenciamentos, setSelectedCredenciamentos] = useState([]);
  const [detailCredenciamento, setDetailCredenciamento] = useState(null);
  const [verificarCredenciamento, setVerificarCredenciamento] = useState(null);
  const [aprovarCredenciamento, setAprovarCredenciamento] = useState(null);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [alertInfo, setAlertInfo] = useState({ isOpen: false, type: 'info', title: '', message: '', onConfirm: null });

  // Filtrar empresas disponíveis baseado no perfil do utilizador
  const empresasFiltradas = useMemo(() => {
    if (hasUserProfile(currentUser, 'gestor_empresa') && currentUser.empresa_id) {
      // Gestor de empresa só vê a sua própria empresa
      return empresas.filter(e => e.id === currentUser.empresa_id);
    }
    return empresas; // Utilizadores internos vêem todas as empresas
  }, [empresas, currentUser]);

  const getEmpresaNome = (empresaId) => {
    const empresa = empresas.find(e => e.id === empresaId);
    return empresa?.nome || 'Empresa não encontrada';
  };

  const getAeroportoNome = (aeroportoId) => {
    const aeroporto = aeroportos.find(a => a.codigo_icao === aeroportoId);
    return aeroporto?.nome || aeroportoId;
  };

  const filteredCredenciamentos = useMemo(() => {
    let filtered = credenciamentos;

    // FILTRO CRÍTICO: Se for gestor de empresa, mostrar apenas os seus credenciamentos
    if (hasUserProfile(currentUser, 'gestor_empresa') && currentUser?.empresa_id) {
      filtered = filtered.filter(c => c.empresa_solicitante_id === currentUser.empresa_id);
    }

    return filtered.filter(credenciamento => {
      const searchMatch = !filters.search ||
                         credenciamento.protocolo_numero?.toLowerCase().includes(filters.search.toLowerCase()) ||
                         credenciamento.nome_completo?.toLowerCase().includes(filters.search.toLowerCase()) ||
                         credenciamento.matricula_viatura?.toLowerCase().includes(filters.search.toLowerCase());

      const statusMatch = filters.status === 'todos' || credenciamento.status === filters.status;
      const tipoMatch = filters.tipo === 'todos' || credenciamento.tipo_credencial === filters.tipo;
      const empresaMatch = filters.empresa === 'todos' || credenciamento.empresa_solicitante_id === filters.empresa;
      const aeroportoMatch = filters.aeroporto === 'todos' || credenciamento.aeroporto_id === filters.aeroporto;

      return searchMatch && statusMatch && tipoMatch && empresaMatch && aeroportoMatch;
    });
  }, [credenciamentos, filters, currentUser]);

  const clearFilters = () => {
    setFilters(prevFilters => {
      const newFilters = {
        search: '',
        status: 'todos',
        tipo: 'todos',
        empresa: 'todos',
        aeroporto: 'todos'
      };
      // Preserve the company filter if it's set by gestor_empresa
      if (hasUserProfile(currentUser, 'gestor_empresa') && currentUser.empresa_id) {
        newFilters.empresa = currentUser.empresa_id;
      }
      return newFilters;
    });
  };

  const hasActiveFilters = useMemo(() => {
    // Exclude the default 'empresa' filter for gestor_empresa when checking active filters
    const defaultEmpresaFilter = (hasUserProfile(currentUser, 'gestor_empresa') && currentUser.empresa_id)
      ? currentUser.empresa_id
      : 'todos';

    return Object.keys(filters).some(key => {
      if (key === 'empresa') {
        return filters[key] !== defaultEmpresaFilter;
      }
      return filters[key] !== '' && filters[key] !== 'todos';
    });
  }, [filters, currentUser]);

  const canEdit = (credenciamento) => {
    if (!currentUser) return false;

    // Admin pode editar tudo
    if (currentUser.role === 'admin') return true;

    // Utilizadores internos podem editar tudo
    if (hasUserProfile(currentUser, 'administrador') || hasUserProfile(currentUser, 'credenciamento')) {
      return true;
    }

    // Gestor de empresa só pode editar os seus próprios credenciamentos
    if (hasUserProfile(currentUser, 'gestor_empresa')) {
      return credenciamento.empresa_solicitante_id === currentUser.empresa_id;
    }

    return false;
  };

  // Bulk action handlers
  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedCredenciamentos(filteredCredenciamentos.map(c => c.id));
    } else {
      setSelectedCredenciamentos([]);
    }
  };

  const handleSelectCredenciamento = (credenciamentoId, checked) => {
    if (checked) {
      setSelectedCredenciamentos(prev => [...prev, credenciamentoId]);
    } else {
      setSelectedCredenciamentos(prev => prev.filter(id => id !== credenciamentoId));
    }
  };

  const handleBulkEmail = () => {
    if (selectedCredenciamentos.length === 0) {
      setAlertInfo({
        isOpen: true,
        type: 'info',
        title: 'Nenhum item selecionado',
        message: 'Selecione pelo menos um credenciamento para enviar por email.'
      });
      return;
    }
    setEmailModalOpen(true);
  };

  const handleBulkExport = () => {
    if (selectedCredenciamentos.length === 0) {
      setAlertInfo({
        isOpen: true,
        type: 'info',
        title: 'Nenhum item selecionado',
        message: 'Selecione pelo menos um credenciamento para exportar.'
      });
      return;
    }

    const selectedData = filteredCredenciamentos.filter(c => selectedCredenciamentos.includes(c.id));
    const dataToExport = selectedData.map(c => ({
      'Protocolo': c.protocolo_numero,
      'Empresa': getEmpresaNome(c.empresa_solicitante_id),
      'Tipo': c.tipo_credencial === 'pessoa' ? 'Pessoa' : 'Viatura',
      'Nome/Matrícula': c.nome_completo || c.matricula_viatura,
      'Aeroporto': getAeroportoNome(c.aeroporto_id),
      'Status': STATUS_CONFIG[c.status]?.label,
      'Data Solicitação': new Date(c.data_solicitacao).toLocaleDateString('pt-AO'),
      'Período': c.periodo_validade === 'temporario' ? 'Temporário' : 'Permanente'
    }));

    try {
      downloadAsCSV(dataToExport, `credenciamentos_selecionados_${new Date().toISOString().split('T')[0]}`);
      setSelectedCredenciamentos([]);
    } catch (error) {
      console.error('Erro ao exportar CSV:', error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro!',
        message: 'Erro ao exportar dados. Tente novamente.'
      });
    }
  };

  const handleVerificar = async (credenciamentoId, data) => {
    try {
      const user = await User.me();
      await Credenciamento.update(credenciamentoId, {
        status: 'aguardando_aprovacao_diretor',
        verificado_por: user.email,
        data_verificacao: new Date().toISOString(),
        observacoes_verificacao: data.observacoes
      });

      onReload();
      setAlertInfo({
        isOpen: true,
        type: 'success',
        title: 'Verificação Concluída!',
        message: 'O credenciamento foi verificado e enviado para aprovação do diretor.'
      });
    } catch (error) {
      console.error('Erro ao verificar credenciamento:', error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro!',
        message: 'Erro ao processar verificação. Tente novamente.'
      });
    }
  };

  const handleAprovar = async (credenciamentoId, data) => {
    try {
      const user = await User.me();
      const credenciamento = credenciamentos.find(c => c.id === credenciamentoId);

      await Credenciamento.update(credenciamentoId, {
        status: 'aprovado',
        aprovado_por: user.email,
        data_aprovacao: new Date().toISOString(),
        observacoes_aprovacao: data.observacoes,
        periodo_entrega_documentos: data.periodo_entrega
      });

      try {
        const empresa = empresas.find(e => e.id === credenciamento.empresa_solicitante_id);
        if (empresa) {
          await SendEmail({
            to: empresa.responsavel_email,
            subject: `DIROPS-SGA - Credenciamento Aprovado - ${credenciamento.protocolo_numero}`,
            body: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                  <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/563d28706_logoSGA.png" alt="SGA Logo" style="height: 60px;">
                  <h1 style="color: #16a34a; margin-top: 20px;">✅ Credenciamento Aprovado!</h1>
                </div>

                <p>Prezado(a) ${empresa.responsavel_nome},</p>

                <p>Temos o prazer de informar que o credenciamento com protocolo <strong>${credenciamento.protocolo_numero}</strong> foi aprovado!</p>

                <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="color: #1e40af;">📋 Detalhes do Credenciamento:</h3>
                  <ul>
                    <li><strong>Protocolo:</strong> ${credenciamento.protocolo_numero}</li>
                    <li><strong>Tipo:</strong> ${credenciamento.tipo_credencial === 'pessoa' ? 'Pessoa' : 'Viatura'}</li>
                    <li><strong>Nome/Matrícula:</strong> ${credenciamento.nome_completo || credenciamento.matricula_viatura}</li>
                    <li><strong>Aeroporto:</strong> ${getAeroportoNome(credenciamento.aeroporto_id)}</li>
                  </ul>
                </div>

                <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
                  <h3 style="color: #92400e;">📅 PRÓXIMO PASSO OBRIGATÓRIO:</h3>
                  <p style="color: #92400e; font-weight: bold;">${data.periodo_entrega}</p>
                </div>

                <h4 style="color: #1e40af;">📋 Documentos necessários para levar:</h4>
                <ul>
                  ${credenciamento.tipo_credencial === 'pessoa' ? `
                    <li>Passaporte ou BI original</li>
                    <li>Carta da empresa original (papel timbrado)</li>
                    <li>Uma fotografia recente (será tirada no local)</li>
                  ` : `
                    <li>Livrete da viatura original</li>
                    <li>Carta da empresa original (papel timbrado)</li>
                    <li>Carta de condução do condutor principal</li>
                  `}
                </ul>

                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                  <p><strong>Importante:</strong> Mencione sempre o número de protocolo <strong>${credenciamento.protocolo_numero}</strong> durante o atendimento.</p>
                  <p><strong>Melhores Cumprimentos,</strong><br>
                  Equipa de Credenciamento DIROPS-SGA</p>
                </div>
              </div>
            `,
            from_name: 'DIROPS-SGA Credenciamento'
          });
        }
      } catch (emailError) {
        console.error('Erro ao enviar email de aprovação:', emailError);
      }

      onReload();
      setAlertInfo({
        isOpen: true,
        type: 'success',
        title: '✅ Credenciamento Aprovado!',
        message: 'O credenciamento foi aprovado e um email foi enviado para a empresa com as instruções.'
      });
    } catch (error) {
      console.error('Erro ao aprovar credenciamento:', error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro!',
        message: 'Erro ao processar aprovação. Tente novamente.'
      });
    }
  };

  const handleEdit = (credenciamento) => {
    // Use the new canEdit function
    if (!canEdit(credenciamento)) {
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Acesso Negado',
        message: 'Você não tem permissão para editar este credenciamento.'
      });
      return;
    }

    onEdit(credenciamento);
  };

  const handleDelete = (credenciamento) => {
    // Use the new canEdit function (assuming delete permissions are tied to edit)
    if (!canEdit(credenciamento)) {
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Acesso Negado',
        message: 'Você não tem permissão para excluir este credenciamento.'
      });
      return;
    }

    setAlertInfo({
      isOpen: true,
      type: 'warning',
      title: 'Confirmar Exclusão',
      message: `Tem certeza que deseja excluir o credenciamento ${credenciamento.protocolo_numero}? Esta ação não pode ser desfeita.`,
      showCancel: true,
      confirmText: 'Excluir',
      onConfirm: async () => {
        try {
          await Credenciamento.delete(credenciamento.id);
          onReload();
          setAlertInfo({
            isOpen: true,
            type: 'success',
            title: 'Credenciamento Excluído',
            message: 'O credenciamento foi removido com sucesso.'
          });
        } catch (error) {
          console.error('Erro ao excluir credenciamento:', error);
          setAlertInfo({
            isOpen: true,
            type: 'error',
            title: 'Erro!',
            message: 'Erro ao excluir credenciamento. Tente novamente.'
          });
        }
      }
    });
  };

  const handleSendBulkEmail = async (recipient, subject) => {
    if (selectedCredenciamentos.length === 0) {
      throw new Error('Nenhum credenciamento selecionado para envio de e-mail.');
    }

    try {
      const selectedData = filteredCredenciamentos.filter(c => selectedCredenciamentos.includes(c.id));

      const reportBody = `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/563d28706_logoSGA.png" alt="SGA Logo" style="height: 60px;">
            <h1 style="color: #1e40af; margin-top: 20px;">Relatório de Credenciamentos Selecionados</h1>
            <p style="color: #64748b;">Data: ${new Date().toLocaleDateString('pt-AO')}</p>
          </div>

          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="color: #1e40af; margin-top: 0;">Resumo</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px; font-weight: bold;">Total de Credenciamentos:</td>
                <td style="padding: 8px;">${selectedData.length}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">Pendentes:</td>
                <td style="padding: 8px;">${selectedData.filter(c => c.status === 'pendente').length}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">Em Verificação:</td>
                <td style="padding: 8px;">${selectedData.filter(c => c.status === 'em_verificacao').length}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">Aprovados:</td>
                <td style="padding: 8px;">${selectedData.filter(c => c.status === 'aprovado').length}</td>
              </tr>
            </table>
          </div>

          <h3 style="color: #1e40af;">Credenciamentos Selecionados</h3>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background-color: #f1f5f9;">
                <th style="border: 1px solid #e2e8f0; padding: 12px; text-align: left;">Protocolo</th>
                <th style="border: 1px solid #e2e8f0; padding: 12px; text-align: left;">Tipo</th>
                <th style="border: 1px solid #e2e8f0; padding: 12px; text-align: left;">Nome/Matrícula</th>
                <th style="border: 1px solid #e2e8f0; padding: 12px; text-align: left;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${selectedData.map(c => `
                <tr>
                  <td style="border: 1px solid #e2e8f0; padding: 8px;">${c.protocolo_numero}</td>
                  <td style="border: 1px solid #e2e8f0; padding: 8px;">${c.tipo_credencial === 'pessoa' ? 'Pessoa' : 'Viatura'}</td>
                  <td style="border: 1px solid #e2e8f0; padding: 8px;">${c.nome_completo || c.matricula_viatura}</td>
                  <td style="border: 1px solid #e2e8f0; padding: 8px;">${STATUS_CONFIG[c.status]?.label}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; color: #64748b;">
            <p><strong>Sistema DIROPS-SGA</strong><br>
            Gestão de Credenciamentos Aeroportuárias</p>
          </div>
        </div>
      `;

      await SendEmail({
        to: recipient,
        subject: subject || `Relatório de Credenciamentos Selecionados - ${selectedData.length} itens`,
        body: reportBody,
        from_name: 'DIROPS-SGA'
      });

      setSelectedCredenciamentos([]);
      return true;
    } catch (error) {
      console.error('Erro ao enviar email:', error);
      throw new Error('Falha no envio do e-mail.');
    }
  };

  // Create options for Select components
  const statusOptions = [
    { value: 'todos', label: 'Todos os Status' },
    ...Object.entries(STATUS_CONFIG).map(([key, config]) => ({
      value: key,
      label: config.label
    }))
  ];

  const tipoOptions = [
    { value: 'todos', label: 'Todos os Tipos' },
    { value: 'pessoa', label: 'Pessoa' },
    { value: 'viatura', label: 'Viatura' }
  ];

  const empresaOptions = useMemo(() => ([
    {
      value: 'todos',
      label: hasUserProfile(currentUser, 'gestor_empresa') && currentUser.empresa_id ? 'Minha Empresa' : 'Todas as Empresas'
    },
    ...empresasFiltradas.map(e => ({ value: e.id, label: e.nome }))
  ]), [empresasFiltradas, currentUser]);

  const aeroportoOptions = [
    { value: 'todos', label: 'Todos os Aeroportos' },
    ...aeroportos.map(aeroporto => ({
      value: aeroporto.codigo_icao,
      label: aeroporto.nome
    }))
  ];

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="w-5 h-5 text-slate-500" />
              Filtros de Pesquisa
            </CardTitle>
            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                <X className="w-4 h-4 mr-1" />
                Limpar Filtros
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <Label>Pesquisar</Label>
              <Input
                placeholder="Protocolo, nome ou matrícula..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({...prev, search: e.target.value}))}
              />
            </div>
            <div>
              <Label>Aeroporto</Label>
              <Select
                options={aeroportoOptions}
                value={filters.aeroporto}
                onValueChange={(value) => setFilters(prev => ({...prev, aeroporto: value}))}
                placeholder="Todos os Aeroportos"
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select
                options={statusOptions}
                value={filters.status}
                onValueChange={(value) => setFilters(prev => ({...prev, status: value}))}
              />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select
                options={tipoOptions}
                value={filters.tipo}
                onValueChange={(value) => setFilters(prev => ({...prev, tipo: value}))}
              />
            </div>
            <div>
              <Label>Empresa</Label>
              <Select
                options={empresaOptions}
                value={filters.empresa}
                onValueChange={(value) => setFilters(prev => ({...prev, empresa: value}))}
                // Disable if user is a company manager and company filter is locked
                disabled={hasUserProfile(currentUser, 'gestor_empresa') && filters.empresa === currentUser.empresa_id}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ações em Lote */}
      {selectedCredenciamentos.length > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-blue-800">
                {selectedCredenciamentos.length} credenciamento(s) selecionado(s)
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleBulkEmail} className="text-blue-700 border-blue-300">
                  <Mail className="w-4 h-4 mr-2" />
                  Enviar por Email
                </Button>
                <Button variant="outline" size="sm" onClick={handleBulkExport} className="text-blue-700 border-blue-300">
                  <FileDown className="w-4 h-4 mr-2" />
                  Exportar Selecionados
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSelectedCredenciamentos([])} className="text-blue-700 border-blue-300">
                  <X className="w-4 h-4 mr-2" />
                  Limpar Seleção
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de Credenciamentos */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Credenciamentos ({filteredCredenciamentos.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-slate-500">A carregar credenciamentos...</p>
            </div>
          ) : filteredCredenciamentos.length === 0 ? (
            <div className="text-center py-8">
              <Shield className="w-16 h-16 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">Nenhum credenciamento encontrado</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Header com seleção geral */}
              <div className="flex items-center gap-2 pb-2 border-b">
                <Checkbox
                  checked={selectedCredenciamentos.length === filteredCredenciamentos.length && filteredCredenciamentos.length > 0}
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-sm font-medium text-slate-600">Selecionar todos</span>
              </div>

              {filteredCredenciamentos.map((credenciamento) => (
                <div key={credenciamento.id} className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-3 flex-1">
                      <Checkbox
                        checked={selectedCredenciamentos.includes(credenciamento.id)}
                        onCheckedChange={(checked) => handleSelectCredenciamento(credenciamento.id, checked)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-mono text-sm font-bold text-blue-600">
                            {credenciamento.protocolo_numero}
                          </span>
                          <Badge className={STATUS_CONFIG[credenciamento.status]?.color}>
                            {STATUS_CONFIG[credenciamento.status]?.label}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {credenciamento.tipo_credencial === 'pessoa' ? 'Pessoa' : 'Viatura'}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-slate-600">Nome/Matrícula:</span>
                            <p className="font-medium">{credenciamento.nome_completo || credenciamento.matricula_viatura}</p>
                          </div>
                          <div>
                            <span className="text-slate-600">Empresa:</span>
                            <p className="font-medium">{getEmpresaNome(credenciamento.empresa_solicitante_id)}</p>
                          </div>
                          <div>
                            <span className="text-slate-600">Aeroporto:</span>
                            <p className="font-medium">{getAeroportoNome(credenciamento.aeroporto_id)}</p>
                          </div>
                          <div>
                            <span className="text-slate-600">Data:</span>
                            <p className="font-medium">
                              {format(new Date(credenciamento.data_solicitacao), 'dd/MM/yyyy', { locale: pt })}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="ml-4 flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => setDetailCredenciamento(credenciamento)}>
                        <Eye className="w-4 h-4" />
                      </Button>

                      {credenciamento.status === 'pendente' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setVerificarCredenciamento(credenciamento)}
                          className="text-orange-600 hover:text-orange-700"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </Button>
                      )}

                      {credenciamento.status === 'aguardando_aprovacao_diretor' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setAprovarCredenciamento(credenciamento)}
                          className="text-green-600 hover:text-green-700"
                        >
                          <UserCheck className="w-4 h-4" />
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedCredenciamentos([credenciamento.id]);
                          setEmailModalOpen(true);
                        }}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <Mail className="w-4 h-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(credenciamento)}
                        disabled={!canEdit(credenciamento)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(credenciamento)}
                        className="text-red-600 hover:text-red-700"
                        disabled={!canEdit(credenciamento)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      {detailCredenciamento && (
        <CredenciamentoDetailModal
          isOpen={!!detailCredenciamento}
          onClose={() => setDetailCredenciamento(null)}
          credenciamento={detailCredenciamento}
          empresas={empresas}
          aeroportos={aeroportos}
        />
      )}

      {verificarCredenciamento && (
        <VerificarCredenciamentoModal
          isOpen={!!verificarCredenciamento}
          onClose={() => setVerificarCredenciamento(null)}
          credenciamento={verificarCredenciamento}
          onSuccess={handleVerificar}
        />
      )}

      {aprovarCredenciamento && (
        <AprovarCredenciamentoModal
          isOpen={!!aprovarCredenciamento}
          onClose={() => setAprovarCredenciamento(null)}
          credenciamento={aprovarCredenciamento}
          onSuccess={handleAprovar}
        />
      )}

      <SendEmailModal
        isOpen={emailModalOpen}
        onClose={() => {
          setEmailModalOpen(false);
          setSelectedCredenciamentos([]);
        }}
        onSend={handleSendBulkEmail}
        defaultSubject={selectedCredenciamentos.length === 1
          ? `Credenciamento - ${filteredCredenciamentos.find(c => c.id === selectedCredenciamentos[0])?.protocolo_numero || 'Selecionado'}`
          : `Relatório de Credenciamentos - ${selectedCredenciamentos.length} selecionados`
        }
        title={selectedCredenciamentos.length === 1 ? "Enviar Detalhes do Credenciamento" : "Enviar Credenciamentos Selecionados por Email"}
      />

      <AlertModal
        isOpen={alertInfo.isOpen}
        onClose={() => setAlertInfo({ isOpen: false, type: 'info', title: '', message: '', onConfirm: null })}
        type={alertInfo.type}
        title={alertInfo.title}
        message={alertInfo.message}
        showCancel={alertInfo.showCancel}
        onConfirm={alertInfo.onConfirm}
        confirmText={alertInfo.confirmText}
      />
    </div>
  );
}
