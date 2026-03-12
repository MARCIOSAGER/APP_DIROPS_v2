/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AguardandoAprovacao from './pages/AguardandoAprovacao';
import AlterarSenha from './pages/AlterarSenha';
import Auditoria from './pages/Auditoria';
import BoasVindas from './pages/BoasVindas';
import ConfiguracoesGerais from './pages/ConfiguracoesGerais';
import ConfigurarPerfil from './pages/ConfigurarPerfil';
import Credenciamento from './pages/Credenciamento';
import CredenciamentoPublico from './pages/CredenciamentoPublico';
import Documentos from './pages/Documentos';
import FormularioReclamacaoPublico from './pages/FormularioReclamacaoPublico';
import FundoManeio from './pages/FundoManeio';
import GRF from './pages/GRF';
import GerirPermissoes from './pages/GerirPermissoes';
import GestaoAcessos from './pages/GestaoAcessos';
import GestaoEmpresas from './pages/GestaoEmpresas';
import GestaoNotificacoes from './pages/GestaoNotificacoes';
import GuiaUtilizador from './pages/GuiaUtilizador';
import HistoricoAcessoDocumentos from './pages/HistoricoAcessoDocumentos';
import Home from './pages/Home';
import Inspecoes from './pages/Inspecoes';
import KPIsOperacionais from './pages/KPIsOperacionais';
import LogAuditoria from './pages/LogAuditoria';
import LogAuditoriaDetalhes from './pages/LogAuditoriaDetalhes';
import Manutencao from './pages/Manutencao';
import Operacoes from './pages/Operacoes';
import PaginaInicial from './pages/PaginaInicial';
import PortalEmpresa from './pages/PortalEmpresa';
import PowerBi from './pages/PowerBi';
import Proforma from './pages/Proforma';
import Reclamacoes from './pages/Reclamacoes';
import Safety from './pages/Safety';
import SolicitacaoPerfil from './pages/SolicitacaoPerfil';
import Suporte from './pages/Suporte';
import TesteFlightradar24 from './pages/TesteFlightradar24';
import ValidacaoAcesso from './pages/ValidacaoAcesso';
import portalservicos from './pages/portalservicos';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AguardandoAprovacao": AguardandoAprovacao,
    "AlterarSenha": AlterarSenha,
    "Auditoria": Auditoria,
    "BoasVindas": BoasVindas,
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
    "GestaoEmpresas": GestaoEmpresas,
    "GestaoNotificacoes": GestaoNotificacoes,
    "GuiaUtilizador": GuiaUtilizador,
    "HistoricoAcessoDocumentos": HistoricoAcessoDocumentos,
    "Home": Home,
    "Inspecoes": Inspecoes,
    "KPIsOperacionais": KPIsOperacionais,
    "LogAuditoria": LogAuditoria,
    "LogAuditoriaDetalhes": LogAuditoriaDetalhes,
    "Manutencao": Manutencao,
    "Operacoes": Operacoes,
    "PaginaInicial": PaginaInicial,
    "PortalEmpresa": PortalEmpresa,
    "PowerBi": PowerBi,
    "Proforma": Proforma,
    "Reclamacoes": Reclamacoes,
    "Safety": Safety,
    "SolicitacaoPerfil": SolicitacaoPerfil,
    "Suporte": Suporte,
    "TesteFlightradar24": TesteFlightradar24,
    "ValidacaoAcesso": ValidacaoAcesso,
    "portalservicos": portalservicos,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};