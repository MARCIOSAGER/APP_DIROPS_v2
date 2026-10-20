// Peças pequenas partilhadas pelos quatro ecrãs do regime AVSEC. Existem para que o selo de uma credencial
// caducada e o selo de uma cópia extraviada não sejam desenhados duas vezes com cores ligeiramente diferentes —
// é assim que um produto passa a ter dois dialectos de cor.
//
// Regra que atravessa tudo: COR E TEXTO, SEMPRE OS DOIS. Nenhum estado se distingue só pela cor (e ao sol, numa
// placa de pista, o contraste efectivo cai para perto de 2:1, pelo que a cor sozinha não se vê).
import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { T } from '../../PortalLayout';

// ── selos ───────────────────────────────────────────────────────────────────
// A mesma paleta do `EstadoSelo` dos documentos: verde = vale, âmbar = atenção, vermelho = problema,
// cinzento = facto sem alarme (uma credencial revogada não é um erro, é uma decisão).
export const TOM = {
  bom: 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200',
  aviso: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200',
  mau: 'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/60 dark:text-red-200',
  neutro: 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
  frio: 'border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-200',
};

export function Selo({ tom = 'neutro', children, className, titulo }) {
  return (
    <span title={titulo} className={cn(
      'inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-sm font-medium leading-5',
      TOM[tom] || TOM.neutro, className,
    )}>
      {children}
    </span>
  );
}

export const TOM_CREDENCIAL = { activo: 'bom', caducado: 'mau', suspenso: 'aviso', revogado: 'neutro' };
export const TOM_COPIA = { activa: 'bom', devolvida: 'neutro', extraviada: 'mau', destruida: 'neutro' };
export const TOM_LEP = { emitida: 'bom', rascunho: 'neutro', substituida: 'neutro' };
export const TOM_CICLO = { aberto: 'frio', fechado: 'neutro', cancelado: 'neutro' };
export const TOM_ITEM = { pendente: 'aviso', conferida: 'bom', nao_conferida: 'mau' };
export const TOM_ACCAO_PAGINA = { original: 'neutro', inserida: 'frio', actualizada: 'aviso', cancelada: 'mau' };

// ── campo de formulário ─────────────────────────────────────────────────────
// A etiqueta é sempre ligada ao campo (`htmlFor`), e a ajuda fica por baixo em texto, não num ícone que só se vê
// ao passar o rato — o regime AVSEC pede coisas que ninguém adivinha, e a explicação não pode estar escondida.
export function Campo({ id, etiqueta, ajuda, obrigatorio, children, className }) {
  const idAjuda = ajuda ? `${id}-ajuda` : undefined;
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id} className={cn('text-sm font-medium', T.tintaMedia)}>
        {etiqueta}
        {obrigatorio && <span className={cn('ml-1', T.vermelho)} aria-hidden="true">*</span>}
        {obrigatorio && <span className="sr-only"> (obrigatório)</span>}
      </Label>
      {React.isValidElement(children) ? React.cloneElement(children, { id, 'aria-describedby': idAjuda }) : children}
      {ajuda && <p id={idAjuda} className={cn('text-xs leading-snug', T.tintaFraca)}>{ajuda}</p>}
    </div>
  );
}

// ── citação da lei ──────────────────────────────────────────────────────────
// O texto da norma, onde a decisão se toma. A alternativa é a pessoa ir ao Diário da República a meio de preencher
// um formulário, o que significa que não vai.
export function Lei({ children, fonte, className }) {
  return (
    <div className={cn('flex gap-2 rounded-lg border px-3 py-2', T.linha, T.superficieFraca, className)}>
      <Info className={cn('mt-0.5 h-4 w-4 shrink-0', T.acento)} aria-hidden="true" />
      <div className="min-w-0 space-y-0.5">
        <p className={cn('text-sm leading-snug', T.tintaMedia)}>{children}</p>
        {fonte && <p className={cn('text-xs', T.tintaFraca)}>{fonte}</p>}
      </div>
    </div>
  );
}

// Aviso de largura total. No portal há UM só, e está reservado à versão substituída; aqui usa-se o mesmo desenho
// para a única coisa deste regime que merece esse peso: uma cópia classificada em poder de quem não está
// credenciado. Tudo o mais é selo ou texto.
export function AvisoGrave({ titulo, children, accao, className }) {
  return (
    <div role="alert" className={cn('flex flex-wrap items-start gap-3 rounded-xl border-l-4 border-l-red-600 border-y border-r px-4 py-3',
      'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/50', className)}>
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-700 dark:text-red-300" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-red-900 dark:text-red-100">{titulo}</p>
        <div className="mt-0.5 max-w-prose text-sm text-red-800 dark:text-red-200">{children}</div>
      </div>
      {accao && <div className="shrink-0">{accao}</div>}
    </div>
  );
}

// ── números em destaque ─────────────────────────────────────────────────────
// Um número só, grande, com a palavra ao lado. Clicável quando há para onde ir: um número que conta um problema
// e não leva a lado nenhum obriga a pessoa a ir procurar à mão.
export function Conta({ valor, label, tom = 'neutro', onClick, activo, className }) {
  const corpo = (
    <>
      <span className="text-2xl font-bold tabular-nums leading-none">{valor}</span>
      <span className={cn('text-sm leading-snug', T.tintaFraca)}>{label}</span>
    </>
  );
  const base = cn('flex min-h-[4.5rem] flex-col justify-center gap-1 rounded-xl border px-3 py-2 text-left',
    activo ? 'border-teal-600 ring-1 ring-teal-600 dark:border-teal-400 dark:ring-teal-400' : T.linha,
    tom === 'mau' ? 'bg-red-50 dark:bg-red-950/40' : tom === 'aviso' ? 'bg-amber-50 dark:bg-amber-950/40' : T.superficie,
    className);
  if (!onClick) return <div className={base}>{corpo}</div>;
  return (
    <button type="button" onClick={onClick} aria-pressed={!!activo} className={cn(base, T.realce, T.foco)}>{corpo}</button>
  );
}

// Cabeçalho de tabela denso, fixo ao rolar. Sem zebra: as linhas distinguem-se pela divisória, que é mais calma
// numa tabela de 200 páginas.
export const THEAD = cn('sticky top-0 z-10 border-b text-left text-xs font-semibold uppercase tracking-wider',
  'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400');
export const TD = 'px-3 py-2 align-top text-sm';
export const TH = 'px-3 py-2';
