// O leitor de PDF do Portal de Documentos.
//
// Substitui o <iframe src={url}#view=FitH> que estava aqui antes. A troca não foi por estética: o visualizador
// nativo do navegador é uma caixa fechada — não se lhe pergunta em que página está, não se lhe manda ir à 47 de
// forma fiável, não se lhe realça uma palavra, e não se lhe dá os bytes de uma cópia guardada em vez de um
// endereço. Era por isso que o `?pagina=47` que a pesquisa escreve no endereço não dava em nada: a ficha nunca
// lia o parâmetro, e mesmo que lhe juntasse «#page=47» ao endereço assinado estaria a pedir um favor a cada
// navegador em vez de controlar a página. Agora a página é estado desta aplicação.
//
// Desenha-se UMA página de cada vez (canvas) com a camada de texto do pdf.js por cima, que é o que permite
// seleccionar, copiar e — sobretudo — saber onde cada palavra ficou, para realçar o termo procurado sem adivinhar
// larguras de letras. Uma página de cada vez e não rolo contínuo porque um manual de 160 páginas num portátil de
// serviço tem de abrir já, e porque «página 47 de 162» só é verdade se houver uma página de cada vez.
//
// Os bytes vêm inteiros por `fetch` e só depois vão para o pdf.js. Duas razões: o endereço assinado vale 5
// minutos e um PDF lido por pedaços deixa de abrir a meio da leitura; e tendo os bytes na mão, guardar a cópia
// offline não custa um segundo download.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Download, FileText, Loader2, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { tk, Falha, Vazio } from '@/documentos/pages/PortalBiblioteca';
import {
  apagarCopia, espacoOffline, estadoCopia, guardarCopia, listarCopias, metaDeDocumento, obterCopia, obterMeta,
  obterPaginasOffline, offlineDisponivel,
} from '@/lib/documentosOffline';
import BarraLeitor from './BarraLeitor';
import IndicePaginas from './IndicePaginas';
import PesquisaNoDocumento from './PesquisaNoDocumento';
import { BotaoOffline, TiraOffline } from './CopiaOffline';
import {
  MINIMO_TERMO, obterPaginasDocumento, obterRotulos, obterTextoPagina, palavrasDoTermo, pesquisarNoDocumento,
} from './paginaTexto';
import { contarOcorrencias, movimentoReduzido, rectangulosDoRealce } from './realce';

// O worker é servido como .js a partir de public/pdfjs: o nginx entrega .mjs como application/octet-stream e,
// com X-Content-Type-Options: nosniff, o Chrome recusa o module worker. (A mesma nota está no FlipbookPdf.)
const WORKER = '/pdfjs/pdf.worker.min.js';

// A camada de texto do pdf.js precisa de regras próprias: os <span> são posicionados em absoluto e invisíveis
// (só servem para selecção e para medir), e os tamanhos vêm em `calc(var(--scale-factor) * …px)` — se a variável
// não estiver definida no contentor, o pdf.js fica sem largura e o texto cai todo no canto. É o subconjunto
// mínimo do pdf_viewer.css, escrito aqui para não arrastar a folha de estilo inteira do visualizador.
const ESTILO_ID = 'gd-leitor-estilo';
const CSS = `
.gd-camada-texto{position:absolute;left:0;top:0;text-align:initial;overflow:clip;line-height:1;
  -webkit-text-size-adjust:none;text-size-adjust:none;forced-color-adjust:none;transform-origin:0 0;
  caret-color:CanvasText;z-index:2;}
.gd-camada-texto span,.gd-camada-texto br{color:transparent;position:absolute;white-space:pre;cursor:text;
  transform-origin:0% 0%;}
.gd-camada-texto span.markedContent{top:0;height:0;}
.gd-camada-texto span[role="img"]{user-select:none;cursor:default;}
.gd-camada-texto ::selection{background:rgba(13,148,136,.35);}
.gd-camada-texto .endOfContent{display:block;position:absolute;inset:100% 0 0;z-index:0;cursor:default;
  user-select:none;}
.gd-sem-selecao,.gd-sem-selecao span{user-select:none;cursor:default;}
.gd-realces{position:absolute;left:0;top:0;right:0;bottom:0;z-index:1;pointer-events:none;}
.gd-realce{position:absolute;border-radius:2px;background:rgba(251,191,36,.5);mix-blend-mode:multiply;}
.gd-realce-activo{background:rgba(249,115,22,.55);outline:2px solid rgb(180,83,9);outline-offset:1px;}
`;

