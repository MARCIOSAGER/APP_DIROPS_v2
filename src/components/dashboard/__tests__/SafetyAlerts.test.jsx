import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import React from 'react';
import { renderWithProviders } from '@/test/testUtils';

// Mock lucide-react icons
vi.mock('lucide-react', () => {
  const icon = (name) => (props) => <span data-testid={`icon-${name}`} {...props} />;
  return {
    ShieldAlert: icon('shield'),
    AlertTriangle: icon('alert'),
    Info: icon('info'),
  };
});

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...p }) => <div data-testid="card" {...p}>{children}</div>,
  CardContent: ({ children, ...p }) => <div {...p}>{children}</div>,
  CardHeader: ({ children, ...p }) => <div {...p}>{children}</div>,
  CardTitle: ({ children, ...p }) => <div {...p}>{children}</div>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...p }) => <span data-testid="badge" {...p}>{children}</span>,
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: (props) => <div data-testid="skeleton" {...props} />,
}));

import SafetyAlerts from '../SafetyAlerts';

describe('SafetyAlerts', () => {
  it('renders with empty ocorrencias array', () => {
    const { container } = renderWithProviders(
      <SafetyAlerts ocorrencias={[]} isLoading={false} />
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('renders occurrences when data provided', () => {
    const mockData = [
      {
        id: '1',
        tipo_ocorrencia: 'incidente',
        gravidade: 'critica',
        status: 'aberta',
        data_ocorrencia: '2026-03-25',
        aeroporto: 'FNLU',
        descricao: 'Test incident',
      },
      {
        id: '2',
        tipo_ocorrencia: 'acidente',
        gravidade: 'alta',
        status: 'aberta',
        data_ocorrencia: '2026-03-24',
        aeroporto: 'FNLU',
        descricao: 'Another event',
      },
    ];

    renderWithProviders(
      <SafetyAlerts ocorrencias={mockData} isLoading={false} />
    );
    expect(screen.getByText('INCIDENTE')).toBeInTheDocument();
    expect(screen.getByText('ACIDENTE')).toBeInTheDocument();
  });

  it('shows skeletons when loading', () => {
    renderWithProviders(
      <SafetyAlerts ocorrencias={[]} isLoading={true} />
    );
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
  });
});
