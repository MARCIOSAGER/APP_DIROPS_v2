# Architecture Patterns — Performance Optimization

**Domain:** React 18 + Vite 6 + Supabase — performance milestone integration
**Researched:** 2026-03-25
**Confidence:** HIGH — based on direct codebase analysis

---

## Existing Architecture Snapshot

Before prescribing patterns, this is what the codebase *actually does today*.

### Data Access Layer

```
supabase (supabaseClient.js)
    └── createEntity(tableName) → _createEntity.js
            ├── list(orderBy, limit)           — fetchAll() with 500-row pagination
            ├── filter(filters, orderBy)        — fetchAll() after applying operators
            ├── get(id)                         — single row by PK
            ├── create(record)                  — insert + audit fields
            ├── update(id, changes)             — update + audit fields
            ├── delete(id)                      — hard delete
            ├── paginate({ filters, page })     — server-side page + count (EXISTS)
            ├── count(filters)                  — head-only count (EXISTS)
            └── findOne(filters)               — limit 1 (EXISTS)

base44Client.js (Proxy over entityCache)
    └── base44.entities.Voo.filter(...)        — CamelCase → snake_case mapping
                                               — entityCache prevents duplicate createEntity() calls
```

Key observation: `_createEntity.js` already has `paginate()` and `count()` methods. They are unused by pages.

### Query Client (Already Installed)

`@tanstack/react-query` v5.84.1 is in `package.json` and `QueryClientProvider` wraps the entire app in `App.jsx`. The `queryClientInstance` is configured with `staleTime: 2 min`, `gcTime: 10 min`, `refetchOnWindowFocus: false`.

However, TanStack Query is used in **exactly one file**: `useStaticData.jsx`. Every other page uses manual `useState/useEffect/useCallback` patterns.

### Static Data Caching (Partial — Already Done)

`useStaticData.jsx` wraps 7 entity calls in `useQuery`:
- `useAeroportos`, `useCompanhias`, `useAeronaves`, `useModelosAeronave`
- `useTarifasPouso`, `useTarifasPermanencia`, `useOutrasTarifas`

These hooks are consumed in `Operacoes.jsx` (lines 222–225). This is the right pattern. It needs to be expanded, not replaced.

### Current Pain Points (Evidence-Based)

**Operacoes.jsx — 8 parallel fetches on every mount**
```
Promise.allSettled([
  Voo.filter(vooFilters, '-data_operacao', 1000),   // up to 2x500-row batches
  VooLigado.filter(vlFilters, '-created_date'),       // unbounded fetchAll
  fetchCalculoMap(empId),                             // custom paginated loop
  TarifaPouso.filter(...)                             // already in useStaticData — duplicate!
  TarifaPermanencia.filter(...)                       // already in useStaticData — duplicate!
  OutraTarifa.filter(...)                             // already in useStaticData — duplicate!
  Imposto.list()
  ConfiguracaoSistema.list()
])
```
Tarifas are fetched twice: once via useStaticData cache and once inside `loadData()`. The component state wins, which defeats caching.

**Home.jsx (Dashboard) — Sequential and parallel fetches on every mount**
```
// Parallel:
Promise.allSettled([
  Voo.list('-data_operacao', 500),
  OcorrenciaSafety.list('-data_ocorrencia', 50),
  Inspecao.list('-data_inspecao', 50),
  CalculoTarifa.list('-data_calculo', 1000),
  OrdemServico.list('-created_date', 10),
])
// Then separately:
getDashboardStats(...)         // Edge Function invocation
getDashboardStats(...)         // Second call for previous period
supabase.rpc('get_dashboard_stats', ...)   // RPC — same data third time!
```
Dashboard stats are fetched 3 times (2x Edge Function + 1x RPC). All three run every time `selectedAeroporto` or `selectedPeriodo` changes.

**User.me() called in 23 page components**
Every page that calls `User.me()` makes 2 Supabase requests (getUser + users table). AuthContext already has the profile loaded on app start. Pages are re-fetching data they already have.

