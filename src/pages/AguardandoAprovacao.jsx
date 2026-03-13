import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, CheckCircle, Mail, ArrowLeft, RefreshCw } from 'lucide-react';
import { User } from '@/entities/User';
import { SolicitacaoAcesso } from '@/entities/SolicitacaoAcesso';
import { createPageUrl } from '@/utils';

export default function AguardandoAprovacao() {
  const [user, setUser] = useState(null);
  const [solicitacao, setSolicitacao] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (tentativa = 1) => {
    const MAX_TENTATIVAS = 3;
    setIsLoading(true);
    let currentUser = null;
    try {
      currentUser = await User.me();
      setUser(currentUser);

      // Buscar a solicitação pendente do utilizador (deve haver apenas uma)
      const solicitacoes = await SolicitacaoAcesso.filter({ 
        user_id: currentUser.id,
        status: 'pendente'
      }, '-created_date', 1);

      if (solicitacoes && solicitacoes.length > 0) {
        setSolicitacao(solicitacoes[0]);
      } else {
        // Se não há solicitação pendente, verificar se o utilizador já foi aprovado
        if (currentUser.perfis && Array.isArray(currentUser.perfis) && currentUser.perfis.length > 0 && currentUser.status === 'ativo') {
          console.log('Utilizador já aprovado, redirecionando para Home');
          window.location.href = createPageUrl('Home');
        }
        // Não redirecionar de volta para SolicitacaoPerfil para evitar loop
        // O utilizador pode ter acabado de submeter e o dado ainda não propagou
      }
    } catch (error) {
      console.error(`Erro ao carregar dados (tentativa ${tentativa}):`, error);
      
      // Retry com backoff se conexão instável
      if (tentativa < MAX_TENTATIVAS) {
        const tempoEspera = tentativa * 2000;
        console.log(`⏳ Tentando novamente em ${tempoEspera/1000}s...`);
        setTimeout(() => loadData(tentativa + 1), tempoEspera);
      } else {
        setIsLoading(false);
      }
    }
  };

  const handleVerificar = async () => {
    await loadData(1);
  };

  const handleLogout = async () => {
    try {
      await User.logout();
      window.location.href = createPageUrl('ValidacaoAcesso');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  if (isLoading && !user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-12 w-12 animate-spin mx-auto text-blue-600 mb-4" />
          <p className="text-lg text-slate-700">A carregar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <Card className="shadow-2xl border-0 bg-white/95 backdrop-blur">
          <CardHeader className="text-center bg-gradient-to-r from-amber-50 to-orange-50 border-b">
            <div className="bg-amber-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Clock className="w-12 h-12 text-amber-600 animate-pulse" />
            </div>
            <CardTitle className="text-3xl font-bold text-slate-900">
              Aguardando Aprovação
            </CardTitle>
            <p className="text-slate-600 mt-2">
              A sua solicitação de acesso foi recebida com sucesso!
            </p>
          </CardHeader>

          <CardContent className="p-8 space-y-6">
            {solicitacao && (
              <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
                <h3 className="font-semibold text-slate-700 mb-3">Detalhes da Solicitação</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Nome:</span>
                    <span className="font-medium text-slate-900">{solicitacao.nome_completo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Email:</span>
                    <span className="font-medium text-slate-900">{solicitacao.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Perfil Solicitado:</span>
                    <span className="font-medium text-slate-900 capitalize">
                      {solicitacao.perfil_solicitado.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Aeroportos:</span>
                    <span className="font-medium text-slate-900">
                      {solicitacao.aeroportos_solicitados?.length || 0} selecionados
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Status:</span>
                    <span className={`font-medium px-3 py-1 rounded-full text-xs ${
                      solicitacao.status === 'pendente' 
                        ? 'bg-amber-100 text-amber-800' 
                        : solicitacao.status === 'aprovado'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {solicitacao.status === 'pendente' ? 'Pendente' : 
                       solicitacao.status === 'aprovado' ? 'Aprovado' : 'Rejeitado'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="font-semibold text-blue-900 mb-2">Próximos Passos</h4>
                  <ul className="space-y-2 text-sm text-blue-800">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>A sua solicitação será analisada por um administrador</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>Receberá uma notificação por e-mail quando for aprovada</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>Após a aprovação, poderá aceder ao sistema</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                onClick={handleVerificar}
                disabled={isLoading}
                className="flex-1 h-12 text-base"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                    A verificar...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-5 w-5" />
                    Verificar Aprovação
                  </>
                )}
              </Button>
              
              <Button
                variant="outline"
                onClick={handleLogout}
                className="flex-1 h-12 text-base border-red-200 text-red-600 hover:bg-red-50"
              >
                <ArrowLeft className="mr-2 h-5 w-5" />
                Sair
              </Button>
            </div>

            <p className="text-center text-sm text-slate-500">
              Pode fechar esta janela e voltar mais tarde para verificar o status.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}