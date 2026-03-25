# Project Research Summary

**Project:** DIROPS-SGA v1.2 Performance Milestone
**Domain:** Performance optimization — multi-tenant React admin app with Supabase backend
**Researched:** 2026-03-25
**Confidence:** HIGH

## Executive Summary

DIROPS-SGA v1.2 is a targeted performance milestone for an existing production airport management system. The app is not missing libraries — it is missing usage of what is already installed. TanStack Query v5.84 is in `package.json` and `QueryClientProvider` wraps the entire app, but only one file (`useStaticData.jsx`) uses it. The remaining 36+ pages fetch data via raw `useEffect` + `useState` with no caching, no post-mutation invalidation, and no query deduplication. The root cause of every reported performance problem — "need to refresh to see changes," slow page loads, redundant network calls — traces back to this single architectural gap.

The recommended approach is progressive migration: expand the existing TanStack Query layer to cover page-level operational data, add `queryClient.invalidateQueries()` calls after all mutations, stop pages from calling `User.me()` when `AuthContext` already holds the profile, and add a `select` parameter to `_createEntity.js` to enable column-selective fetching. No new runtime dependencies are required. Two dev-only tools (`@tanstack/react-query-devtools` and `rollup-plugin-visualizer`) will be needed for verification but are excluded from production builds. The `_createEntity.js` factory stays as pure async functions; TanStack Query wraps it at the hook layer in a new `src/hooks/` directory.

The primary risks are multi-tenant cache key contamination (serving one company's cached data to another company's view) and cache not being cleared on logout. Both are silent data correctness bugs — no errors thrown, just wrong data displayed. These must be addressed before or during the caching migration, not after. The migration strategy must be phased by page, not applied globally, to avoid regressions in Operacoes.jsx which has complex retry logic.

---

## Key Findings

### Recommended Stack

The app already has the correct stack installed. No new runtime dependencies are needed. The migration requires configuration changes to existing libraries and coding pattern changes across pages.

**Core technologies:**
- **TanStack Query v5.84**: Data caching and server state — already installed, extend from `useStaticData.jsx` to all page-level data fetching
- **Supabase JS Client**: Data access layer via `_createEntity.js` factory — keep unchanged, add optional `select` parameter to `list()` and `filter()` methods
- **Vite 6 + React 18**: Build and runtime — no changes needed; route-level code splitting already done for all 47 pages
- **`@tanstack/react-query-devtools`** (dev only): Verify cache key correctness and stale/fresh status during migration
- **`rollup-plugin-visualizer`** (dev only, run once): Confirm `manualChunks` split in `vite.config.js` is working as expected

**Critical configuration changes (not new dependencies):**
- `supabaseClient.js`: Add `AbortSignal.timeout(15000)` global fetch option — prevents indefinite hangs on Angola's network profile
- `query-client.js`: Add `networkMode: 'offlineFirst'`, `refetchOnReconnect: true`, increase `staleTime` to 3 min — tuned for slow connectivity
- `vite.config.js`: Add explicit `chunkSizeWarningLimit: 600` — make Vite chunk warnings visible

### Expected Features

The scope of v1.2 is exclusively performance and correctness, not new functionality. All items below are fixes to existing behavior.

**Must have (table stakes — app feels broken without these):**
- Post-mutation cache invalidation — clicking Save must show the result without F5; currently absent for all 36 non-cached pages
- Page loads under 3 seconds — Vite lazy loading is done; query waterfall and `select('*')` are the remaining bottlenecks
- No stale data in tables after edits — direct consequence of missing `invalidateQueries`
- Stable loading states without flicker — `TOKEN_REFRESHED` currently triggers full profile reload causing mid-session re-renders
- Error states that don't crash the full page — `ChunkLoadError` post-deploy with no `ErrorBoundary` causes blank screens