**select('*') in all entity calls**
`list()` and `filter()` always use `select('*')`. Tables like `voo` have 30+ columns. Pages like Home.jsx use 5–8 fields per record.

**No cache invalidation after mutations**
After `Voo.create()` or `Voo.update()`, pages call their own `loadData()` or `refreshSpecificData()`. There is no shared cache to invalidate, so other pages show stale data until they remount.

---

## Recommended Architecture

### Principle: Expand the TanStack Query Layer, Don't Rewrite

The infrastructure is already in place. `QueryClientProvider` wraps the app. `useStaticData.jsx` proves the pattern works. The build order should expand this layer progressively.

### Component Boundaries (Proposed)

| Layer | Component | Responsibility | Changes Needed |
|-------|-----------|----------------|----------------|
| Auth | `AuthContext.jsx` | Session + profile | Add `currentUser` to context (stop pages calling `User.me()`) |
| Static cache | `useStaticData.jsx` | Rarely-changing reference data | Expand to include Imposto, ConfiguracaoSistema |
| Page queries | New `usePageData` hooks | Per-page dynamic data via useQuery | New files, no changes to `_createEntity.js` |
| Entity adapter | `_createEntity.js` | Supabase CRUD, pagination | Add optional `select` param to `list()` and `filter()` |
| Mutations | New `useMutation` hooks | Write ops + cache invalidation | New pattern alongside existing code |

### Data Flow (Proposed)

```
App (QueryClientProvider)
  ├── AuthContext — loads user once, exposes via useAuth()
  │       └── Pages call useAuth().user instead of User.me()
  │
  ├── useStaticData hooks (TanStack Query, staleTime: 5 min)
  │       ├── useAeroportos / useCompanhias / useAeronaves
  │       ├── useModelosAeronave / useTarifasPouso / ...
  │       └── NEW: useImpostos / useConfiguracaoSistema
  │
  ├── Page-level query hooks (TanStack Query, staleTime: varies)
  │       ├── useVoos({ empresaId, filters })         — queryKey: ['voos', empresaId, filters]
  │       ├── useVoosLigados({ empresaId })            — queryKey: ['voos-ligados', empresaId]
  │       ├── useCalculosTarifa({ empresaId })         — queryKey: ['calculos', empresaId]
  │       └── useDashboardStats({ periodo, aeroporto }) — queryKey: ['dashboard', periodo, aeroporto]
  │
  └── Mutation hooks (invalidate queryKey after success)
          ├── useCreateVoo()     → invalidates ['voos', ...]
          └── useUpdateVoo()     → invalidates ['voos', ...] and ['calculos', ...]
```

### Integration Points with `_createEntity.js`

The factory does NOT need to be rewritten. It remains the single Supabase call interface. TanStack Query wraps it at the hook layer above.

**Change 1: Add `select` parameter to `list()` and `filter()`**

Current signature: `list(orderBy, limit)` → always `select('*')`

Proposed: `list(orderBy, limit, select = '*')` and `filter(filters, orderBy, limit, skip, select = '*')`

This is backward-compatible. No existing callers break. Pages that need specific columns can opt in.

```javascript
// _createEntity.js — minimal addition
async list(orderBy, limit, select = '*') {
  let query = supabase.from(tableName).select(select);
  // ... rest unchanged
}

async filter(filters, orderBy, limit, skip, select = '*') {
  let query = supabase.from(tableName).select(select);
  // ... rest unchanged
}
```

**Change 2: No changes to `base44Client.js`**

The Proxy layer maps method calls through `entityCache`. Since `_createEntity.js` changes are backward-compatible and the Proxy just forwards calls, no changes to `base44Client.js` are needed.

### Patterns to Follow

#### Pattern 1: Page-Level Query Hook (New File Per Domain)

Create `src/hooks/` directory. One hook file per data domain.

