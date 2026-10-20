// Painel da gestão documental. Responde a «o que tenho de fazer hoje», não a «quantos documentos existem»:
// uma tira fina de indicadores (os que estão a zero viram uma linha de texto) e, a seguir, as listas onde há
// trabalho — documentos sem responsável (com atribuição ali mesmo), validades a terminar, leituras em falta e
// pedidos de acesso pendentes. Não há bloco de atalhos: isso duplicava o menu lateral.
//
// Este ficheiro guarda também as peças que só a gestão precisa (tabela densa com cabeçalho fixo em janela própria,
// tira de indicadores, barra de selecção, zona de risco, estado no endereço). Ficam aqui, e não num ficheiro novo,
// porque o painel é a porta da área de gestão.
// O vocabulário visual NÃO nasce aqui: a cor vem de `tk`/`T`, os selos de estado e validade, os vazios, as falhas,
// o resumo de filtros e a densidade das linhas vêm da biblioteca e da moldura do portal. `GD` é só a lista de
// nomes que as páginas de gestão usam, apontada a esses símbolos — para a gestão não ter aspecto diferente da
// consulta e para a cor se decidir num sítio só.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, CalendarClock, CheckCircle2, ChevronRight, FilePlus2, Loader2, RefreshCw,
  Search, UserPlus, Users, X, ArrowUp, ChevronsUpDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import { fmtData } from '@/lib/safeDate';
import { supabase } from '@/lib/supabaseClient';
import { PORTAL_BASE, ESTADOS_DOCUMENTO, ESTADO_LABEL, diasParaExpirar, primeiroNome } from '@/lib/portalDocumentos';
import {
  useDocumentosDocs, usePastasDocs, useAeroportosDocs, useAcessosDocs, useResponsaveisAeroporto,
  useTodasLeiturasDocs, useRecarregarDocs, auditarDocs,
} from '../../hooks';
import {
  tk, EstadoChip, ValidadeChip, Vazio, Falha, mapaPorId, nomeAero, urlDoc, versaoDoc,
  DENSIDADES, preferenciaDensidadeDocs, guardarPreferenciaDensidadeDocs, alturaDensidade,
} from '../PortalBiblioteca';
import { PaginaGestao, T, Ref, TituloSeccao, dataVigor } from '../../PortalLayout';

// O resumo dos filtros aplicados é o mesmo da biblioteca — as páginas de gestão importam-no por aqui para não
// haver duas versões da mesma peça. Props: `aplicados` ({ chave, rotulo, aoRemover }) e `aoLimparTudo`.
export { ResumoFiltros } from '../PortalBiblioteca';

// ── símbolos de cor usados pela gestão ──────────────────────────────────────
// Não há cor nova aqui: são os nomes da gestão apontados aos símbolos partilhados (`tk`, da biblioteca, e `T`, da
// moldura). Mudar a paleta do portal muda a gestão com ela.
export const GD = {
  superficie: tk.superficie,
  superficieFraca: tk.superficieBaixa,
  borda: tk.borda,
  divisoria: tk.divisoria,
  tinta: tk.tinta,
  tintaMedia: tk.tintaMedia,
  meta: tk.tintaFraca,
  acento: tk.acento,
  bom: tk.bom,
  alerta: tk.aviso,
  perigo: tk.perigo,
  foco: tk.foco,
  linhaActiva: tk.seleccionada,
  hover: tk.hover,
  // números, referências e códigos de documento: monoespaçado com algarismos tabulares
  ref: tk.mono,
  avisoSuave: cn(tk.avisoBorda, tk.avisoFundo, 'text-amber-900 dark:text-amber-100'),
  caixa: T.caixa,
};
const TOM = { perigo: GD.perigo, alerta: GD.alerta, bom: GD.bom, neutro: GD.tinta };

// ── superfícies e cabeçalhos de secção ──────────────────────────────────────
export function Painel({ className, children, ...resto }) {
  return <section className={cn('overflow-hidden', T.caixa, className)} {...resto}>{children}</section>;
}

// Cabeçalho de secção: título (vocabulário da moldura), contagem real ao lado e acções à direita.
export function Cabecalho({ titulo, contagem, descricao, accoes, icone: Icone, id, caixaAlta = true }) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b px-3 py-2.5', GD.borda)}>
      <div className="min-w-0">
        <TituloSeccao className={cn('mb-0', !caixaAlta && 'text-base normal-case tracking-normal')} contagem={contagem}>
          <span id={id} className="inline-flex items-center gap-2">
            {Icone && <Icone className={cn('h-4 w-4 shrink-0', GD.acento)} aria-hidden="true" />}
            {titulo}
          </span>
        </TituloSeccao>
        {descricao && <p className={cn('mt-1 text-sm normal-case', GD.meta)}>{descricao}</p>}
      </div>
      {accoes && <div className="flex flex-wrap items-center gap-2">{accoes}</div>}
    </div>
  );
}

