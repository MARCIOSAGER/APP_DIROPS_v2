import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Select from '@/components/ui/select';
import {
  FileText,
  User,
  Calendar,
  MapPin,
  Image,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Wrench,
  Loader2,
  ClipboardCheck
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { OrdemServico } from '@/entities/OrdemServico';
import { SolicitacaoServico } from '@/entities/SolicitacaoServico';
import useSubmitGuard from '@/hooks/useSubmitGuard';
import { useI18n } from '@/components/lib/i18n';

const STATUS_CONFIG = {
  aberta: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock, labelKey: 'analisarSS.statusAberta' },
  em_analise: { color: 'bg-blue-100 text-blue-800 border-blue-200', icon: Search, labelKey: 'analisarSS.statusEmAnalise' },
  aprovada: { color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle, labelKey: 'analisarSS.statusAprovada' },
  rejeitada: { color: 'bg-red-100 text-red-800 border-red-200', icon: XCircle, labelKey: 'analisarSS.statusRejeitada' }
};

const PRIORIDADE_CONFIG = {
  baixa: { color: 'bg-gray-100 text-gray-800 border-gray-200', labelKey: 'manutencao.baixa' },
  media: { color: 'bg-blue-100 text-blue-800 border-blue-200', labelKey: 'manutencao.media' },
  alta: { color: 'bg-orange-100 text-orange-800 border-orange-200', labelKey: 'manutencao.alta' },
  urgente: { color: 'bg-red-100 text-red-800 border-red-200', labelKey: 'manutencao.urgente' }
};

