import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Calendar, 
  Clock, 
  User, 
  MapPin, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  FileText,
  Camera,
  Target
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';

import { RespostaInspecao } from '@/entities/RespostaInspecao';
import { ItemChecklist } from '@/entities/ItemChecklist';

const STATUS_CONFIG = {
  em_andamento: { color: 'bg-blue-100 text-blue-800', icon: Clock, label: 'Em Andamento' },
  concluida: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Concluída' },
  aprovada: { color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle, label: 'Aprovada' },
  rejeitada: { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Rejeitada' }
};

const RESULTADO_CONFIG = {
  conforme: { color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle, label: 'Conforme' },
  nao_conforme: { color: 'bg-red-100 text-red-800 border-red-200', icon: XCircle, label: 'Não Conforme' },
  nao_aplicavel: { color: 'bg-gray-100 text-gray-800 border-gray-200', icon: AlertCircle, label: 'N/A' }
};

export default function InspecaoDetailModal({ isOpen, onClose, inspecao, tipoInspecao, aeroporto }) {
  const [respostas, setRespostas] = useState([]);
  const [itensChecklist, setItensChecklist] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && inspecao) {
      loadInspecaoDetails();
    }
  }, [isOpen, inspecao]);

  const loadInspecaoDetails = async () => {
    setIsLoading(true);
    try {
      const [respostasData, itensData] = await Promise.all([
        RespostaInspecao.filter({ inspecao_id: inspecao.id }),
        ItemChecklist.filter({ tipo_inspecao_id: inspecao.tipo_inspecao_id }, 'ordem')
      ]);
      
      setRespostas(respostasData);
      setItensChecklist(itensData);
    } catch (error) {
      console.error('Erro ao carregar detalhes da inspeção:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getItemById = (itemId) => {
    return itensChecklist.find(item => item.id === itemId);
  };

  const getRespostaByItemId = (itemId) => {
    return respostas.find(resposta => resposta.item_checklist_id === itemId);
  };

  const statusConfig = STATUS_CONFIG[inspecao?.status] || STATUS_CONFIG.em_andamento;
  const StatusIcon = statusConfig.icon;

  if (!inspecao) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-600" />
            Detalhes da Inspeção: {tipoInspecao?.nome}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informações Gerais */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="w-5 h-5" />
                Informações Gerais
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  <span className="font-medium">Data:</span>
                  {format(parseISO(inspecao.data_inspecao), 'dd/MM/yyyy', { locale: pt })}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-slate-500" />
                  <span className="font-medium">Horário:</span>
                  {inspecao.hora_inicio} {inspecao.hora_fim && `- ${inspecao.hora_fim}`}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-slate-500" />
                  <span className="font-medium">Aeroporto:</span>
                  {aeroporto?.nome}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-slate-500" />
                  <span className="font-medium">Inspetor:</span>
                  {inspecao.inspetor_responsavel}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">Status:</span>
                <Badge className={`${statusConfig.color} border`}>
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {statusConfig.label}
                </Badge>
              </div>

              {inspecao.condicoes_climaticas && (
                <div>
                  <span className="font-medium text-sm">Condições Climáticas:</span>
                  <p className="text-sm text-slate-600 mt-1">{inspecao.condicoes_climaticas}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Estatísticas */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Estatísticas da Inspeção</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-slate-50 rounded-lg">
                  <div className="text-2xl font-bold text-slate-900">{inspecao.total_itens || 0}</div>
                  <div className="text-xs text-slate-500">Total de Itens</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-700">{inspecao.itens_conformes || 0}</div>
                  <div className="text-xs text-slate-500">Conformes</div>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-700">{inspecao.itens_nao_conformes || 0}</div>
                  <div className="text-xs text-slate-500">Não Conformes</div>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-700">
                    {inspecao.total_itens ? Math.round((inspecao.itens_conformes / inspecao.total_itens) * 100) : 0}%
                  </div>
                  <div className="text-xs text-slate-500">Conformidade</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Alerta de Ação Imediata */}
          {inspecao.requer_acao_imediata && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-red-700">
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-semibold">REQUER AÇÃO CORRETIVA IMEDIATA</span>
                </div>
                <p className="text-sm text-red-600 mt-1">
                  Esta inspeção identificou não conformidades que requerem ação corretiva imediata.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Checklist Detalhado */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Checklist Detalhado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-slate-500 mt-2">A carregar detalhes...</p>
                </div>
              ) : (
                itensChecklist.map((item) => {
                  const resposta = getRespostaByItemId(item.id);
                  const resultadoConfig = resposta ? RESULTADO_CONFIG[resposta.resultado] : null;
                  const ResultadoIcon = resultadoConfig?.icon;

                  return (
                    <div key={item.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-medium text-slate-900">
                            {item.ordem}. {item.item}
                          </h4>
                          {item.criterio && (
                            <p className="text-sm text-slate-600 mt-1">{item.criterio}</p>
                          )}
                        </div>
                        {resposta && resultadoConfig && (
                          <Badge className={`${resultadoConfig.color} border ml-4`}>
                            <ResultadoIcon className="w-3 h-3 mr-1" />
                            {resultadoConfig.label}
                          </Badge>
                        )}
                      </div>

                      {resposta && (
                        <div className="space-y-3 pl-4 border-l-2 border-slate-200">
                          {resposta.observacoes && (
                            <div>
                              <span className="font-medium text-sm text-slate-700">Observações:</span>
                              <p className="text-sm text-slate-600 mt-1">{resposta.observacoes}</p>
                            </div>
                          )}

                          {resposta.fotos && resposta.fotos.length > 0 && (
                            <div>
                              <span className="font-medium text-sm text-slate-700 flex items-center gap-1">
                                <Camera className="w-4 h-4" />
                                Fotos ({resposta.fotos.length}):
                              </span>
                              <div className="flex flex-wrap gap-2 mt-2">
                                {resposta.fotos.map((fotoUrl, index) => (
                                  <img
                                    key={index}
                                    src={fotoUrl}
                                    alt={`Foto ${index + 1}`}
                                    className="w-16 h-16 object-cover rounded border cursor-pointer hover:opacity-80"
                                    onClick={() => window.open(fotoUrl, '_blank')}
                                  />
                                ))}
                              </div>
                            </div>
                          )}

                          {resposta.resultado === 'nao_conforme' && (
                            <div className="bg-red-50 border border-red-200 rounded p-3 space-y-2">
                              <h5 className="font-medium text-red-800">Plano de Ação Corretiva</h5>
                              {resposta.acao_corretiva && (
                                <div>
                                  <span className="text-sm font-medium text-red-700">Ação:</span>
                                  <p className="text-sm text-red-600">{resposta.acao_corretiva}</p>
                                </div>
                              )}
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                {resposta.prazo_correcao && (
                                  <div>
                                    <span className="font-medium text-red-700">Prazo:</span>
                                    <p className="text-red-600">{format(parseISO(resposta.prazo_correcao), 'dd/MM/yyyy', { locale: pt })}</p>
                                  </div>
                                )}
                                {resposta.responsavel_correcao && (
                                  <div>
                                    <span className="font-medium text-red-700">Responsável:</span>
                                    <p className="text-red-600">{resposta.responsavel_correcao}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Resumo Geral */}
          {inspecao.resumo_geral && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Resumo Geral</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-700 whitespace-pre-wrap">{inspecao.resumo_geral}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}