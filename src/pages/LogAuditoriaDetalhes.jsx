import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ArrowLeft,
  Shield,
  AlertTriangle,
  Calendar,
  User as UserIcon,
  Copy,
  CheckCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { LogAuditoria } from '@/entities/LogAuditoria';
import { hasUserProfile, isAdminProfile } from '@/components/lib/userUtils';
import { useAuth } from '@/lib/AuthContext';
import { useI18n } from '@/components/lib/i18n';

const ACTION_COLORS = {
  criar: 'bg-green-100 text-green-800',
  editar: 'bg-blue-100 text-blue-800',
  excluir: 'bg-red-100 text-red-800',
  visualizar: 'bg-gray-100 text-gray-800',
  exportar: 'bg-purple-100 text-purple-800',
  login: 'bg-emerald-100 text-emerald-800',
  logout: 'bg-orange-100 text-orange-800'
};

const MODULE_COLORS = {
  financeiro: 'bg-green-50 text-green-700',
  operacoes: 'bg-blue-50 text-blue-700',
  safety: 'bg-red-50 text-red-700',
  inspecoes: 'bg-purple-50 text-purple-700',
  manutencao: 'bg-orange-50 text-orange-700',
  documentos: 'bg-cyan-50 text-cyan-700',
  gestao: 'bg-indigo-50 text-indigo-700',
  grf: 'bg-teal-50 text-teal-700'
};

export default function LogAuditoriaDetalhesPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const logId = searchParams.get('id');

  const [log, setLog] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    checkAccessAndLoadData();
  }, [logId]);

  const checkAccessAndLoadData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const canAccessAuditLogs = isAdminProfile(user);

      if (!canAccessAuditLogs) {
        setHasAccess(false);
        setError({
          type: 'permission',
          message: t('logAuditoria.semAcesso'),
        });
        return;
      }

      setHasAccess(true);
      if (logId) {
        await loadLog(logId);
      } else {
        setError({
          type: 'notfound',
          message: t('logAuditoria.idNaoFornecido'),
        });
      }
    } catch (error) {
      console.error('Erro ao verificar acesso:', error);
      setError({
        type: 'error',
        message: t('logAuditoria.erroCarregar'),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadLog = async (id) => {
    try {
      const foundLog = await LogAuditoria.get(id);

      if (!foundLog) {
        setError({
          type: 'notfound',
          message: t('logAuditoria.logNaoEncontrado'),
        });
        return;
      }

      setLog(foundLog);
    } catch (error) {
      console.error('Erro ao carregar log:', error);
      setError({
        type: 'error',
        message: t('logAuditoria.erroCarregarDetalhes'),
      });
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <p className="text-slate-600">{t('logAuditoria.carregandoDetalhes')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 space-y-4">
        <Button variant="outline" onClick={() => navigate('/LogAuditoria')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('logAuditoria.voltar')}
        </Button>

        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="p-6 space-y-4">
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>{t('logAuditoria.acessoRestritoAdmin')}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!log) {
    return (
      <div className="p-6 space-y-4">
        <Button variant="outline" onClick={() => navigate('/LogAuditoria')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('logAuditoria.voltar')}
        </Button>
        <p className="text-slate-600">{t('logAuditoria.logNaoEncontrado')}</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <Button variant="outline" onClick={() => navigate('/LogAuditoria')}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        {t('logAuditoria.voltarLog')}
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-blue-600" />
            <CardTitle>{t('logAuditoria.detalhesLog')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Badges de ação e módulo */}
          <div className="flex gap-3">
            <Badge className={ACTION_COLORS[log.acao] || 'bg-gray-100 text-gray-800'}>
              {log.acao?.toUpperCase()}
            </Badge>
            {log.modulo && (
              <Badge variant="outline" className={MODULE_COLORS[log.modulo] || 'bg-gray-50 text-gray-700'}>
                {log.modulo}
              </Badge>
            )}
          </div>

          {/* Data e hora */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                {t('logAuditoria.dataHora')}
              </label>
              <p className="text-slate-900 font-mono">
                {format(new Date(log.created_date), 'dd/MM/yyyy HH:mm:ss', { locale: pt })}
              </p>
            </div>

            {/* ID do Log */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">{t('logAuditoria.idLog')}</label>
              <div className="flex items-center gap-2">
                <p className="text-slate-900 font-mono text-xs break-all">{log.id}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(log.id)}
                  className="h-auto p-1"
                >
                  {copied ? <CheckCircle className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>

          {/* Utilizador */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-4 rounded-lg">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <UserIcon className="w-4 h-4 inline mr-1" />
                {t('logAuditoria.nomeUtilizador')}
              </label>
              <p className="text-slate-900 font-medium">{log.usuario_nome || 'N/A'}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">{t('logAuditoria.emailUtilizador')}</label>
              <p className="text-slate-900 font-mono text-sm">{log.usuario_email || 'N/A'}</p>
            </div>
          </div>

          {/* Entidade */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">{t('logAuditoria.entidadeAfetada')}</label>
              <p className="text-slate-900 font-medium">{log.entidade || 'N/A'}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">{t('logAuditoria.idEntidade')}</label>
              <p className="text-slate-900 font-mono text-sm">{log.entidade_id || 'N/A'}</p>
            </div>
          </div>

          {/* Detalhes */}
          {log.detalhes && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">{t('logAuditoria.detalhesAcao')}</label>
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <p className="text-slate-700 text-sm whitespace-pre-wrap break-words">{log.detalhes}</p>
              </div>
            </div>
          )}

          {/* Alterações (se houver) */}
          {log.alteracoes && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">{t('logAuditoria.alteracoesRegistadas')}</label>
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <pre className="text-xs overflow-x-auto text-slate-700">
                  {JSON.stringify(log.alteracoes, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}