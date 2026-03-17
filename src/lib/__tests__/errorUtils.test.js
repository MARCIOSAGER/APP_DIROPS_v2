import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the toast dependency
const mockToast = vi.fn();
vi.mock('@/components/ui/use-toast', () => ({
  toast: mockToast,
}));

const { showErrorToast, showSuccessToast, getErrorMessage } = await import('../errorUtils.js');

describe('showErrorToast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('calls toast with variant destructive', () => {
    showErrorToast('Something failed');
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Erro',
      description: 'Something failed',
      variant: 'destructive',
    });
  });

  it('uses default message when message is falsy', () => {
    showErrorToast(null);
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Erro',
      description: 'Ocorreu um erro inesperado.',
      variant: 'destructive',
    });
  });

  it('logs the error to console.error', () => {
    const err = new Error('fail');
    showErrorToast('msg', err);
    expect(console.error).toHaveBeenCalledWith('msg', err);
  });
});

describe('showSuccessToast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls toast with title Sucesso', () => {
    showSuccessToast('Record saved');
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Sucesso',
      description: 'Record saved',
    });
  });

  it('does not include variant property', () => {
    showSuccessToast('ok');
    const call = mockToast.mock.calls[0][0];
    expect(call).not.toHaveProperty('variant');
  });
});

describe('getErrorMessage', () => {
  it('returns string directly when error is a string', () => {
    expect(getErrorMessage('plain error')).toBe('plain error');
  });

  it('returns message from Error object', () => {
    expect(getErrorMessage(new Error('something broke'))).toBe('something broke');
  });

  it('returns message from object with message property', () => {
    expect(getErrorMessage({ message: 'api error' })).toBe('api error');
  });

  it('returns error_description from object', () => {
    expect(getErrorMessage({ error_description: 'OAuth failed' })).toBe('OAuth failed');
  });

  it('prefers message over error_description', () => {
    expect(getErrorMessage({ message: 'msg', error_description: 'desc' })).toBe('msg');
  });

  it('returns default message for null', () => {
    expect(getErrorMessage(null)).toBe('Ocorreu um erro inesperado.');
  });

  it('returns default message for undefined', () => {
    expect(getErrorMessage(undefined)).toBe('Ocorreu um erro inesperado.');
  });

  it('returns default message for object without message or error_description', () => {
    expect(getErrorMessage({ code: 500 })).toBe('Ocorreu um erro inesperado.');
  });
});
