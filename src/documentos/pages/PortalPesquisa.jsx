// Pesquisa do Portal de Documentos. Duas pesquisas, uma lista:
//   • nos DADOS do documento (título, número, descrição, etiquetas) — coluna `pesquisa` do documento;
//   • DENTRO DO CONTEÚDO dos ficheiros — índice por página (migração 151), via `documentos_pesquisa_conteudo`.
// O índice do conteúdo é por PÁGINA e não por documento porque o `tsvector` do PostgreSQL não passa de 1 MB nem
// de 16.383 posições: um manual digitalizado num só valor rebentaria ou truncaria em silêncio. Como é por página,
// a resposta diz onde está — «página 47» — que é o que as pessoas querem quando procuram dentro de um manual.
//
// O excerto chega do servidor com o termo entre ⟦ e ⟧ e NÃO em HTML: a documentação do PostgreSQL avisa que o
// resultado do `ts_headline` não é seguro para HTML. Partimos nessas marcas e desenhamos <mark> como elemento —
// não há `dangerouslySetInnerHTML` nesta página, nem pode haver.
//
// O termo e os filtros vão no endereço (?q=…) para a pesquisa poder ser partilhada, guardada nos favoritos ou
// citada num relatório de auditoria. O servidor só devolve o que a pessoa pode ver — por isso o âmbito é declarado
// em texto por cima dos resultados, agora com a cobertura do índice: sem isso, alguém concluiria que «não existe»
// aquilo que apenas ainda não foi indexado, e numa auditoria isso é uma afirmação falsa.
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, FileSearch, LayoutGrid, Library, Loader2, Quote, ScanLine, Search, SearchX, Table2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { PORTAL_BASE, ESTADOS_DOCUMENTO, ESTADO_LABEL } from '@/lib/portalDocumentos';
import {
  useAeroportosDocs, useTiposDocumento, usePesquisaDocs, useDocumentosDocs,
  usePesquisaConteudoDocs, useCoberturaConteudoDocs, MARCA_INICIO, MARCA_FIM,
} from '../hooks';
import {
  tk, cartao, Vazio, Falha, EsqueletoTabela, TabelaDocumentos, ListaDocumentos, FichasFiltro, ResumoFiltros,
  mapaPorId, rotuloTipo, ordenarDocs, alturaDensidade, preferenciaDensidadeDocs, guardarPreferenciaDensidadeDocs,
  DENSIDADES, OPCOES_VALIDADE, correspondeValidade, correspondeTipo, SEM_TIPO, urlDoc, PainelDocumento,
  realcar, EstadoChip, ValidadeChip, rotuloAero, versaoDoc,
  correspondeProcesso, correspondeClasse, fichasCodigo, rotuloCodigo, textoProcesso, tituloProcesso,
  abrirDocumento,
} from './PortalBiblioteca';
// «Por manual» e «por classe» (migração 157): é assim que um inspector procura — não pelo tipo do ficheiro, mas
// por aquilo de que o documento faz parte.
import { useDocumentosCodificados, useCodificacao } from '../hooksCodificacao';

const MINIMO = 2;
const VISTAS = ['passagens', 'tabela', 'grelha'];
const contar = (lista, teste) => lista.reduce((n, d) => n + (teste(d) ? 1 : 0), 0);

// Realce do excerto vindo do servidor. As marcas ⟦ ⟧ vêm sempre em pares e não se aninham (é o que o ts_headline
// produz), por isso os pedaços ímpares são exactamente o que foi encontrado. O texto entra como texto, nunca como
// HTML — é esta a razão de haver marcas em vez de <b>.
function realcarExcerto(texto) {
  const partes = String(texto || '').split(new RegExp(`[${MARCA_INICIO}${MARCA_FIM}]`));
  return partes.map((p, i) => (i % 2 === 1
    ? <mark key={`e${i}`} className="rounded bg-amber-200 px-0.5 text-slate-900 dark:bg-amber-400/40 dark:text-amber-50">{p}</mark>
    : <React.Fragment key={`t${i}`}>{p}</React.Fragment>));
}

