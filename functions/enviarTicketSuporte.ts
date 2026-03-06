import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { assunto, categoria, mensagem } = await req.json();

    if (!assunto || !mensagem) {
      return Response.json({ error: 'Assunto e mensagem são obrigatórios' }, { status: 400 });
    }

    // Gerar número de ticket sequencial
    const tickets = await base44.asServiceRole.entities.TicketSuporte.list('-created_date', 1);
    let proximoNumero = 1;
    if (tickets && tickets.length > 0) {
      const ultimo = tickets[0].numero_ticket || 'TKT-0000';
      const num = parseInt(ultimo.replace('TKT-', ''), 10);
      proximoNumero = isNaN(num) ? 1 : num + 1;
    }
    const numeroTicket = `TKT-${String(proximoNumero).padStart(4, '0')}`;

    // Criar registo do ticket
    const ticket = await base44.asServiceRole.entities.TicketSuporte.create({
      numero_ticket: numeroTicket,
      assunto,
      categoria: categoria || 'outro',
      mensagem,
      nome_utilizador: user.full_name || user.email,
      email_utilizador: user.email,
      status: 'aberto'
    });

    // Enviar email
    const categoriaLabel = {
      bug: 'Bug / Erro',
      duvida: 'Dúvida',
      sugestao: 'Sugestão',
      acesso: 'Problema de Acesso',
      outro: 'Outro'
    }[categoria] || 'Outro';

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: 'marciosager@gmail.com',
      subject: `[${numeroTicket}] ${assunto}`,
      body: `
        <h2>Novo Ticket de Suporte - ${numeroTicket}</h2>
        <table style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;">
          <tr><td style="padding:8px;background:#f1f5f9;font-weight:bold;width:150px;">Ticket</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${numeroTicket}</td></tr>
          <tr><td style="padding:8px;background:#f1f5f9;font-weight:bold;">Utilizador</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${user.full_name || ''} (${user.email})</td></tr>
          <tr><td style="padding:8px;background:#f1f5f9;font-weight:bold;">Categoria</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${categoriaLabel}</td></tr>
          <tr><td style="padding:8px;background:#f1f5f9;font-weight:bold;">Assunto</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${assunto}</td></tr>
          <tr><td style="padding:8px;background:#f1f5f9;font-weight:bold;vertical-align:top;">Mensagem</td><td style="padding:8px;">${mensagem.replace(/\n/g, '<br/>')}</td></tr>
        </table>
      `
    });

    // Email de confirmação ao utilizador
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: user.email,
      subject: `Confirmação - Ticket ${numeroTicket} recebido`,
      body: `
        <h2>O seu ticket foi recebido com sucesso!</h2>
        <p>Olá ${user.full_name || 'Utilizador'},</p>
        <p>Recebemos o seu pedido de suporte com o número <strong>${numeroTicket}</strong>.</p>
        <p><strong>Assunto:</strong> ${assunto}</p>
        <p>A nossa equipa irá analisar e responder brevemente.</p>
        <br/>
        <p>Obrigado,<br/>Equipa DIROPS-SGA</p>
      `
    });

    return Response.json({ sucesso: true, numero_ticket: numeroTicket, ticket_id: ticket.id });

  } catch (error) {
    console.error('Erro ao enviar ticket:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});