import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Calculator, DollarSign, Clock, Users, Package } from 'lucide-react';
import { TarifaPouso } from '@/entities/TarifaPouso';
import { TarifaPermanencia } from '@/entities/TarifaPermanencia';
import { OutraTarifa } from '@/entities/OutraTarifa';
import { RegistoAeronave } from '@/entities/RegistoAeronave';
import { Aeroporto } from '@/entities/Aeroporto';

export default function TarifasCalculator({ 
  vooData, 
  aeronaveRegisto, 
  aeroporto, 
  vooLigado = null, 
  onTarifasCalculated 
}) {
  const [tarifas, setTarifas] = useState({
    pouso: 0,
    permanencia: 0,
    passageiros: 0,
    carga: 0,
    outras: 0,
    total: 0
  });
  const [detalhesCalculo, setDetalhesCalculo] = useState({});
  const [aeronave, setAeronave] = useState(null);
  const [aeroportoInfo, setAeroportoInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (vooData && aeronaveRegisto && aeroporto) {
      calcularTarifas();
    }
  }, [vooData, aeronaveRegisto, aeroporto, vooLigado]);

  const calcularTarifas = async () => {
    setIsLoading(true);
    try {
      // Carregar dados necessários
      const [
        aeronavesData,
        aeroportosData,
        tarifasPousoData,
        tarifasPermanenciaData,
        outrasTarifasData
      ] = await Promise.all([
        RegistoAeronave.list(),
        Aeroporto.list(),
        TarifaPouso.list(),
        TarifaPermanencia.list(),
        OutraTarifa.list()
      ]);

      const aeronaveInfo = aeronavesData.find(a => a.registo === aeronaveRegisto);
      const aeroportoInfo = aeroportosData.find(a => a.codigo_icao === aeroporto);

      if (!aeronaveInfo || !aeroportoInfo) {
        console.error('Dados da aeronave ou aeroporto não encontrados');
        return;
      }

      setAeronave(aeronaveInfo);
      setAeroportoInfo(aeroportoInfo);

      const mtow = aeronaveInfo.mtow_kg || 0;
      const categoriaAeroporto = aeroportoInfo.categoria;

      // 1. Calcular Tarifa de Pouso
      const tarifaPouso = calcularTarifaPouso(
        mtow, 
        categoriaAeroporto, 
        vooData.tipo_movimento,
        tarifasPousoData
      );

      // 2. Calcular Tarifa de Permanência (se voo ligado)
      const tarifaPermanencia = vooLigado ? 
        calcularTarifaPermanencia(mtow, categoriaAeroporto, vooLigado, tarifasPermanenciaData) : 
        0;

      // 3. Calcular Tarifas de Passageiros
      const tarifaPassageiros = calcularTarifaPassageiros(
        vooData,
        categoriaAeroporto,
        outrasTarifasData
      );

      // 4. Calcular Tarifa de Carga
      const tarifaCarga = calcularTarifaCarga(
        vooData.carga_kg || 0,
        categoriaAeroporto,
        outrasTarifasData
      );

      // 5. Outras tarifas fixas
      const outrasTarifas = calcularOutrasTarifas(
        vooData,
        categoriaAeroporto,
        outrasTarifasData
      );

      const novasTarifas = {
        pouso: tarifaPouso.valor,
        permanencia: tarifaPermanencia.valor,
        passageiros: tarifaPassageiros.valor,
        carga: tarifaCarga.valor,
        outras: outrasTarifas.valor,
        total: tarifaPouso.valor + tarifaPermanencia.valor + tarifaPassageiros.valor + tarifaCarga.valor + outrasTarifas.valor
      };

      const detalhes = {
        pouso: tarifaPouso.detalhes,
        permanencia: tarifaPermanencia.detalhes,
        passageiros: tarifaPassageiros.detalhes,
        carga: tarifaCarga.detalhes,
        outras: outrasTarifas.detalhes,
        aeronave: aeronaveInfo,
        aeroporto: aeroportoInfo
      };

      setTarifas(novasTarifas);
      setDetalhesCalculo(detalhes);

      // Notificar o componente pai
      if (onTarifasCalculated) {
        onTarifasCalculated(novasTarifas, detalhes);
      }

    } catch (error) {
      console.error('Erro ao calcular tarifas:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calcularTarifaPouso = (mtow, categoria, tipoMovimento, tarifasData) => {
    if (tipoMovimento !== 'ARR') {
      return { valor: 0, detalhes: 'Não aplicável para partidas' };
    }

    const tarifaAplicavel = tarifasData.find(t => 
      t.categoria_aeroporto === categoria &&
      t.status === 'ativa' &&
      mtow >= t.faixa_min &&
      mtow <= t.faixa_max
    );

    if (!tarifaAplicavel) {
      return { valor: 0, detalhes: 'Tarifa não encontrada para esta faixa de peso' };
    }

    // Determinar se é voo doméstico ou internacional
    const isDomestico = vooData.companhia_aerea?.startsWith('DT') || // TAAG
                       (vooData.aeroporto_origem_destino?.startsWith('FN') && 
                        vooData.aeroporto_operacao?.startsWith('FN'));

    const valor = isDomestico ? tarifaAplicavel.tarifa_domestica : tarifaAplicavel.tarifa_internacional;

    return {
      valor,
      detalhes: {
        faixa: `${tarifaAplicavel.faixa_min}kg - ${tarifaAplicavel.faixa_max}kg`,
        tipo: isDomestico ? 'Doméstico' : 'Internacional',
        mtow: `${mtow}kg`
      }
    };
  };

  const calcularTarifaPermanencia = (mtow, categoria, vooLigado, tarifasData) => {
    const tarifaAplicavel = tarifasData.find(t => 
      t.categoria_aeroporto === categoria &&
      t.status === 'ativa' &&
      mtow >= t.faixa_min &&
      mtow <= t.faixa_max
    );

    if (!tarifaAplicavel) {
      return { valor: 0, detalhes: 'Tarifa não encontrada' };
    }

    const tempoHoras = vooLigado.tempo_permanencia_min / 60;
    let valor = 0;

    if (tempoHoras <= 1) {
      valor = tarifaAplicavel.primeira_hora;
    } else if (tempoHoras <= 24) {
      valor = tarifaAplicavel.primeira_hora + 
              (Math.ceil(tempoHoras - 1) * tarifaAplicavel.hora_adicional);
    } else {
      const dias = Math.floor(tempoHoras / 24);
      const horasRestantes = tempoHoras % 24;
      valor = (dias * tarifaAplicavel.diaria) + 
              (horasRestantes > 0 ? tarifaAplicavel.primeira_hora : 0);
    }

    // Acréscimo noturno (22h às 6h)
    const isNoturno = vooLigado.periodo_noturno;
    if (isNoturno && tarifaAplicavel.noturno) {
      valor += tarifaAplicavel.noturno;
    }

    return {
      valor,
      detalhes: {
        tempo: `${tempoHoras.toFixed(1)}h`,
        noturno: isNoturno,
        faixa: `${tarifaAplicavel.faixa_min}kg - ${tarifaAplicavel.faixa_max}kg`
      }
    };
  };

  const calcularTarifaPassageiros = (vooData, categoria, outrasTarifasData) => {
    const tarifas = outrasTarifasData.filter(t => 
      t.categoria_aeroporto === categoria &&
      t.status === 'ativa' &&
      t.unidade === 'passageiro'
    );

    let valor = 0;
    const detalhes = {};

    // Embarque
    const tarifaEmbarque = tarifas.find(t => t.tipo === 'embarque');
    if (tarifaEmbarque && vooData.passageiros_local) {
      const valorEmbarque = vooData.passageiros_local * tarifaEmbarque.valor;
      valor += valorEmbarque;
      detalhes.embarque = `${vooData.passageiros_local} × ${tarifaEmbarque.valor} = ${valorEmbarque}`;
    }

    // Trânsito Transbordo
    const tarifaTransbordo = tarifas.find(t => t.tipo === 'transito_transbordo');
    if (tarifaTransbordo && vooData.passageiros_transito_transbordo) {
      const valorTransbordo = vooData.passageiros_transito_transbordo * tarifaTransbordo.valor;
      valor += valorTransbordo;
      detalhes.transbordo = `${vooData.passageiros_transito_transbordo} × ${tarifaTransbordo.valor} = ${valorTransbordo}`;
    }

    // Trânsito Direto
    const tarifaDireto = tarifas.find(t => t.tipo === 'transito_direto');
    if (tarifaDireto && vooData.passageiros_transito_direto) {
      const valorDireto = vooData.passageiros_transito_direto * tarifaDireto.valor;
      valor += valorDireto;
      detalhes.direto = `${vooData.passageiros_transito_direto} × ${tarifaDireto.valor} = ${valorDireto}`;
    }

    return { valor, detalhes };
  };

  const calcularTarifaCarga = (cargaKg, categoria, outrasTarifasData) => {
    const tarifaCarga = outrasTarifasData.find(t => 
      t.categoria_aeroporto === categoria &&
      t.status === 'ativa' &&
      t.tipo === 'carga' &&
      t.unidade === 'tonelada'
    );

    if (!tarifaCarga || !cargaKg) {
      return { valor: 0, detalhes: 'Sem carga ou tarifa não aplicável' };
    }

    const toneladas = cargaKg / 1000;
    const valor = toneladas * tarifaCarga.valor;

    return {
      valor,
      detalhes: {
        peso: `${cargaKg}kg (${toneladas.toFixed(2)}t)`,
        tarifa: `${tarifaCarga.valor}/t`,
        calculo: `${toneladas.toFixed(2)} × ${tarifaCarga.valor} = ${valor}`
      }
    };
  };

  const calcularOutrasTarifas = (vooData, categoria, outrasTarifasData) => {
    const tarifasFixas = outrasTarifasData.filter(t => 
      t.categoria_aeroporto === categoria &&
      t.status === 'ativa' &&
      (t.unidade === 'voo' || t.unidade === 'fixa')
    );

    let valor = 0;
    const detalhes = {};

    tarifasFixas.forEach(tarifa => {
      valor += tarifa.valor;
      detalhes[tarifa.tipo] = tarifa.valor;
    });

    return { valor, detalhes };
  };

  if (isLoading) {
    return (
      <Card className="border-orange-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-700">
            <Calculator className="h-5 w-5" />
            A calcular tarifas...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-green-200 bg-green-50/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-green-700">
          <Calculator className="h-5 w-5" />
          Cálculo de Tarifas Aeroportuárias
        </CardTitle>
        {aeronave && aeroportoInfo && (
          <div className="text-sm text-green-600">
            {aeronave.registo} • MTOW: {aeronave.mtow_kg}kg • {aeroportoInfo.nome} ({aeroportoInfo.categoria})
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tarifa de Pouso */}
        <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-blue-600" />
            <span className="font-medium">Tarifa de Pouso</span>
            {detalhesCalculo.pouso?.tipo && (
              <Badge variant="outline" className="text-xs">
                {detalhesCalculo.pouso.tipo}
              </Badge>
            )}
          </div>
          <span className="font-bold text-blue-700">
            {new Intl.NumberFormat('pt-AO').format(tarifas.pouso)} Kz
          </span>
        </div>

        {/* Tarifa de Permanência */}
        {tarifas.permanencia > 0 && (
          <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-purple-600" />
              <span className="font-medium">Tarifa de Permanência</span>
              {detalhesCalculo.permanencia?.tempo && (
                <Badge variant="outline" className="text-xs">
                  {detalhesCalculo.permanencia.tempo}
                </Badge>
              )}
            </div>
            <span className="font-bold text-purple-700">
              {new Intl.NumberFormat('pt-AO').format(tarifas.permanencia)} Kz
            </span>
          </div>
        )}

        {/* Tarifas de Passageiros */}
        {tarifas.passageiros > 0 && (
          <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-green-600" />
              <span className="font-medium">Tarifas de Passageiros</span>
            </div>
            <span className="font-bold text-green-700">
              {new Intl.NumberFormat('pt-AO').format(tarifas.passageiros)} Kz
            </span>
          </div>
        )}

        {/* Tarifa de Carga */}
        {tarifas.carga > 0 && (
          <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-orange-600" />
              <span className="font-medium">Tarifa de Carga</span>
              {detalhesCalculo.carga?.peso && (
                <Badge variant="outline" className="text-xs">
                  {detalhesCalculo.carga.peso}
                </Badge>
              )}
            </div>
            <span className="font-bold text-orange-700">
              {new Intl.NumberFormat('pt-AO').format(tarifas.carga)} Kz
            </span>
          </div>
        )}

        <Separator />

        {/* Total */}
        <div className="flex items-center justify-between p-4 bg-slate-100 rounded-lg border-2 border-slate-200">
          <span className="text-lg font-bold text-slate-800">Total das Tarifas</span>
          <span className="text-xl font-bold text-slate-900">
            {new Intl.NumberFormat('pt-AO').format(tarifas.total)} Kz
          </span>
        </div>
      </CardContent>
    </Card>
  );
}