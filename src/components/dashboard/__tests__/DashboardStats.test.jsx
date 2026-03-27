import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import React from 'react';
import { renderWithProviders } from '@/test/testUtils';

// Mock lucide-react icons
vi.mock('lucide-react', () => {
  const icon = (name) => (props) => <span data-testid={`icon-${name}`} {...props} />;
  return {
    Plane: icon('plane'),
    Clock: icon('clock'),
    DollarSign: icon('dollar'),
    ShieldAlert: icon('shield'),
    TrendingUp: icon('trending-up'),
    TrendingDown: icon('trending-down'),
    Minus: icon('minus'),
    PlaneLanding: icon('landing'),
    PlaneTakeoff: icon('takeoff'),
    ClipboardList: icon('clipboard'),
    Users: icon('users'),
  };
});

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...p }) => <div data-testid="card" {...p}>{children}</div>,
  CardContent: ({ children, ...p }) => <div {...p}>{children}</div>,
  CardHeader: ({ children, ...p }) => <div {...p}>{children}</div>,
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: (props) => <div data-testid="skeleton" {...props} />,
}));

import DashboardStats from '../DashboardStats';

describe('DashboardStats', () => {
  const serverStats = {
    totalVoos: 42,
    taxaPontualidade: 85.5,
    totalTarifas: 1500000,
    ocorrenciasAbertas: 3,
    chegadasHoje: 10,
    partidasHoje: 8,
    passageirosPeriodo: 5200,
    inspecoesPendentes: 2,
    voosUnicosLigados: 30,
    voosSemLink: 12,
  };

  it('renders without crashing with serverStats', () => {
    const { container } = renderWithProviders(
      <DashboardStats serverStats={serverStats} isLoading={false} />
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('renders 8 stat cards', () => {
    renderWithProviders(
      <DashboardStats serverStats={serverStats} isLoading={false} />
    );
    const cards = screen.getAllByTestId('card');
    expect(cards).toHaveLength(8);
  });

  it('shows skeletons when loading', () => {
    renderWithProviders(
      <DashboardStats serverStats={serverStats} isLoading={true} />
    );
    const skeletons = screen.getAllByTestId('skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
