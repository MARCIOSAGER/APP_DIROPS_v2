import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plane, Loader2, Eye, EyeOff, UserPlus, Mail, Lock, ArrowLeft, CheckCircle2, Shield, User } from 'lucide-react';

const LogoDirops = ({ className = "w-14 h-14", variant = "dark" }) => (
  <img src={variant === "light" ? "/logo-dirops-light.png" : "/logo-dirops.png"} alt="DIROPS" className={className} />
);

export default function Login() {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState('login');

  useEffect(() => {
    if (!isLoadingAuth && isAuthenticated) {
      window.location.replace('/Home');
    }
  }, [isLoadingAuth, isAuthenticated]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(signInError.message === 'Invalid login credentials'
          ? 'Email ou senha incorretos'
          : signInError.message);
        setLoading(false);
        return;
      }
      window.location.replace('/Home');
    } catch (err) {
      setError('Erro: ' + err.message);
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    if (password !== confirmPassword) { setError('As senhas nao coincidem.'); setLoading(false); return; }
    if (password.length < 6) { setError('A senha deve ter pelo menos 6 caracteres.'); setLoading(false); return; }
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
          ? 'Este email ja esta registado. Faca login ou recupere a senha.'
          : signUpError.message);
        setLoading(false);
        return;
      }
      if (data?.user && !data.session) { setMode('register_sent'); }
      else if (data?.session) { window.location.replace('/SolicitacaoPerfil'); }
    } catch (err) {
      setError('Erro ao registar: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/AlterarSenha`,
    });
    if (error) { setError(error.message); setLoading(false); return; }
    setMode('reset_sent');
    setLoading(false);
  };

  const switchMode = (newMode) => { setMode(newMode); setError(null); };

  const inputClass = "h-11 bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500/20 transition-colors";

  return (
    <div className="min-h-screen flex bg-white relative overflow-hidden">

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
            <LogoDirops className="w-16 h-16 drop-shadow-lg" />
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">DIROPS</h1>
              <p className="text-blue-300/70 text-sm font-medium">Sistema de Gestao Aeroportuaria</p>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-4xl font-bold text-white leading-tight">
              Gestao integrada de
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400"> operacoes aeroportuarias</span>
            </h2>
            <p className="text-slate-400 text-lg leading-relaxed">
              Controle de voos, tarifas, seguranca, auditorias e credenciamentos num unico sistema.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4">
            {[
              { icon: Plane, label: 'Operacoes de Voo', desc: 'Gestao completa de movimentos' },
              { icon: Shield, label: 'Safety & Auditorias', desc: 'Conformidade e seguranca' },
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
                <h1 className="text-xl font-bold text-slate-900">DIROPS</h1>
                <p className="text-slate-500 text-xs">Sistema de Gestao Aeroportuaria</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-xl shadow-slate-200/50">

            {/* SUCCESS STATES */}
            {mode === 'reset_sent' && (
              <div className="text-center space-y-5 py-4">
                <div className="mx-auto w-16 h-16 bg-green-50 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-slate-900">Email enviado</h3>
                  <p className="text-slate-500 text-sm">
                    Enviamos um link de recuperacao para <strong className="text-slate-700">{email}</strong>. Verifique a sua caixa de entrada.
                  </p>
                </div>
                <Button variant="outline" className="w-full border-slate-200 text-slate-700 hover:bg-slate-50 h-11" onClick={() => switchMode('login')}>
                  <ArrowLeft className="w-4 h-4 mr-2" /> Voltar ao login
                </Button>
              </div>
            )}

            {mode === 'register_sent' && (
              <div className="text-center space-y-5 py-4">
                <div className="mx-auto w-16 h-16 bg-green-50 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-slate-900">Conta criada</h3>
                  <p className="text-slate-500 text-sm">
                    Verifique o email <strong className="text-slate-700">{email}</strong> para confirmar o registo.
                  </p>
                  <p className="text-slate-400 text-xs">
                    Apos confirmar, faca login para solicitar o seu perfil de acesso.
                  </p>
                </div>
                <Button variant="outline" className="w-full border-slate-200 text-slate-700 hover:bg-slate-50 h-11" onClick={() => switchMode('login')}>
                  <ArrowLeft className="w-4 h-4 mr-2" /> Ir para login
                </Button>
              </div>
            )}

            {/* RESET PASSWORD */}
            {mode === 'reset' && (
              <div className="space-y-6">
                <div className="space-y-1">
                  <h3 className="text-xl font-semibold text-slate-900">Recuperar senha</h3>
                  <p className="text-slate-500 text-sm">Insira o seu email para receber o link de recuperacao.</p>
                </div>
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-slate-600 text-sm">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required className={`${inputClass} pl-10`} />
                    </div>
                  </div>
                  {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3"><p className="text-red-600 text-sm">{error}</p></div>}
                  <Button type="submit" className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium" disabled={loading}>
                    {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Enviar link de recuperacao
                  </Button>
                  <button type="button" className="w-full text-center text-sm text-slate-500 hover:text-slate-700 transition-colors" onClick={() => switchMode('login')}>
                    <ArrowLeft className="w-3.5 h-3.5 inline mr-1" />Voltar ao login
                  </button>
                </form>
              </div>
            )}

            {/* REGISTER */}
            {mode === 'register' && (
              <div className="space-y-6">
                <div className="space-y-1">
                  <h3 className="text-xl font-semibold text-slate-900">Solicitar acesso</h3>
                  <p className="text-slate-500 text-sm">Crie a sua conta para solicitar acesso ao sistema.</p>
                </div>
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-slate-600 text-sm">Nome completo</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input type="text" placeholder="Seu nome completo" value={fullName} onChange={(e) => setFullName(e.target.value)} required className={`${inputClass} pl-10`} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-600 text-sm">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required className={`${inputClass} pl-10`} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-600 text-sm">Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input type={showPassword ? 'text' : 'password'} placeholder="Min. 6 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className={`${inputClass} pl-10 pr-10`} />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-600 text-sm">Confirmar senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input type="password" placeholder="Repita a senha" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className={`${inputClass} pl-10`} />
                    </div>
                  </div>
                  {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3"><p className="text-red-600 text-sm">{error}</p></div>}
                  <Button type="submit" className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium" disabled={loading}>
                    {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    <UserPlus className="w-4 h-4 mr-2" />
                    Criar conta
                  </Button>
                  <button type="button" className="w-full text-center text-sm text-slate-500 hover:text-slate-700 transition-colors" onClick={() => switchMode('login')}>
                    <ArrowLeft className="w-3.5 h-3.5 inline mr-1" />Ja tenho conta
                  </button>
                </form>
              </div>
            )}

            {/* LOGIN */}
            {mode === 'login' && (
              <div className="space-y-6">
                <div className="space-y-1">
                  <h3 className="text-xl font-semibold text-slate-900">Bem-vindo de volta</h3>
                  <p className="text-slate-500 text-sm">Insira as suas credenciais para aceder ao sistema.</p>
                </div>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-slate-600 text-sm">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required className={`${inputClass} pl-10`} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-slate-600 text-sm">Senha</Label>
                      <button type="button" className="text-xs text-blue-600 hover:text-blue-700 transition-colors" onClick={() => switchMode('reset')}>
                        Esqueceu a senha?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input type={showPassword ? 'text' : 'password'} placeholder="Sua senha" value={password} onChange={(e) => setPassword(e.target.value)} required className={`${inputClass} pl-10 pr-10`} />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3"><p className="text-red-600 text-sm">{error}</p></div>}
                  <Button type="submit" className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-lg shadow-blue-600/20" disabled={loading}>
                    {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Entrar
                  </Button>
                </form>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
                  <div className="relative flex justify-center text-xs"><span className="bg-white px-3 text-slate-400">Novo no sistema?</span></div>
                </div>

                <Button type="button" variant="outline" className="w-full h-11 border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 font-medium" onClick={() => switchMode('register')}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Solicitar acesso
                </Button>
              </div>
            )}
          </div>

          <p className="text-center text-slate-400 text-xs mt-6">
            DIROPS v2.0
          </p>
        </div>
      </div>
    </div>
  );
}
