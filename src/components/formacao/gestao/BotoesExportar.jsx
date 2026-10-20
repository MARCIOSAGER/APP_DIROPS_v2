import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

// Par de botões Excel / PDF com estado de ocupado e erro em toast. onExcel/onPdf são async.
export default function BotoesExportar({ onExcel, onPdf, disabled = false, size = 'sm', variant = 'outline', rotuloExcel = 'Excel', rotuloPdf = 'PDF' }) {
  const { toast } = useToast();
  const [ocupado, setOcupado] = useState(null);
  const correr = async (tipo, fn) => {
    if (!fn) return;
    setOcupado(tipo);
    try { await fn(); }
    catch (e) { toast({ title: `Não foi possível exportar (${tipo === 'xlsx' ? 'Excel' : 'PDF'})`, description: e?.message || String(e), variant: 'destructive' }); }
    finally { setOcupado(null); }
  };
  return (
    <>
      {onExcel && <Button type="button" variant={variant} size={size} disabled={disabled || !!ocupado} onClick={() => correr('xlsx', onExcel)} aria-label={`Exportar ${rotuloExcel}`}>{ocupado === 'xlsx' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />}{rotuloExcel}</Button>}
      {onPdf && <Button type="button" variant={variant} size={size} disabled={disabled || !!ocupado} onClick={() => correr('pdf', onPdf)} aria-label={`Exportar ${rotuloPdf}`}>{ocupado === 'pdf' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileText className="h-4 w-4" aria-hidden="true" />}{rotuloPdf}</Button>}
    </>
  );
}
