import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Eye, EyeOff, UserPlus, Mail, Lock, ArrowLeft, CheckCircle2, Shield, User } from 'lucide-react';
import { logAuthEvent } from '@/lib/auditLog';
import { useI18n } from '@/components/lib/i18n';
import AlertModal from '@/components/shared/AlertModal';
import { isExternalEmail, EXTERNAL_EMAIL_NOTICE } from '@/lib/emailDomain';

const LogoDirops = ({ className = "h-14", variant = "dark" }) => (
  <img
    src={variant === "light" ? "/logo-sga-light.png" : "/logo-sga.png"}
    alt="DIROPS"
    className={`${className} object-contain`}
  />
);

// Rate limiter: max attempts in time window
function useRateLimit(maxAttempts = 5, windowMs = 60000) {
  const attemptsRef = React.useRef([]);
  return {
    check() {
      const now = Date.now();
      attemptsRef.current = attemptsRef.current.filter(t => now - t < windowMs);
      if (attemptsRef.current.length >= maxAttempts) {
        const waitSec = Math.ceil((windowMs - (now - attemptsRef.current[0])) / 1000);
        return { blocked: true, waitSec };
      }
      attemptsRef.current.push(now);
      return { blocked: false };
    }
  };
}

// Traduz mensagens de erro do GoTrue/Supabase (ingles) para PT.
function traduzErroAuth(msg) {
  if (!msg) return 'Ocorreu um erro. Tente novamente.';
  const m = String(msg).toLowerCase();
  if (m.includes('signups not allowed') || m.includes('signup is disabled') || m.includes('signup disabled')) return 'O auto-cadastro está desativado nesta instância. Contacte o administrador para criar o seu acesso.';
  if (m.includes('invalid login credentials')) return 'Email ou senha incorretos.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'Este email já está registado.';
  if (m.includes('email not confirmed')) return 'Email ainda não confirmado. Verifique a sua caixa de entrada.';
  if (m.includes('password should be at least') || m.includes('password is too short')) return 'A senha é demasiado curta (mínimo 8 caracteres).';
  if (m.includes('rate limit') || m.includes('too many requests')) return 'Demasiadas tentativas. Aguarde um momento e tente novamente.';
  if (m.includes('user not found')) return 'Utilizador não encontrado.';
  if (m.includes('relay') || m.includes('non-accepted domain') || m.includes('550')) return 'O servidor de email só aceita endereços internos (@sga.co.ao).';
  if (m.includes('network') || m.includes('failed to fetch') || m.includes('fetch failed')) return 'Falha de ligação ao servidor. Verifique a rede e tente novamente.';
  return msg; // fallback: mostra a original
}

