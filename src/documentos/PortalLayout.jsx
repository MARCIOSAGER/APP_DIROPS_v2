// Moldura do Portal de Documentos (/documentos): cabeçalho com navegação, tema claro/escuro, menu do utilizador e
// rodapé com o logo SGA. Guarda também o vocabulário visual do portal — os símbolos de cor (T), a referência em
// monoespaçado, o selo de estado, o texto de validade, a linha densa de documento e os três estados (a carregar,
// vazio, erro). Nenhuma página deve escrever uma cor solta: passa tudo por T, para o claro e o escuro andarem a par.
// Regras: docs/desenho-portal-documentos.md. A identidade é azul-petróleo (a Universidade é violeta) e nada do
// DIROPS entra nesta moldura.
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  AlertTriangle, BarChart3, BookOpenCheck, Building2, CalendarClock, ChevronDown, ChevronRight, CircleSlash,
  FileText, FolderLock, FolderTree, Home, Inbox, LayoutDashboard, Library, Link2, LogOut, Menu, Moon,
  PanelLeftClose, PanelLeftOpen, RefreshCw, ScrollText, Search, Settings, ShieldCheck, Sun, User as UserIcon,
  Users, X, FileClock, FilePen, Stamp, Hash, Scale, HelpCircle, BookMarked, GraduationCap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/lib/AuthContext';
import { logAuthEvent } from '@/lib/auditLog';
import { cn } from '@/lib/utils';
import { fmtData } from '@/lib/safeDate';
import { PORTAL_BASE, ESTADO_LABEL, diasParaExpirar, iniciais, perfisPortal, paginasPermitidas } from '@/lib/portalDocumentos';
import { useConfigPortalDocs, usePermissoesPortalDocs } from './hooks';

const NOME_PADRAO = 'Documentos SGA';

// ── símbolos de cor (tokens) ────────────────────────────────────────────────
// Cinzentos com desvio para o acento (slate), acento azul-petróleo (teal) e semânticos separados do acento:
// verde = em vigor, âmbar = a expirar ou em revisão, vermelho = expirado ou destrutivo. Obsoleto é cinzento frio,
// não vermelho: não é erro, é facto. Cada símbolo traz já a variante escura — nunca se escreve uma cor solta
// dentro de um bloco de tema.
export const T = {
  fundo: 'bg-slate-50 dark:bg-slate-950',
  superficie: 'bg-white dark:bg-slate-900',
  superficieFraca: 'bg-slate-50 dark:bg-slate-900/60',
  linha: 'border-slate-200 dark:border-slate-800',
  divisoria: 'divide-slate-200 dark:divide-slate-800',
  tinta: 'text-slate-900 dark:text-slate-100',
  tintaMedia: 'text-slate-700 dark:text-slate-300',
  tintaFraca: 'text-slate-600 dark:text-slate-400',
  acento: 'text-teal-800 dark:text-teal-300',
  acentoFundo: 'bg-teal-50 text-teal-900 dark:bg-teal-950/60 dark:text-teal-100',
  verde: 'text-emerald-800 dark:text-emerald-300',
  ambar: 'text-amber-800 dark:text-amber-300',
  vermelho: 'text-red-700 dark:text-red-300',
  realce: 'hover:bg-slate-50 dark:hover:bg-slate-800/60',
  foco: 'focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400',
  focoDentro: 'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400',
  // Caixa de conteúdo: uma só borda, um só raio. A hierarquia faz-se com o título, não com sombras.
  caixa: 'rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900',
  // Banda de acolhimento (só a entrada): um gradiente ténue na cor da casa (azul-petróleo), para a página abrir com
  // um sentido de lugar em vez de texto solto. Usa-se só aqui — o resto do portal mantém-se plano, de propósito.
  heroiFundo: 'bg-gradient-to-br from-teal-50/80 via-white to-slate-50 dark:from-teal-950/40 dark:via-slate-900 dark:to-slate-950',
  heroiLinha: 'border-teal-100 dark:border-teal-900/50',
};

