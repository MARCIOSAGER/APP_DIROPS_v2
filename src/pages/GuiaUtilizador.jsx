import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BookOpen, Plane, DollarSign, Shield, ClipboardCheck,
  Users, FileText, MessageSquare, Settings, ChevronDown, ChevronRight,
  BarChart3, Wrench, Bell, Search, Layers, Upload, Gauge, FolderOpen,
  Send, LifeBuoy, Building2, ExternalLink, Printer, ChevronsDownUp
} from "lucide-react";
import { createPageUrl } from "@/utils";
import { useI18n } from '@/components/lib/i18n';

const sections = [
  {
    id: "dashboard",
    icon: BarChart3,
    color: "text-blue-600",
    bg: "bg-blue-50",
    title: "Dashboard Operacional",
    pageKey: "Home",
    conteudo: [
      { subtitulo: "Visão Geral", texto: "O Dashboard apresenta um resumo em tempo real das operações aeroportuárias. Pode filtrar por aeroporto e por período (7, 30 ou 90 dias)." },
      { subtitulo: "Cartões de Estatísticas", texto: "No topo encontra 7 indicadores principais: Total de Voos, Chegadas e Partidas hoje, Taxa de Pontualidade, Ocorrências Abertas, Inspeções Pendentes e Passageiros no período." },
      { subtitulo: "Voos Ligados & Tarifas", texto: "Secção dedicada a mostrar o total de voos ligados (ARR+DEP), tempo médio de permanência e faturação gerada." },
      { subtitulo: "Gráficos", texto: "Movimentos por mês, pontualidade, receitas e alertas de safety são apresentados em gráficos interativos na parte inferior da página." },
    ]
  },
  {
    id: "operacoes",
    icon: Plane,
    color: "text-green-600",
    bg: "bg-green-50",
    title: "Operações",
    pageKey: "Operacoes",
    conteudo: [
      { subtitulo: "Registar Voo", texto: "Clique em 'Novo Voo' para registar chegadas (ARR) ou partidas (DEP). Preencha o número de voo, data, aeronave, companhia, passageiros e carga." },
      { subtitulo: "Voos Ligados", texto: "Um voo ligado é um par ARR+DEP da mesma aeronave. O sistema cria automaticamente o voo ligado quando deteta o par. Pode também ligar manualmente clicando no ícone de ligação na tabela." },
      { subtitulo: "Cálculo de Tarifas", texto: "Após criar um voo ligado, o sistema calcula automaticamente as tarifas de pouso, permanência, passageiros e carga. Os valores aparecem na coluna 'Tarifa'." },
      { subtitulo: "Importação em Massa", texto: "Importe voos em massa a partir de ficheiros Excel (AIAAN/Base44), evitando a entrada manual. Veja a secção 'Importação de Voos' para o passo-a-passo." },
      { subtitulo: "Exportar", texto: "A tabela de voos pode ser exportada para Excel (XLSX) ou PDF para relatórios e arquivo." },
    ]
  },
  {
    id: "importacao",
    icon: Upload,
    color: "text-violet-600",
    bg: "bg-violet-50",
    title: "Importação de Voos",
    pageKey: "ImportacaoAiaan",
    conteudo: [
      { subtitulo: "Origem dos Dados", texto: "Importe voos a partir de ficheiros Excel (.xlsx ou .xls) exportados do sistema Base44 ou AIAAN. O sistema processa automaticamente os dados e cria os registos de voos correspondentes." },
      { subtitulo: "Processo de Importação", texto: "Através de um assistente de 4 passos: (1) Carregue o ficheiro Excel, (2) Revise e mapeie operadores e destinos, (3) Pré-visualize os dados a importar, (4) Execute a importação automática." },
      { subtitulo: "Mapeamento Automático", texto: "O sistema normaliza automaticamente nomes de operadores (companhias aéreas) e cidades/aeroportos para códigos ICAO. Quando não encontra correspondência, solicita ao utilizador preencher o código ICAO correto." },
      { subtitulo: "Criação de Recursos", texto: "Aeronaves novas são criadas automaticamente se não existirem no sistema. Voos são registados como 'Realizado' com origem 'Base44', e pares ARR+DEP da mesma aeronave são ligados automaticamente." },
      { subtitulo: "Cálculo de Tarifas", texto: "Após importar, o sistema calcula automaticamente tarifas de pouso, permanência, passageiros e carga para cada voo ligado, gerando os dados necessários para faturação." },
    ]
  },
  {
    id: "kpis",
    icon: Gauge,
    color: "text-rose-600",
    bg: "bg-rose-50",
    title: "KPIs Operacionais",
    pageKey: "KPIsOperacionais",
    conteudo: [
      { subtitulo: "O que são KPIs", texto: "Os KPIs Operacionais são indicadores de desempenho que permitem monitorizar operações aeroportuárias. Cada KPI tem uma meta associada e é medido regularmente para avaliar se a operação está dentro dos parâmetros esperados." },
      { subtitulo: "Filtros de Pesquisa", texto: "Pode filtrar as medições por Aeroporto, Tipo de KPI, Período de Datas e Número de Voo. Clique em 'Buscar' para aplicar os filtros ou 'Limpar' para voltar a ver todos os registos." },
      { subtitulo: "Registar Nova Medição", texto: "Na aba 'Nova Medição', escolha o tipo de KPI e preencha a data, hora de início e fim, número de voo, companhia aérea, responsável e observações. O sistema calcula automaticamente se a medição está dentro da meta." },
      { subtitulo: "Indicadores por Aeroporto", texto: "O painel mostra 4 cartões: Total de KPIs configurados, Total de Medições, Medições de Hoje e Medições Dentro da Meta. Utilizadores locais vêem apenas os dados do seu aeroporto." },
      { subtitulo: "Exportar e Partilhar", texto: "Exporte os dados em Excel ou PDF, ou envie um relatório por email. O PDF inclui resumo de performance, detalhes de cada KPI e a tabela completa de medições." },
    ]
  },
  {
    id: "faturacao",
    icon: DollarSign,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    title: "Fundo de Maneio & Proformas",
    pageKey: "FundoManeio",
    conteudo: [
      { subtitulo: "Fundo de Maneio", texto: "Registe movimentos financeiros (receitas e despesas) por aeroporto. O sistema gera gráficos e resumos mensais automaticamente." },
      { subtitulo: "Proformas", texto: "Gere proformas de faturação com base nos cálculos de tarifas. Selecione o período e o aeroporto para gerar o documento." },
      { subtitulo: "Tarifas Configuráveis", texto: "Em Configurações Gerais pode definir as tarifas de pouso, permanência, passageiros e carga, bem como impostos aplicáveis." },
    ]
  },
  {
    id: "servicos",
    icon: Layers,
    color: "text-cyan-600",
    bg: "bg-cyan-50",
    title: "Serviços Aeroportuários",
    pageKey: "ServicosAeroportuarios",
    conteudo: [
      { subtitulo: "Serviços de Voo", texto: "Na aba 'Serviços de Voo' pode lançar cobranças de serviços adicionais por voo ligado — check-in, CUPPSS, fast track, assistência especial, assistência bagagem e BRS. Os valores unitários são carregados automaticamente das tarifas configuradas." },
      { subtitulo: "Bombeiros", texto: "Na aba 'Bombeiros' registe cobranças de serviço de combate a incêndio. Selecione o cliente, tipo de serviço, quantidade e data." },
      { subtitulo: "Cursos e Licenças", texto: "Na aba 'Cursos e Licenças' registe cobranças de cursos de segurança operacional/AVSEC e licenças LCLA, associadas a clientes (companhias ou empresas)." },
      { subtitulo: "Clientes", texto: "Os clientes (companhias aéreas, empresas de logística, etc.) são geridos na aba 'Clientes' em Configuração de Tarifas. São entidades separadas das empresas operadoras do sistema (ATO, SGA)." },
    ]
  },
  {
    id: "safety",
    icon: Shield,
    color: "text-red-600",
    bg: "bg-red-50",
    title: "Safety",
    pageKey: "Safety",
    conteudo: [
      { subtitulo: "Registar Ocorrência", texto: "Clique em 'Nova Ocorrência' para registar: FOD, Incursão de Pista, Bird Strike, Acidentes e outros. Defina a gravidade e o status." },
      { subtitulo: "Evidências", texto: "Pode anexar fotografias diretamente ao registo da ocorrência para documentar a situação." },
      { subtitulo: "Acompanhamento", texto: "Altere o status de 'Aberta' para 'Em Investigação' ou 'Fechada' conforme o progresso do tratamento." },
    ]
  },
  {
    id: "inspecoes",
    icon: ClipboardCheck,
    color: "text-purple-600",
    bg: "bg-purple-50",
    title: "Inspeções",
    pageKey: "Inspecoes",
    conteudo: [
      { subtitulo: "Nova Inspeção", texto: "Selecione o tipo de inspeção e aeroporto. O inspetor é automaticamente preenchido com o utilizador logado. Se tiver acesso a apenas um aeroporto, este é auto-selecionado." },
      { subtitulo: "Checklist", texto: "Responda cada item do checklist como Conforme, Não Conforme ou Não Aplicável. Pode adicionar observações e evidências fotográficas por item." },
      { subtitulo: "Não Conformidades → SS", texto: "Itens marcados como 'Não Conforme' geram automaticamente uma Solicitação de Serviço (SS) na Manutenção ao concluir a inspeção, dispensando o inspetor de definir prazos ou responsáveis." },
      { subtitulo: "Cancelar Inspeção", texto: "As inspeções podem ser canceladas (soft delete) — ficam ocultas da lista mas preservadas no histórico." },
      { subtitulo: "Relatório", texto: "Após concluir, o sistema gera um resumo com percentagem de conformidade. Pode exportar o relatório em PDF." },
    ]
  },
  {
    id: "auditoria",
    icon: FileText,
    color: "text-indigo-600",
    bg: "bg-indigo-50",
    title: "Auditoria Interna",
    pageKey: "Auditoria",
    conteudo: [
      { subtitulo: "Processo de Auditoria", texto: "Crie um novo processo de auditoria definindo o tipo, âmbito, datas e equipa auditora." },
      { subtitulo: "Checklist de Auditoria", texto: "Avalie cada item como Conforme (C), Não Conforme (NC) ou Não Aplicável (N/A). Itens NC geram automaticamente Solicitações de Serviço (SS) na Manutenção ao finalizar." },
      { subtitulo: "Plano de Ação Corretiva (PAC)", texto: "Para cada não conformidade detetada, crie itens de PAC com responsável, prazo e ações previstas." },
      { subtitulo: "Acompanhamento", texto: "O sistema alerta automaticamente sobre prazos a vencer nos PACs." },
    ]
  },
  {
    id: "manutencao",
    icon: Wrench,
    color: "text-orange-600",
    bg: "bg-orange-50",
    title: "Manutenção",
    pageKey: "Manutencao",
    conteudo: [
      { subtitulo: "Solicitações de Serviço (SS)", texto: "As SS são pedidos de intervenção que podem ser criados manualmente (botão 'Nova Solicitação') ou automaticamente a partir de inspeções e auditorias com itens não conformes." },
      { subtitulo: "Análise e Triagem", texto: "Administradores e equipa de Infraestrutura analisam cada SS: podem aprovar (gerando uma Ordem de Serviço) ou rejeitar (com justificação). Na aprovação definem categoria, prioridade e tipo de execução." },
      { subtitulo: "Ordens de Serviço (OS)", texto: "As OS são criadas a partir de SS aprovadas. Contêm detalhes da intervenção: categoria, prioridade, tipo de execução (interna ou terceirizada), fornecedor e prazo." },
      { subtitulo: "Atribuição e Execução", texto: "O responsável pela manutenção atribui a OS a um técnico ou fornecedor, acompanha a execução e regista custos, fotos (antes/depois) e observações de conclusão." },
      { subtitulo: "Verificação", texto: "Após a conclusão, o administrador ou equipa de infraestrutura verifica o trabalho realizado e fecha a OS." },
      { subtitulo: "Permissões", texto: "Perfis 'administrador' e 'infraestrutura' podem analisar SS, criar/atribuir/verificar OS. Perfil 'operacoes' pode abrir SS e visualizar OS." },
    ]
  },
  {
    id: "reclamacoes",
    icon: MessageSquare,
    color: "text-pink-600",
    bg: "bg-pink-50",
    title: "Reclamações",
    pageKey: "Reclamacoes",
    conteudo: [
      { subtitulo: "Portal Público", texto: "Existe um formulário público de reclamações acessível sem login, que pode ser partilhado com passageiros." },
      { subtitulo: "Gestão Interna", texto: "As reclamações recebidas aparecem na lista com status (Nova, Em Análise, Respondida, Fechada)." },
      { subtitulo: "Classificação por IA", texto: "O sistema classifica automaticamente as reclamações por categoria e urgência usando inteligência artificial." },
    ]
  },
  {
    id: "credenciamento",
    icon: Users,
    color: "text-teal-600",
    bg: "bg-teal-50",
    title: "Credenciamentos",
    pageKey: "Credenciamento",
    conteudo: [
      { subtitulo: "Novo Credenciamento", texto: "Registe pedidos de credenciamento para funcionários e prestadores de serviços nos aeroportos." },
      { subtitulo: "Aprovação", texto: "Administradores podem aprovar, rejeitar ou suspender credenciamentos. O requerente recebe notificação automática." },
      { subtitulo: "Portal Empresa", texto: "Gestores de empresa têm acesso a um portal dedicado onde podem submeter e acompanhar pedidos dos seus colaboradores." },
    ]
  },
  {
    id: "documentos",
    icon: FolderOpen,
    color: "text-cyan-700",
    bg: "bg-cyan-50",
    title: "Documentos e Histórico de Acessos",
    pageKey: "Documentos",
    conteudo: [
      { subtitulo: "Organização por Pastas", texto: "Crie pastas para organizar documentos hierarquicamente, com subpastas aninhadas. Cada pasta pode estar vinculada a um aeroporto específico ou ser de uso geral, e as subpastas herdam a configuração da pasta pai." },
      { subtitulo: "Upload de Documentos", texto: "Adicione documentos individuais ou em massa através de drag-and-drop ou formulário. Cada documento requer um título, categoria (Manual, Procedimento, Regulamentação, Formulário, Relatório ou Outro), versão e data de publicação." },
      { subtitulo: "Controlo de Acesso", texto: "Defina quem pode aceder a cada documento por perfil (Administrador, Operações, Financeiro, Infraestrutura, Safety, AVSEC, Visualizador) ou conceda acesso explícito a utilizadores específicos por email." },
      { subtitulo: "Proteção com Senha", texto: "Proteja pastas sensíveis com senha (mínimo 6 caracteres), obrigando os utilizadores a fornecê-la antes de aceder ao conteúdo. Útil para informação confidencial." },
      { subtitulo: "Histórico de Acessos", texto: "Consulte um registo detalhado de quem acedeu a cada documento, quando e qual a ação (visualização, download ou edição). Filtre por tipo de acesso, documento, utilizador ou intervalo de datas." },
    ]
  },
  {
    id: "notificacoes",
    icon: Bell,
    color: "text-amber-600",
    bg: "bg-amber-50",
    title: "Notificações",
    pageKey: "GestaoNotificacoes",
    conteudo: [
      { subtitulo: "Regras de Notificação", texto: "Configure quais eventos geram notificações (voo ligado criado, ocorrência safety, etc.) e para quem são enviadas." },
      { subtitulo: "WhatsApp", texto: "O sistema suporta envio de notificações via WhatsApp (Z-API). Configure a instância em Configurações Gerais." },
      { subtitulo: "Relatórios Automáticos", texto: "Os relatórios operacionais (diário, semanal, mensal e mapa de KPIs) são enviados automaticamente por email. A gestão de destinatários e horários está na secção 'Relatórios Automáticos'." },
    ]
  },
  {
    id: "relatorios",
    icon: Send,
    color: "text-sky-600",
    bg: "bg-sky-50",
    title: "Relatórios Automáticos",
    pageKey: "Relatorios",
    conteudo: [
      { subtitulo: "Tipos de Relatório", texto: "Existem quatro tipos: Diário (voos do dia anterior), Semanal (últimos 7 dias), Mensal (mês anterior) e Mapa de KPIs (tempos de atendimento vs meta). Cada um tem um agendamento independente." },
      { subtitulo: "Adicionar Destinatários", texto: "Introduza o email @sga.co.ao no campo de entrada. Para vários, separe-os por ponto-e-vírgula (;), vírgula ou espaço. Pode adicionar um nome opcional. Clique em 'Adicionar' para confirmar." },
      { subtitulo: "Gerir Destinatários", texto: "Cada destinatário pode ser ativado/desativado. Se estiver inativo, não recebe o relatório. Para remover, clique no ícone da lixeira. Sem destinatários ativos, o relatório não é enviado." },
      { subtitulo: "Editar Agendamento", texto: "Para cada relatório, defina a hora, o dia (ou dia do mês, nos mensais) e ative/desative com a caixa 'ativo'. Clique em 'Guardar' para confirmar. O sistema verifica a agenda a cada 15 minutos." },
      { subtitulo: "Entrega por Email", texto: "Os relatórios são enviados por email com PDF e Excel anexados, individualmente para cada destinatário ativo. Apenas emails @sga.co.ao são aceites (domínio corporativo)." },
    ]
  },
  {
    id: "administracao",
    icon: Building2,
    color: "text-slate-700",
    bg: "bg-slate-100",
    title: "Administração",
    pageKey: "",
    conteudo: [
      { subtitulo: "Gestão de Empresas", texto: "Crie, edite ou desative empresas e os seus logótipos. Veja quantos aeroportos e utilizadores estão associados a cada empresa e consulte os detalhes completos." },
      { subtitulo: "Gestão de Acessos", texto: "Aprove ou rejeite solicitações de acesso de novos utilizadores, atribua perfis e aeroportos autorizados, envie convites de definição de senha e faça a gestão do estado de ativação." },
      { subtitulo: "Permissões por Perfil", texto: "Configure quais as páginas que cada perfil (Administrador, Operações, Safety, etc.) pode aceder. As alterações têm efeito no próximo login do utilizador." },
      { subtitulo: "Lixeira", texto: "Veja inspeções canceladas, proformas canceladas e itens de checklist inativos. Restaure-os ao estado anterior ou elimine-os permanentemente (com confirmação)." },
      { subtitulo: "Log de Auditoria", texto: "Consulte o histórico completo de ações no sistema (criações, edições, eliminações, logins). Filtre por ação, módulo, utilizador ou data." },
      { subtitulo: "Monitoramento", texto: "Acompanhe o desempenho e a saúde do sistema — velocidade de carregamento, performance por página e tipo de ligação dos utilizadores." },
    ]
  },
  {
    id: "configuracoes",
    icon: Settings,
    color: "text-slate-600",
    bg: "bg-slate-100",
    title: "Configurações Gerais",
    pageKey: "ConfiguracoesGerais",
    conteudo: [
      { subtitulo: "Aeroportos", texto: "Adicione e configure os aeroportos da rede com código ICAO, categoria e localização." },
      { subtitulo: "Companhias Aéreas", texto: "Registe as companhias aéreas que operam na rede com códigos ICAO/IATA." },
      { subtitulo: "Aeronaves", texto: "Mantenha o registo de aeronaves com MTOW, capacidade e modelo. O MTOW é essencial para o cálculo correto das tarifas." },
      { subtitulo: "Tarifas", texto: "Defina as tarifas de pouso, permanência e outras taxas por categoria de aeroporto. Os valores são usados automaticamente no cálculo de faturação. Na aba 'Clientes' pode gerir os clientes de faturação." },
      { subtitulo: "Utilizadores", texto: "Convide utilizadores e atribua perfis (Administrador, Operações, Safety, etc.) e aeroportos de acesso." },
    ]
  },
  {
    id: "suporte",
    icon: LifeBuoy,
    color: "text-blue-600",
    bg: "bg-blue-50",
    title: "Suporte",
    pageKey: "Suporte",
    conteudo: [
      { subtitulo: "Abrir um Ticket", texto: "Preencha o assunto (mínimo 5 caracteres) e a mensagem (mínimo 10 caracteres) a detalhar o problema. Pode escolher uma categoria (Bug, Dúvida, Sugestão, Acesso ou Outro)." },
      { subtitulo: "Anexar Fotos e Documentos", texto: "Clique em 'Adicionar fotos ou documentos' para carregar imagens, PDF ou ficheiros (até 10MB cada). Pode carregar vários. Após enviar, recebe um número de ticket para acompanhar o pedido." },
      { subtitulo: "Gerir Tickets (Admin)", texto: "Na aba 'Gerir Tickets' vê todos os pedidos e pode filtrar por estado (Aberta, Em Andamento ou Resolvida) ou pesquisar por número, assunto ou solicitante." },
      { subtitulo: "Alterar Estado", texto: "Para cada ticket, altere o estado entre Aberta, Em Andamento e Resolvida. O sistema regista quem fez a alteração e a data." },
      { subtitulo: "Encaminhar", texto: "Clique em 'Encaminhar' para reencaminhar um ticket a um colega através de um email @sga.co.ao, com uma nota de contexto opcional." },
      { subtitulo: "Apagar Ticket", texto: "Clique em 'Apagar' para remover um ticket. Esta ação é irreversível e elimina o ticket definitivamente." },
    ]
  },
];

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Realça (destaca) o termo pesquisado dentro de um texto.
function Realce({ texto, termo }) {
  const t = (termo || '').trim();
  if (!t) return <>{texto}</>;
  const partes = String(texto).split(new RegExp(`(${escapeRegExp(t)})`, 'ig'));
  return (
    <>
      {partes.map((p, i) =>
        p.toLowerCase() === t.toLowerCase()
          ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-600/50 text-inherit rounded px-0.5">{p}</mark>
          : <React.Fragment key={i}>{p}</React.Fragment>
      )}
    </>
  );
}

