# Milestones

## v1.1 Consolidacao e Polimento (Shipped: 2026-03-25)

**Phases completed:** 5 phases, 12 plans, 20 tasks

**Key accomplishments:**

- voosArrDisponíveis now filters ARR flights by aircraft registration match (BUG-02), with exported filterVoosArr pure helper and 3 passing unit tests via TDD
- A. importVooFromFlightAwareCache.js:
- One-liner:
- Centralized all admin role checks across 11 page files into isAdminProfile/isInfraOrAdmin helpers in userUtils.jsx, eliminating 13 inline perfis.includes/role === 'admin' checks
- Added bilingual support (PT/EN) to all 21 remaining operational pages via useI18n hook, completing full coverage across the app
- Commit:
- VoosTable (11 cols) and Proforma table (9 cols) now have explicit min-w Tailwind constraints enabling clean horizontal scroll at narrow viewports instead of collapsing columns
- 1. [Rule 2 - Missing Critical Functionality] Replaced all 3 raw selects in FormSafetyOccurrence
- Consolidated 7-card inline KPI block in Home.jsx into DashboardStats component — single xl:grid-cols-8 grid with text-xs labels, trend indicators on voos/pontualidade, and ligados/sem-link sub-line

---
