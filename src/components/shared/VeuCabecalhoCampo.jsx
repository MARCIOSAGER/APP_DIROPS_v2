// Cor e intensidade do véu por cima da fotografia do cabeçalho — Configurações do GED e da Universidade.
// Predefinições à vista; «Personalizada» abre o modo livre (seletor de cor / controlos deslizantes). Pré-visualização
// grande com o texto real e indicador de contraste (WCAG) do texto branco no pior caso (zona branca da foto).
import React from 'react';
import { HexColorPicker, HexColorInput } from 'react-colorful';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, Palette, SlidersHorizontal, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  CORES_VEU, INTENSIDADES_VEU, MIN_LADO_TEXTO, estiloVeu, corVeu, intensidadeVeu, corValida,
  lerPersonalizada, escreverPersonalizada, opacidadeLadoTexto, contrasteTextoBranco,
} from '@/lib/veuCabecalho';

const botaoBase = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 transition-colors';

export default function VeuCabecalhoCampo({ f, set, imagemUrl, titulo = 'Título do portal', texto = 'Texto de apresentação do portal.' }) {
  const cor = corVeu(f);
  const intensidade = intensidadeVeu(f);
  const pers = lerPersonalizada(intensidade);
  const corPersonalizada = !CORES_VEU.some(c => c.valor === cor);

  const contraste = contrasteTextoBranco(cor, opacidadeLadoTexto(intensidade));
  const ok = contraste >= 4.5;

  const mudarPers = (alt) => set('hero_intensidade', escreverPersonalizada({ ...(pers || { texto: 90, foto: 25, dir: 'h' }), ...alt }));

  return (
    <div className="space-y-5">
      {/* Pré-visualização com o texto real */}
      <div>
        <p className="text-sm font-medium">Pré-visualização</p>
        <div className="relative mt-2 aspect-[21/7] w-full overflow-hidden rounded-xl text-white" style={{ backgroundColor: cor }}>
          {imagemUrl && <img src={imagemUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />}
          <div className="absolute inset-0" style={estiloVeu(cor, intensidade)} aria-hidden="true" />
          <div className="relative flex h-full flex-col justify-center gap-1 px-5 sm:px-8">
            <p className="max-w-[70%] text-lg font-bold leading-tight sm:text-2xl">{titulo}</p>
            <p className="max-w-[60%] text-xs text-white/90 sm:text-sm">{texto}</p>
          </div>
        </div>
        <p className={cn('mt-2 flex items-center gap-1.5 text-sm', ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400')} role="status">
          {ok ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <AlertTriangle className="h-4 w-4" aria-hidden="true" />}
          Contraste do texto: {contraste.toFixed(1).replace('.', ',')}:1 {ok ? '— legível (WCAG AA)' : '— abaixo do recomendado (4,5:1). Escureça o lado do texto ou escolha uma cor mais escura.'}
        </p>
      </div>

      {/* Cor */}
      <div>
        <p id="veu-cor" className="text-sm font-medium">Cor do véu</p>
        <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-labelledby="veu-cor">
          {CORES_VEU.map(c => {
            const activa = cor === c.valor;
            return (
              <button key={c.valor} type="button" role="radio" aria-checked={activa} onClick={() => set('hero_cor', c.valor)}
                className={cn('flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm', botaoBase,
                  activa ? 'border-teal-600 bg-teal-50 font-medium dark:bg-teal-950/40' : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800')}>
                <span className="flex h-6 w-6 items-center justify-center rounded-full ring-1 ring-black/10" style={{ backgroundColor: c.valor }}>
                  {activa && <Check className="h-3.5 w-3.5 text-white" aria-hidden="true" />}
                </span>
                {c.nome}
              </button>
            );
          })}
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" role="radio" aria-checked={corPersonalizada}
                className={cn('flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm', botaoBase,
                  corPersonalizada ? 'border-teal-600 bg-teal-50 font-medium dark:bg-teal-950/40' : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800')}>
                <span className="flex h-6 w-6 items-center justify-center rounded-full ring-1 ring-black/10" style={{ background: corPersonalizada ? cor : 'conic-gradient(#ef4444,#f59e0b,#22c55e,#06b6d4,#6366f1,#ec4899,#ef4444)' }}>
                  {corPersonalizada ? <Check className="h-3.5 w-3.5 text-white" aria-hidden="true" /> : <Palette className="h-3.5 w-3.5 text-white" aria-hidden="true" />}
                </span>
                {corPersonalizada ? <span className="font-mono text-xs uppercase">{cor}</span> : 'Personalizada'}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto space-y-3 p-3">
              {/* react-colorful: zona de saturação + barra de tons, acessível por teclado */}
              <HexColorPicker color={cor} onChange={(v) => set('hero_cor', corValida(v))} style={{ width: 220, height: 180 }} />
              <div className="flex items-center gap-2">
                <span className="h-8 w-8 shrink-0 rounded-md ring-1 ring-black/10" style={{ backgroundColor: cor }} aria-hidden="true" />
                <label className="sr-only" htmlFor="veu-hex">Código da cor</label>
                <span className="text-sm text-slate-500">#</span>
                <HexColorInput id="veu-hex" color={cor} onChange={(v) => { if (/^#[0-9a-f]{6}$/i.test(v)) set('hero_cor', v.toLowerCase()); }}
                  className="h-8 w-24 rounded-md border border-slate-200 px-2 font-mono text-sm uppercase dark:border-slate-700 dark:bg-slate-900" />
              </div>
              <p className="max-w-[220px] text-xs text-slate-500">Cores escuras dão melhor leitura ao texto branco. O indicador de contraste por cima avisa.</p>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Intensidade */}
      <div>
        <p id="veu-int" className="text-sm font-medium">Intensidade</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">Mais suave = a foto aparece mais.</p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5" role="radiogroup" aria-labelledby="veu-int">
          {INTENSIDADES_VEU.map(i => {
            const activa = intensidade === i.valor;
            return (
              <button key={i.valor} type="button" role="radio" aria-checked={activa} onClick={() => set('hero_intensidade', i.valor)}
                className={cn('overflow-hidden rounded-lg border text-left text-sm', botaoBase, activa ? 'border-teal-600 ring-2 ring-teal-600/30' : 'border-slate-200 hover:border-slate-300 dark:border-slate-700')}>
                <span className="relative block h-12 bg-cover bg-center" style={{ backgroundColor: cor, backgroundImage: imagemUrl ? `url(${imagemUrl})` : undefined }}>
                  <span className="absolute inset-0" style={estiloVeu(cor, i.valor)} />
                </span>
                <span className={cn('block px-2 py-1', activa ? 'font-medium' : 'text-slate-500 dark:text-slate-400')}>{i.nome}</span>
              </button>
            );
          })}
          <button type="button" role="radio" aria-checked={!!pers} onClick={() => !pers && mudarPers({})}
            className={cn('overflow-hidden rounded-lg border text-left text-sm', botaoBase, pers ? 'border-teal-600 ring-2 ring-teal-600/30' : 'border-slate-200 hover:border-slate-300 dark:border-slate-700')}>
            <span className="flex h-12 items-center justify-center bg-slate-50 dark:bg-slate-800"><SlidersHorizontal className="h-5 w-5 text-slate-500" aria-hidden="true" /></span>
            <span className={cn('block px-2 py-1', pers ? 'font-medium' : 'text-slate-500 dark:text-slate-400')}>Personalizada</span>
          </button>
        </div>

        {pers && (
          <div className="mt-3 grid gap-4 rounded-lg border border-slate-200 p-3 dark:border-slate-700 sm:grid-cols-3">
            <label className="block text-sm">
              <span className="flex justify-between"><span>Lado do texto</span><span className="tabular-nums text-slate-500">{pers.texto}%</span></span>
              <input type="range" min={MIN_LADO_TEXTO} max={100} value={pers.texto} onChange={e => mudarPers({ texto: Number(e.target.value) })} className="mt-1 w-full accent-teal-600" />
            </label>
            <label className="block text-sm">
              <span className="flex justify-between"><span>Lado da foto</span><span className="tabular-nums text-slate-500">{pers.foto}%</span></span>
              <input type="range" min={0} max={100} value={pers.foto} onChange={e => mudarPers({ foto: Number(e.target.value) })} className="mt-1 w-full accent-teal-600" />
            </label>
            <div className="text-sm">
              <span>Direcção</span>
              <div className="mt-1 flex gap-2" role="radiogroup" aria-label="Direcção do degradê">
                {[['h', 'Da esquerda'], ['v', 'De baixo']].map(([v, l]) => (
                  <button key={v} type="button" role="radio" aria-checked={pers.dir === v} onClick={() => mudarPers({ dir: v })}
                    className={cn('h-9 flex-1 rounded-md border px-2', botaoBase, pers.dir === v ? 'border-teal-600 bg-teal-50 font-medium dark:bg-teal-950/40' : 'border-slate-200 dark:border-slate-700')}>{l}</button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
