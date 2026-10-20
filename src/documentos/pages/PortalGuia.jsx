// Guia do Portal de Documentos — a ajuda vive DENTRO do portal, ao lado do botão, não numa gaveta. Explica cada
// área em português simples, com o MESMO ícone e o MESMO rótulo do menu (reconhecer é mais fácil do que ler), e
// adapta-se ao perfil: cada pessoa vê só o que pode usar. Quando o portal muda, o guia acompanha, porque é montado
// a partir da mesma lista de páginas que o resto da aplicação (PAGINAS_PORTAL / usePodeVer).
import React from 'react';
import { Link } from 'react-router-dom';
import {
  Home, Library, Search, BookOpenCheck, Stamp, LayoutDashboard, FileText, FolderTree, FileClock,
  FolderLock, Scale, Hash, Link as LinkIcon, Users, ScrollText, BarChart, Settings,
  ArrowRight, Compass, ShieldCheck, Clock, Share2, CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PORTAL_BASE } from '@/lib/portalDocumentos';
import { T, usePodeVer, ehGestor, TituloSeccao } from '../PortalLayout';
import { useAuth } from '@/lib/AuthContext';

// Cada entrada: a chave da página (para só aparecer a quem a pode ver), o ícone e o rótulo iguais ao menu, o que a
// área faz, e uma dica de como se usa. O destino é a própria área, para o guia ser também um atalho.
const CONSULTA = [
  { pagina: 'inicio', icon: Home, titulo: 'Início', para: PORTAL_BASE,
    faz: 'A sua porta de entrada. Mostra a saudação, a caixa de pesquisa, o que há de novo e o que lhe falta confirmar.',
    como: 'É aqui que chega quando entra. Comece por escrever o que procura na caixa de pesquisa.' },
  { pagina: 'biblioteca', icon: Library, titulo: 'Biblioteca', para: `${PORTAL_BASE}/biblioteca`,
    faz: 'Todos os documentos a que tem acesso, arrumados por aeroporto e por pastas, tal como o manual está organizado.',
    como: 'Escolha o seu aeroporto e percorra as pastas. Abre-se o que está «Em vigor» — que é a versão válida.' },
  { pagina: 'pesquisa', icon: Search, titulo: 'Pesquisa', para: `${PORTAL_BASE}/pesquisa`,
    faz: 'Procura por número, por título ou por uma palavra escrita DENTRO dos documentos. Pode filtrar por manual, classe, estado e validade.',
    como: 'Escreva uma palavra e veja em que página de que documento ela aparece. Clicando, o leitor abre nessa página.' },
  { pagina: 'leituras', icon: BookOpenCheck, titulo: 'As minhas leituras', para: `${PORTAL_BASE}/leituras`,
    faz: 'Os documentos que lhe pedem para confirmar que leu, e os que já confirmou. Confirmar é a sua prova de que recebeu.',
    como: 'Abra o documento, leia-o e confirme. A lei dá 30 dias para confirmar uma emenda — não deixe acumular.' },
  { pagina: 'aprovacao', icon: Stamp, titulo: 'Aprovações', para: `${PORTAL_BASE}/aprovacao`,
    faz: 'Quando um documento espera a SUA assinatura — como revisor ou como director — aparece aqui.',
    como: 'Veja o documento, assine com a sua senha (fica registado quem assinou) ou devolva com um motivo.' },
];

