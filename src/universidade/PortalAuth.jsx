// Entrada do portal da Universidade: entrar, pedir acesso, recuperar senha e aceitar convite (criar senha).
// Página pública (sem sessão). A marca é da SGA; os textos vêm da configuração do portal.
import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Loader2, Eye, EyeOff, Mail, Lock, ArrowLeft, CheckCircle2, GraduationCap, Award, CalendarDays, BookOpen, UserPlus, KeyRound, AlertTriangle, ExternalLink, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase, UC_ISOLADO } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { logAuthEvent } from '@/lib/auditLog';
import { traduzErroAuth } from '@/lib/authErros';
import { PORTAL_BASE, destinoSeguro, emailValido, validarPedido, validarSenha, emailInterno, normalizarDominios, mailtoDe, aplicarEscalaPortal, retirarEscalaPortal } from '@/lib/universidade';
import { useConfigPublica, useCursosPublicos, useAeroportosUc } from './hooks';
import { univAcesso } from './api';
import { imagemPortal } from './imagens';

function useLimitador(max = 5, janelaMs = 60000) {
  const ref = useRef([]);
  return () => {
    const agora = Date.now();
    ref.current = ref.current.filter(t => agora - t < janelaMs);
    if (ref.current.length >= max) return Math.ceil((janelaMs - (agora - ref.current[0])) / 1000);
    ref.current.push(agora); return 0;
  };
}
const campo = 'h-11 bg-white dark:bg-slate-950';

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
        <Input id={id} type={mostrar ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)} required autoComplete={autoComplete} className={`${campo} pl-9 pr-10`} />
        <button type="button" onClick={() => setMostrar(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" aria-label={mostrar ? 'Esconder senha' : 'Mostrar senha'}>{mostrar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
      </div>
    </div>
  );
}

// Com a autenticação independente, um 404/HTML na rota /uc/auth/v1 significa que o nginx ainda não tem as rotas /uc/.
function erroEntrada(msg) {
  if (UC_ISOLADO && /\b404\b|Unexpected token|not valid JSON|<!doctype/i.test(String(msg || ''))) return 'O serviço de autenticação da Universidade não está disponível neste momento (rota /uc/auth/v1). Tente mais tarde ou contacte o suporte.';
  return traduzErroAuth(msg);
}

function FormEntrar({ next, cfg }) {
  const [email, setEmail] = useState(''); const [senha, setSenha] = useState(''); const [mostrar, setMostrar] = useState(false);
  const [aCarregar, setACarregar] = useState(false); const [erro, setErro] = useState(null);
  const limitar = useLimitador(5, 60000);
  const submeter = async (e) => {
    e.preventDefault();
    const espera = limitar(); if (espera) { setErro(`Demasiadas tentativas. Aguarde ${espera} s.`); return; }
    setACarregar(true); setErro(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
      if (error) { logAuthEvent('login_falha', email.trim(), error.message, 'Universidade'); setErro(erroEntrada(error.message)); setACarregar(false); return; }
      logAuthEvent('login', email.trim(), 'Início de sessão no portal da Universidade', 'Universidade');
      window.location.replace(next);
    } catch (err) { setErro(erroEntrada(err?.message)); setACarregar(false); }
  };
  return (
    <form onSubmit={submeter} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="uc-email">Email</Label>
        <div className="relative"><Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" /><Input id="uc-email" type="email" inputMode="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} className={`${campo} pl-9`} placeholder="nome@sga.co.ao" /></div>
      </div>
      <CampoSenha id="uc-senha" value={senha} onChange={setSenha} mostrar={mostrar} setMostrar={setMostrar} />
      <Erro>{erro}</Erro>
      <Button type="submit" className="h-11 w-full bg-[#004A99] hover:bg-[#003b7a]" disabled={aCarregar || !email || !senha}>{aCarregar ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <GraduationCap className="h-4 w-4" aria-hidden="true" />}Entrar na Universidade</Button>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <Link to={`${PORTAL_BASE}/recuperar`} className="text-violet-700 hover:underline dark:text-violet-300">Esqueci a senha</Link>
        {cfg?.registo_aberto !== false && <Link to={`${PORTAL_BASE}/pedir-acesso`} className="font-medium text-violet-700 hover:underline dark:text-violet-300">Ainda não tem acesso? Peça aqui</Link>}
      </div>
    </form>
  );
}

