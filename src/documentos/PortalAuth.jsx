// Entrada do Portal de Documentos: entrar, pedir acesso, recuperar senha, aceitar convite (criar senha) e definir
// nova senha. Páginas públicas (sem sessão). Molde: src/universidade/PortalAuth.jsx.
// Regras próprias: as mensagens nunca dizem se um email tem ou não conta no portal, e nada do DIROPS aparece aqui.
import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Eye, EyeOff, Mail, Lock, ArrowLeft, CheckCircle2, FolderLock, Library, FileCheck2, Stamp, UserPlus, KeyRound, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase, GD_ISOLADO } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { logAuthEvent } from '@/lib/auditLog';
import { PORTAL_BASE, destinoSeguro } from '@/lib/portalDocumentos';
import { docsAcesso } from './api';

const NOME_PADRAO = 'Documentos SGA';
const SLOGAN_PADRAO = 'Manuais, procedimentos e normas dos aeroportos da SGA.';
const DOMINIOS_INTERNOS = ['sga.co.ao'];

// ── validações locais (o portal é independente: não importa nada da Universidade nem do DIROPS) ───────────────
const emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || '').trim());
const dominioDe = (e) => String(e || '').trim().toLowerCase().split('@')[1] || '';
function normalizarDominios(entrada) {
  const partes = Array.isArray(entrada) ? entrada : String(entrada || '').split(/[,;\s\n]+/);
  const out = [];
  for (const p of partes) {
    const d = String(p || '').trim().toLowerCase().replace(/^@/, '').replace(/\/+$/, '');
    if (d && /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d) && !out.includes(d)) out.push(d);
  }
  return out;
}
// lista vazia = qualquer domínio; subdomínios contam (x.sga.co.ao ∈ sga.co.ao)
function dominioPermitido(email, dominios) {
  const lista = normalizarDominios(dominios);
  if (!lista.length) return true;
  const d = dominioDe(email);
  return lista.some(x => d === x || d.endsWith('.' + x));
}
const emailInterno = (e) => !!dominioDe(e) && dominioPermitido(e, DOMINIOS_INTERNOS);
const mailtoDe = (e) => (emailValido(e) ? `mailto:${String(e).trim().toLowerCase()}` : 'mailto:');
function validarSenha(pw) {
  const p = String(pw || '');
  const faltas = [];
  if (p.length < 8) faltas.push('pelo menos 8 caracteres');
  if (!/[A-Z]/.test(p)) faltas.push('uma letra maiúscula');
  if (!/[0-9]/.test(p)) faltas.push('um número');
  return { ok: faltas.length === 0, mensagem: faltas.length ? `A senha precisa de ${faltas.join(', ')}.` : '' };
}
function validarPedido({ nome, email, motivo } = {}, cfg = {}) {
  const erros = {};
  if (String(nome || '').trim().length < 3) erros.nome = 'Indique o seu nome completo.';
  if (!emailValido(email)) erros.email = 'Indique um email válido.';
  else if (!dominioPermitido(email, cfg.dominios_permitidos)) erros.email = `Só são aceites pedidos com email de: ${normalizarDominios(cfg.dominios_permitidos).map(d => '@' + d).join(', ')}.`;
  if (String(motivo || '').length > 1000) erros.motivo = 'Máximo 1000 caracteres.';
  return { ok: Object.keys(erros).length === 0, erros };
}

// Configuração visível sem sessão (vista documentos_config_publica, migração 135). Falha em silêncio: a página
// funciona com os valores de recurso.
function useConfigPublicaDocs() {
  return useQuery({
    queryKey: ['gd', 'config-publica'],
    retry: 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from('documentos_config_publica').select('*').maybeSingle();
      return data || {};
    },
  });
}

// Travão simples de tentativas no próprio navegador (o servidor tem o seu).
function useLimitador(max = 5, janelaMs = 60000) {
  const ref = useRef([]);
  return () => {
    const agora = Date.now();
    ref.current = ref.current.filter(t => agora - t < janelaMs);
    if (ref.current.length >= max) return Math.ceil((janelaMs - (agora - ref.current[0])) / 1000);
    ref.current.push(agora); return 0;
  };
}

