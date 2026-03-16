import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search, X } from 'lucide-react';
import { cn } from '@/components/lib/utils';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 1024);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

export default function Select({
  options = [],
  value,
  onValueChange,
  placeholder = "Selecione...",
  className,
  id,
  disabled,
  searchable = true
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const selectRef = useRef(null);
  const searchInputRef = useRef(null);
  const isMobile = useIsMobile();

  const selectedOption = options.find(opt => opt.value === value);
  const displayText = selectedOption?.label || placeholder;

  const filteredOptions = searchable && searchTerm
    ? options.filter(opt => opt.label?.toLowerCase().includes(searchTerm.toLowerCase()))
    : options;

  useEffect(() => {
    if (!isMobile) {
      const handleClickOutside = (event) => {
        if (selectRef.current && !selectRef.current.contains(event.target)) {
          setIsOpen(false);
          setSearchTerm('');
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isMobile]);

  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen, searchable]);

  const handleSelect = (val) => {
    if (onValueChange) onValueChange(val);
    setIsOpen(false);
    setSearchTerm('');
  };

  const triggerButton = (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus:outline-none focus:ring-2 focus:ring-slate-400 text-left",
        disabled && "opacity-50 cursor-not-allowed bg-slate-100"
      )}
      onClick={() => !disabled && setIsOpen(!isOpen)}
      aria-haspopup="listbox"
      aria-expanded={isOpen}
    >
      <span className="truncate">{displayText}</span>
      <ChevronDown className={cn("h-4 w-4 opacity-50 transition-transform", isOpen && !isMobile && "rotate-180")} />
    </button>
  );

  const optionsList = (
    <>
      {searchable && (
        <div className="p-2 border-b border-slate-200 bg-white sticky top-0">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Pesquisar..."
              className="w-full pl-8 pr-2 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
      <div className={cn("overflow-auto", isMobile ? "max-h-64" : "max-h-52")}>
        {filteredOptions.length === 0 ? (
          <div className="py-6 text-center text-sm text-slate-500">Nenhum resultado encontrado</div>
        ) : (
          filteredOptions.map((option) => (
            <div
              key={option.value}
              className={cn(
                "relative flex cursor-pointer select-none items-center rounded-sm py-3 pl-8 pr-2 text-sm outline-none hover:bg-slate-100 active:bg-slate-200",
                value === option.value && "font-semibold bg-slate-50"
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
    <div className={cn("relative w-full", className)} id={id} ref={selectRef}>
      {triggerButton}
      {isOpen && (
        <div className="absolute top-full left-0 z-50 min-w-full w-max mt-1 max-h-60 rounded-md border border-slate-200 bg-white shadow-lg flex flex-col">
          {optionsList}
        </div>
      )}
    </div>
  );
}