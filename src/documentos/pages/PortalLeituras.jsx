// «As minhas leituras» — lista de trabalho, não relatório. Abre no que falta confirmar, pela ordem em que
// aperta: primeiro o que tem prazo e está atrasado, depois o que tem prazo a chegar, depois o resto.
// Conta como pendente qualquer documento em vigor a que a pessoa tenha acesso, marcado como «exige leitura», e
// cuja versão actual ainda não tenha confirmado (incluindo os que mudaram de versão depois da confirmação anterior).
// O prazo sai de `leitura_prazo_dias` contado desde a entrada em vigor da versão — só aparece quando existe.
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, CheckCircle2, ChevronRight, FileCheck2, Library, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { fmtData } from '@/lib/safeDate';
import { useAuth } from '@/lib/AuthContext';
import { PORTAL_BASE, estadoPublicado } from '@/lib/portalDocumentos';
import { useDocumentosDocs, useMinhasLeituras, useAeroportosDocs } from '../hooks';
import {
  tk, cartao, Vazio, Falha, EsqueletoTabela, mapaPorId, rotuloAero, versaoDoc, emVigorDesde,
  pedeConfirmacao, urlDoc, EstadoChip,
} from './PortalBiblioteca';

const DIA = 86400000;

// Prazo de confirmação: dias a contar da entrada em vigor. Devolve null quando o documento não impõe prazo.
function prazoDe(doc) {
  const dias = Number(doc?.leitura_prazo_dias);
  const inicio = emVigorDesde(doc) || doc?.created_date;
  if (!Number.isFinite(dias) || dias <= 0 || !inicio) return null;
  const base = new Date(inicio);
  if (Number.isNaN(base.getTime())) return null;
  const limite = new Date(base.getTime() + dias * DIA);
  return { limite, restam: Math.ceil((limite - new Date()) / DIA) };
}

function textoPrazo(prazo) {
  if (!prazo) return null;
  const { restam } = prazo;
  if (restam < 0) { const d = Math.abs(restam); return { texto: `Atrasado há ${d} ${d === 1 ? 'dia' : 'dias'}`, grave: true }; }
  if (restam === 0) return { texto: 'Prazo acaba hoje', grave: true };
  return { texto: `Faltam ${restam} ${restam === 1 ? 'dia' : 'dias'}`, grave: restam <= 3 };
}

// Linha de trabalho: o que é, porque está aqui, e até quando. Alvo de toque generoso — isto usa-se em pista.
function LinhaTrabalho({ doc, aeroportos, nota, prazo, confirmada }) {
  const p = textoPrazo(prazo);
  const aero = rotuloAero(aeroportos, doc.aeroporto_id);
  return (
    <li>
      <Link to={urlDoc(doc.id)} className={cn('flex min-h-[4rem] items-center gap-3 px-4 py-3', tk.hover, tk.foco)}>
        <span className="min-w-0 flex-1">
          <span className={cn('block truncate font-medium leading-tight', tk.tinta)}>{doc.titulo}</span>
          <span className={cn('mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm leading-tight', tk.tintaFraca)}>
            {doc.numero && <span className={tk.mono}>{doc.numero}</span>}
            <span className={tk.mono}>v{versaoDoc(doc)}</span>
            {aero && <span>{aero}</span>}
          </span>
          <span className="mt-1.5 flex flex-wrap items-center gap-2">
            {p && (
              <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold',
                p.grave ? cn(tk.perigoBorda, tk.perigoFundo, tk.perigo) : cn(tk.avisoBorda, tk.avisoFundo, tk.aviso))}>
                {p.texto} · até {fmtData(prazo.limite)}
              </span>
            )}
            {nota && <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium', tk.avisoBorda, tk.avisoFundo, tk.aviso)}>{nota}</span>}
            {confirmada && (
              <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium', tk.borda, tk.bomFundo, tk.bom)}>
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                {fmtData(confirmada.lido_em)}{confirmada.versao ? ` · v${confirmada.versao}` : ''}
              </span>
            )}
            {!estadoPublicado(doc.estado) && <EstadoChip estado={doc.estado} />}
          </span>
        </span>
        <span className={cn('shrink-0 text-sm font-medium', tk.acento)}>
          <span className="hidden sm:inline">{confirmada ? 'Rever' : 'Ler e confirmar'}</span>
          <ChevronRight className="inline h-5 w-5" aria-hidden="true" />
        </span>
      </Link>
    </li>
  );
}

