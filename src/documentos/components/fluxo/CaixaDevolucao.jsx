// Devolver o documento para trás, com motivo escrito.
//
// Devolver não produz assinatura e não pede senha: não é afirmar autoridade sobre o conteúdo, é mandá-lo para
// trás. O que a devolução TEM de deixar é o motivo — é o que o elaborador precisa de ler para corrigir, e é o
// que fica no percurso para quem auditar o documento daqui a três anos perceber porque é que houve três voltas.
// Por isso o motivo é obrigatório aqui, no servidor e na base de dados, e não há forma de o saltar.
//
// Quem devolve a quem: o revisor devolve ao elaborador (é o único sítio de onde o documento lhe chegou); o
// director devolve ao elaborador ou ao revisor, e escolhe. Quando só há um destino, não se mostra escolha
// nenhuma — uma pergunta com uma só resposta é ruído.
//
// Cada devolução abre uma VOLTA NOVA. É isso que permite trazer um PDF corrigido sem apagar o ficheiro que
// alguém já assinou, e é o que o aviso no fim do painel diz por palavras.
import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { T } from '../../PortalLayout';
import { devolver } from '../../hooksFluxo';
import { MOTIVO_MINIMO } from '../../apiFluxo';
import { BotaoAccao, Caixa } from './comum';

const DESTINO_LABEL = {
  elaborador: 'Ao elaborador',
  revisor: 'Ao revisor',
};

export default function CaixaDevolucao({ fluxo, destinos = ['elaborador'], onDevolvido, onRecarregar, className }) {
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [escolhido, setPara] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(null);
  const campo = useRef(null);

  useEffect(() => { if (aberto) campo.current?.focus(); }, [aberto]);

  // O destino é DERIVADO dos destinos possíveis, em vez de copiado para estado por um efeito. Assim, quando o
  // fluxo passa de «aguarda revisão» (só se devolve ao elaborador) para «aguarda aprovação» (elaborador ou
  // revisor), a escolha acompanha sem haver um instante em que o estado aponta para um destino que já não existe.
  const para = destinos.includes(escolhido) ? escolhido : (destinos[0] || 'elaborador');

  const curto = motivo.trim().length < MOTIVO_MINIMO;
  const quem = para === 'revisor' ? (fluxo?.revisor_email || 'o revisor') : (fluxo?.elaborador_email || 'o elaborador');

  const submeter = async (e) => {
    e.preventDefault();
    if (curto || ocupado) return;
    setOcupado(true); setErro(null);
    try {
      const r = await devolver({ fluxoId: fluxo.id, motivo: motivo.trim(), para });
      setAberto(false); setMotivo('');
      onDevolvido?.(r);
    } catch (err) {
      setErro({ mensagem: err?.message || 'Não foi possível devolver.', status: err?.status });
    } finally {
      setOcupado(false);
    }
  };

  if (!aberto) {
    return (
      <div className={cn('space-y-2', className)}>
        <Button type="button" variant="outline" className="min-h-[2.75rem]" onClick={() => setAberto(true)}>
          <RotateCcw className="h-4 w-4" aria-hidden="true" />Devolver
        </Button>
        {erro && <ErroDevolucao erro={erro} onRecarregar={onRecarregar} />}
      </div>
    );
  }

  return (
    <form onSubmit={submeter} className={cn('rounded-xl border p-4 sm:p-5', T.linha, T.superficie, className)}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <h3 className={cn('text-base font-semibold', T.tinta)}>Devolver para correcção</h3>
        <Button type="button" variant="ghost" className="min-h-[2.75rem] px-2" onClick={() => { setAberto(false); setErro(null); }}>
          <X className="h-4 w-4" aria-hidden="true" />Cancelar
        </Button>
      </div>

      {destinos.length > 1 && (
        <fieldset className="mb-3">
          <legend className={cn('mb-1.5 text-sm font-medium', T.tintaMedia)}>Devolver a quem</legend>
          <div className="flex flex-wrap gap-2">
            {destinos.map(d => (
              <label
                key={d}
                className={cn(
                  'inline-flex min-h-[2.75rem] cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm',
                  para === d ? 'border-teal-700 bg-teal-50 font-medium text-teal-900 dark:border-teal-400 dark:bg-teal-950/60 dark:text-teal-100' : cn(T.linha, T.tintaMedia, T.realce),
                )}
              >
                <input type="radio" name="fx-devolver-para" value={d} checked={para === d} onChange={() => setPara(d)} className="h-4 w-4" />
                {DESTINO_LABEL[d] || d}
                <span className={cn('truncate text-sm font-normal', T.tintaFraca)}>
                  {d === 'revisor' ? fluxo?.revisor_email : fluxo?.elaborador_email}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="fx-motivo">Motivo da devolução <span className={T.vermelho} aria-hidden="true">*</span><span className="sr-only"> (obrigatório)</span></Label>
        <Textarea
          id="fx-motivo"
          ref={campo}
          rows={4}
          value={motivo}
          onChange={e => setMotivo(e.target.value)}
          aria-describedby="fx-motivo-ajuda"
          placeholder="Ex.: a tabela do capítulo 4 não reflecte a nova configuração da placa; corrigir e voltar a submeter."
          required
        />
        <p id="fx-motivo-ajuda" className={cn('text-sm', curto && motivo.length > 0 ? T.ambar : T.tintaFraca)}>
          {curto && motivo.length > 0
            ? `Escreva pelo menos ${MOTIVO_MINIMO} caracteres: o motivo é o que ${quem} vai ler para corrigir.`
            : `Vai em destaque no email de devolução, com as suas palavras, e fica no percurso do documento.`}
        </p>
      </div>

      {erro && <ErroDevolucao erro={erro} onRecarregar={onRecarregar} className="mt-3" />}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <BotaoAccao type="submit" icone={RotateCcw} ocupado={ocupado} disabled={curto || ocupado}>
          Devolver a {para === 'revisor' ? 'quem reviu' : 'quem elaborou'}
        </BotaoAccao>
        <Button type="button" variant="outline" className="min-h-[2.75rem]" onClick={() => { setAberto(false); setErro(null); }}>Voltar atrás</Button>
      </div>
      <p className={cn('mt-2 max-w-prose text-sm', T.tintaFraca)}>
        A devolução abre uma volta nova: o PDF corrigido entra como ficheiro novo e não apaga o que já foi assinado.
        As assinaturas desta volta ficam no registo — devolver não desfaz nenhum acto, diz que o percurso recomeça.
      </p>
    </form>
  );
}

function ErroDevolucao({ erro, onRecarregar, className }) {
  const s = erro?.status;
  return (
    <Caixa
      tom={s === 409 ? 'atencao' : 'perigo'}
      titulo={s === 409 ? 'Este fluxo já avançou' : s === 403 ? 'Não é a si que compete devolver este documento' : 'Não foi possível devolver'}
      className={className}
      accoes={s === 409 && onRecarregar
        ? <Button type="button" variant="outline" className="min-h-[2.75rem]" onClick={onRecarregar}><RefreshCw className="h-4 w-4" aria-hidden="true" />Recarregar o fluxo</Button>
        : null}
    >
      <p>{erro.mensagem}</p>
      {s === 409 && <p>Recarregue para ver quem o tem em mãos agora. Não se devolve duas vezes a mesma volta.</p>}
    </Caixa>
  );
}