```javascript
// src/hooks/useVoos.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Voo } from '@/entities/Voo';

export function useVoos({ empresaId, filters = {}, enabled = true }) {
  return useQuery({
    queryKey: ['voos', empresaId, filters],
    queryFn: () => {
      const f = { deleted_at: { $is: null }, ...filters };
      if (empresaId) f.empresa_id = empresaId;
      return Voo.filter(f, '-data_operacao', 1000);
    },
    staleTime: 1000 * 60 * 2,  // 2 min — flight data changes frequently
    enabled: !!empresaId && enabled,
  });
}

export function useCreateVoo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (record) => Voo.create(record),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['voos'] });
    },
  });
}
```

#### Pattern 2: Stop Calling `User.me()` in Pages

`AuthContext.jsx` already loads the profile. Pages should use it directly.

```javascript
// Current pattern in 23 pages — creates 2 Supabase requests per page load:
const user = await User.me();
setCurrentUser(user);

// Proposed — zero requests, data already in context:
const { user } = useAuth();
```

This requires `AuthContext.jsx` to expose `user` as the full profile object (it already does — `user` in context includes `empresa_id`, `perfis`, `aeroportos_acesso`).

#### Pattern 3: Selective Column Fetching

For pages that only display summary information:

```javascript
// Home.jsx dashboard — fetches 30+ columns per flight, uses 6
Voo.list('-data_operacao', 500)

// After change:
Voo.list('-data_operacao', 500, 'id,data_operacao,tipo_movimento,empresa_id,aeroporto_operacao,status,callsign')
```

This reduces payload size and PostgREST response time.

#### Pattern 4: Cache Invalidation After Mutations

Today: each page calls its own `loadData()` after mutations.
Proposed: mutations call `queryClient.invalidateQueries()`.

Pages that use `useQuery` will automatically refetch. Pages that still use `loadData()` are unaffected (no regression). This enables a gradual migration.

#### Pattern 5: Dashboard Stats — Consolidate to Single RPC

`Home.jsx` makes 3 calls for the same data. The `get_dashboard_stats` RPC already exists (migration 041). The edge function `get-dashboard-stats` duplicates it.

Consolidate to the RPC only, wrapped in a `useDashboardStats` hook with `staleTime: 5 min`.

```javascript
// src/hooks/useDashboardStats.js
export function useDashboardStats({ empresaId, aeroporto, periodo }) {
  return useQuery({
    queryKey: ['dashboard', empresaId, aeroporto, periodo],
    queryFn: () => supabase.rpc('get_dashboard_stats', {
      p_empresa_id: empresaId || null,
      p_dias: parseInt(periodo) || 30,
      p_aeroporto: aeroporto === 'todos' ? null : aeroporto,
    }).then(res => res.data),
    staleTime: 1000 * 60 * 5,
  });
}
```

#### Pattern 6: Supabase Database Indexes

Queries that need indexes (identified from page data fetching patterns):

| Table | Column(s) | Query Pattern | Priority |
|-------|-----------|---------------|----------|
| voo | empresa_id, deleted_at | Operacoes filter | HIGH |
| voo | data_operacao DESC | Order by | HIGH |
| voo_ligado | empresa_id | VoosLigados filter | HIGH |
| calculo_tarifa | empresa_id | fetchCalculoMap | HIGH |
| calculo_tarifa | voo_id | JOIN/filter | HIGH |
| ocorrencia_safety | aeroporto | Home filter | MEDIUM |
| inspecao | aeroporto_id | Home filter | MEDIUM |
| users | auth_id | Profile lookup (every auth) | ALREADY EXISTS (likely) |

Check existing indexes before creating. Use `CREATE INDEX CONCURRENTLY` on production tables to avoid locking.

### Route-Level Code Splitting (Already Done)

`pages.config.js` already uses `React.lazy()` for all 47 pages. `Suspense` is in `App.jsx`. This is complete. No further work needed here.

**One gap:** `Operacoes.jsx` imports ~15 child components statically at the top. These are all part of the same chunk. The page chunk will be large. Sub-components like `TariffDetailsModal`, `GerarFaturaModal`, and `LixeiraVoosModal` are modal-only and could be lazy-loaded.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Rewriting `_createEntity.js` as a "Query Factory"

**What it looks like:** Wrapping `useQuery` inside `createEntity()` so that `Voo.useList()` returns a React hook.

