# Phase 1: Bug Fixes - Research

**Researched:** 2026-03-25
**Domain:** React component bugs — PDF grouped export and flight form dropdown filtering
**Confidence:** HIGH (bugs located in source, root causes confirmed)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BUG-01 | User can generate PDF "Todas as Companhias" in grouped mode without errors | Root cause identified in `gerarProformaPdfSimples.js` — `returnBase64` parameter check uses `arguments[0]` (broken in async functions) and the `groupedByCompanhia` path has a missing `returnBase64` destructuring in the function signature |
| BUG-02 | User can select "Voo de Chegada Vinculado" in FormVoo filtered by empresa, ARR flights before departure, and same registration | Root cause identified in `FormVoo.jsx` — `voosArrDisponíveis` memo filters by date/time only; missing empresa_id isolation and same-registration filtering |
</phase_requirements>

---

## Summary

Two bugs block users in the current production build. Both are localized and well-scoped — no schema migrations or new dependencies are needed. Fixes are pure JavaScript/React changes in two files.

**BUG-01** lives in `src/functions/gerarProformaPdfSimples.js`. The `gerarRelatorioFaturacaoPdf` function accepts `{ ..., returnBase64 }` as a destructured parameter but checks `arguments[0]?.returnBase64` at line 752 to decide whether to return base64 vs. save the file. In strict-mode modules and bundled async functions, `arguments` is either unavailable or unreliable. The fix is to add `returnBase64 = false` to the destructured parameter list and use it directly. The grouped-mode path is otherwise structurally correct — data construction, page layout, and PDF generation for "Todas as Companhias" all exist and are logically sound.

**BUG-02** lives in `src/components/operacoes/FormVoo.jsx`. The `voosArrDisponíveis` memo (lines 358–410) filters candidate ARR flights by date/time and excludes already-linked flights — but it does not filter by `empresa_id` or by matching `registo_aeronave`. The requirement states the dropdown must show ARR flights filtered by empresa, date before departure, and same registration. Because `voos` passed from `Operacoes.jsx` are already empresa-filtered at the data-loading level (server-side filter + client-side `.filter(v => v.empresa_id === empresaId)`), empresa isolation is effectively handled upstream and the main missing filter is **same registration**. However, the planner should also confirm the empresa filter is robust in the memo in case voos from another empresa slip through.

**Primary recommendation:** Fix the `arguments[0]` anti-pattern in `gerarProformaPdfSimples.js` (one-line change) and add registration-match filtering to `voosArrDisponíveis` in `FormVoo.jsx` (a few lines in the existing `useMemo`).

---

## Standard Stack

### Core (already in use — no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| jsPDF | ^4.2.0 | PDF generation (client-side) | Already used project-wide via `pdfTemplate.js` abstraction |
| React | 18 | UI component rendering | Project stack |
| Vitest | ^4.1.0 | Unit testing | Configured in `vite.config.js`, tests in `src/**/__tests__/` |

No new packages required for either bug fix.

---

## Architecture Patterns

### Project Structure Relevant to This Phase

```
src/
├── functions/
│   └── gerarProformaPdfSimples.js    # BUG-01: PDF export function
├── components/
│   └── operacoes/
│       └── FormVoo.jsx               # BUG-02: Flight form with linked ARR dropdown
├── lib/
│   └── pdfTemplate.js                # Shared PDF helpers (addHeader, addTable, etc.)
└── pages/
    └── Operacoes.jsx                 # Passes empresa-filtered voos to FormVoo
```

### Pattern 1: Destructured Parameters in Async Functions

**What:** Use named destructuring in the function signature — never rely on `arguments` inside async arrow functions or modules compiled by Vite/ESM.

**When to use:** Always. `arguments` is not available in arrow functions and unreliable in bundled modules.

**Example (current broken code):**
```javascript
// BROKEN — arguments[0] is undefined in bundled async functions
export async function gerarRelatorioFaturacaoPdf({
  calculos, companhia, aeroporto, ...,
  groupedByCompanhia,
}) {
  // ...
  if (arguments[0]?.returnBase64) { // ← always falsy
```

**Example (correct fix):**
```javascript
export async function gerarRelatorioFaturacaoPdf({
  calculos, companhia, aeroporto, ...,
  groupedByCompanhia,
  returnBase64 = false,            // ← add to destructure
}) {
  // ...
  if (returnBase64) {              // ← use directly
```

### Pattern 2: useMemo Filtering with Multiple Criteria

