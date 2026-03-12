import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Home, Plane, DollarSign, Shield, ClipboardCheck, FileText, User as UserIcon, Users, Settings, Wrench, Menu, X, LogOut, Activity, UserCheck, MessageSquare, FileSearch, Bell, UserPlus, ChevronDown, Globe, BarChart3, Mail, ArrowLeft, BookMarked, Sparkles, Building2
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
import { hasPageAccess, hasUserProfile, areUserProfilesLoaded, ensureUserProfilesExist } from '@/components/lib/userUtils';
import { Empresa } from '@/entities/Empresa';
import { RegraPermissao } from '@/entities/RegraPermissao';
import AccessDenied from '@/components/shared/AccessDenied';
import NetworkIndicator from '@/components/shared/NetworkIndicator';
            import GlobalLoadingModal from '@/components/shared/GlobalLoadingModal';
import ChatbotIA from '@/components/shared/ChatbotIA';
import SessionTimeoutModal from '@/components/shared/SessionTimeoutModal';
import TourGuiado from '@/components/shared/TourGuiado';
import { I18nProvider } from '@/components/lib/i18n';

      // Mapeamento padrão de permissões (fallback se não houver regras na BD)
const PERFIL_PERMISSIONS_DEFAULT = {
  administrador: ['Home', 'Operacoes', 'FundoManeio', 'Proforma', 'Safety', 'Inspecoes', 'Manutencao', 'Auditoria', 'Reclamacoes', 'Credenciamento', 'GestaoEmpresas', 'GestaoAcessos', 'GRF', 'Documentos', 'HistoricoAcessoDocumentos', 'LogAuditoria', 'KPIsOperacionais', 'GerirPermissoes', 'GestaoNotificacoes', 'ConfiguracoesGerais', 'GuiaUtilizador', 'Suporte'],
  gestor_empresa: ['Credenciamento', 'GuiaUtilizador', 'Suporte'],
  operacoes: ['Home', 'Operacoes', 'FundoManeio', 'Proforma', 'Safety', 'Inspecoes', 'Manutencao', 'Auditoria', 'Reclamacoes', 'GRF', 'Documentos', 'HistoricoAcessoDocumentos', 'KPIsOperacionais', 'GuiaUtilizador', 'Suporte'],
  infraestrutura: ['Home', 'Reclamacoes', 'Inspecoes', 'Manutencao', 'Documentos', 'HistoricoAcessoDocumentos', 'GuiaUtilizador', 'Suporte'],
  credenciamento: ['Home', 'Credenciamento', 'Documentos', 'HistoricoAcessoDocumentos', 'GuiaUtilizador', 'Suporte']
};

