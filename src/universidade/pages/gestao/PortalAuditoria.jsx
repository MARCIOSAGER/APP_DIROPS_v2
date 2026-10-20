// Registo de auditoria da Universidade: logins e acessos, configuração, matrículas, certificados, avaliações (com eventos de integridade),
// sessões, versões de cursos, emails, comentários e distintivos. Filtros, detalhe e exportação (CSV, Excel, PDF com logo SGA).
import React, { useMemo, useState } from 'react';
import { ScrollText, Search, Download, RefreshCw, Eye, ShieldAlert, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import Select from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import BotoesExportar from '@/components/formacao/gestao/BotoesExportar';
import { exportarExcel, exportarPdf, nomeFicheiro } from '@/lib/formacaoExport';
import { CATEGORIAS_AUDITORIA, descreverAcao, filtrarAuditoria, agruparPorDia, csvDe, CORES_BADGE } from '@/lib/universidade';
import { useAuditoriaUniversidade } from '../../hooks';
import { PaginaGestao } from '../../PortalLayout';

const dataIso = (d) => d.toISOString().slice(0, 10);
const PERIODOS = [{ value: '7', label: 'Últimos 7 dias' }, { value: '30', label: 'Últimos 30 dias' }, { value: '90', label: 'Últimos 90 dias' }, { value: '365', label: 'Último ano' }, { value: 'custom', label: 'Intervalo à escolha' }];
const fmt = (iso) => new Date(iso).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export default function PortalAuditoria() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [periodo, setPeriodo] = useState('30');
  const [de, setDe] = useState(dataIso(new Date(Date.now() - 30 * 86400000)));
  const [ate, setAte] = useState(dataIso(new Date()));
  const [texto, setTexto] = useState(''); const [categoria, setCategoria] = useState(''); const [acao, setAcao] = useState(''); const [soIntegridade, setSoIntegridade] = useState(false);
  const [limite, setLimite] = useState(200);
  const [detalhe, setDetalhe] = useState(null);
  const intervalo = periodo === 'custom' ? { de, ate } : { de: dataIso(new Date(Date.now() - Number(periodo) * 86400000)), ate: dataIso(new Date()) };
  const { data = [], isLoading, isFetching, refetch } = useAuditoriaUniversidade({ ...intervalo, limite: 3000 });
  const filtradas = useMemo(() => filtrarAuditoria(data, { texto, categoria, acao, soIntegridade }), [data, texto, categoria, acao, soIntegridade]);
  const grupos = useMemo(() => agruparPorDia(filtradas.slice(0, limite)), [filtradas, limite]);
  const acoes = useMemo(() => [...new Set(data.map(l => l.acao))].sort().map(a => ({ value: a, label: descreverAcao(a).label })), [data]);
  const colunas = [
    { label: 'Data/hora', valor: (l) => new Date(l.quando).toLocaleString('pt-PT') }, { label: 'Categoria', valor: (l) => CATEGORIAS_AUDITORIA[l.categoria] || l.categoria }, { label: 'Acção', valor: (l) => descreverAcao(l.acao).label },
    { label: 'Utilizador', valor: (l) => l.actor_nome ? `${l.actor_nome} <${l.actor_email}>` : l.actor_email }, { label: 'Alvo', chave: 'alvo' }, { label: 'Detalhe', chave: 'detalhe' }, { label: 'IP', chave: 'ip' }, { label: 'Dados', valor: (l) => l.dados ? JSON.stringify(l.dados) : '' },
  ];
  const descarregarCsv = () => {
    const blob = new Blob([csvDe(filtradas, colunas)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${nomeFicheiro('Universidade_auditoria')}.csv`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const excel = () => exportarExcel('Universidade_auditoria', [{ nome: 'Auditoria', cabecalho: colunas.map(c => c.label), linhas: filtradas.map(l => colunas.map(c => (c.valor ? c.valor(l) : l[c.chave]) ?? '')), larguras: [20, 18, 24, 34, 30, 60, 14, 50] }]);
  const pdf = () => exportarPdf({ base: 'Universidade_auditoria', titulo: 'Universidade Corporativa — registo de auditoria', subtitulo: `${intervalo.de} a ${intervalo.ate}${categoria ? ` · ${CATEGORIAS_AUDITORIA[categoria]}` : ''}${acao ? ` · ${descreverAcao(acao).label}` : ''}${texto ? ` · «${texto}»` : ''}`, paisagem: true, empresaId: user?.empresa_id, geradoPor: user?.email,
    meta: [`${filtradas.length} registo(s)`],
    seccoes: [{ titulo: 'Registos', colunas: [{ label: 'Data/hora', width: 30 }, { label: 'Acção', width: 34 }, { label: 'Utilizador', width: 48 }, { label: 'Detalhe', width: 120 }, { label: 'IP', width: 24 }], linhas: filtradas.slice(0, 1500).map(l => [new Date(l.quando).toLocaleString('pt-PT'), descreverAcao(l.acao).label, l.actor_nome || l.actor_email || '', l.detalhe || l.alvo || '', l.ip || '']), vazio: 'Sem registos no período.' }] });

  return (
    <PaginaGestao titulo="Auditoria" descricao="Só o que acontece na Universidade: entradas no portal, pedidos e convites, perfis, configuração, avisos, matrículas, certificados, avaliações, sessões de formação, versões de cursos, emails e comentários." accoes={<><Button variant="outline" size="sm" onClick={descarregarCsv} disabled={!filtradas.length}><Download className="h-4 w-4" aria-hidden="true" />CSV</Button><BotoesExportar onExcel={excel} onPdf={pdf} disabled={!filtradas.length} /></>}>
      <Card className="dark:border-slate-800 dark:bg-slate-900"><CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-6">
        <div className="space-y-1.5 xl:col-span-2"><Label htmlFor="au-texto">Procurar</Label><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" /><Input id="au-texto" value={texto} onChange={e => setTexto(e.target.value)} placeholder="utilizador, curso, detalhe, IP…" className="pl-9" /></div></div>
        <div className="space-y-1.5"><Label>Período</Label><Select options={PERIODOS} value={periodo} onValueChange={setPeriodo} /></div>
        {periodo === 'custom' ? <><div className="space-y-1.5"><Label htmlFor="au-de">De</Label><Input id="au-de" type="date" value={de} onChange={e => setDe(e.target.value)} /></div><div className="space-y-1.5"><Label htmlFor="au-ate">Até</Label><Input id="au-ate" type="date" value={ate} onChange={e => setAte(e.target.value)} /></div></> : (
          <><div className="space-y-1.5"><Label>Categoria</Label><Select options={[{ value: '', label: 'Todas' }, ...Object.entries(CATEGORIAS_AUDITORIA).map(([v, l]) => ({ value: v, label: l }))]} value={categoria} onValueChange={setCategoria} /></div><div className="space-y-1.5"><Label>Acção</Label><Select options={[{ value: '', label: 'Todas' }, ...acoes]} value={acao} onValueChange={setAcao} /></div></>
        )}
        <div className="flex items-end gap-3 pb-1"><label className="flex items-center gap-2 text-sm"><Switch checked={soIntegridade} onCheckedChange={setSoIntegridade} /><ShieldAlert className="h-4 w-4 text-amber-600" aria-hidden="true" />Só avaliações com alertas</label></div>
        {periodo === 'custom' && <><div className="space-y-1.5"><Label>Categoria</Label><Select options={[{ value: '', label: 'Todas' }, ...Object.entries(CATEGORIAS_AUDITORIA).map(([v, l]) => ({ value: v, label: l }))]} value={categoria} onValueChange={setCategoria} /></div><div className="space-y-1.5"><Label>Acção</Label><Select options={[{ value: '', label: 'Todas' }, ...acoes]} value={acao} onValueChange={setAcao} /></div></>}
      </CardContent></Card>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600 dark:text-slate-400"><span><Filter className="mr-1 inline h-4 w-4" aria-hidden="true" />{filtradas.length} registo(s) de {data.length} no período{data.length >= 3000 ? ' (limite de 3000 atingido — reduza o período)' : ''}</span><Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}><RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} aria-hidden="true" />Actualizar</Button></div>

      {isLoading ? <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div> : filtradas.length === 0 ? (
        <Card className="dark:border-slate-800 dark:bg-slate-900"><CardContent className="flex flex-col items-center gap-2 py-12 text-center"><ScrollText className="h-8 w-8 text-slate-400" aria-hidden="true" /><p className="font-medium">Sem registos para estes filtros</p><p className="text-sm text-slate-500">Alargue o período ou limpe a pesquisa.</p></CardContent></Card>
      ) : (
        <div className="space-y-5">
          {grupos.map(g => (
            <section key={g.dia} className="space-y-2">
              <h2 className="sticky top-16 z-10 -mx-1 bg-slate-50/95 px-1 py-1 text-sm font-semibold capitalize text-slate-700 backdrop-blur dark:bg-slate-950/95 dark:text-slate-200">{g.label} <span className="font-normal text-slate-400">({g.itens.length})</span></h2>
              <Card className="dark:border-slate-800 dark:bg-slate-900"><CardContent className="p-0"><ul className="divide-y dark:divide-slate-800">{g.itens.map(l => { const d = descreverAcao(l.acao); const alerta = l.acao === 'avaliacao_submetida' && Number(l.dados?.eventos) > 0; return (
                <li key={l.id} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                  <span className="w-16 shrink-0 pt-0.5 font-mono text-xs text-slate-500">{fmt(l.quando)}</span>
                  <span className={cn('mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold', CORES_BADGE[d.cor])}>{d.label}</span>
                  <div className="min-w-0 flex-1"><p className="truncate text-slate-800 dark:text-slate-100">{l.detalhe || l.alvo || '—'}{alerta && <span className="ml-2 inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-200"><ShieldAlert className="h-3 w-3" aria-hidden="true" />{l.dados.eventos} alerta(s)</span>}</p><p className="truncate text-xs text-slate-500">{l.actor_nome ? `${l.actor_nome} · ` : ''}{l.actor_email}{l.ip ? ` · ${l.ip}` : ''}</p></div>
                  <Button variant="ghost" size="sm" className="h-7 shrink-0 px-2" onClick={() => setDetalhe(l)} aria-label="Ver detalhe"><Eye className="h-4 w-4" aria-hidden="true" /></Button>
                </li>
              ); })}</ul></CardContent></Card>
            </section>
          ))}
          {filtradas.length > limite && <div className="text-center"><Button variant="outline" onClick={() => setLimite(l => l + 300)}>Mostrar mais ({filtradas.length - limite} restantes)</Button></div>}
        </div>
      )}

      <Dialog open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        <DialogContent className="max-w-2xl">
          {detalhe && (
            <>
              <DialogHeader><DialogTitle className="flex items-center gap-2"><span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', CORES_BADGE[descreverAcao(detalhe.acao).cor])}>{descreverAcao(detalhe.acao).label}</span>{new Date(detalhe.quando).toLocaleString('pt-PT')}</DialogTitle><DialogDescription>{detalhe.detalhe || detalhe.alvo}</DialogDescription></DialogHeader>
              <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[8rem_1fr]">
                <dt className="text-slate-500">Utilizador</dt><dd>{detalhe.actor_nome ? `${detalhe.actor_nome} · ` : ''}{detalhe.actor_email || '—'}</dd>
                <dt className="text-slate-500">Categoria</dt><dd>{CATEGORIAS_AUDITORIA[detalhe.categoria] || detalhe.categoria}</dd>
                <dt className="text-slate-500">Alvo</dt><dd>{detalhe.alvo || '—'}{detalhe.alvo_id ? <span className="ml-2 font-mono text-xs text-slate-400">{detalhe.alvo_id}</span> : null}</dd>
                <dt className="text-slate-500">IP</dt><dd>{detalhe.ip || '—'}</dd>
                <dt className="text-slate-500">Registo</dt><dd className="font-mono text-xs text-slate-400">{detalhe.id}</dd>
              </dl>
              {detalhe.dados && <pre className="max-h-72 overflow-auto rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-950">{JSON.stringify(detalhe.dados, null, 2)}</pre>}
              <Button variant="outline" size="sm" onClick={async () => { try { await navigator.clipboard.writeText(JSON.stringify(detalhe, null, 2)); toast({ title: 'Registo copiado' }); } catch { toast({ title: 'Não foi possível copiar', variant: 'destructive' }); } }}>Copiar registo</Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </PaginaGestao>
  );
}
