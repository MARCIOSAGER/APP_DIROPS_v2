import React from 'react';
import { useI18n } from '@/components/lib/i18n';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';

export default function MovimentosFinanceirosChart({ data, isLoading }) {
  const { t } = useI18n();
  if (isLoading) {
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader>
        <CardContent className="h-80 w-full"><Skeleton className="h-full w-full" /></CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-slate-800">
          {t('financeiro.revenueVsExpenses')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data && data.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey="mesAno" 
                tickFormatter={(value) => {
                  try {
                    return format(parseISO(`${value}-01`), 'MMM/yy', { locale: pt });
                  } catch {
                    return value;
                  }
                }}
                stroke="#64748b"
                fontSize={12}
              />
              <YAxis 
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}K Kz`}
                stroke="#64748b"
                fontSize={12}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
                formatter={(value, name) => [
                  `${new Intl.NumberFormat('pt-AO').format(value)} Kz`, 
                  name === 'receita' ? 'Receita' : 'Despesa'
                ]}
                labelFormatter={(label) => {
                  try {
                    return format(parseISO(`${label}-01`), 'MMMM de yyyy', { locale: pt });
                  } catch {
                    return label;
                  }
                }}
              />
              <Line 
                type="monotone" 
                dataKey="receita" 
                stroke="#10b981" 
                strokeWidth={2} 
                dot={{ r: 4, fill: '#10b981' }} 
                activeDot={{ r: 6 }} 
                name="Receita"
              />
              <Line 
                type="monotone" 
                dataKey="despesa" 
                stroke="#ef4444" 
                strokeWidth={2} 
                dot={{ r: 4, fill: '#ef4444' }} 
                activeDot={{ r: 6 }} 
                name="Despesa"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-8 text-slate-500">
            Nenhum dado financeiro disponível para o período selecionado.
          </div>
        )}
      </CardContent>
    </Card>
  );
}