export default function Login() {
  const { t } = useI18n();
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState('login');
  const loginLimiter = useRateLimit(5, 60000);
  const resetLimiter = useRateLimit(3, 60000);
  const [externalEmailModal, setExternalEmailModal] = useState(false);

  useEffect(() => {
    if (!isLoadingAuth && isAuthenticated) {
      window.location.replace('/Home');
    }
  }, [isLoadingAuth, isAuthenticated]);

  const handleLogin = async (e) => {
    e.preventDefault();
    const { blocked, waitSec } = loginLimiter.check();
    if (blocked) { setError(t('login.demasiadas_tentativas').replace('{sec}', waitSec)); return; }
    setLoading(true);
    setError(null);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        logAuthEvent('login_falha', email, signInError.message);
        setError(traduzErroAuth(signInError.message));
        setLoading(false);
        return;
      }
      logAuthEvent('login', email, 'Login bem-sucedido');
      window.location.replace('/Home');
    } catch (err) {
      setError(t('login.erroGenerico') + ' ' + err.message);
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    // Pre-flight: DIROPS SMTP relay rejects external recipients — admin must invite.
    if (isExternalEmail(email)) { setExternalEmailModal(true); return; }
    setLoading(true);
    setError(null);
    if (password !== confirmPassword) { setError(t('login.senhas_nao_coincidem')); setLoading(false); return; }
    if (password.length < 8) { setError(t('login.senha_min_chars')); setLoading(false); return; }
    if (!/[A-Z]/.test(password)) { setError(t('login.senha_maiuscula')); setLoading(false); return; }
    if (!/[0-9]/.test(password)) { setError(t('login.senha_numero')); setLoading(false); return; }
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email, password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: `${window.location.origin}/ValidacaoAcesso`,
        },
      });
      if (signUpError) {
        setError(traduzErroAuth(signUpError.message));
        setLoading(false);
        return;
      }
      if (data?.user && !data.session) { setMode('register_sent'); }
      else if (data?.session) { window.location.replace('/SolicitacaoPerfil'); }
    } catch (err) {
      setError(t('login.erroGenerico') + ' ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    // Pre-flight: DIROPS SMTP relay rejects external recipients.
    if (isExternalEmail(email)) { setExternalEmailModal(true); return; }
    const { blocked, waitSec } = resetLimiter.check();
    if (blocked) { setError(t('login.demasiadas_tentativas').replace('{sec}', waitSec)); return; }
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/AlterarSenha`,
    });
    if (error) {
      // Defensive: server still bounced (e.g. account was created with @sga.co.ao
      // but admin later changed it). Show same friendly modal.
      const msg = (error.message || '').toLowerCase();
      if (msg.includes('relay') || msg.includes('non-accepted domain') || msg.includes('550')) {
        setExternalEmailModal(true);
      } else {
        setError(error.message);
      }
      setLoading(false);
      return;
    }
    setMode('reset_sent');
    setLoading(false);
  };

  const switchMode = (newMode) => { setMode(newMode); setError(null); };

  const inputClass = "h-11 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500/20 transition-colors";

  return (
    <div className="min-h-screen flex bg-white dark:bg-slate-900 relative overflow-hidden">

      {/* Left side - Branding (dark panel, hidden on mobile) */}
      <div className="hidden lg:flex flex-1 items-center justify-center relative bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-12">
        {/* Background decorations — single subtle blur + finer grid */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -right-32 w-[28rem] h-[28rem] bg-blue-600/10 rounded-full blur-3xl" />
          <div className="absolute inset-0 opacity-[0.025]" style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,.18) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.18) 1px, transparent 1px)',
            backgroundSize: '40px 40px'
          }} />
        </div>

        <div className="max-w-xl w-full space-y-10 relative z-10 flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-3 duration-700">
          {/* Logo — large, framed in a soft glassy card */}
          <div className="inline-flex items-center justify-center bg-white/95 backdrop-blur rounded-3xl px-12 py-7 shadow-2xl shadow-black/30 ring-1 ring-white/20">
            <LogoDirops className="h-28" />
          </div>

          {/* Tagline */}
          <div className="space-y-4">
            <h2 className="text-5xl font-bold text-white leading-[1.1] tracking-tight">
              {t('login.gestao_integrada')}{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-sky-400">
                {t('login.operacoes_aeroportuarias')}
              </span>
            </h2>
            <p className="text-slate-300/90 text-lg leading-relaxed max-w-md mx-auto">
              {t('login.controle')}
            </p>
          </div>

          {/* Feature card + Stats */}
          <div className="grid grid-cols-2 gap-4 pt-2 w-full">
            <div className="group bg-white/[0.04] backdrop-blur-sm border border-white/10 rounded-2xl p-5 space-y-3 hover:bg-white/[0.07] hover:border-blue-400/30 transition-all">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-400/30 flex items-center justify-center">
                <Shield className="w-5 h-5 text-blue-300" />
              </div>
              <p className="text-white font-semibold text-sm">{t('login.safety_auditorias')}</p>
              <p className="text-slate-400 text-xs leading-relaxed">{t('login.conformidade')}</p>
            </div>
            <div className="bg-white/[0.04] backdrop-blur-sm border border-white/10 rounded-2xl p-5 flex flex-col justify-between">
              <div className="space-y-3 text-left">
                <div>
                  <p className="text-3xl font-bold text-white tabular-nums">15K+</p>
                  <p className="text-slate-400 text-[11px] uppercase tracking-wide">Voos geridos</p>
                </div>
                <div className="h-px bg-white/10" />
                <div>
                  <p className="text-3xl font-bold text-white tabular-nums">100+</p>
                  <p className="text-slate-400 text-[11px] uppercase tracking-wide">Utilizadores</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Form (white background) */}
      <div className="flex-1 flex items-center justify-center p-6 relative">
        <div className="w-full max-w-[420px] animate-in fade-in slide-in-from-bottom-2 duration-500">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex flex-col items-center gap-2 mb-2">
              <LogoDirops className="h-16 drop-shadow-md" variant="light" />
              <p className="text-slate-500 dark:text-slate-400 text-xs">{t('login.sistema')}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-8 shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50">

            {/* SUCCESS STATES */}
            {mode === 'reset_sent' && (
              <div className="text-center space-y-5 py-4">
                <div className="mx-auto w-16 h-16 bg-green-50 dark:bg-green-950 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('login.email_enviado')}</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">
                    {t('login.email_enviado_msg')} <strong className="text-slate-700 dark:text-slate-300">{email}</strong>. {t('login.verifique_caixa')}
                  </p>
                </div>
                <Button variant="outline" className="w-full border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 h-11" onClick={() => switchMode('login')}>
                  <ArrowLeft className="w-4 h-4 mr-2" /> {t('login.voltar_login')}
                </Button>
              </div>
            )}

            {mode === 'register_sent' && (
              <div className="text-center space-y-5 py-4">
                <div className="mx-auto w-16 h-16 bg-green-50 dark:bg-green-950 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('login.conta_criada')}</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">
                    {t('login.verifique_email')} <strong className="text-slate-700 dark:text-slate-300">{email}</strong> {t('login.confirmar_registo')}
                  </p>
                  <p className="text-slate-400 text-xs">
                    {t('login.apos_confirmar')}
                  </p>
                </div>
                <Button variant="outline" className="w-full border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 h-11" onClick={() => switchMode('login')}>
                  <ArrowLeft className="w-4 h-4 mr-2" /> {t('login.ir_login')}
                </Button>
              </div>
            )}

            {/* RESET PASSWORD */}
            {mode === 'reset' && (
              <div className="space-y-6">
                <div className="space-y-1">
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{t('login.recuperar_senha')}</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">{t('login.email_recuperacao')}</p>
                </div>
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-slate-600 dark:text-slate-400 text-sm">{t('login.email')}</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input type="email" placeholder={t('login.emailPlaceholder')} value={email} onChange={(e) => setEmail(e.target.value)} required className={`${inputClass} pl-10`} />
                    </div>
                  </div>
                  {error && <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3"><p className="text-red-600 dark:text-red-400 text-sm">{error}</p></div>}
                  <Button type="submit" className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium" disabled={loading}>
                    {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    {t('login.enviar_link')}
                  </Button>
                  <button type="button" className="w-full text-center text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors" onClick={() => switchMode('login')}>
                    <ArrowLeft className="w-3.5 h-3.5 inline mr-1" />{t('login.voltar_login')}
                  </button>
                </form>
              </div>
            )}

            {/* REGISTER */}
            {mode === 'register' && (
              <div className="space-y-6">
                <div className="space-y-1">
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{t('login.solicitar_acesso_titulo')}</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">{t('login.solicitar_acesso_desc')}</p>
                </div>
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-slate-600 dark:text-slate-400 text-sm">{t('login.nome_completo')}</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input type="text" placeholder={t('login.nome_placeholder')} value={fullName} onChange={(e) => setFullName(e.target.value)} required className={`${inputClass} pl-10`} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-600 dark:text-slate-400 text-sm">{t('login.email')}</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input type="email" placeholder={t('login.emailPlaceholder')} value={email} onChange={(e) => setEmail(e.target.value)} required className={`${inputClass} pl-10`} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-600 dark:text-slate-400 text-sm">{t('login.senha')}</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input type={showPassword ? 'text' : 'password'} placeholder={t('login.senha_placeholder')} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className={`${inputClass} pl-10 pr-10`} />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-600 dark:text-slate-400 text-sm">{t('login.confirmar_senha')}</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input type="password" placeholder={t('login.repita_senha')} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className={`${inputClass} pl-10`} />
                    </div>
                  </div>
                  {error && <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3"><p className="text-red-600 dark:text-red-400 text-sm">{error}</p></div>}
                  <Button type="submit" className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium" disabled={loading}>
                    {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    <UserPlus className="w-4 h-4 mr-2" />
                    {t('login.criar_conta')}
                  </Button>
                  <button type="button" className="w-full text-center text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors" onClick={() => switchMode('login')}>
                    <ArrowLeft className="w-3.5 h-3.5 inline mr-1" />{t('login.ja_tenho_conta')}
                  </button>
                </form>
              </div>
            )}

            {/* LOGIN */}
            {mode === 'login' && (
              <div className="space-y-6">
                <div className="space-y-1">
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{t('login.bem_vindo')}</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">{t('login.credenciais')}</p>
                </div>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-slate-600 dark:text-slate-400 text-sm">{t('login.email')}</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input type="email" placeholder={t('login.emailPlaceholder')} value={email} onChange={(e) => setEmail(e.target.value)} required className={`${inputClass} pl-10`} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-slate-600 dark:text-slate-400 text-sm">{t('login.senha')}</Label>
                      <button type="button" className="text-xs text-blue-600 hover:text-blue-700 transition-colors" onClick={() => switchMode('reset')}>
                        {t('login.esqueceu_senha')}
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input type={showPassword ? 'text' : 'password'} placeholder={t('login.senhaPlaceholder')} value={password} onChange={(e) => setPassword(e.target.value)} required className={`${inputClass} pl-10 pr-10`} />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  {error && <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3"><p className="text-red-600 dark:text-red-400 text-sm">{error}</p></div>}
                  <Button type="submit" className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-lg shadow-blue-600/20" disabled={loading}>
                    {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    {t('login.entrar')}
                  </Button>
                </form>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200 dark:border-slate-700"></div></div>
                  <div className="relative flex justify-center text-xs"><span className="bg-white dark:bg-slate-900 px-3 text-slate-400">{t('login.novo_sistema')}</span></div>
                </div>

                <Button type="button" variant="outline" className="w-full h-11 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 font-medium" onClick={() => switchMode('register')}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  {t('login.solicitar_acesso')}
                </Button>
              </div>
            )}
          </div>

          <div className="text-center mt-6 space-y-1">
            <p className="text-slate-500 text-[11px] tracking-wide font-medium">SGA · Direcção de Operações · v2.0</p>
            <p className="text-slate-400 text-xs">
              <a href="/PoliticaPrivacidade" className="hover:text-slate-600 dark:hover:text-slate-400 underline">{t('login.politica_privacidade')}</a>
              {' · '}
              <a href="/TermosServico" className="hover:text-slate-600 dark:hover:text-slate-400 underline">{t('login.termos_servico')}</a>
            </p>
          </div>
        </div>
      </div>

      <AlertModal
        isOpen={externalEmailModal}
        onClose={() => setExternalEmailModal(false)}
        type="warning"
        title={EXTERNAL_EMAIL_NOTICE.title}
        message={EXTERNAL_EMAIL_NOTICE.message}
        confirmText="Entendi"
      />
    </div>
  );
}
