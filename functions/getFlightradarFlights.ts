import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const payload = await req.json();
         let { airportIcao, startDate, endDate } = payload;

         if (!airportIcao || !startDate || !endDate) {
              return Response.json({ 
                  error: 'Missing required parameters: airportIcao, startDate, endDate' 
              }, { status: 400 });
          }

          // Validar datas
          const startDateObj = new Date(startDate);
          const endDateObj = new Date(endDate);
          const now = new Date();

          if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
              return Response.json({ 
                  error: 'Invalid date format. Use ISO format: YYYY-MM-DDTHH:MM:SS'
              }, { status: 400 });
          }

          if (startDateObj > endDateObj) {
              return Response.json({ 
                  error: 'Start date must be before end date'
              }, { status: 400 });
          }

          // Validar intervalo: API Flightradar24 tem limite de 14 dias (contagem inclusiva)
          const diffDays = Math.floor((endDateObj - startDateObj) / (1000 * 60 * 60 * 24));
          if (diffDays >= 14) {
              return Response.json({ 
                  error: `Intervalo de datas muito grande (${diffDays} dias). A API Flightradar24 permite máximo 13 dias por requisição.`,
                  hint: 'Reduza o intervalo para 13 dias ou menos.'
              }, { status: 400 });
          }

          // Aviso: API não retorna voos futuros
          if (endDateObj > now) {
              console.warn(`⚠️ End date ${endDate} is in the future. API only returns real-time or past flights.`);
          }

          // Formatar datas para o formato exigido pela API: YYYY-MM-DD HH:MM:SS
          const formatDateForFR24 = (dateStr) => {
              const date = new Date(dateStr);
              const iso = date.toISOString();
              return iso.slice(0, 10) + ' ' + iso.slice(11, 19);
          };

          startDate = formatDateForFR24(startDate);
          endDate = formatDateForFR24(endDate);

         const FR24_API_TOKEN = Deno.env.get("ID_FR");
                        if (!FR24_API_TOKEN) {
                            return Response.json({ 
                                error: 'Flightradar24 API token not configured' 
                            }, { status: 500 });
                        }

         console.log(`🛫 Fetching flights for ${airportIcao} from ${startDate} to ${endDate}`);

         // Implementar paginação para obter TODOS os voos (não apenas os primeiros 20)
           let allFlights = [];
           let offset = 0;
           let hasMoreFlights = true;
           let pageNumber = 1;
           const startTime = Date.now();
           let requestCount = 0;
           const requestsPerMinute = 10;
           const minTimeBetweenRequests = 60000 / requestsPerMinute; // 6000ms = 6 segundos

           while (hasMoreFlights) {
               // Controlar taxa de requisições (máx 10 por minuto)
               const now = Date.now();
               const timeSinceStart = now - startTime;
               const maxRequestsAllowed = Math.floor(timeSinceStart / minTimeBetweenRequests) + 1;

               if (requestCount >= maxRequestsAllowed) {
                   const waitTime = Math.ceil((requestCount * minTimeBetweenRequests - timeSinceStart) / 1000) * 1000;
                   console.log(`⏱️ Rate limiting: aguardando ${waitTime}ms antes da próxima requisição...`);
                   await new Promise(resolve => setTimeout(resolve, waitTime));
               }

               const url = `https://fr24api.flightradar24.com/api/flight-summary/full?airports=both:${airportIcao}&flight_datetime_from=${startDate}&flight_datetime_to=${endDate}&limit=20&offset=${offset}`;

               // Timeout de 30 segundos por página
               const controller = new AbortController();
               const timeoutId = setTimeout(() => controller.abort(), 30000);

               let response;
               try {
                   console.log(`📄 Fetching page ${pageNumber} (offset: ${offset}, request ${requestCount + 1})...`);
                   response = await fetch(url, {
                       method: 'GET',
                       headers: {
                           'Accept': 'application/json',
                           'Accept-Version': 'v1',
                           'Authorization': `Bearer ${FR24_API_TOKEN}`
                       },
                       signal: controller.signal
                   });
                   requestCount++;
               } finally {
                   clearTimeout(timeoutId);
               }

               if (!response.ok) {
                   const errorText = await response.text();
                   console.error('Flightradar24 API Error:', response.status, errorText);

                   let userMessage = 'Erro ao buscar voos do Flightradar24';

                   // Mensagens mais descritivas baseadas no status
                   if (response.status === 401) {
                       userMessage = 'Token Flightradar24 inválido ou expirado. Verifique as credenciais na configuração.';
                   } else if (response.status === 403) {
                       userMessage = 'Acesso negado. O seu plano Flightradar24 pode não ter acesso a este endpoint.';
                   } else if (response.status === 404) {
                       userMessage = 'Aeroporto não encontrado na base de dados Flightradar24. Verifique o código ICAO.';
                   } else if (response.status === 429) {
                       userMessage = 'Limite de requisições excedido. Aguarde alguns minutos e tente novamente.';
                   } else if (response.status === 500 || response.status === 502 || response.status === 503) {
                       userMessage = 'Servidor Flightradar24 indisponível. Tente novamente em alguns minutos.';
                   } else if (response.status === 400) {
                       try {
                           const errorData = JSON.parse(errorText);
                           if (errorData.details && errorData.details.includes('date range')) {
                               userMessage = 'Intervalo de datas inválido. Verifique se as datas estão no formato correto (YYYY-MM-DD).';
                           } else {
                               userMessage = `Erro de validação: ${errorData.message || 'Requisição inválida'}`;
                           }
                       } catch {
                           userMessage = 'Requisição inválida. Verifique os parâmetros (aeroporto, datas).';
                       }
                   } else if (response.status >= 500) {
                       userMessage = `Servidor Flightradar24 indisponível (${response.status}). Tente novamente em alguns minutos.`;
                   } else if (response.status >= 400) {
                       userMessage = `Erro da API Flightradar24 (${response.status}). Detalhes: ${errorText.substring(0, 100)}`;
                   }

                   return Response.json({ 
                       error: userMessage,
                       status: response.status,
                       hint: 'Use datas no passado. A API retorna apenas voos reais/em movimento, não agendados futuros.',
                       fullError: errorText
                   }, { status: response.status });
               }

               const data = await response.json();
               const pageFlights = data.data || [];

               if (pageFlights.length === 0) {
                   console.log(`✅ Fim da paginação. Total de voos: ${allFlights.length}`);
                   hasMoreFlights = false;
               } else {
                   console.log(`✅ Page ${pageNumber}: Retrieved ${pageFlights.length} flights`);
                   allFlights = allFlights.concat(pageFlights);
                   offset += 20;
                   pageNumber += 1;

                   // Se a página tem menos de 20 voos, é a última página
                   if (pageFlights.length < 20) {
                       hasMoreFlights = false;
                   }
               }
           }

           const flights = allFlights;

           if (flights.length === 0) {
               console.log(`ℹ️ No flights found for the specified period. Note: API only returns flights in real-time (already in motion), not scheduled future flights.`);
           } else {
               console.log(`✅ Retrieved ${flights.length} flights in total`);
           }

        // Salvar voos no cache
        const flightsWithCacheIds = [];
        
        if (flights.length > 0) {
            const dataVoo = new Date(startDate).toISOString().split('T')[0]; // YYYY-MM-DD
            const dataExpiracao = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // Expira em 24h

            const cachesToCreate = flights.map((flight, idx) => {
                const fr24Id = flight.id || flight.callsign || `unknown_${idx}_${Date.now()}`;
                return {
                    fr24_id: fr24Id,
                    airport_icao: airportIcao,
                    numero_voo: flight.callsign || flight.flight_number || 'N/A',
                    data_voo: dataVoo,
                    raw_data: flight,
                    status: 'pendente',
                    data_expiracao: dataExpiracao
                };
            });

            try {
                // Verificar se já existe no cache para evitar duplicatas
                const fr24Ids = cachesToCreate.map(c => c.fr24_id);
                const existentes = await base44.entities.CacheVooFR24.filter({
                    fr24_id: { $in: fr24Ids }
                }, null, 1000);

                // Criar mapa de fr24_id -> cache_id dos existentes
                const existentesMap = {};
                existentes.forEach(ex => {
                    existentesMap[ex.fr24_id] = ex.id;
                });

                // Filtrar apenas os que não existem (mais eficiente com Set)
                const existentesSet = new Set(existentes.map(ex => ex.fr24_id));
                const novosParaInserir = cachesToCreate.filter(cache =>
                    !existentesSet.has(cache.fr24_id)
                );

                // Criar os novos registos
                let novosCriados = [];
                if (novosParaInserir.length > 0) {
                    novosCriados = await base44.entities.CacheVooFR24.bulkCreate(novosParaInserir);
                    console.log(`💾 Saved ${novosParaInserir.length} flights to cache`);
                } else {
                    console.log('ℹ️ All flights already in cache');
                }

                // Montar array de voos com cache_id
                for (let i = 0; i < novosParaInserir.length; i++) {
                    const cacheCriado = novosCriados[i];
                    const fr24IdNovo = novosParaInserir[i].fr24_id;
                    if (cacheCriado && cacheCriado.id) {
                        existentesMap[fr24IdNovo] = cacheCriado.id;
                    }
                }

                flights.forEach((flight) => {
                    const fr24Id = flight.id || flight.callsign;
                    const cacheId = existentesMap[fr24Id];
                    
                    if (cacheId) {
                        flightsWithCacheIds.push({
                            ...flight,
                            cache_id: cacheId
                        });
                    } else {
                        console.warn(`⚠️ No cache_id found for flight ${fr24Id}, skipping`);
                    }
                });
            } catch (cacheError) {
                console.warn('⚠️ Warning: Could not save to cache:', cacheError.message);
                // Se falhar o cache, retorna sem cache_id
                flightsWithCacheIds.push(...flights);
            }
        }

        return Response.json({ 
            success: true,
            flights: flightsWithCacheIds.length > 0 ? flightsWithCacheIds : flights,
            total: flights.length,
            cached: true
        });

    } catch (error) {
         console.error('❌ Error in getFlightradarFlights:', error.message, error);
         return Response.json({ 
             error: error.message || 'Erro ao processar a requisição',
             hint: 'Verifique se o código ICAO do aeroporto está correto e se a API está funcionando.'
         }, { status: 500 });
     }
});