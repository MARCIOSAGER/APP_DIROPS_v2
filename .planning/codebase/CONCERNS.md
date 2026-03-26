# Codebase Concerns

**Analysis Date:** 2026-03-26

## Tech Debt

**Monolithic i18n File (11,895 lines):**
- Issue: All translations for both languages (PT/EN) live in a single file with inline objects
- Files: `src/components/lib/i18n.jsx`
- Impact: Extremely slow to edit, impossible to parallelize translation work, IDE performance degrades. Any translation change touches this massive file in diffs.
- Fix approach: Split into `src/i18n/pt.json` and `src/i18n/en.json` with namespace-based organization. Use a standard i18n library (react-i18next) or at minimum split into per-namespace files.

**Oversized Page Components (God Components):**
- Issue: Many page components exceed 1000 lines, mixing data fetching, business logic, and UI rendering in a single file
- Files:
  - `src/pages/Operacoes.jsx` (3,038 lines)
  - `src/pages/GestaoNotificacoes.jsx` (2,991 lines)
  - `src/pages/GestaoAcessos.jsx` (1,511 lines)
  - `src/pages/Auditoria.jsx` (1,477 lines)
  - `src/pages/KPIsOperacionais.jsx` (1,421 lines)
  - `src/pages/ImportacaoAiaan.jsx` (1,331 lines)
  - `src/pages/FlightAware.jsx` (1,268 lines)
  - `src/pages/ConfiguracaoTarifas.jsx` (1,076 lines)
  - `src/components/operacoes/FormVoo.jsx` (1,907 lines)
  - `src/components/operacoes/TariffDetailsModal.jsx` (1,130 lines)
- Impact: Hard to maintain, test, or reuse logic. Changes risk unintended side effects. Code review is painful.
- Fix approach: Extract data-fetching into custom hooks, business logic into service modules, and break UI into smaller sub-components. Pages should orchestrate, not implement.

**No Server-Side Pagination Used:**
- Issue: `_createEntity.js` has a `paginate()` method but it is never called anywhere in the codebase (0 usages). Instead, pages use `.list()` and `.filter()` which call `fetchAll()` loading all rows in 500-row batches.
- Files: `src/entities/_createEntity.js` (paginate method at line 194), all pages using `.list()`/`.filter()`
- Impact: As data grows, every page load fetches ALL records. This wastes bandwidth, slows rendering, and will become unusable with thousands of records.
- Fix approach: Migrate page-level data loading to use `.paginate()` with server-side pagination, sorting, and filtering. Start with `src/pages/Operacoes.jsx` (40+ `.list()`/`.filter()` calls).

**Hardcoded Fallback Data:**
- Issue: `Credenciamento.jsx` has hardcoded airport and access area data as a fallback for company managers
- Files: `src/pages/Credenciamento.jsx` (lines 42-54)
- Impact: Stale data if airports change, inconsistent behavior between user roles
- Fix approach: Query the database for minimal data even for company managers; remove hardcoded arrays.

**Hardcoded System Email:**
- Issue: `FormReclamacao.jsx` uses hardcoded `sistema@sga.co.ao` email instead of deriving from context
- Files: `src/components/reclamacoes/FormReclamacao.jsx` (line 88)
- Impact: Cannot change system email without code change
- Fix approach: Pull system email from `configuracao_sistema` table or environment config.

**React Query Underutilized:**
- Issue: TanStack Query (react-query) is installed and configured but only used in ~10 files. The vast majority of pages (48 pages) still use manual `useEffect` + `useState` for data fetching with no caching, deduplication, or background refetching.
- Files: `src/lib/query-client.js`, `src/hooks/useVoos.js`, `src/hooks/useDashboardStats.js` (using it) vs all pages in `src/pages/` (not using it)
- Impact: Redundant data fetching, no stale-while-revalidate, manual loading/error state management duplicated across every page
- Fix approach: Gradually migrate page-level data loading to `useQuery` hooks, starting with most-accessed pages.

## Known Bugs

**Silent Error Swallowing:**
- Symptoms: Operations may fail silently without user feedback
- Files:
  - `src/pages/Operacoes.jsx` (lines 1020, 1038, 1070, 1205) - 4 instances of `catch (_) {}`
  - `src/pages/Proforma.jsx` (line 369) - `catch (_) {}`
- Trigger: Any error in the caught operations is silently discarded
- Workaround: None currently. Errors are invisible.

## Security Considerations

