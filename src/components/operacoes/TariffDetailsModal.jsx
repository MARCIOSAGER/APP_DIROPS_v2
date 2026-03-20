import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Mail } from 'lucide-react';
import SendEmailModal from '../shared/SendEmailModal';
import SuccessModal from '../shared/SuccessModal';
import AlertModal from '../shared/AlertModal';
import { sendEmailDirect } from '@/functions/sendEmailDirect';
import { createPdfDoc, addHeader, addFooter, addSectionTitle, addKeyValuePairs, addInfoBox, checkPageBreak, fetchEmpresaLogo, PDF } from '@/lib/pdfTemplate';
import { TarifaPouso } from '@/entities/TarifaPouso';
import { CompanhiaAerea } from '@/entities/CompanhiaAerea';
import { useI18n } from '@/components/lib/i18n';

// Helper para obter o label da categoria
const getCategoriaLabel = (categoria) => {
  const labels = {
    'categoria_1': 'Categoria 1',
    'categoria_2': 'Categoria 2',
    'categoria_3': 'Categoria 3',
    'categoria_4': 'Categoria 4'
  };
  return labels[categoria] || categoria;
};

export default function TariffDetailsModal({ isOpen, onClose, tariffCalculation, voos, voosLigados, aeroportos, onExportPDF }) {
  const { t } = useI18n();
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [successInfo, setSuccessInfo] = useState({ isOpen: false, title: '', message: '' });
  const [alertInfo, setAlertInfo] = useState({ isOpen: false, type: 'error', title: '', message: '' });
  const [tarifasPouso, setTarifasPouso] = useState([]);
  const [companhias, setCompanhias] = useState([]); // New state

  // Effect to load tarifasPouso and companhias when the modal opens
  useEffect(() => {
    if (isOpen) {
      loadTarifasPouso();
      loadCompanhias(); // New call
    }
  }, [isOpen]);

  // Function to load tarifasPouso
  const loadTarifasPouso = async () => {
    try {
      const tarifas = await TarifaPouso.list();
      setTarifasPouso(tarifas);
    } catch (error) {
      console.error('Erro ao carregar tarifas de pouso:', error);
      // Optionally set an alert if loading fails
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro de Carregamento',
        message: 'Não foi possível carregar as tarifas de pouso para exibição completa.'
      });
    }
  };

  // Function to load companhias
  const loadCompanhias = async () => {
    try {
      const companhiasData = await CompanhiaAerea.list();
      setCompanhias(companhiasData);
    } catch (error) {
      console.error('Erro ao carregar companhias:', error);
      // Optionally set an alert if loading fails
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro de Carregamento',
        message: 'Não foi possível carregar as informações das companhias aéreas.'
      });
    }
  };

  if (!tariffCalculation) return null;

  const vooDep = voos.find(v => v.id === tariffCalculation.voo_id);
  const vooLigado = vooDep ? voosLigados.find(vl => vl.id_voo_dep === vooDep.id) : null;
  const vooArr = vooLigado ? voos.find(v => v.id === vooLigado.id_voo_arr) : null;
  const aeroporto = aeroportos.find(a => a.id === tariffCalculation.aeroporto_id);
  const detalhes = tariffCalculation.detalhes_calculo || {};

  // Buscar companhia pelo código
  const companhia = companhias.find(c => c.codigo_icao === vooDep?.companhia_aerea);
  const nomeCompanhia = companhia ? companhia.nome : vooDep?.companhia_aerea || 'N/A';

  // Determinar tipo de voo (Doméstico/Internacional)
  const getTipoVoo = () => {
    if (!vooArr || !vooDep) return 'N/A';
    
    // Find the airport entities based on ICAO codes from the flight segments
    const aeroportoOrigem = aeroportos.find(a => a.codigo_icao === vooArr.aeroporto_origem_destino);
    const aeroportoOperacao = aeroportos.find(a => a.codigo_icao === vooArr.aeroporto_operacao);
    const aeroportoDestino = aeroportos.find(a => a.codigo_icao === vooDep.aeroporto_origem_destino);
    
    // Check if any of the involved airports are outside 'AO' (Angola)
    const isInternational = 
      (aeroportoOrigem && aeroportoOrigem.pais !== 'AO') ||
      (aeroportoOperacao && aeroportoOperacao.pais !== 'AO') ||
      (aeroportoDestino && aeroportoDestino.pais !== 'AO');
    
    return isInternational ? 'Internacional' : 'Doméstico';
  };

  const formatCurrency = (value) => {
    // Formato: separador de milhares = ".", separador de decimais = ","
    const formatted = new Intl.NumberFormat('pt-PT', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value || 0);
    return `${formatted} Kz`;
  };

  const formatUSD = (value) => {
    // Formato: separador de milhares = ".", separador de decimais = ","
    return `$${new Intl.NumberFormat('pt-PT', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value || 0)}`;
  };

  const formatToneladas = (value) => {
    // Remover zeros desnecessários: 30t em vez de 30.000t
    return `${Math.round(value || 0)}t`;
  };

  const categoriaAeroporto = tariffCalculation.categoria_aeroporto || detalhes.categoria_aeroporto || aeroporto?.categoria || 'N/A';

  // Helper para obter faixa de peso em toneladas (improved logic)
  const getFaixaPesoToneladas = (detalhesPouso) => {
    if (!detalhesPouso) return 'N/A';

    // 1. Tentar usar os valores já em toneladas salvos nos detalhes do cálculo
    if (detalhesPouso.faixa_min_ton && detalhesPouso.faixa_max_ton) {
      return `${detalhesPouso.faixa_min_ton} - ${detalhesPouso.faixa_max_ton} toneladas`;
    }

    // 2. Se não existirem, calcular a partir dos valores em kg salvos nos detalhes do cálculo
    if (detalhesPouso.faixa_min_kg && detalhesPouso.faixa_max_kg) {
      const minTon = Math.ceil(detalhesPouso.faixa_min_kg / 1000);
      const maxTon = Math.ceil(detalhesPouso.faixa_max_kg / 1000);
      return `${minTon} - ${maxTon} toneladas`;
    }

    // 3. Se os detalhes do cálculo não tiverem a faixa, tentar buscar da tarifa configurada
    //    baseado no MTOW e categoria do aeroporto, se tarifasPouso estiver carregado.
    if (tariffCalculation.mtow_kg && tarifasPouso.length > 0 && categoriaAeroporto !== 'N/A') {
      const mtow = parseFloat(tariffCalculation.mtow_kg);
      if (!isNaN(mtow)) {
        const tarifaAplicavel = tarifasPouso.find(t =>
          mtow >= t.faixa_min &&
          mtow <= t.faixa_max &&
          t.categoria_aeroporto === categoriaAeroporto &&
          t.status === 'ativa'
        );

        if (tarifaAplicavel) {
          const minTon = Math.ceil(tarifaAplicavel.faixa_min / 1000);
          const maxTon = Math.ceil(tarifaAplicavel.faixa_max / 1000);
          return `${minTon} - ${maxTon} toneladas`;
        }
      }
    }

    return 'N/A';
  };

  const arrivalTime = vooArr?.horario_real || vooArr?.horario_previsto || '00:00';
  const departureTime = vooDep?.horario_real || vooDep?.horario_previsto || '00:00';
  const arrivalDateTimeStr = vooArr ? new Date(`${vooArr.data_operacao}T${arrivalTime}`).toLocaleString('pt-AO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';
  const departureDateTimeStr = vooDep ? new Date(`${vooDep.data_operacao}T${departureTime}`).toLocaleString('pt-AO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';
  const rotaCompleta = vooArr && vooDep ? `${vooArr.aeroporto_origem_destino} - ${vooArr.aeroporto_operacao} - ${vooDep.aeroporto_origem_destino}` : 'N/A';

  const infoGerais = [
    ['Companhia Aérea:', vooDep?.companhia_aerea ? `${vooDep.companhia_aerea} - ${nomeCompanhia}` : nomeCompanhia],
    ['Tipo de Operação:', getTipoVoo()],
    ['Tipo de Voo:', vooDep?.tipo_voo || 'N/A'],
    ['Rota Completa:', rotaCompleta],
    ['Matrícula:', vooDep?.registo_aeronave || 'N/A'],
    ['MTOW:', tariffCalculation.mtow_kg ? `${new Intl.NumberFormat('pt-PT').format(tariffCalculation.mtow_kg)} kg` : 'N/A'],
    ['Aterragem:', arrivalDateTimeStr],
    ['Descolagem:', departureDateTimeStr],
    ['Estacionamento:', tariffCalculation.tempo_permanencia_horas ? `${tariffCalculation.tempo_permanencia_horas.toFixed(2)}h` : 'N/A'],
    ['Categoria do Aeroporto:', getCategoriaLabel(categoriaAeroporto)],
    ['Taxa de Câmbio:', `1 USD = ${tariffCalculation.taxa_cambio_usd_aoa || 850} AOA`],
    ['Data do Cálculo:', new Date(tariffCalculation.data_calculo).toLocaleString('pt-AO')],
  ];

  const renderDetailSection = (title, items, showUSD = false, formula = null) => (
    <div className="space-y-3 pb-4 border-b border-slate-200 last:border-b-0">
      <h3 className="text-base font-semibold text-blue-700 flex items-center gap-2">
        {title}
        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
          {getCategoriaLabel(categoriaAeroporto)}
        </Badge>
      </h3>
      
      {/* Campos principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
        {items.map(([label, value]) => (
          <div key={label} className="flex">
            <span className="font-medium text-slate-700 w-40 flex-shrink-0">{label}</span>
            <span className="text-slate-600 flex-grow">{value}</span>
          </div>
        ))}
      </div>

      {/* Fórmula (se fornecida) */}
      {formula && (
        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded">
          <span className="font-medium text-amber-900 text-sm">Fórmula: </span>
          <span className="text-amber-800 text-sm font-mono">
            {formula.replace(/(\d+\.\d{3})\s*ton/g, (match, num) => {
              const tons = Math.round(parseFloat(num));
              return `${tons} ton`;
            })}
          </span>
        </div>
      )}
    </div>
  );

  const handleSendEmail = async (emailData) => {
    setIsSendingEmail(true);
    try {
      // Carregar companhias se ainda não estiverem carregadas
      if (companhias.length === 0) {
        await loadCompanhias();
      }
      // Construir seções detalhadas de cada tarifa
      let detalhesPouso = '';
      if (detalhes.pouso && typeof detalhes.pouso === 'object' && !detalhes.pouso.erro) {
        detalhesPouso = `
          <h3 style="color: #2563eb; margin-top: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">Detalhes - Tarifa de Pouso</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px; font-weight: bold; color: #475569;">Tipo de Voo:</td>
              <td style="padding: 8px; color: #64748b;">${detalhes.pouso.tipoVoo || 'N/A'}</td>
            </tr>
            ${getFaixaPesoToneladas(detalhes.pouso) !== 'N/A' ? `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px; font-weight: bold; color: #475569;">Faixa de Peso:</td>
              <td style="padding: 8px; color: #64748b;">${getFaixaPesoToneladas(detalhes.pouso)}</td>
            </tr>
            ` : ''}
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px; font-weight: bold; color: #475569;">Tarifa Aplicada (USD):</td>
              <td style="padding: 8px; color: #64748b;">$${detalhes.pouso.tarifaAplicada || 'N/A'}/tonelada</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px; font-weight: bold; color: #475569;">MTOW (Toneladas):</td>
              <td style="padding: 8px; color: #64748b;">${detalhes.pouso.mtowTonnes || 'N/A'}t</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px; font-weight: bold; color: #475569;">Operações:</td>
              <td style="padding: 8px; color: #64748b;">${detalhes.pouso.operacoes || 'N/A'}</td>
            </tr>
            ${detalhes.pouso.formula ? `
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px; font-weight: bold; color: #475569;">Fórmula:</td>
                <td style="padding: 8px; color: #64748b;">${detalhes.pouso.formula}</td>
            </tr>
            ` : ''}
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px; font-weight: bold; color: #475569;">Valor USD:</td>
              <td style="padding: 8px; color: #64748b;">$${detalhes.pouso.valor?.toFixed(2) || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold; color: #166534;">Total AOA:</td>
              <td style="padding: 8px; font-weight: bold; color: #166534;">${formatCurrency(tariffCalculation.tarifa_pouso)}</td>
            </tr>
          </table>
        `;
      }

      let detalhesPermanencia = '';
      if (detalhes.permanencia && typeof detalhes.permanencia === 'object' && !detalhes.permanencia.erro && tariffCalculation.tarifa_permanencia > 0) {
        detalhesPermanencia = `
          <h3 style="color: #2563eb; margin-top: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">Detalhes - Tarifa de Estacionamento</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px; font-weight: bold; color: #475569;">Tipo:</td>
              <td style="padding: 8px; color: #64748b;">${detalhes.permanencia.tipo || 'N/A'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px; font-weight: bold; color: #475569;">Tarifa Base USD:</td>
              <td style="padding: 8px; color: #64748b;">$${detalhes.permanencia.tarifaBase || 'N/A'}/tonelada/hora</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px; font-weight: bold; color: #475569;">MTOW (Toneladas):</td>
              <td style="padding: 8px; color: #64748b;">${detalhes.permanencia.mtowTonnes || 'N/A'}t</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px; font-weight: bold; color: #475569;">Tempo Estacionamento:</td>
              <td style="padding: 8px; color: #64748b;">${detalhes.permanencia.tempoPermanencia || 'N/A'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px; font-weight: bold; color: #475569;">Horas Isentas:</td>
              <td style="padding: 8px; color: #64748b;">${detalhes.permanencia.horasIsentas || 0}h</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px; font-weight: bold; color: #475569;">Horas Cobradas:</td>
              <td style="padding: 8px; color: #64748b;">${detalhes.permanencia.horasCobradas || 0}h</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px; font-weight: bold; color: #475569;">Fórmula:</td>
              <td style="padding: 8px; color: #64748b;">${detalhes.permanencia.formula || 'N/A'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px; font-weight: bold; color: #475569;">Valor USD:</td>
              <td style="padding: 8px; color: #64748b;">$${detalhes.permanencia.valor?.toFixed(2) || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold; color: #166534;">Total AOA:</td>
              <td style="padding: 8px; font-weight: bold; color: #166534;">${formatCurrency(tariffCalculation.tarifa_permanencia)}</td>
            </tr>
          </table>
        `;
      }

      let detalhesPassageiros = '';
      if (detalhes.passageiros && typeof detalhes.passageiros === 'object' && !detalhes.passageiros.erro) {
        detalhesPassageiros = `
          <h3 style="color: #2563eb; margin-top: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">Detalhes - Tarifas de Passageiros</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px; font-weight: bold; color: #475569;">Tipo de Voo:</td>
              <td style="padding: 8px; color: #64748b;">${detalhes.passageiros.tipoVoo || 'N/A'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px; font-weight: bold; color: #475569;">Descrição:</td>
              <td style="padding: 8px; color: #64748b;">${detalhes.passageiros.descricao_tarifa || 'Tarifa de Embarque'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px; font-weight: bold; color: #475569;">Tarifa por Pax:</td>
              <td style="padding: 8px; color: #64748b;">$${detalhes.passageiros.tarifaPorPassageiro?.toFixed(2) || 'N/A'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px; font-weight: bold; color: #475569;">Passageiros ARR (Isento):</td>
              <td style="padding: 8px; color: #64748b;">${detalhes.passageiros.passageirosArr || 0}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px; font-weight: bold; color: #475569;">Passageiros DEP (Tributável):</td>
              <td style="padding: 8px; color: #64748b;">${detalhes.passageiros.passageirosDep || 0}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px; font-weight: bold; color: #475569;">Total Cobrado:</td>
              <td style="padding: 8px; color: #64748b;">${detalhes.passageiros.totalPassageirosCobranca || 0} Pax</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px; font-weight: bold; color: #475569;">Trânsito Direto (Isento):</td>
              <td style="padding: 8px; color: #64748b;">${detalhes.passageiros.transitoDireto || 0}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px; font-weight: bold; color: #475569;">Trânsito c/ Transbordo (Isento):</td>
              <td style="padding: 8px; color: #64748b;">${detalhes.passageiros.transitoTransbordo || 0}</td>
            </tr>
            ${detalhes.passageiros.formula ? `
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px; font-weight: bold; color: #475569;">Fórmula:</td>
                <td style="padding: 8px; color: #64748b;">${detalhes.passageiros.formula}</td>
            </tr>
            ` : `
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px; font-weight: bold; color: #475569;">Cálculo:</td>
                <td style="padding: 8px; color: #64748b;">${detalhes.passageiros.totalPassageirosCobranca || 0} Pax × $${detalhes.passageiros.tarifaPorPassageiro?.toFixed(2) || 0}</td>
            </tr>
            `}
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px; font-weight: bold; color: #475569;">Valor USD:</td>
              <td style="padding: 8px; color: #64748b;">$${detalhes.passageiros.valor?.toFixed(2) || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold; color: #166534;">Total AOA:</td>
              <td style="padding: 8px; font-weight: bold; color: #166534;">${formatCurrency(tariffCalculation.tarifa_passageiros)}</td>
            </tr>
          </table>
          ${detalhes.passageiros.observacao ? `
          <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px; margin-bottom: 20px;">
            <p style="margin: 0; color: #1e40af; font-size: 14px;"><strong>Observação:</strong> ${detalhes.passageiros.observacao}</p>
          </div>
          ` : ''}
        `;
      }

      let detalhesCarga = '';
      if (detalhes.carga && typeof detalhes.carga === 'object' && !detalhes.carga.erro && tariffCalculation.tarifa_carga > 0) {
        detalhesCarga = `
          <h3 style="color: #2563eb; margin-top: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">Detalhes - Tarifa de Carga</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px; font-weight: bold; color: #475569;">Descrição:</td>
              <td style="padding: 8px; color: #64748b;">${detalhes.carga.descricao_tarifa || detalhes.carga.tipo || 'N/A'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px; font-weight: bold; color: #475569;">Tarifa Por Ton USD:</td>
              <td style="padding: 8px; color: #64748b;">$${detalhes.carga.tarifaPorTon || 'N/A'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px; font-weight: bold; color: #475569;">Carga ARR:</td>
              <td style="padding: 8px; color: #64748b;">${detalhes.carga.cargaArr || 0} kg</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px; font-weight: bold; color: #475569;">Carga DEP:</td>
              <td style="padding: 8px; color: #64748b;">${detalhes.carga.cargaDep || 0} kg</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px; font-weight: bold; color: #475569;">Total Carga Kg:</td>
              <td style="padding: 8px; color: #64748b;">${detalhes.carga.totalCargaKg || 0} kg</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px; font-weight: bold; color: #475569;">Total Carga Ton:</td>
              <td style="padding: 8px; color: #64748b;">${detalhes.carga.totalCargaTon || 0}t</td>
            </tr>
            ${detalhes.carga.formula ? `
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px; font-weight: bold; color: #475569;">Fórmula:</td>
                <td style="padding: 8px; color: #64748b;">${detalhes.carga.formula}</td>
            </tr>
            ` : ''}
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px; font-weight: bold; color: #475569;">Valor USD:</td>
              <td style="padding: 8px; color: #64748b;">$${detalhes.carga.valor?.toFixed(2) || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold; color: #166534;">Total AOA:</td>
              <td style="padding: 8px; font-weight: bold; color: #166534;">${formatCurrency(tariffCalculation.tarifa_carga)}</td>
            </tr>
          </table>
        `;
      }

      let detalhesImpostos = '';
      if (detalhes.impostos && detalhes.impostos.length > 0) {
        detalhes.impostos.forEach((imposto, index) => {
          detalhesImpostos += `
            <h3 style="color: #2563eb; margin-top: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">Detalhes - Imposto: ${imposto.tipo}</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px; font-weight: bold; color: #475569;">Tipo:</td>
                <td style="padding: 8px; color: #64748b;">${imposto.tipo}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px; font-weight: bold; color: #475569;">Percentagem:</td>
                <td style="padding: 8px; color: #64748b;">${imposto.valor_configurado}%</td>
              </tr>
              ${imposto.formula ? `
              <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 8px; font-weight: bold; color: #475569;">Fórmula:</td>
                  <td style="padding: 8px; color: #64748b;">${imposto.formula}</td>
              </tr>
              ` : ''}
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px; font-weight: bold; color: #475569;">Valor USD:</td>
                <td style="padding: 8px; color: #64748b;">$${imposto.valor_usd?.toFixed(2) || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold; color: #dc2626;">Valor AOA:</td>
                <td style="padding: 8px; font-weight: bold; color: #dc2626;">${formatCurrency(imposto.valor_aoa)}</td>
              </tr>
            </table>
            ${imposto.descricao ? `
            <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px; margin-bottom: 20px;">
              <p style="margin: 0; color: #1e40af; font-size: 14px;"><strong>Descrição:</strong> ${imposto.descricao}</p>
            </div>
            ` : ''}
          `;
        });
      }

      let detalhesRecursos = '';
      if (detalhes.recursos && detalhes.recursos.itens && detalhes.recursos.itens.length > 0) {
        let recursosRows = detalhes.recursos.itens.map(r => `
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px; color: #475569;">${r.tipo}</td>
            <td style="padding: 8px; color: #64748b;">${r.tempo_horas ? r.tempo_horas.toFixed(2) + 'h' : '-'}</td>
            <td style="padding: 8px; text-align: right; color: #64748b;">$${r.valor_usd?.toFixed(2) || '0.00'}</td>
            <td style="padding: 8px; text-align: right; color: #64748b;">${formatCurrency(r.valor_usd * (tariffCalculation.taxa_cambio_usd_aoa || 850))}</td>
          </tr>
        `).join('');
        detalhesRecursos = `
          <h3 style="color: #c2410c; margin-top: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">Recursos de Solo</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr style="background-color: #fff7ed;">
              <td style="padding: 8px; font-weight: bold;">Recurso</td>
              <td style="padding: 8px; font-weight: bold;">Tempo</td>
              <td style="padding: 8px; font-weight: bold; text-align: right;">USD</td>
              <td style="padding: 8px; font-weight: bold; text-align: right;">AOA</td>
            </tr>
            ${recursosRows}
            <tr style="background-color: #fff7ed;">
              <td colspan="2" style="padding: 8px; font-weight: bold;">Total Recursos</td>
              <td style="padding: 8px; text-align: right; font-weight: bold;">$${(tariffCalculation.tarifa_recursos_usd || 0).toFixed(2)}</td>
              <td style="padding: 8px; text-align: right; font-weight: bold;">${formatCurrency(tariffCalculation.tarifa_recursos)}</td>
            </tr>
          </table>
        `;
      }

      let detalhesIluminacao = '';
      if (detalhes.iluminacao && typeof detalhes.iluminacao === 'object' && !detalhes.iluminacao.erro && tariffCalculation.outras_tarifas > 0) {
        detalhesIluminacao = `
          <h3 style="color: #2563eb; margin-top: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">Detalhes - Outras Tarifas (Iluminação)</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px; font-weight: bold; color: #475569;">Descrição:</td>
              <td style="padding: 8px; color: #64748b;">${detalhes.iluminacao.descricao_tarifa || detalhes.iluminacao.descricao || 'N/A'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px; font-weight: bold; color: #475569;">Período:</td>
              <td style="padding: 8px; color: #64748b;">${detalhes.iluminacao.periodo || 'N/A'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px; font-weight: bold; color: #475569;">ARR Noturno:</td>
              <td style="padding: 8px; color: #64748b;">${detalhes.iluminacao.arrNoturno ? 'Sim' : 'Não'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px; font-weight: bold; color: #475569;">DEP Noturno:</td>
              <td style="padding: 8px; color: #64748b;">${detalhes.iluminacao.depNoturno ? 'Sim' : 'Não'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px; font-weight: bold; color: #475569;">Operações Noturnas:</td>
              <td style="padding: 8px; color: #64748b;">${detalhes.iluminacao.operacoesNoturnas || 0}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px; font-weight: bold; color: #475569;">Tarifa Por Operacao USD:</td>
              <td style="padding: 8px; color: #64748b;">$${detalhes.iluminacao.tarifaPorOperacao || 'N/A'}</td>
            </tr>
            ${detalhes.iluminacao.formula ? `
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px; font-weight: bold; color: #475569;">Fórmula:</td>
                <td style="padding: 8px; color: #64748b;">${detalhes.iluminacao.formula}</td>
            </tr>
            ` : ''}
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px; font-weight: bold; color: #475569;">Valor USD:</td>
              <td style="padding: 8px; color: #64748b;">$${detalhes.iluminacao.valor?.toFixed(2) || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold; color: #166534;">Total AOA:</td>
              <td style="padding: 8px; font-weight: bold; color: #166534;">${formatCurrency(tariffCalculation.outras_tarifas)}</td>
            </tr>
          </table>
        `;
      }

      // Gerar corpo do email HTML completo
      const emailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
          ${emailData.message ? `
            <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px; margin-bottom: 20px;">
              <p style="margin: 0; color: #92400e;"><strong>Mensagem do Remetente:</strong></p>
              <p style="margin: 5px 0 0 0; color: #92400e;">${emailData.message}</p>
            </div>
          ` : ''}
          
          <h2 style="color: #2563eb;">Relatório de Cálculo de Tarifas</h2>
          
          <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <p><strong>Voo de Partida:</strong> ${vooDep?.numero_voo || 'N/A'}</p>
            <p><strong>Aeroporto:</strong> ${aeroporto?.codigo_icao || 'N/A'} - ${aeroporto?.nome || 'N/A'}</p>
            <p><strong>Companhia Aérea:</strong> ${nomeCompanhia}</p>
            <p><strong>Data de Geração:</strong> ${new Date().toLocaleDateString('pt-AO')}</p>
          </div>

          <h3 style="color: #2563eb; margin-top: 20px;">Informações Gerais</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            ${infoGerais.map(([label, value]) => `
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px; font-weight: bold; color: #475569;">${label}</td>
                <td style="padding: 8px; color: #64748b;">${value}</td>
              </tr>
            `).join('')}
          </table>

          <h3 style="color: #2563eb; margin-top: 20px;">Resumo das Tarifas</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr style="background-color: #f1f5f9;">
              <td style="padding: 10px; font-weight: bold;">Componente</td>
              <td style="padding: 10px; font-weight: bold; text-align: right;">Valor (AOA)</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px;">Tarifa de Pouso</td>
              <td style="padding: 10px; text-align: right;">${formatCurrency(tariffCalculation.tarifa_pouso)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px;">Tarifa de Estacionamento</td>
              <td style="padding: 10px; text-align: right;">${formatCurrency(tariffCalculation.tarifa_permanencia)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px;">Tarifas de Passageiros</td>
              <td style="padding: 10px; text-align: right;">${formatCurrency(tariffCalculation.tarifa_passageiros)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px;">Tarifa de Carga</td>
              <td style="padding: 10px; text-align: right;">${formatCurrency(tariffCalculation.tarifa_carga)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px;">Outras Tarifas (Iluminação)</td>
              <td style="padding: 10px; text-align: right;">${formatCurrency(tariffCalculation.outras_tarifas)}</td>
            </tr>
            ${tariffCalculation.tarifa_recursos > 0 ? `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px;">Recursos de Solo</td>
              <td style="padding: 10px; text-align: right;">${formatCurrency(tariffCalculation.tarifa_recursos)}</td>
            </tr>
            ` : ''}
            ${detalhes.subtotal_sem_impostos_aoa ? `
            <tr style="border-bottom: 1px solid #e2e8f0; background-color: #f8fafc;">
              <td style="padding: 10px; font-weight: bold;">Subtotal (sem impostos)</td>
              <td style="padding: 10px; text-align: right; font-weight: bold;">${formatCurrency(detalhes.subtotal_sem_impostos_aoa)}</td>
            </tr>
            ` : ''}
            ${detalhes.total_impostos_aoa && detalhes.total_impostos_aoa > 0 ? `
            <tr style="border-bottom: 1px solid #e2e8f0; background-color: #fef2f2;">
              <td style="padding: 10px; font-weight: bold; color: #dc2626;">Total Impostos</td>
              <td style="padding: 10px; text-align: right; font-weight: bold; color: #dc2626;">${formatCurrency(detalhes.total_impostos_aoa)}</td>
            </tr>
            ` : ''}
          </table>

          ${detalhesPouso}
          ${detalhesPermanencia}
          ${detalhesPassageiros}
          ${detalhesCarga}
          ${detalhesImpostos}
          ${detalhesIluminacao}
          ${detalhesRecursos}

          <div style="background-color: #dcfce7; padding: 15px; border-radius: 8px; margin-top: 30px;">
            <p style="font-size: 18px; font-weight: bold; color: #166534; margin: 0;">
              TOTAL GERAL: ${formatCurrency(tariffCalculation.total_tarifa)}
            </p>
            <p style="font-size: 14px; color: #166534; margin: 5px 0 0 0;">
              Equivalente a $${(tariffCalculation.total_tarifa_usd || 0).toFixed(2)}
            </p>
          </div>

          <p style="margin-top: 30px; color: #64748b; font-size: 12px; border-top: 1px solid #e2e8f0; padding-top: 15px;">
            Este relatório foi gerado automaticamente pelo DIROPS.<br>
            Direcção de Operações
          </p>
        </div>
      `;

      const response = await sendEmailDirect({
        to: emailData.to,
        subject: emailData.subject,
        body: emailBody
      });

      setIsEmailModalOpen(false);
      setSuccessInfo({
        isOpen: true,
        title: 'Email Enviado com Sucesso!',
        message: `O relatório completo de tarifas foi enviado para ${emailData.to}`
      });
    } catch (error) {
      console.error('Erro ao enviar email:', error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro ao Enviar Email',
        message: `Não foi possível enviar o email. ${error.message || 'Tente novamente mais tarde.'}`
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <DialogTitle className="text-2xl">{t('tarifasModal.titulo')}</DialogTitle>

                {/* Informações de Voos ARR e DEP */}
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-1">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1 text-sm">
                    <div>
                      <span className="font-semibold text-blue-900">{t('tarifasModal.vooARR')}</span>{' '}
                      <span className="text-blue-700">{vooArr?.numero_voo || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-blue-900">{t('tarifasModal.data')}</span>{' '}
                      <span className="text-blue-700">{vooArr?.data_operacao ? new Date(vooArr.data_operacao).toLocaleDateString('pt-AO') : 'N/A'}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-blue-900">{t('tarifasModal.vooDEP')}</span>{' '}
                      <span className="text-blue-700">{vooDep?.numero_voo || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-blue-900">{t('tarifasModal.data')}</span>{' '}
                      <span className="text-blue-700">{vooDep?.data_operacao ? new Date(vooDep.data_operacao).toLocaleDateString('pt-AO') : 'N/A'}</span>
                    </div>
                    <div className="md:col-span-2">
                      <span className="font-semibold text-blue-900">{t('tarifasModal.aeroporto')}</span>{' '}
                      <span className="text-blue-700">{aeroporto?.nome ? `${aeroporto.nome} - ${aeroporto.codigo_icao}` : 'N/A'}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-blue-900">{t('tarifasModal.companhia')}</span>{' '}
                      <span className="text-blue-700">{vooDep?.companhia_aerea ? `${vooDep.companhia_aerea} - ${nomeCompanhia}` : nomeCompanhia}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-blue-900">{t('tarifasModal.registo')}</span>{' '}
                      <span className="text-blue-700">{vooDep?.registo_aeronave || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {renderDetailSection(t('tarifasModal.infoGerais'), infoGerais)}

            {/* TARIFA DE ATERRAGEM E DESCOLAGEM */}
            {detalhes.pouso && typeof detalhes.pouso === 'object' && !detalhes.pouso.erro && (
              <div className="space-y-3 pb-4 border-b border-slate-200">
                <h3 className="text-base font-semibold text-blue-700 flex items-center gap-2">
                  Tarifa de Aterragem e Descolagem
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                    {getCategoriaLabel(categoriaAeroporto)}
                  </Badge>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  {[
                    ['Tipo de Voo', detalhes.pouso.tipoVoo || 'N/A'],
                    ['MTOW (Toneladas)', detalhes.pouso.mtowTonnes ? formatToneladas(detalhes.pouso.mtowTonnes) : 'N/A'],
                    ['Escalão de Peso', getFaixaPesoToneladas(detalhes.pouso)],
                    ['Operações', detalhes.pouso.operacoes || 'N/A'],
                    ['Valor USD', formatUSD(detalhes.pouso.valor)],
                    ['Valor AOA', formatCurrency(tariffCalculation.tarifa_pouso)],
                  ].map(([label, value]) => (
                    <div key={label} className="flex">
                      <span className="font-medium text-slate-700 w-40 flex-shrink-0">{label}</span>
                      <span className="text-slate-600 flex-grow">{value}</span>
                    </div>
                  ))}
                </div>

                {/* Tabela de escalões cumulativos */}
                {detalhes.pouso.escaloes?.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Cálculo por Escalão (Cumulativo)</p>
                    <table className="w-full text-xs border border-slate-200 rounded overflow-hidden">
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="text-left px-3 py-1.5 text-slate-600">Escalão</th>
                          <th className="text-right px-3 py-1.5 text-slate-600">Taxa (USD/ton)</th>
                          <th className="text-right px-3 py-1.5 text-slate-600">Peso no Escalão</th>
                          <th className="text-right px-3 py-1.5 text-slate-600">Subtotal USD</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detalhes.pouso.escaloes.map((e, i) => (
                          <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                            <td className="px-3 py-1.5 text-slate-700">{e.faixa}</td>
                            <td className="px-3 py-1.5 text-right text-slate-700">${e.tarifa}</td>
                            <td className="px-3 py-1.5 text-right text-slate-700">{e.peso_no_escalao}t</td>
                            <td className="px-3 py-1.5 text-right font-medium text-slate-800">${e.valor?.toFixed(2)}</td>
                          </tr>
                        ))}
                        <tr className="bg-blue-50 border-t border-blue-200">
                          <td colSpan={3} className="px-3 py-1.5 font-semibold text-blue-800">Total</td>
                          <td className="px-3 py-1.5 text-right font-bold text-blue-800">{formatUSD(detalhes.pouso.valor)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Fórmula (fallback para cálculos antigos sem escaloes) */}
                {!detalhes.pouso.escaloes?.length && detalhes.pouso.formula && (
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded">
                    <span className="font-medium text-amber-900 text-sm">Fórmula: </span>
                    <span className="text-amber-800 text-sm font-mono">{detalhes.pouso.formula}</span>
                  </div>
                )}
              </div>
            )}

            {/* TARIFA DE ESTACIONAMENTO */}
            {detalhes.permanencia && typeof detalhes.permanencia === 'object' && !detalhes.permanencia.erro && tariffCalculation.tarifa_permanencia > 0 && renderDetailSection('Tarifa de Estacionamento', [
              ['Tipo', detalhes.permanencia.tipo || 'N/A'],
              ['Tarifa Base USD', detalhes.permanencia.tarifaBase ? formatUSD(detalhes.permanencia.tarifaBase) + '/tonelada/hora' : 'N/A'],
              ['MTOW (Toneladas)', detalhes.permanencia.mtowTonnes ? formatToneladas(detalhes.permanencia.mtowTonnes) : 'N/A'],
              ['Tempo Estacionamento', detalhes.permanencia.tempoPermanencia || 'N/A'],
              ['Horas Isentas', `${detalhes.permanencia.horasIsentas || 0}h`],
              ['Horas Cobradas', `${detalhes.permanencia.horasCobradas || 0}h`],
              ['Valor USD', formatUSD(detalhes.permanencia.valor)],
              ['Valor AOA', formatCurrency(tariffCalculation.tarifa_permanencia)],
            ], true, detalhes.permanencia.formula)}

            {/* TARIFA DE PASSAGEIROS */}
            {detalhes.passageiros && typeof detalhes.passageiros === 'object' && !detalhes.passageiros.erro && (
              <>
                {renderDetailSection(t('tarifas.tarifasPassageiros'), [
                  ['Tipo de Voo', detalhes.passageiros.tipoVoo || 'N/A'],
                  ['Descrição', detalhes.passageiros.descricao_tarifa || 'Tarifa de Embarque'],
                  ['Tarifa por Pax', formatUSD(detalhes.passageiros.tarifaPorPassageiro)],
                  ['Passageiros ARR', detalhes.passageiros.passageirosArr || 0],
                  ['Passageiros DEP', detalhes.passageiros.passageirosDep || 0],
                  ['Total Cobrado', detalhes.passageiros.totalPassageirosCobranca || 0],
                  ['Trânsito Direto (Isento)', detalhes.passageiros.transitoDireto || 0],
                  ['Trânsito c/ Transbordo (Isento)', detalhes.passageiros.transitoTransbordo || 0],
                  ['Valor USD', formatUSD(detalhes.passageiros.valor)],
                  ['Valor AOA', formatCurrency(tariffCalculation.tarifa_passageiros)],
                ], true, detalhes.passageiros.formula)}

                {detalhes.passageiros.observacao && (
                  <div className="text-sm bg-blue-50 border border-blue-200 rounded p-3 text-blue-800 -mt-3">
                    <strong>Observação:</strong> {detalhes.passageiros.observacao}
                  </div>
                )}
              </>
            )}

            {/* TARIFA DE CARGA */}
            {detalhes.carga && typeof detalhes.carga === 'object' && !detalhes.carga.erro && tariffCalculation.tarifa_carga > 0 && renderDetailSection(t('tarifas.tarifaCarga'), [
              ['Descrição', detalhes.carga.descricao_tarifa || detalhes.carga.tipo || 'N/A'],
              ['Tarifa Por Ton USD', formatUSD(detalhes.carga.tarifaPorTon)],
              ['Carga ARR', detalhes.carga.cargaArr ? `${new Intl.NumberFormat('pt-PT').format(detalhes.carga.cargaArr)} kg` : 'N/A'],
              ['Carga DEP', detalhes.carga.cargaDep ? `${new Intl.NumberFormat('pt-PT').format(detalhes.carga.cargaDep)} kg` : 'N/A'],
              ['Total Carga Kg', detalhes.carga.totalCargaKg ? `${new Intl.NumberFormat('pt-PT').format(detalhes.carga.totalCargaKg)} kg` : 'N/A'],
              ['Total Carga Ton', detalhes.carga.totalCargaTon ? formatToneladas(detalhes.carga.totalCargaTon) : 'N/A'],
              ['Valor USD', formatUSD(detalhes.carga.valor)],
              ['Valor AOA', formatCurrency(tariffCalculation.tarifa_carga)],
            ], true, detalhes.carga.formula)}

            {/* IMPOSTOS */}
            {detalhes.impostos && detalhes.impostos.length > 0 && (
              <>
                {detalhes.impostos.map((imposto, index) => (
                  <React.Fragment key={index}>
                    {renderDetailSection(`${t('tarifasModal.impostoLabel')} - ${imposto.tipo}`, [
                      ['Tipo', imposto.tipo],
                      ['Percentagem', `${imposto.valor_configurado}%`],
                      ['Valor USD', formatUSD(imposto.valor_usd)],
                      ['Valor AOA', formatCurrency(imposto.valor_aoa)],
                    ], true, imposto.formula)}
                    {imposto.descricao && (
                      <div className="text-sm bg-blue-50 border border-blue-200 rounded p-3 text-blue-800 -mt-3">
                        <strong>Descrição:</strong> {imposto.descricao}
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </>
            )}

            {/* OUTRAS TARIFAS (ILUMINAÇÃO) */}
            {detalhes.iluminacao && typeof detalhes.iluminacao === 'object' && !detalhes.iluminacao.erro && tariffCalculation.outras_tarifas > 0 && renderDetailSection(t('tarifasModal.outrasTarifas'), [
              ['Descrição', detalhes.iluminacao.descricao_tarifa || detalhes.iluminacao.descricao || 'N/A'],
              ['ARR Noturno', detalhes.iluminacao.arrNoturno ? 'Sim' : 'Não'],
              ['DEP Noturno', detalhes.iluminacao.depNoturno ? 'Sim' : 'Não'],
              ['Operações Noturnas', detalhes.iluminacao.operacoesNoturnas || 0],
              ['Tarifa Por Operacao USD', formatUSD(detalhes.iluminacao.tarifaPorOperacao)],
              ['Período', detalhes.iluminacao.periodo || 'N/A'],
              ['Valor USD', formatUSD(detalhes.iluminacao.valor)],
              ['Valor AOA', formatCurrency(tariffCalculation.outras_tarifas)],
            ], true, detalhes.iluminacao.formula)}

            {/* RECURSOS DE SOLO */}
            {detalhes.recursos && detalhes.recursos.itens && detalhes.recursos.itens.length > 0 && (
              <div className="space-y-3 pb-4 border-b border-slate-200">
                <h3 className="text-base font-semibold text-orange-700 flex items-center gap-2">
                  {t('tarifasModal.recursosLabel')}
                  <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700">
                    {detalhes.recursos.itens.length} recurso(s)
                  </Badge>
                </h3>
                <div className="space-y-2">
                  {detalhes.recursos.itens.map((recurso, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded p-3 text-sm">
                      <div>
                        <span className="font-medium text-slate-700">{recurso.tipo}</span>
                        {recurso.tempo_horas > 0 && (
                          <span className="text-slate-500 ml-2">({recurso.tempo_horas.toFixed(2)}h)</span>
                        )}
                        {recurso.posicao_stand && (
                          <span className="text-slate-400 ml-2">Stand: {recurso.posicao_stand}</span>
                        )}
                        {recurso.num_balcoes > 0 && (
                          <span className="text-slate-400 ml-2">{recurso.num_balcoes} balcões</span>
                        )}
                        {recurso.litros > 0 && (
                          <span className="text-slate-400 ml-2">{recurso.litros}L {recurso.tipo_combustivel || ''}</span>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="font-semibold text-orange-800">{formatUSD(recurso.valor_usd)}</span>
                        <span className="text-slate-500 ml-2">= {formatCurrency(recurso.valor_usd * (tariffCalculation.taxa_cambio_usd_aoa || 850))}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center pt-2 text-sm font-semibold">
                  <span className="text-slate-700">{t('tarifasModal.totalRecursosUSD')}</span>
                  <span className="text-orange-800">{formatUSD(tariffCalculation.tarifa_recursos_usd)}</span>
                </div>
                <div className="flex justify-between items-center text-sm font-semibold">
                  <span className="text-slate-700">{t('tarifasModal.totalRecursosAOA')}</span>
                  <span className="text-orange-800">{formatCurrency(tariffCalculation.tarifa_recursos)}</span>
                </div>
              </div>
            )}

            {/* Sem recursos */}
            {(!detalhes.recursos || !detalhes.recursos.itens || detalhes.recursos.itens.length === 0) && (
              <div className="space-y-3 pb-4 border-b border-slate-200">
                <h3 className="text-base font-semibold text-orange-700">{t('tarifasModal.recursosLabel')}</h3>
                <p className="text-sm text-slate-500 italic">{t('tarifasModal.recursosNenhum')}</p>
              </div>
            )}

            {/* TOTAL GERAL */}
            <div className="pt-4 border-t-2 border-slate-300 space-y-2">
              {detalhes.subtotal_sem_impostos_usd && (
                <div className="flex justify-between items-center text-slate-600">
                  <h3 className="text-lg font-semibold">{t('tarifasModal.subtotalSemImpostos')}</h3>
                  <span className="text-lg font-semibold">
                    {formatUSD(detalhes.subtotal_sem_impostos_usd)} = {formatCurrency(detalhes.subtotal_sem_impostos_aoa)}
                  </span>
                </div>
              )}
              {detalhes.total_impostos_usd && detalhes.total_impostos_usd > 0 && (
                <div className="flex justify-between items-center text-red-600">
                  <h3 className="text-lg font-semibold">{t('tarifasModal.impostos')}</h3>
                  <span className="text-lg font-semibold">
                    {formatUSD(detalhes.total_impostos_usd)} = {formatCurrency(detalhes.total_impostos_aoa)}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                <h3 className="text-xl font-bold text-green-700">{t('tarifasModal.total')}</h3>
                <span className="text-2xl font-bold text-green-700">
                  {formatUSD(tariffCalculation.total_tarifa_usd)} = {formatCurrency(tariffCalculation.total_tarifa)}
                </span>
              </div>
              <div className="text-right text-sm text-slate-600 mt-2">
                {t('tarifasModal.taxaCambio')} 1 USD = {tariffCalculation.taxa_cambio_usd_aoa} AOA
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={onClose}>
              {t('tarifasModal.fechar')}
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsEmailModalOpen(true)}
              className="gap-2"
            >
              <Mail className="w-4 h-4" />
              {t('tarifasModal.enviarEmail')}
            </Button>
            <Button onClick={async () => {
              try {
                const doc = await createPdfDoc();

                // Buscar informações do usuário e logo da empresa
                const { User } = await import('@/entities/User');
                const currentUser = await User.me();
                const nomeUsuario = currentUser?.full_name || currentUser?.email || 'Usuário';
                const logoBase64 = await fetchEmpresaLogo(currentUser?.empresa_id);

                // Header
                let y = addHeader(doc, { title: 'Cálculo de Tarifas Aeroportuárias', logoBase64 });

                // Info box com dados do voo
                const infoItems = [];
                if (vooArr) {
                  infoItems.push({ label: 'Voo ARR', value: `${vooArr.numero_voo || 'N/A'} — ${vooArr.data_operacao ? new Date(vooArr.data_operacao).toLocaleDateString('pt-AO') : 'N/A'}` });
                }
                infoItems.push({ label: 'Voo DEP', value: `${vooDep?.numero_voo || 'N/A'} — ${vooDep?.data_operacao ? new Date(vooDep.data_operacao).toLocaleDateString('pt-AO') : 'N/A'}` });
                infoItems.push({ label: 'Aeroporto', value: aeroporto?.nome ? `${aeroporto.nome} - ${aeroporto.codigo_icao}` : 'N/A' });
                infoItems.push({ label: 'Companhia', value: vooDep?.companhia_aerea ? `${vooDep.companhia_aerea} - ${nomeCompanhia}` : nomeCompanhia });
                infoItems.push({ label: 'Registo', value: vooDep?.registo_aeronave || 'N/A' });
                y = addInfoBox(doc, y, infoItems);

                // Informações Gerais
                y = checkPageBreak(doc, y, 30);
                y = addSectionTitle(doc, y, 'Informações Gerais');
                const infoGeraisItems = infoGerais.map(([label, value]) => ({ label, value: String(value) }));
                y = addKeyValuePairs(doc, y, infoGeraisItems, { twoColumns: true });

                // Tarifa de Pouso
                if (detalhes.pouso) {
                  y = checkPageBreak(doc, y, 30);
                  y = addSectionTitle(doc, y, 'Tarifa de Pouso');
                  y = addKeyValuePairs(doc, y, [
                    { label: 'Tipo', value: detalhes.pouso.tipoVoo || 'N/A' },
                    { label: 'MTOW', value: formatToneladas(detalhes.pouso.mtowTonnes) },
                    { label: 'Valor USD', value: formatUSD(tariffCalculation.tarifa_pouso_usd) },
                    { label: 'Valor AOA', value: formatCurrency(tariffCalculation.tarifa_pouso) },
                  ], { twoColumns: true });
                }

                // Tarifa de Estacionamento
                if (detalhes.permanencia) {
                  y = checkPageBreak(doc, y, 30);
                  y = addSectionTitle(doc, y, 'Tarifa de Estacionamento');
                  y = addKeyValuePairs(doc, y, [
                    { label: 'Tempo', value: detalhes.permanencia.tempoPermanencia || '0h' },
                    { label: 'Valor USD', value: formatUSD(tariffCalculation.tarifa_permanencia_usd) },
                    { label: 'Valor AOA', value: formatCurrency(tariffCalculation.tarifa_permanencia) },
                  ], { twoColumns: true });
                }

                // Tarifas de Passageiros
                if (detalhes.passageiros) {
                  y = checkPageBreak(doc, y, 30);
                  y = addSectionTitle(doc, y, 'Tarifas de Passageiros');
                  y = addKeyValuePairs(doc, y, [
                    { label: 'Total Cobrado', value: `${detalhes.passageiros.totalPassageirosCobranca || 0} pax` },
                    { label: 'Valor USD', value: formatUSD(tariffCalculation.tarifa_passageiros_usd) },
                    { label: 'Valor AOA', value: formatCurrency(tariffCalculation.tarifa_passageiros) },
                  ], { twoColumns: true });
                }

                // Recursos de Solo
                if (detalhes.recursos && detalhes.recursos.itens && detalhes.recursos.itens.length > 0) {
                  y = checkPageBreak(doc, y, 30);
                  y = addSectionTitle(doc, y, 'Recursos de Solo');
                  const recursosItems = detalhes.recursos.itens.map(r => ({
                    label: r.tipo,
                    value: `${formatUSD(r.valor_usd)} (${r.tempo_horas ? r.tempo_horas.toFixed(2) + 'h' : '-'})`
                  }));
                  recursosItems.push({
                    label: 'Total Recursos',
                    value: `${formatUSD(tariffCalculation.tarifa_recursos_usd)} = ${formatCurrency(tariffCalculation.tarifa_recursos)}`
                  });
                  y = addKeyValuePairs(doc, y, recursosItems, { twoColumns: true });
                }

                // Totais
                y = checkPageBreak(doc, y, 40);
                const m = PDF.margin;
                const pageWidth = doc.internal.pageSize.getWidth();

                y += 4;
                doc.setDrawColor(...PDF.colors.separator);
                doc.setLineWidth(0.3);
                doc.line(m.left, y, pageWidth - m.right, y);
                y += 8;

                // Subtotal
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(PDF.font.body);
                doc.setTextColor(...PDF.colors.muted);
                doc.text('Subtotal USD:', m.left, y);
                doc.text(formatUSD(tariffCalculation.total_tarifa_usd), pageWidth - m.right, y, { align: 'right' });
                y += 6;

                // Impostos (if applicable)
                if (tariffCalculation.total_impostos_usd) {
                  doc.setTextColor(...PDF.colors.danger);
                  doc.text('Impostos USD:', m.left, y);
                  doc.text(formatUSD(tariffCalculation.total_impostos_usd), pageWidth - m.right, y, { align: 'right' });
                  y += 6;
                }

                // Total
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(14);
                doc.setTextColor(...PDF.colors.success);
                doc.text('TOTAL:', m.left, y);
                doc.text(`${formatUSD(tariffCalculation.total_tarifa_usd)} = ${formatCurrency(tariffCalculation.total_tarifa)}`, pageWidth - m.right, y, { align: 'right' });

                // Footer
                addFooter(doc, { generatedBy: nomeUsuario });

                // Download
                doc.save(`detalhes_tarifas_${vooDep?.numero_voo || 'voo'}_${new Date().toISOString().split('T')[0]}.pdf`);
                
                setSuccessInfo({
                  isOpen: true,
                  title: t('tarifasModal.pdfGerado'),
                  message: t('tarifasModal.pdfExportado')
                });
              } catch (error) {
                console.error('❌ Erro ao exportar PDF:', error);
                setAlertInfo({
                  isOpen: true,
                  type: 'error',
                  title: 'Erro',
                  message: 'Erro ao gerar PDF.'
                });
              }
            }} className="gap-2">
              <Download className="w-4 h-4" />
              {t('tarifasModal.exportarPDF')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SendEmailModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        onSend={handleSendEmail}
        isSending={isSendingEmail}
        defaultSubject={`Relatório de Tarifas - Voo ${vooDep?.numero_voo || 'N/A'} - ${aeroporto?.codigo_icao || 'N/A'}`}
      />

      <SuccessModal
        isOpen={successInfo.isOpen}
        onClose={() => setSuccessInfo({ isOpen: false, title: '', message: '' })}
        title={successInfo.title}
        message={successInfo.message}
      />

      <AlertModal
        isOpen={alertInfo.isOpen}
        onClose={() => setAlertInfo({ ...alertInfo, isOpen: false })}
        type={alertInfo.type}
        title={alertInfo.title}
        message={alertInfo.message}
      />
    </>
  );
}