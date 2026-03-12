export async function exportAuditoriaPdf({ processo, respostas, itens, aeroporto, tipo, pacs }) {
  if (!processo || !aeroporto || !tipo) {
    return { error: 'Dados obrigatórios em falta' };
  }

  const html = `
  <!DOCTYPE html>
  <html>
  <head>
      <meta charset="UTF-8">
      <title>Relatório de Auditoria</title>
      <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; margin: 20px; color: #333; }
          .header { text-align: center; margin-bottom: 30px; }
          h1 { color: #1e3a8a; }
          h2 { color: #1e40af; border-bottom: 2px solid #93c5fd; padding-bottom: 5px; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; background: #f1f5f9; padding: 20px; border-radius: 8px; }
          .section { margin-bottom: 30px; }
          .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
          .stat-card { background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; text-align: center; }
          .stat-card h3 { margin: 0 0 10px 0; font-size: 14px; color: #64748b; }
          .stat-card p { font-size: 24px; font-weight: bold; margin: 0; }
          .nc-item { background: #fff1f2; border: 1px solid #ffdde1; padding: 15px; margin-bottom: 15px; border-radius: 8px; }
          .nc-item h4 { color: #be123c; margin-top: 0; }
          @media print {
              body { margin: 0; }
              .info-grid, .stat-card, .nc-item { page-break-inside: avoid; }
          }
      </style>
  </head>
  <body>
      <div class="header">
          <h1>RELATÓRIO DE AUDITORIA INTERNA</h1>
          <p>Sistema DIROPS</p>
      </div>

      <div class="info-grid">
          <div>
              <h3>Informações da Auditoria</h3>
              <p><strong>Aeroporto:</strong> ${aeroporto.nome || 'N/A'}</p>
              <p><strong>Tipo:</strong> ${tipo.nome || 'N/A'}</p>
              <p><strong>Categoria:</strong> ${tipo.categoria || 'N/A'}</p>
          </div>
          <div>
              <h3>Detalhes da Execução</h3>
              <p><strong>Data:</strong> ${processo.data_auditoria ? new Date(processo.data_auditoria).toLocaleDateString('pt-BR') : 'N/A'}</p>
              <p><strong>Auditor Responsável:</strong> ${processo.auditor_responsavel || 'N/A'}</p>
              <p><strong>Status:</strong> ${processo.status || 'N/A'}</p>
          </div>
      </div>

      <div class="section">
          <h2>Resumo Executivo</h2>
          <div class="stats">
              <div class="stat-card">
                  <h3>Total de Itens</h3>
                  <p>${processo.total_itens || 0}</p>
              </div>
              <div class="stat-card">
                  <h3>Conformes</h3>
                  <p style="color: #16a34a;">${processo.itens_conformes || 0}</p>
              </div>
              <div class="stat-card">
                  <h3>Não Conformes</h3>
                  <p style="color: #dc2626;">${processo.itens_nao_conformes || 0}</p>
              </div>
              <div class="stat-card">
                  <h3>Conformidade</h3>
                  <p style="color: #1e40af;">${(processo.percentual_conformidade || 0).toFixed(1)}%</p>
              </div>
          </div>
      </div>

      ${respostas && respostas.length > 0 && respostas.some(r => r.situacao_encontrada === 'NC') ? `
      <div class="section">
          <h2>Não Conformidades Identificadas</h2>
          ${respostas.filter(r => r.situacao_encontrada === 'NC').map((nc, index) => {
              const item = itens?.find(i => i.id === nc.item_auditoria_id);
              return `
              <div class="nc-item">
                  <h4>${index + 1}. Item ${item?.numero || 'N/A'}: ${item?.item || 'N/A'}</h4>
                  <p><strong>Referência:</strong> ${item?.referencia_norma || 'N/A'}</p>
                  <p><strong>Observação:</strong> ${nc.observacao || 'N/A'}</p>
                  ${nc.acao_corretiva_recomendada ? `<p><strong>Ação Corretiva Recomendada:</strong> ${nc.acao_corretiva_recomendada}</p>` : ''}
              </div>
              `;
          }).join('')}
      </div>
      ` : ''}

      <div class="section">
          <p style="text-align: center; color: #94a3b8; font-size: 12px;"><em>Relatório gerado em ${new Date().toLocaleString('pt-BR')}</em></p>
      </div>
  </body>
  </html>
  `;

  return { data: html };
}
