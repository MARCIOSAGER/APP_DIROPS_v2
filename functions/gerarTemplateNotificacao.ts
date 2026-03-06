import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verificar se é admin
    if (user.role !== 'admin' && !(user.perfis && user.perfis.includes('administrador'))) {
      return Response.json({ error: 'Acesso negado. Apenas administradores.' }, { status: 403 });
    }

    const { evento_gatilho, canal, placeholders } = await req.json();

    if (!evento_gatilho || !canal) {
      return Response.json({ 
        error: 'Parâmetros obrigatórios: evento_gatilho, canal' 
      }, { status: 400 });
    }

    // Mapeamento de eventos para contexto
    const eventosContexto = {
      voo_ligado_criado: {
        nome: 'Voo Ligado Criado',
        descricao: 'Notificação quando um novo voo ligado (chegada + partida) é criado no sistema',
        exemplos: 'Exemplo: Voo ARR DT123 chegou de FNSA às 14:30 e partida DEP DT456 para FNHU às 16:45'
      },
      voo_atualizado: {
        nome: 'Voo Atualizado',
        descricao: 'Notificação quando um voo existente é atualizado (horário, status, etc)',
        exemplos: 'Exemplo: Voo DT789 teve o horário alterado de 14:30 para 15:00'
      },
      voo_cancelado: {
        nome: 'Voo Cancelado',
        descricao: 'Notificação quando um voo é cancelado',
        exemplos: 'Exemplo: Voo DT321 foi cancelado devido a condições meteorológicas'
      },
      documento_novo: {
        nome: 'Novo Documento',
        descricao: 'Notificação quando um novo documento é carregado no sistema',
        exemplos: 'Exemplo: Novo Manual de Operações foi carregado no sistema'
      },
      credenciamento_novo: {
        nome: 'Novo Credenciamento',
        descricao: 'Notificação quando uma nova solicitação de credenciamento é criada',
        exemplos: 'Exemplo: Nova solicitação de credenciamento para João Silva da empresa TAAG'
      },
      reclamacao_nova: {
        nome: 'Nova Reclamação',
        descricao: 'Notificação quando uma nova reclamação é registrada',
        exemplos: 'Exemplo: Nova reclamação #123 sobre serviço de check-in no aeroporto FNLU'
      },
      inspecao_concluida: {
        nome: 'Inspeção Concluída',
        descricao: 'Notificação quando uma inspeção é concluída',
        exemplos: 'Exemplo: Inspeção de pista concluída em FNLU com 95% de conformidade'
      },
      auditoria_concluida: {
        nome: 'Auditoria Concluída',
        descricao: 'Notificação quando uma auditoria interna é concluída',
        exemplos: 'Exemplo: Auditoria de segurança concluída em FNLU com 98% de conformidade'
      },
      ordem_servico_criada: {
        nome: 'Ordem de Serviço Criada',
        descricao: 'Notificação quando uma nova ordem de serviço de manutenção é criada',
        exemplos: 'Exemplo: Ordem de Serviço #456 criada para reparo de iluminação na pista'
      }
    };

    const contextoEvento = eventosContexto[evento_gatilho] || {
      nome: evento_gatilho,
      descricao: 'Evento do sistema DIROPS-SGA',
      exemplos: ''
    };

    // Construir prompt para IA
    let prompt = '';
    
    if (canal === 'whatsapp') {
      prompt = `Você é um assistente especializado em criar templates de notificações profissionais para o sistema DIROPS-SGA (Sistema de Gestão Aeroportuária).

CONTEXTO:
Evento: ${contextoEvento.nome}
Descrição: ${contextoEvento.descricao}
${contextoEvento.exemplos ? `\n${contextoEvento.exemplos}` : ''}

PLACEHOLDERS DISPONÍVEIS:
${placeholders.join(', ')}

INSTRUÇÕES:
1. Crie um template de mensagem WhatsApp PROFISSIONAL e CONCISO
2. Use emojis apropriados (máximo 2-3 emojis relevantes)
3. Inclua o cabeçalho "🚀 Notificação DIROPS-SGA"
4. Use os placeholders fornecidos no formato {{placeholder}}
5. Mantenha a mensagem clara e objetiva (máximo 250 caracteres)
6. Use português de Angola
7. Formate de forma legível com quebras de linha quando apropriado

RETORNE APENAS O TEMPLATE, SEM EXPLICAÇÕES ADICIONAIS.`;
    } else if (canal === 'email_assunto') {
      prompt = `Você é um assistente especializado em criar assuntos de email profissionais para o sistema DIROPS-SGA (Sistema de Gestão Aeroportuária).

CONTEXTO:
Evento: ${contextoEvento.nome}
Descrição: ${contextoEvento.descricao}

PLACEHOLDERS DISPONÍVEIS:
${placeholders.join(', ')}

INSTRUÇÕES:
1. Crie um assunto de email PROFISSIONAL e INFORMATIVO
2. Máximo 60 caracteres
3. Use os placeholders fornecidos no formato {{placeholder}}
4. Seja claro e direto
5. Use português de Angola
6. NÃO use emojis
7. Inclua informação relevante para identificar o evento

RETORNE APENAS O ASSUNTO, SEM EXPLICAÇÕES ADICIONAIS.`;
    } else if (canal === 'email_corpo') {
      prompt = `Você é um assistente especializado em criar corpo de emails profissionais para o sistema DIROPS-SGA (Sistema de Gestão Aeroportuária).

CONTEXTO:
Evento: ${contextoEvento.nome}
Descrição: ${contextoEvento.descricao}
${contextoEvento.exemplos ? `\n${contextoEvento.exemplos}` : ''}

PLACEHOLDERS DISPONÍVEIS:
${placeholders.join(', ')}

INSTRUÇÕES:
1. Crie um corpo de email PROFISSIONAL em HTML
2. Use estrutura clara com cabeçalho, corpo principal e rodapé
3. Use os placeholders fornecidos no formato {{placeholder}}
4. Organize informações em seções lógicas usando <h3>, <p>, <ul>, etc
5. Use português de Angola
6. Inclua saudação formal apropriada
7. Inclua assinatura "Equipa DIROPS-SGA"
8. Use cores discretas (#004A99 para títulos, #666 para texto)
9. Mantenha o layout limpo e profissional
10. Máximo 400 palavras

RETORNE APENAS O HTML, SEM TAGS <html>, <head> ou <body> EXTERNAS. APENAS O CONTEÚDO DO EMAIL.`;
    }

    // Geração de template com IA desabilitada para poupar créditos
    let resultado = '';
    if (canal === 'whatsapp') {
      resultado = `🚀 Notificação DIROPS-SGA\n\nEvento: ${contextoEvento.nome}\n\n(Template automático com IA desabilitado. Edite este template manualmente.)`;
    } else if (canal === 'email_assunto') {
      resultado = `[DIROPS-SGA] ${contextoEvento.nome}`;
    } else if (canal === 'email_corpo') {
      resultado = `<h3>${contextoEvento.nome}</h3><p>Notificação do sistema DIROPS-SGA.</p><p>Template automático com IA desabilitado. Edite este template manualmente.</p><p>Equipa DIROPS-SGA</p>`;
    }

    return Response.json({ 
      template: resultado,
      evento: contextoEvento.nome
    });

  } catch (error) {
    console.error('Erro ao gerar template:', error);
    return Response.json({ 
      error: 'Erro ao gerar template com IA',
      details: error.message 
    }, { status: 500 });
  }
});