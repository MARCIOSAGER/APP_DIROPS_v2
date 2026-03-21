import React, { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Loader2, Search, AlertCircle, Plane, Database, CheckCircle,
  XCircle, AlertTriangle, Download, Eye, EyeOff, Clock, ArrowRightLeft,
  PlusCircle, Ban, RefreshCw, Save
} from 'lucide-react';
import { CacheVooFR24 } from '@/entities/CacheVooFR24';
import { Voo } from '@/entities/Voo';
import { VooLigado } from '@/entities/VooLigado';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';

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
      from: current.toISOString(),
      to: blockEnd.toISOString(),
    });
    current = new Date(blockEnd.getTime() + 1000);
  }
  return blocks;
}

// ─── Alert Component ────────────────────────────────────────

function AlertBanner({ alert, onDismiss }) {
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

export default function TesteFlightradar24() {
  const { currentUser } = useAuth();

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
  const [creatingIds, setCreatingIds] = useState(new Set());
  const [bulkCreating, setBulkCreating] = useState(false);

  // Tab 2: API
  const [apiLoading, setApiLoading] = useState(false);
  const [apiResults, setApiResults] = useState([]);
  const [apiProgress, setApiProgress] = useState('');
  const [savingCache, setSavingCache] = useState(false);
  const abortRef = useRef(false);

  // Tab 3: Comparison
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareData, setCompareData] = useState([]);
  const [compareStats, setCompareStats] = useState(null);
  const [comparingIds, setComparingIds] = useState(new Set());

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
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
  // TAB 1: CACHE FR24
  // ═══════════════════════════════════════════════════════════

  const loadCache = useCallback(async () => {
    setCacheLoading(true);
    setAlert(null);
    try {
      const filters = { airport_icao: airportIcao };
      if (startDate) filters.data_voo = { $gte: startDate };
      if (endDate) filters.data_voo = { ...filters.data_voo, $lte: endDate };
      if (cacheStatusFilter !== 'todos') filters.status = cacheStatusFilter;

      const data = await CacheVooFR24.filter(filters, '-data_voo');
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

  // Create a single voo from FR24 cache entry
  const createVooFromCache = useCallback(async (cachedFlight) => {
    const raw = cachedFlight.raw_data || {};
    const isArr = isArrival(raw, airportIcao);
    const empresaId = currentUser?.empresa_id;
    if (!empresaId) {
      showAlert('error', 'Utilizador sem empresa_id.');
      return;
    }

    setCreatingIds(prev => new Set([...prev, cachedFlight.id]));
    try {
      // Lookup companhia IATA
      const companhiaCode = await lookupCompanhiaIata(raw.operating_as);

      const vooData = {
        numero_voo: raw.flight || cachedFlight.numero_voo,
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
      await CacheVooFR24.update(cachedFlight.id, { status: 'importado' });

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
      await CacheVooFR24.update(cachedFlight.id, { status: 'ignorado' });
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

  // Bulk create all pending
  const createAllPending = useCallback(async () => {
    const pending = cachedFlights.filter(f => f.status === 'pendente');
    if (pending.length === 0) {
      showAlert('error', 'Nenhum voo pendente para criar.');
      return;
    }
    setBulkCreating(true);
    let created = 0;
    let errors = 0;
    for (const flight of pending) {
      try {
        await createVooFromCache(flight);
        created++;
      } catch {
        errors++;
      }
    }
    setBulkCreating(false);
    showAlert('success', `Criados: ${created}, Erros: ${errors}`);
  }, [cachedFlights, createVooFromCache]);

  // ═══════════════════════════════════════════════════════════
  // TAB 2: BUSCAR API FR24
  // ═══════════════════════════════════════════════════════════

  const fetchFR24API = useCallback(async () => {
    setApiLoading(true);
    setApiResults([]);
    setAlert(null);
    abortRef.current = false;

    const SUPABASE_URL = 'https://glernwcsuwcyzwsnelad.supabase.co';
    const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsZXJud2NzdXdjeXp3c25lbGFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc2NDI5MjAsImV4cCI6MjA1MzIxODkyMH0.oGFHKO65MKXFhqHLkRND_7oc7nnWQ4xjqMlzfIh_N7g';

    try {
      const blocks = splitInto6hBlocks(startDate, endDate);
      const allResults = [];
      let errors = 0;

      for (let i = 0; i < blocks.length; i++) {
        if (abortRef.current) break;
        setApiProgress(`Buscando bloco ${i + 1}/${blocks.length}...`);

        const session = (await supabase.auth.getSession()).data.session;
        const response = await fetch(`${SUPABASE_URL}/functions/v1/fr24-proxy`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token || ANON_KEY}`,
            'apikey': ANON_KEY,
          },
          body: JSON.stringify({ airportIcao, dateFrom: blocks[i].from, dateTo: blocks[i].to }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.flights) {
            data.flights.forEach(f => {
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
          }
        } else {
          errors++;
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
        const existing = await CacheVooFR24.findOne({ fr24_id: flight.fr24_id });
        if (existing) {
          // Update raw_data
          await CacheVooFR24.update(existing.id, {
            raw_data: flight.raw_data,
            data_voo: flight.data_voo,
            numero_voo: flight.numero_voo,
          });
          skipped++;
        } else {
          await CacheVooFR24.create({
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

    const empresaId = currentUser?.empresa_id;
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
      const cacheData = await CacheVooFR24.filter(cacheFilters, '-data_voo');

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
        const fr24Reg = normalizeReg(raw.reg);

        let status;
        let atoReg = '';

        if (atoVoo) {
          atoReg = normalizeReg(atoVoo.registo_aeronave);
          if (fr24Reg === atoReg) {
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
          fr24Reg,
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
      await Voo.update(row.atoVooId, { registo_aeronave: row.fr24Reg });
      setCompareData(prev => prev.map(r =>
        r.id === row.id ? { ...r, compareStatus: 'OK', atoReg: row.fr24Reg } : r
      ));
      setCompareStats(prev => prev ? {
        ...prev,
        matchOk: prev.matchOk + 1,
        regDiff: prev.regDiff - 1,
      } : prev);
      showAlert('success', `Registo do voo atualizado para ${row.fr24Reg}.`);
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

  const pendingCount = cachedFlights.filter(f => f.status === 'pendente').length;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
        <Plane className="w-6 h-6 text-sky-500" />
        Flightradar24 — Gestão de Voos
      </h1>

      <AlertBanner alert={alert} onDismiss={() => setAlert(null)} />

      <Tabs defaultValue="cache">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="cache" className="text-xs sm:text-sm">
            <Database className="w-4 h-4 mr-1.5" />
            Cache FR24
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
            }
          />

          {cacheStats && (
            <StatsCards items={[
              {
                bg: 'bg-sky-50 border-sky-200',
                icon: <Database className="w-5 h-5 text-sky-600 mx-auto mb-1" />,
                value: cacheStats.total,
                textColor: 'text-sky-700',
                label: 'Total',
                labelColor: 'text-sky-600',
              },
              {
                bg: 'bg-green-50 border-green-200',
                icon: <CheckCircle className="w-5 h-5 text-green-600 mx-auto mb-1" />,
                value: cacheStats.importados,
                textColor: 'text-green-700',
                label: 'Importados',
                labelColor: 'text-green-600',
              },
              {
                bg: 'bg-yellow-50 border-yellow-200',
                icon: <Clock className="w-5 h-5 text-yellow-600 mx-auto mb-1" />,
                value: cacheStats.pendentes,
                textColor: 'text-yellow-700',
                label: 'Pendentes',
                labelColor: 'text-yellow-600',
              },
              {
                bg: 'bg-slate-50 border-slate-200',
                icon: <EyeOff className="w-5 h-5 text-slate-500 mx-auto mb-1" />,
                value: cacheStats.ignorados,
                textColor: 'text-slate-700',
                label: 'Ignorados',
                labelColor: 'text-slate-500',
              },
            ]} />
          )}

          {pendingCount > 0 && (
            <div className="flex justify-end">
              <Button
                onClick={createAllPending}
                disabled={bulkCreating}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {bulkCreating
                  ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  : <PlusCircle className="w-4 h-4 mr-2" />}
                Criar Todos Pendentes ({pendingCount})
              </Button>
            </div>
          )}

          {cachedFlights.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Voos em Cache ({cachedFlights.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <FlightTable
                  flights={cachedFlights}
                  airportIcao={airportIcao}
                  showActions={true}
                  onCreateVoo={createVooFromCache}
                  onIgnore={ignoreCachedFlight}
                  creatingIds={creatingIds}
                />
              </CardContent>
            </Card>
          )}

          {!cacheLoading && cachedFlights.length === 0 && !alert && (
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
            onSearch={fetchFR24API}
            loading={apiLoading}
            buttonLabel="Buscar FR24 API"
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
                  <CardTitle className="text-base">Resultados API FR24 ({apiResults.length})</CardTitle>
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
                <p>Configure os filtros e clique "Buscar FR24 API"</p>
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

          {compareStats && (
            <StatsCards items={[
              {
                bg: 'bg-sky-50 border-sky-200',
                icon: <Database className="w-5 h-5 text-sky-600 mx-auto mb-1" />,
                value: compareStats.total,
                textColor: 'text-sky-700',
                label: 'Total FR24',
                labelColor: 'text-sky-600',
              },
              {
                bg: 'bg-green-50 border-green-200',
                icon: <CheckCircle className="w-5 h-5 text-green-600 mx-auto mb-1" />,
                value: compareStats.matchOk,
                textColor: 'text-green-700',
                label: 'Match OK',
                labelColor: 'text-green-600',
              },
              {
                bg: 'bg-red-50 border-red-200',
                icon: <XCircle className="w-5 h-5 text-red-600 mx-auto mb-1" />,
                value: compareStats.falta,
                textColor: 'text-red-700',
                label: 'Em Falta no ATO',
                labelColor: 'text-red-600',
              },
              {
                bg: 'bg-amber-50 border-amber-200',
                icon: <AlertTriangle className="w-5 h-5 text-amber-600 mx-auto mb-1" />,
                value: compareStats.regDiff,
                textColor: 'text-amber-700',
                label: 'Registo Diferente',
                labelColor: 'text-amber-600',
              },
            ]} />
          )}

          {compareData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Comparação FR24 vs ATO ({compareData.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="border-b bg-slate-50">
                      <tr>
                        <th className="text-left p-2 font-medium">Voo</th>
                        <th className="text-left p-2 font-medium">Data</th>
                        <th className="text-left p-2 font-medium">Tipo</th>
                        <th className="text-left p-2 font-medium">Reg FR24</th>
                        <th className="text-left p-2 font-medium">Reg ATO</th>
                        <th className="text-left p-2 font-medium">Status</th>
                        <th className="text-left p-2 font-medium">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {compareData.map((row, idx) => {
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
                            <td className="p-2 font-mono">{row.fr24Reg || '\u2014'}</td>
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
