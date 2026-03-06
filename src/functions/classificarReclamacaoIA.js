// AI classification disabled to save credits - returns stub
export async function classificarReclamacaoIA({ descricao, assunto }) {
  return {
    success: true,
    classificacao: {
      categoria: 'outro',
      prioridade: 'media',
      area_responsavel: 'operacoes',
      resumo: (descricao || '').substring(0, 150),
      tags_sugeridas: [],
    },
  };
}
