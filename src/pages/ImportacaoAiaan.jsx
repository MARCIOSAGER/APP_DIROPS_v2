import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle,
  ArrowLeft, ArrowRight, Plane, PlaneLanding, PlaneTakeoff, Link2,
  Calculator, Loader2, RefreshCw, MapPin, Building2, Eye, ChevronDown, ChevronUp
} from 'lucide-react';
import * as XLSX from 'xlsx';

import { Voo } from '@/entities/Voo';
import { VooLigado } from '@/entities/VooLigado';
import { CalculoTarifa } from '@/entities/CalculoTarifa';
import { RegistoAeronave } from '@/entities/RegistoAeronave';
import { CompanhiaAerea } from '@/entities/CompanhiaAerea';
import { Aeroporto } from '@/entities/Aeroporto';
import { TarifaPouso } from '@/entities/TarifaPouso';
import { TarifaPermanencia } from '@/entities/TarifaPermanencia';
import { OutraTarifa } from '@/entities/OutraTarifa';
import { Imposto } from '@/entities/Imposto';
import { ConfiguracaoSistema } from '@/entities/ConfiguracaoSistema';
import { useAuth } from '@/lib/AuthContext';

import { calculateAllTariffs } from '@/components/lib/tariffCalculations';
import {
  CITY_TO_ICAO, OPERATOR_TO_ICAO,
  normalizeDestino, normalizeOperator,
  lookupICAO, lookupOperatorICAO
} from '@/components/operacoes/importAiaanMappings';
import { useCompanyView } from '@/lib/CompanyViewContext';
import { createPageUrl } from '@/utils';
import { useI18n } from '@/components/lib/i18n';

// ─── Helpers ────────────────────────────────────────────────────────────────

const SHEET_NAME = 'AIAAN VOOS 2025';
const AIRPORT_ICAO = 'FNBJ';
const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 300;

function isEmpty(v) {
  if (v === null || v === undefined) return true;
  const s = String(v).trim();
  return s === '' || s === '-' || s === ' -' || s === '- ';
}

/**
 * Parse Excel time/datetime value to HH:MM string.
 * Excel stores times as fractional days (0.5 = 12:00).
 */
function parseTime(val) {
  if (isEmpty(val)) return null;

  // Already a string like "HH:MM" or "HH:MM:SS"
  if (typeof val === 'string') {
    const m = val.match(/(\d{1,2}):(\d{2})/);
    if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;
    return null;
  }

  // Numeric (Excel serial time fraction or datetime)
  if (typeof val === 'number') {
    // If it looks like a full datetime serial (> 1), extract time part
    const frac = val > 1 ? val - Math.floor(val) : val;
    const totalMinutes = Math.round(frac * 24 * 60);
    const h = Math.floor(totalMinutes / 60) % 24;
    const min = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  }

  // Date object
  if (val instanceof Date) {
    return `${String(val.getHours()).padStart(2, '0')}:${String(val.getMinutes()).padStart(2, '0')}`;
  }

  return null;
}

/**
 * Parse Excel date value to YYYY-MM-DD string.
 */
function parseDate(val) {
  if (isEmpty(val)) return null;

  if (typeof val === 'number') {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(val);
    if (d) {
      return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
    }
  }

  if (val instanceof Date) {
    return val.toISOString().slice(0, 10);
  }

  if (typeof val === 'string') {
    const m = val.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[0];
    // dd/mm/yyyy
    const m2 = val.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (m2) return `${m2[3]}-${m2[2]}-${m2[1]}`;
  }

  return null;
}

function sanitizePMD(rawTonnes) {
  if (isEmpty(rawTonnes)) return null;
  let n = parseFloat(String(rawTonnes).replace(',', '.'));
  if (isNaN(n) || n <= 0) return null;
  // Convert tonnes to kg
  let kg = n * 1000;
  // If the value is already very large, it was likely already in kg
  if (n > 1000) kg = n;
  // Cap at 600000 kg (A380 max)
  if (kg > 600000) kg = 600000;
  return Math.round(kg);
}

