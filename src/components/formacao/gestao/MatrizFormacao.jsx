import { PERFIS_UNIVERSIDADE, PERFIL_UC_LABEL, perfisUcTexto } from '@/lib/universidade';
import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import Select from '@/components/ui/select';
import { Search, Download, Mail, Loader2, RefreshCw, Grid3x3, UserPlus } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { useDadosMatriz } from '@/hooks/useGestaoFormacao';
import { matrizFormacao, alertasFormacao, ESTADOS } from '@/lib/formacaoEstado';
import { RelatorioDestinatario } from '@/entities/RelatorioDestinatario';
import { sendEmailDirect } from '@/functions/sendEmailDirect';
import { fmtData } from '../formacaoUtils';
import InscreverEmFaltaDialog from './InscreverEmFaltaDialog';
import BotoesExportar from './BotoesExportar';
import { exportarPdf, fmtDataCurta, diasTexto } from '@/lib/formacaoExport';

const CHIP = {
  red: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-200',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200',
  blue: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200',
  emerald: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200',
  slate: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};
export function ChipEstado({ estado, dias, validoAte, pct, compacto = false }) {
  const e = ESTADOS[estado] || ESTADOS.nao_inscrito;
  let extra = '';
  if (estado === 'a_expirar' && dias != null) extra = ` · ${dias} d`;
  else if (estado === 'valido' && validoAte) extra = ` · ${fmtData(validoAte)}`;
  else if (estado === 'expirado' && validoAte) extra = ` · ${fmtData(validoAte)}`;
  else if ((estado === 'em_curso' || estado === 'atrasado') && pct != null) extra = ` · ${pct}%`;
  return <span className={cn('inline-flex max-w-full items-center truncate rounded-md px-2 py-0.5 text-xs font-medium', CHIP[e.cor])} title={e.descricao}>{estado === 'nao_inscrito' && compacto ? '—' : e.label}{compacto ? '' : extra}</span>;
}

