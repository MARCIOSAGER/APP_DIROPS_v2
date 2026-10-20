// Conferência semestral das cópias controladas (migração 158).
//
// A lei, textualmente — Instrutivo 32.039.001.A (Despacho n.º 4442/25), secção XIV, n.º 2, alínea i): o
// responsável pela guarda e controlo do programa deve «Estabelecer semestralmente conferência e actualização de
// páginas com base na "Lista de Páginas Efectivas", a fim de garantir que nenhuma página dos programas seja
// retirada, inserida, modificada ou tenham alguma alteração manuscrita».
//
// O que isso obriga, e que este ecrã serve:
//   • um CICLO por semestre, com período fechado — «semestralmente» sem datas não se audita: o inspector pergunta
//     pelo primeiro semestre de 2026 e tem de haver exactamente um ciclo com esse nome;
//   • uma linha por CÓPIA CONTROLADA, conferida contra a Lista de Páginas Efectivas em vigor;
//   • QUATRO achados nomeados, cada um com a sua caixa — e não uma nota de texto livre, que perderia a conta;
//   • o que ficou POR CONFERIR no fim do prazo, visível. Um ciclo que fechasse escondendo os pendentes seria pior
//     do que não haver ciclo: dava aparência de conformidade.
//
// Duas decisões de desenho que vale a pena justificar:
//   1. CONFIRMAR ≠ CONFERIR. São dois actos, de duas pessoas: o detentor declara que tem a cópia e que ela
//      confere; o responsável pela guarda confere página a página. A lei só obriga ao segundo — o primeiro é
//      nosso, porque é a única forma de conferir uma cópia que está noutro aeroporto. Ficam separados no ecrã,
//      com nomes diferentes, para ninguém confundir uma declaração com uma verificação.
//   2. UM ACHADO SEM PÁGINAS É RECUSADO. É o servidor que o recusa, não o formulário: «havia páginas
//      modificadas» sem dizer quais não corrige nada, e a alínea g) manda anotar as páginas afectadas na Lista
//      de Páginas Efectivas.
import React, { useCallback, useMemo, useState } from 'react';
import {
  AlertTriangle, CalendarClock, Check, CheckCircle2, ClipboardCheck, Download, Loader2, Lock,
  Printer, RefreshCw, ShieldAlert, UserCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import Select from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import { fmtData, fmtDataHora } from '@/lib/safeDate';
import { T, MONO, Ref, EstadoVazio, EstadoErro, EsqueletoLinhas, TituloSeccao } from '../../PortalLayout';
import {
  useCiclosConferencia, useItensConferencia, useCopiasControladas, useRegistoConferencias, useRecarregarAvsec,
  ROTULO_ESTADO_CICLO, ROTULO_ESTADO_ITEM, ROTULO_ACTO, nomeSemestre, semestreDe, achadosDe,
} from '../../hooksAvsec';
import {
  abrirCicloConferencia, fecharCicloConferencia, registarConferencia, confirmarConferencia, ACHADOS_LEI,
} from '../../apiAvsec';
import { Campo, Conta, Lei, Selo, TOM_CICLO, TOM_ITEM, TD, TH, THEAD } from './pecas';
import { pdfFolhaConferencia, descarregarCsv, COLUNAS_REGISTO, celulasRegisto } from './pdfAvsec';

const ANO = new Date().getFullYear();
const ANOS = [ANO + 1, ANO, ANO - 1, ANO - 2].map(a => ({ value: String(a), label: String(a) }));
const SEMESTRES = [{ value: '1', label: '1.º semestre (Janeiro a Junho)' }, { value: '2', label: '2.º semestre (Julho a Dezembro)' }];

export default function CiclosConferencia({ documento, regime, podeGerir, meuEmail }) {
  const documentoId = documento?.documento_id || documento?.id || null;
  const { user } = useAuth();
  const { toast } = useToast();
  const recarregar = useRecarregarAvsec();

  const ciclosQ = useCiclosConferencia({ documentoId });
  const ciclos = useMemo(() => (Array.isArray(ciclosQ.data) ? ciclosQ.data : []), [ciclosQ.data]);
  const [escolhidoId, setEscolhidoId] = useState(null);
  const ciclo = useMemo(() => ciclos.find(z => z.ciclo_id === escolhidoId) || ciclos[0] || null, [ciclos, escolhidoId]);

  const itensQ = useItensConferencia(ciclo?.ciclo_id);
  const itens = useMemo(() => (Array.isArray(itensQ.data) ? itensQ.data : []), [itensQ.data]);
  const copiasQ = useCopiasControladas({ documentoId });
  const copias = useMemo(() => (Array.isArray(copiasQ.data) ? copiasQ.data : []), [copiasQ.data]);
  const porCopia = useMemo(() => new Map(copias.map(c => [c.id, c])), [copias]);

  const registoQ = useRegistoConferencias({ documentoId, limite: 400 });
  const registo = useMemo(() => (Array.isArray(registoQ.data) ? registoQ.data : []), [registoQ.data]);

  const [dialogo, setDialogo] = useState(null);   // 'abrir' | 'fechar' | { conferir: item } | { confirmar: item }
  const [ocupado, setOcupado] = useState(false);
  const [filtro, setFiltro] = useState('todos');  // 'todos' | 'pendente' | 'achados'

  const falhar = useCallback((e) => toast({ variant: 'destructive', title: 'Não foi possível', description: e?.message || 'Erro desconhecido.' }), [toast]);
  const feito = useCallback((titulo, description) => { toast({ title: titulo, description }); recarregar(); }, [toast, recarregar]);

  const geradoPor = user?.full_name || user?.email || '';
  const imprimirFolha = useCallback(async () => {
    try { await pdfFolhaConferencia({ documento, ciclo, itens, copias, regime, geradoPor }); }
    catch (e) { falhar(e); }
  }, [documento, ciclo, itens, copias, regime, geradoPor, falhar]);

  if (!documentoId) {
    return <EstadoVazio icone={ClipboardCheck} titulo="Escolha um documento" texto="A conferência semestral é das cópias de um volume. Escolha o documento à esquerda." />;
  }
  if (ciclosQ.isError) return <EstadoErro onTentar={() => ciclosQ.refetch()} />;
  if (ciclosQ.isLoading) return <EsqueletoLinhas linhas={5} />;

  const visiveis = itens.filter(i => {
    if (filtro === 'pendente') return i.estado === 'pendente';
    if (filtro === 'achados') return i.estado === 'conferida' && !i.conforme;
    return true;
  });
  const copiasActivas = copias.filter(c => c.estado === 'activa').length;

  return (
    <div className="space-y-5">
      <Lei fonte="Instrutivo 32.039.001.A (Despacho n.º 4442/25), secção XIV, n.º 2, alínea i)">
        O responsável pela guarda e controlo deve «estabelecer <strong>semestralmente</strong> conferência e
        actualização de páginas com base na <em>Lista de Páginas Efectivas</em>, a fim de garantir que nenhuma
        página dos programas seja retirada, inserida, modificada ou tenham alguma alteração manuscrita».
      </Lei>

      {!ciclo?.revisao && !!ciclos.length && (
        <p className={cn('flex items-start gap-2 rounded-lg border px-3 py-2 text-sm', T.linha, T.ambar)}>
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Este ciclo não tem Lista de Páginas Efectivas de referência. A conferência faz-se «com base na Lista de
          Páginas Efectivas»: emita-a no separador da LPE antes de conferir, ou o que se registar aqui não tem
          contra o que ser comparado.
        </p>
      )}

      {/* ── ciclos ──────────────────────────────────────────────────────── */}
      <section>
        <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
          <TituloSeccao contagem={ciclos.length} className="mb-0">Ciclos de conferência</TituloSeccao>
          {podeGerir && (
            <Button variant="outline" className="h-10" onClick={() => setDialogo('abrir')}>
              <CalendarClock className="h-4 w-4" aria-hidden="true" />Abrir um semestre
            </Button>
          )}
        </div>
        {!ciclos.length ? (
          <div className={cn('rounded-xl border', T.linha, T.superficie)}>
            <EstadoVazio
              icone={CalendarClock}
              titulo="Ainda não há conferências registadas"
              texto={copiasActivas
                ? `Há ${copiasActivas} cópia${copiasActivas === 1 ? '' : 's'} em poder de detentores. Abra o semestre para as conferir — é o que a alínea i) obriga a fazer duas vezes por ano.`
                : 'Não há cópias controladas registadas para este documento. Registe-as primeiro: a conferência é das cópias que estão na mão das pessoas.'}
            >
              {podeGerir && !!copiasActivas && (
                <Button className="h-11" onClick={() => setDialogo('abrir')}>
                  <CalendarClock className="h-4 w-4" aria-hidden="true" />Abrir o semestre actual
                </Button>
              )}
            </EstadoVazio>
          </div>
        ) : (
          <ul className={cn('divide-y overflow-hidden rounded-xl border', T.divisoria, T.linha, T.superficie)}>
            {ciclos.map(z => {
              const activo = z.ciclo_id === ciclo?.ciclo_id;
              const falta = Number(z.pendentes) || 0;
              const achados = (Number(z.conferidas) || 0) - (Number(z.conformes) || 0);
              return (
                <li key={z.ciclo_id}>
                  <button
                    type="button"
                    onClick={() => setEscolhidoId(z.ciclo_id)}
                    aria-current={activo ? 'true' : undefined}
                    className={cn('flex w-full min-h-[3rem] flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-left sm:px-4',
                      activo ? 'bg-teal-50 dark:bg-teal-950/40' : T.realce, T.focoDentro)}
                  >
                    <span className={cn('font-medium', T.tinta)}>{nomeSemestre(z.ano, z.semestre)}</span>
                    <Selo tom={TOM_CICLO[z.estado] || 'neutro'}>{ROTULO_ESTADO_CICLO[z.estado] || z.estado}</Selo>
                    {z.revisao && <span className={cn('text-sm', T.tintaFraca)}>contra a rev. {z.revisao}</span>}
                    <span className={cn('text-sm', T.tintaFraca)}>{z.copias} cópia{z.copias === 1 ? '' : 's'}</span>
                    {falta > 0 && <Selo tom={z.prazo_ultrapassado ? 'mau' : 'aviso'}>{falta} por conferir</Selo>}
                    {achados > 0 && <Selo tom="mau">{achados} com achados</Selo>}
                    {z.estado === 'aberto' && z.prazo && (
                      <span className={cn('text-sm', z.prazo_ultrapassado ? T.vermelho : T.tintaFraca)}>
                        {z.prazo_ultrapassado ? `Prazo ultrapassado em ${fmtData(z.prazo)}` : `Prazo: ${fmtData(z.prazo)}`}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── o ciclo escolhido ───────────────────────────────────────────── */}
      {ciclo && (
        <section>
          <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
            <TituloSeccao className="mb-0">{nomeSemestre(ciclo.ano, ciclo.semestre)}</TituloSeccao>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="h-10" disabled={!itens.length} onClick={imprimirFolha}>
                <Printer className="h-4 w-4" aria-hidden="true" />Folha de conferência
              </Button>
              {podeGerir && ciclo.estado === 'aberto' && (
                <>
                  <Button variant="outline" className="h-10" disabled={ocupado}
                    onClick={async () => {
                      setOcupado(true);
                      try {
                        await abrirCicloConferencia({ documentoId, ano: ciclo.ano, semestre: ciclo.semestre });
                        feito('Ciclo actualizado', 'As cópias entregues depois da abertura entraram no ciclo.');
                      } catch (e) { falhar(e); } finally { setOcupado(false); }
                    }}>
                    {ocupado ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
                    Trazer cópias novas
                  </Button>
                  <Button className="h-10" onClick={() => setDialogo('fechar')}>
                    <Lock className="h-4 w-4" aria-hidden="true" />Fechar o ciclo
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Conta valor={ciclo.copias} label="cópias no ciclo" onClick={() => setFiltro('todos')} activo={filtro === 'todos'} />
            <Conta valor={ciclo.pendentes} label="por conferir" tom={Number(ciclo.pendentes) > 0 ? (ciclo.prazo_ultrapassado ? 'mau' : 'aviso') : 'neutro'}
              onClick={() => setFiltro('pendente')} activo={filtro === 'pendente'} />
            <Conta valor={(Number(ciclo.conferidas) || 0) - (Number(ciclo.conformes) || 0)} label="com achados" tom={(Number(ciclo.conferidas) || 0) > (Number(ciclo.conformes) || 0) ? 'mau' : 'neutro'}
              onClick={() => setFiltro('achados')} activo={filtro === 'achados'} />
            <Conta valor={ciclo.confirmadas_detentor} label="confirmadas pelo detentor" />
          </div>

          {ciclo.estado === 'fechado' && Number(ciclo.nao_conferidas) > 0 && (
            <p className={cn('mb-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm', T.linha, T.vermelho)}>
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {ciclo.nao_conferidas} cópia{Number(ciclo.nao_conferidas) === 1 ? '' : 's'} ficou{Number(ciclo.nao_conferidas) === 1 ? '' : 'ram'} por
              conferir quando o ciclo fechou. Fica registado como está — é o que uma auditoria vem ver.
            </p>
          )}

          <div className={cn('overflow-x-auto rounded-xl border', T.linha, T.superficie)}>
            {itensQ.isLoading ? <EsqueletoLinhas linhas={5} /> : !visiveis.length ? (
              <EstadoVazio icone={Check} titulo="Nada a mostrar aqui"
                texto={filtro === 'todos' ? 'Este ciclo não tem cópias. Use «Trazer cópias novas» se já registou cópias depois de o abrir.' : 'Nenhuma cópia corresponde a este filtro.'} />
            ) : (
              <table className="w-full min-w-[50rem] border-collapse">
                <caption className="sr-only">Cópias a conferir no {nomeSemestre(ciclo.ano, ciclo.semestre)}</caption>
                <thead className={THEAD}>
                  <tr>
                    <th scope="col" className={TH}>Cópia</th>
                    <th scope="col" className={TH}>Detentor</th>
                    <th scope="col" className={TH}>Revisão na posse</th>
                    <th scope="col" className={TH}>Confirmação do detentor</th>
                    <th scope="col" className={TH}>Conferência</th>
                    <th scope="col" className={cn(TH, 'text-right')}>Acções</th>
                  </tr>
                </thead>
                <tbody className={cn('divide-y', T.divisoria)}>
                  {visiveis.map(i => {
                    const c = porCopia.get(i.copia_id) || {};
                    const achados = achadosDe(i);
                    const sou = String(c.detentor_email || '').toLowerCase() === String(meuEmail || '').toLowerCase();
                    const desactualizada = ciclo.revisao && c.revisao && c.revisao !== ciclo.revisao;
                    return (
                      <tr key={i.id} className={T.realce}>
                        <td className={TD}>
                          <Ref className={cn('font-semibold', T.tinta)}>nº {c.numero ?? '—'}</Ref>
                          {c.local_guarda && <span className={cn('block text-xs', T.tintaFraca)}>{c.local_guarda}</span>}
                        </td>
                        <td className={TD}>
                          <span className={cn('block', T.tinta)}>{c.detentor_nome || c.detentor_email || '—'}</span>
                          <span className={cn('block text-xs', T.tintaFraca)}>{c.detentor_cargo || c.detentor_email}</span>
                        </td>
                        <td className={TD}>
                          <span style={MONO} className="text-sm">{c.revisao || '—'}</span>
                          {desactualizada && <Selo tom="aviso" className="ml-2">Desactualizada</Selo>}
                        </td>
                        <td className={TD}>
                          {i.detentor_confirmado_em ? (
                            <span className={cn('flex items-center gap-1.5 text-sm', T.verde)}>
                              <UserCheck className="h-4 w-4" aria-hidden="true" />{fmtData(i.detentor_confirmado_em)}
                            </span>
                          ) : <span className={cn('text-sm', T.tintaFraca)}>Por confirmar</span>}
                        </td>
                        <td className={TD}>
                          <Selo tom={TOM_ITEM[i.estado] || 'neutro'}>{ROTULO_ESTADO_ITEM[i.estado] || i.estado}</Selo>
                          {i.estado === 'conferida' && (
                            achados.length
                              ? <span className={cn('mt-1 block text-xs', T.vermelho)}>{achados.join(' · ')}{i.paginas_afectadas ? ` — páginas ${i.paginas_afectadas}` : ''}</span>
                              : <span className={cn('mt-1 block text-xs', T.verde)}>Conforme</span>
                          )}
                          {i.conferida_em && <span className={cn('mt-0.5 block text-xs', T.tintaFraca)}>{fmtDataHora(i.conferida_em)} · {i.conferida_por}</span>}
                        </td>
                        <td className={cn(TD, 'text-right whitespace-nowrap')}>
                          {ciclo.estado === 'aberto' && sou && !i.detentor_confirmado_em && (
                            <Button variant="outline" size="sm" className="h-9" onClick={() => setDialogo({ confirmar: i, copia: c })}>
                              <UserCheck className="h-4 w-4" aria-hidden="true" />Confirmar
                            </Button>
                          )}
                          {ciclo.estado === 'aberto' && podeGerir && (
                            <Button variant={i.estado === 'pendente' ? 'default' : 'ghost'} size="sm" className="ml-2 h-9"
                              onClick={() => setDialogo({ conferir: i, copia: c })}>
                              <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                              {i.estado === 'pendente' ? 'Conferir' : 'Rever'}
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>
      )}

      {/* ── registo inviolável ──────────────────────────────────────────── */}
      <section>
        <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
          <TituloSeccao contagem={registo.length} className="mb-0">Registo das conferências</TituloSeccao>
          <Button variant="outline" className="h-10" disabled={!registo.length}
            onClick={() => descarregarCsv(`Registo_conferencias_${documento?.numero || 'documento'}`, COLUNAS_REGISTO,
              registo.map(r => celulasRegisto(r, { rotuloActo: (a) => ROTULO_ACTO[a] || a })))}>
            <Download className="h-4 w-4" aria-hidden="true" />CSV
          </Button>
        </div>
        <p className={cn('mb-2 flex items-start gap-2 max-w-prose text-sm', T.tintaFraca)}>
          <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Este registo é gravado pelo servidor e não pode ser alterado nem apagado por ninguém a partir do portal.
          É ele, e não as colunas acima, que responde a «quem conferiu, quando, e o que encontrou».
        </p>
        <div className={cn('max-h-96 overflow-auto rounded-xl border', T.linha, T.superficie)}>
          {registoQ.isLoading ? <EsqueletoLinhas linhas={4} /> : !registo.length ? (
            <EstadoVazio icone={Lock} titulo="Ainda não há registo" texto="Assim que abrir um ciclo e conferir uma cópia, cada passo deixa aqui uma linha." />
          ) : (
            <ul className={cn('divide-y', T.divisoria)}>
              {registo.map(r => (
                <li key={r.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2 sm:px-4">
                  <span style={MONO} className={cn('text-xs', T.tintaFraca)}>{fmtDataHora(r.em)}</span>
                  <span className={cn('text-sm font-medium', T.tinta)}>{ROTULO_ACTO[r.acto] || r.acto}</span>
                  {r.por_email && <span className={cn('text-sm', T.tintaFraca)}>{r.por_email}</span>}
                  {!!(r.achados || []).length && <Selo tom="mau">{r.achados.join(', ')}</Selo>}
                  {r.paginas_afectadas && <span className={cn('text-sm', T.tintaMedia)}>páginas {r.paginas_afectadas}</span>}
                  {r.nota && <span className={cn('w-full text-xs', T.tintaFraca)}>{r.nota}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {dialogo === 'abrir' && (
        <DialogoAbrir documentoId={documentoId} onFechar={() => setDialogo(null)}
          onAberto={(id) => { setEscolhidoId(id); setDialogo(null); feito('Ciclo aberto', 'As cópias em poder de detentores entraram no ciclo, por conferir.'); }} />
      )}
      {dialogo === 'fechar' && ciclo && (
        <DialogoFechar ciclo={ciclo} onFechar={() => setDialogo(null)}
          onFechado={(r) => { setDialogo(null); feito('Ciclo fechado', `${r.conferidas} conferida${r.conferidas === 1 ? '' : 's'}, ${r.naoConferidas} por conferir no fim do prazo.`); }} />
      )}
      {dialogo?.conferir && (
        <DialogoConferir item={dialogo.conferir} copia={dialogo.copia} ciclo={ciclo} onFechar={() => setDialogo(null)}
          onRegistado={() => { setDialogo(null); feito('Conferência registada'); }} />
      )}
      {dialogo?.confirmar && (
        <DialogoConfirmar item={dialogo.confirmar} copia={dialogo.copia} ciclo={ciclo} onFechar={() => setDialogo(null)}
          onConfirmado={() => { setDialogo(null); feito('Cópia confirmada', 'Fica registado que declarou ter a cópia e que ela confere com a lista.'); }} />
      )}
    </div>
  );
}

// ── abrir um semestre ──────────────────────────────────────────────────────
function DialogoAbrir({ documentoId, onFechar, onAberto }) {
  const { toast } = useToast();
  const [f, setF] = useState({ ano: String(ANO), semestre: String(semestreDe()), prazo: '' });
  const [ocupado, setOcupado] = useState(false);
  const abrir = async () => {
    setOcupado(true);
    try { onAberto(await abrirCicloConferencia({ documentoId, ...f })); }
    catch (e) { toast({ variant: 'destructive', title: 'Não foi possível abrir o ciclo', description: e.message }); }
    finally { setOcupado(false); }
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Abrir um semestre de conferência</DialogTitle>
          <DialogDescription>
            Entram as cópias que estão em poder de detentores, conferidas contra a Lista de Páginas Efectivas em
            vigor. Abrir duas vezes o mesmo semestre não duplica nada — apanha as cópias entregues entretanto.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo id="conf-ano" etiqueta="Ano" obrigatorio>
            <Select value={f.ano} onValueChange={(v) => setF({ ...f, ano: v })} options={ANOS} searchable={false} />
          </Campo>
          <Campo id="conf-sem" etiqueta="Semestre" obrigatorio>
            <Select value={f.semestre} onValueChange={(v) => setF({ ...f, semestre: v })} options={SEMESTRES} searchable={false} />
          </Campo>
          <Campo id="conf-prazo" etiqueta="Prazo" className="sm:col-span-2"
            ajuda="A lei não fixa prazo para concluir a conferência, só que ela se estabelece semestralmente. Em branco, fica o último dia do semestre.">
            <Input type="date" value={f.prazo} onChange={(e) => setF({ ...f, prazo: e.target.value })} className="h-11" />
          </Campo>
        </div>
        <DialogFooter>
          <Button variant="outline" className="h-11" onClick={onFechar}>Cancelar</Button>
          <Button className="h-11" disabled={ocupado} onClick={abrir}>
            {ocupado && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}Abrir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── fechar o ciclo ─────────────────────────────────────────────────────────
function DialogoFechar({ ciclo, onFechar, onFechado }) {
  const { toast } = useToast();
  const [nota, setNota] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const falta = Number(ciclo.pendentes) || 0;
  const fechar = async () => {
    setOcupado(true);
    try { onFechado(await fecharCicloConferencia(ciclo.ciclo_id, nota)); }
    catch (e) { toast({ variant: 'destructive', title: 'Não foi possível fechar', description: e.message }); }
    finally { setOcupado(false); }
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Fechar o {nomeSemestre(ciclo.ano, ciclo.semestre)}</DialogTitle>
          <DialogDescription>
            {falta > 0
              ? `${falta} cópia${falta === 1 ? '' : 's'} está${falta === 1 ? '' : 'ão'} por conferir. Ao fechar, fica${falta === 1 ? '' : 'm'} registada${falta === 1 ? '' : 's'} como «não conferida» — o que não foi feito fica tão visível como o que foi.`
              : 'Todas as cópias deste ciclo foram conferidas.'}
          </DialogDescription>
        </DialogHeader>
        <Campo id="fechar-nota" etiqueta="Nota de fecho" ajuda="Porque é que ficaram cópias por conferir, se ficaram. Entra no registo inviolável.">
          <Textarea rows={3} value={nota} onChange={(e) => setNota(e.target.value)} />
        </Campo>
        <DialogFooter>
          <Button variant="outline" className="h-11" onClick={onFechar}>Cancelar</Button>
          <Button className="h-11" disabled={ocupado} onClick={fechar}>
            {ocupado && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            <Lock className="h-4 w-4" aria-hidden="true" />Fechar o ciclo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── conferir uma cópia ─────────────────────────────────────────────────────
// As quatro caixas são as quatro coisas que a alínea i) manda garantir, com o texto da lei ao lado de cada uma.
// A quinta («cópia não localizada») é nossa, e está marcada como tal: é o achado que a lei não nomeia e é o pior.
function DialogoConferir({ item, copia, ciclo, onFechar, onRegistado }) {
  const { toast } = useToast();
  const [achados, setAchados] = useState({
    achado_retirada: !!item.achado_retirada,
    achado_insercao: !!item.achado_insercao,
    achado_modificacao: !!item.achado_modificacao,
    achado_manuscrita: !!item.achado_manuscrita,
    achado_nao_localizada: !!item.achado_nao_localizada,
  });
  const [paginas, setPaginas] = useState(item.paginas_afectadas || '');
  const [accao, setAccao] = useState(item.accao_corretiva || '');
  const [nota, setNota] = useState(item.nota || '');
  const [ocupado, setOcupado] = useState(false);

  const algum = Object.values(achados).some(Boolean);
  const precisaPaginas = algum && !achados.achado_nao_localizada;
  const podeGravar = !ocupado && (!precisaPaginas || paginas.trim().length > 0);

  const gravar = async () => {
    setOcupado(true);
    try { await registarConferencia(item.id, { achados, paginas, accao, nota }); onRegistado(); }
    catch (e) { toast({ variant: 'destructive', title: 'Não foi possível registar', description: e.message }); }
    finally { setOcupado(false); }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Conferir a cópia nº {copia?.numero ?? '—'}</DialogTitle>
          <DialogDescription>
            {[copia?.detentor_nome, copia?.local_guarda].filter(Boolean).join(' · ')}
            {ciclo?.revisao ? ` — contra a revisão ${ciclo.revisao} da Lista de Páginas Efectivas.` : ' — sem Lista de Páginas Efectivas de referência.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <fieldset className="space-y-2">
            <legend className={cn('text-sm font-medium', T.tintaMedia)}>O que encontrou</legend>
            <p className={cn('text-xs', T.tintaFraca)}>Não marque nada se a cópia está conforme.</p>
            {ACHADOS_LEI.map(a => (
              <label key={a.chave} htmlFor={a.chave} className={cn('flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2', T.linha, T.realce)}>
                <Checkbox
                  id={a.chave}
                  checked={!!achados[a.chave]}
                  onCheckedChange={(v) => setAchados({ ...achados, [a.chave]: !!v })}
                  className="mt-1 h-5 w-5"
                />
                <span className="min-w-0">
                  <span className={cn('block text-sm font-medium', T.tinta)}>{a.label}</span>
                  <span className={cn('block text-xs', T.tintaFraca)}>{a.lei}</span>
                </span>
              </label>
            ))}
          </fieldset>

          {algum && (
            <Campo id="conf-paginas" etiqueta="Páginas afectadas" obrigatorio={precisaPaginas}
              ajuda="A alínea g) manda anotar as páginas afectadas na Lista de Páginas Efectivas. Sem elas, o achado não se corrige — e o servidor recusa-o.">
              <Input value={paginas} onChange={(e) => setPaginas(e.target.value)} className="h-11" style={MONO} placeholder="3-4, 3-5, A-1" />
            </Campo>
          )}
          {algum && (
            <Campo id="conf-accao" etiqueta="Acção corretiva" ajuda="O que foi feito, ou o que vai ser feito, para pôr a cópia em conformidade.">
              <Textarea rows={2} value={accao} onChange={(e) => setAccao(e.target.value)} />
            </Campo>
          )}
          <Campo id="conf-nota" etiqueta="Nota">
            <Textarea rows={2} value={nota} onChange={(e) => setNota(e.target.value)} />
          </Campo>

          {!algum && (
            <p className={cn('flex items-center gap-2 text-sm', T.verde)}>
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Vai registar esta cópia como conforme: sem páginas retiradas, inseridas, modificadas nem manuscritas.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" className="h-11" onClick={onFechar}>Cancelar</Button>
          <Button className="h-11" disabled={!podeGravar} onClick={gravar}>
            {ocupado && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}Registar a conferência
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── confirmação do detentor ────────────────────────────────────────────────
function DialogoConfirmar({ item, copia, ciclo, onFechar, onConfirmado }) {
  const { toast } = useToast();
  const [nota, setNota] = useState('');
  const [declaro, setDeclaro] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const confirmar = async () => {
    setOcupado(true);
    try { await confirmarConferencia(item.id, nota); onConfirmado(); }
    catch (e) { toast({ variant: 'destructive', title: 'Não foi possível confirmar', description: e.message }); }
    finally { setOcupado(false); }
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Confirmar a cópia nº {copia?.numero ?? '—'}</DialogTitle>
          <DialogDescription>
            Esta confirmação é a sua declaração de detentor. Não substitui a conferência do responsável pela guarda
            e controlo, que é o que a lei obriga — serve para que ele saiba que a cópia está onde devia estar.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <label htmlFor="declaro" className={cn('flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2', T.linha)}>
            <Checkbox id="declaro" checked={declaro} onCheckedChange={(v) => setDeclaro(!!v)} className="mt-1 h-5 w-5" />
            <span className={cn('text-sm', T.tintaMedia)}>
              Declaro que tenho esta cópia na minha posse, no local de guarda registado, e que as suas páginas
              conferem com a Lista de Páginas Efectivas{ciclo?.revisao ? ` da revisão ${ciclo.revisao}` : ''}.
            </span>
          </label>
          <Campo id="conf-det-nota" etiqueta="Observação" ajuda="Se houver algo que não confere, escreva-o aqui: é por onde a correcção começa.">
            <Textarea rows={3} value={nota} onChange={(e) => setNota(e.target.value)} />
          </Campo>
        </div>
        <DialogFooter>
          <Button variant="outline" className="h-11" onClick={onFechar}>Cancelar</Button>
          <Button className="h-11" disabled={ocupado || !declaro} onClick={confirmar}>
            {ocupado && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            <UserCheck className="h-4 w-4" aria-hidden="true" />Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
