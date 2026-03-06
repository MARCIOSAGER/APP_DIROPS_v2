import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const payload = await req.json();

        // Helper function para enviar mensagens para grupos via Z-API
        const sendZAPIMessageToGroup = async (chatId, message) => {
            try {
                const instanceId = Deno.env.get('ID_INSTANCIA_ZAPI');
                const clientToken = Deno.env.get('CLIENT_TOKEN_ZAPI');
                const token = Deno.env.get('TOKEN_ZAPI');

                if (!instanceId || !clientToken || !token) {
                    console.error('❌ Credenciais Z-API não configuradas');
                    return;
                }

                const encodedToken = encodeURIComponent(token);
                const zapiUrl = `https://api.z-api.io/instances/${instanceId}/token/${encodedToken}/send-text`;

                console.log(`📤 Enviando mensagem para grupo ${chatId}...`);

                const response = await fetch(zapiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Client-Token': clientToken
                    },
                    body: JSON.stringify({
                        phone: chatId,
                        message: message
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`❌ Erro Z-API: ${response.status} - ${errorText}`);
                } else {
                    const data = await response.json();
                    console.log(`✅ Mensagem enviada! ID: ${data.messageId}`);
                }
            } catch (error) {
                console.error(`❌ Erro ao enviar mensagem Z-API:`, error);
            }
        };

        console.log('═══════════════════════════════════════════════════════');
        console.log('📩 WEBHOOK Z-API RECEBIDO');
        console.log('═══════════════════════════════════════════════════════');
        console.log(JSON.stringify(payload, null, 2));

        const eventType = payload.event || payload.type;
        const messageData = payload.data || payload;

        console.log(`\n🎯 Event Type: ${eventType}`);

        // Registrar o evento recebido
        await base44.asServiceRole.entities.MensagemWhatsApp.create({
            provedor: 'zapi',
            tipo_evento: eventType,
            from: messageData.from || messageData.phone || 'desconhecido',
            to: messageData.to || null,
            body: messageData.body || messageData.message || null,
            message_id: messageData.messageId || messageData.id,
            status: messageData.status || 'received',
            timestamp_evento: new Date().toISOString(),
            dados_completos: payload
        });

        // Se for uma mensagem recebida, processar opt-in/opt-out
        if (eventType === 'message.received' || eventType === 'ReceivedCallback' || eventType === 'received') {
            console.log('\n📨 ========== PROCESSANDO MENSAGEM RECEBIDA ==========');

            const phoneNumberRaw = messageData.from || messageData.phone;
            // Extrair texto da mensagem de várias fontes possíveis do Z-API
            let messageText = '';
            if (messageData.text && typeof messageData.text === 'object') {
                messageText = messageData.text.message || '';
            } else if (typeof messageData.text === 'string') {
                messageText = messageData.text;
            } else if (payload.text && typeof payload.text === 'object') {
                messageText = payload.text.message || '';
            } else {
                messageText = messageData.body || messageData.message || '';
            }
            const messageBody = messageText.toLowerCase().trim();
            const chatId = messageData.chatId || messageData.from || messageData.phone;
            const isGroup = messageData.isGroup || chatId.includes('@g.us') || chatId.includes('-group');

            // Limpar número
            const phoneNumber = phoneNumberRaw.replace('whatsapp:', '').replace(/\s/g, '');

            console.log(`\n📋 DADOS DA MENSAGEM:`);
            console.log(`   - Número (raw): ${phoneNumberRaw}`);
            console.log(`   - Número (limpo): ${phoneNumber}`);
            console.log(`   - Mensagem extraída: "${messageBody}"`);
            console.log(`   - Texto original (messageData.text):`, messageData.text);
            console.log(`   - Chat ID: ${chatId}`);
            console.log(`   - É Grupo?: ${isGroup}`);
            console.log(`\n🔍 DADOS COMPLETOS DO PAYLOAD (para debug de botões):`);
            console.log(JSON.stringify(messageData, null, 2));

            // Carregar configuração
            const configs = await base44.asServiceRole.entities.ConfiguracaoOptInZAPI.list();
            const defaultConfig = {
                palavras_chave_opt_in: ['sim', 'aceito', 'yes', 'ok', 'concordo'],
                palavras_chave_opt_out: ['parar', 'cancelar', 'stop', 'sair', 'remover'],
                mensagem_confirmacao_opt_in: '✅ Confirmado! Você está inscrito para receber notificações do DIROPS-SGA via WhatsApp.',
                mensagem_confirmacao_opt_out: '✅ Você foi removido da lista de notificações. Para voltar a receber, envie SIM.',
                enviar_resposta_automatica: true,
                ativo: true,
                grupos_palavras_registrar: ['registrar_grupo', 'registrar grupo', 'ativar_grupo'],
                grupos_palavras_parar: ['parar_notificacoes', 'parar notificacoes', 'desativar_notificacoes'],
                grupos_mensagem_registro_sucesso: '✅ Grupo registrado com sucesso no sistema DIROPS-SGA!\n\n📋 O registo está pendente de aprovação.\n\n⏳ Aguarde que um administrador aprove o grupo para começar a receber notificações automáticas.',
                grupos_mensagem_ja_registrado: '✅ Este grupo já está registrado no sistema DIROPS-SGA.\n\nAguarde a aprovação de um administrador para começar a receber notificações.',
                grupos_mensagem_desativacao: '🔕 Notificações desativadas com sucesso!\n\nEste grupo não receberá mais notificações automáticas do sistema DIROPS-SGA.\n\nPara reativar, envie: REGISTRAR_GRUPO',
                grupos_mensagem_nao_encontrado: '⚠️ Este grupo não está registrado no sistema.'
            };

            let config = defaultConfig;
            if (configs.length > 0) {
                config = { ...defaultConfig, ...configs[0] };
            }

            console.log(`\n⚙️ CONFIGURAÇÃO:`);
            console.log(`   - Sistema ativo?: ${config.ativo}`);
            console.log(`   - Palavras opt-in: ${JSON.stringify(config.palavras_chave_opt_in)}`);
            console.log(`   - Palavras opt-out: ${JSON.stringify(config.palavras_chave_opt_out)}`);

            if (!config.ativo) {
                console.log('\n⚠️ Sistema de opt-in DESATIVADO - encerrando processamento');
                return Response.json({ success: true, message: 'Sistema de opt-in desativado' });
            }

            // Processar grupos (se aplicável)
            if (isGroup) {
                const isRegistroGrupo = config.grupos_palavras_registrar?.some(keyword => 
                    messageBody.includes(keyword.toLowerCase())
                ) || false;

                const isPararNotificacoes = config.grupos_palavras_parar?.some(keyword => 
                    messageBody.includes(keyword.toLowerCase())
                ) || false;

                console.log(`\n🔍 Verificando comandos de grupo:`);
                console.log(`   - Mensagem recebida: "${messageBody}"`);
                console.log(`   - isRegistroGrupo: ${isRegistroGrupo}`);
                console.log(`   - isPararNotificacoes: ${isPararNotificacoes}`);
                console.log(`   - Palavras de registro: ${JSON.stringify(config.grupos_palavras_registrar)}`);
                console.log(`   - Palavras de parar: ${JSON.stringify(config.grupos_palavras_parar)}`);

                if (isRegistroGrupo) {
                    console.log(`\n✅ Comando de registro de grupo detectado!`);
                    
                    // Buscar grupo existente
                    let grupo = await base44.asServiceRole.entities.GrupoWhatsApp.filter({ chat_id: chatId });

                    if (grupo.length > 0) {
                        grupo = grupo[0];
                        console.log(`   - Grupo ${chatId} encontrado: status="${grupo.status}", notificacoes_ativas=${grupo.notificacoes_ativas}`);
                        
                        if (grupo.status === 'desativado' || !grupo.notificacoes_ativas) {
                            console.log(`   - Reativando grupo para status "pendente"...`);
                            await base44.asServiceRole.entities.GrupoWhatsApp.update(grupo.id, {
                                status: 'pendente',
                                notificacoes_ativas: true,
                                data_desativacao: null
                            });
                            
                            // Enviar mensagem de sucesso
                            await sendZAPIMessageToGroup(chatId, config.grupos_mensagem_registro_sucesso);
                        } else {
                            console.log(`   - Grupo já está registrado com status "${grupo.status}"`);
                            await sendZAPIMessageToGroup(chatId, config.grupos_mensagem_ja_registrado);
                        }
                    } else {
                        console.log(`   - Grupo ${chatId} não encontrado. Criando novo registro...`);
                        await base44.asServiceRole.entities.GrupoWhatsApp.create({
                            chat_id: chatId,
                            nome_grupo: messageData.chatName || `Grupo ${chatId}`,
                            nome_grupo_original: messageData.chatName || `Grupo ${chatId}`,
                            status: 'pendente',
                            notificacoes_ativas: true,
                            data_registro: new Date().toISOString()
                        });
                        
                        await sendZAPIMessageToGroup(chatId, config.grupos_mensagem_registro_sucesso);
                    }
                    
                    console.log(`✅ Processamento de registro de grupo concluído`);
                    return Response.json({ success: true, message: 'Grupo registrado/reativado' });
                    
                } else if (isPararNotificacoes) {
                    console.log(`\n🚫 Comando de desativação de notificações detectado!`);
                    
                    let grupo = await base44.asServiceRole.entities.GrupoWhatsApp.filter({ chat_id: chatId });

                    if (grupo.length > 0) {
                        grupo = grupo[0];
                        console.log(`   - Grupo ${chatId} encontrado. Desativando notificações...`);
                        
                        await base44.asServiceRole.entities.GrupoWhatsApp.update(grupo.id, {
                            status: 'desativado',
                            notificacoes_ativas: false,
                            data_desativacao: new Date().toISOString()
                        });
                        
                        await sendZAPIMessageToGroup(chatId, config.grupos_mensagem_desativacao);
                    } else {
                        console.log(`   - Grupo ${chatId} não encontrado para desativação.`);
                        await sendZAPIMessageToGroup(chatId, config.grupos_mensagem_nao_encontrado);
                    }
                    
                    console.log(`✅ Processamento de desativação concluído`);
                    return Response.json({ success: true, message: 'Notificações desativadas' });
                }
            }

            // Processar opt-in/opt-out de usuários individuais
            console.log(`\n👤 ========== PROCESSANDO OPT-IN/OPT-OUT INDIVIDUAL ==========`);
            
            // Buscar usuário - adicionar + se não tiver
            const phoneNumberWithPlus = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
            
            console.log(`\n🔍 BUSCANDO USUÁRIO NA BASE DE DADOS:`);
            console.log(`   - Número original: ${phoneNumber}`);
            console.log(`   - Número com +: ${phoneNumberWithPlus}`);
            console.log(`   - Procurando por: whatsapp:${phoneNumberWithPlus}`);
            
            const usuarios = await base44.asServiceRole.entities.User.filter({
                whatsapp_number: `whatsapp:${phoneNumberWithPlus}`
            });

            console.log(`   - Usuários encontrados: ${usuarios.length}`);

            if (usuarios.length === 0) {
                console.log(`\n❌ NENHUM USUÁRIO ENCONTRADO`);
                console.log(`   - Tentei buscar: whatsapp:${phoneNumber}`);
                console.log(`   - Verifique se o número está correto no perfil do usuário`);
                return Response.json({ success: true, message: 'Usuário não encontrado' });
            }

            const usuario = usuarios[0];
            console.log(`\n✅ USUÁRIO ENCONTRADO:`);
            console.log(`   - ID: ${usuario.id}`);
            console.log(`   - Email: ${usuario.email}`);
            console.log(`   - Nome: ${usuario.full_name}`);
            console.log(`   - WhatsApp: ${usuario.whatsapp_number}`);
            console.log(`   - Status atual: ${usuario.whatsapp_opt_in_status || 'não definido'}`);

            // Verificar palavras-chave E botões interativos
            console.log(`\n🔍 VERIFICANDO PALAVRAS-CHAVE E BOTÕES:`);
            console.log(`   - Mensagem recebida: "${messageBody}"`);
            
            // Verificar se é resposta de botão interativo (formato Z-API)
            const buttonReply = messageData.buttonReply;
            const buttonId = buttonReply?.buttonId || '';
            const buttonText = buttonReply?.message || '';
            
            console.log(`   - É resposta de botão?: ${buttonReply ? '✅ SIM' : '❌ NÃO'}`);
            if (buttonReply) {
                console.log(`   - Button ID: "${buttonId}"`);
                console.log(`   - Texto do botão: "${buttonText}"`);
            }

            // Verificar opt-in (mensagem de texto OU botão opt_in_sim)
            const isOptIn = config.palavras_chave_opt_in.some(keyword => {
                const match = messageBody.includes(keyword.toLowerCase());
                console.log(`   - Testando "${keyword}": ${match ? '✅ MATCH' : '❌ não'}`);
                return match;
            }) || buttonId === 'opt_in_sim';

            // Verificar opt-out (mensagem de texto OU botão opt_in_nao)
            const isOptOut = config.palavras_chave_opt_out.some(keyword => {
                const match = messageBody.includes(keyword.toLowerCase());
                console.log(`   - Testando "${keyword}": ${match ? '✅ MATCH' : '❌ não'}`);
                return match;
            }) || buttonId === 'opt_in_nao';

            console.log(`\n📊 RESULTADO DA VERIFICAÇÃO:`);
            console.log(`   - É opt-in?: ${isOptIn ? '✅ SIM' : '❌ NÃO'}`);
            console.log(`   - É opt-out?: ${isOptOut ? '✅ SIM' : '❌ NÃO'}`);

            if (isOptIn) {
                console.log(`\n✅ ========== PROCESSANDO OPT-IN ==========`);
                
                console.log(`\n📝 Atualizando usuário na base de dados...`);
                console.log(`   - ID do usuário: ${usuario.id}`);
                console.log(`   - Status anterior: ${usuario.whatsapp_opt_in_status}`);
                console.log(`   - Novo status: confirmado`);
                
                try {
                    await base44.asServiceRole.entities.User.update(usuario.id, {
                        whatsapp_opt_in_status: 'confirmado',
                        whatsapp_opt_in_date: new Date().toISOString()
                    });

                    console.log(`✅ Usuário atualizado com sucesso!`);

                    // Verificar se realmente atualizou
                    const usuarioAtualizado = await base44.asServiceRole.entities.User.get(usuario.id);
                    console.log(`\n🔍 VERIFICAÇÃO PÓS-ATUALIZAÇÃO:`);
                    console.log(`   - Status atual: ${usuarioAtualizado.whatsapp_opt_in_status}`);
                    console.log(`   - Data opt-in: ${usuarioAtualizado.whatsapp_opt_in_date}`);

                } catch (error) {
                    console.error(`\n❌ ERRO AO ATUALIZAR USUÁRIO:`, error);
                    throw error;
                }

                // Enviar mensagem de confirmação
                if (config.enviar_resposta_automatica) {
                    console.log(`\n📤 Enviando mensagem de confirmação...`);
                    try {
                        const instanceId = Deno.env.get('ID_INSTANCIA_ZAPI');
                        const clientToken = Deno.env.get('CLIENT_TOKEN_ZAPI');
                        const token = Deno.env.get('TOKEN_ZAPI');

                        if (!instanceId || !clientToken || !token) {
                            throw new Error('Credenciais Z-API não configuradas');
                        }

                        const encodedToken = encodeURIComponent(token);
                        const zapiUrl = `https://api.z-api.io/instances/${instanceId}/token/${encodedToken}/send-text`;

                        console.log(`   - URL: ${zapiUrl}`);
                        console.log(`   - Para: ${phoneNumber}`);
                        console.log(`   - Mensagem: ${config.mensagem_confirmacao_opt_in}`);

                        const response = await fetch(zapiUrl, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Client-Token': clientToken
                            },
                            body: JSON.stringify({
                                phone: phoneNumber,
                                message: config.mensagem_confirmacao_opt_in
                            })
                        });

                        if (!response.ok) {
                            const errorText = await response.text();
                            console.error(`   ❌ Erro Z-API: ${response.status} - ${errorText}`);
                            throw new Error(`Z-API erro: ${response.status} - ${errorText}`);
                        }

                        const data = await response.json();
                        console.log(`   ✅ Mensagem enviada! ID: ${data.messageId}`);
                    } catch (error) {
                        console.error(`   ❌ Erro ao enviar mensagem:`, error);
                    }
                }

                // Processar mensagens pendentes
                console.log(`\n📬 Processando mensagens pendentes...`);
                try {
                    await base44.asServiceRole.functions.invoke('procesarMensagensWhatsAppPendentes', {
                        user_id: usuario.id
                    });
                    console.log(`   ✅ Mensagens pendentes processadas`);
                } catch (error) {
                    console.error(`   ❌ Erro ao processar mensagens pendentes:`, error);
                }

                console.log(`\n═══════════════════════════════════════════════════════`);
                console.log(`✅ OPT-IN CONCLUÍDO COM SUCESSO`);
                console.log(`═══════════════════════════════════════════════════════`);

            } else if (isOptOut) {
                console.log(`\n🚫 ========== PROCESSANDO OPT-OUT ==========`);
                
                console.log(`\n📝 Atualizando usuário na base de dados...`);
                console.log(`   - ID do usuário: ${usuario.id}`);
                console.log(`   - Status anterior: ${usuario.whatsapp_opt_in_status}`);
                console.log(`   - Novo status: rejeitado`);
                
                try {
                    await base44.asServiceRole.entities.User.update(usuario.id, {
                        whatsapp_opt_in_status: 'rejeitado'
                    });

                    console.log(`✅ Usuário atualizado com sucesso!`);

                    // Verificar se realmente atualizou
                    const usuarioAtualizado = await base44.asServiceRole.entities.User.get(usuario.id);
                    console.log(`\n🔍 VERIFICAÇÃO PÓS-ATUALIZAÇÃO:`);
                    console.log(`   - Status atual: ${usuarioAtualizado.whatsapp_opt_in_status}`);

                } catch (error) {
                    console.error(`\n❌ ERRO AO ATUALIZAR USUÁRIO:`, error);
                    throw error;
                }

                // Enviar mensagem de confirmação
                if (config.enviar_resposta_automatica) {
                    console.log(`\n📤 Enviando mensagem de confirmação...`);
                    try {
                        const instanceId = Deno.env.get('ID_INSTANCIA_ZAPI');
                        const clientToken = Deno.env.get('CLIENT_TOKEN_ZAPI');
                        const token = Deno.env.get('TOKEN_ZAPI');

                        if (!instanceId || !clientToken || !token) {
                            throw new Error('Credenciais Z-API não configuradas');
                        }

                        const encodedToken = encodeURIComponent(token);
                        const zapiUrl = `https://api.z-api.io/instances/${instanceId}/token/${encodedToken}/send-text`;

                        console.log(`   - URL: ${zapiUrl}`);
                        console.log(`   - Para: ${phoneNumber}`);
                        console.log(`   - Mensagem: ${config.mensagem_confirmacao_opt_out}`);

                        const response = await fetch(zapiUrl, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Client-Token': clientToken
                            },
                            body: JSON.stringify({
                                phone: phoneNumber,
                                message: config.mensagem_confirmacao_opt_out
                            })
                        });

                        if (!response.ok) {
                            const errorText = await response.text();
                            console.error(`   ❌ Erro Z-API: ${response.status} - ${errorText}`);
                            throw new Error(`Z-API erro: ${response.status} - ${errorText}`);
                        }

                        const data = await response.json();
                        console.log(`   ✅ Mensagem enviada! ID: ${data.messageId}`);
                    } catch (error) {
                        console.error(`   ❌ Erro ao enviar mensagem:`, error);
                    }
                }

                console.log(`\n═══════════════════════════════════════════════════════`);
                console.log(`✅ OPT-OUT CONCLUÍDO COM SUCESSO`);
                console.log(`═══════════════════════════════════════════════════════`);
            } else {
                console.log(`\n⚠️ Mensagem não corresponde a nenhum comando de opt-in/opt-out`);
            }
        }

        return Response.json({ 
            success: true,
            message: 'Webhook processado com sucesso',
            eventType: eventType
        });

    } catch (error) {
        console.error('\n═══════════════════════════════════════════════════════');
        console.error('❌ ERRO CRÍTICO AO PROCESSAR WEBHOOK Z-API');
        console.error('═══════════════════════════════════════════════════════');
        console.error(error);
        console.error('Stack:', error.stack);
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
});