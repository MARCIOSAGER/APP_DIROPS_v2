import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Shield,
  Save,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Lock,
  Eye,
  EyeOff,
  Plus,
  Trash2
} from 'lucide-react';

import { RegraPermissao } from '@/entities/RegraPermissao';
import AlertModal from '../components/shared/AlertModal';
import { hasUserProfile, isAdminProfile } from '@/components/lib/userUtils';
import { useI18n } from '@/components/lib/i18n';
import { useAuth } from '@/lib/AuthContext';
import { useRegrasPermissao } from '@/hooks/useRegrasPermissao';

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
    key: 'ConfiguracaoTarifas',
    label: 'Configuração de Tarifas',
    descricao: 'Tabelas e regras de cálculo de tarifas',
    category: 'Operações',
    icon: '🧮'
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
    key: 'ProntoPagamento',
    label: 'Pronto Pagamento',
    descricao: 'Faturação de tráfego em pronto pagamento',
    category: 'Operações',
    icon: '💵'
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
    key: 'Relatorios',
    label: 'Relatórios Automáticos',
    descricao: 'Relatórios operacionais por email (diário, semanal, mensal)',
    category: 'Gestão',
    icon: '📨'
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
    key: 'Monitoramento',
    label: 'Monitoramento',
    descricao: 'Estado dos serviços e agendamentos do sistema',
    category: 'Gestão',
    icon: '🖥️'
  },
  {
    key: 'ImportacaoAiaan',
    label: 'Importação Base44',
    descricao: 'Importação de voos e dados do Base44',
    category: 'Operações',
    icon: '📥'
  },
  {
    key: 'Lixeira',
    label: 'Lixeira',
    descricao: 'Recuperação de registos eliminados',
    category: 'Gestão',
    icon: '🗑️'
  },
  {
    key: 'Formacao',
    label: 'Universidade Corporativa',
    descricao: 'Área do aluno: catálogo de cursos, os meus cursos, certificados',
    category: 'Formação',
    icon: '🎓'
  },
  {
    key: 'GestaoFormacao',
    label: 'Gestão de Formação',
    descricao: 'Instrutor/admin: criar e gerir cursos, módulos, aulas e matrículas',
    category: 'Formação',
    icon: '🧑‍🏫'
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
  safety: {
    label: 'Safety',
    cor: 'bg-red-100 text-red-800 border-red-200',
    descricao: 'Acesso a Safety, inspeções, reclamações, GRF e KPIs operacionais'
  },
  visualizador: {
    label: 'Visualizador',
    cor: 'bg-slate-100 text-slate-800 border-slate-200',
    descricao: 'Acesso somente leitura a páginas selecionadas, sem permissão para editar'
  }
};

// Perfis de sistema (fixos no codigo, com logica especial). Os restantes sao personalizados.
const PERFIS_SISTEMA = Object.keys(PERFIL_INFO);

