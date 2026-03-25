# Technology Stack — Performance Optimization

**Project:** DIROPS-SGA v1.2 Performance Milestone
**Researched:** 2026-03-25
**Scope:** Stack additions and config changes to fix slow page loads, eliminate manual refreshes, and optimize Supabase queries

---

## Executive Summary

The app already has the right dependencies installed. **@tanstack/react-query v5.84** is in package.json but only used in two places: `useStaticData.jsx` (static lookup tables) and `query-client.js` (client configuration). The other 36 pages still fetch data with raw `useEffect` + `useState`, bypassing the cache entirely. The performance problem is architectural — not a missing library.

The migration path is: extend the existing TanStack Query investment to cover page-level data fetching, expose Supabase Realtime as a cache-invalidation trigger (not a full real-time feed), and fix three Vite build gaps that inflate initial load.

No new runtime dependencies are required. Two dev-only tools are recommended for profiling.

---

## Current State Audit

### What is already installed and configured

| Concern | Status | Location |
|---------|--------|----------|
| TanStack Query v5 | Installed, partially used | `src/lib/query-client.js`, `src/components/lib/useStaticData.jsx` |
| QueryClientProvider | Wired up | `src/App.jsx` |
| Route-level code splitting | Done for all 47 pages | `src/pages.config.js` |
| Vendor chunk splitting | Done | `vite.config.js` manualChunks |
| PWA + Service Worker | Configured | `vite.config.js` VitePWA |
| Supabase storage caching | CacheFirst in SW | `vite.config.js` workbox |
| Static data hooks | `useStaticData.jsx` covers aeroportos, companhias, aeronaves, modelos, tarifas | ready |

### What is missing

| Gap | Impact |
|-----|--------|
| 36 pages fetch raw with `useEffect` — no caching layer | Every page visit hits Supabase even when data is fresh from 30 seconds ago |
| No cache invalidation after mutations | After create/update, user must manually refresh |
| No Supabase Realtime subscription wired to queryClient.invalidateQueries | Multi-tab and multi-user data drift |
| `list()` and `filter()` always use `select('*')` | Transfers unused columns (calculo_tarifa has 20+ columns; fetchCalculoMap in Operacoes already manually selects 6 of them) |
| `_createEntity.js` `list()` is called without `empresaId` filter in several pages | Fetches all tenants' data, then filters in JS |
| No bundle visualizer — chunk sizes unknown | Cannot measure if manualChunks split is effective |
| No React DevTools profiler discipline | Cannot identify expensive re-renders |

---

## Recommended Additions

### 1. TanStack Query DevTools — Dev Only

**Package:** `@tanstack/react-query-devtools` (already available via the existing react-query install)

**Version:** Match `@tanstack/react-query` — currently 5.84.x. DevTools ships as a peer package.

```bash
rtk pnpm install -D @tanstack/react-query-devtools
```

**Why:** Provides a live view of all query keys, their cache status (fresh/stale/fetching), and gc timers. Essential for verifying that the migration from raw `useEffect` to `useQuery` is actually caching data. Auto-excluded from production builds (tree-shaken when NODE_ENV is not development).

**Integration:**
```jsx
// src/App.jsx — add inside QueryClientProvider, after app routes
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
// At end of return:
{import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
```

### 2. rollup-plugin-visualizer — Dev Only

**Package:** `rollup-plugin-visualizer`

**Version:** `^5.14.0` (current as of 2025)

```bash
rtk pnpm install -D rollup-plugin-visualizer
```

**Why:** The vite.config.js has 9 manualChunks but there is no visibility into whether they are working or if any route chunks are still pulling in heavy dependencies. One known risk: Operacoes.jsx imports from 15 entity files plus recharts adjacents — without a visualizer it is impossible to know if it has been correctly split.

**Integration:**
```js
// vite.config.js
import { visualizer } from 'rollup-plugin-visualizer';

plugins: [
  react(),
  VitePWA(...),
  visualizer({ open: true, gzipSize: true, filename: 'dist/bundle-stats.html' }),
]
```

Run once, inspect the treemap, remove the plugin before committing.

---

## No New Runtime Dependencies Needed

The following are explicitly NOT recommended despite being common performance suggestions:

| Library | Why Not |
|---------|---------|
| Zustand / Jotai (global client state) | TanStack Query v5 already handles server state. Adding a second state layer creates synchronization complexity. |
| SWR | TanStack Query is already installed and partially integrated. Mixing two data-fetching paradigms in the same app creates confusion. |
| React Virtual / TanStack Virtual | Virtualization is premature. First measure whether the re-render cost is actually in table rendering, not in data fetching. |
| Supabase Realtime full subscription | A full real-time feed per page adds WebSocket connections, RLS overhead per row, and replication load. Use Realtime only as a cache invalidation trigger via `invalidateQueries`, not to receive full row payloads. |
| React Query Persist (localStorage/IndexedDB) | Persistence is complex and risky when data is tenant-scoped. A fresh fetch is more reliable than stale persisted data with empresa_id assumptions. |

