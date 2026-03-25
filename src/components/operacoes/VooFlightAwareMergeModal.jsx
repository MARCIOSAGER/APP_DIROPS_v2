import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/components/lib/i18n';
import { importVooFromFlightAwareCache } from '@/functions/importVooFromFlightAwareCache';

export default function VooFlightAwareMergeModal({ existingVoo, faData, cacheVooId, onClose, onMergeComplete }) {
  const { t } = useI18n();
  const [selectedFields, setSelectedFields] = useState([]);
  const [isMerging, setIsMerging] = useState(false);
  const [error, setError] = useState(null);

  const fieldLabels = {
    horario_previsto: 'Horario Previsto',
    registo_aeronave: 'Registo Aeronave',
    aeroporto_origem_destino: 'Aeroporto Origem/Destino',
    posicao_stand: 'Posicao Stand',
    observacoes: 'Observacoes',
    companhia_aerea: 'Companhia Aerea',
  };

  // Only fields where existing is empty AND FA has data
  const mergeableFields = Object.keys(faData || {}).filter(
    field => faData[field] && !existingVoo[field]
  );

  const handleMerge = async () => {
    setIsMerging(true);
    setError(null);
    try {
      const result = await importVooFromFlightAwareCache({
        cacheVooId,
        selectedFields,
      });
      if (result.success) {
        onMergeComplete(result);
      }
    } catch (err) {
      console.error('Erro ao atualizar voo:', err);
      setError(err.message || 'Erro desconhecido');
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Atualizar Voo com Dados FlightAware</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            Selecione os campos que deseja atualizar. Apenas campos vazios no sistema podem ser preenchidos.
          </p>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
              {error}
            </div>
          )}

          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2 w-8"></th>
                <th className="text-left p-2">Campo</th>
                <th className="text-left p-2">Valor Atual</th>
                <th className="text-left p-2">Valor FlightAware</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(fieldLabels).map(field => {
                const isMergeable = mergeableFields.includes(field);
                const isChecked = selectedFields.includes(field);
                return (
                  <tr key={field} className={`border-b ${isMergeable ? 'bg-green-50' : 'bg-slate-50'}`}>
                    <td className="p-2">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={!isMergeable}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedFields(prev => [...prev, field]);
                          } else {
                            setSelectedFields(prev => prev.filter(f => f !== field));
                          }
                        }}
                        className="rounded border-slate-300"
                      />
                    </td>
                    <td className="p-2 font-medium">{fieldLabels[field]}</td>
                    <td className="p-2">
                      {existingVoo[field] || <span className="text-slate-400 italic">vazio</span>}
                    </td>
                    <td className="p-2">
                      {(faData || {})[field] || <span className="text-slate-400 italic">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <button
            className="text-xs text-blue-600 hover:underline"
            onClick={() => setSelectedFields([...mergeableFields])}
          >
            Selecionar todos disponiveis ({mergeableFields.length})
          </button>

          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={selectedFields.length === 0 || isMerging}
              onClick={handleMerge}
            >
              {isMerging ? 'Atualizando...' : `Atualizar ${selectedFields.length} campo(s)`}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
