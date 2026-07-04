import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Mail, Plus, Trash2, CalendarDays, CalendarRange, CalendarClock, Info, Loader2, Power, Gauge, Clock, Receipt } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { isAdminProfile } from '@/components/lib/userUtils';
import AccessDenied from '@/components/shared/AccessDenied';
import { RelatorioDestinatario } from '@/entities/RelatorioDestinatario';
import { RelatorioAgenda } from '@/entities/RelatorioAgenda';

const TIPOS = [
  { key: 'diario', label: 'Relatório Diário', desc: 'Voos do dia anterior', icon: CalendarDays, color: 'text-blue-600' },
  { key: 'semanal', label: 'Relatório Semanal', desc: 'Últimos 7 dias', icon: CalendarRange, color: 'text-emerald-600' },
  { key: 'mensal', label: 'Relatório Mensal', desc: 'Mês anterior', icon: CalendarClock, color: 'text-purple-600' },
  { key: 'kpis', label: 'Mapa de KPIs', desc: 'Tempos de atendimento vs meta (semanal e mensal)', icon: Gauge, color: 'text-rose-600' },
  { key: 'pronto_pagamento', label: 'Pronto Pagamento', desc: 'Pagamentos (PP) do dia anterior; segunda cobre sex–dom', icon: Receipt, color: 'text-teal-600' },
];
// Cada card mapeia para uma ou mais entradas de agenda (chave).
const CARD_CHAVES = { diario: ['diario'], semanal: ['semanal'], mensal: ['mensal'], kpis: ['kpis_semanal', 'kpis_mensal'], pronto_pagamento: ['pronto_pagamento'] };
const WEEKDAYS = [[1, 'Segunda'], [2, 'Terça'], [3, 'Quarta'], [4, 'Quinta'], [5, 'Sexta'], [6, 'Sábado'], [7, 'Domingo']];

const isSgaEmail = (e) => /@sga\.co\.ao$/i.test((e || '').trim());

// Editor de agendamento de um job (hora + dia + on/off).
function AgendaRow({ job, onSaved }) {
  const [hora, setHora] = useState(job.hora || '06:00');
  const [diaSemana, setDiaSemana] = useState(job.dia_semana || 1);
  const [diaMes, setDiaMes] = useState(job.dia_mes || 1);
  const [ativo, setAtivo] = useState(!!job.ativo);
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);
  const dirty = hora !== (job.hora || '') || ativo !== !!job.ativo
    || (job.frequencia === 'semanal' && Number(diaSemana) !== job.dia_semana)
    || (job.frequencia === 'mensal' && Number(diaMes) !== job.dia_mes);
  const save = async () => {
    setSaving(true); setOk(false);
    try {
      const patch = { hora, ativo };
      if (job.frequencia === 'semanal') patch.dia_semana = Number(diaSemana);
      if (job.frequencia === 'mensal') patch.dia_mes = Number(diaMes);
      await RelatorioAgenda.update(job.id, patch);
      setOk(true); onSaved && onSaved(); setTimeout(() => setOk(false), 2500);
    } catch (e) { window.alert('Erro ao guardar horário: ' + (e?.message || e)); }
    finally { setSaving(false); }
  };
  const freqLabel = job.frequencia === 'diaria' ? 'Todo dia' : job.frequencia === 'semanal' ? 'Toda' : 'Todo mês, dia';
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
      <span className={`w-20 ${ativo ? '' : 'opacity-50'}`}>{job.frequencia === 'diaria' && CARD_CHAVES.kpis.includes(job.chave) ? '' : ''}{job.chave.startsWith('kpis') ? (job.frequencia === 'semanal' ? 'KPIs sem.' : 'KPIs mês') : freqLabel}</span>
      {job.frequencia === 'semanal' && (
        <select value={diaSemana} onChange={(e) => setDiaSemana(Number(e.target.value))} className="border border-slate-300 dark:border-slate-600 rounded px-2 py-1 bg-white dark:bg-slate-900">
          {WEEKDAYS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      )}
      {job.frequencia === 'mensal' && (
        <span className="flex items-center gap-1">dia <input type="number" min="1" max="28" value={diaMes} onChange={(e) => setDiaMes(e.target.value)} className="border border-slate-300 dark:border-slate-600 rounded px-2 py-1 w-16 bg-white dark:bg-slate-900" /></span>
      )}
      <span className="flex items-center gap-1">às <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="border border-slate-300 dark:border-slate-600 rounded px-2 py-1 bg-white dark:bg-slate-900" /></span>
      <label className="flex items-center gap-1 cursor-pointer select-none"><input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} /> ativo</label>
      <Button size="sm" variant={dirty ? 'default' : 'outline'} disabled={!dirty || saving} onClick={save} className={dirty ? 'bg-blue-600 hover:bg-blue-700 text-white h-8' : 'h-8'}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : ok ? '✓ Guardado' : 'Guardar'}
      </Button>
    </div>
  );
}

