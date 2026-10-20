// Política de privacidade da Universidade Corporativa (página pública própria do portal; o DIROPS tem a sua).
import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PORTAL_BASE } from '@/lib/universidade';
import { useConfigPublica } from './hooks';

const SECCOES = [
  { t: '1. Informações que recolhemos', p: 'A Universidade Corporativa da SGA — Sociedade Gestora de Aeroportos recolhe as informações pessoais necessárias ao funcionamento da plataforma de formação:', itens: ['Nome completo e endereço de email', 'Dados de autenticação (credenciais de acesso à Universidade)', 'Informações profissionais (função, departamento, aeroporto ou local de trabalho, empresa)', 'Dados de formação (inscrições, progresso nas aulas, resultados de avaliações, presenças em sessões e certificados emitidos)', 'Registos de actividade na plataforma (auditoria)'] },
  { t: '2. Como utilizamos as informações', p: 'As informações recolhidas são utilizadas exclusivamente para:', itens: ['Autenticação e controlo de acesso à Universidade', 'Gestão da formação: inscrições, acompanhamento, avaliações, certificados e validade das certificações', 'Relatórios de formação e de conformidade com a formação obrigatória', 'Auditoria e cumprimento de obrigações regulatórias do sector da aviação', 'Comunicações relacionadas com a formação (convites, lembretes, convocatórias, avisos)'] },
  { t: '3. Partilha de dados', p: 'Não vendemos, alugamos nem partilhamos os seus dados pessoais com terceiros, excepto:', itens: ['Quando necessário para cumprir obrigações legais ou regulatórias', 'Com prestadores de serviços essenciais ao funcionamento da plataforma (alojamento, email)', 'Para validação pública de certificados: a página de validação mostra apenas o nome do formando, o curso, a data e o número do certificado'] },
  { t: '4. Segurança dos dados', p: 'Implementamos medidas técnicas e organizacionais para proteger os seus dados, incluindo:', itens: ['Autenticação própria da Universidade, com senhas seguras', 'Controlo de acesso baseado em perfis (formando, instrutor, administrador)', 'Registo de auditoria das acções na plataforma', 'Validação de certificados por código único'] },
  { t: '5. Retenção de dados', p: 'Os dados pessoais são mantidos enquanto a sua conta estiver activa. O histórico de formação e os certificados emitidos são conservados pelo período exigido pelas obrigações legais e regulatórias aplicáveis à formação no sector da aviação.' },
  { t: '6. Os seus direitos', p: 'Tem o direito de:', itens: ['Aceder aos seus dados pessoais e ao seu histórico de formação', 'Solicitar a correcção de dados incorrectos', 'Solicitar a eliminação da sua conta', 'Obter os seus certificados em formato digital'] },
];

export default function PortalPrivacidade() {
  const { data: cfg } = useConfigPublica();
  const nomePortal = cfg?.nome_portal || 'Universidade Corporativa';
  useEffect(() => { document.title = `Privacidade · ${nomePortal} · SGA`; }, [nomePortal]);
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12 dark:bg-slate-950">
      <div className="mx-auto max-w-3xl">
        <Button variant="ghost" className="mb-6 text-slate-600 dark:text-slate-400" onClick={() => (window.history.length > 1 ? window.history.back() : window.location.assign(PORTAL_BASE))}>
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" /> Voltar
        </Button>
        <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300"><ShieldCheck className="h-4 w-4" aria-hidden="true" />{nomePortal} · SGA</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">Política de Privacidade</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Última actualização: 1 de Outubro de 2026</p>
          </div>
          <div className="space-y-4 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {SECCOES.map(s => (
              <section key={s.t}>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{s.t}</h2>
                <p className="mt-1">{s.p}</p>
                {s.itens && <ul className="mt-2 list-disc space-y-1 pl-6">{s.itens.map(i => <li key={i}>{i}</li>)}</ul>}
              </section>
            ))}
            <section>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">7. Contacto</h2>
              <p className="mt-1">Para questões relacionadas com privacidade, contacte {cfg?.email_suporte ? <a href={`mailto:${cfg.email_suporte}`} className="text-violet-700 underline dark:text-violet-300">{cfg.email_suporte}</a> : 'o suporte da Universidade'} ou use a página <Link to={`${PORTAL_BASE}/ajuda`} className="text-violet-700 underline dark:text-violet-300">Ajuda e suporte</Link>.</p>
            </section>
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400"><Link to={`${PORTAL_BASE}/login`} className="hover:underline">Entrar na {nomePortal}</Link></p>
      </div>
    </div>
  );
}
