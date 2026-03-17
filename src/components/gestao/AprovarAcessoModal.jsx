import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle } from 'lucide-react';
import useSubmitGuard from '@/hooks/useSubmitGuard';

const PERFIL_OPTIONS = [
  { value: 'administrador', label: 'Administrador' },
  { value: 'operacoes', label: 'Operações' },
  { value: 'infraestrutura', label: 'Infraestrutura' },
  { value: 'credenciamento', label: 'Credenciamento' },
  { value: 'gestor_empresa', label: 'Gestor de Empresa' }
];

export default function AprovarAcessoModal({ isOpen, onClose, solicitacao, aeroportos, empresas, onSuccess }) {
  const [perfisAprovados, setPerfisAprovados] = useState([]);
  const [aeroportosAprovados, setAeroportosAprovados] = useState([]);
  const [observacoes, setObservacoes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { guardedSubmit } = useSubmitGuard();
  const [empresaId, setEmpresaId] = useState('');

  useEffect(() => {
    if (solicitacao) {
      setPerfisAprovados(solicitacao.perfil_solicitado ? [solicitacao.perfil_solicitado] : []);
      
      // CONVERSÃO CORRETA: Converter códigos ICAO para IDs de aeroportos
      const aeroportosSolicitados = solicitacao.aeroportos_solicitados || [];
      const aeroportosIds = aeroportosSolicitados
        .map(icao => {
          const aeroporto = aeroportos.find(a => a.codigo_icao === icao);
          return aeroporto ? aeroporto.id : null;
        })
        .filter(Boolean); // Remover valores nulos
      
      // Garantir que os IDs são únicos
      setAeroportosAprovados([...new Set(aeroportosIds)]);
      
      setEmpresaId(solicitacao.empresa_solicitante_id || '');
      setObservacoes('');
    }
  }, [solicitacao, aeroportos]);

  const handlePerfilToggle = (perfilValue) => {
    setPerfisAprovados(prev => 
      prev.includes(perfilValue) ? prev.filter(p => p !== perfilValue) : [...prev, perfilValue]
    );
  };

  const handleAeroportoToggle = (aeroportoId) => {
    setAeroportosAprovados(prev => {
      const newList = prev.includes(aeroportoId) 
        ? prev.filter(a => a !== aeroportoId) 
        : [...prev, aeroportoId];
      
      // Garantir que não há duplicatas
      return [...new Set(newList)];
    });
  };

  const handleSelectAllAeroportos = (checked) => {
    if (checked) {
      const filtrados = empresaId ? aeroportos.filter(a => a.empresa_id === empresaId) : aeroportos;
      const allAeroportoIds = [...new Set(filtrados.map(a => a.id))];
      setAeroportosAprovados(allAeroportoIds);
    } else {
      setAeroportosAprovados([]);
    }
  };

  const handleSubmit = async () => {
    if (!solicitacao) return;

    guardedSubmit(async () => {
    setIsSubmitting(true);
    try {
      // Garantir que os aeroportos aprovados são únicos e válidos
      const aeroportosIdUnicos = [...new Set(aeroportosAprovados)].filter(Boolean);
      // CONVERTER IDs PARA CÓDIGOS ICAO antes de enviar
      const aeroportosIcaoCodes = aeroportosIdUnicos.map(id => {
        const aeroporto = aeroportos.find(a => a.id === id);
        return aeroporto ? aeroporto.codigo_icao : null;
      }).filter(Boolean); // Filtrar nulos se algum ID for inválido

      await onSuccess({
        perfis: perfisAprovados,
        aeroportos: [...new Set(aeroportosIcaoCodes)], // Garantir que os códigos ICAO também são únicos
        empresa_id: empresaId,
        observacoes: observacoes
      });
    } catch (error) {
      console.error('Erro no processo de aprovação:', error);
    } finally {
      setIsSubmitting(false);
    }
    });
  };

  if (!solicitacao) return null;

  // Filtrar aeroportos pela empresa selecionada
  const aeroportosFiltrados = empresaId
    ? aeroportos.filter(a => a.empresa_id === empresaId)
    : aeroportos;

  const allAeroportosSelected = aeroportosFiltrados.length > 0 && aeroportosAprovados.length === aeroportosFiltrados.length;
  
  const getEmpresaName = (id) => {
    const empresa = empresas.find(e => e.id === id);
    return empresa ? empresa.nome : 'N/A';
  }
  
  const getAeroportoName = (icaoOuId) => {
    // Aceitar tanto código ICAO quanto ID
    const aeroporto = aeroportos.find(a => a.id === icaoOuId || a.codigo_icao === icaoOuId);
    return aeroporto ? `${aeroporto.nome} (${aeroporto.codigo_icao})` : icaoOuId;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Aprovar Solicitação de Acesso</DialogTitle>
          <DialogDescription>Confirme e ajuste as permissões para o utilizador antes de aprovar.</DialogDescription>
        </DialogHeader>
        
        {/* Adicionado um contêiner com altura máxima e rolagem */}
        <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-4">
          <Alert>
            <AlertTitle>Detalhes da Solicitação</AlertTitle>
            <AlertDescription className="grid grid-cols-2 gap-x-4 gap-y-1">
              <p><strong>Nome:</strong> {solicitacao.nome_completo}</p>
              <p><strong>Email:</strong> {solicitacao.email}</p>
              <p><strong>Perfil Solicitado:</strong> {solicitacao.perfil_solicitado}</p>
              {solicitacao.empresa_solicitante_id && <p><strong>Empresa:</strong> {getEmpresaName(solicitacao.empresa_solicitante_id)}</p>}
              {solicitacao.justificativa ? (
                <p className="col-span-2"><strong>Justificativa:</strong> {solicitacao.justificativa}</p>
              ) : (
                <p className="col-span-2"><strong>Justificativa:</strong> <span className="text-gray-500 italic">Não informada</span></p>
              )}
              <p className="col-span-2"><strong>Aeroportos Solicitados:</strong> {solicitacao.aeroportos_solicitados?.map(icao => getAeroportoName(icao)).join(', ') || 'Nenhum'}</p>
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Perfis a Aprovar</Label>
              <div className="p-3 border rounded-md space-y-2">
                {PERFIL_OPTIONS.map(opt => (
                  <div key={opt.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`perfil-${opt.value}`}
                      checked={perfisAprovados.includes(opt.value)}
                      onCheckedChange={() => handlePerfilToggle(opt.value)}
                    />
                    <label htmlFor={`perfil-${opt.value}`} className="text-sm">{opt.label}</label>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="empresa">Empresa Associada</Label>
              <select
                id="empresa"
                value={empresaId}
                onChange={(e) => { setEmpresaId(e.target.value); setAeroportosAprovados([]); }}
                className="w-full h-10 px-3 py-2 border rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 border-slate-200"
              >
                <option value="">Nenhuma</option>
                {empresas.map(e => (
                    <option key={e.id} value={e.id}>{e.nome}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Aeroportos Aprovados</Label>
            <div className="p-3 border rounded-md max-h-60 overflow-y-auto space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="select-all-aeroportos"
                  checked={allAeroportosSelected}
                  onCheckedChange={handleSelectAllAeroportos}
                />
                <label htmlFor="select-all-aeroportos" className="text-sm font-medium">Selecionar Todos</label>
              </div>
              <hr/>
              {aeroportosFiltrados.map(aero => (
                <div key={aero.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`aeroporto-${aero.id}`}
                    checked={aeroportosAprovados.includes(aero.id)}
                    onCheckedChange={() => handleAeroportoToggle(aero.id)}
                  />
                  <label htmlFor={`aeroporto-${aero.id}`} className="text-sm">{aero.nome} ({aero.codigo_icao})</label>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500">
              {aeroportosAprovados.length} de {aeroportosFiltrados.length} aeroportos selecionados
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações (Opcional)</Label>
            <Textarea 
              id="observacoes"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Notas sobre a aprovação que serão registadas."
            />
          </div>
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || perfisAprovados.length === 0 || aeroportosAprovados.length === 0} 
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            {isSubmitting ? 'A Processar...' : 'Aprovar e Ativar Utilizador'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}