// Moldura do portal da Universidade Corporativa: cabeçalho com navegação, menu de gestão, utilizador, rodapé.
// Em modo foco (aula/avaliação) o cabeçalho e o rodapé escondem-se (regras [data-foco] do index.css).
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { GraduationCap, Home, Compass, BookOpen, Award, CalendarDays, Trophy, LifeBuoy, Menu, X, Sun, Moon, LogOut, User as UserIcon, Settings, ChevronDown, LayoutDashboard, Users, ScrollText, BarChart3, Megaphone, Inbox, ExternalLink, Presentation, ShieldCheck, PanelLeftClose, PanelLeftOpen, HelpCircle, BookMarked, MessageCircleQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/lib/AuthContext';
import { useModoFoco } from '@/lib/modoFoco';
import { hasUserProfile } from '@/components/lib/userUtils';
import { ehAdminPortal } from '@/lib/universidade';
import { logAuthEvent } from '@/lib/auditLog';
import { cn } from '@/lib/utils';
import { useConfigPortal } from './hooks';
import { PORTAL_BASE, iniciais, aplicarEscalaPortal, retirarEscalaPortal, paginasPermitidas, urlCursoPortal } from '@/lib/universidade';
import { usePermissoesPortal } from './hooks';

const tabDe = (loc) => new URLSearchParams(loc.search).get('tab') || 'catalogo';
const emFormacao = (loc) => loc.pathname === `${PORTAL_BASE}/formacao`;
export const NAV_ALUNO = [
  { to: PORTAL_BASE, label: 'Início', icon: Home, pagina: 'inicio', activo: (loc) => loc.pathname === PORTAL_BASE || loc.pathname === `${PORTAL_BASE}/` },
  { to: `${PORTAL_BASE}/formacao`, label: 'Cursos', icon: Compass, pagina: 'formacao', activo: (loc) => emFormacao(loc) && tabDe(loc) === 'catalogo' },
  { to: `${PORTAL_BASE}/formacao?tab=meus`, label: 'A minha formação', icon: BookOpen, pagina: 'formacao', activo: (loc) => emFormacao(loc) && ['meus', 'trilhas'].includes(tabDe(loc)) },
  { to: `${PORTAL_BASE}/formacao?tab=certificados`, label: 'Certificados', icon: Award, pagina: 'formacao', activo: (loc) => emFormacao(loc) && tabDe(loc) === 'certificados' },
  { to: `${PORTAL_BASE}/sessoes`, label: 'Sessões', icon: CalendarDays, pagina: 'sessoes', activo: (loc) => loc.pathname.startsWith(`${PORTAL_BASE}/sessoes`) },
  { to: `${PORTAL_BASE}/ranking`, label: 'Ranking', icon: Trophy, pagina: 'ranking', activo: (loc) => loc.pathname.startsWith(`${PORTAL_BASE}/ranking`) },
  { to: `${PORTAL_BASE}/ajuda`, label: 'Ajuda', icon: LifeBuoy, pagina: 'ajuda', activo: (loc) => loc.pathname.startsWith(`${PORTAL_BASE}/ajuda`) },
];
export const NAV_GESTAO = [
  { to: `${PORTAL_BASE}/gestao`, label: 'Painel', icon: LayoutDashboard, end: true, pagina: 'gestao' },
  { to: `${PORTAL_BASE}/gestao/cursos`, label: 'Cursos e conteúdos', icon: Presentation, pagina: 'gestao_cursos' },
  { to: `${PORTAL_BASE}/gestao/acessos`, label: 'Acessos', icon: Users, pagina: 'gestao_acessos' },
  { to: `${PORTAL_BASE}/gestao/auditoria`, label: 'Auditoria', icon: ScrollText, pagina: 'gestao_auditoria' },
  { to: `${PORTAL_BASE}/gestao/relatorios`, label: 'Relatórios', icon: BarChart3, pagina: 'gestao_relatorios' },
  { to: `${PORTAL_BASE}/gestao/suporte`, label: 'Suporte', icon: Inbox, pagina: 'gestao_suporte' },
  { to: `${PORTAL_BASE}/gestao/avisos`, label: 'Avisos', icon: Megaphone, pagina: 'gestao_avisos' },
  { to: `${PORTAL_BASE}/gestao/configuracoes`, label: 'Configurações', icon: Settings, pagina: 'gestao_configuracoes' },
];
export const gestaoActiva = (item, loc) => (item.end ? loc.pathname === item.to || loc.pathname === `${item.to}/` : loc.pathname.startsWith(item.to));
export const ehGestor = (user) => !!user && (ehAdminPortal(user) || hasUserProfile(user, 'instrutor'));
// Conjunto de páginas do portal que o utilizador pode abrir (predefinições enquanto a tabela carrega).
export function usePodeVer() {
  const { user } = useAuth();
  const { data: permissoes } = usePermissoesPortal();
  const permitidas = useMemo(() => paginasPermitidas(user, permissoes), [user, permissoes]);
  return (pagina) => !pagina || permitidas.has(pagina);
}

function useTemaEscuro() {
  const [escuro, setEscuro] = useState(() => {
    try {
      const guardado = localStorage.getItem('darkMode');
      if (guardado !== null) return guardado === 'true';
      return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    } catch { return false; }
  });
  useEffect(() => {
    document.documentElement.classList.toggle('dark', !!escuro);
    try { localStorage.setItem('darkMode', escuro); } catch { /* */ }
  }, [escuro]);
  return [escuro, setEscuro];
}

export async function sairDoPortal(user, logout) {
  try { logAuthEvent('logout', user?.email, 'Fim de sessão no portal da Universidade', 'Universidade'); } catch { /* */ }
  try { await logout(false); } catch { /* */ }
  window.location.replace(`${PORTAL_BASE}/login`);
}

export default function PortalLayout({ children }) {
  const loc = useLocation();
  const { user, logout } = useAuth();
  const { data: cfg } = useConfigPortal();
  const foco = useModoFoco();
  const [escuro, setEscuro] = useTemaEscuro();
  const [menuAberto, setMenuAberto] = useState(false);
  const gestor = ehGestor(user);
  const nomePortal = cfg?.nome_portal || 'Universidade Corporativa';
  const nome = user?.full_name || user?.email || '';

  useEffect(() => { document.title = `${nomePortal} · SGA`; }, [nomePortal]);
  useEffect(() => { aplicarEscalaPortal(); return () => retirarEscalaPortal(); }, []);
  useEffect(() => { setMenuAberto(false); }, [loc.pathname, loc.search]);
  useEffect(() => { if (!menuAberto) return undefined; const f = (e) => { if (e.key === 'Escape') setMenuAberto(false); }; window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f); }, [menuAberto]);

  const podeVer = usePodeVer();
  const navAluno = useMemo(() => NAV_ALUNO.filter(n => podeVer(n.pagina)).map(n => ({ ...n, activo: n.activo(loc) })), [loc, podeVer]);
  const navGestao = useMemo(() => NAV_GESTAO.filter(n => podeVer(n.pagina)).map(n => ({ ...n, activo: gestaoActiva(n, loc) })), [loc, podeVer]);
  const emGestao = loc.pathname.startsWith(`${PORTAL_BASE}/gestao`);

  return (
    <div data-foco={foco ? '1' : '0'} className="portal-uc flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[60] focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:shadow">Saltar para o conteúdo</a>

      <header className="foco-ocultar sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto flex h-16 max-w-screen-2xl items-center gap-3 px-4 md:px-6">
          <Link to={PORTAL_BASE} className="flex shrink-0 items-center gap-3" aria-label={`${nomePortal} — início`}>
            <img src="/logo-sga.png" alt="SGA" className="h-9 w-auto object-contain dark:hidden" />
            <img src="/logo-sga-light.png" alt="SGA" className="hidden h-9 w-auto object-contain dark:block" />
            <span className="hidden shrink-0 flex-col leading-tight sm:flex">
              <span className="whitespace-nowrap text-sm font-bold tracking-tight">{nomePortal}</span>
              <span className="hidden whitespace-nowrap text-[11px] text-slate-500 dark:text-slate-400 2xl:block">Sociedade Gestora de Aeroportos</span>
            </span>
          </Link>

          <nav aria-label="Principal" className="ml-3 hidden flex-1 items-center gap-0.5 xl:flex">
            {navAluno.map(n => (
              <Link key={n.to} to={n.to} aria-current={n.activo ? 'page' : undefined}
                className={cn('flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-medium transition-colors', n.activo ? 'bg-violet-50 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white')}>
                <n.icon className="h-4 w-4" aria-hidden="true" />{n.label}
              </Link>
            ))}
            {gestor && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className={cn('flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-medium transition-colors', emGestao ? 'bg-violet-50 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white')} aria-haspopup="menu">
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />Gestão<ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-60">
                  <DropdownMenuLabel>Gestão da Universidade</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {navGestao.map(n => (
                    <DropdownMenuItem key={n.to} asChild><Link to={n.to} className={cn('flex items-center gap-2', n.activo && 'font-semibold text-violet-700 dark:text-violet-300')}><n.icon className="h-4 w-4" aria-hidden="true" />{n.label}</Link></DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            {/* Ajuda: o mesmo padrão do Portal de Documentos — guia rápido, o curso guiado e o suporte, sempre à mão. */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className="rounded-full text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white" aria-label="Ajuda">
                  <HelpCircle className="h-5 w-5" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel className="font-normal"><p className="font-semibold text-slate-900 dark:text-slate-100">Precisa de ajuda?</p><p className="text-xs text-slate-500 dark:text-slate-400">Como usar a Universidade, passo a passo.</p></DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link to={`${PORTAL_BASE}/ajuda`} className="flex min-h-[2.5rem] items-center gap-2"><BookMarked className="h-4 w-4 text-violet-600" aria-hidden="true" />Guia rápido e perguntas frequentes</Link></DropdownMenuItem>
                {cfg?.guia_curso_id && <DropdownMenuItem asChild><Link to={urlCursoPortal(cfg.guia_curso_id)} className="flex min-h-[2.5rem] items-center gap-2"><GraduationCap className="h-4 w-4 text-violet-600" aria-hidden="true" />Curso: Como usar a Universidade</Link></DropdownMenuItem>}
                <DropdownMenuItem asChild><Link to={`${PORTAL_BASE}/ajuda#suporte`} className="flex min-h-[2.5rem] items-center gap-2"><MessageCircleQuestion className="h-4 w-4 text-violet-600" aria-hidden="true" />Pedir suporte</Link></DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button type="button" variant="ghost" size="icon" className="rounded-full text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white" aria-label={escuro ? 'Mudar para modo claro' : 'Mudar para modo escuro'} onClick={() => setEscuro(!escuro)}>
              {escuro ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="flex items-center gap-2 rounded-full border border-slate-200 py-1 pl-1 pr-2 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800" aria-label="Menu do utilizador">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white" aria-hidden="true">{iniciais(nome)}</span>
                  <span className="hidden max-w-[140px] truncate md:inline">{nome.split(' ')[0]}</span>
                  <ChevronDown className="hidden h-3.5 w-3.5 opacity-60 md:inline" aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="font-normal">
                  <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{nome}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user?.email}</p>
                  {gestor && <p className="mt-1 text-[11px] font-medium text-violet-700 dark:text-violet-300">{ehAdminPortal(user) ? 'Administrador' : 'Instrutor'}</p>}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link to={`${PORTAL_BASE}/conta`} className="flex items-center gap-2"><UserIcon className="h-4 w-4" aria-hidden="true" />A minha conta</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to={`${PORTAL_BASE}/ajuda`} className="flex items-center gap-2"><LifeBuoy className="h-4 w-4" aria-hidden="true" />Ajuda e suporte</Link></DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => sairDoPortal(user, logout)} className="flex items-center gap-2 text-red-600 focus:text-red-700 dark:text-red-400"><LogOut className="h-4 w-4" aria-hidden="true" />Terminar sessão</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button type="button" variant="ghost" size="icon" className="xl:hidden" aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'} aria-expanded={menuAberto} aria-controls="portal-menu-movel" onClick={() => setMenuAberto(v => !v)}>
              {menuAberto ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
            </Button>
          </div>
        </div>

        {menuAberto && (
          <nav id="portal-menu-movel" aria-label="Menu" className="border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 xl:hidden">
            <ul className="grid gap-1">
              {navAluno.map(n => (
                <li key={n.to}><Link to={n.to} aria-current={n.activo ? 'page' : undefined} className={cn('flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium', n.activo ? 'bg-violet-50 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800')}><n.icon className="h-4 w-4" aria-hidden="true" />{n.label}</Link></li>
              ))}
              {gestor && (
                <>
                  <li className="mt-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Gestão</li>
                  {navGestao.map(n => (
                    <li key={n.to}><Link to={n.to} aria-current={n.activo ? 'page' : undefined} className={cn('flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium', n.activo ? 'bg-violet-50 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800')}><n.icon className="h-4 w-4" aria-hidden="true" />{n.label}</Link></li>
                  ))}
                </>
              )}
            </ul>
          </nav>
        )}
      </header>

      <main id="main-content" className="mx-auto w-full max-w-screen-2xl flex-1 px-4 py-6 md:px-6 md:py-8">
        {children}
      </main>

      <footer className="foco-ocultar mt-8 border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-screen-2xl flex-col gap-4 px-4 py-6 text-sm text-slate-500 dark:text-slate-400 md:flex-row md:items-center md:justify-between md:px-6">
          <div className="flex items-center gap-3">
            <GraduationCap className="h-5 w-5 text-violet-600" aria-hidden="true" />
            <div>
              <p className="font-semibold text-slate-700 dark:text-slate-200">{nomePortal} · SGA</p>
              <p className="text-xs">Sociedade Gestora de Aeroportos · Direcção de Operações</p>
            </div>
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
            <li><Link to={`${PORTAL_BASE}/ajuda`} className="hover:text-slate-900 dark:hover:text-white">Ajuda e suporte</Link></li>
            <li><Link to={`${PORTAL_BASE}/sessoes`} className="hover:text-slate-900 dark:hover:text-white">Sessões</Link></li>
            <li><Link to={`${PORTAL_BASE}/privacidade`} className="hover:text-slate-900 dark:hover:text-white">Privacidade</Link></li>
            <li className="text-slate-400">© {new Date().getFullYear()} SGA</li>
          </ul>
        </div>
      </footer>
    </div>
  );
}

// Moldura das páginas de gestão: barra lateral vertical (recolhível) em ecrãs grandes, separadores horizontais em ecrãs
// pequenos, cabeçalho da página com acções. A preferência "menu recolhido" fica no navegador.
const CHAVE_MENU_GESTAO = 'uc:gestao-menu';
export function PaginaGestao({ titulo, descricao, accoes, children }) {
  const loc = useLocation();
  const [compacto, setCompacto] = useState(() => { try { return localStorage.getItem(CHAVE_MENU_GESTAO) === 'compacto'; } catch { return false; } });
  const alternar = () => { setCompacto(v => { const n = !v; try { localStorage.setItem(CHAVE_MENU_GESTAO, n ? 'compacto' : 'largo'); } catch { /* */ } return n; }); };
  const podeVer = usePodeVer();
  const itens = NAV_GESTAO.filter(n => podeVer(n.pagina)).map(n => ({ ...n, activo: gestaoActiva(n, loc) }));
  const classeItem = (activo) => cn('flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors', activo ? 'bg-violet-50 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white', compacto && 'justify-center px-0');
  return (
    <div className={cn('lg:grid lg:gap-6', compacto ? 'lg:grid-cols-[4rem_minmax(0,1fr)]' : 'lg:grid-cols-[15rem_minmax(0,1fr)]')}>
      <aside className="hidden lg:block">
        <nav aria-label="Gestão" className="rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900 lg:sticky lg:top-[var(--topo-fixo,1.5rem)]">
          <p className={cn('px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400', compacto && 'sr-only')}>Gestão</p>
          <ul className="space-y-0.5">
            {itens.map(n => (
              <li key={n.to}><Link to={n.to} title={compacto ? n.label : undefined} aria-current={n.activo ? 'page' : undefined} className={classeItem(n.activo)}><n.icon className="h-4 w-4 shrink-0" aria-hidden="true" />{!compacto && <span className="truncate">{n.label}</span>}</Link></li>
            ))}
          </ul>
          <div className="mt-2 space-y-0.5 border-t border-slate-200 pt-2 dark:border-slate-800">
            <Link to={PORTAL_BASE} title={compacto ? 'Ver como formando' : undefined} className={classeItem(false)}><GraduationCap className="h-4 w-4 shrink-0" aria-hidden="true" />{!compacto && <span className="truncate">Ver como formando</span>}</Link>
            <button type="button" onClick={alternar} className={cn(classeItem(false), 'w-full')} aria-pressed={compacto} title={compacto ? 'Expandir o menu' : 'Recolher o menu'}>
              {compacto ? <PanelLeftOpen className="h-4 w-4 shrink-0" aria-hidden="true" /> : <PanelLeftClose className="h-4 w-4 shrink-0" aria-hidden="true" />}{!compacto && <span className="truncate">Recolher menu</span>}
            </button>
          </div>
        </nav>
      </aside>
      <div className="min-w-0 space-y-5">
        <nav aria-label="Gestão" className="-mx-4 overflow-x-auto px-4 lg:hidden">
          <ul className="flex min-w-max gap-1 border-b border-slate-200 dark:border-slate-800">
            {itens.map(n => (
              <li key={n.to}><Link to={n.to} aria-current={n.activo ? 'page' : undefined} className={cn('-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium', n.activo ? 'border-violet-600 text-violet-800 dark:text-violet-200' : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white')}><n.icon className="h-4 w-4" aria-hidden="true" />{n.label}</Link></li>
            ))}
          </ul>
        </nav>
        {(titulo || accoes) && (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              {titulo && <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{titulo}</h1>}
              {descricao && <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{descricao}</p>}
            </div>
            {accoes && <div className="flex flex-wrap gap-2">{accoes}</div>}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
