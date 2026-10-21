// Pôr um documento a caminho da aprovação: escolher a revisão, dizer quem revê e quem aprova, e carregar os dois
// ficheiros.
//
// ONDE ENCAIXAR ESTE COMPONENTE (não mexi em nenhum ecrã de gestão, como combinado):
//   • Gestão › Documentos (`pages/gestao/PortalDocumentosGestao.jsx`) — acção de linha «Pôr a aprovação», ao lado
//     de «Nova versão». É o sítio natural: é de lá que se carregam as revisões.
//   • Gestão › Emendas (`pages/gestao/PortalEmendas.jsx`) — no detalhe de uma emenda em rascunho, antes do botão
//     «Enviar à ANAC». Passando `emenda`, o fluxo fica preso a ela e, ao ser aprovado, preenche-lhe «Aprovado
//     por», a data e a versão resultante — e a emenda deixa de poder ir à ANAC antes disso (a base recusa).
//   • Ficha do documento (`pages/PortalDocumento.jsx`) — num separador «Aprovação», para quem elabora.
// Basta renderizá-lo: trata de tudo e devolve o id do fluxo em `onCriado`.
//
// Uma coisa que este formulário NÃO faz, de propósito: submeter. Abrir o fluxo não é acto de autoridade e não
// produz assinatura nenhuma — é só dizer por onde o documento vai passar. Submeter exige a senha e acontece no
// ecrã de aprovação, onde a pessoa vê o que está a assinar.
//
// A ordem das operações aqui dentro é deliberada: PRIMEIRO abre-se o fluxo, só DEPOIS se sobem os ficheiros. É
// que a volta («ronda») é estado do fluxo e a base lê-a do fluxo vivo — sem fluxo aberto, os ficheiros entravam
// na volta errada. Se o envio de um ficheiro falhar, o fluxo fica em rascunho com o que já subiu, e continua-se
// de lá: nada se perde e nada fica a meio sem se ver.
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, FileText, Lock, PlayCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import Select from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { T, MONO } from '../../PortalLayout';
import { useVersoesDocumento, useEmendasDocs } from '../../hooks';
import {
  abrirFluxo, carregarFicheiroFluxo, usePessoasFluxo, useDirectoresAeroporto,
  useFluxosDocumento, useRecarregarFluxo, rotuloRevisao,
} from '../../hooksFluxo';
import { enderecoFluxo, ESTADO_FLUXO_LABEL } from '../../apiFluxo';
import { BotaoAccao, Caixa, Campo, CampoFicheiro } from './comum';
import { signatariosDoRascunho } from '../../edicao/hooksEstruturado';

const etiquetaPessoa = (u) => (u.full_name ? `${u.full_name} · ${u.email}` : u.email);

