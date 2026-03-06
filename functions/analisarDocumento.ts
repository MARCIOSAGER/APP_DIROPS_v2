import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { file_url, titulo } = await req.json();

    if (!file_url) {
      return Response.json({ error: 'file_url é obrigatório' }, { status: 400 });
    }

    // Análise com IA desabilitada para poupar créditos
    const analise = {
      resumo: `Documento: ${titulo || 'Sem título'}. Análise automática com IA temporariamente desabilitada.`,
      categoria_sugerida: "outro",
      palavras_chave: [],
      nivel_acesso_sugerido: ["visualizador"],
      topicos_principais: []
    };

    return Response.json({
      success: true,
      analise: analise
    });

  } catch (error) {
    console.error('Erro ao analisar documento:', error);
    return Response.json({ 
      error: 'Erro ao processar documento',
      details: error.message 
    }, { status: 500 });
  }
});