import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Home, Plane, DollarSign, Shield, ClipboardCheck, FileText, User as UserIcon, Users, Settings, Settings2, Wrench, Menu, X, LogOut, Activity, UserCheck, MessageSquare, FileSearch, Bell, ChevronDown, BarChart3, ArrowLeft, BookMarked, Sparkles, Building2, Layers, Trash2, Key, Moon, Sun
} from "lucide-react";
import BottomTabs from '@/components/shared/BottomTabs';
import { useI18n } from '@/components/lib/i18n';
import { Button } from "@/components/ui/button";
import { User as UserEntity } from '@/entities/User';
import { useAuth } from '@/lib/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { hasPageAccess, hasUserProfile, areUserProfilesLoaded, ensureUserProfilesExist, isSuperAdmin } from '@/components/lib/userUtils';
import { Empresa } from '@/entities/Empresa';
import { useCompanyView } from '@/lib/CompanyViewContext';
import { RegraPermissao } from '@/entities/RegraPermissao';
import AccessDenied from '@/components/shared/AccessDenied';
import { logAuthEvent } from '@/lib/auditLog';
import NetworkIndicator from '@/components/shared/NetworkIndicator';
            import GlobalLoadingModal from '@/components/shared/GlobalLoadingModal';
const ChatbotIA = React.lazy(() => import('@/components/shared/ChatbotIA'));
const SessionTimeoutModal = React.lazy(() => import('@/components/shared/SessionTimeoutModal'));
const TourGuiado = React.lazy(() => import('@/components/shared/TourGuiado'));

// Mapeamento padrão de permissões (fallback se não houver regras na BD)
const PERFIL_PERMISSIONS_DEFAULT = {
  administrador: ['Home', 'Operacoes', 'FundoManeio', 'ConfiguracaoTarifas', 'Proforma', 'ServicosAeroportuarios', 'Safety', 'Inspecoes', 'Manutencao', 'Auditoria', 'Reclamacoes', 'Credenciamento', 'GestaoEmpresas', 'GestaoAcessos', 'GRF', 'Documentos', 'HistoricoAcessoDocumentos', 'Lixeira', 'LogAuditoria', 'KPIsOperacionais', 'GerirPermissoes', 'GestaoNotificacoes', 'GestaoAPIKeys', 'ConfiguracoesGerais', 'GuiaUtilizador', 'Suporte'],
  gestor_empresa: ['Credenciamento', 'GuiaUtilizador', 'Suporte'],
  operacoes: ['Home', 'Operacoes', 'FundoManeio', 'ConfiguracaoTarifas', 'Proforma', 'ServicosAeroportuarios', 'Safety', 'Inspecoes', 'Manutencao', 'Auditoria', 'Reclamacoes', 'GRF', 'Documentos', 'HistoricoAcessoDocumentos', 'KPIsOperacionais', 'GuiaUtilizador', 'Suporte'],
  infraestrutura: ['Home', 'Reclamacoes', 'Inspecoes', 'Manutencao', 'Documentos', 'HistoricoAcessoDocumentos', 'GuiaUtilizador', 'Suporte'],
  credenciamento: ['Home', 'Credenciamento', 'Documentos', 'HistoricoAcessoDocumentos', 'GuiaUtilizador', 'Suporte'],
  safety: ['Home', 'Safety', 'Inspecoes', 'Reclamacoes', 'GRF', 'Documentos', 'HistoricoAcessoDocumentos', 'KPIsOperacionais', 'GuiaUtilizador', 'Suporte']
};

