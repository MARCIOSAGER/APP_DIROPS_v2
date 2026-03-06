import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  TrendingUp,
  Users
} from 'lucide-react';

export default function ReclamacoesStats({ reclamacoes, isLoading }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-slate-200 rounded w-1/2"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const stats = {
    total: reclamacoes.length,
    abertas: reclamacoes.filter(r => !['concluida', 'rejeitada'].includes(r.status)).length,
    concluidas: reclamacoes.filter(r => r.status === 'concluida').length,
    rejeitadas: reclamacoes.filter(r => r.status === 'rejeitada').length,
    emTratamento: reclamacoes.filter(r => ['em_analise', 'em_tratamento'].includes(r.status)).length,
    aguardandoFeedback: reclamacoes.filter(r => r.status === 'aguardando_feedback').length,
  };

  const taxaResolucao = stats.total > 0 ? ((stats.concluidas / stats.total) * 100).toFixed(1) : 0;

  // Calcular tempo médio de resolução (dias)
  const reclamacoesConcluidas = reclamacoes.filter(r => r.status === 'concluida' && r.data_conclusao);
  const tempoMedioResolucao = reclamacoesConcluidas.length > 0 ?
    reclamacoesConcluidas.reduce((acc, r) => {
      const inicio = new Date(r.data_recebimento);
      const fim = new Date(r.data_conclusao);
      const dias = Math.floor((fim - inicio) / (1000 * 60 * 60 * 24));
      return acc + dias;
    }, 0) / reclamacoesConcluidas.length : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-slate-600">Total</CardTitle>
          <FileText className="h-4 w-4 text-slate-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
          <p className="text-xs text-slate-500 mt-1">Reclamações registadas</p>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-slate-600">Abertas</CardTitle>
          <AlertTriangle className="h-4 w-4 text-orange-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-600">{stats.abertas}</div>
          <p className="text-xs text-slate-500 mt-1">Requerem atenção</p>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-slate-600">Em Tratamento</CardTitle>
          <Clock className="h-4 w-4 text-blue-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">{stats.emTratamento}</div>
          <p className="text-xs text-slate-500 mt-1">Sendo processadas</p>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-slate-600">Concluídas</CardTitle>
          <CheckCircle className="h-4 w-4 text-green-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{stats.concluidas}</div>
          <p className="text-xs text-slate-500 mt-1">Resolvidas</p>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-slate-600">Taxa Resolução</CardTitle>
          <TrendingUp className="h-4 w-4 text-emerald-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-emerald-600">{taxaResolucao}%</div>
          <p className="text-xs text-slate-500 mt-1">Taxa de sucesso</p>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-slate-600">Tempo Médio</CardTitle>
          <Users className="h-4 w-4 text-purple-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-purple-600">{Math.round(tempoMedioResolucao)}</div>
          <p className="text-xs text-slate-500 mt-1">Dias para resolver</p>
        </CardContent>
      </Card>
    </div>
  );
}