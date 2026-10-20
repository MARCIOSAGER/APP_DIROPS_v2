// Aplicação do portal da Universidade (/universidade/*): exige sessão, mostra o estado de aprovação da conta
// e monta as páginas do aluno e da gestão dentro da moldura própria do portal.
import React, { Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { lazyWithRetry as lazy } from '@/lib/lazyWithRetry';
import { Clock, RefreshCw, LogOut, ShieldAlert, Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import LoadingWatchdog from '@/components/shared/LoadingWatchdog';
import { useAuth } from '@/lib/AuthContext';
import { PORTAL_BASE } from '@/lib/universidade';
import PortalLayout, { ehGestor, sairDoPortal, PaginaGestao, usePodeVer } from './PortalLayout';

const Formacao = lazy(() => import('@/pages/Formacao'));
const GestaoFormacao = lazy(() => import('@/pages/GestaoFormacao'));
const PortalInicio = lazy(() => import('./pages/PortalInicio'));
const PortalSessoes = lazy(() => import('./pages/PortalSessoes'));
const PortalRanking = lazy(() => import('./pages/PortalRanking'));
const PortalAjuda = lazy(() => import('./pages/PortalAjuda'));
const PortalConta = lazy(() => import('./pages/PortalConta'));
const PortalGestaoPainel = lazy(() => import('./pages/gestao/PortalGestaoPainel'));
const PortalAcessos = lazy(() => import('./pages/gestao/PortalAcessos'));
const PortalAuditoria = lazy(() => import('./pages/gestao/PortalAuditoria'));
const PortalRelatorios = lazy(() => import('./pages/gestao/PortalRelatorios'));
const PortalSuporteGestao = lazy(() => import('./pages/gestao/PortalSuporteGestao'));
const PortalAvisos = lazy(() => import('./pages/gestao/PortalAvisos'));
const PortalConfiguracoes = lazy(() => import('./pages/gestao/PortalConfiguracoes'));

const Carregar = () => <div className="py-16"><LoadingWatchdog message="A carregar…" /></div>;

// Página permitida ao perfil (Acessos › Perfis e páginas). Enquanto as permissões carregam usam-se as predefinições.
function Permitido({ pagina, children }) {
  const podeVer = usePodeVer();
  if (podeVer(pagina)) return children;
  return (
    <Card className="mx-auto max-w-lg dark:border-slate-800 dark:bg-slate-900"><CardContent className="flex flex-col items-center gap-3 py-12 text-center">
      <ShieldAlert className="h-8 w-8 text-amber-500" aria-hidden="true" />
      <p className="font-medium">Esta página não está disponível para o seu perfil</p>
      <p className="text-sm text-slate-500 dark:text-slate-400">Um administrador pode alterar as páginas de cada perfil em Gestão › Acessos › Perfis e páginas.</p>
      <Button asChild variant="outline"><Link to={PORTAL_BASE}><Compass className="h-4 w-4" aria-hidden="true" />Voltar ao início</Link></Button>
    </CardContent></Card>
  );
}

function Gestor({ user, children }) {
  if (ehGestor(user)) return children;
  return (
    <Card className="mx-auto max-w-lg dark:border-slate-800 dark:bg-slate-900"><CardContent className="flex flex-col items-center gap-3 py-12 text-center">
      <ShieldAlert className="h-8 w-8 text-amber-500" aria-hidden="true" />
      <p className="font-medium">Área reservada à gestão da Universidade</p>
      <p className="text-sm text-slate-500 dark:text-slate-400">Só administradores e instrutores podem entrar aqui.</p>
      <Button asChild variant="outline"><Link to={PORTAL_BASE}><Compass className="h-4 w-4" aria-hidden="true" />Voltar ao início</Link></Button>
    </CardContent></Card>
  );
}

function PortalAguardando({ user, logout, onVerificar }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-violet-50 p-4 dark:from-slate-950 dark:to-violet-950/40">
      <Card className="w-full max-w-lg border-0 shadow-xl dark:bg-slate-900"><CardContent className="space-y-5 p-8 text-center">
        <img src="/logo-sga.png" alt="SGA" className="mx-auto h-12 object-contain dark:hidden" /><img src="/logo-sga-light.png" alt="SGA" className="mx-auto hidden h-12 object-contain dark:block" />
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/60"><Clock className="h-8 w-8 text-amber-600" aria-hidden="true" /></div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Conta a aguardar aprovação</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">A conta <strong>{user?.email}</strong> ainda não está activa na Universidade Corporativa. Um gestor vai aprová-la em breve; recebe um email quando isso acontecer.</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={onVerificar}><RefreshCw className="h-4 w-4" aria-hidden="true" />Verificar novamente</Button>
          <Button variant="outline" onClick={() => sairDoPortal(user, logout)}><LogOut className="h-4 w-4" aria-hidden="true" />Sair</Button>
        </div>
      </CardContent></Card>
    </div>
  );
}

export default function UniversidadeApp() {
  const { isLoadingAuth, isAuthenticated, authError, user, logout, checkAppState } = useAuth();
  const loc = useLocation();
  const precisaLogin = !isLoadingAuth && (!isAuthenticated || authError?.type === 'auth_required');

  useEffect(() => {
    if (!precisaLogin) return;
    const next = `${loc.pathname}${loc.search}`;
    const q = next && next !== PORTAL_BASE && next !== `${PORTAL_BASE}/` ? `?next=${encodeURIComponent(next)}` : '';
    window.location.replace(`${PORTAL_BASE}/login${q}`);
  }, [precisaLogin, loc.pathname, loc.search]);

  if (isLoadingAuth || precisaLogin) return <LoadingWatchdog message="A entrar na Universidade…" />;

  if (user?._profileLoadFailed) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md dark:bg-slate-900"><CardContent className="space-y-4 p-6 text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-amber-500" aria-hidden="true" />
          <p className="font-medium">Não foi possível carregar o seu perfil</p>
          <p className="text-sm text-slate-500">Pode ser uma falha momentânea de rede. Tente novamente.</p>
          <div className="flex justify-center gap-2"><Button onClick={checkAppState}><RefreshCw className="h-4 w-4" aria-hidden="true" />Tentar de novo</Button><Button variant="outline" onClick={() => sairDoPortal(user, logout)}>Sair</Button></div>
        </CardContent></Card>
      </div>
    );
  }

  const ativo = user?.status === 'ativo' && Array.isArray(user?.perfis) && user.perfis.length > 0;
  if (!ativo) return <PortalAguardando user={user} logout={logout} onVerificar={checkAppState} />;

  return (
    <PortalLayout>
      <Suspense fallback={<Carregar />}>
        <Routes>
          <Route index element={<PortalInicio />} />
          <Route path="formacao" element={<Permitido pagina="formacao"><Formacao portal /></Permitido>} />
          <Route path="cursos" element={<Navigate to={`${PORTAL_BASE}/formacao`} replace />} />
          <Route path="sessoes" element={<Permitido pagina="sessoes"><PortalSessoes /></Permitido>} />
          <Route path="ranking" element={<Permitido pagina="ranking"><PortalRanking /></Permitido>} />
          <Route path="ajuda" element={<Permitido pagina="ajuda"><PortalAjuda /></Permitido>} />
          <Route path="conta" element={<PortalConta />} />
          <Route path="gestao" element={<Gestor user={user}><Permitido pagina="gestao"><PortalGestaoPainel /></Permitido></Gestor>} />
          <Route path="gestao/cursos" element={<Gestor user={user}><Permitido pagina="gestao_cursos"><PaginaGestao><GestaoFormacao portal /></PaginaGestao></Permitido></Gestor>} />
          <Route path="gestao/acessos" element={<Gestor user={user}><Permitido pagina="gestao_acessos"><PortalAcessos /></Permitido></Gestor>} />
          <Route path="gestao/auditoria" element={<Gestor user={user}><Permitido pagina="gestao_auditoria"><PortalAuditoria /></Permitido></Gestor>} />
          <Route path="gestao/relatorios" element={<Gestor user={user}><Permitido pagina="gestao_relatorios"><PortalRelatorios /></Permitido></Gestor>} />
          <Route path="gestao/suporte" element={<Gestor user={user}><Permitido pagina="gestao_suporte"><PortalSuporteGestao /></Permitido></Gestor>} />
          <Route path="gestao/avisos" element={<Gestor user={user}><Permitido pagina="gestao_avisos"><PortalAvisos /></Permitido></Gestor>} />
          <Route path="gestao/configuracoes" element={<Gestor user={user}><Permitido pagina="gestao_configuracoes"><PortalConfiguracoes /></Permitido></Gestor>} />
          <Route path="login" element={<Navigate to={PORTAL_BASE} replace />} />
          <Route path="*" element={
            <Card className="mx-auto max-w-lg dark:border-slate-800 dark:bg-slate-900"><CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <p className="text-5xl font-bold text-slate-300">404</p>
              <p className="font-medium">Esta página não existe na Universidade.</p>
              <Button asChild variant="outline"><Link to={PORTAL_BASE}><Compass className="h-4 w-4" aria-hidden="true" />Ir para o início</Link></Button>
            </CardContent></Card>
          } />
        </Routes>
      </Suspense>
    </PortalLayout>
  );
}
