import { supabase } from '@/lib/supabaseClient';

// Escapa valores dinâmicos antes de os interpolar no HTML dos e-mails (anti-XSS armazenado).
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Obtém os e-mails de todos os administradores cadastrados na aplicação
 */
export async function getAdminEmails() {
  try {
    // Prioridade: campo DEDICADO de registros → campo de novos acessos (fallback) → admins
    const { data: config } = await supabase
      .from('configuracao_sistema')
      .select('email_notificacao_registros, email_notificacao_acessos')
      .order('created_date', { ascending: true }) // mesma linha canônica que a UI grava
      .limit(1)
      .single();
    const rawEmails = config?.email_notificacao_registros || config?.email_notificacao_acessos;
    if (rawEmails) {
      return rawEmails.split(',').map(e => e.trim()).filter(Boolean);
    }
    // Fallback: get all users with admin role
    const { data: admins } = await supabase
      .from('users')
      .select('email')
      .or('role.eq.admin,perfis.cs.{administrador}');
    if (admins?.length) {
      return admins.map(a => a.email).filter(Boolean);
    }
  } catch (err) {
    console.warn('[getAdminEmails] Erro ao buscar admins:', err.message);
  }
  return [];
}

/**
 * Matriz de interruptores (Config Gerais) por tipo × ação. Default = LIGADO (só desliga
 * se o flag estiver explicitamente `false`).
 * cfg.notificacoes_registros = { registo:{criacao,edicao}, aeroporto:{…}, companhia:{…} }
 */
async function notificacaoRegistroAtiva(entityType, acao) {
  try {
    const { data: config } = await supabase
      .from('configuracao_sistema')
      .select('notificacoes_registros')
      .order('created_date', { ascending: true })
      .limit(1)
      .single();
    return config?.notificacoes_registros?.[entityType]?.[acao] !== false;
  } catch {
    return true; // em erro, mantém o comportamento atual (ligado)
  }
}

/**
 * Remove campos internos do Base44 antes de mostrar no e-mail
 */
function cleanEntityData(data) {
  const cleaned = { ...data };
  // Remover campos internos do Base44
  delete cleaned.id;
  delete cleaned.created_date;
  delete cleaned.updated_date;
  delete cleaned.created_by;
  delete cleaned.updated_by;
  return cleaned;
}

/**
 * Envia e-mail usando a função backend sendNotificationEmail
 */
async function sendNotificationEmail(to, subject, body) {
  try {
    const { sendNotificationEmail } = await import('@/functions/sendNotificationEmail');
    const response = await sendNotificationEmail({ to, subject, body });
    return response?.data || response;
  } catch (error) {
    console.error('Erro ao enviar e-mail de notificação:', error);
    throw error;
  }
}

/**
 * Envia notificação para administradores sobre criação de entidade
 */
