import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verificar autenticação
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tipo, dados, destinatario } = await req.json();

    if (!tipo || !dados) {
      return Response.json({ error: 'Tipo e dados são obrigatórios' }, { status: 400 });
    }

    let prompt = '';
    let assunto = '';

    if (tipo === 'notificacao_kpi') {
      assunto = `Alerta de KPI - ${dados.kpi_nome}`;
      prompt = `Gere um e-mail profissional notificando sobre um KPI fora da meta:

KPI: ${dados.kpi_nome}
Aeroporto: ${dados.aeroporto}
Data: ${dados.data}
Resultado: ${dados.resultado}
Meta: ${dados.meta}
Diferença: ${dados.diferenca}

O e-mail deve:
- Ser cordial e profissional
- Destacar o problema claramente
- Sugerir ações imediatas
- Solicitar feedback/ação do destinatário

Formato HTML.`;
    } else if (tipo === 'resposta_reclamacao') {
      assunto = `Resposta à sua Reclamação - Protocolo ${dados.protocolo}`;
      prompt = `Gere um e-mail de resposta profissional para uma reclamação:

Protocolo: ${dados.protocolo}
Reclamação: ${dados.descricao}
Ações Tomadas: ${dados.acoes_tomadas}
Responsável: ${dados.responsavel}

O e-mail deve:
- Agradecer o feedback
- Mostrar empatia
- Explicar as ações tomadas
- Pedir desculpas se apropriado
- Oferecer canal para mais informações

Formato HTML, tom cordial e respeitoso.`;
    } else if (tipo === 'alerta_manutencao') {
      assunto = `Alerta de Manutenção - Ordem ${dados.numero_ordem}`;
      prompt = `Gere um e-mail de alerta sobre manutenção:

Ordem de Serviço: ${dados.numero_ordem}
Equipamento: ${dados.equipamento}
Problema: ${dados.problema}
Prioridade: ${dados.prioridade}
Prazo: ${dados.prazo}

O e-mail deve:
- Alertar claramente sobre a necessidade de manutenção
- Especificar o prazo
- Indicar a prioridade
- Solicitar confirmação de recebimento

Formato HTML.`;
    } else if (tipo === 'resumo_auditoria') {
      assunto = `Resumo de Auditoria - ${dados.tipo_auditoria}`;
      prompt = `Gere um e-mail com resumo executivo de auditoria:

Tipo: ${dados.tipo_auditoria}
Aeroporto: ${dados.aeroporto}
Data: ${dados.data}
Conformidades: ${dados.conformes}
Não Conformidades: ${dados.nao_conformes}
Principais Achados: ${JSON.stringify(dados.achados)}

O e-mail deve:
- Apresentar um resumo executivo claro
- Destacar principais achados
- Indicar próximos passos
- Manter tom profissional

Formato HTML.`;
    }

    // Geração de email com IA desabilitada para poupar créditos
    const corpoEmail = `<p>Geração automática de email com IA temporariamente desabilitada.</p><p>Por favor, redija o email manualmente.</p>`;

    return Response.json({
      success: true,
      assunto: assunto,
      corpo: corpoEmail
    });

  } catch (error) {
    console.error('Erro ao gerar e-mail:', error);
    return Response.json({ 
      error: 'Erro ao gerar e-mail',
      details: error.message 
    }, { status: 500 });
  }
});