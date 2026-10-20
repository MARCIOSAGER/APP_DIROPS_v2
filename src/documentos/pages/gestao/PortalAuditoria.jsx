// Auditoria de acessos aos documentos: quem abriu, quem descarregou e quem partilhou, numa tabela densa agrupada
// por dia, com filtros no endereço (para o recorte poder ser citado num relatório) e exportação para CSV.
// Lê o registo do servidor (log_acesso_documento): cada pessoa vê os seus acessos, os gestores os dos documentos
// que podem ver e os administradores tudo — a regra é da base de dados, não daqui. O registo não se altera nem se
// apaga no portal.
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Eye, Link2, Pencil, RefreshCw, ScrollText, Search, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Select from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { fmtData } from '@/lib/safeDate';
import { useAuditoriaDocs, useDocumentosDocs, useRecarregarDocs } from '../../hooks';
import { Vazio, Falha, mapaPorId, urlDoc, FichasFiltro } from '../PortalBiblioteca';
import { PaginaGestao } from '../../PortalLayout';
import {
  GD, Painel, Tabela, Th, Tr, Td, LinhasEsqueleto, LinhaMensagem, Ficha, ResumoFiltros,
  ComutadorDensidade, useDensidade, useFiltrosUrl, useBuscaDebounce,
} from './PortalGestaoPainel';

const PERIODOS = [
  { value: '7', label: 'Últimos 7 dias' },
  { value: '30', label: 'Últimos 30 dias' },
  { value: '90', label: 'Últimos 90 dias' },
  { value: '365', label: 'Último ano' },
  { value: 'custom', label: 'Intervalo à escolha' },
];
const TIPOS = {
  visualizacao: { label: 'Abriu', icone: Eye, cor: 'border-sky-200 bg-sky-100 text-sky-800 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-200' },
  download: { label: 'Descarregou', icone: Download, cor: 'border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200' },
  partilha: { label: 'Partilhou', icone: Link2, cor: 'border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200' },
  link_externo: { label: 'Acesso por link', icone: Link2, cor: 'border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200' },
  edicao: { label: 'Alterou', icone: Pencil, cor: 'border-violet-200 bg-violet-100 text-violet-800 dark:border-violet-900 dark:bg-violet-950/50 dark:text-violet-200' },
};
const tipoDe = (t) => TIPOS[t] || { label: t || 'Acesso', icone: ScrollText, cor: 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300' };
const iso = (d) => d.toISOString().slice(0, 10);
const hora = (v) => { const d = new Date(v); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); };
const diaLabel = (v) => {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return 'Data desconhecida';
  const agora = new Date(); const ontem = new Date(Date.now() - 86400000);
  if (iso(d) === iso(agora)) return 'Hoje';
  if (iso(d) === iso(ontem)) return 'Ontem';
  return d.toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
};
const csvCampo = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const COLUNAS = 5;

