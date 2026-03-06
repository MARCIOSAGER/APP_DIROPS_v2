import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO, subDays, startOfDay } from 'date-fns';
import { pt } from 'date-fns/locale';

export default function MovimentosChart({ voos, isLoading }) {
  const chartData = React.useMemo(() => {
    if (!voos.length) return [];

    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = startOfDay(subDays(new Date(), 6 - i));
      return {
        date: format(date, 'yyyy-MM-dd'),
        dateLabel: format(date, 'EEE', { locale: pt }),
        ARR: 0,
        DEP: 0
      };
    });

    voos.forEach(voo => {
      try {
        const vooDate = format(parseISO(voo.data_operacao), 'yyyy-MM-dd');
        const dayData = last7Days.find(day => day.date === vooDate);
        if (dayData && (voo.tipo_movimento === 'ARR' || voo.tipo_movimento === 'DEP')) {
          dayData[voo.tipo_movimento]++;
        }
      } catch (error) {
        console.warn('Erro ao processar voo:', voo, error);
      }
    });

    return last7Days;
  }, [voos]);

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="w-2 h-6 bg-blue-600 rounded-full" />
          Movimentos por Dia (Últimos 7 dias)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey="dateLabel" 
                stroke="#64748b"
                fontSize={12}
              />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
                labelFormatter={(label, payload) => {
                  if (payload && payload[0]) {
                    return format(parseISO(payload[0].payload.date), 'EEEE, dd/MM', { locale: pt });
                  }
                  return label;
                }}
              />
              <Bar dataKey="ARR" fill="#3b82f6" name="Chegadas" radius={[2, 2, 0, 0]} />
              <Bar dataKey="DEP" fill="#06b6d4" name="Partidas" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}