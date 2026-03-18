import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CheckCircle,
  ArrowRight,
  User,
  Shield,
  Calendar,
  FileText
} from 'lucide-react';
import { createPageUrl } from '@/utils';
import { User as UserEntity } from '@/entities/User';
import { Empresa } from '@/entities/Empresa';
import { hasUserProfile, getPrimaryUserProfile, ensureUserProfilesExist, getEmpresaLogoByUser } from '@/components/lib/userUtils';
import { useI18n } from '@/components/lib/i18n';

const PERFIL_COLORS = {
  administrador: 'bg-purple-100 text-purple-800',
  operacoes: 'bg-blue-100 text-blue-800',
  infraestrutura: 'bg-orange-100 text-orange-800',
  credenciamento: 'bg-purple-100 text-purple-800',
  gestor_empresa: 'bg-yellow-100 text-yellow-800',
};

export default function BoasVindas() {
  const { t } = useI18n();
  const [user, setUser] = useState(null);
  const [empresas, setEmpresas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const [userData_raw, empresasData] = await Promise.all([
        UserEntity.me(),
        Empresa.list()
      ]);
      let userData = ensureUserProfilesExist(userData_raw);
      setUser(userData);
      setEmpresas(empresasData || []);

      // Se o utilizador só tem o perfil 'visualizador' ou nenhum perfil válido,
      // redirecionar para a solicitação de perfil
      const hasOnlyVisualizador = userData.perfis.length === 1 && hasUserProfile(userData, 'visualizador');
      const hasNoValidProfiles = !userData.perfis.some(p => PERFIL_COLORS[p]);

      if (hasOnlyVisualizador || hasNoValidProfiles) {
        window.location.href = createPageUrl('SolicitacaoPerfil');
        return;
      }
      
    } catch (error) {
      if (error.response?.status === 401) {
        window.location.href = createPageUrl('ValidacaoAcesso');
        return;
      }
      
      console.error('Erro ao carregar utilizador:', error);
      window.location.href = createPageUrl('ValidacaoAcesso');
    } finally {
      setIsLoading(false);
    }
  };

  const getRedirectUrl = () => {
    if (hasUserProfile(user, 'gestor_empresa')) {
      return createPageUrl('Credenciamento');
    }
    return createPageUrl('Home');
  };

  const handleContinue = () => {
    if (user?.email) {
      localStorage.setItem(`dirops_visited_${user.email}`, 'true');
    }
    window.location.href = getRedirectUrl();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 dark:from-blue-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">{t('boasVindas.carregando')}</p>
        </div>
      </div>
    );
  }
  
  let perfilPrincipal;

  const designatedPrimary = getPrimaryUserProfile(user);
  if (designatedPrimary && PERFIL_COLORS[designatedPrimary]) {
    perfilPrincipal = designatedPrimary;
  } else {
    if (user && user.perfis) {
      for (const profile of user.perfis) {
        if (PERFIL_COLORS[profile]) {
          perfilPrincipal = profile;
          break;
        }
      }
    }
  }

  const PERFIL_FEATURE_COUNTS = {
    administrador: 4,
    operacoes: 4,
    infraestrutura: 4,
    credenciamento: 3,
    gestor_empresa: 4,
  };

  const perfilColor = perfilPrincipal ? PERFIL_COLORS[perfilPrincipal] : null;
  const perfilTitle = perfilPrincipal ? t(`boasVindas.perfil_${perfilPrincipal}_title`) : null;
  const perfilDescription = perfilPrincipal ? t(`boasVindas.perfil_${perfilPrincipal}_desc`) : null;
  const featureCount = perfilPrincipal ? (PERFIL_FEATURE_COUNTS[perfilPrincipal] || 0) : 0;
  const perfilFeatures = Array.from({ length: featureCount }, (_, i) =>
    t(`boasVindas.perfil_${perfilPrincipal}_feat${i + 1}`)
  );

  if (!perfilPrincipal) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 dark:from-blue-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardContent className="text-center p-6">
              <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">{t('boasVindas.erroPerfilTitulo')}</h1>
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                {t('boasVindas.erroPerfilDesc')}
              </p>
              <Button onClick={() => window.location.href = createPageUrl('ValidacaoAcesso')}>
                {t('boasVindas.voltarLogin')}
              </Button>
            </CardContent>
          </Card>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 dark:from-blue-950 dark:via-slate-900 dark:to-slate-950 p-4">
      <div className="max-w-4xl mx-auto py-8">
        <div className="text-center mb-8">
          <img
            src={getEmpresaLogoByUser(user, empresas)}
            alt="DIROPS Logo"
            className="h-20 mx-auto mb-6"
          />
          <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            {t('boasVindas.titulo')}
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-400">
            {t('boasVindas.subtitulo')}
          </p>
        </div>

        <Card className="mb-8 shadow-lg border-0">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
            <div className="flex items-center gap-4">
              <div className="bg-white bg-opacity-20 p-3 rounded-full">
                <User className="w-8 h-8" />
              </div>
              <div>
                <CardTitle className="text-2xl text-white">{t('boasVindas.ola')}, {user.full_name}!</CardTitle>
                <p className="text-blue-100 dark:text-blue-200 mt-1">
                  {t('boasVindas.acessoConfigurado')}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  {t('boasVindas.perfilAcesso')}
                </h3>
                <Badge className={`${perfilColor} text-sm px-3 py-1 mb-3`}>
                  {perfilTitle}
                </Badge>
                <p className="text-slate-600 dark:text-slate-400">
                  {perfilDescription}
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  {t('boasVindas.infoConta')}
                </h3>
                <div className="space-y-2 text-sm">
                  <p><span className="font-medium">Email:</span> {user.email}</p>
                  <p><span className="font-medium">{t('boasVindas.contaCriada')}:</span> {new Date(user.created_date).toLocaleDateString('pt-AO')}</p>
                  <p><span className="font-medium">{t('boasVindas.ultimoAcesso')}:</span> {t('boasVindas.agora')}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-8 shadow-lg border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              {t('boasVindas.funcDisp')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              {perfilFeatures.map((feature, index) => (
                <div key={index} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-700 dark:text-slate-300">{feature}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="mb-8 bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <Shield className="w-6 h-6" />
              {t('boasVindas.infoSeguranca')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-amber-800 dark:text-amber-200">
              <p>• {t('boasVindas.seg1')}</p>
              <p>• {t('boasVindas.seg2')}</p>
              <p>• {t('boasVindas.seg3')}</p>
              <p>• {t('boasVindas.seg4')}</p>
            </div>
          </CardContent>
        </Card>

        <div className="text-center">
          <Button
            onClick={handleContinue}
            size="lg"
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3"
          >
            {t('boasVindas.acederSistema')}
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-4">
            {t('boasVindas.termosUso')}
          </p>
        </div>
      </div>
    </div>
  );
}