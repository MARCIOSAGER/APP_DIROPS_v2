// «Gerar para os aeroportos» (modelo-mestre): escolhe os alvos, mostra a revisão que vai sair, quem aprova e os
// campos em falta, pré-visualiza o PDF de um aeroporto e gera um rascunho do editor por documento.
// Com «Preparar para submissão» (ligado por omissão) gera também a revisão em rascunho (PDF + Word) e abre o
// fluxo de aprovação em rascunho — sem assinar nem avisar ninguém. O elaborador do fluxo é SEMPRE quem o abre
// (documento_fluxo_abrir usa a sessão), por isso essa opção só existe para a conta elaboradora do mestre.
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Eye, FileCheck2, Loader2, Stamp, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Select from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import { T, Ref } from '../../PortalLayout';
import { enderecoFluxo } from '../../apiFluxo';
import { alvosDoMestre, problemasPrepararSubmissao } from '../../edicao/mestres';
import { prepararAlvosDoMestre, gerarRascunhosDoMestre, preverPdf } from '../../edicao/hooksEstruturado';
import { rotaRedigir } from './PortalRedigir';

const chaveDe = (l) => l.alvo.documento_id || `${l.alvo.icao}-${l.alvo.numero}`;

export default function DialogoGerarMestre({ mestre, onFechar }) {
  const { user } = useAuth();
  const alvos = useMemo(() => alvosDoMestre(mestre?.conteudo), [mestre?.conteudo]);
  const [linhas, setLinhas] = useState(null);
  const [erroLer, setErroLer] = useState('');
  const [sel, setSel] = useState(() => new Set());
  const [decisoes, setDecisoes] = useState({});
  const [preparar, setPreparar] = useState(true);
  const [previa, setPrevia] = useState('');
  const [pdfUrl, setPdfUrl] = useState(null);
  const [aPrever, setAPrever] = useState(false);
  const [fase, setFase] = useState('');
  const [busy, setBusy] = useState(false);
  const [resultado, setResultado] = useState(null);

  useEffect(() => {
    let vivo = true;
    prepararAlvosDoMestre(mestre, alvos, user)
      .then(ls => {
        if (!vivo) return;
        setLinhas(ls);
        setSel(new Set(ls.filter(l => !l.erro).map(chaveDe)));
        setPrevia(ls.find(l => !l.erro) ? chaveDe(ls.find(l => !l.erro)) : '');
      })
      .catch(e => vivo && setErroLer(e?.message || String(e)));
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mestre?.id, alvos, user?.email]);
  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);

  // «Preparar para submissão» só para quem fica como elaborador
  const problemasPreparar = useMemo(() => problemasPrepararSubmissao({ eu: user?.email, conteudoMestre: mestre?.conteudo }), [user?.email, mestre?.conteudo]);
  const podePreparar = problemasPreparar.length === 0;
  const prepararEfectivo = preparar && podePreparar;

  const escolhidas = (linhas || []).filter(l => sel.has(chaveDe(l)) && !l.erro);
  const conflitosSemDecisao = escolhidas.filter(l => l.conflito && !decisoes[l.alvo.documento_id]);
  const alternar = (k) => setSel(s => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  const verPdf = async () => {
    const l = (linhas || []).find(x => chaveDe(x) === previa);
    if (!l?.conteudo) return;
    setAPrever(true);
    try { const blob = await preverPdf(l.conteudo); if (pdfUrl) URL.revokeObjectURL(pdfUrl); setPdfUrl(URL.createObjectURL(blob)); }
    catch (e) { setErroLer(`Pré-visualização: ${e?.message || e}`); }
    finally { setAPrever(false); }
  };

  const gerar = async () => {
    setBusy(true); setResultado(null);
    try {
      const r = await gerarRascunhosDoMestre(mestre, escolhidas.map(l => l.alvo), user, setFase, { decisoes, preparar: prepararEfectivo, linhas: escolhidas });
      setResultado(r);
    } catch (e) {
      setResultado({ criados: [], actualizados: [], conflitos: [], saltados: [], preparados: [], erros: [{ alvo: {}, erro: e?.message || String(e) }] });
    } finally { setBusy(false); setFase(''); }
  };

  const fechar = () => { if (!busy) onFechar(); };
  const opcoesPrevia = (linhas || []).filter(l => !l.erro).map(l => ({ value: chaveDe(l), label: `${l.aeroporto?.codigo_icao} · ${l.conteudo?.cabecalho?.numero || ''}` }));

  return (
    <Dialog open onOpenChange={(o) => !o && fechar()}>
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileCheck2 className="h-5 w-5 text-teal-600" aria-hidden="true" />Gerar para os aeroportos</DialogTitle>
          <DialogDescription>
            Um rascunho do editor por documento, já preenchido com os dados do aeroporto. O documento em vigor não muda; nada é assinado e ninguém é avisado.
          </DialogDescription>
        </DialogHeader>

        {resultado ? <Resultado r={resultado} preparou={prepararEfectivo} /> : erroLer && !linhas ? (
          <p className={cn('text-sm', T.vermelho)} role="alert">{erroLer}</p>
        ) : !linhas ? (
          <p className={cn('flex items-center gap-2 text-sm', T.tintaFraca)} role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />A ler os documentos e os aeroportos…</p>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={cn('border-b text-left', T.linha, T.tintaFraca)}>
                    <th className="w-8 py-2" />
                    <th className="py-2 pr-3 font-medium">Aeroporto</th>
                    <th className="py-2 pr-3 font-medium">Documento</th>
                    <th className="py-2 pr-3 font-medium">Revisão</th>
                    <th className="py-2 pr-3 font-medium">Aprova</th>
                    <th className="py-2 font-medium">Avisos</th>
                  </tr>
                </thead>
                <tbody className={cn('divide-y', T.divisoria)}>
                  {linhas.map(l => {
                    const k = chaveDe(l);
                    return (
                      <tr key={k} className="align-top">
                        <td className="py-2"><input type="checkbox" checked={sel.has(k)} disabled={!!l.erro || busy} onChange={() => alternar(k)} aria-label={`Gerar para ${l.alvo.icao}`} /></td>
                        <td className="py-2 pr-3 font-medium">{l.aeroporto?.codigo_icao || l.alvo.icao}</td>
                        <td className="py-2 pr-3"><Ref className="font-semibold">{l.alvo.numero || l.documento?.numero}</Ref><div className={cn('text-xs', T.tintaFraca)}>{l.documento?.titulo}</div></td>
                        <td className="py-2 pr-3 tabular-nums">{l.revisao || '—'}</td>
                        <td className="py-2 pr-3">{l.director?.nome || '—'}<div className={cn('text-xs', T.tintaFraca)}>{l.director?.email || 'sem responsável principal'}</div></td>
                        <td className="py-2">
                          {l.erro && <p className={T.vermelho}>{l.erro}</p>}
                          {(l.avisos || []).map((a, i) => <p key={i} className={T.ambar}>{a}</p>)}
                          {l.conflito && (
                            <div className="mt-1 space-y-1">
                              <p className={T.ambar}>Já tem um rascunho no editor ({l.rascunhoExistente?.estado === 'gerado' ? 'gerado' : 'em edição'}, Rev. {l.rascunhoExistente?.revisao || '?'}).</p>
                              <div className="flex gap-3">
                                {['substituir', 'saltar'].map(d => (
                                  <label key={d} className="inline-flex items-center gap-1">
                                    <input type="radio" name={`dec-${k}`} checked={decisoes[l.alvo.documento_id] === d} disabled={busy} onChange={() => setDecisoes(x => ({ ...x, [l.alvo.documento_id]: d }))} />
                                    {d === 'substituir' ? 'Substituir o texto' : 'Saltar'}
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                          {!l.erro && !(l.avisos || []).length && !l.conflito && <span className={T.verde}>sem avisos</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className={cn(T.caixa, 'flex flex-wrap items-end gap-3 p-3')}>
              <div className="min-w-[16rem] flex-1">
                <label htmlFor="mestre-previa" className="mb-1 block text-sm font-medium">Pré-visualizar o PDF de</label>
                <Select id="mestre-previa" options={opcoesPrevia} value={previa} onValueChange={setPrevia} />
              </div>
              <Button variant="outline" onClick={verPdf} disabled={!previa || aPrever}>{aPrever ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}Ver o PDF</Button>
            </div>
            {pdfUrl && <iframe title="Pré-visualização do PDF do aeroporto" src={pdfUrl} className="h-[60vh] w-full rounded border" />}

            <div className={cn(T.caixa, 'space-y-1.5 p-3 text-sm')}>
              <label className="flex items-start gap-2">
                <input type="checkbox" className="mt-1" checked={prepararEfectivo} disabled={!podePreparar || busy} onChange={e => setPreparar(e.target.checked)} />
                <span>
                  <strong>Preparar para submissão</strong> — gera também a revisão em rascunho (PDF + Word) e abre o fluxo de aprovação de cada documento,
                  com revisor {mestre?.conteudo?.extras?.verificadoEmail || '—'} e o director do aeroporto. Fica em rascunho, à espera de ser submetido em
                  «Aprovações › Por submeter» (uma senha para todos).
                </span>
              </label>
              {!podePreparar && <ul className={cn('ml-6 list-disc', T.ambar)}>{problemasPreparar.map((p, i) => <li key={i}>{p}</li>)}<li>Pode gerar só os rascunhos do editor; a preparação faz-se depois com a conta certa.</li></ul>}
            </div>
            {erroLer && <p className={cn('text-sm', T.vermelho)} role="alert">{erroLer}</p>}
          </div>
        )}

        <DialogFooter className="items-center">
          {busy && <span className={cn('mr-auto flex items-center gap-2 text-sm', T.tintaFraca)} role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{fase}</span>}
          {!busy && !resultado && conflitosSemDecisao.length > 0 && <span className={cn('mr-auto text-sm', T.ambar)}>Escolha o que fazer aos {conflitosSemDecisao.length} documento(s) que já têm rascunho.</span>}
          <Button variant="outline" onClick={fechar} disabled={busy}>Fechar</Button>
          {!resultado && <Button onClick={gerar} disabled={busy || !linhas || !escolhidas.length || conflitosSemDecisao.length > 0}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileCheck2 className="h-4 w-4" aria-hidden="true" />}Gerar {escolhidas.length || ''}
          </Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Resultado({ r, preparou }) {
  const feitos = [...r.criados, ...r.actualizados];
  const fluxoDe = (alvo) => r.preparados.find(p => p.alvo === alvo);
  return (
    <div className="space-y-3 text-sm">
      <p className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />
        {feitos.length} rascunho(s) preparado(s){preparou ? `, ${r.preparados.length} fluxo(s) aberto(s)` : ''}{r.saltados.length ? `, ${r.saltados.length} saltado(s)` : ''}{r.erros.length ? `, ${r.erros.length} com erro` : ''}.
      </p>
      {feitos.length > 0 && (
        <ul className={cn('divide-y rounded-lg border', T.linha, T.divisoria)}>
          {feitos.map(c => {
            const f = fluxoDe(c.alvo);
            return (
              <li key={c.rascunhoId} className="flex flex-wrap items-center gap-3 px-3 py-2">
                <span className="w-14 font-medium">{c.alvo.icao}</span>
                <Link to={rotaRedigir(c.rascunhoId)} className={cn('hover:underline', T.acento)}><Ref>{c.alvo.numero}</Ref> · Rev. {c.revisao}</Link>
                {f?.fluxoId && <Link to={enderecoFluxo(f.fluxoId)} className={cn('inline-flex items-center gap-1 hover:underline', T.acento)}><Stamp className="h-4 w-4" aria-hidden="true" />fluxo em rascunho</Link>}
                {(c.avisos || []).length > 0 && <span className={cn('inline-flex items-center gap-1', T.ambar)}><AlertTriangle className="h-4 w-4" aria-hidden="true" />{c.avisos.join(' · ')}</span>}
              </li>
            );
          })}
        </ul>
      )}
      {r.conflitos.length > 0 && <p className={T.ambar}>Por decidir (já tinham rascunho): {r.conflitos.map(c => c.alvo.numero).join(', ')}.</p>}
      {r.erros.length > 0 && (
        <ul className="space-y-1">{r.erros.map((e, i) => <li key={i} className={cn('flex items-start gap-2', T.vermelho)}><XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{e.alvo?.icao ? `${e.alvo.icao} · ${e.alvo.numero}: ` : ''}{e.erro}</li>)}</ul>
      )}
      <p className={T.tintaFraca}>
        {preparou
          ? 'A seguir: em «Aprovações › Por submeter», escolha os documentos e submeta-os de uma vez com a sua senha. O revisor é avisado de cada um.'
          : 'A seguir: abra cada rascunho, reveja, «Gerar rascunho» e «Pedir aprovação» como de costume.'}
      </p>
    </div>
  );
}
