
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Lock, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { createPageUrl } from '@/utils';

export default function AlterarSenha() {
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    // Listen for PASSWORD_RECOVERY event from reset link
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[AlterarSenha] Auth event:', event);
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        if (session?.user) {
          setUser({ email: session.user.email, full_name: session.user.user_metadata?.full_name });
        }
        setLoadingUser(false);
      }
    });

    // Also check current session
    checkUser();

    return () => subscription.unsubscribe();
  }, []);

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser({ email: session.user.email, full_name: session.user.user_metadata?.full_name });
      }
    } catch (error) {
      console.error('Erro ao carregar usuário:', error);
    } finally {
      setLoadingUser(false);
    }
  };

  const validatePassword = () => {
    if (!novaSenha || novaSenha.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres.');
      return false;
    }
    if (!/[A-Z]/.test(novaSenha)) {
      setError('A senha deve conter pelo menos uma letra maiúscula.');
      return false;
    }
    if (!/[0-9]/.test(novaSenha)) {
      setError('A senha deve conter pelo menos um número.');
      return false;
    }
    if (novaSenha !== confirmarSenha) {
      setError('As senhas não coincidem.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validatePassword()) {
      return;
    }

    setIsLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: novaSenha,
      });

      if (updateError) {
        throw updateError;
      }

      setSuccess(true);
      console.log('[AlterarSenha] Senha alterada com sucesso');

      // Redirecionar após 2 segundos
      setTimeout(() => {
        window.location.href = createPageUrl('ValidacaoAcesso');
      }, 2000);

    } catch (error) {
      console.error('Erro ao alterar senha:', error);
      if (error.message?.includes('same_password')) {
        setError('A nova senha não pode ser igual à senha anterior.');
      } else {
        setError(error.message || 'Não foi possível alterar a senha. Tente novamente.');
      }
      setIsLoading(false);
    }
  };

  const passwordRequirements = [
    { label: 'Mínimo 8 caracteres', met: novaSenha.length >= 8 },
    { label: 'Pelo menos uma letra maiúscula', met: /[A-Z]/.test(novaSenha) },
    { label: 'Pelo menos um número', met: /[0-9]/.test(novaSenha) },
    { label: 'Senhas coincidem', met: novaSenha && novaSenha === confirmarSenha }
  ];

  if (loadingUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-600 mb-4" />
          <p className="text-lg text-slate-700">A carregar...</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Senha Alterada com Sucesso!</h2>
          <p className="text-slate-600">A redirecionar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Definir Nova Senha</h1>
          <p className="text-slate-600 mt-2">
            {user ? `Olá ${user.full_name || user.email}! ` : ''}Por favor, defina uma nova senha para a sua conta.
          </p>
        </div>

        <Card className="shadow-lg border-0">
          <CardHeader>
            <CardTitle>Criar Senha Segura</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div>
                <Label htmlFor="novaSenha">Nova Senha *</Label>
                <div className="relative">
                  <Input
                    id="novaSenha"
                    type={showPassword ? 'text' : 'password'}
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    placeholder="Digite a nova senha"
                    required
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <Label htmlFor="confirmarSenha">Confirmar Senha *</Label>
                <div className="relative">
                  <Input
                    id="confirmarSenha"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    placeholder="Confirme a nova senha"
                    required
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg space-y-2">
                <p className="text-sm font-medium text-slate-700 mb-2">Requisitos da senha:</p>
                {passwordRequirements.map((req, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    {req.met ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-slate-300" />
                    )}
                    <span className={req.met ? 'text-green-600' : 'text-slate-500'}>
                      {req.label}
                    </span>
                  </div>
                ))}
              </div>

              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                disabled={isLoading || !novaSenha || !confirmarSenha}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    A processar...
                  </>
                ) : (
                  'Confirmar Nova Senha'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