**Why bad:** `_createEntity.js` is used both in React components and in server-side functions (`functions/`). Hooks inside a factory would break non-React contexts. The base44 compatibility layer also calls entity methods synchronously. This would require changes in dozens of files.

**Instead:** Keep the entity as pure async functions. Wrap at the hook layer (`src/hooks/`). React Query and the entity adapter remain cleanly separated.

### Anti-Pattern 2: Global Supabase Realtime Subscriptions

**What it looks like:** Adding `supabase.channel().on('postgres_changes')` subscriptions in AuthContext or a top-level provider to push updates to all pages.

**Why bad:** Supabase Realtime on shared hosting (Hostinger static deploy, Supabase Sao Paulo) adds persistent WebSocket connections. Each authenticated user holds a connection. For an ops system with moderate concurrent users this adds latency and connection management complexity. There is no current realtime feature requirement.

**Instead:** Use TanStack Query's `refetchInterval` on specific pages that need fresh data (e.g., FIDS/FlightAware panel) rather than global subscriptions.

### Anti-Pattern 3: Cache Keys Without `empresaId`

**What it looks like:** `queryKey: ['voos']` — same key for all tenants.

**Why bad:** Multi-tenant system. If a superadmin switches company via `CompanyViewContext`, the cache must reflect the correct company's data. Without `empresaId` in the key, company A's data persists in cache when viewing company B.

**Instead:** Always include `empresaId` in query keys for tenant-scoped data: `['voos', empresaId, filters]`.

### Anti-Pattern 4: Removing `loadData()` from Pages Before Cache Layer is Stable

**What it looks like:** Phase 1 replaces all `loadData()` with `useQuery()` across all 23 pages simultaneously.

**Why bad:** Too risky. Each page has custom error handling, retry logic (Operacoes has 3-attempt retry), and mutation side effects baked into `loadData()`. A simultaneous migration risks regressions across all pages.

**Instead:** Migrate one page at a time. Keep `loadData()` as fallback until `useQuery` version is verified in production.

### Anti-Pattern 5: Over-eager `staleTime: Infinity` for "Static" Data

**What it looks like:** Setting `staleTime: Infinity` for aeroportos, companhias, because they "rarely change."

**Why bad:** Admin users *do* change them. After creating a new airline in `CompanhiasConfig`, the Operacoes form dropdown won't show it until the browser tab is closed and reopened.

**Instead:** Use `staleTime: 5 min` (already set in `useStaticData.jsx`) and call `queryClient.invalidateQueries({ queryKey: ['companhias'] })` after mutations in config modals. This is already the right staleTime — don't change it.

---

## Scalability Considerations

| Concern | Now (prod, ~50 users) | Future (200+ users) |
|---------|----------------------|---------------------|
| `voo` table size | <10K rows | 50K+ rows — need date-range indexes |
| All-rows `fetchAll` | Acceptable | Will timeout — paginate() required |
| Dashboard RPC | Sufficient | Add materialized view if query > 500ms |
| QueryClient cache | In-memory, per-tab | No sharing between tabs — acceptable |
| Supabase connections | Low concern | Connection pooler (pgBouncer) already on Supabase hosted |

---

## Build Order (Recommended)

The order is driven by two constraints: (1) risk — change data access for the most-used page last, (2) leverage — improvements to shared infrastructure benefit all pages at once.

### Phase 1: Foundation Fixes (Low Risk, High Leverage)

**1a. Stop `User.me()` in pages — use `useAuth()`**
- Affects: all 23 pages that call `User.me()`
- Change: replace `const user = await User.me()` with `const { user } = useAuth()`
- No change to entities, no change to base44Client
- Risk: LOW — AuthContext already has the data

**1b. Add `select` parameter to `_createEntity.js` `list()` and `filter()`**
- Change: add `select = '*'` default parameter — fully backward compatible
- Affects: only callers that pass the new param (initially none)
- Risk: NONE — default maintains current behavior

**1c. Expand `useStaticData.jsx` with missing entities**
- Add `useImpostos()` and `useConfiguracaoSistema()`
- Operacoes currently fetches both inside `loadData()` → use cached version
- Risk: LOW — same pattern as existing hooks

