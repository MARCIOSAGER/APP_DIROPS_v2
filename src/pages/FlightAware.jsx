import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Loader2, Search, AlertCircle, Plane, Database, CheckCircle,
  XCircle, AlertTriangle, Download, Eye, EyeOff, Clock, ArrowRightLeft,
  PlusCircle, Ban, RefreshCw, Save
} from 'lucide-react';
import { CacheVooFlightAware } from '@/entities/CacheVooFlightAware';
import { Voo } from '@/entities/Voo';
import { VooLigado } from '@/entities/VooLigado';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useCompanyView } from '@/lib/CompanyViewContext';

// ─── Helpers ────────────────────────────────────────────────

function extractHHMM(isoStr) {
  if (!isoStr) return '';
  return isoStr.substring(11, 16);
}

function isArrival(raw, airportIcao) {
  return (raw.dest_icao_actual === airportIcao || raw.dest_icao === airportIcao);
}

function normalizeReg(reg) {
  return (reg || '').replace(/-/g, '').toUpperCase().trim();
}

function statusBadge(status) {
  const map = {
    pendente:  'bg-yellow-100 text-yellow-800',
    importado: 'bg-green-100 text-green-800',
    ignorado:  'bg-slate-200 text-slate-600',
  };
  return map[status] || 'bg-slate-100 text-slate-600';
}

