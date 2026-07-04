import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';

// Input de busca com debounce. Mantém o texto responsivo localmente (sem lag ao
// digitar) e só propaga o valor para o pai (onCommit) após `delay` ms sem
// digitação. Evita re-filtrar/re-ordenar milhares de linhas a cada tecla.
export default function DebouncedSearchInput({ value = '', onCommit, delay = 300, ...props }) {
  const [local, setLocal] = useState(value);
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;

  // Reflete mudanças externas do valor (ex.: "Limpar filtros" zera a busca).
  useEffect(() => { setLocal(value); }, [value]);

  // Debounce: propaga local -> pai só quando difere e após a pausa.
  useEffect(() => {
    if (local === value) return;
    const id = setTimeout(() => commitRef.current(local), delay);
    return () => clearTimeout(id);
  }, [local, value, delay]);

  return <Input {...props} value={local} onChange={(e) => setLocal(e.target.value)} />;
}
