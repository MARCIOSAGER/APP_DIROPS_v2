import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import Select from '@/components/ui/select';
import { RotateCcw, Move, Plus, Trash2, Type } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LAYOUT_FRENTE_DEFAULT, CORES_CERT, TEXTOS_CERT_DEFAULT } from '@/lib/certificadoPdf';
import { recortarMargens } from '@/lib/imagemRecorte';

// Editor visual da FRENTE do certificado.
//  - Elementos fixos (título, nome, curso, …): arrastar, redimensionar, fonte/cor, e EDITAR O TEXTO
//    dos que não são automáticos (o texto vive em certificado_config.textos).
//  - Caixas de texto livres (CRUD): layout.frente.extras = [{ id, texto, x, y, size, font, bold, italic, align, cor, hidden }].
//  - Placeholders em qualquer texto: {nome} {curso} {horas} {data} {numero} {local}.
// Página A4 paisagem = 842×595 pt; x,y em % da página; tamanhos em pt. O gerador jsPDF lê o mesmo objecto.
const PW = 842, PH = 595, MARGEM = 34;
const ITENS = [
  { k: 'logo', label: 'Logótipo', tipo: 'imagem' },
  { k: 'titulo', label: 'Título', tipo: 'texto', campo: 'titulo' },
  { k: 'eyebrow', label: 'Linha superior', tipo: 'texto', campo: 'eyebrow' },
  { k: 'intro', label: 'Antes do nome', tipo: 'texto', campo: 'intro' },
  { k: 'nome', label: 'Nome do aluno', tipo: 'auto', nota: 'Preenchido automaticamente com o nome do aluno.' },
  { k: 'corpo', label: 'Depois do nome', tipo: 'texto', campo: 'corpo' },
  { k: 'curso', label: 'Nome do curso', tipo: 'auto', nota: 'Preenchido automaticamente com o título do curso.' },
  { k: 'info', label: 'Carga horária e data', tipo: 'texto', campo: 'info', nota: 'Use {horas} e {data}. Sem carga horária no curso usa-se a variante "sem horas".' },
  { k: 'localdata', label: 'Local e data', tipo: 'texto', campo: 'local', nota: 'Escreva só o local (ex.: Catumbela); a data de emissão é acrescentada: "Catumbela, 29 de Setembro de 2026". Vazio = não aparece.' },
  { k: 'validade', label: 'Validade', tipo: 'texto', campo: 'validade', nota: 'Só aparece em cursos com validade (meses) definida. Use {validade} para a data.' },
  { k: 'assinaturas', label: 'Assinaturas', tipo: 'assinaturas' },
  { k: 'numero', label: 'Número do certificado', tipo: 'auto', nota: 'Preenchido automaticamente: "Certificado nº DO-2026/0001-7F3A2C" (ano, número sequencial e código de verificação).' },
];
const ALINHAMENTOS = [{ value: 'left', label: 'Esquerda' }, { value: 'center', label: 'Centro' }, { value: 'right', label: 'Direita' }];
const FONTES = [{ value: 'times', label: 'Serifada (Times)' }, { value: 'helvetica', label: 'Sem serifa (Helvetica)' }];
const CORES = Object.keys(CORES_CERT).map(c => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) }));
const FONTE = { times: '"Times New Roman", Times, serif', helvetica: 'Helvetica, Arial, sans-serif' };
const rgb = (c) => { const v = CORES_CERT[c] || CORES_CERT.ink; return `rgb(${v[0]},${v[1]},${v[2]})`; };
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const novoId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'ex' + Date.now() + Math.random().toString(16).slice(2));

// Imagem da assinatura com as margens recortadas (igual ao que o PDF faz).
function AssinaturaImg({ src, style }) {
  const [s, setS] = useState(src);
  useEffect(() => { let vivo = true; setS(src); recortarMargens(src).then(r => { if (vivo && r) setS(r); }); return () => { vivo = false; }; }, [src]);
  return <img src={s} alt="" draggable={false} style={style} />;
}

