// Conformidade (/documentos/gestao/conformidade) — as duas pontes da migração 159 num só ecrã.
//
// A ANAC não inspecciona por documento, inspecciona por requisito: «onde está, no vosso Manual de Operações, o
// que cumpre o parágrafo 1.1.2.2?». Este ecrã é a resposta, e é construído ao contrário da intuição: não começa
// pelo que está feito, começa pelos BURACOS. A tira de cima só mostra números que não são zero, a cobertura por
// diploma põe a vermelho os requisitos sem nada a apontar, e a matriz deixa filtrar directamente por eles.
//
// O segundo separador é a outra ponte: as revisões de documentos que podem ter desactualizado formação. Vive
// aqui porque é no portal de documentos que a revisão nasce — mas o componente é autónomo e está preparado para
// ser montado também na Universidade Corporativa (ver a nota no fim deste ficheiro).
//
// Desenho: docs/desenho-portal-documentos.md. Tabela densa, cabeçalho fixo, sem zebra, estado no endereço (para
// uma vista poder ser citada num relatório de auditoria tal como foi vista), nenhuma cor escrita à mão.
import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, FileText, Plus, RefreshCw, Scale, Search, X, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import { ehGestorDocs } from '@/lib/portalDocumentos';
import { nomeFicheiro } from '@/lib/formacaoExport';
import { PaginaGestao, T } from '../../PortalLayout';
import { tk, FichasFiltro, ResumoFiltros } from '../PortalBiblioteca';
import {
  useDiplomas, useCoberturaConformidade, useMatrizConformidade, useMatrizFiltrada, useTotaisCobertura,
  useRecarregarConformidade, useRecarregarFormacao, useImpactoFormacao,
} from '../../hooksConformidade';
import { sugerirCorrespondencias } from '../../apiConformidade';
import { pdfRelatorioConformidade } from '../../components/conformidade/pdfConformidade';
import CoberturaDiplomas from '../../components/conformidade/CoberturaDiplomas';
import MatrizRequisitos from '../../components/conformidade/MatrizRequisitos';
import ModalProva from '../../components/conformidade/ModalProva';
import ModalRequisito from '../../components/conformidade/ModalRequisito';
import ImpactoFormacao from '../../components/conformidade/ImpactoFormacao';
import { Indicador } from '../../components/conformidade/comuns';

const ABAS = ['matriz', 'formacao'];

