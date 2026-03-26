# Architecture

**Analysis Date:** 2026-03-26

## Pattern Overview

**Overall:** Single-Page Application (SPA) with client-side routing, entity-based data layer, and role-based access control.

**Key Characteristics:**
- React SPA with lazy-loaded page routes and a shared Layout shell
- Entity adapter pattern wrapping Supabase REST API (factory via `_createEntity.js`)
- Compatibility layer (`base44Client.js`) preserving original Base44 BaaS API surface
- Multi-tenant architecture via `empresa_id` column + `CompanyViewContext` for superadmin impersonation
- Permission system driven by database `regra_permissao` table with hardcoded fallback defaults
- PWA with service worker, offline-first query caching, and chunk error auto-recovery
- Client-side "functions" auto-discovered via `import.meta.glob`, with fallback to Supabase Edge Functions

## Layers

**Presentation Layer (Pages):**
- Purpose: Top-level route components, one per page/feature
- Location: `src/pages/*.jsx`
- Contains: 45 page components (lazy-loaded via `src/pages.config.js`)
- Depends on: Domain components, entities, hooks, AuthContext, CompanyViewContext, i18n
- Used by: Router in `src/App.jsx`

**Layout Shell:**
- Purpose: Sidebar navigation, top bar, permission gating, company/logo switching, dark mode
- Location: `src/Layout.jsx` (864 lines)
- Contains: Navigation groups, permission checks, company selector (superadmin), session timeout, tour, chatbot
- Depends on: `AuthContext`, `CompanyViewContext`, `userUtils`, `RegraPermissao` entity, `Empresa` entity
- Used by: `App.jsx` wraps all authenticated routes in `LayoutWrapper`

**Domain Components:**
- Purpose: Feature-specific UI components organized by business domain
- Location: `src/components/{domain}/` (one directory per feature area)
- Contains: Forms, lists, modals, stats, detail views
- Depends on: UI primitives, entities, hooks
- Used by: Pages import and compose these components

**UI Primitives:**
- Purpose: Reusable design system components (shadcn/ui based)
- Location: `src/components/ui/*.jsx` (52 components)
- Contains: button, card, dialog, select, table, tabs, calendar, combobox, etc.
- Depends on: Radix UI primitives, Tailwind CSS
- Used by: All domain components and pages

**Shared Components:**
- Purpose: Cross-cutting UI features used across many pages
- Location: `src/components/shared/*.jsx` (23 components)
- Contains: `AccessDenied`, `ConfirmModal`, `AlertModal`, `SendEmailModal`, `ChatbotIA`, `SessionTimeoutModal`, `TourGuiado`, `NetworkIndicator`, `GlobalLoadingModal`, `AppUpdateBanner`, `CookieConsent`, `SortableTableHeader`, `PullToRefreshWrapper`
- Used by: Layout and various pages

**Entity Layer (Data Access):**
- Purpose: Typed CRUD wrappers for each Supabase table
- Location: `src/entities/*.js` (63 entity files + `_createEntity.js` factory)
- Contains: One exported constant per table, created via `createEntity(tableName)`
- Depends on: `src/lib/supabaseClient.js`
- Used by: Pages, hooks, domain components, functions

**Compatibility Layer:**
- Purpose: Preserves original Base44 BaaS API for legacy code paths
- Location: `src/api/base44Client.js` (main), `src/api/entities.js`, `src/api/integrations.js`
- Contains: `base44.auth`, `base44.entities` (Proxy), `base44.functions`, `base44.integrations.Core`
- Depends on: Entity factory, Supabase client, `_invokeFunction`
- Used by: Legacy components that import from `@/api/entities` or `@/api/integrations`

**Hooks Layer:**
- Purpose: React Query wrappers for common data fetching patterns
- Location: `src/hooks/*.js` (6 hooks)
- Contains: `useVoos`, `useVoosLigados`, `useCalculosTarifa`, `useDashboardStats`, `useSubmitGuard`, `use-mobile`
- Depends on: Entities, Supabase client, React Query
- Used by: Pages

**Static Data Hooks:**
- Purpose: Cached hooks for reference data (airports, airlines, aircraft)
- Location: `src/components/lib/useStaticData.jsx`
- Contains: `useAeroportos`, `useCompanhias`, `useAeronaves`, `useModelosAeronave`
- Depends on: Entities, React Query, CompanyViewContext
- Used by: Forms, pages that need reference data

**Functions Layer:**
- Purpose: Business logic functions (client-side first, Edge Function fallback)
- Location: `src/functions/*.js` (45+ function files + `_invokeFunction.js` dispatcher)
- Contains: PDF generation, email sending, FlightAware sync, notification dispatch, AI chatbot, CSV export, WhatsApp/ZAPI integration
- Depends on: Supabase client, entities
- Used by: Pages, domain components, `base44Client.js`

