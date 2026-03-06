import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const payload = await req.json();
        const { cacheVooId } = payload;

        if (!cacheVooId) {
            return Response.json({ 
                error: 'Missing required parameter: cacheVooId' 
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
        
        // ===== VERIFICAR VOO DUPLICADO =====
        const dtDescolagem = fr24Data.datetime_takeoff ? new Date(fr24Data.datetime_takeoff) : new Date();
        const dataOperacao = dtDescolagem.toISOString().split('T')[0];
        
        let tipoMovimento = 'DEP';
        if (cacheVoo.airport_icao === (fr24Data.dest_icao || fr24Data.dest_iata)) {
            tipoMovimento = 'ARR';
        }
        
        const vooExistente = await base44.entities.Voo.filter({
            numero_voo: fr24Data.callsign || fr24Data.flight,
            data_operacao: dataOperacao,
            tipo_movimento: tipoMovimento,
            aeroporto_operacao: cacheVoo.airport_icao
        }, null, 1);

        // Calcular atraso em minutos
        let atrasoMinutos = null;
        if (fr24Data.datetime_scheduled_takeoff && fr24Data.datetime_takeoff) {
            const scheduled = new Date(fr24Data.datetime_scheduled_takeoff);
            const actual = new Date(fr24Data.datetime_takeoff);
            atrasoMinutos = Math.round((actual - scheduled) / 60000);
        }

        // Helper para formatar horários ISO 8601 para HH:MM
        const formatarHorarioFR24 = (dateString) => {
            if (!dateString) return null;
            try {
                // Se for string ISO (ex: "2023-11-08T10:10:00Z" ou "2025-02-13T21:23:39")
                if (typeof dateString === 'string') {
                    return dateString.substring(11, 16); // Extrai HH:MM
                }
                return null;
            } catch {
                return null;
            }
        };
        
        const suggestions = {
            aeroporto_origem: null,
            aeroporto_destino: null,
            companhia_aerea: null,
            modelo_aeronave: null,
            registo_aeronave: null,
            voo_duplicado: vooExistente.length > 0 ? {
                status: 'existe',
                voo_id: vooExistente[0].id,
                dados: vooExistente[0],
                dadosAPI: {
                    numero_voo: fr24Data.callsign || fr24Data.flight,
                    data_operacao: dataOperacao,
                    horario_previsto: formatarHorarioFR24(fr24Data.datetime_scheduled_takeoff || fr24Data.timestamp),
                    horario_real: tipoMovimento === 'ARR' 
                        ? formatarHorarioFR24(fr24Data.datetime_landed)
                        : formatarHorarioFR24(fr24Data.datetime_takeoff),
                    tipo_movimento: tipoMovimento,
                    aeroporto_operacao: cacheVoo.airport_icao,
                    aeroporto_origem_destino: tipoMovimento === 'ARR' ? (fr24Data.orig_icao || fr24Data.orig_iata) : (fr24Data.dest_icao || fr24Data.dest_iata),
                    registo_aeronave: fr24Data.reg,
                    companhia_aerea: fr24Data.operating_as || fr24Data.painted_as,
                    atraso_minutos: atrasoMinutos
                    }
                    } : null
        };

        // ===== AEROPORTO ORIGEM =====
        const origIcao = (fr24Data.orig_icao || fr24Data.orig_iata || '').toUpperCase().trim();
        if (origIcao) {
            const aeroportoExistente = await base44.entities.Aeroporto.filter({
                $or: [
                    { codigo_icao: origIcao },
                    { codigo_iata: origIcao }
                ]
            }, null, 1);

            if (aeroportoExistente.length === 0) {
                suggestions.aeroporto_origem = {
                    status: 'novo',
                    dados: {
                        codigo_icao: origIcao,
                        codigo_iata: fr24Data.orig_iata || '',
                        nome: fr24Data.origin_airport_name || `Aeroporto ${origIcao}`,
                        cidade: fr24Data.origin_city || 'N/A',
                        pais: 'Unknown'
                    }
                };
            } else {
                suggestions.aeroporto_origem = {
                    status: 'existente',
                    dados: aeroportoExistente[0]
                };
            }
        } else {
            suggestions.aeroporto_origem = {
                status: 'desconhecido',
                dados: {
                    codigo_icao: 'Desconhecido',
                    nome: 'Aeroporto de origem não identificado',
                    observacao: 'Informação não disponível nos dados do Flightradar24'
                }
            };
        }

        // ===== AEROPORTO DESTINO =====
        const destIcao = (fr24Data.dest_icao || fr24Data.dest_iata || '').toUpperCase().trim();
        if (destIcao) {
            const aeroportoExistente = await base44.entities.Aeroporto.filter({
                $or: [
                    { codigo_icao: destIcao },
                    { codigo_iata: destIcao }
                ]
            }, null, 1);

            if (aeroportoExistente.length === 0) {
                suggestions.aeroporto_destino = {
                    status: 'novo',
                    dados: {
                        codigo_icao: destIcao,
                        codigo_iata: fr24Data.dest_iata || '',
                        nome: fr24Data.destination_airport_name || `Aeroporto ${destIcao}`,
                        cidade: fr24Data.destination_city || 'N/A',
                        pais: 'Unknown'
                    }
                };
            } else {
                suggestions.aeroporto_destino = {
                    status: 'existente',
                    dados: aeroportoExistente[0]
                };
            }
        } else {
            suggestions.aeroporto_destino = {
                status: 'desconhecido',
                dados: {
                    codigo_icao: 'Desconhecido',
                    nome: 'Aeroporto de destino não identificado',
                    observacao: 'Informação não disponível nos dados do Flightradar24'
                }
            };
        }

        // ===== COMPANHIA AÉREA =====
        const operatingAs = (fr24Data.operating_as || fr24Data.painted_as || '').toUpperCase().trim();
        if (operatingAs) {
            const companhiaExistente = await base44.entities.CompanhiaAerea.filter({
                $or: [
                    { codigo_icao: operatingAs },
                    { codigo_iata: operatingAs }
                ]
            }, null, 1);

            if (companhiaExistente.length === 0) {
                suggestions.companhia_aerea = {
                    status: 'novo',
                    dados: {
                        codigo_icao: operatingAs,
                        codigo_iata: operatingAs,
                        nome: fr24Data.airline_name || operatingAs,
                        tipo: 'comercial'
                    }
                };
            } else {
                suggestions.companhia_aerea = {
                    status: 'existente',
                    dados: companhiaExistente[0]
                };
            }
        }

        // ===== MODELO AERONAVE =====
        const modeloIata = (fr24Data.type || '').toUpperCase().trim();
        if (modeloIata) {
            const modeloExistente = await base44.entities.ModeloAeronave.filter({
                codigo_iata: modeloIata
            }, null, 1);

            if (modeloExistente.length === 0) {
                suggestions.modelo_aeronave = {
                    status: 'novo',
                    dados: {
                        modelo: fr24Data.aircraft_type_name || modeloIata,
                        codigo_iata: modeloIata,
                        codigo_icao: modeloIata,
                        mtow_kg: fr24Data.aircraft_mtow || 0,
                        envergadura_m: 0
                    }
                };
            } else {
                suggestions.modelo_aeronave = {
                    status: 'existente',
                    dados: modeloExistente[0]
                };
            }
        }

        // ===== REGISTO AERONAVE =====
        const registo = (fr24Data.reg || '').toUpperCase().trim();
        if (registo) {
            const registoNormalizado = registo.replace(/[^A-Z0-9]/g, '');
            const registoExistente = await base44.entities.RegistoAeronave.filter({
                registo_normalizado: registoNormalizado
            }, null, 1);

            if (registoExistente.length === 0) {
                suggestions.registo_aeronave = {
                    status: 'novo',
                    dados: {
                        registo: registo,
                        registo_normalizado: registoNormalizado,
                        mtow_kg: fr24Data.aircraft_mtow || 0
                    }
                };
            } else {
                suggestions.registo_aeronave = {
                    status: 'existente',
                    dados: registoExistente[0]
                };
            }
        }

        return Response.json({
            success: true,
            cacheVooId: cacheVooId,
            voo_resumo: {
                numero_voo: fr24Data.callsign,
                origem: suggestions.aeroporto_origem?.dados?.codigo_icao || 'Desconhecido',
                destino: suggestions.aeroporto_destino?.dados?.codigo_icao || 'Desconhecido',
                registo: registo,
                data_operacao: dataOperacao,
                tipo_movimento: tipoMovimento
            },
            suggestions: suggestions
        });

    } catch (error) {
        console.error('❌ Error in validateAndSuggestFR24CrossCheck:', error.message);
        return Response.json({ 
            error: 'Internal server error',
            details: error.message 
        }, { status: 500 });
    }
});