function FormPedir({ cfg }) {
  const { data: aeroportosUc = [] } = useAeroportosUc();
  const [f, setF] = useState({ nome: '', email: '', empresa: 'SGA — Sociedade Gestora de Aeroportos', departamento: '', funcao: '', aeroporto: '', telefone: '', chefia: '', cursos: [], motivo: '' });
  const { data: cursosPublicos = [] } = useCursosPublicos();
  const [erros, setErros] = useState({}); const [erro, setErro] = useState(null); const [aCarregar, setACarregar] = useState(false); const [resultado, setResultado] = useState(null);
  const set = (k) => (e) => setF(v => ({ ...v, [k]: e.target.value }));
  const dominios = normalizarDominios(cfg?.dominios_permitidos);
  const submeter = async (e) => {
    e.preventDefault();
    const v = validarPedido(f, cfg || {}); setErros(v.erros); if (!v.ok) return;
    setACarregar(true); setErro(null);
    try { setResultado(await univAcesso('pedir', { ...f, cursos_interesse: f.cursos })); } catch (err) { setErro(err.message); } finally { setACarregar(false); }
  };
  if (resultado?.ja_tem_conta) return <Sucesso titulo="Este email já tem acesso"><p>{resultado.mensagem}</p><p className="mt-2">Se não se lembra da senha, pode <Link to={`${PORTAL_BASE}/recuperar`} className="text-violet-700 underline dark:text-violet-300">recuperá-la aqui</Link>.</p></Sucesso>;
  if (resultado?.aprovado_automaticamente) return <Sucesso titulo="Acesso aprovado"><p>{resultado.email_enviado ? <>Enviámos um convite para <strong>{f.email}</strong> com um botão para criar a sua senha. Verifique também a pasta de spam.</> : <>O acesso foi aprovado, mas não foi possível enviar o email de convite. Contacte {cfg?.email_suporte || 'o suporte'} para receber o link.</>}</p></Sucesso>;
  if (resultado?.ok) return <Sucesso titulo={resultado.repetido ? 'Pedido já registado' : 'Pedido enviado'} accao={<Button asChild variant="outline"><Link to={`${PORTAL_BASE}/login`}><ArrowLeft className="h-4 w-4" aria-hidden="true" />Voltar à entrada</Link></Button>}><p>{resultado.mensagem || 'Um gestor da Universidade vai analisar o seu pedido. Assim que for aprovado recebe um email com um convite para criar a sua senha.'}</p>{!emailInterno(f.email) && <p className="mt-2 text-amber-700 dark:text-amber-300">Como o seu email não é da SGA, o convite pode ter de lhe ser entregue por outro meio (o gestor tem o link).</p>}</Sucesso>;
  return (
    <form onSubmit={submeter} className="space-y-4" noValidate>
      {cfg?.registo_aberto === false && <Erro>Os pedidos de acesso estão desactivados. Contacte {cfg?.email_suporte || 'o suporte'} para receber um convite.</Erro>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="p-nome">Nome completo *</Label><Input id="p-nome" value={f.nome} onChange={set('nome')} required autoComplete="name" className={campo} />{erros.nome && <p className="text-xs text-red-600">{erros.nome}</p>}</div>
        <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="p-email">Email *</Label><Input id="p-email" type="email" inputMode="email" value={f.email} onChange={set('email')} required autoComplete="email" className={campo} placeholder={dominios.length ? `nome@${dominios[0]}` : 'nome@empresa.com'} />{erros.email ? <p className="text-xs text-red-600">{erros.email}</p> : dominios.length > 0 && <p className="text-xs text-slate-500">Aceitam-se emails de: {dominios.map(d => '@' + d).join(', ')}</p>}</div>
        <div className="space-y-1.5"><Label htmlFor="p-empresa">Empresa / entidade *</Label><Input id="p-empresa" value={f.empresa} onChange={set('empresa')} autoComplete="organization" className={campo} placeholder="SGA, handling, ANAC…" list="p-empresas" /><datalist id="p-empresas"><option value="SGA — Sociedade Gestora de Aeroportos" /></datalist></div>
        <div className="space-y-1.5"><Label htmlFor="p-dep">Departamento / área</Label><Input id="p-dep" value={f.departamento} onChange={set('departamento')} className={campo} placeholder="ex.: Operações, Safety, Segurança" /></div>
        <div className="space-y-1.5"><Label htmlFor="p-func">Função / cargo</Label><Input id="p-func" value={f.funcao} onChange={set('funcao')} autoComplete="organization-title" className={campo} placeholder="ex.: Operador de placa" /></div>
        <div className="space-y-1.5"><Label htmlFor="p-aero">Aeroporto / local de trabalho</Label><Input id="p-aero" list="aeroportos-uc" value={f.aeroporto} onChange={set('aeroporto')} className={campo} placeholder="ex.: FNLU — Luanda" /><datalist id="aeroportos-uc">{aeroportosUc.map(a => <option key={a.codigo} value={`${a.codigo} — ${a.nome}`} />)}</datalist></div>
        <div className="space-y-1.5"><Label htmlFor="p-tel">Telefone</Label><Input id="p-tel" type="tel" inputMode="tel" value={f.telefone} onChange={set('telefone')} autoComplete="tel" className={campo} /></div>
        <div className="space-y-1.5"><Label htmlFor="p-chefia">Responsável directo (nome e email)</Label><Input id="p-chefia" value={f.chefia} onChange={set('chefia')} className={campo} placeholder="ex.: Ana Silva — ana.silva@sga.co.ao" /></div>
        <fieldset className="space-y-2 sm:col-span-2">
          <legend className="text-sm font-medium">Cursos de interesse</legend>
          {cursosPublicos.length === 0 ? <p className="text-xs text-slate-500">O catálogo fica disponível depois de entrar.</p> : (
            <div className="grid max-h-44 gap-1.5 overflow-y-auto rounded-lg border p-2 dark:border-slate-700 sm:grid-cols-2">
              {cursosPublicos.map(c => (
                <label key={c.id} className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
                  <input type="checkbox" className="mt-1 h-4 w-4 accent-violet-700" checked={f.cursos.includes(c.id)} onChange={(e) => setF(v => ({ ...v, cursos: e.target.checked ? [...v.cursos, c.id] : v.cursos.filter(x => x !== c.id) }))} />
                  <span><span className="block leading-snug">{c.titulo}</span><span className="text-xs text-slate-500">{[c.categoria, c.carga_horaria ? `${c.carga_horaria} h` : null, c.obrigatorio_todos ? 'obrigatório' : null].filter(Boolean).join(' · ')}</span></span>
                </label>
              ))}
            </div>
          )}
          <p className="text-xs text-slate-500">Ao aprovar o pedido, o gestor pode inscrevê-lo(a) de imediato nestes cursos.</p>
        </fieldset>
        <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="p-motivo">Observações</Label><Textarea id="p-motivo" value={f.motivo} onChange={set('motivo')} rows={2} maxLength={1000} className="bg-white dark:bg-slate-950" placeholder="Prazo, formação exigida pela função, quem pediu…" />{erros.motivo && <p className="text-xs text-red-600">{erros.motivo}</p>}</div>
      </div>
      <Erro>{erro}</Erro>
      <Button type="submit" className="h-11 w-full bg-[#004A99] hover:bg-[#003b7a]" disabled={aCarregar || cfg?.registo_aberto === false}>{aCarregar ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <UserPlus className="h-4 w-4" aria-hidden="true" />}Pedir acesso</Button>
      <p className="text-center text-sm"><Link to={`${PORTAL_BASE}/login`} className="inline-flex items-center gap-1 text-slate-600 hover:underline dark:text-slate-300"><ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />Já tenho acesso</Link></p>
    </form>
  );
}

function FormRecuperar({ cfg }) {
  const [email, setEmail] = useState(''); const [aCarregar, setACarregar] = useState(false); const [erro, setErro] = useState(null); const [enviado, setEnviado] = useState(false);
  const limitar = useLimitador(3, 60000);
  const submeter = async (e) => {
    e.preventDefault();
    if (!emailValido(email)) { setErro('Indique um email válido.'); return; }
    if (!emailInterno(email)) { setErro(`O servidor de email da SGA só entrega a endereços internos (@sga.co.ao). Peça a redefinição da senha a ${cfg?.email_suporte || 'um gestor da Universidade'}.`); return; }
    const espera = limitar(); if (espera) { setErro(`Demasiadas tentativas. Aguarde ${espera} s.`); return; }
    setACarregar(true); setErro(null);
    // modo isolado: o link volta à página de nova senha do portal (o GoTrue da Universidade só conhece o portal)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}${PORTAL_BASE}/alterar-senha` });
    setACarregar(false);
    if (error) { setErro(traduzErroAuth(error.message)); return; }
    logAuthEvent('recuperacao_senha', email.trim(), 'Pedido de redefinição de senha (portal da Universidade)', 'Universidade');
    setEnviado(true);
  };
  if (enviado) return <Sucesso titulo="Email enviado" accao={<Button asChild variant="outline"><Link to={`${PORTAL_BASE}/login`}><ArrowLeft className="h-4 w-4" aria-hidden="true" />Voltar à entrada</Link></Button>}><p>Se <strong>{email}</strong> tiver conta, recebe um email com um link para definir uma nova senha. Verifique também a pasta de spam.</p></Sucesso>;
  return (
    <form onSubmit={submeter} className="space-y-4" noValidate>
      <p className="text-sm text-slate-600 dark:text-slate-400">Indique o email da sua conta. Enviamos-lhe um link para definir uma nova senha.</p>
      <div className="space-y-1.5"><Label htmlFor="r-email">Email</Label><div className="relative"><Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" /><Input id="r-email" type="email" inputMode="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} className={`${campo} pl-9`} /></div></div>
      <Erro>{erro}</Erro>
      <Button type="submit" className="h-11 w-full bg-[#004A99] hover:bg-[#003b7a]" disabled={aCarregar || !email}>{aCarregar ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <KeyRound className="h-4 w-4" aria-hidden="true" />}Enviar link de recuperação</Button>
      <p className="text-center text-sm"><Link to={`${PORTAL_BASE}/login`} className="inline-flex items-center gap-1 text-slate-600 hover:underline dark:text-slate-300"><ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />Voltar à entrada</Link></p>
    </form>
  );
}