// Números, referências e códigos de documento em monoespaçado com algarismos tabulares. Vai em `style` porque o
// projecto substitui a escala de famílias do Tailwind (só existe `sans`): a classe `font-mono` não gera CSS.
export const MONO = { fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace', fontVariantNumeric: 'tabular-nums' };
export function Ref({ children, className, title }) {
  return <span style={MONO} className={cn('text-sm', className)} title={title}>{children}</span>;
}

// ── documento: o que se mostra sempre ───────────────────────────────────────
// Data de entrada em vigor (e não a da última alteração) e versão corrente: é o que evita que alguém use a cópia
// que tem no computador. `dataMovimento` serve só para ordenar «novos ou actualizados».
export const dataVigor = (doc) => doc?.em_vigor_desde || doc?.publicacao_em || doc?.data_publicacao || null;
export const dataMovimento = (doc) => doc?.updated_date || doc?.publicacao_em || doc?.em_vigor_desde || doc?.created_date || null;
export const versaoDe = (doc) => doc?.versao_atual || doc?.versao || '1';

const SELO_ESTADO = {
  rascunho: 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
  em_revisao: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200',
  aprovado: 'border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-200',
  em_vigor: 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200',
  obsoleto: 'border-slate-300 bg-slate-200/70 text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-400',
};

// Selo de estado: cor **e** texto, vocabulário fechado (Rascunho, Em revisão, Aprovado, Em vigor, Obsoleto).
export function EstadoSelo({ estado, className }) {
  const chave = estado && SELO_ESTADO[estado] ? estado : 'rascunho';
  return (
    <span className={cn('inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-sm font-medium leading-5', SELO_ESTADO[chave], className)}>
      {ESTADO_LABEL[chave] || chave}
    </span>
  );
}

// Validade em palavras, nunca só em cor: «Expira em 12 dias», «Expirou há 4 dias», «Sem validade».
export function textoValidade(doc) {
  const dias = diasParaExpirar(doc);
  if (dias === null) return { chave: 'sem_validade', texto: 'Sem validade' };
  if (dias < 0) { const n = -dias; return { chave: 'expirado', texto: `Expirou há ${n} ${n === 1 ? 'dia' : 'dias'}` }; }
  if (dias === 0) return { chave: 'expira_30', texto: 'Expira hoje' };
  if (dias <= 30) return { chave: 'expira_30', texto: `Expira em ${dias} ${dias === 1 ? 'dia' : 'dias'}` };
  if (dias <= 90) return { chave: 'expira_90', texto: `Expira em ${dias} dias` };
  return { chave: 'valido', texto: `Válido até ${fmtData(doc?.expira_em || doc?.data_expiracao)}` };
}

// Forma própria além da cor: um símbolo para expirado e para a expirar, texto para todos.
export function ValidadeTexto({ documento, className }) {
  const v = textoValidade(documento);
  const urgente = v.chave === 'expirado' || v.chave === 'expira_30';
  const Icone = v.chave === 'expirado' ? CircleSlash : (v.chave === 'expira_30' || v.chave === 'expira_90') ? CalendarClock : null;
  const cor = v.chave === 'expirado' ? T.vermelho : v.chave === 'expira_30' ? T.ambar : T.tintaFraca;
  return (
    <span className={cn('inline-flex items-center gap-1 text-sm', cor, urgente && 'font-medium', className)}>
      {Icone && <Icone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}{v.texto}
    </span>
  );
}

// Linha densa de documento: número em monoespaçado, título, estado, versão e entrada em vigor, validade. Linhas,
// não cartões — é o que permite percorrer uma lista de uma vez. `marca` acrescenta um selo próprio da página.
export function LinhaDocumento({ doc, aeroporto, marca, className }) {
  if (!doc) return null;
  const vigor = dataVigor(doc);
  return (
    <li>
      <Link to={`${PORTAL_BASE}/documento/${doc.id}`} className={cn('flex min-h-[3.5rem] items-start gap-3 px-3 py-3 transition-colors sm:px-4', T.realce, T.focoDentro, className)}>
        <FileText className={cn('mt-0.5 h-5 w-5 shrink-0', T.tintaFraca)} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            {doc.numero
              ? <Ref className={cn('shrink-0 font-semibold', T.tinta)}>{doc.numero}</Ref>
              : <span className={cn('shrink-0 text-sm italic', T.tintaFraca)}>sem número</span>}
            <span className={cn('min-w-0 flex-1 truncate font-medium', T.tinta)}>{doc.titulo || 'Documento sem título'}</span>
            {marca}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <EstadoSelo estado={doc.estado} />
            <span className={cn('text-sm', T.tintaFraca)}>
              <span className="tabular-nums">v{versaoDe(doc)}</span>
              {vigor ? <> · em vigor desde <span className="tabular-nums">{fmtData(vigor)}</span></> : ' · sem data de entrada em vigor'}
            </span>
            <ValidadeTexto documento={doc} />
            {aeroporto && <span className={cn('inline-flex items-center gap-1 text-sm', T.tintaFraca)}><Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{aeroporto}</span>}
          </span>
        </span>
        <ChevronRight className={cn('mt-1 h-5 w-5 shrink-0', T.tintaFraca)} aria-hidden="true" />
      </Link>
    </li>
  );
}

// Última linha de uma lista cortada: continuação da própria lista, não um botão a repetir o menu.
export function LinhaMais({ texto, para }) {
  return (
    <li>
      <Link to={para} className={cn('flex min-h-[2.75rem] items-center gap-1.5 px-3 py-2.5 text-sm font-medium sm:px-4', T.acento, T.realce, T.focoDentro)}>
        {texto}<ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </li>
  );
}

// ── os três estados ─────────────────────────────────────────────────────────
// Vazio: diz **porquê** está vazio e dá **uma** acção.
export function EstadoVazio({ icone: Icone = Inbox, titulo, texto, children, className }) {
  return (
    <div className={cn('flex flex-col items-start gap-2 px-4 py-8 sm:px-6', className)}>
      <Icone className={cn('h-6 w-6', T.tintaFraca)} aria-hidden="true" />
      <p className={cn('font-medium', T.tinta)}>{titulo}</p>
      {texto && <p className={cn('max-w-prose text-sm', T.tintaFraca)}>{texto}</p>}
      {children && <div className="mt-2 flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

// Erro: diz o que falhou e o que fazer, com botão de repetir. Sem códigos crus.
export function EstadoErro({ titulo = 'Não foi possível carregar', texto = 'Pode ser uma falha momentânea da rede ou das permissões. Tente de novo; se continuar, avise a gestão do portal.', onTentar, className }) {
  return (
    <div className={cn('flex flex-col items-start gap-2 px-4 py-8 sm:px-6', className)} role="alert">
      <AlertTriangle className={cn('h-6 w-6', T.ambar)} aria-hidden="true" />
      <p className={cn('font-medium', T.tinta)}>{titulo}</p>
      <p className={cn('max-w-prose text-sm', T.tintaFraca)}>{texto}</p>
      {onTentar && <Button variant="outline" className="mt-2 h-11" onClick={onTentar}><RefreshCw className="h-4 w-4" aria-hidden="true" />Tentar de novo</Button>}
    </div>
  );
}

// A carregar: linhas-esqueleto com as dimensões reais das linhas, não rodas.
export function EsqueletoLinhas({ linhas = 4, className }) {
  return (
    <ul className={cn('divide-y', T.divisoria, className)} aria-busy="true" aria-live="polite">
      <li className="sr-only">A carregar documentos…</li>
      {Array.from({ length: linhas }).map((_, i) => (
        <li key={i} className="flex min-h-[3.5rem] items-start gap-3 px-3 py-3 sm:px-4">
          <Skeleton className="h-5 w-5 shrink-0 rounded" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-[min(24rem,80%)]" />
            <Skeleton className="h-3.5 w-[min(18rem,60%)]" />
          </div>
        </li>
      ))}
    </ul>
  );
}

// Título de secção: discreto. A hierarquia da página faz-se aqui, não com cartões todos iguais.
export function TituloSeccao({ children, contagem, className }) {
  return (
    <h2 className={cn('mb-2.5 flex items-center gap-2.5 text-sm font-semibold uppercase tracking-wider', T.tintaMedia, className)}>
      {children}
      {contagem != null && (
        <span style={MONO} className={cn('rounded-full px-2 py-0.5 text-xs font-semibold normal-case tracking-normal', T.acentoFundo)}>{contagem}</span>
      )}
    </h2>
  );
}

// ── navegação ───────────────────────────────────────────────────────────────
// Navegação de consulta (toda a gente). Cada item declara a chave da página: só aparece se o perfil a puder ver.
export const NAV_CONSULTA = [
  { to: PORTAL_BASE, label: 'Início', icon: Home, pagina: 'inicio', activo: (loc) => loc.pathname === PORTAL_BASE || loc.pathname === `${PORTAL_BASE}/` },
  { to: `${PORTAL_BASE}/biblioteca`, label: 'Biblioteca', icon: Library, pagina: 'biblioteca', activo: (loc) => loc.pathname.startsWith(`${PORTAL_BASE}/biblioteca`) || loc.pathname.startsWith(`${PORTAL_BASE}/documento/`) },
  { to: `${PORTAL_BASE}/pesquisa`, label: 'Pesquisa', icon: Search, pagina: 'pesquisa', activo: (loc) => loc.pathname.startsWith(`${PORTAL_BASE}/pesquisa`) },
  { to: `${PORTAL_BASE}/leituras`, label: 'As minhas leituras', icon: BookOpenCheck, pagina: 'leituras', activo: (loc) => loc.pathname.startsWith(`${PORTAL_BASE}/leituras`) },
  { to: `${PORTAL_BASE}/aprovacao`, label: 'Aprovações', icon: Stamp, pagina: 'aprovacao', activo: (loc) => loc.pathname.startsWith(`${PORTAL_BASE}/aprovacao`) },
];
// Navegação da gestão documental (gestores, editores e administradores, conforme as páginas de cada perfil).
export const NAV_GESTAO = [
  { to: `${PORTAL_BASE}/gestao`, label: 'Painel', icon: LayoutDashboard, end: true, pagina: 'gestao' },
  { to: `${PORTAL_BASE}/gestao/documentos`, label: 'Documentos', icon: FileText, pagina: 'gestao_documentos' },
  { to: `${PORTAL_BASE}/gestao/redigir`, label: 'Redigir documentos', icon: FilePen, pagina: 'gestao_documentos', editor: true },
  { to: `${PORTAL_BASE}/gestao/pastas`, label: 'Pastas', icon: FolderTree, pagina: 'gestao_pastas' },
  { to: `${PORTAL_BASE}/gestao/emendas`, label: 'Emendas', icon: FileClock, pagina: 'gestao_emendas' },
  { to: `${PORTAL_BASE}/gestao/avsec`, label: 'Regime AVSEC', icon: FolderLock, pagina: 'gestao_avsec' },
  { to: `${PORTAL_BASE}/gestao/conformidade`, label: 'Conformidade', icon: Scale, pagina: 'gestao_conformidade' },
  { to: `${PORTAL_BASE}/gestao/codificacao`, label: 'Codificação', icon: Hash, pagina: 'gestao_codificacao' },
  { to: `${PORTAL_BASE}/gestao/links`, label: 'Links', icon: Link2, pagina: 'gestao_links' },
  { to: `${PORTAL_BASE}/gestao/acessos`, label: 'Acessos', icon: Users, pagina: 'gestao_acessos' },
  { to: `${PORTAL_BASE}/gestao/auditoria`, label: 'Auditoria', icon: ScrollText, pagina: 'gestao_auditoria' },
  { to: `${PORTAL_BASE}/gestao/relatorios`, label: 'Relatórios', icon: BarChart3, pagina: 'gestao_relatorios' },
  { to: `${PORTAL_BASE}/gestao/configuracoes`, label: 'Configurações', icon: Settings, pagina: 'gestao_configuracoes' },
];
export const gestaoActiva = (item, loc) => (item.end ? loc.pathname === item.to || loc.pathname === `${item.to}/` : loc.pathname.startsWith(item.to));

// Quem entra na área de gestão documental (o servidor manda na mesma; isto é só para a interface fazer sentido).
export const ehGestor = (user) => !!user && perfisPortal(user).gestor;
// Editores (sem gestão) só vêem na gestão as páginas marcadas `editor` — hoje, «Redigir documentos».
export const navGestaoDe = (user, podeVer) => {
  const p = user ? perfisPortal(user) : {};
  return NAV_GESTAO.filter(n => podeVer(n.pagina) && (p.gestor || (p.editor && n.editor)));
};

const rotuloPerfil = (user) => {
  const p = perfisPortal(user);
  if (p.admin) return 'Administrador de documentos';
  if (p.gestor) return 'Gestor de documentos';
  if (p.editor) return 'Editor de documentos';
  return p.membro ? 'Leitor de documentos' : '';
};

// Conjunto de páginas que o utilizador pode abrir (enquanto a tabela de permissões carrega valem as predefinições).
export function usePodeVer() {
  const { user } = useAuth();
  const { data: permissoes } = usePermissoesPortalDocs();
  const permitidas = useMemo(() => paginasPermitidas(user, permissoes), [user, permissoes]);
  return useMemo(() => (pagina) => !pagina || permitidas.has(pagina), [permitidas]);
}

// Modo claro por omissão: o portal é usado em pista, ao sol. Só fica escuro se a pessoa o escolher.
function useTemaEscuro() {
  const [escuro, setEscuro] = useState(() => {
    try { return localStorage.getItem('darkMode') === 'true'; } catch { return false; }
  });
  useEffect(() => {
    document.documentElement.classList.toggle('dark', !!escuro);
    try { localStorage.setItem('darkMode', escuro); } catch { /* navegador sem armazenamento */ }
  }, [escuro]);
  return [escuro, setEscuro];
}

export async function sairDoPortal(user, logout) {
  try { logAuthEvent('logout', user?.email, 'Fim de sessão no Portal de Documentos', 'Documentos'); } catch { /* */ }
  try { await logout(false); } catch { /* */ }
  window.location.replace(`${PORTAL_BASE}/login`);
}

// Estados de um item de navegação (petróleo quando activo, cinzento quando não). Alvo de toque de 44 px.
const classeNav = (activo, extra) => cn(
  'flex min-h-[2.75rem] items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-sm font-medium transition-colors',
  activo ? 'bg-teal-50 text-teal-900 dark:bg-teal-950/60 dark:text-teal-100' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white',
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400',
  extra,
);

export default function PortalLayout({ children }) {
  const loc = useLocation();
  const { user, logout } = useAuth();
  const { data: cfg } = useConfigPortalDocs();
  const [escuro, setEscuro] = useTemaEscuro();
  const [menuAberto, setMenuAberto] = useState(false);
  const podeVer = usePodeVer();
  const nomePortal = cfg?.nome_portal || NOME_PADRAO;
  const nome = user?.full_name || user?.email || '';

  useEffect(() => { document.title = `${nomePortal} · SGA`; }, [nomePortal]);
  useEffect(() => { setMenuAberto(false); }, [loc.pathname, loc.search]);
  useEffect(() => {
    if (!menuAberto) return undefined;
    const f = (e) => { if (e.key === 'Escape') setMenuAberto(false); };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [menuAberto]);

  const navConsulta = useMemo(() => NAV_CONSULTA.filter(n => podeVer(n.pagina)).map(n => ({ ...n, activo: n.activo(loc) })), [loc, podeVer]);
  const navGestao = useMemo(() => navGestaoDe(user, podeVer).map(n => ({ ...n, activo: gestaoActiva(n, loc) })), [loc, podeVer, user]);
  const emGestao = loc.pathname.startsWith(`${PORTAL_BASE}/gestao`);
  const perfil = rotuloPerfil(user);

  return (
    <div className={cn('portal-gd flex min-h-screen flex-col', T.fundo, T.tinta)} style={{ '--topo-fixo': '4.5rem' }}>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[60] focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:shadow dark:focus:bg-slate-900">Saltar para o conteúdo</a>

      {/* Cabeçalho: identidade do portal e navegação. O slogan não entra aqui — é decoração e a página não o repete. */}
      <header className={cn('sticky top-0 z-40 border-b bg-white/95 backdrop-blur dark:bg-slate-900/95', T.linha)}>
        <div className="mx-auto flex h-14 max-w-screen-2xl items-center gap-3 px-4 md:px-6">
          <Link to={PORTAL_BASE} className={cn('flex shrink-0 items-center gap-2.5 rounded-lg', T.foco)} aria-label={`${nomePortal} — início`}>
            <img src="/logo-sga.png" alt="SGA" className="h-8 w-auto object-contain dark:hidden" />
            <img src="/logo-sga-light.png" alt="SGA" className="hidden h-8 w-auto object-contain dark:block" />
            <span className="hidden whitespace-nowrap text-sm font-bold tracking-tight sm:inline">{nomePortal}</span>
          </Link>

          <nav aria-label="Principal" className="ml-2 hidden flex-1 items-center gap-0.5 lg:flex">
            {navConsulta.map(n => (
              <Link key={n.to} to={n.to} aria-current={n.activo ? 'page' : undefined} className={classeNav(n.activo)}>
                <n.icon className="h-4 w-4" aria-hidden="true" />{n.label}
              </Link>
            ))}
            {navGestao.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className={classeNav(emGestao)} aria-haspopup="menu">
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />Gestão<ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-60">
                  <DropdownMenuLabel>Gestão documental</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {navGestao.map(n => (
                    <DropdownMenuItem key={n.to} asChild>
                      <Link to={n.to} className={cn('flex min-h-[2.5rem] items-center gap-2', n.activo && cn('font-semibold', T.acento))}><n.icon className="h-4 w-4" aria-hidden="true" />{n.label}</Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            {/* Ajuda: o mesmo padrão que o pessoal já conhece do DIROPS — Guia do Utilizador + o curso na Universidade. */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className={cn('h-11 w-11 rounded-full hover:text-slate-900 dark:hover:text-white', T.tintaFraca)} aria-label="Ajuda">
                  <HelpCircle className="h-5 w-5" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="font-normal"><p className={cn('font-semibold', T.tinta)}>Precisa de ajuda?</p></DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link to={`${PORTAL_BASE}/guia`} className="flex min-h-[2.5rem] items-center gap-2"><BookMarked className="h-4 w-4 text-teal-700 dark:text-teal-300" aria-hidden="true" />Guia do Utilizador</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/universidade" className="flex min-h-[2.5rem] items-center gap-2"><GraduationCap className="h-4 w-4 text-teal-700 dark:text-teal-300" aria-hidden="true" />Curso: Como usar o GED</Link></DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button type="button" variant="ghost" size="icon" className={cn('h-11 w-11 rounded-full hover:text-slate-900 dark:hover:text-white', T.tintaFraca)} aria-label={escuro ? 'Mudar para modo claro' : 'Mudar para modo escuro'} onClick={() => setEscuro(!escuro)}>
              {escuro ? <Sun className="h-5 w-5" aria-hidden="true" /> : <Moon className="h-5 w-5" aria-hidden="true" />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className={cn('flex min-h-[2.75rem] items-center gap-2 rounded-full border py-1 pl-1 pr-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800', T.linha, T.foco)} aria-label="Menu do utilizador">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-800 text-xs font-bold text-white" aria-hidden="true">{iniciais(nome)}</span>
                  <span className="hidden max-w-[140px] truncate md:inline">{nome.split(' ')[0]}</span>
                  <ChevronDown className="hidden h-3.5 w-3.5 opacity-60 md:inline" aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="font-normal">
                  <p className={cn('truncate font-semibold', T.tinta)}>{nome}</p>
                  <p className={cn('truncate text-xs', T.tintaFraca)}>{user?.email}</p>
                  {perfil && <p className={cn('mt-1 text-xs font-medium', T.acento)}>{perfil}</p>}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link to={`${PORTAL_BASE}/conta`} className="flex min-h-[2.5rem] items-center gap-2"><UserIcon className="h-4 w-4" aria-hidden="true" />A minha conta</Link></DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => sairDoPortal(user, logout)} className="flex min-h-[2.5rem] items-center gap-2 text-red-700 focus:text-red-800 dark:text-red-300"><LogOut className="h-4 w-4" aria-hidden="true" />Terminar sessão</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button type="button" variant="ghost" size="icon" className="h-11 w-11 lg:hidden" aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'} aria-expanded={menuAberto} aria-controls="portal-docs-menu" onClick={() => setMenuAberto(v => !v)}>
              {menuAberto ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
            </Button>
          </div>
        </div>

        {/* Menu em telemóvel: alvos de 48 px e rolamento próprio, para caber com o teclado aberto. */}
        {menuAberto && (
          <nav id="portal-docs-menu" aria-label="Menu" className={cn('max-h-[70vh] overflow-y-auto border-t px-4 py-3 lg:hidden', T.linha, T.superficie)}>
            <ul className="grid gap-1">
              {navConsulta.map(n => (
                <li key={n.to}><Link to={n.to} aria-current={n.activo ? 'page' : undefined} className={classeNav(n.activo, 'min-h-[3rem] px-3')}><n.icon className="h-5 w-5" aria-hidden="true" />{n.label}</Link></li>
              ))}
              <li><Link to={`${PORTAL_BASE}/conta`} aria-current={loc.pathname.startsWith(`${PORTAL_BASE}/conta`) ? 'page' : undefined} className={classeNav(loc.pathname.startsWith(`${PORTAL_BASE}/conta`), 'min-h-[3rem] px-3')}><UserIcon className="h-5 w-5" aria-hidden="true" />A minha conta</Link></li>
              {navGestao.length > 0 && (
                <>
                  <li className={cn('mt-2 px-3 pt-2 text-xs font-semibold uppercase tracking-wider', T.tintaFraca)}>Gestão documental</li>
                  {navGestao.map(n => (
                    <li key={n.to}><Link to={n.to} aria-current={n.activo ? 'page' : undefined} className={classeNav(n.activo, 'min-h-[3rem] px-3')}><n.icon className="h-5 w-5" aria-hidden="true" />{n.label}</Link></li>
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

      {/* Rodapé: identidade, privacidade e apoio. Não repete a navegação que está no cabeçalho. */}
      <footer className={cn('mt-10 border-t', T.linha, T.superficie)}>
        <div className={cn('mx-auto flex max-w-screen-2xl flex-col gap-3 px-4 py-5 text-sm md:flex-row md:items-center md:justify-between md:px-6', T.tintaFraca)}>
          <div className="flex items-center gap-3">
            <img src="/logo-sga.png" alt="SGA" className="h-7 w-auto object-contain dark:hidden" />
            <img src="/logo-sga-light.png" alt="SGA" className="hidden h-7 w-auto object-contain dark:block" />
            <p><span className={cn('font-semibold', T.tintaMedia)}>{nomePortal}</span> · Sociedade Gestora de Aeroportos</p>
          </div>
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <li><Link to={`${PORTAL_BASE}/privacidade`} className={cn('rounded hover:underline', T.foco)}>Privacidade</Link></li>
            {cfg?.email_suporte && <li><a href={`mailto:${cfg.email_suporte}`} className={cn('rounded hover:underline', T.foco)}>Apoio: {cfg.email_suporte}</a></li>}
            <li className="tabular-nums">© {new Date().getFullYear()} SGA</li>
          </ul>
        </div>
      </footer>
    </div>
  );
}

// Moldura das páginas de gestão: barra lateral vertical (recolhível) em ecrãs grandes, separadores horizontais em
// ecrãs pequenos e cabeçalho da página com acções. A preferência "menu recolhido" fica guardada no navegador.
const CHAVE_MENU_GESTAO = 'gd:gestao-menu';
export function PaginaGestao({ titulo, descricao, accoes, children }) {
  const loc = useLocation();
  const podeVer = usePodeVer();
  const [compacto, setCompacto] = useState(() => { try { return localStorage.getItem(CHAVE_MENU_GESTAO) === 'compacto'; } catch { return false; } });
  const alternar = () => setCompacto(v => { const n = !v; try { localStorage.setItem(CHAVE_MENU_GESTAO, n ? 'compacto' : 'largo'); } catch { /* */ } return n; });
  const { user } = useAuth();
  const itens = navGestaoDe(user, podeVer).map(n => ({ ...n, activo: gestaoActiva(n, loc) }));
  const classeItem = (activo) => cn(
    'flex min-h-[2.75rem] items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-colors',
    activo ? 'bg-teal-50 text-teal-900 dark:bg-teal-950/60 dark:text-teal-100' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400',
    compacto && 'justify-center px-0',
  );
  return (
    <div className={cn('lg:grid lg:gap-6', compacto ? 'lg:grid-cols-[4rem_minmax(0,1fr)]' : 'lg:grid-cols-[15rem_minmax(0,1fr)]')}>
      <aside className="hidden lg:block">
        <nav aria-label="Gestão documental" className={cn('rounded-xl border p-2 lg:sticky lg:top-[var(--topo-fixo,1.5rem)]', T.linha, T.superficie)}>
          <p className={cn('px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider', T.tintaFraca, compacto && 'sr-only')}>Gestão</p>
          <ul className="space-y-0.5">
            {itens.map(n => (
              <li key={n.to}><Link to={n.to} title={compacto ? n.label : undefined} aria-current={n.activo ? 'page' : undefined} className={classeItem(n.activo)}><n.icon className="h-4 w-4 shrink-0" aria-hidden="true" />{!compacto && <span className="truncate">{n.label}</span>}</Link></li>
            ))}
          </ul>
          <div className={cn('mt-2 space-y-0.5 border-t pt-2', T.linha)}>
            <Link to={PORTAL_BASE} title={compacto ? 'Ver como leitor' : undefined} className={classeItem(false)}><FolderLock className="h-4 w-4 shrink-0" aria-hidden="true" />{!compacto && <span className="truncate">Ver como leitor</span>}</Link>
            <button type="button" onClick={alternar} className={cn(classeItem(false), 'w-full')} aria-pressed={compacto} title={compacto ? 'Expandir o menu' : 'Recolher o menu'}>
              {compacto ? <PanelLeftOpen className="h-4 w-4 shrink-0" aria-hidden="true" /> : <PanelLeftClose className="h-4 w-4 shrink-0" aria-hidden="true" />}{!compacto && <span className="truncate">Recolher menu</span>}
            </button>
          </div>
        </nav>
      </aside>
      <div className="min-w-0 space-y-5">
        <nav aria-label="Gestão documental" className="-mx-4 overflow-x-auto px-4 lg:hidden">
          <ul className={cn('flex min-w-max gap-1 border-b', T.linha)}>
            {itens.map(n => (
              <li key={n.to}><Link to={n.to} aria-current={n.activo ? 'page' : undefined} className={cn('-mb-px flex min-h-[2.75rem] items-center gap-1.5 border-b-2 px-3 text-sm font-medium', n.activo ? 'border-teal-700 text-teal-900 dark:border-teal-400 dark:text-teal-200' : cn('border-transparent hover:border-slate-300 hover:text-slate-900 dark:hover:text-white', T.tintaFraca))}><n.icon className="h-4 w-4" aria-hidden="true" />{n.label}</Link></li>
            ))}
          </ul>
        </nav>
        {(titulo || accoes) && (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              {titulo && <h1 className={cn('text-xl font-bold tracking-tight sm:text-2xl', T.tinta)}>{titulo}</h1>}
              {descricao && <p className={cn('mt-1 text-sm', T.tintaFraca)}>{descricao}</p>}
            </div>
            {accoes && <div className="flex flex-wrap gap-2">{accoes}</div>}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
