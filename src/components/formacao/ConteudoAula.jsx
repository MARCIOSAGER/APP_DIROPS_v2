import React, { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink, Download, FileText, Loader2, PlayCircle, MonitorPlay, AlertCircle, Users } from 'lucide-react';
import DOMPurify from 'dompurify';
import { parseVideoUrl, fmtTamanho } from './formacaoUtils';
import { criarScormRuntime, instalarScormApi, concluidoScorm, NORMAS_HTML5 } from '@/lib/scormApi';
import { lancamentoXapi, urlLancamentoXapi } from '@/lib/xapiApi';
import { useScormEstado, guardarScormEstado } from '@/hooks/useFormacao';
import SessoesAluno from './SessoesAluno';
import VideoYouTube from './VideoYouTube';
import LeitorLivro from './LeitorLivro';
import FlipbookPdf from './FlipbookPdf';
import H5pPlayer from './H5pPlayer';

// Sanitização das aulas de texto: mesma política do sanitize.js partilhado
// (sem scripts/eventos/data-attrs, URLs só http(s)/mailto/tel) mas com as tags
// de conteúdo didáctico (citações, código, listas de definições, figuras).
function sanitizeAulaHtml(dirty) {
  if (!dirty) return '';
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'u', 's', 'em', 'strong', 'small', 'sup', 'sub', 'mark', 'a', 'p', 'br', 'hr', 'span', 'div', 'section',
      'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'blockquote', 'pre', 'code', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption', 'img', 'figure', 'figcaption', 'details', 'summary'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'src', 'alt', 'width', 'height', 'colspan', 'rowspan', 'title', 'open'],
    ALLOW_DATA_ATTR: false,
    FORBID_CONTENTS: ['script', 'style'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  });
}

// Renderiza o conteúdo de uma aula conforme o tipo (vídeo / pdf / html5 / texto / link).
export default function ConteudoAula({ aula, posicaoInicial = null, onPosicao, matricula = null, onConclusaoAutomatica }) {
  if (!aula) return null;
  let corpo;
  switch (aula.tipo) {
    case 'video': corpo = <Video aula={aula} posicaoInicial={posicaoInicial} onPosicao={onPosicao} />; break;
    case 'pdf': corpo = <Pdf aula={aula} />; break;
    case 'html5': corpo = aula.opcoes?.norma === 'h5p' ? <H5pAula aula={aula} matricula={matricula} onConclusaoAutomatica={onConclusaoAutomatica} /> : <Html5 aula={aula} matricula={matricula} onConclusaoAutomatica={onConclusaoAutomatica} />; break;
    case 'texto': corpo = <TextoOuLivro aula={aula} />; break;
    case 'link': corpo = <Ligacao aula={aula} />; break;
    case 'presencial': corpo = <Presencial aula={aula} matricula={matricula} />; break;
    default: corpo = <SemConteudo />;
  }
  const materiais = Array.isArray(aula.materiais) ? aula.materiais.filter(m => m && m.url) : [];
  const creditos = String(aula.creditos || '').trim();
  if (!materiais.length && !creditos) return corpo;
  return (
    <div className="space-y-4">
      {corpo}
      {materiais.length > 0 && <Materiais itens={materiais} />}
      {creditos && <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400"><span className="font-medium text-slate-600 dark:text-slate-300">Fonte / créditos: </span>{creditos}</p>}
    </div>
  );
}

// Materiais de apoio para download (qualquer tipo de aula).
export function Materiais({ itens = [], titulo = 'Materiais para download' }) {
  if (!itens.length) return null;
  return (
    <section className="rounded-xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900" aria-label={titulo}>
      <p className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{titulo}</p>
      <ul className="divide-y dark:divide-slate-800">{itens.map((m, i) => (
        <li key={m.url || i} className="flex items-center justify-between gap-3 py-2">
          <span className="flex min-w-0 items-center gap-2 text-sm text-slate-800 dark:text-slate-200"><FileText className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" /><span className="truncate">{m.nome || m.url.split('/').pop()}</span>{m.tamanho ? <span className="shrink-0 text-xs text-slate-500">{fmtTamanho(m.tamanho)}</span> : null}</span>
          <Button asChild variant="outline" size="sm"><a href={m.url} download={m.nome || undefined} target="_blank" rel="noopener noreferrer"><Download className="h-4 w-4" aria-hidden="true" />Descarregar</a></Button>
        </li>
      ))}</ul>
    </section>
  );
}

// Aula presencial: descrição, sessão associada e materiais; a conclusão é registada pelo instrutor (presença).
function Presencial({ aula, matricula }) {
  const html = aula.conteudo_texto ? sanitizeAulaHtml(aula.conteudo_texto) : '';
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3 rounded-xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-900 dark:bg-violet-950/40">
        <Users className="mt-0.5 h-6 w-6 shrink-0 text-violet-700 dark:text-violet-300" aria-hidden="true" />
        <div className="text-sm text-violet-900 dark:text-violet-100">
          <p className="font-semibold">Sessão presencial</p>
          <p>Esta aula é feita em sala ou no terreno. Inscreva-se numa das sessões abaixo; a presença, marcada pelo formador, conclui a aula automaticamente.</p>
        </div>
      </div>
      {html && <div className="prose-aula max-w-none text-slate-800 dark:text-slate-200" dangerouslySetInnerHTML={{ __html: html }} />}
      {aula.curso_id && <SessoesAluno cursoId={aula.curso_id} matricula={matricula} aulaId={aula.id} />}
    </div>
  );
}

