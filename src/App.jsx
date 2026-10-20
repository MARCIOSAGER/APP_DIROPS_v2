import React, { Suspense } from 'react'
// Sentry loaded dynamically in main.jsx (A-02)
import './App.css'
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { logClientError } from '@/lib/errorLogger'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { CompanyViewProvider } from '@/lib/CompanyViewContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Login from '@/pages/Login';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
const PortalAuth = lazyWithRetry(() => import('@/universidade/PortalAuth'));
const PortalPrivacidade = lazyWithRetry(() => import('@/universidade/PortalPrivacidade'));
const UniversidadeApp = lazyWithRetry(() => import('@/universidade/UniversidadeApp'));
const PortalAuthDocs = lazyWithRetry(() => import('@/documentos/PortalAuth'));
const PortalPrivacidadeDocs = lazyWithRetry(() => import('@/documentos/PortalPrivacidade'));
const DocumentosApp = lazyWithRetry(() => import('@/documentos/DocumentosApp'));
// A formação saiu do DIROPS: as rotas antigas levam ao site da Universidade (com a mesma query: curso, aula, quiz, tab).
const REDIRECIONAR_PORTAL = { Formacao: 'formacao', GestaoFormacao: 'gestao/cursos' };
function RedirecionarPortal({ destino }) {
  React.useEffect(() => { window.location.replace(`/universidade/${destino}${window.location.search || ''}`); }, [destino]);
  return <LoadingWatchdog message="A abrir a Universidade Corporativa…" />;
}
import CookieConsent from '@/components/shared/CookieConsent';
import { I18nProvider } from '@/components/lib/i18n';
import AppUpdateBanner from '@/components/shared/AppUpdateBanner';
import { initWebVitals } from '@/lib/webVitals';
import { LoadingSpinner, PageLoading } from '@/components/ui/loading-spinner';
import LoadingWatchdog from '@/components/shared/LoadingWatchdog';

const PageLoader = () => <LoadingWatchdog message="A carregar…" />;

