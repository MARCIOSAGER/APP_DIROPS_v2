// «Que requisitos legais é que este documento cumpre?» — o outro bloco da ficha do documento (migração 159).
//
// É a pergunta ao contrário da matriz: a matriz vai do requisito ao parágrafo, e aqui vê-se, parado num
// documento, a que é que ele responde. Serve duas conversas diferentes: a de quem vai rever o documento (não
// pode apagar o parágrafo 4.3.2 sem saber que é ele que cumpre o Anexo 3) e a de quem recebe a ANAC.
//
// O estado que importa é a prova registada contra uma revisão anterior: uma prova que remete para a página 47
// da revisão 3 não serve quando o documento já vai na revisão 4. Essa fica marcada e tem um botão só para ela.
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ExternalLink, Loader2, RefreshCw, ScrollText, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import { fmtData } from '@/lib/safeDate';
import { PORTAL_BASE } from '@/lib/portalDocumentos';
import { tk, cartao, versaoDoc, pessoaDeEmail, Vazio, Falha, Esqueleto } from '../../pages/PortalBiblioteca';
import { useProvasDoDocumento, useRecarregarConformidade, reconfirmarProva } from '../../hooksConformidade';
import { Artigo, ReferenciaProva, SeloGrau, SeloCritico, SeloReconfirmar } from './comuns';

const urlMatriz = (diploma, requisito) => {
  const p = new URLSearchParams();
  if (diploma) p.set('diploma', diploma);
  if (requisito) p.set('requisito', requisito);
  const q = p.toString();
  return `${PORTAL_BASE}/gestao/conformidade${q ? `?${q}` : ''}`;
};

function LinhaProva({ p, versaoActual, podeMexer, aoRecarregar }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [aGravar, setAGravar] = useState(false);
  const r = p.conformidade_requisito || {};
  const velha = Number(p.versao || 0) < Number(versaoActual || 1) && p.grau !== 'nao_aplicavel';

  const reconfirmar = async () => {
    setAGravar(true);
    try {
      await reconfirmarProva(p, versaoActual, user);
      toast({ title: 'Prova reconfirmada', description: `Passa a valer para a revisão v${versaoActual}.` });
      aoRecarregar?.();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Não foi possível reconfirmar', description: e?.message });
    } finally {
      setAGravar(false);
    }
  };

  return (
    <li className={cn('px-4 py-3', velha && tk.avisoFundo)}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <Artigo valor={r.artigo} />
            <span className={cn('min-w-0 font-medium', tk.tinta)}>{r.titulo || 'Requisito'}</span>
            <SeloCritico criticidade={r.criticidade} />
          </p>
          <p className={cn('mt-1 text-sm', tk.tintaFraca)}>{r.diploma_codigo}</p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <SeloGrau grau={p.grau} />
            <ReferenciaProva prova={p} />
            <span className={cn('text-sm', tk.tintaFraca)}>
              registada na revisão <span className="tabular-nums">v{p.versao ?? '—'}</span>
              {p.verificado_em ? ` · reconfirmada em ${fmtData(p.verificado_em)}` : ''}
              {p.verificado_por ? ` por ${pessoaDeEmail(p.verificado_por)}` : ''}
            </span>
            {velha && <SeloReconfirmar />}
          </p>
          {p.citacao && (
            <blockquote className={cn('mt-2 border-l-2 pl-3 text-sm italic', tk.acentoBorda, tk.tintaMedia)}>
              “{p.citacao}”
            </blockquote>
          )}
          {p.nota && <p className={cn('mt-1.5 text-sm', tk.tintaMedia)}>{p.nota}</p>}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {podeMexer && velha && (
            <Button size="sm" variant="default" onClick={reconfirmar} disabled={aGravar}>
              {aGravar ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
              Continua lá
            </Button>
          )}
          <Button size="sm" variant="ghost" asChild>
            <Link to={urlMatriz(r.diploma_codigo, r.id)}>
              <ExternalLink className="h-4 w-4" aria-hidden="true" />Ver na matriz
            </Link>
          </Button>
        </div>
      </div>
    </li>
  );
}

export default function RequisitosDoDocumento({ documento, podeMexer = false, className }) {
  const q = useProvasDoDocumento(documento?.id);
  const recarregar = useRecarregarConformidade();
  const versaoActual = Number(versaoDoc(documento)) || 1;

  const provas = q.data || [];
  const velhas = useMemo(
    () => provas.filter(p => Number(p.versao || 0) < versaoActual && p.grau !== 'nao_aplicavel').length,
    [provas, versaoActual],
  );

  return (
    <section className={cn(cartao, 'overflow-hidden', className)} aria-labelledby="gd-requisitos-titulo">
      <div className={cn('flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3', tk.borda)}>
        <h2 id="gd-requisitos-titulo" className={cn('flex items-center gap-2 text-sm font-semibold', tk.tinta)}>
          <ShieldCheck className={cn('h-4 w-4', tk.acento)} aria-hidden="true" />
          Requisitos que este documento cumpre
          {provas.length > 0 && <span className={cn('font-normal tabular-nums', tk.tintaFraca)}>{provas.length}</span>}
        </h2>
        <Button size="sm" variant="ghost" asChild>
          <Link to={urlMatriz()}><ScrollText className="h-4 w-4" aria-hidden="true" />Matriz de conformidade</Link>
        </Button>
      </div>

      {velhas > 0 && (
        <p className={cn('flex items-start gap-2 border-b px-4 py-2.5 text-sm', tk.borda, tk.avisoFundo, tk.tintaMedia)}>
          <AlertTriangle className={cn('mt-0.5 h-4 w-4 shrink-0', tk.aviso)} aria-hidden="true" />
          {velhas === 1
            ? 'Uma prova aponta para uma revisão anterior deste documento: confirme que o parágrafo continua lá.'
            : `${velhas} provas apontam para revisões anteriores deste documento: confirme que os parágrafos continuam lá.`}
        </p>
      )}

      {q.isLoading ? (
        <Esqueleto linhas={2} />
      ) : q.isError ? (
        <Falha
          titulo="Não foi possível carregar os requisitos"
          texto={q.error?.message || 'Tente de novo; se continuar, avise a gestão do portal.'}
          onTentar={() => q.refetch?.()}
          className="py-10"
        />
      ) : provas.length === 0 ? (
        <Vazio
          icone={ShieldCheck}
          titulo="Nenhum requisito aponta para este documento"
          texto="Quando a ANAC pergunta onde está o que cumpre um parágrafo, a resposta sai da matriz de conformidade. Apontar os requisitos a este documento é o que torna essa resposta imediata — e é o que evita que uma revisão apague, sem se dar por isso, o parágrafo que cumpria a norma."
          className="py-10"
        >
          <Button variant="outline" asChild>
            <Link to={urlMatriz()}><ScrollText className="h-4 w-4" aria-hidden="true" />Abrir a matriz</Link>
          </Button>
        </Vazio>
      ) : (
        <ul className={cn('divide-y', tk.divisoria)}>
          {provas.map(p => (
            <LinhaProva key={p.id} p={p} versaoActual={versaoActual} podeMexer={podeMexer} aoRecarregar={recarregar} />
          ))}
        </ul>
      )}
    </section>
  );
}