function FormConvite({ token, cfg }) {
  const [estado, setEstado] = useState({ aVerificar: true });
  const [nome, setNome] = useState(''); const [senha, setSenha] = useState(''); const [confirmar, setConfirmar] = useState(''); const [mostrar, setMostrar] = useState(false);
  const [aCarregar, setACarregar] = useState(false); const [erro, setErro] = useState(null); const [feito, setFeito] = useState(false);
  useEffect(() => {
    let vivo = true;
    univAcesso('verificar', { token }).then(r => { if (!vivo) return; setEstado({ ...r, aVerificar: false }); if (r?.nome) setNome(r.nome); }).catch(e => vivo && setEstado({ valido: false, motivo: e.message, aVerificar: false }));
    return () => { vivo = false; };
  }, [token]);
  const submeter = async (e) => {
    e.preventDefault();
    const v = validarSenha(senha); if (!v.ok) { setErro(v.mensagem); return; }
    if (senha !== confirmar) { setErro('As senhas não coincidem.'); return; }
    setACarregar(true); setErro(null);
    try {
      const r = await univAcesso('aceitar', { token, password: senha, nome: nome.trim() });
      const { error } = await supabase.auth.signInWithPassword({ email: r.email, password: senha });
      if (error) { setFeito(true); return; }
      logAuthEvent('login', r.email, 'Primeiro acesso ao portal da Universidade (convite aceite)', 'Universidade');
      window.location.replace(PORTAL_BASE);
    } catch (err) { setErro(err.message); setACarregar(false); }
  };
  if (estado.aVerificar) return <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />A verificar o convite…</div>;
  if (!estado.valido) return (
    <div className="space-y-4">
      <Erro>{estado.motivo}</Erro>
      <div className="flex flex-wrap gap-2">
        {estado.usado && <Button asChild className="bg-violet-700 hover:bg-violet-800"><Link to={`${PORTAL_BASE}/login`}>Entrar</Link></Button>}
        {estado.usado && <Button asChild variant="outline"><Link to={`${PORTAL_BASE}/recuperar`}>Esqueci a senha</Link></Button>}
        {!estado.usado && cfg?.registo_aberto !== false && <Button asChild variant="outline"><Link to={`${PORTAL_BASE}/pedir-acesso`}>Pedir um novo acesso</Link></Button>}
      </div>
      {cfg?.email_suporte && <p className="text-sm text-slate-500">Precisa de ajuda? Escreva para <a href={mailtoDe(cfg.email_suporte)} className="underline">{cfg.email_suporte}</a>.</p>}
    </div>
  );
  if (feito) return <Sucesso titulo="Senha criada" accao={<Button asChild className="bg-violet-700 hover:bg-violet-800"><Link to={`${PORTAL_BASE}/login`}>Entrar</Link></Button>}><p>A sua senha foi definida. Entre com o email <strong>{estado.email}</strong>.</p></Sucesso>;
  const validade = estado.expira_em ? new Date(estado.expira_em).toLocaleDateString('pt-PT') : null;
  return (
    <form onSubmit={submeter} className="space-y-4" noValidate>
      <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm text-violet-900 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-100"><p className="flex items-center gap-2 font-medium"><ShieldCheck className="h-4 w-4" aria-hidden="true" />Convite válido{validade ? ` até ${validade}` : ''}</p><p className="mt-1">Crie a senha para a conta <strong>{estado.email}</strong>.</p></div>
      <div className="space-y-1.5"><Label htmlFor="c-nome">O seu nome</Label><Input id="c-nome" value={nome} onChange={e => setNome(e.target.value)} autoComplete="name" className={campo} /></div>
      <CampoSenha id="c-senha" label="Nova senha" autoComplete="new-password" value={senha} onChange={setSenha} mostrar={mostrar} setMostrar={setMostrar} />
      <CampoSenha id="c-conf" label="Confirmar senha" autoComplete="new-password" value={confirmar} onChange={setConfirmar} mostrar={mostrar} setMostrar={setMostrar} />
      <p className="text-xs text-slate-500">Mínimo 8 caracteres, com pelo menos uma letra maiúscula e um número.</p>
      <Erro>{erro}</Erro>
      <Button type="submit" className="h-11 w-full bg-[#004A99] hover:bg-[#003b7a]" disabled={aCarregar || !senha || !confirmar}>{aCarregar ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <KeyRound className="h-4 w-4" aria-hidden="true" />}Criar senha e entrar</Button>
    </form>
  );
}

