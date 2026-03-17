import { CalculoTarifa } from '@/entities/CalculoTarifa';
import { RecursoVoo } from '@/entities/RecursoVoo';
import { ServicoVoo } from '@/entities/ServicoVoo';

// Função para normalizar códigos de registo de aeronaves
const normalizeRegistro = (registro) => {
  if (!registro || typeof registro !== 'string') return '';
  return registro.trim().toUpperCase().replace(/[\s\-_.]/g, '');
};

// Função para arredondar PMD para a tonelada mais próxima por excesso
const roundUpToNearestTonne = (kg) => {
  return Math.ceil(kg / 1000);
};

// Função para verificar se a operação ocorre no período noturno (18h-06h local)
const isNightOperation = (dataOperacao, horarioReal) => {
  if (!dataOperacao || !horarioReal) return false;
  
  const [hour] = horarioReal.split(':').map(Number);
  
  // Período noturno: 18:00 às 06:00 local
  return hour >= 18 || hour < 6;
};

// Função para verificar se o voo é isento de tarifas
const isExemptFlight = (vooArr, vooDep) => {
  const exemptTypes = ['Militar','Humanitário', 'Oficial'];
  
  // Se QUALQUER um dos voos (ARR ou DEP) for do tipo isento, toda a operação é isenta
  const arrIsExempt = vooArr && exemptTypes.includes(vooArr.tipo_voo);
  const depIsExempt = vooDep && exemptTypes.includes(vooDep.tipo_voo);
  
  // Retorna true se QUALQUER UM deles for isento
  return arrIsExempt || depIsExempt;
};

// Helper function to format currency for display purposes
const formatCurrency = (amount) => {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return amount;
  }
  return amount.toFixed(2);
};

/**
 * Calcula todas as tarifas para um voo ligado
 */
