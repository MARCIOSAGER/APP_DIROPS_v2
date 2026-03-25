# Performance Optimization Pitfalls

**Domain:** Multi-tenant airport management system — adding caching and query optimization to existing production app
**Researched:** 2026-03-25
**Confidence:** HIGH (derived from direct codebase analysis + official documentation)

---

## Critical Pitfalls

These mistakes cause data leakage, broken multi-tenant isolation, or user-visible correctness bugs.

---

### Pitfall 1: TanStack Query Cache Keys Without Tenant Context

**What goes wrong:**
The existing `useStaticData.jsx` hooks use flat keys like `['aeroportos']`, `['companhias']`, `['aeronaves']`. If a superadmin switches company via `effectiveEmpresaId` (CompanyViewContext), or if one user logs out and another logs in, TanStack Query serves stale cached data from the previous tenant/user context.

**Why it happens:**
TanStack Query caches by key equality. `['aeroportos']` is always `['aeroportos']` regardless of who is logged in or which company is selected. The in-memory QueryClient instance persists for the app's lifetime.

**Specific risk in this codebase:**
- `useAeroportos()` key is `['aeroportos']` — fetches `Aeroporto.list()` with no empresa_id filter
- `useCompanhias()`, `useAeronaves()`, `useModelosAeronave()` — all flat keys, no tenant context
- Superadmin switches from "View as Empresa A" to "View as Empresa B": old aeroportos cached data still serves for 5 minutes (STATIC_CACHE_TIME)
- Operacoes.jsx line 397 uses `aeroportosCache` for `getAeroportosPermitidos` — wrong aeroportos = wrong flight data shown

**Consequences:**
- Superadmin sees Empresa A's airports when viewing Empresa B (silent wrong data, not an error)
- Client-side filtering downstream (`getAeroportosPermitidos`, `filtrarDadosPorAcesso`) becomes incorrect because the base data is wrong
- No error thrown, no visible warning — data is just wrong

**Prevention:**
Include `effectiveEmpresaId` in the query key for all hooks that load tenant-scoped data:
```js
// Before (broken for multi-tenant)
queryKey: ['aeroportos']

// After (correct)
queryKey: ['aeroportos', effectiveEmpresaId]
```
Also invalidate all queries on logout via `queryClient.clear()` in the SIGNED_OUT handler in AuthContext.

**Detection:**
Superadmin switches company view and sees airports from the previous company for up to 5 minutes.

---

### Pitfall 2: Cache Not Cleared on User Logout / Session Change

**What goes wrong:**
When a user logs out, TanStack Query's in-memory cache is not cleared. If another user logs in from the same browser tab (or after session expiry and re-login), they receive stale data from the previous user's session until the gcTime (10 minutes) expires.

**Why it happens:**
TanStack Query's QueryClient instance lives in memory for the app's lifetime. The AuthContext `SIGNED_OUT` event handler currently calls `supabase.auth.signOut()` and redirects to `/login` — it does not call `queryClient.clear()`.

**Specific risk in this codebase:**
- `queryClientInstance` is a singleton in `src/lib/query-client.js` with a 10-minute `gcTime`
- After logout + re-login (different user), cached aeroportos, companhias, aeronaves still in memory
- Particularly dangerous in shared-terminal environments (airport ops desks)

**Consequences:**
Cross-user data leakage in shared sessions. Not a Supabase RLS bypass (server still enforces), but client-side filtering will operate on wrong data, and flash of wrong data is visible before refetch.

**Prevention:**
In `AuthContext.jsx`, call `queryClient.clear()` inside the `SIGNED_OUT` handler and inside the `logout()` function before redirect:
```js
// In logout()
queryClientInstance.clear();
await supabase.auth.signOut();
```

**Detection:**
Log in as User A (Empresa ATO), log out, log in as User B (Empresa SGA). For up to 10 seconds, User B sees ATO's airports.

---

### Pitfall 3: fetchAll Loop Fetching All Rows Client-Side on Cached Queries

**What goes wrong:**
`_createEntity.js` `fetchAll()` loops through 500-row pages until exhausted. If this is called inside a TanStack Query `queryFn`, the entire dataset is loaded into the cache on every stale/refetch. For large tables (voo, calculo_tarifa, log_auditoria), this is expensive — multiple round trips, then the full dataset sits in memory.

**Why it happens:**
The pattern originates from the Base44 migration where the app needed all data client-side for filtering. Combined with TanStack Query's automatic background refetching, this creates frequent bulk fetches.

