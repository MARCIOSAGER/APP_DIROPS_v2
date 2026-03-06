import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const url = new URL(req.url);
        let aeroportoSelecionado = url.searchParams.get('aeroporto');
        let periodo = url.searchParams.get('periodo');
        
        if (!aeroportoSelecionado || !periodo) {
            try {
                const body = await req.json();
                aeroportoSelecionado = body.aeroporto || 'todos';
                periodo = parseInt(body.periodo || '30');
            } catch (e) {
                aeroportoSelecionado = aeroportoSelecionado || 'todos';
                periodo = parseInt(periodo || '30');
            }
        } else {
            periodo = parseInt(periodo);
        }

        const dataLimite = new Date();
        dataLimite.setDate(dataLimite.getDate() - periodo);
        const dataLimiteStr = dataLimite.toISOString().split('T')[0];

        let filtroVoos = { data_operacao: { $gte: dataLimiteStr } };
        let filtroOcorrencias = { data_ocorrencia: { $gte: dataLimiteStr } };

        let aeroportosPermitidos = [];
        const isAdmin = user.role === 'admin' || (user.perfis && user.perfis.includes('administrador'));
        
        if (isAdmin) {
            if (aeroportoSelecionado !== 'todos') {
                filtroVoos.aeroporto_operacao = aeroportoSelecionado.toUpperCase();
                filtroOcorrencias.aeroporto = aeroportoSelecionado.toUpperCase();
            }
        } else {
            aeroportosPermitidos = (user.aeroportos_acesso || []).map(c => c.trim().toUpperCase());
            
            if (aeroportosPermitidos.length === 0) {
                return Response.json({
                    totalVoos: 0, chegadasHoje: 0, partidasHoje: 0, taxaPontualidade: 0,
                    ocorrenciasAbertas: 0, inspecoesPendentes: 0, passageirosPeriodo: 0,
                    cargaTotalPeriodo: 0, voosLigados: 0, tempoMedioPermanencia: 0,
                    totalTarifas: 0, voosIsentos: 0, voosSemCalculo: 0, 
                    voosUnicosLigados: 0, voosSemLink: 0, top10Aeroportos: [],
                    _debug: { motivo: 'sem_acesso' }
                });
            }

            if (aeroportoSelecionado !== 'todos') {
                if (aeroportosPermitidos.includes(aeroportoSelecionado.toUpperCase())) {
                    filtroVoos.aeroporto_operacao = aeroportoSelecionado.toUpperCase();
                    filtroOcorrencias.aeroporto = aeroportoSelecionado.toUpperCase();
                } else {
                    return Response.json({
                        totalVoos: 0, chegadasHoje: 0, partidasHoje: 0, taxaPontualidade: 0,
                        ocorrenciasAbertas: 0, inspecoesPendentes: 0, passageirosPeriodo: 0,
                        cargaTotalPeriodo: 0, voosLigados: 0, tempoMedioPermanencia: 0,
                        totalTarifas: 0, voosIsentos: 0, voosSemCalculo: 0,
                        voosUnicosLigados: 0, voosSemLink: 0, top10Aeroportos: [],
                        _debug: { motivo: 'sem_permissao' }
                    });
                }
            } else {
                filtroVoos.aeroporto_operacao = { $in: aeroportosPermitidos };
                filtroOcorrencias.aeroporto = { $in: aeroportosPermitidos };
            }
        }

        // Buscar TODOS os voos do período com paginação
        const PAGE_SIZE = 1000;
        let voosData = [];
        let skipVoos = 0;
        while (true) {
            const batch = await base44.entities.Voo.filter(filtroVoos, '-data_operacao', PAGE_SIZE, skipVoos);
            if (!batch || batch.length === 0) break;
            voosData = voosData.concat(batch);
            if (batch.length < PAGE_SIZE) break;
            skipVoos += PAGE_SIZE;
        }

        // Buscar todos os voos ligados e cálculos de tarifa com paginação
        let voosLigadosData = [];
        let skipVL = 0;
        while (true) {
            const batch = await base44.entities.VooLigado.list('-created_date', PAGE_SIZE, skipVL);
            if (!batch || batch.length === 0) break;
            voosLigadosData = voosLigadosData.concat(batch);
            if (batch.length < PAGE_SIZE) break;
            skipVL += PAGE_SIZE;
        }

        let calculosTarifaData = [];
        let skipCT = 0;
        while (true) {
            const batch = await base44.entities.CalculoTarifa.list('-data_calculo', PAGE_SIZE, skipCT);
            if (!batch || batch.length === 0) break;
            calculosTarifaData = calculosTarifaData.concat(batch);
            if (batch.length < PAGE_SIZE) break;
            skipCT += PAGE_SIZE;
        }

        // Buscar ocorrências e aeroportos (menos dados, sem paginação necessária)
        const [ocorrenciasResult, aeroportosResult] = await Promise.allSettled([
            base44.entities.OcorrenciaSafety.filter(filtroOcorrencias, '-data_ocorrencia', 500),
            base44.entities.Aeroporto.list()
        ]);

        const ocorrenciasData = ocorrenciasResult.status === 'fulfilled' ? ocorrenciasResult.value : [];
        const aeroportosData = aeroportosResult.status === 'fulfilled' ? aeroportosResult.value : [];

        // Criar mapa rápido de voos por ID (apenas voos não cancelados)
        const voosMap = new Map(
            voosData
                .filter(v => v.status !== 'Cancelado') // Excluir voos cancelados
                .map(v => [v.id, v])
        );

        // Filtrar voos ligados válidos
        const voosLigadosValidos = voosLigadosData.filter(vl => {
            const vooArr = voosMap.get(vl.id_voo_arr);
            const vooDep = voosMap.get(vl.id_voo_dep);
            return vooArr && vooDep;
        });
        
        // Contar quantos voos ÚNICOS fazem parte de ligações
        const voosQueEstaoLigados = new Set();
        voosLigadosValidos.forEach(vl => {
            voosQueEstaoLigados.add(vl.id_voo_arr);
            voosQueEstaoLigados.add(vl.id_voo_dep);
        });
        
        const totalVoosValidos = voosMap.size;

        // Calcular estatísticas
        const hoje = new Date().toISOString().split('T')[0];
        const voosHoje = Array.from(voosMap.values()).filter(v => v.data_operacao === hoje);

        // Calcular passageiros e carga do período
        let passageirosPeriodo = 0;
        let cargaTotalPeriodo = 0;

        voosMap.forEach(voo => {
            passageirosPeriodo += (voo.passageiros_total || 0);
            cargaTotalPeriodo += (voo.carga_kg || 0);
        });

        // Calcular pontualidade
        const voosRealizadosComHorarios = Array.from(voosMap.values()).filter(v => 
            v.status === 'Realizado' && v.horario_previsto && v.horario_real
        );

        let taxaPontualidade = 0;
        if (voosRealizadosComHorarios.length > 0) {
            const onTimeFlights = voosRealizadosComHorarios.filter(voo => {
                const planned = new Date(`2000-01-01T${voo.horario_previsto}`);
                const actual = new Date(`2000-01-01T${voo.horario_real}`);
                const diffMinutes = Math.abs(actual - planned) / (1000 * 60);
                return diffMinutes <= 15;
            }).length;
            taxaPontualidade = (onTimeFlights / voosRealizadosComHorarios.length) * 100;
        }

        // Calcular tarifas apenas para voos ligados válidos
        const vooIdsLigados = new Set(voosLigadosValidos.map(vl => vl.id_voo_dep));
        const calculosParaVoosLigados = calculosTarifaData.filter(ct => vooIdsLigados.has(ct.voo_id));

        let tarifasVoosLigados = 0;
        let voosIsentos = 0;
        let voosSemCalculo = 0;

        voosLigadosValidos.forEach(vl => {
            const calculo = calculosParaVoosLigados.find(ct => ct.voo_id === vl.id_voo_dep);
            if (calculo) {
                if (calculo.tipo_tarifa === 'Voo Isento de Tarifas') {
                    voosIsentos++;
                } else {
                    tarifasVoosLigados += (calculo.total_tarifa || 0);
                }
            } else {
                voosSemCalculo++;
            }
        });

        // Calcular tempo médio de permanência
        let tempoMedioPermanenciaMinutos = 0;
        if (voosLigadosValidos.length > 0) {
            const tempoTotal = voosLigadosValidos.reduce((sum, vl) => sum + (vl.tempo_permanencia_min || 0), 0);
            tempoMedioPermanenciaMinutos = tempoTotal / voosLigadosValidos.length;
        }

        // Top 10 Aeroportos
        const aeroportosMap = new Map();
        voosMap.forEach(voo => {
            const icao = voo.aeroporto_operacao;
            if (!aeroportosMap.has(icao)) {
                aeroportosMap.set(icao, {
                    codigo_icao: icao,
                    totalMovimentos: 0,
                    movimentosArr: 0,
                    movimentosDep: 0,
                    passageiros: 0,
                    passageirosArr: 0,
                    passageirosDep: 0,
                    carga: 0,
                    cargaArr: 0,
                    cargaDep: 0
                });
            }
            const stats = aeroportosMap.get(icao);
            stats.totalMovimentos++;
            stats.passageiros += (voo.passageiros_total || 0);
            stats.carga += (voo.carga_kg || 0);

            if (voo.tipo_movimento === 'ARR') {
                stats.movimentosArr++;
                stats.passageirosArr += (voo.passageiros_total || 0);
                stats.cargaArr += (voo.carga_kg || 0);
            } else if (voo.tipo_movimento === 'DEP') {
                stats.movimentosDep++;
                stats.passageirosDep += (voo.passageiros_total || 0);
                stats.cargaDep += (voo.carga_kg || 0);
            }
        });

        // Enriquecer com dados dos aeroportos
        const top10Aeroportos = Array.from(aeroportosMap.values())
            .sort((a, b) => b.totalMovimentos - a.totalMovimentos)
            .slice(0, 10)
            .map(stats => {
                const aeroportoInfo = aeroportosData.find(a => a.codigo_icao === stats.codigo_icao);
                return {
                    ...stats,
                    nome: aeroportoInfo?.nome || stats.codigo_icao,
                    cidade: aeroportoInfo?.cidade || '',
                    id: aeroportoInfo?.id || stats.codigo_icao
                };
            });

        const stats = {
            totalVoos: totalVoosValidos,
            chegadasHoje: voosHoje.filter(v => v.tipo_movimento === 'ARR').length,
            partidasHoje: voosHoje.filter(v => v.tipo_movimento === 'DEP').length,
            passageirosPeriodo: passageirosPeriodo,
            cargaTotalPeriodo: Math.round(cargaTotalPeriodo),
            taxaPontualidade: Math.round(taxaPontualidade * 10) / 10,
            ocorrenciasAbertas: ocorrenciasData.filter(o => o.status === 'aberta').length,
            inspecoesPendentes: 0,
            voosLigados: voosLigadosValidos.length,
            voosUnicosLigados: voosQueEstaoLigados.size,
            voosSemLink: totalVoosValidos - voosQueEstaoLigados.size,
            tempoMedioPermanencia: Math.round((tempoMedioPermanenciaMinutos / 60) * 100) / 100,
            totalTarifas: Math.round(tarifasVoosLigados * 100) / 100,
            voosIsentos: voosIsentos,
            voosSemCalculo: voosSemCalculo,
            top10Aeroportos: top10Aeroportos,
            _debug: {
                filtroRecebido: { aeroporto: aeroportoSelecionado, periodo: periodo },
                filtroAplicado: filtroVoos,
                isAdmin: isAdmin,
                aeroportosPermitidos: aeroportosPermitidos,
                dataLimite: dataLimiteStr,
                voosRetornados: voosData.length,
                voosCancelados: voosData.length - voosMap.size,
                voosValidos: voosMap.size,
                voosLigadosBaseRetornados: voosLigadosData.length,
                voosLigadosValidos: voosLigadosValidos.length,
                voosUnicosQueEstaoLigados: voosQueEstaoLigados.size
            }
        };

        return Response.json(stats);

    } catch (error) {
        console.error('❌ [Backend] Erro:', error);
        return Response.json({ 
            error: 'Internal Server Error', 
            message: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
});