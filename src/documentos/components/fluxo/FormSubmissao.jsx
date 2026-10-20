// O que o elaborador tem de fazer antes de submeter: os dois ficheiros, o resumo do que muda, e quem revê e quem
// aprova.
//
// Os dois ficheiros, e porque é que são dois:
//   • o PDF é o que se aprova, se carimba, se distribui e se partilha. É obrigatório — sem ele não há nada para
//     assinar, e a função de assinar recusa.
//   • o editável (.docx, .xlsx, …) é a semente da revisão seguinte. Vive sempre sob `editaveis/`, no
//     armazenamento privado, com permissão própria e mais apertada. Não é obrigatório, mas a sua falta tem de
//     ser justificada no momento de assinar — documentos antigos, digitalizações e coisas que vieram em papel
//     não têm editável, e o fluxo não pode parar por isso.
//
// O que este formulário NÃO faz: assinar. Submeter é um acto assinado e vive no painel de assinatura, a seguir.
// Aqui só se prepara — e só enquanto o fluxo está com o elaborador (rascunho ou devolvido), que é a janela em
// que a base aceita alterar os intervenientes. Trocar o revisor a meio é trocar o juiz depois de ver a sentença.
import React, { useEffect, useMemo, useState } from 'react';
import { FileText, Lock, Save, Upload } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import Select from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { T } from '../../PortalLayout';
import { carregarFicheiroFluxo, substituirFicheiroFluxo, guardarPreparacao, usePessoasFluxo, useDirectoresAeroporto } from '../../hooksFluxo';
import { BotaoAccao, Caixa, Campo, CampoFicheiro, LinhaFicheiro } from './comum';

const etiquetaPessoa = (u) => (u.full_name ? `${u.full_name} · ${u.email}` : u.email);

