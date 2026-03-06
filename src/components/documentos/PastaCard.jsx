import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { FolderOpen, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PastaCard({ pasta, numSubpastas, numDocumentos, onOpen, onEdit, onDelete, canDelete = true }) {
  return (
    <Card 
      className="group hover:shadow-md transition-all cursor-pointer border border-slate-200 bg-white overflow-hidden"
      onClick={() => onOpen(pasta)}
    >
      <CardContent className="p-0 relative">
        {/* Botões de ação (visíveis no hover) */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          {onEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 bg-white/90 hover:bg-white text-blue-600 hover:text-blue-700 shadow-sm"
              onClick={(e) => { e.stopPropagation(); onEdit(pasta); }}
            >
              <Edit className="w-3.5 h-3.5" />
            </Button>
          )}
          {onDelete && canDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 bg-white/90 hover:bg-white text-red-600 hover:text-red-700 shadow-sm"
              onClick={(e) => { e.stopPropagation(); onDelete(pasta); }}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>

        {/* Ícone da pasta */}
        <div className="flex items-center justify-center py-6 bg-gradient-to-br from-slate-50 to-white">
          <FolderOpen 
            className="w-16 h-16" 
            style={{ color: pasta.cor || '#3b82f6' }}
          />
        </div>
        
        {/* Informações */}
        <div className="p-4 text-center border-t border-slate-100">
          <h3 className="font-semibold text-slate-900 text-sm mb-2 truncate" title={pasta.nome}>
            {pasta.nome}
          </h3>
          
          <div className="flex items-center justify-center gap-3 text-xs text-slate-600">
            {numSubpastas > 0 && (
              <span>{numSubpastas} pasta(s)</span>
            )}
            {numSubpastas > 0 && numDocumentos > 0 && <span>•</span>}
            <span>{numDocumentos} doc(s)</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}