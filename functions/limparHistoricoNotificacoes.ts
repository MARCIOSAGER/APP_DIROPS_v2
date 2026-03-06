import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Acesso negado. Apenas administradores podem limpar o histórico.' }, { status: 403 });
    }

    // Buscar todos os registos do histórico
    const historico = await base44.asServiceRole.entities.HistoricoNotificacao.list('-created_date', 1000);

    let apagaramComSucesso = 0;
    let erros = [];

    for (const record of historico || []) {
      try {
        await base44.asServiceRole.entities.HistoricoNotificacao.delete(record.id);
        apagaramComSucesso++;
      } catch (e) {
        erros.push({ id: record.id, erro: e.message });
      }
    }

    return Response.json({
      sucesso: true,
      mensagem: `Histórico de notificações limpo - ${apagaramComSucesso} registos apagados`,
      total_apagados: apagaramComSucesso,
      total_erros: erros.length,
      erros: erros.length > 0 ? erros : null
    });

  } catch (error) {
    console.error('Erro ao limpar histórico:', error);
    return Response.json({ 
      error: 'Erro ao limpar histórico',
      details: error.message 
    }, { status: 500 });
  }
});