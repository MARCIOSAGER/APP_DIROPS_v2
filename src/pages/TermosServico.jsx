import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function TermosServico() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Button variant="ghost" className="mb-6 text-slate-600" onClick={() => window.history.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Termos de Serviço</h1>
            <p className="text-slate-500 text-sm mt-2">Última atualização: 16 de março de 2026</p>
          </div>

          <div className="prose prose-slate max-w-none space-y-4 text-slate-700 text-sm leading-relaxed">
            <h2 className="text-lg font-semibold text-slate-900">1. Aceitação dos termos</h2>
            <p>
              Ao aceder e utilizar o DIROPS (Sistema de Gestão Aeroportuária), concorda com estes Termos de Serviço. Se não concordar com algum destes termos, não deverá utilizar o sistema.
            </p>

            <h2 className="text-lg font-semibold text-slate-900">2. Descrição do serviço</h2>
            <p>
              O DIROPS é um sistema de gestão aeroportuária que disponibiliza funcionalidades de:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Gestão de operações de voo e movimentos aeroportuários</li>
              <li>Cálculo e gestão de tarifas aeroportuárias</li>
              <li>Emissão de proformas e documentos financeiros</li>
              <li>Gestão de segurança operacional (Safety)</li>
              <li>Inspeções, auditorias e manutenção</li>
              <li>Credenciamento de pessoal e empresas</li>
              <li>Gestão documental</li>
            </ul>

            <h2 className="text-lg font-semibold text-slate-900">3. Conta de utilizador</h2>
            <p>Para utilizar o sistema, é necessário:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Criar uma conta com informações verdadeiras e atualizadas</li>
              <li>Aguardar aprovação de acesso por um administrador</li>
              <li>Manter a confidencialidade das suas credenciais de acesso</li>
              <li>Notificar imediatamente qualquer uso não autorizado da sua conta</li>
            </ul>

            <h2 className="text-lg font-semibold text-slate-900">4. Uso aceitável</h2>
            <p>O utilizador compromete-se a:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Utilizar o sistema apenas para fins profissionais autorizados</li>
              <li>Não partilhar credenciais de acesso com terceiros</li>
              <li>Não tentar aceder a dados ou funcionalidades não autorizadas</li>
              <li>Inserir dados precisos e verdadeiros</li>
              <li>Cumprir todas as leis e regulamentos aplicáveis</li>
            </ul>

            <h2 className="text-lg font-semibold text-slate-900">5. Propriedade intelectual</h2>
            <p>
              Todo o conteúdo, design, código e funcionalidades do DIROPS são propriedade dos seus desenvolvedores. Os dados operacionais inseridos pelos utilizadores pertencem às respetivas organizações.
            </p>

            <h2 className="text-lg font-semibold text-slate-900">6. Disponibilidade do serviço</h2>
            <p>
              Esforçamo-nos para manter o sistema disponível 24/7, mas não garantimos disponibilidade ininterrupta. Poderão ocorrer períodos de manutenção programada ou interrupções imprevistas.
            </p>

            <h2 className="text-lg font-semibold text-slate-900">7. Limitação de responsabilidade</h2>
            <p>
              O sistema é fornecido "tal como está". Não nos responsabilizamos por perdas ou danos resultantes do uso do sistema, incluindo perda de dados, interrupções de serviço ou decisões tomadas com base em informações do sistema.
            </p>

            <h2 className="text-lg font-semibold text-slate-900">8. Suspensão e encerramento</h2>
            <p>
              Reservamo-nos o direito de suspender ou encerrar o acesso de qualquer utilizador que viole estes termos, sem aviso prévio.
            </p>

            <h2 className="text-lg font-semibold text-slate-900">9. Alterações aos termos</h2>
            <p>
              Estes termos podem ser atualizados periodicamente. Os utilizadores serão notificados de alterações significativas. O uso continuado do sistema após alterações constitui aceitação dos novos termos.
            </p>

            <h2 className="text-lg font-semibold text-slate-900">10. Contacto</h2>
            <p>
              Para questões relacionadas com estes termos, contacte-nos através do email disponível na página de Suporte do sistema.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
