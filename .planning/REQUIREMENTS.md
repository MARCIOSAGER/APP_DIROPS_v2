# Requirements: v1.2 Performance

**Defined:** 2026-03-25
**Core Value:** Operations teams can manage flights end-to-end in a single unified system.

## Cache Correctness

- [x] **CACHE-01**: Cache keys include empresa_id so tenant switching shows correct data immediately
- [x] **CACHE-02**: Query cache is cleared on logout so no cross-user data leakage occurs
- [x] **CACHE-03**: Pages read user data from AuthContext instead of calling User.me() per page

## Query Optimization

- [ ] **QUERY-01**: Entity factory supports column-selective queries (not select('*') on large tables)
- [ ] **QUERY-02**: Home dashboard uses single RPC call instead of 3 redundant stat fetches
- [ ] **QUERY-03**: Operacoes removes duplicate tarifas fetch (useStaticData + loadData)

## Cache Integration

- [ ] **INTEG-01**: High-traffic pages (Operacoes, Home) use TanStack Query hooks with proper staleTime
- [ ] **INTEG-02**: All flight mutations trigger queryClient.invalidateQueries — no manual refresh needed
- [ ] **INTEG-03**: Remaining pages migrated from useEffect to TanStack Query hooks

## Database Performance

- [ ] **DB-01**: Composite indexes added for primary query patterns on voo, calculo_tarifa, voo_ligado

## Resilience

- [ ] **RES-01**: ErrorBoundary wraps React.lazy to recover from ChunkLoadError after deploys
- [x] **RES-02**: Supabase client has fetch timeout (15s) to prevent hung requests

## Future Requirements

- Supabase Realtime subscriptions for multi-tab sync (deferred — post-mutation invalidation solves the refresh problem first)
- Virtual scrolling for tables with 1000+ rows (deferred — server-side pagination is sufficient)
- Service Worker / PWA offline support (deferred — not needed for airport ops environment)

## Out of Scope

- Framework migration (Next.js, Remix) — React 18 + Vite 6 is sufficient
- State management library (Redux, Zustand) — TanStack Query covers server state
- GraphQL — Supabase REST + RPC covers all query needs

## Traceability

| REQ-ID | Phase | Plan | Status |
|--------|-------|------|--------|
| CACHE-01 | Phase 6 | — | Pending |
| CACHE-02 | Phase 6 | — | Pending |
| CACHE-03 | Phase 6 | — | Pending |
| RES-02 | Phase 6 | — | Pending |
| QUERY-01 | Phase 7 | — | Pending |
| QUERY-02 | Phase 7 | — | Pending |
| QUERY-03 | Phase 7 | — | Pending |
| INTEG-01 | Phase 8 | — | Pending |
| INTEG-02 | Phase 8 | — | Pending |
| INTEG-03 | Phase 9 | — | Pending |
| RES-01 | Phase 9 | — | Pending |
| DB-01 | Phase 10 | — | Pending |
