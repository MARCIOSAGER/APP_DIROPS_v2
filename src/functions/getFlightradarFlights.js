// Flightradar24 API requires server-side API key
// Placeholder until Edge Function is deployed
export async function getFlightradarFlights({ airportIcao, startDate, endDate }) {
  console.warn('[getFlightradarFlights] FR24 API not configured');
  throw new Error('Integração com Flightradar24 não configurada. Configure o Edge Function com a API key do FR24.');
}