function tipoBadge(isArr) {
  return isArr
    ? 'bg-green-100 text-green-800'
    : 'bg-blue-100 text-blue-800';
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function splitInto6hBlocks(startDate, endDate) {
  const blocks = [];
  let current = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T23:59:59Z');
  while (current < end) {
    const blockEnd = new Date(Math.min(current.getTime() + 6 * 3600 * 1000, end.getTime()));
    blocks.push({
      from: current.toISOString().replace('.000Z', 'Z').replace('Z', ''),
      to: blockEnd.toISOString().replace('.000Z', 'Z').replace('Z', ''),
    });
    current = new Date(blockEnd.getTime() + 1000);
  }
  return blocks;
}

// ─── Alert Component ────────────────────────────────────────

function AlertBanner({ alert, onDismiss }) {
  useEffect(() => {
    if (!alert) return;
    const timer = setTimeout(() => onDismiss(), 5000);
    return () => clearTimeout(timer);
  }, [alert, onDismiss]);

  if (!alert) return null;
  const isError = alert.type === 'error';
  return (
    <Card className={`border ${isError ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
      <CardContent className="pt-3 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isError
            ? <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
            : <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />}
          <p className={`text-sm ${isError ? 'text-red-700' : 'text-green-700'}`}>{alert.message}</p>
        </div>
        <button onClick={onDismiss} className="text-slate-400 hover:text-slate-600 text-lg leading-none">&times;</button>
      </CardContent>
    </Card>
  );
}

// ─── Stats Cards ────────────────────────────────────────────

function StatsCards({ items }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map((item, i) => (
        <Card key={i} className={item.bg}>
          <CardContent className="pt-4 pb-4 text-center">
            {item.icon}
            <p className={`text-2xl font-bold ${item.textColor}`}>{item.value}</p>
            <p className={`text-xs ${item.labelColor}`}>{item.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Flight Table ───────────────────────────────────────────

function FlightTable({ flights, airportIcao, showActions, onCreateVoo, onIgnore, creatingIds }) {
  if (!flights || flights.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="border-b bg-slate-50">
          <tr>
            <th className="text-left p-2 font-medium">Voo</th>
            <th className="text-left p-2 font-medium">Data</th>
            <th className="text-left p-2 font-medium">Tipo</th>
            <th className="text-left p-2 font-medium">Registo</th>
            <th className="text-left p-2 font-medium">Aeronave</th>
            <th className="text-left p-2 font-medium">Companhia</th>
            <th className="text-left p-2 font-medium">Origem</th>
            <th className="text-left p-2 font-medium">Destino</th>
            <th className="text-left p-2 font-medium">Decolagem</th>
            <th className="text-left p-2 font-medium">Aterragem</th>
            <th className="text-left p-2 font-medium">Status</th>
            {showActions && <th className="text-left p-2 font-medium">Ações</th>}
          </tr>
        </thead>
        <tbody>
          {flights.map((f, idx) => {
            const raw = f.raw_data || {};
            const isArr = isArrival(raw, airportIcao);
            const creating = creatingIds?.has(f.id || f.fr24_id);
            return (
              <tr key={f.id || f.fr24_id || idx} className="border-b hover:bg-slate-50">
                <td className="p-2 font-medium">{f.numero_voo || raw.flight || '\u2014'}</td>
                <td className="p-2">{f.data_voo}</td>
                <td className="p-2">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${tipoBadge(isArr)}`}>
                    {isArr ? 'ARR' : 'DEP'}
                  </span>
                </td>
                <td className="p-2 font-mono">{normalizeReg(raw.reg)}</td>
                <td className="p-2">{raw.type || '\u2014'}</td>
                <td className="p-2">{raw.operating_as || raw.painted_as || '\u2014'}</td>
                <td className="p-2">{raw.orig_icao || '\u2014'}</td>
                <td className="p-2">{raw.dest_icao_actual || raw.dest_icao || '\u2014'}</td>
                <td className="p-2">{extractHHMM(raw.datetime_takeoff) || '\u2014'}</td>
                <td className="p-2">{extractHHMM(raw.datetime_landed) || '\u2014'}</td>
                <td className="p-2">
                  <span className={`px-1.5 py-0.5 rounded text-xs ${statusBadge(f.status)}`}>
                    {f.status || 'novo'}
                  </span>
                </td>
                {showActions && (
                  <td className="p-2">
                    {f.status === 'pendente' && (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          className="h-6 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => onCreateVoo(f)}
                          disabled={creating}
                        >
                          {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : <PlusCircle className="w-3 h-3 mr-1" />}
                          Criar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-xs"
                          onClick={() => onIgnore(f)}
                          disabled={creating}
                        >
                          <Ban className="w-3 h-3 mr-1" />
                          Ignorar
                        </Button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────

export default function FlightAwarePage() {
  const { currentUser } = useAuth();
  const { effectiveEmpresaId } = useCompanyView();

  // Shared filters
  const [airportIcao, setAirportIcao] = useState('FNBJ');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  // Alert
  const [alert, setAlert] = useState(null);
  const showAlert = (type, message) => setAlert({ type, message });

  // Tab 1: Cache
  const [cacheLoading, setCacheLoading] = useState(false);
  const [cachedFlights, setCachedFlights] = useState([]);
  const [cacheStats, setCacheStats] = useState(null);
  const [cacheStatusFilter, setCacheStatusFilter] = useState('todos');
  const [cacheCompanhiaFilter, setCacheCompanhiaFilter] = useState('todas');
  const [creatingIds, setCreatingIds] = useState(new Set());
  const [bulkCreating, setBulkCreating] = useState(false);
  const [verifyingPending, setVerifyingPending] = useState(false);

  // Tab 2: API
  const [apiLoading, setApiLoading] = useState(false);
  const [apiResults, setApiResults] = useState([]);
  const [apiProgress, setApiProgress] = useState('');
  const [savingCache, setSavingCache] = useState(false);
  const abortRef = useRef(false);

  // Tab 3: Comparison
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareData, setCompareData] = useState([]);
  const [compareStatusFilter, setCompareStatusFilter] = useState(null);
  const [compareStats, setCompareStats] = useState(null);
  const [comparingIds, setComparingIds] = useState(new Set());

  // Filtered comparison data
  const filteredCompareData = useMemo(() => {
    if (!compareStatusFilter) return compareData;
    return compareData.filter(r => r.compareStatus === compareStatusFilter);
  }, [compareData, compareStatusFilter]);

  // Companhia cache
  const companhiaCacheRef = useRef(null);

  async function getCompanhias() {
    if (companhiaCacheRef.current) return companhiaCacheRef.current;
    const { data } = await supabase.from('companhia_aerea').select('*');
    companhiaCacheRef.current = data || [];
    return companhiaCacheRef.current;
  }

  async function lookupCompanhiaIata(icaoCode) {
    if (!icaoCode) return '';
    const companhias = await getCompanhias();
    const found = companhias.find(c => c.codigo_icao === icaoCode);
    return found?.codigo_iata || found?.codigo_icao || icaoCode;
  }

  // ─── Shared Filters UI ─────────────────────────────────────

  function FiltersBar({ onSearch, loading, extraFilters, buttonLabel = 'Buscar', buttonIcon: BtnIcon = Search }) {
    return (
      <Card>
        <CardContent className="pt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Aeroporto (ICAO)</label>
              <Input
                value={airportIcao}
                onChange={(e) => setAirportIcao(e.target.value.toUpperCase())}
                placeholder="FNBJ"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Data Início</label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Data Fim</label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            {extraFilters}
            <div className="flex items-end">
              <Button onClick={onSearch} disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BtnIcon className="w-4 h-4 mr-2" />}
                {buttonLabel}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // TAB 1: CACHE FLIGHTAWARE
  // ═══════════════════════════════════════════════════════════

  const loadCache = useCallback(async () => {
    setCacheLoading(true);
    setAlert(null);
    setCacheCompanhiaFilter('todas');
    try {
      const filters = { airport_icao: airportIcao };
      if (startDate) filters.data_voo = { $gte: startDate };
      if (endDate) filters.data_voo = { ...filters.data_voo, $lte: endDate };
      if (cacheStatusFilter !== 'todos') filters.status = cacheStatusFilter;

      const data = await CacheVooFlightAware.filter(filters, '-data_voo');
      setCachedFlights(data);

      // Stats
      const total = data.length;
      const importados = data.filter(f => f.status === 'importado').length;
      const pendentes = data.filter(f => f.status === 'pendente').length;
      const ignorados = data.filter(f => f.status === 'ignorado').length;
      setCacheStats({ total, importados, pendentes, ignorados });
    } catch (err) {
      showAlert('error', `Erro ao carregar cache: ${err.message}`);
    } finally {
      setCacheLoading(false);
    }
  }, [airportIcao, startDate, endDate, cacheStatusFilter]);

  // Create a single voo from FlightAware cache entry
  const createVooFromCache = useCallback(async (cachedFlight) => {
    const raw = cachedFlight.raw_data || {};
    const isArr = isArrival(raw, airportIcao);
    const empresaId = effectiveEmpresaId || currentUser?.empresa_id;
    if (!empresaId) {
      showAlert('error', 'Utilizador sem empresa_id.');
      return;
    }

    setCreatingIds(prev => new Set([...prev, cachedFlight.id]));
    try {
      // Check if voo already exists
      const tipo = isArr ? 'ARR' : 'DEP';
      const { data: existing } = await supabase.from('voo')
        .select('id')
        .eq('numero_voo', raw.flight || cachedFlight.numero_voo || normalizeReg(raw.reg) || raw.callsign)
        .eq('data_operacao', cachedFlight.data_voo)
        .eq('tipo_movimento', tipo)
        .eq('empresa_id', empresaId)
        .is('deleted_at', null)
        .limit(1);
      if (existing && existing.length > 0) {
        // Already exists - just update cache status
        await CacheVooFlightAware.update(cachedFlight.id, { status: 'importado' });
        setCachedFlights(prev => prev.map(f => f.id === cachedFlight.id ? { ...f, status: 'importado' } : f));
        showAlert('success', `Voo ${raw.flight} já existe no ATO. Cache atualizado.`);
        return;
      }

      // Check 2: Is there already a LINKED pair in ATO for this registo + date?
      // International airlines (TAP, Air France, etc.) may use different registos for ARR/DEP
      // of the same turnaround. If the counterpart is already linked, skip this flight.
      const regNormCheck = normalizeReg(raw.reg);
      if (regNormCheck) {
        const pairTipoCheck = isArr ? 'DEP' : 'ARR';
        const { data: regMatches } = await supabase.from('voo')
          .select('id, voo_ligado_id')
          .eq('empresa_id', empresaId)
          .eq('aeroporto_operacao', airportIcao)
          .eq('tipo_movimento', pairTipoCheck)
          .eq('data_operacao', cachedFlight.data_voo)
          .eq('registo_aeronave', regNormCheck)
          .is('deleted_at', null)
          .not('voo_ligado_id', 'is', null)
          .limit(1);

        if (regMatches && regMatches.length > 0) {
          // Counterpart with same registo already exists AND is linked - this turnaround is handled
          await CacheVooFlightAware.update(cachedFlight.id, { status: 'importado' });
          setCachedFlights(prev => prev.map(f => f.id === cachedFlight.id ? { ...f, status: 'importado' } : f));
          setCacheStats(prev => prev ? {
            ...prev,
            importados: prev.importados + 1,
            pendentes: prev.pendentes - 1,
          } : prev);
          showAlert('success', `Voo ${raw.flight || regNormCheck} — turnaround já vinculado no ATO. Cache atualizado.`);
          return;
        }
      }

      // Lookup companhia IATA
      const companhiaCode = await lookupCompanhiaIata(raw.operating_as);

      const vooData = {
        numero_voo: raw.flight || cachedFlight.numero_voo || normalizeReg(raw.reg) || raw.callsign,
        tipo_movimento: isArr ? 'ARR' : 'DEP',
        data_operacao: cachedFlight.data_voo,
        companhia_aerea: companhiaCode,
        registo_aeronave: normalizeReg(raw.reg),
        aeroporto_operacao: airportIcao,
        aeroporto_origem_destino: isArr
          ? (raw.orig_icao || '')
          : (raw.dest_icao_actual || raw.dest_icao || ''),
        horario_previsto: isArr
          ? extractHHMM(raw.datetime_landed)
          : extractHHMM(raw.datetime_takeoff),
        horario_real: isArr
          ? extractHHMM(raw.datetime_landed)
          : extractHHMM(raw.datetime_takeoff),
        status: 'Realizado',
        tipo_voo: 'Regular',
        empresa_id: empresaId,
      };

      const newVoo = await Voo.create(vooData);

      // Try to link: find matching pair (ARR<->DEP) with same registo
      let linked = false;
      const pairTipo = isArr ? 'DEP' : 'ARR';
      const regNorm = normalizeReg(raw.reg);

      const { data: candidates } = await supabase
        .from('voo')
        .select('id, tipo_movimento, registo_aeronave, data_operacao, horario_real, horario_previsto, voo_ligado_id')
        .eq('empresa_id', empresaId)
        .eq('aeroporto_operacao', airportIcao)
        .eq('tipo_movimento', pairTipo)
        .eq('data_operacao', cachedFlight.data_voo)
        .is('deleted_at', null)
        .is('voo_ligado_id', null);

      const match = (candidates || []).find(c => normalizeReg(c.registo_aeronave) === regNorm);

      if (match) {
        const arrId = isArr ? newVoo.id : match.id;
        const depId = isArr ? match.id : newVoo.id;

        const arrVoo = isArr ? newVoo : match;
        const depVoo = isArr ? match : newVoo;

        const arrTime = new Date(`${arrVoo.data_operacao}T${arrVoo.horario_real || arrVoo.horario_previsto}`);
        const depTime = new Date(`${depVoo.data_operacao}T${depVoo.horario_real || depVoo.horario_previsto}`);
        const tempoPermanenciaMin = Math.round((depTime.getTime() - arrTime.getTime()) / (1000 * 60));

        const vooLigado = await VooLigado.create({
          id_voo_arr: arrId,
          id_voo_dep: depId,
          tempo_permanencia_min: tempoPermanenciaMin > 0 ? tempoPermanenciaMin : 0,
          empresa_id: empresaId,
        });

        // Update voos with voo_ligado_id
        await Promise.all([
          Voo.update(arrId, { voo_ligado_id: vooLigado.id }),
          Voo.update(depId, { voo_ligado_id: vooLigado.id }),
        ]);

        // Calculate tariff
        try {
          await supabase.rpc('calculate_tariff', { p_voo_ligado_id: vooLigado.id });
        } catch (tariffErr) {
          console.warn('Tariff calculation failed (non-critical):', tariffErr);
        }
        linked = true;
      }

      // Update cache status
      await CacheVooFlightAware.update(cachedFlight.id, { status: 'importado' });

      // Update local state
      setCachedFlights(prev => prev.map(f =>
        f.id === cachedFlight.id ? { ...f, status: 'importado' } : f
      ));
      setCacheStats(prev => prev ? {
        ...prev,
        importados: prev.importados + 1,
        pendentes: prev.pendentes - 1,
      } : prev);

      showAlert('success', `Voo ${vooData.numero_voo} criado${linked ? ' e vinculado' : ''} com sucesso.`);
    } catch (err) {
      showAlert('error', `Erro ao criar voo: ${err.message}`);
    } finally {
      setCreatingIds(prev => {
        const next = new Set(prev);
        next.delete(cachedFlight.id);
        return next;
      });
    }
  }, [airportIcao, currentUser]);

  // Ignore a cached flight
  const ignoreCachedFlight = useCallback(async (cachedFlight) => {
    try {
      await CacheVooFlightAware.update(cachedFlight.id, { status: 'ignorado' });
      setCachedFlights(prev => prev.map(f =>
        f.id === cachedFlight.id ? { ...f, status: 'ignorado' } : f
      ));
      setCacheStats(prev => prev ? {
        ...prev,
        ignorados: prev.ignorados + 1,
        pendentes: prev.pendentes - 1,
      } : prev);
      showAlert('success', `Voo ${cachedFlight.numero_voo} marcado como ignorado.`);
    } catch (err) {
      showAlert('error', `Erro ao ignorar: ${err.message}`);
    }
  }, []);

  // Bulk create all pending (ARR first so DEP can link)
  const createAllPending = useCallback(async () => {
    const pending = cachedFlights.filter(f => f.status === 'pendente');
    if (pending.length === 0) {
      showAlert('error', 'Nenhum voo pendente para criar.');
      return;
    }

    // Sort: ARR first, then DEP
    const sorted = [...pending].sort((a, b) => {
      const aIsArr = isArrival(a.raw_data || {}, airportIcao) ? 0 : 1;
      const bIsArr = isArrival(b.raw_data || {}, airportIcao) ? 0 : 1;
      return aIsArr - bIsArr;
    });

    setBulkCreating(true);
    let created = 0;
    let skipped = 0;
    let errors = 0;
    for (const flight of sorted) {
      try {
        const current = cachedFlights.find(f => f.id === flight.id);
        if (current && current.status !== 'pendente') {
          skipped++;
          continue;
        }
        await createVooFromCache(flight);
        created++;
      } catch {
        errors++;
      }
    }
    setBulkCreating(false);
    showAlert('success', `Criados: ${created}${skipped ? ', Já tratados: ' + skipped : ''}${errors ? ', Erros: ' + errors : ''}`);
  }, [cachedFlights, createVooFromCache, airportIcao]);

  // Verify pending: mark as "importado" flights that already exist or have linked turnaround in ATO
  const verifyPending = useCallback(async () => {
    const empresaId = effectiveEmpresaId || currentUser?.empresa_id;
    if (!empresaId) {
      showAlert('error', 'Utilizador sem empresa_id.');
      return;
    }
    const pending = cachedFlights.filter(f => f.status === 'pendente');
    if (pending.length === 0) {
      showAlert('error', 'Nenhum voo pendente para verificar.');
      return;
    }

    setVerifyingPending(true);
    let markedImported = 0;

    try {
      // Load all ATO voos for the date range
      const { data: voos } = await supabase
        .from('voo')
        .select('id, numero_voo, data_operacao, tipo_movimento, registo_aeronave, voo_ligado_id')
        .eq('empresa_id', empresaId)
        .eq('aeroporto_operacao', airportIcao)
        .is('deleted_at', null)
        .gte('data_operacao', startDate)
        .lte('data_operacao', endDate);

      const atoVoos = voos || [];

      for (const flight of pending) {
        const raw = flight.raw_data || {};
        const flightIsArr = isArrival(raw, airportIcao);
        const tipo = flightIsArr ? 'ARR' : 'DEP';
        const flightNum = (raw.flight || flight.numero_voo || '').toUpperCase();
        const regNorm = normalizeReg(raw.reg);

        // Check 1: exact match (same flight number + date + type)
        const exactMatch = atoVoos.find(v =>
          (v.numero_voo || '').toUpperCase() === flightNum &&
          v.data_operacao === flight.data_voo &&
          v.tipo_movimento === tipo
        );
        if (exactMatch) {
          await CacheVooFlightAware.update(flight.id, { status: 'importado' });
          setCachedFlights(prev => prev.map(f => f.id === flight.id ? { ...f, status: 'importado' } : f));
          markedImported++;
          continue;
        }

        // Check 2: counterpart with same registo already linked in ATO
        if (regNorm) {
          const pairTipo = flightIsArr ? 'DEP' : 'ARR';
          const linkedCounterpart = atoVoos.find(v =>
            normalizeReg(v.registo_aeronave) === regNorm &&
            v.data_operacao === flight.data_voo &&
            v.tipo_movimento === pairTipo &&
            v.voo_ligado_id != null
          );
          if (linkedCounterpart) {
            await CacheVooFlightAware.update(flight.id, { status: 'importado' });
            setCachedFlights(prev => prev.map(f => f.id === flight.id ? { ...f, status: 'importado' } : f));
            markedImported++;
            continue;
          }
        }
      }

      // Update stats
      if (markedImported > 0) {
        setCacheStats(prev => prev ? {
          ...prev,
          importados: prev.importados + markedImported,
          pendentes: prev.pendentes - markedImported,
        } : prev);
      }

      showAlert('success', `Verificação concluída: ${markedImported} pendentes marcados como importados, ${pending.length - markedImported} continuam pendentes.`);
    } catch (err) {
      showAlert('error', `Erro ao verificar pendentes: ${err.message}`);
    } finally {
      setVerifyingPending(false);
    }
  }, [cachedFlights, airportIcao, startDate, endDate, currentUser, effectiveEmpresaId]);

  // ═══════════════════════════════════════════════════════════
  // TAB 2: BUSCAR API FLIGHTAWARE
  // ═══════════════════════════════════════════════════════════

  const fetchFlightAwareAPI = useCallback(async () => {
    setApiLoading(true);
    setApiResults([]);
    setAlert(null);
    abortRef.current = false;

    try {
      // Check last sync to avoid re-fetching
      const syncKey = `FR24_LAST_SYNC_${airportIcao}`;
      const { data: lastSyncData } = await supabase.from('api_config').select('valor').eq('chave', syncKey).single();
      const lastSync = lastSyncData?.valor;

      let effectiveStartDate = startDate;
      let customStartDatetime = null;
      if (lastSync) {
        // Use datetime from last sync (not just date)
        const lastSyncDt = lastSync.replace('+00', 'Z').replace(' ', 'T');
        const lastSyncDate = lastSync.substring(0, 10);
        if (lastSyncDate >= startDate) {
          effectiveStartDate = lastSyncDate;
          customStartDatetime = lastSyncDt.substring(0, 19); // YYYY-MM-DDTHH:MM:SS
          showAlert('success', `Última sincronização: ${lastSync.substring(0, 19)}. Buscando apenas a partir daí.`);
          await new Promise(r => setTimeout(r, 2000));
          setAlert(null);
        }
      }

      // Build blocks - if we have a custom datetime start, modify the first block
      const blocks = splitInto6hBlocks(effectiveStartDate, endDate);
      if (customStartDatetime && blocks.length > 0) {
        blocks[0].from = customStartDatetime;
      }
      const allResults = [];
      let errors = 0;

      for (let i = 0; i < blocks.length; i++) {
        if (abortRef.current) break;
        setApiProgress(`Buscando bloco ${i + 1}/${blocks.length}...`);

        const { data: rpcResult, error: rpcError } = await supabase.rpc('fetch_fr24', {
          p_airport: airportIcao,
          p_date_from: blocks[i].from,
          p_date_to: blocks[i].to,
        });

        const faFlights = rpcResult?.data || [];
        if (!rpcError && faFlights.length > 0) {
          faFlights.forEach(f => {
            const landedDate = f.datetime_landed ? f.datetime_landed.substring(0, 10) : (f.datetime_takeoff ? f.datetime_takeoff.substring(0, 10) : startDate);
            allResults.push({
              fr24_id: f.fr24_id,
              numero_voo: f.flight || f.callsign || '',
              data_voo: landedDate,
              airport_icao: airportIcao,
              status: 'pendente',
              raw_data: f,
            });
          });
          // Auto-save to cache
          if (faFlights.length > 0) {
            const records = faFlights.map(f => ({
              data_voo: (f.datetime_landed || f.datetime_takeoff || '').substring(0, 10) || startDate,
              numero_voo: f.flight || '',
              fr24_id: f.fr24_id,
              airport_icao: airportIcao,
              status: 'pendente',
              raw_data: f,
              data_expiracao: new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0],
            }));
            await supabase.from('cache_voo_f_r24').upsert(records, { onConflict: 'fr24_id', ignoreDuplicates: true });
          }
        } else {
          errors++;
          console.error(`FlightAware block ${i+1}:`, rpcError, rpcResult?.error);
        }

        // Rate limit: wait 7s between calls
        if (i < blocks.length - 1 && !abortRef.current) {
          for (let s = 7; s > 0; s--) {
            if (abortRef.current) break;
            setApiProgress(`Bloco ${i + 1}/${blocks.length} OK (${allResults.length} voos). Aguardando ${s}s...`);
            await new Promise(r => setTimeout(r, 1000));
          }
        }
      }

      // Deduplicate
      const seen = new Set();
      const deduped = allResults.filter(r => {
        if (seen.has(r.fr24_id)) return false;
        seen.add(r.fr24_id);
        return true;
      });

      setApiResults(deduped);
      setApiProgress('');

      // Update last sync timestamp
      await supabase.from('api_config').upsert({ chave: syncKey, valor: new Date().toISOString(), descricao: `Ultima sincronizacao FlightAware para ${airportIcao}` }, { onConflict: 'chave' });

      showAlert('success', `${deduped.length} voos encontrados em ${blocks.length} blocos. ${errors ? errors + ' erros.' : ''} Dados salvos no cache.`);
    } catch (err) {
      showAlert('error', `Erro: ${err.message}`);
      setApiProgress('');
    } finally {
      setApiLoading(false);
    }
  }, [airportIcao, startDate, endDate]);

  const saveToCache = useCallback(async () => {
    if (apiResults.length === 0) return;
    setSavingCache(true);
    setAlert(null);
    let saved = 0;
    let skipped = 0;

    try {
      for (const flight of apiResults) {
        // Check if fr24_id already exists
        const existing = await CacheVooFlightAware.findOne({ fr24_id: flight.fr24_id });
        if (existing) {
          // Update raw_data
          await CacheVooFlightAware.update(existing.id, {
            raw_data: flight.raw_data,
            data_voo: flight.data_voo,
            numero_voo: flight.numero_voo,
          });
          skipped++;
        } else {
          await CacheVooFlightAware.create({
            fr24_id: flight.fr24_id,
            numero_voo: flight.numero_voo,
            data_voo: flight.data_voo,
            airport_icao: flight.airport_icao,
            status: 'pendente',
            raw_data: flight.raw_data,
            data_expiracao: new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString().split('T')[0],
          });
          saved++;
        }
      }
      showAlert('success', `Cache atualizado: ${saved} novos, ${skipped} atualizados.`);
    } catch (err) {
      showAlert('error', `Erro ao salvar cache: ${err.message}`);
    } finally {
      setSavingCache(false);
    }
  }, [apiResults]);

  // ═══════════════════════════════════════════════════════════
  // TAB 3: COMPARAÇÃO
  // ═══════════════════════════════════════════════════════════

  const runComparison = useCallback(async () => {
    setCompareLoading(true);
    setAlert(null);
    setCompareData([]);
    setCompareStats(null);

    const empresaId = effectiveEmpresaId || currentUser?.empresa_id;
    if (!empresaId) {
      showAlert('error', 'Utilizador sem empresa_id.');
      setCompareLoading(false);
      return;
    }

    try {
      // Load cache
      const cacheFilters = { airport_icao: airportIcao };
      if (startDate) cacheFilters.data_voo = { $gte: startDate };
      if (endDate) cacheFilters.data_voo = { ...cacheFilters.data_voo, $lte: endDate };
      const cacheData = await CacheVooFlightAware.filter(cacheFilters, '-data_voo');

      // Load voos ATO
      const { data: voos } = await supabase
        .from('voo')
        .select('id, numero_voo, data_operacao, tipo_movimento, registo_aeronave, aeroporto_operacao')
        .eq('empresa_id', empresaId)
        .eq('aeroporto_operacao', airportIcao)
        .is('deleted_at', null)
        .gte('data_operacao', startDate)
        .lte('data_operacao', endDate);

      // Build voo map: key = numero_voo + data + tipo
      const vooMap = new Map();
      (voos || []).forEach(v => {
        const key = `${(v.numero_voo || '').toUpperCase()}_${v.data_operacao}_${v.tipo_movimento}`;
        vooMap.set(key, v);
      });

      // Compare
      let matchOk = 0;
      let falta = 0;
      let regDiff = 0;
      const rows = [];

      cacheData.forEach(f => {
        const raw = f.raw_data || {};
        const isArr = isArrival(raw, airportIcao);
        const tipo = isArr ? 'ARR' : 'DEP';
        const flightNum = (raw.flight || f.numero_voo || '').toUpperCase();
        const key = `${flightNum}_${f.data_voo}_${tipo}`;
        const atoVoo = vooMap.get(key);
        const faReg = normalizeReg(raw.reg);

        let status;
        let atoReg = '';

        if (atoVoo) {
          atoReg = normalizeReg(atoVoo.registo_aeronave);
          if (faReg === atoReg) {
            status = 'OK';
            matchOk++;
          } else {
            status = 'REG_DIFF';
            regDiff++;
          }
        } else {
          status = 'FALTA';
          falta++;
        }

        rows.push({
          ...f,
          tipo,
          faReg,
          atoReg,
          atoVooId: atoVoo?.id,
          compareStatus: status,
        });
      });

      setCompareData(rows);
      setCompareStats({
        total: cacheData.length,
        matchOk,
        falta,
        regDiff,
      });
    } catch (err) {
      showAlert('error', `Erro na comparação: ${err.message}`);
    } finally {
      setCompareLoading(false);
    }
  }, [airportIcao, startDate, endDate, currentUser]);

  // Create voo from comparison FALTA row
  const createVooFromCompare = useCallback(async (row) => {
    setComparingIds(prev => new Set([...prev, row.id]));
    try {
      await createVooFromCache(row);
      // Update comparison row
      setCompareData(prev => prev.map(r =>
        r.id === row.id ? { ...r, compareStatus: 'OK' } : r
      ));
      setCompareStats(prev => prev ? {
        ...prev,
        matchOk: prev.matchOk + 1,
        falta: prev.falta - 1,
      } : prev);
    } finally {
      setComparingIds(prev => {
        const next = new Set(prev);
        next.delete(row.id);
        return next;
      });
    }
  }, [createVooFromCache]);

  // Fix registo from comparison REG_DIFF row
  const fixRegisto = useCallback(async (row) => {
    if (!row.atoVooId) return;
    setComparingIds(prev => new Set([...prev, row.id]));
    try {
      await Voo.update(row.atoVooId, { registo_aeronave: row.faReg });
      setCompareData(prev => prev.map(r =>
        r.id === row.id ? { ...r, compareStatus: 'OK', atoReg: row.faReg } : r
      ));
      setCompareStats(prev => prev ? {
        ...prev,
        matchOk: prev.matchOk + 1,
        regDiff: prev.regDiff - 1,
      } : prev);
      showAlert('success', `Registo do voo atualizado para ${row.faReg}.`);
    } catch (err) {
      showAlert('error', `Erro ao corrigir registo: ${err.message}`);
    } finally {
      setComparingIds(prev => {
        const next = new Set(prev);
        next.delete(row.id);
        return next;
      });
    }
  }, []);

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════

  // Unique companhias from cached flights
  const uniqueCompanhias = useMemo(() => {
    const set = new Set();
    cachedFlights.forEach(f => {
      const comp = f.raw_data?.operating_as;
      if (comp) set.add(comp);
    });
    return [...set].sort();
  }, [cachedFlights]);

  // Filtered cached flights (by companhia)
  const filteredCachedFlights = useMemo(() => {
    if (cacheCompanhiaFilter === 'todas') return cachedFlights;
    return cachedFlights.filter(f => (f.raw_data?.operating_as || '') === cacheCompanhiaFilter);
  }, [cachedFlights, cacheCompanhiaFilter]);

  // Stats based on filtered flights
  const filteredCacheStats = useMemo(() => {
    if (!cacheStats) return null;
    if (cacheCompanhiaFilter === 'todas') return cacheStats;
    const list = filteredCachedFlights;
    return {
      total: list.length,
      importados: list.filter(f => f.status === 'importado').length,
      pendentes: list.filter(f => f.status === 'pendente').length,
      ignorados: list.filter(f => f.status === 'ignorado').length,
    };
  }, [cacheStats, filteredCachedFlights, cacheCompanhiaFilter]);

  const pendingCount = filteredCachedFlights.filter(f => f.status === 'pendente').length;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
        <Plane className="w-6 h-6 text-sky-500" />
        FlightAware — Gestão de Voos
      </h1>

      <AlertBanner alert={alert} onDismiss={() => setAlert(null)} />

      <Tabs defaultValue="cache">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="cache" className="text-xs sm:text-sm">
            <Database className="w-4 h-4 mr-1.5" />
            Cache FlightAware
          </TabsTrigger>
          <TabsTrigger value="api" className="text-xs sm:text-sm">
            <Search className="w-4 h-4 mr-1.5" />
            Buscar API
          </TabsTrigger>
          <TabsTrigger value="compare" className="text-xs sm:text-sm">
            <ArrowRightLeft className="w-4 h-4 mr-1.5" />
            Comparação
          </TabsTrigger>
        </TabsList>

        {/* ═══ TAB 1: CACHE ═══ */}
        <TabsContent value="cache" className="space-y-4">
          <FiltersBar
            onSearch={loadCache}
            loading={cacheLoading}
            buttonLabel="Buscar Cache"
            extraFilters={
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                  <select
                    value={cacheStatusFilter}
                    onChange={(e) => setCacheStatusFilter(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="todos">Todos</option>
                    <option value="pendente">Pendente</option>
                    <option value="importado">Importado</option>
                    <option value="ignorado">Ignorado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Companhia</label>
                  <select
                    value={cacheCompanhiaFilter}
                    onChange={(e) => setCacheCompanhiaFilter(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="todas">Todas</option>
                    {uniqueCompanhias.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </>
            }
          />

          {filteredCacheStats && (
            <StatsCards items={[
              {
                bg: 'bg-sky-50 border-sky-200',
                icon: <Database className="w-5 h-5 text-sky-600 mx-auto mb-1" />,
                value: filteredCacheStats.total,
                textColor: 'text-sky-700',
                label: 'Total',
                labelColor: 'text-sky-600',
              },
              {
                bg: 'bg-green-50 border-green-200',
                icon: <CheckCircle className="w-5 h-5 text-green-600 mx-auto mb-1" />,
                value: filteredCacheStats.importados,
                textColor: 'text-green-700',
                label: 'Importados',
                labelColor: 'text-green-600',
              },
              {
                bg: 'bg-yellow-50 border-yellow-200',
                icon: <Clock className="w-5 h-5 text-yellow-600 mx-auto mb-1" />,
                value: filteredCacheStats.pendentes,
                textColor: 'text-yellow-700',
                label: 'Pendentes',
                labelColor: 'text-yellow-600',
              },
              {
                bg: 'bg-slate-50 border-slate-200',
                icon: <EyeOff className="w-5 h-5 text-slate-500 mx-auto mb-1" />,
                value: filteredCacheStats.ignorados,
                textColor: 'text-slate-700',
                label: 'Ignorados',
                labelColor: 'text-slate-500',
              },
            ]} />
          )}

          <div className="flex flex-wrap justify-end gap-2">
            {pendingCount > 0 && (
              <>
                <Button
                  onClick={verifyPending}
                  disabled={verifyingPending || bulkCreating}
                  variant="outline"
                  className="border-amber-300 text-amber-700 hover:bg-amber-50"
                >
                  {verifyingPending
                    ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    : <Eye className="w-4 h-4 mr-2" />}
                  Verificar Pendentes ({pendingCount})
                </Button>
                <Button
                  onClick={createAllPending}
                  disabled={bulkCreating || verifyingPending}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {bulkCreating
                    ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    : <PlusCircle className="w-4 h-4 mr-2" />}
                  Criar Todos Pendentes ({pendingCount})
                </Button>
              </>
            )}
            <Button
              onClick={async () => {
                const empId = effectiveEmpresaId || currentUser?.empresa_id;
                if (!empId) { showAlert('error', 'Sem empresa_id'); return; }
                showAlert('success', 'Linkando e calculando...');
                const { data, error } = await supabase.rpc('link_and_calculate_pending', { p_empresa_id: empId });
                if (error) { showAlert('error', error.message); return; }
                showAlert('success', `Linkados: ${data?.linked || 0}, Tarifas calculadas: ${data?.calculated || 0}`);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <ArrowRightLeft className="w-4 h-4 mr-2" />
              Linkar & Calcular Tarifas
            </Button>
            <Button
              onClick={async () => {
                const empId = effectiveEmpresaId || currentUser?.empresa_id;
                if (!empId) { showAlert('error', 'Sem empresa_id'); return; }
                showAlert('success', 'Sincronizando registos e companhias...');
                const { data, error } = await supabase.rpc('sync_fr24_registos', { p_empresa_id: empId });
                if (error) { showAlert('error', error.message); return; }
                showAlert('success', `Registos criados: ${data?.registos_created || 0}, Companhias criadas: ${data?.companhias_created || 0}, Registos atualizados: ${data?.registos_updated || 0}`);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Sincronizar Registos & Companhias
            </Button>
          </div>

          {filteredCachedFlights.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Voos em Cache ({filteredCachedFlights.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <FlightTable
                  flights={filteredCachedFlights}
                  airportIcao={airportIcao}
                  showActions={true}
                  onCreateVoo={createVooFromCache}
                  onIgnore={ignoreCachedFlight}
                  creatingIds={creatingIds}
                />
              </CardContent>
            </Card>
          )}

          {!cacheLoading && filteredCachedFlights.length === 0 && !alert && (
            <Card className="bg-slate-50 border-dashed">
              <CardContent className="pt-8 pb-8 text-center text-slate-500">
                <Database className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                <p>Selecione o período e clique "Buscar Cache"</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══ TAB 2: BUSCAR API ═══ */}
        <TabsContent value="api" className="space-y-4">
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-3 pb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <p className="text-xs text-amber-700">
                Plano Explorer: max 20 resultados por query, 10 req/min, 30 dias de histórico.
                Intervalos maiores que 1 dia são divididos em blocos de 6h.
              </p>
            </CardContent>
          </Card>

          <FiltersBar
            onSearch={fetchFlightAwareAPI}
            loading={apiLoading}
            buttonLabel="Buscar FlightAware API"
            buttonIcon={Download}
          />

          {apiProgress && (
            <Card className="border-sky-200 bg-sky-50">
              <CardContent className="pt-3 pb-3 flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-sky-600 animate-spin flex-shrink-0" />
                <p className="text-sm text-sky-700">{apiProgress}</p>
              </CardContent>
            </Card>
          )}

          {apiResults.length > 0 && (
            <>
              <div className="flex justify-between items-center">
                <p className="text-sm text-slate-600">{apiResults.length} voos encontrados</p>
                <Button
                  onClick={saveToCache}
                  disabled={savingCache}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {savingCache
                    ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    : <Save className="w-4 h-4 mr-2" />}
                  Salvar no Cache
                </Button>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Resultados API FlightAware ({apiResults.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <FlightTable
                    flights={apiResults}
                    airportIcao={airportIcao}
                    showActions={false}
                  />
                </CardContent>
              </Card>
            </>
          )}

          {!apiLoading && apiResults.length === 0 && !apiProgress && (
            <Card className="bg-slate-50 border-dashed">
              <CardContent className="pt-8 pb-8 text-center text-slate-500">
                <Download className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                <p>Configure os filtros e clique "Buscar FlightAware API"</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══ TAB 3: COMPARAÇÃO ═══ */}
        <TabsContent value="compare" className="space-y-4">
          <FiltersBar
            onSearch={runComparison}
            loading={compareLoading}
            buttonLabel="Comparar"
            buttonIcon={ArrowRightLeft}
          />

          {compareStats && (() => {
            const filterOptions = [
              { key: null, bg: 'bg-sky-50 border-sky-200', icon: <Database className="w-5 h-5 text-sky-600 mx-auto mb-1" />, value: compareStats.total, textColor: 'text-sky-700', label: 'Total FlightAware', labelColor: 'text-sky-600' },
              { key: 'OK', bg: 'bg-green-50 border-green-200', icon: <CheckCircle className="w-5 h-5 text-green-600 mx-auto mb-1" />, value: compareStats.matchOk, textColor: 'text-green-700', label: 'Match OK', labelColor: 'text-green-600' },
              { key: 'FALTA', bg: 'bg-red-50 border-red-200', icon: <XCircle className="w-5 h-5 text-red-600 mx-auto mb-1" />, value: compareStats.falta, textColor: 'text-red-700', label: 'Em Falta no ATO', labelColor: 'text-red-600' },
              { key: 'REG_DIFF', bg: 'bg-amber-50 border-amber-200', icon: <AlertTriangle className="w-5 h-5 text-amber-600 mx-auto mb-1" />, value: compareStats.regDiff, textColor: 'text-amber-700', label: 'Registo Diferente', labelColor: 'text-amber-600' },
            ];
            return (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {filterOptions.map((item, i) => (
                  <Card key={i}
                    className={`${item.bg} cursor-pointer transition-all ${compareStatusFilter === item.key ? 'ring-2 ring-offset-1 ring-blue-500 scale-105' : 'hover:scale-102'}`}
                    onClick={() => setCompareStatusFilter(compareStatusFilter === item.key ? null : item.key)}
                  >
                    <CardContent className="pt-4 pb-4 text-center">
                      {item.icon}
                      <p className={`text-2xl font-bold ${item.textColor}`}>{item.value}</p>
                      <p className={`text-xs ${item.labelColor}`}>{item.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            );
          })()}

          {compareData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  Comparação FlightAware vs ATO ({filteredCompareData.length}{compareStatusFilter ? ` — ${compareStatusFilter}` : ''})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="border-b bg-slate-50">
                      <tr>
                        <th className="text-left p-2 font-medium">Voo</th>
                        <th className="text-left p-2 font-medium">Data</th>
                        <th className="text-left p-2 font-medium">Tipo</th>
                        <th className="text-left p-2 font-medium">Reg FA</th>
                        <th className="text-left p-2 font-medium">Reg ATO</th>
                        <th className="text-left p-2 font-medium">Status</th>
                        <th className="text-left p-2 font-medium">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCompareData.map((row, idx) => {
                        const statusColors = {
                          OK: 'bg-green-100 text-green-800',
                          FALTA: 'bg-red-100 text-red-800',
                          REG_DIFF: 'bg-amber-100 text-amber-800',
                        };
                        const rowBg = {
                          OK: '',
                          FALTA: 'bg-red-50/50',
                          REG_DIFF: 'bg-amber-50/50',
                        };
                        const working = comparingIds.has(row.id);
                        return (
                          <tr key={row.id || idx} className={`border-b hover:bg-slate-50 ${rowBg[row.compareStatus] || ''}`}>
                            <td className="p-2 font-medium">{row.numero_voo || row.raw_data?.flight || '\u2014'}</td>
                            <td className="p-2">{row.data_voo}</td>
                            <td className="p-2">
                              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${tipoBadge(row.tipo === 'ARR')}`}>
                                {row.tipo}
                              </span>
                            </td>
                            <td className="p-2 font-mono">{row.faReg || '\u2014'}</td>
                            <td className="p-2 font-mono">{row.atoReg || '\u2014'}</td>
                            <td className="p-2">
                              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${statusColors[row.compareStatus] || ''}`}>
                                {row.compareStatus}
                              </span>
                            </td>
                            <td className="p-2">
                              {row.compareStatus === 'FALTA' && (
                                <Button
                                  size="sm"
                                  className="h-6 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                                  onClick={() => createVooFromCompare(row)}
                                  disabled={working}
                                >
                                  {working ? <Loader2 className="w-3 h-3 animate-spin" /> : <PlusCircle className="w-3 h-3 mr-1" />}
                                  Criar Voo
                                </Button>
                              )}
                              {row.compareStatus === 'REG_DIFF' && (
                                <Button
                                  size="sm"
                                  className="h-6 text-xs bg-amber-600 hover:bg-amber-700"
                                  onClick={() => fixRegisto(row)}
                                  disabled={working}
                                >
                                  {working ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                                  Corrigir Registo
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {!compareLoading && compareData.length === 0 && !alert && (
            <Card className="bg-slate-50 border-dashed">
              <CardContent className="pt-8 pb-8 text-center text-slate-500">
                <ArrowRightLeft className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                <p>Selecione o período e clique "Comparar"</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
