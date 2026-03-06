import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // 1. Tentar obter da ConfiguracaoSistema
    const configs = await base44.entities.ConfiguracaoSistema.list().catch(() => []);
    
    if (configs.length > 0 && configs[0].taxa_cambio_usd_aoa) {
      console.log(`✅ Taxa de câmbio encontrada em ConfiguracaoSistema: ${configs[0].taxa_cambio_usd_aoa}`);
      return Response.json({
        taxa_cambio_usd_aoa: configs[0].taxa_cambio_usd_aoa,
        fonte: 'ConfiguracaoSistema',
        sucesso: true
      });
    }

    // 2. Se não encontrar, usar valor padrão
    console.log(`⚠️ Taxa de câmbio não encontrada em ConfiguracaoSistema, usando padrão: 890`);
    return Response.json({
      taxa_cambio_usd_aoa: 890,
      fonte: 'padrão',
      sucesso: true
    });

  } catch (error) {
    console.error('❌ Erro:', error);
    return Response.json({ 
      error: error.message,
      taxa_cambio_usd_aoa: 890,
      fonte: 'fallback'
    }, { status: 500 });
  }
});