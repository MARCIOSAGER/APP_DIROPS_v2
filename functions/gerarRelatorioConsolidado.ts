import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    let payload = {};
    try {
      const clonedReq = req.clone();
      payload = await clonedReq.json();
    } catch (e) {
      console.log('⚠️ Sem payload JSON');
    }
    
    const base44 = createClientFromRequest(req);
    const { periodo } = payload;

    // Carregar placeholders globais
    const placeholders = await base44.entities.Placeholder.filter({ ativo: true }).catch(() => []);

    if (!periodo) {
      return Response.json({ error: 'Período é obrigatório' }, { status: 400 });
    }

    console.log(`📊 Gerando relatório consolidado ${periodo}`);

    const hoje = new Date();
    let dataInicio, dataFim;

    if (periodo === 'diario') {
      const ontem = new Date(hoje);
      ontem.setDate(hoje.getDate() - 1);
      dataInicio = ontem.toISOString().split('T')[0];
      dataFim = dataInicio;
    } else if (periodo === 'semanal') {
      const domingoPassado = new Date(hoje);
      domingoPassado.setDate(hoje.getDate() - hoje.getDay() - 7);
      const sabadoPassado = new Date(domingoPassado);
      sabadoPassado.setDate(domingoPassado.getDate() + 6);
      dataInicio = domingoPassado.toISOString().split('T')[0];
      dataFim = sabadoPassado.toISOString().split('T')[0];
    } else if (periodo === 'mensal') {
      const mesAnterior = new Date(hoje);
      mesAnterior.setMonth(hoje.getMonth() - 1);
      mesAnterior.setDate(1);
      dataInicio = mesAnterior.toISOString().split('T')[0];
      const ultimoDiaMesAnterior = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
      dataFim = ultimoDiaMesAnterior.toISOString().split('T')[0];
    } else {
      return Response.json({ error: 'Período inválido' }, { status: 400 });
    }

    console.log(`📅 Período: ${dataInicio} a ${dataFim}`);

    // OTIMIZAÇÃO: Carregar todos os dados UMA ÚNICA VEZ
    console.log(`🔄 Carregando dados globais...`);
    const [aeroportos, todosVoos, todosVoosLigados, todosCalculosTarifa, todosUsuarios, todasRegras, configsGlobais] = await Promise.all([
      base44.entities.Aeroporto.list().catch(() => []),
      base44.entities.Voo.filter({
        data_operacao: { $gte: dataInicio, $lte: dataFim }
      }).catch(() => []),
      base44.entities.VooLigado.list().catch(() => []),
      base44.entities.CalculoTarifa.list().catch(() => []),
      base44.asServiceRole.entities.User.list().catch(() => []),
      base44.entities.RegraNotificacao.filter({ ativo: true }).catch(() => []),
      base44.entities.ConfiguracaoNotificacoes.list().catch(() => [])
    ]);

    const aeroportosAngola = aeroportos.filter(a => 
      ['FNCA', 'FNUB', 'FNCT', 'FNSO', 'FNSA', 'FNMO', 'FNHU', 'FNLU', 'FNKU', 'FNUE', 'FNME', 'FNDU', 'FNGI', 'FNMA', 'FNUG', 'FNBC'].includes(a.codigo_icao)
    );

    console.log(`✅ Dados carregados: ${todosVoos.length} voos, ${todosVoosLigados.length} ligados`);
    console.log(`🏢 ${aeroportosAngola.length} aeroportos a processar`);

    // Processar cálculos de tarifa em array se necessário
    const calculosTarifaArray = Array.isArray(todosCalculosTarifa) 
      ? todosCalculosTarifa 
      : (todosCalculosTarifa ? Object.values(todosCalculosTarifa) : []);

    // Variáveis consolidadas
    let totalVoosGeral = 0;
    let totalVoosArrGeral = 0;
    let totalVoosDepGeral = 0;
    let totalPassageirosGeral = 0;
    let totalCargaGeral = 0;
    let totalFaturacaoUSDGeral = 0;
    let totalFaturacaoAOAGeral = 0;
    let totalImpostosUSDGeral = 0;
    let totalImpostosAOAGeral = 0;
    const detalhesAeroportos = [];

    // Processar cada aeroporto
    for (const aeroporto of aeroportosAngola) {
      // FILTRAR EM MEMÓRIA
      const voos = todosVoos.filter(v => v.aeroporto_operacao === aeroporto.codigo_icao);
      
      if (voos.length === 0) {
        continue;
      }

      const voosArr = voos.filter(v => v.tipo_movimento === 'ARR');
      const voosDep = voos.filter(v => v.tipo_movimento === 'DEP');

      let totalPassageiros = 0;
      let totalCarga = 0;

      voos.forEach(v => {
        totalPassageiros += (v.passageiros_local || 0) + 
                            (v.passageiros_transito_transbordo || 0) + 
                            (v.passageiros_transito_direto || 0);
        totalCarga += (v.carga_kg || 0);
      });

      // FILTRAR EM MEMÓRIA
      const vooIds = new Set(voos.map(v => v.id));
      const voosLigadosDoAeroporto = todosVoosLigados.filter(vl => 
        vooIds.has(vl.id_voo_arr) && vooIds.has(vl.id_voo_dep)
      );

      const voosLigadosIds = new Set(voosLigadosDoAeroporto.map(vl => vl.id));
      const calculosTarifa = calculosTarifaArray.filter(calc => 
        vooIds.has(calc.voo_id) || voosLigadosIds.has(calc.voo_ligado_id)
      );

      let totalFaturacaoUSD = 0;
      let totalFaturacaoAOA = 0;
      let totalImpostosUSD = 0;
      let totalImpostosAOA = 0;

      // Somar apenas os cálculos dos voos ligados (com impostos)
      voosLigadosDoAeroporto.forEach((vl) => {
        const calculo = calculosTarifa.find(ct => ct.voo_ligado_id === vl.id);

        if (calculo) {
          const valorAOA = calculo.total_tarifa_com_impostos_aoa || calculo.total_tarifa || 0;
          const valorUSD = calculo.total_tarifa_com_impostos_usd || calculo.total_tarifa_usd || 0;
          const impostosAOA = calculo.total_impostos_aoa || 0;
          const impostosUSD = calculo.total_impostos_usd || 0;
          
          totalFaturacaoAOA += valorAOA;
          totalFaturacaoUSD += valorUSD;
          totalImpostosAOA += impostosAOA;
          totalImpostosUSD += impostosUSD;
        }
      });

      // Adicionar aos totais gerais
      totalVoosGeral += voos.length;
      totalVoosArrGeral += voosArr.length;
      totalVoosDepGeral += voosDep.length;
      totalPassageirosGeral += totalPassageiros;
      totalCargaGeral += totalCarga;
      totalFaturacaoUSDGeral += totalFaturacaoUSD;
      totalFaturacaoAOAGeral += totalFaturacaoAOA;
      totalImpostosUSDGeral += totalImpostosUSD;
      totalImpostosAOAGeral += totalImpostosAOA;

      detalhesAeroportos.push({
        codigo_icao: aeroporto.codigo_icao,
        nome: aeroporto.nome,
        total_voos: voos.length,
        total_passageiros: totalPassageiros,
        total_carga: totalCarga,
        total_faturacao_usd: totalFaturacaoUSD.toFixed(2),
        total_faturacao_aoa: Math.round(totalFaturacaoAOA).toLocaleString('pt-AO')
      });
      }

      // Ordenar aeroportos por número de voos (maior para menor)
      detalhesAeroportos.sort((a, b) => b.total_voos - a.total_voos);

      console.log(`✅ Processados ${detalhesAeroportos.length} aeroportos com dados`);

      if (detalhesAeroportos.length === 0) {
      return Response.json({ 
        sucesso: true,
        mensagem: 'Nenhum voo no período em nenhum aeroporto',
        periodo,
        dataInicio,
        dataFim,
        notificacoes_enviadas: 0,
        resultados: []
      });
    }

    const dataInicioParsed = new Date(dataInicio + 'T00:00:00');
    const mesAno = dataInicioParsed.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase());

    let createdBy = 'sistema@sga.ao';

    const dataInicioFormatada = new Date(dataInicio + 'T00:00:00').toLocaleDateString('pt-PT');
    const dataFimFormatada = new Date(dataFim + 'T00:00:00').toLocaleDateString('pt-PT');

    // Definir eventoGatilho ANTES de ser usado
    const eventoGatilho = `relatorio_operacional_consolidado_${periodo}`;

    // FILTRAR EM MEMÓRIA as regras já carregadas
    const regrasPreliminar = todasRegras.filter(r => r.evento_gatilho === eventoGatilho);

    // Usar o template customizado da primeira regra que tiver, senão usar o padrão
    let templateHtmlAeroporto = null;
    if (regrasPreliminar && regrasPreliminar.length > 0) {
      for (const regra of regrasPreliminar) {
        const regraDados = regra.data || regra;
        if (regraDados.template_html_aeroportos && regraDados.template_html_aeroportos.trim()) {
          templateHtmlAeroporto = regraDados.template_html_aeroportos;
          break;
        }
      }
    }

    // Gerar HTML dos aeroportos para o email
    let aeroportosHtml = '';
    detalhesAeroportos.forEach((aero, index) => {
      if (templateHtmlAeroporto) {
        // Usar template customizado
        let htmlAeroporto = templateHtmlAeroporto
          .replace(/\{\{codigo_icao\}\}/g, aero.codigo_icao)
          .replace(/\{\{nome\}\}/g, aero.nome)
          .replace(/\{\{total_voos\}\}/g, aero.total_voos)
          .replace(/\{\{total_passageiros\}\}/g, aero.total_passageiros.toLocaleString('pt-AO'))
          .replace(/\{\{total_carga\}\}/g, aero.total_carga.toLocaleString('pt-AO'))
          .replace(/\{\{total_faturacao_usd\}\}/g, aero.total_faturacao_usd)
          .replace(/\{\{total_faturacao_aoa\}\}/g, aero.total_faturacao_aoa);
        aeroportosHtml += htmlAeroporto;
      } else {
        // Usar template padrão
        const borderColor = index % 2 === 0 ? '#e2e8f0' : '#cbd5e1';
        aeroportosHtml += `
          <div style='background: white; border: 2px solid ${borderColor}; border-radius: 8px; padding: 15px; margin-bottom: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);'>
            <h3 style='color: #004A99; margin: 0 0 5px 0; font-size: 18px; font-weight: bold;'>#${index + 1} ${aero.codigo_icao}</h3>
            <p style='color: #333; font-size: 13px; margin: 0 0 12px 0;'>${aero.nome}</p>
            <div style='font-size: 14px; color: #333; line-height: 1.8;'>
              <p style='margin: 5px 0;'><strong>✈️ Movimentos:</strong> <span style='color: #004A99;'>${aero.total_voos}</span></p>
              <p style='margin: 5px 0;'><strong>👥 Passageiros:</strong> <span style='color: #004A99;'>${aero.total_passageiros.toLocaleString('pt-AO')}</span></p>
              <p style='margin: 5px 0;'><strong>📦 Carga:</strong> <span style='color: #004A99;'>${aero.total_carga.toLocaleString('pt-AO')} kg</span></p>
              <div style='margin-top: 10px; padding-top: 10px; border-top: 1px solid #e2e8f0;'>
                <p style='margin: 3px 0; font-weight: bold; color: #004A99;'>💰 Faturação:</p>
                <p style='margin: 3px 0; padding-left: 10px;'>USD: <strong style='color: #004A99;'>$${aero.total_faturacao_usd}</strong></p>
                <p style='margin: 3px 0; padding-left: 10px;'>AOA: <strong style='color: #004A99;'>${aero.total_faturacao_aoa}</strong></p>
              </div>
            </div>
          </div>
        `;
      }
    });

    // Gerar texto dos aeroportos para WhatsApp (top 10)
    const maxAeroportosWhatsapp = 10;
    let aeroportosTextoWhatsapp = '';
    const aeroportosMostrados = detalhesAeroportos.slice(0, maxAeroportosWhatsapp);
    
    aeroportosMostrados.forEach((aero, index) => {
      aeroportosTextoWhatsapp += `\n*#${index + 1} ${aero.codigo_icao}*\n`;
      aeroportosTextoWhatsapp += `✈️ ${aero.total_voos} voos | 💰 $${aero.total_faturacao_usd}\n`;
    });

    if (detalhesAeroportos.length > maxAeroportosWhatsapp) {
      aeroportosTextoWhatsapp += `\n... e mais ${detalhesAeroportos.length - maxAeroportosWhatsapp} aeroportos.\n`;
      aeroportosTextoWhatsapp += `Verifique o seu email para o relatório completo!`;
    }

    // Versão completa para email
    let aeroportosTexto = '';
    detalhesAeroportos.forEach((aero, index) => {
      aeroportosTexto += `\n*#${index + 1} ${aero.codigo_icao}* - ${aero.nome}\n`;
      aeroportosTexto += `✈️ Voos: ${aero.total_voos}\n`;
      aeroportosTexto += `👥 Passageiros: ${aero.total_passageiros.toLocaleString('pt-AO')}\n`;
      aeroportosTexto += `📦 Carga: ${aero.total_carga.toLocaleString('pt-AO')} kg\n`;
      aeroportosTexto += `💰 Faturação: $${aero.total_faturacao_usd} (${aero.total_faturacao_aoa})\n`;
    });

    // Criar objeto de dados consolidado com todos os placeholders
    const dados = {
      mes_ano: mesAno,
      periodo: periodo,
      data_inicio: dataInicio,
      data_fim: dataFim,
      data_inicio_formatada: dataInicioFormatada,
      data_fim_formatada: dataFimFormatada,
      data_relatorio: dataInicio,
      semana_inicio: dataInicio,
      semana_fim: dataFim,
      total_aeroportos: detalhesAeroportos.length.toString(),
      total_voos_geral: totalVoosGeral.toString(),
      total_voos_arr_geral: totalVoosArrGeral.toString(),
      total_voos_dep_geral: totalVoosDepGeral.toString(),
      total_passageiros_geral: totalPassageirosGeral.toLocaleString('pt-AO'),
      total_carga_kg_geral: totalCargaGeral.toLocaleString('pt-AO'),
      total_faturacao_usd_geral: totalFaturacaoUSDGeral.toFixed(2),
      total_faturacao_aoa_geral: Math.round(totalFaturacaoAOAGeral).toLocaleString('pt-AO'),
      total_impostos_usd_geral: totalImpostosUSDGeral.toFixed(2),
      total_impostos_aoa_geral: Math.round(totalImpostosAOAGeral).toLocaleString('pt-AO'),
      subtotal_sem_impostos_usd_geral: (totalFaturacaoUSDGeral - totalImpostosUSDGeral).toFixed(2),
      subtotal_sem_impostos_aoa_geral: Math.round(totalFaturacaoAOAGeral - totalImpostosAOAGeral).toLocaleString('pt-AO'),
      total_faturacao_com_impostos_usd_geral: totalFaturacaoUSDGeral.toFixed(2),
      total_faturacao_com_impostos_aoa_geral: Math.round(totalFaturacaoAOAGeral).toLocaleString('pt-AO'),
      created_date: new Date().toISOString().split('T')[0],
      created_by: createdBy,
      detalhes_aeroportos_json: JSON.stringify(detalhesAeroportos),
      detalhes_aeroportos_html: aeroportosHtml,
      detalhes_aeroportos_texto: aeroportosTexto,
      detalhes_aeroportos_texto_whatsapp: aeroportosTextoWhatsapp
      };

    console.log(`✅ OBJETO DADOS CONSOLIDADO CRIADO - ${Object.keys(dados).length} campos`);

    // FILTRAR EM MEMÓRIA as regras já carregadas
    const regras = todasRegras.filter(r => r.evento_gatilho === eventoGatilho);

    console.log(`📋 ${regras?.length || 0} regra(s) aplicável(eis)`);
    
    // Log detalhado das regras
    if (regras && regras.length > 0) {
      regras.forEach(regra => {
        const regraDados = regra.data || regra;
        console.log(`🔍 Regra: ${regraDados.nome}`);
        console.log(`   - Evento: ${regraDados.evento_gatilho}`);
        console.log(`   - Canais: ${JSON.stringify(regraDados.canal_envio)}`);
        console.log(`   - Grupo WhatsApp: ${regraDados.grupo_whatsapp_id || 'não definido'}`);
        console.log(`   - Template WhatsApp: ${regraDados.mensagem_template_whatsapp ? `${regraDados.mensagem_template_whatsapp.substring(0, 50)}...` : 'vazio'}`);
      });
    }

    const configWhatsapp = configsGlobais.find(c => c.numero_whatsapp_oficial);

    let notificacoesEnviadas = 0;
    const resultados = [];

    const destinatariosMap = new Map();

    for (const regra of regras || []) {
      const regraDados = regra.data || regra;
      const usersNaRegra = [];

      if (regraDados.destinatarios_perfis && regraDados.destinatarios_perfis.length > 0) {
         // FILTRAR EM MEMÓRIA os usuários já carregados
        for (const usuario of todosUsuarios) {
          if (usuario.perfis && usuario.perfis.some(p => regraDados.destinatarios_perfis.includes(p))) {
            usersNaRegra.push(usuario);
          }
        }
      }

      if (regraDados.destinatarios_usuarios_ids && regraDados.destinatarios_usuarios_ids.length > 0) {
        for (const userId of regraDados.destinatarios_usuarios_ids) {
          // BUSCAR EM MEMÓRIA
          const usuario = todosUsuarios.find(u => u.id === userId);
          if (usuario && !usersNaRegra.find(d => d.id === usuario.id)) {
            usersNaRegra.push(usuario);
          }
        }
      }

      for (const usuario of usersNaRegra) {
        if (!destinatariosMap.has(usuario.id)) {
          destinatariosMap.set(usuario.id, {
            usuario,
            canais: new Set(),
            regras: [regraDados.nome]
          });
        } else {
          destinatariosMap.get(usuario.id).regras.push(regraDados.nome);
        }

        const entrada = destinatariosMap.get(usuario.id);
        regraDados.canal_envio.forEach(canal => entrada.canais.add(canal));
      }
    }

    console.log(`👥 ${destinatariosMap.size} destinatário(s) únicos`);

    // Processar envio para grupos WhatsApp (Z-API)
    for (const regra of regras || []) {
      const regraDados = regra.data || regra;
      if (regraDados.grupo_whatsapp_id && regraDados.canal_envio && regraDados.canal_envio.includes('whatsapp')) {
        try {
          console.log(`🔍 Regra encontrada para grupo: ${regraDados.nome}`);
          console.log(`📋 Template WhatsApp: ${regraDados.mensagem_template_whatsapp ? 'Definido' : 'Vazio'}`);
          
          let mensagem = regraDados.mensagem_template_whatsapp || '';
          
          // Se não houver template, usar mensagem padrão
          if (!mensagem || mensagem.trim() === '') {
            mensagem = `📊 *Relatório Operacional Consolidado (${periodo})*\n\nPeríodo: {{data_inicio_formatada}} a {{data_fim_formatada}}\n\n{{detalhes_aeroportos_texto_whatsapp}}`;
          }
          
          // Substituir placeholders do sistema
          Object.keys(dados).forEach(key => {
            const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
            mensagem = mensagem.replace(regex, String(dados[key]));
          });

          // Substituir placeholders globais
          placeholders.forEach(ph => {
            const regex = new RegExp(`\\{\\{${ph.nome}\\}\\}`, 'g');
            mensagem = mensagem.replace(regex, ph.valor_padrao || '');
          });

          console.log(`📤 Enviando para grupo: ${regraDados.grupo_whatsapp_id}`);
          console.log(`📝 Tamanho da mensagem: ${mensagem.length} caracteres`);

          // Delay progressivo para evitar rate limit (500ms + 200ms por cada notificação)
          if (notificacoesEnviadas > 0) {
            const delayMs = 500 + (notificacoesEnviadas * 200);
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }

          await base44.asServiceRole.functions.invoke('sendWhatsAppMessageToGroupZAPI', {
            groupId: regraDados.grupo_whatsapp_id,
            body: mensagem
          });

          notificacoesEnviadas++;
          resultados.push({
            destinatario: `Grupo WhatsApp (${regraDados.nome})`,
            canais: ['whatsapp_grupo'],
            status: 'enviado'
          });

          // Registar no histórico
          await base44.entities.HistoricoNotificacao.create({
            tipo_relatorio: 'consolidado',
            aeroporto_icao: 'CONSOLIDADO',
            data_relatorio_inicio: dataInicio,
            data_relatorio_fim: dataFim,
            email_destinatario: `grupo_${regraDados.grupo_whatsapp_id}`,
            canais_enviados: ['whatsapp_grupo'],
            status: 'sucesso'
          });

          console.log(`✅ Mensagem enviada para grupo com sucesso`);
        } catch (e) {
          console.error(`❌ Erro ao enviar para grupo: ${e.message}`);
          resultados.push({
            destinatario: `Grupo WhatsApp (${regraDados.nome})`,
            canal: 'whatsapp_grupo',
            status: 'erro',
            motivo: e.message
          });
        }
      }
    }

    for (const [userId, entrada] of destinatariosMap) {
      const { usuario, canais } = entrada;

      let canaisEnviadosComSucesso = [];
      let erros = [];

      if (canais.has('whatsapp')) {
        if (!usuario.whatsapp_number) {
          erros.push({
            canal: 'whatsapp',
            motivo: 'Número de WhatsApp não configurado'
          });
        } else if (usuario.whatsapp_opt_in_status !== 'confirmado') {
          try {
            await base44.functions.invoke('enviarOptInWhatsApp', {
              user_id: usuario.id
            });
            resultados.push({
              destinatario: usuario.full_name,
              canal: 'whatsapp',
              status: 'opt_in_enviado'
            });
          } catch (e) {
            erros.push({
              canal: 'whatsapp',
              motivo: `Erro opt-in: ${e.message}`
            });
          }
        } else if (configWhatsapp) {
          try {
            let mensagem = '';
            for (const regra of regras) {
              const regraDados = regra.data || regra;
              if (regraDados.mensagem_template_whatsapp && entrada.regras.includes(regraDados.nome)) {
                mensagem = regraDados.mensagem_template_whatsapp;
                break;
              }
            }

            // Substituir placeholders do sistema
            Object.keys(dados).forEach(key => {
              const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
              mensagem = mensagem.replace(regex, String(dados[key]));
            });

            // Substituir placeholders globais
            placeholders.forEach(ph => {
              const regex = new RegExp(`\\{\\{${ph.nome}\\}\\}`, 'g');
              mensagem = mensagem.replace(regex, ph.valor_padrao || '');
              });

              // Delay progressivo para evitar rate limit (500ms + 200ms por cada notificação)
              if (notificacoesEnviadas > 0) {
              const delayMs = 500 + (notificacoesEnviadas * 200);
              await new Promise(resolve => setTimeout(resolve, delayMs));
              }

              // Determinar provedor (regra específica ou configuração global)
              const provedorWhatsapp = (configsGlobais.length > 0 && configsGlobais[0].provedor_whatsapp) || 'twilio';
            let provedorParaUtilizador = provedorWhatsapp;
            
            // Verificar se alguma regra tem provedor preferencial
            for (const regra of regras) {
              const regraDados = regra.data || regra;
              if (regraDados.mensagem_template_whatsapp && entrada.regras.includes(regraDados.nome)) {
                if (regraDados.provedor_whatsapp_preferencial && regraDados.provedor_whatsapp_preferencial.trim() !== '') {
                  provedorParaUtilizador = regraDados.provedor_whatsapp_preferencial;
                }
                break;
              }
            }

            // Se for Z-API, enviar diretamente
            if (provedorParaUtilizador === 'zapi') {
              const numeroLimpo = usuario.whatsapp_number.replace('whatsapp:', '').replace(/\s/g, '');
              
              const instanceId = Deno.env.get('ID_INSTANCIA_ZAPI');
              const clientToken = Deno.env.get('CLIENT_TOKEN_ZAPI');
              const token = Deno.env.get('TOKEN_ZAPI');

              if (!instanceId || !clientToken || !token) {
                throw new Error('Credenciais Z-API não configuradas');
              }

              const encodedToken = encodeURIComponent(token);
              const zapiUrl = `https://api.z-api.io/instances/${instanceId}/token/${encodedToken}/send-text`;

              const response = await fetch(zapiUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Client-Token': clientToken
                },
                body: JSON.stringify({
                  phone: numeroLimpo,
                  message: mensagem
                })
              });

              if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Z-API erro: ${response.status} - ${errorText}`);
              }

              const data = await response.json();
              console.log(`✅ Z-API enviado:`, data.messageId);
            } else {
              // Usar Twilio
              await base44.functions.invoke('sendWhatsAppMessage', {
                from: `whatsapp:${configWhatsapp.numero_whatsapp_oficial.replace('whatsapp:', '')}`,
                to: `whatsapp:${usuario.whatsapp_number.replace('whatsapp:', '')}`,
                body: mensagem
              });
            }

            canaisEnviadosComSucesso.push('whatsapp');
          } catch (e) {
            erros.push({
              canal: 'whatsapp',
              motivo: e.message
            });
          }
        }
      }

      if (canais.has('email')) {
        let assunto = '';
        let corpo = '';

        for (const regra of regras) {
          const regraDados = regra.data || regra;
          if (regraDados.mensagem_template_email_assunto && entrada.regras.includes(regraDados.nome)) {
            assunto = regraDados.mensagem_template_email_assunto;
            corpo = regraDados.mensagem_template_email_corpo;
            break;
          }
        }

        if (assunto && corpo) {
          try {
            // Fazer substituição em ordem específica: primeiro placeholders simples, depois HTML
            let asuntoProcessado = assunto;
            let corpoProcessado = corpo;
            
            // Primeiro: substituir placeholders que NÃO são HTML
            Object.keys(dados).forEach(key => {
              if (key !== 'detalhes_aeroportos_html' && key !== 'detalhes_aeroportos_json' && key !== 'detalhes_aeroportos_texto' && key !== 'detalhes_aeroportos_texto_whatsapp') {
                const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
                const valor = String(dados[key]);
                asuntoProcessado = asuntoProcessado.replace(regex, valor);
                corpoProcessado = corpoProcessado.replace(regex, valor);
              }
            });

            // Substituir placeholders globais
            placeholders.forEach(ph => {
              const regex = new RegExp(`\\{\\{${ph.nome}\\}\\}`, 'g');
              asuntoProcessado = asuntoProcessado.replace(regex, ph.valor_padrao || '');
              corpoProcessado = corpoProcessado.replace(regex, ph.valor_padrao || '');
            });
            
            // Segundo: substituir o HTML dos aeroportos (sem escapar)
            if (dados.detalhes_aeroportos_html) {
              corpoProcessado = corpoProcessado.replace(/\{\{detalhes_aeroportos_html\}\}/g, dados.detalhes_aeroportos_html);
            }

            await base44.integrations.Core.SendEmail({
              to: usuario.email,
              subject: asuntoProcessado,
              body: corpoProcessado
            });

            canaisEnviadosComSucesso.push('email');
          } catch (e) {
            erros.push({
              canal: 'email',
              motivo: e.message
            });
          }
        }
      }

      if (canaisEnviadosComSucesso.length > 0 || erros.length > 0) {
        try {
          await base44.entities.HistoricoNotificacao.create({
            tipo_relatorio: 'consolidado',
            aeroporto_icao: 'CONSOLIDADO',
            data_relatorio_inicio: dataInicio,
            data_relatorio_fim: dataFim,
            user_id: usuario.id,
            email_destinatario: usuario.email,
            canais_enviados: canaisEnviadosComSucesso,
            status: canaisEnviadosComSucesso.length > 0 ? 'sucesso' : 'erro',
            motivo_erro: erros.length > 0 ? erros.map(e => `${e.canal}: ${e.motivo}`).join('; ') : null
          });
        } catch (e) {
          console.error(`Erro ao registar: ${e.message}`);
        }
      }

      if (canaisEnviadosComSucesso.length > 0) {
        notificacoesEnviadas++;
        resultados.push({
          destinatario: usuario.full_name,
          canais: canaisEnviadosComSucesso,
          status: 'enviado'
        });
      }

      if (erros.length > 0) {
        erros.forEach(erro => {
          resultados.push({
            destinatario: usuario.full_name,
            canal: erro.canal,
            status: 'erro',
            motivo: erro.motivo
          });
        });
      }
    }

    return Response.json({
      sucesso: true,
      periodo,
      dataInicio,
      dataFim,
      metricas: dados,
      detalhes_aeroportos: detalhesAeroportos,
      notificacoes_enviadas: notificacoesEnviadas,
      resultados,
      mensagem: `Relatório consolidado ${periodo} gerado - ${notificacoesEnviadas} notificação(ões)`
    });

  } catch (error) {
    console.error('❌ Erro crítico:', error);
    return Response.json({ 
      error: 'Erro ao gerar relatório consolidado',
      details: error.message 
    }, { status: 500 });
  }
});