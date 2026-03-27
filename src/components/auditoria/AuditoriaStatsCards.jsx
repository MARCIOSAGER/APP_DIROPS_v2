import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, Shield, Settings, BarChart3 } from 'lucide-react';
import { useI18n } from '@/components/lib/i18n';

export default function AuditoriaStatsCards({ estatisticas }) {
  const { t } = useI18n();

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{t('auditoria.totalAuditorias')}</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{estatisticas.total}</p>
            </div>
            <FileText className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{t('auditoria.concluidas')}</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{estatisticas.concluidas}</p>
            </div>
            <Shield className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{t('auditoria.emAndamento')}</p>
              <p className="text-2xl font-bold text-orange-600">{estatisticas.emAndamento}</p>
            </div>
            <Settings className="h-8 w-8 text-orange-600" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{t('auditoria.conformidadeMedia')}</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{estatisticas.conformidadeMedia.toFixed(1)}%</p>
            </div>
            <BarChart3 className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
