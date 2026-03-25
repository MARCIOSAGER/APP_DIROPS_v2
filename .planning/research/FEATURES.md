# Feature Landscape: Performance for React + Supabase Admin App

**Domain:** Data-heavy React admin app (airport management, multi-tenant, 50+ pages)
**Researched:** 2026-03-25
**Focus:** What constitutes fast vs slow UX, what users expect, caching patterns, root causes of "need to refresh"

---

## Table Stakes

Features users expect. Missing = the app feels broken or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Data reflects mutations immediately (no manual refresh) | Clicking Save should show the result without F5. Any delay > ~1s feels like the save failed. | Medium | Root cause of reported problem. Requires post-mutation state sync. |
| Page loads under 3 seconds on first visit | Industry baseline for admin apps. Longer = users assume it's broken. | Medium | Vite lazy loading already in place; query waterfall is bigger risk. |
| Stable loading states (no flicker, no spinner loops) | Users need to know whether data is loading or finished. Oscillating spinners cause confusion. | Low | AuthContext currently re-triggers loadUserProfile on TOKEN_REFRESHED — potential flicker source. |
| Filters and searches respond within 300ms | Admin users filter constantly. Slow filter = broken tool. | Low-Med | Client-side filtering on pre-fetched data is fastest; server-side needed when dataset is large. |
| No duplicate or stale data in tables | Seeing old records after an edit destroys trust. | Medium | Direct consequence of missing cache invalidation after mutations. |
| Pagination or virtual scrolling for large lists | 1000+ flights rendered in a plain `<table>` causes noticeable jank (each row is a DOM node). | High | `Operacoes.jsx` fetches up to 1000 voos with `select('*')`. Rendering all at once is the likely jank source. |
| Error states that don't require a full page reload | If one query fails, the rest of the page should still work. | Low | Already partially addressed with `Promise.allSettled` in Operacoes and Home. |

---

## Differentiators

Features that separate a fast-feeling app from a merely functional one. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Optimistic updates on create/edit/delete | UI responds before the server confirms. Operations team moves faster; latency becomes invisible. | Medium | Requires local state mutation + rollback on error. Works well with TanStack Query `useMutation`. |
| Background data refresh with stale-while-revalidate | User sees cached data instantly; fresh data loads silently. No spinner on navigation. | Medium | TanStack Query `staleTime` already in use for static data (useStaticData.jsx). Needs extension to operational data (voos, voosLigados). |
| Query deduplication across components | Home.jsx and Operacoes.jsx both fetch `voos` and `calculosTarifa` independently. Sharing a query key eliminates duplicate network calls. | Low | TanStack Query already installed (`queryClientInstance`). Static data hooks (`useAeroportos`) already deduplicated. Operational data is not yet in TQ. |
| Column-selective fetching (`select` instead of `select('*')`) | Reduces payload size. `calculo_tarifa` already uses a lightweight helper (`fetchCalculoMap`) with 6 columns vs full `select('*')`. Extending to voo and voo_ligado is high ROI. | Low | `_createEntity.js` `list()` and `filter()` always do `select('*')`. The `paginate()` method already accepts a `select` param but is unused. |
| Route-level data prefetching | Start fetching data for likely next pages before the user clicks (e.g., when hovering a nav link). | High | Nice-to-have. Current architecture (useEffect in each page) does not support it. Out of scope for v1.2. |
| Real-time Supabase subscriptions for collaborative updates | Two operators editing the same flight simultaneously see each other's changes. | High | Complex. Stale-closure bugs in React + Supabase Realtime are well-documented. Not needed for DIROPS — single operator per session. Out of scope. |

---

## Anti-Features