// Paleta de cores para perfis personalizados.
const CORES_PERFIL = [
  { nome: 'Azul', cor: 'bg-blue-100 text-blue-800 border-blue-200' },
  { nome: 'Verde', cor: 'bg-green-100 text-green-800 border-green-200' },
  { nome: 'Roxo', cor: 'bg-purple-100 text-purple-800 border-purple-200' },
  { nome: 'Ambar', cor: 'bg-amber-100 text-amber-800 border-amber-200' },
  { nome: 'Rosa', cor: 'bg-pink-100 text-pink-800 border-pink-200' },
  { nome: 'Turquesa', cor: 'bg-teal-100 text-teal-800 border-teal-200' },
  { nome: 'Indigo', cor: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  { nome: 'Cinza', cor: 'bg-slate-100 text-slate-800 border-slate-200' },
];

// Transforma um nome em chave normalizada (sem acentos, minusculas, _).
function slugifyPerfil(nome) {
  return (nome || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export default function GerirPermissoes() {
  const { t } = useI18n();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { data: regras = [], isLoading, error: queryError } = useRegrasPermissao({
    enabled: isAdminProfile(currentUser),
  });
  const [isSaving, setIsSaving] = useState(false);
  const [editedRegras, setEditedRegras] = useState({});
  const [hasChanges, setHasChanges] = useState(false);
  const [alertInfo, setAlertInfo] = useState({ isOpen: false, type: 'info', title: '', message: '' });
  const [perfisRemovidos, setPerfisRemovidos] = useState([]); // perfis personalizados a apagar ao salvar
  const [novoPerfilOpen, setNovoPerfilOpen] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [novoCor, setNovoCor] = useState(CORES_PERFIL[0].cor);
  const [novoErro, setNovoErro] = useState('');

  const PAGE_KEYS = React.useMemo(() => new Set(PAGINAS_DISPONIVEIS.map((p) => p.key)), []);

  // Info de exibição de um perfil: sistema (fixo) ou personalizado (label/cor guardados).
  const getPerfilInfo = (perfil) => {
    if (PERFIL_INFO[perfil]) return { ...PERFIL_INFO[perfil], isCustom: false };
    const ed = editedRegras[perfil] || {};
    return {
      label: ed.label || perfil,
      cor: ed.cor || 'bg-slate-100 text-slate-800 border-slate-200',
      descricao: ed.descricao || '',
      isCustom: true,
    };
  };

  // Ordem: perfis de sistema primeiro, depois personalizados por ordem alfabética.
  const perfisList = React.useMemo(() => {
    const custom = Object.keys(editedRegras).filter((k) => !PERFIS_SISTEMA.includes(k)).sort();
    return [...PERFIS_SISTEMA.filter((k) => editedRegras[k]), ...custom];
  }, [editedRegras]);

  // Inicializar editedRegras quando regras mudam
  useEffect(() => {
    if (regras.length === 0 && !queryError) return;
    const inicial = {};
    // Perfis de sistema (sempre presentes)
    PERFIS_SISTEMA.forEach(perfilKey => {
      const existingRegra = regras.find((regra) => regra.perfil === perfilKey);
      inicial[perfilKey] = {
        paginas_permitidas: existingRegra ? existingRegra.paginas_permitidas || [] : [],
        descricao: existingRegra ? existingRegra.descricao || '' : ''
      };
    });
    // Perfis personalizados (existem na BD mas nao no codigo)
    // Os perfis dos portais (Documentos e Universidade) vivem em regra_permissao mas gerem-se nos portais: ficam fora daqui
    const doutroPortal = (p) => /_documentos$|^doc_|^uc_/.test(p) || ['formando', 'instrutor', 'admin_universidade'].includes(p);
    regras.filter((r) => !PERFIS_SISTEMA.includes(r.perfil) && !doutroPortal(r.perfil)).forEach((r) => {
      inicial[r.perfil] = {
        paginas_permitidas: r.paginas_permitidas || [],
        descricao: r.descricao || '',
        label: r.label || r.perfil,
        cor: r.cor || 'bg-slate-100 text-slate-800 border-slate-200',
        isCustom: true,
      };
    });
    setEditedRegras(inicial);
    setPerfisRemovidos([]);
    setHasChanges(false);
  }, [regras, queryError]);

  // Criar um novo perfil personalizado (local; persiste ao Guardar).
  const handleCriarPerfil = () => {
    const nome = novoNome.trim();
    if (!nome) { setNovoErro('Indique o nome do perfil.'); return; }
    const key = slugifyPerfil(nome);
    if (!key) { setNovoErro('Nome inválido.'); return; }
    if (editedRegras[key] || PERFIS_SISTEMA.includes(key)) { setNovoErro('Já existe um perfil com esse nome.'); return; }
    setEditedRegras((prev) => ({
      ...prev,
      [key]: { paginas_permitidas: [], descricao: '', label: nome, cor: novoCor, isCustom: true },
    }));
    setPerfisRemovidos((prev) => prev.filter((k) => k !== key));
    setHasChanges(true);
    setNovoPerfilOpen(false);
    setNovoNome(''); setNovoCor(CORES_PERFIL[0].cor); setNovoErro('');
  };

  const handleRemoverPerfil = (perfil) => {
    setEditedRegras((prev) => {
      const n = { ...prev };
      delete n[perfil];
      return n;
    });
    // Se existia na BD, marca para apagar ao salvar.
    if (regras.some((r) => r.perfil === perfil)) {
      setPerfisRemovidos((prev) => (prev.includes(perfil) ? prev : [...prev, perfil]));
    }
    setHasChanges(true);
  };

  useEffect(() => {
    if (queryError) {
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro ao Carregar',
        message: 'Não foi possível carregar as regras de permissão.'
      });
    }
  }, [queryError]);

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
        const isCustom = !PERFIS_SISTEMA.includes(perfil);
        const payload = {
          paginas_permitidas: dados.paginas_permitidas,
          descricao: dados.descricao,
        };
        if (isCustom) { payload.label = dados.label || perfil; payload.cor = dados.cor || null; }

        if (regraExistente) {
          await RegraPermissao.update(regraExistente.id, payload);
        } else if (isCustom || dados.paginas_permitidas.length > 0 || dados.descricao) {
          // Cria se for perfil personalizado, ou se ha permissoes/descricao.
          await RegraPermissao.create({ perfil, ...payload });
        }
      }

      // Apagar perfis personalizados removidos
      for (const perfil of perfisRemovidos) {
        const regraExistente = regras.find((r) => r.perfil === perfil);
        if (regraExistente) await RegraPermissao.delete(regraExistente.id);
      }

      setAlertInfo({
        isOpen: true,
        type: 'success',
        title: 'Permissões Atualizadas!',
        message: 'As regras de permissão foram salvas com sucesso. As alterações serão aplicadas no próximo login dos utilizadores.'
      });
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ['regras-permissao'] });
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
    queryClient.invalidateQueries({ queryKey: ['regras-permissao'] });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mr-3"></div>
        <span className="text-lg text-slate-700 dark:text-slate-300">{t('permissoes.carregando')}</span>
      </div>);

  }

  if (!currentUser || !isAdminProfile(currentUser)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 p-4">
        <Card className="max-w-md">
          <CardHeader>
            <div className="flex items-center gap-3 text-red-600">
              <Lock className="w-8 h-8" />
              <CardTitle>{t('permissoes.acessoRestrito')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600 dark:text-slate-400">
              {t('permissoes.acessoRestritoDesc')}
            </p>
          </CardContent>
        </Card>
      </div>);

  }

  return (
    <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-950 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-3">
              <Shield className="w-6 md:w-8 h-6 md:h-8 text-blue-600 dark:text-blue-400" />
              {t('page.gerir_permissoes.title')}
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              {t('page.gerir_permissoes.subtitle')}
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => { setNovoNome(''); setNovoCor(CORES_PERFIL[0].cor); setNovoErro(''); setNovoPerfilOpen(true); }}
              className="border-indigo-300 text-indigo-700 hover:bg-indigo-50">
              <Plus className="w-4 h-4 mr-2" />
              Criar novo perfil
            </Button>
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={!hasChanges || isSaving}>

              <RefreshCw className="w-4 h-4 mr-2" />
              {t('permissoes.cancelar')}
            </Button>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || isSaving} className="bg-blue-600 text-slate-50 px-4 py-2 text-sm font-medium inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 h-10 hover:bg-blue-700">


              {isSaving ?
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  {t('permissoes.aSalvar')}
                </> :

                <>
                  <Save className="w-4 h-4 mr-2" />
                  {t('permissoes.salvarAlteracoes')}
                </>
              }
            </Button>
          </div>
        </div>

        {/* Alert se houver alterações não salvas */}
        {hasChanges &&
          <Alert className="border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950">
            <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            <AlertDescription className="text-yellow-800 dark:text-yellow-200">
              <strong>{t('permissoes.alteracoesNaoSalvas')}</strong> {t('permissoes.alteracoesNaoSalvasDesc')}
            </AlertDescription>
          </Alert>
        }

        {/* Cards de Perfis */}
        <div className="space-y-6">
          {perfisList.map((perfil) => {
            const info = getPerfilInfo(perfil);
            const paginasPermitidas = editedRegras[perfil]?.paginas_permitidas || [];
            const descricao = editedRegras[perfil]?.descricao || '';
            // Conta apenas paginas que existem (ignora chaves antigas/obsoletas), corrige "32 de 28".
            const nSelecionadas = paginasPermitidas.filter((k) => PAGE_KEYS.has(k)).length;
            const todasSelecionadas = nSelecionadas === PAGINAS_DISPONIVEIS.length;

            return (
              <Card key={perfil} className="border-0 shadow-sm">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge className={`${info.cor} border text-sm px-3 py-1`}>
                          {info.label}
                        </Badge>
                        <span className="text-sm text-slate-500 dark:text-slate-400">
                          {nSelecionadas} {t('permissoes.de')} {PAGINAS_DISPONIVEIS.length} {t('permissoes.paginas')}
                        </span>
                      </div>
                      <CardDescription className="text-slate-600 dark:text-slate-400">
                        {info.descricao}
                      </CardDescription>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`${perfil}-all`}
                          checked={todasSelecionadas && PAGINAS_DISPONIVEIS.length > 0} // Ensure it's not checked if no pages are available
                          onCheckedChange={(checked) => handleToggleAll(perfil, checked)} />

                        <Label htmlFor={`${perfil}-all`} className="text-sm font-medium cursor-pointer">
                          {t('permissoes.selecionarTodas')}
                        </Label>
                      </div>
                      {info.isCustom && (
                        <Button
                          variant="ghost" size="icon"
                          className="h-8 w-8 text-red-600 hover:bg-red-50"
                          title="Apagar este perfil"
                          onClick={() => handleRemoverPerfil(perfil)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
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
                            'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950' :
                            'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600'}`
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
                                <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400" /> :

                                <EyeOff className="w-4 h-4 text-slate-400 dark:text-slate-500" />
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
                      {t('permissoes.notasPerfil')}
                    </Label>
                    <Textarea
                      id={`${perfil}-descricao`}
                      value={descricao}
                      onChange={(e) => handleDescricaoChange(perfil, e.target.value)}
                      placeholder={t('permissoes.notasPlaceholder')}
                      className="h-20" />

                  </div>
                </CardContent>
              </Card>);

          })}
        </div>

        {/* Informações Importantes */}
        <Alert className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950">
          <CheckCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="text-blue-800 dark:text-blue-200">
            <strong>{t('permissoes.importante')}</strong> {t('permissoes.importanteDesc')}
          </AlertDescription>
        </Alert>
      </div>

      <AlertModal
        isOpen={alertInfo.isOpen}
        onClose={() => setAlertInfo({ ...alertInfo, isOpen: false })}
        type={alertInfo.type}
        title={alertInfo.title}
        message={alertInfo.message} />

      <Dialog open={novoPerfilOpen} onOpenChange={setNovoPerfilOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-indigo-600" /> Criar novo perfil
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Dê um nome ao perfil e escolha uma cor. A seguir marque as páginas que este perfil pode ver e clique em Guardar.
            </p>
            <div className="space-y-2">
              <Label>Nome do perfil</Label>
              <Input
                value={novoNome}
                onChange={(e) => { setNovoNome(e.target.value); setNovoErro(''); }}
                placeholder="Ex.: Auditoria Externa, AVSEC, Financeiro"
                onKeyDown={(e) => { if (e.key === 'Enter') handleCriarPerfil(); }}
                autoFocus />
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2">
                {CORES_PERFIL.map((c) => (
                  <button
                    key={c.cor}
                    type="button"
                    onClick={() => setNovoCor(c.cor)}
                    className={`px-3 py-1 rounded-full border text-xs ${c.cor} ${novoCor === c.cor ? 'ring-2 ring-offset-1 ring-slate-500' : ''}`}>
                    {c.nome}
                  </button>
                ))}
              </div>
            </div>
            {novoErro && <p className="text-sm text-red-600">{novoErro}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovoPerfilOpen(false)}>Cancelar</Button>
            <Button onClick={handleCriarPerfil} className="bg-indigo-600 hover:bg-indigo-700 text-white">Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>);

}