import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Buscar voos do FNSA
    const voosRaw = await base44.asServiceRole.entities.Voo.filter({
      aeroporto_operacao: "FNSA"
    }, '-created_date', 100);
    const voos = Array.isArray(voosRaw) ? voosRaw : (voosRaw ? Object.values(voosRaw) : []);

    console.log(`\n📍 ${voos.length} voo(s) encontrado(s) em FNSA`);

    const vooIds = new Set(voos.map(v => v.id));
    const todosVoosLigadosRaw = await base44.asServiceRole.entities.VooLigado.list('-created_date', 500);
    const todosVoosLigados = Array.isArray(todosVoosLigadosRaw) ? todosVoosLigadosRaw : (todosVoosLigadosRaw ? Object.values(todosVoosLigadosRaw) : []);

    const voosLigadosFNSA = todosVoosLigados.filter(vl => 
      vooIds.has(vl.id_voo_arr) && vooIds.has(vl.id_voo_dep)
    );

    console.log(`\n🔗 ${voosLigadosFNSA.length} voo(s) ligado(s) encontrado(s) em FNSA`);

    if (voosLigadosFNSA.length > 0) {
      console.log(`\nPrimeiros 5:`);
      voosLigadosFNSA.slice(0, 5).forEach((vl, idx) => {
        console.log(`  [${idx}] ID: ${vl.id}, voo_arr: ${vl.id_voo_arr}, voo_dep: ${vl.id_voo_dep}`);
      });
    }

    return Response.json({
      voosEmFNSA: voos.length,
      voosLigadosFNSA: voosLigadosFNSA.length,
      primeiroVooLigado: voosLigadosFNSA.length > 0 ? voosLigadosFNSA[0].id : null
    });

  } catch (error) {
    console.error('❌ Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});