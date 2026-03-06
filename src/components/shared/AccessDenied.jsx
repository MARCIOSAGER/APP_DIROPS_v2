import React, { useEffect } from 'react';
import { createPageUrl } from '@/utils';
import { User } from '@/entities/User';

export default function AccessDenied() {
  useEffect(() => {
    const checkUserAndRedirect = async () => {
      try {
        const user = await User.me();
        
        // Se é um usuário novo sem perfis/aeroportos, redirecionar para formulário
        if (user && (!user.perfis || user.perfis.length === 0 || !user.aeroportos_acesso || user.aeroportos_acesso.length === 0)) {
          console.log('Novo usuário detectado - redirecionando para formulário de solicitação');
          window.location.href = createPageUrl('SolicitacaoPerfil');
        }
      } catch (error) {
        console.error('Erro ao verificar usuário:', error);
        // Se não autenticado, redirecionar para login
        window.location.href = createPageUrl('ValidacaoAcesso');
      }
    };

    checkUserAndRedirect();
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-slate-700">A verificar acesso...</p>
      </div>
    </div>
  );
}