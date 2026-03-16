import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Shield,
  Save,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';

import { RegraPermissao } from '@/entities/RegraPermissao';
import { User } from '@/entities/User';
import AlertModal from '../components/shared/AlertModal';
import { hasUserProfile } from '@/components/lib/userUtils';

// Todas as páginas disponíveis no sistema
const PAGINAS_DISPONIVEIS = [
  {
    key: 'Home',
    label: 'Dashboard',
    descricao: 'Página inicial com estatísticas gerais',
    category: 'Geral',
    icon: '📊'
  },
  {
    key: 'Operacoes',
    label: 'Operações',
    descricao: 'Gestão de voos e operações aeroportuárias',
    category: 'Operações',
    icon: '✈️'
  },
  {
    key: 'FundoManeio',
    label: 'Fundo de Maneio',
    descricao: 'Gestão financeira e tarifas',
    category: 'Operações',
    icon: '💰'
  },
  {
    key: 'Faturacao',
    label: 'Faturação',
    descricao: 'Gestão de cálculos de tarifas e faturas',
    category: 'Operações',
    icon: '🧾'
  },
  {
    key: 'Safety',
    label: 'Safety & Segurança',
    descricao: 'Registo de ocorrências de segurança',
    category: 'Operações',
    icon: '🛡️'
  },
  {
    key: 'Inspecoes',
    label: 'Inspeções',
    descricao: 'Inspeções operacionais e checklists',
    category: 'Operações',
    icon: '✅'
  },
  {
    key: 'KPIsOperacionais',
    label: 'KPIs Operacionais',
    descricao: 'Indicadores de desempenho',
    category: 'Operações',
    icon: '📈'
  },
  {
    key: 'Manutencao',
    label: 'Manutenção',
    descricao: 'Ordens de serviço e manutenção',
    category: 'Infraestrutura',
    icon: '🔧'
  },
  {
    key: 'Auditoria',
    label: 'Auditoria Interna',
    descricao: 'Processos de auditoria e PACs',
    category: 'Gestão',
    icon: '🔍'
  },
  {
    key: 'Reclamacoes',
    label: 'Reclamações',
    descricao: 'Gestão de reclamações de utilizadores',
    category: 'Gestão',
    icon: '💬'
  },
  {
    key: 'Credenciamento',
    label: 'Credenciamento',
    descricao: 'Gestão de credenciais de acesso',
    category: 'Gestão',
    icon: '🆔'
  },
  {
    key: 'GestaoAcessos',
    label: 'Gestão de Acessos',
    descricao: 'Gestão de utilizadores e perfis',
    category: 'Gestão',
    icon: '👥'
  },
  {
    key: 'GRF',
    label: 'GRF - Condições da Pista',
    descricao: 'Registo de condições de pista',
    category: 'Operações',
    icon: '🛬'
  },
  {
    key: 'Documentos',
    label: 'Documentos',
    descricao: 'Repositório de documentos',
    category: 'Geral',
    icon: '📄'
  },
  {
    key: 'LogAuditoria',
    label: 'Log de Auditoria',
    descricao: 'Registo de todas as ações do sistema',
    category: 'Gestão',
    icon: '📋'
  },
  {
    key: 'PowerBi',
    label: 'Power BI',
    descricao: 'Relatórios analíticos de voos (diários, semanais, mensais)',
    category: 'Operações',
    icon: '📊'
  },
  {
    key: 'GerirPermissoes',
    label: 'Gestão de Permissões',
    descricao: 'Configuração de permissões por perfil',
    category: 'Gestão',
    icon: '🔐'
  },
  {
    key: 'GestaoEmpresas',
    label: 'Gestão de Empresas',
    descricao: 'Gestão de empresas, logos e associações',
    category: 'Gestão',
    icon: '🏢'
  },
  {
    key: 'GestaoNotificacoes',
    label: 'Gestão de Notificações',
    descricao: 'Configuração e envio de notificações',
    category: 'Gestão',
    icon: '🔔'
  },
  {
    key: 'ConfiguracoesGerais',
    label: 'Configurações Gerais',
    descricao: 'Configurações do sistema (SMTP, geral)',
    category: 'Gestão',
    icon: '⚙️'
  },
  {
    key: 'GuiaUtilizador',
    label: 'Guia do Utilizador',
    descricao: 'Manual de utilização do sistema',
    category: 'Geral',
    icon: '📖'
  },
  {
    key: 'Suporte',
    label: 'Suporte',
    descricao: 'Contacto e suporte técnico',
    category: 'Geral',
    icon: '🎧'
  },
  {
    key: 'Proforma',
    label: 'Proforma',
    descricao: 'Gestão de faturas proforma',
    category: 'Operações',
    icon: '🧾'
  },
  {
    key: 'ServicosAeroportuarios',
    label: 'Serviços Aeroportuários',
    descricao: 'Serviços de voo, cursos, licenças e bombeiros',
    category: 'Operações',
    icon: '🏢'
  },
  {
    key: 'HistoricoAcessoDocumentos',
    label: 'Histórico de Acesso a Documentos',
    descricao: 'Registo de acessos a documentos',
    category: 'Gestão',
    icon: '📂'
  },
  {
    key: 'TesteFlightradar24',
    label: 'Flightradar24',
    descricao: 'Integração com dados do Flightradar24',
    category: 'Operações',
    icon: '🛫'
  }
];


