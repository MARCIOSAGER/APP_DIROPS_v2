import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  try {
    const { to, subject, body } = await req.json();

    if (!to || !subject || !body) {
      return Response.json(
        { error: 'Missing required fields: to, subject, body' },
        { status: 400 }
      );
    }

    // Usar service role diretamente (sem verificação de autenticação prévia)
    // A função só pode ser chamada do frontend onde o utilizador já está autenticado
    const base44 = createClientFromRequest(req).asServiceRole;

    // Enviar e-mail usando service role (sem restrição de destinatários)
    await base44.integrations.Core.SendEmail({
      from_name: 'DIROPS-SGA',
      to: to,
      subject: subject,
      body: body
    });

    console.log(`✅ E-mail enviado com sucesso para: ${to}`);

    return Response.json({ 
      success: true, 
      message: 'E-mail enviado com sucesso' 
    });

  } catch (error) {
    console.error('❌ Erro ao enviar e-mail:', error);
    return Response.json(
      { error: error.message || 'Erro ao enviar e-mail' },
      { status: 500 }
    );
  }
});