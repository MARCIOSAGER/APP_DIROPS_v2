import React, { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Select from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { CalendarPlus, Pencil, Users, Mail, Trash2, Loader2, CheckCircle2, XCircle, RotateCcw, UserPlus, Paperclip, X, MapPin, User, CalendarCheck, Ban, Video, LogIn } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabaseClient';
import { SessaoFormacao } from '@/entities/SessaoFormacao';
import { SessaoInscricao } from '@/entities/SessaoInscricao';
import { NotificacaoFormacao } from '@/entities/NotificacaoFormacao';
import { sendEmailDirect } from '@/functions/sendEmailDirect';
import { getPublicBaseUrl } from '@/lib/certificadoEmissao';
import { ENTREGAVEL } from '@/lib/formacaoLembrete';
import { useSessoesCurso, useMatriculasCurso, useUtilizadoresComPerfis, ehInstrutor, useAeroportosUc } from '@/hooks/useGestaoFormacao';
import { ESTADO_SESSAO, ESTADO_INSCRICAO, MODALIDADE, PLATAFORMAS, MODO, ocupacaoSessao, faseSessao, fmtPeriodoSessao, duracaoSessaoMin, textoConvocatoria, icsSessao, icsBase64, modoDe, localTexto, temLink } from '@/lib/formacaoSessoes';
import { exportarExcel, exportarPdf, fmtDataCurta } from '@/lib/formacaoExport';
import { podeEditarCurso, fmtTamanho, fmtMinutos } from '../formacaoUtils';
import { uploadGrande } from './uploadGrande';
import BotoesExportar from './BotoesExportar';

const ACCEPT_MATERIAL = '.pdf,.docx,.doc,.pptx,.ppt,.xlsx,.xls,.odt,.odp,.zip,.png,.jpg,.jpeg,.txt,.csv,.mp4';
const paraInputLocal = (iso) => { if (!iso) return ''; const d = new Date(iso); if (Number.isNaN(d.getTime())) return ''; const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const deInputLocal = (v) => { if (!v) return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d.toISOString(); };

// Separador "Sessões" do curso: agenda de sessões presenciais, inscritos, presenças, materiais, convocatórias.
export default function SessoesTab({ curso, aulas = [], user }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useSessoesCurso(curso.id);
  const { data: mats } = useMatriculasCurso(curso.id);
  const editavel = podeEditarCurso(user, curso);
  const [form, setForm] = useState(null);          // null | {} (nova) | sessão (editar)
  const [presencas, setPresencas] = useState(null); // sessão aberta no diálogo de presenças
  const [confirm, setConfirm] = useState(null);     // { tipo: 'cancelar'|'eliminar'|'realizada', sessao }
  const [busy, setBusy] = useState(null);
  const sessoes = data?.sessoes || [];
  const inscricoes = data?.inscricoes || [];
  const aulasPresenciais = useMemo(() => aulas.filter(a => a.tipo === 'presencial'), [aulas]);
  const refrescar = () => Promise.all([qc.invalidateQueries({ queryKey: ['sessao_formacao'] }), qc.invalidateQueries({ queryKey: ['matricula'] }), qc.invalidateQueries({ queryKey: ['progresso_aula'] })]);

  const mudarEstado = async (s, estado) => {
    setBusy(s.id);
    try {
      await SessaoFormacao.update(s.id, { estado, updated_by: user?.email || null });
      if (estado === 'cancelada') {
        const alvo = inscricoes.filter(i => i.sessao_id === s.id && ['inscrito', 'lista_espera'].includes(i.estado));
        await enviarEmails({ sessao: s, curso, alvos: alvo, tipo: 'cancelada', por: user?.email });
      }
      toast({ title: estado === 'cancelada' ? 'Sessão cancelada' : estado === 'realizada' ? 'Sessão marcada como realizada' : 'Sessão actualizada' });
      await refrescar();
    } catch (e) { toast({ title: 'Não foi possível actualizar a sessão', description: e?.message || String(e), variant: 'destructive' }); }
    finally { setBusy(null); setConfirm(null); }
  };
  const eliminar = async (s) => {
    setBusy(s.id);
    try { await SessaoFormacao.update(s.id, { deleted_at: new Date().toISOString(), updated_by: user?.email || null }); toast({ title: 'Sessão eliminada' }); await refrescar(); }
    catch (e) { toast({ title: 'Não foi possível eliminar', description: e?.message || String(e), variant: 'destructive' }); }
    finally { setBusy(null); setConfirm(null); }
  };
  const convocar = async (s) => {
    const alvo = inscricoes.filter(i => i.sessao_id === s.id && i.estado === 'inscrito');
    if (alvo.length === 0) { toast({ title: 'Sem inscritos para convocar' }); return; }
    setBusy(s.id);
    try { const r = await enviarEmails({ sessao: s, curso, alvos: alvo, tipo: 'convocatoria', por: user?.email }); toast({ title: `Convocatória enviada a ${r.entregues} ${r.entregues === 1 ? 'pessoa' : 'pessoas'}`, description: r.naoEntregues ? `${r.naoEntregues} sem email @sga.co.ao (registado, não entregue).` : undefined }); }
    catch (e) { toast({ title: 'Não foi possível enviar', description: e?.message || String(e), variant: 'destructive' }); }
    finally { setBusy(null); }
  };

  const exportarXlsx = () => exportarExcel(`Sessoes_${curso.titulo}`, [
    { nome: 'Sessões', cabecalho: ['Sessão', 'Modalidade', 'Início', 'Fim', 'Local', 'Aeroporto', 'Plataforma', 'Ligação', 'Formador', 'Lugares na sala', 'Inscritos sala', 'Inscritos online', 'Lista de espera', 'Presentes sala', 'Presentes online', 'Estado'], linhas: sessoes.map(s => { const o = ocupacaoSessao(s, inscricoes); return [s.titulo, MODALIDADE[s.modalidade]?.curto || 'Presencial', new Date(s.inicio).toLocaleString('pt-PT'), new Date(s.fim).toLocaleString('pt-PT'), s.local || '', s.aeroporto || '', PLATAFORMAS[s.plataforma] || '', s.link_online || '', s.formador_nome || '', s.vagas ?? '', o.ocupadas, o.online, o.espera, o.presentesPresencial, o.presentesOnline, ESTADO_SESSAO[s.estado]?.label || s.estado]; }), larguras: [36, 12, 18, 18, 24, 10, 16, 40, 24, 10, 10, 10, 12, 10, 10, 12] },
    { nome: 'Inscrições', cabecalho: ['Sessão', 'Início', 'Nome', 'Email', 'Modo', 'Estado', 'Entrou na ligação', 'Entradas', 'Presença registada em', 'Por', 'Observações'], linhas: inscricoes.filter(i => i.estado !== 'cancelado').map(i => { const s = sessoes.find(x => x.id === i.sessao_id); return [s?.titulo || '', s ? new Date(s.inicio).toLocaleString('pt-PT') : '', i.aluno_nome || '', i.aluno_email, MODO[modoDe(s, i)] || '', ESTADO_INSCRICAO[i.estado]?.label || i.estado, i.entrou_em ? new Date(i.entrou_em).toLocaleString('pt-PT') : '', i.entradas || 0, i.presenca_em ? new Date(i.presenca_em).toLocaleString('pt-PT') : '', i.presenca_por || '', i.observacoes || '']; }), larguras: [36, 18, 30, 34, 12, 14, 18, 8, 20, 26, 40] },
  ]);
  const exportarPdfTab = () => exportarPdf({ base: `Sessoes_${curso.titulo}`, titulo: `Sessões — ${curso.titulo}`, subtitulo: 'Universidade Corporativa', paisagem: true, empresaId: user?.empresa_id, geradoPor: user?.email,
    seccoes: [{ titulo: 'Agenda', colunas: [{ label: 'Sessão', width: 60 }, { label: 'Modalidade', width: 22 }, { label: 'Quando', width: 56 }, { label: 'Local / plataforma', width: 40 }, { label: 'Formador', width: 36 }, { label: 'Sala', width: 18, align: 'right' }, { label: 'Online', width: 18, align: 'right' }, { label: 'Presentes', width: 20, align: 'right' }, { label: 'Estado', width: 20 }], linhas: sessoes.map(s => { const o = ocupacaoSessao(s, inscricoes); return [s.titulo, MODALIDADE[s.modalidade]?.curto || 'Presencial', fmtPeriodoSessao(s), [localTexto(s), PLATAFORMAS[s.plataforma]].filter(Boolean).join(' · '), s.formador_nome || '', `${o.ocupadas}${o.vagas != null ? `/${o.vagas}` : ''}`, o.online, o.presentes, ESTADO_SESSAO[s.estado]?.label || s.estado]; }), vazio: 'Sem sessões.' }] });

  if (isLoading) return <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-40 w-full" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600 dark:text-slate-400">{sessoes.length === 0 ? 'Sem sessões agendadas (presenciais, online ou híbridas).' : `${sessoes.length} ${sessoes.length === 1 ? 'sessão' : 'sessões'}`}{aulasPresenciais.length > 0 && ` · ${aulasPresenciais.length} ${aulasPresenciais.length === 1 ? 'aula presencial' : 'aulas presenciais'} no curso`}</p>
        <div className="flex flex-wrap items-center gap-2">
          <BotoesExportar onExcel={exportarXlsx} onPdf={exportarPdfTab} disabled={sessoes.length === 0} />
          {editavel && <Button size="sm" onClick={() => setForm({})}><CalendarPlus className="h-4 w-4" aria-hidden="true" />Nova sessão</Button>}
        </div>
      </div>
      {aulasPresenciais.length === 0 && <p role="status" className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">Dica: crie uma aula do tipo "Sessão presencial" no conteúdo e associe-a à sessão — a presença marcada aqui conclui essa aula automaticamente.</p>}

      <Card className="dark:border-slate-800 dark:bg-slate-900">
        <CardContent className="p-0">
          {sessoes.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center"><CalendarCheck className="h-8 w-8 text-slate-300" aria-hidden="true" /><p className="text-sm text-slate-500 dark:text-slate-400">Agende a primeira sessão: presencial, online (Teams/Meet) ou híbrida — data, local ou ligação, formador e lugares. Os alunos inscrevem-se na página do curso e recebem o convite por email.</p></div>
          ) : (
            <div className="overflow-x-auto"><Table>
              <TableHeader><TableRow><TableHead>Sessão</TableHead><TableHead>Quando</TableHead><TableHead>Formador</TableHead><TableHead className="text-right">Sala</TableHead><TableHead className="text-right">Online</TableHead><TableHead className="text-right">Presentes</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Acções</TableHead></TableRow></TableHeader>
              <TableBody>{sessoes.map(s => {
                const o = ocupacaoSessao(s, inscricoes);
                const fase = faseSessao(s);
                const aulaLig = aulasPresenciais.find(a => a.id === s.aula_id);
                const mod = MODALIDADE[s.modalidade] || MODALIDADE.presencial;
                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <p className="flex flex-wrap items-center gap-2 font-medium text-slate-900 dark:text-slate-100">{s.titulo}<Badge className={cn('border-0', mod.cor)}>{s.modalidade !== 'presencial' && <Video className="mr-1 h-3 w-3" aria-hidden="true" />}{mod.curto}</Badge></p>
                      <p className="text-xs text-slate-500">{[localTexto(s), s.modalidade !== 'presencial' ? (PLATAFORMAS[s.plataforma] || 'videochamada') + (temLink(s) ? '' : ' · SEM LIGAÇÃO') : ''].filter(Boolean).join(' · ')}{aulaLig ? ` · conclui "${aulaLig.titulo}"` : ''}{Array.isArray(s.materiais) && s.materiais.length ? ` · ${s.materiais.length} ${s.materiais.length === 1 ? 'material' : 'materiais'}` : ''}</p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{fmtPeriodoSessao(s)}<p className="text-xs text-slate-500">{fmtMinutos(duracaoSessaoMin(s))}{fase === 'a_decorrer' ? ' · a decorrer' : ''}</p></TableCell>
                    <TableCell className="text-sm">{s.formador_nome || <span className="text-slate-400">—</span>}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.modalidade === 'online' ? <span className="text-slate-400">—</span> : <span className={cn(o.cheia && 'font-semibold text-amber-700')}>{o.ocupadas}{o.vagas != null ? `/${o.vagas}` : ''}</span>}{o.espera > 0 && <p className="text-xs text-amber-700">+{o.espera} em espera</p>}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.modalidade === 'presencial' ? <span className="text-slate-400">—</span> : o.online}</TableCell>
                    <TableCell className="text-right tabular-nums">{o.presentes}{s.modalidade === 'hibrida' && o.presentes > 0 ? <p className="text-xs text-slate-500">{o.presentesPresencial} sala · {o.presentesOnline} online</p> : null}</TableCell>
                    <TableCell><Badge className={cn('border-0', ESTADO_SESSAO[s.estado]?.cor)}>{ESTADO_SESSAO[s.estado]?.label}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="outline" size="sm" onClick={() => setPresencas(s)}><Users className="h-4 w-4" aria-hidden="true" />Presenças</Button>
                        {editavel && <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Convocar inscritos de ${s.titulo}`} title="Enviar convocatória por email aos inscritos" disabled={busy === s.id || s.estado !== 'agendada'} onClick={() => convocar(s)}><Mail className="h-4 w-4" /></Button>}
                        {editavel && <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Editar ${s.titulo}`} onClick={() => setForm(s)}><Pencil className="h-4 w-4" /></Button>}
                        {editavel && s.estado === 'agendada' && fase !== 'futura' && <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-700" aria-label={`Marcar ${s.titulo} como realizada`} title="Marcar como realizada" disabled={busy === s.id} onClick={() => setConfirm({ tipo: 'realizada', sessao: s })}><CalendarCheck className="h-4 w-4" /></Button>}
                        {editavel && s.estado === 'agendada' && <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-700" aria-label={`Cancelar ${s.titulo}`} title="Cancelar a sessão (avisa os inscritos)" disabled={busy === s.id} onClick={() => setConfirm({ tipo: 'cancelar', sessao: s })}><Ban className="h-4 w-4" /></Button>}
                        {editavel && <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" aria-label={`Eliminar ${s.titulo}`} disabled={busy === s.id} onClick={() => setConfirm({ tipo: 'eliminar', sessao: s })}><Trash2 className="h-4 w-4" /></Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}</TableBody>
            </Table></div>
          )}
        </CardContent>
      </Card>

      {form && <SessaoForm isOpen onClose={() => setForm(null)} curso={curso} sessao={form.id ? form : null} aulasPresenciais={aulasPresenciais} user={user} onSaved={refrescar} />}
      {presencas && <PresencasDialog isOpen onClose={() => setPresencas(null)} sessao={sessoes.find(s => s.id === presencas.id) || presencas} curso={curso} inscricoes={inscricoes.filter(i => i.sessao_id === presencas.id)} matriculas={mats?.matriculas || []} user={user} editavel={editavel} onChanged={refrescar} />}
      <ConfirmModal
        isOpen={!!confirm} onClose={() => setConfirm(null)}
        onConfirm={() => (confirm?.tipo === 'eliminar' ? eliminar(confirm.sessao) : mudarEstado(confirm.sessao, confirm.tipo === 'cancelar' ? 'cancelada' : 'realizada'))}
        title={confirm?.tipo === 'eliminar' ? 'Eliminar sessão?' : confirm?.tipo === 'cancelar' ? 'Cancelar sessão?' : 'Marcar sessão como realizada?'}
        message={confirm?.tipo === 'eliminar' ? `"${confirm.sessao.titulo}" e as respectivas inscrições deixam de aparecer. As presenças já registadas mantêm as aulas concluídas.` : confirm?.tipo === 'cancelar' ? `Os inscritos em "${confirm?.sessao.titulo}" recebem um email a avisar do cancelamento.` : `Depois de realizada, a sessão deixa de aceitar inscrições. Confirme antes as presenças no botão "Presenças".`}
        confirmText={confirm?.tipo === 'eliminar' ? 'Eliminar' : confirm?.tipo === 'cancelar' ? 'Cancelar sessão' : 'Marcar realizada'} variant={confirm?.tipo === 'realizada' ? 'default' : 'destructive'}
      />
    </div>
  );
}

// Envia convocatória/lembrete/cancelamento (individual, só @sga.co.ao chega) com convite .ics e regista em notificacao_formacao.
export async function enviarEmails({ sessao, curso, alvos, tipo, por, mensagem = '' }) {
  const baseUrl = await getPublicBaseUrl().catch(() => '');
  const ics = icsBase64(icsSessao({ sessao, curso, cancelar: tipo === 'cancelada', organizadorEmail: sessao.formador_email && ENTREGAVEL.test(sessao.formador_email) ? sessao.formador_email : 'formacao@sga.co.ao' }));
  const attachments = [{ filename: tipo === 'cancelada' ? 'sessao-cancelada.ics' : 'convite-sessao.ics', content: ics, contentType: 'text/calendar; charset=utf-8; method=' + (tipo === 'cancelada' ? 'CANCEL' : 'REQUEST') }];
  let entregues = 0, naoEntregues = 0;
  for (const i of alvos) {
    const dest = String(i.aluno_email || '').toLowerCase();
    const { subject, html } = textoConvocatoria({ sessao, curso, nome: i.aluno_nome, tipo: i.estado === 'lista_espera' && tipo === 'convocatoria' ? 'lista_espera' : tipo, baseUrl, mensagem, modo: modoDe(sessao, i) });
    const entregue = ENTREGAVEL.test(dest);
    if (entregue) { try { await sendEmailDirect({ to: dest, subject, html, attachments }); entregues++; } catch { naoEntregues++; } } else naoEntregues++;
    await NotificacaoFormacao.create({ tipo: `sessao_${tipo}`, chave: `sessao_${tipo}:${sessao.id}:${dest}:${Date.now()}`, destinatario: dest, curso_id: curso.id, matricula_id: i.matricula_id || null, entregue, detalhe: { por: por || null, sessao_id: sessao.id, sessao: sessao.titulo, assunto: subject } }).catch(() => {});
  }
  return { entregues, naoEntregues };
}

// ── Formulário de sessão ──────────────────────────────────────────────────────
function SessaoForm({ isOpen, onClose, curso, sessao, aulasPresenciais, user, onSaved }) {
  const { data: users = [] } = useUtilizadoresComPerfis();
  const { data: aeroportosUc = [] } = useAeroportosUc(); const aeroportos = aeroportosUc.map(a => ({ codigo_icao: a.codigo, nome: a.nome }));
  const instrutores = users.filter(ehInstrutor);
  const [f, setF] = useState(() => ({
    titulo: sessao?.titulo || (aulasPresenciais[0]?.titulo || ''), descricao: sessao?.descricao || '', aula_id: sessao?.aula_id || (aulasPresenciais.length === 1 ? aulasPresenciais[0].id : ''),
    modalidade: sessao?.modalidade || 'presencial', plataforma: sessao?.plataforma || 'teams', link_online: sessao?.link_online || '',
    inicio: paraInputLocal(sessao?.inicio), fim: paraInputLocal(sessao?.fim), local: sessao?.local || '', aeroporto: sessao?.aeroporto || '',
    formador_email: sessao?.formador_email || curso.instrutor_email || '', formador_nome: sessao?.formador_nome || curso.instrutor_nome || '',
    vagas: sessao?.vagas ?? '', notas: sessao?.notas || '', materiais: Array.isArray(sessao?.materiais) ? sessao.materiais : [],
  }));
  const [aGuardar, setAGuardar] = useState(false);
  const [erro, setErro] = useState('');
  const [envio, setEnvio] = useState(null);
  const fileRef = useRef(null);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const escolherFormador = (email) => { const u = instrutores.find(x => String(x.email).toLowerCase() === String(email).toLowerCase()); setF(x => ({ ...x, formador_email: email, formador_nome: u ? (u.full_name || u.email) : x.formador_nome })); };
  const carregarMaterial = async (e) => {
    const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
    setEnvio({ pct: 0 });
    try { const r = await uploadGrande({ file, kind: 'material', onProgress: (pct) => setEnvio({ pct }) }); setF(x => ({ ...x, materiais: [...x.materiais, { nome: file.name, url: r.url, tamanho: r.size || file.size }] })); }
    catch (err) { setErro(err?.message || String(err)); }
    finally { setEnvio(null); }
  };
  const submeter = async (e) => {
    e.preventDefault();
    const inicio = deInputLocal(f.inicio), fim = deInputLocal(f.fim);
    if (!f.titulo.trim()) { setErro('Indique o título da sessão.'); return; }
    if (!inicio || !fim) { setErro('Indique o início e o fim.'); return; }
    if (new Date(fim) <= new Date(inicio)) { setErro('O fim tem de ser depois do início.'); return; }
    if (f.vagas !== '' && (!Number.isInteger(Number(f.vagas)) || Number(f.vagas) < 1)) { setErro('Os lugares têm de ser um número inteiro (ou vazio = sem limite).'); return; }
    const link = f.link_online.trim();
    if (f.modalidade !== 'presencial' && link && !/^https?:\/\//i.test(link)) { setErro('A ligação da sessão online tem de começar por https://'); return; }
    setAGuardar(true); setErro('');
    const payload = { curso_id: curso.id, aula_id: f.aula_id || null, titulo: f.titulo.trim(), descricao: f.descricao.trim() || null, inicio, fim, modalidade: f.modalidade, plataforma: f.modalidade === 'presencial' ? null : f.plataforma, link_online: f.modalidade === 'presencial' ? null : (link || null), local: f.modalidade === 'online' ? null : (f.local.trim() || null), aeroporto: f.aeroporto || null, formador_email: f.formador_email || null, formador_nome: f.formador_nome.trim() || null, vagas: f.modalidade === 'online' || f.vagas === '' ? null : Number(f.vagas), notas: f.notas.trim() || null, materiais: f.materiais, updated_by: user?.email || null };
    try {
      if (sessao) await SessaoFormacao.update(sessao.id, payload);
      else await SessaoFormacao.create({ ...payload, estado: 'agendada', empresa_id: user?.empresa_id || null, created_by: user?.email || null });
      await onSaved?.(); onClose();
    } catch (err) { setErro(err?.message || String(err)); }
    finally { setAGuardar(false); }
  };
  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o && !aGuardar) onClose(); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={submeter} className="space-y-4">
          <DialogHeader><DialogTitle>{sessao ? 'Editar sessão' : 'Nova sessão'}</DialogTitle><DialogDescription>Presencial, online (Teams/Meet) ou híbrida. Os alunos inscritos no curso vêem a sessão na página do curso, inscrevem-se e recebem o convite por email (com ficheiro de calendário); a presença conclui a aula associada.</DialogDescription></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="sf-titulo">Título <span className="text-red-600">*</span></Label><Input id="sf-titulo" value={f.titulo} onChange={(e) => set('titulo', e.target.value)} required autoFocus /></div>
            <div className="space-y-1.5"><Label>Modalidade</Label><Select value={f.modalidade} onValueChange={(v) => set('modalidade', v)} searchable={false} options={Object.entries(MODALIDADE).map(([k, m]) => ({ value: k, label: m.label }))} /></div>
            {f.modalidade !== 'presencial' ? (
              <div className="space-y-1.5"><Label>Plataforma</Label><Select value={f.plataforma} onValueChange={(v) => set('plataforma', v)} searchable={false} options={Object.entries(PLATAFORMAS).map(([k, l]) => ({ value: k, label: l }))} /></div>
            ) : <div className="hidden sm:block" />}
            {f.modalidade !== 'presencial' && (
              <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="sf-link">Ligação da videochamada</Label><Input id="sf-link" type="url" value={f.link_online} onChange={(e) => set('link_online', e.target.value)} placeholder="https://teams.microsoft.com/l/meetup-join/… ou https://meet.google.com/…" /><p className="text-xs text-slate-500">Crie a reunião no Teams/Meet e cole aqui a ligação. Vai no email de convocatória e aparece aos inscritos 30 min antes; cada entrada fica registada como evidência de participação.</p></div>
            )}
            <div className="space-y-1.5"><Label htmlFor="sf-inicio">Início <span className="text-red-600">*</span></Label><Input id="sf-inicio" type="datetime-local" value={f.inicio} onChange={(e) => set('inicio', e.target.value)} required /></div>
            <div className="space-y-1.5"><Label htmlFor="sf-fim">Fim <span className="text-red-600">*</span></Label><Input id="sf-fim" type="datetime-local" value={f.fim} onChange={(e) => set('fim', e.target.value)} required /></div>
            {f.modalidade !== 'online' && <div className="space-y-1.5"><Label htmlFor="sf-local">Local</Label><Input id="sf-local" value={f.local} onChange={(e) => set('local', e.target.value)} placeholder="Sala de formação, hangar, pátio…" /></div>}
            <div className="space-y-1.5"><Label>Aeroporto</Label><Select value={f.aeroporto} onValueChange={(v) => set('aeroporto', v)} placeholder="—" options={[{ value: '', label: '— sem aeroporto —' }, ...aeroportos.map(a => ({ value: a.codigo_icao, label: `${a.codigo_icao} · ${a.nome}` }))]} /></div>
            <div className="space-y-1.5"><Label>Formador</Label><Select value={f.formador_email} onValueChange={escolherFormador} placeholder="Escolher instrutor" options={[{ value: '', label: '— indicar à mão —' }, ...instrutores.map(u => ({ value: u.email, label: u.full_name || u.email }))]} /></div>
            <div className="space-y-1.5"><Label htmlFor="sf-formador">Nome do formador</Label><Input id="sf-formador" value={f.formador_nome} onChange={(e) => set('formador_nome', e.target.value)} placeholder="Como aparece no email e na folha de presenças" /></div>
            {f.modalidade !== 'online' ? <div className="space-y-1.5"><Label htmlFor="sf-vagas">Lugares na sala</Label><Input id="sf-vagas" type="number" min="1" value={f.vagas} onChange={(e) => set('vagas', e.target.value)} placeholder="Sem limite" /><p className="text-xs text-slate-500">{f.modalidade === 'hibrida' ? 'Só limita quem participa presencialmente; online não tem limite.' : 'Além dos lugares, os alunos ficam em lista de espera.'}</p></div> : <div className="hidden sm:block" />}
            <div className="space-y-1.5"><Label>Aula presencial que a presença conclui</Label><Select value={f.aula_id} onValueChange={(v) => set('aula_id', v)} placeholder="Nenhuma" options={[{ value: '', label: '— nenhuma —' }, ...aulasPresenciais.map(a => ({ value: a.id, label: a.titulo }))]} /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="sf-desc">Descrição / programa</Label><Textarea id="sf-desc" rows={3} value={f.descricao} onChange={(e) => set('descricao', e.target.value)} placeholder="Objectivos, o que levar, ponto de encontro…" /></div>
            <div className="space-y-1.5 sm:col-span-2">
              <div className="flex items-center justify-between"><Label>Materiais da sessão</Label><Button type="button" variant="outline" size="sm" disabled={!!envio} onClick={() => fileRef.current?.click()}>{envio ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Paperclip className="h-4 w-4" aria-hidden="true" />}{envio ? `A enviar… ${envio.pct}%` : 'Adicionar ficheiro'}</Button></div>
              <input ref={fileRef} type="file" accept={ACCEPT_MATERIAL} className="hidden" onChange={carregarMaterial} aria-label="Carregar material da sessão" />
              {f.materiais.length > 0 && <ul className="divide-y rounded-md border dark:divide-slate-800 dark:border-slate-700">{f.materiais.map((m, i) => <li key={m.url || i} className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm"><span className="truncate">{m.nome || m.url}{m.tamanho ? <span className="ml-2 text-xs text-slate-500">{fmtTamanho(m.tamanho)}</span> : null}</span><Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-600" aria-label={`Remover ${m.nome || ''}`} onClick={() => setF(x => ({ ...x, materiais: x.materiais.filter((_, k) => k !== i) }))}><X className="h-4 w-4" /></Button></li>)}</ul>}
              <p className="text-xs text-slate-500">Os inscritos podem descarregar os materiais na página do curso (apresentação, exercícios, checklist).</p>
            </div>
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="sf-notas">Notas internas (só gestores)</Label><Textarea id="sf-notas" rows={2} value={f.notas} onChange={(e) => set('notas', e.target.value)} /></div>
          </div>
          {erro && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{erro}</p>}
          <DialogFooter><Button type="button" variant="outline" onClick={onClose} disabled={aGuardar}>Cancelar</Button><Button type="submit" disabled={aGuardar || !!envio}>{aGuardar && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}{sessao ? 'Guardar' : 'Agendar sessão'}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Presenças / inscritos ─────────────────────────────────────────────────────
function PresencasDialog({ isOpen, onClose, sessao, curso, inscricoes, matriculas, user, editavel, onChanged }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(null);
  const [adicionar, setAdicionar] = useState(false);
  const [sel, setSel] = useState({});
  const [busca, setBusca] = useState('');
  const [modoNovo, setModoNovo] = useState(sessao.modalidade === 'online' ? 'online' : 'presencial');
  const activas = inscricoes.filter(i => i.estado !== 'cancelado').sort((a, b) => (modoDe(sessao, a) === modoDe(sessao, b) ? 0 : modoDe(sessao, a) === 'presencial' ? -1 : 1) || String(a.aluno_nome || a.aluno_email).localeCompare(String(b.aluno_nome || b.aluno_email)));
  const o = ocupacaoSessao(sessao, inscricoes);
  const hibrida = sessao.modalidade === 'hibrida';
  const jaInscritos = new Set(activas.map(i => String(i.aluno_email).toLowerCase()));
  const q = busca.trim().toLowerCase();
  const candidatos = matriculas.filter(m => m.estado !== 'cancelado' && !jaInscritos.has(String(m.aluno_email).toLowerCase())).filter(m => !q || [m.aluno_nome, m.aluno_email].some(v => String(v || '').toLowerCase().includes(q)));
  const nSel = Object.values(sel).filter(Boolean).length;

  const marcar = async (i, estado) => {
    setBusy(i.id);
    try { const { error } = await supabase.rpc('marcar_presenca', { p_inscricao: i.id, p_estado: estado }); if (error) throw new Error(error.message); await onChanged?.(); }
    catch (e) { toast({ title: 'Não foi possível registar', description: e?.message || String(e), variant: 'destructive' }); }
    finally { setBusy(null); }
  };
  const marcarTodos = async (estado) => {
    setBusy('todos');
    try { for (const i of activas.filter(x => x.estado === 'inscrito')) { const { error } = await supabase.rpc('marcar_presenca', { p_inscricao: i.id, p_estado: estado }); if (error) throw new Error(error.message); } await onChanged?.(); toast({ title: estado === 'presente' ? 'Todos os inscritos marcados como presentes' : 'Todos os inscritos marcados como ausentes' }); }
    catch (e) { toast({ title: 'Não foi possível registar', description: e?.message || String(e), variant: 'destructive' }); }
    finally { setBusy(null); }
  };
  const remover = async (i) => {
    setBusy(i.id);
    try { const { error } = await supabase.rpc('cancelar_inscricao_sessao', { p_inscricao: i.id }); if (error) throw new Error(error.message); await onChanged?.(); }
    catch (e) { toast({ title: 'Não foi possível remover', description: e?.message || String(e), variant: 'destructive' }); }
    finally { setBusy(null); }
  };
  const adicionarSel = async () => {
    const escolhidos = matriculas.filter(m => sel[m.id]);
    if (!escolhidos.length) return;
    setBusy('add');
    try {
      let ocupadas = o.ocupadas;
      const modo = sessao.modalidade === 'online' ? 'online' : hibrida ? modoNovo : 'presencial';
      const linhas = escolhidos.map(m => { const estado = modo === 'online' || sessao.vagas == null || ocupadas < sessao.vagas ? 'inscrito' : 'lista_espera'; if (estado === 'inscrito' && modo === 'presencial') ocupadas++; return { sessao_id: sessao.id, matricula_id: m.id, aluno_email: String(m.aluno_email).toLowerCase(), aluno_nome: m.aluno_nome || m.aluno_email, estado, origem: 'gestor', modo }; });
      await SessaoInscricao.bulkCreate(linhas);
      await enviarEmails({ sessao, curso, alvos: linhas, tipo: 'convocatoria', por: user?.email }).catch(() => {});
      toast({ title: `${linhas.length} ${linhas.length === 1 ? 'aluno inscrito' : 'alunos inscritos'} na sessão`, description: 'Convocatória enviada por email (só @sga.co.ao).' });
      setSel({}); setAdicionar(false); await onChanged?.();
    } catch (e) { toast({ title: 'Não foi possível inscrever', description: e?.message || String(e), variant: 'destructive' }); }
    finally { setBusy(null); }
  };
  const folhaPresencas = () => {
    const sala = activas.filter(i => modoDe(sessao, i) === 'presencial'), online = activas.filter(i => modoDe(sessao, i) === 'online');
    const cols = (assinatura) => [{ label: '#', width: 8, align: 'right' }, { label: 'Nome', width: 56 }, { label: 'Email', width: 56 }, { label: 'Estado', width: 22 }, assinatura ? { label: 'Assinatura', width: 40 } : { label: 'Entrou na ligação', width: 40 }];
    const seccoes = [];
    if (sala.length || sessao.modalidade !== 'online') seccoes.push({ titulo: `Presencial (${sala.length})`, colunas: cols(true), linhas: sala.map((i, k) => [k + 1, i.aluno_nome || '', i.aluno_email, ESTADO_INSCRICAO[i.estado]?.label || i.estado, '']), vazio: 'Sem inscritos presenciais.' });
    if (online.length || sessao.modalidade !== 'presencial') seccoes.push({ titulo: `Online (${online.length})`, colunas: cols(false), linhas: online.map((i, k) => [k + 1, i.aluno_nome || '', i.aluno_email, ESTADO_INSCRICAO[i.estado]?.label || i.estado, i.entrou_em ? `${new Date(i.entrou_em).toLocaleString('pt-PT')}${i.entradas > 1 ? ` (${i.entradas}×)` : ''}` : '—']), vazio: 'Sem inscritos online.' });
    return exportarPdf({ base: `Folha_presencas_${sessao.titulo}`, titulo: `Folha de presenças — ${sessao.titulo}`, subtitulo: curso.titulo, empresaId: user?.empresa_id, geradoPor: user?.email,
      meta: [`Quando: ${fmtPeriodoSessao(sessao)}`, `Modalidade: ${MODALIDADE[sessao.modalidade]?.label || 'Presencial'}`, `Local: ${localTexto(sessao) || '—'}`, sessao.modalidade !== 'presencial' ? `Plataforma: ${PLATAFORMAS[sessao.plataforma] || '—'}` : '', `Formador: ${sessao.formador_nome || '—'}`, `Presentes: ${o.presentes} (${o.presentesPresencial} sala · ${o.presentesOnline} online)`].filter(Boolean),
      seccoes });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(oo) => { if (!oo && !busy) onClose(); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{sessao.titulo}</DialogTitle>
          <DialogDescription className="flex flex-wrap gap-x-3 gap-y-1"><span>{fmtPeriodoSessao(sessao)}</span><span>{MODALIDADE[sessao.modalidade]?.curto || 'Presencial'}</span>{localTexto(sessao) && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{localTexto(sessao)}</span>}{temLink(sessao) && <a className="inline-flex items-center gap-1 text-teal-700 underline" href={sessao.link_online} target="_blank" rel="noopener noreferrer"><Video className="h-3.5 w-3.5" aria-hidden="true" />{PLATAFORMAS[sessao.plataforma] || 'Ligação'}</a>}{sessao.formador_nome && <span className="inline-flex items-center gap-1"><User className="h-3.5 w-3.5" aria-hidden="true" />{sessao.formador_nome}</span>}<span>{sessao.modalidade === 'online' ? `${o.online} inscritos` : `${o.ocupadas}${o.vagas != null ? `/${o.vagas}` : ''} na sala${hibrida ? ` · ${o.online} online` : ''}`} · {o.presentes} presentes{hibrida && o.presentes ? ` (${o.presentesPresencial} sala · ${o.presentesOnline} online)` : ''}{o.espera ? ` · ${o.espera} em espera` : ''}</span></DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {editavel && <Button size="sm" variant="outline" onClick={() => setAdicionar(a => !a)}><UserPlus className="h-4 w-4" aria-hidden="true" />Adicionar alunos</Button>}
            {editavel && adicionar && hibrida && <div className="w-40"><Select value={modoNovo} onValueChange={setModoNovo} searchable={false} options={[{ value: 'presencial', label: 'Na sala' }, { value: 'online', label: 'Online' }]} /></div>}
            {editavel && activas.some(i => i.estado === 'inscrito') && <Button size="sm" variant="outline" disabled={!!busy} onClick={() => marcarTodos('presente')}><CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />Todos presentes</Button>}
          </div>
          <BotoesExportar onPdf={folhaPresencas} rotuloPdf="Folha de presenças" disabled={activas.length === 0} />
        </div>
        {adicionar && (
          <div className="space-y-2 rounded-md border p-3 dark:border-slate-700">
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Procurar entre os inscritos no curso…" aria-label="Procurar aluno" />
            <div className="max-h-48 space-y-1 overflow-auto">{candidatos.length === 0 ? <p className="text-sm text-slate-500">Todos os inscritos no curso já estão nesta sessão.</p> : candidatos.slice(0, 200).map(m => <label key={m.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"><Checkbox checked={!!sel[m.id]} onCheckedChange={(v) => setSel(s => ({ ...s, [m.id]: !!v }))} /><span className="truncate">{m.aluno_nome || m.aluno_email}</span><span className="truncate text-xs text-slate-500">{m.aluno_email}</span></label>)}</div>
            <div className="flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={() => { setAdicionar(false); setSel({}); }}>Fechar</Button><Button size="sm" disabled={!nSel || busy === 'add'} onClick={adicionarSel}>{busy === 'add' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <UserPlus className="h-4 w-4" aria-hidden="true" />}Inscrever {nSel || ''}</Button></div>
          </div>
        )}
        {activas.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">Ainda ninguém inscrito nesta sessão.</p> : (
          <div className="overflow-x-auto"><Table>
            <TableHeader><TableRow><TableHead>Aluno</TableHead>{sessao.modalidade !== 'presencial' && <TableHead>Modo</TableHead>}<TableHead>Estado</TableHead><TableHead>Registado</TableHead><TableHead className="text-right">Presença</TableHead></TableRow></TableHeader>
            <TableBody>{activas.map(i => (
              <TableRow key={i.id}>
                <TableCell><p className="font-medium text-slate-900 dark:text-slate-100">{i.aluno_nome || i.aluno_email}</p><p className="text-xs text-slate-500">{i.aluno_email}{i.origem === 'gestor' ? ' · inscrito pelo gestor' : ''}</p></TableCell>
                {sessao.modalidade !== 'presencial' && <TableCell className="text-sm">{modoDe(sessao, i) === 'online' ? <span className="inline-flex items-center gap-1"><Video className="h-3.5 w-3.5 text-sky-600" aria-hidden="true" />Online</span> : <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-violet-600" aria-hidden="true" />Sala</span>}{modoDe(sessao, i) === 'online' && <p className={cn('text-xs', i.entrou_em ? 'text-emerald-700' : 'text-slate-400')} title={i.entrou_em ? `Primeira entrada ${new Date(i.entrou_em).toLocaleString('pt-PT')}` : 'Ainda não abriu a ligação'}><LogIn className="mr-1 inline h-3 w-3" aria-hidden="true" />{i.entrou_em ? `entrou ${new Date(i.entrou_em).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}${i.entradas > 1 ? ` (${i.entradas}×)` : ''}` : 'sem entrada'}</p>}</TableCell>}
                <TableCell><Badge className={cn('border-0', ESTADO_INSCRICAO[i.estado]?.cor)}>{ESTADO_INSCRICAO[i.estado]?.label}</Badge></TableCell>
                <TableCell className="text-xs text-slate-500">{i.presenca_em ? `${fmtDataCurta(i.presenca_em)} · ${i.presenca_por || ''}` : '—'}</TableCell>
                <TableCell className="text-right">
                  {editavel && i.estado !== 'lista_espera' && (
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant={i.estado === 'presente' ? 'default' : 'outline'} className={cn(i.estado === 'presente' && 'bg-emerald-600 hover:bg-emerald-600')} disabled={busy === i.id} onClick={() => marcar(i, 'presente')} aria-label={`Marcar ${i.aluno_nome || i.aluno_email} presente`}><CheckCircle2 className="h-4 w-4" aria-hidden="true" />Presente</Button>
                      <Button size="sm" variant={i.estado === 'ausente' ? 'destructive' : 'outline'} disabled={busy === i.id} onClick={() => marcar(i, 'ausente')} aria-label={`Marcar ${i.aluno_nome || i.aluno_email} ausente`}><XCircle className="h-4 w-4" aria-hidden="true" />Ausente</Button>
                      {['presente', 'ausente'].includes(i.estado) && <Button size="icon" variant="ghost" className="h-8 w-8" title="Repor como inscrito" aria-label="Repor como inscrito" disabled={busy === i.id} onClick={() => marcar(i, 'inscrito')}><RotateCcw className="h-4 w-4" /></Button>}
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600" title="Remover da sessão" aria-label={`Remover ${i.aluno_nome || i.aluno_email} da sessão`} disabled={busy === i.id} onClick={() => remover(i)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  )}
                  {editavel && i.estado === 'lista_espera' && <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600" aria-label={`Remover ${i.aluno_nome || i.aluno_email} da lista de espera`} disabled={busy === i.id} onClick={() => remover(i)}><Trash2 className="h-4 w-4" /></Button>}
                </TableCell>
              </TableRow>
            ))}</TableBody>
          </Table></div>
        )}
        <DialogFooter><Button variant="outline" onClick={onClose} disabled={!!busy}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
