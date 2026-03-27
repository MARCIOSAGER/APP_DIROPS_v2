import React, { useState, useEffect } from 'react';
import { useI18n } from '@/components/lib/i18n';
import { Button } from '@/components/ui/button';
import { sanitizeHtml } from '@/lib/sanitize';
import { Plus, RefreshCw, Bell, MessageSquare, Users, FileText } from 'lucide-react';
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
import { isAdminProfile } from '@/components/lib/userUtils';
import { Mail } from 'lucide-react';

import RegrasTab from '@/components/notificacoes/RegrasTab';
import HistoricoTab from '@/components/notificacoes/HistoricoTab';
import RegraFormModal from '@/components/notificacoes/RegraFormModal';
import ExecutarAutomacaoModal from '@/components/notificacoes/ExecutarAutomacaoModal';
import TesteNotificacaoModal from '@/components/notificacoes/TesteNotificacaoModal';

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

// Preview data for template rendering
const PREVIEW_DATA = {
  voo_ligado_criado: {
    numero_voo_arr: 'DT123', numero_voo_dep: 'DT456', aeroporto: 'FNLU', aeroporto_origem: 'FNSA', aeroporto_destino: 'FNHU',
    companhia: 'TAAG', registo: 'D2-TEF', tipo_voo: 'Regular', status: 'Realizado',
    data_arr: '2026-01-20', hora_arr: '14:35', horario_previsto_arr: '14:30', horario_real_arr: '14:35',
    data_dep: '2026-01-20', hora_dep: '16:50', horario_previsto_dep: '16:45', horario_real_dep: '16:50',
    permanencia_horas: '2.5', permanencia_minutos: '150',
    passageiros_local_arr: '100', passageiros_local_dep: '115', passageiros_transito_arr: '20', passageiros_transito_dep: '18',
    passageiros_total_arr: '120', passageiros_total_dep: '133', tripulacao_arr: '8', tripulacao_dep: '8',
    carga_kg_arr: '1800', carga_kg_dep: '2200', mtow_kg: '75000',
    tarifa_pouso_usd: '450.00', tarifa_permanencia_usd: '125.50', tarifa_passageiros_usd: '540.00', tarifa_carga_usd: '134.50',
    total_usd: '1,250.00', total_aoa: '1,062,500', taxa_cambio: '850',
    created_by: 'operador@sga.ao', created_date: '2026-01-20 14:30'
  },
  voo_atualizado: {
    numero_voo: 'DT789', tipo_movimento: 'ARR', aeroporto: 'FNLU', aeroporto_origem: 'FNSA', aeroporto_destino: 'FNHU',
    status: 'Realizado', data_operacao: '2026-01-20', horario_previsto: '14:30', horario_real: '14:35',
    companhia: 'TAAG', registo: 'D2-TEF', tipo_voo: 'Regular',
    passageiros_total: '135', tripulacao: '8', carga_kg: '2500', observacoes: 'Operação normal',
    updated_by: 'operador@sga.ao', updated_date: '2026-01-20 15:00'
  },
  voo_cancelado: {
    numero_voo: 'DT321', tipo_movimento: 'DEP', aeroporto: 'FNLU', aeroporto_origem_destino: 'FNHU',
    companhia: 'TAAG', registo: 'D2-TEF', data_operacao: '2026-01-20', horario_previsto: '18:00',
    motivo: 'Condições meteorológicas', observacoes: 'Cancelado devido a nevoeiro',
    updated_by: 'operador@sga.ao', updated_date: '2026-01-20 16:00'
  },
  documento_novo: {
    titulo_documento: 'Manual de Operações', categoria: 'manual_operacoes', aeroporto: 'FNLU', versao: '2.1',
    descricao: 'Atualização do manual operacional', nivel_confidencialidade: 'interno', data_publicacao: '2026-01-20',
    autor: 'João Silva', created_by: 'operador@sga.ao', created_date: '2026-01-20'
  },
  credenciamento_novo: {
    nome: 'João Silva', empresa: 'TAAG', area_acesso: 'Terminal Internacional', aeroporto: 'FNLU',
    tipo_credenciamento: 'Temporário', validade: '2026-06-20', status: 'Pendente',
    created_by: 'operador@sga.ao', created_date: '2026-01-20'
  },
  reclamacao_nova: {
    numero_reclamacao: '#123', reclamante: 'Maria Santos', email_reclamante: 'maria@example.com',
    telefone_reclamante: '+244 923 456 789', assunto: 'Atraso no Check-in', categoria: 'Atendimento',
    descricao: 'Demora excessiva no atendimento', aeroporto: 'FNLU', prioridade: 'Alta', status: 'Pendente',
    created_by: 'sistema@sga.ao', created_date: '2026-01-20'
  },
  inspecao_concluida: {
    tipo_inspecao: 'Inspeção de Pista', aeroporto: 'FNLU', inspetor: 'Carlos Mendes', equipe: 'Carlos Mendes, Ana Costa',
    data_inspecao: '2026-01-20', hora_inicio: '08:00', hora_fim: '10:00',
    total_itens: '50', itens_conformes: '48', itens_nao_conformes: '2', conformidade: '96%',
    resumo: 'Inspeção concluída com sucesso', requer_acao: 'Não', status: 'Concluída',
    created_by: 'operador@sga.ao', created_date: '2026-01-20'
  },
  auditoria_concluida: {
    tipo_auditoria: 'Auditoria de Segurança', aeroporto: 'FNLU', auditor: 'Ana Costa', equipe: 'Ana Costa, Carlos Mendes',
    data_auditoria: '2026-01-20', total_itens: '75', itens_conformes: '73', itens_nao_conformes: '2', conformidade: '97%',
    observacoes: 'Auditoria concluída conforme planeado', status: 'Concluída',
    created_by: 'operador@sga.ao', created_date: '2026-01-20'
  },
  ordem_servico_criada: {
    numero_os: '#456', tipo_servico: 'Manutenção Preventiva', prioridade: 'Alta',
    descricao: 'Reparo de iluminação na pista', aeroporto: 'FNLU', area: 'Pista 10',
    responsavel: 'Equipe de Manutenção', prazo: '2026-01-22', status: 'Pendente',
    created_by: 'operador@sga.ao', created_date: '2026-01-20'
  },
  relatorio_operacional_diario: {
    data_relatorio: '2026-01-20', data_inicio: '2026-01-20', data_fim: '2026-01-20',
    aeroporto_icao: 'FNLU', aeroporto: 'FNLU', aeroporto_nome: 'Aeroporto Quatro de Fevereiro',
    total_voos: '45', voos_arr: '23', voos_dep: '22', total_passageiros: '3,250', total_carga_kg: '12,500',
    tempo_medio_permanencia: '2.5 horas', tempo_medio_estacionamento: '2.5 horas',
    total_faturacao_usd: '45,250.00', total_tarifa_usd: '45,250.00', total_tarifa: '38,462,500',
    total_impostos_usd: '4,525.00', total_impostos_aoa: '3,846,250',
    subtotal_sem_impostos_usd: '40,725.00', subtotal_sem_impostos_aoa: '34,616,250',
    taxa_cambio_usd_aoa: '850', periodo_noturno: 'Não', created_date: '2026-01-20', created_by: 'sistema@sga.ao'
  },
  relatorio_operacional_semanal: {
    semana_inicio: '2026-01-13', semana_fim: '2026-01-19', data_inicio: '2026-01-13', data_fim: '2026-01-19',
    aeroporto_icao: 'FNLU', aeroporto: 'FNLU', aeroporto_nome: 'Aeroporto Quatro de Fevereiro',
    total_voos: '315', voos_arr: '158', voos_dep: '157', total_passageiros: '22,750', total_carga_kg: '87,500',
    tempo_medio_permanencia: '2.3 horas', tempo_medio_estacionamento: '2.3 horas',
    total_faturacao_usd: '316,750.00', total_tarifa_usd: '316,750.00', total_tarifa: '269,237,500',
    total_impostos_usd: '31,675.00', total_impostos_aoa: '26,923,750',
    subtotal_sem_impostos_usd: '285,075.00', subtotal_sem_impostos_aoa: '242,313,750',
    taxa_cambio_usd_aoa: '850', periodo_noturno: 'Não', created_date: '2026-01-20', created_by: 'sistema@sga.ao'
  },
  relatorio_operacional_mensal: {
    mes_ano: 'Janeiro 2026', aeroporto_icao: 'FNLU', aeroporto: 'FNLU',
    aeroporto_nome: 'Aeroporto Quatro de Fevereiro', data_inicio: '2026-01-01', data_fim: '2026-01-31',
    total_voos: '1,350', voos_arr: '675', voos_dep: '675', total_passageiros: '97,500', total_carga_kg: '375,000',
    tempo_medio_permanencia: '2.4 horas', tempo_medio_estacionamento: '2.4 horas',
    total_faturacao_usd: '1,356,000.00', total_tarifa_usd: '1,356,000.00', total_tarifa: '1,152,600,000',
    total_impostos_usd: '135,600.00', total_impostos_aoa: '115,260,000',
    subtotal_sem_impostos_usd: '1,220,400.00', subtotal_sem_impostos_aoa: '1,037,340,000',
    taxa_cambio_usd_aoa: '850', periodo_noturno: 'Não', created_date: '2026-01-20', created_by: 'sistema@sga.ao'
  },
  relatorio_operacional_consolidado_diario: {
    mes_ano: 'Janeiro 2026', periodo: 'diario', data_inicio: '2026-01-20', data_fim: '2026-01-20',
    data_inicio_formatada: '20/01/2026', data_fim_formatada: '20/01/2026', data_relatorio: '2026-01-20',
    total_aeroportos: '16', total_voos_geral: '1,350', total_voos_arr_geral: '675', total_voos_dep_geral: '675',
    total_passageiros_geral: '97,500', total_carga_kg_geral: '375,000',
    total_faturacao_usd_geral: '1,356,000.00', total_faturacao_aoa_geral: '1,152,600,000',
    total_impostos_usd_geral: '135,600.00', total_impostos_aoa_geral: '115,260,000',
    subtotal_sem_impostos_usd_geral: '1,220,400.00', subtotal_sem_impostos_aoa_geral: '1,037,340,000',
    created_date: '2026-01-20', created_by: 'sistema@sga.ao',
    detalhes_aeroportos_html: '<div style="background:white;border:2px solid #e2e8f0;border-radius:8px;padding:15px;margin-bottom:10px;border-left:4px solid #004A99"><h3 style="color:#004A99">FNLU - Aeroporto Quatro de Fevereiro</h3><p><strong>Movimentos:</strong> 45</p><p><strong>Passageiros:</strong> 3,250</p><p><strong>Carga:</strong> 12,500 kg</p><p><strong>Faturação:</strong> $45,250.00</p></div>',
    detalhes_aeroportos_json: '{}',
    detalhes_aeroportos_texto: 'FNLU - Aeroporto Quatro de Fevereiro\nMovimentos: 45\nPassageiros: 3,250\nCarga: 12,500 kg\nFaturação: $45,250.00'
  },
  relatorio_operacional_consolidado_semanal: {
    mes_ano: 'Janeiro 2026', periodo: 'semanal', data_inicio: '2026-01-13', data_fim: '2026-01-19',
    data_inicio_formatada: '13/01/2026', data_fim_formatada: '19/01/2026', data_relatorio: '2026-01-20',
    total_aeroportos: '16', total_voos_geral: '9,450', total_voos_arr_geral: '4,725', total_voos_dep_geral: '4,725',
    total_passageiros_geral: '682,500', total_carga_kg_geral: '2,625,000',
    total_faturacao_usd_geral: '9,492,000.00', total_faturacao_aoa_geral: '8,068,200,000',
    total_impostos_usd_geral: '949,200.00', total_impostos_aoa_geral: '806,820,000',
    subtotal_sem_impostos_usd_geral: '8,542,800.00', subtotal_sem_impostos_aoa_geral: '7,261,380,000',
    created_date: '2026-01-20', created_by: 'sistema@sga.ao',
    detalhes_aeroportos_html: '<div style="background:white;border:2px solid #e2e8f0;border-radius:8px;padding:15px;margin-bottom:10px;border-left:4px solid #004A99"><h3 style="color:#004A99">FNLU - Aeroporto Quatro de Fevereiro</h3><p><strong>Movimentos:</strong> 315</p><p><strong>Passageiros:</strong> 22,750</p><p><strong>Carga:</strong> 87,500 kg</p><p><strong>Faturação:</strong> $316,750.00</p></div>',
    detalhes_aeroportos_json: '{}',
    detalhes_aeroportos_texto: 'FNLU - Aeroporto Quatro de Fevereiro\nMovimentos: 315\nPassageiros: 22,750\nCarga: 87,500 kg\nFaturação: $316,750.00'
  },
  relatorio_operacional_consolidado_mensal: {
    mes_ano: 'Janeiro 2026', periodo: 'mensal', data_inicio: '2026-01-01', data_fim: '2026-01-31',
    data_inicio_formatada: '01/01/2026', data_fim_formatada: '31/01/2026', data_relatorio: '2026-01-20',
    total_aeroportos: '16', total_voos_geral: '21,600', total_voos_arr_geral: '10,800', total_voos_dep_geral: '10,800',
    total_passageiros_geral: '1,560,000', total_carga_kg_geral: '6,000,000',
    total_faturacao_usd_geral: '21,696,000.00', total_faturacao_aoa_geral: '18,441,600,000',
    total_impostos_usd_geral: '2,169,600.00', total_impostos_aoa_geral: '1,844,160,000',
    subtotal_sem_impostos_usd_geral: '19,526,400.00', subtotal_sem_impostos_aoa_geral: '16,597,440,000',
    created_date: '2026-01-20', created_by: 'sistema@sga.ao',
    detalhes_aeroportos_html: '<div style="background:white;border:2px solid #e2e8f0;border-radius:8px;padding:15px;margin-bottom:10px;border-left:4px solid #004A99"><h3 style="color:#004A99">FNLU - Aeroporto Quatro de Fevereiro</h3><p><strong>Movimentos:</strong> 1,350</p><p><strong>Passageiros:</strong> 97,500</p><p><strong>Carga:</strong> 375,000 kg</p><p><strong>Faturação:</strong> $1,356,000.00</p></div>',
    detalhes_aeroportos_json: '{}',
    detalhes_aeroportos_texto: 'FNLU - Aeroporto Quatro de Fevereiro\nMovimentos: 1,350\nPassageiros: 97,500\nCarga: 375,000 kg\nFaturação: $1,356,000.00'
  }
};