**Lib Layer:**
- Purpose: Core infrastructure and cross-cutting utilities
- Location: `src/lib/*.js` / `src/lib/*.jsx`
- Contains: `supabaseClient.js`, `AuthContext.jsx`, `CompanyViewContext.jsx`, `query-client.js`, `auditLog.js`, `errorUtils.js`, `sanitize.js`, `emailTemplates.js`, `pdfTemplate.js`, `webVitals.js`, `NavigationTracker.jsx`
- Used by: Everything

**Component Lib:**
- Purpose: Shared business logic helpers and i18n
- Location: `src/components/lib/*.jsx`
- Contains: `userUtils.jsx` (permission checks, superadmin detection, data filtering), `i18n.jsx` (PT/EN translations), `tariffCalculations.jsx`, `tariffCalculators.jsx`, `tariffCache.jsx`, `aeroportosAngola.jsx`, `notificacoes.jsx`, `export.jsx`, `utils.jsx`, `auditoria.jsx`
- Used by: Layout, pages, domain components

## Data Flow

**Page Data Loading (typical pattern):**

1. Page component mounts, calls `useAuth()` to get `authUser` and `useCompanyView()` to get `effectiveEmpresaId`
2. Page uses React Query hooks (e.g., `useVoos({ empresaId: effectiveEmpresaId })`) or direct entity calls (e.g., `Voo.filter(filters)`)
3. Entity factory builds Supabase query with filters/ordering, paginates via 500-row batches
4. Data returned to component, rendered with UI primitives
5. Mutations call `Entity.create()`, `Entity.update()`, `Entity.delete()` directly, then invalidate React Query cache or refetch

**Entity CRUD Pattern:**
```javascript
// Import entity
import { Voo } from '@/entities/Voo';

// List all (paginated internally in 500-row batches)
const voos = await Voo.list('-data_operacao');

// Filter with operators
const filtered = await Voo.filter(
  { empresa_id: empresaId, deleted_at: { $is: null } },
  '-data_operacao',
  1000
);

// Create (auto-sets created_date, created_by from auth)
const newVoo = await Voo.create({ numero_voo: 'TP123', ... });

// Update (auto-sets updated_date, updated_by)
await Voo.update(id, { status: 'confirmado' });

// Server-side pagination
const page = await Voo.paginate({ filters, orderBy: '-data_operacao', page: 1, pageSize: 50 });
```

**Function Invocation Pattern:**
```javascript
// Via base44 compatibility layer
import { base44 } from '@/api/base44Client';
await base44.functions.invoke('sendEmailDirect', { to, subject, html });

// Via direct import
import { invokeFunction } from '@/functions/_invokeFunction';
await invokeFunction('chatbotIA', { message });

// _invokeFunction checks local functions first (import.meta.glob),
// falls back to supabase.functions.invoke() for Edge Functions
```

**State Management:**
- **Server state:** TanStack React Query (`@tanstack/react-query`) with `queryClientInstance` (3-min stale, 15-min GC, offline-first)
- **Auth state:** `AuthContext` (React Context) — user profile, auth status, loading state
- **Company view state:** `CompanyViewContext` (React Context) — superadmin company switching, persisted in `sessionStorage`
- **UI state:** Component-local `useState` (no global UI state store)
- **Language state:** `I18nContext` (React Context) — PT/EN toggle, persisted in `localStorage`
- **Dark mode:** `localStorage` + `document.documentElement.classList.toggle('dark')`
- **Permissions:** In-memory cache in `Layout.jsx` (`_layoutCache`) with 5-min TTL

## Key Abstractions

**Entity Factory (`_createEntity`):**
- Purpose: Creates a standard CRUD object for any Supabase table
- Location: `src/entities/_createEntity.js`
- Pattern: Factory function returning `{ list, filter, get, create, update, delete, paginate, count, findOne }`
- Auto-appends `created_date`, `created_by`, `updated_date`, `updated_by` audit fields
- Filter operators: `$eq`, `$neq/$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$contains`, `$like/$ilike`, `$is`, `$not`
- Default ordering: `created_date DESC`
- Pagination: 500-row batches via `fetchAll()` helper

**Entity Proxy (`base44Client.js`):**
- Purpose: Auto-creates entity instances on-demand with CamelCase-to-snake_case table name conversion
- Location: `src/api/base44Client.js`
- Pattern: JavaScript `Proxy` on `base44.entities` — `base44.entities.VooLigado` auto-maps to `createEntity('voo_ligado')`
- Cached: Each entity created once and reused

**Permission System:**
- Purpose: Controls page access per user profile (role)
- Location: `src/Layout.jsx` (permission logic), `src/components/lib/userUtils.jsx` (helpers)
- Pattern: `regra_permissao` table stores `{ perfil, paginas_permitidas[] }`. Layout fetches and caches these. Falls back to `PERFIL_PERMISSIONS_DEFAULT` hardcoded map.
- Profiles: `administrador`, `operacoes`, `infraestrutura`, `credenciamento`, `safety`, `gestor_empresa`
- SuperAdmin: User with no `empresa_id` + `administrador` profile — sees all companies, can impersonate via `CompanyViewContext`

