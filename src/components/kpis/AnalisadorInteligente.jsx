import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Brain, Loader2, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Lightbulb } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

export default function AnalisadorInteligente({ isOpen, onClose, medicoes, tiposKPI, aeroportos }) {
  const [analise, setAnalise] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const analisarDados = async () => {
    setIsLoading(true);
    setError(null);

    // Análise IA desabilitada para poupar créditos
    // Gerar análise simples a partir dos dados locais
    try {
      const kpisCriticos = medicoes
        .filter(m => m.dentro_da_meta === false)
        .slice(0, 5)
        .map(m => {
          const tipo = tiposKPI.find(t => t.id === m.tipo_kpi_id);
          return { kpi: tipo?.nome || 'KPI', problema: `Resultado: ${m.resultado_principal}, Meta: ${tipo?.meta_objetivo}` };
        });

      const areasExcelencia = medicoes
        .filter(m => m.dentro_da_meta === true)
        .slice(0, 3)
        .map(m => {
          const tipo = tiposKPI.find(t => t.id === m.tipo_kpi_id);
          return `${tipo?.nome || 'KPI'} dentro da meta`;
        });

      setAnalise({
        tendencias: ['Análise automática com IA temporariamente desabilitada.'],
        kpis_criticos: kpisCriticos,
        areas_excelencia: areasExcelencia,
        recomendacoes: [],
        alertas_urgentes: kpisCriticos.length > 0 ? [`${kpisCriticos.length} KPI(s) abaixo da meta`] : []
      });
    } catch (err) {
      setError('Não foi possível realizar a análise.');
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    if (isOpen && !analise && !isLoading) {
      analisarDados();
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Brain className="w-6 h-6 text-purple-600" />
            Análise Inteligente de KPIs
          </DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-12 h-12 animate-spin text-purple-600 mb-4" />
            <p className="text-slate-600">Analisando {medicoes.length} medições...</p>
          </div>
        )}

        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <p className="text-red-800">{error}</p>
              <Button onClick={analisarDados} className="mt-4">
                Tentar Novamente
              </Button>
            </CardContent>
          </Card>
        )}

        {analise && (
          <div className="space-y-6">
            {/* Alertas Urgentes */}
            {analise.alertas_urgentes?.length > 0 && (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="p-4">
                  <h3 className="font-semibold text-red-900 flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-5 h-5" />
                    Alertas Urgentes
                  </h3>
                  <ul className="space-y-2">
                    {analise.alertas_urgentes.map((alerta, idx) => (
                      <li key={idx} className="text-red-800 flex items-start gap-2">
                        <span className="text-red-600 mt-1">•</span>
                        <span>{alerta}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Tendências */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-3">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  Tendências Identificadas
                </h3>
                <ul className="space-y-2">
                  {analise.tendencias?.map((tendencia, idx) => (
                    <li key={idx} className="text-slate-700 flex items-start gap-2">
                      <span className="text-blue-600 mt-1">•</span>
                      <span>{tendencia}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* KPIs Críticos */}
            {analise.kpis_criticos?.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-3">
                    <TrendingDown className="w-5 h-5 text-orange-600" />
                    KPIs Críticos (Requerem Atenção)
                  </h3>
                  <div className="space-y-3">
                    {analise.kpis_criticos.map((item, idx) => (
                      <div key={idx} className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                        <div className="font-medium text-orange-900">{item.kpi}</div>
                        <div className="text-sm text-orange-700 mt-1">{item.problema}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Áreas de Excelência */}
            {analise.areas_excelencia?.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-3">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    Áreas de Excelência
                  </h3>
                  <ul className="space-y-2">
                    {analise.areas_excelencia.map((area, idx) => (
                      <li key={idx} className="text-green-700 flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 mt-1 flex-shrink-0" />
                        <span>{area}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Recomendações */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-3">
                  <Lightbulb className="w-5 h-5 text-yellow-600" />
                  Recomendações de Melhoria
                </h3>
                <div className="space-y-3">
                  {analise.recomendacoes?.map((rec, idx) => (
                    <div key={idx} className="border border-slate-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium text-slate-900">{rec.area}</div>
                        <Badge className={
                          rec.prioridade?.toLowerCase() === 'alta' ? 'bg-red-100 text-red-800' :
                          rec.prioridade?.toLowerCase() === 'média' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }>
                          {rec.prioridade}
                        </Badge>
                      </div>
                      <div className="text-sm text-slate-700">{rec.acao}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={analisarDados} disabled={isLoading}>
                Atualizar Análise
              </Button>
              <Button onClick={onClose}>Fechar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}