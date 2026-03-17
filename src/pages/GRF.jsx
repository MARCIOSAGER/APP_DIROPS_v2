
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, RefreshCw, FileDown, FileText, Plane, Mail, Edit, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';


import { RegistoGRF } from '@/entities/RegistoGRF';
import { Aeroporto } from '@/entities/Aeroporto';
import { User } from '@/entities/User'; // Added User import
import { downloadAsCSV } from '../components/lib/export';
import { filtrarDadosPorAcesso } from '@/components/lib/userUtils';
import { sendEmailDirect } from '@/functions/sendEmailDirect';

import { createPdfDoc, addHeader, addFooter, addTable, fetchEmpresaLogo, PDF } from '@/lib/pdfTemplate';
import FormGRF from '../components/grf/FormGRF';
import SendEmailModal from '../components/shared/SendEmailModal';
import SuccessModal from '../components/shared/SuccessModal';

export default function GRFPage() { // Renamed from GRF to GRFPage
  const [registos, setRegistos] = useState([]);
  const [aeroportos, setAeroportos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [selectedRegistos, setSelectedRegistos] = useState([]);
  const [editingRegisto, setEditingRegisto] = useState(null);
  const [alertInfo, setAlertInfo] = useState({ isOpen: false, type: '', title: '', message: '', showCancel: false, onConfirm: () => {}, confirmText: 'Ok' });
  const [successInfo, setSuccessInfo] = useState({ isOpen: false, title: '', message: '' });
  const [currentUser, setUser] = useState(null); // Added currentUser state

  const [filtros, setFiltros] = useState({
    aeroporto: 'todos',
    mes: new Date().getMonth() + 1,
    pista: 'todas'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const currentUser = await User.me();
      setUser(currentUser);

      const empId = currentUser.empresa_id;
      const [registosData, aeroportosData] = await Promise.all([
        RegistoGRF.list('-mes', 100), // Added limit of 100
        empId ? Aeroporto.filter({ empresa_id: empId }) : Aeroporto.list()
      ]);

      const aeroportosAngola = aeroportosData.filter(a => a.pais === 'AO');

      // FILTRO CRÍTICO: Filtrar registos GRF por aeroportos do utilizador (empresa-based)
      const registosFiltrados = filtrarDadosPorAcesso(currentUser, registosData, 'aeroporto', aeroportosAngola);
      setRegistos(registosFiltrados);
      setAeroportos(aeroportosAngola);
    } catch (error) {
      console.error('Erro ao carregar dados GRF:', error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro ao Carregar Dados',
        message: 'Não foi possível carregar os registos GRF ou aeroportos. Tente novamente mais tarde.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = async (data) => {
    try {
      if (editingRegisto) {
        await RegistoGRF.update(editingRegisto.id, data);
        setSuccessInfo({ 
          isOpen: true, 
          title: 'GRF Atualizado!', 
          message: 'O registo GRF foi atualizado com sucesso.' 
        });
      } else {
        await RegistoGRF.create(data);
        setSuccessInfo({ 
          isOpen: true, 
          title: 'GRF Registado!', 
          message: 'O registo GRF foi criado com sucesso.' 
        });
      }
      setIsFormOpen(false);
      setEditingRegisto(null);
      loadData();
    } catch (error) {
      console.error('Erro ao salvar GRF:', error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro ao Salvar',
        message: 'Não foi possível salvar o registo GRF. Verifique os dados e tente novamente.',
        showCancel: false,
        confirmText: 'Ok'
      });
    }
  };

  const handleEdit = (registo) => {
    setEditingRegisto(registo);
    setIsFormOpen(true);
  };

  const handleDelete = async (registoId) => {
    setAlertInfo({
      isOpen: true,
      type: 'error',
      title: 'Excluir Registo GRF',
      message: `⚠️ ATENÇÃO: Esta ação é irreversível!\n\nTem certeza que deseja excluir permanentemente este registo GRF?\n\nEsta ação removerá completamente o registo do sistema e não poderá ser desfeita.`,
      showCancel: true,
      confirmText: 'Excluir Permanentemente',
      onConfirm: async () => {
        // The AlertDialogAction's onClick will handle closing and resetting alertInfo after this callback
        try {
          await RegistoGRF.delete(registoId);
          setSuccessInfo({ 
            isOpen: true, 
            title: 'GRF Excluído!', 
            message: 'O registo GRF foi excluído com sucesso.' 
          });
          loadData();
        } catch (error) {
          console.error('Erro ao excluir registo GRF:', error);
          setAlertInfo({
            isOpen: true,
            type: 'error',
            title: 'Erro ao Excluir',
            message: 'Não foi possível excluir o registo GRF. Tente novamente.',
            showCancel: false,
            confirmText: 'Ok'
          });
        }
      }
    });
  };

  const handleSelectRegistro = (registoId, isSelected) => {
    if (isSelected) {
      setSelectedRegistos(prev => [...prev, registoId]);
    } else {
      setSelectedRegistos(prev => prev.filter(id => id !== registoId));
    }
  };

  const handleSelectAll = (isSelected) => {
    if (isSelected) {
      setSelectedRegistos(filteredRegistos.map(r => r.id));
    } else {
      setSelectedRegistos([]);
    }
  };

  const filteredRegistos = registos.filter(reg => {
    const aeroportoMatch = filtros.aeroporto === 'todos' || reg.aeroporto === filtros.aeroporto;
    const mesMatch = !filtros.mes || reg.mes === filtros.mes;
    const pistaMatch = filtros.pista === 'todas' || reg.pista === filtros.pista;
    
    return aeroportoMatch && mesMatch && pistaMatch;
  });

  const handleSendEmail = async (recipient, subject) => {
    if (selectedRegistos.length === 0) {
      setAlertInfo({
        isOpen: true,
        type: 'warning',
        title: 'Nenhuma Seleção',
        message: 'Por favor, selecione pelo menos um registo para enviar por e-mail.',
        showCancel: false,
        confirmText: 'Ok'
      });
      return false;
    }

    try {
      const registosParaEmail = filteredRegistos.filter(reg => selectedRegistos.includes(reg.id));
      
      const emailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 900px; margin: 0 auto;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="/logo-dirops.png" alt="DIROPS Logo" style="height: 60px;">
            <h1 style="color: #1e40af; margin-top: 20px;">Relatório GRF - Condições da Pista</h1>
            <p style="color: #64748b;">Data: ${new Date().toLocaleDateString('pt-AO')}</p>
          </div>
          
          <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #1e40af; margin-top: 0;">Resumo:</h3>
            <p><strong>Total de registos:</strong> ${registosParaEmail.length}</p>
            <p><strong>Aeroportos:</strong> ${[...new Set(registosParaEmail.map(r => r.aeroporto))].join(', ')}</p>
            <p><strong>Pistas:</strong> ${[...new Set(registosParaEmail.map(r => r.pista))].join(', ')}</p>
          </div>
          
          <h3 style="color: #1e40af;">Registos GRF Detalhados:</h3>
          
          ${registosParaEmail.map((reg, index) => `
            <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin: 15px 0; background-color: #fafafa;">
              <h4 style="color: #1e40af; margin-top: 0;">Registo ${index + 1}</h4>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 5px; font-weight: bold; width: 150px;">Aeroporto:</td>
                  <td style="padding: 5px;">${reg.aeroporto}</td>
                  <td style="padding: 5px; font-weight: bold; width: 100px;">Data:</td>
                  <td style="padding: 5px;">${reg.dia}/${reg.mes}/2025</td>
                </tr>
                <tr>
                  <td style="padding: 5px; font-weight: bold;">Hora UTC:</td>
                  <td style="padding: 5px;">${reg.hora_utc}</td>
                  <td style="padding: 5px; font-weight: bold;">Pista:</td>
                  <td style="padding: 5px;">${reg.pista}</td>
                </tr>
              </table>
              
              <div style="margin-top: 15px;">
                <h5 style="color: #374151; margin-bottom: 10px;">Condições por Troço:</h5>
                <table style="width: 100%; border-collapse: collapse; border: 1px solid #d1d5db;">
                  <thead>
                    <tr style="background-color: #f3f4f6;">
                      <th style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">Troço</th>
                      <th style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">RWYCC</th>
                      <th style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">% Troço</th>
                      <th style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">Lâmina</th>
                      <th style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">Condição</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style="border: 1px solid #d1d5db; padding: 8px;">1</td>
                      <td style="border: 1px solid #d1d5db; padding: 8px;">${reg.rwycc1}</td>
                      <td style="border: 1px solid #d1d5db; padding: 8px;">${reg.perc1}</td>
                      <td style="border: 1px solid #d1d5db; padding: 8px;">${reg.lamina1}</td>
                      <td style="border: 1px solid #d1d5db; padding: 8px;">${reg.condicao1}</td>
                    </tr>
                    <tr>
                      <td style="border: 1px solid #d1d5db; padding: 8px;">2</td>
                      <td style="border: 1px solid #d1d5db; padding: 8px;">${reg.rwycc2}</td>
                      <td style="border: 1px solid #d1d5db; padding: 8px;">${reg.perc2}</td>
                      <td style="border: 1px solid #d1d5db; padding: 8px;">${reg.lamina2}</td>
                      <td style="border: 1px solid #d1d5db; padding: 8px;">${reg.condicao2}</td>
                    </tr>
                    <tr>
                      <td style="border: 1px solid #d1d5db; padding: 8px;">3</td>
                      <td style="border: 1px solid #d1d5db; padding: 8px;">${reg.rwycc3}</td>
                      <td style="border: 1px solid #d1d5db; padding: 8px;">${reg.perc3}</td>
                      <td style="border: 1px solid #d1d5db; padding: 8px;">${reg.lamina3}</td>
                      <td style="border: 1px solid #d1d5db; padding: 8px;">${reg.condicao3}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              ${reg.observacoes ? `
                <div style="margin-top: 15px;">
                  <h5 style="color: #374151; margin-bottom: 5px;">Observações:</h5>
                  <p style="background-color: #ffffff; padding: 10px; border-left: 4px solid #1e40af; margin: 0;">${reg.observacoes}</p>
                </div>
              ` : ''}
            </div>
          `).join('')}
          
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
            <p><strong>Melhores Cumprimentos,</strong></p>
            <p>Sistema DIROPS<br>Direcção de Operações</p>
          </div>
        </div>
      `;

      const result = await sendEmailDirect({
        to: recipient,
        subject: subject,
        body: emailBody,
        from_name: 'DIROPS'
      });

      if (result.status !== 200) {
        const errorData = result.data || { error: 'Falha desconhecida no backend' };
        
        // Analisar o tipo de erro e criar mensagem personalizada
        let errorTitle = 'Erro ao Enviar E-mail';
        let errorMessage = '';
        
        if (errorData.error && errorData.error.includes('Cannot send emails to users outside the app')) {
          errorTitle = 'Destinatário Não Autorizado';
          errorMessage = `Não foi possível enviar o relatório para "${recipient}". 

O sistema apenas permite o envio de e-mails para utilizadores registados na aplicação DIROPS.

Soluções:
• Registe o destinatário como utilizador no sistema
• Contacte o administrador para mais informações
• Use um endereço de e-mail já registado no sistema`;
        } else if (errorData.error && (errorData.error.includes('timeout') || errorData.error.includes('network'))) {
          errorTitle = 'Problema de Conectividade';
          errorMessage = `Não foi possível enviar o e-mail devido a um problema de conexão.

Por favor:
• Verifique a sua ligação à internet
• Tente novamente dentro de alguns minutos
• Se o problema persistir, contacte o suporte técnico`;
        } else if (errorData.error && errorData.error.includes('invalid email')) {
          errorTitle = 'Endereço de E-mail Inválido';
          errorMessage = `O endereço de e-mail "${recipient}" não é válido.

Por favor:
• Verifique se o endereço está escrito correctamente
• Certifique-se de que contém @ e um domínio válido
• Tente com um endereço diferente`;
        } else {
          errorTitle = 'Erro no Envio';
          errorMessage = `Não foi possível enviar o e-mail para "${recipient}".

Detalhes técnicos: ${errorData.error || 'Erro desconhecido'}

Por favor tente novamente ou contacte o suporte técnico se o problema persistir.`;
        }
        
        setAlertInfo({
          isOpen: true,
          type: 'error',
          title: errorTitle,
          message: errorMessage,
          showCancel: false,
          confirmText: 'Ok'
        });
        return false;
      }

      setSuccessInfo({
        isOpen: true,
        title: 'E-mail Enviado com Sucesso',
        message: `O relatório GRF foi enviado com sucesso para "${recipient}".`
      });
      return true;
      
    } catch (error) {
      console.error("Erro detalhado ao enviar email:", error);
      
      // Tratamento de erros de conexão/rede
      let errorTitle = 'Erro ao Enviar E-mail';
      let errorMessage = '';
      
      if (error.message && error.message.includes('fetch')) {
        errorTitle = 'Problema de Conectividade';
        errorMessage = `Não foi possível estabelecer conexão com o servidor de e-mail.

Por favor:
• Verifique a sua ligação à internet
• Tente novamente dentro de alguns minutos
• Se o problema persistir, contacte o suporte técnico`;
      } else {
        errorMessage = `Ocorreu um erro inesperado ao enviar o e-mail para "${recipient}".

Detalhes: ${error.message || 'Erro desconhecido'}

Por favor tente novamente ou contacte o suporte técnico.`;
      }
      
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: errorTitle,
        message: errorMessage,
        showCancel: false,
        confirmText: 'Ok'
      });
      return false;
    }
  };

  const handleExportCSV = () => {
    const registosParaExportar = selectedRegistos.length > 0 
      ? filteredRegistos.filter(reg => selectedRegistos.includes(reg.id))
      : filteredRegistos;

    if (registosParaExportar.length === 0) {
      setAlertInfo({
        isOpen: true,
        type: 'info',
        title: 'Nenhum Registo',
        message: 'Não há registos GRF para exportar com os filtros aplicados.',
        showCancel: false,
        confirmText: 'Ok'
      });
      return;
    }

    const dataToExport = registosParaExportar.map(reg => ({
      'Aeroporto': reg.aeroporto,
      'Data': `${reg.dia}/${reg.mes}/2025`,
      'Hora UTC': reg.hora_utc,
      'Pista': reg.pista,
      'RWYCC': `${reg.rwycc1}/${reg.rwycc2}/${reg.rwycc3}`,
      'Perc. Troço': `${reg.perc1}/${reg.perc2}/${reg.perc3}`,
      'Lâmina': `${reg.lamina1}/${reg.lamina2}/${reg.lamina3}`,
      'Condição': `${reg.condicao1}/${reg.condicao2}/${reg.condicao3}`,
      'Observações': reg.observacoes
    }));
    downloadAsCSV(dataToExport, `grf_registos_${new Date().toISOString().split('T')[0]}`);
  };

  const handleExportPDF = async () => {
    try {
      const registosParaExportar = selectedRegistos.length > 0
        ? filteredRegistos.filter(reg => selectedRegistos.includes(reg.id))
        : filteredRegistos;

      if (registosParaExportar.length === 0) {
        setAlertInfo({
          isOpen: true,
          type: 'info',
          title: 'Nenhum Registo',
          message: 'Não há registos GRF para exportar com os filtros aplicados.',
          showCancel: false,
          confirmText: 'Ok'
        });
        return;
      }

      const doc = await createPdfDoc({ orientation: 'landscape' });

      // Load empresa logo
      const logoBase64 = await fetchEmpresaLogo(currentUser?.empresa_id);

      // Header options (reused on page breaks)
      const headerOpts = {
        title: 'Relatório GRF — Condições da Pista',
        logoBase64,
        date: new Date().toLocaleDateString('pt-AO'),
        meta: [`Total de registos: ${registosParaExportar.length}`],
      };

      let y = addHeader(doc, headerOpts);

      // Table columns — total width fits landscape (297 - 15 - 15 = 267mm)
      const columns = [
        { label: 'Aeroporto', width: 38 },
        { label: 'Data',      width: 28 },
        { label: 'Hora',      width: 24 },
        { label: 'Pista',     width: 22 },
        { label: 'RWYCC',     width: 34 },
        { label: 'Perc.',     width: 34 },
        { label: 'Lâmina',    width: 34 },
        { label: 'Condição',  width: 53 },
      ];

      // Build row data
      const rows = registosParaExportar.map(reg => [
        reg.aeroporto,
        `${reg.dia}/${reg.mes}`,
        reg.hora_utc,
        reg.pista,
        `${reg.rwycc1}/${reg.rwycc2}/${reg.rwycc3}`,
        `${reg.perc1}/${reg.perc2}/${reg.perc3}`,
        `${reg.lamina1}/${reg.lamina2}/${reg.lamina3}`,
        `${reg.condicao1}/${reg.condicao2}/${reg.condicao3}`,
      ]);

      addTable(doc, y, { columns, rows, headerOpts });

      // Footer on all pages
      addFooter(doc, { generatedBy: currentUser?.full_name || currentUser?.email });

      doc.save(`grf_relatorio_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro na Exportação',
        message: 'Erro ao gerar PDF. Tente novamente.',
        showCancel: false,
        confirmText: 'Ok'
      });
    }
  };

  const allSelected = filteredRegistos.length > 0 && filteredRegistos.every(reg => selectedRegistos.includes(reg.id));

  return (
    <div className="p-4 md:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Plane className="w-6 md:w-8 h-6 md:h-8 text-blue-600" />
              GRF – Condições da Pista
            </h1>
            <p className="text-slate-600 mt-1">Registo e gestão das condições das pistas dos aeroportos</p>
          </div>
          <div className="flex flex-wrap gap-2 w-full lg:w-auto">
            <Button variant="outline" onClick={loadData} className="border-slate-300 text-slate-700 hover:bg-slate-100">
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar
            </Button>
            <Button variant="outline" onClick={handleExportCSV} className="border-slate-300 text-slate-700 hover:bg-slate-100">
              <FileDown className="w-4 h-4 mr-2" />
              Exportar CSV
              {selectedRegistos.length > 0 && ` (${selectedRegistos.length})`}
            </Button>
            <Button variant="outline" onClick={handleExportPDF} className="border-slate-300 text-slate-700 hover:bg-slate-100">
              <FileText className="w-4 h-4 mr-2" />
              Exportar PDF
              {selectedRegistos.length > 0 && ` (${selectedRegistos.length})`}
            </Button>
            {selectedRegistos.length > 0 && (
              <Button variant="outline" onClick={() => setIsEmailModalOpen(true)} className="border-blue-300 text-blue-600 hover:bg-blue-50">
                <Mail className="w-4 h-4 mr-2" />
                Enviar Email ({selectedRegistos.length})
              </Button>
            )}
            <Button onClick={() => setIsFormOpen(true)} className="bg-blue-500 hover:bg-blue-600 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Novo Registo GRF
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Aeroporto</label>
                <select 
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={filtros.aeroporto} 
                  onChange={(e) => setFiltros({...filtros, aeroporto: e.target.value})}
                >
                  <option value="todos">Todos</option>
                  {aeroportos.map(a => (
                    <option key={a.id} value={a.codigo_icao}>{a.nome} ({a.codigo_icao})</option>
                  ))}
                </select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Mês</label>
                <select 
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={filtros.mes?.toString()} 
                  onChange={(e) => setFiltros({...filtros, mes: parseInt(e.target.value)})}
                >
                  {Array.from({length: 12}, (_, i) => (
                    <option key={i+1} value={(i+1).toString()}>
                      {new Date(2025, i).toLocaleDateString('pt-AO', { month: 'long' })}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Pista</label>
                <select 
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={filtros.pista} 
                  onChange={(e) => setFiltros({...filtros, pista: e.target.value})}
                >
                  <option value="todas">Todas</option>
                  <option value="05">05</option>
                  <option value="07">07</option>
                  <option value="23">23</option>
                  <option value="25">25</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Registos */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Registos GRF</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-slate-500 mt-2">A carregar registos...</p>
              </div>
            ) : filteredRegistos.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Plane className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-semibold text-slate-700 mb-2">
                  Nenhum registo encontrado
                </h3>
                <p className="text-slate-500">
                  Não há registos GRF que correspondam aos filtros selecionados.
                </p>
              </div>
            ) : (
              <>
                {/* Header com seleção */}
                <div className="mb-4 p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={handleSelectAll}
                        className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                      />
                      <span className="text-sm font-medium text-slate-700">
                        {selectedRegistos.length > 0 
                          ? `${selectedRegistos.length} de ${filteredRegistos.length} selecionados`
                          : `Selecionar todos (${filteredRegistos.length})`
                        }
                      </span>
                    </div>
                    {selectedRegistos.length > 0 && (
                      <span className="text-xs text-slate-500">
                        Use os botões de exportação/email para os itens selecionados
                      </span>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <span className="sr-only">Seleção</span>
                        </TableHead>
                        <TableHead>Aeroporto</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Hora UTC</TableHead>
                        <TableHead>Pista</TableHead>
                        <TableHead>RWYCC</TableHead>
                        <TableHead>Perc. Troço</TableHead>
                        <TableHead>Lâmina</TableHead>
                        <TableHead>Condição</TableHead>
                        <TableHead>Observações</TableHead>
                        <TableHead className="text-center">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRegistos.map((registo) => {
                        const isSelected = selectedRegistos.includes(registo.id);
                        return (
                          <TableRow key={registo.id} className={isSelected ? 'bg-blue-50' : ''}>
                            <TableCell>
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={(checked) => handleSelectRegistro(registo.id, checked)}
                                className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                              />
                            </TableCell>
                            <TableCell>
                              <span className="font-medium">
                                {registo.aeroporto}
                              </span>
                            </TableCell>
                            <TableCell>{registo.dia}/{registo.mes}/2025</TableCell>
                            <TableCell>{registo.hora_utc}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{registo.pista}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {registo.rwycc1}/{registo.rwycc2}/{registo.rwycc3}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {registo.perc1}/{registo.perc2}/{registo.perc3}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {registo.lamina1}/{registo.lamina2}/{registo.lamina3}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm max-w-xs truncate">
                                {registo.condicao1}/{registo.condicao2}/{registo.condicao3}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm max-w-xs truncate">
                                {registo.observacoes || '-'}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEdit(registo)}
                                  className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  title="Editar registo"
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDelete(registo.id)}
                                  className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  title="Excluir registo"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal para formulário GRF */}
      <FormGRF
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingRegisto(null);
        }}
        onSubmit={handleFormSubmit}
        aeroportos={aeroportos}
        registoInicial={editingRegisto}
      />

      {/* Modal para envio de email */}
      {isEmailModalOpen && (
        <SendEmailModal
          isOpen={isEmailModalOpen}
          onClose={() => setIsEmailModalOpen(false)}
          onSend={handleSendEmail}
          defaultSubject={`Relatório GRF - ${selectedRegistos.length} registos selecionados`}
        />
      )}

      {/* Alert Dialog for Errors/Warnings/Confirmations */}
      <AlertDialog open={alertInfo.isOpen} onOpenChange={(open) => {
        // If the dialog is being closed by backdrop click or escape, reset all state
        if (!open) {
          setAlertInfo({ isOpen: false, type: '', title: '', message: '', showCancel: false, onConfirm: () => {}, confirmText: 'Ok' });
        } else {
          // Otherwise, just update isOpen state
          setAlertInfo(prev => ({ ...prev, isOpen: open }));
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className={
              alertInfo.type === 'error' ? 'text-red-600' :
              alertInfo.type === 'warning' ? 'text-yellow-600' :
              'text-blue-600' // Default or info
            }>
              {alertInfo.title}
            </AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-line">
              {alertInfo.message}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {alertInfo.showCancel && (
              <AlertDialogCancel onClick={() => setAlertInfo({ isOpen: false, type: '', title: '', message: '', showCancel: false, onConfirm: () => {}, confirmText: 'Ok' })}>
                Cancelar
              </AlertDialogCancel>
            )}
            <AlertDialogAction 
              className={alertInfo.type === 'error' && alertInfo.showCancel ? 'bg-red-600 hover:bg-red-700' : ''}
              onClick={() => {
                if (alertInfo.onConfirm) {
                  alertInfo.onConfirm(); // Execute the confirmation callback
                }
                // Always close the dialog and reset its state after action
                setAlertInfo({ isOpen: false, type: '', title: '', message: '', showCancel: false, onConfirm: () => {}, confirmText: 'Ok' });
              }}
            >
              {alertInfo.confirmText}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Success Modal */}
      {successInfo.isOpen && (
        <SuccessModal
          isOpen={successInfo.isOpen}
          onClose={() => setSuccessInfo({ isOpen: false, title: '', message: '' })}
          title={successInfo.title}
          message={successInfo.message}
        />
      )}
    </div>
  );
}
