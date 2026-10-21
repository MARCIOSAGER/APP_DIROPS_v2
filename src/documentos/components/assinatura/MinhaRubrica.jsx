// A minha rubrica (em «A minha conta»). Duas formas de a criar — desenhar num quadro ou carregar uma imagem — e
// uma pré-visualização antes de guardar. O tratamento dos píxeis (fundo transparente, recorte, tamanho) está em
// rubricaImagem.js, em funções puras e testadas; aqui só se desenha.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Eraser, Loader2, PenLine, Save, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { fmtDataHora } from '@/lib/safeDate';
import { T } from '../../PortalLayout';
import { useMinhaRubrica, guardarRubrica, useRecarregarRubrica, falta186, MENSAGEM_SEM_186 } from '../../hooksCopiaAssinada';
import {
  fundoTransparente, caixaDoTraco, ajustarDimensoes, validarRubrica, tipoImagemAceite,
  RUBRICA_LARGURA, RUBRICA_ALTURA,
} from '../../rubricaImagem';

const QUADRO_W = 600;
const QUADRO_H = 200;

// Pega num canvas qualquer e devolve o PNG final (fundo transparente, recortado, ≤ 600×200), ou '' se vazio.
function processarCanvas(origem) {
  const w = origem.width; const h = origem.height;
  const ctx = origem.getContext('2d', { willReadFrequently: true });
  const dados = ctx.getImageData(0, 0, w, h);
  fundoTransparente(dados.data);
  const caixa = caixaDoTraco(dados.data, w, h);
  if (!caixa) return '';
  const limpo = document.createElement('canvas');
  limpo.width = w; limpo.height = h;
  limpo.getContext('2d').putImageData(dados, 0, 0);
  const alvo = ajustarDimensoes(caixa.w, caixa.h, RUBRICA_LARGURA, RUBRICA_ALTURA);
  const final = document.createElement('canvas');
  final.width = alvo.w; final.height = alvo.h;
  const fctx = final.getContext('2d');
  fctx.imageSmoothingEnabled = true;
  fctx.imageSmoothingQuality = 'high';
  fctx.drawImage(limpo, caixa.x, caixa.y, caixa.w, caixa.h, 0, 0, alvo.w, alvo.h);
  return final.toDataURL('image/png');
}

function carregarImagem(ficheiro) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(ficheiro);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível ler a imagem. Use um PNG ou JPG.')); };
    img.src = url;
  });
}

// ── quadro para desenhar ────────────────────────────────────────────────────
function Quadro({ onAlterado, limparRef, canvasRef }) {
  const proprio = useRef(null);
  const canvas = canvasRef || proprio;
  const aDesenhar = useRef(false);
  const ultimo = useRef(null);
  const meio = useRef(null);

  const ctx = () => canvas.current?.getContext('2d', { willReadFrequently: true });

  const limpar = useCallback(() => {
    const c = canvas.current; if (!c) return;
    const g = ctx();
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, c.width, c.height);
    onAlterado?.(false);
  }, [onAlterado]);

  useEffect(() => { limpar(); if (limparRef) limparRef.current = limpar; }, [limpar, limparRef]);

  const ponto = (e) => {
    const r = canvas.current.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * canvas.current.width) / r.width, y: ((e.clientY - r.top) * canvas.current.height) / r.height, p: e.pressure };
  };
  const espessura = (p) => (p && p > 0 && p !== 0.5 ? 1.6 + p * 3.2 : 3);

  const baixar = (e) => {
    e.preventDefault();
    canvas.current.setPointerCapture?.(e.pointerId);
    aDesenhar.current = true;
    const pt = ponto(e);
    ultimo.current = pt; meio.current = pt;
    const g = ctx();
    g.fillStyle = '#0f172a';
    g.beginPath(); g.arc(pt.x, pt.y, espessura(pt.p) / 2, 0, Math.PI * 2); g.fill();
    onAlterado?.(true);
  };
  const mover = (e) => {
    if (!aDesenhar.current) return;
    e.preventDefault();
    const pt = ponto(e);
    const g = ctx();
    // curvas quadráticas pelos pontos médios: traço suave em vez de segmentos partidos
    const m = { x: (ultimo.current.x + pt.x) / 2, y: (ultimo.current.y + pt.y) / 2 };
    g.strokeStyle = '#0f172a';
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.lineWidth = espessura(pt.p);
    g.beginPath();
    g.moveTo(meio.current.x, meio.current.y);
    g.quadraticCurveTo(ultimo.current.x, ultimo.current.y, m.x, m.y);
    g.stroke();
    ultimo.current = pt; meio.current = m;
  };
  const levantar = () => { aDesenhar.current = false; };

  return (
    <canvas
      ref={canvas}
      width={QUADRO_W}
      height={QUADRO_H}
      onPointerDown={baixar}
      onPointerMove={mover}
      onPointerUp={levantar}
      onPointerLeave={levantar}
      onPointerCancel={levantar}
      aria-label="Quadro para desenhar a rubrica com o rato ou a caneta"
      className={cn('block w-full max-w-[600px] cursor-crosshair touch-none rounded-lg border bg-white', T.linha)}
      style={{ aspectRatio: `${QUADRO_W} / ${QUADRO_H}` }}
    />
  );
}

