// Registo de pessoas credenciadas a possuir cópia de documentos classificados (migração 158).
//
// A lei, textualmente — Instrutivo 32.039.001.A (Despacho n.º 4442/25), secção XIV, n.º 2:
//   alínea d) «Manter actualizado o registo dos empregados da empresa e de outras pessoas credenciadas a possuir
//             cópia dos programas»;
//   alínea e) «Disponibilizar cópias dos programas apenas para os credenciados citados na alínea anterior, bem
//             como apresentação por ocasião de inspecção»;
//   alínea j) «Garantir que o programa seja manuseado somente por pessoas credenciadas pela empresa e que estejam
//             devidamente autorizadas pelo responsável da empresa»;
//   alínea b) a distribuição respeita «o princípio da necessidade de conhecimento».
// E o Instrutivo 32.009.001.A (Despacho n.º 4450/25), n.º 4, alínea b): quem recebe matéria classificada fica
// «vinculado ao dever de sigilo».
//
// O que isso obriga, e que este ecrã serve:
//   • um registo NOMINAL, que inclui gente de fora da SGA («outras pessoas», alínea d)) e por isso não se limita
//     a quem tem conta no portal;
//   • QUEM AUTORIZOU, por nome — a alínea j) não aceita «o sistema deixou»;
//   • a NECESSIDADE DE CONHECIMENTO escrita, porque é o critério da alínea b) e é a primeira pergunta de uma
//     auditoria sobre uma credencial;
//   • o ÂMBITO: uma credencial pode valer para um aeroporto e para um programa, e não para tudo. É a tradução da
//     necessidade de conhecimento numa regra que o servidor sabe ler.
//
// Duas coisas que este ecrã NÃO faz, de propósito:
//   1. NÃO APAGA. Uma credencial termina por revogação, com motivo escrito, ou por caducidade. Saber quem podia
//      ter tido uma cópia há dois anos é metade de uma investigação de fuga.
//   2. NÃO DECIDE SE A ENTREGA PODE SER FEITA. Quem recusa entregar cópia a quem não está credenciado é o
//      servidor, por gatilho. Este ecrã mostra o estado; não é ele que guarda a porta.
import React, { useCallback, useMemo, useState } from 'react';
import {
  Ban, CalendarX2, Download, FileSignature, Loader2, Pencil, Plus, Printer, Search, ShieldCheck, ShieldOff, UserPlus,
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
import { fmtData } from '@/lib/safeDate';
import { T, MONO, EstadoVazio, EstadoErro, EsqueletoLinhas, TituloSeccao } from '../../PortalLayout';
import { useCredenciados, useFormandosAvsecElegiveis, useRecarregarAvsec, estadoCredencial, credencialUtil, ROTULO_ESTADO_CREDENCIAL } from '../../hooksAvsec';
import { guardarCredencial, revogarCredencial, registarSigilo } from '../../apiAvsec';
import { Campo, Conta, Lei, Selo, TOM_CREDENCIAL, TD, TH, THEAD } from './pecas';
import { pdfRegistoCredenciados, descarregarCsv, COLUNAS_CREDENCIADOS, celulasCredenciado } from './pdfAvsec';

const hojeIso = () => new Date().toISOString().slice(0, 10);
const VAZIA = {
  email: '', nome: '', cargo: '', entidade: '', interno: true, aeroporto_id: '', processo_codigo: '',
  credenciado_em: hojeIso(), valida_ate: '', autorizado_por: '', autorizado_cargo: '', necessidade_saber: '', nota: '',
};

// Validade por omissão: a lei NÃO fixa prazo para a credenciação de detentores de cópia (os prazos de credenciais
// do Apêndice são dos cartões de acesso às áreas restritas, outra coisa). 24 meses é escolha da SGA, afinável por
// documento no separador do regime — e a coluna aceita «sem termo».
const mesesAdiante = (meses) => {
  if (!Number.isFinite(Number(meses))) return '';
  const d = new Date();
  d.setMonth(d.getMonth() + Number(meses));
  return d.toISOString().slice(0, 10);
};

export default function RegistoCredenciados({ aeroportos = [], processos = [], mesesValidadePadrao = 24, podeGerir }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const recarregar = useRecarregarAvsec();
  const credQ = useCredenciados();
  const credenciados = useMemo(() => (Array.isArray(credQ.data) ? credQ.data : []), [credQ.data]);
  const elegQ = useFormandosAvsecElegiveis();
  const elegiveis = useMemo(() => (Array.isArray(elegQ.data) ? elegQ.data : []), [elegQ.data]);

  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('todos');  // todos | activo | caducado | revogado | sem_sigilo
  const [dialogo, setDialogo] = useState(null);

  const falhar = useCallback((e) => toast({ variant: 'destructive', title: 'Não foi possível', description: e?.message || 'Erro desconhecido.' }), [toast]);
  const feito = useCallback((titulo, description) => { toast({ title: titulo, description }); recarregar(); }, [toast, recarregar]);

  const nomeAeroporto = useCallback((id) => {
    const a = aeroportos.find(x => x.id === id);
    return a ? (a.codigo_icao || a.nome) : 'Todos';
  }, [aeroportos]);

  const contagens = useMemo(() => ({
    activas: credenciados.filter(credencialUtil).length,
    caducadas: credenciados.filter(c => estadoCredencial(c) === 'caducado').length,
    revogadas: credenciados.filter(c => estadoCredencial(c) === 'revogado').length,
    semSigilo: credenciados.filter(c => credencialUtil(c) && !c.sigilo_aceite_em).length,
  }), [credenciados]);

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return credenciados.filter(c => {
      const e = estadoCredencial(c);
      if (filtro === 'activo' && e !== 'activo') return false;
      if (filtro === 'caducado' && e !== 'caducado') return false;
      if (filtro === 'revogado' && e !== 'revogado') return false;
      if (filtro === 'sem_sigilo' && (!credencialUtil(c) || c.sigilo_aceite_em)) return false;
      if (!q) return true;
      return [c.nome, c.email, c.cargo, c.entidade, c.necessidade_saber, c.autorizado_por]
        .some(v => String(v || '').toLowerCase().includes(q));
    });
  }, [credenciados, busca, filtro]);

  const geradoPor = user?.full_name || user?.email || '';
  const imprimir = useCallback(async () => {
    try {
      await pdfRegistoCredenciados({
        credenciados: visiveis,
        filtros: [
          filtro === 'todos' ? 'Todas as credenciais' : `Filtro: ${ROTULO_ESTADO_CREDENCIAL[filtro] || filtro}`,
          busca.trim() ? `Procura: «${busca.trim()}»` : null,
        ].filter(Boolean),
        nomeAeroporto, geradoPor,
      });
    } catch (e) { falhar(e); }
  }, [visiveis, filtro, busca, nomeAeroporto, geradoPor, falhar]);

  if (credQ.isError) return <EstadoErro onTentar={() => credQ.refetch()} />;

  return (
    <div className="space-y-5">
      <Lei fonte="Instrutivo 32.039.001.A (Despacho n.º 4442/25), secção XIV, n.º 2, alíneas d), e) e j)">
        O responsável pela guarda e controlo deve «manter actualizado o registo dos empregados da empresa e de
        outras pessoas credenciadas a possuir cópia dos programas», «disponibilizar cópias dos programas apenas
        para os credenciados» e «garantir que o programa seja manuseado somente por pessoas credenciadas pela
        empresa e que estejam devidamente autorizadas pelo responsável da empresa».
      </Lei>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Conta valor={contagens.activas} label="credenciais válidas" onClick={() => setFiltro(filtro === 'activo' ? 'todos' : 'activo')} activo={filtro === 'activo'} />
        <Conta valor={contagens.caducadas} label="caducadas" tom={contagens.caducadas ? 'mau' : 'neutro'}
          onClick={() => setFiltro(filtro === 'caducado' ? 'todos' : 'caducado')} activo={filtro === 'caducado'} />
        <Conta valor={contagens.semSigilo} label="sem dever de sigilo registado" tom={contagens.semSigilo ? 'aviso' : 'neutro'}
          onClick={() => setFiltro(filtro === 'sem_sigilo' ? 'todos' : 'sem_sigilo')} activo={filtro === 'sem_sigilo'} />
        <Conta valor={contagens.revogadas} label="revogadas" onClick={() => setFiltro(filtro === 'revogado' ? 'todos' : 'revogado')} activo={filtro === 'revogado'} />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="relative min-w-[16rem] flex-1">
          <Search className={cn('pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2', T.tintaFraca)} aria-hidden="true" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Procurar por nome, cargo, entidade ou fundamento"
            aria-label="Procurar no registo de credenciados"
            className="h-11 pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {podeGerir && (
            <Button className="h-11" onClick={() => setDialogo({ credencial: { ...VAZIA, valida_ate: mesesAdiante(mesesValidadePadrao) } })}>
              <UserPlus className="h-4 w-4" aria-hidden="true" />Credenciar
            </Button>
          )}
          <Button variant="outline" className="h-11" disabled={!visiveis.length} onClick={imprimir}>
            <Printer className="h-4 w-4" aria-hidden="true" />PDF
          </Button>
          <Button variant="outline" className="h-11" disabled={!visiveis.length}
            onClick={() => descarregarCsv('Registo_de_credenciados', COLUNAS_CREDENCIADOS, visiveis.map(c => celulasCredenciado(c, { nomeAeroporto })))}>
            <Download className="h-4 w-4" aria-hidden="true" />CSV
          </Button>
        </div>
      </div>

      {podeGerir && elegiveis.length > 0 && (
        <section className={cn('rounded-xl border p-3', T.borda, 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/30')}>
          <TituloSeccao contagem={elegiveis.length}>Formação AVSEC concluída — a aguardar credenciamento</TituloSeccao>
          <p className={cn('mb-2 text-sm', T.tintaMedia)}>Estas pessoas concluíram a Formação AVSEC na Universidade e ainda não têm credencial activa. Confirme e credencie quem deve possuir cópia dos programas.</p>
          <ul className="space-y-1.5">
            {elegiveis.map((f) => (
              <li key={f.email} className={cn('flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-white/70 px-3 py-2 dark:bg-slate-900/40', T.borda)}>
                <span className="min-w-0">
                  <span className={cn('block truncate font-medium', T.tinta)}>{f.nome || f.email}</span>
                  <span className={cn('block truncate text-xs', T.tintaFraca)}>{f.email}{f.emitido_em ? ` · formação concluída em ${fmtData(f.emitido_em)}` : ''}</span>
                </span>
                <Button size="sm" onClick={() => setDialogo({ credencial: { ...VAZIA, nome: f.nome || '', email: f.email, necessidade_saber: 'Concluiu a Formação AVSEC (Formação Inicial) na Universidade Corporativa.', valida_ate: mesesAdiante(mesesValidadePadrao) } })}>
                  <UserPlus className="h-4 w-4" aria-hidden="true" />Credenciar
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <TituloSeccao contagem={visiveis.length}>Credenciados</TituloSeccao>
        <div className={cn('overflow-x-auto rounded-xl border', T.linha, T.superficie)}>
          {credQ.isLoading ? <EsqueletoLinhas linhas={6} /> : !visiveis.length ? (
            <EstadoVazio
              icone={ShieldCheck}
              titulo={credenciados.length ? 'Nenhuma credencial corresponde ao filtro' : 'Ainda não há ninguém credenciado'}
              texto={credenciados.length
                ? 'Limpe a procura ou escolha outro filtro.'
                : 'Enquanto este registo estiver vazio, nenhuma cópia de documento classificado pode ser entregue — o servidor recusa a entrega a quem não está credenciado.'}
            >
              {podeGerir && !credenciados.length && (
                <Button className="h-11" onClick={() => setDialogo({ credencial: { ...VAZIA, valida_ate: mesesAdiante(mesesValidadePadrao) } })}>
                  <UserPlus className="h-4 w-4" aria-hidden="true" />Credenciar a primeira pessoa
                </Button>
              )}
            </EstadoVazio>
          ) : (
            <table className="w-full min-w-[56rem] border-collapse">
              <caption className="sr-only">Pessoas credenciadas a possuir cópia de documentos classificados</caption>
              <thead className={THEAD}>
                <tr>
                  <th scope="col" className={TH}>Pessoa</th>
                  <th scope="col" className={TH}>Âmbito</th>
                  <th scope="col" className={TH}>Validade</th>
                  <th scope="col" className={TH}>Autorizada por</th>
                  <th scope="col" className={TH}>Cópias</th>
                  <th scope="col" className={TH}>Estado</th>
                  {podeGerir && <th scope="col" className={cn(TH, 'text-right')}>Acções</th>}
                </tr>
              </thead>
              <tbody className={cn('divide-y', T.divisoria)}>
                {visiveis.map(c => {
                  const estado = estadoCredencial(c);
                  const dias = c.dias_para_caducar;
                  return (
                    <tr key={c.id} className={T.realce}>
                      <td className={TD}>
                        <span className={cn('block font-medium', T.tinta)}>{c.nome}</span>
                        <span className={cn('block text-xs', T.tintaFraca)}>
                          {[c.cargo, c.entidade || (c.interno ? 'SGA' : null), c.email].filter(Boolean).join(' · ')}
                        </span>
                        {c.necessidade_saber && <span className={cn('mt-1 block max-w-prose text-xs italic', T.tintaFraca)}>{c.necessidade_saber}</span>}
                      </td>
                      <td className={cn(TD, T.tintaMedia)}>
                        <span className="block">{c.aeroporto_icao || nomeAeroporto(c.aeroporto_id)}</span>
                        <span className={cn('block text-xs', T.tintaFraca)}>{c.processo_nome || c.processo_codigo || 'Todos os documentos classificados'}</span>
                      </td>
                      <td className={TD}>
                        <span className={cn('block text-sm', T.tintaMedia)}>{c.valida_ate ? fmtData(c.valida_ate) : 'Sem termo'}</span>
                        {estado === 'activo' && Number.isFinite(dias) && dias !== null && dias <= 60 && (
                          <span className={cn('block text-xs', dias <= 0 ? T.vermelho : T.ambar)}>
                            {dias <= 0 ? 'Caduca hoje' : `Caduca em ${dias} dia${dias === 1 ? '' : 's'}`}
                          </span>
                        )}
                        <span className={cn('block text-xs', T.tintaFraca)}>Desde {fmtData(c.credenciado_em)}</span>
                      </td>
                      <td className={cn(TD, T.tintaMedia)}>
                        <span className="block text-sm">{c.autorizado_por}</span>
                        {c.autorizado_cargo && <span className={cn('block text-xs', T.tintaFraca)}>{c.autorizado_cargo}</span>}
                      </td>
                      <td className={cn(TD, 'tabular-nums')} style={MONO}>{c.copias_activas ?? 0}</td>
                      <td className={TD}>
                        <Selo tom={TOM_CREDENCIAL[estado] || 'neutro'}>{ROTULO_ESTADO_CREDENCIAL[estado] || estado}</Selo>
                        {c.sigilo_aceite_em
                          ? <span className={cn('mt-1 block text-xs', T.verde)}>Sigilo registado em {fmtData(c.sigilo_aceite_em)}</span>
                          : credencialUtil(c) && <span className={cn('mt-1 block text-xs', T.ambar)}>Dever de sigilo por registar</span>}
                        {estado === 'revogado' && c.revogacao_motivo && (
                          <span className={cn('mt-1 block max-w-prose text-xs', T.tintaFraca)}>{c.revogacao_motivo}</span>
                        )}
                      </td>
                      {podeGerir && (
                        <td className={cn(TD, 'text-right whitespace-nowrap')}>
                          {estado !== 'revogado' && (
                            <>
                              <Button variant="ghost" size="sm" className="h-9" onClick={() => setDialogo({ credencial: { ...c } })}>
                                <Pencil className="h-4 w-4" aria-hidden="true" /><span className="sr-only">Alterar a credencial de {c.nome}</span>
                              </Button>
                              {!c.sigilo_aceite_em && (
                                <Button variant="ghost" size="sm" className="h-9" onClick={() => setDialogo({ sigilo: c })}>
                                  <FileSignature className="h-4 w-4" aria-hidden="true" /><span className="sr-only">Registar o dever de sigilo de {c.nome}</span>
                                </Button>
                              )}
                              <Button variant="ghost" size="sm" className={cn('h-9', T.vermelho)} onClick={() => setDialogo({ revogar: c })}>
                                <Ban className="h-4 w-4" aria-hidden="true" /><span className="sr-only">Revogar a credencial de {c.nome}</span>
                              </Button>
                            </>
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

      {dialogo?.credencial && (
        <DialogoCredencial
          credencial={dialogo.credencial}
          aeroportos={aeroportos}
          processos={processos}
          mesesValidadePadrao={mesesValidadePadrao}
          onFechar={() => setDialogo(null)}
          onGuardado={() => { setDialogo(null); feito('Credencial guardada'); }}
        />
      )}
      {dialogo?.revogar && (
        <DialogoRevogar
          credencial={dialogo.revogar}
          onFechar={() => setDialogo(null)}
          onRevogado={(copias) => {
            setDialogo(null);
            feito('Credencial revogada', copias > 0
              ? `Atenção: esta pessoa continua com ${copias} cópia${copias === 1 ? '' : 's'} controlada${copias === 1 ? '' : 's'} na mão. Recolha-a${copias === 1 ? '' : 's'} e registe a devolução.`
              : 'Esta pessoa não tem cópias controladas em seu poder.');
          }}
        />
      )}
      {dialogo?.sigilo && (
        <DialogoSigilo credencial={dialogo.sigilo} onFechar={() => setDialogo(null)}
          onGuardado={() => { setDialogo(null); feito('Dever de sigilo registado'); }} />
      )}
    </div>
  );
}

// ── credenciar / alterar ───────────────────────────────────────────────────
function DialogoCredencial({ credencial, aeroportos, processos, mesesValidadePadrao, onFechar, onGuardado }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [f, setF] = useState({ ...VAZIA, ...credencial, aeroporto_id: credencial.aeroporto_id || '', processo_codigo: credencial.processo_codigo || '' });
  const [ocupado, setOcupado] = useState(false);
  const novo = !credencial.id;

  const gravar = async () => {
    setOcupado(true);
    try { await guardarCredencial({ ...f, aeroporto_id: f.aeroporto_id || null, processo_codigo: f.processo_codigo || null }, user); onGuardado(); }
    catch (e) { toast({ variant: 'destructive', title: 'Não foi possível guardar', description: e.message }); }
    finally { setOcupado(false); }
  };

  const opcoesAeroporto = [{ value: '', label: 'Todos os aeroportos' },
    ...aeroportos.filter(a => a.ativo !== false).map(a => ({ value: a.id, label: a.codigo_icao ? `${a.codigo_icao} · ${a.nome}` : a.nome }))];
  const opcoesProcesso = [{ value: '', label: 'Todos os documentos classificados' },
    ...processos.filter(p => p.ativo !== false).map(p => ({ value: p.codigo, label: p.nome ? `${p.codigo} · ${p.nome}` : p.codigo }))];

  return (
    <Dialog open onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{novo ? 'Credenciar uma pessoa' : `Credencial de ${credencial.nome}`}</DialogTitle>
          <DialogDescription>
            Quem fica credenciado pode receber cópia controlada dos documentos classificados do âmbito escolhido.
            Fora desse âmbito, o servidor recusa a entrega.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="cred-nome" etiqueta="Nome completo" obrigatorio ajuda="A alínea d) pede um registo nominal.">
              <Input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} className="h-11" />
            </Campo>
            <Campo id="cred-email" etiqueta="Correio electrónico" obrigatorio ajuda="É por aqui que o servidor liga a credencial às cópias entregues.">
              <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className="h-11" disabled={!novo} />
            </Campo>
            <Campo id="cred-cargo" etiqueta="Cargo">
              <Input value={f.cargo || ''} onChange={(e) => setF({ ...f, cargo: e.target.value })} className="h-11" />
            </Campo>
            <Campo id="cred-entidade" etiqueta="Entidade" ajuda="Em branco para pessoal da SGA.">
              <Input value={f.entidade || ''} onChange={(e) => setF({ ...f, entidade: e.target.value })} className="h-11" />
            </Campo>
          </div>

          <label htmlFor="cred-interno" className={cn('flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2', T.linha)}>
            <Checkbox id="cred-interno" checked={f.interno !== false} onCheckedChange={(v) => setF({ ...f, interno: !!v })} className="mt-1 h-5 w-5" />
            <span className={cn('text-sm', T.tintaMedia)}>
              É empregado da SGA. A alínea d) distingue «os empregados da empresa» de «outras pessoas»: desmarque
              para alguém de fora (ANAC, auditor, operador).
            </span>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="cred-aero" etiqueta="Aeroporto" ajuda="O âmbito da credencial. «Todos» só para quem tem de conhecer os programas de todos os aeroportos.">
              <Select value={f.aeroporto_id} onValueChange={(v) => setF({ ...f, aeroporto_id: v })} options={opcoesAeroporto} />
            </Campo>
            <Campo id="cred-proc" etiqueta="Programa ou manual" ajuda="Restringe a credencial a um programa (por exemplo, só o PSA).">
              <Select value={f.processo_codigo} onValueChange={(v) => setF({ ...f, processo_codigo: v })} options={opcoesProcesso} />
            </Campo>
            <Campo id="cred-desde" etiqueta="Credenciada desde" obrigatorio>
              <Input type="date" value={String(f.credenciado_em || '').slice(0, 10)} onChange={(e) => setF({ ...f, credenciado_em: e.target.value })} className="h-11" />
            </Campo>
            <Campo id="cred-ate" etiqueta="Válida até"
              ajuda={`A lei não fixa validade à credenciação de quem detém cópia — o prazo é escolha da SGA (predefinição: ${mesesValidadePadrao ? `${mesesValidadePadrao} meses` : 'sem termo'}). Deixe em branco para sem termo.`}>
              <Input type="date" value={String(f.valida_ate || '').slice(0, 10)} onChange={(e) => setF({ ...f, valida_ate: e.target.value })} className="h-11" />
            </Campo>
            <Campo id="cred-autor" etiqueta="Autorizada por" obrigatorio ajuda="Nome do responsável da empresa que autorizou (alínea j)).">
              <Input value={f.autorizado_por || ''} onChange={(e) => setF({ ...f, autorizado_por: e.target.value })} className="h-11" />
            </Campo>
            <Campo id="cred-autor-cargo" etiqueta="Cargo de quem autorizou">
              <Input value={f.autorizado_cargo || ''} onChange={(e) => setF({ ...f, autorizado_cargo: e.target.value })} className="h-11" />
            </Campo>
          </div>

          <Campo id="cred-necess" etiqueta="Necessidade de conhecimento" obrigatorio
            ajuda="Porque é que esta pessoa precisa de ter o documento. É o critério da alínea b), e é a primeira pergunta de uma auditoria sobre uma credencial.">
            <Textarea rows={3} value={f.necessidade_saber || ''} onChange={(e) => setF({ ...f, necessidade_saber: e.target.value })} />
          </Campo>
          <Campo id="cred-nota" etiqueta="Nota">
            <Textarea rows={2} value={f.nota || ''} onChange={(e) => setF({ ...f, nota: e.target.value })} />
          </Campo>
        </div>

        <DialogFooter>
          <Button variant="outline" className="h-11" onClick={onFechar}>Cancelar</Button>
          <Button className="h-11" disabled={ocupado} onClick={gravar}>
            {ocupado && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {novo ? <Plus className="h-4 w-4" aria-hidden="true" /> : null}{novo ? 'Credenciar' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── revogar ────────────────────────────────────────────────────────────────
function DialogoRevogar({ credencial, onFechar, onRevogado }) {
  const { toast } = useToast();
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const copias = Number(credencial.copias_activas || 0);
  const revogar = async () => {
    setOcupado(true);
    try { onRevogado(await revogarCredencial(credencial.id, motivo)); }
    catch (e) { toast({ variant: 'destructive', title: 'Não foi possível revogar', description: e.message }); }
    finally { setOcupado(false); }
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Revogar a credencial de {credencial.nome}</DialogTitle>
          <DialogDescription>
            A credencial não é apagada: fica no registo, com o motivo e a data. Saber quem podia ter tido uma cópia
            é metade de uma investigação de fuga.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {copias > 0 && (
            <p className={cn('flex items-start gap-2 rounded-lg border px-3 py-2 text-sm', T.linha, T.vermelho)}>
              <CalendarX2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Esta pessoa tem {copias} cópia{copias === 1 ? '' : 's'} controlada{copias === 1 ? '' : 's'} em seu poder.
              Revogar a credencial não as recolhe: registe a devolução de cada uma no separador das cópias.
            </p>
          )}
          <Campo id="rev-motivo" etiqueta="Motivo da revogação" obrigatorio ajuda="Sem motivo escrito, a revogação não se explica numa auditoria — e o servidor recusa-a.">
            <Textarea rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Saiu da empresa; mudou de funções; deixou de ter necessidade de conhecer…" />
          </Campo>
        </div>
        <DialogFooter>
          <Button variant="outline" className="h-11" onClick={onFechar}>Cancelar</Button>
          <Button variant="destructive" className="h-11" disabled={ocupado || !motivo.trim()} onClick={revogar}>
            {ocupado && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            <ShieldOff className="h-4 w-4" aria-hidden="true" />Revogar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── dever de sigilo ────────────────────────────────────────────────────────
function DialogoSigilo({ credencial, onFechar, onGuardado }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [nota, setNota] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const gravar = async () => {
    setOcupado(true);
    try { await registarSigilo(credencial.id, nota, user); onGuardado(); }
    catch (e) { toast({ variant: 'destructive', title: 'Não foi possível registar', description: e.message }); }
    finally { setOcupado(false); }
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registar o dever de sigilo</DialogTitle>
          <DialogDescription>
            O Instrutivo 32.009.001.A (Despacho n.º 4450/25), n.º 4, alínea b), vincula ao dever de sigilo as
            entidades a quem é distribuída matéria classificada. Aqui regista-se a data em que isso ficou
            documentado — não é uma assinatura electrónica, que o portal não tem.
          </DialogDescription>
        </DialogHeader>
        <Campo id="sigilo-nota" etiqueta="Como ficou documentado" ajuda="Por exemplo: termo de responsabilidade assinado em papel, arquivado no processo individual.">
          <Textarea rows={3} value={nota} onChange={(e) => setNota(e.target.value)} />
        </Campo>
        <DialogFooter>
          <Button variant="outline" className="h-11" onClick={onFechar}>Cancelar</Button>
          <Button className="h-11" disabled={ocupado} onClick={gravar}>
            {ocupado && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            <FileSignature className="h-4 w-4" aria-hidden="true" />Registar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