// Erros em português claro. A entrada falhada diz sempre a mesma coisa, aconteça o que acontecer: não revelamos se
// o email tem conta.
function erroEntrada(msg) {
  const m = String(msg || '').toLowerCase();
  if (GD_ISOLADO && /\b404\b|unexpected token|not valid json|<!doctype/i.test(m)) return 'O serviço de entrada do portal não está disponível neste momento. Tente mais tarde ou contacte o apoio.';
  if (/network|failed to fetch|fetch failed|load failed/.test(m)) return 'Não foi possível falar com o servidor. Verifique a ligação à rede e tente novamente.';
  if (/rate limit|too many requests|429/.test(m)) return 'Demasiadas tentativas. Aguarde um momento e tente novamente.';
  if (/banned|suspend/.test(m)) return 'Este acesso está suspenso. Fale com o apoio do portal.';
  return 'Email ou senha incorrectos. Confirme os dados e tente novamente.';
}

const campo = 'h-11 bg-white dark:bg-slate-950';
const botao = 'h-11 w-full bg-teal-700 hover:bg-teal-800 focus-visible:ring-teal-500';

function Erro({ children }) {
  if (!children) return null;
  return <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><span>{children}</span></div>;
}
function Sucesso({ titulo, children, accao }) {
  return (
    <div className="space-y-4 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/60"><CheckCircle2 className="h-7 w-7 text-emerald-600" aria-hidden="true" /></div>
      <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{titulo}</h2>
      <div className="text-sm text-slate-600 dark:text-slate-400">{children}</div>
      {accao}
    </div>
  );
}
function CampoSenha({ id, value, onChange, label = 'Senha', autoComplete = 'current-password', mostrar, setMostrar }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <Input id={id} type={mostrar ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)} required autoComplete={autoComplete} className={`${campo} pl-9 pr-11`} />
        <button type="button" onClick={() => setMostrar(v => !v)} className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" aria-label={mostrar ? 'Esconder a senha' : 'Mostrar a senha'}>
          {mostrar ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}

// ── entrar ─────────────────────────────────────────────────────────────────────────────────────────────────────
function FormEntrar({ next, cfg }) {
  const [email, setEmail] = useState(''); const [senha, setSenha] = useState(''); const [mostrar, setMostrar] = useState(false);
  const [aCarregar, setACarregar] = useState(false); const [erro, setErro] = useState(null);
  const limitar = useLimitador(5, 60000);
  const submeter = async (e) => {
    e.preventDefault();
    const espera = limitar(); if (espera) { setErro(`Demasiadas tentativas. Aguarde ${espera} s antes de tentar outra vez.`); return; }
    setACarregar(true); setErro(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
      if (error) { logAuthEvent('login_falha', email.trim(), error.message, 'Documentos'); setErro(erroEntrada(error.message)); setACarregar(false); return; }
      logAuthEvent('login', email.trim(), 'Início de sessão no Portal de Documentos', 'Documentos');
      window.location.replace(next);
    } catch (err) { setErro(erroEntrada(err?.message)); setACarregar(false); }
  };
  return (
    <form onSubmit={submeter} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="gd-email">Email</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <Input id="gd-email" type="email" inputMode="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} className={`${campo} pl-9`} placeholder="nome@sga.co.ao" />
        </div>
      </div>
      <CampoSenha id="gd-senha" value={senha} onChange={setSenha} mostrar={mostrar} setMostrar={setMostrar} />
      <Erro>{erro}</Erro>
      <Button type="submit" className={botao} disabled={aCarregar || !email || !senha}>
        {aCarregar ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FolderLock className="h-4 w-4" aria-hidden="true" />}Entrar nos documentos
      </Button>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <Link to={`${PORTAL_BASE}/recuperar`} className="text-teal-700 hover:underline dark:text-teal-300">Esqueci a senha</Link>
        {cfg?.registo_aberto !== false && <Link to={`${PORTAL_BASE}/pedir-acesso`} className="font-medium text-teal-700 hover:underline dark:text-teal-300">Ainda não tem acesso? Peça aqui</Link>}
      </div>
    </form>
  );
}

