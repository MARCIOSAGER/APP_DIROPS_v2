import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen, Plane, DollarSign, Shield, ClipboardCheck,
  Users, FileText, MessageSquare, Settings, ChevronDown, ChevronRight,
  BarChart3, Wrench, Activity, Bell, Search
} from "lucide-react";

const sections = [
  {
    id: "dashboard",
    icon: BarChart3,
    color: "text-blue-600",
    bg: "bg-blue-50",
    title: "Dashboard Operacional",
    badge: "Home",
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
    badge: "Operacoes",
    conteudo: [
      { subtitulo: "Registar Voo", texto: "Clique em 'Novo Voo' para registar chegadas (ARR) ou partidas (DEP). Preencha o número de voo, data, aeronave, companhia, passageiros e carga." },
      { subtitulo: "Voos Ligados", texto: "Um voo ligado é um par ARR+DEP da mesma aeronave. O sistema cria automaticamente o voo ligado quando deteta o par. Pode também ligar manualmente clicando no ícone de ligação na tabela." },
      { subtitulo: "Cálculo de Tarifas", texto: "Após criar um voo ligado, o sistema calcula automaticamente as tarifas de pouso, permanência, passageiros e carga. Os valores aparecem na coluna 'Tarifa'." },
      { subtitulo: "Importar do FR24", texto: "Utilize a funcionalidade de importação Flightradar24 para importar dados de voos automaticamente, evitando entrada manual." },
      { subtitulo: "Exportar", texto: "A tabela de voos pode ser exportada para Excel (XLSX) ou PDF para relatórios e arquivo." },
    ]
  },
  {
    id: "faturacao",
    icon: DollarSign,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    title: "Fundo de Maneio & Proformas",
    badge: "Financeiro",
    conteudo: [
      { subtitulo: "Fundo de Maneio", texto: "Registe movimentos financeiros (receitas e despesas) por aeroporto. O sistema gera gráficos e resumos mensais automaticamente." },
      { subtitulo: "Proformas", texto: "Gere proformas de faturação com base nos cálculos de tarifas. Selecione o período e o aeroporto para gerar o documento." },
      { subtitulo: "Tarifas Configuráveis", texto: "Em Configurações Gerais pode definir as tarifas de pouso, permanência, passageiros e carga, bem como impostos aplicáveis." },
    ]
  },
  {
    id: "safety",
    icon: Shield,
    color: "text-red-600",
    bg: "bg-red-50",
    title: "Safety",
    badge: "Safety",
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
    badge: "Inspecoes",
    conteudo: [
      { subtitulo: "Nova Inspeção", texto: "Selecione o tipo de inspeção, aeroporto, data e inspetor responsável. O sistema carrega automaticamente o checklist correspondente." },
      { subtitulo: "Checklist", texto: "Responda cada item do checklist como Conforme, Não Conforme ou Não Aplicável. Pode adicionar observações por item." },
      { subtitulo: "Relatório", texto: "Após concluir, o sistema gera um resumo com percentagem de conformidade. Pode exportar o relatório em PDF." },
    ]
  },
  {
    id: "auditoria",
    icon: FileText,
    color: "text-indigo-600",
    bg: "bg-indigo-50",
    title: "Auditoria Interna",
    badge: "Auditoria",
    conteudo: [
      { subtitulo: "Processo de Auditoria", texto: "Crie um novo processo de auditoria definindo o tipo, âmbito, datas e equipa auditora." },
      { subtitulo: "Plano de Ação Corretiva (PAC)", texto: "Para cada não conformidade detetada, crie itens de PAC com responsável, prazo e ações previstas." },
      { subtitulo: "Acompanhamento", texto: "O sistema alerta automaticamente sobre prazos a vencer nos PACs." },
    ]
  },
  {
    id: "reclamacoes",
    icon: MessageSquare,
    color: "text-pink-600",
    bg: "bg-pink-50",
    title: "Reclamações",
    badge: "Reclamacoes",
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
    badge: "Credenciamento",
    conteudo: [
      { subtitulo: "Novo Credenciamento", texto: "Registe pedidos de credenciamento para funcionários e prestadores de serviços nos aeroportos." },
      { subtitulo: "Aprovação", texto: "Administradores podem aprovar, rejeitar ou suspender credenciamentos. O requerente recebe notificação automática." },
      { subtitulo: "Portal Empresa", texto: "Gestores de empresa têm acesso a um portal dedicado onde podem submeter e acompanhar pedidos dos seus colaboradores." },
    ]
  },
  {
    id: "notificacoes",
    icon: Bell,
    color: "text-amber-600",
    bg: "bg-amber-50",
    title: "Notificações",
    badge: "GestaoNotificacoes",
    conteudo: [
      { subtitulo: "Regras de Notificação", texto: "Configure quais eventos geram notificações (voo ligado criado, ocorrência safety, etc.) e para quem são enviadas." },
      { subtitulo: "WhatsApp", texto: "O sistema suporta envio de notificações via WhatsApp (Z-API). Configure a instância em Configurações Gerais." },
      { subtitulo: "Relatórios Automáticos", texto: "Configure relatórios operacionais diários, semanais ou mensais para serem enviados automaticamente por email ou WhatsApp." },
    ]
  },
  {
    id: "configuracoes",
    icon: Settings,
    color: "text-slate-600",
    bg: "bg-slate-100",
    title: "Configurações Gerais",
    badge: "Config",
    conteudo: [
      { subtitulo: "Aeroportos", texto: "Adicione e configure os aeroportos da rede SGA com código ICAO, categoria e localização." },
      { subtitulo: "Companhias Aéreas", texto: "Registe as companhias aéreas que operam na rede com códigos ICAO/IATA." },
      { subtitulo: "Aeronaves", texto: "Mantenha o registo de aeronaves com MTOW, capacidade e modelo. O MTOW é essencial para o cálculo correto das tarifas." },
      { subtitulo: "Tarifas", texto: "Defina as tarifas de pouso, permanência e outras taxas por categoria de aeroporto. Os valores são usados automaticamente no cálculo de faturação." },
      { subtitulo: "Utilizadores", texto: "Convide utilizadores e atribua perfis (Administrador, Operações, Safety, etc.) e aeroportos de acesso." },
    ]
  },
];

