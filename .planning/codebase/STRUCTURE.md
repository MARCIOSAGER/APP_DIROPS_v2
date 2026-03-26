# Codebase Structure

**Analysis Date:** 2026-03-26

## Directory Layout

```
APP_DIROPS_v2/
├── src/
│   ├── api/                    # Compatibility layer (Base44 BaaS surface)
│   ├── assets/                 # Static assets (images, logos)
│   ├── components/
│   │   ├── auditoria/          # Audit process components
│   │   ├── configuracoes/      # Settings/config components (ZAPI, placeholders)
│   │   ├── credenciamento/     # Credentialing components
│   │   ├── dashboard/          # Dashboard charts and stats
│   │   ├── documentos/         # Document management components
│   │   ├── faturacao/          # Billing/invoicing components
│   │   ├── financeiro/         # Financial/tariff form components
│   │   ├── gestao/             # Company & access management components
│   │   ├── grf/                # Runway conditions (GRF) components
│   │   ├── inspecoes/          # Inspection components
│   │   ├── kpis/               # KPI dashboard and config components
│   │   ├── lib/                # Shared business logic helpers
│   │   ├── manutencao/         # Maintenance/work order components
│   │   ├── operacoes/          # Flight operations components
│   │   ├── reclamacoes/        # Complaints management components
│   │   ├── safety/             # Safety occurrence components
│   │   ├── services/           # Auth service wrapper (legacy)
│   │   ├── servicos/           # Airport services components
│   │   ├── shared/             # Cross-cutting shared components
│   │   ├── suporte/            # Support/monitoring components
│   │   └── ui/                 # Design system primitives (shadcn/ui)
│   ├── entities/               # Entity CRUD wrappers (one per table)
│   ├── functions/              # Client-side business functions
│   ├── hooks/                  # React Query hooks
│   ├── integrations/           # Integration re-exports (legacy)
│   ├── lib/                    # Core infrastructure (auth, supabase, utils)
│   ├── pages/                  # Top-level page components (lazy-loaded)
│   ├── test/                   # Test setup files
│   └── utils/                  # URL utilities
├── supabase/
│   ├── functions/              # Supabase Edge Functions (server-side)
│   ├── migrations/             # SQL migration files (001-056)
│   └── schema.sql              # Full database schema
├── public/                     # Static files (PWA icons, logos)
├── .planning/                  # Planning documentation
├── vite.config.js              # Vite + PWA + test config
├── tailwind.config.js          # Tailwind CSS config
├── package.json                # Dependencies and scripts
└── components.json             # shadcn/ui component config
```

## Directory Purposes

**`src/api/`:**
- Purpose: Compatibility layer preserving Base44 BaaS API surface after migration to Supabase
- Contains: `base44Client.js` (main proxy), `entities.js` (re-export), `integrations.js` (re-export)
- Key files: `base44Client.js` — Proxy-based entity auto-creation, auth methods, file upload, function invocation

**`src/entities/`:**
- Purpose: One CRUD wrapper per Supabase table, created via factory pattern
- Contains: 63 entity files + `_createEntity.js` factory
- Key files: `_createEntity.js` — defines `list`, `filter`, `get`, `create`, `update`, `delete`, `paginate`, `count`, `findOne`
- Pattern: Each file is 3 lines: `import { createEntity } from './_createEntity'; export const Voo = createEntity('voo');`

**`src/functions/`:**
- Purpose: Client-side business logic functions (auto-discovered by `_invokeFunction.js`)
- Contains: 45+ function files for PDF generation, email, FlightAware, notifications, AI, WhatsApp
- Key files: `_invokeFunction.js` — uses `import.meta.glob('./*.js')` to register all sibling files, falls back to Supabase Edge Functions

**`src/hooks/`:**
- Purpose: React Query hooks for common data fetching
- Contains: `useVoos.js`, `useVoosLigados.js`, `useCalculosTarifa.js`, `useDashboardStats.js`, `useSubmitGuard.js`, `use-mobile.jsx`

