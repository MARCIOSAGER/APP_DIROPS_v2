import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Upload, Download, AlertCircle } from 'lucide-react';
import DuplicateConflictsModal from './DuplicateConflictsModal';
import { normalizeCode } from '@/components/lib/utils'; // Import the new utility function

// Import all entities statically to avoid dynamic import issues
import { Aeroporto } from '@/entities/Aeroporto';
import { CompanhiaAerea } from '@/entities/CompanhiaAerea';
import { ModeloAeronave } from '@/entities/ModeloAeronave';
import { RegistoAeronave } from '@/entities/RegistoAeronave';

// More robust CSV parser function
const parseCSV = (text) => {
  const lines = text.trim().split('\n').filter(line => line.trim());
  if (lines.length === 0) return { headers: [], data: [] };

  // Heuristic to detect delimiter: if ';' is present in the first line, use it, otherwise use ','
  const headerLine = lines[0];
  const delimiter = headerLine.includes(';') ? ';' : ',';
  
  const headers = headerLine.split(delimiter).map(h => h.trim().replace(/"/g, ''));
  const data = lines.slice(1).map(line => {
    // Escape quotes before splitting if the delimiter is within quoted fields
    const values = line.split(delimiter).map(v => v.trim().replace(/"/g, ''));
    const row = {};
    headers.forEach((header, index) => {
        // Ensure header exists before assigning
        if (headers[index]) {
            row[headers[index]] = values[index] || '';
        }
    });
    return row;
  });
  
  return { headers, data };
};

export default function UploadCsvModal({ 
  isOpen, 
  onClose, 
  entityName, 
  entitySchema, 
  templateHeaders, 
  onImportComplete,
  uniqueKeyField = null 
}) {
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [conflicts, setConflicts] = useState([]);
  const [newRecords, setNewRecords] = useState([]);
  const [existingRecords, setExistingRecords] = useState([]);
  const [showConflictsModal, setShowConflictsModal] = useState(false);
  const [processProgress, setProcessProgress] = useState({ current: 0, total: 0 });

  const getEntity = (name) => {
    const entities = {
      'Aeroporto': Aeroporto,
      'CompanhiaAerea': CompanhiaAerea,
      'ModeloAeronave': ModeloAeronave,
      'RegistoAeronave': RegistoAeronave
    };
    return entities[name];
  };

  useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setError('');
      setConflicts([]);
      setNewRecords([]);
      setExistingRecords([]);
      setIsProcessing(false);
      setShowConflictsModal(false);
      setProcessProgress({ current: 0, total: 0 });
    }
  }, [isOpen]);

  // Função para calcular o AC Code baseado na envergadura
  const calculateAcCode = (envergadura) => {
    if (!envergadura || envergadura <= 0) return '';
    
    if (envergadura <= 15) return 'A';
    if (envergadura <= 24) return 'B';
    if (envergadura <= 36) return 'C';
    if (envergadura <= 52) return 'D';
    if (envergadura <= 65) return 'E';
    if (envergadura <= 80) return 'F';
    
    return 'F';
  };

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile && (selectedFile.type === 'text/csv' || selectedFile.name.endsWith('.csv'))) {
      setFile(selectedFile);
      setError('');
    } else {
      setError('Por favor, selecione um ficheiro CSV válido.');
      setFile(null);
    }
  };

  const downloadTemplate = () => {
    let headersToUse = templateHeaders;
    let csvContent;
    
    // Para ModeloAeronave, criar template personalizado sem AC Code
    if (entityName === 'ModeloAeronave') {
      headersToUse = templateHeaders.filter(header => header !== 'ac_code');
      // Adicionar exemplo com comentário explicativo
      csvContent = headersToUse.join(',') + '\n' + 
        '# Exemplo: Nome_Modelo,Codigo_ICAO,Codigo_IATA,MTOW_kg,Envergadura_m,Comprimento_m\n' +
        '# O código AC será calculado automaticamente baseado na envergadura\n' +
        '# Regras AC Code: A(≤15m), B(15-24m), C(24-36m), D(36-52m), E(52-65m), F(65-80m+)';
    } else {
      csvContent = headersToUse.join(',') + '\n';
    }
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${entityName}_template.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const processAndValidateData = async () => {
    if (!file) {
      setError('Por favor, selecione um ficheiro.');
      return;
    }
    
    setIsProcessing(true);
    setError('');

    try {
      const Entity = getEntity(entityName);
      if (!Entity) throw new Error(`Entidade ${entityName} não encontrada.`);

      const existingData = await Entity.list();
      setExistingRecords(existingData);

      const uniqueFieldIdentifier = uniqueKeyField || Object.keys(entitySchema.properties).find(key => 
        key.includes('codigo_iata') || key.includes('registo') || key.includes('codigo_icao')
      );
      if (!uniqueFieldIdentifier) throw new Error(`Campo único não definido para ${entityName}.`);

      const text = await file.text();
      const { data: parsedData } = parseCSV(text);

      if (parsedData.length === 0) {
        setError("O ficheiro está vazio ou mal formatado.");
        setIsProcessing(false);
        return;
      }
      
      const numericFields = Object.keys(entitySchema.properties).filter(key => entitySchema.properties[key].type === 'number');
      const requiredFields = entitySchema.required || [];

      const recordsToProcess = parsedData.map(row => {
          const processedRow = { ...row };
          
          // Handle field name mapping if 'comprimento' is used instead of 'comprimento_m'
          if (processedRow.hasOwnProperty('comprimento') && !processedRow.hasOwnProperty('comprimento_m')) {
              processedRow['comprimento_m'] = processedRow['comprimento'];
              delete processedRow['comprimento'];
          }
          
          // Process numeric fields with improved decimal handling
          numericFields.forEach(field => {
              if (processedRow.hasOwnProperty(field)) {
                  let value = processedRow[field];
                  
                  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
                      processedRow[field] = null; // Set to null if empty, required check comes later
                  } else if (typeof value === 'string') {
                      let cleanedValue = value.trim();
                      
                      // Handle different decimal separators
                      if (cleanedValue.includes(',') && !cleanedValue.includes('.')) {
                          cleanedValue = cleanedValue.replace(',', '.');
                      } else if (cleanedValue.includes(',')) { // If it contains comma and dot, treat dot as thousands, comma as decimal
                          cleanedValue = cleanedValue.replace(/\./g, '').replace(',', '.');
                      }
                      
                      const parsedNumber = parseFloat(cleanedValue);
                      processedRow[field] = isNaN(parsedNumber) ? null : parsedNumber;
                  } else if (typeof value === 'number') {
                      processedRow[field] = value;
                  }
              }
          });
          
          // SEMPRE calcular AC Code automaticamente para ModeloAeronave, independentemente do CSV
          if (entityName === 'ModeloAeronave' && processedRow.envergadura_m !== null && processedRow.envergadura_m !== undefined) {
            processedRow.ac_code = calculateAcCode(processedRow.envergadura_m);
          }

          // Para RegistoAeronave, adicionar o campo normalizado
          if (entityName === 'RegistoAeronave' && processedRow.registo) {
            processedRow.registo_normalizado = normalizeCode(processedRow.registo);
          }
          
          return processedRow;
      });

      // --- Validação de Duplicados Estritos (bloqueia importação) ---
      // Para todas as entidades, verificar duplicados dentro do CSV e contra dados existentes
      const getUniqueKeyValue = (record) => {
        if (entityName === 'RegistoAeronave') return record.registo ? normalizeCode(record.registo) : null;
        if (entityName === 'Aeroporto') return record.codigo_icao?.trim().toUpperCase() || null;
        if (entityName === 'CompanhiaAerea') return record.codigo_icao?.trim().toUpperCase() || null;
        if (entityName === 'ModeloAeronave') return record.codigo_iata?.trim().toUpperCase() || null;
        return null;
      };

      const getExistingKeyValue = (record) => {
        if (entityName === 'RegistoAeronave') return record.registo ? normalizeCode(record.registo) : null;
        if (entityName === 'Aeroporto') return record.codigo_icao?.trim().toUpperCase() || null;
        if (entityName === 'CompanhiaAerea') return record.codigo_icao?.trim().toUpperCase() || null;
        if (entityName === 'ModeloAeronave') return record.codigo_iata?.trim().toUpperCase() || null;
        return null;
      };

      const existingKeys = new Set(existingData.map(getExistingKeyValue).filter(Boolean));
      const csvKeys = new Set();
      const strictDuplicates = [];

      for (const record of recordsToProcess) {
        const key = getUniqueKeyValue(record);
        if (!key) continue;

        if (existingKeys.has(key)) {
          strictDuplicates.push({ key, motivo: 'Já existe no sistema' });
        } else if (csvKeys.has(key)) {
          strictDuplicates.push({ key, motivo: 'Duplicado no ficheiro CSV' });
        } else {
          csvKeys.add(key);
        }
      }

      if (strictDuplicates.length > 0) {
        setError(`❌ ${strictDuplicates.length} duplicado(s) encontrado(s) que impedem a importação:\n\n${strictDuplicates.slice(0, 10).map(d => `• ${d.key} (${d.motivo})`).join('\n')}${strictDuplicates.length > 10 ? `\n... e mais ${strictDuplicates.length - 10}` : ''}\n\nPor favor, remova os duplicados e tente novamente.`);
        setIsProcessing(false);
        return;
      }
      // --- Fim da Validação de Duplicados ---


      const localConflicts = [];
      const localNewRecords = [];

      // Check for duplicates against existing data using the uniqueFieldIdentifier
      // This will still run for RegistoAeronave, but the stricter normalizeCode check already passed.
      recordsToProcess.forEach(row => {
        const uniqueValue = row[uniqueFieldIdentifier];
        if (uniqueValue) {
            const isDuplicate = existingData.some(
              (existing) => existing[uniqueFieldIdentifier] && 
                            String(existing[uniqueFieldIdentifier]).toLowerCase() === String(uniqueValue).toLowerCase()
            );

            if (isDuplicate) localConflicts.push(row);
            else localNewRecords.push(row);
        } else {
            console.warn(`Record missing unique identifier (${uniqueFieldIdentifier}):`, row);
            localNewRecords.push(row); 
        }
      });

      setConflicts(localConflicts);
      setNewRecords(localNewRecords);

      if (localConflicts.length > 0) {
        setShowConflictsModal(true);
      } else { // If no conflicts, proceed directly to import new records
        await handleImport(localNewRecords, []);
      }
      
    } catch (err) {
      console.error('Erro ao processar o ficheiro:', err);
      setError(`Ocorreu um erro: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Helper for validating required fields
  const validateRecordForImport = (record, isUpdate = false) => {
    const requiredFields = entitySchema.required || [];
    const missingFields = requiredFields.filter(field => {
        if (isUpdate && record[field] === undefined) {
            // For updates, if a required field is not present in the CSV row, we assume the existing value
            // We only flag if the field is explicitly set to null/empty in the CSV AND it's required.
            return false;
        }
        return record[field] === null || record[field] === undefined || (typeof record[field] === 'string' && record[field].trim() === '');
    });

    if (missingFields.length > 0) {
        return `Campos obrigatórios ausentes: ${missingFields.join(', ')}`;
    }
    return null; // No errors
  };


  const handleImport = async (recordsToCreate, recordsToUpdate) => {
    setIsProcessing(true);
    setProcessProgress({ current: 0, total: recordsToCreate.length + recordsToUpdate.length });
    
    try {
      const Entity = getEntity(entityName);
      if (!Entity) throw new Error(`Entidade ${entityName} não encontrada.`);
      
      let successCount = 0;
      let errorCount = 0;
      const importErrors = []; // Collect detailed errors for final message
      let processedRecordsCurrent = 0;

      const uniqueFieldIdentifier = uniqueKeyField || Object.keys(entitySchema.properties).find(key => 
        key.includes('codigo_iata') || key.includes('registo') || key.includes('codigo_icao')
      );
      if (!uniqueFieldIdentifier) throw new Error(`Campo único não definido para ${entityName}.`);


      // Helper to update progress
      const updateProgress = () => {
          processedRecordsCurrent++;
          setProcessProgress(prev => ({ ...prev, current: processedRecordsCurrent }));
      };

      // --- Process recordsToCreate (CREATE) ---
      if (recordsToCreate.length > 0) {
        // Prepare records for bulk creation: validate and filter
        const validRecordsForCreate = [];
        for (const record of recordsToCreate) {
            const validationError = validateRecordForImport(record, false); // isUpdate = false
            if (validationError) {
                importErrors.push(`Erro de validação ao criar (${record[uniqueFieldIdentifier] || 'N/A'}): ${validationError}`);
                errorCount++;
                updateProgress();
                continue; // Skip this record from bulk/individual creation attempt
            }
            validRecordsForCreate.push(record);
        }
        
        if (validRecordsForCreate.length > 0) {
          try {
            const created = await Entity.bulkCreate(validRecordsForCreate);
            successCount += created.length || validRecordsForCreate.length;
            for (let i = 0; i < validRecordsForCreate.length; i++) updateProgress();
          } catch (bulkError) {
            console.warn('Erro ao criar registos em massa. Tentando criação individual:', bulkError);
            // Fallback to individual creation if bulk fails
            for (const record of validRecordsForCreate) {
              try {
                await Entity.create(record);
                successCount++;
              } catch (err) {
                console.error('Erro ao criar registo individual:', err);
                importErrors.push(`Erro ao criar o registo (${record[uniqueFieldIdentifier] || 'N/A'}): ${err.message}`);
                errorCount++;
              }
              updateProgress();
              // Add a small delay for individual fallback creations to avoid overwhelming the server
              await new Promise(resolve => setTimeout(resolve, 50)); 
            }
          }
        }
      }

      // --- Process recordsToUpdate (UPDATE) ---
      if (recordsToUpdate.length > 0) {
        const batchSize = 20; // Larger batches for updates
        const existingDataMap = new Map(existingRecords.map(r => [String(r[uniqueFieldIdentifier]).toLowerCase(), r])); // Use map for faster lookup
        
        for (let i = 0; i < recordsToUpdate.length; i += batchSize) {
          const batch = recordsToUpdate.slice(i, i + batchSize);
          const promises = [];
          
          for (const record of batch) {
            const validationError = validateRecordForImport(record, true); // isUpdate = true
            if (validationError) {
                importErrors.push(`Erro de validação ao actualizar (${record[uniqueFieldIdentifier] || 'N/A'}): ${validationError}`);
                errorCount++;
                updateProgress();
                continue; // Skip this record from update attempt
            }

            const existingRecordMatch = existingDataMap.get(String(record[uniqueFieldIdentifier]).toLowerCase());
            
            if (existingRecordMatch) {
              promises.push(
                Entity.update(existingRecordMatch.id, record)
                  .then(() => {
                    successCount++;
                  })
                  .catch((error) => {
                    console.error(`Erro ao actualizar registo com ${uniqueFieldIdentifier} ${record[uniqueFieldIdentifier]}:`, error);
                    importErrors.push(`Erro ao actualizar o registo (${record[uniqueFieldIdentifier]}): ${error.message}`);
                    errorCount++;
                  })
                  .finally(() => { // Ensure progress is updated even if a promise fails
                    updateProgress();
                  })
              );
            } else {
              // If record from conflicts (CSV) doesn't exist in fetched 'existingRecords', it's an error.
              console.warn(`Registo de conflito não encontrado para actualização (possivelmente já eliminado): ${uniqueFieldIdentifier}: ${record[uniqueFieldIdentifier]}`);
              importErrors.push(`Registo a actualizar não encontrado (${record[uniqueFieldIdentifier]}). Foi eliminado?`);
              errorCount++;
              updateProgress(); // Still count as processed for progress bar
            }
          }
          
          await Promise.allSettled(promises); // Wait for all promises in the batch
          
          // Small delay only between batches, not between individual records
          if (i + batchSize < recordsToUpdate.length) {
            await new Promise(resolve => setTimeout(resolve, 200)); 
          }
        }
      }

      // Final message generation based on outline
      let message = `Importação concluída!\n\n`;
      message += `✅ ${successCount} registo(s) processado(s) com sucesso\n`;
      if (errorCount > 0) {
        message += `❌ ${errorCount} registo(s) com erro\n`;
      }
      if (importErrors.length > 0) {
        message += `\nDetalhes dos erros (primeiros 5):\n${importErrors.slice(0, 5).join('\n')}`;
        if (importErrors.length > 5) {
          message += `\n... e mais ${importErrors.length - 5} erros`;
        }
      }

      setIsProcessing(false); // Set processing to false before calling onImportComplete
      onImportComplete({
        type: errorCount > 0 ? (successCount > 0 ? 'warning' : 'error') : 'success',
        text: message
      });
      onClose(); // Close the main dialog only after everything is done and message shown

    } catch (error) {
      console.error('Erro geral na importação:', error);
      setIsProcessing(false); // Set processing to false on critical error
      onImportComplete({
        type: 'error',
        text: `Erro geral na importação: ${error.message}`
      });
      onClose(); // Close on critical error
    } finally {
      setProcessProgress({ current: 0, total: 0 }); // Always reset progress on finish/error
    }
  };

  const handleConflictResolution = (importChoice) => {
    setShowConflictsModal(false);
    if (importChoice === 'ignore') {
      handleImport(newRecords, []); // Only import new records, ignore conflicts
    } else if (importChoice === 'update') {
      handleImport(newRecords, conflicts); // Import new records and update conflicts
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar {entityName} via CSV</DialogTitle>
        </DialogHeader>

        {showConflictsModal ? (
          <DuplicateConflictsModal
            isOpen={true} // It's "open" because it's rendered inside the main Dialog
            onCancel={() => { 
              setShowConflictsModal(false);
              setIsProcessing(false); // Reset processing if user cancels conflicts
              setProcessProgress({ current: 0, total: 0 }); // Reset progress
            }}
            conflictsCount={conflicts.length} 
            newRecordsCount={newRecords.length}
            onResolve={handleConflictResolution} 
          />
        ) : (
          <div className="space-y-4"> 
            {error && (
              <Alert> 
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Erro</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="csv-file">Selecionar ficheiro CSV</Label> 
              <Input
                id="csv-file"
                type="file"
                accept=".csv" 
                onChange={handleFileChange}
                disabled={isProcessing}
              />
            </div>

            {isProcessing && processProgress.total > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>A processar...</span> 
                  <span>{processProgress.current} de {processProgress.total}</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${(processProgress.current / processProgress.total) * 100}%` }}
                  ></div>
                </div>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={downloadTemplate} disabled={isProcessing}>
                <Download className="w-4 h-4 mr-2" />
                Template CSV 
              </Button>
              
              <div className="space-x-2">
                <Button variant="outline" onClick={onClose} disabled={isProcessing}>
                  Cancelar
                </Button>
                <Button onClick={processAndValidateData} disabled={!file || isProcessing}>
                  <Upload className="w-4 h-4 mr-2" /> 
                  {isProcessing ? 'A Processar...' : 'Importar'} 
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}