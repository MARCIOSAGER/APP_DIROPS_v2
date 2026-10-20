// Regime AVSEC (/documentos/gestao/avsec) — a gestão do regime próprio dos documentos de segurança da aviação.
//
// Porque é que este ecrã existe à parte de tudo o resto do portal: o Programa de Segurança do Aeroporto não se
// rege pelas regras dos manuais. O Manual de Operações vive do Instrutivo 22C.107.001.A (que a página das
// Emendas já serve, com o Registo de Emendas do Anexo 3); o PSA vive do **Instrutivo 32.039.001.A**, aprovado
// pelo **Despacho n.º 4442/25** (Diário da República, II Série, n.º 108, de 12 de Junho de 2025), e esse impõe
// três coisas que nenhum outro documento do portal tem:
//
//   LISTA DE PÁGINAS EFECTIVAS — secção XIII, alínea k): «Ter no início do volume, uma "Lista de Páginas
//     Efectivas" para actualização, cancelamento ou inserção de páginas, com as respectivas revisões e datas de
//     efectivação». É o que permite a um detentor provar que a cópia que tem na mão está completa e actual.
//   CONFERÊNCIA SEMESTRAL — secção XIV, n.º 2, alínea i): «Estabelecer semestralmente conferência e actualização
//     de páginas com base na "Lista de Páginas Efectivas", a fim de garantir que nenhuma página dos programas
//     seja retirada, inserida, modificada ou tenham alguma alteração manuscrita».
//   REGISTO DE CREDENCIADOS — secção XIV, n.º 2, alíneas d), e) e j): o registo nominal de quem pode possuir
//     cópia, a regra de só entregar a esses, e a autorização do responsável da empresa.
//
// E porque o PSA é matéria classificada: Instrutivo 32.009.001.A (Despacho n.º 4450/25), n.º 3, alínea b), que
// manda distribuí-lo «às entidades com necessidade de saber, mediante cópias controladas».
//
// Desenho (docs/desenho-portal-documentos.md): o estado vive no endereço — separador e documento escolhido —
// para uma vista poder ser citada numa auditoria tal como foi vista. Um só aviso de largura total em toda a
// página, reservado à única coisa que o merece: uma cópia classificada em poder de quem não está credenciado.
// Tudo o mais é selo, número ou texto. Alvos de toque de 44 px, porque isto usa-se de pé, com luvas.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, BookCopy, CalendarClock, ClipboardCheck, FileText, Loader2, Plus, RefreshCw,
  ShieldAlert, ShieldCheck, Sparkles, Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import Select from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import { fmtData } from '@/lib/safeDate';
import {
  PaginaGestao, T, Ref, EstadoVazio, EstadoErro, EsqueletoLinhas, TituloSeccao, ehGestor,
} from './PortalLayout';
import { mapaPorId, nomeAero } from './pages/PortalBiblioteca';
import { useAeroportosDocs } from './hooks';
import { useProcessosDocs } from './hooksCodificacao';
import {
  useRegimeAvsec, useCandidatosAvsec, useCategoriasClassificacao, useRegimeDocumento,
  useCredenciaisACaducar, useMinhasConferencias, useRecarregarAvsec, nomeSemestre, semestreDe,
} from './hooksAvsec';
import { guardarRegimeAvsec, classificarDocumento, abrirSemestreTodos } from './apiAvsec';
import { AvisoGrave, Campo, Conta, Lei, Selo } from './components/avsec/pecas';
import ListaPaginasEfectivas from './components/avsec/ListaPaginasEfectivas';
import CiclosConferencia from './components/avsec/CiclosConferencia';
import CopiasControladas from './components/avsec/CopiasControladas';
import RegistoCredenciados from './components/avsec/RegistoCredenciados';

const SEPARADORES = ['painel', 'lep', 'copias', 'conferencia', 'credenciados', 'regime'];

