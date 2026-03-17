import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, Edit, UserPlus, Mail, Trash2, PlayCircle, CheckCircle, ClipboardCheck } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

import AlertModal from '@/components/shared/AlertModal';
import SendEmailModal from '@/components/shared/SendEmailModal';
import { OrdemServico } from '@/entities/OrdemServico';
import { useI18n } from '@/components/lib/i18n';

const PRIORIDADE_CONFIG = {
  baixa: { labelKey: 'manutencao.baixa', color: 'bg-green-100 text-green-800' },
  media: { labelKey: 'manutencao.media', color: 'bg-yellow-100 text-yellow-800' },
  alta: { labelKey: 'manutencao.alta', color: 'bg-orange-100 text-orange-800' },
  urgente: { labelKey: 'manutencao.urgente', color: 'bg-red-100 text-red-800' },
};

const STATUS_CONFIG = {
  pendente: { labelKey: 'osList.statusPendente', color: 'bg-gray-100 text-gray-800' },
  atribuida: { labelKey: 'osList.statusAtribuida', color: 'bg-blue-100 text-blue-800' },
  em_execucao: { labelKey: 'osList.statusEmExecucao', color: 'bg-purple-100 text-purple-800' },
  aguardando_verificacao: { labelKey: 'osList.statusAguardandoVerificacao', color: 'bg-cyan-100 text-cyan-800' },
  concluida: { labelKey: 'osList.statusConcluida', color: 'bg-green-100 text-green-800' },
  rejeitada: { labelKey: 'osList.statusRejeitada', color: 'bg-red-100 text-red-800' },
};

const getPriorityColor = (prioridade) => PRIORIDADE_CONFIG[prioridade]?.color || 'bg-gray-200 text-gray-800';
const getStatusColor = (status) => STATUS_CONFIG[status]?.color || 'bg-gray-200 text-gray-800';

const generateEmailBody = (ordem) => {
  if (!ordem) return '';
  return `
Prezado(a),

Informações sobre a Ordem de Serviço ${ordem.numero_ordem}:

Título: ${ordem.titulo}
Prioridade: ${PRIORIDADE_CONFIG[ordem.prioridade]?.label || ordem.prioridade}
Status: ${STATUS_CONFIG[ordem.status]?.label || ordem.status}
Data de Abertura: ${new Date(ordem.data_abertura).toLocaleDateString('pt-AO')}
Responsável: ${ordem.responsavel_manutencao || 'Não atribuído'}
Descrição: ${ordem.descricao || 'N/A'}

Por favor, verifique os detalhes no sistema.

Atenciosamente,
Sua Equipe de Manutenção
  `;
};

