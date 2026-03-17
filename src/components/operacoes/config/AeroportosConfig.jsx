import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Edit, Trash2, Search, MapPin, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import Select from '@/components/ui/select';
import Combobox from '@/components/ui/combobox';
import { base44 } from '@/api/base44Client';
import AlertModal from '../../shared/AlertModal';
import SuccessModal from '../../shared/SuccessModal';
import SortableTableHeader from '../../shared/SortableTableHeader';
import { User } from '@/entities/User';
import { Empresa } from '@/entities/Empresa';
import { isSuperAdmin } from '@/components/lib/userUtils';
import useSubmitGuard from '@/hooks/useSubmitGuard';

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

const STATUS_CONFIG = {
  operacional: { label: 'Operacional', color: 'bg-green-100 text-green-800' },
  atencao: { label: 'Atenção', color: 'bg-yellow-100 text-yellow-800' },
  critico: { label: 'Crítico', color: 'bg-red-100 text-red-800' }
};

const CATEGORIA_CONFIG = {
  categoria_1: { label: 'Categoria 1', color: 'bg-blue-100 text-blue-800' },
  categoria_2: { label: 'Categoria 2', color: 'bg-indigo-100 text-indigo-800' },
  categoria_3: { label: 'Categoria 3', color: 'bg-purple-100 text-purple-800' },
  categoria_4: { label: 'Categoria 4', color: 'bg-pink-100 text-pink-800' }
};