export default function GestaoNotificacoes() {
  const { t } = useI18n();
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
    nome: '', evento_gatilho: '', canal_envio: [], destinatarios_perfis: [],
    destinatarios_usuarios_ids: [], grupo_whatsapp_id: '', mensagem_template_whatsapp: '',
    mensagem_template_email_assunto: '', mensagem_template_email_corpo: '',
    template_html_aeroportos: '', prompt_ia_personalizado: '', ativo: true, aeroporto_icao_relatorio: ''
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

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const user = await UserEntity.me();
      setCurrentUser(user);
      if (!isAdminProfile(user)) {
        setAlertInfo({ isOpen: true, type: 'error', title: 'Acesso Negado', message: 'Apenas administradores podem aceder a esta página.' });
        return;
      }
      const empId = user.empresa_id;
      const [regrasData, usuariosData, aeroportosData, historicoData, placeholdersData, gruposData] = await Promise.all([
        RegraNotificacao.list(),
        empId ? UserEntity.filter({ empresa_id: empId }) : UserEntity.list(),
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
      setAlertInfo({ isOpen: true, type: 'error', title: 'Erro', message: 'Não foi possível carregar os dados.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenForm = (regra = null) => {
    setActiveTab('geral');
    if (regra) {
      setEditingRegra(regra);
      const templatePadrao = TEMPLATES_PADRAO[regra.evento_gatilho];
      const assunto = regra.mensagem_template_email_assunto || (templatePadrao?.assunto || '');
      const corpo = regra.mensagem_template_email_corpo || (templatePadrao?.corpo || '');
      setFormData({
        nome: regra.nome || '', evento_gatilho: regra.evento_gatilho || '',
        canal_envio: regra.canal_envio || [], destinatarios_perfis: regra.destinatarios_perfis || [],
        destinatarios_usuarios_ids: regra.destinatarios_usuarios_ids || [],
        grupo_whatsapp_id: regra.grupo_whatsapp_id || '',
        mensagem_template_whatsapp: regra.mensagem_template_whatsapp || '',
        mensagem_template_email_assunto: assunto, mensagem_template_email_corpo: corpo,
        template_html_aeroportos: regra.template_html_aeroportos || '',
        prompt_ia_personalizado: regra.prompt_ia_personalizado || '',
        ativo: regra.ativo !== undefined ? regra.ativo : true,
        aeroporto_icao_relatorio: regra.aeroporto_icao_relatorio || ''
      });
    } else {
      setEditingRegra(null);
      setFormData({
        nome: '', evento_gatilho: '', canal_envio: [], destinatarios_perfis: [],
        destinatarios_usuarios_ids: [], grupo_whatsapp_id: '', mensagem_template_whatsapp: '',
        mensagem_template_email_assunto: '📊 Relatório Operacional Consolidado - {{data_relatorio}}',
        mensagem_template_email_corpo: '<html><body>Relatório Operacional</body></html>',
        template_html_aeroportos: '<div class="airport-card"><div class="airport-name">CODIGO - NOME</div><div class="airport-grid"><div class="airport-item"><div class="airport-label">✈️ Movimentos</div><div class="airport-value">VOOS</div></div><div class="airport-item"><div class="airport-label">👥 Passageiros</div><div class="airport-value">PASSAGEIROS</div></div><div class="airport-item"><div class="airport-label">📦 Carga (kg)</div><div class="airport-value">CARGA</div></div><div class="airport-item"><div class="airport-label">💰 Faturação</div><div class="airport-value currency-usd">$FATURACAO</div></div></div></div>',
        prompt_ia_personalizado: '', ativo: true, aeroporto_icao_relatorio: ''
      });
    }
    setIsFormOpen(true);
  };

  const handleCloseForm = () => { setIsFormOpen(false); setEditingRegra(null); };
  const handleInputChange = (field, value) => { setFormData(prev => ({ ...prev, [field]: value })); };

  const toggleCanal = (canal) => {
    setFormData(prev => ({ ...prev, canal_envio: prev.canal_envio.includes(canal) ? prev.canal_envio.filter(c => c !== canal) : [...prev.canal_envio, canal] }));
  };

  const togglePerfil = (perfil) => {
    setFormData(prev => ({ ...prev, destinatarios_perfis: prev.destinatarios_perfis.includes(perfil) ? prev.destinatarios_perfis.filter(p => p !== perfil) : [...prev.destinatarios_perfis, perfil] }));
  };

  const toggleUsuario = (userId) => {
    setFormData(prev => ({ ...prev, destinatarios_usuarios_ids: prev.destinatarios_usuarios_ids.includes(userId) ? prev.destinatarios_usuarios_ids.filter(id => id !== userId) : [...prev.destinatarios_usuarios_ids, userId] }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nome || !formData.evento_gatilho || formData.canal_envio.length === 0) {
      setAlertInfo({ isOpen: true, type: 'warning', title: 'Campos Obrigatórios', message: 'Por favor, preencha o nome, evento gatilho e selecione pelo menos um canal.' });
      return;
    }
    if (formData.destinatarios_perfis.length === 0 && formData.destinatarios_usuarios_ids.length === 0) {
      setAlertInfo({ isOpen: true, type: 'warning', title: 'Destinatários Obrigatórios', message: 'Por favor, selecione pelo menos um perfil ou utilizador.' });
      return;
    }
    if (formData.canal_envio.includes('whatsapp') && formData.mensagem_template_whatsapp.length > 1600) {
      setAlertInfo({ isOpen: true, type: 'warning', title: 'Limite de Caracteres Excedido', message: `O template de WhatsApp tem ${formData.mensagem_template_whatsapp.length} caracteres. O limite é 1600. Por favor, reduza o comprimento da mensagem.` });
      return;
    }
    guardedSubmit(async () => {
      try {
        const dataToSave = { ...formData, updated_by: currentUser.email, ...(editingRegra ? {} : { created_by: currentUser.email }) };
        if (editingRegra) { await RegraNotificacao.update(editingRegra.id, dataToSave); }
        else { await RegraNotificacao.create(dataToSave); }
        await loadData();
        handleCloseForm();
        setSuccessInfo({ isOpen: true, title: editingRegra ? 'Regra Atualizada!' : 'Regra Criada!', message: `A regra "${formData.nome}" foi ${editingRegra ? 'atualizada' : 'criada'} com sucesso.` });
      } catch (error) {
        console.error('Erro ao salvar regra:', error);
        setAlertInfo({ isOpen: true, type: 'error', title: 'Erro', message: 'Não foi possível salvar a regra.' });
      }
    });
  };

  const handleToggleAtivo = async (regra) => {
    try {
      await RegraNotificacao.update(regra.id, { ...regra, ativo: !regra.ativo, updated_by: currentUser.email });
      await loadData();
      setSuccessInfo({ isOpen: true, title: regra.ativo ? 'Regra Desativada' : 'Regra Ativada', message: `A regra "${regra.nome}" foi ${regra.ativo ? 'desativada' : 'ativada'}.` });
    } catch (error) {
      console.error('Erro ao alternar estado:', error);
      setAlertInfo({ isOpen: true, type: 'error', title: 'Erro', message: 'Não foi possível alterar o estado da regra.' });
    }
  };

  const handleDelete = (regra) => {
    setAlertInfo({
      isOpen: true, type: 'error', title: 'Excluir Regra', message: `Tem certeza que deseja excluir a regra "${regra.nome}"?`,
      showCancel: true, confirmText: 'Excluir',
      onConfirm: async () => {
        setAlertInfo(prev => ({ ...prev, isOpen: false }));
        try {
          await RegraNotificacao.delete(regra.id);
          await loadData();
          setSuccessInfo({ isOpen: true, title: 'Regra Excluída!', message: `A regra "${regra.nome}" foi excluída com sucesso.` });
        } catch (error) {
          console.error('Erro ao excluir regra:', error);
          setAlertInfo({ isOpen: true, type: 'error', title: 'Erro', message: 'Não foi possível excluir a regra.' });
        }
      }
    });
  };

  const toggleRegraSelection = (regraId) => {
    const novas = new Set(regrasSelecionadas);
    if (novas.has(regraId)) novas.delete(regraId); else novas.add(regraId);
    setRegrasSelecionadas(novas);
  };

  const toggleAllRegras = () => {
    setRegrasSelecionadas(regrasSelecionadas.size === regras.length ? new Set() : new Set(regras.map(r => r.id)));
  };

  const handleApagarSelecionadas = () => {
    const quantidade = regrasSelecionadas.size;
    setAlertInfo({
      isOpen: true, type: 'error', title: `Apagar ${quantidade} Regra(s)`,
      message: `Tem certeza que deseja apagar ${quantidade} regra(s) selecionada(s)? Esta ação é irreversível.`,
      showCancel: true, confirmText: 'Apagar Tudo',
      onConfirm: async () => {
        setAlertInfo(prev => ({ ...prev, isOpen: false }));
        try {
          let ok = 0;
          for (const id of regrasSelecionadas) { try { await RegraNotificacao.delete(id); ok++; } catch (e) { console.error(`Erro ao apagar regra ${id}:`, e); } }
          await loadData();
          setRegrasSelecionadas(new Set());
          setSuccessInfo({ isOpen: true, title: 'Regras Apagadas!', message: `${ok} de ${quantidade} regra(s) foram apagadas com sucesso.` });
        } catch (error) {
          console.error('Erro ao apagar regras:', error);
          setAlertInfo({ isOpen: true, type: 'error', title: 'Erro', message: 'Não foi possível apagar as regras selecionadas.' });
        }
      }
    });
  };

  const historicoFiltrado = historico.filter(item => {
    const matchStatus = filtrosHistorico.status === 'todos' || item.status === filtrosHistorico.status;
    const matchCanal = filtrosHistorico.canal === 'todos' || item.canais_enviados?.includes(filtrosHistorico.canal);
    return matchStatus && matchCanal;
  });

  const toggleHistoricoSelection = (recordId) => {
    const novos = new Set(historicoSelecionado);
    if (novos.has(recordId)) novos.delete(recordId); else novos.add(recordId);
    setHistoricoSelecionado(novos);
  };

  const toggleAllHistorico = () => {
    setHistoricoSelecionado(historicoSelecionado.size === historicoFiltrado.length ? new Set() : new Set(historicoFiltrado.map(h => h.id)));
  };

  const handleApagarHistoricoSelecionado = () => {
    const quantidade = historicoSelecionado.size;
    setAlertInfo({
      isOpen: true, type: 'error', title: `Apagar ${quantidade} Notificação(ões)`,
      message: `Tem certeza que deseja apagar ${quantidade} notificação(ões) do histórico? Esta ação é irreversível.`,
      showCancel: true, confirmText: 'Apagar',
      onConfirm: async () => {
        setAlertInfo(prev => ({ ...prev, isOpen: false }));
        try {
          let ok = 0; let erros = [];
          for (const id of historicoSelecionado) {
            try { await base44.entities.HistoricoNotificacao.delete(id); ok++; }
            catch (e) { console.error(`Erro ao apagar ${id}:`, e); erros.push(`${id}: ${e.message}`); }
          }
          await loadData();
          setHistoricoSelecionado(new Set());
          let msg = `${ok} de ${quantidade} notificação(ões) foram apagadas com sucesso.`;
          if (erros.length > 0) msg += `\n\nErros: ${erros.join(', ')}`;
          setSuccessInfo({ isOpen: true, title: ok > 0 ? 'Notificações Apagadas!' : 'Erro ao Apagar', message: msg });
        } catch (error) {
          console.error('Erro ao apagar notificações:', error);
          setAlertInfo({ isOpen: true, type: 'error', title: 'Erro', message: `Não foi possível apagar as notificações selecionadas.\n\nErro: ${error.message}` });
        }
      }
    });
  };

  const handleLimparHistorico = () => {
    setAlertInfo({
      isOpen: true, type: 'error', title: 'Limpar Histórico',
      message: `Tem certeza que deseja apagar todos os ${historico.length} registos do histórico? Esta ação é irreversível.`,
      showCancel: true, confirmText: 'Apagar Tudo',
      onConfirm: async () => {
        setAlertInfo(prev => ({ ...prev, isOpen: false }));
        try {
          const response = await base44.functions.invoke('limparHistoricoNotificacoes', {});
          if (response.data && response.data.sucesso) {
            await loadData();
            setSuccessInfo({ isOpen: true, title: 'Histórico Limpo!', message: `${response.data.total_apagados} registos foram apagados com sucesso.` });
          }
        } catch (error) {
          console.error('Erro ao limpar histórico:', error);
          setAlertInfo({ isOpen: true, type: 'error', title: 'Erro', message: 'Não foi possível limpar o histórico.' });
        }
      }
    });
  };

  // Placeholders
  const placeholdersDoSistema = formData.evento_gatilho ? PLACEHOLDERS_INFO_SISTEMA[formData.evento_gatilho] || [] : [];
  const placeholdersDisponiveis = [...placeholdersDoSistema, ...placeholdersGlobais.map(ph => `{{${ph.nome}}}`)];

  const usuariosFiltrados = usuarios.filter(user => {
    if (searchUsuario) {
      const search = searchUsuario.toLowerCase();
      if (!user.full_name?.toLowerCase().includes(search) && !user.email?.toLowerCase().includes(search)) return false;
    }
    if (filtrarOptInConfirmado && formData.canal_envio.includes('whatsapp')) return user.whatsapp_opt_in_status === 'confirmado';
    return true;
  });

  const handleEnviarOptIn = async (userId) => {
    setEnviandoOptIn(prev => ({ ...prev, [userId]: true }));
    try {
      const response = await base44.functions.invoke('enviarOptInWhatsApp', { user_id: userId });
      if (response.data && response.data.sucesso) {
        await loadData();
        setSuccessInfo({ isOpen: true, title: 'Solicitação Enviada! 📱', message: response.data.mensagem || 'Solicitação de opt-in enviada com sucesso.' });
      }
    } catch (error) {
      console.error('Erro ao enviar opt-in:', error);
      let errorMsg = 'Não foi possível enviar a solicitação de opt-in.';
      if (error.response?.data?.error) { errorMsg = error.response.data.error; if (error.response.data.details) errorMsg += `\n\n${error.response.data.details}`; }
      setAlertInfo({ isOpen: true, type: 'error', title: 'Erro ao Enviar Opt-in', message: errorMsg });
    } finally {
      setEnviandoOptIn(prev => ({ ...prev, [userId]: false }));
    }
  };

  const getPreviewData = () => PREVIEW_DATA[formData.evento_gatilho] || {};

  const renderPreview = (template) => {
    if (!template || !formData.evento_gatilho) return template;
    try {
      const previewData = getPreviewData();
      let preview = String(template || '');
      Object.keys(previewData).forEach(key => {
        try {
          const value = previewData[key];
          if (value !== undefined && value !== null) preview = preview.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
        } catch (e) { console.warn(`Erro ao processar placeholder {{${key}}}:`, e); }
      });
      return preview.replace(/\{\{[^}]+\}\}/g, '[...]');
    } catch (error) { console.error('Erro ao renderizar preview:', error); return template; }
  };

  const handleGerarComIA = async (tipoTemplate) => {
    if (!formData.evento_gatilho) {
      setAlertInfo({ isOpen: true, type: 'warning', title: 'Evento não selecionado', message: 'Por favor, selecione um evento gatilho antes de gerar o template com IA.' });
      return;
    }
    setIsGeneratingIA(prev => ({ ...prev, [tipoTemplate]: true }));
    try {
      const placeholders = PLACEHOLDERS_INFO_SISTEMA[formData.evento_gatilho] || [];
      const placeholdersToUse = tipoTemplate === 'template_html'
        ? ['{{codigo_icao}}', '{{nome}}', '{{total_voos}}', '{{total_passageiros}}', '{{total_carga}}', '{{total_faturacao_usd}}', '{{total_faturacao_aoa}}']
        : placeholders;
      const response = await base44.functions.invoke('gerarTemplateNotificacao', {
        evento_gatilho: formData.evento_gatilho, canal: tipoTemplate,
        placeholders: placeholdersToUse, prompt_personalizado: formData.prompt_ia_personalizado || null
      });
      if (response.data && response.data.template) {
        if (tipoTemplate === 'whatsapp') handleInputChange('mensagem_template_whatsapp', response.data.template);
        else if (tipoTemplate === 'email_assunto') handleInputChange('mensagem_template_email_assunto', response.data.template);
        else if (tipoTemplate === 'email_corpo') handleInputChange('mensagem_template_email_corpo', response.data.template);
        else if (tipoTemplate === 'template_html') handleInputChange('template_html_aeroportos', response.data.template);
        setSuccessInfo({ isOpen: true, title: 'Template Gerado! ✨', message: 'O template foi gerado com sucesso pela IA. Pode editá-lo conforme necessário.' });
      }
    } catch (error) {
      console.error('Erro ao gerar template com IA:', error);
      setAlertInfo({ isOpen: true, type: 'error', title: 'Erro ao Gerar Template', message: 'Não foi possível gerar o template com IA. Tente novamente.' });
    } finally {
      setIsGeneratingIA(prev => ({ ...prev, [tipoTemplate]: false }));
    }
  };

  const handleEnviarTeste = async (forcarReenvio = false) => {
    if (!editingRegra) return;
    setIsSendingTest(true);
    try {
      if (forcarReenvio) {
        try {
          const historicoAntigo = await base44.entities.HistoricoNotificacao.filter({ user_id: currentUser?.id, email_destinatario: testeData.email || currentUser?.email });
          if (historicoAntigo && historicoAntigo.length > 0) {
            for (const record of historicoAntigo) { try { await base44.entities.HistoricoNotificacao.delete(record.id); } catch (e) { console.error('Erro ao apagar registado:', e); } }
          }
        } catch (e) { console.warn('Aviso ao apagar histórico:', e.message); }
      }
      const response = await base44.functions.invoke('enviarNotificacaoTeste', {
        regra_id: editingRegra.id, destinatario_email: testeData.email || currentUser?.email,
        destinatario_whatsapp: testeData.whatsapp || currentUser?.telefone, user_id_test: currentUser?.id
      });
      if (response.data && response.data.sucesso) {
        setShowTestModal(false);
        setTesteData({ email: '', whatsapp: '' });
        const canaisEnviados = response.data.resultados.filter(r => r.status === 'enviado').map(r => r.canal === 'email' ? 'Email' : 'WhatsApp').join(' e ');
        setSuccessInfo({ isOpen: true, title: 'Teste Enviado! 📧', message: `A notificação de teste foi enviada via ${canaisEnviados}. Verifique a sua caixa de entrada.` });
      } else if (response.data?.resultados?.some(r => r.status === 'ja_enviado')) {
        setAlertInfo({ isOpen: true, type: 'warning', title: 'Notificação Já Enviada', message: 'Esta notificação de teste já foi enviada. Deseja forçar o reenvio (eliminando o histórico)?', showCancel: true, confirmText: 'Forçar Reenvio',
          onConfirm: () => { setAlertInfo(prev => ({ ...prev, isOpen: false })); handleEnviarTeste(true); }
        });
      }
    } catch (error) {
      console.error('Erro ao enviar teste:', error);
      if (error.message?.includes('ja_enviado') || error.message?.includes('já enviado')) {
        setAlertInfo({ isOpen: true, type: 'warning', title: 'Notificação Já Enviada', message: 'Esta notificação de teste já foi enviada. Deseja forçar o reenvio (eliminando o histórico)?', showCancel: true, confirmText: 'Forçar Reenvio',
          onConfirm: () => { setAlertInfo(prev => ({ ...prev, isOpen: false })); handleEnviarTeste(true); }
        });
      } else {
        setAlertInfo({ isOpen: true, type: 'error', title: 'Erro ao Enviar Teste', message: 'Não foi possível enviar a notificação de teste. Tente novamente.' });
      }
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleOpenRunModal = async (regra) => {
    setRunRegraId(regra.id);
    setPeriodoConsolidado('');
    if (regra.evento_gatilho === 'voo_ligado_criado') {
      try {
        const voosLigadosData = await VooLigado.list('-created_date', 20);
        const voosComDetalhes = await Promise.all(voosLigadosData.map(async (vooLigado) => {
          try {
            const [vooArr, vooDep] = await Promise.all([
              base44.entities.Voo.get(vooLigado.id_voo_arr).catch(() => null),
              base44.entities.Voo.get(vooLigado.id_voo_dep).catch(() => null)
            ]);
            return { ...vooLigado, vooArr, vooDep };
          } catch (e) { console.error('Erro ao buscar detalhes do voo:', e); return vooLigado; }
        }));
        setVoosLigados(voosComDetalhes);
      } catch (error) {
        console.error('Erro ao carregar voos ligados:', error);
        setAlertInfo({ isOpen: true, type: 'error', title: 'Erro ao Carregar Voos', message: 'Não foi possível carregar a lista de voos ligados.' });
      }
    }
    if (regra.evento_gatilho === 'relatorio_operacional_diario' || regra.evento_gatilho === 'relatorio_operacional_semanal' || regra.evento_gatilho === 'relatorio_operacional_mensal') {
      try {
        const aeroportosData = await base44.entities.Aeroporto.list();
        setAeroportosModal(aeroportosData || []);
      } catch (error) {
        console.error('Erro ao carregar aeroportos:', error);
        setAlertInfo({ isOpen: true, type: 'error', title: 'Erro ao Carregar Aeroportos', message: 'Não foi possível carregar a lista de aeroportos.' });
      }
    }
    setShowRunModal(true);
  };

  const handleExecutarAutomacao = async () => {
    if (!runRegraId) return;
    const regra = regras.find(r => r.id === runRegraId);
    if (!regra) return;
    if (regra.evento_gatilho === 'relatorio_operacional_consolidado' && !periodoConsolidado) {
      setAlertInfo({ isOpen: true, type: 'warning', title: 'Período Obrigatório', message: 'Por favor, selecione o período (diário, semanal ou mensal) para o relatório consolidado.' });
      return;
    }
    if (regra.evento_gatilho === 'voo_ligado_criado' && !selectedVooLigadoId) {
      setAlertInfo({ isOpen: true, type: 'warning', title: 'Voo Ligado Obrigatório', message: 'Por favor, selecione um voo ligado para executar a automação.' });
      return;
    }
    setIsRunning(true);
    try {
      let response;
      if (regra.evento_gatilho === 'voo_ligado_criado') {
        response = await base44.functions.invoke('notificarVooLigado', { voo_ligado_id: selectedVooLigadoId });
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
        setShowRunModal(false); setSelectedVooLigadoId(''); setSelectedAeroporto(''); setPeriodoConsolidado('');
        setTesteData({ email: '', whatsapp: '', forcar_reenvio: false });
        const resultadosDetalhados = response.data.resultados || [];
        const erros = resultadosDetalhados.filter(r => r.status === 'erro');
        const optInEnviados = resultadosDetalhados.filter(r => r.status === 'opt_in_enviado');
        const enviados = resultadosDetalhados.filter(r => r.status === 'enviado');
        const jaEnviados = resultadosDetalhados.filter(r => r.status === 'ja_enviado');
        let msg = response.data.mensagem || 'Automação executada';
        if (jaEnviados.length > 0) msg += `\n\n⏭️ ${jaEnviados.length} notificação(ões) já enviada(s) neste período`;
        if (erros.length > 0) { msg += `\n\n❌ ${erros.length} erro(s):\n`; erros.forEach(e => { msg += `\n• ${e.destinatario}: ${e.motivo || 'Erro desconhecido'}`; }); }
        if (optInEnviados.length > 0) msg += `\n\n📤 ${optInEnviados.length} solicitação(ões) de opt-in enviada(s)`;
        if (enviados.length > 0) msg += `\n\n✅ ${enviados.length} notificação(ões) enviada(s)`;
        setSuccessInfo({ isOpen: true, title: 'Automação Executada! ✅', message: msg });
      }
    } catch (error) {
      console.error('Erro ao executar automação:', error);
      let errorMessage = 'Não foi possível executar a automação.';
      if (error.message) errorMessage += `\n\nDetalhes: ${error.message}`;
      if (error.response?.data) errorMessage += `\n\nResposta: ${JSON.stringify(error.response.data, null, 2)}`;
      setAlertInfo({ isOpen: true, type: 'error', title: 'Erro ao Executar Automação', message: errorMessage });
    } finally {
      setIsRunning(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-lg">{t('notificacoes.carregando')}</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-slate-50 dark:bg-slate-950 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">{t('notificacoes.titulo')}</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">{t('notificacoes.descricao')}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadData} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="ml-2">{t('notificacoes.atualizar')}</span>
            </Button>
            <Button onClick={() => handleOpenForm()} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="w-4 h-4 mr-2" />
              {t('notificacoes.novaRegra')}
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-t-lg p-4 sticky top-0 z-20">
          <button onClick={() => setActiveTab('geral')} className={`px-4 py-2 font-medium transition-colors border-b-2 ${activeTab === 'geral' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'}`}>
            <Bell className="w-4 h-4 inline mr-2" />
            {t('notificacoes.regras')} ({regras.length})
          </button>
          <button onClick={() => setActiveTab('historico')} className={`px-4 py-2 font-medium transition-colors border-b-2 ${activeTab === 'historico' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'}`}>
            <FileText className="w-4 h-4 inline mr-2" />
            {t('notificacoes.historico')} ({historico.length})
          </button>
          <button onClick={() => setActiveTab('atendimento')} className={`px-4 py-2 font-medium transition-colors border-b-2 ${activeTab === 'atendimento' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'}`}>
            <MessageSquare className="w-4 h-4 inline mr-2" />
            {t('notificacoes.atendimento')}
          </button>
          <button onClick={() => setActiveTab('placeholders')} className={`px-4 py-2 font-medium transition-colors border-b-2 ${activeTab === 'placeholders' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'}`}>
            <FileText className="w-4 h-4 inline mr-2" />
            {t('notificacoes.placeholders')}
          </button>
          <button onClick={() => setActiveTab('grupos')} className={`px-4 py-2 font-medium transition-colors border-b-2 ${activeTab === 'grupos' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'}`}>
            <Users className="w-4 h-4 inline mr-2" />
            {t('notificacoes.gruposWhatsapp')}
          </button>
        </div>

        {/* Tab: Regras */}
        {activeTab === 'geral' && (
          <RegrasTab
            regras={regras}
            regrasSelecionadas={regrasSelecionadas}
            eventosDisponiveis={EVENTOS_DISPONIVEIS}
            t={t}
            onToggleRegraSelection={toggleRegraSelection}
            onToggleAllRegras={toggleAllRegras}
            onApagarSelecionadas={handleApagarSelecionadas}
            onToggleAtivo={handleToggleAtivo}
            onOpenRunModal={handleOpenRunModal}
            onOpenForm={handleOpenForm}
            onDelete={handleDelete}
          />
        )}

        {/* Tab: Historico */}
        {activeTab === 'historico' && (
          <HistoricoTab
            historico={historico}
            historicoFiltrado={historicoFiltrado}
            historicoSelecionado={historicoSelecionado}
            filtrosHistorico={filtrosHistorico}
            t={t}
            onSetFiltrosHistorico={setFiltrosHistorico}
            onToggleHistoricoSelection={toggleHistoricoSelection}
            onToggleAllHistorico={toggleAllHistorico}
            onApagarHistoricoSelecionado={handleApagarHistoricoSelecionado}
            onLimparHistorico={handleLimparHistorico}
          />
        )}

        {/* Tab: Atendimento */}
        {activeTab === 'atendimento' && (
          <ZAPIAtendimentoChat
            onError={(msg) => setAlertInfo({ isOpen: true, type: 'error', title: 'Erro', message: msg })}
            onSuccess={(msg) => setSuccessInfo({ isOpen: true, title: 'Sucesso!', message: msg })}
          />
        )}

        {/* Tab: Placeholders */}
        {activeTab === 'placeholders' && (
          <PlaceholderManagement
            onError={(msg) => setAlertInfo({ isOpen: true, type: 'error', title: 'Erro', message: msg })}
            onSuccess={(msg) => setSuccessInfo({ isOpen: true, title: 'Sucesso!', message: msg })}
            onReload={loadData}
          />
        )}

        {/* Tab: Grupos WhatsApp */}
        {activeTab === 'grupos' && (
          <ZAPIGruposRegistrados
            onError={(msg) => setAlertInfo({ isOpen: true, type: 'error', title: 'Erro', message: msg })}
            onSuccess={(msg) => setSuccessInfo({ isOpen: true, title: 'Sucesso!', message: msg })}
          />
        )}

        {/* Form Modal */}
        {isFormOpen && (
          <RegraFormModal
            editingRegra={editingRegra}
            formData={formData}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            aeroportos={aeroportos}
            usuarios={usuarios}
            usuariosFiltrados={usuariosFiltrados}
            searchUsuario={searchUsuario}
            filtrarOptInConfirmado={filtrarOptInConfirmado}
            gruposWhatsApp={gruposWhatsApp}
            placeholdersDoSistema={placeholdersDoSistema}
            placeholdersGlobais={placeholdersGlobais}
            placeholdersDisponiveis={placeholdersDisponiveis}
            isGeneratingIA={isGeneratingIA}
            isSendingTest={isSendingTest}
            enviandoOptIn={enviandoOptIn}
            eventosDisponiveis={EVENTOS_DISPONIVEIS}
            canaisDisponiveis={CANAIS_DISPONIVEIS}
            perfisDisponiveis={PERFIS_DISPONIVEIS}
            aeroportosAngola={AEROPORTOS_ANGOLA}
            templatesAeroportos={TEMPLATES_AEROPORTOS}
            t={t}
            onInputChange={handleInputChange}
            onToggleCanal={toggleCanal}
            onTogglePerfil={togglePerfil}
            onToggleUsuario={toggleUsuario}
            onSubmit={handleSubmit}
            onClose={handleCloseForm}
            onSetSearchUsuario={setSearchUsuario}
            onSetFiltrarOptInConfirmado={setFiltrarOptInConfirmado}
            onGerarComIA={handleGerarComIA}
            onEnviarOptIn={handleEnviarOptIn}
            onShowTestModal={() => setShowTestModal(true)}
            renderPreview={renderPreview}
            getPreviewData={getPreviewData}
          />
        )}

        {/* Run Modal */}
        {showRunModal && (
          <ExecutarAutomacaoModal
            regras={regras}
            runRegraId={runRegraId}
            voosLigados={voosLigados}
            selectedVooLigadoId={selectedVooLigadoId}
            aeroportosModal={aeroportosModal}
            selectedAeroporto={selectedAeroporto}
            testeData={testeData}
            isRunning={isRunning}
            aeroportosAngola={AEROPORTOS_ANGOLA}
            t={t}
            onSetSelectedVooLigadoId={setSelectedVooLigadoId}
            onSetSelectedAeroporto={setSelectedAeroporto}
            onSetTesteData={setTesteData}
            onExecutar={handleExecutarAutomacao}
            onClose={() => {
              setShowRunModal(false); setSelectedVooLigadoId(''); setSelectedAeroporto('');
              setPeriodoConsolidado(''); setTesteData({ email: '', whatsapp: '', forcar_reenvio: false });
            }}
          />
        )}

        {/* Test Modal */}
        {showTestModal && (
          <TesteNotificacaoModal
            formData={formData}
            testeData={testeData}
            currentUser={currentUser}
            isSendingTest={isSendingTest}
            t={t}
            onSetTesteData={setTesteData}
            onEnviarTeste={handleEnviarTeste}
            onClose={() => { setShowTestModal(false); setTesteData({ email: '', whatsapp: '' }); }}
          />
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
