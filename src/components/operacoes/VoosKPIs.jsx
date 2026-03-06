import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Plane, Users, Package, CheckCircle, XCircle, MapPin } from 'lucide-react';

export default function VoosKPIs({ voos, aeroportos }) {
  // Calcular KPIs básicos
  const totalVoos = voos.length;
  const totalChegadas = voos.filter(v => v.tipo_movimento === 'ARR').length;
  const totalPartidas = voos.filter(v => v.tipo_movimento === 'DEP').length;
  const voosRealizados = voos.filter(v => v.status === 'Realizado').length;
  const voosCancelados = voos.filter(v => v.status === 'Cancelado').length;
  
  const totalPassageiros = voos.reduce((sum, v) => sum + (v.passageiros_total || 0), 0);
  const totalCarga = voos.reduce((sum, v) => sum + (v.carga_kg || 0), 0);

  // Calcular Top 10 Aeroportos por Volume de Voo (ARR + DEP)
  const aeroportoMovimentos = {};
  
  voos.forEach(voo => {
    const aeroportoCodigo = voo.aeroporto_operacao;
    if (!aeroportoCodigo) return;
    
    if (!aeroportoMovimentos[aeroportoCodigo]) {
      aeroportoMovimentos[aeroportoCodigo] = {
        codigo: aeroportoCodigo,
        movimentos: 0,
        passageiros: 0,
        arr: 0,
        dep: 0,
        carga_arr: 0,
        carga_dep: 0
      };
    }
    
    aeroportoMovimentos[aeroportoCodigo].movimentos++;
    aeroportoMovimentos[aeroportoCodigo].passageiros += (voo.passageiros_total || 0);
    
    if (voo.tipo_movimento === 'ARR') {
      aeroportoMovimentos[aeroportoCodigo].arr++;
      aeroportoMovimentos[aeroportoCodigo].carga_arr += (voo.carga_kg || 0);
    } else {
      aeroportoMovimentos[aeroportoCodigo].dep++;
      aeroportoMovimentos[aeroportoCodigo].carga_dep += (voo.carga_kg || 0);
    }
  });

  // Ordenar e pegar top 10
  const top10Aeroportos = Object.values(aeroportoMovimentos)
    .sort((a, b) => b.movimentos - a.movimentos)
    .slice(0, 10)
    .map(aero => {
      const aeroportoInfo = aeroportos.find(a => a.codigo_icao === aero.codigo);
      return {
        ...aero,
        nome: aeroportoInfo?.nome || aero.codigo,
        cidade: aeroportoInfo?.cidade || ''
      };
    });

  const formatNumber = (value) => new Intl.NumberFormat('pt-AO').format(value || 0);

  const kpis = [
    {
      title: 'Total de Voos',
      value: totalVoos,
      icon: Plane,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Chegadas',
      value: totalChegadas,
      icon: Plane,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      rotation: 'rotate-[-45deg]'
    },
    {
      title: 'Partidas',
      value: totalPartidas,
      icon: Plane,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      rotation: 'rotate-45'
    },
    {
      title: 'Voos Realizados',
      value: voosRealizados,
      icon: CheckCircle,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50'
    },
    {
      title: 'Voos Cancelados',
      value: voosCancelados,
      icon: XCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-50'
    },
    {
      title: 'Total de Passageiros',
      value: formatNumber(totalPassageiros),
      icon: Users,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50'
    },
    {
      title: 'Carga Total',
      value: `${formatNumber(totalCarga)} kg`,
      icon: Package,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50'
    }
  ];

  return (
    <div className="space-y-6 mb-6">
      {/* KPIs Principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {kpis.map((kpi, index) => (
          <Card key={index} className="border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-xs font-medium text-slate-600 mb-1">{kpi.title}</p>
                  <p className="text-xl font-bold text-slate-900">{kpi.value}</p>
                </div>
                <div className={`${kpi.bgColor} ${kpi.color} p-2 rounded-lg`}>
                  <kpi.icon className={`w-5 h-5 ${kpi.rotation || ''}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Top 10 Aeroportos */}
      {top10Aeroportos.length > 0 && (
        <Card className="border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-5 h-5 text-slate-600" />
              <h3 className="text-lg font-semibold text-slate-900">Top 10 Aeroportos por Volume</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {top10Aeroportos.map((aero, index) => (
                <div key={aero.codigo} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-slate-400">#{index + 1}</span>
                        <span className="text-sm font-bold text-slate-900">{aero.codigo}</span>
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-2" title={aero.nome}>
                        {aero.nome}
                      </p>
                      {aero.cidade && (
                        <p className="text-xs text-slate-500 mt-1">{aero.cidade}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-2 mt-3 pt-3 border-t border-slate-200">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-600">Movimentos:</span>
                      <span className="text-sm font-bold text-slate-900">{aero.movimentos}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-green-600">ARR: {aero.arr}</span>
                      <span className="text-purple-600">DEP: {aero.dep}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-600">Passageiros:</span>
                      <span className="text-sm font-semibold text-indigo-600">
                        {formatNumber(aero.passageiros)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-green-600">ARR: {formatNumber(aero.carga_arr)} kg</span>
                      <span className="text-purple-600">DEP: {formatNumber(aero.carga_dep)} kg</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-600">Carga Total:</span>
                      <span className="text-sm font-semibold text-amber-600">
                        {formatNumber(aero.carga_arr + aero.carga_dep)} kg
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}