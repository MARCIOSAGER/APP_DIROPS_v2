import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const payload = await req.json();
        const { cacheVooId, suggestions, userSelections } = payload;

        if (!cacheVooId || !suggestions || !userSelections) {
            return Response.json({ 
                error: 'Missing required parameters' 
            }, { status: 400 });
        }

        // Buscar o voo no cache
        const cacheVoo = await base44.entities.CacheVooFR24.get(cacheVooId);
        if (!cacheVoo) {
            return Response.json({ 
                error: 'Cache voo não encontrado' 
            }, { status: 404 });
        }

        const fr24Data = cacheVoo.raw_data;
        const createdIds = {};

        // ===== CRIAR/USAR AEROPORTO ORIGEM =====
        let aeroportoOrigemId = null;
        if (userSelections.aeroporto_origem === 'novo' && suggestions.aeroporto_origem?.status === 'novo') {
            const novoAeroporto = await base44.entities.Aeroporto.create({
                codigo_icao: suggestions.aeroporto_origem.dados.codigo_icao,
                codigo_iata: suggestions.aeroporto_origem.dados.codigo_iata,
                nome: suggestions.aeroporto_origem.dados.nome,
                cidade: suggestions.aeroporto_origem.dados.cidade,
                pais: suggestions.aeroporto_origem.dados.pais,
                categoria: 'categoria_1'
            });
            aeroportoOrigemId = novoAeroporto.id;
            createdIds.aeroporto_origem = novoAeroporto.id;
        } else if (suggestions.aeroporto_origem?.status === 'existente') {
            aeroportoOrigemId = suggestions.aeroporto_origem.dados.id;
        }

        // ===== CRIAR/USAR AEROPORTO DESTINO =====
        let aeroportoDestinoId = null;
        if (userSelections.aeroporto_destino === 'novo' && suggestions.aeroporto_destino?.status === 'novo') {
            const novoAeroporto = await base44.entities.Aeroporto.create({
                codigo_icao: suggestions.aeroporto_destino.dados.codigo_icao,
                codigo_iata: suggestions.aeroporto_destino.dados.codigo_iata,
                nome: suggestions.aeroporto_destino.dados.nome,
                cidade: suggestions.aeroporto_destino.dados.cidade,
                pais: suggestions.aeroporto_destino.dados.pais,
                categoria: 'categoria_1'
            });
            aeroportoDestinoId = novoAeroporto.id;
            createdIds.aeroporto_destino = novoAeroporto.id;
        } else if (suggestions.aeroporto_destino?.status === 'existente') {
            aeroportoDestinoId = suggestions.aeroporto_destino.dados.id;
        }

        // ===== CRIAR/USAR COMPANHIA AÉREA =====
        let companhiaId = null;
        if (userSelections.companhia_aerea === 'novo' && suggestions.companhia_aerea?.status === 'novo') {
            const novaCompanhia = await base44.entities.CompanhiaAerea.create({
                codigo_icao: suggestions.companhia_aerea.dados.codigo_icao,
                codigo_iata: suggestions.companhia_aerea.dados.codigo_iata,
                nome: suggestions.companhia_aerea.dados.nome,
                tipo: suggestions.companhia_aerea.dados.tipo || 'comercial'
            });
            companhiaId = novaCompanhia.id;
            createdIds.companhia_aerea = novaCompanhia.id;
        } else if (suggestions.companhia_aerea?.status === 'existente') {
            companhiaId = suggestions.companhia_aerea.dados.id;
        }

        // ===== CRIAR/USAR MODELO AERONAVE =====
        let modeloId = null;
        if (userSelections.modelo_aeronave === 'novo' && suggestions.modelo_aeronave?.status === 'novo') {
            const novoModelo = await base44.entities.ModeloAeronave.create({
                modelo: suggestions.modelo_aeronave.dados.modelo,
                codigo_iata: suggestions.modelo_aeronave.dados.codigo_iata,
                codigo_icao: suggestions.modelo_aeronave.dados.codigo_icao,
                mtow_kg: suggestions.modelo_aeronave.dados.mtow_kg || 0,
                envergadura_m: suggestions.modelo_aeronave.dados.envergadura_m || 0,
                ac_code: suggestions.modelo_aeronave.dados.codigo_iata
            });
            modeloId = novoModelo.id;
            createdIds.modelo_aeronave = novoModelo.id;
        } else if (suggestions.modelo_aeronave?.status === 'existente') {
            modeloId = suggestions.modelo_aeronave.dados.id;
        }

        // ===== CRIAR/USAR REGISTO AERONAVE =====
        let registoId = null;
        if (userSelections.registo_aeronave === 'novo' && suggestions.registo_aeronave?.status === 'novo') {
            const novoRegisto = await base44.entities.RegistoAeronave.create({
                registo: suggestions.registo_aeronave.dados.registo,
                registo_normalizado: suggestions.registo_aeronave.dados.registo_normalizado,
                id_modelo_aeronave: modeloId,
                id_companhia_aerea: companhiaId,
                mtow_kg: suggestions.registo_aeronave.dados.mtow_kg || 0
            });
            registoId = novoRegisto.id;
            createdIds.registo_aeronave = novoRegisto.id;
        } else if (suggestions.registo_aeronave?.status === 'existente') {
            registoId = suggestions.registo_aeronave.dados.id;
        }

        // ===== CRIAR OU ATUALIZAR VOO =====
         const dtDescolagem = fr24Data.datetime_takeoff ? new Date(fr24Data.datetime_takeoff) : new Date();
         const dataOperacao = dtDescolagem.toISOString().split('T')[0];
         const horarioDescolagem = dtDescolagem.toTimeString().slice(0, 5);

         let tipoMovimento = 'DEP';
         if (cacheVoo.airport_icao === (fr24Data.dest_icao || fr24Data.dest_iata)) {
             tipoMovimento = 'ARR';
         }

         const vooFinalData = {
             tipo_movimento: tipoMovimento,
             numero_voo: fr24Data.callsign || fr24Data.flight || 'UNKNOWN',
             data_operacao: dataOperacao,
             horario_previsto: horarioDescolagem,
             horario_real: horarioDescolagem,
             aeroporto_operacao: cacheVoo.airport_icao,
             registo_aeronave: suggestions.registo_aeronave?.dados?.registo || fr24Data.reg || 'UNKNOWN',
             companhia_aerea: suggestions.companhia_aerea?.dados?.codigo_icao || fr24Data.operating_as || 'UNKNOWN',
             aeroporto_origem_destino: tipoMovimento === 'ARR' 
                 ? (fr24Data.orig_icao || fr24Data.orig_iata)
                 : (fr24Data.dest_icao || fr24Data.dest_iata),
             tipo_voo: 'Regular',
             status: 'Realizado',
             origem_dados: 'fr24',
             status_validacao: 'pendente',
             fr24_id: cacheVoo.fr24_id
         };

         let novoVoo;
         // Se é um voo duplicado, atualizar em vez de criar
         if (suggestions.voo_duplicado && suggestions.voo_duplicado.status === 'existe') {
             // Determinar qual dados usar baseado nas seleções do utilizador
             let updateData = {};
             if (userSelections['Voo Duplicado - Comparar e Editar']?.source === 'editar' && 
                 Object.keys(userSelections['Voo Duplicado - Comparar e Editar']?.editedData || {}).length > 0) {
                 // Usar dados editados
                 updateData = userSelections['Voo Duplicado - Comparar e Editar'].editedData;
             } else if (userSelections['Voo Duplicado - Comparar e Editar']?.source === 'api') {
                 // Usar dados da API
                 updateData = suggestions.voo_duplicado.dadosAPI;
             } else {
                 // Usar dados do sistema (padrão)
                 updateData = suggestions.voo_duplicado.dados;
             }
             // Atualizar o voo existente
             await base44.entities.Voo.update(suggestions.voo_duplicado.voo_id, updateData);
             novoVoo = { id: suggestions.voo_duplicado.voo_id };
         } else {
             // Criar novo voo
             novoVoo = await base44.entities.Voo.create(vooFinalData);
         }

        // ===== ATUALIZAR CACHE =====
        await base44.entities.CacheVooFR24.update(cacheVooId, {
            status: 'importado',
            observacoes: `Voo importado com sucesso. ID: ${novoVoo.id}`
        });

        return Response.json({
            success: true,
            vooId: novoVoo.id,
            createdRecords: createdIds,
            message: 'Voo importado com sucesso'
        });

    } catch (error) {
        console.error('❌ Error in importVooFromFR24Cache:', error.message);
        return Response.json({ 
            error: 'Erro ao importar voo',
            details: error.message 
        }, { status: 500 });
    }
});