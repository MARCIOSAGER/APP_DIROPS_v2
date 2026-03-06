import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const AEROPORTOS_SGA = ['SDD', 'UEC', 'SDD'];

const parseTime = (timeStr) => {
  if (!timeStr || timeStr === '—') return null;
  const match = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (match) {
    const hours = String(match[1]).padStart(2, '0');
    const minutes = String(match[2]).padStart(2, '0');
    return `${hours}:${minutes}`;
  }
  return null;
};

const parseFlightTime = (timeStr) => {
  if (!timeStr || timeStr === '—') return null;
  const match = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (match) {
    return parseInt(match[1]) * 60 + parseInt(match[2]);
  }
  return null;
};

const parseDelay = (statusStr) => {
  if (!statusStr) return null;
  const match = statusStr.match(/Delayed\s+(\d+):(\d{2})/);
  if (match) {
    return parseInt(match[1]) * 60 + parseInt(match[2]);
  }
  return null;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { callsign, url } = body;

    if (!callsign || !url) {
      return Response.json(
        { error: 'callsign e url são obrigatórios' },
        { status: 400 }
      );
    }

    // Fetch da página de histórico de voo
    console.log(`Extraindo histórico para voo: ${callsign}`);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      return Response.json(
        { error: 'Falha ao aceder ao Flightradar24' },
        { status: 500 }
      );
    }

    const html = await response.text();

    // Parse simples da tabela HTML (pode ser melhorado com uma library HTML parser)
    const flightsData = [];
    const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [];

    for (const row of rows) {
      const cells = row.match(/<td[^>]*>[\s\S]*?<\/td>/g) || [];
      if (cells.length < 9) continue;

      // Extração de dados de cada célula (remove tags HTML)
      const extractText = (html) => html.replace(/<[^>]*>/g, '').trim();

      const data = extractText(cells[0]);
      const from = extractText(cells[1]);
      const to = extractText(cells[2]);
      const aircraft = extractText(cells[3]);
      const flightTime = extractText(cells[4]);
      const std = extractText(cells[5]);
      const atd = extractText(cells[6]);
      const sta = extractText(cells[7]);
      const status = extractText(cells[8]);

      // Verificar se origem ou destino pertencem aos aeroportos SGA
      const fromCode = from.match(/\(([A-Z]{3})\)/)?.[1];
      const toCode = to.match(/\(([A-Z]{3})\)/)?.[1];

      if (!AEROPORTOS_SGA.includes(fromCode) && !AEROPORTOS_SGA.includes(toCode)) {
        continue;
      }

      const flightEntry = {
        callsign: callsign,
        flight_number: callsign,
        data_voo: data,
        aeroporto_origem: fromCode || from,
        aeroporto_destino: toCode || to,
        aeroporto_origem_nome: from.replace(/\s*\([A-Z]{3}\)/, '').trim(),
        aeroporto_destino_nome: to.replace(/\s*\([A-Z]{3}\)/, '').trim(),
        modelo_aeronave: aircraft,
        tempo_voo_minutos: parseFlightTime(flightTime),
        horario_previsto_partida: parseTime(std),
        horario_real_partida: parseTime(atd),
        horario_previsto_chegada: parseTime(sta),
        status: status.includes('Landed') ? 'Landed' : 
                status.includes('Delayed') ? 'Delayed' :
                status.includes('Scheduled') ? 'Scheduled' :
                status.includes('Cancelled') ? 'Cancelled' :
                status.includes('Diverted') ? 'Diverted' : 'Unknown',
        atraso_minutos: parseDelay(status),
        url_fr24: url,
        data_extracao: new Date().toISOString(),
        raw_data: { row: row }
      };

      flightsData.push(flightEntry);
    }

    // Salvar na base de dados
    if (flightsData.length > 0) {
      await base44.asServiceRole.entities.ExtractedFlightHistory.bulkCreate(flightsData);
    }

    return Response.json({
      success: true,
      message: `${flightsData.length} voo(s) extraído(s) e salvos para ${callsign}`,
      count: flightsData.length,
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