export async function calculateAllTariffs(vooLigado, vooArr, vooDep, aeroportoOperacao, configuracao, impostos = []) {
  // Validação crítica dos parâmetros
  if (!vooArr) {
    console.error('❌ CRÍTICO: vooArr não fornecido');
    throw new Error('Voo de chegada (ARR) não fornecido para cálculo de tarifas.');
  }
  
  if (!vooDep) {
    console.error('❌ CRÍTICO: vooDep não fornecido');
    throw new Error('Voo de partida (DEP) não fornecido para cálculo de tarifas.');
  }
  
  if (!vooLigado) {
    console.error('❌ CRÍTICO: vooLigado não fornecido');
    throw new Error('Dados do voo ligado não fornecidos para cálculo de tarifas.');
  }
  
  if (!aeroportoOperacao) {
    console.error('❌ CRÍTICO: aeroportoOperacao não fornecido');
    throw new Error('Aeroporto de operação não fornecido para cálculo de tarifas.');
  }

  if (!aeroportoOperacao.categoria) {
    console.error('❌ CRÍTICO: Aeroporto sem categoria:', aeroportoOperacao);
    throw new Error(`Aeroporto "${aeroportoOperacao.codigo_icao || aeroportoOperacao.nome}" não possui categoria configurada. Configure em Operações > Configurações > Aeroportos.`);
  }

  if (!configuracao) {
    console.error('❌ CRÍTICO: configuracao não fornecida');
    throw new Error('Configuração de tarifas não fornecida para cálculo.');
  }

  // Extract data from configuracao object
  const aeroportos = configuracao.aeroportos;
  const aeronaves = configuracao.aeronaves;
  const tarifasPouso = configuracao.tarifasPouso;
  const tarifasPermanencia = configuracao.tarifasPermanencia;
  const outrasTarifas = configuracao.outrasTarifas;
  const taxaCambio = configuracao.taxaCambio || 850;



  // Initial validation for essential data arrays
  if (!aeroportos || !Array.isArray(aeroportos) || aeroportos.length === 0) {
    console.error('❌ CRÍTICO: Lista de aeroportos não fornecida ou vazia');
    throw new Error('Lista de aeroportos não disponível para cálculo de tarifas.');
  }

  if (!aeronaves || !Array.isArray(aeronaves) || aeronaves.length === 0) {
    console.error('❌ CRÍTICO: Lista de aeronaves não fornecida ou vazia');
    throw new Error('Lista de aeronaves não disponível para cálculo de tarifas.');
  }

  if (!tarifasPouso || !Array.isArray(tarifasPouso) || tarifasPouso.length === 0) {
    console.error('❌ CRÍTICO: Tarifas de pouso não fornecidas ou vazias');
    throw new Error('Tarifas de pouso não configuradas. Configure em Operações > Configurações > Tarifas de Pouso.');
  }

  if (!tarifasPermanencia || !Array.isArray(tarifasPermanencia) || tarifasPermanencia.length === 0) {
    console.error('❌ CRÍTICO: Tarifas de permanência não fornecidas ou vazias');
    throw new Error('Tarifas de permanência não configuradas. Configure em Operações > Configurações > Tarifas de Permanência.');
  }

  if (!outrasTarifas || !Array.isArray(outrasTarifas) || outrasTarifas.length === 0) {
    console.error('❌ CRÍTICO: Outras tarifas não fornecidas ou vazias');
    throw new Error('Outras tarifas não configuradas. Configure em Operações > Configurações > Outras Tarifas.');
  }

  // Buscar registo de aeronave com normalização
  // Se houve troca de registo, usar o registo DEP para MTOW (aeronave que partiu)
  const registoParaCalculo = vooLigado.registo_alterado
    ? vooLigado.registo_dep
    : vooArr.registo_aeronave;
  const registoNormalizado = normalizeRegistro(registoParaCalculo);
  const registoAeronave = aeronaves.find(r => normalizeRegistro(r.registo) === registoNormalizado);

  if (!registoAeronave || !registoAeronave.mtow_kg) {
    console.error(`❌ Registo não encontrado para voo ${vooArr.numero_voo}:`, {
      registoProcurado: registoParaCalculo,
      registoNormalizado: registoNormalizado,
      aeronavesCadastradas: aeronaves.map(a => ({ registo: a.registo, normalizado: normalizeRegistro(a.registo) }))
    });
    throw new Error(`Dados essenciais ausentes para voo ${vooArr.numero_voo}: Registo Aeronave/MTOW. Registo procurado: ${vooArr.registo_aeronave}. Certifique-se de que a aeronave está cadastrada em Operações > Configurações > Registos de Aeronaves.`);
  }

  const mtow_kg = registoAeronave.mtow_kg;
  const mtow_tonnes_rounded = roundUpToNearestTonne(mtow_kg);
  const categoria_aeroporto = aeroportoOperacao.categoria;
  
  // Determinar tipo de voo (Doméstico/Internacional)
  const aeroportoOrigem = configuracao.aeroportos.find(a => a.codigo_icao === vooArr.aeroporto_origem_destino);
  const aeroportoDestino = configuracao.aeroportos.find(a => a.codigo_icao === vooDep.aeroporto_origem_destino);

  // Se não encontrar origem ou destino, assumir doméstico (seguro)
  const isInternational = 
    (aeroportoOrigem && aeroportoOrigem.pais !== 'AO') ||
    (aeroportoOperacao && aeroportoOperacao.pais !== 'AO') ||
    (aeroportoDestino && aeroportoDestino.pais !== 'AO');
  
  const tipoOperacao = isInternational ? 'Internacional' : 'Doméstico';
  const tipoOperacaoEnum = isInternational ? 'internacional' : 'domestica';

  // Verificar se o voo é isento de tarifas
  const isExempt = isExemptFlight(vooArr, vooDep);

  // Tempo de permanência (estatístico) vs estacionamento (faturação)
  const tempoPermanenciaMinEstatistica = vooLigado.tempo_permanencia_min || 0;
  const tempoEstacionamentoMin = vooLigado.tempo_estacionamento_min ?? tempoPermanenciaMinEstatistica;
  const tempoPermanenciaHoras = Math.ceil(tempoEstacionamentoMin / 60);

  try {
    // IMPORTANTE: Usar os nomes EXATOS dos campos da entidade CalculoTarifa
    const results = {
      // Campos de identificação
      voo_id: vooDep.id,
      aeroporto_id: aeroportoOperacao.id,
      data_calculo: new Date().toISOString(),
      tipo_tarifa: 'Tarifas Aeroportuárias',
      mtow_kg: mtow_kg,
      taxa_cambio_usd_aoa: taxaCambio,
      
      // Inicializar TODOS os valores de tarifas com 0
      tarifa_pouso_usd: 0,
      tarifa_pouso: 0,
      
      tarifa_permanencia_usd: 0,
      tarifa_permanencia: 0,
      
      tarifa_passageiros_usd: 0,
      tarifa_passageiros: 0,
      
      tarifa_carga_usd: 0,
      tarifa_carga: 0,
      
      outras_tarifas_usd: 0,
      outras_tarifas: 0,

      tarifa_recursos_usd: 0,
      tarifa_recursos: 0,

      // CRÍTICO: Inicializar totais com 0
      total_tarifa_usd: 0,
      total_tarifa: 0,
      
      tempo_permanencia_horas: tempoPermanenciaHoras,
      periodo_noturno: false,
      
      detalhes_calculo: {
        outras: []
      }
    };

    // Se o voo é isento, retornar cálculo com valores zerados
    if (isExempt) {
      results.tipo_tarifa = "Voo Isento de Tarifas";
      results.detalhes_calculo = {
        isento: true,
        motivo_isencao: `Voo do tipo isento - ARR: ${vooArr.tipo_voo}, DEP: ${vooDep.tipo_voo}`,
        tipo_voo_arr: vooArr.tipo_voo,
        tipo_voo_dep: vooDep.tipo_voo,
        observacao: "Voos Militares, Oficiais e Humanitário são isentos de todas as tarifas aeroportuárias quando pelo menos um dos voos (chegada ou partida) é desse tipo.",
        categoria_aeroporto: categoria_aeroporto
      };
      
      return results;
    }

    // Continuar com o cálculo normal para voos não isentos
    results.tipo_tarifa = "Tarifas Aeroportuárias";

    // ==================== TARIFA DE POUSO (COBRADA APENAS UMA VEZ - NA DEP) ====================
    const tarifaPousoConfig = tarifasPouso.find(t =>
      mtow_kg >= t.faixa_min && mtow_kg <= t.faixa_max && 
      t.categoria_aeroporto === categoria_aeroporto && 
      t.status === 'ativa'
    );

    if (tarifaPousoConfig) {
      const tarifaPorTonelada = isInternational ? tarifaPousoConfig.tarifa_internacional : tarifaPousoConfig.tarifa_domestica;
      const mtow_tonnes = mtow_tonnes_rounded;
      
      results.tarifa_pouso_usd = tarifaPorTonelada * mtow_tonnes;

      results.detalhes_calculo.pouso = {
        tipoVoo: tipoOperacao,
        tarifaAplicada: tarifaPorTonelada,
        mtowKg: mtow_kg,
        mtowTonnes: mtow_tonnes.toFixed(3),
        faixa_min_kg: tarifaPousoConfig.faixa_min,
        faixa_max_kg: tarifaPousoConfig.faixa_max,
        faixa_min_ton: Math.ceil(tarifaPousoConfig.faixa_min / 1000),
        faixa_max_ton: Math.ceil(tarifaPousoConfig.faixa_max / 1000),
        operacoes: '1 (DEP apenas)',
        formula: `${tarifaPorTonelada} USD/ton × ${mtow_tonnes.toFixed(3)} ton × 1 operação`,
        valor: results.tarifa_pouso_usd,
        categoria_aeroporto: categoria_aeroporto
      };
    } else {
      results.detalhes_calculo.pouso = {
        erro: "Tarifa de pouso não encontrada para MTOW e categoria.",
        tipoVoo: tipoOperacao,
        categoria_aeroporto: categoria_aeroporto
      };
    }

    // ==================== TARIFA DE PERMANÊNCIA ====================
    // Verificar se a aeronave foi para o hangar (isenta permanência)
    const aeronaveNoHangar = vooArr.aeronave_no_hangar || vooDep.aeronave_no_hangar;
    
    if (aeronaveNoHangar) {
      results.detalhes_calculo.permanencia = {
        tipo: "Isento (Hangar)",
        tempoPermanencia: `${tempoPermanenciaHoras}h`,
        observacao: "Aeronave foi para o hangar - isenta de tarifa de estacionamento",
        valor: 0,
        categoria_aeroporto: categoria_aeroporto
      };
    } else if (tempoPermanenciaHoras > 2) {
      const tarifaPermanenciaBase = tarifasPermanencia.find(t =>
        t.categoria_aeroporto === categoria_aeroporto && t.status === 'ativa'
      );

      if (tarifaPermanenciaBase) {
        const tarifaBasePorTonneHora = tarifaPermanenciaBase.tarifa_usd_por_tonelada_hora;
        const horasCobradas = tempoPermanenciaHoras - 2;

        if (horasCobradas <= 4) {
          results.tarifa_permanencia_usd = tarifaBasePorTonneHora * mtow_tonnes_rounded * horasCobradas;
          results.detalhes_calculo.permanencia = {
            tipo: "Base (até 6h)",
            tarifaBase: tarifaBasePorTonneHora,
            mtowTonnes: mtow_tonnes_rounded,
            tempoPermanencia: `${tempoPermanenciaHoras}h`,
            horasCobradas: horasCobradas,
            horasIsentas: 2,
            formula: `${tarifaBasePorTonneHora} × ${mtow_tonnes_rounded}t × ${horasCobradas}h`,
            valor: results.tarifa_permanencia_usd,
            categoria_aeroporto: categoria_aeroporto
          };
        } else {
          const horasAlem6 = horasCobradas - 4;
          results.tarifa_permanencia_usd = (tarifaBasePorTonneHora * mtow_tonnes_rounded * 4) + 
                                  (tarifaBasePorTonneHora * 1.5 * mtow_tonnes_rounded * horasAlem6);
          results.detalhes_calculo.permanencia = {
            tipo: "Com Sobretaxa (>6h)",
            tarifaBase: tarifaBasePorTonneHora,
            mtowTonnes: mtow_tonnes_rounded,
            tempoPermanencia: `${tempoPermanenciaHoras}h`,
            horasCobradas: horasCobradas,
            horasIsentas: 2,
            horasBase: 4,
            horasAlem6: horasAlem6,
            formula: `(${tarifaBasePorTonneHora} × ${mtow_tonnes_rounded}t × 4h) + (${tarifaBasePorTonneHora} × 1.5 × ${mtow_tonnes_rounded}t × ${horasAlem6}h)`,
            valor: results.tarifa_permanencia_usd,
            categoria_aeroporto: categoria_aeroporto
          };
        }
      } else {
        results.detalhes_calculo.permanencia = {
          erro: "Tarifa de permanência base não encontrada para a categoria.",
          categoria_aeroporto: categoria_aeroporto
        };
      }
    } else {
      results.detalhes_calculo.permanencia = {
        tipo: "Isento (≤2h)",
        tempoPermanencia: `${tempoPermanenciaHoras}h`,
        horasIsentas: tempoPermanenciaHoras,
        valor: 0,
        categoria_aeroporto: categoria_aeroporto
      };
    }

    // ==================== TARIFA DE PASSAGEIROS ====================
    const totalPassageirosEmbarque = vooDep.passageiros_local || 0;
    
    // Apenas estes tipos de voo são isentos de tarifa de passageiros
    const tiposVooIsentos = ['Carga', 'Militar', 'Humanitário', 'Oficial', 'Técnico'];
    const isVooIsentoPassageiros = tiposVooIsentos.includes(vooDep.tipo_voo);

    // Cobrar tarifa de passageiros se:
    // 1. Houver passageiros para embarque (DEP)
    // 2. O tipo de voo NÃO estiver na lista de isentos
    if (totalPassageirosEmbarque > 0 && !isVooIsentoPassageiros) {
      const tarifaPassageirosConfig = outrasTarifas.find(t => 
        t.tipo === 'embarque' && 
        t.categoria_aeroporto === categoria_aeroporto &&
        t.status === 'ativa' &&
        (t.tipo_operacao === 'ambos' || t.tipo_operacao === tipoOperacaoEnum)
      );

      if (tarifaPassageirosConfig) {
        const tarifaPorPassageiro = tarifaPassageirosConfig.valor;
        results.tarifa_passageiros_usd = tarifaPorPassageiro * totalPassageirosEmbarque;

        results.detalhes_calculo.passageiros = {
          tipoVoo: tipoOperacao,
          descricao_tarifa: tarifaPassageirosConfig.descricao || 'Tarifa de Embarque',
          tipo_operacao_tarifa: tarifaPassageirosConfig.tipo_operacao,
          tarifaPorPassageiro: tarifaPorPassageiro,
          passageirosArr: vooArr.passageiros_local || 0,
          passageirosDep: totalPassageirosEmbarque,
          totalPassageirosCobranca: totalPassageirosEmbarque,
          transitoDireto: vooDep.passageiros_transito_direto || 0,
          transitoTransbordo: vooDep.passageiros_transito_transbordo || 0,
          formula: `${tarifaPorPassageiro} USD/pax × ${totalPassageirosEmbarque} pax`,
          observacao: 'Tarifa de embarque cobrada apenas para passageiros locais no voo de partida (DEP). Passageiros em trânsito (direto e transbordo) estão isentos. Isentos: Carga, Militar, Humanitário, Oficial e Técnico.',
          valor: results.tarifa_passageiros_usd,
          categoria_aeroporto: categoria_aeroporto
        };
      } else {
        results.tarifa_passageiros_usd = 0;
        results.detalhes_calculo.passageiros = {
          erro: `Tarifa de embarque não configurada para voos ${tipoOperacao.toLowerCase()}s na categoria ${categoria_aeroporto}.`,
          tipoVoo: tipoOperacao,
          categoria_aeroporto: categoria_aeroporto
        };
      }
    } else {
      results.tarifa_passageiros_usd = 0;
      
      let motivoIsencao = '';
      if (isVooIsentoPassageiros) {
        motivoIsencao = `Voo tipo "${vooDep.tipo_voo}" isento de tarifa de passageiros (apenas Carga, Militar, Humanitário, Oficial e Técnico são isentos)`;
      } else if (totalPassageirosEmbarque === 0) {
        motivoIsencao = 'Nenhum passageiro local para embarque (DEP)';
      }

      results.detalhes_calculo.passageiros = {
        tipoVoo: tipoOperacao,
        passageirosArr: vooArr.passageiros_local || 0,
        passageirosDep: totalPassageirosEmbarque,
        totalPassageirosCobranca: 0,
        transitoDireto: vooDep.passageiros_transito_direto || 0,
        transitoTransbordo: vooDep.passageiros_transito_transbordo || 0,
        observacao: motivoIsencao,
        valor: 0,
        categoria_aeroporto: categoria_aeroporto
      };
    }

    // ==================== TARIFA DE CARGA ====================
    // IMPORTANTE: A cobrança incide apenas sobre a carga DEP
    const cargaArr = vooArr.carga_kg || 0;
    const cargaDep = vooDep.carga_kg || 0;
    const totalCargaKg = cargaDep; // Apenas carga de partida
    const totalCargaTon = totalCargaKg / 1000;
    
    if (totalCargaKg > 0) {
      const tarifaCargaConfig = outrasTarifas.find(t => 
        t.tipo === 'carga' && 
        t.categoria_aeroporto === categoria_aeroporto &&
        t.status === 'ativa' &&
        (t.tipo_operacao === 'ambos' || t.tipo_operacao === tipoOperacaoEnum)
      );
      
      if (tarifaCargaConfig) {
        const tarifaPorTonelada = tarifaCargaConfig.valor;
        results.tarifa_carga_usd = parseFloat((totalCargaTon * tarifaPorTonelada).toFixed(2));

        results.detalhes_calculo.carga = {
          tipoVoo: tipoOperacao,
          descricao_tarifa: tarifaCargaConfig.descricao || 'Tarifa de Carga',
          tipo_operacao_tarifa: tarifaCargaConfig.tipo_operacao,
          tarifaPorTon: tarifaPorTonelada,
          cargaArr: cargaArr,
          cargaDep: cargaDep,
          totalCargaKg: totalCargaKg,
          totalCargaTon: parseFloat(totalCargaTon.toFixed(3)),
          formula: `${tarifaPorTonelada} USD/ton × ${totalCargaTon.toFixed(3)} ton`,
          observacao: 'A cobrança incide apenas sobre a carga DEP (partida)',
          valor: results.tarifa_carga_usd,
          categoria_aeroporto: categoria_aeroporto,
        };
      } else {
        console.warn(`⚠️ Tarifa de carga não encontrada para categoria ${categoria_aeroporto} e tipo ${tipoOperacaoEnum}`);
        results.tarifa_carga_usd = 0;
        results.detalhes_calculo.carga = {
          erro: `Tarifa de carga não configurada para voos ${tipoOperacao.toLowerCase()}s na categoria ${categoria_aeroporto}.`,
          tipoVoo: tipoOperacao,
          totalCargaKg: totalCargaKg,
          categoria_aeroporto: categoria_aeroporto,
          cargaArr: cargaArr,
          cargaDep: cargaDep
        };
      }
    } else {
      results.tarifa_carga_usd = 0;
      results.detalhes_calculo.carga = {
        tipoVoo: tipoOperacao,
        isento: true,
        razao: 'Sem carga declarada no voo DEP',
        cargaArr: cargaArr,
        cargaDep: cargaDep,
        totalCargaKg: 0,
        observacao: "Sem carga no voo DEP",
        valor: 0,
        categoria_aeroporto: categoria_aeroporto
      };
    }

    // ==================== TARIFA DE ILUMINAÇÃO ====================
    const arrNoturno = isNightOperation(vooArr.data_operacao, vooArr.horario_real || vooArr.horario_previsto);
    const depNoturno = isNightOperation(vooDep.data_operacao, vooDep.horario_real || vooDep.horario_previsto);
    const requerIluminacaoExtra = vooArr.requer_iluminacao_extra || vooDep.requer_iluminacao_extra;
    
    results.periodo_noturno = arrNoturno || depNoturno || requerIluminacaoExtra;
    
    if (results.periodo_noturno || requerIluminacaoExtra) {
      const tarifaIluminacaoConfig = outrasTarifas.find(t => 
        t.tipo === 'iluminacao' && 
        t.categoria_aeroporto === categoria_aeroporto && 
        t.status === 'ativa' &&
        (t.tipo_operacao === 'ambos' || t.tipo_operacao === tipoOperacaoEnum)
      );

      if (tarifaIluminacaoConfig) {
        const illuminationAmountDollars = tarifaIluminacaoConfig.valor;
        
        let motivoIluminacao = '';
        if (requerIluminacaoExtra) {
          motivoIluminacao = 'Iluminação extra requerida (dia escuro/neblina) - Sinal.Luz Xtra';
        } else if (arrNoturno || depNoturno) {
          motivoIluminacao = `Período noturno (18h00 - 06h00 local). ARR: ${vooArr.horario_real || vooArr.horario_previsto}, DEP: ${vooDep.horario_real || vooDep.horario_previsto}`;
        }
        
        results.detalhes_calculo.iluminacao = {
          tipoVoo: tipoOperacao,
          arrNoturno: arrNoturno,
          depNoturno: depNoturno,
          iluminacaoExtra: requerIluminacaoExtra,
          tarifaPorOperacao: illuminationAmountDollars,
          descricao_tarifa: tarifaIluminacaoConfig.descricao || 'Iluminação (Período Noturno)',
          tipo_operacao_tarifa: tarifaIluminacaoConfig.tipo_operacao,
          valorFixo: tarifaIluminacaoConfig.valor,
          unidade: tarifaIluminacaoConfig.unidade,
          formula: `${tarifaIluminacaoConfig.valor} USD (taxa fixa)`,
          periodo: "18:00 - 06:00 local",
          observacao: motivoIluminacao,
          valor: illuminationAmountDollars,
          categoria_aeroporto: categoria_aeroporto
        };
        results.outras_tarifas_usd += illuminationAmountDollars;
      } else {
        results.detalhes_calculo.iluminacao = {
          erro: `Tarifa de iluminação não configurada para voos ${tipoOperacao.toLowerCase()}s na categoria ${categoria_aeroporto}.`,
          tipoVoo: tipoOperacao,
          categoria_aeroporto: categoria_aeroporto
        };
      }
    } else {
      results.detalhes_calculo.iluminacao = {
        tipoVoo: tipoOperacao,
        isento: true,
        razao: 'Operação fora do período noturno (18h00 - 06h00 local) e sem iluminação extra requerida',
        arrNoturno: false,
        depNoturno: false,
        iluminacaoExtra: false,
        periodo: "18:00 - 06:00 local",
        observacao: "Ambas operações diurnas e sem iluminação extra, isentas de tarifa de iluminação",
        valor: 0,
        horarioArr: vooArr.horario_real || vooArr.horario_previsto,
        horarioDep: vooDep.horario_real || vooDep.horario_previsto,
        categoria_aeroporto: categoria_aeroporto
      };
    }
    
    // ==================== OUTRAS TARIFAS (SEGURANÇA, TRÂNSITO, ETC.) ====================
    const tarifaSegurancaConfig = outrasTarifas.find(t => 
      t.tipo === 'seguranca' && 
      t.categoria_aeroporto === categoria_aeroporto &&
      t.status === 'ativa' &&
      (t.tipo_operacao === 'ambos' || t.tipo_operacao === tipoOperacaoEnum)
    );
    
    if (tarifaSegurancaConfig) {
      const valorSeguranca = tarifaSegurancaConfig.valor;
      results.outras_tarifas_usd += valorSeguranca;
      
      results.detalhes_calculo.outras.push({
        tipo: 'seguranca',
        tipoVoo: tipoOperacao,
        descricao: tarifaSegurancaConfig.descricao || 'Tarifa de Segurança',
        tipo_operacao_tarifa: tarifaSegurancaConfig.tipo_operacao,
        valor: valorSeguranca,
        unidade: tarifaSegurancaConfig.unidade,
        formula: `${valorSeguranca} USD (${tarifaSegurancaConfig.unidade})`,
        observacao: 'Tarifa de segurança aeroportuária',
        categoria_aeroporto: categoria_aeroporto
      });
    }

    const passageirosTransitoTransbordo = vooDep.passageiros_transito_transbordo || 0;
    if (passageirosTransitoTransbordo > 0) {
      const tarifaTransitoTransbordoConfig = outrasTarifas.find(t => 
        t.tipo === 'transito_transbordo' && 
        t.categoria_aeroporto === categoria_aeroporto &&
        t.status === 'ativa' &&
        (t.tipo_operacao === 'ambos' || t.tipo_operacao === tipoOperacaoEnum)
      );

      if (tarifaTransitoTransbordoConfig) {
        const valorTransitoTransbordo = tarifaTransitoTransbordoConfig.valor * passageirosTransitoTransbordo;
        results.outras_tarifas_usd += valorTransitoTransbordo;

        results.detalhes_calculo.outras.push({
          tipo: 'transito_transbordo',
          tipoVoo: tipoOperacao,
          descricao: tarifaTransitoTransbordoConfig.descricao || 'Trânsito com Transbordo',
          tipo_operacao_tarifa: tarifaTransitoTransbordoConfig.tipo_operacao,
          tarifaPorPassageiro: tarifaTransitoTransbordoConfig.valor,
          passageiros: passageirosTransitoTransbordo,
          valor: valorTransitoTransbordo,
          formula: `${tarifaTransitoTransbordoConfig.valor} USD/pax × ${passageirosTransitoTransbordo} pax`,
          observacao: 'Passageiros em trânsito com transbordo de aeronave',
          categoria_aeroporto: categoria_aeroporto
        });
      } else {
        results.detalhes_calculo.outras.push({
            tipo: 'transito_transbordo',
            erro: `Tarifa de trânsito com transbordo não configurada para voos ${tipoOperacao.toLowerCase()}s na categoria ${categoria_aeroporto}.`,
            tipoVoo: tipoOperacao,
            categoria_aeroporto: categoria_aeroporto
        });
      }
    }

    const passageirosTransitoDireto = vooDep.passageiros_transito_direto || 0;
    if (passageirosTransitoDireto > 0) {
      const tarifaTransitoDiretoConfig = outrasTarifas.find(t => 
        t.tipo === 'transito_direto' && 
        t.categoria_aeroporto === categoria_aeroporto &&
        t.status === 'ativa' &&
        (t.tipo_operacao === 'ambos' || t.tipo_operacao === tipoOperacaoEnum)
      );

      if (tarifaTransitoDiretoConfig) {
        const valorTransitoDireto = tarifaTransitoDiretoConfig.valor * passageirosTransitoDireto;
        results.outras_tarifas_usd += valorTransitoDireto;

        results.detalhes_calculo.outras.push({
          tipo: 'transito_direto',
          tipoVoo: tipoOperacao,
          descricao: tarifaTransitoDiretoConfig.descricao || 'Trânsito Direto',
          tipo_operacao_tarifa: tarifaTransitoDiretoConfig.tipo_operacao,
          tarifaPorPassageiro: tarifaTransitoDiretoConfig.valor,
          passageiros: passageirosTransitoDireto,
          valor: valorTransitoDireto,
          formula: `${tarifaTransitoDiretoConfig.valor} USD/pax × ${passageirosTransitoDireto} pax`,
          observacao: 'Passageiros em trânsito direto (mesma aeronave)',
          categoria_aeroporto: categoria_aeroporto
        });
      } else {
        results.detalhes_calculo.outras.push({
            tipo: 'transito_direto',
            erro: `Tarifa de trânsito direto não configurada para voos ${tipoOperacao.toLowerCase()}s na categoria ${categoria_aeroporto}.`,
            tipoVoo: tipoOperacao,
            categoria_aeroporto: categoria_aeroporto
        });
      }
    }
    
    // ==================== CUPPSS / CUSS (AUTOMÁTICO — DEP: locais + transbordo) ====================
    const paxCuppss = (vooDep.passageiros_local || 0) + (vooDep.passageiros_transito_transbordo || 0);
    if (paxCuppss > 0 && !isVooIsentoPassageiros) {
      const tarifaCuppssConfig = outrasTarifas.find(t =>
        t.tipo === 'cuppss' &&
        t.categoria_aeroporto === categoria_aeroporto &&
        t.status === 'ativa' &&
        (t.tipo_operacao === 'ambos' || t.tipo_operacao === tipoOperacaoEnum)
      );
      if (tarifaCuppssConfig) {
        const valorCuppss = tarifaCuppssConfig.valor * paxCuppss;
        results.outras_tarifas_usd += valorCuppss;
        results.detalhes_calculo.outras.push({
          tipo: 'cuppss',
          tipoVoo: tipoOperacao,
          descricao: tarifaCuppssConfig.descricao || 'CUPPSS / CUSS',
          tipo_operacao_tarifa: tarifaCuppssConfig.tipo_operacao,
          tarifaPorPassageiro: tarifaCuppssConfig.valor,
          passageiros: paxCuppss,
          valor: valorCuppss,
          formula: `${tarifaCuppssConfig.valor} USD/pax × ${paxCuppss} pax (locais + transbordo DEP)`,
          observacao: 'CUPPSS e CUSS (Common Use Passenger Processing System) – por passageiro embarcado',
          categoria_aeroporto: categoria_aeroporto
        });
      }
    }

    // ==================== TARIFA DE RECURSOS (PCA, GPU, PBB, CHECK-IN, COMBUSTÍVEL) ====================
    try {
      // Buscar recurso_voo para este voo ligado
      const recursosVoo = await RecursoVoo.filter({ voo_ligado_id: vooLigado.id });
      const recurso = recursosVoo && recursosVoo.length > 0 ? recursosVoo[0] : null;

      let totalRecursosUSD = 0;
      const recursosDetalhes = [];

      if (recurso) {
        // PCA
        if (recurso.pca_utilizado && recurso.pca_valor_usd > 0) {
          totalRecursosUSD += recurso.pca_valor_usd;
          recursosDetalhes.push({
            tipo: 'PCA (Ar Pré-Condicionado)',
            tempo_horas: recurso.pca_tempo_horas,
            posicao_stand: recurso.pca_posicao_stand,
            valor_usd: recurso.pca_valor_usd
          });
        }
        // GPU
        if (recurso.gpu_utilizado && recurso.gpu_valor_usd > 0) {
          totalRecursosUSD += recurso.gpu_valor_usd;
          recursosDetalhes.push({
            tipo: 'GPU (Ground Power Unit)',
            tempo_horas: recurso.gpu_tempo_horas,
            posicao_stand: recurso.gpu_posicao_stand,
            valor_usd: recurso.gpu_valor_usd
          });
        }
        // PBB
        if (recurso.pbb_utilizado && recurso.pbb_valor_usd > 0) {
          totalRecursosUSD += recurso.pbb_valor_usd;
          recursosDetalhes.push({
            tipo: 'PBB (Ponte de Embarque)',
            tempo_horas: recurso.pbb_tempo_horas,
            posicao_stand: recurso.pbb_posicao_stand,
            valor_usd: recurso.pbb_valor_usd
          });
        }
        // Check-in
        if (recurso.checkin_utilizado && recurso.checkin_valor_usd > 0) {
          totalRecursosUSD += recurso.checkin_valor_usd;
          recursosDetalhes.push({
            tipo: 'Balcão de Check-in',
            tempo_horas: recurso.checkin_tempo_horas,
            posicoes: recurso.checkin_posicoes,
            num_balcoes: recurso.checkin_num_balcoes,
            valor_usd: recurso.checkin_valor_usd
          });
        }

        // Bombeiros
        const bombeirosLabels = {
          bombeiros_derrame_pequeno: 'Limpeza Derrame Pequena',
          bombeiros_derrame_medio: 'Limpeza Derrame Média',
          bombeiros_derrame_grande: 'Limpeza Derrame Grande',
          bombeiros_resfriamento: 'Resfriamento Trem de Pouso',
          bombeiros_reabastecimento: 'Reabastecimento com Pax',
        };
        for (const [key, label] of Object.entries(bombeirosLabels)) {
          if (recurso[key] && Number(recurso[`${key}_valor_usd`]) > 0) {
            const val = Number(recurso[`${key}_valor_usd`]);
            totalRecursosUSD += val;
            recursosDetalhes.push({
              tipo: label,
              quantidade: Number(recurso[`${key}_qtd`]) || 1,
              valor_usd: val
            });
          }
        }
      }

      // Combustível (campos na tabela voo DEP)
      if (vooDep.combustivel_utilizado && vooDep.combustivel_valor_usd > 0) {
        totalRecursosUSD += vooDep.combustivel_valor_usd;
        recursosDetalhes.push({
          tipo: 'Combustível',
          tempo_horas: vooDep.combustivel_tempo_horas,
          litros: vooDep.combustivel_litros,
          tipo_combustivel: vooDep.combustivel_tipo,
          posicao_stand: vooDep.combustivel_posicao_stand,
          valor_usd: vooDep.combustivel_valor_usd
        });
      }

      results.tarifa_recursos_usd = parseFloat(totalRecursosUSD.toFixed(2));

      if (recursosDetalhes.length > 0) {
        results.detalhes_calculo.recursos = {
          itens: recursosDetalhes,
          total_usd: results.tarifa_recursos_usd,
          observacao: 'Recursos de solo utilizados durante a permanência da aeronave'
        };
      } else {
        results.detalhes_calculo.recursos = {
          itens: [],
          total_usd: 0,
          observacao: 'Nenhum recurso de solo registado para este voo'
        };
      }
    } catch (err) {
      console.warn('⚠️ Erro ao buscar recursos do voo:', err);
      results.detalhes_calculo.recursos = {
        erro: 'Não foi possível buscar recursos do voo',
        itens: [],
        total_usd: 0
      };
    }

    // ==================== TARIFA DE SERVIÇOS AEROPORTUÁRIOS ====================
    try {
      const servicosVoo = await ServicoVoo.filter({ voo_ligado_id: vooLigado.id });
      let totalServicosUSD = 0;
      const servicosDetalhes = [];

      if (servicosVoo && servicosVoo.length > 0) {
        servicosVoo.forEach(sv => {
          const val = Number(sv.valor_total_usd) || 0;
          if (val > 0) {
            totalServicosUSD += val;
            servicosDetalhes.push({
              tipo: sv.tipo_servico,
              quantidade: Number(sv.quantidade) || 0,
              unidade: sv.unidade || 'passageiro',
              valor_unitario_usd: Number(sv.valor_unitario_usd) || 0,
              valor_usd: val
            });
          }
        });
      }

      results.tarifa_servicos_usd = parseFloat(totalServicosUSD.toFixed(2));
      if (servicosDetalhes.length > 0) {
        results.detalhes_calculo.servicos = {
          itens: servicosDetalhes,
          total_usd: results.tarifa_servicos_usd,
          observacao: 'Serviços aeroportuários adicionais'
        };
      } else {
        results.detalhes_calculo.servicos = { itens: [], total_usd: 0 };
      }
    } catch (err) {
      console.warn('⚠️ Erro ao buscar serviços do voo:', err);
      results.detalhes_calculo.servicos = { itens: [], total_usd: 0 };
    }

    // ==================== ARREDONDAR E CALCULAR AOA PARA TODAS AS TARIFAS ====================
    results.tarifa_pouso_usd = parseFloat((results.tarifa_pouso_usd || 0).toFixed(2));
    results.tarifa_pouso = parseFloat((results.tarifa_pouso_usd * taxaCambio).toFixed(2));

    results.tarifa_permanencia_usd = parseFloat((results.tarifa_permanencia_usd || 0).toFixed(2));
    results.tarifa_permanencia = parseFloat((results.tarifa_permanencia_usd * taxaCambio).toFixed(2));

    results.tarifa_passageiros_usd = parseFloat((results.tarifa_passageiros_usd || 0).toFixed(2));
    results.tarifa_passageiros = parseFloat((results.tarifa_passageiros_usd * taxaCambio).toFixed(2));

    results.tarifa_carga_usd = parseFloat((results.tarifa_carga_usd || 0).toFixed(2));
    results.tarifa_carga = parseFloat((results.tarifa_carga_usd * taxaCambio).toFixed(2));
    
    results.outras_tarifas_usd = parseFloat((results.outras_tarifas_usd || 0).toFixed(2));
    results.outras_tarifas = parseFloat((results.outras_tarifas_usd * taxaCambio).toFixed(2));

    results.tarifa_recursos_usd = parseFloat((results.tarifa_recursos_usd || 0).toFixed(2));
    results.tarifa_recursos = parseFloat((results.tarifa_recursos_usd * taxaCambio).toFixed(2));

    results.tarifa_servicos_usd = parseFloat((results.tarifa_servicos_usd || 0).toFixed(2));
    results.tarifa_servicos = parseFloat((results.tarifa_servicos_usd * taxaCambio).toFixed(2));

    // ==================== CALCULAR SUBTOTAL (SEM IMPOSTOS) ====================
    const subtotalUSD = parseFloat((
      (results.tarifa_pouso_usd || 0) +
      (results.tarifa_permanencia_usd || 0) +
      (results.tarifa_passageiros_usd || 0) +
      (results.tarifa_carga_usd || 0) +
      (results.outras_tarifas_usd || 0) +
      (results.tarifa_recursos_usd || 0) +
      (results.tarifa_servicos_usd || 0)
    ).toFixed(2));

    const subtotalAOA = parseFloat((
      (results.tarifa_pouso || 0) +
      (results.tarifa_permanencia || 0) +
      (results.tarifa_passageiros || 0) +
      (results.tarifa_carga || 0) +
      (results.outras_tarifas || 0) +
      (results.tarifa_recursos || 0) +
      (results.tarifa_servicos || 0)
    ).toFixed(2));

    // ==================== CALCULAR IMPOSTOS ====================
    let impostosDetalhes = [];
    let totalImpostosUSD = 0;
    let totalImpostosAOA = 0;

    if (impostos && impostos.length > 0) {
      const dataOperacao = new Date(vooDep.data_operacao);
      
      // Filtrar impostos ativos e aplicáveis
      const impostosAplicaveis = impostos.filter(imp => {
        if (imp.status !== 'ativo') return false;
        
        // Verificar se o imposto se aplica a este aeroporto
        if (imp.aeroporto_id && imp.aeroporto_id !== aeroportoOperacao.id) return false;
        
        // Verificar vigência
        const dataInicio = new Date(imp.data_inicio_vigencia);
        if (dataOperacao < dataInicio) return false;
        
        if (imp.data_fim_vigencia) {
          const dataFim = new Date(imp.data_fim_vigencia);
          if (dataOperacao > dataFim) return false;
        }
        
        return true;
      });

      // Calcular cada imposto (apenas percentagem sobre subtotal)
      impostosAplicaveis.forEach(imposto => {
        // Percentagem sobre o subtotal em USD, depois converter para AOA
        const percentagem = parseFloat(imposto.valor) || 0;
        const valorImpostoUSD = parseFloat(((subtotalUSD * percentagem) / 100).toFixed(2));
        const valorImpostoAOA = parseFloat((valorImpostoUSD * taxaCambio).toFixed(2));
        const formula = `${subtotalUSD.toFixed(2)} USD × ${percentagem}%`;

        totalImpostosUSD += valorImpostoUSD;
        totalImpostosAOA += valorImpostoAOA;

        impostosDetalhes.push({
          tipo: imposto.tipo,
          valor_configurado: percentagem,
          valor_usd: valorImpostoUSD,
          valor_aoa: valorImpostoAOA,
          formula: formula,
          descricao: imposto.descricao || ''
        });

      });
    }

    totalImpostosUSD = parseFloat(totalImpostosUSD.toFixed(2));
    totalImpostosAOA = parseFloat(totalImpostosAOA.toFixed(2));

    // ==================== CALCULAR TOTAIS FINAIS (COM IMPOSTOS) ====================
    results.total_tarifa_usd = parseFloat((subtotalUSD + totalImpostosUSD).toFixed(2));
    results.total_tarifa = parseFloat((subtotalAOA + totalImpostosAOA).toFixed(2));

    // Adicionar informações de impostos aos detalhes
    results.detalhes_calculo.impostos = impostosDetalhes;
    results.detalhes_calculo.subtotal_sem_impostos_usd = subtotalUSD;
    results.detalhes_calculo.subtotal_sem_impostos_aoa = subtotalAOA;
    results.detalhes_calculo.total_impostos_usd = totalImpostosUSD;
    results.detalhes_calculo.total_impostos_aoa = totalImpostosAOA;

    // Registar troca de registo nos detalhes
    if (vooLigado.registo_alterado) {
      results.detalhes_calculo.alteracao_registo = {
        registo_arr: vooArr.registo_aeronave,
        registo_dep: vooLigado.registo_dep,
        permanencia_estatistica: `${Math.ceil(tempoPermanenciaMinEstatistica / 60)}h`,
        estacionamento_faturacao: `${tempoPermanenciaHoras}h`,
        origem: vooLigado.estacionamento_origem
      };
    }

    return results;
  } catch (error) {
    console.error('❌ Erro no cálculo de tarifas:', error);
    
    // Extrair mensagem útil do erro
    let errorMessage = 'Erro desconhecido no cálculo de tarifas';
    if (typeof error === 'string') {
      errorMessage = error;
    } else if (error?.message) {
      errorMessage = error.message;
    } else if (error?.error) {
      errorMessage = error.error;
    }
    
    // Lançar erro com mensagem legível
    throw new Error(errorMessage);
  }
}

