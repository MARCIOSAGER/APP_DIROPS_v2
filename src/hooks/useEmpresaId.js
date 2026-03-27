import { useAuth } from '@/lib/AuthContext';
import { useCompanyView } from '@/lib/CompanyViewContext';

export function useEmpresaId() {
  const { user } = useAuth();
  const { effectiveEmpresaId } = useCompanyView();
  return effectiveEmpresaId || user?.empresa_id;
}