**Plaintext Password Comparison:**
- Risk: Password validation for document/folder protection compares password hash directly with plaintext input (`senha_hash === senha`)
- Files: `src/functions/validarSenhaItem.js` (line 20)
- Current mitigation: None. The TODO comment acknowledges this needs bcrypt.
- Recommendations: Move to a Supabase Edge Function using bcrypt. Never store or compare passwords in plaintext on the client.

**dangerouslySetInnerHTML Usage:**
- Risk: XSS vulnerabilities if sanitization is bypassed or incomplete
- Files:
  - `src/pages/GestaoNotificacoes.jsx` (4 instances, lines 2454, 2508, 2585, 2622) - uses `sanitizeHtml()` from DOMPurify
  - `src/components/shared/ChatbotIA.jsx` (line 153) - uses custom `renderMessage()` with `sanitizeHtml()`
  - `src/components/reclamacoes/EmailPreviewModal.jsx` (line 24) - uses `sanitizeHtml()`
  - `src/components/ui/chart.jsx` (line 61) - injects CSS via innerHTML (low risk, generated content)
- Current mitigation: DOMPurify sanitization is applied in most places via `src/lib/sanitize.js`
- Recommendations: The ChatbotIA `renderMessage` does HTML entity escaping before DOMPurify, which is correct. Audit any new `dangerouslySetInnerHTML` usage to ensure `sanitizeHtml()` is always applied.

**Console Logging in Production (154 occurrences):**
- Risk: Sensitive data (user info, API responses, errors) logged to browser console visible to any user
- Files: 30 files across the codebase, heaviest in:
  - `src/pages/Operacoes.jsx` (43 occurrences)
  - `src/pages/GestaoNotificacoes.jsx` (21 occurrences)
  - `src/pages/Manutencao.jsx` (10 occurrences)
  - `src/pages/Auditoria.jsx` (9 occurrences)
- Current mitigation: None
- Recommendations: Strip `console.log`/`console.warn` in production builds via Vite config (`esbuild.drop: ['console']`), or replace with a proper logging utility that respects environment.

**eslint-disable for React Hooks Rules:**
- Risk: Suppressed dependency warnings can cause stale closures and bugs
- Files:
  - `src/pages/Operacoes.jsx` (line 237) - `eslint-disable-line react-hooks/exhaustive-deps`
  - `src/pages/SolicitacaoPerfil.jsx` (line 47) - `eslint-disable-line react-hooks/exhaustive-deps`
  - `src/pages/ServicosAeroportuarios.jsx` (line 129) - `eslint-disable-next-line react-hooks/exhaustive-deps`
- Current mitigation: None
- Recommendations: Fix the dependency arrays properly or extract to `useCallback` with correct deps.

## Performance Bottlenecks

**Fetch-All-Rows Pattern:**
- Problem: Every page loads complete database tables into memory via `fetchAll()` (500-row batches until exhausted)
- Files: `src/entities/_createEntity.js` (fetchAll at line 5), 264 `.list()`/`.filter()` calls across 20+ page files
- Cause: The entity layer defaults to fetching all rows. `.paginate()` exists but is unused (0 calls in codebase).
- Improvement path: Implement server-side pagination in pages. Use `.paginate()` for table views. Use `.filter()` with limits for dropdowns/selects.

**i18n Bundle Size:**
- Problem: 11,895 lines of translations loaded synchronously on app startup regardless of language
- Files: `src/components/lib/i18n.jsx`
- Cause: Both PT and EN translations are in one file imported at the top level
- Improvement path: Split by language and lazy-load the non-default language. Or use JSON files with dynamic import.

**Multiple Parallel Unbounded Queries on Page Load:**
- Problem: Pages like `Auditoria.jsx` fire 6+ `.list()` calls simultaneously on mount, each fetching entire tables
- Files: `src/pages/Auditoria.jsx` (lines 185-192), `src/pages/Operacoes.jsx` (line 225+)
- Cause: No data caching layer, each page independently fetches its data
- Improvement path: Use React Query with shared cache keys so reference data (airports, companies, users) is fetched once and reused.

## Fragile Areas

**Operacoes Page (3,038 lines):**
- Files: `src/pages/Operacoes.jsx`
- Why fragile: Contains flight CRUD, linking/unlinking logic, tariff calculations, PDF generation triggers, proforma creation, bulk operations, filtering, and table rendering all in one file. 9 `useEffect` hooks, 40+ entity calls, 43 console.log statements.
- Safe modification: Extract individual features into hooks/sub-components before modifying. Test tariff calculations separately.
- Test coverage: Partial - `src/components/operacoes/__tests__/FormVooVoosArr.test.js` covers only arrival form validation.