**Specific risk in this codebase:**
- `Home.jsx` line 104-108: `Voo.list('-data_operacao', 500)` + `CalculoTarifa.list('-data_calculo', 1000)` called on every `loadData()` re-run
- `loadData` is triggered by `effectiveEmpresaId` changes (useEffect dependency at line 151)
- Superadmin switching company view triggers a full re-fetch of 500 flights + 1000 tariff calculations
- If these are ever wrapped in TanStack Query with background refetch enabled, they refetch on window focus too

**Consequences:**
Slow page loads. Supabase free/small tier connection pool exhaustion if multiple tabs open. High data transfer costs on large datasets.

**Prevention:**
- Apply date-range filters before fetching: never load all-time data for dashboard display
- Use server-side `.paginate()` (already implemented in `_createEntity.js`) instead of `fetchAll` for large tables
- For TanStack Query, keep `refetchOnWindowFocus: false` (already set in `query-client.js`) — this is already correctly configured

**Detection:**
Open the Network tab in DevTools. Loading Home page should not show more than 2-3 Supabase REST calls. If you see 4+ sequential calls to the same table, fetchAll pagination is firing.

---

### Pitfall 4: Duplicate Parallel Data Fetching (Static Data + loadData)

**What goes wrong:**
Operacoes.jsx currently fetches the same reference data twice: once via `useAeroportos()` / `useCompanhias()` / `useAeronaves()` (TanStack Query cache) AND once inside `loadData()` via the old `Aeroporto.filter()` / `CompanhiaAerea.list()` calls. The two datasets are then synced via the `useEffect` blocks at lines 391-412.

**Why it happens:**
The static data hooks were added as an optimization layer but the underlying `loadData()` fetches were not fully removed — they run in parallel.

**Consequences:**
Double the network traffic for reference data on page load. The synchronization effects create a confusing dual-state problem where `aeroportos` state lags behind `aeroportosCache` by one render cycle, potentially causing flicker.

**Prevention:**
When adopting TanStack Query for a data category, remove the equivalent `loadData()` fetch for that category entirely. The sync useEffects at Operacoes.jsx lines 391-412 are a code smell that indicates incomplete migration. Finish the migration or revert it — do not leave both paths active.

**Detection:**
Open Network tab on Operacoes.jsx load. Count calls to `/rest/v1/aeroporto`. If you see 2 separate calls, both paths are active.

---

## Moderate Pitfalls

Issues that cause performance degradation or maintenance problems but are recoverable.

---

### Pitfall 5: Client-Side Filtering After Fetching Unfiltered Data

**What goes wrong:**
Several pages fetch all rows then filter in JavaScript: `Home.jsx` calls `Voo.list()` without empresa_id, then filters by `icaosPermitidos` client-side (lines 121-123). The Supabase RLS policies ensure the server restricts data, but the query still transfers all rows the user is allowed to see, even those from airports they cannot access.

**Why it happens:**
The original architecture fetched everything and filtered client-side because the entity factory was built for Base44, which required client-side filtering. Supabase supports server-side filtering via `.eq()` and `.in()`, which should be used instead.

