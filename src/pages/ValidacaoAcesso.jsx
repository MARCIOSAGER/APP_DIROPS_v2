
import React, { useState, useEffect } from 'react';
import { User } from '@/entities/User';
import { SolicitacaoAcesso } from '@/entities/SolicitacaoAcesso'; // Added import for SolicitacaoAcesso
import { createPageUrl } from '@/utils';
import { Loader2 } from 'lucide-react';
import { ensureUserProfilesExist } from '@/components/lib/userUtils';

export default function ValidacaoAcesso() {
  const [status, setStatus] = useState('validating');

  useEffect(() => {
    validateAccess();
  }, []);

  const validateAccess = async () => {
    try {
      let user = await User.me();
      
      // Garantir que o usuário tem o array de perfis
      user = ensureUserProfilesExist(user);
      
      console.log('🔍 Validando acesso do usuário:', {
        email: user.email,
        status: user.status,
        perfis: user.perfis,
        role: user.role,
        id: user.id // Log user ID for debugging SolicitacaoAcesso filter
      });

      // Se o usuário está ativo e tem perfis, redirecionar para Home
      if (user.status === 'ativo' && user.perfis && Array.isArray(user.perfis) && user.perfis.length > 0) {
        console.log('➡️ Usuário ativo com perfis, redirecionando para Home');
        window.location.href = createPageUrl('Home');
        return;
      }

      // Verificar se existe uma solicitação pendente para este usuário
      const solicitacoesPendentes = await SolicitacaoAcesso.filter({ 
        user_id: user.id, // Assuming user.id is available after User.me()
        status: 'pendente'
      });

      if (solicitacoesPendentes && solicitacoesPendentes.length > 0) {
        console.log('➡️ Solicitação pendente encontrada, redirecionando para AguardandoAprovacao');
        window.location.href = createPageUrl('AguardandoAprovacao');
        return;
      }

      // Se não tem perfis (ou não está ativo) e não tem solicitação pendente, redirecionar para SolicitacaoPerfil
      // Esta condição abrange usuários sem status, com status 'pendente', ou 'inativo' que não tenham perfis e nenhuma solicitação pendente
      console.log('➡️ Usuário sem perfis ou sem status ativo e sem solicitação pendente, redirecionando para SolicitacaoPerfil');
      window.location.href = createPageUrl('SolicitacaoPerfil');
      
    } catch (error) {
      console.error('❌ Erro na validação de acesso:', error);
      
      // Se erro 401 (não autenticado), fazer login com redirect de volta
      if (error.response?.status === 401 || error.message?.includes('401') || error.message?.includes('not authenticated')) {
        console.log('➡️ Usuário não autenticado, iniciando login');
        try {
          // Redirecionar para login, e após login volta para ValidacaoAcesso
          await User.loginWithRedirect(window.location.href);
        } catch (loginError) {
          console.error('❌ Erro ao iniciar login:', loginError);
        }
        return;
      }

      // Para outros erros, tentar fazer login também (pode ser um token expirado, etc.)
      console.log('➡️ Erro desconhecido na validação de acesso, tentando fazer login');
      try {
        await User.loginWithRedirect(window.location.href);
      } catch (loginError) {
        console.error('❌ Erro ao iniciar login após erro desconhecido:', loginError);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-600 mb-4" />
        <p className="text-lg text-slate-700">A validar o seu acesso...</p>
        <p className="text-sm text-slate-500 mt-2">Por favor aguarde</p>
      </div>
    </div>
  );
}