**Should have (differentiators — visible improvement over current experience):**
- Background stale-while-revalidate on navigation — users see cached data instantly while fresh data loads silently
- Query deduplication between Home and Operacoes — both currently fetch `voos` and `calculosTarifa` independently
- Column-selective fetching — `voo` table has 30+ columns; Operacoes needs ~15; payload reduction is proportional

**Defer to post-v1.2:**
- Virtual scrolling / react-virtual — only needed if server-side pagination is insufficient at 1000+ rows
- Route-level data prefetching — significant architecture change, no current user request
- Supabase Realtime full subscriptions — wrong tool for the reported problem; adds WebSocket complexity

**Explicit anti-features (do not build):**
- Global Supabase Realtime feed — the problem is single-user stale data after own mutations, not multi-user broadcast
- React Query Persist (localStorage/IndexedDB) — risky with tenant-scoped data; stale persisted data with wrong `empresa_id` is worse than a fresh fetch
- Service Worker offline API caching — creates a new class of stale data bugs on Hostinger static hosting

### Architecture Approach

The architecture stays unchanged at every layer except one: a new `src/hooks/` directory is added between the page components and the `_createEntity.js` entity adapter. Each hook file wraps entity calls in `useQuery`/`useMutation`, owns the query key (always including `empresaId`), and calls `queryClient.invalidateQueries()` on mutation success. Pages consume hooks instead of calling entities directly. The entity adapter, `base44Client.js` Proxy, `AuthContext`, `supabaseClient.js`, and `pages.config.js` all remain unchanged.

**Major components and their roles:**

1. **`AuthContext.jsx`** — expose `user` profile via `useAuth()`; stop pages calling `User.me()`; add `queryClient.clear()` on `SIGNED_OUT`; guard `TOKEN_REFRESHED` to skip DB query when user is unchanged
2. **`useStaticData.jsx`** — expand with `useImpostos()` and `useConfiguracaoSistema()`; remove duplicate static data fetches from `loadData()` in Operacoes
3. **`src/hooks/` (new)** — `useVoos`, `useVoosLigados`, `useCalculosTarifa`, `useDashboardStats`, mutation hooks; query keys always include `empresaId`
4. **`_createEntity.js`** — add optional `select = '*'` parameter to `list()` and `filter()` (backward compatible); no other changes
5. **Database migrations** — composite indexes on `voo(empresa_id, deleted_at, data_operacao)`, `calculo_tarifa(empresa_id, voo_id)`, `voo_ligado(empresa_id)`; RLS `auth.uid()` wrapped with `(select auth.uid())` on 4 high-traffic tables

**Key data flow change:**
```
Before: Page → useEffect → _createEntity → Supabase (no cache)
After:  Page → useHook → useQuery → _createEntity → Supabase (cached, invalidated on mutation)
```

### Critical Pitfalls

1. **Cache keys without tenant context** — `['aeroportos']` serves Empresa A data when viewing Empresa B. Always include `effectiveEmpresaId` in every query key for tenant-scoped data. This is a silent wrong-data bug, no error thrown.

2. **Cache not cleared on logout** — `queryClientInstance` persists for app lifetime; after logout + re-login as a different user, old tenant data flashes before refetch. Add `queryClientInstance.clear()` to the `SIGNED_OUT` handler and the `logout()` function before any other work.

3. **`fetchAll` loop inside TanStack Query functions** — `_createEntity.js` `fetchAll()` loops through 500-row pages. Wrapping it in `useQuery` with background refetch creates frequent bulk fetches. Apply date-range filters before fetching; use `paginate()` for large tables.

4. **Dual fetch paths left active** — Operacoes already fetches tarifas via both `useStaticData` and `loadData()`. Adding more TanStack Query hooks without removing the old `loadData()` fetches creates duplicate network calls and confusing dual-state sync effects. When migrating a data category, remove the old fetch entirely.

