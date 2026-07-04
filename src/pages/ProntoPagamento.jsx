import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, Download, Loader2, CheckCircle2, AlertTriangle, History, Mail, Send, X, FileText, Filter, Calendar } from 'lucide-react';
import { gerarPdfPP, htmlRelatorioPP, agregarConsolidado } from '@/components/lib/relatorioPP';

// Parse do .xls num Web Worker (fora do main-thread) — evita congelar a aba no
// upload. A lógica de parse (calibrada p/ o Power BI) vive no worker.
function parseXlsInWorker(buffer, meta) {
  return new Promise((resolve, reject) => {
    let worker;
    try {
      worker = new Worker(new URL('../workers/ppParser.worker.js', import.meta.url), { type: 'module' });
    } catch (err) { reject(err); return; }
    worker.onmessage = (ev) => { resolve(ev.data); worker.terminate(); };
    worker.onerror = (err) => { reject(new Error(err?.message || 'Falha no processamento do ficheiro.')); worker.terminate(); };
    // Transfere o ArrayBuffer (zero-copy) para o worker.
    worker.postMessage({ buffer, ...meta }, [buffer]);
  });
}
const fmtD = (iso) => iso ? iso.split('-').reverse().join('/') : '';
const isSga = (e) => /@sga\.co\.ao$/i.test((e || '').trim());

let _logoCache;
async function loadLogo() {
  if (_logoCache !== undefined) return _logoCache;
  try {
    const res = await fetch('/logo-sga.png');
    const blob = await res.blob();
    const dataUrl = await new Promise((r, j) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.onerror = j; fr.readAsDataURL(blob); });
    const ratio = await new Promise((r) => { const img = new Image(); img.onload = () => r((img.naturalWidth / img.naturalHeight) || 2.4); img.onerror = () => r(2.4); img.src = dataUrl; });
    _logoCache = { dataUrl, ratio };
  } catch { _logoCache = null; }
  return _logoCache;
}

