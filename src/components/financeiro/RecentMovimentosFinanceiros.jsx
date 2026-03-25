import React from 'react';
import { useI18n } from '@/components/lib/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';

export default function RecentMovimentosFinanceiros({ movimentos, isLoading }) {
  const { t } = useI18n();
  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">{t('financeiro.recentMovimentos')}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {Array(5).fill(0).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-8 w-20 rounded-full" />
              </div>
            ))}
          </div>
        ) : movimentos.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <p>{t('msg.no_data')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {movimentos.map((movimento) => (
              <div key={movimento.id} className="flex items-start justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className={`p-2 rounded-full ${movimento.tipo === 'receita' ? 'bg-green-100' : 'bg-red-100'}`}>
                    {movimento.tipo === 'receita' ? (
                      <TrendingUp className={`w-4 h-4 ${movimento.tipo === 'receita' ? 'text-green-600' : 'text-red-600'}`} />
                    ) : (
                      <TrendingDown className={`w-4 h-4 ${movimento.tipo === 'receita' ? 'text-green-600' : 'text-red-600'}`} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 truncate">{movimento.categoria}</p>
                        <p className="text-sm text-slate-500 truncate">{movimento.descricao}</p>
                        <p className="text-xs text-slate-400">
                          {format(parseISO(movimento.data), 'dd/MM/yyyy', { locale: pt })}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge 
                          variant="outline" 
                          className={`${movimento.tipo === 'receita' ? 'text-green-700 border-green-200' : 'text-red-700 border-red-200'} font-medium whitespace-nowrap`}
                        >
                          {new Intl.NumberFormat('pt-AO', { 
                            style: 'currency', 
                            currency: 'AOA',
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0
                          }).format(movimento.valor_kz)}
                        </Badge>
                        <span className="text-xs text-slate-500 uppercase">{movimento.tipo}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}