import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Select from '@/components/ui/select';
import Combobox from '@/components/ui/combobox';
import { Checkbox } from '@/components/ui/checkbox';
import { PlusCircle, Save, XCircle, AlertTriangle } from 'lucide-react';
// Helper: parse "HH:mm" to minutes since midnight
function parseTimeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

// Helper: diff in minutes, handling overnight
function diffMinutes(inicioStr, fimStr) {
  let ini = parseTimeToMinutes(inicioStr);
  let fim = parseTimeToMinutes(fimStr);
  if (fim < ini) fim += 24 * 60; // overnight
  return fim - ini;
}

import { CampoKPI } from '@/entities/CampoKPI';
import { ValorCampoKPI } from '@/entities/ValorCampoKPI';
import AlertModal from '@/components/shared/AlertModal';
import useSubmitGuard from '@/hooks/useSubmitGuard';

export default function FormMedicaoKPI({ isOpen, onClose, onSubmit, tipoKPI, medicaoInicial, aeroportos, companhias }) {
  const [campos, setCampos] = useState([]);
  const [medicaoData, setMedicaoData] = useState({
    tipo_kpi_id: tipoKPI?.id || '',
    aeroporto_id: '',
    data_medicao: new Date().toISOString().split('T')[0],
    hora_inicio: '',
    hora_fim: '',
    numero_voo: '',
    companhia_aerea_codigo_icao: '',
    responsavel_medicao: '',
    turno: 'A',
    observacoes_gerais: ''
  });
  const [valoresCampos, setValoresCampos] = useState({});
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [alertInfo, setAlertInfo] = useState({ isOpen: false, type: 'warning', title: '', message: '', onConfirm: null });
  const { isSubmitting, guardedSubmit } = useSubmitGuard();

  useEffect(() => {
    if (isOpen && tipoKPI) {
      loadCampos();
      if (medicaoInicial) {
        setMedicaoData(medicaoInicial);
        loadValoresExistentes();
      }
    }
  }, [isOpen, tipoKPI, medicaoInicial]);

  const loadCampos = async () => {
    try {
      const camposData = await CampoKPI.filter({ tipo_kpi_id: tipoKPI.id, status: 'ativo' }, 'ordem');
      setCampos(camposData);

      // Inicializar valores dos campos
      const valoresIniciais = {};
      camposData.forEach((campo) => {
        valoresIniciais[campo.id] = {
          campo_kpi_id: campo.id,
          valor_texto: '',
          valor_numerico: null,
          valor_boolean: false,
          observacoes: ''
        };
      });
      setValoresCampos(valoresIniciais);
    } catch (error) {
      console.error('Erro ao carregar campos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadValoresExistentes = async () => {
    if (medicaoInicial) {
      try {
        const valoresExistentes = await ValorCampoKPI.filter({ medicao_kpi_id: medicaoInicial.id });
        const valoresMap = {};
        valoresExistentes.forEach((valor) => {
          valoresMap[valor.campo_kpi_id] = valor;
        });
        setValoresCampos((prev) => ({ ...prev, ...valoresMap }));
      } catch (error) {
        console.error('Erro ao carregar valores existentes:', error);
      }
    }
  };

  const handleMedicaoChange = (field, value) => {
    setMedicaoData((prev) => ({ ...prev, [field]: value }));

    // NOVO: Limpar erro quando o campo for alterado
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }

    // NOVO: Validação em tempo real quando mudar hora_fim
    if (field === 'hora_fim' && medicaoData.hora_inicio && value) {
      if (medicaoData.hora_inicio === value) {
        setAlertInfo({
          isOpen: true,
          type: 'warning',
          title: 'Atenção',
          message: 'O horário de início é igual ao horário de fim. Isto significa que o cálculo de minutos será ZERO (0).',
          onConfirm: () => setAlertInfo((prev) => ({ ...prev, isOpen: false }))
        });
      }
    }
  };

  const handleCampoChange = (campoId, field, value) => {
    setValoresCampos((prev) => ({
      ...prev,
      [campoId]: {
        ...prev[campoId],
        [field]: value
      }
    }));

    // Auto-cálculo para campos de duração
    const campo = campos.find((c) => c.id === campoId);
    if (campo?.tipo_campo === 'duracao' && campo?.formula_calculo) {
      calculateDuration(campoId, campo.formula_calculo);
    }

    // NOVO: Limpar erro quando o campo for alterado
    if (errors[`campo_${campoId}`]) {
      setErrors((prev) => ({ ...prev, [`campo_${campoId}`]: undefined }));
    }
  };

  const calculateDuration = (campoId, formula) => {
    // Implementar lógica de cálculo baseada na fórmula
    // Por exemplo: "fim - inicio" para calcular duração
    if (formula === 'fim - inicio') {
      const inicioField = campos.find((c) => c.categoria_medicao === campos.find((cf) => cf.id === campoId)?.categoria_medicao && c.nome_campo.toLowerCase().includes('início'));
      const fimField = campos.find((c) => c.categoria_medicao === campos.find((cf) => cf.id === campoId)?.categoria_medicao && c.nome_campo.toLowerCase().includes('fim'));

      if (inicioField && fimField) {
        const inicioValue = valoresCampos[inicioField.id]?.valor_texto;
        const fimValue = valoresCampos[fimField.id]?.valor_texto;

        if (inicioValue && fimValue) {
          const duracao = diffMinutes(inicioValue, fimValue);

          setValoresCampos((prev) => ({
            ...prev,
            [campoId]: {
              ...prev[campoId],
              valor_numerico: duracao,
              calculado_automaticamente: true
            }
          }));
        }
      }
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Validar dados da medição
    if (!medicaoData.aeroporto_id) newErrors.aeroporto_id = 'Aeroporto é obrigatório';
    if (!medicaoData.responsavel_medicao) newErrors.responsavel_medicao = 'Responsável é obrigatório';
    if (!medicaoData.hora_inicio) newErrors.hora_inicio = 'Hora de início é obrigatória';
    if (!medicaoData.hora_fim) newErrors.hora_fim = 'Hora de fim é obrigatória';

    // NOVO: Validar que hora fim não é anterior à hora início
    if (medicaoData.hora_inicio && medicaoData.hora_fim) {
      const ini = parseTimeToMinutes(medicaoData.hora_inicio);
      const fim = parseTimeToMinutes(medicaoData.hora_fim);

      // Se a hora de fim for menor, assumimos que passou da meia-noite
      if (fim < ini) {
        const duracaoHoras = (fim + 24 * 60 - ini) / 60;

        // Se a duração for maior que 12 horas, é provável que seja um erro
        if (duracaoHoras > 12) {
          newErrors.hora_fim = 'Hora de fim não pode ser anterior à hora de início (diferença muito grande)';
        }
      }
    }

    // Validar campos obrigatórios
    campos.filter((c) => c.obrigatorio).forEach((campo) => {
      const valor = valoresCampos[campo.id];
      let hasValue = false;

      switch (campo.tipo_campo) {
        case 'texto':
        case 'data':
        case 'hora':
          hasValue = valor?.valor_texto?.trim();
          break;
        case 'numero':
        case 'duracao':
          hasValue = valor?.valor_numerico !== null && valor?.valor_numerico !== undefined;
          break;
        case 'boolean':
          hasValue = true; // Boolean sempre tem valor
          break;
        default:
          hasValue = valor?.valor_texto?.trim();
      }

      if (!hasValue) {
        newErrors[`campo_${campo.id}`] = `${campo.nome_campo} é obrigatório`;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    guardedSubmit(async () => {
      // NOVO: Verificar se horário de início é igual ao horário de fim antes de submeter
      if (medicaoData.hora_inicio && medicaoData.hora_fim) {
        if (medicaoData.hora_inicio === medicaoData.hora_fim) {
          setAlertInfo({
            isOpen: true,
            type: 'warning',
            title: 'Confirmar Medição',
            message: 'O horário de início é igual ao horário de fim. Isto significa que o cálculo de minutos será ZERO (0). Tem certeza que deseja continuar?',
            showCancel: true,
            confirmText: 'Sim, Continuar',
            onConfirm: () => {
              setAlertInfo((prev) => ({ ...prev, isOpen: false }));
              proceedWithSubmit();
            }
          });
          return; // Aguarda confirmação
        }
      }

      // Se não houver alerta, submete direto
      await proceedWithSubmit();
    });
  };

  const proceedWithSubmit = async () => {

    // Calcular resultado principal (duração) e se está dentro da meta
    let resultadoPrincipal = null;
    let dentroDaMeta = null;

    if (medicaoData.hora_inicio && medicaoData.hora_fim) {
      resultadoPrincipal = diffMinutes(medicaoData.hora_inicio, medicaoData.hora_fim);

      if (tipoKPI.meta_objetivo !== null && tipoKPI.meta_objetivo !== undefined) {
        dentroDaMeta = resultadoPrincipal <= tipoKPI.meta_objetivo;
      }
    }

    // Se houver um campo de resultado principal, ele pode sobrescrever o cálculo acima
    const campoResultado = campos.find((c) => c.nome_campo.toLowerCase().includes('resultado') || c.nome_campo.toLowerCase().includes('total'));
    if (campoResultado && valoresCampos[campoResultado.id]?.valor_numerico !== null && valoresCampos[campoResultado.id]?.valor_numerico !== undefined) {
      resultadoPrincipal = valoresCampos[campoResultado.id]?.valor_numerico;
      if (tipoKPI.meta_objetivo !== null && tipoKPI.meta_objetivo !== undefined) {
        dentroDaMeta = resultadoPrincipal <= tipoKPI.meta_objetivo;
      }
    }

    const dadosParaSubmit = {
      medicao: {
        ...medicaoData,
        resultado_principal: resultadoPrincipal,
        dentro_da_meta: dentroDaMeta,
        status: 'concluida'
      },
      valores: Object.values(valoresCampos)
    };

    await onSubmit(dadosParaSubmit);
  };

  // NOVO: Função para renderizar campo baseado na unidade de medida do KPI
  const renderCampo = (campo) => {
    const valor = valoresCampos[campo.id] || {};
    const error = errors[`campo_${campo.id}`];

    // Determinar o tipo de input baseado no tipo de campo E na unidade de medida do KPI
    const unidadeMedida = tipoKPI?.unidade_medida || 'minutos';

    switch (campo.tipo_campo) {
      case 'texto':
        return (
          <Input
            value={valor.valor_texto || ''}
            onChange={(e) => handleCampoChange(campo.id, 'valor_texto', e.target.value)}
            placeholder={campo.descricao_ajuda}
            className={error ? 'border-red-500' : ''} />);



      case 'numero':
        return (
          <div className="relative">
            <Input
              type="number"
              value={valor.valor_numerico || ''}
              onChange={(e) => handleCampoChange(campo.id, 'valor_numerico', parseFloat(e.target.value) || null)}
              min={campo.valor_minimo}
              max={campo.valor_maximo}
              step={unidadeMedida === 'percentual' ? '0.01' : '1'}
              placeholder={campo.descricao_ajuda}
              className={error ? 'border-red-500' : ''} />

            {campo.unidade &&
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                {campo.unidade}
              </span>
            }
          </div>);


      case 'hora':
        return (
          <Input
            type="time"
            value={valor.valor_texto || ''}
            onChange={(e) => handleCampoChange(campo.id, 'valor_texto', e.target.value)}
            className={error ? 'border-red-500' : ''} />);



      case 'data':
        return (
          <Input
            type="date"
            value={valor.valor_texto || ''}
            onChange={(e) => handleCampoChange(campo.id, 'valor_texto', e.target.value)}
            className={error ? 'border-red-500' : ''} />);



      case 'duracao':
        return (
          <div className="relative">
            <Input
              type="number"
              value={valor.valor_numerico || ''}
              onChange={(e) => handleCampoChange(campo.id, 'valor_numerico', parseFloat(e.target.value) || null)}
              placeholder={`Em ${unidadeMedida}`}
              readOnly={valor.calculado_automaticamente}
              className={`${error ? 'border-red-500' : ''} ${valor.calculado_automaticamente ? 'bg-slate-100' : ''}`} />

            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
              {unidadeMedida}
            </span>
          </div>);


      case 'boolean':
        return (
          <Checkbox
            checked={valor.valor_boolean || false}
            onCheckedChange={(checked) => handleCampoChange(campo.id, 'valor_boolean', checked)} />);



      default:
        return (
          <Input
            value={valor.valor_texto || ''}
            onChange={(e) => handleCampoChange(campo.id, 'valor_texto', e.target.value)}
            placeholder={campo.descricao_ajuda}
            className={error ? 'border-red-500' : ''} />);


    }
  };

  const aeroportoOptions = aeroportos.map((a) => ({
    value: a.codigo_icao,
    label: `${a.nome} (${a.codigo_icao})`
  }));

  const companhiaOptions = companhias.map((c) => ({
    value: c.codigo_icao,
    label: `${c.nome} (${c.codigo_icao})`
  }));

  const turnoOptions = [
  { value: 'A', label: 'Turno A' },
  { value: 'B', label: 'Turno B' },
  { value: 'C', label: 'Turno C' },
  { value: 'D', label: 'Turno D' },
  { value: 'E', label: 'Turno E' }];


  // Agrupar campos por categoria
  const camposPorCategoria = campos.reduce((acc, campo) => {
    if (!acc[campo.categoria_medicao]) {
      acc[campo.categoria_medicao] = [];
    }
    acc[campo.categoria_medicao].push(campo);
    return acc;
  }, {});

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-blue-600" />
            {medicaoInicial ? 'Editar' : 'Nova'} Medição: {tipoKPI?.nome}
          </DialogTitle>
        </DialogHeader>

        {isLoading ?
        <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-slate-500 mt-2 ml-3">A carregar campos...</p>
          </div> :

        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Dados Gerais da Medição */}
            <div className="space-y-4 p-4 border rounded-md bg-slate-50">
              <h3 className="text-lg font-semibold">Dados Gerais</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="aeroporto_id">Aeroporto *</Label>
                  <Select
                  id="aeroporto_id"
                  options={aeroportoOptions}
                  value={medicaoData.aeroporto_id}
                  onValueChange={(v) => handleMedicaoChange('aeroporto_id', v)}
                  placeholder="Selecione o Aeroporto"
                  className={errors.aeroporto_id ? 'border-red-500' : ''} />

                  {errors.aeroporto_id && <p className="text-red-500 text-xs flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{errors.aeroporto_id}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="data_medicao">Data da Medição *</Label>
                  <Input
                  id="data_medicao"
                  type="date"
                  value={medicaoData.data_medicao}
                  onChange={(e) => handleMedicaoChange('data_medicao', e.target.value)} />

                </div>

                <div className="space-y-2">
                  <Label htmlFor="hora_inicio">Hora Início *</Label>
                  <Input
                  id="hora_inicio"
                  type="time"
                  value={medicaoData.hora_inicio}
                  onChange={(e) => handleMedicaoChange('hora_inicio', e.target.value)}
                  required
                  className={errors.hora_inicio ? 'border-red-500' : ''} />

                  {errors.hora_inicio && <p className="text-red-500 text-xs flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{errors.hora_inicio}</p>}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="hora_fim">Hora Fim *</Label>
                  <Input
                  id="hora_fim"
                  type="time"
                  value={medicaoData.hora_fim}
                  onChange={(e) => handleMedicaoChange('hora_fim', e.target.value)}
                  required
                  className={errors.hora_fim ? 'border-red-500' : ''} />

                  {errors.hora_fim && <p className="text-red-500 text-xs flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{errors.hora_fim}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="numero_voo">Número do Voo</Label>
                  <Input
                  id="numero_voo"
                  value={medicaoData.numero_voo}
                  onChange={(e) => handleMedicaoChange('numero_voo', e.target.value)}
                  placeholder="Ex: DT123" />

                </div>

                <div className="space-y-2">
                  <Label htmlFor="companhia_aerea_codigo_icao">Companhia Aérea</Label>
                  <Combobox
                  id="companhia_aerea_codigo_icao"
                  options={companhiaOptions}
                  value={medicaoData.companhia_aerea_codigo_icao}
                  onValueChange={(v) => handleMedicaoChange('companhia_aerea_codigo_icao', v)}
                  placeholder="Selecione a Companhia" />

                </div>

                <div className="space-y-2">
                  <Label htmlFor="responsavel_medicao">Responsável *</Label>
                  <Input
                  id="responsavel_medicao"
                  value={medicaoData.responsavel_medicao}
                  onChange={(e) => handleMedicaoChange('responsavel_medicao', e.target.value)}
                  placeholder="Nome do responsável"
                  className={errors.responsavel_medicao ? 'border-red-500' : ''} />

                  {errors.responsavel_medicao && <p className="text-red-500 text-xs flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{errors.responsavel_medicao}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="turno">Turno</Label>
                  <Select
                  id="turno"
                  options={turnoOptions}
                  value={medicaoData.turno}
                  onValueChange={(v) => handleMedicaoChange('turno', v)} />

                </div>
              </div>
            </div>

            {/* Campos Específicos do KPI */}
            {Object.entries(camposPorCategoria).map(([categoria, camposCategoria]) =>
          <div key={categoria} className="space-y-4 p-4 border rounded-md bg-blue-50">
                <h3 className="text-lg font-semibold capitalize">
                  {categoria.replace('_', ' ')} 
                  ({camposCategoria.length} campos)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {camposCategoria.map((campo) =>
              <div key={campo.id} className="space-y-2">
                      <Label htmlFor={`campo_${campo.id}`}>
                        {campo.nome_campo}
                        {campo.obrigatorio && ' *'}
                        {campo.unidade && ` (${campo.unidade})`}
                      </Label>
                      {renderCampo(campo)}
                      {errors[`campo_${campo.id}`] &&
                <p className="text-red-500 text-xs flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {errors[`campo_${campo.id}`]}
                        </p>
                }
                      {campo.descricao_ajuda &&
                <p className="text-slate-500 text-xs">{campo.descricao_ajuda}</p>
                }
                    </div>
              )}
                </div>
              </div>
          )}

            {/* Observações Gerais */}
            <div className="space-y-2">
              <Label htmlFor="observacoes_gerais">Observações Gerais</Label>
              <Textarea
              id="observacoes_gerais"
              value={medicaoData.observacoes_gerais}
              onChange={(e) => handleMedicaoChange('observacoes_gerais', e.target.value)}
              placeholder="Observações adicionais sobre a medição..."
              rows={3} />

            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  <XCircle className="w-4 h-4 mr-2" />
                  Cancelar
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
                <Save className="w-4 h-4 mr-2" />
                {isSubmitting ? 'A guardar...' : `${medicaoInicial ? 'Atualizar' : 'Registar'} Medição`}
              </Button>
            </DialogFooter>
          </form>
        }

        <AlertModal
          isOpen={alertInfo.isOpen}
          onClose={() => setAlertInfo({ ...alertInfo, isOpen: false })}
          type={alertInfo.type}
          title={alertInfo.title}
          message={alertInfo.message}
          showCancel={alertInfo.showCancel}
          onConfirm={alertInfo.onConfirm}
          confirmText={alertInfo.confirmText}
        />
      </DialogContent>
    </Dialog>);

}