**`src/lib/`:**
- Purpose: Core infrastructure — Supabase client, auth context, query client, audit logging, sanitization
- Contains: `supabaseClient.js`, `AuthContext.jsx`, `CompanyViewContext.jsx`, `query-client.js`, `auditLog.js`, `sanitize.js`, `errorUtils.js`, `emailTemplates.js`, `pdfTemplate.js`, `webVitals.js`, `NavigationTracker.jsx`, `PageNotFound.jsx`

**`src/components/lib/`:**
- Purpose: Shared business logic helpers (not UI components)
- Contains: `userUtils.jsx` (permission/access helpers), `i18n.jsx` (translations), `tariffCalculations.jsx`, `tariffCalculators.jsx`, `tariffCache.jsx`, `useStaticData.jsx` (cached reference data hooks), `aeroportosAngola.jsx`, `notificacoes.jsx`, `export.jsx`, `utils.jsx`, `auditoria.jsx`

**`src/components/ui/`:**
- Purpose: shadcn/ui design system primitives (52 components)
- Contains: `button.jsx`, `card.jsx`, `dialog.jsx`, `select.jsx`, `table.jsx`, `tabs.jsx`, `calendar.jsx`, `combobox.jsx`, `input.jsx`, `label.jsx`, `badge.jsx`, `alert.jsx`, `skeleton.jsx`, `toast.jsx`, `toaster.jsx`, `tooltip.jsx`, `dropdown-menu.jsx`, `popover.jsx`, `sheet.jsx`, `separator.jsx`, `scroll-area.jsx`, `progress.jsx`, `switch.jsx`, `textarea.jsx`, `checkbox.jsx`, `radio-group.jsx`, `slider.jsx`, `accordion.jsx`, `collapsible.jsx`, `command.jsx`, `navigation-menu.jsx`, `pagination.jsx`, `breadcrumb.jsx`, `hover-card.jsx`, `context-menu.jsx`, `menubar.jsx`, `drawer.jsx`, `carousel.jsx`, `chart.jsx`, `form.jsx`, `async-combobox.jsx`, `aeroporto-multi-select.jsx`, `input-otp.jsx`, `aspect-ratio.jsx`, `avatar.jsx`, `alert-dialog.jsx`

**`src/components/shared/`:**
- Purpose: Cross-cutting UI components used by multiple pages
- Contains: Modals (`ConfirmModal`, `AlertModal`, `SuccessModal`, `SendEmailModal`, `CancelarProformaModal`, `DeleteAccountModal`, `DuplicateConflictsModal`, `UploadCsvModal`), system UI (`NetworkIndicator`, `GlobalLoadingModal`, `AppUpdateBanner`, `CookieConsent`, `SessionTimeoutModal`, `SystemAlerts`, `AccessDenied`), interactive (`ChatbotIA`, `TourGuiado`, `PullToRefreshWrapper`, `AssistenteRelatorio`, `SortableTableHeader`, `ResponsavelSelector`, `BottomTabs`)

**`src/components/{domain}/`:**
- Purpose: Feature-specific components organized by business domain
- Pattern: Each domain directory contains Forms, Lists, Modals, Stats, Detail views
- Domains: `operacoes` (20 files), `faturacao` (6), `financeiro` (10), `dashboard` (6), `gestao` (11), `credenciamento` (7), `documentos` (11), `safety` (2), `inspecoes` (5), `manutencao` (11), `auditoria` (7), `reclamacoes` (6), `kpis` (5), `grf` (1), `servicos` (2), `suporte` (1), `configuracoes` (9)

**`src/pages/`:**
- Purpose: Top-level route components, one per page
- Contains: 45 page files (`.jsx`), all lazy-loaded via `src/pages.config.js`
- Pattern: PascalCase filenames matching route paths (e.g., `Operacoes.jsx` -> `/Operacoes`)

**`supabase/functions/`:**
- Purpose: Supabase Edge Functions (Deno runtime, server-side)
- Contains: `send-email`, `send-notification-email`, `chatbot-ia`, `data-api`, `admin-user`, `flightaware-proxy`, `fr24-proxy`, `get-dashboard-stats`, `cloudflare-metrics`

