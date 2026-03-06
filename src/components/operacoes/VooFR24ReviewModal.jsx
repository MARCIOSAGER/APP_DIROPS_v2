import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { validateAndSuggestFR24CrossCheck } from '@/functions/validateAndSuggestFR24CrossCheck';
import VooFR24ComparisonRow from './VooFR24ComparisonRow';

export default function VooFR24ReviewModal({ cacheVooId, vooData, onClose, onConfirmImport }) {
  const [suggestions, setSuggestions] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userSelections, setUserSelections] = useState({});

  useEffect(() => {
    const loadSuggestions = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await validateAndSuggestFR24CrossCheck({
          cacheVooId: cacheVooId
        });
        setSuggestions(response.data.suggestions);
      } catch (err) {
        setError(err.message || 'Erro ao validar voo');
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
              <p className="text-slate-600">A validar voo...</p>
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
            Revisão e Cross-Check do Voo
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
                <VooFR24ComparisonRow
                  title="Voo Duplicado - Comparar e Editar"
                  suggestion={suggestions.voo_duplicado}
                  dadosAPI={suggestions.voo_duplicado.dadosAPI}
                  onSelectionChange={handleSelectionChange}
                  isDuplicateFlight={true}
                />
              )}

              {/* Resumo do Voo */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm font-semibold text-blue-900 mb-2">
                  ✈️ Voo: {vooData?.callsign || 'N/A'} ({vooData?.reg || 'N/A'})
                </p>
                <p className="text-xs text-blue-700">
                  {vooData?.origin_airport_name || 'Origem desconhecida'} → 
                  {vooData?.destination_airport_name || 'Destino desconhecido'}
                </p>
              </div>

              {/* Comparação de Dados */}
              <div className="space-y-3">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-blue-600" />
                  Validação de Dados
                </h3>

                {/* Aeroporto Origem */}
                {suggestions.aeroporto_origem && (
                  <VooFR24ComparisonRow
                    title="Aeroporto de Origem"
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
                  <VooFR24ComparisonRow
                    title="Aeroporto de Destino"
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
                  <VooFR24ComparisonRow
                    title="Companhia Aérea"
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
                  <VooFR24ComparisonRow
                    title="Modelo de Aeronave"
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
                  <VooFR24ComparisonRow
                    title="Registo de Aeronave"
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
                <p className="font-semibold mb-1">ℹ️ Instruções de Uso</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Escolha "Usar Sistema" para dados já existentes</li>
                  <li>Escolha "Usar API" para dados sugeridos pela Flightradar24</li>
                  <li>Escolha "Editar Manualmente" para modificar os dados antes de salvar</li>
                </ul>
              </div>
            </>
          )}

          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={onClose}
            >
              Cancelar
            </Button>
            <Button 
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => onConfirmImport(processedSuggestions, userSelections)}
              disabled={isLoading}
            >
              Confirmar Importação
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}