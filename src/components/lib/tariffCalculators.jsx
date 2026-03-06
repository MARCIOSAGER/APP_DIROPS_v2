import { tariffCache } from './tariffCache';

/**
 * Calcula tarifa de pouso com índices em cache
 */
export function calculateTarifaPouso(
  mtow_kg,
  mtow_tonnes_rounded,
  categoria_aeroporto,
  tarifasPouso,
  isInternational
) {
  const index = tariffCache.buildTarifaPosusoIndex(tarifasPouso);
  const categoryTarifas = index[categoria_aeroporto] || [];

  const tarifaConfig = categoryTarifas.find(
    t => mtow_kg >= t.faixa_min && mtow_kg <= t.faixa_max
  );

  if (!tarifaConfig) {
    return { usd: 0, config: null };
  }

  const tarifaPorTonelada = isInternational
    ? tarifaConfig.tarifa_internacional
    : tarifaConfig.tarifa_domestica;

  return {
    usd: parseFloat((tarifaPorTonelada * mtow_tonnes_rounded).toFixed(2)),
    config: tarifaConfig
  };
}

/**
 * Calcula tarifa de permanência com validações otimizadas
 */
export function calculateTarifaPermanencia(
  tempoPermanenciaHoras,
  mtow_tonnes_rounded,
  categoria_aeroporto,
  tarifasPermanencia,
  aeronaveNoHangar
) {
  if (aeronaveNoHangar) {
    return {
      usd: 0,
      type: 'hangar',
      details: { tempoPermanencia: `${tempoPermanenciaHoras}h` }
    };
  }

  if (tempoPermanenciaHoras <= 2) {
    return {
      usd: 0,
      type: 'exempt_short',
      details: { tempoPermanencia: `${tempoPermanenciaHoras}h`, horasIsentas: tempoPermanenciaHoras }
    };
  }

  const index = tariffCache.buildTarifaPermanenciaIndex(tarifasPermanencia);
  const tarifaBase = index[categoria_aeroporto];

  if (!tarifaBase) {
    return { usd: 0, error: 'Tarifa não encontrada' };
  }

  const tarifaBasePorTonneHora = tarifaBase.tarifa_usd_por_tonelada_hora;
  const horasCobradas = tempoPermanenciaHoras - 2;

  let usd;
  let details;

  if (horasCobradas <= 4) {
    usd = parseFloat(
      (tarifaBasePorTonneHora * mtow_tonnes_rounded * horasCobradas).toFixed(2)
    );
    details = {
      type: 'base',
      tarifaBase: tarifaBasePorTonneHora,
      mtowTonnes: mtow_tonnes_rounded,
      horasCobradas,
      horasIsentas: 2
    };
  } else {
    const horasAlem6 = horasCobradas - 4;
    usd = parseFloat(
      (
        tarifaBasePorTonneHora * mtow_tonnes_rounded * 4 +
        tarifaBasePorTonneHora * 1.5 * mtow_tonnes_rounded * horasAlem6
      ).toFixed(2)
    );
    details = {
      type: 'sobretaxa',
      tarifaBase: tarifaBasePorTonneHora,
      mtowTonnes: mtow_tonnes_rounded,
      horasBase: 4,
      horasAlem6,
      horasIsentas: 2
    };
  }

  return { usd, details };
}

/**
 * Calcula tarifa de passageiros
 */
export function calculateTarifaPassageiros(
  vooDep,
  vooArr,
  categoria_aeroporto,
  outrasTarifas,
  tipoOperacaoEnum,
  tipoOperacao
) {
  const totalPassageirosEmbarque = vooDep.passageiros_local || 0;
  const tiposVooIsentos = ['Carga', 'Militar', 'Humanitário', 'Oficial', 'Técnico'];
  const isVooIsentoPassageiros = tiposVooIsentos.includes(vooDep.tipo_voo);

  if (totalPassageirosEmbarque === 0 || isVooIsentoPassageiros) {
    return {
      usd: 0,
      isExempt: true,
      reason: isVooIsentoPassageiros ? 'Tipo de voo isento' : 'Sem passageiros'
    };
  }

  const index = tariffCache.buildOutrasTarifasIndex(outrasTarifas);
  const indexKey = `embarque:${categoria_aeroporto}`;
  const candidates = index[indexKey] || [];

  const tarifaConfig = candidates.find(
    t => t.tipo_operacao === 'ambos' || t.tipo_operacao === tipoOperacaoEnum
  );

  if (!tarifaConfig) {
    return { usd: 0, error: 'Tarifa não encontrada' };
  }

  return {
    usd: parseFloat((tarifaConfig.valor * totalPassageirosEmbarque).toFixed(2)),
    config: tarifaConfig,
    passageiros: totalPassageirosEmbarque
  };
}

/**
 * Calcula tarifa de carga
 */
export function calculateTarifaCarga(
  vooDep,
  vooArr,
  categoria_aeroporto,
  outrasTarifas,
  tipoOperacaoEnum
) {
  const cargaDep = vooDep.carga_kg || 0;
  const cargaArr = vooArr.carga_kg || 0;

  if (cargaDep === 0) {
    return { usd: 0, isExempt: true };
  }

  const index = tariffCache.buildOutrasTarifasIndex(outrasTarifas);
  const indexKey = `carga:${categoria_aeroporto}`;
  const candidates = index[indexKey] || [];

  const tarifaConfig = candidates.find(
    t => t.tipo_operacao === 'ambos' || t.tipo_operacao === tipoOperacaoEnum
  );

  if (!tarifaConfig) {
    return { usd: 0, error: 'Tarifa não encontrada' };
  }

  const totalCargaTon = cargaDep / 1000;
  return {
    usd: parseFloat((totalCargaTon * tarifaConfig.valor).toFixed(2)),
    config: tarifaConfig,
    carga_kg: cargaDep,
    carga_ton: parseFloat(totalCargaTon.toFixed(3))
  };
}

