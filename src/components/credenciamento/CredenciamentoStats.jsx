import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Shield,
  Clock,
  CheckCircle,
  AlertTriangle,
  UserCheck,
  Calendar
} from 'lucide-react';
import { useI18n } from '@/components/lib/i18n';

export default function CredenciamentoStats({ credenciamentos, isLoading }) {
  const { t } = useI18n();
  const calculateStats = () => {
    if (!credenciamentos || credenciamentos.length === 0) {
      return {
        total: 0,
        pendentes: 0,
        emVerificacao: 0,
        aprovados: 0,
        credenciados: 0,
        rejeitados: 0,
        expirandoEm30Dias: 0
      };
    }

    const hoje = new Date();
    const em30Dias = new Date();
    em30Dias.setDate(hoje.getDate() + 30);

    return {
      total: credenciamentos.length,
      pendentes: credenciamentos.filter(c => c.status === 'pendente').length,
      emVerificacao: credenciamentos.filter(c => c.status === 'em_verificacao').length,
      aprovados: credenciamentos.filter(c => c.status === 'aprovado').length,
      credenciados: credenciamentos.filter(c => c.status === 'credenciado').length,
      rejeitados: credenciamentos.filter(c => c.status === 'rejeitado').length,
      expirandoEm30Dias: credenciamentos.filter(c => {
        if (c.data_fim_validade) {
          const dataFim = new Date(c.data_fim_validade);
          return dataFim >= hoje && dataFim <= em30Dias;
        }
        return false;
      }).length
    };
  };

  const stats = calculateStats();

  const statCards = [
    {
      title: t('cred.stats.totalCredenciais'),
      value: stats.total,
      icon: Shield,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200"
    },
    {
      title: t('cred.stats.pendentes'),
      value: stats.pendentes,
      icon: Clock,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
      borderColor: "border-yellow-200"
    },
    {
      title: "Em Verificação",
      value: stats.emVerificacao,
      icon: AlertTriangle,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      borderColor: "border-orange-200"
    },
    {
      title: "Aprovados",
      value: stats.aprovados,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-50",
      borderColor: "border-green-200"
    },
    {
      title: "Credenciados",
      value: stats.credenciados,
      icon: UserCheck,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
      borderColor: "border-emerald-200"
    },
    {
      title: t('cred.stats.aExpirar'),
      value: stats.expirandoEm30Dias,
      icon: Calendar,
      color: "text-red-600",
      bgColor: "bg-red-50",
      borderColor: "border-red-200"
    }
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index} className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {statCards.map((stat, index) => (
        <Card key={index} className={`border-0 shadow-sm hover:shadow-md transition-shadow ${stat.borderColor} border`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">{stat.title}</p>
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              </div>
              <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}