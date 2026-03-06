import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function VooFR24ComparisonRow({ 
  title, 
  suggestion, 
  dadosAPI,
  onSelectionChange,
  isDuplicateFlight = false
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editedData, setEditedData] = useState({});
  const [selectedSource, setSelectedSource] = useState('sistema');

  React.useEffect(() => {
    if (suggestion?.status === 'desconhecido' || suggestion?.status === 'novo') {
      setSelectedSource('api');
    } else {
      setSelectedSource('sistema');
    }
  }, [suggestion?.status]);

  const handleSourceChange = (source) => {
    setSelectedSource(source);
    onSelectionChange?.(title, source, editedData);
  };

  const handleEditChange = (key, value) => {
    const newData = { ...editedData, [key]: value };
    setEditedData(newData);
    onSelectionChange?.(title, 'editar', newData);
  };

  const getStatusBadge = () => {
    if (suggestion?.status === 'desconhecido') {
      return <Badge className="bg-red-100 text-red-800">❌ Desconhecido</Badge>;
    }
    if (suggestion?.status === 'novo') {
      return <Badge className="bg-blue-100 text-blue-800">✨ Novo Registo</Badge>;
    }
    if (suggestion?.status === 'existente') {
      return <Badge className="bg-green-100 text-green-800">✓ Existente</Badge>;
    }
    return null;
  };

  const systemData = suggestion?.dados || {};
  const apiData = dadosAPI || {};

  // Formatar tempo para input
  const formatTimeForInput = (timeString) => {
    if (!timeString || timeString === 'N/A' || timeString === null) return '';
    if (timeString.length === 5 && timeString.includes(':')) return timeString;
    try {
      return timeString.substring(11, 16); // HH:MM do ISO string
    } catch (e) {
      return '';
    }
  };

  // Para voos duplicados, formatar os horários e renomear rótulos
  const displaySystemData = { ...systemData };
  const displayApiData = { ...apiData };
  
  if (isDuplicateFlight) {
    if (displaySystemData.horario_previsto) {
      displaySystemData['⏰ Schedule Time'] = formatTimeForInput(displaySystemData.horario_previsto);
      delete displaySystemData.horario_previsto;
    }
    if (displaySystemData.horario_real) {
      displaySystemData['⏰ Actual Time'] = formatTimeForInput(displaySystemData.horario_real);
      delete displaySystemData.horario_real;
    }
    if (displayApiData.horario_previsto) {
      displayApiData['⏰ Schedule Time'] = formatTimeForInput(displayApiData.horario_previsto);
      delete displayApiData.horario_previsto;
    }
    if (displayApiData.horario_real) {
      displayApiData['⏰ Actual Time'] = formatTimeForInput(displayApiData.horario_real);
      delete displayApiData.horario_real;
    }
  }

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors bg-white"
      >
        <div className="flex items-center gap-3 flex-1">
          {getStatusBadge()}
          <span className="font-semibold text-slate-800">{title}</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-slate-600" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-600" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-slate-200 bg-slate-50 p-4 space-y-4">
          {/* Seleção de Fonte */}
          <div className="flex gap-3 mb-4">
            <label className="flex items-center gap-2 cursor-pointer p-2 border border-slate-300 rounded hover:bg-white">
              <input
                type="radio"
                name={`source-${title}`}
                value="sistema"
                checked={selectedSource === 'sistema'}
                onChange={() => handleSourceChange('sistema')}
                disabled={suggestion?.status === 'desconhecido' || suggestion?.status === 'novo'}
              />
              <span className="text-sm font-medium">Usar Sistema</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer p-2 border border-slate-300 rounded hover:bg-white">
              <input
                type="radio"
                name={`source-${title}`}
                value="api"
                checked={selectedSource === 'api'}
                onChange={() => handleSourceChange('api')}
              />
              <span className="text-sm font-medium">Usar API</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer p-2 border border-slate-300 rounded hover:bg-white">
              <input
                type="radio"
                name={`source-${title}`}
                value="editar"
                checked={selectedSource === 'editar'}
                onChange={() => {
                  setSelectedSource('editar');
                  setEditMode(true);
                }}
              />
              <span className="text-sm font-medium">Editar Manualmente</span>
            </label>
          </div>

          {/* Comparação de Dados */}
          <div className="grid grid-cols-2 gap-4">
            {/* Sistema */}
            <div className="space-y-2">
              <h4 className="font-semibold text-slate-700 text-sm">📊 Dados do Sistema</h4>
              {Object.entries(displaySystemData).length === 0 ? (
                <p className="text-xs text-slate-500 italic">Sem dados no sistema</p>
              ) : (
                <div className="bg-white p-3 rounded border border-slate-200 space-y-1 max-h-64 overflow-y-auto">
                  {Object.entries(displaySystemData)
                    .filter(([k]) => !['id', 'created_date', 'updated_date', 'created_by_id'].includes(k))
                    .map(([key, value]) => {
                      // Esconder campos de ID para voos duplicados
                      if (isDuplicateFlight && (key === 'voo_ligado_id' || key === 'fr24_id')) return null;
                      return (
                        <div key={key} className="text-xs">
                          <span className="font-semibold text-slate-600">{key}:</span>
                          <span className="text-slate-700 ml-1">{String(value) || 'N/A'}</span>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* API */}
            <div className="space-y-2">
              <h4 className="font-semibold text-slate-700 text-sm">🌐 Dados da API</h4>
              {Object.entries(displayApiData).length === 0 ? (
                <p className="text-xs text-slate-500 italic">Sem dados da API</p>
              ) : (
                <div className="bg-white p-3 rounded border border-slate-200 space-y-1 max-h-64 overflow-y-auto">
                  {Object.entries(displayApiData)
                    .filter(([k]) => !['id', 'created_date', 'updated_date', 'created_by_id'].includes(k))
                    .map(([key, value]) => {
                      // Esconder campos de ID para voos duplicados
                      if (isDuplicateFlight && (key === 'voo_ligado_id' || key === 'fr24_id')) return null;
                      return (
                        <div key={key} className="text-xs">
                          <span className="font-semibold text-slate-600">{key}:</span>
                          <span className="text-slate-700 ml-1">{String(value) || 'N/A'}</span>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>

          {/* Edição Manual */}
          {editMode && (
            <div className="bg-blue-50 border border-blue-200 rounded p-3 space-y-3">
              <h4 className="font-semibold text-blue-900 text-sm">✏️ Editar Dados</h4>
              {Object.entries({ ...systemData, ...apiData })
                .filter(([k]) => !['id', 'created_date', 'updated_date', 'created_by_id'].includes(k))
                .map(([key, value]) => {
                  // Esconder campos de ID para edição em voos duplicados
                  if (isDuplicateFlight && (key === 'voo_ligado_id' || key === 'fr24_id')) return null;
                  return (
                    <div key={key} className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-700">{key}</Label>
                      <Input
                        type={key.includes('horario') ? 'time' : (key === 'data_operacao' ? 'date' : 'text')}
                        value={editedData[key] !== undefined ? editedData[key] : value}
                        onChange={(e) => handleEditChange(key, e.target.value)}
                        className="text-xs h-8"
                        placeholder={String(value) || 'N/A'}
                      />
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}