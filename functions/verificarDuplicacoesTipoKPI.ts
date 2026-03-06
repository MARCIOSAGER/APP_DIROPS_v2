import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verificar autenticação
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // Buscar todos os tipos de KPI
    const tiposKPI = await base44.asServiceRole.entities.TipoKPI.list();

    // Verificar duplicações por código
    const codigosMap = new Map();
    const duplicacoesPorCodigo = [];
    
    tiposKPI.forEach(tipo => {
      const codigo = tipo.codigo;
      if (codigosMap.has(codigo)) {
        codigosMap.get(codigo).push(tipo);
      } else {
        codigosMap.set(codigo, [tipo]);
      }
    });

    // Identificar duplicações
    for (const [codigo, tipos] of codigosMap.entries()) {
      if (tipos.length > 1) {
        duplicacoesPorCodigo.push({
          codigo,
          quantidade: tipos.length,
          registos: tipos.map(t => ({
            id: t.id,
            nome: t.nome,
            created_date: t.created_date,
            created_by: t.created_by
          }))
        });
      }
    }

    // Verificar duplicações por nome
    const nomesMap = new Map();
    const duplicacoesPorNome = [];
    
    tiposKPI.forEach(tipo => {
      const nome = tipo.nome?.trim().toLowerCase();
      if (nomesMap.has(nome)) {
        nomesMap.get(nome).push(tipo);
      } else {
        nomesMap.set(nome, [tipo]);
      }
    });

    for (const [nome, tipos] of nomesMap.entries()) {
      if (tipos.length > 1) {
        duplicacoesPorNome.push({
          nome,
          quantidade: tipos.length,
          registos: tipos.map(t => ({
            id: t.id,
            codigo: t.codigo,
            created_date: t.created_date,
            created_by: t.created_by
          }))
        });
      }
    }

    return Response.json({
      total_tipos_kpi: tiposKPI.length,
      duplicacoes_por_codigo: duplicacoesPorCodigo,
      duplicacoes_por_nome: duplicacoesPorNome,
      tem_duplicacoes: duplicacoesPorCodigo.length > 0 || duplicacoesPorNome.length > 0
    });

  } catch (error) {
    console.error('Erro ao verificar duplicações:', error);
    return Response.json({ 
      error: error.message || 'Erro ao verificar duplicações' 
    }, { status: 500 });
  }
});