function SemConteudo({ mensagem = 'O instrutor ainda não adicionou o conteúdo desta aula.' }) {
  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center dark:border-slate-700 dark:bg-slate-900">
      <AlertCircle className="h-8 w-8 text-slate-400" aria-hidden="true" />
      <p className="max-w-sm px-4 text-sm text-slate-600 dark:text-slate-400">{mensagem}</p>
    </div>
  );
}

function BarraAcoes({ url, nome }) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button asChild variant="outline" size="sm">
        <a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" aria-hidden="true" />Abrir em nova aba</a>
      </Button>
      <Button asChild variant="outline" size="sm">
        <a href={url} download={nome}><Download className="h-4 w-4" aria-hidden="true" />Descarregar</a>
      </Button>
    </div>
  );
}

function Video({ aula, posicaoInicial = null, onPosicao }) {
  const v = parseVideoUrl(aula.conteudo_url);
  const videoRef = useRef(null);
  const ultimoEnvio = useRef(0);
  const retomado = useRef(false);
  useEffect(() => { retomado.current = false; }, [aula.id]);
  const reportar = (forcar = false) => {
    const el = videoRef.current; if (!el || !onPosicao) return;
    const agora = Date.now();
    if (!forcar && agora - ultimoEnvio.current < 5000) return;
    ultimoEnvio.current = agora;
    onPosicao(el.ended ? 0 : el.currentTime, el.duration || null);
  };
  const aoCarregar = () => {
    const el = videoRef.current; if (!el || retomado.current) return;
    retomado.current = true;
    const pos = Number(posicaoInicial) || 0;
    if (pos > 5 && Number.isFinite(el.duration) && pos < el.duration - 5) { try { el.currentTime = pos; } catch { /* */ } }
  };
  if (!v) return <SemConteudo />;
  if (v.kind === 'youtube') return <VideoYouTube key={v.id} id={v.id} titulo={aula.titulo} posicaoInicial={posicaoInicial} onPosicao={onPosicao} />;
  if (v.kind === 'vimeo') {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-xl bg-black shadow-sm">
        <iframe
          key={v.embed}
          src={v.embed}
          title={aula.titulo}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    );
  }
  if (v.kind === 'file') {
    return (
      <div className="space-y-1">
        <video key={v.src} ref={videoRef} src={v.src} poster={aula.poster_url || undefined} controls controlsList="nodownload" playsInline preload="metadata" crossOrigin={aula.legendas_url ? 'anonymous' : undefined} className="aspect-video w-full rounded-xl bg-black shadow-sm"
          onLoadedMetadata={aoCarregar} onTimeUpdate={() => reportar(false)} onPause={() => reportar(true)} onEnded={() => reportar(true)} onSeeked={() => reportar(true)}>
          {aula.legendas_url && <track kind="subtitles" srcLang="pt" label="Português" src={aula.legendas_url} default />}
          O seu navegador não consegue reproduzir este vídeo.
        </video>
        {Number(posicaoInicial) > 5 && <p className="text-xs text-slate-500 dark:text-slate-400">A retomar de onde ficou.{aula.legendas_url ? ' Legendas disponíveis (botão CC).' : ''}</p>}
      </div>
    );
  }
  // URL desconhecida: não arriscamos um iframe cego; oferecemos abrir fora.
  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-xl border bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
      <PlayCircle className="h-10 w-10 text-slate-400" aria-hidden="true" />
      <p className="text-sm text-slate-600 dark:text-slate-400">Este vídeo abre numa página externa.</p>
      <Button asChild>
        <a href={v.src} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" aria-hidden="true" />Abrir vídeo</a>
      </Button>
    </div>
  );
}