function getNavigationItems(t) {
  return [
    { title: t('nav.dashboard'), url: createPageUrl("Home"), icon: Home, color: "text-blue-600", pageKey: "Home" },
    { title: t('nav.operacoes'), url: createPageUrl("Operacoes"), icon: Plane, color: "text-green-600", pageKey: "Operacoes" },
    { title: t('nav.fundo_maneio'), url: createPageUrl("FundoManeio"), icon: DollarSign, color: "text-emerald-600", pageKey: "FundoManeio" },
    { title: t('nav.config_tarifas'), url: createPageUrl("ConfiguracaoTarifas"), icon: Settings2, color: "text-blue-600", pageKey: "ConfiguracaoTarifas" },
    { title: t('nav.proformas'), url: createPageUrl("Proforma"), icon: FileText, color: "text-blue-600", pageKey: "Proforma" },
    { title: t('nav.servicos_aeroportuarios'), url: createPageUrl("ServicosAeroportuarios"), icon: Layers, color: "text-cyan-600", pageKey: "ServicosAeroportuarios" },
    { title: t('nav.safety'), url: createPageUrl("Safety"), icon: Shield, color: "text-red-600", pageKey: "Safety" },
    { title: t('nav.inspecoes'), url: createPageUrl("Inspecoes"), icon: ClipboardCheck, color: "text-purple-600", pageKey: "Inspecoes" },
    { title: t('nav.kpis'), url: createPageUrl("KPIsOperacionais"), icon: BarChart3, color: "text-teal-600", pageKey: "KPIsOperacionais" },
    { title: t('nav.powerbi'), url: createPageUrl("PowerBi"), icon: BarChart3, color: "text-purple-600", pageKey: "PowerBi" },
    { title: t('nav.manutencao'), url: createPageUrl("Manutencao"), icon: Wrench, color: "text-orange-600", pageKey: "Manutencao" },
    { title: t('nav.auditoria'), url: createPageUrl("Auditoria"), icon: FileSearch, color: "text-indigo-600", pageKey: "Auditoria" },
    { title: t('nav.reclamacoes'), url: createPageUrl("Reclamacoes"), icon: MessageSquare, color: "text-pink-600", pageKey: "Reclamacoes" },
    { title: t('nav.credenciamento'), url: "https://credenciamentosga.marciosager.com/", icon: UserCheck, color: "text-teal-600", pageKey: "Credenciamento", external: true },
    { title: t('nav.gestao_empresas'), url: createPageUrl("GestaoEmpresas"), icon: Building2, color: "text-blue-800", pageKey: "GestaoEmpresas" },
    { title: t('nav.gestao_acessos'), url: createPageUrl("GestaoAcessos"), icon: Users, color: "text-yellow-600", pageKey: "GestaoAcessos" },
    { title: t('nav.gerir_permissoes'), url: createPageUrl("GerirPermissoes"), icon: Shield, color: "text-red-600", pageKey: "GerirPermissoes" },
    { title: t('nav.gestao_notificacoes'), url: createPageUrl("GestaoNotificacoes"), icon: Bell, color: "text-indigo-600", pageKey: "GestaoNotificacoes" },
    { title: t('nav.config_gerais'), url: createPageUrl("ConfiguracoesGerais"), icon: Settings, color: "text-slate-600", pageKey: "ConfiguracoesGerais" },
    { title: t('nav.grf'), url: createPageUrl("GRF"), icon: Activity, color: "text-sky-600", pageKey: "GRF" },
    { title: t('nav.documentos'), url: createPageUrl("Documentos"), icon: FileText, color: "text-cyan-600", pageKey: "Documentos" },
    { title: t('nav.historico_acesso'), url: createPageUrl("HistoricoAcessoDocumentos"), icon: FileSearch, color: "text-slate-600", pageKey: "HistoricoAcessoDocumentos" },
    { title: t('nav.lixeira'), url: createPageUrl("Lixeira"), icon: Trash2, color: "text-slate-500", pageKey: "Lixeira" },
    { title: t('nav.api_keys'), url: createPageUrl("GestaoAPIKeys"), icon: Key, color: "text-amber-600", pageKey: "GestaoAPIKeys" },
    { title: t('nav.log_auditoria'), url: createPageUrl("LogAuditoria"), icon: Shield, color: "text-slate-500", pageKey: "LogAuditoria" },
    { title: t('nav.guia_utilizador'), url: createPageUrl("GuiaUtilizador"), icon: BookMarked, color: "text-blue-500", pageKey: "GuiaUtilizador" },
    { title: t('nav.suporte'), url: createPageUrl("Suporte"), icon: MessageSquare, color: "text-purple-500", pageKey: "Suporte" },
  ];
}