---

## Configuration Changes

### Vite: Add chunkSizeWarningLimit

The current config does not set `build.chunkSizeWarningLimit`. Vite defaults to 500kB and will warn about large chunks. Set explicitly:

```js
// vite.config.js — inside build:
build: {
  chunkSizeWarningLimit: 600,  // kB — explicit, not relying on default
  rollupOptions: { ... }
}
```

### Vite: Move framer-motion to its own chunk

`vendor-motion` chunk correctly isolates framer-motion. Verify after running visualizer that no page chunk is re-importing it. If it appears in route chunks, the dynamic import patterns in those pages need to be fixed.

### Supabase Client: Add global fetch options

The current `supabaseClient.js` has no request timeout. On Angola's connectivity profile (cited in vite.config.js comment), a hung fetch can block a page indefinitely. Add a global timeout via the `global.fetch` option:

```js
// src/lib/supabaseClient.js
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    lock: async (_name, _acquireTimeout, fn) => await fn(),
  },
  global: {
    fetch: (url, options = {}) =>
      fetch(url, { ...options, signal: AbortSignal.timeout(15000) }),
  },
});
```

**Why 15 seconds:** The Workbox config comment explains that 5s is too aggressive for Angola's network. 15s allows slow connections to complete while preventing indefinite hangs.

---

## Query Optimization Patterns

These are not library additions — they are coding patterns to apply during implementation.

### Pattern 1: Select only needed columns

Every `_createEntity.js` method uses `select('*')`. The `paginate()` method already accepts a `select` parameter. Use it.

```js
// Instead of:
Voo.list('-data_operacao', 500)

// Use paginate() with explicit columns:
Voo.paginate({
  filters: { empresa_id: empresaId },
  orderBy: '-data_operacao',
  pageSize: 200,
  select: 'id,numero_voo,data_operacao,tipo_movimento,status,companhia_aerea_id,aeroporto_operacao,passageiros,carga'
})
```

**Impact:** The `voo` table has approximately 30 columns. Selecting 9 reduces payload by ~70% for the Operacoes list view.

### Pattern 2: Server-side empresa_id filtering — never client-side

Current Home.jsx pattern:
```js
// Fetch all, filter in JS:
await Voo.list('-data_operacao', 500)
// then: voosData.filter(v => icaosPermitidos.has(v.aeroporto_operacao))
```

Correct pattern:
```js
// Filter at the query level:
await Voo.filter(
  { empresa_id: empresaId },
  '-data_operacao',
  200
)
```

**Why:** Supabase RLS already enforces empresa_id isolation, but the query still transfers all rows the RLS allows before JS filters them further. With multiple companies in the same Supabase project, this multiplies data transfer.

### Pattern 3: Query keys that include empresa_id

When wrapping entity calls in `useQuery`, always include `empresaId` in the query key:

```js
// Correct — different companies get different cache entries:
useQuery({
  queryKey: ['voos', empresaId, filtros],
  queryFn: () => Voo.filter({ empresa_id: empresaId }, '-data_operacao', 200),
  staleTime: 2 * 60 * 1000,
})

// Wrong — same cache entry for all companies:
useQuery({
  queryKey: ['voos'],
  queryFn: () => Voo.list('-data_operacao', 500),
})
```

### Pattern 4: Mutation-driven cache invalidation instead of reload

Current pattern (observed across pages): After `Voo.create()` or `Voo.update()`, call `loadData()` which refetches everything.

```js
// Current (wasteful):
await Voo.create(formData);
await loadData(); // re-fetches voos, companhias, aeroportos, tarifas, all at once

// Correct with TanStack Query:
const mutation = useMutation({
  mutationFn: (data) => Voo.create(data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['voos', empresaId] });
    // Only the voos query refetches. Static data remains cached.
  },
});
```

### Pattern 5: Supabase Realtime as invalidation trigger only

Use one Realtime channel per high-frequency table (voo, voo_ligado), subscribe to INSERT/UPDATE/DELETE, and call `invalidateQueries` on receipt. Do NOT use the payload — fetch fresh data through the normal query path.

