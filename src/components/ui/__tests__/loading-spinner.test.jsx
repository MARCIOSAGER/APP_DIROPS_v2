import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock lucide-react Loader2 so we can inspect its className
vi.mock('lucide-react', () => ({
  Loader2: ({ className, ...rest }) => (
    <svg data-testid="loader-icon" className={className} {...rest} />
  ),
}));

vi.mock('@/lib/utils', () => ({
  cn: (...args) => args.filter(Boolean).join(' '),
}));

import { LoadingSpinner, PageLoading, ButtonSpinner } from '../loading-spinner';

describe('LoadingSpinner', () => {
  it('renders with default (md) size', () => {
    render(<LoadingSpinner />);
    const icon = screen.getByTestId('loader-icon');
    expect(icon.getAttribute('class')).toContain('w-4 h-4');
  });

  it.each([
    ['sm', 'w-3 h-3'],
    ['md', 'w-4 h-4'],
    ['lg', 'w-8 h-8'],
    ['xl', 'w-12 h-12'],
  ])('renders with size="%s" using class "%s"', (size, expectedClass) => {
    render(<LoadingSpinner size={size} />);
    const icons = screen.getAllByTestId('loader-icon');
    const icon = icons[icons.length - 1]; // latest render
    expect(icon.getAttribute('class')).toContain(expectedClass);
  });

  it('renders label text when provided', () => {
    render(<LoadingSpinner label="Loading data..." />);
    expect(screen.getByText('Loading data...')).toBeInTheDocument();
  });

  it('does not render label when not provided', () => {
    const { container } = render(<LoadingSpinner />);
    expect(container.querySelector('span')).toBeNull();
  });

  it('is wrapped with React.memo (stable reference)', () => {
    // React.memo wraps the component, giving it $$typeof for memo
    expect(LoadingSpinner.$$typeof).toBe(Symbol.for('react.memo'));
  });
});

describe('PageLoading', () => {
  it('renders without label', () => {
    const { container } = render(<PageLoading />);
    expect(container.firstChild).toBeTruthy();
    expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
  });

  it('renders label text when provided', () => {
    render(<PageLoading label="Please wait" />);
    expect(screen.getByText('Please wait')).toBeInTheDocument();
  });

  it('does not render label paragraph when label is not provided', () => {
    const { container } = render(<PageLoading />);
    expect(container.querySelector('p')).toBeNull();
  });

  it('is wrapped with React.memo', () => {
    expect(PageLoading.$$typeof).toBe(Symbol.for('react.memo'));
  });
});

describe('ButtonSpinner', () => {
  it('renders the loader icon', () => {
    render(<ButtonSpinner />);
    expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
  });

  it('is wrapped with React.memo', () => {
    expect(ButtonSpinner.$$typeof).toBe(Symbol.for('react.memo'));
  });
});