// ── pedir acesso ───────────────────────────────────────────────────────────────────────────────────────────────
function FormPedir({ cfg }) {
  const [f, setF] = useState({ nome: '', email: '', empresa: 'SGA — Sociedade Gestora de Aeroportos', departamento: '', funcao: '', aeroporto: '', telefone: '', chefia: '', motivo: '' });
  const [erros, setErros] = useState({}); const [erro, setErro] = useState(null); const [aCarregar, setACarregar] = useState(false); const [resultado, setResultado] = useState(null);
  const set = (k) => (e) => setF(v => ({ ...v, [k]: e.target.value }));
  const dominios = normalizarDominios(cfg?.dominios_permitidos);
  const submeter = async (e) => {
    e.preventDefault();
    const v = validarPedido(f, cfg || {}); setErros(v.erros); if (!v.ok) return;
    setACarregar(true); setErro(null);
    try { setResultado(await docsAcesso('pedir', { ...f })); } catch (err) { setErro(err.message); } finally { setACarregar(false); }
  };
  // Resposta sempre neutra: quer o email já tenha conta, quer não, o texto é o mesmo.
  if (resultado?.aprovado_automaticamente) {
    return (
      <Sucesso titulo="Acesso aprovado" accao={<Button asChild variant="outline"><Link to={`${PORTAL_BASE}/login`}><ArrowLeft className="h-4 w-4" aria-hidden="true" />Ir para a entrada</Link></Button>}>
        <p>{resultado.email_enviado === false
          ? <>O acesso foi aprovado, mas não conseguimos enviar o email. Fale com {cfg?.email_suporte || 'o apoio do portal'} para receber o link de criação da senha.</>
          : <>Enviámos para <strong>{f.email}</strong> um email com um botão para criar a sua senha. Veja também a pasta de correio não solicitado.</>}</p>
      </Sucesso>
    );
  }
  if (resultado) {
    return (
      <Sucesso titulo="Pedido recebido" accao={<Button asChild variant="outline"><Link to={`${PORTAL_BASE}/login`}><ArrowLeft className="h-4 w-4" aria-hidden="true" />Voltar à entrada</Link></Button>}>
        <p>Um gestor documental vai analisar o pedido. Se o acesso for aprovado, recebe um email com um convite para criar a senha.</p>
        <p className="mt-2">Se este email já tiver acesso ao portal, pode <Link to={`${PORTAL_BASE}/login`} className="text-teal-700 underline dark:text-teal-300">entrar directamente</Link> ou <Link to={`${PORTAL_BASE}/recuperar`} className="text-teal-700 underline dark:text-teal-300">pedir uma nova senha</Link>.</p>
        {!emailInterno(f.email) && <p className="mt-2 text-amber-700 dark:text-amber-300">Como o email não é da SGA, o convite pode ter de lhe ser entregue por outro meio — o gestor tem o link.</p>}
      </Sucesso>
    );
  }
  return (
    <form onSubmit={submeter} className="space-y-4" noValidate>
      {cfg?.registo_aberto === false && <Erro>Os pedidos de acesso estão fechados. Fale com {cfg?.email_suporte || 'o apoio do portal'} para receber um convite.</Erro>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="gd-p-nome">Nome completo *</Label>
          <Input id="gd-p-nome" value={f.nome} onChange={set('nome')} required autoComplete="name" className={campo} />
          {erros.nome && <p className="text-xs text-red-600 dark:text-red-400">{erros.nome}</p>}
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="gd-p-email">Email *</Label>
          <Input id="gd-p-email" type="email" inputMode="email" value={f.email} onChange={set('email')} required autoComplete="email" className={campo} placeholder={dominios.length ? `nome@${dominios[0]}` : 'nome@empresa.com'} />
          {erros.email ? <p className="text-xs text-red-600 dark:text-red-400">{erros.email}</p> : dominios.length > 0 && <p className="text-xs text-slate-500 dark:text-slate-400">Aceitam-se emails de: {dominios.map(d => '@' + d).join(', ')}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gd-p-empresa">Empresa / entidade</Label>
          <Input id="gd-p-empresa" value={f.empresa} onChange={set('empresa')} autoComplete="organization" className={campo} list="gd-empresas" />
          <datalist id="gd-empresas"><option value="SGA — Sociedade Gestora de Aeroportos" /></datalist>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gd-p-dep">Departamento / área</Label>
          <Input id="gd-p-dep" value={f.departamento} onChange={set('departamento')} className={campo} placeholder="ex.: Qualidade, Manutenção" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gd-p-func">Função / cargo</Label>
          <Input id="gd-p-func" value={f.funcao} onChange={set('funcao')} autoComplete="organization-title" className={campo} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gd-p-aero">Aeroporto / local de trabalho</Label>
          <Input id="gd-p-aero" value={f.aeroporto} onChange={set('aeroporto')} className={campo} placeholder="ex.: FNLU — Luanda" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gd-p-tel">Telefone</Label>
          <Input id="gd-p-tel" type="tel" inputMode="tel" value={f.telefone} onChange={set('telefone')} autoComplete="tel" className={campo} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gd-p-chefia">Responsável directo (nome e email)</Label>
          <Input id="gd-p-chefia" value={f.chefia} onChange={set('chefia')} className={campo} placeholder="ex.: Ana Silva — ana.silva@sga.co.ao" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="gd-p-motivo">Que documentos precisa de consultar?</Label>
          <Textarea id="gd-p-motivo" value={f.motivo} onChange={set('motivo')} rows={3} maxLength={1000} className="bg-white dark:bg-slate-950" placeholder="Manuais, procedimentos ou normas de que aeroporto, e para quê." />
          {erros.motivo && <p className="text-xs text-red-600 dark:text-red-400">{erros.motivo}</p>}
        </div>
      </div>
      <Erro>{erro}</Erro>
      <Button type="submit" className={botao} disabled={aCarregar || cfg?.registo_aberto === false}>
        {aCarregar ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <UserPlus className="h-4 w-4" aria-hidden="true" />}Pedir acesso
      </Button>
      <p className="text-center text-sm"><Link to={`${PORTAL_BASE}/login`} className="inline-flex items-center gap-1 text-slate-600 hover:underline dark:text-slate-300"><ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />Já tenho acesso</Link></p>
    </form>
  );
}

// ── recuperar senha ────────────────────────────────────────────────────────────────────────────────────────────
function FormRecuperar({ cfg }) {
  const [email, setEmail] = useState(''); const [aCarregar, setACarregar] = useState(false); const [erro, setErro] = useState(null); const [enviado, setEnviado] = useState(false);
  const limitar = useLimitador(3, 60000);
  const submeter = async (e) => {
    e.preventDefault();
    if (!emailValido(email)) { setErro('Indique um email válido.'); return; }
    // O relay da SGA só entrega a endereços internos — isto é uma limitação do email, não uma pista sobre contas.
    if (!emailInterno(email)) { setErro(`O servidor de email da SGA só entrega a endereços @sga.co.ao. Peça a reposição da senha a ${cfg?.email_suporte || 'um gestor documental'}.`); return; }
    const espera = limitar(); if (espera) { setErro(`Demasiados pedidos. Aguarde ${espera} s antes de tentar outra vez.`); return; }
    setACarregar(true); setErro(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}${PORTAL_BASE}/alterar-senha` });
    setACarregar(false);
    // Mesmo com erro do servidor de email não dizemos nada sobre a conta; só problemas de ligação são mostrados.
    if (error && /network|failed to fetch|fetch failed|rate limit|too many requests/i.test(String(error.message || ''))) { setErro(erroEntrada(error.message)); return; }
    logAuthEvent('recuperacao_senha', email.trim(), 'Pedido de reposição de senha (Portal de Documentos)', 'Documentos');
    setEnviado(true);
  };
  if (enviado) {
    return (
      <Sucesso titulo="Veja o seu email" accao={<Button asChild variant="outline"><Link to={`${PORTAL_BASE}/login`}><ArrowLeft className="h-4 w-4" aria-hidden="true" />Voltar à entrada</Link></Button>}>
        <p>Se existir uma conta ligada a <strong>{email}</strong>, chega-lhe um email com um link para definir uma nova senha. O link é válido por pouco tempo; veja também a pasta de correio não solicitado.</p>
      </Sucesso>
    );
  }
  return (
    <form onSubmit={submeter} className="space-y-4" noValidate>
      <p className="text-sm text-slate-600 dark:text-slate-400">Indique o email da sua conta. Enviamos-lhe um link para definir uma nova senha.</p>
      <div className="space-y-1.5">
        <Label htmlFor="gd-r-email">Email</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <Input id="gd-r-email" type="email" inputMode="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} className={`${campo} pl-9`} />
        </div>
      </div>
      <Erro>{erro}</Erro>
      <Button type="submit" className={botao} disabled={aCarregar || !email}>
        {aCarregar ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <KeyRound className="h-4 w-4" aria-hidden="true" />}Enviar link de reposição
      </Button>
      <p className="text-center text-sm"><Link to={`${PORTAL_BASE}/login`} className="inline-flex items-center gap-1 text-slate-600 hover:underline dark:text-slate-300"><ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />Voltar à entrada</Link></p>
    </form>
  );
}

// ── aceitar convite (criar a primeira senha) ───────────────────────────────────────────────────────────────────
function FormConvite({ token, cfg }) {
  const [estado, setEstado] = useState({ aVerificar: true });
  const [nome, setNome] = useState(''); const [senha, setSenha] = useState(''); const [confirmar, setConfirmar] = useState(''); const [mostrar, setMostrar] = useState(false);
  const [aCarregar, setACarregar] = useState(false); const [erro, setErro] = useState(null); const [feito, setFeito] = useState(false);
  useEffect(() => {
    let vivo = true;
    if (!token) { setEstado({ valido: false, motivo: 'Falta o código do convite. Abra o link tal como o recebeu no email.', aVerificar: false }); return undefined; }
    docsAcesso('verificar', { token })
      .then(r => { if (!vivo) return; setEstado({ ...r, aVerificar: false }); if (r?.nome) setNome(r.nome); })
      .catch(e => { if (vivo) setEstado({ valido: false, motivo: e.message, aVerificar: false }); });
    return () => { vivo = false; };
  }, [token]);
  const submeter = async (e) => {
    e.preventDefault();
    const v = validarSenha(senha); if (!v.ok) { setErro(v.mensagem); return; }
    if (senha !== confirmar) { setErro('As duas senhas não são iguais.'); return; }
    setACarregar(true); setErro(null);
    try {
      const r = await docsAcesso('aceitar', { token, password: senha, nome: nome.trim() });
      const emailConta = r?.email || estado.email;
      const { error } = await supabase.auth.signInWithPassword({ email: emailConta, password: senha });
      if (error) { setFeito(true); return; }
      logAuthEvent('login', emailConta, 'Primeiro acesso ao Portal de Documentos (convite aceite)', 'Documentos');
      window.location.replace(PORTAL_BASE);
    } catch (err) { setErro(err.message); setACarregar(false); }
  };
  if (estado.aVerificar) return <p className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500 dark:text-slate-400" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />A verificar o convite…</p>;
  if (!estado.valido) {
    return (
      <div className="space-y-4">
        <Erro>{estado.motivo || 'Este convite já não é válido.'}</Erro>
        <div className="flex flex-wrap gap-2">
          <Button asChild className="bg-teal-700 hover:bg-teal-800"><Link to={`${PORTAL_BASE}/login`}>Entrar</Link></Button>
          <Button asChild variant="outline"><Link to={`${PORTAL_BASE}/recuperar`}>Esqueci a senha</Link></Button>
          {cfg?.registo_aberto !== false && <Button asChild variant="outline"><Link to={`${PORTAL_BASE}/pedir-acesso`}>Pedir um novo acesso</Link></Button>}
        </div>
        {cfg?.email_suporte && <p className="text-sm text-slate-500 dark:text-slate-400">Precisa de ajuda? Escreva para <a href={mailtoDe(cfg.email_suporte)} className="underline">{cfg.email_suporte}</a>.</p>}
      </div>
    );
  }
  if (feito) {
    return (
      <Sucesso titulo="Senha criada" accao={<Button asChild className="bg-teal-700 hover:bg-teal-800"><Link to={`${PORTAL_BASE}/login`}>Entrar</Link></Button>}>
        <p>A senha ficou definida{estado.email ? <> para a conta <strong>{estado.email}</strong></> : null}. Já pode entrar no portal.</p>
      </Sucesso>
    );
  }
  const validade = estado.expira_em ? new Date(estado.expira_em) : null;
  const validadeTexto = validade && !Number.isNaN(validade.getTime()) ? validade.toLocaleDateString('pt-PT') : null;
  return (
    <form onSubmit={submeter} className="space-y-4" noValidate>
      <div className="rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900 dark:border-teal-900 dark:bg-teal-950/50 dark:text-teal-100">
        <p className="flex items-center gap-2 font-medium"><ShieldCheck className="h-4 w-4" aria-hidden="true" />Convite válido{validadeTexto ? ` até ${validadeTexto}` : ''}</p>
        {estado.email && <p className="mt-1">Crie a senha da conta <strong>{estado.email}</strong>.</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="gd-c-nome">O seu nome</Label>
        <Input id="gd-c-nome" value={nome} onChange={e => setNome(e.target.value)} autoComplete="name" className={campo} />
      </div>
      <CampoSenha id="gd-c-senha" label="Nova senha" autoComplete="new-password" value={senha} onChange={setSenha} mostrar={mostrar} setMostrar={setMostrar} />
      <CampoSenha id="gd-c-conf" label="Confirmar a senha" autoComplete="new-password" value={confirmar} onChange={setConfirmar} mostrar={mostrar} setMostrar={setMostrar} />
      <p className="text-xs text-slate-500 dark:text-slate-400">Mínimo 8 caracteres, com pelo menos uma letra maiúscula e um número.</p>
      <Erro>{erro}</Erro>
      <Button type="submit" className={botao} disabled={aCarregar || !senha || !confirmar}>
        {aCarregar ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <KeyRound className="h-4 w-4" aria-hidden="true" />}Criar senha e entrar
      </Button>
    </form>
  );
}

// ── nova senha a partir do link de reposição ───────────────────────────────────────────────────────────────────
// O GoTrue devolve a sessão no fragmento do URL (detectSessionInUrl) e o cliente emite SIGNED_IN/PASSWORD_RECOVERY/
// INITIAL_SESSION; se não houver sessão ao fim de uns segundos, o link não serve.
function FormNovaSenha() {
  const [sessao, setSessao] = useState(undefined);
  const [senha, setSenha] = useState(''); const [confirmar, setConfirmar] = useState(''); const [mostrar, setMostrar] = useState(false);
  const [aCarregar, setACarregar] = useState(false); const [erro, setErro] = useState(null); const [feito, setFeito] = useState(false);
  useEffect(() => {
    let vivo = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((evento, s) => {
      if (!vivo) return;
      if (s) setSessao(s); else if (evento === 'INITIAL_SESSION' || evento === 'SIGNED_OUT') setSessao(null);
    });
    const t = setTimeout(() => { if (vivo) setSessao(v => (v === undefined ? null : v)); }, 6000);
    return () => { vivo = false; clearTimeout(t); subscription.unsubscribe(); };
  }, []);
  const submeter = async (e) => {
    e.preventDefault();
    const v = validarSenha(senha); if (!v.ok) { setErro(v.mensagem); return; }
    if (senha !== confirmar) { setErro('As duas senhas não são iguais.'); return; }
    setACarregar(true); setErro(null);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setACarregar(false);
    if (error) { setErro(/network|failed to fetch/i.test(String(error.message || '')) ? 'Não foi possível falar com o servidor. Verifique a ligação à rede e tente novamente.' : 'Não foi possível guardar a nova senha. Peça um novo link de reposição e tente outra vez.'); return; }
    logAuthEvent('senha_alterada', sessao?.user?.email, 'Senha reposta por link (Portal de Documentos)', 'Documentos');
    setFeito(true);
    setTimeout(() => window.location.replace(PORTAL_BASE), 1500);
  };
  if (feito) return <Sucesso titulo="Senha alterada"><p>A entrar no portal…</p></Sucesso>;
  if (sessao === undefined) return <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />A validar o link…</p>;
  if (!sessao) {
    return (
      <div className="space-y-4">
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />Este link já foi usado, expirou ou não é válido.</p>
        <Button asChild variant="outline" className="h-11 w-full"><Link to={`${PORTAL_BASE}/recuperar`}><KeyRound className="h-4 w-4" aria-hidden="true" />Pedir um novo link</Link></Button>
      </div>
    );
  }
  return (
    <form onSubmit={submeter} className="space-y-4" noValidate>
      <p className="text-sm text-slate-600 dark:text-slate-400">Conta: <strong>{sessao.user?.email}</strong></p>
      <CampoSenha id="gd-ns-senha" label="Nova senha" autoComplete="new-password" value={senha} onChange={setSenha} mostrar={mostrar} setMostrar={setMostrar} />
      <CampoSenha id="gd-ns-conf" label="Confirmar a senha" autoComplete="new-password" value={confirmar} onChange={setConfirmar} mostrar={mostrar} setMostrar={setMostrar} />
      <p className="text-xs text-slate-500 dark:text-slate-400">Mínimo 8 caracteres, com pelo menos uma letra maiúscula e um número.</p>
      <Erro>{erro}</Erro>
      <Button type="submit" className={botao} disabled={aCarregar || !senha || !confirmar}>
        {aCarregar ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <KeyRound className="h-4 w-4" aria-hidden="true" />}Guardar a nova senha
      </Button>
    </form>
  );
}

// `aceitar` e `convite` são o mesmo modo (o router usa /documentos/convite/:token); `recuperar` pede o link.
const MODOS = { entrar: 'entrar', pedir: 'pedir', recuperar: 'recuperar', senha: 'senha', aceitar: 'aceitar', convite: 'aceitar' };
const TITULOS = {
  entrar: { t: 'Entrar', d: 'Use o email e a senha do Portal de Documentos.' },
  pedir: { t: 'Pedir acesso', d: 'Diga-nos quem é, onde trabalha e que documentos precisa de consultar. Um gestor documental analisa o pedido e recebe um convite por email para criar a senha.' },
  recuperar: { t: 'Repor a senha', d: null },
  senha: { t: 'Definir nova senha', d: 'Escolha a nova senha da sua conta do portal.' },
  aceitar: { t: 'Criar a sua senha', d: 'Foi convidado(a) para o Portal de Documentos da SGA.' },
};
const DESTAQUES = [
  { i: Library, t: 'Biblioteca por aeroporto', d: 'Manuais, procedimentos e normas organizados por pasta.' },
  { i: Stamp, t: 'Versões e validade', d: 'A versão em vigor, o histórico e o que está a expirar.' },
  { i: FileCheck2, t: 'Confirmação de leitura', d: 'Declare que leu e tomou conhecimento de cada documento.' },
];

export default function PortalAuth({ modo = 'entrar' }) {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const { token } = useParams();
  const [params] = useSearchParams();
  const vista = MODOS[modo] || 'entrar';
  const next = destinoSeguro(params.get('next'));
  const { data: cfg } = useConfigPublicaDocs();
  const nomePortal = cfg?.nome_portal || NOME_PADRAO;
  const slogan = cfg?.slogan || SLOGAN_PADRAO;
  const titulo = TITULOS[vista];

  useEffect(() => { document.title = `${titulo?.t || 'Entrar'} · ${nomePortal} · SGA`; }, [titulo, nomePortal]);
  // Com sessão aberta não faz sentido mostrar a entrada nem o pedido de acesso (criar senha e aceitar convite sim).
  useEffect(() => { if (!isLoadingAuth && isAuthenticated && vista !== 'aceitar' && vista !== 'senha') window.location.replace(next); }, [isLoadingAuth, isAuthenticated, vista, next]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Painel de identidade do portal: azul-petróleo com apontamentos âmbar (a Universidade é violeta). */}
      <section className="relative hidden overflow-hidden bg-[#063b45] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(13,148,136,0.45),transparent_55%),radial-gradient(circle_at_bottom_left,rgba(245,158,11,0.18),transparent_50%)]" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.04))]" />
        <div className="relative z-10 inline-flex w-fit items-center rounded-2xl bg-white/95 px-8 py-5 shadow-2xl ring-1 ring-white/20">
          <img src="/logo-sga.png" alt="SGA" className="h-16 object-contain" />
        </div>
        <div className="relative z-10 max-w-xl space-y-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-300">Gestão electrónica de documentos</p>
            <h1 className="mt-3 text-5xl font-bold leading-[1.05] tracking-tight">{nomePortal}</h1>
            <p className="mt-4 text-lg text-teal-50/90">{slogan}</p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-3">
            {DESTAQUES.map(x => (
              <li key={x.t} className="rounded-2xl border border-white/15 bg-white/5 p-4 backdrop-blur-md">
                <x.i className="h-5 w-5 text-amber-300" aria-hidden="true" />
                <p className="mt-2 text-sm font-semibold">{x.t}</p>
                <p className="mt-1 text-xs text-teal-100/70">{x.d}</p>
              </li>
            ))}
          </ul>
          {cfg?.mensagem_login && <p className="rounded-xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100">{cfg.mensagem_login}</p>}
        </div>
        <p className="relative z-10 text-xs text-teal-100/70">Sociedade Gestora de Aeroportos · Documentos controlados</p>
      </section>

      <section className="flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <img src="/logo-sga.png" alt="SGA" className="h-10 object-contain dark:hidden" />
            <img src="/logo-sga-light.png" alt="SGA" className="hidden h-10 object-contain dark:block" />
            <div>
              <p className="font-bold leading-tight text-slate-900 dark:text-slate-100">{nomePortal}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Gestão electrónica de documentos</p>
            </div>
          </div>
          {cfg?.mensagem_login && <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100 lg:hidden">{cfg.mensagem_login}</p>}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-8">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{titulo?.t}</h2>
            {titulo?.d && <p className="mb-5 mt-1 text-sm text-slate-500 dark:text-slate-400">{titulo.d}</p>}
            {vista === 'entrar' && <FormEntrar next={next} cfg={cfg} />}
            {vista === 'pedir' && <FormPedir cfg={cfg} />}
            {vista === 'recuperar' && <FormRecuperar cfg={cfg} />}
            {vista === 'aceitar' && <FormConvite token={token || params.get('token')} cfg={cfg} />}
            {vista === 'senha' && <FormNovaSenha />}
          </div>
          <p className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            <Link to={`${PORTAL_BASE}/privacidade`} className="hover:underline">Privacidade e tratamento de dados</Link>
            {cfg?.email_suporte && <a href={mailtoDe(cfg.email_suporte)} className="hover:underline">Apoio: {cfg.email_suporte}</a>}
          </p>
        </div>
      </section>
    </div>
  );
}
