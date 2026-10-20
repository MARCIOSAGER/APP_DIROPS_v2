// O percurso de um documento: quem assinou o quê, por que ordem, e se o registo ainda fecha.
//
// Esta página responde a uma pergunta que ninguém faz todos os dias e que, no dia em que a fizerem, tem de ter
// resposta imediata: **este documento foi aprovado por quem, quando, e com que significado?** É a página que se
// abre quando a ANAC pergunta, quando um auditor duvida, ou quando alguém desconfia de que o ficheiro mudou.
//
// Três leituras, pela ordem em que importam:
//
//   1. A CADEIA ESTÁ INTACTA? As assinaturas de um documento formam uma corrente: cada uma leva o resumo da
//      anterior. Se faltar uma, se tiver sido intercalada uma, ou se uma data tiver sido retroactivada, a
//      corrente parte — e parte num ponto identificável. É o único sinal desta página que merece destaque a
//      sério, e por isso é o primeiro.
//   2. QUEM ASSINOU, POR ORDEM. Acto, nome (e substituição, quando foi o suplente), papel, data e hora em hora
//      de Angola, significado do acto e código. Cada um com a sua verificação a pedido.
//   3. OS FICHEIROS DE CADA REVISÃO. O PDF que foi assinado, e o editável — este último **só a quem tem
//      direito**. Para os outros não aparece nada: nem botão desactivado, nem explicação.
//
// ONDE ENCAIXAR (não mexi na ficha do documento, como combinado): o contrato prevê isto como separador
// «Assinaturas» em `/documentos/documento/:id`, ao lado de Versões e Confirmações. Até lá funciona como página
// própria em `/documentos/documento/:id/assinaturas`; o corpo está em `<PercursoDocumento documentoId=… />`,
// que se pode pôr tal e qual dentro de um `<TabsContent value="assinaturas">` em `pages/PortalDocumento.jsx`.
import React, { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, ArrowRight, FileText, Inbox, Lock, RefreshCw, Stamp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { fmtDataHora } from '@/lib/safeDate';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { PORTAL_BASE, ehGestorDocs } from '@/lib/portalDocumentos';
import { T, MONO, EstadoVazio, EstadoErro, TituloSeccao } from './PortalLayout';
import { enderecoFluxo, textoParado } from './apiFluxo';
import { useVersoesDocumento } from './hooks';
import {
  useAssinaturasDocumento, useCadeiaAssinaturas, useFluxosDocumento, useFicheirosFluxo,
  usePodeVerEditavel, useAcessosEditavel, useRecarregarFluxo, rotuloRevisao,
} from './hooksFluxo';
import { BotaoDescarregar, Caixa, LinhaFicheiro, SeloFluxo } from './components/fluxo/comum';
import SeloAssinatura, { horaAngola } from './components/fluxo/SeloAssinatura';

export default function PortalFluxoDocumento() {
  const { id } = useParams();
  const docQ = useQuery({
    queryKey: ['gd', 'fluxo', 'percurso-doc', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('documento')
        .select('id,numero,titulo,estado,versao_atual,aeroporto_id,editavel_restrito_a').eq('id', id).maybeSingle();
      if (error) throw error;
      return data || null;
    },
  });
  const doc = docQ.data || null;

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" className="-ml-2 min-h-[2.75rem]">
        <Link to={`${PORTAL_BASE}/documento/${id}`}><ArrowLeft className="h-4 w-4" aria-hidden="true" />Ficha do documento</Link>
      </Button>

      <header>
        {docQ.isLoading ? (
          <div className="space-y-2"><Skeleton className="h-4 w-40" /><Skeleton className="h-8 w-[min(32rem,90%)]" /></div>
        ) : (
          <>
            {doc?.numero && <p style={MONO} className={cn('font-semibold', T.tinta)}>{doc.numero}</p>}
            <h1 className={cn('mt-1 text-xl font-bold tracking-tight sm:text-2xl', T.tinta)}>
              {doc?.titulo || 'Documento'}
            </h1>
            <p className={cn('mt-1 max-w-prose text-sm', T.tintaFraca)}>
              Percurso das assinaturas: quem praticou cada acto, quando, com que significado, e se o registo continua a fechar.
            </p>
          </>
        )}
      </header>

      {docQ.isError ? (
        <EstadoErro titulo="Não foi possível carregar o documento" texto={docQ.error?.message} onTentar={() => docQ.refetch?.()} />
      ) : (
        <PercursoDocumento documentoId={id} documento={doc} />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// O CORPO — pensado para poder viver dentro de um separador da ficha do documento
// ════════════════════════════════════════════════════════════════════════════

export function PercursoDocumento({ documentoId, documento }) {
  const { user } = useAuth();
  const gestor = ehGestorDocs(user);
  const recarregar = useRecarregarFluxo();

  const assinaturasQ = useAssinaturasDocumento(documentoId);
  const cadeiaQ = useCadeiaAssinaturas(documentoId);
  const fluxosQ = useFluxosDocumento(documentoId);
  const ficheirosQ = useFicheirosFluxo({ documentoId });
  const editavelQ = usePodeVerEditavel(documentoId);
  const acessosQ = useAcessosEditavel(documentoId);
  const versoesQ = useVersoesDocumento(documentoId);

  // Rótulo de cada revisão. `documento_ficheiro` guarda o `versao_id` mas não o rótulo, e mostrar o identificador
  // cru não diz nada a ninguém: «Revisão 7» responde à pergunta, «Revisão a3f4-…» não.
  const rotuloDaRevisao = useMemo(() => {
    const m = new Map();
    for (const v of (versoesQ.data || [])) m.set(v.id, rotuloRevisao(v));
    return m;
  }, [versoesQ.data]);

  const assinaturas = assinaturasQ.data || [];
  const porRevisao = useMemo(() => {
    const m = new Map();
    for (const f of (ficheirosQ.data || [])) {
      if (!m.has(f.versao_id)) m.set(f.versao_id, []);
      m.get(f.versao_id).push(f);
    }
    return m;
  }, [ficheirosQ.data]);

  return (
    <div className="space-y-6">
      {/* ── 1. a cadeia ───────────────────────────────────────────────────── */}
      <SinalDaCadeia resumo={cadeiaQ.resumo} aCarregar={cadeiaQ.isLoading} erro={cadeiaQ.error} onTentar={() => cadeiaQ.refetch?.()} />

      {/* ── 2. as assinaturas, por ordem ─────────────────────────────────── */}
      <section aria-label="Assinaturas">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <TituloSeccao contagem={assinaturas.length || undefined}>Assinaturas</TituloSeccao>
          <Button variant="ghost" className="min-h-[2.75rem]" onClick={recarregar}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />Recarregar
          </Button>
        </div>
        <div className={cn('overflow-hidden rounded-xl border', T.linha, T.superficie)}>
          {assinaturasQ.isLoading ? (
            <div className="space-y-3 p-4"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>
          ) : assinaturasQ.isError ? (
            <EstadoErro titulo="Não foi possível carregar as assinaturas" texto={assinaturasQ.error?.message} onTentar={() => assinaturasQ.refetch?.()} />
          ) : assinaturas.length === 0 ? (
            <EstadoVazio
              icone={Stamp}
              titulo="Este documento ainda não tem assinaturas"
              texto="As assinaturas aparecem aqui à medida que o documento passa pelo elaborador, pelo revisor e pelo director. Confirmações de leitura são outra coisa e vivem na ficha do documento: provam que alguém recebeu, não que alguém aprovou."
            />
          ) : (
            <ul className={cn('divide-y', T.divisoria)}>
              {assinaturas.map((a, i) => (
                <SeloAssinatura key={a.assinatura_id} assinatura={a} elo={cadeiaQ.porId.get(a.assinatura_id)} ordem={i + 1} />
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ── 3. os fluxos ─────────────────────────────────────────────────── */}
      <section aria-label="Fluxos de aprovação">
        <TituloSeccao contagem={(fluxosQ.data || []).length || undefined}>Fluxos de aprovação</TituloSeccao>
        <div className={cn('overflow-hidden rounded-xl border', T.linha, T.superficie)}>
          {fluxosQ.isLoading ? (
            <div className="space-y-2 p-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
          ) : (fluxosQ.data || []).length === 0 ? (
            <EstadoVazio
              icone={Inbox}
              titulo="Este documento nunca passou por um fluxo de aprovação"
              texto="Pode ser um documento antigo, carregado antes de o fluxo existir. Isso não o invalida: só quer dizer que a aprovação não está provada por assinatura neste sistema."
            />
          ) : (
            <ul className={cn('divide-y', T.divisoria)}>
              {(fluxosQ.data || []).map(f => (
                <li key={f.id}>
                  <Link to={enderecoFluxo(f.id)} className={cn('flex min-h-[3.5rem] items-start gap-3 px-3 py-3 sm:px-4', T.realce, T.focoDentro)}>
                    <Stamp className={cn('mt-0.5 h-5 w-5 shrink-0', T.tintaFraca)} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <SeloFluxo estado={f.estado} />
                        <span className={cn('text-sm', T.tintaFraca)}>
                          aberto por {f.elaborador_email} · {fmtDataHora(f.created_date)}
                          {Number(f.ronda) > 1 ? ` · ${f.ronda} voltas` : ''}
                        </span>
                      </span>
                      <span className={cn('mt-1 block text-sm', T.tintaFraca)}>
                        revisor {f.revisor_email || '—'} · director {f.director_email || '—'}
                        {f.aprovado_em ? ` · aprovado ${horaAngola(f.aprovado_em)}` : ''}
                        {['aguarda_revisao', 'aguarda_aprovacao', 'devolvido'].includes(f.estado) ? ` · parado ${textoParado({ desde: f.updated_date })}` : ''}
                      </span>
                      {f.estado === 'devolvido' && f.devolvido_para && (
                        <span className={cn('mt-0.5 block text-sm', T.vermelho)}>devolvido ao {f.devolvido_para}</span>
                      )}
                    </span>
                    <ArrowRight className={cn('mt-1 h-5 w-5 shrink-0', T.tintaFraca)} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ── 4. os ficheiros de cada revisão ──────────────────────────────── */}
      <section aria-label="Ficheiros das revisões">
        <TituloSeccao>Ficheiros das revisões</TituloSeccao>
        <div className={cn('overflow-hidden rounded-xl border', T.linha, T.superficie)}>
          {ficheirosQ.isLoading ? (
            <div className="space-y-2 p-4"><Skeleton className="h-12 w-full" /></div>
          ) : porRevisao.size === 0 ? (
            <EstadoVazio
              icone={FileText}
              titulo="Sem ficheiros de fluxo neste documento"
              texto="Os pares PDF + editável aparecem aqui a partir do primeiro fluxo de aprovação. O ficheiro corrente do documento continua na ficha."
            />
          ) : (
            <ul className={cn('divide-y', T.divisoria)}>
              {[...porRevisao.entries()].map(([versaoId, lista]) => (
                <li key={versaoId}>
                  <RevisaoFicheiros lista={lista} rotulo={rotuloDaRevisao.get(versaoId)} podeVerEditavel={editavelQ.data} />
                </li>
              ))}
            </ul>
          )}
        </div>
        {editavelQ.data === true && Array.isArray(documento?.editavel_restrito_a) && documento.editavel_restrito_a.length > 0 && (
          <p className={cn('mt-2 max-w-prose text-sm', T.tintaFraca)}>
            O editável deste documento está limitado a uma lista fechada de endereços ({documento.editavel_restrito_a.length}). A lista só aperta a regra padrão; nunca a alarga.
          </p>
        )}
      </section>

      {/* ── 5. quem mexeu no editável (gestão) ───────────────────────────── */}
      {gestor && (acessosQ.data || []).length > 0 && (
        <section aria-label="Acessos ao ficheiro editável">
          <TituloSeccao contagem={acessosQ.data.length}>Acessos ao editável</TituloSeccao>
          <div className={cn('overflow-hidden rounded-xl border', T.linha, T.superficie)}>
            <ul className={cn('divide-y', T.divisoria)}>
              {acessosQ.data.map(a => (
                <li key={a.id} className="px-3 py-2.5 sm:px-4">
                  <p className={cn('text-sm font-medium', a.acao === 'recusado' ? T.vermelho : T.tinta)}>
                    {a.acao === 'recusado' ? 'Recusado' : a.acao === 'abriu' ? 'Abriu' : 'Descarregou'} · {a.nome || a.email}
                  </p>
                  <p className={cn('text-sm', T.tintaFraca)}>
                    {fmtDataHora(a.em)}{a.endereco_ip ? ` · ${a.endereco_ip}` : ''}{a.motivo ? ` · ${a.motivo}` : ''}
                  </p>
                </li>
              ))}
            </ul>
            <p className={cn('border-t px-3 py-2 text-sm sm:px-4', T.linha, T.tintaFraca)}>
              Inclui as recusas, que são o sinal que interessa. O editável é o ficheiro que permite alterar o conteúdo: é o mais sensível dos dois.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}

// ── o sinal da cadeia ───────────────────────────────────────────────────────
// Um só aviso de largura total, e é este: ou a corrente fecha, ou diz-se exactamente onde parte. Não se mistura
// com o resto da página nem se repete mais abaixo — se tudo avisa, nada avisa.
function SinalDaCadeia({ resumo, aCarregar, erro, onTentar }) {
  if (aCarregar) return <Skeleton className="h-20 w-full rounded-xl" />;
  if (erro) {
    return (
      <Caixa tom="atencao" titulo="Não foi possível verificar a cadeia de assinaturas" accoes={onTentar ? <Button variant="outline" className="min-h-[2.75rem]" onClick={onTentar}><RefreshCw className="h-4 w-4" aria-hidden="true" />Tentar de novo</Button> : null}>
        <p>{erro.message || 'A verificação não respondeu. Isto não quer dizer que haja problema no registo — quer dizer que ainda não sabemos.'}</p>
      </Caixa>
    );
  }
  if (!resumo || resumo.total === 0) return null;

  if (resumo.intacta && resumo.trocados.length === 0) {
    return (
      <Caixa tom="feito" titulo="A cadeia de assinaturas está intacta">
        <p>
          {resumo.total === 1 ? 'Uma assinatura, verificada:' : `${resumo.total} assinaturas, verificadas:`} cada elo corresponde ao anterior e o ficheiro
          assinado continua a ser o que está guardado. Nenhuma foi apagada, reordenada ou intercalada.
        </p>
      </Caixa>
    );
  }

  return (
    <Caixa tom="perigo" titulo={resumo.intacta ? 'Um ficheiro assinado foi substituído' : 'A cadeia de assinaturas não fecha'}>
      {!resumo.intacta && (
        <p>
          A corrente parte {resumo.primeiraQuebra ? <>na assinatura nº <strong>{resumo.primeiraQuebra.ordem}</strong> (código <span style={MONO}>{resumo.primeiraQuebra.codigo}</span>)</> : 'em pelo menos um ponto'}.
          Isto quer dizer que falta uma assinatura, que foi intercalada uma, ou que um registo foi alterado à mão —
          e é assim que se detecta uma data retroactivada.
        </p>
      )}
      {resumo.trocados.length > 0 && (
        <p>
          {resumo.trocados.length === 1 ? 'Uma assinatura aponta' : `${resumo.trocados.length} assinaturas apontam`} para um ficheiro cuja impressão digital já não
          corresponde. Trate essas cópias como não verificadas.
        </p>
      )}
      <p>
        Avise a gestão do portal antes de distribuir ou de assinar mais nada neste documento. Uma correcção legítima faz-se por revisão nova —
        substituir o ficheiro de uma revisão assinada é precisamente o que o sistema recusa.
      </p>
    </Caixa>
  );
}

// ── os ficheiros de uma revisão ─────────────────────────────────────────────
function RevisaoFicheiros({ lista, rotulo, podeVerEditavel }) {
  const pdfs = lista.filter(f => f.papel === 'pdf');
  const editaveis = lista.filter(f => f.papel === 'editavel');
  const total = pdfs.length + editaveis.length;
  const cabecalho = `Revisão ${rotulo || '—'} · ${total} ${total === 1 ? 'ficheiro' : 'ficheiros'}`;

  return (
    <div>
      <p className={cn('px-3 pt-3 text-sm font-semibold uppercase tracking-wider sm:px-4', T.tintaMedia)}>{cabecalho}</p>
      {pdfs.map(f => (
        <LinhaFicheiro
          key={f.id}
          ficheiro={f}
          papel="pdf"
          accoes={<BotaoDescarregar ficheiro={f} />}
        />
      ))}
      {podeVerEditavel !== false && editaveis.map(f => (
        <LinhaFicheiro
          key={f.id}
          ficheiro={f}
          papel="editavel"
          accoes={<BotaoDescarregar ficheiro={f} rotulo="Descarregar o editável" />}
        />
      ))}
      {podeVerEditavel !== false && editaveis.length === 0 && (
        <p className={cn('flex items-center gap-2 px-3 pb-3 text-sm sm:px-4', T.tintaFraca)}>
          <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />Esta revisão não tem ficheiro editável.
        </p>
      )}
    </div>
  );
}