/**
 * Calcula tarifas de iluminação e segurança
 */
export function calculateOutrasTarifas(
  results,
  categoria_aeroporto,
  outrasTarifas,
  tipoOperacaoEnum,
  periodoNoturno,
  requerIluminacaoExtra,
  vooDep,
  vooArr
) {
  let totalOutras = 0;
  const outras = [];

  // Iluminação
  if (periodoNoturno || requerIluminacaoExtra) {
    const index = tariffCache.buildOutrasTarifasIndex(outrasTarifas);
    const indexKey = `iluminacao:${categoria_aeroporto}`;
    const candidates = index[indexKey] || [];

    const tarifaIluminacao = candidates.find(
      t => t.tipo_operacao === 'ambos' || t.tipo_operacao === tipoOperacaoEnum
    );

    if (tarifaIluminacao) {
      totalOutras += tarifaIluminacao.valor;
      outras.push({
        tipo: 'iluminacao',
        valor: tarifaIluminacao.valor
      });
    }
  }

  // Segurança
  const index = tariffCache.buildOutrasTarifasIndex(outrasTarifas);
  const indexKey = `seguranca:${categoria_aeroporto}`;
  const candidates = index[indexKey] || [];

  const tarifaSeguranca = candidates.find(
    t => t.tipo_operacao === 'ambos' || t.tipo_operacao === tipoOperacaoEnum
  );

  if (tarifaSeguranca) {
    totalOutras += tarifaSeguranca.valor;
    outras.push({
      tipo: 'seguranca',
      valor: tarifaSeguranca.valor
    });
  }

  // Trânsito
  const passageirosTransitoTransbordo = vooDep.passageiros_transito_transbordo || 0;
  if (passageirosTransitoTransbordo > 0) {
    const indexKeyTransito = `transito_transbordo:${categoria_aeroporto}`;
    const candidatesTransito = index[indexKeyTransito] || [];

    const tarifaTransito = candidatesTransito.find(
      t => t.tipo_operacao === 'ambos' || t.tipo_operacao === tipoOperacaoEnum
    );

    if (tarifaTransito) {
      const valor = tarifaTransito.valor * passageirosTransitoTransbordo;
      totalOutras += valor;
      outras.push({
        tipo: 'transito_transbordo',
        valor,
        passageiros: passageirosTransitoTransbordo
      });
    }
  }

  const passageirosTransitoDireto = vooDep.passageiros_transito_direto || 0;
  if (passageirosTransitoDireto > 0) {
    const indexKeyTransitoDireto = `transito_direto:${categoria_aeroporto}`;
    const candidatesTransitoDireto = index[indexKeyTransitoDireto] || [];

    const tarifaTransitoDireto = candidatesTransitoDireto.find(
      t => t.tipo_operacao === 'ambos' || t.tipo_operacao === tipoOperacaoEnum
    );

    if (tarifaTransitoDireto) {
      const valor = tarifaTransitoDireto.valor * passageirosTransitoDireto;
      totalOutras += valor;
      outras.push({
        tipo: 'transito_direto',
        valor,
        passageiros: passageirosTransitoDireto
      });
    }
  }

  return {
    usd: parseFloat(totalOutras.toFixed(2)),
    detalhes: outras
  };
}

/**
 * Calcula impostos com validação de datas otimizada
 */
export function calculateTaxes(impostos, subtotalUSD, taxaCambio, vooDep, aeroportoOperacao) {
  let totalImpostosUSD = 0;
  let totalImpostosAOA = 0;
  const detalhes = [];

  if (!impostos || impostos.length === 0) {
    return { usd: 0, aoa: 0, detalhes };
  }

  const dataOperacao = new Date(vooDep.data_operacao);

  impostos.forEach(imposto => {
    if (imposto.status !== 'ativo') return;

    // Verificar aeroporto
    if (imposto.aeroporto_id && imposto.aeroporto_id !== aeroportoOperacao.id) return;

    // Verificar vigência
    const dataInicio = new Date(imposto.data_inicio_vigencia);
    if (dataOperacao < dataInicio) return;

    if (imposto.data_fim_vigencia) {
      const dataFim = new Date(imposto.data_fim_vigencia);
      if (dataOperacao > dataFim) return;
    }

    const percentagem = parseFloat(imposto.valor) || 0;
    const valorUSD = parseFloat(((subtotalUSD * percentagem) / 100).toFixed(2));
    const valorAOA = parseFloat((valorUSD * taxaCambio).toFixed(2));

    totalImpostosUSD += valorUSD;
    totalImpostosAOA += valorAOA;

    detalhes.push({
      tipo: imposto.tipo,
      percentagem,
      valor_usd: valorUSD,
      valor_aoa: valorAOA
    });
  });

  return {
    usd: parseFloat(totalImpostosUSD.toFixed(2)),
    aoa: parseFloat(totalImpostosAOA.toFixed(2)),
    detalhes
  };
}

/**
 * Converte USD para AOA com precisão
 */
export function convertCurrency(valueUSD, exchangeRate) {
  return parseFloat((valueUSD * exchangeRate).toFixed(2));
}