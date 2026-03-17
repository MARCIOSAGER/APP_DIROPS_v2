import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { sanitizeHtml } from '@/lib/sanitize';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Edit, Trash2, RefreshCw, Bell, Send, Mail, MessageSquare, MessageCircle, Users, User, AlertCircle, Sparkles, Play, Globe, FileText } from 'lucide-react';
import Select from '@/components/ui/select';
import Combobox from '@/components/ui/combobox';
import { RegraNotificacao } from '@/entities/RegraNotificacao';
import { User as UserEntity } from '@/entities/User';
import { VooLigado } from '@/entities/VooLigado';
import { base44 } from '@/api/base44Client';
import AlertModal from '@/components/shared/AlertModal';
import SuccessModal from '@/components/shared/SuccessModal';
import PlaceholderManagement from '@/components/configuracoes/PlaceholderManagement';
import ZAPIAtendimentoChat from '@/components/configuracoes/ZAPIAtendimentoChat';
import ZAPIGruposRegistrados from '@/components/configuracoes/ZAPIGruposRegistrados';
import useSubmitGuard from '@/hooks/useSubmitGuard';

const EVENTOS_DISPONIVEIS = [
  { value: 'voo_ligado_criado', label: '✈️ Voo Ligado Criado' },
  { value: 'voo_atualizado', label: '✈️ Voo Atualizado' },
  { value: 'voo_cancelado', label: '❌ Voo Cancelado' },
  { value: 'documento_novo', label: '📄 Novo Documento' },
  { value: 'credenciamento_novo', label: '👤 Novo Credenciamento' },
  { value: 'reclamacao_nova', label: '💬 Nova Reclamação' },
  { value: 'inspecao_concluida', label: '✅ Inspeção Concluída' },
  { value: 'auditoria_concluida', label: '✅ Auditoria Concluída' },
  { value: 'ordem_servico_criada', label: '🔧 Ordem de Serviço Criada' },
  { value: 'relatorio_operacional_diario', label: '📊 Relatório Operacional Diário' },
  { value: 'relatorio_operacional_semanal', label: '📊 Relatório Operacional Semanal' },
  { value: 'relatorio_operacional_mensal', label: '📊 Relatório Operacional Mensal' },
  { value: 'relatorio_operacional_consolidado_diario', label: '🌍 Relatório Consolidado (Diário)' },
  { value: 'relatorio_operacional_consolidado_semanal', label: '🌍 Relatório Consolidado (Semanal)' },
  { value: 'relatorio_operacional_consolidado_mensal', label: '🌍 Relatório Consolidado (Mensal)' }
];

const PERFIS_DISPONIVEIS = [
  { value: 'administrador', label: 'Administrador' },
  { value: 'operacoes', label: 'Operações' },
  { value: 'infraestrutura', label: 'Infraestrutura' },
  { value: 'safety', label: 'Safety' },
  { value: 'avsec', label: 'AVSEC' },
  { value: 'credenciamento', label: 'Credenciamento' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'gestor_empresa', label: 'Gestor Empresa' },
  { value: 'visualizador', label: 'Visualizador' }
];

const CANAIS_DISPONIVEIS = [
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
  { value: 'email', label: 'E-mail', icon: Mail }
];

const AEROPORTOS_ANGOLA = ['FNCA', 'FNUB', 'FNCT', 'FNSO', 'FNSA', 'FNMO', 'FNHU', 'FNLU', 'FNKU', 'FNUE', 'FNME', 'FNDU', 'FNGI', 'FNMA', 'FNUG', 'FNBC'];

const TEMPLATES_PADRAO = {
  relatorio_operacional_consolidado_diario: {
    assunto: '📊 Relatório Operacional Consolidado - {{data_relatorio}}',
    corpo: `<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;line-height:1.6;color:#333;margin:0;padding:0}.container{max-width:900px;margin:0 auto;background:#f8fafc}.header{background:linear-gradient(135deg,#004A99 0%,#0066cc 100%);color:white;padding:40px 20px;text-align:center}.header h1{margin:0;font-size:28px;font-weight:600}.header p{margin:10px 0 0 0;font-size:14px;opacity:0.9}.content{padding:40px 20px}.section{margin-bottom:30px}.section-title{font-size:18px;font-weight:600;color:#004A99;border-bottom:3px solid #004A99;padding-bottom:10px;margin-bottom:20px}.period-badge{background:#e0eeff;padding:15px;border-left:4px solid #004A99;border-radius:4px;margin-bottom:25px}.period-badge p{margin:5px 0}.kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:15px;margin-bottom:30px}.kpi-card{background:white;border:1px solid #e2e8f0;border-radius:8px;padding:20px;box-shadow:0 2px 4px rgba(0,0,0,0.05)}.kpi-label{font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px}.kpi-value{font-size:24px;font-weight:700;color:#004A99}.kpi-icon{font-size:28px;margin-bottom:10px}.footer{background:linear-gradient(135deg,#004A99 0%,#0066cc 100%);color:white;padding:30px 20px;text-align:center;font-size:13px}.footer p{margin:5px 0}</style></head><body><div class="container"><div class="header"><h1>📊 Relatório Operacional Consolidado</h1><p>Diário - {{data_inicio_formatada}}</p></div><div class="content"><div class="section"><div class="period-badge"><p><strong>📅 Período:</strong> {{data_inicio_formatada}}</p><p><strong>🏢 Aeroportos:</strong> {{total_aeroportos}}</p></div></div><div class="section"><div class="section-title">📈 Indicadores Principais</div><div class="kpi-grid"><div class="kpi-card"><div class="kpi-icon">✈️</div><div class="kpi-label">Movimentos</div><div class="kpi-value">{{total_voos_geral}}</div></div><div class="kpi-card"><div class="kpi-icon">👥</div><div class="kpi-label">Passageiros</div><div class="kpi-value">{{total_passageiros_geral}}</div></div><div class="kpi-card"><div class="kpi-icon">💰</div><div class="kpi-label">Faturação</div><div class="kpi-value">$[...]</div></div></div></div><div class="section"><div class="section-title">🌍 Detalhes por Aeroporto</div>{{detalhes_aeroportos_html}}</div></div><div class="footer"><p><strong>DIROPS</strong> | Relatório Operacional Consolidado</p></div></div></body></html>`
  },
  relatorio_operacional_consolidado_semanal: {
    assunto: '📊 Relatório Semanal - {{data_inicio_formatada}} a {{data_fim_formatada}}',
    corpo: `<html><body style="font-family:Arial,sans-serif;background:#f5f5f5"><div style="max-width:800px;margin:0 auto;background:white;padding:20px"><h2 style="color:#004A99">📊 Relatório Operacional Semanal</h2><p><strong>Período:</strong> {{data_inicio_formatada}} a {{data_fim_formatada}}</p><div style="background:#e0eeff;padding:15px;border-left:4px solid #004A99;margin:20px 0"><p><strong>✈️ Movimentos:</strong> {{total_voos_geral}}</p><p><strong>👥 Passageiros:</strong> {{total_passageiros_geral}}</p><p><strong>💰 Faturação:</strong> $[...]</p></div><p>{{detalhes_aeroportos_html}}</p></div></body></html>`
  },
  relatorio_operacional_consolidado_mensal: {
    assunto: '📊 Relatório Mensal - {{mes_ano}}',
    corpo: `<html><body style="font-family:Arial,sans-serif;background:#f5f5f5"><div style="max-width:800px;margin:0 auto;background:white;padding:20px"><h2 style="color:#004A99">📊 Relatório Operacional Mensal</h2><p><strong>Mês:</strong> {{mes_ano}}</p><div style="background:#e0eeff;padding:15px;border-left:4px solid #004A99;margin:20px 0"><p><strong>✈️ Movimentos:</strong> {{total_voos_geral}}</p><p><strong>👥 Passageiros:</strong> {{total_passageiros_geral}}</p><p><strong>📦 Carga:</strong> {{total_carga_kg_geral}} kg</p><p><strong>💰 Faturação:</strong> $[...]</p></div><p>{{detalhes_aeroportos_html}}</p></div></body></html>`
  },
  voo_ligado_criado: {
    assunto: '✈️ Novo Voo Ligado - {{numero_voo_arr}} → {{numero_voo_dep}}',
    corpo: `<p>Um novo voo ligado foi criado:</p><p><strong>Chegada:</strong> {{numero_voo_arr}} em {{aeroporto}} às {{horario_real_arr}}</p><p><strong>Partida:</strong> {{numero_voo_dep}} de {{aeroporto}} às {{horario_previsto_dep}}</p><p><strong>Permanência:</strong> {{permanencia_horas}} horas</p><p><strong>Passageiros:</strong> {{passageiros_total_arr}} → {{passageiros_total_dep}}</p>`
  },
  voo_atualizado: {
    assunto: '✏️ Voo Atualizado - {{numero_voo}}',
    corpo: `<p>O voo <strong>{{numero_voo}}</strong> foi atualizado:</p><p><strong>Tipo:</strong> {{tipo_movimento}} | <strong>Status:</strong> {{status}}</p><p><strong>Horário Real:</strong> {{horario_real}}</p><p><strong>Passageiros:</strong> {{passageiros_total}}</p>`
  },
  voo_cancelado: {
    assunto: '❌ Voo Cancelado - {{numero_voo}}',
    corpo: `<p>O voo <strong>{{numero_voo}}</strong> foi cancelado.</p><p><strong>Motivo:</strong> {{motivo}}</p><p><strong>Observações:</strong> {{observacoes}}</p>`
  }
};

const TEMPLATES_AEROPORTOS = {
  simples: {
    nome: '📋 Simples',
    descricao: 'Informações essenciais em formato limpo',
    html: '<div style="background:white;border:2px solid #e2e8f0;border-radius:8px;padding:15px;margin-bottom:15px;border-left:4px solid #004A99"><h3 style="color:#004A99;margin:0 0 10px 0">CODIGO - NOME</h3><p style="margin:8px 0"><strong>✈️ Movimentos:</strong> VOOS</p><p style="margin:8px 0"><strong>👥 Passageiros:</strong> PASSAGEIROS</p><p style="margin:8px 0"><strong>📦 Carga:</strong> CARGA kg</p><p style="margin:8px 0"><strong>💰 Faturação:</strong> $FATURACAO</p></div>'
  },
  detalhado: {
    nome: '📊 Detalhado',
    descricao: 'Com análise completa e múltiplos KPIs',
    html: '<div style="background:white;border-radius:8px;padding:20px;margin-bottom:15px;border:1px solid #e2e8f0;box-shadow:0 2px 4px rgba(0,0,0,0.05)"><h3 style="color:#004A99;margin:0 0 15px 0;border-bottom:2px solid #004A99;padding-bottom:10px">CODIGO - NOME</h3><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:15px"><div><div style="font-size:12px;color:#64748b;text-transform:uppercase">✈️ Movimentos</div><div style="font-size:20px;font-weight:700;color:#004A99">VOOS</div></div><div><div style="font-size:12px;color:#64748b;text-transform:uppercase">👥 Passageiros</div><div style="font-size:20px;font-weight:700;color:#004A99">PASSAGEIROS</div></div><div><div style="font-size:12px;color:#64748b;text-transform:uppercase">📦 Carga (kg)</div><div style="font-size:20px;font-weight:700;color:#004A99">CARGA</div></div><div><div style="font-size:12px;color:#64748b;text-transform:uppercase">💰 Faturação USD</div><div style="font-size:20px;font-weight:700;color:#16a34a">$FATURACAO</div></div></div></div>'
  },
  minimalista: {
    nome: '✨ Minimalista',
    descricao: 'Design ultra-limpo e elegante',
    html: '<div style="padding:12px 0;border-bottom:1px solid #e2e8f0"><div style="font-weight:600;color:#004A99;margin-bottom:8px">CODIGO · NOME</div><div style="display:flex;justify-content:space-between;font-size:13px;color:#64748b"><span>✈️ VOOS | 👥 PASSAGEIROS | 📦 CARGAkg | 💰 $FATURACAO</span></div></div>'
  },
  profissional: {
    nome: '🎯 Profissional',
    descricao: 'Layout premium com design corporativo',
    html: '<div style="background:linear-gradient(135deg,#f8fafc 0%,#e0eeff 100%);border-radius:12px;padding:20px;margin-bottom:15px;border:1px solid #004A99"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px"><div><h4 style="margin:0;color:#004A99;font-size:16px">CODIGO</h4><p style="margin:3px 0 0 0;color:#64748b;font-size:12px">NOME</p></div></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px"><div style="background:white;padding:12px;border-radius:6px;text-align:center"><div style="font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase">Movimentos</div><div style="font-size:24px;font-weight:700;color:#004A99;margin-top:4px">VOOS</div></div><div style="background:white;padding:12px;border-radius:6px;text-align:center"><div style="font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase">Passageiros</div><div style="font-size:24px;font-weight:700;color:#004A99;margin-top:4px">PASSAGEIROS</div></div><div style="background:white;padding:12px;border-radius:6px;text-align:center"><div style="font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase">Carga (kg)</div><div style="font-size:24px;font-weight:700;color:#004A99;margin-top:4px">CARGA</div></div><div style="background:white;padding:12px;border-radius:6px;text-align:center"><div style="font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase">Faturação</div><div style="font-size:24px;font-weight:700;color:#16a34a">$FATURACAO</div></div></div></div>'
  }
};