export default function PortalAvsec() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const recarregar = useRecarregarAvsec();

  const podeGerir = ehGestor(user);
  const meuEmail = String(user?.email || '').toLowerCase();

  const regime = useRegimeAvsec();
  const aeroportosQ = useAeroportosDocs();
  const aeroportos = useMemo(() => (Array.isArray(aeroportosQ.data) ? aeroportosQ.data : []), [aeroportosQ.data]);
  const mapaAero = useMemo(() => mapaPorId(aeroportos), [aeroportos]);
  const processosQ = useProcessosDocs();
  const processos = useMemo(() => (Array.isArray(processosQ.data) ? processosQ.data : []), [processosQ.data]);
  const caducarQ = useCredenciaisACaducar(60);
  const aCaducar = useMemo(() => (Array.isArray(caducarQ.data) ? caducarQ.data : []), [caducarQ.data]);
  const minhasQ = useMinhasConferencias();
  const minhas = useMemo(() => (Array.isArray(minhasQ.data) ? minhasQ.data : []), [minhasQ.data]);

  // ── estado no endereço ──
  const separador = SEPARADORES.includes(params.get('tab')) ? params.get('tab') : 'painel';
  const docUrl = params.get('doc') || '';
  const mudarParam = useCallback((chave, valor) => {
    setParams(p => {
      const n = new URLSearchParams(p);
      if (valor) n.set(chave, valor); else n.delete(chave);
      return n;
    }, { replace: true });
  }, [setParams]);

  // O documento escolhido: o do endereço, se existir; senão o primeiro, para a página nunca abrir vazia quando
  // há regime para mostrar.
  const documento = useMemo(
    () => regime.documentos.find(d => d.documento_id === docUrl) || regime.documentos[0] || null,
    [regime.documentos, docUrl],
  );
  useEffect(() => {
    if (documento && documento.documento_id !== docUrl) mudarParam('doc', documento.documento_id);
  }, [documento, docUrl, mudarParam]);

  const regimeDocQ = useRegimeDocumento(documento?.documento_id);
  const [dialogo, setDialogo] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const falhar = useCallback((e) => toast({ variant: 'destructive', title: 'Não foi possível', description: e?.message || 'Erro desconhecido.' }), [toast]);

  const abrirTodos = useCallback(async () => {
    setOcupado(true);
    try {
      const r = await abrirSemestreTodos({});
      const copias = r.reduce((s, x) => s + (Number(x.copias) || 0), 0);
      toast({
        title: `Semestre aberto em ${r.length} documento${r.length === 1 ? '' : 's'}`,
        description: r.length
          ? `${copias} cópia${copias === 1 ? '' : 's'} a conferir no ${nomeSemestre(new Date().getFullYear(), semestreDe())}.`
          : 'Nenhum documento do regime tem cópias em poder de detentores.',
      });
      recarregar();
    } catch (e) { falhar(e); } finally { setOcupado(false); }
  }, [toast, recarregar, falhar]);

  // ── a migração ainda não foi aplicada ──
  if (regime.faltaMigracao) {
    return (
      <PaginaGestao titulo="Regime AVSEC" descricao="Lista de Páginas Efectivas, conferência semestral e credenciados.">
        <div className={cn('rounded-xl border', T.linha, T.superficie)}>
          <EstadoVazio
            icone={ShieldAlert}
            titulo="O regime AVSEC ainda não está instalado"
            texto="As tabelas deste regime vêm na migração 158 (sql/158_regime_avsec.sql), que ainda não foi aplicada à base de dados. Depois de a aplicar e de o esquema recarregar, esta página passa a funcionar sem mais nada."
          />
        </div>
      </PaginaGestao>
    );
  }
  if (regime.isError) {
    return (
      <PaginaGestao titulo="Regime AVSEC">
        <EstadoErro onTentar={regime.recarregar} />
      </PaginaGestao>
    );
  }

  const c = regime.contagens;
  const lepDoDoc = documento ? { lep_id: documento.lep_id, revisao: documento.lep_revisao, emitida_em: documento.lep_emitida_em } : null;

  return (
    <PaginaGestao
      titulo="Regime AVSEC"
      descricao="Programas de segurança: Lista de Páginas Efectivas, conferência semestral das cópias controladas e registo de credenciados."
      accoes={
        <>
          <Button variant="outline" className="h-11" onClick={regime.recarregar} disabled={regime.isFetching}>
            {regime.isFetching ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
            Recarregar
          </Button>
          {podeGerir && (
            <Button variant="outline" className="h-11" onClick={() => setDialogo('candidatos')}>
              <Plus className="h-4 w-4" aria-hidden="true" />Trazer documentos
            </Button>
          )}
          {podeGerir && !!c.copiasActivas && (
            <Button className="h-11" disabled={ocupado} onClick={abrirTodos}>
              {ocupado ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CalendarClock className="h-4 w-4" aria-hidden="true" />}
              Abrir o semestre
            </Button>
          )}
        </>
      }
    >
      {/* O único aviso de largura total desta página. Está reservado à coisa que a lei não admite: cópia de
          documento classificado em poder de quem não tem credencial válida (secção XIV, n.º 2, alínea e)). */}
      {!!c.semCredencial && (
        <AvisoGrave
          titulo={`${c.semCredencial} cópia${c.semCredencial === 1 ? '' : 's'} classificada${c.semCredencial === 1 ? '' : 's'} em poder de quem não está credenciado`}
          accao={<Button variant="outline" className="h-10" onClick={() => mudarParam('tab', 'credenciados')}>Ver credenciais</Button>}
        >
          {regime.semCredencial.slice(0, 4).map(x => `${x.detentor_nome || x.detentor_email} (cópia nº ${x.numero})`).join('; ')}
          {regime.semCredencial.length > 4 ? ` e mais ${regime.semCredencial.length - 4}` : ''}.
          A credencial caducou ou foi revogada depois da entrega. Recolha as cópias e registe a devolução, ou
          renove as credenciais.
        </AvisoGrave>
      )}

      {/* As conferências que esta pessoa tem para confirmar. Aparece a todos, não só a gestores: quem detém uma
          cópia tem de a poder confirmar, e não vai procurar isso num ecrã de gestão sem ser avisado. */}
      {!!minhas.length && (
        <div className={cn('flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3', T.linha, T.superficieFraca)}>
          <ClipboardCheck className={cn('h-5 w-5 shrink-0', T.acento)} aria-hidden="true" />
          <p className={cn('min-w-0 flex-1 text-sm', T.tintaMedia)}>
            Tem {minhas.length} cópia{minhas.length === 1 ? '' : 's'} à sua guarda por confirmar nesta conferência semestral.
          </p>
          <Button variant="outline" className="h-10" onClick={() => mudarParam('tab', 'conferencia')}>Confirmar</Button>
        </div>
      )}

      <Tabs value={separador} onValueChange={(v) => mudarParam('tab', v)}>
        <TabsList className="flex w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="painel" className="min-h-[2.75rem]"><ShieldCheck className="h-4 w-4" aria-hidden="true" />Visão geral</TabsTrigger>
          <TabsTrigger value="lep" className="min-h-[2.75rem]"><FileText className="h-4 w-4" aria-hidden="true" />Páginas efectivas</TabsTrigger>
          <TabsTrigger value="copias" className="min-h-[2.75rem]"><BookCopy className="h-4 w-4" aria-hidden="true" />Cópias controladas</TabsTrigger>
          <TabsTrigger value="conferencia" className="min-h-[2.75rem]"><ClipboardCheck className="h-4 w-4" aria-hidden="true" />Conferência</TabsTrigger>
          <TabsTrigger value="credenciados" className="min-h-[2.75rem]"><Users className="h-4 w-4" aria-hidden="true" />Credenciados</TabsTrigger>
          <TabsTrigger value="regime" className="min-h-[2.75rem]"><Sparkles className="h-4 w-4" aria-hidden="true" />Guarda e controlo</TabsTrigger>
        </TabsList>

        {/* ── visão geral ───────────────────────────────────────────────── */}
        <TabsContent value="painel" className="mt-4 space-y-5">
          <Lei fonte="Instrutivo 32.039.001.A (Despacho n.º 4442/25), secções XIII e XIV; Instrutivo 32.009.001.A (Despacho n.º 4450/25), n.º 3">
            Os programas de segurança aeroportuários são matéria classificada, distribuída «às entidades com
            necessidade de saber, mediante cópias controladas», com Lista de Páginas Efectivas no início do
            volume, conferência semestral página a página, e registo nominal de quem está credenciado a possuí-los.
          </Lei>

          {regime.isLoading ? <EsqueletoLinhas linhas={6} /> : !regime.documentos.length ? (
            <div className={cn('rounded-xl border', T.linha, T.superficie)}>
              <EstadoVazio
                icone={ShieldCheck}
                titulo="Nenhum documento está no regime AVSEC"
                texto="Traga para o regime os programas de segurança: é a eles que se aplicam a Lista de Páginas Efectivas, a conferência semestral e as cópias controladas. Uma ficha de registo ou uma planta solta não precisa deste regime."
              >
                {podeGerir && <Button className="h-11" onClick={() => setDialogo('candidatos')}><Plus className="h-4 w-4" aria-hidden="true" />Escolher documentos</Button>}
              </EstadoVazio>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                <Conta valor={c.documentos} label="documentos no regime" />
                <Conta valor={c.semLep} label="sem lista de páginas" tom={c.semLep ? 'aviso' : 'neutro'} />
                <Conta valor={c.copiasActivas} label="cópias em poder de detentores" />
                <Conta valor={c.copiasDesactualizadas} label="cópias numa revisão antiga" tom={c.copiasDesactualizadas ? 'aviso' : 'neutro'} />
                <Conta valor={c.porConferir} label="cópias por conferir" tom={c.porConferir ? 'aviso' : 'neutro'} />
                <Conta valor={c.comAchados} label="conferências com achados" tom={c.comAchados ? 'mau' : 'neutro'} />
              </div>

              {!!c.foraDePrazo && (
                <p className={cn('flex items-start gap-2 rounded-lg border px-3 py-2 text-sm', T.linha, T.vermelho)}>
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  {c.foraDePrazo} ciclo{c.foraDePrazo === 1 ? '' : 's'} de conferência com o prazo ultrapassado.
                  A alínea i) manda conferir semestralmente: um ciclo aberto depois do fim do semestre é uma
                  conferência que não foi feita.
                </p>
              )}
              {!!c.credenciaisCaducadas && (
                <p className={cn('flex items-start gap-2 rounded-lg border px-3 py-2 text-sm', T.linha, T.ambar)}>
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  {c.credenciaisCaducadas} credencia{c.credenciaisCaducadas === 1 ? 'l caducada' : 'is caducadas'} no registo.
                  A validade é prazo da SGA, não da lei — mas enquanto estiver caducada, o servidor não deixa
                  entregar cópias a essa pessoa.
                </p>
              )}
              {!!aCaducar.filter(x => Number(x.dias) >= 0).length && (
                <section>
                  <TituloSeccao contagem={aCaducar.filter(x => Number(x.dias) >= 0).length}>Credenciais a caducar nos próximos 60 dias</TituloSeccao>
                  <ul className={cn('divide-y overflow-hidden rounded-xl border', T.divisoria, T.linha, T.superficie)}>
                    {aCaducar.filter(x => Number(x.dias) >= 0).map(x => (
                      <li key={x.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2 sm:px-4">
                        <span className={cn('font-medium', T.tinta)}>{x.nome}</span>
                        <span className={cn('text-sm', T.tintaFraca)}>{x.email}</span>
                        <Selo tom={Number(x.dias) <= 15 ? 'mau' : 'aviso'}>
                          {Number(x.dias) === 0 ? 'Caduca hoje' : `${x.dias} dias`}
                        </Selo>
                        <span className={cn('text-sm', T.tintaFraca)}>{fmtData(x.valida_ate)}</span>
                        {Number(x.copias_activas) > 0 && <Selo tom="aviso">{x.copias_activas} cópia{Number(x.copias_activas) === 1 ? '' : 's'} na mão</Selo>}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section>
                <TituloSeccao contagem={regime.documentos.length}>Documentos no regime</TituloSeccao>
                <div className={cn('overflow-x-auto rounded-xl border', T.linha, T.superficie)}>
                  <table className="w-full min-w-[52rem] border-collapse">
                    <caption className="sr-only">Documentos sujeitos ao regime do Instrutivo 32.039.001.A</caption>
                    <thead className={cn('sticky top-0 z-10 border-b text-left text-xs font-semibold uppercase tracking-wider',
                      'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400')}>
                      <tr>
                        <th scope="col" className="px-3 py-2">Documento</th>
                        <th scope="col" className="px-3 py-2">Aeroporto</th>
                        <th scope="col" className="px-3 py-2">Lista de páginas</th>
                        <th scope="col" className="px-3 py-2">Cópias</th>
                        <th scope="col" className="px-3 py-2">Última conferência</th>
                        <th scope="col" className="px-3 py-2">Guarda e controlo</th>
                      </tr>
                    </thead>
                    <tbody className={cn('divide-y', T.divisoria)}>
                      {regime.documentos.map(d => (
                        <tr key={d.documento_id} className={cn(T.realce, d.documento_id === documento?.documento_id && 'bg-teal-50 dark:bg-teal-950/40')}>
                          <td className="px-3 py-2 align-top text-sm">
                            <button type="button" onClick={() => { mudarParam('doc', d.documento_id); mudarParam('tab', 'lep'); }}
                              className={cn('text-left', T.foco)}>
                              <Ref className={cn('block font-semibold', T.acento)}>{d.numero || 'sem número'}</Ref>
                              <span className={cn('block max-w-prose', T.tinta)}>{d.titulo}</span>
                            </button>
                          </td>
                          <td className={cn('px-3 py-2 align-top text-sm', T.tintaMedia)}>{nomeAero(mapaAero, d.aeroporto_id)}</td>
                          <td className="px-3 py-2 align-top text-sm">
                            {d.lep_id ? (
                              <>
                                <span className={T.tintaMedia}>Rev. {d.lep_revisao} · {d.lep_paginas} págs.</span>
                                <span className={cn('block text-xs', T.tintaFraca)}>{fmtData(d.lep_emitida_em)}</span>
                              </>
                            ) : <Selo tom="aviso">Sem lista emitida</Selo>}
                          </td>
                          <td className="px-3 py-2 align-top text-sm">
                            <span className={T.tintaMedia}>{d.copias_activas} activa{d.copias_activas === 1 ? '' : 's'}</span>
                            {Number(d.copias_desactualizadas) > 0 && <Selo tom="aviso" className="ml-2">{d.copias_desactualizadas} atrasada{Number(d.copias_desactualizadas) === 1 ? '' : 's'}</Selo>}
                            {Number(d.copias_extraviadas) > 0 && <Selo tom="mau" className="ml-2">{d.copias_extraviadas} extraviada{Number(d.copias_extraviadas) === 1 ? '' : 's'}</Selo>}
                          </td>
                          <td className="px-3 py-2 align-top text-sm">
                            {d.ultimo_ciclo_id ? (
                              <>
                                <span className={T.tintaMedia}>{nomeSemestre(d.ultimo_ciclo_ano, d.ultimo_ciclo_semestre)}</span>
                                <span className={cn('block text-xs', d.ultimo_ciclo_fora_de_prazo ? T.vermelho : T.tintaFraca)}>
                                  {d.ultimo_ciclo_estado === 'fechado'
                                    ? `Fechado · ${d.ultimo_ciclo_conferidas} conferida${Number(d.ultimo_ciclo_conferidas) === 1 ? '' : 's'}${Number(d.ultimo_ciclo_nao_conferidas) ? `, ${d.ultimo_ciclo_nao_conferidas} não` : ''}`
                                    : `Aberto · ${d.ultimo_ciclo_pendentes} por conferir${d.ultimo_ciclo_fora_de_prazo ? ' (fora de prazo)' : ''}`}
                                </span>
                              </>
                            ) : <Selo tom="aviso">Nunca conferido</Selo>}
                          </td>
                          <td className="px-3 py-2 align-top text-sm">
                            {d.guarda_nome
                              ? <>
                                  <span className={T.tintaMedia}>{d.guarda_nome}</span>
                                  <span className={cn('block text-xs', d.anac_informada_em ? T.tintaFraca : T.ambar)}>
                                    {d.anac_informada_em ? `ANAC informada em ${fmtData(d.anac_informada_em)}` : 'ANAC por informar'}
                                  </span>
                                </>
                              : <Selo tom="aviso">Por designar</Selo>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </TabsContent>

        {/* ── separadores por documento ─────────────────────────────────── */}
        {['lep', 'copias', 'conferencia', 'regime'].map(chave => (
          <TabsContent key={chave} value={chave} className="mt-4 space-y-4">
            <EscolherDocumento
              documentos={regime.documentos}
              escolhido={documento}
              mapaAero={mapaAero}
              onEscolher={(id) => mudarParam('doc', id)}
            />
            {chave === 'lep' && <ListaPaginasEfectivas documento={documento} regime={regimeDocQ.data} podeEditar={podeGerir} />}
            {chave === 'copias' && <CopiasControladas documento={documento} regime={regimeDocQ.data} lepEmVigor={lepDoDoc} podeGerir={podeGerir} />}
            {chave === 'conferencia' && <CiclosConferencia documento={documento} regime={regimeDocQ.data} podeGerir={podeGerir} meuEmail={meuEmail} />}
            {chave === 'regime' && <FichaRegime documento={documento} regime={regimeDocQ.data} podeGerir={podeGerir} onGuardado={() => { regimeDocQ.refetch?.(); recarregar(); }} />}
          </TabsContent>
        ))}

        {/* ── credenciados (não é por documento) ────────────────────────── */}
        <TabsContent value="credenciados" className="mt-4">
          <RegistoCredenciados
            aeroportos={aeroportos}
            processos={processos}
            mesesValidadePadrao={regimeDocQ.data?.meses_validade_credencial ?? 24}
            podeGerir={podeGerir}
          />
        </TabsContent>
      </Tabs>

      {dialogo === 'candidatos' && (
        <DialogoCandidatos
          mapaAero={mapaAero}
          jaNoRegime={new Set(regime.documentos.map(d => d.documento_id))}
          onFechar={() => setDialogo(null)}
          onTrazido={(n) => { setDialogo(null); toast({ title: `${n} documento${n === 1 ? '' : 's'} no regime`, description: 'Designe o responsável pela guarda e controlo e emita a Lista de Páginas Efectivas.' }); recarregar(); }}
        />
      )}
    </PaginaGestao>
  );
}

// ── escolher o documento ────────────────────────────────────────────────────
// Um «select» e não uma lista lateral: são poucos documentos (os programas de segurança, não os seus anexos), e
// uma coluna fixa roubaria a largura de que as tabelas de páginas precisam.
function EscolherDocumento({ documentos, escolhido, mapaAero, onEscolher }) {
  if (!documentos.length) {
    return (
      <div className={cn('rounded-xl border', T.linha, T.superficie)}>
        <EstadoVazio
          icone={ShieldCheck}
          titulo="Nenhum documento no regime"
          texto="Use «Trazer documentos», na barra do topo, para escolher os programas de segurança a que este regime se aplica."
        />
      </div>
    );
  }
  return (
    <div className={cn('flex flex-wrap items-end gap-3 rounded-xl border p-3', T.linha, T.superficieFraca)}>
      <Campo id="avsec-doc" etiqueta="Documento" className="min-w-[18rem] flex-1">
        <Select
          value={escolhido?.documento_id || ''}
          onValueChange={onEscolher}
          placeholder="Escolha o programa"
          options={documentos.map(d => ({
            value: d.documento_id,
            label: `${d.numero || 'sem número'} — ${d.titulo || ''} (${nomeAero(mapaAero, d.aeroporto_id)})`,
          }))}
        />
      </Campo>
      {escolhido && (
        <div className="flex flex-wrap items-center gap-2">
          {escolhido.lep_revisao
            ? <Selo tom="bom">Lista em vigor: rev. {escolhido.lep_revisao}</Selo>
            : <Selo tom="aviso">Sem Lista de Páginas Efectivas</Selo>}
          <Selo tom="neutro">{escolhido.copias_activas} cópia{escolhido.copias_activas === 1 ? '' : 's'} distribuída{escolhido.copias_activas === 1 ? '' : 's'}</Selo>
          {escolhido.classificado && <Selo tom="frio" titulo={`Classificado ao abrigo do n.º 3, alínea ${String(escolhido.classificacao_categoria || '').replace(/^3\./, '')}, do Instrutivo 32.009.001.A`}>Matéria classificada</Selo>}
        </div>
      )}
    </div>
  );
}

// ── guarda e controlo do programa ───────────────────────────────────────────
// Secção XIV, n.º 1: o operador «deve designar e informar à Autoridade Nacional da Aviação Civil registando no
// programa de segurança o responsável pela guarda e controlo do programa, fornecendo o seu nome completo, número
// de telefone, fax e correio electrónico». São exactamente esses quatro campos — incluindo o fax, que já não se
// usa mas que a lei continua a pedir, e por isso está aqui em vez de ser omitido por bom gosto.
function FichaRegime({ documento, regime, podeGerir, onGuardado }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const categoriasQ = useCategoriasClassificacao();
  const categorias = useMemo(() => (Array.isArray(categoriasQ.data) ? categoriasQ.data : []), [categoriasQ.data]);
  const [f, setF] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => { setF(regime ? { ...regime } : null); }, [regime]);

  if (!documento) return null;
  if (!f) return <EsqueletoLinhas linhas={5} />;

  const categoria = categorias.find(x => x.codigo === documento.classificacao_categoria) || null;

  const gravar = async () => {
    setOcupado(true);
    try {
      await guardarRegimeAvsec(documento.documento_id, f, user);
      toast({ title: 'Guarda e controlo guardado' });
      onGuardado?.();
    } catch (e) { toast({ variant: 'destructive', title: 'Não foi possível guardar', description: e.message }); }
    finally { setOcupado(false); }
  };

  const mudarClassificacao = async (codigo) => {
    setOcupado(true);
    try {
      await classificarDocumento(documento.documento_id, codigo || null, user);
      toast({ title: codigo ? 'Classificação registada' : 'Classificação retirada' });
      onGuardado?.();
    } catch (e) { toast({ variant: 'destructive', title: 'Não foi possível classificar', description: e.message }); }
    finally { setOcupado(false); }
  };

  return (
    <div className="space-y-5">
      <Lei fonte="Instrutivo 32.039.001.A (Despacho n.º 4442/25), secção XIV, n.º 1">
        O operador deve «designar e informar à Autoridade Nacional da Aviação Civil registando no programa de
        segurança o responsável pela guarda e controlo do programa, fornecendo o seu nome completo, número de
        telefone, fax e correio electrónico».
      </Lei>

      <section>
        <TituloSeccao>Classificação da informação</TituloSeccao>
        <div className={cn('space-y-3 rounded-xl border p-3 sm:p-4', T.linha, T.superficie)}>
          <p className={cn('max-w-prose text-sm', T.tintaFraca)}>
            O Instrutivo 32.009.001.A não tem uma escala de níveis: tem uma lista de categorias. Escolha a alínea
            ao abrigo da qual este documento é matéria classificada — é ela que obriga a distribuição em cópia
            controlada e a credenciação dos detentores.
          </p>
          <Campo id="regime-cat" etiqueta="Categoria de matéria classificada" className="max-w-xl">
            <Select
              value={documento.classificacao_categoria || ''}
              onValueChange={mudarClassificacao}
              placeholder="Não classificado"
              options={[{ value: '', label: 'Não classificado' },
                ...categorias.map(x => ({ value: x.codigo, label: `${x.codigo} — ${x.designacao}` }))]}
            />
          </Campo>
          {categoria && (
            <blockquote className={cn('max-w-prose border-l-2 pl-3 text-sm italic', T.linha, T.tintaMedia)}>
              «{categoria.texto_lei}»
              <footer className={cn('mt-1 not-italic text-xs', T.tintaFraca)}>{categoria.fonte}</footer>
            </blockquote>
          )}
        </div>
      </section>

      <section>
        <TituloSeccao>Responsável pela guarda e controlo</TituloSeccao>
        <div className={cn('space-y-4 rounded-xl border p-3 sm:p-4', T.linha, T.superficie)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="g-nome" etiqueta="Nome completo" obrigatorio>
              <Input value={f.guarda_nome || ''} onChange={(e) => setF({ ...f, guarda_nome: e.target.value })} className="h-11" disabled={!podeGerir} />
            </Campo>
            <Campo id="g-email" etiqueta="Correio electrónico" obrigatorio>
              <Input type="email" value={f.guarda_email || ''} onChange={(e) => setF({ ...f, guarda_email: e.target.value })} className="h-11" disabled={!podeGerir} />
            </Campo>
            <Campo id="g-tel" etiqueta="Telefone" obrigatorio>
              <Input value={f.guarda_telefone || ''} onChange={(e) => setF({ ...f, guarda_telefone: e.target.value })} className="h-11" disabled={!podeGerir} />
            </Campo>
            <Campo id="g-fax" etiqueta="Fax" ajuda="A lei continua a pedir o fax. Em branco, se não houver.">
              <Input value={f.guarda_fax || ''} onChange={(e) => setF({ ...f, guarda_fax: e.target.value })} className="h-11" disabled={!podeGerir} />
            </Campo>
            <Campo id="g-anac" etiqueta="ANAC informada em" ajuda="A designação não basta: tem de ser comunicada à ANAC e registada no programa.">
              <Input type="date" value={String(f.anac_informada_em || '').slice(0, 10)} onChange={(e) => setF({ ...f, anac_informada_em: e.target.value })} className="h-11" disabled={!podeGerir} />
            </Campo>
            <Campo id="g-local" etiqueta="Local reservado de guarda" ajuda="Secção XIV, n.º 2, alínea c): local reservado com acesso controlado.">
              <Input value={f.local_guarda || ''} onChange={(e) => setF({ ...f, local_guarda: e.target.value })} className="h-11" disabled={!podeGerir} />
            </Campo>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Campo id="g-vol" etiqueta="Volume">
              <Input value={f.volume || ''} onChange={(e) => setF({ ...f, volume: e.target.value })} className="h-11" disabled={!podeGerir} />
            </Campo>
            <Campo id="g-vol-tit" etiqueta="Título do volume" className="sm:col-span-2">
              <Input value={f.volume_titulo || ''} onChange={(e) => setF({ ...f, volume_titulo: e.target.value })} className="h-11" disabled={!podeGerir} />
            </Campo>
          </div>
        </div>
      </section>

      <section>
        <TituloSeccao>Prazos e limiares do regime</TituloSeccao>
        <div className={cn('space-y-4 rounded-xl border p-3 sm:p-4', T.linha, T.superficie)}>
          <p className={cn('max-w-prose text-sm', T.tintaFraca)}>
            Vêm da lei e só se mexem se a ANAC autorizar outro período: 45 dias para submeter a revisão
            (secção XI, n.º 1), 45 para a ANAC responder (n.º 2), republicação total acima de 40% de texto
            alterado (n.º 8), revisão total anual (n.º 11) e conferência semestral (secção XIV, n.º 2, alínea i)).
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Campo id="p-sub" etiqueta="Submissão (dias)">
              <Input type="number" min="1" value={f.prazo_submissao_dias ?? 45} onChange={(e) => setF({ ...f, prazo_submissao_dias: e.target.value })} className="h-11" disabled={!podeGerir} />
            </Campo>
            <Campo id="p-resp" etiqueta="Resposta da ANAC (dias)">
              <Input type="number" min="1" value={f.prazo_resposta_dias ?? 45} onChange={(e) => setF({ ...f, prazo_resposta_dias: e.target.value })} className="h-11" disabled={!podeGerir} />
            </Campo>
            <Campo id="p-rep" etiqueta="Republicação total (% de texto)">
              <Input type="number" min="1" max="100" value={f.limiar_republicacao_pct ?? 40} onChange={(e) => setF({ ...f, limiar_republicacao_pct: e.target.value })} className="h-11" disabled={!podeGerir} />
            </Campo>
            <Campo id="p-conf" etiqueta="Conferência (meses)">
              <Input type="number" min="1" value={f.meses_conferencia ?? 6} onChange={(e) => setF({ ...f, meses_conferencia: e.target.value })} className="h-11" disabled={!podeGerir} />
            </Campo>
            <Campo id="p-rev" etiqueta="Revisão total (meses)">
              <Input type="number" min="1" value={f.meses_revisao_total ?? 12} onChange={(e) => setF({ ...f, meses_revisao_total: e.target.value })} className="h-11" disabled={!podeGerir} />
            </Campo>
            <Campo id="p-cred" etiqueta="Validade da credenciação (meses)"
              ajuda="Pressuposto nosso: a lei não fixa validade à credenciação de quem detém cópia. Em branco = sem termo.">
              <Input type="number" min="1" value={f.meses_validade_credencial ?? ''} onChange={(e) => setF({ ...f, meses_validade_credencial: e.target.value })} className="h-11" disabled={!podeGerir} />
            </Campo>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="p-rev-ult" etiqueta="Última revisão total" ajuda="A secção XI, n.º 11, manda revê-lo todo uma vez por ano.">
              <Input type="date" value={String(f.revisao_total_ultima || '').slice(0, 10)} onChange={(e) => setF({ ...f, revisao_total_ultima: e.target.value })} className="h-11" disabled={!podeGerir} />
            </Campo>
            {documento.revisao_total_proxima && (
              <div className="flex items-end">
                <p className={cn('text-sm', new Date(documento.revisao_total_proxima) < new Date() ? T.vermelho : T.tintaFraca)}>
                  Próxima revisão total: {fmtData(documento.revisao_total_proxima)}
                  {new Date(documento.revisao_total_proxima) < new Date() && ' — em atraso'}
                </p>
              </div>
            )}
          </div>
          <Campo id="p-nota" etiqueta="Nota">
            <Textarea rows={2} value={f.nota || ''} onChange={(e) => setF({ ...f, nota: e.target.value })} disabled={!podeGerir} />
          </Campo>
          {podeGerir && (
            <div className="flex justify-end">
              <Button className="h-11" disabled={ocupado} onClick={gravar}>
                {ocupado && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}Guardar
              </Button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

// ── trazer documentos para o regime ─────────────────────────────────────────
// Mostra os documentos cuja numeração os liga à segurança da aviação. A migração 158 trouxe só os programas
// (classe PR) de propósito: uma ficha de registo não tem Lista de Páginas Efectivas nem se confere página a
// página, e metê-la no regime bloquearia a sua distribuição a quem não estivesse credenciado. O resto decide-se
// aqui, um a um, por quem sabe.
function DialogoCandidatos({ mapaAero, jaNoRegime, onFechar, onTrazido }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const candidatosQ = useCandidatosAvsec();
  const categoriasQ = useCategoriasClassificacao();
  const categorias = useMemo(() => (Array.isArray(categoriasQ.data) ? categoriasQ.data : []), [categoriasQ.data]);
  const [escolhidos, setEscolhidos] = useState(() => new Set());
  const [categoria, setCategoria] = useState('3.b');
  const [ocupado, setOcupado] = useState(false);

  const candidatos = useMemo(
    () => (Array.isArray(candidatosQ.data) ? candidatosQ.data : []).filter(d => !jaNoRegime.has(d.id)),
    [candidatosQ.data, jaNoRegime],
  );

  const alternar = (id) => setEscolhidos(s => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const trazer = async () => {
    setOcupado(true);
    let n = 0;
    try {
      for (const id of escolhidos) {
        await guardarRegimeAvsec(id, {}, user);
        if (categoria) await classificarDocumento(id, categoria, user);
        n += 1;
      }
      onTrazido(n);
    } catch (e) {
      toast({ variant: 'destructive', title: n ? `${n} trazido(s), e depois falhou` : 'Não foi possível', description: e.message });
    } finally { setOcupado(false); }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Trazer documentos para o regime AVSEC</DialogTitle>
          <DialogDescription>
            Escolha os volumes a que se aplicam a Lista de Páginas Efectivas, a conferência semestral e as cópias
            controladas. Um documento no regime passa a ser distribuível só a credenciados — não traga fichas de
            registo nem plantas soltas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Campo id="cand-cat" etiqueta="Classificar como" className="max-w-xl"
            ajuda="Os programas de segurança aeroportuários são a alínea 3.b do Instrutivo 32.009.001.A. Escolha «não classificar» se este documento não é, ele próprio, matéria classificada.">
            <Select value={categoria} onValueChange={setCategoria}
              options={[{ value: '', label: 'Não classificar' }, ...categorias.map(x => ({ value: x.codigo, label: `${x.codigo} — ${x.designacao}` }))]} />
          </Campo>

          {candidatosQ.isLoading ? <EsqueletoLinhas linhas={5} /> : !candidatos.length ? (
            <EstadoVazio icone={FileText} titulo="Não há mais candidatos"
              texto="Todos os documentos com «PSA» ou «AVSE» na numeração já estão no regime. Para trazer outro, classifique-o primeiro na sua ficha." />
          ) : (
            <div className={cn('max-h-80 overflow-auto rounded-lg border', T.linha)}>
              <ul className={cn('divide-y', T.divisoria)}>
                {candidatos.map(d => (
                  <li key={d.id}>
                    <label className={cn('flex cursor-pointer items-start gap-3 px-3 py-2', T.realce)}>
                      <input
                        type="checkbox"
                        checked={escolhidos.has(d.id)}
                        onChange={() => alternar(d.id)}
                        className={cn('mt-1 h-5 w-5 shrink-0 rounded border-slate-400 text-teal-700', T.foco)}
                      />
                      <span className="min-w-0">
                        <Ref className={cn('block font-semibold', T.acento)}>{d.numero || 'sem número'}</Ref>
                        <span className={cn('block text-sm', T.tinta)}>{d.titulo}</span>
                        <span className={cn('block text-xs', T.tintaFraca)}>
                          {[nomeAero(mapaAero, d.aeroporto_id), d.classe_codigo, d.processo_codigo].filter(Boolean).join(' · ')}
                          {d.classificacao_categoria ? ` · já classificado (${d.classificacao_categoria})` : ''}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" className="h-11" onClick={onFechar}>Cancelar</Button>
          <Button className="h-11" disabled={ocupado || !escolhidos.size} onClick={trazer}>
            {ocupado && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Trazer {escolhidos.size || ''} documento{escolhidos.size === 1 ? '' : 's'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