5. **Wrong `staleTime` for operational data** — the global default of 2 minutes is acceptable for reference data but wrong for `voos`, `proforma`, and `calculo_tarifa`. Two operators at different workstations updating the same flight will see stale statuses. Set `staleTime: 0` (or very short) for all operational entities.

---

## Implications for Roadmap

Based on the combined research, the migration has natural phases driven by risk profile and leverage. The constraint is: (1) foundational shared infrastructure must come first because it benefits all subsequent phases, (2) high-traffic pages (Operacoes, Home) must come last in the migration sequence because they have the most complex state logic and the most users, (3) correctness fixes (logout cache clear, tenant keys) must be in Phase 1 before any caching is extended.

### Phase 1: Foundation and Correctness
**Rationale:** These changes are low-risk, have no dependencies on each other, and make all subsequent caching work correct rather than dangerous. They must come before extending TanStack Query to new data.
**Delivers:** Safe caching foundation — tenant isolation in query keys, cache cleared on logout, no ghost re-renders from TOKEN_REFRESHED, 2 fewer Supabase round-trips on every page load
**Addresses:** Table stakes items — stable loading states, no stale data after logout, no sequential auth waterfall
**Avoids:** Pitfall 1 (tenant contamination), Pitfall 2 (cross-user data leakage), Root Cause 3 (User.me on every page), Root Cause 5 (TOKEN_REFRESHED ghost re-renders)
**Specific tasks:**
- Add `queryClient.clear()` on `SIGNED_OUT` and `logout()`
- Update `useStaticData.jsx` hooks to include `effectiveEmpresaId` in all query keys
- Replace `User.me()` calls in all pages with `useAuth().user`
- Guard `TOKEN_REFRESHED` handler to skip DB query when user ID is unchanged
- Add `select = '*'` optional parameter to `_createEntity.js` `list()` and `filter()`
- Add Supabase client global fetch timeout (15s)
- Tune `query-client.js` with `networkMode: 'offlineFirst'` and `refetchOnReconnect: true`

### Phase 2: Dashboard Consolidation (Home.jsx)
**Rationale:** Home.jsx has the worst redundancy pattern (3 calls for the same stats data, `User.me()` in loadData) but is not the most complex page. Fixing it first demonstrates the pattern for Operacoes and eliminates the most visible redundancy.
**Delivers:** Dashboard loads with 1 RPC call instead of 3 stats requests; KPI data cached for 5 minutes; period/aeroporto filter changes use cache
**Addresses:** Root Cause 3 (`User.me()` in loadData), Root Cause 4 (`calculo_tarifa select('*')` for 1000 rows), dashboard triple-fetch anti-pattern
**Avoids:** Pitfall 3 (fetchAll in query functions), Pitfall 6 (wrong staleTime for operational data)
**Specific tasks:**
- Create `src/hooks/useDashboardStats.js` wrapping `get_dashboard_stats` RPC with `staleTime: 5 min`
- Create `src/hooks/useVoos.js` with column selection for dashboard KPI view
- Remove Edge Function calls from Home.jsx; use RPC-only path
- Apply date-range filter to Home.jsx `Voo.list()` — stop fetching all-time data

### Phase 3: Operacoes Query Migration
**Rationale:** Operacoes is the highest-traffic page and has the most complex existing state management (custom retry logic, 8 parallel fetches, dual-path tarifas). It must be last in the page migration sequence. Phase 1 and 2 patterns must be validated in production first.
**Delivers:** Operacoes fetches tarifas from cache (no duplicate fetch), voos and voosLigados cached with proper invalidation after create/update, no manual refresh needed after flight operations
**Addresses:** Root Cause 1 (no post-mutation invalidation), Root Cause 2 (loadData useCallback empty deps), Pitfall 4 (dual fetch paths)
**Avoids:** Pitfall 3 (fetchAll in queries), Pitfall 5 (client-side filter after full fetch), Pitfall 6 (staleTime for operational voos)
**Specific tasks:**
- Remove tarifas, impostos, configuracoes from Operacoes `loadData()` — consume from `useStaticData` hooks
- Create `src/hooks/useVoosOperacoes.js` and `src/hooks/useVoosLigados.js` with `staleTime: 0`
- Add `queryClient.invalidateQueries(['voos', empresaId])` after all Voo create/update/delete operations
- Fix `useCallback` dependency array — include `efectiveEmpresaId` or migrate to `useQuery` queryKey