const PLACEHOLDERS_INFO_SISTEMA = {
  relatorio_operacional_consolidado_diario: [
    '{{mes_ano}}', '{{periodo}}', '{{data_inicio}}', '{{data_fim}}', '{{data_inicio_formatada}}', '{{data_fim_formatada}}',
    '{{data_relatorio}}', '{{semana_inicio}}', '{{semana_fim}}',
    '{{total_aeroportos}}', '{{total_voos_geral}}', '{{total_voos_arr_geral}}', '{{total_voos_dep_geral}}',
    '{{total_passageiros_geral}}', '{{total_carga_kg_geral}}',
    '{{total_faturacao_usd_geral}}', '{{total_faturacao_aoa_geral}}',
    '{{total_impostos_usd_geral}}', '{{total_impostos_aoa_geral}}',
    '{{subtotal_sem_impostos_usd_geral}}', '{{subtotal_sem_impostos_aoa_geral}}',
    '{{created_date}}', '{{created_by}}', '{{detalhes_aeroportos_json}}',
    '{{detalhes_aeroportos_html}}', '{{detalhes_aeroportos_texto}}'
  ],
  relatorio_operacional_consolidado_semanal: [
    '{{mes_ano}}', '{{periodo}}', '{{data_inicio}}', '{{data_fim}}', '{{data_inicio_formatada}}', '{{data_fim_formatada}}',
    '{{data_relatorio}}', '{{semana_inicio}}', '{{semana_fim}}',
    '{{total_aeroportos}}', '{{total_voos_geral}}', '{{total_voos_arr_geral}}', '{{total_voos_dep_geral}}',
    '{{total_passageiros_geral}}', '{{total_carga_kg_geral}}',
    '{{total_faturacao_usd_geral}}', '{{total_faturacao_aoa_geral}}',
    '{{total_impostos_usd_geral}}', '{{total_impostos_aoa_geral}}',
    '{{subtotal_sem_impostos_usd_geral}}', '{{subtotal_sem_impostos_aoa_geral}}',
    '{{created_date}}', '{{created_by}}', '{{detalhes_aeroportos_json}}',
    '{{detalhes_aeroportos_html}}', '{{detalhes_aeroportos_texto}}'
  ],
  relatorio_operacional_consolidado_mensal: [
    '{{mes_ano}}', '{{periodo}}', '{{data_inicio}}', '{{data_fim}}', '{{data_inicio_formatada}}', '{{data_fim_formatada}}',
    '{{data_relatorio}}', '{{semana_inicio}}', '{{semana_fim}}',
    '{{total_aeroportos}}', '{{total_voos_geral}}', '{{total_voos_arr_geral}}', '{{total_voos_dep_geral}}',
    '{{total_passageiros_geral}}', '{{total_carga_kg_geral}}',
    '{{total_faturacao_usd_geral}}', '{{total_faturacao_aoa_geral}}',
    '{{total_impostos_usd_geral}}', '{{total_impostos_aoa_geral}}',
    '{{subtotal_sem_impostos_usd_geral}}', '{{subtotal_sem_impostos_aoa_geral}}',
    '{{created_date}}', '{{created_by}}', '{{detalhes_aeroportos_json}}',
    '{{detalhes_aeroportos_html}}', '{{detalhes_aeroportos_texto}}'
  ],
  voo_ligado_criado: [
    '{{numero_voo_arr}}', '{{numero_voo_dep}}', '{{aeroporto}}', '{{aeroporto_origem}}', '{{aeroporto_destino}}',
    '{{companhia}}', '{{registo}}', '{{tipo_voo}}', '{{status}}',
    '{{data_arr}}', '{{hora_arr}}', '{{horario_previsto_arr}}', '{{horario_real_arr}}',
    '{{data_dep}}', '{{hora_dep}}', '{{horario_previsto_dep}}', '{{horario_real_dep}}',
    '{{permanencia_horas}}', '{{permanencia_minutos}}',
    '{{passageiros_local_arr}}', '{{passageiros_local_dep}}',
    '{{passageiros_transito_arr}}', '{{passageiros_transito_dep}}',
    '{{passageiros_total_arr}}', '{{passageiros_total_dep}}',
    '{{tripulacao_arr}}', '{{tripulacao_dep}}',
    '{{carga_kg_arr}}', '{{carga_kg_dep}}',
    '{{mtow_kg}}',
    '{{tarifa_pouso_usd}}', '{{tarifa_permanencia_usd}}', '{{tarifa_passageiros_usd}}', '{{tarifa_carga_usd}}',
    '{{total_usd}}', '{{total_aoa}}', '{{taxa_cambio}}',
    '{{created_by}}', '{{created_date}}'
  ],
  voo_atualizado: [
    '{{numero_voo}}', '{{tipo_movimento}}', '{{aeroporto}}', '{{aeroporto_origem}}', '{{aeroporto_destino}}',
    '{{companhia}}', '{{registo}}', '{{tipo_voo}}', '{{status}}',
    '{{data_operacao}}', '{{horario_previsto}}', '{{horario_real}}',
    '{{passageiros_total}}', '{{tripulacao}}', '{{carga_kg}}',
    '{{observacoes}}', '{{updated_by}}', '{{updated_date}}'
  ],
  voo_cancelado: [
    '{{numero_voo}}', '{{tipo_movimento}}', '{{aeroporto}}', '{{aeroporto_origem_destino}}',
    '{{companhia}}', '{{registo}}', '{{data_operacao}}', '{{horario_previsto}}',
    '{{motivo}}', '{{observacoes}}', '{{updated_by}}', '{{updated_date}}'
  ],
  documento_novo: [
    '{{titulo_documento}}', '{{categoria}}', '{{aeroporto}}', '{{versao}}',
    '{{descricao}}', '{{nivel_confidencialidade}}', '{{data_publicacao}}',
    '{{autor}}', '{{created_by}}', '{{created_date}}'
  ],
  credenciamento_novo: [
    '{{nome}}', '{{empresa}}', '{{area_acesso}}', '{{aeroporto}}',
    '{{tipo_credenciamento}}', '{{validade}}', '{{status}}',
    '{{created_by}}', '{{created_date}}'
  ],
  reclamacao_nova: [
    '{{numero_reclamacao}}', '{{reclamante}}', '{{email_reclamante}}', '{{telefone_reclamante}}',
    '{{assunto}}', '{{categoria}}', '{{descricao}}', '{{aeroporto}}',
    '{{prioridade}}', '{{status}}', '{{created_by}}', '{{created_date}}'
  ],
  inspecao_concluida: [
    '{{tipo_inspecao}}', '{{aeroporto}}', '{{inspetor}}', '{{equipe}}',
    '{{data_inspecao}}', '{{hora_inicio}}', '{{hora_fim}}',
    '{{total_itens}}', '{{itens_conformes}}', '{{itens_nao_conformes}}', '{{conformidade}}',
    '{{resumo}}', '{{requer_acao}}', '{{status}}', '{{created_by}}', '{{created_date}}'
  ],
  auditoria_concluida: [
    '{{tipo_auditoria}}', '{{aeroporto}}', '{{auditor}}', '{{equipe}}',
    '{{data_auditoria}}', '{{total_itens}}', '{{itens_conformes}}', '{{itens_nao_conformes}}',
    '{{conformidade}}', '{{observacoes}}', '{{status}}', '{{created_by}}', '{{created_date}}'
  ],
  ordem_servico_criada: [
    '{{numero_os}}', '{{tipo_servico}}', '{{prioridade}}', '{{descricao}}',
    '{{aeroporto}}', '{{area}}', '{{responsavel}}', '{{prazo}}',
    '{{status}}', '{{created_by}}', '{{created_date}}'
  ],
  relatorio_operacional_diario: [
    '{{data_relatorio}}', '{{data_inicio}}', '{{data_fim}}', '{{aeroporto_icao}}', '{{aeroporto}}', '{{aeroporto_nome}}', 
    '{{total_voos}}', '{{voos_arr}}', '{{voos_dep}}', '{{total_passageiros}}', '{{total_carga_kg}}', 
    '{{tempo_medio_permanencia}}', '{{tempo_medio_estacionamento}}', '{{total_tarifa_usd}}', '{{total_tarifa}}', 
    '{{total_impostos_usd}}', '{{total_impostos_aoa}}', '{{subtotal_sem_impostos_usd}}', '{{subtotal_sem_impostos_aoa}}',
    '{{taxa_cambio_usd_aoa}}', '{{periodo_noturno}}', '{{created_date}}', '{{created_by}}'
  ],
  relatorio_operacional_semanal: [
    '{{semana_inicio}}', '{{semana_fim}}', '{{data_inicio}}', '{{data_fim}}', '{{aeroporto_icao}}', '{{aeroporto}}', 
    '{{aeroporto_nome}}', '{{total_voos}}', '{{voos_arr}}', '{{voos_dep}}', '{{total_passageiros}}', '{{total_carga_kg}}', 
    '{{tempo_medio_permanencia}}', '{{tempo_medio_estacionamento}}', '{{total_tarifa_usd}}', '{{total_tarifa}}', 
    '{{total_impostos_usd}}', '{{total_impostos_aoa}}', '{{subtotal_sem_impostos_usd}}', '{{subtotal_sem_impostos_aoa}}',
    '{{taxa_cambio_usd_aoa}}', '{{periodo_noturno}}', '{{created_date}}', '{{created_by}}'
  ],
  relatorio_operacional_mensal: [
    '{{mes_ano}}', '{{data_inicio}}', '{{data_fim}}', '{{aeroporto_icao}}', '{{aeroporto}}', '{{aeroporto_nome}}', 
    '{{total_voos}}', '{{voos_arr}}', '{{voos_dep}}', '{{total_passageiros}}', '{{total_carga_kg}}', 
    '{{tempo_medio_permanencia}}', '{{tempo_medio_estacionamento}}', '{{total_tarifa_usd}}', '{{total_tarifa}}', 
    '{{total_impostos_usd}}', '{{total_impostos_aoa}}', '{{subtotal_sem_impostos_usd}}', '{{subtotal_sem_impostos_aoa}}',
    '{{taxa_cambio_usd_aoa}}', '{{periodo_noturno}}', '{{created_date}}', '{{created_by}}'
  ],

  };