function baixarBase64(content, filename, contentType) {
  const bytes = atob(content);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([arr], { type: contentType || 'application/octet-stream' }));
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function buildExcelPP(rows) {
  const cons = agregarConsolidado(rows);
  const wb = XLSX.utils.book_new();
  const consData = cons.byMonth.map(m => ({
    'Mês': m.mes, 'Facturado AKZ': Math.round(m.factAkz), 'Facturado USD': +m.factUsd.toFixed(2),
    'Arrecadado -14% AKZ': Math.round(m.factAkz * 0.86), 'Arrecadado -14% USD': +(m.factUsd * 0.86).toFixed(2),
    'MoM%': m.mom == null ? '' : +m.mom.toFixed(1),
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(consData), 'Consolidado');
  const det = rows.map(r => ({
    Movimento: r.num_movimento, 'Data Movimento': r.data_movimento, Status: r.status, Cliente: r.nome_cliente,
    Servico: r.servico, Descricao: r.descricao, USD: r.valor_linha, AKZ: r.valor_linha_akz,
    Factura: r.num_factura, 'Data Pagamento': r.data_pagamento,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(det), 'Detalhe');
  return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
}

// Campo de data que SEMPRE mostra dd/mm/aaaa (o input nativo segue o idioma do navegador).
// value/onChange em ISO (yyyy-mm-dd); botão de calendário abre o seletor nativo.
function DateBR({ value, onChange }) {
  const toBR = (iso) => iso ? iso.split('-').reverse().join('/') : '';
  const [txt, setTxt] = useState(toBR(value));
  const nativeRef = useRef(null);
  useEffect(() => { setTxt(toBR(value)); }, [value]);
  const onText = (e) => {
    const v = e.target.value; setTxt(v);
    const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) onChange(`${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`);
  };
  return (
    <div className="relative">
      <Input value={txt} onChange={onText} onBlur={() => setTxt(toBR(value))} placeholder="dd/mm/aaaa" inputMode="numeric" className="pr-9" />
      <button type="button" onClick={() => nativeRef.current?.showPicker?.()} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" tabIndex={-1} aria-label="Abrir calendário">
        <Calendar className="w-4 h-4" />
      </button>
      <input ref={nativeRef} type="date" value={value || ''} onChange={(e) => onChange(e.target.value)} className="sr-only" tabIndex={-1} aria-hidden="true" />
    </div>
  );
}

export default function ProntoPagamento() {
  const { user } = useAuth();
  const hoje = new Date().toISOString().slice(0, 10);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [pending, setPending] = useState(null); // ficheiro parseado aguardando confirmação
  const [historico, setHistorico] = useState([]);
  const [de, setDe] = useState(hoje);
  const [ate, setAte] = useState(hoje);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [report, setReport] = useState(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [destinatarios, setDestinatarios] = useState([]);
  const [extraEmails, setExtraEmails] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [envioMsg, setEnvioMsg] = useState(null);

  const loadHist = useCallback(async () => {
    const { data } = await supabase.from('facturacao_trafego_pp')
      .select('source_file, upload_date, uploaded_by, status')
      .not('upload_date', 'is', null).order('upload_date', { ascending: false }).limit(5000);
    const g = new Map();
    (data || []).forEach(r => {
      const k = `${r.upload_date}|${r.source_file}`;
      const e = g.get(k) || { upload_date: r.upload_date, source_file: r.source_file, uploaded_by: r.uploaded_by, linhas: 0, pp: 0 };
      e.linhas++; if (r.status === 'PP') e.pp++; g.set(k, e);
    });
    setHistorico([...g.values()].slice(0, 20));
  }, []);
  useEffect(() => { loadHist(); }, [loadHist]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('facturacao_trafego_pp')
        .select('data_movimento_d').eq('status', 'PP').not('data_movimento_d', 'is', null)
        .order('data_movimento_d', { ascending: false }).limit(1);
      const d = data?.[0]?.data_movimento_d;
      if (d) { setAte(d); setDe(d.slice(0, 4) + '-01-01'); }
    })();
  }, []);

  const carregarDestinatarios = useCallback(async () => {
    try {
      const rows = await supabase.from('relatorio_destinatario').select('email').eq('tipo_relatorio', 'pronto_pagamento').eq('ativo', true);
      setDestinatarios([...new Set((rows.data || []).map(r => (r.email || '').trim()).filter(Boolean))]);
    } catch { setDestinatarios([]); }
  }, []);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true); setImportResult(null);
    try {
      const buffer = await file.arrayBuffer();
      const res = await parseXlsInWorker(buffer, { hoje, userEmail: user?.email || null, fileName: file.name });
      if (!res?.ok) throw new Error(res?.error || 'Falha ao processar o ficheiro.');
      if (!res.out || res.out.length === 0) throw new Error('Nenhuma linha de dados encontrada no ficheiro.');
      // NÃO grava ainda — mostra a prévia e pede confirmação.
      setPending({ rows: res.out, file: file.name, total: res.out.length, pp: res.pp, movs: res.movs });
    } catch (err) {
      setImportResult({ error: err.message });
    } finally {
      setImporting(false); e.target.value = '';
    }
  };

  const confirmarImport = async () => {
    if (!pending) return;
    setImporting(true); setImportResult(null);
    try {
      let inserted = 0;
      for (let i = 0; i < pending.rows.length; i += 500) {
        const { data, error } = await supabase.from('facturacao_trafego_pp')
          .upsert(pending.rows.slice(i, i + 500), { onConflict: 'row_hash', ignoreDuplicates: true }).select('id');
        if (error) throw error;
        inserted += (data?.length || 0);
      }
      setImportResult({ total: pending.total, inserted, dup: pending.total - inserted, pp: pending.pp, file: pending.file });
      setPending(null);
      await loadHist();
    } catch (err) {
      setImportResult({ error: err.message });
    } finally {
      setImporting(false);
    }
  };

  const gerar = async () => {
    if (!de || !ate) { setErro('Selecione o período.'); return; }
    if (de > ate) { setErro('A data de início não pode ser depois do fim.'); return; }
    setLoading(true); setErro(null); setReport(null); setEmailOpen(false); setEnvioMsg(null);
    try {
      const { data, error } = await supabase.from('facturacao_trafego_pp').select('*')
        .eq('status', 'PP').gte('data_movimento_d', de).lte('data_movimento_d', ate).limit(50000);
      if (error) throw error;
      if (!data || !data.length) { setErro('Nenhum movimento PP encontrado no período.'); return; }
      const periodo = de === ate ? fmtD(de) : `${fmtD(de)} — ${fmtD(ate)}`;
      // Consolidado = TODOS os anos (para YoY); o mensal usa o ano do filtro (anoCons).
      const anoCons = (ate || hoje).slice(0, 4);
      const consResp = await supabase.from('facturacao_trafego_pp')
        .select('valor_linha,valor_linha_akz,data_movimento_d')
        .eq('status', 'PP').not('data_movimento_d', 'is', null).limit(60000);
      const consolidadoRows = consResp.data || [];
      const logo = await loadLogo();
      const meta = { periodo, logo: logo?.dataUrl, logoRatio: logo?.ratio, consolidadoRows, anoConsolidado: anoCons };
      const doc = gerarPdfPP(data, meta);
      const pdfB64 = doc.output('datauristring').split(',')[1];
      const excelB64 = buildExcelPP(data);
      const htmlEmail = htmlRelatorioPP(data, meta);
      const htmlPreview = htmlEmail.replace(/cid:sgalogo/g, '/logo-sga.png');
      setReport({ htmlEmail, htmlPreview, pdfB64, excelB64, periodo, nMov: new Set(data.map(r => r.num_movimento)).size, nLin: data.length });
      carregarDestinatarios();
    } catch (e) {
      setErro(e.message || 'Não foi possível gerar o relatório.');
    } finally {
      setLoading(false);
    }
  };

  const enviar = async () => {
    const extras = extraEmails.split(/[;,\s]+/).map(s => s.trim()).filter(Boolean);
    const externos = extras.filter(e => !isSga(e));
    if (externos.length) { setEnvioMsg({ ok: false, txt: `Só emails @sga.co.ao: ${externos.join(', ')}` }); return; }
    const to = [...new Set([...destinatarios, ...extras])];
    if (!to.length) { setEnvioMsg({ ok: false, txt: 'Sem destinatários. Adicione ao menos um @sga.co.ao.' }); return; }
    setEnviando(true); setEnvioMsg(null);
    try {
      const attachments = [{ filename: `Pronto_Pagamento_${ate}.pdf`, content: report.pdfB64, contentType: 'application/pdf' }];
      let ok = 0, fail = 0;
      for (const email of to) {
        const { data, error } = await supabase.functions.invoke('send-email', { body: { to: email, subject: `Relatório Pronto Pagamento — ${report.periodo}`, html: report.htmlEmail, attachments } });
        if (!error && data?.success) ok++; else fail++;
        await new Promise(r => setTimeout(r, 500));
      }
      setEnvioMsg({ ok: fail === 0, txt: `Enviado para ${ok} destinatário(s)${fail ? `, ${fail} falharam` : ''}.` });
      if (fail === 0) setExtraEmails('');
    } catch (e) {
      setEnvioMsg({ ok: false, txt: e.message || 'Falha ao enviar.' });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <FileSpreadsheet className="w-7 h-7 text-teal-600" /> Facturação Tráfego — Pronto Pagamento
        </h1>
        <p className="text-slate-500">Importe o ficheiro (.xls) e gere o relatório de arrecadação (PP) — pré-visualize, descarregue ou envie por email.</p>
      </div>

      {/* Importar */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Upload className="w-5 h-5 text-teal-600" /> Importar ficheiro</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium cursor-pointer bg-teal-600 text-white hover:bg-teal-700 transition-colors ${importing ? 'opacity-50 pointer-events-none' : ''}`}>
              <Upload className="w-4 h-4" /> Escolher ficheiro (.xls)
              <input type="file" accept=".xls,.xlsx" onChange={handleFile} disabled={importing} className="hidden" />
            </label>
            {importing
              ? <span className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> A processar…</span>
              : <span className="text-sm text-slate-400">Nenhum ficheiro selecionado</span>}
          </div>
          <p className="text-xs text-slate-500">Formato: export "Facturação Tráfego PP". Linhas já existentes são ignoradas (dedup por chave lógica).</p>

          {pending && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm space-y-3">
              <div className="text-amber-900 font-medium">Confirmar importação de <span className="font-mono">{pending.file}</span>?</div>
              <div className="flex flex-wrap gap-4 text-slate-700">
                <span><b>{pending.total}</b> linhas únicas</span>
                <span><b>{pending.movs}</b> movimentos</span>
                <span><b>{pending.pp}</b> pagas (PP)</span>
              </div>
              <p className="text-xs text-slate-500">Linhas já existentes no banco serão ignoradas automaticamente (nada é duplicado).</p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setPending(null)} disabled={importing}>Cancelar</Button>
                <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white" onClick={confirmarImport} disabled={importing}>
                  {importing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> A importar…</> : <>Confirmar importação</>}
                </Button>
              </div>
            </div>
          )}

          {importResult && !importResult.error && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm space-y-1">
              <div className="flex items-center gap-2 text-green-800 font-medium"><CheckCircle2 className="w-4 h-4" /> {importResult.file} processado</div>
              <div className="text-slate-600"><b className="text-green-700">{importResult.inserted}</b> nova(s) gravada(s) no banco · <b>{importResult.dup}</b> já existia(m) (ignorada(s)) · <Badge variant="outline" className="ml-1">{importResult.pp} pagas (PP)</Badge></div>
              <div className="text-xs text-slate-400">Ficheiro: {importResult.total} linhas únicas. Sem duplicação — dedup por movimento + serviço + valores.</div>
            </div>
          )}
          {importResult?.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {importResult.error}</div>
          )}
        </CardContent>
      </Card>

      {/* Filtros / gerar */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Filter className="w-5 h-5 text-blue-600" /> Gerar relatório (Pronto Pagamento)</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div><Label className="text-xs">Data de movimento — início</Label><DateBR value={de} onChange={setDe} /></div>
            <div><Label className="text-xs">Data de movimento — fim</Label><DateBR value={ate} onChange={setAte} /></div>
            <Button onClick={gerar} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> A gerar…</> : <><FileText className="w-4 h-4 mr-2" /> Gerar relatório</>}
            </Button>
          </div>
          <p className="text-xs text-slate-500 mt-2">Consolidado (Facturado + Arrecadado −14%, por mês) + detalhe. Só PP, pela data de movimento.</p>
          {erro && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {erro}</div>}
        </CardContent>
      </Card>

      {/* Resultado */}
      {report && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="text-base">Pronto Pagamento <span className="text-slate-400 font-normal">· {report.periodo} · {report.nMov} movimentos</span></CardTitle>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => baixarBase64(report.pdfB64, `Pronto_Pagamento_${ate}.pdf`, 'application/pdf')}><Download className="w-4 h-4 mr-1.5 text-red-600" /> PDF</Button>
                <Button variant="outline" size="sm" onClick={() => baixarBase64(report.excelB64, `Pronto_Pagamento_${ate}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}><FileSpreadsheet className="w-4 h-4 mr-1.5 text-emerald-600" /> Excel</Button>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => { setEmailOpen(o => !o); setEnvioMsg(null); }}><Mail className="w-4 h-4 mr-1.5" /> Enviar por email</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {emailOpen && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-700">Enviar este relatório por email</p>
                  <button onClick={() => setEmailOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Destinatários configurados (pronto_pagamento):</p>
                  {destinatarios.length
                    ? <div className="flex flex-wrap gap-1.5">{destinatarios.map(e => <span key={e} className="text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5">{e}</span>)}</div>
                    : <p className="text-xs text-slate-400 italic">Nenhum configurado — adicione abaixo ou em Relatórios Automáticos.</p>}
                </div>
                <div>
                  <Label className="text-xs">Adicionar outros (@sga.co.ao, separados por ; )</Label>
                  <Input value={extraEmails} onChange={e => setExtraEmails(e.target.value)} placeholder="ex.: fulano@sga.co.ao; outro@sga.co.ao" />
                </div>
                {envioMsg && <p className={`text-sm flex items-center gap-1 ${envioMsg.ok ? 'text-green-600' : 'text-red-600'}`}>{envioMsg.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />} {envioMsg.txt}</p>}
                <div className="flex justify-end">
                  <Button onClick={enviar} disabled={enviando} className="bg-blue-600 hover:bg-blue-700 text-white">
                    {enviando ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> A enviar…</> : <><Send className="w-4 h-4 mr-2" /> Enviar agora</>}
                  </Button>
                </div>
              </div>
            )}
            <div>
              <p className="text-xs text-slate-500 mb-2">Pré-visualização (igual ao corpo do email):</p>
              <iframe title="Pré-visualização" srcDoc={report.htmlPreview} className="w-full rounded-lg border border-slate-200 bg-white" style={{ height: '70vh' }} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Histórico */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><History className="w-5 h-5 text-slate-500" /> Uploads recentes</CardTitle></CardHeader>
        <CardContent>
          {historico.length === 0 ? <p className="text-sm text-slate-400">Nenhum upload ainda.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-slate-500 border-b"><th className="py-2 pr-4">Data upload</th><th className="py-2 pr-4">Ficheiro</th><th className="py-2 pr-4">Por</th><th className="py-2 pr-4 text-right">Linhas</th><th className="py-2 text-right">Pagas (PP)</th></tr></thead>
                <tbody>
                  {historico.map((h, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2 pr-4">{fmtD(h.upload_date)}</td>
                      <td className="py-2 pr-4 font-mono text-xs truncate max-w-[220px]" title={h.source_file}>{h.source_file}</td>
                      <td className="py-2 pr-4 text-slate-500">{(h.uploaded_by || '').split('@')[0]}</td>
                      <td className="py-2 pr-4 text-right">{h.linhas}</td>
                      <td className="py-2 text-right font-medium text-green-700">{h.pp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
