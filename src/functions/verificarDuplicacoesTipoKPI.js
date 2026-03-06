import { supabase } from '@/lib/supabaseClient';

export async function verificarDuplicacoesTipoKPI() {
  const { data: tiposKPI, error } = await supabase.from('tipo_k_p_i').select('*');
  if (error) throw error;

  const codigosMap = new Map();
  const nomesMap = new Map();
  (tiposKPI || []).forEach(tipo => {
    const codigo = tipo.codigo;
    if (codigo) { if (!codigosMap.has(codigo)) codigosMap.set(codigo, []); codigosMap.get(codigo).push(tipo); }
    const nome = tipo.nome?.trim().toLowerCase();
    if (nome) { if (!nomesMap.has(nome)) nomesMap.set(nome, []); nomesMap.get(nome).push(tipo); }
  });

  const duplicacoesPorCodigo = [...codigosMap.entries()].filter(([, t]) => t.length > 1)
    .map(([codigo, tipos]) => ({ codigo, quantidade: tipos.length, registos: tipos.map(t => ({ id: t.id, nome: t.nome, created_date: t.created_date })) }));
  const duplicacoesPorNome = [...nomesMap.entries()].filter(([, t]) => t.length > 1)
    .map(([nome, tipos]) => ({ nome, quantidade: tipos.length, registos: tipos.map(t => ({ id: t.id, codigo: t.codigo, created_date: t.created_date })) }));

  return { total_tipos_kpi: (tiposKPI || []).length, duplicacoes_por_codigo: duplicacoesPorCodigo, duplicacoes_por_nome: duplicacoesPorNome, tem_duplicacoes: duplicacoesPorCodigo.length > 0 || duplicacoesPorNome.length > 0 };
}
