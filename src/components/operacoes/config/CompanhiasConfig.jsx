import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Edit, Trash2, Search } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import Select from '@/components/ui/select';
import Combobox from '@/components/ui/combobox';
import SortableTableHeader from '@/components/shared/SortableTableHeader';
import { CompanhiaAerea } from '@/entities/CompanhiaAerea';
import { User } from '@/entities/User';
import useSubmitGuard from '@/hooks/useSubmitGuard';
import { useI18n } from '@/components/lib/i18n';

const PAISES_ISO = [
  { code: 'AD', name: 'Andorra' }, { code: 'AE', name: 'Emirados Árabes Unidos' }, { code: 'AF', name: 'Afeganistão' },
  { code: 'AG', name: 'Antígua e Barbuda' }, { code: 'AI', name: 'Anguila' }, { code: 'AL', name: 'Albânia' },
  { code: 'AM', name: 'Arménia' }, { code: 'AO', name: 'Angola' }, { code: 'AR', name: 'Argentina' },
  { code: 'AT', name: 'Áustria' }, { code: 'AU', name: 'Austrália' }, { code: 'AZ', name: 'Azerbaijão' },
  { code: 'BA', name: 'Bósnia e Herzegovina' }, { code: 'BB', name: 'Barbados' }, { code: 'BD', name: 'Bangladesh' },
  { code: 'BE', name: 'Bélgica' }, { code: 'BF', name: 'Burkina Faso' }, { code: 'BG', name: 'Bulgária' },
  { code: 'BH', name: 'Barém' }, { code: 'BI', name: 'Burundi' }, { code: 'BJ', name: 'Benim' },
  { code: 'BN', name: 'Brunei' }, { code: 'BO', name: 'Bolívia' }, { code: 'BR', name: 'Brasil' },
  { code: 'BS', name: 'Bahamas' }, { code: 'BT', name: 'Butão' }, { code: 'BW', name: 'Botswana' },
  { code: 'BY', name: 'Bielorrússia' }, { code: 'BZ', name: 'Belize' }, { code: 'CA', name: 'Canadá' },
  { code: 'CD', name: 'Congo (RDC)' }, { code: 'CF', name: 'República Centro-Africana' }, { code: 'CG', name: 'Congo' },
  { code: 'CH', name: 'Suíça' }, { code: 'CI', name: 'Costa do Marfim' }, { code: 'CL', name: 'Chile' },
  { code: 'CM', name: 'Camarões' }, { code: 'CN', name: 'China' }, { code: 'CO', name: 'Colômbia' },
  { code: 'CR', name: 'Costa Rica' }, { code: 'CU', name: 'Cuba' }, { code: 'CV', name: 'Cabo Verde' },
  { code: 'CY', name: 'Chipre' }, { code: 'CZ', name: 'República Checa' }, { code: 'DE', name: 'Alemanha' },
  { code: 'DJ', name: 'Djibuti' }, { code: 'DK', name: 'Dinamarca' }, { code: 'DM', name: 'Dominica' },
  { code: 'DO', name: 'República Dominicana' }, { code: 'DZ', name: 'Argélia' }, { code: 'EC', name: 'Equador' },
  { code: 'EE', name: 'Estónia' }, { code: 'EG', name: 'Egito' }, { code: 'ER', name: 'Eritreia' },
  { code: 'ES', name: 'Espanha' }, { code: 'ET', name: 'Etiópia' }, { code: 'FI', name: 'Finlândia' },
  { code: 'FJ', name: 'Fiji' }, { code: 'FR', name: 'França' }, { code: 'GA', name: 'Gabão' },
  { code: 'GB', name: 'Reino Unido' }, { code: 'GD', name: 'Granada' }, { code: 'GE', name: 'Geórgia' },
  { code: 'GH', name: 'Gana' }, { code: 'GM', name: 'Gâmbia' }, { code: 'GN', name: 'Guiné' },
  { code: 'GQ', name: 'Guiné Equatorial' }, { code: 'GR', name: 'Grécia' }, { code: 'GT', name: 'Guatemala' },
  { code: 'GW', name: 'Guiné-Bissau' }, { code: 'GY', name: 'Guiana' }, { code: 'HN', name: 'Honduras' },
  { code: 'HR', name: 'Croácia' }, { code: 'HT', name: 'Haiti' }, { code: 'HU', name: 'Hungria' },
  { code: 'ID', name: 'Indonésia' }, { code: 'IE', name: 'Irlanda' }, { code: 'IL', name: 'Israel' },
  { code: 'IN', name: 'Índia' }, { code: 'IQ', name: 'Iraque' }, { code: 'IR', name: 'Irão' },
  { code: 'IS', name: 'Islândia' }, { code: 'IT', name: 'Itália' }, { code: 'JM', name: 'Jamaica' },
  { code: 'JO', name: 'Jordânia' }, { code: 'JP', name: 'Japão' }, { code: 'KE', name: 'Quénia' },
  { code: 'KG', name: 'Quirguistão' }, { code: 'KH', name: 'Camboja' }, { code: 'KI', name: 'Quiribati' },
  { code: 'KM', name: 'Comores' }, { code: 'KN', name: 'São Cristóvão e Neves' }, { code: 'KP', name: 'Coreia do Norte' },
  { code: 'KR', name: 'Coreia do Sul' }, { code: 'KW', name: 'Kuwait' }, { code: 'KZ', name: 'Cazaquistão' },
  { code: 'LA', name: 'Laos' }, { code: 'LB', name: 'Líbano' }, { code: 'LC', name: 'Santa Lúcia' },
  { code: 'LI', name: 'Liechtenstein' }, { code: 'LK', name: 'Sri Lanka' }, { code: 'LR', name: 'Libéria' },
  { code: 'LS', name: 'Lesoto' }, { code: 'LT', name: 'Lituânia' }, { code: 'LU', name: 'Luxemburgo' },
  { code: 'LV', name: 'Letónia' }, { code: 'LY', name: 'Líbia' }, { code: 'MA', name: 'Marrocos' },
  { code: 'MC', name: 'Mónaco' }, { code: 'MD', name: 'Moldávia' }, { code: 'ME', name: 'Montenegro' },
  { code: 'MG', name: 'Madagáscar' }, { code: 'MH', name: 'Ilhas Marshall' }, { code: 'MK', name: 'Macedónia do Norte' },
  { code: 'ML', name: 'Mali' }, { code: 'MM', name: 'Myanmar' }, { code: 'MN', name: 'Mongólia' },
  { code: 'MR', name: 'Mauritânia' }, { code: 'MT', name: 'Malta' }, { code: 'MU', name: 'Maurícia' },
  { code: 'MV', name: 'Maldivas' }, { code: 'MW', name: 'Malawi' }, { code: 'MX', name: 'México' },
  { code: 'MY', name: 'Malásia' }, { code: 'MZ', name: 'Moçambique' }, { code: 'NA', name: 'Namíbia' },
  { code: 'NE', name: 'Níger' }, { code: 'NG', name: 'Nigéria' }, { code: 'NI', name: 'Nicarágua' },
  { code: 'NL', name: 'Países Baixos' }, { code: 'NO', name: 'Noruega' }, { code: 'NP', name: 'Nepal' },
  { code: 'NR', name: 'Nauru' }, { code: 'NZ', name: 'Nova Zelândia' }, { code: 'OM', name: 'Omã' },
  { code: 'PA', name: 'Panamá' }, { code: 'PE', name: 'Peru' }, { code: 'PG', name: 'Papua Nova Guiné' },
  { code: 'PH', name: 'Filipinas' }, { code: 'PK', name: 'Paquistão' }, { code: 'PL', name: 'Polónia' },
  { code: 'PT', name: 'Portugal' }, { code: 'PW', name: 'Palau' }, { code: 'PY', name: 'Paraguai' },
  { code: 'QA', name: 'Catar' }, { code: 'RO', name: 'Roménia' }, { code: 'RS', name: 'Sérvia' },
  { code: 'RU', name: 'Rússia' }, { code: 'RW', name: 'Ruanda' }, { code: 'SA', name: 'Arábia Saudita' },
  { code: 'SB', name: 'Ilhas Salomão' }, { code: 'SC', name: 'Seicheles' }, { code: 'SD', name: 'Sudão' },
  { code: 'SE', name: 'Suécia' }, { code: 'SG', name: 'Singapura' }, { code: 'SI', name: 'Eslovénia' },
  { code: 'SK', name: 'Eslováquia' }, { code: 'SL', name: 'Serra Leoa' }, { code: 'SM', name: 'San Marino' },
  { code: 'SN', name: 'Senegal' }, { code: 'SO', name: 'Somália' }, { code: 'SR', name: 'Suriname' },
  { code: 'SS', name: 'Sudão do Sul' }, { code: 'ST', name: 'São Tomé e Príncipe' }, { code: 'SV', name: 'El Salvador' },
  { code: 'SY', name: 'Síria' }, { code: 'SZ', name: 'Essuatíni' }, { code: 'TD', name: 'Chade' },
  { code: 'TG', name: 'Togo' }, { code: 'TH', name: 'Tailândia' }, { code: 'TJ', name: 'Tajiquistão' },
  { code: 'TL', name: 'Timor-Leste' }, { code: 'TM', name: 'Turquemenistão' }, { code: 'TN', name: 'Tunísia' },
  { code: 'TO', name: 'Tonga' }, { code: 'TR', name: 'Turquia' }, { code: 'TT', name: 'Trindade e Tobago' },
  { code: 'TV', name: 'Tuvalu' }, { code: 'TZ', name: 'Tanzânia' }, { code: 'UA', name: 'Ucrânia' },
  { code: 'UG', name: 'Uganda' }, { code: 'US', name: 'Estados Unidos' }, { code: 'UY', name: 'Uruguai' },
  { code: 'UZ', name: 'Uzbequistão' }, { code: 'VA', name: 'Vaticano' }, { code: 'VC', name: 'São Vicente e Granadinas' },
  { code: 'VE', name: 'Venezuela' }, { code: 'VN', name: 'Vietname' }, { code: 'VU', name: 'Vanuatu' },
  { code: 'WS', name: 'Samoa' }, { code: 'YE', name: 'Iémen' }, { code: 'ZA', name: 'África do Sul' },
  { code: 'ZM', name: 'Zâmbia' }, { code: 'ZW', name: 'Zimbabwe' }
];

