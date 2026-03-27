import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import React from 'react';
import { renderWithProviders } from '@/test/testUtils';

vi.mock('@/components/ui/input', () => ({
  Input: (props) => <input {...props} />,
}));
vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...p }) => <label {...p}>{children}</label>,
}));

import PassengersSection from '../PassengersSection';

describe('PassengersSection', () => {
  const formData = {
    passageiros_local: 50,
    passageiros_transito_transbordo: 10,
    passageiros_transito_direto: 5,
    passageiros_total: 65,
  };

  it('renders without crashing', () => {
    const { container } = renderWithProviders(
      <PassengersSection formData={formData} onChange={vi.fn()} />
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('renders passenger input fields', () => {
    renderWithProviders(
      <PassengersSection formData={formData} onChange={vi.fn()} />
    );
    // i18n translates keys to Portuguese
    expect(screen.getByLabelText(/Passageiros Locais/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Total/i)).toBeInTheDocument();
  });
});
