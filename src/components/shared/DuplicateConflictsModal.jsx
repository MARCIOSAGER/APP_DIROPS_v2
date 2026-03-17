import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, PlusCircle, RefreshCw } from 'lucide-react';

export default function DuplicateConflictsModal({ 
  isOpen, 
  onClose, 
  conflictsCount, 
  newRecordsCount, 
  onResolve 
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900 mb-4">
            <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
          </div>
          <DialogTitle className="text-center text-xl">Conflitos de Duplicados Encontrados</DialogTitle>
          <DialogDescription className="text-center text-slate-500 dark:text-slate-400 pt-2">
            O seu ficheiro contém registos que já existem na base de dados. Como deseja proceder?
          </DialogDescription>
        </DialogHeader>
        
        <div className="my-6 space-y-4">
          <div className="flex justify-between items-center bg-green-50 dark:bg-green-950 p-4 rounded-lg border border-green-200 dark:border-green-700">
            <div className="flex items-center gap-3">
              <PlusCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
              <div>
                <p className="font-semibold text-green-800 dark:text-green-200">Novos Registos</p>
                <p className="text-sm text-green-700 dark:text-green-300">Serão adicionados à base de dados.</p>
              </div>
            </div>
            <span className="font-bold text-lg text-green-800 dark:text-green-200">{newRecordsCount}</span>
          </div>
          <div className="flex justify-between items-center bg-yellow-50 dark:bg-yellow-950 p-4 rounded-lg border border-yellow-200 dark:border-yellow-700">
            <div className="flex items-center gap-3">
              <RefreshCw className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              <div>
                <p className="font-semibold text-yellow-800 dark:text-yellow-200">Registos Duplicados</p>
                 <p className="text-sm text-yellow-700 dark:text-yellow-300">Pode ignorá-los ou atualizar os existentes.</p>
              </div>
            </div>
            <span className="font-bold text-lg text-yellow-800 dark:text-yellow-200">{conflictsCount}</span>
          </div>
        </div>

        <DialogFooter className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button 
            variant="outline"
            onClick={() => onResolve('ignore')}
            disabled={newRecordsCount === 0}
            title={newRecordsCount === 0 ? "Nenhum registo novo para importar" : ""}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Ignorar Duplicados ({newRecordsCount} Novos)
          </Button>
          <Button 
            onClick={() => onResolve('update')}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar Existentes ({conflictsCount + newRecordsCount} Total)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}