// Endereço da ficha com a página onde o termo foi encontrado, para a leitura começar no sítio certo — e com o
// termo, para o leitor o realçar na página em vez de deixar a pessoa a varrê-la com os olhos.
const urlDocPagina = (id, pagina, termo) => {
  if (!pagina && !termo) return urlDoc(id);
  const p = new URLSearchParams();
  if (pagina) p.set('pagina', String(pagina));
  if (termo) p.set('termo', termo);
  return `${urlDoc(id)}?${p.toString()}`;
};

// ── vista «Passagens»: um bloco por documento, com as páginas onde o termo aparece ──
// É a vista por omissão quando há acertos no conteúdo, porque é a única que responde «onde». A tabela densa da
// Biblioteca continua a um clique, para quem quer comparar estado, versão e validade em coluna.
function BlocoPassagem({ doc, tipos, aeroportos, termo }) {
  const c = doc.conteudo;
  const tipo = rotuloTipo(tipos, doc.tipo_id);
  const aero = rotuloAero(aeroportos, doc.aeroporto_id);
  const excertos = (c?.excertos || []).filter(x => x?.excerto);
  return (
    <li className={cn(cartao, 'overflow-hidden')}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 pt-3.5">
        <div className="min-w-0 flex-1">
          {/* o título leva à melhor página do acerto, não ao princípio do manual */}
          <Link to={urlDocPagina(doc.id, c?.paginaFonte, excertos.length ? termo : '')} className={cn('block rounded', tk.foco)}>
            <span className={cn('block font-semibold leading-snug', tk.tinta)}>{realcar(doc.titulo, termo)}</span>
            <span className={cn('mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm', tk.tintaFraca)}>
              {doc.numero
                ? <span className={tk.mono}>{realcar(doc.numero, termo)}</span>
                : <span className="italic">sem número</span>}
              {tipo && <span>{tipo}</span>}
              {/* de que manual ou programa faz parte: é o que situa o acerto dentro do acervo */}
              {textoProcesso(doc) && <span className="max-w-[20rem] truncate" title={tituloProcesso(doc)}>{textoProcesso(doc)}</span>}
              {aero && <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" aria-hidden="true" />{aero}</span>}
              <span className={tk.mono}>v{versaoDoc(doc)}</span>
            </span>
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <EstadoChip estado={doc.estado} />
          <ValidadeChip documento={doc} />
        </div>
      </div>

      {excertos.length > 0 ? (
        <>
          <p className={cn('px-4 pb-1 pt-2.5 text-xs font-semibold uppercase tracking-wider', tk.tintaFraca)}>
            {c.paginas === 1
              ? 'Encontrado em 1 página do ficheiro'
              : <>Encontrado em <span className="tabular-nums">{c.paginas}</span> páginas do ficheiro{excertos.length < c.paginas ? <> — as <span className="tabular-nums">{excertos.length}</span> mais relevantes</> : null}</>}
          </p>
          <ul className={cn('divide-y border-t', tk.divisoria, tk.borda)}>
            {excertos.map((x) => (
              <li key={`${doc.id}-${x.pagina}`}>
                <Link
                  to={urlDocPagina(doc.id, x.pagina_fonte, termo)}
                  className={cn('flex min-h-[2.75rem] items-start gap-3 px-4 py-2.5 transition-colors', tk.hover,
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-600 dark:focus-visible:ring-teal-400')}
                >
                  <Quote className={cn('mt-1 h-3.5 w-3.5 shrink-0', tk.tintaTenue)} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-sm leading-relaxed', tk.tintaMedia)}>{realcarExcerto(x.excerto)}</span>
                    <span className={cn('mt-1 block text-sm', tk.mono, tk.acento)}>{x.rotulo}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className={cn('px-4 pb-3.5 pt-1.5 text-sm', tk.tintaFraca)}>
          Encontrado nos dados do documento — título, número, descrição ou etiquetas.
        </p>
      )}
    </li>
  );
}

export default function PortalPesquisa() {
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const termo = sp.get('q') || '';
  const fAero = sp.get('aeroporto') || '';
  const fTipo = sp.get('tipo') || '';
  const fEstado = sp.get('estado') || '';
  const fValidade = sp.get('validade') || '';
  const fManual = sp.get('manual') || '';          // processo: de que manual ou programa faz parte
  const fClasse = sp.get('classe') || '';          // classe: o que o documento é
  const vistaEscolhida = VISTAS.includes(sp.get('vista')) ? sp.get('vista') : '';
  const ordem = sp.get('ord') || 'actualizado';
  const dir = sp.get('dir') === 'asc' ? 'asc' : 'desc';
  const selId = sp.get('sel') || '';

  // Caixa de texto local; o endereço só é actualizado depois de a pessoa parar de escrever.
  const [texto, setTexto] = useState(termo);
  const [densidade, setDensidade] = useState(preferenciaDensidadeDocs);
  useEffect(() => { setTexto(termo); }, [termo]);

  const actualizar = useCallback((patch, { replace = false } = {}) => {
    const p = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) { if (v) p.set(k, v); else p.delete(k); }
    setSp(p, { replace });
  }, [sp, setSp]);

  useEffect(() => {
    if (texto === termo) return undefined;
    const id = setTimeout(() => actualizar({ q: texto }, { replace: true }), 350);
    return () => clearTimeout(id);
  }, [texto, termo, actualizar]);

  const aeroQ = useAeroportosDocs();
  const tiposQ = useTiposDocumento();
  const metaQ = usePesquisaDocs(termo);
  const conteudoQ = usePesquisaConteudoDocs(termo);
  const coberturaQ = useCoberturaConteudoDocs();
  const sugestoesQ = useDocumentosDocs({ estado: 'em_vigor', limite: 6 });

  const cod = useCodificacao();
  const mapaAero = useMemo(() => mapaPorId(aeroQ.data), [aeroQ.data]);
  const mapaTipos = useMemo(() => mapaPorId(tiposQ.data), [tiposQ.data]);
  const curto = termo.trim().length < MINIMO;

  // Uma só lista. O conteúdo manda na ordem (quem aparece dentro do ficheiro é um acerto mais forte do que quem
  // só bate no título), e um documento que acerta nas duas pesquisas aparece uma vez, com os excertos.
  const brutos = useMemo(() => {
    const porConteudo = conteudoQ.data || [];
    const porMeta = metaQ.data || [];
    const vistos = new Set(porConteudo.map(d => d.id));
    return [...porConteudo, ...porMeta.filter(d => !vistos.has(d.id))];
  }, [conteudoQ.data, metaQ.data]);
  // A codificação cola-se aos resultados preservando o que a pesquisa lhes anexou (os excertos do conteúdo).
  const resultados = useDocumentosCodificados(brutos);
  const comConteudo = useMemo(() => resultados.filter(d => d.conteudo?.excertos?.length).length, [resultados]);
  const vista = vistaEscolhida || (comConteudo > 0 ? 'passagens' : 'tabela');

  // Cada filtro é um teste com nome: a lista final é a conjunção de todos, e a contagem de cada ficha é a
  // conjunção de todos MENOS o seu — senão a ficha diria o total e deixaria de prever o que o clique dá.
  const testes = useMemo(() => ({
    aeroporto: (d) => !fAero || d.aeroporto_id === fAero,
    tipo: (d) => correspondeTipo(d, fTipo),
    estado: (d) => !fEstado || d.estado === fEstado,
    validade: (d) => correspondeValidade(d, fValidade),
    manual: (d) => correspondeProcesso(d, fManual),
    classe: (d) => correspondeClasse(d, fClasse),
  }), [fAero, fTipo, fEstado, fValidade, fManual, fClasse]);
  const excepto = useCallback((chave) => {
    const outros = Object.entries(testes).filter(([k]) => k !== chave).map(([, fn]) => fn);
    return resultados.filter(d => outros.every(fn => fn(d)));
  }, [resultados, testes]);

  const filtrados = useMemo(() => resultados.filter(d => Object.values(testes).every(fn => fn(d))), [resultados, testes]);
  // Na vista das passagens a ordem é a relevância que o servidor calculou; nas outras, a coluna escolhida.
  const ordenados = useMemo(() => (vista === 'passagens' ? filtrados : ordenarDocs(filtrados, ordem, dir)),
    [filtrados, vista, ordem, dir]);

  const fichasAero = useMemo(() => {
    const lista = excepto('aeroporto');
    return (aeroQ.data || []).map(a => ({ value: a.id, label: a.codigo_icao || a.nome, total: contar(lista, d => d.aeroporto_id === a.id) }));
  }, [aeroQ.data, excepto]);
  const fichasEstado = useMemo(() => {
    const lista = excepto('estado');
    return ESTADOS_DOCUMENTO.map(e => ({ value: e.chave, label: e.label, total: contar(lista, d => d.estado === e.chave) }));
  }, [excepto]);
  const fichasValidade = useMemo(() => {
    const lista = excepto('validade');
    return OPCOES_VALIDADE.filter(o => o.value).map(o => ({ value: o.value, label: o.label, total: contar(lista, d => correspondeValidade(d, o.value)) }));
  }, [excepto]);
  const fichasTipo = useMemo(() => {
    const lista = excepto('tipo');
    const sem = contar(lista, d => !d.tipo_id);
    const lst = (tiposQ.data || []).map(x => ({ value: x.id, label: x.nome, total: contar(lista, d => d.tipo_id === x.id) }));
    return sem > 0 || fTipo === SEM_TIPO ? [...lst, { value: SEM_TIPO, label: 'Sem tipo', total: sem }] : lst;
  }, [excepto, fTipo, tiposQ.data]);
  const fichasManual = useMemo(() => fichasCodigo(excepto('manual'), cod.processos, 'processo_codigo'), [excepto, cod.processos]);
  const fichasClasse = useMemo(() => fichasCodigo(excepto('classe'), cod.classes, 'classe_codigo'), [excepto, cod.classes]);

  const rotuloAeroSel = fAero ? (mapaAero.get(fAero)?.codigo_icao || mapaAero.get(fAero)?.nome || 'aeroporto') : '';
  const aplicados = [
    fAero && { chave: 'aeroporto', rotulo: `Aeroporto: ${rotuloAeroSel}`, aoRemover: () => actualizar({ aeroporto: '' }) },
    fEstado && { chave: 'estado', rotulo: `Estado: ${ESTADO_LABEL[fEstado] || fEstado}`, aoRemover: () => actualizar({ estado: '' }) },
    fValidade && { chave: 'validade', rotulo: OPCOES_VALIDADE.find(o => o.value === fValidade)?.label || fValidade, aoRemover: () => actualizar({ validade: '' }) },
    fTipo && { chave: 'tipo', rotulo: `Tipo: ${fTipo === SEM_TIPO ? 'sem tipo' : (rotuloTipo(mapaTipos, fTipo) || fTipo)}`, aoRemover: () => actualizar({ tipo: '' }) },
    fManual && { chave: 'manual', rotulo: `Manual: ${rotuloCodigo(cod.mapaProcessos, fManual)}`, aoRemover: () => actualizar({ manual: '' }) },
    fClasse && { chave: 'classe', rotulo: `Classe: ${rotuloCodigo(cod.mapaClasses, fClasse)}`, aoRemover: () => actualizar({ classe: '' }) },
  ].filter(Boolean);
  const comFiltros = aplicados.length > 0;
  const limparTudo = () => actualizar({ aeroporto: '', tipo: '', estado: '', validade: '', manual: '', classe: '' });

  const docSel = useMemo(() => (selId ? resultados.find(d => d.id === selId) || null : null), [selId, resultados]);
  const seleccionar = (id, e) => abrirDocumento(navigate, id, e);
  const ordenarPor = (chave) => actualizar(chave === ordem
    ? { dir: dir === 'asc' ? 'desc' : 'asc' }
    : { ord: chave === 'actualizado' ? '' : chave, dir: chave === 'nome' || chave === 'responsavel' ? 'asc' : 'desc' });
  const mudarDensidade = (v) => { setDensidade(v); guardarPreferenciaDensidadeDocs(v); };

  // Sugestões concretas quando não há nada: documentos em vigor que a pessoa pode abrir agora mesmo.
  const sugestoes = (sugestoesQ.data || []).filter(d => d.id !== selId).slice(0, 5);

  const aCarregar = metaQ.isLoading || conteudoQ.isLoading;
  const aBuscar = metaQ.isFetching || conteudoQ.isFetching;
  const falhou = metaQ.isError && conteudoQ.isError;
  const cobertura = coberturaQ.data;
  const conteudoIndexado = !!cobertura?.disponivel;

  return (
    <div className="space-y-5">
      <header>
        <h1 className={cn('text-2xl font-bold tracking-tight', tk.tinta)}>Pesquisa</h1>
        <p className={cn('mt-1 text-sm', tk.tintaFraca)}>
          {conteudoIndexado
            ? 'Procure dentro do texto dos ficheiros, e também pelo título, número, descrição ou etiquetas. Os resultados dizem em que página está.'
            : 'Procure por título, número, descrição ou etiquetas em todos os documentos a que tem acesso.'}
        </p>
      </header>

      <form role="search" onSubmit={e => { e.preventDefault(); actualizar({ q: texto }); }} className="space-y-3">
        <div className="relative">
          <Search className={cn('pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2', tk.tintaTenue)} aria-hidden="true" />
          <Input
            type="search"
            value={texto}
            onChange={e => setTexto(e.target.value)}
            placeholder={conteudoIndexado ? 'Ex.: inspecção de pista, «lista de páginas efectivas», RTA…' : 'Ex.: manual de operações, RTA, plano de emergência…'}
            aria-label="Termo a pesquisar"
            autoComplete="off"
            className="h-12 pl-10 pr-24 text-base"
          />
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
            {texto && (
              <button type="button" onClick={() => { setTexto(''); actualizar({ q: '' }); }} aria-label="Limpar a pesquisa" className={cn('flex h-11 w-11 items-center justify-center rounded-full', tk.tintaFraca, tk.foco, tk.hover)}>
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
            {aBuscar && !curto && <Loader2 className={cn('mr-1 h-4 w-4 animate-spin', tk.tintaTenue)} aria-hidden="true" />}
          </div>
        </div>

        {!curto && resultados.length > 0 && (
          <div className={cn(cartao, 'space-y-3 p-4')}>
            <FichasFiltro titulo="Aeroporto" opcoes={fichasAero} valor={fAero} aoEscolher={v => actualizar({ aeroporto: v })} />
            <FichasFiltro titulo="Estado" opcoes={fichasEstado} valor={fEstado} aoEscolher={v => actualizar({ estado: v })} />
            <FichasFiltro titulo="Validade" opcoes={fichasValidade} valor={fValidade} aoEscolher={v => actualizar({ validade: v })} />
            <FichasFiltro titulo="Tipo" opcoes={fichasTipo} valor={fTipo} aoEscolher={v => actualizar({ tipo: v })} />
            {/* as duas dimensões do número do documento: de que manual faz parte, e o que ele é */}
            <FichasFiltro titulo="Manual" opcoes={fichasManual} valor={fManual} aoEscolher={v => actualizar({ manual: v })} />
            <FichasFiltro titulo="Classe" opcoes={fichasClasse} valor={fClasse} aoEscolher={v => actualizar({ classe: v })} />
          </div>
        )}
      </form>

      {curto ? (
        <div className={cartao}>
          <Vazio
            icone={FileSearch}
            titulo="Escreva o que procura"
            texto={conteudoIndexado
              ? `Bastam ${MINIMO} letras. Procura dentro do texto dos ficheiros: escreva uma frase entre aspas para a encontrar tal e qual, ou ponha um sinal menos antes de uma palavra para a excluir. Também encontra pelo número do documento (ex.: MAN-OPS-001).`
              : `Bastam ${MINIMO} letras. Pode procurar pelo número do documento (ex.: MAN-OPS-001) ou por palavras do título. Se preferir navegar por pastas, vá à Biblioteca.`}
          >
            <Button asChild variant="outline"><Link to={`${PORTAL_BASE}/biblioteca`}><Library className="h-4 w-4" aria-hidden="true" />Ir para a Biblioteca</Link></Button>
          </Vazio>
        </div>
      ) : falhou ? (
        <div className={cartao}><Falha titulo="A pesquisa falhou" texto="O servidor não respondeu à pesquisa. Tente de novo; se continuar, procure pela Biblioteca e avise a gestão documental." onTentar={() => { metaQ.refetch?.(); conteudoQ.refetch?.(); }} /></div>
      ) : aCarregar ? (
        <div className={cartao}><EsqueletoTabela altura={alturaDensidade(densidade)} /></div>
      ) : ordenados.length === 0 ? (
        <div className={cartao}>
          <Vazio
            icone={SearchX}
            titulo={`Sem resultados para «${termo}»`}
            texto={comFiltros
              ? 'Há resultados para este termo, mas os filtros aplicados não deixam passar nenhum.'
              : 'Experimente menos palavras, o número do documento, ou termos mais gerais (por exemplo «emergência» em vez de «plano de emergência do aeroporto»).'}
          >
            <div className="flex flex-wrap justify-center gap-2">
              {comFiltros && <Button variant="outline" onClick={limparTudo}><X className="h-4 w-4" aria-hidden="true" />Limpar os filtros</Button>}
              <Button asChild variant="outline"><Link to={`${PORTAL_BASE}/biblioteca`}><Library className="h-4 w-4" aria-hidden="true" />Navegar por pastas</Link></Button>
            </div>
            {sugestoes.length > 0 && (
              <div className="mt-6 w-full max-w-lg text-left">
                <p className={cn('mb-2 text-xs font-semibold uppercase tracking-wider', tk.tintaFraca)}>Entretanto, em vigor e à mão</p>
                <ul className={cn('divide-y rounded-xl border', tk.divisoria, tk.borda)}>
                  {sugestoes.map(d => (
                    <li key={d.id}>
                      <Link to={urlDoc(d.id)} className={cn('flex min-h-[2.75rem] items-center gap-3 px-3 py-2', tk.foco, tk.hover)}>
                        <span className="min-w-0 flex-1">
                          <span className={cn('block truncate text-sm font-medium', tk.tinta)}>{d.titulo}</span>
                          {d.numero && <span className={cn('block truncate text-sm', tk.mono, tk.tintaFraca)}>{d.numero}</span>}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Vazio>
        </div>
      ) : (
        <div className={cn('xl:grid xl:gap-6', docSel && vista !== 'passagens' ? 'xl:grid-cols-[minmax(0,1fr)_21rem]' : '')}>
          <section className={cn('min-w-0 space-y-3', docSel && vista !== 'passagens' && 'pb-[64vh] xl:pb-0')}>
            {/* âmbito declarado em palavras: é isto que impede alguém de concluir que um documento não existe */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className={cn('flex items-start gap-2 text-sm', tk.tintaMedia)} role="status">
                <Building2 className={cn('mt-0.5 h-4 w-4 shrink-0', tk.tintaTenue)} aria-hidden="true" />
                <span>
                  {fAero
                    ? <>A pesquisar <strong className={tk.tinta}>só em {rotuloAeroSel}</strong>.</>
                    : <>A pesquisar em <strong className={tk.tinta}>todos os aeroportos</strong> a que tem acesso.</>}
                  {' '}
                  <span className="tabular-nums">
                    {ordenados.length === 1 ? '1 documento encontrado' : `${ordenados.length} documentos encontrados`}
                    {resultados.length !== ordenados.length ? ` de ${resultados.length} sem filtros` : ''}
                    {comConteudo > 0 ? `, ${comConteudo} com o termo dentro do ficheiro` : ''}.
                  </span>
                </span>
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {vista !== 'passagens' && (
                  <div className={cn('flex items-center gap-0.5 rounded-lg border p-0.5', tk.borda)} role="group" aria-label="Altura das linhas">
                    {DENSIDADES.map(d => (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => mudarDensidade(d.value)}
                        aria-pressed={densidade === d.value}
                        title={`Linhas de ${d.px}`}
                        className={cn('min-h-[2.25rem] rounded-md px-2 text-sm tabular-nums', tk.foco,
                          densidade === d.value ? cn(tk.acentoFundo, tk.acento, 'font-semibold') : cn(tk.tintaFraca, 'hover:text-slate-900 dark:hover:text-white'))}
                      >
                        {d.altura}<span className="sr-only"> px — {d.label}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className={cn('flex items-center gap-0.5 rounded-lg border p-0.5', tk.borda)} role="group" aria-label="Forma de apresentação">
                  {[{ v: 'passagens', Icone: Quote, label: 'Passagens' }, { v: 'tabela', Icone: Table2, label: 'Tabela' }, { v: 'grelha', Icone: LayoutGrid, label: 'Grelha' }].map(({ v, Icone, label }) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => actualizar({ vista: v, sel: '' })}
                      aria-pressed={vista === v}
                      className={cn('flex min-h-[2.25rem] items-center gap-1.5 rounded-md px-2 text-sm', tk.foco,
                        vista === v ? cn(tk.acentoFundo, tk.acento, 'font-semibold') : cn(tk.tintaFraca, 'hover:text-slate-900 dark:hover:text-white'))}
                    >
                      <Icone className="h-4 w-4" aria-hidden="true" />{label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* cobertura do índice: dizer quanto do acervo já foi lido por dentro é parte do âmbito, não um detalhe */}
            {cobertura && cobertura.total > 0 && cobertura.indexados < cobertura.total && (
              <p className={cn('flex items-start gap-2 text-sm', tk.tintaFraca)}>
                <ScanLine className={cn('mt-0.5 h-4 w-4 shrink-0', tk.tintaTenue)} aria-hidden="true" />
                <span>
                  {conteudoIndexado
                    ? <>O texto já foi extraído de <span className="tabular-nums">{cobertura.indexados}</span> dos <span className="tabular-nums">{cobertura.total}</span> documentos. Nos restantes a pesquisa vê apenas o título, o número, a descrição e as etiquetas{cobertura.semTexto > 0 ? <> (<span className="tabular-nums">{cobertura.semTexto}</span> são digitalizados e esperam reconhecimento óptico)</> : null}.</>
                    : <>O conteúdo dos ficheiros ainda não está indexado: por agora a pesquisa vê só o título, o número, a descrição e as etiquetas.</>}
                </span>
              </p>
            )}

            <ResumoFiltros aplicados={aplicados} aoLimparTudo={limparTudo} />

            {vista === 'passagens' ? (
              <ol className="space-y-3">
                {ordenados.map(d => (
                  <BlocoPassagem key={d.id} doc={d} tipos={mapaTipos} aeroportos={mapaAero} termo={termo} />
                ))}
              </ol>
            ) : vista === 'grelha' ? (
              <ListaDocumentos docs={ordenados} tipos={mapaTipos} aeroportos={mapaAero} termo={termo} vista="grelha" mostrarAeroporto />
            ) : (
              <div className={cartao}>
                <TabelaDocumentos
                  docs={ordenados}
                  tipos={mapaTipos}
                  aeroportos={mapaAero}
                  termo={termo}
                  densidade={densidade}
                  ordem={ordem}
                  dir={dir}
                  aoOrdenar={ordenarPor}
                  seleccionado={selId}
                  aoSeleccionar={seleccionar}
                  esconder={docSel ? ['responsavel', 'actualizado'] : []}
                  mostrarAeroporto
                  idPainel={undefined}
                />
              </div>
            )}
          </section>

          {docSel && vista !== 'passagens' && (
            <PainelDocumento
              id="gd-painel-pesquisa"
              doc={docSel}
              tipos={mapaTipos}
              aeroportos={mapaAero}
              aoFechar={() => actualizar({ sel: '' }, { replace: true })}
            />
          )}
        </div>
      )}
    </div>
  );
}
