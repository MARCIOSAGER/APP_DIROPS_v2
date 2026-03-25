import React from 'react';
import { useI18n } from '@/components/lib/i18n';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const COLORS = {
  pontual: '#10b981',
  atrasado: '#f59e0b', 
  muito_atrasado: '#ef4444'
};

export default function PontualidadeChart({ voos, isLoading }) {
  const { t } = useI18n();
  const data = React.useMemo(() => {
    if (!voos.length) return [];

    let pontual = 0;
    let atrasado = 0;
    let muito_atrasado = 0;

    voos.forEach(voo => {
      if (!voo.horario_previsto || !voo.horario_real) return;
      
      const planned = new Date(`2000-01-01T${voo.horario_previsto}`);
      const actual = new Date(`2000-01-01T${voo.horario_real}`);
      const diffMinutes = (actual - planned) / (1000 * 60);

      if (diffMinutes <= 15) {
        pontual++;
      } else if (diffMinutes <= 60) {
        atrasado++;
      } else {
        muito_atrasado++;
      }
    });

    return [
      { nameKey: 'dashboard.onTime', value: pontual, color: COLORS.pontual },
      { nameKey: 'dashboard.delayed', value: atrasado, color: COLORS.atrasado },
      { nameKey: 'dashboard.veryDelayed', value: muito_atrasado, color: COLORS.muito_atrasado }
    ].filter(item => item.value > 0);
  }, [voos]);
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="w-2 h-6 bg-green-600 rounded-full" />
          {t('dashboard.punctualityChart')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-32 w-full rounded-full mx-auto" />
            <div className="flex gap-2 justify-center">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-20" />
            </div>
          </div>
        ) : data.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [`${value} ${t('dashboard.flights')}`, t('dashboard.quantity')]}
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            
            <div className="flex flex-wrap gap-2 justify-center mt-4">
              {data.map((item, index) => (
                <Badge
                  key={index}
                  variant="outline"
                  className="border-2"
                  style={{ borderColor: item.color, color: item.color }}
                >
                  {t(item.nameKey)}: {((item.value / total) * 100).toFixed(1)}%
                </Badge>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center text-slate-500 py-8">
            {t('dashboard.noPunctualityData')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}