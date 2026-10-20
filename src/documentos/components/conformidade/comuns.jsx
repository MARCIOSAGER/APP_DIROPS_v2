// Vocabulário visual das duas pontes (migração 159): selos, barra de cobertura e a referência de uma prova.
// Tudo o que aqui está é usado pela matriz, pela ficha do documento e pelo painel da formação — uma só peça por
// ideia, para o portal não ter dois dialectos para a mesma coisa.
//
// Regras seguidas (docs/desenho-portal-documentos.md): cor **e** texto, sempre os dois; vocabulário fechado;
// nenhuma cor escrita à mão (tudo por `tk`); referências em monoespaçado com algarismos tabulares; e a barra de
// cobertura é lida por um leitor de ecrã como texto, não como decoração.
import React from 'react';
import { AlertTriangle, CheckCircle2, CircleDashed, CircleSlash, Clock, MinusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { tk } from '../../pages/PortalBiblioteca';

// Os cinco tons do portal, já com a variante escura. Não há mais nenhum: o que não é bom, aviso ou perigo é neutro.
const TOM = {
  neutro: 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
  bom: 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200',
  aviso: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200',
  perigo: 'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/60 dark:text-red-200',
  acento: 'border-teal-300 bg-teal-50 text-teal-900 dark:border-teal-800 dark:bg-teal-950/60 dark:text-teal-100',
};

export function Selo({ tom = 'neutro', icone: Icone, children, titulo, className }) {
  return (
    <span
      title={titulo}
      className={cn('inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-sm font-medium leading-5',
        TOM[tom] || TOM.neutro, className)}
    >
      {Icone && <Icone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}{children}
    </span>
  );
}

// ── estado de cobertura de um requisito ─────────────────────────────────────
// O buraco é vermelho e diz-se por extenso: «Sem nada a apontar». É a única frase que um inspector precisa de
// ouvir uma vez para a organização nunca mais a querer ver.
const COBERTURA = {
  descoberto:    { label: 'Sem nada a apontar', tom: 'perigo',  icone: CircleSlash,
                   titulo: 'Nenhum documento aponta para este requisito.' },
  planeado:      { label: 'Planeado',           tom: 'aviso',   icone: Clock,
                   titulo: 'Está decidido onde vai ficar, mas ainda não está escrito.' },
  parcial:       { label: 'Coberto em parte',   tom: 'aviso',   icone: CircleDashed,
                   titulo: 'Há resposta, mas cobre só parte do requisito.' },
  coberto:       { label: 'Coberto',            tom: 'bom',     icone: CheckCircle2,
                   titulo: 'Há um parágrafo de um documento que cumpre este requisito.' },
  nao_aplicavel: { label: 'Não aplicável',      tom: 'neutro',  icone: MinusCircle,
                   titulo: 'Fundamentado como não aplicável a esta organização.' },
};
export function SeloCobertura({ estado, className }) {
  const c = COBERTURA[estado] || COBERTURA.descoberto;
  return <Selo tom={c.tom} icone={c.icone} titulo={c.titulo} className={className}>{c.label}</Selo>;
}

// O caso mais traiçoeiro de todos: há prova, mas aponta para uma revisão que já não é a que está em vigor. Uma
// prova que remete para a página 47 da revisão 3 não serve numa inspecção feita sobre a revisão 4.
export function SeloReconfirmar({ className }) {
  return (
    <Selo tom="aviso" icone={AlertTriangle} className={className}
      titulo="A prova foi registada contra uma revisão anterior do documento: confirmar que o parágrafo continua lá.">
      A reconfirmar
    </Selo>
  );
}

// ── grau de uma prova ───────────────────────────────────────────────────────
const GRAU = {
  cumpre:        { label: 'Cumpre',          tom: 'bom' },
  parcial:       { label: 'Cumpre em parte', tom: 'aviso' },
  planeado:      { label: 'Planeado',        tom: 'aviso' },
  nao_aplicavel: { label: 'Não aplicável',   tom: 'neutro' },
};
export function SeloGrau({ grau, className }) {
  const g = GRAU[grau] || GRAU.cumpre;
  return <Selo tom={g.tom} className={className}>{g.label}</Selo>;
}

// ── situação de uma ligação documento ↔ curso ───────────────────────────────
const SITUACAO = {
  conferido:       { label: 'Conteúdo conferido', tom: 'bom',    icone: CheckCircle2,
                     titulo: 'O conteúdo do curso foi conferido contra a revisão que está em vigor.' },
  desactualizado:  { label: 'Por rever',          tom: 'perigo', icone: AlertTriangle,
                     titulo: 'Saiu uma revisão nova depois da última conferência: o curso pode estar a ensinar o que já não se faz.' },
  nunca_conferido: { label: 'Nunca conferido',    tom: 'aviso',  icone: CircleDashed,
                     titulo: 'Ninguém confirmou ainda que o conteúdo do curso corresponde a este documento.' },
};
export function SeloSituacaoCurso({ situacao, className }) {
  const s = SITUACAO[situacao] || SITUACAO.nunca_conferido;
  return <Selo tom={s.tom} icone={s.icone} titulo={s.titulo} className={className}>{s.label}</Selo>;
}

// ── criticidade ─────────────────────────────────────────────────────────────
// Só se mostra a alta: marcar «média» em quase tudo é ruído, e o que interessa é saber onde um buraco dói.
export function SeloCritico({ criticidade, className }) {
  if (criticidade !== 'alta') return null;
  return <Selo tom="perigo" className={className} titulo="Requisito crítico: a falta é achado de inspecção.">Crítico</Selo>;
}

// ── o artigo ou parágrafo citado ────────────────────────────────────────────
// Em monoespaçado com algarismos tabulares, porque é uma referência e lê-se em coluna. Vazio não fica em branco:
// um espaço vazio numa matriz parece avaria, e aqui o vazio tem significado (o parágrafo ainda não foi confirmado
// no original, e isso é informação).
export function Artigo({ valor, className }) {
  const v = String(valor ?? '').trim();
  if (!v) return <span className={cn('text-sm italic', tk.tintaFraca, className)}>parágrafo por confirmar</span>;
  return <span style={{ fontVariantNumeric: 'tabular-nums' }} className={cn('text-sm font-semibold', tk.mono, tk.tinta, className)}>{v}</span>;
}

// ── a referência de uma prova, em uma linha ─────────────────────────────────
// «Cap. 4 · §4.3.2 · pág. 47-49» — o que se diz em voz alta a um inspector. Sem nada disto, diz-se que a prova
// aponta o documento inteiro, que é verdade e é pior, e é de propósito que se vê.
export function ReferenciaProva({ prova, className }) {
  const partes = [];
  if (prova?.capitulo) partes.push(`Cap. ${prova.capitulo}`);
  if (prova?.paragrafo) partes.push(`§${prova.paragrafo}`);
  if (prova?.pagina) partes.push(`pág. ${prova.pagina}${prova.pagina_fim && prova.pagina_fim !== prova.pagina ? `-${prova.pagina_fim}` : ''}`);
  if (!partes.length) {
    return <span className={cn('text-sm italic', tk.tintaFraca, className)}>sem página nem parágrafo indicados</span>;
  }
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums' }} className={cn('text-sm', tk.mono, tk.tintaMedia, className)}>
      {partes.join(' · ')}
    </span>
  );
}

