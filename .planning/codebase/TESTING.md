# Testing Patterns

**Analysis Date:** 2026-03-26

## Test Framework

**Runner:**
- Vitest 4.1.0
- Config: inline in `vite.config.js` under `test` key
- Environment: `jsdom`
- Globals: `true` (describe/it/expect available without import, but tests explicitly import them)

**Assertion Library:**
- Vitest built-in `expect`
- `@testing-library/jest-dom` 6.9.1 (DOM matchers like `toBeInTheDocument`)
- `@testing-library/react` 16.3.2 (component rendering -- available but minimally used)

**Run Commands:**
```bash
npm test                # Run all tests once (vitest run)
npm run test:watch      # Watch mode (vitest)
```

## Test Configuration

**Setup File:** `src/test/setup.js`
```js
import '@testing-library/jest-dom';

// Mock localStorage (full implementation: getItem, setItem, removeItem, clear, length, key)
const localStorageMock = (() => { /* ... */ })();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

// Mock window.location for redirect URL tests
if (!globalThis.window) globalThis.window = globalThis;
if (!window.location) {
  Object.defineProperty(window, 'location', {
    value: { origin: 'https://example.com', href: 'https://example.com/' },
    writable: true,
  });
}
```

**Environment Variables (test-only):**
```js
// vite.config.js
test: {
  env: {
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'test-anon-key',
  },
}
```

**Include Pattern:** `src/**/__tests__/**/*.test.{js,jsx}`

## Test File Organization

**Location:** Co-located `__tests__/` directories beside the code they test.

**Naming:** `{moduleName}.test.js`

**Structure:**
```
src/
├── lib/
│   ├── __tests__/
│   │   ├── sanitize.test.js         # Tests for src/lib/sanitize.js
│   │   ├── errorUtils.test.js       # Tests for src/lib/errorUtils.js
│   │   └── queryClient.test.js      # Tests for src/lib/query-client.js
│   ├── sanitize.js
│   ├── errorUtils.js
│   └── query-client.js
├── entities/
│   ├── __tests__/
│   │   └── createEntity.test.js     # Tests for src/entities/_createEntity.js
│   └── _createEntity.js
├── components/
│   ├── lib/
│   │   ├── __tests__/
│   │   │   ├── userUtils.test.js        # Tests for src/components/lib/userUtils.jsx
│   │   │   ├── tariffCalculators.test.js # Tests for src/components/lib/tariffCalculators.js
│   │   │   └── tariffCache.test.js      # Tests for src/components/lib/tariffCache.js
│   │   ├── userUtils.jsx
│   │   ├── tariffCalculators.js
│   │   └── tariffCache.js
│   └── operacoes/
│       ├── __tests__/
│       │   └── FormVooVoosArr.test.js   # Tests for filter logic in FormVoo.jsx
│       └── FormVoo.jsx
└── functions/
    ├── __tests__/
    │   └── gerarProformaPdfSimples.test.js  # Tests for PDF generation
    └── gerarProformaPdfSimples.js
```

## Test Structure

**Suite Organization:**
```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Section Header ──────────────────────────────────────────────────
describe('functionName', () => {
  it('describes expected behavior in plain English', () => {
    expect(result).toBe(expected);
  });

  it('returns false for null', () => {
    expect(fn(null)).toBe(false);
  });
});
```

**Patterns:**
- Explicit imports from `vitest` even though globals are enabled
- Section separators: `// ── SectionName ──────────` (em-dash style)
- Fixture objects defined at top of file outside describe blocks
- `beforeEach` for cleanup: `vi.clearAllMocks()`, cache clearing
- Tests cover null/undefined/edge cases thoroughly
- Test names describe expected behavior, not implementation

## Mocking

**Framework:** Vitest `vi` (built-in)