**Page Registration:**
- Purpose: Declarative route-to-component mapping
- Location: `src/pages.config.js`
- Pattern: All pages lazy-loaded, exported as `PAGES` object. Route path = key name (e.g., `Operacoes` -> `/Operacoes`)
- Main page: `Home`
- Public pages (no auth): `CredenciamentoPublico`, `FormularioReclamacaoPublico`, `portalservicos`, `AlterarSenha`, `PoliticaPrivacidade`, `TermosServico`

## Entry Points

**Application Entry:**
- Location: `src/main.jsx`
- Triggers: Browser loads `index.html`
- Responsibilities: Sentry init, ServiceWorker controller change handler, chunk error handler, ReactDOM render

**App Root:**
- Location: `src/App.jsx`
- Triggers: Rendered by `main.jsx`
- Responsibilities: Provider hierarchy (I18n > Auth > CompanyView > QueryClient > Router), public vs authenticated route split, ErrorBoundary with chunk error auto-reload

**Layout:**
- Location: `src/Layout.jsx`
- Triggers: Wraps all authenticated page routes
- Responsibilities: Sidebar navigation (grouped, collapsible), permission gating (shows AccessDenied or redirects), company logo/selector for superadmin, dark mode toggle, session timeout, guided tour, AI chatbot, network indicator, system alerts

**Supabase Edge Functions:**
- Location: `supabase/functions/` (10 functions: `send-email`, `send-notification-email`, `chatbot-ia`, `data-api`, `admin-user`, `flightaware-proxy`, `fr24-proxy`, `get-dashboard-stats`, `cloudflare-metrics`)
- Triggers: Called via `supabase.functions.invoke()` from `_invokeFunction.js` (fallback when no local function)
- Responsibilities: Server-side operations requiring secrets or elevated privileges

## Error Handling

**Strategy:** Multi-layered with graceful degradation

**Patterns:**
- **ErrorBoundary** in `src/App.jsx`: Catches React render errors. Auto-reloads on chunk load failures (stale deploy) with 30s cooldown. Shows "Erro na Aplicacao" fallback UI.
- **Unhandled Promise Rejection** handler in `src/main.jsx`: Auto-reloads on chunk failures, reports to Sentry.
- **Entity layer**: Throws `Error` with Portuguese messages (`Erro ao criar ${tableName}: ${error.message}`). Callers use try/catch.
- **Auth layer**: 5s timeout safety net for `isLoadingAuth`. Profile load failures set `_profileLoadFailed` flag instead of blocking.
- **Sentry integration**: `@sentry/react` with browser tracing, session replay (10% normal / 100% on error).
- **Audit logging**: `src/lib/auditLog.js` — silent fail (never breaks the app).
- **Network indicator**: `src/components/shared/NetworkIndicator.jsx` — shows offline status.

## Cross-Cutting Concerns

**Logging:**
- `console.error` / `console.warn` for development
- Sentry for production error tracking (DSN via `VITE_SENTRY_DSN`)
- `log_auditoria` table for auth and business event audit trail (`src/lib/auditLog.js`)

**Validation:**
- File uploads: type validation via `validateFileType()`, 10MB size limit (`src/lib/sanitize.js`)
- URL redirects: `safeRedirectUrl()` prevents open redirect (`src/lib/sanitize.js`)
- Filenames: `sanitizeFilename()` strips dangerous characters (`src/lib/sanitize.js`)
- Form validation: Component-level, no centralized validation library

**Authentication:**
- Supabase Auth (email/password) configured in `src/lib/supabaseClient.js`
- `AuthContext` (`src/lib/AuthContext.jsx`) manages session, auto-creates `users` profile on first login
- Session persistence: Supabase handles via `persistSession: true`
- Session refresh: `autoRefreshToken: true` with custom `lock` function (navigator.locks workaround)
- Global 15s fetch timeout on all Supabase requests

**Internationalization:**
- `src/components/lib/i18n.jsx` — React Context with `useI18n()` hook
- Languages: Portuguese (PT) and English (EN)
- Translation keys stored inline in `i18n.jsx` (not external files)
- Persisted in `localStorage`

**Multi-Tenancy:**
- `empresa_id` column on most tables (voo, ordem_servico, inspecao, etc.)
- RLS policies enforce row-level isolation in Supabase
- `CompanyViewContext` (`src/lib/CompanyViewContext.jsx`) provides `effectiveEmpresaId`
- SuperAdmin (no `empresa_id`) can switch viewed company via selector in Layout
- `filtrarDadosPorAcesso()` in `userUtils.jsx` filters data client-side by airport access

**Caching:**
- React Query: 3-min stale, 15-min GC, offline-first network mode
- Layout permission/empresa cache: In-memory with 5-min TTL
- Entity proxy cache: Singleton per entity name
- Auth email cache: 60s TTL in `_createEntity.js`
- Static data hooks: 5-min stale time for airports, airlines, aircraft

---

*Architecture analysis: 2026-03-26*