// ── tabela densa ────────────────────────────────────────────────────────────
// Cabeçalho fixo (a tabela rola dentro da sua própria janela), divisória de 1 px, sem zebra. A altura da linha é a
// densidade escolhida em «A minha conta» ou no comutador: a preferência é a MESMA da biblioteca (gd:densidade),
// para a pessoa não ter de a escolher duas vezes.
// A densidade de uma tabela de documentos não é só a altura da linha: a célula do documento tem número + título +
// aeroporto empilhados, pelo que a compactação real vem de quantas linhas o título mostra, de esconder o aeroporto
// e do espaçamento vertical. Assim Compacta/Normal/Folgada ficam visivelmente diferentes (e não todas iguais).
const ALTURAS = {
  40: '[&_tbody_td]:py-1 [&_.clamp-titulo]:line-clamp-1 [&_.linha-meta]:hidden',
  48: '[&_tbody_td]:py-2 [&_.clamp-titulo]:line-clamp-1',
  56: '[&_tbody_td]:py-3 [&_.clamp-titulo]:line-clamp-2',
};
export function useDensidade() {
  const [valor, setValor] = useState(() => preferenciaDensidadeDocs());
  const mudar = useCallback((v) => { setValor(v); guardarPreferenciaDensidadeDocs(v); }, []);
  return [alturaDensidade(valor), mudar, valor];
}
export function ComutadorDensidade({ valor, aoMudar }) {
  return (
    <div className={cn('flex items-center gap-0.5 rounded-lg border p-0.5', GD.borda)} role="group" aria-label="Altura das linhas">
      {DENSIDADES.map(d => (
        <button
          key={d.value} type="button" onClick={() => aoMudar(d.value)} aria-pressed={valor === d.altura}
          title={`${d.label} — linhas de ${d.px}`}
          className={cn('min-h-[2rem] rounded-md px-2.5 py-1 text-sm font-medium', GD.foco,
            valor === d.altura ? cn(tk.acentoFundo, GD.acento) : GD.meta)}
        >
          {d.label}
        </button>
      ))}
    </div>
  );
}

