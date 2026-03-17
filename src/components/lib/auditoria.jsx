
import { LogAuditoria } from '@/entities/LogAuditoria';
import { User } from '@/entities/User';

// Função para registar ações no log de auditoria
export const registarAuditoria = async ({
  acao,
  entidade,
  entidadeId = null,
  dadosAntes = null,  
  dadosDepois = null,
  detalhes = '',
  modulo = 'sistema'
}) => {
  try {
    // Obter informações do utilizador atual
    const user = await User.me();
    if (!user) {
      console.warn('Tentativa de registar auditoria sem utilizador autenticado');
      return;
    }

    // Obter informações do navegador
    const userAgent = navigator.userAgent;
    
    // Criar registo de auditoria
    const logData = {
      usuario_email: user.email,
      usuario_nome: user.full_name || user.email,
      acao,
      entidade,
      entidade_id: entidadeId,
      dados_antes: dadosAntes,
      dados_depois: dadosDepois,
      detalhes,
      user_agent: userAgent,
      modulo
    };

    await LogAuditoria.create(logData);
    
  } catch (error) {
    console.error('Erro ao registar auditoria:', error);
    // Não interromper o fluxo principal se houver erro no log
  }
};

// Funções específicas para diferentes tipos de ações
export const registarExclusao = async (entidade, dadosExcluidos, modulo) => {
  await registarAuditoria({
    acao: 'excluir',
    entidade,
    entidadeId: dadosExcluidos.id,
    dadosAntes: dadosExcluidos,
    detalhes: `Registo excluído: ${JSON.stringify(dadosExcluidos, null, 2)}`,
    modulo
  });
};

export const registarCriacao = async (entidade, dadosCriados, modulo) => {
  await registarAuditoria({
    acao: 'criar',
    entidade,
    entidadeId: dadosCriados.id,
    dadosDepois: dadosCriados,
    detalhes: `Novo registo criado`,
    modulo
  });
};

export async function registarEdicao(usuario, entidade, entidadeId, dadosAntes, dadosDepois, modulo, detalhes = '') {
  try {
    // This dynamic import is technically redundant given LogAuditoria is imported at the top,
    // but it is included as per the provided outline.
    const { LogAuditoria } = await import('@/entities/LogAuditoria');
    
    await LogAuditoria.create({
      usuario_email: usuario.email,
      usuario_nome: usuario.full_name || usuario.email,
      acao: 'editar',
      entidade,
      entidade_id: entidadeId,
      dados_antes: dadosAntes,
      dados_depois: dadosDepois,
      detalhes,
      modulo
    });
  } catch (error) {
    console.error('Erro ao registar edição no log de auditoria:', error);
  }
}

export const registarExportacao = async (entidade, tipoExportacao, filtros, modulo) => {
  await registarAuditoria({
    acao: 'exportar',
    entidade,
    detalhes: `Exportação ${tipoExportacao} com filtros: ${JSON.stringify(filtros)}`,
    modulo
  });
};

export const registarLogin = async () => {
  await registarAuditoria({
    acao: 'login',
    entidade: 'User',
    detalhes: 'Utilizador fez login no sistema',
    modulo: 'gestao'
  });
};

export const registarLogout = async () => {
  await registarAuditoria({
    acao: 'logout', 
    entidade: 'User',
    detalhes: 'Utilizador fez logout do sistema',
    modulo: 'gestao'
  });
};
