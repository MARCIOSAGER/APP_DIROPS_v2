import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Send, CheckCircle, Ticket, Inbox, RefreshCw, Loader2, Search, Forward, Trash2, Paperclip, X, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import Select from "@/components/ui/select";
import { enviarTicketSuporte } from "@/functions/enviarTicketSuporte";
import { encaminharTicket } from "@/functions/encaminharTicket";
import { TicketSuporte } from "@/entities/TicketSuporte";
import { UploadFile } from "@/integrations/Core";
import { User as UserEntity } from "@/entities/User";
import { isAdminProfile } from "@/components/lib/userUtils";
import useSubmitGuard from "@/hooks/useSubmitGuard";
import { useI18n } from '@/components/lib/i18n';

const categorias = [
  { value: "", label: "Selecione (opcional)" },
  { value: "bug", label: "Bug / Erro no sistema" },
  { value: "duvida", label: "Dúvida sobre funcionalidade" },
  { value: "sugestao", label: "Sugestão de melhoria" },
  { value: "acesso", label: "Problema de acesso" },
  { value: "outro", label: "Outro" },
];

const CAT_LABEL = Object.fromEntries(categorias.map(c => [c.value, c.label]));

const STATUS_META = {
  aberta:       { label: "Aberta",       className: "bg-blue-100 text-blue-800 border-blue-200" },
  em_andamento: { label: "Em Andamento", className: "bg-amber-100 text-amber-800 border-amber-200" },
  resolvida:    { label: "Resolvida",    className: "bg-green-100 text-green-800 border-green-200" },
};
const statusOptions = [
  { value: "aberta", label: "Aberta" },
  { value: "em_andamento", label: "Em Andamento" },
  { value: "resolvida", label: "Resolvida" },
];
const filtroStatusOptions = [{ value: "todos", label: "Todos os Status" }, ...statusOptions];

const fmt = (iso) => (iso ? new Date(iso).toLocaleString('pt-AO') : '—');

