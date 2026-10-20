// Cópias controladas de um documento classificado (migração 158).
//
// A lei, textualmente — Instrutivo 32.009.001.A (Despacho n.º 4450/25), n.º 3, alínea a): as matérias
// classificadas «são distribuídos às entidades com necessidade de saber, mediante cópias controladas»; e a
// alínea b) do mesmo número põe lá dentro os «Programas de segurança de operadores aéreos e aeroportuários».
// Instrutivo 32.039.001.A (Despacho n.º 4442/25), secção XIV, n.º 2:
//   alínea b) a distribuição respeita «o princípio da necessidade de conhecimento»;
//   alínea c) «Guardar cópias dos programas em local reservado com acesso controlado»;
//   alínea d) manter o registo das pessoas credenciadas a possuir cópia;
//   alínea e) «Disponibilizar cópias dos programas apenas para os credenciados».
//
// Como é que a alínea e) é cumprida aqui: NÃO É PELO FORMULÁRIO. É um gatilho no servidor que recusa registar uma
// cópia activa de documento classificado em nome de quem não tem credencial válida, com o âmbito certo, na data
// da entrega. Este ecrã mostra o estado e traduz a recusa; não é ele que guarda a porta — se estivesse só aqui,
// bastava uma chamada directa ao servidor para o contornar.
//
// Três notas de desenho:
//   1. A NUMERAÇÃO É NOSSA. A lei não exige cópias numeradas; a prática do sector sim, e é o que permite dizer
//      «falta a cópia nº 4». O número é atribuído pelo servidor, consecutivo por documento.
//   2. O SUPORTE É DITO. O Instrutivo assume volume físico (capa com quatro argolas, folhas encadernadas e
//      enumeradas). Uma cópia digital não se confere página a página da mesma maneira, e por isso isso fica
//      escrito em cada linha em vez de ficar implícito.
//   3. UMA CÓPIA NÃO SE APAGA. Devolve-se, dá-se por extraviada, ou destrói-se — e isso fica no registo. Uma
//      cópia que desaparece da lista é uma cópia que ninguém vai procurar.
import React, { useCallback, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowUpRight, BookCopy, Download, FileInput, Loader2, Pencil, Plus, Printer, RotateCcw, Search,
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
  useCopiasControladas, useCredenciados, useEdicoesLep, useRecarregarAvsec,
  credencialUtil, estadoCredencial, ROTULO_ESTADO_COPIA, ROTULO_SUPORTE,
} from '../../hooksAvsec';
import { guardarCopiaControlada, mudarEstadoCopia, actualizarRevisaoCopia } from '../../apiAvsec';
import { AvisoGrave, Campo, Conta, Lei, Selo, TOM_COPIA, TD, TH, THEAD } from './pecas';
import { pdfListaDistribuicao, descarregarCsv, COLUNAS_COPIAS, celulasCopia } from './pdfAvsec';

const hojeIso = () => new Date().toISOString().slice(0, 10);
const VAZIA = {
  detentor_email: '', detentor_nome: '', detentor_cargo: '', entidade: '', suporte: 'fisico',
  local_guarda: '', revisao: '', lep_id: '', entregue_em: hojeIso(), entregue_por: '', recebido_em: '', nota: '',
};
const SUPORTES = [
  { value: 'fisico', label: 'Volume físico — encadernado, com quatro argolas' },
  { value: 'digital', label: 'Cópia digital — formato não editável' },
];
const ESTADOS = [
  { value: 'devolvida', label: 'Devolvida — voltou ao responsável pela guarda' },
  { value: 'extraviada', label: 'Extraviada — não se sabe onde está' },
  { value: 'destruida', label: 'Destruída — eliminada com registo' },
];

