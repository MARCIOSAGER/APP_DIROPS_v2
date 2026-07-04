import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import Select from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { GraduationCap, RefreshCw, Upload, FileDown, FileText, Mail, Plus, Search, Edit, Trash2, Loader2, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';

import { LicencaConducao } from '@/entities/LicencaConducao';
import FormLicencaConducao from './FormLicencaConducao';
import SendEmailModal from '@/components/shared/SendEmailModal';
import AlertModal from '@/components/shared/AlertModal';
import SuccessModal from '@/components/shared/SuccessModal';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { createPdfDoc, addHeader, addFooter, addTable } from '@/lib/pdfTemplate';
import { sendEmailDirect } from '@/functions/sendEmailDirect';

const hojeISO = () => new Date().toISOString().split('T')[0];
const em30diasISO = () => {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split('T')[0];
};
const fmtData = (iso) => (iso ? new Date(iso + 'T00:00:00').toLocaleDateString('pt-AO') : '—');

export default function TreinamentosLicencasTab({ aeroportos = [], user }) {
  const [licencas, setLicencas] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [numeroSugerido, setNumeroSugerido] = useState('');
  const [busca, setBusca] = useState('');
  const [fCategoria, setFCategoria] = useState('todas');
  const [fStatus, setFStatus] = useState('todos');
  const [fAeroporto, setFAeroporto] = useState('todos');
  const [isEmailOpen, setIsEmailOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [alertInfo, setAlertInfo] = useState({ isOpen: false, type: 'error', title: '', message: '' });
  const [successInfo, setSuccessInfo] = useState({ isOpen: false, title: '', message: '' });
  const [confirmInfo, setConfirmInfo] = useState({ isOpen: false, id: null });
  const fileInputRef = React.useRef(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await LicencaConducao.list('-created_date');
      setLicencas(data || []);
    } catch (e) {
      console.error('Erro ao carregar licenças:', e);
      setAlertInfo({ isOpen: true, type: 'error', title: 'Erro', message: 'Não foi possível carregar os registos.' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // === KPIs ===
  const hoje = hojeISO();
  const limite30 = em30diasISO();
  const totalRegistos = licencas.length;
  const expiradas = licencas.filter(l => l.data_validade && l.data_validade < hoje).length;
  const aExpirar = licencas.filter(l => l.data_validade && l.data_validade >= hoje && l.data_validade <= limite30).length;
  const ativas = licencas.filter(l => l.data_validade && l.data_validade >= hoje).length;

  // === Filtros (client-side) ===
  const categoriaOptions = useMemo(() => {
    const cats = [...new Set(licencas.map(l => l.categoria).filter(Boolean))];
    return [{ value: 'todas', label: 'Todas as Categorias' }, ...cats.map(c => ({ value: c, label: c }))];
  }, [licencas]);

  const statusOptions = [
    { value: 'todos', label: 'Todos os Status' },
    { value: 'Pendente', label: 'Pendente' },
    { value: 'Ativa', label: 'Ativa' },
    { value: 'Suspensa', label: 'Suspensa' },
    { value: 'Cancelada', label: 'Cancelada' },
  ];

  const aeroportoOptions = useMemo(() => ([
    { value: 'todos', label: 'Todos os Aeroportos' },
    ...aeroportos.map(a => ({ value: a.codigo_icao, label: a.nome })),
  ]), [aeroportos]);

  const licencasFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return licencas.filter(l => {
      if (q && !((l.nome_condutor || '').toLowerCase().includes(q) || (l.entidade || '').toLowerCase().includes(q) || (l.numero_licenca || '').toLowerCase().includes(q))) return false;
      if (fCategoria !== 'todas' && l.categoria !== fCategoria) return false;
      if (fStatus !== 'todos' && l.status !== fStatus) return false;
      if (fAeroporto !== 'todos' && l.aeroporto !== fAeroporto) return false;
      return true;
    });
  }, [licencas, busca, fCategoria, fStatus, fAeroporto]);

  const nomeAeroporto = (icao) => aeroportos.find(a => a.codigo_icao === icao)?.nome || icao || '—';

  // === Ações ===
  const abrirNovo = () => {
    const yy = String(new Date().getFullYear()).slice(-2);
    setNumeroSugerido(`${String(licencas.length + 1).padStart(4, '0')}/${yy}`);
    setEditing(null);
    setIsFormOpen(true);
  };

  const abrirEdicao = (lic) => { setEditing(lic); setIsFormOpen(true); };

  const handleSubmit = async (form) => {
    try {
      if (editing) {
        await LicencaConducao.update(editing.id, form);
      } else {
        await LicencaConducao.create({ ...form, empresa_id: user?.empresa_id || null });
      }
      setIsFormOpen(false);
      setEditing(null);
      await loadData();
      setSuccessInfo({ isOpen: true, title: 'Registo salvo', message: 'O registo de treinamento/licença foi salvo com sucesso.' });
    } catch (e) {
      console.error('Erro ao salvar licença:', e);
      setAlertInfo({ isOpen: true, type: 'error', title: 'Erro ao salvar', message: e.message || 'Tente novamente.' });
    }
  };

  const confirmarDelete = async () => {
    const id = confirmInfo.id;
    setConfirmInfo({ isOpen: false, id: null });
    try {
      await LicencaConducao.delete(id);
      await loadData();
      setSuccessInfo({ isOpen: true, title: 'Registo eliminado', message: 'O registo foi removido.' });
    } catch (e) {
      console.error('Erro ao eliminar:', e);
      setAlertInfo({ isOpen: true, type: 'error', title: 'Erro ao eliminar', message: e.message || 'Tente novamente.' });
    }
  };

  // === Import XLSX ===
  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      if (rows.length === 0) {
        setAlertInfo({ isOpen: true, type: 'warning', title: 'Ficheiro vazio', message: 'Nenhuma linha encontrada na planilha.' });
        return;
      }
      let ok = 0;
      for (const r of rows) {
        const nome = r.nome_condutor || r['Nome do Condutor'] || r.Colaborador || r.colaborador;
        if (!nome) continue;
        await LicencaConducao.create({
          numero_licenca: String(r.numero_licenca || r['Nº Licença'] || ''),
          numero_passe: String(r.numero_passe || r['Nº Passe'] || ''),
          nome_condutor: String(nome),
          entidade: String(r.entidade || r.Empresa || r.empresa || ''),
          data_emissao: r.data_emissao || r['Data Emissão'] || null,
          data_validade: r.data_validade || r.Validade || null,
          aeroporto: String(r.aeroporto || r.Aeroporto || ''),
          categoria: String(r.categoria || r.Categoria || 'Condução Airside'),
          data_treinamento: r.data_treinamento || r.Treinamento || null,
          instrutor: String(r.instrutor || r.Instrutor || ''),
          resultado: String(r.resultado || r.Resultado || 'Em Andamento'),
          status: String(r.status || r.Status || 'Pendente'),
          observacoes: String(r.observacoes || r['Observações'] || ''),
          empresa_id: user?.empresa_id || null,
        });
        ok++;
      }
      await loadData();
      setSuccessInfo({ isOpen: true, title: 'Importação concluída', message: `${ok} registo(s) importado(s) com sucesso.` });
    } catch (e) {
      console.error('Erro ao importar:', e);
      setAlertInfo({ isOpen: true, type: 'error', title: 'Erro na importação', message: e.message || 'Verifique o ficheiro e tente novamente.' });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const linhasExport = () => licencasFiltradas.map(l => ({
    'Colaborador': l.nome_condutor || '',
    'Empresa': l.entidade || '',
    'Aeroporto': nomeAeroporto(l.aeroporto),
    'Categoria': l.categoria || '',
    'Nº Licença': l.numero_licenca || '',
    'Nº Passe': l.numero_passe || '',
    'Treinamento': fmtData(l.data_treinamento),
    'Validade': fmtData(l.data_validade),
    'Resultado': l.resultado || '',
    'Status': l.status || '',
  }));

  const handleExportExcel = async () => {
    const dados = linhasExport();
    if (dados.length === 0) { setAlertInfo({ isOpen: true, type: 'warning', title: 'Sem dados', message: 'Nenhum registo para exportar.' }); return; }
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Licenças');
    XLSX.writeFile(wb, `treinamentos_licencas_${hoje}.xlsx`);
  };

  const handleExportPDF = async () => {
    const dados = licencasFiltradas;
    if (dados.length === 0) { setAlertInfo({ isOpen: true, type: 'warning', title: 'Sem dados', message: 'Nenhum registo para exportar.' }); return; }
    try {
      const doc = await createPdfDoc();
      let y = addHeader(doc, { title: 'Treinamentos & Licenças de Condução', subtitle: `Total: ${dados.length}`, date: new Date().toLocaleDateString('pt-AO') });
      const columns = [
        { label: '#', width: 8, align: 'center' },
        { label: 'Colaborador', width: 40 },
        { label: 'Empresa', width: 28 },
        { label: 'Aeroporto', width: 32 },
        { label: 'Nº Licença', width: 20 },
        { label: 'Validade', width: 22, align: 'center' },
        { label: 'Status', width: 25 },
      ];
      const rows = dados.map((l, i) => [
        String(i + 1), l.nome_condutor || '', l.entidade || '', nomeAeroporto(l.aeroporto), l.numero_licenca || '', fmtData(l.data_validade), l.status || '',
      ]);
      addTable(doc, y, { columns, rows });
      addFooter(doc);
      doc.save(`treinamentos_licencas_${hoje}.pdf`);
    } catch (e) {
      console.error('Erro PDF:', e);
      setAlertInfo({ isOpen: true, type: 'error', title: 'Erro ao gerar PDF', message: e.message || 'Tente novamente.' });
    }
  };

  const handleSendEmail = async (recipient, subject) => {
    const dados = licencasFiltradas;
    if (dados.length === 0) { setAlertInfo({ isOpen: true, type: 'warning', title: 'Sem dados', message: 'Nenhum registo para enviar.' }); return false; }
    let body = `<h1>${subject}</h1><p>Resumo de ${dados.length} registo(s) de treinamento/licença:</p>`;
    body += `<table border="1" cellpadding="5" cellspacing="0" style="border-collapse:collapse;width:100%"><thead><tr><th>Colaborador</th><th>Empresa</th><th>Aeroporto</th><th>Nº Licença</th><th>Validade</th><th>Status</th></tr></thead><tbody>`;
    dados.forEach(l => {
      body += `<tr><td>${l.nome_condutor || ''}</td><td>${l.entidade || ''}</td><td>${nomeAeroporto(l.aeroporto)}</td><td>${l.numero_licenca || ''}</td><td>${fmtData(l.data_validade)}</td><td>${l.status || ''}</td></tr>`;
    });
    body += '</tbody></table>';
    try {
      await sendEmailDirect({ to: recipient, subject, body });
      setSuccessInfo({ isOpen: true, title: 'Email enviado', message: `Relatório enviado para ${recipient}.` });
      return true;
    } catch (e) {
      console.error('Erro email:', e);
      setAlertInfo({ isOpen: true, type: 'error', title: 'Erro ao enviar', message: e.message || 'Tente novamente.' });
      return false;
    }
  };

  const validadeBadge = (l) => {
    if (!l.data_validade) return <span className="text-slate-400">—</span>;
    const expirada = l.data_validade < hoje;
    const aexp = !expirada && l.data_validade <= limite30;
    return (
      <span className={`font-medium ${expirada ? 'text-red-600' : aexp ? 'text-amber-600' : 'text-slate-700 dark:text-slate-300'}`}>
        {fmtData(l.data_validade)} {(expirada || aexp) && <AlertTriangle className="w-3.5 h-3.5 inline ml-1" />}
      </span>
    );
  };

  const statusBadge = (status) => {
    const map = {
      'Ativa': 'bg-green-100 text-green-800 border-green-200',
      'Pendente': 'bg-amber-100 text-amber-800 border-amber-200',
      'Suspensa': 'bg-orange-100 text-orange-800 border-orange-200',
      'Cancelada': 'bg-red-100 text-red-800 border-red-200',
    };
    return <Badge variant="outline" className={map[status] || 'bg-slate-100 text-slate-700'}>{status || '—'}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header + toolbar */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-blue-600" />
            Treinamentos & Licenças de Condução
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Registo e gestão de licenças e treinamentos de condutores airside</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={loadData}><RefreshCw className="w-4 h-4 mr-2" />Atualizar</Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
            {isImporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}Import XLSX
          </Button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" />
          <Button variant="outline" onClick={handleExportExcel}><FileDown className="w-4 h-4 mr-2" />Excel</Button>
          <Button variant="outline" onClick={handleExportPDF}><FileText className="w-4 h-4 mr-2" />PDF</Button>
          <Button variant="outline" onClick={() => setIsEmailOpen(true)} className="border-blue-300 text-blue-600 hover:bg-blue-50"><Mail className="w-4 h-4 mr-2" />Email</Button>
          <Button onClick={abrirNovo} className="bg-blue-600 hover:bg-blue-700 text-white"><Plus className="w-4 h-4 mr-2" />Novo Registo</Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm"><CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center"><GraduationCap className="w-5 h-5 text-blue-600" /></div>
          <div><div className="text-2xl font-bold">{totalRegistos}</div><p className="text-xs text-slate-500">Total de Registos</p></div>
        </CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center"><CheckCircle2 className="w-5 h-5 text-green-600" /></div>
          <div><div className="text-2xl font-bold text-green-600">{ativas}</div><p className="text-xs text-slate-500">Licenças Ativas</p></div>
        </CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-red-600" /></div>
          <div><div className="text-2xl font-bold text-red-600">{expiradas}</div><p className="text-xs text-slate-500">Expiradas</p></div>
        </CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center"><Clock className="w-5 h-5 text-amber-600" /></div>
          <div><div className="text-2xl font-bold text-amber-600">{aExpirar}</div><p className="text-xs text-slate-500">A Expirar (30 dias)</p></div>
        </CardContent></Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar nome, empresa, licença..." className="pl-9" />
        </div>
        <div className="w-48"><Select options={categoriaOptions} value={fCategoria} onValueChange={setFCategoria} placeholder="Todas as Categorias" /></div>
        <div className="w-44"><Select options={statusOptions} value={fStatus} onValueChange={setFStatus} placeholder="Todos os Status" /></div>
        <div className="w-52"><Select options={aeroportoOptions} value={fAeroporto} onValueChange={setFAeroporto} placeholder="Todos os Aeroportos" /></div>
      </div>

      {/* Tabela */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Aeroporto</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Nº Licença</TableHead>
                  <TableHead>Nº Passe</TableHead>
                  <TableHead>Treinamento</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Resultado</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {licencasFiltradas.map(l => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.nome_condutor}</TableCell>
                    <TableCell>{l.entidade}</TableCell>
                    <TableCell className="max-w-[180px] truncate">{nomeAeroporto(l.aeroporto)}</TableCell>
                    <TableCell>{l.categoria}</TableCell>
                    <TableCell>{l.numero_licenca}</TableCell>
                    <TableCell>{l.numero_passe}</TableCell>
                    <TableCell>{fmtData(l.data_treinamento)}</TableCell>
                    <TableCell>{validadeBadge(l)}</TableCell>
                    <TableCell><Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{l.resultado || '—'}</Badge></TableCell>
                    <TableCell>{statusBadge(l.status)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="icon" onClick={() => abrirEdicao(l)}><Edit className="w-4 h-4 text-blue-600" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setConfirmInfo({ isOpen: true, id: l.id })}><Trash2 className="w-4 h-4 text-red-600" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {!isLoading && licencasFiltradas.length === 0 && (
            <div className="text-center py-12 text-slate-500">Nenhum registo de treinamento/licença encontrado.</div>
          )}
        </CardContent>
      </Card>

      {isFormOpen && (
        <FormLicencaConducao
          isOpen={isFormOpen}
          onClose={() => { setIsFormOpen(false); setEditing(null); }}
          onSubmit={handleSubmit}
          aeroportos={aeroportos}
          licencaInicial={editing}
          numeroSugerido={numeroSugerido}
        />
      )}

      <SendEmailModal
        isOpen={isEmailOpen}
        onClose={() => setIsEmailOpen(false)}
        onSend={handleSendEmail}
        defaultSubject={`Treinamentos & Licenças - ${new Date().toLocaleDateString('pt-AO')}`}
        title="Enviar Relatório de Licenças"
      />

      <ConfirmModal
        isOpen={confirmInfo.isOpen}
        onClose={() => setConfirmInfo({ isOpen: false, id: null })}
        onConfirm={confirmarDelete}
        title="Eliminar Registo"
        message="Tem a certeza que deseja eliminar este registo de treinamento/licença? Esta ação é irreversível."
      />

      <AlertModal isOpen={alertInfo.isOpen} onClose={() => setAlertInfo({ ...alertInfo, isOpen: false })} title={alertInfo.title} message={alertInfo.message} type={alertInfo.type} />
      <SuccessModal isOpen={successInfo.isOpen} onClose={() => setSuccessInfo({ ...successInfo, isOpen: false })} title={successInfo.title} message={successInfo.message} />
    </div>
  );
}
