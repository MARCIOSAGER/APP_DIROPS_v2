// «Aprovações» — a minha lista de trabalho, e o ecrã onde se assina.
//
// Dois ecrãs num só ficheiro porque são a mesma tarefa vista de duas distâncias: a lista responde a «o que
// espera por mim», o detalhe responde a «o que é que eu estou a assinar». O endereço distingue-os:
//   /documentos/aprovacao             → a lista (separador em ?aba=)
//   /documentos/aprovacao/:fluxoId    → o fluxo, onde se assina. É aqui que o botão do email aterra.
//
// Decisões que atravessam o ecrã do fluxo:
//
//   • O MOTIVO DA DEVOLUÇÃO SOBE AO CABEÇALHO. Quem recebe um documento de volta precisa de ler primeiro porque
//     é que voltou. Escondê-lo no histórico obriga a procurar aquilo que é a única coisa a fazer.
//
//   • O PDF VÊ-SE NA PÁGINA, NUNCA EM JANELA MODAL. Uma janela modal tapa justamente o que a pessoa precisa de
//     consultar enquanto decide. O portal proíbe-o, e com razão.
//
//   • O EDITÁVEL OU APARECE OU NÃO EXISTE. Para quem não tem direito a ele não se mostra nada — nem botão
//     desactivado nem explicação. Não há nada a explicar a quem não tem de saber que o ficheiro existe.
//
//   • UM SÓ BOTÃO PRIMÁRIO, com o rótulo do acto vindo da base de dados, e «Devolver» ao lado. O que decide se
//     aparecem é `documento_fluxo_quem_pode()` — a função de assinar volta a chamá-la, por isso o botão é
//     conveniência e nunca autorização.
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, Building2, ExternalLink, FileText, Inbox, Loader2, Lock, RefreshCw,
  Stamp, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { fmtDataHora } from '@/lib/safeDate';
import { useAuth } from '@/lib/AuthContext';
import { PORTAL_BASE, ehGestorDocs } from '@/lib/portalDocumentos';
import {
  T, MONO, EstadoVazio, EstadoErro, EsqueletoLinhas, TituloSeccao,
} from './PortalLayout';
import {
  FLUXO_BASE, enderecoFluxo, MOTIVO_MINIMO,
  cancelar as cancelarFluxo, enderecoPercurso, textoParado, urlFicheiroFluxo,
} from './apiFluxo';
import {
  useActosFluxo, useFluxosPendentes, useFluxo, usePassosFluxo, useAvisosFluxo, useFicheirosFluxo,
  useAssinaturasFluxo, useCadeiaAssinaturas, usePodeVerEditavel, useQuemPode, useContextoFluxo,
  useRecarregarFluxo, devolucaoActual, parDaRonda, podeCancelar, podeDevolver, destinosDevolucao,
  rotuloRevisao,
} from './hooksFluxo';
import { BotaoAccao, BotaoDescarregar, Caixa, EsperaPor, LinhaFicheiro, SeloFluxo } from './components/fluxo/comum';
import CartaoEtapa from './components/fluxo/CartaoEtapa';
import SeloAssinatura from './components/fluxo/SeloAssinatura';
import PainelAssinar from './components/fluxo/PainelAssinar';
import CaixaDevolucao from './components/fluxo/CaixaDevolucao';
import FormSubmissao from './components/fluxo/FormSubmissao';
import SubmeterEmLote from './components/fluxo/SubmeterEmLote';
import { fluxosParaRever, fluxosParaSubmeter } from './submeterLote';

const ABAS = [
  { chave: 'comigo', label: 'Comigo' },
  { chave: 'rever', label: 'À espera da minha revisão' },
  { chave: 'submeter', label: 'Por submeter' },
  { chave: 'meus', label: 'Submetidos por mim' },
  { chave: 'todos', label: 'Todos', soGestor: true },
];

export default function PortalFluxo() {
  const { fluxoId } = useParams();
  return fluxoId ? <EcraFluxo fluxoId={fluxoId} /> : <ListaAprovacoes />;
}

// ════════════════════════════════════════════════════════════════════════════
// A LISTA
// ════════════════════════════════════════════════════════════════════════════

