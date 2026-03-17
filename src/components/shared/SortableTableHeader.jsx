import React from 'react';
import { TableHead } from '@/components/ui/table';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/components/lib/utils';

export default function SortableTableHeader({ 
  field, 
  label, 
  currentSortField, 
  currentSortDirection, 
  onSort,
  className 
}) {
  const isSorted = currentSortField === field;
  
  const handleClick = () => {
    if (isSorted) {
      // Se já está ordenado por este campo, inverter a direção
      const newDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
      onSort(field, newDirection);
    } else {
      // Se é um novo campo, começar com ascendente
      onSort(field, 'asc');
    }
  };

  return (
    <TableHead 
      className={cn(
        "cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none",
        className
      )}
      onClick={handleClick}
    >
      <div className="flex items-center gap-2">
        <span>{label}</span>
        {isSorted ? (
          currentSortDirection === 'asc' ? (
            <ArrowUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          ) : (
            <ArrowDown className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          )
        ) : (
          <ArrowUpDown className="w-4 h-4 text-gray-400 dark:text-slate-500" />
        )}
      </div>
    </TableHead>
  );
}