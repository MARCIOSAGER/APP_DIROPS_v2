import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plane, Loader2, Eye, EyeOff, UserPlus, Mail, Lock, ArrowLeft, CheckCircle2, Shield, User } from 'lucide-react';
import { logAuthEvent } from '@/lib/auditLog';
import { useI18n } from '@/components/lib/i18n';

const LogoDirops = ({ className = "w-14 h-14", variant = "dark" }) => (
  <img src={variant === "light" ? "/logo-dirops-light.png" : "/logo-dirops.png"} alt="DIROPS" className={className} />
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
  const [mfaFactorId, setMfaFactorId] = useState(null);
  const [mfaCode, setMfaCode] = useState('');
  const loginLimiter = useRateLimit(5, 60000);
  const resetLimiter = useRateLimit(3, 60000);

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
        setError(signInError.message === 'Invalid login credentials'
          ? t('login.email_senha_incorretos')
          : signInError.message);
        setLoading(false);
        return;
      }
      // Check if MFA is required
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totpFactor = factors?.totp?.find(f => f.status === 'verified');
      if (totpFactor) {
        setMfaFactorId(totpFactor.id);
        setMode('mfa');
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
        setError(signUpError.message.includes('already registered')
          ? t('login.email_ja_registado')
          : signUpError.message);
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
    const { blocked, waitSec } = resetLimiter.check();
    if (blocked) { setError(t('login.demasiadas_tentativas').replace('{sec}', waitSec)); return; }
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/AlterarSenha`,
    });
    if (error) { setError(error.message); setLoading(false); return; }
    setMode('reset_sent');
    setLoading(false);
  };

  const handleMfaVerify = async (e) => {
    e.preventDefault();
    if (!mfaCode || mfaCode.length !== 6) { setError(t('login.insira_codigo')); return; }
    setLoading(true);
    setError(null);
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: mfaFactorId });
      if (challengeError) throw challengeError;
      const { error: verifyError } = await supabase.auth.mfa.verify({ factorId: mfaFactorId, challengeId: challenge.id, code: mfaCode });
      if (verifyError) {
        logAuthEvent('login_mfa_falha', email, 'Código MFA inválido');
        setError(t('login.codigo_invalido'));
        setLoading(false);
        return;
      }
      logAuthEvent('login', email, 'Login com 2FA bem-sucedido');
      window.location.replace('/Home');
    } catch (err) {
      setError(t('login.erroGenerico') + ' ' + err.message);
      setLoading(false);
    }
  };

  const switchMode = (newMode) => { setMode(newMode); setError(null); };

  const inputClass = "h-11 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500/20 transition-colors";

  return (
    <div className="min-h-screen flex bg-white dark:bg-slate-900 relative overflow-hidden">

      {/* Left side - Branding (dark panel, hidden on mobile) */}
      <div className="hidden lg:flex flex-1 items-center justify-center relative bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 p-12">
        {/* Background decorations */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
            backgroundSize: '60px 60px'
          }} />
        </div>

        <div className="max-w-lg space-y-8 relative z-10">
          <div className="flex items-center gap-4">
            <div className="bg-white rounded-2xl p-3 shadow-lg shadow-black/20">
              <LogoDirops className="w-12 h-12" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">DIROPS</h1>
              <p className="text-blue-300/70 text-sm font-medium">{t('login.sistema')}</p>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-4xl font-bold text-white leading-tight">
              {t('login.gestao_integrada')}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">{t('login.operacoes_aeroportuarias')}</span>
            </h2>
            <p className="text-slate-400 text-lg leading-relaxed">
              {t('login.controle')}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4">
            {[
              { icon: Plane, label: t('login.operacoes_voo'), desc: t('login.gestao_completa') },
              { icon: Shield, label: t('login.safety_auditorias'), desc: t('login.conformidade') },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 space-y-2">
                <Icon className="w-5 h-5 text-blue-400" />
                <p className="text-white font-medium text-sm">{label}</p>
                <p className="text-slate-500 text-xs">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right side - Form (white background) */}
      <div className="flex-1 flex items-center justify-center p-6 relative">
        <div className="w-full max-w-[420px]">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-2">
              <LogoDirops className="w-12 h-12 drop-shadow-md" variant="light" />
              <div className="text-left">
                <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">DIROPS</h1>
                <p className="text-slate-500 dark:text-slate-400 text-xs">{t('login.sistema')}</p>
              </div>
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

            {/* MFA VERIFICATION */}
            {mode === 'mfa' && (
              <div className="space-y-6">
                <div className="space-y-1">
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{t('login.verificacao_2fa')}</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">{t('login.codigo_autenticador')}</p>
                </div>
                <form onSubmit={handleMfaVerify} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-slate-600 dark:text-slate-400 text-sm">{t('login.codigo_verificacao')}</Label>
                    <div className="relative">
                      <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="000000"
                        value={mfaCode}
                        onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        maxLength={6}
                        required
                        className={`${inputClass} pl-10 text-center text-lg tracking-widest`}
                        autoFocus
                      />
                    </div>
                  </div>
                  {error && <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3"><p className="text-red-600 dark:text-red-400 text-sm">{error}</p></div>}
                  <Button type="submit" className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium" disabled={loading || mfaCode.length !== 6}>
                    {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    {t('login.verificar')}
                  </Button>
                  <button type="button" className="w-full text-center text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors" onClick={() => { setMode('login'); setMfaCode(''); setMfaFactorId(null); setError(null); }}>
                    <ArrowLeft className="w-3.5 h-3.5 inline mr-1" />{t('login.voltar_login')}
                  </button>
                </form>
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
                  <div className="relative flex justify-center text-xs"><span className="bg-white dark:bg-slate-900 px-3 text-slate-400">{t('login.ou')}</span></div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 font-medium"
                  disabled={loading}
                  onClick={async () => {
                    setLoading(true);
                    setError(null);
                    const { error } = await supabase.auth.signInWithOAuth({
                      provider: 'google',
                      options: { redirectTo: `${window.location.origin}/ValidacaoAcesso` },
                    });
                    if (error) {
                      setError(t('login.erroGenerico') + ' ' + error.message);
                      setLoading(false);
                    }
                  }}
                >
                  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  {t('login.entrar_google')}
                </Button>

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
            <p className="text-slate-400 text-xs">DIROPS v2.0</p>
            <p className="text-slate-400 text-xs">
              <a href="/PoliticaPrivacidade" className="hover:text-slate-600 dark:hover:text-slate-400 underline">{t('login.politica_privacidade')}</a>
              {' · '}
              <a href="/TermosServico" className="hover:text-slate-600 dark:hover:text-slate-400 underline">{t('login.termos_servico')}</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
