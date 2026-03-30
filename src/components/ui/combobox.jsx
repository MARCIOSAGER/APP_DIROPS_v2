import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/components/lib/utils';
import { Input } from '@/components/ui/input';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { useI18n } from '@/components/lib/i18n';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 1024);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

export default function Combobox({
  options = [],
  value,
  onValueChange,
  placeholder = 'Selecione...',
  searchPlaceholder,
  noResultsMessage,
  className,
  id,
  disabled = false,
  maxHeight = '300px',
  useDisplayLabel = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const comboboxRef = useRef(null);
  const searchInputRef = useRef(null);
  const isMobile = useIsMobile();
  const { t } = useI18n();

  const displaySearchPlaceholder = searchPlaceholder || t('ui.pesquisar');
  const displayNoResultsMessage = noResultsMessage || t('ui.nenhum_resultado');

  const selectedOption = options.find(opt => opt.value === value);
  const displayText = selectedOption
    ? (useDisplayLabel && selectedOption.displayLabel ? selectedOption.displayLabel : selectedOption.label)
    : placeholder;

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    const searchLower = searchTerm.toLowerCase();
    return options.filter(option => option.label.toLowerCase().includes(searchLower));
  }, [options, searchTerm]);

  useEffect(() => {
    if (!isMobile) {
      const handleClickOutside = (event) => {
        if (comboboxRef.current && !comboboxRef.current.contains(event.target)) {
          setIsOpen(false);
          setSearchTerm('');
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isMobile]);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSelect = (optionValue) => {
    if (onValueChange) onValueChange(optionValue);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    if (onValueChange) onValueChange('');
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

  const triggerButton = (
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
          <X className="h-4 w-4 opacity-50 hover:opacity-100" onClick={handleClear} />
        )}
        <ChevronsUpDown className={cn("h-4 w-4 opacity-50 transition-transform", isOpen && !isMobile && "rotate-180")} />
      </div>
    </button>
  );

  const optionsList = (
    <>
      <div className="p-2 border-b border-slate-200 bg-white sticky top-0">
        <Input
          ref={searchInputRef}
          type="text"
          placeholder={displaySearchPlaceholder}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="h-8"
        />
      </div>
      <div className={cn("overflow-auto", isMobile ? "max-h-64" : "")} style={!isMobile ? { maxHeight: `calc(${maxHeight} - 56px)` } : {}}>
        {filteredOptions.length === 0 ? (
          <div className="py-6 text-center text-sm text-slate-500">{displayNoResultsMessage}</div>
        ) : (
          filteredOptions.slice(0, 200).map((option) => (
            <div
              key={option.value}
              className={cn(
                "relative flex cursor-pointer select-none items-center rounded-sm py-3 pl-8 pr-2 text-sm outline-none hover:bg-slate-100 active:bg-slate-200",
                value === option.value && "bg-slate-50 font-semibold"
              )}
              onClick={() => handleSelect(option.value)}
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
        {filteredOptions.length > 200 && (
          <div className="py-2 px-4 text-center text-xs text-slate-500 bg-slate-50 border-t">
            {t('ui.mostrando_resultados').replace('{total}', String(filteredOptions.length))}
          </div>
        )}
      </div>
    </>
  );

  if (isMobile) {
    return (
      <div className={cn("relative w-full", className)} id={id}>
        {triggerButton}
        <Drawer open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) setSearchTerm(''); }}>
          <DrawerContent className="max-h-[80vh]">
            <DrawerHeader className="pb-0">
              <DrawerTitle className="text-base">{placeholder}</DrawerTitle>
            </DrawerHeader>
            {optionsList}
            <div style={{ height: 'env(safe-area-inset-bottom)' }} />
          </DrawerContent>
        </Drawer>
      </div>
    );
  }

  return (
    <div className={cn("relative w-full", className)} id={id} ref={comboboxRef}>
      {triggerButton}
      {isOpen && (
        <div
          className="absolute top-full left-0 z-50 w-full mt-1 rounded-md border border-slate-200 bg-white shadow-lg"
          style={{ maxHeight, overflow: 'hidden' }}
        >
          {optionsList}
        </div>
      )}
    </div>
  );
}