```js
// In a custom hook, e.g. useVoosRealtime(empresaId):
useEffect(() => {
  const channel = supabase
    .channel(`voos-${empresaId}`)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'voo', filter: `empresa_id=eq.${empresaId}` },
      () => queryClient.invalidateQueries({ queryKey: ['voos', empresaId] })
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}, [empresaId, queryClient]);
```

**Why not use the payload directly:** Supabase Postgres Changes sends the full row on each event. Using `invalidateQueries` instead means the data flows through the same path as all other fetches (with column selection, filtering, pagination), rather than arriving as a raw full-row object that must be manually merged into state.

### Pattern 6: Supabase index_advisor for slow queries

For any query that takes more than 200ms, run `index_advisor` in the Supabase dashboard:

```sql
-- In Supabase SQL editor:
select * from index_advisor('
  select * from voo
  where empresa_id = ''uuid-here''
  and data_operacao >= ''2026-01-01''
  order by data_operacao desc
  limit 200
');
```

Key indexes already likely needed based on current query patterns:
- `voo(empresa_id, data_operacao DESC)` — composite for the main Operacoes list
- `calculo_tarifa(empresa_id)` — Operacoes fetchCalculoMap scans the full table
- `voo_ligado(empresa_id)` — same pattern
- `voo(deleted_at)` — soft-delete filter applied globally

### Pattern 7: RLS auth.uid() performance fix

Supabase's RLS performance guide confirms that bare `auth.uid()` calls in RLS policies cause an "initPlan" re-evaluation on every row. Wrap them with `select`:

```sql
-- Slow (auth.uid() re-evaluated per row):
CREATE POLICY "tenant_isolation" ON voo
  FOR ALL USING (empresa_id = (
    SELECT empresa_id FROM users WHERE auth_id = auth.uid()
  ));

-- Fast (evaluated once per statement):
CREATE POLICY "tenant_isolation" ON voo
  FOR ALL USING (empresa_id = (
    SELECT empresa_id FROM users WHERE auth_id = (select auth.uid())
  ));
```

This is a Supabase migration change, not a JS change. Apply to the most frequently queried tables: `voo`, `voo_ligado`, `calculo_tarifa`, `proforma`.

---

## TanStack Query v5 Config Tuning

The existing `query-client.js` has reasonable defaults. Adjust for the app's connectivity profile:

```js
// src/lib/query-client.js — tuned for Angola connectivity
export const queryClientInstance = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 3,       // 3 min — slightly longer given slow network
      gcTime: 1000 * 60 * 15,          // 15 min — keep cache warm between navigation
      refetchOnWindowFocus: false,      // keep — avoid surprises on tab switch
      refetchOnReconnect: true,         // add — refetch when network returns
      networkMode: 'offlineFirst',      // add — use cache while offline instead of error
      retry: 2,
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 10000),
    },
    mutations: {
      retry: 1,
      networkMode: 'offlineFirst',
    },
  },
});
```

**Key change — `networkMode: 'offlineFirst'`:** In TanStack Query v5, this mode means queries return cached data immediately even when the network is unavailable, instead of throwing a network error. On a slow/intermittent connection, the user sees data instantly from cache while the background refetch proceeds. Without this, a slow network causes queries to hang in `fetching` state before showing cached data.

---

## Sources

- [TanStack Query v5 — Query Invalidation](https://tanstack.com/query/v5/docs/react/guides/query-invalidation) — HIGH confidence (official docs)
- [TanStack Query v5 — Optimistic Updates](https://tanstack.dev/query/v5/docs/framework/react/guides/optimistic-updates) — HIGH confidence (official docs)
- [TanStack Query v5 — DevTools](https://tanstack.com/query/v5/docs/framework/react/devtools) — HIGH confidence (official docs)
- [Supabase — Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes) — HIGH confidence (official docs)
- [Supabase — RLS Performance and Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) — HIGH confidence (official Supabase troubleshooting docs)
- [Supabase — Query Optimization](https://supabase.com/docs/guides/database/query-optimization) — HIGH confidence (official docs)
- [Supabase — index_advisor extension](https://supabase.com/docs/guides/database/extensions/index_advisor) — HIGH confidence (official docs)
- [Supabase — Performance and Security Advisors (RLS initplan lint)](https://supabase.com/docs/guides/database/database-advisors?queryGroups=lint&lint=0003_auth_rls_initplan) — HIGH confidence (official docs)
- [Vite manualChunks code splitting 2025](https://www.mykolaaleksandrov.dev/posts/2025/10/react-lazy-suspense-vite-manualchunks/) — MEDIUM confidence (community, verified against Vite docs)
- [How to Use Supabase with TanStack Query](https://makerkit.dev/blog/saas/supabase-react-query) — MEDIUM confidence (community tutorial, patterns match official docs)
