
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, RefreshCw, Filter, FileDown, FileText, Mail, Search, Loader2, X, Shield, GraduationCap } from 'lucide-react';
import Select from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

import { OcorrenciaSafety } from '@/entities/OcorrenciaSafety';
import { Aeroporto } from '@/entities/Aeroporto';
import { useOcorrencias } from '@/hooks/useOcorrencias';
import SafetyOccurrencesList from '../components/safety/SafetyOccurrencesList';
import FormSafetyOccurrence from '../components/safety/FormSafetyOccurrence';
import TreinamentosLicencasTab from '../components/safety/TreinamentosLicencasTab';
import { createPdfDoc, addHeader, addFooter, addTable, addSectionTitle, addKeyValuePairs, checkPageBreak, loadImageAsBase64, PDF } from '@/lib/pdfTemplate';
import { sendEmailDirect } from '@/functions/sendEmailDirect';
import SendEmailModal from '../components/shared/SendEmailModal';
import AlertModal from '../components/shared/AlertModal';
import SuccessModal from '../components/shared/SuccessModal';
import { getAeroportosPermitidos, filtrarDadosPorAcesso } from '@/components/lib/userUtils';
import { useI18n } from '@/components/lib/i18n';
import { useAuth } from '@/lib/AuthContext';

export default function Safety() {
  const { t } = useI18n();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('ocorrencias');

  // Primary data via TanStack Query
  const empId = user?.empresa_id;
  const { data: ocorrenciasRaw = [], isLoading: isQueryLoading, refetch } = useOcorrencias({ empresaId: empId });

  // Secondary data: aeroportos (kept as useState per instructions)
  const [aeroportos, setAeroportos] = useState([]);
  const [aeroportosLoaded, setAeroportosLoaded] = useState(false);

  // Derive filtered ocorrencias from query data + aeroportos
  const ocorrencias_derived = useMemo(() => {
    if (!aeroportosLoaded) return [];
    const aeroportosAngola = aeroportos.filter(a => a.pais === 'AO');
    return filtrarDadosPorAcesso(user, ocorrenciasRaw, 'aeroporto', aeroportosAngola);
  }, [ocorrenciasRaw, aeroportos, aeroportosLoaded, user]);

  // State that can be overridden by server-side search (handleBuscar)
  const [searchOverride, setSearchOverride] = useState(null);
  const ocorrencias = searchOverride !== null ? searchOverride : ocorrencias_derived;
  const isLoading = isQueryLoading && !aeroportosLoaded;

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingOcorrencia, setEditingOcorrencia] = useState(null);
  const [selectedOcorrencias, setSelectedOcorrencias] = useState([]);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [alertInfo, setAlertInfo] = useState({ isOpen: false, type: 'error', title: '', message: '' });
  const [successInfo, setSuccessInfo] = useState({ isOpen: false, title: '', message: '' });
  const [filtros, setFiltros] = useState({
    aeroporto: 'todos',
    gravidade: 'todos',
    status: 'todos',
    dataInicio: '',
    dataFim: ''
  });

  // Load aeroportos on mount
  useEffect(() => {
    (async () => {
      try {
        const aeroportosData = empId
          ? await Aeroporto.filter({ empresa_id: empId })
          : await Aeroporto.list();
        const aeroportosAngola = aeroportosData.filter(a => a.pais === 'AO');
        const aeroportosFiltrados = getAeroportosPermitidos(user, aeroportosAngola, user?.empresa_id);
        setAeroportos(aeroportosFiltrados);
        setAeroportosLoaded(true);
      } catch (error) {
        console.error("Erro ao carregar aeroportos:", error);
        setAlertInfo({ isOpen: true, title: t('safety.erro_carregamento'), message: t('safety.erro_carregamento_msg') });
      }
    })();
  }, []);

  const loadData = () => {
    setSearchOverride(null);
    queryClient.invalidateQueries({ queryKey: ['ocorrencias', empId] });
  };

  const handleEdit = (occurrence) => {
    setEditingOcorrencia(occurrence);
    setIsFormOpen(true);
  };
  
  const handleFormSubmit = async (data) => {
    // Timeout: um insert/update pendurado (ex.: sessão/ligação) vira erro visível
    // em vez de deixar o botão preso em "A guardar..." para sempre.
    const withTimeout = (p) => Promise.race([
      p,
      new Promise((_, rej) => setTimeout(() => rej(new Error('Sem resposta do servidor após 20s (timeout). Verifique a ligação ou faça login novamente.')), 20000)),
    ]);
    try {
      if (editingOcorrencia) {
        await withTimeout(OcorrenciaSafety.update(editingOcorrencia.id, data));
      } else {
        await withTimeout(OcorrenciaSafety.create({ ...data, empresa_id: user?.empresa_id }));
      }
      setIsFormOpen(false);
      setEditingOcorrencia(null);
      queryClient.invalidateQueries({ queryKey: ['ocorrencias', empId] });
      setSuccessInfo({ isOpen: true, title: t('safety.ocorrencia_salva'), message: t('safety.ocorrencia_salva_msg') });
    } catch (error) {
      console.error("Erro ao salvar ocorrência:", error);
      // Mostra o ERRO REAL ao utilizador para diagnóstico.
      setAlertInfo({ isOpen: true, type: 'error', title: t('safety.erro_salvar'), message: `${t('safety.erro_salvar_msg')}\n\nDetalhe técnico: ${error?.message || String(error)}` });
    }
  };

  const handleDelete = (ocorrencia) => {
    setAlertInfo({
      isOpen: true,
      type: 'error',
      title: t('safety.excluir_ocorrencia'),
      message: `⚠️ ${t('safety.atencao_irreversivel')}\n\n${t('safety.confirmar_excluir')} ${ocorrencia.tipo_ocorrencia.replace(/_/g, ' ')} ${t('safety.do_dia')} ${new Date(ocorrencia.data_ocorrencia).toLocaleDateString('pt-AO')}?\n\n${t('safety.remover_registro')}`,
      showCancel: true,
      confirmText: t('safety.excluir_permanentemente'),
      onConfirm: async () => {
        setAlertInfo(prev => ({ ...prev, isOpen: false }));
        
        try {
          await OcorrenciaSafety.delete(ocorrencia.id);
          queryClient.invalidateQueries({ queryKey: ['ocorrencias', empId] });
          setSuccessInfo({
            isOpen: true,
            title: t('safety.ocorrencia_excluida'),
            message: t('safety.ocorrencia_excluida_msg')
          });
        } catch (error) {
          console.error('Erro ao excluir ocorrência:', error);
          
          if (error.response?.status === 404) {
            queryClient.invalidateQueries({ queryKey: ['ocorrencias', empId] });
            setAlertInfo({
              isOpen: true,
              type: 'info',
              title: t('safety.ocorrencia_ja_removida'),
              message: t('safety.ocorrencia_ja_removida_msg')
            });
          } else {
            setAlertInfo({
              isOpen: true,
              type: 'error',
              title: t('safety.erro_excluir'),
              message: t('safety.erro_excluir_msg')
            });
          }
        }
      }
    });
  };

  const [isSearching, setIsSearching] = useState(false);

  const handleBuscar = async () => {
    setIsSearching(true);
    try {
      const empId = user?.empresa_id;
      const query = {};
      if (empId) query.empresa_id = empId;
      if (filtros.aeroporto !== 'todos') query.aeroporto = filtros.aeroporto;
      if (filtros.gravidade !== 'todos') query.gravidade = filtros.gravidade;
      if (filtros.status !== 'todos') query.status = filtros.status;
      if (filtros.dataInicio) query.data_ocorrencia = { ...query.data_ocorrencia, $gte: filtros.dataInicio };
      if (filtros.dataFim) query.data_ocorrencia = { ...query.data_ocorrencia, $lte: filtros.dataFim };

      const data = await OcorrenciaSafety.filter(
        Object.keys(query).length > 0 ? query : {},
        '-data_ocorrencia'
      );
      const aeroportosAngola = aeroportos.filter(a => a.pais === 'AO');
      setSearchOverride(filtrarDadosPorAcesso(user, data, 'aeroporto', aeroportosAngola));
    } catch (error) {
      console.error('Erro ao buscar:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // No client-side filtering needed — server-side handles all filters
  const ocorrenciasFiltradas = ocorrencias;

  const handleSelectOcorrencia = useCallback((ocorrenciaId, isSelected) => {
    if (isSelected) {
      setSelectedOcorrencias(prev => [...prev, ocorrenciaId]);
    } else {
      setSelectedOcorrencias(prev => prev.filter(id => id !== ocorrenciaId));
    }
  }, []);

  const handleSelectAll = useCallback((isSelected) => {
    if (isSelected) {
      setSelectedOcorrencias(ocorrenciasFiltradas.map(o => o.id));
    } else {
      setSelectedOcorrencias([]);
    }
  }, [ocorrenciasFiltradas]);
  
  const handleExportExcel = async () => {
    const dataToExport = (selectedOcorrencias.length > 0
      ? ocorrencias.filter(o => selectedOcorrencias.includes(o.id))
      : ocorrenciasFiltradas
    ).map(o => ({
      [t('safety.col_tipo')]: o.tipo_ocorrencia.replace(/_/g, ' '),
      [t('safety.col_aeroporto')]: aeroportos.find(a => a.codigo_icao === o.aeroporto)?.nome || o.aeroporto,
      [t('safety.col_data')]: new Date(o.data_ocorrencia).toLocaleDateString('pt-AO'),
      [t('safety.col_hora')]: o.hora_ocorrencia,
      [t('safety.col_local')]: o.local_especifico,
      [t('safety.col_gravidade')]: o.gravidade,
      [t('safety.col_status')]: o.status.replace(/_/g, ' '),
      [t('safety.col_descricao')]: o.descricao,
      [t('safety.acoes_tomadas')]: o.acoes_tomadas
    }));

    if (dataToExport.length === 0) {
      setAlertInfo({ isOpen: true, type: 'warning', title: t('safety.nenhum_dado'), message: t('safety.nenhum_dado_exportar') });
      return;
    }

    try {
      const XLSX = await import('xlsx');
      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Ocorrências');
      XLSX.writeFile(wb, `ocorrencias_safety_${new Date().toISOString().split('T')[0]}.xlsx`);
      setSuccessInfo({ isOpen: true, title: t('safety.excel_gerado'), message: t('safety.excel_gerado_msg') });
    } catch {
      setAlertInfo({ isOpen: true, type: 'error', title: t('safety.nenhum_dado'), message: t('safety.nenhum_dado_exportar') });
    }
  };

  // Constrói o PDF detalhado do Safety (partilhado pelo botão "PDF" e pelo anexo do email).
  const buildSafetyPdfDoc = async (dataToExport) => {
      const doc = await createPdfDoc();
      const logoBase64 = await loadImageAsBase64('/logo-sga.png').catch(() => null);
      const today = new Date().toLocaleDateString('pt-AO');
      const m = PDF.margin;
      const pageW = doc.internal.pageSize.getWidth();
      const contentW = pageW - m.left - m.right;

      const headerOpts = {
        title: t('safety.relatorio_titulo'),
        logoBase64,
        meta: [`Data de geração: ${today}    |    Total: ${dataToExport.length} ocorrência(s)`],
      };
      let y = addHeader(doc, headerOpts);

      // Bloco de texto rotulado (Descrição / Ações Tomadas) com quebra de página.
      const addBlock = (label, text) => {
        if (!text) return;
        y = checkPageBreak(doc, y, 10, headerOpts);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(PDF.font.small); doc.setTextColor(100, 116, 139);
        doc.text(label + ':', m.left, y); y += 4;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(PDF.font.body); doc.setTextColor(15, 23, 42);
        for (const line of doc.splitTextToSize(String(text), contentW)) {
          y = checkPageBreak(doc, y, 5, headerOpts);
          doc.text(line, m.left, y); y += 4.5;
        }
        y += 2;
      };

      for (let i = 0; i < dataToExport.length; i++) {
        const occ = dataToExport[i];
        y = checkPageBreak(doc, y, 45, headerOpts);

        const tipo = (occ.tipo_ocorrencia || '').replace(/_/g, ' ');
        const dataOcc = occ.data_ocorrencia ? new Date(occ.data_ocorrencia).toLocaleDateString('pt-AO') : '';
        y = addSectionTitle(doc, y, `${i + 1}. ${tipo}${dataOcc ? ' — ' + dataOcc : ''}`);

        const aeroNome = aeroportos.find(a => a.codigo_icao === occ.aeroporto)?.nome || occ.aeroporto || '—';
        y = addKeyValuePairs(doc, y, [
          { label: 'Aeroporto', value: aeroNome },
          { label: 'Hora', value: occ.hora_ocorrencia || '—' },
          { label: 'Local Específico', value: occ.local_especifico || '—' },
          { label: 'Gravidade', value: occ.gravidade || '—' },
          { label: 'Status', value: (occ.status || '').replace(/_/g, ' ') || '—' },
        ]);

        addBlock('Descrição', occ.descricao);
        addBlock('Ações Tomadas', occ.acoes_tomadas);
        y = addKeyValuePairs(doc, y, [{ label: 'Responsável', value: occ.responsavel || '—' }]);

        const fotos = (occ.evidencias_fotograficas || []).filter(Boolean);
        if (fotos.length > 0) {
          y = checkPageBreak(doc, y, 14, headerOpts);
          doc.setFont('helvetica', 'bold'); doc.setFontSize(PDF.font.small); doc.setTextColor(100, 116, 139);
          doc.text('Evidências Fotográficas:', m.left, y); y += 4;

          const gap = 4;
          const imgW = (contentW - gap) / 2;
          const maxImgH = 55;
          let photoNo = 0;
          for (let k = 0; k < fotos.length; k += 2) {
            const pair = fotos.slice(k, k + 2);
            const imgs = [];
            for (const f of pair) {
              try {
                const b64 = await loadImageAsBase64(f);
                const p = doc.getImageProperties(b64);
                let w = imgW, h = imgW * (p.height / p.width);
                if (h > maxImgH) { h = maxImgH; w = h * (p.width / p.height); }
                imgs.push({ b64, w, h });
              } catch { imgs.push(null); }
            }
            const rowH = Math.max(0, ...imgs.map(im => (im ? im.h : 8)));
            y = checkPageBreak(doc, y, rowH + 7, headerOpts);
            for (let j = 0; j < imgs.length; j++) {
              const cellX = m.left + j * (imgW + gap);
              const im = imgs[j];
              photoNo++;
              if (im) {
                try { doc.addImage(im.b64, 'PNG', cellX, y, im.w, im.h); } catch { /* ignore */ }
              } else {
                doc.setFont('helvetica', 'italic'); doc.setFontSize(PDF.font.small); doc.setTextColor(148, 163, 184);
                doc.text('(imagem indisponível)', cellX, y + 5);
              }
              doc.setFont('helvetica', 'normal'); doc.setFontSize(PDF.font.caption); doc.setTextColor(100, 116, 139);
              doc.text(`Foto ${photoNo}`, cellX, y + rowH + 4);
            }
            y += rowH + 7;
          }
        }

        y = checkPageBreak(doc, y, 8, headerOpts);
        doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.2);
        doc.line(m.left, y, pageW - m.right, y);
        y += 6;
      }

      addFooter(doc);
      return doc;
  };

  // Corpo do email — HTML estilizado (cabeçalho SGA + tabela com badges) e menção ao PDF anexo.
  const buildSafetyEmailHtml = (subject, message, data) => {
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    const gravBg = { baixa: '#dcfce7', media: '#fef3c7', alta: '#fee2e2', critica: '#ede9fe' };
    const gravFg = { baixa: '#166534', media: '#92400e', alta: '#991b1b', critica: '#5b21b6' };
    const statBg = { aberta: '#fee2e2', em_investigacao: '#fef3c7', fechada: '#dcfce7' };
    const badge = (txt, bg, fg) => `<span style="display:inline-block;padding:2px 9px;border-radius:10px;background:${bg};color:${fg};font-size:11px;font-weight:600;text-transform:capitalize;">${esc(txt)}</span>`;
    const rows = data.map((occ, i) => {
      const tipo = (occ.tipo_ocorrencia || '').replace(/_/g, ' ');
      const aero = aeroportos.find((a) => a.codigo_icao === occ.aeroporto)?.nome || occ.aeroporto || '—';
      const dataOcc = occ.data_ocorrencia ? new Date(occ.data_ocorrencia).toLocaleDateString('pt-AO') : '—';
      const g = (occ.gravidade || '').toLowerCase();
      const st = (occ.status || '').toLowerCase();
      const td = 'padding:8px 10px;border-bottom:1px solid #eef2f7;font-size:13px;color:#334155;';
      return `<tr style="background:${i % 2 ? '#ffffff' : '#f8fafc'};">
        <td style="${td}color:#0f172a;font-weight:600;text-transform:capitalize;">${esc(tipo)}</td>
        <td style="${td}">${esc(aero)}</td>
        <td style="${td}white-space:nowrap;">${esc(dataOcc)}${occ.hora_ocorrencia ? ' ' + esc(occ.hora_ocorrencia) : ''}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eef2f7;">${badge(g, gravBg[g] || '#f1f5f9', gravFg[g] || '#475569')}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eef2f7;">${badge((occ.status || '').replace(/_/g, ' '), statBg[st] || '#f1f5f9', '#475569')}</td>
      </tr>`;
    }).join('');
    const th = 'padding:9px 10px;color:#cbd5e1;font-size:11px;text-transform:uppercase;letter-spacing:.5px;text-align:left;font-weight:600;';
    return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;background:#eef2f7;font-family:Segoe UI,Arial,sans-serif;">
<div style="max-width:720px;margin:0 auto;padding:20px;">
  <div style="background:#1e3a5f;border-radius:12px 12px 0 0;padding:20px 30px;">
    <div style="color:#cbd5e1;font-size:12px;text-transform:uppercase;letter-spacing:.6px;">SGA · Direção de Operações</div>
    <div style="color:#ffffff;font-size:20px;font-weight:700;margin-top:4px;">Safety &amp; Segurança Operacional</div>
  </div>
  <div style="background:#ffffff;padding:26px 30px 32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
    <h1 style="font-size:17px;color:#1e3a5f;margin:0 0 6px;">${esc(subject)}</h1>
    ${message ? `<p style="color:#334155;font-size:14px;margin:0 0 14px;">${esc(message)}</p>` : ''}
    <p style="color:#64748b;font-size:13px;margin:0 0 16px;">Segue o resumo de <strong>${data.length}</strong> ocorrência(s) de safety. O relatório detalhado (descrições, ações tomadas e evidências fotográficas) segue em <strong>PDF anexo</strong>.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      <tr style="background:#1e3a5f;"><th style="${th}">Tipo</th><th style="${th}">Aeroporto</th><th style="${th}">Data</th><th style="${th}">Gravidade</th><th style="${th}">Status</th></tr>
      ${rows}
    </table>
  </div>
  <div style="text-align:center;padding:14px;color:#94a3b8;font-size:11px;">Gerado automaticamente pelo Sistema DIROPS · SGA</div>
</div></body></html>`;
  };

  const handleExportPDF = async () => {
    const dataToExport = selectedOcorrencias.length > 0
      ? ocorrencias.filter(o => selectedOcorrencias.includes(o.id))
      : ocorrenciasFiltradas;
    if (dataToExport.length === 0) {
      setAlertInfo({ isOpen: true, type: 'warning', title: t('safety.nenhum_dado'), message: t('safety.nenhum_dado_exportar') });
      return;
    }
    try {
      const doc = await buildSafetyPdfDoc(dataToExport);
      doc.save(`relatorio_safety_${new Date().toISOString().split('T')[0]}.pdf`);
      setSuccessInfo({ isOpen: true, title: t('safety.pdf_gerado'), message: t('safety.pdf_gerado_msg') });
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      setAlertInfo({ isOpen: true, title: t('safety.erro_pdf'), message: t('safety.erro_pdf_msg') });
    }
  };
  
  const handleSendEmail = async ({ to, subject, message }) => {
    const recipient = to;
    const dataToSend = selectedOcorrencias.length > 0
      ? ocorrencias.filter(o => selectedOcorrencias.includes(o.id))
      : ocorrenciasFiltradas;

    if (dataToSend.length === 0) {
      setAlertInfo({ isOpen: true, type: 'warning', title: t('safety.nenhum_dado'), message: t('safety.selecione_ocorrencias') });
      return false;
    }

    const body = buildSafetyEmailHtml(subject, message, dataToSend);

    // Anexa o PDF detalhado (o mesmo do botão "PDF"): descrições, ações e fotos.
    let attachments;
    try {
      const doc = await buildSafetyPdfDoc(dataToSend);
      const b64 = doc.output('datauristring').split(',')[1];
      if (b64) attachments = [{ filename: `relatorio_safety_${new Date().toISOString().split('T')[0]}.pdf`, content: b64, encoding: 'base64', contentType: 'application/pdf' }];
    } catch (e) { console.warn('Anexo PDF do Safety falhou:', e); }

    try {
      await sendEmailDirect({ to: recipient, subject, body, attachments });
      setSuccessInfo({ isOpen: true, title: t('safety.email_enviado'), message: `${t('safety.email_enviado_msg')} ${recipient}.` });
      return true;
    } catch (error) {
      console.error("Erro ao enviar email:", error);
      setAlertInfo({ isOpen: true, title: t('safety.erro_email'), message: t('safety.erro_email_msg') });
      return false;
    }
  };

  // Calcular KPIs avançados
  const totalOcorrencias = ocorrenciasFiltradas.length;
  const ocorrenciasAbertas = ocorrenciasFiltradas.filter(o => o.status === 'aberta').length;
  const ocorrenciasCriticas = ocorrenciasFiltradas.filter(o => o.gravidade === 'critica').length;
  const ocorrenciasEsteMes = ocorrenciasFiltradas.filter(o => {
    const dataOcorrencia = new Date(o.data_ocorrencia);
    const agora = new Date();
    return dataOcorrencia.getMonth() === agora.getMonth() && dataOcorrencia.getFullYear() === agora.getFullYear();
  }).length;

  const ocorrenciasFechadas = ocorrenciasFiltradas.filter(o => o.status === 'fechada').length;
  const taxaResolucao = totalOcorrencias > 0 ? ((ocorrenciasFechadas / totalOcorrencias) * 100).toFixed(1) : 0;

  const aeroportoOptions = useMemo(() => {
    const permitidos = getAeroportosPermitidos(user, aeroportos, user?.empresa_id);
    return [
      { value: 'todos', label: t('safety.todos_aeroportos') },
      ...permitidos.map(a => ({ value: a.codigo_icao, label: a.nome }))
    ];
  }, [aeroportos, user, t]);

  const gravidadeOptions = [
    { value: 'todos', label: t('safety.todas_gravidades') },
    { value: 'critica', label: t('safety.critica') },
    { value: 'alta', label: t('safety.alta') },
    { value: 'media', label: t('safety.media') },
    { value: 'baixa', label: t('safety.baixa') }
  ];

  const statusOptions = [
    { value: 'todos', label: t('safety.todos_status') },
    { value: 'aberta', label: t('safety.aberta') },
    { value: 'em_investigacao', label: t('safety.em_investigacao') },
    { value: 'fechada', label: t('safety.fechada') }
  ];

  return (
    <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-950 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-3">
              {t('page.safety.title')}
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">{t('page.safety.subtitle')}</p>
          </div>
          {activeTab === 'ocorrencias' && (
          <div className="flex flex-wrap gap-2 w-full lg:w-auto">
            <Button variant="outline" onClick={loadData} className="border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
              <RefreshCw className="w-4 h-4 mr-2" />
              {t('btn.refresh')}
            </Button>
            <Button variant="outline" onClick={handleExportExcel} className="border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
              <FileDown className="w-4 h-4 mr-2" />
              Excel
            </Button>
            <Button variant="outline" onClick={handleExportPDF} className="border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
              <FileText className="w-4 h-4 mr-2" />
              PDF
            </Button>
            {selectedOcorrencias.length > 0 && (
              <Button variant="outline" onClick={() => setIsEmailModalOpen(true)} className="border-blue-300 dark:border-blue-600 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950">
                <Mail className="w-4 h-4 mr-2" />
                Email ({selectedOcorrencias.length})
              </Button>
            )}
            <Button onClick={() => { setEditingOcorrencia(null); setIsFormOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="w-4 h-4 mr-2" />
              {t('safety.nova_ocorrencia')}
            </Button>
          </div>
          )}
        </div>

        {/* Tabs (sub-páginas de Safety) */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('ocorrencias')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium border transition-colors ${activeTab === 'ocorrencias' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            <Shield className="w-4 h-4" />
            Ocorrências de Safety
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('treinamentos')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium border transition-colors ${activeTab === 'treinamentos' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            <GraduationCap className="w-4 h-4" />
            Treinamentos & Licenças
          </button>
        </div>

        {activeTab === 'ocorrencias' && (
        <>
        {/* KPIs de Safety */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6">
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">{t('safety.total_ocorrencias')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{totalOcorrencias}</div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('safety.ocorrencias_filtradas')}</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">{t('safety.ocorrencias_abertas')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{ocorrenciasAbertas}</div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('safety.requerem_atencao')}</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">{t('safety.criticas')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{ocorrenciasCriticas}</div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('safety.nivel_critico')}</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">{t('safety.este_mes')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{ocorrenciasEsteMes}</div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('safety.novas_ocorrencias')}</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">{t('safety.taxa_resolucao')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{taxaResolucao}%</div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('safety.ocorrencias_resolvidas')}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-slate-500 dark:text-slate-400" />
              {t('safety.filtros_pesquisa')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label htmlFor="aeroporto" className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('safety.aeroporto')}</Label>
                <Select
                  id="aeroporto"
                  options={aeroportoOptions}
                  value={filtros.aeroporto}
                  onValueChange={(v) => setFiltros({...filtros, aeroporto: v})}
                  placeholder={t('safety.todos_aeroportos')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gravidade" className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('safety.gravidade')}</Label>
                <Select
                  id="gravidade"
                  options={gravidadeOptions}
                  value={filtros.gravidade}
                  onValueChange={(v) => setFiltros({...filtros, gravidade: v})}
                  placeholder={t('safety.todas_gravidades')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status" className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('label.status')}</Label>
                <Select
                  id="status"
                  options={statusOptions}
                  value={filtros.status}
                  onValueChange={(v) => setFiltros({...filtros, status: v})}
                  placeholder={t('safety.todos_status')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="data-inicio" className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('safety.data_inicio')}</Label>
                <Input
                  id="data-inicio"
                  type="date"
                  value={filtros.dataInicio}
                  onChange={(e) => setFiltros({...filtros, dataInicio: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="data-fim" className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('safety.data_fim')}</Label>
                <Input
                  id="data-fim"
                  type="date"
                  value={filtros.dataFim}
                  onChange={(e) => setFiltros({...filtros, dataFim: e.target.value})}
                />
              </div>
              <div className="flex items-end gap-2 mt-2">
                <Button onClick={handleBuscar} disabled={isSearching} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  {isSearching ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Buscando...</> : <><Search className="w-4 h-4 mr-2" /> Buscar</>}
                </Button>
                <Button variant="outline" onClick={() => { setFiltros({ aeroporto: 'todos', gravidade: 'todos', status: 'todos', dataInicio: '', dataFim: '' }); setSearchOverride(null); }}>
                  <X className="w-4 h-4 mr-2" /> Limpar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <SafetyOccurrencesList
          ocorrencias={ocorrenciasFiltradas}
          aeroportos={aeroportos}
          isLoading={isLoading}
          onReload={loadData}
          onEdit={handleEdit}
          onDelete={handleDelete}
          selectedOcorrencias={selectedOcorrencias}
          onSelectOcorrencia={handleSelectOcorrencia}
          onSelectAll={handleSelectAll}
        />
        </>
        )}

        {activeTab === 'treinamentos' && (
          <TreinamentosLicencasTab aeroportos={aeroportos} user={user} />
        )}
      </div>

      {isFormOpen && (
        <FormSafetyOccurrence
          isOpen={isFormOpen}
          onClose={() => { setIsFormOpen(false); setEditingOcorrencia(null); }}
          onSubmit={handleFormSubmit}
          aeroportos={aeroportos}
          occurrenceInitial={editingOcorrencia}
        />
      )}

      <SendEmailModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        onSend={handleSendEmail}
        defaultSubject={`${t('safety.relatorio_default_subject')} - ${new Date().toLocaleDateString('pt-AO')}`}
        title={t('safety.enviar_relatorio')}
      />

      <AlertModal
        isOpen={alertInfo.isOpen}
        onClose={() => setAlertInfo({ ...alertInfo, isOpen: false })}
        title={alertInfo.title}
        message={alertInfo.message}
        type={alertInfo.type}
        showCancel={alertInfo.showCancel}
        confirmText={alertInfo.confirmText}
        onConfirm={alertInfo.onConfirm}
      />
      
      <SuccessModal
        isOpen={successInfo.isOpen}
        onClose={() => setSuccessInfo({ ...successInfo, isOpen: false })}
        title={successInfo.title}
        message={successInfo.message}
      />

    </div>
  );
}
