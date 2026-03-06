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
    const { periodo, aeroporto_icao } = payload;

    // Carregar placeholders globais
    const placeholders = await base44.entities.Placeholder.filter({ ativo: true }).catch(() => []);

    if (!periodo) {
      return Response.json({ error: 'Período é obrigatório' }, { status: 400 });
    }

    console.log(`📊 NOVO INICIO - Gerando relatório ${periodo}${aeroporto_icao ? ` para ${aeroporto_icao}` : ' para todos os aeroportos'}`);

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
    console.log(`🔍 Query CalculoTarifa: data_calculo >= ${dataInicio}T00:00:00Z e <= ${dataFim}T23:59:59Z`);

    // Se não foi especificado um aeroporto, processar todos
    const aeroportosAProcessar = [];
    if (!aeroporto_icao || aeroporto_icao === 'todos') {
      const todosAeroportos = await base44.entities.Aeroporto.list();
      aeroportosAProcessar.push(...todosAeroportos.map(a => a.codigo_icao));
      console.log(`🌍 Processando ${aeroportosAProcessar.length} aeroportos`);
    } else {
      aeroportosAProcessar.push(aeroporto_icao);
    }

    // OTIMIZAÇÃO: Carregar todos os dados UMA ÚNICA VEZ antes dos loops
    console.log(`🔄 Carregando dados globais...`);
    const [todosVoos, todosVoosLigados, todosAeroportos, todosUsuarios, todasRegras, configsGlobais, tarifas, companhias, modelos, registos, impostos, configsSistema] = await Promise.all([
      base44.entities.Voo.filter({
        data_operacao: { $gte: dataInicio, $lte: dataFim }
      }).catch(() => []),
      base44.entities.VooLigado.list().catch(() => []),
      base44.entities.Aeroporto.list().catch(() => []),
      base44.asServiceRole.entities.User.list().catch(() => []),
      base44.entities.RegraNotificacao.filter({ ativo: true }).catch(() => []),
      base44.entities.ConfiguracaoNotificacoes.list().catch(() => []),
      base44.entities.TarifaPouso.list().catch(() => []),
      base44.entities.CompanhiaAerea.list().catch(() => []),
      base44.entities.ModeloAeronave.list().catch(() => []),
      base44.entities.RegistoAeronave.list().catch(() => []),
      base44.entities.Imposto.filter({ativo: true}).catch(() => []),
      base44.entities.ConfiguracaoSistema.list().catch(() => [])
    ]);

    // MAPEAR DADOS PARA ACESSO RÁPIDO
    const voosMap = new Map(todosVoos.map(v => [v.id, v]));
    const aeroportosMapGlobal = new Map(todosAeroportos.map(a => [a.codigo_icao, a]));
    const modelosMap = new Map(modelos.map(m => [m.codigo_iata, m]));
    const registosMap = new Map(registos.map(r => [r.registo, r]));

    console.log(`✅ Dados carregados: ${todosVoos.length} voos, ${todosVoosLigados.length} ligados, ${tarifas.length} tarifas`);

    let totalNotificacoes = 0;
    const resultadosGerais = [];

    for (const aeroprocessar of aeroportosAProcessar) {
      // 1. FILTRAR VOOS por aeroporto e data (já filtrados por data na query)
      const voos = todosVoos.filter(v => v.aeroporto_operacao === aeroprocessar);
      console.log(`✅ ${voos.length} voo(s) encontrado(s) para ${aeroprocessar}`);

      if (voos.length === 0) {
        continue;
      }

      const voosArr = voos.filter(v => v.tipo_movimento === 'ARR');
      const voosDep = voos.filter(v => v.tipo_movimento === 'DEP');

      // 2. FILTRAR VOOS LIGADOS que pertencem aos voos deste aeroporto
      const vooIds = new Set(voos.map(v => v.id));
      const voosLigadosDoAeroporto = todosVoosLigados.filter(vl => 
        vooIds.has(vl.id_voo_arr) || vooIds.has(vl.id_voo_dep)
      );

      console.log(`🔗 ${voosLigadosDoAeroporto.length} voo(s) ligado(s)`);

      // 3. CALCULAR TOTAIS DE PASSAGEIROS E CARGA (dos voos individuais)
      let totalPassageiros = 0;
      let totalCarga = 0;
      let somaTempoEstacionamento = 0;
      let totalFaturacao = 0;
      let totalFaturaçãoUSD = 0;
      let totalImpostosAOA = 0;
      let totalImpostosUSD = 0;

      voos.forEach(v => {
        totalPassageiros += (v.passageiros_local || 0) + 
                            (v.passageiros_transito_transbordo || 0) + 
                            (v.passageiros_transito_direto || 0);
        totalCarga += (v.carga_kg || 0);
      });

      // Filtrar voos DEP do aeroporto no período
      const voosDEPNoPeriodo = voos.filter(v => v.tipo_movimento === 'DEP');
      const voosDEPIds = new Set(voosDEPNoPeriodo.map(v => v.id));

      // Filtrar voos ligados onde o voo DEP está no período
      const voosLigadosNoPeriodo = todosVoosLigados.filter(vl => voosDEPIds.has(vl.id_voo_dep));

      console.log(`📊 ${voosLigadosNoPeriodo.length} voo(s) ligado(s) com DEP no período`);

      // CRIAR CÁLCULOS DE TARIFA DINAMICAMENTE (antes de usá-los)
      console.log(`\n🔧 Gerando CalculoTarifa para voos ligados...`);
      console.log(`   Processando ${voosLigadosNoPeriodo.length} voo(s) ligado(s)`);
      let calculosCriadosAero = 0;

      const aeroportoOperacao = aeroportosMapGlobal.get(aeroprocessar);
      if (!aeroportoOperacao) {
        console.log(`⚠️ Aeroporto ${aeroprocessar} não encontrado no mapa`);
      } else {
        console.log(`✅ Aeroporto encontrado: ${aeroportoOperacao.nome}`);
        for (const vooLigado of voosLigadosNoPeriodo) {
          console.log(`\n   🔍 Processando VooLigado ${vooLigado.id}`);
          console.log(`      - id_voo_arr: ${vooLigado.id_voo_arr}`);
          console.log(`      - id_voo_dep: ${vooLigado.id_voo_dep}`);
          
          const vooArr = voosMap.get(vooLigado.id_voo_arr);
          const vooDep = voosMap.get(vooLigado.id_voo_dep);

          console.log(`      - vooArr encontrado: ${!!vooArr}`);
          console.log(`      - vooDep encontrado: ${!!vooDep}`);

          if (!vooDep || !vooArr) {
            console.log(`      ⚠️ Voo ligado incompleto - ARR: ${!!vooArr}, DEP: ${!!vooDep}`);
            continue;
          }
          
          console.log(`      ✓ Ambos os voos encontrados - ${vooArr.numero_voo} → ${vooDep.numero_voo}`);

          try {
            console.log(`      📞 Chamando calcularTarifasRobusta...`);
            // Chamar função backend robusta para cálculo
            const calculoResponse = await base44.asServiceRole.functions.invoke('calcularTarifasRobusta', {
              vooLigado: vooLigado,
              vooArr: vooArr,
              vooDep: vooDep,
              aeroportoOperacao: aeroportoOperacao,
              registos: Array.from(registosMap.values()),
              impostos: impostos
            });

            console.log(`      💾 Salvando cálculo...`);
            // Salvar o cálculo
            await base44.entities.CalculoTarifa.create(calculoResponse);
            calculosCriadosAero++;

            console.log(`      ✅ CalculoTarifa criado para ${vooDep.numero_voo}: $${calculoResponse.total_tarifa_com_impostos_usd} USD`);
          } catch (e) {
            const numVoo = vooDep?.numero_voo || 'desconhecido';
            console.error(`      ❌ Erro ao criar CalculoTarifa para ${numVoo}: ${e.message}`);
            console.error(`         Stack: ${e.stack}`);
          }
        }
      }
      console.log(`✅ ${calculosCriadosAero} CalculoTarifa criado(s) para ${aeroprocessar}`);

      // Agora carregar os cálculos que foram criados DESTE AEROPORTO no período
      const aeroportoOperacaoTemp = aeroportosMapGlobal.get(aeroprocessar);
      const calculosTarifaAero = aeroportoOperacaoTemp ? await base44.entities.CalculoTarifa.filter({
        aeroporto_id: aeroportoOperacaoTemp.id,
        data_calculo: { $gte: dataInicio + 'T00:00:00Z', $lte: dataFim + 'T23:59:59Z' }
      }).catch(() => []) : [];
      console.log(`📊 ${calculosTarifaAero.length} CalculoTarifa carregado(s) do sistema para ${aeroprocessar}`);

      console.log(`\n💰 Processando faturação de voos ligados...`);

      // Acumuladores para tarifas por tipo
      let totalTarifaPouso = 0, totalTarifaPousouUSD = 0;
      let totalTarifaPermanencia = 0, totalTarifaPermanenciaUSD = 0;
      let totalTarifaPassageiros = 0, totalTarifaPassageirosUSD = 0;
      let totalTarifaCarga = 0, totalTarifaCargaUSD = 0;
      let totalOutrasTarifas = 0, totalOutrasTarifasUSD = 0;

      // Acumular faturação dos cálculos
      const calculosProcessados = new Set();
      voosLigadosNoPeriodo.forEach((vooLigado) => {
        let calculoPorVooLigado = null;
        for (const ct of calculosTarifaAero) {
          if (ct && ct.voo_ligado_id === vooLigado.id) {
            calculoPorVooLigado = ct;
            break;
          }
        }

        if (calculoPorVooLigado && !calculosProcessados.has(calculoPorVooLigado.id)) {
          calculosProcessados.add(calculoPorVooLigado.id);
          somaTempoEstacionamento += (vooLigado.tempo_permanencia_min || 0);

          const valorAOA = calculoPorVooLigado.total_tarifa_com_impostos_aoa || calculoPorVooLigado.total_tarifa || 0;
          const valorUSD = calculoPorVooLigado.total_tarifa_com_impostos_usd || calculoPorVooLigado.total_tarifa_usd || 0;
          const impostosAOA = calculoPorVooLigado.total_impostos_aoa || 0;
          const impostosUSD = calculoPorVooLigado.total_impostos_usd || 0;

          totalTarifaPouso += (calculoPorVooLigado.tarifa_pouso || 0);
          totalTarifaPousouUSD += (calculoPorVooLigado.tarifa_pouso_usd || 0);
          totalTarifaPermanencia += (calculoPorVooLigado.tarifa_permanencia || 0);
          totalTarifaPermanenciaUSD += (calculoPorVooLigado.tarifa_permanencia_usd || 0);
          totalTarifaPassageiros += (calculoPorVooLigado.tarifa_passageiros || 0);
          totalTarifaPassageirosUSD += (calculoPorVooLigado.tarifa_passageiros_usd || 0);
          totalTarifaCarga += (calculoPorVooLigado.tarifa_carga || 0);
          totalTarifaCargaUSD += (calculoPorVooLigado.tarifa_carga_usd || 0);
          totalOutrasTarifas += (calculoPorVooLigado.outras_tarifas || 0);
          totalOutrasTarifasUSD += (calculoPorVooLigado.outras_tarifas_usd || 0);

          totalFaturacao += valorAOA;
          totalFaturaçãoUSD += valorUSD;
          totalImpostosAOA += impostosAOA;
          totalImpostosUSD += impostosUSD;

          const arrVoo = todosVoos.find(v => v.id === vooLigado.id_voo_arr);
          const depVoo = todosVoos.find(v => v.id === vooLigado.id_voo_dep);
          console.log(`✅ Voo Ligado ${arrVoo?.numero_voo} → ${depVoo?.numero_voo} → $${valorUSD} (${valorAOA} AOA)`);
        }
      });

      console.log(`\n💰 TOTAL: $${totalFaturaçãoUSD.toFixed(2)} (${totalFaturacao.toFixed(2)} AOA)`);

      const tempoMedioEstacionamento = voosLigadosDoAeroporto.length > 0
        ? Math.round(somaTempoEstacionamento / voosLigadosDoAeroporto.length)
        : 0;

      const tempoMedioHoras = Math.floor(tempoMedioEstacionamento / 60);
      const tempoMedioMinutos = tempoMedioEstacionamento % 60;

      const aeroportoNome = aeroportosMapGlobal.get(aeroprocessar)?.nome || aeroprocessar;

    const dataInicioParsed = new Date(dataInicio + 'T00:00:00');
    const mesAno = dataInicioParsed.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase());

    let createdBy = 'sistema@sga.ao';
    try {
      const user = await base44.auth.me();
      if (user && user.email) {
        createdBy = user.email;
      }
    } catch (e) {
      console.log('⚠️ Erro ao obter utilizador autenticado');
    }

      const totalReceitasUSD = totalFaturaçãoUSD.toFixed(2);
      const totalReceitasAOA = Math.round(totalFaturacao).toLocaleString('pt-AO');
      const totalImpostosFormatadoUSD = totalImpostosUSD.toFixed(2);
      const totalImpostosFormatadoAOA = Math.round(totalImpostosAOA).toLocaleString('pt-AO');
      const totalSemImpostosUSD = (totalFaturaçãoUSD - totalImpostosUSD).toFixed(2);
      const totalSemImpostosAOA = Math.round(totalFaturacao - totalImpostosAOA).toLocaleString('pt-AO');
      const dataInicioFormatada = new Date(dataInicio + 'T00:00:00').toLocaleDateString('pt-PT');
      const dataFimFormatada = new Date(dataFim + 'T00:00:00').toLocaleDateString('pt-PT');

      // CRIAR OBJETO DE DADOS COM TODOS OS CAMPOS NECESSÁRIOS
      const dados = {
        mes_ano: mesAno,
        aeroporto: aeroprocessar,
        aeroporto_icao: aeroprocessar,
        aeroporto_nome: aeroportoNome,
        periodo: periodo,
        data_inicio: dataInicio,
        data_fim: dataFim,
        data_inicio_formatada: dataInicioFormatada,
        data_fim_formatada: dataFimFormatada,
        data_relatorio: dataInicio,
        semana_inicio: dataInicio,
        semana_fim: dataFim,
        total_voos: voos.length.toString(),
        voos_arr: voosArr.length.toString(),
        voos_dep: voosDep.length.toString(),
        tempo_medio_permanencia: `${tempoMedioHoras} h ${tempoMedioMinutos} min`,
        tempo_medio_estacionamento: `${tempoMedioHoras} h ${tempoMedioMinutos} min`,
        tempo_medio_permanencia_horas: tempoMedioHoras.toString(),
        tempo_medio_permanencia_minutos: tempoMedioMinutos.toString(),
        tempo_medio_estacionamento_min: tempoMedioEstacionamento.toString(),
        total_tarifa_usd: totalReceitasUSD,
        total_tarifa: totalReceitasAOA,
        total_impostos_usd: totalImpostosFormatadoUSD,
        total_impostos_aoa: totalImpostosFormatadoAOA,
        subtotal_sem_impostos_usd: totalSemImpostosUSD,
        subtotal_sem_impostos_aoa: totalSemImpostosAOA,
        // Tarifas detalhadas por tipo (em AOA)
        tarifa_pouso_aoa: Math.round(totalTarifaPouso).toLocaleString('pt-AO'),
        tarifa_permanencia_aoa: Math.round(totalTarifaPermanencia).toLocaleString('pt-AO'),
        tarifa_passageiros_aoa: Math.round(totalTarifaPassageiros).toLocaleString('pt-AO'),
        tarifa_carga_aoa: Math.round(totalTarifaCarga).toLocaleString('pt-AO'),
        outras_tarifas_aoa: Math.round(totalOutrasTarifas).toLocaleString('pt-AO'),
        // Tarifas detalhadas por tipo (em USD)
        tarifa_pouso_usd: totalTarifaPousouUSD.toFixed(2),
        tarifa_permanencia_usd: totalTarifaPermanenciaUSD.toFixed(2),
        tarifa_passageiros_usd: totalTarifaPassageirosUSD.toFixed(2),
        tarifa_carga_usd: totalTarifaCargaUSD.toFixed(2),
        outras_tarifas_usd: totalOutrasTarifasUSD.toFixed(2),
        total_passageiros: totalPassageiros.toString(),
        total_carga_kg: totalCarga.toString(),
        taxa_cambio_usd_aoa: (configsSistema.length > 0 && configsSistema[0].taxa_cambio_usd_aoa) ? 
          configsSistema[0].taxa_cambio_usd_aoa.toString() : '890',
        periodo_noturno: 'Não',
        created_date: new Date().toISOString().split('T')[0],
        created_by: createdBy
      };

      console.log(`✅ OBJETO DADOS CRIADO - ${Object.keys(dados).length} campos`);
      console.log('Campos:', Object.keys(dados));

      const eventoGatilho = `relatorio_operacional_${periodo}`;
      // FILTRAR EM MEMÓRIA as regras já carregadas
      const regrasAplicaveis = todasRegras.filter(regra => {
        if (regra.evento_gatilho !== eventoGatilho) return false;
        const aeroportoRegra = regra.aeroporto_icao_relatorio || '';
        return aeroportoRegra === '' || aeroportoRegra === aeroprocessar;
      });

      console.log(`📋 ${regrasAplicaveis.length} regra(s) aplicável(eis)`);

      const configWhatsapp = configsGlobais.find(c => c.numero_whatsapp_oficial);
      const provedorWhatsapp = (configsGlobais.length > 0 && configsGlobais[0].provedor_whatsapp) || 'twilio';

      let notificacoesEnviadasAero = 0;
      const resultadosAero = [];

      const destinatariosMap = new Map();

      for (const regra of regrasAplicaveis) {
      const usersNaRegra = [];

      if (regra.destinatarios_perfis && regra.destinatarios_perfis.length > 0) {
         // FILTRAR EM MEMÓRIA os usuários já carregados
         for (const usuario of todosUsuarios) {
           if (usuario.perfis && usuario.perfis.some(p => regra.destinatarios_perfis.includes(p))) {
             usersNaRegra.push(usuario);
           }
         }
       }

       if (regra.destinatarios_usuarios_ids && regra.destinatarios_usuarios_ids.length > 0) {
         for (const userId of regra.destinatarios_usuarios_ids) {
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
             regras: [regra.nome]
           });
         } else {
           destinatariosMap.get(usuario.id).regras.push(regra.nome);
         }

         const entrada = destinatariosMap.get(usuario.id);
         regra.canal_envio.forEach(canal => entrada.canais.add(canal));
       }
     }

    console.log(`👥 ${destinatariosMap.size} destinatário(s) únicos`);

    // Processar envio para grupos WhatsApp (Z-API) ANTES dos individuais
    for (const regra of regrasAplicaveis) {
      if (regra.grupo_whatsapp_id && regra.canal_envio && regra.canal_envio.includes('whatsapp')) {
        try {
          console.log(`📡 Enviando para grupo WhatsApp: ${regra.grupo_whatsapp_id}`);

          let mensagem = regra.mensagem_template_whatsapp || '';

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
          if (notificacoesEnviadasAero > 0) {
           const delayMs = 500 + (notificacoesEnviadasAero * 200);
           await new Promise(resolve => setTimeout(resolve, delayMs));
          }

          await base44.asServiceRole.functions.invoke('sendWhatsAppMessageToGroupZAPI', {
           groupId: regra.grupo_whatsapp_id,
           body: mensagem
          });

          notificacoesEnviadasAero++;
          resultadosAero.push({
            destinatario: `Grupo WhatsApp (${regra.nome})`,
            canais: ['whatsapp_grupo'],
            status: 'enviado'
          });

          console.log(`✅ Mensagem enviada para grupo com sucesso`);
        } catch (e) {
          console.error(`❌ Erro ao enviar para grupo: ${e.message}`);
          resultadosAero.push({
            destinatario: `Grupo WhatsApp (${regra.nome})`,
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
        console.log(`🔍 WhatsApp check para ${usuario.email}:`);
        console.log(`   - Número: ${usuario.whatsapp_number || 'NÃO CONFIGURADO'}`);
        console.log(`   - Opt-in: ${usuario.whatsapp_opt_in_status || 'NÃO DEFINIDO'}`);
        
        if (!usuario.whatsapp_number) {
          console.log(`   ❌ Número de WhatsApp não configurado`);
          erros.push({
            canal: 'whatsapp',
            motivo: 'Número de WhatsApp não configurado'
          });
        } else if (usuario.whatsapp_opt_in_status !== 'confirmado') {
          try {
            await base44.functions.invoke('enviarOptInWhatsApp', {
              user_id: usuario.id
            });
            resultadosAero.push({
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
            let provedorPreferencial = null;
            
            for (const regra of regrasAplicaveis) {
              if (regra.mensagem_template_whatsapp && entrada.regras.includes(regra.nome)) {
                mensagem = regra.mensagem_template_whatsapp;
                provedorPreferencial = regra.provedor_whatsapp_preferencial;
                break;
              }
            }

            if (!mensagem) {
              throw new Error('Nenhum template WhatsApp encontrado');
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

            console.log(`📤 Enviando WhatsApp para ${usuario.full_name}`);
            console.log(`   De: ${configWhatsapp.numero_whatsapp_oficial}`);
            console.log(`   Para: ${usuario.whatsapp_number}`);

            // Determinar provedor (preferência da regra ou configuração global)
            // Se a regra não define provedor (vazio, null, undefined), usar o global
            const provedorParaUtilizador = (provedorPreferencial && provedorPreferencial.trim() !== '') ? provedorPreferencial : provedorWhatsapp;

            // Se for Z-API, enviar diretamente (sem opt-in ou 24h)
            if (provedorParaUtilizador === 'zapi') {
              console.log(`   📡 Usando Z-API`);
              const numeroLimpo = usuario.whatsapp_number.replace('whatsapp:', '').replace(/\s/g, '');
              console.log(`   📞 Número limpo: ${numeroLimpo}`);
              console.log(`   📝 Tamanho mensagem: ${mensagem.length} chars`);
              
              // Z-API usa chamada direta à API
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
              console.log(`   ✅ Z-API enviado:`, data.messageId);
            } else {
              // Se for Twilio, usar regra de 24h
              console.log(`   📱 Usando Twilio`);
              const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
              const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');

              if (!twilioAccountSid || !twilioAuthToken) {
                throw new Error('Twilio não está configurado');
              }

              const twilio = await import('npm:twilio');
              const client = twilio.default(twilioAccountSid, twilioAuthToken);

              const messageParams = {
                from: configWhatsapp.numero_whatsapp_oficial,
                to: usuario.whatsapp_number,
                body: mensagem,
                statusCallback: 'https://dirops.base44.app/api/apps/6870dc26cbf5444a4fbe6aa9/functions/whatsAppStatusCallback'
              };

              // Verificar se precisa usar template (24h expiradas)
              if (usuario.whatsapp_opt_in_date) {
                try {
                  const { differenceInHours, parseISO } = await import('npm:date-fns');
                  const optInDateTime = parseISO(usuario.whatsapp_opt_in_date);
                  const now = new Date();
                  const horasDecorridas = differenceInHours(now, optInDateTime);
                  
                  if (horasDecorridas >= 24) {
                    const contentSid = Deno.env.get('Content_template_SID');
                    if (contentSid) {
                      messageParams.contentSid = contentSid;
                      console.log(`   ⏰ Usando template (${horasDecorridas}h desde opt-in)`);
                    }
                  }
                } catch (e) {
                  console.warn(`   ⚠️ Erro ao verificar opt-in date`);
                }
              }

              const message = await client.messages.create(messageParams);
              console.log(`   ✅ Twilio SID: ${message.sid}`);
            }

            canaisEnviadosComSucesso.push('whatsapp');

            // Delay progressivo para evitar rate limit
            if (notificacoesEnviadasAero > 0) {
              const delayMs = 500 + (notificacoesEnviadasAero * 200);
              await new Promise(resolve => setTimeout(resolve, delayMs));
            }
          } catch (e) {
            console.error(`❌ Erro WhatsApp: ${e.message}`);
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

        for (const regra of regrasAplicaveis) {
          if (regra.mensagem_template_email_assunto && entrada.regras.includes(regra.nome)) {
            assunto = regra.mensagem_template_email_assunto;
            corpo = regra.mensagem_template_email_corpo;
            break;
          }
        }

        if (assunto && corpo) {
          try {
            let asuntoProcessado = assunto;
            let corpoProcessado = corpo;

            Object.keys(dados).forEach(key => {
              if (key !== 'detalhes_aeroportos_html' && key !== 'detalhes_aeroportos_json' && key !== 'detalhes_aeroportos_texto' && key !== 'detalhes_aeroportos_texto_whatsapp') {
                const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
                const valor = String(dados[key]);
                asuntoProcessado = asuntoProcessado.replace(regex, valor);
                corpoProcessado = corpoProcessado.replace(regex, valor);
              }
            });

            console.log(`📧 Email para ${usuario.email}`);
            await base44.integrations.Core.SendEmail({
              to: usuario.email,
              subject: asuntoProcessado,
              body: corpoProcessado
            });

            canaisEnviadosComSucesso.push('email');
          } catch (e) {
            console.error(`❌ Erro Email: ${e.message}`);
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
            tipo_relatorio: periodo,
            aeroporto_icao: aeroprocessar,
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
        notificacoesEnviadasAero++;
        resultadosAero.push({
          destinatario: usuario.full_name,
          canais: canaisEnviadosComSucesso,
          status: 'enviado'
        });
      }

      if (erros.length > 0) {
        erros.forEach(erro => {
          resultadosAero.push({
            destinatario: usuario.full_name,
            canal: erro.canal,
            status: 'erro',
            motivo: erro.motivo
          });
        });
      }
      }

      totalNotificacoes += notificacoesEnviadasAero;
      resultadosGerais.push(...resultadosAero);
    }

      return Response.json({
      sucesso: true,
      periodo,
      aeroporto: aeroporto_icao || 'todos',
      dataInicio,
      dataFim,
      notificacoes_enviadas: totalNotificacoes,
      resultados: resultadosGerais,
      mensagem: `Relatório ${periodo} gerado - ${totalNotificacoes} notificação(ões)`
      });

  } catch (error) {
    console.error('❌ Erro crítico:', error);
    return Response.json({ 
      error: 'Erro ao gerar relatório',
      details: error.message 
    }, { status: 500 });
  }
});