const PERFIL_INFO = {
  administrador: {
    label: 'Administrador',
    cor: 'bg-red-100 text-red-800 border-red-200',
    descricao: 'Acesso total ao sistema, incluindo gestão de utilizadores e configurações'
  },
  operacoes: {
    label: 'Operações',
    cor: 'bg-blue-100 text-blue-800 border-blue-200',
    descricao: 'Acesso a operações diárias, voos, safety, inspeções e KPIs'
  },
  infraestrutura: {
    label: 'Infraestrutura',
    cor: 'bg-green-100 text-green-800 border-green-200',
    descricao: 'Acesso a manutenção, inspeções de infraestrutura e reclamações'
  },
  credenciamento: {
    label: 'Credenciamento',
    cor: 'bg-purple-100 text-purple-800 border-purple-200',
    descricao: 'Acesso à gestão de credenciais e documentos'
  },
  gestor_empresa: {
    label: 'Gestor de Empresa',
    cor: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    descricao: 'Acesso exclusivo ao portal de credenciamento da empresa'
  },
  visualizador: {
    label: 'Visualizador',
    cor: 'bg-slate-100 text-slate-800 border-slate-200',
    descricao: 'Acesso somente leitura a páginas selecionadas, sem permissão para editar'
  }
};

export default function GerirPermissoes() {
  const [currentUser, setCurrentUser] = useState(null);
  const [regras, setRegras] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editedRegras, setEditedRegras] = useState({});
  const [hasChanges, setHasChanges] = useState(false);
  const [alertInfo, setAlertInfo] = useState({ isOpen: false, type: 'info', title: '', message: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const user = await User.me();
      setCurrentUser(user);

      if (!hasUserProfile(user, 'administrador')) {
        setIsLoading(false);
        return;
      }

      const regrasData = await RegraPermissao.list();
      setRegras(regrasData);

      // Inicializar editedRegras com os dados carregados
      const inicial = {};
      Object.keys(PERFIL_INFO).forEach(perfilKey => { // Ensure all profiles from PERFIL_INFO are initialized
        const existingRegra = regrasData.find((regra) => regra.perfil === perfilKey);
        inicial[perfilKey] = {
          paginas_permitidas: existingRegra ? existingRegra.paginas_permitidas || [] : [],
          descricao: existingRegra ? existingRegra.descricao || '' : ''
        };
      });

      setEditedRegras(inicial);
      setHasChanges(false);
    } catch (error) {
      console.error('Erro ao carregar permissões:', error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro ao Carregar',
        message: 'Não foi possível carregar as regras de permissão.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTogglePagina = (perfil, pageKey) => {
    setEditedRegras((prev) => {
      const perfilRegras = prev[perfil] || { paginas_permitidas: [], descricao: '' };
      const paginas = perfilRegras.paginas_permitidas || [];

      const novasPaginas = paginas.includes(pageKey) ?
        paginas.filter((p) => p !== pageKey) :
        [...paginas, pageKey];

      return {
        ...prev,
        [perfil]: {
          ...perfilRegras,
          paginas_permitidas: novasPaginas
        }
      };
    });
    setHasChanges(true);
  };

  const handleToggleAll = (perfil, checked) => {
    setEditedRegras((prev) => {
      const perfilRegras = prev[perfil] || { paginas_permitidas: [], descricao: '' };

      return {
        ...prev,
        [perfil]: {
          ...perfilRegras,
          paginas_permitidas: checked ? PAGINAS_DISPONIVEIS.map((p) => p.key) : []
        }
      };
    });
    setHasChanges(true);
  };

  const handleDescricaoChange = (perfil, descricao) => {
    setEditedRegras((prev) => {
      const perfilRegras = prev[perfil] || { paginas_permitidas: [], descricao: '' };

      return {
        ...prev,
        [perfil]: {
          ...perfilRegras,
          descricao
        }
      };
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Salvar cada perfil editado
      for (const [perfil, dados] of Object.entries(editedRegras)) {
        const regraExistente = regras.find((r) => r.perfil === perfil);

        if (regraExistente) {
          await RegraPermissao.update(regraExistente.id, {
            paginas_permitidas: dados.paginas_permitidas,
            descricao: dados.descricao
          });
        } else {
          // Only create if there are permissions or a description
          if (dados.paginas_permitidas.length > 0 || dados.descricao) {
            await RegraPermissao.create({
              perfil,
              paginas_permitidas: dados.paginas_permitidas,
              descricao: dados.descricao
            });
          }
        }
      }

      setAlertInfo({
        isOpen: true,
        type: 'success',
        title: 'Permissões Atualizadas!',
        message: 'As regras de permissão foram salvas com sucesso. As alterações serão aplicadas no próximo login dos utilizadores.'
      });
      setHasChanges(false);
      loadData();
    } catch (error) {
      console.error('Erro ao salvar permissões:', error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro ao Salvar',
        message: 'Não foi possível salvar as permissões. Tente novamente.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    loadData();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mr-3"></div>
        <span className="text-lg text-slate-700">A carregar permissões...</span>
      </div>);

  }

  if (!currentUser || !hasUserProfile(currentUser, 'administrador')) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 p-4">
        <Card className="max-w-md">
          <CardHeader>
            <div className="flex items-center gap-3 text-red-600">
              <Lock className="w-8 h-8" />
              <CardTitle>Acesso Restrito</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600">
              Apenas administradores podem aceder à gestão de permissões do sistema.
            </p>
          </CardContent>
        </Card>
      </div>);

  }

  return (
    <div className="p-4 md:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Shield className="w-6 md:w-8 h-6 md:h-8 text-blue-600" />
              Gestão de Permissões
            </h1>
            <p className="text-slate-600 mt-1">
              Configure quais páginas cada perfil de utilizador pode aceder
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={!hasChanges || isSaving}>

              <RefreshCw className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || isSaving} className="bg-blue-600 text-slate-50 px-4 py-2 text-sm font-medium inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 h-10 hover:bg-blue-700">


              {isSaving ?
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  A Salvar...
                </> :

                <>
                  <Save className="w-4 h-4 mr-2" />
                  Salvar Alterações
                </>
              }
            </Button>
          </div>
        </div>

        {/* Alert se houver alterações não salvas */}
        {hasChanges &&
          <Alert className="border-yellow-200 bg-yellow-50">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">
              <strong>Alterações Não Salvas:</strong> Tem alterações pendentes. Não se esqueça de clicar em "Salvar Alterações" para aplicar.
            </AlertDescription>
          </Alert>
        }

        {/* Cards de Perfis */}
        <div className="space-y-6">
          {Object.keys(PERFIL_INFO).map((perfil) => {
            const info = PERFIL_INFO[perfil];
            const paginasPermitidas = editedRegras[perfil]?.paginas_permitidas || [];
            const descricao = editedRegras[perfil]?.descricao || '';
            const todasSelecionadas = paginasPermitidas.length === PAGINAS_DISPONIVEIS.length;

            return (
              <Card key={perfil} className="border-0 shadow-sm">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge className={`${info.cor} border text-sm px-3 py-1`}>
                          {info.label}
                        </Badge>
                        <span className="text-sm text-slate-500">
                          {paginasPermitidas.length} de {PAGINAS_DISPONIVEIS.length} páginas
                        </span>
                      </div>
                      <CardDescription className="text-slate-600">
                        {info.descricao}
                      </CardDescription>
                    </div>

                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`${perfil}-all`}
                        checked={todasSelecionadas && PAGINAS_DISPONIVEIS.length > 0} // Ensure it's not checked if no pages are available
                        onCheckedChange={(checked) => handleToggleAll(perfil, checked)} />

                      <Label htmlFor={`${perfil}-all`} className="text-sm font-medium cursor-pointer">
                        Selecionar Todas
                      </Label>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Grid de Páginas */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {PAGINAS_DISPONIVEIS.map((pagina) => {
                      const isPermitida = paginasPermitidas.includes(pagina.key);

                      return (
                        <div
                          key={pagina.key}
                          className={`flex items-start gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer ${isPermitida ?
                            'border-blue-200 bg-blue-50' :
                            'border-slate-200 bg-white hover:border-slate-300'}`
                          }
                          onClick={() => handleTogglePagina(perfil, pagina.key)}>

                          <Checkbox
                            id={`${perfil}-${pagina.key}`}
                            checked={isPermitida}
                            onCheckedChange={() => handleTogglePagina(perfil, pagina.key)} />

                          <div className="flex-1">
                            <Label
                              htmlFor={`${perfil}-${pagina.key}`}
                              className="font-medium text-sm cursor-pointer flex items-center gap-2">

                              {isPermitida ?
                                <Eye className="w-4 h-4 text-blue-600" /> :

                                <EyeOff className="w-4 h-4 text-slate-400" />
                              }
                              {pagina.label}
                            </Label>
                            <p className="text-xs text-slate-500 mt-1">
                              {pagina.descricao}
                            </p>
                          </div>
                        </div>);

                    })}
                  </div>

                  {/* Campo de Descrição Personalizada */}
                  <div className="pt-4 border-t">
                    <Label htmlFor={`${perfil}-descricao`} className="text-sm font-medium mb-2 block">
                      Notas sobre este Perfil (Opcional)
                    </Label>
                    <Textarea
                      id={`${perfil}-descricao`}
                      value={descricao}
                      onChange={(e) => handleDescricaoChange(perfil, e.target.value)}
                      placeholder="Adicione notas ou observações sobre este perfil..."
                      className="h-20" />

                  </div>
                </CardContent>
              </Card>);

          })}
        </div>

        {/* Informações Importantes */}
        <Alert className="border-blue-200 bg-blue-50">
          <CheckCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <strong>Importante:</strong> As alterações de permissões serão aplicadas automaticamente no próximo login dos utilizadores.
            Os utilizadores atualmente logados continuarão a ver as permissões antigas até fazerem logout e login novamente.
          </AlertDescription>
        </Alert>
      </div>

      <AlertModal
        isOpen={alertInfo.isOpen}
        onClose={() => setAlertInfo({ ...alertInfo, isOpen: false })}
        type={alertInfo.type}
        title={alertInfo.title}
        message={alertInfo.message} />

    </div>);

}