export default function AnalisarSSModal({ isOpen, onClose, solicitacao, aeroportos, currentUser, onSuccess, onApproved, onRejected }) {
  const { t } = useI18n();

  const categoriaOptions = [
    { value: 'infraestrutura', label: t('manutencaoForm.catInfraestrutura') },
    { value: 'equipamentos', label: t('manutencaoForm.catEquipamentos') },
    { value: 'sinalizacao', label: t('manutencaoForm.catSinalizacao') },
    { value: 'pavimento', label: t('manutencaoForm.catPavimento') },
    { value: 'drenagem', label: t('manutencaoForm.catDrenagem') },
    { value: 'iluminacao', label: t('manutencaoForm.catIluminacao') },
    { value: 'outros', label: t('manutencaoForm.catOutros') }
  ];

  const prioridadeOptions = [
    { value: 'baixa', label: t('manutencao.baixa') },
    { value: 'media', label: t('manutencao.media') },
    { value: 'alta', label: t('manutencao.alta') },
    { value: 'urgente', label: t('manutencao.urgente') }
  ];

  const tipoExecucaoOptions = [
    { value: 'interna', label: t('manutencaoForm.execInterna') },
    { value: 'terceirizado', label: t('manutencaoForm.execTerceirizado') }
  ];

  const [action, setAction] = useState(null); // 'aprovar' | 'rejeitar'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { guardedSubmit } = useSubmitGuard();
  const [motivoRejeicao, setMotivoRejeicao] = useState('');
  const [osForm, setOsForm] = useState({
    titulo: '',
    descricao_problema: '',
    aeroporto_id: '',
    categoria_manutencao: '',
    prioridade: 'media',
    tipo_execucao: 'interna',
    fornecedor: '',
    contato_fornecedor: ''
  });

  useEffect(() => {
    if (isOpen && solicitacao) {
      setAction(null);
      setMotivoRejeicao('');
      setOsForm({
        titulo: solicitacao.titulo || '',
        descricao_problema: solicitacao.descricao || '',
        aeroporto_id: solicitacao.aeroporto_id || '',
        categoria_manutencao: '',
        prioridade: solicitacao.prioridade_sugerida || 'media',
        tipo_execucao: 'interna',
        fornecedor: '',
        contato_fornecedor: ''
      });
    }
  }, [isOpen, solicitacao]);

  if (!solicitacao) return null;

  const statusConfig = STATUS_CONFIG[solicitacao.status] || STATUS_CONFIG.aberta;
  const prioridadeConfig = PRIORIDADE_CONFIG[solicitacao.prioridade_sugerida] || PRIORIDADE_CONFIG.media;
  const StatusIcon = statusConfig.icon;

  const getAeroportoNome = (aeroportoId) => {
    const aeroporto = aeroportos?.find(a => a.id === aeroportoId);
    return aeroporto?.nome || aeroportoId || '-';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return format(parseISO(dateStr), 'dd/MM/yyyy HH:mm', { locale: pt });
    } catch {
      return dateStr;
    }
  };

  const handleOsChange = (field, value) => {
    setOsForm(prev => ({ ...prev, [field]: value }));
  };

  const aeroportoOptions = (aeroportos || []).map(a => ({
    value: a.id,
    label: `${a.nome} (${a.codigo_icao})`
  }));

  const generateNumeroOrdem = async () => {
    const year = new Date().getFullYear();
    try {
      const empId = currentUser?.empresa_id;
      const existingOS = empId
        ? await OrdemServico.filter({ empresa_id: empId })
        : await OrdemServico.list();
      const thisYearOS = existingOS.filter(os => os.numero_ordem?.startsWith(`OS-${year}`));
      const maxNum = thisYearOS.reduce((max, os) => {
        const num = parseInt(os.numero_ordem?.split('-')[2]) || 0;
        return num > max ? num : max;
      }, 0);
      return `OS-${year}-${String(maxNum + 1).padStart(4, '0')}`;
    } catch {
      return `OS-${year}-0001`;
    }
  };

  const handleRejeitar = async () => {
    if (!motivoRejeicao.trim()) {
      alert(t('analisarSS.motivoObrigatorio'));
      return;
    }

    guardedSubmit(async () => {
      setIsSubmitting(true);
      try {
        await SolicitacaoServico.update(solicitacao.id, {
          status: 'rejeitada',
          motivo_rejeicao: motivoRejeicao,
          analisado_por: currentUser?.full_name,
          data_analise: new Date().toISOString()
        });
        if (onRejected) onRejected(solicitacao, motivoRejeicao);
        onSuccess();
        onClose();
      } catch (error) {
        console.error('Erro ao rejeitar solicitação:', error);
        alert(t('analisarSS.erroRejeitar'));
      } finally {
        setIsSubmitting(false);
      }
    });
  };

  const handleAprovar = async () => {
    if (!osForm.categoria_manutencao) {
      alert(t('analisarSS.categoriaObrigatoria'));
      return;
    }
    if (!osForm.titulo.trim()) {
      alert(t('analisarSS.tituloObrigatorio'));
      return;
    }

    guardedSubmit(async () => {
      setIsSubmitting(true);
      try {
        const numero_ordem = await generateNumeroOrdem();

        const osData = {
          numero_ordem,
          titulo: osForm.titulo,
          descricao_problema: osForm.descricao_problema,
          aeroporto_id: osForm.aeroporto_id,
          categoria_manutencao: osForm.categoria_manutencao,
          prioridade: osForm.prioridade,
          tipo_execucao: osForm.tipo_execucao,
          solicitacao_id: solicitacao.id,
          empresa_id: currentUser?.empresa_id,
          data_abertura: new Date().toISOString(),
          status: 'pendente'
        };

        if (osForm.tipo_execucao === 'terceirizado') {
          osData.fornecedor = osForm.fornecedor;
          osData.contato_fornecedor = osForm.contato_fornecedor;
        }

        const newOS = await OrdemServico.create(osData);

        await SolicitacaoServico.update(solicitacao.id, {
          status: 'aprovada',
          ordem_servico_id: newOS.id,
          analisado_por: currentUser?.full_name,
          data_analise: new Date().toISOString()
        });

        if (onApproved) onApproved(solicitacao, { ...osData, id: newOS.id });
        onSuccess();
        onClose();
      } catch (error) {
        console.error('Erro ao aprovar solicitação:', error);
        alert(t('analisarSS.erroAprovar'));
      } finally {
        setIsSubmitting(false);
      }
    });
  };

  const fotos = solicitacao.fotos || [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-blue-600" />
              {t('analisarSS.titulo')}
            </div>
            <div className="flex gap-2">
              <Badge className={`${statusConfig.color} border`}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {t(statusConfig.labelKey)}
              </Badge>
              <Badge className={`${prioridadeConfig.color} border`}>
                {t(prioridadeConfig.labelKey)}
              </Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Detalhes da SS */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5" />
                {t('analisarSS.detalhesSS')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold text-slate-900 mb-2">{solicitacao.titulo}</h4>
                <p className="text-slate-600 whitespace-pre-wrap">{solicitacao.descricao}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600">{t('analisarSS.aeroporto')}</span>
                  <span className="font-medium">{getAeroportoNome(solicitacao.aeroporto_id)}</span>
                </div>

                {solicitacao.localizacao && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-600">{t('analisarSS.localizacao')}</span>
                    <span className="font-medium">{solicitacao.localizacao}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600">{t('analisarSS.solicitante')}</span>
                  <span className="font-medium">{solicitacao.solicitante_nome || '-'}</span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600">{t('analisarSS.data')}</span>
                  <span className="font-medium">{formatDate(solicitacao.created_date)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Fotos */}
          {fotos.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Image className="w-5 h-5" />
                  {t('analisarSS.fotos')} ({fotos.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {fotos.map((foto, index) => (
                    <a
                      key={index}
                      href={foto.file_url || foto}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block overflow-hidden rounded-lg border border-slate-200 hover:border-blue-400 transition-colors"
                    >
                      <img
                        src={foto.file_url || foto}
                        alt={`Foto ${index + 1}`}
                        className="w-full h-32 object-cover"
                      />
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          {!action && (
            <div className="flex gap-3 justify-center">
              <Button
                onClick={() => setAction('aprovar')}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                {t('analisarSS.aprovarCriarOS')}
              </Button>
              <Button
                onClick={() => setAction('rejeitar')}
                variant="destructive"
              >
                <XCircle className="w-4 h-4 mr-2" />
                {t('analisarSS.rejeitar')}
              </Button>
            </div>
          )}

          {/* Rejeitar Form */}
          {action === 'rejeitar' && (
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-red-700">
                  <XCircle className="w-5 h-5" />
                  {t('analisarSS.rejeitarSolicitacao')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{t('analisarSS.motivoRejeicao')}</Label>
                  <Textarea
                    value={motivoRejeicao}
                    onChange={(e) => setMotivoRejeicao(e.target.value)}
                    placeholder={t('analisarSS.motivoPlaceholder')}
                    rows={4}
                    required
                  />
                </div>
                <div className="flex gap-3 justify-end">
                  <Button variant="outline" onClick={() => setAction(null)} disabled={isSubmitting}>
                    {t('analisarSS.voltar')}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleRejeitar}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {t('analisarSS.aRejeitar')}
                      </>
                    ) : (
                      t('analisarSS.confirmarRejeicao')
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Aprovar Form - Criar OS */}
          {action === 'aprovar' && (
            <Card className="border-green-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-green-700">
                  <Wrench className="w-5 h-5" />
                  {t('analisarSS.criarOS')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('analisarSS.tituloOS')}</Label>
                    <Input
                      value={osForm.titulo}
                      onChange={(e) => handleOsChange('titulo', e.target.value)}
                      placeholder={t('analisarSS.tituloOSPlaceholder')}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t('analisarSS.aeroportoOS')}</Label>
                    <Select
                      options={aeroportoOptions}
                      value={osForm.aeroporto_id}
                      onValueChange={(value) => handleOsChange('aeroporto_id', value)}
                      placeholder={t('analisarSS.selecionarAeroporto')}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t('analisarSS.descricaoProblema')}</Label>
                  <Textarea
                    value={osForm.descricao_problema}
                    onChange={(e) => handleOsChange('descricao_problema', e.target.value)}
                    placeholder={t('analisarSS.descricaoPlaceholder')}
                    rows={3}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>{t('analisarSS.categoriaOS')}</Label>
                    <Select
                      options={categoriaOptions}
                      value={osForm.categoria_manutencao}
                      onValueChange={(value) => handleOsChange('categoria_manutencao', value)}
                      placeholder={t('analisarSS.selecionarCategoria')}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t('analisarSS.prioridadeOS')}</Label>
                    <Select
                      options={prioridadeOptions}
                      value={osForm.prioridade}
                      onValueChange={(value) => handleOsChange('prioridade', value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t('analisarSS.tipoExecucao')}</Label>
                    <Select
                      options={tipoExecucaoOptions}
                      value={osForm.tipo_execucao}
                      onValueChange={(value) => handleOsChange('tipo_execucao', value)}
                    />
                  </div>
                </div>

                {osForm.tipo_execucao === 'terceirizado' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t('analisarSS.fornecedor')}</Label>
                      <Input
                        value={osForm.fornecedor}
                        onChange={(e) => handleOsChange('fornecedor', e.target.value)}
                        placeholder={t('analisarSS.fornecedorPlaceholder')}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('analisarSS.contactoFornecedor')}</Label>
                      <Input
                        value={osForm.contato_fornecedor}
                        onChange={(e) => handleOsChange('contato_fornecedor', e.target.value)}
                        placeholder={t('analisarSS.contactoPlaceholder')}
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-3 justify-end">
                  <Button variant="outline" onClick={() => setAction(null)} disabled={isSubmitting}>
                    {t('analisarSS.voltar')}
                  </Button>
                  <Button
                    onClick={handleAprovar}
                    disabled={isSubmitting}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {t('analisarSS.aCriarOS')}
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        {t('analisarSS.aprovarCriarOS')}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

