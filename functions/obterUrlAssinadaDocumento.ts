import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { documento_id } = await req.json();

    if (!documento_id) {
      return Response.json({ error: 'ID do documento é obrigatório' }, { status: 400 });
    }

    // Buscar documento
    const docs = await base44.asServiceRole.entities.Documento.filter({ id: documento_id });
    const documento = docs[0];

    if (!documento) {
      return Response.json({ error: 'Documento não encontrado' }, { status: 404 });
    }

    // Se o documento tem arquivo privado, gerar URL assinada
    if (documento.arquivo_privado_uri) {
      const signedUrlResult = await base44.integrations.Core.CreateFileSignedUrl({
        file_uri: documento.arquivo_privado_uri,
        expires_in: 300 // 5 minutos
      });

      return Response.json({
        success: true,
        url: signedUrlResult.signed_url,
        expires_in: 300
      });
    }

    // Caso contrário, retornar URL pública normal
    return Response.json({
      success: true,
      url: documento.arquivo_url,
      public: true
    });

  } catch (error) {
    console.error('Erro ao obter URL:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});