export function Tabela({ children, altura = 48, alturaMax = 'calc(100vh - 18rem)', rotulo, className }) {
  return (
    <div className={cn('overflow-auto overscroll-contain', className)} style={{ maxHeight: alturaMax }}>
      <table aria-label={rotulo} className={cn('w-full border-collapse text-left text-sm', ALTURAS[altura] || ALTURAS[48])}>
        {children}
      </table>
    </div>
  );
}
// Cabeçalho da tabela. Com `aoOrdenar` passa a ser o botão de ordenação da coluna: clicar ordena (e inverte).
export function Th({ children, className, numerico, estreito, ordenavel, activa, dir = 'asc', aoOrdenar }) {
  const base = cn('sticky top-0 z-10 whitespace-nowrap border-b px-3 py-2 text-xs font-semibold uppercase tracking-wider',
    GD.borda, GD.meta, 'bg-white/95 backdrop-blur dark:bg-slate-900/95',
    numerico && 'text-right', estreito && 'w-px', className);
  if (!ordenavel || !aoOrdenar) return <th scope="col" className={base}>{children}</th>;
  return (
    <th scope="col" aria-sort={activa ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={cn(base, 'p-0')}>
      <button
        type="button" onClick={aoOrdenar}
        className={cn('flex w-full items-center gap-1 px-3 py-2 uppercase tracking-wider', GD.foco,
          numerico && 'justify-end', activa ? GD.acento : 'hover:text-slate-900 dark:hover:text-white')}
      >
        {numerico && (activa ? <ArrowUp className={cn('h-3 w-3 shrink-0 transition-transform', dir === 'desc' && 'rotate-180')} aria-hidden="true" /> : <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-40" aria-hidden="true" />)}
        <span className="truncate">{children}</span>
        {!numerico && (activa ? <ArrowUp className={cn('h-3 w-3 shrink-0 transition-transform', dir === 'desc' && 'rotate-180')} aria-hidden="true" /> : <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-40" aria-hidden="true" />)}
      </button>
    </th>
  );
}
export function Tr({ children, className, activa, ...resto }) {
  return (
    <tr className={cn('transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40', activa && GD.linhaActiva, className)} {...resto}>
      {children}
    </tr>
  );
}
export function Td({ children, className, numerico, ...resto }) {
  return (
    <td className={cn('border-b px-3 py-1.5 align-middle', GD.borda, numerico && 'text-right tabular-nums', className)} {...resto}>
      {children}
    </td>
  );
}
// Acções de linha: sempre visíveis e alcançáveis por teclado (nunca só ao passar o rato), as destrutivas
// separadas das normais por uma divisória.
export function AccoesLinha({ children, destrutivas }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      {children}
      {destrutivas && (
        <>
          <span className={cn('mx-1 hidden h-5 w-px sm:block', 'bg-slate-200 dark:bg-slate-700')} aria-hidden="true" />
          {destrutivas}
        </>
      )}
    </div>
  );
}

// A carregar: linhas-esqueleto com as dimensões reais das linhas, não rodas.
export function LinhasEsqueleto({ linhas = 6, colunas = 5, altura = 48 }) {
  const h = altura === 40 ? 'h-10' : altura === 56 ? 'h-14' : 'h-12';
  return (
    <tbody aria-busy="true">
      <tr className="sr-only"><td colSpan={colunas}>A carregar…</td></tr>
      {Array.from({ length: linhas }).map((_, i) => (
        <tr key={i} className={h}>
          {Array.from({ length: colunas }).map((__, j) => (
            <td key={j} className={cn('border-b px-3 py-1.5', GD.borda)}>
              <Skeleton className={cn('h-4', j === 0 ? 'w-[70%]' : 'w-14')} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}
// Mensagem a toda a largura dentro da tabela (vazio, erro) sem perder o cabeçalho.
export function LinhaMensagem({ colunas, children }) {
  return <tbody><tr><td colSpan={colunas} className="p-0">{children}</td></tr></tbody>;
}

// ── tira de indicadores ─────────────────────────────────────────────────────
// Uma só tira fina. Um indicador a zero não ocupa espaço: junta-se à linha de texto por baixo.
export function TiraIndicadores({ itens = [], nota, carregando, className }) {
  // Um indicador só ocupa lugar na tira se tiver algo acima de zero (ou se for marcado como `sempre`).
  // Valor nulo = número que não se pôde calcular (serviço em baixo): não vira nem cartão nem «está tudo bem».
  const visiveis = itens.filter(i => i.valor != null && (i.sempre || Number(i.valor) > 0));
  const zeros = itens.filter(i => i.valor != null && !i.sempre && Number(i.valor) === 0 && i.zero).map(i => i.zero);
  const rodape = [...zeros, nota].filter(Boolean).join(' · ');

  if (carregando) {
    return (
      <div className={cn('flex flex-wrap rounded-xl border', GD.borda, GD.superficie, className)}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} className={cn('min-w-[9rem] flex-1 border-r px-4 py-2.5 last:border-r-0', GD.borda)}>
            <Skeleton className="h-3 w-24" /><Skeleton className="mt-2 h-7 w-12" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className={className}>
      {visiveis.length > 0 && (
        <div className={cn('flex flex-wrap rounded-xl border', GD.borda, GD.superficie)}>
          {visiveis.map(i => {
            const corpo = (
              <>
                <span className={cn('block text-xs font-medium uppercase tracking-wider', GD.meta)}>{i.label}</span>
                <span className="mt-0.5 flex items-baseline gap-1.5">
                  <span className={cn('text-2xl font-bold tabular-nums leading-none', TOM[i.tom] || TOM.neutro)}>{i.valor}</span>
                  {i.sufixo && <span className={cn('text-sm', GD.meta)}>{i.sufixo}</span>}
                </span>
              </>
            );
            const classe = cn('block min-w-[9rem] flex-1 border-r px-4 py-2.5 last:border-r-0', GD.borda);
            return i.to
              ? <Link key={i.chave} to={i.to} className={cn(classe, 'hover:bg-slate-50 dark:hover:bg-slate-800/50', GD.foco)}>{corpo}</Link>
              : <div key={i.chave} className={classe}>{corpo}</div>;
          })}
        </div>
      )}
      {rodape && <p className={cn('mt-2 flex items-start gap-1.5 text-sm', GD.meta)}>{visiveis.length === 0 && <CheckCircle2 className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', GD.bom)} aria-hidden="true" />}<span>{rodape}</span></p>}
    </div>
  );
}

// ── filtros: fichas com contagem e resumo removível ─────────────────────────
export function Ficha({ activa, contagem, children, aoClicar, titulo }) {
  return (
    <button
      type="button" onClick={aoClicar} aria-pressed={!!activa} title={titulo}
      className={cn('inline-flex min-h-[2rem] items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm font-medium', GD.foco,
        activa ? 'border-teal-600 bg-teal-50 text-teal-900 dark:border-teal-500 dark:bg-teal-950/60 dark:text-teal-100' : cn(GD.borda, GD.tintaMedia, 'hover:bg-slate-50 dark:hover:bg-slate-800'))}
    >
      {children}
      {contagem != null && <span className="tabular-nums opacity-70">{contagem}</span>}
    </button>
  );
}
// Resumo dos filtros aplicados, por cima da lista: cada um sai sozinho, e há um «limpar tudo».
// (o resumo dos filtros é o `ResumoFiltros` da biblioteca, reexportado no topo deste ficheiro)
export function CampoBusca({ id, etiqueta = 'Procurar', valor, aoMudar, dica, className }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id}>{etiqueta}</Label>
      <div className="relative">
        <Search className={cn('pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2', GD.meta)} aria-hidden="true" />
        <Input id={id} value={valor} onChange={e => aoMudar(e.target.value)} placeholder={dica} className="pl-9" />
      </div>
    </div>
  );
}

// ── o estado vive no endereço ───────────────────────────────────────────────
// Qualquer vista de gestão fica partilhável e citável num relatório de auditoria.
export function useFiltrosUrl(padroes = {}) {
  const [sp, setSp] = useSearchParams();
  const chaves = Object.keys(padroes);
  const valores = {};
  for (const k of chaves) valores[k] = sp.get(k) ?? padroes[k];
  const definir = useCallback((patch, { substituir = true } = {}) => {
    const p = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) { if (v === '' || v == null) p.delete(k); else p.set(k, String(v)); }
    setSp(p, { replace: substituir });
  }, [sp, setSp]);
  const limpar = useCallback((lista) => {
    const p = new URLSearchParams(sp);
    (lista || chaves).forEach(k => p.delete(k));
    setSp(p, { replace: true });
  }, [sp, setSp, chaves.join('|')]);
  return [valores, definir, limpar];
}
// Caixa de texto que só mexe no endereço quando a pessoa pára de escrever (e acompanha mudanças vindas de fora).
export function useBuscaDebounce(valorUrl, aplicar, ms = 350) {
  const [valor, setValor] = useState(valorUrl || '');
  const ultimo = useRef(valorUrl || '');
  useEffect(() => {
    const t = setTimeout(() => { if (valor !== ultimo.current) { ultimo.current = valor; aplicar(valor); } }, ms);
    return () => clearTimeout(t);
  }, [valor, ms, aplicar]);
  useEffect(() => {
    if ((valorUrl || '') !== ultimo.current) { ultimo.current = valorUrl || ''; setValor(valorUrl || ''); }
  }, [valorUrl]);
  return [valor, setValor];
}

// ── selecção e zona de risco ────────────────────────────────────────────────
// Selecção abre uma barra fixa em baixo com a contagem e as acções.
export function BarraSelecao({ n, children, aoLimpar }) {
  if (!n) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4">
      <div className={cn('pointer-events-auto flex flex-wrap items-center justify-center gap-2 rounded-xl border px-3 py-2 shadow-lg', GD.borda, GD.superficie)}>
        <span className={cn('text-sm font-medium tabular-nums', GD.tinta)}>{n} seleccionado{n === 1 ? '' : 's'}</span>
        {children}
        <Button variant="ghost" size="sm" onClick={aoLimpar}><X className="h-4 w-4" aria-hidden="true" />Limpar</Button>
      </div>
    </div>
  );
}
// Acções destrutivas separadas das normais, com a explicação do que não se desfaz.
export function ZonaRisco({ titulo = 'Acções irreversíveis', texto, children }) {
  return (
    <div className={cn('rounded-xl border border-dashed p-3', 'border-red-200 dark:border-red-900/60')}>
      <p className={cn('text-sm font-semibold uppercase tracking-wider', GD.perigo)}>{titulo}</p>
      {texto && <p className={cn('mt-1 text-sm', GD.meta)}>{texto}</p>}
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

// ── peças de documento reutilizadas pela gestão ─────────────────────────────
// Identidade do documento numa célula: número em monoespaçado por cima, título a seguir. É o que a lei manda ver
// de relance, com a versão e a entrada em vigor em colunas próprias.
export function CelulaDocumento({ doc, meta, to = urlDoc(doc.id), semNumero = false }) {
  return (
    <div className="min-w-0">
      {/* O número é o identificador — mostra-se inteiro (é curto); quem trunca é o título. Esconde-se quando a tabela já tem uma coluna de Código. */}
      {!semNumero && <Ref className={cn('block whitespace-nowrap', GD.meta)} title={doc.numero || undefined}>{doc.numero || 'sem número'}</Ref>}
      {/* `clamp-titulo` e `linha-meta` são âncoras: a densidade da tabela decide quantas linhas o título mostra e se o aeroporto aparece. */}
      <Link to={to} title={doc.titulo || undefined} className={cn('clamp-titulo block font-medium hover:underline line-clamp-2', GD.tinta, GD.foco)}>{doc.titulo}</Link>
      {meta && <span className={cn('linha-meta block truncate text-sm', GD.meta)} title={typeof meta === 'string' ? meta : undefined}>{meta}</span>}
    </div>
  );
}
// Data de entrada em vigor, já formatada: a data vem do `dataVigor` da moldura (em vigor desde, não a última
// alteração) e a formatação do `fmtData`, que nunca rebenta com datas nulas.
export const textoVigor = (doc) => fmtData(dataVigor(doc));

// ── atribuir responsável (ali mesmo, sem sair da lista) ─────────────────────
// `alvo` é sempre um vector: um documento (a partir da linha) ou os seleccionados (a partir da barra de selecção).
// Com um só documento, dá ainda a opção de tratar de uma vez os restantes do mesmo aeroporto que estão sem
// responsável — são 217 no portal, e clicar 217 vezes não é trabalho de ninguém.
export function DialogResponsavel({ alvo, semResponsavel, responsaveis, aeroportos, actor, onFechar, onFeito }) {
  const { toast } = useToast();
  const docs = Array.isArray(alvo) ? alvo : [alvo];
  const unico = docs.length === 1 ? docs[0] : null;
  const [email, setEmail] = useState(unico?.responsavel_email || '');
  const [emMassa, setEmMassa] = useState(false);
  const [busy, setBusy] = useState(false);
  // sugestões: quem já é responsável do aeroporto do documento (é também quem aprova os seus documentos)
  const sugestoes = useMemo(() => {
    const aeros = new Set(docs.map(d => d.aeroporto_id).filter(Boolean));
    const doAeroporto = (responsaveis || []).filter(r => aeros.has(r.aeroporto_id));
    const lista = doAeroporto.length ? doAeroporto : (responsaveis || []);
    return [...new Map(lista.map(r => [String(r.email || '').toLowerCase(), r])).values()].slice(0, 8);
  }, [responsaveis, docs]);
  const iguaisAeroporto = useMemo(() => (unico ? (semResponsavel || []).filter(d => d.id !== unico.id && d.aeroporto_id === unico.aeroporto_id) : []), [semResponsavel, unico]);

  const guardar = async () => {
    const valor = email.trim().toLowerCase();
    if (!valor.includes('@')) { toast({ title: 'Indique um email válido', variant: 'destructive' }); return; }
    setBusy(true);
    try {
      const ids = [...new Set([...docs.map(d => d.id), ...(emMassa ? iguaisAeroporto.map(d => d.id) : [])])];
      const { error } = await supabase.from('documento').update({ responsavel_email: valor, updated_date: new Date().toISOString() }).in('id', ids);
      if (error) throw error;
      await auditarDocs(actor, {
        acao: 'documento_responsavel', id: unico?.id,
        detalhes: `Responsável ${valor} atribuído a ${ids.length} documento(s)${unico && ids.length === 1 ? `: «${unico.titulo}»` : ''}`,
      });
      toast({ title: ids.length === 1 ? 'Responsável atribuído' : `${ids.length} documentos actualizados`, description: `${valor} passa a receber os avisos de validade.` });
      onFeito();
    } catch (e) {
      toast({ title: 'Não foi possível atribuir', description: e?.message || String(e), variant: 'destructive' });
    } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-teal-600" aria-hidden="true" />{unico ? 'Responsável do documento' : `Responsável de ${docs.length} documentos`}</DialogTitle>
          <DialogDescription className="break-words">
            {unico ? `${unico.numero ? `${unico.numero} · ` : ''}${unico.titulo}` : docs.slice(0, 3).map(d => d.titulo).join('; ') + (docs.length > 3 ? `; e mais ${docs.length - 3}` : '')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rp-email">Email do responsável</Label>
            <Input id="rp-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nome@sga.co.ao" autoComplete="off" />
            <p className={cn('text-sm', GD.meta)}>Mantém o documento actualizado e recebe os avisos de validade (30, 60 e 90 dias).</p>
          </div>
          {sugestoes.length > 0 && (
            <div className="space-y-1.5">
              <p className={cn('text-sm font-medium', GD.tintaMedia)}>
                {unico?.aeroporto_id ? `Quem já responde por ${nomeAero(aeroportos, unico.aeroporto_id)}` : 'Responsáveis de aeroporto já registados'}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {sugestoes.map(r => (
                  <Ficha key={r.email} activa={email.trim().toLowerCase() === String(r.email).toLowerCase()} aoClicar={() => setEmail(r.email)}>
                    {r.nome || r.email}
                  </Ficha>
                ))}
              </div>
            </div>
          )}
          {iguaisAeroporto.length > 0 && (
            <label className={cn('flex items-start gap-2.5 rounded-lg border p-3 text-sm', GD.borda)}>
              <Checkbox className="mt-0.5" checked={emMassa} onCheckedChange={setEmMassa} aria-label="Atribuir também aos restantes documentos sem responsável do mesmo aeroporto" />
              <span>
                <span className={cn('block font-medium', GD.tinta)}>Atribuir também aos outros {iguaisAeroporto.length} documento(s) sem responsável do mesmo aeroporto</span>
                <span className={cn('text-sm', GD.meta)}>Poupa trabalho quando é a mesma pessoa a responder por tudo o que está naquele aeroporto.</span>
              </span>
            </label>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onFechar} disabled={busy}>Cancelar</Button>
          <Button onClick={guardar} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}Guardar responsável</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── painel ──────────────────────────────────────────────────────────────────
const LIMITE_LISTA = 10;   // o painel mostra o topo de cada lista; o resto vê-se na página da lista completa

export default function PortalGestaoPainel() {
  const { user } = useAuth();
  const recarregar = useRecarregarDocs();
  const [altura, setAltura] = useDensidade();
  const [atribuir, setAtribuir] = useState(null);

  const docsQ = useDocumentosDocs({ limite: 1000 });
  const pastasQ = usePastasDocs();
  const aeroportosQ = useAeroportosDocs();
  const leiturasQ = useTodasLeiturasDocs();
  const acessosQ = useAcessosDocs();
  const responsaveisQ = useResponsaveisAeroporto();

  const docs = docsQ.data || [];
  const mapaAero = useMemo(() => mapaPorId(aeroportosQ.data || []), [aeroportosQ.data]);
  const aCarregar = docsQ.isLoading;

  const porEstado = useMemo(() => {
    const c = {};
    for (const d of docs) { const k = d.estado || 'rascunho'; c[k] = (c[k] || 0) + 1; }
    return c;
  }, [docs]);

  // Validades: expirados primeiro, depois 30/60/90 dias (cada documento conta uma vez só).
  const validade = useMemo(() => {
    const r = { lista: [], expirados: 0, d30: 0, semValidade: 0 };
    for (const d of docs) {
      if ((d.estado || 'em_vigor') === 'obsoleto') continue;
      const dias = diasParaExpirar(d);
      if (dias === null) { r.semValidade += 1; continue; }
      if (dias > 90) continue;
      if (dias < 0) r.expirados += 1; else if (dias <= 30) r.d30 += 1;
      r.lista.push(d);
    }
    r.lista.sort((a, b) => (diasParaExpirar(a) ?? 0) - (diasParaExpirar(b) ?? 0));
    return r;
  }, [docs]);

  const semResponsavel = useMemo(() => docs.filter(d => !d.responsavel_email && (d.estado || 'em_vigor') !== 'obsoleto'), [docs]);

  // Leituras em falta: documentos em vigor marcados com «exige confirmação» que ainda não têm nenhuma.
  const leituras = useMemo(() => {
    const porDoc = new Map();
    for (const l of leiturasQ.data || []) {
      if (!porDoc.has(l.documento_id)) porDoc.set(l.documento_id, new Set());
      porDoc.get(l.documento_id).add(String(l.email || '').toLowerCase());
    }
    const exigem = docs.filter(d => (d.estado || 'em_vigor') === 'em_vigor' && d.exige_leitura);
    return {
      exigem: exigem.length,
      emFalta: exigem.filter(d => !porDoc.get(d.id)?.size),
      confirmacoes: (leiturasQ.data || []).length,
      porDoc,
    };
  }, [docs, leiturasQ.data]);

  const pedidos = useMemo(() => (acessosQ.data?.pedidos || []).filter(p => (p.estado || 'pendente') === 'pendente'), [acessosQ.data]);
  const acessosEmBaixo = acessosQ.isError;
  const urlDocs = `${PORTAL_BASE}/gestao/documentos`;

  const indicadores = [
    { chave: 'resp', label: 'Sem responsável', valor: semResponsavel.length, tom: 'alerta', sufixo: 'ninguém avisado da validade', to: `${urlDocs}?responsavel=__sem__`, zero: 'Todos os documentos activos têm responsável' },
    { chave: 'exp', label: 'Expirados', valor: validade.expirados, tom: 'perigo', sufixo: 'validade terminada', to: `${urlDocs}?validade=expirado`, zero: 'Nenhum documento com a validade terminada' },
    { chave: 'd30', label: 'Expiram em 30 dias', valor: validade.d30, tom: 'alerta', to: `${urlDocs}?validade=30`, zero: 'Nada a expirar nos próximos 30 dias' },
    { chave: 'leit', label: 'Leituras em falta', valor: leituras.emFalta.length, tom: 'alerta', sufixo: 'sem nenhuma confirmação', to: `${PORTAL_BASE}/gestao/relatorios`, zero: leituras.exigem ? 'Todos os documentos que exigem confirmação já têm leituras' : null },
    { chave: 'ped', label: 'Pedidos de acesso', valor: acessosEmBaixo ? null : pedidos.length, tom: 'alerta', to: `${PORTAL_BASE}/gestao/acessos?tab=pedidos`, zero: 'Nenhum pedido de acesso à espera' },
    { chave: 'vigor', label: 'Em vigor', valor: porEstado.em_vigor || 0, tom: 'neutro', to: `${urlDocs}?estado=em_vigor` },
  ];
  const nota = `${docs.length} documento(s) no portal · ${(pastasQ.data || []).length} pasta(s) · ${validade.semValidade} sem validade definida`;

  const falha = (q, texto) => <Falha texto={q.error?.message || texto} onTentar={() => q.refetch?.()} />;

  return (
    <PaginaGestao
      titulo="Gestão documental"
      descricao={`Olá ${primeiroNome(user?.full_name || user?.email)}. O que está à sua espera hoje, ${fmtData(new Date())}.`}
      accoes={<>
        <ComutadorDensidade valor={altura} aoMudar={setAltura} />
        <Button variant="outline" onClick={() => recarregar()} disabled={docsQ.isFetching}><RefreshCw className={cn('h-4 w-4', docsQ.isFetching && 'animate-spin')} aria-hidden="true" />Actualizar</Button>
        <Button asChild><Link to={urlDocs}><FilePlus2 className="h-4 w-4" aria-hidden="true" />Novo documento</Link></Button>
      </>}
    >
      {acessosEmBaixo && (
        <div role="status" className={cn('flex items-start gap-2 rounded-lg border p-3 text-sm', GD.avisoSuave)}>
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Os pedidos de acesso e os convites não estão disponíveis: {acessosQ.error?.message || 'o serviço de acessos não respondeu.'} Tudo o resto no painel funciona.</span>
        </div>
      )}

      {docsQ.isError ? (
        <Painel>{falha(docsQ, 'Não foi possível carregar os documentos.')}</Painel>
      ) : (
        <>
          <TiraIndicadores itens={indicadores} nota={nota} carregando={aCarregar} />

          {/* ── documentos sem responsável: a lista maior e a que trava os avisos de validade ── */}
          <Painel>
            <Cabecalho
              icone={Users}
              titulo="Documentos sem responsável"
              contagem={aCarregar ? null : semResponsavel.length}
              descricao="Sem responsável, ninguém é avisado quando a validade se aproxima e não há quem reveja o documento."
              accoes={semResponsavel.length > LIMITE_LISTA && (
                <Button asChild variant="outline" size="sm"><Link to={`${urlDocs}?responsavel=__sem__`}>Ver os {semResponsavel.length}<ChevronRight className="h-4 w-4" aria-hidden="true" /></Link></Button>
              )}
            />
            <Tabela altura={altura} alturaMax="none" rotulo="Documentos sem responsável">
              <thead>
                <tr>
                  <Th>Documento</Th>
                  <Th className="hidden md:table-cell">Aeroporto</Th>
                  <Th>Estado</Th>
                  <Th numerico estreito>Versão</Th>
                  <Th className="hidden sm:table-cell">Em vigor desde</Th>
                  <Th estreito><span className="sr-only">Acções</span></Th>
                </tr>
              </thead>
              {aCarregar ? <LinhasEsqueleto linhas={4} colunas={6} altura={altura} />
                : semResponsavel.length === 0 ? (
                  <LinhaMensagem colunas={6}>
                    <Vazio icone={CheckCircle2} titulo="Todos os documentos activos têm responsável" texto="Nada a fazer aqui: cada documento tem quem o reveja e receba os avisos de validade." className="py-8" />
                  </LinhaMensagem>
                ) : (
                  <tbody>
                    {semResponsavel.slice(0, LIMITE_LISTA).map(d => (
                      <Tr key={d.id}>
                        <Td className="max-w-[24rem]"><CelulaDocumento doc={d} /></Td>
                        <Td className={cn('hidden text-sm md:table-cell', GD.meta)}>{nomeAero(mapaAero, d.aeroporto_id)}</Td>
                        <Td><EstadoChip estado={d.estado} /></Td>
                        <Td numerico className={cn('text-sm', GD.ref, GD.meta)}>{versaoDoc(d)}</Td>
                        <Td className={cn('hidden text-sm tabular-nums sm:table-cell', GD.meta)}>{textoVigor(d)}</Td>
                        <Td>
                          <AccoesLinha>
                            <Button size="sm" variant="outline" onClick={() => setAtribuir(d)}>
                              <UserPlus className="h-4 w-4" aria-hidden="true" />Atribuir
                            </Button>
                          </AccoesLinha>
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                )}
            </Tabela>
          </Painel>

          {/* ── validades a terminar ── */}
          <Painel>
            <Cabecalho
              icone={CalendarClock}
              titulo="Validades a terminar"
              contagem={aCarregar ? null : validade.lista.length}
              descricao="Expirados primeiro, depois os próximos 90 dias. É o responsável do documento quem o deve rever."
              accoes={validade.lista.length > LIMITE_LISTA && (
                <Button asChild variant="outline" size="sm"><Link to={`${PORTAL_BASE}/gestao/relatorios`}>Lista completa<ChevronRight className="h-4 w-4" aria-hidden="true" /></Link></Button>
              )}
            />
            <Tabela altura={altura} alturaMax="none" rotulo="Documentos com validade a terminar">
              <thead>
                <tr>
                  <Th>Documento</Th>
                  <Th>Validade</Th>
                  <Th>Estado</Th>
                  <Th numerico estreito>Versão</Th>
                  <Th className="hidden sm:table-cell">Em vigor desde</Th>
                  <Th className="hidden lg:table-cell">Responsável</Th>
                </tr>
              </thead>
              {aCarregar ? <LinhasEsqueleto linhas={4} colunas={6} altura={altura} />
                : validade.lista.length === 0 ? (
                  <LinhaMensagem colunas={6}>
                    <Vazio icone={CheckCircle2} titulo="Nada expira nos próximos 90 dias" texto={`${validade.semValidade} documento(s) não têm validade definida — se algum devia ter, acrescente a data em Documentos.`} className="py-8">
                      <Button asChild variant="outline" size="sm"><Link to={`${urlDocs}?validade=sem_validade`}>Ver os que não têm validade</Link></Button>
                    </Vazio>
                  </LinhaMensagem>
                ) : (
                  <tbody>
                    {validade.lista.slice(0, LIMITE_LISTA).map(d => (
                      <Tr key={d.id}>
                        <Td className="max-w-[22rem]"><CelulaDocumento doc={d} meta={nomeAero(mapaAero, d.aeroporto_id)} /></Td>
                        <Td><ValidadeChip documento={d} sempre /><span className={cn('mt-0.5 block text-xs tabular-nums', GD.meta)}>{fmtData(d.expira_em)}</span></Td>
                        <Td><EstadoChip estado={d.estado} /></Td>
                        <Td numerico className={cn('text-sm', GD.ref, GD.meta)}>{versaoDoc(d)}</Td>
                        <Td className={cn('hidden text-sm tabular-nums sm:table-cell', GD.meta)}>{textoVigor(d)}</Td>
                        <Td className={cn('hidden max-w-[14rem] truncate text-sm lg:table-cell', d.responsavel_email ? GD.meta : GD.alerta)}>
                          {d.responsavel_email || 'sem responsável'}
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                )}
            </Tabela>
          </Painel>

          <div className="grid gap-5 xl:grid-cols-2">
            {/* ── leituras em falta ── */}
            <Painel>
              <Cabecalho
                titulo="Leituras em falta"
                contagem={leiturasQ.isLoading ? null : leituras.emFalta.length}
                descricao="Documentos em vigor que exigem «li e tomei conhecimento» e ainda não têm nenhuma confirmação."
              />
              <Tabela altura={altura} alturaMax="none" rotulo="Documentos sem confirmação de leitura">
                <thead>
                  <tr>
                    <Th>Documento</Th>
                    <Th numerico estreito>Versão</Th>
                    <Th className="hidden sm:table-cell">Em vigor desde</Th>
                  </tr>
                </thead>
                {leiturasQ.isLoading || aCarregar ? <LinhasEsqueleto linhas={3} colunas={3} altura={altura} />
                  : leiturasQ.isError ? <LinhaMensagem colunas={3}>{falha(leiturasQ, 'Não foi possível carregar as confirmações de leitura.')}</LinhaMensagem>
                    : leituras.exigem === 0 ? (
                      <LinhaMensagem colunas={3}>
                        <Vazio titulo="Nenhum documento exige confirmação de leitura" texto="Marque «exige confirmação» num documento quando for preciso provar que a equipa tomou conhecimento." className="py-8">
                          <Button asChild variant="outline" size="sm"><Link to={urlDocs}>Ir para Documentos</Link></Button>
                        </Vazio>
                      </LinhaMensagem>
                    ) : leituras.emFalta.length === 0 ? (
                      <LinhaMensagem colunas={3}>
                        <Vazio icone={CheckCircle2} titulo="Todos já têm confirmações" texto={`${leituras.confirmacoes} confirmação(ões) registada(s) nos ${leituras.exigem} documento(s) que as exigem. A cobertura por aeroporto está em Relatórios.`} className="py-8" />
                      </LinhaMensagem>
                    ) : (
                      <tbody>
                        {leituras.emFalta.slice(0, LIMITE_LISTA).map(d => (
                          <Tr key={d.id}>
                            <Td className="max-w-[22rem]"><CelulaDocumento doc={d} meta={nomeAero(mapaAero, d.aeroporto_id)} /></Td>
                            <Td numerico className={cn('text-sm', GD.ref, GD.meta)}>{versaoDoc(d)}</Td>
                            <Td className={cn('hidden text-sm tabular-nums sm:table-cell', GD.meta)}>{textoVigor(d)}</Td>
                          </Tr>
                        ))}
                      </tbody>
                    )}
              </Tabela>
            </Painel>

            {/* ── pedidos de acesso ── */}
            <Painel>
              <Cabecalho
                titulo="Pedidos de acesso pendentes"
                contagem={acessosEmBaixo || acessosQ.isLoading ? null : pedidos.length}
                descricao="Feitos na página de entrada do portal. Responder dá (ou nega) a conta de leitor."
                accoes={pedidos.length > 0 && (
                  <Button asChild size="sm"><Link to={`${PORTAL_BASE}/gestao/acessos?tab=pedidos`}>Responder<ChevronRight className="h-4 w-4" aria-hidden="true" /></Link></Button>
                )}
              />
              <Tabela altura={altura} alturaMax="none" rotulo="Pedidos de acesso pendentes">
                <thead>
                  <tr>
                    <Th>Requerente</Th>
                    <Th className="hidden sm:table-cell">Função / aeroporto</Th>
                    <Th>Pedido</Th>
                  </tr>
                </thead>
                {acessosQ.isLoading ? <LinhasEsqueleto linhas={3} colunas={3} altura={altura} />
                  : acessosEmBaixo ? (
                    <LinhaMensagem colunas={3}>
                      <Falha titulo="Pedidos indisponíveis" texto={`${acessosQ.error?.message || 'O serviço de acessos não respondeu.'} Tente de novo; se persistir, avise quem administra o servidor.`} onTentar={() => acessosQ.refetch()} />
                    </LinhaMensagem>
                  ) : pedidos.length === 0 ? (
                    <LinhaMensagem colunas={3}>
                      <Vazio icone={CheckCircle2} titulo="Nenhum pedido à espera" texto="Os pedidos feitos na entrada do portal aparecem aqui para aprovar ou rejeitar." className="py-8" />
                    </LinhaMensagem>
                  ) : (
                    <tbody>
                      {pedidos.slice(0, LIMITE_LISTA).map(p => (
                        <Tr key={p.id}>
                          <Td className="max-w-[18rem]">
                            <span className={cn('block truncate font-medium', GD.tinta)}>{p.nome || p.email}</span>
                            <span className={cn('block truncate text-sm', GD.meta)}>{p.email}</span>
                          </Td>
                          <Td className={cn('hidden max-w-[14rem] truncate text-sm sm:table-cell', GD.meta)}>{[p.funcao, p.aeroporto].filter(Boolean).join(' · ') || '—'}</Td>
                          <Td className={cn('text-sm tabular-nums', GD.meta)}>{fmtData(p.created_date)}</Td>
                        </Tr>
                      ))}
                    </tbody>
                  )}
              </Tabela>
            </Painel>
          </div>

          {/* ── contexto: distribuição por estado, em último e sem destaque ── */}
          {!aCarregar && docs.length > 0 && (
            <Painel className="px-3 py-2.5">
              <p className={cn('text-xs font-semibold uppercase tracking-wider', GD.meta)}>Distribuição por estado</p>
              <div className={cn('mt-2 flex h-2 overflow-hidden rounded-full', GD.superficieFraca)} role="img" aria-label={ESTADOS_DOCUMENTO.map(e => `${ESTADO_LABEL[e.chave]}: ${porEstado[e.chave] || 0}`).join(', ')}>
                {ESTADOS_DOCUMENTO.map(e => {
                  const n = porEstado[e.chave] || 0;
                  if (!n) return null;
                  const cor = { rascunho: 'bg-slate-300 dark:bg-slate-600', em_revisao: 'bg-amber-400', aprovado: 'bg-sky-400', em_vigor: 'bg-emerald-500', obsoleto: 'bg-slate-400 dark:bg-slate-500' }[e.chave];
                  return <span key={e.chave} className={cor} style={{ width: `${(n / docs.length) * 100}%` }} />;
                })}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                {ESTADOS_DOCUMENTO.map(e => (
                  <Link key={e.chave} to={`${urlDocs}?estado=${e.chave}`} className={cn('inline-flex items-center gap-1.5 rounded px-1 text-sm', GD.foco, GD.meta)}>
                    <EstadoChip estado={e.chave} />
                    <span className="tabular-nums">{porEstado[e.chave] || 0}</span>
                  </Link>
                ))}
              </div>
            </Painel>
          )}

          {docs.length >= 1000 && (
            <p className={cn('text-sm', GD.meta)}>O painel conta os 1000 documentos alterados mais recentemente. Com mais do que isso, use os filtros em Documentos.</p>
          )}
        </>
      )}

      {atribuir && (
        <DialogResponsavel
          alvo={[atribuir]}
          semResponsavel={semResponsavel}
          responsaveis={responsaveisQ.data || []}
          aeroportos={mapaAero}
          actor={user}
          onFechar={() => setAtribuir(null)}
          onFeito={() => { setAtribuir(null); recarregar('documentos'); }}
        />
      )}
    </PaginaGestao>
  );
}