const navigationItems = [
  { title: "Dashboard", url: createPageUrl("Home"), icon: Home, color: "text-blue-600", pageKey: "Home" },
  { title: "Operações", url: createPageUrl("Operacoes"), icon: Plane, color: "text-green-600", pageKey: "Operacoes" },
  { title: "Fundo de Maneio", url: createPageUrl("FundoManeio"), icon: DollarSign, color: "text-emerald-600", pageKey: "FundoManeio" },
  { title: "Proformas", url: createPageUrl("Proforma"), icon: FileText, color: "text-blue-600", pageKey: "Proforma" },
  { title: "Safety", url: createPageUrl("Safety"), icon: Shield, color: "text-red-600", pageKey: "Safety" },
  { title: "Inspeções", url: createPageUrl("Inspecoes"), icon: ClipboardCheck, color: "text-purple-600", pageKey: "Inspecoes" },
  { title: "KPIs Operacionais", url: createPageUrl("KPIsOperacionais"), icon: BarChart3, color: "text-teal-600", pageKey: "KPIsOperacionais" },
  { title: "Power BI", url: createPageUrl("PowerBi"), icon: BarChart3, color: "text-purple-600", pageKey: "PowerBi" },
  { title: "Manutenção", url: createPageUrl("Manutencao"), icon: Wrench, color: "text-orange-600", pageKey: "Manutencao" },
  { title: "Auditoria Interna", url: createPageUrl("Auditoria"), icon: FileSearch, color: "text-indigo-600", pageKey: "Auditoria" },
  { title: "Reclamações", url: createPageUrl("Reclamacoes"), icon: MessageSquare, color: "text-pink-600", pageKey: "Reclamacoes" },
  { title: "Gestão de Credenciamentos", url: "https://credenciamentosga.marciosager.com/", icon: UserCheck, color: "text-teal-600", pageKey: "Credenciamento", external: true },
  { title: "Gestão de Empresas", url: createPageUrl("GestaoEmpresas"), icon: Building2, color: "text-blue-800", pageKey: "GestaoEmpresas" },
  { title: "Gestão de Acessos", url: createPageUrl("GestaoAcessos"), icon: Users, color: "text-yellow-600", pageKey: "GestaoAcessos" },
  { title: "Gestão de Permissões", url: createPageUrl("GerirPermissoes"), icon: Shield, color: "text-red-600", pageKey: "GerirPermissoes" },
  { title: "Gestão de Notificações", url: createPageUrl("GestaoNotificacoes"), icon: Bell, color: "text-indigo-600", pageKey: "GestaoNotificacoes" },
  { title: "Configurações Gerais", url: createPageUrl("ConfiguracoesGerais"), icon: Settings, color: "text-slate-600", pageKey: "ConfiguracoesGerais" },
  { title: "GRF – Condições da Pista", url: createPageUrl("GRF"), icon: Activity, color: "text-sky-600", pageKey: "GRF" },
  { title: "Documentos", url: createPageUrl("Documentos"), icon: FileText, color: "text-cyan-600", pageKey: "Documentos" },
  { title: "Histórico de Acesso", url: createPageUrl("HistoricoAcessoDocumentos"), icon: FileSearch, color: "text-slate-600", pageKey: "HistoricoAcessoDocumentos" },
  { title: "Log de Auditoria", url: createPageUrl("LogAuditoria"), icon: Shield, color: "text-slate-500", pageKey: "LogAuditoria" },
  { title: "Guia do Utilizador", url: createPageUrl("GuiaUtilizador"), icon: BookMarked, color: "text-blue-500", pageKey: "GuiaUtilizador" },
  { title: "Suporte", url: createPageUrl("Suporte"), icon: MessageSquare, color: "text-purple-500", pageKey: "Suporte" },
];

const DEFAULT_LOGO = '/logo-dirops.png';

const unprotectedPages = [
  'FormularioReclamacaoPublico',
  'CredenciamentoPublico',
  'AlterarSenha',
  'AccessDenied',
  'ValidacaoAcesso',
  'SolicitarAcessoInterno',
  'AguardandoAprovacao',
  'SolicitacaoPerfil',
  'ConfigurarPerfil'
];

const hasAccessToPage = (user, pageKey, permissions) => {
  if (!user || !user.perfis || !Array.isArray(user.perfis)) {
    return false;
  }
  return hasPageAccess(user, pageKey, permissions);
};

const getFirstAccessiblePage = (user, permissions) => {
  if (!user) return createPageUrl('ValidacaoAcesso');

  user = ensureUserProfilesExist(user);

  if (!areUserProfilesLoaded(user)) {
    console.log('Perfis não carregados ou vazios, redirecionando para ValidacaoAcesso');
    return createPageUrl('ValidacaoAcesso');
  }

  if (hasUserProfile(user, 'gestor_empresa')) {
    console.log('Redirecionando gestor de empresa para Credenciamento');
    // Ensure that if 'Credenciamento' is the target, we get its actual URL, which might be external
    const credenciamentoItem = navigationItems.find(item => item.pageKey === 'Credenciamento');
    return credenciamentoItem ? credenciamentoItem.url : createPageUrl('Credenciamento');
  }

  const accessiblePages = navigationItems.filter(item => hasAccessToPage(user, item.pageKey, permissions));

  if (accessiblePages.length > 0) {
    return accessiblePages[0].url;
  }

  return createPageUrl('ValidacaoAcesso');
};

// Root pages – no back button shown on these
const rootPages = ['Home', 'Operacoes', 'Safety', 'FundoManeio', 'Proforma', 'Inspecoes', 'KPIsOperacionais', 'PowerBi', 'Manutencao', 'Auditoria', 'Reclamacoes', 'Credenciamento', 'GestaoEmpresas', 'GestaoAcessos', 'GerirPermissoes', 'GestaoNotificacoes', 'ConfiguracoesGerais', 'GRF', 'Documentos', 'HistoricoAcessoDocumentos', 'LogAuditoria'];

