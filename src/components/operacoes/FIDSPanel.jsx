import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useI18n } from '@/components/lib/i18n';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Plane, PlaneLanding, PlaneTakeoff, Clock, AlertCircle, Monitor } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AeroportoMultiSelect from '@/components/ui/aeroporto-multi-select';
import { getFlightAwareFIDS } from '@/functions/getFlightAwareFlights';
import { format } from 'date-fns';

const AUTO_REFRESH_INTERVAL = 3 * 60 * 1000; // 3 minutes

// FIDS status color mapping
function getStatusInfo(flight) {
  const status = (flight.status || '').toLowerCase();
  const cancelled = flight.cancelled;
  const diverted = flight.diverted;
  const progress = flight.progress_percent;

  if (cancelled) return { label: 'Cancelado', color: 'bg-red-600 text-white', textColor: 'text-red-600' };
  if (diverted) return { label: 'Desviado', color: 'bg-orange-500 text-white', textColor: 'text-orange-500' };
  if (status.includes('arrived') || status === 'arrived') return { label: 'Aterrou', color: 'bg-green-600 text-white', textColor: 'text-green-600' };
  if (status.includes('en route') || (progress && progress > 0 && progress < 100)) return { label: 'Em Voo', color: 'bg-blue-600 text-white', textColor: 'text-blue-500' };
  if (status.includes('estimated')) return { label: 'Estimado', color: 'bg-yellow-500 text-white', textColor: 'text-yellow-600' };
  if (status.includes('scheduled') || status.includes('filed')) return { label: 'Agendado', color: 'bg-slate-500 text-white', textColor: 'text-slate-500' };
  if (status.includes('unknown')) return { label: 'Desconhecido', color: 'bg-slate-400 text-white', textColor: 'text-slate-400' };
  return { label: flight.status || '—', color: 'bg-slate-500 text-white', textColor: 'text-slate-500' };
}

function formatTime(isoStr) {
  if (!isoStr) return '—';
  try {
    return format(new Date(isoStr), 'HH:mm');
  } catch {
    return '—';
  }
}

function formatDate(isoStr) {
  if (!isoStr) return '';
  try {
    return format(new Date(isoStr), 'dd/MM');
  } catch {
    return '';
  }
}

function formatDelay(seconds) {
  if (!seconds || seconds === 0) return null;
  const mins = Math.round(seconds / 60);
  if (Math.abs(mins) < 2) return null;
  if (mins > 0) return `+${mins}min`;
  return `${mins}min`;
}

// Single FIDS row
function FIDSRow({ flight, type }) {
  const statusInfo = getStatusInfo(flight);
  const delay = type === 'ARR'
    ? formatDelay(flight.arrival_delay)
    : formatDelay(flight.departure_delay);

  const scheduledTime = type === 'ARR'
    ? flight.datetime_scheduled_landed
    : flight.datetime_scheduled_takeoff;
  const estimatedTime = type === 'ARR'
    ? (flight.datetime_estimated_landed || flight.datetime_landed)
    : (flight.datetime_estimated_takeoff || flight.datetime_takeoff);
  const actualTime = type === 'ARR'
    ? flight.datetime_landed
    : flight.datetime_takeoff;

  const airport = type === 'ARR'
    ? { icao: flight.orig_icao, iata: flight.orig_iata, city: flight.orig_city, name: flight.orig_name }
    : { icao: flight.dest_icao, iata: flight.dest_iata, city: flight.dest_city, name: flight.dest_name };

  const isDelayed = delay && delay.startsWith('+');

  return (
    <tr className="border-b border-slate-700/50 hover:bg-slate-800/50 transition-colors">
      {/* Time */}
      <td className="px-3 py-2.5 whitespace-nowrap">
        <div className="text-lg font-mono font-bold text-white">
          {formatTime(scheduledTime || estimatedTime)}
        </div>
        <div className="text-[10px] text-slate-400">{formatDate(scheduledTime || estimatedTime)}</div>
      </td>
      {/* Flight */}
      <td className="px-3 py-2.5 whitespace-nowrap">
        <div className="text-sm font-bold text-yellow-400">{flight.flight || flight.callsign || '—'}</div>
        {flight.flight_number && flight.flight !== flight.flight_number && (
          <div className="text-[10px] text-slate-400">{flight.flight_number}</div>
        )}
      </td>
      {/* Airline */}
      <td className="px-3 py-2.5 whitespace-nowrap hidden sm:table-cell">
        <div className="text-sm text-slate-200">{flight.operating_as || flight.operator_iata || '—'}</div>
      </td>
      {/* Origin/Destination */}
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold text-white">{airport.icao || airport.iata || '—'}</span>
          {airport.iata && airport.icao && (
            <span className="text-[10px] text-slate-400">({airport.iata})</span>
          )}
        </div>
        {airport.city && (
          <div className="text-[10px] text-slate-400 truncate max-w-[140px]">{airport.city}</div>
        )}
      </td>
      {/* Aircraft */}
      <td className="px-3 py-2.5 whitespace-nowrap hidden md:table-cell">
        <div className="text-sm text-slate-300">{flight.type || '—'}</div>
        {flight.reg && <div className="text-[10px] text-slate-400">{flight.reg}</div>}
      </td>
      {/* Gate/Terminal */}
      <td className="px-3 py-2.5 whitespace-nowrap hidden lg:table-cell text-center">
        <div className="text-sm text-slate-200">
          {(type === 'ARR' ? flight.gate_destination : flight.gate_origin) || '—'}
        </div>
        {(type === 'ARR' ? flight.terminal_destination : flight.terminal_origin) && (
          <div className="text-[10px] text-slate-400">
            T{type === 'ARR' ? flight.terminal_destination : flight.terminal_origin}
          </div>
        )}
      </td>
      {/* Estimated/Actual */}
      <td className="px-3 py-2.5 whitespace-nowrap text-center">
        {actualTime && flight.flight_ended ? (
          <div className="text-sm font-mono text-green-400">{formatTime(actualTime)}</div>
        ) : estimatedTime ? (
          <div className={`text-sm font-mono ${isDelayed ? 'text-red-400' : 'text-blue-400'}`}>
            {formatTime(estimatedTime)}
          </div>
        ) : (
          <span className="text-slate-500">—</span>
        )}
        {delay && (
          <div className={`text-[10px] font-mono ${isDelayed ? 'text-red-400' : 'text-green-400'}`}>
            {delay}
          </div>
        )}
      </td>
      {/* Status */}
      <td className="px-3 py-2.5 whitespace-nowrap">
        <Badge className={`${statusInfo.color} text-[10px] sm:text-xs font-medium px-2 py-0.5`}>
          {statusInfo.label}
        </Badge>
      </td>
    </tr>
  );
}