Features to explicitly NOT build for this milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Supabase Realtime subscriptions for stale-data fix | Real-time solves multi-user collaborative editing. The reported problem is single-user stale data after their own mutations — a caching problem, not a broadcast problem. Real-time adds connection overhead, stale-closure complexity, and reconnection handling. | Use TanStack Query cache invalidation (`queryClient.invalidateQueries`) after mutations. |
| Full table virtualisation with react-window / react-virtual | Adds significant complexity. Useful if rendering 5000+ rows. At 1000 rows the bigger win comes from reducing payload (select specific columns) and enabling server-side pagination first. | Enable server-side pagination (`paginate()` already exists in `_createEntity.js`) for Operacoes. |
| Global re-fetch on window focus | `refetchOnWindowFocus: false` is intentionally set in all `useStaticData` hooks. Re-enabling it would hammer Supabase every time the user alt-tabs. | Use explicit invalidation after mutations only. |
| Replacing TanStack Query with SWR or another caching library | TanStack Query v5 is already installed and partially used. Switching libraries mid-project is a rewrite, not a fix. | Extend existing TanStack Query usage to operational data. |
| Service Worker offline caching | Hostinger shared hosting is static. A SW cache for API responses creates a new class of "stale data" bugs (SW cache never invalidated). The app is not designed for offline use. | Skip. The current SW handles only chunk-reload errors (already implemented in App.jsx). |

---

## Root Causes of "Need to Refresh to See Data"

This section maps observed symptom to specific code patterns found in the codebase.

### Root Cause 1: No post-mutation cache invalidation (PRIMARY)

**Where:** Every create/update/delete in every page.
**Pattern:** After `Voo.create()` or `Voo.update()`, pages call `refreshSpecificData(['voos'])` (Operacoes) or `checkUserAndLoadData()` (Home) — full re-fetches from scratch, or nothing at all on other pages.
**Effect:** Other pages that display the same data (e.g., Home shows flight counts, Operacoes shows flight table) have no notification that data changed. User must navigate away and back, or press F5.
**Fix:** Migrate operational data fetches to TanStack Query hooks with named query keys (`['voos', empresaId]`, `['voosLigados', empresaId]`). After every mutation, call `queryClient.invalidateQueries({ queryKey: ['voos'] })`. TanStack Query refetches all active observers automatically.

### Root Cause 2: `loadData` depends on `effectiveEmpresaId` via a ref but not declared as a dependency

**Where:** `Operacoes.jsx` line 311: `}, []);` — empty dependency array on `loadData`.
**Pattern:** `effectiveEmpresaId` changes (superadmin switches company view) but `loadData` is memoised with `useCallback(async () => {...}, [])`. The ref workaround (`effectiveEmpresaIdRef`) is used inside the callback, which works for reads but means `loadData` is never re-triggered when the company view changes — it only runs once on mount.
**Effect:** Switching company view may not reload data in Operacoes. User must manually refresh.
**Fix:** Either add `effectiveEmpresaId` to the `useCallback` dependency array, or move data fetching into a TanStack Query `queryKey` that includes `empresaId` (preferred — TanStack Query handles the re-fetch automatically when the key changes).

### Root Cause 3: Home.jsx calls `User.me()` on every data load

**Where:** `Home.jsx` `loadData()` starts with `const user = await User.me()` — this is `base44.auth.me()`, which calls `supabase.auth.getUser()` followed by a `users` table query every single time.
**Effect:** Every dashboard refresh (which happens on `effectiveEmpresaId` change, on `selectedAeroporto`/`selectedPeriodo` change, and on mount) incurs 2 sequential round-trips before the actual data queries start. This alone adds 200-400ms to every dashboard load.
**Fix:** Consume `user` from `AuthContext` via `useAuth()`. The auth context already holds the profile. No additional query needed.

### Root Cause 4: `calculo_tarifa` still fetched in full on Home.jsx

**Where:** `Home.jsx` line 107: `CalculoTarifa.list('-data_calculo', 1000)` — uses `select('*')`, fetches 1000 records with all columns.
**Effect:** Large payload for a dashboard that only needs totals and IDs.
**Fix:** Use the `fetchCalculoMap` helper already written in `Operacoes.jsx` (selects only 6 columns) or an RPC that returns pre-aggregated stats. The `get_dashboard_stats` RPC already exists and is called in `loadDashboardStats` — move KPI data entirely to the RPC and drop the client-side `calculosTarifa` array from Home.

### Root Cause 5: TOKEN_REFRESHED triggers a full profile reload

