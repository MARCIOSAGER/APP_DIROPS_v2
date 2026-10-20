// A cópia offline, vista de dentro do leitor: o botão que a cria e a tira que diz em que estado ela está.
//
// A regra que manda aqui: uma cópia offline que envelhece em silêncio é pior do que não haver cópia nenhuma,
// porque quem opera acredita nela. Por isso a data em que foi guardada está sempre à vista, e o veredicto
// (`estadoCopia`) nunca é «está boa» por omissão — sem confirmação contra o servidor, a resposta é dúvida.
import React from 'react';
import {
  AlertTriangle, CheckCircle2, CloudOff, Download, HardDriveDownload, Loader2, RefreshCw, ShieldAlert, Trash2, WifiOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { fmtDataHora } from '@/lib/safeDate';
import { tk } from '@/documentos/pages/PortalBiblioteca';

const CORES = {
  confirmada: { icone: CheckCircle2, borda: tk.borda, fundo: tk.bomFundo, tinta: tk.bom },
  duvida: { icone: WifiOff, borda: tk.avisoBorda, fundo: tk.avisoFundo, tinta: tk.aviso },
  expirada: { icone: AlertTriangle, borda: tk.avisoBorda, fundo: tk.avisoFundo, tinta: tk.aviso },
  velha: { icone: ShieldAlert, borda: tk.perigoBorda, fundo: tk.perigoFundo, tinta: tk.perigo },
};

const tamanho = (bytes) => {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} kB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

// ── o botão na barra do leitor ─────────────────────────────────────────────
export function BotaoOffline({ meta, estado, permitido, razao, aGuardar, onGuardar, onApagar }) {
  if (!permitido) {
    return (
      <span className={cn('inline-flex min-h-[2.75rem] items-center gap-1.5 rounded-lg px-2.5 text-xs', tk.tintaFraca)} title={razao}>
        <CloudOff className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="hidden sm:inline">Sem cópia offline</span>
        <span className="sr-only">{razao}</span>
      </span>
    );
  }

  if (!meta) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="min-h-[2.75rem]"
        onClick={onGuardar}
        disabled={aGuardar}
        title="Guarda o ficheiro neste navegador para o poder ler quando a rede falhar"
      >
        {aGuardar
          ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          : <HardDriveDownload className="h-4 w-4" aria-hidden="true" />}
        <span className="hidden md:inline">{aGuardar ? 'A guardar…' : 'Guardar para ler sem rede'}</span>
        <span className="md:hidden">{aGuardar ? 'A guardar…' : 'Sem rede'}</span>
      </Button>
    );
  }

  const cor = CORES[estado?.nivel] || CORES.duvida;
  const Icone = cor.icone;
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1 rounded-lg border px-2 py-1', cor.borda, cor.fundo)}>
      <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', cor.tinta)}>
        <Icone className="h-4 w-4 shrink-0" aria-hidden="true" />
        Guardado {fmtDataHora(meta.guardado_em)}
        {tamanho(meta.bytes) ? ` · ${tamanho(meta.bytes)}` : ''}
      </span>
      {estado?.nivel === 'velha' && (
        <Button variant="ghost" size="sm" className="min-h-[2.75rem]" onClick={onGuardar} disabled={aGuardar}>
          {aGuardar ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
          Actualizar
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        className={cn('min-h-[2.75rem]', tk.perigo)}
        onClick={onApagar}
        aria-label="Apagar a cópia offline deste documento"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        <span className="hidden lg:inline">Apagar cópia</span>
      </Button>
    </span>
  );
}

// ── a tira dentro do leitor ────────────────────────────────────────────────
// Aparece quando a leitura é da cópia guardada, e quando a cópia deixou de valer. Não aparece quando está tudo
// confirmado e a ler da rede: nesse caso o botão da barra já diz o que há a dizer, e um aviso que aparece sempre
// é um aviso que ninguém lê.
export function TiraOffline({ estado, aLerOffline, aGuardar, onGuardar, semRede }) {
  if (!estado) return null;
  if (!aLerOffline && estado.nivel === 'confirmada') return null;

  const cor = CORES[estado.nivel] || CORES.duvida;
  const Icone = cor.icone;
  const grave = estado.nivel === 'velha';

  return (
    <div
      role={grave ? 'alert' : 'status'}
      className={cn('flex flex-wrap items-start gap-x-3 gap-y-2 border-b px-4 py-3', cor.borda, cor.fundo)}
    >
      <Icone className={cn('mt-0.5 h-5 w-5 shrink-0', cor.tinta)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm font-semibold', cor.tinta)}>
          {aLerOffline ? 'Está a ler a cópia guardada neste dispositivo' : estado.titulo}
        </p>
        <p className={cn('mt-0.5 text-sm', tk.tintaMedia)}>
          {aLerOffline && (
            <>Guardada em <strong className={tk.tinta}>{fmtDataHora(estado.guardado_em)}</strong>
              {estado.versao ? <> · versão <strong className={tk.tinta}>{estado.versao}</strong></> : null}. </>
          )}
          {estado.texto}
        </p>
      </div>
      {!semRede && (estado.nivel === 'velha' || aLerOffline) && (
        <Button variant="outline" size="sm" className="min-h-[2.75rem]" onClick={onGuardar} disabled={aGuardar}>
          {aGuardar ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
          Buscar a versão do servidor
        </Button>
      )}
    </div>
  );
}