// FIDS Table component
function FIDSTable({ flights, type, isLoading }) {
  const headerLabel = type === 'ARR' ? 'Origem' : 'Destino';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
        <span className="ml-3 text-slate-300">A carregar voos...</span>
      </div>
    );
  }

  if (!flights || flights.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <Plane className="w-12 h-12 mb-3 opacity-30" />
        <p>Sem voos para apresentar</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b-2 border-blue-500/30">
            <th className="px-3 py-2 text-left text-xs font-semibold text-blue-400 uppercase tracking-wider">Hora</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-blue-400 uppercase tracking-wider">Voo</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-blue-400 uppercase tracking-wider hidden sm:table-cell">Cia</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-blue-400 uppercase tracking-wider">{headerLabel}</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-blue-400 uppercase tracking-wider hidden md:table-cell">Aeronave</th>
            <th className="px-3 py-2 text-center text-xs font-semibold text-blue-400 uppercase tracking-wider hidden lg:table-cell">Gate</th>
            <th className="px-3 py-2 text-center text-xs font-semibold text-blue-400 uppercase tracking-wider">Estimado</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-blue-400 uppercase tracking-wider">Estado</th>
          </tr>
        </thead>
        <tbody>
          {flights.map((flight, idx) => (
            <FIDSRow key={flight.fa_flight_id || idx} flight={flight} type={type} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function FIDSPanel({ aeroportos = [] }) {
  const { t } = useI18n();
  const [selectedAirport, setSelectedAirport] = useState('FNBJ');
  const [arrivals, setArrivals] = useState([]);
  const [departures, setDepartures] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const intervalRef = useRef(null);

  // Only show FNBJ (locked airport for FIDS)
  const aeroportosFiltrados = aeroportos.filter(a => a.codigo_icao === 'FNBJ');
  // Fallback: if FNBJ not found, use SGA airports
  const displayAeroportos = aeroportosFiltrados.length > 0
    ? aeroportosFiltrados
    : aeroportos.filter(a => a.isSGA === true);

  const fetchFIDS = useCallback(async () => {
    if (!selectedAirport) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await getFlightAwareFIDS({ airportIcao: selectedAirport });

      if (result.success) {
        setArrivals(result.arrivals || []);
        setDepartures(result.departures || []);
        setLastUpdated(result.lastUpdated || new Date().toISOString());
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [selectedAirport]);

  // Fetch on airport change
  useEffect(() => {
    if (selectedAirport) {
      fetchFIDS();
    }
  }, [selectedAirport, fetchFIDS]);

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh && selectedAirport) {
      intervalRef.current = setInterval(fetchFIDS, AUTO_REFRESH_INTERVAL);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, selectedAirport, fetchFIDS]);

  const selectedAirportData = displayAeroportos.find(a => a.codigo_icao === selectedAirport);
  const airportName = selectedAirportData?.nome || selectedAirportData?.codigo_icao || '';

  const wrapperClass = isDarkMode
    ? 'bg-slate-900 text-white rounded-lg'
    : 'bg-white text-slate-900 rounded-lg';

  return (
    <div className={wrapperClass}>
      {/* Header */}
      <div className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'} border-b px-4 py-3 rounded-t-lg`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Monitor className={`w-6 h-6 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
            <div>
              <h2 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                FIDS — Flight Information Display
              </h2>
              {airportName && (
                <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {airportName} ({selectedAirport})
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Airport selector (locked to FNBJ) */}
            <select
              value={selectedAirport}
              onChange={(e) => setSelectedAirport(e.target.value)}
              disabled={displayAeroportos.length <= 1}
              className={`text-sm rounded-md px-3 py-1.5 border ${
                isDarkMode
                  ? 'bg-slate-700 border-slate-600 text-white'
                  : 'bg-white border-slate-300 text-slate-900'
              } ${displayAeroportos.length <= 1 ? 'opacity-80 cursor-not-allowed' : ''}`}
            >
              {displayAeroportos.length > 0 ? displayAeroportos.map(a => (
                <option key={a.id || a.codigo_icao} value={a.codigo_icao}>
                  {a.codigo_icao} — {a.nome || a.cidade}
                </option>
              )) : (
                <option value="FNBJ">FNBJ — Dr. António Agostinho Neto</option>
              )}
            </select>

            {/* Dark mode toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`h-8 px-2 ${isDarkMode ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-slate-300 text-slate-600 hover:bg-slate-100'}`}
            >
              <Monitor className="w-4 h-4" />
            </Button>

            {/* Auto-refresh toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`h-8 px-2 text-xs ${
                autoRefresh
                  ? isDarkMode ? 'border-green-600 text-green-400 hover:bg-green-900/30' : 'border-green-500 text-green-600'
                  : isDarkMode ? 'border-slate-600 text-slate-400 hover:bg-slate-700' : 'border-slate-300 text-slate-500'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1" />
              Auto
            </Button>

            {/* Manual refresh */}
            <Button
              variant="outline"
              size="sm"
              onClick={fetchFIDS}
              disabled={isLoading}
              className={`h-8 px-3 ${isDarkMode ? 'border-blue-600 text-blue-400 hover:bg-blue-900/30' : 'border-blue-500 text-blue-600'}`}
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Status bar */}
        <div className={`flex items-center gap-4 mt-2 text-[10px] sm:text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          {lastUpdated && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Última atualização: {format(new Date(lastUpdated), 'HH:mm:ss')}
            </span>
          )}
          <span>Chegadas: {arrivals.length}</span>
          <span>Partidas: {departures.length}</span>
          {autoRefresh && <span className="text-green-400">● Auto-refresh: 3min</span>}
          <span className="ml-auto text-[9px] opacity-50">Powered by FlightAware AeroAPI</span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-3 p-3 bg-red-900/30 border border-red-700 rounded-md flex items-center gap-2 text-red-300 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* FIDS Content */}
      <div className="p-3 sm:p-4">
        <Tabs defaultValue="arrivals" className="w-full">
          <TabsList className={`grid w-full grid-cols-2 h-auto mb-4 ${isDarkMode ? 'bg-slate-800' : ''}`}>
            <TabsTrigger
              value="arrivals"
              className={`text-sm py-2.5 flex items-center gap-2 ${isDarkMode ? 'data-[state=active]:bg-blue-900/50 data-[state=active]:text-blue-300' : ''}`}
            >
              <PlaneLanding className="w-4 h-4" />
              <span>Chegadas</span>
              <Badge variant="secondary" className={`ml-1 text-[10px] ${isDarkMode ? 'bg-slate-700 text-slate-300' : ''}`}>
                {arrivals.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="departures"
              className={`text-sm py-2.5 flex items-center gap-2 ${isDarkMode ? 'data-[state=active]:bg-green-900/50 data-[state=active]:text-green-300' : ''}`}
            >
              <PlaneTakeoff className="w-4 h-4" />
              <span>Partidas</span>
              <Badge variant="secondary" className={`ml-1 text-[10px] ${isDarkMode ? 'bg-slate-700 text-slate-300' : ''}`}>
                {departures.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="arrivals">
            <FIDSTable flights={arrivals} type="ARR" isLoading={isLoading} />
          </TabsContent>

          <TabsContent value="departures">
            <FIDSTable flights={departures} type="DEP" isLoading={isLoading} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