### Phase 4: Database Index Audit
**Rationale:** Application-level caching reduces the number of queries but does not change query execution cost when they do hit the database. Index gaps become more visible as data grows. This phase has no code changes — only SQL migrations.
**Delivers:** Composite indexes on `voo`, `calculo_tarifa`, `voo_ligado` covering the actual query patterns; RLS `auth.uid()` wrapped to prevent per-row re-evaluation; measurably faster Supabase query execution
**Addresses:** Pitfall 8 (missing indexes causing sequential scans), STACK.md Pattern 7 (RLS initPlan fix)
**Avoids:** Index-on-wrong-columns mistake (use EXPLAIN ANALYZE first)
**Specific tasks:**
- Run `EXPLAIN ANALYZE` on Operacoes primary voo query, Home dashboard query, fetchCalculoMap
- Create composite index `voo(empresa_id, deleted_at, data_operacao DESC)`
- Create index `calculo_tarifa(empresa_id)` and `calculo_tarifa(voo_id)`
- Create index `voo_ligado(empresa_id)`
- Wrap `auth.uid()` with `(select auth.uid())` in RLS policies on voo, voo_ligado, calculo_tarifa, proforma

### Phase 5: Component Lazy Loading and Bundle Optimization
**Rationale:** Route-level splitting is already done. The remaining opportunity is intra-page lazy loading of modal components that are heavy but infrequently used within the largest chunk (Operacoes.jsx).
**Delivers:** Operacoes.jsx initial parse time reduced; ChunkLoadError post-deploy handled gracefully; bundle size visible via visualizer
**Addresses:** Pitfall 7 (ChunkLoadError with no ErrorBoundary), Pitfall 9 (over-aggressive lazy loading on hot paths)
**Avoids:** Lazy-loading primary form modals (FormVoo, FormInspecao) — these are hot paths and should stay static
**Specific tasks:**
- Run `rollup-plugin-visualizer` to identify largest chunks
- Lazy-load `TariffDetailsModal`, `GerarFaturaModal`, `LixeiraVoosModal`, `UploadMultiplosDocumentosModal` in Operacoes
- Add `ErrorBoundary` wrapping `Suspense` for all lazy-loaded chart components in Home.jsx
- Install `@tanstack/react-query-devtools` (dev-only) for ongoing cache verification

### Phase Ordering Rationale

- Phase 1 before Phase 2-3: tenant key isolation and logout cache clearing must be in place before extending caching to more data; doing it after creates a window where production has unsafe caching
- Phase 2 before Phase 3: Home.jsx is a simpler page to validate the TanStack Query page-data pattern on before applying it to Operacoes with its complex retry logic
- Phase 4 after Phase 3: indexes become most valuable after application-layer optimizations are in place, since caching reduces call frequency but not individual query cost
- Phase 5 last: bundle optimization is polish; correctness and caching improvements deliver user-visible value first

### Research Flags

Phases with well-documented patterns (skip `research-phase`):
- **Phase 1:** All tasks use documented TanStack Query and AuthContext patterns already present in codebase
- **Phase 2:** `useDashboardStats` pattern is a direct extension of `useStaticData.jsx` — same library, same approach
- **Phase 5:** `React.lazy` + `ErrorBoundary` patterns are well-documented in official React docs

