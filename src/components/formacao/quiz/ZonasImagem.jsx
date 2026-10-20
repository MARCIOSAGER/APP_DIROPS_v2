import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { coordsPct, novoId } from './quizUtils';

const MIN = 2; // % mínimo de largura/altura de uma zona

// Editor de zonas rectangulares sobre uma imagem (coordenadas em % da imagem):
// arrastar no espaço livre desenha uma zona; arrastar uma zona move-a; × apaga.
// comRotulo: cada zona tem um texto (tipo 'rotulos'); sem: zonas correctas (tipo 'hotspot').
export default function ZonasImagem({ src, zonas = [], onChange, comRotulo = false }) {
  const areaRef = useRef(null);
  const [rascunho, setRascunho] = useState(null); // { x0, y0, x, y } enquanto desenha
  const [arrasto, setArrasto] = useState(null);   // { id, dx, dy } enquanto move

  const set = (fn) => onChange(fn(zonas));
  const norm = (a, b) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) });

  const onDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target.closest('[data-zona]')) return; // começa num a zona -> mover (tratado na zona)
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const c = coordsPct(e, areaRef.current);
    setRascunho({ x0: c.x, y0: c.y, x: c.x, y: c.y });
  };
  const onMove = (e) => {
    if (rascunho) { const c = coordsPct(e, areaRef.current); setRascunho(r => ({ ...r, x: c.x, y: c.y })); }
    else if (arrasto) {
      const c = coordsPct(e, areaRef.current);
      set(zs => zs.map(z => (z.id === arrasto.id ? { ...z, x: Math.max(0, Math.min(100 - z.w, c.x - arrasto.dx)), y: Math.max(0, Math.min(100 - z.h, c.y - arrasto.dy)) } : z)));
    }
  };
  const onUp = () => {
    if (rascunho) {
      const r = norm({ x: rascunho.x0, y: rascunho.y0 }, { x: rascunho.x, y: rascunho.y });
      if (r.w >= MIN && r.h >= MIN) set(zs => [...zs, { id: novoId(), ...r, ...(comRotulo ? { rotulo: '' } : {}) }]);
      setRascunho(null);
    }
    setArrasto(null);
  };
  const iniciarMover = (e, z) => {
    e.stopPropagation();
    e.currentTarget.closest('[data-area]')?.setPointerCapture?.(e.pointerId);
    const c = coordsPct(e, areaRef.current);
    setArrasto({ id: z.id, dx: c.x - z.x, dy: c.y - z.y });
  };

  const rect = rascunho ? norm({ x: rascunho.x0, y: rascunho.y0 }, { x: rascunho.x, y: rascunho.y }) : null;

  return (
    <div className="space-y-3">
      <div ref={areaRef} data-area className="relative w-full cursor-crosshair select-none overflow-hidden rounded-md border bg-slate-100 dark:border-slate-700 dark:bg-slate-800" style={{ touchAction: 'none' }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} role="application" aria-label="Desenhar zonas sobre a imagem">
        <img src={src} alt="" className="block h-auto w-full max-h-[480px] object-contain" draggable={false} />
        {zonas.map((z, i) => (
          <div key={z.id} data-zona onPointerDown={(e) => iniciarMover(e, z)}
            className={cn('absolute cursor-move rounded-sm border-2 border-blue-500 bg-blue-500/20', arrasto?.id === z.id && 'bg-blue-500/30')}
            style={{ left: `${z.x}%`, top: `${z.y}%`, width: `${z.w}%`, height: `${z.h}%` }} aria-label={`Zona ${i + 1}`}>
            <span className="absolute left-0 top-0 max-w-full truncate rounded-br bg-blue-600 px-1 text-[11px] font-semibold leading-4 text-white">{i + 1}{comRotulo && z.rotulo ? ` · ${z.rotulo}` : ''}</span>
          </div>
        ))}
        {rect && rect.w > 0 && <div className="pointer-events-none absolute rounded-sm border-2 border-dashed border-blue-600 bg-blue-500/10" style={{ left: `${rect.x}%`, top: `${rect.y}%`, width: `${rect.w}%`, height: `${rect.h}%` }} />}
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">Arraste sobre a imagem para desenhar uma zona; arraste uma zona para a mover. {comRotulo ? 'Dê um rótulo a cada zona — o aluno recebe os rótulos baralhados.' : 'Qualquer clique do aluno dentro de uma zona conta como correcto.'}</p>
      {zonas.length > 0 && (
        <ol className="space-y-1.5">{zonas.map((z, i) => (
          <li key={z.id} className="flex items-center gap-2">
            <span className="w-6 shrink-0 text-right text-sm tabular-nums text-slate-500">{i + 1}.</span>
            {comRotulo
              ? <Input value={z.rotulo || ''} onChange={(e) => set(zs => zs.map(x => (x.id === z.id ? { ...x, rotulo: e.target.value } : x)))} placeholder={`Rótulo da zona ${i + 1}`} aria-label={`Rótulo da zona ${i + 1}`} />
              : <span className="flex-1 text-xs tabular-nums text-slate-500 dark:text-slate-400">x {Math.round(z.x)}% · y {Math.round(z.y)}% · {Math.round(z.w)}×{Math.round(z.h)}%</span>}
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-red-600" aria-label={`Remover zona ${i + 1}`} onClick={() => set(zs => zs.filter(x => x.id !== z.id))}><Trash2 className="h-4 w-4" /></Button>
          </li>
        ))}</ol>
      )}
    </div>
  );
}