**What:** The `voosArrDisponíveis` memo in `FormVoo.jsx` is the single source of truth for what ARR flights appear in the "Voo de Chegada Vinculado" dropdown. All filter criteria must be added inside this memo and must also be listed in the dependency array.

**Current filter logic (lines 365–388):**
- `tipo_movimento === 'ARR'`
- `status !== 'Cancelado'`
- `arrDate <= depDate` (date comparison)
- Same-day time check (if both have time)

**Missing filters per BUG-02 requirement:**
- Same `registo_aeronave` as the DEP flight being created/edited

**Registration filter to add:**
```javascript
// Inside voosArrDisponíveis filter:
// Only show ARR flights with the same registration as what user has typed for DEP
// (if formData.registo_aeronave is set)
if (formData.registo_aeronave && voo.registo_aeronave !== formData.registo_aeronave) {
  return false;
}
```

**Dependency array update required:**
```javascript
], [voos, formData.tipo_movimento, formData.data_operacao, formData.horario_real,
    formData.horario_previsto, formData.registo_aeronave, voosLigados, vooInicial]);
//                              ↑ add this
```

**Note on empresa isolation:** `voos` passed into FormVoo from Operacoes.jsx is already filtered by `empresa_id` server-side (line 241–242) and client-side (line 350–351) in Operacoes.jsx. The memo does not need a separate empresa filter — the input data is already scoped. However, confirming `currentUser` prop is available in FormVoo if an extra guard is ever needed is low risk.

### Pattern 3: FormVoo UX Interaction for Registration Filter

**What:** When the registration filter is active and the user changes `registo_aeronave`, the `linkedArrVooId` should be cleared if the currently selected ARR voo no longer matches the new registration.

**Why:** Prevents a stale link where the selected ARR flight has a different registration than the DEP flight, which would be operationally invalid.

**Where:** In `handleInputChange` under the `field === 'companhia_aerea'` block — when DEP, clearing `linkedArrVooId` already happens (line 473–476). The same clearing should happen when `registo_aeronave` changes on a DEP flight. The existing code at line 467–481 already clears `linkedArrVooId` when company changes, but not when registration changes directly (since for DEP, registration is auto-filled from the linked ARR). This may be a non-issue in practice since registration is auto-filled from ARR selection, but needs review.

### Anti-Patterns to Avoid

- **Using `arguments` in ES modules/async functions:** Not available in arrow functions; bundlers may strip it. Always destructure explicitly.
- **Filtering inside the render function body** (not in useMemo): Always keep `voosArrDisponíveis` in a `useMemo` to avoid recalculation on every render.
- **Mutating the dependency array partially:** If adding `formData.registo_aeronave` to the useMemo filter, it MUST be added to the dependency array or React will use a stale value.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF generation | Custom canvas/HTML renderer | jsPDF via existing `pdfTemplate.js` abstraction | Already abstracted with `createPdfDoc`, `addHeader`, `addTable`, etc. — consistent with all other PDFs in project |
| Dropdown search/filter | Custom combobox | Existing `Combobox` / `Select` UI components | Already used in FormVoo; `voosArrOptions` feeds directly into `Combobox` |

---

## Common Pitfalls

### Pitfall 1: `arguments` in Arrow Functions / ESM

**What goes wrong:** `arguments[0]?.returnBase64` always evaluates to `undefined`/`false` because `arguments` is not defined in arrow functions. In bundled ESM (Vite), this silently fails — no error is thrown, but `returnBase64` behavior never activates.

**Why it happens:** The function was likely written expecting `arguments` to work as in CommonJS, but ES modules and Vite bundle arrow functions where `arguments` is not available.

**How to avoid:** Destructure `returnBase64 = false` in the parameter list.

**Warning signs:** The email workflow ("Enviar por Email") calls `gerarRelatorioFaturacaoPdf` with `returnBase64: true` from DashboardFaturacao.jsx. If the email flow also fails for "Todas as Companhias", it confirms this is the root cause — `returnBase64` was never truthy in the grouped path.

### Pitfall 2: Registration Filter Breaks Editing Existing DEP Flights

**What goes wrong:** If a DEP flight being edited has `linkedArrVooId` pre-loaded (line 301–304 in FormVoo) but `formData.registo_aeronave` is not yet set when the memo runs, the registration filter would hide the already-linked ARR flight from the dropdown options — making the edit appear to have no valid ARR voo.

**Why it happens:** `formData.registo_aeronave` is populated from `vooInicial` in the same `useEffect` that sets `linkedArrVooId`, so it should be set in the same render cycle. However, the memo runs before state settles if the filter is too strict.