// Nova senha a partir do link de recuperação: o GoTrue devolve a sessão no fragmento do URL (detectSessionInUrl) e o
// cliente emite SIGNED_IN/PASSWORD_RECOVERY/INITIAL_SESSION; sem sessão ao fim de uns segundos, o link é inválido.
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
    if (senha !== confirmar) { setErro('As senhas não coincidem.'); return; }
    setACarregar(true); setErro(null);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setACarregar(false);
    if (error) { setErro(traduzErroAuth(error.message)); return; }
    logAuthEvent('senha_alterada', sessao?.user?.email, 'Senha redefinida por link de recuperação (portal da Universidade)', 'Universidade');
    setFeito(true);
    setTimeout(() => window.location.replace(PORTAL_BASE), 1500);
  };
  if (feito) return <Sucesso titulo="Senha alterada"><p>A entrar na Universidade…</p></Sucesso>;
  if (sessao === undefined) return <p className="flex items-center gap-2 text-sm text-slate-500" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />A validar o link…</p>;
  if (!sessao) return <div className="space-y-4"><p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />O link de recuperação é inválido, já foi usado ou expirou.</p><Button asChild variant="outline" className="w-full"><Link to={`${PORTAL_BASE}/recuperar`}><KeyRound className="h-4 w-4" aria-hidden="true" />Pedir novo link</Link></Button></div>;
  return (
    <form onSubmit={submeter} className="space-y-4" noValidate>
      <p className="text-sm text-slate-600 dark:text-slate-400">Conta: <strong>{sessao.user?.email}</strong></p>
      <CampoSenha id="ns-senha" label="Nova senha" autoComplete="new-password" value={senha} onChange={setSenha} mostrar={mostrar} setMostrar={setMostrar} />
      <CampoSenha id="ns-conf" label="Confirmar senha" autoComplete="new-password" value={confirmar} onChange={setConfirmar} mostrar={mostrar} setMostrar={setMostrar} />
      <p className="text-xs text-slate-500">Mínimo 8 caracteres, com pelo menos uma letra maiúscula e um número.</p>
      <Erro>{erro}</Erro>
      <Button type="submit" className="h-11 w-full bg-[#004A99] hover:bg-[#003b7a]" disabled={aCarregar || !senha || !confirmar}>{aCarregar ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <KeyRound className="h-4 w-4" aria-hidden="true" />}Guardar nova senha</Button>
    </form>
  );
}

