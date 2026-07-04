import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Megaphone, Loader2, Send, AlertTriangle, CheckCircle2, XCircle, Ban } from 'lucide-react';
import { sendNotificationEmail } from '@/functions/sendNotificationEmail';

// O relay SMTP da SGA só entrega para @sga.co.ao; externos são pulados.
const isExternal = (email) => {
  const at = (email || '').lastIndexOf('@');
  if (at === -1) return true;
  const d = email.slice(at + 1).toLowerCase();
  return !(d === 'sga.co.ao' || d.endsWith('.sga.co.ao'));
};
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// Escapa HTML e aplica formatação leve: **texto** ou *texto* -> negrito; \n -> <br>.
const fmtBody = (s) => {
  let out = esc(s);
  out = out.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>');
  return out.replace(/\n/g, '<br>');
};
// HTML com cabeçalho DIROPS + quebras de linha preservadas (começa com <!DOCTYPE
// para o backend enviar como está, sem re-escapar).
const buildHtml = (msg) =>
  '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>' +
  '<body style="margin:0;background:#f1f5f9;font-family:Segoe UI,Arial,sans-serif;">' +
  '<div style="max-width:600px;margin:0 auto;padding:20px;">' +
  '<div style="background:linear-gradient(135deg,#1e3a5f,#1a3050);border-radius:12px 12px 0 0;padding:28px 40px;text-align:center;">' +
  '<h1 style="margin:0;color:#fff;font-size:22px;letter-spacing:1px;">DIROPS</h1>' +
  '<p style="margin:4px 0 0;color:#93c5fd;font-size:12px;">Sistema de Gestão Aeroportuária</p></div>' +
  '<div style="background:#fff;padding:28px 40px;border:1px solid #e2e8f0;color:#334155;font-size:14px;line-height:1.6;">' +
  fmtBody(msg) + '</div>' +
  '<div style="background:#f8fafc;border-radius:0 0 12px 12px;padding:16px 40px;border:1px solid #e2e8f0;border-top:none;text-align:center;">' +
  '<p style="margin:0;color:#94a3b8;font-size:11px;">Este email foi enviado automaticamente pelo Sistema DIROPS.</p></div></div></body></html>';

// Envio INDIVIDUAL (um To: por pessoa) — o relay SGA marca BCC/massa como spam
// (550 Content Filtering). Emails individuais passam. O pooling SMTP no backend
// acelera. Lote pequeno: o backend envia 'lote' emails por chamada (loop), com
// teto de tempo do lado do cliente (functions timeout 180s).
const BATCH_SIZE = 5;
const chunk = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };

export default function ComunicadoMassaModal({ isOpen, onClose, users = [] }) {
  const [assunto, setAssunto] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [step, setStep] = useState('form'); // form | confirm | sending | done
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [report, setReport] = useState({ sent: [], failed: [], blocked: [] });
  const [erro, setErro] = useState(null);

  const { internos, externos } = useMemo(() => {
    const ativos = (users || []).filter((u) => u.status === 'ativo' && u.email);
    const emails = [...new Set(ativos.map((u) => u.email.trim().toLowerCase()))];
    return { internos: emails.filter((e) => !isExternal(e)), externos: emails.filter(isExternal) };
  }, [users]);

  const reset = () => {
    setAssunto(''); setMensagem(''); setStep('form');
    setProgress({ done: 0, total: 0 }); setReport({ sent: [], failed: [], blocked: [] }); setErro(null);
  };
  const handleClose = () => { if (step === 'sending') return; reset(); onClose(); };

  const validar = () => {
    if (!assunto.trim()) { setErro('Informe o assunto.'); return false; }
    if (!mensagem.trim()) { setErro('Escreva a mensagem.'); return false; }
    if (internos.length === 0) { setErro('Nenhum destinatário @sga.co.ao ativo encontrado.'); return false; }
    setErro(null); return true;
  };

  const handleEnviar = async () => {
    setStep('sending');
    const html = buildHtml(mensagem);
    const lotes = chunk(internos, BATCH_SIZE);
    setProgress({ done: 0, total: internos.length });
    const acc = { sent: [], failed: [], blocked: [...externos] };
    let done = 0;
    for (const lote of lotes) {
      try {
        // Individual: o backend (send-notification-email) faz um envio To: por
        // destinatário — passa no filtro anti-spam do relay (BCC/massa é bloqueado).
        const r = await sendNotificationEmail({ to: lote, subject: assunto, body: html });
        if (Array.isArray(r?.sent)) acc.sent.push(...r.sent);
        if (Array.isArray(r?.failed)) acc.failed.push(...r.failed);
        if (Array.isArray(r?.blocked)) acc.blocked.push(...r.blocked);
        if (!Array.isArray(r?.sent) && !Array.isArray(r?.failed)) acc.sent.push(...lote);
      } catch (e) {
        lote.forEach((to) => acc.failed.push({ to, error: e?.message || String(e) }));
      }
      done += lote.length;
      setProgress({ done, total: internos.length });
      setReport({ ...acc });
    }
    setReport({ ...acc });
    setStep('done');
  };

  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-blue-600" /> Comunicado em massa
          </DialogTitle>
        </DialogHeader>

        {step === 'form' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              Será enviado para <strong>{internos.length}</strong> utilizador(es) ativo(s) <strong>@sga.co.ao</strong>.
              {externos.length > 0 && (
                <> {externos.length} externo(s) serão <strong>ignorados</strong> (o relay SGA não entrega para fora).</>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="assunto">Assunto *</Label>
              <Input id="assunto" value={assunto} onChange={(e) => setAssunto(e.target.value)} placeholder="Ex.: Acesso ao novo Sistema DIROPS" maxLength={150} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mensagem">Mensagem * <span className="text-xs font-normal text-slate-400">— use *texto* para <strong>negrito</strong></span></Label>
              <Textarea id="mensagem" value={mensagem} onChange={(e) => setMensagem(e.target.value)} rows={8} placeholder={'Escreva o comunicado...\n\nDica: *texto* fica em negrito. Quebras de linha são preservadas.'} />
            </div>
            {erro && <p className="text-sm text-red-600 flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> {erro}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button type="button" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => { if (validar()) setStep('confirm'); }}>Rever e enviar</Button>
            </DialogFooter>
          </div>
        )}

        {step === 'confirm' && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900 flex gap-2">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-600" />
              <div>Confirmar envio de <strong>"{assunto}"</strong> para <strong>{internos.length}</strong> destinatário(s) @sga.co.ao?
                {externos.length > 0 && <div className="mt-1 text-amber-700">{externos.length} externo(s) não receberão.</div>}
              </div>
            </div>
            <div className="border rounded-lg p-3 bg-slate-50 text-sm text-slate-700 max-h-40 overflow-y-auto whitespace-pre-wrap">{mensagem}</div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setStep('form')}>Voltar</Button>
              <Button type="button" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleEnviar}>
                <Send className="w-4 h-4 mr-2" /> Enviar agora
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'sending' && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 text-slate-700"><Loader2 className="w-5 h-5 animate-spin text-blue-600" /> Enviando... {progress.done}/{progress.total}</div>
            <div className="w-full bg-slate-200 rounded-full h-2.5"><div className="bg-blue-600 h-2.5 rounded-full transition-all" style={{ width: pct + '%' }} /></div>
            <p className="text-xs text-slate-500">Não feche esta janela até concluir.</p>
          </div>
        )}

        {step === 'done' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-green-700 font-medium"><CheckCircle2 className="w-5 h-5" /> Concluído</div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3"><div className="text-2xl font-bold text-green-700">{report.sent.length}</div><div className="text-xs text-green-600">Enviados</div></div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3"><div className="text-2xl font-bold text-slate-600">{report.blocked.length}</div><div className="text-xs text-slate-500">Externos (ignorados)</div></div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3"><div className="text-2xl font-bold text-red-700">{report.failed.length}</div><div className="text-xs text-red-600">Falhas</div></div>
            </div>
            {report.failed.length > 0 && (
              <div className="border rounded-lg p-3 bg-red-50 text-xs text-red-800 max-h-32 overflow-y-auto">
                <div className="font-medium flex items-center gap-1 mb-1"><XCircle className="w-4 h-4" /> Falhas:</div>
                {report.failed.map((f, i) => <div key={i}>{f.to} — {f.error}</div>)}
              </div>
            )}
            {report.blocked.length > 0 && (
              <div className="border rounded-lg p-3 bg-slate-50 text-xs text-slate-600 max-h-24 overflow-y-auto">
                <div className="font-medium flex items-center gap-1 mb-1"><Ban className="w-4 h-4" /> Não enviados (externos):</div>
                {report.blocked.join(', ')}
              </div>
            )}
            <DialogFooter>
              <Button type="button" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleClose}>Fechar</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