export default function FormSubmissao({
  fluxo, par, podeVerEditavel, onFeito, className,
}) {
  const [pdfEscolhido, setPdfEscolhido] = useState(null);
  const [edtEscolhido, setEdtEscolhido] = useState(null);
  const [ocupado, setOcupado] = useState('');
  const [erro, setErro] = useState('');
  const [resumo, setResumo] = useState(fluxo?.resumo || '');
  const [revisor, setRevisor] = useState(fluxo?.revisor_email || '');
  const [director, setDirector] = useState(fluxo?.director_email || '');
  const [guardado, setGuardado] = useState(false);

  const pessoasQ = usePessoasFluxo();
  const directoresQ = useDirectoresAeroporto(fluxo?.aeroporto_id);

  useEffect(() => {
    setResumo(fluxo?.resumo || '');
    setRevisor(fluxo?.revisor_email || '');
    setDirector(fluxo?.director_email || '');
  }, [fluxo?.id, fluxo?.resumo, fluxo?.revisor_email, fluxo?.director_email]);


  // As pessoas que se podem escolher. Os directores do aeroporto aparecem primeiro e dizem-no, porque é esse o
  // endereço que a base sugere e o que faz o fluxo chegar ao fim sem depender de ninguém se lembrar de quem é
  // responsável por que aeroporto.
  const opcoesPessoas = useMemo(() => {
    const lista = (pessoasQ.data || []).map(u => ({ value: u.email, label: etiquetaPessoa(u) }));
    return [{ value: '', label: '— por indicar —' }, ...lista];
  }, [pessoasQ.data]);

  const opcoesDirector = useMemo(() => {
    const dir = directoresQ.data || [];
    const daCasa = dir.map(d => ({
      value: d.email,
      label: `${d.nome || d.email}${d.suplencia_id ? ` · suplente de ${d.titular_email}` : ' · responsável do aeroporto'}`,
    }));
    const outros = (pessoasQ.data || [])
      .filter(u => !dir.some(d => String(d.email).toLowerCase() === String(u.email).toLowerCase()))
      .map(u => ({ value: u.email, label: etiquetaPessoa(u) }));
    return [{ value: '', label: '— o responsável do aeroporto —' }, ...daCasa, ...outros];
  }, [directoresQ.data, pessoasQ.data]);

  const mesmaPessoa = revisor && director && revisor.toLowerCase() === director.toLowerCase();
  const revisorEhElaborador = revisor && String(fluxo?.elaborador_email || '').toLowerCase() === revisor.toLowerCase();

  const subir = async (papel, ficheiro, substituir) => {
    setOcupado(papel); setErro('');
    try {
      if (substituir) {
        await substituirFicheiroFluxo({
          fluxoId: fluxo.id, ficheiroId: substituir.id,
          documentoId: fluxo.documento_id, versaoId: fluxo.versao_id, papel, ficheiro,
        });
      } else {
        await carregarFicheiroFluxo({ documentoId: fluxo.documento_id, versaoId: fluxo.versao_id, papel, ficheiro });
      }
      if (papel === 'pdf') setPdfEscolhido(null); else setEdtEscolhido(null);
      onFeito?.();
    } catch (e) {
      setErro(e?.message || 'Não foi possível carregar o ficheiro.');
    } finally {
      setOcupado('');
    }
  };

  const guardar = async () => {
    setOcupado('preparacao'); setErro(''); setGuardado(false);
    try {
      await guardarPreparacao(fluxo.id, { revisorEmail: revisor, directorEmail: director, resumo });
      setGuardado(true);
      onFeito?.();
    } catch (e) {
      setErro(e?.message || 'Não foi possível guardar.');
    } finally {
      setOcupado('');
    }
  };

  const pdfDestaRonda = par?.pdfDestaRonda;
  const edtDestaRonda = par?.editavelDestaRonda;

  return (
    <div className={cn('space-y-5', className)}>
      {/* ── os dois ficheiros ─────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h3 className={cn('text-base font-semibold', T.tinta)}>Os ficheiros desta revisão</h3>

        {/* PDF */}
        <div className={cn('overflow-hidden rounded-xl border', T.linha, T.superficie)}>
          <p className={cn('border-b px-3 py-2 text-sm font-semibold uppercase tracking-wider sm:px-4', T.linha, T.tintaMedia)}>
            PDF — o que vai ser aprovado
          </p>
          {par?.pdf ? (
            <>
              <LinhaFicheiro
                ficheiro={par.pdf}
                papel="pdf"
                aviso={!pdfDestaRonda ? `Este PDF vem da ${par.pdf.ronda}.ª volta. Se corrigiu o documento, carregue o PDF novo — senão vai assinar o anterior.` : null}
              />
              {!pdfEscolhido ? (
                <div className={cn('border-t px-3 py-3 sm:px-4', T.linha)}>
                  <CampoFicheiro
                    id="fx-pdf-novo"
                    label={pdfDestaRonda ? 'Substituir o PDF desta volta' : 'Carregar o PDF corrigido'}
                    ajuda={pdfDestaRonda
                      ? 'O ficheiro anterior desta volta é apagado. Só é possível porque ninguém o assinou ainda.'
                      : 'Entra como ficheiro novo desta volta; o anterior fica no registo, intacto.'}
                    accept="application/pdf,.pdf"
                    ficheiro={null}
                    onEscolher={setPdfEscolhido}
                    ocupado={ocupado === 'pdf'}
                  />
                </div>
              ) : (
                <div className={cn('border-t px-3 py-3 sm:px-4', T.linha)}>
                  <CampoFicheiro
                    id="fx-pdf-novo"
                    label="PDF escolhido"
                    accept="application/pdf,.pdf"
                    ficheiro={pdfEscolhido}
                    onEscolher={setPdfEscolhido}
                    onLimpar={() => setPdfEscolhido(null)}
                    ocupado={ocupado === 'pdf'}
                  />
                  <BotaoAccao
                    className="mt-2"
                    icone={Upload}
                    ocupado={ocupado === 'pdf'}
                    onClick={() => subir('pdf', pdfEscolhido, pdfDestaRonda ? par.pdf : null)}
                  >
                    {pdfDestaRonda ? 'Substituir o PDF' : 'Carregar este PDF'}
                  </BotaoAccao>
                </div>
              )}
            </>
          ) : (
            <div className="px-3 py-3 sm:px-4">
              <CampoFicheiro
                id="fx-pdf"
                label="PDF da revisão"
                obrigatorio
                ajuda="É o que se aprova, se carimba com as assinaturas e se distribui. Converta para PDF antes de carregar."
                accept="application/pdf,.pdf"
                ficheiro={pdfEscolhido}
                onEscolher={setPdfEscolhido}
                onLimpar={() => setPdfEscolhido(null)}
                ocupado={ocupado === 'pdf'}
                icone={FileText}
              />
              {pdfEscolhido && (
                <BotaoAccao className="mt-2" icone={Upload} ocupado={ocupado === 'pdf'} onClick={() => subir('pdf', pdfEscolhido, null)}>
                  Carregar o PDF
                </BotaoAccao>
              )}
            </div>
          )}
        </div>

        {/* editável — só para quem tem direito a vê-lo */}
        {podeVerEditavel !== false && (
          <div className={cn('overflow-hidden rounded-xl border', T.linha, T.superficie)}>
            <p className={cn('border-b px-3 py-2 text-sm font-semibold uppercase tracking-wider sm:px-4', T.linha, T.tintaMedia)}>
              Editável — a semente da revisão seguinte
            </p>
            {par?.editavel ? (
              <>
                <LinhaFicheiro
                  ficheiro={par.editavel}
                  papel="editavel"
                  aviso={!edtDestaRonda ? `Vem da ${par.editavel.ronda}.ª volta. Se alterou o documento, carregue o editável novo — é dele que sai a próxima revisão.` : null}
                />
                <div className={cn('border-t px-3 py-3 sm:px-4', T.linha)}>
                  <CampoFicheiro
                    id="fx-edt-novo"
                    label={edtDestaRonda ? 'Substituir o editável desta volta' : 'Carregar o editável actualizado'}
                    accept=".docx,.doc,.xlsx,.xls,.pptx,.ppt,.odt,.ods,.odp"
                    ficheiro={edtEscolhido}
                    onEscolher={setEdtEscolhido}
                    onLimpar={() => setEdtEscolhido(null)}
                    ocupado={ocupado === 'editavel'}
                    icone={Lock}
                  />
                  {edtEscolhido && (
                    <BotaoAccao className="mt-2" icone={Upload} ocupado={ocupado === 'editavel'} onClick={() => subir('editavel', edtEscolhido, edtDestaRonda ? par.editavel : null)}>
                      {edtDestaRonda ? 'Substituir o editável' : 'Carregar este editável'}
                    </BotaoAccao>
                  )}
                </div>
              </>
            ) : (
              <div className="px-3 py-3 sm:px-4">
                <CampoFicheiro
                  id="fx-edt"
                  label="Ficheiro editável"
                  ajuda="Word, Excel ou PowerPoint. Fica no armazenamento privado, sob «editaveis/», e nunca sai por um link partilhável nem vai em anexo de email."
                  accept=".docx,.doc,.xlsx,.xls,.pptx,.ppt,.odt,.ods,.odp"
                  ficheiro={edtEscolhido}
                  onEscolher={setEdtEscolhido}
                  onLimpar={() => setEdtEscolhido(null)}
                  ocupado={ocupado === 'editavel'}
                  icone={Lock}
                />
                {edtEscolhido ? (
                  <BotaoAccao className="mt-2" icone={Upload} ocupado={ocupado === 'editavel'} onClick={() => subir('editavel', edtEscolhido, null)}>
                    Carregar o editável
                  </BotaoAccao>
                ) : (
                  <p className={cn('mt-2 max-w-prose text-sm', T.tintaFraca)}>
                    Se este documento não tem original editável, pode submeter sem ele: no momento de assinar vai ser-lhe pedido que diga porquê, e essa justificação fica registada.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── o resumo e os intervenientes ─────────────────────────────────── */}
      <section className="space-y-3">
        <h3 className={cn('text-base font-semibold', T.tinta)}>Quem revê, quem aprova, e o que muda</h3>

        <Campo
          id="fx-resumo"
          label="O que muda nesta revisão"
          ajuda="Em linguagem de gente. É o que o revisor e o director lêem no email antes de abrir o documento, e é a sexta coluna do Registo de Emendas."
        >
          <Textarea id="fx-resumo" rows={3} value={resumo} onChange={e => setResumo(e.target.value)} />
        </Campo>

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo id="fx-revisor" label="Revisor" obrigatorio ajuda="Não se pode trocar depois de o fluxo seguir." erro={revisorEhElaborador ? 'Quem elabora não pode revê-lo: é a separação de funções que a assinatura não consegue provar sozinha.' : null}>
            <Select id="fx-revisor" options={opcoesPessoas} value={revisor} onValueChange={setRevisor} placeholder="Escolher o revisor" />
          </Campo>
          <Campo id="fx-director" label="Director que aprova" ajuda="Em branco, fica o responsável do aeroporto. O suplente nomeado também pode assinar." erro={mesmaPessoa ? 'O revisor e o director têm de ser pessoas diferentes.' : null}>
            <Select id="fx-director" options={opcoesDirector} value={director} onValueChange={setDirector} placeholder="Escolher o director" />
          </Campo>
        </div>

        {(directoresQ.data || []).length === 0 && fluxo?.aeroporto_id && (
          <Caixa tom="atencao" titulo="Este aeroporto não tem responsável com conta no portal">
            <p>
              Sem director com conta, a aprovação não chega ao fim. Escolha explicitamente quem aprova, ou peça à gestão do portal
              que registe o responsável deste aeroporto (e, se estiver ausente, que nomeie um suplente).
            </p>
          </Caixa>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <BotaoAccao
            variant="outline"
            icone={Save}
            ocupado={ocupado === 'preparacao'}
            disabled={mesmaPessoa || revisorEhElaborador || ocupado === 'preparacao'}
            onClick={guardar}
          >
            Guardar
          </BotaoAccao>
          {guardado && <span className={cn('text-sm', T.verde)}>Guardado.</span>}
        </div>
      </section>

      {erro && <Caixa tom="perigo" titulo="Não foi possível concluir"><p>{erro}</p></Caixa>}

      {!par?.pdf && (
        <Caixa tom="info" titulo="Falta o PDF para poder submeter">
          <p>A submissão é um acto assinado e assina-se o PDF. Carregue-o acima e o botão de submeter aparece.</p>
        </Caixa>
      )}
    </div>
  );
}

