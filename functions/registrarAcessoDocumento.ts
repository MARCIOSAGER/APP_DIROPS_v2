import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { documento_id, tipo_acesso } = await req.json();

    if (!documento_id || !tipo_acesso) {
      return Response.json({ error: 'Parâmetros inválidos' }, { status: 400 });
    }

    // Obter IP do cliente (headers do Cloudflare ou padrão)
    const ip = req.headers.get('cf-connecting-ip') || 
               req.headers.get('x-forwarded-for') || 
               'unknown';

    // Registrar acesso
    const logData = {
      documento_id,
      usuario_email: user.email,
      usuario_nome: user.full_name || user.email,
      tipo_acesso,
      ip_address: ip,
      data_hora_acesso: new Date().toISOString()
    };

    await base44.asServiceRole.entities.LogAcessoDocumento.create(logData);

    return Response.json({ 
      success: true,
      message: 'Acesso registrado'
    });

  } catch (error) {
    console.error('Erro ao registrar acesso:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});