**Supabase Client Mock (most common pattern):**
```js
// Create chainable mock object
const mockQuery = {
  select: vi.fn(),
  eq: vi.fn(),
  neq: vi.fn(),
  // ... all Supabase PostgREST methods
  single: vi.fn(),
  range: vi.fn(),
};
// Make every method return mockQuery for chaining
Object.values(mockQuery).forEach(fn => fn.mockReturnValue(mockQuery));

const mockSupabase = {
  from: vi.fn(() => mockQuery),
  auth: { getUser: vi.fn() },
};

vi.mock('@/lib/supabaseClient', () => ({
  supabase: mockSupabase,
}));
```

**Module Mock with Dynamic Import:**
```js
// Mock module BEFORE importing the code under test
vi.mock('@/components/ui/use-toast', () => ({
  toast: mockToast,
}));

// Use dynamic import to ensure mocks are applied
const { showErrorToast } = await import('../errorUtils.js');
```

**PDF/Heavy Dependency Mock:**
```js
vi.mock('@/lib/pdfTemplate', () => ({
  createPdfDoc: vi.fn(() => ({
    output: vi.fn((type) => type === 'datauristring' ? 'data:...' : ''),
    save: vi.fn(),
    setFontSize: vi.fn(),
    text: vi.fn(),
    // ... stub all used methods
  })),
  addHeader: vi.fn(() => 30),
  addFooter: vi.fn(),
  // ...
}));
```

**What to Mock:**
- `@/lib/supabaseClient` -- always mock in unit tests
- `@/components/ui/use-toast` -- mock toast notifications
- `@/lib/pdfTemplate` -- mock PDF generation (jsPDF)
- Any external service calls

**What NOT to Mock:**
- Pure utility functions (test directly)
- Tariff calculators (test with real logic, only mock data sources)
- Filter/sort functions (test with fixture data)

## Fixtures and Factories

**Test Data:**
```js
// Inline fixture objects at top of test file
const superAdmin = { role: 'admin', perfis: ['administrador'], empresa_id: null };
const empresaAdmin = { role: 'admin', perfis: ['administrador'], empresa_id: 'emp1' };
const normalUser = {
  role: 'user',
  perfis: ['operador'],
  empresa_id: 'emp1',
  aeroportos_acesso: ['FNLU', 'FNCB'],
};

// Factory functions for test objects
const makeArrVoo = (overrides = {}) => ({
  id: overrides.id || 'arr-1',
  tipo_movimento: 'ARR',
  status: 'Ativo',
  data_operacao: overrides.data_operacao || '2026-01-10',
  // ... defaults with overrides spread
});
```

**Location:**
- Fixtures are defined inline within test files (no shared fixtures directory)
- Use `overrides` pattern for factory functions

## Coverage

**Requirements:** None enforced (no coverage thresholds configured)

**View Coverage:**
```bash
npx vitest run --coverage  # Ad-hoc coverage check
```

## Test Types

**Unit Tests:**
- Primary test type used in this codebase
- Test pure functions: utility functions, calculators, filters, validators
- Test entity operations with mocked Supabase client
- Test error handling utilities
- Test cache behavior (TTL, key generation)

**Integration Tests:**
- Minimal; `FormVooVoosArr.test.js` tests filter logic extracted from a component
- No component rendering tests with `@testing-library/react` (library installed but unused in current tests)

**E2E Tests:**
- Not used (no Playwright/Cypress configured)

## Existing Test Coverage

**Covered areas (9 test files):**
| File | Tests | What it covers |
|------|-------|----------------|
| `src/lib/__tests__/sanitize.test.js` | ~20 | XSS sanitization, URL redirect safety, filename sanitization |
| `src/lib/__tests__/errorUtils.test.js` | ~10 | Toast error/success display, error message extraction |
| `src/lib/__tests__/queryClient.test.js` | ~8 | TanStack Query defaults: staleTime, gcTime, retry, backoff |
| `src/entities/__tests__/createEntity.test.js` | ~20 | Filter operators, ordering, pagination, CRUD error handling |
| `src/components/lib/__tests__/userUtils.test.js` | ~25 | Permission checks, multi-tenant filtering, airport access |
| `src/components/lib/__tests__/tariffCalculators.test.js` | ~20+ | Landing, parking, passenger, cargo tariff calculations |
| `src/components/lib/__tests__/tariffCache.test.js` | ~8 | Cache set/get/clear, TTL expiration, key generation |
| `src/functions/__tests__/gerarProformaPdfSimples.test.js` | ~5+ | PDF generation with mocked jsPDF |
| `src/components/operacoes/__tests__/FormVooVoosArr.test.js` | ~5+ | Flight pairing filter logic |

