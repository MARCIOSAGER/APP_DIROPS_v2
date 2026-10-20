import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { UserPlus, Award, Download, Trash2, Loader2, Search, Users, CheckCircle2, RotateCcw, Mail, Copy, AlertTriangle, KeyRound } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { univAcesso } from '@/universidade/api';
import { emailValido, emailInterno } from '@/lib/universidade';
import { useToast } from '@/components/ui/use-toast';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { Matricula } from '@/entities/Matricula';
import { supabase } from '@/lib/supabaseClient';
import { sendEmailDirect } from '@/functions/sendEmailDirect';
import { useMatriculasCurso, useUtilizadoresAtivos, useAssinantes, useTodosCertificados, useDadosMatriz } from '@/hooks/useGestaoFormacao';
import { emitirCertificado, prepararCertParaPdf } from '@/lib/certificadoEmissao';
import { estadoFormacao, matrizFormacao } from '@/lib/formacaoEstado';
import { ESTADO_MATRICULA, fmtData } from '../formacaoUtils';
import { ChipEstado } from './MatrizFormacao';
import LembreteDialog from './LembreteDialog';
import InscreverEmFaltaDialog from './InscreverEmFaltaDialog';
import BotoesExportar from './BotoesExportar';
import { exportarExcel, exportarPdf, fmtDataCurta, diasTexto } from '@/lib/formacaoExport';

