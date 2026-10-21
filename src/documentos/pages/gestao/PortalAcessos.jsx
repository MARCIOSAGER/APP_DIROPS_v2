// Acessos ao Portal de Documentos: pedidos de acesso, convites, utilizadores (perfis, revogar, excluir), os
// aeroportos (quem aprova e quem vê os documentos de cada um) e o separador «Perfis e páginas», que decide que
// páginas cada perfil do portal vê.
// Os aeroportos em si — código, nome e quais pertencem à SGA — gerem-se no DIROPS, na tabela partilhada
// `aeroporto`. Aqui trata-se só do que é do portal: `documentos_aeroporto_responsavel` (quem aprova) e
// `documentos_acesso_aeroporto` (quem vê), que até agora não tinham sítio nenhum onde ser editadas.
// A conta global do dono (role de administrador na base de dados) não se revoga nem se despromove aqui: em vez
// do botão aparece um aviso. Quem manda nos dados é o servidor (136a/136b/136c); isto gere só contas e páginas.
import React, { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, Ban, Building2, CheckCircle2, Copy, Info, Loader2, Mail, MoreHorizontal, Pencil, Plus,
  RefreshCw, RotateCcw, Search, ShieldCheck, Trash2, UserCheck, UserCog, UserPlus, Users, UserX, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import Select from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { useAuth } from '@/lib/AuthContext';
import { cn, copyToClipboard } from '@/lib/utils';
import { fmtData, fmtDataHora } from '@/lib/safeDate';
import {
  PERFIS_DOCUMENTOS, PERFIL_DOC_LABEL, PERFIS_PORTAL_DOCS, PAGINAS_PORTAL, PERMISSOES_PADRAO,
  perfisDocTexto, contaGlobal, perfisPortal, ehAdminPortal, NIVEIS_PERFIL_DOCS, slugPerfilDoc, nivelDoPerfil,
} from '@/lib/portalDocumentos';
import {
  useAcessosDocs, guardarPerfisDocumentos, guardarNomeUtilizador, revogarAcessoDocs, excluirContaDocs, convidarParaDocs,
  usePermissoesPortalDocs, guardarPermissoesPortalDocs, useRecarregarDocs, auditarDocs,
  guardarPerfilPersonalizadoDocs, apagarPerfilPersonalizadoDocs,
  useAeroportosDocsTodos, useResponsaveisAeroportoDetalhe, useAcessoAeroportoDocs, useDocumentosDocs, usePastasDocs,
  guardarAeroportoDocs, activarAeroportoDocs, apagarAeroportoDocs,
  acrescentarResponsavelAeroporto, removerResponsavelAeroporto, acrescentarMembrosAeroporto, removerMembroAeroporto,
} from '../../hooks';
import { docsAcesso } from '../../api';
import { Vazio, Falha } from '../PortalBiblioteca';
import { PaginaGestao, MONO, Ref } from '../../PortalLayout';
import {
  GD, Painel, Cabecalho, Tabela, Th, Tr, Td, AccoesLinha, LinhasEsqueleto, LinhaMensagem,
  TiraIndicadores, ComutadorDensidade, useDensidade,
} from './PortalGestaoPainel';

const ABAS = ['pedidos', 'convites', 'utilizadores', 'aeroportos', 'perfis'];
const FILTRO_PERFIS = [
  { value: 'portal', label: 'Com perfis do portal' },
  { value: 'leitor_documentos', label: 'Só leitores' },
  { value: 'editor_documentos', label: 'Editores' },
  { value: 'gestor_documentos', label: 'Gestores' },
  { value: 'admin_documentos', label: 'Administradores' },
  { value: 'todos', label: 'Todas as contas' },
];
const temPerfil = (u, p) => Array.isArray(u?.perfis) && u.perfis.includes(p);
const perfisDoPortal = (u) => (Array.isArray(u?.perfis) ? u.perfis.filter(p => PERFIS_DOCUMENTOS.includes(p)) : []);
const passaFiltro = (u, f) => (f === 'todos' ? true : f === 'portal' ? perfisDoPortal(u).length > 0 : temPerfil(u, f));
const Etiqueta = ({ cor = 'slate', children }) => {
  const cores = {
    slate: 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
    emerald: 'border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200',
    amber: 'border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200',
    red: 'border-red-200 bg-red-100 text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200',
  };
  return <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-xs font-medium', cores[cor] || cores.slate)}>{children}</span>;
};
const listaDeEmails = (texto) => [...new Set(String(texto || '').split(/[,;\s]+/).map(e => e.trim().toLowerCase()).filter(e => e.includes('@')))];

// ── convidar ────────────────────────────────────────────────────────────────
function DialogConvidar({ emailInicial, onFechar, onFeito }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [emails, setEmails] = useState(emailInicial || '');
  const [mensagem, setMensagem] = useState('');
  const [busy, setBusy] = useState(false);
  const [resultado, setResultado] = useState(null);
  // O acesso a um aeroporto vai por email (documentos_acesso_aeroporto), por isso pode ficar dado já no convite,
  // antes de a conta existir — sem ele a pessoa entra e só vê os documentos gerais.
  const aeroportosQ = useAeroportosDocsTodos();
  const aeroportos = useMemo(() => (aeroportosQ.data || []).filter(a => a.ativo !== false)
    .sort((a, b) => String(a.codigo_icao).localeCompare(String(b.codigo_icao))), [aeroportosQ.data]);
  const [aeroSel, setAeroSel] = useState(() => new Set());
  // perfil com que a pessoa entra (leitor por omissão); gestão e administração só um administrador as dá
  const souAdmin = ehAdminPortal(user);
  const [perfilConvite, setPerfilConvite] = useState('leitor_documentos');
  const opcoesPerfil = PERFIS_PORTAL_DOCS
    .filter(p => souAdmin || !['gestor', 'admin'].includes(nivelDoPerfil(p.chave)))
    .map(p => ({ value: p.chave, label: `${PERFIL_DOC_LABEL[p.chave] || p.label}${p.personalizado ? ' (perfil próprio)' : ''}` }));
  const alternarAero = (id) => setAeroSel(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const lista = useMemo(() => listaDeEmails(emails), [emails]);

  const convidar = async () => {
    if (!lista.length) { toast({ title: 'Indique pelo menos um email válido', variant: 'destructive' }); return; }
    setBusy(true);
    try {
      const r = await convidarParaDocs(lista, { mensagem: mensagem.trim() || undefined, perfis: [perfilConvite] });
      const convites = [r?.convites, r?.resultados, r?.itens].find(Array.isArray) || [];
      const dados = [];
      for (const id of aeroSel) {
        const a = aeroportos.find(x => x.id === id);
        try { await acrescentarMembrosAeroporto(id, lista); dados.push(a?.codigo_icao || id); }
        catch (e) { toast({ title: `Não foi possível dar acesso a ${a?.codigo_icao || 'um aeroporto'}`, description: e?.message || String(e), variant: 'destructive' }); }
      }
      if (dados.length) await auditarDocs(user, { acao: 'acesso_aeroporto', entidade: 'utilizador', detalhes: `Convite com acesso a ${dados.join(', ')}: ${lista.join(', ')}` });
      setResultado({ convites, bruto: r, aeroportos: dados });
      toast({ title: lista.length === 1 ? 'Convite enviado' : `${lista.length} convites enviados`, description: `${dados.length ? `Com acesso a ${dados.join(', ')}. ` : ''}Quem for convidado entra como leitor; os perfis mudam-se no separador «Utilizadores».` });
      onFeito();
    } catch (e) {
      toast({ title: 'Não foi possível convidar', description: e?.message || String(e), variant: 'destructive' });
    } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-h-[92vh] w-full max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5 text-teal-600" aria-hidden="true" />Convidar para o portal</DialogTitle>
          <DialogDescription>Cria a conta (se ainda não existir) e envia o endereço para definir a senha. Quem já tem conta entra com as credenciais que já tem.</DialogDescription>
        </DialogHeader>

        {resultado ? (
          <div className="space-y-3">
            <p className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                Convites processados{resultado.aeroportos?.length ? <>, com acesso a <strong>{resultado.aeroportos.join(', ')}</strong></> : ' (sem aeroporto: só verá os documentos gerais)'}.
                {lista.some(e => !e.endsWith('@sga.co.ao')) && ' O relay da SGA só entrega a @sga.co.ao — para os endereços externos, copie o endereço do convite e envie-o pelo seu próprio email.'}
              </span>
            </p>
            {resultado.convites.length > 0 && (
              <ul className="space-y-2">
                {resultado.convites.map((c, i) => (
                  <li key={c?.email || i} className={cn('space-y-1 rounded-lg border p-2.5 text-sm', GD.borda)}>
                    <p className="break-words font-medium">{c?.email || '—'} {c?.enviado === false && <Etiqueta cor="amber">email não entregue</Etiqueta>}</p>
                    {c?.link && (
                      <div className="flex gap-2">
                        <Input readOnly value={c.link} onFocus={e => e.target.select()} className={cn('min-w-0 text-sm', GD.ref)} aria-label={`Endereço do convite de ${c.email}`} />
                        <Button variant="outline" size="icon" className="shrink-0" aria-label="Copiar endereço do convite" onClick={async () => toast({ title: (await copyToClipboard(c.link)) ? 'Endereço copiado' : 'Copie manualmente' })}><Copy className="h-4 w-4" aria-hidden="true" /></Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cv-emails">Emails *</Label>
              <Textarea id="cv-emails" value={emails} onChange={e => setEmails(e.target.value)} rows={3} placeholder="nome@sga.co.ao, outro@sga.co.ao" />
              <p className={cn('text-sm', GD.meta)}>{lista.length ? `${lista.length} email(s) válido(s).` : 'Separe por vírgula, ponto e vírgula ou linha.'}</p>
            </div>
            <div className="space-y-1.5">
              <Label>Perfil</Label>
              <Select options={opcoesPerfil} value={perfilConvite} onValueChange={setPerfilConvite} />
            </div>
            <fieldset className="space-y-1.5">
              <legend className="text-sm font-medium">Aeroportos que vai ver</legend>
              {aeroportosQ.isLoading ? (
                <p className={cn('text-sm', GD.meta)}>A carregar os aeroportos…</p>
              ) : (
                <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto rounded-lg border p-2 dark:border-slate-700" role="group" aria-label="Aeroportos">
                  {aeroportos.map(a => {
                    const on = aeroSel.has(a.id);
                    return (
                      <button key={a.id} type="button" onClick={() => alternarAero(a.id)} aria-pressed={on} title={a.nome}
                        className={cn('min-h-[2.25rem] rounded-full border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600',
                          on ? 'border-teal-700 bg-teal-700 font-semibold text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800')}>
                        {a.codigo_icao}
                      </button>
                    );
                  })}
                </div>
              )}
              <p className={cn('text-sm', GD.meta)}>
                {aeroSel.size
                  ? `Acesso a: ${aeroportos.filter(a => aeroSel.has(a.id)).map(a => `${a.codigo_icao} — ${a.nome}`).join('; ')}.`
                  : 'Sem aeroporto escolhido, a pessoa só verá os documentos gerais. Pode juntar depois no separador «Aeroportos».'}
              </p>
            </fieldset>
            <div className="space-y-1.5">
              <Label htmlFor="cv-msg">Mensagem no email (opcional)</Label>
              <Textarea id="cv-msg" value={mensagem} onChange={e => setMensagem(e.target.value)} rows={2} maxLength={500} placeholder="ex.: comece pelos manuais do seu aeroporto." />
            </div>
            <p className={cn('flex items-start gap-2 text-sm', GD.meta)}>
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />O perfil pode mudar-se depois no botão «Perfis» do separador «Utilizadores». Os perfis próprios criam-se em «Perfis e páginas».
            </p>
          </div>
        )}

        <DialogFooter>
          {resultado
            ? <Button onClick={onFechar}>Fechar</Button>
            : <><Button variant="outline" onClick={onFechar} disabled={busy}>Cancelar</Button><Button onClick={convidar} disabled={busy || !lista.length}>{busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <UserPlus className="h-4 w-4" aria-hidden="true" />}Convidar</Button></>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── perfis de um utilizador ─────────────────────────────────────────────────
function DialogPerfis({ u, actor, onFechar, onFeito }) {
  const { toast } = useToast();
  const global = contaGlobal(u);
  const [perfis, setPerfis] = useState(() => new Set(perfisDoPortal(u)));
  const [busy, setBusy] = useState(false);
  // nome completo: só administradores (a base confirma); se a conta só tem o email como nome, sugere-se corrigir
  const podeNome = ehAdminPortal(actor);
  const [nome, setNome] = useState(u?.full_name && u.full_name !== String(u?.email || '').split('@')[0] ? u.full_name : '');
  const alternar = (p) => setPerfis(s => { const n = new Set(s); if (n.has(p)) n.delete(p); else n.add(p); return n; });
  const guardar = async () => {
    setBusy(true);
    try {
      if (podeNome && nome.trim() && nome.trim() !== (u?.full_name || '')) await guardarNomeUtilizador(u, nome, actor);
      const lista = PERFIS_DOCUMENTOS.filter(p => perfis.has(p));
      await guardarPerfisDocumentos(u, lista, actor);
      await auditarDocs(actor, { acao: 'acesso_perfis', entidade: 'utilizador', id: u?.id, detalhes: `Perfis de ${u?.email}: ${perfisDocTexto(lista) || 'sem perfis do portal'}` });
      toast({ title: 'Perfis actualizados', description: `${u?.full_name || u?.email}: ${perfisDocTexto(lista) || 'sem perfis do portal'}.` });
      onFeito();
    } catch (e) {
      toast({ title: 'Não foi possível guardar', description: e?.message || String(e), variant: 'destructive' });
    } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-h-[92vh] w-full overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserCog className="h-5 w-5 text-teal-600" aria-hidden="true" />Perfis de {u?.full_name || u?.email}</DialogTitle>
          <DialogDescription className="break-words">{u?.email}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {podeNome && (
            <div className="space-y-1.5">
              <Label htmlFor="perfil-nome">Nome completo</Label>
              <Input id="perfil-nome" value={nome} onChange={e => setNome(e.target.value)} placeholder={`Ex.: ${String(u?.email || '').split('@')[0]}`} autoComplete="off" />
              <p className={cn('text-sm', GD.meta)}>É o nome que aparece nas plataformas, nas assinaturas e nos documentos. Vale para o DIROPS, a Universidade e o GED.</p>
            </div>
          )}
          {global && (
            <p className={cn('flex items-start gap-2 rounded-lg border p-3 text-sm', GD.avisoSuave)}>
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />Conta global: tem acesso total a todas as plataformas por via da base de dados. Os perfis do portal não se alteram aqui nem lhe tiram acesso.
            </p>
          )}
          {PERFIS_PORTAL_DOCS.map(p => (
            <label key={p.chave} className={cn('flex items-start gap-3 rounded-lg border p-3 text-sm', GD.borda)}>
              <Checkbox className="mt-0.5" disabled={global} checked={perfis.has(p.chave)} onCheckedChange={() => alternar(p.chave)} aria-label={p.label} />
              <span><span className="block font-medium">{PERFIL_DOC_LABEL[p.chave]}</span><span className={cn('text-sm', GD.meta)}>{p.descricao}</span></span>
            </label>
          ))}
          <p className={cn('text-sm', GD.meta)}>Os níveis acumulam-se: o gestor faz o que o editor faz, e o administrador faz tudo.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onFechar} disabled={busy}>Cancelar</Button>
          <Button onClick={guardar} disabled={busy || global}>{busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <UserCog className="h-4 w-4" aria-hidden="true" />}Guardar perfis</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── aprovar / rejeitar um pedido ────────────────────────────────────────────
function DialogPedido({ pedido, acao, onFechar, onFeito }) {
  const { toast } = useToast();
  const aprovar = acao === 'aprovar';
  const [perfil, setPerfil] = useState('leitor_documentos');
  const [mensagem, setMensagem] = useState('');
  const [motivo, setMotivo] = useState('');
  const [avisar, setAvisar] = useState(true);
  const [busy, setBusy] = useState(false);
  const submeter = async () => {
    setBusy(true);
    try {
      if (aprovar) await docsAcesso('aprovar', { pedido_id: pedido.id, perfis: [perfil], mensagem: mensagem.trim() || undefined });
      else await docsAcesso('rejeitar', { pedido_id: pedido.id, motivo: motivo.trim() || undefined, avisar });
      toast({ title: aprovar ? 'Pedido aprovado' : 'Pedido rejeitado', description: aprovar ? 'Foi enviado o convite para criar a senha.' : undefined });
      onFeito();
    } catch (e) {
      toast({ title: aprovar ? 'Não foi possível aprovar' : 'Não foi possível rejeitar', description: e?.message || String(e), variant: 'destructive' });
    } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-h-[92vh] w-full overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{aprovar ? 'Aprovar pedido' : 'Rejeitar pedido'} de {pedido.nome || pedido.email}</DialogTitle>
          <DialogDescription className="break-words">{pedido.email}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className={cn('rounded-lg p-3 text-sm', GD.superficieFraca)}>
            <p><strong>Função:</strong> {pedido.funcao || '—'} · <strong>Departamento:</strong> {pedido.departamento || '—'}</p>
            <p><strong>Aeroporto:</strong> {pedido.aeroporto || '—'} · <strong>Pedido em:</strong> {fmtData(pedido.created_date)}</p>
            {pedido.motivo && <p className={cn('mt-1', GD.tintaMedia)}>«{pedido.motivo}»</p>}
          </div>
          {aprovar ? (
            <>
              <div className="space-y-1.5">
                <Label>Perfil a atribuir</Label>
                <Select options={PERFIS_PORTAL_DOCS.map(p => ({ value: p.chave, label: `${PERFIL_DOC_LABEL[p.chave]} — ${p.descricao}` }))} value={perfil} onValueChange={setPerfil} />
              </div>
              <div className="space-y-1.5"><Label htmlFor="pd-msg">Mensagem no email (opcional)</Label><Textarea id="pd-msg" value={mensagem} onChange={e => setMensagem(e.target.value)} rows={2} maxLength={500} /></div>
            </>
          ) : (
            <>
              <div className="space-y-1.5"><Label htmlFor="pd-motivo">Motivo (opcional, vai no email)</Label><Textarea id="pd-motivo" value={motivo} onChange={e => setMotivo(e.target.value)} rows={3} maxLength={500} /></div>
              <label className="flex items-center gap-2 text-sm"><Switch checked={avisar} onCheckedChange={setAvisar} />Avisar a pessoa por email</label>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onFechar} disabled={busy}>Cancelar</Button>
          <Button variant={aprovar ? 'default' : 'destructive'} onClick={submeter} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : aprovar ? <UserCheck className="h-4 w-4" aria-hidden="true" /> : <UserX className="h-4 w-4" aria-hidden="true" />}
            {aprovar ? 'Aprovar e convidar' : 'Rejeitar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── aeroportos do portal ────────────────────────────────────────────────────
// A lista de aeroportos é do portal (migração 145): cria-se, edita-se e desactiva-se aqui. Os identificadores
// vieram do DIROPS, por isso os documentos e as pastas que já existiam continuam a apontar para o mesmo aeroporto.
// Dois casos travam a aprovação de documentos, e ambos ficam marcados: aeroporto sem responsável e responsável
// sem conta no portal (esse só consegue aprovar depois de ser convidado).
function DialogAeroporto({ aeroporto, actor, onFechar, onFeito }) {
  const { toast } = useToast();
  const novo = !aeroporto?.id;
  const [f, setF] = useState(() => ({
    codigo_icao: aeroporto?.codigo_icao || '',
    nome: aeroporto?.nome || '',
    cidade: aeroporto?.cidade || '',
    provincia: aeroporto?.provincia || '',
    ordem: aeroporto?.ordem ?? 0,
    ativo: aeroporto?.ativo !== false,
    observacoes: aeroporto?.observacoes || '',
  }));
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));

  const guardar = async () => {
    setBusy(true);
    try {
      await guardarAeroportoDocs({ id: aeroporto?.id, ...f }, actor);
      await auditarDocs(actor, {
        acao: novo ? 'aeroporto_criado' : 'aeroporto_alterado', entidade: 'aeroporto', id: aeroporto?.id,
        detalhes: `${novo ? 'Aeroporto criado' : 'Aeroporto alterado'}: ${f.codigo_icao.toUpperCase()} — ${f.nome}`,
      });
      toast({ title: novo ? 'Aeroporto criado' : 'Aeroporto guardado', description: 'Aparece de imediato nas listas e nos selectores do portal.' });
      onFeito();
    } catch (e) {
      toast({ title: 'Não foi possível guardar', description: e?.message || String(e), variant: 'destructive' });
    } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-h-[92vh] w-full max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-teal-600" aria-hidden="true" />{novo ? 'Novo aeroporto' : `Editar ${aeroporto.codigo_icao}`}</DialogTitle>
          <DialogDescription>
            A lista é do portal. Mudar o código ou o nome aqui muda-os em todo o portal, mas não mexe no DIROPS —
            são listas separadas, ligadas pelo mesmo identificador.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ae-codigo">Código ICAO *</Label>
            <Input id="ae-codigo" value={f.codigo_icao} onChange={e => set('codigo_icao', e.target.value.toUpperCase())} maxLength={8} autoComplete="off" style={MONO} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ae-ordem">Ordem</Label>
            <Input id="ae-ordem" type="number" min={0} max={999} value={f.ordem} onChange={e => set('ordem', e.target.value)} />
            <p className={cn('text-sm', GD.meta)}>Número menor aparece primeiro nas listas.</p>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ae-nome">Nome *</Label>
            <Input id="ae-nome" value={f.nome} onChange={e => set('nome', e.target.value)} maxLength={160} autoComplete="off" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ae-cidade">Cidade</Label>
            <Input id="ae-cidade" value={f.cidade} onChange={e => set('cidade', e.target.value)} maxLength={120} autoComplete="off" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ae-prov">Província</Label>
            <Input id="ae-prov" value={f.provincia} onChange={e => set('provincia', e.target.value)} maxLength={120} autoComplete="off" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ae-obs">Observações</Label>
            <Textarea id="ae-obs" value={f.observacoes} onChange={e => set('observacoes', e.target.value)} rows={2} maxLength={500} />
            <p className={cn('text-sm', GD.meta)}>Notas internas da gestão documental (por exemplo, por que motivo o aeroporto está nesta lista).</p>
          </div>
          <label className={cn('flex items-start gap-2.5 rounded-lg border p-3 text-sm sm:col-span-2', GD.borda)}>
            <Checkbox className="mt-0.5" checked={f.ativo} onCheckedChange={v => set('ativo', v)} aria-label="Aeroporto activo" />
            <span>
              <span className={cn('block font-medium', GD.tinta)}>Activo</span>
              <span className={cn('text-sm', GD.meta)}>Desligado, o aeroporto deixa de aparecer nas listas e nos selectores, mas os documentos e as pastas que já lhe pertencem continuam agarrados a ele.</span>
            </span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onFechar} disabled={busy}>Cancelar</Button>
          <Button onClick={guardar} disabled={busy || !f.codigo_icao.trim() || !f.nome.trim()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}{novo ? 'Criar aeroporto' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Responsáveis de um aeroporto: ficha completa (nome, email, cargo, telefone), vários por aeroporto.
// Quem não tem conta no portal fica marcado e tem ali o botão de convidar — sem conta não aprova nada.
function DialogResponsaveisAeroporto({ linha, temConta, actor, aoConvidar, onFechar, onFeito }) {
  const { toast } = useToast();
  const [f, setF] = useState({ email: '', nome: '', cargo: '', telefone: '' });
  const [busy, setBusy] = useState(false);
  const [aRemover, setARemover] = useState(null);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const alvo = f.email.trim().toLowerCase();
  const novoSemConta = alvo.includes('@') && !temConta(alvo);

  const acrescentar = async () => {
    setBusy(true);
    try {
      await acrescentarResponsavelAeroporto(linha.a.id, f);
      await auditarDocs(actor, { acao: 'aeroporto_responsavel', entidade: 'aeroporto', id: linha.a.id, detalhes: `Responsável ${alvo} acrescentado a ${linha.nome}` });
      toast({ title: 'Responsável acrescentado', description: `${alvo} passa a aprovar os documentos de ${linha.nome}.` });
      setF({ email: '', nome: '', cargo: '', telefone: '' });
      onFeito();
    } catch (e) {
      toast({ title: 'Não foi possível acrescentar', description: e?.message || String(e), variant: 'destructive' });
    } finally { setBusy(false); }
  };
  const remover = async (r) => {
    setARemover(r.email);
    try {
      await removerResponsavelAeroporto(linha.a.id, r.email);
      await auditarDocs(actor, { acao: 'aeroporto_responsavel_removido', entidade: 'aeroporto', id: linha.a.id, detalhes: `Responsável ${r.email} removido de ${linha.nome}` });
      toast({ title: 'Responsável removido', description: `${r.email} deixa de aprovar os documentos de ${linha.nome}.` });
      onFeito();
    } catch (e) {
      toast({ title: 'Não foi possível remover', description: e?.message || String(e), variant: 'destructive' });
    } finally { setARemover(null); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-h-[92vh] w-full max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserCheck className="h-5 w-5 text-teal-600" aria-hidden="true" />Quem aprova em {linha.nome}</DialogTitle>
          <DialogDescription>
            O responsável de um aeroporto aprova e põe em vigor os documentos desse aeroporto e recebe os avisos de
            validade. Pode haver mais do que um.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {linha.responsaveis.length === 0 ? (
            <p className={cn('flex items-start gap-2 rounded-lg border p-3 text-sm', 'border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200')}>
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Este aeroporto não tem ninguém que aprove documentos. Enquanto estiver assim, os documentos de
              {' '}{linha.nome} ficam parados em revisão.
            </p>
          ) : (
            <ul className={cn('divide-y overflow-hidden rounded-lg border', GD.borda, GD.divisoria)}>
              {linha.responsaveis.map(r => {
                const conta = temConta(r.email);
                return (
                  <li key={r.email} className="flex flex-wrap items-start gap-2 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className={cn('truncate font-medium', GD.tinta)}>{r.nome || r.email}</p>
                      <p className={cn('truncate text-sm', GD.meta)}>{r.email}</p>
                      <p className={cn('truncate text-sm', GD.meta)}>{[r.cargo, r.telefone].filter(Boolean).join(' · ') || 'sem cargo nem telefone indicados'}</p>
                      {!conta && (
                        <p className={cn('mt-1 flex items-center gap-1.5 text-sm', GD.alerta)}>
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          Sem conta no portal: não consegue aprovar até entrar.
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {!conta && aoConvidar && (
                        <Button size="sm" variant="outline" onClick={() => aoConvidar(r.email)}>
                          <Mail className="h-4 w-4" aria-hidden="true" />Convidar
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className={GD.perigo} disabled={aRemover === r.email} onClick={() => remover(r)}>
                        {aRemover === r.email ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <X className="h-4 w-4" aria-hidden="true" />}Remover
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className={cn('space-y-3 rounded-lg border p-3', GD.borda)}>
            <p className={cn('text-sm font-semibold', GD.tinta)}>Acrescentar responsável</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ra-email">Email *</Label>
                <Input id="ra-email" type="email" value={f.email} onChange={e => set('email', e.target.value)} placeholder="nome@sga.co.ao" autoComplete="off" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ra-nome">Nome</Label>
                <Input id="ra-nome" value={f.nome} onChange={e => set('nome', e.target.value)} maxLength={120} autoComplete="off" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ra-cargo">Cargo</Label>
                <Input id="ra-cargo" value={f.cargo} onChange={e => set('cargo', e.target.value)} maxLength={120} autoComplete="off" placeholder="Director do aeroporto" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ra-tel">Telefone</Label>
                <Input id="ra-tel" value={f.telefone} onChange={e => set('telefone', e.target.value)} maxLength={40} autoComplete="off" placeholder="+244 …" />
              </div>
            </div>
            {novoSemConta && (
              <p className={cn('flex items-start gap-2 rounded-lg border p-3 text-sm', GD.avisoSuave)}>
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                Este email ainda não tem conta no portal. Pode ficar registado como responsável — e convém, para se
                saber quem responde pelo aeroporto —, mas só aprova documentos depois de ser convidado e entrar.
              </p>
            )}
            <Button onClick={acrescentar} disabled={busy || !alvo.includes('@')}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}Acrescentar
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Membros de um aeroporto: é esta lista que o servidor usa para decidir quem vê os documentos do aeroporto.
function DialogMembrosAeroporto({ linha, admin, actor, onFechar, onFeito }) {
  const { toast } = useToast();
  const [busca, setBusca] = useState('');
  const [novos, setNovos] = useState('');
  const [busy, setBusy] = useState(false);
  const [aRemover, setARemover] = useState(null);
  const membros = linha.membros;
  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return (membros || []).filter(e => !t || e.includes(t)).sort();
  }, [membros, busca]);
  const porAcrescentar = useMemo(() => listaDeEmails(novos).filter(e => !(membros || []).includes(e)), [novos, membros]);

  const acrescentar = async () => {
    setBusy(true);
    try {
      const n = await acrescentarMembrosAeroporto(linha.a.id, porAcrescentar);
      await auditarDocs(actor, { acao: 'aeroporto_acesso', entidade: 'aeroporto', id: linha.a.id, detalhes: `Acesso a ${linha.nome} dado a ${n} pessoa(s)` });
      toast({ title: n === 1 ? 'Acesso dado a 1 pessoa' : `Acesso dado a ${n} pessoas`, description: `Passam a ver os documentos de ${linha.nome}.` });
      setNovos('');
      onFeito();
    } catch (e) {
      toast({ title: 'Não foi possível dar acesso', description: e?.message || String(e), variant: 'destructive' });
    } finally { setBusy(false); }
  };
  const remover = async (email) => {
    setARemover(email);
    try {
      await removerMembroAeroporto(linha.a.id, email);
      await auditarDocs(actor, { acao: 'aeroporto_acesso_removido', entidade: 'aeroporto', id: linha.a.id, detalhes: `Acesso a ${linha.nome} retirado a ${email}` });
      toast({ title: 'Acesso retirado', description: `${email} deixa de ver os documentos de ${linha.nome} (a não ser por outra regra).` });
      onFeito();
    } catch (e) {
      toast({ title: 'Não foi possível retirar o acesso', description: e?.message || String(e), variant: 'destructive' });
    } finally { setARemover(null); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-h-[92vh] w-full max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-teal-600" aria-hidden="true" />Quem vê os documentos de {linha.nome}</DialogTitle>
          <DialogDescription>
            {(membros || []).length} pessoa(s) com acesso por aeroporto. É esta lista que o servidor usa para decidir
            quem vê os documentos — tirar daqui tira o acesso, a não ser que uma pasta o dê por outra via.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className={cn('pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2', GD.meta)} aria-hidden="true" />
            <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Procurar nesta lista…" aria-label="Procurar nos membros do aeroporto" className="pl-9" />
          </div>
          {lista.length === 0 ? (
            <p className={cn('rounded-lg border px-3 py-6 text-center text-sm', GD.borda, GD.meta)}>
              {(membros || []).length === 0 ? 'Ninguém tem acesso por este aeroporto.' : 'Nenhum email corresponde à procura.'}
            </p>
          ) : (
            <ul className={cn('max-h-64 divide-y overflow-auto rounded-lg border', GD.borda, GD.divisoria)}>
              {lista.map(email => (
                <li key={email} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                  <span className="min-w-0 flex-1 truncate">{email}</span>
                  {admin && (
                    <Button size="sm" variant="ghost" className={GD.perigo} disabled={aRemover === email} onClick={() => remover(email)}>
                      {aRemover === email ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <X className="h-4 w-4" aria-hidden="true" />}Retirar
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {admin ? (
            <div className="space-y-1.5">
              <Label htmlFor="ma-novos">Dar acesso a mais pessoas</Label>
              <Textarea id="ma-novos" value={novos} onChange={e => setNovos(e.target.value)} rows={2} placeholder="nome@sga.co.ao, outro@sga.co.ao" />
              <p className={cn('text-sm', GD.meta)}>{porAcrescentar.length ? `${porAcrescentar.length} email(s) por acrescentar.` : 'Separe por vírgula, ponto e vírgula ou linha. Os que já estão na lista são ignorados.'}</p>
            </div>
          ) : (
            <p className={cn('text-sm', GD.meta)}>Só administradores do portal alteram quem vê os documentos de um aeroporto.</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onFechar} disabled={busy}>Fechar</Button>
          {admin && <Button onClick={acrescentar} disabled={busy || !porAcrescentar.length}>{busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}Dar acesso</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Aeroportos({ admin, utilizadores, altura, actor, aoConvidar }) {
  const { toast } = useToast();
  const recarregar = useRecarregarDocs();
  const aeroportosQ = useAeroportosDocsTodos();
  const responsaveisQ = useResponsaveisAeroportoDetalhe();
  const acessoQ = useAcessoAeroportoDocs();
  const docsQ = useDocumentosDocs({ limite: 1000 });
  const pastasQ = usePastasDocs();
  const [editar, setEditar] = useState(null);       // { ...aeroporto } | {} (novo)
  const [responsaveisDe, setResponsaveisDe] = useState(null);
  const [membrosDe, setMembrosDe] = useState(null);
  const [confirmar, setConfirmar] = useState(null);

  const aeroportos = aeroportosQ.data || [];
  const contas = useMemo(() => new Set((utilizadores || []).map(u => String(u.email || '').toLowerCase())), [utilizadores]);
  const temConta = useCallback((email) => contas.has(String(email || '').toLowerCase()), [contas]);

  const linhas = useMemo(() => {
    const resp = new Map();
    for (const r of responsaveisQ.data || []) {
      if (!resp.has(r.aeroporto_id)) resp.set(r.aeroporto_id, []);
      resp.get(r.aeroporto_id).push({ ...r, email: String(r.email || '').toLowerCase() });
    }
    const membros = new Map();
    for (const a of acessoQ.data || []) {
      if (!membros.has(a.aeroporto_id)) membros.set(a.aeroporto_id, []);
      membros.get(a.aeroporto_id).push(String(a.email || '').toLowerCase());
    }
    const docs = new Map();
    for (const d of docsQ.data || []) docs.set(d.aeroporto_id, (docs.get(d.aeroporto_id) || 0) + 1);
    const pastas = new Map();
    for (const p of pastasQ.data || []) pastas.set(p.aeroporto_id, (pastas.get(p.aeroporto_id) || 0) + 1);
    return aeroportos.map(a => ({
      a,
      nome: a.codigo_icao ? `${a.codigo_icao} · ${a.nome}` : a.nome,
      responsaveis: resp.get(a.id) || [],
      membros: membros.get(a.id) || [],
      documentos: docs.get(a.id) || 0,
      pastas: pastas.get(a.id) || 0,
    }));
  }, [aeroportos, responsaveisQ.data, acessoQ.data, docsQ.data, pastasQ.data]);

  const semResponsavel = linhas.filter(l => l.responsaveis.length === 0);
  const respSemConta = useMemo(() => {
    const s = new Set();
    for (const l of linhas) for (const r of l.responsaveis) if (!temConta(r.email)) s.add(r.email);
    return s;
  }, [linhas, temConta]);
  const comNota = linhas.filter(l => l.a.observacoes);
  const aCarregar = aeroportosQ.isLoading || responsaveisQ.isLoading;

  const desactivar = async (l, ativo) => {
    try {
      await activarAeroportoDocs(l.a.id, ativo, actor);
      await auditarDocs(actor, { acao: ativo ? 'aeroporto_reposto' : 'aeroporto_desactivado', entidade: 'aeroporto', id: l.a.id, detalhes: `${ativo ? 'Reposto' : 'Desactivado'}: ${l.nome}` });
      toast({ title: ativo ? 'Aeroporto reposto' : 'Aeroporto desactivado', description: ativo ? 'Volta a aparecer nas listas.' : 'Deixa de aparecer nas listas; os documentos e as pastas ficam agarrados a ele.' });
      recarregar('aeroportos-todos'); recarregar('aeroportos');
    } catch (e) {
      toast({ title: 'Não foi possível guardar', description: e?.message || String(e), variant: 'destructive' });
    }
  };
  const apagar = async (l) => {
    try {
      await apagarAeroportoDocs(l.a.id);
      await auditarDocs(actor, { acao: 'aeroporto_apagado', entidade: 'aeroporto', id: l.a.id, detalhes: `Aeroporto apagado: ${l.nome}` });
      toast({ title: 'Aeroporto apagado', description: 'Era um aeroporto sem documentos, pastas, responsáveis nem membros.' });
      recarregar('aeroportos-todos'); recarregar('aeroportos');
    } catch (e) {
      toast({ title: 'Não foi possível apagar', description: e?.message || String(e), variant: 'destructive' });
    }
  };
  const recarregarTudo = () => { recarregar('aeroportos-todos'); recarregar('aeroportos'); recarregar('responsaveis-detalhe'); recarregar('responsaveis'); recarregar('acesso-aeroporto'); };

  return (
    <div className="space-y-3">
      <TiraIndicadores
        carregando={aCarregar}
        itens={[
          { chave: 'sem-resp', label: 'Aeroportos sem responsável', valor: semResponsavel.length, tom: 'perigo', sufixo: 'ninguém aprova os seus documentos', zero: 'Todos os aeroportos têm quem aprove' },
          { chave: 'sem-conta', label: 'Responsáveis sem conta', valor: respSemConta.size, tom: 'alerta', sufixo: 'não aprovam até serem convidados', zero: 'Todos os responsáveis têm conta no portal' },
          { chave: 'total', label: 'Aeroportos', valor: linhas.length, tom: 'neutro', sempre: true },
        ]}
        nota={`${(acessoQ.data || []).length} acesso(s) por aeroporto registado(s)${linhas.filter(l => l.a.ativo === false).length ? ` · ${linhas.filter(l => l.a.ativo === false).length} desactivado(s)` : ''}`}
      />

      {semResponsavel.length > 0 && !aCarregar && (
        <p className={cn('flex items-start gap-2 rounded-lg border p-3 text-sm', 'border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200')}>
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Sem responsável, ninguém aprova nem põe em vigor documentos destes {semResponsavel.length} aeroportos:{' '}
            <strong>{semResponsavel.map(l => l.a.codigo_icao).join(', ')}</strong>. Nomeie alguém em «Quem aprova».
          </span>
        </p>
      )}

      <Painel>
        <Cabecalho
          icone={Building2}
          titulo="Aeroportos do portal"
          contagem={aCarregar ? null : linhas.length}
          descricao="A lista é do portal: cria-se e edita-se aqui. Quem aprova e quem vê os documentos de cada aeroporto também se define nesta tabela."
          accoes={admin && <Button size="sm" onClick={() => setEditar({})}><Plus className="h-4 w-4" aria-hidden="true" />Novo aeroporto</Button>}
        />
        <Tabela altura={altura} rotulo="Aeroportos, responsáveis e membros">
          <thead>
            <tr>
              <Th estreito>Código</Th>
              <Th>Aeroporto</Th>
              <Th>Quem aprova</Th>
              <Th numerico estreito className="hidden md:table-cell">Documentos</Th>
              <Th numerico estreito className="hidden md:table-cell">Pastas</Th>
              <Th numerico estreito>Quem vê</Th>
              <Th numerico>Acções</Th>
            </tr>
          </thead>
          {aCarregar ? <LinhasEsqueleto linhas={8} colunas={7} altura={altura} />
            : aeroportosQ.isError ? (
              <LinhaMensagem colunas={7}>
                <Falha titulo="Não foi possível carregar os aeroportos" texto={`${aeroportosQ.error?.message || 'O servidor não respondeu.'} Sem esta lista não é possível nomear responsáveis.`} onTentar={() => aeroportosQ.refetch()} />
              </LinhaMensagem>
            ) : linhas.length === 0 ? (
              <LinhaMensagem colunas={7}>
                <Vazio icone={Building2} titulo="Ainda não há aeroportos no portal" texto="Crie o primeiro aeroporto para poder organizar pastas e documentos por aeroporto." className="py-8">
                  {admin && <Button onClick={() => setEditar({})}><Plus className="h-4 w-4" aria-hidden="true" />Novo aeroporto</Button>}
                </Vazio>
              </LinhaMensagem>
            ) : (
              <tbody>
                {linhas.map(l => {
                  const inactivo = l.a.ativo === false;
                  const sem = l.responsaveis.length === 0;
                  const temConteudo = l.documentos > 0 || l.pastas > 0;
                  const podeApagar = !temConteudo && l.responsaveis.length === 0 && l.membros.length === 0;
                  return (
                    <Tr key={l.a.id} className={inactivo ? 'opacity-60' : undefined}>
                      <Td><Ref className={cn('font-semibold', sem ? GD.perigo : GD.tinta)}>{l.a.codigo_icao || '—'}</Ref></Td>
                      <Td className="max-w-[16rem]">
                        <span className={cn('block truncate', GD.tintaMedia)}>{l.a.nome}</span>
                        <span className={cn('block truncate text-sm', GD.meta)}>
                          {[l.a.cidade, l.a.provincia].filter(Boolean).join(' · ') || 'sem cidade indicada'}
                          {inactivo && ' · desactivado'}
                        </span>
                        {l.a.observacoes && (
                          <span className={cn('mt-0.5 flex items-start gap-1 text-sm', GD.meta)}>
                            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span className="line-clamp-2">{l.a.observacoes}</span>
                          </span>
                        )}
                      </Td>
                      <Td className="max-w-[22rem]">
                        {sem ? (
                          <span className={cn('inline-flex items-center gap-1 text-sm font-medium', GD.perigo)}>
                            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />sem responsável — ninguém aprova
                          </span>
                        ) : (
                          <span className="flex flex-wrap items-center gap-1">
                            {l.responsaveis.map(r => (
                              <span
                                key={r.email}
                                title={[r.email, r.cargo, r.telefone].filter(Boolean).join(' · ')}
                                className={cn('inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-sm',
                                  temConta(r.email) ? cn(GD.borda, GD.tintaMedia) : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100')}
                              >
                                <span className="max-w-[12rem] truncate">{r.nome || r.email}</span>
                                {!temConta(r.email) && <span className="shrink-0 font-medium">sem conta</span>}
                              </span>
                            ))}
                          </span>
                        )}
                      </Td>
                      <Td numerico className={cn('hidden text-sm md:table-cell', GD.meta)}>{l.documentos}</Td>
                      <Td numerico className={cn('hidden text-sm md:table-cell', GD.meta)}>{l.pastas}</Td>
                      <Td numerico className={cn('text-sm', l.membros.length ? GD.meta : GD.alerta)}>{l.membros.length}</Td>
                      <Td>
                        <AccoesLinha
                          destrutivas={admin && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="ghost" aria-label={`Mais acções para ${l.nome}`}><MoreHorizontal className="h-4 w-4" aria-hidden="true" />Mais</Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-64">
                                <DropdownMenuItem onSelect={() => setEditar(l.a)} className="flex items-center gap-2"><Pencil className="h-4 w-4" aria-hidden="true" />Editar aeroporto</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {inactivo ? (
                                  <DropdownMenuItem onSelect={() => desactivar(l, true)} className="flex items-center gap-2"><RotateCcw className="h-4 w-4" aria-hidden="true" />Repor nas listas</DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    className="flex items-center gap-2"
                                    onSelect={() => setConfirmar({
                                      t: 'Desactivar aeroporto',
                                      m: `Desactivar ${l.nome}? Deixa de aparecer nas listas e nos selectores do portal. ${temConteudo ? `Tem ${l.documentos} documento(s) e ${l.pastas} pasta(s), que continuam a existir e ligados a este aeroporto.` : 'Não tem documentos nem pastas.'} Pode repô-lo a qualquer momento.`,
                                      f: () => desactivar(l, false),
                                    })}
                                  >
                                    <Ban className="h-4 w-4" aria-hidden="true" />Desactivar
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  className={cn('flex items-center gap-2', podeApagar ? GD.perigo : GD.meta)}
                                  onSelect={() => setConfirmar(podeApagar ? {
                                    t: 'Apagar aeroporto',
                                    m: `Apagar ${l.nome} de vez? Não tem documentos, pastas, responsáveis nem membros agarrados. Esta acção não se desfaz.`,
                                    f: () => apagar(l),
                                  } : {
                                    t: 'Não é possível apagar',
                                    m: `${l.nome} tem ${l.documentos} documento(s), ${l.pastas} pasta(s), ${l.responsaveis.length} responsável(eis) e ${l.membros.length} pessoa(s) com acesso. Apagar deixaria esses registos sem aeroporto: desactive-o em vez de o apagar — deixa de aparecer nas listas e nada se perde.`,
                                    f: () => {},
                                  })}
                                >
                                  <Trash2 className="h-4 w-4" aria-hidden="true" />Apagar…
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        >
                          <Button size="sm" variant={sem ? 'default' : 'outline'} onClick={() => setResponsaveisDe(l)}>
                            <UserCheck className="h-4 w-4" aria-hidden="true" />{sem ? 'Nomear' : 'Quem aprova'}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setMembrosDe(l)}><Users className="h-4 w-4" aria-hidden="true" />Quem vê</Button>
                        </AccoesLinha>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            )}
        </Tabela>
      </Painel>

      {comNota.length > 0 && !aCarregar && (
        <p className={cn('flex items-start gap-2 text-sm', GD.meta)}>
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            Notas da lista: {comNota.map(l => `${l.a.codigo_icao} — ${l.a.observacoes}`).join(' · ')}
          </span>
        </p>
      )}
      {acessoQ.isError && (
        <p className={cn('flex items-start gap-2 rounded-lg border p-3 text-sm', GD.avisoSuave)}>
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />Não foi possível carregar quem vê cada aeroporto ({acessoQ.error?.message || 'falha de rede'}). Os responsáveis, acima, não são afectados.
        </p>
      )}
      {!admin && <p className={cn('text-sm', GD.meta)}>Criar, editar e desactivar aeroportos é reservado a administradores do portal; nomear responsáveis é da gestão documental.</p>}

      {editar && (
        <DialogAeroporto
          aeroporto={editar.id ? editar : null}
          actor={actor}
          onFechar={() => setEditar(null)}
          onFeito={() => { setEditar(null); recarregarTudo(); }}
        />
      )}
      {responsaveisDe && (
        <DialogResponsaveisAeroporto
          linha={linhas.find(l => l.a.id === responsaveisDe.a.id) || responsaveisDe}
          temConta={temConta}
          actor={actor}
          aoConvidar={aoConvidar}
          onFechar={() => setResponsaveisDe(null)}
          onFeito={recarregarTudo}
        />
      )}
      {membrosDe && (
        <DialogMembrosAeroporto
          linha={linhas.find(l => l.a.id === membrosDe.a.id) || membrosDe}
          admin={admin}
          actor={actor}
          onFechar={() => setMembrosDe(null)}
          onFeito={recarregarTudo}
        />
      )}
      <ConfirmModal isOpen={!!confirmar} onClose={() => setConfirmar(null)} onConfirm={() => confirmar?.f?.()} title={confirmar?.t} message={confirmar?.m} confirmText={confirmar?.t} variant="destructive" />
    </div>
  );
}
// ── perfis × páginas ────────────────────────────────────────────────────────
// páginas por omissão de um perfil: as suas, ou as do nível base (personalizados)
const paginasPadrao = (chave) => PERMISSOES_PADRAO[chave] || PERMISSOES_PADRAO[NIVEIS_PERFIL_DOCS.find(n => n.chave === nivelDoPerfil(chave))?.perfil] || [];
const CORES_PERFIL = ['#0f766e', '#1d4ed8', '#7c3aed', '#b45309', '#be123c', '#15803d', '#0369a1', '#475569'];

// Criar ou editar um perfil personalizado. O nome técnico (doc_…) nasce do nome e não muda depois.
function DialogPerfilProprio({ existente, actor, onFechar, onFeito }) {
  const { toast } = useToast();
  const [label, setLabel] = useState(existente?.label || '');
  const [descricao, setDescricao] = useState(existente?.descricao || '');
  const [cor, setCor] = useState(existente?.cor || CORES_PERFIL[0]);
  const [nivel, setNivel] = useState(existente?.nivel || 'leitor');
  const [busy, setBusy] = useState(false);
  const chave = existente?.chave || slugPerfilDoc(label);
  const repetido = !existente && PERFIS_DOCUMENTOS.includes(chave);
  const guardar = async () => {
    setBusy(true);
    try {
      const nv = NIVEIS_PERFIL_DOCS.find(n => n.chave === nivel);
      await guardarPerfilPersonalizadoDocs({ perfil: chave, label, cor, descricao, nivel, paginas: existente ? undefined : [...(PERMISSOES_PADRAO[nv.perfil] || [])] }, actor);
      await auditarDocs(actor, { acao: existente ? 'perfil_alterado' : 'perfil_criado', entidade: 'portal', detalhes: `Perfil «${label.trim()}» (${chave}), nível ${nivel}` });
      toast({ title: existente ? 'Perfil actualizado' : 'Perfil criado', description: existente ? undefined : 'Começa com as páginas do nível base; ajuste-as na matriz e guarde.' });
      onFeito();
    } catch (e) {
      toast({ title: 'Não foi possível guardar o perfil', description: e?.message || String(e), variant: 'destructive' });
    } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-h-[92vh] w-full max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-teal-600" aria-hidden="true" />{existente ? `Editar «${existente.label}»` : 'Novo perfil'}</DialogTitle>
          <DialogDescription>Um perfil próprio tem os poderes de um nível base sobre os documentos e escolhe as páginas que vê.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pp-nome">Nome *</Label>
            <Input id="pp-nome" value={label} onChange={e => setLabel(e.target.value)} maxLength={40} placeholder="ex.: Auditor ANAC" />
            {!existente && label.trim() && <p className={cn('text-sm', repetido ? GD.alerta : GD.meta)}>{repetido ? 'Já existe um perfil com este nome.' : <>Nome técnico: <span className={GD.ref}>{chave}</span></>}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pp-desc">Descrição</Label>
            <Textarea id="pp-desc" value={descricao} onChange={e => setDescricao(e.target.value)} rows={2} maxLength={160} placeholder="ex.: Consulta os manuais certificados durante as auditorias" />
          </div>
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">Nível base (o que pode fazer nos documentos) *</legend>
            {NIVEIS_PERFIL_DOCS.map(n => (
              <label key={n.chave} className={cn('flex cursor-pointer items-start gap-3 rounded-lg border p-2.5 text-sm', GD.borda, nivel === n.chave && 'border-teal-600 ring-1 ring-teal-600')}>
                <input type="radio" name="pp-nivel" className="mt-1" checked={nivel === n.chave} onChange={() => setNivel(n.chave)} />
                <span><span className="block font-medium">{n.label}</span><span className={cn('text-sm', GD.meta)}>{n.descricao}</span></span>
              </label>
            ))}
            <p className={cn('text-sm', GD.meta)}>Administração não é nível de perfis próprios: para administrar o portal dê o perfil Administrador.</p>
          </fieldset>
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">Cor</legend>
            <div className="flex flex-wrap gap-2">
              {CORES_PERFIL.map(c => (
                <button key={c} type="button" onClick={() => setCor(c)} aria-pressed={cor === c} aria-label={`Cor ${c}`}
                  className={cn('h-8 w-8 rounded-full border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600', cor === c ? 'border-slate-900 dark:border-white' : 'border-transparent')}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </fieldset>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onFechar} disabled={busy}>Cancelar</Button>
          <Button onClick={guardar} disabled={busy || !label.trim() || repetido || chave.length < 6}>{busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}{existente ? 'Guardar' : 'Criar perfil'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PerfisPaginas({ admin, actor, altura, utilizadores = [] }) {
  const { toast } = useToast();
  const recarregar = useRecarregarDocs();
  const { data: permissoes, isLoading, isError, refetch } = usePermissoesPortalDocs();
  const [edicao, setEdicao] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dialogo, setDialogo] = useState(null);      // { existente? } — criar ou editar um perfil próprio
  const [apagar, setApagar] = useState(null);
  const usamPerfil = (chave) => utilizadores.filter(u => Array.isArray(u.perfis) && u.perfis.includes(chave)).length;
  const removerPerfil = async (p) => {
    try {
      await apagarPerfilPersonalizadoDocs(p.chave);
      await auditarDocs(actor, { acao: 'perfil_apagado', entidade: 'portal', detalhes: `Perfil «${p.label}» (${p.chave}) apagado` });
      setEdicao(null); recarregar('permissoes');
      toast({ title: 'Perfil apagado' });
    } catch (e) {
      toast({ title: 'Não foi possível apagar', description: e?.message || String(e), variant: 'destructive' });
    } finally { setApagar(null); }
  };
  const base = useMemo(() => Object.fromEntries(PERFIS_PORTAL_DOCS.map(p => [p.chave, permissoes?.[p.chave] || paginasPadrao(p.chave)])), [permissoes]);
  const actual = edicao || base;
  const alterado = JSON.stringify(actual) !== JSON.stringify(base);
  const tem = (perfil, chave) => perfil === 'admin_documentos' ? true : (actual[perfil] || []).includes(chave);
  const alternar = (perfil, chave) => setEdicao(e => {
    const x = { ...(e || base) };
    const set = new Set(x[perfil] || []);
    if (set.has(chave)) set.delete(chave); else set.add(chave);
    x[perfil] = PAGINAS_PORTAL.map(p => p.chave).filter(k => set.has(k));
    return x;
  });
  const guardar = async () => {
    setBusy(true);
    try {
      for (const p of PERFIS_PORTAL_DOCS) await guardarPermissoesPortalDocs(p.chave, actual[p.chave], actor);
      await auditarDocs(actor, { acao: 'permissoes_paginas', entidade: 'portal', detalhes: 'Páginas por perfil do portal alteradas' });
      setEdicao(null);
      recarregar('permissoes');
      toast({ title: 'Permissões guardadas', description: 'Aplicam-se de imediato ao menu e às páginas de cada perfil.' });
    } catch (e) {
      toast({ title: 'Não foi possível guardar', description: e?.message || String(e), variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const consulta = PAGINAS_PORTAL.filter(p => !p.chave.startsWith('gestao'));
  const gestao = PAGINAS_PORTAL.filter(p => p.chave.startsWith('gestao'));
  const colunas = 1 + PERFIS_PORTAL_DOCS.length;

  return (
    <div className="space-y-3">
      <div className={cn('rounded-lg border p-3 text-sm', GD.borda, GD.superficieFraca, GD.tintaMedia)}>
        <p><strong>Como funciona.</strong> Cada perfil vê as páginas marcadas na sua coluna; quem tem vários perfis soma-as. O <strong>administrador de documentos</strong> vê tudo e não se configura. O Início e A minha conta estão sempre disponíveis.</p>
        <p className={cn('mt-1 text-sm', GD.meta)}>Isto esconde páginas, não protege dados: o servidor continua a decidir que documentos cada pessoa recebe. Tirar uma página a um perfil não lhe dá nem lhe tira acesso aos ficheiros.</p>
      </div>
      <Painel>
        <Tabela altura={altura} rotulo="Páginas visíveis por perfil">
          <thead>
            <tr>
              <Th>Página</Th>
              {PERFIS_PORTAL_DOCS.map(p => (
                <Th key={p.chave} className="w-28 text-center">
                  <span className="flex items-center justify-center gap-1.5">
                    {p.personalizado && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.cor || '#475569' }} aria-hidden="true" />}
                    {p.label}
                  </span>
                  <span className={cn('block text-xs font-normal normal-case tracking-normal', GD.meta)}>{p.descricao}</span>
                  {p.personalizado && (
                    <span className="mt-1 flex items-center justify-center gap-1 normal-case tracking-normal">
                      <span className={cn('rounded border px-1 text-[11px] font-medium', GD.borda, GD.tintaMedia)}>nível {NIVEIS_PERFIL_DOCS.find(n => n.chave === p.nivel)?.label.toLowerCase()}</span>
                      {admin && <>
                        <button type="button" onClick={() => setDialogo({ existente: p })} className={cn('rounded p-1', GD.meta, 'hover:text-slate-900 dark:hover:text-white')} aria-label={`Editar o perfil ${p.label}`} title="Editar"><Pencil className="h-3.5 w-3.5" aria-hidden="true" /></button>
                        <button type="button" onClick={() => setApagar(p)} className="rounded p-1 text-red-600 hover:text-red-800 dark:text-red-400" aria-label={`Apagar o perfil ${p.label}`} title="Apagar"><Trash2 className="h-3.5 w-3.5" aria-hidden="true" /></button>
                      </>}
                    </span>
                  )}
                </Th>
              ))}
            </tr>
          </thead>
          {isLoading ? <LinhasEsqueleto linhas={6} colunas={colunas} altura={altura} />
            : isError ? (
              <LinhaMensagem colunas={colunas}>
                <Falha titulo="Não foi possível carregar as páginas por perfil" texto="Enquanto não carregar, valem as predefinições de cada perfil. Tente de novo." onTentar={() => refetch()} />
              </LinhaMensagem>
            ) : (
              <tbody>
                {[{ t: 'Páginas de consulta', itens: consulta }, { t: 'Páginas de gestão', itens: gestao }].map(g => (
                  <React.Fragment key={g.t}>
                    <tr>
                      <td colSpan={colunas} className={cn('border-b px-3 py-1 text-xs font-semibold uppercase tracking-wider', GD.borda, GD.superficieFraca, GD.meta)}>{g.t}</td>
                    </tr>
                    {g.itens.map(p => (
                      <Tr key={p.chave}>
                        <Td>
                          <span className={cn('block font-medium', GD.tinta)}>{p.label}</span>
                          <span className={cn('block text-sm', GD.meta)}>{p.descricao}</span>
                        </Td>
                        {PERFIS_PORTAL_DOCS.map(pf => (
                          <Td key={pf.chave} className="text-center">
                            <Checkbox checked={tem(pf.chave, p.chave)} disabled={!admin || pf.chave === 'admin_documentos'} onCheckedChange={() => alternar(pf.chave, p.chave)} aria-label={`${p.label} — ${pf.label}`} />
                          </Td>
                        ))}
                      </Tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            )}
        </Tabela>
      </Painel>
      {admin ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={guardar} disabled={busy || !alterado}>{busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}Guardar permissões</Button>
          <Button variant="outline" onClick={() => setEdicao(Object.fromEntries(PERFIS_PORTAL_DOCS.map(p => [p.chave, [...paginasPadrao(p.chave)]])))} disabled={busy}>Repor predefinições</Button>
          <Button variant="outline" onClick={() => setDialogo({})} disabled={busy || alterado} title={alterado ? 'Guarde primeiro as alterações à matriz' : undefined}><Plus className="h-4 w-4" aria-hidden="true" />Novo perfil</Button>
          {alterado && <span className={cn('text-sm', GD.alerta)}>Alterações por guardar.</span>}
        </div>
      ) : <p className={cn('text-sm', GD.meta)}>Só administradores do portal alteram as páginas de cada perfil.</p>}
      {dialogo && <DialogPerfilProprio existente={dialogo.existente} actor={actor} onFechar={() => setDialogo(null)} onFeito={() => { setDialogo(null); setEdicao(null); recarregar('permissoes'); }} />}
      {apagar && (usamPerfil(apagar.chave) > 0 ? (
        <ConfirmModal isOpen onClose={() => setApagar(null)} onConfirm={() => setApagar(null)} title={`Não é possível apagar «${apagar.label}»`}
          message={`${usamPerfil(apagar.chave)} pessoa(s) têm este perfil. Tire-lhes o perfil no separador «Utilizadores» (botão «Perfis») e volte a tentar.`} confirmText="Entendido" />
      ) : (
        <ConfirmModal isOpen onClose={() => setApagar(null)} onConfirm={() => removerPerfil(apagar)} title={`Apagar o perfil «${apagar.label}»?`}
          message="Ninguém tem este perfil. Se for usado em pastas ou pedidos de leitura, deixa de ter efeito nesses sítios." confirmText="Apagar" variant="destructive" />
      ))}
    </div>
  );
}

// ── página ──────────────────────────────────────────────────────────────────
export default function PortalAcessos() {
  const { user } = useAuth();
  const { toast } = useToast();
  const recarregar = useRecarregarDocs();
  const admin = ehAdminPortal(user);
  const [params, setParams] = useSearchParams();
  const aba = ABAS.includes(params.get('tab')) ? params.get('tab') : 'pedidos';
  const { data, isLoading, isError, error, refetch, isFetching } = useAcessosDocs();
  const [altura, setAltura] = useDensidade();

  const [busca, setBusca] = useState('');
  const [soPendentes, setSoPendentes] = useState(true);
  const [soActivos, setSoActivos] = useState(true);
  const [filtroPerfil, setFiltroPerfil] = useState('portal');
  const [convidar, setConvidar] = useState(null);
  const [perfisDe, setPerfisDe] = useState(null);
  const [pedidoAcao, setPedidoAcao] = useState(null);
  const [confirmar, setConfirmar] = useState(null);
  const [busy, setBusy] = useState(null);

  const q = busca.trim().toLowerCase();
  const filtra = (campos) => !q || campos.some(v => String(v || '').toLowerCase().includes(q));
  const pedidos = useMemo(() => (data?.pedidos || []).filter(p => (!soPendentes || (p.estado || 'pendente') === 'pendente') && filtra([p.nome, p.email, p.funcao, p.aeroporto])), [data, soPendentes, q]);
  const convites = useMemo(() => (data?.convites || []).filter(c => filtra([c.nome, c.email, c.criado_por])), [data, q]);
  const utilizadores = useMemo(() => (data?.utilizadores || []).filter(u => (!soActivos || u.status === 'ativo') && passaFiltro(u, filtroPerfil) && filtra([u.full_name, u.email, ...(u.perfis || [])])), [data, soActivos, filtroPerfil, q]);

  const pendentes = (data?.pedidos || []).filter(p => (p.estado || 'pendente') === 'pendente').length;
  const activos = (data?.utilizadores || []).filter(u => u.status === 'ativo' && perfisDoPortal(u).length > 0).length;
  const porAceitar = (data?.convites || []).filter(c => !c.aceite_em && !c.cancelado_em).length;
  const nuncaEntraram = (data?.utilizadores || []).filter(u => u.status === 'ativo' && perfisDoPortal(u).length > 0 && !u.ultimo_login).length;
  const degradado = !!data?.degradado;

  const recarregarAcessos = () => { recarregar('acessos'); refetch(); };

  const revogar = async (u) => {
    setBusy(u.id || u.email);
    try {
      await revogarAcessoDocs(u, user);
      await auditarDocs(user, { acao: 'acesso_revogado', entidade: 'utilizador', id: u.id, detalhes: `Acesso ao portal revogado: ${u.email}` });
      toast({ title: 'Acesso revogado', description: `${u.email} deixa de entrar no portal.` });
      recarregarAcessos();
    } catch (e) { toast({ title: 'Não foi possível revogar', description: e?.message || String(e), variant: 'destructive' }); }
    finally { setBusy(null); }
  };
  const excluir = async (u) => {
    setBusy(u.id || u.email);
    try {
      await excluirContaDocs(u, user);
      await auditarDocs(user, { acao: 'conta_excluida', entidade: 'utilizador', id: u.id, detalhes: `Conta do portal excluída: ${u.email}` });
      toast({ title: 'Conta excluída', description: 'O histórico de leituras e de auditoria mantém-se associado ao email.' });
      recarregarAcessos();
    } catch (e) { toast({ title: 'Não foi possível excluir', description: e?.message || String(e), variant: 'destructive' }); }
    finally { setBusy(null); }
  };

  return (
    <PaginaGestao
      titulo="Acessos ao portal"
      descricao="Pedidos de acesso, convites, contas do portal e, por aeroporto, quem aprova e quem vê. Cada alteração fica na auditoria."
      accoes={<>
        <ComutadorDensidade valor={altura} aoMudar={setAltura} />
        <Button variant="outline" onClick={recarregarAcessos} disabled={isFetching}><RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} aria-hidden="true" />Actualizar</Button>
        <Button onClick={() => setConvidar({ email: '' })}><UserPlus className="h-4 w-4" aria-hidden="true" />Convidar</Button>
      </>}
    >
      {degradado && (
        <div role="status" className={cn('flex items-start gap-2 rounded-lg border p-3 text-sm', GD.avisoSuave)}>
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><span>Modo limitado: o serviço de acessos respondeu só em parte. Pode ver as listas e alterar perfis; aprovar, convidar e revogar ficam disponíveis quando o serviço estiver completo.</span>
        </div>
      )}
      {isError && (
        <div role="alert" className={cn('flex items-start gap-2 rounded-lg border p-3 text-sm', GD.avisoSuave)}>
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error?.message || 'Não foi possível falar com o serviço de acessos.'} Os separadores «Aeroportos» e «Perfis e páginas» continuam a funcionar, porque lêem directamente a base de dados.</span>
        </div>
      )}

      {!isError && (
        <TiraIndicadores
          carregando={isLoading}
          itens={[
            { chave: 'pedidos', label: 'Pedidos pendentes', valor: pendentes, tom: 'alerta', to: `?tab=pedidos`, zero: 'Nenhum pedido de acesso à espera' },
            { chave: 'convites', label: 'Convites por aceitar', valor: porAceitar, tom: 'neutro', to: `?tab=convites`, zero: 'Nenhum convite pendente' },
            { chave: 'nunca', label: 'Nunca entraram', valor: nuncaEntraram, tom: 'alerta', sufixo: 'têm acesso mas ainda não usaram', to: `?tab=utilizadores`, zero: null },
            { chave: 'activos', label: 'Com acesso ao portal', valor: activos, tom: 'neutro', sempre: true, to: `?tab=utilizadores` },
          ]}
          nota={`${(data?.utilizadores || []).length} conta(s) listada(s)`}
        />
      )}

      <div className="relative max-w-xl">
        <Search className={cn('pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2', GD.meta)} aria-hidden="true" />
        <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Procurar por nome, email, função…" className="pl-9" aria-label="Procurar nos pedidos, convites e contas" />
      </div>

      <Tabs value={aba} onValueChange={(t) => setParams({ tab: t }, { replace: true })}>
        <TabsList className="h-auto w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="pedidos" className="gap-1.5 py-1.5">Pedidos{pendentes ? <span className="rounded-full bg-amber-500 px-1.5 text-xs font-semibold text-white">{pendentes}</span> : null}</TabsTrigger>
          <TabsTrigger value="convites" className="gap-1.5 py-1.5">Convites</TabsTrigger>
          <TabsTrigger value="utilizadores" className="gap-1.5 py-1.5">Utilizadores</TabsTrigger>
          <TabsTrigger value="aeroportos" className="gap-1.5 py-1.5"><Building2 className="h-4 w-4" aria-hidden="true" />Aeroportos</TabsTrigger>
          <TabsTrigger value="perfis" className="gap-1.5 py-1.5"><ShieldCheck className="h-4 w-4" aria-hidden="true" />Perfis e páginas</TabsTrigger>
        </TabsList>

        {/* ── pedidos ── */}
        <TabsContent value="pedidos" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-sm"><Switch checked={soPendentes} onCheckedChange={setSoPendentes} />Só pendentes</label>
            <p className={cn('text-sm tabular-nums', GD.tintaMedia)}>{pedidos.length} pedido{pedidos.length === 1 ? '' : 's'} à vista</p>
          </div>
          <Painel>
            <Tabela altura={altura} rotulo="Pedidos de acesso">
              <thead>
                <tr>
                  <Th>Requerente</Th>
                  <Th className="hidden md:table-cell">Função / aeroporto</Th>
                  <Th>Pedido</Th>
                  <Th>Estado</Th>
                  <Th numerico>Acções</Th>
                </tr>
              </thead>
              {isLoading ? <LinhasEsqueleto linhas={4} colunas={5} altura={altura} />
                : isError ? (
                  <LinhaMensagem colunas={5}>
                    <Falha titulo="Pedidos indisponíveis" texto={`${error?.message || 'O serviço de acessos não respondeu.'} Tente de novo; se persistir, avise quem administra o servidor.`} onTentar={recarregarAcessos} />
                  </LinhaMensagem>
                ) : pedidos.length === 0 ? (
                  <LinhaMensagem colunas={5}>
                    <Vazio icone={UserPlus} titulo={soPendentes ? 'Não há pedidos pendentes' : 'Sem pedidos'} texto={q ? 'Nenhum pedido corresponde à procura. Limpe a caixa de pesquisa.' : 'Os pedidos feitos na página de entrada do portal aparecem aqui para aprovar ou rejeitar.'} className="py-8">
                      {soPendentes && <Button variant="outline" size="sm" onClick={() => setSoPendentes(false)}>Ver também os já respondidos</Button>}
                    </Vazio>
                  </LinhaMensagem>
                ) : (
                  <tbody>
                    {pedidos.map(p => {
                      const estado = p.estado || 'pendente';
                      return (
                        <Tr key={p.id}>
                          <Td className="max-w-[18rem]">
                            <span className={cn('block truncate font-medium', GD.tinta)}>{p.nome || p.email}</span>
                            <span className={cn('block truncate text-sm', GD.meta)}>{p.email}</span>
                          </Td>
                          <Td className={cn('hidden max-w-[18rem] text-sm md:table-cell', GD.meta)}>
                            <span className="block truncate">{[p.funcao, p.aeroporto].filter(Boolean).join(' · ') || '—'}</span>
                            {p.motivo && <span className="block truncate italic">«{p.motivo}»</span>}
                          </Td>
                          <Td className={cn('text-sm tabular-nums', GD.meta)}>{fmtData(p.created_date)}</Td>
                          <Td><Etiqueta cor={estado === 'pendente' ? 'amber' : estado === 'aprovado' ? 'emerald' : 'slate'}>{estado === 'pendente' ? 'Pendente' : estado === 'aprovado' ? 'Aprovado' : 'Rejeitado'}</Etiqueta></Td>
                          <Td>
                            {estado === 'pendente' ? (
                              <AccoesLinha destrutivas={<Button size="sm" variant="ghost" className={GD.perigo} onClick={() => setPedidoAcao({ pedido: p, acao: 'rejeitar' })}><UserX className="h-4 w-4" aria-hidden="true" />Rejeitar</Button>}>
                                <Button size="sm" onClick={() => setPedidoAcao({ pedido: p, acao: 'aprovar' })}><UserCheck className="h-4 w-4" aria-hidden="true" />Aprovar</Button>
                              </AccoesLinha>
                            ) : <span className={cn('block text-right text-sm', GD.meta)}>—</span>}
                          </Td>
                        </Tr>
                      );
                    })}
                  </tbody>
                )}
            </Tabela>
          </Painel>
        </TabsContent>

        {/* ── convites ── */}
        <TabsContent value="convites" className="mt-4 space-y-3">
          <Painel>
            <Tabela altura={altura} rotulo="Convites enviados">
              <thead>
                <tr>
                  <Th>Convidado</Th>
                  <Th className="hidden sm:table-cell">Enviado</Th>
                  <Th>Validade</Th>
                  <Th>Estado</Th>
                  <Th numerico>Acções</Th>
                </tr>
              </thead>
              {isLoading ? <LinhasEsqueleto linhas={4} colunas={5} altura={altura} />
                : isError ? (
                  <LinhaMensagem colunas={5}>
                    <Falha titulo="Convites indisponíveis" texto={`${error?.message || 'O serviço de acessos não respondeu.'} Tente de novo.`} onTentar={recarregarAcessos} />
                  </LinhaMensagem>
                ) : convites.length === 0 ? (
                  <LinhaMensagem colunas={5}>
                    <Vazio icone={Mail} titulo={q ? 'Nenhum convite corresponde à procura' : 'Ainda não foram enviados convites'} texto={q ? 'Limpe a caixa de pesquisa para ver todos.' : 'Convide quem precisa de consultar os documentos e não tem conta.'} className="py-8">
                      <Button onClick={() => setConvidar({ email: '' })}><UserPlus className="h-4 w-4" aria-hidden="true" />Convidar</Button>
                    </Vazio>
                  </LinhaMensagem>
                ) : (
                  <tbody>
                    {convites.map(c => {
                      const aceite = !!c.aceite_em;
                      const expirado = !aceite && c.expira_em && new Date(c.expira_em).getTime() < Date.now();
                      return (
                        <Tr key={c.id || c.email}>
                          <Td className="max-w-[18rem]">
                            <span className={cn('block truncate font-medium', GD.tinta)}>{c.nome || c.email}</span>
                            <span className={cn('block truncate text-sm', GD.meta)}>{c.email}</span>
                          </Td>
                          <Td className={cn('hidden text-sm sm:table-cell', GD.meta)}>
                            <span className="block">{c.enviado === false ? <span className={GD.alerta}>não entregue</span> : fmtData(c.enviado_em || c.criado_em)}</span>
                            <span className="block truncate">por {c.criado_por || '—'}</span>
                          </Td>
                          <Td className={cn('text-sm tabular-nums', GD.meta)}>{fmtData(c.expira_em)}</Td>
                          <Td><Etiqueta cor={aceite ? 'emerald' : c.cancelado_em ? 'slate' : expirado ? 'amber' : 'slate'}>{aceite ? 'Aceite' : c.cancelado_em ? 'Cancelado' : expirado ? 'Expirado' : 'Por aceitar'}</Etiqueta></Td>
                          <Td>
                            <AccoesLinha>
                              {!aceite && <Button size="sm" variant="outline" onClick={() => setConvidar({ email: c.email })}><Mail className="h-4 w-4" aria-hidden="true" />Convidar de novo</Button>}
                            </AccoesLinha>
                          </Td>
                        </Tr>
                      );
                    })}
                  </tbody>
                )}
            </Tabela>
          </Painel>
          <p className={cn('text-sm', GD.meta)}>«Convidar de novo» gera um endereço novo (de uso único) e substitui o anterior. Para endereços externos copie-o e envie-o pelo seu próprio email: o relay da SGA só entrega a @sga.co.ao.</p>
        </TabsContent>

        {/* ── utilizadores ── */}
        <TabsContent value="utilizadores" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-60"><Select options={FILTRO_PERFIS} value={filtroPerfil} onValueChange={setFiltroPerfil} /></div>
            <label className="flex items-center gap-2 text-sm"><Switch checked={soActivos} onCheckedChange={setSoActivos} />Só activos</label>
            <p className={cn('ml-auto text-sm tabular-nums', GD.tintaMedia)}>{utilizadores.length} conta{utilizadores.length === 1 ? '' : 's'} à vista</p>
          </div>
          <Painel>
            <Tabela altura={altura} rotulo="Contas do portal">
              <thead>
                <tr>
                  <Th>Utilizador</Th>
                  <Th className="hidden sm:table-cell">Perfis do portal</Th>
                  <Th>Estado</Th>
                  <Th className="hidden lg:table-cell">Último acesso</Th>
                  <Th numerico>Acções</Th>
                </tr>
              </thead>
              {isLoading ? <LinhasEsqueleto linhas={6} colunas={5} altura={altura} />
                : isError ? (
                  <LinhaMensagem colunas={5}>
                    <Falha titulo="Utilizadores indisponíveis" texto={`${error?.message || 'O serviço de acessos não respondeu.'} Tente de novo.`} onTentar={recarregarAcessos} />
                  </LinhaMensagem>
                ) : utilizadores.length === 0 ? (
                  <LinhaMensagem colunas={5}>
                    <Vazio icone={UserCheck} titulo="Sem contas com estes filtros" texto="Mude o filtro de perfis, desligue «Só activos» ou limpe a procura." className="py-8">
                      <Button variant="outline" size="sm" onClick={() => { setFiltroPerfil('todos'); setSoActivos(false); setBusca(''); }}>Ver todas as contas</Button>
                    </Vazio>
                  </LinhaMensagem>
                ) : (
                  <tbody>
                    {utilizadores.map(u => {
                      const eu = String(u.email || '').toLowerCase() === String(user?.email || '').toLowerCase();
                      const global = contaGlobal(u);
                      const perfis = perfisDoPortal(u);
                      const nivel = perfisPortal(u);
                      const ocupado = busy === (u.id || u.email);
                      return (
                        <Tr key={u.id || u.email}>
                          <Td className="max-w-[18rem]">
                            <span className={cn('block truncate font-medium', GD.tinta)}>{u.full_name || u.email}</span>
                            <span className={cn('block truncate text-sm', GD.meta)}>{u.email}</span>
                          </Td>
                          <Td className="hidden max-w-[16rem] text-sm sm:table-cell">
                            {perfis.length
                              ? <span className="flex flex-wrap gap-1">{perfis.map(p => <span key={p} className={cn('rounded px-1.5 py-0.5', GD.superficieFraca, GD.tintaMedia)}>{PERFIL_DOC_LABEL[p] || p}</span>)}</span>
                              : <span className={GD.meta}>sem perfis do portal</span>}
                            {global && <span className="mt-1 block"><Etiqueta cor="amber">conta global</Etiqueta></span>}
                          </Td>
                          <Td>
                            <Etiqueta cor={u.status === 'ativo' ? 'emerald' : u.status === 'pendente' ? 'amber' : 'slate'}>{u.status === 'ativo' ? 'Activa' : u.status === 'pendente' ? 'Pendente' : 'Inactiva'}</Etiqueta>
                            {!nivel.membro && !global && <span className={cn('mt-0.5 block text-xs', GD.meta)}>sem acesso ao portal</span>}
                          </Td>
                          <Td className={cn('hidden text-sm tabular-nums lg:table-cell', GD.meta)}>{u.ultimo_login ? fmtDataHora(u.ultimo_login) : <span className={GD.alerta}>nunca entrou</span>}</Td>
                          <Td>
                            {global ? (
                              <span className={cn('flex items-start justify-end gap-1 text-right text-xs', GD.meta)}>
                                <ShieldCheck className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', GD.alerta)} aria-hidden="true" />
                                <span className="max-w-[18rem]">Conta global do dono do sistema: não se revoga, não se exclui e não se despromove no portal.</span>
                              </span>
                            ) : admin ? (
                              <AccoesLinha
                                destrutivas={
                                  <Button size="sm" variant="ghost" className={GD.perigo} disabled={ocupado || eu}
                                    title={eu ? 'Não pode excluir a sua própria conta' : 'Excluir a conta do portal'}
                                    onClick={() => setConfirmar({ t: 'Excluir conta', m: `Excluir a conta de ${u.email}? A conta do portal é removida. As confirmações de leitura e os registos de auditoria continuam associados ao email. Para uma suspensão temporária use «Revogar».`, f: () => excluir(u) })}>
                                    <Trash2 className="h-4 w-4" aria-hidden="true" />Excluir
                                  </Button>
                                }
                              >
                                <Button size="sm" variant="outline" onClick={() => setPerfisDe(u)}><UserCog className="h-4 w-4" aria-hidden="true" />Perfis</Button>
                                {u.status === 'ativo' && (
                                  <Button size="sm" variant="outline" disabled={ocupado || eu}
                                    title={eu ? 'Não pode revogar o seu próprio acesso' : undefined}
                                    onClick={() => setConfirmar({ t: 'Revogar acesso', m: `Revogar o acesso de ${u.email} ao Portal de Documentos? Deixa de entrar até ser convidado de novo. O histórico mantém-se.`, f: () => revogar(u) })}>
                                    {ocupado ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Ban className="h-4 w-4" aria-hidden="true" />}Revogar
                                  </Button>
                                )}
                              </AccoesLinha>
                            ) : <span className={cn('block text-right text-sm', GD.meta)}>—</span>}
                          </Td>
                        </Tr>
                      );
                    })}
                  </tbody>
                )}
            </Tabela>
          </Painel>
          {!admin && <p className={cn('text-sm', GD.meta)}>Alterar perfis, revogar e excluir contas é reservado a administradores do portal.</p>}
        </TabsContent>

        {/* ── aeroportos ── */}
        <TabsContent value="aeroportos" className="mt-4">
          <Aeroportos admin={admin} utilizadores={data?.utilizadores || []} altura={altura} actor={user} aoConvidar={(email) => setConvidar({ email })} />
        </TabsContent>

        <TabsContent value="perfis" className="mt-4"><PerfisPaginas admin={admin} actor={user} altura={altura} utilizadores={data?.utilizadores || []} /></TabsContent>
      </Tabs>

      {convidar && <DialogConvidar emailInicial={convidar.email} onFechar={() => setConvidar(null)} onFeito={recarregarAcessos} />}
      {perfisDe && <DialogPerfis u={perfisDe} actor={user} onFechar={() => setPerfisDe(null)} onFeito={() => { setPerfisDe(null); recarregarAcessos(); }} />}
      {pedidoAcao && <DialogPedido pedido={pedidoAcao.pedido} acao={pedidoAcao.acao} onFechar={() => setPedidoAcao(null)} onFeito={() => { setPedidoAcao(null); recarregarAcessos(); }} />}
      <ConfirmModal isOpen={!!confirmar} onClose={() => setConfirmar(null)} onConfirm={() => confirmar?.f?.()} title={confirmar?.t} message={confirmar?.m} confirmText={confirmar?.t} variant="destructive" />
    </PaginaGestao>
  );
}