**Not covered (significant gaps):**
- No component rendering tests (React Testing Library unused)
- No page-level tests
- No authentication flow tests
- No hook tests (useVoos, useSubmitGuard, etc.)
- No API/edge function tests
- No i18n translation completeness tests

## CI/CD

**Pipeline:** GitHub Actions at `.github/workflows/ci.yml`

**Build Job (all pushes/PRs to main):**
1. Node.js 20 setup with npm cache
2. `npm ci` -- install dependencies
3. `npx eslint src/ --ext .js,.jsx || true` -- lint (non-blocking, `continue-on-error: true`)
4. `npx vite build` -- production build

**Deploy Job (main branch push only):**
1. Same build steps
2. SSH deploy to Hostinger VPS (`62.72.62.61:65002`)
3. Cleans remote assets directory, uploads `dist/*`

**IMPORTANT:** Tests are NOT run in CI. The `npm test` script exists but is not called in the pipeline. Lint failures are also non-blocking (`|| true`).

## Common Patterns

**Async Testing:**
```js
it('throws on supabase error', async () => {
  mockQuery.range.mockResolvedValueOnce({
    data: null,
    error: { message: 'timeout' },
  });
  await expect(entity.list()).rejects.toEqual({ message: 'timeout' });
});
```

**Error Testing:**
```js
it('includes table name in error message', async () => {
  mockQuery.single.mockResolvedValue({
    data: null,
    error: { message: 'duplicate key' },
  });
  await expect(entity.create({ name: 'test' })).rejects.toThrow(
    'Erro ao criar test_table: duplicate key'
  );
});
```

**Null Safety Testing:**
```js
it('returns false for null', () => {
  expect(isSuperAdmin(null)).toBe(false);
});
it('returns false for null user', () => {
  expect(hasPageAccess(null, 'Voos', permissions)).toBe(false);
});
```

**Mock Reset Pattern:**
```js
beforeEach(() => {
  vi.clearAllMocks();
  // Re-chain after clear (for Supabase mock)
  Object.values(mockQuery).forEach(fn => fn.mockReturnValue(mockQuery));
});
```

**Console Spy:**
```js
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
it('logs the error', () => {
  showErrorToast('msg', err);
  expect(console.error).toHaveBeenCalledWith('msg', err);
});
```

## Adding New Tests

**Where to put new tests:**
1. Create `__tests__/` directory as sibling to the module
2. Name file `{moduleName}.test.js`
3. Import from vitest: `import { describe, it, expect, vi, beforeEach } from 'vitest'`
4. Mock `@/lib/supabaseClient` if the module uses Supabase
5. Use dynamic import (`await import(...)`) when mocking dependencies of the module under test

**Template:**
```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks go here (before any imports of the module under test)
vi.mock('@/lib/supabaseClient', () => ({
  supabase: { /* mock */ },
}));

// Dynamic import AFTER mocks
const { myFunction } = await import('../myModule.js');

// ── Fixtures ──────────────────────────────────────────────────────────
const fixture = { /* test data */ };

// ── myFunction ────────────────────────────────────────────────────────
describe('myFunction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns expected result for valid input', () => {
    expect(myFunction(fixture)).toBe(expected);
  });

  it('handles null gracefully', () => {
    expect(myFunction(null)).toBe(fallback);
  });
});
```

---

*Testing analysis: 2026-03-26*
