import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Clock, 
  Wrench, 
  CheckCircle, 
  AlertTriangle, 
  TrendingUp,
  DollarSign
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function ManutencaoStats({ ordens, isLoading }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        {Array(6).fill(0).map((_, i) => (
          <Card key={i} className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const stats = {
    total: ordens.length,
    pendentes: ordens.filter(o => o.status === 'pendente').length,
    emAndamento: ordens.filter(o => ['atribuida', 'em_execucao', 'aguardando_verificacao'].includes(o.status)).length,
    concluidas: ordens.filter(o => o.status === 'concluida').length,
    urgentes: ordens.filter(o => o.prioridade === 'urgente').length,
    custosEstimados: ordens.reduce((sum, o) => sum + (o.custos_estimados || 0), 0)
  };

  const statsData = [
    {
      title: "Total de OS",
      value: stats.total,
      icon: Wrench,
      color: "text-blue-600",
      bgColor: "bg-blue-50"
    },
    {
      title: "Pendentes",
      value: stats.pendentes,
      icon: Clock,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50"
    },
    {
      title: "Em Andamento",
      value: stats.emAndamento,
      icon: TrendingUp,
      color: "text-purple-600",
      bgColor: "bg-purple-50"
    },
    {
      title: "Concluídas",
      value: stats.concluidas,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-50"
    },
    {
      title: "Urgentes",
      value: stats.urgentes,
      icon: AlertTriangle,
      color: "text-red-600",
      bgColor: "bg-red-50"
    },
    {
      title: "Custos Est.",
      value: new Intl.NumberFormat('pt-AO', { 
        style: 'currency', 
        currency: 'AOA',
        notation: 'compact',
        maximumFractionDigits: 0
      }).format(stats.custosEstimados),
      icon: DollarSign,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
      {statsData.map((stat, index) => (
        <Card key={index} className="border-0 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              {stat.title}
            </CardTitle>
            <div className={`p-2 rounded-lg ${stat.bgColor}`}>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {stat.value}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}