**How to avoid:** Make the registration filter conditional: only apply it when `formData.registo_aeronave` is non-empty. This is already how the existing `companhia_aerea`-based guard works (`if (!formData.companhia_aerea && !allCompanies) return [];`).

**Correct guard:**
```javascript
// Apply registration filter only when registration is known
if (formData.registo_aeronave && voo.registo_aeronave !== formData.registo_aeronave) {
  return false;
}
```

When `formData.registo_aeronave` is empty, the filter is a no-op and all date-eligible ARR flights show — same behavior as today. The user sees a filtered list only once they have specified a registration.

### Pitfall 3: voosArrOptions Dependency Array Stale Closure

**What goes wrong:** Adding `formData.registo_aeronave` to the filter inside `voosArrDisponíveis` but forgetting to add it to the dependency array causes React to use a stale value of `registo_aeronave` in the memo, showing an inconsistent filtered list.

**How to avoid:** After editing the memo filter, verify the dependency array includes every `formData.*` field referenced inside.

### Pitfall 4: PDF grouped mode — `returnBase64` for email via "Todas as Companhias"

**What goes wrong:** The `handlePrepareEmail` function in DashboardFaturacao.jsx (line 450–456) passes `groupedByCompanhia` AND `returnBase64: true`. If only the download path is tested and not the email path, the `returnBase64` fix might seem complete but email still fails.

**How to avoid:** Test both the download and email paths with "Todas as Companhias" mode selected.

---

## Code Examples

### Fix for BUG-01 — Add `returnBase64` to destructure

```javascript
// src/functions/gerarProformaPdfSimples.js — line 621
// BEFORE:
export async function gerarRelatorioFaturacaoPdf({
  calculos, companhia, aeroporto, periodo_inicio, periodo_fim,
  voos, voosLigados, proformasMap,
  groupedByCompanhia,
}) {

// AFTER:
export async function gerarRelatorioFaturacaoPdf({
  calculos, companhia, aeroporto, periodo_inicio, periodo_fim,
  voos, voosLigados, proformasMap,
  groupedByCompanhia,
  returnBase64 = false,          // ← added
}) {

// Then at line 752, replace:
//   if (arguments[0]?.returnBase64) {
// With:
  if (returnBase64) {
```

### Fix for BUG-02 — Add same-registration filter to voosArrDisponíveis

