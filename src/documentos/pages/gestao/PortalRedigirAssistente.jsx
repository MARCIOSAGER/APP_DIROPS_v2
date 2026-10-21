// Assistente «Redigir documentos»: modelo → cabeçalho → secções (com ajuda e exemplo ao lado) → pré-visualizar e
// gerar. Grava sozinho (debounce) e avisa ao sair com alterações por gravar. «Gerar rascunho» cria (se preciso) o
// documento em rascunho e grava PDF + Word como nova versão em RASCUNHO — a aprovação segue o fluxo normal.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { generateHTML } from '@tiptap/core';
import {
  AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, Circle, CloudOff, Download, Eye, FileCheck2, FileText,
  History, Lightbulb, Loader2, Save, Sparkles, Wand2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Select from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import { PORTAL_BASE } from '@/lib/portalDocumentos';
import { PaginaGestao, T, Ref, EstadoErro, EsqueletoLinhas } from '../../PortalLayout';
import { useAeroportosDocs, usePastasDocs } from '../../hooks';
import { usePessoasFluxo, useDirectoresAeroporto } from '../../hooksFluxo';
import { useCodificacaoActiva, useNumeroSeguinte } from '../../hooksCodificacao';
import EditorSeccao, { extensoesContrato, ESTILO_PROSA } from '../../edicao/EditorSeccao';
import { ROTULO_CAMPO, novoDocumentoEstruturado, textoDoNo } from '../../edicao/contrato';
import {
  PASSOS, indicePasso, problemasDoPasso, problemasParaGerar, resumoPreenchimento, estadoSeccao, actualizarSeccao,
  actualizarCabecalho, extrasDe, prepararParaGerar, nomeBaseFicheiro,
} from '../../edicao/assistente';
import {
  useModelosDocumento, useRascunhoEstruturado, useRecarregarRascunhos, criarRascunhoEstruturado,
  guardarRascunhoEstruturado, gerarRascunhoDocumento, preverPdf, rascunhoDoDocumento,
} from '../../edicao/hooksEstruturado';
import { DialogoRever, rotaRedigir } from './PortalRedigir';

const ATRASO_GRAVAR = 1500;
const CLASSIFICACOES = ['Uso interno', 'Restrito', 'Confidencial', 'Público'];

function Campo({ id, label, ajuda, erro, children, className }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {erro ? <p role="alert" className="text-sm text-red-700 dark:text-red-400">{erro}</p> : ajuda && <p className={cn('text-sm', T.tintaFraca)}>{ajuda}</p>}
    </div>
  );
}