// PDF: fetch same-origin -> blob: URL num iframe (mesma técnica do DocumentViewer —
// não depende de serviço externo nem é travado pelo X-Frame-Options do nginx).
function Pdf({ aula }) {
  const url = aula.conteudo_url;
  const [blobUrl, setBlobUrl] = useState(null);
  const [estado, setEstado] = useState('loading'); // loading | ok | erro
  const [simples, setSimples] = useState(false); // visor nativo se o flipbook falhar

  useEffect(() => {
    if (!url) { setEstado('erro'); return; }
    let obj = null, cancel = false;
    setEstado('loading'); setBlobUrl(null);
    (async () => {
      try {
        const r = await fetch(url);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const blob = await r.blob();
        obj = URL.createObjectURL(blob);
        if (cancel) { URL.revokeObjectURL(obj); return; }
        setBlobUrl(obj); setEstado('ok');
      } catch {
        if (!cancel) setEstado('erro');
      }
    })();
    return () => { cancel = true; if (obj) URL.revokeObjectURL(obj); };
  }, [url]);

  if (!url) return <SemConteudo />;
  const nome = (url.split('?')[0].split('/').pop() || 'documento.pdf');
  if (estado === 'ok' && !simples) return <div className="space-y-2"><FlipbookPdf url={blobUrl} titulo={aula.titulo} chave={aula.id} onErro={() => setSimples(true)} /><BarraAcoes url={url} nome={nome} /></div>;
  return (
    <div className="space-y-2">
      <div className="h-[60vh] min-h-[360px] w-full overflow-hidden rounded-xl border bg-slate-100 dark:border-slate-700 dark:bg-slate-900 lg:h-[70vh]">
        {estado === 'loading' && (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />A carregar o PDF…</div>
        )}
        {estado === 'ok' && <iframe src={blobUrl} title={aula.titulo} className="h-full w-full" />}
        {estado === 'erro' && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <FileText className="h-10 w-10 text-slate-400" aria-hidden="true" />
            <p className="max-w-sm px-4 text-sm text-slate-600 dark:text-slate-400">Não foi possível pré-visualizar aqui. Abra o PDF numa nova aba.</p>
            <Button asChild><a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" aria-hidden="true" />Abrir PDF</a></Button>
          </div>
        )}
      </div>
      <BarraAcoes url={url} nome={nome} />
    </div>
  );
}

