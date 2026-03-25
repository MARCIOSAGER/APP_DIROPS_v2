import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Layers, DollarSign, Trash2 } from 'lucide-react';
import { ServicoVoo } from '@/entities/ServicoVoo';
import { OutraTarifa } from '@/entities/OutraTarifa';
import { useCompanyView } from '@/lib/CompanyViewContext';
import { useI18n } from '@/components/lib/i18n';

// Tipos automáticos (já calculados pelo tariffCalculations.jsx) — NÃO mostrar aqui
// TODOS os tipos de outra_tarifa são automáticos (calculados pelo tariffCalculations.jsx)
const TIPOS_AUTOMATICOS = ['embarque', 'transito_direto', 'transito_transbordo', 'carga', 'seguranca', 'iluminacao', 'cuppss', 'checkin', 'fast_track', 'assistencia_especial', 'assistencia_bagagem', 'brs'];

const UNIDADE_LABELS = {
  passageiro: 'Nº Passageiros',
  bagagem: 'Nº Bagagens',
  balcao_hora: 'Balcões × Horas',
  voo: 'Qtd',
  fixa: 'Qtd',
};

export default function ServicosVooModal({ isOpen, onClose, vooLigado, voos, aeroportos, tiposOutraTarifa, onServicesSaved }) {
  const { t } = useI18n();
  const { effectiveEmpresaId } = useCompanyView();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [outrasTarifas, setOutrasTarifas] = useState([]);
  const [servicos, setServicos] = useState([]); // [{tipo_servico, quantidade, valor_unitario_usd, valor_total_usd, outra_tarifa_id, unidade, id?}]

  // Flight info for header
  const flightInfo = useMemo(() => {
    if (!vooLigado || !voos) return null;
    const vooArr = voos.find(v => v.id === vooLigado.id_voo_arr);
    const vooDep = voos.find(v => v.id === vooLigado.id_voo_dep);
    return {
      arr: vooArr?.numero_voo || '?',
      dep: vooDep?.numero_voo || '?',
      registo: vooArr?.registo_aeronave || vooDep?.registo_aeronave || '?',
      data: vooArr?.data_operacao || '',
      paxDep: vooDep?.passageiros_local || 0,
      bagagemDep: vooDep?.bagagem_total || 0,
    };
  }, [vooLigado, voos]);

  // Airport category
  const aeroportoCategoria = useMemo(() => {
    if (!vooLigado || !voos || !aeroportos) return null;
    const vooArr = voos.find(v => v.id === vooLigado.id_voo_arr);
    if (!vooArr) return null;
    const aero = aeroportos.find(a => a.codigo_icao === vooArr.aeroporto_operacao);
    return aero?.categoria || null;
  }, [vooLigado, voos, aeroportos]);

  // Tipo operação (doméstica/internacional)
  const tipoOperacao = useMemo(() => {
    if (!vooLigado || !voos) return null;
    const vooArr = voos.find(v => v.id === vooLigado.id_voo_arr);
    const tipo = vooArr?.tipo_voo || '';
    if (tipo.toLowerCase().includes('dom')) return 'domestica';
    if (tipo.toLowerCase().includes('int')) return 'internacional';
    return 'ambos';
  }, [vooLigado, voos]);

  // Available service types (from tipo_outra_tarifa, excluding automatic ones)
  const tiposDisponiveis = useMemo(() => {
    if (!tiposOutraTarifa) return [];
    return tiposOutraTarifa.filter(t => !TIPOS_AUTOMATICOS.includes(t.value) && t.status === 'ativa');
  }, [tiposOutraTarifa]);

  // Load data
  useEffect(() => {
    if (!isOpen || !vooLigado) return;
    setIsLoading(true);
    Promise.all([
      ServicoVoo.filter({ voo_ligado_id: vooLigado.id }),
      OutraTarifa.filter({ status: 'ativa' }),
    ]).then(([existingServicos, tarifas]) => {
      // Filter tarifas by empresa
      if (effectiveEmpresaId) {
        const empresaTarifas = tarifas.filter(t => t.empresa_id === effectiveEmpresaId);
        const globalTarifas = tarifas.filter(t => !t.empresa_id);
        setOutrasTarifas(empresaTarifas.length > 0 ? empresaTarifas : globalTarifas);
      } else {
        setOutrasTarifas(tarifas);
      }
      // Map existing services
      if (existingServicos && existingServicos.length > 0) {
        setServicos(existingServicos.map(s => ({
          id: s.id,
          tipo_servico: s.tipo_servico,
          quantidade: Number(s.quantidade) || 0,
          valor_unitario_usd: Number(s.valor_unitario_usd) || 0,
          valor_total_usd: Number(s.valor_total_usd) || 0,
          outra_tarifa_id: s.outra_tarifa_id,
          unidade: s.unidade || 'passageiro',
        })));
      } else {
        setServicos([]);
      }
    }).catch(err => {
      console.error('Erro ao carregar serviços:', err);
      setServicos([]);
    }).finally(() => setIsLoading(false));
  }, [isOpen, vooLigado, effectiveEmpresaId]);

  // Find tariff for a given type
  const findTarifa = (tipo) => {
    return outrasTarifas.find(t =>
      t.tipo === tipo &&
      (!aeroportoCategoria || t.categoria_aeroporto === aeroportoCategoria) &&
      (t.tipo_operacao === 'ambos' || t.tipo_operacao === tipoOperacao)
    ) || outrasTarifas.find(t =>
      t.tipo === tipo &&
      t.tipo_operacao === 'ambos'
    ) || null;
  };

  const handleAddServico = (tipo) => {
    const tarifa = findTarifa(tipo.value);
    const tipoInfo = tiposDisponiveis.find(t => t.value === tipo.value);
    const unidade = tipoInfo?.unidade_padrao || 'passageiro';

    // Auto-suggest quantity
    let qtdSugerida = 0;
    if (unidade === 'passageiro') qtdSugerida = flightInfo?.paxDep || 0;
    else if (unidade === 'bagagem') qtdSugerida = flightInfo?.bagagemDep || 0;
    else if (unidade === 'voo' || unidade === 'fixa') qtdSugerida = 1;

    const valorUnit = tarifa ? Number(tarifa.valor) : 0;
    setServicos(prev => [...prev, {
      tipo_servico: tipo.value,
      quantidade: qtdSugerida,
      valor_unitario_usd: valorUnit,
      valor_total_usd: parseFloat((qtdSugerida * valorUnit).toFixed(2)),
      outra_tarifa_id: tarifa?.id || null,
      unidade,
    }]);
  };

  const handleUpdateServico = (index, field, value) => {
    setServicos(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      // Recalculate total
      const qty = Number(updated[index].quantidade) || 0;
      const unit = Number(updated[index].valor_unitario_usd) || 0;
      updated[index].valor_total_usd = parseFloat((qty * unit).toFixed(2));
      return updated;
    });
  };

  const handleRemoveServico = (index) => {
    setServicos(prev => prev.filter((_, i) => i !== index));
  };

  const totalUSD = useMemo(() => {
    return servicos.reduce((sum, s) => sum + (s.valor_total_usd || 0), 0);
  }, [servicos]);

  // Types already added
  const tiposAdicionados = useMemo(() => new Set(servicos.map(s => s.tipo_servico)), [servicos]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Delete existing services for this voo_ligado
      const existing = await ServicoVoo.filter({ voo_ligado_id: vooLigado.id });
      for (const e of (existing || [])) {
        await ServicoVoo.delete(e.id);
      }
      // Create new ones
      for (const s of servicos) {
        if (s.quantidade > 0) {
          await ServicoVoo.create({
            voo_ligado_id: vooLigado.id,
            tipo_servico: s.tipo_servico,
            outra_tarifa_id: s.outra_tarifa_id,
            quantidade: s.quantidade,
            unidade: s.unidade,
            valor_unitario_usd: s.valor_unitario_usd,
            valor_total_usd: s.valor_total_usd,
          });
        }
      }
      if (onServicesSaved) onServicesSaved(vooLigado);
      onClose();
    } catch (err) {
      console.error('Erro ao salvar serviços:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const getLabelForTipo = (value) => {
    const t = tiposDisponiveis.find(td => td.value === value);
    return t?.label || value;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-cyan-600" />
            Serviços do Voo
          </DialogTitle>
          {flightInfo && (
            <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
              <Badge variant="outline" className="bg-green-50 text-green-700">ARR {flightInfo.arr}</Badge>
              <span>→</span>
              <Badge variant="outline" className="bg-blue-50 text-blue-700">DEP {flightInfo.dep}</Badge>
              <span className="text-xs">| {flightInfo.registo} | {flightInfo.data}</span>
            </div>
          )}
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Add service dropdown */}
            <div className="flex items-center gap-2">
              <select
                className="flex-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    const tipo = tiposDisponiveis.find(t => t.value === e.target.value);
                    if (tipo) handleAddServico(tipo);
                  }
                }}
              >
                <option value="">+ Adicionar serviço...</option>
                {tiposDisponiveis.filter(t => !tiposAdicionados.has(t.value)).map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Service rows */}
            {servicos.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">Nenhum serviço adicionado.</p>
            ) : (
              <div className="space-y-3">
                {servicos.map((s, index) => (
                  <div key={index} className="border rounded-lg p-3 bg-slate-50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-700">{getLabelForTipo(s.tipo_servico)}</span>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-600" onClick={() => handleRemoveServico(index)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">{UNIDADE_LABELS[s.unidade] || 'Quantidade'}</Label>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={s.quantidade}
                          onChange={(e) => handleUpdateServico(index, 'quantidade', parseFloat(e.target.value) || 0)}
                          className="h-8"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Valor Unit. (USD)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={s.valor_unitario_usd}
                          onChange={(e) => handleUpdateServico(index, 'valor_unitario_usd', parseFloat(e.target.value) || 0)}
                          className="h-8"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Total (USD)</Label>
                        <div className="h-8 flex items-center px-3 bg-white border rounded-md text-sm font-semibold text-green-700">
                          {s.valor_total_usd.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Total */}
            <div className="flex items-center justify-between bg-slate-100 rounded-lg p-4 border">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                <span className="font-semibold text-slate-700">Total Serviços</span>
              </div>
              <span className="text-xl font-bold text-green-700">{totalUSD.toFixed(2)} USD</span>
            </div>

            {!aeroportoCategoria && (
              <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                Categoria do aeroporto não encontrada. Os valores podem não corresponder à tarifa correcta.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>{t('btn.cancel')}</Button>
          <Button onClick={handleSave} disabled={isSaving || isLoading} className="bg-cyan-600 hover:bg-cyan-700 text-white">
            {isSaving ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t('btn.loading')}</>
            ) : (
              <><Layers className="mr-2 h-4 w-4" /> {t('btn.save')}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
