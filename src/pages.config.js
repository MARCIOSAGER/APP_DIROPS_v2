import { lazy } from 'react';
import __Layout from './Layout.jsx';

const AguardandoAprovacao = lazy(() => import('./pages/AguardandoAprovacao'));
const AlterarSenha = lazy(() => import('./pages/AlterarSenha'));
const Auditoria = lazy(() => import('./pages/Auditoria'));
const BoasVindas = lazy(() => import('./pages/BoasVindas'));
const ConfiguracaoTarifas = lazy(() => import('./pages/ConfiguracaoTarifas'));
const ConfiguracoesGerais = lazy(() => import('./pages/ConfiguracoesGerais'));
const ConfigurarPerfil = lazy(() => import('./pages/ConfigurarPerfil'));
const Credenciamento = lazy(() => import('./pages/Credenciamento'));
const CredenciamentoPublico = lazy(() => import('./pages/CredenciamentoPublico'));
const Documentos = lazy(() => import('./pages/Documentos'));
const FormularioReclamacaoPublico = lazy(() => import('./pages/FormularioReclamacaoPublico'));
const FundoManeio = lazy(() => import('./pages/FundoManeio'));
const GRF = lazy(() => import('./pages/GRF'));
const GerirPermissoes = lazy(() => import('./pages/GerirPermissoes'));
const GestaoAcessos = lazy(() => import('./pages/GestaoAcessos'));
const GestaoAPIKeys = lazy(() => import('./pages/GestaoAPIKeys'));
const GestaoEmpresas = lazy(() => import('./pages/GestaoEmpresas'));
const GestaoNotificacoes = lazy(() => import('./pages/GestaoNotificacoes'));
const GuiaUtilizador = lazy(() => import('./pages/GuiaUtilizador'));
const HistoricoAcessoDocumentos = lazy(() => import('./pages/HistoricoAcessoDocumentos'));
const Home = lazy(() => import('./pages/Home'));
const ImportacaoAiaan = lazy(() => import('./pages/ImportacaoAiaan'));
const Inspecoes = lazy(() => import('./pages/Inspecoes'));
const KPIsOperacionais = lazy(() => import('./pages/KPIsOperacionais'));
const Lixeira = lazy(() => import('./pages/Lixeira'));
const LogAuditoria = lazy(() => import('./pages/LogAuditoria'));
const LogAuditoriaDetalhes = lazy(() => import('./pages/LogAuditoriaDetalhes'));
const Manutencao = lazy(() => import('./pages/Manutencao'));
const Monitoramento = lazy(() => import('./pages/Monitoramento'));
const Operacoes = lazy(() => import('./pages/Operacoes'));
const PaginaInicial = lazy(() => import('./pages/PaginaInicial'));
const PoliticaPrivacidade = lazy(() => import('./pages/PoliticaPrivacidade'));
const PortalEmpresa = lazy(() => import('./pages/PortalEmpresa'));
const PowerBi = lazy(() => import('./pages/PowerBi'));
const Proforma = lazy(() => import('./pages/Proforma'));
const Reclamacoes = lazy(() => import('./pages/Reclamacoes'));
const Safety = lazy(() => import('./pages/Safety'));
const ServicosAeroportuarios = lazy(() => import('./pages/ServicosAeroportuarios'));
const SolicitacaoPerfil = lazy(() => import('./pages/SolicitacaoPerfil'));
const Suporte = lazy(() => import('./pages/Suporte'));
const TermosServico = lazy(() => import('./pages/TermosServico'));
const FlightAware = lazy(() => import('./pages/FlightAware'));
const ValidacaoAcesso = lazy(() => import('./pages/ValidacaoAcesso'));
const portalservicos = lazy(() => import('./pages/portalservicos'));


export const PAGES = {
    "AguardandoAprovacao": AguardandoAprovacao,
    "AlterarSenha": AlterarSenha,
    "Auditoria": Auditoria,
    "BoasVindas": BoasVindas,
    "ConfiguracaoTarifas": ConfiguracaoTarifas,
    "ConfiguracoesGerais": ConfiguracoesGerais,
    "ConfigurarPerfil": ConfigurarPerfil,
    "Credenciamento": Credenciamento,
    "CredenciamentoPublico": CredenciamentoPublico,
    "Documentos": Documentos,
    "FormularioReclamacaoPublico": FormularioReclamacaoPublico,
    "FundoManeio": FundoManeio,
    "GRF": GRF,
    "GerirPermissoes": GerirPermissoes,
    "GestaoAcessos": GestaoAcessos,
    "GestaoAPIKeys": GestaoAPIKeys,
    "GestaoEmpresas": GestaoEmpresas,
    "GestaoNotificacoes": GestaoNotificacoes,
    "GuiaUtilizador": GuiaUtilizador,
    "HistoricoAcessoDocumentos": HistoricoAcessoDocumentos,
    "Home": Home,
    "ImportacaoAiaan": ImportacaoAiaan,
    "Inspecoes": Inspecoes,
    "KPIsOperacionais": KPIsOperacionais,
    "Lixeira": Lixeira,
    "LogAuditoria": LogAuditoria,
    "LogAuditoriaDetalhes": LogAuditoriaDetalhes,
    "Manutencao": Manutencao,
    "Monitoramento": Monitoramento,
    "Operacoes": Operacoes,
    "PaginaInicial": PaginaInicial,
    "PortalEmpresa": PortalEmpresa,
    "PowerBi": PowerBi,
    "Proforma": Proforma,
    "Reclamacoes": Reclamacoes,
    "Safety": Safety,
    "ServicosAeroportuarios": ServicosAeroportuarios,
    "PoliticaPrivacidade": PoliticaPrivacidade,
    "SolicitacaoPerfil": SolicitacaoPerfil,
    "Suporte": Suporte,
    "TermosServico": TermosServico,
    "FlightAware": FlightAware,
    "ValidacaoAcesso": ValidacaoAcesso,
    "portalservicos": portalservicos,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};
