import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Select from '@/components/ui/select';
import {
  Calendar, CalendarDays, CalendarRange, Gauge, Download, Mail, Loader2,
  FileText, FileSpreadsheet, Filter, Send, X, CheckCircle, AlertCircle, Plane
} from 'lucide-react';
import { createEntity } from '@/entities/_createEntity';
import { gerarRelatorio } from '@/functions/gerarRelatorio';

const Aeroporto = createEntity('aeroporto');
const RelatorioDestinatario = createEntity('relatorio_destinatario');

const TIPOS = [
  { id: 'diario',  label: 'Relatório Diário',  desc: 'Voos de um dia',            icon: Calendar },
  { id: 'semanal', label: 'Relatório Semanal', desc: 'Voos de um período semanal', icon: CalendarDays },
  { id: 'mensal',  label: 'Relatório Mensal',  desc: 'Voos de um mês',            icon: CalendarRange },
  { id: 'kpis',    label: 'Mapa de KPIs',      desc: 'Tempos de atendimento vs meta', icon: Gauge },
];

const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Período padrão por tipo (igual aos relatórios automáticos).
function defaultsPara(tipo) {
  const hoje = new Date();
  if (tipo === 'diario') {
    const o = new Date(hoje); o.setDate(o.getDate() - 1);
    return { inicio: isoLocal(o), fim: isoLocal(o) };
  }
  if (tipo === 'semanal') {
    const f = new Date(hoje); f.setDate(f.getDate() - 1);
    const i = new Date(f); i.setDate(i.getDate() - 6);
    return { inicio: isoLocal(i), fim: isoLocal(f) };
  }
  // mensal / kpis → mês anterior
  const first = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const last = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
  return { inicio: isoLocal(first), fim: isoLocal(last) };
}

const recipientTipo = (tipo) => (tipo === 'kpis' ? 'kpis' : tipo);
const isSga = (e) => /@sga\.co\.ao$/i.test((e || '').trim());