export default function IniciarFluxo({ documento, versaoId: versaoInicial, emenda, onCriado, onFechar, className }) {
  const documentoId = documento?.id || null;
  const versoesQ = useVersoesDocumento(documentoId);
  const emendasQ = useEmendasDocs({ documentoId });
  const pessoasQ = usePessoasFluxo();
  const directoresQ = useDirectoresAeroporto(documento?.aeroporto_id);
  const fluxosQ = useFluxosDocumento(documentoId);
  const recarregar = useRecarregarFluxo();

  const [versao, setVersao] = useState(versaoInicial || '');
  const [emendaId, setEmendaId] = useState(emenda?.id || '');
  const [revisor, setRevisor] = useState('');
  const [director, setDirector] = useState('');
  const [resumo, setResumo] = useState(emenda?.resumo || '');
  const [pdf, setPdf] = useState(null);
  const [editavel, setEditavel] = useState(null);
  const [fase, setFase] = useState('');          // '' | 'abrir' | 'pdf' | 'editavel'
  const [erro, setErro] = useState('');
  const [parcial, setParcial] = useState(null);  // fluxo já aberto, ficheiros a meio

  // A revisão por omissão é a mais recente que ainda não está em vigor — é essa que vai a aprovação. Se não
  // houver nenhuma nesse estado, fica a mais recente, e a pessoa confirma.
  const versoes = useMemo(() => (versoesQ.data || []), [versoesQ.data]);
  useEffect(() => {
    if (versao || versoes.length === 0) return;
    const candidata = versoes.find(v => ['rascunho', 'em_revisao'].includes(v.estado)) || versoes[0];
    setVersao(candidata?.id || '');
  }, [versoes, versao]);

  // Documento redigido no editor: o revisor e quem aprova já foram escolhidos no cabeçalho — vêm pré-preenchidos.
  useEffect(() => {
    if (!documentoId) return undefined;
    let vivo = true;
    signatariosDoRascunho(documentoId).then((ex) => {
      if (!vivo || !ex) return;
      if (ex.verificadoEmail) setRevisor(v => v || ex.verificadoEmail);
      if (ex.aprovadoEmail) setDirector(v => v || ex.aprovadoEmail);
    }).catch(() => { /* sem rascunho do editor (ou migração 182 por correr): escolhe-se à mão */ });
    return () => { vivo = false; };
  }, [documentoId]);

  const opcoesVersao = useMemo(() => versoes.map(v => ({
    value: v.id,
    label: `Revisão ${rotuloRevisao(v)}${v.estado ? ` · ${v.estado.replace('_', ' ')}` : ''}${v.arquivo_nome ? ` · ${v.arquivo_nome}` : ''}`,
  })), [versoes]);

  const opcoesEmenda = useMemo(() => [
    { value: '', label: '— sem emenda associada —' },
    ...(emendasQ.data || []).map(e => ({ value: e.id, label: `${e.tipo === 'corrigenda' ? 'Corrigenda' : 'Emenda'} nº ${e.numero}${e.resumo ? ` · ${String(e.resumo).slice(0, 60)}` : ''}` })),
  ], [emendasQ.data]);

  const opcoesPessoas = useMemo(() => [
    { value: '', label: '— por indicar —' },
    ...(pessoasQ.data || []).map(u => ({ value: u.email, label: etiquetaPessoa(u) })),
  ], [pessoasQ.data]);

  const opcoesDirector = useMemo(() => {
    const dir = directoresQ.data || [];
    return [
      { value: '', label: '— o responsável do aeroporto —' },
      ...dir.map(d => ({ value: d.email, label: `${d.nome || d.email}${d.suplencia_id ? ` · suplente de ${d.titular_email}` : ' · responsável do aeroporto'}` })),
      ...(pessoasQ.data || [])
        .filter(u => !dir.some(d => String(d.email).toLowerCase() === String(u.email).toLowerCase()))
        .map(u => ({ value: u.email, label: etiquetaPessoa(u) })),
    ];
  }, [directoresQ.data, pessoasQ.data]);

  const vivo = fluxosQ.vivo;
  const mesmaPessoa = revisor && director && revisor.toLowerCase() === director.toLowerCase();
  const prontoParaAbrir = !!documentoId && !!versao && !!revisor && !mesmaPessoa && !fase;

  const arrancar = async () => {
    setErro('');
    let fluxoId = parcial?.fluxoId || null;
    try {
      if (!fluxoId) {
        setFase('abrir');
        fluxoId = await abrirFluxo({
          documentoId, versaoId: versao, emendaId: emendaId || null,
          revisorEmail: revisor, directorEmail: director, resumo,
        });
        setParcial({ fluxoId, pdf: false, editavel: false });
      }
      if (pdf && !parcial?.pdf) {
        setFase('pdf');
        await carregarFicheiroFluxo({ documentoId, versaoId: versao, papel: 'pdf', ficheiro: pdf });
        setParcial(p => ({ ...(p || { fluxoId }), pdf: true }));
      }
      if (editavel && !parcial?.editavel) {
        setFase('editavel');
        await carregarFicheiroFluxo({ documentoId, versaoId: versao, papel: 'editavel', ficheiro: editavel });
        setParcial(p => ({ ...(p || { fluxoId }), editavel: true }));
      }
      recarregar();
      onCriado?.(fluxoId);
    } catch (e) {
      setErro(e?.message || 'Não foi possível abrir o fluxo.');
    } finally {
      setFase('');
    }
  };

  // ── já existe um fluxo a decorrer: não se abre outro ──────────────────────
  // Dois fluxos vivos sobre a mesma revisão é a receita para duas aprovações contraditórias e para a pergunta
  // «quem aprovou?» não ter resposta única. A base impede-o com um índice único; aqui diz-se porquê e dá-se o
  // caminho para o que existe.
  if (vivo) {
    return (
      <Caixa
        tom="info"
        titulo="Este documento já tem um fluxo de aprovação a decorrer"
        className={className}
        accoes={
          <>
            <Button asChild className="min-h-[2.75rem]"><a href={enderecoFluxo(vivo.id)}>Abrir o fluxo<ArrowRight className="h-4 w-4" aria-hidden="true" /></a></Button>
            {onFechar && <Button variant="outline" className="min-h-[2.75rem]" onClick={onFechar}>Fechar</Button>}
          </>
        }
      >
        <p>
          Está em <strong>{ESTADO_FLUXO_LABEL[vivo.estado] || vivo.estado}</strong>, na {vivo.ronda}.ª volta, aberto por {vivo.elaborador_email}.
          Para pôr outra revisão a aprovação, este tem de terminar ou ser cancelado — com motivo.
        </p>
      </Caixa>
    );
  }

  return (
    <div className={cn('space-y-5', className)}>
      <header className="space-y-1">
        <h2 className={cn('text-lg font-semibold', T.tinta)}>Pôr a aprovação</h2>
        <p className={cn('max-w-prose text-sm', T.tintaFraca)}>
          {documento?.numero && <><span style={MONO} className={cn('font-semibold', T.tinta)}>{documento.numero}</span> · </>}
          {documento?.titulo || 'Documento sem título'}
        </p>
        <p className={cn('max-w-prose text-sm', T.tintaFraca)}>
          O documento vai passar por três pessoas: você, que elabora e submete; um revisor; e o director do aeroporto.
          Cada passo é assinado no portal com a senha da própria conta.
        </p>
      </header>

      <section className="space-y-3">
        <Campo id="if-versao" label="Revisão que vai a aprovação" obrigatorio ajuda="O fluxo pertence a UMA revisão, não ao documento todo. É essa revisão que fica aprovada no fim.">
          {opcoesVersao.length === 0
            ? <p className={cn('text-sm', T.ambar)}>Este documento não tem revisões registadas. Crie uma versão em Gestão › Documentos antes de o pôr a aprovação.</p>
            : <Select id="if-versao" options={opcoesVersao} value={versao} onValueChange={setVersao} placeholder="Escolher a revisão" />}
        </Campo>

        <Campo id="if-emenda" label="Emenda (opcional)" ajuda="Prende o fluxo à emenda: ao ser aprovado preenche-lhe «Aprovado por», a data e a versão resultante. Enquanto não estiver aprovado, a emenda não pode ir à ANAC.">
          <Select id="if-emenda" options={opcoesEmenda} value={emendaId} onValueChange={setEmendaId} placeholder="Sem emenda" />
        </Campo>

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo id="if-revisor" label="Quem revê" obrigatorio ajuda="Fica fixo a partir do momento em que o documento sai das suas mãos.">
            <Select id="if-revisor" options={opcoesPessoas} value={revisor} onValueChange={setRevisor} placeholder="Escolher o revisor" />
          </Campo>
          <Campo id="if-director" label="Quem aprova" ajuda="Em branco, fica o responsável do aeroporto deste documento." erro={mesmaPessoa ? 'O revisor e o director têm de ser pessoas diferentes.' : null}>
            <Select id="if-director" options={opcoesDirector} value={director} onValueChange={setDirector} placeholder="Escolher o director" />
          </Campo>
        </div>

        <Campo id="if-resumo" label="O que muda nesta revisão" ajuda="Em linguagem de gente: é o que o revisor e o director lêem no email antes de abrir o documento.">
          <Textarea id="if-resumo" rows={3} value={resumo} onChange={e => setResumo(e.target.value)} />
        </Campo>
      </section>

      <section className="space-y-3">
        <h3 className={cn('text-base font-semibold', T.tinta)}>Os dois ficheiros</h3>
        <CampoFicheiro
          id="if-pdf"
          label="PDF da revisão"
          obrigatorio
          ajuda="O que se aprova, se carimba com as assinaturas e se distribui. Pode carregá-lo agora ou mais tarde, antes de submeter."
          accept="application/pdf,.pdf"
          ficheiro={pdf}
          onEscolher={setPdf}
          onLimpar={() => setPdf(null)}
          ocupado={fase === 'pdf'}
          icone={FileText}
        />
        <CampoFicheiro
          id="if-editavel"
          label="Ficheiro editável"
          ajuda="Word, Excel ou PowerPoint — a semente da revisão seguinte. Fica no armazenamento privado, com permissão própria: nunca sai por link partilhável nem vai em anexo de email."
          accept=".docx,.doc,.xlsx,.xls,.pptx,.ppt,.odt,.ods,.odp"
          ficheiro={editavel}
          onEscolher={setEditavel}
          onLimpar={() => setEditavel(null)}
          ocupado={fase === 'editavel'}
          icone={Lock}
        />
        {!editavel && (
          <p className={cn('max-w-prose text-sm', T.tintaFraca)}>
            Se este documento não tem original editável — é antigo, é uma digitalização, veio em papel — siga sem ele.
            Ao submeter vai ser-lhe pedido que diga porquê, e a justificação fica registada.
          </p>
        )}
      </section>

      {erro && (
        <Caixa tom="perigo" titulo="Não foi possível concluir">
          <p>{erro}</p>
          {parcial?.fluxoId && (
            <p>
              O fluxo <strong>já foi aberto</strong> e ficou em rascunho{parcial.pdf ? ', com o PDF carregado' : ''}. Volte a tentar para
              continuar de onde parou, ou <a className={cn('underline', T.acento)} href={enderecoFluxo(parcial.fluxoId)}>abra-o</a> e carregue os ficheiros lá.
            </p>
          )}
        </Caixa>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <BotaoAccao
          icone={PlayCircle}
          ocupado={!!fase}
          disabled={!prontoParaAbrir}
          onClick={arrancar}
        >
          {parcial?.fluxoId ? 'Continuar' : 'Abrir o fluxo'}
        </BotaoAccao>
        {onFechar && <Button variant="outline" className="min-h-[2.75rem]" onClick={onFechar}>Cancelar</Button>}
        {fase && (
          <span className={cn('text-sm', T.tintaFraca)}>
            {fase === 'abrir' ? 'A abrir o fluxo…' : fase === 'pdf' ? 'A enviar o PDF…' : 'A enviar o editável…'}
          </span>
        )}
      </div>
      <p className={cn('max-w-prose text-sm', T.tintaFraca)}>
        Abrir o fluxo não assina nada e não avisa ninguém: fica em rascunho, nas suas mãos. O revisor só é avisado quando submeter.
      </p>
    </div>
  );
}