export default function CopiasControladas({ documento, regime, lepEmVigor, podeGerir }) {
  const documentoId = documento?.documento_id || documento?.id || null;
  const { user } = useAuth();
  const { toast } = useToast();
  const recarregar = useRecarregarAvsec();

  const copiasQ = useCopiasControladas({ documentoId });
  const copias = useMemo(() => (Array.isArray(copiasQ.data) ? copiasQ.data : []), [copiasQ.data]);
  const credQ = useCredenciados();
  const credenciados = useMemo(() => (Array.isArray(credQ.data) ? credQ.data : []), [credQ.data]);
  const edicoesQ = useEdicoesLep(documentoId);
  const edicoes = useMemo(() => (Array.isArray(edicoesQ.data) ? edicoesQ.data : []), [edicoesQ.data]);

  const [busca, setBusca] = useState('');
  const [dialogo, setDialogo] = useState(null);

  const falhar = useCallback((e) => toast({ variant: 'destructive', title: 'Não foi possível', description: e?.message || 'Erro desconhecido.' }), [toast]);
  const feito = useCallback((titulo, description) => { toast({ title: titulo, description }); recarregar(); }, [toast, recarregar]);

  // Quem é que, hoje, tem uma cópia activa sem credencial válida. O gatilho impede entregas novas, mas uma
  // credencial pode caducar DEPOIS da entrega — e é esse o caso que ninguém nota sem alguém o mostrar.
  const porEmail = useMemo(() => {
    const m = new Map();
    for (const c of credenciados) {
      const k = String(c.email || '').toLowerCase();
      m.set(k, [...(m.get(k) || []), c]);
    }
    return m;
  }, [credenciados]);
  const semCredencial = useMemo(
    () => copias.filter(c => c.estado === 'activa' && !(porEmail.get(String(c.detentor_email || '').toLowerCase()) || []).some(credencialUtil)),
    [copias, porEmail],
  );

  const revisaoEmVigor = lepEmVigor?.revisao || null;
  const desactualizadas = useMemo(
    () => copias.filter(c => c.estado === 'activa' && revisaoEmVigor && c.revisao !== revisaoEmVigor),
    [copias, revisaoEmVigor],
  );

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return copias;
    return copias.filter(c => [c.detentor_nome, c.detentor_email, c.detentor_cargo, c.entidade, c.local_guarda, String(c.numero)]
      .some(v => String(v || '').toLowerCase().includes(q)));
  }, [copias, busca]);

  const geradoPor = user?.full_name || user?.email || '';
  const imprimir = useCallback(async () => {
    try { await pdfListaDistribuicao({ documento, copias, regime, geradoPor }); }
    catch (e) { falhar(e); }
  }, [documento, copias, regime, geradoPor, falhar]);

  if (!documentoId) {
    return <EstadoVazio icone={BookCopy} titulo="Escolha um documento" texto="As cópias controladas são de um volume. Escolha o documento à esquerda." />;
  }
  if (copiasQ.isError) return <EstadoErro onTentar={() => copiasQ.refetch()} />;

  const activas = copias.filter(c => c.estado === 'activa');
  const extraviadas = copias.filter(c => c.estado === 'extraviada');
  const semRecepcao = activas.filter(c => !c.recebido_em);

  return (
    <div className="space-y-5">
      <Lei fonte="Instrutivo 32.009.001.A (Despacho n.º 4450/25), n.º 3, alínea a); Instrutivo 32.039.001.A, secção XIV, n.º 2, alíneas c), d) e e)">
        As matérias classificadas «são distribuídos às entidades com necessidade de saber, <strong>mediante cópias
        controladas</strong>». As cópias guardam-se «em local reservado com acesso controlado» e disponibilizam-se
        «apenas para os credenciados».
      </Lei>

      {!!semCredencial.length && (
        <AvisoGrave
          titulo={`${semCredencial.length} cópia${semCredencial.length === 1 ? '' : 's'} em poder de quem não tem credencial válida`}
          accao={<Button variant="outline" className="h-10" onClick={() => setBusca(semCredencial[0].detentor_email)}>
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />Ver
          </Button>}
        >
          {semCredencial.map(c => `nº ${c.numero} (${c.detentor_nome || c.detentor_email})`).join(', ')}.
          A credencial caducou ou foi revogada depois da entrega. Recolha a cópia e registe a devolução, ou
          renove a credencial — a alínea e) não admite cópias na mão de quem não está credenciado.
        </AvisoGrave>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Conta valor={activas.length} label="em poder de detentores" />
        <Conta valor={desactualizadas.length} label={revisaoEmVigor ? `não estão na rev. ${revisaoEmVigor}` : 'sem lista em vigor para comparar'}
          tom={desactualizadas.length ? 'aviso' : 'neutro'} />
        <Conta valor={semRecepcao.length} label="sem recepção registada" tom={semRecepcao.length ? 'aviso' : 'neutro'} />
        <Conta valor={extraviadas.length} label="extraviadas" tom={extraviadas.length ? 'mau' : 'neutro'} />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="relative min-w-[16rem] flex-1">
          <Search className={cn('pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2', T.tintaFraca)} aria-hidden="true" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} className="h-11 pl-9"
            placeholder="Procurar por detentor, local de guarda ou número" aria-label="Procurar nas cópias controladas" />
        </div>
        <div className="flex flex-wrap gap-2">
          {podeGerir && (
            <Button className="h-11" onClick={() => setDialogo({ copia: { ...VAZIA, revisao: revisaoEmVigor || '', lep_id: lepEmVigor?.lep_id || lepEmVigor?.id || '' } })}>
              <Plus className="h-4 w-4" aria-hidden="true" />Entregar uma cópia
            </Button>
          )}
          <Button variant="outline" className="h-11" disabled={!copias.length} onClick={imprimir}>
            <Printer className="h-4 w-4" aria-hidden="true" />Lista de Distribuição
          </Button>
          <Button variant="outline" className="h-11" disabled={!copias.length}
            onClick={() => descarregarCsv(`Copias_controladas_${documento?.numero || 'documento'}`, COLUNAS_COPIAS,
              copias.map(c => celulasCopia(c, { identidadeDoc: () => [documento?.numero, documento?.titulo].filter(Boolean).join(' — ') })))}>
            <Download className="h-4 w-4" aria-hidden="true" />CSV
          </Button>
        </div>
      </div>

      <section>
        <TituloSeccao contagem={visiveis.length}>Cópias controladas</TituloSeccao>
        <div className={cn('overflow-x-auto rounded-xl border', T.linha, T.superficie)}>
          {copiasQ.isLoading ? <EsqueletoLinhas linhas={5} /> : !visiveis.length ? (
            <EstadoVazio
              icone={BookCopy}
              titulo={copias.length ? 'Nenhuma cópia corresponde à procura' : 'Ainda não há cópias controladas deste documento'}
              texto={copias.length
                ? 'Limpe a procura para ver todas.'
                : 'Registe cada cópia entregue: é o registo da alínea d), é o que se apresenta numa inspecção, e é dele que sai a conferência semestral.'}
            >
              {podeGerir && !copias.length && (
                <Button className="h-11" onClick={() => setDialogo({ copia: { ...VAZIA, revisao: revisaoEmVigor || '' } })}>
                  <Plus className="h-4 w-4" aria-hidden="true" />Entregar a primeira cópia
                </Button>
              )}
            </EstadoVazio>
          ) : (
            <table className="w-full min-w-[56rem] border-collapse">
              <caption className="sr-only">Cópias controladas de {documento?.numero || 'documento'}</caption>
              <thead className={THEAD}>
                <tr>
                  <th scope="col" className={TH}>Nº</th>
                  <th scope="col" className={TH}>Detentor</th>
                  <th scope="col" className={TH}>Suporte e local de guarda</th>
                  <th scope="col" className={TH}>Revisão na posse</th>
                  <th scope="col" className={TH}>Entrega e recepção</th>
                  <th scope="col" className={TH}>Estado</th>
                  {podeGerir && <th scope="col" className={cn(TH, 'text-right')}>Acções</th>}
                </tr>
              </thead>
              <tbody className={cn('divide-y', T.divisoria)}>
                {visiveis.map(c => {
                  const creds = porEmail.get(String(c.detentor_email || '').toLowerCase()) || [];
                  const credencial = creds.find(credencialUtil) || creds[0] || null;
                  const estadoCred = credencial ? estadoCredencial(credencial) : null;
                  const atrasada = c.estado === 'activa' && revisaoEmVigor && c.revisao !== revisaoEmVigor;
                  return (
                    <tr key={c.id} className={T.realce}>
                      <td className={TD}><Ref className={cn('font-semibold', T.tinta)}>{c.numero}</Ref></td>
                      <td className={TD}>
                        <span className={cn('block font-medium', T.tinta)}>{c.detentor_nome || c.detentor_email}</span>
                        <span className={cn('block text-xs', T.tintaFraca)}>
                          {[c.detentor_cargo, c.entidade, c.detentor_email].filter(Boolean).join(' · ')}
                        </span>
                        {c.estado === 'activa' && (
                          estadoCred === 'activo'
                            ? <span className={cn('mt-1 block text-xs', T.verde)}>Credencial válida{credencial?.valida_ate ? ` até ${fmtData(credencial.valida_ate)}` : ' sem termo'}</span>
                            : <span className={cn('mt-1 block text-xs', T.vermelho)}>{credencial ? `Credencial ${estadoCred}` : 'Sem credencial no registo'}</span>
                        )}
                      </td>
                      <td className={TD}>
                        <span className={cn('block text-sm', T.tintaMedia)}>{ROTULO_SUPORTE[c.suporte] || c.suporte}</span>
                        <span className={cn('block text-xs', c.local_guarda ? T.tintaFraca : T.ambar)}>
                          {c.local_guarda || 'Local de guarda não registado (alínea c))'}
                        </span>
                      </td>
                      <td className={TD}>
                        <span style={MONO} className="text-sm">{c.revisao || '—'}</span>
                        {atrasada && <Selo tom="aviso" className="ml-2">Rev. {revisaoEmVigor} em vigor</Selo>}
                      </td>
                      <td className={TD}>
                        <span className={cn('block text-sm', T.tintaMedia)}>Entregue {fmtData(c.entregue_em)}</span>
                        {c.entregue_por && <span className={cn('block text-xs', T.tintaFraca)}>por {c.entregue_por}</span>}
                        <span className={cn('block text-xs', c.recebido_em ? T.tintaFraca : T.ambar)}>
                          {c.recebido_em ? `Recepção registada ${fmtData(c.recebido_em)}` : 'Recepção por registar'}
                        </span>
                      </td>
                      <td className={TD}>
                        <Selo tom={TOM_COPIA[c.estado] || 'neutro'}>{ROTULO_ESTADO_COPIA[c.estado] || c.estado}</Selo>
                        {c.devolvida_em && <span className={cn('mt-1 block text-xs', T.tintaFraca)}>{fmtData(c.devolvida_em)}</span>}
                        {c.estado_nota && <span className={cn('mt-1 block max-w-prose text-xs', T.tintaFraca)}>{c.estado_nota}</span>}
                      </td>
                      {podeGerir && (
                        <td className={cn(TD, 'text-right whitespace-nowrap')}>
                          <Button variant="ghost" size="sm" className="h-9" onClick={() => setDialogo({ copia: { ...c } })}>
                            <Pencil className="h-4 w-4" aria-hidden="true" /><span className="sr-only">Alterar a cópia nº {c.numero}</span>
                          </Button>
                          {c.estado === 'activa' && atrasada && (
                            <Button variant="ghost" size="sm" className="h-9" onClick={() => setDialogo({ actualizar: c })}>
                              <FileInput className="h-4 w-4" aria-hidden="true" /><span className="sr-only">Registar a actualização da cópia nº {c.numero}</span>
                            </Button>
                          )}
                          {c.estado === 'activa' ? (
                            <Button variant="ghost" size="sm" className="h-9" onClick={() => setDialogo({ fechar: c })}>
                              <ArrowUpRight className="h-4 w-4" aria-hidden="true" /><span className="sr-only">Mudar o estado da cópia nº {c.numero}</span>
                            </Button>
                          ) : (
                            <Button variant="ghost" size="sm" className="h-9"
                              onClick={async () => {
                                try { await mudarEstadoCopia(c, 'activa', null, user); feito('Cópia reactivada'); }
                                catch (e) { falhar(e); }
                              }}>
                              <RotateCcw className="h-4 w-4" aria-hidden="true" /><span className="sr-only">Reactivar a cópia nº {c.numero}</span>
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {dialogo?.copia && (
        <DialogoCopia
          copia={dialogo.copia}
          documentoId={documentoId}
          credenciados={credenciados}
          edicoes={edicoes}
          revisaoEmVigor={revisaoEmVigor}
          onFechar={() => setDialogo(null)}
          onGuardado={(r) => { setDialogo(null); feito('Cópia registada', r?.numero ? `Ficou com o número ${r.numero}.` : undefined); }}
        />
      )}
      {dialogo?.fechar && (
        <DialogoEstado copia={dialogo.fechar} onFechar={() => setDialogo(null)}
          onGuardado={() => { setDialogo(null); feito('Estado da cópia registado'); }} />
      )}
      {dialogo?.actualizar && (
        <DialogoActualizar copia={dialogo.actualizar} edicoes={edicoes} revisaoEmVigor={revisaoEmVigor}
          onFechar={() => setDialogo(null)} onGuardado={() => { setDialogo(null); feito('Cópia actualizada', 'Fica registado que a cópia passou à revisão nova.'); }} />
      )}
    </div>
  );
}

// ── entregar / alterar uma cópia ───────────────────────────────────────────
function DialogoCopia({ copia, documentoId, credenciados, edicoes, revisaoEmVigor, onFechar, onGuardado }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [f, setF] = useState({ ...VAZIA, ...copia, lep_id: copia.lep_id || '' });
  const [ocupado, setOcupado] = useState(false);
  const novo = !copia.id;

  const validos = useMemo(() => credenciados.filter(credencialUtil), [credenciados]);
  const escolhido = validos.find(c => String(c.email || '').toLowerCase() === String(f.detentor_email || '').toLowerCase()) || null;

  const gravar = async () => {
    setOcupado(true);
    try { onGuardado(await guardarCopiaControlada({ ...f, documento_id: documentoId, lep_id: f.lep_id || null }, user)); }
    catch (e) { toast({ variant: 'destructive', title: 'Não foi possível registar', description: e.message }); }
    finally { setOcupado(false); }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{novo ? 'Entregar uma cópia controlada' : `Cópia nº ${copia.numero}`}</DialogTitle>
          <DialogDescription>
            Só pode receber cópia quem tiver credencial válida para este documento. O número é atribuído pelo
            servidor, consecutivo por documento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {novo && (
            <Campo id="copia-cred" etiqueta="Detentor credenciado" obrigatorio
              ajuda={validos.length ? 'Só aparecem pessoas com credencial válida. Para credenciar alguém, vá ao separador dos credenciados.' : 'Não há ninguém com credencial válida: credencie primeiro a pessoa.'}>
              <Select
                value={f.detentor_email}
                onValueChange={(v) => {
                  const c = validos.find(x => x.email === v);
                  setF({
                    ...f, detentor_email: v,
                    detentor_nome: c?.nome || f.detentor_nome,
                    detentor_cargo: c?.cargo || f.detentor_cargo,
                    entidade: c?.entidade || f.entidade,
                  });
                }}
                placeholder="Escolha quem recebe a cópia"
                options={validos.map(c => ({
                  value: c.email,
                  label: `${c.nome}${c.cargo ? ` · ${c.cargo}` : ''} — ${c.aeroporto_icao || 'todos os aeroportos'}`,
                }))}
              />
            </Campo>
          )}
          {novo && !!f.detentor_email && !escolhido && (
            <p className={cn('flex items-start gap-2 text-sm', T.ambar)}>
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Esta pessoa não tem credencial válida no registo. O servidor vai recusar a entrega.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="copia-nome" etiqueta="Nome do detentor" obrigatorio>
              <Input value={f.detentor_nome} onChange={(e) => setF({ ...f, detentor_nome: e.target.value })} className="h-11" />
            </Campo>
            <Campo id="copia-email" etiqueta="Correio electrónico" obrigatorio>
              <Input type="email" value={f.detentor_email} onChange={(e) => setF({ ...f, detentor_email: e.target.value })} className="h-11" disabled={!novo} />
            </Campo>
            <Campo id="copia-cargo" etiqueta="Cargo">
              <Input value={f.detentor_cargo || ''} onChange={(e) => setF({ ...f, detentor_cargo: e.target.value })} className="h-11" />
            </Campo>
            <Campo id="copia-entidade" etiqueta="Entidade">
              <Input value={f.entidade || ''} onChange={(e) => setF({ ...f, entidade: e.target.value })} className="h-11" />
            </Campo>
            <Campo id="copia-suporte" etiqueta="Suporte" obrigatorio
              ajuda="O Instrutivo assume volume físico. Uma cópia digital não se confere página a página da mesma maneira.">
              <Select value={f.suporte} onValueChange={(v) => setF({ ...f, suporte: v })} options={SUPORTES} searchable={false} />
            </Campo>
            <Campo id="copia-local" etiqueta="Local de guarda"
              ajuda="A alínea c) manda guardar as cópias «em local reservado com acesso controlado». Diga qual é.">
              <Input value={f.local_guarda || ''} onChange={(e) => setF({ ...f, local_guarda: e.target.value })} className="h-11" />
            </Campo>
            <Campo id="copia-rev" etiqueta="Revisão entregue" obrigatorio
              ajuda={revisaoEmVigor ? `A revisão em vigor é a ${revisaoEmVigor}.` : 'Não há Lista de Páginas Efectivas emitida: emita-a antes de distribuir.'}>
              <Input value={f.revisao || ''} onChange={(e) => setF({ ...f, revisao: e.target.value })} className="h-11" style={MONO} />
            </Campo>
            <Campo id="copia-lep" etiqueta="Lista de Páginas Efectivas entregue"
              ajuda="A lista que foi com a cópia. É contra ela que a conferência semestral é feita.">
              <Select
                value={f.lep_id}
                onValueChange={(v) => {
                  const e = edicoes.find(x => x.id === v);
                  setF({ ...f, lep_id: v, revisao: e?.revisao || f.revisao });
                }}
                placeholder="Escolha a edição"
                options={[{ value: '', label: 'Nenhuma' }, ...edicoes.map(e => ({ value: e.id, label: `Rev. ${e.revisao} · ${fmtData(e.emitida_em)}` }))]}
              />
            </Campo>
            <Campo id="copia-entregue" etiqueta="Entregue em" obrigatorio>
              <Input type="date" value={String(f.entregue_em || '').slice(0, 10)} onChange={(e) => setF({ ...f, entregue_em: e.target.value })} className="h-11" />
            </Campo>
            <Campo id="copia-recebido" etiqueta="Recepção registada em"
              ajuda="A data em que o detentor acusou a recepção. Em branco enquanto não acusar.">
              <Input type="date" value={String(f.recebido_em || '').slice(0, 10)} onChange={(e) => setF({ ...f, recebido_em: e.target.value })} className="h-11" />
            </Campo>
          </div>
          <Campo id="copia-nota" etiqueta="Nota">
            <Textarea rows={2} value={f.nota || ''} onChange={(e) => setF({ ...f, nota: e.target.value })} />
          </Campo>
        </div>

        <DialogFooter>
          <Button variant="outline" className="h-11" onClick={onFechar}>Cancelar</Button>
          <Button className="h-11" disabled={ocupado} onClick={gravar}>
            {ocupado && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}{novo ? 'Registar a entrega' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── devolver, extraviar, destruir ──────────────────────────────────────────
function DialogoEstado({ copia, onFechar, onGuardado }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [estado, setEstado] = useState('devolvida');
  const [nota, setNota] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const gravar = async () => {
    setOcupado(true);
    try { await mudarEstadoCopia(copia, estado, nota, user); onGuardado(); }
    catch (e) { toast({ variant: 'destructive', title: 'Não foi possível guardar', description: e.message }); }
    finally { setOcupado(false); }
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Cópia nº {copia.numero} — {copia.detentor_nome || copia.detentor_email}</DialogTitle>
          <DialogDescription>
            A cópia não se apaga do registo. Fica com o estado novo, a data e o que ficou escrito.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Campo id="estado-copia" etiqueta="O que aconteceu" obrigatorio>
            <Select value={estado} onValueChange={setEstado} options={ESTADOS} searchable={false} />
          </Campo>
          <Campo id="estado-nota" etiqueta={estado === 'extraviada' ? 'Circunstâncias do extravio' : 'Nota'}
            obrigatorio={estado === 'extraviada'}
            ajuda={estado === 'extraviada'
              ? 'Uma cópia de matéria classificada extraviada é um incidente de segurança: escreva o que se sabe, e comunique-o pelas vias próprias.'
              : undefined}>
            <Textarea rows={3} value={nota} onChange={(e) => setNota(e.target.value)} />
          </Campo>
        </div>
        <DialogFooter>
          <Button variant="outline" className="h-11" onClick={onFechar}>Cancelar</Button>
          <Button className="h-11" disabled={ocupado || (estado === 'extraviada' && !nota.trim())} onClick={gravar}>
            {ocupado && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}Registar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── actualizar a revisão que a cópia tem ───────────────────────────────────
// É o fecho do ciclo da alínea g): depois de inserir e cancelar as páginas afectadas no volume do detentor, a
// cópia passa a estar na revisão nova. Sem este passo, a cópia fica para sempre marcada como desactualizada.
function DialogoActualizar({ copia, edicoes, revisaoEmVigor, onFechar, onGuardado }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const emVigor = edicoes.find(e => e.estado === 'emitida') || null;
  const [lepId, setLepId] = useState(emVigor?.id || '');
  const [ocupado, setOcupado] = useState(false);
  const escolhida = edicoes.find(e => e.id === lepId) || emVigor;
  const gravar = async () => {
    setOcupado(true);
    try { await actualizarRevisaoCopia(copia.id, { revisao: escolhida?.revisao || revisaoEmVigor, lep_id: lepId || null }, user); onGuardado(); }
    catch (e) { toast({ variant: 'destructive', title: 'Não foi possível actualizar', description: e.message }); }
    finally { setOcupado(false); }
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Actualizar a cópia nº {copia.numero}</DialogTitle>
          <DialogDescription>
            Registe isto depois de ter inserido e cancelado no volume do detentor as páginas afectadas, e de ter
            substituído a Lista de Páginas Efectivas que vai no início — é o que a alínea g) manda fazer.
          </DialogDescription>
        </DialogHeader>
        <Campo id="act-lep" etiqueta="Revisão que a cópia passa a ter" obrigatorio>
          <Select value={lepId} onValueChange={setLepId} placeholder="Escolha a edição"
            options={edicoes.map(e => ({ value: e.id, label: `Rev. ${e.revisao} · ${fmtData(e.emitida_em)}${e.estado === 'emitida' ? ' (em vigor)' : ''}` }))} />
        </Campo>
        <DialogFooter>
          <Button variant="outline" className="h-11" onClick={onFechar}>Cancelar</Button>
          <Button className="h-11" disabled={ocupado || !escolhida} onClick={gravar}>
            {ocupado && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}Actualizar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