// ── barra de cobertura ──────────────────────────────────────────────────────
// Três faixas numa só linha (coberto, em parte, descoberto). Lê-se como texto por quem usa leitor de ecrã, e o
// número vai sempre ao lado: a barra ilustra, não informa sozinha.
export function BarraCobertura({ cobertos = 0, parciais = 0, naoAplicaveis = 0, total = 0, className }) {
  const t = Math.max(Number(total) || 0, 0);
  const pc = (n) => (t ? `${(100 * (Number(n) || 0)) / t}%` : '0%');
  const descobertos = Math.max(t - (Number(cobertos) || 0) - (Number(parciais) || 0) - (Number(naoAplicaveis) || 0), 0);
  const legenda = t
    ? `${cobertos} de ${t} requisitos cobertos, ${parciais} em parte, ${descobertos} sem nada a apontar`
    : 'Sem requisitos carregados';
  return (
    <div
      role="img"
      aria-label={legenda}
      title={legenda}
      className={cn('flex h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800', className)}
    >
      <span className="h-full bg-emerald-600 dark:bg-emerald-500" style={{ width: pc(cobertos) }} />
      <span className="h-full bg-amber-500 dark:bg-amber-400" style={{ width: pc(parciais) }} />
      <span className="h-full bg-red-600 dark:bg-red-500" style={{ width: pc(descobertos) }} />
      <span className="h-full bg-slate-400 dark:bg-slate-600" style={{ width: pc(naoAplicaveis) }} />
    </div>
  );
}

// ── indicador de uma tira ───────────────────────────────────────────────────
// Número só quando é o assunto, e nunca a liderar com zeros: um indicador a zero vira uma linha de texto. É a
// regra do desenho do portal, e está aqui para não ser esquecida em cada ecrã novo.
export function Indicador({ rotulo, valor, tom = 'neutro', textoZero, className }) {
  const n = Number(valor) || 0;
  if (!n && textoZero) {
    return <p className={cn('text-sm', tk.tintaFraca, className)}>{textoZero}</p>;
  }
  const cor = tom === 'perigo' ? tk.perigo : tom === 'aviso' ? tk.aviso : tom === 'bom' ? tk.bom : tk.tinta;
  return (
    <div className={cn('min-w-0', className)}>
      <p className={cn('text-xl font-bold tabular-nums', cor)}>{n}</p>
      <p className={cn('text-sm', tk.tintaFraca)}>{rotulo}</p>
    </div>
  );
}
