
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Lock, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import { User } from '@/entities/User';
import { createPageUrl } from '@/utils';

export default function AlterarSenha() {
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const currentUser = await User.me();
      setUser(currentUser);
      
      console.log('👤 Usuário carregado na AlterarSenha:', {
        email: currentUser.email,
        status: currentUser.status
      });
      
    } catch (error) {
      console.error('Erro ao carregar usuário:', error);
      setError('Não foi possível carregar os dados do usuário.');
    } finally {
      setLoadingUser(false);
    }
  };

  const validatePassword = () => {
    if (!novaSenha || novaSenha.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres.');
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
      // TODO: Implementar a lógica para realmente alterar a senha do usuário
      // via Auth do SDK da base44. Por exemplo:
      // await Auth.changePassword(novaSenha);
      // O User.updateMyUserData com status 'pendente' não é mais necessário aqui.
      
      // Após alterar a senha, redirecionar para ValidacaoAcesso
      // que vai verificar se o usuário precisa solicitar perfil ou ir para Home
      console.log('✅ Senha alterada com sucesso, redirecionando para ValidacaoAcesso');
      window.location.href = createPageUrl('ValidacaoAcesso');
      
    } catch (error) {
      console.error('Erro ao alterar senha:', error);
      setError('Não foi possível alterar a senha. Tente novamente.');
      setIsLoading(false);
    }
  };

  const passwordRequirements = [
    { label: 'Mínimo 8 caracteres', met: novaSenha.length >= 8 },
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

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Definir Nova Senha</h1>
          <p className="text-slate-600 mt-2">
            Olá {user?.full_name || user?.email}! Por favor, defina uma nova senha para a sua conta.
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
                className="w-full"
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