function Passos({ passo, onIr, podeIr }) {
  const actual = indicePasso(passo);
  return (
    <ol className="flex flex-wrap items-center gap-2" aria-label="Passos do assistente">
      {PASSOS.map((p, i) => {
        const feito = i < actual;
        const activo = i === actual;
        return (
          <li key={p.chave} className="flex items-center gap-2">
            <button
              type="button"
              disabled={!podeIr(p.chave)}
              onClick={() => onIr(p.chave)}
              aria-current={activo ? 'step' : undefined}
              className={cn('flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50', T.foco,
                activo ? 'border-teal-700 bg-teal-50 text-teal-900 dark:border-teal-400 dark:bg-teal-950/60 dark:text-teal-100'
                  : feito ? 'border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300' : cn('border-slate-200 dark:border-slate-800', T.tintaFraca))}
            >
              <span className={cn('flex h-5 w-5 items-center justify-center rounded-full text-xs', activo ? 'bg-teal-700 text-white dark:bg-teal-400 dark:text-slate-900' : feito ? 'bg-slate-200 dark:bg-slate-700' : 'bg-slate-100 dark:bg-slate-800')}>
                {feito ? <Check className="h-3 w-3" aria-hidden="true" /> : i + 1}
              </span>
              {p.titulo}
            </button>
            {i < PASSOS.length - 1 && <span className={cn('h-px w-4', 'bg-slate-300 dark:bg-slate-700')} aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}

function EstadoGravacao({ estado, quando, erro }) {
  if (estado === 'gravando') return <span className={cn('inline-flex items-center gap-1.5 text-sm', T.tintaFraca)}><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />A gravar…</span>;
  if (estado === 'erro') return <span className={cn('inline-flex items-center gap-1.5 text-sm', T.vermelho)} title={erro}><CloudOff className="h-4 w-4" aria-hidden="true" />Não gravado — {erro}</span>;
  if (estado === 'pendente') return <span className={cn('inline-flex items-center gap-1.5 text-sm', T.ambar)}><Save className="h-4 w-4" aria-hidden="true" />Alterações por gravar</span>;
  if (quando) return <span className={cn('inline-flex items-center gap-1.5 text-sm', T.verde)}><CheckCircle2 className="h-4 w-4" aria-hidden="true" />Gravado às {quando.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</span>;
  return null;
}

// ── pré-visualização (HTML a partir do contrato; o PDF fiel vem do gerador) ─────────────────────────────────
function PreVisualizacao({ doc }) {
  const ext = useMemo(() => extensoesContrato(), []);
  const c = doc?.cabecalho || {};
  const historico = prepararParaGerar(doc).historico || [];
  return (
    <article className="mx-auto max-w-4xl rounded-lg border border-slate-200 bg-white p-6 text-slate-900 shadow-sm dark:border-slate-700">
      <style>{ESTILO_PROSA}</style>
      <table className="mb-6 w-full border-collapse text-sm">
        <tbody>
          <tr>
            <td rowSpan={3} className="w-28 border border-slate-300 p-2 text-center"><img src="/logo-sga.png" alt="SGA" className="mx-auto h-10 object-contain" /></td>
            <td colSpan={2} className="border border-slate-300 p-2 text-center text-base font-bold">{c.titulo || 'Sem título'}</td>
          </tr>
          <tr><td className="border border-slate-300 p-2"><b>N.º</b> {c.numero}</td><td className="border border-slate-300 p-2"><b>Revisão</b> {c.revisao} · <b>Data</b> {c.data}</td></tr>
          <tr><td className="border border-slate-300 p-2"><b>Aeroporto</b> {c.aeroporto} {c.aeroportoNome ? `— ${c.aeroportoNome}` : ''}</td><td className="border border-slate-300 p-2">{c.classificacao}</td></tr>
          <tr><td colSpan={3} className="border border-slate-300 p-2 text-xs"><b>Elaborado:</b> {c.elaboradoPor || '—'} · <b>Verificado:</b> {c.verificadoPor || '—'} · <b>Aprovado:</b> {c.aprovadoPor || '—'}</td></tr>
        </tbody>
      </table>
      {(doc?.seccoes || []).map((s, i) => {
        let html = '';
        try { html = generateHTML(s.conteudo, ext); } catch { html = ''; }
        return (
          <section key={s.id} className="mb-5">
            <h2 className="mb-2 border-b border-slate-200 pb-1 text-lg font-bold text-teal-900">{i + 1}. {s.titulo}</h2>
            {html && textoDoNo(s.conteudo).trim() || /<img|<table|<hr/.test(html)
              ? <div className="prose-gd" dangerouslySetInnerHTML={{ __html: html }} />
              : <p className="text-sm italic text-slate-400">(secção por preencher)</p>}
          </section>
        );
      })}
      <section>
        <h2 className="mb-2 border-b border-slate-200 pb-1 text-lg font-bold text-teal-900">Histórico de revisões</h2>
        <table className="w-full border-collapse text-sm">
          <thead><tr className="bg-slate-100"><th className="border border-slate-300 p-1.5 text-left">Rev.</th><th className="border border-slate-300 p-1.5 text-left">Data</th><th className="border border-slate-300 p-1.5 text-left">Descrição</th><th className="border border-slate-300 p-1.5 text-left">Autor</th></tr></thead>
          <tbody>{historico.map((h, i) => <tr key={i}><td className="border border-slate-300 p-1.5">{h.revisao}</td><td className="border border-slate-300 p-1.5">{h.data}</td><td className="border border-slate-300 p-1.5">{h.descricao}</td><td className="border border-slate-300 p-1.5">{h.autor}</td></tr>)}</tbody>
        </table>
      </section>
    </article>
  );
}

// ── página ──────────────────────────────────────────────────────────────────
export default function PortalRedigirAssistente() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const recarregarLista = useRecarregarRascunhos();

  const { data: modelosQ, isLoading: aCarregarModelos } = useModelosDocumento();
  const modelos = modelosQ?.modelos || [];
  const rascQ = useRascunhoEstruturado(id);
  const { data: aeroportos = [] } = useAeroportosDocs();
  const { data: pastas = [] } = usePastasDocs();
  const cod = useCodificacaoActiva();

  const [doc, setDoc] = useState(null);
  const [aeroportoId, setAeroportoId] = useState('');
  const [rascunho, setRascunho] = useState(null); // linha da tabela (id, documento_id, estado…)
  const [passo, setPasso] = useState('modelo');
  const [seccaoId, setSeccaoId] = useState(null);
  const [gravacao, setGravacao] = useState({ estado: 'ok', quando: null, erro: '' });
  const [gerar, setGerar] = useState({ aberto: false, busy: false, fase: '', resultado: null });
  const [pdfUrl, setPdfUrl] = useState(null);
  const [aPrever, setAPrever] = useState(false);
  const [rever, setRever] = useState(false);

  // contador de alterações: a gravação só limpa o «por gravar» se nada mudou entretanto
  const alteracoes = useRef(0);
  const gravadas = useRef(0);
  const estadoRef = useRef({});
  estadoRef.current = { doc, aeroportoId, rascunho };

  // carregar o rascunho existente (uma vez por id)
  const carregado = useRef(null);
  useEffect(() => {
    if (id === 'novo' || !rascQ.data || carregado.current === rascQ.data.id) return;
    if (rascunho?.id === rascQ.data.id) { carregado.current = rascQ.data.id; return; } // acabado de criar aqui
    carregado.current = rascQ.data.id;
    const r = rascQ.data;
    setRascunho(r);
    setDoc(r.conteudo);
    setAeroportoId(r.aeroporto_id || '');
    setSeccaoId(r.conteudo?.seccoes?.[0]?.id || null);
    setPasso(problemasDoPasso('cabecalho', { doc: r.conteudo, aeroportoId: r.aeroporto_id }).length ? 'cabecalho' : r.estado === 'gerado' ? 'previsualizar' : 'seccoes');
  }, [id, rascQ.data, rascunho?.id]);

  const modeloActual = useMemo(() => {
    if (!doc) return null;
    const ex = extrasDe(doc);
    return modelos.find(m => ex.modeloId && m.id === ex.modeloId) || modelos.find(m => m.classe_codigo === doc.modelo) || null;
  }, [doc, modelos]);
  const ajudaDe = useCallback((chave) => (modeloActual?.schema?.seccoes || []).find(s => s.chave === chave) || null, [modeloActual]);

  const gerado = rascunho?.estado === 'gerado';
  const existente = !!(rascunho?.documento_id || extrasDe(doc).documentoId);

  // ── alterações ────────────────────────────────────────────────────────────
  const mudar = useCallback((fn) => {
    setDoc(d => { const n = fn(d); return n; });
    alteracoes.current += 1;
    setGravacao(g => ({ ...g, estado: 'pendente' }));
  }, []);
  const setCab = (patch) => mudar(d => actualizarCabecalho(d, patch));
  const setExtras = (patch) => mudar(d => ({ ...d, extras: { ...extrasDe(d), ...patch } }));

  // Revisor e aprovador: as mesmas listas do «Pedir aprovação» (IniciarFluxo), que lê estes emails para os pré-preencher.
  const pessoasQ = usePessoasFluxo();
  const directoresQ = useDirectoresAeroporto(aeroportoId || null);
  const nomeDe = useCallback((email) => {
    if (!email) return '';
    const e = String(email).toLowerCase();
    const d = (directoresQ.data || []).find(x => String(x.email).toLowerCase() === e);
    const u = (pessoasQ.data || []).find(x => String(x.email).toLowerCase() === e);
    return d?.nome || u?.full_name || email;
  }, [directoresQ.data, pessoasQ.data]);
  const opcoesRevisor = useMemo(() => [
    { value: '', label: '— por indicar —' },
    ...(pessoasQ.data || []).map(u => ({ value: u.email, label: u.full_name ? `${u.full_name} · ${u.email}` : u.email })),
  ], [pessoasQ.data]);
  const opcoesAprovador = useMemo(() => {
    const dir = directoresQ.data || [];
    return [
      { value: '', label: '— o responsável do aeroporto —' },
      ...dir.map(d => ({ value: d.email, label: `${d.nome || d.email}${d.suplencia_id ? ` · suplente de ${d.titular_email}` : ' · responsável do aeroporto'}` })),
      ...(pessoasQ.data || []).filter(u => !dir.some(d => String(d.email).toLowerCase() === String(u.email).toLowerCase()))
        .map(u => ({ value: u.email, label: u.full_name ? `${u.full_name} · ${u.email}` : u.email })),
    ];
  }, [directoresQ.data, pessoasQ.data]);

  // ── gravação ──────────────────────────────────────────────────────────────
  const gravar = useCallback(async () => {
    const { doc: d, aeroportoId: a, rascunho: r } = estadoRef.current;
    if (!d || !r?.id || r.estado === 'gerado') return true;
    const marca = alteracoes.current;
    if (marca === gravadas.current) return true;
    setGravacao(g => ({ ...g, estado: 'gravando' }));
    try {
      await guardarRascunhoEstruturado(r.id, { conteudo: d, aeroportoId: a });
      gravadas.current = marca;
      setGravacao({ estado: alteracoes.current === marca ? 'ok' : 'pendente', quando: new Date(), erro: '' });
      return true;
    } catch (e) {
      setGravacao(g => ({ ...g, estado: 'erro', erro: e?.message || String(e) }));
      return false;
    }
  }, []);

  useEffect(() => {
    if (gravacao.estado !== 'pendente' || !rascunho?.id || gerado) return undefined;
    const t = setTimeout(gravar, ATRASO_GRAVAR);
    return () => clearTimeout(t);
  }, [doc, aeroportoId, gravacao.estado, rascunho?.id, gerado, gravar]);

  // aviso ao sair (fechar o separador, recarregar) com alterações por gravar
  const porGravar = gravacao.estado === 'pendente' || gravacao.estado === 'gravando' || gravacao.estado === 'erro' || (!rascunho && !!doc);
  useEffect(() => {
    if (!porGravar) return undefined;
    const f = (e) => { e.preventDefault(); e.returnValue = ''; return ''; };
    window.addEventListener('beforeunload', f);
    return () => window.removeEventListener('beforeunload', f);
  }, [porGravar]);
  // sair pela navegação interna: grava o que houver (sem esperar)
  useEffect(() => () => { if (alteracoes.current !== gravadas.current) gravar(); }, [gravar]);

  const voltarLista = async () => {
    if (alteracoes.current !== gravadas.current && rascunho?.id) {
      const ok = await gravar();
      if (!ok) { toast({ title: 'Há alterações por gravar', description: 'Não foi possível gravar. Tente de novo antes de sair.', variant: 'destructive' }); return; }
    } else if (!rascunho && doc && !window.confirm?.('O rascunho ainda não foi criado. Sair sem guardar?')) return;
    recarregarLista();
    navigate(`${PORTAL_BASE}/gestao/redigir`);
  };

  // ── passos ────────────────────────────────────────────────────────────────
  const escolherModelo = (m) => {
    const d = novoDocumentoEstruturado(m, { elaboradoPor: user?.full_name || user?.email || '' });
    setDoc({ ...d, extras: { modeloId: m.id || null } });
    setSeccaoId(d.seccoes[0]?.id || null);
    alteracoes.current += 1;
    setPasso('cabecalho');
  };

  const podeIr = (p) => {
    if (!doc) return p === 'modelo';
    if (p === 'modelo') return !rascunho; // o modelo só se escolhe antes de o rascunho existir
    if (p === 'cabecalho') return true;
    return !!rascunho && problemasDoPasso('cabecalho', { doc, aeroportoId }).length === 0;
  };

  const avancarDoCabecalho = async () => {
    const p = problemasDoPasso('cabecalho', { doc, aeroportoId });
    if (!existente && !extrasDe(doc).processo) p.push('Escolha o manual ou programa (processo).');
    if (p.length) { toast({ title: 'Falta completar o cabeçalho', description: p.join(' '), variant: 'destructive' }); return; }
    if (!rascunho) {
      try {
        const r = await criarRascunhoEstruturado({ conteudo: doc, aeroportoId, modeloId: extrasDe(doc).modeloId || null }, user);
        setRascunho(r);
        gravadas.current = alteracoes.current;
        setGravacao({ estado: 'ok', quando: new Date(), erro: '' });
        recarregarLista();
        navigate(rotaRedigir(r.id), { replace: true });
      } catch (e) {
        toast({ title: 'Não foi possível criar o rascunho', description: e?.message || String(e), variant: 'destructive' });
        return;
      }
    } else await gravar();
    setPasso('seccoes');
  };

  // ── cabeçalho: aeroporto, processo e número sugerido ─────────────────────
  const aeroSel = aeroportos.find(a => a.id === aeroportoId) || null;
  const extras = extrasDe(doc);
  const sugestao = useNumeroSeguinte(existente ? null : doc?.modelo, aeroSel?.codigo_icao, extras.processo);
  const escolherAeroporto = (v) => {
    const a = aeroportos.find(x => x.id === v);
    setAeroportoId(v || '');
    setCab({ aeroporto: a?.codigo_icao || '', aeroportoNome: a?.nome || '' });
  };
  const opcoesAero = aeroportos.map(a => ({ value: a.id, label: `${a.codigo_icao} · ${a.nome}` }));
  const opcoesProcesso = cod.processosActivos.map(p => ({ value: p.codigo, label: p.nome ? `${p.codigo} · ${p.nome}` : p.codigo }));
  const opcoesPasta = [{ value: '', label: '— sem pasta (fica fora da biblioteca até ser arrumado) —' }, ...pastas
    .filter(p => !aeroportoId || !p.aeroporto_id || p.aeroporto_id === aeroportoId)
    .map(p => ({ value: p.id, label: p.nome }))];

  // ── gerar ────────────────────────────────────────────────────────────────
  const problemas = doc ? problemasParaGerar(doc) : [];
  const resumo = doc ? resumoPreenchimento(doc) : null;

  const correrGerar = async () => {
    setGerar(g => ({ ...g, busy: true, fase: 'A preparar…' }));
    try {
      const res = await gerarRascunhoDocumento({ rascunho, conteudo: doc, aeroportoId }, user, (fase) => setGerar(g => ({ ...g, fase })));
      setDoc(res.conteudo);
      setRascunho(r => ({ ...r, documento_id: res.documentoId, estado: 'gerado', versao_gerada_id: res.versao?.id, conteudo_gerado: res.conteudo }));
      gravadas.current = alteracoes.current;
      setGravacao({ estado: 'ok', quando: new Date(), erro: '' });
      setGerar({ aberto: true, busy: false, fase: '', resultado: res });
      recarregarLista();
    } catch (e) {
      setGerar(g => ({ ...g, busy: false, fase: '' }));
      toast({ title: 'Não foi possível gerar o rascunho', description: e?.message || String(e), variant: 'destructive' });
    }
  };

  const verPdf = async () => {
    setAPrever(true);
    try {
      const blob = await preverPdf(prepararParaGerar(doc));
      setPdfUrl(URL.createObjectURL(blob));
    } catch (e) {
      toast({ title: 'Não foi possível gerar a pré-visualização em PDF', description: e?.message || String(e), variant: 'destructive' });
    } finally { setAPrever(false); }
  };
  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);

  // ── render ────────────────────────────────────────────────────────────────
  const cab = doc?.cabecalho || {};
  const seccao = (doc?.seccoes || []).find(s => s.id === seccaoId) || doc?.seccoes?.[0] || null;
  const ajuda = seccao ? ajudaDe(seccao.chave) : null;
  const historicoAjuda = ajudaDe('historico');

  const accoes = (
    <div className="flex items-center gap-3">
      {rascunho && <EstadoGravacao {...gravacao} />}
      <Button variant="outline" onClick={voltarLista}><ArrowLeft className="h-4 w-4" aria-hidden="true" />Rascunhos</Button>
    </div>
  );

  if (id !== 'novo' && rascQ.isLoading) return <PaginaGestao titulo="Redigir documento"><div className={T.caixa}><EsqueletoLinhas linhas={5} /></div></PaginaGestao>;
  if (id !== 'novo' && (rascQ.isError || (rascQ.isFetched && !rascQ.data))) {
    return (
      <PaginaGestao titulo="Redigir documento" accoes={accoes}>
        <div className={T.caixa}><EstadoErro titulo="Não foi possível abrir este rascunho" texto={rascQ.error?.message || 'O rascunho não existe ou não tem permissão para o abrir.'} onTentar={() => rascQ.refetch()} /></div>
      </PaginaGestao>
    );
  }

  return (
    <PaginaGestao
      titulo={cab.titulo || (doc ? `Novo ${modeloActual?.nome || doc.modelo}` : 'Novo documento a partir de modelo')}
      descricao={doc ? <span className="inline-flex flex-wrap items-center gap-2">{cab.numero && <Ref className="font-semibold">{cab.numero}</Ref>}<span>Revisão {cab.revisao || '00'}</span>{existente && <span>· revisão de documento existente</span>}</span> : 'Escolha o tipo de documento. Cada modelo traz as secções que a SGA exige, com ajuda e exemplos.'}
      accoes={accoes}
    >
      <Passos passo={passo} onIr={(p) => (p === 'seccoes' || p === 'previsualizar') && !rascunho ? avancarDoCabecalho() : setPasso(p)} podeIr={podeIr} />

      {gerado && passo !== 'previsualizar' && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-sky-300 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-100">
          <FileCheck2 className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className="flex-1">A revisão {cab.revisao} já foi gerada e está a seguir o fluxo de aprovação. Para mudar o texto, abra uma nova revisão.</span>
          <Button size="sm" onClick={() => setRever(true)}><History className="h-4 w-4" aria-hidden="true" />Rever com o editor</Button>
        </div>
      )}

      {/* 1 · modelo */}
      {passo === 'modelo' && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {aCarregarModelos ? <EsqueletoLinhas linhas={3} /> : modelos.map(m => {
            const secs = (m.schema?.seccoes || []);
            return (
              <button key={`${m.classe_codigo}-${m.id || m.nome}`} type="button" onClick={() => escolherModelo(m)}
                className={cn(T.caixa, T.foco, 'flex flex-col items-start gap-2 p-4 text-left transition-colors hover:border-teal-400 dark:hover:border-teal-600')}>
                <span className="flex items-center gap-2"><Ref className={cn('rounded bg-teal-50 px-1.5 py-0.5 font-bold dark:bg-teal-950/60', T.acento)}>{m.classe_codigo}</Ref><span className="font-semibold">{m.nome}</span></span>
                <span className={cn('text-sm', T.tintaFraca)}>{secs.length} secções · {secs.filter(s => s.obrigatoria).length} obrigatórias</span>
                <span className={cn('line-clamp-3 text-xs', T.tintaFraca)}>{secs.map(s => s.titulo).join(' · ')}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* 2 · cabeçalho */}
      {passo === 'cabecalho' && doc && (
        <div className={cn(T.caixa, 'space-y-5 p-5')}>
          <div className="grid gap-4 md:grid-cols-2">
            <Campo id="rd-aero" label="Aeroporto *" ajuda="O documento fica no aeroporto escolhido; o código entra no número.">
              <Select id="rd-aero" options={opcoesAero} value={aeroportoId} onValueChange={escolherAeroporto} placeholder="Escolha o aeroporto" disabled={gerado || existente} />
            </Campo>
            <Campo id="rd-proc" label={existente ? 'Manual ou programa' : 'Manual ou programa (processo) *'} ajuda="A que manual ou programa o documento pertence (ex. MOA, PSA, SMGCS). Entra no número.">
              <Select id="rd-proc" options={opcoesProcesso} value={extras.processo || ''} onValueChange={(v) => setExtras({ processo: v || null })} placeholder="Escolha o processo" disabled={gerado || existente} />
            </Campo>
            <Campo id="rd-num" label="Número *" ajuda={existente ? 'O número do documento não muda nas revisões.' : 'Formato classe-aeroporto-processo-sequência (ex. POP-FNLU-MOA-012). Use a sugestão para o número seguinte livre.'}>
              <div className="flex gap-2">
                <Input id="rd-num" value={cab.numero || ''} onChange={e => setCab({ numero: e.target.value.toUpperCase() })} disabled={gerado || existente} autoComplete="off" style={{ fontFamily: 'ui-monospace, Consolas, monospace' }} />
                {!existente && sugestao.data && sugestao.data !== cab.numero && (
                  <Button type="button" variant="outline" onClick={() => setCab({ numero: sugestao.data })} disabled={gerado} title="Número seguinte livre, calculado no servidor">
                    <Wand2 className="h-4 w-4" aria-hidden="true" />{sugestao.data}
                  </Button>
                )}
                {!existente && sugestao.isFetching && <Loader2 className="h-4 w-4 animate-spin self-center" aria-label="A calcular o número" />}
              </div>
            </Campo>
            <Campo id="rd-tit" label="Título *">
              <Input id="rd-tit" value={cab.titulo || ''} onChange={e => setCab({ titulo: e.target.value })} disabled={gerado} maxLength={300} autoComplete="off" placeholder="Ex.: Inspecção diária da área de movimento" />
            </Campo>
            <div className="grid grid-cols-2 gap-4">
              <Campo id="rd-rev" label="Revisão *" ajuda={existente ? 'Aumenta sozinha ao rever.' : 'A primeira emissão é a 00.'}>
                <Input id="rd-rev" value={cab.revisao || ''} onChange={e => setCab({ revisao: e.target.value })} disabled={gerado || existente} maxLength={6} />
              </Campo>
              <Campo id="rd-data" label="Data *">
                <Input id="rd-data" type="date" value={cab.data || ''} onChange={e => setCab({ data: e.target.value })} disabled={gerado} />
              </Campo>
            </div>
            <Campo id="rd-class" label="Classificação">
              <Select id="rd-class" options={[{ value: '', label: '— sem classificação —' }, ...CLASSIFICACOES.map(c => ({ value: c, label: c }))]} value={cab.classificacao || ''} onValueChange={(v) => setCab({ classificacao: v || '' })} searchable={false} disabled={gerado} />
            </Campo>
            <Campo id="rd-elab" label="Elaborado por *" ajuda="Quem redige é quem submete e assina como elaborador no fluxo de aprovação.">
              <Input id="rd-elab" value={cab.elaboradoPor || ''} readOnly disabled />
            </Campo>
            <Campo id="rd-verif" label="Verificado por" ajuda="As mesmas pessoas que o «Pedir aprovação» oferece; fica já escolhido lá. A assinatura faz-se no fluxo.">
              <Select id="rd-verif" options={opcoesRevisor} value={extras.verificadoEmail || ''} disabled={gerado}
                onValueChange={(v) => { setExtras({ verificadoEmail: v || null }); setCab({ verificadoPor: nomeDe(v) }); }} placeholder="Escolher o revisor" />
            </Campo>
            <Campo id="rd-aprov" label="Aprovado por" ajuda="Director (ou suplente) do aeroporto escolhido; em branco, fica o responsável do aeroporto."
              erro={extras.verificadoEmail && extras.aprovadoEmail && extras.verificadoEmail.toLowerCase() === extras.aprovadoEmail.toLowerCase() ? 'Quem revê e quem aprova têm de ser pessoas diferentes.' : null}>
              <Select id="rd-aprov" options={opcoesAprovador} value={extras.aprovadoEmail || ''} disabled={gerado}
                onValueChange={(v) => { setExtras({ aprovadoEmail: v || null }); setCab({ aprovadoPor: nomeDe(v) }); }} placeholder="Escolher quem aprova" />
            </Campo>
            {!existente && (
              <Campo id="rd-pasta" label="Pasta na biblioteca" ajuda="Pode arrumá-lo mais tarde em Gestão › Documentos.">
                <Select id="rd-pasta" options={opcoesPasta} value={extras.pastaId || ''} onValueChange={(v) => setExtras({ pastaId: v || null })} disabled={gerado} />
              </Campo>
            )}
          </div>
          <div className="flex justify-end gap-2">
            {!rascunho && <Button variant="outline" onClick={() => { setDoc(null); setPasso('modelo'); }}><ArrowLeft className="h-4 w-4" aria-hidden="true" />Mudar de modelo</Button>}
            <Button onClick={avancarDoCabecalho}>{rascunho ? 'Seguinte' : 'Criar rascunho e continuar'}<ArrowRight className="h-4 w-4" aria-hidden="true" /></Button>
          </div>
        </div>
      )}

      {/* 3 · secções */}
      {passo === 'seccoes' && doc && (
        <div className="space-y-3">
          <div className={cn('flex flex-wrap items-center gap-3 rounded-lg border px-4 py-2.5 text-sm', resumo.pronto ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100' : 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100')} role="status">
            {resumo.pronto ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <AlertTriangle className="h-4 w-4" aria-hidden="true" />}
            {resumo.pronto
              ? <span>Todas as secções obrigatórias estão preenchidas ({resumo.preenchidas} de {resumo.total} secções com texto).</span>
              : <span><strong>{resumo.obrigatoriasEmFalta}</strong> {resumo.obrigatoriasEmFalta === 1 ? 'secção obrigatória por preencher' : 'secções obrigatórias por preencher'}: {resumo.emFalta.map(s => s.titulo).join(', ')}.</span>}
          </div>
          <div className="grid gap-4 xl:grid-cols-[15rem_minmax(0,1fr)_19rem] lg:grid-cols-[13rem_minmax(0,1fr)]">
            <nav aria-label="Secções do documento" className={cn(T.caixa, 'h-max p-2 lg:sticky lg:top-[var(--topo-fixo,1rem)]')}>
              <ol className="space-y-0.5">
                {doc.seccoes.map((s, i) => {
                  const est = estadoSeccao(s);
                  const activa = seccao?.id === s.id;
                  return (
                    <li key={s.id}>
                      <button type="button" onClick={() => setSeccaoId(s.id)} aria-current={activa ? 'true' : undefined}
                        className={cn('flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left text-sm', T.foco, activa ? 'bg-teal-50 font-medium text-teal-900 dark:bg-teal-950/60 dark:text-teal-100' : T.realce)}>
                        {est === 'feita' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-label="preenchida" />
                          : est === 'falta' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-label="obrigatória por preencher" />
                            : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-label="opcional" />}
                        <span className="min-w-0 flex-1">{i + 1}. {s.titulo}{s.obrigatoria && <span className="text-amber-700 dark:text-amber-300"> *</span>}</span>
                      </button>
                    </li>
                  );
                })}
                <li>
                  <button type="button" onClick={() => setSeccaoId('__historico')} aria-current={seccaoId === '__historico' ? 'true' : undefined}
                    className={cn('flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left text-sm', T.foco, seccaoId === '__historico' ? 'bg-teal-50 font-medium text-teal-900 dark:bg-teal-950/60 dark:text-teal-100' : T.realce)}>
                    <History className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" /><span>Histórico de revisões</span>
                  </button>
                </li>
              </ol>
            </nav>

            {seccaoId === '__historico' ? (
              <div className={cn(T.caixa, 'space-y-3 p-4 xl:col-span-2')}>
                <h2 className="text-lg font-semibold">Histórico de revisões</h2>
                <p className={cn('text-sm', T.tintaFraca)}>{historicoAjuda?.ajuda || 'Cada revisão gerada acrescenta uma linha.'} Só a linha da revisão actual se pode alterar.</p>
                {!(doc.historico || []).length ? (
                  <p className={cn('text-sm italic', T.tintaFraca)}>Ao gerar, entra a linha «{cab.revisao || '00'} · Emissão inicial».</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead><tr className={cn('border-b text-left', T.linha, T.tintaFraca)}><th className="py-2 pr-3">Rev.</th><th className="py-2 pr-3">Data</th><th className="py-2 pr-3">Descrição</th><th className="py-2">Autor</th></tr></thead>
                    <tbody className={cn('divide-y', T.divisoria)}>
                      {doc.historico.map((h, i) => {
                        const actual = String(h.revisao) === String(cab.revisao) && !gerado;
                        return (
                          <tr key={i}>
                            <td className="py-2 pr-3 tabular-nums">{h.revisao}</td>
                            <td className="py-2 pr-3 tabular-nums">{h.data}</td>
                            <td className="py-2 pr-3">{actual
                              ? <Textarea rows={2} value={h.descricao || ''} aria-label="Descrição da revisão" onChange={e => mudar(d => ({ ...d, historico: d.historico.map((x, j) => (j === i ? { ...x, descricao: e.target.value } : x)) }))} />
                              : h.descricao}</td>
                            <td className="py-2">{h.autor}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            ) : seccao && (
              <>
                <div className="min-w-0 space-y-2">
                  <h2 className="flex items-baseline gap-2 text-lg font-semibold">
                    {doc.seccoes.indexOf(seccao) + 1}. {seccao.titulo}
                    {seccao.obrigatoria ? <span className="text-sm font-normal text-amber-700 dark:text-amber-300">obrigatória</span> : <span className={cn('text-sm font-normal', T.tintaFraca)}>opcional</span>}
                  </h2>
                  <EditorSeccao
                    key={seccao.id}
                    conteudo={seccao.conteudo}
                    editavel={!gerado}
                    placeholder={`Texto da secção «${seccao.titulo}»`}
                    onChange={(json) => mudar(d => actualizarSeccao(d, seccao.id, json))}
                  />
                  <div className="flex justify-between gap-2">
                    {(() => {
                      const i = doc.seccoes.indexOf(seccao);
                      return <>
                        <Button variant="outline" disabled={i <= 0} onClick={() => setSeccaoId(doc.seccoes[i - 1]?.id)}><ArrowLeft className="h-4 w-4" aria-hidden="true" />Anterior</Button>
                        {i < doc.seccoes.length - 1
                          ? <Button variant="outline" onClick={() => setSeccaoId(doc.seccoes[i + 1]?.id)}>Seguinte<ArrowRight className="h-4 w-4" aria-hidden="true" /></Button>
                          : <Button onClick={() => { gravar(); setPasso('previsualizar'); }}><Eye className="h-4 w-4" aria-hidden="true" />Pré-visualizar</Button>}
                      </>;
                    })()}
                  </div>
                </div>
                <aside className={cn(T.caixa, 'h-max space-y-3 p-4 text-sm lg:col-span-2 xl:col-span-1 xl:sticky xl:top-[var(--topo-fixo,1rem)]')} aria-label="Ajuda da secção">
                  <p className="flex items-center gap-2 font-semibold"><Lightbulb className="h-4 w-4 text-amber-500" aria-hidden="true" />O que escrever</p>
                  <p className={T.tintaMedia}>{ajuda?.ajuda || 'Sem ajuda para esta secção.'}</p>
                  {ajuda?.exemplo && <>
                    <p className="flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4 text-teal-600" aria-hidden="true" />Exemplo</p>
                    <blockquote className={cn('rounded-md border-l-4 border-teal-500 px-3 py-2 italic', T.superficieFraca, T.tintaMedia)}>{ajuda.exemplo}</blockquote>
                    {!gerado && <Button size="sm" variant="outline" onClick={() => {
                      const ex = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: ajuda.exemplo }] }] };
                      mudar(d => actualizarSeccao(d, seccao.id, ex));
                    }} title="Substitui o texto da secção pelo exemplo, para o adaptar">Usar o exemplo como ponto de partida</Button>}
                  </>}
                  <p className={cn('border-t pt-3 text-xs', T.linha, T.tintaFraca)}>Colar do Word funciona: a formatação estranha é limpa. Imagens são reduzidas para no máximo 1600 px.</p>
                </aside>
              </>
            )}
          </div>
        </div>
      )}

      {/* 4 · pré-visualizar e gerar */}
      {passo === 'previsualizar' && doc && (
        <div className="space-y-4">
          <div className={cn(T.caixa, 'flex flex-wrap items-center gap-3 p-4')}>
            {gerado ? (
              <>
                <FileCheck2 className="h-5 w-5 text-sky-600" aria-hidden="true" />
                <span className="flex-1 text-sm">A revisão {cab.revisao} foi gerada e está em rascunho no documento, à espera do fluxo de aprovação.</span>
                {rascunho?.documento_id && <Button variant="outline" asChild><Link to={`${PORTAL_BASE}/documento/${rascunho.documento_id}`}><FileText className="h-4 w-4" aria-hidden="true" />Abrir o documento</Link></Button>}
                <Button onClick={() => setRever(true)}><History className="h-4 w-4" aria-hidden="true" />Rever com o editor</Button>
              </>
            ) : (
              <>
                {problemas.length ? (
                  <div className="flex-1 text-sm text-amber-900 dark:text-amber-200" role="alert">
                    <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" aria-hidden="true" />Falta isto para poder gerar:</p>
                    <ul className="ml-6 mt-1 list-disc">{problemas.map((p, i) => <li key={i}>{p}</li>)}</ul>
                  </div>
                ) : <span className={cn('flex flex-1 items-center gap-2 text-sm', T.verde)}><CheckCircle2 className="h-4 w-4" aria-hidden="true" />Pronto para gerar a revisão {cab.revisao}.</span>}
                <Button variant="outline" onClick={verPdf} disabled={aPrever}>{aPrever ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}Ver o PDF</Button>
                <Button onClick={() => setGerar({ aberto: true, busy: false, fase: '', resultado: null })} disabled={!!problemas.length}><FileCheck2 className="h-4 w-4" aria-hidden="true" />Gerar rascunho</Button>
              </>
            )}
          </div>
          <div className="overflow-x-auto rounded-xl bg-slate-100 p-4 dark:bg-slate-950"><PreVisualizacao doc={doc} /></div>
        </div>
      )}

      {/* diálogo: gerar */}
      <Dialog open={gerar.aberto} onOpenChange={(o) => !o && !gerar.busy && setGerar({ aberto: false, busy: false, fase: '', resultado: null })}>
        <DialogContent className="max-w-lg">
          {gerar.resultado ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />Rascunho gerado</DialogTitle>
                <DialogDescription>A revisão {cab.revisao} ficou gravada como versão {gerar.resultado.versao?.versao ?? ''} em <strong>rascunho</strong> (PDF + Word editável). Para entrar em vigor, envie-a para revisão e aprovação no documento.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setGerar({ aberto: false, busy: false, fase: '', resultado: null })}>Fechar</Button>
                <Button asChild><Link to={`${PORTAL_BASE}/documento/${gerar.resultado.documentoId}`}><FileText className="h-4 w-4" aria-hidden="true" />Abrir o documento</Link></Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><FileCheck2 className="h-5 w-5 text-teal-600" aria-hidden="true" />Gerar a revisão {cab.revisao}?</DialogTitle>
                <DialogDescription>
                  {existente
                    ? 'Gera o PDF e o Word e grava-os como nova versão em rascunho do documento. A versão em vigor não muda.'
                    : `Cria o documento ${cab.numero} em rascunho e grava o PDF e o Word como a sua primeira versão.`}
                  {' '}Nada entra em vigor sem passar pela aprovação. Depois de gerar, o texto fica fechado; para o mudar abre-se uma nova revisão.
                </DialogDescription>
              </DialogHeader>
              {gerar.busy && <p className={cn('flex items-center gap-2 text-sm', T.tintaFraca)} role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{gerar.fase}</p>}
              <DialogFooter>
                <Button variant="outline" disabled={gerar.busy} onClick={() => setGerar({ aberto: false, busy: false, fase: '', resultado: null })}>Cancelar</Button>
                <Button disabled={gerar.busy} onClick={correrGerar}>{gerar.busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileCheck2 className="h-4 w-4" aria-hidden="true" />}Gerar rascunho</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* diálogo: PDF */}
      <Dialog open={!!pdfUrl} onOpenChange={(o) => { if (!o) { URL.revokeObjectURL(pdfUrl); setPdfUrl(null); } }}>
        <DialogContent className="h-[90vh] max-w-5xl">
          <DialogHeader className="flex-row items-start justify-between gap-4 space-y-0 pr-8">
            <div><DialogTitle>Pré-visualização do PDF</DialogTitle><DialogDescription>Ainda não foi gravado nada.</DialogDescription></div>
            {pdfUrl && <Button asChild variant="outline" size="sm"><a href={pdfUrl} download={`${nomeBaseFicheiro(prepararParaGerar(doc))}.pdf`}><Download className="h-4 w-4" aria-hidden="true" />Descarregar PDF</a></Button>}
          </DialogHeader>
          {pdfUrl && <iframe title="Pré-visualização do PDF" src={pdfUrl} className="h-full min-h-[70vh] w-full rounded border" />}
        </DialogContent>
      </Dialog>

      {rever && rascunho && (
        <DialogoRever
          rascunho={{ ...rascunho, conteudo: doc, conteudo_gerado: doc, revisao: cab.revisao }}
          onFechar={() => setRever(false)}
          onFeito={(r) => {
            setRever(false);
            setRascunho(x => ({ ...x, estado: 'em_edicao' }));
            setDoc(r.conteudo);
            gravadas.current = alteracoes.current;
            setGravacao({ estado: 'ok', quando: new Date(), erro: '' });
            setSeccaoId(r.conteudo?.seccoes?.[0]?.id || null);
            setPasso('seccoes');
            recarregarLista();
          }}
        />
      )}
    </PaginaGestao>
  );
}

// /gestao/redigir/documento/:documentoId — abre o rascunho do editor ligado a um documento (para um botão
// «Rever com o editor» na página do documento).
export function RedigirPorDocumento() {
  const { documentoId } = useParams();
  const navigate = useNavigate();
  const [erro, setErro] = useState('');
  useEffect(() => {
    let vivo = true;
    rascunhoDoDocumento(documentoId)
      .then(r => { if (!vivo) return; if (r) navigate(rotaRedigir(r.id), { replace: true }); else setErro('Este documento não foi redigido no editor: as revisões dele carregam-se como ficheiro em Gestão › Documentos.'); })
      .catch(e => vivo && setErro(e?.message || String(e)));
    return () => { vivo = false; };
  }, [documentoId, navigate]);
  return (
    <PaginaGestao titulo="Rever com o editor">
      <div className={T.caixa}>{erro ? <EstadoErro titulo="Não há rascunho do editor para este documento" texto={erro} /> : <EsqueletoLinhas linhas={2} />}</div>
    </PaginaGestao>
  );
}