const PAISES_OPTIONS = PAISES_ISO.map(p => ({ value: p.code, label: `${p.code} – ${p.name}` }));

// Exportar o formulário separadamente para uso em outros componentes
export function FormCompanhia({ companhia, onSave, onCancel }) {
  const { t } = useI18n();
  const { isSubmitting, guardedSubmit } = useSubmitGuard();
  const [formData, setFormData] = useState(companhia || {
    codigo_icao: '',
    codigo_iata: '',
    nome: '',
    nacionalidade: '',
    tipo: 'comercial',
    status: 'ativa'
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    guardedSubmit(async () => {
      await onSave(formData);
    });
  };

  const tipoOptions = [
  { value: 'comercial', label: 'Comercial' },
  { value: 'carga', label: 'Carga' },
  { value: 'privada', label: 'Privada' },
  { value: 'charter', label: 'Charter' },
  { value: 'militar', label: 'Militar' }];


  const statusOptions = [
  { value: 'ativa', label: 'Ativa' },
  { value: 'suspensa', label: 'Suspensa' },
  { value: 'inativa', label: 'Inativa' }];


  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>{t('configCompanhias.codigoICAO')} *</Label>
          <Input
            value={formData.codigo_icao}
            onChange={(e) => setFormData({ ...formData, codigo_icao: e.target.value.toUpperCase() })}
            required
            maxLength={3}
            placeholder="Ex: DTA" />

        </div>
        <div>
          <Label>{t('configCompanhias.codigoIATA')}</Label>
          <Input
            value={formData.codigo_iata}
            onChange={(e) => setFormData({ ...formData, codigo_iata: e.target.value.toUpperCase() })}
            maxLength={2}
            placeholder="Ex: DT" />

        </div>
        <div className="col-span-2">
          <Label>{t('configCompanhias.nome')} *</Label>
          <Input
            value={formData.nome}
            onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
            required
            placeholder="Ex: TAAG Linhas Aéreas de Angola" />

        </div>
        <div>
          <Label>{t('configCompanhias.nacionalidade')}</Label>
          <Combobox
            options={PAISES_OPTIONS}
            value={formData.nacionalidade}
            onValueChange={(v) => setFormData({ ...formData, nacionalidade: v })}
            placeholder={t('configCompanhias.pesquisarPais')} />
        </div>
        <div>
          <Label>{t('configCompanhias.tipo')} *</Label>
          <Select
            options={tipoOptions}
            value={formData.tipo}
            onValueChange={(v) => setFormData({ ...formData, tipo: v })} />

        </div>
        <div>
          <Label>{t('configCompanhias.status')}</Label>
          <Select
            options={statusOptions}
            value={formData.status}
            onValueChange={(v) => setFormData({ ...formData, status: v })} />

        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>{t('configCompanhias.cancelar')}</Button>
        <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">{isSubmitting ? t('configCompanhias.aGuardar') : t('configCompanhias.salvar')}</Button>
      </DialogFooter>
    </form>);

}

