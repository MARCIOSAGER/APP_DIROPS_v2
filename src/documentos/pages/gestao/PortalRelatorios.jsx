// Relatórios do Portal de Documentos: cobertura de leitura (por aeroporto e por perfil), documentos a expirar,
// documentos por estado e actividade por período. Exportação para Excel/CSV e para PDF.
// Os PDF levam sempre o logótipo SGA (nunca o do sistema de origem) e dizem quem os gerou e quando.
// O separador e o período vivem no endereço, para um relatório poder ser citado tal como foi visto.
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, BarChart3, BookOpenCheck, Building2, CalendarClock, ClipboardCheck, Download, FileSpreadsheet, FileText,
  Info, ListChecks, Loader2, RefreshCw, Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import Select from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import { fmtData } from '@/lib/safeDate';
import { createPdfDoc, addHeader, addFooter, addTable, addSectionTitle, checkPageBreak, loadImageAsBase64, PDF } from '@/lib/pdfTemplate';
import { exportarExcel, nomeFicheiro } from '@/lib/formacaoExport';
import { PORTAL_BASE, ESTADOS_DOCUMENTO, ESTADO_LABEL, PERFIS_PORTAL_DOCS, PERFIL_DOC_LABEL, PERFIS_DOCUMENTOS, diasParaExpirar } from '@/lib/portalDocumentos';
import {
  useDocumentosDocs, useAeroportosDocs, useTodasLeiturasDocs, useAcessoAeroportoDocs,
  useAcessosDocs, useAuditoriaDocs, useRecarregarDocs,
} from '../../hooks';
import { EstadoChip, ValidadeChip, Vazio, Falha, mapaPorId, nomeAero, versaoDoc, emVigorDesde } from '../PortalBiblioteca';
import { useCodificacao, nomeProcesso, nomeClasse, nomeSetor } from '../../hooksCodificacao';
import { useMatrizConformidade } from '../../hooksConformidade';
import { tituloLimpoDoc } from '../../nomeDocumento';
import { PaginaGestao } from '../../PortalLayout';
import { Exportar, pdfDocumentos, descarregarCsv } from '../../exportar';
import {
  GD, Painel, Cabecalho, Tabela, Th, Tr, Td, LinhasEsqueleto, LinhaMensagem, TiraIndicadores,
  ComutadorDensidade, useDensidade, useFiltrosUrl, CelulaDocumento, textoVigor,
} from './PortalGestaoPainel';

const ABAS = ['lista', 'completude', 'cobertura', 'validade', 'estado', 'actividade'];
const revDoc = (d) => String(Math.max(0, (Number(versaoDoc(d)) || 1) - 1)).padStart(2, '0');
// manuais/planos exigidos pela norma (presença esperada em cada aeroporto)
const EXIGIDOS = [
  ['MOA', 'Manual de Operações do Aeródromo'], ['MGSO', 'Manual de Gestão da Segurança Operacional'],
  ['PEA', 'Plano de Emergência do Aeródromo'], ['PSCI', 'Plano de Salvamento e Combate a Incêndio'],
  ['PGRF', 'Plano de Gestão do Risco de Fauna'], ['PRAFS', 'Plano de Remoção de Aeronave Fora de Serviço'],
  ['SMGCS', 'Sistema de Orientação e Controlo na Superfície'], ['PBZPA', 'Plano Básico da Zona de Protecção'],
  ['PMA', 'Programa de Manutenção do Aeroporto'], ['PFOA', 'Programa de Formação do Operador'],
  ['PSA', 'Programa de Segurança do Aeroporto (AVSEC)'], ['PCA', 'Plano de Contingência do Aeroporto'],
];
const normTit = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const PERIODOS = [
  { value: '7', label: 'Últimos 7 dias' },
  { value: '30', label: 'Últimos 30 dias' },
  { value: '90', label: 'Últimos 90 dias' },
  { value: '365', label: 'Último ano' },
];
const iso = (d) => d.toISOString().slice(0, 10);
const pct = (feito, esperado) => (esperado > 0 ? Math.round((feito / esperado) * 100) : null);
// PDF do portal: logótipo SGA, cabeçalho repetido em todas as páginas e rodapé com quem gerou.
// Ordem das classes na Lista Mestre — a mesma das subpastas da Biblioteca (tools/ged-pastas/pastas-setor-classe.mjs).
const ORDEM_CLASSE_LM = ['MA', 'PL', 'PR', 'POP', 'NRM', 'RE', 'RINT', 'FR', 'FTO', 'FX', 'DO', 'LT', 'MT', 'CR', 'CRO', 'MP', 'MQ', 'PT'];
const ordemClasseLM = (c) => { const i = ORDEM_CLASSE_LM.indexOf(c); return i < 0 ? 99 : i; };

// Cobertura: barra com forma própria além da cor (a percentagem em texto ao lado).
function Barra({ valor }) {
  const v = valor == null ? 0 : valor;
  return (
    <div className="flex items-center gap-2">
      <div className={cn('h-1.5 w-20 shrink-0 overflow-hidden rounded-full', GD.superficieFraca)}>
        <div className={cn('h-full rounded-full', v >= 80 ? 'bg-emerald-500' : v >= 50 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: `${Math.min(100, v)}%` }} />
      </div>
      <span className={cn('tabular-nums text-sm', GD.tintaMedia)}>{valor == null ? '—' : `${v}%`}</span>
    </div>
  );
}

