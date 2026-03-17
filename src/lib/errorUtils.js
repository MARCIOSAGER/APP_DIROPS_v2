import { toast } from '@/components/ui/use-toast';

export function showErrorToast(message, error) {
  console.error(message, error);
  toast({
    title: 'Erro',
    description: message || 'Ocorreu um erro inesperado.',
    variant: 'destructive',
  });
}

export function showSuccessToast(message) {
  toast({
    title: 'Sucesso',
    description: message,
  });
}

export function getErrorMessage(error) {
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  if (error?.error_description) return error.error_description;
  return 'Ocorreu um erro inesperado.';
}
