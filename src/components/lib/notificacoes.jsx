import { User } from '@/entities/User';
import { supabase } from '@/lib/supabaseClient';

/**
 * Obtém os e-mails de todos os administradores cadastrados na aplicação
 */
export async function getAdminEmails() {
  try {
    // First try: read from configuracao_sistema
    const { data: config } = await supabase
      .from('configuracao_sistema')
      .select('email_notificacao_acessos')
      .limit(1)
      .single();
    if (config?.email_notificacao_acessos) {
      return config.email_notificacao_acessos.split(',').map(e => e.trim()).filter(Boolean);
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
          <strong>Código ICAO:</strong> ${entityData.codigo_icao || 'N/A'}<br>
          <strong>Código IATA:</strong> ${entityData.codigo_iata || 'N/A'}<br>
          <strong>Nome:</strong> ${entityData.nome || 'N/A'}<br>
          <strong>Cidade:</strong> ${entityData.cidade || 'N/A'}<br>
          <strong>Província:</strong> ${entityData.provincia || 'N/A'}<br>
          <strong>País:</strong> ${entityData.pais || 'N/A'}<br>
          <strong>Tipo de Operação:</strong> ${entityData.tipo_operacao || 'N/A'}<br>
          <strong>Categoria:</strong> ${entityData.categoria || 'N/A'}<br>
          <strong>Status:</strong> ${entityData.status || 'N/A'}
        `;
        break;
      case 'companhia':
        mainFieldsDescription = `
          <strong>Código ICAO:</strong> ${entityData.codigo_icao || 'N/A'}<br>
          <strong>Código IATA:</strong> ${entityData.codigo_iata || 'N/A'}<br>
          <strong>Nome:</strong> ${entityData.nome || 'N/A'}<br>
          <strong>Nacionalidade:</strong> ${entityData.nacionalidade || 'N/A'}<br>
          <strong>Tipo:</strong> ${entityData.tipo || 'N/A'}<br>
          <strong>Status:</strong> ${entityData.status || 'N/A'}
        `;
        break;
      case 'modelo':
        mainFieldsDescription = `
          <strong>Modelo:</strong> ${entityData.modelo || 'N/A'}<br>
          <strong>Código ICAO:</strong> ${entityData.codigo_icao || 'N/A'}<br>
          <strong>Código IATA:</strong> ${entityData.codigo_iata || 'N/A'}<br>
          <strong>MTOW (kg):</strong> ${entityData.mtow_kg ? `${entityData.mtow_kg} kg` : 'N/A'}<br>
          <strong>Comprimento (m):</strong> ${entityData.comprimento_m ? `${entityData.comprimento_m} m` : 'N/A'}<br>
          <strong>Envergadura (m):</strong> ${entityData.envergadura_m ? `${entityData.envergadura_m} m` : 'N/A'}<br>
          <strong>AC Code:</strong> ${entityData.ac_code || 'N/A'}
        `;
        break;
      case 'registo':
        mainFieldsDescription = `
          <strong>Registo:</strong> ${entityData.registo || 'N/A'}<br>
          <strong>MTOW (kg):</strong> ${entityData.mtow_kg ? `${entityData.mtow_kg} kg` : 'N/A'}<br>
          <strong>Total de Assentos:</strong> ${entityData.total_assentos || 'N/A'}<br>
          <strong>First Class:</strong> ${entityData.num_first || 0}<br>
          <strong>Business:</strong> ${entityData.num_business || 0}<br>
          <strong>Premium Economy:</strong> ${entityData.num_premium || 0}<br>
          <strong>Economy:</strong> ${entityData.num_economy || 0}
        `;
        break;
    }

    // Limpar dados para JSON completo
    const cleanedData = cleanEntityData(entityData);

    // Informações do utilizador que criou
    const userName = createdBy?.full_name || 'N/A';
    const userEmail = createdBy?.email || 'N/A';

    const subject = `✨ Novo ${entityName} Cadastrado no Sistema DIROPS`;
    const body = `
<div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">DIROPS</h1>
    <p style="color: #e0e7ff; margin: 10px 0 0 0;">Notificação de Criação</p>
  </div>
  
  <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e2e8f0;">
    <h2 style="color: #1e293b; margin: 0 0 20px 0; font-size: 20px;">Novo ${entityName} Cadastrado</h2>
    
    <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; margin-bottom: 20px;">
      <h3 style="margin: 0 0 15px 0; color: #475569; font-size: 16px;">📋 Campos Principais:</h3>
      ${mainFieldsDescription}
    </div>

    <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #8b5cf6; margin-bottom: 20px;">
      <h3 style="margin: 0 0 15px 0; color: #475569; font-size: 16px;">🔍 Detalhes Completos (JSON):</h3>
      <pre style="background: #1e293b; color: #e2e8f0; padding: 15px; border-radius: 6px; font-size: 12px; overflow-x: auto; margin: 0; font-family: 'Courier New', monospace;">${JSON.stringify(cleanedData, null, 2)}</pre>
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
        Esta é uma notificação automática do sistema DIROPS.<br>
        Por favor, não responda a este e-mail.
      </p>
    </div>
  </div>
</div>
    `;

    await sendNotificationEmail(adminEmails.join(','), subject, body);
    console.log(`✅ Notificação de criação de ${entityName} enviada para ${adminEmails.length} administradores`);
  } catch (error) {
    console.error(`❌ Erro ao enviar notificação de criação de ${entityType}:`, error);
  }
}

/**
 * Envia notificação para administradores sobre atualização de entidade
 */
export async function notifyAdminsUpdate(entityType, entityData, updatedBy, additionalInfo = {}) {
  try {
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
          <strong>Código ICAO:</strong> ${entityData.codigo_icao || 'N/A'}<br>
          <strong>Código IATA:</strong> ${entityData.codigo_iata || 'N/A'}<br>
          <strong>Nome:</strong> ${entityData.nome || 'N/A'}<br>
          <strong>Cidade:</strong> ${entityData.cidade || 'N/A'}<br>
          <strong>Província:</strong> ${entityData.provincia || 'N/A'}<br>
          <strong>País:</strong> ${entityData.pais || 'N/A'}<br>
          <strong>Tipo de Operação:</strong> ${entityData.tipo_operacao || 'N/A'}<br>
          <strong>Categoria:</strong> ${entityData.categoria || 'N/A'}<br>
          <strong>Status:</strong> ${entityData.status || 'N/A'}
        `;
        break;
      case 'companhia':
        mainFieldsDescription = `
          <strong>Código ICAO:</strong> ${entityData.codigo_icao || 'N/A'}<br>
          <strong>Código IATA:</strong> ${entityData.codigo_iata || 'N/A'}<br>
          <strong>Nome:</strong> ${entityData.nome || 'N/A'}<br>
          <strong>Nacionalidade:</strong> ${entityData.nacionalidade || 'N/A'}<br>
          <strong>Tipo:</strong> ${entityData.tipo || 'N/A'}<br>
          <strong>Status:</strong> ${entityData.status || 'N/A'}
        `;
        break;
      case 'modelo':
        mainFieldsDescription = `
          <strong>Modelo:</strong> ${entityData.modelo || 'N/A'}<br>
          <strong>Código ICAO:</strong> ${entityData.codigo_icao || 'N/A'}<br>
          <strong>Código IATA:</strong> ${entityData.codigo_iata || 'N/A'}<br>
          <strong>MTOW (kg):</strong> ${entityData.mtow_kg ? `${entityData.mtow_kg} kg` : 'N/A'}<br>
          <strong>Comprimento (m):</strong> ${entityData.comprimento_m ? `${entityData.comprimento_m} m` : 'N/A'}<br>
          <strong>Envergadura (m):</strong> ${entityData.envergadura_m ? `${entityData.envergadura_m} m` : 'N/A'}<br>
          <strong>AC Code:</strong> ${entityData.ac_code || 'N/A'}
        `;
        break;
      case 'registo':
        mainFieldsDescription = `
          <strong>Matrícula:</strong> ${entityData.registo || 'N/A'}<br>
          <strong>Modelo:</strong> ${additionalInfo.modeloNome || 'N/A'}<br>
          <strong>Companhia:</strong> ${additionalInfo.companhiaNome || 'N/A'}<br>
          <strong>MTOW (kg):</strong> ${entityData.mtow_kg ? new Intl.NumberFormat('pt-AO').format(entityData.mtow_kg) : 'N/A'}<br>
          <strong>Total de Assentos:</strong> ${entityData.total_assentos || 'N/A'}<br>
          <strong>Primeira Classe:</strong> ${entityData.num_first || 0}<br>
          <strong>Executiva:</strong> ${entityData.num_business || 0}<br>
          <strong>Premium Economy:</strong> ${entityData.num_premium || 0}<br>
          <strong>Económica:</strong> ${entityData.num_economy || 0}
        `;
        break;
    }

    // Limpar dados para JSON completo
    const cleanedData = cleanEntityData(entityData);

    // Informações do utilizador que atualizou
    const userName = updatedBy?.full_name || 'N/A';
    const userEmail = updatedBy?.email || 'N/A';

    const subject = `🔄 ${entityName} Atualizado no Sistema DIROPS`;
    const body = `
<div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">DIROPS</h1>
    <p style="color: #fef3c7; margin: 10px 0 0 0;">Notificação de Atualização</p>
  </div>
  
  <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e2e8f0;">
    <h2 style="color: #1e293b; margin: 0 0 20px 0; font-size: 20px;">${entityName} Atualizado</h2>
    
    <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin-bottom: 20px;">
      <h3 style="margin: 0 0 15px 0; color: #475569; font-size: 16px;">📋 Campos Principais:</h3>
      ${mainFieldsDescription}
    </div>

    <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #fb923c; margin-bottom: 20px;">
      <h3 style="margin: 0 0 15px 0; color: #475569; font-size: 16px;">🔍 Detalhes Completos (JSON):</h3>
      <pre style="background: #1e293b; color: #e2e8f0; padding: 15px; border-radius: 6px; font-size: 12px; overflow-x: auto; margin: 0; font-family: 'Courier New', monospace;">${JSON.stringify(cleanedData, null, 2)}</pre>
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
        Esta é uma notificação automática do sistema DIROPS.<br>
        Por favor, não responda a este e-mail.
      </p>
    </div>
  </div>
</div>
    `;

    await sendNotificationEmail(adminEmails.join(','), subject, body);
    console.log(`✅ Notificação de atualização de ${entityName} enviada para ${adminEmails.length} administradores`);
  } catch (error) {
    console.error(`❌ Erro ao enviar notificação de atualização de ${entityType}:`, error);
  }
}