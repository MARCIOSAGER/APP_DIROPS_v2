// As três etapas do percurso, pela ordem em que acontecem: elaboração → revisão → aprovação.
//
// Para que serve: responder de um relance a «em que pé está isto, e de quem se está à espera». É a mesma
// pergunta que os seis estados do fluxo respondem, mas aqui vista do lado das PESSOAS — porque é assim que quem
// trabalha com o documento pensa nele («falta o director», não «está em aguarda_aprovacao»).
//
// Cada etapa mostra o estado próprio e, quando já foi assinada NESTA volta, quem assinou e quando. Uma etapa
// assinada numa volta anterior aparece dita por palavras («assinada na 1.ª volta; a devolução abriu volta nova»)
// em vez de aparecer como feita: o que vale é a assinatura desta volta, e esconder a diferença seria dizer que o
// documento já passou por onde não passou.
import React from 'react';
import { Check, Clock, MinusCircle, RotateCcw, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { T } from '../../PortalLayout';
import { papelRotulo } from '../../apiFluxo';
import { horaAngola } from './SeloAssinatura';

const ORDEM = ['elaboracao', 'revisao', 'aprovacao'];

// Quem é que pratica cada acto neste fluxo. O director aparece pelo endereço nomeado; quem assina pode ser o
// suplente, e nesse caso é a assinatura que o diz — aqui mostra-se quem está encarregado, não quem apareceu.
const encarregado = (fluxo, acto) => {
  if (acto === 'elaboracao') return fluxo?.elaborador_email || '';
  if (acto === 'revisao') return fluxo?.revisor_email || '';
  return fluxo?.director_email || '';
};

// Estado de cada etapa. «parado» é o estado da etapa que está à espera; «futuro» é o que ainda não chegou a
// ninguém; «devolvido» marca a etapa a quem o documento voltou.
function estadoEtapa(fluxo, acto, assinaturaDestaVolta) {
  if (!fluxo) return 'futuro';
  if (assinaturaDestaVolta) return 'feito';
  if (fluxo.estado === 'cancelado') return 'cancelado';
  if (fluxo.estado === 'devolvido') {
    const alvo = fluxo.devolvido_para === 'revisor' ? 'revisao' : 'elaboracao';
    if (acto === alvo) return 'devolvido';
    return ORDEM.indexOf(acto) < ORDEM.indexOf(alvo) ? 'feito_antes' : 'futuro';
  }
  const pendente = fluxo.estado === 'rascunho' ? 'elaboracao'
    : fluxo.estado === 'aguarda_revisao' ? 'revisao'
      : fluxo.estado === 'aguarda_aprovacao' ? 'aprovacao' : null;
  if (!pendente) return 'feito_antes';
  if (acto === pendente) return 'parado';
  return ORDEM.indexOf(acto) < ORDEM.indexOf(pendente) ? 'feito_antes' : 'futuro';
}

const VISUAL = {
  feito: { icone: Check, anel: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200', tinta: T.tinta },
  feito_antes: { icone: Check, anel: 'border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300', tinta: T.tintaMedia },
  parado: { icone: Clock, anel: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200', tinta: T.tinta },
  devolvido: { icone: RotateCcw, anel: 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/60 dark:text-red-200', tinta: T.tinta },
  futuro: { icone: User, anel: cn('border-slate-200 bg-white text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500'), tinta: T.tintaFraca },
  cancelado: { icone: MinusCircle, anel: 'border-slate-300 bg-slate-200/70 text-slate-500 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-400', tinta: T.tintaFraca },
};

function Etapa({ rotulo, papel, quem, estado, assinatura, anterior, eu, ultima }) {
  const v = VISUAL[estado] || VISUAL.futuro;
  const Icone = v.icone;
  const souEu = quem && eu && quem.toLowerCase() === String(eu).toLowerCase();
  const legenda = estado === 'feito'
    ? `Assinado por ${assinatura?.nome || assinatura?.signatario_email || quem} · ${horaAngola(assinatura?.assinado_em)}`
    : estado === 'parado'
      ? (souEu ? 'À espera da sua assinatura' : 'À espera de assinatura')
      : estado === 'devolvido'
        ? 'Devolvido a esta etapa, com motivo'
        : estado === 'cancelado'
          ? 'Fluxo cancelado antes desta etapa'
          : estado === 'feito_antes'
            ? (anterior ? `Assinado na ${anterior.ronda}.ª volta; a devolução abriu volta nova` : 'Cumprido numa volta anterior')
            : 'Ainda não chegou a esta etapa';

  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full border', v.anel)} aria-hidden="true">
          <Icone className="h-4 w-4" />
        </span>
        {!ultima && <span className={cn('mt-1 w-px flex-1 border-l', T.linha)} aria-hidden="true" />}
      </div>
      <div className={cn('min-w-0 flex-1', ultima ? 'pb-0' : 'pb-4')}>
        <p className={cn('font-medium', v.tinta)}>
          {rotulo}
          <span className={cn('ml-2 text-sm font-normal', T.tintaFraca)}>{papelRotulo(papel)}</span>
        </p>
        <p className={cn('mt-0.5 truncate text-sm', T.tintaMedia)}>
          {quem || <span className="italic">por indicar</span>}
          {souEu && <span className={cn('ml-1.5', T.acento)}>(você)</span>}
        </p>
        <p className={cn('mt-0.5 text-sm', estado === 'parado' ? cn('font-medium', T.ambar) : estado === 'devolvido' ? T.vermelho : T.tintaFraca)}>
          {legenda}
        </p>
        {estado === 'feito' && assinatura?.em_substituicao_de && (
          <p className={cn('mt-0.5 text-sm', T.tintaFraca)}>Em substituição de {assinatura.em_substituicao_de}.</p>
        )}
      </div>
    </li>
  );
}

// `assinaturas` são as deste fluxo (todas as voltas); `actos` é o vocabulário vindo da base, para o rótulo de
// cada etapa ser o mesmo que está no botão.
export default function CartaoEtapa({ fluxo, assinaturas = [], actos, eu, className }) {
  const ronda = Number(fluxo?.ronda) || 1;
  const porActo = new Map();
  const antesPorActo = new Map();
  for (const a of assinaturas) {
    if ((Number(a.ronda) || 1) === ronda) porActo.set(a.acto, a);
    else antesPorActo.set(a.acto, a);
  }
  const rotuloDe = (c) => actos?.get?.(c)?.rotulo || { elaboracao: 'Elaborar e submeter', revisao: 'Revisto', aprovacao: 'Aprovar' }[c];
  const papelDe = (c) => actos?.get?.(c)?.papel || { elaboracao: 'elaborador', revisao: 'revisor', aprovacao: 'director_aeroporto' }[c];

  return (
    <ol className={cn('space-y-0', className)} aria-label="Etapas do fluxo de aprovação">
      {ORDEM.map((acto, i) => (
        <Etapa
          key={acto}
          rotulo={rotuloDe(acto)}
          papel={papelDe(acto)}
          quem={encarregado(fluxo, acto)}
          estado={estadoEtapa(fluxo, acto, porActo.get(acto))}
          assinatura={porActo.get(acto)}
          anterior={antesPorActo.get(acto)}
          eu={eu}
          ultima={i === ORDEM.length - 1}
        />
      ))}
    </ol>
  );
}