const DEFAULT_LOGO = '/logo-dirops.png';

// Simple in-memory cache for Layout queries (avoids re-fetching on every navigation)
const _layoutCache = { empresas: null, empresasTime: 0, regras: null, regrasTime: 0, permissions: null };
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function isCacheValid(key) {
  return _layoutCache[key] && Date.now() - _layoutCache[key + 'Time'] < CACHE_TTL;
}

async function getCachedEmpresas() {
  if (isCacheValid('empresas')) return _layoutCache.empresas;
  const data = await Empresa.list();
  _layoutCache.empresas = data;
  _layoutCache.empresasTime = Date.now();
  return data;
}

async function getCachedRegras() {
  if (isCacheValid('regras')) return _layoutCache.regras;
  const data = await RegraPermissao.list();
  _layoutCache.regras = data;
  _layoutCache.regrasTime = Date.now();
  return data;
}

// Build permissions map from regras (used for sync init from cache)
function buildPermissions(regrasData) {
  if (!regrasData || regrasData.length === 0) return PERFIL_PERMISSIONS_DEFAULT;
  const p = {};
  regrasData.forEach(regra => {
    p[regra.perfil] = (regra.paginas_permitidas || []).map(
      page => page === 'Faturacao' ? 'Proforma' : page
    );
  });
  if (p.administrador && !p.administrador.includes('GerirPermissoes')) {
    p.administrador.push('GerirPermissoes');
  } else if (!p.administrador) {
    p.administrador = PERFIL_PERMISSIONS_DEFAULT.administrador;
  }
  _layoutCache.permissions = p;
  return p;
}

// Get cached permissions synchronously (for instant init)
function getCachedPermissions() {
  if (_layoutCache.permissions) return _layoutCache.permissions;
  if (isCacheValid('regras')) return buildPermissions(_layoutCache.regras);
  return null;
}

const unprotectedPages = [
  'FormularioReclamacaoPublico',
  'CredenciamentoPublico',
  'AlterarSenha',
  'AccessDenied',
  'ValidacaoAcesso',
  'SolicitarAcessoInterno',
  'AguardandoAprovacao',
  'SolicitacaoPerfil',
  'ConfigurarPerfil',
  'PoliticaPrivacidade',
  'TermosServico'
];

const hasAccessToPage = (user, pageKey, permissions) => {
  if (!user || !user.perfis || !Array.isArray(user.perfis)) {
    return false;
  }
  return hasPageAccess(user, pageKey, permissions);
};

const getFirstAccessiblePage = (user, permissions, t) => {
  if (!user) return createPageUrl('ValidacaoAcesso');

  user = ensureUserProfilesExist(user);

  if (!areUserProfilesLoaded(user)) {
    return createPageUrl('ValidacaoAcesso');
  }

  const navItems = getNavigationItems(t);

  if (hasUserProfile(user, 'gestor_empresa')) {
    // Ensure that if 'Credenciamento' is the target, we get its actual URL, which might be external
    const credenciamentoItem = navItems.find(item => item.pageKey === 'Credenciamento');
    return credenciamentoItem ? credenciamentoItem.url : createPageUrl('Credenciamento');
  }

  const accessiblePages = navItems.filter(item => hasAccessToPage(user, item.pageKey, permissions));

  if (accessiblePages.length > 0) {
    return accessiblePages[0].url;
  }

  return createPageUrl('ValidacaoAcesso');
};