// Pacote HTML5 (ex.: exportação de ferramenta de autoria) alojado no storage ou externo.
// Pacote HTML5. Com matrícula: instala a API SCORM 1.2/2004 na janela (o pacote encontra-a em
// window.parent.API) e persiste o estado em scorm_estado; pacotes xAPI recebem endpoint/auth/actor
// na query string e o backend (LRS mínimo) regista os statements — aqui só se vigia a conclusão.
function Html5({ aula, matricula, onConclusaoAutomatica }) {
  const url = aula.conteudo_url;
  const norma = aula.opcoes?.norma || null;
  const xapi = norma === 'xapi';
  const comEstado = !!matricula?.id && !!norma;
  const { data: estado, isLoading } = useScormEstado(comEstado ? matricula.id : null, aula.id, { poll: xapi });
  const [src, setSrc] = useState(null);
  const [resumo, setResumo] = useState(null);
  const cbRef = useRef(onConclusaoAutomatica); cbRef.current = onConclusaoAutomatica;
  const estadoRef = useRef(null); estadoRef.current = estado ?? null;
  const avisouRef = useRef(false);

  useEffect(() => {
    avisouRef.current = false; setResumo(null);
    if (!url) return undefined;
    if (!comEstado || isLoading) { if (!comEstado) setSrc(url); return undefined; }
    if (xapi) {
      let vivo = true;
      lancamentoXapi({ matriculaId: matricula.id, aulaId: aula.id }).then(l => { if (vivo) setSrc(urlLancamentoXapi(url, l)); }).catch(() => { if (vivo) setSrc(url); });
      return () => { vivo = false; };
    }
    const inicial = estadoRef.current || {};
    let timer = null; let ultimo = null;
    const persistir = (snap, evento) => {
      ultimo = snap;
      const agora = evento !== 'commit';
      if (timer) { clearTimeout(timer); timer = null; }
      const enviar = () => { const s = ultimo; ultimo = null; if (!s) return; guardarScormEstado({ linha: estadoRef.current, matriculaId: matricula.id, aulaId: aula.id, email: matricula.aluno_email, snap: s }).then(row => { if (row) { estadoRef.current = row; setResumo({ estado: row.estado, nota: row.nota }); } }); };
      if (agora) enviar(); else timer = setTimeout(enviar, 3000);
    };
    const runtime = criarScormRuntime({
      norma, aluno: { id: matricula.aluno_email, nome: matricula.aluno_nome || matricula.aluno_email }, inicial,
      onGuardar: persistir,
      onConcluir: (snap) => { if (avisouRef.current) return; avisouRef.current = true; cbRef.current?.(snap); },
    });
    const remover = instalarScormApi(window, runtime);
    setSrc(url);
    if (inicial.estado) setResumo({ estado: inicial.estado, nota: inicial.nota });
    return () => { runtime.fechar(); if (timer) { clearTimeout(timer); timer = null; } if (ultimo) { const s = ultimo; ultimo = null; guardarScormEstado({ linha: estadoRef.current, matriculaId: matricula.id, aulaId: aula.id, email: matricula.aluno_email, snap: s }); } remover(); };
  }, [url, comEstado, isLoading, xapi, norma, matricula?.id, aula.id]);

  // xAPI: o backend actualiza scorm_estado; quando ficar concluído, avisar (uma vez)
  useEffect(() => {
    if (!xapi || !estado) return;
    setResumo({ estado: estado.estado, nota: estado.nota });
    if (!avisouRef.current && concluidoScorm(estado.estado)) { avisouRef.current = true; cbRef.current?.({ estado: estado.estado, nota: estado.nota, tempo_s: estado.tempo_s }); }
  }, [xapi, estado]);

  if (!url) return <SemConteudo />;
  return (
    <div className="space-y-2">
      <div className="h-[60vh] min-h-[360px] w-full overflow-hidden rounded-xl border bg-white dark:border-slate-700 lg:h-[70vh]">
        {src ? (
          <iframe
            key={src}
            src={src}
            title={aula.titulo}
            className="h-full w-full"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-pointer-lock allow-downloads"
            allow="fullscreen"
            allowFullScreen
          />
        ) : <div className="flex h-full items-center justify-center text-slate-500"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /><span className="ml-2 text-sm">A preparar o conteúdo…</span></div>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {norma ? `${NORMAS_HTML5[norma]?.label || norma}` : ''}
          {resumo?.estado ? ` · estado: ${ESTADO_SCORM_LABEL[resumo.estado] || resumo.estado}` : ''}
          {resumo?.nota != null ? ` · resultado: ${resumo.nota}%` : ''}
        </p>
        <Button asChild variant="outline" size="sm">
          <a href={src || url} target="_blank" rel="noopener noreferrer"><MonitorPlay className="h-4 w-4" aria-hidden="true" />Abrir em ecrã inteiro</a>
        </Button>
      </div>
    </div>
  );
}
const ESTADO_SCORM_LABEL = { 'not attempted': 'não iniciado', incomplete: 'em curso', completed: 'concluído', passed: 'aprovado', failed: 'reprovado', browsed: 'consultado', unknown: '—' };

function Texto({ aula }) {
  const html = aula.conteudo_texto ? sanitizeAulaHtml(aula.conteudo_texto) : '';
  if (!html) return <SemConteudo />;
  return (
    <article
      className="rounded-xl border bg-white p-6 text-[15px] leading-7 text-slate-800 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 md:p-8
        [&_h1]:mb-3 [&_h1]:mt-2 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-slate-900 dark:[&_h1]:text-slate-100
        [&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-slate-900 dark:[&_h2]:text-slate-100
        [&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:text-lg [&_h3]:font-semibold
        [&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1
        [&_a]:text-blue-700 [&_a]:underline dark:[&_a]:text-blue-300
        [&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-blue-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-slate-600 dark:[&_blockquote]:text-slate-400
        [&_img]:my-4 [&_img]:max-w-full [&_img]:rounded-lg
        [&_table]:my-4 [&_table]:w-full [&_table]:text-sm [&_th]:border [&_th]:bg-slate-50 [&_th]:p-2 [&_th]:text-left [&_td]:border [&_td]:p-2 dark:[&_th]:border-slate-700 dark:[&_th]:bg-slate-800 dark:[&_td]:border-slate-700
        [&_strong]:font-semibold [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:text-[13px] dark:[&_code]:bg-slate-800"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function Ligacao({ aula }) {
  const url = aula.conteudo_url;
  if (!url) return <SemConteudo />;
  let host = '';
  try { host = new URL(url, window.location.origin).hostname; } catch { /* */ }
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border bg-slate-50 px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-900">
      <ExternalLink className="h-10 w-10 text-blue-600 dark:text-blue-400" aria-hidden="true" />
      <div>
        <p className="font-medium text-slate-900 dark:text-slate-100">Esta aula abre num recurso externo</p>
        {host && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{host}</p>}
      </div>
      <Button asChild size="lg">
        <a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" aria-hidden="true" />Abrir ligação</a>
      </Button>
      <p className="text-xs text-slate-500 dark:text-slate-400">Quando terminar, volte aqui e marque a aula como concluída.</p>
    </div>
  );
}

// Aula de texto: leitura contínua ou "em livro" (paginado). Textos longos abrem em livro por omissão;
// a escolha do aluno fica guardada.
function TextoOuLivro({ aula }) {
  const html = aula.conteudo_texto ? sanitizeAulaHtml(aula.conteudo_texto) : '';
  const longo = html.replace(/<[^>]+>/g, '').length > 2500;
  const [modo, setModo] = useState(() => { try { return localStorage.getItem('aula:modo-leitura') || (longo ? 'livro' : 'continuo'); } catch { return longo ? 'livro' : 'continuo'; } });
  if (!html) return <SemConteudo />;
  const escolher = (m) => { setModo(m); try { localStorage.setItem('aula:modo-leitura', m); } catch { /* */ } };
  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <div className="inline-flex rounded-md border bg-white p-0.5 text-xs dark:border-slate-700 dark:bg-slate-900" role="group" aria-label="Modo de leitura">
          <button type="button" onClick={() => escolher('livro')} aria-pressed={modo === 'livro'} className={`rounded px-2.5 py-1 ${modo === 'livro' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-600 dark:text-slate-300'}`}>Livro</button>
          <button type="button" onClick={() => escolher('continuo')} aria-pressed={modo === 'continuo'} className={`rounded px-2.5 py-1 ${modo === 'continuo' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-600 dark:text-slate-300'}`}>Contínuo</button>
        </div>
      </div>
      {modo === 'livro' ? <LeitorLivro html={html} titulo={aula.titulo} chave={aula.id} /> : <Texto aula={aula} />}
    </div>
  );
}

// Conteúdo H5P: leitor interno + persistência em scorm_estado (norma 'h5p') + conclusão automática quando a
// actividade reporta conclusão (statement xAPI de topo com resultado).
function H5pAula({ aula, matricula, onConclusaoAutomatica }) {
  const comEstado = !!matricula?.id;
  const { data: estado } = useScormEstado(comEstado ? matricula.id : null, aula.id);
  const estadoRef = useRef(null); estadoRef.current = estado ?? null;
  const cbRef = useRef(onConclusaoAutomatica); cbRef.current = onConclusaoAutomatica;
  const avisouRef = useRef(false);
  const [resumo, setResumo] = useState(null);
  useEffect(() => { avisouRef.current = false; setResumo(null); }, [aula.id]);
  useEffect(() => { if (estado?.estado) setResumo({ estado: estado.estado, nota: estado.nota }); }, [estado]);
  const aoEstado = (ev) => {
    if (!ev.topo && !ev.concluido) return;
    const anterior = estadoRef.current;
    const jaConcluido = anterior && concluidoScorm(anterior.estado);
    const snap = { norma: 'h5p', estado: jaConcluido && !ev.concluido ? anterior.estado : ev.estado, nota: ev.nota ?? anterior?.nota ?? null, sucesso: ev.sucesso, tempo_s: anterior?.tempo_s || null, dados: { ...(anterior?.dados || {}), ultimo_statement: { verbo: ev.verbo, objecto: ev.objecto, em: new Date().toISOString() } }, concluido: ev.concluido || !!jaConcluido };
    setResumo({ estado: snap.estado, nota: snap.nota });
    if (comEstado) guardarScormEstado({ linha: estadoRef.current, matriculaId: matricula.id, aulaId: aula.id, email: matricula.aluno_email, snap }).then(row => { if (row) estadoRef.current = row; });
    if (ev.concluido && !avisouRef.current) { avisouRef.current = true; cbRef.current?.(snap); }
  };
  if (!aula.conteudo_url) return <SemConteudo />;
  return (
    <div className="space-y-2">
      <H5pPlayer dir={aula.conteudo_url} titulo={aula.titulo} onEstado={aoEstado} />
      <p className="text-xs text-slate-500 dark:text-slate-400">H5P{resumo?.estado ? ` · estado: ${ESTADO_SCORM_LABEL[resumo.estado] || resumo.estado}` : ''}{resumo?.nota != null ? ` · resultado: ${resumo.nota}%` : ''}</p>
    </div>
  );
}
