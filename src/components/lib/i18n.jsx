import React, { createContext, useState, useContext, useEffect } from 'react';

const I18nContext = createContext();

const translations = {
  pt: {
    // Layout
    'layout.dashboard': 'Dashboard',
    'layout.operacoes': 'Operações',
    'layout.fundoManeio': 'Fundo de Maneio',
    'layout.proformas': 'Proformas',
    'layout.safety': 'Safety',
    'layout.inspecoes': 'Inspeções',
    'layout.kpis': 'KPIs Operacionais',
    'layout.powerbi': 'Power BI',
    'layout.manutencao': 'Manutenção',
    'layout.auditoria': 'Auditoria Interna',
    'layout.reclamacoes': 'Reclamações',
    'layout.credenciamento': 'Gestão de Credenciamentos',
    'layout.gestaoAcessos': 'Gestão de Acessos',
    'layout.gestaoPermissoes': 'Gestão de Permissões',
    'layout.gestaoNotificacoes': 'Gestão de Notificações',
    'layout.configuracoes': 'Configurações Gerais',
    'layout.grf': 'GRF – Condições da Pista',
    'layout.documentos': 'Documentos',
    'layout.historicoAcesso': 'Histórico de Acesso',
    'layout.logAuditoria': 'Log de Auditoria',
    'layout.logout': 'Sair',
    'layout.version': 'Versão',
    'layout.loading': 'A carregar...',
    'layout.language': 'Idioma',
    'layout.myAccount': 'Minha Conta',
    'layout.configurarPerfil': 'Configurar Perfil',
    'layout.restrictedAccess': 'Acesso Restrito',
    'layout.loginRequired': 'É necessário fazer login para aceder a esta página.',
    'layout.login': 'Fazer Login',
    'layout.redirecting': 'A redirecionar...',

    // Flightradar Importer
    'flightradar.title': 'Importar Voos do Flightradar24',
    'flightradar.description': 'Busque e importe voos para validação antes de salvar no sistema.',
    'flightradar.airports': 'Aeroportos',
    'flightradar.startDate': 'Data Início',
    'flightradar.endDate': 'Data Fim',
    'flightradar.search': 'Buscar',
    'flightradar.searching': 'Buscando...',
    'flightradar.selectAirports': 'Selecione pelo menos um aeroporto',
    'flightradar.flightsFound': 'voo(s) encontrado(s)',
    'flightradar.export': 'Exportar XLSX',
    'flightradar.import': 'Importar',
    'flightradar.importSelected': 'Importar',
    'flightradar.selectAtLeast': 'Selecione pelo menos um voo para importar',
    'flightradar.noFlights': 'Nenhum voo encontrado no período.',
    'flightradar.dateRangeTooLarge': 'Intervalo de datas muito grande',
    'flightradar.maxDays': 'Máximo permitido é 13 dias.',
    'flightradar.errorImporting': 'Erro ao importar:',
    'flightradar.tabSearch': 'Buscar Voos',
    'flightradar.tabHistory': 'Histórico de Cache',
    'flightradar.searchCompleted': 'Pesquisa Concluída',

    // General
    'general.error': 'Erro',
    'general.success': 'Sucesso',
    'general.loading': 'Carregando...',
    'general.save': 'Guardar',
    'general.cancel': 'Cancelar',
    'general.delete': 'Eliminar',
    'general.edit': 'Editar',
    'general.close': 'Fechar',
    'general.add': 'Adicionar',
    'general.selectAll': 'Selecionar Todos',
    'general.deselectAll': 'Desselecionar Todos',

    // Safety
    'safety.title': 'Ocorrências de Safety',
    'safety.newOccurrence': 'Nova Ocorrência',
    'safety.date': 'Data',
    'safety.type': 'Tipo',
    'safety.severity': 'Gravidade',
    'safety.status': 'Estado',
    'safety.airport': 'Aeroporto',
    'safety.description': 'Descrição',
    'safety.noResults': 'Nenhuma ocorrência encontrada',

    // Inspections
    'inspecoes.title': 'Inspeções',
    'inspecoes.new': 'Nova Inspeção',
    'inspecoes.pending': 'Pendentes',
    'inspecoes.completed': 'Concluídas',
    'inspecoes.inProgress': 'Em Andamento',
    'inspecoes.noResults': 'Nenhuma inspeção encontrada',

    // Maintenance
    'manutencao.title': 'Manutenção',
    'manutencao.ss': 'Solicitações de Serviço',
    'manutencao.os': 'Ordens de Serviço',
    'manutencao.panel': 'Painel',
    'manutencao.new': 'Nova SS',
    'manutencao.newOS': 'Nova OS',
    'manutencao.priority': 'Prioridade',
    'manutencao.category': 'Categoria',
    'manutencao.noResults': 'Nenhum resultado encontrado',

    // Operations
    'operacoes.title': 'Operações',
    'operacoes.flights': 'Voos',
    'operacoes.linkedFlights': 'Voos Ligados',
    'operacoes.newFlight': 'Novo Voo',
    'operacoes.scheduled': 'Programado',
    'operacoes.completed': 'Realizado',
    'operacoes.cancelled': 'Cancelado',
    'operacoes.noResults': 'Nenhum voo encontrado',

    // Audit
    'auditoria.title': 'Auditoria Interna',
    'auditoria.new': 'Nova Auditoria',
    'auditoria.findings': 'Constatações',
    'auditoria.pacs': 'PACs',
    'auditoria.noResults': 'Nenhuma auditoria encontrada',

    // Common/Shared
    'common.filters': 'Filtros',
    'common.search': 'Pesquisar',
    'common.export': 'Exportar',
    'common.import': 'Importar',
    'common.actions': 'Ações',
    'common.details': 'Detalhes',
    'common.confirm': 'Confirmar',
    'common.back': 'Voltar',
    'common.next': 'Próximo',
    'common.previous': 'Anterior',
    'common.required': 'Campo obrigatório',
    'common.noResults': 'Nenhum resultado encontrado',
    'common.loading': 'A carregar...',
    'common.saving': 'A guardar...',
    'common.saved': 'Guardado com sucesso',
    'common.error': 'Ocorreu um erro',
    'common.deleteConfirm': 'Tem certeza que deseja eliminar?',
    'common.yes': 'Sim',
    'common.no': 'Não',
    'common.all': 'Todos',
    'common.active': 'Ativo',
    'common.inactive': 'Inativo',
    'common.date': 'Data',
    'common.airport': 'Aeroporto',
    'common.company': 'Empresa',
    'common.status': 'Estado',
    'common.priority': 'Prioridade',
    'common.observations': 'Observações',
  },
  en: {
    // Layout
    'layout.dashboard': 'Dashboard',
    'layout.operacoes': 'Operations',
    'layout.fundoManeio': 'Working Capital',
    'layout.proformas': 'Proformas',
    'layout.safety': 'Safety',
    'layout.inspecoes': 'Inspections',
    'layout.kpis': 'Operational KPIs',
    'layout.powerbi': 'Power BI',
    'layout.manutencao': 'Maintenance',
    'layout.auditoria': 'Internal Audit',
    'layout.reclamacoes': 'Claims',
    'layout.credenciamento': 'Accreditation Management',
    'layout.gestaoAcessos': 'Access Management',
    'layout.gestaoPermissoes': 'Permissions Management',
    'layout.gestaoNotificacoes': 'Notifications Management',
    'layout.configuracoes': 'General Settings',
    'layout.grf': 'GRF – Runway Conditions',
    'layout.documentos': 'Documents',
    'layout.historicoAcesso': 'Access History',
    'layout.logAuditoria': 'Audit Log',
    'layout.logout': 'Logout',
    'layout.version': 'Version',
    'layout.loading': 'Loading...',
    'layout.language': 'Language',
    'layout.myAccount': 'My Account',
    'layout.configurarPerfil': 'Configure Profile',
    'layout.restrictedAccess': 'Restricted Access',
    'layout.loginRequired': 'You must log in to access this page.',
    'layout.login': 'Login',
    'layout.redirecting': 'Redirecting...',

    // Flightradar Importer
    'flightradar.title': 'Import Flights from Flightradar24',
    'flightradar.description': 'Search and import flights for validation before saving to the system.',
    'flightradar.airports': 'Airports',
    'flightradar.startDate': 'Start Date',
    'flightradar.endDate': 'End Date',
    'flightradar.search': 'Search',
    'flightradar.searching': 'Searching...',
    'flightradar.selectAirports': 'Select at least one airport',
    'flightradar.flightsFound': 'flight(s) found',
    'flightradar.export': 'Export XLSX',
    'flightradar.import': 'Import',
    'flightradar.importSelected': 'Import',
    'flightradar.selectAtLeast': 'Select at least one flight to import',
    'flightradar.noFlights': 'No flights found for the selected period.',
    'flightradar.dateRangeTooLarge': 'Date range too large',
    'flightradar.maxDays': 'Maximum allowed is 13 days.',
    'flightradar.errorImporting': 'Error importing:',
    'flightradar.tabSearch': 'Search Flights',
    'flightradar.tabHistory': 'Cache History',
    'flightradar.searchCompleted': 'Search Completed',

    // General
    'general.error': 'Error',
    'general.success': 'Success',
    'general.loading': 'Loading...',
    'general.save': 'Save',
    'general.cancel': 'Cancel',
    'general.delete': 'Delete',
    'general.edit': 'Edit',
    'general.close': 'Close',
    'general.add': 'Add',
    'general.selectAll': 'Select All',
    'general.deselectAll': 'Deselect All',

    // Safety
    'safety.title': 'Safety Occurrences',
    'safety.newOccurrence': 'New Occurrence',
    'safety.date': 'Date',
    'safety.type': 'Type',
    'safety.severity': 'Severity',
    'safety.status': 'Status',
    'safety.airport': 'Airport',
    'safety.description': 'Description',
    'safety.noResults': 'No occurrences found',

    // Inspections
    'inspecoes.title': 'Inspections',
    'inspecoes.new': 'New Inspection',
    'inspecoes.pending': 'Pending',
    'inspecoes.completed': 'Completed',
    'inspecoes.inProgress': 'In Progress',
    'inspecoes.noResults': 'No inspections found',

    // Maintenance
    'manutencao.title': 'Maintenance',
    'manutencao.ss': 'Service Requests',
    'manutencao.os': 'Work Orders',
    'manutencao.panel': 'Panel',
    'manutencao.new': 'New SR',
    'manutencao.newOS': 'New WO',
    'manutencao.priority': 'Priority',
    'manutencao.category': 'Category',
    'manutencao.noResults': 'No results found',

    // Operations
    'operacoes.title': 'Operations',
    'operacoes.flights': 'Flights',
    'operacoes.linkedFlights': 'Linked Flights',
    'operacoes.newFlight': 'New Flight',
    'operacoes.scheduled': 'Scheduled',
    'operacoes.completed': 'Completed',
    'operacoes.cancelled': 'Cancelled',
    'operacoes.noResults': 'No flights found',

    // Audit
    'auditoria.title': 'Internal Audit',
    'auditoria.new': 'New Audit',
    'auditoria.findings': 'Findings',
    'auditoria.pacs': 'CAPs',
    'auditoria.noResults': 'No audits found',

    // Common/Shared
    'common.filters': 'Filters',
    'common.search': 'Search',
    'common.export': 'Export',
    'common.import': 'Import',
    'common.actions': 'Actions',
    'common.details': 'Details',
    'common.confirm': 'Confirm',
    'common.back': 'Back',
    'common.next': 'Next',
    'common.previous': 'Previous',
    'common.required': 'Required field',
    'common.noResults': 'No results found',
    'common.loading': 'Loading...',
    'common.saving': 'Saving...',
    'common.saved': 'Saved successfully',
    'common.error': 'An error occurred',
    'common.deleteConfirm': 'Are you sure you want to delete?',
    'common.yes': 'Yes',
    'common.no': 'No',
    'common.all': 'All',
    'common.active': 'Active',
    'common.inactive': 'Inactive',
    'common.date': 'Date',
    'common.airport': 'Airport',
    'common.company': 'Company',
    'common.status': 'Status',
    'common.priority': 'Priority',
    'common.observations': 'Observations',
  }
};

export function I18nProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('language') || 'pt';
    }
    return 'pt';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('language', language);
    }
  }, [language]);

  const t = (key) => {
    const [namespace, ...rest] = key.split('.');
    const translationKey = rest.join('.');
    return translations[language]?.[key] || key;
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}