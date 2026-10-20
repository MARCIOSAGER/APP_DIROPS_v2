// Peças partilhadas pelos ecrãs do fluxo de aprovação. Nada de cores soltas: tudo passa por `T`, que é o
// vocabulário visual do Portal de Documentos (PortalLayout.jsx) e já traz as variantes clara e escura.
//
// Regra do portal que vale aqui com particular força: **cor nunca sozinha**. Um fluxo devolvido não é «um selo
// âmbar», é a palavra «Devolvido» com um símbolo próprio — quem não distingue as cores tem de perceber o mesmo.
import React, { useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Clock, Download, FileCheck2, FileText, FileWarning, Info, Loader2, Lock,
  PenLine, RotateCcw, Upload, XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { T, MONO } from '../../PortalLayout';
import { descarregarFicheiroFluxo, ESTADO_FLUXO_LABEL, shaCurto, tamanhoFicheiro } from '../../apiFluxo';

// ── selo de estado do fluxo ─────────────────────────────────────────────────
// Vocabulário fechado e um símbolo por estado. «Cancelado» é cinzento frio e não vermelho: não é erro, é facto —
// a mesma regra que o portal já usa para «Obsoleto».
const SELO = {
  rascunho: { cor: 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300', icone: PenLine },
  aguarda_revisao: { cor: 'border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-200', icone: Clock },
  aguarda_aprovacao: { cor: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200', icone: Clock },
  devolvido: { cor: 'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/60 dark:text-red-200', icone: RotateCcw },
  aprovado: { cor: 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200', icone: CheckCircle2 },
  cancelado: { cor: 'border-slate-300 bg-slate-200/70 text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-400', icone: XCircle },
};

export function SeloFluxo({ estado, className }) {
  const chave = estado && SELO[estado] ? estado : 'rascunho';
  const { cor, icone: Icone } = SELO[chave];
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-0.5 text-sm font-medium leading-5', cor, className)}>
      <Icone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {ESTADO_FLUXO_LABEL[chave] || chave}
    </span>
  );
}

// ── «de quem se está à espera» ──────────────────────────────────────────────
// É a única pergunta que o painel de gestão precisa de responder, por isso escreve-se por extenso e não se
// esconde num ícone. `eu` faz a frase mudar de pessoa: «à espera de si» lê-se diferente de «à espera de alguém».
export function EsperaPor({ fluxo, esperaPor, eu, className }) {
  const estado = fluxo?.estado;
  if (estado === 'aprovado') {
    return <span className={cn('inline-flex items-center gap-1.5 text-sm', T.verde, className)}><CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />Percurso concluído: aprovado.</span>;
  }
  if (estado === 'cancelado') {
    return <span className={cn('inline-flex items-center gap-1.5 text-sm', T.tintaFraca, className)}><XCircle className="h-4 w-4 shrink-0" aria-hidden="true" />Fluxo cancelado. As assinaturas já dadas mantêm-se.</span>;
  }
  const quem = String(esperaPor || '').trim();
  const souEu = quem && eu && quem.toLowerCase() === String(eu).toLowerCase();
  const texto = estado === 'rascunho'
    ? (souEu || !quem ? 'Está nas suas mãos: junte os ficheiros e submeta.' : `Com o elaborador ${quem}.`)
    : souEu
      ? 'À espera da sua assinatura.'
      : quem ? `À espera de ${quem}.` : 'À espera do interveniente seguinte.';
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm', souEu ? cn('font-medium', T.acento) : T.tintaFraca, className)}>
      <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />{texto}
    </span>
  );
}

// ── caixas de aviso ─────────────────────────────────────────────────────────
// Quatro tons, e nenhum deles «decorativo»: informação, atenção, perigo e feito. Levam sempre ícone **e**
// palavra, e o papel `alert` só nos dois que exigem reacção — o leitor de ecrã não deve ser interrompido por
// uma confirmação.
const TOM = {
  info: { caixa: 'border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/40', cor: 'text-sky-900 dark:text-sky-200', icone: Info },
  atencao: { caixa: 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40', cor: 'text-amber-900 dark:text-amber-200', icone: AlertTriangle },
  perigo: { caixa: 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40', cor: 'text-red-900 dark:text-red-200', icone: AlertTriangle },
  feito: { caixa: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40', cor: 'text-emerald-900 dark:text-emerald-200', icone: CheckCircle2 },
};

export function Caixa({ tom = 'info', titulo, children, accoes, className }) {
  const t = TOM[tom] || TOM.info;
  const Icone = t.icone;
  return (
    <div
      className={cn('rounded-xl border p-3 sm:p-4', t.caixa, className)}
      {...(tom === 'perigo' || tom === 'atencao' ? { role: 'alert' } : {})}
    >
      <div className="flex items-start gap-2.5">
        <Icone className={cn('mt-0.5 h-5 w-5 shrink-0', t.cor)} aria-hidden="true" />
        <div className="min-w-0 flex-1 space-y-1">
          {titulo && <p className={cn('font-medium', t.cor)}>{titulo}</p>}
          {children && <div className={cn('max-w-prose space-y-1 text-sm', T.tintaMedia)}>{children}</div>}
          {accoes && <div className="mt-2 flex flex-wrap gap-2">{accoes}</div>}
        </div>
      </div>
    </div>
  );
}

// ── campo de formulário ─────────────────────────────────────────────────────
// A ajuda fica **debaixo** do campo e ligada a ele por `aria-describedby` quando o chamador passa o mesmo id:
// uma explicação que o leitor de ecrã não lê junto ao campo é uma explicação que não existe.
export function Campo({ id, label, ajuda, obrigatorio, erro, className, children }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id}>
        {label}
        {obrigatorio && <span className={cn('ml-1', T.vermelho)} aria-hidden="true">*</span>}
        {obrigatorio && <span className="sr-only"> (obrigatório)</span>}
      </Label>
      {children}
      {erro
        ? <p id={`${id}-ajuda`} role="alert" className={cn('flex items-start gap-1.5 text-sm', T.vermelho)}><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />{erro}</p>
        : ajuda && <p id={`${id}-ajuda`} className={cn('text-sm', T.tintaFraca)}>{ajuda}</p>}
    </div>
  );
}

// ── escolher um ficheiro ────────────────────────────────────────────────────
// Não envia nada: devolve o `File` escolhido ao formulário, que decide quando o sobe. É deliberado — subir à
// escolha deixava ficheiros órfãos no armazenamento cada vez que alguém mudasse de ideias, e nesta tabela um
// ficheiro a mais por ronda é um impasse (não há DELETE para quem tem sessão).
export function CampoFicheiro({ id, label, ajuda, accept, ficheiro, onEscolher, onLimpar, obrigatorio, erro, desactivado, ocupado, icone: Icone = Upload }) {
  return (
    <Campo id={id} label={label} ajuda={ajuda} obrigatorio={obrigatorio} erro={erro}>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={id}
          type="file"
          accept={accept}
          className="sr-only"
          disabled={desactivado || ocupado}
          aria-describedby={`${id}-ajuda`}
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onEscolher?.(f); }}
        />
        <Button
          type="button"
          variant="outline"
          className="min-h-[2.75rem]"
          disabled={desactivado || ocupado}
          onClick={() => document.getElementById(id)?.click()}
        >
          {ocupado ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Icone className="h-4 w-4" aria-hidden="true" />}
          {ficheiro ? 'Escolher outro' : 'Escolher ficheiro'}
        </Button>
        {ficheiro && (
          <span className={cn('inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm', T.linha, T.superficieFraca, T.tintaMedia)}>
            <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{ficheiro.name}</span>
            <span className="shrink-0 tabular-nums">· {tamanhoFicheiro(ficheiro.size)}</span>
          </span>
        )}
        {ficheiro && onLimpar && (
          <Button type="button" variant="ghost" className="min-h-[2.75rem]" onClick={onLimpar}>Retirar</Button>
        )}
      </div>
    </Campo>
  );
}

// ── linha de um ficheiro já guardado ────────────────────────────────────────
// Nome, tamanho, impressão digital e volta. A impressão digital não é decoração: é o que permite a alguém
// confirmar, à vista, que o ficheiro que está a abrir é o que foi assinado.
export function LinhaFicheiro({ ficheiro, papel, accoes, aviso, className }) {
  const editavel = papel === 'editavel' || ficheiro?.papel === 'editavel';
  const Icone = editavel ? Lock : FileCheck2;
  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-3 sm:px-4', className)}>
      <Icone className={cn('h-5 w-5 shrink-0', editavel ? T.ambar : T.tintaFraca)} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate font-medium', T.tinta)}>{ficheiro?.nome || 'Ficheiro sem nome'}</span>
        <span className={cn('mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-sm', T.tintaFraca)}>
          <span className="tabular-nums">{tamanhoFicheiro(ficheiro?.tamanho)}</span>
          <span>·</span>
          <span>impressão digital <span style={MONO}>{shaCurto(ficheiro?.sha256)}</span></span>
          {Number(ficheiro?.ronda) > 1 && <><span>·</span><span>carregado na {ficheiro.ronda}.ª volta</span></>}
        </span>
        {aviso && <span className={cn('mt-1 flex items-start gap-1.5 text-sm', T.ambar)}><FileWarning className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />{aviso}</span>}
      </span>
      {accoes && <span className="flex shrink-0 flex-wrap gap-2">{accoes}</span>}
    </div>
  );
}

