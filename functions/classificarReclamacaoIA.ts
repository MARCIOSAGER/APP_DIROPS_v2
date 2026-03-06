import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verificar autenticação
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { descricao, assunto } = await req.json();

    if (!descricao) {
      return Response.json({ error: 'Descrição é obrigatória' }, { status: 400 });
    }

    // Classificação com IA desabilitada para poupar créditos
    const resultado = {
      categoria: "outro",
      prioridade: "media",
      area_responsavel: "operacoes",
      resumo: descricao.substring(0, 150),
      tags_sugeridas: []
    };

    return Response.json({
      success: true,
      classificacao: resultado
    });

  } catch (error) {
    console.error('Erro ao classificar reclamação:', error);
    return Response.json({ 
      error: 'Erro ao processar classificação',
      details: error.message 
    }, { status: 500 });
  }
});