export async function notifyAdminsCreation(entityType, entityData, createdBy, additionalInfo = {}) {
  try {
    if (!(await notificacaoRegistroAtiva(entityType, 'criacao'))) return; // interruptor em Configurações Gerais
    const adminEmails = await getAdminEmails();

    if (adminEmails.length === 0) {
      console.warn('⚠️ Nenhum administrador encontrado para enviar notificação');
      return;
    }

    const entityNames = {
      'aeroporto': 'Aeroporto',
      'companhia': 'Companhia Aérea',
      'modelo': 'Modelo de Aeronave',
      'registo': 'Registo de Aeronave'
    };

    const entityName = entityNames[entityType] || entityType;

    // Criar descrição dos campos principais baseado no tipo
    let mainFieldsDescription = '';
    switch(entityType) {
      case 'aeroporto':
        mainFieldsDescription = `
          <strong>Código ICAO:</strong> ${esc(entityData.codigo_icao || 'N/A')}<br>
          <strong>Código IATA:</strong> ${esc(entityData.codigo_iata || 'N/A')}<br>
          <strong>Nome:</strong> ${esc(entityData.nome || 'N/A')}<br>
          <strong>Cidade:</strong> ${esc(entityData.cidade || 'N/A')}<br>
          <strong>Província:</strong> ${esc(entityData.provincia || 'N/A')}<br>
          <strong>País:</strong> ${esc(entityData.pais || 'N/A')}<br>
          <strong>Tipo de Operação:</strong> ${esc(entityData.tipo_operacao || 'N/A')}<br>
          <strong>Categoria:</strong> ${esc(entityData.categoria || 'N/A')}<br>
          <strong>Status:</strong> ${esc(entityData.status || 'N/A')}
        `;
        break;
      case 'companhia':
        mainFieldsDescription = `
          <strong>Código ICAO:</strong> ${esc(entityData.codigo_icao || 'N/A')}<br>
          <strong>Código IATA:</strong> ${esc(entityData.codigo_iata || 'N/A')}<br>
          <strong>Nome:</strong> ${esc(entityData.nome || 'N/A')}<br>
          <strong>Nacionalidade:</strong> ${esc(entityData.nacionalidade || 'N/A')}<br>
          <strong>Tipo:</strong> ${esc(entityData.tipo || 'N/A')}<br>
          <strong>Status:</strong> ${esc(entityData.status || 'N/A')}
        `;
        break;
      case 'modelo':
        mainFieldsDescription = `
          <strong>Modelo:</strong> ${esc(entityData.modelo || 'N/A')}<br>
          <strong>Código ICAO:</strong> ${esc(entityData.codigo_icao || 'N/A')}<br>
          <strong>Código IATA:</strong> ${esc(entityData.codigo_iata || 'N/A')}<br>
          <strong>MTOW (kg):</strong> ${esc(entityData.mtow_kg ? `${entityData.mtow_kg} kg` : 'N/A')}<br>
          <strong>Comprimento (m):</strong> ${esc(entityData.comprimento_m ? `${entityData.comprimento_m} m` : 'N/A')}<br>
          <strong>Envergadura (m):</strong> ${esc(entityData.envergadura_m ? `${entityData.envergadura_m} m` : 'N/A')}<br>
          <strong>AC Code:</strong> ${esc(entityData.ac_code || 'N/A')}
        `;
        break;
      case 'registo':
        mainFieldsDescription = `
          <strong>Registo (matrícula):</strong> ${esc(entityData.registo || 'N/A')}<br>
          <strong>Modelo:</strong> ${esc(additionalInfo.modeloNome || 'N/A')}<br>
          <strong>Companhia:</strong> ${esc(additionalInfo.companhiaNome || 'N/A')}<br>
          <strong>MTOW:</strong> ${esc(entityData.mtow_kg ? `${entityData.mtow_kg} kg` : 'N/A')}<br>
          <strong>Total de Assentos:</strong> ${esc(entityData.total_assentos || 'N/A')}<br>
          <strong>First Class:</strong> ${esc(entityData.num_first || 0)} &nbsp;·&nbsp;
          <strong>Business:</strong> ${esc(entityData.num_business || 0)} &nbsp;·&nbsp;
          <strong>Premium:</strong> ${esc(entityData.num_premium || 0)} &nbsp;·&nbsp;
          <strong>Economy:</strong> ${esc(entityData.num_economy || 0)}
        `;
        break;
    }

    // Limpar dados para JSON completo
    const cleanedData = cleanEntityData(entityData);

    // Informações do utilizador que criou
    const userName = esc(createdBy?.full_name || 'N/A');
    const userEmail = esc(createdBy?.email || 'N/A');

    const subject = `✨ Novo ${entityName} Cadastrado no Sistema SGA`;
    const body = `
<div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">SGA</h1>
    <p style="color: #e0e7ff; margin: 10px 0 0 0;">Notificação de Criação</p>
  </div>
  
  <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e2e8f0;">
    <h2 style="color: #1e293b; margin: 0 0 20px 0; font-size: 20px;">Novo ${entityName} Cadastrado</h2>
    
    <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; margin-bottom: 20px;">
      <h3 style="margin: 0 0 15px 0; color: #475569; font-size: 16px;">📋 Campos Principais:</h3>
      ${mainFieldsDescription}
    </div>

    <div style="background: #eff6ff; padding: 15px; border-radius: 8px; border-left: 4px solid #3b82f6;">
      <p style="margin: 0; color: #1e40af; font-size: 14px;">
        <strong>👤 Criado por:</strong> ${userName}<br>
        <strong>📧 E-mail:</strong> ${userEmail}<br>
        <strong>📅 Data:</strong> ${new Date().toLocaleString('pt-AO')}
      </p>
    </div>
    
    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
      <p style="color: #64748b; font-size: 12px; margin: 0;">
        Esta é uma notificação automática do sistema SGA.<br>
        Por favor, não responda a este e-mail.
      </p>
    </div>
  </div>
</div>
    `;

    await sendNotificationEmail(adminEmails.join(','), subject, body);
    console.debug(`Notificação de criação de ${entityName} enviada para ${adminEmails.length} administradores`);
  } catch (error) {
    console.error(`❌ Erro ao enviar notificação de criação de ${entityType}:`, error);
  }
}

/**
 * Envia notificação para administradores sobre atualização de entidade
 */