function parseNumeric(val) {
  if (isEmpty(val)) return 0;
  const n = parseFloat(String(val).replace(',', '.'));
  return isNaN(n) ? 0 : Math.max(0, Math.round(n));
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function ImportacaoAiaan() {
  const { t } = useI18n();
  const { effectiveEmpresaId } = useCompanyView();
  const { user } = useAuth();

  // Wizard state
  const [step, setStep] = useState(1);

  // Step 1: Upload
  const [file, setFile] = useState(null);
  const [rawRows, setRawRows] = useState([]);
  const [parsedFlights, setParsedFlights] = useState([]);
  const [parseError, setParseError] = useState(null);
  const [parseSummary, setParseSummary] = useState(null);

  // Step 2: Mappings
  const [unmappedCities, setUnmappedCities] = useState({}); // { cityName: userICAO }
  const [unmappedOperators, setUnmappedOperators] = useState({}); // { opName: userICAO }
  const [newAircraft, setNewAircraft] = useState([]); // [{ registo, pmd_kg, selected }]
  const [existingAircraft, setExistingAircraft] = useState([]);
  const [existingVoos, setExistingVoos] = useState([]);

  // Step 3: Preview
  const [previewData, setPreviewData] = useState(null);
  const [showAllPreview, setShowAllPreview] = useState(false);

  // Step 4: Execution
  const [executing, setExecuting] = useState(false);
  const [executionPhase, setExecutionPhase] = useState('');
  const [executionProgress, setExecutionProgress] = useState(0);
  const [executionCounts, setExecutionCounts] = useState({
    aircraftCreated: 0, aircraftTotal: 0,
    voosCreated: 0, voosTotal: 0, voosDuplicate: 0,
    linksCreated: 0, linksTotal: 0,
    tariffsCalculated: 0, tariffsTotal: 0, tariffsSkipped: 0,
  });
  const [executionErrors, setExecutionErrors] = useState([]);
  const [executionDone, setExecutionDone] = useState(false);

  const fileInputRef = useRef(null);
  const abortRef = useRef(false);

  // ─── Step 1: Parse Excel ────────────────────────────────────────────────

  const handleFileSelect = useCallback((e) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const f = e.dataTransfer.files?.[0];
    if (f) processFile(f);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const processFile = (f) => {
    if (!f.name.endsWith('.xlsx') && !f.name.endsWith('.xls')) {
      setParseError('Ficheiro deve ser .xlsx ou .xls');
      return;
    }
    setFile(f);
    setParseError(null);
    setParsedFlights([]);
    setParseSummary(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: false });

        // Try exact sheet name, fallback to first sheet
        let sheetName = SHEET_NAME;
        if (!workbook.SheetNames.includes(sheetName)) {
          // Try partial match
          const match = workbook.SheetNames.find(s => s.toUpperCase().includes('AIAAN'));
          if (match) {
            sheetName = match;
          } else {
            sheetName = workbook.SheetNames[0];
          }
        }

        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

        if (rows.length < 2) {
          setParseError('Ficheiro vazio ou sem dados.');
          return;
        }

        // Skip header row (index 0)
        const dataRows = rows.slice(1).filter(row => {
          // Skip empty rows — must have at least a date
          return !isEmpty(row[0]);
        });

        setRawRows(dataRows);
        parseRows(dataRows);
      } catch (err) {
        console.error('Erro ao ler Excel:', err);
        setParseError(`Erro ao ler ficheiro: ${err.message}`);
      }
    };
    reader.readAsArrayBuffer(f);
  };

  const parseRows = (rows) => {
    const flights = [];
    const operatorsSet = new Set();
    const citiesSet = new Set();
    const dates = [];

    for (const row of rows) {
      const dateStr = parseDate(row[0]);
      if (!dateStr) continue;

      const ata = parseTime(row[5]);
      const std = parseTime(row[6]);
      const atd = parseTime(row[7]);
      const calcos = parseTime(row[8]);

      // Determine tipo_movimento
      const hasATA = !isEmpty(row[5]);
      const hasSTD = !isEmpty(row[6]);

      let tipo_movimento = null;
      if (hasATA && !hasSTD) tipo_movimento = 'ARR';
      else if (hasSTD && !hasATA) tipo_movimento = 'DEP';
      else if (hasATA && hasSTD) {
        // Ambiguous — treat as ARR if ATA < STD, else DEP
        // Or keep both — for now treat as two-in-one (skip, will be handled by linking)
        tipo_movimento = 'ARR'; // Default to ARR if both present
      }

      if (!tipo_movimento) continue;

      const operadorRaw = String(row[4] || '').trim();
      const destinoRaw = String(row[15] || '').trim();
      const callsign = String(row[10] || '').trim().toUpperCase();
      const registo = String(row[11] || '').trim().toUpperCase().replace(/[\s]/g, '');
      const pmdRaw = row[12];

      const normalizedOperator = normalizeOperator(operadorRaw);
      const normalizedCity = normalizeDestino(destinoRaw);

      if (normalizedOperator) operatorsSet.add(normalizedOperator);
      if (normalizedCity) citiesSet.add(normalizedCity);
      dates.push(dateStr);

      const pmdKg = sanitizePMD(pmdRaw);

      // Convencional vs Reacao
      const convencional = !isEmpty(row[13]) ? String(row[13]).trim() : '';
      const reacao = !isEmpty(row[14]) ? String(row[14]).trim() : '';
      const tipoAeronave = reacao || convencional || '';

      flights.push({
        data_operacao: dateStr,
        turno: isEmpty(row[1]) ? '' : String(row[1]).trim(),
        numero_ordem: isEmpty(row[2]) ? '' : String(row[2]).trim(),
        pista: isEmpty(row[3]) ? '' : String(row[3]).trim(),
        operador_raw: operadorRaw,
        operador_normalizado: normalizedOperator,
        operador_icao: lookupOperatorICAO(operadorRaw),
        ata: ata,
        std: std,
        atd: atd,
        calcos: calcos,
        stand: isEmpty(row[9]) ? '' : String(row[9]).trim(),
        callsign: callsign,
        numero_voo: callsign,
        registo: registo,
        pmd_kg: pmdKg,
        tipo_aeronave: tipoAeronave,
        destino_raw: destinoRaw,
        destino_normalizado: normalizedCity,
        destino_icao: lookupICAO(destinoRaw),
        pax_embarque: parseNumeric(row[16]),
        pax_transito: parseNumeric(row[17]),
        pax_desembarque: parseNumeric(row[18]),
        crew: parseNumeric(row[19]),
        combustivel_lt: parseNumeric(row[24]),
        carga_kg: parseNumeric(row[25]),
        correio_kg: parseNumeric(row[26]),
        obs: isEmpty(row[40]) ? '' : String(row[40]).trim(),
        tipo_movimento: tipo_movimento,
      });
    }

    setParsedFlights(flights);

    const uniqueDates = [...new Set(dates)].sort();
    setParseSummary({
      totalRows: flights.length,
      dateRange: uniqueDates.length > 0
        ? `${uniqueDates[0]} a ${uniqueDates[uniqueDates.length - 1]}`
        : 'N/A',
      uniqueOperators: operatorsSet.size,
      uniqueDestinations: citiesSet.size,
      arrCount: flights.filter(f => f.tipo_movimento === 'ARR').length,
      depCount: flights.filter(f => f.tipo_movimento === 'DEP').length,
    });
  };

  // ─── Step 2: Mapping Analysis ───────────────────────────────────────────

  useEffect(() => {
    if (step === 2 && parsedFlights.length > 0) {
      analyzeMappings();
    }
  }, [step]);

  const analyzeMappings = async () => {
    // Load existing aircraft
    try {
      const aircraft = await RegistoAeronave.list();
      setExistingAircraft(aircraft);

      // Load existing voos for duplicate check
      const voos = await Voo.filter({ aeroporto_operacao: AIRPORT_ICAO });
      setExistingVoos(voos);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    }

    // Find unmapped cities
    const cities = {};
    const operators = {};
    const aircraftMap = {};

    for (const f of parsedFlights) {
      if (f.destino_normalizado && !f.destino_icao && !cities[f.destino_normalizado]) {
        cities[f.destino_normalizado] = '';
      }
      if (f.operador_normalizado && !f.operador_icao && !operators[f.operador_normalizado]) {
        operators[f.operador_normalizado] = '';
      }
      if (f.registo && f.pmd_kg) {
        if (!aircraftMap[f.registo]) {
          aircraftMap[f.registo] = { registo: f.registo, pmd_kg: f.pmd_kg };
        }
      }
    }

    setUnmappedCities(cities);
    setUnmappedOperators(operators);

    // Determine new aircraft (not in system)
    const existingRegistos = new Set(
      (await RegistoAeronave.list()).map(a => a.registo?.trim().toUpperCase().replace(/[\s\-_.]/g, ''))
    );
    const newAc = Object.values(aircraftMap)
      .filter(a => !existingRegistos.has(a.registo.replace(/[\s\-_.]/g, '')))
      .map(a => ({ ...a, selected: true }));
    setNewAircraft(newAc);
  };

  // ─── Step 3: Build Preview ──────────────────────────────────────────────

  useEffect(() => {
    if (step === 3) buildPreview();
  }, [step]);

  const buildPreview = () => {
    // Apply user-defined mappings
    const enriched = parsedFlights.map(f => {
      let icao = f.destino_icao;
      if (!icao && f.destino_normalizado && unmappedCities[f.destino_normalizado]) {
        icao = unmappedCities[f.destino_normalizado].toUpperCase().trim();
      }
      let opIcao = f.operador_icao;
      if (!opIcao && f.operador_normalizado && unmappedOperators[f.operador_normalizado]) {
        opIcao = unmappedOperators[f.operador_normalizado].toUpperCase().trim();
      }
      return { ...f, destino_icao_final: icao || f.destino_icao, operador_icao_final: opIcao || f.operador_icao };
    });

    // Count linkable pairs
    const groups = {};
    for (const f of enriched) {
      const key = `${f.callsign}_${f.data_operacao}`;
      if (!groups[key]) groups[key] = { ARR: null, DEP: null };
      if (f.tipo_movimento === 'ARR' && !groups[key].ARR) groups[key].ARR = f;
      if (f.tipo_movimento === 'DEP' && !groups[key].DEP) groups[key].DEP = f;
    }
    const linkablePairs = Object.values(groups).filter(g => g.ARR && g.DEP).length;

    // Duplicate check
    const existingKeys = new Set(
      existingVoos.map(v => `${v.numero_voo}_${v.data_operacao}_${v.tipo_movimento}_${v.aeroporto_operacao}`)
    );
    const duplicateCount = enriched.filter(f =>
      existingKeys.has(`${f.numero_voo}_${f.data_operacao}_${f.tipo_movimento}_${AIRPORT_ICAO}`)
    ).length;

    setPreviewData({
      flights: enriched,
      arrCount: enriched.filter(f => f.tipo_movimento === 'ARR').length,
      depCount: enriched.filter(f => f.tipo_movimento === 'DEP').length,
      linkablePairs,
      newAircraftCount: newAircraft.filter(a => a.selected).length,
      duplicateCount,
    });
  };

  // ─── Step 4: Execute Import ────────────────────────────────────────────

  const executeImport = async () => {
    setExecuting(true);
    setExecutionDone(false);
    setExecutionErrors([]);
    abortRef.current = false;

    const errors = [];
    const addError = (phase, msg) => {
      errors.push({ phase, msg });
      setExecutionErrors([...errors]);
    };

    try {
      const empresaId = effectiveEmpresaId || user?.empresa_id;

      // ── Phase 1: Create aircraft ─────────────────────────────
      const selectedAircraft = newAircraft.filter(a => a.selected);
      setExecutionCounts(c => ({ ...c, aircraftTotal: selectedAircraft.length }));
      setExecutionPhase('Criando aeronaves...');
      setExecutionProgress(0);

      const createdAircraftMap = {};
      for (let i = 0; i < selectedAircraft.length; i++) {
        if (abortRef.current) break;
        const ac = selectedAircraft[i];
        try {
          const created = await RegistoAeronave.create({
            registo: ac.registo,
            mtow_kg: ac.pmd_kg,
            empresa_id: empresaId,
          });
          createdAircraftMap[ac.registo] = created;
          setExecutionCounts(c => ({ ...c, aircraftCreated: c.aircraftCreated + 1 }));
        } catch (err) {
          addError('aeronave', `Erro ao criar ${ac.registo}: ${err.message}`);
        }
        setExecutionProgress(Math.round(((i + 1) / selectedAircraft.length) * 100));
      }

      // Refresh aircraft list after creation
      const allAircraft = await RegistoAeronave.list();
      setExistingAircraft(allAircraft);

      // ── Phase 2: Create Voos ──────────────────────────────────
      const flights = previewData?.flights || [];

      // Check for duplicates
      const freshVoos = await Voo.filter({ aeroporto_operacao: AIRPORT_ICAO });
      const existingKeys = new Set(
        freshVoos.map(v => `${v.numero_voo}_${v.data_operacao}_${v.tipo_movimento}_${v.aeroporto_operacao}`)
      );

      const toCreate = flights.filter(f =>
        !existingKeys.has(`${f.numero_voo}_${f.data_operacao}_${f.tipo_movimento}_${AIRPORT_ICAO}`)
      );
      const duplicateCount = flights.length - toCreate.length;

      setExecutionPhase('Criando voos...');
      setExecutionProgress(0);
      setExecutionCounts(c => ({ ...c, voosTotal: toCreate.length, voosDuplicate: duplicateCount }));

      const createdVoos = []; // { flight, voo }
      for (let i = 0; i < toCreate.length; i += BATCH_SIZE) {
        if (abortRef.current) break;
        const batch = toCreate.slice(i, i + BATCH_SIZE);

        const promises = batch.map(async (f) => {
          try {
            const icaoDest = f.destino_icao_final || f.destino_icao || '';

            const vooData = {
              data_operacao: f.data_operacao,
              tipo_movimento: f.tipo_movimento,
              numero_voo: f.numero_voo,
              registo_aeronave: f.registo,
              aeroporto_operacao: AIRPORT_ICAO,
              aeroporto_origem_destino: icaoDest,
              tipo_voo: 'Regular',
              status: 'Realizado',
              origem_dados: 'AIAAN_IMPORT',
              empresa_id: empresaId,
              // Horarios
              horario_previsto: f.tipo_movimento === 'ARR' ? (f.ata || '') : (f.std || ''),
              horario_real: f.tipo_movimento === 'ARR' ? (f.ata || '') : (f.atd || f.std || ''),
              // Passageiros
              passageiros_local: f.tipo_movimento === 'ARR' ? f.pax_desembarque : f.pax_embarque,
              passageiros_transito_direto: f.pax_transito,
              // Carga
              carga_kg: f.carga_kg,
              // Crew
              crew: f.crew,
              // Stand
              stand: f.stand,
              pista: f.pista,
              // Companhia
              companhia_icao: f.operador_icao_final || f.operador_icao || '',
              // Observacoes
              observacoes: f.obs ? `[AIAAN] ${f.obs}` : '[AIAAN] Importado automaticamente',
            };

            const created = await Voo.create(vooData);
            return { flight: f, voo: created };
          } catch (err) {
            addError('voo', `Erro voo ${f.numero_voo} ${f.tipo_movimento} ${f.data_operacao}: ${err.message}`);
            return null;
          }
        });

        const results = await Promise.all(promises);
        results.forEach(r => { if (r) createdVoos.push(r); });

        setExecutionCounts(c => ({ ...c, voosCreated: createdVoos.length }));
        setExecutionProgress(Math.round(Math.min(100, ((i + BATCH_SIZE) / toCreate.length) * 100)));

        if (i + BATCH_SIZE < toCreate.length) await delay(BATCH_DELAY_MS);
      }

      // ── Phase 3: Link ARR + DEP pairs ──────────────────────────
      setExecutionPhase('Linkando voos...');
      setExecutionProgress(0);

      // Build groups from created voos
      const vooGroups = {};
      for (const { flight, voo } of createdVoos) {
        const key = `${flight.callsign}_${flight.data_operacao}`;
        if (!vooGroups[key]) vooGroups[key] = {};
        if (flight.tipo_movimento === 'ARR' && !vooGroups[key].arr) {
          vooGroups[key].arr = { flight, voo };
        }
        if (flight.tipo_movimento === 'DEP' && !vooGroups[key].dep) {
          vooGroups[key].dep = { flight, voo };
        }
      }

      const linkable = Object.entries(vooGroups).filter(([, g]) => g.arr && g.dep);
      setExecutionCounts(c => ({ ...c, linksTotal: linkable.length }));

      const createdLinks = []; // { vooLigado, arrVoo, depVoo }
      for (let i = 0; i < linkable.length; i++) {
        if (abortRef.current) break;
        const [, group] = linkable[i];
        const arrVoo = group.arr.voo;
        const depVoo = group.dep.voo;
        const arrFlight = group.arr.flight;
        const depFlight = group.dep.flight;

        try {
          // Calculate tempo_permanencia_min from calcos
          let tempoPermanenciaMin = null;
          if (arrFlight.calcos && depFlight.calcos) {
            const [aH, aM] = arrFlight.calcos.split(':').map(Number);
            const [dH, dM] = depFlight.calcos.split(':').map(Number);
            const arrMin = aH * 60 + aM;
            const depMin = dH * 60 + dM;
            tempoPermanenciaMin = depMin >= arrMin ? depMin - arrMin : (depMin + 1440) - arrMin;
          } else if (arrFlight.ata && (depFlight.atd || depFlight.std)) {
            const [aH, aM] = arrFlight.ata.split(':').map(Number);
            const depTime = depFlight.atd || depFlight.std;
            const [dH, dM] = depTime.split(':').map(Number);
            const arrMin = aH * 60 + aM;
            const depMin = dH * 60 + dM;
            tempoPermanenciaMin = depMin >= arrMin ? depMin - arrMin : (depMin + 1440) - arrMin;
          }

          const vooLigado = await VooLigado.create({
            voo_arr_id: arrVoo.id,
            voo_dep_id: depVoo.id,
            data_operacao: arrFlight.data_operacao,
            registo_aeronave: arrFlight.registo,
            numero_voo: arrFlight.callsign,
            aeroporto_operacao: AIRPORT_ICAO,
            tempo_permanencia_min: tempoPermanenciaMin,
            empresa_id: empresaId,
          });

          createdLinks.push({ vooLigado, arrVoo, depVoo });
          setExecutionCounts(c => ({ ...c, linksCreated: c.linksCreated + 1 }));
        } catch (err) {
          addError('link', `Erro link ${arrFlight.callsign} ${arrFlight.data_operacao}: ${err.message}`);
        }
        setExecutionProgress(Math.round(((i + 1) / linkable.length) * 100));
      }

      // ── Phase 4: Calculate tariffs ──────────────────────────────
      setExecutionPhase('Calculando tarifas...');
      setExecutionProgress(0);
      setExecutionCounts(c => ({ ...c, tariffsTotal: createdLinks.length }));

      // Load tariff configuration
      let configuracao = null;
      let impostos = [];
      let aeroportoObj = null;
      try {
        const [aeroportos, aeronavesList, tarifasPouso, tarifasPermanencia, outrasTarifas, impostosList, configList] = await Promise.all([
          Aeroporto.list(),
          RegistoAeronave.list(),
          TarifaPouso.list(),
          TarifaPermanencia.list(),
          OutraTarifa.list(),
          Imposto.list(),
          ConfiguracaoSistema.list(),
        ]);

        // Filter tariffs by empresa
        const filterByEmpresa = (items) => {
          if (!empresaId) return items;
          const empresaItems = items.filter(i => i.empresa_id === empresaId);
          const globalItems = items.filter(i => !i.empresa_id);
          return empresaItems.length > 0 ? empresaItems : globalItems;
        };

        const taxaCambioConfig = configList.find(c => c.chave === 'taxa_cambio');
        const taxaCambio = taxaCambioConfig ? parseFloat(taxaCambioConfig.valor) || 850 : 850;

        aeroportoObj = aeroportos.find(a => a.codigo_icao === AIRPORT_ICAO);

        configuracao = {
          aeroportos,
          aeronaves: aeronavesList,
          tarifasPouso: filterByEmpresa(tarifasPouso),
          tarifasPermanencia: filterByEmpresa(tarifasPermanencia),
          outrasTarifas: filterByEmpresa(outrasTarifas),
          taxaCambio,
        };

        impostos = impostosList;
      } catch (err) {
        addError('config', `Erro ao carregar configuração de tarifas: ${err.message}`);
      }

      if (configuracao && aeroportoObj) {
        for (let i = 0; i < createdLinks.length; i++) {
          if (abortRef.current) break;
          const { vooLigado, arrVoo, depVoo } = createdLinks[i];

          try {
            const results = await calculateAllTariffs(
              vooLigado, arrVoo, depVoo, aeroportoObj, configuracao, impostos
            );

            // Save calculation
            await CalculoTarifa.create({
              ...results,
              empresa_id: empresaId,
              voo_ligado_id: vooLigado.id,
            });

            setExecutionCounts(c => ({ ...c, tariffsCalculated: c.tariffsCalculated + 1 }));
          } catch (err) {
            addError('tarifa', `Tarifa ${vooLigado.numero_voo} ${vooLigado.data_operacao}: ${err.message}`);
            setExecutionCounts(c => ({ ...c, tariffsSkipped: c.tariffsSkipped + 1 }));
          }
          setExecutionProgress(Math.round(((i + 1) / createdLinks.length) * 100));
        }
      } else {
        setExecutionCounts(c => ({ ...c, tariffsSkipped: createdLinks.length }));
      }
    } catch (err) {
      addError('geral', `Erro geral: ${err.message}`);
    }

    setExecutionDone(true);
    setExecuting(false);
  };

  // ─── Render Helpers ────────────────────────────────────────────────────

  const renderStepIndicator = () => {
    const steps = [
      { num: 1, label: t('importacao.step_upload') },
      { num: 2, label: t('importacao.step_mapeamentos') },
      { num: 3, label: t('importacao.step_preview') },
      { num: 4, label: t('importacao.step_execucao') },
    ];

    return (
      <div className="flex items-center justify-center gap-2 mb-6">
        {steps.map((s, idx) => (
          <React.Fragment key={s.num}>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              step === s.num
                ? 'bg-primary text-primary-foreground'
                : step > s.num
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-muted text-muted-foreground'
            }`}>
              {step > s.num ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <span className="w-5 h-5 flex items-center justify-center rounded-full bg-background/20 text-xs">
                  {s.num}
                </span>
              )}
              <span className="hidden sm:inline">{s.label}</span>
            </div>
            {idx < steps.length - 1 && (
              <div className={`w-8 h-0.5 ${step > s.num ? 'bg-green-400' : 'bg-muted'}`} />
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  // ─── Step 1 UI ─────────────────────────────────────────────────────────

  const renderStep1 = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileSpreadsheet className="w-5 h-5" />
          Upload Ficheiro Excel AIAAN
        </CardTitle>
        <CardDescription>
          Selecione o ficheiro Excel exportado do sistema AIAAN com os dados de voos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Drop zone */}
        <div
          className="border-2 border-dashed rounded-lg p-12 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleFileSelect}
          />
          <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg font-medium">
            {file ? file.name : 'Arraste o ficheiro ou clique para selecionar'}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Formatos aceites: .xlsx, .xls
          </p>
        </div>

        {parseError && (
          <div className="flex items-center gap-2 text-destructive bg-destructive/10 rounded-lg p-3">
            <XCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{parseError}</span>
          </div>
        )}

        {parseSummary && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-medium">Ficheiro lido com sucesso!</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <SummaryCard icon={<Plane className="w-4 h-4" />} label="Total Linhas" value={parseSummary.totalRows} />
              <SummaryCard icon={<PlaneLanding className="w-4 h-4" />} label="Chegadas (ARR)" value={parseSummary.arrCount} color="blue" />
              <SummaryCard icon={<PlaneTakeoff className="w-4 h-4" />} label="Partidas (DEP)" value={parseSummary.depCount} color="orange" />
              <SummaryCard icon={<Building2 className="w-4 h-4" />} label="Operadores" value={parseSummary.uniqueOperators} color="purple" />
              <SummaryCard icon={<MapPin className="w-4 h-4" />} label="Destinos" value={parseSummary.uniqueDestinations} color="green" />
              <SummaryCard
                icon={<FileSpreadsheet className="w-4 h-4" />}
                label="Periodo"
                value={parseSummary.dateRange}
                small
              />
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button
            onClick={() => setStep(2)}
            disabled={!parseSummary}
          >
            {t('btn.next')}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // ─── Step 2 UI ─────────────────────────────────────────────────────────

  const renderStep2 = () => {
    const unmappedCityKeys = Object.keys(unmappedCities);
    const unmappedOpKeys = Object.keys(unmappedOperators);

    return (
      <div className="space-y-4">
        {/* Unmapped cities */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="w-5 h-5 text-blue-500" />
              Cidades sem Mapeamento ICAO
              <Badge variant={unmappedCityKeys.length > 0 ? 'destructive' : 'secondary'}>
                {unmappedCityKeys.length}
              </Badge>
            </CardTitle>
            <CardDescription>
              Estas cidades/destinos nao foram encontrados no mapeamento. Insira o codigo ICAO do aeroporto correspondente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {unmappedCityKeys.length === 0 ? (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Todas as cidades foram mapeadas automaticamente.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {unmappedCityKeys.map(city => (
                  <div key={city} className="flex items-center gap-2">
                    <Label className="min-w-[140px] text-sm truncate" title={city}>{city}</Label>
                    <Input
                      placeholder="ICAO (ex: FNLU)"
                      className="w-28 uppercase"
                      maxLength={4}
                      value={unmappedCities[city]}
                      onChange={e => setUnmappedCities(prev => ({ ...prev, [city]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Unmapped operators */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="w-5 h-5 text-purple-500" />
              Operadores sem Mapeamento
              <Badge variant={unmappedOpKeys.length > 0 ? 'destructive' : 'secondary'}>
                {unmappedOpKeys.length}
              </Badge>
            </CardTitle>
            <CardDescription>
              Estes operadores nao foram encontrados no mapeamento. Insira o codigo ICAO/IATA da companhia.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {unmappedOpKeys.length === 0 ? (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Todos os operadores foram mapeados automaticamente.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {unmappedOpKeys.map(op => (
                  <div key={op} className="flex items-center gap-2">
                    <Label className="min-w-[140px] text-sm truncate" title={op}>{op}</Label>
                    <Input
                      placeholder="ICAO (ex: DT)"
                      className="w-24 uppercase"
                      maxLength={4}
                      value={unmappedOperators[op]}
                      onChange={e => setUnmappedOperators(prev => ({ ...prev, [op]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* New aircraft */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plane className="w-5 h-5 text-orange-500" />
              Novas Aeronaves a Criar
              <Badge variant={newAircraft.length > 0 ? 'outline' : 'secondary'}>
                {newAircraft.filter(a => a.selected).length} / {newAircraft.length}
              </Badge>
            </CardTitle>
            <CardDescription>
              Aeronaves que nao existem no sistema. Selecione as que deseja criar automaticamente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {newAircraft.length === 0 ? (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Todas as aeronaves ja estao registadas no sistema.
              </p>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2 mb-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setNewAircraft(prev => prev.map(a => ({ ...a, selected: true })))}
                  >
                    Selecionar Todas
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setNewAircraft(prev => prev.map(a => ({ ...a, selected: false })))}
                  >
                    Desselecionar Todas
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[300px] overflow-y-auto">
                  {newAircraft.map((ac, idx) => (
                    <label
                      key={ac.registo}
                      className={`flex items-center gap-3 p-2 rounded-md border cursor-pointer transition-colors ${
                        ac.selected ? 'border-primary bg-primary/5' : 'border-muted'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={ac.selected}
                        onChange={e => {
                          setNewAircraft(prev => {
                            const next = [...prev];
                            next[idx] = { ...next[idx], selected: e.target.checked };
                            return next;
                          });
                        }}
                        className="rounded"
                      />
                      <span className="font-mono text-sm font-medium">{ac.registo}</span>
                      <span className="text-xs text-muted-foreground">
                        PMD: {ac.pmd_kg ? `${(ac.pmd_kg / 1000).toFixed(1)}t` : 'N/A'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setStep(1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('btn.back')}
          </Button>
          <Button onClick={() => setStep(3)}>
            {t('btn.next')}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  };

  // ─── Step 3 UI ─────────────────────────────────────────────────────────

  const renderStep3 = () => {
    if (!previewData) return (
      <Card>
        <CardContent className="p-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          <p>Analisando dados...</p>
        </CardContent>
      </Card>
    );

    const visibleFlights = showAllPreview
      ? previewData.flights
      : previewData.flights.slice(0, 20);

    return (
      <div className="space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <SummaryCard icon={<PlaneLanding className="w-4 h-4" />} label="Chegadas (ARR)" value={previewData.arrCount} color="blue" />
          <SummaryCard icon={<PlaneTakeoff className="w-4 h-4" />} label="Partidas (DEP)" value={previewData.depCount} color="orange" />
          <SummaryCard icon={<Link2 className="w-4 h-4" />} label="Pares Linkáveis" value={previewData.linkablePairs} color="green" />
          <SummaryCard icon={<Plane className="w-4 h-4" />} label="Novas Aeronaves" value={previewData.newAircraftCount} color="purple" />
          <SummaryCard
            icon={<AlertTriangle className="w-4 h-4" />}
            label="Duplicados"
            value={previewData.duplicateCount}
            color={previewData.duplicateCount > 0 ? 'yellow' : 'green'}
          />
        </div>

        {previewData.duplicateCount > 0 && (
          <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 text-sm">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span>
              {previewData.duplicateCount} voo(s) ja existe(m) no sistema e serao ignorados durante a importacao.
            </span>
          </div>
        )}

        {/* Preview table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Pre-visualizacao ({showAllPreview ? previewData.flights.length : `primeiros ${Math.min(20, previewData.flights.length)}`} de {previewData.flights.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-2 font-medium">Data</th>
                    <th className="text-left p-2 font-medium">Tipo</th>
                    <th className="text-left p-2 font-medium">Call Sign</th>
                    <th className="text-left p-2 font-medium">Registo</th>
                    <th className="text-left p-2 font-medium">Operador</th>
                    <th className="text-left p-2 font-medium">Destino/Origem</th>
                    <th className="text-left p-2 font-medium">ICAO</th>
                    <th className="text-right p-2 font-medium">PMD (t)</th>
                    <th className="text-right p-2 font-medium">Pax</th>
                    <th className="text-left p-2 font-medium">Horario</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleFlights.map((f, idx) => (
                    <tr key={idx} className="border-b hover:bg-muted/30">
                      <td className="p-2 whitespace-nowrap">{f.data_operacao}</td>
                      <td className="p-2">
                        <Badge variant={f.tipo_movimento === 'ARR' ? 'default' : 'secondary'} className="text-xs">
                          {f.tipo_movimento}
                        </Badge>
                      </td>
                      <td className="p-2 font-mono">{f.callsign}</td>
                      <td className="p-2 font-mono">{f.registo}</td>
                      <td className="p-2 truncate max-w-[120px]" title={f.operador_raw}>{f.operador_raw}</td>
                      <td className="p-2 truncate max-w-[120px]" title={f.destino_raw}>{f.destino_raw}</td>
                      <td className="p-2 font-mono">
                        {f.destino_icao_final || f.destino_icao ? (
                          <span className="text-green-600 dark:text-green-400">{f.destino_icao_final || f.destino_icao}</span>
                        ) : (
                          <span className="text-red-500">?</span>
                        )}
                      </td>
                      <td className="p-2 text-right">{f.pmd_kg ? (f.pmd_kg / 1000).toFixed(1) : '-'}</td>
                      <td className="p-2 text-right">
                        {f.tipo_movimento === 'ARR' ? f.pax_desembarque : f.pax_embarque}
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        {f.tipo_movimento === 'ARR' ? f.ata : (f.atd || f.std)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {previewData.flights.length > 20 && (
              <div className="mt-3 text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllPreview(!showAllPreview)}
                >
                  {showAllPreview ? (
                    <><ChevronUp className="w-4 h-4 mr-1" /> Mostrar menos</>
                  ) : (
                    <><ChevronDown className="w-4 h-4 mr-1" /> Mostrar todos ({previewData.flights.length})</>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setStep(2)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <Button
            onClick={() => { setStep(4); executeImport(); }}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Iniciar Importacao
          </Button>
        </div>
      </div>
    );
  };

  // ─── Step 4 UI ─────────────────────────────────────────────────────────

  const renderStep4 = () => {
    const phases = [
      { key: 'aircraft', label: 'Aeronaves Criadas', done: executionCounts.aircraftCreated, total: executionCounts.aircraftTotal },
      { key: 'voos', label: 'Voos Criados', done: executionCounts.voosCreated, total: executionCounts.voosTotal },
      { key: 'links', label: 'Voos Ligados', done: executionCounts.linksCreated, total: executionCounts.linksTotal },
      { key: 'tariffs', label: 'Tarifas Calculadas', done: executionCounts.tariffsCalculated, total: executionCounts.tariffsTotal },
    ];

    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              {executing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : executionDone ? (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              ) : null}
              {executing ? executionPhase : executionDone ? 'Importacao Concluida!' : 'A preparar...'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Overall progress */}
            {executing && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{executionPhase}</span>
                  <span>{executionProgress}%</span>
                </div>
                <Progress value={executionProgress} className="h-3" />
              </div>
            )}

            {/* Phase counters */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {phases.map(p => (
                <div key={p.key} className="border rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">{p.label}</p>
                  <p className="text-2xl font-bold">
                    {p.done}
                    <span className="text-sm text-muted-foreground font-normal"> / {p.total}</span>
                  </p>
                </div>
              ))}
            </div>

            {/* Duplicates skipped */}
            {executionCounts.voosDuplicate > 0 && (
              <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 text-sm">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <span>{executionCounts.voosDuplicate} voo(s) duplicado(s) ignorado(s).</span>
              </div>
            )}

            {/* Tariffs skipped */}
            {executionCounts.tariffsSkipped > 0 && (
              <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 text-sm">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <span>{executionCounts.tariffsSkipped} calculo(s) de tarifa ignorado(s) (ver erros abaixo).</span>
              </div>
            )}

            {/* Errors */}
            {executionErrors.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-destructive flex items-center gap-2">
                  <XCircle className="w-4 h-4" />
                  {executionErrors.length} erro(s) durante a importacao
                </p>
                <div className="max-h-[200px] overflow-y-auto border rounded-lg p-2 space-y-1 bg-destructive/5">
                  {executionErrors.map((err, idx) => (
                    <div key={idx} className="text-xs flex gap-2">
                      <Badge variant="outline" className="text-xs flex-shrink-0">{err.phase}</Badge>
                      <span className="text-destructive">{err.msg}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Final report */}
            {executionDone && (
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-sm">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Importacao finalizada com sucesso!</p>
                  <p className="mt-1">
                    {executionCounts.voosCreated} voos criados,{' '}
                    {executionCounts.linksCreated} pares ligados,{' '}
                    {executionCounts.tariffsCalculated} tarifas calculadas.
                    {executionErrors.length > 0 && ` ${executionErrors.length} erro(s).`}
                  </p>
                </div>
              </div>
            )}

            {/* Actions */}
            {executionDone && (
              <div className="flex gap-3 justify-center pt-2">
                <Button variant="outline" onClick={() => window.location.href = createPageUrl('Operacoes')}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar as Operacoes
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setStep(1);
                    setFile(null);
                    setRawRows([]);
                    setParsedFlights([]);
                    setParseSummary(null);
                    setParseError(null);
                    setPreviewData(null);
                    setExecutionDone(false);
                    setExecutionErrors([]);
                    setExecutionCounts({
                      aircraftCreated: 0, aircraftTotal: 0,
                      voosCreated: 0, voosTotal: 0, voosDuplicate: 0,
                      linksCreated: 0, linksTotal: 0,
                      tariffsCalculated: 0, tariffsTotal: 0, tariffsSkipped: 0,
                    });
                  }}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Nova Importacao
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  // ─── Main Render ───────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6" />
            {t('importacao.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('importacao.subtitle')}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => window.location.href = createPageUrl('Operacoes')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('btn.back')}
        </Button>
      </div>

      {renderStepIndicator()}

      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
      {step === 4 && renderStep4()}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────

function SummaryCard({ icon, label, value, color = 'default', small = false }) {
  const colorClasses = {
    default: 'bg-card border',
    blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    orange: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
    green: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    purple: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
  };

  return (
    <div className={`rounded-lg border p-3 ${colorClasses[color] || colorClasses.default}`}>
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className={`font-bold ${small ? 'text-xs' : 'text-xl'}`}>{value}</p>
    </div>
  );
}