// ── botão com estado de ocupado ─────────────────────────────────────────────
// O rótulo não muda para «A guardar…»: muda o estado, não o nome da acção. O que muda é o indicador e o
// `aria-busy`, para quem usa leitor de ecrã saber que está a acontecer algo.
export function BotaoAccao({ ocupado, icone: Icone, children, className, ...resto }) {
  return (
    <Button className={cn('min-h-[2.75rem]', className)} aria-busy={ocupado || undefined} disabled={ocupado || resto.disabled} {...resto}>
      {ocupado ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : Icone ? <Icone className="h-4 w-4" aria-hidden="true" /> : null}
      {children}
    </Button>
  );
}

// ── descarregar um ficheiro do fluxo ────────────────────────────────────────
// A descarga passa pela rota do backend (confirma o acesso e registra-o), logo pode falhar — e uma falha tem de
// ser visível. Um botão que não faz nada e não diz nada é a pior resposta possível a um ficheiro que a pessoa
// precisa de ter.
export function BotaoDescarregar({ ficheiro, rotulo, className }) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const descarregar = async () => {
    setOcupado(true); setErro('');
    try { await descarregarFicheiroFluxo(ficheiro); }
    catch (e) { setErro(e?.message || 'Não foi possível descarregar o ficheiro.'); }
    finally { setOcupado(false); }
  };
  return (
    <span className={cn('inline-flex flex-col items-start gap-1', className)}>
      <BotaoAccao variant="outline" icone={Download} ocupado={ocupado} onClick={descarregar}>
        {rotulo || 'Descarregar'}
      </BotaoAccao>
      {erro && <span role="alert" className={cn('max-w-xs text-sm', T.vermelho)}>{erro}</span>}
    </span>
  );
}
