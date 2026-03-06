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