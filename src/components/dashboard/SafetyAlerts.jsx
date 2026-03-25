import React from 'react';
import { useI18n } from '@/components/lib/i18n';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, AlertTriangle, Info } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';

const SEVERITY_CONFIG = {
  critica: { color: 'bg-red-100 text-red-800 border-red-200', icon: ShieldAlert },
  alta: { color: 'bg-orange-100 text-orange-800 border-orange-200', icon: AlertTriangle },
  media: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: AlertTriangle },
  baixa: { color: 'bg-blue-100 text-blue-800 border-blue-200', icon: Info }
};

export default function SafetyAlerts({ ocorrencias, isLoading }) {
  const { t } = useI18n();
  const recentOccurrences = ocorrencias
    .sort((a, b) => new Date(b.data_ocorrencia) - new Date(a.data_ocorrencia))
    .slice(0, 5);

  const criticalCount = ocorrencias.filter(o => o.gravidade === 'critica').length;
  const openCount = ocorrencias.filter(o => o.status === 'aberta').length;

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="w-2 h-6 bg-red-600 rounded-full" />
          {t('dashboard.safetyAlerts')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-red-600" />
                  <div>
                    <p className="text-xs text-red-600 font-medium">{t('safety.criticas')}</p>
                    <p className="text-lg font-bold text-red-700">{criticalCount}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  <div>
                    <p className="text-xs text-orange-600 font-medium">{t('dashboard.openOccurrences')}</p>
                    <p className="text-lg font-bold text-orange-700">{openCount}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Occurrences */}
            <div className="space-y-3">
              <h4 className="font-medium text-slate-700">{t('dashboard.recentOccurrences')}</h4>
              
              {recentOccurrences.length === 0 ? (
                <div className="text-center text-slate-500 py-4">
                  <ShieldAlert className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm">{t('safety.noResults')}</p>
                </div>
              ) : (
                recentOccurrences.map((ocorrencia) => {
                  const config = SEVERITY_CONFIG[ocorrencia.gravidade] || SEVERITY_CONFIG.baixa;
                  const IconComponent = config.icon;
                  
                  return (
                    <div 
                      key={ocorrencia.id}
                      className="border border-slate-200 rounded-lg p-3 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2">
                          <IconComponent className="h-4 w-4 mt-0.5 text-slate-400" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-slate-900 line-clamp-1">
                              {ocorrencia.tipo_ocorrencia.toUpperCase()}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              {ocorrencia.aeroporto} • {format(parseISO(ocorrencia.data_ocorrencia), 'dd/MM', { locale: pt })}
                            </p>
                          </div>
                        </div>
                        
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${config.color} border shrink-0`}
                        >
                          {ocorrencia.gravidade}
                        </Badge>
                      </div>
                      
                      {ocorrencia.descricao && (
                        <p className="text-xs text-slate-600 mt-2 line-clamp-2">
                          {ocorrencia.descricao}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}