function usarEstilo() {
  useEffect(() => {
    if (document.getElementById(ESTILO_ID)) return;
    const el = document.createElement('style');
    el.id = ESTILO_ID;
    el.textContent = CSS;
    document.head.appendChild(el);
  }, []);
}

// Os marcadores do PDF, achatados em lista com nível e página. Limitado de propósito: há manuais com milhares de
// entradas e resolver cada destino é um pedido ao worker.
const MAX_SECOES = 250;
async function lerSecoes(pdf) {
  const bruto = await pdf.getOutline().catch(() => null);
  if (!Array.isArray(bruto) || !bruto.length) return [];
  const fora = [];
  const andar = async (itens, nivel) => {
    for (const it of itens) {
      if (fora.length >= MAX_SECOES) return;
      let pagina = null;
      try {
        const destino = typeof it.dest === 'string' ? await pdf.getDestination(it.dest) : it.dest;
        if (Array.isArray(destino) && destino[0]) pagina = (await pdf.getPageIndex(destino[0])) + 1;
      } catch { /* um marcador sem destino resolvível fica de fora */ }
      if (it.title && pagina) fora.push({ titulo: String(it.title).trim(), pagina, nivel });
      if (Array.isArray(it.items) && it.items.length && nivel < 2) await andar(it.items, nivel + 1);
    }
  };
  await andar(bruto, 0);
  return fora;
}

