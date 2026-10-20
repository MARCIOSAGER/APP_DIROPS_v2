import { PERFIS_UNIVERSIDADE, PERFIL_UC_LABEL, perfisUcTexto } from '@/lib/universidade';
import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import Select from '@/components/ui/select';
import { Search, UserPlus, ChevronRight, Users } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { useDadosMatriz } from '@/hooks/useGestaoFormacao';
import { matrizFormacao } from '@/lib/formacaoEstado';
import InscreverEmFaltaDialog from './InscreverEmFaltaDialog';
import BotoesExportar from './BotoesExportar';
import { exportarExcel, exportarPdf, fmtDataCurta, diasTexto } from '@/lib/formacaoExport';
import { fmtData } from '../formacaoUtils';

// Célula com validade mais próxima (a expirar/expirada primeiro) de uma linha da matriz.
const proximaValidade = (l) => l.celulas.filter(x => x.validoAte).sort((a, b) => new Date(a.validoAte) - new Date(b.validoAte))[0] || null;
const corDias = (cel) => (cel?.estado === 'expirado' ? 'text-red-600' : cel?.estado === 'a_expirar' ? 'text-amber-600' : 'text-slate-600 dark:text-slate-300');

// Lista de colaboradores com o resumo de formação de cada um; abre a ficha do aluno.
export default function AlunosGestao({ user, onAbrirAluno }) {
  const { toast } = useToast();
  const { data, isLoading } = useDadosMatriz();
  const [busca, setBusca] = useState('');
  const [perfil, setPerfil] = useState('todos');
  const [soPendentes, setSoPendentes] = useState(false);
  const [emFalta, setEmFalta] = useState(false);

  const matriz = useMemo(() => (data ? matrizFormacao(data) : null), [data]);
  const perfis = PERFIS_UNIVERSIDADE;
  const linhas = useMemo(() => {
    if (!matriz) return [];
    const q = busca.trim().toLowerCase();
    return matriz.linhas.filter(l => (!q || [l.user.full_name, l.user.email].some(v => String(v || '').toLowerCase().includes(q))) && (perfil === 'todos' || (l.user.perfis || []).includes(perfil)) && (!soPendentes || l.pendencias > 0))
      .sort((a, b) => b.pendencias - a.pendencias || String(a.user.full_name || a.user.email).localeCompare(String(b.user.full_name || b.user.email)));
  }, [matriz, busca, perfil, soPendentes]);
  const nEmFalta = matriz?.totais?.em_falta || 0;

  const linhasExport = () => linhas.map(l => { const r = l.resumo; const px = proximaValidade(l); return [l.user.full_name || '', l.user.email, perfisUcTexto(l.user.perfis), l.celulas.filter(x => x.matricula).length, (r.valido || 0) + (r.concluido || 0), (r.em_curso || 0) + (r.atrasado || 0), l.pendencias, px ? (px.curso.titulo) : '', px ? fmtDataCurta(px.validoAte) : '', px ? diasTexto(px.validoAte) : '', l.externas || 0]; });
  const CAB = ['Colaborador', 'Email', 'Perfis', 'Inscrições', 'Válidos', 'Em curso', 'Pendências', 'Próx. validade (curso)', 'Válido até', 'Dias', 'Formação externa'];
  const exportarXlsx = () => exportarExcel('Alunos_Formacao', [{ nome: 'Alunos', cabecalho: CAB, linhas: linhasExport(), larguras: [28, 30, 22, 10, 9, 9, 11, 30, 12, 14, 12] }]);
  const exportarPdfLista = () => exportarPdf({ base: 'Alunos_Formacao', titulo: 'Alunos — resumo de formação', subtitulo: 'Universidade Corporativa', paisagem: true, empresaId: user?.empresa_id, geradoPor: user?.email,
    meta: [`${linhas.length} colaboradores${perfil !== 'todos' ? ` · perfil ${perfil}` : ''}${soPendentes ? ' · só com pendências' : ''}`],
    seccoes: [{ colunas: [{ label: 'Colaborador', width: 48 }, { label: 'Perfis', width: 34 }, { label: 'Inscr.', width: 14, align: 'right' }, { label: 'Válidos', width: 16, align: 'right' }, { label: 'Em curso', width: 18, align: 'right' }, { label: 'Pend.', width: 14, align: 'right' }, { label: 'Próx. validade (curso)', width: 60 }, { label: 'Válido até', width: 22 }, { label: 'Dias', width: 26 }, { label: 'Ext.', width: 12, align: 'right' }],
      linhas: linhasExport().map(r => [r[0] || r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9], r[10]]) }] });

  if (isLoading || !matriz) return <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-72 w-full" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative min-w-[200px] flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" /><Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou email…" aria-label="Pesquisar colaborador" className="pl-9" /></div>
          <div className="w-full sm:w-48"><Select value={perfil} onValueChange={setPerfil} searchable={false} options={[{ value: 'todos', label: 'Todos os perfis' }, ...perfis.map(p => ({ value: p, label: PERFIL_UC_LABEL[p] || p }))]} /></div>
          <label className="flex items-center gap-2 text-sm"><Switch checked={soPendentes} onCheckedChange={setSoPendentes} aria-label="Só com pendências" /><span>Só com pendências</span></label>
        </div>
        <div className="flex gap-2">
        <BotoesExportar onExcel={exportarXlsx} onPdf={exportarPdfLista} disabled={linhas.length === 0} />
        <Button size="sm" variant={nEmFalta ? 'default' : 'outline'} disabled={!nEmFalta} onClick={() => setEmFalta(true)}><UserPlus className="h-4 w-4" aria-hidden="true" />Inscrever em falta{nEmFalta ? ` (${nEmFalta})` : ''}</Button>
        </div>
      </div>
      <Card className="dark:border-slate-800 dark:bg-slate-900"><CardContent className="p-0">
        {linhas.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center"><Users className="h-8 w-8 text-slate-400" aria-hidden="true" /><p className="text-sm text-slate-500 dark:text-slate-400">Nenhum colaborador corresponde aos filtros.</p></div>
        ) : (
          <div className="overflow-x-auto"><Table>
            <TableHeader><TableRow><TableHead>Colaborador</TableHead><TableHead className="text-right">Inscrições</TableHead><TableHead className="text-right">Válidos</TableHead><TableHead className="text-right">Em curso</TableHead><TableHead className="text-right">Pendências</TableHead><TableHead>Próx. validade</TableHead><TableHead className="text-right">Externas</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
            <TableBody>{linhas.map(l => { const r = l.resumo; const insc = l.celulas.filter(c => c.matricula).length; const px = proximaValidade(l); return (
              <TableRow key={l.user.id || l.user.email} className="cursor-pointer" onClick={() => onAbrirAluno(l.user.email)}>
                <TableCell><p className="font-medium text-slate-900 dark:text-slate-100">{l.user.full_name || l.user.email}</p><p className="truncate text-xs text-slate-500 dark:text-slate-400">{perfisUcTexto(l.user.perfis) || l.user.email}</p></TableCell>
                <TableCell className="text-right tabular-nums">{insc}</TableCell>
                <TableCell className="text-right tabular-nums text-emerald-700 dark:text-emerald-400">{(r.valido || 0) + (r.concluido || 0)}</TableCell>
                <TableCell className="text-right tabular-nums text-blue-700 dark:text-blue-400">{(r.em_curso || 0) + (r.atrasado || 0)}</TableCell>
                <TableCell className={cn('text-right font-semibold tabular-nums', l.pendencias > 0 ? 'text-red-600' : 'text-slate-400')}>{l.pendencias}</TableCell>
                <TableCell className="whitespace-nowrap text-xs">{px ? <><span className="text-slate-700 dark:text-slate-200">{fmtData(px.validoAte)}</span> <span className={cn('tabular-nums', corDias(px))}>({diasTexto(px.validoAte)})</span><span className="block truncate text-slate-500" title={px.curso.titulo}>{px.curso.titulo}</span></> : <span className="text-slate-400">—</span>}</TableCell>
                <TableCell className="text-right tabular-nums">{l.externas || 0}</TableCell>
                <TableCell><Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Abrir ficha de ${l.user.full_name || l.user.email}`} onClick={(e) => { e.stopPropagation(); onAbrirAluno(l.user.email); }}><ChevronRight className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ); })}</TableBody>
          </Table></div>
        )}
      </CardContent></Card>
      <p className="text-xs text-slate-500 dark:text-slate-400">{linhas.length} de {matriz.linhas.length} colaboradores activos. Pendências = obrigatórios em falta, expirados, a expirar e atrasados.</p>
      <InscreverEmFaltaDialog isOpen={emFalta} onClose={() => setEmFalta(false)} matriz={matriz} user={user} onDone={(n) => toast({ title: n === 1 ? '1 inscrição criada' : `${n} inscrições criadas` })} />
    </div>
  );
}
