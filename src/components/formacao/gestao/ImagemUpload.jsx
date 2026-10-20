import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Upload, X, Loader2, ImageIcon } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { UploadFile } from '@/api/integrations';

// Envia um ficheiro para o storage público e devolve a URL relativa (/storage/v1/object/public/uploads/...).
export async function uploadFicheiro(file) {
  const r = await UploadFile({ file });
  if (!r?.file_url) throw new Error('O servidor não devolveu a URL do ficheiro.');
  return r.file_url;
}

// Campo de imagem com pré-visualização (logo, arte de fundo, assinatura, capa).
export default function ImagemUpload({ label, value, onChange, ajuda, accept = 'image/png,image/jpeg,image/webp', altura = 'h-24', fundoEscuro = false }) {
  const { toast } = useToast();
  const inputRef = useRef(null);
  const [aEnviar, setAEnviar] = useState(false);

  const escolher = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAEnviar(true);
    try {
      onChange(await uploadFicheiro(file));
    } catch (err) {
      toast({ title: 'Falha no carregamento', description: err?.message || String(err), variant: 'destructive' });
    } finally {
      setAEnviar(false);
    }
  };

  return (
    <div className="space-y-1.5">
      {label && <Label>{label}</Label>}
      <div className="flex items-start gap-3">
        <div className={`flex ${altura} w-36 shrink-0 items-center justify-center overflow-hidden rounded-md border ${fundoEscuro ? 'bg-slate-800' : 'bg-slate-50 dark:bg-slate-800'} dark:border-slate-700`}>
          {value
            ? <img src={value} alt="" className="max-h-full max-w-full object-contain" />
            : <ImageIcon className="h-6 w-6 text-slate-400" aria-hidden="true" />}
        </div>
        <div className="flex flex-col gap-2">
          <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={escolher} aria-label={label ? `Carregar ${label}` : 'Carregar imagem'} />
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={aEnviar}>
            {aEnviar ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
            {value ? 'Substituir' : 'Carregar'}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)} className="text-slate-500">
              <X className="h-4 w-4" aria-hidden="true" />Remover
            </Button>
          )}
          {ajuda && <p className="text-xs text-slate-500 dark:text-slate-400">{ajuda}</p>}
        </div>
      </div>
    </div>
  );
}
