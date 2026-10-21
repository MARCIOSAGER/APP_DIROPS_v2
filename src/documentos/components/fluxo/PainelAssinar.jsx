// Assinar: dois cliques e a senha, e nada mais no caminho.
//
// O primeiro clique é o botão do acto (o rótulo vem de `documento_acto`, não do código). O que ele abre NÃO é
// uma caixa de confirmação genérica: é a declaração do que vai ser assinado, por esta ordem — com que papel,
// qual é o SIGNIFICADO do acto, que ficheiro exactamente (nome e impressão digital), e o que fica registado.
// Só depois aparece o campo da senha.
//
// Porque é que a senha é pedida outra vez, estando a pessoa já autenticada: é o que transforma um clique num
// acto de autoridade. E é verificada DENTRO da base de dados (`doc_senha_confere`), não aqui nem no backend — se
// fosse verificada fora, a função de assinar teria de aceitar «já verifiquei, confia», que é exactamente o
// buraco que o segundo factor existe para tapar. Consequência prática: assinar em nome de outra pessoa exige a
// senha dessa pessoa.
//
// Cuidados que este ficheiro tem de manter, e que não são negociáveis:
//   • a senha vai no corpo do pedido (ver `assinar` em apiFluxo.js), nunca no endereço;
//   • nunca é registada em log, nunca entra numa chave de cache, e é esquecida assim que a chamada volta —
//     inclusive quando falha;
//   • um 409 («o fluxo já avançou») NUNCA se repete automaticamente: mostra-se e manda-se recarregar. Dois
//     separadores abertos é o caso normal, não a excepção.
import React, { useEffect, useRef, useState } from 'react';
import { KeyRound, PenLine, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { T, MONO } from '../../PortalLayout';
import { assinar } from '../../hooksFluxo';
import { papelRotulo, shaCurto } from '../../apiFluxo';
import { BotaoAccao, Caixa, Campo } from './comum';
import { horaAngolaComFuso } from './SeloAssinatura';
import { gerarCopiaEmSegundoPlano } from '../../hooksCopiaAssinada';

const MOTIVO_EDITAVEL_MINIMO = 10;

// O que acontece depois de assinar, dito por palavras. Quem acaba de assinar quer saber duas coisas: ficou
// registado, e para onde vai agora.
function proximoPasso(acto, fluxo) {
  if (acto === 'elaboracao') return `Segue para revisão de ${fluxo?.revisor_email || 'quem indicou como revisor'}, que vai ser avisado por email.`;
  if (acto === 'revisao') return `Segue para aprovação de ${fluxo?.director_email || 'o director do aeroporto'}, que vai ser avisado por email.`;
  return 'A revisão fica aprovada. A entrada em vigor é um passo à parte: continua a depender da data agendada.';
}

export default function PainelAssinar({
  fluxo, acto, actoDados, quem, pdf, temEditavel, podeVerEditavel, onAssinado, onRecarregar, className,
}) {
  const [aberto, setAberto] = useState(false);
  const [senha, setSenha] = useState('');
  const [nota, setNota] = useState('');
  const [motivoEditavel, setMotivoEditavel] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(null);
  const [feito, setFeito] = useState(null);
  const campoSenha = useRef(null);

  // O foco vai para a senha quando o painel abre: é o único campo que a pessoa tem de preencher.
  useEffect(() => { if (aberto) campoSenha.current?.focus(); }, [aberto]);

  // A senha não sobrevive ao fecho do painel nem a uma falha. Guardá-la «para a próxima tentativa» seria
  // deixá-la em memória do lado do cliente sem necessidade nenhuma.
  const fechar = () => { setAberto(false); setSenha(''); setErro(null); };

  const significado = actoDados?.significado || '';
  const rotulo = actoDados?.rotulo || 'Assinar';
  const papel = quem?.papel || actoDados?.papel;
  // A ausência de editável só é admissível na submissão, e tem de ser dita e justificada — é diferente de ficar
  // em silêncio. Se a pessoa não tem direito ao editável, não lhe perguntamos nada: não é dela a decisão.
  const precisaMotivoEditavel = acto === 'elaboracao' && !temEditavel && podeVerEditavel !== false;
  const motivoCurto = precisaMotivoEditavel && motivoEditavel.trim().length < MOTIVO_EDITAVEL_MINIMO;

  const submeter = async (e) => {
    e.preventDefault();
    if (!senha || ocupado) return;
    if (motivoCurto) { setErro({ mensagem: `Diga porque não há ficheiro editável (pelo menos ${MOTIVO_EDITAVEL_MINIMO} caracteres).` }); return; }
    setOcupado(true); setErro(null);
    try {
      const r = await assinar({
        fluxoId: fluxo.id,
        acto,
        senha,
        nota: nota.trim() || null,
        semEditavelMotivo: precisaMotivoEditavel ? motivoEditavel.trim() : null,
      });
      setSenha('');            // esquecida imediatamente, mesmo em caso de sucesso
      setAberto(false);
      setFeito(r);
      onAssinado?.(r);
      // A última assinatura (aprovação final): prepara a cópia assinada em segundo plano, neste navegador. Se
      // falhar, a aprovação não é afectada — só se avisa, e a cópia pode gerar-se na página do documento.
      if ((r?.estado === 'aprovado' || acto === 'aprovacao') && fluxo?.versao_id) {
        gerarCopiaEmSegundoPlano(fluxo.versao_id);
      }
    } catch (err) {
      setSenha('');
      setErro({ mensagem: err?.message || 'Não foi possível assinar.', status: err?.status, estado: err?.estado });
      // 401 é senha errada: a pessoa volta logo a escrever, por isso devolve-se-lhe o foco
      if (err?.status === 401) setTimeout(() => campoSenha.current?.focus(), 0);
    } finally {
      setOcupado(false);
    }
  };

  // ── já assinado nesta sessão: confirmação com o código e o passo seguinte ──
  if (feito) {
    return (
      <Caixa tom="feito" titulo={`Assinado como ${papelRotulo(feito.signatario_papel || papel)}`} className={className}>
        <p>
          Código da assinatura <span style={MONO} className="font-medium">{feito.codigo}</span> · {horaAngolaComFuso(feito.assinado_em)}
          {feito.em_substituicao_de ? ` · em substituição de ${feito.em_substituicao_de}` : ''}
        </p>
        {feito.significado && <p className="italic">«{feito.significado}»</p>}
        <p>{proximoPasso(acto, fluxo)}</p>
        <p className={cn('text-sm', T.tintaFraca)}>
          O email leva a cópia; a assinatura foi dada aqui. Guarde o código: é por ele que esta assinatura se verifica, anos depois.
        </p>
      </Caixa>
    );
  }

  // ── o primeiro clique ─────────────────────────────────────────────────────
  if (!aberto) {
    return (
      <div className={cn('space-y-2', className)}>
        <BotaoAccao type="button" icone={PenLine} onClick={() => setAberto(true)}>{rotulo}</BotaoAccao>
        {erro && <ErroAssinatura erro={erro} onRecarregar={onRecarregar} />}
      </div>
    );
  }

  // ── o painel: primeiro o que vai ser assinado, depois a senha ─────────────
  return (
    <form onSubmit={submeter} className={cn('rounded-xl border p-4 sm:p-5', T.linha, T.superficie, className)}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <h3 className={cn('text-base font-semibold', T.tinta)}>O que vai assinar</h3>
        <Button type="button" variant="ghost" className="min-h-[2.75rem] px-2" onClick={fechar}>
          <X className="h-4 w-4" aria-hidden="true" />Cancelar
        </Button>
      </div>

      <div className={cn('space-y-2 rounded-lg border p-3', T.linha, T.superficieFraca)}>
        <p className={T.tinta}>Vai assinar como <strong>{papelRotulo(papel)}</strong>{quem?.em_substituicao_de ? <> , <strong>em substituição de {quem.em_substituicao_de}</strong></> : null}.</p>
        {significado
          ? <p className={cn('max-w-prose italic', T.tintaMedia)}>«{significado}»</p>
          : <p className={cn('max-w-prose text-sm', T.ambar)}>O significado deste acto não chegou do servidor. Recarregue o ecrã antes de assinar: é esta frase que fica registada no seu nome.</p>}
        <p className={cn('text-sm', T.tintaMedia)}>
          Ficheiro: <span className="font-medium">{pdf?.nome || 'sem PDF carregado'}</span>
          {pdf?.sha256 && <> · impressão digital <span style={MONO}>{shaCurto(pdf.sha256)}</span></>}
        </p>
        <p className={cn('text-sm', T.tintaFraca)}>
          Fica registado o seu nome, a data e a hora, o endereço de onde assina e o equipamento. O registo é só de inserção: não se altera nem se apaga.
        </p>
      </div>

      {precisaMotivoEditavel && (
        <Caixa tom="atencao" titulo="Esta revisão não tem ficheiro editável" className="mt-3">
          <p>
            O editável é a semente da revisão seguinte. Se não existe — documento antigo, digitalização, veio em papel — diga porquê e prossiga:
            a ausência fica registada e justificada, que é diferente de ficar em silêncio.
          </p>
        </Caixa>
      )}

      <div className="mt-3 space-y-3">
        {precisaMotivoEditavel && (
          <Campo
            id="fx-sem-editavel"
            label="Porque não há ficheiro editável"
            obrigatorio
            ajuda="Fica guardado no fluxo e aparece a quem o receber."
            erro={motivoEditavel.length > 0 && motivoCurto ? `Escreva pelo menos ${MOTIVO_EDITAVEL_MINIMO} caracteres.` : null}
          >
            <Textarea id="fx-sem-editavel" rows={2} value={motivoEditavel} onChange={e => setMotivoEditavel(e.target.value)} placeholder="Ex.: documento recebido em papel e digitalizado; não existe original editável." />
          </Campo>
        )}

        <Campo id="fx-nota" label="Nota (opcional)" ajuda="Uma observação para quem recebe o documento a seguir. Não substitui o motivo de uma devolução.">
          <Textarea id="fx-nota" rows={2} value={nota} onChange={e => setNota(e.target.value)} />
        </Campo>

        <Campo id="fx-senha" label="Senha da sua conta" obrigatorio ajuda="A mesma com que entrou no portal. É verificada no servidor e não é guardada em sítio nenhum.">
          <Input
            id="fx-senha"
            ref={campoSenha}
            type="password"
            autoComplete="current-password"
            value={senha}
            onChange={e => setSenha(e.target.value)}
            className="min-h-[2.75rem]"
            required
          />
        </Campo>

        {erro && <ErroAssinatura erro={erro} onRecarregar={onRecarregar} />}

        <div className="flex flex-wrap items-center gap-2">
          <BotaoAccao type="submit" icone={ShieldCheck} ocupado={ocupado} disabled={!senha || ocupado}>Assinar</BotaoAccao>
          <Button type="button" variant="outline" className="min-h-[2.75rem]" onClick={fechar}>Voltar atrás</Button>
        </div>
        <p className={cn('text-sm', T.tintaFraca)}>
          <KeyRound className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
          Esta senha não é a «senha adicional» de uma pasta ou de um documento: essa protege a descarga, esta prova quem assina.
        </p>
      </div>
    </form>
  );
}

// ── erros com caminho de saída ──────────────────────────────────────────────
// Cada situação tem a sua saída, e nenhuma delas é «tente outra vez» às cegas:
//   409 → outro separador já fez avançar o fluxo: recarregar, nunca repetir a chamada;
//   429 → conta travada por tentativas falhadas: esperar, e saber quanto;
//   403 → não é o interveniente: o motivo vem do servidor e explica-o melhor do que qualquer texto fixo.
function ErroAssinatura({ erro, onRecarregar }) {
  const s = erro?.status;
  const titulo = s === 401 ? 'Senha incorrecta'
    : s === 429 ? 'Assinatura travada por tentativas falhadas'
      : s === 409 ? 'Este fluxo já avançou'
        : s === 403 ? 'Não é a si que compete este acto'
          : 'Não foi possível assinar';
  return (
    <Caixa
      tom={s === 409 ? 'atencao' : 'perigo'}
      titulo={titulo}
      accoes={s === 409 && onRecarregar
        ? <Button type="button" variant="outline" className="min-h-[2.75rem]" onClick={onRecarregar}><RefreshCw className="h-4 w-4" aria-hidden="true" />Recarregar o fluxo</Button>
        : null}
    >
      <p>{erro.mensagem}</p>
      {s === 401 && <p>Escreva a senha com que entra no portal. Cinco falhas em quinze minutos travam a assinatura nesta conta.</p>}
      {s === 409 && <p>Alguém — talvez você, noutro separador — já praticou este acto. Recarregue para ver o estado actual; <strong>nada foi assinado duas vezes</strong>.</p>}
      {s === 500 && <p>Se voltar a acontecer, avise a gestão do portal: o acto não foi registado.</p>}
    </Caixa>
  );
}

export { ErroAssinatura };

