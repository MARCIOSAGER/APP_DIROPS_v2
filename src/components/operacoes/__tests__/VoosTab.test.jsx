import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// ── Mocks ─────────────────────────────────────────────────────────────────

// Mock lucide-react icons as simple span placeholders
vi.mock('lucide-react', () => ({
  RefreshCw: (props) => <span data-testid="icon-refresh" {...props} />,
  Download: (props) => <span data-testid="icon-download" {...props} />,
  Filter: (props) => <span data-testid="icon-filter" {...props} />,
  X: (props) => <span data-testid="icon-x" {...props} />,
  Trash2: (props) => <span data-testid="icon-trash" {...props} />,
  Plus: (props) => <span data-testid="icon-plus" {...props} />,
}));

// Mock VoosTable to capture props
const voosTableProps = vi.fn();
vi.mock('../VoosTable', () => ({
  default: (props) => {
    voosTableProps(props);
    return <div data-testid="voos-table" />;
  },
}));

// Mock userUtils
vi.mock('@/components/lib/userUtils', () => ({
  isAdminProfile: vi.fn(() => false),
}));

// Mock Radix UI primitives used by card/button/input/label/select/combobox
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }) => <div data-testid="card" {...props}>{children}</div>,
  CardContent: ({ children, ...props }) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }) => <div {...props}>{children}</div>,
  CardDescription: ({ children, ...props }) => <div {...props}>{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }) => <button {...props}>{children}</button>,
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props) => <input {...props} />,
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }) => <label {...props}>{children}</label>,
}));

vi.mock('@/components/ui/select', () => ({
  default: ({ options, value, onValueChange, ...props }) => (
    <select
      {...props}
      value={value}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      {options?.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  ),
}));

vi.mock('@/components/ui/combobox', () => ({
  default: ({ options, value, onValueChange, placeholder, ...props }) => (
    <select
      {...props}
      value={value}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      {options?.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  ),
}));

// ── Helpers ───────────────────────────────────────────────────────────────

const t = (key) => key; // identity translator

const baseProps = {
  voosFiltrados: [{ id: 1, numero_voo: 'TP100' }],
  isLoadingAll: false,
  isFiltering: false,
  filtros: {
    busca: '',
    dataInicio: '',
    dataFim: '',
    tipoMovimento: 'todos',
    status: 'todos',
    tipoVoo: 'todos',
    companhia: 'todos',
    aeroporto: 'todos',
    statusVinculacao: 'todos',
    origem: 'todos',
    passageirosMin: '',
    passageirosMax: '',
    cargaMin: '',
    cargaMax: '',
  },
  aeroportos: [{ codigo_icao: 'FNLU', nome: 'Luanda' }],
  companhias: [{ codigo_icao: 'DTA', nome: 'TAAG' }],
  voos: [],
  voosLigados: {},
  sortField: 'data_voo',
  sortDirection: 'desc',
  t,
  currentUser: { role: 'user', perfis: [] },
  onFilterChange: vi.fn(),
  onSort: vi.fn(),
  onBuscar: vi.fn(),
  onClearFilters: vi.fn(),
  onRefresh: vi.fn(),
  onExportCSV: vi.fn(),
  onOpenForm: vi.fn(),
  onLixeira: vi.fn(),
  onEditVoo: vi.fn(),
  onCancelarVoo: vi.fn(),
  onExcluirVoo: vi.fn(),
};

// ── Tests ─────────────────────────────────────────────────────────────────

import VoosTab from '../VoosTab';

describe('VoosTab', () => {
  it('renders without crashing', () => {
    const { container } = render(<VoosTab {...baseProps} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders filter inputs (busca, date start, date end)', () => {
    render(<VoosTab {...baseProps} />);
    expect(screen.getByLabelText('operacoes.pesquisar')).toBeInTheDocument();
    expect(screen.getByLabelText('operacoes.data_inicio')).toBeInTheDocument();
    expect(screen.getByLabelText('operacoes.data_fim')).toBeInTheDocument();
  });

  it('renders the search and clear filter buttons', () => {
    render(<VoosTab {...baseProps} />);
    // The search button text is hardcoded "Buscar", clear uses t key
    expect(screen.getByText(/Buscar/)).toBeInTheDocument();
    expect(screen.getByText('operacoes.limpar')).toBeInTheDocument();
  });

  it('passes correct props to VoosTable', () => {
    voosTableProps.mockClear();
    render(<VoosTab {...baseProps} />);

    expect(voosTableProps).toHaveBeenCalledTimes(1);
    const passed = voosTableProps.mock.calls[0][0];

    expect(passed.voos).toEqual(baseProps.voosFiltrados);
    expect(passed.voosLigados).toBe(baseProps.voosLigados);
    expect(passed.isLoading).toBe(false);
    expect(passed.sortField).toBe('data_voo');
    expect(passed.sortDirection).toBe('desc');
    expect(passed.onEditVoo).toBe(baseProps.onEditVoo);
    expect(passed.onCancelarVoo).toBe(baseProps.onCancelarVoo);
    expect(passed.onExcluirVoo).toBe(baseProps.onExcluirVoo);
    expect(passed.currentUser).toBe(baseProps.currentUser);
    expect(passed.onSort).toBe(baseProps.onSort);
  });

  it('shows loading overlay when isFiltering is true', () => {
    render(<VoosTab {...baseProps} isFiltering={true} />);
    expect(screen.getByText('operacoes.carregando_voos')).toBeInTheDocument();
  });

  it('does not show loading overlay when isFiltering is false', () => {
    render(<VoosTab {...baseProps} isFiltering={false} />);
    expect(screen.queryByText('operacoes.carregando_voos')).not.toBeInTheDocument();
  });
});
