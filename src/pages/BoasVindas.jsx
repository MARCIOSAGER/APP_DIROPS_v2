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

const PERFIL_INFO = {
  administrador: {
    title: 'Administrador do Sistema',
    description: 'Acesso completo a todas as funcionalidades e gestão de utilizadores',
    color: 'bg-purple-100 text-purple-800',
    features: [
      'Gestão completa de utilizadores e acessos',
      'Configuração de aeroportos e companhias',
      'Supervisão de todas as operações',
      'Relatórios executivos completos'
    ]
  },
  operacoes: {
    title: 'Operações Aeroportuárias',
    description: 'Gestão de voos, movimentos e processos operacionais',
    color: 'bg-blue-100 text-blue-800',
    features: [
      'Registo e gestão de voos',
      'Controlo de movimentos aeroportuários',
      'Gestão de ligações entre voos',
      'Relatórios operacionais'
    ]
  },
  infraestrutura: {
    title: 'Infraestrutura e Manutenção',
    description: 'Gestão de ativos, inspeções e ordens de serviço',
    color: 'bg-orange-100 text-orange-800',
    features: [
      'Gestão de inspeções aeroportuárias',
      'Ordens de serviço e manutenção',
      'Controlo de ativos e equipamentos',
      'Planeamento de manutenções'
    ]
  },
  credenciamento: {
    title: 'Credenciamento',
    description: 'Gestão de credenciais de acesso',
    color: 'bg-purple-100 text-purple-800',
    features: [
      'Gestão de credenciais',
      'Controlo de acessos',
      'Documentação de credenciamento'
    ]
  },
  gestor_empresa: {
    title: 'Gestor de Empresa',
    description: 'Gestão de credenciais e informações da empresa',
    color: 'bg-yellow-100 text-yellow-800',
    features: [
      'Gestão de credenciais da empresa',
      'Visualização de dados operacionais',
      'Submissão de documentos',
      'Comunicação com a administração'
    ]
  }
};

export default function BoasVindas() {
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
      const hasNoValidProfiles = !userData.perfis.some(p => PERFIL_INFO[p]);

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
          <p className="text-slate-600 dark:text-slate-400">A carregar informações...</p>
        </div>
      </div>
    );
  }
  
  let perfilPrincipal;
  let perfilInfo;

  const designatedPrimary = getPrimaryUserProfile(user);
  if (designatedPrimary && PERFIL_INFO[designatedPrimary]) {
    perfilPrincipal = designatedPrimary;
    perfilInfo = PERFIL_INFO[designatedPrimary];
  } else {
    if (user && user.perfis) { 
      for (const profile of user.perfis) {
        if (PERFIL_INFO[profile]) {
          perfilPrincipal = profile;
          perfilInfo = PERFIL_INFO[profile];
          break;
        }
      }
    }
  }
  
  if (!perfilInfo) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 dark:from-blue-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardContent className="text-center p-6">
              <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Erro de Perfil Inesperado</h1>
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                Não foi possível determinar um perfil de acesso válido. Por favor, contacte o administrador do sistema.
              </p>
              <Button onClick={() => window.location.href = createPageUrl('ValidacaoAcesso')}>
                Voltar ao Login
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
            Bem-vindo ao DIROPS
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-400">
            Sistema de Gestão Aeroportuária
          </p>
        </div>

        <Card className="mb-8 shadow-lg border-0">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
            <div className="flex items-center gap-4">
              <div className="bg-white bg-opacity-20 p-3 rounded-full">
                <User className="w-8 h-8" />
              </div>
              <div>
                <CardTitle className="text-2xl text-white">Olá, {user.full_name}!</CardTitle>
                <p className="text-blue-100 dark:text-blue-200 mt-1">
                  O seu acesso ao sistema foi configurado com sucesso.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Perfil de Acesso
                </h3>
                <Badge className={`${perfilInfo.color} text-sm px-3 py-1 mb-3`}>
                  {perfilInfo.title}
                </Badge>
                <p className="text-slate-600 dark:text-slate-400">
                  {perfilInfo.description}
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Informações da Conta
                </h3>
                <div className="space-y-2 text-sm">
                  <p><span className="font-medium">Email:</span> {user.email}</p>
                  <p><span className="font-medium">Conta criada:</span> {new Date(user.created_date).toLocaleDateString('pt-AO')}</p>
                  <p><span className="font-medium">Último acesso:</span> Agora</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-8 shadow-lg border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              Funcionalidades Disponíveis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              {perfilInfo.features.map((feature, index) => (
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
              Informações de Segurança
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-amber-800 dark:text-amber-200">
              <p>• Mantenha as suas credenciais de acesso seguras e não as partilhe.</p>
              <p>• Termine sempre a sua sessão ao finalizar o trabalho.</p>
              <p>• Reporte qualquer actividade suspeita ao administrador do sistema.</p>
              <p>• Os seus acessos e actividades são monitorizados para segurança.</p>
            </div>
          </CardContent>
        </Card>

        <div className="text-center">
          <Button
            onClick={handleContinue}
            size="lg"
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3"
          >
            Aceder ao Sistema
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-4">
            Ao continuar, concorda com os termos de uso e políticas de segurança do sistema.
          </p>
        </div>
      </div>
    </div>
  );
}