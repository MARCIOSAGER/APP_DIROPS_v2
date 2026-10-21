// Diálogo «Converter para o editor» (carregado só quando se abre — traz o conversor, o TipTap e a pré-visualização).
// Lê o .docx da versão escolhida, converte-o (edicao/converterWord.js), mostra o relatório e a vista lado a lado
// (PDF da revisão ↔ convertido) com o encaixe secção a secção editável, e cria o rascunho do editor.
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateHTML } from '@tiptap/core';
import { AlertTriangle, CheckCircle2, FileInput, Loader2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Select from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { T } from '../../PortalLayout';
import { auditarDocs, useAeroportosDocs } from '../../hooks';
import { urlDoFicheiroVersao } from '../../ficheiroVersao';
import { obterUrlAssinadaDocumento } from '@/functions/obterUrlAssinadaDocumento';
import { ehPdfVersao, ehVersaoFonte, pdfDaVersao } from '../../compararVersoes';
import { modeloPadraoDe } from '../../edicao/modelosPadrao';
import { escolherModelo } from '../../edicao/assistente';
import { textoDoNo, validarDocumentoEstruturado } from '../../edicao/contrato';
import { extensoesContrato } from '../../edicao/extensoes';
import { ESTILO_PROSA } from '../../edicao/EditorSeccao';
import { useModelosDocumento, criarRascunhoEstruturado, useRecarregarRascunhos } from '../../edicao/hooksEstruturado';
import { rotaRedigir } from '../../pages/gestao/PortalRedigir';
import { seccoesDoModelo, ROTULO_DESCARTE, DESCRICAO_CONVERSAO } from '../../edicao/converterWord';

const carregarConversor = () => import('../../edicao/converterWord');
const fmtKB = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);

