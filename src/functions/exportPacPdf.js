const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    const offset = date.getTimezoneOffset();
    const correctedDate = new Date(date.getTime() + (offset * 60 * 1000));
    const [year, month, day] = correctedDate.toISOString().split('T')[0].split('-');
    return `${day}/${month}/${year}`;
  } catch (e) {
    return dateString;
  }
};

export async function exportPacPdf({ pac, itens, aeroporto }) {
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="pt">
    <head>
      <meta charset="UTF-8">
      <title>Plano de Ação Corretiva - ${pac.numero_pac || 'Em Elaboração'}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; margin: 0; color: #333; }
        .container { padding: 30px; }
        .header { text-align: center; border-bottom: 2px solid #004A99; padding-bottom: 20px; margin-bottom: 20px; }
        .header h1 { color: #004A99; margin: 0; }
        .header p { color: #666; }
        .card { border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 20px; overflow: hidden; }
        .card-header { background-color: #f8fafc; padding: 15px; font-size: 1.1em; font-weight: bold; border-bottom: 1px solid #e2e8f0; }
        .card-content { padding: 15px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .info-item p { margin: 0; }
        .info-item strong { color: #4a5568; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; font-size: 0.9em; }
        th { background-color: #f1f5f9; }
        tr:nth-child(even) { background-color: #f8fafc; }
        .footer { text-align: center; margin-top: 30px; font-size: 0.8em; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Plano de Ação Corretiva (PAC)</h1>
          <p>Relatório gerado pelo sistema DIROPS</p>
        </div>

        <div class="card">
          <div class="card-header">Informações Gerais do PAC</div>
          <div class="card-content">
            <div class="info-grid">
              <div class="info-item"><p><strong>Número PAC:</strong> ${pac.numero_pac || 'A ser gerado'}</p></div>
              <div class="info-item"><p><strong>Aeroporto:</strong> ${aeroporto?.nome || 'N/A'}</p></div>
              <div class="info-item"><p><strong>Responsável:</strong> ${pac.responsavel_elaboracao || 'N/A'}</p></div>
              <div class="info-item"><p><strong>Prazo Conclusão:</strong> ${formatDate(pac.prazo_conclusao)}</p></div>
              <div class="info-item"><p><strong>Tipo:</strong> ${pac.tipo === 'formal_anac' ? 'Formal ANAC' : 'Interno'}</p></div>
              <div class="info-item"><p><strong>Status:</strong> ${pac.status || 'Elaboração'}</p></div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">Itens do PAC</div>
          <div class="card-content">
            <table>
              <thead>
                <tr>
                  <th>Item Auditado</th>
                  <th>Não Conformidade</th>
                  <th>Ação Proposta</th>
                  <th>Responsável</th>
                  <th>Prazo</th>
                </tr>
              </thead>
              <tbody>
                ${(itens || []).map(item => `
                  <tr>
                    <td><strong>${item.original_nc?.item?.numero || 'N/A'}:</strong> ${item.original_nc?.item?.item || 'N/A'}</td>
                    <td>${item.descricao_nao_conformidade || ''}</td>
                    <td>${item.acao_corretiva_proposta || ''}</td>
                    <td>${item.responsavel || ''}</td>
                    <td>${formatDate(item.prazo_implementacao)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
        <div class="footer">
          DIROPS - ${new Date().getFullYear()}
        </div>
      </div>
    </body>
    </html>
  `;

  return { data: htmlContent };
}