// Exportar o formulário separadamente para uso em outros componentes
export function FormAeroporto({ aeroporto, onSave, onCancel, empresas = [] }) {
  const { isSubmitting, guardedSubmit } = useSubmitGuard();
  const [formData, setFormData] = useState(aeroporto ? {
    id: aeroporto.id,
    codigo_icao: aeroporto.codigo_icao || '',
    codigo_iata: aeroporto.codigo_iata || '',
    nome: aeroporto.nome || '',
    cidade: aeroporto.cidade || '',
    provincia: aeroporto.provincia || '',
    pais: aeroporto.pais || 'AO',
    tipo_operacao: aeroporto.tipo_operacao || 'DOM',
    latitude: aeroporto.latitude || '',
    longitude: aeroporto.longitude || '',
    soleiras: aeroporto.soleiras || '',
    categoria: aeroporto.categoria || 'categoria_1',
    status: aeroporto.status || 'operacional',
    isSGA: aeroporto.isSGA || false,
    empresa_id: aeroporto.empresa_id || ''
  } : {
    id: null,
    codigo_icao: '',
    codigo_iata: '',
    nome: '',
    cidade: '',
    provincia: '',
    pais: 'AO',
    tipo_operacao: 'DOM',
    latitude: '',
    longitude: '',
    soleiras: '',
    categoria: 'categoria_1',
    status: 'operacional',
    isSGA: false,
    empresa_id: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validação básica
    if (!formData.codigo_icao || !formData.nome || !formData.cidade) {
      alert('Por favor, preencha todos os campos obrigatórios (Código ICAO, Nome e Cidade).');
      return;
    }

    guardedSubmit(async () => {
      // Normalizar dados antes de salvar
      const dataToSave = {
        id: formData.id,
        codigo_icao: formData.codigo_icao.toUpperCase(),
        codigo_iata: formData.codigo_iata?.toUpperCase() || '',
        nome: formData.nome,
        cidade: formData.cidade,
        provincia: formData.provincia,
        pais: formData.pais.toUpperCase(),
        tipo_operacao: formData.tipo_operacao,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
        soleiras: formData.soleiras,
        categoria: formData.categoria,
        status: formData.status,
        isSGA: formData.isSGA,
        empresa_id: formData.empresa_id || null
      };

      await onSave(dataToSave);
    });
  };

  const empresaOptions = [
    { value: '', label: 'Nenhuma empresa' },
    ...empresas.map(e => ({ value: e.id, label: e.nome }))
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Código ICAO *</Label>
          <Input
            value={formData.codigo_icao}
            onChange={(e) => setFormData({ ...formData, codigo_icao: e.target.value.toUpperCase() })}
            maxLength={4}
            placeholder="FNLU"
            required />

        </div>
        <div>
          <Label>Código IATA</Label>
          <Input
            value={formData.codigo_iata}
            onChange={(e) => setFormData({ ...formData, codigo_iata: e.target.value.toUpperCase() })}
            maxLength={3}
            placeholder="LAD" />

        </div>
        <div className="col-span-2">
          <Label>Nome *</Label>
          <Input
            value={formData.nome}
            onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
            placeholder="Aeroporto Internacional 4 de Fevereiro"
            required />

        </div>
        <div>
          <Label>Cidade *</Label>
          <Input
            value={formData.cidade}
            onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
            placeholder="Luanda"
            required />

        </div>
        <div>
          <Label>Província</Label>
          <Input
            value={formData.provincia}
            onChange={(e) => setFormData({ ...formData, provincia: e.target.value })}
            placeholder="Luanda" />

        </div>
        <div>
          <Label>País *</Label>
          <Combobox
            options={PAISES_OPTIONS}
            value={formData.pais}
            onValueChange={(v) => setFormData({ ...formData, pais: v })}
            placeholder="Pesquisar país (código ou nome)..." />
        </div>
        <div>
          <Label>Tipo de Operação</Label>
          <Select
            options={[
            { value: 'DOM', label: 'Doméstico' },
            { value: 'INT', label: 'Internacional' }]
            }
            value={formData.tipo_operacao}
            onValueChange={(value) => setFormData({ ...formData, tipo_operacao: value })} />

        </div>
        <div>
          <Label>Categoria</Label>
          <Select
            options={[
            { value: 'categoria_1', label: 'Categoria 1' },
            { value: 'categoria_2', label: 'Categoria 2' },
            { value: 'categoria_3', label: 'Categoria 3' },
            { value: 'categoria_4', label: 'Categoria 4' }]
            }
            value={formData.categoria}
            onValueChange={(value) => setFormData({ ...formData, categoria: value })} />

        </div>
        <div>
          <Label>Status</Label>
          <Select
            options={[
            { value: 'operacional', label: 'Operacional' },
            { value: 'atencao', label: 'Atenção' },
            { value: 'critico', label: 'Crítico' }]
            }
            value={formData.status}
            onValueChange={(value) => setFormData({ ...formData, status: value })} />

        </div>
        <div>
          <Label>Latitude</Label>
          <Input
            type="number"
            step="0.000001"
            value={formData.latitude}
            onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
            placeholder="-8.858611" />

        </div>
        <div>
          <Label>Longitude</Label>
          <Input
            type="number"
            step="0.000001"
            value={formData.longitude}
            onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
            placeholder="13.231667" />

        </div>
        <div className="col-span-2">
          <Label>Soleiras (separadas por ;)</Label>
          <Input
            value={formData.soleiras}
            onChange={(e) => setFormData({ ...formData, soleiras: e.target.value })}
            placeholder="05;23" />

        </div>

        <div className="col-span-2">
          <Label>Empresa</Label>
          <select
            value={formData.empresa_id || ''}
            onChange={(e) => setFormData({ ...formData, empresa_id: e.target.value })}
            className="w-full h-10 px-3 py-2 border border-slate-200 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {empresaOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="col-span-2 flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <Checkbox
            id="isSGA"
            checked={formData.isSGA || false}
            onCheckedChange={(checked) => setFormData({ ...formData, isSGA: checked })}
          />
          <Label htmlFor="isSGA" className="cursor-pointer mb-0">
            É aeroporto da SGA
          </Label>
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-6">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
          {isSubmitting ? 'A guardar...' : 'Salvar'}
        </Button>
      </div>
    </form>);

}

export default function AeroportosConfig({ aeroportos, onReload }) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAeroporto, setEditingAeroporto] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [apernasSGA, setApenaSGA] = useState(false);
  const [filterPais, setFilterPais] = useState('todos');
  const [filterEmpresa, setFilterEmpresa] = useState('todos');
  const [sortField, setSortField] = useState('nome');
  const [sortDirection, setSortDirection] = useState('asc');
  const [alertInfo, setAlertInfo] = useState({ isOpen: false, type: 'info', title: '', message: '' });
  const [successInfo, setSuccessInfo] = useState({ isOpen: false, title: '', message: '' });
  const [currentUser, setCurrentUser] = useState(null);
  const [empresas, setEmpresas] = useState([]);
  const [selectedAeroportos, setSelectedAeroportos] = useState(new Set());
  const [isUpdatingBulk, setIsUpdatingBulk] = useState(false);

  React.useEffect(() => {
    const loadData = async () => {
      try {
        const [user, empresasList] = await Promise.all([
          base44.auth.me(),
          Empresa.list()
        ]);
        setCurrentUser(user);
        setEmpresas(empresasList || []);
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
      }
    };
    loadData();
  }, []);

  const isAdmin = currentUser?.role === 'admin' ||
  currentUser?.perfis && currentUser.perfis.includes('administrador');

  const paises = useMemo(() => {
    const uniquePaises = [...new Set(aeroportos.map((a) => a.pais))];
    return [
      { value: 'todos', label: 'Todos os Países' },
      ...uniquePaises.map((p) => ({ value: p, label: p }))
    ];
  }, [aeroportos]);

  const handleSort = (field, direction) => {
    setSortField(field);
    setSortDirection(direction);
  };

  const handleOpenForm = (aeroporto = null) => {
    setEditingAeroporto(aeroporto);
    setIsFormOpen(true);
  };

  const handleSave = async (formData) => {
    try {
      // Validar duplicidade de código ICAO
      const codigoIcaoNormalizado = formData.codigo_icao.trim().toUpperCase();
      let aeroportoDuplicado = aeroportos.find(
        (a) => a.codigo_icao?.trim().toUpperCase() === codigoIcaoNormalizado && 
        (!editingAeroporto || a.id !== editingAeroporto.id)
      );

      // Verificar também diretamente na BD para evitar race conditions
      if (!aeroportoDuplicado && !editingAeroporto) {
        const existingInDB = await base44.entities.Aeroporto.filter({ codigo_icao: codigoIcaoNormalizado });
        if (existingInDB && existingInDB.length > 0) {
          aeroportoDuplicado = existingInDB[0];
        }
      }

      if (aeroportoDuplicado) {
        setAlertInfo({
          isOpen: true,
          type: 'error',
          title: '❌ Código ICAO Duplicado',
          message: `O código ICAO "${codigoIcaoNormalizado}" já está registado para o aeroporto "${aeroportoDuplicado.nome}" (${aeroportoDuplicado.cidade}).\n\n⚠️ Cada aeroporto deve ter um código ICAO único.\n\n💡 Por favor, verifique o código ou edite o aeroporto existente.`
        });
        return;
      }

      if (editingAeroporto) {
        await base44.entities.Aeroporto.update(editingAeroporto.id, formData);
      } else {
        await base44.entities.Aeroporto.create(formData);
      }

      setIsFormOpen(false);
      setEditingAeroporto(null);
      onReload();

      setSuccessInfo({
        isOpen: true,
        title: editingAeroporto ? 'Aeroporto Atualizado!' : 'Aeroporto Criado!',
        message: `O aeroporto ${formData.nome} foi ${editingAeroporto ? 'atualizado' : 'criado'} com sucesso.`
      });
    } catch (error) {
      console.error('Erro ao salvar aeroporto:', error);
      
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
          message: `O código ICAO "${formData.codigo_icao}" já está registado no sistema.\n\n⚠️ Cada aeroporto deve ter um código ICAO único.\n\n💡 Por favor, utilize um código diferente ou edite o aeroporto existente.`
        });
      } else {
        setAlertInfo({
          isOpen: true,
          type: 'error',
          title: 'Erro ao Salvar',
          message: error.message || 'Não foi possível salvar o aeroporto.'
        });
      }
    }
  };

  const handleDelete = async (aeroporto) => {
    if (!isAdmin) {
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Acesso Negado',
        message: 'Apenas administradores podem excluir aeroportos.'
      });
      return;
    }

    try {
      // Verificar se há voos associados
      const voosComAeroporto = await base44.entities.Voo.filter({
        aeroporto_operacao: aeroporto.codigo_icao
      });

      if (voosComAeroporto.length > 0) {
        setAlertInfo({
          isOpen: true,
          type: 'error',
          title: 'Não É Possível Excluir',
          message: `❌ Este aeroporto não pode ser excluído porque existem ${voosComAeroporto.length} voo(s) registado(s) nele.\n\n⚠️ Excluir este aeroporto causaria inconsistências nos dados históricos de voos.\n\n💡 Sugestão: Em vez de excluir, considere alterar o status do aeroporto para "Inativo" ou "Crítico" nas configurações.`
        });
        return;
      }

      setAlertInfo({
        isOpen: true,
        type: 'warning',
        title: 'Confirmar Exclusão',
        message: `⚠️ Tem certeza que deseja excluir o aeroporto "${aeroporto.nome}" (${aeroporto.codigo_icao})?\n\n❗ Esta ação é irreversível e o aeroporto será permanentemente removido do sistema.`,
        showCancel: true,
        confirmText: 'Sim, Excluir',
        onConfirm: async () => {
          setAlertInfo((prev) => ({ ...prev, isOpen: false }));
          try {
            await base44.entities.Aeroporto.delete(aeroporto.id);
            onReload();
            setSuccessInfo({
              isOpen: true,
              title: 'Aeroporto Excluído!',
              message: `O aeroporto "${aeroporto.nome}" foi excluído com sucesso.`
            });
          } catch (error) {
            console.error('Erro ao excluir aeroporto:', error);
            setAlertInfo({
              isOpen: true,
              type: 'error',
              title: 'Erro ao Excluir',
              message: error.message || 'Não foi possível excluir o aeroporto.'
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
        message: 'Erro ao verificar dependências do aeroporto.'
      });
    }
  };

  const handleBulkToggleSGA = async (value) => {
    if (selectedAeroportos.size === 0) {
      setAlertInfo({
        isOpen: true,
        type: 'warning',
        title: 'Nenhum Aeroporto Selecionado',
        message: 'Por favor, selecione pelo menos um aeroporto para atualizar.'
      });
      return;
    }

    setIsUpdatingBulk(true);
    try {
      const updatePromises = Array.from(selectedAeroportos).map(id => {
        const aeroporto = aeroportos.find(a => a.id === id);
        return base44.entities.Aeroporto.update(id, { ...aeroporto, isSGA: value });
      });

      await Promise.all(updatePromises);

      setSelectedAeroportos(new Set());
      onReload();

      setSuccessInfo({
        isOpen: true,
        title: 'Aeroportos Atualizados!',
        message: `${selectedAeroportos.size} aeroporto(s) foram ${value ? 'marcado(s)' : 'desmarcado(s)'} como SGA com sucesso.`
      });
    } catch (error) {
      console.error('Erro ao atualizar em massa:', error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro ao Atualizar',
        message: error.message || 'Erro ao atualizar aeroportos em massa.'
      });
    } finally {
      setIsUpdatingBulk(false);
    }
  };

  const toggleSelectAeroporto = (id) => {
    const newSelected = new Set(selectedAeroportos);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedAeroportos(newSelected);
  };

  const toggleSelectAll = (checked) => {
    if (checked) {
      setSelectedAeroportos(new Set(filteredAeroportos.map(a => a.id)));
    } else {
      setSelectedAeroportos(new Set());
    }
  };



  const filteredAeroportos = useMemo(() => {
    let filtered = aeroportos.filter((aeroporto) => {
      const searchMatch = !searchTerm ||
      aeroporto.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      aeroporto.codigo_icao?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      aeroporto.cidade?.toLowerCase().includes(searchTerm.toLowerCase());

      const sgaMatch = !apernasSGA || aeroporto.isSGA === true;
      const paisMatch = filterPais === 'todos' || aeroporto.pais === filterPais;
      const empresaMatch = filterEmpresa === 'todos' || aeroporto.empresa_id === filterEmpresa;

      return searchMatch && sgaMatch && paisMatch && empresaMatch;
    });

    // Aplicar ordenação
    filtered.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      // Tratar valores especiais
      if (sortField === 'cidade') {
        aVal = `${a.cidade}, ${a.pais}`;
        bVal = `${b.cidade}, ${b.pais}`;
      }

      if (aVal === null || aVal === undefined) aVal = '';
      if (bVal === null || bVal === undefined) bVal = '';

      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      if (sortDirection === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });

    return filtered;
  }, [aeroportos, searchTerm, apernasSGA, filterPais, filterEmpresa, sortField, sortDirection]);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Aeroportos
          </CardTitle>
          <Button onClick={() => handleOpenForm()} className="bg-blue-600 text-slate-50 px-4 py-2 text-sm font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 h-10 hover:bg-blue-600/90">
            <Plus className="w-4 h-4 mr-2" />
            Novo Aeroporto
          </Button>
        </CardHeader>
        <CardContent>
          {/* Filtros */}
          <div className="space-y-4 mb-4">
            {isSuperAdmin(currentUser) && (
              <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <Checkbox
                  id="apenas-sga"
                  checked={apernasSGA}
                  onCheckedChange={setApenaSGA}
                />
                <Label htmlFor="apenas-sga" className="cursor-pointer mb-0">
                  Apenas Aeroportos SGA
                </Label>
              </div>
            )}

            <div className="flex gap-4">
              <div className="flex-[2] relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Pesquisar por nome, código ICAO ou cidade..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10" />
              </div>
              <Select
                options={paises}
                value={filterPais}
                onValueChange={setFilterPais}
                className="flex-[1]" />
              {isSuperAdmin(currentUser) && (
                <Select
                  options={[
                    { value: 'todos', label: 'Todas as Empresas' },
                    ...empresas.map(e => ({ value: e.id, label: e.nome }))
                  ]}
                  value={filterEmpresa}
                  onValueChange={setFilterEmpresa}
                  className="flex-[1]" />
              )}
            </div>
          </div>

          {/* Ações em Massa */}
          {selectedAeroportos.size > 0 && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">
                {selectedAeroportos.size} aeroporto(s) selecionado(s)
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkToggleSGA(true)}
                  disabled={isUpdatingBulk}
                  className="text-green-600 border-green-200 hover:bg-green-50"
                >
                  Marcar como SGA
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkToggleSGA(false)}
                  disabled={isUpdatingBulk}
                  className="text-red-600 border-red-200 hover:bg-red-50"
                >
                  Desmarcar SGA
                </Button>
              </div>
            </div>
          )}

          {/* Tabela */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left w-10">
                    <Checkbox
                      checked={selectedAeroportos.size === filteredAeroportos.length && filteredAeroportos.length > 0}
                      indeterminate={selectedAeroportos.size > 0 && selectedAeroportos.size < filteredAeroportos.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </th>
                  <th className="px-4 py-3 text-left">
                    <SortableTableHeader
                      field="codigo_icao"
                      label="Código ICAO"
                      currentSortField={sortField}
                      currentSortDirection={sortDirection}
                      onSort={handleSort}
                    />
                  </th>
                  <th className="px-4 py-3 text-left">
                    <SortableTableHeader
                      field="nome"
                      label="Nome"
                      currentSortField={sortField}
                      currentSortDirection={sortDirection}
                      onSort={handleSort}
                    />
                  </th>
                  <th className="px-4 py-3 text-left">
                    <SortableTableHeader
                      field="cidade"
                      label="Cidade/País"
                      currentSortField={sortField}
                      currentSortDirection={sortDirection}
                      onSort={handleSort}
                    />
                  </th>
                  <th className="px-4 py-3 text-left">
                    <SortableTableHeader
                      field="categoria"
                      label="Categoria"
                      currentSortField={sortField}
                      currentSortDirection={sortDirection}
                      onSort={handleSort}
                    />
                  </th>
                  <th className="px-4 py-3 text-center">
                    <SortableTableHeader
                      field="isSGA"
                      label="SGA"
                      currentSortField={sortField}
                      currentSortDirection={sortDirection}
                      onSort={handleSort}
                    />
                  </th>
                  <th className="px-4 py-3 text-left">
                    <SortableTableHeader
                      field="empresa_id"
                      label="Empresa"
                      currentSortField={sortField}
                      currentSortDirection={sortDirection}
                      onSort={handleSort}
                    />
                  </th>
                  <th className="px-4 py-3 text-left">
                    <SortableTableHeader
                      field="status"
                      label="Status"
                      currentSortField={sortField}
                      currentSortDirection={sortDirection}
                      onSort={handleSort}
                    />
                  </th>
                  <th className="px-4 py-3 text-left">
                    <SortableTableHeader
                      field="updated_date"
                      label="Última Atualização"
                      currentSortField={sortField}
                      currentSortDirection={sortDirection}
                      onSort={handleSort}
                    />
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-600">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredAeroportos.map((aeroporto) =>
                <tr key={aeroporto.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-left w-10">
                      <Checkbox
                        checked={selectedAeroportos.has(aeroporto.id)}
                        onCheckedChange={() => toggleSelectAeroporto(aeroporto.id)}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">
                      {aeroporto.codigo_icao}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{aeroporto.nome}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {aeroporto.cidade}, {aeroporto.pais}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={CATEGORIA_CONFIG[aeroporto.categoria]?.color}>
                        {CATEGORIA_CONFIG[aeroporto.categoria]?.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {aeroporto.isSGA ? (
                        <Badge className="bg-green-100 text-green-800">Sim</Badge>
                      ) : (
                        <Badge variant="secondary">Não</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {empresas.find(e => e.id === aeroporto.empresa_id)?.nome || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={STATUS_CONFIG[aeroporto.status]?.color}>
                        {STATUS_CONFIG[aeroporto.status]?.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-slate-600 font-medium">
                          {(aeroporto.updated_by || aeroporto.created_by)?.split('@')[0] || 'Sistema'}
                        </span>
                        <span className="text-slate-400">
                          {new Date(aeroporto.updated_date || aeroporto.created_date).toLocaleString('pt-PT', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenForm(aeroporto)}>

                          <Edit className="w-4 h-4" />
                        </Button>
                        {isAdmin &&
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(aeroporto)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50">

                            <Trash2 className="w-4 h-4" />
                          </Button>
                      }
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Formulário */}
      {isFormOpen &&
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">
                {editingAeroporto ? 'Editar Aeroporto' : 'Novo Aeroporto'}
              </h2>
              
              <FormAeroporto
              aeroporto={editingAeroporto}
              empresas={empresas}
              onSave={handleSave}
              onCancel={() => {
                setIsFormOpen(false);
                setEditingAeroporto(null);
              }} />

            </div>
          </div>
        </div>
      }

      <AlertModal
        isOpen={alertInfo.isOpen}
        onClose={() => setAlertInfo({ ...alertInfo, isOpen: false })}
        type={alertInfo.type}
        title={alertInfo.title}
        message={alertInfo.message}
        showCancel={alertInfo.showCancel}
        onConfirm={alertInfo.onConfirm}
        confirmText={alertInfo.confirmText} />


      <SuccessModal
        isOpen={successInfo.isOpen}
        onClose={() => setSuccessInfo({ isOpen: false, title: '', message: '' })}
        title={successInfo.title}
        message={successInfo.message} />

    </>);

}