**`supabase/migrations/`:**
- Purpose: Incremental SQL migration files
- Contains: 56 migrations (`001_*` through `056_*`) + `RUN_ALL_PENDING.sql`
- Pattern: `NNN_description.sql` (zero-padded 3-digit prefix)

## Key File Locations

**Entry Points:**
- `src/main.jsx`: Application bootstrap (Sentry, ReactDOM, SW handler)
- `src/App.jsx`: Provider hierarchy, routing, ErrorBoundary
- `src/Layout.jsx`: Authenticated shell (sidebar, permissions, company selector)
- `src/pages.config.js`: Route-to-component registry (all lazy imports)

**Configuration:**
- `vite.config.js`: Vite build, path alias (`@` -> `src/`), PWA manifest, manual chunks, test config
- `tailwind.config.js`: Tailwind CSS configuration
- `components.json`: shadcn/ui component configuration
- `package.json`: Dependencies, scripts

**Core Infrastructure:**
- `src/lib/supabaseClient.js`: Supabase client singleton (15s timeout, lock workaround)
- `src/lib/AuthContext.jsx`: Auth state provider (session, profile auto-creation, error handling)
- `src/lib/CompanyViewContext.jsx`: Multi-tenant company switching for superadmin
- `src/lib/query-client.js`: TanStack React Query client (3-min stale, offline-first)

**Data Layer:**
- `src/entities/_createEntity.js`: Entity factory (CRUD + pagination + filtering)
- `src/api/base44Client.js`: Compatibility proxy (auto CamelCase->snake_case, auth, integrations)
- `src/functions/_invokeFunction.js`: Function dispatcher (local-first, Edge Function fallback)

**Business Logic:**
- `src/components/lib/userUtils.jsx`: Permission checks, superadmin detection, data access filtering
- `src/components/lib/i18n.jsx`: Internationalization (PT/EN translations)
- `src/components/lib/tariffCalculations.jsx`: Tariff calculation engine
- `src/components/lib/tariffCalculators.jsx`: Individual tariff type calculators
- `src/components/lib/tariffCache.jsx`: Tariff data caching
- `src/lib/auditLog.js`: Audit trail logging to `log_auditoria` table
- `src/lib/sanitize.js`: Input sanitization (URLs, filenames, file type validation)
- `src/lib/emailTemplates.js`: Centralized HTML email templates
- `src/lib/pdfTemplate.js`: PDF generation templates

**Testing:**
- `src/test/setup.js`: Test setup (Vitest)
- `src/entities/__tests__/`: Entity layer tests
- `src/functions/__tests__/`: Function layer tests
- `src/lib/__tests__/`: Lib layer tests
- `src/components/lib/__tests__/`: Component lib tests

## Naming Conventions

**Files:**
- Pages: `PascalCase.jsx` (e.g., `Operacoes.jsx`, `GestaoEmpresas.jsx`, `KPIsOperacionais.jsx`)
- Entities: `PascalCase.js` (e.g., `Voo.js`, `CalculoTarifa.js`, `OcorrenciaSafety.js`)
- Components: `PascalCase.jsx` (e.g., `FormVoo.jsx`, `TariffDetailsModal.jsx`)
- UI primitives: `kebab-case.jsx` (e.g., `button.jsx`, `dropdown-menu.jsx`, `async-combobox.jsx`)
- Hooks: `camelCase.js` or `camelCase.jsx` (e.g., `useVoos.js`, `useStaticData.jsx`)
- Functions: `camelCase.js` (e.g., `sendEmailDirect.js`, `chatbotIA.js`, `syncFlightAwareToCache.js`)
- Lib files: `camelCase.js`/`.jsx` (e.g., `supabaseClient.js`, `auditLog.js`)
- Factory/internal: `_prefixed.js` (e.g., `_createEntity.js`, `_invokeFunction.js`)
- Migrations: `NNN_snake_case.sql` (e.g., `055_composite_indexes.sql`)

**Directories:**
- Domain components: `camelCase` matching business domain (e.g., `operacoes`, `faturacao`, `gestao`)
- Special dirs: `ui`, `shared`, `lib`, `services`