// base64 → download de ficheiro
function baixarBase64(content, filename, contentType) {
  const bytes = atob(content);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  const blob = new Blob([arr], { type: contentType || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export default function PowerBi() {
  const [tipo, setTipo] = useState('diario');
  const [inicio, setInicio] = useState(defaultsPara('diario').inicio);
  const [fim, setFim] = useState(defaultsPara('diario').fim);
  const [aeroporto, setAeroporto] = useState('');
  const [aeroportos, setAeroportos] = useState([]);

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [result, setResult] = useState(null); // { html, anexos, periodo, assunto }

  // Email
  const [emailOpen, setEmailOpen] = useState(false);
  const [destinatarios, setDestinatarios] = useState([]);
  const [extraEmails, setExtraEmails] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [envioMsg, setEnvioMsg] = useState(null);

  // Pré-seleção via query params (ex.: vindo de "Gerar Relatório" na página de KPIs)
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const qtipo = searchParams.get('tipo');
    if (qtipo && ['diario', 'semanal', 'mensal', 'kpis'].includes(qtipo)) {
      setTipo(qtipo);
      const d = defaultsPara(qtipo);
      setInicio(searchParams.get('inicio') || d.inicio);
      setFim(searchParams.get('fim') || d.fim);
      const qaero = searchParams.get('aeroporto');
      if (qaero) setAeroporto(qaero);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Carregar aeroportos operados (códigos FN*)
  useEffect(() => {
    Aeroporto.list('codigo_icao')
      .then(rows => setAeroportos((rows || []).filter(a => /^FN/i.test(a.codigo_icao || ''))))
      .catch(() => {});
  }, []);

  // Destinatários configurados para o tipo atual
  const carregarDestinatarios = useCallback(async (t) => {
    try {
      const rows = await RelatorioDestinatario.filter({ tipo_relatorio: recipientTipo(t), ativo: true });
      setDestinatarios([...new Set((rows || []).map(r => (r.email || '').trim()).filter(Boolean))]);
    } catch { setDestinatarios([]); }
  }, []);
  useEffect(() => { carregarDestinatarios(tipo); }, [tipo, carregarDestinatarios]);

  const escolherTipo = (t) => {
    setTipo(t);
    const d = defaultsPara(t);
    setInicio(d.inicio); setFim(d.fim);
    setResult(null); setErro(null); setEmailOpen(false); setEnvioMsg(null);
  };

  const aeroportoOptions = [
    { value: '', label: 'Todos os aeroportos' },
    ...aeroportos.map(a => ({ value: a.codigo_icao, label: `${a.codigo_icao} — ${a.nome}` })),
  ];

  const gerar = async () => {
    if (!inicio || !fim) { setErro('Selecione o período (início e fim).'); return; }
    if (inicio > fim) { setErro('A data de início não pode ser depois da data de fim.'); return; }
    setLoading(true); setErro(null); setResult(null); setEnvioMsg(null);
    try {
      const data = await gerarRelatorio({ tipo, inicio, fim, aeroporto: aeroporto || undefined, action: 'emit' });
      // Na pré-visualização (iframe do browser) o cid:sgalogo não carrega (só serve no email).
      // Trocar pela logo servida em mesma origem, que o CSP permite.
      const html = (data?.html || '').replace(/cid:sgalogo/g, '/logo-sga.png');
      setResult({ ...data, html });
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
    if (!to.length) { setEnvioMsg({ ok: false, txt: 'Sem destinatários. Adicione ao menos um email @sga.co.ao.' }); return; }
    setEnviando(true); setEnvioMsg(null);
    try {
      await gerarRelatorio({ tipo, inicio, fim, aeroporto: aeroporto || undefined, action: 'email', to });
      setEnvioMsg({ ok: true, txt: `Enviado para ${to.length} destinatário(s).` });
      setExtraEmails('');
    } catch (e) {
      setEnvioMsg({ ok: false, txt: e.message || 'Falha ao enviar.' });
    } finally {
      setEnviando(false);
    }
  };

  const tipoMeta = TIPOS.find(x => x.id === tipo);
  const anexos = result?.anexos || [];
  const pdfs = anexos.filter(a => (a.contentType || '').includes('pdf'));
  const excels = anexos.filter(a => (a.filename || '').toLowerCase().endsWith('.xlsx'));

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-slate-50 dark:bg-slate-950 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Plane className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            Relatórios de Voos
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Gere os relatórios operacionais sob demanda, com filtros — e descarregue ou envie por email.
          </p>
        </div>

        {/* Tipo de relatório */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {TIPOS.map(tp => {
            const Icon = tp.icon;
            const active = tipo === tp.id;
            return (
              <button
                key={tp.id}
                onClick={() => escolherTipo(tp.id)}
                className={`text-left rounded-xl border p-4 transition-all ${active
                  ? 'border-blue-500 ring-2 ring-blue-500/30 bg-blue-50 dark:bg-blue-950'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:shadow-sm'}`}
              >
                <Icon className={`w-5 h-5 mb-2 ${active ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500'}`} />
                <div className={`text-sm font-semibold ${active ? 'text-blue-700 dark:text-blue-300' : 'text-slate-800 dark:text-slate-200'}`}>{tp.label}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{tp.desc}</div>
              </button>
            );
          })}
        </div>

        {/* Filtros */}
        <Card className="border-slate-200 dark:border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Filter className="w-4 h-4" /> Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Data início</label>
                <Input type="date" value={inicio} onChange={e => setInicio(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Data fim</label>
                <Input type="date" value={fim} onChange={e => setFim(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Aeroporto</label>
                <Select options={aeroportoOptions} value={aeroporto} onValueChange={setAeroporto} placeholder="Todos os aeroportos" />
              </div>
              <div>
                <Button onClick={gerar} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                  {loading
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> A gerar...</>
                    : <><FileText className="w-4 h-4 mr-2" /> Gerar relatório</>}
                </Button>
              </div>
            </div>
            {erro && (
              <Alert className="mt-4 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950">
                <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                <AlertDescription className="text-sm text-red-700 dark:text-red-300">{erro}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Resultado */}
        {result && (
          <Card className="border-slate-200 dark:border-slate-700">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <CardTitle className="text-base font-semibold text-slate-800 dark:text-slate-200">
                  {tipoMeta?.label}
                  <span className="text-slate-400 font-normal"> · {result.periodo?.inicio} a {result.periodo?.fim}{aeroporto ? ` · ${aeroporto}` : ''}</span>
                </CardTitle>
                <div className="flex flex-wrap gap-2">
                  {pdfs.map((a, i) => (
                    <Button key={i} variant="outline" size="sm" onClick={() => baixarBase64(a.content, a.filename, a.contentType)}>
                      <Download className="w-4 h-4 mr-1.5 text-red-600" /> {a.filename.includes('Tecnico') ? 'PDF Técnico' : 'PDF'}
                    </Button>
                  ))}
                  {excels.map((a, i) => (
                    <Button key={i} variant="outline" size="sm" onClick={() => baixarBase64(a.content, a.filename, a.contentType)}>
                      <FileSpreadsheet className="w-4 h-4 mr-1.5 text-emerald-600" /> Excel
                    </Button>
                  ))}
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => { setEmailOpen(o => !o); setEnvioMsg(null); }}>
                    <Mail className="w-4 h-4 mr-1.5" /> Enviar por email
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Envio por email */}
              {emailOpen && (
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Enviar este relatório por email</p>
                    <button onClick={() => setEmailOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Destinatários configurados ({recipientTipo(tipo)}):</p>
                    {destinatarios.length
                      ? <div className="flex flex-wrap gap-1.5">{destinatarios.map(e => <span key={e} className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded-full px-2 py-0.5">{e}</span>)}</div>
                      : <p className="text-xs text-slate-400 italic">Nenhum configurado — adicione abaixo.</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Adicionar outros (@sga.co.ao, separados por ; )</label>
                    <Input value={extraEmails} onChange={e => setExtraEmails(e.target.value)} placeholder="ex.: fulano@sga.co.ao; outro@sga.co.ao" />
                  </div>
                  {envioMsg && (
                    <p className={`text-sm flex items-center gap-1 ${envioMsg.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {envioMsg.ok ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />} {envioMsg.txt}
                    </p>
                  )}
                  <div className="flex justify-end">
                    <Button onClick={enviar} disabled={enviando} className="bg-blue-600 hover:bg-blue-700 text-white">
                      {enviando ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> A enviar...</> : <><Send className="w-4 h-4 mr-2" /> Enviar agora</>}
                    </Button>
                  </div>
                </div>
              )}

              {/* Pré-visualização */}
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Pré-visualização (igual ao corpo do email):</p>
                <iframe
                  title="Pré-visualização do relatório"
                  srcDoc={result.html}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white"
                  style={{ height: '70vh' }}
                />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