// Alunos inscritos num curso: progresso, emissão de certificado, inscrever/remover.
export default function AlunosTab({ curso, modulos = [], aulas = [], user }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useMatriculasCurso(curso.id);
  const { data: utilizadores = [] } = useUtilizadoresAtivos();
  const { data: assinantes = [] } = useAssinantes();
  const { data: certificados = [] } = useTodosCertificados();
  const { data: dadosMatriz } = useDadosMatriz();
  const [, setParams] = useSearchParams();
  const matriz = useMemo(() => (dadosMatriz ? matrizFormacao(dadosMatriz) : null), [dadosMatriz]);
  const emFaltaCurso = matriz ? matriz.linhas.filter(l => l.celulas.some(c => c.curso.id === curso.id && c.estado === 'em_falta')).length : 0;
  const matriculas = data?.matriculas || [];
  const progresso = data?.progresso || {};
  const total = aulas.length;
  const certPorMatricula = useMemo(() => Object.fromEntries(certificados.filter(c => c.matricula_id && !c.revogado_em).map(c => [c.matricula_id, c])), [certificados]);

  const [inscrever, setInscrever] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [confirmReabrir, setConfirmReabrir] = useState(null);
  const [aTrabalhar, setATrabalhar] = useState(null);
  const [busca, setBusca] = useState('');
  const [lembrete, setLembrete] = useState(null); // alvos do LembreteDialog
  const [emFalta, setEmFalta] = useState(false);

  const reabrir = async () => {
    const m = confirmReabrir; setConfirmReabrir(null); setATrabalhar(m.id);
    try {
      const { error } = await supabase.rpc('reabrir_matricula', { p_matricula: m.id });
      if (error) throw new Error(error.message);
      toast({ title: 'Matrícula reaberta para recertificação', description: `${m.aluno_nome || m.aluno_email} · ciclo ${(m.ciclo || 1) + 1}` });
      await refrescar();
    } catch (e) { toast({ title: 'Não foi possível reabrir', description: e?.message, variant: 'destructive' }); }
    finally { setATrabalhar(null); }
  };

  const refrescar = () => Promise.all([
    qc.invalidateQueries({ queryKey: ['matricula'] }),
    qc.invalidateQueries({ queryKey: ['certificado'] }),
  ]);

  const emitir = async (m) => {
    setATrabalhar(m.id);
    try {
      const cert = await emitirCertificado({ curso, matricula: m, modulos, aulas, assinantes, emitidoPor: user?.email, empresaId: user?.empresa_id });
      toast({ title: 'Certificado emitido', description: `${cert.numero} · ${m.aluno_nome || m.aluno_email}` });
      await refrescar();
    } catch (e) {
      toast({ title: 'Não foi possível emitir o certificado', description: e?.message, variant: 'destructive' });
    } finally {
      setATrabalhar(null);
    }
  };

  const descarregar = async (cert) => {
    setATrabalhar(cert.id);
    try {
      const [{ gerarCertificadoPdf, nomeFicheiroCertificado }, input] = await Promise.all([import('@/lib/certificadoPdf'), prepararCertParaPdf(cert)]);
      (await gerarCertificadoPdf(input)).save(nomeFicheiroCertificado(cert));
    } catch (e) {
      toast({ title: 'Não foi possível gerar o PDF', description: e?.message, variant: 'destructive' });
    } finally {
      setATrabalhar(null);
    }
  };

  const concluirManual = async (m) => {
    setATrabalhar(m.id);
    try {
      await Matricula.update(m.id, { estado: 'concluido', progresso_pct: 100, concluido_em: m.concluido_em || new Date().toISOString() });
      toast({ title: 'Matrícula marcada como concluída' });
      await refrescar();
    } catch (e) {
      toast({ title: 'Não foi possível actualizar', description: e?.message, variant: 'destructive' });
    } finally {
      setATrabalhar(null);
    }
  };

  const remover = async () => {
    const m = confirm; setConfirm(null);
    setATrabalhar(m.id);
    try {
      await Matricula.delete(m.id);
      toast({ title: 'Matrícula removida', description: m.aluno_email });
      await refrescar();
    } catch (e) {
      toast({ title: 'Não foi possível remover', description: e?.message, variant: 'destructive' });
    } finally {
      setATrabalhar(null);
    }
  };

  const q = busca.trim().toLowerCase();
  const lista = matriculas.filter(m => !q || [m.aluno_nome, m.aluno_email].some(v => String(v || '').toLowerCase().includes(q)));
  const nConcluidos = matriculas.filter(m => m.estado === 'concluido').length;
  const alvoLembrete = (m) => ({ curso, matricula: m, email: m.aluno_email, nome: m.aluno_nome });
  const porLembrar = matriculas.filter(m => ['em_curso', 'atrasado', 'expirado', 'a_expirar'].includes(estadoFormacao(curso, m).estado));

  const linhasExport = () => lista.map(m => { const ef = estadoFormacao(curso, m); const cert = certPorMatricula[m.id]; return [m.aluno_nome || '', m.aluno_email, fmtDataCurta(m.created_date), Math.round(Number(m.progresso_pct) || 0), `${(progresso[m.id] || []).length}/${total}`, (ESTADO_MATRICULA[m.estado] || ESTADO_MATRICULA.ativo).label, m.ciclo || 1, m.concluido_em ? fmtDataCurta(m.concluido_em) : '', ef.validoAte ? fmtDataCurta(ef.validoAte) : (m.estado === 'concluido' ? 'sem validade' : ''), ef.validoAte ? diasTexto(ef.validoAte) : '', cert ? cert.numero : '']; });
  const CAB = ['Aluno', 'Email', 'Inscrito em', 'Progresso (%)', 'Aulas', 'Estado', 'Ciclo', 'Concluído em', 'Válido até', 'Dias', 'Certificado'];
  const exportarXlsx = () => exportarExcel(`Alunos_${curso.titulo}`, [{ nome: 'Alunos', cabecalho: CAB, linhas: linhasExport(), larguras: [28, 30, 12, 12, 8, 12, 6, 12, 14, 16, 20] }]);
  const exportarPdfLista = () => exportarPdf({ base: `Alunos_${curso.titulo}`, titulo: `Alunos — ${curso.titulo}`, subtitulo: 'Universidade Corporativa', paisagem: true, empresaId: user?.empresa_id, geradoPor: user?.email,
    meta: [`${lista.length} ${lista.length === 1 ? 'inscrito' : 'inscritos'} · ${nConcluidos} concluídos${curso.validade_meses ? ` · validade ${curso.validade_meses} meses` : ''}`],
    seccoes: [{ colunas: [{ label: 'Aluno', width: 46 }, { label: 'Email', width: 48 }, { label: 'Inscrito', width: 20 }, { label: '%', width: 10, align: 'right' }, { label: 'Aulas', width: 14, align: 'right' }, { label: 'Estado', width: 20 }, { label: 'Ciclo', width: 11, align: 'right' }, { label: 'Concluído', width: 20 }, { label: 'Válido até', width: 22 }, { label: 'Dias', width: 26 }, { label: 'Certificado', width: 32 }], linhas: linhasExport() }] });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4" aria-hidden="true" />{matriculas.length} {matriculas.length === 1 ? 'inscrito' : 'inscritos'}</span>
          <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />{nConcluidos} concluídos</span>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar aluno…" aria-label="Pesquisar aluno" className="w-56 pl-9" />
          </div>
          {emFaltaCurso > 0 && <Button variant="outline" onClick={() => setEmFalta(true)} title="Colaboradores para quem este curso é obrigatório e ainda não estão inscritos"><UserPlus className="h-4 w-4" aria-hidden="true" />Obrigatórios em falta ({emFaltaCurso})</Button>}
          <BotoesExportar onExcel={exportarXlsx} onPdf={exportarPdfLista} disabled={lista.length === 0} size="default" />
          <Button variant="outline" disabled={porLembrar.length === 0} onClick={() => setLembrete(porLembrar.map(alvoLembrete))} title="Lembrete por email a quem tem o curso por concluir ou a certificação a expirar/expirada"><Mail className="h-4 w-4" aria-hidden="true" />Lembrar{porLembrar.length ? ` (${porLembrar.length})` : ''}</Button>
          <Button onClick={() => setInscrever(true)}><UserPlus className="h-4 w-4" aria-hidden="true" />Inscrever alunos</Button>
        </div>
      </div>

      <Card className="dark:border-slate-800 dark:bg-slate-900">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">{[0, 1, 2].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : lista.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Users className="h-8 w-8 text-slate-400" aria-hidden="true" />
              <p className="font-medium text-slate-900 dark:text-slate-100">{matriculas.length === 0 ? 'Ainda não há alunos inscritos' : 'Nenhum aluno corresponde à pesquisa'}</p>
              {matriculas.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">Os alunos podem inscrever-se no catálogo, ou pode inscrevê-los aqui.</p>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Aluno</TableHead>
                    <TableHead>Inscrito em</TableHead>
                    <TableHead className="min-w-[180px]">Progresso</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Concluído em</TableHead>
                    <TableHead>Válido até</TableHead>
                    <TableHead>Dias</TableHead>
                    <TableHead>Certificado</TableHead>
                    <TableHead className="text-right">Acções</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lista.map(m => {
                    const feitas = (progresso[m.id] || []).length;
                    const pct = Math.round(Number(m.progresso_pct) || 0);
                    const est = ESTADO_MATRICULA[m.estado] || ESTADO_MATRICULA.ativo;
                    const cert = certPorMatricula[m.id];
                    const ef = estadoFormacao(curso, m);
                    const ocupado = aTrabalhar === m.id || (cert && aTrabalhar === cert.id);
                    return (
                      <TableRow key={m.id}>
                        <TableCell>
                          <button type="button" className="text-left font-medium text-slate-900 hover:underline dark:text-slate-100" title="Abrir a ficha do aluno" onClick={() => setParams({ aluno: m.aluno_email, curso: curso.id, ctab: 'alunos' })}>{m.aluno_nome || m.aluno_email}</button>
                          {m.aluno_nome && <p className="text-xs text-slate-500 dark:text-slate-400">{m.aluno_email}</p>}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">{fmtData(m.created_date)}{m.versao ? <p className="text-xs text-slate-400" title="Versão do curso em que se inscreveu">v{m.versao}</p> : null}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={pct} className="h-1.5 flex-1" aria-label={`Progresso ${pct}%`} />
                            <span className="w-16 text-right text-xs tabular-nums text-slate-600 dark:text-slate-300">{feitas}/{total} · {pct}%</span>
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="outline" className={est.cls}>{est.label}</Badge>{(m.ciclo || 1) > 1 && <span className="ml-1 text-xs text-slate-400">ciclo {m.ciclo}</span>}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">{m.concluido_em ? fmtData(m.concluido_em) : <span className="text-xs text-slate-400">—</span>}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">{ef.validoAte ? fmtData(ef.validoAte) : <span className="text-xs text-slate-400">{m.estado === 'concluido' ? 'sem validade' : '—'}</span>}</TableCell>
                        <TableCell className="whitespace-nowrap">{ef.validoAte ? <ChipEstado estado={ef.estado} dias={ef.dias} validoAte={ef.validoAte} compacto /> : <span className="text-xs text-slate-400">—</span>}{ef.validoAte && <span className={`ml-1 text-xs tabular-nums ${ef.estado === 'expirado' ? 'text-red-600' : ef.estado === 'a_expirar' ? 'text-amber-600' : 'text-slate-500'}`}>{diasTexto(ef.validoAte)}</span>}</TableCell>
                        <TableCell>
                          {cert ? (
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-slate-700 dark:text-slate-300">{cert.numero}</span>
                              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Descarregar certificado" disabled={ocupado} onClick={() => descarregar(cert)}>
                                {aTrabalhar === cert.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                              </Button>
                            </div>
                          ) : m.estado === 'concluido' ? (
                            <Button variant="outline" size="sm" disabled={ocupado} onClick={() => emitir(m)}>
                              {aTrabalhar === m.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Award className="h-4 w-4" aria-hidden="true" />}Emitir
                            </Button>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-0.5">
                            {['em_curso', 'atrasado', 'expirado', 'a_expirar'].includes(ef.estado) && (
                              <Button variant="ghost" size="sm" onClick={() => setLembrete([alvoLembrete(m)])} title="Enviar lembrete por email">
                                <Mail className="h-4 w-4" aria-hidden="true" />Lembrete
                              </Button>
                            )}
                            {m.estado !== 'concluido' && (
                              <Button variant="ghost" size="sm" disabled={ocupado} onClick={() => concluirManual(m)} title="Marcar como concluído (override do instrutor)">
                                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />Concluir
                              </Button>
                            )}
                            {m.estado === 'concluido' && (
                              <Button variant="ghost" size="sm" disabled={ocupado} onClick={() => setConfirmReabrir(m)} title="Reabrir num novo ciclo (recertificação)">
                                <RotateCcw className="h-4 w-4" aria-hidden="true" />Reabrir
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700" aria-label="Remover matrícula" disabled={ocupado} onClick={() => setConfirm(m)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <InscreverDialog
        isOpen={inscrever}
        onClose={() => setInscrever(false)}
        curso={curso}
        user={user}
        utilizadores={utilizadores}
        jaInscritos={new Set(matriculas.map(m => String(m.aluno_email).toLowerCase()))}
        onDone={async (n) => { toast({ title: n === 1 ? '1 aluno inscrito' : `${n} alunos inscritos` }); await refrescar(); }}
      />
      <LembreteDialog isOpen={!!lembrete} onClose={() => setLembrete(null)} alvos={lembrete || []} user={user} />
      <InscreverEmFaltaDialog isOpen={emFalta} onClose={() => setEmFalta(false)} matriz={matriz} cursoId={curso.id} user={user} onDone={async (n) => { toast({ title: n === 1 ? '1 aluno inscrito' : `${n} alunos inscritos` }); await refrescar(); }} />
      <ConfirmModal
        isOpen={!!confirmReabrir}
        onClose={() => setConfirmReabrir(null)}
        onConfirm={reabrir}
        title="Reabrir para recertificação?"
        confirmText="Reabrir"
        message={`${confirmReabrir?.aluno_nome || confirmReabrir?.aluno_email} volta ao início do curso num novo ciclo. O progresso das aulas é limpo; certificados e tentativas anteriores ficam no histórico.`}
      />
      <ConfirmModal
        isOpen={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={remover}
        variant="destructive"
        title="Remover matrícula?"
        confirmText="Remover"
        message={`${confirm?.aluno_nome || confirm?.aluno_email} perde o acesso ao curso e o progresso registado. O certificado já emitido (se existir) mantém-se válido.`}
      />
    </div>
  );
}

// Linhas "email; Nome" | "email, Nome" | "email Nome" | "email" → [{ email, nome }], com os inválidos à parte.
function lerListaEmails(texto) {
  const ok = [], invalidos = [], vistos = new Set();
  for (const linhaCrua of String(texto || '').split(/\r?\n/)) {
    const linha = linhaCrua.trim(); if (!linha) continue;
    const m = linha.match(/[^\s;,<>"']+@[^\s;,<>"']+/);
    const email = m ? m[0].toLowerCase() : null;
    if (!email || !emailValido(email)) { invalidos.push(linha); continue; }
    if (vistos.has(email)) continue; vistos.add(email);
    const nome = linha.replace(m[0], '').replace(/[;,<>"']/g, ' ').replace(/\s+/g, ' ').trim();
    ok.push({ email, nome: nome || email });
  }
  return { ok, invalidos };
}

// Inscrever alunos: utilizadores do sistema (com conta) e/ou lista de emails; quem não tem conta recebe um convite do portal
// (conta com perfil formando + link para criar a senha) e fica logo inscrito no curso.
function InscreverDialog({ isOpen, onClose, curso, user, utilizadores, jaInscritos, onDone }) {
  const [busca, setBusca] = useState('');
  const [sel, setSel] = useState({});
  const [lista, setLista] = useState('');
  const [convidar, setConvidar] = useState(true);
  const [aGuardar, setAGuardar] = useState(false);
  const [progresso, setProgresso] = useState('');
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState(null);

  const q = busca.trim().toLowerCase();
  const candidatos = utilizadores
    .filter(u => !jaInscritos.has(String(u.email).toLowerCase()))
    .filter(u => !q || [u.full_name, u.email].some(v => String(v || '').toLowerCase().includes(q)))
    .slice(0, 200);
  const nSel = Object.values(sel).filter(Boolean).length;
  const extras = useMemo(() => lerListaEmails(lista), [lista]);
  const contas = useMemo(() => new Map(utilizadores.map(u => [String(u.email).toLowerCase(), u])), [utilizadores]);
  const semConta = extras.ok.filter(x => !contas.has(x.email) && !jaInscritos.has(x.email));
  const total = nSel + extras.ok.filter(x => !jaInscritos.has(x.email)).length;

  const fechar = () => { if (aGuardar) return; setSel({}); setBusca(''); setLista(''); setErro(''); setResultado(null); setProgresso(''); onClose(); };

  const submeter = async () => {
    if (extras.invalidos.length) { setErro(`Linhas inválidas: ${extras.invalidos.slice(0, 3).join(' · ')}${extras.invalidos.length > 3 ? '…' : ''}`); return; }
    const escolhidos = utilizadores.filter(u => sel[u.id]).map(u => ({ email: String(u.email).toLowerCase(), nome: u.full_name || u.email }));
    const porEmail = new Map();
    for (const x of [...escolhidos, ...extras.ok]) if (!jaInscritos.has(x.email) && !porEmail.has(x.email)) porEmail.set(x.email, x);
    const alvos = [...porEmail.values()];
    if (alvos.length === 0) { setErro('Escolha pelo menos um aluno ou indique emails.'); return; }
    const semContaAlvo = alvos.filter(x => !contas.has(x.email));
    if (semContaAlvo.length && !convidar) { setErro(`${semContaAlvo.length} email(s) sem conta: active o convite ou retire-os da lista.`); return; }
    setAGuardar(true); setErro('');
    try {
      // 1) quem não tem conta: convite do portal (cria a conta com perfil formando; o email menciona o curso)
      const convidados = [];
      for (const [i, x] of semContaAlvo.entries()) {
        setProgresso(`A convidar ${i + 1} de ${semContaAlvo.length}…`);
        try {
          const r = await univAcesso('convidar', { email: x.email, nome: x.nome === x.email ? '' : x.nome, perfis: ['formando'], enviar: true, mensagem: `Foi inscrito(a) no curso «${curso.titulo}». Depois de criar a senha, o curso aparece em «A minha formação».` });
          convidados.push({ email: x.email, nome: x.nome, enviado: !!r.envio?.enviado, link: r.link, motivo: r.envio?.motivo });
        } catch (e) { convidados.push({ email: x.email, nome: x.nome, enviado: false, erro: e?.message || String(e) }); }
      }
      const falhados = new Set(convidados.filter(c => c.erro).map(c => c.email));
      const linhas = alvos.filter(x => !falhados.has(x.email)).map(x => ({ aluno_email: x.email, aluno_nome: x.nome }));
      // 2) matrículas (com conta e convidados)
      setProgresso('A inscrever…');
      if (linhas.length) await Matricula.bulkCreate(linhas.map(l => ({ ...l, curso_id: curso.id, estado: 'ativo', progresso_pct: 0, origem: 'gestor', empresa_id: user?.empresa_id || null })));
      // 3) email a quem já tem conta (só @sga.co.ao chega pelo relay); falhas não bloqueiam
      const url = `${window.location.origin}/universidade/formacao?curso=${curso.id}`;
      const html = `<div style="font-family:Segoe UI,Arial,sans-serif;color:#0f172a"><h2 style="margin:0 0 8px">Foi inscrito(a) num curso</h2><p>Foi inscrito(a) no curso <strong>${curso.titulo}</strong> da Universidade Corporativa.${curso.prazo_dias ? ` Tem <strong>${curso.prazo_dias} dias</strong> para o concluir.` : ''}</p><p><a href="${url}" style="display:inline-block;background:#004A99;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Abrir o curso</a></p><p style="color:#64748b;font-size:12px">${url}</p></div>`;
      const comConta = linhas.filter(l => contas.has(l.aluno_email) && emailInterno(l.aluno_email));
      Promise.allSettled(comConta.map(l => sendEmailDirect({ to: l.aluno_email, subject: `[Formação] Foi inscrito no curso "${curso.titulo}"`, html }))).catch(() => {});
      await onDone?.(linhas.length);
      if (convidados.length) setResultado({ inscritos: linhas.length, convidados, avisados: comConta.length });
      else fechar();
    } catch (e) {
      setErro(e?.message || String(e));
    } finally {
      setAGuardar(false); setProgresso('');
    }
  };
  const copiar = async (t) => { try { await navigator.clipboard.writeText(t); } catch { /* */ } };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o) fechar(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        {resultado ? (
          <>
            <DialogHeader><DialogTitle>Inscrição concluída</DialogTitle><DialogDescription>{resultado.inscritos} inscrito(s) no curso · {resultado.avisados} avisado(s) por email · {resultado.convidados.length} convite(s) de acesso.</DialogDescription></DialogHeader>
            <ul className="divide-y rounded-md border text-sm dark:divide-slate-800 dark:border-slate-700">{resultado.convidados.map(c => (
              <li key={c.email} className="space-y-1 p-3">
                <div className="flex items-center gap-2"><KeyRound className="h-4 w-4 shrink-0 text-violet-600" aria-hidden="true" /><span className="min-w-0 flex-1 truncate font-medium text-slate-900 dark:text-slate-100">{c.nome !== c.email ? `${c.nome} · ` : ''}{c.email}</span>{c.erro ? <span className="text-xs text-red-600">falhou</span> : c.enviado ? <span className="text-xs text-emerald-700 dark:text-emerald-300">convite enviado</span> : <span className="text-xs text-amber-700 dark:text-amber-300">email não enviado</span>}</div>
                {c.erro && <p className="text-xs text-red-600">{c.erro}</p>}
                {!c.erro && !c.enviado && <p className="text-xs text-slate-500">{c.motivo}. Entregue o link por outro meio:</p>}
                {!c.erro && !c.enviado && c.link && <div className="flex gap-2"><Input readOnly value={c.link} onFocus={e => e.target.select()} className="h-8 font-mono text-xs" /><Button size="sm" variant="outline" onClick={() => copiar(c.link)}><Copy className="h-4 w-4" aria-hidden="true" />Copiar</Button></div>}
              </li>
            ))}</ul>
            <DialogFooter><Button onClick={fechar}>Fechar</Button></DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Inscrever alunos</DialogTitle>
              <DialogDescription>Escolha utilizadores do sistema e/ou cole uma lista de emails. Quem já está inscrito não aparece nem é repetido.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {utilizadores.length > 0 ? (
                <>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                    <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar por nome ou email…" aria-label="Pesquisar utilizadores" className="pl-9" />
                  </div>
                  <div className="max-h-56 overflow-y-auto rounded-md border dark:border-slate-700">
                    {candidatos.length === 0 ? (
                      <p className="p-4 text-center text-sm text-slate-500">Nenhum utilizador disponível.</p>
                    ) : candidatos.map(u => (
                      <label key={u.id} className="flex cursor-pointer items-center gap-3 border-b px-3 py-2 last:border-b-0 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
                        <Checkbox checked={!!sel[u.id]} onCheckedChange={(v) => setSel(x => ({ ...x, [u.id]: !!v }))} aria-label={`Seleccionar ${u.full_name || u.email}`} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-slate-900 dark:text-slate-100">{u.full_name || u.email}</span>
                          {u.full_name && <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{u.email}</span>}
                        </span>
                      </label>
                    ))}
                  </div>
                  {q && candidatos.length > 0 && <Button variant="ghost" size="sm" onClick={() => setSel(x => ({ ...x, ...Object.fromEntries(candidatos.map(u => [u.id, true])) }))}>Seleccionar os {candidatos.length} da pesquisa</Button>}
                </>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">A lista de utilizadores não está disponível para o seu perfil. Inscreva por email.</p>
              )}
              <div className="space-y-2 rounded-md border p-3 dark:border-slate-700">
                <Label htmlFor="ins-lista" className="text-xs uppercase tracking-wide text-slate-500">Ou por lista de emails (um por linha: email; nome)</Label>
                <Textarea id="ins-lista" rows={4} value={lista} onChange={(e) => setLista(e.target.value)} placeholder={'ana.silva@sga.co.ao; Ana Silva\njoao.mateus@empresa.com; João Mateus'} className="font-mono text-xs" />
                {extras.invalidos.length > 0 && <p className="flex items-center gap-1.5 text-xs text-red-600"><AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />Linha(s) sem email válido: {extras.invalidos.slice(0, 3).join(' · ')}</p>}
                {extras.ok.length > 0 && <p className="text-xs text-slate-500">{extras.ok.length} email(s) · {extras.ok.filter(x => contas.has(x.email)).length} com conta · {semConta.length} sem conta{extras.ok.filter(x => jaInscritos.has(x.email)).length ? ` · ${extras.ok.filter(x => jaInscritos.has(x.email)).length} já inscrito(s)` : ''}</p>}
                <label className="flex items-start gap-3 pt-1 text-sm"><Switch checked={convidar} onCheckedChange={setConvidar} className="mt-0.5" /><span>Quem não tiver conta recebe um <strong>convite</strong> para criar a senha (perfil formando) e fica logo inscrito no curso.<span className="block text-xs text-slate-500">Emails fora da SGA não recebem o email pelo relay: o link do convite aparece aqui para copiar e enviar por outro meio.</span></span></label>
              </div>
              {erro && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{erro}</p>}
              {progresso && <p className="text-xs text-slate-500">{progresso}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={fechar} disabled={aGuardar}>Cancelar</Button>
              <Button onClick={submeter} disabled={aGuardar || total === 0}>
                {aGuardar && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Inscrever{total > 0 ? ` (${total})` : ''}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
