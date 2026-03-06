// AI analysis disabled to save credits - returns stub
export async function analisarDocumento({ file_url, titulo }) {
  return {
    success: true,
    analise: {
      resumo: `Documento: ${titulo || 'Sem título'}. Análise automática com IA temporariamente desabilitada.`,
      categoria_sugerida: 'outro',
      palavras_chave: [],
      nivel_acesso_sugerido: ['visualizador'],
      topicos_principais: [],
    },
  };
}