// ── pré-visualização simples do convertido ──────────────────────────────────
function PreVisualizacaoConvertido({ conteudo, ext }) {
  return (
    <article className="prose-gd-pre space-y-4 p-4 text-slate-900">
      <style>{ESTILO_PROSA}</style>
      {(conteudo?.seccoes || []).map((s, i) => {
        let html = '';
        try { html = generateHTML(s.conteudo, ext); } catch { html = ''; }
        const vazia = !textoDoNo(s.conteudo).trim() && !/<img|<table/.test(html);
        return (
          <section key={s.id}>
            <h3 className="mb-1.5 border-b border-slate-200 pb-1 text-base font-bold text-teal-900">
              {i + 1}. {s.titulo}{/^extra_/.test(s.chave) && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900">extra</span>}
            </h3>
            {vazia
              ? <p className="text-sm italic text-slate-400">{s.obrigatoria ? '(obrigatória — por preencher)' : '(vazia)'}</p>
              : <div className="gd-numerar" style={{ '--gd-sec': `"${i + 1}"` }}><div className="prose-gd text-sm" dangerouslySetInnerHTML={{ __html: html }} /></div>}
          </section>
        );
      })}
      <section>
        <h3 className="mb-1.5 border-b border-slate-200 pb-1 text-base font-bold text-teal-900">Histórico de revisões</h3>
        <table className="w-full border-collapse text-xs">
          <tbody>{(conteudo?.historico || []).map((h, i) => (
            <tr key={i}><td className="border border-slate-300 p-1">{h.revisao}</td><td className="border border-slate-300 p-1">{h.data}</td><td className="border border-slate-300 p-1">{h.descricao}</td><td className="border border-slate-300 p-1">{h.autor}</td></tr>
          ))}</tbody>
        </table>
      </section>
    </article>
  );
}

function Numero({ valor, rotulo, tom }) {
  return (
    <div className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800">
      <div className={cn('text-lg font-semibold tabular-nums', tom || T.tinta)}>{valor}</div>
      <div className={cn('text-xs', T.tintaFraca)}>{rotulo}</div>
    </div>
  );
}

// ── diálogo ─────────────────────────────────────────────────────────────────
export default function DialogoConverterWord({ doc, versoes, docx, user, onFechar }) {
  const navigate = useNavigate();
  const recarregarRascunhos = useRecarregarRascunhos();
  const { data: modelosQ } = useModelosDocumento();
  const { data: aeroportos = [] } = useAeroportosDocs();
  const modelo = useMemo(() => escolherModelo(modelosQ?.modelos, doc.classe_codigo) || modeloPadraoDe(doc.classe_codigo), [modelosQ, doc.classe_codigo]);
  const ext = useMemo(() => extensoesContrato(), []);

  const [versaoId, setVersaoId] = useState(docx[0]?.id || '');
  const versao = docx.find(v => v.id === versaoId) || null;
  const [estado, setEstado] = useState({ fase: 'escolher', progresso: '', erro: '' });
  const [res, setRes] = useState(null); // { blocos, historicoWord, relatorio }
  const [blocos, setBlocos] = useState([]);
  const [conv, setConv] = useState(null); // o módulo converterWord (carregado na conversão)
  const [pdfUrl, setPdfUrl] = useState('');
  const [pdfErro, setPdfErro] = useState('');
  const [aCriar, setACriar] = useState(false);

  const aero = aeroportos.find(a => a.id === doc.aeroporto_id) || null;
  const autor = user?.full_name || user?.email || '';
  const cabecalhoBase = useMemo(() => ({
    numero: doc.numero || '', titulo: doc.titulo || '', aeroporto: aero?.codigo_icao || '', aeroportoNome: aero?.nome || '',
    elaboradoPor: autor,
  }), [doc.numero, doc.titulo, aero, autor]);
  const extras = useMemo(() => ({
    modeloId: modelo?.id || null, documentoId: doc.id, processo: doc.processo_codigo || null, pastaId: doc.pasta_id || null,
    origem: 'conversao_word', versaoOrigemId: versao?.id || null,
  }), [modelo, doc, versao]);

  // documento final (recalculado quando se muda o encaixe)
  const conteudo = useMemo(() => {
    if (!conv || !res) return null;
    const base = conv.montarDocumento({ blocos, modelo, cabecalho: cabecalhoBase, historico: res.historicoWord, extras });
    return conv.aplicarRevisaoConversao(base, { autor });
  }, [conv, res, blocos, modelo, cabecalhoBase, extras, autor]);
  const preservado = useMemo(() => (conv && res && conteudo ? conv.calcularPreservado({ ...res.relatorio, texto: { ...res.relatorio.texto } }, conteudo, blocos) : null), [conv, res, conteudo, blocos]);
  const obrigVazias = (conteudo?.seccoes || []).filter(s => s.obrigatoria && !textoDoNo(s.conteudo).trim()).map(s => s.titulo);

  // PDF da revisão (lado esquerdo): o PDF irmão do .docx escolhido; senão o ficheiro em vigor do documento
  useEffect(() => {
    if (estado.fase !== 'resultado') return undefined;
    let vivo = true;
    setPdfErro('');
    (async () => {
      const irmao = versao ? pdfDaVersao(versao, versoes) : null;
      if (irmao?.versao && ehPdfVersao(irmao.versao)) return urlDoFicheiroVersao(irmao.versao, doc);
      const r = await obterUrlAssinadaDocumento({ documento_id: doc.id });
      return r?.url || '';
    })()
      .then(u => { if (vivo) setPdfUrl(u || ''); })
      .catch(e => { if (vivo) setPdfErro(e?.message || 'Não foi possível abrir o PDF da revisão.'); });
    return () => { vivo = false; };
  }, [estado.fase, versao, versoes, doc]);

  const converter = async () => {
    if (!versao || !modelo) return;
    setEstado({ fase: 'convertendo', progresso: 'A descarregar o Word…', erro: '' });
    try {
      const url = await urlDoFicheiroVersao(versao, doc);
      const r = await fetch(url);
      if (!r.ok) throw new Error(`Não foi possível descarregar o Word (${r.status}).`);
      const arrayBuffer = await r.arrayBuffer();
      setEstado(e => ({ ...e, progresso: 'A preparar o conversor…' }));
      const m = await carregarConversor();
      const out = await m.lerDocx({ arrayBuffer, modelo, onProgresso: (t) => setEstado(e => ({ ...e, progresso: t })) });
      setConv(m);
      setRes(out);
      setBlocos(out.blocos);
      setEstado({ fase: 'resultado', progresso: '', erro: '' });
    } catch (e) {
      setEstado({ fase: 'escolher', progresso: '', erro: e?.message || String(e) });
    }
  };

  const criar = async () => {
    if (!conteudo) return;
    const v = validarDocumentoEstruturado(conteudo);
    if (!v.valido) { setEstado(e => ({ ...e, erro: `O resultado não respeita o modelo: ${v.erros.slice(0, 3).join('; ')}` })); return; }
    setACriar(true);
    try {
      const r = await criarRascunhoEstruturado({ conteudo, aeroportoId: doc.aeroporto_id || null, documentoId: doc.id, modeloId: modelo?.id || null }, user);
      await auditarDocs(user, { acao: 'documento_conversao_editor', id: doc.id, detalhes: `Word v${versao?.versao ?? '?'} convertido para o editor (revisão ${conteudo.cabecalho.revisao} em rascunho)` }).catch(() => {});
      recarregarRascunhos();
      navigate(rotaRedigir(r.id));
    } catch (e) {
      setEstado(s => ({ ...s, erro: e?.message || String(e) }));
      setACriar(false);
    }
  };

  const opcoesVersao = docx.map(v => ({ value: v.id, label: `v${v.versao}${v.rotulo ? ` · ${v.rotulo}` : ''}${ehVersaoFonte(v) ? ' (fonte editável)' : ''} — ${v.arquivo_nome || 'ficheiro .docx'}` }));
  const opcoesDestino = [
    { value: '', label: 'Secção extra (fica com o título do Word)' },
    ...seccoesDoModelo(modelo).map(s => ({ value: s.chave, label: `${s.titulo}${s.obrigatoria ? ' *' : ''}` })),
  ];
  const rel = res?.relatorio;
  const descartadosAgrupados = useMemo(() => {
    const m = new Map();
    for (const d of rel?.descartados || []) m.set(d.tipo, (m.get(d.tipo) || 0) + 1);
    return [...m.entries()].map(([tipo, n]) => `${ROTULO_DESCARTE[tipo] || tipo}${n > 1 ? ` (${n})` : ''}`);
  }, [rel]);

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !aCriar && estado.fase !== 'convertendo') onFechar(); }}>
      <DialogContent className={cn('flex flex-col gap-3', estado.fase === 'resultado' ? 'h-[94vh] max-w-[96vw]' : 'max-w-xl')}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileInput className="h-5 w-5 text-teal-700" aria-hidden="true" />Converter para o editor</DialogTitle>
          <DialogDescription>
            Lê o Word de {doc.numero || 'este documento'} e prepara um rascunho no editor de secções ({modelo?.nome || doc.classe_codigo}).
            O documento e as versões existentes não mudam: só nasce um rascunho, com a revisão seguinte.
          </DialogDescription>
        </DialogHeader>

        {estado.fase !== 'resultado' && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="cv-versao" className={cn('text-sm font-medium', T.tinta)}>Versão em Word</label>
              <Select id="cv-versao" options={opcoesVersao} value={versaoId} onValueChange={setVersaoId} searchable={false} disabled={estado.fase === 'convertendo'} />
              <p className={cn('text-xs', T.tintaFraca)}>Por omissão, a fonte editável mais recente. A capa, o índice, a lista de distribuição e as páginas efectivas do Word não passam: o editor faz as suas. O controlo de revisões passa para o histórico.</p>
            </div>
            {estado.fase === 'convertendo' && <p role="status" className={cn('flex items-center gap-2 text-sm', T.tintaFraca)}><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{estado.progresso}</p>}
            {estado.erro && <p role="alert" className={cn('flex items-start gap-2 text-sm', T.vermelho)}><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{estado.erro}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={onFechar} disabled={estado.fase === 'convertendo'}>Cancelar</Button>
              <Button onClick={converter} disabled={!versao || !modelo || estado.fase === 'convertendo'}>
                {estado.fase === 'convertendo' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Wand2 className="h-4 w-4" aria-hidden="true" />}Converter
              </Button>
            </DialogFooter>
          </div>
        )}

        {estado.fase === 'resultado' && rel && conteudo && (
          <>
            {/* relatório */}
            <div className="grid shrink-0 grid-cols-3 gap-2 sm:grid-cols-6">
              <Numero valor={`${preservado?.percentagemConteudo ?? '—'}%`} rotulo="texto preservado" tom={(preservado?.percentagemConteudo ?? 0) >= 95 ? T.verde : T.ambar} />
              <Numero valor={new Set(blocos.map(b => b.destino).filter(Boolean)).size} rotulo="secções do modelo preenchidas" />
              <Numero valor={blocos.filter(b => !b.destino).length} rotulo="secções extra" />
              <Numero valor={`${rel.imagens.convertidas}/${rel.imagens.total}`} rotulo={`imagens (${fmtKB(rel.imagens.bytes)})`} tom={rel.imagens.perdidas ? T.ambar : undefined} />
              <Numero valor={rel.tabelas.total} rotulo="tabelas" />
              <Numero valor={res.historicoWord.length} rotulo="revisões no histórico" />
            </div>
            <div className={cn('shrink-0 space-y-1 text-xs', T.tintaMedia)}>
              {descartadosAgrupados.length > 0 && <p><b>Não passam (o editor gera os seus):</b> {descartadosAgrupados.join(', ')}.</p>}
              <p><b>Revisão do rascunho:</b> {conteudo.cabecalho.revisao} — «{DESCRICAO_CONVERSAO}».{rel.subdivididos?.length ? ` Capítulos partidos pelos subtítulos: ${rel.subdivididos.join(', ')}.` : ''}</p>
              {obrigVazias.length > 0 && <p className={T.ambar}><b>Secções obrigatórias por preencher:</b> {obrigVazias.join(', ')} — escolha a origem no encaixe ou escreva-as no editor.</p>}
              {rel.avisos.map((a, i) => <p key={i} className={cn('flex items-start gap-1.5', T.ambar)}><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />{a}</p>)}
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_20rem]">
              {/* esquerda: o PDF da revisão */}
              <section className="flex min-h-0 flex-col rounded-lg border border-slate-200 dark:border-slate-800" aria-label="PDF da revisão">
                <h4 className={cn('border-b px-3 py-1.5 text-xs font-semibold uppercase tracking-wide', T.linha, T.tintaFraca)}>Original (PDF)</h4>
                {pdfUrl
                  ? <iframe title="PDF da revisão" src={pdfUrl} className="min-h-0 w-full flex-1" />
                  : <p className={cn('p-4 text-sm', pdfErro ? T.vermelho : T.tintaFraca)}>{pdfErro || 'A abrir o PDF…'}</p>}
              </section>
              {/* centro: pré-visualização do convertido */}
              <section className="flex min-h-0 flex-col rounded-lg border border-slate-200 bg-white dark:border-slate-800" aria-label="Pré-visualização do convertido">
                <h4 className={cn('border-b px-3 py-1.5 text-xs font-semibold uppercase tracking-wide', T.linha, T.tintaFraca)}>Convertido (editor)</h4>
                <div className="min-h-0 flex-1 overflow-auto"><PreVisualizacaoConvertido conteudo={conteudo} ext={ext} /></div>
              </section>
              {/* direita: encaixe secção a secção */}
              <section className="flex min-h-0 flex-col rounded-lg border border-slate-200 dark:border-slate-800" aria-label="Encaixe das secções">
                <h4 className={cn('border-b px-3 py-1.5 text-xs font-semibold uppercase tracking-wide', T.linha, T.tintaFraca)}>Secção do Word → secção do modelo</h4>
                <ol className="min-h-0 flex-1 space-y-2 overflow-auto p-2">
                  {blocos.map((b, i) => (
                    <li key={b.id} className="space-y-1 rounded-md border border-slate-100 p-2 dark:border-slate-800">
                      <div className={cn('text-xs font-medium', T.tinta)} title={b.tituloOriginal || b.titulo}>
                        {b.preambulo ? '(texto antes do primeiro título)' : (b.tituloOriginal || b.titulo)}
                        <span className={cn('ml-1 font-normal', T.tintaFraca)}>· {b.caracteres} car.</span>
                      </div>
                      <Select
                        id={`cv-dest-${i}`}
                        options={opcoesDestino}
                        value={b.destino || ''}
                        searchable={false}
                        onValueChange={(v) => setBlocos(bs => bs.map(x => (x.id === b.id ? { ...x, destino: v || '' } : x)))}
                      />
                    </li>
                  ))}
                </ol>
              </section>
            </div>

            {estado.erro && <p role="alert" className={cn('flex items-start gap-2 text-sm', T.vermelho)}><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{estado.erro}</p>}
            <DialogFooter className="shrink-0">
              <Button variant="outline" onClick={() => { setEstado({ fase: 'escolher', progresso: '', erro: '' }); setRes(null); setPdfUrl(''); }} disabled={aCriar}>Outra versão</Button>
              <Button variant="outline" onClick={onFechar} disabled={aCriar}>Cancelar</Button>
              <Button onClick={criar} disabled={aCriar}>
                {aCriar ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}Criar rascunho no editor
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
