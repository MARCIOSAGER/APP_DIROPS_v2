import React, { useState, useRef, useEffect, useId } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';
import { cn } from '@/components/lib/utils';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { useI18n } from '@/components/lib/i18n';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 1024 : false));
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
  const [activeIndex, setActiveIndex] = useState(-1);
  const selectRef = useRef(null);
  const triggerRef = useRef(null);
  const searchInputRef = useRef(null);
  const listboxRef = useRef(null);
  const optionRefs = useRef([]);
  const isMobile = useIsMobile();
  const { t } = useI18n();

  const reactId = useId();
  const listboxId = `${reactId}-listbox`;
  const optionId = (i) => `${reactId}-opt-${i}`;

  const selectedOption = options.find(opt => opt.value === value);
  const displayText = selectedOption?.label || placeholder;

  const filteredOptions = searchable && searchTerm
    ? options.filter(opt => opt.label?.toLowerCase().includes(searchTerm.toLowerCase()))
    : options;

  // Fechar ao clicar fora (desktop)
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

  // Ao abrir: foco (input de busca ou a própria listbox) + destacar a opção selecionada
  useEffect(() => {
    if (isOpen) {
      const sel = filteredOptions.findIndex(o => o.value === value);
      setActiveIndex(sel >= 0 ? sel : (filteredOptions.length ? 0 : -1));
      const target = searchable ? searchInputRef : listboxRef;
      const timer = setTimeout(() => target.current?.focus(), 40);
      return () => clearTimeout(timer);
    }
    setActiveIndex(-1);
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Manter o índice ativo válido quando a lista filtrada muda
  useEffect(() => {
    setActiveIndex(i => (filteredOptions.length === 0 ? -1 : Math.min(Math.max(i, 0), filteredOptions.length - 1)));
  }, [searchTerm, filteredOptions.length]);

  // Rolar a opção ativa para a vista
  useEffect(() => {
    if (isOpen && activeIndex >= 0) {
      optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex, isOpen]);

  const close = (returnFocus = true) => {
    setIsOpen(false);
    setSearchTerm('');
    if (returnFocus) setTimeout(() => triggerRef.current?.focus(), 0);
  };

  const handleSelect = (val) => {
    if (onValueChange) onValueChange(val);
    close();
  };

  const moveActive = (delta) => {
    if (!filteredOptions.length) return;
    setActiveIndex(i => {
      const n = filteredOptions.length;
      const start = i < 0 ? (delta > 0 ? -1 : 0) : i;
      return (((start + delta) % n) + n) % n;
    });
  };

  // Navegação por teclado (usada no input de busca e na listbox)
  const onListKeyDown = (e) => {
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); moveActive(1); break;
      case 'ArrowUp': e.preventDefault(); moveActive(-1); break;
      case 'Home': e.preventDefault(); setActiveIndex(filteredOptions.length ? 0 : -1); break;
      case 'End': e.preventDefault(); setActiveIndex(filteredOptions.length - 1); break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && filteredOptions[activeIndex]) handleSelect(filteredOptions[activeIndex].value);
        break;
      case 'Escape': e.preventDefault(); close(); break;
      case 'Tab': close(false); break;
      default: break;
    }
  };

  const onTriggerKeyDown = (e) => {
    if (disabled) return;
    if (!isOpen && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault();
      setIsOpen(true);
    }
  };

  const triggerButton = (
    <button
      ref={triggerRef}
      type="button"
      disabled={disabled}
      className={cn(
        "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        disabled && "opacity-50 cursor-not-allowed"
      )}
      onClick={() => !disabled && setIsOpen(o => !o)}
      onKeyDown={onTriggerKeyDown}
      aria-haspopup="listbox"
      aria-expanded={isOpen}
      aria-controls={isOpen ? listboxId : undefined}
      aria-label={selectedOption ? undefined : placeholder}
    >
      <span className={cn("truncate", !selectedOption && "text-muted-foreground")}>{displayText}</span>
      <ChevronDown className={cn("h-4 w-4 opacity-50 transition-transform shrink-0", isOpen && !isMobile && "rotate-180")} />
    </button>
  );

  const renderOptions = () => (
    <>
      {searchable && (
        <div className="p-2 border-b border-border bg-popover sticky top-0 z-10">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              ref={searchInputRef}
              type="text"
              role="combobox"
              aria-expanded={isOpen}
              aria-controls={listboxId}
              aria-autocomplete="list"
              aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={onListKeyDown}
              placeholder={t('ui.pesquisar')}
              className="w-full pl-8 pr-2 py-1.5 text-sm rounded-md border border-input bg-background text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
      <div
        ref={listboxRef}
        id={listboxId}
        role="listbox"
        tabIndex={searchable ? -1 : 0}
        aria-label={placeholder}
        aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
        onKeyDown={searchable ? undefined : onListKeyDown}
        className={cn("overflow-auto outline-none", isMobile ? "max-h-64" : "max-h-52")}
      >
        {filteredOptions.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">{t('ui.nenhum_resultado')}</div>
        ) : (
          filteredOptions.map((option, idx) => (
            <div
              key={option.value}
              id={optionId(idx)}
              ref={(el) => { optionRefs.current[idx] = el; }}
              role="option"
              aria-selected={value === option.value}
              onClick={() => handleSelect(option.value)}
              onMouseEnter={() => setActiveIndex(idx)}
              className={cn(
                "relative flex cursor-pointer select-none items-center rounded-sm py-2.5 pl-8 pr-2 text-sm outline-none text-popover-foreground",
                idx === activeIndex && "bg-accent text-accent-foreground",
                value === option.value && "font-semibold"
              )}
            >
              <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                {value === option.value && <Check className="h-4 w-4" />}
              </span>
              {/* Texto inteiro: opções longas (nomes de aeroportos, companhias) mudam de linha em vez de serem cortadas. */}
              <span className="min-w-0 whitespace-normal break-words leading-snug" title={option.label}>{option.label}</span>
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
            {renderOptions()}
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
        // Pelo menos a largura do campo, mas pode crescer até 32rem para o texto das opções caber (antes ficava preso à
        // largura do campo e cortava os nomes). Nunca mais largo do que 90% do ecrã.
        <div className="absolute top-full left-0 z-50 mt-1 max-h-60 w-max min-w-full max-w-[min(32rem,90vw)] rounded-md border border-input bg-popover text-popover-foreground shadow-lg flex flex-col">
          {renderOptions()}
        </div>
      )}
    </div>
  );
}