export default function LayoutEditor({ layout, onChange, textos, onTextosChange, fundoUrl, logoUrl, assinantes = [], cursoTitulo, cargaHoraria, validadeMeses = null, cargoAcima = false }) {
  const canvasRef = useRef(null);
  const [largura, setLargura] = useState(842);
  const [sel, setSel] = useState('nome');
  const [guias, setGuias] = useState(true);      // réguas, centro e ímanes de alinhamento
  const [guiaAtiva, setGuiaAtiva] = useState(null); // guia vermelha enquanto um elemento encosta (x/y em %)
  const frente = layout?.frente || {};
  const extras = useMemo(() => (Array.isArray(frente.extras) ? frente.extras : []), [frente.extras]);
  const escala = largura / PW;
  const T = useMemo(() => ({ ...TEXTOS_CERT_DEFAULT, ...(textos || {}) }), [textos]);

  useEffect(() => {
    const el = canvasRef.current; if (!el) return;
    const medir = () => setLargura(el.clientWidth || 842);
    medir();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null;
    ro?.observe(el);
    window.addEventListener('resize', medir);
    return () => { ro?.disconnect(); window.removeEventListener('resize', medir); };
  }, []);

  // ── leitura/escrita de um item (fixo ou caixa livre) ─────────────────────
  const isExtra = (k) => String(k).startsWith('ex:');
  const extraDe = (k) => extras.find(e => 'ex:' + e.id === k);
  const item = useCallback((k) => {
    if (isExtra(k)) return { x: 50, y: 50, size: 12, font: 'helvetica', align: 'center', cor: 'ink', ...(extras.find(e => 'ex:' + e.id === k) || {}) };
    return { ...LAYOUT_FRENTE_DEFAULT[k], ...(frente[k] || {}) };
  }, [frente, extras]);

  const setFrente = useCallback((patchFrente) => onChange({ ...(layout || {}), frente: { ...frente, ...patchFrente } }), [layout, frente, onChange]);
  const setItem = useCallback((k, patch) => {
    if (isExtra(k)) {
      const id = k.slice(3);
      setFrente({ extras: extras.map(e => (e.id === id ? { ...e, ...patch } : e)) });
    } else {
      setFrente({ [k]: { ...(frente[k] || {}), ...patch } });
    }
  }, [frente, extras, setFrente]);
  const reporItem = (k) => { const f = { ...frente }; delete f[k]; onChange({ ...(layout || {}), frente: f }); };
  const reporTudo = () => onChange({ ...(layout || {}), frente: extras.length ? { extras } : {} });
  const adicionarCaixa = () => {
    const nova = { id: novoId(), texto: 'Novo texto', x: 50, y: 30, size: 12, font: 'helvetica', align: 'center', cor: 'ink' };
    setFrente({ extras: [...extras, nova] });
    setSel('ex:' + nova.id);
  };
  const apagarCaixa = (k) => { const id = k.slice(3); setFrente({ extras: extras.filter(e => e.id !== id) }); setSel('nome'); };
  const setTexto = (campo, v) => onTextosChange?.({ ...(textos || {}), [campo]: v });

  // ── arrasto (rato e toque) e teclado ─────────────────────────────────────
  const drag = useRef(null);
  const onPointerDown = (k) => (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    const it = item(k);
    drag.current = { k, x0: e.clientX, y0: e.clientY, ix: it.x ?? 50, iy: it.y ?? 50 };
    setSel(k);
    e.currentTarget.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };
  const onPointerMove = (e) => {
    const d = drag.current; if (!d) return;
    if (d.ass != null) { // arrasto de uma assinatura individual: dx/desloc em pt
      let ndx = clamp(Math.round(d.idx + (e.clientX - d.x0) / escala), -120, 120);
      let ndy = clamp(Math.round(d.idy + (e.clientY - d.y0) / escala), -60, 60);
      if (guias) { if (Math.abs(ndx) < 3) ndx = 0; if (Math.abs(ndy) < 3) ndy = 0; }
      const cur = item('assinaturas'); const ind = (cur.individual || {})[d.ass] || {};
      if (ind.dx !== ndx || ind.desloc !== ndy) setItem('assinaturas', { individual: { ...(cur.individual || {}), [d.ass]: { ...ind, dx: ndx, desloc: ndy } } });
      return;
    }
    const dx = ((e.clientX - d.x0) / largura) * 100;
    const dy = ((e.clientY - d.y0) / (largura * PH / PW)) * 100;
    let x = clamp(Math.round((d.ix + dx) * 2) / 2, 0, 100);
    let y = clamp(Math.round((d.iy + dy) * 2) / 2, 0, 100);
    let gx = null, gy = null;
    if (guias) { // ímanes: centro da página e coordenadas dos outros elementos (tolerância 1%)
      const outros = [{ x: 50, y: 50 }, ...Object.keys(LAYOUT_FRENTE_DEFAULT).filter(k => k !== d.k).map(k => item(k)), ...extras.filter(e => 'ex:' + e.id !== d.k).map(e => item('ex:' + e.id))];
      for (const c of outros) {
        if (d.k !== 'assinaturas' && c.x != null && Math.abs(x - c.x) < 1) { x = c.x; gx = c.x; }
        if (c.y != null && Math.abs(y - c.y) < 1) { y = c.y; gy = c.y; }
      }
    }
    setGuiaAtiva(gx != null || gy != null ? { x: gx, y: gy } : null);
    const cur = item(d.k);
    if (cur.x !== x || cur.y !== y) setItem(d.k, d.k === 'assinaturas' ? { y } : { x, y });
  };
  const onPointerUp = () => { drag.current = null; setGuiaAtiva(null); };
  const onKeyDown = (k) => (e) => {
    if (e.key === 'Delete' && isExtra(k)) { e.preventDefault(); apagarCaixa(k); return; }
    const passo = e.shiftKey ? 2 : 0.5; const it = item(k); let x = it.x ?? 50, y = it.y ?? 50;
    if (e.key === 'ArrowLeft') x -= passo; else if (e.key === 'ArrowRight') x += passo;
    else if (e.key === 'ArrowUp') y -= passo; else if (e.key === 'ArrowDown') y += passo; else return;
    e.preventDefault();
    setItem(k, k === 'assinaturas' ? { y: clamp(y, 0, 100) } : { x: clamp(x, 0, 100), y: clamp(y, 0, 100) });
  };

  // ── textos de amostra (com placeholders substituídos) ────────────────────
  const hoje = new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' });
  const subst = useCallback((t) => String(t == null ? '' : t)
    .replace(/\{nome\}/g, 'Maria João Silva').replace(/\{curso\}/g, cursoTitulo || 'Nome do curso')
    .replace(/\{horas\}/g, String(cargaHoraria || '')).replace(/\{data\}/g, hoje)
    .replace(/\{numero\}/g, 'DO-2026/0001-7F3A2C').replace(/\{local\}/g, T.local || '').replace(/\{validade\}/g, validadeMeses ? new Date(Date.now() + validadeMeses * 30.44 * 86400000).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' }) : ''), [cursoTitulo, cargaHoraria, hoje, T.local, validadeMeses]);
  const amostra = useMemo(() => ({
    titulo: subst(T.titulo), eyebrow: subst(T.eyebrow), intro: subst(T.intro), nome: 'Maria João Silva', corpo: subst(T.corpo),
    curso: cursoTitulo || 'Nome do curso', info: subst(cargaHoraria ? T.info : T.info_sem_horas),
    localdata: T.local ? `${T.local}, ${hoje}` : '', validade: validadeMeses ? subst(T.validade) : '', numero: 'Certificado nº DO-2026/0001-7F3A2C',
  }), [T, cursoTitulo, cargaHoraria, hoje, subst, validadeMeses]);

  const transformPor = (align) => align === 'left' ? 'translate(0,-100%)' : align === 'right' ? 'translate(-100%,-100%)' : 'translate(-50%,-100%)';
  const pt = (n) => `${(n || 0) * escala}px`;
  const selItem = item(sel);
  const selDef = ITENS.find(i => i.k === sel);
  const selExtra = isExtra(sel) ? extraDe(sel) : null;
  const listaAss = assinantes.length ? assinantes.slice(0, 4) : [{ nome: 'Nome do signatário', cargo: 'Cargo' }, { nome: 'Nome do signatário', cargo: 'Cargo' }];
  // ajustes individuais por assinatura (posição na fila); null = todas (valores globais)
  const [assSel, setAssSel] = useState(null);
  const assInd = (it, i) => ((it && it.individual) || {})[i] || {};
  const assVal = (it, campo, def) => (assSel == null ? (it?.[campo] ?? def) : (assInd(it, assSel)[campo] ?? it?.[campo] ?? def));
  const assSet = (it, campo, v) => (assSel == null ? setItem('assinaturas', { [campo]: v }) : setItem('assinaturas', { individual: { ...((it && it.individual) || {}), [assSel]: { ...assInd(it, assSel), [campo]: v } } }));
  const opcoesElemento = [
    ...ITENS.map(i => ({ value: i.k, label: i.label })),
    ...extras.map(e => ({ value: 'ex:' + e.id, label: 'Caixa: ' + (String(e.texto || '').replace(/\s+/g, ' ').slice(0, 28) || '(vazia)') })),
  ];

  const renderTexto = (k, label, it, texto, extra) => {
    const ativo = sel === k;
    const largo = it.maxWidth ? `${it.maxWidth}%` : undefined;
    return (
      <div key={k} role="button" tabIndex={0} aria-label={label} onPointerDown={onPointerDown(k)} onKeyDown={onKeyDown(k)} onDoubleClick={() => setSel(k)}
        className={cn('absolute cursor-grab touch-none outline-none ring-offset-1 focus-visible:ring-2 focus-visible:ring-blue-500 leading-none', ativo && 'ring-2 ring-blue-500/80', drag.current?.k === k && 'cursor-grabbing', extra ? 'whitespace-pre-wrap' : (largo ? 'whitespace-normal' : 'whitespace-nowrap'))}
        style={{
          left: `${it.x}%`, top: `${it.y}%`, transform: transformPor(it.align), width: largo, minWidth: extra ? pt(40) : undefined,
          textAlign: it.align || 'center', fontFamily: FONTE[it.font] || FONTE.helvetica, fontSize: pt(it.size),
          fontWeight: it.bold ? 700 : 400, fontStyle: it.italic ? 'italic' : 'normal', color: rgb(it.cor), letterSpacing: it.track ? pt(it.track) : undefined,
          lineHeight: extra ? 1.25 : 1.15, paddingBottom: pt(1),
        }}>
        {texto || (extra ? <span className="opacity-40">(caixa vazia)</span> : '')}
        {k === 'nome' && it.sublinhado && <div style={{ borderTop: `${pt(0.8)} solid ${rgb('faint')}`, marginTop: pt(6) }} />}
      </div>
    );
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"><Move className="h-3.5 w-3.5" aria-hidden="true" />Arraste os elementos sobre a arte. Setas do teclado ajustam 0,5% (Shift: 2%). Delete apaga uma caixa livre.</p>
          <Button type="button" variant="outline" size="sm" onClick={adicionarCaixa}><Plus className="h-4 w-4" aria-hidden="true" />Adicionar caixa de texto</Button>
          <label className="ml-2 flex items-center gap-2 text-sm"><Switch checked={guias} onCheckedChange={setGuias} aria-label="Guias e réguas" />Guias e réguas</label>
        </div>
        <div
          ref={canvasRef}
          className="relative w-full select-none overflow-hidden rounded-md border bg-white shadow-sm dark:border-slate-700"
          style={{ aspectRatio: `${PW} / ${PH}` }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {guias && <>
            {Array.from({ length: 21 }, (_, i) => i * 5).map(p => <div key={'rx' + p} className="pointer-events-none absolute top-0" style={{ left: `${p}%`, height: p % 10 === 0 ? 10 : 6, borderLeft: '1px solid rgba(100,116,139,.55)' }}>{p % 10 === 0 && p < 100 && <span className="absolute left-0.5 top-0 text-[8px] leading-none text-slate-500">{p}</span>}</div>)}
            {Array.from({ length: 21 }, (_, i) => i * 5).map(p => <div key={'ry' + p} className="pointer-events-none absolute left-0" style={{ top: `${p}%`, width: p % 10 === 0 ? 10 : 6, borderTop: '1px solid rgba(100,116,139,.55)' }}>{p % 10 === 0 && p > 0 && p < 100 && <span className="absolute left-0 top-0.5 text-[8px] leading-none text-slate-500">{p}</span>}</div>)}
            <div className="pointer-events-none absolute inset-y-0" style={{ left: '50%', borderLeft: '1px dashed rgba(124,58,237,.35)' }} />
            <div className="pointer-events-none absolute inset-x-0" style={{ top: '50%', borderTop: '1px dashed rgba(124,58,237,.35)' }} />
          </>}
          {guiaAtiva?.x != null && <div className="pointer-events-none absolute inset-y-0 z-20" style={{ left: `${guiaAtiva.x}%`, borderLeft: '1px solid #f43f5e' }} />}
          {guiaAtiva?.y != null && <div className="pointer-events-none absolute inset-x-0 z-20" style={{ top: `${guiaAtiva.y}%`, borderTop: '1px solid #f43f5e' }} />}
          {fundoUrl ? (
            <img src={fundoUrl} alt="" className="absolute inset-0 h-full w-full" draggable={false} />
          ) : (
            <>
              <div className="pointer-events-none absolute" style={{ inset: pt(MARGEM), border: `${pt(2.2)} solid ${rgb('gold')}` }} />
              <div className="pointer-events-none absolute" style={{ inset: pt(MARGEM + 7), border: `${pt(0.8)} solid ${rgb('faint')}` }} />
            </>
          )}

          {ITENS.map(({ k, label }) => {
            const it = item(k);
            if (it.hidden) return null;
            if ((k === 'localdata' || k === 'validade') && !amostra[k]) return null;
            const ativo = sel === k;
            const base = cn('absolute cursor-grab touch-none outline-none ring-offset-1 focus-visible:ring-2 focus-visible:ring-blue-500', ativo && 'ring-2 ring-blue-500/80', drag.current?.k === k && 'cursor-grabbing');
            if (k === 'logo') {
              return (
                <div key={k} role="button" tabIndex={0} aria-label={label} onPointerDown={onPointerDown(k)} onKeyDown={onKeyDown(k)}
                  className={cn(base, 'flex items-center justify-center')}
                  style={{ left: `${it.x}%`, top: `${it.y}%`, height: pt(it.h || 40), minWidth: pt(60), transform: 'translateX(-50%)' }}>
                  {logoUrl ? <img src={logoUrl} alt="" className="h-full w-auto" draggable={false} style={{ maxWidth: pt(170) }} /> : <span className="rounded border border-dashed border-slate-400 px-2 text-slate-500" style={{ fontSize: pt(8) }}>LOGO</span>}
                </div>
              );
            }
            if (k === 'assinaturas') {
              const slotW = 190, gap = 30;
              return (
                <div key={k} role="button" tabIndex={0} aria-label={label} onPointerDown={onPointerDown(k)} onKeyDown={onKeyDown(k)}
                  className={cn(base, 'flex')} style={{ left: '50%', top: `${it.y}%`, transform: 'translateX(-50%)', gap: pt(gap) }}>
                  {listaAss.map((a, i) => {
                    const altAss = assInd(it, i).altura ?? it.altura ?? 28; const desAss = assInd(it, i).desloc ?? it.desloc ?? 0; const dxAss = assInd(it, i).dx ?? 0;
                    const aposLinha = Number(it.apos_linha) || 13, entrelinha = Number(it.entrelinha) || 11;
                    const primeiroSize = (cargoAcima && a.cargo) ? (it.size || 10) - 2 : (it.size || 10);
                    const gapDepois = Math.max(0, entrelinha - 1.15 * primeiroSize); // aproxima a distância entre linhas de base do PDF
                    const nome = <div key="n" style={{ fontSize: pt(it.size || 10), fontWeight: 700, color: rgb('ink'), lineHeight: 1.15, marginBottom: pt(!cargoAcima && a.cargo ? gapDepois : 0) }}>{a.nome}</div>;
                    const cargo = a.cargo ? <div key="c" style={{ fontSize: pt((it.size || 10) - 2), color: rgb('muted'), lineHeight: 1.15, marginBottom: pt(cargoAcima ? gapDepois : 0) }}>{a.cargo}</div> : null;
                    return (
                      <div key={i} className={cn('text-center rounded', sel === 'assinaturas' && assSel === i && 'ring-2 ring-violet-500')} style={{ width: pt(slotW), fontFamily: FONTE.helvetica, position: 'relative' }} onPointerDown={(e) => { e.stopPropagation(); setAssSel(i); setSel('assinaturas'); const ind = assInd(it, i); drag.current = { k: 'assinaturas', ass: i, x0: e.clientX, y0: e.clientY, idx: Number(ind.dx) || 0, idy: Number(ind.desloc ?? it.desloc) || 0 }; e.currentTarget.setPointerCapture?.(e.pointerId); e.preventDefault(); }} title={`Assinatura ${i + 1}: arraste para mover só esta`}>
                        <div style={{ position: 'absolute', left: 0, right: 0, bottom: '100%', marginBottom: pt(2), height: pt(altAss), display: 'flex', alignItems: 'flex-end', justifyContent: 'center', transform: `translate(${pt(dxAss)}, ${pt(desAss)})`, zIndex: 1, cursor: 'move' }}>{a.assinatura_url || a.assinaturaDataUrl ? <AssinaturaImg src={a.assinatura_url || a.assinaturaDataUrl} style={{ height: '100%', maxWidth: pt(slotW * 1.4), objectFit: 'contain' }} /> : <div style={{ height: '100%', width: pt(90), border: `${pt(0.5)} dashed ${rgb('muted')}`, borderRadius: pt(3), opacity: 0.5 }} />}</div>
                        <div style={{ marginLeft: pt(12), marginRight: pt(12), borderTop: `${pt(0.8)} solid ${rgb('ink')}`, marginBottom: pt(Math.max(0, aposLinha - 0.8 * primeiroSize)) }} />
                        {cargoAcima ? [cargo, nome] : [nome, cargo]}
                      </div>
                    );
                  })}
                </div>
              );
            }
            return renderTexto(k, label, it, amostra[k], false);
          })}

          {extras.map(e => (e.hidden ? null : renderTexto('ex:' + e.id, 'Caixa de texto', item('ex:' + e.id), subst(e.texto), true)))}
        </div>
      </div>

      {/* ── Painel do elemento seleccionado ─────────────────────────────── */}
      <div className="space-y-3 rounded-md border p-3 dark:border-slate-700">
        <div className="space-y-1.5">
          <Label>Elemento</Label>
          <Select value={sel} onValueChange={setSel} searchable={false} options={opcoesElemento} />
        </div>

        {/* Texto: editável (fixos com campo) ou livre (caixa) ou automático */}
        {selExtra ? (
          <div className="space-y-1.5">
            <Label htmlFor="le-texto" className="flex items-center gap-1.5"><Type className="h-3.5 w-3.5" aria-hidden="true" />Texto da caixa</Label>
            <Textarea id="le-texto" rows={3} value={selExtra.texto || ''} onChange={(e) => setItem(sel, { texto: e.target.value })} placeholder="Escreva aqui…" />
            <p className="text-xs text-slate-500 dark:text-slate-400">Pode usar {'{nome}'}, {'{curso}'}, {'{horas}'}, {'{data}'}, {'{numero}'}, {'{local}'}. Enter faz nova linha.</p>
          </div>
        ) : selDef?.tipo === 'texto' ? (
          <div className="space-y-1.5">
            <Label htmlFor="le-texto" className="flex items-center gap-1.5"><Type className="h-3.5 w-3.5" aria-hidden="true" />Texto</Label>
            {selDef.campo === 'info' ? (
              <>
                <Textarea id="le-texto" rows={2} value={T.info} onChange={(e) => setTexto('info', e.target.value)} />
                <Label htmlFor="le-texto2" className="text-xs text-slate-500">Variante sem carga horária</Label>
                <Textarea id="le-texto2" rows={2} value={T.info_sem_horas} onChange={(e) => setTexto('info_sem_horas', e.target.value)} />
              </>
            ) : (
              <Input id="le-texto" value={T[selDef.campo] ?? ''} onChange={(e) => setTexto(selDef.campo, e.target.value)} />
            )}
            {selDef.nota && <p className="text-xs text-slate-500 dark:text-slate-400">{selDef.nota}</p>}
          </div>
        ) : selDef?.nota ? (
          <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">{selDef.nota}</p>
        ) : null}

        {sel !== 'assinaturas' && (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label htmlFor="le-x">X (%)</Label><Input id="le-x" type="number" min="0" max="100" step="0.5" value={selItem.x ?? 50} onChange={(e) => setItem(sel, { x: clamp(Number(e.target.value), 0, 100) })} /></div>
            <div className="space-y-1.5"><Label htmlFor="le-y">Y (%)</Label><Input id="le-y" type="number" min="0" max="100" step="0.5" value={selItem.y ?? 50} onChange={(e) => setItem(sel, { y: clamp(Number(e.target.value), 0, 100) })} /></div>
          </div>
        )}
        {sel === 'assinaturas' && (
          <div className="space-y-1.5"><Label htmlFor="le-y2">Y (%)</Label><Input id="le-y2" type="number" min="0" max="100" step="0.5" value={selItem.y ?? 84} onChange={(e) => setItem(sel, { y: clamp(Number(e.target.value), 0, 100) })} /></div>
        )}
        {sel === 'assinaturas' && (
          <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label htmlFor="le-apos">Linha → texto (pt)</Label><Input id="le-apos" type="number" min="6" max="40" step="1" value={selItem.apos_linha ?? 13} onChange={(e) => setItem(sel, { apos_linha: clamp(Number(e.target.value), 6, 40) })} /></div><div className="space-y-1.5"><Label htmlFor="le-entre">Função ↔ nome (pt)</Label><Input id="le-entre" type="number" min="6" max="40" step="1" value={selItem.entrelinha ?? 11} onChange={(e) => setItem(sel, { entrelinha: clamp(Number(e.target.value), 6, 40) })} /></div><p className="col-span-2 text-xs text-slate-500">Respiro sob a linha: distância da linha ao primeiro texto e entre a função e o nome (13 e 11 por omissão).</p></div>
        )}
        {sel === 'assinaturas' && (
          <><div className="space-y-2"><Label>Assinatura a ajustar</Label><div className="flex flex-wrap gap-1">{[{ i: null, l: 'Todas' }, ...listaAss.map((a, i) => ({ i, l: `${i + 1}. ${String(a.nome || '').split(' ')[0] || 'Assinatura'}` }))].map(b => <Button key={String(b.i)} type="button" size="sm" variant={assSel === b.i ? 'default' : 'outline'} onClick={() => setAssSel(b.i)}>{b.l}</Button>)}</div><p className="text-xs text-slate-500">«Todas» define os valores base; cada assinatura pode ter os seus. Também pode clicar numa assinatura na pré-visualização.</p>{assSel != null && Object.keys(assInd(selItem, assSel)).length > 0 && <Button type="button" variant="ghost" size="sm" onClick={() => { const ind = { ...(selItem.individual || {}) }; delete ind[assSel]; setItem(sel, { individual: ind }); }}>Repor esta assinatura</Button>}</div>
          <div className="space-y-1.5"><Label htmlFor="le-alt">Altura da assinatura (pt){assSel != null ? ` — ${assSel + 1}` : ''}</Label><Input id="le-alt" type="number" min="10" max="120" step="1" value={assVal(selItem, 'altura', 28)} onChange={(e) => assSet(selItem, 'altura', clamp(Number(e.target.value), 10, 120))} /><p className="text-xs text-slate-500">Tamanho da imagem acima da linha (28 por omissão). O nome e o cargo seguem o «Tamanho (pt)».</p></div></>
        )}
        {sel === 'assinaturas' && (
          <div className="space-y-1.5"><Label htmlFor="le-desloc">Posição vertical da assinatura (pt){assSel != null ? ` — ${assSel + 1}` : ''}</Label><Input id="le-desloc" type="number" min="-60" max="60" step="1" value={assVal(selItem, 'desloc', 0)} onChange={(e) => assSet(selItem, 'desloc', clamp(Number(e.target.value), -60, 60))} /><p className="text-xs text-slate-500">Positivo desce a imagem para a linha (pode sobrepô-la), negativo sobe. Útil quando o PNG tem margem transparente.</p></div>
        )}
        {sel === 'assinaturas' && assSel != null && (
          <div className="space-y-1.5"><Label htmlFor="le-dx">Posição horizontal da assinatura (pt) — {assSel + 1}</Label><Input id="le-dx" type="number" min="-120" max="120" step="1" value={assVal(selItem, 'dx', 0)} onChange={(e) => assSet(selItem, 'dx', clamp(Number(e.target.value), -120, 120))} /><p className="text-xs text-slate-500">Também pode arrastar a assinatura seleccionada na pré-visualização: move só essa imagem; arrastar fora das assinaturas move o bloco todo.</p></div>
        )}
        {sel === 'logo' ? (
          <div className="space-y-1.5"><Label htmlFor="le-h">Altura (pt)</Label><Input id="le-h" type="number" min="10" max="200" step="1" value={selItem.h ?? 40} onChange={(e) => setItem(sel, { h: clamp(Number(e.target.value), 10, 200) })} /></div>
        ) : (
          <div className="space-y-1.5"><Label htmlFor="le-size">Tamanho (pt)</Label><Input id="le-size" type="number" min="5" max="80" step="1" value={selItem.size ?? 10} onChange={(e) => setItem(sel, { size: clamp(Number(e.target.value), 5, 80) })} /></div>
        )}
        {sel !== 'logo' && sel !== 'assinaturas' && (
          <>
            <div className="space-y-1.5"><Label>Fonte</Label><Select value={selItem.font || 'helvetica'} onValueChange={(v) => setItem(sel, { font: v })} searchable={false} options={FONTES} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center justify-between rounded-md border px-3 py-2 dark:border-slate-700"><Label htmlFor="le-bold" className="cursor-pointer">Negrito</Label><Switch id="le-bold" checked={!!selItem.bold} onCheckedChange={(v) => setItem(sel, { bold: !!v })} /></div>
              <div className="flex items-center justify-between rounded-md border px-3 py-2 dark:border-slate-700"><Label htmlFor="le-italic" className="cursor-pointer">Itálico</Label><Switch id="le-italic" checked={!!selItem.italic} onCheckedChange={(v) => setItem(sel, { italic: !!v })} /></div>
            </div>
            <div className="space-y-1.5"><Label>Alinhamento</Label><Select value={selItem.align || 'center'} onValueChange={(v) => setItem(sel, { align: v })} searchable={false} options={ALINHAMENTOS} /></div>
            <div className="space-y-1.5"><Label>Cor</Label><Select value={selItem.cor || 'ink'} onValueChange={(v) => setItem(sel, { cor: v })} searchable={false} options={CORES} /></div>
            <div className="space-y-1.5"><Label htmlFor="le-mw">Largura máx. (% da página, 0 = sem limite)</Label><Input id="le-mw" type="number" min="0" max="100" step="1" value={selItem.maxWidth ?? 0} onChange={(e) => { const v = clamp(Number(e.target.value), 0, 100); setItem(sel, { maxWidth: v || undefined }); }} /></div>
          </>
        )}
        <div className="flex items-center justify-between rounded-md border px-3 py-2 dark:border-slate-700">
          <Label htmlFor="le-hidden" className="cursor-pointer">Oculto</Label>
          <Switch id="le-hidden" checked={!!selItem.hidden} onCheckedChange={(v) => setItem(sel, { hidden: !!v })} />
        </div>
        <div className="flex flex-col gap-1.5 pt-1">
          {selExtra ? (
            <Button type="button" variant="outline" size="sm" className="text-red-600 hover:text-red-700" onClick={() => apagarCaixa(sel)}><Trash2 className="h-4 w-4" aria-hidden="true" />Apagar caixa</Button>
          ) : (
            <Button type="button" variant="ghost" size="sm" onClick={() => reporItem(sel)} disabled={!frente[sel]}><RotateCcw className="h-4 w-4" aria-hidden="true" />Repor este elemento</Button>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={reporTudo} disabled={Object.keys(frente).filter(k => k !== 'extras').length === 0}><RotateCcw className="h-4 w-4" aria-hidden="true" />Repor posições de todos</Button>
        </div>
      </div>
    </div>
  );
}
