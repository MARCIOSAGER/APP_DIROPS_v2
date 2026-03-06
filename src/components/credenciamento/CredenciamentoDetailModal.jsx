import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  User, 
  Car, 
  Calendar, 
  MapPin, 
  FileText,
  Shield,
  Building,
  Clock,
  CheckCircle,
  Eye
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';

const STATUS_CONFIG = {
  pendente: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock, label: 'Pendente' },
  em_verificacao: { color: 'bg-blue-100 text-blue-800 border-blue-200', icon: Shield, label: 'Em Verificação' },
  aguardando_aprovacao_diretor: { color: 'bg-purple-100 text-purple-800 border-purple-200', icon: Clock, label: 'Aguardando Aprovação' },
  aprovado: { color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle, label: 'Aprovado' },
  rejeitado: { color: 'bg-red-100 text-red-800 border-red-200', icon: User, label: 'Rejeitado' },
  credenciado: { color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle, label: 'Credenciado' },
  expirado: { color: 'bg-gray-100 text-gray-800 border-gray-200', icon: Clock, label: 'Expirado' }
};

export default function CredenciamentoDetailModal({ isOpen, onClose, credenciamento, empresas, aeroportos }) {
  if (!credenciamento) return null;

  const statusConfig = STATUS_CONFIG[credenciamento.status] || STATUS_CONFIG.pendente;
  const StatusIcon = statusConfig.icon;

  const getEmpresaNome = (empresaId) => {
    const empresa = empresas.find(e => e.id === empresaId);
    return empresa?.nome || 'Empresa não encontrada';
  };

  const getAeroportoNome = (aeroportoId) => {
    const aeroporto = aeroportos.find(a => a.codigo_icao === aeroportoId);
    return aeroporto?.nome || aeroportoId;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" />
              Credenciamento - {credenciamento.protocolo_numero}
            </div>
            <Badge className={`${statusConfig.color} border`}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {statusConfig.label}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informações Básicas */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building className="w-5 h-5" />
                Informações Básicas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <Building className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600">Empresa:</span>
                  <span className="font-medium">{getEmpresaNome(credenciamento.empresa_solicitante_id)}</span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600">Aeroporto:</span>
                  <span className="font-medium">{getAeroportoNome(credenciamento.aeroporto_id)}</span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600">Data Solicitação:</span>
                  <span className="font-medium">
                    {format(parseISO(credenciamento.data_solicitacao), 'dd/MM/yyyy HH:mm', { locale: pt })}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <Shield className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600">Tipo:</span>
                  <div className="flex gap-1">
                    <Badge variant="outline" className="text-xs">
                      {credenciamento.tipo_credencial === 'pessoa' ? 'Pessoa' : 'Viatura'}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {credenciamento.periodo_validade === 'temporario' ? 'Temporário' : 'Permanente'}
                    </Badge>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-slate-700 mb-2">Justificativa do Acesso:</h4>
                <p className="text-slate-600 bg-slate-50 p-3 rounded-lg">{credenciamento.justificativa_acesso}</p>
              </div>

              {credenciamento.areas_acesso && credenciamento.areas_acesso.length > 0 && (
                <div>
                  <h4 className="font-medium text-slate-700 mb-2">Áreas de Acesso Solicitadas:</h4>
                  <div className="flex flex-wrap gap-2">
                    {credenciamento.areas_acesso.map((area, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {area}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dados Específicos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                {credenciamento.tipo_credencial === 'pessoa' ? (
                  <User className="w-5 h-5" />
                ) : (
                  <Car className="w-5 h-5" />
                )}
                Dados da {credenciamento.tipo_credencial === 'pessoa' ? 'Pessoa' : 'Viatura'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {credenciamento.tipo_credencial === 'pessoa' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="text-slate-600 text-sm">Nome Completo:</span>
                    <p className="font-medium">{credenciamento.nome_completo}</p>
                  </div>
                  <div>
                    <span className="text-slate-600 text-sm">Função:</span>
                    <p className="font-medium">{credenciamento.funcao_empresa}</p>
                  </div>
                  <div>
                    <span className="text-slate-600 text-sm">Documento:</span>
                    <p className="font-medium">{credenciamento.numero_passaporte}</p>
                  </div>
                  <div>
                    <span className="text-slate-600 text-sm">Nacionalidade:</span>
                    <p className="font-medium">{credenciamento.nacionalidade}</p>
                  </div>
                  {credenciamento.data_nascimento && (
                    <div>
                      <span className="text-slate-600 text-sm">Data de Nascimento:</span>
                      <p className="font-medium">
                        {format(parseISO(credenciamento.data_nascimento), 'dd/MM/yyyy', { locale: pt })}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="text-slate-600 text-sm">Matrícula:</span>
                    <p className="font-medium">{credenciamento.matricula_viatura}</p>
                  </div>
                  <div>
                    <span className="text-slate-600 text-sm">Modelo:</span>
                    <p className="font-medium">{credenciamento.modelo_viatura}</p>
                  </div>
                  <div>
                    <span className="text-slate-600 text-sm">Cor:</span>
                    <p className="font-medium">{credenciamento.cor_viatura}</p>
                  </div>
                  <div>
                    <span className="text-slate-600 text-sm">Condutor Principal:</span>
                    <p className="font-medium">{credenciamento.condutor_principal}</p>
                  </div>
                </div>
              )}

              {/* Período de Validade */}
              {credenciamento.periodo_validade === 'temporario' && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-2">Período de Validade:</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {credenciamento.data_inicio_validade && (
                      <div>
                        <span className="text-blue-700 text-sm">Data de Início:</span>
                        <p className="font-medium text-blue-900">
                          {format(parseISO(credenciamento.data_inicio_validade), 'dd/MM/yyyy', { locale: pt })}
                        </p>
                      </div>
                    )}
                    {credenciamento.data_fim_validade && (
                      <div>
                        <span className="text-blue-700 text-sm">Data de Fim:</span>
                        <p className="font-medium text-blue-900">
                          {format(parseISO(credenciamento.data_fim_validade), 'dd/MM/yyyy', { locale: pt })}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Documentos */}
          {credenciamento.documentos_anexos && credenciamento.documentos_anexos.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Documentos Anexados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {credenciamento.documentos_anexos.map((url, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-slate-500" />
                        <span className="text-sm font-medium">Documento {index + 1}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(url, '_blank')}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Timeline do Processo */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Timeline do Processo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <div className="flex-1">
                    <span className="text-sm font-medium">Solicitação Criada</span>
                    <p className="text-xs text-slate-500">
                      {format(parseISO(credenciamento.data_solicitacao), 'dd/MM/yyyy HH:mm', { locale: pt })}
                    </p>
                  </div>
                </div>

                {credenciamento.data_verificacao && (
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                    <div className="flex-1">
                      <span className="text-sm font-medium">Verificação Concluída</span>
                      <p className="text-xs text-slate-500">
                        {format(parseISO(credenciamento.data_verificacao), 'dd/MM/yyyy HH:mm', { locale: pt })}
                        {credenciamento.verificado_por && ` por ${credenciamento.verificado_por}`}
                      </p>
                      {credenciamento.observacoes_verificacao && (
                        <p className="text-xs text-slate-600 mt-1">{credenciamento.observacoes_verificacao}</p>
                      )}
                    </div>
                  </div>
                )}

                {credenciamento.data_aprovacao && (
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <div className="flex-1">
                      <span className="text-sm font-medium">Aprovação Concluída</span>
                      <p className="text-xs text-slate-500">
                        {format(parseISO(credenciamento.data_aprovacao), 'dd/MM/yyyy HH:mm', { locale: pt })}
                        {credenciamento.aprovado_por && ` por ${credenciamento.aprovado_por}`}
                      </p>
                      {credenciamento.observacoes_aprovacao && (
                        <p className="text-xs text-slate-600 mt-1">{credenciamento.observacoes_aprovacao}</p>
                      )}
                      {credenciamento.periodo_entrega_documentos && (
                        <div className="mt-2 p-2 bg-green-50 rounded border border-green-200">
                          <p className="text-xs text-green-800">
                            <strong>Período para entrega de documentos:</strong> {credenciamento.periodo_entrega_documentos}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {credenciamento.data_emissao_credencial && (
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                    <div className="flex-1">
                      <span className="text-sm font-medium">Credencial Emitida</span>
                      <p className="text-xs text-slate-500">
                        {format(parseISO(credenciamento.data_emissao_credencial), 'dd/MM/yyyy', { locale: pt })}
                      </p>
                      {credenciamento.numero_credencial && (
                        <p className="text-xs text-slate-600 mt-1">
                          <strong>Nº da Credencial:</strong> {credenciamento.numero_credencial}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end">
          <DialogClose asChild>
            <Button variant="outline">Fechar</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}