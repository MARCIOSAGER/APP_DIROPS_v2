import React, { useEffect } from 'react';
import { createPageUrl } from '@/utils';
import { User } from '@/entities/User';
import { Aeroporto } from '@/entities/Aeroporto';
import { getAeroportosPermitidos } from '@/components/lib/userUtils';

export default function AccessDenied() {
  useEffect(() => {
    const checkUserAndRedirect = async () => {
      try {
        const user = await User.me();
        const allAeroportos = await Aeroporto.list();
        const aeroportosPermitidos = getAeroportosPermitidos(user, allAeroportos);

        // Se é um usuário novo sem perfis/aeroportos, redirecionar para formulário
        if (user && (!user.perfis || user.perfis.length === 0 || aeroportosPermitidos.length === 0)) {
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