import React, { useState, useRef, useEffect } from 'react';
import { X, ChevronDown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AEROPORTOS_ANGOLA } from '@/components/lib/aeroportosAngola';
import { useI18n } from '@/components/lib/i18n';

export default function AeroportoMultiSelect({ aeroportos = AEROPORTOS_ANGOLA, values = [], onValuesChange, placeholder, maxItems = 23 }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const { t } = useI18n();

  const displayPlaceholder = placeholder || t('ui.selecionar_aeroportos');

  // Fechar dropdown quando clicar fora
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focar input de pesquisa quando abre
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Filtrar aeroportos baseado na pesquisa
  const filteredAeroportos = aeroportos.filter(a =>
    a.codigo_icao.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggle = (codigoIcao) => {
    let newValues;
    if (values.includes(codigoIcao)) {
      newValues = values.filter(v => v !== codigoIcao);
    } else {
      if (values.length < maxItems) {
        newValues = [...values, codigoIcao];
      } else {
        return; // Não adicionar se atingiu o limite
      }
    }
    onValuesChange(newValues);
  };

  const handleClear = (codigoIcao, e) => {
    e.stopPropagation();
    onValuesChange(values.filter(v => v !== codigoIcao));
  };

  const handleClearAll = (e) => {
    e.stopPropagation();
    onValuesChange([]);
  };

  const selectedAeroportos = aeroportos.filter(a => values.includes(a.codigo_icao));

  const allSelected = aeroportos.length > 0 && values.length === aeroportos.length;

  const handleSelectAll = (e) => {
    e.stopPropagation();
    onValuesChange(aeroportos.map(a => a.codigo_icao));
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <Button
        variant="outline"
        className="w-full justify-between bg-white hover:bg-slate-50"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2 flex-wrap">
          {selectedAeroportos.length > 0 ? (
            <>
              {selectedAeroportos.slice(0, 2).map(a => (
                <span key={a.codigo_icao} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                  {a.codigo_icao}
                </span>
              ))}
              {selectedAeroportos.length > 2 && (
                <span className="text-xs text-slate-500">+{selectedAeroportos.length - 2}</span>
              )}
            </>
          ) : (
            <span className="text-slate-400">{displayPlaceholder}</span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </Button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-lg shadow-lg">
          {/* Search Input */}
          <div className="p-3 border-b border-slate-200">
            <Input
              ref={searchInputRef}
              placeholder={t('ui.pesquisar_icao_nome')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="text-sm"
            />
          </div>

          {/* Select All Option */}
          {filteredAeroportos.length === aeroportos.length && aeroportos.length > 1 && (
            <div
              className="flex items-center justify-between p-2 hover:bg-slate-100 rounded cursor-pointer border-b border-slate-200"
              onClick={handleSelectAll}
            >
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => {}}
                  className="w-4 h-4 rounded border-slate-300"
                />
                <div className="text-sm font-medium text-slate-900">{t('ui.selecionar_todos')}</div>
              </div>
              {allSelected && <Check className="w-4 h-4 text-green-600" />}
            </div>
          )}

          {/* Options List */}
          <div className="max-h-64 overflow-y-auto p-2">
            {filteredAeroportos.length > 0 ? (
              filteredAeroportos.map(a => (
                <div
                  key={a.codigo_icao}
                  className="flex items-center justify-between p-2 hover:bg-slate-100 rounded cursor-pointer"
                  onClick={() => handleToggle(a.codigo_icao)}
                >
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="checkbox"
                      checked={values.includes(a.codigo_icao)}
                      onChange={() => {}}
                      className="w-4 h-4 rounded border-slate-300"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-slate-900">{a.codigo_icao}</div>
                      <div className="text-xs text-slate-500">{a.nome}</div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-4 text-slate-500 text-sm">
                {t('ui.nenhum_aeroporto')}
              </div>
            )}
          </div>

          {/* Clear All Button */}
          {selectedAeroportos.length > 0 && (
            <div className="border-t border-slate-200 p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-red-600 hover:bg-red-50 hover:text-red-700 text-xs"
                onClick={handleClearAll}
              >
                <X className="w-3 h-3 mr-1" />
                {t('ui.limpar_tudo')} ({selectedAeroportos.length})
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
