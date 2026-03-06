import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verificar autenticação e permissões de admin
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // Verificar se é admin
    if (user.role !== 'admin' && !(user.perfis && user.perfis.includes('administrador'))) {
      return Response.json({ error: 'Sem permissões de administrador' }, { status: 403 });
    }

    const { ids_para_remover } = await req.json();

    if (!ids_para_remover || !Array.isArray(ids_para_remover) || ids_para_remover.length === 0) {
      return Response.json({ 
        error: 'Forneça um array de IDs para remover' 
      }, { status: 400 });
    }

    // Verificar se há medições associadas antes de excluir
    const verificacoes = await Promise.all(
      ids_para_remover.map(async (id) => {
        const medicoes = await base44.asServiceRole.entities.MedicaoKPI.filter({ tipo_kpi_id: id });
        return { id, tem_medicoes: medicoes.length > 0, quantidade_medicoes: medicoes.length };
      })
    );

    const idsComMedicoes = verificacoes.filter(v => v.tem_medicoes);
    
    if (idsComMedicoes.length > 0) {
      return Response.json({
        error: 'Alguns tipos de KPI têm medições associadas e não podem ser excluídos',
        detalhes: idsComMedicoes
      }, { status: 400 });
    }

    // Excluir os tipos de KPI
    const resultados = await Promise.all(
      ids_para_remover.map(id => base44.asServiceRole.entities.TipoKPI.delete(id))
    );

    return Response.json({
      sucesso: true,
      quantidade_removida: ids_para_remover.length,
      ids_removidos: ids_para_remover
    });

  } catch (error) {
    console.error('Erro ao remover duplicações:', error);
    return Response.json({ 
      error: error.message || 'Erro ao remover duplicações' 
    }, { status: 500 });
  }
});