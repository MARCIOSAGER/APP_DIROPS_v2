import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PoliticaPrivacidade() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Button variant="ghost" className="mb-6 text-slate-600" onClick={() => window.history.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Política de Privacidade</h1>
            <p className="text-slate-500 text-sm mt-2">Última atualização: 16 de março de 2026</p>
          </div>

          <div className="prose prose-slate max-w-none space-y-4 text-slate-700 text-sm leading-relaxed">
            <h2 className="text-lg font-semibold text-slate-900">1. Informações que recolhemos</h2>
            <p>
              O DIROPS (Sistema de Gestão Aeroportuária) recolhe as seguintes informações pessoais necessárias para o funcionamento do sistema:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Nome completo e endereço de email</li>
              <li>Dados de autenticação (credenciais de acesso)</li>
              <li>Informações profissionais (cargo, aeroporto, empresa)</li>
              <li>Registos de atividade no sistema (logs de auditoria)</li>
              <li>Dados operacionais inseridos no âmbito das funções profissionais</li>
            </ul>

            <h2 className="text-lg font-semibold text-slate-900">2. Como utilizamos as informações</h2>
            <p>As informações recolhidas são utilizadas exclusivamente para:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Autenticação e controlo de acesso ao sistema</li>
              <li>Gestão de operações aeroportuárias</li>
              <li>Geração de relatórios operacionais e financeiros</li>
              <li>Auditoria e conformidade regulatória</li>
              <li>Comunicações relacionadas com o serviço</li>
            </ul>

            <h2 className="text-lg font-semibold text-slate-900">3. Partilha de dados</h2>
            <p>
              Não vendemos, alugamos ou partilhamos os seus dados pessoais com terceiros, exceto:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Quando necessário para cumprir obrigações legais ou regulatórias</li>
              <li>Com prestadores de serviços essenciais ao funcionamento do sistema (alojamento, email)</li>
              <li>Mediante o seu consentimento explícito</li>
            </ul>

            <h2 className="text-lg font-semibold text-slate-900">4. Segurança dos dados</h2>
            <p>
              Implementamos medidas de segurança técnicas e organizacionais para proteger os seus dados, incluindo:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Encriptação de dados em trânsito (HTTPS/TLS)</li>
              <li>Autenticação segura com suporte a autenticação de dois fatores (2FA)</li>
              <li>Controlo de acesso baseado em perfis e permissões</li>
              <li>Registo de auditoria de todas as ações no sistema</li>
              <li>Políticas de senha segura</li>
            </ul>

            <h2 className="text-lg font-semibold text-slate-900">5. Retenção de dados</h2>
            <p>
              Os dados pessoais são mantidos enquanto a sua conta estiver ativa e pelo período necessário para cumprir obrigações legais e regulatórias aplicáveis ao setor da aviação.
            </p>

            <h2 className="text-lg font-semibold text-slate-900">6. Os seus direitos</h2>
            <p>Tem o direito de:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Aceder aos seus dados pessoais</li>
              <li>Solicitar a correção de dados incorretos</li>
              <li>Solicitar a eliminação da sua conta</li>
              <li>Exportar os seus dados</li>
            </ul>

            <h2 className="text-lg font-semibold text-slate-900">7. Contacto</h2>
            <p>
              Para questões relacionadas com privacidade, contacte-nos através do email disponível na página de Suporte do sistema.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
