// Privacidade e tratamento de dados do Portal de Documentos (página pública própria do portal).
// Molde: src/universidade/PortalPrivacidade.jsx, com o conteúdo adaptado à gestão documental — o portal regista
// quem abre, descarrega e confirma a leitura de cada documento, e isto explica o quê e para quê.
import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ShieldCheck, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabaseClient';
import { PORTAL_BASE } from '@/lib/portalDocumentos';

const NOME_PADRAO = 'Documentos SGA';

// Configuração visível sem sessão (vista documentos_config_publica). Falha em silêncio.
function useConfigPublicaDocs() {
  return useQuery({
    queryKey: ['gd', 'config-publica'],
    retry: 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from('documentos_config_publica').select('*').maybeSingle();
      return data || {};
    },
  });
}

const SECCOES = [
  {
    t: '1. O que é este portal',
    p: 'O Portal de Documentos da SGA — Sociedade Gestora de Aeroportos guarda e distribui documentação controlada dos aeroportos: manuais, procedimentos, normas, instruções de trabalho e documentos de referência. É um sistema interno de acesso restrito: cada pessoa vê apenas os documentos das pastas e dos aeroportos a que foi autorizada.',
  },
  {
    t: '2. Dados que recolhemos sobre si',
    p: 'Recolhemos apenas o necessário para dar acesso aos documentos e para provar que a documentação foi distribuída e lida:',
    itens: [
      'Identificação: nome completo e endereço de email',
      'Credenciais de acesso ao portal (a senha é guardada cifrada e ninguém a consegue ler, nem os administradores)',
      'Dados profissionais que indicar: empresa ou entidade, departamento, função e aeroporto ou local de trabalho',
      'Perfil e autorizações no portal: pastas, aeroportos e páginas a que tem acesso',
      'Registos de actividade sobre documentos (ver o ponto seguinte)',
    ],
  },
  {
    t: '3. Registo de consultas, descargas e confirmações de leitura',
    p: 'Cada vez que mexe num documento, o portal guarda um registo. Concretamente, fica registado:',
    itens: [
      'Quem abriu ou pré-visualizou um documento, qual a versão e em que data e hora',
      'Quem descarregou o ficheiro, e quantas vezes',
      'Quem confirmou a leitura («li e tomei conhecimento»), de que versão e quando',
      'O endereço IP e o navegador usados no acesso',
      'As acções de gestão: quem carregou, alterou, aprovou, publicou, tornou obsoleto ou apagou um documento, e quem criou ou revogou links de partilha',
    ],
  },
  {
    t: '4. Para que servem esses registos',
    p: 'O registo de leituras e de acessos não existe para vigiar o trabalho de ninguém. Serve para:',
    itens: [
      'Provar, numa auditoria interna ou de uma autoridade do sector, que a versão em vigor de um procedimento foi distribuída e tomada em conhecimento por quem a tem de aplicar',
      'Saber quem ainda não confirmou a leitura de um documento obrigatório, para lhe enviar um lembrete',
      'Controlar a confidencialidade: detectar acessos indevidos a documentos restritos',
      'Produzir relatórios de cobertura por aeroporto e por pasta (quantos leram, quantos faltam), sem expor conteúdo nenhum do documento',
      'Recuperar o histórico de versões de um documento e saber quem o aprovou',
    ],
  },
  {
    t: '5. Quem vê os seus registos',
    p: 'Os registos de leitura e de acesso são visíveis apenas a quem tem de os ver:',
    itens: [
      'A si: tem sempre à mão a lista das suas leituras confirmadas e das que lhe faltam',
      'Aos gestores documentais e administradores do portal, para acompanhamento e auditoria',
      'Ao responsável do seu aeroporto, quanto aos documentos desse aeroporto',
    ],
  },
  {
    t: '6. Partilha com terceiros',
    p: 'Não vendemos, alugamos nem cedemos os seus dados pessoais. Os dados do portal só saem da SGA nestes casos:',
    itens: [
      'Para cumprir obrigações legais ou pedidos legítimos das autoridades do sector da aviação',
      'Com prestadores de serviços essenciais ao funcionamento do portal (alojamento e envio de email)',
      'Através de links de partilha criados por um gestor para um auditor ou entidade externa: esses links dão acesso apenas aos documentos ou às pastas escolhidas, têm prazo de validade, podem ser revogados a qualquer momento e as suas aberturas também ficam registadas',
    ],
  },
  {
    t: '7. Segurança',
    p: 'Os documentos não ficam acessíveis na Internet: são servidos a partir de um armazenamento privado, por endereços temporários gerados no momento, e o servidor decide o que cada pessoa pode ver. Além disso:',
    itens: [
      'O acesso é controlado por perfil, por pasta e por aeroporto, do lado do servidor',
      'Há documentos que podem exigir uma senha adicional ou que não permitem descarga, apenas leitura no ecrã',
      'Os documentos podem levar marca de água com a identificação de uso interno',
      'Todas as acções de gestão ficam registadas e os registos não podem ser alterados pelos utilizadores',
    ],
  },
  {
    t: '8. Durante quanto tempo guardamos',
    p: 'Os dados da sua conta são guardados enquanto o acesso estiver activo. Os registos de leitura, de acesso e de auditoria são conservados pelo período exigido pelas obrigações legais e regulatórias aplicáveis à documentação do sector da aviação — são a prova de que a documentação foi controlada. Os documentos apagados ficam primeiro numa lixeira, por um período definido na configuração do portal, e só depois são eliminados em definitivo.',
  },
  {
    t: '9. Os seus direitos',
    p: 'Pode, a qualquer momento:',
    itens: [
      'Consultar os dados da sua conta e a lista das suas leituras',
      'Pedir a correcção de dados errados (nome, função, aeroporto)',
      'Pedir a eliminação da sua conta e o fim do acesso ao portal',
      'Saber quais os seus registos de acesso guardados no portal',
    ],
  },
];

