import React, { Suspense } from 'react'
import * as Sentry from '@sentry/react'
import './App.css'
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { CompanyViewProvider } from '@/lib/CompanyViewContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Login from '@/pages/Login';
import CookieConsent from '@/components/shared/CookieConsent';
import { I18nProvider } from '@/components/lib/i18n';
import AppUpdateBanner from '@/components/shared/AppUpdateBanner';

const PageLoader = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
  </div>
);

// Error Boundary to prevent white screen crashes
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
    Sentry.captureException(error, { extra: errorInfo });
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
      }
    }
  }
  render() {
    if (this.state.hasError) {
      const isChunkError = this.state.error?.message?.includes('Failed to fetch dynamically imported module');
      if (isChunkError) {
        // Show loading spinner while auto-reloading
        return (
          <div className="fixed inset-0 flex items-center justify-center bg-slate-50">
            <div className="text-center p-8">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4" />
              <p className="text-slate-600">A carregar nova versão...</p>
            </div>
          </div>
        );
      }
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-50">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-bold text-red-600 mb-4">Erro na Aplicação</h2>
            <p className="text-slate-600 mb-2">{this.state.error?.message || 'Ocorreu um erro inesperado.'}</p>
            <button onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
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
  const { isLoadingAuth, authError, isAuthenticated, navigateToLogin } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
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
        {Object.entries(Pages).map(([path, Page]) => (
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
