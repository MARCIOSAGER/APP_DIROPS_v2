import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import React from 'react';

// ── Supabase mock ─────────────────────────────────────────────────────────

const mockSubscription = { unsubscribe: vi.fn() };
let authStateCallback = null;

const mockSupabase = {
  auth: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn((cb) => {
      authStateCallback = cb;
      return { data: { subscription: mockSubscription } };
    }),
    signOut: vi.fn().mockResolvedValue({}),
    refreshSession: vi.fn().mockResolvedValue({}),
    getUser: vi.fn(),
  },
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
    insert: vi.fn().mockReturnThis(),
  })),
};

vi.mock('@/lib/supabaseClient', () => ({
  supabase: mockSupabase,
}));

vi.mock('@/lib/query-client', () => ({
  queryClientInstance: { clear: vi.fn() },
}));

// ── Import after mocks ───────────────────────────────────────────────────

const { AuthProvider, useAuth } = await import('../AuthContext.jsx');

// ── Helper component to read context ─────────────────────────────────────

function AuthConsumer() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="user">{auth.user ? JSON.stringify(auth.user) : 'null'}</span>
      <span data-testid="authenticated">{String(auth.isAuthenticated)}</span>
      <span data-testid="loading">{String(auth.isLoadingAuth)}</span>
    </div>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authStateCallback = null;
  });

  it('renders children inside AuthProvider', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    render(
      <AuthProvider>
        <span data-testid="child">Hello</span>
      </AuthProvider>
    );

    expect(screen.getByTestId('child')).toHaveTextContent('Hello');
  });

  it('returns null user when there is no session', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    expect(screen.getByTestId('user')).toHaveTextContent('null');
    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
  });

  it('loads user profile when session exists', async () => {
    const mockProfile = {
      id: 'profile-1',
      auth_id: 'auth-123',
      email: 'test@example.com',
      full_name: 'Test User',
      perfis: ['administrador'],
      status: 'ativo',
    };

    mockSupabase.auth.getSession.mockResolvedValue({
      data: {
        session: {
          user: { id: 'auth-123', email: 'test@example.com', user_metadata: {} },
        },
      },
      error: null,
    });

    // Chain: supabase.from('users').select('*').eq('auth_id', ...).single()
    const singleMock = vi.fn().mockResolvedValue({ data: mockProfile, error: null });
    const eqMock = vi.fn().mockReturnValue({ single: singleMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    mockSupabase.from.mockReturnValue({ select: selectMock });

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    expect(screen.getByTestId('authenticated')).toHaveTextContent('true');

    const userData = JSON.parse(screen.getByTestId('user').textContent);
    expect(userData.email).toBe('test@example.com');
    expect(userData.role).toBe('admin');
  });

  it('useAuth throws when used outside AuthProvider', () => {
    // Suppress React error boundary console output
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    function BadConsumer() {
      useAuth();
      return null;
    }

    expect(() => render(<BadConsumer />)).toThrow(
      'useAuth must be used within an AuthProvider'
    );

    spy.mockRestore();
  });

  it('exposes logout and navigateToLogin in context', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    let authRef;
    function Capture() {
      authRef = useAuth();
      return null;
    }

    render(
      <AuthProvider>
        <Capture />
      </AuthProvider>
    );

    await waitFor(() => expect(authRef).toBeDefined());
    expect(typeof authRef.logout).toBe('function');
    expect(typeof authRef.navigateToLogin).toBe('function');
    expect(typeof authRef.checkAppState).toBe('function');
  });
});