export default function PortalAuditoria() {
  const { toast } = useToast();
  const recarregar = useRecarregarDocs();
  const [altura, setAltura] = useDensidade();
  const [filtros, definir, limparFiltros] = useFiltrosUrl({
    periodo: '30', de: iso(new Date(Date.now() - 30 * 86400000)), ate: iso(new Date()),
    pessoa: '', documento: '', tipo: '', q: '',
  });
  const { periodo, de, ate, pessoa, documento: documentoId, tipo, q } = filtros;
  const [texto, setTexto] = useBuscaDebounce(q, (v) => definir({ q: v }));
  const [limite, setLimite] = useState(200);

  const intervalo = periodo === 'custom'
    ? { de, ate }
    : { de: iso(new Date(Date.now() - Number(periodo) * 86400000)), ate: iso(new Date()) };
  // o `ate` é um dia inteiro: soma-se um dia para incluir os acessos desse próprio dia
  const ateFim = useMemo(() => iso(new Date(new Date(`${intervalo.ate}T00:00:00`).getTime() + 86400000)), [intervalo.ate]);

  const logQ = useAuditoriaDocs({ de: intervalo.de, ate: ateFim, limite: 3000 });
  const docsQ = useDocumentosDocs({ limite: 1000 });
  const mapaDocs = useMemo(() => mapaPorId(docsQ.data || []), [docsQ.data]);
  const tituloDoc = (id) => mapaDocs.get(id)?.titulo || 'Documento já apagado ou sem acesso';
  const numeroDoc = (id) => mapaDocs.get(id)?.numero || '';

  const registos = logQ.data || [];
  const filtrados = useMemo(() => {
    const t = String(q || '').trim().toLowerCase();
    const p = String(pessoa || '').trim().toLowerCase();
    return registos.filter(r => {
      if (tipo && r.tipo_acesso !== tipo) return false;
      if (documentoId && r.documento_id !== documentoId) return false;
      if (p && !String(r.usuario_email || '').toLowerCase().includes(p) && !String(r.usuario_nome || '').toLowerCase().includes(p)) return false;
      if (!t) return true;
      return [r.usuario_email, r.usuario_nome, r.endereco_ip, tituloDoc(r.documento_id), numeroDoc(r.documento_id)].some(v => String(v || '').toLowerCase().includes(t));
    });
  }, [registos, tipo, documentoId, pessoa, q, mapaDocs]);

  // Linhas já agrupadas por dia: o dia entra na própria tabela como uma linha de secção, sem partir a tabela.
  const linhas = useMemo(() => {
    const porDia = new Map();
    for (const r of filtrados) {
      const dia = String(r.data_hora_acesso || '').slice(0, 10) || 'sem-data';
      porDia.set(dia, (porDia.get(dia) || 0) + 1);
    }
    const saida = [];
    let diaActual = null;
    for (const r of filtrados.slice(0, limite)) {
      const dia = String(r.data_hora_acesso || '').slice(0, 10) || 'sem-data';
      if (dia !== diaActual) {
        diaActual = dia;
        saida.push({ tipo: 'dia', chave: `d-${dia}`, label: diaLabel(r.data_hora_acesso), n: porDia.get(dia) || 0 });
      }
      saida.push({ tipo: 'registo', chave: r.id || `${dia}-${saida.length}`, r });
    }
    return saida;
  }, [filtrados, limite]);

  const contagem = useMemo(() => {
    const c = {};
    for (const r of filtrados) { const k = r.tipo_acesso || 'outro'; c[k] = (c[k] || 0) + 1; }
    return c;
  }, [filtrados]);
  const contagemTodos = useMemo(() => {
    const c = {};
    for (const r of registos) { const k = r.tipo_acesso || 'outro'; c[k] = (c[k] || 0) + 1; }
    return c;
  }, [registos]);
  const pessoasDistintas = useMemo(() => new Set(filtrados.map(r => String(r.usuario_email || '').toLowerCase()).filter(Boolean)).size, [filtrados]);

  const opcoesDocs = useMemo(() => [
    { value: '', label: 'Documento: todos' },
    ...[...new Set(registos.map(r => r.documento_id).filter(Boolean))].map(id => ({ value: id, label: tituloDoc(id) })).sort((a, b) => a.label.localeCompare(b.label, 'pt')),
  ], [registos, mapaDocs]);
  const opcoesPessoas = useMemo(() => [
    { value: '', label: 'Pessoa: todas' },
    ...[...new Set(registos.map(r => r.usuario_email).filter(Boolean))].sort().map(e => ({ value: e, label: e })),
  ], [registos]);

  const exportarCsv = () => {
    try {
      const cabecalho = ['Data', 'Hora', 'Tipo de acesso', 'Pessoa', 'Email', 'Documento', 'Número', 'Endereço IP'];
      const corpo = filtrados.map(r => [
        fmtData(r.data_hora_acesso), hora(r.data_hora_acesso), tipoDe(r.tipo_acesso).label,
        r.usuario_nome || '', r.usuario_email || '', tituloDoc(r.documento_id), numeroDoc(r.documento_id), r.endereco_ip || '',
      ]);
      const csv = '﻿' + [cabecalho, ...corpo].map(l => l.map(csvCampo).join(';')).join('\r\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      a.download = `Documentos_auditoria_${intervalo.de}_a_${intervalo.ate}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      toast({ title: 'CSV descarregado', description: `${filtrados.length} registo(s).` });
    } catch (e) {
      toast({ title: 'Não foi possível exportar', description: e?.message || String(e), variant: 'destructive' });
    }
  };

  const temFiltros = !!(pessoa || documentoId || tipo || q);
  const limparTudo = () => { setTexto(''); limparFiltros(['pessoa', 'documento', 'tipo', 'q']); };

  return (
    <PaginaGestao
      titulo="Auditoria de acessos"
      descricao="Quem abriu, descarregou e partilhou cada documento. O registo não se altera nem se apaga no portal; o recorte que está a ver fica no endereço e pode ser citado."
      accoes={<>
        <ComutadorDensidade valor={altura} aoMudar={setAltura} />
        <Button variant="outline" onClick={() => recarregar('auditoria')} disabled={logQ.isFetching}><RefreshCw className={cn('h-4 w-4', logQ.isFetching && 'animate-spin')} aria-hidden="true" />Actualizar</Button>
        <Button variant="outline" onClick={exportarCsv} disabled={!filtrados.length}><Download className="h-4 w-4" aria-hidden="true" />Exportar CSV</Button>
      </>}
    >
      <Painel>
        <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1.5 xl:col-span-2">
            <Label htmlFor="au-texto">Procurar</Label>
            <div className="relative">
              <Search className={cn('pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2', GD.meta)} aria-hidden="true" />
              <Input id="au-texto" value={texto} onChange={e => setTexto(e.target.value)} placeholder="pessoa, documento, número ou endereço IP…" className="pl-9" />
            </div>
          </div>
          <div className="space-y-1.5"><Label>Período</Label><Select options={PERIODOS} value={periodo} onValueChange={v => definir({ periodo: v })} /></div>
          <div className="space-y-1.5"><Label>Pessoa</Label><Select options={opcoesPessoas} value={pessoa} onValueChange={v => definir({ pessoa: v })} /></div>
          {periodo === 'custom' && (
            <>
              <div className="space-y-1.5"><Label htmlFor="au-de">De</Label><Input id="au-de" type="date" value={de} onChange={e => definir({ de: e.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="au-ate">Até</Label><Input id="au-ate" type="date" value={ate} onChange={e => definir({ ate: e.target.value })} /></div>
            </>
          )}
          <div className="space-y-1.5 xl:col-span-2"><Label>Documento</Label><Select options={opcoesDocs} value={documentoId} onValueChange={v => definir({ documento: v })} /></div>
        </div>
        <div className={cn('border-t px-3 py-2.5', GD.borda)}>
          <FichasFiltro
            titulo="Tipo"
            opcoes={Object.keys(contagemTodos).sort().map(k => ({ value: k, label: tipoDe(k).label, total: contagemTodos[k] }))}
            valor={tipo}
            aoEscolher={v => definir({ tipo: v })}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
          <p className={cn('text-sm tabular-nums', GD.tintaMedia)}>
            {logQ.isLoading ? 'A carregar…' : <>{filtrados.length} acesso{filtrados.length === 1 ? '' : 's'} de {registos.length} no período · {pessoasDistintas} pessoa(s)</>}
          </p>
          <ResumoFiltros
            aplicados={[
              q && { chave: 'q', rotulo: `Texto: ${q}`, aoRemover: () => { setTexto(''); definir({ q: '' }); } },
              pessoa && { chave: 'pessoa', rotulo: `Pessoa: ${pessoa}`, aoRemover: () => definir({ pessoa: '' }) },
              documentoId && { chave: 'documento', rotulo: `Documento: ${tituloDoc(documentoId)}`, aoRemover: () => definir({ documento: '' }) },
              tipo && { chave: 'tipo', rotulo: tipoDe(tipo).label, aoRemover: () => definir({ tipo: '' }) },
            ].filter(Boolean)}
            aoLimparTudo={limparTudo}
          />
        </div>

        <Tabela altura={altura} rotulo="Registo de acessos aos documentos">
          <thead>
            <tr>
              <Th estreito>Hora</Th>
              <Th estreito>Tipo</Th>
              <Th>Documento</Th>
              <Th>Pessoa</Th>
              <Th className="hidden lg:table-cell">Endereço IP</Th>
            </tr>
          </thead>
          {logQ.isLoading ? <LinhasEsqueleto linhas={8} colunas={COLUNAS} altura={altura} />
            : logQ.isError ? (
              <LinhaMensagem colunas={COLUNAS}>
                <Falha titulo="Não foi possível carregar o registo de acessos" texto={`${logQ.error?.message || 'O servidor não respondeu.'} O registo é só de leitura: nada se perdeu. Tente de novo.`} onTentar={() => logQ.refetch()} />
              </LinhaMensagem>
            ) : filtrados.length === 0 ? (
              <LinhaMensagem colunas={COLUNAS}>
                <Vazio
                  icone={ScrollText}
                  titulo={temFiltros ? 'Nenhum acesso corresponde a estes filtros' : 'Sem acessos registados neste período'}
                  texto={temFiltros ? 'Retire um filtro ou alargue o período.' : 'Ninguém abriu documentos no intervalo escolhido. Experimente um período maior.'}
                >
                  {temFiltros
                    ? <Button variant="outline" onClick={limparTudo}>Limpar filtros</Button>
                    : <Button variant="outline" onClick={() => definir({ periodo: '365' })}>Ver o último ano</Button>}
                </Vazio>
              </LinhaMensagem>
            ) : (
              <tbody>
                {linhas.map(l => (l.tipo === 'dia' ? (
                  <tr key={l.chave}>
                    <td colSpan={COLUNAS} className={cn('border-b px-3 py-1 text-xs font-semibold uppercase tracking-wider', GD.borda, GD.superficieFraca, GD.meta)}>
                      {l.label} <span className="tabular-nums">({l.n})</span>
                    </td>
                  </tr>
                ) : (
                  <Tr key={l.chave}>
                    <Td className={cn('text-sm', GD.ref, GD.meta)}>{hora(l.r.data_hora_acesso)}</Td>
                    <Td>
                      <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium', tipoDe(l.r.tipo_acesso).cor)}>
                        {tipoDe(l.r.tipo_acesso).label}
                      </span>
                    </Td>
                    <Td className="max-w-[26rem]">
                      {numeroDoc(l.r.documento_id) && <span className={cn('block truncate text-xs', GD.ref, GD.meta)}>{numeroDoc(l.r.documento_id)}</span>}
                      {mapaDocs.has(l.r.documento_id)
                        ? <Link to={urlDoc(l.r.documento_id)} className={cn('block truncate hover:underline', GD.tinta, GD.foco)}>{tituloDoc(l.r.documento_id)}</Link>
                        : <span className={cn('block truncate', GD.meta)}>{tituloDoc(l.r.documento_id)}</span>}
                    </Td>
                    <Td className="max-w-[16rem]">
                      <span className={cn('block truncate text-sm', GD.tintaMedia)}>{l.r.usuario_nome || l.r.usuario_email || 'desconhecido'}</span>
                      {l.r.usuario_nome && l.r.usuario_email && <span className={cn('block truncate text-sm', GD.meta)}>{l.r.usuario_email}</span>}
                    </Td>
                    <Td className={cn('hidden text-sm lg:table-cell', GD.ref, GD.meta)}>{l.r.endereco_ip && l.r.endereco_ip !== 'client' ? l.r.endereco_ip : '—'}</Td>
                  </Tr>
                )))}
              </tbody>
            )}
        </Tabela>
        {filtrados.length > limite && (
          <div className={cn('border-t px-3 py-2 text-center', GD.borda)}>
            <Button variant="outline" size="sm" onClick={() => setLimite(l => l + 300)}>Mostrar mais ({filtrados.length - limite} restantes)</Button>
          </div>
        )}
      </Painel>

      {registos.length >= 3000 && <p className={cn('text-sm', GD.alerta)}>Limite de 3000 registos atingido: reduza o período para ver tudo.</p>}
      <p className={cn('flex items-start gap-1.5 text-sm', GD.meta)}>
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        O registo guarda a data, a pessoa, o documento e o tipo de acesso. Serve para auditorias internas e da ANAC: não é apagável pelo portal.
      </p>
    </PaginaGestao>
  );
}
