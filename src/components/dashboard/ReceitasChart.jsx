import React from 'react';
import { useI18n } from '@/components/lib/i18n';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO, subDays, startOfDay } from 'date-fns';
import { pt } from 'date-fns/locale';

export default function ReceitasChart({ voos, calculosTarifa, isLoading }) {
  const { t } = useI18n();
  const chartData = React.useMemo(() => {
    if (!voos.length || !calculosTarifa || calculosTarifa.length === 0) {
      return Array.from({ length: 7 }, (_, i) => {
        const date = startOfDay(subDays(new Date(), 6 - i));
        return {
          date: format(date, 'yyyy-MM-dd'),
          dateLabel: format(date, 'dd/MM', { locale: pt }),
          receita: 0
        };
      });
    }

    // Criar mapa de voo_id -> calculo para busca rápida
    const calculosPorVoo = new Map();
    calculosTarifa.forEach(ct => {
      if (ct.tipo_tarifa !== 'Voo Isento de Tarifas' && ct.total_tarifa) {
        calculosPorVoo.set(ct.voo_id, ct);
      }
    });
    // Criar mapa de voo_id -> voo para busca rápida
    const voosMap = new Map(voos.map(v => [v.id, v]));

    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = startOfDay(subDays(new Date(), 6 - i));
      return {
        date: format(date, 'yyyy-MM-dd'),
        dateLabel: format(date, 'dd/MM', { locale: pt }),
        receita: 0
      };
    });

    // Agrupar receitas pela data de operação do voo
    const receitasPorDia = {};
    calculosPorVoo.forEach((calculo, vooId) => {
      const voo = voosMap.get(vooId);
      if (voo && voo.data_operacao && calculo && calculo.total_tarifa !== undefined && calculo.total_tarifa !== null) {
        const vooDate = format(parseISO(voo.data_operacao), 'yyyy-MM-dd');
        const dayData = last7Days.find(day => day.date === vooDate);
        
        if (dayData) {
          dayData.receita += (calculo.total_tarifa || 0);
          receitasPorDia[vooDate] = (receitasPorDia[vooDate] || 0) + 1;
        }
      }
    });

    return last7Days;
  }, [voos, calculosTarifa]);
  const totalRevenue = chartData.reduce((sum, day) => sum + day.receita, 0);

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            <div className="w-2 h-6 bg-emerald-600 rounded-full" />
            {t('dashboard.revenueChart')}
          </CardTitle>
          <div className="text-right">
            <p className="text-sm text-slate-500">{t('dashboard.total7days')}</p>
            <p className="text-lg font-bold text-emerald-600">
              {new Intl.NumberFormat('pt-AO').format(totalRevenue)} Kz
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey="dateLabel" 
                stroke="#64748b"
                fontSize={12}
              />
              <YAxis 
                stroke="#64748b" 
                fontSize={12}
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
                formatter={(value) => [
                  `${new Intl.NumberFormat('pt-AO').format(value)} Kz`,
                  t('dashboard.revenue')
                ]}
                labelFormatter={(label, payload) => {
                  if (payload && payload[0]) {
                    return format(parseISO(payload[0].payload.date), 'EEEE, dd/MM', { locale: pt });
                  }
                  return label;
                }}
              />
              <Line 
                type="monotone" 
                dataKey="receita" 
                stroke="#10b981" 
                strokeWidth={3}
                dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: '#10b981', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}