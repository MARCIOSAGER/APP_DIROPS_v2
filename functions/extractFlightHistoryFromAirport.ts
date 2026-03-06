import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const parseDate = (dateStr) => {
  // Parse dates like "Thursday, Jan 22", "Friday, Jan 23"
  // Returns YYYY-MM-DD format
  const months = {
    'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
    'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
    'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
  };
  
  const match = dateStr.match(/(\w+),\s+(\w+)\s+(\d+)/);
  if (!match) return null;
  
  const [, day, month, date] = match;
  const monthNum = months[month];
  const currentYear = new Date().getFullYear();
  
  return `${currentYear}-${monthNum}-${String(date).padStart(2, '0')}`;
};

const parseTime = (timeStr) => {
  if (!timeStr || timeStr === '—') return null;
  const match = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (match) {
    return `${String(match[1]).padStart(2, '0')}:${match[2]}`;
  }
  return null;
};

const extractAirportCode = (airportStr) => {
  // Extract code from strings like "Luanda (NBJ)"
  const match = airportStr.match(/\(([A-Z]{3})\)/);
  return match ? match[1] : null;
};

const extractAirportName = (airportStr) => {
  // Extract name from strings like "Luanda (NBJ)"
  return airportStr.replace(/\s*\([A-Z]{3}\)/, '').trim();
};

const extractFlightId = (url) => {
  // Extract FR24 ID from URL like /flights/ics123abc/
  const match = url.match(/\/flights\/([a-z0-9]+)/i);
  return match ? match[1] : null;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { airport_code, movement_type, html_content } = body;

    if (!airport_code || !movement_type || !html_content) {
      return Response.json(
        { error: 'airport_code, movement_type (ARR/DEP), e html_content são obrigatórios' },
        { status: 400 }
      );
    }

    if (!['ARR', 'DEP'].includes(movement_type)) {
      return Response.json(
        { error: 'movement_type deve ser ARR ou DEP' },
        { status: 400 }
      );
    }

    const flightsData = [];
    let currentDate = null;

    // Split HTML by rows
    const rows = html_content.split(/\n/).filter(line => line.trim());

    for (const row of rows) {
      const trimmedRow = row.trim();

      // Check if this is a date header row
      const dateMatch = trimmedRow.match(/^\w+,\s+\w+\s+\d+/);
      if (dateMatch) {
        currentDate = parseDate(trimmedRow);
        continue;
      }

      // Skip empty rows and header rows
      if (!trimmedRow || trimmedRow.includes('TIME') || trimmedRow.includes('FLIGHT')) {
        continue;
      }

      // Try to parse flight data
      // Structure: TIME | FLIGHT | TO | AIRLINE | AIRCRAFT | STATUS
      const cells = trimmedRow.split(/\|/).map(cell => cell.trim()).filter(cell => cell);

      if (cells.length < 5 || !currentDate) continue;

      const time = cells[0];
      const flight = cells[1];
      const destination = cells[2];
      const aircraft = cells[4];
      const status = cells[5] || 'Unknown';

      // Skip if doesn't look like a valid flight row
      if (!time || !flight || !destination) continue;

      const parsedTime = parseTime(time);
      if (!parsedTime) continue;

      const destCode = extractAirportCode(destination);
      const destName = extractAirportName(destination);

      // Skip if destination/origin is not a valid airport code
      if (!destCode || destCode.length !== 3) continue;

      const flightEntry = {
        callsign: flight,
        flight_number: flight,
        data_voo: currentDate,
        aeroporto_origem: movement_type === 'DEP' ? airport_code : destCode,
        aeroporto_destino: movement_type === 'DEP' ? destCode : airport_code,
        aeroporto_origem_nome: movement_type === 'DEP' ? `Airport ${airport_code}` : destName,
        aeroporto_destino_nome: movement_type === 'DEP' ? destName : `Airport ${airport_code}`,
        modelo_aeronave: aircraft,
        horario_previsto_partida: movement_type === 'DEP' ? parsedTime : null,
        horario_previsto_chegada: movement_type === 'ARR' ? parsedTime : null,
        status: status.includes('Landed') ? 'Landed' :
                status.includes('Scheduled') ? 'Scheduled' :
                status.includes('Delayed') ? 'Delayed' :
                status.includes('Cancelled') ? 'Cancelled' :
                status.includes('Diverted') ? 'Diverted' :
                status.includes('Unknown') ? 'Unknown' : 'Unknown',
        url_fr24: '',
        data_extracao: new Date().toISOString(),
        raw_data: { 
          movement_type,
          original_row: trimmedRow
        }
      };

      flightsData.push(flightEntry);
    }

    // Save to database
    if (flightsData.length > 0) {
      await base44.asServiceRole.entities.ExtractedFlightHistory.bulkCreate(flightsData);
      console.log(`${flightsData.length} voo(s) extraído(s) e salvos para ${airport_code}`);
    }

    return Response.json({
      success: true,
      message: `${flightsData.length} voo(s) extraído(s) e salvos`,
      count: flightsData.length,
      airport_code,
      movement_type,
      data: flightsData
    });

  } catch (error) {
    console.error('Erro na extração:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});