const TITULOS = {
  entrar: { t: 'Entrar', d: 'Use o email e a senha da Universidade.' },
  senha: { t: 'Definir nova senha', d: 'Escolha a nova senha da sua conta da Universidade.' },
  pedir: { t: 'Pedir acesso', d: 'Diga-nos quem é, onde trabalha e que formação precisa. Um gestor aprova o pedido e recebe um convite por email para criar a senha.' },
  recuperar: { t: 'Recuperar senha', d: null },
  convite: { t: 'Criar a sua senha', d: 'Foi convidado(a) para a Universidade Corporativa.' },
};

export default function PortalAuth({ modo = 'entrar' }) {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const { token } = useParams();
  const [params] = useSearchParams();
  const next = destinoSeguro(params.get('next'));
  const vindoDoDirops = params.get('conta') === 'formando';
  const { data: cfg } = useConfigPublica();
  const nomePortal = cfg?.nome_portal || 'Universidade Corporativa';
  const imagem = imagemPortal(cfg, 'entrada');

  useEffect(() => { document.title = `${TITULOS[modo]?.t || 'Entrar'} · ${nomePortal} · SGA`; }, [modo, nomePortal]);
  useEffect(() => { aplicarEscalaPortal(); return () => retirarEscalaPortal(); }, []);
  useEffect(() => { if (!isLoadingAuth && isAuthenticated && modo !== 'convite' && modo !== 'senha') window.location.replace(next); }, [isLoadingAuth, isAuthenticated, modo, next]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 lg:grid lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-[#0b1f3a] p-12 text-white lg:flex lg:flex-col lg:justify-between" aria-hidden="true">
        <img src={imagem.url} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center" loading="eager" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0b1f3a]/80 via-[#0b1f3a]/70 to-[#0b1f3a]/95" />
        {imagem.credito && <p className="absolute bottom-3 right-4 z-10 text-[10px] text-white/45">{imagem.credito}</p>}
        <div className="relative z-10 inline-flex w-fit items-center rounded-2xl bg-white/95 px-8 py-5 shadow-2xl ring-1 ring-white/20"><img src="/logo-sga.png" alt="SGA" className="h-16 object-contain" /></div>
        <div className="relative z-10 max-w-xl space-y-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-200">Direcção de Operações</p>
            <h1 className="mt-3 text-5xl font-bold leading-[1.05] tracking-tight">{nomePortal}</h1>
            <p className="mt-4 text-lg text-blue-100/90">{cfg?.slogan || 'Formação ao seu ritmo: cursos, procedimentos e certificados da SGA.'}</p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-3">
            {[{ i: BookOpen, t: 'Cursos e procedimentos', d: 'Vídeo, leituras, actividades e avaliações.' }, { i: Award, t: 'Certificados com validade', d: 'Recertificação e lembretes automáticos.' }, { i: CalendarDays, t: 'Sessões presenciais e online', d: 'Inscrição, convocatória e presenças.' }].map(x => (
              <li key={x.t} className="rounded-2xl border border-white/15 bg-[#0b1f3a]/55 p-4 backdrop-blur-md"><x.i className="h-5 w-5 text-blue-200" /><p className="mt-2 text-sm font-semibold">{x.t}</p><p className="mt-1 text-xs text-slate-400">{x.d}</p></li>
            ))}
          </ul>
          {cfg?.mensagem_login && <p className="rounded-xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100">{cfg.mensagem_login}</p>}
        </div>
        <p className="relative z-10 text-xs text-blue-100/70">Sociedade Gestora de Aeroportos · Universidade Corporativa</p>
      </section>

      <section className="flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-3 lg:hidden"><img src="/logo-sga.png" alt="SGA" className="h-10 object-contain dark:hidden" /><img src="/logo-sga-light.png" alt="SGA" className="hidden h-10 object-contain dark:block" /><div><p className="font-bold leading-tight text-slate-900 dark:text-slate-100">{nomePortal}</p><p className="text-xs text-slate-500">Direcção de Operações</p></div></div>
          {cfg?.mensagem_login && <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100 lg:hidden">{cfg.mensagem_login}</p>}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-8">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{TITULOS[modo]?.t}</h2>
            {TITULOS[modo]?.d && <p className="mb-5 mt-1 text-sm text-slate-500 dark:text-slate-400">{TITULOS[modo].d}</p>}
            {modo === 'entrar' && vindoDoDirops && <p className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">A sua conta é da Universidade Corporativa. Entre aqui com o seu email e senha.</p>}
            {modo === 'entrar' && <FormEntrar next={next} cfg={cfg} />}
            {modo === 'pedir' && <FormPedir cfg={cfg} />}
            {modo === 'recuperar' && <FormRecuperar cfg={cfg} />}
            {modo === 'convite' && <FormConvite token={token} cfg={cfg} />}
            {modo === 'senha' && <FormNovaSenha />}
          </div>
          <p className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            <a href="/login" className="inline-flex items-center gap-1 hover:underline"><ExternalLink className="h-3 w-3" aria-hidden="true" />Entrar no DIROPS</a>
            <Link to={`${PORTAL_BASE}/privacidade`} className="hover:underline">Privacidade</Link>
            {cfg?.email_suporte && <a href={mailtoDe(cfg.email_suporte)} className="hover:underline">Suporte: {cfg.email_suporte}</a>}
          </p>
        </div>
      </section>
    </div>
  );
}