**Specific risk in this codebase:**
- `User.list()` without empresa_id filter in `Auditoria.jsx` line 189 and `Manutencao.jsx` line 88 — loads all users from all companies, then filters client-side
- This works but transfers unnecessary data (other companies' user lists)

**Prevention:**
Push empresa_id filter to the query itself: `User.filter({ empresa_id: user.empresa_id })`. RLS is a safety net, not a substitute for specific queries. The `_createEntity.js` `filter()` method already supports this.

**Detection:**
Check response payload size in Network tab. If `/rest/v1/users` response contains users from other companies (visible in the raw JSON), the filter is client-side only.

---

### Pitfall 6: Caching Data That Must Be Fresh (Operational Data)

**What goes wrong:**
Applying caching to flight operations data (voos, calculo_tarifa) with a staleTime > 0 will cause operators to see outdated flight statuses. This is an ops system — two operators at different workstations may update the same flight concurrently. If one operator lands a flight and another still sees it as "in-flight" due to a 2-minute cache, they may create duplicate records.

**Why it happens:**
Developers treat all data the same when adding caching as a blanket optimization.

**Specific risk in this codebase:**
- The `queryClientInstance` default `staleTime: 1000 * 60 * 2` (2 minutes) is a global default
- If `voos` or `calculo_tarifa` are ever wrapped in TanStack Query with this default, operators will see stale statuses
- The existing `useStaticData.jsx` 5-minute staleTime is appropriate for `aeroportos`, `companhias` — these change rarely
- It is NOT appropriate for `voos` (flight status changes frequently), `proformas` (invoice state), `calculosTarifa` (tariff calculations)

**Prevention:**
Classify data by freshness requirement before caching:
- Safe to cache (5+ min staleTime): `aeroportos`, `companhias_aereas`, `aeronaves`, `modelos_aeronave`, `tarifas`, `impostos`, `tipos_*`, `regra_permissao`
- Must be fresh (staleTime: 0 or very short): `voos`, `calculo_tarifa`, `proforma`, `ocorrencia_safety`, `inspecao`, `fundo_maneio`

**Detection:**
Two browser tabs open on Operacoes. Create a flight in Tab 1. Check if Tab 2 auto-updates within the operational window (should update within seconds, not minutes).

---

### Pitfall 7: React.lazy Without Error Boundaries

**What goes wrong:**
`Home.jsx` already uses `React.lazy` for chart components (lines 31-34). Without an `ErrorBoundary` wrapping the `Suspense`, a `ChunkLoadError` (network drop during chunk download) will crash the entire page rather than just the lazy component.

**Why it happens:**
React.lazy's Suspense boundary only handles loading states, not error states. On static hosting (Hostinger), chunk filenames include content hashes — after a new deploy, old chunk URLs 404, triggering ChunkLoadErrors in any open tab.

**Specific risk in this codebase:**
- Hostinger static deploy: after deploying a new build, users with open tabs will get ChunkLoadError on next lazy component load
- No error boundaries currently visible in the `Home.jsx` or `App.jsx` code for lazy components

**Consequences:**
Post-deploy, users with open tabs crash to a blank screen when navigating to a section with lazy-loaded charts. They cannot recover without a hard refresh.

**Prevention:**
Wrap every `React.lazy` + `Suspense` pair with an `ErrorBoundary` that catches `ChunkLoadError` and shows a "reload page" prompt:
```jsx
<ErrorBoundary fallback={<ReloadPrompt />}>
  <Suspense fallback={<Skeleton />}>
    <LazyComponent />
  </Suspense>
</ErrorBoundary>
```

**Detection:**
After deploying, open a tab from the old build and navigate to a page with lazy components. A blank screen or console ChunkLoadError confirms missing error boundary.

---

### Pitfall 8: Missing Database Indexes for Query Patterns

**What goes wrong:**
Supabase RLS policies and queries using `empresa_id`, `aeroporto_operacao`, `data_operacao`, `deleted_at`, and `voo_id` as filters need indexes. Without them, Postgres performs sequential scans on every query, which degrades significantly as row count grows.

**Why it happens:**
Indexes on foreign key and filter columns are not automatically created by Supabase beyond primary keys. RLS policies themselves act as implicit WHERE clauses and trigger per-row checks without indexes.

**Specific risk in this codebase:**
- `voo` table: high write volume + frequent filters on `empresa_id`, `aeroporto_operacao`, `data_operacao`, `deleted_at`
- `calculo_tarifa` table: filtered by `voo_id` on almost every proforma operation
- `log_auditoria` table: filtered by `empresa_id` and `created_date` for LogAuditoria page — potentially large table
- FlightAware cache table: filtered by `icao` + date range for sync

**Prevention:**
Run `EXPLAIN ANALYZE` on the slowest queries. Create composite indexes for the most common filter combinations:
```sql
CREATE INDEX IF NOT EXISTS idx_voo_empresa_aeroporto_data
  ON voo(empresa_id, aeroporto_operacao, data_operacao)
  WHERE deleted_at IS NULL;
```

**Detection:**
Supabase Dashboard > Database > Query Performance shows slow queries. Look for `Seq Scan` on tables with > 1000 rows.

---

### Pitfall 9: Over-Aggressive Lazy Loading Causing Layout Shift

**What goes wrong:**
Wrapping too many components in `React.lazy` causes multiple Suspense fallbacks to appear and disappear sequentially (layout shift), which feels slower than a single loading state even if individual chunks are smaller.

**Why it happens:**
Lazy loading is added component-by-component without considering the visual effect of waterfall loading states.

**Specific risk in this codebase:**
- If form modals (FormVoo, FormProforma) are lazy-loaded, opening a modal will show a skeleton flash before content appears, which feels broken for a frequently-used operation
- Charts on Home.jsx are already lazy — appropriate because they are below the fold and not interaction-critical

**Prevention:**
Apply lazy loading selectively:
- Good candidates: chart components, PDF preview modal, admin-only pages, rarely-visited pages (GuiaUtilizador, LogAuditoria)
- Bad candidates: primary form modals (FormVoo, FormInspecao), table components used on every page load, anything above the fold

**Detection:**
Record a screen capture of page load and modal opens. Any content flash or pop-in that takes > 200ms is a sign of overly-aggressive lazy loading on a hot path.

---

## Minor Pitfalls

---

### Pitfall 10: SELECT * Across All Tables

**What goes wrong:**
`_createEntity.js` `list()` and `filter()` methods always use `select('*')`. For tables with many columns (voo has 25+ columns, users has 20+ columns), this transfers significantly more data than needed for display.

**Prevention:**
Use the `paginate({ select: 'id,numero_voo,data_operacao,...' })` method (already implemented) or add a `select` parameter to `list()` for high-traffic queries. For dashboard KPIs, only fetch aggregate data via the existing `getDashboardStats` RPC function.

**Detection:**
Inspect Network tab response for `/rest/v1/voo`. If the response includes large blob columns or rarely-used fields, targeted SELECT will reduce payload.

---

### Pitfall 11: effectiveEmpresaId ref vs state race condition

**What goes wrong:**
`Operacoes.jsx` uses both `effectiveEmpresaId` from context (reactive) and `effectiveEmpresaIdRef` (a useRef for imperative access in callbacks). If the ref is not kept in sync with the context value, callbacks like `handleBuscarVoos` will apply the old empresa_id filter while the UI shows the new company's data.

**Prevention:**
Keep the ref updated in a useEffect: `useEffect(() => { effectiveEmpresaIdRef.current = effectiveEmpresaId; }, [effectiveEmpresaId])`. Verify this sync exists before relying on the ref pattern.

**Detection:**
Superadmin switches company view, then immediately runs a search filter. Check if the search results match the newly selected company or the old one.

---

### Pitfall 12: Supabase Auth Overhead in _createEntity on Every Mutation

**What goes wrong:**
`_createEntity.js` calls `getCurrentUserEmail()` on every `create()` and `update()` operation to populate `created_by`/`updated_by`. This has a 60-second TTL cache, but the first call after cache expiry triggers `supabase.auth.getUser()` — an async network call before every mutation.

**Prevention:**
The 60-second cache (`EMAIL_CACHE_TTL`) is already reasonably configured. Do not reduce the TTL. Consider pre-warming by calling `getCurrentUserEmail()` during app initialization (after login) so the cache is populated before the first mutation.

**Detection:**
Watch Network tab during rapid form saves. If you see a call to `supabase.auth.getUser` immediately before every `INSERT`/`UPDATE`, the cache is expiring.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Adding TanStack Query to more entities | Pitfall 1: keys without empresa_id | Always include effectiveEmpresaId in key |
| Adding TanStack Query to more entities | Pitfall 2: no cache clear on logout | Add queryClient.clear() to SIGNED_OUT handler |
| Caching operational data (voos, proforma) | Pitfall 6: stale operational data | staleTime: 0 for all operational entities |
| Route-level code splitting | Pitfall 7: ChunkLoadError post-deploy | ErrorBoundary around every Suspense |
| Lazy loading form modals | Pitfall 9: layout shift on hot paths | Only lazy load below-fold/rare components |
| Adding indexes via migration | Pitfall 8: index on wrong columns | Run EXPLAIN ANALYZE first, target actual slow queries |
| Removing old loadData fetches | Pitfall 4: dual fetch paths | Remove old fetch entirely, do not leave sync effects |
| Server-side filtering migration | Pitfall 5: client-side filter residue | Verify query payload in Network tab after change |

---

## Sources

- TanStack Query Discussion — Reset user data on logout: https://github.com/TanStack/query/discussions/1886
- TanStack Query Discussion — Previous user data leakage: https://github.com/tannerlinsley/react-query/issues/3182
- TanStack Query Query Keys Guide: https://tanstack.com/query/v4/docs/framework/react/guides/query-keys
- Supabase RLS Performance and Best Practices: https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv
- Supabase Query Optimization: https://supabase.com/docs/guides/database/query-optimization
- Supabase RLS Discussion #14576: https://github.com/orgs/supabase/discussions/14576
- React Code Splitting Pitfalls: https://legacy.reactjs.org/docs/code-splitting.html
- Supabase + TanStack Query integration: https://makerkit.dev/blog/saas/supabase-react-query
- Supabase RLS Best Practices (makerkit): https://makerkit.dev/blog/tutorials/supabase-rls-best-practices
- Optimizing RLS Performance (antstack): https://www.antstack.com/blog/optimizing-rls-performance-with-supabase/