// ── exportação ──────────────────────────────────────────────────────────────
// A matriz tal como está no ecrã, com uma linha por prova (e uma linha por requisito descoberto, para o buraco
// aparecer no ficheiro em vez de desaparecer). CSV com BOM e ponto e vírgula: é o que o Excel em português abre
// sem perguntar nada.
const COLUNAS_CSV = [
  'Diploma', 'Artigo ou parágrafo', 'Requisito', 'O que exige', 'Manual', 'Criticidade', 'Estado',
  'Documento', 'Revisão da prova', 'Revisão actual', 'Capítulo', 'Parágrafo', 'Página', 'Grau', 'Citação', 'Nota',
];
const csvCampo = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
function exportarCsv(linhas) {
  const corpo = [];
  for (const r of linhas) {
    const base = [r.diploma_nome, r.artigo, r.titulo, r.texto, r.processo_nome, r.criticidade, r.estado];
    if (!r.provas?.length) {
      corpo.push([...base, '', '', '', '', '', '', '', '', '']);
      continue;
    }
    for (const p of r.provas) {
      corpo.push([...base,
        [p.documento_numero, p.documento_titulo].filter(Boolean).join(' — '),
        p.versao ?? '', p.versao_actual ?? '', p.capitulo ?? '', p.paragrafo ?? '',
        p.pagina ? `${p.pagina}${p.pagina_fim && p.pagina_fim !== p.pagina ? `-${p.pagina_fim}` : ''}` : '',
        p.grau, p.citacao ?? '', p.nota ?? '']);
    }
  }
  const csv = '﻿' + [COLUNAS_CSV, ...corpo].map(l => l.map(csvCampo).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `${nomeFicheiro('Matriz de conformidade')}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export default function PortalConformidade() {
  const { user } = useAuth();
  const gestor = ehGestorDocs(user);
  const [sp, setSp] = useSearchParams();

  const aba = ABAS.includes(sp.get('aba')) ? sp.get('aba') : 'matriz';
  const diploma = sp.get('diploma') || '';
  const estado = sp.get('estado') || '';
  const criticidade = sp.get('crit') || '';
  const processo = sp.get('processo') || '';
  const termo = sp.get('q') || '';

  const actualizar = (patch, { replace = false } = {}) => {
    const p = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) { if (v) p.set(k, v); else p.delete(k); }
    setSp(p, { replace });
  };

  const diplomasQ = useDiplomas();
  const coberturaQ = useCoberturaConformidade();
  const matrizQ = useMatrizConformidade();
  const impactoQ = useImpactoFormacao('aberto');
  const recarregarConf = useRecarregarConformidade();
  const recarregarForm = useRecarregarFormacao();

  const totais = useTotaisCobertura(coberturaQ.data);
  const f = useMatrizFiltrada(matrizQ.data, { diploma, estado, criticidade, processo, termo });

  // Botão «Sugerir correspondências»: dispara a varredura automática no servidor (provas «planeado — por confirmar»).
  // Não é automático nem silencioso — é um acto do gestor, aditivo, que nunca toca no que uma pessoa confirmou.
  const [aSugerir, setASugerir] = useState(false);
  const [avisoSugestao, setAvisoSugestao] = useState('');
  async function sugerir() {
    if (aSugerir) return;
    setAvisoSugestao('');
    setASugerir(true);
    try {
      const r = await sugerirCorrespondencias();
      recarregarConf();
      setAvisoSugestao(`${r.sugestoes_criadas ?? 0} sugestões para ${r.requisitos_com_candidato ?? 0} de ${r.requisitos_total ?? 0} requisitos. `
        + 'Entram como «planeado — por confirmar»: abra cada uma, verifique a página e marque «cumpre».');
    } catch (e) {
      setAvisoSugestao(e.message || 'Não foi possível sugerir correspondências.');
    } finally {
      setASugerir(false);
    }
  }

  // o requisito que vem no endereço abre já expandido (é o que torna partilhável a linha «este é o buraco»)
  const [abertosManuais, setAbertosManuais] = useState(() => new Set());
  const abertos = useMemo(() => {
    const s = new Set(abertosManuais);
    const doEndereco = sp.get('requisito');
    if (doEndereco) s.add(doEndereco);
    return s;
  }, [abertosManuais, sp]);
  const alternarAberto = (id) => {
    const estaAberto = abertos.has(id);
    // se estava aberto por vir no endereço, fecha-se tirando-o de lá (senão voltava a abrir a cada render)
    if (sp.get('requisito') === id) actualizar({ requisito: '' }, { replace: true });
    setAbertosManuais(prev => {
      const s = new Set(prev);
      if (estaAberto) s.delete(id); else s.add(id);
      return s;
    });
  };

  const [modalProva, setModalProva] = useState(null);         // { requisito, prova }
  const [modalRequisito, setModalRequisito] = useState(null); // { requisito } | { nova: true }

  const nomeDiploma = (cod) => (coberturaQ.data || []).find(d => d.diploma_codigo === cod)?.diploma_nome || cod;
  const aplicados = [
    diploma && { chave: 'diploma', rotulo: nomeDiploma(diploma), aoRemover: () => actualizar({ diploma: '' }) },
    estado && { chave: 'estado', rotulo: f.opcoesEstado.find(o => o.value === estado)?.label || estado, aoRemover: () => actualizar({ estado: '' }) },
    criticidade && { chave: 'crit', rotulo: `Criticidade ${criticidade}`, aoRemover: () => actualizar({ crit: '' }) },
    processo && { chave: 'processo', rotulo: f.opcoesProcesso.find(o => o.value === processo)?.label || processo, aoRemover: () => actualizar({ processo: '' }) },
    termo && { chave: 'q', rotulo: `«${termo}»`, aoRemover: () => actualizar({ q: '' }) },
  ].filter(Boolean);
  const limparTudo = () => actualizar({ diploma: '', estado: '', crit: '', processo: '', q: '' });

  const porTratar = (impactoQ.data || []).length;

  return (
    <PaginaGestao
      titulo="Conformidade"
      descricao="O que a lei exige, e onde está — no documento, na revisão e no parágrafo. É por aqui que se responde a uma inspecção."
      accoes={
        <>
          <Button variant="outline" onClick={() => { recarregarConf(); recarregarForm(); }}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />Recarregar
          </Button>
          {aba === 'matriz' && (
            <Button variant="outline" onClick={() => exportarCsv(f.lista)} disabled={!f.lista.length}>
              <Download className="h-4 w-4" aria-hidden="true" />Exportar CSV
            </Button>
          )}
          {aba === 'matriz' && (
            <Button variant="outline" onClick={() => pdfRelatorioConformidade({ cobertura: coberturaQ.data || [], matriz: matrizQ.data || [], geradoPor: user?.full_name || user?.email })} disabled={!(matrizQ.data || []).length}
              title="Relatório em PDF: cobertura por diploma e cada requisito com a sua prova. Para entregar ou arquivar.">
              <FileText className="h-4 w-4" aria-hidden="true" />Relatório PDF
            </Button>
          )}
          {gestor && aba === 'matriz' && (
            <Button variant="outline" onClick={sugerir} disabled={aSugerir} title="Procura, por semelhança de texto, as páginas que podem cumprir cada requisito, e cria candidatos por confirmar.">
              <Wand2 className={cn('h-4 w-4', aSugerir && 'animate-pulse')} aria-hidden="true" />
              {aSugerir ? 'A procurar…' : 'Sugerir correspondências'}
            </Button>
          )}
          {gestor && aba === 'matriz' && (
            <Button onClick={() => setModalRequisito({ nova: true })}>
              <Plus className="h-4 w-4" aria-hidden="true" />Carregar requisito
            </Button>
          )}
        </>
      }
    >
      <Tabs value={aba} onValueChange={v => actualizar({ aba: v === 'matriz' ? '' : v })}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="matriz">Matriz de requisitos</TabsTrigger>
          <TabsTrigger value="formacao">
            Impacto na formação{porTratar ? ` (${porTratar})` : ''}
          </TabsTrigger>
        </TabsList>

        {/* ── matriz ────────────────────────────────────────────────────── */}
        <TabsContent value="matriz" className="mt-4 space-y-4">
          {avisoSugestao && (
            <div role="status" className={cn('flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm', T.acentoFundo, T.heroiLinha)}>
              <Wand2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{avisoSugestao}</span>
              <button type="button" onClick={() => setAvisoSugestao('')} className="ml-auto shrink-0 opacity-70 hover:opacity-100" aria-label="Fechar aviso"><X className="h-4 w-4" aria-hidden="true" /></button>
            </div>
          )}
          {/* indicadores numa só tira fina, e só os que não são zero */}
          <div className={cn('flex flex-wrap items-end gap-x-8 gap-y-3 rounded-xl border px-4 py-3', T.linha, T.superficie)}>
            <Indicador rotulo="requisitos carregados" valor={totais.requisitos} />
            <Indicador rotulo="sem nada a apontar" valor={totais.descobertos} tom="perigo"
              textoZero="Todos os requisitos carregados têm um parágrafo apontado." />
            <Indicador rotulo="críticos sem resposta" valor={totais.criticosDescobertos} tom="perigo" textoZero="" />
            <Indicador rotulo="provas a reconfirmar" valor={totais.aReconfirmar} tom="aviso" textoZero="" />
            {totais.requisitos > 0 && (
              <p className={cn('text-sm', tk.tintaFraca)}>
                <span className={cn('text-xl font-bold tabular-nums', totais.descobertos ? tk.tinta : tk.bom)}>{totais.pct}%</span>
                {' '}coberto
              </p>
            )}
          </div>

          <CoberturaDiplomas
            query={coberturaQ}
            escolhido={diploma}
            aoEscolher={(cod) => actualizar({ diploma: cod })}
          />

          {/* filtros: fichas com a contagem que cada uma daria, e a pesquisa no endereço */}
          <div className={cn('space-y-3 rounded-xl border px-4 py-3', T.linha, T.superficie)}>
            <div className="relative">
              <Search className={cn('pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2', tk.tintaFraca)} aria-hidden="true" />
              <Input
                type="search"
                value={termo}
                onChange={e => actualizar({ q: e.target.value }, { replace: true })}
                placeholder="Procurar por parágrafo, requisito ou texto da norma…"
                aria-label="Procurar na matriz"
                className="pl-9 pr-9"
              />
              {termo && (
                <button
                  type="button"
                  onClick={() => actualizar({ q: '' }, { replace: true })}
                  aria-label="Limpar a pesquisa"
                  className={cn('absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full', tk.hover, tk.foco)}
                >
                  <X className={cn('h-4 w-4', tk.tintaFraca)} aria-hidden="true" />
                </button>
              )}
            </div>
            <FichasFiltro titulo="Estado" opcoes={f.opcoesEstado} valor={estado} aoEscolher={v => actualizar({ estado: v })} />
            <FichasFiltro titulo="Risco" opcoes={f.opcoesCriticidade} valor={criticidade} aoEscolher={v => actualizar({ crit: v })} />
            <FichasFiltro titulo="Manual" opcoes={f.opcoesProcesso} valor={processo} aoEscolher={v => actualizar({ processo: v })} />
          </div>

          <ResumoFiltros aplicados={aplicados} aoLimparTudo={limparTudo} />

          <MatrizRequisitos
            query={matrizQ}
            lista={f.lista}
            abertos={abertos}
            aoAbrir={alternarAberto}
            podeMexer={gestor}
            haFiltros={aplicados.length > 0}
            aoLimparFiltros={limparTudo}
            aoApontar={(r) => setModalProva({ requisito: r, prova: null })}
            aoEditarRequisito={(r) => setModalRequisito(r ? { requisito: r } : { nova: true })}
            aoEditarProva={(r, p) => setModalProva({ requisito: r, prova: p })}
          />
        </TabsContent>

        {/* ── impacto na formação ───────────────────────────────────────── */}
        <TabsContent value="formacao" className="mt-4 space-y-4">
          <p className={cn('max-w-prose rounded-xl border px-4 py-3 text-sm', T.linha, T.superficie, tk.tintaMedia)}>
            Um procedimento que muda tem quase sempre uma aula que o ensina. Quando entra em vigor uma revisão de
            um documento ligado a um curso, o servidor abre aqui um alerta — sem depender de ninguém se lembrar.
            As ligações fazem-se na ficha de cada documento, no bloco «Formação que ensina este documento».
          </p>
          <ImpactoFormacao podeMexer={gestor} />
        </TabsContent>
      </Tabs>

      {modalProva && (
        <ModalProva
          key={modalProva.prova?.id || `nova-${modalProva.requisito?.requisito_id}`}
          aberta
          aoFechar={() => setModalProva(null)}
          requisito={modalProva.requisito}
          prova={modalProva.prova}
          aoGravar={recarregarConf}
        />
      )}
      {modalRequisito && (
        <ModalRequisito
          key={modalRequisito.requisito?.requisito_id || 'nova'}
          aberta
          aoFechar={() => setModalRequisito(null)}
          diplomas={diplomasQ.data || []}
          requisito={modalRequisito.requisito}
          diplomaInicial={diploma}
          aoGravar={recarregarConf}
        />
      )}

      {!diplomasQ.isLoading && !(diplomasQ.data || []).length && (
        <p className={cn('flex items-start gap-2 rounded-xl border px-4 py-3 text-sm', T.linha, tk.avisoFundo, tk.tintaMedia)}>
          <Scale className={cn('mt-0.5 h-4 w-4 shrink-0', tk.aviso)} aria-hidden="true" />
          Não há diplomas carregados. Se acabou de aplicar a migração 159, recarregue a página; se continuar
          vazio, é sinal de que a migração ainda não foi aplicada no servidor.
        </p>
      )}
    </PaginaGestao>
  );
}

// ── nota de integração (para quem fizer as rotas e o menu) ──────────────────
// 1) Rota: `${PORTAL_BASE}/gestao/conformidade` → este componente, em DocumentosApp.jsx.
// 2) Menu: entrada em NAV_GESTAO (PortalLayout.jsx) com `pagina: 'gestao_conformidade'` e um ícone (Scale ou
//    ShieldCheck), e a mesma chave em PAGINAS_PORTAL (src/lib/portalDocumentos.js) para as permissões por perfil.
// 3) Ficha do documento (pages/PortalDocumento.jsx): os blocos `FormacaoDoDocumento` e `RequisitosDoDocumento`,
//    logo antes da zona de risco — já estão lá nesta entrega.
// 4) Universidade Corporativa: `<ImpactoFormacao podeMexer />` pode ser montado tal como está num separador da
//    gestão de formação (por exemplo ao lado da «Visão geral»). Traz os seus próprios dados e não depende de
//    nada do portal de documentos a não ser dos símbolos de cor; as políticas da migração 159 já dão acesso a
//    quem gere formação (`pode_gerir_formacao()`), mesmo sem perfis do GED.
