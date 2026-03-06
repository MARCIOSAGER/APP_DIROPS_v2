import { createClient } from 'npm:@base44/sdk@0.1.0';

const base44 = createClient({
    appId: Deno.env.get('BASE44_APP_ID'), 
});

Deno.serve(async (req) => {
    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response('Unauthorized', { status: 401 });
        }
        const token = authHeader.split(' ')[1];
        base44.auth.setToken(token);

        const voos = await base44.entities.Voo.list('-data_operacao');
        const aeroportos = await base44.entities.Aeroporto.list();
        const companhias = await base44.entities.CompanhiaAerea.list();

        const getNomeAeroporto = (codigo) => aeroportos.find(a => a.codigo_icao === codigo)?.nome || codigo;
        const getNomeCompanhia = (codigo) => companhias.find(c => c.codigo_icao === codigo)?.nome || codigo;

        // Gerar HTML em vez de PDF
        const htmlContent = `
<!DOCTYPE html>
<html lang="pt">
<head>
    <meta charset="UTF-8">
    <title>Relatório de Voos</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 20px; color: #333; }
        .container { max-width: 1200px; margin: auto; }
        .header { text-align: center; margin-bottom: 30px; }
        .header img { height: 60px; margin-bottom: 10px; }
        .header h1 { color: #1e40af; margin: 0; }
        .info { border-top: 1px solid #eee; border-bottom: 1px solid #eee; padding: 15px 0; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
        th { background-color: #f1f5f9; color: #1e3a8a; }
        tbody tr:nth-child(even) { background-color: #f8fafc; }
        .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #999; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/563d28706_logoSGA.png" alt="SGA Logo">
            <h1>Relatório de Operações de Voos</h1>
        </div>
        
        <div class="info">
            <p><strong>Data de Geração:</strong> ${new Date().toLocaleString('pt-AO')}</p>
            <p><strong>Total de Voos:</strong> ${voos.length}</p>
        </div>

        <table>
            <thead>
                <tr>
                    <th>Data</th>
                    <th>Tipo</th>
                    <th>Voo</th>
                    <th>Companhia</th>
                    <th>Matrícula</th>
                    <th>Rota</th>
                    <th>Previsto</th>
                    <th>Real</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${voos.slice(0, 100).map(voo => `
                    <tr>
                        <td>${voo.data_operacao ? new Date(voo.data_operacao).toLocaleDateString('pt-AO') : ''}</td>
                        <td>${voo.tipo_movimento || ''}</td>
                        <td>${voo.numero_voo || ''}</td>
                        <td>${getNomeCompanhia(voo.companhia_aerea)}</td>
                        <td>${voo.registo_aeronave || ''}</td>
                        <td>${getNomeAeroporto(voo.aeroporto_operacao)} → ${getNomeAeroporto(voo.aeroporto_origem_destino)}</td>
                        <td>${voo.horario_previsto || ''}</td>
                        <td>${voo.horario_real || ''}</td>
                        <td>${voo.status || ''}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <div class="footer">
            <p>Relatório gerado pelo sistema DIROPS-SGA</p>
        </div>
    </div>
</body>
</html>`;

        return new Response(htmlContent, {
            status: 200,
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Content-Disposition': 'attachment; filename="relatorio_voos.html"'
            }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});