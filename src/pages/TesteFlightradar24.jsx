import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader, Download, AlertCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function TesteFlightradar24() {
    const [airportIcao, setAirportIcao] = useState('FNCA');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);
    const [flights, setFlights] = useState([]);
    const [error, setError] = useState(null);

    const handleFetchFlights = async () => {
        setLoading(true);
        setError(null);
        setFlights([]);

        try {
            const response = await base44.functions.invoke('getFlightradarFlights', {
                airportIcao,
                startDate,
                endDate
            });

            if (response.data.success) {
                setFlights(response.data.flights || []);
            } else {
                setError(response.data.error || 'Erro desconhecido');
            }
        } catch (err) {
            setError(err.message || 'Erro ao buscar voos');
            console.error('Erro:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateFlightRecord = async (flightData) => {
        try {
            await base44.entities.Voo.create({
                tipo_movimento: flightData.movement_type,
                numero_voo: flightData.flight_number,
                data_operacao: flightData.date_of_operation,
                horario_previsto: flightData.scheduled_time_utc,
                horario_real: flightData.real_time_utc || flightData.scheduled_time_utc,
                aeroporto_operacao: airportIcao,
                registo_aeronave: flightData.aircraft_registration || 'DESCONHECIDO',
                companhia_aerea: flightData.airline_icao || 'DESCONHECIDO',
                aeroporto_origem_destino: flightData.airport_icao_origin || flightData.airport_icao_destination || 'DESCONHECIDO',
                tipo_voo: 'Regular',
                status: 'Programado',
                observacoes: `Importado de FR24 - ${new Date().toISOString()}`
            });

            alert(`✅ Voo ${flightData.flight_number} criado com sucesso!`);
        } catch (err) {
            alert(`❌ Erro ao criar voo: ${err.message}`);
            console.error('Erro:', err);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold mb-6 text-slate-900">🧪 Teste Flightradar24</h1>

            {/* Filtros */}
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>Parâmetros de Busca</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Aeroporto (ICAO)</label>
                            <Input
                                value={airportIcao}
                                onChange={(e) => setAirportIcao(e.target.value.toUpperCase())}
                                placeholder="Ex: FNCA"
                                disabled={loading}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Data Início (YYYY-MM-DD)</label>
                            <Input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                disabled={loading}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Data Fim (YYYY-MM-DD)</label>
                            <Input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                disabled={loading}
                            />
                        </div>
                    </div>

                    <Button 
                        onClick={handleFetchFlights} 
                        disabled={loading}
                        className="w-full"
                    >
                        {loading ? (
                            <>
                                <Loader className="mr-2 h-4 w-4 animate-spin" />
                                A carregar...
                            </>
                        ) : (
                            <>
                                <Download className="mr-2 h-4 w-4" />
                                Buscar Voos
                            </>
                        )}
                    </Button>
                </CardContent>
            </Card>

            {/* Erro */}
            {error && (
                <Card className="mb-6 border-red-200 bg-red-50">
                    <CardContent className="pt-6 flex gap-3">
                        <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-medium text-red-900">Erro</p>
                            <p className="text-sm text-red-700 mt-1">{error}</p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Resultados */}
            {flights.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Voos Encontrados ({flights.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="border-b bg-slate-50">
                                    <tr>
                                        <th className="text-left p-3 font-medium">Voo</th>
                                        <th className="text-left p-3 font-medium">Aeronave</th>
                                        <th className="text-left p-3 font-medium">Movimento</th>
                                        <th className="text-left p-3 font-medium">Hora Prevista</th>
                                        <th className="text-left p-3 font-medium">Origem/Destino</th>
                                        <th className="p-3"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {flights.map((flight, idx) => (
                                        <tr key={idx} className="border-b hover:bg-slate-50">
                                            <td className="p-3 font-medium">{flight.flight_number}</td>
                                            <td className="p-3 text-xs">{flight.aircraft_registration || '-'}</td>
                                            <td className="p-3">
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                    flight.movement_type === 'ARR' 
                                                        ? 'bg-blue-100 text-blue-800' 
                                                        : 'bg-green-100 text-green-800'
                                                }`}>
                                                    {flight.movement_type === 'ARR' ? '📥 Chegada' : '📤 Partida'}
                                                </span>
                                            </td>
                                            <td className="p-3 text-xs">{flight.scheduled_time_utc}</td>
                                            <td className="p-3 text-xs">
                                                {flight.movement_type === 'ARR' 
                                                    ? flight.airport_icao_origin 
                                                    : flight.airport_icao_destination}
                                            </td>
                                            <td className="p-3">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleCreateFlightRecord(flight)}
                                                >
                                                    Criar
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {!loading && flights.length === 0 && !error && (
                <Card className="bg-slate-50 border-dashed">
                    <CardContent className="pt-12 pb-12 text-center">
                        <p className="text-slate-500">👇 Preencha os parâmetros e clique em "Buscar Voos"</p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}