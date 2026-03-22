import React from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { 
  Plane, 
  Clock, 
  DollarSign, 
  ShieldAlert, 
  TrendingUp, 
  TrendingDown,
  Minus,
  PlaneLanding,
  PlaneTakeoff,
  ClipboardList,
  Users
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from 'date-fns';

export default function DashboardStats({ voos, ocorrencias, inspecoes, calculosTarifa, isLoading, serverStats }) {
  const calculateStats = () => {
    // Use server stats if available (accurate, no pagination limit)
    if (serverStats) {
      const safetyIncidents = ocorrencias ? ocorrencias.filter(o => o.status === 'aberta').length : 0;
      const inspecoesPendentes = inspecoes ? inspecoes.filter(i => i.status === 'em_andamento').length : 0;
      let revenue = 0;
      if (calculosTarifa && calculosTarifa.length > 0) {
        revenue = calculosTarifa
          .filter(ct => ct.tipo_tarifa !== 'Voo Isento de Tarifas')
          .reduce((sum, ct) => sum + (ct.total_tarifa || 0), 0);
      }
      return {
        movements: serverStats.total_voos || 0,
        punctuality: serverStats.pontualidade || 0,
        revenue,
        safetyIncidents,
        chegadasHoje: serverStats.chegadas_hoje || 0,
        partidasHoje: serverStats.partidas_hoje || 0,
        passageirosHoje: serverStats.total_passageiros || 0,
        inspecoesPendentes,
        ligados: serverStats.ligados || 0,
        semLink: serverStats.sem_link || 0,
      };
    }

    if (!voos || !voos.length) return {
      movements: 0,
      punctuality: 0,
      revenue: 0,
      safetyIncidents: 0,
      chegadasHoje: 0,
      partidasHoje: 0,
      passageirosHoje: 0,
      inspecoesPendentes: 0
    };

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const voosHoje = voos.filter(v => v.data_operacao === todayStr);

    // Total de movimentos
    const movements = voos.length;
    
    // Taxa de pontualidade (apenas voos realizados com horários)
    const voosRealizadosComHorarios = voos.filter(voo => 
      voo.status === 'Realizado' && 
      voo.horario_previsto && 
      voo.horario_real
    );
    
    const onTimeFlights = voosRealizadosComHorarios.filter(voo => {
      const planned = new Date(`2000-01-01T${voo.horario_previsto}`);
      const actual = new Date(`2000-01-01T${voo.horario_real}`);
      const diffMinutes = Math.abs(actual - planned) / (1000 * 60);
      return diffMinutes <= 15; // Pontual se diferença <= 15 minutos
    }).length;
    
    const punctuality = voosRealizadosComHorarios.length > 0 
      ? (onTimeFlights / voosRealizadosComHorarios.length) * 100 
      : 0;
    
    // Receita (soma dos cálculos de tarifas válidos)
    let revenue = 0;
    if (calculosTarifa && calculosTarifa.length > 0) {
      revenue = calculosTarifa
        .filter(ct => ct.tipo_tarifa !== 'Voo Isento de Tarifas')
        .reduce((sum, ct) => sum + (ct.total_tarifa || 0), 0);
    }
    
    // Ocorrências abertas
    const safetyIncidents = ocorrencias ? ocorrencias.filter(o => o.status === 'aberta').length : 0;
    
    // Chegadas hoje (tipo ARR)
    const chegadasHoje = voosHoje.filter(v => v.tipo_movimento === 'ARR').length;
    
    // Partidas hoje (tipo DEP)
    const partidasHoje = voosHoje.filter(v => v.tipo_movimento === 'DEP').length;
    
    // Passageiros hoje (soma de passageiros_total dos voos de hoje)
    const passageirosHoje = voosHoje.reduce((sum, v) => sum + (v.passageiros_total || 0), 0);
    
    // Inspeções pendentes (status em_andamento)
    const inspecoesPendentes = inspecoes ? inspecoes.filter(i => i.status === 'em_andamento').length : 0;

    return { 
      movements, 
      punctuality, 
      revenue, 
      safetyIncidents, 
      chegadasHoje, 
      partidasHoje, 
      passageirosHoje, 
      inspecoesPendentes 
    };
  };

  const stats = calculateStats();

  const statsData = [
    {
      title: "Total de Voos",
      value: stats.movements,
      icon: Plane,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      trend: "+12% vs. semana anterior",
      trendDirection: "up"
    },
    {
      title: "Chegadas Hoje",
      value: stats.chegadasHoje,
      icon: PlaneLanding,
      color: "text-sky-600",
      bgColor: "bg-sky-50",
      trend: "+5% vs. ontem",
      trendDirection: "up"
    },
    {
      title: "Partidas Hoje",
      value: stats.partidasHoje,
      icon: PlaneTakeoff,
      color: "text-cyan-600",
      bgColor: "bg-cyan-50",
      trend: "+8% vs. ontem",
      trendDirection: "up"
    },
    {
      title: "Taxa de Pontualidade",
      value: `${stats.punctuality.toFixed(1)}%`,
      icon: Clock,
      color: "text-green-600",
      bgColor: "bg-green-50",
      trend: "+2.1%",
      trendDirection: stats.punctuality >= 85 ? "up" : "down"
    },
    {
      title: "Receita (Kz)",
      value: new Intl.NumberFormat('pt-AO', { 
        notation: 'compact',
        compactDisplay: 'short'
      }).format(stats.revenue),
      icon: DollarSign,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
      trend: "+15% vs. semana anterior",
      trendDirection: "up"
    },
    {
      title: "Ocorrências Abertas",
      value: stats.safetyIncidents,
      icon: ShieldAlert,
      color: stats.safetyIncidents > 0 ? "text-red-600" : "text-gray-600",
      bgColor: stats.safetyIncidents > 0 ? "bg-red-50" : "bg-gray-50",
      trend: "-2 vs. semana anterior",
      trendDirection: "down"
    },
    {
      title: "Inspeções Pendentes",
      value: stats.inspecoesPendentes,
      icon: ClipboardList,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
      trend: "+1 vs. ontem",
      trendDirection: "up"
    },
    {
      title: "Passageiros Hoje",
      value: stats.passageirosHoje > 0 
        ? `${(stats.passageirosHoje / 1000).toFixed(1)}K` 
        : '0',
      icon: Users,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
      trend: "+18% vs. ontem",
      trendDirection: "up"
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8 gap-3">
      {statsData.map((stat, index) => (
        <Card key={index} className="border-0 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 pt-4">
            <div className={`p-1.5 rounded-lg ${stat.bgColor}`}>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
          </CardHeader>
          
          <CardContent className="px-4 pb-4">
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-3 w-12" />
              </div>
            ) : (
              <>
                <div className="text-xl font-bold text-slate-900 mb-1">
                  {stat.value}
                </div>
                <p className="text-[10px] font-medium text-slate-600 mb-1.5 line-clamp-2">
                  {stat.title}
                </p>
                <div className="flex items-center">
                  {stat.trendDirection === "up" && (
                    <TrendingUp className="h-2.5 w-2.5 text-green-500 mr-1" />
                  )}
                  {stat.trendDirection === "down" && (
                    <TrendingDown className="h-2.5 w-2.5 text-red-500 mr-1" />
                  )}
                  {stat.trendDirection === "neutral" && (
                    <Minus className="h-2.5 w-2.5 text-gray-500 mr-1" />
                  )}
                  <span className="text-[10px] text-slate-500">
                    {stat.trend}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}