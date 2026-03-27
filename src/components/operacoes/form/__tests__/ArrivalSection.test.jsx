import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import React from 'react';
import { renderWithProviders } from '@/test/testUtils';

// Mock lucide-react icons used by ArrivalSection
vi.mock('lucide-react', () => ({
  Plus: (props) => <span data-testid="icon-Plus" {...props} />,
}));

// Mock UI components
vi.mock('@/components/ui/input', () => ({
  Input: (props) => <input {...props} />,
}));
vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...p }) => <label {...p}>{children}</label>,
}));
vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: (props) => <input type="checkbox" {...props} />,
}));
vi.mock('@/components/ui/select', () => ({
  default: ({ options, value, onValueChange, ...p }) => (
    <select {...p} value={value} onChange={(e) => onValueChange?.(e.target.value)}>
      {options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  ),
}));
vi.mock('@/components/ui/combobox', () => ({
  default: ({ options, value, onValueChange, placeholder, ...p }) => (
    <select {...p} value={value} onChange={(e) => onValueChange?.(e.target.value)}>
      {options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  ),
}));
vi.mock('@/components/ui/async-combobox', () => ({
  default: ({ placeholder, ...p }) => <input placeholder={placeholder} {...p} />,
}));

import ArrivalSection from '../ArrivalSection';

const baseFormData = {
  data_operacao: '2026-03-27',
  tipo_movimento: 'ARR',
  numero_voo: 'DT100',
  status: 'Previsto',
  companhia_aerea: '',
  registo_aeronave: '',
  horario_previsto: '10:00',
  horario_real: '',
  aeroporto_operacao: 'FNLU',
  aeroporto_origem_destino: '',
  posicao_stand: '',
  aeronave_no_hangar: false,
  requer_iluminacao_extra: false,
  tipo_voo: '',
  tripulacao: 0,
  carga_kg: 0,
  observacoes: '',
};

describe('ArrivalSection', () => {
  const defaultProps = {
    formData: baseFormData,
    errors: {},
    onChange: vi.fn(),
    tipoMovimentoOptions: [{ value: 'ARR', label: 'Chegada' }],
    statusOptions: [{ value: 'Previsto', label: 'Previsto' }],
    tipoVooOptions: [{ value: 'regular', label: 'Regular' }],
    aeroportoOperacaoOptions: [{ value: 'FNLU', label: 'FNLU - Luanda' }],
    aeroportoOrigemDestinoOptions: [{ value: 'LPPT', label: 'LPPT - Lisboa' }],
    aeroportosAcesso: ['FNLU'],
    vooInicial: null,
    searchCompanhias: vi.fn().mockResolvedValue([]),
    getCompanhiaInicial: vi.fn().mockResolvedValue(null),
    searchRegistos: vi.fn().mockResolvedValue([]),
    getRegistoInicial: vi.fn().mockResolvedValue(null),
    onShowCreateCompanhia: vi.fn(),
    onShowCreateRegisto: vi.fn(),
    onShowCreateAeroporto: vi.fn(),
  };

  it('renders without crashing', () => {
    const { container } = renderWithProviders(<ArrivalSection {...defaultProps} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders key form fields', () => {
    renderWithProviders(<ArrivalSection {...defaultProps} />);
    // i18n translates keys to Portuguese
    expect(screen.getByLabelText(/Data de Opera/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/N.*mero de Voo/i)).toBeInTheDocument();
  });
});