export default function GuiaUtilizador() {
  const { t } = useI18n();
  const [abertos, setAbertos] = useState({ dashboard: true });
  const [busca, setBusca] = useState("");

  const toggle = (id) => setAbertos(prev => ({ ...prev, [id]: !prev[id] }));
  const expandirTudo = () => setAbertos(Object.fromEntries(sections.map(s => [s.id, true])));
  const colapsarTudo = () => setAbertos({});
  const todosAbertos = sections.every(s => abertos[s.id]);

  const imprimir = () => {
    expandirTudo();
    setTimeout(() => window.print(), 150);
  };

  const secoesFiltradas = busca.trim()
    ? sections.filter(s =>
        s.title.toLowerCase().includes(busca.toLowerCase()) ||
        s.conteudo.some(c =>
          c.subtitulo.toLowerCase().includes(busca.toLowerCase()) ||
          c.texto.toLowerCase().includes(busca.toLowerCase())
        )
      )
    : sections;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6">
      {/* Estilos só para impressão / Guardar como PDF */}
      <style media="print">{`@media print { header, nav, .no-print { display: none !important; } body { background: #fff !important; } }`}</style>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          {t('guia.title')}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          {t('guia.subtitle')}
        </p>
      </div>

      {/* Barra de busca + ações */}
      <div className="flex flex-col sm:flex-row gap-2 mb-6 no-print">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={t('guia.buscarPlaceholder')}
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={todosAbertos ? colapsarTudo : expandirTudo} className="gap-1.5 whitespace-nowrap">
            <ChevronsDownUp className="w-4 h-4" />
            {todosAbertos ? 'Colapsar tudo' : 'Expandir tudo'}
          </Button>
          <Button variant="outline" size="sm" onClick={imprimir} className="gap-1.5 whitespace-nowrap" title="Imprimir ou guardar como PDF">
            <Printer className="w-4 h-4" />
            Imprimir / PDF
          </Button>
        </div>
      </div>

      {/* Índice rápido */}
      {!busca && (
        <Card className="mb-6 border-slate-200 dark:border-slate-700 no-print">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">{t('guia.indiceRapido')}</p>
            <div className="flex flex-wrap gap-2">
              {sections.map(s => (
                <button
                  key={s.id}
                  onClick={() => {
                    setAbertos(prev => ({ ...prev, [s.id]: true }));
                    document.getElementById(`sec-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${s.bg} ${s.color} hover:opacity-80 transition-opacity`}
                >
                  <s.icon className="w-3.5 h-3.5" />
                  {s.title}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Secções */}
      <div className="space-y-3">
        {secoesFiltradas.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <Search className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>{t('label.no_results')}</p>
          </div>
        )}

        {secoesFiltradas.map(s => {
          const aberto = busca.trim() ? true : !!abertos[s.id];
          return (
            <div key={s.id} id={`sec-${s.id}`}>
              <Card className="border-slate-200 dark:border-slate-700 overflow-hidden">
                <CardHeader
                  onClick={() => toggle(s.id)}
                  className="py-4 px-5 flex flex-row items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-lg ${s.bg}`}>
                      <s.icon className={`w-5 h-5 ${s.color}`} />
                    </div>
                    <CardTitle className="text-base font-semibold text-slate-800 dark:text-slate-200">
                      <Realce texto={s.title} termo={busca} />
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {s.pageKey && (
                      <Link
                        to={createPageUrl(s.pageKey)}
                        onClick={(e) => e.stopPropagation()}
                        className="hidden sm:inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline no-print"
                      >
                        {t('guia.abrirPagina') || 'Abrir página'}
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    )}
                    {aberto
                      ? <ChevronDown className="w-4 h-4 text-slate-400" />
                      : <ChevronRight className="w-4 h-4 text-slate-400" />
                    }
                  </div>
                </CardHeader>

                {aberto && (
                  <CardContent className="px-5 pb-5 pt-0">
                    <div className="border-t border-slate-100 dark:border-slate-700 pt-4 space-y-4">
                      {s.conteudo.map((c, i) => (
                        <div key={i} className="flex gap-3">
                          <div className="flex-shrink-0 mt-0.5">
                            <div className={`w-2 h-2 rounded-full mt-1.5 ${s.bg} border-2 ${s.color.replace('text-', 'border-')}`}></div>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-0.5">
                              <Realce texto={c.subtitulo} termo={busca} />
                            </p>
                            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                              <Realce texto={c.texto} termo={busca} />
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            </div>
          );
        })}
      </div>

      <div className="mt-8 text-center text-xs text-slate-400">
        Sistema SGA • Versão 2.1.0
      </div>
    </div>
  );
}
