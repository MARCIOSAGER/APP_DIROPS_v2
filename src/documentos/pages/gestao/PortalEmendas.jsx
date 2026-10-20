// Registo de Emendas (/documentos/gestao/emendas) — a peça que a lei angolana impõe e que até aqui só existia na
// base de dados (migração 150).
//
// O que a lei fixa, e que este ecrã tem de dar sem interpretação:
//   • Instrutivo 22C.107.001.A, Anexo 3 — o Registo de Emendas tem SETE colunas, por esta ordem e com estes
//     nomes: Nº, Data da Modificação, Data de Inserção, Inserido por (em maiúsculas), Páginas Afectadas,
//     Resumo da Modificação, Aprovado por. Mostra-se e exporta-se a partir da vista `documento_registo_emendas`,
//     que tem exactamente esses títulos — aqui não se reescreve nenhum.
//   • Apêndice 1, §1.5 — folha de controlo numerada consecutivamente e datada, que se imprime e se entrega;
//     e trinta dias para os detentores confirmarem que inseriram a emenda.
//   • Apêndice 1, §1.7 — dois percursos: a EMENDA carece de aprovação prévia da ANAC; a CORRIGENDA (gralha,
//     telefone errado) não carece e nasce já aprovada. O gatilho da base de dados trata disso; aqui explica-se
//     a diferença em português simples, porque é a parte que faz as pessoas escolherem mal.
//   • Decisão do dono — as duas formas de emendar coexistem e escolhem-se emenda a emenda: por páginas
//     substituídas (diz-se quais saem e quais entram) ou por revisão do documento inteiro. O modo habitual de
//     cada documento (`modo_emenda_padrao`) é sugestão, não obrigação.
//
// Desenho: docs/desenho-portal-documentos.md. Tabelas densas com cabeçalho fixo e sem zebra, acções sempre
// focáveis por teclado, os três estados em todas as listas, e nenhuma cor escrita à mão (tudo por `T`/`tk`).
// O estado vive no endereço (separador, filtros, emenda escolhida), para uma vista poder ser citada numa
// auditoria tal como foi vista.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, Ban, Building2, Check, CheckCircle2, ClipboardCopy, Clock, Download, FileClock, FilePlus2,
  FileText, Loader2, Pencil, Printer, RefreshCw, RotateCcw, Send, Share2, Stamp, Users, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Select from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { cn, copyToClipboard } from '@/lib/utils';
import { fmtData, fmtDataHora } from '@/lib/safeDate';
import { PORTAL_BASE } from '@/lib/portalDocumentos';
import {
  createPdfDoc, addHeader, addFooter, addTable, addSectionTitle, addKeyValuePairs, checkPageBreak,
  loadImageAsBase64, PDF,
} from '@/lib/pdfTemplate';
import { nomeFicheiro } from '@/lib/formacaoExport';
import {
  PaginaGestao, T, MONO, Ref, EstadoSelo, EstadoVazio, EstadoErro, EsqueletoLinhas, TituloSeccao, dataVigor,
} from '../../PortalLayout';
import {
  tk, cartao, urlDoc, DENSIDADES, alturaDensidade, preferenciaDensidadeDocs, guardarPreferenciaDensidadeDocs,
  FichasFiltro, ResumoFiltros, TabelaDocumentos, EsqueletoTabela, mapaPorId, nomeAero, pessoaDeEmail, versaoDoc,
} from '../PortalBiblioteca';
import {
  COLUNAS_ANEXO3, useRegistoEmendas, useEmendasDocs, useConfirmacoesEmendas, useDocumentosDocs,
  useAeroportosDocs, useTiposDocumento, useAcessoAeroportoDocs, useResponsaveisAeroporto, useRecarregarDocs,
  guardarEmenda, marcarEstadoEmenda, confirmarEmendaInserida, guardarModoEmendaPadrao, auditarDocs,
} from '../../hooks';

// ── vocabulário das emendas ─────────────────────────────────────────────────
// Vocabulário fechado, como o dos documentos: cor **e** texto, sempre os dois, e a mesma paleta do selo de
// estado do documento (`EstadoSelo`), para o portal não ter dois dialectos de cor.
const ROTULO_ESTADO = {
  rascunho: 'Rascunho',
  enviada_anac: 'Enviada à ANAC',
  aprovada_anac: 'Aprovada',
  distribuida: 'Distribuída',
  cancelada: 'Cancelada',
};
const SELO_ESTADO = {
  rascunho: 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
  enviada_anac: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200',
  aprovada_anac: 'border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-200',
  distribuida: 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200',
  cancelada: 'border-slate-300 bg-slate-200/70 text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-400',
};
function SeloEmenda({ estado, className }) {
  const chave = SELO_ESTADO[estado] ? estado : 'rascunho';
  return (
    <span className={cn('inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-sm font-medium leading-5', SELO_ESTADO[chave], className)}>
      {ROTULO_ESTADO[chave]}
    </span>
  );
}

const ROTULO_TIPO = { emenda: 'Emenda', corrigenda: 'Corrigenda' };
const ROTULO_MODO = { paginas: 'Páginas substituídas', documento: 'Revisão do documento' };
const ROTULO_MODO_LONGO = {
  paginas: 'Por páginas substituídas — diz-se quais saem e quais entram',
  documento: 'Por revisão do documento inteiro — entra uma versão nova',
};

// O percurso de cada tipo. A corrigenda não passa pela ANAC: nasce aprovada (§1.7), por isso o seu percurso tem
// dois passos e não quatro — e é isso que o ecrã mostra, em vez de fingir passos que não existem.
const PASSOS_EMENDA = [
  { chave: 'rascunho', titulo: 'Registada', texto: 'A emenda está escrita no registo, ainda não saiu da SGA.', data: (e) => e.created_date },
  { chave: 'enviada_anac', titulo: 'Enviada à ANAC', texto: 'Duas cópias enviadas; a ANAC devolve uma assinada.', data: (e) => e.enviada_anac_em },
  { chave: 'aprovada_anac', titulo: 'Aprovada pela ANAC', texto: 'Aprovação prévia dada. Já pode entrar no manual.', data: (e) => e.aprovada_anac_em },
  { chave: 'distribuida', titulo: 'Distribuída aos detentores', texto: 'Começa aqui a contagem do prazo de confirmação.', data: (e) => e.distribuida_em },
];
const PASSOS_CORRIGENDA = [
  { chave: 'aprovada_anac', titulo: 'Registada e autorizada', texto: 'A corrigenda não carece de aprovação prévia da ANAC.', data: (e) => e.created_date },
  { chave: 'distribuida', titulo: 'Distribuída aos detentores', texto: 'Começa aqui a contagem do prazo de confirmação.', data: (e) => e.distribuida_em },
];
const passosDe = (e) => (e?.tipo === 'corrigenda' ? PASSOS_CORRIGENDA : PASSOS_EMENDA);
const ORDEM_ESTADO = { rascunho: 0, enviada_anac: 1, aprovada_anac: 2, distribuida: 3, cancelada: -1 };

// A acção que faz a emenda avançar um passo. Uma só por estado: o percurso não é um menu de opções.
function proximoPasso(e) {
  if (!e) return null;
  if (e.estado === 'rascunho') return e.tipo === 'corrigenda'
    ? { estado: 'distribuida', rotulo: 'Distribuir aos detentores', icone: Share2 }
    : { estado: 'enviada_anac', rotulo: 'Marcar como enviada à ANAC', icone: Send };
  if (e.estado === 'enviada_anac') return { estado: 'aprovada_anac', rotulo: 'Registar a aprovação da ANAC', icone: Stamp };
  if (e.estado === 'aprovada_anac') return { estado: 'distribuida', rotulo: 'Distribuir aos detentores', icone: Share2 };
  return null;
}

// ── contas de prazo (Apêndice 1, §1.5: trinta dias) ─────────────────────────
const DIA = 86400000;
const diasDesde = (quando) => {
  if (!quando) return null;
  const t = new Date(quando).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.floor((Date.now() - t) / DIA);
};
// Prazo em palavras, nunca só em cor: a forma segue o texto, como na validade dos documentos.
function textoPrazo(emenda) {
  const prazo = Number(emenda?.prazo_confirmacao) || 30;
  if (emenda?.estado !== 'distribuida' || !emenda?.distribuida_em) {
    return { chave: 'nao_comecou', texto: `Prazo de ${prazo} dias — começa na distribuição`, dias: null, restam: null };
  }
  const dias = diasDesde(emenda.distribuida_em) ?? 0;
  const restam = prazo - dias;
  if (restam < 0) return { chave: 'fora', texto: `Prazo ultrapassado há ${-restam} ${-restam === 1 ? 'dia' : 'dias'}`, dias, restam };
  if (restam === 0) return { chave: 'hoje', texto: 'Último dia do prazo', dias, restam };
  if (restam <= 7) return { chave: 'perto', texto: `Faltam ${restam} ${restam === 1 ? 'dia' : 'dias'}`, dias, restam };
  return { chave: 'dentro', texto: `Faltam ${restam} dias`, dias, restam };
}
const corPrazo = (chave) => (chave === 'fora' ? T.vermelho : chave === 'hoje' || chave === 'perto' ? T.ambar : T.tintaFraca);

