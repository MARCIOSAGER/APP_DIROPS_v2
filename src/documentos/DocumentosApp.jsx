// Aplicação do Portal de Documentos (/documentos/*): exige sessão, mostra o estado de aprovação da conta e monta
// as páginas de consulta e de gestão dentro da moldura própria do portal. Molde: src/universidade/UniversidadeApp.jsx.
import React, { Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { lazyWithRetry as lazy } from '@/lib/lazyWithRetry';
import { Clock, RefreshCw, LogOut, ShieldAlert, Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import LoadingWatchdog from '@/components/shared/LoadingWatchdog';
import { useAuth } from '@/lib/AuthContext';
import { PORTAL_BASE, perfisPortal } from '@/lib/portalDocumentos';
import PortalLayout, { ehGestor, sairDoPortal, PaginaGestao, usePodeVer } from './PortalLayout';
import { usePermissoesPortalDocs } from './hooks';

const PortalInicio = lazy(() => import('./pages/PortalInicio'));
const PortalBiblioteca = lazy(() => import('./pages/PortalBiblioteca'));
const PortalPesquisa = lazy(() => import('./pages/PortalPesquisa'));
const PortalDocumento = lazy(() => import('./pages/PortalDocumento'));
const PortalLeituras = lazy(() => import('./pages/PortalLeituras'));
const PortalConta = lazy(() => import('./pages/PortalConta'));
const PortalGuia = lazy(() => import('./pages/PortalGuia'));
const PortalGestaoPainel = lazy(() => import('./pages/gestao/PortalGestaoPainel'));
const PortalDocumentosGestao = lazy(() => import('./pages/gestao/PortalDocumentosGestao'));
const PortalPastas = lazy(() => import('./pages/gestao/PortalPastas'));
const PortalLinks = lazy(() => import('./pages/gestao/PortalLinks'));
const PortalEmendas = lazy(() => import('./pages/gestao/PortalEmendas'));
const PortalAcessos = lazy(() => import('./pages/gestao/PortalAcessos'));
const PortalAuditoria = lazy(() => import('./pages/gestao/PortalAuditoria'));
const PortalRelatorios = lazy(() => import('./pages/gestao/PortalRelatorios'));
const PortalConfiguracoes = lazy(() => import('./pages/gestao/PortalConfiguracoes'));
const PortalCodificacao = lazy(() => import('./pages/gestao/PortalCodificacao'));
const PortalConformidade = lazy(() => import('./pages/gestao/PortalConformidade'));
const PortalAvsec = lazy(() => import('./PortalAvsec'));
const PortalFluxo = lazy(() => import('./PortalFluxo'));
const PortalFluxoDocumento = lazy(() => import('./PortalFluxoDocumento'));

const Carregar = () => <div className="py-16"><LoadingWatchdog message="A carregar…" /></div>;

function Aviso({ titulo, texto }) {
  return (
    <Card className="mx-auto max-w-lg dark:border-slate-800 dark:bg-slate-900"><CardContent className="flex flex-col items-center gap-3 py-12 text-center">
      <ShieldAlert className="h-8 w-8 text-amber-500" aria-hidden="true" />
      <p className="font-medium">{titulo}</p>
      <p className="text-sm text-slate-500 dark:text-slate-400">{texto}</p>
      <Button asChild variant="outline"><Link to={PORTAL_BASE}><Compass className="h-4 w-4" aria-hidden="true" />Voltar ao início</Link></Button>
    </CardContent></Card>
  );
}

// Página permitida ao perfil (Gestão › Acessos › Perfis e páginas). Enquanto carrega valem as predefinições.
function Permitido({ pagina, children }) {
  const podeVer = usePodeVer();
  if (podeVer(pagina)) return children;
  return <Aviso titulo="Esta página não está disponível para o seu perfil" texto="Um administrador pode alterar as páginas de cada perfil em Gestão › Acessos › Perfis e páginas." />;
}

function Gestor({ user, children }) {
  // subscreve as permissões: os perfis personalizados de nível gestor só se conhecem quando a tabela carrega
  const { isLoading } = usePermissoesPortalDocs();
  if (ehGestor(user)) return children;
  if (isLoading) return null;
  return <Aviso titulo="Área reservada à gestão documental" texto="Só gestores e administradores de documentos podem entrar aqui." />;
}

function PortalAguardando({ user, logout, onVerificar }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-sky-50 p-4 dark:from-slate-950 dark:to-sky-950/40">
      <Card className="w-full max-w-lg border-0 shadow-xl dark:bg-slate-900"><CardContent className="space-y-5 p-8 text-center">
        <img src="/logo-sga.png" alt="SGA" className="mx-auto h-12 object-contain dark:hidden" />
        <img src="/logo-sga-light.png" alt="SGA" className="mx-auto hidden h-12 object-contain dark:block" />
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/60"><Clock className="h-8 w-8 text-amber-600" aria-hidden="true" /></div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Conta a aguardar aprovação</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">A conta <strong>{user?.email}</strong> ainda não tem acesso aos documentos. Um gestor vai aprová-la em breve; receberá um email quando puder entrar.</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={onVerificar}><RefreshCw className="h-4 w-4" aria-hidden="true" />Verificar novamente</Button>
          <Button variant="outline" onClick={() => sairDoPortal(user, logout)}><LogOut className="h-4 w-4" aria-hidden="true" />Sair</Button>
        </div>
      </CardContent></Card>
    </div>
  );
}

export default function DocumentosApp() {
  const { isLoadingAuth, isAuthenticated, authError, user, logout, checkAppState } = useAuth();
  const loc = useLocation();
  const precisaLogin = !isLoadingAuth && (!isAuthenticated || authError?.type === 'auth_required');

  useEffect(() => {
    if (!precisaLogin) return;
    const next = `${loc.pathname}${loc.search}`;
    const q = next && next !== PORTAL_BASE && next !== `${PORTAL_BASE}/` ? `?next=${encodeURIComponent(next)}` : '';
    window.location.replace(`${PORTAL_BASE}/login${q}`);
  }, [precisaLogin, loc.pathname, loc.search]);

  if (isLoadingAuth || precisaLogin) return <LoadingWatchdog message="A entrar no Portal de Documentos…" />;

  if (user?._profileLoadFailed) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md dark:bg-slate-900"><CardContent className="space-y-4 p-6 text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-amber-500" aria-hidden="true" />
          <p className="font-medium">Não foi possível carregar o seu perfil</p>
          <p className="text-sm text-slate-500">Pode ser uma falha momentânea de rede. Tente novamente.</p>
          <div className="flex justify-center gap-2">
            <Button onClick={checkAppState}><RefreshCw className="h-4 w-4" aria-hidden="true" />Tentar de novo</Button>
            <Button variant="outline" onClick={() => sairDoPortal(user, logout)}><LogOut className="h-4 w-4" aria-hidden="true" />Sair</Button>
          </div>
        </CardContent></Card>
      </div>
    );
  }

  const activo = user?.status === 'ativo' && perfisPortal(user).membro;
  if (!activo) return <PortalAguardando user={user} logout={logout} onVerificar={checkAppState} />;

  return (
    <PortalLayout>
      <Suspense fallback={<Carregar />}>
        <Routes>
          <Route index element={<PortalInicio />} />
          <Route path="biblioteca" element={<Permitido pagina="biblioteca"><PortalBiblioteca /></Permitido>} />
          <Route path="pesquisa" element={<Permitido pagina="pesquisa"><PortalPesquisa /></Permitido>} />
          <Route path="documento/:id" element={<Permitido pagina="biblioteca"><PortalDocumento /></Permitido>} />
          <Route path="leituras" element={<Permitido pagina="leituras"><PortalLeituras /></Permitido>} />
          {/* Aprovações: NÃO é página de gestão. Quem assina é o revisor e o director, que podem não ter perfil de
              gestão nenhum — e o endereço «aprovacao» é fixo porque é para ele que apontam os botões dos emails. */}
          <Route path="aprovacao" element={<Permitido pagina="aprovacao"><PortalFluxo /></Permitido>} />
          <Route path="aprovacao/:fluxoId" element={<Permitido pagina="aprovacao"><PortalFluxo /></Permitido>} />
          <Route path="documento/:id/assinaturas" element={<Permitido pagina="biblioteca"><PortalFluxoDocumento /></Permitido>} />
          <Route path="conta" element={<PortalConta />} />
          {/* Guia do Utilizador: ajuda para toda a gente, sem perfil especial (como no DIROPS). */}
          <Route path="guia" element={<PortalGuia />} />
          <Route path="gestao" element={<Gestor user={user}><Permitido pagina="gestao"><PortalGestaoPainel /></Permitido></Gestor>} />
          <Route path="gestao/documentos" element={<Gestor user={user}><Permitido pagina="gestao_documentos"><PaginaGestao><PortalDocumentosGestao /></PaginaGestao></Permitido></Gestor>} />
          <Route path="gestao/pastas" element={<Gestor user={user}><Permitido pagina="gestao_pastas"><PortalPastas /></Permitido></Gestor>} />
          <Route path="gestao/emendas" element={<Gestor user={user}><Permitido pagina="gestao_emendas"><PortalEmendas /></Permitido></Gestor>} />
          <Route path="gestao/links" element={<Gestor user={user}><Permitido pagina="gestao_links"><PortalLinks /></Permitido></Gestor>} />
          <Route path="gestao/acessos" element={<Gestor user={user}><Permitido pagina="gestao_acessos"><PortalAcessos /></Permitido></Gestor>} />
          <Route path="gestao/auditoria" element={<Gestor user={user}><Permitido pagina="gestao_auditoria"><PortalAuditoria /></Permitido></Gestor>} />
          <Route path="gestao/codificacao" element={<Gestor user={user}><Permitido pagina="gestao_codificacao"><PortalCodificacao /></Permitido></Gestor>} />
          <Route path="gestao/avsec" element={<Gestor user={user}><Permitido pagina="gestao_avsec"><PortalAvsec /></Permitido></Gestor>} />
          <Route path="gestao/conformidade" element={<Gestor user={user}><Permitido pagina="gestao_conformidade"><PortalConformidade /></Permitido></Gestor>} />
          <Route path="gestao/relatorios" element={<Gestor user={user}><Permitido pagina="gestao_relatorios"><PortalRelatorios /></Permitido></Gestor>} />
          <Route path="gestao/configuracoes" element={<Gestor user={user}><Permitido pagina="gestao_configuracoes"><PortalConfiguracoes /></Permitido></Gestor>} />
          <Route path="login" element={<Navigate to={PORTAL_BASE} replace />} />
          <Route path="*" element={
            <Card className="mx-auto max-w-lg dark:border-slate-800 dark:bg-slate-900"><CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <p className="text-5xl font-bold text-slate-300">404</p>
              <p className="font-medium">Esta página não existe no Portal de Documentos.</p>
              <Button asChild variant="outline"><Link to={PORTAL_BASE}><Compass className="h-4 w-4" aria-hidden="true" />Ir para o início</Link></Button>
            </CardContent></Card>
          } />
        </Routes>
      </Suspense>
    </PortalLayout>
  );
}
