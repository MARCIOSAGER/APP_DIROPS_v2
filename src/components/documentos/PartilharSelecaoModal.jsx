import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/lib/supabaseClient';
import { isExternalEmail } from '@/lib/emailDomain';
import { copyToClipboard } from '@/lib/utils';
import { Copy, Check, Loader2, Mail, ExternalLink, Library, Search, AlertCircle, Plane } from 'lucide-react';

const OPCOES_VALIDADE = [
  { label: '24 horas', dias: 1 },
  { label: '7 dias', dias: 7, recomendado: true },
  { label: '30 dias', dias: 30 },
];

const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Partilha por SELECAO: escolher varios aeroportos e/ou pastas num unico link (/v/<token>).
export default function PartilharSelecaoModal({ isOpen, onClose, aeroportos = [], pastas = [] }) {
  const [aeroSel, setAeroSel] = useState(new Set());
  const [pastaSel, setPastaSel] = useState(new Set());
  const [buscaPasta, setBuscaPasta] = useState('');
  const [dias, setDias] = useState(7);
  const [password, setPassword] = useState('');
  const [maxDownloads, setMaxDownloads] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [linkCriado, setLinkCriado] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const [destino, setDestino] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [envioMsg, setEnvioMsg] = useState(null);

  // Apenas aeroportos da SGA (mesmo criterio do resto do sistema: isSGA === true).
  const aeroportosSGA = useMemo(() => aeroportos.filter((a) => a.isSGA === true), [aeroportos]);
  const sgaIds = useMemo(() => new Set(aeroportosSGA.map((a) => a.id)), [aeroportosSGA]);

  const aeroNome = (id) => {
    const a = aeroportos.find((x) => x.id === id);
    return a ? `${a.nome}${a.codigo_icao ? ` (${a.codigo_icao})` : ''}` : '—';
  };

  // Pastas: se ha aeroportos selecionados, mostra as pastas DESSES aeroportos;
  // senao, todas as de aeroportos SGA (ou sem aeroporto = documentacao geral).
  const pastasFiltradas = useMemo(() => {
    const q = buscaPasta.trim().toLowerCase();
    const base = aeroSel.size > 0
      ? pastas.filter((p) => p.aeroporto_id && aeroSel.has(p.aeroporto_id))
      : pastas.filter((p) => !p.aeroporto_id || sgaIds.has(p.aeroporto_id));
    return base
      .filter((p) => !q || (p.nome || '').toLowerCase().includes(q) || aeroNome(p.aeroporto_id).toLowerCase().includes(q))
      .slice(0, 300);
  }, [pastas, buscaPasta, sgaIds, aeroSel]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ids de TODAS as pastas que batem o filtro actual (sem o corte de 300), para o "selecionar todos".
  const pastasFiltradasIds = useMemo(() => {
    const q = buscaPasta.trim().toLowerCase();
    const base = aeroSel.size > 0
      ? pastas.filter((p) => p.aeroporto_id && aeroSel.has(p.aeroporto_id))
      : pastas.filter((p) => !p.aeroporto_id || sgaIds.has(p.aeroporto_id));
    return base
      .filter((p) => !q || (p.nome || '').toLowerCase().includes(q) || aeroNome(p.aeroporto_id).toLowerCase().includes(q))
      .map((p) => p.id);
  }, [pastas, buscaPasta, sgaIds, aeroSel]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = aeroSel.size + pastaSel.size;

  const allAeroSel = aeroportosSGA.length > 0 && aeroportosSGA.every((a) => aeroSel.has(a.id));
  const toggleAllAero = () => setAeroSel(allAeroSel ? new Set() : new Set(aeroportosSGA.map((a) => a.id)));

  const allPastasSel = pastasFiltradasIds.length > 0 && pastasFiltradasIds.every((id) => pastaSel.has(id));
  const toggleAllPastas = () => {
    const n = new Set(pastaSel);
    if (allPastasSel) pastasFiltradasIds.forEach((id) => n.delete(id));
    else pastasFiltradasIds.forEach((id) => n.add(id));
    setPastaSel(n);
  };

  const toggle = (set, setter, id) => {
    const n = new Set(set);
    if (n.has(id)) n.delete(id); else n.add(id);
    setter(n);
  };

  const resetForm = () => {
    setAeroSel(new Set()); setPastaSel(new Set()); setBuscaPasta('');
    setDias(7); setPassword(''); setMaxDownloads('');
    setLinkCriado(null); setCopiado(false); setErro('');
    setDestino(''); setEnviando(false); setEnvioMsg(null);
  };

  const handleClose = () => { resetForm(); onClose(); };

  const criarLink = async () => {
    setLoading(true); setErro('');
    try {
      const body = {
        aeroportos_ids: Array.from(aeroSel),
        pastas_ids: Array.from(pastaSel),
        dias_validade: dias,
        password: password || null,
        max_downloads: maxDownloads ? parseInt(maxDownloads, 10) : null,
      };
      const { data, error } = await supabase.functions.invoke('share-selection-create', { body });
      if (error) throw new Error(error.message || 'Falha ao criar link');
      if (data?.error) throw new Error(data.error);
      setLinkCriado(data);
    } catch (e) {
      setErro(e.message || 'Erro desconhecido ao criar link');
    } finally {
      setLoading(false);
    }
  };

  const copiar = async () => {
    if (!linkCriado?.url) return;
    const ok = await copyToClipboard(linkCriado.url);
    if (ok) { setCopiado(true); setTimeout(() => setCopiado(false), 2000); }
    else setEnvioMsg({ tipo: 'erro', texto: 'Não foi possível copiar. Seleccione o link e copie manualmente.' });
  };

  const enviarEmail = async () => {
    if (!linkCriado?.url || !destino.trim()) return;
    const to = destino.trim();
    if (isExternalEmail(to)) {
      setEnvioMsg({ tipo: 'erro', texto: 'Endereço externo. O relay da SGA só entrega a @sga.co.ao. Copie o link e envie pelo seu próprio email.' });
      return;
    }
    const expira = new Date(linkCriado.expira_em).toLocaleString('pt-PT');
    const html =
      `<p>Olá,</p><p>Está disponível uma seleção de documentos operacionais através do link abaixo:</p>`
      + `<p><a href="${linkCriado.url}">${esc(linkCriado.url)}</a></p>`
      + `<p style="margin:2px 0;color:#475569;font-size:13px">Este link expira em ${esc(expira)}.</p>`
      + (linkCriado.tem_password ? `<p style="margin:2px 0;color:#475569;font-size:13px">🔒 Protegido por password (partilhada em separado).</p>` : '')
      + `<p style="margin-top:16px;color:#94a3b8;font-size:12px">Sistema DIROPS-SGA</p>`;
    const text = `Olá,\n\nSeleção de documentos operacionais:\n\n${linkCriado.url}\n\nExpira em ${expira}.\n\nSistema DIROPS-SGA`;
    setEnviando(true); setEnvioMsg(null);
    try {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: { to, subject: 'Documentos partilhados — DIROPS-SGA', html, text },
      });
      if (error) throw new Error(error.message || 'Falha no envio');
      if (data?.error) throw new Error(data.error);
      setEnvioMsg({ tipo: 'ok', texto: `Enviado a ${to}.` });
      setDestino('');
    } catch (e) {
      setEnvioMsg({ tipo: 'erro', texto: e.message || 'Falha no envio' });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Library className="w-5 h-5 text-indigo-600" />
            Partilhar seleção (aeroportos e pastas)
          </DialogTitle>
        </DialogHeader>

        {!linkCriado ? (
          <div className="space-y-4 overflow-y-auto pr-1">
            <p className="text-sm text-slate-600">
              Escolha um ou mais aeroportos e/ou pastas. É gerado um único link para um portal navegável.
              Documentos confidenciais aparecem mas pedem a senha do próprio documento; secretos ficam bloqueados.
            </p>

            <div>
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Aeroportos SGA</Label>
                {aeroportosSGA.length > 0 && (
                  <button type="button" onClick={toggleAllAero} className="text-xs text-indigo-600 hover:underline">
                    {allAeroSel ? 'Limpar' : `Selecionar todos (${aeroportosSGA.length})`}
                  </button>
                )}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1 max-h-40 overflow-y-auto border rounded-md p-2">
                {aeroportosSGA.length === 0 && <p className="text-xs text-slate-400 col-span-2 p-2">Nenhum aeroporto SGA disponível.</p>}
                {aeroportosSGA.map((a) => (
                  <label key={a.id} className="flex items-center gap-2 text-sm p-1 rounded hover:bg-slate-50 cursor-pointer">
                    <Checkbox checked={aeroSel.has(a.id)} onCheckedChange={() => toggle(aeroSel, setAeroSel, a.id)} />
                    <Plane className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate">{a.nome}{a.codigo_icao ? ` (${a.codigo_icao})` : ''}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2">
                <Label className="text-sm font-medium whitespace-nowrap">
                  {aeroSel.size > 0 ? 'Pastas dos aeroportos escolhidos' : 'Pastas específicas (opcional)'}
                </Label>
                <div className="flex items-center gap-2">
                  {pastasFiltradasIds.length > 0 && (
                    <button type="button" onClick={toggleAllPastas} className="text-xs text-indigo-600 hover:underline whitespace-nowrap">
                      {allPastasSel ? 'Limpar' : `Todas (${pastasFiltradasIds.length})`}
                    </button>
                  )}
                  <div className="relative w-40">
                    <Search className="w-3.5 h-3.5 absolute left-2 top-2.5 text-slate-400" />
                    <Input value={buscaPasta} onChange={(e) => setBuscaPasta(e.target.value)} placeholder="Procurar" className="pl-7 h-8 text-xs" />
                  </div>
                </div>
              </div>
              {aeroSel.size > 0 && (
                <p className="text-[11px] text-slate-400 mt-1">
                  Ao escolher um aeroporto, todas as suas pastas já vão no link. Marque abaixo só se quiser limitar a algumas.
                </p>
              )}
              <div className="mt-2 max-h-40 overflow-y-auto border rounded-md p-2 space-y-0.5">
                {pastasFiltradas.length === 0 && <p className="text-xs text-slate-400 p-2">Nenhuma pasta neste(s) aeroporto(s).</p>}
                {pastasFiltradas.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm p-1 rounded hover:bg-slate-50 cursor-pointer">
                    <Checkbox checked={pastaSel.has(p.id)} onCheckedChange={() => toggle(pastaSel, setPastaSel, p.id)} />
                    <span className="truncate">📁 {p.nome}</span>
                    {p.aeroporto_id && <span className="text-[11px] text-slate-400 ml-auto truncate">{aeroNome(p.aeroporto_id)}</span>}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Validade</Label>
                <div className="flex gap-1 mt-1">
                  {OPCOES_VALIDADE.map((o) => (
                    <button key={o.dias} type="button" onClick={() => setDias(o.dias)}
                      className={`flex-1 text-xs py-1.5 rounded border ${dias === o.dias ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-300 text-slate-600'}`}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-sm">Máx. downloads (opcional)</Label>
                <Input type="number" min="1" value={maxDownloads} onChange={(e) => setMaxDownloads(e.target.value)} placeholder="ilimitado" className="mt-1 h-9" />
              </div>
            </div>

            <div>
              <Label className="text-sm">Password (recomendado para externos)</Label>
              <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="deixe vazio para sem password" className="mt-1 h-9" />
            </div>

            {erro && <p className="text-sm text-red-600 flex items-center gap-1"><AlertCircle className="w-4 h-4" /> {erro}</p>}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm font-medium text-green-900 flex items-center gap-2">
                <Check className="w-4 h-4" /> Link criado ({linkCriado.n_aeroportos} aeroporto(s), {linkCriado.n_pastas} pasta(s))
              </p>
            </div>
            <div className="space-y-2">
              <Label>Link partilhável</Label>
              <div className="flex gap-2">
                <Input value={linkCriado.url} readOnly className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={copiar} title="Copiar">
                  {copiado ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <div className="text-xs text-slate-600 space-y-1">
              <p>Expira: <span className="font-medium">{new Date(linkCriado.expira_em).toLocaleString('pt-PT')}</span></p>
              <p>{linkCriado.tem_password ? '🔒 Protegido por password' : '🔓 Sem password'}</p>
              <p>{linkCriado.max_downloads ? `📊 Máx ${linkCriado.max_downloads} downloads` : '♾️ Downloads ilimitados'}</p>
            </div>
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <Label className="text-xs text-slate-600">Enviar por email (destinatário @sga.co.ao)</Label>
              <div className="flex gap-2">
                <Input type="email" value={destino}
                  onChange={(e) => { setDestino(e.target.value); setEnvioMsg(null); }}
                  placeholder="nome@sga.co.ao" className="text-sm"
                  onKeyDown={(e) => { if (e.key === 'Enter' && destino.trim() && !enviando) enviarEmail(); }} />
                <Button variant="outline" onClick={enviarEmail} disabled={!destino.trim() || enviando}>
                  {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                  <span className="ml-2">Enviar</span>
                </Button>
                <Button variant="outline" size="icon" onClick={() => window.open(linkCriado.url, '_blank')} title="Abrir">
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
              {envioMsg && (
                <p className={`text-xs flex items-center gap-1 ${envioMsg.tipo === 'ok' ? 'text-green-700' : 'text-red-600'}`}>
                  {envioMsg.tipo === 'ok' ? <Check className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                  {envioMsg.texto}
                </p>
              )}
              <p className="text-[11px] text-slate-400">
                Para auditores/ANAC (externos), copie o link e envie pelo seu próprio email — o relay da SGA só entrega a @sga.co.ao.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          {!linkCriado ? (
            <>
              <Button variant="outline" onClick={handleClose} disabled={loading}>Cancelar</Button>
              <Button onClick={criarLink} disabled={total === 0 || loading}>
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> A criar...</> : `Criar link (${total} selecionado${total === 1 ? '' : 's'})`}
              </Button>
            </>
          ) : (
            <Button onClick={handleClose}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
