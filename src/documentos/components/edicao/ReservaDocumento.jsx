// Reserva para edição (check-out) e «Carregar nova versão (rascunho)» na ficha do documento.
// Quem vai preparar a revisão seguinte reserva o documento; os outros vêem «Em edição por X desde …» e não
// conseguem carregar uma revisão nova até a reserva ser libertada (a base recusa-o também — migração 181).
// A revisão nova entra SEMPRE em rascunho: o documento em vigor não muda até o fluxo de aprovação terminar.
import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, FilePlus2, Loader2, LockOpen, PenLine, ShieldAlert, Stamp, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle,
  AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { fmtData, fmtDataHora } from '@/lib/safeDate';
import { tk } from '../../pages/PortalBiblioteca';
import {
  useReservaDocumento, useRecarregarReserva, reservarDocumento, libertarDocumento, criarVersaoRascunho,
  accoesReserva, bloqueioCarregamento, quemReservou, DIAS_RESERVA, LIMITE_MB_RASCUNHO,
} from '../../hooksEdicao';

// Quem pode editar ESTE documento — o mesmo critério de pode_editar_documento() (a base decide na mesma).
export function podeEditarDocumento(doc, user, { gestor = false, editor = false } = {}) {
  if (gestor) return true;
  if (!editor || !user?.email || !doc) return false;
  const eu = String(user.email).toLowerCase();
  return [doc.created_by, doc.responsavel_email].some(e => String(e || '').toLowerCase() === eu);
}

function Erro({ children }) {
  if (!children) return null;
  return (
    <p role="alert" className={cn('flex items-start gap-2 text-sm', tk.perigo)}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{children}
    </p>
  );
}