const GESTAO = [
  { pagina: 'gestao', icon: LayoutDashboard, titulo: 'Painel', para: `${PORTAL_BASE}/gestao`,
    faz: 'A visão geral do portal para quem gere: o que está em vigor, o que falta, o que está a expirar.',
    como: 'É o resumo do dia. Os números levam ao sítio onde se trata de cada assunto.' },
  { pagina: 'gestao_documentos', icon: FileText, titulo: 'Documentos', para: `${PORTAL_BASE}/gestao/documentos`,
    faz: 'Carregar, editar, aprovar e publicar documentos. É onde o documento nasce e muda de estado.',
    como: 'Ao carregar, o sistema sugere o número e avisa se foge à codificação. Nada se publica sem passar pelos estados.' },
  { pagina: 'gestao_pastas', icon: FolderTree, titulo: 'Pastas', para: `${PORTAL_BASE}/gestao/pastas`,
    faz: 'A estrutura de pastas e quem vê o quê. É aqui que se decide o acesso.',
    como: 'Uma pasta pode ter senha e restringir-se a perfis. Quem não vê a pasta não vê os documentos lá dentro.' },
  { pagina: 'gestao_emendas', icon: FileClock, titulo: 'Emendas', para: `${PORTAL_BASE}/gestao/emendas`,
    faz: 'O registo de emendas no formato do Anexo 3, as folhas de controlo e as confirmações de recebimento.',
    como: 'Cada emenda dá 30 dias para o detentor confirmar. O que passar do prazo é escalado ao responsável do aeroporto.' },
  { pagina: 'gestao_avsec', icon: FolderLock, titulo: 'Regime AVSEC', para: `${PORTAL_BASE}/gestao/avsec`,
    faz: 'O regime próprio dos documentos de segurança da aviação: lista de páginas efectivas, cópias controladas, conferência semestral e credenciados.',
    como: 'Uma cópia controlada só se entrega a quem tem credencial válida. A conferência das cópias é semestral, por lei.' },
  { pagina: 'gestao_conformidade', icon: Scale, titulo: 'Conformidade', para: `${PORTAL_BASE}/gestao/conformidade`,
    faz: 'A matriz que liga cada requisito da lei ao documento, à revisão e à página que o cumpre — e mostra os buracos.',
    como: 'É o que responde a um inspector: «onde, no vosso manual, está o que cumpre este parágrafo?».' },
  { pagina: 'gestao_codificacao', icon: Hash, titulo: 'Codificação', para: `${PORTAL_BASE}/gestao/codificacao`,
    faz: 'As classes e os manuais que o número do documento codifica (POP-FNMO-MGSO-010: classe, aeroporto, manual, número).',
    como: 'Aqui nomeiam-se os processos e revê-se o que cada prefixo significa. Dois ainda esperam confirmação de nome.' },
  { pagina: 'gestao_links', icon: LinkIcon, titulo: 'Links', para: `${PORTAL_BASE}/gestao/links`,
    faz: 'Links partilháveis com pessoas de fora — auditores, ANAC. São temporários e só deixam ver, nunca alterar.',
    como: 'Defina o prazo e, se quiser, uma senha. O link expira sozinho; um documento retirado deixa de sair por ele.' },
  { pagina: 'gestao_acessos', icon: Users, titulo: 'Acessos', para: `${PORTAL_BASE}/gestao/acessos`,
    faz: 'Pedidos de acesso, convites e os perfis de cada pessoa.',
    como: 'É aqui que se convida alguém e se decide o que essa pessoa pode fazer no portal.' },
  { pagina: 'gestao_auditoria', icon: ScrollText, titulo: 'Auditoria', para: `${PORTAL_BASE}/gestao/auditoria`,
    faz: 'Quem viu, quem descarregou e quem alterou cada documento. O registo não se pode apagar nem mudar.',
    como: 'É a prova, numa inspecção, de que o controlo documental é real. Nada aqui se edita, de propósito.' },
  { pagina: 'gestao_relatorios', icon: BarChart, titulo: 'Relatórios', para: `${PORTAL_BASE}/gestao/relatorios`,
    faz: 'Leitura, validade e cobertura por aeroporto. Quem leu, o que está a expirar, o que falta.',
    como: 'Serve para acompanhar à distância, sem abrir documento a documento.' },
  { pagina: 'gestao_configuracoes', icon: Settings, titulo: 'Configurações', para: `${PORTAL_BASE}/gestao/configuracoes`,
    faz: 'A identidade do portal, os emails e as regras de retenção.',
    como: 'Mexe-se aqui raramente, e só quem administra o portal.' },
];

// Boas práticas: as quatro coisas que, se toda a gente souber, evitam a maioria dos enganos.
const PRATICAS = [
  { icon: CheckCircle2, titulo: '«Em vigor» é a versão a usar',
    texto: 'Use sempre o documento do portal, nunca a cópia que tem no computador. Só a versão «Em vigor» é a válida; as outras são história.' },
  { icon: BookOpenCheck, titulo: 'Confirmar a leitura é a sua prova',
    texto: 'Quando um documento lhe pede confirmação, confirmar é a prova de que o recebeu e leu. A lei exige-o, e fica registado.' },
  { icon: Clock, titulo: 'Uma emenda tem 30 dias',
    texto: 'Ao receber uma emenda, tem 30 dias para confirmar. Passado o prazo sem confirmação, o seu director é avisado.' },
  { icon: Share2, titulo: 'Links partilhados só mostram',
    texto: 'Um link enviado para fora é temporário e de leitura: a pessoa vê o documento, não lhe mexe nem navega no resto.' },
];

function Cartao({ icon: Icon, titulo, faz, como, para }) {
  return (
    <li>
      <Link to={para} className={cn('group flex h-full flex-col gap-2 rounded-xl border p-4 transition-colors sm:p-5', T.caixa, T.realce, T.foco)}>
        <div className="flex items-center gap-3">
          <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', T.acentoFundo)}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className={cn('flex-1 font-semibold', T.tinta)}>{titulo}</span>
          <ArrowRight className={cn('h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100', T.acento)} aria-hidden="true" />
        </div>
        <p className={cn('text-sm leading-relaxed', T.tintaMedia)}>{faz}</p>
        <p className={cn('mt-auto flex items-start gap-1.5 text-sm leading-relaxed', T.tintaFraca)}>
          <Compass className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{como}</span>
        </p>
      </Link>
    </li>
  );
}

