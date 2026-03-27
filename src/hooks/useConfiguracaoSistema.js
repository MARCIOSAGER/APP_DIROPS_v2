import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

export function useConfiguracaoSistema({ enabled = true } = {}) {
  return useQuery({
    queryKey: ['configuracao_sistema'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracao_sistema')
        .select('*')
        .limit(1);

      if (error) {
        console.error('Erro ao carregar configuracao_sistema:', error);
        return null;
      }

      return data && data.length > 0 ? data[0] : null;
    },
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled,
  });
}

export function useSaveConfiguracaoSistema() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ configId, data }) => {
      if (configId) {
        const { error } = await supabase
          .from('configuracao_sistema')
          .update(data)
          .eq('id', configId);
        if (error) throw error;
        return { id: configId };
      } else {
        const { data: inserted, error } = await supabase
          .from('configuracao_sistema')
          .insert(data)
          .select()
          .single();
        if (error) throw error;
        return inserted;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configuracao_sistema'] });
    },
  });
}
