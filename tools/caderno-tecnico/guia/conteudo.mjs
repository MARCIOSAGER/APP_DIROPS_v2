// Conteúdo do Guia de Operação (separado do gerador para se poder rever o texto sem mexer na impressão).
// Factos verificados no servidor SRVKMS001 a 21/10/2026: serviços, portas, pastas, tarefas, scripts e registos.
export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const tabela = (cab, linhas, cls = '') => `<table class="${cls}${linhas.length <= 12 ? ' inteira' : ''}"><thead><tr>${cab.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${linhas.map(l => `<tr>${l.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
const code = (s) => `<code>${esc(s)}</code>`;
const bloco = (s) => `<pre>${esc(s.replace(/^\n/, ''))}</pre>`;
const nota = (s, tipo = 'info') => `<div class="nota ${tipo}">${s}</div>`;
const B = 'C:\\dirops\\sga-onpremise';
const GRAV = { alta: '<span class="prio-alta">Alta</span>', media: '<span class="prio-media">Média</span>', baixa: '<span class="prio-baixa">Baixa</span>' };

export const CAP = [
  ['c1', '1. Como usar este guia'],
  ['c2', '2. Mapa rápido da instalação'],
  ['c3', '3. Os primeiros cinco minutos (triagem)'],
  ['c4', '4. Catálogo de falhas e correcções'],
  ['c5', '5. Cópias de segurança e recuperação de desastre'],
  ['c6', '6. Manutenção periódica'],
  ['c7', '7. Expansão e mudanças planeadas'],
  ['c8', '8. Escalonamento e registo de incidentes'],
];
export const ANX = [['aA', 'Anexo A — Comandos de referência'], ['aB', 'Anexo B — Ficha de registo de incidente']];
const h1 = (id) => { const t = [...CAP, ...ANX].find(x => x[0] === id)[1]; return `<h1 id="${id}">${esc(t)}</h1>`; };

// ── ficha de falha: sintoma → causa → diagnóstico → correcção → prevenção ──
export const FALHAS = [];
function falha(id, titulo, { gravidade, sintoma, causa, diag, corr, prev }) {
  FALHAS.push([id, titulo, gravidade]);
  return `<div class="falha"><h2 id="${id}">${id} — ${esc(titulo)}</h2>
${tabela(['', ''], [['Gravidade', GRAV[gravidade]], ['Sintoma', sintoma], ['Causa provável', causa]]).replace('<thead><tr><th></th><th></th></tr></thead>', '').replace('<table class="', '<table class="ficha ').replace(/<tr><td>/g, '<tr><td class="r">')}
<h3>Diagnóstico</h3>${diag}
<h3>Correcção</h3>${corr}
${prev ? `<h3>Prevenção</h3>${prev}` : ''}</div>`;
}

const PSQL = `$env:PGPASSWORD = (Get-Content ${B}\\secrets\\postgres_password.txt -Raw).Trim()
$psql = '${B}\\postgres\\bin\\psql.exe'
& $psql -h 127.0.0.1 -U postgres -d dirops_sga`;

const RESTANTES = 'dirops-postgrest-v2, dirops-auth-v2, dirops-auth-uc-v2, dirops-auth-docs-v2, dirops-functions-v2, dirops-nginx-v2';

const cap4 = () => [
falha('F01', 'O site não abre em nenhum computador', {
  gravidade: 'alta',
  sintoma: 'O navegador mostra «Não é possível aceder a este site» ou fica a carregar em <code>http://10.1.65.45/</code>, para todos os utilizadores.',
  causa: 'Serviço <code>dirops-nginx-v2</code> parado; servidor desligado ou sem rede; porta 80 bloqueada pela firewall.',
  diag: bloco(`
Test-NetConnection 10.1.65.45 -Port 80          # a partir de outro computador da rede
Get-Service dirops-nginx-v2                     # no servidor
Get-Content ${B}\\nginx\\logs\\error.log -Tail 30`),
  corr: bloco('Restart-Service dirops-nginx-v2') + `<p>Se não arrancar, ver o fim de <code>nginx\\logs\\error.log</code>. O erro mais comum é o <code>nginx.conf</code> ter sido alterado com um erro de sintaxe: testar com <code>${B}\\nginx\\nginx.exe -t -p ${B}\\nginx\\</code> e repor a última cópia boa do ficheiro.</p>`,
  prev: '<p>Antes de alterar o <code>nginx.conf</code>, guardar uma cópia datada ao lado e testar com <code>nginx -t</code>.</p>',
}),
falha('F02', 'Página em branco ou «Erro na aplicação» só para alguns utilizadores', {
  gravidade: 'media',
  sintoma: 'O site abre mas fica em branco, mostra «Erro na aplicação», ou um utilizador continua a ver a versão antiga depois de uma actualização.',
  causa: '(1) O navegador ficou com a versão anterior do site em memória: o site é uma aplicação de página única e não recarrega sozinho. (2) O Google Tradutor do Chrome está a traduzir a página e corrompe-a (mensagens com «insertBefore» ou «removeChild»). (3) Erro real no código.',
  diag: '<p>Pedir ao utilizador <b>Ctrl+Shift+R</b>. Se persistir, ver os erros que os navegadores enviam para o servidor:</p>' + bloco(`Get-Content ${B}\\logs\\client-errors.jsonl -Tail 20`),
  corr: '<ul><li>Versão antiga: Ctrl+Shift+R, ou fechar e abrir o separador. Depois de cada publicação aparece também um aviso «nova versão disponível».</li><li>Google Tradutor: desligar a tradução para o site (ícone de tradução na barra de endereço → «Nunca traduzir este site»).</li><li>Erro real: enviar a linha do <code>client-errors.jsonl</code> à Direcção de Operações.</li></ul>',
}),
falha('F03', 'Não se consegue entrar (login) numa das plataformas', {
  gravidade: 'alta',
  sintoma: 'Login recusado, erro de ligação no ecrã de entrada, ou a pessoa entra e é mandada para fora.',
  causa: 'Cada plataforma tem o seu serviço de login: DIROPS <code>dirops-auth-v2</code> (9999), Universidade <code>dirops-auth-uc-v2</code> (9998), GED <code>dirops-auth-docs-v2</code> (9997). Serviço parado; senha errada; conta inactiva ou sem acesso a essa plataforma.',
  diag: bloco(`
Get-Service dirops-auth-v2, dirops-auth-uc-v2, dirops-auth-docs-v2
Invoke-WebRequest http://127.0.0.1/auth/v1/health -UseBasicParsing      # DIROPS
Invoke-WebRequest http://127.0.0.1/uc/auth/v1/health -UseBasicParsing   # Universidade
Invoke-WebRequest http://127.0.0.1/gd/auth/v1/health -UseBasicParsing   # GED
Get-Content ${B}\\logs\\svc-auth*.err.log -Tail 30`),
  corr: '<ul><li>Serviço parado: <code>Restart-Service</code> do serviço da plataforma afectada.</li><li>Se todos os logins falham ao mesmo tempo, ver F04 (antivírus) e F05 (base de dados).</li><li>Só uma pessoa: o administrador da plataforma repõe a senha ou reactiva a conta dentro da aplicação (DIROPS: gestão de utilizadores; Universidade e GED: Gestão › Acessos). No GED e na Universidade a conta precisa também de ter acesso a essa plataforma.</li></ul>',
  prev: nota('<b>Nunca correr <code>auth.exe migrate</code></b> nos serviços de login da Universidade ou do GED: o comando ignora o esquema configurado e altera as tabelas do login do DIROPS (aconteceu a 30/09/2026 e obrigou a reparação manual).', 'risco'),
}),
falha('F04', 'Todas as plataformas caem ao mesmo tempo (antivírus)', {
  gravidade: 'alta',
  sintoma: 'Os seis serviços <code>dirops-*-v2</code> param juntos ou não arrancam; chega um email «URGENTE» da verificação de integridade.',
  causa: 'O antivírus Check Point Harmony já classificou por engano o programa que corre os serviços como ameaça (falso positivo «Cryptominer», Agosto de 2026) e pô-lo em quarentena. Hoje esse programa é o <code>service-host\\DiropsServiceHost.exe</code>.',
  diag: bloco(`
Test-Path ${B}\\service-host\\DiropsServiceHost.exe
Get-Service dirops-* | Format-Table Name, Status
Get-Content ${B}\\logs\\integrity-wrapper.log -Tail 20
# consola do Check Point: quarentena e detecções do servidor SRVKMS001`),
  corr: '<ol><li>Na consola do Check Point: <b>restaurar</b> o ficheiro da quarentena e criar <b>exclusão</b> para a pasta <code>C:\\dirops\\sga-onpremise\\</code>.</li><li>Se o ficheiro não puder ser restaurado, correr como administrador o script de recuperação. Ele reinicia os serviços se o programa existir; senão recompila-o, ou vai buscá-lo à cópia no GitHub:</li></ol>' + bloco(`& ${B}\\scripts\\recovery-wrapper.ps1`),
  prev: '<p>Manter a exclusão de <code>C:\\dirops\\sga-onpremise\\</code> no Check Point (ficheiros e análise de comportamento). A tarefa <code>DIROPS-Integrity-Wrapper-Hourly</code> verifica o programa a cada hora e avisa por email.</p>',
}),
falha('F05', 'Base de dados parada ou disco cheio', {
  gravidade: 'alta',
  sintoma: 'Todas as páginas dão erro ao carregar dados; o login falha; o watchdog envia alerta da porta 5432.',
  causa: 'Serviço <code>postgresql-x64-16</code> parado. A causa mais provável é o <b>disco C: cheio</b>: o PostgreSQL pára quando não consegue escrever.',
  diag: bloco(`
Get-Service postgresql-x64-16
'{0:N1} GB livres' -f ((Get-PSDrive C).Free/1GB)
Get-ChildItem ${B}\\postgres-data\\log | Sort-Object LastWriteTime | Select-Object -Last 1 | Get-Content -Tail 40`),
  corr: '<ol><li>Se o disco estiver cheio, libertar espaço <b>fora</b> das pastas da plataforma (ver o aviso abaixo): reciclagem, temporários, versões antigas de programas.</li><li>Arrancar a base de dados e, a seguir, os serviços que dependem dela:</li></ol>' + bloco(`
Start-Service postgresql-x64-16
Restart-Service ${RESTANTES}`)
    + nota('<b>Nunca apagar nada dentro de <code>backups\\</code>, <code>storage\\</code> ou <code>postgres-data\\</code> para ganhar espaço.</b> Exemplo real: <code>backups\\storage-arquivo</code> parece uma cópia antiga pela data da pasta, mas é a cópia de segurança diária e acumulativa de todos os ficheiros. <code>postgres-data\\pg_wal</code> é indispensável à base de dados. Antes de apagar qualquer pasta da plataforma, ler o cabeçalho do script que a cria (<code>scripts\\*.ps1</code>).', 'risco'),
  prev: '<p>Alerta quando o C: descer abaixo de 15% livre. A cópia de ficheiros recusa-se a correr com menos de 5 GB livres, precisamente para não derrubar a base de dados. A solução definitiva é o disco de dados D: (E1).</p>',
}),
falha('F06', 'Plataforma lenta ou alerta «fora do ar» que se resolve sozinho', {
  gravidade: 'media',
  sintoma: 'Páginas demoram; o watchdog dá um serviço como parado e minutos depois está bem.',
  causa: 'Processador saturado (o servidor tem 2 núcleos). Os maiores consumidores observados: o Check Point (<code>EFRService</code>, <code>CPFileAnlyz</code>), a limpeza e actualização do Windows (<code>TiWorker</code>), picos da base de dados e ferramentas de desenvolvimento abertas no servidor. As verificações têm limite de 4 segundos; com o processador cheio, respondem tarde e parecem paradas.',
  diag: bloco(`
Get-Counter '\\Processor(_Total)\\% Processor Time' -SampleInterval 2 -MaxSamples 5
Get-Process | Sort-Object CPU -Descending | Select-Object -First 10 Name, CPU, @{n='RAM_MB';e={[int]($_.WorkingSet64/1MB)}}`),
  corr: '<ul><li>Antivírus em análise completa ou Windows Update: esperar, ou reagendar para fora do horário.</li><li>Se um serviço da plataforma estiver de facto parado, reiniciá-lo (secção 3).</li></ul>',
  prev: '<p>Exclusões do Check Point para <code>C:\\dirops\\sga-onpremise\\</code>; análises completas e actualizações do Windows fora do horário; não deixar ferramentas pesadas abertas no servidor; 4 vCPU (E2).</p>',
}),
falha('F07', 'Depois de uma alteração à base de dados, as páginas dão erro «schema cache»', {
  gravidade: 'media',
  sintoma: 'Erro «Could not find the \'X\' column … in the schema cache» ou «function … not found» logo a seguir a uma migração.',
  causa: 'A API de dados (PostgREST) guarda a estrutura da base em memória e não viu a alteração.',
  diag: '<p>A mensagem de erro é suficiente.</p>',
  corr: bloco(`& $psql -h 127.0.0.1 -U postgres -d dirops_sga -c "NOTIFY pgrst, 'reload schema';"
# alternativa: Restart-Service dirops-postgrest-v2`),
  prev: '<p>Todas as migrações terminam com <code>NOTIFY pgrst, \'reload schema\';</code>.</p>',
}),
falha('F08', 'Um utilizador não vê um documento, curso ou registo que devia ver', {
  gravidade: 'baixa',
  sintoma: 'A lista aparece vazia ou falta um item, sem mensagem de erro.',
  causa: 'Normalmente não é uma falha técnica: as regras de acesso da base de dados escondem o que o perfil não pode ver. Causas habituais: utilizador sem o aeroporto atribuído, perfil sem acesso à página, documento em rascunho (só quem o pode editar o vê) ou documento AVSEC de acesso restrito.',
  diag: '<p>Confirmar com um administrador da plataforma o perfil, os aeroportos e as plataformas da conta. Comparar com outro utilizador do mesmo perfil que veja o item.</p>',
  corr: '<p>Ajustar o perfil ou os aeroportos na própria aplicação. Não alterar regras de acesso directamente na base de dados.</p>',
}),
falha('F09', 'Os emails não chegam', {
  gravidade: 'media',
  sintoma: 'Convites, relatórios automáticos, alertas ou lembretes não chegam à caixa do destinatário.',
  causa: '(1) O relay SMTP da SGA só entrega para endereços <b>@sga.co.ao</b>; a aplicação recusa externos de propósito. (2) O relay trata envios em massa com cópia oculta como spam (erro 550); por isso a plataforma envia um email por pessoa. (3) Um servidor de correio interno recusou temporariamente o relay (erro 421 4.7.0, Julho de 2026, durante a migração para o Microsoft 365). (4) O destinatário já não existe (erro 550 5.1.10 «RecipientNotFound»). <b>«Enviado» na aplicação quer dizer só que o relay aceitou</b>; a entrega pode falhar depois.',
  diag: '<p>As devoluções (NDR) voltam à caixa do remetente da plataforma (<code>dirops@sga.co.ao</code>), com o código do erro e o servidor que recusou. Ver também:</p>' + bloco(`Get-Content ${B}\\logs\\svc-functions.out.log -Tail 80 | Select-String 'mail|smtp'`),
  corr: '<ul><li>Destinatário externo: não suportado; usar um endereço @sga.co.ao.</li><li>«RecipientNotFound»: corrigir o endereço na lista do relatório ou na conta do utilizador.</li><li>Erros 421 ou 550 do relay: pedido à equipa de correio, com a hora e o código do erro.</li><li>Credenciais SMTP alteradas: E8.</li></ul>',
}),
falha('F10', 'Relatórios automáticos por email não saem', {
  gravidade: 'media',
  sintoma: 'O relatório diário, semanal ou mensal do DIROPS não chega à hora habitual.',
  causa: 'Tarefa agendada <code>Relatorios-Dispatcher</code> (a cada 15 minutos) parada ou a falhar; ou falha de email (F09).',
  diag: bloco(`
Get-ScheduledTask Relatorios-Dispatcher | Get-ScheduledTaskInfo
Get-Content ${B}\\logs\\relatorios-dispatcher.log -Tail 40`),
  corr: '<p>Reactivar a tarefa ou corrigir a causa indicada no registo. Um relatório falhado pode ser reenviado a partir do DIROPS (Relatórios Automáticos).</p>',
}),
falha('F11', 'Ficheiro não abre, não carrega ou aparece estragado', {
  gravidade: 'media',
  sintoma: 'Documento ou anexo dá erro 404/403 ao abrir; o carregamento falha; uma imagem aparece estragada.',
  causa: 'Limites de tamanho do servidor web (50 MB na maioria dos carregamentos; 1,1 GB nos vídeos da Universidade); ficheiro privado sem permissão do utilizador (é o comportamento correcto); ficheiro apagado do armazenamento.',
  diag: bloco(`
Get-Content ${B}\\nginx\\logs\\error.log -Tail 50 | Select-String 'too large body|No such file'
Get-ChildItem ${B}\\storage -Recurse -Filter '*<parte-do-nome>*'`),
  corr: '<ul><li>Ficheiro demasiado grande: reduzir o ficheiro, ou aumentar <code>client_max_body_size</code> na rota respectiva do <code>nginx.conf</code> e reiniciar o nginx (F14).</li><li>Ficheiro apagado: recuperar da cópia acumulativa (secção 5.4).</li></ul>',
}),
falha('F12', 'Conversão de Word ou PowerPoint para PDF não termina', {
  gravidade: 'baixa',
  sintoma: 'A pré-visualização de um documento Office, ou o carregamento de uma apresentação na Universidade, fica a processar.',
  causa: 'O LibreOffice (usado em segundo plano para converter) ficou preso num ficheiro.',
  diag: bloco('Get-Process soffice* -ErrorAction SilentlyContinue | Select-Object Id, StartTime, CPU'),
  corr: bloco('Get-Process soffice* | Where-Object StartTime -lt (Get-Date).AddMinutes(-10) | Stop-Process -Force') + '<p>Depois, repetir a operação. Ficheiros com vídeos embutidos muito grandes demoram mais.</p>',
}),
falha('F13', 'Acentos estragados depois de correr um ficheiro SQL', {
  gravidade: 'baixa',
  sintoma: 'Textos gravados com «Ã©» ou «Ã§» em vez de «é» ou «ç».',
  causa: 'O <code>psql</code> no Windows assume a codificação WIN1252 e lê mal um ficheiro .sql gravado em UTF-8.',
  diag: '<p>Visível no próprio texto.</p>',
  corr: bloco(`$env:PGCLIENTENCODING = 'UTF8'     # antes de correr o ficheiro
& $psql -h 127.0.0.1 -U postgres -d dirops_sga -f <ficheiro.sql>`) + '<p>Para reparar texto já estragado, contactar a Direcção de Operações (a correcção depende de como foi gravado).</p>',
  prev: '<p>Definir sempre <code>PGCLIENTENCODING=UTF8</code> antes de correr ficheiros SQL.</p>',
}),
falha('F14', 'Uma alteração de configuração não tem efeito', {
  gravidade: 'baixa',
  sintoma: 'Alterou-se o <code>nginx.conf</code>, um ficheiro <code>.js</code> das funções ou um <code>.env</code> de um serviço, e nada mudou.',
  causa: 'Os serviços só lêem a configuração quando arrancam. Em particular, <code>nginx -s reload</code> <b>não funciona</b> com o nginx a correr como serviço.',
  diag: '<p>—</p>',
  corr: tabela(['Alterou', 'Comando'], [
    ['<code>nginx\\conf\\nginx.conf</code>', '<code>Restart-Service dirops-nginx-v2</code>'],
    ['<code>functions\\dirops-functions\\*.js</code> ou <code>service-migration\\env\\dirops-functions.env</code>', '<code>Restart-Service dirops-functions-v2</code>'],
    ['<code>config\\postgrest.conf</code>', '<code>Restart-Service dirops-postgrest-v2</code>'],
    ['<code>service-migration\\env\\dirops-auth*.env</code>', '<code>Restart-Service</code> do serviço de login respectivo'],
    ['<code>postgres-data\\postgresql.conf</code>', '<code>Restart-Service postgresql-x64-16</code>, depois os restantes (secção 3)'],
  ]),
}),
falha('F15', 'Links externos do GED (ANAC, auditores) não abrem', {
  gravidade: 'baixa',
  sintoma: 'Um link <code>https://docs.marciosager.com/s/…</code> ou <code>/p/…</code> enviado a uma entidade externa não abre fora da rede.',
  causa: 'O túnel Cloudflare (<code>cloudflared</code>, serviço Windows) parou; ou o link expirou ou foi revogado no GED.',
  diag: bloco(`Get-Service cloudflared
Get-Process cloudflared -ErrorAction SilentlyContinue`) + '<p>Testar o mesmo link dentro da rede. Se funcionar dentro e não fora, o problema é o túnel.</p>',
  corr: bloco('Restart-Service cloudflared') + `<p>Pormenores em <code>${B}\\cloudflare\\README-tunel-cloudflare.md</code>. Só as rotas <code>/s/</code> e <code>/p/</code> saem para a internet; o resto da plataforma nunca fica exposto.</p>`,
}),
falha('F16', 'Actualizações do Windows pendentes ou a limpeza do Windows falha', {
  gravidade: 'baixa',
  sintoma: '<code>DISM</code> devolve o erro 0x800f0806 («pending operations») ou 740 («elevated permissions»).',
  causa: '0x800f0806: há actualizações instaladas à espera de reinício. 740: a janela do PowerShell não está como administrador.',
  diag: bloco(`Test-Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Component Based Servicing\\RebootPending'
(Get-CimInstance Win32_OperatingSystem).LastBootUpTime`),
  corr: '<p>Reiniciar fora do horário (6.2) e repetir num PowerShell de administrador. A plataforma arranca sozinha depois do reinício (testado a 21/10/2026: os sete serviços voltaram sem intervenção). A limpeza <code>/StartComponentCleanup</code> pode ficar mais de uma hora nos 99%: é normal, não interromper.</p>',
}),
].join('\n');

export function conteudo({ logo, HOJE, VERSAO }) {
  FALHAS.length = 0;
  const C4 = cap4();
  return `
<section class="capa">
  <div><img src="${logo}" alt="SGA"></div>
  <div><div class="titulo">Guia de Operação<br>e Resolução de Problemas</div><div class="sub">DIROPS · Universidade Corporativa · Portal de Documentos (GED)</div></div>
  <table class="meta"><tbody>
    <tr><td>Servidor</td><td>SRVKMS001 — 10.1.65.45 (rede interna SGA)</td></tr>
    <tr><td>Versão</td><td>${VERSAO} — ${HOJE}</td></tr>
    <tr><td>Destinatário</td><td>Equipa de Tecnologias de Informação da SGA</td></tr>
    <tr><td>Responsável funcional</td><td>Direcção de Operações — oaeroportos@sga.co.ao</td></tr>
    <tr><td>Documento associado</td><td>Caderno Técnico das Plataformas SGA (descrição da instalação)</td></tr>
    <tr><td>Classificação</td><td>Uso interno. <b>Não contém senhas nem chaves</b> (indica só onde estão).</td></tr>
  </tbody></table>
</section>

<h1 class="semquebra" style="page-break-before: always">Índice</h1>
@@INDICE@@
<h2>Controlo do documento</h2>
${tabela(['Versão', 'Data', 'Elaborado por', 'Descrição'], [[VERSAO, HOJE, 'Direcção de Operações', 'Edição inicial para a equipa de TI.']])}

${h1('c1')}
<p>Este guia diz <b>o que fazer</b> quando algo falha nas plataformas, como recuperar de um desastre e como executar as expansões previstas. A descrição completa da instalação (arquitectura, tabelas, versões, rotas) está no <b>Caderno Técnico das Plataformas SGA</b>; aqui só se repete o necessário para agir.</p>
<h2>Como está organizado</h2>
${tabela(['Se…', 'Ir para'], [
  ['Algo deixou de funcionar e não se sabe porquê', '<b>Secção 3</b>: triagem em cinco minutos, que encaminha para a falha certa'],
  ['Já se conhece o sintoma', '<b>Secção 4</b>: catálogo de falhas F01 a F16, cada uma com sintoma, causa, diagnóstico, correcção e prevenção'],
  ['Perdeu-se informação ou o servidor', '<b>Secção 5</b>: cópias de segurança e recuperação'],
  ['Tarefas de rotina', '<b>Secção 6</b>: manutenção semanal, mensal e trimestral'],
  ['Mais disco, memória, servidor novo, rodar credenciais', '<b>Secção 7</b>: procedimentos de expansão E1 a E8'],
])}
<h2>Regras de ouro</h2>
<ol>
<li><b>Primeiro observar, depois agir.</b> Correr os comandos de diagnóstico e guardar o resultado antes de reiniciar: um reinício apaga as pistas.</li>
<li><b>Reiniciar só o serviço afectado.</b> Reiniciar o servidor inteiro é o último recurso.</li>
<li><b>Nada dentro de <code>backups\\</code>, <code>storage\\</code>, <code>postgres-data\\</code> ou <code>secrets\\</code> se apaga</b> sem ler primeiro o script que o cria e sem confirmar com a Direcção de Operações.</li>
<li><b>Antes de alterar um ficheiro de configuração, guardar uma cópia datada ao lado</b> (por exemplo <code>nginx.conf.bak-20261021</code>).</li>
<li><b>Mudanças planeadas fora do horário</b> e anunciadas aos utilizadores: a operação aeroportuária usa o DIROPS todos os dias.</li>
<li><b>Nunca colar senhas em emails, chats ou pedidos.</b> As credenciais estão em <code>${B}\\secrets\\</code>, legíveis só por administradores.</li>
<li><b>Registar cada incidente</b> (Anexo B): o que se viu, o que se fez e quando.</li>
</ol>
<h2>Convenções</h2>
<p>Os comandos são para <b>PowerShell como administrador</b> no servidor SRVKMS001, salvo indicação em contrário. <code>$psql</code> refere-se ao bloco de ligação à base de dados do Anexo A. A pasta-base é <code>${B}</code>.</p>

${h1('c2')}
<h2>2.1 Serviços</h2>
${tabela(['Serviço Windows', 'Porta', 'Para que serve', 'Se parar'], [
  ['<code>dirops-nginx-v2</code>', '80', 'Servidor web: entrega o site e encaminha os pedidos', 'Nada abre (F01)'],
  ['<code>dirops-postgrest-v2</code>', '3000', 'API de dados', 'Páginas sem dados'],
  ['<code>dirops-functions-v2</code>', '4001', 'Ficheiros, emails, relatórios, PDF, avaliações', 'Sem ficheiros nem emails'],
  ['<code>dirops-auth-v2</code>', '9999', 'Login do DIROPS', 'Não se entra no DIROPS'],
  ['<code>dirops-auth-uc-v2</code>', '9998', 'Login da Universidade', 'Não se entra na Universidade'],
  ['<code>dirops-auth-docs-v2</code>', '9997', 'Login do GED', 'Não se entra no GED'],
  ['<code>postgresql-x64-16</code>', '5432', 'Base de dados <code>dirops_sga</code> (as três plataformas)', 'Tudo falha (F05)'],
  ['<code>cloudflared</code>', 'saída 443', 'Túnel só para os links externos do GED', 'Links externos não abrem (F15)'],
])}
<p>Os seis serviços <code>dirops-*-v2</code> correm através do <code>service-host\\DiropsServiceHost.exe</code> e arrancam sozinhos com o Windows. Só o nginx escuta na rede; os outros só em 127.0.0.1.</p>
<h2>2.2 Pastas importantes</h2>
${tabela(['Pasta (em ' + esc(B) + ')', 'Conteúdo', 'Cuidado'], [
  ['<code>storage\\</code>', 'Ficheiros das três plataformas: <code>private-uploads</code> (GED) e <code>uploads</code> (fotografias do DIROPS, materiais da Universidade)', 'Dados de produção'],
  ['<code>postgres-data\\</code>', 'Base de dados', 'Não mexer com o serviço a correr'],
  ['<code>backups\\</code>', 'Cópias diárias da base (<code>*.dump</code>), cópia acumulativa dos ficheiros (<code>storage-arquivo</code>), manifestos, <code>backup.log</code>', '<b>Não apagar</b>'],
  ['<code>secrets\\</code>, <code>config\\</code>, <code>service-migration\\env\\</code>', 'Credenciais e configuração dos serviços', 'Só administradores'],
  ['<code>nginx\\conf\\</code>, <code>nginx\\html\\</code>', 'Configuração do servidor web e site publicado', 'Cópia antes de alterar'],
  ['<code>functions\\dirops-functions\\</code>', 'Código do servidor de funções', 'Cópias <code>*.bak-*</code> antes de cada alteração'],
  ['<code>scripts\\</code>', 'Cópias de segurança, watchdog, recuperação, teste de restauro', ''],
  ['<code>logs\\</code>', 'Registos dos serviços e erros dos navegadores', 'Limpos sozinhos após 14 dias'],
])}
<h2>2.3 Tarefas agendadas</h2>
${tabela(['Tarefa', 'Quando', 'O que faz'], [
  ['<code>DIROPS-Backup-Daily</code>', 'Diário 02:00', 'Cópia da base de dados (14 dias) e, a seguir, dos ficheiros para o arquivo acumulativo, com manifesto do dia'],
  ['<code>DIROPS-Watchdog</code>', 'A cada 5 min', 'Verifica serviços, portas e respostas; envia alerta por email (no máximo 1 por 30 min por problema)'],
  ['<code>DIROPS-Integrity-Wrapper-Hourly</code>', 'A cada hora', 'Confirma que o programa dos serviços está íntegro e os seis serviços em execução'],
  ['<code>Relatorios-Dispatcher</code>', 'A cada 15 min', 'Envia os relatórios automáticos do DIROPS'],
  ['<code>DIROPS-LogCleanup-Daily</code>, <code>dirops-log-cleanup</code>', 'Diário 03:00', 'Apagam registos com mais de 14 dias'],
])}
<p>As tarefas correm como SYSTEM e só são visíveis no Agendador de Tarefas com uma sessão de administrador.</p>
<h2>2.4 Onde ver o que aconteceu</h2>
${tabela(['Registo', 'Mostra'], [
  ['<code>logs\\svc-*.log</code>', 'Arranques, paragens e erros de cada serviço'],
  ['<code>nginx\\logs\\error.log</code> e <code>access.log</code>', 'Pedidos web, erros 4xx/5xx, ficheiros grandes recusados'],
  ['<code>postgres-data\\log\\</code>', 'Erros da base de dados'],
  ['<code>logs\\client-errors.jsonl</code>', 'Erros que acontecem no navegador dos utilizadores'],
  ['<code>backups\\backup.log</code>', 'Resultado de cada cópia de segurança'],
  ['<code>logs\\watchdog.log</code>, <code>logs\\integrity-wrapper.log</code>', 'Verificações automáticas'],
  ['<code>logs\\relatorios-dispatcher.log</code>', 'Envio dos relatórios automáticos'],
  ['Auditoria dentro das plataformas', 'Quem fez o quê (registo inviolável)'],
])}

${h1('c3')}
<p>Correr este bloco e guardar o resultado. Em menos de um minuto, diz qual a parte que falhou.</p>
${bloco(`
Get-Service dirops-*, postgresql-x64-16, cloudflared | Format-Table Name, Status
foreach ($p in 80,3000,4001,9999,9998,9997,5432) {
  '{0,5} {1}' -f $p, (Test-NetConnection 127.0.0.1 -Port $p -WarningAction SilentlyContinue).TcpTestSucceeded }
foreach ($u in '/healthz','/auth/v1/health','/uc/auth/v1/health','/gd/auth/v1/health') {
  try { '{0} {1}' -f $u, (Invoke-WebRequest "http://127.0.0.1$u" -UseBasicParsing -TimeoutSec 10).StatusCode }
  catch { "$u FALHA $($_.Exception.Message)" } }
'{0:N1} GB livres em C:' -f ((Get-PSDrive C).Free/1GB)
(Get-Counter '\\Processor(_Total)\\% Processor Time').CounterSamples.CookedValue
Get-Content ${B}\\backups\\backup.log -Tail 4`)}
<h2>Encaminhamento</h2>
${tabela(['O que o bloco mostra', 'Ir para'], [
  ['Todos os <code>dirops-*</code> parados', 'F04 (antivírus), depois F05'],
  ['<code>postgresql-x64-16</code> parado ou porta 5432 a False', 'F05'],
  ['Só o nginx parado ou porta 80 a False', 'F01'],
  ['Um serviço de login parado ou um <code>/…/auth/v1/health</code> com FALHA', 'F03'],
  ['Tudo bem, mas utilizadores com página em branco', 'F02'],
  ['Tudo bem, processador acima de 90%', 'F06'],
  ['Menos de 5 GB livres', 'F05 (não apagar pastas da plataforma)'],
  ['Última cópia de segurança com ERRO ou com mais de um dia', 'Secção 5.2'],
  ['Tudo bem e o problema é de emails', 'F09 / F10'],
])}
<h2>Reiniciar</h2>
${bloco(`Restart-Service dirops-functions-v2          # trocar pelo nome do serviço afectado
Get-Service dirops-functions-v2               # confirmar Running`)}
${nota('Ordem quando é preciso reiniciar tudo: primeiro <code>postgresql-x64-16</code>; depois <code>dirops-postgrest-v2</code> e os três <code>dirops-auth*</code>; depois <code>dirops-functions-v2</code>; por fim <code>dirops-nginx-v2</code>.')}

${h1('c4')}
<p>Cada ficha segue a mesma ordem: <b>sintoma</b> (o que os utilizadores vêem), <b>causa provável</b>, <b>diagnóstico</b> (comandos para confirmar), <b>correcção</b> e <b>prevenção</b>. A gravidade indica o impacto: ${GRAV.alta} pára uma plataforma; ${GRAV.media} degrada o serviço; ${GRAV.baixa} afecta um caso.</p>
@@RESUMO@@
${C4}

${h1('c5')}
<h2>5.1 O que está protegido</h2>
${tabela(['O quê', 'Como', 'Onde', 'Retenção'], [
  ['Base de dados (as três plataformas)', '<code>pg_dump</code> diário às 02:00 (<code>scripts\\backup-postgres.ps1</code>)', '<code>backups\\dirops_sga_AAAAMMDD_HHMMSS.dump</code> (cerca de 12 MB)', '14 dias'],
  ['Ficheiros (documentos, fotografias, materiais)', '<code>robocopy</code> diário a seguir, <b>acumulativo: nunca apaga</b> (<code>scripts\\backup-storage.ps1</code>)', '<code>backups\\storage-arquivo\\</code>', 'Tudo, sempre'],
  ['Inventário dos ficheiros', 'Manifesto diário: nome, tamanho, data e, nos documentos do GED, SHA-256', '<code>backups\\manifestos\\manifesto_AAAAMMDD.csv</code>', '90 dias'],
  ['Código do site', 'Repositório Git privado', 'GitHub <code>MARCIOSAGER/APP_DIROPS_v2</code>', '—'],
  ['Código do servidor, SQL, nginx e programa dos serviços', 'Repositório Git privado', 'GitHub <code>MARCIOSAGER/sga-onpremise-stack</code>', '—'],
])}
${nota('<b>Limite actual:</b> as cópias da base de dados e dos ficheiros estão no <b>mesmo disco</b> do servidor. Protegem contra apagar por engano e contra ficheiros corrompidos, mas <b>não</b> contra a perda do disco ou do servidor, nem contra ransomware. A cópia para fora do servidor (E4) é a acção mais importante deste guia.', 'risco')}
<h2>5.2 Confirmar que as cópias estão a funcionar</h2>
${bloco(`Get-Content ${B}\\backups\\backup.log -Tail 15
Get-ChildItem ${B}\\backups\\*.dump | Sort-Object LastWriteTime | Select-Object -Last 3 Name, Length, LastWriteTime`)}
<p>Teste de restauro completo, sem tocar na produção: restaura a última cópia numa base temporária, compara as contagens e apaga-a.</p>
${bloco(`& ${B}\\scripts\\dr-test.ps1
Get-Content ${B}\\logs\\dr-test-restore.log -Tail 20`)}
<h2>5.3 Restaurar a base de dados</h2>
<h3>Uma tabela ou alguns registos (caso mais comum)</h3>
<p>Restaurar a cópia para uma base <b>temporária</b>, consultar e copiar só o necessário. A produção não pára.</p>
${bloco(`$dump = (Get-ChildItem ${B}\\backups\\dirops_sga_*.dump | Sort-Object LastWriteTime | Select-Object -Last 1).FullName
& ${B}\\postgres\\bin\\createdb.exe -h 127.0.0.1 -U postgres dirops_sga_recuperar
& ${B}\\postgres\\bin\\pg_restore.exe -h 127.0.0.1 -U postgres -d dirops_sga_recuperar --no-owner $dump
# consultar em dirops_sga_recuperar, copiar o que faltar para dirops_sga; no fim:
& ${B}\\postgres\\bin\\dropdb.exe -h 127.0.0.1 -U postgres dirops_sga_recuperar`)}
<h3>A base inteira (desastre)</h3>
${nota('Perde-se tudo o que foi registado desde a cópia (até 24 horas). Só com decisão da Direcção de Operações.', 'alerta')}
${bloco(`Stop-Service dirops-nginx-v2, dirops-functions-v2, dirops-postgrest-v2, dirops-auth-v2, dirops-auth-uc-v2, dirops-auth-docs-v2
& $psql -h 127.0.0.1 -U postgres -d postgres -c "ALTER DATABASE dirops_sga RENAME TO dirops_sga_avariada;"
& ${B}\\postgres\\bin\\createdb.exe -h 127.0.0.1 -U postgres dirops_sga
& ${B}\\postgres\\bin\\pg_restore.exe -h 127.0.0.1 -U postgres -d dirops_sga $dump
Start-Service ${RESTANTES}`)}
<p>A base avariada fica com outro nome até se confirmar que o restauro está bom; só depois se apaga.</p>
<h2>5.4 Recuperar um ficheiro apagado</h2>
<p>A cópia acumulativa guarda todos os ficheiros que alguma vez existiram, com a mesma estrutura de pastas. Para saber o nome e a pasta de um documento num dia concreto, procurar no manifesto desse dia.</p>
${bloco(`Select-String -Path ${B}\\backups\\manifestos\\manifesto_20261020.csv -Pattern '<parte-do-nome>'
Copy-Item ${B}\\backups\\storage-arquivo\\private-uploads\\<ficheiro> ${B}\\storage\\private-uploads\\`)}
<h2>5.5 Perda total do servidor</h2>
<p>Só é possível <b>se existir cópia fora do servidor</b> (E4). Com ela, a reconstrução é:</p>
<ol>
<li>Servidor Windows Server novo; instalar PostgreSQL 16, Node.js 20, LibreOffice e Chrome.</li>
<li>Clonar <code>sga-onpremise-stack</code> (serviços, funções, nginx, SQL, scripts) para <code>${B}</code> e o site <code>APP_DIROPS_v2</code> para <code>C:\\dirops\\APP_DIROPS_v2</code>.</li>
<li>Repor <code>secrets\\</code>, <code>config\\</code> e <code>service-migration\\env\\</code> a partir da cópia externa (nunca estão no Git).</li>
<li>Restaurar a base de dados (5.3) e copiar <code>storage-arquivo</code> para <code>storage\\</code>.</li>
<li>Recompilar o programa dos serviços (<code>service-host\\build.cmd</code>), registar os serviços e as tarefas agendadas, publicar o site (Anexo A).</li>
<li>Correr a triagem (secção 3) e o <code>dr-test.ps1</code>.</li>
</ol>
<p>Tempo estimado: um dia de trabalho, com a Direcção de Operações presente.</p>

${h1('c6')}
<h2>6.1 Calendário</h2>
${tabela(['Frequência', 'Tarefa', 'Como'], [
  ['Contínua (automática)', 'Watchdog, verificação de integridade, cópias de segurança', 'Só agir se chegar email de alerta'],
  ['Semanal', 'Confirmar as cópias de segurança', '<code>backups\\backup.log</code> sem ERRO nos últimos 7 dias (5.2)'],
  ['Semanal', 'Espaço em disco', 'Mais de 15% livre em C: (e em D:, depois de E1)'],
  ['Mensal', 'Teste de restauro', '<code>scripts\\dr-test.ps1</code>; guardar o resultado'],
  ['Mensal', 'Actualizações do Windows e reinício', 'Fora do horário (6.2)'],
  ['Mensal', 'Erros nos navegadores', 'Rever <code>logs\\client-errors.jsonl</code> e enviar novidades à Direcção de Operações'],
  ['Trimestral', 'Contas e acessos', 'Com a Direcção de Operações: desactivar contas de quem saiu; rever administradores'],
  ['Trimestral', 'Exclusões do antivírus', 'Confirmar que <code>C:\\dirops\\sga-onpremise\\</code> continua excluída no Check Point'],
  ['Anual ou após incidente', 'Rodar credenciais', 'E8'],
])}
<h2>6.2 Reinício programado do servidor</h2>
<ol>
<li>Avisar os utilizadores: a plataforma fica em baixo 5 a 10 minutos.</li>
<li>Confirmar que a cópia de segurança da noite terminou bem (5.2).</li>
<li>Reiniciar: ${code('shutdown /r /t 300 /c "Reinicio programado"')} (cancelar com ${code('shutdown /a')}).</li>
<li>Depois do arranque, correr a triagem (secção 3). Os serviços arrancam sozinhos.</li>
<li>Se houver limpeza do Windows pendente: ${code('Dism.exe /Online /Cleanup-Image /StartComponentCleanup')} como administrador (pode demorar mais de uma hora e ficar nos 99%).</li>
</ol>

${h1('c7')}
<p>Procedimentos para as mudanças previstas. Todos se fazem <b>fora do horário</b>, com a cópia de segurança da noite confirmada e com a triagem (secção 3) no fim.</p>

<h2 id="E1">E1 — Disco de dados D: e mudança dos ficheiros e das cópias</h2>
<p>Pedido à TI: disco novo de 250 GB. O disco C: (89 GB) fica só para o Windows e os programas.</p>
<ol>
<li>Anexar o disco à VM, inicializar em GPT, formatar NTFS com a letra <b>D:</b> e o nome <code>DADOS-PLATAFORMAS</code>.</li>
<li>Criar <code>D:\\sga-dados\\storage</code> e <code>D:\\sga-dados\\backups</code> com as mesmas permissões das pastas actuais (Administradores, SYSTEM e a conta de serviço).</li>
<li>Parar os serviços que escrevem ficheiros: ${code('Stop-Service dirops-nginx-v2, dirops-functions-v2')}</li>
<li>Copiar e conferir:</li>
</ol>
${bloco(`robocopy ${B}\\storage D:\\sga-dados\\storage /E /COPY:DAT /R:1 /W:2
robocopy ${B}\\backups D:\\sga-dados\\backups /E /COPY:DAT /R:1 /W:2
# o número de ficheiros e o total têm de ser iguais na origem e no destino:
Get-ChildItem ${B}\\storage -Recurse -File | Measure-Object Length -Sum
Get-ChildItem D:\\sga-dados\\storage -Recurse -File | Measure-Object Length -Sum`)}
<ol start="5">
<li>Apontar as funções para o novo armazenamento: acrescentar ${code('STORAGE_ROOT=D:\\sga-dados\\storage')} a <code>service-migration\\env\\dirops-functions.env</code>.</li>
<li>Em <code>scripts\\backup-postgres.ps1</code> e <code>scripts\\backup-storage.ps1</code>, mudar o destino para <code>D:\\sga-dados\\backups</code> e a origem dos ficheiros para <code>D:\\sga-dados\\storage</code>; no <code>backup-storage.ps1</code>, a verificação de espaço livre passa a ser do disco D:.</li>
<li>Arrancar (${code('Start-Service dirops-functions-v2, dirops-nginx-v2')}) e abrir um documento do GED, uma fotografia do DIROPS e um vídeo da Universidade.</li>
<li>Correr à mão as duas cópias de segurança e confirmar o <code>backup.log</code>.</li>
<li>Só depois de <b>uma semana</b> sem problemas, renomear as pastas antigas do C: (<code>storage.antigo</code>, <code>backups.antigo</code>) e, mais tarde, apagá-las com a Direcção de Operações.</li>
</ol>
<p>Paragem prevista: cerca de 15 minutos (3,4 GB de ficheiros hoje).</p>

<h2 id="E2">E2 — Mais memória (16 GB) e mais processadores (4 vCPU)</h2>
<ol>
<li>Desligar a VM fora do horário, alterar a memória e os vCPU, ligar. A plataforma funciona sem mais nada.</li>
<li>Para a base de dados aproveitar a memória: em <code>postgres-data\\postgresql.conf</code>, mudar ${code('shared_buffers = 128MB')} para ${code('shared_buffers = 2GB')} e definir ${code('effective_cache_size = 8GB')}; depois ${code('Restart-Service postgresql-x64-16')} e os restantes serviços (ordem da secção 3).</li>
</ol>

<h2 id="E3">E3 — Editor de documentos no navegador (ONLYOFFICE Docs)</h2>
<p>Depende de E1 e E2: precisa de 4 a 6 GB de memória e 40 GB de disco. A integração já está feita na plataforma e <b>desligada</b>. O procedimento completo (requisitos, instalação, activação e teste de aceitação com o Manual de Operações do Aeródromo) está em <code>C:\\dirops\\APP_DIROPS_v2\\tools\\ged-edicao\\INSTALAR-ONLYOFFICE.md</code>. Instalar a versão <b>9.4 ou superior</b> (processo único, sem base de dados nem fila de mensagens próprias) e excluir a pasta de instalação no Check Point.</p>

<h2 id="E4">E4 — Cópia de segurança fora do servidor</h2>
<p>Pedido à TI: um destino num NAS ou noutro servidor da SGA, com uma conta de serviço só com permissão de escrita nessa pasta. Depois, uma tarefa agendada diária às 04:00 (depois das cópias das 02:00):</p>
${bloco(`robocopy D:\\sga-dados\\backups \\\\<servidor-ou-nas>\\<partilha>\\SRVKMS001 /E /XO /R:2 /W:30 /NP /LOG+:D:\\sga-dados\\backups\\copia-externa.log`)}
<p>Incluir também, numa pasta à parte e com acesso restrito, uma cópia de <code>secrets\\</code>, <code>config\\</code> e <code>service-migration\\env\\</code>: sem elas, a reconstrução (5.5) é muito mais lenta. Confirmar todos os meses que a cópia externa tem a data do dia anterior.</p>

<h2 id="E5">E5 — Arquivo contínuo da base de dados</h2>
<p>Hoje a perda máxima é de até 24 horas (uma cópia por noite). Com o arquivo contínuo das alterações (WAL), a base pode ser recuperada até ao minuto anterior à falha. Fazer depois de E1 e E4:</p>
${bloco(`# postgres-data\\postgresql.conf
archive_mode = on
archive_command = 'copy "%p" "D:\\\\sga-dados\\\\wal\\\\%f"'
# mais uma cópia de base semanal:
#   pg_basebackup -D D:\\sga-dados\\base-AAAAMMDD -Ft -z -X fetch
# Restart-Service postgresql-x64-16; apagar o WAL anterior à penúltima cópia de base`)}

<h2 id="E6">E6 — HTTPS (se a decisão mudar)</h2>
<p>A Direcção de Operações aceitou o risco de HTTP na rede interna, porque o site é exclusivamente interno. Se for preciso activar: certificado da autoridade interna da SGA para <code>srvkms001.sga.net</code> (e para o IP, se usado), bloco <code>listen 443 ssl</code> no <code>nginx.conf</code> com redireccionamento do 80, e reinício do nginx. Actualizar depois os endereços públicos configurados nos serviços de login (variáveis <code>*_URL</code> nos ficheiros <code>.env</code>) e reiniciá-los.</p>

<h2 id="E7">E7 — Mudança para um servidor novo</h2>
<ol>
<li>Preparar o servidor novo como em 5.5 (passos 1 a 3), sem o ligar aos utilizadores.</li>
<li>Ensaio: restaurar a cópia mais recente e copiar o <code>storage</code>; testar as três plataformas pelo IP novo.</li>
<li>Dia da mudança, fora do horário: parar os serviços no SRVKMS001; última cópia da base (<code>backup-postgres.ps1</code>) e <code>robocopy</code> final do <code>storage</code>; restaurar no novo; mudar o DNS ou o IP; triagem.</li>
<li>Manter o SRVKMS001 desligado mas intacto durante um mês, como recurso.</li>
<li>Instalar o <code>cloudflared</code> no servidor novo e removê-lo do antigo.</li>
</ol>

<h2 id="E8">E8 — Rodar credenciais</h2>
${tabela(['Credencial', 'Ficheiros a actualizar', 'Reiniciar', 'Efeito para os utilizadores'], [
  ['Conta de envio de email (SMTP)', '<code>secrets\\smtp_*.txt</code>, <code>service-migration\\env\\dirops-functions.env</code>', '<code>dirops-functions-v2</code>', 'Nenhum'],
  ['Senha do utilizador <code>postgres</code>', '<code>ALTER ROLE</code>; <code>secrets\\postgres_password.txt</code>; <code>.env</code> dos três logins', 'Serviços de login', 'Nenhum'],
  ['Senha do <code>authenticator</code>', '<code>ALTER ROLE</code>; <code>config\\postgrest.conf</code>; <code>secrets\\authenticator_password.txt</code>', '<code>dirops-postgrest-v2</code>', 'Nenhum'],
  ['Segredo JWT e chaves da API', '<code>secrets\\jwt_secret.txt</code>; novas chaves com <code>scripts\\mint_keys.js</code>; todos os <code>.env</code>, <code>postgrest.conf</code> e o site (nova publicação)', 'Todos', '<b>Todos têm de voltar a entrar</b>'],
])}
<p>Rodar uma de cada vez, fora do horário, guardando cópia dos ficheiros antigos. Coordenar com a Direcção de Operações, que tem de republicar o site quando mudam as chaves da API.</p>

${h1('c8')}
<h2>8.1 Quem contactar</h2>
${tabela(['Situação', 'Contacto'], [
  ['Falha que este guia não resolve; dúvidas sobre a aplicação', 'Direcção de Operações — oaeroportos@sga.co.ao'],
  ['Antivírus (quarentena, exclusões)', 'Administrador do Check Point da SGA'],
  ['Correio (relay, Exchange, Microsoft 365)', 'Equipa de correio da SGA'],
  ['VM, disco, memória, rede, firewall', 'Equipa de infraestrutura da SGA'],
])}
<h2>8.2 Quando escalar</h2>
<ul>
<li><b>Imediatamente:</b> qualquer falha de gravidade ${GRAV.alta} que não se resolva em 30 minutos; suspeita de perda de dados; suspeita de acesso indevido.</li>
<li><b>No próprio dia:</b> cópias de segurança a falhar; disco abaixo de 10% livre.</li>
<li><b>Na semana:</b> falhas de gravidade ${GRAV.media} ou ${GRAV.baixa} que se repetem.</li>
</ul>
<h2>8.3 Durante um incidente</h2>
<ol>
<li>Avisar os utilizadores afectados (o DIROPS é usado pela operação todos os dias).</li>
<li>Guardar o resultado da triagem e os registos antes de reiniciar.</li>
<li>Corrigir e confirmar com a triagem.</li>
<li>Preencher a ficha do Anexo B e enviá-la à Direcção de Operações.</li>
</ol>

${h1('aA')}
<h2>Ligar à base de dados</h2>
${bloco(PSQL)}
<h2>Estado geral</h2>
${bloco(`Get-Service dirops-*, postgresql-x64-16, cloudflared | Format-Table Name, Status, StartType
Invoke-WebRequest http://127.0.0.1/healthz -UseBasicParsing`)}
<h2>Serviços</h2>
${bloco(`Restart-Service dirops-nginx-v2
Restart-Service dirops-functions-v2
Restart-Service dirops-postgrest-v2
Restart-Service dirops-auth-v2, dirops-auth-uc-v2, dirops-auth-docs-v2
Restart-Service postgresql-x64-16     # depois os restantes (ordem da secção 3)`)}
<h2>Base de dados</h2>
${bloco(`& $psql -h 127.0.0.1 -U postgres -d dirops_sga -c "NOTIFY pgrst, 'reload schema';"
$env:PGCLIENTENCODING = 'UTF8'; & $psql -h 127.0.0.1 -U postgres -d dirops_sga -f <ficheiro.sql>
& $psql -h 127.0.0.1 -U postgres -d dirops_sga -c "select pg_size_pretty(pg_database_size('dirops_sga'));"`)}
<h2>Cópias de segurança</h2>
${bloco(`& ${B}\\scripts\\backup-postgres.ps1      # cópia da base agora
& ${B}\\scripts\\backup-storage.ps1       # cópia dos ficheiros agora
& ${B}\\scripts\\dr-test.ps1              # teste de restauro
Get-Content ${B}\\backups\\backup.log -Tail 20`)}
<h2>Espaço e carga</h2>
${bloco(`'{0:N1} GB livres' -f ((Get-PSDrive C).Free/1GB)
Get-Process | Sort-Object CPU -Descending | Select-Object -First 10 Name, CPU, @{n='RAM_MB';e={[int]($_.WorkingSet64/1MB)}}`)}
<h2>Publicar uma nova versão do site (Direcção de Operações)</h2>
${bloco(`cd C:\\dirops\\APP_DIROPS_v2
npm test -- --run
Remove-Item -Recurse -Force dist; npm run build
Copy-Item -Recurse -Force dist\\* ${B}\\nginx\\html\\`)}

${h1('aB')}
<p>Copiar para um email ou documento e enviar à Direcção de Operações depois de cada incidente.</p>
${tabela(['Campo', 'Preencher'], [
  ['Data e hora do início', '&nbsp;'],
  ['Detectado por (utilizador, watchdog, TI)', '&nbsp;'],
  ['Plataforma(s) afectada(s)', 'DIROPS / Universidade / GED'],
  ['Sintoma', '&nbsp;'],
  ['Ficha do catálogo (F01–F16) ou «nova»', '&nbsp;'],
  ['Resultado da triagem (secção 3)', 'anexar'],
  ['Causa identificada', '&nbsp;'],
  ['Acções executadas (com hora)', '&nbsp;'],
  ['Hora de reposição do serviço', '&nbsp;'],
  ['Houve perda de dados? Qual?', '&nbsp;'],
  ['Prevenção proposta', '&nbsp;'],
  ['Responsável', '&nbsp;'],
])}
`;
}