export default function PortalGuia() {
  const { user } = useAuth();
  const podeVer = usePodeVer();
  const gestor = ehGestor(user);

  const consulta = CONSULTA.filter(c => podeVer(c.pagina));
  const gestao = gestor ? GESTAO.filter(c => podeVer(c.pagina)) : [];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-9">
      {/* Acolhimento, no mesmo tom da entrada. */}
      <header className={cn('relative overflow-hidden rounded-2xl border px-5 py-7 sm:px-8 sm:py-9', T.heroiFundo, T.heroiLinha)}>
        <Compass aria-hidden="true" className="pointer-events-none absolute -right-6 -top-6 h-36 w-36 rotate-12 text-teal-600/5 dark:text-teal-400/5" />
        <div className="relative max-w-2xl">
          <p className={cn('text-xs font-medium uppercase tracking-wider', T.acento)}>Guia de utilização</p>
          <h1 className={cn('mt-1.5 text-2xl font-semibold sm:text-3xl', T.tinta)}>Como usar o Portal de Documentos</h1>
          <p className={cn('mt-2 text-sm leading-relaxed sm:text-base', T.tintaMedia)}>
            Este portal guarda os manuais e documentos dos aeroportos da SGA de forma controlada: cada pessoa vê o que
            lhe compete, usa-se sempre a versão válida, e fica registado quem leu e quem aprovou. Abaixo, o que cada
            área faz — e, por baixo, quatro regras simples que evitam a maioria dos enganos.
          </p>
        </div>
      </header>

      {/* Primeiros passos: o caminho mais curto para quem entra pela primeira vez. */}
      <section>
        <TituloSeccao>Primeiros passos</TituloSeccao>
        <ol className={cn('divide-y overflow-hidden rounded-xl border', T.caixa, T.divisoria)}>
          {[
            ['Procure o que precisa', 'Na caixa de pesquisa do Início, escreva o número, o título ou uma palavra do documento.'],
            ['Abra e leia', 'Clique no documento. Abre na página certa, com o texto pesquisável e o estado à vista.'],
            ['Confirme, se lhe for pedido', 'Se o documento exigir confirmação de leitura, confirme — é a sua prova de que o recebeu.'],
          ].map(([t, d], i) => (
            <li key={t} className="flex items-start gap-3 p-4 sm:p-5">
              <span style={{ fontVariantNumeric: 'tabular-nums' }} className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold', T.acentoFundo)}>{i + 1}</span>
              <div>
                <p className={cn('font-medium', T.tinta)}>{t}</p>
                <p className={cn('mt-0.5 text-sm leading-relaxed', T.tintaMedia)}>{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* O que cada área faz — consulta (toda a gente). */}
      {consulta.length > 0 && (
        <section>
          <TituloSeccao>Para consultar</TituloSeccao>
          <ul className="grid gap-3 sm:grid-cols-2">
            {consulta.map(c => <Cartao key={c.pagina} {...c} />)}
          </ul>
        </section>
      )}

      {/* Gestão — só para quem gere. */}
      {gestao.length > 0 && (
        <section>
          <TituloSeccao>Para gerir</TituloSeccao>
          <p className={cn('-mt-1 mb-3 text-sm', T.tintaFraca)}>Estas áreas aparecem-lhe porque tem um perfil de gestão. Quem só consulta não as vê.</p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {gestao.map(c => <Cartao key={c.pagina} {...c} />)}
          </ul>
        </section>
      )}

      {/* Boas práticas. */}
      <section>
        <TituloSeccao>Quatro regras que evitam enganos</TituloSeccao>
        <ul className="grid gap-3 sm:grid-cols-2">
          {PRATICAS.map(({ icon: Icon, titulo, texto }) => (
            <li key={titulo} className={cn('flex gap-3 rounded-xl border p-4 sm:p-5', T.caixa)}>
              <ShieldCheck className={cn('hidden', T.acento)} aria-hidden="true" />
              <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', T.acentoFundo)}>
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className={cn('font-semibold', T.tinta)}>{titulo}</p>
                <p className={cn('mt-1 text-sm leading-relaxed', T.tintaMedia)}>{texto}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <p className={cn('pb-2 text-center text-sm', T.tintaFraca)}>
        Ficou com uma dúvida que o guia não responde? Fale com o gestor de documentos do seu aeroporto.
      </p>
    </div>
  );
}