// ── diálogo «Carregar nova versão (rascunho)» ──────────────────────────────
function DialogRascunho({ doc, onFechar, onFeito }) {
  const [pdf, setPdf] = useState(null);
  const [fonte, setFonte] = useState(null);
  const [rotulo, setRotulo] = useState('');
  const [nota, setNota] = useState('');
  const [fase, setFase] = useState('');
  const [erro, setErro] = useState('');

  const enviar = async (e) => {
    e?.preventDefault?.();
    if (fase) return;
    if (!pdf && !fonte) { setErro('Escolha o PDF da revisão (e, se tiver, o ficheiro-fonte editável).'); return; }
    setErro(''); setFase('verificar');
    try {
      const linhas = await criarVersaoRascunho({
        documentoId: doc.id,
        ficheiros: [
          pdf && { blob: pdf, nome: pdf.name, mime: pdf.type, papel: 'pdf' },
          fonte && { blob: fonte, nome: fonte.name, mime: fonte.type, papel: 'fonte' },
        ].filter(Boolean),
        rotulo, nota,
        onProgresso: setFase,
      });
      onFeito(linhas[0] || null);
    } catch (err) {
      setErro(err?.message || 'Não foi possível carregar a revisão.');
    } finally { setFase(''); }
  };

  const textoFase = fase === 'verificar' ? 'A verificar…'
    : fase.startsWith('enviar:') ? `A enviar ${fase.slice(7)}…`
      : fase === 'registar' ? 'A registar a revisão…' : '';

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !fase) onFechar(); }}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FilePlus2 className="h-5 w-5 text-teal-600" aria-hidden="true" />Carregar nova versão (rascunho)</DialogTitle>
          <DialogDescription className="break-words">
            {doc.numero ? `${doc.numero} · ` : ''}{doc.titulo}. A revisão entra em rascunho: quem consulta continua a ver
            a versão em vigor até a nova ser aprovada pelo fluxo de aprovação.
          </DialogDescription>
        </DialogHeader>
        <form id="gd-form-rascunho" onSubmit={enviar} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="gd-rasc-pdf">PDF da revisão</Label>
            <Input id="gd-rasc-pdf" type="file" accept=".pdf,application/pdf" onChange={e => setPdf(e.target.files?.[0] || null)} disabled={!!fase} />
            <p className={cn('text-sm', tk.tintaFraca)}>É o PDF que se aprova, se carimba e se distribui.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gd-rasc-fonte">Ficheiro-fonte editável (opcional)</Label>
            <Input id="gd-rasc-fonte" type="file" accept=".docx,.doc,.xlsx,.xls,.pptx,.ppt" onChange={e => setFonte(e.target.files?.[0] || null)} disabled={!!fase} />
            <p className={cn('text-sm', tk.tintaFraca)}>O .docx de onde saiu o PDF. Fica guardado ao lado da revisão, como «Fonte editável».</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gd-rasc-rotulo">Rótulo da revisão</Label>
            <Input id="gd-rasc-rotulo" value={rotulo} onChange={e => setRotulo(e.target.value)} maxLength={60} autoComplete="off" placeholder="ex. Revisão 04/26" disabled={!!fase} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gd-rasc-nota">O que mudou</Label>
            <Textarea id="gd-rasc-nota" value={nota} onChange={e => setNota(e.target.value)} rows={3} maxLength={1000} disabled={!!fase} />
          </div>
          <p className={cn('text-sm', tk.tintaFraca)}>Ficheiros até {LIMITE_MB_RASCUNHO} MB, guardados no armazenamento privado.</p>
          <Erro>{erro}</Erro>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onFechar} disabled={!!fase}>Cancelar</Button>
          <Button type="submit" form="gd-form-rascunho" disabled={!!fase || (!pdf && !fonte)}>
            {fase ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
            {textoFase || 'Carregar em rascunho'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── bloco principal ────────────────────────────────────────────────────────
// Props: doc, user, gestor, editor (níveis do portal), onPedirAprovacao (abre o fluxo na ficha).
export default function ReservaDocumento({ doc, user, gestor = false, editor = false, onPedirAprovacao }) {
  const reservaQ = useReservaDocumento(doc?.id);
  const recarregar = useRecarregarReserva();
  const reserva = reservaQ.data || null;
  const email = user?.email || '';
  const podeEditar = podeEditarDocumento(doc, user, { gestor, editor });
  const a = accoesReserva({ reserva, email, podeEditar, gestor });
  const bloqueio = bloqueioCarregamento(reserva, email, { fmt: (d) => fmtData(d) });

  const [aOcupar, setAOcupar] = useState('');
  const [erro, setErro] = useState('');
  const [forcarAberto, setForcarAberto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [rascunhoAberto, setRascunhoAberto] = useState(false);
  const [criada, setCriada] = useState(null);

  if (!doc?.id) return null;
  // quem só consulta só vê o aviso (e só se houver reserva activa)
  if (!podeEditar && a.estado !== 'activa') return null;

  const correr = async (chave, fn) => {
    setAOcupar(chave); setErro('');
    try { await fn(); recarregar(doc.id); } catch (e) { setErro(e?.message || 'Não foi possível concluir.'); } finally { setAOcupar(''); }
  };
  const reservar = () => correr('reservar', () => reservarDocumento(doc.id));
  const libertar = () => correr('libertar', () => libertarDocumento(doc.id));
  const forcar = () => correr('forcar', async () => {
    await libertarDocumento(doc.id, { forcar: true, motivo: motivo.trim() || null });
    setForcarAberto(false); setMotivo('');
  });

  const spin = (k, Icone) => (aOcupar === k ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Icone className="h-4 w-4" aria-hidden="true" />);

  return (
    <section aria-label="Edição do documento" className="space-y-2">
      {a.estado === 'activa' && (
        <div role="status" className={cn('flex flex-wrap items-start gap-3 rounded-xl border p-3', tk.avisoBorda, tk.avisoFundo)}>
          <PenLine className={cn('mt-0.5 h-4 w-4 shrink-0', tk.aviso)} aria-hidden="true" />
          <div className="min-w-0 flex-1 text-sm">
            <p className={cn('font-semibold', tk.tinta)}>
              {a.minha ? 'Reservado para edição por si' : `Em edição por ${quemReservou(reserva)}`} desde {fmtData(reserva.reservado_em)}
            </p>
            <p className={tk.tintaMedia}>
              {a.minha
                ? `Ninguém mais carrega revisões deste documento até libertar a reserva (expira em ${fmtDataHora(reserva.expira_em)}).`
                : `Até ${fmtDataHora(reserva.expira_em)}, só essa pessoa carrega revisões novas deste documento.`}
              {reserva.nota ? ` Nota: ${reserva.nota}` : ''}
            </p>
          </div>
        </div>
      )}
      {a.estado === 'expirada' && podeEditar && (
        <p className={cn('text-sm', tk.tintaFraca)}>
          A reserva de {quemReservou(reserva)} expirou em {fmtData(reserva.expira_em)}: o documento está livre para edição.
        </p>
      )}

      {podeEditar && (
        <div className="flex flex-wrap items-center gap-2">
          {a.reservar && (
            <Button variant="outline" className="min-h-[2.75rem]" onClick={reservar} disabled={!!aOcupar}>
              {spin('reservar', PenLine)}Reservar para edição
            </Button>
          )}
          {a.renovar && (
            <Button variant="ghost" className="min-h-[2.75rem]" onClick={reservar} disabled={!!aOcupar} title={`Prolonga a reserva por mais ${DIAS_RESERVA} dias`}>
              {spin('reservar', PenLine)}Renovar reserva
            </Button>
          )}
          {a.libertar && (
            <Button variant="outline" className="min-h-[2.75rem]" onClick={libertar} disabled={!!aOcupar}>
              {spin('libertar', LockOpen)}Libertar
            </Button>
          )}
          {a.forcar && (
            <Button variant="outline" className={cn('min-h-[2.75rem]', tk.perigo, tk.perigoBorda)} onClick={() => setForcarAberto(true)} disabled={!!aOcupar}>
              <ShieldAlert className="h-4 w-4" aria-hidden="true" />Forçar libertação
            </Button>
          )}
          <Button
            variant="outline"
            className="min-h-[2.75rem]"
            onClick={() => { setCriada(null); setRascunhoAberto(true); }}
            disabled={!!bloqueio || !!aOcupar}
            title={bloqueio || 'A revisão entra em rascunho e segue depois para aprovação'}
          >
            <FilePlus2 className="h-4 w-4" aria-hidden="true" />Carregar nova versão (rascunho)
          </Button>
        </div>
      )}
      {podeEditar && bloqueio && <p className={cn('text-sm', tk.tintaFraca)}>{bloqueio}</p>}
      <Erro>{erro}</Erro>

      {criada && (
        <div className={cn('flex flex-wrap items-center gap-3 rounded-xl border p-3 text-sm', tk.borda, tk.bomFundo)}>
          <CheckCircle2 className={cn('h-4 w-4 shrink-0', tk.bom)} aria-hidden="true" />
          <span className={cn('min-w-0 flex-1', tk.tinta)}>
            Revisão v{criada.versao}{criada.rotulo && criada.rotulo !== String(criada.versao) ? ` (${criada.rotulo})` : ''} guardada em rascunho.
            O documento em vigor não mudou.
          </span>
          {gestor && onPedirAprovacao && (
            <Button size="sm" variant="outline" onClick={onPedirAprovacao}><Stamp className="h-4 w-4" aria-hidden="true" />Pedir aprovação</Button>
          )}
        </div>
      )}

      {rascunhoAberto && (
        <DialogRascunho
          doc={doc}
          onFechar={() => setRascunhoAberto(false)}
          onFeito={(linha) => { setRascunhoAberto(false); setCriada(linha); recarregar(doc.id); }}
        />
      )}

      <AlertDialog open={forcarAberto} onOpenChange={(o) => { if (!o && aOcupar !== 'forcar') { setForcarAberto(false); setMotivo(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Forçar a libertação da reserva de {quemReservou(reserva)}?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa pessoa deixa de poder carregar a revisão que está a preparar até reservar de novo, e pode perder
              trabalho se outra pessoa avançar entretanto. Fale com ela primeiro. A libertação forçada fica na auditoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="gd-forcar-motivo">Motivo (fica na auditoria)</Label>
            <Input id="gd-forcar-motivo" value={motivo} onChange={e => setMotivo(e.target.value)} maxLength={300} autoComplete="off" placeholder="ex. ausente de férias" />
          </div>
          <Erro>{forcarAberto ? erro : ''}</Erro>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={aOcupar === 'forcar'}>Deixar como está</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); forcar(); }} disabled={aOcupar === 'forcar'}>
              {aOcupar === 'forcar' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}Forçar libertação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
