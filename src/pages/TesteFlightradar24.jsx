import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Search, AlertCircle, Plane, RefreshCw, Database, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { CacheVooFR24 } from '@/entities/CacheVooFR24';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';

export default function TesteFlightradar24() {
    const { currentUser } = useAuth();
    const [airportIcao, setAirportIcao] = useState('FNBJ');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);
    const [cachedFlights, setCachedFlights] = useState([]);
    const [error, setError] = useState(null);
    const [stats, setStats] = useState(null);
    const [tab, setTab] = useState('cache'); // cache | api

    // Load cached flights
    const loadCache = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const filters = { airport_icao: airportIcao };
            if (startDate) filters.data_voo = { $gte: startDate };
            if (endDate) filters.data_voo = { ...filters.data_voo, $lte: endDate };

            const data = await CacheVooFR24.filter(filters, '-data_voo');
            setCachedFlights(data);

            // Calculate stats
            const empresaId = currentUser?.empresa_id;
            if (empresaId && data.length > 0) {
                // Compare with voo table
                const flightNumbers = [...new Set(data.map(f => f.numero_voo).filter(Boolean))];
                const { data: voos } = await supabase
                    .from('voo')
                    .select('numero_voo, data_operacao, tipo_movimento, registo_aeronave')
                    .eq('empresa_id', empresaId)
                    .is('deleted_at', null)
                    .gte('data_operacao', startDate)
                    .lte('data_operacao', endDate);

                const vooMap = new Map();
                (voos || []).forEach(v => {
                    vooMap.set(`${v.numero_voo}_${v.data_operacao}_${v.tipo_movimento}`, v.registo_aeronave);
                });

                let matched = 0, missing = 0, regDiff = 0;
                data.forEach(f => {
                    const raw = f.raw_data || {};
                    const tipo = (raw.dest_icao_actual === airportIcao || raw.dest_icao === airportIcao) ? 'ARR' : 'DEP';
                    const key = `${f.numero_voo}_${f.data_voo}_${tipo}`;
                    const atoReg = vooMap.get(key);
                    if (atoReg !== undefined) {
                        const fr24Reg = (raw.reg || '').replace(/-/g, '').toUpperCase();
                        const atoRegNorm = (atoReg || '').replace(/-/g, '').toUpperCase();
                        if (fr24Reg === atoRegNorm) matched++;
                        else regDiff++;
                    } else {
                        missing++;
                    }
                });
                setStats({ total: data.length, matched, missing, regDiff });
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [airportIcao, startDate, endDate, currentUser]);

    return (
        <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4">
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Plane className="w-6 h-6 text-sky-500" />
                Flightradar24 — Dados em Cache
            </h1>

            {/* Filtros */}
            <Card>
                <CardContent className="pt-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Aeroporto (ICAO)</label>
                            <Input value={airportIcao} onChange={(e) => setAirportIcao(e.target.value.toUpperCase())} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Data Início</label>
                            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Data Fim</label>
                            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                        </div>
                        <div className="flex items-end">
                            <Button onClick={loadCache} disabled={loading} className="w-full bg-sky-600 hover:bg-sky-700">
                                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                                Buscar Cache
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Stats */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Card className="bg-sky-50 border-sky-200">
                        <CardContent className="pt-4 pb-4 text-center">
                            <Database className="w-5 h-5 text-sky-600 mx-auto mb-1" />
                            <p className="text-2xl font-bold text-sky-700">{stats.total}</p>
                            <p className="text-xs text-sky-600">Voos FR24</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-green-50 border-green-200">
                        <CardContent className="pt-4 pb-4 text-center">
                            <CheckCircle className="w-5 h-5 text-green-600 mx-auto mb-1" />
                            <p className="text-2xl font-bold text-green-700">{stats.matched}</p>
                            <p className="text-xs text-green-600">Match ATO</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-red-50 border-red-200">
                        <CardContent className="pt-4 pb-4 text-center">
                            <XCircle className="w-5 h-5 text-red-600 mx-auto mb-1" />
                            <p className="text-2xl font-bold text-red-700">{stats.missing}</p>
                            <p className="text-xs text-red-600">Em falta no ATO</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-amber-50 border-amber-200">
                        <CardContent className="pt-4 pb-4 text-center">
                            <AlertTriangle className="w-5 h-5 text-amber-600 mx-auto mb-1" />
                            <p className="text-2xl font-bold text-amber-700">{stats.regDiff}</p>
                            <p className="text-xs text-amber-600">Registo Diferente</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Error */}
            {error && (
                <Card className="border-red-200 bg-red-50">
                    <CardContent className="pt-4 flex gap-2">
                        <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                        <p className="text-sm text-red-700">{error}</p>
                    </CardContent>
                </Card>
            )}

            {/* Results */}
            {cachedFlights.length > 0 && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Voos FR24 em Cache ({cachedFlights.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
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
                                    </tr>
                                </thead>
                                <tbody>
                                    {cachedFlights.map((f, idx) => {
                                        const raw = f.raw_data || {};
                                        const isArr = (raw.dest_icao_actual === airportIcao || raw.dest_icao === airportIcao);
                                        return (
                                            <tr key={f.id || idx} className="border-b hover:bg-slate-50">
                                                <td className="p-2 font-medium">{f.numero_voo || raw.flight || '—'}</td>
                                                <td className="p-2">{f.data_voo}</td>
                                                <td className="p-2">
                                                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${isArr ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                                                        {isArr ? 'ARR' : 'DEP'}
                                                    </span>
                                                </td>
                                                <td className="p-2 font-mono">{(raw.reg || '').replace(/-/g, '')}</td>
                                                <td className="p-2">{raw.type || '—'}</td>
                                                <td className="p-2">{raw.operating_as || raw.painted_as || '—'}</td>
                                                <td className="p-2">{raw.orig_icao || '—'}</td>
                                                <td className="p-2">{raw.dest_icao_actual || raw.dest_icao || '—'}</td>
                                                <td className="p-2">{(raw.datetime_takeoff || '').substring(11, 16) || '—'}</td>
                                                <td className="p-2">{(raw.datetime_landed || '').substring(11, 16) || '—'}</td>
                                                <td className="p-2">
                                                    <span className={`px-1.5 py-0.5 rounded text-xs ${f.status === 'pendente' ? 'bg-yellow-100 text-yellow-800' : f.status === 'importado' ? 'bg-green-100 text-green-800' : 'bg-slate-100'}`}>
                                                        {f.status}
                                                    </span>
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

            {!loading && cachedFlights.length === 0 && !error && (
                <Card className="bg-slate-50 border-dashed">
                    <CardContent className="pt-8 pb-8 text-center text-slate-500">
                        <Database className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                        <p>Selecione o período e clique "Buscar Cache"</p>
                        <p className="text-xs mt-1">Dados disponíveis: 19/02/2026 - 21/03/2026 (1.369 voos)</p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