export default function Relatorios() {
  const { user: authUser } = useAuth();
  const queryClient = useQueryClient();
  const [novo, setNovo] = useState({});   // { [tipo]: { email, nome } }
  const [erro, setErro] = useState({});   // { [tipo]: string }
  const [busy, setBusy] = useState(false);

  const { data: dests = [], isLoading } = useQuery({
    queryKey: ['relatorio_destinatario'],
    queryFn: () => RelatorioDestinatario.list('-created_date'),
    staleTime: 0,
  });
  const { data: agenda = [] } = useQuery({
    queryKey: ['relatorio_agenda'],
    queryFn: () => RelatorioAgenda.list('ordem'),
    staleTime: 0,
  });

  if (!authUser || !isAdminProfile(authUser)) return <AccessDenied />;

  const refetch = () => queryClient.invalidateQueries({ queryKey: ['relatorio_destinatario'] });
  const refetchAgenda = () => queryClient.invalidateQueries({ queryKey: ['relatorio_agenda'] });
  const porTipo = (tipo) => dests.filter((d) => d.tipo_relatorio === tipo);
  const setCampo = (tipo, campo, val) => setNovo((p) => ({ ...p, [tipo]: { ...p[tipo], [campo]: val } }));

  const handleAdd = async (tipo) => {
    const raw = (novo[tipo]?.email || '').trim();
    const nome = (novo[tipo]?.nome || '').trim();
    if (!raw) return setErro((p) => ({ ...p, [tipo]: 'Informe o email.' }));
    // aceita vários separados por ; , espaço ou nova linha
    const emails = [...new Set(raw.split(/[;,\s]+/).map((e) => e.trim()).filter(Boolean))];
    const invalidos = emails.filter((e) => !isSgaEmail(e));
    if (invalidos.length) return setErro((p) => ({ ...p, [tipo]: `Apenas emails @sga.co.ao: ${invalidos.join(', ')}` }));
    const existentes = new Set(porTipo(tipo).map((d) => (d.email || '').toLowerCase()));
    const novos = emails.filter((e) => !existentes.has(e.toLowerCase()));
    if (!novos.length) return setErro((p) => ({ ...p, [tipo]: 'Todos os emails já estão na lista.' }));
    setErro((p) => ({ ...p, [tipo]: null }));
    setBusy(true);
    try {
      for (const email of novos) {
        await RelatorioDestinatario.create({ tipo_relatorio: tipo, email, nome: (novos.length === 1 && nome) ? nome : null, ativo: true, created_by: authUser.id });
      }
      setNovo((p) => ({ ...p, [tipo]: { email: '', nome: '' } }));
      refetch();
    } catch (e) {
      setErro((p) => ({ ...p, [tipo]: e?.message || 'Erro ao adicionar.' }));
    } finally { setBusy(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remover este destinatário?')) return;
    setBusy(true);
    try { await RelatorioDestinatario.delete(id); refetch(); }
    catch (e) { window.alert('Erro ao remover: ' + (e?.message || e)); }
    finally { setBusy(false); }
  };

  const handleToggle = async (d) => {
    setBusy(true);
    try { await RelatorioDestinatario.update(d.id, { ativo: !d.ativo }); refetch(); }
    catch (e) { window.alert('Erro: ' + (e?.message || e)); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-6 p-1">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Mail className="w-7 h-7 text-blue-600" /> Relatórios Automáticos
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Agendamento e destinatários dos relatórios operacionais por email (HTML + PDF + Excel).
        </p>
      </div>

      <Card className="border-blue-200 bg-blue-50/60 dark:bg-blue-950/20">
        <CardContent className="pt-4 text-sm text-blue-900 dark:text-blue-200 flex gap-2">
          <Info className="w-5 h-5 flex-shrink-0 text-blue-600" />
          <div>
            Cada relatório é enviado <strong>individualmente</strong> para os destinatários <strong>@sga.co.ao</strong>
            (endereços externos são rejeitados pelo relay da SGA). Ajuste o <strong>horário, dia e on/off</strong> de cada
            relatório abaixo — o sistema verifica a agenda a cada 15 min. Sem destinatários, o relatório não é enviado.
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center gap-2 text-slate-500"><Loader2 className="w-5 h-5 animate-spin" /> Carregando…</div>
      ) : TIPOS.map((tp) => {
        const lista = porTipo(tp.key);
        const Icon = tp.icon;
        const ativos = lista.filter((d) => d.ativo).length;
        return (
          <Card key={tp.key}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Icon className={`w-5 h-5 ${tp.color}`} /> {tp.label}
                <Badge variant="secondary" className="ml-1">{ativos} ativo(s)</Badge>
              </CardTitle>
              <p className="text-xs text-slate-500 dark:text-slate-400">{tp.desc}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="pb-3 border-b border-slate-100 dark:border-slate-800 space-y-2">
                <div className="text-xs font-semibold text-slate-400 flex items-center gap-1 uppercase tracking-wide"><Clock className="w-3.5 h-3.5" /> Agendamento</div>
                {(CARD_CHAVES[tp.key] || []).map((ch) => { const job = agenda.find((a) => a.chave === ch); return job ? <AgendaRow key={ch} job={job} onSaved={refetchAgenda} /> : null; })}
              </div>
              <div className="text-xs font-semibold text-slate-400 flex items-center gap-1 uppercase tracking-wide pt-1"><Mail className="w-3.5 h-3.5" /> Destinatários</div>
              {lista.length === 0 && (
                <p className="text-sm text-amber-600 italic">Nenhum destinatário — este relatório não será enviado.</p>
              )}
              {lista.map((d) => (
                <div key={d.id} className={`flex items-center gap-3 p-2 rounded-lg border ${d.ativo ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-60'}`}>
                  <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{d.email}</div>
                    {d.nome && <div className="text-xs text-slate-500 truncate">{d.nome}</div>}
                  </div>
                  {!d.ativo && <Badge variant="outline" className="text-slate-500">inativo</Badge>}
                  <Button variant="ghost" size="sm" onClick={() => handleToggle(d)} disabled={busy} title={d.ativo ? 'Desativar' : 'Ativar'}>
                    <Power className={`w-4 h-4 ${d.ativo ? 'text-emerald-600' : 'text-slate-400'}`} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(d.id)} disabled={busy} title="Remover">
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              ))}
              <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <Input placeholder="email@sga.co.ao  (vários: separe por ;)" value={novo[tp.key]?.email || ''} onChange={(e) => setCampo(tp.key, 'email', e.target.value)} className="sm:max-w-sm" />
                <Input placeholder="Nome (opcional)" value={novo[tp.key]?.nome || ''} onChange={(e) => setCampo(tp.key, 'nome', e.target.value)} className="sm:max-w-xs" />
                <Button onClick={() => handleAdd(tp.key)} disabled={busy} className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Plus className="w-4 h-4 mr-1" /> Adicionar
                </Button>
              </div>
              {erro[tp.key] && <p className="text-sm text-red-600">{erro[tp.key]}</p>}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
