import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize2, Minimize2, Captions, Gauge, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

// Leitor de YouTube "dentro da plataforma": o iframe não recebe cliques (sem título/logo/“Ver no YouTube”)
// e os controlos são nossos — play/pausa, barra de tempo, volume, velocidade, legendas (pt-PT), ecrã inteiro
// e teclado. Comunicação pelo protocolo postMessage do IFrame Player API (sem carregar scripts externos).
const ORIGEM = 'https://www.youtube-nocookie.com';
const VELOCIDADES = [0.75, 1, 1.25, 1.5, 2];
const fmt = (s) => { const n = Math.max(0, Math.floor(Number(s) || 0)); const h = Math.floor(n / 3600), m = Math.floor((n % 3600) / 60), ss = n % 60; return (h ? `${h}:${String(m).padStart(2, '0')}` : String(m)) + ':' + String(ss).padStart(2, '0'); };

export default function VideoYouTube({ id, titulo, posicaoInicial = null, onPosicao }) {
  const wrapRef = useRef(null), frameRef = useRef(null);
  const [pronto, setPronto] = useState(false);
  const [estado, setEstado] = useState(-1);           // -1 não iniciado · 0 fim · 1 a tocar · 2 pausa · 3 buffer
  const [tempo, setTempo] = useState(0);
  const [duracao, setDuracao] = useState(0);
  const [mudo, setMudo] = useState(false);
  const [velocidade, setVelocidade] = useState(1);
  const [legendas, setLegendas] = useState(true);
  const [cheio, setCheio] = useState(false);
  const [mostrarVel, setMostrarVel] = useState(false);
  const [activo, setActivo] = useState(true);
  const seekPendente = useRef(Number(posicaoInicial) > 5 ? Number(posicaoInicial) : null);
  const ultimoEnvio = useRef(0);
  const timerActivo = useRef(null);
  const arrastando = useRef(false);

  const enviar = useCallback((func, args = []) => {
    try { frameRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), ORIGEM); } catch { /* */ }
  }, []);
  const src = `${ORIGEM}/embed/${encodeURIComponent(id)}?enablejsapi=1&controls=0&rel=0&modestbranding=1&disablekb=1&fs=0&iv_load_policy=3&playsinline=1&hl=pt-PT&cc_lang_pref=pt&cc_load_policy=1&origin=${encodeURIComponent(window.location.origin)}`;

  // canal de eventos do YouTube
  useEffect(() => {
    const aoMensagem = (e) => {
      if (e.origin !== ORIGEM || e.source !== frameRef.current?.contentWindow) return;
      let d; try { d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch { return; }
      if (!d || typeof d !== 'object') return;
      if (d.event === 'onReady') { setPronto(true); enviar('setPlaybackRate', [velocidade]); }
      if (d.event === 'infoDelivery' && d.info) {
        const i = d.info;
        if (typeof i.currentTime === 'number' && !arrastando.current) { setTempo(i.currentTime); if (onPosicao && Date.now() - ultimoEnvio.current > 5000) { ultimoEnvio.current = Date.now(); onPosicao(i.currentTime, i.duration || null); } }
        if (typeof i.duration === 'number' && i.duration > 0) setDuracao(i.duration);
        if (typeof i.playerState === 'number') {
          setEstado(i.playerState);
          if (i.playerState === 1 && seekPendente.current != null) { const s = seekPendente.current; seekPendente.current = null; enviar('seekTo', [s, true]); }
          if ((i.playerState === 0 || i.playerState === 2) && onPosicao) { ultimoEnvio.current = Date.now(); onPosicao(i.playerState === 0 ? 0 : i.currentTime || 0, i.duration || null); }
        }
        if (typeof i.muted === 'boolean') setMudo(i.muted);
        if (typeof i.playbackRate === 'number') setVelocidade(i.playbackRate);
      }
    };
    window.addEventListener('message', aoMensagem);
    return () => window.removeEventListener('message', aoMensagem);
  }, [enviar, onPosicao, velocidade]);

  const aoCarregar = () => {
    try { frameRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), ORIGEM); } catch { /* */ }
    // pedir os eventos explicitamente (alguns builds do player só os enviam depois de addEventListener)
    ['onReady', 'onStateChange', 'onPlaybackRateChange'].forEach(ev => enviar('addEventListener', [ev]));
  };
  useEffect(() => { const t = setTimeout(() => { if (!pronto) setPronto(true); }, 2500); return () => clearTimeout(t); }, [pronto]);

  const aTocar = estado === 1 || estado === 3;
  const alternar = () => { if (aTocar) enviar('pauseVideo'); else enviar('playVideo'); };
  const saltar = (delta) => { const t = Math.max(0, Math.min(duracao || Infinity, tempo + delta)); setTempo(t); enviar('seekTo', [t, true]); };
  const irPara = (t) => { setTempo(t); enviar('seekTo', [t, true]); };
  const alternarMudo = () => { if (mudo) { enviar('unMute'); setMudo(false); } else { enviar('mute'); setMudo(true); } };
  const mudarVel = (v) => { setVelocidade(v); enviar('setPlaybackRate', [v]); setMostrarVel(false); };
  const alternarLegendas = () => { if (legendas) { enviar('unloadModule', ['captions']); enviar('unloadModule', ['cc']); } else { enviar('loadModule', ['captions']); enviar('loadModule', ['cc']); enviar('setOption', ['captions', 'track', { languageCode: 'pt' }]); } setLegendas(!legendas); };
  const alternarCheio = () => {
    const w = wrapRef.current; if (!w) return;
    try { if (document.fullscreenElement) document.exitFullscreen(); else w.requestFullscreen?.(); } catch { /* */ }
  };
  useEffect(() => { const f = () => setCheio(!!document.fullscreenElement && document.fullscreenElement === wrapRef.current); document.addEventListener('fullscreenchange', f); return () => document.removeEventListener('fullscreenchange', f); }, []);
  const acordar = () => { setActivo(true); if (timerActivo.current) clearTimeout(timerActivo.current); timerActivo.current = setTimeout(() => setActivo(false), 2800); };
  const teclas = (e) => {
    if (e.target.tagName === 'INPUT' && e.key !== ' ') return;
    const k = e.key.toLowerCase();
    if (k === ' ' || k === 'k') { e.preventDefault(); alternar(); }
    else if (k === 'arrowleft') { e.preventDefault(); saltar(-5); } else if (k === 'arrowright') { e.preventDefault(); saltar(5); }
    else if (k === 'j') saltar(-10); else if (k === 'l') saltar(10);
    else if (k === 'f') alternarCheio(); else if (k === 'm') alternarMudo(); else if (k === 'c') alternarLegendas();
    else if (/^[0-9]$/.test(k) && duracao) irPara((Number(k) / 10) * duracao);
    acordar();
  };
  const pct = duracao ? Math.min(100, (tempo / duracao) * 100) : 0;
  const naoIniciado = estado === -1 || estado === 5;

  return (
    <div ref={wrapRef} className={cn('group relative aspect-video w-full overflow-hidden rounded-xl bg-black shadow-sm outline-none', cheio && 'rounded-none')} tabIndex={0} onKeyDown={teclas} onMouseMove={acordar} onTouchStart={acordar} aria-label={`Vídeo: ${titulo}`} role="region">
      <iframe ref={frameRef} src={src} title={titulo} className="pointer-events-none absolute inset-0 h-full w-full border-0" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" referrerPolicy="strict-origin-when-cross-origin" onLoad={aoCarregar} tabIndex={-1} />
      {/* faixa superior: tapa o título/ligação do YouTube e mostra o nosso */}
      <div className={cn('pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/80 to-transparent px-4 pt-2 text-sm font-medium text-white transition-opacity', activo || !aTocar ? 'opacity-100' : 'opacity-0')}><span className="line-clamp-1">{titulo}</span></div>
      {/* superfície de clique */}
      <button type="button" className="absolute inset-0 h-full w-full cursor-pointer bg-transparent" onClick={alternar} onDoubleClick={alternarCheio} aria-label={aTocar ? 'Pausar' : 'Reproduzir'} />
      {(naoIniciado || estado === 2 || estado === 0) && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-lg">{estado === 0 ? <RotateCcw className="h-9 w-9" aria-hidden="true" /> : <Play className="ml-1 h-10 w-10" aria-hidden="true" />}</span>
        </div>
      )}
      {!pronto && <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-white/80">A carregar o vídeo…</div>}
      {/* controlos */}
      <div className={cn('absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-3 pb-2 pt-8 text-white transition-opacity', activo || !aTocar ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')} onClick={(e) => e.stopPropagation()}>
        <input type="range" min={0} max={Math.max(1, duracao)} step={0.5} value={Math.min(tempo, duracao || 0)} onMouseDown={() => { arrastando.current = true; }} onTouchStart={() => { arrastando.current = true; }} onChange={(e) => setTempo(Number(e.target.value))} onMouseUp={(e) => { arrastando.current = false; irPara(Number(e.target.value)); }} onTouchEnd={(e) => { arrastando.current = false; irPara(Number(e.target.value)); }} aria-label="Posição no vídeo" aria-valuetext={`${fmt(tempo)} de ${fmt(duracao)}`} className="h-1.5 w-full cursor-pointer accent-amber-500" style={{ background: `linear-gradient(to right, #f59e0b ${pct}%, rgba(255,255,255,.3) ${pct}%)` }} />
        <div className="mt-1 flex items-center gap-1">
          <button type="button" className="rounded p-1.5 hover:bg-white/15" onClick={alternar} aria-label={aTocar ? 'Pausar' : 'Reproduzir'}>{aTocar ? <Pause className="h-5 w-5" aria-hidden="true" /> : <Play className="h-5 w-5" aria-hidden="true" />}</button>
          <button type="button" className="rounded p-1.5 hover:bg-white/15" onClick={alternarMudo} aria-label={mudo ? 'Ligar som' : 'Silenciar'}>{mudo ? <VolumeX className="h-5 w-5" aria-hidden="true" /> : <Volume2 className="h-5 w-5" aria-hidden="true" />}</button>
          <span className="ml-1 font-mono text-xs tabular-nums">{fmt(tempo)} / {fmt(duracao)}</span>
          <span className="flex-1" />
          <div className="relative">
            <button type="button" className={cn('inline-flex items-center gap-1 rounded px-2 py-1.5 text-xs font-semibold hover:bg-white/15', velocidade !== 1 && 'text-amber-300')} onClick={() => setMostrarVel(v => !v)} aria-haspopup="menu" aria-expanded={mostrarVel} aria-label="Velocidade de reprodução"><Gauge className="h-4 w-4" aria-hidden="true" />{velocidade}×</button>
            {mostrarVel && <div role="menu" className="absolute bottom-full right-0 mb-1 w-24 overflow-hidden rounded-md bg-slate-900/95 py-1 text-sm shadow-lg">{VELOCIDADES.map(v => <button key={v} type="button" role="menuitemradio" aria-checked={v === velocidade} className={cn('block w-full px-3 py-1.5 text-left hover:bg-white/15', v === velocidade && 'text-amber-300')} onClick={() => mudarVel(v)}>{v}×</button>)}</div>}
          </div>
          <button type="button" className={cn('rounded p-1.5 hover:bg-white/15', legendas ? 'text-amber-300' : '')} onClick={alternarLegendas} aria-pressed={legendas} aria-label="Legendas em português" title="Legendas (pt-PT)"><Captions className="h-5 w-5" aria-hidden="true" /></button>
          <button type="button" className="rounded p-1.5 hover:bg-white/15" onClick={alternarCheio} aria-label={cheio ? 'Sair do ecrã inteiro' : 'Ecrã inteiro'}>{cheio ? <Minimize2 className="h-5 w-5" aria-hidden="true" /> : <Maximize2 className="h-5 w-5" aria-hidden="true" />}</button>
        </div>
      </div>
    </div>
  );
}