function Previsao({ src, legenda }) {
  return (
    <figure className="space-y-1">
      <div className={cn('flex h-28 items-center justify-center rounded-lg border p-2', T.linha)}
        style={{ backgroundImage: 'linear-gradient(45deg,#f1f5f9 25%,transparent 25%,transparent 75%,#f1f5f9 75%),linear-gradient(45deg,#f1f5f9 25%,#fff 25%,#fff 75%,#f1f5f9 75%)', backgroundSize: '16px 16px', backgroundPosition: '0 0,8px 8px' }}>
        <img src={src} alt="Rubrica" className="max-h-full max-w-full object-contain" />
      </div>
      {legenda && <figcaption className={cn('text-sm', T.tintaFraca)}>{legenda}</figcaption>}
    </figure>
  );
}

export default function MinhaRubrica() {
  const q = useMinhaRubrica();
  const recarregar = useRecarregarRubrica();
  const [modo, setModo] = useState(null);            // null | 'desenhar' | 'carregar'
  const [temTraco, setTemTraco] = useState(false);
  const [nova, setNova] = useState('');              // data URL pronta a guardar
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState(null);
  const limparRef = useRef(null);
  const ficheiroRef = useRef(null);
  const quadroRef = useRef(null);

  const semMigracao = q.isError && falta186(q.error);
  const actual = q.data || null;

  const recomecar = () => { setModo(null); setNova(''); setTemTraco(false); };

  const usarDesenho = () => {
    const c = quadroRef.current;
    if (!c) return;
    const png = processarCanvas(c);
    if (!png) { setMsg({ ok: false, texto: 'O quadro está vazio. Desenhe a rubrica primeiro.' }); return; }
    setNova(png); setMsg(null);
  };

  const escolherFicheiro = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!tipoImagemAceite(f)) { setMsg({ ok: false, texto: 'Use uma imagem PNG ou JPG.' }); return; }
    if (f.size > 15 * 1024 * 1024) { setMsg({ ok: false, texto: 'A imagem é demasiado grande (máximo 15 MB).' }); return; }
    setOcupado(true); setMsg(null);
    try {
      const img = await carregarImagem(f);
      // trabalha numa cópia até 1600 px de largura (fotografias de telemóvel são enormes)
      const base = ajustarDimensoes(img.naturalWidth, img.naturalHeight, 1600, 1600);
      const c = document.createElement('canvas');
      c.width = base.w; c.height = base.h;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, 0, base.w, base.h);
      const png = processarCanvas(c);
      if (!png) throw new Error('Não se encontrou nenhum traço na imagem. Use uma rubrica escura sobre fundo claro.');
      setNova(png);
    } catch (err) {
      setMsg({ ok: false, texto: err?.message || 'Não foi possível tratar a imagem.' });
    } finally { setOcupado(false); }
  };

  const guardar = async () => {
    const erro = validarRubrica(nova);
    if (erro) { setMsg({ ok: false, texto: erro }); return; }
    setOcupado(true); setMsg(null);
    try {
      await guardarRubrica(nova);
      recarregar();
      recomecar();
      setMsg({ ok: true, texto: 'Rubrica guardada. Vai aparecer nos documentos que assinar a partir de agora (e nas cópias que forem geradas de novo).' });
    } catch (err) { setMsg({ ok: false, texto: err?.message || 'Não foi possível guardar.' }); }
    finally { setOcupado(false); }
  };

  const remover = async () => {
    setOcupado(true); setMsg(null);
    try {
      await guardarRubrica(null);
      recarregar();
      setMsg({ ok: true, texto: 'Rubrica removida.' });
    } catch (err) { setMsg({ ok: false, texto: err?.message || 'Não foi possível remover.' }); }
    finally { setOcupado(false); }
  };

  return (
    <div className="space-y-4">
      <p className={cn('text-sm', T.tintaMedia)}>
        A rubrica só aparece nos documentos que assinar pessoalmente no fluxo de aprovação; a prova é a assinatura electrónica, não a imagem.
      </p>

      {semMigracao ? (
        <p className={cn('flex items-start gap-2 text-sm', T.ambar)}><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{MENSAGEM_SEM_186}</p>
      ) : q.isLoading ? (
        <p className={cn('inline-flex items-center gap-2 text-sm', T.tintaFraca)}><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />A carregar a sua rubrica…</p>
      ) : q.isError ? (
        <p className={cn('text-sm', T.vermelho)}>{q.error?.message || 'Não foi possível ler a sua rubrica.'}</p>
      ) : actual && !modo ? (
        <div className="space-y-3">
          <Previsao src={actual.imagem} legenda={actual.actualizado_em ? `Actualizada em ${fmtDataHora(actual.actualizado_em)}` : null} />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="h-11" onClick={() => setModo('desenhar')} disabled={ocupado}><PenLine className="h-4 w-4" aria-hidden="true" />Desenhar outra</Button>
            <Button variant="outline" className="h-11" onClick={() => { setModo('carregar'); setTimeout(() => ficheiroRef.current?.click(), 0); }} disabled={ocupado}><Upload className="h-4 w-4" aria-hidden="true" />Carregar imagem</Button>
            <Button variant="ghost" className={cn('h-11', T.vermelho)} onClick={remover} disabled={ocupado}>
              {ocupado ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}Remover
            </Button>
          </div>
        </div>
      ) : !modo ? (
        <div className="space-y-3">
          <p className={cn('text-sm', T.tintaFraca)}>Ainda não tem rubrica. Sem ela, os documentos que assinar mostram só o nome, o papel, a data e o código.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="h-11" onClick={() => setModo('desenhar')}><PenLine className="h-4 w-4" aria-hidden="true" />Desenhar</Button>
            <Button variant="outline" className="h-11" onClick={() => { setModo('carregar'); setTimeout(() => ficheiroRef.current?.click(), 0); }}><Upload className="h-4 w-4" aria-hidden="true" />Carregar imagem</Button>
          </div>
        </div>
      ) : null}

      <input ref={ficheiroRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={escolherFicheiro} aria-label="Escolher imagem da rubrica" />

      {modo === 'desenhar' && !nova && (
        <div className="space-y-2">
          <p className={cn('text-sm', T.tintaFraca)}>Desenhe com o rato ou a caneta dentro do quadro.</p>
          <Quadro onAlterado={setTemTraco} limparRef={limparRef} canvasRef={quadroRef} />
          <div className="flex flex-wrap gap-2">
            <Button className="h-11" onClick={usarDesenho} disabled={!temTraco}><CheckCircle2 className="h-4 w-4" aria-hidden="true" />Pré-visualizar</Button>
            <Button variant="outline" className="h-11" onClick={() => limparRef.current?.()}><Eraser className="h-4 w-4" aria-hidden="true" />Limpar</Button>
            <Button variant="ghost" className="h-11" onClick={recomecar}>Cancelar</Button>
          </div>
        </div>
      )}

      {modo === 'carregar' && !nova && (
        <div className="space-y-2">
          <p className={cn('text-sm', T.tintaFraca)}>
            Uma fotografia ou digitalização da rubrica em papel branco. As margens e o fundo branco são retirados automaticamente.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="h-11" onClick={() => ficheiroRef.current?.click()} disabled={ocupado}>
              {ocupado ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}Escolher imagem (PNG ou JPG)
            </Button>
            <Button variant="ghost" className="h-11" onClick={recomecar}>Cancelar</Button>
          </div>
        </div>
      )}

      {nova && (
        <div className="space-y-3">
          <Previsao src={nova} legenda="Assim fica nos documentos. Confira antes de guardar." />
          <div className="flex flex-wrap gap-2">
            <Button className="h-11" onClick={guardar} disabled={ocupado}>
              {ocupado ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}Guardar rubrica
            </Button>
            <Button variant="outline" className="h-11" onClick={() => setNova('')} disabled={ocupado}>Refazer</Button>
            <Button variant="ghost" className="h-11" onClick={recomecar} disabled={ocupado}>Cancelar</Button>
          </div>
        </div>
      )}

      {msg && (
        <p role="status" className={cn('flex items-start gap-2 text-sm', msg.ok ? T.verde : T.vermelho)}>
          {msg.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
          {msg.texto}
        </p>
      )}
    </div>
  );
}
