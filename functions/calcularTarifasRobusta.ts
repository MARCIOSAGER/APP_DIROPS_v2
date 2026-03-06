import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const normalizeRegistro = (registro) => {
  if (!registro || typeof registro !== 'string') return '';
  return registro.trim().toUpperCase().replace(/[\s\-_.]/g, '');
};

const roundUpToNearestTonne = (kg) => {
  return Math.ceil(kg / 1000);
};

const isNightOperation = (dataOperacao, horarioReal) => {
  if (!dataOperacao || !horarioReal) return false;
  const [hour] = horarioReal.split(':').map(Number);
  return hour >= 18 || hour < 6;
};

const isExemptFlight = (vooArr, vooDep) => {
  const exemptTypes = ['Militar', 'Humanitário', 'Oficial'];
  const arrIsExempt = vooArr && exemptTypes.includes(vooArr.tipo_voo);
  const depIsExempt = vooDep && exemptTypes.includes(vooDep.tipo_voo);
  return arrIsExempt || depIsExempt;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let payload = {};
    try {
      const clonedReq = req.clone();
      payload = await clonedReq.json();
    } catch (e) {
      console.log('⚠️ Sem payload JSON');
    }

    const { vooLigado, vooArr, vooDep, aeroportoOperacao, registos, impostos = [] } = payload;

    if (!vooLigado || !vooArr || !vooDep || !aeroportoOperacao || !registos) {
      return Response.json({ 
        error: 'Parâmetros obrigatórios: vooLigado, vooArr, vooDep, aeroportoOperacao, registos' 
      }, { status: 400 });
    }

    // Verificar se é voo isento
    if (isExemptFlight(vooArr, vooDep)) {
      console.log(`✅ VOO ISENTO: ${vooDep.numero_voo} (${vooDep.tipo_voo})`);
      return Response.json({
        voo_id: vooDep.id,
        voo_ligado_id: vooLigado.id,
        aeroporto_id: aeroportoOperacao.id,
        data_calculo: new Date().toISOString(),
        tipo_tarifa: 'Voo Isento de Tarifas',
        mtow_kg: 0,
        taxa_cambio_usd_aoa: 890,
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
        total_tarifa_usd: 0,
        total_tarifa: 0,
        total_impostos_usd: 0,
        total_impostos_aoa: 0,
        total_tarifa_com_impostos_usd: 0,
        total_tarifa_com_impostos_aoa: 0,
        periodo_noturno: false,
        tempo_permanencia_horas: 0,
        detalhes_calculo: {
          isento: true,
          motivo_isencao: `Voo do tipo isento - ARR: ${vooArr.tipo_voo}, DEP: ${vooDep.tipo_voo}`,
          observacao: "Voos Militares, Oficiais e Humanitário são isentos de todas as tarifas aeroportuárias"
        }
      });
    }

    // Buscar registo de aeronave
    const registoNormalizado = normalizeRegistro(vooArr.registo_aeronave);
    const registoAeronave = registos.find(r => normalizeRegistro(r.registo) === registoNormalizado);

    if (!registoAeronave || !registoAeronave.mtow_kg) {
      return Response.json({ 
        error: `Registo não encontrado para voo ${vooArr.numero_voo}: ${vooArr.registo_aeronave}`
      }, { status: 400 });
    }

    const mtow_kg = registoAeronave.mtow_kg;
    const mtow_tonnes_rounded = roundUpToNearestTonne(mtow_kg);
    const taxaCambio = 890;

    // Cálculo simplificado para o relatório (sem todas as tarifas complexas)
    const tempoMinutos = vooLigado.tempo_permanencia_min || 0;
    const tempoHoras = Math.ceil(tempoMinutos / 60);

    // Tarifa de pouso simples
    const tarifaPousoPorTonelada = 100; // Valor base simplificado
    const tarifaPousoPorVoo = tarifaPousoPorTonelada * mtow_tonnes_rounded;

    // Tarifa de permanência
    let tarifaPermanencia = 0;
    if (tempoHoras > 2) {
      const horasCobradas = tempoHoras - 2;
      tarifaPermanencia = 50 * mtow_tonnes_rounded * horasCobradas;
    }

    const subtotalUSD = tarifaPousoPorVoo + tarifaPermanencia;
    const subtotalAOA = subtotalUSD * taxaCambio;

    // Calcular impostos
    let totalImpostosUSD = 0;
    let totalImpostosAOA = 0;
    if (impostos && impostos.length > 0) {
      const dataOperacao = new Date(vooDep.data_operacao);
      const impostosAplicaveis = impostos.filter(imp => {
        if (imp.status !== 'ativo') return false;
        if (imp.aeroporto_id && imp.aeroporto_id !== aeroportoOperacao.id) return false;
        const dataInicio = new Date(imp.data_inicio_vigencia);
        if (dataOperacao < dataInicio) return false;
        if (imp.data_fim_vigencia) {
          const dataFim = new Date(imp.data_fim_vigencia);
          if (dataOperacao > dataFim) return false;
        }
        return true;
      });

      impostosAplicaveis.forEach(imposto => {
        const percentagem = parseFloat(imposto.valor) || 0;
        const valorImpostoUSD = parseFloat(((subtotalUSD * percentagem) / 100).toFixed(2));
        const valorImpostoAOA = parseFloat((valorImpostoUSD * taxaCambio).toFixed(2));
        totalImpostosUSD += valorImpostoUSD;
        totalImpostosAOA += valorImpostoAOA;
      });
    }

    totalImpostosUSD = parseFloat(totalImpostosUSD.toFixed(2));
    totalImpostosAOA = parseFloat(totalImpostosAOA.toFixed(2));

    const result = {
      voo_id: vooDep.id,
      voo_ligado_id: vooLigado.id,
      aeroporto_id: aeroportoOperacao.id,
      data_calculo: new Date().toISOString(),
      tipo_tarifa: 'Tarifas Aeroportuárias',
      mtow_kg: mtow_kg,
      taxa_cambio_usd_aoa: taxaCambio,
      tarifa_pouso_usd: parseFloat(tarifaPousoPorVoo.toFixed(2)),
      tarifa_pouso: parseFloat((tarifaPousoPorVoo * taxaCambio).toFixed(2)),
      tarifa_permanencia_usd: parseFloat(tarifaPermanencia.toFixed(2)),
      tarifa_permanencia: parseFloat((tarifaPermanencia * taxaCambio).toFixed(2)),
      tarifa_passageiros_usd: 0,
      tarifa_passageiros: 0,
      tarifa_carga_usd: 0,
      tarifa_carga: 0,
      outras_tarifas_usd: 0,
      outras_tarifas: 0,
      total_tarifa_usd: parseFloat((subtotalUSD).toFixed(2)),
      total_tarifa: parseFloat((subtotalAOA).toFixed(2)),
      total_impostos_usd: totalImpostosUSD,
      total_impostos_aoa: totalImpostosAOA,
      total_tarifa_com_impostos_usd: parseFloat((subtotalUSD + totalImpostosUSD).toFixed(2)),
      total_tarifa_com_impostos_aoa: parseFloat((subtotalAOA + totalImpostosAOA).toFixed(2)),
      periodo_noturno: false,
      tempo_permanencia_horas: tempoHoras,
      detalhes_calculo: {
        mtow_kg: mtow_kg,
        mtow_tonnes: mtow_tonnes_rounded,
        tempo_permanencia_horas: tempoHoras
      }
    };

    console.log(`✅ Cálculo robusta completo: ${vooDep.numero_voo} → $${result.total_tarifa_com_impostos_usd} USD`);

    // Retornar APENAS os dados necessários (evitar estruturas circulares)
    return Response.json({
      voo_id: result.voo_id,
      voo_ligado_id: result.voo_ligado_id,
      aeroporto_id: result.aeroporto_id,
      data_calculo: result.data_calculo,
      tipo_tarifa: result.tipo_tarifa,
      mtow_kg: result.mtow_kg,
      taxa_cambio_usd_aoa: result.taxa_cambio_usd_aoa,
      tarifa_pouso_usd: result.tarifa_pouso_usd,
      tarifa_pouso: result.tarifa_pouso,
      tarifa_permanencia_usd: result.tarifa_permanencia_usd,
      tarifa_permanencia: result.tarifa_permanencia,
      tarifa_passageiros_usd: result.tarifa_passageiros_usd,
      tarifa_passageiros: result.tarifa_passageiros,
      tarifa_carga_usd: result.tarifa_carga_usd,
      tarifa_carga: result.tarifa_carga,
      outras_tarifas_usd: result.outras_tarifas_usd,
      outras_tarifas: result.outras_tarifas,
      total_tarifa_usd: result.total_tarifa_usd,
      total_tarifa: result.total_tarifa,
      total_impostos_usd: result.total_impostos_usd,
      total_impostos_aoa: result.total_impostos_aoa,
      total_tarifa_com_impostos_usd: result.total_tarifa_com_impostos_usd,
      total_tarifa_com_impostos_aoa: result.total_tarifa_com_impostos_aoa,
      periodo_noturno: result.periodo_noturno,
      tempo_permanencia_horas: result.tempo_permanencia_horas,
      detalhes_calculo: result.detalhes_calculo
    });
  } catch (error) {
    console.error('❌ Erro:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});