export default function PortalPrivacidade() {
  const { data: cfg } = useConfigPublicaDocs();
  const nomePortal = cfg?.nome_portal || NOME_PADRAO;
  useEffect(() => { document.title = `Privacidade · ${nomePortal} · SGA`; }, [nomePortal]);
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12 dark:bg-slate-950">
      <div className="mx-auto max-w-3xl">
        <Button variant="ghost" className="mb-6 h-11 text-slate-600 dark:text-slate-400" onClick={() => (window.history.length > 1 ? window.history.back() : window.location.assign(PORTAL_BASE))}>
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" /> Voltar
        </Button>
        <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-lg dark:border-slate-700 dark:bg-slate-900 md:p-8">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300"><ShieldCheck className="h-4 w-4" aria-hidden="true" />{nomePortal} · SGA</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">Privacidade e tratamento de dados</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Última actualização: 2 de Outubro de 2026</p>
          </div>

          <p className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-100">
            <Eye className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <span>Em resumo: este portal regista quem abre, quem descarrega e quem confirma a leitura de cada documento, com data, hora e versão. Esse registo é a prova de que a documentação controlada foi distribuída e tomada em conhecimento — é por isso que existe.</span>
          </p>

          <div className="space-y-5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {SECCOES.map(s => (
              <section key={s.t}>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{s.t}</h2>
                <p className="mt-1">{s.p}</p>
                {s.itens && <ul className="mt-2 list-disc space-y-1 pl-6">{s.itens.map(i => <li key={i}>{i}</li>)}</ul>}
              </section>
            ))}
            <section>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">10. Contacto</h2>
              <p className="mt-1">
                Para exercer qualquer destes direitos, ou para qualquer dúvida sobre o tratamento dos seus dados, contacte{' '}
                {cfg?.email_suporte
                  ? <a href={`mailto:${cfg.email_suporte}`} className="text-teal-700 underline dark:text-teal-300">{cfg.email_suporte}</a>
                  : 'a gestão documental da SGA'}.
              </p>
            </section>
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
          <Link to={`${PORTAL_BASE}/login`} className="hover:underline">Entrar no {nomePortal}</Link>
        </p>
      </div>
    </div>
  );
}
