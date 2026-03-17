import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Check, ChevronsUpDown, X, Loader2 } from 'lucide-react';
import { cn } from '@/components/lib/utils';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/components/lib/i18n';

export default function AsyncCombobox({
  value,
  onValueChange,
  placeholder = 'Selecione...',
  searchPlaceholder,
  noResultsMessage,
  className,
  id,
  disabled = false,
  maxHeight = '300px',
  useDisplayLabel = false,
  // Funções assíncronas
  onSearch, // Função que recebe searchTerm e retorna Promise<options[]>
  getInitialOption, // Função que recebe value e retorna Promise<option> para mostrar o selecionado
  minSearchLength = 2 // Mínimo de caracteres para iniciar pesquisa
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [options, setOptions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const comboboxRef = useRef(null);
  const searchInputRef = useRef(null);
  const { t } = useI18n();

  const displaySearchPlaceholder = searchPlaceholder || t('ui.digite_pesquisar');
  const displayNoResultsMessage = noResultsMessage || t('ui.nenhum_resultado');

  // Carregar opção inicial quando value muda
  useEffect(() => {
    const loadInitialOption = async () => {
      if (value && getInitialOption && !selectedOption) {
        try {
          const option = await getInitialOption(value);
          if (option) setSelectedOption(option);
        } catch (err) {
          console.error('Erro ao carregar opção inicial:', err);
          setSelectedOption(null);
        }
      } else if (!value) {
        setSelectedOption(null);
      }
    };

    loadInitialOption();
  }, [value, getInitialOption]);

  const displayText = selectedOption
    ? (useDisplayLabel && selectedOption.displayLabel ? selectedOption.displayLabel : selectedOption.label)
    : placeholder;

  // Buscar opções quando searchTerm muda
  useEffect(() => {
    if (!isOpen || !onSearch) return;

    if (searchTerm.length < minSearchLength) {
      setOptions([]);
      return;
    }

    setIsLoading(true);

    const performSearch = async () => {
      try {
        const results = await onSearch(searchTerm);
        setOptions(Array.isArray(results) ? results : []);
      } catch (err) {
        console.error('Erro ao pesquisar:', err);
        setOptions([]);
      } finally {
        setIsLoading(false);
      }
    };

    performSearch();
  }, [searchTerm, isOpen, onSearch, minSearchLength]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (comboboxRef.current && !comboboxRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (optionValue, option) => {
    if (onValueChange) {
      onValueChange(optionValue);
    }
    setSelectedOption(option);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    if (onValueChange) {
      onValueChange('');
    }
    setSelectedOption(null);
    setSearchTerm('');
  };

  if (disabled) {
    return (
      <div className={cn("flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-sm cursor-not-allowed opacity-50", className)}>
        <span className="truncate text-slate-500">{displayText}</span>
        <ChevronsUpDown className="h-4 w-4 opacity-50" />
      </div>
    );
  }

  return (
    <div className={cn("relative w-full", className)} id={id} ref={comboboxRef}>
      <button
        type="button"
        className="flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus:outline-none focus:ring-2 focus:ring-slate-400 text-left"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="truncate">{displayText}</span>
        <div className="flex items-center gap-1">
          {value && (
            <X
              className="h-4 w-4 opacity-50 hover:opacity-100"
              onClick={handleClear}
            />
          )}
          <ChevronsUpDown className={cn("h-4 w-4 opacity-50 transition-transform", isOpen && "rotate-180")} />
        </div>
      </button>

      {isOpen && (
        <div
          className="absolute top-full left-0 z-50 w-full mt-1 rounded-md border border-slate-200 bg-white shadow-lg"
          style={{ maxHeight: maxHeight, overflow: 'hidden' }}
        >
          <div className="p-2 border-b border-slate-200">
            <Input
              ref={searchInputRef}
              type="text"
              placeholder={displaySearchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8"
            />
          </div>

          <div className="overflow-auto" style={{ maxHeight: `calc(${maxHeight} - 56px)` }}>
            {isLoading ? (
              <div className="py-6 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('ui.a_pesquisar')}
              </div>
            ) : searchTerm.length < minSearchLength ? (
              <div className="py-6 text-center text-sm text-slate-500">
                {t('ui.digite_minimo').replace('{min}', String(minSearchLength))}
              </div>
            ) : options.length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-500">
                {displayNoResultsMessage}
              </div>
            ) : (
              options.map((option) => (
                <div
                  key={option.value}
                  className={cn(
                    "relative flex cursor-pointer select-none items-center rounded-sm py-2 pl-8 pr-2 text-sm outline-none hover:bg-slate-100",
                    value === option.value && "bg-slate-50 font-semibold"
                  )}
                  onClick={() => handleSelect(option.value, option)}
                  role="option"
                  aria-selected={value === option.value}
                >
                  <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                    {value === option.value && <Check className="h-4 w-4" />}
                  </span>
                  {option.label}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
