import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { airport_code, movement_type } = body;

    if (!airport_code || !movement_type) {
      return Response.json(
        { error: 'airport_code e movement_type (ARR/DEP) são obrigatórios' },
        { status: 400 }
      );
    }

    if (!['ARR', 'DEP'].includes(movement_type)) {
      return Response.json(
        { error: 'movement_type deve ser ARR ou DEP' },
        { status: 400 }
      );
    }

    // Construir URL do Flightradar24
    const movementPath = movement_type === 'DEP' ? 'departures' : 'arrivals';
    const url = `https://www.flightradar24.com/data/airports/${airport_code.toLowerCase()}/${movementPath}`;

    console.log(`Fetching flight data from: ${url}`);

    // Fazer fetch do HTML com token de autenticação
    let htmlContent = '';
    
    try {
      const fr24Token = Deno.env.get('ID_FR');
      
      if (!fr24Token) {
        return Response.json(
          { error: 'Token FR24 não configurado' },
          { status: 500 }
        );
      }

      const fetchResponse = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Authorization': `Bearer ${fr24Token}`
        }
      });

      if (!fetchResponse.ok) {
        console.error(`FR24 API error: ${fetchResponse.status}`);
        return Response.json(
          { error: `Falha ao buscar do Flightradar24: ${fetchResponse.status}` },
          { status: 502 }
        );
      }

      htmlContent = await fetchResponse.text();
      
      if (!htmlContent || htmlContent.length < 100) {
        return Response.json(
          { error: 'Conteúdo obtido do Flightradar24 está vazio ou incompleto' },
          { status: 502 }
        );
      }

      console.log(`Obtained ${htmlContent.length} characters from Flightradar24`);

    } catch (error) {
      console.error('Fetch error:', error);
      return Response.json(
        { error: 'Falha ao obter dados do Flightradar24: ' + error.message },
        { status: 502 }
      );
    }

    // Chamar a função de extração existente
    const extractResponse = await base44.asServiceRole.functions.invoke('extractFlightHistoryFromAirport', {
      airport_code,
      movement_type,
      html_content: htmlContent
    });

    return Response.json({
      success: true,
      message: `Extração automática completada para ${airport_code}`,
      airport_code,
      movement_type,
      url,
      extracted_flights: extractResponse.count,
      data: extractResponse.data
    });

  } catch (error) {
    console.error('Erro na automação FR24:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});