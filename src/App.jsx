import React from 'react'
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
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-50">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-bold text-red-600 mb-4">Erro na Aplicação</h2>
            <p className="text-slate-600 mb-2">{this.state.error?.message || 'Ocorreu um erro inesperado.'}</p>
            <button onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
              Recarregar Página
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

const PublicPages = ['CredenciamentoPublico', 'FormularioReclamacaoPublico', 'portalservicos', 'AlterarSenha'];

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
  );
};


function App() {
  return (
    <AuthProvider>
      <CompanyViewProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationTracker />
          <Routes>
            <Route path="/login" element={<Login />} />
            {PublicPages.map(page => {
              const Page = Pages[page];
              return Page ? <Route key={page} path={`/${page}`} element={<Page />} /> : null;
            })}
            <Route path="*" element={<ErrorBoundary><AuthenticatedApp /></ErrorBoundary>} />
          </Routes>
        </Router>
        <Toaster />
      </QueryClientProvider>
      </CompanyViewProvider>
    </AuthProvider>
  )
}

export default App
