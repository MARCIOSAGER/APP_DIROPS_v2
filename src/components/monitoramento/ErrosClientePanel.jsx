import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabaseClient';
import { AlertTriangle, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';

// "Vista do que rebentou": lista os erros do cliente registados no servidor
// (logs/client-errors.jsonl), via /functions/errors-recent (autenticado).
// Cada linha expande para mostrar o stack. Substitui o depender de queixas.
export default function ErrosClientePanel() {
  const [itens, setItens] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [aberto, setAberto] = useState(null); // índice da linha com stack expandido

  const carregar = useCallback(async () => {
    setLoading(true); setErro(null);
    try {
      const { data, error } = await supabase.functions.invoke('errors-recent', { method: 'GET' });
      if (error) throw error;
      setItens(Array.isArray(data?.itens) ? data.itens : []);
      setTotal(Number(data?.total) || 0);
    } catch (e) {
      setErro(e?.message || 'Não foi possível carregar os erros.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const fmtTs = (ts) => { try { const d = new Date(ts); return isNaN(d.getTime()) ? String(ts) : d.toLocaleString('pt-AO'); } catch { return String(ts); } };
  const kindColor = (k) => k === 'react-boundary'
    ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
    : k === 'unhandledrejection'
      ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';

  return (
    <Card className="border-slate-200 dark:border-slate-700">
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          Erros do Cliente
          {total > 0 && <span className="text-slate-400 font-normal">({total} no total)</span>}
        </CardTitle>
        <Button variant="outline" size="sm" onClick={carregar} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </Button>
      </CardHeader>
      <CardContent>
        {erro && <p className="text-sm text-red-600 py-3">{erro}</p>}
        {!erro && loading && (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {!erro && !loading && itens.length === 0 && (
          <p className="text-sm text-slate-400 py-6 text-center">Nenhum erro registado. 🎉</p>
        )}
        {!loading && itens.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-200 dark:border-slate-700">
                  <th className="py-2 pr-3 font-medium">Quando</th>
                  <th className="py-2 pr-3 font-medium">Utilizador</th>
                  <th className="py-2 pr-3 font-medium">Página</th>
                  <th className="py-2 pr-3 font-medium">Tipo</th>
                  <th className="py-2 pr-3 font-medium">Mensagem</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((it, i) => (
                  <React.Fragment key={i}>
                    <tr
                      className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/40 cursor-pointer"
                      onClick={() => setAberto(aberto === i ? null : i)}
                    >
                      <td className="py-2 pr-3 whitespace-nowrap text-slate-600 dark:text-slate-300">{fmtTs(it.ts)}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{it.user || '—'}</td>
                      <td className="py-2 pr-3 whitespace-nowrap text-slate-500">{it.page || '—'}</td>
                      <td className="py-2 pr-3"><Badge className={kindColor(it.kind)}>{it.kind}</Badge></td>
                      <td className="py-2 pr-3 max-w-[420px]">
                        <span className="flex items-start gap-1">
                          {it.stack ? (aberto === i
                            ? <ChevronDown className="w-3 h-3 mt-1 shrink-0" />
                            : <ChevronRight className="w-3 h-3 mt-1 shrink-0" />) : <span className="w-3 shrink-0" />}
                          <span className="truncate">{it.message}</span>
                        </span>
                      </td>
                    </tr>
                    {aberto === i && it.stack && (
                      <tr className="bg-slate-50 dark:bg-slate-900/40">
                        <td colSpan={5} className="py-2 px-3">
                          <pre className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap break-all max-h-60 overflow-auto">{it.stack}</pre>
                          {it.ua && <p className="text-[11px] text-slate-400 mt-1">UA: {it.ua}</p>}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
