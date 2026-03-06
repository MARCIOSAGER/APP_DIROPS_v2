export const downloadAsCSV = (data, filename = 'export') => {
  // Validação robusta dos dados de entrada
  if (!data || !Array.isArray(data) || data.length === 0) {
    console.warn("Tentativa de exportar dados vazios:", data);
    return false; // Retorna 'false' para indicar falha
  }

  // Verifica a estrutura dos dados para garantir que pode extrair os cabeçalhos
  if (data.length > 0 && (typeof data[0] !== 'object' || data[0] === null)) {
    console.error("Dados inválidos para exportação: os dados não são uma lista de objetos.", data);
    return false;
  }

  try {
    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(',')
    ];

    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        // Garante que o valor é uma string e escapa aspas
        const escaped = ('' + (value !== null && value !== undefined ? value : '')).replace(/"/g, '\\"');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    }

    const csvString = csvRows.join('\n');
    
    // Adicionar BOM para UTF-8 (ajuda com caracteres especiais)
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvString], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    return true; // Retorna 'true' para indicar sucesso
  } catch (error) {
    console.error("Erro durante a exportação:", error);
    return false; // Retorna 'false' em caso de erro
  }
};

export const downloadAsExcel = async (data, filename = 'export') => {
  // Validação robusta dos dados de entrada
  if (!data || !Array.isArray(data) || data.length === 0) {
    console.warn("Tentativa de exportar dados vazios:", data);
    return false;
  }

  if (data.length > 0 && (typeof data[0] !== 'object' || data[0] === null)) {
    console.error("Dados inválidos para exportação: os dados não são uma lista de objetos.", data);
    return false;
  }

  try {
    const XLSX = await import('xlsx');
    
    // Criar worksheet a partir dos dados
    const worksheet = XLSX.utils.json_to_sheet(data);
    
    // Ajustar largura das colunas automaticamente
    const headers = Object.keys(data[0]);
    const colWidths = headers.map(header => {
      const maxLength = Math.max(
        header.length,
        ...data.map(row => String(row[header] || '').length)
      );
      return { wch: Math.min(maxLength + 2, 50) }; // Máximo 50 caracteres
    });
    worksheet['!cols'] = colWidths;

    // Criar workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Dados');

    // Gerar arquivo Excel e fazer download
    const excelFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
    XLSX.writeFile(workbook, excelFilename);

    return true;
  } catch (error) {
    console.error("Erro durante a exportação Excel:", error);
    return false;
  }
};