**Where:** `AuthContext.jsx` line 125-127: `else if (event === 'TOKEN_REFRESHED' && session?.user) { await loadUserProfile(session.user); }`.
**Effect:** Supabase refreshes the JWT silently every ~1 hour. Each refresh triggers a `users` table query and updates `user` state in context. Any component subscribed to `user` re-renders. On pages with heavy `useEffect([user, ...])` dependencies this can trigger a full data reload mid-session without the user doing anything.
**Fix:** Only reload profile on `TOKEN_REFRESHED` if the profile is actually stale (check `user?.id` vs `session.user.id`). If same user, skip the DB query.

### Root Cause 6: `select('*')` on large tables

**Where:** `_createEntity.js` `list()` and `filter()` methods always use `select('*')`.
**Effect:** `Voo` table has many columns (voo_ligado_id, recursos, documentos references, all tariff fields). Fetching all columns for a 1000-row display table transfers significantly more data than needed.
**Fix:** Add a `select` parameter to `list()` and `filter()` (mirrors the existing `paginate()` signature). For Operacoes, the flight table needs perhaps 15-20 columns, not all 40+. Column reduction of 50% cuts payload proportionally.

---

## Feature Dependencies

```
TanStack Query for operational data
  → Post-mutation invalidation works correctly
  → Background refresh (stale-while-revalidate) on navigation
  → Query deduplication between Home and Operacoes

Server-side pagination (paginate() already exists)
  → Must exist before virtual scrolling makes sense
  → Enables "load 50 rows, show more" pattern without full re-fetch

Column-selective fetching
  → Reduces payload regardless of caching strategy
  → Independent — can be done before or after query migration

AuthContext user reuse
  → Reduces sequential round-trips at page load
  → Independent of caching migration
```

---

## MVP Recommendation for v1.2

Prioritize (highest ROI, lowest risk, directly addresses reported symptoms):

1. **Migrate operational data to TanStack Query hooks** — Directly fixes "need to refresh" after mutations. Uses already-installed library. Named query keys enable cross-page invalidation. Estimated effort: 3-5 days.

2. **Post-mutation `invalidateQueries` in all CRUD operations** — The mechanism that makes mutations visible without refresh. Depends on item 1. Effort: 1-2 days after item 1.

3. **Remove `User.me()` from page-level `loadData` functions** — Use `useAuth().user` instead. Removes 2 sequential round-trips from every page load. Zero new dependencies. Effort: 1 day.

4. **Column-selective `select` on high-traffic queries** — Add `select` param to `list()`/`filter()` in `_createEntity.js`. Apply to `Voo.list()` and `VooLigado.list()` in Operacoes. Effort: 1 day.

5. **Fix TOKEN_REFRESHED profile reload** — Guard against reloading profile when user is unchanged. Eliminates mid-session ghost re-renders. Effort: 2 hours.

Defer:
- **Virtual scrolling** — Only needed if server-side pagination is insufficient and users scroll 1000+ rows. Adds complexity without clear benefit if items 1-4 are done.
- **Route prefetching** — Nice-to-have, significant architecture change. Post-v1.2.
- **Supabase Realtime subscriptions** — Wrong tool for the problem. Post-v1.2 if collaborative editing is ever needed.

---

## Sources

- [TanStack Query v5 — Query Invalidation](https://tanstack.com/query/v5/docs/framework/react/guides/query-invalidation)
- [TanStack Query — Invalidation from Mutations](https://tanstack.com/query/v4/docs/framework/react/guides/invalidations-from-mutations)
- [Automatic Query Invalidation after Mutations — tkdodo.eu](https://tkdodo.eu/blog/automatic-query-invalidation-after-mutations)
- [Supabase — Query Optimization](https://supabase.com/docs/guides/database/query-optimization)
- [Supabase — Realtime stale closure issues](https://github.com/orgs/supabase/discussions/5641)
- [React useEffect infinite loop patterns — LogRocket](https://blog.logrocket.com/solve-react-useeffect-hook-infinite-loop-patterns/)
- [Vite code splitting and lazy loading — Medium](https://benmukebo.medium.com/boost-your-react-apps-performance-with-vite-lazy-loading-and-code-splitting-2fd093128682)
- [React dashboard performance — bootstrapdash.com](https://www.bootstrapdash.com/blog/react-dashboard-performance)
