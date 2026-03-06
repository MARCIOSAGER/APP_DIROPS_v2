import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verificar se é admin
    if (user.role !== 'admin' && !(user.perfis && user.perfis.includes('administrador'))) {
      return Response.json({ error: 'Acesso negado. Apenas administradores.' }, { status: 403 });
    }

    const { regra_id, destinatario_email, destinatario_whatsapp, user_id_test } = await req.json();

    if (!regra_id) {
      return Response.json({ error: 'ID da regra é obrigatório' }, { status: 400 });
    }

    // Carregar a regra
    const regras = await base44.asServiceRole.entities.RegraNotificacao.filter({ id: regra_id });
    if (!regras || regras.length === 0) {
      return Response.json({ error: 'Regra não encontrada' }, { status: 404 });
    }

    const regra = regras[0];

    // Dados de exemplo baseados no evento
    const dadosExemplo = {
      voo_ligado_criado: {
        numero_voo_arr: 'DT123',
        numero_voo_dep: 'DT456',
        aeroporto: 'FNLU',
        aeroporto_origem: 'FNSA',
        aeroporto_destino: 'FNHU',
        companhia: 'TAAG',
        registo: 'D2-TEF',
        tipo_voo: 'Regular',
        status: 'Realizado',
        data_arr: '2026-01-20',
        hora_arr: '14:35',
        horario_previsto_arr: '14:30',
        horario_real_arr: '14:35',
        data_dep: '2026-01-20',
        hora_dep: '16:50',
        horario_previsto_dep: '16:45',
        horario_real_dep: '16:50',
        permanencia_horas: '2.5',
        permanencia_minutos: '150',
        passageiros_local_arr: '100',
        passageiros_local_dep: '115',
        passageiros_transito_arr: '20',
        passageiros_transito_dep: '18',
        passageiros_total_arr: '120',
        passageiros_total_dep: '133',
        tripulacao_arr: '8',
        tripulacao_dep: '8',
        carga_kg_arr: '1800',
        carga_kg_dep: '2200',
        mtow_kg: '75000',
        tarifa_pouso_usd: '450.00',
        tarifa_permanencia_usd: '125.50',
        tarifa_passageiros_usd: '540.00',
        tarifa_carga_usd: '134.50',
        total_usd: '1,250.00',
        total_aoa: '1,062,500',
        taxa_cambio: '850',
        created_by: 'operador@sga.ao',
        created_date: '2026-01-20 14:30'
      },
      voo_atualizado: {
        numero_voo: 'DT789',
        aeroporto: 'FNLU',
        aeroporto_origem: 'FNSA',
        aeroporto_destino: 'FNHU',
        status: 'Realizado',
        horario: '14:30',
        companhia: 'TAAG',
        updated_by: 'operador@sga.ao',
        updated_date: '2026-01-20 15:00'
      },
      voo_cancelado: {
        numero_voo: 'DT321',
        aeroporto: 'FNLU',
        companhia: 'TAAG',
        motivo: 'Condições meteorológicas',
        updated_by: 'operador@sga.ao',
        updated_date: '2026-01-20 16:00'
      },
      documento_novo: {
        titulo_documento: 'Manual de Operações',
        categoria: 'manual_operacoes',
        aeroporto: 'FNLU',
        autor: 'João Silva',
        created_by: 'operador@sga.ao',
        created_date: '2026-01-20'
      },
      credenciamento_novo: {
        nome: 'João Silva',
        empresa: 'TAAG',
        area_acesso: 'Terminal Internacional',
        aeroporto: 'FNLU',
        created_by: 'operador@sga.ao',
        created_date: '2026-01-20'
      },
      reclamacao_nova: {
        numero_reclamacao: '#123',
        reclamante: 'Maria Santos',
        assunto: 'Atraso no Check-in',
        aeroporto: 'FNLU',
        created_by: 'operador@sga.ao',
        created_date: '2026-01-20'
      },
      inspecao_concluida: {
        tipo_inspecao: 'Inspeção de Pista',
        aeroporto: 'FNLU',
        inspetor: 'Carlos Mendes',
        conformidade: '95%',
        data_inspecao: '2026-01-20',
        created_by: 'operador@sga.ao',
        created_date: '2026-01-20'
      },
      auditoria_concluida: {
        tipo_auditoria: 'Auditoria de Segurança',
        aeroporto: 'FNLU',
        auditor: 'Ana Costa',
        conformidade: '98%',
        data_auditoria: '2026-01-20',
        created_by: 'operador@sga.ao',
        created_date: '2026-01-20'
      },
      ordem_servico_criada: {
        numero_os: '#456',
        prioridade: 'Alta',
        descricao: 'Reparo de iluminação na pista',
        aeroporto: 'FNLU',
        responsavel: 'Equipe de Manutenção',
        created_by: 'operador@sga.ao',
        created_date: '2026-01-20'
      }
    };

    const dados = dadosExemplo[regra.evento_gatilho] || { evento: regra.evento_gatilho };

    // Preencher templates com dados de exemplo
    const preencherTemplate = (template) => {
      if (!template) return '';
      let resultado = template;
      Object.keys(dados).forEach(key => {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        resultado = resultado.replace(regex, dados[key]);
      });
      return resultado;
    };

    const resultados = [];

    // Buscar configurações de WhatsApp
    const configs = await base44.asServiceRole.entities.ConfiguracaoNotificacoes.list();
    const configWhatsapp = configs.find(c => c.numero_whatsapp_oficial);

    // Enviar WhatsApp se configurado
    if (regra.canal_envio.includes('whatsapp') && regra.mensagem_template_whatsapp) {
      const mensagem = preencherTemplate(regra.mensagem_template_whatsapp);
      const mensagemComCabecalho = `🧪 *TESTE DE NOTIFICAÇÃO*\n\n${mensagem}\n\n_Esta é uma mensagem de teste do sistema DIROPS-SGA_`;

      // Se tem grupo_whatsapp_id, enviar para o grupo via Z-API
      if (regra.grupo_whatsapp_id) {
        try {
          console.log(`📱 Enviando teste para grupo WhatsApp: ${regra.grupo_whatsapp_id}`);
          
          const zapiResult = await base44.asServiceRole.functions.invoke('sendWhatsAppMessageToGroupZAPI', {
            groupId: regra.grupo_whatsapp_id,
            body: mensagemComCabecalho
          });

          resultados.push({ 
            canal: 'whatsapp', 
            status: 'enviado',
            destinatario: `Grupo WhatsApp (${regra.grupo_whatsapp_id})`,
            metodo: 'grupo_zapi'
          });
        } catch (error) {
          console.error('Erro ao enviar WhatsApp de teste para grupo:', error);
          resultados.push({ 
            canal: 'whatsapp', 
            status: 'erro',
            erro: error.message,
            detalhes: 'Verifique se o ID do grupo está correto e se a instância Z-API está conectada.'
          });
        }
      } else {
        // Envio individual (lógica original)
        if (!configWhatsapp || !configWhatsapp.numero_whatsapp_oficial) {
          resultados.push({
            canal: 'whatsapp',
            status: 'aviso',
            mensagem: 'Número oficial do WhatsApp não configurado nas Configurações de Notificações.'
          });
        } else {
          try {
            let targetUser = user;
            if (user_id_test) {
              targetUser = await base44.asServiceRole.entities.User.get(user_id_test);
            }

            const numeroDestino = destinatario_whatsapp || targetUser?.whatsapp_number || targetUser?.telefone;

            if (numeroDestino) {
              // Para testes, não verificar opt-in
              const whatsappResult = await base44.asServiceRole.functions.invoke('sendWhatsAppMessage', {
                from: configWhatsapp.numero_whatsapp_oficial,
                to: numeroDestino,
                body: mensagemComCabecalho
              });

              resultados.push({ 
                canal: 'whatsapp', 
                status: 'enviado',
                destinatario: numeroDestino
              });
            } else {
              resultados.push({ 
                canal: 'whatsapp', 
                status: 'aviso',
                mensagem: 'Número de WhatsApp não fornecido e não encontrado no perfil do utilizador'
              });
            }
          } catch (error) {
            console.error('Erro ao enviar WhatsApp de teste:', error);
            resultados.push({ 
              canal: 'whatsapp', 
              status: 'erro',
              erro: error.message
            });
          }
        }
      }
    }

    // Enviar Email se configurado
    if (regra.canal_envio.includes('email') && regra.mensagem_template_email_assunto && regra.mensagem_template_email_corpo) {
      const assunto = `🧪 [TESTE] ${preencherTemplate(regra.mensagem_template_email_assunto)}`;
      const corpo = preencherTemplate(regra.mensagem_template_email_corpo);
      
      // Adicionar cabeçalho de teste ao corpo
      const corpoComCabecalho = `
        <div style="background: #fff3cd; border: 2px solid #ffc107; padding: 15px; margin-bottom: 20px; border-radius: 8px;">
          <h3 style="color: #856404; margin: 0 0 10px 0;">🧪 TESTE DE NOTIFICAÇÃO</h3>
          <p style="color: #856404; margin: 0; font-size: 14px;">Esta é uma mensagem de teste do sistema DIROPS-SGA. Em produção, esta mensagem seria enviada aos destinatários configurados.</p>
        </div>
        ${corpo}
      `;

      try {
        const emailDestino = destinatario_email || user.email;
        
        await base44.integrations.Core.SendEmail({
          to: emailDestino,
          subject: assunto,
          body: corpoComCabecalho
        });
        
        resultados.push({ 
          canal: 'email', 
          status: 'enviado',
          destinatario: emailDestino
        });
      } catch (error) {
        console.error('Erro ao enviar email de teste:', error);
        resultados.push({ 
          canal: 'email', 
          status: 'erro',
          erro: error.message
        });
      }
    }

    return Response.json({ 
      sucesso: true,
      mensagem: 'Notificação de teste enviada',
      resultados: resultados
    });

  } catch (error) {
    console.error('Erro ao enviar notificação de teste:', error);
    return Response.json({ 
      error: 'Erro ao enviar notificação de teste',
      details: error.message 
    }, { status: 500 });
  }
});