async function saveCalculation(results) {
  try {
    const calculoData = {
      voo_id: results.voo_id,
      aeroporto_id: results.aeroporto_id,
      data_calculo: results.data_calculo,
      tipo_tarifa: results.tipo_tarifa,
      mtow_kg: results.mtow_kg,
      taxa_cambio_usd_aoa: results.taxa_cambio_usd_aoa,
      tarifa_pouso_usd: results.tarifa_pouso_usd,
      tarifa_pouso: results.tarifa_pouso,
      tarifa_permanencia_usd: results.tarifa_permanencia_usd,
      tarifa_permanencia: results.tarifa_permanencia,
      tarifa_passageiros_usd: results.tarifa_passageiros_usd,
      tarifa_passageiros: results.tarifa_passageiros,
      tarifa_carga_usd: results.tarifa_carga_usd,
      tarifa_carga: results.tarifa_carga,
      outras_tarifas_usd: results.outras_tarifas_usd,
      outras_tarifas: results.outras_tarifas,
      tarifa_recursos_usd: results.tarifa_recursos_usd,
      tarifa_recursos: results.tarifa_recursos,
      total_tarifa_usd: results.total_tarifa_usd,
      total_tarifa: results.total_tarifa,
      periodo_noturno: results.periodo_noturno,
      tempo_permanencia_horas: results.tempo_permanencia_horas,
      detalhes_calculo: results.detalhes_calculo
    };

    await CalculoTarifa.create(calculoData);
  } catch (error) {
    console.error('❌ Erro ao salvar cálculo de tarifas:', error);
    throw error;
  }
}

export { saveCalculation };