import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Select from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabaseClient';
import { Link2, RefreshCw, Copy, Check, XCircle, Loader2, Filter } from 'lucide-react';

const FILTROS = [
  { value: 'activos', label: 'Activos' },
  { value: 'revogados', label: 'Revogados' },
  { value: 'expirados', label: 'Expirados' },
  { value: 'todos', label: 'Todos' },
];

function statusBadge(link) {
  if (link.revogado_em) return { color: 'bg-slate-700 text-white border-slate-700', text: 'Revogado' };
  if (new Date(link.expira_em).getTime() < Date.now()) return { color: 'bg-slate-200 text-slate-700 border-slate-300', text: 'Expirado' };
  if (link.max_downloads !== null && link.downloads_count >= link.max_downloads) return { color: 'bg-slate-300 text-slate-700 border-slate-400', text: 'Limite atingido' };
  return { color: 'bg-green-100 text-green-800 border-green-300', text: 'Activo' };
}

function fmt(dt) { if (!dt) return '—'; try { return new Date(dt).toLocaleString('pt-PT'); } catch { return dt; } }

export default function GerirLinksPartilhaModal({ isOpen, onClose }) {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [filtro, setFiltro] = useState('activos');
  const [busca, setBusca] = useState('');
  const [copiadoId, setCopiadoId] = useState(null);
  const [revogandoId, setRevogandoId] = useState(null);

  const carregar = useCallback(async () => {
    setLoading(true); setErro('');
    try {
      const { data, error } = await supabase
        .from('documento_link_partilha')
        .select('id, token, criado_por, criado_em, expira_em, senha_hash, max_downloads, downloads_count, ultimo_acesso_em, revogado_em, revogado_por, documento:documento_id(id, titulo, categoria, versao)')
        .order('criado_em', { ascending: false })
        .limit(500);
      if (error) throw error;
      setLinks(data || []);
    } catch (e) {
      setErro(e.message || 'Falha a carregar links');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (isOpen) carregar(); }, [isOpen, carregar]);

  const revogar = async (linkId) => {
    if (!confirm('Revogar este link imediatamente? Utilizadores com o URL deixam de conseguir aceder.')) return;
    setRevogandoId(linkId);
    try {
      const { data, error } = await supabase.functions.invoke('share-link-revoke', { body: { link_id: linkId } });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      await carregar();
    } catch (e) {
      alert('Falhou: ' + (e.message || 'erro desconhecido'));
    } finally {
      setRevogandoId(null);
    }
  };

  const copiar = (link) => {
    const origin = window.location.origin;
    const url = `${origin}/s/${link.token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiadoId(link.id);
      setTimeout(() => setCopiadoId(null), 2000);
    });
  };

  const filtrados = links.filter((l) => {
    const st = statusBadge(l).text;
    if (filtro === 'activos' && st !== 'Activo') return false;
    if (filtro === 'revogados' && !l.revogado_em) return false;
    if (filtro === 'expirados' && !(new Date(l.expira_em).getTime() < Date.now()) && !(l.max_downloads !== null && l.downloads_count >= l.max_downloads)) return false;
    if (busca) {
      const q = busca.toLowerCase();
      const inTitulo = l.documento?.titulo?.toLowerCase().includes(q);
      const inCriador = l.criado_por?.toLowerCase().includes(q);
      if (!inTitulo && !inCriador) return false;
    }
    return true;
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-blue-600" />
            Links partilháveis
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 items-center border-b pb-3">
          <div className="flex-1">
            <Input placeholder="Procurar por documento ou criador..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <div className="w-40">
            <Select options={FILTROS} value={filtro} onValueChange={setFiltro} />
          </div>
          <Button variant="outline" size="icon" onClick={carregar} disabled={loading} title="Recarregar">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {erro && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">{erro}</div>
        )}

        <div className="overflow-y-auto flex-1 -mx-6 px-6">
          {loading && links.length === 0 ? (
            <div className="py-12 text-center text-slate-500"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> A carregar...</div>
          ) : filtrados.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <Filter className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>Nenhum link corresponde ao filtro.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtrados.map((link) => {
                const st = statusBadge(link);
                const podeRevogar = !link.revogado_em && new Date(link.expira_em).getTime() > Date.now();
                return (
                  <div key={link.id} className="border rounded-md p-3 hover:bg-slate-50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-slate-900 truncate">{link.documento?.titulo || '(documento removido)'}</p>
                          <Badge variant="outline" className={`${st.color} border text-[10px]`}>{st.text}</Badge>
                          {link.senha_hash && <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">🔒 password</Badge>}
                        </div>
                        <div className="text-xs text-slate-600 space-y-0.5">
                          <p>Criado por <span className="font-mono">{link.criado_por}</span> · {fmt(link.criado_em)}</p>
                          <p>Expira: {fmt(link.expira_em)} · Downloads: {link.downloads_count}{link.max_downloads ? ` / ${link.max_downloads}` : ''}{link.ultimo_acesso_em ? ` · Último acesso ${fmt(link.ultimo_acesso_em)}` : ''}</p>
                          {link.revogado_em && <p className="text-slate-500">Revogado por <span className="font-mono">{link.revogado_por}</span> em {fmt(link.revogado_em)}</p>}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copiar(link)} title="Copiar URL">
                          {copiadoId === link.id ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                        </Button>
                        {podeRevogar && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50" onClick={() => revogar(link.id)} disabled={revogandoId === link.id} title="Revogar">
                            {revogandoId === link.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="text-xs text-slate-500 pt-2 border-t">
          {filtrados.length} link{filtrados.length !== 1 ? 's' : ''} · atualizado {new Date().toLocaleTimeString('pt-PT')}
        </div>
      </DialogContent>
    </Dialog>
  );
}