export function ListaAprovacoes() {
  const [sp, setSp] = useSearchParams();
  const { user } = useAuth();
  const gestor = ehGestorDocs(user);
  const q = useFluxosPendentes();
  const recarregar = useRecarregarFluxo();

  const abas = ABAS.filter(a => !a.soGestor || gestor);
  const pedida = sp.get('aba') || 'comigo';
  const aba = abas.some(a => a.chave === pedida) ? pedida : 'comigo';
  const trocar = (chave) => {
    const p = new URLSearchParams(sp);
    if (chave === 'comigo') p.delete('aba'); else p.set('aba', chave);
    setSp(p, { replace: true });
  };

  const paraRever = useMemo(() => fluxosParaRever(q.todos, user?.email), [q.todos, user?.email]);
  const porSubmeter = useMemo(() => fluxosParaSubmeter(q.todos, user?.email), [q.todos, user?.email]);
  const linhas = aba === 'comigo' ? q.comigo : aba === 'rever' ? paraRever : aba === 'submeter' ? porSubmeter : aba === 'meus' ? q.meus : q.todos;
  const contagem = { comigo: q.comigo?.length || 0, rever: paraRever.length, submeter: porSubmeter.length, meus: q.meus?.length || 0, todos: q.todos?.length || 0 };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className={cn('text-xl font-bold tracking-tight sm:text-2xl', T.tinta)}>Aprovações</h1>
          <p className={cn('mt-1 max-w-prose text-sm', T.tintaFraca)}>
            Documentos a caminho de entrar em vigor. Cada passo é assinado aqui, com a senha da sua conta — o email avisa e leva a cópia, o portal recebe a assinatura.
          </p>
        </div>
        <Button variant="outline" className="min-h-[2.75rem]" onClick={recarregar}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />Recarregar
        </Button>
      </header>

      <nav aria-label="Filtro das aprovações" className="-mx-4 overflow-x-auto px-4">
        <ul className={cn('flex min-w-max gap-1 border-b', T.linha)}>
          {abas.map(a => (
            <li key={a.chave}>
              <button
                type="button"
                onClick={() => trocar(a.chave)}
                aria-current={aba === a.chave ? 'page' : undefined}
                className={cn(
                  '-mb-px flex min-h-[2.75rem] items-center gap-1.5 border-b-2 px-3 text-sm font-medium',
                  aba === a.chave
                    ? 'border-teal-700 text-teal-900 dark:border-teal-400 dark:text-teal-200'
                    : cn('border-transparent hover:border-slate-300 hover:text-slate-900 dark:hover:text-white', T.tintaFraca),
                  T.foco,
                )}
              >
                {a.label}
                {contagem[a.chave] > 0 && <span className="tabular-nums">({contagem[a.chave]})</span>}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <section className={cn('overflow-hidden rounded-xl border', T.linha, T.superficie)}>
        {q.isLoading ? (
          <EsqueletoLinhas linhas={4} />
        ) : q.isError ? (
          <EstadoErro
            titulo="Não foi possível carregar as aprovações"
            texto={q.error?.message || 'Pode ser uma falha momentânea da rede ou das permissões. Tente de novo; se continuar, avise a gestão do portal.'}
            onTentar={() => q.refetch?.()}
          />
        ) : aba === 'submeter' ? (
          <SubmeterEmLote linhas={q.todos} eu={user?.email} />
        ) : linhas.length === 0 ? (
          <VazioDaAba aba={aba} />
        ) : (
          <>
            <ul className={cn('divide-y', T.divisoria)}>
              {linhas.map(l => <LinhaAprovacao key={l.fluxo_id} linha={l} eu={user?.email} />)}
            </ul>
            <p className={cn('border-t px-3 py-2 text-sm sm:px-4', T.linha, T.tintaFraca)}>
              Ordenado por quem está à espera há mais tempo.
            </p>
          </>
        )}
      </section>
    </div>
  );
}

// Vazio que diz **porquê** está vazio, e nada mais: nesta página não há acção que faça sentido oferecer a quem
// não tem nada à espera. Um botão a mandar criar trabalho seria pior do que o espaço em branco.
function VazioDaAba({ aba }) {
  if (aba === 'meus') {
    return (
      <EstadoVazio
        icone={FileText}
        titulo="Não submeteu nada a aprovação"
        texto="Um documento entra aqui quando o põe a aprovação em Gestão › Documentos, ou a partir de uma emenda em rascunho."
      >
        <Button asChild variant="outline" className="min-h-[2.75rem]"><Link to={`${PORTAL_BASE}/gestao/documentos`}>Ir aos documentos</Link></Button>
      </EstadoVazio>
    );
  }
  if (aba === 'rever') {
    return <EstadoVazio icone={Inbox} titulo="Nada à espera da sua revisão" texto="Quando um elaborador submeter um documento em que é o revisor, aparece aqui — e recebe um email." />;
  }
  if (aba === 'todos') {
    return <EstadoVazio icone={Inbox} titulo="Nenhum fluxo a decorrer" texto="Não há documentos a caminho da aprovação neste momento." />;
  }
  return <EstadoVazio icone={Inbox} titulo="Não tem nada à espera de si." texto="Quando um documento precisar da sua revisão ou da sua aprovação, aparece aqui — e recebe um email." />;
}

// Linha densa: número (monoespaçado) e título, revisão, emenda, há quanto tempo espera, aeroporto, estado. Sete
// informações, que é o limite do que se lê de um relance.
function LinhaAprovacao({ linha: l, eu }) {
  const meu = String(l.espera_por || '').toLowerCase() === String(eu || '').toLowerCase();
  return (
    <li>
      <Link
        to={enderecoFluxo(l.fluxo_id)}
        className={cn('flex min-h-[3.5rem] items-start gap-3 px-3 py-3 transition-colors sm:px-4', T.realce, T.focoDentro)}
      >
        <Stamp className={cn('mt-0.5 h-5 w-5 shrink-0', meu ? T.acento : T.tintaFraca)} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            {l.numero
              ? <span style={MONO} className={cn('shrink-0 text-sm font-semibold', T.tinta)}>{l.numero}</span>
              : <span className={cn('shrink-0 text-sm italic', T.tintaFraca)}>sem número</span>}
            <span className={cn('min-w-0 flex-1 truncate font-medium', T.tinta)}>{l.titulo || 'Documento sem título'}</span>
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <SeloFluxo estado={l.estado} />
            <span className={cn('text-sm', T.tintaFraca)}>
              revisão <span className="tabular-nums">{l.revisao || '—'}</span>
              {l.emenda_numero ? <> · {l.emenda_tipo === 'corrigenda' ? 'corrigenda' : 'emenda'} nº <span className="tabular-nums">{l.emenda_numero}</span></> : null}
              {Number(l.ronda) > 1 ? <> · {l.ronda}.ª volta</> : null}
            </span>
            <span className={cn('text-sm', meu ? cn('font-medium', T.ambar) : T.tintaFraca)}>
              {meu ? 'espera por si ' : 'parado '}{textoParado(l)}
            </span>
            {l.aeroporto && (
              <span className={cn('inline-flex items-center gap-1 text-sm', T.tintaFraca)}>
                <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{l.aeroporto}
              </span>
            )}
            {!l.tem_pdf && <span className={cn('text-sm font-medium', T.vermelho)}>sem PDF carregado</span>}
            {l._porSuplencia && <span className={cn('text-sm', T.acento)}>como suplente de {l._porSuplencia.titular_email}</span>}
            {l._porAeroporto && !l._porSuplencia && <span className={cn('text-sm', T.acento)}>como responsável do aeroporto</span>}
          </span>
        </span>
      </Link>
    </li>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// O ECRÃ ONDE SE ASSINA
// ════════════════════════════════════════════════════════════════════════════

export function EcraFluxo({ fluxoId }) {
  const { user } = useAuth();
  const navegar = useNavigate();
  const gestor = ehGestorDocs(user);
  const recarregar = useRecarregarFluxo();

  const fluxoQ = useFluxo(fluxoId);
  const fluxo = fluxoQ.data || null;
  const ctx = useContextoFluxo(fluxo);
  const passosQ = usePassosFluxo(fluxoId);
  const assinaturasQ = useAssinaturasFluxo(fluxoId);
  const ficheirosQ = useFicheirosFluxo({ versaoId: fluxo?.versao_id });
  const editavelQ = usePodeVerEditavel(fluxo?.documento_id);
  const actos = useActosFluxo();
  const quemQ = useQuemPode(fluxo);
  const avisosQ = useAvisosFluxo(fluxoId);
  const cadeiaQ = useCadeiaAssinaturas(fluxo?.documento_id);

  const par = useMemo(() => parDaRonda(ficheirosQ.data, fluxo?.ronda), [ficheirosQ.data, fluxo?.ronda]);
  const devolucao = useMemo(() => devolucaoActual(fluxo, passosQ.data), [fluxo, passosQ.data]);
  const acto = quemQ.acto;
  const quem = quemQ.dados;
  const souElaborador = String(fluxo?.elaborador_email || '').toLowerCase() === String(user?.email || '').toLowerCase();
  const naMinhaMao = souElaborador && ['rascunho', 'devolvido'].includes(fluxo?.estado) && fluxo?.devolvido_para !== 'revisor';

  if (fluxoQ.isLoading) return <EsqueletoFluxo />;
  if (fluxoQ.isError) {
    return (
      <EstadoErro
        titulo="Não foi possível abrir este fluxo"
        texto={fluxoQ.error?.message || 'Pode ser uma falha de rede, ou o fluxo pode já não existir.'}
        onTentar={() => fluxoQ.refetch?.()}
      />
    );
  }
  if (!fluxo) {
    return (
      <EstadoVazio
        icone={Inbox}
        titulo="Este fluxo não existe, ou não é para si"
        texto="O endereço pode estar errado, o fluxo pode ter sido apagado com o documento, ou pode não ter acesso a este documento."
      >
        <Button asChild variant="outline" className="min-h-[2.75rem]"><Link to={FLUXO_BASE}><ArrowLeft className="h-4 w-4" aria-hidden="true" />Voltar às aprovações</Link></Button>
      </EstadoVazio>
    );
  }

  const revisao = rotuloRevisao(ctx.versao);

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" className="-ml-2 min-h-[2.75rem]">
        <Link to={FLUXO_BASE}><ArrowLeft className="h-4 w-4" aria-hidden="true" />Aprovações</Link>
      </Button>

      {/* ── 1. cabeçalho: o que é, em que pé está, de quem se espera ───────── */}
      <header className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              {ctx.documento?.numero && <span style={MONO} className={cn('font-semibold', T.tinta)}>{ctx.documento.numero}</span>}
              <SeloFluxo estado={fluxo.estado} />
            </p>
            <h1 className={cn('mt-1 text-xl font-bold tracking-tight sm:text-2xl', T.tinta)}>
              {ctx.documento?.titulo || 'Documento sem título'}
            </h1>
            <p className={cn('mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm', T.tintaFraca)}>
              <span>revisão <span className="tabular-nums">{revisao}</span></span>
              {ctx.emenda && <span>{ctx.emenda.tipo === 'corrigenda' ? 'corrigenda' : 'emenda'} nº <span className="tabular-nums">{ctx.emenda.numero}</span></span>}
              {Number(fluxo.ronda) > 1 && <span>{fluxo.ronda}.ª volta</span>}
              {ctx.aeroporto && <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" aria-hidden="true" />{ctx.aeroporto.codigo_icao} · {ctx.aeroporto.nome}</span>}
            </p>
          </div>
          <Button asChild variant="outline" className="min-h-[2.75rem]">
            <Link to={`${PORTAL_BASE}/documento/${fluxo.documento_id}`}>
              <ExternalLink className="h-4 w-4" aria-hidden="true" />Ficha do documento
            </Link>
          </Button>
        </div>

        <EsperaPor
          fluxo={fluxo}
          esperaPor={fluxo.estado === 'aguarda_revisao' ? fluxo.revisor_email
            : fluxo.estado === 'aguarda_aprovacao' ? fluxo.director_email
              : fluxo.estado === 'devolvido' ? (fluxo.devolvido_para === 'revisor' ? fluxo.revisor_email : fluxo.elaborador_email)
                : fluxo.elaborador_email}
          eu={user?.email}
        />

        {fluxo.resumo && (
          <p className={cn('max-w-prose rounded-lg border px-3 py-2 text-sm', T.linha, T.superficieFraca, T.tintaMedia)}>
            <span className="font-medium">O que muda: </span>{fluxo.resumo}
          </p>
        )}
      </header>

      {/* o motivo da devolução não se esconde no histórico: é a primeira coisa a ler */}
      {devolucao && (
        <Caixa tom="perigo" titulo={`Devolvido ${devolucao.para === 'revisor' ? 'ao revisor' : 'ao elaborador'} por ${devolucao.por}`}>
          <p className="whitespace-pre-line">{devolucao.motivo || 'Sem motivo registado.'}</p>
          <p className={cn('text-sm', T.tintaFraca)}>{fmtDataHora(devolucao.em)} · a correcção entra como ficheiro novo desta volta; o anterior fica no registo.</p>
        </Caixa>
      )}

      {/* um sinal forte, e um só: a cadeia de assinaturas deste documento não fecha */}
      {cadeiaQ.resumo.total > 0 && !cadeiaQ.resumo.intacta && (
        <Caixa tom="perigo" titulo="A cadeia de assinaturas deste documento não fecha">
          <p>
            Falta uma assinatura, foi intercalada uma, ou um elo está mal formado. Não assine mais nada neste documento antes de
            a gestão do portal verificar o registo.
          </p>
          <p>
            <Link to={enderecoPercurso(fluxo.documento_id)} className={cn('underline', T.acento)}>Ver o percurso das assinaturas</Link>
          </p>
        </Caixa>
      )}

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-6">
        {/* ── 2. o documento ──────────────────────────────────────────────── */}
        <div className="min-w-0 space-y-5">
          <section aria-label="O documento" className="space-y-3">
            <TituloSeccao>O documento</TituloSeccao>
            <VistaPdf pdf={par.pdf} ronda={fluxo.ronda} />
            <div className={cn('overflow-hidden rounded-xl border', T.linha, T.superficie)}>
              <LinhaEditavel
                editavel={par.editavel}
                podeVer={editavelQ.data}
                aCarregar={editavelQ.isLoading}
                fluxo={fluxo}
                restrito={ctx.documento?.editavel_restrito_a}
              />
            </div>
          </section>

          {/* ── 3. o acto ─────────────────────────────────────────────────── */}
          <section aria-label="O acto" className="space-y-3">
            <TituloSeccao>O que lhe compete</TituloSeccao>
            <Acto
              fluxo={fluxo}
              acto={acto}
              actoDados={acto ? actos.acto(acto) : null}
              quem={quem}
              quemACarregar={quemQ.isLoading}
              par={par}
              podeVerEditavel={editavelQ.data}
              naMinhaMao={naMinhaMao}
              ctx={ctx}
              gestor={gestor}
              eu={user?.email}
              onMudou={recarregar}
              onCancelado={() => navegar(FLUXO_BASE)}
            />
          </section>
        </div>

        {/* ── as provas, à direita ─────────────────────────────────────────── */}
        <aside className="mt-5 space-y-5 lg:mt-0">
          <section className={cn('rounded-xl border p-4', T.linha, T.superficie)} aria-label="Etapas">
            <TituloSeccao>Percurso</TituloSeccao>
            <CartaoEtapa fluxo={fluxo} assinaturas={assinaturasQ.data || []} actos={actos.porCodigo} eu={user?.email} />
          </section>

          <section className={cn('overflow-hidden rounded-xl border', T.linha, T.superficie)} aria-label="Assinaturas deste fluxo">
            <p className={cn('border-b px-3 py-2 text-sm font-semibold uppercase tracking-wider sm:px-4', T.linha, T.tintaMedia)}>
              Assinaturas{(assinaturasQ.data || []).length ? ` (${assinaturasQ.data.length})` : ''}
            </p>
            {assinaturasQ.isLoading ? (
              <div className="space-y-2 p-4"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>
            ) : (assinaturasQ.data || []).length === 0 ? (
              <EstadoVazio icone={Stamp} titulo="Ainda ninguém assinou" texto="A primeira assinatura é a da elaboração, no momento de submeter." className="py-8" />
            ) : (
              <ul className={cn('divide-y', T.divisoria)}>
                {(assinaturasQ.data || []).map((a, i) => (
                  <SeloAssinatura key={a.assinatura_id} assinatura={a} elo={cadeiaQ.porId.get(a.assinatura_id)} ordem={i + 1} />
                ))}
              </ul>
            )}
          </section>

          <Historico passos={passosQ.data} aCarregar={passosQ.isLoading} />
          <Avisos avisos={avisosQ.data} />
        </aside>
      </div>
    </div>
  );
}

// ── o PDF, em pré-visualização de página inteira ────────────────────────────
// O endereço vem da rota do backend, que confirma o acesso e **registra a abertura**. É por isso que não se usa
// um endereço assinado pedido daqui: um atalho que funcionasse mas não deixasse rasto abriria buracos na lista
// de acessos, que é justamente a lista que alguém vai querer ler quando houver uma dúvida.
function VistaPdf({ pdf, ronda }) {
  const [url, setUrl] = useState('');
  const [erro, setErro] = useState('');
  const [aCarregar, setACarregar] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let vivo = true;
    if (!pdf?.id) { setUrl(''); setErro(''); return undefined; }
    setACarregar(true); setErro('');
    urlFicheiroFluxo(pdf.id, { modo: 'abrir' })
      .then(u => { if (vivo) setUrl(u); })
      .catch(e => { if (vivo) setErro(e?.message || 'Não foi possível abrir o ficheiro.'); })
      .finally(() => { if (vivo) setACarregar(false); });
    return () => { vivo = false; };
  }, [pdf?.id, tentativa]);

  if (!pdf) {
    return (
      <div className={cn('overflow-hidden rounded-xl border', T.linha, T.superficie)}>
        <EstadoVazio
          icone={FileText}
          titulo="Esta revisão ainda não tem PDF carregado"
          texto="O PDF é o que se aprova, se carimba com as assinaturas e se distribui. Sem ele não há nada para assinar."
        />
      </div>
    );
  }

  return (
    <div className={cn('overflow-hidden rounded-xl border', T.linha, T.superficie)}>
      <LinhaFicheiro
        ficheiro={pdf}
        papel="pdf"
        aviso={Number(pdf.ronda) < Number(ronda || 1) ? `Este PDF vem da ${pdf.ronda}.ª volta: nesta volta não entrou ficheiro novo.` : null}
        accoes={
          <>
            {url && <Button asChild variant="outline" className="min-h-[2.75rem]"><a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" aria-hidden="true" />Abrir noutro separador</a></Button>}
            <BotaoDescarregar ficheiro={pdf} />
          </>
        }
      />
      <div className={cn('border-t', T.linha)}>
        {aCarregar ? (
          <div className="p-4"><Skeleton className="h-[60vh] w-full rounded-lg" /></div>
        ) : erro ? (
          <EstadoErro titulo="Não foi possível abrir o PDF" texto={erro} onTentar={() => setTentativa(n => n + 1)} />
        ) : url ? (
          <iframe src={`${url}#view=FitH`} title={`Pré-visualização de ${pdf.nome}`} className="h-[72vh] min-h-[22rem] w-full border-0 bg-white dark:bg-slate-950" />
        ) : null}
      </div>
    </div>
  );
}

// ── a linha do editável ─────────────────────────────────────────────────────
// Três estados, e só três: tenho direito e existe (nome, tamanho, descarga); tenho direito e não existe (mostra-se
// o motivo registado, se houver); não tenho direito (não se mostra nada — nem botão desactivado nem explicação).
function LinhaEditavel({ editavel, podeVer, aCarregar, fluxo, restrito }) {
  if (aCarregar) return <div className="p-4"><Skeleton className="h-10 w-2/3" /></div>;
  if (podeVer === false) return null;

  if (!editavel) {
    return (
      <div className="px-3 py-3 sm:px-4">
        <p className={cn('inline-flex items-center gap-2 text-sm font-medium', T.tintaMedia)}>
          <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />Sem ficheiro editável nesta revisão
        </p>
        <p className={cn('mt-1 max-w-prose text-sm', T.tintaFraca)}>
          {fluxo?.editavel_ausente && fluxo?.editavel_ausente_motivo
            ? <>Justificação registada por quem submeteu: «{fluxo.editavel_ausente_motivo}»</>
            : 'O editável é a semente da revisão seguinte. Se não existe, a razão fica registada no momento da submissão.'}
        </p>
      </div>
    );
  }

  return (
    <>
      <LinhaFicheiro
        ficheiro={editavel}
        papel="editavel"
        accoes={<BotaoDescarregar ficheiro={editavel} rotulo="Descarregar o editável" />}
      />
      <p className={cn('border-t px-3 py-2 text-sm sm:px-4', T.linha, T.tintaFraca)}>
        Acesso restrito e registado: cada abertura e cada descarga deste ficheiro fica no registo de acessos, com o seu nome.
        {Array.isArray(restrito) && restrito.length > 0 && ' Este documento tem o editável limitado a uma lista fechada de pessoas.'}
      </p>
    </>
  );
}

// ── o acto: um botão primário, «Devolver» ao lado, e cancelar separado ──────
function Acto({ fluxo, acto, actoDados, quem, quemACarregar, par, podeVerEditavel, naMinhaMao, ctx, gestor, eu, onMudou, onCancelado }) {
  const [cancelarAberto, setCancelarAberto] = useState(false);

  if (fluxo.estado === 'aprovado') {
    return (
      <Caixa tom="feito" titulo="Aprovado">
        <p>
          A revisão <strong>{rotuloRevisao(ctx.versao)}</strong> está aprovada e assinada. A <strong>entrada em vigor é um passo à parte</strong>:
          continua a depender da data agendada, em Gestão › Documentos.
        </p>
        {ctx.emenda && <p>A emenda nº {ctx.emenda.numero} ficou com «Aprovado por» preenchido e já pode seguir para a ANAC.</p>}
      </Caixa>
    );
  }
  if (fluxo.estado === 'cancelado') {
    return (
      <Caixa tom="info" titulo="Fluxo cancelado">
        <p>O percurso não seguiu. As assinaturas que foram dadas mantêm-se no registo: cancelar diz que o percurso parou, não que o acto não aconteceu.</p>
      </Caixa>
    );
  }

  const podeAssinar = quem?.pode && !!acto;
  const semPdf = !par.pdf;
  const temEditavel = !!par.editavel;

  return (
    <div className="space-y-3">
      {/* o elaborador prepara e submete no mesmo sítio */}
      {naMinhaMao && (
        <FormSubmissao
          fluxo={fluxo}
          par={par}
          podeVerEditavel={podeVerEditavel}
          onFeito={onMudou}
        />
      )}

      {quemACarregar ? (
        <p className={cn('inline-flex items-center gap-2 text-sm', T.tintaFraca)}><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />A confirmar o que lhe compete…</p>
      ) : podeAssinar ? (
        <>
          {semPdf ? (
            <Caixa tom="atencao" titulo="Falta o PDF desta revisão">
              <p>Assina-se o PDF. Carregue-o antes de assinar — a função de assinar recusa sem ele, e com razão: não haveria ficheiro a que a assinatura se prendesse.</p>
            </Caixa>
          ) : (
            <div className="flex flex-wrap items-start gap-2">
              <PainelAssinar
                fluxo={fluxo}
                acto={acto}
                actoDados={actoDados}
                quem={quem}
                pdf={par.pdf}
                temEditavel={temEditavel}
                podeVerEditavel={podeVerEditavel}
                onAssinado={onMudou}
                onRecarregar={onMudou}
              />
              {podeDevolver(fluxo, quem) && (
                <CaixaDevolucao
                  fluxo={fluxo}
                  destinos={destinosDevolucao(fluxo)}
                  onDevolvido={onMudou}
                  onRecarregar={onMudou}
                />
              )}
            </div>
          )}
          {quem?.em_substituicao_de && (
            <Caixa tom="info" titulo={`Vai assinar em substituição de ${quem.em_substituicao_de}`}>
              <p>A assinatura fica com a frase «em substituição de», e é essa frase que um inspector lê. A nomeação que lhe dá esta autoridade está registada, com a janela de datas e quem a fez.</p>
            </Caixa>
          )}
        </>
      ) : (
        <Caixa tom="info" titulo="Neste momento não há nada a assinar por você">
          <p>
            {quem?.motivo
              ? `${quem.motivo.charAt(0).toUpperCase()}${quem.motivo.slice(1)}.`
              : 'O documento está com outra pessoa. Vai receber um email quando chegar a sua vez.'}
          </p>
          {String(fluxo.elaborador_email || '').toLowerCase() === String(eu || '').toLowerCase() && fluxo.estado !== 'rascunho' && (
            <p>Quem elabora não revê nem aprova o mesmo documento: é a única separação de funções que a assinatura não consegue provar sozinha, por isso é regra na base de dados.</p>
          )}
        </Caixa>
      )}

      {/* cancelar vive em baixo, separado do resto: é destrutivo para o percurso */}
      {podeCancelar(fluxo, { email: eu, gestor }) && (
        <div className={cn('mt-4 border-t pt-4', T.linha)}>
          {cancelarAberto
            ? <FormCancelar fluxo={fluxo} onFeito={() => { setCancelarAberto(false); onCancelado?.(); }} onFechar={() => setCancelarAberto(false)} />
            : (
              <Button variant="ghost" className={cn('min-h-[2.75rem]', T.vermelho)} onClick={() => setCancelarAberto(true)}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />Cancelar este fluxo
              </Button>
            )}
        </div>
      )}
    </div>
  );
}

function FormCancelar({ fluxo, onFeito, onFechar }) {
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const curto = motivo.trim().length < MOTIVO_MINIMO;

  const submeter = async (e) => {
    e.preventDefault();
    if (curto) return;
    setOcupado(true); setErro('');
    try { await cancelarFluxo({ fluxoId: fluxo.id, motivo: motivo.trim() }); onFeito?.(); }
    catch (err) { setErro(err?.message || 'Não foi possível cancelar.'); }
    finally { setOcupado(false); }
  };

  return (
    <form onSubmit={submeter} className="space-y-2">
      <label htmlFor="fx-cancelar" className={cn('block text-sm font-medium', T.tintaMedia)}>
        Porque está a cancelar <span className={T.vermelho} aria-hidden="true">*</span>
      </label>
      <Textarea id="fx-cancelar" rows={3} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ex.: a revisão foi substituída por outra; este percurso já não se aplica." required />
      <p className={cn('max-w-prose text-sm', T.tintaFraca)}>
        As assinaturas já dadas <strong>mantêm-se</strong>. Cancelar diz que o percurso não seguiu, não que o acto não aconteceu.
      </p>
      {erro && <p role="alert" className={cn('flex items-start gap-1.5 text-sm', T.vermelho)}><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{erro}</p>}
      <div className="flex flex-wrap gap-2">
        <BotaoAccao type="submit" variant="destructive" icone={Trash2} ocupado={ocupado} disabled={curto || ocupado}>Cancelar o fluxo</BotaoAccao>
        <Button type="button" variant="outline" className="min-h-[2.75rem]" onClick={onFechar}>Voltar atrás</Button>
      </div>
    </form>
  );
}

// ── histórico e avisos ──────────────────────────────────────────────────────
const ACAO_LABEL = {
  aberto: 'Fluxo aberto',
  submetido: 'Submetido a revisão',
  revisto: 'Revisto',
  aprovado: 'Aprovado',
  devolvido: 'Devolvido',
  cancelado: 'Cancelado',
  aviso_enviado: 'Aviso enviado',
  carimbo_aplicado: 'Carimbo desenhado no PDF',
  nota: 'Nota',
};

function Historico({ passos, aCarregar }) {
  const linhas = passos || [];
  return (
    <section className={cn('overflow-hidden rounded-xl border', T.linha, T.superficie)} aria-label="Histórico do fluxo">
      <p className={cn('border-b px-3 py-2 text-sm font-semibold uppercase tracking-wider sm:px-4', T.linha, T.tintaMedia)}>Histórico</p>
      {aCarregar ? (
        <div className="space-y-2 p-4"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>
      ) : linhas.length === 0 ? (
        <EstadoVazio icone={Inbox} titulo="Sem passos registados" texto="Cada acontecimento do fluxo escreve aqui uma linha, que depois não se altera nem se apaga." className="py-8" />
      ) : (
        <ol className={cn('divide-y', T.divisoria)}>
          {linhas.map(p => (
            <li key={p.id} className="px-3 py-2.5 sm:px-4">
              <p className={cn('text-sm font-medium', T.tinta)}>
                {ACAO_LABEL[p.acao] || p.acao}
                {Number(p.ronda) > 1 && <span className={cn('ml-1.5 font-normal', T.tintaFraca)}>· {p.ronda}.ª volta</span>}
              </p>
              <p className={cn('text-sm', T.tintaFraca)}>
                {fmtDataHora(p.em)}{p.por_email ? ` · ${p.por_nome || p.por_email}` : ''}
              </p>
              {p.motivo && <p className={cn('mt-1 whitespace-pre-line text-sm', T.tintaMedia)}>«{p.motivo}»</p>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

// «Avisaram-no, e quando?» é uma pergunta de auditoria, e a resposta tem de estar à mão. «Enviado» significa
// aceite pelo relay — não significa entregue, e é por isso que a legenda o diz.
function Avisos({ avisos }) {
  const linhas = avisos || [];
  if (linhas.length === 0) return null;
  return (
    <section className={cn('overflow-hidden rounded-xl border', T.linha, T.superficie)} aria-label="Avisos enviados">
      <p className={cn('border-b px-3 py-2 text-sm font-semibold uppercase tracking-wider sm:px-4', T.linha, T.tintaMedia)}>Avisos enviados</p>
      <ul className={cn('divide-y', T.divisoria)}>
        {linhas.map(a => (
          <li key={a.id} className="px-3 py-2.5 sm:px-4">
            <p className={cn('text-sm', T.tinta)}>{a.tipo.replace('_', ' ')} → {a.para_email}</p>
            <p className={cn('text-sm', a.enviado ? T.tintaFraca : T.vermelho)}>
              {fmtDataHora(a.em)} · {a.enviado ? 'aceite pelo relay' : `não enviado${a.erro ? `: ${a.erro}` : ''}`}
              {a.anexou_pdf ? ' · com o PDF em anexo' : ''}
            </p>
          </li>
        ))}
      </ul>
      <p className={cn('border-t px-3 py-2 text-sm sm:px-4', T.linha, T.tintaFraca)}>
        «Aceite pelo relay» não quer dizer entregue na caixa de correio. Nenhum destes emails assina nada: o botão aterra aqui, e é aqui que se assina.
      </p>
    </section>
  );
}

function EsqueletoFluxo() {
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite">
      <p className="sr-only">A carregar o fluxo de aprovação…</p>
      <Skeleton className="h-6 w-32" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-[min(32rem,90%)]" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-6">
        <Skeleton className="h-[60vh] w-full rounded-xl" />
        <div className="mt-5 space-y-3 lg:mt-0">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

