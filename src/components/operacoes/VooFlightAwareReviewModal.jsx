import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { validateAndSuggestFlightAwareCrossCheck } from '@/functions/validateAndSuggestFlightAwareCrossCheck';
import VooFlightAwareComparisonRow from './VooFlightAwareComparisonRow';
import { useI18n } from '@/components/lib/i18n';

export default function VooFlightAwareReviewModal({ cacheVooId, vooData, onClose, onConfirmImport, onDuplicateAction }) {
  const { t } = useI18n();
  const [suggestions, setSuggestions] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userSelections, setUserSelections] = useState({});

  useEffect(() => {
    const loadSuggestions = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await validateAndSuggestFlightAwareCrossCheck({
          cacheVooId: cacheVooId
        });
        setSuggestions(response.data.suggestions);
      } catch (err) {
        setError(err.message || t('vooFAReview.validando'));
      } finally {
        setIsLoading(false);
      }
    };

    if (cacheVooId) {
      loadSuggestions();
    }
  }, [cacheVooId]);

  const handleSelectionChange = (field, source, editedData) => {
    setUserSelections(prev => ({
      ...prev,
      [field]: { source, editedData }
    }));
  };

  const processedSuggestions = suggestions ? { ...suggestions } : {};
  Object.keys(processedSuggestions).forEach(key => {
    const selection = userSelections[key];
    if (selection) {
      if (selection.source === 'editar' && Object.keys(selection.editedData).length > 0) {
        processedSuggestions[key].dados = {
          ...processedSuggestions[key].dados,
          ...selection.editedData
        };
      }
    }
  });

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-2xl">
          <CardContent className="p-6 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
              <p className="text-slate-600">{t('vooFAReview.validando')}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <Card className="w-full max-w-3xl my-8 max-h-[90vh] flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-blue-600" />
            {t('vooFAReview.titulo')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 flex-1 overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
              {error}
            </div>
          )}

          {suggestions && (
            <>
              {/* Voo Duplicado */}
              {suggestions.voo_duplicado && (
                <div className="p-4 bg-amber-50 border border-amber-300 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-semibold text-amber-900">Voo ja existe no sistema</p>
                      <p className="text-sm text-amber-700 mt-1">
                        Foi encontrado um voo com o mesmo numero, data e tipo de movimento.
                        Escolha como proceder:
                      </p>
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                          onClick={() => onDuplicateAction('merge', suggestions.voo_duplicado)}
                        >
                          Atualizar Existente
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onDuplicateAction('create', suggestions.voo_duplicado)}
                        >
                          Criar Novo
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={onClose}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Resumo do Voo */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm font-semibold text-blue-900 mb-2">
                  ✈️ Voo: {vooData?.callsign || 'N/A'} ({vooData?.reg || 'N/A'})
                </p>
                <p className="text-xs text-blue-700">
                  {vooData?.origin_airport_name || t('vooFAReview.origemDesconhecida')} →
                  {vooData?.destination_airport_name || t('vooFAReview.destinoDesconhecido')}
                </p>
              </div>

              {/* Comparação de Dados */}
              <div className="space-y-3">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-blue-600" />
                  {t('vooFAReview.validacaoDados')}
                </h3>

                {/* Aeroporto Origem */}
                {suggestions.aeroporto_origem && (
                  <VooFlightAwareComparisonRow
                    title={t('vooFAReview.aeroportoOrigem')}
                    suggestion={suggestions.aeroporto_origem}
                    dadosAPI={{
                      codigo_icao: vooData?.orig_icao || 'N/A',
                      codigo_iata: vooData?.orig_iata || 'N/A',
                      nome: vooData?.origin_airport_name || 'N/A',
                      cidade: vooData?.origin_city || 'N/A'
                    }}
                    onSelectionChange={handleSelectionChange}
                  />
                )}

                {/* Aeroporto Destino */}
                {suggestions.aeroporto_destino && (
                  <VooFlightAwareComparisonRow
                    title={t('vooFAReview.aeroportoDestino')}
                    suggestion={suggestions.aeroporto_destino}
                    dadosAPI={{
                      codigo_icao: vooData?.dest_icao || 'N/A',
                      codigo_iata: vooData?.dest_iata || 'N/A',
                      nome: vooData?.destination_airport_name || 'N/A',
                      cidade: vooData?.destination_city || 'N/A'
                    }}
                    onSelectionChange={handleSelectionChange}
                  />
                )}

                {/* Companhia Aérea */}
                {suggestions.companhia_aerea && (
                  <VooFlightAwareComparisonRow
                    title={t('vooFAReview.companhiaAerea')}
                    suggestion={suggestions.companhia_aerea}
                    dadosAPI={{
                      codigo_icao: vooData?.operating_as || vooData?.painted_as || 'N/A',
                      nome: vooData?.airline_name || 'N/A'
                    }}
                    onSelectionChange={handleSelectionChange}
                  />
                )}

                {/* Modelo de Aeronave */}
                {suggestions.modelo_aeronave && (
                  <VooFlightAwareComparisonRow
                    title={t('vooFAReview.modeloAeronave')}
                    suggestion={suggestions.modelo_aeronave}
                    dadosAPI={{
                      codigo_iata: vooData?.type || 'N/A',
                      modelo: vooData?.aircraft_type_name || 'N/A',
                      mtow_kg: vooData?.aircraft_mtow || 'N/A'
                    }}
                    onSelectionChange={handleSelectionChange}
                  />
                )}

                {/* Registo de Aeronave */}
                {suggestions.registo_aeronave && (
                  <VooFlightAwareComparisonRow
                    title={t('vooFAReview.registoAeronave')}
                    suggestion={suggestions.registo_aeronave}
                    dadosAPI={{
                      registo: vooData?.reg || 'N/A',
                      mtow_kg: vooData?.aircraft_mtow || 'N/A'
                    }}
                    onSelectionChange={handleSelectionChange}
                  />
                )}
              </div>

              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md text-xs text-yellow-700">
                <p className="font-semibold mb-1">ℹ️ {t('vooFAReview.instrucoes')}</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>{t('vooFAReview.instrUsarSistema')}</li>
                  <li>{t('vooFAReview.instrUsarAPI')}</li>
                  <li>{t('vooFAReview.instrEditar')}</li>
                </ul>
              </div>
            </>
          )}

          {!suggestions?.voo_duplicado && (
            <div className="flex gap-3 justify-end pt-4 border-t">
              <Button
                variant="outline"
                onClick={onClose}
              >
                {t('vooFAReview.cancelar')}
              </Button>
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => onConfirmImport(processedSuggestions, userSelections)}
                disabled={isLoading}
              >
                {t('vooFAReview.confirmarImportacao')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}