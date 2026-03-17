import '@testing-library/jest-dom';

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i) => Object.keys(store)[i] ?? null,
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

// Mock window.location for safeRedirectUrl tests
if (!globalThis.window) {
  globalThis.window = globalThis;
}
if (!window.location) {
  Object.defineProperty(window, 'location', {
    value: { origin: 'https://example.com', href: 'https://example.com/' },
    writable: true,
  });
}
