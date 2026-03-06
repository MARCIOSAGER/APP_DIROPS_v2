import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Função para gerar cabeçalho de autenticação HTTP Basic
function getBasicAuthHeader() {
    const clientId = Deno.env.get('clientId');
    const clientSecret = Deno.env.get('clientSecret');
    
    if (!clientId || !clientSecret) {
        throw new Error('Credenciais OpenSky Network não configuradas (clientId/clientSecret)');
    }

    const credentials = btoa(`${clientId}:${clientSecret}`);
    return `Basic ${credentials}`;
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const payload = await req.json();
        const { 
            airportIcao = 'FNLU', // Aeroporto de Luanda por padrão
            type = 'both', // 'arrivals', 'departures', ou 'both'
            hours = 24 // Últimas X horas
        } = payload;

        console.log(`✈️ Buscando voos para ${airportIcao} (tipo: ${type}, últimas ${hours}h)`);

        // Preparar cabeçalho de autenticação HTTP Basic
        let authHeader;
        try {
            authHeader = getBasicAuthHeader();
        } catch (error) {
            console.error('Erro ao preparar autenticação:', error.message);
            return Response.json({ 
                error: 'Autenticação OpenSky falhou',
                details: error.message 
            }, { status: 500 });
        }

        // Calcular timestamps (OpenSky usa Unix timestamp em segundos)
        const endTime = Math.floor(Date.now() / 1000);
        const beginTime = endTime - (hours * 3600);

        const results = {
            airport: airportIcao,
            period: {
                from: new Date(beginTime * 1000).toISOString(),
                to: new Date(endTime * 1000).toISOString()
            },
            arrivals: [],
            departures: []
        };

        const headers = {
            'Authorization': authHeader,
            'Accept': 'application/json'
        };

        // Buscar chegadas (arrivals)
        if (type === 'arrivals' || type === 'both') {
            const arrivalsUrl = `https://opensky-network.org/api/flights/arrival?airport=${airportIcao}&begin=${beginTime}&end=${endTime}`;
            
            try {
                const response = await fetch(arrivalsUrl, { headers });
                
                if (response.ok) {
                    const data = await response.json();
                    results.arrivals = data.map(flight => ({
                        icao24: flight.icao24,
                        callsign: flight.callsign?.trim() || 'N/A',
                        departureAirport: flight.estDepartureAirport || 'Desconhecido',
                        arrivalAirport: flight.estArrivalAirport,
                        departureTime: flight.firstSeen ? new Date(flight.firstSeen * 1000).toISOString() : null,
                        arrivalTime: flight.lastSeen ? new Date(flight.lastSeen * 1000).toISOString() : null,
                        departureTimeLocal: flight.firstSeen ? new Date(flight.firstSeen * 1000).toLocaleString('pt-AO', { timeZone: 'Africa/Luanda' }) : null,
                        arrivalTimeLocal: flight.lastSeen ? new Date(flight.lastSeen * 1000).toLocaleString('pt-AO', { timeZone: 'Africa/Luanda' }) : null
                    }));
                    console.log(`✅ ${results.arrivals.length} chegadas encontradas`);
                } else if (response.status === 404) {
                    console.log('⚠️ Nenhuma chegada encontrada no período');
                } else {
                    const errorText = await response.text();
                    console.error('Erro ao buscar chegadas:', response.status, errorText);
                }
            } catch (error) {
                console.error('Erro na requisição de chegadas:', error.message);
            }
        }

        // Buscar partidas (departures)
        if (type === 'departures' || type === 'both') {
            const departuresUrl = `https://opensky-network.org/api/flights/departure?airport=${airportIcao}&begin=${beginTime}&end=${endTime}`;
            
            try {
                const response = await fetch(departuresUrl, { headers });
                
                if (response.ok) {
                    const data = await response.json();
                    results.departures = data.map(flight => ({
                        icao24: flight.icao24,
                        callsign: flight.callsign?.trim() || 'N/A',
                        departureAirport: flight.estDepartureAirport,
                        arrivalAirport: flight.estArrivalAirport || 'Desconhecido',
                        departureTime: flight.firstSeen ? new Date(flight.firstSeen * 1000).toISOString() : null,
                        arrivalTime: flight.lastSeen ? new Date(flight.lastSeen * 1000).toISOString() : null,
                        departureTimeLocal: flight.firstSeen ? new Date(flight.firstSeen * 1000).toLocaleString('pt-AO', { timeZone: 'Africa/Luanda' }) : null,
                        arrivalTimeLocal: flight.lastSeen ? new Date(flight.lastSeen * 1000).toLocaleString('pt-AO', { timeZone: 'Africa/Luanda' }) : null
                    }));
                    console.log(`✅ ${results.departures.length} partidas encontradas`);
                } else if (response.status === 404) {
                    console.log('⚠️ Nenhuma partida encontrada no período');
                } else {
                    const errorText = await response.text();
                    console.error('Erro ao buscar partidas:', response.status, errorText);
                }
            } catch (error) {
                console.error('Erro na requisição de partidas:', error.message);
            }
        }

        return Response.json({
            success: true,
            ...results,
            total: {
                arrivals: results.arrivals.length,
                departures: results.departures.length
            }
        });

    } catch (error) {
        console.error('❌ Erro:', error.message);
        return Response.json({ 
            error: 'Internal server error',
            details: error.message 
        }, { status: 500 });
    }
});