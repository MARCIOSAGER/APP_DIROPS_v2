import { User } from '@/entities/User';

export const authService = {
  // Login com email e senha (novo sistema Beta da Base44)
  async login(email, password) {
    try {
      // Tentar login com email e senha usando o sistema Beta
      const response = await User.loginWithEmailPassword(email, password);
      
      if (response && response.user) {
        // Login bem-sucedido
        return response;
      } else {
        throw new Error('Credenciais inválidas');
      }
    } catch (error) {
      console.error('Erro no login:', error);
      throw new Error(error.message || 'Erro ao fazer login. Verifique suas credenciais.');
    }
  },

  // Registo de novo utilizador com email e senha
  async register(email, password, userData) {
    try {
      // Criar conta com email e senha usando o sistema Beta
      const response = await User.signUpWithEmailPassword(email, password, userData);
      
      if (response && response.user) {
        return response;
      } else {
        throw new Error('Erro ao criar conta');
      }
    } catch (error) {
      console.error('Erro no registo:', error);
      throw new Error(error.message || 'Erro ao criar conta. Tente novamente.');
    }
  },

  // Obter dados do utilizador atual (mantém o método original mas com tratamento de erro melhorado)
  async me() {
    try {
      const user = await User.me();
      return user;
    } catch (error) {
      console.error('Erro ao obter dados do utilizador:', error);
      throw new Error('Sessão expirada. Por favor, faça login novamente.');
    }
  },

  // Logout (usar o método nativo da Base44)
  async logout() {
    try {
      await User.logout();
    } catch (error) {
      console.error('Erro no logout:', error);
    } finally {
      // Forçar redirecionamento para página de validação
      window.location.href = '/pages/ValidacaoAcesso';
    }
  },

  // Verificar se está autenticado
  async isAuthenticated() {
    try {
      await this.me();
      return true;
    } catch (error) {
      return false;
    }
  },

  // Login com redirecionamento (mantém compatibilidade)
  async loginWithRedirect(callbackUrl) {
    try {
      await User.loginWithRedirect(callbackUrl);
    } catch (error) {
      console.error('Erro no login com redirecionamento:', error);
      throw error;
    }
  }
};