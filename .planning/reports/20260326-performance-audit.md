# Performance Audit — DIROPS-SGA
**Date:** 2026-03-26
**Auditor:** Automated code analysis (Claude Opus 4.6)

## Summary: 3 Critical, 7 High, 4 Medium, 3 Low

## CRITICAL

### D-01: Proforma.list() fetches ALL rows for single-record lookups
- **File:** src/pages/Operacoes.jsx (lines 1505, 1532)
- **Fix:** Use Proforma.filter() or RPC for existence check/max number

### D-02: Multiple pages fetch ALL rows with .list()
- **Offenders:** Auditoria, Manutencao, GestaoAcessos, Lixeira, DashboardFaturacao
- **Fix:** Use .filter() with server-side filtering

### B-01: XLSX (~300KB) statically imported in 3 files
- **Files:** ImportacaoAiaan, ManageChecklistItemsModal (inspecoes + auditoria)
- **Fix:** Dynamic import('xlsx') at button click

## HIGH

### B-02: Operacoes.jsx eagerly imports 15+ modals/panels
- **Fix:** React.lazy() for modals, conditional render with Suspense

### B-03: 8-10 unused dependencies
- **Unused:** @stripe/*, react-leaflet, html2canvas, react-quill, pdf-lib, canvas-confetti, react-markdown
- **Fix:** Remove from package.json

### R-01: Operacoes duplicates TanStack cache into useState (double renders)
- **Fix:** Use TanStack data directly via useMemo

### R-02: Zero React.memo usage across entire codebase
- **Fix:** Wrap list item components rendered in .map()

### D-03: No UI-level pagination for large datasets
- **Fix:** Cursor/offset pagination + react-virtual

### M-01: AppUpdateBanner setInterval never cleared
- **Fix:** Store interval ID, clear in cleanup

### A-01: Operacoes.jsx 3038-line monolith
- **Fix:** Extract VoosTab, VoosLigadosTab, ConfigTab sub-components

## MEDIUM

### D-04: useStaticData hooks fetch unfiltered despite empresa-scoped cache keys
### R-03: Missing useMemo for expensive computations in largest pages
### B-04: recharts not consistently lazy-loaded
### A-02: Sentry loaded eagerly on every page

## LOW

### C-02: Duplicate toast systems (react-hot-toast + sonner)
### I-01: Missing width/height attributes on img tags
### I-02: No loading="lazy" on images

## Top 3 Quick Wins
1. D-01: Replace Proforma.list() with .filter() — immediate query reduction
2. B-01: Dynamic import('xlsx') in 3 files — ~300KB removed from eager load
3. M-01: Add cleanup to setInterval in AppUpdateBanner — prevents memory leak