export default function ManutencaoList({
  ordensServico,
  aeroportos,
  isLoading,
  onReload,
  canManage,
  selectedOrdens,
  setSelectedOrdens,
  onOpenDetail,
  onAtribuir,
  onResponder,
  onEdit,
  onSendEmail
}) {
  const { t } = useI18n();
  const [deleteInfo, setDeleteInfo] = useState({ isOpen: false, id: null, title: '', message: '' });
  const [selectedOrdem, setSelectedOrdem] = useState(null);
  const [emailModalOpen, setEmailModalOpen] = useState(false);

  const handleSelectAll = (e) => {
    setSelectedOrdens(e.target.checked ? ordensServico.map((os) => os.id) : []);
  };

  const handleViewDetails = (ordem) => {
    if (onOpenDetail) onOpenDetail(ordem);
  };

  const handleEdit = (ordem) => {
    if (onEdit) onEdit(ordem);
  };

  const handleAtribuir = (ordem) => {
    if (onAtribuir) onAtribuir(ordem);
  };

  const handleDelete = (ordem) => {
    setDeleteInfo({
      isOpen: true,
      id: ordem.id,
      title: t('osList.excluirOS'),
      message: t('osList.confirmarExcluir').replace('{numero}', ordem.numero_ordem)
    });
  };

  const handleDeleteConfirm = async () => {
    try {
      await OrdemServico.delete(deleteInfo.id);
      setDeleteInfo({ isOpen: false, id: null, title: '', message: '' });
      if (onReload) onReload();
    } catch (error) {
      console.error('Erro ao excluir ordem:', error);
      alert(t('osList.erroExcluir'));
    }
  };

  const handleSendEmail = (ordem) => {
    setSelectedOrdem(ordem);
    setEmailModalOpen(true);
  };

  const handleEmailSend = async (recipient, subject) => {
    if (onSendEmail) {
      return await onSendEmail(recipient, subject, selectedOrdem);
    }
    return false;
  };

  const colSpanCount = canManage ? 8 : 7;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-4 bg-white rounded-t-xl border-b border-slate-200">
        <h2 className="text-xl font-semibold text-slate-800">{t('osList.titulo')}</h2>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {canManage && (
                  <th className="text-left p-4 font-semibold text-slate-700 w-12">
                    <input
                      type="checkbox"
                      onChange={handleSelectAll}
                      checked={ordensServico.length > 0 && selectedOrdens.length === ordensServico.length}
                    />
                  </th>
                )}
                <th className="text-left p-4 font-semibold text-slate-700">{t('osList.nOrdem')}</th>
                <th className="text-left p-4 font-semibold text-slate-700">{t('osList.tituloCol')}</th>
                <th className="text-left p-4 font-semibold text-slate-700">{t('osList.prioridade')}</th>
                <th className="text-left p-4 font-semibold text-slate-700">{t('osList.status')}</th>
                <th className="text-left p-4 font-semibold text-slate-700">{t('osList.dataAbertura')}</th>
                <th className="text-left p-4 font-semibold text-slate-700">{t('osList.responsavel')}</th>
                <th className="text-left p-4 font-semibold text-slate-700">{t('osList.acoes')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr className="bg-white">
                  <td colSpan={colSpanCount} className="text-center p-4 text-slate-500">{t('osList.aCarregar')}</td>
                </tr>
              ) : ordensServico.length === 0 ? (
                <tr className="bg-white">
                  <td colSpan={colSpanCount} className="text-center p-4 text-slate-500">{t('osList.nenhumaOrdem')}</td>
                </tr>
              ) : (
                ordensServico.map((ordem, index) => {
                  const aeroporto = aeroportos.find(a => a.id === ordem.aeroporto_id);
                  return (
                    <tr key={ordem.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      {canManage && (
                        <td className="p-4">
                          <input
                            type="checkbox"
                            checked={selectedOrdens.includes(ordem.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedOrdens([...selectedOrdens, ordem.id]);
                              } else {
                                setSelectedOrdens(selectedOrdens.filter(id => id !== ordem.id));
                              }
                            }}
                          />
                        </td>
                      )}
                      <td className="p-4 font-mono text-sm font-medium text-slate-900">
                        {ordem.numero_ordem}
                      </td>
                      <td className="p-4">
                        <div className="font-medium text-slate-900">{ordem.titulo}</div>
                        <div className="text-sm text-slate-500">{aeroporto?.nome || 'N/A'}</div>
                      </td>
                      <td className="p-4">
                        <Badge className={getPriorityColor(ordem.prioridade)}>
                          {t(PRIORIDADE_CONFIG[ordem.prioridade]?.labelKey) || ordem.prioridade}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <Badge className={getStatusColor(ordem.status)}>
                          {t(STATUS_CONFIG[ordem.status]?.labelKey) || t('osList.desconhecido')}
                        </Badge>
                      </td>
                      <td className="p-4 text-slate-600">
                        {format(new Date(ordem.created_date), 'dd/MM/yyyy', { locale: pt })}
                      </td>
                      <td className="p-4 text-slate-600">
                        {ordem.responsavel_manutencao || t('osList.naoAtribuido')}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleViewDetails(ordem)} title={t('osList.verDetalhes')}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          {/* Action: Accept (atribuida -> em_execucao) */}
                          {ordem.status === 'atribuida' && (
                            <Button variant="ghost" size="icon" onClick={() => onResponder && onResponder(ordem, 'aceitar')} title={t('osList.aceitarIniciar')} className="text-green-600 hover:text-green-700">
                              <PlayCircle className="w-4 h-4" />
                            </Button>
                          )}
                          {/* Action: Conclude (em_execucao -> aguardando_verificacao) */}
                          {ordem.status === 'em_execucao' && (
                            <Button variant="ghost" size="icon" onClick={() => onResponder && onResponder(ordem, 'concluir')} title={t('osList.concluirExecucao')} className="text-blue-600 hover:text-blue-700">
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                          )}
                          {/* Action: Verify/Approve (aguardando_verificacao -> concluida) */}
                          {canManage && ordem.status === 'aguardando_verificacao' && (
                            <Button variant="ghost" size="icon" onClick={() => onResponder && onResponder(ordem, 'verificar')} title={t('osList.verificarAprovar')} className="text-orange-600 hover:text-orange-700">
                              <ClipboardCheck className="w-4 h-4" />
                            </Button>
                          )}
                          {canManage && (
                            <>
                              <Button variant="ghost" size="icon" onClick={() => handleEdit(ordem)} title={t('osList.editar')}>
                                <Edit className="w-4 h-4" />
                              </Button>
                              {ordem.status === 'pendente' && (
                                <Button variant="ghost" size="icon" onClick={() => handleAtribuir(ordem)} title={t('osList.atribuir')}>
                                  <UserPlus className="w-4 h-4" />
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" onClick={() => handleSendEmail(ordem)} title={t('osList.enviarEmail')}>
                                <Mail className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDelete(ordem)} className="text-red-600 hover:text-red-700" title={t('osList.excluir')}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AlertModal
        isOpen={deleteInfo.isOpen}
        onClose={() => setDeleteInfo({ isOpen: false, id: null, title: '', message: '' })}
        onConfirm={handleDeleteConfirm}
        title={deleteInfo.title}
        message={deleteInfo.message}
        type="error"
      />

      <SendEmailModal
        isOpen={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        onSend={handleEmailSend}
        defaultSubject={selectedOrdem ? `${t('osList.enviarOSEmail')} - ${selectedOrdem.numero_ordem}` : ''}
        title={t('osList.enviarOSEmail')}
      />
    </div>
  );
}