export default function PortalRelatorios() {
  const { user } = useAuth();
  const recarregar = useRecarregarDocs();
  const [altura, setAltura] = useDensidade();
  const [{ tab, periodo, aero, setor }, definir] = useFiltrosUrl({ tab: 'lista', periodo: '30', aero: '', setor: '' });
  const aba = ABAS.includes(tab) ? tab : 'lista';

  const docsQ = useDocumentosDocs({ limite: 1000 });
  const aeroportosQ = useAeroportosDocs();
  const cod = useCodificacao();
  const matrizQ = useMatrizConformidade();
  const leiturasQ = useTodasLeiturasDocs();
  const acessoAeroQ = useAcessoAeroportoDocs();
  const acessosQ = useAcessosDocs();
  const logQ = useAuditoriaDocs({ de: iso(new Date(Date.now() - Number(periodo) * 86400000)), limite: 3000 });

  const docs = docsQ.data || [];
  const aeroportos = aeroportosQ.data || [];
  const mapaAero = useMemo(() => mapaPorId(aeroportos), [aeroportos]);
  const emVigor = useMemo(() => docs.filter(d => (d.estado || 'em_vigor') === 'em_vigor'), [docs]);
  // A cobertura só faz sentido sobre os documentos que pedem «li e tomei conhecimento» (documento.exige_leitura).
  // Sem isto, a meta era toda a gente confirmar todos os documentos — um número grande que não quer dizer nada.
  const paraConfirmar = useMemo(() => emVigor.filter(d => d.exige_leitura), [emVigor]);
  const geradoPor = user?.email || undefined;
  const hoje = fmtData(new Date());

  // leituras: documento → conjunto de emails que confirmaram
  const porDocumento = useMemo(() => {
    const m = new Map();
    for (const l of leiturasQ.data || []) {
      const id = l.documento_id;
      if (!m.has(id)) m.set(id, new Set());
      m.get(id).add(String(l.email || '').toLowerCase());
    }
    return m;
  }, [leiturasQ.data]);

  // ── cobertura por aeroporto ──
  const cobAeroporto = useMemo(() => {
    const membros = new Map();
    for (const a of acessoAeroQ.data || []) {
      if (!membros.has(a.aeroporto_id)) membros.set(a.aeroporto_id, new Set());
      membros.get(a.aeroporto_id).add(String(a.email || '').toLowerCase());
    }
    const linhas = aeroportos.map(a => {
      const pessoas = membros.get(a.id) || new Set();
      const seus = paraConfirmar.filter(d => d.aeroporto_id === a.id);
      const esperado = pessoas.size * seus.length;
      let feito = 0;
      for (const d of seus) {
        const confirmou = porDocumento.get(d.id) || new Set();
        for (const e of pessoas) if (confirmou.has(e)) feito += 1;
      }
      return { id: a.id, nome: nomeAero(mapaAero, a.id), pessoas: pessoas.size, documentos: seus.length, esperado, feito, cobertura: pct(feito, esperado) };
    }).filter(l => l.documentos > 0 || l.pessoas > 0);
    const geral = paraConfirmar.filter(d => !d.aeroporto_id);
    if (geral.length) {
      const todas = new Set((acessoAeroQ.data || []).map(a => String(a.email || '').toLowerCase()));
      let feito = 0;
      for (const d of geral) { const c = porDocumento.get(d.id) || new Set(); for (const e of todas) if (c.has(e)) feito += 1; }
      linhas.push({ id: 'geral', nome: 'Documentos gerais (sem aeroporto)', pessoas: todas.size, documentos: geral.length, esperado: todas.size * geral.length, feito, cobertura: pct(feito, todas.size * geral.length) });
    }
    return linhas.sort((a, b) => (a.cobertura ?? 101) - (b.cobertura ?? 101));
  }, [aeroportos, acessoAeroQ.data, paraConfirmar, porDocumento, mapaAero]);

  // ── cobertura por perfil do portal ──
  const cobPerfil = useMemo(() => {
    const utilizadores = (acessosQ.data?.utilizadores || []).filter(u => u.status === 'ativo');
    if (!utilizadores.length) return null;
    return PERFIS_PORTAL_DOCS.map(p => {
      const pessoas = utilizadores.filter(u => Array.isArray(u.perfis) && u.perfis.includes(p.chave)).map(u => String(u.email || '').toLowerCase());
      const esperado = pessoas.length * paraConfirmar.length;
      let feito = 0;
      let comAlguma = 0;
      for (const e of pessoas) {
        let n = 0;
        for (const d of paraConfirmar) if ((porDocumento.get(d.id) || new Set()).has(e)) n += 1;
        feito += n;
        if (n > 0) comAlguma += 1;
      }
      return { chave: p.chave, nome: PERFIL_DOC_LABEL[p.chave], pessoas: pessoas.length, comAlguma, esperado, feito, cobertura: pct(feito, esperado) };
    }).filter(l => l.pessoas > 0);
  }, [acessosQ.data, paraConfirmar, porDocumento]);

  // ── validade ──
  const validade = useMemo(() => {
    const linhas = docs
      .filter(d => (d.estado || 'em_vigor') !== 'obsoleto' && diasParaExpirar(d) !== null)
      .map(d => ({ doc: d, dias: diasParaExpirar(d) }))
      .filter(l => l.dias <= 90)
      .sort((a, b) => a.dias - b.dias);
    return {
      linhas,
      expirados: linhas.filter(l => l.dias < 0).length,
      d30: linhas.filter(l => l.dias >= 0 && l.dias <= 30).length,
      d60: linhas.filter(l => l.dias > 30 && l.dias <= 60).length,
      d90: linhas.filter(l => l.dias > 60 && l.dias <= 90).length,
      semValidade: docs.filter(d => diasParaExpirar(d) === null).length,
    };
  }, [docs]);

  // ── estado ──
  const porEstado = useMemo(() => ESTADOS_DOCUMENTO.map(e => {
    const lista = docs.filter(d => (d.estado || 'rascunho') === e.chave);
    return { chave: e.chave, nome: e.label, n: lista.length, pct: pct(lista.length, docs.length) };
  }), [docs]);
  const porAeroportoEstado = useMemo(() => aeroportos.map(a => ({
    nome: nomeAero(mapaAero, a.id),
    total: docs.filter(d => d.aeroporto_id === a.id).length,
    ...Object.fromEntries(ESTADOS_DOCUMENTO.map(e => [e.chave, docs.filter(d => d.aeroporto_id === a.id && (d.estado || 'rascunho') === e.chave).length])),
  })).filter(l => l.total > 0), [aeroportos, docs, mapaAero]);

  // ── actividade ──
  const actividade = useMemo(() => {
    const registos = logQ.data || [];
    const porTipo = {};
    const porDoc = new Map();
    const porPessoa = new Map();
    for (const r of registos) {
      const t = r.tipo_acesso || 'outro';
      porTipo[t] = (porTipo[t] || 0) + 1;
      porDoc.set(r.documento_id, (porDoc.get(r.documento_id) || 0) + 1);
      const e = r.usuario_email || 'desconhecido';
      porPessoa.set(e, (porPessoa.get(e) || 0) + 1);
    }
    const mapaDocs = mapaPorId(docs);
    return {
      total: registos.length,
      porTipo,
      docs: [...porDoc.entries()].map(([id, n]) => ({ id, titulo: mapaDocs.get(id)?.titulo || 'Documento apagado ou sem acesso', numero: mapaDocs.get(id)?.numero || '', n })).sort((a, b) => b.n - a.n).slice(0, 15),
      pessoas: [...porPessoa.entries()].map(([email, n]) => ({ email, n })).sort((a, b) => b.n - a.n).slice(0, 15),
    };
  }, [logQ.data, docs]);

  // ── Lista Mestre de Documentos: por aeroporto → manual (processo), ordenada pelo código ──
  const listaMestre = useMemo(() => {
    const ordemAero = new Map(aeroportos.map((a, i) => [a.id, a.ordem ?? i]));
    const ordemProc = new Map((cod.processos || []).map((p, i) => [p.codigo, p.ordem ?? i]));
    const setorDe = (pk) => cod.mapaProcessos?.get?.(pk)?.setor_codigo || 'GERAL';
    const sel = docs.filter(d => (!aero || d.aeroporto_id === aero) && (!setor || setorDe(d.processo_codigo) === setor));
    const grupos = new Map(); // chave aero|proc → { aeroId, aero, proc, procNome, setorCod, setorNome, docs[] }
    for (const d of sel) {
      const ak = d.aeroporto_id || 'geral';
      const pk = d.processo_codigo || '—';
      const chave = `${ak}|${pk}`;
      if (!grupos.has(chave)) {
        const sc = setorDe(pk);
        grupos.set(chave, {
          aeroId: ak, aero: ak === 'geral' ? 'Documentos gerais' : nomeAero(mapaAero, ak),
          proc: pk, procNome: pk === '—' ? 'Sem manual atribuído' : (nomeProcesso(cod.mapaProcessos, pk) || pk),
          setorCod: sc, setorNome: nomeSetor(cod.mapaSetores, sc), setorCor: cod.mapaSetores?.get?.(sc)?.cor || null, docs: [],
        });
      }
      grupos.get(chave).docs.push(d);
    }
    const lista = [...grupos.values()];
    for (const g of lista) {
      g.docs.sort((a, b) => String(a.numero || a.titulo || '').localeCompare(String(b.numero || b.titulo || ''), 'pt'));
      // subdivisão por CLASSE dentro do manual (mesma ordem das pastas da Biblioteca)
      const porClasse = new Map();
      for (const d of g.docs) { const k = d.classe_codigo || '—'; if (!porClasse.has(k)) porClasse.set(k, []); porClasse.get(k).push(d); }
      g.classes = [...porClasse.entries()]
        .map(([k, ds]) => ({ cod: k, nome: k === '—' ? 'Sem classe' : `${k} — ${nomeClasse(cod.mapaClasses, k) || k}`, docs: ds }))
        .sort((a, b) => ordemClasseLM(a.cod) - ordemClasseLM(b.cod) || a.cod.localeCompare(b.cod));
      g.docs = g.classes.flatMap(c => c.docs);
    }
    lista.sort((a, b) =>
      (ordemAero.get(a.aeroId) ?? 999) - (ordemAero.get(b.aeroId) ?? 999)
      || String(a.aero).localeCompare(String(b.aero), 'pt')
      || (ordemProc.get(a.proc) ?? 999) - (ordemProc.get(b.proc) ?? 999)
      || String(a.proc).localeCompare(String(b.proc), 'pt'));
    return lista;
  }, [docs, aero, setor, aeroportos, cod.processos, cod.mapaProcessos, cod.mapaSetores, cod.mapaClasses, mapaAero]);

  const totalLM = useMemo(() => listaMestre.reduce((n, g) => n + g.docs.length, 0), [listaMestre]);
  const aeroEscolhido = aero ? nomeAero(mapaAero, aero) : 'Todos os aeroportos';
  const setorEscolhido = setor ? nomeSetor(cod.mapaSetores, setor) : null;
  const contextoLM = [aeroEscolhido, setorEscolhido].filter(Boolean).join(' · ');
  const linhaLM = (d) => [d.numero || '', tituloLimpoDoc(d), nomeClasse(cod.mapaClasses, d.classe_codigo) || '', fmtData(emVigorDesde(d)), revDoc(d)];
  const baseLM = `Lista_Mestre_${aero ? (mapaAero.get(aero)?.codigo_icao || 'aeroporto') : 'todos'}${setor ? `_${setor}` : ''}`;
  const exListaMestre = {
    csv: () => descarregarCsv(baseLM, ['Aeroporto', 'Manual', 'Código', 'Título', 'Tipo', 'Data de emissão', 'Nº Rev.'],
      listaMestre.flatMap(g => g.docs.map(d => [g.aero, `${g.procNome}${g.proc !== '—' ? ` (${g.proc})` : ''}`, ...linhaLM(d)]))),
    excel: () => exportarExcel(baseLM, [{
      nome: 'Lista Mestre', cabecalho: ['Aeroporto', 'Manual', 'Código', 'Título', 'Tipo', 'Data de emissão', 'Nº Rev.'],
      linhas: listaMestre.flatMap(g => g.docs.map(d => [g.aero, `${g.procNome}${g.proc !== '—' ? ` (${g.proc})` : ''}`, ...linhaLM(d)])),
    }]),
    pdf: () => pdfDocumentos({
      base: baseLM, titulo: 'Lista Mestre de Documentos', subtitulo: `${contextoLM} · ${hoje}`, geradoPor,
      meta: [`${totalLM} documento(s)`, `${listaMestre.length} manual(is)`],
      // uma tabela por classe; o título do manual só na primeira classe de cada manual
      seccoes: listaMestre.flatMap(g => g.classes.map((c, i) => ({
        titulo: i === 0 ? `${aero ? '' : g.aero + ' — '}${g.procNome}${g.proc !== '—' ? ` (${g.proc})` : ''}` : null,
        sub: `${c.nome} (${c.docs.length})`,
        colunas: [
          { label: 'Código', width: 42 }, { label: 'Título', width: 159 },
          { label: 'Data de emissão', width: 30 }, { label: 'Nº Rev.', width: 18 },
        ],
        linhas: c.docs.map(d => { const l = linhaLM(d); return [l[0], l[1], l[3], l[4]]; }),
      }))),
    }),
  };

  // ── Completude (manuais exigidos por aeroporto) + versões/duplicados ──
  const completude = useMemo(() => {
    const porAero = aeroportos.map(a => {
      const meus = docs.filter(d => d.aeroporto_id === a.id);
      const exig = EXIGIDOS.map(([cod, nome]) => ({ cod, nome, n: meus.filter(d => d.processo_codigo === cod).length }));
      const porTit = new Map();
      for (const d of meus) { const k = normTit(d.titulo); if (!porTit.has(k)) porTit.set(k, []); porTit.get(k).push(d); }
      const dups = [...porTit.values()].filter(g => g.length > 1);
      return {
        id: a.id, nome: nomeAero(mapaAero, a.id), total: meus.length,
        emVigor: meus.filter(d => (d.estado || 'em_vigor') === 'em_vigor').length,
        rascunho: meus.filter(d => d.estado === 'rascunho').length,
        classificados: meus.filter(d => d.classificado).length,
        comVersoes: meus.filter(d => (Number(versaoDoc(d)) || 1) > 1).length,
        exig, faltam: exig.filter(e => e.n === 0).map(e => e.cod), dups,
      };
    }).filter(x => x.total > 0);
    return porAero;
  }, [docs, aeroportos, mapaAero]);
  const totalFaltas = useMemo(() => completude.reduce((n, a) => n + a.faltam.length, 0), [completude]);
  const exCompletude = {
    csv: () => descarregarCsv('Completude', ['Aeroporto', ...EXIGIDOS.map(([c]) => c)], completude.map(a => [a.nome, ...a.exig.map(e => e.n || 'FALTA')])),
    excel: () => exportarExcel('Completude', [{ nome: 'Completude', cabecalho: ['Aeroporto', ...EXIGIDOS.map(([c]) => c)], linhas: completude.map(a => [a.nome, ...a.exig.map(e => e.n || 'FALTA')]) }]),
    pdf: () => pdfDocumentos({ base: 'Completude_e_Versoes', titulo: 'Completude e Versões', subtitulo: `Manuais exigidos por aeroporto · ${hoje}`, geradoPor,
      meta: [`${completude.length} aeroporto(s)`, `${totalFaltas} lacuna(s)`],
      seccoes: [{ titulo: 'Manuais/planos exigidos (nº de documentos; FALTA = ausente)',
        colunas: [{ label: 'Manual', width: 50 }, ...completude.map(a => ({ label: a.nome.split(' ')[0], width: Math.min(28, 180 / Math.max(1, completude.length)) }))],
        linhas: EXIGIDOS.map(([cod, nome]) => [`${cod} — ${nome}`, ...completude.map(a => { const e = a.exig.find(x => x.cod === cod); return e && e.n ? String(e.n) : 'FALTA'; })]) }] }),
  };

  // ── Cross-check com as normas: cada requisito tem documento do manual exigido, por aeroporto? ──
  const requisitos = useMemo(() => (Array.isArray(matrizQ.data) ? matrizQ.data : []).filter(r => r.processo_codigo), [matrizQ.data]);
  const crossCheck = useMemo(() => {
    const temDoc = (aid, proc) => docs.some(d => d.aeroporto_id === aid && d.processo_codigo === proc);
    const porAero = aeroportos.map(a => {
      const cob = requisitos.filter(r => temDoc(a.id, r.processo_codigo));
      const gap = requisitos.filter(r => !temDoc(a.id, r.processo_codigo));
      return { id: a.id, nome: nomeAero(mapaAero, a.id), coberto: cob.length, total: requisitos.length, gap, gapCriticas: gap.filter(r => r.criticidade === 'alta').length };
    }).filter(x => x.total > 0 && docs.some(d => d.aeroporto_id === x.id));
    const normas = [...new Set(requisitos.map(r => r.diploma_codigo))].length;
    return { porAero, normas, nReq: requisitos.length };
  }, [requisitos, docs, aeroportos, mapaAero]);
  const exCrossCheck = {
    csv: () => descarregarCsv('Cross_check_normas', ['Aeroporto', 'Requisitos cobertos', 'Total', 'Lacunas', 'Lacunas críticas', 'Manuais em falta'],
      crossCheck.porAero.map(a => [a.nome, a.coberto, a.total, a.gap.length, a.gapCriticas, [...new Set(a.gap.map(r => r.processo_codigo))].join(' ')])),
    excel: () => exportarExcel('Cross_check_normas', [{ nome: 'Cross-check normas', cabecalho: ['Aeroporto', 'Cobertos', 'Total', 'Lacunas', 'Críticas', 'Manuais em falta'], linhas: crossCheck.porAero.map(a => [a.nome, a.coberto, a.total, a.gap.length, a.gapCriticas, [...new Set(a.gap.map(r => r.processo_codigo))].join(' ')]) }]),
    pdf: () => pdfDocumentos({ base: 'Cross_check_normas', titulo: 'Cross-check com as normas', subtitulo: `${crossCheck.nReq} requisitos de ${crossCheck.normas} normas · ${hoje}`, geradoPor,
      meta: ['Cobertura: existe documento do manual exigido (não valida conteúdo)'],
      seccoes: [{ titulo: 'Cobertura por aeroporto', colunas: [{ label: 'Aeroporto', width: 70 }, { label: 'Cobertos', width: 28 }, { label: 'Total', width: 22 }, { label: 'Lacunas', width: 26 }, { label: 'Críticas', width: 26 }, { label: 'Manuais em falta', width: 60 }],
        linhas: crossCheck.porAero.map(a => [a.nome, a.coberto, a.total, a.gap.length, a.gapCriticas, [...new Set(a.gap.map(r => r.processo_codigo))].join(', ')]) }] }),
  };

  const aCarregar = docsQ.isLoading || leiturasQ.isLoading;
  const subtitulo = `Portal de Documentos · ${hoje}`;

  // ── exportações ──
  const expAeroporto = {
    cabecalho: ['Aeroporto', 'Pessoas com acesso', 'Documentos que exigem confirmação', 'Confirmações esperadas', 'Confirmações feitas', 'Cobertura (%)'],
    linhas: () => cobAeroporto.map(l => [l.nome, l.pessoas, l.documentos, l.esperado, l.feito, l.cobertura ?? '']),
  };
  const expPerfil = {
    cabecalho: ['Perfil', 'Pessoas', 'Já confirmaram alguma coisa', 'Confirmações esperadas', 'Confirmações feitas', 'Cobertura (%)'],
    linhas: () => (cobPerfil || []).map(l => [l.nome, l.pessoas, l.comAlguma, l.esperado, l.feito, l.cobertura ?? '']),
  };
  const expValidade = {
    cabecalho: ['Documento', 'Número', 'Versão', 'Aeroporto', 'Estado', 'Em vigor desde', 'Expira em', 'Dias', 'Responsável'],
    linhas: () => validade.linhas.map(({ doc: d, dias }) => [d.titulo, d.numero || '', versaoDoc(d), nomeAero(mapaAero, d.aeroporto_id), ESTADO_LABEL[d.estado] || d.estado || '', fmtData(d.em_vigor_desde), fmtData(d.expira_em), dias, d.responsavel_email || '']),
  };
  const expEstado = {
    cabecalho: ['Estado', 'Documentos', '% do total'],
    linhas: () => porEstado.map(l => [l.nome, l.n, l.pct ?? '']),
  };
  const expActividade = {
    cabecalho: ['Documento', 'Número', 'Acessos no período'],
    linhas: () => actividade.docs.map(l => [l.titulo, l.numero, l.n]),
  };

  const exportar = (nome, titulo, def, extra = []) => ({
    csv: () => descarregarCsv(`Documentos_${nome}`, def.cabecalho, def.linhas()),
    excel: () => exportarExcel(`Documentos_${nome}`, [{ nome: titulo.slice(0, 31), cabecalho: def.cabecalho, linhas: def.linhas() }, ...extra]),
    pdf: () => pdfDocumentos({
      base: `Documentos_${nome}`, titulo, subtitulo, geradoPor,
      meta: [`${def.linhas().length} linha(s)`],
      seccoes: [{ titulo, colunas: def.cabecalho.map((c, i) => ({ label: c, width: i === 0 ? 90 : 34 })), linhas: def.linhas(), vazio: 'Sem registos.' }],
    }),
  });

  const exAero = exportar('cobertura_aeroporto', 'Cobertura de leitura por aeroporto', expAeroporto);
  const exPerfil = exportar('cobertura_perfil', 'Cobertura de leitura por perfil', expPerfil);
  const exValidade = exportar('validade', 'Documentos a expirar (90 dias)', expValidade);
  const exEstado = exportar('estado', 'Documentos por estado', expEstado);
  const exActividade = exportar('actividade', `Actividade — últimos ${periodo} dias`, expActividade, [{ nome: 'Pessoas', cabecalho: ['Pessoa', 'Acessos'], linhas: actividade.pessoas.map(p => [p.email, p.n]) }]);

  if (docsQ.isError) {
    return (
      <PaginaGestao titulo="Relatórios">
        <Painel>
          <Falha
            titulo="Não foi possível carregar os documentos"
            texto={`${docsQ.error?.message || 'O servidor não respondeu.'} Sem a lista de documentos não há relatórios para mostrar. Tente de novo.`}
            onTentar={() => docsQ.refetch()}
          />
        </Painel>
      </PaginaGestao>
    );
  }

  return (
    <PaginaGestao
      titulo="Relatórios"
      descricao="Cobertura de leitura, validades, estados e actividade. Exporte para Excel/CSV ou PDF para juntar a uma auditoria — o PDF leva o logótipo SGA e diz quem o gerou."
      accoes={<>
        <ComutadorDensidade valor={altura} aoMudar={setAltura} />
        <Button variant="outline" onClick={() => recarregar()} disabled={docsQ.isFetching}><RefreshCw className={cn('h-4 w-4', docsQ.isFetching && 'animate-spin')} aria-hidden="true" />Actualizar</Button>
      </>}
    >
      {aCarregar ? (
        <Painel>
          <Tabela altura={altura} alturaMax="none" rotulo="A carregar os relatórios">
            <thead><tr><Th>Relatório</Th><Th>Valor</Th><Th className="hidden sm:table-cell">Detalhe</Th></tr></thead>
            <LinhasEsqueleto linhas={6} colunas={3} altura={altura} />
          </Tabela>
        </Painel>
      ) : docs.length === 0 ? (
        <Painel>
          <Vazio icone={BarChart3} titulo="Ainda não há dados para relatar" texto="Assim que houver documentos no portal, aparecem aqui a cobertura de leitura, as validades e a actividade.">
            <Button asChild><Link to={`${PORTAL_BASE}/gestao/documentos`}><FileText className="h-4 w-4" aria-hidden="true" />Ir para Documentos</Link></Button>
          </Vazio>
        </Painel>
      ) : (
        <Tabs value={aba} onValueChange={(t) => definir({ tab: t })}>
          <TabsList className="h-auto w-full justify-start overflow-x-auto sm:w-auto">
            <TabsTrigger value="lista" className="gap-1.5 py-1.5"><ListChecks className="h-4 w-4" aria-hidden="true" />Lista Mestre</TabsTrigger>
            <TabsTrigger value="completude" className="gap-1.5 py-1.5"><ClipboardCheck className="h-4 w-4" aria-hidden="true" />Completude e Versões</TabsTrigger>
            <TabsTrigger value="cobertura" className="gap-1.5 py-1.5"><BookOpenCheck className="h-4 w-4" aria-hidden="true" />Cobertura de leitura</TabsTrigger>
            <TabsTrigger value="validade" className="gap-1.5 py-1.5"><CalendarClock className="h-4 w-4" aria-hidden="true" />Validade</TabsTrigger>
            <TabsTrigger value="estado" className="gap-1.5 py-1.5"><FileText className="h-4 w-4" aria-hidden="true" />Estado</TabsTrigger>
            <TabsTrigger value="actividade" className="gap-1.5 py-1.5"><BarChart3 className="h-4 w-4" aria-hidden="true" />Actividade</TabsTrigger>
          </TabsList>

          {/* ── Lista Mestre de Documentos ── */}
          <TabsContent value="lista" className="mt-4 space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-full max-w-xs space-y-1.5">
                  <Label>Aeroporto</Label>
                  <Select
                    value={aero}
                    onValueChange={v => definir({ aero: v })}
                    options={[{ value: '', label: 'Todos os aeroportos' }, ...aeroportos.map(a => ({ value: a.id, label: a.codigo_icao ? `${a.codigo_icao} · ${a.nome}` : a.nome }))]}
                  />
                </div>
                <div className="w-full max-w-xs space-y-1.5">
                  <Label>Setor</Label>
                  <Select
                    value={setor}
                    onValueChange={v => definir({ setor: v })}
                    options={[{ value: '', label: 'Todos os setores' }, ...(cod.setores || []).map(s => ({ value: s.codigo, label: s.nome }))]}
                  />
                </div>
              </div>
              <Exportar onCsv={exListaMestre.csv} onExcel={exListaMestre.excel} onPdf={exListaMestre.pdf} desactivado={!totalLM} />
            </div>
            <p className={cn('flex items-start gap-2 rounded-lg border p-3 text-sm', GD.borda, GD.superficieFraca, GD.tintaMedia)}>
              <Info className={cn('mt-0.5 h-4 w-4 shrink-0', GD.acento)} aria-hidden="true" />
              O inventário oficial dos documentos, agrupado por manual (o 3.º segmento do código). O identificador é o <strong>Código do Documento</strong>; a Rev. vem da versão em vigor. Cada director vê apenas o seu aeroporto.
            </p>
            {aCarregar ? (
              <Painel><div className="p-4"><LinhasEsqueleto /></div></Painel>
            ) : !totalLM ? (
              <Vazio icone={ListChecks} titulo="Sem documentos para listar" texto="Ou ainda não há documentos neste aeroporto, ou os que existem não têm aeroporto atribuído. Insira os documentos com o seu código (ex.: POP-FNMO-PSCI-001) e aparecem aqui arrumados por manual." className="py-10" />
            ) : (
              listaMestre.map(g => (
                <Painel key={`${g.aeroId}|${g.proc}`}>
                  <Cabecalho
                    titulo={g.procNome}
                    contagem={g.docs.length}
                    icone={aero ? FileText : Building2}
                    descricao={
                      <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                        {!aero && <span>{g.aero}</span>}
                        {g.proc !== '—' && <span>Manual {g.proc}</span>}
                        <span className="inline-flex items-center gap-1">
                          <span className="inline-block h-2 w-2 rounded-full" style={g.setorCor ? { backgroundColor: g.setorCor } : undefined} aria-hidden="true" />
                          {g.setorNome}
                        </span>
                      </span>
                    }
                  />
                  <Tabela altura={altura} alturaMax="none" rotulo={`Lista mestre — ${g.procNome}`}>
                    <thead>
                      <tr>
                        <Th>Código</Th>
                        <Th>Título</Th>
                        <Th estreito>Data de emissão</Th>
                        <Th numerico estreito>Nº Rev.</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.classes.map(c => (
                        <React.Fragment key={c.cod}>
                          <tr>
                            <td colSpan={4} className={cn('border-b bg-slate-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide dark:bg-slate-800/60', GD.borda, GD.tintaMedia)}>
                              {c.nome} <span className={cn('ml-1 font-normal normal-case tracking-normal', GD.meta)}>· {c.docs.length}</span>
                            </td>
                          </tr>
                          {c.docs.map(d => (
                            <Tr key={d.id}>
                              <Td className={cn('whitespace-nowrap font-mono text-xs', GD.tintaForte)}>{d.numero || '—'}</Td>
                              <Td className={cn('text-sm', GD.tintaMedia)}>
                                <Link to={`${PORTAL_BASE}/documento/${d.id}`} className="hover:underline">{tituloLimpoDoc(d)}</Link>
                              </Td>
                              <Td className={cn('whitespace-nowrap text-sm tabular-nums', GD.meta)}>{fmtData(emVigorDesde(d)) || '—'}</Td>
                              <Td numerico className={cn('text-sm tabular-nums', GD.tintaMedia)}>{revDoc(d)}</Td>
                            </Tr>
                          ))}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </Tabela>
                </Painel>
              ))
            )}
          </TabsContent>

          {/* ── Completude e Versões ── */}
          <TabsContent value="completude" className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className={cn('flex items-start gap-2 rounded-lg border p-3 text-sm', GD.borda, GD.superficieFraca, GD.tintaMedia)}>
                <Info className={cn('mt-0.5 h-4 w-4 shrink-0', GD.acento)} aria-hidden="true" />
                Mostra se cada aeroporto tem os manuais/planos <strong>exigidos pela norma</strong> e o estado das versões. A presença vem da <strong>codificação</strong> (o 3.º segmento do número); não avalia se o <em>conteúdo</em> cumpre a norma.
              </p>
              <Exportar onCsv={exCompletude.csv} onExcel={exCompletude.excel} onPdf={exCompletude.pdf} desactivado={!completude.length} />
            </div>
            {aCarregar ? (
              <Painel><div className="p-4"><LinhasEsqueleto /></div></Painel>
            ) : !completude.length ? (
              <Vazio icone={ClipboardCheck} titulo="Sem documentos para analisar" texto="Assim que houver documentos com aeroporto, a completude aparece aqui." className="py-10" />
            ) : (
              <>
                <Painel>
                  <Cabecalho titulo="Manuais e planos exigidos" descricao={totalFaltas ? `${totalFaltas} lacuna(s) a verificar` : 'Todos presentes'} icone={ClipboardCheck} />
                  <Tabela altura={altura} alturaMax="none" rotulo="Completude por aeroporto">
                    <thead>
                      <tr><Th>Manual / Plano</Th>{completude.map(a => <Th key={a.id} numerico estreito>{a.nome.split(' · ')[0] || a.nome}</Th>)}</tr>
                    </thead>
                    <tbody>
                      {EXIGIDOS.map(([cod, nome]) => (
                        <Tr key={cod}>
                          <Td><span className={cn('font-mono text-xs font-semibold', GD.tintaForte)}>{cod}</span> <span className={cn('text-sm', GD.meta)}>{nome}</span></Td>
                          {completude.map(a => { const e = a.exig.find(x => x.cod === cod); const n = e?.n || 0;
                            return <Td key={a.id} numerico className={n ? cn('text-sm tabular-nums', GD.tintaMedia) : 'text-center text-xs font-bold text-red-600 dark:text-red-400'}>{n || 'FALTA'}</Td>; })}
                        </Tr>
                      ))}
                    </tbody>
                  </Tabela>
                </Painel>
                {completude.map(a => (
                  <Painel key={a.id}>
                    <Cabecalho titulo={a.nome} icone={Building2}
                      descricao={`${a.total} documentos · em vigor ${a.emVigor} · rascunho ${a.rascunho} · classificados (AVSEC) ${a.classificados} · com histórico de versões ${a.comVersoes}`} />
                    {a.faltam.length > 0 && (
                      <p className={cn('mx-3 my-2 flex items-start gap-2 rounded-lg border p-2.5 text-sm', 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200')}>
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        <span><strong>Faltam (a verificar):</strong> {a.faltam.join(' · ')}</span>
                      </p>
                    )}
                    {a.dups.length > 0 && (
                      <div className="px-3 pb-3">
                        <p className={cn('mb-1 mt-2 text-sm font-medium', GD.alerta)}>Possíveis duplicados (mesmo título):</p>
                        <ul className="space-y-0.5">
                          {a.dups.slice(0, 12).map((g, i) => (
                            <li key={i} className={cn('text-sm', GD.meta)}>«{g[0].titulo}» — <span className="font-mono text-xs">{g.map(x => x.numero || '—').join(', ')}</span></li>
                          ))}
                          {a.dups.length > 12 && <li className={cn('text-xs', GD.meta)}>… e mais {a.dups.length - 12}.</li>}
                        </ul>
                      </div>
                    )}
                  </Painel>
                ))}
                {crossCheck.porAero.length > 0 && (
                  <Painel>
                    <Cabecalho
                      titulo="Cross-check com as normas"
                      contagem={crossCheck.nReq}
                      icone={ClipboardCheck}
                      descricao={`${crossCheck.nReq} requisitos de ${crossCheck.normas} normas (NTA 22C e Instrutivos) · cobertura = existe documento do manual exigido; não valida o conteúdo`}
                      accoes={<Exportar onCsv={exCrossCheck.csv} onExcel={exCrossCheck.excel} onPdf={exCrossCheck.pdf} desactivado={!crossCheck.porAero.length} />}
                    />
                    <Tabela altura={altura} alturaMax="none" rotulo="Cross-check com as normas">
                      <thead>
                        <tr><Th>Aeroporto</Th><Th numerico estreito>Cobertos</Th><Th numerico estreito>Lacunas</Th><Th numerico estreito>Críticas</Th><Th>Manuais em falta</Th></tr>
                      </thead>
                      <tbody>
                        {crossCheck.porAero.map(a => {
                          const mans = [...new Set(a.gap.map(r => r.processo_codigo))];
                          return (
                            <Tr key={a.id}>
                              <Td className={cn('text-sm font-medium', GD.tinta)}>{a.nome}</Td>
                              <Td numerico className={cn('text-sm tabular-nums', a.coberto === a.total ? 'text-emerald-600 dark:text-emerald-400' : GD.tintaMedia)}>{a.coberto}/{a.total}</Td>
                              <Td numerico className={cn('text-sm tabular-nums', GD.meta)}>{a.gap.length}</Td>
                              <Td numerico className={cn('text-sm font-semibold tabular-nums', a.gapCriticas ? 'text-red-600 dark:text-red-400' : GD.meta)}>{a.gapCriticas}</Td>
                              <Td className={cn('text-xs', GD.meta)}>{mans.length ? mans.join(', ') : '—'}</Td>
                            </Tr>
                          );
                        })}
                      </tbody>
                    </Tabela>
                    <p className={cn('px-3 py-2 text-xs', GD.meta)}>Limite: isto verifica a <strong>existência</strong> de um documento para cada requisito, não se o conteúdo cumpre a norma (essa validação é do responsável, com apoio do módulo Conformidade).</p>
                  </Painel>
                )}
              </>
            )}
          </TabsContent>

          {/* ── cobertura ── */}
          <TabsContent value="cobertura" className="mt-4 space-y-4">
            <p className={cn('flex items-start gap-2 rounded-lg border p-3 text-sm', GD.borda, GD.superficieFraca, GD.tintaMedia)}>
              <Info className={cn('mt-0.5 h-4 w-4 shrink-0', GD.acento)} aria-hidden="true" />
              Cobertura = confirmações feitas ÷ esperadas (pessoas com acesso ao aeroporto × documentos desse aeroporto que exigem confirmação de leitura). Só entram os documentos marcados com «exige confirmação» e só conta quem está na lista de acessos por aeroporto.
            </p>

            <Painel>
              <Cabecalho
                titulo="Por aeroporto"
                contagem={cobAeroporto.length}
                descricao="Onde falta tomar conhecimento dos documentos em vigor. Ordenado pela cobertura mais baixa."
                accoes={<Exportar onCsv={exAero.csv} onExcel={exAero.excel} onPdf={exAero.pdf} desactivado={!cobAeroporto.length} />}
              />
              <Tabela altura={altura} alturaMax="none" rotulo="Cobertura de leitura por aeroporto">
                <thead>
                  <tr>
                    <Th>Aeroporto</Th>
                    <Th numerico estreito className="hidden sm:table-cell">Pessoas</Th>
                    <Th numerico estreito className="hidden sm:table-cell">Documentos</Th>
                    <Th numerico estreito>Confirmações</Th>
                    <Th>Cobertura</Th>
                  </tr>
                </thead>
                {acessoAeroQ.isLoading ? <LinhasEsqueleto linhas={4} colunas={5} altura={altura} />
                  : acessoAeroQ.isError ? (
                    <LinhaMensagem colunas={5}>
                      <Falha titulo="Não foi possível saber quem tem acesso a cada aeroporto" texto={`${acessoAeroQ.error?.message || 'Falha de rede.'} Sem essa lista não há denominador para a cobertura.`} onTentar={() => acessoAeroQ.refetch()} />
                    </LinhaMensagem>
                  ) : cobAeroporto.length === 0 ? (
                    <LinhaMensagem colunas={5}>
                      <Vazio icone={Users} titulo="Sem dados por aeroporto" texto="Ou nenhum documento exige confirmação de leitura, ou ainda não há pessoas associadas a aeroportos. Trate dos aeroportos em Acessos › Aeroportos." className="py-8">
                        <Button asChild variant="outline" size="sm"><Link to={`${PORTAL_BASE}/gestao/acessos?tab=aeroportos`}>Abrir Aeroportos</Link></Button>
                      </Vazio>
                    </LinhaMensagem>
                  ) : (
                    <tbody>
                      {cobAeroporto.map(l => (
                        <Tr key={l.id}>
                          <Td className={cn('max-w-[18rem] truncate font-medium', GD.tinta)}>{l.nome}</Td>
                          <Td numerico className={cn('hidden text-sm sm:table-cell', GD.meta)}>{l.pessoas}</Td>
                          <Td numerico className={cn('hidden text-sm sm:table-cell', GD.meta)}>{l.documentos}</Td>
                          <Td numerico className={cn('text-sm', GD.tintaMedia)}>{l.feito} / {l.esperado}</Td>
                          <Td><Barra valor={l.cobertura} /></Td>
                        </Tr>
                      ))}
                    </tbody>
                  )}
              </Tabela>
            </Painel>

            <Painel>
              <Cabecalho
                titulo="Por perfil do portal"
                contagem={cobPerfil?.length ?? null}
                descricao="Considera todos os documentos que exigem confirmação, por isso serve para comparar perfis entre si, não como valor absoluto."
                accoes={<Exportar onCsv={exPerfil.csv} onExcel={exPerfil.excel} onPdf={exPerfil.pdf} desactivado={!cobPerfil?.length} />}
              />
              <Tabela altura={altura} alturaMax="none" rotulo="Cobertura de leitura por perfil">
                <thead>
                  <tr>
                    <Th>Perfil</Th>
                    <Th numerico estreito className="hidden sm:table-cell">Pessoas</Th>
                    <Th numerico estreito className="hidden md:table-cell">Já confirmaram</Th>
                    <Th numerico estreito>Confirmações</Th>
                    <Th>Cobertura</Th>
                  </tr>
                </thead>
                {acessosQ.isLoading ? <LinhasEsqueleto linhas={3} colunas={5} altura={altura} />
                  : acessosQ.isError || !cobPerfil ? (
                    <LinhaMensagem colunas={5}>
                      <Falha
                        titulo="Cobertura por perfil indisponível"
                        texto={`A lista de utilizadores não está disponível (${acessosQ.error?.message || 'o serviço de acessos não respondeu'}), por isso não é possível calcular a cobertura por perfil. A cobertura por aeroporto, acima, não depende deste serviço.`}
                        onTentar={() => acessosQ.refetch()}
                      />
                    </LinhaMensagem>
                  ) : cobPerfil.length === 0 ? (
                    <LinhaMensagem colunas={5}>
                      <Vazio icone={Users} titulo="Sem perfis com pessoas activas" texto="Atribua perfis do portal em Acessos › Utilizadores." className="py-8">
                        <Button asChild variant="outline" size="sm"><Link to={`${PORTAL_BASE}/gestao/acessos?tab=utilizadores`}>Abrir Utilizadores</Link></Button>
                      </Vazio>
                    </LinhaMensagem>
                  ) : (
                    <tbody>
                      {cobPerfil.map(l => (
                        <Tr key={l.chave}>
                          <Td className={cn('font-medium', GD.tinta)}>{l.nome}</Td>
                          <Td numerico className={cn('hidden text-sm sm:table-cell', GD.meta)}>{l.pessoas}</Td>
                          <Td numerico className={cn('hidden text-sm md:table-cell', GD.meta)}>{l.comAlguma}</Td>
                          <Td numerico className={cn('text-sm', GD.tintaMedia)}>{l.feito} / {l.esperado}</Td>
                          <Td><Barra valor={l.cobertura} /></Td>
                        </Tr>
                      ))}
                    </tbody>
                  )}
              </Tabela>
            </Painel>
          </TabsContent>

          {/* ── validade ── */}
          <TabsContent value="validade" className="mt-4 space-y-4">
            <TiraIndicadores
              itens={[
                { chave: 'exp', label: 'Expirados', valor: validade.expirados, tom: 'perigo', zero: 'Nenhum documento expirado' },
                { chave: 'd30', label: 'Até 30 dias', valor: validade.d30, tom: 'alerta', zero: 'Nada expira nos próximos 30 dias' },
                { chave: 'd60', label: '31 a 60 dias', valor: validade.d60, tom: 'neutro', zero: null },
                { chave: 'd90', label: '61 a 90 dias', valor: validade.d90, tom: 'neutro', zero: null },
              ]}
              nota={`${validade.semValidade} documento(s) sem validade definida`}
            />
            <Painel>
              <Cabecalho
                titulo="Documentos a expirar nos próximos 90 dias"
                contagem={validade.linhas.length}
                descricao="Inclui os que já expiraram. O responsável é quem deve rever — a lista mostra os 100 mais urgentes e a exportação leva todos."
                accoes={<Exportar onCsv={exValidade.csv} onExcel={exValidade.excel} onPdf={exValidade.pdf} desactivado={!validade.linhas.length} />}
              />
              <Tabela altura={altura} rotulo="Documentos a expirar">
                <thead>
                  <tr>
                    <Th>Documento</Th>
                    <Th>Validade</Th>
                    <Th numerico estreito>Versão</Th>
                    <Th className="hidden md:table-cell">Em vigor desde</Th>
                    <Th className="hidden sm:table-cell">Estado</Th>
                    <Th className="hidden lg:table-cell">Responsável</Th>
                  </tr>
                </thead>
                {validade.linhas.length === 0 ? (
                  <LinhaMensagem colunas={6}>
                    <Vazio icone={CalendarClock} titulo="Nada a expirar nos próximos 90 dias" texto={`${validade.semValidade} documento(s) não têm validade definida. Se algum devia ter, acrescente a data em Documentos.`} className="py-8">
                      <Button asChild variant="outline" size="sm"><Link to={`${PORTAL_BASE}/gestao/documentos?validade=sem_validade`}>Ver os que não têm validade</Link></Button>
                    </Vazio>
                  </LinhaMensagem>
                ) : (
                  <tbody>
                    {validade.linhas.slice(0, 100).map(({ doc: d }) => (
                      <Tr key={d.id}>
                        <Td className="max-w-[24rem]"><CelulaDocumento doc={d} meta={nomeAero(mapaAero, d.aeroporto_id)} /></Td>
                        <Td>
                          <ValidadeChip documento={d} sempre />
                          <span className={cn('mt-0.5 block text-xs tabular-nums', GD.meta)}>{fmtData(d.expira_em)}</span>
                        </Td>
                        <Td numerico className={cn('text-sm', GD.ref, GD.meta)}>{versaoDoc(d)}</Td>
                        <Td className={cn('hidden text-sm tabular-nums md:table-cell', GD.meta)}>{textoVigor(d)}</Td>
                        <Td className="hidden sm:table-cell"><EstadoChip estado={d.estado} /></Td>
                        <Td className={cn('hidden max-w-[12rem] truncate text-sm lg:table-cell', d.responsavel_email ? GD.meta : GD.alerta)}>{d.responsavel_email || 'sem responsável'}</Td>
                      </Tr>
                    ))}
                  </tbody>
                )}
              </Tabela>
              {validade.linhas.length > 100 && <p className={cn('border-t px-3 py-2 text-sm', GD.borda, GD.meta)}>A lista mostra os 100 mais urgentes; a exportação leva todos ({validade.linhas.length}).</p>}
            </Painel>
          </TabsContent>

          {/* ── estado ── */}
          <TabsContent value="estado" className="mt-4 space-y-4">
            <Painel>
              <Cabecalho
                titulo="Documentos por estado"
                contagem={docs.length}
                descricao="Quantos documentos existem em cada passo do percurso de aprovação."
                accoes={<Exportar onCsv={exEstado.csv} onExcel={exEstado.excel} onPdf={exEstado.pdf} desactivado={!docs.length} />}
              />
              <Tabela altura={altura} alturaMax="none" rotulo="Documentos por estado">
                <thead>
                  <tr>
                    <Th>Estado</Th>
                    <Th numerico estreito>Documentos</Th>
                    <Th>Proporção</Th>
                  </tr>
                </thead>
                <tbody>
                  {porEstado.map(l => (
                    <Tr key={l.chave}>
                      <Td><EstadoChip estado={l.chave} /></Td>
                      <Td numerico className={cn('text-sm', GD.tintaMedia)}>{l.n}</Td>
                      <Td><Barra valor={l.pct ?? 0} /></Td>
                    </Tr>
                  ))}
                </tbody>
              </Tabela>
            </Painel>
            {porAeroportoEstado.length > 0 && (
              <Painel>
                <Cabecalho titulo="Estado por aeroporto" contagem={porAeroportoEstado.length} />
                <Tabela altura={altura} rotulo="Documentos por estado e aeroporto">
                  <thead>
                    <tr>
                      <Th>Aeroporto</Th>
                      {ESTADOS_DOCUMENTO.map(e => <Th key={e.chave} numerico estreito>{e.label}</Th>)}
                      <Th numerico estreito>Total</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {porAeroportoEstado.map(l => (
                      <Tr key={l.nome}>
                        <Td className={cn('max-w-[18rem] truncate font-medium', GD.tinta)}>{l.nome}</Td>
                        {ESTADOS_DOCUMENTO.map(e => <Td key={e.chave} numerico className={cn('text-sm', GD.meta)}>{l[e.chave] || 0}</Td>)}
                        <Td numerico className={cn('text-sm font-semibold', GD.tinta)}>{l.total}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </Tabela>
              </Painel>
            )}
          </TabsContent>

          {/* ── actividade ── */}
          <TabsContent value="actividade" className="mt-4 space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="w-56 space-y-1.5"><Label>Período</Label><Select options={PERIODOS} value={periodo} onValueChange={v => definir({ periodo: v })} /></div>
              <Exportar onCsv={exActividade.csv} onExcel={exActividade.excel} onPdf={exActividade.pdf} desactivado={!actividade.total} />
            </div>
            {logQ.isLoading ? (
              <Painel>
                <Tabela altura={altura} alturaMax="none" rotulo="A carregar a actividade">
                  <thead><tr><Th>Documento</Th><Th numerico estreito>Acessos</Th></tr></thead>
                  <LinhasEsqueleto linhas={5} colunas={2} altura={altura} />
                </Tabela>
              </Painel>
            ) : logQ.isError ? (
              <Painel>
                <Falha titulo="Não foi possível carregar a actividade" texto={`${logQ.error?.message || 'O servidor não respondeu.'} Os outros relatórios não dependem deste registo.`} onTentar={() => logQ.refetch()} />
              </Painel>
            ) : actividade.total === 0 ? (
              <Painel>
                <Vazio icone={BarChart3} titulo="Sem actividade no período" texto="Ninguém abriu documentos neste intervalo. Experimente um período maior.">
                  <Button variant="outline" onClick={() => definir({ periodo: '365' })}>Ver o último ano</Button>
                </Vazio>
              </Painel>
            ) : (
              <>
                <TiraIndicadores
                  itens={[
                    { chave: 'tot', label: 'Acessos', valor: actividade.total, tom: 'neutro', sempre: true },
                    { chave: 'abr', label: 'Aberturas', valor: actividade.porTipo.visualizacao || 0, tom: 'neutro', zero: 'Nenhuma abertura registada' },
                    { chave: 'des', label: 'Descargas', valor: actividade.porTipo.download || 0, tom: 'neutro', zero: 'Nenhuma descarga registada' },
                    { chave: 'pes', label: 'Pessoas distintas', valor: actividade.pessoas.length, tom: 'neutro', sempre: true },
                  ]}
                  nota={`Últimos ${periodo} dias`}
                />
                <div className="grid gap-4 xl:grid-cols-2">
                  <Painel>
                    <Cabecalho titulo="Documentos mais consultados" contagem={actividade.docs.length} />
                    <Tabela altura={altura} alturaMax="26rem" rotulo="Documentos mais consultados">
                      <thead><tr><Th>Documento</Th><Th numerico estreito>Acessos</Th></tr></thead>
                      <tbody>
                        {actividade.docs.map(d => (
                          <Tr key={d.id}>
                            <Td className="max-w-[24rem]">
                              {d.numero && <span className={cn('block whitespace-nowrap text-xs', GD.ref, GD.meta)} title={d.numero}>{d.numero}</span>}
                              <span className={cn('block line-clamp-2', GD.tintaMedia)} title={d.titulo || undefined}>{d.titulo}</span>
                            </Td>
                            <Td numerico className={cn('text-sm', GD.tinta)}>{d.n}</Td>
                          </Tr>
                        ))}
                      </tbody>
                    </Tabela>
                  </Painel>
                  <Painel>
                    <Cabecalho titulo="Quem consultou mais" contagem={actividade.pessoas.length} />
                    <Tabela altura={altura} alturaMax="26rem" rotulo="Quem consultou mais">
                      <thead><tr><Th>Pessoa</Th><Th numerico estreito>Acessos</Th></tr></thead>
                      <tbody>
                        {actividade.pessoas.map(p => (
                          <Tr key={p.email}>
                            <Td className={cn('max-w-[24rem] truncate', GD.tintaMedia)}>{p.email}</Td>
                            <Td numerico className={cn('text-sm', GD.tinta)}>{p.n}</Td>
                          </Tr>
                        ))}
                      </tbody>
                    </Tabela>
                  </Painel>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      )}

      {(docs.length >= 1000 || (leiturasQ.data || []).length >= 5000) && (
        <p className={cn('flex items-start gap-2 rounded-lg border p-3 text-sm', GD.avisoSuave)}>
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Os relatórios usam no máximo 1000 documentos e 5000 confirmações de leitura. Com mais do que isso, os números são uma amostra dos registos mais recentes.
        </p>
      )}
      <p className={cn('text-sm', GD.meta)}>Os perfis considerados são os do portal ({PERFIS_DOCUMENTOS.map(p => PERFIL_DOC_LABEL[p]).join(', ')}).</p>
    </PaginaGestao>
  );
}