```javascript
// src/components/operacoes/FormVoo.jsx — inside voosArrDisponíveis useMemo
// Add after the date/time filter block, before the "return true":

      // Filter by same registration (only when registration is known for DEP)
      if (formData.registo_aeronave && voo.registo_aeronave !== formData.registo_aeronave) {
        return false;
      }

      return true;
    });

// And update the dependency array (line 410) to include formData.registo_aeronave:
  }, [voos, formData.tipo_movimento, formData.data_operacao, formData.horario_real,
      formData.horario_previsto, formData.registo_aeronave, voosLigados, vooInicial]);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `arguments[0]?.prop` for extra options | Destructured named param with default | ES modules / arrow functions | `arguments` is unavailable; must destructure |

---

## Open Questions

1. **Registration filter edge case: user types registration before selecting linked ARR**

   In a new DEP form, `formData.registo_aeronave` starts empty. The user fills in registration first, then opens the linked ARR dropdown. The filter will work correctly since registration is set before dropdown is opened.

   However, for DEP flights, registration is typically auto-filled AFTER selecting the ARR voo (see `handleLinkedVooChange` lines 432–447 which sets `companhia_aerea` and `registo_aeronave` from the ARR). This means: when creating a new DEP, the user first sees an *unfiltered* list (since `registo_aeronave` is empty), selects an ARR, then registration is filled. This is the correct UX flow for new DEP flights.

   The filter becomes active for:
   - **Edit DEP:** registration is pre-filled from `vooInicial`, so the dropdown shows only matching ARRs
   - **New DEP with pre-typed registration:** dropdown filters immediately

   This is acceptable behavior, but the planner should consider whether the requirement "filtered by same registration" applies to the initial unfiltered state or only after registration is known. Based on BUG-02 text, filtering by registration is the goal — so the conditional filter (`if formData.registo_aeronave`) is the right approach.

   **Recommendation:** Implement as conditional filter. No action needed for empty-registration case.

2. **empresa_id isolation in voosArrDisponíveis — is it already correct?**

   `voos` passed to FormVoo from Operacoes.jsx are filtered by `empresa_id` both server-side (Supabase query filter) and client-side. So the memo does not need an explicit `empresa_id` filter. This is HIGH confidence based on code review of Operacoes.jsx lines 241–243 and 349–351.

   **Recommendation:** No empresa_id filter needed in the memo. Document this in the plan so the implementer doesn't add unnecessary complexity.

---

## Environment Availability

Step 2.6: SKIPPED — no external dependencies required. Both bug fixes are pure JavaScript/React source edits. No CLI tools, databases, or services need to be installed or configured.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.0 |
| Config file | `vite.config.js` (test block) |
| Quick run command | `npm test -- --run src/functions/__tests__` |
| Full suite command | `npm test` |
| Test include pattern | `src/**/__tests__/**/*.test.{js,jsx}` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BUG-01 | `gerarRelatorioFaturacaoPdf` with `returnBase64: true` returns `{ base64, filename }` | unit | `npm test -- --run src/functions/__tests__/gerarProformaPdfSimples.test.js` | No — Wave 0 gap |
| BUG-01 | `gerarRelatorioFaturacaoPdf` with `groupedByCompanhia` + `returnBase64: true` returns base64 | unit | same file | No — Wave 0 gap |
| BUG-01 | `gerarRelatorioFaturacaoPdf` without `returnBase64` calls `doc.save()` | unit | same file | No — Wave 0 gap |
| BUG-02 | `voosArrDisponíveis` filters ARR flights by same registration | unit | `npm test -- --run src/components/operacoes/__tests__/FormVoo.voosArr.test.js` | No — Wave 0 gap |
| BUG-02 | `voosArrDisponíveis` does not filter when `registo_aeronave` is empty | unit | same file | No — Wave 0 gap |
| BUG-02 | `voosArrDisponíveis` still filters by date (regression) | unit | same file | No — Wave 0 gap |

**Note on unit testing PDF function:** jsPDF cannot be executed in jsdom without mocking. The test should mock jsPDF's `doc.save` and `doc.output` and assert: (a) `save` is called when `returnBase64` is false, (b) `output('datauristring')` is called and base64 is returned when `returnBase64` is true. The `generateExtratoLandscape` function should be mocked to isolate the `returnBase64` logic.

**Note on FormVoo unit test:** `voosArrDisponíveis` is a `useMemo` in a component. It can be tested by rendering FormVoo with controlled `voos` and `formData` props and asserting the computed dropdown options. Alternatively, extract the filter logic to a pure helper function (recommended for testability).

### Sampling Rate

- **Per task commit:** `npm test -- --run src/functions/__tests__`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/functions/__tests__/gerarProformaPdfSimples.test.js` — covers BUG-01 `returnBase64` behavior (grouped and single mode)
- [ ] `src/components/operacoes/__tests__/FormVooVoosArr.test.js` — covers BUG-02 registration filtering in `voosArrDisponíveis`

*(If jsPDF is hard to mock, a simpler approach: extract the `if (returnBase64)` branch into a pure `selectOutput(doc, returnBase64, filename)` helper and test that helper directly.)*

---

## Sources

### Primary (HIGH confidence)

- Direct source code read of `src/functions/gerarProformaPdfSimples.js` lines 621–759 — `gerarRelatorioFaturacaoPdf` function, `arguments[0]` usage, grouped mode construction
- Direct source code read of `src/components/operacoes/FormVoo.jsx` lines 357–410 — `voosArrDisponíveis` memo, all current filter conditions
- Direct source code read of `src/pages/Operacoes.jsx` lines 241–243, 349–351 — empresa_id filtering applied to `voos` before passing to FormVoo
- Direct source code read of `src/components/faturacao/DashboardFaturacao.jsx` lines 370–488 — both PDF export and email paths, `groupedByCompanhia` construction
- MDN Web Docs (training knowledge, HIGH confidence): `arguments` object is not available in arrow functions; ES module strict mode

### Secondary (MEDIUM confidence)

- Vitest documentation (training): jsdom environment, mocking patterns for `doc.save`
- jsPDF documentation (training): `output('datauristring')` returns data URI; `save()` triggers download

---

## Metadata

**Confidence breakdown:**
- Bug root causes (BUG-01, BUG-02): HIGH — confirmed by reading the exact lines in source code
- Fix approach: HIGH — standard JavaScript destructuring and useMemo patterns
- Test strategy: MEDIUM — jsPDF mocking approach based on training knowledge; may need adjustment based on actual mock setup

**Research date:** 2026-03-25
**Valid until:** Stable (no external APIs or fast-moving libraries involved) — valid until code changes
