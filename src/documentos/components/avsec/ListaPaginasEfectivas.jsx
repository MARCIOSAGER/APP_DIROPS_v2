// Lista de Páginas Efectivas de um documento (migração 158).
//
// A lei, textualmente — Instrutivo 32.039.001.A (Despacho n.º 4442/25), secção XIII, alínea k): o programa deve
// «Ter no início do volume, uma "Lista de Páginas Efectivas" para actualização, cancelamento ou inserção de
// páginas, com as respectivas revisões e datas de efectivação». E a secção XIV, n.º 2, alínea g), fecha o ciclo:
// ao receber uma revisão aprovada, o responsável insere ou cancela as páginas afectadas e faz «as respectivas
// anotações na "Lista de Páginas Efectivas" … de todos os volumes distribuídos aos usuários credenciados».
//
// Três coisas governam o desenho deste ecrã:
//
//   1. UMA EDIÇÃO POR REVISÃO, E SÓ UMA EM VIGOR. A lista da revisão 02 não se edita para virar a 03: cria-se a
//      03 a partir da 02 («Partir desta revisão»), mexe-se nas páginas que mudaram, e emite-se. A anterior passa
//      a substituída no mesmo instante — é o servidor que o garante, com um índice único.
//   2. A COMPARAÇÃO É O PRODUTO. Quem tem um volume na mão não quer a lista inteira: quer saber que folhas tira e
//      que folhas põe. Por isso a comparação entre duas edições tem separador próprio e sai em PDF só com o que
//      muda — uma folha de trabalho com 200 linhas «nada» faz com que ninguém leia as sete que importam.
//   3. COLAR, NÃO ESCREVER. A LPE de um volume vem de um Word ou de uma folha de cálculo. Escrever 200 linhas no
//      navegador não é trabalho de pessoas: há um campo para colar, que lê página/revisão/data separadas por
//      tabulações, ponto e vírgula ou vírgulas, e mostra o que entendeu ANTES de gravar.
import React, { useCallback, useMemo, useState } from 'react';
import {
  Check, ClipboardPaste, Copy, Download, FileDown, FileText, Loader2, Pencil, Plus,
  Printer, Stamp, Trash2, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import Select from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import { fmtData } from '@/lib/safeDate';
import { T, MONO, Ref, EstadoVazio, EstadoErro, EsqueletoLinhas, TituloSeccao } from '../../PortalLayout';
import {
  useEdicoesLep, usePaginasLep, useComparacaoLep, useRecarregarAvsec,
  ROTULO_ACCAO_PAGINA, ROTULO_DIFERENCA, ROTULO_ESTADO_LEP,
} from '../../hooksAvsec';
import {
  criarEdicaoLep, clonarEdicaoLep, emitirEdicaoLep, guardarPaginaLep, apagarPaginaLep,
  acrescentarPaginasLep, lerPaginasColadas,
} from '../../apiAvsec';
import { Campo, Lei, Selo, TOM_ACCAO_PAGINA, TOM_LEP, TD, TH, THEAD } from './pecas';
import {
  pdfListaPaginasEfectivas, pdfComparacaoLep, descarregarCsv,
  COLUNAS_LEP, celulasLep, COLUNAS_COMPARACAO, celulasComparacao,
} from './pdfAvsec';

const ACCOES = [
  { value: 'original', label: 'Original — veio nesta revisão' },
  { value: 'inserida', label: 'Inserida — entra agora no volume' },
  { value: 'actualizada', label: 'Actualizada — substitui a folha anterior' },
  { value: 'cancelada', label: 'Cancelada — sai do volume' },
];
const TOM_DIFERENCA = { igual: 'neutro', substituida: 'aviso', acrescentada: 'frio', retirada: 'mau', cancelada: 'mau' };
const hojeIso = () => new Date().toISOString().slice(0, 10);

const PAGINA_VAZIA = { pagina: '', revisao: '', efectiva_em: hojeIso(), accao: 'original', volume: '', capitulo: '', titulo: '', nota: '', ordem: 0 };

export default function ListaPaginasEfectivas({ documento, regime, podeEditar }) {
  const documentoId = documento?.documento_id || documento?.id || null;
  const { user } = useAuth();
  const { toast } = useToast();
  const recarregar = useRecarregarAvsec();

  const edicoesQ = useEdicoesLep(documentoId);
  const edicoes = useMemo(() => (Array.isArray(edicoesQ.data) ? edicoesQ.data : []), [edicoesQ.data]);
  const emVigor = useMemo(() => edicoes.find(e => e.estado === 'emitida') || null, [edicoes]);

  // A edição escolhida arranca na que está em vigor — é a resposta certa em nove de cada dez visitas.
  const [escolhidaId, setEscolhidaId] = useState(null);
  const escolhida = useMemo(
    () => edicoes.find(e => e.id === escolhidaId) || emVigor || edicoes[0] || null,
    [edicoes, escolhidaId, emVigor],
  );
  const paginasQ = usePaginasLep(escolhida?.id);
  const paginas = useMemo(() => (Array.isArray(paginasQ.data) ? paginasQ.data : []), [paginasQ.data]);

  // comparação
  const [compararCom, setCompararCom] = useState(null);
  const comparacaoQ = useComparacaoLep(compararCom, escolhida?.id);
  const comparacao = useMemo(() => (Array.isArray(comparacaoQ.data) ? comparacaoQ.data : []), [comparacaoQ.data]);
  const edicaoAnterior = useMemo(() => edicoes.find(e => e.id === compararCom) || null, [edicoes, compararCom]);

  const [dialogo, setDialogo] = useState(null);   // 'nova' | 'clonar' | 'colar' | { pagina }
  const [ocupado, setOcupado] = useState(false);

  const falhar = useCallback((e) => toast({ variant: 'destructive', title: 'Não foi possível', description: e?.message || 'Erro desconhecido.' }), [toast]);
  const feito = useCallback((titulo, description) => { toast({ title: titulo, description }); recarregar(); }, [toast, recarregar]);

  const emitir = useCallback(async () => {
    if (!escolhida) return;
    setOcupado(true);
    try {
      await emitirEdicaoLep(escolhida.id);
      feito('Lista emitida', `A revisão ${escolhida.revisao} passou a ser a Lista de Páginas Efectivas em vigor. A anterior ficou marcada como substituída.`);
    } catch (e) { falhar(e); } finally { setOcupado(false); }
  }, [escolhida, feito, falhar]);

  const apagarPagina = useCallback(async (p) => {
    setOcupado(true);
    try { await apagarPaginaLep(p.id); feito('Página retirada da lista'); }
    catch (e) { falhar(e); } finally { setOcupado(false); }
  }, [feito, falhar]);

  const geradoPor = user?.full_name || user?.email || '';
  const exportarPdf = useCallback(async () => {
    try { await pdfListaPaginasEfectivas({ documento, edicao: escolhida, paginas, regime, geradoPor }); }
    catch (e) { falhar(e); }
  }, [documento, escolhida, paginas, regime, geradoPor, falhar]);
  const exportarComparacaoPdf = useCallback(async () => {
    try { await pdfComparacaoLep({ documento, edicaoA: edicaoAnterior, edicaoB: escolhida, linhas: comparacao, geradoPor }); }
    catch (e) { falhar(e); }
  }, [documento, edicaoAnterior, escolhida, comparacao, geradoPor, falhar]);

  if (!documentoId) {
    return <EstadoVazio icone={FileText} titulo="Escolha um documento" texto="A Lista de Páginas Efectivas pertence a um volume. Escolha o documento à esquerda para ver a sua lista." />;
  }
  if (edicoesQ.isError) return <EstadoErro onTentar={() => edicoesQ.refetch()} />;
  if (edicoesQ.isLoading) return <EsqueletoLinhas linhas={5} />;

  const contagem = {
    efectivas: paginas.filter(p => p.accao !== 'cancelada').length,
    canceladas: paginas.filter(p => p.accao === 'cancelada').length,
  };
  const mudam = comparacao.filter(l => l.diferenca !== 'igual');

  return (
    <div className="space-y-5">
      <Lei fonte="Instrutivo 32.039.001.A (Despacho n.º 4442/25), secção XIII, alínea k)">
        O programa deve «ter no início do volume, uma <em>Lista de Páginas Efectivas</em> para actualização,
        cancelamento ou inserção de páginas, com as respectivas revisões e datas de efectivação».
      </Lei>

      {/* ── edições ─────────────────────────────────────────────────────── */}
      <section>
        <TituloSeccao contagem={edicoes.length}>Edições da lista</TituloSeccao>
        {!edicoes.length ? (
          <div className={cn('rounded-xl border', T.linha, T.superficie)}>
            <EstadoVazio
              icone={FileText}
              titulo="Este volume ainda não tem Lista de Páginas Efectivas"
              texto="Sem ela, um detentor não tem como provar que a cópia que tem na mão está completa. Crie a primeira edição e cole-lhe as páginas do volume."
            >
              {podeEditar && <Button className="h-11" onClick={() => setDialogo('nova')}><Plus className="h-4 w-4" aria-hidden="true" />Criar a primeira lista</Button>}
            </EstadoVazio>
          </div>
        ) : (
          <ul className={cn('divide-y overflow-hidden rounded-xl border', T.divisoria, T.linha, T.superficie)}>
            {edicoes.map(e => {
              const activa = e.id === escolhida?.id;
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => setEscolhidaId(e.id)}
                    aria-current={activa ? 'true' : undefined}
                    className={cn('flex w-full min-h-[3rem] flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-left sm:px-4',
                      activa ? 'bg-teal-50 dark:bg-teal-950/40' : T.realce, T.focoDentro)}
                  >
                    <Ref className={cn('font-semibold', T.tinta)}>Rev. {e.revisao}</Ref>
                    <Selo tom={TOM_LEP[e.estado] || 'neutro'}>{ROTULO_ESTADO_LEP[e.estado] || e.estado}</Selo>
                    <span className={cn('text-sm', T.tintaFraca)}>Emitida em {fmtData(e.emitida_em)}</span>
                    {e.volume && <span className={cn('text-sm', T.tintaFraca)}>Volume {e.volume}</span>}
                    {e.nota && <span className={cn('w-full text-xs', T.tintaFraca)}>{e.nota}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {podeEditar && !!edicoes.length && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" className="h-11" onClick={() => setDialogo('nova')}>
              <Plus className="h-4 w-4" aria-hidden="true" />Nova edição vazia
            </Button>
            <Button variant="outline" className="h-11" disabled={!escolhida} onClick={() => setDialogo('clonar')}>
              <Copy className="h-4 w-4" aria-hidden="true" />Partir desta revisão
            </Button>
          </div>
        )}
      </section>

      {/* ── páginas da edição escolhida ─────────────────────────────────── */}
      {escolhida && (
        <section>
          <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
            <TituloSeccao contagem={paginas.length} className="mb-0">
              Páginas da revisão {escolhida.revisao}
            </TituloSeccao>
            <div className="flex flex-wrap gap-2">
              {podeEditar && escolhida.estado !== 'substituida' && (
                <>
                  <Button variant="outline" className="h-10" onClick={() => setDialogo('colar')}>
                    <ClipboardPaste className="h-4 w-4" aria-hidden="true" />Colar páginas
                  </Button>
                  <Button variant="outline" className="h-10" onClick={() => setDialogo({ pagina: { ...PAGINA_VAZIA, revisao: escolhida.revisao, ordem: paginas.length + 1 } })}>
                    <Plus className="h-4 w-4" aria-hidden="true" />Página
                  </Button>
                </>
              )}
              {podeEditar && escolhida.estado === 'rascunho' && (
                <Button className="h-10" disabled={ocupado || !paginas.length} onClick={emitir}>
                  {ocupado ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Stamp className="h-4 w-4" aria-hidden="true" />}
                  Emitir esta lista
                </Button>
              )}
              <Button variant="outline" className="h-10" disabled={!paginas.length} onClick={exportarPdf}>
                <Printer className="h-4 w-4" aria-hidden="true" />PDF
              </Button>
              <Button variant="outline" className="h-10" disabled={!paginas.length}
                onClick={() => descarregarCsv(`LPE_${documento?.numero || 'documento'}_rev_${escolhida.revisao}`, COLUNAS_LEP, paginas.map(celulasLep))}>
                <Download className="h-4 w-4" aria-hidden="true" />CSV
              </Button>
            </div>
          </div>

          <p className={cn('mb-2 text-sm', T.tintaFraca)}>
            {contagem.efectivas} página{contagem.efectivas === 1 ? '' : 's'} efectiva{contagem.efectivas === 1 ? '' : 's'}
            {contagem.canceladas > 0 && ` · ${contagem.canceladas} cancelada${contagem.canceladas === 1 ? '' : 's'}, que o detentor tem de retirar do volume`}
          </p>

          <div className={cn('overflow-x-auto rounded-xl border', T.linha, T.superficie)}>
            {paginasQ.isLoading ? <EsqueletoLinhas linhas={6} /> : !paginas.length ? (
              <EstadoVazio
                icone={FileText}
                titulo="Esta edição ainda não tem páginas"
                texto="Cole a lista do volume, ou acrescente uma página de cada vez. Sem páginas, a lista não pode ser emitida."
              />
            ) : (
              <table className="w-full min-w-[46rem] border-collapse">
                <caption className="sr-only">Páginas efectivas da revisão {escolhida.revisao}</caption>
                <thead className={THEAD}>
                  <tr>
                    <th scope="col" className={TH}>Página</th>
                    <th scope="col" className={TH}>Capítulo</th>
                    <th scope="col" className={TH}>Revisão</th>
                    <th scope="col" className={TH}>Data de efectivação</th>
                    <th scope="col" className={TH}>Situação</th>
                    {podeEditar && <th scope="col" className={cn(TH, 'text-right')}>Acções</th>}
                  </tr>
                </thead>
                <tbody className={cn('divide-y', T.divisoria)}>
                  {paginas.map(p => (
                    <tr key={p.id} className={cn(T.realce, p.accao === 'cancelada' && 'opacity-70')}>
                      <td className={TD}><Ref className={cn('font-medium', T.tinta)}>{p.pagina}</Ref>{p.volume && <span className={cn('ml-2 text-xs', T.tintaFraca)}>vol. {p.volume}</span>}</td>
                      <td className={cn(TD, T.tintaMedia)}>{p.capitulo || p.titulo || '—'}</td>
                      <td className={TD}><span style={MONO} className="text-sm">{p.revisao}</span></td>
                      <td className={cn(TD, T.tintaMedia)}>{fmtData(p.efectiva_em)}</td>
                      <td className={TD}><Selo tom={TOM_ACCAO_PAGINA[p.accao] || 'neutro'}>{ROTULO_ACCAO_PAGINA[p.accao] || p.accao}</Selo></td>
                      {podeEditar && (
                        <td className={cn(TD, 'text-right whitespace-nowrap')}>
                          <Button variant="ghost" size="sm" className="h-9" onClick={() => setDialogo({ pagina: p })}>
                            <Pencil className="h-4 w-4" aria-hidden="true" /><span className="sr-only">Alterar a página {p.pagina}</span>
                          </Button>
                          {escolhida.estado === 'rascunho' && (
                            <Button variant="ghost" size="sm" className={cn('h-9', T.vermelho)} disabled={ocupado} onClick={() => apagarPagina(p)}>
                              <Trash2 className="h-4 w-4" aria-hidden="true" /><span className="sr-only">Apagar a página {p.pagina}</span>
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      )}

      {/* ── comparação entre revisões ───────────────────────────────────── */}
      {edicoes.length > 1 && escolhida && (
        <section>
          <TituloSeccao>O que muda entre revisões</TituloSeccao>
          <div className={cn('space-y-3 rounded-xl border p-3 sm:p-4', T.linha, T.superficie)}>
            <p className={cn('max-w-prose text-sm', T.tintaFraca)}>
              Compare a revisão {escolhida.revisao} com a que o detentor tem na mão. O resultado é a folha de
              trabalho de quem actualiza a cópia: que folhas tirar, que folhas inserir, que folhas substituir.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <Campo id="lep-comparar" etiqueta="Revisão que o detentor tem" className="min-w-[16rem] flex-1">
                <Select
                  value={compararCom || ''}
                  onValueChange={setCompararCom}
                  placeholder="Escolha a revisão anterior"
                  options={edicoes.filter(e => e.id !== escolhida.id).map(e => ({
                    value: e.id, label: `Rev. ${e.revisao} · ${fmtData(e.emitida_em)}`,
                  }))}
                />
              </Campo>
              {!!mudam.length && (
                <Button variant="outline" className="h-11" onClick={exportarComparacaoPdf}>
                  <FileDown className="h-4 w-4" aria-hidden="true" />PDF só com o que muda
                </Button>
              )}
            </div>

            {comparacaoQ.isLoading && <EsqueletoLinhas linhas={4} />}
            {!!compararCom && !comparacaoQ.isLoading && (
              mudam.length === 0 ? (
                <p className={cn('flex items-center gap-2 text-sm', T.verde)}>
                  <Check className="h-4 w-4" aria-hidden="true" />
                  As duas revisões têm exactamente as mesmas páginas. Não há nada a substituir.
                </p>
              ) : (
                <>
                  <p className={cn('text-sm', T.tintaMedia)}>
                    {mudam.length} página{mudam.length === 1 ? '' : 's'} a mexer, de {comparacao.length}.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[42rem] border-collapse">
                      <caption className="sr-only">Diferenças entre a revisão {edicaoAnterior?.revisao} e a revisão {escolhida.revisao}</caption>
                      <thead className={THEAD}>
                        <tr>
                          <th scope="col" className={TH}>Página</th>
                          <th scope="col" className={TH}>Rev. {edicaoAnterior?.revisao}</th>
                          <th scope="col" className={TH}>Rev. {escolhida.revisao}</th>
                          <th scope="col" className={TH}>O que fazer</th>
                        </tr>
                      </thead>
                      <tbody className={cn('divide-y', T.divisoria)}>
                        {mudam.map(l => (
                          <tr key={l.pagina} className={T.realce}>
                            <td className={TD}><Ref className={cn('font-medium', T.tinta)}>{l.pagina}</Ref></td>
                            <td className={cn(TD, T.tintaFraca)}>{l.revisao_a ? `${l.revisao_a} · ${fmtData(l.efectiva_a)}` : '—'}</td>
                            <td className={cn(TD, T.tintaMedia)}>{l.revisao_b ? `${l.revisao_b} · ${fmtData(l.efectiva_b)}` : '—'}</td>
                            <td className={TD}><Selo tom={TOM_DIFERENCA[l.diferenca] || 'neutro'}>{ROTULO_DIFERENCA[l.diferenca] || l.diferenca}</Selo></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Button variant="ghost" size="sm" className="h-9"
                    onClick={() => descarregarCsv(`LPE_alteracoes_${documento?.numero || 'documento'}`, COLUNAS_COMPARACAO, mudam.map(celulasComparacao))}>
                    <Download className="h-4 w-4" aria-hidden="true" />CSV das alterações
                  </Button>
                </>
              )
            )}
          </div>
        </section>
      )}

      {dialogo === 'nova' && (
        <DialogoEdicao documentoId={documentoId} regime={regime} onFechar={() => setDialogo(null)}
          onGuardado={(id) => { setEscolhidaId(id); setDialogo(null); feito('Edição criada', 'Acrescente-lhe as páginas e emita-a quando estiver completa.'); }} />
      )}
      {dialogo === 'clonar' && escolhida && (
        <DialogoClonar origem={escolhida} onFechar={() => setDialogo(null)}
          onGuardado={(id) => { setEscolhidaId(id); setDialogo(null); feito('Revisão criada', `Partiu da revisão ${escolhida.revisao}. Mexa nas páginas que mudaram e emita.`); }} />
      )}
      {dialogo === 'colar' && escolhida && (
        <DialogoColar edicao={escolhida} jaTem={paginas.length} onFechar={() => setDialogo(null)}
          onGuardado={(n) => { setDialogo(null); feito('Páginas acrescentadas', `${n} página${n === 1 ? '' : 's'} na lista.`); }} />
      )}
      {dialogo?.pagina && escolhida && (
        <DialogoPagina edicao={escolhida} pagina={dialogo.pagina} onFechar={() => setDialogo(null)}
          onGuardado={() => { setDialogo(null); feito('Página guardada'); }} />
      )}
    </div>
  );
}

// ── criar uma edição ────────────────────────────────────────────────────────
function DialogoEdicao({ documentoId, regime, onFechar, onGuardado }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [f, setF] = useState({ revisao: '', volume: regime?.volume || '', emitida_em: hojeIso(), nota: '' });
  const [ocupado, setOcupado] = useState(false);
  const gravar = async () => {
    setOcupado(true);
    try {
      const r = await criarEdicaoLep({ documentoId, ...f }, user);
      onGuardado(r?.id);
    } catch (e) { toast({ variant: 'destructive', title: 'Não foi possível criar a lista', description: e.message }); }
    finally { setOcupado(false); }
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova Lista de Páginas Efectivas</DialogTitle>
          <DialogDescription>
            Uma edição por revisão do volume. Nasce em rascunho: só passa a valer quando for emitida.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Campo id="lep-rev" etiqueta="Revisão do volume" obrigatorio ajuda="Como está escrito na capa: «00», «01», «Rev. 02».">
            <Input value={f.revisao} onChange={(e) => setF({ ...f, revisao: e.target.value })} className="h-11" />
          </Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="lep-vol" etiqueta="Volume" ajuda="Quando o programa tem mais do que um volume.">
              <Input value={f.volume} onChange={(e) => setF({ ...f, volume: e.target.value })} className="h-11" />
            </Campo>
            <Campo id="lep-data" etiqueta="Emitida em" obrigatorio>
              <Input type="date" value={f.emitida_em} onChange={(e) => setF({ ...f, emitida_em: e.target.value })} className="h-11" />
            </Campo>
          </div>
          <Campo id="lep-nota" etiqueta="Nota">
            <Textarea rows={2} value={f.nota} onChange={(e) => setF({ ...f, nota: e.target.value })} />
          </Campo>
        </div>
        <DialogFooter>
          <Button variant="outline" className="h-11" onClick={onFechar}>Cancelar</Button>
          <Button className="h-11" disabled={ocupado || !f.revisao.trim()} onClick={gravar}>
            {ocupado && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── partir da revisão anterior ──────────────────────────────────────────────
function DialogoClonar({ origem, onFechar, onGuardado }) {
  const { toast } = useToast();
  const [f, setF] = useState({ revisao: '', emitida_em: hojeIso() });
  const [ocupado, setOcupado] = useState(false);
  const gravar = async () => {
    setOcupado(true);
    try { onGuardado(await clonarEdicaoLep(origem.id, f)); }
    catch (e) { toast({ variant: 'destructive', title: 'Não foi possível criar a revisão', description: e.message }); }
    finally { setOcupado(false); }
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Partir da revisão {origem.revisao}</DialogTitle>
          <DialogDescription>
            As páginas da revisão {origem.revisao} passam para a nova lista, excepto as canceladas — essas já
            saíram do volume. Depois mexa só nas que mudaram.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Campo id="clone-rev" etiqueta="Revisão nova" obrigatorio>
            <Input value={f.revisao} onChange={(e) => setF({ ...f, revisao: e.target.value })} className="h-11" />
          </Campo>
          <Campo id="clone-data" etiqueta="Emitida em" obrigatorio>
            <Input type="date" value={f.emitida_em} onChange={(e) => setF({ ...f, emitida_em: e.target.value })} className="h-11" />
          </Campo>
        </div>
        <DialogFooter>
          <Button variant="outline" className="h-11" onClick={onFechar}>Cancelar</Button>
          <Button className="h-11" disabled={ocupado || !f.revisao.trim()} onClick={gravar}>
            {ocupado && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}Criar a partir desta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── colar a lista de um ficheiro ────────────────────────────────────────────
// Mostra o que entendeu antes de gravar. As linhas sem data ficam marcadas — a alínea k) manda registar a data de
// efectivação, e uma lista com datas inventadas é pior do que uma lista com buracos visíveis.
function DialogoColar({ edicao, jaTem, onFechar, onGuardado }) {
  const { toast } = useToast();
  const [bruto, setBruto] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const lidas = useMemo(
    () => lerPaginasColadas(bruto, { revisaoPadrao: edicao.revisao, dataPadrao: edicao.emitida_em }),
    [bruto, edicao.revisao, edicao.emitida_em],
  );
  const comAviso = lidas.filter(l => l.aviso).length;
  const gravar = async () => {
    setOcupado(true);
    try {
      const n = await acrescentarPaginasLep(edicao.id, lidas.map((l, i) => ({ ...l, ordem: jaTem + i + 1 })));
      onGuardado(n);
    } catch (e) { toast({ variant: 'destructive', title: 'Não foi possível acrescentar', description: e.message }); }
    finally { setOcupado(false); }
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Colar as páginas do volume</DialogTitle>
          <DialogDescription>
            Uma página por linha: página, revisão e data, separadas por tabulação, ponto e vírgula ou vírgula.
            O que vier a mais é lido como título do capítulo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Campo id="colar-bruto" etiqueta="Páginas" ajuda={`Exemplo: 3-4	01	14/03/2026	Controlo de acessos. Sem revisão, usa-se «${edicao.revisao}»; sem data, ${fmtData(edicao.emitida_em)}.`}>
            <Textarea rows={8} value={bruto} onChange={(e) => setBruto(e.target.value)} style={MONO} />
          </Campo>
          {!!lidas.length && (
            <div className={cn('max-h-64 overflow-auto rounded-lg border', T.linha)}>
              <table className="w-full border-collapse">
                <caption className="sr-only">Pré-visualização das páginas lidas</caption>
                <thead className={THEAD}>
                  <tr>
                    <th scope="col" className={TH}>Página</th>
                    <th scope="col" className={TH}>Revisão</th>
                    <th scope="col" className={TH}>Data</th>
                    <th scope="col" className={TH}>Capítulo</th>
                  </tr>
                </thead>
                <tbody className={cn('divide-y', T.divisoria)}>
                  {lidas.map((l, i) => (
                    <tr key={`${l.pagina}-${i}`}>
                      <td className={TD}><Ref>{l.pagina}</Ref></td>
                      <td className={TD}><span style={MONO} className="text-sm">{l.revisao}</span></td>
                      <td className={cn(TD, l.aviso && T.ambar)}>{l.efectiva_em ? fmtData(l.efectiva_em) : 'sem data'}</td>
                      <td className={cn(TD, T.tintaFraca)}>{l.titulo || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!!comAviso && (
            <p className={cn('text-sm', T.ambar)}>
              {comAviso} linha{comAviso === 1 ? '' : 's'} sem data reconhecida: fica{comAviso === 1 ? '' : 'm'} com a data de emissão da
              lista ({fmtData(edicao.emitida_em)}). Corrija depois as que não forem essa.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" className="h-11" onClick={onFechar}>Cancelar</Button>
          <Button className="h-11" disabled={ocupado || !lidas.length} onClick={gravar}>
            {ocupado && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Acrescentar {lidas.length} página{lidas.length === 1 ? '' : 's'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── uma página ──────────────────────────────────────────────────────────────
function DialogoPagina({ edicao, pagina, onFechar, onGuardado }) {
  const { toast } = useToast();
  const [f, setF] = useState({ ...PAGINA_VAZIA, ...pagina });
  const [ocupado, setOcupado] = useState(false);
  const gravar = async () => {
    setOcupado(true);
    try { await guardarPaginaLep(f, { lepId: edicao.id }); onGuardado(); }
    catch (e) { toast({ variant: 'destructive', title: 'Não foi possível guardar', description: e.message }); }
    finally { setOcupado(false); }
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{pagina.id ? `Página ${pagina.pagina}` : 'Nova página'}</DialogTitle>
          <DialogDescription>Revisão da página e data de efectivação são o que a alínea k) manda registar.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="pag-num" etiqueta="Página" obrigatorio ajuda="Como está escrita no volume: «3-4», «A-1».">
              <Input value={f.pagina} onChange={(e) => setF({ ...f, pagina: e.target.value })} className="h-11" style={MONO} />
            </Campo>
            <Campo id="pag-ordem" etiqueta="Ordem" ajuda="Para a lista sair pela ordem do volume.">
              <Input type="number" value={f.ordem ?? 0} onChange={(e) => setF({ ...f, ordem: e.target.value })} className="h-11" />
            </Campo>
          </div>
          <Campo id="pag-cap" etiqueta="Capítulo ou título">
            <Input value={f.capitulo || ''} onChange={(e) => setF({ ...f, capitulo: e.target.value })} className="h-11" />
          </Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="pag-rev" etiqueta="Revisão da página" obrigatorio ajuda="Pode ser anterior à do volume: uma página que não mudou mantém a sua.">
              <Input value={f.revisao} onChange={(e) => setF({ ...f, revisao: e.target.value })} className="h-11" style={MONO} />
            </Campo>
            <Campo id="pag-data" etiqueta="Data de efectivação" obrigatorio>
              <Input type="date" value={String(f.efectiva_em || '').slice(0, 10)} onChange={(e) => setF({ ...f, efectiva_em: e.target.value })} className="h-11" />
            </Campo>
          </div>
          <Campo id="pag-accao" etiqueta="Situação" ajuda="«Cancelada» é a palavra da lei para a página que sai do volume — fica na lista, marcada, para o detentor saber que tem de a retirar.">
            <Select value={f.accao} onValueChange={(v) => setF({ ...f, accao: v })} options={ACCOES} searchable={false} />
          </Campo>
          <Campo id="pag-nota" etiqueta="Nota">
            <Input value={f.nota || ''} onChange={(e) => setF({ ...f, nota: e.target.value })} className="h-11" />
          </Campo>
        </div>
        <DialogFooter>
          <Button variant="outline" className="h-11" onClick={onFechar}><X className="h-4 w-4" aria-hidden="true" />Cancelar</Button>
          <Button className="h-11" disabled={ocupado} onClick={gravar}>
            {ocupado && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
