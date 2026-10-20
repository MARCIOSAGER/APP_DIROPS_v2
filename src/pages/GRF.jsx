
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Select from '@/components/ui/select';
import { Plus, RefreshCw, FileDown, FileText, Plane, Mail, Edit, Trash2, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
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
import { downloadAsExcel, excelBase64 } from '../components/lib/export';
import { filtrarDadosPorAcesso } from '@/components/lib/userUtils';
import { sendEmailDirect } from '@/functions/sendEmailDirect';

import { createPdfDoc, addHeader, addFooter, addTable, fetchEmpresaLogo } from '@/lib/pdfTemplate';
import FormGRF from '../components/grf/FormGRF';
import SendEmailModal from '../components/shared/SendEmailModal';
import SuccessModal from '../components/shared/SuccessModal';
import { useI18n } from '@/components/lib/i18n';
import { useAuth } from '@/lib/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { useRegistosGRF } from '@/hooks/useRegistosGRF';

export default function GRFPage() { // Renamed from GRF to GRFPage
  const { t } = useI18n();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const empId = currentUser?.empresa_id;
  const { data: registosRaw = [], isLoading: isLoadingGRF } = useRegistosGRF({ empresaId: empId, enabled: !!currentUser });

  const [aeroportos, setAeroportos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [selectedRegistos, setSelectedRegistos] = useState([]);
  const [editingRegisto, setEditingRegisto] = useState(null);
  const [alertInfo, setAlertInfo] = useState({ isOpen: false, type: '', title: '', message: '', showCancel: false, onConfirm: () => {}, confirmText: 'Ok' });
  const [successInfo, setSuccessInfo] = useState({ isOpen: false, title: '', message: '' });

  const [filtros, setFiltros] = useState({
    aeroporto: 'todos',
    ano: new Date().getFullYear(),
    mes: new Date().getMonth() + 1,
    pista: 'todas'
  });
  // Ordenação por cabeçalho (clique alterna asc/desc). Default: data mais recente primeiro.
  const [sortConfig, setSortConfig] = useState({ key: 'data', dir: 'desc' });
  const handleSort = (key) => setSortConfig((p) => p.key === key ? { key, dir: p.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });

  // Load secondary data (aeroportos only)
  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const aeroportosData = empId ? await Aeroporto.filter({ empresa_id: empId }) : await Aeroporto.list();
        // GRF é só para aeroportos GERIDOS pela SGA (isSGA=true) — não todos os de Angola.
        const aeroportosSGA = aeroportosData.filter(a => a.pais === 'AO' && a.isSGA === true);
        setAeroportos(aeroportosSGA);
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
    })();
  }, [empId]);

  // FILTRO CRÍTICO: Filtrar registos GRF por aeroportos do utilizador (empresa-based)
  const registos = React.useMemo(
    () => filtrarDadosPorAcesso(currentUser, registosRaw, 'aeroporto', aeroportos),
    [currentUser, registosRaw, aeroportos]
  );

  const invalidateGRF = React.useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['registos-grf', empId] }),
    [queryClient, empId]
  );

  const handleFormSubmit = async (data) => {
    // Rastreio de quem cria/edita (o form nao capturava -> created_by ficava vazio).
    const userLabel = currentUser?.email || currentUser?.full_name || null;
    // Resiliente: se a coluna 'ano' ainda nao existe (migr 085 por correr), grava
    // sem ela em vez de bloquear (fica so sem ano ate correr a 085).
    const semColuna = (e) => /(ano|created_by|updated_by)/i.test(e?.message || '') && /(schema cache|column|PGRST204)/i.test(e?.message || '');
    const criar = async (rec) => { try { return await RegistoGRF.create(rec); } catch (e) { if (semColuna(e)) { const { ano, created_by, updated_by, ...r } = rec; return await RegistoGRF.create(r); } throw e; } };
    const atualizar = async (id, ch) => { try { return await RegistoGRF.update(id, ch); } catch (e) { if (semColuna(e)) { const { ano, created_by, updated_by, ...r } = ch; return await RegistoGRF.update(id, r); } throw e; } };
    try {
      if (editingRegisto) {
        await atualizar(editingRegisto.id, { ...data, updated_by: userLabel });
        setSuccessInfo({
          isOpen: true,
          title: 'GRF Atualizado!',
          message: 'O registo GRF foi atualizado com sucesso.'
        });
      } else {
        await criar({ ...data, created_by: userLabel });
        setSuccessInfo({ 
          isOpen: true, 
          title: 'GRF Registado!', 
          message: 'O registo GRF foi criado com sucesso.' 
        });
      }
      setIsFormOpen(false);
      setEditingRegisto(null);
      invalidateGRF();
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
          invalidateGRF();
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

  // valor comparável por coluna (as colunas compostas ordenam pelo 1.º troço)
  const sortVal = (reg, key) => {
    switch (key) {
      case 'data': return Number(reg.ano || 0) * 10000 + Number(reg.mes || 0) * 100 + Number(reg.dia || 0);
      case 'rwycc': return Number(reg.rwycc1 ?? -1);
      case 'perc': return Number(reg.perc1 ?? -1);
      case 'aeroporto': return (reg.aeroporto || '').toString();
      case 'hora_utc': return (reg.hora_utc || '').toString();
      case 'pista': return (reg.pista || '').toString();
      case 'lamina': return (reg.lamina1 || '').toString();
      case 'condicao': return (reg.condicao1 || '').toString();
      case 'observacoes': return (reg.observacoes || '').toString();
      case 'criado_por': return (reg.created_by || reg.updated_by || '').toString();
      default: return '';
    }
  };
  const filteredRegistos = registos.filter(reg => {
    const aeroportoMatch = filtros.aeroporto === 'todos' || reg.aeroporto === filtros.aeroporto;
    const anoMatch = filtros.ano === 'todos' || !filtros.ano || reg.ano === filtros.ano;
    const mesMatch = filtros.mes === 'todos' || !filtros.mes || reg.mes === filtros.mes;
    const pistaMatch = filtros.pista === 'todas' || reg.pista === filtros.pista;

    return aeroportoMatch && anoMatch && mesMatch && pistaMatch;
  }).sort((a, b) => {
    const va = sortVal(a, sortConfig.key), vb = sortVal(b, sortConfig.key);
    const cmp = (typeof va === 'number' && typeof vb === 'number')
      ? va - vb
      : String(va).localeCompare(String(vb), 'pt', { numeric: true });
    return sortConfig.dir === 'asc' ? cmp : -cmp;
  });

  // Gera o PDF do GRF (paisagem) e devolve o doc jsPDF — partilhado pelo download
  // (handleExportPDF) e pelo anexo do email (handleSendEmail).
  const buildGrfPdf = async (registosParaPdf) => {
    const doc = await createPdfDoc({ orientation: 'landscape' });
    const logoBase64 = await fetchEmpresaLogo(currentUser?.empresa_id);
    const headerOpts = {
      title: 'Relatório GRF — Condições da Pista',
      logoBase64,
      date: new Date().toLocaleDateString('pt-AO'),
      meta: [`Total de registos: ${registosParaPdf.length}`],
    };
    const y = addHeader(doc, headerOpts);
    const columns = [
      { label: 'Aeroporto', width: 38 }, { label: 'Data', width: 28 }, { label: 'Hora', width: 24 },
      { label: 'Pista', width: 22 }, { label: 'RWYCC', width: 34 }, { label: 'Perc.', width: 34 },
      { label: 'Lâmina', width: 34 }, { label: 'Condição', width: 53 },
    ];
    const rows = registosParaPdf.map(reg => [
      reg.aeroporto, `${reg.dia}/${reg.mes}/${reg.ano || ''}`, reg.hora_utc, reg.pista,
      `${reg.rwycc1}/${reg.rwycc2}/${reg.rwycc3}`, `${reg.perc1}/${reg.perc2}/${reg.perc3}`,
      `${reg.lamina1}/${reg.lamina2}/${reg.lamina3}`, `${reg.condicao1}/${reg.condicao2}/${reg.condicao3}`,
    ]);
    addTable(doc, y, { columns, rows, headerOpts });
    addFooter(doc, { generatedBy: currentUser?.full_name || currentUser?.email });
    return doc;
  };

  // Linhas do relatório em formato tabular (partilhado pelo Exportar XLSX e pelo anexo do email).
  const buildGrfExcelRows = (rows) => rows.map(reg => ({
    'Aeroporto': reg.aeroporto,
    'Data': `${reg.dia}/${reg.mes}/${reg.ano || ''}`,
    'Hora UTC': reg.hora_utc,
    'Pista': reg.pista,
    'RWYCC': `${reg.rwycc1}/${reg.rwycc2}/${reg.rwycc3}`,
    'Perc. Troço': `${reg.perc1}/${reg.perc2}/${reg.perc3}`,
    'Lâmina': `${reg.lamina1}/${reg.lamina2}/${reg.lamina3}`,
    'Condição': `${reg.condicao1}/${reg.condicao2}/${reg.condicao3}`,
    'Observações': reg.observacoes,
    'Criado por': reg.created_by || reg.updated_by || ''
  }));

  const handleSendEmail = async (payload, maybeSubject) => {
    // O SendEmailModal chama onSend({to, subject, message}) — um OBJETO. Antes o
    // handler tratava-o como `recipient` (string) -> "[object Object]" -> erro.
    const isObj = payload && typeof payload === 'object';
    const recipient = (isObj ? payload.to : payload) || '';
    const subject = (isObj ? payload.subject : maybeSubject) || 'Relatório GRF — Condições da Pista';
    const mensagemExtra = isObj ? (payload.message || '') : '';
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

    setIsSendingEmail(true);
    try {
      const registosParaEmail = filteredRegistos.filter(reg => selectedRegistos.includes(reg.id));
      
      const emailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 900px; margin: 0 auto;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="/logo-sga.png" alt="SGA Logo" style="height: 60px;">
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
            <p>Sistema SGA<br>Direcção de Operações</p>
          </div>
        </div>
      `;

      // Suporta múltiplos destinatários (vírgula) — o endpoint aceita array.
      const toArr = recipient.split(',').map((s) => s.trim()).filter(Boolean);
      const corpoFinal = mensagemExtra
        ? `<p style="font-family:Arial,sans-serif;font-size:14px;color:#334155;white-space:pre-line;margin:0 0 16px">${mensagemExtra.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</p>${emailBody}`
        : emailBody;
      // Anexa PDF (visual) + XLSX (dados) do GRF. Best-effort: se algum falhar,
      // envia com o que der (e sempre o HTML no corpo).
      const stamp = new Date().toISOString().split('T')[0];
      const anexos = [];
      try {
        const doc = await buildGrfPdf(registosParaEmail);
        const b64 = doc.output('datauristring').split('base64,')[1];
        if (b64) anexos.push({ filename: `Relatorio_GRF_${stamp}.pdf`, content: b64, contentType: 'application/pdf' });
      } catch (e) { console.warn('PDF GRF (anexo) falhou:', e); }
      try {
        const xlsxB64 = await excelBase64(buildGrfExcelRows(registosParaEmail));
        if (xlsxB64) anexos.push({ filename: `Relatorio_GRF_${stamp}.xlsx`, content: xlsxB64, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      } catch (e) { console.warn('XLSX GRF (anexo) falhou:', e); }

      const result = await sendEmailDirect({
        to: toArr,
        subject: subject,
        body: corpoFinal,
        from_name: 'SGA',
        attachments: anexos,
      });

      // sendEmailDirect devolve o CORPO da resposta ({ success, ... }); em falha real
      // ele LANÇA (vai para o catch). Aqui só tratamos sucesso=false (2xx sem success).
      if (!result || !result.success) {
        const errorData = (result && result.error) ? result : { error: 'Falha desconhecida no backend' };
        
        // Analisar o tipo de erro e criar mensagem personalizada
        let errorTitle = 'Erro ao Enviar E-mail';
        let errorMessage = '';
        
        if (errorData.error && errorData.error.includes('Cannot send emails to users outside the app')) {
          errorTitle = 'Destinatário Não Autorizado';
          errorMessage = `Não foi possível enviar o relatório para "${recipient}". 

O sistema apenas permite o envio de e-mails para utilizadores registados na aplicação SGA.

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

      setIsEmailModalOpen(false); // fecha o modal de envio p/ o de sucesso ficar visível
      setSuccessInfo({
        isOpen: true,
        title: 'E-mail Enviado com Sucesso',
        message: `Relatório GRF enviado para: ${toArr.join(', ')} (${registosParaEmail.length} registo(s)${anexos.length ? ` · anexos: ${anexos.map(a => a.filename.split('.').pop().toUpperCase()).join(' + ')}` : ''}).`
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
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleExportXLSX = async () => {
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

    const dataToExport = buildGrfExcelRows(registosParaExportar);
    const ok = await downloadAsExcel(dataToExport, `grf_registos_${new Date().toISOString().split('T')[0]}`);
    if (!ok) {
      setAlertInfo({ isOpen: true, type: 'error', title: 'Falha na Exportação', message: 'Não foi possível gerar o ficheiro Excel.', showCancel: false, confirmText: 'Ok' });
    }
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

      const doc = await buildGrfPdf(registosParaExportar);
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
    <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-950 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-3">
              <Plane className="w-6 md:w-8 h-6 md:h-8 text-blue-600 dark:text-blue-400" />
              {t('page.grf.title')}
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">{t('page.grf.subtitle')}</p>
          </div>
          <div className="flex flex-wrap gap-2 w-full lg:w-auto">
            <Button variant="outline" onClick={invalidateGRF} className="border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
              <RefreshCw className="w-4 h-4 mr-2" />
              {t('grf.atualizar')}
            </Button>
            <Button variant="outline" onClick={handleExportXLSX} className="border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
              <FileDown className="w-4 h-4 mr-2" />
              Exportar XLSX
              {selectedRegistos.length > 0 && ` (${selectedRegistos.length})`}
            </Button>
            <Button variant="outline" onClick={handleExportPDF} className="border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
              <FileText className="w-4 h-4 mr-2" />
              {t('grf.exportarPDF')}
              {selectedRegistos.length > 0 && ` (${selectedRegistos.length})`}
            </Button>
            {selectedRegistos.length > 0 && (
              <Button variant="outline" onClick={() => setIsEmailModalOpen(true)} className="border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950">
                <Mail className="w-4 h-4 mr-2" />
                {t('grf.enviarEmail')} ({selectedRegistos.length})
              </Button>
            )}
            <Button onClick={() => setIsFormOpen(true)} className="bg-blue-500 hover:bg-blue-600 text-white">
              <Plus className="w-4 h-4 mr-2" />
              {t('grf.novoRegisto')}
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">{t('grf.filtros')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('grf.aeroporto')}</label>
                <Select
                  options={[{ value: 'todos', label: t('grf.todos') }, ...aeroportos.map(a => ({ value: a.codigo_icao, label: `${a.codigo_icao} — ${a.nome}` }))]}
                  value={filtros.aeroporto}
                  onValueChange={(v) => setFiltros({ ...filtros, aeroporto: v || 'todos' })}
                  placeholder={t('grf.todos')}
                  searchPlaceholder="Procurar aeroporto..."
                  noResultsMessage="Nenhum aeroporto encontrado"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Ano</label>
                <select
                  className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={filtros.ano === 'todos' ? 'todos' : filtros.ano?.toString()}
                  onChange={(e) => setFiltros({...filtros, ano: e.target.value === 'todos' ? 'todos' : parseInt(e.target.value)})}
                >
                  <option value="todos">Todos os anos</option>
                  {Array.from({length: 5}, (_, i) => new Date().getFullYear() - 3 + i).map(y => (
                    <option key={y} value={y.toString()}>{y}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('grf.mes')}</label>
                <select
                  className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={filtros.mes === 'todos' ? 'todos' : filtros.mes?.toString()}
                  onChange={(e) => setFiltros({...filtros, mes: e.target.value === 'todos' ? 'todos' : parseInt(e.target.value)})}
                >
                  <option value="todos">Todos os meses</option>
                  {Array.from({length: 12}, (_, i) => (
                    <option key={i+1} value={(i+1).toString()}>
                      {new Date(2025, i).toLocaleDateString('pt-AO', { month: 'long' })}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('grf.pista')}</label>
                <select
                  className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={filtros.pista}
                  onChange={(e) => setFiltros({...filtros, pista: e.target.value})}
                >
                  <option value="todas">{t('grf.todas')}</option>
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
            <CardTitle className="text-lg">{t('grf.registosGRF')}</CardTitle>
          </CardHeader>
          <CardContent>
            {(isLoading || isLoadingGRF) ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-slate-500 dark:text-slate-400 mt-2">{t('grf.carregando')}</p>
              </div>
            ) : filteredRegistos.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Plane className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  {t('grf.nenhumRegisto')}
                </h3>
                <p className="text-slate-500 dark:text-slate-400">
                  {t('grf.nenhumRegistoDesc')}
                </p>
              </div>
            ) : (
              <>
                {/* Header com seleção */}
                <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={handleSelectAll}
                        className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                      />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {selectedRegistos.length > 0
                          ? `${selectedRegistos.length} de ${filteredRegistos.length} ${t('grf.selecionados')}`
                          : `${t('grf.selecionarTodos')} (${filteredRegistos.length})`
                        }
                      </span>
                    </div>
                    {selectedRegistos.length > 0 && (
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {t('grf.exportarEmailDica')}
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
                        {[
                          { key: 'aeroporto', label: t('grf.aeroporto') },
                          { key: 'data', label: t('grf.data') },
                          { key: 'hora_utc', label: t('grf.horaUTC') },
                          { key: 'pista', label: t('grf.pista') },
                          { key: 'rwycc', label: t('grf.rwycc') },
                          { key: 'perc', label: t('grf.percTroco') },
                          { key: 'lamina', label: t('grf.lamina') },
                          { key: 'condicao', label: t('grf.condicao') },
                          { key: 'observacoes', label: t('grf.observacoes') },
                          { key: 'criado_por', label: 'Criado por' },
                        ].map((col) => (
                          <TableHead key={col.key} onClick={() => handleSort(col.key)}
                            className="cursor-pointer select-none whitespace-nowrap hover:bg-slate-50 dark:hover:bg-slate-800">
                            <span className="inline-flex items-center gap-1">
                              {col.label}
                              {sortConfig.key === col.key
                                ? (sortConfig.dir === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />)
                                : <ChevronsUpDown className="w-3.5 h-3.5 opacity-40" />}
                            </span>
                          </TableHead>
                        ))}
                        <TableHead className="text-center">{t('grf.acoes')}</TableHead>
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
                            <TableCell>{registo.dia}/{registo.mes}/{registo.ano || '—'}</TableCell>
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
                              <div className="text-xs max-w-[180px] truncate" title={registo.observacoes || ''}>
                                {registo.observacoes || '-'}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-xs text-slate-600 dark:text-slate-400 max-w-[110px] truncate" title={registo.created_by || registo.updated_by || ''}>
                                {(registo.created_by || registo.updated_by || '').split('@')[0] || '—'}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEdit(registo)}
                                  className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  title={t('grf.editarRegisto')}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDelete(registo.id)}
                                  className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  title={t('grf.excluirRegisto')}
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
          isSending={isSendingEmail}
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
                {t('grf.cancelar')}
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
