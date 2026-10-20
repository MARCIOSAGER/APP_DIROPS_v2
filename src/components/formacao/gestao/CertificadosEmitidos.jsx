import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Award, Download, ShieldCheck, ShieldOff, RotateCcw, Loader2, Search } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { Certificado } from '@/entities/Certificado';
import { useTodosCertificados } from '@/hooks/useGestaoFormacao';
import { prepararCertParaPdf, getPublicBaseUrl } from '@/lib/certificadoEmissao';
import { fmtData } from '../formacaoUtils';
import BotoesExportar from './BotoesExportar';
import { exportarExcel, exportarPdf, fmtDataCurta, diasTexto } from '@/lib/formacaoExport';

// Todos os certificados emitidos: PDF, validação pública, revogar/restaurar.
export default function CertificadosEmitidos({ user }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: certificados = [], isLoading } = useTodosCertificados();
  const [busca, setBusca] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [ocupado, setOcupado] = useState(null);

  const q = busca.trim().toLowerCase();
  const lista = certificados.filter(c => !q || [c.numero, c.aluno_nome, c.aluno_email, c.curso_titulo].some(v => String(v || '').toLowerCase().includes(q)));

  const linhasExport = () => lista.map(c => [c.numero, c.aluno_nome || '', c.aluno_email, c.curso_titulo, fmtDataCurta(c.emitido_em), c.valido_ate ? fmtDataCurta(c.valido_ate) : '', c.valido_ate ? diasTexto(c.valido_ate) : '', c.ciclo || 1, c.revogado_em ? 'Revogado' : 'Válido', c.emitido_por || '']);
  const exportarXlsx = () => exportarExcel('Certificados_emitidos', [{ nome: 'Certificados', cabecalho: ['Número', 'Aluno', 'Email', 'Curso', 'Emitido', 'Válido até', 'Dias', 'Ciclo', 'Estado', 'Emitido por'], linhas: linhasExport(), larguras: [20, 28, 30, 34, 12, 12, 16, 6, 10, 26] }]);
  const exportarPdfLista = () => exportarPdf({ base: 'Certificados_emitidos', titulo: 'Certificados emitidos', subtitulo: 'Universidade Corporativa', paisagem: true, empresaId: user?.empresa_id, geradoPor: user?.email,
    meta: [`${lista.length} ${lista.length === 1 ? 'certificado' : 'certificados'}${q ? ` · pesquisa "${busca.trim()}"` : ''}`],
    seccoes: [{ colunas: [{ label: 'Número', width: 34 }, { label: 'Aluno', width: 46 }, { label: 'Email', width: 50 }, { label: 'Curso', width: 60 }, { label: 'Emitido', width: 20 }, { label: 'Válido até', width: 20 }, { label: 'Dias', width: 24 }, { label: 'Ciclo', width: 11, align: 'right' }, { label: 'Estado', width: 18 }], linhas: linhasExport().map(r => r.slice(0, 9)) }] });

  const descarregar = async (cert) => {
    setOcupado(cert.id);
    try {
      const [{ gerarCertificadoPdf, nomeFicheiroCertificado }, input] = await Promise.all([import('@/lib/certificadoPdf'), prepararCertParaPdf(cert)]);
      (await gerarCertificadoPdf(input)).save(nomeFicheiroCertificado(cert));
    } catch (e) { toast({ title: 'Não foi possível gerar o PDF', description: e?.message, variant: 'destructive' }); }
    finally { setOcupado(null); }
  };
  const validar = async (cert) => window.open(`${await getPublicBaseUrl()}/cert/${cert.token}`, '_blank', 'noopener');
  const alternarRevogacao = async () => {
    const cert = confirm; setConfirm(null); setOcupado(cert.id);
    try {
      const revogar = !cert.revogado_em;
      await Certificado.update(cert.id, revogar ? { revogado_em: new Date().toISOString(), revogado_por: user?.email || null } : { revogado_em: null, revogado_por: null });
      toast({ title: revogar ? 'Certificado revogado' : 'Certificado restaurado', description: cert.numero });
      await qc.invalidateQueries({ queryKey: ['certificado'] });
    } catch (e) { toast({ title: 'Não foi possível actualizar', description: e?.message, variant: 'destructive' }); }
    finally { setOcupado(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600 dark:text-slate-400">{certificados.length} {certificados.length === 1 ? 'certificado emitido' : 'certificados emitidos'} · {certificados.filter(c => c.revogado_em).length} revogados</p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Número, aluno ou curso…" aria-label="Pesquisar certificados" className="w-72 pl-9" />
          </div>
          <BotoesExportar onExcel={exportarXlsx} onPdf={exportarPdfLista} disabled={lista.length === 0} />
        </div>
      </div>
      <Card className="dark:border-slate-800 dark:bg-slate-900">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">{[0, 1, 2].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : lista.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Award className="h-8 w-8 text-slate-400" aria-hidden="true" />
              <p className="font-medium text-slate-900 dark:text-slate-100">{certificados.length === 0 ? 'Ainda não foi emitido nenhum certificado' : 'Nenhum certificado corresponde à pesquisa'}</p>
              {certificados.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">Emita certificados no separador Alunos de cada curso, quando o aluno concluir.</p>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Aluno</TableHead>
                    <TableHead>Curso</TableHead>
                    <TableHead>Emitido</TableHead>
                    <TableHead>Válido até</TableHead>
                    <TableHead>Dias</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acções</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lista.map(c => (
                    <TableRow key={c.id} className={c.revogado_em ? 'opacity-70' : ''}>
                      <TableCell className="font-mono text-xs">{c.numero}</TableCell>
                      <TableCell>
                        <p className="font-medium text-slate-900 dark:text-slate-100">{c.aluno_nome}</p>
                        {c.aluno_email && <p className="text-xs text-slate-500 dark:text-slate-400">{c.aluno_email}</p>}
                      </TableCell>
                      <TableCell className="max-w-[260px] truncate text-sm">{c.curso_titulo}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">{fmtData(c.emitido_em)}{c.emitido_por ? <span className="block text-xs text-slate-400">{c.emitido_por}</span> : null}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">{c.valido_ate ? fmtData(c.valido_ate) : <span className="text-xs text-slate-400">sem validade</span>}</TableCell>
                      <TableCell className={`whitespace-nowrap text-xs tabular-nums ${c.valido_ate && diasTexto(c.valido_ate).startsWith('expirou') ? 'font-medium text-red-600' : c.valido_ate && parseInt(diasTexto(c.valido_ate), 10) <= 30 ? 'font-medium text-amber-600' : 'text-slate-600 dark:text-slate-300'}`}>{c.valido_ate ? diasTexto(c.valido_ate) : '—'}</TableCell>
                      <TableCell>
                        {c.revogado_em
                          ? <Badge variant="destructive">Revogado {fmtData(c.revogado_em)}</Badge>
                          : <Badge className="bg-emerald-600 text-white hover:bg-emerald-600"><ShieldCheck className="mr-1 h-3 w-3" aria-hidden="true" />Válido</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-0.5">
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Descarregar PDF" disabled={ocupado === c.id} onClick={() => descarregar(c)}>{ocupado === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}</Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Abrir página de validação" onClick={() => validar(c)}><ShieldCheck className="h-4 w-4" /></Button>
                          {c.revogado_em
                            ? <Button variant="ghost" size="sm" disabled={ocupado === c.id} onClick={() => setConfirm(c)}><RotateCcw className="h-4 w-4" aria-hidden="true" />Restaurar</Button>
                            : <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" disabled={ocupado === c.id} onClick={() => setConfirm(c)}><ShieldOff className="h-4 w-4" aria-hidden="true" />Revogar</Button>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      <ConfirmModal
        isOpen={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={alternarRevogacao}
        variant={confirm?.revogado_em ? 'default' : 'destructive'}
        title={confirm?.revogado_em ? 'Restaurar certificado?' : 'Revogar certificado?'}
        confirmText={confirm?.revogado_em ? 'Restaurar' : 'Revogar'}
        message={confirm?.revogado_em
          ? `${confirm.numero} volta a validar como autêntico na página pública.`
          : `${confirm?.numero} passa a aparecer como REVOGADO na página de validação (QR) e o aluno deixa de poder descarregar o PDF.`}
      />
    </div>
  );
}