export default function LeitorPdf({
  documentoId, doc, url, erroUrl, aCarregarUrl, onRetentar, descarregar,
  paginaPedida, termoPedido, onPagina, semDescarga, permiteOffline, razaoSemOffline,
}) {
  usarEstilo();
  const libRef = useRef(null);
  const raizRef = useRef(null);
  const palcoRef = useRef(null);
  const folhaRef = useRef(null);
  const canvasRef = useRef(null);
  const camadaRef = useRef(null);

  // ── bytes: a rede primeiro, a cópia guardada depois ─────────────────────
  const [blob, setBlob] = useState(null);
  const [fonte, setFonte] = useState('');            // 'rede' | 'offline'
  const [erro, setErro] = useState('');
  const [aCarregar, setACarregar] = useState(true);
  const [tentativa, setTentativa] = useState(0);
  const [semRede, setSemRede] = useState(() => (typeof navigator !== 'undefined' && navigator.onLine === false));

  useEffect(() => {
    const ligou = () => setSemRede(false);
    const caiu = () => setSemRede(true);
    window.addEventListener('online', ligou);
    window.addEventListener('offline', caiu);
    return () => { window.removeEventListener('online', ligou); window.removeEventListener('offline', caiu); };
  }, []);

  useEffect(() => {
    let vivo = true;
    setErro(''); setBlob(null); setFonte('');
    if (aCarregarUrl) { setACarregar(true); return undefined; }
    setACarregar(true);
    (async () => {
      if (url) {
        try {
          const r = await fetch(url);
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const b = await r.blob();
          if (!vivo) return;
          setBlob(b); setFonte('rede'); setACarregar(false);
          return;
        } catch { /* a rede falhou: há cópia? */ }
      }
      const copia = await obterCopia(documentoId).catch(() => null);
      if (!vivo) return;
      if (copia?.blob) { setBlob(copia.blob); setFonte('offline'); setACarregar(false); return; }
      setErro(erroUrl || (url
        ? 'O ficheiro não chegou do servidor e não há cópia guardada neste dispositivo.'
        : 'Não foi possível preparar o endereço do ficheiro e não há cópia guardada neste dispositivo.'));
      setACarregar(false);
    })();
    return () => { vivo = false; };
  }, [url, documentoId, aCarregarUrl, erroUrl, tentativa]);

  // ── abrir o PDF ──────────────────────────────────────────────────────────
  const [pdf, setPdf] = useState(null);
  const [total, setTotal] = useState(0);
  const [secoes, setSecoes] = useState([]);

  useEffect(() => {
    if (!blob) { setPdf(null); setTotal(0); setSecoes([]); return undefined; }
    let vivo = true;
    let aberto = null;
    (async () => {
      try {
        // pdf.js só entra no pacote quando se abre de facto um PDF: a ficha de um documento Word não paga por ele.
        const lib = await import('pdfjs-dist');
        lib.GlobalWorkerOptions.workerSrc = WORKER;
        libRef.current = lib;
        const bytes = new Uint8Array(await blob.arrayBuffer());
        if (!vivo) return;
        const d = await lib.getDocument({ data: bytes, isEvalSupported: false }).promise;
        if (!vivo) { d.destroy?.(); return; }
        aberto = d;
        setPdf(d); setTotal(d.numPages); setErro('');
        const s = await lerSecoes(d);
        if (vivo) setSecoes(s);
      } catch (e) {
        if (vivo) setErro(e?.message === 'Invalid PDF structure'
          ? 'O ficheiro não é um PDF legível (pode ter ficado truncado no carregamento).'
          : `Não foi possível abrir o PDF. ${e?.message || ''}`.trim());
      }
    })();
    return () => { vivo = false; aberto?.destroy?.(); };
  }, [blob]);

  // ── a página: estado desta aplicação, espelhado no endereço ─────────────
  // Arranca já na página pedida (e não na 1 com salto a seguir): desenhar a capa para logo depois saltar para a
  // 47 é trabalho a dobrar e um salto visível.
  const [pagina, setPagina] = useState(() => {
    const n = Number(paginaPedida);
    return Number.isFinite(n) && n >= 1 ? Math.round(n) : 1;
  });
  const enviado = useRef(null);

  const ir = useCallback((n) => {
    if (!total) return;
    const alvo = Math.min(total, Math.max(1, Math.round(Number(n) || 1)));
    if (alvo === pagina) return;
    enviado.current = alvo;
    setPagina(alvo);
    onPagina?.(alvo);
  }, [total, pagina, onPagina]);

  // Aplica o ?pagina= do endereço: à abertura, e outra vez quando ele muda por fora (outro resultado da
  // pesquisa, um favorito, o botão «voltar»). `enviado` evita o eco das nossas próprias escritas no endereço.
  useEffect(() => {
    if (!total) return;
    const alvo = Number(paginaPedida);
    if (!Number.isFinite(alvo) || alvo < 1) {
      if (enviado.current === null) enviado.current = 1;
      return;
    }
    if (alvo === enviado.current) return;
    enviado.current = alvo;
    setPagina(Math.min(total, Math.max(1, Math.round(alvo))));
  }, [paginaPedida, total]);

  // ── medida do palco e zoom ──────────────────────────────────────────────
  // Medir por `ref` de função e não num `useEffect([])`: enquanto o ficheiro está a chegar, o leitor devolve
  // outra árvore (o «a preparar…») e o palco ainda não existe. Um efeito de montagem corria com o `ref` a nulo,
  // nunca mais voltava a correr, e a página ficava desenhada a uma largura inventada.
  const [larguraPalco, setLarguraPalco] = useState(0);
  const [escala, setEscala] = useState(1);        // 1 = ajustado à largura
  const observadorRef = useRef(null);
  const ligarPalco = useCallback((no) => {
    palcoRef.current = no;
    observadorRef.current?.disconnect();
    observadorRef.current = null;
    if (!no) return;
    setLarguraPalco(no.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    observadorRef.current = new ResizeObserver(() => setLarguraPalco(no.clientWidth));
    observadorRef.current.observe(no);
  }, []);
  useEffect(() => () => observadorRef.current?.disconnect(), []);

  // ── procurar dentro do documento ────────────────────────────────────────
  const [termo, setTermo] = useState(termoPedido || '');
  const [termoActivo, setTermoActivo] = useState(termoPedido || '');
  useEffect(() => { const t = setTimeout(() => setTermoActivo(termo), 280); return () => clearTimeout(t); }, [termo]);
  const palavras = useMemo(() => palavrasDoTermo(termoActivo), [termoActivo]);
  const [resultados, setResultados] = useState([]);
  const [fontePesquisa, setFontePesquisa] = useState('');
  const [aProcurar, setAProcurar] = useState(false);

  useEffect(() => {
    const t = String(termoActivo || '').trim();
    if (t.length < MINIMO_TERMO) { setResultados([]); setFontePesquisa(''); return undefined; }
    let vivo = true;
    setAProcurar(true);
    pesquisarNoDocumento(documentoId, t)
      .then(r => { if (vivo) { setResultados(r.resultados); setFontePesquisa(r.fonte); } })
      .catch(() => { if (vivo) { setResultados([]); setFontePesquisa('indisponivel'); } })
      .finally(() => { if (vivo) setAProcurar(false); });
    return () => { vivo = false; };
  }, [documentoId, termoActivo]);

  // rótulos das páginas indexadas (o índice lateral mostra-os ao lado do número)
  const [rotulos, setRotulos] = useState(() => new Map());
  const [indexado, setIndexado] = useState(null);
  useEffect(() => {
    let vivo = true;
    const guardar = (linhas) => {
      if (!vivo) return;
      setRotulos(new Map(linhas.map(l => [l.pagina_fonte ?? l.pagina, l.rotulo])));
      setIndexado(linhas.length);
    };
    obterRotulos(documentoId)
      .then(ls => (ls.length ? guardar(ls) : obterPaginasOffline(documentoId).then(guardar)))
      .catch(() => obterPaginasOffline(documentoId).then(guardar).catch(() => { if (vivo) setIndexado(0); }));
    return () => { vivo = false; };
  }, [documentoId]);

  const paginasComAcerto = useMemo(() => new Set(resultados.map(r => r.paginaFonte)), [resultados]);

  // ── o texto da página, para quem lê por leitor de ecrã ──────────────────
  // Um canvas não se lê e os <span> da camada de texto vão marcados como `presentation` pelo pdf.js. Sem isto, a
  // página era uma imagem muda. Vem do índice já extraído (migração 151), com cache por página nesta sessão.
  const [textoPagina, setTextoPagina] = useState('');
  const cacheTexto = useRef(new Map());
  useEffect(() => {
    let vivo = true;
    const guardado = cacheTexto.current.get(pagina);
    if (guardado !== undefined) { setTextoPagina(guardado); return undefined; }
    setTextoPagina('');
    obterTextoPagina(documentoId, pagina)
      .then(t => { if (!vivo) return; cacheTexto.current.set(pagina, t || ''); setTextoPagina(t || ''); })
      .catch(() => { /* sem texto indexado: o leitor de ecrã anuncia só o número da página */ });
    return () => { vivo = false; };
  }, [documentoId, pagina]);

  // ── painéis ──────────────────────────────────────────────────────────────
  const [indiceAberto, setIndiceAberto] = useState(false);
  const [pesquisaAberta, setPesquisaAberta] = useState(!!termoPedido);
  // Quem chega pela pesquisa global já tem o termo: abre-se o painel para ver as outras páginas, mas o foco fica
  // no leitor (é a ler que vem), em vez de ser atirado para dentro de uma caixa de escrita. O pedido de foco é um
  // contador e não um booleano, para a tecla «/» voltar a levar o cursor à caixa com o painel já aberto.
  const [focoPedido, setFocoPedido] = useState(0);
  const alternarPesquisa = useCallback(() => {
    if (pesquisaAberta) { setPesquisaAberta(false); return; }
    setPesquisaAberta(true);
    setFocoPedido(n => n + 1);
  }, [pesquisaAberta]);

  // ── desenhar a página ───────────────────────────────────────────────────
  const [aDesenhar, setADesenhar] = useState(false);
  const [desenho, setDesenho] = useState(0);        // contador: muda a cada desenho concluído
  useEffect(() => {
    if (!pdf || !larguraPalco || !pagina || pagina > total) return undefined;
    let vivo = true;
    let tarefa = null;
    let camada = null;
    setADesenhar(true);
    (async () => {
      try {
        const pag = await pdf.getPage(pagina);
        if (!vivo) return;
        const base = pag.getViewport({ scale: 1 });
        const alvoLargura = Math.max(260, Math.floor((larguraPalco - 28) * escala));
        const vp = pag.getViewport({ scale: alvoLargura / base.width });
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = Math.floor(vp.width * dpr);
        canvas.height = Math.floor(vp.height * dpr);
        canvas.style.width = `${Math.floor(vp.width)}px`;
        canvas.style.height = `${Math.floor(vp.height)}px`;
        if (folhaRef.current) {
          folhaRef.current.style.width = `${Math.floor(vp.width)}px`;
          folhaRef.current.style.height = `${Math.floor(vp.height)}px`;
        }
        const ctx = canvas.getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        tarefa = pag.render({
          canvasContext: ctx,
          viewport: vp,
          transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null,
        });
        await tarefa.promise;
        if (!vivo) return;

        const alvo = camadaRef.current;
        if (alvo && libRef.current?.TextLayer) {
          alvo.replaceChildren();
          alvo.style.setProperty('--scale-factor', String(vp.scale));
          const conteudo = await pag.getTextContent();
          if (!vivo) return;
          camada = new libRef.current.TextLayer({ textContentSource: conteudo, container: alvo, viewport: vp });
          await camada.render();
        }
        if (vivo) setDesenho(n => n + 1);
      } catch (e) {
        // cancelar um desenho a meio (virar a página depressa) não é um erro a mostrar
        if (vivo && e?.name !== 'RenderingCancelledException' && e?.name !== 'AbortException') {
          setErro(`Não foi possível desenhar a página ${pagina}. ${e?.message || ''}`.trim());
        }
      } finally {
        if (vivo) setADesenhar(false);
      }
    })();
    return () => {
      vivo = false;
      try { tarefa?.cancel(); } catch { /* já terminou */ }
      try { camada?.cancel?.(); } catch { /* idem */ }
    };
  }, [pdf, pagina, total, larguraPalco, escala]);

  // ao mudar de página, começa-se a ler de cima (o zoom não mexe no rolamento)
  useEffect(() => { palcoRef.current?.scrollTo?.({ top: 0 }); }, [pagina]);

  // ── realce do termo na página desenhada ─────────────────────────────────
  const [realces, setRealces] = useState([]);
  const [acertoActivo, setAcertoActivo] = useState(0);
  useEffect(() => {
    if (!camadaRef.current || !desenho) { setRealces([]); return; }
    const rects = palavras.length ? rectangulosDoRealce(camadaRef.current, palavras) : [];
    setRealces(rects);
    setAcertoActivo(0);
  }, [palavras, desenho]);

  const acertos = useMemo(() => contarOcorrencias(realces), [realces]);
  const irAcerto = useCallback((passo) => {
    if (!acertos) return;
    setAcertoActivo(a => ((a + passo) % acertos + acertos) % acertos);
  }, [acertos]);

  // Trazer o acerto activo à vista. Calculado por rectângulos em vez de offsetTop: o palco e a folha mudam de
  // posição com o zoom e com os painéis abertos, e as contas com `offsetParent` erram em qualquer dos casos.
  useEffect(() => {
    const r = realces.find(x => x.ocorrencia === acertoActivo);
    const palco = palcoRef.current;
    const camada = camadaRef.current;
    if (!r || !palco || !camada) return;
    const topoCamada = camada.getBoundingClientRect().top - palco.getBoundingClientRect().top + palco.scrollTop;
    palco.scrollTo({
      top: Math.max(0, topoCamada + r.topo - palco.clientHeight / 3),
      behavior: movimentoReduzido() ? 'auto' : 'smooth',
    });
  }, [realces, acertoActivo]);

  // ── teclado ──────────────────────────────────────────────────────────────
  // Ao nível do documento (lê-se com as mãos longe do rato), mas só quando o foco está no leitor ou em nada —
  // nunca quando se está a escrever num campo, e nunca por cima de um atalho do navegador (Ctrl/Alt/Meta).
  useEffect(() => {
    const aoTeclar = (e) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      const activo = document.activeElement;
      const etiqueta = activo?.tagName;
      if (activo?.isContentEditable || etiqueta === 'INPUT' || etiqueta === 'TEXTAREA' || etiqueta === 'SELECT') return;
      const dentro = activo === document.body || !activo || raizRef.current?.contains(activo);
      if (!dentro) return;

      switch (e.key) {
        case 'ArrowRight': case 'PageDown': e.preventDefault(); ir(pagina + 1); break;
        case 'ArrowLeft': case 'PageUp': e.preventDefault(); ir(pagina - 1); break;
        case 'Home': e.preventDefault(); ir(1); break;
        case 'End': e.preventDefault(); ir(total); break;
        case '+': case '=': e.preventDefault(); setEscala(z => Math.min(3, z + 0.25)); break;
        case '-': case '_': e.preventDefault(); setEscala(z => Math.max(0.5, z - 0.25)); break;
        case '0': e.preventDefault(); setEscala(1); break;
        case '/': e.preventDefault(); setPesquisaAberta(true); setFocoPedido(n => n + 1); break;
        case 'n': case 'N': if (acertos) { e.preventDefault(); irAcerto(e.shiftKey ? -1 : 1); } break;
        case 'Escape':
          if (pesquisaAberta || indiceAberto) { e.preventDefault(); setPesquisaAberta(false); setIndiceAberto(false); }
          break;
        default: break;
      }
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [ir, pagina, total, acertos, irAcerto, pesquisaAberta, indiceAberto]);

  // ── cópia offline ────────────────────────────────────────────────────────
  const [metaOffline, setMetaOffline] = useState(null);
  const [aGuardar, setAGuardar] = useState(false);
  const [erroOffline, setErroOffline] = useState('');
  useEffect(() => {
    let vivo = true;
    if (!offlineDisponivel()) return undefined;
    obterMeta(documentoId).then(m => { if (vivo) setMetaOffline(m); }).catch(() => { /* sem cópia */ });
    return () => { vivo = false; };
  }, [documentoId]);

  // Quanto é que as cópias já ocupam. Vai no pé do leitor porque guardar manuais num tablet de serviço acaba
  // sempre por bater no limite do navegador, e é melhor saber-se antes de a gravação falhar.
  const [resumo, setResumo] = useState({ quantos: 0, bytes: 0, quota: 0 });
  useEffect(() => {
    let vivo = true;
    if (!offlineDisponivel()) return undefined;
    (async () => {
      const [copias, espaco] = await Promise.all([listarCopias(), espacoOffline()]);
      if (!vivo) return;
      setResumo({
        quantos: copias.length,
        bytes: copias.reduce((s, c) => s + (Number(c.bytes) || 0), 0),
        quota: espaco.quota || 0,
      });
    })();
    return () => { vivo = false; };
  }, [metaOffline]);

  // O veredicto só conta como «confirmado» quando os bytes vieram da rede NESTA leitura. Um registo de documento
  // que o cache do TanStack serviu não prova que a cópia continua a ser a que manda.
  const estado = useMemo(
    () => estadoCopia(metaOffline, fonte === 'rede' ? doc : null),
    [metaOffline, fonte, doc],
  );

  const guardarOffline = useCallback(async () => {
    setAGuardar(true); setErroOffline('');
    try {
      let bytes = blob;
      if (!bytes || fonte !== 'rede') {
        if (!url) throw new Error('Sem endereço do servidor para buscar o ficheiro.');
        const r = await fetch(url);
        if (!r.ok) throw new Error(`o servidor respondeu ${r.status}`);
        bytes = await r.blob();
      }
      // O índice de texto vai com o ficheiro para a pesquisa dentro do documento também funcionar sem rede.
      let paginas = [];
      try { paginas = await obterPaginasDocumento(documentoId); } catch { /* o índice é um extra */ }
      const m = await guardarCopia({
        documento_id: documentoId,
        blob: bytes,
        meta: metaDeDocumento(doc, { paginas_pdf: total }),
        paginas,
      });
      setMetaOffline(m);
      if (bytes !== blob) { setBlob(bytes); setFonte('rede'); }
    } catch (e) {
      setErroOffline(e?.name === 'QuotaExceededError'
        ? 'Não há espaço no navegador para guardar este ficheiro. Apague cópias de documentos que já não precise.'
        : `Não foi possível guardar a cópia: ${e?.message || 'erro desconhecido'}.`);
    } finally {
      setAGuardar(false);
    }
  }, [blob, fonte, url, documentoId, doc, total]);

  const apagarOffline = useCallback(async () => {
    setErroOffline('');
    try {
      await apagarCopia(documentoId);
      setMetaOffline(null);
    } catch (e) {
      setErroOffline(`Não foi possível apagar a cópia: ${e?.message || 'erro desconhecido'}.`);
    }
  }, [documentoId]);

  // ── estados antes do leitor ──────────────────────────────────────────────
  if (aCarregar || aCarregarUrl) {
    return (
      <div className="flex min-h-[22rem] items-center justify-center p-10" role="status" aria-live="polite">
        <span className={cn('inline-flex items-center gap-2 text-sm', tk.tintaFraca)}>
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />A preparar o documento…
        </span>
      </div>
    );
  }
  if (erro && !pdf) {
    return (
      <Falha
        titulo="Não foi possível abrir o ficheiro"
        texto={erro}
        onTentar={() => { setTentativa(n => n + 1); onRetentar?.(); }}
      />
    );
  }
  if (!blob) {
    return (
      <Vazio
        icone={FileText}
        titulo="Este documento ainda não tem ficheiro"
        texto="O registo existe, mas o ficheiro não foi carregado ou já não está disponível. Fale com a gestão documental."
      />
    );
  }

  const permitido = permiteOffline && offlineDisponivel();

  return (
    <section
      ref={raizRef}
      tabIndex={-1}
      role="region"
      aria-label="Leitor do documento"
      aria-keyshortcuts="ArrowRight ArrowLeft PageDown PageUp Home End"
      className="flex min-w-0 flex-col outline-none"
    >
      <TiraOffline
        estado={estado}
        aLerOffline={fonte === 'offline'}
        aGuardar={aGuardar}
        onGuardar={guardarOffline}
        semRede={semRede}
      />

      {fonte === 'offline' && !metaOffline && (
        <p role="status" className={cn('flex items-start gap-2 border-b px-4 py-3 text-sm', tk.avisoBorda, tk.avisoFundo, tk.tintaMedia)}>
          <WifiOff className={cn('mt-0.5 h-4 w-4 shrink-0', tk.aviso)} aria-hidden="true" />
          A ler uma cópia guardada neste dispositivo. Não foi possível confirmar com o servidor se é a versão em vigor.
        </p>
      )}

      <BarraLeitor
        pagina={pagina}
        total={total}
        onIr={ir}
        escala={escala}
        onEscala={(v) => setEscala(Math.min(3, Math.max(0.5, Number(v.toFixed(2)))))}
        onAjustar={() => setEscala(1)}
        indiceAberto={indiceAberto}
        onIndice={() => setIndiceAberto(v => !v)}
        pesquisaAberta={pesquisaAberta}
        onPesquisa={alternarPesquisa}
        acertos={acertos}
        acertoActivo={acertoActivo}
        onAcerto={irAcerto}
        offline={(
          <BotaoOffline
            meta={metaOffline}
            estado={estado}
            permitido={permitido}
            razao={razaoSemOffline || 'Este documento não pode ser guardado para leitura sem rede.'}
            aGuardar={aGuardar}
            onGuardar={guardarOffline}
            onApagar={apagarOffline}
          />
        )}
      />

      {erroOffline && (
        <p role="alert" className={cn('flex items-start gap-2 border-b px-4 py-2 text-sm', tk.perigoBorda, tk.perigo)}>
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{erroOffline}
        </p>
      )}
      {erro && pdf && (
        <p role="alert" className={cn('flex items-start gap-2 border-b px-4 py-2 text-sm', tk.avisoBorda, tk.aviso)}>
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{erro}
        </p>
      )}

      <div className="flex min-w-0 items-stretch">
        {indiceAberto && (
          <IndicePaginas
            pdf={pdf}
            total={total}
            pagina={pagina}
            onIr={ir}
            secoes={secoes}
            paginasComAcerto={paginasComAcerto}
            rotulos={rotulos}
            aoFechar={() => setIndiceAberto(false)}
          />
        )}
        {pesquisaAberta && (
          <PesquisaNoDocumento
            termo={termo}
            onTermo={setTermo}
            aProcurar={aProcurar}
            resultados={resultados}
            fonte={fontePesquisa}
            paginaActual={pagina}
            onIr={ir}
            indexado={indexado}
            focar={focoPedido}
            aoFechar={() => setPesquisaAberta(false)}
          />
        )}

        <div
          ref={ligarPalco}
          className={cn('max-h-[72vh] min-h-[22rem] min-w-0 flex-1 overflow-auto p-3.5', tk.superficieBaixa)}
        >
          <div ref={folhaRef} className="relative mx-auto bg-white shadow-sm">
            {/* o canvas não se lê: o texto da página vai em texto, mais abaixo, para o leitor de ecrã */}
            <canvas ref={canvasRef} className="block" aria-hidden="true" />
            <div className="gd-realces" aria-hidden="true">
              {realces.map((r, i) => (
                <span
                  key={i}
                  className={cn('gd-realce', r.ocorrencia === acertoActivo && 'gd-realce-activo')}
                  style={{ left: r.esquerda, top: r.topo, width: r.largura, height: r.altura }}
                />
              ))}
            </div>
            <div
              ref={camadaRef}
              className={cn('gd-camada-texto', semDescarga && 'gd-sem-selecao')}
              aria-hidden="true"
            />
            {aDesenhar && (
              <span className="absolute right-2 top-2 rounded-full bg-slate-900/70 px-2 py-1 text-xs text-white">
                a desenhar…
              </span>
            )}
          </div>
        </div>
      </div>

      {/* O que o leitor tem de dizer a quem usa leitor de ecrã: que página é, e o texto dela. */}
      <p className="sr-only" role="status" aria-live="polite">
        Página {pagina} de {total}{acertos ? `, ${acertos} ${acertos === 1 ? 'acerto' : 'acertos'} do termo nesta página` : ''}.
      </p>
      {textoPagina && (
        <div className="sr-only" aria-label={`Texto da página ${pagina}`}>{textoPagina}</div>
      )}

      <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-4 py-2 text-xs', tk.borda, tk.tintaFraca)}>
        <span>
          {fonte === 'offline' ? 'Cópia guardada neste dispositivo' : 'Servido pelo portal'}
          {indexado ? ` · ${indexado} ${indexado === 1 ? 'página indexada' : 'páginas indexadas'} para pesquisa` : ''}
        </span>
        {resumo.quantos > 0 && (
          <span>
            {resumo.quantos === 1 ? '1 documento guardado' : `${resumo.quantos} documentos guardados`} neste
            dispositivo{resumo.bytes ? ` · ${(resumo.bytes / (1024 * 1024)).toFixed(1)} MB` : ''}
            {resumo.quota ? ` de ~${Math.round(resumo.quota / (1024 * 1024))} MB que o navegador permite` : ''}
          </span>
        )}
        {semDescarga
          ? <span>Documento só de leitura: sem descarga nem cópia offline.</span>
          : descarregar && (
            <button type="button" onClick={descarregar} className={cn('inline-flex items-center gap-1 rounded hover:underline', tk.acento, tk.foco)}>
              <Download className="h-3.5 w-3.5" aria-hidden="true" />Descarregar o ficheiro
            </button>
          )}
      </div>
    </section>
  );
}