export async function notifyAdminsUpdate(entityType, entityData, updatedBy, additionalInfo = {}) {
  try {
    if (!(await notificacaoRegistroAtiva(entityType, 'edicao'))) return; // interruptor em Configurações Gerais
    const adminEmails = await getAdminEmails();
    
    if (adminEmails.length === 0) {
      console.warn('⚠️ Nenhum administrador encontrado para enviar notificação');
      return;
    }

    const entityNames = {
      'aeroporto': 'Aeroporto',
      'companhia': 'Companhia Aérea',
      'modelo': 'Modelo de Aeronave',
      'registo': 'Registo de Aeronave'
    };

    const entityName = entityNames[entityType] || entityType;
    
    // Criar descrição dos campos principais baseado no tipo
    let mainFieldsDescription = '';
    switch(entityType) {
      case 'aeroporto':
        mainFieldsDescription = `
          <strong>Código ICAO:</strong> ${esc(entityData.codigo_icao || 'N/A')}<br>
          <strong>Código IATA:</strong> ${esc(entityData.codigo_iata || 'N/A')}<br>
          <strong>Nome:</strong> ${esc(entityData.nome || 'N/A')}<br>
          <strong>Cidade:</strong> ${esc(entityData.cidade || 'N/A')}<br>
          <strong>Província:</strong> ${esc(entityData.provincia || 'N/A')}<br>
          <strong>País:</strong> ${esc(entityData.pais || 'N/A')}<br>
          <strong>Tipo de Operação:</strong> ${esc(entityData.tipo_operacao || 'N/A')}<br>
          <strong>Categoria:</strong> ${esc(entityData.categoria || 'N/A')}<br>
          <strong>Status:</strong> ${esc(entityData.status || 'N/A')}
        `;
        break;
      case 'companhia':
        mainFieldsDescription = `
          <strong>Código ICAO:</strong> ${esc(entityData.codigo_icao || 'N/A')}<br>
          <strong>Código IATA:</strong> ${esc(entityData.codigo_iata || 'N/A')}<br>
          <strong>Nome:</strong> ${esc(entityData.nome || 'N/A')}<br>
          <strong>Nacionalidade:</strong> ${esc(entityData.nacionalidade || 'N/A')}<br>
          <strong>Tipo:</strong> ${esc(entityData.tipo || 'N/A')}<br>
          <strong>Status:</strong> ${esc(entityData.status || 'N/A')}
        `;
        break;
      case 'modelo':
        mainFieldsDescription = `
          <strong>Modelo:</strong> ${esc(entityData.modelo || 'N/A')}<br>
          <strong>Código ICAO:</strong> ${esc(entityData.codigo_icao || 'N/A')}<br>
          <strong>Código IATA:</strong> ${esc(entityData.codigo_iata || 'N/A')}<br>
          <strong>MTOW (kg):</strong> ${esc(entityData.mtow_kg ? `${entityData.mtow_kg} kg` : 'N/A')}<br>
          <strong>Comprimento (m):</strong> ${esc(entityData.comprimento_m ? `${entityData.comprimento_m} m` : 'N/A')}<br>
          <strong>Envergadura (m):</strong> ${esc(entityData.envergadura_m ? `${entityData.envergadura_m} m` : 'N/A')}<br>
          <strong>AC Code:</strong> ${esc(entityData.ac_code || 'N/A')}
        `;
        break;
      case 'registo':
        mainFieldsDescription = `
          <strong>Matrícula:</strong> ${esc(entityData.registo || 'N/A')}<br>
          <strong>Modelo:</strong> ${esc(additionalInfo.modeloNome || 'N/A')}<br>
          <strong>Companhia:</strong> ${esc(additionalInfo.companhiaNome || 'N/A')}<br>
          <strong>MTOW (kg):</strong> ${esc(entityData.mtow_kg ? new Intl.NumberFormat('pt-AO').format(entityData.mtow_kg) : 'N/A')}<br>
          <strong>Total de Assentos:</strong> ${esc(entityData.total_assentos || 'N/A')}<br>
          <strong>Primeira Classe:</strong> ${esc(entityData.num_first || 0)}<br>
          <strong>Executiva:</strong> ${esc(entityData.num_business || 0)}<br>
          <strong>Premium Economy:</strong> ${esc(entityData.num_premium || 0)}<br>
          <strong>Económica:</strong> ${esc(entityData.num_economy || 0)}
        `;
        break;
    }

    // Limpar dados para JSON completo
    const cleanedData = cleanEntityData(entityData);

    // Informações do utilizador que atualizou
    const userName = esc(updatedBy?.full_name || 'N/A');
    const userEmail = esc(updatedBy?.email || 'N/A');

    const subject = `🔄 ${entityName} Atualizado no Sistema SGA`;
    const body = `
<div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">SGA</h1>
    <p style="color: #fef3c7; margin: 10px 0 0 0;">Notificação de Atualização</p>
  </div>
  
  <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e2e8f0;">
    <h2 style="color: #1e293b; margin: 0 0 20px 0; font-size: 20px;">${entityName} Atualizado</h2>
    
    <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin-bottom: 20px;">
      <h3 style="margin: 0 0 15px 0; color: #475569; font-size: 16px;">📋 Campos Principais:</h3>
      ${mainFieldsDescription}
    </div>

    <div style="background: #fffbeb; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b;">
      <p style="margin: 0; color: #92400e; font-size: 14px;">
        <strong>👤 Atualizado por:</strong> ${userName}<br>
        <strong>📧 E-mail:</strong> ${userEmail}<br>
        <strong>📅 Data:</strong> ${new Date().toLocaleString('pt-AO')}
      </p>
    </div>
    
    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
      <p style="color: #64748b; font-size: 12px; margin: 0;">
        Esta é uma notificação automática do sistema SGA.<br>
        Por favor, não responda a este e-mail.
      </p>
    </div>
  </div>
</div>
    `;

    await sendNotificationEmail(adminEmails.join(','), subject, body);
    console.debug(`Notificação de atualização de ${entityName} enviada para ${adminEmails.length} administradores`);
  } catch (error) {
    console.error(`❌ Erro ao enviar notificação de atualização de ${entityType}:`, error);
  }
}