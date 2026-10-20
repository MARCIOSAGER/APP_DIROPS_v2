import React, { useEffect, useRef, useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { logClientError } from '@/lib/errorLogger';

// Leitor de conteúdos H5P (.h5p extraído em storage/uploads/h5p/<id>/) com o h5p-standalone servido em /h5p/.
// Escuta os statements xAPI que o H5P emite (answered/completed) e avisa a aula: onEstado({estado, nota, sucesso, concluido}).
const BASE = '/h5p';
let carregar = null;
let H5PClass = null; // referência guardada: o núcleo H5P apaga window.H5PStandalone depois do primeiro conteúdo carregado
const classeDisponivel = () => (window.H5PStandalone && window.H5PStandalone.H5P) || null;
// Se, depois de o script correr, o global não existir (ambientes onde um `define`/`module` global desvia o UMD para
// AMD/CommonJS), avalia o código num contexto controlado onde `self` é a janela.
async function avaliarBundle() {
  const r = await fetch(`${BASE}/main.bundle.js`, { cache: 'force-cache' });
  if (!r.ok) throw new Error(`Leitor H5P indisponível (HTTP ${r.status})`);
  const src = await r.text();
  if (!/H5PStandalone/.test(src)) throw new Error('O ficheiro do leitor H5P não é o esperado (o servidor devolveu outra coisa).');
  new Function('self', 'window', 'define', 'exports', 'module', src)(window, window, undefined, undefined, undefined);
}
function carregarLeitor() {
  if (H5PClass) return Promise.resolve(H5PClass);
  const jaCarregado = classeDisponivel();
  if (jaCarregado) { H5PClass = jaCarregado; return Promise.resolve(H5PClass); }
  if (!carregar) {
    carregar = new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = `${BASE}/main.bundle.js`; s.async = true;
      s.onload = () => res(); s.onerror = () => rej(new Error('Não foi possível carregar o leitor H5P'));
      document.head.appendChild(s);
    }).catch(() => null).then(async () => {
      if (!classeDisponivel()) await avaliarBundle();
      const cls = classeDisponivel();
      if (!cls) throw new Error(`O leitor H5P carregou mas não ficou disponível (define=${typeof window.define}, module=${typeof window.module}, exports=${typeof window.exports}). Actualize a página com Ctrl+Shift+R.`);
      H5PClass = cls;
      return cls;
    }).catch((e) => { carregar = null; throw e; });
  }
  return carregar;
}
const verboDe = (st) => String(st?.verb?.id || '').split('/').pop().toLowerCase();

export default function H5pPlayer({ dir, titulo, onEstado }) {
  const ref = useRef(null);
  const [fase, setFase] = useState('a_carregar'); // a_carregar | pronto | erro
  const [erro, setErro] = useState('');
  const cb = useRef(onEstado); cb.current = onEstado;
  const concluiu = useRef(false);

  useEffect(() => {
    let vivo = true; const el = ref.current;
    concluiu.current = false; setFase('a_carregar'); setErro('');
    const base = String(dir || '').replace(/\/+$/, '');
    if (!base) { setFase('erro'); setErro('Aula sem pasta H5P.'); return undefined; }
    let ouvinte = null;
    (async () => {
      try {
        const Leitor = await carregarLeitor();
        if (!vivo || !el) return;
        el.innerHTML = '';
        await new Leitor(el, { h5pJsonPath: base, frameJs: `${BASE}/frame.bundle.js`, frameCss: `${BASE}/styles/h5p.css`, fullScreen: true, embed: false, copyright: false, icon: false, export: false, saveFreq: false, customCss: [], customJs: [] });
        if (!vivo) return;
        setFase('pronto');
        const H5P = window.H5P;
        if (H5P && H5P.externalDispatcher) {
          ouvinte = (ev) => {
            const st = ev && ev.data && ev.data.statement; if (!st) return;
            const verbo = verboDe(st);
            const topo = !(st.context && st.context.contextActivities && Array.isArray(st.context.contextActivities.parent) && st.context.contextActivities.parent.length);
            const r = st.result || {};
            const nota = r.score && typeof r.score.scaled === 'number' ? Math.round(r.score.scaled * 1000) / 10 : (r.score && typeof r.score.raw === 'number' && r.score.max ? Math.round((r.score.raw / r.score.max) * 1000) / 10 : null);
            const terminou = topo && (verbo === 'completed' || (verbo === 'answered' && r.completion !== false) || verbo === 'passed' || verbo === 'mastered');
            const estado = verbo === 'failed' ? 'failed' : terminou ? (r.success === false ? 'failed' : r.success === true || nota == null ? (nota == null ? 'completed' : 'passed') : 'completed') : 'incomplete';
            cb.current?.({ estado, nota, sucesso: typeof r.success === 'boolean' ? r.success : null, concluido: terminou && r.success !== false, verbo, objecto: st.object && st.object.id, topo });
          };
          H5P.externalDispatcher.on('xAPI', ouvinte);
        }
      } catch (e) { if (vivo) { setFase('erro'); setErro(e?.message || String(e)); } try { logClientError('h5p', e, { dir: base }); } catch { /* */ } }
    })();
    return () => { vivo = false; try { if (ouvinte && window.H5P && window.H5P.externalDispatcher) window.H5P.externalDispatcher.off('xAPI', ouvinte); } catch { /* */ } if (el) el.innerHTML = ''; };
  }, [dir]);

  return (
    <div className="space-y-2">
      <div className="relative min-h-[240px] w-full overflow-hidden rounded-xl border bg-white dark:border-slate-700 dark:bg-slate-900">
        {fase === 'a_carregar' && <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-white/80 text-sm text-slate-500 dark:bg-slate-900/80"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />A carregar o conteúdo H5P…</div>}
        {fase === 'erro' && <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 p-6 text-center"><AlertCircle className="h-8 w-8 text-slate-400" aria-hidden="true" /><p className="text-sm text-slate-600 dark:text-slate-400">Não foi possível apresentar este conteúdo H5P. {erro}</p></div>}
        <div ref={ref} className="h5p-contentor" aria-label={titulo} />
      </div>
    </div>
  );
}
