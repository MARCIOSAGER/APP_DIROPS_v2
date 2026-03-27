import React from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from '@/components/lib/i18n';

// Mock user for tests
export const mockUser = {
  id: 'user-1',
  auth_id: 'auth-1',
  email: 'test@example.com',
  full_name: 'Test User',
  role: 'administrador',
  perfis: ['administrador'],
  status: 'ativo',
  empresa_id: 'empresa-1',
  aeroportos_acesso: ['FNLU'],
};

// Mock Supabase client (common shape)
export const mockSupabase = {
  from: () => ({
    select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }), data: [], error: null }), data: [], error: null }),
    insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
    update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
    delete: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
  }),
  auth: {
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
  },
  storage: {
    from: () => ({
      upload: () => Promise.resolve({ data: null, error: null }),
      getPublicUrl: () => ({ data: { publicUrl: 'https://example.com/file.png' } }),
    }),
  },
};

/**
 * Renders a component wrapped in QueryClientProvider + I18nProvider.
 * Returns all @testing-library/react render helpers.
 */
export function renderWithProviders(ui, options = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }) {
    return (
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          {children}
        </I18nProvider>
      </QueryClientProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...options });
}