// ── exportação: CSV e PDF, prontos a entregar à ANAC ────────────────────────
// Os títulos das colunas são os do Anexo 3, tal como a vista os devolve. O CSV vai com BOM e ponto e vírgula,
// que é o que o Excel em português abre sem perguntar nada.
const csvCampo = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
function descarregarCsv(base, cabecalho, linhas) {
  const csv = '﻿' + [cabecalho, ...linhas].map(l => l.map(csvCampo).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `${nomeFicheiro(base)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// As sete colunas, na ordem do Anexo 3 e com os nomes que a vista traz. A linha do CSV e a linha do PDF saem
// das mesmas células: o que se vê no ecrã, no ficheiro e no papel é o mesmo.
const celulasAnexo3 = (r) => COLUNAS_ANEXO3.map(c => {
  const v = r[c];
  if (c === 'Data da Modificação' || c === 'Data de Inserção') return v ? fmtData(v) : '';
  return v == null ? '' : String(v);
});

// A lista de trabalho (emendas de vários documentos) não é o Registo de Emendas: o registo é por documento e tem
// sete colunas fixas. Esta exportação serve para acompanhar o trabalho e para mandar a um director o que lhe diz
// respeito, por isso diz-se o que é no título — e junta o documento, o estado e as confirmações.
const COLUNAS_LISTA = [
  'Documento', 'Aeroporto', 'Nº', 'Tipo', 'Forma', 'Data da Modificação', 'Data de Inserção',
  'Inserido por', 'Páginas Afectadas', 'Resumo da Modificação', 'Aprovado por', 'Estado',
  'Folha de controlo', 'Confirmações', 'Prazo',
];

// Logótipo SGA — nunca o do sistema de origem. Se não vier, vai sem logótipo em vez de ir com outro qualquer.
async function logoSga() {
  try { return await loadImageAsBase64('/logo-sga.png'); } catch { return null; }
}
const identidadeDoc = (doc) => [doc?.numero, doc?.titulo].filter(Boolean).join(' — ') || 'Documento sem título';

// PDF do Registo de Emendas: paisagem, as sete colunas, e por baixo os resumos por extenso — a tabela corta o
// texto longo para caber na coluna, e um registo legal não se entrega com o resumo cortado.
async function pdfRegistoEmendas({ documento, linhas, geradoPor }) {
  const doc = await createPdfDoc({ orientation: 'landscape' });
  const logo = await logoSga();
  const meta = [
    `Documento: ${identidadeDoc(documento)}`,
    documento?.versao_atual || documento?.versao ? `Revisão em vigor: ${versaoDoc(documento)}` : null,
    dataVigor(documento) ? `Em vigor desde: ${fmtData(dataVigor(documento))}` : null,
    `Emendas registadas: ${linhas.length}`,
    geradoPor ? `Gerado por: ${geradoPor}` : null,
  ].filter(Boolean);
  let y = addHeader(doc, {
    title: 'Registo de Emendas',
    subtitle: 'Instrutivo 22C.107.001.A, Anexo 3',
    logoBase64: logo,
    date: new Date().toLocaleDateString('pt-PT'),
    meta,
  });
  const colunas = [
    { label: 'Nº', width: 12, align: 'right' },
    { label: 'Data da Modificação', width: 30 },
    { label: 'Data de Inserção', width: 28 },
    { label: 'Inserido por', width: 44 },
    { label: 'Páginas Afectadas', width: 38 },
    { label: 'Resumo da Modificação', width: 81 },
    { label: 'Aprovado por', width: 34 },
  ];
  if (!linhas.length) {
    doc.setFontSize(PDF.font.body); doc.setTextColor(...PDF.colors.muted);
    doc.text('Sem emendas registadas até à data.', PDF.margin.left, y + 4);
  } else {
    y = addTable(doc, y, { columns: colunas, rows: linhas.map(celulasAnexo3) }) + 6;
    // os resumos por extenso, numerados pelo Nº da emenda
    y = checkPageBreak(doc, y, 20);
    y = addSectionTitle(doc, y, 'Resumo das modificações, por extenso');
    doc.setFontSize(PDF.font.body);
    const largura = PDF.page.landscape.w - PDF.margin.left - PDF.margin.right;
    for (const r of linhas) {
      const texto = `Nº ${r['Nº']} — ${r['Resumo da Modificação'] || ''}`;
      const partes = doc.splitTextToSize(texto, largura);
      y = checkPageBreak(doc, y, partes.length * 4.5 + 4);
      doc.setTextColor(...PDF.colors.dark);
      doc.text(partes, PDF.margin.left, y + 3);
      y += partes.length * 4.5 + 3;
    }
  }
  addFooter(doc, { generatedBy: geradoPor || undefined, systemName: 'Portal de Documentos — SGA' });
  doc.save(`${nomeFicheiro(`Registo_de_Emendas_${documento?.numero || 'documento'}`)}.pdf`);
}

// PDF da lista de trabalho: paisagem, com os filtros aplicados escritos no cabeçalho, para a folha dizer sempre
// o que é que está a mostrar (e o que está a esconder).
async function pdfListaEmendas({ linhas, filtros, geradoPor }) {
  const doc = await createPdfDoc({ orientation: 'landscape' });
  const logo = await logoSga();
  let y = addHeader(doc, {
    title: 'Emendas e corrigendas',
    subtitle: 'Lista de acompanhamento — o Registo de Emendas de cada documento exporta-se à parte',
    logoBase64: logo,
    date: new Date().toLocaleDateString('pt-PT'),
    meta: [...filtros, `Emendas listadas: ${linhas.length}`, geradoPor ? `Gerado por: ${geradoPor}` : null].filter(Boolean),
  });
  const colunas = [
    { label: 'Documento', width: 56 },
    { label: 'Nº', width: 10, align: 'right' },
    { label: 'Tipo', width: 22 },
    { label: 'Forma', width: 30 },
    { label: 'Modificação', width: 22 },
    { label: 'Resumo da Modificação', width: 62 },
    { label: 'Estado', width: 26 },
    { label: 'Confirm.', width: 19, align: 'right' },
  ];
  if (!linhas.length) {
    doc.setFontSize(PDF.font.body); doc.setTextColor(...PDF.colors.muted);
    doc.text('Nenhuma emenda corresponde aos filtros aplicados.', PDF.margin.left, y + 4);
  } else {
    y = addTable(doc, y, { columns: colunas, rows: linhas.map(l => l.pdf) });
  }
  addFooter(doc, { generatedBy: geradoPor || undefined, systemName: 'Portal de Documentos — SGA' });
  doc.save(`${nomeFicheiro('Emendas_lista')}.pdf`);
}

// Folha de controlo de emenda: numerada consecutivamente e datada (Apêndice 1, §1.5). É o papel que o detentor
// assina e devolve — por isso leva o prazo escrito e as linhas de assinatura.
async function pdfFolhaControlo({ emenda, documento, geradoPor }) {
  const doc = await createPdfDoc({ orientation: 'portrait' });
  const logo = await logoSga();
  const prazo = Number(emenda?.prazo_confirmacao) || 30;
  let y = addHeader(doc, {
    title: `Folha de Controlo de Emenda nº ${emenda?.folha_controlo ?? '—'}`,
    subtitle: `${ROTULO_TIPO[emenda?.tipo] || 'Emenda'} nº ${emenda?.numero} · ${identidadeDoc(documento)}`,
    logoBase64: logo,
    date: new Date().toLocaleDateString('pt-PT'),
    meta: [
      `Folha emitida em: ${new Date().toLocaleDateString('pt-PT')}`,
      `Prazo de confirmação: ${prazo} dias`,
      geradoPor ? `Emitida por: ${geradoPor}` : null,
    ].filter(Boolean),
  });
  y = addSectionTitle(doc, y, 'Identificação da emenda');
  y = addKeyValuePairs(doc, y, [
    { label: 'Documento', value: identidadeDoc(documento) },
    { label: 'Emenda nº', value: String(emenda?.numero ?? '') },
    { label: 'Tipo', value: ROTULO_TIPO[emenda?.tipo] || 'Emenda' },
    { label: 'Forma', value: ROTULO_MODO_LONGO[emenda?.modo] || '' },
    { label: 'Páginas afectadas', value: emenda?.paginas_afectadas || '—' },
    { label: 'Data da modificação', value: emenda?.data_modificacao ? fmtData(emenda.data_modificacao) : '' },
    { label: 'Data de inserção', value: emenda?.data_insercao ? fmtData(emenda.data_insercao) : '—' },
    { label: 'Inserido por', value: emenda?.inserido_por || '—' },
    { label: 'Aprovado por', value: emenda?.aprovado_por || '—' },
    { label: 'Revisão resultante', value: emenda?.versao_resultante || '—' },
    { label: 'Enviada à ANAC', value: emenda?.enviada_anac_em ? fmtData(emenda.enviada_anac_em) : '—' },
    { label: 'Aprovada pela ANAC', value: emenda?.aprovada_anac_em ? fmtData(emenda.aprovada_anac_em) : '—' },
    { label: 'Distribuída', value: emenda?.distribuida_em ? fmtData(emenda.distribuida_em) : '—' },
  ], { labelWidth: 48 });

  y = checkPageBreak(doc, y + 2, 30);
  y = addSectionTitle(doc, y, 'Resumo da modificação');
  doc.setFontSize(PDF.font.body); doc.setTextColor(...PDF.colors.dark);
  const largura = PDF.page.portrait.w - PDF.margin.left - PDF.margin.right;
  const resumo = doc.splitTextToSize(String(emenda?.resumo || ''), largura);
  y = checkPageBreak(doc, y, resumo.length * 4.5 + 6);
  doc.text(resumo, PDF.margin.left, y + 3);
  y += resumo.length * 4.5 + 6;

  y = checkPageBreak(doc, y, 60);
  y = addSectionTitle(doc, y, 'Confirmação do detentor');
  doc.setFontSize(PDF.font.body); doc.setTextColor(...PDF.colors.body);
  const aviso = doc.splitTextToSize(
    `Dentro de ${prazo} dias a contar da emissão desta emenda, o detentor confirma, por assinatura e data, que a inseriu `
    + 'no seu exemplar e que retirou as páginas substituídas. Devolva esta folha assinada à gestão documental da SGA '
    + '(Instrutivo 22C.107.001.A, Apêndice 1, §1.5).', largura);
  doc.text(aviso, PDF.margin.left, y + 3);
  y += aviso.length * 4.5 + 8;

  doc.setDrawColor(...PDF.colors.separator);
  doc.setLineWidth(0.2);
  const linhasAssinatura = ['Nome do detentor', 'Cargo', 'Aeroporto / Serviço', 'Assinatura', 'Data'];
  for (const rotulo of linhasAssinatura) {
    y = checkPageBreak(doc, y, 14);
    doc.line(PDF.margin.left, y + 8, PDF.margin.left + largura * 0.75, y + 8);
    doc.setFontSize(PDF.font.small); doc.setTextColor(...PDF.colors.muted);
    doc.text(rotulo, PDF.margin.left, y + 12);
    y += 16;
  }
  addFooter(doc, { generatedBy: geradoPor || undefined, systemName: 'Portal de Documentos — SGA' });
  doc.save(`${nomeFicheiro(`Folha_de_Controlo_${emenda?.folha_controlo ?? 'emenda'}`)}.pdf`);
}

// ── peças pequenas ──────────────────────────────────────────────────────────
function Caixa({ titulo, icone: Icone, accoes, children, className }) {
  return (
    <section className={cn(cartao, className)}>
      {(titulo || accoes) && (
        <div className={cn('flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3', tk.borda)}>
          <h2 className={cn('flex items-center gap-2 text-sm font-semibold', tk.tinta)}>
            {Icone && <Icone className={cn('h-4 w-4', tk.acento)} aria-hidden="true" />}{titulo}
          </h2>
          {accoes && <div className="flex flex-wrap items-center gap-2">{accoes}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

// Comutador de densidade das linhas (40/48/56), guardado neste navegador, como na biblioteca.
function ComutadorDensidade({ valor, aoMudar }) {
  return (
    <div className={cn('inline-flex items-center gap-0.5 rounded-lg border p-0.5', tk.borda, tk.superficie)} role="group" aria-label="Altura das linhas">
      {DENSIDADES.map(d => (
        <button
          key={d.value}
          type="button"
          aria-pressed={valor === d.value}
          title={`Linhas de ${d.px}`}
          onClick={() => aoMudar(d.value)}
          className={cn('min-h-[2rem] rounded-md px-2 text-xs font-medium', tk.foco,
            valor === d.value ? cn(tk.acentoFundo, tk.acento) : cn(tk.tintaFraca, tk.hover))}
        >
          {d.label}
        </button>
      ))}
    </div>
  );
}

function Botao({ children, aoClicar, icone: Icone, variante = 'outline', pequeno = true, desactivado, ocupado, titulo }) {
  return (
    <Button
      type="button"
      variant={variante}
      size={pequeno ? 'sm' : undefined}
      title={titulo}
      disabled={desactivado || ocupado}
      onClick={aoClicar}
      className={pequeno ? 'min-h-[2.25rem]' : 'min-h-[2.75rem]'}
    >
      {ocupado ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : Icone ? <Icone className="h-4 w-4" aria-hidden="true" /> : null}
      {children}
    </Button>
  );
}

// Exportações de um registo: CSV para quem trabalha os dados, PDF com o logótipo SGA para quem entrega à ANAC.
function Exportacoes({ onCsv, onPdf, desactivado }) {
  const { toast } = useToast();
  const [ocupado, setOcupado] = useState(null);
  const correr = async (tipo, fn) => {
    if (!fn) return;
    setOcupado(tipo);
    try { await fn(); }
    catch (e) { toast({ title: 'Não foi possível exportar', description: e?.message || String(e), variant: 'destructive' }); }
    finally { setOcupado(null); }
  };
  return (
    <>
      <Botao icone={Download} ocupado={ocupado === 'csv'} desactivado={desactivado} aoClicar={() => correr('csv', onCsv)}>CSV</Botao>
      <Botao icone={FileText} ocupado={ocupado === 'pdf'} desactivado={desactivado} aoClicar={() => correr('pdf', onPdf)}>PDF</Botao>
    </>
  );
}

// ── a diferença entre emenda e corrigenda, em português simples ─────────────
// Está escrito no ecrã e não num balão de ajuda: é a escolha que as pessoas fazem mal, e fazê-la mal significa
// pôr no manual uma alteração que precisava de aprovação prévia da ANAC.
function ExplicacaoPercursos({ className }) {
  return (
    <div className={cn('grid gap-3 sm:grid-cols-2', className)}>
      <div className={cn('rounded-xl border p-4', tk.borda, tk.superficie)}>
        <p className={cn('flex items-center gap-2 text-sm font-semibold', tk.tinta)}>
          <Stamp className={cn('h-4 w-4', tk.acento)} aria-hidden="true" />Emenda — precisa da ANAC
        </p>
        <p className={cn('mt-1.5 text-sm', tk.tintaMedia)}>
          Muda o que o manual diz: procedimentos, responsabilidades, dados operacionais. Antes de entrar no
          manual tem de ser enviada à ANAC e esperar a aprovação. O percurso é
          <span className={tk.tinta}> rascunho → enviada à ANAC → aprovada → distribuída</span>.
        </p>
      </div>
      <div className={cn('rounded-xl border p-4', tk.borda, tk.superficie)}>
        <p className={cn('flex items-center gap-2 text-sm font-semibold', tk.tinta)}>
          <Check className={cn('h-4 w-4', tk.verde)} aria-hidden="true" />Corrigenda — não precisa
        </p>
        <p className={cn('mt-1.5 text-sm', tk.tintaMedia)}>
          Corrige uma gralha, um número de telefone errado, um nome mal escrito — sem mudar o que o manual manda
          fazer. Faz-se, regista-se e distribui-se: nasce já aprovada. Se tiver dúvidas se muda o conteúdo,
          é emenda.
        </p>
      </div>
    </div>
  );
}

// ── Registo de Emendas de um documento (Anexo 3) ────────────────────────────
// Componente exportado: é o mesmo bloco na gestão e no separador «Emendas» da ficha do documento. As colunas
// vêm da vista — não há aqui uma segunda lista de títulos que possa divergir da lei.
export function RegistoEmendasDocumento({ documento, documentoId, user, podeConfirmar = false, className }) {
  const docId = documentoId || documento?.id || null;
  const { toast } = useToast();
  const recarregar = useRecarregarDocs();
  const registoQ = useRegistoEmendas({ documentoId: docId });
  const confirmacoesQ = useConfirmacoesEmendas();
  const [aConfirmar, setAConfirmar] = useState(null);

  // Por ordem de número, do 1 para a frente: o Registo de Emendas é um livro de registo, e lê-se como tal — é
  // nessa ordem que a ANAC o confere e é nessa ordem que sai no CSV e no PDF.
  const linhas = useMemo(() => (registoQ.data || []).slice().sort((a, b) => Number(a['Nº']) - Number(b['Nº'])), [registoQ.data]);
  const meuEmail = String(user?.email || '').toLowerCase();
  const minhas = useMemo(() => {
    const s = new Set();
    for (const c of confirmacoesQ.data || []) if (String(c.email).toLowerCase() === meuEmail) s.add(c.emenda_id);
    return s;
  }, [confirmacoesQ.data, meuEmail]);

  // As que me faltam confirmar: só as distribuídas (antes disso não há nada para inserir no exemplar).
  const porConfirmar = useMemo(
    () => (!podeConfirmar || !meuEmail ? [] : linhas.filter(r => r.estado === 'distribuida' && !minhas.has(r.emenda_id))),
    [linhas, minhas, podeConfirmar, meuEmail],
  );

  const confirmar = async (r) => {
    setAConfirmar(r.emenda_id);
    try {
      await confirmarEmendaInserida(r.emenda_id, user);
      await auditarDocs(user, { acao: 'confirmar_emenda', entidade: 'documento_emenda', id: r.emenda_id, detalhes: `Emenda nº ${r['Nº']}` });
      recarregar('emendas-confirmacoes');
      recarregar('registo-emendas');
      toast({ title: 'Confirmação registada', description: `Fica provado que inseriu a emenda nº ${r['Nº']}.` });
    } catch (e) {
      toast({ title: 'Não foi possível confirmar', description: e?.message || String(e), variant: 'destructive' });
    } finally { setAConfirmar(null); }
  };

  const exportar = {
    csv: () => descarregarCsv(`Registo_de_Emendas_${documento?.numero || 'documento'}`, COLUNAS_ANEXO3, linhas.map(celulasAnexo3)),
    pdf: () => pdfRegistoEmendas({ documento, linhas, geradoPor: user?.full_name || user?.email }),
  };

  return (
    <div className={cn('space-y-4', className)}>
      {podeConfirmar && porConfirmar.length > 0 && (
        <Caixa titulo="Falta a sua confirmação" icone={Clock}>
          <ul className={cn('divide-y', tk.divisoria)}>
            {porConfirmar.map(r => {
              const prazo = textoPrazo({ estado: r.estado, distribuida_em: r.distribuida_em, prazo_confirmacao: r.prazo_confirmacao });
              return (
                <li key={r.emenda_id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                  <Ref className={cn('font-semibold', tk.tinta)}>nº {r['Nº']}</Ref>
                  <span className={cn('min-w-0 flex-1 text-sm', tk.tintaMedia)}>{r['Resumo da Modificação']}</span>
                  <span className={cn('text-sm', corPrazo(prazo.chave))}>{prazo.texto}</span>
                  <Botao icone={CheckCircle2} variante="default" ocupado={aConfirmar === r.emenda_id} aoClicar={() => confirmar(r)}>
                    Confirmo que inseri
                  </Botao>
                </li>
              );
            })}
          </ul>
        </Caixa>
      )}

      <Caixa
        titulo="Registo de Emendas (Anexo 3)"
        icone={FileClock}
        accoes={<Exportacoes onCsv={exportar.csv} onPdf={exportar.pdf} desactivado={!linhas.length} />}
      >
        {registoQ.isLoading ? (
          <EsqueletoLinhas linhas={3} />
        ) : registoQ.isError ? (
          <EstadoErro
            titulo="Não foi possível carregar o registo de emendas"
            texto="O registo não chegou do servidor. Tente de novo; se continuar, avise a gestão documental."
            onTentar={() => registoQ.refetch?.()}
          />
        ) : !linhas.length ? (
          <EstadoVazio
            icone={FileClock}
            titulo="Sem emendas registadas"
            texto={'Este documento ainda não foi emendado no portal. O registo das sete colunas do Anexo 3 enche-se à medida que se registam emendas e corrigendas.'}
          >
            <Button asChild variant="outline" className="min-h-[2.75rem]">
              <Link to={`${PORTAL_BASE}/gestao/emendas?nova=1&documento=${docId || ''}`}>
                <FilePlus2 className="h-4 w-4" aria-hidden="true" />Registar a primeira emenda
              </Link>
            </Button>
          </EstadoVazio>
        ) : (
          // As sete colunas, por esta ordem, com estes nomes. Em ecrã estreito rola na horizontal: a tabela
          // legal não se parte em cartões nem se esconde colunas, porque o formato é o formato.
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] border-collapse text-left">
              <caption className="sr-only">
                Registo de Emendas no formato do Anexo 3 do Instrutivo 22C.107.001.A: número, data da modificação,
                data de inserção, quem inseriu, páginas afectadas, resumo da modificação e quem aprovou.
              </caption>
              <thead>
                <tr>
                  {COLUNAS_ANEXO3.map((c, i) => (
                    <th
                      key={c}
                      scope="col"
                      className={cn('sticky top-16 z-10 border-b px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide',
                        tk.borda, tk.superficie, tk.tintaFraca,
                        i === 0 && 'w-[3.5rem]', (i === 1 || i === 2) && 'w-[7.5rem]', i === 3 && 'w-[11rem]', i === 4 && 'w-[9rem]', i === 6 && 'w-[10rem]')}
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className={cn('divide-y', tk.divisoria)}>
                {linhas.map(r => (
                  <tr key={r.emenda_id} className={tk.hover}>
                    <td className={cn('px-3 py-2 align-top text-sm', tk.mono, tk.tinta)}>{r['Nº']}</td>
                    <td className={cn('px-3 py-2 align-top text-sm', tk.mono, tk.tintaMedia)}>{r['Data da Modificação'] ? fmtData(r['Data da Modificação']) : '—'}</td>
                    <td className={cn('px-3 py-2 align-top text-sm', tk.mono, tk.tintaMedia)}>{r['Data de Inserção'] ? fmtData(r['Data de Inserção']) : '—'}</td>
                    <td className={cn('px-3 py-2 align-top text-sm', tk.tintaMedia)}>{r['Inserido por'] || '—'}</td>
                    <td className={cn('px-3 py-2 align-top text-sm', tk.mono, tk.tintaMedia)}>{r['Páginas Afectadas']}</td>
                    <td className={cn('px-3 py-2 align-top text-sm', tk.tintaMedia)}>
                      {r['Resumo da Modificação']}
                      <span className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className={cn('text-xs', tk.tintaFraca)}>{ROTULO_TIPO[r.tipo]} · {ROTULO_MODO[r.modo]}</span>
                        <SeloEmenda estado={r.estado} className="text-xs" />
                        {minhas.has(r.emenda_id) && (
                          <span className={cn('inline-flex items-center gap-1 text-xs', T.verde)}>
                            <Check className="h-3 w-3" aria-hidden="true" />confirmou
                          </span>
                        )}
                      </span>
                    </td>
                    <td className={cn('px-3 py-2 align-top text-sm', tk.tintaMedia)}>{r['Aprovado por'] || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Caixa>
    </div>
  );
}

// ── criar e alterar uma emenda ──────────────────────────────────────────────
function DialogEmenda({ emenda, documentos, documentoFixo, actor, aoFechar, aoGravado }) {
  const { toast } = useToast();
  const edicao = !!emenda?.id;
  const docInicial = emenda?.documento_id || documentoFixo || '';
  const docSugerido = documentos.find(d => d.id === docInicial) || null;
  const [forma, setForma] = useState(() => ({
    id: emenda?.id || null,
    documento_id: docInicial,
    tipo: emenda?.tipo || 'emenda',
    // o modo habitual do documento é sugestão (modo_emenda_padrao); a escolha final é de quem emenda
    modo: emenda?.modo || docSugerido?.modo_emenda_padrao || 'documento',
    data_modificacao: emenda?.data_modificacao || new Date().toISOString().slice(0, 10),
    data_insercao: emenda?.data_insercao || '',
    inserido_por: emenda?.inserido_por || '',
    paginas_afectadas: emenda?.paginas_afectadas || '',
    resumo: emenda?.resumo || '',
    aprovado_por: emenda?.aprovado_por || '',
    versao_resultante: emenda?.versao_resultante || '',
    prazo_confirmacao: emenda?.prazo_confirmacao ?? 30,
  }));
  const [guardarPadrao, setGuardarPadrao] = useState(false);
  const [aGravar, setAGravar] = useState(false);
  const alterar = (patch) => setForma(f => ({ ...f, ...patch }));

  const docEscolhido = documentos.find(d => d.id === forma.documento_id) || null;
  // Ao trocar de documento, segue-se o modo habitual desse documento — enquanto quem emenda não disser outra coisa.
  useEffect(() => {
    if (!edicao && docEscolhido?.modo_emenda_padrao) alterar({ modo: docEscolhido.modo_emenda_padrao });
  }, [docEscolhido?.id]);

  const opcoesDoc = useMemo(() => documentos.map(d => ({
    value: d.id, label: `${d.numero ? `${d.numero} — ` : ''}${d.titulo || 'Documento sem título'}`,
  })), [documentos]);

  const gravar = async () => {
    setAGravar(true);
    try {
      const r = await guardarEmenda(forma, actor);
      if (guardarPadrao && forma.documento_id) {
        try { await guardarModoEmendaPadrao(forma.documento_id, forma.modo); } catch { /* o essencial é a emenda */ }
      }
      await auditarDocs(actor, {
        acao: edicao ? 'alterar_emenda' : 'criar_emenda',
        entidade: 'documento_emenda',
        id: r?.id || forma.id,
        detalhes: `${ROTULO_TIPO[forma.tipo]} ${r?.numero ? `nº ${r.numero}` : ''} · ${ROTULO_MODO[forma.modo]}`,
      });
      toast({
        title: edicao ? 'Emenda guardada' : `${ROTULO_TIPO[forma.tipo]} registada${r?.numero ? ` com o nº ${r.numero}` : ''}`,
        description: edicao ? 'O registo foi actualizado.'
          : forma.tipo === 'corrigenda'
            ? 'A corrigenda não carece de aprovação da ANAC: já pode ser distribuída.'
            : 'O passo seguinte é enviar à ANAC, que tem de aprovar antes de a emenda entrar no manual.',
      });
      aoGravado?.(r);
    } catch (e) {
      toast({ title: 'Não foi possível guardar', description: e?.message || String(e), variant: 'destructive' });
    } finally { setAGravar(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && aoFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileClock className={cn('h-5 w-5', tk.acento)} aria-hidden="true" />
            {edicao ? `Emenda nº ${emenda.numero}` : 'Registar emenda ou corrigenda'}
          </DialogTitle>
          <DialogDescription>
            O que escrever aqui é o que vai sair no Registo de Emendas e na folha de controlo que a ANAC lê.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="em-doc">Documento</Label>
            {edicao || documentoFixo ? (
              <p className={cn('mt-1 text-sm', tk.tintaMedia)}>{identidadeDoc(docEscolhido)}</p>
            ) : (
              <Select
                id="em-doc"
                options={opcoesDoc}
                value={forma.documento_id}
                onValueChange={(v) => alterar({ documento_id: v })}
                placeholder="Escolha o documento a emendar"
                className="mt-1"
              />
            )}
          </div>

          <fieldset>
            <legend className={cn('text-sm font-medium', tk.tinta)}>Percurso</legend>
            <p className={cn('mt-0.5 text-sm', tk.tintaFraca)}>
              A emenda carece de aprovação prévia da ANAC. A corrigenda — gralha, telefone errado — não carece,
              e nasce já aprovada.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {['emenda', 'corrigenda'].map(t => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={forma.tipo === t}
                  onClick={() => alterar({ tipo: t })}
                  className={cn('min-h-[2.75rem] rounded-lg border px-3 text-sm font-medium', tk.foco,
                    forma.tipo === t ? cn(tk.acentoBorda, tk.acentoFundo, tk.acento) : cn(tk.borda, tk.superficie, tk.tintaMedia, tk.hover))}
                >
                  {ROTULO_TIPO[t]}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className={cn('text-sm font-medium', tk.tinta)}>Como se emenda</legend>
            <div className="mt-2 space-y-2">
              {['paginas', 'documento'].map(m => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={forma.modo === m}
                  onClick={() => alterar({ modo: m })}
                  className={cn('flex w-full min-h-[2.75rem] items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm', tk.foco,
                    forma.modo === m ? cn(tk.acentoBorda, tk.acentoFundo, tk.acento) : cn(tk.borda, tk.superficie, tk.tintaMedia, tk.hover))}
                >
                  <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded-full border', forma.modo === m ? 'border-current' : tk.borda)}>
                    {forma.modo === m && <span className="h-2 w-2 rounded-full bg-current" />}
                  </span>
                  {ROTULO_MODO_LONGO[m]}
                </button>
              ))}
            </div>
            {docEscolhido?.modo_emenda_padrao && (
              <p className={cn('mt-1.5 text-sm', tk.tintaFraca)}>
                Este documento costuma ser emendado {ROTULO_MODO[docEscolhido.modo_emenda_padrao].toLowerCase()}. É sugestão, não obrigação.
              </p>
            )}
            {!edicao && docEscolhido && forma.modo !== docEscolhido.modo_emenda_padrao && (
              <label className={cn('mt-2 flex items-start gap-2 text-sm', tk.tintaMedia)}>
                <input type="checkbox" checked={guardarPadrao} onChange={e => setGuardarPadrao(e.target.checked)} className="mt-1 h-4 w-4" />
                Passar a ser o modo habitual deste documento.
              </label>
            )}
          </fieldset>

          {forma.modo === 'paginas' && (
            <div>
              <Label htmlFor="em-paginas">Páginas afectadas</Label>
              <Input
                id="em-paginas"
                value={forma.paginas_afectadas}
                onChange={e => alterar({ paginas_afectadas: e.target.value })}
                placeholder="Saem 3-1 a 3-4 (rev. 2); entram 3-1 a 3-5 (rev. 3)"
                className="mt-1"
              />
              <p className={cn('mt-1 text-sm', tk.tintaFraca)}>
                Quinta coluna do Anexo 3. Diga quais saem e quais entram, com a revisão de cada uma.
              </p>
            </div>
          )}

          <div>
            <Label htmlFor="em-resumo">Resumo da modificação</Label>
            <Textarea
              id="em-resumo"
              value={forma.resumo}
              onChange={e => alterar({ resumo: e.target.value })}
              rows={3}
              placeholder="O que mudou, numa frase que se entenda daqui a cinco anos."
              className="mt-1"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="em-data-mod">Data da modificação</Label>
              <Input id="em-data-mod" type="date" value={forma.data_modificacao || ''} onChange={e => alterar({ data_modificacao: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="em-data-ins">Data de inserção</Label>
              <Input id="em-data-ins" type="date" value={forma.data_insercao || ''} onChange={e => alterar({ data_insercao: e.target.value })} className="mt-1" />
              <p className={cn('mt-1 text-sm', tk.tintaFraca)}>Deixe em branco: fica preenchida quando distribuir.</p>
            </div>
            <div>
              <Label htmlFor="em-inserido">Inserido por</Label>
              <Input
                id="em-inserido"
                value={forma.inserido_por}
                onChange={e => alterar({ inserido_por: e.target.value })}
                placeholder="NOME EM MAIÚSCULAS"
                className="mt-1"
                style={MONO}
              />
            </div>
            <div>
              <Label htmlFor="em-aprovado">Aprovado por</Label>
              <Input id="em-aprovado" value={forma.aprovado_por} onChange={e => alterar({ aprovado_por: e.target.value })} placeholder="Quem aprovou" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="em-versao">Revisão resultante</Label>
              <Input id="em-versao" value={forma.versao_resultante} onChange={e => alterar({ versao_resultante: e.target.value })} placeholder="Ex.: 3" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="em-prazo">Prazo de confirmação (dias)</Label>
              <Input id="em-prazo" type="number" min="1" max="365" value={forma.prazo_confirmacao} onChange={e => alterar({ prazo_confirmacao: e.target.value })} className="mt-1" style={MONO} />
              <p className={cn('mt-1 text-sm', tk.tintaFraca)}>A lei fixa 30 dias. Só mexa com motivo.</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" className="min-h-[2.75rem]" onClick={aoFechar} disabled={aGravar}>Deixar como está</Button>
          <Button className="min-h-[2.75rem]" onClick={gravar} disabled={aGravar}>
            {aGravar ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
            {edicao ? 'Guardar' : 'Registar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── percurso, folha de controlo e confirmações de uma emenda ────────────────
function Percurso({ emenda, aAvancar, aoAvancar, aoCancelar, aoReabrir }) {
  const passos = passosDe(emenda);
  const actual = ORDEM_ESTADO[emenda.estado] ?? 0;
  const seguinte = proximoPasso(emenda);
  const cancelada = emenda.estado === 'cancelada';
  return (
    <div className="px-4 py-3">
      {cancelada ? (
        <p className={cn('flex items-start gap-2 text-sm', T.vermelho)}>
          <Ban className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Esta emenda foi cancelada. Fica no registo, porque o registo não se apaga, mas não conta como alteração do manual.
        </p>
      ) : (
        <ol className="space-y-0">
          {passos.map((p, i) => {
            const ordem = ORDEM_ESTADO[p.chave];
            const feito = ordem <= actual;
            const agora = ordem === actual;
            const data = p.data(emenda);
            return (
              <li key={p.chave} className="flex gap-3">
                <span className="flex flex-col items-center" aria-hidden="true">
                  <span className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                    feito ? cn('border-transparent', agora ? 'bg-teal-700 text-white dark:bg-teal-400 dark:text-slate-900' : 'bg-emerald-600 text-white') : cn(tk.borda, tk.superficie))}>
                    {feito ? <Check className="h-3 w-3" /> : <span className={cn('h-1.5 w-1.5 rounded-full', tk.tintaTenue, 'bg-current')} />}
                  </span>
                  {i < passos.length - 1 && <span className={cn('my-0.5 w-px flex-1', feito ? 'bg-emerald-500/60' : 'bg-slate-300 dark:bg-slate-700')} />}
                </span>
                <span className="min-w-0 flex-1 pb-3">
                  <span className={cn('block text-sm font-medium', feito ? tk.tinta : tk.tintaFraca)}>
                    {p.titulo}
                    {data && <span className={cn('ml-2 text-xs font-normal', tk.mono, tk.tintaFraca)}>{fmtData(data)}</span>}
                  </span>
                  <span className={cn('block text-sm', tk.tintaFraca)}>{p.texto}</span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
      <div className={cn('mt-1 flex flex-wrap gap-2 border-t pt-3', tk.borda)}>
        {seguinte && (
          <Botao icone={seguinte.icone} variante="default" ocupado={aAvancar === seguinte.estado} aoClicar={() => aoAvancar(seguinte.estado)}>
            {seguinte.rotulo}
          </Botao>
        )}
        {cancelada && <Botao icone={RotateCcw} ocupado={aAvancar === 'rascunho'} aoClicar={aoReabrir}>Reabrir como rascunho</Botao>}
        {!cancelada && emenda.estado !== 'distribuida' && (
          <Botao icone={Ban} ocupado={aAvancar === 'cancelada'} aoClicar={aoCancelar}>Cancelar a emenda</Botao>
        )}
      </div>
    </div>
  );
}

function Confirmacoes({ emenda, detentores, confirmadas, aoCopiarFaltam }) {
  const confirmados = useMemo(() => confirmadas.filter(c => c.emenda_id === emenda.id), [confirmadas, emenda.id]);
  const confirmadosEmails = useMemo(() => new Set(confirmados.map(c => String(c.email).toLowerCase())), [confirmados]);
  const faltam = useMemo(() => detentores.filter(e => !confirmadosEmails.has(e)), [detentores, confirmadosEmails]);
  const prazo = textoPrazo(emenda);
  const total = detentores.length;
  const feitos = confirmados.length;

  if (emenda.estado !== 'distribuida') {
    return (
      <EstadoVazio
        icone={Clock}
        titulo="A contagem ainda não começou"
        texto={`Os ${Number(emenda.prazo_confirmacao) || 30} dias contam-se a partir da distribuição. Distribua a emenda para os detentores poderem confirmar que a inseriram.`}
      />
    );
  }

  return (
    <div className={cn('divide-y', tk.divisoria)}>
      <div className="px-4 py-3">
        <p className={cn('text-sm', tk.tintaMedia)}>
          <span className={cn('font-semibold', tk.tinta)} style={MONO}>{feitos}</span>
          {' de '}
          <span style={MONO}>{total || '—'}</span>
          {' detentores já confirmaram'}
          {prazo.dias != null && <> · distribuída há <span style={MONO}>{prazo.dias}</span> {prazo.dias === 1 ? 'dia' : 'dias'}</>}
        </p>
        <p className={cn('mt-1 flex items-center gap-1.5 text-sm', corPrazo(prazo.chave))}>
          {prazo.chave === 'fora' ? <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
          {prazo.texto} (prazo de {Number(emenda.prazo_confirmacao) || 30} dias)
        </p>
        {total > 0 && (
          <div className={cn('mt-2 h-1.5 w-full overflow-hidden rounded-full', tk.superficieBaixa)} role="img" aria-label={`${feitos} de ${total} confirmaram`}>
            <div className={cn('h-full rounded-full', feitos >= total ? 'bg-emerald-600' : prazo.chave === 'fora' ? 'bg-red-600' : 'bg-teal-700 dark:bg-teal-400')}
              style={{ width: `${total ? Math.min(100, Math.round((feitos / total) * 100)) : 0}%` }} />
          </div>
        )}
      </div>

      <div className="px-4 py-3">
        <TituloSeccao contagem={feitos}>Já confirmaram</TituloSeccao>
        {!feitos ? (
          <p className={cn('text-sm', tk.tintaFraca)}>Ainda ninguém. Enquanto não houver confirmações, não há prova de recebimento.</p>
        ) : (
          <ul className={cn('max-h-48 divide-y overflow-y-auto rounded-lg border', tk.divisoria, tk.borda)}>
            {confirmados.map(c => (
              <li key={c.email} className="flex items-center gap-3 px-3 py-2">
                <Check className={cn('h-4 w-4 shrink-0', T.verde)} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className={cn('block truncate text-sm', tk.tinta)}>{c.nome || pessoaDeEmail(c.email)}</span>
                  <span className={cn('block truncate text-xs', tk.tintaFraca)}>{c.email}</span>
                </span>
                <span className={cn('shrink-0 text-xs', tk.mono, tk.tintaFraca)}>{fmtDataHora(c.confirmado_em)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="px-4 py-3">
        <TituloSeccao contagem={faltam.length}>Falta confirmarem</TituloSeccao>
        {!total ? (
          <p className={cn('text-sm', tk.tintaFraca)}>
            Este documento não tem detentores registados: ninguém tem acesso ao aeroporto dele. Dê acesso em
            Gestão → Acessos para a lista de quem falta fazer sentido.
          </p>
        ) : !faltam.length ? (
          <p className={cn('flex items-center gap-1.5 text-sm', T.verde)}>
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />Todos os detentores confirmaram.
          </p>
        ) : (
          <>
            <ul className={cn('max-h-48 divide-y overflow-y-auto rounded-lg border', tk.divisoria, tk.borda)}>
              {faltam.map(e => (
                <li key={e} className="flex items-center gap-3 px-3 py-2">
                  <Clock className={cn('h-4 w-4 shrink-0', tk.tintaTenue)} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate text-sm', tk.tinta)}>{pessoaDeEmail(e)}</span>
                    <span className={cn('block truncate text-xs', tk.tintaFraca)}>{e}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-2">
              <Botao icone={ClipboardCopy} aoClicar={() => aoCopiarFaltam(faltam)}>Copiar os endereços de quem falta</Botao>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PainelEmenda({ emenda, documento, detentores, confirmadas, aoFechar, aoEditar, actor }) {
  const { toast } = useToast();
  const recarregar = useRecarregarDocs();
  const [aAvancar, setAAvancar] = useState(null);
  const [aImprimir, setAImprimir] = useState(false);

  const mover = async (estado) => {
    setAAvancar(estado);
    try {
      await marcarEstadoEmenda(emenda, estado, actor);
      await auditarDocs(actor, { acao: `emenda_${estado}`, entidade: 'documento_emenda', id: emenda.id, detalhes: `Emenda nº ${emenda.numero} de ${identidadeDoc(documento)}` });
      recarregar('emendas');
      recarregar('registo-emendas');
      toast({
        title: ROTULO_ESTADO[estado],
        description: estado === 'distribuida'
          ? `Começou a contagem do prazo: os detentores têm ${Number(emenda.prazo_confirmacao) || 30} dias para confirmar.`
          : 'O registo foi actualizado.',
      });
    } catch (e) {
      toast({ title: 'Não foi possível mudar o estado', description: e?.message || String(e), variant: 'destructive' });
    } finally { setAAvancar(null); }
  };

  const imprimir = async () => {
    setAImprimir(true);
    try { await pdfFolhaControlo({ emenda, documento, geradoPor: actor?.full_name || actor?.email }); }
    catch (e) { toast({ title: 'Não foi possível gerar a folha', description: e?.message || String(e), variant: 'destructive' }); }
    finally { setAImprimir(false); }
  };

  const copiarFaltam = async (lista) => {
    const ok = await copyToClipboard(lista.join('; '));
    toast(ok
      ? { title: 'Endereços copiados', description: `${lista.length} ${lista.length === 1 ? 'endereço' : 'endereços'} na área de transferência.` }
      : { title: 'Não foi possível copiar', description: 'Seleccione os endereços na lista e copie à mão.', variant: 'destructive' });
  };

  return (
    <div className="space-y-4">
      <Caixa
        titulo={`${ROTULO_TIPO[emenda.tipo]} nº ${emenda.numero}`}
        icone={FileClock}
        accoes={
          <>
            <Botao icone={Pencil} aoClicar={aoEditar}>Alterar</Botao>
            <Button type="button" variant="ghost" size="sm" onClick={aoFechar} aria-label="Fechar o detalhe" className="min-h-[2.25rem]">
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </>
        }
      >
        <div className="space-y-3 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <SeloEmenda estado={emenda.estado} />
            <span className={cn('text-sm', tk.tintaFraca)}>{ROTULO_MODO_LONGO[emenda.modo]}</span>
          </div>
          <p className={cn('text-sm', tk.tintaMedia)}>{emenda.resumo}</p>
          <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
            <div>
              <dt className={cn('text-xs font-semibold uppercase tracking-wider', tk.tintaFraca)}>Documento</dt>
              <dd className="mt-0.5 flex flex-wrap items-center gap-2">
                <Link to={urlDoc(emenda.documento_id)} className={cn('text-sm hover:underline', tk.acento, tk.foco)}>
                  {identidadeDoc(documento)}
                </Link>
                {/* o estado do documento, no selo do portal: a emenda pode estar distribuída e o manual obsoleto */}
                {documento?.estado && <EstadoSelo estado={documento.estado} />}
              </dd>
            </div>
            <div>
              <dt className={cn('text-xs font-semibold uppercase tracking-wider', tk.tintaFraca)}>Páginas afectadas</dt>
              <dd className={cn('mt-0.5 text-sm', tk.mono, tk.tintaMedia)}>{emenda.paginas_afectadas || '—'}</dd>
            </div>
            <div>
              <dt className={cn('text-xs font-semibold uppercase tracking-wider', tk.tintaFraca)}>Inserido por</dt>
              <dd className={cn('mt-0.5 text-sm', tk.tintaMedia)}>{emenda.inserido_por || '—'}</dd>
            </div>
            <div>
              <dt className={cn('text-xs font-semibold uppercase tracking-wider', tk.tintaFraca)}>Aprovado por</dt>
              <dd className={cn('mt-0.5 text-sm', tk.tintaMedia)}>{emenda.aprovado_por || '—'}</dd>
            </div>
            <div>
              <dt className={cn('text-xs font-semibold uppercase tracking-wider', tk.tintaFraca)}>Revisão resultante</dt>
              <dd className={cn('mt-0.5 text-sm', tk.mono, tk.tintaMedia)}>{emenda.versao_resultante || '—'}</dd>
            </div>
            <div>
              <dt className={cn('text-xs font-semibold uppercase tracking-wider', tk.tintaFraca)}>Data da modificação</dt>
              <dd className={cn('mt-0.5 text-sm', tk.mono, tk.tintaMedia)}>{emenda.data_modificacao ? fmtData(emenda.data_modificacao) : '—'}</dd>
            </div>
          </dl>
        </div>
      </Caixa>

      <Caixa titulo="Percurso" icone={Send}>
        <Percurso
          emenda={emenda}
          aAvancar={aAvancar}
          aoAvancar={mover}
          aoCancelar={() => mover('cancelada')}
          aoReabrir={() => mover('rascunho')}
        />
      </Caixa>

      <Caixa
        titulo="Folha de controlo"
        icone={Printer}
        accoes={<Botao icone={Printer} ocupado={aImprimir} aoClicar={imprimir}>Imprimir</Botao>}
      >
        <div className="px-4 py-3">
          <p className={cn('text-sm', tk.tintaMedia)}>
            Folha nº <span className={cn('font-semibold', tk.tinta)} style={MONO}>{emenda.folha_controlo ?? '—'}</span>
            {' '}· numerada consecutivamente no portal e datada na emissão, como manda o Apêndice 1, §1.5.
          </p>
          <p className={cn('mt-1 text-sm', tk.tintaFraca)}>
            Imprime em PDF com o logótipo SGA, o resumo por extenso e as linhas de assinatura: é o papel que o
            detentor devolve assinado quando não confirma no portal.
          </p>
        </div>
      </Caixa>

      <Caixa titulo="Confirmações dos detentores" icone={Users}>
        <Confirmacoes emenda={emenda} detentores={detentores} confirmadas={confirmadas} aoCopiarFaltam={copiarFaltam} />
      </Caixa>
    </div>
  );
}

// ── tabela de emendas (lista de trabalho) ───────────────────────────────────
function TabelaEmendas({ linhas, docs, aeroportos, altura, escolhida, aoEscolher }) {
  const th = cn('sticky top-16 z-10 border-b px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide', tk.borda, tk.superficie, tk.tintaFraca);
  const td = cn('px-3 align-middle text-sm', tk.tintaMedia);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[46rem] border-collapse text-left">
        <caption className="sr-only">Emendas e corrigendas: número, documento, tipo e forma, data da modificação, estado e confirmações.</caption>
        <thead>
          <tr>
            <th scope="col" className={cn(th, 'w-[4.5rem]')}>Nº</th>
            <th scope="col" className={th}>Documento</th>
            <th scope="col" className={cn(th, 'hidden w-[11rem] lg:table-cell')}>Tipo e forma</th>
            <th scope="col" className={cn(th, 'hidden w-[7.5rem] md:table-cell')}>Modificação</th>
            <th scope="col" className={cn(th, 'w-[9.5rem]')}>Estado</th>
            <th scope="col" className={cn(th, 'w-[11rem]')}>Confirmações</th>
          </tr>
        </thead>
        <tbody className={cn('divide-y', tk.divisoria)}>
          {linhas.map(r => {
            const doc = docs.get(r.documento_id);
            const activa = escolhida === r.emenda_id;
            const prazo = textoPrazo({ estado: r.estado, distribuida_em: r.distribuida_em, prazo_confirmacao: r.prazo_confirmacao });
            const aero = nomeAero(aeroportos, doc?.aeroporto_id);
            return (
              <tr key={r.emenda_id} className={cn(activa ? tk.seleccionada : tk.hover, 'transition-colors')} style={{ height: altura }} data-escolhida={activa ? 'sim' : undefined}>
                <td className={cn(td, tk.mono, tk.tinta)}>
                  {r['Nº']}
                  {r.folha_controlo != null && <span className={cn('block text-xs', tk.tintaTenue)}>folha {r.folha_controlo}</span>}
                </td>
                <td className="px-3 py-1 align-middle">
                  {/* a acção principal da linha é um botão, sempre presente e focável por teclado */}
                  <button
                    type="button"
                    onClick={() => aoEscolher(activa ? '' : r.emenda_id)}
                    aria-expanded={activa}
                    aria-controls="painel-emenda"
                    className={cn('block w-full min-w-0 rounded text-left', tk.foco)}
                  >
                    <span className={cn('block truncate font-medium leading-[1.2]', tk.tinta)}>{doc?.titulo || 'Documento sem título'}</span>
                    <span className={cn('mt-0.5 flex items-center gap-2 text-sm leading-[1.2]', tk.tintaFraca)}>
                      {doc?.numero ? <span className={cn('truncate', tk.mono)}>{doc.numero}</span> : <span className="italic">sem número</span>}
                      {aero && <span className="hidden shrink-0 items-center gap-1 sm:inline-flex"><Building2 className="h-3.5 w-3.5" aria-hidden="true" />{aero}</span>}
                    </span>
                    <span className={cn('mt-1 block text-xs lg:hidden', tk.tintaFraca)}>{ROTULO_TIPO[r.tipo]} · {ROTULO_MODO[r.modo]}</span>
                  </button>
                </td>
                <td className={cn(td, 'hidden lg:table-cell')}>
                  <span className={cn('block leading-[1.2]', tk.tinta)}>{ROTULO_TIPO[r.tipo]}</span>
                  <span className={cn('block text-sm leading-[1.2]', tk.tintaFraca)}>{ROTULO_MODO[r.modo]}</span>
                </td>
                <td className={cn(td, 'hidden md:table-cell', tk.mono)}>{r['Data da Modificação'] ? fmtData(r['Data da Modificação']) : '—'}</td>
                <td className={td}><SeloEmenda estado={r.estado} /></td>
                <td className={td}>
                  <span className={cn('block leading-[1.2]', tk.mono, tk.tinta)}>{r.confirmacoes ?? 0}</span>
                  <span className={cn('block text-sm leading-[1.2]', corPrazo(prazo.chave))}>{prazo.texto}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── a página ────────────────────────────────────────────────────────────────
const OPCAO_TODOS = '';

export default function PortalEmendas() {
  const { user } = useAuth();
  const recarregar = useRecarregarDocs();
  const [sp, setSp] = useSearchParams();

  const [densidade, setDensidade] = useState(preferenciaDensidadeDocs);
  const altura = alturaDensidade(densidade);
  const mudarDensidade = (v) => { setDensidade(v); guardarPreferenciaDensidadeDocs(v); };

  // ── estado no endereço ──
  const vista = sp.get('vista') === 'registos' ? 'registos' : 'emendas';
  const fEstado = sp.get('estado') || OPCAO_TODOS;
  const fTipo = sp.get('tipo') || OPCAO_TODOS;
  const fAero = sp.get('aeroporto') || OPCAO_TODOS;
  const escolhida = sp.get('emenda') || '';
  const docEscolhido = sp.get('doc') || '';
  const novaAberta = sp.get('nova') === '1';
  const novaDoc = sp.get('documento') || '';
  const [aEditar, setAEditar] = useState(null);

  const actualizar = useCallback((patch, { replace = true } = {}) => {
    const p = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) { if (v) p.set(k, v); else p.delete(k); }
    setSp(p, { replace });
  }, [sp, setSp]);

  // ── dados ──
  const registoQ = useRegistoEmendas({});
  const emendasQ = useEmendasDocs({});
  const confirmacoesQ = useConfirmacoesEmendas();
  const docsQ = useDocumentosDocs({ limite: 1000 });
  const aeroQ = useAeroportosDocs();
  const tiposQ = useTiposDocumento();
  const membrosQ = useAcessoAeroportoDocs();
  const responsaveisQ = useResponsaveisAeroporto();

  const registo = registoQ.data || [];
  const docsLista = docsQ.data || [];
  const mapaDocs = useMemo(() => mapaPorId(docsLista), [docsLista]);
  const mapaAero = useMemo(() => mapaPorId(aeroQ.data), [aeroQ.data]);
  const mapaTipos = useMemo(() => mapaPorId(tiposQ.data), [tiposQ.data]);
  const emendaPorId = useMemo(() => new Map((emendasQ.data || []).map(e => [e.id, e])), [emendasQ.data]);

  // Detentores de um documento: quem tem acesso ao aeroporto dele, mais os responsáveis do aeroporto e o
  // responsável do próprio documento. É o mesmo denominador da cobertura de leitura nos relatórios.
  const detentoresDe = useCallback((doc) => {
    if (!doc) return [];
    const s = new Set();
    for (const m of membrosQ.data || []) if (m.aeroporto_id === doc.aeroporto_id) s.add(String(m.email).toLowerCase());
    for (const r of responsaveisQ.data || []) if (r.aeroporto_id === doc.aeroporto_id) s.add(String(r.email).toLowerCase());
    if (doc.responsavel_email) s.add(String(doc.responsavel_email).toLowerCase());
    return [...s].sort();
  }, [membrosQ.data, responsaveisQ.data]);

  // ── filtros com contagem real (cada ficha conta já com os outros filtros aplicados) ──
  const passaEstado = (r, v) => !v || r.estado === v;
  const passaTipo = (r, v) => !v || r.tipo === v;
  const passaAero = (r, v) => !v || mapaDocs.get(r.documento_id)?.aeroporto_id === v;

  const contar = (lista, fn) => lista.filter(fn).length;
  const opcoesEstado = useMemo(() => {
    const base = registo.filter(r => passaTipo(r, fTipo) && passaAero(r, fAero));
    return [
      { value: OPCAO_TODOS, label: 'Todos', total: base.length },
      ...['rascunho', 'enviada_anac', 'aprovada_anac', 'distribuida', 'cancelada']
        .map(e => ({ value: e, label: ROTULO_ESTADO[e], total: contar(base, r => r.estado === e) })),
    ];
  }, [registo, fTipo, fAero, mapaDocs]);
  const opcoesTipo = useMemo(() => {
    const base = registo.filter(r => passaEstado(r, fEstado) && passaAero(r, fAero));
    return [
      { value: OPCAO_TODOS, label: 'Todos', total: base.length },
      { value: 'emenda', label: 'Emendas', total: contar(base, r => r.tipo === 'emenda') },
      { value: 'corrigenda', label: 'Corrigendas', total: contar(base, r => r.tipo === 'corrigenda') },
    ];
  }, [registo, fEstado, fAero, mapaDocs]);
  const opcoesAero = useMemo(() => {
    const base = registo.filter(r => passaEstado(r, fEstado) && passaTipo(r, fTipo));
    const lista = (aeroQ.data || []).map(a => ({
      value: a.id,
      label: a.codigo_icao || a.nome,
      total: contar(base, r => mapaDocs.get(r.documento_id)?.aeroporto_id === a.id),
    }));
    return [{ value: OPCAO_TODOS, label: 'Todos', total: base.length }, ...lista];
  }, [registo, fEstado, fTipo, aeroQ.data, mapaDocs]);

  const linhas = useMemo(() => registo
    .filter(r => passaEstado(r, fEstado) && passaTipo(r, fTipo) && passaAero(r, fAero))
    .sort((a, b) => {
      const da = a['Data da Modificação'] || '';
      const db = b['Data da Modificação'] || '';
      return String(db).localeCompare(String(da)) || Number(b['Nº']) - Number(a['Nº']);
    }),
  [registo, fEstado, fTipo, fAero, mapaDocs]);

  const aplicados = [
    fEstado && { chave: 'estado', rotulo: `Estado: ${ROTULO_ESTADO[fEstado] || fEstado}`, aoRemover: () => actualizar({ estado: '' }) },
    fTipo && { chave: 'tipo', rotulo: `Tipo: ${ROTULO_TIPO[fTipo] || fTipo}`, aoRemover: () => actualizar({ tipo: '' }) },
    fAero && { chave: 'aeroporto', rotulo: `Aeroporto: ${nomeAero(mapaAero, fAero) || fAero}`, aoRemover: () => actualizar({ aeroporto: '' }) },
  ].filter(Boolean);

  // Documentos que já têm registo de emendas: é por aqui que se chega ao Registo do Anexo 3, que é por documento.
  const docsComEmendas = useMemo(() => {
    const porDoc = new Map();
    for (const r of registo) porDoc.set(r.documento_id, (porDoc.get(r.documento_id) || 0) + 1);
    return docsLista.filter(d => porDoc.has(d.id)).map(d => ({ ...d, __emendas: porDoc.get(d.id) }));
  }, [registo, docsLista]);

  const emendaAberta = escolhida ? emendaPorId.get(escolhida) || null : null;
  const docDaAberta = emendaAberta ? mapaDocs.get(emendaAberta.documento_id) : null;
  const docDoRegisto = docEscolhido ? mapaDocs.get(docEscolhido) : null;

  // Uma linha de texto em vez de indicadores a zero: o painel responde a «o que tenho de fazer hoje».
  const trabalho = useMemo(() => {
    const porDistribuir = registo.filter(r => r.estado === 'aprovada_anac').length;
    const naANAC = registo.filter(r => r.estado === 'enviada_anac').length;
    const foraDePrazo = registo.filter(r => {
      if (r.estado !== 'distribuida') return false;
      const p = textoPrazo({ estado: r.estado, distribuida_em: r.distribuida_em, prazo_confirmacao: r.prazo_confirmacao });
      return p.chave === 'fora';
    }).length;
    const partes = [];
    if (naANAC) partes.push(`${naANAC} à espera da ANAC`);
    if (porDistribuir) partes.push(`${porDistribuir} aprovada${porDistribuir === 1 ? '' : 's'} por distribuir`);
    if (foraDePrazo) partes.push(`${foraDePrazo} com o prazo de confirmação ultrapassado`);
    return partes;
  }, [registo]);

  const carregando = registoQ.isLoading || docsQ.isLoading;
  const falhou = registoQ.isError || emendasQ.isError;

  // Exportação da lista de trabalho, tal como está filtrada. As linhas saem das mesmas células para o CSV e
  // para o PDF: o que se vê no ecrã é o que sai no ficheiro.
  const linhasExportacao = useMemo(() => linhas.map(r => {
    const d = mapaDocs.get(r.documento_id);
    const prazo = textoPrazo({ estado: r.estado, distribuida_em: r.distribuida_em, prazo_confirmacao: r.prazo_confirmacao });
    const identidade = identidadeDoc(d);
    return {
      csv: [
        identidade, nomeAero(mapaAero, d?.aeroporto_id) || '', r['Nº'], ROTULO_TIPO[r.tipo] || r.tipo,
        ROTULO_MODO[r.modo] || r.modo,
        r['Data da Modificação'] ? fmtData(r['Data da Modificação']) : '',
        r['Data de Inserção'] ? fmtData(r['Data de Inserção']) : '',
        r['Inserido por'] || '', r['Páginas Afectadas'] || '', r['Resumo da Modificação'] || '',
        r['Aprovado por'] || '', ROTULO_ESTADO[r.estado] || r.estado,
        r.folha_controlo ?? '', r.confirmacoes ?? 0, prazo.texto,
      ],
      pdf: [
        identidade, r['Nº'], ROTULO_TIPO[r.tipo] || r.tipo, ROTULO_MODO[r.modo] || r.modo,
        r['Data da Modificação'] ? fmtData(r['Data da Modificação']) : '',
        r['Resumo da Modificação'] || '', ROTULO_ESTADO[r.estado] || r.estado, String(r.confirmacoes ?? 0),
      ],
    };
  }), [linhas, mapaDocs, mapaAero]);

  const filtrosEmTexto = [
    `Estado: ${fEstado ? ROTULO_ESTADO[fEstado] : 'todos'}`,
    `Tipo: ${fTipo ? ROTULO_TIPO[fTipo] : 'todos'}`,
    `Aeroporto: ${fAero ? (nomeAero(mapaAero, fAero) || fAero) : 'todos'}`,
  ];

  const fecharNova = () => actualizar({ nova: '', documento: '' });

  return (
    <PaginaGestao
      titulo="Registo de emendas"
      descricao="O formato não é nosso: o Anexo 3 do Instrutivo 22C.107.001.A fixa as sete colunas, o Apêndice 1 exige folha de controlo numerada e datada e dá aos detentores trinta dias para confirmarem."
      accoes={
        <>
          <ComutadorDensidade valor={densidade} aoMudar={mudarDensidade} />
          <Button variant="outline" className="min-h-[2.75rem]" onClick={() => { recarregar('registo-emendas'); recarregar('emendas'); recarregar('emendas-confirmacoes'); }}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />Actualizar
          </Button>
          <Button className="min-h-[2.75rem]" onClick={() => actualizar({ nova: '1' })}>
            <FilePlus2 className="h-4 w-4" aria-hidden="true" />Nova emenda
          </Button>
        </>
      }
    >
      <ExplicacaoPercursos />

      {trabalho.length > 0 && (
        <p className={cn('flex flex-wrap items-center gap-x-2 text-sm', T.tintaMedia)} role="status">
          <Clock className={cn('h-4 w-4 shrink-0', T.ambar)} aria-hidden="true" />
          Por fazer: {trabalho.join(' · ')}.
        </p>
      )}

      <Tabs value={vista} onValueChange={(v) => actualizar({ vista: v === 'emendas' ? '' : v, emenda: '', doc: '' })}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="emendas">Emendas{registo.length ? ` (${registo.length})` : ''}</TabsTrigger>
          <TabsTrigger value="registos">Registos por documento{docsComEmendas.length ? ` (${docsComEmendas.length})` : ''}</TabsTrigger>
        </TabsList>

        {/* ── todas as emendas, com filtros e detalhe ───────────────────── */}
        <TabsContent value="emendas" className="mt-4 space-y-4">
          <div className={cn('space-y-3 rounded-xl border p-4', tk.borda, tk.superficie)}>
            <FichasFiltro titulo="Estado" opcoes={opcoesEstado} valor={fEstado} aoEscolher={(v) => actualizar({ estado: v, emenda: '' })} />
            <FichasFiltro titulo="Tipo" opcoes={opcoesTipo} valor={fTipo} aoEscolher={(v) => actualizar({ tipo: v, emenda: '' })} />
            <FichasFiltro titulo="Aeroporto" opcoes={opcoesAero} valor={fAero} aoEscolher={(v) => actualizar({ aeroporto: v, emenda: '' })} />
            <div className={cn('flex flex-wrap items-center gap-2 border-t pt-3', tk.borda)}>
              <span className={cn('flex-1 text-sm', tk.tintaFraca)}>
                Esta lista é de acompanhamento. O Registo de Emendas da ANAC é por documento e está no separador seguinte.
              </span>
              <Exportacoes
                desactivado={!linhas.length}
                onCsv={() => descarregarCsv('Emendas_lista', COLUNAS_LISTA, linhasExportacao.map(l => l.csv))}
                onPdf={() => pdfListaEmendas({ linhas: linhasExportacao, filtros: filtrosEmTexto, geradoPor: user?.full_name || user?.email })}
              />
            </div>
          </div>
          <ResumoFiltros aplicados={aplicados} aoLimparTudo={() => actualizar({ estado: '', tipo: '', aeroporto: '', emenda: '' })} />

          <div className={cn('gap-4 lg:grid', escolhida ? 'lg:grid-cols-[minmax(0,1fr)_26rem]' : '')}>
            <div className={cn(cartao, 'min-w-0')}>
              {carregando ? (
                <EsqueletoTabela linhas={6} altura={altura} />
              ) : falhou ? (
                <EstadoErro
                  titulo="Não foi possível carregar as emendas"
                  texto="O registo não chegou do servidor. Tente de novo; se continuar, avise a gestão do portal."
                  onTentar={() => { registoQ.refetch?.(); emendasQ.refetch?.(); }}
                />
              ) : !registo.length ? (
                <EstadoVazio
                  icone={FileClock}
                  titulo="Ainda não há emendas registadas"
                  texto="O Registo de Emendas enche-se à medida que os manuais são alterados. Registe a primeira emenda ou corrigenda a partir do documento que foi alterado."
                >
                  <Button className="min-h-[2.75rem]" onClick={() => actualizar({ nova: '1' })}>
                    <FilePlus2 className="h-4 w-4" aria-hidden="true" />Nova emenda
                  </Button>
                </EstadoVazio>
              ) : !linhas.length ? (
                <EstadoVazio
                  icone={FileClock}
                  titulo="Nenhuma emenda com estes filtros"
                  texto="Há emendas registadas, mas nenhuma corresponde ao que está a filtrar."
                >
                  <Button variant="outline" className="min-h-[2.75rem]" onClick={() => actualizar({ estado: '', tipo: '', aeroporto: '' })}>
                    <X className="h-4 w-4" aria-hidden="true" />Limpar os filtros
                  </Button>
                </EstadoVazio>
              ) : (
                <TabelaEmendas
                  linhas={linhas}
                  docs={mapaDocs}
                  aeroportos={mapaAero}
                  altura={altura}
                  escolhida={escolhida}
                  aoEscolher={(id) => actualizar({ emenda: id })}
                />
              )}
            </div>

            {escolhida && (
              <aside id="painel-emenda" className="mt-4 min-w-0 lg:mt-0 lg:sticky lg:top-[var(--topo-fixo,5rem)]">
                {emendaAberta ? (
                  <PainelEmenda
                    emenda={emendaAberta}
                    documento={docDaAberta}
                    detentores={detentoresDe(docDaAberta)}
                    confirmadas={confirmacoesQ.data || []}
                    actor={user}
                    aoFechar={() => actualizar({ emenda: '' })}
                    aoEditar={() => setAEditar(emendaAberta)}
                  />
                ) : (
                  <Caixa titulo="Emenda" icone={FileClock}>
                    {/* `isFetching` e não só `isLoading`: logo depois de registar uma emenda a lista está a ser
                        buscada outra vez, e a emenda nova ainda não cá está — mostrar «não encontrada» seria mentira */}
                    {emendasQ.isLoading || emendasQ.isFetching
                      ? <EsqueletoLinhas linhas={2} />
                      : <EstadoVazio icone={FileClock} titulo="Emenda não encontrada" texto="A emenda que o endereço indica já não existe ou não tem permissão para a ver." />}
                  </Caixa>
                )}
              </aside>
            )}
          </div>
        </TabsContent>

        {/* ── o Registo do Anexo 3, que é por documento ─────────────────── */}
        <TabsContent value="registos" className="mt-4 space-y-4">
          <p className={cn('max-w-prose text-sm', tk.tintaMedia)}>
            O Registo de Emendas é por documento: cada manual tem o seu, com as sete colunas do Anexo 3. Escolha o
            documento para ver o registo e exportá-lo em CSV ou em PDF com o logótipo SGA, pronto a entregar à ANAC.
          </p>
          <div className={cn('gap-4 lg:grid', docEscolhido ? 'lg:grid-cols-[minmax(0,1fr)_28rem]' : '')}>
            <div className={cn(cartao, 'min-w-0')}>
              {carregando ? (
                <EsqueletoTabela linhas={5} altura={altura} />
              ) : falhou ? (
                <EstadoErro titulo="Não foi possível carregar os registos" onTentar={() => registoQ.refetch?.()} />
              ) : !docsComEmendas.length ? (
                <EstadoVazio
                  icone={FileText}
                  titulo="Nenhum documento tem emendas registadas"
                  texto="Assim que registar a primeira emenda de um manual, ele aparece aqui com o seu Registo de Emendas."
                >
                  <Button className="min-h-[2.75rem]" onClick={() => actualizar({ vista: '', nova: '1' })}>
                    <FilePlus2 className="h-4 w-4" aria-hidden="true" />Nova emenda
                  </Button>
                </EstadoVazio>
              ) : (
                <TabelaDocumentos
                  docs={docsComEmendas}
                  tipos={mapaTipos}
                  aeroportos={mapaAero}
                  densidade={densidade}
                  esconder={['responsavel', 'actualizado']}
                  mostrarAeroporto
                  seleccionado={docEscolhido}
                  aoSeleccionar={(id) => actualizar({ doc: id === docEscolhido ? '' : id })}
                  idPainel="painel-registo"
                />
              )}
            </div>

            {docEscolhido && (
              <aside id="painel-registo" className="mt-4 min-w-0 lg:mt-0">
                <RegistoEmendasDocumento documento={docDoRegisto} documentoId={docEscolhido} user={user} />
              </aside>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {(novaAberta || aEditar) && (
        <DialogEmenda
          emenda={aEditar}
          documentos={docsLista}
          documentoFixo={aEditar ? null : (novaDoc || null)}
          actor={user}
          aoFechar={() => { setAEditar(null); if (novaAberta) fecharNova(); }}
          aoGravado={(r) => {
            setAEditar(null);
            if (novaAberta) fecharNova();
            recarregar('registo-emendas');
            recarregar('emendas');
            if (r?.id) actualizar({ emenda: r.id, vista: '' });
          }}
        />
      )}
    </PaginaGestao>
  );
}