**Exports:**
- Entities: Named export matching PascalCase class name (e.g., `export const Voo = createEntity('voo')`)
- Pages: Default export (e.g., `export default function DashboardInterno()`)
- Components: Named or default export in PascalCase
- Hooks: Named export with `use` prefix (e.g., `export function useVoos()`)

## Import Path Aliases

**Configured in `vite.config.js`:**
- `@/` maps to `src/` (e.g., `import { Voo } from '@/entities/Voo'`)

**Common import patterns:**
```javascript
// Entities
import { Voo } from '@/entities/Voo';
import { Aeroporto } from '@/entities/Aeroporto';

// UI primitives
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';

// Contexts and hooks
import { useAuth } from '@/lib/AuthContext';
import { useCompanyView } from '@/lib/CompanyViewContext';
import { useI18n } from '@/components/lib/i18n';

// Business helpers
import { isSuperAdmin, hasUserProfile, filtrarDadosPorAcesso } from '@/components/lib/userUtils';
import { createPageUrl } from '@/utils';

// Icons (lucide-react)
import { Plane, DollarSign, Shield, FileText } from 'lucide-react';

// Supabase (direct usage)
import { supabase } from '@/lib/supabaseClient';

// Integrations (legacy path)
import { UploadFile, SendEmail } from '@/api/integrations';
```

## Where to Add New Code

**New Page:**
1. Create `src/pages/NewPage.jsx` (PascalCase, default export)
2. Add lazy import + entry in `src/pages.config.js` (`PAGES` object)
3. Add page key to relevant profile in `regra_permissao` table (or hardcoded fallback in `Layout.jsx` `PERFIL_PERMISSIONS_DEFAULT`)
4. Add navigation entry in `Layout.jsx` `getNavigationGroups()` function
5. If public (no auth required), add to `PublicPages` array in `App.jsx`

**New Entity:**
1. Create `src/entities/NewEntity.js`:
   ```javascript
   import { createEntity } from './_createEntity';
   export const NewEntity = createEntity('new_entity');
   ```
2. Ensure the `new_entity` table exists in Supabase (add migration in `supabase/migrations/`)

**New Domain Component:**
1. Create in appropriate `src/components/{domain}/` directory
2. Use PascalCase naming: `FormNewThing.jsx`, `NewThingList.jsx`, `NewThingDetailModal.jsx`
3. Import from the page that uses it

**New Shared Component:**
- Add to `src/components/shared/` with PascalCase naming

**New UI Primitive:**
- Add to `src/components/ui/` with kebab-case naming (follow shadcn/ui conventions)

**New Hook:**
- Add to `src/hooks/` with `use` prefix (e.g., `useNewData.js`)
- For reference data hooks, add to `src/components/lib/useStaticData.jsx`

**New Client-Side Function:**
1. Create `src/functions/newFunction.js` with `export default async function newFunction(params) { ... }`
2. Auto-discovered by `_invokeFunction.js` via `import.meta.glob`
3. Callable via `invokeFunction('newFunction', params)` or `base44.functions.invoke('newFunction', params)`

**New Edge Function:**
1. Create directory `supabase/functions/new-function/index.ts`
2. Deploy via `supabase functions deploy new-function`
3. Falls back automatically from `_invokeFunction.js` when no local function matches

**New Migration:**
1. Create `supabase/migrations/NNN_description.sql` (next available number)
2. Apply via Supabase CLI or direct SQL execution

**New Business Logic Helper:**
- Add to `src/components/lib/` if used by multiple components
- Add to `src/lib/` if infrastructure-level (auth, supabase, sanitization)

## Special Directories

**`src/test/`:**
- Purpose: Test setup and configuration
- Generated: No
- Committed: Yes

**`supabase/.temp/`:**
- Purpose: Supabase CLI temporary files
- Generated: Yes
- Committed: Partially (`.temp/cli-latest` tracked)

**`public/`:**
- Purpose: Static assets served directly (PWA icons, favicon, logos)
- Generated: No
- Committed: Yes

**`dist/`:**
- Purpose: Vite build output
- Generated: Yes
- Committed: No (in `.gitignore`)

**`node_modules/`:**
- Purpose: npm dependencies
- Generated: Yes
- Committed: No (in `.gitignore`)

---

*Structure analysis: 2026-03-26*