### Phase 2: Dashboard Consolidation (Medium Effort, High Impact)

**2a. Create `useDashboardStats` hook**
- Consolidates 3 calls (2x Edge Function + 1x RPC) into 1 RPC call with `staleTime: 5 min`
- Target: `Home.jsx` — eliminates redundant network calls on period/aeroporto changes
- Change type: page modification, new hook file
- Risk: MEDIUM — dashboard is visible to all users, test both roles

**2b. Create `useVoos` hook and migrate Home.jsx**
- Home.jsx fetches `Voo.list('-data_operacao', 500)` and applies client-side filter
- Replace with `useQuery` + field selection (only columns needed for KPI cards)
- Risk: MEDIUM — test KPI calculations still produce same results

### Phase 3: Operacoes Query Migration (High Effort, High Impact)

**3a. Fix tarifas duplicate fetch**
- `loadData()` in Operacoes fetches tarifas even though `useStaticData` hooks already fetch them
- Remove tarifas from `loadData()`, read from `useAeroportos()`, `useCompanhias()` etc.
- Risk: LOW — data is already in cache, just route it correctly

**3b. Create `useVoosOperacoes` and `useVoosLigados` hooks**
- Wrap Operacoes-specific voos/voosLigados fetches in `useQuery`
- `queryKey: ['voos', empresaId, 'operacoes']` and `['voos-ligados', empresaId]`
- Risk: MEDIUM — Operacoes has complex retry logic (3 attempts), preserve in queryFn

**3c. Add cache invalidation to mutation handlers**
- After `Voo.create()`, `Voo.update()`, `VooLigado` mutations: call `queryClient.invalidateQueries`
- Risk: LOW — additive change, existing state updates continue to work

### Phase 4: Database Index Audit

**4a. Audit existing indexes**
- Run `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'voo'` etc.
- Determine what's missing

**4b. Add composite indexes for most-queried patterns**
- `(empresa_id, deleted_at, data_operacao DESC)` on `voo` — covers Operacoes primary query
- `(empresa_id)` on `voo_ligado`, `calculo_tarifa` — covers fetch loops
- Use `CREATE INDEX CONCURRENTLY` — non-blocking on production

### Phase 5: Heavy Component Lazy Loading

**Target components in Operacoes.jsx for lazy import:**
- `TariffDetailsModal` — only shown when user clicks a tariff breakdown
- `GerarFaturaModal` — only shown when generating invoice
- `LixeiraVoosModal` — admin only, infrequent use
- `UploadMultiplosDocumentosModal` — infrequent

```javascript
// Convert static imports to lazy:
const TariffDetailsModal = lazy(() => import('../components/operacoes/TariffDetailsModal'));
```

These are modals that mount/unmount. Lazy loading them saves Operacoes initial parse time.

---

## What Stays Unchanged

| Component | Why Unchanged |
|-----------|---------------|
| `_createEntity.js` core methods | Only adding optional `select` param |
| `base44Client.js` Proxy | No changes needed — backward compatible |
| `AuthContext.jsx` | Already correct — just expose `user` to pages |
| `supabaseClient.js` | No changes |
| `pages.config.js` | Route-level lazy loading already complete |
| `query-client.js` | Settings are appropriate |
| `useStaticData.jsx` | Expand, don't replace |
| Mutation handlers in pages | Keep existing code, add invalidation alongside |

---

## Sources

- Direct analysis of `src/entities/_createEntity.js`, `src/api/base44Client.js`, `src/lib/AuthContext.jsx`, `src/App.jsx`, `src/pages/Operacoes.jsx`, `src/pages/Home.jsx`, `src/components/lib/useStaticData.jsx`, `src/lib/query-client.js`, `src/pages.config.js`, `vite.config.js`
- TanStack Query v5 docs: https://tanstack.com/query/v5/docs/framework/react/guides/query-keys
- Supabase PostgREST column selection: https://supabase.com/docs/guides/api/using-filters#select-specific-columns
- Confidence: HIGH — all findings from direct source code inspection, no assumptions