// Root pages – no back button shown on these
const rootPages = ['Home', 'Operacoes', 'Safety', 'FundoManeio', 'ConfiguracaoTarifas', 'Proforma', 'Inspecoes', 'KPIsOperacionais', 'PowerBi', 'Manutencao', 'Auditoria', 'Reclamacoes', 'Credenciamento', 'GestaoEmpresas', 'GestaoAcessos', 'GerirPermissoes', 'GestaoNotificacoes', 'GestaoAPIKeys', 'ConfiguracoesGerais', 'GRF', 'Documentos', 'HistoricoAcessoDocumentos', 'Lixeira', 'LogAuditoria'];

function LayoutContent({ children, currentPageName }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t, language, setLanguage } = useI18n();
  const { user: authUser, isLoadingAuth } = useAuth();
  const isRootPage = rootPages.includes(currentPageName);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [user, setUser] = React.useState(null);
  const [isLoadingUser, setIsLoadingUser] = React.useState(true);
        const _cachedPerms = getCachedPermissions();
        const [permissions, setPermissions] = React.useState(_cachedPerms || PERFIL_PERMISSIONS_DEFAULT);
        const [isLoadingPermissions, setIsLoadingPermissions] = React.useState(!_cachedPerms);
        const [hasRedirected, setHasRedirected] = React.useState(false);
        const [globalLoading] = React.useState(false);
        const [showTour, setShowTour] = React.useState(false);
        const [darkMode, setDarkMode] = React.useState(() => {
          if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('darkMode');
            if (saved !== null) return saved === 'true';
            return window.matchMedia('(prefers-color-scheme: dark)').matches;
          }
          return false;
        });

        React.useEffect(() => {
          document.documentElement.classList.toggle('dark', darkMode);
          localStorage.setItem('darkMode', darkMode);
        }, [darkMode]);
        const [logoUrl, setLogoUrl] = React.useState(DEFAULT_LOGO);
        const [empresasList, setEmpresasList] = React.useState([]);
        const { viewingAsEmpresa, setViewingAsEmpresa, clearViewingAsEmpresa, isSuperAdminViewing } = useCompanyView();

  // Carregar logo da empresa do utilizador + lista de empresas para superadmin
  React.useEffect(() => {
    const loadEmpresaData = async () => {
      try {
        const empresas = await getCachedEmpresas();

        // Se superadmin, guardar lista de empresas para o seletor
        if (authUser && isSuperAdmin(authUser)) {
          setEmpresasList(empresas);
        }

        // Logo: prioridade para viewingAsEmpresa (superadmin), senão empresa do user
        if (viewingAsEmpresa?.logo_url) {
          setLogoUrl(viewingAsEmpresa.logo_url);
        } else if (authUser?.empresa_id) {
          const empresa = empresas.find(e => e.id === authUser.empresa_id);
          setLogoUrl(empresa?.logo_url || DEFAULT_LOGO);
        } else {
          setLogoUrl(DEFAULT_LOGO);
        }
      } catch (error) {
        console.error('Erro ao carregar dados da empresa:', error);
        setLogoUrl(DEFAULT_LOGO);
      }
    };
    if (!isLoadingAuth) loadEmpresaData();
  }, [authUser, isLoadingAuth, viewingAsEmpresa]);

  React.useEffect(() => {
    const loadPermissions = async () => {
      try {
        const regras = await getCachedRegras();
        const built = buildPermissions(regras);
        setPermissions(built);
      } catch (error) {
        console.error('Erro ao carregar permissões, usando padrão:', error);
        setPermissions(PERFIL_PERMISSIONS_DEFAULT);
      } finally {
        setIsLoadingPermissions(false);
      }
    };

    loadPermissions();
  }, []);

  React.useEffect(() => {
    if (isLoadingAuth) return;

    if (!unprotectedPages.includes(currentPageName)) {
      if (authUser && !authUser._profileLoadFailed) {
        const userWithProfiles = ensureUserProfilesExist({ ...authUser });
        setUser(userWithProfiles);
      } else if (authUser?._profileLoadFailed) {
        // Profile failed to load — keep isLoadingUser=true to block access checks
        return;
      } else {
        setUser(null);
      }
    }
    setIsLoadingUser(false);
  }, [authUser, isLoadingAuth, currentPageName]);

  // Efeito para redirecionamento automático quando não tem acesso
  React.useEffect(() => {
    // Only proceed if user and permissions are loaded, and we haven't already initiated a redirect
    if (!isLoadingUser && !isLoadingPermissions && user && !hasRedirected &&
        !unprotectedPages.includes(currentPageName)) {

      // Check if the user has access to the current page
      if (!hasAccessToPage(user, currentPageName, permissions)) {
        const firstAccessiblePage = getFirstAccessiblePage(user, permissions, t);
        const currentPath = location.pathname;

        // If the first accessible page is different from the current path AND it's not the generic 'ValidacaoAcesso' page,
        // then perform the redirect.
        if (firstAccessiblePage !== currentPath && firstAccessiblePage !== createPageUrl('ValidacaoAcesso')) {
          setHasRedirected(true); // Mark that a redirect has been initiated
          window.location.href = firstAccessiblePage;
        } else {
          // If firstAccessiblePage is the same as currentPath, or it's 'ValidacaoAcesso',
          // it means there's no suitable page to automatically redirect to, or the user is already on the
          // most accessible page (which might still be restricted).
          // In this case, we set hasRedirected to true to signal that the check is done,
          // and the UI should now render the AccessDenied message.
          setHasRedirected(true);
        }
      } else {
        // If the user *does* have access to the current page, and previously was restricted or redirected,
        // reset hasRedirected. This handles cases where user navigates back to a previously restricted page
        // they now have access to (e.g., permissions changed). Or if they land on an accessible page.
        if (hasRedirected) {
          setHasRedirected(false);
        }
      }
    }
  }, [user, currentPageName, permissions, isLoadingUser, isLoadingPermissions, hasRedirected, location.pathname]);


  const handleLogout = async () => {
    try {
      logAuthEvent('logout', user?.email || authUser?.email, 'Logout pelo utilizador');
      await UserEntity.logout();
      setUser(null);
      window.location.href = '/login';
    } catch (error) {
      console.error('Erro durante o logout:', error);
      window.location.href = '/login';
    }
  };

  const navigationItems = React.useMemo(() => getNavigationItems(t), [t, language]);

  const filteredNavigationItems = React.useMemo(() => {
    if (!user || !user.perfis || !Array.isArray(user.perfis)) return [];
    if (isLoadingPermissions) return [];
    return navigationItems.filter(item => hasAccessToPage(user, item.pageKey, permissions));
  }, [user, permissions, isLoadingPermissions, navigationItems]);

  if (isLoadingUser || isLoadingPermissions) {
    return <div className="flex items-center justify-center h-screen bg-slate-50"><p className="text-lg">{t('layout.loading')}</p></div>;
  }

  if (unprotectedPages.includes(currentPageName)) {
    return (
      <div className="min-h-screen bg-slate-50">
        <style>{`:root { --primary: #004A99; --primary-foreground: #ffffff; --secondary: #f1f5f9; --accent: #009FE3; --destructive: #dc2626; --muted: #64748b; }`}</style>
        <main>{children}</main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50">
        <style>{`:root { --primary: #004A99; --primary-foreground: #ffffff; --secondary: #f1f5f9; --accent: #009FE3; --destructive: #dc2626; --muted: #64748b; }`}</style>
        <main>
          <div className="flex items-center justify-center min-h-screen bg-slate-50 p-4">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-slate-900 mb-4">{t('layout.restrictedAccess')}</h1>
              <p className="text-slate-600 mb-4">{t('layout.loginRequired')}</p>
              <Button type="button" onClick={() => UserEntity.loginWithRedirect(window.location.href)}>
                {t('layout.login')}
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Se não tem acesso à página atual
  if (!hasAccessToPage(user, currentPageName, permissions)) {
    // Se o redirecionamento automático ainda não foi processado (hasRedirected é false),
    // mostra o spinner de redirecionamento.
    if (!hasRedirected) {
      return (
        <div className="flex items-center justify-center h-screen bg-slate-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-lg text-slate-700">{t('layout.redirecting')}</p>
          </div>
        </div>
      );
    } else {
      // Se hasRedirected é true, significa que o efeito de redirecionamento já correu.
      // Se ainda estamos nesta página e ela é inacessível, significa que não havia para onde
      // redirecionar (e.g., nenhuma página acessível, ou a página atual é a 'primeira' acessível mas está restrita).
      // Neste caso, exibe o componente de Acesso Negado.
      return (
        <div className="min-h-screen bg-slate-50">
          <style>{`:root { --primary: #004A99; --primary-foreground: #ffffff; --secondary: #f1f5f9; --accent: #009FE3; --destructive: #dc2626; --muted: #64748b; }`}</style>
          <main>
            <AccessDenied />
          </main>
        </div>
      );
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 dark:text-slate-100">
      <style>{`
        :root {
          --primary: #004A99;
          --primary-foreground: #ffffff;
          --secondary: #f1f5f9;
          --accent: #009FE3;
          --destructive: #dc2626;
          --muted: #64748b;
          --safe-area-top: env(safe-area-inset-top);
          --safe-area-bottom: env(safe-area-inset-bottom);
          --safe-area-left: env(safe-area-inset-left);
          --safe-area-right: env(safe-area-inset-right);
        }
        body {
          overscroll-behavior: none;
        }
        nav a, nav button, header button {
          user-select: none;
          -webkit-user-select: none;
        }
        /* Extra bottom padding on mobile to clear the BottomTabs bar */
        @media (max-width: 1023px) {
          main { padding-bottom: calc(4rem + env(safe-area-inset-bottom)); }
        }
      `}</style>
      <GlobalLoadingModal isOpen={globalLoading} message="A carregar dados..." />

      {/* Mobile sticky header */}
      <div
        className="lg:hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 flex items-center justify-between sticky top-0 z-40"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))', paddingBottom: '0.75rem' }}
      >
        <div className="flex items-center gap-2">
          {!isRootPage ? (
            <Button type="button" variant="ghost" size="icon" onClick={() => navigate(-1)} className="select-none" aria-label="Voltar">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          ) : (
            <Button type="button" variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="select-none" aria-label="Abrir menu">
              <Menu className="h-6 w-6" />
            </Button>
          )}
          <img src={logoUrl} alt="Logo" className="h-[100px] max-w-[180px] object-contain" />
        </div>
        {!isRootPage && (
          <Button type="button" variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="select-none" aria-label="Abrir menu">
            <Menu className="h-6 w-6" />
          </Button>
        )}
      </div>

      <div className={`lg:hidden fixed inset-0 z-50 transition-transform transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setSidebarOpen(false)}></div>
        <div className="relative w-72 h-full bg-white dark:bg-slate-900 shadow-xl flex flex-col">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <img src={logoUrl} alt="Logo" className="h-[120px] max-w-[200px] object-contain mx-auto" />
            <Button type="button" variant="ghost" size="icon" onClick={() => setSidebarOpen(false)} aria-label="Fechar menu"><X className="h-5 w-5" /></Button>
          </div>

          <nav className="p-4 space-y-2 flex-grow overflow-y-auto">
            {filteredNavigationItems.map((item) => (
              item.external ? (
                <a
                  key={item.pageKey}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900`}
                >
                  <item.icon className={`w-5 h-5 ${item.color}`} />
                  <span>{item.title}</span>
                </a>
              ) : (
                <Link
                  key={item.pageKey}
                  to={item.url}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${location.pathname === item.url ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                >
                  <item.icon className={`w-5 h-5 ${location.pathname !== item.url ? item.color : ''}`} />
                  <span>{item.title}</span>
                </Link>
              )
            ))}
          </nav>

          <div className="p-4 border-t border-slate-200 dark:border-slate-700 space-y-2">
            {/* Mobile dark/language toggles */}
            <div className="flex items-center justify-center gap-2 pb-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 dark:border-slate-600 dark:text-slate-300"
                onClick={() => setLanguage(language === 'pt' ? 'en' : 'pt')}
              >
                <span className="text-base mr-1">{language === 'pt' ? '🇦🇴' : '🇺🇸'}</span>
                {language === 'pt' ? 'EN' : 'PT'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 dark:border-slate-600 dark:text-slate-300"
                onClick={() => setDarkMode(!darkMode)}
              >
                {darkMode ? <Sun className="h-3.5 w-3.5 mr-1.5" /> : <Moon className="h-3.5 w-3.5 mr-1.5" />}
                {darkMode ? 'Claro' : 'Escuro'}
              </Button>
            </div>

            <div className="flex items-center gap-3 px-2 py-2">
              <div className="bg-slate-200 dark:bg-slate-700 rounded-full p-2">
                <UserIcon className="h-5 w-5 text-slate-600 dark:text-slate-300"/>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{user.full_name || user.email}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 capitalize">{user.role}</div>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 dark:border-red-800 dark:hover:bg-red-950"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>{t('layout.logout')}</span>
            </Button>

            <div className="text-center text-xs text-slate-400 pt-2">
              {t('layout.version')} 2.1.0
            </div>
          </div>
        </div>
      </div>

      <div className="flex">
        <div className="hidden lg:flex flex-col w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 h-screen sticky top-0">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700">
            <div className="flex justify-center">
              <img src={logoUrl} alt="Logo" className="h-[120px] max-w-[200px] object-contain" />
            </div>
          </div>
          <nav className="flex-grow p-4 space-y-1 overflow-y-auto">
            {filteredNavigationItems.map((item) => (
              item.external ? (
                <a
                  key={item.pageKey}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200`}
                >
                  <item.icon className={`w-5 h-5 ${item.color}`} />
                  <span className="text-sm font-medium">{item.title}</span>
                </a>
              ) : (
                <Link
                  key={item.pageKey}
                  to={item.url}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${location.pathname === item.url ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-semibold' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'}`}
                >
                  <item.icon className={`w-5 h-5 ${location.pathname !== item.url ? item.color : ''}`} />
                  <span className="text-sm font-medium">{item.title}</span>
                </Link>
              )
            ))}
          </nav>
          <div className="p-4 border-t border-slate-200 dark:border-slate-700">
            <div className="text-center text-xs text-slate-400 dark:text-slate-500">
              {t('layout.version')} 2.1.0
            </div>
          </div>
        </div>

        <div className="flex-1">
          <header className="hidden lg:flex justify-end items-center bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-6 h-16">
            <div className="flex items-center gap-4">
              <NetworkIndicator />

              {/* Empresa selector (superadmin only) */}
              {isSuperAdminViewing && empresasList.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant={viewingAsEmpresa ? "default" : "outline"}
                      size="sm"
                      className={viewingAsEmpresa ? "bg-blue-600 text-white hover:bg-blue-700 gap-2" : "gap-2 text-slate-600"}
                    >
                      <Building2 className="h-4 w-4" />
                      {viewingAsEmpresa ? (
                        <>
                          <span className="max-w-[150px] truncate">{viewingAsEmpresa.nome}</span>
                          <span
                            role="button"
                            aria-label="Limpar seleção de empresa"
                            className="ml-1 hover:bg-blue-800 rounded-full p-0.5"
                            onClick={(e) => { e.stopPropagation(); clearViewingAsEmpresa(); }}
                          >
                            <X className="h-3 w-3" />
                          </span>
                        </>
                      ) : (
                        <span>{t('label.view_as')}</span>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>{t('label.select_empresa')}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {empresasList.map((empresa) => (
                      <DropdownMenuItem
                        key={empresa.id}
                        onClick={() => setViewingAsEmpresa({ id: empresa.id, nome: empresa.nome, logo_url: empresa.logo_url })}
                        className={viewingAsEmpresa?.id === empresa.id ? 'bg-blue-50 text-blue-700 font-semibold' : ''}
                      >
                        {empresa.logo_url && (
                          <img src={empresa.logo_url} alt="" className="h-5 w-5 mr-2 object-contain rounded" />
                        )}
                        <span>{empresa.nome}</span>
                      </DropdownMenuItem>
                    ))}
                    {viewingAsEmpresa && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={clearViewingAsEmpresa} className="text-red-600">
                          <X className="h-4 w-4 mr-2" />
                          <span>{t('label.clear_selection')}</span>
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Language toggle */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-full text-slate-500 hover:text-slate-800 border border-slate-200 dark:border-slate-600 dark:hover:text-white"
                aria-label={language === 'pt' ? 'Switch to English' : 'Mudar para Português'}
                onClick={() => setLanguage(language === 'pt' ? 'en' : 'pt')}
                title={language === 'pt' ? 'Português (Angola)' : 'English'}
              >
                <span className="text-base leading-none">{language === 'pt' ? '🇦🇴' : '🇺🇸'}</span>
              </Button>

              {/* Dark mode toggle */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-full text-slate-500 hover:text-slate-800 border border-slate-200 dark:text-slate-300 dark:border-slate-600 dark:hover:text-white"
                aria-label={darkMode ? 'Modo claro' : 'Modo escuro'}
                onClick={() => setDarkMode(!darkMode)}
              >
                {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>

              {/* Help dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="icon" className="rounded-full text-slate-500 hover:text-slate-800 border border-slate-200" aria-label="Ajuda">
                    <span className="text-sm font-semibold">?</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <Link to={createPageUrl("GuiaUtilizador")}>
                    <DropdownMenuItem>
                      <BookMarked className="mr-2 h-4 w-4 text-blue-500" />
                      <span>{t('menu.guia_utilizador')}</span>
                    </DropdownMenuItem>
                  </Link>
                  <Link to={createPageUrl("Suporte")}>
                    <DropdownMenuItem>
                      <MessageSquare className="mr-2 h-4 w-4 text-purple-500" />
                      <span>{t('menu.suporte')}</span>
                    </DropdownMenuItem>
                  </Link>
                  <DropdownMenuItem onClick={() => setShowTour(true)}>
                    <Sparkles className="mr-2 h-4 w-4 text-orange-500" />
                    <span>{t('menu.tour_guiado')}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-3">
                    <div className="bg-slate-200 rounded-full p-2">
                       <UserIcon className="h-5 w-5 text-slate-600"/>
                    </div>
                    <div className="text-left">
                       <div className="text-sm font-medium text-slate-800">{user.full_name || user.email}</div>
                       <div className="text-xs text-slate-500 capitalize">{user.role}</div>
                    </div>
                    <ChevronDown className="h-4 w-4 text-slate-500"/>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>{t('layout.myAccount')}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <Link to={createPageUrl("ConfigurarPerfil")}><DropdownMenuItem>{t('layout.configurarPerfil')}</DropdownMenuItem></Link>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>{t('layout.logout')}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main className="p-4 md:p-6 lg:p-8">{children}</main>
          <BottomTabs />
          <React.Suspense fallback={null}>
            <ChatbotIA />
            <SessionTimeoutModal />
            {showTour && <TourGuiado onClose={() => setShowTour(false)} />}
          </React.Suspense>
        </div>
      </div>
    </div>
  );
}

export default function Layout({ children, currentPageName }) {
  return (
    <LayoutContent children={children} currentPageName={currentPageName} />
  );
}