// Error Boundary to prevent white screen crashes
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
    // Clear chunk reload cooldown after 15s of successful render
    // so future chunk errors can trigger auto-reload again
    this._cooldownTimer = setTimeout(() => sessionStorage.removeItem('chunk_reload_at'), 15000);
  }
  componentWillUnmount() {
    clearTimeout(this._cooldownTimer);
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    // RES-01: Handles ChunkLoadError after production deploys.
    // Auto-reloads once (30s cooldown). Shows manual button if cooldown active.
    // Covers all lazy routes via tree propagation from outer boundary.
    console.error('[ErrorBoundary]', error, errorInfo);
    // Registo DURÁVEL no servidor (logs/client-errors.jsonl) — antes um crash de
    // render só ia para o console e ficava invisível (ex.: crash do Google Tradutor).
    logClientError('react-boundary', error, { componentStack: String(errorInfo?.componentStack || '').slice(0, 2000) });
    import('@sentry/react').then(Sentry => Sentry.captureException(error, { extra: errorInfo })).catch(() => {});
    // Auto-reload on chunk load failure (stale cache after deploy)
    const msg = error?.message || '';
    if (msg.includes('Failed to fetch dynamically imported module') || msg.includes('Importing a module script failed')) {
      const lastReload = sessionStorage.getItem('chunk_reload_at');
      const now = Date.now();
      if (!lastReload || now - parseInt(lastReload) > 30000) {
        sessionStorage.setItem('chunk_reload_at', String(now));
        // Unregister stale SW before reloading so the new SW activates cleanly
        if (navigator.serviceWorker) {
          navigator.serviceWorker.getRegistrations().then(regs => {
            Promise.all(regs.map(r => r.unregister())).then(() => window.location.reload());
          }).catch(() => window.location.reload());
        } else {
          window.location.reload();
        }
      } else {
        // Cooldown active — offer manual reload button instead of infinite spinner
        this.setState({ isChunkErrorBlocked: true });
      }
    }
  }
  render() {
    if (this.state.hasError) {
      const isChunkError = this.state.error?.message?.includes('Failed to fetch dynamically imported module')
        || this.state.error?.message?.includes('Importing a module script failed');
      if (isChunkError && !this.state.isChunkErrorBlocked) {
        // Show loading spinner while auto-reloading
        return (
          <div className="fixed inset-0 flex items-center justify-center bg-slate-50">
            <div className="text-center p-8">
              <PageLoading label="A carregar nova versão..." />
            </div>
          </div>
        );
      }
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-50">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-bold text-red-600 mb-4">Erro na Aplicação</h2>
            <p className="text-slate-600 mb-2">{this.state.error?.message || 'Ocorreu um erro inesperado.'}</p>
            <button onClick={() => { sessionStorage.removeItem('chunk_reload_at'); window.location.reload(); }}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
              Tentar novamente
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const PublicPages = ['CredenciamentoPublico', 'FormularioReclamacaoPublico', 'portalservicos', 'AlterarSenha', 'PoliticaPrivacidade', 'TermosServico'];

const AuthenticatedApp = () => {
  const { isLoadingAuth, authError, isAuthenticated, navigateToLogin, user } = useAuth();

  React.useEffect(() => {
    if (isAuthenticated && user?.id) initWebVitals(user);
  }, [isAuthenticated, user?.id]);

  if (isLoadingAuth) {
    return <LoadingWatchdog message="A iniciar sessão…" />;
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  if (!isAuthenticated) {
    navigateToLogin();
    return null;
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={
          <LayoutWrapper currentPageName={mainPageKey}>
            <MainPage />
          </LayoutWrapper>
        } />
        {Object.entries(Pages).filter(([path]) => !REDIRECIONAR_PORTAL[path]).map(([path, Page]) => (
          <Route
            key={path}
            path={`/${path}`}
            element={
              <LayoutWrapper currentPageName={path}>
                <Page />
              </LayoutWrapper>
            }
          />
        ))}
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Suspense>
  );
};


function App() {
  return (
    <I18nProvider>
    <AuthProvider>
      <CompanyViewProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationTracker />
          <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              {/* Universidade Corporativa — site próprio em /universidade (login, pedido de acesso, convite, portal) */}
              <Route path="/universidade/login" element={<PortalAuth modo="entrar" />} />
              <Route path="/universidade/pedir-acesso" element={<PortalAuth modo="pedir" />} />
              <Route path="/universidade/recuperar" element={<PortalAuth modo="recuperar" />} />
              <Route path="/universidade/alterar-senha" element={<PortalAuth modo="senha" />} />
              <Route path="/universidade/privacidade" element={<PortalPrivacidade />} />
              <Route path="/universidade/convite/:token" element={<PortalAuth modo="convite" />} />
              <Route path="/universidade/*" element={<UniversidadeApp />} />
              {/* Portal de Documentos — site próprio em /documentos (login, pedido de acesso, convite, portal) */}
              <Route path="/documentos/login" element={<PortalAuthDocs modo="entrar" />} />
              <Route path="/documentos/pedir-acesso" element={<PortalAuthDocs modo="pedir" />} />
              <Route path="/documentos/recuperar" element={<PortalAuthDocs modo="recuperar" />} />
              <Route path="/documentos/alterar-senha" element={<PortalAuthDocs modo="senha" />} />
              <Route path="/documentos/privacidade" element={<PortalPrivacidadeDocs />} />
              <Route path="/documentos/convite/:token" element={<PortalAuthDocs modo="convite" />} />
              <Route path="/documentos/*" element={<DocumentosApp />} />
              {Object.entries(REDIRECIONAR_PORTAL).map(([pagina, destino]) => <Route key={pagina} path={`/${pagina}`} element={<RedirecionarPortal destino={destino} />} />)}
              {PublicPages.map(page => {
                const Page = Pages[page];
                return Page ? <Route key={page} path={`/${page}`} element={<Page />} /> : null;
              })}
              <Route path="*" element={<AuthenticatedApp />} />
            </Routes>
          </Suspense>
          </ErrorBoundary>
        </Router>
        <Toaster />
        <CookieConsent />
        <AppUpdateBanner />
      </QueryClientProvider>
      </CompanyViewProvider>
    </AuthProvider>
    </I18nProvider>
  )
}

export default App