function LayoutContent({ children, currentPageName }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { language, setLanguage, t } = useI18n();
  const { user: authUser, isLoadingAuth } = useAuth();
  const isRootPage = rootPages.includes(currentPageName);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [user, setUser] = React.useState(null);
  const [isLoadingUser, setIsLoadingUser] = React.useState(true);
        const [permissions, setPermissions] = React.useState(PERFIL_PERMISSIONS_DEFAULT);
        const [isLoadingPermissions, setIsLoadingPermissions] = React.useState(true);
        const [hasRedirected, setHasRedirected] = React.useState(false);
        const [globalLoading, setGlobalLoading] = React.useState(false);
        const [showTour, setShowTour] = React.useState(false);
        const [logoUrl, setLogoUrl] = React.useState(DEFAULT_LOGO);

  // Carregar logo da empresa do utilizador
  React.useEffect(() => {
    const loadEmpresaLogo = async () => {
      if (!authUser?.empresa_id) {
        setLogoUrl(DEFAULT_LOGO);
        return;
      }
      try {
        const empresas = await Empresa.list();
        const empresa = empresas.find(e => e.id === authUser.empresa_id);
        if (empresa?.logo_url) {
          setLogoUrl(empresa.logo_url);
        } else {
          setLogoUrl(DEFAULT_LOGO);
        }
      } catch (error) {
        console.error('Erro ao carregar logo da empresa:', error);
        setLogoUrl(DEFAULT_LOGO);
      }
    };
    if (!isLoadingAuth) loadEmpresaLogo();
  }, [authUser, isLoadingAuth]);

  React.useEffect(() => {
    const loadPermissions = async () => {
      try {
        const regras = await RegraPermissao.list();

        if (regras && regras.length > 0) {
          const permissoesCarregadas = {};
          regras.forEach(regra => {
            permissoesCarregadas[regra.perfil] = regra.paginas_permitidas || [];
            if (permissoesCarregadas[regra.perfil].includes('Faturacao')) {
                permissoesCarregadas[regra.perfil] = permissoesCarregadas[regra.perfil].map(
                    page => (page === 'Faturacao' ? 'Proforma' : page)
                );
            }
          });

          if (permissoesCarregadas.administrador && !permissoesCarregadas.administrador.includes('GerirPermissoes')) {
            permissoesCarregadas.administrador.push('GerirPermissoes');
          } else if (!permissoesCarregadas.administrador) {
            permissoesCarregadas.administrador = PERFIL_PERMISSIONS_DEFAULT.administrador;
          }

          setPermissions(permissoesCarregadas);
          console.log('Permissões dinâmicas carregadas:', permissoesCarregadas);
        } else {
          console.log('Usando permissões padrão (nenhuma regra encontrada na BD)');
          setPermissions(PERFIL_PERMISSIONS_DEFAULT);
        }
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
      if (authUser) {
        const userWithProfiles = ensureUserProfilesExist({ ...authUser });
        setUser(userWithProfiles);
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
        const firstAccessiblePage = getFirstAccessiblePage(user, permissions);
        const currentPath = location.pathname;

        // If the first accessible page is different from the current path AND it's not the generic 'ValidacaoAcesso' page,
        // then perform the redirect.
        if (firstAccessiblePage !== currentPath && firstAccessiblePage !== createPageUrl('ValidacaoAcesso')) {
          console.log('🔄 Redirecionando automaticamente para:', firstAccessiblePage);
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
      await UserEntity.logout();
      setUser(null);
      window.location.href = '/login';
    } catch (error) {
      console.error('Erro durante o logout:', error);
      window.location.href = '/login';
    }
  };

  const filteredNavigationItems = React.useMemo(() => {
    if (!user || !user.perfis || !Array.isArray(user.perfis)) return [];
    if (isLoadingPermissions) return [];
    return navigationItems.filter(item => hasAccessToPage(user, item.pageKey, permissions));
  }, [user, permissions, isLoadingPermissions]);

  if (isLoadingUser || isLoadingPermissions) {
    return <div className="flex items-center justify-center h-screen bg-slate-50"><p className="text-lg">A carregar...</p></div>;
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
              <h1 className="text-2xl font-bold text-slate-900 mb-4">Acesso Restrito</h1>
              <p className="text-slate-600 mb-4">É necessário fazer login para aceder a esta página.</p>
              <Button onClick={() => UserEntity.loginWithRedirect(window.location.href)}>
                Fazer Login
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
            <p className="text-lg text-slate-700">A redirecionar...</p>
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
    <div className="min-h-screen bg-slate-50">
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
        @media (prefers-color-scheme: dark) {
          :root {
            --background: #0f172a;
            --foreground: #f1f5f9;
            --card: #1e293b;
            --card-foreground: #f1f5f9;
            --border: #334155;
            --input: #334155;
            --muted: #94a3b8;
            --muted-foreground: #94a3b8;
          }
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
        className="lg:hidden bg-white border-b border-slate-200 px-4 flex items-center justify-between sticky top-0 z-40"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))', paddingBottom: '0.75rem' }}
      >
        <div className="flex items-center gap-2">
          {!isRootPage ? (
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="select-none">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          ) : (
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="select-none">
              <Menu className="h-6 w-6" />
            </Button>
          )}
          <img src={logoUrl} alt="Logo" className="h-[100px]" />
        </div>
        {!isRootPage && (
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="select-none">
            <Menu className="h-6 w-6" />
          </Button>
        )}
      </div>

      <div className={`lg:hidden fixed inset-0 z-50 transition-transform transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setSidebarOpen(false)}></div>
        <div className="relative w-72 h-full bg-white shadow-xl flex flex-col">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <img src={logoUrl} alt="Logo" className="h-[120px] mx-auto" />
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}><X className="h-5 w-5" /></Button>
          </div>

          <nav className="p-4 space-y-2 flex-grow overflow-y-auto">
            {filteredNavigationItems.map((item) => (
              item.external ? (
                <a 
                  key={item.title} 
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
                  key={item.title} 
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

          <div className="p-4 border-t border-slate-200 space-y-2">
            <div className="flex items-center gap-3 px-2 py-2">
              <div className="bg-slate-200 rounded-full p-2">
                <UserIcon className="h-5 w-5 text-slate-600"/>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800 truncate">{user.full_name || user.email}</div>
                <div className="text-xs text-slate-500 capitalize">{user.role}</div>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sair</span>
            </Button>

            <div className="text-center text-xs text-slate-400 pt-2">
              Versão 2.1.0
            </div>
          </div>
        </div>
      </div>

      <div className="flex">
        <div className="hidden lg:flex flex-col w-64 bg-white border-r border-slate-200 h-screen sticky top-0">
          <div className="p-4 border-b border-slate-200">
            <div className="flex justify-center">
              <img src={logoUrl} alt="Logo" className="h-[120px]" />
            </div>
          </div>
          <nav className="flex-grow p-4 space-y-1 overflow-y-auto">
            {filteredNavigationItems.map((item) => (
              item.external ? (
                <a 
                  key={item.title} 
                  href={item.url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900`}
                >
                  <item.icon className={`w-5 h-5 ${item.color}`} />
                  <span className="text-sm font-medium">{item.title}</span>
                </a>
              ) : (
                <Link 
                  key={item.title} 
                  to={item.url} 
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${location.pathname === item.url ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                >
                  <item.icon className={`w-5 h-5 ${location.pathname !== item.url ? item.color : ''}`} />
                  <span className="text-sm font-medium">{item.title}</span>
                </Link>
              )
            ))}
          </nav>
          <div className="p-4 border-t border-slate-200">
            <div className="text-center text-xs text-slate-400">
              Versão 2.1.0
            </div>
          </div>
        </div>

        <div className="flex-1">
          <header className="hidden lg:flex justify-end items-center bg-white border-b border-slate-200 px-6 h-16">
            <div className="flex items-center gap-4">
              <NetworkIndicator />

              {/* Help dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full text-slate-500 hover:text-slate-800 border border-slate-200">
                    <span className="text-sm font-semibold">?</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <Link to={createPageUrl("GuiaUtilizador")}>
                    <DropdownMenuItem>
                      <BookMarked className="mr-2 h-4 w-4 text-blue-500" />
                      <span>Guia do Utilizador</span>
                    </DropdownMenuItem>
                  </Link>
                  <Link to={createPageUrl("Suporte")}>
                    <DropdownMenuItem>
                      <MessageSquare className="mr-2 h-4 w-4 text-purple-500" />
                      <span>Suporte</span>
                    </DropdownMenuItem>
                  </Link>
                  <DropdownMenuItem onClick={() => setShowTour(true)}>
                    <Sparkles className="mr-2 h-4 w-4 text-orange-500" />
                    <span>Tour Guiado</span>
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
          <ChatbotIA user={user} />
          <SessionTimeoutModal />
          {showTour && <TourGuiado onClose={() => setShowTour(false)} />}
        </div>
      </div>
    </div>
  );
}

export default function Layout({ children, currentPageName }) {
  return (
    <I18nProvider>
      <LayoutContent children={children} currentPageName={currentPageName} />
    </I18nProvider>
  );
}