export default function Suporte() {
  const { t } = useI18n();
  const [assunto, setAssunto] = useState("");
  const [categoria, setCategoria] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [anexos, setAnexos] = useState([]);
  const [uploadingAnexo, setUploadingAnexo] = useState(false);
  const [uploadErro, setUploadErro] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState(null);
  const [erro, setErro] = useState(null);
  const { guardedSubmit } = useSubmitGuard();

  // Admin management
  const [currentUser, setCurrentUser] = useState(null);
  const [aba, setAba] = useState("novo"); // novo | gerir
  const [tickets, setTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [busca, setBusca] = useState("");
  const [fStatus, setFStatus] = useState("todos");
  const [savingId, setSavingId] = useState(null);
  const [forwardTk, setForwardTk] = useState(null);
  const [forwardEmail, setForwardEmail] = useState("");
  const [forwardNota, setForwardNota] = useState("");
  const [forwarding, setForwarding] = useState(false);
  const [forwardErro, setForwardErro] = useState(null);
  const [deleteTk, setDeleteTk] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteErro, setDeleteErro] = useState(null);

  useEffect(() => { UserEntity.me().then(setCurrentUser).catch(() => {}); }, []);
  const isAdmin = currentUser && isAdminProfile(currentUser);

  const loadTickets = useCallback(async () => {
    setLoadingTickets(true);
    try { setTickets(await TicketSuporte.list('-created_date')); }
    catch (e) { console.error('Erro ao carregar tickets:', e); }
    finally { setLoadingTickets(false); }
  }, []);

  useEffect(() => { if (isAdmin && aba === 'gerir') loadTickets(); }, [isAdmin, aba, loadTickets]);

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = ''; // permite re-selecionar o mesmo ficheiro
    if (files.length === 0) return;
    setUploadingAnexo(true); setUploadErro(null);
    try {
      for (const file of files) {
        const r = await UploadFile({ file });
        setAnexos(prev => [...prev, { url: r.file_url, nome: file.name, tipo: file.type }]);
      }
    } catch (err) {
      setUploadErro(err?.message || 'Não foi possível carregar o ficheiro.');
    } finally {
      setUploadingAnexo(false);
    }
  };
  const removeAnexo = (i) => setAnexos(prev => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (assunto.length < 5 || mensagem.length < 10) return;
    guardedSubmit(async () => {
      setEnviando(true);
      setErro(null);
      try {
        const res = await enviarTicketSuporte({ assunto, categoria, mensagem, anexos });
        setSucesso(res.numero_ticket);
      } catch (err) {
        setErro("Erro ao enviar o ticket. Tente novamente.");
      } finally {
        setEnviando(false);
      }
    });
  };

  const handleNovo = () => {
    setSucesso(null); setAssunto(""); setCategoria(""); setMensagem(""); setAnexos([]); setUploadErro(null);
  };

  const handleStatusChange = async (ticket, novoStatus) => {
    if (novoStatus === ticket.status) return;
    setSavingId(ticket.id);
    try {
      await TicketSuporte.update(ticket.id, {
        status: novoStatus,
        respondido_por: currentUser?.full_name || currentUser?.email || null,
        respondido_em: new Date().toISOString(),
      });
      setTickets(prev => prev.map(x => x.id === ticket.id ? { ...x, status: novoStatus } : x));
    } catch (e) {
      console.error('Erro ao atualizar status:', e);
    } finally {
      setSavingId(null);
    }
  };

  const isSgaEmail = (e) => /@sga\.co\.ao$/i.test((e || '').trim());
  const abrirEncaminhar = (tk) => { setForwardTk(tk); setForwardEmail(''); setForwardNota(''); setForwardErro(null); };
  const handleEncaminhar = async () => {
    const dest = forwardEmail.trim();
    if (!isSgaEmail(dest)) { setForwardErro('Informe um email @sga.co.ao (o relay só entrega internamente).'); return; }
    setForwarding(true); setForwardErro(null);
    try {
      await encaminharTicket({
        ticket: forwardTk,
        destinatario: dest,
        nota: forwardNota.trim(),
        encaminhadoPor: currentUser?.full_name || currentUser?.email,
      });
      setTickets(prev => prev.map(x => x.id === forwardTk.id ? { ...x, encaminhado_para: dest, encaminhado_em: new Date().toISOString() } : x));
      setForwardTk(null);
    } catch (e) {
      console.error('Erro ao encaminhar:', e);
      setForwardErro('Não foi possível encaminhar. Tente novamente.');
    } finally {
      setForwarding(false);
    }
  };

  const abrirApagar = (tk) => { setDeleteErro(null); setDeleteTk(tk); };
  const handleApagar = async () => {
    if (!deleteTk) return;
    setDeleting(true); setDeleteErro(null);
    try {
      await TicketSuporte.delete(deleteTk.id);
      setTickets(prev => prev.filter(x => x.id !== deleteTk.id));
      setDeleteTk(null);
    } catch (e) {
      console.error('Erro ao apagar ticket:', e);
      setDeleteErro('Não foi possível apagar o ticket. Tente novamente.');
    } finally {
      setDeleting(false);
    }
  };

  const ticketsFiltrados = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return tickets.filter(tk => {
      if (fStatus !== 'todos' && tk.status !== fStatus) return false;
      if (!b) return true;
      return [tk.numero_ticket, tk.assunto, tk.mensagem, tk.solicitante_nome, tk.solicitante_email]
        .some(v => (v || '').toLowerCase().includes(b));
    });
  }, [tickets, busca, fStatus]);

  const abertosCount = useMemo(() => tickets.filter(t => t.status !== 'resolvida').length, [tickets]);
  const stats = useMemo(() => ({
    total: tickets.length,
    aberta: tickets.filter(t => t.status === 'aberta').length,
    em_andamento: tickets.filter(t => t.status === 'em_andamento').length,
    resolvida: tickets.filter(t => t.status === 'resolvida').length,
  }), [tickets]);

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            {t('page.suporte.title')}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{t('page.suporte.subtitle')}</p>
        </div>
      </div>

      {/* Abas (gestão só para admin) */}
      {isAdmin && (
        <div className="flex gap-2 mb-6">
          <Button variant={aba === 'novo' ? 'default' : 'outline'} onClick={() => setAba('novo')} className={aba === 'novo' ? 'bg-blue-600 text-white' : ''}>
            <Send className="w-4 h-4 mr-2" /> Abrir Ticket
          </Button>
          <Button variant={aba === 'gerir' ? 'default' : 'outline'} onClick={() => setAba('gerir')} className={aba === 'gerir' ? 'bg-blue-600 text-white' : ''}>
            <Inbox className="w-4 h-4 mr-2" /> Gerir Tickets{abertosCount > 0 ? ` (${abertosCount})` : ''}
          </Button>
        </div>
      )}

      {/* ---- Aba: Gerir Tickets (admin) ---- */}
      {isAdmin && aba === 'gerir' ? (
        <div className="space-y-4">
          {/* Painel de controlo — cartões clicáveis que filtram por estado */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { key: 'todos', label: 'Total', value: stats.total, cls: 'text-slate-700 dark:text-slate-200', ring: 'border-slate-200 dark:border-slate-700' },
              { key: 'aberta', label: 'Abertas', value: stats.aberta, cls: 'text-blue-700 dark:text-blue-400', ring: 'border-blue-200 dark:border-blue-900' },
              { key: 'em_andamento', label: 'Em Andamento', value: stats.em_andamento, cls: 'text-amber-700 dark:text-amber-400', ring: 'border-amber-200 dark:border-amber-900' },
              { key: 'resolvida', label: 'Resolvidas', value: stats.resolvida, cls: 'text-green-700 dark:text-green-400', ring: 'border-green-200 dark:border-green-900' },
            ].map(s => (
              <button
                key={s.key}
                type="button"
                onClick={() => setFStatus(s.key)}
                className={`text-left rounded-xl border bg-white dark:bg-slate-900 p-4 transition-all hover:shadow-sm ${s.ring} ${fStatus === s.key ? 'ring-2 ring-blue-500' : ''}`}
              >
                <div className={`text-2xl font-bold ${s.cls}`}>{s.value}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{s.label}</div>
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input className="pl-9" placeholder="Pesquisar nº, assunto, solicitante..." value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            <div className="w-full sm:w-56">
              <Select options={filtroStatusOptions} value={fStatus} onValueChange={setFStatus} searchable={false} />
            </div>
            <Button variant="outline" onClick={loadTickets} disabled={loadingTickets}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loadingTickets ? 'animate-spin' : ''}`} /> Atualizar
            </Button>
          </div>

          {loadingTickets ? (
            <div className="flex items-center justify-center py-16 text-slate-500"><Loader2 className="w-6 h-6 animate-spin mr-2" /> A carregar tickets...</div>
          ) : ticketsFiltrados.length === 0 ? (
            <Card><CardContent className="p-10 text-center text-slate-500">Nenhum ticket encontrado.</CardContent></Card>
          ) : (
            ticketsFiltrados.map(tk => {
              const meta = STATUS_META[tk.status] || STATUS_META.aberta;
              return (
                <Card key={tk.id}>
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <Badge variant="outline" className="font-mono">{tk.numero_ticket}</Badge>
                      <Badge className={meta.className + ' border'}>{meta.label}</Badge>
                      {tk.categoria && <Badge variant="outline">{CAT_LABEL[tk.categoria] || tk.categoria}</Badge>}
                      <span className="text-xs text-slate-400 ml-auto">{fmt(tk.created_date)}</span>
                    </div>
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">{tk.assunto}</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 whitespace-pre-wrap">{tk.mensagem}</p>
                    {Array.isArray(tk.anexos) && tk.anexos.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {tk.anexos.map((a, i) => (
                          a.tipo?.startsWith('image/') ? (
                            <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" title={a.nome}>
                              <img src={a.url} alt={a.nome} className="w-16 h-16 object-cover rounded-lg border border-slate-200 dark:border-slate-700 hover:opacity-80 transition-opacity" />
                            </a>
                          ) : (
                            <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" title={a.nome}
                               className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:underline">
                              <FileText className="w-3.5 h-3.5" /> <span className="max-w-[140px] truncate">{a.nome}</span>
                            </a>
                          )
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-xs text-slate-500">
                        <strong>{tk.solicitante_nome || '—'}</strong>{tk.solicitante_email ? ` · ${tk.solicitante_email}` : ''}
                      </span>
                      <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => abrirEncaminhar(tk)}>
                        <Forward className="w-3.5 h-3.5 mr-1" /> Encaminhar
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 px-2 text-xs text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:border-red-900 dark:hover:bg-red-950" onClick={() => abrirApagar(tk)}>
                        <Trash2 className="w-3.5 h-3.5 mr-1" /> Apagar
                      </Button>
                      <div className="flex items-center gap-1.5 ml-auto">
                        {savingId === tk.id && <Loader2 className="w-4 h-4 animate-spin text-blue-600 mr-1" />}
                        {statusOptions.map(so => {
                          const active = tk.status === so.value;
                          return (
                            <button
                              key={so.value}
                              type="button"
                              disabled={savingId === tk.id}
                              onClick={() => handleStatusChange(tk, so.value)}
                              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors disabled:opacity-50 ${active ? (STATUS_META[so.value]?.className || '') + ' border' : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                            >
                              {so.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {tk.encaminhado_para && (
                      <p className="text-xs text-blue-500 dark:text-blue-400 mt-2 flex items-center gap-1"><Forward className="w-3 h-3" /> Encaminhado para {tk.encaminhado_para} em {fmt(tk.encaminhado_em)}</p>
                    )}
                    {tk.respondido_por && tk.status === 'resolvida' && (
                      <p className="text-xs text-green-600 dark:text-green-400 mt-2">Resolvido por {tk.respondido_por} em {fmt(tk.respondido_em)}</p>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}

          {/* Modal: Encaminhar ticket */}
          <Dialog open={!!forwardTk} onOpenChange={(o) => { if (!o && !forwarding) setForwardTk(null); }}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Forward className="w-5 h-5 text-blue-600" /> Encaminhar {forwardTk?.numero_ticket}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2 text-sm text-slate-600 dark:text-slate-300">
                  <strong>{forwardTk?.assunto}</strong>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Encaminhar para (email @sga.co.ao) *</label>
                  <Input type="email" value={forwardEmail} onChange={(e) => setForwardEmail(e.target.value)} placeholder="ex.: tecnico@sga.co.ao" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nota (opcional)</label>
                  <Textarea value={forwardNota} onChange={(e) => setForwardNota(e.target.value)} rows={3} placeholder="Contexto para quem vai receber..." />
                </div>
                {forwardErro && <p className="text-sm text-red-600 dark:text-red-400">{forwardErro}</p>}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setForwardTk(null)} disabled={forwarding}>Cancelar</Button>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleEncaminhar} disabled={forwarding}>
                  {forwarding ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> A enviar...</> : <><Forward className="w-4 h-4 mr-2" /> Encaminhar</>}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Modal: Apagar ticket */}
          <Dialog open={!!deleteTk} onOpenChange={(o) => { if (!o && !deleting) setDeleteTk(null); }}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-600">
                  <Trash2 className="w-5 h-5" /> Apagar {deleteTk?.numero_ticket}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2 text-sm text-slate-600 dark:text-slate-300">
                  <strong>{deleteTk?.assunto}</strong>
                </div>
                <div className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <p className="font-medium">Esta ação é irreversível.</p>
                  <p className="mt-1">O ticket será removido permanentemente da base de dados.</p>
                </div>
                {deleteErro && <p className="text-sm text-red-600 dark:text-red-400">{deleteErro}</p>}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteTk(null)} disabled={deleting}>Cancelar</Button>
                <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={handleApagar} disabled={deleting}>
                  {deleting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> A apagar...</> : <><Trash2 className="w-4 h-4 mr-2" /> Apagar definitivamente</>}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      ) : sucesso ? (
        /* ---- Sucesso ao abrir ticket ---- */
        <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950 max-w-3xl">
          <CardContent className="p-8 text-center">
            <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-green-800 dark:text-green-200 mb-2">Ticket enviado com sucesso!</h2>
            <div className="flex items-center justify-center gap-2 mb-4">
              <Ticket className="w-5 h-5 text-green-700" />
              <Badge className="bg-green-700 text-white text-base px-4 py-1">{sucesso}</Badge>
            </div>
            <p className="text-green-700 dark:text-green-300 text-sm mb-6">
              Guarde este número para acompanhar o seu pedido.<br />
              A equipa de suporte irá analisar o seu ticket.
            </p>
            <Button onClick={handleNovo} variant="outline" className="border-green-600 text-green-700 hover:bg-green-100">
              Abrir Novo Ticket
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* ---- Formulário: novo ticket ---- */
        <Card className="max-w-3xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold text-slate-700 dark:text-slate-300">Novo Ticket de Suporte</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Assunto <span className="text-red-500">*</span>
                </label>
                <Input placeholder="Resumo do seu problema ou dúvida" value={assunto} onChange={(e) => setAssunto(e.target.value)} minLength={5} required />
                {assunto.length > 0 && assunto.length < 5 && (<p className="text-xs text-slate-400 mt-1">Mínimo 5 caracteres</p>)}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Categoria</label>
                <Select options={categorias} value={categoria} onValueChange={setCategoria} placeholder="Selecione (opcional)" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Mensagem <span className="text-red-500">*</span>
                </label>
                <Textarea placeholder="Descreva seu problema ou dúvida com o máximo de detalhes possível..." value={mensagem} onChange={(e) => setMensagem(e.target.value)} className="min-h-[140px] resize-y" required />
                {mensagem.length > 0 && mensagem.length < 10 && (<p className="text-xs text-slate-400 mt-1">Mínimo 10 caracteres</p>)}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Anexos (opcional)</label>
                <div className="border border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-3 space-y-2">
                  <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-blue-600 dark:text-blue-400 hover:underline">
                    <Paperclip className="w-4 h-4" /> Adicionar fotos ou documentos
                    <input type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" className="hidden" onChange={handleFileUpload} disabled={uploadingAnexo} />
                  </label>
                  <p className="text-xs text-slate-400">Imagens, PDF ou documentos — até 10MB cada.</p>
                  {uploadingAnexo && <p className="text-sm text-slate-500 flex items-center gap-1"><Loader2 className="w-4 h-4 animate-spin" /> A carregar...</p>}
                  {uploadErro && <p className="text-sm text-red-600 dark:text-red-400">{uploadErro}</p>}
                  {anexos.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {anexos.map((a, i) => (
                        <div key={i} className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-lg pl-1 pr-2 py-1 text-xs">
                          {a.tipo?.startsWith('image/')
                            ? <img src={a.url} alt={a.nome} className="w-8 h-8 object-cover rounded" />
                            : <FileText className="w-4 h-4 text-slate-500 ml-1" />}
                          <span className="max-w-[160px] truncate text-slate-700 dark:text-slate-300">{a.nome}</span>
                          <button type="button" onClick={() => removeAnexo(i)} className="text-slate-400 hover:text-red-600" aria-label="Remover anexo"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {erro && (<p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded px-3 py-2">{erro}</p>)}
              <div className="flex justify-end">
                <Button type="submit" disabled={enviando || uploadingAnexo || assunto.length < 5 || mensagem.length < 10} className="bg-slate-800 hover:bg-slate-900 text-white">
                  <Send className="w-4 h-4 mr-2" />
                  {enviando ? "A enviar..." : "Enviar Ticket"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
