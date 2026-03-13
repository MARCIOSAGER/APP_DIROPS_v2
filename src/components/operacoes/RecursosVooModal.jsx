import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Loader2, Wrench, Wind, Zap, DoorOpen, ClipboardList, DollarSign } from 'lucide-react';
import { RecursoVoo } from '@/entities/RecursoVoo';
import { TarifaRecurso } from '@/entities/TarifaRecurso';
import { useCompanyView } from '@/lib/CompanyViewContext';

const RESOURCE_TYPES = [
  { key: 'pca', label: 'PCA (Ar Pré-Condicionado)', icon: Wind, color: 'text-cyan-600' },
  { key: 'gpu', label: 'GPU (Ground Power Unit)', icon: Zap, color: 'text-yellow-600' },
  { key: 'pbb', label: 'PBB (Ponte de Embarque)', icon: DoorOpen, color: 'text-blue-600' },
];

function calcTempoHoras(inicio, fim) {
  if (!inicio || !fim) return 0;
  const [h1, m1] = inicio.split(':').map(Number);
  const [h2, m2] = fim.split(':').map(Number);
  let mins = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (mins < 0) mins += 24 * 60; // cross-midnight
  return parseFloat((mins / 60).toFixed(2));
}

export default function RecursosVooModal({ isOpen, onClose, vooLigado, voos, aeroportos, onResourcesSaved }) {
  const { effectiveEmpresaId } = useCompanyView();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [existingId, setExistingId] = useState(null);
  const [tarifas, setTarifas] = useState([]);
  const [formData, setFormData] = useState({});

  // Get airport category for tariff lookup
  const aeroportoCategoria = useMemo(() => {
    if (!vooLigado || !voos || !aeroportos) return null;
    const vooArr = voos.find(v => v.id === vooLigado.id_voo_arr);
    if (!vooArr) return null;
    const aero = aeroportos.find(a => a.codigo_icao === vooArr.aeroporto_operacao);
    return aero?.categoria || null;
  }, [vooLigado, voos, aeroportos]);

  // Get flight info for header
  const flightInfo = useMemo(() => {
    if (!vooLigado || !voos) return null;
    const vooArr = voos.find(v => v.id === vooLigado.id_voo_arr);
    const vooDep = voos.find(v => v.id === vooLigado.id_voo_dep);
    return {
      arr: vooArr?.numero_voo || '?',
      dep: vooDep?.numero_voo || '?',
      registo: vooArr?.registo_aeronave || vooDep?.registo_aeronave || '?',
      data: vooArr?.data_operacao || ''
    };
  }, [vooLigado, voos]);

  const initEmpty = () => ({
    pca_utilizado: false, pca_hora_inicio: '', pca_hora_fim: '', pca_posicao_stand: '',
    gpu_utilizado: false, gpu_hora_inicio: '', gpu_hora_fim: '', gpu_posicao_stand: '',
    pbb_utilizado: false, pbb_hora_inicio: '', pbb_hora_fim: '', pbb_posicao_stand: '',
    checkin_utilizado: false, checkin_hora_inicio: '', checkin_hora_fim: '', checkin_posicoes: '', checkin_num_balcoes: 0,
  });

  useEffect(() => {
    if (!isOpen || !vooLigado) return;
    setIsLoading(true);
    Promise.all([
      RecursoVoo.filter({ voo_ligado_id: vooLigado.id }),
      TarifaRecurso.filter({ status: 'ativa' })
    ]).then(([recursos, tarifasData]) => {
      // Filtrar tarifas por empresa
      const allTarifas = tarifasData || [];
      console.log('[RecursosVoo] allTarifas:', allTarifas.length, 'effectiveEmpresaId:', effectiveEmpresaId, 'aeroportoCategoria:', aeroportoCategoria);
      if (effectiveEmpresaId) {
        const empresaTarifas = allTarifas.filter(t => t.empresa_id === effectiveEmpresaId);
        const globalTarifas = allTarifas.filter(t => !t.empresa_id);
        setTarifas(empresaTarifas.length > 0 ? empresaTarifas : globalTarifas);
      } else {
        setTarifas(allTarifas);
      }
      if (recursos && recursos.length > 0) {
        const r = recursos[0];
        setExistingId(r.id);
        setFormData({
          pca_utilizado: r.pca_utilizado || false,
          pca_hora_inicio: r.pca_hora_inicio ? new Date(r.pca_hora_inicio).toTimeString().slice(0, 5) : '',
          pca_hora_fim: r.pca_hora_fim ? new Date(r.pca_hora_fim).toTimeString().slice(0, 5) : '',
          pca_posicao_stand: r.pca_posicao_stand || '',
          gpu_utilizado: r.gpu_utilizado || false,
          gpu_hora_inicio: r.gpu_hora_inicio ? new Date(r.gpu_hora_inicio).toTimeString().slice(0, 5) : '',
          gpu_hora_fim: r.gpu_hora_fim ? new Date(r.gpu_hora_fim).toTimeString().slice(0, 5) : '',
          gpu_posicao_stand: r.gpu_posicao_stand || '',
          pbb_utilizado: r.pbb_utilizado || false,
          pbb_hora_inicio: r.pbb_hora_inicio ? new Date(r.pbb_hora_inicio).toTimeString().slice(0, 5) : '',
          pbb_hora_fim: r.pbb_hora_fim ? new Date(r.pbb_hora_fim).toTimeString().slice(0, 5) : '',
          pbb_posicao_stand: r.pbb_posicao_stand || '',
          checkin_utilizado: r.checkin_utilizado || false,
          checkin_hora_inicio: r.checkin_hora_inicio ? new Date(r.checkin_hora_inicio).toTimeString().slice(0, 5) : '',
          checkin_hora_fim: r.checkin_hora_fim ? new Date(r.checkin_hora_fim).toTimeString().slice(0, 5) : '',
          checkin_posicoes: r.checkin_posicoes || '',
          checkin_num_balcoes: r.checkin_num_balcoes || 0,
        });
      } else {
        setExistingId(null);
        setFormData(initEmpty());
      }
    }).catch(err => {
      console.error('Erro ao carregar recursos:', err);
      setFormData(initEmpty());
    }).finally(() => setIsLoading(false));
  }, [isOpen, vooLigado, effectiveEmpresaId]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Find tariff object for a resource type
  const getTarifaObj = useCallback((tipo) => {
    if (!tarifas.length || !aeroportoCategoria) return null;
    return tarifas.find(t =>
      t.tipo === tipo &&
      t.categoria_aeroporto === aeroportoCategoria
    ) || null;
  }, [tarifas, aeroportoCategoria]);

  // Calculate values for each resource
  const calculations = useMemo(() => {
    const result = {};
    for (const rt of RESOURCE_TYPES) {
      const k = rt.key;
      const utilizado = formData[`${k}_utilizado`];
      if (!utilizado) {
        result[k] = { tempo: 0, valor: 0, tarifa: 0, breakdown: null };
        continue;
      }
      const tempo = calcTempoHoras(formData[`${k}_hora_inicio`], formData[`${k}_hora_fim`]);
      const tarifaObj = getTarifaObj(k);
      const tarifa = tarifaObj ? Number(tarifaObj.valor_usd || 0) : 0;
      let valor;
      let breakdown = null;

      if (k === 'pbb' && tarifaObj?.primeira_hora && tarifaObj?.hora_adicional) {
        // PBB special logic: 1st hour + additional hours (rounded up)
        const primeiraHora = Number(tarifaObj.primeira_hora);
        const horaAdicional = Number(tarifaObj.hora_adicional);
        const horasAdicionais = Math.max(0, Math.ceil(tempo) - 1);
        valor = parseFloat((primeiraHora + horasAdicionais * horaAdicional).toFixed(2));
        breakdown = { primeiraHora, horaAdicional, horasAdicionais };
      } else if (k === 'checkin') {
        const balcoes = Number(formData.checkin_num_balcoes || 0);
        valor = parseFloat((balcoes * tempo * tarifa).toFixed(2));
      } else {
        valor = parseFloat((tempo * tarifa).toFixed(2));
      }
      result[k] = { tempo, valor, tarifa, breakdown };
    }
    return result;
  }, [formData, getTarifaObj]);

  const totalUSD = useMemo(() => {
    return Object.values(calculations).reduce((sum, c) => sum + c.valor, 0);
  }, [calculations]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const baseDate = flightInfo?.data || new Date().toISOString().split('T')[0];
      const buildTimestamp = (time) => {
        if (!time) return null;
        return `${baseDate}T${time}:00`;
      };

      const payload = {
        voo_ligado_id: vooLigado.id,
      };

      for (const rt of RESOURCE_TYPES) {
        const k = rt.key;
        payload[`${k}_utilizado`] = formData[`${k}_utilizado`] || false;
        payload[`${k}_hora_inicio`] = formData[`${k}_utilizado`] ? buildTimestamp(formData[`${k}_hora_inicio`]) : null;
        payload[`${k}_hora_fim`] = formData[`${k}_utilizado`] ? buildTimestamp(formData[`${k}_hora_fim`]) : null;

        if (k === 'checkin') {
          payload.checkin_posicoes = formData.checkin_posicoes || '';
          payload.checkin_num_balcoes = Number(formData.checkin_num_balcoes || 0);
        } else {
          payload[`${k}_posicao_stand`] = formData[`${k}_posicao_stand`] || '';
        }

        payload[`${k}_tempo_horas`] = calculations[k].tempo;
        payload[`${k}_valor_usd`] = calculations[k].valor;
      }

      payload.total_recursos_usd = totalUSD;

      if (existingId) {
        await RecursoVoo.update(existingId, payload);
      } else {
        await RecursoVoo.create(payload);
      }

      if (onResourcesSaved) onResourcesSaved(vooLigado);
    } catch (err) {
      console.error('Erro ao salvar recursos:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-slate-600" />
            Recursos do Voo
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
          <div className="space-y-2">
            <Accordion type="multiple" defaultValue={RESOURCE_TYPES.filter(rt => formData[`${rt.key}_utilizado`]).map(rt => rt.key)} className="space-y-2">
              {RESOURCE_TYPES.map(rt => {
                const Icon = rt.icon;
                const k = rt.key;
                const utilizado = formData[`${k}_utilizado`];
                const calc = calculations[k];

                return (
                  <AccordionItem key={k} value={k} className="border rounded-lg px-4">
                    <AccordionTrigger className="py-3 hover:no-underline">
                      <div className="flex items-center gap-3 w-full">
                        <Icon className={`w-5 h-5 ${rt.color}`} />
                        <span className="font-medium text-sm">{rt.label}</span>
                        <div className="ml-auto flex items-center gap-2 mr-2">
                          {utilizado && calc.valor > 0 && (
                            <Badge className="bg-green-100 text-green-800 text-xs">
                              {calc.valor.toFixed(2)} USD
                            </Badge>
                          )}
                          {!utilizado && (
                            <Badge variant="outline" className="text-xs text-slate-400">N/A</Badge>
                          )}
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-4">
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={utilizado}
                            onCheckedChange={(v) => handleChange(`${k}_utilizado`, v)}
                          />
                          <Label className="text-sm">{utilizado ? 'Utilizado' : 'Não utilizado (N/A)'}</Label>
                        </div>

                        {utilizado && (
                          <div className={`grid gap-3 ${k === 'checkin' ? 'grid-cols-2 md:grid-cols-5' : 'grid-cols-2 md:grid-cols-3'} bg-slate-50 p-3 rounded-lg border`}>
                            <div className="space-y-1">
                              <Label className="text-xs">Hora Início</Label>
                              <Input
                                type="time"
                                value={formData[`${k}_hora_inicio`] || ''}
                                onChange={(e) => handleChange(`${k}_hora_inicio`, e.target.value)}
                                className="h-9"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Hora Fim</Label>
                              <Input
                                type="time"
                                value={formData[`${k}_hora_fim`] || ''}
                                onChange={(e) => handleChange(`${k}_hora_fim`, e.target.value)}
                                className="h-9"
                              />
                            </div>

                            {k === 'checkin' ? (
                              <>
                                <div className="space-y-1">
                                  <Label className="text-xs">Posições</Label>
                                  <Input
                                    type="text"
                                    value={formData.checkin_posicoes || ''}
                                    onChange={(e) => handleChange('checkin_posicoes', e.target.value)}
                                    className="h-9"
                                    placeholder="Ex: B01-16"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Nº Balcões</Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    value={formData.checkin_num_balcoes || ''}
                                    onChange={(e) => handleChange('checkin_num_balcoes', parseInt(e.target.value) || 0)}
                                    className="h-9"
                                  />
                                </div>
                              </>
                            ) : (
                              <div className="space-y-1">
                                <Label className="text-xs">Posição Stand</Label>
                                <Input
                                  type="text"
                                  value={formData[`${k}_posicao_stand`] || ''}
                                  onChange={(e) => handleChange(`${k}_posicao_stand`, e.target.value)}
                                  className="h-9"
                                  placeholder="Ex: A1"
                                />
                              </div>
                            )}

                            {/* Calculated values */}
                            <div className="col-span-full flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1 border-t">
                              <span>Tempo: <strong>{calc.tempo.toFixed(2)}h</strong></span>
                              {calc.breakdown ? (
                                <span>1ª hora: <strong>{calc.breakdown.primeiraHora.toFixed(2)}</strong> + {calc.breakdown.horasAdicionais}h × <strong>{calc.breakdown.horaAdicional.toFixed(2)}</strong></span>
                              ) : (
                                <>
                                  <span>Tarifa: <strong>{calc.tarifa.toFixed(2)} USD/h</strong></span>
                                  {k === 'checkin' && <span>Balcões: <strong>{formData.checkin_num_balcoes || 0}</strong></span>}
                                </>
                              )}
                              <span className="ml-auto text-green-700 font-semibold">
                                = {calc.valor.toFixed(2)} USD
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>

            {/* Total */}
            <div className="flex items-center justify-between bg-slate-100 rounded-lg p-4 border">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                <span className="font-semibold text-slate-700">Total Recursos</span>
              </div>
              <span className="text-xl font-bold text-green-700">{totalUSD.toFixed(2)} USD</span>
            </div>

            {!aeroportoCategoria && (
              <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                Categoria do aeroporto não encontrada. As tarifas podem não ser calculadas correctamente.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isLoading} className="bg-blue-600 hover:bg-blue-700 text-white">
            {isSaving ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</>
            ) : (
              <><Wrench className="mr-2 h-4 w-4" /> Salvar Recursos</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