// Matriz colaborador × curso com filtros, KPIs, Excel e envio por email.
export default function MatrizFormacao({ user, onAbrirAluno }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading, isFetching } = useDadosMatriz();
  const [busca, setBusca] = useState('');
  const [perfil, setPerfil] = useState('todos');
  const [estado, setEstado] = useState('todos');
  const [soObrig, setSoObrig] = useState(false);
  const [soPendentes, setSoPendentes] = useState(false);
  const [email, setEmail] = useState(false);
  const [emFalta, setEmFalta] = useState(false);

  const matriz = useMemo(() => (data ? matrizFormacao(data) : null), [data]);
  const perfis = PERFIS_UNIVERSIDADE;
  const cursosVisiveis = useMemo(() => {
    if (!matriz) return [];
    return matriz.porCurso.filter(c => !soObrig || c.obrigatorioPara > 0).map(c => c.curso);
  }, [matriz, soObrig]);
  const idxCurso = useMemo(() => Object.fromEntries((data?.cursos || []).map((c, i) => [c.id, i])), [data]);
  const linhas = useMemo(() => {
    if (!matriz) return [];
    const q = busca.trim().toLowerCase();
    return matriz.linhas.filter(l => {
      if (q && ![l.user.full_name, l.user.email].some(v => String(v || '').toLowerCase().includes(q))) return false;
      if (perfil !== 'todos' && !(l.user.perfis || []).includes(perfil)) return false;
      const cels = l.celulas.filter(c => cursosVisiveis.some(cv => cv.id === c.curso.id));
      if (estado !== 'todos' && !cels.some(c => c.estado === estado)) return false;
      if (soPendentes && !cels.some(c => ['em_falta', 'expirado', 'a_expirar', 'atrasado'].includes(c.estado))) return false;
      return true;
    });
  }, [matriz, busca, perfil, estado, soPendentes, cursosVisiveis]);

  const totais = matriz?.totais || {};
  const kpis = [
    ['Colaboradores', matriz?.linhas.length ?? 0, 'text-slate-900 dark:text-slate-100'],
    ['Em falta', totais.em_falta || 0, 'text-red-600'],
    ['Expirados', totais.expirado || 0, 'text-red-600'],
    ['A expirar', totais.a_expirar || 0, 'text-amber-600'],
    ['Em curso', (totais.em_curso || 0) + (totais.atrasado || 0), 'text-blue-600'],
    ['Válidos', (totais.valido || 0) + (totais.concluido || 0), 'text-emerald-600'],
  ];

  const exportar = async () => {
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();
      const cab = ['Colaborador', 'Email', 'Perfis', 'Pendências', ...cursosVisiveis.map(c => c.titulo)];
      const rows = linhas.map(l => [l.user.full_name || '', l.user.email, perfisUcTexto(l.user.perfis), l.pendencias,
        ...cursosVisiveis.map(cv => { const c = l.celulas[idxCurso[cv.id]]; const e = ESTADOS[c.estado]?.label || c.estado; return c.validoAte ? `${e} (até ${fmtData(c.validoAte)}, ${diasTexto(c.validoAte)})` : (c.matricula && c.estado !== 'nao_inscrito' && c.estado !== 'em_falta' ? `${e} ${Math.round(Number(c.matricula.progresso_pct) || 0)}%` : e); })]);
      const ws = XLSX.utils.aoa_to_sheet([cab, ...rows]);
      ws['!cols'] = [{ wch: 28 }, { wch: 30 }, { wch: 22 }, { wch: 10 }, ...cursosVisiveis.map(() => ({ wch: 26 }))];
      XLSX.utils.book_append_sheet(wb, ws, 'Matriz');
      const al = alertasFormacao(matriz);
      const aoa = [['Tipo', 'Colaborador', 'Email', 'Curso', 'Dias', 'Válido até']];
      for (const [tipo, itens] of Object.entries(al)) for (const i of itens) aoa.push([ESTADOS[tipo]?.label || tipo, i.user.full_name || '', i.user.email, i.curso.titulo, i.dias ?? '', fmtData(i.validoAte)]);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Alertas');
      XLSX.writeFile(wb, `Matriz_Formacao_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) { toast({ title: 'Não foi possível exportar', description: e?.message, variant: 'destructive' }); }
  };

  const exportarPdfMatriz = () => {
    const t = matriz.totais;
    const larg = Math.max(24, Math.floor(180 / Math.max(1, cursosVisiveis.length)));
    return exportarPdf({ base: 'Matriz_Formacao', titulo: 'Matriz de formação', subtitulo: 'Colaborador × curso', paisagem: true, empresaId: user?.empresa_id, geradoPor: user?.email,
      meta: [`${linhas.length} colaboradores · ${cursosVisiveis.length} cursos${soObrig ? ' (só obrigatórios)' : ''}${perfil !== 'todos' ? ` · perfil ${perfil}` : ''}`],
      seccoes: [
        { titulo: 'Resumo', pares: [{ label: 'Em falta', value: String(t.em_falta || 0) }, { label: 'Expirados', value: String(t.expirado || 0) }, { label: 'A expirar (30 d)', value: String(t.a_expirar || 0) }, { label: 'Em curso', value: String((t.em_curso || 0) + (t.atrasado || 0)) }, { label: 'Válidos/concluídos', value: String((t.valido || 0) + (t.concluido || 0)) }] },
        // Os nomes dos cursos não cabem no cabeçalho de colunas estreitas (sobrepunham-se): no cabeçalho vai C1, C2…
        // e a legenda, antes da matriz, diz que curso é cada um. «Não inscrito» passa a «—» para a grelha se ler.
        { titulo: 'Legenda dos cursos', colunas: [{ label: 'Col.', width: 14 }, { label: 'Curso', width: 200 }, { label: 'Obrigatório', width: 30 }],
          linhas: [...cursosVisiveis.map((cv, i) => [`C${i + 1}`, cv.titulo, (matriz.porCurso.find(pc => pc.curso.id === cv.id)?.obrigatorioPara > 0 ? 'Sim' : '—')]), ['—', 'Não inscrito no curso', '']] },
        { titulo: 'Matriz', colunas: [{ label: 'Colaborador', width: 50 }, { label: 'Pend.', width: 12, align: 'right' }, ...cursosVisiveis.map((cv, i) => ({ label: `C${i + 1}`, width: larg }))],
          linhas: linhas.map(l => [l.user.full_name || l.user.email, l.pendencias, ...cursosVisiveis.map(cv => { const cel = l.celulas[idxCurso[cv.id]]; if (cel.estado === 'nao_inscrito') return '—'; const e = ESTADOS[cel.estado]?.label || cel.estado; return cel.validoAte ? `${e} · ${fmtDataCurta(cel.validoAte)} (${diasTexto(cel.validoAte)})` : (cel.matricula && (cel.estado === 'em_curso' || cel.estado === 'atrasado') ? `${e} ${Math.round(Number(cel.matricula.progresso_pct) || 0)}%` : e); })]) },
      ] });
  };

  if (isLoading || !matriz) return <div className="space-y-3"><Skeleton className="h-16 w-full" /><Skeleton className="h-72 w-full" /></div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {kpis.map(([l, v, cls]) => (
          <Card key={l} className="dark:border-slate-800 dark:bg-slate-900"><CardContent className="p-3"><p className="text-xs text-slate-500 dark:text-slate-400">{l}</p><p className={cn('text-xl font-bold tabular-nums', cls)}>{v}</p></CardContent></Card>
        ))}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative min-w-[200px] flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" /><Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Colaborador…" aria-label="Pesquisar colaborador" className="pl-9" /></div>
          <div className="w-full sm:w-48"><Select value={perfil} onValueChange={setPerfil} searchable={false} options={[{ value: 'todos', label: 'Todos os perfis' }, ...perfis.map(p => ({ value: p, label: PERFIL_UC_LABEL[p] || p }))]} /></div>
          <div className="w-full sm:w-44"><Select value={estado} onValueChange={setEstado} searchable={false} options={[{ value: 'todos', label: 'Todos os estados' }, ...Object.entries(ESTADOS).map(([value, e]) => ({ value, label: e.label }))]} /></div>
          <label className="flex items-center gap-2 text-sm"><Switch checked={soObrig} onCheckedChange={setSoObrig} aria-label="Só cursos obrigatórios" /><span>Só obrigatórios</span></label>
          <label className="flex items-center gap-2 text-sm"><Switch checked={soPendentes} onCheckedChange={setSoPendentes} aria-label="Só com pendências" /><span>Só com pendências</span></label>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ['matricula', 'matriz'] })} disabled={isFetching} aria-label="Actualizar"><RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} aria-hidden="true" /></Button>
          <Button variant="outline" size="sm" disabled={!totais.em_falta} onClick={() => setEmFalta(true)}><UserPlus className="h-4 w-4" aria-hidden="true" />Inscrever em falta{totais.em_falta ? ` (${totais.em_falta})` : ''}</Button>
          <Button variant="outline" size="sm" onClick={exportar}><Download className="h-4 w-4" aria-hidden="true" />Excel</Button>
          <BotoesExportar onPdf={exportarPdfMatriz} disabled={linhas.length === 0} />
          <Button size="sm" onClick={() => setEmail(true)}><Mail className="h-4 w-4" aria-hidden="true" />Enviar por email</Button>
        </div>
      </div>

      <Card className="dark:border-slate-800 dark:bg-slate-900"><CardContent className="p-0">
        {cursosVisiveis.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">{soObrig ? 'Nenhum curso está marcado como obrigatório. Defina em Editar dados do curso.' : 'Sem cursos publicados.'}</p>
        ) : linhas.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">Nenhum colaborador corresponde aos filtros.</p>
        ) : (
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-800">
                <tr>
                  <th className="sticky left-0 z-30 min-w-[220px] border-b bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">Colaborador</th>
                  {cursosVisiveis.map(c => <th key={c.id} className="min-w-[160px] border-b px-2 py-2 text-left text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300"><span className="line-clamp-2" title={c.titulo}>{c.titulo}</span>{c.validade_meses ? <span className="block text-[10px] font-normal text-slate-400">validade {c.validade_meses} m</span> : null}</th>)}
                </tr>
              </thead>
              <tbody>
                {linhas.map(l => (
                  <tr key={l.user.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="sticky left-0 z-10 border-b bg-white px-3 py-1.5 dark:border-slate-800 dark:bg-slate-900">
                      {onAbrirAluno ? <button type="button" className="block max-w-full truncate text-left font-medium text-slate-900 hover:underline dark:text-slate-100" onClick={() => onAbrirAluno(l.user.email)}>{l.user.full_name || l.user.email}</button> : <p className="truncate font-medium text-slate-900 dark:text-slate-100">{l.user.full_name || l.user.email}</p>}
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">{perfisUcTexto(l.user.perfis) || l.user.email}</p>
                    </td>
                    {cursosVisiveis.map(cv => { const c = l.celulas[idxCurso[cv.id]]; return (
                      <td key={cv.id} className="border-b px-2 py-1.5 dark:border-slate-800">
                        <ChipEstado estado={c.estado} dias={c.dias} validoAte={c.validoAte} pct={c.matricula ? Math.round(Number(c.matricula.progresso_pct) || 0) : null} />
                        {c.obrigatorio && c.estado !== 'em_falta' && <span className="ml-1 text-[10px] text-slate-400" title="Obrigatório">*</span>}
                        {c.origem === 'externa' && <span className="ml-1 text-[10px] font-medium text-violet-600 dark:text-violet-300" title={`Formação externa: ${c.externa?.titulo || ''}`}>ext.</span>}
                      </td>
                    ); })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent></Card>
      <p className="text-xs text-slate-500 dark:text-slate-400">{linhas.length} de {matriz.linhas.length} colaboradores · * = obrigatório para o colaborador. O relatório semanal com esta matriz e alertas sai pelos Relatórios Automáticos (card "Formação").</p>

      <EnviarMatrizDialog isOpen={email} onClose={() => setEmail(false)} matriz={matriz} cursos={cursosVisiveis} idxCurso={idxCurso} />
      <InscreverEmFaltaDialog isOpen={emFalta} onClose={() => setEmFalta(false)} matriz={matriz} user={user} onDone={(n) => toast({ title: n === 1 ? '1 inscrição criada' : `${n} inscrições criadas` })} />
    </div>
  );
}

function EnviarMatrizDialog({ isOpen, onClose, matriz, cursos, idxCurso }) {
  const { toast } = useToast();
  const [dest, setDest] = useState('');
  const [aEnviar, setAEnviar] = useState(false);
  const [carregado, setCarregado] = useState(false);
  React.useEffect(() => {
    if (!isOpen || carregado) return;
    RelatorioDestinatario.filter({ tipo_relatorio: 'formacao', ativo: true }).then(rows => { setDest(rows.map(r => r.email).join(', ')); setCarregado(true); }).catch(() => setCarregado(true));
  }, [isOpen, carregado]);

  const enviar = async () => {
    const emails = dest.split(/[,;\s]+/).map(e => e.trim().toLowerCase()).filter(e => /^[^@\s]+@[^@\s]+$/.test(e));
    if (!emails.length) { toast({ title: 'Indique pelo menos um email', variant: 'destructive' }); return; }
    setAEnviar(true);
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();
      const cab = ['Colaborador', 'Email', 'Perfis', 'Pendências', ...cursos.map(c => c.titulo)];
      const rows = matriz.linhas.map(l => [l.user.full_name || '', l.user.email, perfisUcTexto(l.user.perfis), l.pendencias, ...cursos.map(cv => { const c = l.celulas[idxCurso[cv.id]]; return ESTADOS[c.estado]?.label || c.estado; })]);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([cab, ...rows]), 'Matriz');
      const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const al = alertasFormacao(matriz);
      const t = matriz.totais;
      const li = (k, v) => `<li><strong>${v}</strong> ${k}</li>`;
      const html = `<div style="font-family:Segoe UI,Arial,sans-serif;color:#0f172a"><h2 style="margin:0 0 8px">Matriz de formação — ${new Date().toLocaleDateString('pt-PT')}</h2>
        <ul style="line-height:1.7">${li('colaboradores', matriz.linhas.length)}${li('formações obrigatórias em falta', t.em_falta || 0)}${li('certificações expiradas', t.expirado || 0)}${li('a expirar nos próximos 30 dias', t.a_expirar || 0)}${li('em curso', (t.em_curso || 0) + (t.atrasado || 0))}${li('válidas/concluídas', (t.valido || 0) + (t.concluido || 0))}</ul>
        ${al.em_falta.length ? `<p><strong>Em falta:</strong> ${al.em_falta.slice(0, 30).map(i => `${i.user.full_name || i.user.email} — ${i.curso.titulo}`).join('; ')}${al.em_falta.length > 30 ? ' …' : ''}</p>` : ''}
        ${al.expirado.length ? `<p><strong>Expiradas:</strong> ${al.expirado.slice(0, 30).map(i => `${i.user.full_name || i.user.email} — ${i.curso.titulo}`).join('; ')}</p>` : ''}
        ${al.a_expirar.length ? `<p><strong>A expirar:</strong> ${al.a_expirar.slice(0, 30).map(i => `${i.user.full_name || i.user.email} — ${i.curso.titulo} (${i.dias} d)`).join('; ')}</p>` : ''}
        <p style="color:#64748b;font-size:12px">A matriz completa segue em anexo (Excel). Enviado pela Universidade Corporativa · SGA.</p></div>`;
      let ok = 0;
      for (const e of emails) {
        try { await sendEmailDirect({ to: e, subject: `[Universidade] Matriz de formação — ${new Date().toLocaleDateString('pt-PT')}`, html, attachments: [{ filename: `Matriz_Formacao_${new Date().toISOString().slice(0, 10)}.xlsx`, content: b64, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }] }); ok++; }
        catch (err) { toast({ title: `Falha ao enviar a ${e}`, description: err?.message, variant: 'destructive' }); }
      }
      if (ok) toast({ title: ok === 1 ? 'Email enviado' : `${ok} emails enviados` });
      if (ok === emails.length) onClose();
    } finally { setAEnviar(false); }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o && !aEnviar) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Enviar matriz por email</DialogTitle><DialogDescription>Resumo no corpo e matriz completa em Excel. Um email por destinatário (só endereços @sga.co.ao são entregues pelo relay).</DialogDescription></DialogHeader>
        <div className="space-y-1.5"><Label htmlFor="mx-dest">Destinatários</Label><Textarea id="mx-dest" rows={3} value={dest} onChange={(e) => setDest(e.target.value)} placeholder="nome@sga.co.ao, outro@sga.co.ao" /><p className="text-xs text-slate-500 dark:text-slate-400">Pré-preenchido com os destinatários do card "Formação" em Relatórios Automáticos.</p></div>
        <DialogFooter><Button variant="outline" onClick={onClose} disabled={aEnviar}>Cancelar</Button><Button onClick={enviar} disabled={aEnviar}>{aEnviar ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Mail className="h-4 w-4" aria-hidden="true" />}Enviar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { Grid3x3 as IconeMatriz };