export default function GestaoNotificacoes() {
  const [regras, setRegras] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [aeroportos, setAeroportos] = useState([]);
  const [placeholdersGlobais, setPlaceholdersGlobais] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRegra, setEditingRegra] = useState(null);
  const [activeTab, setActiveTab] = useState('geral');
  const { guardedSubmit } = useSubmitGuard();

  const [formData, setFormData] = useState({
    nome: '',
    evento_gatilho: '',
    canal_envio: [],
    destinatarios_perfis: [],
    destinatarios_usuarios_ids: [],
    grupo_whatsapp_id: '',
    mensagem_template_whatsapp: '',
    mensagem_template_email_assunto: '',
    mensagem_template_email_corpo: '',
    template_html_aeroportos: '',
    prompt_ia_personalizado: '',
    ativo: true,
    aeroporto_icao_relatorio: ''
  });

  const [searchUsuario, setSearchUsuario] = useState('');
  const [filtrarOptInConfirmado, setFiltrarOptInConfirmado] = useState(false);
  const [gruposWhatsApp, setGruposWhatsApp] = useState([]);
  const [isGeneratingIA, setIsGeneratingIA] = useState({ whatsapp: false, email_assunto: false, email_corpo: false, template_html: false });
  const [showTestModal, setShowTestModal] = useState(false);
  const [testeData, setTesteData] = useState({ email: '', whatsapp: '' });
  const [enviandoOptIn, setEnviandoOptIn] = useState({});
  const [isSendingTest, setIsSendingTest] = useState(false);
  
  const [showRunModal, setShowRunModal] = useState(false);
  const [runRegraId, setRunRegraId] = useState(null);
  const [voosLigados, setVoosLigados] = useState([]);
  const [selectedVooLigadoId, setSelectedVooLigadoId] = useState('');
  const [aeroportosModal, setAeroportosModal] = useState([]);
  const [selectedAeroporto, setSelectedAeroporto] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [periodoConsolidado, setPeriodoConsolidado] = useState('');
  const [historico, setHistorico] = useState([]);
  const [filtrosHistorico, setFiltrosHistorico] = useState({ status: 'todos', canal: 'todos' });
  const [historicoSelecionado, setHistoricoSelecionado] = useState(new Set());

  const [alertInfo, setAlertInfo] = useState({ isOpen: false, type: 'info', title: '', message: '' });
  const [successInfo, setSuccessInfo] = useState({ isOpen: false, title: '', message: '' });
  const [regrasSelecionadas, setRegrasSelecionadas] = useState(new Set());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const user = await UserEntity.me();
      setCurrentUser(user);

      if (user.role !== 'admin' && !(user.perfis && user.perfis.includes('administrador'))) {
        setAlertInfo({
          isOpen: true,
          type: 'error',
          title: 'Acesso Negado',
          message: 'Apenas administradores podem aceder a esta página.'
        });
        return;
      }

      const [regrasData, usuariosData, aeroportosData, historicoData, placeholdersData, gruposData] = await Promise.all([
        RegraNotificacao.list(),
        UserEntity.list(),
        base44.entities.Aeroporto.list(),
        base44.entities.HistoricoNotificacao.list('-created_date', 100),
        base44.entities.Placeholder.filter({ ativo: true }).catch(() => []),
        base44.entities.GrupoWhatsApp.filter({ status: 'aprovado' }).catch(() => [])
      ]);

      setRegras(regrasData || []);
      setUsuarios(usuariosData || []);
      setAeroportos(aeroportosData || []);
      setHistorico(historicoData || []);
      setPlaceholdersGlobais(placeholdersData || []);
      setGruposWhatsApp(gruposData || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro',
        message: 'Não foi possível carregar os dados.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenForm = (regra = null) => {
    setActiveTab('geral');
    if (regra) {
      setEditingRegra(regra);

      // Usar template padrão se os campos de email estão vazios
      const templatePadrao = TEMPLATES_PADRAO[regra.evento_gatilho];
      const assunto = regra.mensagem_template_email_assunto || (templatePadrao?.assunto || '');
      const corpo = regra.mensagem_template_email_corpo || (templatePadrao?.corpo || '');

      setFormData({
        nome: regra.nome || '',
        evento_gatilho: regra.evento_gatilho || '',
        canal_envio: regra.canal_envio || [],
        destinatarios_perfis: regra.destinatarios_perfis || [],
        destinatarios_usuarios_ids: regra.destinatarios_usuarios_ids || [],
        grupo_whatsapp_id: regra.grupo_whatsapp_id || '',
        mensagem_template_whatsapp: regra.mensagem_template_whatsapp || '',
        mensagem_template_email_assunto: assunto,
        mensagem_template_email_corpo: corpo,
        template_html_aeroportos: regra.template_html_aeroportos || '',
        prompt_ia_personalizado: regra.prompt_ia_personalizado || '',
        ativo: regra.ativo !== undefined ? regra.ativo : true,
        aeroporto_icao_relatorio: regra.aeroporto_icao_relatorio || ''
      });
    } else {
      setEditingRegra(null);
      setFormData({
        nome: '',
        evento_gatilho: '',
        canal_envio: [],
        destinatarios_perfis: [],
        destinatarios_usuarios_ids: [],
        grupo_whatsapp_id: '',
        mensagem_template_whatsapp: '',
        mensagem_template_email_assunto: '📊 Relatório Operacional Consolidado - {{data_relatorio}}',
        mensagem_template_email_corpo: '<html><body>Relatório Operacional</body></html>',
        template_html_aeroportos: '<div class="airport-card"><div class="airport-name">CODIGO - NOME</div><div class="airport-grid"><div class="airport-item"><div class="airport-label">✈️ Movimentos</div><div class="airport-value">VOOS</div></div><div class="airport-item"><div class="airport-label">👥 Passageiros</div><div class="airport-value">PASSAGEIROS</div></div><div class="airport-item"><div class="airport-label">📦 Carga (kg)</div><div class="airport-value">CARGA</div></div><div class="airport-item"><div class="airport-label">💰 Faturação</div><div class="airport-value currency-usd">$FATURACAO</div></div></div></div>',
        prompt_ia_personalizado: '',
        ativo: true,
        aeroporto_icao_relatorio: ''
      });
    }
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingRegra(null);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleCanal = (canal) => {
    setFormData(prev => ({
      ...prev,
      canal_envio: prev.canal_envio.includes(canal)
        ? prev.canal_envio.filter(c => c !== canal)
        : [...prev.canal_envio, canal]
    }));
  };

  const togglePerfil = (perfil) => {
    setFormData(prev => ({
      ...prev,
      destinatarios_perfis: prev.destinatarios_perfis.includes(perfil)
        ? prev.destinatarios_perfis.filter(p => p !== perfil)
        : [...prev.destinatarios_perfis, perfil]
    }));
  };

  const toggleUsuario = (userId) => {
    setFormData(prev => ({
      ...prev,
      destinatarios_usuarios_ids: prev.destinatarios_usuarios_ids.includes(userId)
        ? prev.destinatarios_usuarios_ids.filter(id => id !== userId)
        : [...prev.destinatarios_usuarios_ids, userId]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.nome || !formData.evento_gatilho || formData.canal_envio.length === 0) {
      setAlertInfo({
        isOpen: true,
        type: 'warning',
        title: 'Campos Obrigatórios',
        message: 'Por favor, preencha o nome, evento gatilho e selecione pelo menos um canal.'
      });
      return;
    }

    if (formData.destinatarios_perfis.length === 0 && formData.destinatarios_usuarios_ids.length === 0) {
      setAlertInfo({
        isOpen: true,
        type: 'warning',
        title: 'Destinatários Obrigatórios',
        message: 'Por favor, selecione pelo menos um perfil ou utilizador.'
      });
      return;
    }

    if (formData.canal_envio.includes('whatsapp') && formData.mensagem_template_whatsapp.length > 1600) {
      setAlertInfo({
        isOpen: true,
        type: 'warning',
        title: 'Limite de Caracteres Excedido',
        message: `O template de WhatsApp tem ${formData.mensagem_template_whatsapp.length} caracteres. O limite é 1600. Por favor, reduza o comprimento da mensagem.`
      });
      return;
    }

    guardedSubmit(async () => {
    try {
      const dataToSave = {
        ...formData,
        updated_by: currentUser.email,
        ...(editingRegra ? {} : { created_by: currentUser.email })
      };

      if (editingRegra) {
        await RegraNotificacao.update(editingRegra.id, dataToSave);
      } else {
        await RegraNotificacao.create(dataToSave);
      }

      await loadData();
      handleCloseForm();

      setSuccessInfo({
        isOpen: true,
        title: editingRegra ? 'Regra Atualizada!' : 'Regra Criada!',
        message: `A regra "${formData.nome}" foi ${editingRegra ? 'atualizada' : 'criada'} com sucesso.`
      });
    } catch (error) {
      console.error('Erro ao salvar regra:', error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro',
        message: 'Não foi possível salvar a regra.'
      });
    }
    });
  };

  const handleToggleAtivo = async (regra) => {
    try {
      await RegraNotificacao.update(regra.id, { 
        ...regra, 
        ativo: !regra.ativo,
        updated_by: currentUser.email 
      });
      await loadData();
      setSuccessInfo({
        isOpen: true,
        title: regra.ativo ? 'Regra Desativada' : 'Regra Ativada',
        message: `A regra "${regra.nome}" foi ${regra.ativo ? 'desativada' : 'ativada'}.`
      });
    } catch (error) {
      console.error('Erro ao alternar estado:', error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro',
        message: 'Não foi possível alterar o estado da regra.'
      });
    }
  };

  const handleDelete = (regra) => {
    setAlertInfo({
      isOpen: true,
      type: 'error',
      title: 'Excluir Regra',
      message: `Tem certeza que deseja excluir a regra "${regra.nome}"?`,
      showCancel: true,
      confirmText: 'Excluir',
      onConfirm: async () => {
        setAlertInfo(prev => ({ ...prev, isOpen: false }));
        try {
          await RegraNotificacao.delete(regra.id);
          await loadData();
          setSuccessInfo({
            isOpen: true,
            title: 'Regra Excluída!',
            message: `A regra "${regra.nome}" foi excluída com sucesso.`
          });
        } catch (error) {
          console.error('Erro ao excluir regra:', error);
          setAlertInfo({
            isOpen: true,
            type: 'error',
            title: 'Erro',
            message: 'Não foi possível excluir a regra.'
          });
        }
      }
    });
  };

  const toggleRegraSelection = (regraId) => {
    const novasRegras = new Set(regrasSelecionadas);
    if (novasRegras.has(regraId)) {
      novasRegras.delete(regraId);
    } else {
      novasRegras.add(regraId);
    }
    setRegrasSelecionadas(novasRegras);
  };

  const toggleAllRegras = () => {
    if (regrasSelecionadas.size === regras.length) {
      setRegrasSelecionadas(new Set());
    } else {
      setRegrasSelecionadas(new Set(regras.map(r => r.id)));
    }
  };

  const handleApagarSelecionadas = () => {
    const quantidade = regrasSelecionadas.size;
    setAlertInfo({
      isOpen: true,
      type: 'error',
      title: `Apagar ${quantidade} Regra(s)`,
      message: `Tem certeza que deseja apagar ${quantidade} regra(s) selecionada(s)? Esta ação é irreversível.`,
      showCancel: true,
      confirmText: 'Apagar Tudo',
      onConfirm: async () => {
        setAlertInfo(prev => ({ ...prev, isOpen: false }));
        try {
          let apagaramComSucesso = 0;
          for (const regraId of regrasSelecionadas) {
            try {
              await RegraNotificacao.delete(regraId);
              apagaramComSucesso++;
            } catch (e) {
              console.error(`Erro ao apagar regra ${regraId}:`, e);
            }
          }
          await loadData();
          setRegrasSelecionadas(new Set());
          setSuccessInfo({
            isOpen: true,
            title: 'Regras Apagadas!',
            message: `${apagaramComSucesso} de ${quantidade} regra(s) foram apagadas com sucesso.`
          });
        } catch (error) {
          console.error('Erro ao apagar regras:', error);
          setAlertInfo({
            isOpen: true,
            type: 'error',
            title: 'Erro',
            message: 'Não foi possível apagar as regras selecionadas.'
          });
        }
      }
    });
  };

  const toggleHistoricoSelection = (recordId) => {
    const novos = new Set(historicoSelecionado);
    if (novos.has(recordId)) {
      novos.delete(recordId);
    } else {
      novos.add(recordId);
    }
    setHistoricoSelecionado(novos);
  };

  const toggleAllHistorico = () => {
    const historicoFiltrado = historico.filter(item => {
      const matchStatus = filtrosHistorico.status === 'todos' || item.status === filtrosHistorico.status;
      const matchCanal = filtrosHistorico.canal === 'todos' || item.canais_enviados?.includes(filtrosHistorico.canal);
      return matchStatus && matchCanal;
    });
    if (historicoSelecionado.size === historicoFiltrado.length) {
      setHistoricoSelecionado(new Set());
    } else {
      setHistoricoSelecionado(new Set(historicoFiltrado.map(h => h.id)));
    }
  };

  const handleApagarHistoricoSelecionado = () => {
    const quantidade = historicoSelecionado.size;
    setAlertInfo({
      isOpen: true,
      type: 'error',
      title: `Apagar ${quantidade} Notificação(ões)`,
      message: `Tem certeza que deseja apagar ${quantidade} notificação(ões) do histórico? Esta ação é irreversível.`,
      showCancel: true,
      confirmText: 'Apagar',
      onConfirm: async () => {
        setAlertInfo(prev => ({ ...prev, isOpen: false }));
        try {
          let apagaramComSucesso = 0;
          let errosDetalhados = [];
          
          for (const recordId of historicoSelecionado) {
            try {
              await base44.entities.HistoricoNotificacao.delete(recordId);
              apagaramComSucesso++;
            } catch (e) {
              console.error(`❌ Erro ao apagar ${recordId}:`, e);
              errosDetalhados.push(`${recordId}: ${e.message}`);
            }
          }
          
          await loadData();
          setHistoricoSelecionado(new Set());
          
          let mensagem = `${apagaramComSucesso} de ${quantidade} notificação(ões) foram apagadas com sucesso.`;
          if (errosDetalhados.length > 0) {
            mensagem += `\n\nErros: ${errosDetalhados.join(', ')}`;
          }
          
          setSuccessInfo({
            isOpen: true,
            title: apagaramComSucesso > 0 ? 'Notificações Apagadas!' : 'Erro ao Apagar',
            message: mensagem
          });
        } catch (error) {
          console.error('❌ Erro ao apagar notificações:', error);
          setAlertInfo({
            isOpen: true,
            type: 'error',
            title: 'Erro',
            message: `Não foi possível apagar as notificações selecionadas.\n\nErro: ${error.message}`
          });
        }
      }
    });
  };

  // Combinar placeholders do sistema com globais
  const placeholdersDoSistema = formData.evento_gatilho 
    ? PLACEHOLDERS_INFO_SISTEMA[formData.evento_gatilho] || []
    : [];
  
  const placeholdersDisponiveis = [
    ...placeholdersDoSistema,
    ...placeholdersGlobais.map(ph => `{{${ph.nome}}}`)
  ];

  const usuariosFiltrados = usuarios.filter(user => {
    // Filtro de busca por nome/email
    if (searchUsuario) {
      const search = searchUsuario.toLowerCase();
      const matchesSearch = user.full_name?.toLowerCase().includes(search) || 
                           user.email?.toLowerCase().includes(search);
      if (!matchesSearch) return false;
    }
    
    // Filtro de opt-in confirmado (apenas se WhatsApp estiver selecionado)
    if (filtrarOptInConfirmado && formData.canal_envio.includes('whatsapp')) {
      return user.whatsapp_opt_in_status === 'confirmado';
    }
    
    return true;
  });
  
  const handleEnviarOptIn = async (userId) => {
    setEnviandoOptIn(prev => ({ ...prev, [userId]: true }));
    
    try {
      const response = await base44.functions.invoke('enviarOptInWhatsApp', { user_id: userId });
      
      if (response.data && response.data.sucesso) {
        await loadData(); // Recarregar para atualizar status
        
        setSuccessInfo({
          isOpen: true,
          title: 'Solicitação Enviada! 📱',
          message: response.data.mensagem || 'Solicitação de opt-in enviada com sucesso.'
        });
      }
    } catch (error) {
      console.error('Erro ao enviar opt-in:', error);
      
      let errorMsg = 'Não foi possível enviar a solicitação de opt-in.';
      if (error.response?.data?.error) {
        errorMsg = error.response.data.error;
        if (error.response.data.details) {
          errorMsg += `\n\n${error.response.data.details}`;
        }
      }
      
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro ao Enviar Opt-in',
        message: errorMsg
      });
    } finally {
      setEnviandoOptIn(prev => ({ ...prev, [userId]: false }));
    }
  };

  // Gerar preview da mensagem com dados de exemplo
  const getPreviewData = () => {
    const previews = {
      voo_ligado_criado: {
        numero_voo_arr: 'DT123',
        numero_voo_dep: 'DT456',
        aeroporto: 'FNLU',
        aeroporto_origem: 'FNSA',
        aeroporto_destino: 'FNHU',
        companhia: 'TAAG',
        registo: 'D2-TEF',
        tipo_voo: 'Regular',
        status: 'Realizado',
        data_arr: '2026-01-20',
        hora_arr: '14:35',
        horario_previsto_arr: '14:30',
        horario_real_arr: '14:35',
        data_dep: '2026-01-20',
        hora_dep: '16:50',
        horario_previsto_dep: '16:45',
        horario_real_dep: '16:50',
        permanencia_horas: '2.5',
        permanencia_minutos: '150',
        passageiros_local_arr: '100',
        passageiros_local_dep: '115',
        passageiros_transito_arr: '20',
        passageiros_transito_dep: '18',
        passageiros_total_arr: '120',
        passageiros_total_dep: '133',
        tripulacao_arr: '8',
        tripulacao_dep: '8',
        carga_kg_arr: '1800',
        carga_kg_dep: '2200',
        mtow_kg: '75000',
        tarifa_pouso_usd: '450.00',
        tarifa_permanencia_usd: '125.50',
        tarifa_passageiros_usd: '540.00',
        tarifa_carga_usd: '134.50',
        total_usd: '1,250.00',
        total_aoa: '1,062,500',
        taxa_cambio: '850',
        created_by: 'operador@sga.ao',
        created_date: '2026-01-20 14:30'
      },
      voo_atualizado: {
        numero_voo: 'DT789',
        tipo_movimento: 'ARR',
        aeroporto: 'FNLU',
        aeroporto_origem: 'FNSA',
        aeroporto_destino: 'FNHU',
        status: 'Realizado',
        data_operacao: '2026-01-20',
        horario_previsto: '14:30',
        horario_real: '14:35',
        companhia: 'TAAG',
        registo: 'D2-TEF',
        tipo_voo: 'Regular',
        passageiros_total: '135',
        tripulacao: '8',
        carga_kg: '2500',
        observacoes: 'Operação normal',
        updated_by: 'operador@sga.ao',
        updated_date: '2026-01-20 15:00'
      },
      voo_cancelado: {
        numero_voo: 'DT321',
        tipo_movimento: 'DEP',
        aeroporto: 'FNLU',
        aeroporto_origem_destino: 'FNHU',
        companhia: 'TAAG',
        registo: 'D2-TEF',
        data_operacao: '2026-01-20',
        horario_previsto: '18:00',
        motivo: 'Condições meteorológicas',
        observacoes: 'Cancelado devido a nevoeiro',
        updated_by: 'operador@sga.ao',
        updated_date: '2026-01-20 16:00'
      },
      documento_novo: {
        titulo_documento: 'Manual de Operações',
        categoria: 'manual_operacoes',
        aeroporto: 'FNLU',
        versao: '2.1',
        descricao: 'Atualização do manual operacional',
        nivel_confidencialidade: 'interno',
        data_publicacao: '2026-01-20',
        autor: 'João Silva',
        created_by: 'operador@sga.ao',
        created_date: '2026-01-20'
      },
      credenciamento_novo: {
        nome: 'João Silva',
        empresa: 'TAAG',
        area_acesso: 'Terminal Internacional',
        aeroporto: 'FNLU',
        tipo_credenciamento: 'Temporário',
        validade: '2026-06-20',
        status: 'Pendente',
        created_by: 'operador@sga.ao',
        created_date: '2026-01-20'
      },
      reclamacao_nova: {
        numero_reclamacao: '#123',
        reclamante: 'Maria Santos',
        email_reclamante: 'maria@example.com',
        telefone_reclamante: '+244 923 456 789',
        assunto: 'Atraso no Check-in',
        categoria: 'Atendimento',
        descricao: 'Demora excessiva no atendimento',
        aeroporto: 'FNLU',
        prioridade: 'Alta',
        status: 'Pendente',
        created_by: 'sistema@sga.ao',
        created_date: '2026-01-20'
      },
      inspecao_concluida: {
        tipo_inspecao: 'Inspeção de Pista',
        aeroporto: 'FNLU',
        inspetor: 'Carlos Mendes',
        equipe: 'Carlos Mendes, Ana Costa',
        data_inspecao: '2026-01-20',
        hora_inicio: '08:00',
        hora_fim: '10:00',
        total_itens: '50',
        itens_conformes: '48',
        itens_nao_conformes: '2',
        conformidade: '96%',
        resumo: 'Inspeção concluída com sucesso',
        requer_acao: 'Não',
        status: 'Concluída',
        created_by: 'operador@sga.ao',
        created_date: '2026-01-20'
      },
      auditoria_concluida: {
        tipo_auditoria: 'Auditoria de Segurança',
        aeroporto: 'FNLU',
        auditor: 'Ana Costa',
        equipe: 'Ana Costa, Carlos Mendes',
        data_auditoria: '2026-01-20',
        total_itens: '75',
        itens_conformes: '73',
        itens_nao_conformes: '2',
        conformidade: '97%',
        observacoes: 'Auditoria concluída conforme planeado',
        status: 'Concluída',
        created_by: 'operador@sga.ao',
        created_date: '2026-01-20'
      },
      ordem_servico_criada: {
        numero_os: '#456',
        tipo_servico: 'Manutenção Preventiva',
        prioridade: 'Alta',
        descricao: 'Reparo de iluminação na pista',
        aeroporto: 'FNLU',
        area: 'Pista 10',
        responsavel: 'Equipe de Manutenção',
        prazo: '2026-01-22',
        status: 'Pendente',
        created_by: 'operador@sga.ao',
        created_date: '2026-01-20'
      },
      relatorio_operacional_diario: {
        data_relatorio: '2026-01-20',
        data_inicio: '2026-01-20',
        data_fim: '2026-01-20',
        aeroporto_icao: 'FNLU',
        aeroporto: 'FNLU',
        aeroporto_nome: 'Aeroporto Quatro de Fevereiro',
        total_voos: '45',
        voos_arr: '23',
        voos_dep: '22',
        total_passageiros: '3,250',
        total_carga_kg: '12,500',
        tempo_medio_permanencia: '2.5 horas',
        tempo_medio_estacionamento: '2.5 horas',
        total_faturacao_usd: '45,250.00',
        total_tarifa_usd: '45,250.00',
        total_tarifa: '38,462,500',
        total_impostos_usd: '4,525.00',
        total_impostos_aoa: '3,846,250',
        subtotal_sem_impostos_usd: '40,725.00',
        subtotal_sem_impostos_aoa: '34,616,250',
        taxa_cambio_usd_aoa: '850',
        periodo_noturno: 'Não',
        created_date: '2026-01-20',
        created_by: 'sistema@sga.ao'
      },
      relatorio_operacional_semanal: {
        semana_inicio: '2026-01-13',
        semana_fim: '2026-01-19',
        data_inicio: '2026-01-13',
        data_fim: '2026-01-19',
        aeroporto_icao: 'FNLU',
        aeroporto: 'FNLU',
        aeroporto_nome: 'Aeroporto Quatro de Fevereiro',
        total_voos: '315',
        voos_arr: '158',
        voos_dep: '157',
        total_passageiros: '22,750',
        total_carga_kg: '87,500',
        tempo_medio_permanencia: '2.3 horas',
        tempo_medio_estacionamento: '2.3 horas',
        total_faturacao_usd: '316,750.00',
        total_tarifa_usd: '316,750.00',
        total_tarifa: '269,237,500',
        total_impostos_usd: '31,675.00',
        total_impostos_aoa: '26,923,750',
        subtotal_sem_impostos_usd: '285,075.00',
        subtotal_sem_impostos_aoa: '242,313,750',
        taxa_cambio_usd_aoa: '850',
        periodo_noturno: 'Não',
        created_date: '2026-01-20',
        created_by: 'sistema@sga.ao'
      },
      relatorio_operacional_mensal: {
        mes_ano: 'Janeiro 2026',
        aeroporto_icao: 'FNLU',
        aeroporto: 'FNLU',
        aeroporto_nome: 'Aeroporto Quatro de Fevereiro',
        data_inicio: '2026-01-01',
        data_fim: '2026-01-31',
        total_voos: '1,350',
        voos_arr: '675',
        voos_dep: '675',
        total_passageiros: '97,500',
        total_carga_kg: '375,000',
        tempo_medio_permanencia: '2.4 horas',
        tempo_medio_estacionamento: '2.4 horas',
        total_faturacao_usd: '1,356,000.00',
        total_tarifa_usd: '1,356,000.00',
        total_tarifa: '1,152,600,000',
        total_impostos_usd: '135,600.00',
        total_impostos_aoa: '115,260,000',
        subtotal_sem_impostos_usd: '1,220,400.00',
        subtotal_sem_impostos_aoa: '1,037,340,000',
        taxa_cambio_usd_aoa: '850',
        periodo_noturno: 'Não',
        created_date: '2026-01-20',
        created_by: 'sistema@sga.ao'
      },
      relatorio_operacional_consolidado_diario: {
        mes_ano: 'Janeiro 2026',
        periodo: 'diario',
        data_inicio: '2026-01-20',
        data_fim: '2026-01-20',
        data_inicio_formatada: '20/01/2026',
        data_fim_formatada: '20/01/2026',
        data_relatorio: '2026-01-20',
        total_aeroportos: '16',
        total_voos_geral: '1,350',
        total_voos_arr_geral: '675',
        total_voos_dep_geral: '675',
        total_passageiros_geral: '97,500',
        total_carga_kg_geral: '375,000',
        total_faturacao_usd_geral: '1,356,000.00',
        total_faturacao_aoa_geral: '1,152,600,000',
        total_impostos_usd_geral: '135,600.00',
        total_impostos_aoa_geral: '115,260,000',
        subtotal_sem_impostos_usd_geral: '1,220,400.00',
        subtotal_sem_impostos_aoa_geral: '1,037,340,000',
        created_date: '2026-01-20',
        created_by: 'sistema@sga.ao',
        detalhes_aeroportos_html: '<div style="background:white;border:2px solid #e2e8f0;border-radius:8px;padding:15px;margin-bottom:10px;border-left:4px solid #004A99"><h3 style="color:#004A99">FNLU - Aeroporto Quatro de Fevereiro</h3><p><strong>Movimentos:</strong> 45</p><p><strong>Passageiros:</strong> 3,250</p><p><strong>Carga:</strong> 12,500 kg</p><p><strong>Faturação:</strong> $45,250.00</p></div>',
        detalhes_aeroportos_json: '{}',
        detalhes_aeroportos_texto: 'FNLU - Aeroporto Quatro de Fevereiro\nMovimentos: 45\nPassageiros: 3,250\nCarga: 12,500 kg\nFaturação: $45,250.00'
      },
      relatorio_operacional_consolidado_semanal: {
        mes_ano: 'Janeiro 2026',
        periodo: 'semanal',
        data_inicio: '2026-01-13',
        data_fim: '2026-01-19',
        data_inicio_formatada: '13/01/2026',
        data_fim_formatada: '19/01/2026',
        data_relatorio: '2026-01-20',
        total_aeroportos: '16',
        total_voos_geral: '9,450',
        total_voos_arr_geral: '4,725',
        total_voos_dep_geral: '4,725',
        total_passageiros_geral: '682,500',
        total_carga_kg_geral: '2,625,000',
        total_faturacao_usd_geral: '9,492,000.00',
        total_faturacao_aoa_geral: '8,068,200,000',
        total_impostos_usd_geral: '949,200.00',
        total_impostos_aoa_geral: '806,820,000',
        subtotal_sem_impostos_usd_geral: '8,542,800.00',
        subtotal_sem_impostos_aoa_geral: '7,261,380,000',
        created_date: '2026-01-20',
        created_by: 'sistema@sga.ao',
        detalhes_aeroportos_html: '<div style="background:white;border:2px solid #e2e8f0;border-radius:8px;padding:15px;margin-bottom:10px;border-left:4px solid #004A99"><h3 style="color:#004A99">FNLU - Aeroporto Quatro de Fevereiro</h3><p><strong>Movimentos:</strong> 315</p><p><strong>Passageiros:</strong> 22,750</p><p><strong>Carga:</strong> 87,500 kg</p><p><strong>Faturação:</strong> $316,750.00</p></div>',
        detalhes_aeroportos_json: '{}',
        detalhes_aeroportos_texto: 'FNLU - Aeroporto Quatro de Fevereiro\nMovimentos: 315\nPassageiros: 22,750\nCarga: 87,500 kg\nFaturação: $316,750.00'
      },
      relatorio_operacional_consolidado_mensal: {
        mes_ano: 'Janeiro 2026',
        periodo: 'mensal',
        data_inicio: '2026-01-01',
        data_fim: '2026-01-31',
        data_inicio_formatada: '01/01/2026',
        data_fim_formatada: '31/01/2026',
        data_relatorio: '2026-01-20',
        total_aeroportos: '16',
        total_voos_geral: '21,600',
        total_voos_arr_geral: '10,800',
        total_voos_dep_geral: '10,800',
        total_passageiros_geral: '1,560,000',
        total_carga_kg_geral: '6,000,000',
        total_faturacao_usd_geral: '21,696,000.00',
        total_faturacao_aoa_geral: '18,441,600,000',
        total_impostos_usd_geral: '2,169,600.00',
        total_impostos_aoa_geral: '1,844,160,000',
        subtotal_sem_impostos_usd_geral: '19,526,400.00',
        subtotal_sem_impostos_aoa_geral: '16,597,440,000',
        created_date: '2026-01-20',
        created_by: 'sistema@sga.ao',
        detalhes_aeroportos_html: '<div style="background:white;border:2px solid #e2e8f0;border-radius:8px;padding:15px;margin-bottom:10px;border-left:4px solid #004A99"><h3 style="color:#004A99">FNLU - Aeroporto Quatro de Fevereiro</h3><p><strong>Movimentos:</strong> 1,350</p><p><strong>Passageiros:</strong> 97,500</p><p><strong>Carga:</strong> 375,000 kg</p><p><strong>Faturação:</strong> $1,356,000.00</p></div>',
        detalhes_aeroportos_json: '{}',
        detalhes_aeroportos_texto: 'FNLU - Aeroporto Quatro de Fevereiro\nMovimentos: 1,350\nPassageiros: 97,500\nCarga: 375,000 kg\nFaturação: $1,356,000.00'
      }
      };

      return previews[formData.evento_gatilho] || {};
      };

  const renderPreview = (template) => {
    if (!template || !formData.evento_gatilho) return template;

    try {
      const previewData = getPreviewData() || {};
      let preview = String(template || '');

      // Substituir todos os placeholders com segurança
      Object.keys(previewData).forEach(key => {
        try {
          const value = previewData[key];
          if (value !== undefined && value !== null) {
            const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
            preview = preview.replace(regex, String(value));
          }
        } catch (e) {
          console.warn(`Erro ao processar placeholder {{${key}}}:`, e);
        }
      });

      // Limpar qualquer placeholder não substituído
      preview = preview.replace(/\{\{[^}]+\}\}/g, '[...]');

      return preview;
    } catch (error) {
      console.error('Erro ao renderizar preview:', error);
      return template;
    }
  };

  const handleGerarComIA = async (tipoTemplate) => {
    if (!formData.evento_gatilho) {
      setAlertInfo({
        isOpen: true,
        type: 'warning',
        title: 'Evento não selecionado',
        message: 'Por favor, selecione um evento gatilho antes de gerar o template com IA.'
      });
      return;
    }

    setIsGeneratingIA(prev => ({ ...prev, [tipoTemplate]: true }));

    try {
      const placeholders = PLACEHOLDERS_INFO_SISTEMA[formData.evento_gatilho] || [];
      
      // Para template_html, usar placeholders específicos de aeroporto
      const placeholdersToUse = tipoTemplate === 'template_html' 
        ? ['{{codigo_icao}}', '{{nome}}', '{{total_voos}}', '{{total_passageiros}}', '{{total_carga}}', '{{total_faturacao_usd}}', '{{total_faturacao_aoa}}']
        : placeholders;
      
      const response = await base44.functions.invoke('gerarTemplateNotificacao', {
        evento_gatilho: formData.evento_gatilho,
        canal: tipoTemplate,
        placeholders: placeholdersToUse,
        prompt_personalizado: formData.prompt_ia_personalizado || null
      });

      if (response.data && response.data.template) {
        if (tipoTemplate === 'whatsapp') {
          handleInputChange('mensagem_template_whatsapp', response.data.template);
        } else if (tipoTemplate === 'email_assunto') {
          handleInputChange('mensagem_template_email_assunto', response.data.template);
        } else if (tipoTemplate === 'email_corpo') {
          handleInputChange('mensagem_template_email_corpo', response.data.template);
        } else if (tipoTemplate === 'template_html') {
          handleInputChange('template_html_aeroportos', response.data.template);
        }

        setSuccessInfo({
          isOpen: true,
          title: 'Template Gerado! ✨',
          message: 'O template foi gerado com sucesso pela IA. Pode editá-lo conforme necessário.'
        });
      }
    } catch (error) {
      console.error('Erro ao gerar template com IA:', error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro ao Gerar Template',
        message: 'Não foi possível gerar o template com IA. Tente novamente.'
      });
    } finally {
      setIsGeneratingIA(prev => ({ ...prev, [tipoTemplate]: false }));
    }
  };

  const handleEnviarTeste = async (forcarReenvio = false) => {
    if (!editingRegra) return;

    setIsSendingTest(true);

    try {
      // Se forçar reenvio, apagar histórico primeiro
      if (forcarReenvio) {
        try {
          // Encontrar e apagar registos do histórico para este utilizador e regra
          const historicoAntigo = await base44.asServiceRole.entities.HistoricoNotificacao.filter({
            user_id: currentUser?.id,
            email_destinatario: testeData.email || currentUser?.email
          });

          if (historicoAntigo && historicoAntigo.length > 0) {
            for (const record of historicoAntigo) {
              try {
                await base44.asServiceRole.entities.HistoricoNotificacao.delete(record.id);
              } catch (e) {
                console.error('Erro ao apagar registado:', e);
              }
            }
          }
        } catch (e) {
          console.warn('Aviso ao apagar histórico:', e.message);
        }
      }

      const response = await base44.functions.invoke('enviarNotificacaoTeste', {
        regra_id: editingRegra.id,
        destinatario_email: testeData.email || currentUser?.email,
        destinatario_whatsapp: testeData.whatsapp || currentUser?.telefone,
        user_id_test: currentUser?.id
      });

      if (response.data && response.data.sucesso) {
        setShowTestModal(false);
        setTesteData({ email: '', whatsapp: '' });

        const canaisEnviados = response.data.resultados
          .filter(r => r.status === 'enviado')
          .map(r => r.canal === 'email' ? 'Email' : 'WhatsApp')
          .join(' e ');

        setSuccessInfo({
          isOpen: true,
          title: 'Teste Enviado! 📧',
          message: `A notificação de teste foi enviada via ${canaisEnviados}. Verifique a sua caixa de entrada.`
        });
      } else if (response.data?.resultados?.some(r => r.status === 'ja_enviado')) {
        // Se receber erro de já enviado, oferecer opção de forçar
        setAlertInfo({
          isOpen: true,
          type: 'warning',
          title: 'Notificação Já Enviada',
          message: 'Esta notificação de teste já foi enviada. Deseja forçar o reenvio (eliminando o histórico)?',
          showCancel: true,
          confirmText: 'Forçar Reenvio',
          onConfirm: () => {
            setAlertInfo(prev => ({ ...prev, isOpen: false }));
            handleEnviarTeste(true);
          }
        });
      }
    } catch (error) {
      console.error('Erro ao enviar teste:', error);

      // Se for erro de "já enviado", mostrar opção de forçar
      if (error.message?.includes('ja_enviado') || error.message?.includes('já enviado')) {
        setAlertInfo({
          isOpen: true,
          type: 'warning',
          title: 'Notificação Já Enviada',
          message: 'Esta notificação de teste já foi enviada. Deseja forçar o reenvio (eliminando o histórico)?',
          showCancel: true,
          confirmText: 'Forçar Reenvio',
          onConfirm: () => {
            setAlertInfo(prev => ({ ...prev, isOpen: false }));
            handleEnviarTeste(true);
          }
        });
      } else {
        setAlertInfo({
          isOpen: true,
          type: 'error',
          title: 'Erro ao Enviar Teste',
          message: 'Não foi possível enviar a notificação de teste. Tente novamente.'
        });
      }
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleOpenRunModal = async (regra) => {
    setRunRegraId(regra.id);
    setPeriodoConsolidado('');

    // Se for voo_ligado_criado, carregar voos ligados com detalhes
    if (regra.evento_gatilho === 'voo_ligado_criado') {
      try {
        const voosLigadosData = await VooLigado.list('-created_date', 20);
        
        // Buscar detalhes dos voos ARR e DEP para cada voo ligado
        const voosComDetalhes = await Promise.all(voosLigadosData.map(async (vooLigado) => {
          try {
            const [vooArr, vooDep] = await Promise.all([
              base44.entities.Voo.get(vooLigado.id_voo_arr).catch(() => null),
              base44.entities.Voo.get(vooLigado.id_voo_dep).catch(() => null)
            ]);
            return {
              ...vooLigado,
              vooArr,
              vooDep
            };
          } catch (e) {
            console.error('Erro ao buscar detalhes do voo:', e);
            return vooLigado;
          }
        }));

        setVoosLigados(voosComDetalhes);
      } catch (error) {
        console.error('Erro ao carregar voos ligados:', error);
        setAlertInfo({
          isOpen: true,
          type: 'error',
          title: 'Erro ao Carregar Voos',
          message: 'Não foi possível carregar a lista de voos ligados.'
        });
      }
    }
    
    // Se for relatório operacional consolidado, mostrar seletor de período
    if (regra.evento_gatilho === 'relatorio_operacional_consolidado') {
      // Período será selecionado no modal
    }
    
    // Se for relatório operacional individual ou consolidado, carregar aeroportos
    if (regra.evento_gatilho === 'relatorio_operacional_diario' || 
        regra.evento_gatilho === 'relatorio_operacional_semanal' || 
        regra.evento_gatilho === 'relatorio_operacional_mensal') {
      
      try {
        const aeroportosData = await base44.entities.Aeroporto.list();
        setAeroportosModal(aeroportosData || []);
      } catch (error) {
        console.error('Erro ao carregar aeroportos:', error);
        setAlertInfo({
          isOpen: true,
          type: 'error',
          title: 'Erro ao Carregar Aeroportos',
          message: 'Não foi possível carregar a lista de aeroportos.'
        });
      }
    }
    
    setShowRunModal(true);
  };

  const handleExecutarAutomacao = async () => {
    if (!runRegraId) return;

    const regra = regras.find(r => r.id === runRegraId);
    if (!regra) return;

    // Para relatório consolidado, precisa de um período
    if (regra.evento_gatilho === 'relatorio_operacional_consolidado') {
      if (!periodoConsolidado) {
        setAlertInfo({
          isOpen: true,
          type: 'warning',
          title: 'Período Obrigatório',
          message: 'Por favor, selecione o período (diário, semanal ou mensal) para o relatório consolidado.'
        });
        return;
      }
    }

    // Para voo_ligado_criado, precisa de um voo_ligado_id
    if (regra.evento_gatilho === 'voo_ligado_criado') {
      if (!selectedVooLigadoId) {
        setAlertInfo({
          isOpen: true,
          type: 'warning',
          title: 'Voo Ligado Obrigatório',
          message: 'Por favor, selecione um voo ligado para executar a automação.'
        });
        return;
      }
    }



    setIsRunning(true);

    try {
      let response;

      if (regra.evento_gatilho === 'voo_ligado_criado') {
        response = await base44.functions.invoke('notificarVooLigado', {
          voo_ligado_id: selectedVooLigadoId
        });
      } else if (regra.evento_gatilho === 'relatorio_operacional_consolidado_diario') {
        response = await base44.functions.invoke('enviarRelatoriosConsolidadosDiarios', { forcar_reenvio: testeData.forcar_reenvio || false });
      } else if (regra.evento_gatilho === 'relatorio_operacional_consolidado_semanal') {
        response = await base44.functions.invoke('enviarRelatoriosConsolidadosSemanais', { forcar_reenvio: testeData.forcar_reenvio || false });
      } else if (regra.evento_gatilho === 'relatorio_operacional_consolidado_mensal') {
        response = await base44.functions.invoke('enviarRelatoriosConsolidadosMensais', { forcar_reenvio: testeData.forcar_reenvio || false });
      } else if (regra.evento_gatilho === 'relatorio_operacional_diario' || regra.evento_gatilho === 'relatorio_operacional_semanal' || regra.evento_gatilho === 'relatorio_operacional_mensal') {
        response = await base44.functions.invoke('enviarRelatoriosDiarios', {});
      }
      
      if (response && response.data) {
      setShowRunModal(false);
      setSelectedVooLigadoId('');
      setSelectedAeroporto('');
      setPeriodoConsolidado('');
      setTesteData({ email: '', whatsapp: '', forcar_reenvio: false });

      // Mostrar detalhes dos resultados
      const resultadosDetalhados = response.data.resultados || [];
      const erros = resultadosDetalhados.filter(r => r.status === 'erro');
      const optInEnviados = resultadosDetalhados.filter(r => r.status === 'opt_in_enviado');
      const enviados = resultadosDetalhados.filter(r => r.status === 'enviado');
      const jaEnviados = resultadosDetalhados.filter(r => r.status === 'ja_enviado');

      let mensagemDetalhada = response.data.mensagem || 'Automação executada';

      if (jaEnviados.length > 0) {
        mensagemDetalhada += `\n\n⏭️ ${jaEnviados.length} notificação(ões) já enviada(s) neste período`;
      }

      if (erros.length > 0) {
        mensagemDetalhada += `\n\n❌ ${erros.length} erro(s):\n`;
        erros.forEach(e => {
          mensagemDetalhada += `\n• ${e.destinatario}: ${e.motivo || 'Erro desconhecido'}`;
        });
      }

      if (optInEnviados.length > 0) {
        mensagemDetalhada += `\n\n📤 ${optInEnviados.length} solicitação(ões) de opt-in enviada(s)`;
      }

      if (enviados.length > 0) {
        mensagemDetalhada += `\n\n✅ ${enviados.length} notificação(ões) enviada(s)`;
      }
        
        setSuccessInfo({
          isOpen: true,
          title: 'Automação Executada! ✅',
          message: mensagemDetalhada
        });
      }
    } catch (error) {
      console.error('❌ Erro ao executar automação:', error);
      console.error('Erro completo:', error);
      
      let errorMessage = 'Não foi possível executar a automação.';
      
      if (error.message) {
        errorMessage += `\n\nDetalhes: ${error.message}`;
      }
      
      if (error.response?.data) {
        errorMessage += `\n\nResposta: ${JSON.stringify(error.response.data, null, 2)}`;
      }
      
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro ao Executar Automação',
        message: errorMessage
      });
    } finally {
      setIsRunning(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-lg">A carregar...</p>
      </div>
    );
  }

  const historicoFiltrado = historico.filter(item => {
    const matchStatus = filtrosHistorico.status === 'todos' || item.status === filtrosHistorico.status;
    const matchCanal = filtrosHistorico.canal === 'todos' || item.canais_enviados?.includes(filtrosHistorico.canal);
    return matchStatus && matchCanal;
  });

  return (
    <div className="p-6 bg-slate-50 dark:bg-slate-950 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Gestão de Notificações</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">Configure regras automáticas de notificação por e-mail e WhatsApp.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadData} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="ml-2">Atualizar</span>
            </Button>
            <Button onClick={() => handleOpenForm()} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Nova Regra
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-t-lg p-4 sticky top-0 z-20">
          <button
            onClick={() => setActiveTab('geral')}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${activeTab === 'geral' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'}`}
          >
            <Bell className="w-4 h-4 inline mr-2" />
            Regras ({regras.length})
          </button>
          <button
            onClick={() => setActiveTab('historico')}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${activeTab === 'historico' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'}`}
          >
            <FileText className="w-4 h-4 inline mr-2" />
            Histórico ({historico.length})
          </button>
          <button
            onClick={() => setActiveTab('atendimento')}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${activeTab === 'atendimento' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'}`}
          >
            <MessageSquare className="w-4 h-4 inline mr-2" />
            Atendimento
          </button>
          <button
            onClick={() => setActiveTab('placeholders')}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${activeTab === 'placeholders' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'}`}
          >
            <FileText className="w-4 h-4 inline mr-2" />
            Placeholders
          </button>
          <button
            onClick={() => setActiveTab('grupos')}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${activeTab === 'grupos' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'}`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            Grupos WhatsApp
          </button>
        </div>

        {/* Lista de Regras */}
        {activeTab === 'geral' && <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-blue-600" />
                  Regras de Notificação
                  <Badge variant="outline">{regras.length} {regras.length === 1 ? 'regra' : 'regras'}</Badge>
                </CardTitle>
                <CardDescription>Lista de todas as regras configuradas no sistema.</CardDescription>
              </div>
              {regrasSelecionadas.size > 0 && (
                <Button 
                  onClick={handleApagarSelecionadas}
                  className="bg-red-600 hover:bg-red-700"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Apagar {regrasSelecionadas.size} Selecionada(s)
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {regras.length === 0 ? (
              <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                <Bell className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>Nenhuma regra configurada.</p>
                <p className="text-sm mt-1">Clique em "Nova Regra" para começar.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {regras.length > 0 && (
                  <div className="flex items-center gap-2 pb-4 border-b">
                    <input
                      type="checkbox"
                      checked={regrasSelecionadas.size === regras.length && regras.length > 0}
                      onChange={toggleAllRegras}
                      className="rounded cursor-pointer"
                    />
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                      {regrasSelecionadas.size === 0 ? 'Selecionar Todas' : `${regrasSelecionadas.size} de ${regras.length} selecionadas`}
                    </span>
                  </div>
                )}
                {regras.map((regra) => {
                  const eventoLabel = EVENTOS_DISPONIVEIS.find(e => e.value === regra.evento_gatilho)?.label || regra.evento_gatilho;
                  const isSelected = regrasSelecionadas.has(regra.id);

                  return (
                    <div key={regra.id} className={`border rounded-lg p-4 ${isSelected ? 'bg-blue-50 dark:bg-blue-950 border-blue-400' : regra.ativo ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800'}`}>
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRegraSelection(regra.id)}
                          className="mt-1 rounded cursor-pointer"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-lg">{regra.nome}</h3>
                            <Badge variant={regra.ativo ? 'default' : 'outline'}>
                              {regra.ativo ? 'Ativa' : 'Inativa'}
                            </Badge>
                          </div>
                          
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                              <Send className="w-4 h-4" />
                              <span><strong>Evento:</strong> {eventoLabel}</span>
                            </div>
                            
                            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                              <MessageSquare className="w-4 h-4" />
                              <span><strong>Canais:</strong> {regra.canal_envio.map(c => 
                                c === 'whatsapp' ? 'WhatsApp' : 'E-mail'
                              ).join(', ')}</span>
                            </div>
                            
                            {regra.destinatarios_perfis && regra.destinatarios_perfis.length > 0 && (
                              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                                <Users className="w-4 h-4" />
                                <span><strong>Perfis:</strong> {regra.destinatarios_perfis.join(', ')}</span>
                              </div>
                            )}
                            
                            {regra.destinatarios_usuarios_ids && regra.destinatarios_usuarios_ids.length > 0 && (
                              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                                <User className="w-4 h-4" />
                                <span><strong>Utilizadores:</strong> {regra.destinatarios_usuarios_ids.length} selecionado(s)</span>
                              </div>
                            )}

                            {regra.aeroporto_icao_relatorio && (
                             <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                               <Globe className="w-4 h-4" />
                               <span><strong>Aeroporto:</strong> {regra.aeroporto_icao_relatorio}</span>
                             </div>
                            )}

                            {regra.grupo_whatsapp_id && (
                             <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                               <MessageSquare className="w-4 h-4" />
                               <span><strong>Grupo WhatsApp:</strong> {regra.grupo_whatsapp_id}</span>
                             </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={regra.ativo}
                            onCheckedChange={() => handleToggleAtivo(regra)}
                          />
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleOpenRunModal(regra)}
                            title="Executar Automação"
                          >
                            <Play className="w-4 h-4 text-green-600" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleOpenForm(regra)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(regra)}>
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
          </Card>}

          {/* Tab: Atendimento */}
          {activeTab === 'atendimento' && (
            <ZAPIAtendimentoChat
              onError={(msg) => setAlertInfo({
                isOpen: true,
                type: 'error',
                title: 'Erro',
                message: msg
              })}
              onSuccess={(msg) => setSuccessInfo({
                isOpen: true,
                title: 'Sucesso!',
                message: msg
              })}
            />
          )}

          {/* Tab: Placeholders */}
          {activeTab === 'placeholders' && (
            <PlaceholderManagement
              onError={(msg) => setAlertInfo({
                isOpen: true,
                type: 'error',
                title: 'Erro',
                message: msg
              })}
              onSuccess={(msg) => setSuccessInfo({
                isOpen: true,
                title: 'Sucesso!',
                message: msg
              })}
              onReload={loadData}
            />
          )}

          {/* Tab: Grupos WhatsApp */}
          {activeTab === 'grupos' && (
            <ZAPIGruposRegistrados
              onError={(msg) => setAlertInfo({
                isOpen: true,
                type: 'error',
                title: 'Erro',
                message: msg
              })}
              onSuccess={(msg) => setSuccessInfo({
                isOpen: true,
                title: 'Sucesso!',
                message: msg
              })}
            />
          )}

          {/* Histórico de Notificações */}
          {activeTab === 'historico' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-green-600" />
                    Histórico de Notificações Enviadas
                  </CardTitle>
                  <CardDescription>Últimas 100 notificações enviadas pelo sistema.</CardDescription>
                </div>
                {historico.length > 0 && (
                  <Button 
                    onClick={() => {
                      setAlertInfo({
                        isOpen: true,
                        type: 'error',
                        title: 'Limpar Histórico',
                        message: `Tem certeza que deseja apagar todos os ${historico.length} registos do histórico? Esta ação é irreversível.`,
                        showCancel: true,
                        confirmText: 'Apagar Tudo',
                        onConfirm: async () => {
                          setAlertInfo(prev => ({ ...prev, isOpen: false }));
                          try {
                            const response = await base44.functions.invoke('limparHistoricoNotificacoes', {});
                            if (response.data && response.data.sucesso) {
                              await loadData();
                              setSuccessInfo({
                                isOpen: true,
                                title: 'Histórico Limpo!',
                                message: `${response.data.total_apagados} registos foram apagados com sucesso.`
                              });
                            }
                          } catch (error) {
                            console.error('Erro ao limpar histórico:', error);
                            setAlertInfo({
                              isOpen: true,
                              type: 'error',
                              title: 'Erro',
                              message: 'Não foi possível limpar o histórico.'
                            });
                          }
                        }
                      });
                    }}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Limpar Histórico
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filtros */}
              <div className="flex gap-4 pb-4 border-b">
                <div className="flex-1">
                  <Label className="text-sm mb-2">Status</Label>
                  <Select
                    options={[
                      { value: 'todos', label: 'Todos os Status' },
                      { value: 'sucesso', label: '✅ Enviado' },
                      { value: 'erro', label: '❌ Erro' },
                      { value: 'aguardando_confirmacao', label: '⏳ Aguardando' }
                    ]}
                    value={filtrosHistorico.status}
                    onValueChange={(v) => setFiltrosHistorico(prev => ({ ...prev, status: v }))}
                  />
                </div>
                <div className="flex-1">
                  <Label className="text-sm mb-2">Canal</Label>
                  <Select
                    options={[
                      { value: 'todos', label: 'Todos os Canais' },
                      { value: 'email', label: '📧 Email' },
                      { value: 'whatsapp', label: '💬 WhatsApp' }
                    ]}
                    value={filtrosHistorico.canal}
                    onValueChange={(v) => setFiltrosHistorico(prev => ({ ...prev, canal: v }))}
                  />
                </div>
              </div>

              {/* Seleção e Apagar */}
              {historicoFiltrado.length > 0 && historicoSelecionado.size > 0 && (
                <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4">
                  <span className="text-sm font-medium text-blue-700">
                    {historicoSelecionado.size} de {historicoFiltrado.length} notificação(ões) selecionada(s)
                  </span>
                  <Button
                    onClick={handleApagarHistoricoSelecionado}
                    className="bg-red-600 hover:bg-red-700"
                    size="sm"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Apagar Selecionadas
                  </Button>
                </div>
              )}

              {/* Tabela */}
              {historicoFiltrado.length === 0 ? (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>Nenhuma notificação enviada.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100 border-b">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium w-12">
                          <input
                            type="checkbox"
                            checked={historicoSelecionado.size === historicoFiltrado.length && historicoFiltrado.length > 0}
                            onChange={toggleAllHistorico}
                            className="rounded cursor-pointer"
                          />
                        </th>
                        <th className="text-left px-4 py-2 font-medium">Utilizador</th>
                        <th className="text-left px-4 py-2 font-medium">Email</th>
                        <th className="text-left px-4 py-2 font-medium">Tipo Relatório</th>
                        <th className="text-left px-4 py-2 font-medium">Canais</th>
                        <th className="text-left px-4 py-2 font-medium">Status</th>
                        <th className="text-left px-4 py-2 font-medium">Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historicoFiltrado.map((item) => (
                        <tr key={item.id} className={`border-b ${historicoSelecionado.has(item.id) ? 'bg-blue-50' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                          <td className="px-4 py-3 w-12">
                            <input
                              type="checkbox"
                              checked={historicoSelecionado.has(item.id)}
                              onChange={() => toggleHistoricoSelection(item.id)}
                              className="rounded cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-900 dark:text-slate-100">{item.email_destinatario?.split('@')[0]}</div>
                          </td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{item.email_destinatario}</td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className="capitalize">
                              {item.tipo_relatorio?.replace(/_/g, ' ')}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              {item.canais_enviados?.includes('email') && (
                                <Badge className="bg-blue-100 text-blue-700">📧 Email</Badge>
                              )}
                              {item.canais_enviados?.includes('whatsapp') && (
                                <Badge className="bg-green-100 text-green-700">💬 WhatsApp</Badge>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {item.status === 'sucesso' ? (
                              <Badge className="bg-green-100 text-green-700">✅ Enviado</Badge>
                            ) : item.status === 'erro' ? (
                              <Badge className="bg-red-100 text-red-700" title={item.motivo_erro}>
                                ❌ Erro
                              </Badge>
                            ) : (
                              <Badge className="bg-yellow-100 text-yellow-700">⏳ Aguardando</Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-xs">
                            {item.created_date ? (
                              <>
                                <div>{new Date(item.created_date).toLocaleDateString('pt-PT')}</div>
                                <div className="text-slate-500 dark:text-slate-400">{new Date(item.created_date).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</div>
                              </>
                            ) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
          )}

        {/* Formulário Modal */}
        {isFormOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white dark:bg-slate-900 border-b dark:border-slate-700 z-10">
                <div className="p-6 pb-0">
                  <h2 className="text-2xl font-bold mb-4">
                    {editingRegra ? 'Editar Regra' : 'Nova Regra'}
                  </h2>
                </div>
                
                {/* Tabs */}
                <div className="flex border-b px-6">
                  <button
                    type="button"
                    onClick={() => setActiveTab('geral')}
                    className={`px-4 py-3 font-medium transition-colors border-b-2 ${
                      activeTab === 'geral'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Configurações Gerais
                  </button>
                  {formData.evento_gatilho === 'relatorio_operacional_consolidado' && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('template')}
                      className={`px-4 py-3 font-medium transition-colors border-b-2 ${
                        activeTab === 'template'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Template HTML Aeroportos
                    </button>
                  )}
                </div>
              </div>
              
              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {/* Tab: Geral */}
                {activeTab === 'geral' && (
                  <>
                {/* Nome */}
                <div>
                  <Label htmlFor="nome">Nome da Regra *</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => handleInputChange('nome', e.target.value)}
                    placeholder="Ex: Notificar operações sobre novos voos"
                    required
                  />
                </div>

                {/* Evento Gatilho */}
                <div>
                  <Label htmlFor="evento">Evento Gatilho *</Label>
                  <Select
                    id="evento"
                    options={[
                      { value: '', label: 'Selecione um evento...' },
                      ...EVENTOS_DISPONIVEIS
                    ]}
                    value={formData.evento_gatilho}
                    onValueChange={(v) => handleInputChange('evento_gatilho', v)}
                  />
                </div>

                {/* Aeroporto (apenas para relatórios operacionais individuais, não consolidado) */}
                {(formData.evento_gatilho === 'relatorio_operacional_diario' || 
                  formData.evento_gatilho === 'relatorio_operacional_semanal' || 
                  formData.evento_gatilho === 'relatorio_operacional_mensal') && (
                  <div>
                    <Label htmlFor="aeroporto">Aeroporto Específico (Opcional)</Label>
                    <Select
                       id="aeroporto"
                       options={[
                         { value: '', label: 'Todos os aeroportos' },
                         ...aeroportos.filter(a => AEROPORTOS_ANGOLA.includes(a.codigo_icao)).map(a => ({ 
                           value: a.codigo_icao, 
                           label: `${a.codigo_icao} - ${a.nome}` 
                         }))
                       ]}
                       value={formData.aeroporto_icao_relatorio}
                       onValueChange={(v) => handleInputChange('aeroporto_icao_relatorio', v)}
                     />
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Deixe vazio para aplicar a regra a todos os aeroportos.
                    </p>
                  </div>
                )}

                {/* Canais de Envio */}
                <div>
                  <Label>Canais de Envio *</Label>
                  <div className="flex gap-4 mt-2">
                    {CANAIS_DISPONIVEIS.map(canal => {
                      const Icon = canal.icon;
                      const isSelected = formData.canal_envio.includes(canal.value);
                      return (
                        <button
                          key={canal.value}
                          type="button"
                          onClick={() => toggleCanal(canal.value)}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${
                            isSelected
                              ? 'border-blue-600 bg-blue-50 text-blue-700'
                              : 'border-slate-300 hover:border-slate-400'
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                          <span className="font-medium">{canal.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Grupo WhatsApp (opcional) */}
                {formData.canal_envio.includes('whatsapp') && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Label htmlFor="grupo-whatsapp">Grupo WhatsApp (Opcional)</Label>
                      {gruposWhatsApp.length > 0 && (
                        <Badge className="bg-green-600 text-white">{gruposWhatsApp.length} grupo(s)</Badge>
                      )}
                    </div>
                    {gruposWhatsApp.length > 0 ? (
                      <>
                        <div className="mb-3 space-y-2">
                          {gruposWhatsApp.map(g => (
                            <button
                              key={g.id}
                              type="button"
                              onClick={() => handleInputChange('grupo_whatsapp_id', g.chat_id)}
                              className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                                formData.grupo_whatsapp_id === g.chat_id
                                  ? 'border-green-600 bg-white'
                                  : 'border-green-200 hover:border-green-400 hover:bg-white'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="font-medium text-slate-900 dark:text-slate-100">{g.nome_grupo}</div>
                                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{g.chat_id}</div>
                                </div>
                                <Badge className="bg-blue-100 text-blue-700 text-xs">
                                  {g.status}
                                </Badge>
                              </div>
                              {g.data_aprovacao && (
                                <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                                  Aprovado em {new Date(g.data_aprovacao).toLocaleDateString('pt-PT')}
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleInputChange('grupo_whatsapp_id', '')}
                          className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                            !formData.grupo_whatsapp_id
                              ? 'border-blue-600 bg-white'
                              : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'
                          }`}
                        >
                          <div className="font-medium text-slate-900 dark:text-slate-100">❌ Nenhum grupo (envio individual)</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Enviar notificação individualmente aos utilizadores selecionados</div>
                        </button>
                        <p className="text-xs text-green-700 mt-3">
                          💡 Selecione um grupo aprovado para enviar a notificação para o grupo via Z-API em vez de individualmente aos utilizadores.
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="mt-2 p-4 bg-yellow-50 border border-yellow-300 rounded-lg mb-3">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-yellow-800">Nenhum grupo WhatsApp aprovado</p>
                              <p className="text-xs text-yellow-700 mt-1">
                                Acesse a aba "Grupos WhatsApp" para registar e aprovar grupos. Uma vez aprovados, aparecerão aqui.
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-300 dark:border-slate-600">
                          <Label htmlFor="grupo-whatsapp-manual" className="text-xs mb-1 block">Ou insira o ID do grupo manualmente:</Label>
                          <Input
                            id="grupo-whatsapp-manual"
                            value={formData.grupo_whatsapp_id}
                            onChange={(e) => handleInputChange('grupo_whatsapp_id', e.target.value)}
                            placeholder="Exemplo: 120363400651901251-group"
                            className="mt-1"
                          />
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                            Pode copiar o ID do grupo da aba "Grupos WhatsApp" ou a partir da resposta do webhook do Z-API.
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Destinatários - Perfis */}
                <div>
                  <Label>Perfis Destinatários *</Label>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Selecione os perfis que devem receber a notificação.</p>
                  <Combobox
                    options={PERFIS_DISPONIVEIS}
                    value={formData.destinatarios_perfis}
                    onValueChange={(value) => {
                      setFormData(prev => ({
                        ...prev,
                        destinatarios_perfis: prev.destinatarios_perfis.includes(value)
                          ? prev.destinatarios_perfis.filter(p => p !== value)
                          : [...prev.destinatarios_perfis, value]
                      }));
                    }}
                    placeholder="Selecione os perfis..."
                    searchable={true}
                    multiple={true}
                  />
                  {formData.destinatarios_perfis.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {formData.destinatarios_perfis.map(perfilId => {
                        const perfil = PERFIS_DISPONIVEIS.find(p => p.value === perfilId);
                        return (
                          <Badge key={perfilId} className="bg-blue-100 text-blue-700">
                            {perfil?.label}
                            <button
                              type="button"
                              onClick={() => togglePerfil(perfilId)}
                              className="ml-2 hover:opacity-70"
                            >
                              ✕
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Destinatários - Utilizadores Específicos */}
                <div>
                  <Label>Utilizadores Específicos (Opcional)</Label>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Adicione utilizadores individuais além dos perfis.</p>
                  
                  {/* Campo de Busca e Filtros */}
                  <div className="space-y-2 mb-3">
                    <Input
                      placeholder="🔍 Pesquisar utilizador por nome ou email..."
                      value={searchUsuario}
                      onChange={(e) => setSearchUsuario(e.target.value)}
                    />
                    
                    {formData.canal_envio.includes('whatsapp') && (
                      <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <input
                          type="checkbox"
                          id="filtrar-optin"
                          checked={filtrarOptInConfirmado}
                          onChange={(e) => setFiltrarOptInConfirmado(e.target.checked)}
                          className="rounded"
                        />
                        <Label htmlFor="filtrar-optin" className="cursor-pointer text-sm">
                          Mostrar apenas utilizadores com WhatsApp confirmado
                        </Label>
                      </div>
                    )}
                  </div>

                  <div className="border rounded-lg p-4 max-h-48 overflow-y-auto">
                    {usuarios.length === 0 ? (
                      <p className="text-sm text-slate-500">Nenhum utilizador disponível.</p>
                    ) : usuariosFiltrados.length === 0 ? (
                      <p className="text-sm text-slate-500">Nenhum utilizador encontrado para "{searchUsuario}".</p>
                    ) : (
                      <div className="space-y-2">
                        {usuariosFiltrados.map(user => {
                          const isSelected = formData.destinatarios_usuarios_ids.includes(user.id);
                          const optInStatus = user.whatsapp_opt_in_status;
                          const hasWhatsApp = !!user.whatsapp_number;
                          
                          return (
                            <div
                              key={user.id}
                              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                                isSelected
                                  ? 'border-blue-600 bg-blue-50'
                                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => toggleUsuario(user.id)}
                                className="flex-1 text-left"
                              >
                                <div className="font-medium">{user.full_name || user.email}</div>
                                <div className="text-xs opacity-75">{user.email}</div>
                              </button>
                              
                              {formData.canal_envio.includes('whatsapp') && (
                                <div className="flex items-center gap-2">
                                  {!hasWhatsApp ? (
                                    <Badge variant="outline" className="text-slate-500 dark:text-slate-400 text-xs">
                                      Sem WhatsApp
                                    </Badge>
                                  ) : optInStatus === 'confirmado' ? (
                                    <Badge className="bg-green-100 text-green-700 text-xs">
                                      ✓ Confirmado
                                    </Badge>
                                  ) : optInStatus === 'pendente' ? (
                                    <Badge variant="outline" className="text-yellow-600 text-xs">
                                      ⏳ Pendente
                                    </Badge>
                                  ) : optInStatus === 'rejeitado' ? (
                                    <Badge variant="outline" className="text-red-600 text-xs">
                                      ✗ Rejeitado
                                    </Badge>
                                  ) : (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEnviarOptIn(user.id);
                                      }}
                                      disabled={enviandoOptIn[user.id]}
                                      className="h-7 text-xs"
                                    >
                                      {enviandoOptIn[user.id] ? (
                                        <>
                                          <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                                          Enviando...
                                        </>
                                      ) : (
                                        <>
                                          <MessageSquare className="w-3 h-3 mr-1" />
                                          Pedir Opt-in
                                        </>
                                      )}
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Prompt IA Personalizado */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                    <Label htmlFor="prompt-ia">Instruções Personalizadas para IA (Opcional)</Label>
                  </div>
                  <Textarea
                    id="prompt-ia"
                    value={formData.prompt_ia_personalizado}
                    onChange={(e) => handleInputChange('prompt_ia_personalizado', e.target.value)}
                    placeholder="Ex: Usar tom formal e profissional, incluir emojis, destacar as informações mais importantes, etc."
                    rows={3}
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Estas instruções serão consideradas quando usar o botão "Gerar com IA" nos templates abaixo.
                  </p>
                </div>

                {/* Placeholders Info */}
                {placeholdersDisponiveis.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium text-blue-900 mb-2">Placeholders Disponíveis:</p>
                        
                        {/* Placeholders do Sistema */}
                        {placeholdersDoSistema.length > 0 && (
                          <div className="mb-3">
                            <p className="text-xs font-medium text-blue-800 mb-1">📊 Do Sistema:</p>
                            <div className="flex flex-wrap gap-2">
                              {placeholdersDoSistema.map(ph => (
                                <code key={ph} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs cursor-pointer hover:bg-blue-200" title="Clique para copiar">
                                  {ph}
                                </code>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Placeholders Globais */}
                        {placeholdersGlobais.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-blue-800 mb-1">🏷️ Globais:</p>
                            <div className="flex flex-wrap gap-2">
                              {placeholdersGlobais.map(ph => (
                                <code 
                                  key={ph.id} 
                                  className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs cursor-pointer hover:bg-green-200" 
                                  title={ph.descricao}
                                >
                                  {`{{${ph.nome}}}`}
                                </code>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Templates */}
                {formData.canal_envio.includes('whatsapp') && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label htmlFor="whatsapp-template">Template WhatsApp</Label>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium ${formData.mensagem_template_whatsapp.length > 1600 ? 'text-red-600' : formData.mensagem_template_whatsapp.length > 1400 ? 'text-yellow-600' : 'text-slate-600'}`}>
                          {formData.mensagem_template_whatsapp.length}/1600
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleGerarComIA('whatsapp')}
                          disabled={isGeneratingIA.whatsapp || !formData.evento_gatilho}
                          className="text-purple-600 border-purple-300 hover:bg-purple-50"
                        >
                          {isGeneratingIA.whatsapp ? (
                            <>
                              <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                              Gerando...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3 h-3 mr-1" />
                              {formData.mensagem_template_whatsapp ? 'Gerar Novamente' : 'Gerar com IA'}
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                    <Textarea
                      id="whatsapp-template"
                      value={formData.mensagem_template_whatsapp}
                      onChange={(e) => handleInputChange('mensagem_template_whatsapp', e.target.value)}
                      placeholder="Ex: ✈️ Novo voo {{numero_voo}} em {{aeroporto}}."
                      rows={4}
                      className={formData.mensagem_template_whatsapp.length > 1600 ? 'border-red-500' : formData.mensagem_template_whatsapp.length > 1400 ? 'border-yellow-500' : ''}
                    />
                    {formData.mensagem_template_whatsapp.length > 1600 && (
                      <div className="mt-2 p-3 bg-red-50 border border-red-300 rounded-lg">
                        <p className="text-sm text-red-700 font-medium">
                          ⚠️ Limite excedido! O WhatsApp aceita no máximo 1600 caracteres.
                        </p>
                        <p className="text-xs text-red-600 mt-1">
                          Reduza o comprimento da mensagem em {formData.mensagem_template_whatsapp.length - 1600} caracteres.
                        </p>
                      </div>
                    )}
                    {formData.mensagem_template_whatsapp.length > 1400 && formData.mensagem_template_whatsapp.length <= 1600 && (
                      <div className="mt-2 p-2 bg-yellow-50 border border-yellow-300 rounded-lg">
                        <p className="text-xs text-yellow-700">
                          ⚠️ Atenção: Está próximo do limite de 1600 caracteres ({1600 - formData.mensagem_template_whatsapp.length} restantes).
                        </p>
                      </div>
                    )}
                    
                    {/* Preview WhatsApp */}
                    {formData.mensagem_template_whatsapp && formData.evento_gatilho && (
                      <div className="mt-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <MessageSquare className="w-4 h-4 text-green-700" />
                          <span className="text-sm font-medium text-green-900">Pré-visualização WhatsApp:</span>
                        </div>
                        <div className="bg-white p-3 rounded-lg text-sm whitespace-pre-wrap">
                          {renderPreview(formData.mensagem_template_whatsapp)}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {formData.canal_envio.includes('email') && (
                  <>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label htmlFor="email-assunto">Assunto do E-mail</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleGerarComIA('email_assunto')}
                          disabled={isGeneratingIA.email_assunto || !formData.evento_gatilho}
                          className="text-purple-600 border-purple-300 hover:bg-purple-50"
                        >
                          {isGeneratingIA.email_assunto ? (
                            <>
                              <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                              Gerando...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3 h-3 mr-1" />
                              {formData.mensagem_template_email_assunto ? 'Gerar Novamente' : 'Gerar com IA'}
                            </>
                          )}
                        </Button>
                      </div>
                      <Input
                        id="email-assunto"
                        value={formData.mensagem_template_email_assunto}
                        onChange={(e) => handleInputChange('mensagem_template_email_assunto', e.target.value)}
                        placeholder="Ex: Novo Voo {{numero_voo}} - {{aeroporto}}"
                      />
                      
                      {/* Preview Assunto */}
                      {formData.mensagem_template_email_assunto && formData.evento_gatilho && (
                        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <Mail className="w-4 h-4 text-blue-700" />
                            <span className="text-xs font-medium text-blue-900">Preview Assunto:</span>
                          </div>
                          <div className="text-sm font-medium">
                            {renderPreview(formData.mensagem_template_email_assunto)}
                          </div>
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label htmlFor="email-corpo">Corpo do E-mail</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleGerarComIA('email_corpo')}
                          disabled={isGeneratingIA.email_corpo || !formData.evento_gatilho}
                          className="text-purple-600 border-purple-300 hover:bg-purple-50"
                        >
                          {isGeneratingIA.email_corpo ? (
                            <>
                              <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                              Gerando...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3 h-3 mr-1" />
                              {formData.mensagem_template_email_corpo ? 'Gerar Novamente' : 'Gerar com IA'}
                            </>
                          )}
                        </Button>
                      </div>
                      <Textarea
                        id="email-corpo"
                        value={formData.mensagem_template_email_corpo}
                        onChange={(e) => handleInputChange('mensagem_template_email_corpo', e.target.value)}
                        placeholder="Pode usar HTML. Ex: <p>Voo <strong>{{numero_voo}}</strong> foi criado.</p>"
                        rows={6}
                      />
                      
                      {/* Preview Corpo */}
                      {formData.mensagem_template_email_corpo && formData.evento_gatilho && (
                        <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Mail className="w-4 h-4 text-blue-700" />
                            <span className="text-sm font-medium text-blue-900">Pré-visualização E-mail:</span>
                          </div>
                          <div 
                            className="bg-white p-4 rounded-lg text-sm"
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderPreview(formData.mensagem_template_email_corpo)) }}
                          />
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Ativo */}
                <div className="flex items-center gap-3 pt-4 border-t">
                  <Switch
                    id="ativo"
                    checked={formData.ativo}
                    onCheckedChange={(checked) => handleInputChange('ativo', checked)}
                  />
                  <Label htmlFor="ativo" className="cursor-pointer">
                    Regra ativa (notificações serão enviadas automaticamente)
                  </Label>
                </div>
                  </>
                )}

                {/* Tab: Template HTML Aeroportos */}
                {activeTab === 'template' && formData.evento_gatilho === 'relatorio_operacional_consolidado' && (
                  <div className="space-y-4">
                    {/* Templates Predefinidos */}
                    <div>
                      <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">Escolha um Modelo de Formatação</h4>
                      <div className="grid grid-cols-2 gap-3 mb-6">
                        {Object.entries(TEMPLATES_AEROPORTOS).map(([key, template]) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => handleInputChange('template_html_aeroportos', template.html)}
                            className={`p-4 rounded-lg border-2 text-left transition-all ${
                              formData.template_html_aeroportos === template.html
                                ? 'border-blue-600 bg-blue-50'
                                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                          >
                            <div className="font-semibold text-slate-900 dark:text-slate-100">{template.nome}</div>
                            <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">{template.descricao}</div>
                          </button>
                        ))}
                      </div>

                      {/* Preview dos Templates */}
                      <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 mb-6">
                        <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">👁️ Pré-visualização dos Modelos</h4>
                        <div className="grid grid-cols-2 gap-4">
                          {Object.entries(TEMPLATES_AEROPORTOS).map(([key, template]) => (
                            <div key={key} className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                              <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">{template.nome}</div>
                              <div 
                                dangerouslySetInnerHTML={{
                                  __html: sanitizeHtml((template.html || '')
                                    .replace(/\{\{codigo_icao\}\}/g, 'FNLU')
                                    .replace(/\{\{nome\}\}/g, 'Quatro de Fevereiro')
                                    .replace(/\{\{total_voos\}\}/g, '45')
                                    .replace(/\{\{total_passageiros\}\}/g, '3,250')
                                    .replace(/\{\{total_carga\}\}/g, '12,500')
                                    .replace(/\{\{total_faturacao_usd\}\}/g, '45,250.00')
                                    .replace(/\{\{total_faturacao_aoa\}\}/g, '38,462,500'))
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                      <h4 className="font-semibold text-blue-900 mb-2">ℹ️ Personalizar Template</h4>
                      <p className="text-sm text-blue-800 mb-2">
                        Escolha um modelo acima e depois customize-o conforme necessário abaixo. Pode editar o HTML diretamente.
                      </p>
                      <div className="mt-3">
                        <p className="text-sm font-medium text-blue-900 mb-1">Placeholders disponíveis:</p>
                        <div className="flex flex-wrap gap-1">
                           {['{{codigo_icao}}', '{{nome}}', '{{total_voos}}', '{{total_passageiros}}', '{{total_carga}}', '{{total_faturacao_usd}}', '{{total_faturacao_aoa}}'].map((ph, idx) => (
                             <code key={idx} className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs">
                               {ph}
                             </code>
                           ))}
                         </div>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label htmlFor="template-html">Template HTML Personalizado (Opcional)</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleGerarComIA('template_html')}
                          disabled={isGeneratingIA.template_html || !formData.evento_gatilho}
                          className="text-purple-600 border-purple-300 hover:bg-purple-50"
                        >
                          {isGeneratingIA.template_html ? (
                            <>
                              <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                              Gerando...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3 h-3 mr-1" />
                              {formData.template_html_aeroportos ? 'Gerar Novamente' : 'Gerar com IA'}
                            </>
                          )}
                        </Button>
                      </div>
                      <Textarea
                        id="template-html"
                        value={formData.template_html_aeroportos || ''}
                        onChange={(e) => handleInputChange('template_html_aeroportos', e.target.value)}
                        placeholder="Exemplo:\n<div style='background: white; border: 2px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 10px;'>\n  <h3 style='color: #004A99;'>{{codigo_icao}}</h3>\n  <p>{{nome}}</p>\n  <p><strong>Movimentos:</strong> {{total_voos}}</p>\n  <p><strong>Passageiros:</strong> {{total_passageiros}}</p>\n  <p><strong>Faturação:</strong> ${{total_faturacao_usd}}</p>\n</div>"
                        rows={15}
                        className="font-mono text-sm"
                      />
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                        Use HTML e CSS inline. O template será repetido para cada aeroporto automaticamente.
                      </p>
                    </div>

                    {/* Preview Individual */}
                    {formData.template_html_aeroportos && formData.template_html_aeroportos.trim() && (
                      <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                        <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">👁️ Pré-visualização Individual (1 aeroporto):</h4>
                        <div 
                          className="bg-white p-4 rounded border border-slate-200"
                          dangerouslySetInnerHTML={{
                            __html: sanitizeHtml(((formData.template_html_aeroportos || '') || '')
                              .replace(/\{\{codigo_icao\}\}/g, 'FNLU')
                              .replace(/\{\{nome\}\}/g, 'Aeroporto Quatro de Fevereiro')
                              .replace(/\{\{total_voos\}\}/g, '45')
                              .replace(/\{\{total_passageiros\}\}/g, '3,250')
                              .replace(/\{\{total_carga\}\}/g, '12,500')
                              .replace(/\{\{total_faturacao_usd\}\}/g, '45,250.00')
                              .replace(/\{\{total_faturacao_aoa\}\}/g, '38,462,500'))
                          }}
                        />
                      </div>
                    )}

                    {/* Preview Email Completo */}
                    {formData.mensagem_template_email_corpo && formData.template_html_aeroportos && formData.template_html_aeroportos.trim() && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Mail className="w-5 h-5 text-blue-700" />
                          <h4 className="font-semibold text-blue-900">📧 Pré-visualização E-mail Completo:</h4>
                        </div>
                        
                        {/* Email Preview Container */}
                        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-lg overflow-hidden">
                          {/* Email Header */}
                          {formData.mensagem_template_email_assunto && (
                            <div className="bg-slate-100 px-4 py-3 border-b">
                              <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">Assunto:</div>
                              <div className="font-semibold text-slate-900 dark:text-slate-100">
                                {renderPreview(formData.mensagem_template_email_assunto)}
                              </div>
                            </div>
                          )}
                          
                          {/* Email Body */}
                          <div className="p-6 max-h-96 overflow-y-auto">
                            <div
                              dangerouslySetInnerHTML={{
                                __html: (() => {
                                  // Gerar preview de 3 aeroportos
                                  const aeroportosExemplo = [
                                    {
                                      codigo_icao: 'FNLU',
                                      nome: 'Aeroporto Quatro de Fevereiro',
                                      total_voos: '45',
                                      total_passageiros: '3250',
                                      total_carga: '12500',
                                      total_faturacao_usd: '45250.00',
                                      total_faturacao_aoa: '38462500'
                                    },
                                    {
                                      codigo_icao: 'FNUB',
                                      nome: 'Aeroporto Internacional Catumbela',
                                      total_voos: '38',
                                      total_passageiros: '2800',
                                      total_carga: '9500',
                                      total_faturacao_usd: '38500.00',
                                      total_faturacao_aoa: '32725000'
                                    },
                                    {
                                      codigo_icao: 'FNSA',
                                      nome: 'Aeroporto Internacional Agostinho Neto',
                                      total_voos: '52',
                                      total_passageiros: '4100',
                                      total_carga: '15200',
                                      total_faturacao_usd: '52800.00',
                                      total_faturacao_aoa: '44880000'
                                    }
                                  ];

                                  // Gerar HTML para cada aeroporto (com fallback para valores de exemplo)
                                  let detalhesAeroportosHtml = '';
                                  const aeroExemplos = aeroportosExemplo || [];
                                  aeroExemplos.forEach(aero => {
                                    if (!aero) return;
                                    let templateAeroporto = (formData.template_html_aeroportos || '')
                                        .replace(/\{\{codigo_icao\}\}/g, String(aero.codigo_icao || ''))
                                        .replace(/\{\{nome\}\}/g, String(aero.nome || ''))
                                        .replace(/\{\{total_voos\}\}/g, String(aero.total_voos || '0'))
                                        .replace(/\{\{total_passageiros\}\}/g, String(aero.total_passageiros || '0'))
                                        .replace(/\{\{total_carga\}\}/g, String(aero.total_carga || '0'))
                                        .replace(/\{\{total_faturacao_usd\}\}/g, String((aero && (aero.total_faturacao_usd !== undefined && aero.total_faturacao_usd !== null)) ? aero.total_faturacao_usd : '0.00'))
                                        .replace(/\{\{total_faturacao_aoa\}\}/g, String((aero && (aero.total_faturacao_aoa !== undefined && aero.total_faturacao_aoa !== null)) ? aero.total_faturacao_aoa : '0'));
                                    detalhesAeroportosHtml += templateAeroporto;
                                  });

                                  // Substituir no corpo do email
                                  const previewData = getPreviewData();
                                  let emailCompleto = formData.mensagem_template_email_corpo;
                                  
                                  // Substituir placeholders do email
                                  Object.keys(previewData).forEach(key => {
                                    const value = previewData[key];
                                    if (value !== undefined && value !== null) {
                                      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
                                      emailCompleto = emailCompleto.replace(regex, String(value));
                                    }
                                  });

                                  // Substituir o placeholder dos aeroportos
                                  emailCompleto = emailCompleto.replace(/\{\{detalhes_aeroportos_html\}\}/g, detalhesAeroportosHtml);

                                  return sanitizeHtml(emailCompleto);
                                })()
                              }}
                            />
                          </div>
                        </div>
                        
                        <p className="text-xs text-blue-700 mt-2">
                          Esta é uma pré-visualização de como o email ficará com 3 aeroportos de exemplo.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Botões */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={handleCloseForm}>
                    Cancelar
                  </Button>
                  {editingRegra && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowTestModal(true)}
                      className="border-green-600 text-green-600 hover:bg-green-50"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Enviar Teste
                    </Button>
                  )}
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
                    {editingRegra ? 'Atualizar' : 'Criar'} Regra
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal de Executar Automação */}
        {showRunModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold mb-4">Executar Automação</h3>

              {(regras.find(r => r.id === runRegraId)?.evento_gatilho === 'relatorio_operacional_consolidado_diario' ||
                                          regras.find(r => r.id === runRegraId)?.evento_gatilho === 'relatorio_operacional_consolidado_semanal' ||
                                          regras.find(r => r.id === runRegraId)?.evento_gatilho === 'relatorio_operacional_consolidado_mensal') ? (
                                      <>
                                          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                                            Será executado o relatório operacional consolidado {regras.find(r => r.id === runRegraId)?.evento_gatilho.replace('relatorio_operacional_consolidado_', '')}.
                                          </p>

                                          <div className="flex items-center gap-3 p-3 bg-orange-50 border border-orange-200 rounded-lg mb-6">
                                            <input
                                              type="checkbox"
                                              id="forcar-reenvio"
                                              checked={testeData.forcar_reenvio || false}
                                              onChange={(e) => setTesteData(prev => ({ ...prev, forcar_reenvio: e.target.checked }))}
                                              className="rounded w-4 h-4 cursor-pointer"
                                            />
                                            <label htmlFor="forcar-reenvio" className="cursor-pointer text-sm">
                                              <span className="font-medium text-orange-900">🔄 Forçar Reenvio</span>
                                              <p className="text-xs text-orange-700 mt-0.5">Limpar histórico e reenviar mesmo que já tenha sido enviado</p>
                                            </label>
                                          </div>
                                       </>
                                     ) : (regras.find(r => r.id === runRegraId)?.evento_gatilho === 'relatorio_operacional_diario' ||
                              regras.find(r => r.id === runRegraId)?.evento_gatilho === 'relatorio_operacional_semanal' ||
                              regras.find(r => r.id === runRegraId)?.evento_gatilho === 'relatorio_operacional_mensal') ? (
                          <>
                              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                                Será executado o relatório operacional {regras.find(r => r.id === runRegraId)?.evento_gatilho.replace('relatorio_operacional_', '')}.
                              </p>
                          </>
                         ) : regras.find(r => r.id === runRegraId)?.evento_gatilho === 'voo_ligado_criado' ? (
                <>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                    Selecione um voo ligado existente para simular o evento e executar a automação.
                  </p>

                  <div className="mb-6">
                    <Label htmlFor="voo-ligado">Voo Ligado</Label>
                    <select
                      id="voo-ligado"
                      value={selectedVooLigadoId}
                      onChange={(e) => setSelectedVooLigadoId(e.target.value)}
                      className="w-full mt-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md"
                    >
                      <option value="">Selecione um voo ligado...</option>
                      {voosLigados.map(voo => {
                        // Formatar a descrição do voo
                        let descricao = '';
                        if (voo.vooArr && voo.vooDep) {
                          descricao = `${voo.vooArr.numero_voo} (${voo.vooArr.aeroporto_origem_destino}) → ${voo.vooDep.numero_voo} (${voo.vooDep.aeroporto_origem_destino})`;
                        } else {
                          descricao = `ID: ${voo.id.substring(0, 8)}...`;
                        }

                        const data = new Date(voo.created_date).toLocaleDateString('pt-PT');

                        return (
                          <option key={voo.id} value={voo.id}>
                            {descricao} - {data}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </>
              ) : (regras.find(r => r.id === runRegraId)?.evento_gatilho === 'relatorio_operacional_diario' ||
                   regras.find(r => r.id === runRegraId)?.evento_gatilho === 'relatorio_operacional_semanal' ||
                   regras.find(r => r.id === runRegraId)?.evento_gatilho === 'relatorio_operacional_mensal') ? (
                <>
                    {regras.find(r => r.id === runRegraId)?.aeroporto_icao_relatorio ? (
                      <div className="mb-6">
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                          Será gerado o relatório operacional para o aeroporto:
                        </p>
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="font-semibold text-blue-900">
                            {aeroportosModal[0]?.codigo_icao} - {aeroportosModal[0]?.nome || regras.find(r => r.id === runRegraId)?.aeroporto_icao_relatorio}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                          Selecione o aeroporto ou todos os aeroportos para gerar e enviar o relatório operacional.
                        </p>

                        <div className="mb-6">
                          <Label htmlFor="aeroporto">Aeroporto *</Label>
                          <select
                            id="aeroporto"
                            value={selectedAeroporto}
                            onChange={(e) => setSelectedAeroporto(e.target.value)}
                            className="w-full mt-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md"
                          >
                            <option value="">Selecione um aeroporto...</option>
                            <option value="TODOS">🌍 TODOS OS AEROPORTOS</option>
                            {aeroportosModal.filter(a => AEROPORTOS_ANGOLA.includes(a.codigo_icao)).map(aeroporto => (
                              <option key={aeroporto.codigo_icao} value={aeroporto.codigo_icao}>
                                {aeroporto.codigo_icao} - {aeroporto.nome}
                              </option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                  A automação será executada para o evento "{regras.find(r => r.id === runRegraId)?.evento_gatilho}".
                </p>
              )}

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowRunModal(false);
                    setSelectedVooLigadoId('');
                    setSelectedAeroporto('');
                    setPeriodoConsolidado('');
                    setTesteData({ email: '', whatsapp: '', forcar_reenvio: false });
                  }}
                  disabled={isRunning}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleExecutarAutomacao}
                  disabled={isRunning}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isRunning ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      A executar...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Executar
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Teste */}
        {showTestModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold mb-4">Enviar Notificação de Teste</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                A notificação será enviada com dados de exemplo para testar o template configurado.
              </p>
              
              <div className="space-y-4 mb-6">
                {formData.canal_envio.includes('email') && (
                  <div>
                    <Label htmlFor="teste-email">Email (opcional)</Label>
                    <Input
                      id="teste-email"
                      type="email"
                      value={testeData.email}
                      onChange={(e) => setTesteData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder={currentUser?.email || 'Seu email'}
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Deixe em branco para usar {currentUser?.email}
                    </p>
                  </div>
                )}
                
                {formData.canal_envio.includes('whatsapp') && (
                  <div>
                    <Label htmlFor="teste-whatsapp">WhatsApp (opcional)</Label>
                    <Input
                      id="teste-whatsapp"
                      type="tel"
                      value={testeData.whatsapp}
                      onChange={(e) => setTesteData(prev => ({ ...prev, whatsapp: e.target.value }))}
                      placeholder="whatsapp:+244..."
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Formato: whatsapp:+244XXXXXXXXX
                    </p>
                  </div>
                )}

                {formData.canal_envio.includes('whatsapp') && formData.grupo_whatsapp_id && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-5 h-5 text-green-600" />
                      <Label className="font-medium text-green-900">Teste de Grupo WhatsApp</Label>
                    </div>
                    <div className="text-sm text-green-800 mb-2">
                      <p><strong>ID do Grupo:</strong> {formData.grupo_whatsapp_id}</p>
                    </div>
                    <p className="text-xs text-green-700">
                      💡 A mensagem de teste também será enviada para o grupo configurado via Z-API.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowTestModal(false);
                    setTesteData({ email: '', whatsapp: '' });
                  }}
                  disabled={isSendingTest}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleEnviarTeste}
                  disabled={isSendingTest}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isSendingTest ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      A enviar...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Enviar Teste
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <AlertModal
        isOpen={alertInfo.isOpen}
        onClose={() => setAlertInfo({ ...alertInfo, isOpen: false })}
        type={alertInfo.type}
        title={alertInfo.title}
        message={alertInfo.message}
        showCancel={alertInfo.showCancel}
        onConfirm={alertInfo.onConfirm}
        confirmText={alertInfo.confirmText}
      />

      <SuccessModal
        isOpen={successInfo.isOpen}
        onClose={() => setSuccessInfo({ isOpen: false, title: '', message: '' })}
        title={successInfo.title}
        message={successInfo.message}
      />
    </div>
  );
}