export default function PortalLeituras() {
  const { user } = useAuth();
  const [aba, setAba] = useState('pendentes');
  const docsQ = useDocumentosDocs({ limite: 1000 });
  const leiturasQ = useMinhasLeituras(user?.email);
  const aeroQ = useAeroportosDocs();

  const mapaAero = useMemo(() => mapaPorId(aeroQ.data), [aeroQ.data]);
  const docs = docsQ.data || [];
  const leituras = leiturasQ.data || [];

  const aCarregar = docsQ.isLoading || leiturasQ.isLoading;
  const falhou = docsQ.isError;
  const recarregar = () => { docsQ.refetch?.(); leiturasQ.refetch?.(); };

  // leituras por documento, da mais recente para a mais antiga
  const porDocumento = useMemo(() => {
    const m = new Map();
    for (const l of leituras) {
      if (!m.has(l.documento_id)) m.set(l.documento_id, []);
      m.get(l.documento_id).push(l);
    }
    for (const lista of m.values()) lista.sort((a, b) => String(b.lido_em || '').localeCompare(String(a.lido_em || '')));
    return m;
  }, [leituras]);

  const { pendentes, confirmados } = useMemo(() => {
    const confirmacaoDe = (doc) => {
      const lista = porDocumento.get(doc.id) || [];
      if (!lista.length) return null;
      const v = String(versaoDoc(doc));
      // confirmação da versão em uso; se as leituras antigas não guardaram versão, vale a mais recente
      return lista.find(l => String(l.versao ?? '') === v) || (lista.every(l => !l.versao) ? lista[0] : null);
    };
    const pend = []; const conf = [];
    for (const d of docs) {
      const pedido = pedeConfirmacao(d, user);
      const lista = porDocumento.get(d.id) || [];
      const actual = confirmacaoDe(d);
      if (actual) conf.push({ doc: d, leitura: actual, desactualizada: false });
      else if (lista.length) {
        conf.push({ doc: d, leitura: lista[0], desactualizada: true });
        if (pedido && estadoPublicado(d.estado)) pend.push({ doc: d, novaVersao: true, prazo: prazoDe(d) });
      } else if (pedido && estadoPublicado(d.estado)) pend.push({ doc: d, novaVersao: false, prazo: prazoDe(d) });
    }
    conf.sort((a, b) => String(b.leitura.lido_em || '').localeCompare(String(a.leitura.lido_em || '')));
    // Ordem de trabalho: primeiro o que tem prazo (o mais apertado à frente), depois o resto por título.
    pend.sort((a, b) => {
      const ra = a.prazo ? a.prazo.restam : Number.MAX_SAFE_INTEGER;
      const rb = b.prazo ? b.prazo.restam : Number.MAX_SAFE_INTEGER;
      if (ra !== rb) return ra - rb;
      return String(a.doc.titulo || '').localeCompare(String(b.doc.titulo || ''), 'pt');
    });
    return { pendentes: pend, confirmados: conf };
  }, [docs, porDocumento, user]);

  const atrasados = pendentes.filter(p => p.prazo && p.prazo.restam < 0).length;
  const comPrazo = pendentes.filter(p => p.prazo && p.prazo.restam >= 0).length;
  const total = pendentes.length;

  // Uma linha de texto em vez de um indicador a zero: a página diz o que há para fazer, não quantos existem.
  const resumo = total === 0
    ? 'Não tem leituras por confirmar.'
    : atrasados > 0
      ? `${total === 1 ? '1 documento' : `${total} documentos`} por confirmar, ${atrasados === 1 ? '1 fora de prazo' : `${atrasados} fora de prazo`}.`
      : comPrazo > 0
        ? `${total === 1 ? '1 documento' : `${total} documentos`} por confirmar, ${comPrazo === 1 ? '1 com prazo a correr' : `${comPrazo} com prazo a correr`}.`
        : `${total === 1 ? '1 documento' : `${total} documentos`} por confirmar, nenhum com prazo marcado.`;

  return (
    <div className="space-y-5">
      <header>
        <h1 className={cn('text-2xl font-bold tracking-tight', tk.tinta)}>As minhas leituras</h1>
        <p className={cn('mt-1 text-sm', tk.tintaFraca)}>
          {aCarregar ? 'A ver o que falta confirmar…' : resumo}
          {!aCarregar && confirmados.length > 0 && ` Já confirmou ${confirmados.length === 1 ? '1 documento' : `${confirmados.length} documentos`}.`}
        </p>
      </header>

      {falhou ? (
        <div className={cartao}><Falha titulo="Não foi possível ver as suas leituras" texto="A lista de documentos não chegou. Tente de novo; se continuar, avise a gestão documental." onTentar={recarregar} /></div>
      ) : aCarregar ? (
        <div className={cartao}><EsqueletoTabela linhas={5} altura={64} cabecalho={false} /></div>
      ) : total === 0 && confirmados.length === 0 ? (
        <div className={cartao}>
          <Vazio icone={ListChecks} titulo="Ainda não há leituras a seu cargo" texto="Esta lista enche-se quando a gestão documental publicar um documento que exija confirmação de leitura dos seus aeroportos. Até lá, pode consultar tudo na Biblioteca.">
            <Button asChild variant="outline"><Link to={`${PORTAL_BASE}/biblioteca`}><Library className="h-4 w-4" aria-hidden="true" />Ir para a Biblioteca</Link></Button>
          </Vazio>
        </div>
      ) : (
        <Tabs value={aba} onValueChange={setAba}>
          <TabsList>
            <TabsTrigger value="pendentes">Por confirmar ({pendentes.length})</TabsTrigger>
            <TabsTrigger value="feitas">Já confirmadas ({confirmados.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="pendentes" className="mt-4">
            {pendentes.length === 0 ? (
              <div className={cartao}>
                <Vazio icone={BadgeCheck} titulo="Está tudo confirmado" texto="Não tem nada por confirmar. Quando sair um documento novo, ou uma versão nova de um que já leu, ele aparece aqui.">
                  <Button asChild variant="outline"><Link to={`${PORTAL_BASE}/biblioteca`}><Library className="h-4 w-4" aria-hidden="true" />Ver a Biblioteca</Link></Button>
                </Vazio>
              </div>
            ) : (
              <ul className={cn(cartao, 'divide-y overflow-hidden', tk.divisoria)}>
                {pendentes.map(({ doc, novaVersao, prazo }) => (
                  <LinhaTrabalho
                    key={doc.id}
                    doc={doc}
                    aeroportos={mapaAero}
                    prazo={prazo}
                    nota={novaVersao ? 'Versão nova desde a sua confirmação' : null}
                  />
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="feitas" className="mt-4">
            {confirmados.length === 0 ? (
              <div className={cartao}>
                <Vazio icone={FileCheck2} titulo="Ainda não confirmou nenhuma leitura" texto="Abra um documento, leia-o e use o botão «Li e tomei conhecimento». A data e a versão ficam registadas aqui." />
              </div>
            ) : (
              <ul className={cn(cartao, 'divide-y overflow-hidden', tk.divisoria)}>
                {confirmados.map(({ doc, leitura, desactualizada }) => (
                  <LinhaTrabalho
                    key={`${doc.id}-${leitura.lido_em}`}
                    doc={doc}
                    aeroportos={mapaAero}
                    confirmada={leitura}
                    nota={desactualizada ? 'Saiu uma versão nova depois disto' : null}
                  />
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