**GestaoNotificacoes Page (2,991 lines):**
- Files: `src/pages/GestaoNotificacoes.jsx`
- Why fragile: Manages notification rules, templates, email/WhatsApp/push channels, airport-specific templates, and test sending - all in one component.
- Safe modification: Split into tab-specific sub-components (rules, templates, channels, testing).
- Test coverage: None.

**Tariff Calculation Engine:**
- Files: `src/components/lib/tariffCalculations.jsx` (979 lines), `src/components/operacoes/TariffDetailsModal.jsx` (1,130 lines)
- Why fragile: Complex tiered/cumulative tariff logic with many edge cases. Business-critical for billing.
- Safe modification: Has test coverage at `src/components/lib/__tests__/tariffCalculators.test.js` and `src/components/lib/__tests__/tariffCache.test.js`. Always run tests after changes.
- Test coverage: Partial (calculators and cache tested, but not the full flow through TariffDetailsModal).

## Scaling Limits

**Client-Side Data Loading:**
- Current capacity: Works with hundreds of records per table
- Limit: Will degrade with 5,000+ flights, 1,000+ proformas, or large audit logs
- Scaling path: Implement server-side pagination via the existing `paginate()` method. Add database indexes (migration 055 addresses some).

**Single i18n Context:**
- Current capacity: 2 languages, ~5,900 keys each
- Limit: Adding a third language doubles the bundle further
- Scaling path: Switch to JSON-based translations with lazy loading per language.

## Dependencies at Risk

**base44Client Compatibility Layer:**
- Risk: `src/api/base44Client.js` is a Proxy-based compatibility layer from the Base44 BaaS migration. It adds indirection and confusion about which API layer is being used.
- Impact: Developers may use `base44.entities.X` in some places and direct `Entity.method()` in others, creating inconsistency.
- Migration plan: Remove the compatibility layer and use entities directly everywhere. Grep for `base44.entities` usage and replace.

## Missing Critical Features

**Minimal Test Coverage:**
- Problem: Only 9 test files exist for 407 source files (~2.2% file coverage). No integration tests, no E2E tests.
- Test files:
  - `src/components/lib/__tests__/tariffCache.test.js`
  - `src/components/lib/__tests__/tariffCalculators.test.js`
  - `src/components/lib/__tests__/userUtils.test.js`
  - `src/components/operacoes/__tests__/FormVooVoosArr.test.js`
  - `src/entities/__tests__/createEntity.test.js`
  - `src/functions/__tests__/gerarProformaPdfSimples.test.js`
  - `src/lib/__tests__/errorUtils.test.js`
  - `src/lib/__tests__/queryClient.test.js`
  - `src/lib/__tests__/sanitize.test.js`
- Blocks: Confident refactoring of large components, catching regressions in business logic

**No Error Boundary Granularity:**
- Problem: `src/App.jsx` has a top-level `ChunkErrorBoundary` for code-splitting errors but no page-level error boundaries
- Blocks: A crash in any page component takes down the entire app instead of showing a localized error

## Test Coverage Gaps

**Pages (0% coverage):**
- What's not tested: All 48 page components have zero test coverage
- Files: All files in `src/pages/`
- Risk: UI regressions, broken data flows, form validation bugs go unnoticed
- Priority: High for `Operacoes.jsx`, `Proforma.jsx`, `GestaoAcessos.jsx` (critical business flows)

**Authentication Flow:**
- What's not tested: Login, signup, password reset, session management, role-based access
- Files: `src/lib/AuthContext.jsx`, `src/pages/Login.jsx`, `src/pages/AlterarSenha.jsx`
- Risk: Auth bugs can lock users out or grant unauthorized access
- Priority: High

**Entity Layer (partial coverage):**
- What's not tested: Only `createEntity` base is tested. Individual entity modules and their specific filter/sort patterns are not.
- Files: `src/entities/` (all entity files except `_createEntity.js`)
- Risk: Entity-specific quirks or filter bugs
- Priority: Medium

**Edge Functions:**
- What's not tested: No tests for edge function invocation or response handling
- Files: `src/functions/` (all except `gerarProformaPdfSimples.js` which has tests)
- Risk: Email sending, API integrations, FlightAware imports could break silently
- Priority: Medium

---

*Concerns audit: 2026-03-26*