export default function GuiaUtilizador() {
  const [abertos, setAbertos] = useState({ dashboard: true });
  const [busca, setBusca] = useState("");

  const toggle = (id) => setAbertos(prev => ({ ...prev, [id]: !prev[id] }));

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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-blue-600" />
          Guia do Utilizador
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Documentação completa do sistema DIROPS-SGA
        </p>
      </div>

      {/* Barra de busca */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Pesquisar no guia..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Índice rápido */}
      {!busca && (
        <Card className="mb-6 border-slate-200">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Índice Rápido</p>
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
            <p>Nenhum resultado encontrado para "{busca}"</p>
          </div>
        )}

        {secoesFiltradas.map(s => (
          <div key={s.id} id={`sec-${s.id}`}>
            <Card className="border-slate-200 overflow-hidden">
              <button
                className="w-full text-left"
                onClick={() => toggle(s.id)}
              >
                <CardHeader className="py-4 px-5 flex flex-row items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${s.bg}`}>
                      <s.icon className={`w-5 h-5 ${s.color}`} />
                    </div>
                    <CardTitle className="text-base font-semibold text-slate-800">{s.title}</CardTitle>
                    <Badge variant="outline" className="text-xs text-slate-400 hidden sm:flex">{s.badge}</Badge>
                  </div>
                  {abertos[s.id]
                    ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  }
                </CardHeader>
              </button>

              {abertos[s.id] && (
                <CardContent className="px-5 pb-5 pt-0">
                  <div className="border-t border-slate-100 pt-4 space-y-4">
                    {s.conteudo.map((c, i) => (
                      <div key={i} className="flex gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          <div className={`w-2 h-2 rounded-full mt-1.5 ${s.bg} border-2 ${s.color.replace('text-', 'border-')}`}></div>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-700 mb-0.5">{c.subtitulo}</p>
                          <p className="text-sm text-slate-500 leading-relaxed">{c.texto}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          </div>
        ))}
      </div>

      <div className="mt-8 text-center text-xs text-slate-400">
        Sistema DIROPS-SGA • Versão 2.1.0
      </div>
    </div>
  );
}