// v2
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const vooId = body.voo_id || '694a8c0b8a8d8dded3f8fc1b';

    console.log(`🔍 Buscando registos CalculoTarifa com voo_id=${vooId}`);

    const registos = await base44.asServiceRole.entities.CalculoTarifa.filter(
      { voo_id: vooId },
      '-created_date',
      100
    );

    console.log(`📊 Encontrados: ${registos.length} registos`);

    return Response.json({
      sucesso: true,
      voo_id: vooId,
      total_encontrados: registos.length,
      registos: registos.map(r => ({
        id: r.id,
        voo_id: r.voo_id,
        voo_ligado_id: r.voo_ligado_id,
        aeroporto_id: r.aeroporto_id,
        total_tarifa_usd: r.total_tarifa_usd,
        created_date: r.created_date,
        updated_date: r.updated_date
      }))
    });

  } catch (error) {
    console.error('❌ Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});