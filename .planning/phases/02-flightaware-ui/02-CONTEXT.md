# Phase 2: FlightAware UI - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can identify FlightAware-sourced flights, spot missing data, detect duplicates, and update existing flights from the import flow. This phase delivers visual badges on the flight list, a "real flights" filter on the cache list, duplicate detection warnings in the import modal, and a field-level merge flow for updating existing flights with FlightAware data.

</domain>

<decisions>
## Implementation Decisions

### Badge Design & Placement
- **D-01:** "Dados FlightAware" badge uses **blue info style** (border-blue-400 text-blue-700 bg-blue-50) to differentiate from the amber warning badges ("Verificar Registo", "Verificar Horarios")
- **D-02:** All 3 badges can stack simultaneously on a single flight row — warnings do NOT hide the FA origin badge
- **D-03:** Existing "Verificar Registo" badge (amber, outline, text-[9px]) and "Verificar Horarios" badge (same style) remain as-is — no restyling needed

### Claude's Discretion — Badge Placement
- Claude decides optimal placement for the "Dados FlightAware" badge based on VoosTable layout and available space (user said "you decide")

### Real Flights Filter
- **D-04:** "Apenas voos reais" toggle switch on the CacheVooFlightAwareList filter bar — binary on/off, always visible
- **D-05:** Toggle is **OFF by default** — all cached flights shown initially, user opts in to filter
- **D-06:** "Real flights" definition: `actual_off` OR `actual_on` present in raw_data, AND cancelled flights hidden

### Duplicate Detection UX
- **D-07:** When a duplicate is detected during import, user gets 3 action buttons: "Atualizar Existente" (merge), "Criar Novo" (import as separate), "Cancelar"

### Claude's Discretion — Duplicate Warning Style
- Claude decides the warning presentation (inline banner vs dialog) based on existing modal patterns in the codebase (user said "you decide")

### FA Data Merge Flow
- **D-08:** Before merging, show a **side-by-side field comparison table** — current values vs FA values, highlighting which empty fields will be filled
- **D-09:** User can **cherry-pick fields** to merge via checkboxes — not all-or-nothing
- **D-10:** After successful merge, cache flight status changes to new status **'atualizado'** (distinct from 'importado') for granular tracking
- **D-11:** Merge only fills empty fields — never overwrites existing manual data (backend behavior preserved)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Flight List & Badges
- `src/components/operacoes/VoosTable.jsx` — Main flight table; already has isFA detection (line 208) and verification badges (lines 244, 255)
- `src/components/ui/badge.jsx` — Badge component (Radix UI variant system)

### FlightAware Cache & Import
- `src/components/operacoes/CacheVooFlightAwareList.jsx` — Cache list component; existing filters (status, search, date, airport); needs "real flights" toggle
- `src/components/operacoes/FlightAwareImporter.jsx` — Import flow orchestrator; connects search → review → import
- `src/components/operacoes/VooFlightAwareReviewModal.jsx` — Review modal for import; already does field-by-field comparison for new imports
- `src/components/operacoes/VooFlightAwareComparisonRow.jsx` — Field comparison row component (reusable for merge preview)

### Backend Functions
- `src/functions/importVooFromFlightAwareCache.js` — Import + merge logic; duplicate detection (line 128), field merge (line 138+), ensureCompanhiaAerea, ensureRegistoAeronave
- `src/functions/compareFlightAwareWithVoos.js` — Cross-reference cache vs voo table (matched, missing, reg_mismatch)
- `src/functions/validateAndSuggestFlightAwareCrossCheck.js` — Validation suggestions for import review

### Entity & Data
- `src/entities/CacheVooFlightAware.js` — Cache entity (uses _createEntity factory pattern)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `VooFlightAwareComparisonRow` — Already renders side-by-side field comparisons; can be extended for merge preview
- `VooFlightAwareReviewModal` — Already handles field-by-field selection for new imports; pattern reusable for merge flow
- `Badge` component — Radix UI with variant system, used throughout for status indicators
- `AlertModal` / `SuccessModal` — Shared modals for confirmation/success feedback
- `useI18n` hook — All user-facing strings must use `t()` translation function

### Established Patterns
- Flight detection: `voo.created_by === 'FlightAware' || voo.origem_dados === 'FlightAware'` (VoosTable line 208)
- Cache status values: `pendente`, `importado`, `rejeitado` — new status `atualizado` to be added
- Filter state: individual useState hooks per filter (filtroStatus, filtroBusca, etc.)
- Badge styling: variant="outline" with color-coded bg/text/border classes at text-[9px]

### Integration Points
- VoosTable receives voos as prop from Operacoes.jsx — badge logic is inline in the table render
- CacheVooFlightAwareList fetches from CacheVooFlightAware entity directly
- Import flow: FlightAwareImporter → VooFlightAwareReviewModal → importVooFromFlightAwareCache

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches within the decisions above.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-flightaware-ui*
*Context gathered: 2026-03-25*
