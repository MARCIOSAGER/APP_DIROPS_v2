import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Select from '@/components/ui/select';
import { Loader2, Save } from 'lucide-react';
import { Empresa } from '@/entities/Empresa';
import useSubmitGuard from '@/hooks/useSubmitGuard';

const CATEGORIA_OPTIONS = [
  { value: 'Condução Airside', label: 'Condução Airside' },
  { value: 'Operação de Equipamentos', label: 'Operação de Equipamentos' },
  { value: 'Reboque de Aeronaves', label: 'Reboque de Aeronaves' },
  { value: 'Outro', label: 'Outro' },
];

const RESULTADO_OPTIONS = [
  { value: 'Em Andamento', label: 'Em Andamento' },
  { value: 'Aprovado', label: 'Aprovado' },
  { value: 'Reprovado', label: 'Reprovado' },
];

const STATUS_OPTIONS = [
  { value: 'Pendente', label: 'Pendente' },
  { value: 'Ativa', label: 'Ativa' },
  { value: 'Suspensa', label: 'Suspensa' },
  { value: 'Cancelada', label: 'Cancelada' },
];

// Soma 12 meses a uma data ISO (yyyy-mm-dd) e devolve no mesmo formato.
function maisDozeMeses(dataISO) {
  if (!dataISO) return '';
  const d = new Date(dataISO + 'T00:00:00');
  if (isNaN(d.getTime())) return '';
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().split('T')[0];
}

const EMPTY = {
  numero_licenca: '',
  numero_passe: '',
  nome_condutor: '',
  entidade: '',
  data_emissao: '',
  data_validade: '',
  aeroporto: '',
  categoria: 'Condução Airside',
  data_treinamento: '',
  instrutor: '',
  resultado: 'Em Andamento',
  status: 'Pendente',
  observacoes: '',
};

export default function FormLicencaConducao({ isOpen, onClose, onSubmit, aeroportos = [], licencaInicial = null, numeroSugerido = '' }) {
  const { isSubmitting, guardedSubmit } = useSubmitGuard();
  const [empresas, setEmpresas] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!isOpen) return;
    if (licencaInicial) {
      setForm({ ...EMPTY, ...licencaInicial });
    } else {
      setForm({ ...EMPTY, numero_licenca: numeroSugerido });
    }
    setErrors({});
  }, [isOpen, licencaInicial, numeroSugerido]);

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const data = await Empresa.list('nome');
        setEmpresas(data || []);
      } catch (e) {
        console.error('Erro ao carregar empresas:', e);
      }
    })();
  }, [isOpen]);

  const change = (field, value) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      // Validade = emissão + 12 meses (automática) — só se o utilizador não a editou manualmente
      if (field === 'data_emissao') next.data_validade = maisDozeMeses(value);
      return next;
    });
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const validar = () => {
    const e = {};
    if (!form.nome_condutor?.trim()) e.nome_condutor = 'Obrigatório';
    if (!form.entidade?.trim()) e.entidade = 'Obrigatório';
    if (!form.data_emissao) e.data_emissao = 'Obrigatório';
    if (!form.aeroporto) e.aeroporto = 'Obrigatório';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (ev) => {
    ev.preventDefault();
    if (!validar()) return;
    guardedSubmit(async () => {
      await onSubmit(form);
    });
  };

  const empresaOptions = [
    { value: '', label: 'Selecione a entidade' },
    ...empresas.map(emp => ({ value: emp.nome, label: emp.nome })),
  ];
  const aeroportoOptions = [
    { value: '', label: 'Selecione o aeroporto' },
    ...aeroportos.map(a => ({ value: a.codigo_icao, label: `${a.nome} (${a.codigo_icao})` })),
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{licencaInicial ? 'Editar Registo de Treinamento / Licença' : 'Novo Registo de Treinamento / Licença'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Nº da Licença de Condução</Label>
              <Input value={form.numero_licenca} onChange={(e) => change('numero_licenca', e.target.value)} placeholder="0001/26" />
              <p className="text-xs text-slate-400">Gerado automaticamente (ex: 0001/26)</p>
            </div>
            <div className="space-y-1">
              <Label>Nº do Passe de Acesso <span className="text-slate-400 text-xs">(5 dígitos)</span></Label>
              <Input value={form.numero_passe} onChange={(e) => change('numero_passe', e.target.value.replace(/\D/g, '').slice(0, 5))} placeholder="00000" maxLength={5} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Nome do Condutor <span className="text-red-500">*</span></Label>
            <Input value={form.nome_condutor} onChange={(e) => change('nome_condutor', e.target.value)} placeholder="Nome completo do condutor" />
            {errors.nome_condutor && <p className="text-red-500 text-xs">{errors.nome_condutor}</p>}
          </div>

          <div className="space-y-1">
            <Label>Entidade / Empresa <span className="text-red-500">*</span></Label>
            <Select options={empresaOptions} value={form.entidade} onValueChange={(v) => change('entidade', v)} placeholder="Selecione a entidade" />
            {errors.entidade && <p className="text-red-500 text-xs">{errors.entidade}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Data de Emissão da Licença <span className="text-red-500">*</span></Label>
              <Input type="date" value={form.data_emissao} onChange={(e) => change('data_emissao', e.target.value)} />
              {errors.data_emissao && <p className="text-red-500 text-xs">{errors.data_emissao}</p>}
            </div>
            <div className="space-y-1">
              <Label>Data de Validade <span className="text-slate-400 text-xs">(+12 meses, automática)</span></Label>
              <Input type="date" value={form.data_validade} onChange={(e) => change('data_validade', e.target.value)} />
            </div>
          </div>

          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide pt-2">Informações Adicionais</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Aeroporto <span className="text-red-500">*</span></Label>
              <Select options={aeroportoOptions} value={form.aeroporto} onValueChange={(v) => change('aeroporto', v)} placeholder="Selecione o aeroporto" />
              {errors.aeroporto && <p className="text-red-500 text-xs">{errors.aeroporto}</p>}
            </div>
            <div className="space-y-1">
              <Label>Categoria da Licença</Label>
              <Select options={CATEGORIA_OPTIONS} value={form.categoria} onValueChange={(v) => change('categoria', v)} placeholder="Condução Airside" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Data do Treinamento</Label>
              <Input type="date" value={form.data_treinamento} onChange={(e) => change('data_treinamento', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Instrutor</Label>
              <Input value={form.instrutor} onChange={(e) => change('instrutor', e.target.value)} placeholder="Nome do instrutor" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Resultado</Label>
              <Select options={RESULTADO_OPTIONS} value={form.resultado} onValueChange={(v) => change('resultado', v)} placeholder="Em Andamento" />
            </div>
            <div className="space-y-1">
              <Label>Status da Licença</Label>
              <Select options={STATUS_OPTIONS} value={form.status} onValueChange={(v) => change('status', v)} placeholder="Pendente" />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Observações</Label>
            <Input value={form.observacoes} onChange={(e) => change('observacoes', e.target.value)} placeholder="Observações adicionais" />
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              {licencaInicial ? 'Salvar Alterações' : 'Criar Registo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