Phases that may need closer investigation during planning:
- **Phase 3:** Operacoes.jsx has 3-attempt custom retry logic baked into `loadData()`. Before migrating, map all side effects in `loadData()` and `refreshSpecificData()` — there may be hidden dependencies not visible in static analysis
- **Phase 4:** Run `EXPLAIN ANALYZE` before writing any migration. The actual slow queries may differ from expected patterns. Do not create indexes based on assumptions alone.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All library versions verified against `package.json`. No new runtime deps needed — finding based on direct code inspection, not assumption. |
| Features | HIGH | Root causes traced to specific file/line references. Feature scope is narrow (performance only) with clear codebase evidence for each claim. |
| Architecture | HIGH | All architectural findings from direct source code analysis of the actual files. Component boundaries match existing patterns. No speculative redesign. |
| Pitfalls | HIGH | Pitfalls 1-4 are confirmed active in the current codebase. Pitfalls 5-9 are latent risks triggered by the proposed migration. All based on official TanStack Query and Supabase documentation. |

**Overall confidence:** HIGH

### Gaps to Address

- **Operacoes.jsx mutation side effects**: `loadData()` and `refreshSpecificData()` in Operacoes contain state logic beyond simple data refetch (error toasts, loading flags, modal close logic). Full enumeration is needed before migration to avoid regression. Recommend a pre-migration audit of all mutation handlers in Operacoes.
- **Existing database index coverage**: Phase 4 recommendations are based on query patterns, not confirmed index absence. The actual state of `pg_indexes` for `voo`, `calculo_tarifa`, `voo_ligado` is unknown. Run the audit query before writing migration files.
- **Dashboard RPC completeness**: The `get_dashboard_stats` RPC is assumed to return all data currently fetched by the 2 Edge Function calls. This needs verification — the Edge Function may cover edge cases not in the RPC.
- **Superadmin company-switch behavior in Operacoes**: `effectiveEmpresaIdRef` vs `effectiveEmpresaId` state race (Pitfall 11) is a known issue but its exact trigger conditions in production are undocumented. Test explicitly after Phase 3 migration.

---

## Sources

### Primary (HIGH confidence)
- `src/entities/_createEntity.js`, `src/api/base44Client.js`, `src/lib/AuthContext.jsx`, `src/App.jsx`, `src/pages/Operacoes.jsx`, `src/pages/Home.jsx`, `src/components/lib/useStaticData.jsx`, `src/lib/query-client.js`, `src/pages.config.js`, `vite.config.js` — direct source code analysis
- [TanStack Query v5 — Query Invalidation](https://tanstack.com/query/v5/docs/react/guides/query-invalidation) — official docs
- [TanStack Query v5 — DevTools](https://tanstack.com/query/v5/docs/framework/react/devtools) — official docs
- [Supabase — Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes) — official docs
- [Supabase — RLS Performance and Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) — official troubleshooting docs
- [Supabase — Query Optimization](https://supabase.com/docs/guides/database/query-optimization) — official docs
- [Supabase — index_advisor](https://supabase.com/docs/guides/database/extensions/index_advisor) — official docs
- [Supabase — RLS initplan lint](https://supabase.com/docs/guides/database/database-advisors?queryGroups=lint&lint=0003_auth_rls_initplan) — official docs

### Secondary (MEDIUM confidence)
- [TanStack Query — Automatic Query Invalidation after Mutations (tkdodo.eu)](https://tkdodo.eu/blog/automatic-query-invalidation-after-mutations) — community, patterns match official docs
- [How to Use Supabase with TanStack Query (makerkit.dev)](https://makerkit.dev/blog/saas/supabase-react-query) — community tutorial, consistent with official docs
- [Vite manualChunks code splitting 2025 (mykolaaleksandrov.dev)](https://www.mykolaaleksandrov.dev/posts/2025/10/react-lazy-suspense-vite-manualchunks/) — community, verified against Vite docs
- [TanStack Query — Reset user data on logout (GitHub Discussion #1886)](https://github.com/TanStack/query/discussions/1886) — community, confirmed pattern

---
*Research completed: 2026-03-25*
*Ready for roadmap: yes*
