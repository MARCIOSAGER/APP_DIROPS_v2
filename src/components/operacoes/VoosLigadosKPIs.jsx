import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Timer, Link as LinkIcon, DollarSign, AlertCircle, ShieldCheck, Users, Package } from 'lucide-react';

export default function VoosLigadosKPIs({ voosLigados, voos, calculosTarifa }) {
  // Calcular KPIs
  const totalVoosLigados = voosLigados.length;

  const temposPermanencia = voosLigados
    .map(vl => vl.tempo_permanencia_min)
    .filter(t => t !== null && t !== undefined);
  const tempoMedioPermanencia = temposPermanencia.length > 0
    ? (temposPermanencia.reduce((sum, t) => sum + t, 0) / temposPermanencia.length) / 60
    : 0;

  // USAR A MESMA LÓGICA DO RODAPÉ: Iterar sobre voosLigados e somar as tarifas
  const totalTarifas = voosLigados.reduce((sum, vl) => {
    const depVoo = voos.find(v => v.id === vl.id_voo_dep);
    const calculo = calculosTarifa.find(ct => ct.voo_id === depVoo?.id);
    // Somar apenas voos com tarifa válida (não isentos)
    if (calculo && calculo.tipo_tarifa !== 'Voo Isento de Tarifas') {
      return sum + (calculo.total_tarifa || 0);
    }
    return sum;
  }, 0);

  // Voos isentos
  const voosIsentos = voosLigados.filter(vl => {
    const depVoo = voos.find(v => v.id === vl.id_voo_dep);
    const calculo = calculosTarifa.find(ct => ct.voo_id === depVoo?.id);
    return calculo && calculo.tipo_tarifa === 'Voo Isento de Tarifas';
  }).length;

  // Voos com cálculo (incluindo isentos)
  const voosComCalculo = voosLigados.filter(vl => {
    const depVoo = voos.find(v => v.id === vl.id_voo_dep);
    return depVoo && calculosTarifa.some(ct => ct.voo_id === depVoo.id);
  }).length;

  // Voos sem cálculo
  const voosSemCalculo = voosLigados.filter(vl => {
    const depVoo = voos.find(v => v.id === vl.id_voo_dep);
    return depVoo && !calculosTarifa.some(ct => ct.voo_id === depVoo.id);
  }).length;

  // Calcular médias de PAX e Carga
  const voosDepIds = voosLigados.map(vl => vl.id_voo_dep);
  const voosDep = voos.filter(v => voosDepIds.includes(v.id));
  
  const totalPax = voosDep.reduce((sum, v) => sum + (v.passageiros_total || 0), 0);
  const mediaPax = voosDep.length > 0 ? totalPax / voosDep.length : 0;

  const totalCarga = voosDep.reduce((sum, v) => sum + (v.carga_kg || 0), 0);
  const mediaCarga = voosDep.length > 0 ? totalCarga / voosDep.length : 0;

  const formatCurrency = (value) => 
    new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(value || 0);

  const kpis = [
    {
      title: 'Total de Voos Ligados',
      value: totalVoosLigados,
      icon: LinkIcon,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Tempo Médio de Permanência',
      value: `${tempoMedioPermanencia.toFixed(2)}h`,
      icon: Timer,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    },
    {
      title: 'Total de Tarifas',
      value: formatCurrency(totalTarifas),
      subtitle: `${voosComCalculo} voos calculados`,
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'Voos Sem Cálculo',
      value: voosSemCalculo,
      icon: AlertCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-50'
    },
    {
      title: 'Voos Isentos',
      value: voosIsentos,
      icon: ShieldCheck,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50'
    },
    {
      title: 'Média de Passageiros',
      value: mediaPax.toFixed(0),
      subtitle: 'por voo DEP',
      icon: Users,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      title: 'Média de Carga',
      value: `${mediaCarga.toFixed(0)} kg`,
      subtitle: 'por voo DEP',
      icon: Package,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {kpis.map((kpi, index) => (
        <Card key={index} className="border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-600 mb-1">{kpi.title}</p>
                <p className="text-2xl font-bold text-slate-900">{kpi.value}</p>
                {kpi.subtitle && (
                  <p className="text-xs text-slate-500 mt-1">{kpi.subtitle}</p>
                )}
              </div>
              <div className={`${kpi.bgColor} ${kpi.color} p-3 rounded-lg`}>
                <kpi.icon className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}