export default function CompanhiasConfig({ companhias, onUpdate }) {
  const { t } = useI18n();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCompanhia, setEditingCompanhia] = useState(null);
  const [filtros, setFiltros] = useState({
    tipo: 'todos',
    status: 'todos',
    busca: ''
  });
  const [sortField, setSortField] = useState('nome');
  const [sortDirection, setSortDirection] = useState('asc');

  const [currentUser, setCurrentUser] = useState(null);
  const [alertInfo, setAlertInfo] = useState({ isOpen: false, type: '', title: '', message: '', showCancel: false, confirmText: 'Confirmar', onConfirm: () => {} });
  const [successInfo, setSuccessInfo] = useState({ isOpen: false, title: '', message: '' });

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await User.me();
        setCurrentUser(user);
      } catch (error) {
        console.error('Erro ao carregar utilizador:', error);
      }
    };
    loadUser();
  }, []);

  const isAdmin = currentUser?.role === 'admin' ||
  currentUser?.perfis && currentUser.perfis.includes('administrador');

  const handleSort = (field, direction) => {
    setSortField(field);
    setSortDirection(direction);
  };

  const companhiasFiltradas = useMemo(() => {
    let filtered = companhias.filter((c) => {
      const tipoMatch = filtros.tipo === 'todos' || c.tipo === filtros.tipo;
      const statusMatch = filtros.status === 'todos' || c.status === filtros.status;
      const buscaMatch = !filtros.busca ||
      c.nome?.toLowerCase().includes(filtros.busca.toLowerCase()) ||
      c.codigo_icao?.toLowerCase().includes(filtros.busca.toLowerCase()) ||
      c.nacionalidade?.toLowerCase().includes(filtros.busca.toLowerCase());

      return tipoMatch && statusMatch && buscaMatch;
    });

    // Ordenação
    filtered.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [companhias, filtros, sortField, sortDirection]);

  const handleOpenForm = (companhia = null) => {
    setEditingCompanhia(companhia);
    setIsFormOpen(true);
  };

  const handleSave = async (formData) => {
    try {
      // Validar duplicidade de código ICAO
      const codigoIcaoNormalizado = formData.codigo_icao.trim().toUpperCase();
      let companhiaDuplicada = companhias.find(
        (c) => c.codigo_icao?.trim().toUpperCase() === codigoIcaoNormalizado && 
        (!editingCompanhia || c.id !== editingCompanhia.id)
      );

      // Verificar também diretamente na BD para evitar race conditions
      if (!companhiaDuplicada && !editingCompanhia) {
        const existingInDB = await CompanhiaAerea.filter({ codigo_icao: codigoIcaoNormalizado });
        if (existingInDB && existingInDB.length > 0) {
          companhiaDuplicada = existingInDB[0];
        }
      }

      if (companhiaDuplicada) {
        setAlertInfo({
          isOpen: true,
          type: 'error',
          title: '❌ Código ICAO Duplicado',
          message: `O código ICAO "${codigoIcaoNormalizado}" já está registado para a companhia "${companhiaDuplicada.nome}".\n\n⚠️ Cada companhia deve ter um código ICAO único.\n\n💡 Por favor, verifique o código ou edite a companhia existente.`
        });
        return;
      }

      if (editingCompanhia) {
        await CompanhiaAerea.update(editingCompanhia.id, formData);
      } else {
        await CompanhiaAerea.create(formData);
      }
      setIsFormOpen(false);
      setEditingCompanhia(null);
      onUpdate();
      setSuccessInfo({
        isOpen: true,
        title: 'Sucesso!',
        message: `Companhia "${formData.nome}" salva com sucesso.`
      });
    } catch (error) {
      console.error('Erro ao salvar companhia:', error);
      
      const errorMessage = error.message?.toLowerCase() || '';
      const errorDetails = error.response?.data?.message?.toLowerCase() || '';
      const status = error.response?.status;

      if (
        errorMessage.includes('duplicate') ||
        errorMessage.includes('unique') ||
        errorMessage.includes('already exists') ||
        errorDetails.includes('duplicate') ||
        errorDetails.includes('unique') ||
        status === 409
      ) {
        setAlertInfo({
          isOpen: true,
          type: 'error',
          title: '❌ Código ICAO Duplicado',
          message: `O código ICAO "${formData.codigo_icao}" já está registado no sistema.\n\n⚠️ Cada companhia deve ter um código ICAO único.\n\n💡 Por favor, utilize um código diferente ou edite a companhia existente.`
        });
      } else {
        setAlertInfo({
          isOpen: true,
          type: 'error',
          title: 'Erro ao Salvar',
          message: error.message || 'Erro ao salvar companhia. Verifique os dados e tente novamente.'
        });
      }
    }
  };

  const handleDelete = async (companhia) => {
    if (!isAdmin) {
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Acesso Negado',
        message: 'Apenas administradores podem excluir companhias aéreas.',
        showCancel: false,
        confirmText: 'Ok',
        onConfirm: () => setAlertInfo((prev) => ({ ...prev, isOpen: false }))
      });
      return;
    }

    try {
      // Verificar se há voos associados
      const { Voo } = await import('@/entities/Voo');
      const voosComCompanhia = await Voo.filter({
        companhia_aerea: companhia.codigo_icao
      });

      // Verificar se há registos de aeronaves associados
      const { RegistoAeronave } = await import('@/entities/RegistoAeronave');
      const aeronavesComCompanhia = await RegistoAeronave.filter({
        id_companhia_aerea: companhia.id
      });

      // Corrected variable names: voosComCompanhia, aeronavesComCompanhia
      if (voosComCompanhia.length > 0 || aeronavesComCompanhia.length > 0) {
        let message = 'Esta companhia não pode ser excluída porque existem:\n';
        if (voosComCompanhia.length > 0) {
          message += `\n• ${voosComCompanhia.length} voo(s) registado(s)`;
        }
        if (aeronavesComCompanhia.length > 0) {
          message += `\n• ${aeronavesComCompanhia.length} aeronave(s) registada(s)`;
        }
        message += '\n\nPor favor, remova ou migre esses registos primeiro.';

        setAlertInfo({
          isOpen: true,
          type: 'error',
          title: 'Não É Possível Excluir',
          message: message,
          showCancel: false,
          confirmText: 'Ok',
          onConfirm: () => setAlertInfo((prev) => ({ ...prev, isOpen: false }))
        });
        return;
      }

      setAlertInfo({
        isOpen: true,
        type: 'warning',
        title: 'Confirmar Exclusão',
        message: `Tem certeza que deseja excluir a companhia "${companhia.nome}" (${companhia.codigo_icao})? Esta ação é irreversível.`,
        showCancel: true,
        confirmText: 'Excluir',
        onConfirm: async () => {
          setAlertInfo((prev) => ({ ...prev, isOpen: false }));
          try {
            await CompanhiaAerea.delete(companhia.id);
            onUpdate(); // Usar onUpdate em vez de onReload
            setSuccessInfo({
              isOpen: true,
              title: 'Companhia Excluída!',
              message: `A companhia "${companhia.nome}" foi excluída com sucesso.`
            });
          } catch (error) {
            console.error('Erro ao excluir companhia:', error);
            setAlertInfo({
              isOpen: true,
              type: 'error',
              title: 'Erro ao Excluir',
              message: error.message || 'Não foi possível excluir a companhia. Tente novamente mais tarde.'
            });
          }
        }
      });
    } catch (error) {
      console.error('Erro ao verificar dependências:', error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro',
        message: 'Erro ao verificar dependências da companhia. Tente novamente mais tarde.'
      });
    }
  };

  const tipoOptions = [
  { value: 'todos', label: t('configCompanhias.todosTipos') },
  { value: 'comercial', label: 'Comercial' },
  { value: 'carga', label: 'Carga' },
  { value: 'privada', label: 'Privada' },
  { value: 'charter', label: 'Charter' },
  { value: 'militar', label: 'Militar' }];


  const statusOptions = [
  { value: 'todos', label: t('configCompanhias.todosStatus') },
  { value: 'ativa', label: 'Ativa' },
  { value: 'suspensa', label: 'Suspensa' },
  { value: 'inativa', label: 'Inativa' }];


  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t('configCompanhias.titulo')}</CardTitle>
          <Button onClick={() => handleOpenForm()} size="sm" className="bg-blue-600 text-slate-50 px-3 text-sm font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:bg-blue-600 /90 h-9">
            <Plus className="w-4 h-4 mr-2" />
            {t('configCompanhias.novaCompanhia')}
          </Button>
        </CardHeader>
        <CardContent>
          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <Label>{t('configCompanhias.pesquisar')}</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-500" />
                <Input
                  placeholder={t('configCompanhias.pesquisarPlaceholder')}
                  value={filtros.busca}
                  onChange={(e) => setFiltros({ ...filtros, busca: e.target.value })}
                  className="pl-8" />

              </div>
            </div>
            <div>
              <Label>{t('configCompanhias.tipo')}</Label>
              <Combobox
                options={tipoOptions}
                value={filtros.tipo}
                onValueChange={(v) => setFiltros({ ...filtros, tipo: v })}
                placeholder={t('configCompanhias.pesquisarTipo')} />

            </div>
            <div>
              <Label>{t('configCompanhias.status')}</Label>
              <Combobox
                options={statusOptions}
                value={filtros.status}
                onValueChange={(v) => setFiltros({ ...filtros, status: v })}
                placeholder={t('configCompanhias.pesquisarStatus')} />

            </div>
          </div>

          {/* Tabela */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHeader
                    field="codigo_icao"
                    label={t('configCompanhias.icao')}
                    currentSortField={sortField}
                    currentSortDirection={sortDirection}
                    onSort={handleSort} />

                  <SortableTableHeader
                    field="nome"
                    label={t('configCompanhias.nome')}
                    currentSortField={sortField}
                    currentSortDirection={sortDirection}
                    onSort={handleSort} />

                  <SortableTableHeader
                    field="nacionalidade"
                    label={t('configCompanhias.nacionalidade')}
                    currentSortField={sortField}
                    currentSortDirection={sortDirection}
                    onSort={handleSort} />

                  <SortableTableHeader
                    field="tipo"
                    label={t('configCompanhias.tipo')}
                    currentSortField={sortField}
                    currentSortDirection={sortDirection}
                    onSort={handleSort} />

                  <SortableTableHeader
                    field="status"
                    label={t('configCompanhias.status')}
                    currentSortField={sortField}
                    currentSortDirection={sortDirection}
                    onSort={handleSort} />

                  <TableHead>{t('configCompanhias.ultimaAtualizacao')}</TableHead>
                  <TableHead className="text-right">{t('configCompanhias.acoes')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companhiasFiltradas.map((companhia) =>
                <TableRow key={companhia.id}>
                    <TableCell className="font-medium">{companhia.codigo_icao}</TableCell>
                    <TableCell>{companhia.nome}</TableCell>
                    <TableCell>{companhia.nacionalidade}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{companhia.tipo}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={
                    companhia.status === 'ativa' ? 'bg-green-100 text-green-800' :
                    companhia.status === 'suspensa' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                    }>
                        {companhia.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-slate-600 font-medium">
                          {(companhia.updated_by || companhia.created_by)?.split('@')[0] || 'Sistema'}
                        </span>
                        <span className="text-slate-400">
                          {new Date(companhia.updated_date || companhia.created_date).toLocaleString('pt-PT', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenForm(companhia)}>

                          <Edit className="w-4 h-4" />
                        </Button>
                        {isAdmin &&
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(companhia)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50">

                            <Trash2 className="w-4 h-4" />
                          </Button>
                      }
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog de Formulário */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingCompanhia ? t('configCompanhias.editarCompanhia') : t('configCompanhias.novaCompanhia')}</DialogTitle>
          </DialogHeader>
          <FormCompanhia
            companhia={editingCompanhia}
            onSave={handleSave}
            onCancel={() => {
              setIsFormOpen(false);
              setEditingCompanhia(null);
            }} />

        </DialogContent>
      </Dialog>

      {/* Custom Alert Dialog */}
      <Dialog open={alertInfo.isOpen} onOpenChange={(open) => setAlertInfo((prev) => ({ ...prev, isOpen: open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{alertInfo.title}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="whitespace-pre-line">{alertInfo.message}</p>
          </div>
          <DialogFooter>
            {alertInfo.showCancel &&
            <Button variant="outline" onClick={() => setAlertInfo((prev) => ({ ...prev, isOpen: false }))}>
                {t('configCompanhias.cancelar')}
              </Button>
            }
            <Button onClick={alertInfo.onConfirm || (() => setAlertInfo((prev) => ({ ...prev, isOpen: false })))}>
              {alertInfo.confirmText}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom Success Dialog */}
      <Dialog open={successInfo.isOpen} onOpenChange={(open) => setSuccessInfo((prev) => ({ ...prev, isOpen: open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{successInfo.title}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>{successInfo.message}</p>
          </div>
          <DialogFooter>
            <Button onClick={() => setSuccessInfo((prev) => ({ ...prev, isOpen: false }))}>
              Ok
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>);

}