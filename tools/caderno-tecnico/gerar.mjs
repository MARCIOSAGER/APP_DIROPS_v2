// Caderno Técnico das plataformas (DIROPS, Universidade Corporativa, GED) — gera HTML e PDF A4.
// Os números (tabelas, tamanhos, versões, serviços, tarefas) vêm de tools/caderno-tecnico/dados/*, recolhidos no
// servidor; o texto técnico está aqui. Duas passagens: a 1.ª descobre em que página começa cada capítulo, a 2.ª
// escreve o índice com os números de página.
//   node tools/caderno-tecnico/gerar.mjs        → tools/caderno-tecnico/Caderno_Tecnico_Plataformas_SGA.pdf
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const DIR = 'C:/dirops/APP_DIROPS_v2/tools/caderno-tecnico/';
const ler = (f) => fs.readFileSync(DIR + f, 'utf8').replace(/^\uFEFF/, '');
const bd = JSON.parse(ler('dados/bd.json'));
const sis = JSON.parse(ler('dados/sistema.json'));
const tarefasRaw = JSON.parse(ler('dados/tarefas.json'));
// só ficheiros numerados (fora os de teste), por ordem numérica: 01, 02, 031…, 04, 05, 050…
const migracoes = ler('dados/migracoes.txt').split(/\r?\n/).filter(m => /^\d/.test(m))
  .sort((a, b) => parseInt(a, 10) - parseInt(b, 10) || a.localeCompare(b));
const logo = 'data:image/png;base64,' + fs.readFileSync('C:/dirops/APP_DIROPS_v2/public/logo-sga.png').toString('base64');
const HOJE = '20/10/2026';
const VERSAO = '1.0';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const num = (n) => (n == null ? '—' : Number(n).toLocaleString('pt-PT'));
const tabela = (cab, linhas, cls = '') => `<table class="${cls}${linhas.length <= 12 ? ' inteira' : ''}"><thead><tr>${cab.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${linhas.map(l => `<tr>${l.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
const code = (s) => `<code>${esc(s)}</code>`;
const codeNW = (s) => `<code class="nw">${esc(s)}</code>`;
const bloco = (s) => `<pre>${esc(s)}</pre>`;
const nota = (s, tipo = 'info') => `<div class="nota ${tipo}">${s}</div>`;
const mb = (b) => (b / 1048576).toFixed(1).replace('.', ',') + ' MB';

// ── plataforma de cada tabela ──
function plataforma(t) {
  if (t.esquema === 'auth') return 'Login DIROPS';
  if (t.esquema === 'auth_uc') return 'Login Universidade';
  if (t.esquema === 'auth_docs') return 'Login GED';
  const n = t.tabela;
  if (/^(documento|documentos|pasta|log_acesso_documento|conformidade_)/.test(n)) return 'GED';
  if (/^(universidade|aula|curso|certificado|quiz|tentativa|trilha|sessao_|matricula|modulo|pergunta|progresso_aula|scorm|aluno_|distintivo|pontos_formacao|formacao_externa|notificacao_formacao)/.test(n)) return 'Universidade';
  if (/^(users|empresa|aeroporto|log_auditoria|regra_permissao|configuracao_sistema|api_|performance_log|placeholder|ticket_suporte|solicitacao_acesso|grupo_whats_app)/.test(n)) return 'Comum';
  return 'DIROPS';
}
const tabs = bd.tabelas.map(t => ({ ...t, plat: plataforma(t) }));
const ORDEM_PLAT = ['DIROPS', 'Universidade', 'GED', 'Comum', 'Login DIROPS', 'Login Universidade', 'Login GED'];
const porPlat = {};
for (const t of tabs) { const k = t.plat; porPlat[k] = porPlat[k] || { n: 0, bytes: 0, linhas: 0, v: 0 }; if (t.tipo === 'v') porPlat[k].v++; else porPlat[k].n++; porPlat[k].bytes += t.bytes || 0; porPlat[k].linhas += t.linhas || 0; }
const pub = tabs.filter(t => t.esquema === 'public');
const semRls = pub.filter(t => t.tipo === 'r' && !t.rls);

// ── serviços ──
const servicos = Array.isArray(sis.servicos) ? sis.servicos : [sis.servicos];
const ESTADO = { Running: 'Em execução', Stopped: 'Parado' }, ARRANQUE = { Auto: 'Automático', Manual: 'Manual', Disabled: 'Desactivado' };
const PORTA_SVC = { 'dirops-nginx-v2': '0.0.0.0:80', 'dirops-postgrest-v2': '127.0.0.1:3000', 'dirops-functions-v2': '127.0.0.1:4001', 'dirops-auth-v2': '127.0.0.1:9999', 'dirops-auth-uc-v2': '127.0.0.1:9998', 'dirops-auth-docs-v2': '127.0.0.1:9997', 'postgresql-x64-16': '127.0.0.1:5432' };
const PAPEL_SVC = {
  'dirops-nginx-v2': 'Servidor web: entrega o site das três plataformas e encaminha os pedidos para os serviços internos.',
  'dirops-postgrest-v2': 'API de dados (REST) sobre a base de dados; aplica as regras de acesso (RLS) de cada utilizador.',
  'dirops-functions-v2': 'Funções do servidor (Node.js): ficheiros, emails, relatórios, links partilháveis, carimbo de PDF, avaliações, convites.',
  'dirops-auth-v2': 'Login do DIROPS (GoTrue, esquema auth).',
  'dirops-auth-uc-v2': 'Login da Universidade Corporativa (GoTrue, esquema auth_uc).',
  'dirops-auth-docs-v2': 'Login do Portal de Documentos — GED (GoTrue, esquema auth_docs).',
  'postgresql-x64-16': 'Base de dados PostgreSQL 16 (base dirops_sga).',
};
const ORDEM_SVC = ['dirops-nginx-v2', 'dirops-postgrest-v2', 'dirops-functions-v2', 'dirops-auth-v2', 'dirops-auth-uc-v2', 'dirops-auth-docs-v2', 'postgresql-x64-16'];

// ── tarefas agendadas (exportadas por um administrador; só as da plataforma) ──
const DESC_TAREFA = {
  'DIROPS-Backup-Daily': ['Diário 02:00', 'Cópia da base de dados (pg_dump) e, a seguir, dos ficheiros (robocopy) — scripts\\backup-postgres.ps1 + backup-storage.ps1.'],
  'DIROPS-LogCleanup-Daily': ['Diário 03:00', 'Apaga registos com mais de 14 dias — scripts\\cleanup-old-logs.ps1.'],
  'DIROPS-Watchdog': ['A cada 5 min', 'Verifica serviços, portas (incl. os três logins), /healthz e a API; em falha envia alerta por email (no máximo 1 por 30 min por problema) — scripts\\watchdog.ps1.'],
  'DIROPS-Integrity-Wrapper-Hourly': ['A cada hora', 'Confirma que o DiropsServiceHost.exe está íntegro (hash) e que os 6 serviços estão em execução; detecta quarentena do antivírus — scripts\\integrity-check-wrapper.ps1.'],
  'Relatorios-Dispatcher': ['A cada 15 min', 'Envia os relatórios automáticos agendados no DIROPS (diário, semanal, mensal) — relatorios\\run-dispatcher.cmd.'],
};
const tarefas = (Array.isArray(tarefasRaw) ? tarefasRaw : [tarefasRaw]).filter(t => DESC_TAREFA[t.Tarefa]);

const FUNCOES = [
  ['admin-user', 'Gestão de contas pelo administrador do DIROPS (criar, bloquear, repor senha).'],
  ['send-email / send-notification-email', 'Envio de emails pelo relay da SGA.'],
  ['system-alert', 'Alertas do sistema para o email de alertas.'],
  ['log-error / errors-recent', 'Recolha de erros do navegador (logs\\client-errors.jsonl) e consulta dos recentes.'],
  ['get-dashboard-stats / gerar-relatorio', 'Painel e relatórios operacionais (PDF/HTML) do DIROPS.'],
  ['fr24-proxy / flightaware-proxy', 'Consulta a serviços externos de dados de voo (saída para a Internet).'],
  ['data-api', 'API de dados para integrações (chaves em api_key, limites em api_rate_limit).'],
  ['chatbot-ia', 'Assistente de IA do DIROPS.'],
  ['cloudflare-metrics', 'Métricas de Cloudflare (painel).'],
  ['universidade-acesso', 'Universidade: pedidos de acesso, convites, perfis, revogações.'],
  ['lms-upload', 'Universidade: carregamento de conteúdos grandes (vídeo, pacotes HTML5/SCORM, Office→PDF).'],
  ['quiz-state / quiz-start / quiz-save / quiz-submit / quiz-grade', 'Universidade: avaliações corrigidas no servidor (o gabarito nunca vai ao navegador).'],
  ['xapi-launch', 'Universidade: lançamento de pacotes SCORM/xAPI com registo de progresso.'],
  ['documentos-acesso', 'GED: pedidos, convites, perfis, revogação, senhas de pasta/documento.'],
  ['documentos-aprovacao', 'GED: fluxo de aprovação e assinaturas.'],
  ['documentos-folhas', 'GED: folhas preliminares do manual (rosto, índice, páginas efectivas, registo de emendas).'],
  ['share-link-create / share-link-revoke / share-link-config / share-selection-create', 'GED: links partilháveis com externos (/p/, /s/) e sua revogação.'],
];

const PASTAS = [
  ['C:\\dirops\\sga-onpremise\\', '—', 'Raiz da instalação de produção.'],
  ['  postgres\\', '212 MB', 'Binários do PostgreSQL 16.6 (psql, pg_dump, pg_restore).'],
  ['  postgres-data\\', '1,0 GB', 'Dados da base de dados (nunca copiar com o serviço a correr).'],
  ['  postgrest\\', '66 MB', 'Binário do PostgREST 14.12 (a configuração está em config\\postgrest.conf).'],
  ['  bin\\', '97 MB', 'auth.exe (GoTrue compilado) e cloudflared.exe.'],
  ['  nginx\\', '1,4 GB', 'nginx 1.26.2: conf\\nginx.conf (rotas), html\\ (site publicado, incl. conteúdos H5P e vídeo), logs\\.'],
  ['  functions\\dirops-functions\\', '7 MB', 'Servidor de funções Node.js (server.js, docs-pdf.js, docs-folhas.js, docs-fluxo.js, lms-quiz.js); versionado no Git.'],
  ['  service-host\\', '112 KB', 'DiropsServiceHost.exe (supervisor dos serviços) e conf\\*.ini de cada serviço.'],
  ['  service-migration\\env\\', '<1 MB', 'Variáveis de ambiente lidas pelos serviços (credenciais). CONFIDENCIAL.'],
  ['  config\\', '34 KB', 'Cópias de origem dos .env, postgrest.conf (lido pelo PostgREST). CONFIDENCIAL.'],
  ['  secrets\\', '14 KB', 'Chaves e senhas geradas na instalação (Anexo C). CONFIDENCIAL.'],
  ['  sql\\', '1,6 MB', 'Migrações da base de dados 01–171 (as seguintes estão em APP_DIROPS_v2\\tools\\); versionado no Git.'],
  ['  scripts\\', '128 KB', 'Cópias de segurança, vigilância, limpeza de registos, ensaio de restauro, activação dos logins.'],
  ['  relatorios\\', '23 KB', 'Lançadores dos relatórios automáticos (run-dispatcher.cmd).'],
  ['  storage\\', '3,4 GB', 'Ficheiros dos utilizadores: uploads\\ (2,4 GB), private-uploads\\ (1,1 GB), _previsualizacao\\, tmp\\.'],
  ['  backups\\', '3,6 GB', 'Cópias diárias da base de dados (14 dias), arquivo de ficheiros (storage-arquivo\\), manifestos, arquivo-tabelas\\.'],
  ['  logs\\', '74 MB', 'Registos dos serviços, erros do navegador (client-errors.jsonl), vigilância.'],
  ['  email-templates\\', '72 KB', 'Modelos de email dos logins da Universidade (uc\\) e do GED (gd\\).'],
  ['  installers\\', '1,6 GB', 'Instaladores originais (PostgreSQL, nginx, PostgREST, Go, LibreOffice, Chrome, Tesseract, Ghostscript, Python, ffmpeg).'],
  ['  go\\, gopath\\', '685 MB', 'Ferramentas Go usadas para compilar o GoTrue.'],
  ['  archive\\, _legado-backup-*\\', '47 MB', 'Material antigo da migração e versões anteriores.'],
  ['C:\\dirops\\APP_DIROPS_v2\\', '1,7 GB', 'Código-fonte do site (React/Vite), repositório Git; dist\\ = compilação; tools\\ = ferramentas e migrações recentes.'],
];

const VERSOES = [
  ['Windows Server 2019 Datacenter', '10.0.17763', 'Sistema operativo'],
  ['PostgreSQL', esc(bd.versao.match(/PostgreSQL ([\d.]+)/)[1]), 'Base de dados'],
  ['PostgREST', '14.12', 'API REST sobre a base de dados'],
  ['GoTrue (Supabase Auth)', 'compilado do código-fonte (Go 1.26.3); 3 instâncias', 'Autenticação'],
  ['nginx', '1.26.2', 'Servidor web e proxy'],
  ['Node.js / npm', '20.18.0 / 10.8.2', 'Servidor de funções; compilação do site'],
  ['DiropsServiceHost', 'versão própria (C#)', 'Supervisor dos serviços Windows'],
  ['LibreOffice', '26.8.0', 'Conversão Office→PDF'],
  ['ffmpeg', '9.0.2 (portátil, installers\\ffmpeg)', 'Vídeo da Universidade'],
  ['Tesseract OCR', '5.4.0', 'Texto de PDF digitalizado (pesquisa do GED)'],
  ['Ghostscript', '10.08.0', 'Tratamento de PDF'],
  ['Python', '3.12 (C:\\Program Files\\Python312)', 'Ferramentas de conversão'],
  ['Google Chrome', '153.0.8010.50', 'Geração de PDF e testes'],
  ['Git', '2.45.2', 'Controlo de versões'],
  ['cloudflared', 'em bin\\ — não está em uso', 'Túnel Cloudflare (preparado, inactivo)'],
  ['Site: React / Vite', '18.2 / 6.1', 'Aplicação de página única das três plataformas'],
  ['supabase-js / TanStack Query', '2.98 / 5.84', 'Cliente de dados no navegador'],
  ['pdf.js / jsPDF / SheetJS', '4.10 / 4.2 / 0.18.5', 'Leitor de PDF, PDF gerados, Excel'],
  ['nodemailer', '8.0', 'Envio de email (funções)'],
];

// ── capítulos (id, título) — usados no índice e na contagem de páginas ──
const CAP = [
  ['c1', '1. Identificação e finalidade'], ['c2', '2. Arquitectura'], ['c3', '3. Servidor e sistema operativo'],
  ['c4', '4. Software instalado e versões'], ['c5', '5. Serviços, portas e rede'], ['c6', '6. Estrutura de pastas'],
  ['c7', '7. Base de dados'], ['c8', '8. Autenticação, perfis e controlo de acesso'], ['c9', '9. API e funções do servidor'],
  ['c10', '10. Armazenamento de ficheiros'], ['c11', '11. Email'], ['c12', '12. Aplicação web e publicação'],
  ['c13', '13. Operação do dia-a-dia'], ['c14', '14. Cópias de segurança e recuperação'], ['c15', '15. Monitorização, tarefas agendadas e registos'],
  ['c16', '16. Segurança: controlos existentes'], ['c17', '17. Riscos e recomendações'], ['c18', '18. Responsabilidades e contactos'],
];
const ANX = [['aA', 'Anexo A — Inventário das tabelas'], ['aB', 'Anexo B — Migrações da base de dados'], ['aC', 'Anexo C — Índice de credenciais (sem valores)'], ['aD', 'Anexo D — Rotas do servidor web'], ['aE', 'Anexo E — Termos e siglas']];
const h1 = (id) => { const t = [...CAP, ...ANX].find(x => x[0] === id)[1]; return `<h1 id="${id}">${esc(t)}</h1>`; };

function montar(paginas) {
  const pg = (id) => (paginas[id] ? String(paginas[id]) : '');
  const linhaIndice = ([id, t], anexo) => `<li class="${anexo ? 'anx' : ''}"><span class="t">${esc(t)}</span><span class="pt"></span><span class="p">${pg(id)}</span></li>`;
  return `<!doctype html><html lang="pt"><head><meta charset="utf-8"><title>Caderno Técnico das Plataformas SGA</title>
<style>
@page { size: A4; margin: 20mm 15mm 17mm 15mm;
  @top-left { content: "Caderno Técnico das Plataformas SGA"; font: 7.5pt "Segoe UI", Arial; color: #64748b; }
  @top-right { content: "Uso interno"; font: 7.5pt "Segoe UI", Arial; color: #64748b; }
  @bottom-left { content: "Versão ${VERSAO} — ${HOJE}"; font: 7.5pt "Segoe UI", Arial; color: #64748b; }
  @bottom-right { content: "Página " counter(page) " de " counter(pages); font: 7.5pt "Segoe UI", Arial; color: #64748b; } }
@page :first { @top-left { content: none; } @top-right { content: none; } @bottom-left { content: none; } @bottom-right { content: none; } }
* { box-sizing: border-box; }
body { font-family: "Segoe UI", Arial, sans-serif; font-size: 9.5pt; color: #1e293b; line-height: 1.45; margin: 0; }
h1 { font-size: 17pt; color: #0b3b6f; margin: 0 0 4mm; padding-bottom: 2mm; border-bottom: 2px solid #0b3b6f; page-break-before: always; }
h1.semquebra { page-break-before: auto; }
h2 { font-size: 12pt; color: #0b3b6f; margin: 6mm 0 2mm; page-break-after: avoid; }
h3 { font-size: 10.3pt; margin: 4mm 0 1.5mm; color: #334155; page-break-after: avoid; }
p { margin: 1.5mm 0 2.5mm; } ul { margin: 1mm 0 3mm; padding-left: 5mm; } li { margin: 0.8mm 0; }
table { width: 100%; border-collapse: collapse; margin: 2mm 0 4mm; font-size: 8.5pt; }
thead { display: table-header-group; }
th { background: #0b3b6f; color: #fff; text-align: left; padding: 1.5mm 2mm; font-weight: 600; }
td { padding: 1.3mm 2mm; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
tr { page-break-inside: avoid; } table.inteira { page-break-inside: avoid; } tbody tr:nth-child(even) td { background: #f8fafc; }
table.mini { font-size: 7.4pt; } table.mini td, table.mini th { padding: 0.8mm 1.4mm; }
td.n { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
code.nw { white-space: nowrap; word-break: normal; }
table.mini td { white-space: nowrap; } table.mini td:last-child { white-space: normal; }
code { font-family: Consolas, monospace; font-size: 8.2pt; background: #f1f5f9; padding: 0 1mm; border-radius: 2px; word-break: break-word; }
pre { font-family: Consolas, monospace; font-size: 7.8pt; background: #0f172a; color: #e2e8f0; padding: 3mm; border-radius: 3px; white-space: pre-wrap; page-break-inside: avoid; }
.nota { border-left: 3px solid #0369a1; background: #f0f9ff; padding: 2mm 3mm; margin: 2mm 0 4mm; page-break-inside: avoid; }
.nota.alerta { border-color: #b45309; background: #fffbeb; } .nota.risco { border-color: #b91c1c; background: #fef2f2; }
.capa { height: 255mm; display: flex; flex-direction: column; justify-content: space-between; }
.capa img { width: 62mm; } .capa .titulo { font-size: 30pt; font-weight: 700; color: #0b3b6f; line-height: 1.1; margin-top: 50mm; }
.capa .sub { font-size: 14pt; color: #334155; margin-top: 5mm; }
.capa .meta td { border: none; padding: 1mm 0; background: none !important; font-size: 10pt; } .capa .meta td:first-child { color: #64748b; width: 45mm; }
.indice { list-style: none; padding: 0; margin: 2mm 0 6mm; }
.indice li { display: flex; align-items: baseline; margin: 1.3mm 0; font-size: 10pt; }
.indice li.anx { font-size: 9.5pt; color: #334155; } .indice .pt { flex: 1; border-bottom: 1px dotted #94a3b8; margin: 0 2mm; transform: translateY(-1mm); }
.indice .p { min-width: 8mm; text-align: right; font-variant-numeric: tabular-nums; }
.prio-alta { color: #b91c1c; font-weight: 700; } .prio-media { color: #b45309; font-weight: 700; } .prio-baixa { color: #0369a1; font-weight: 700; }
/* diagrama */
.arq { border: 1px solid #cbd5e1; border-radius: 4px; padding: 4mm; background: #f8fafc; page-break-inside: avoid; font-size: 8.3pt; }
.arq .lin { display: flex; gap: 3mm; justify-content: center; align-items: stretch; }
.arq .cx { border: 1.5px solid #0b3b6f; border-radius: 4px; background: #fff; padding: 2mm 3mm; text-align: center; flex: 1; }
.arq .cx b { display: block; color: #0b3b6f; font-size: 9pt; } .arq .cx small { color: #475569; display: block; line-height: 1.3; }
.arq .cx.ext { border-style: dashed; border-color: #64748b; }
.arq .seta { text-align: center; color: #0b3b6f; font-size: 11pt; line-height: 1; margin: 1.5mm 0; }
.arq .rotas { font-family: Consolas, monospace; font-size: 7.4pt; text-align: left; color: #334155; margin-top: 1.5mm; }
</style></head><body>

<section class="capa">
  <div><img src="${logo}" alt="SGA"></div>
  <div><div class="titulo">Caderno Técnico<br>das Plataformas</div><div class="sub">DIROPS · Universidade Corporativa · Portal de Documentos (GED)</div></div>
  <table class="meta"><tbody>
    <tr><td>Servidor</td><td>${esc(sis.host)} — ${esc(sis.ips)} (rede interna SGA)</td></tr>
    <tr><td>Versão</td><td>${VERSAO} — ${HOJE}</td></tr>
    <tr><td>Destinatário</td><td>Equipa de Tecnologias de Informação da SGA</td></tr>
    <tr><td>Responsável funcional</td><td>Direcção de Operações — oaeroportos@sga.co.ao</td></tr>
    <tr><td>Classificação</td><td>Uso interno. Descreve a infraestrutura; <b>não contém senhas nem chaves</b> (indica só onde estão).</td></tr>
  </tbody></table>
</section>

<h1 class="semquebra" style="page-break-before: always">Índice</h1>
<ul class="indice">${CAP.map(c => linhaIndice(c, false)).join('')}</ul>
<ul class="indice">${ANX.map(c => linhaIndice(c, true)).join('')}</ul>
<h2>Controlo do documento</h2>
${tabela(['Versão', 'Data', 'Elaborado por', 'Descrição'], [[VERSAO, HOJE, 'Direcção de Operações', 'Edição inicial para a equipa de TI.']])}
<p>Os valores deste caderno (versões, serviços, portas, tarefas, tabelas e tamanhos) foram recolhidos no próprio servidor a ${HOJE}. O gerador está em <code>C:\\dirops\\APP_DIROPS_v2\\tools\\caderno-tecnico\\</code> e volta a produzir o documento quando a instalação mudar. O <code>RUNBOOK.md</code> da pasta <code>C:\\dirops\\sga-onpremise\\</code> é um resumo operacional deste caderno.</p>

${h1('c1')}
<p>As três plataformas correm num único servidor da rede interna da SGA e partilham a mesma base de dados, mas têm <b>login, perfis e páginas próprios</b>.</p>
${tabela(['Plataforma', 'Endereço', 'Finalidade', 'Login'], [
  ['<b>DIROPS</b>', codeNW('http://10.1.65.45/'), 'Gestão operacional da Direcção de Operações: voos e movimentos, tarifas e facturação (incl. Pronto Pagamento), KPI, Safety (ocorrências, inspecções, GRF), auditorias e planos de acção correctiva, credenciamento, manutenção, relatórios automáticos por email.', 'Próprio (esquema auth)'],
  ['<b>Universidade Corporativa</b>', codeNW('http://10.1.65.45/universidade'), 'Formação (LMS): cursos, aulas, vídeo, SCORM/xAPI, avaliações, certificados, trilhas, sessões presenciais, matriz de formação obrigatória.', 'Próprio (esquema auth_uc)'],
  ['<b>Portal de Documentos (GED)</b>', codeNW('http://10.1.65.45/documentos'), 'Gestão documental: manuais e procedimentos por aeroporto, versões, aprovação, emendas, Estrutura do MOA/PSA, regime AVSEC de acesso restrito, links para entidades externas (ANAC).', 'Próprio (esquema auth_docs)'],
])}
<p>Endereços públicos sem login (servidos pelas funções do servidor): ${code('/p/…')} e ${code('/s/…')} (links partilháveis do GED), ${code('/v/…')} (verificação) e ${code('/cert/…')} (verificação de certificados da Universidade).</p>
<p><b>Utilizadores:</b> ${num(bd.contas.users_activos)} contas activas na ficha comum de utilizadores (<code>public.users</code>). Contas de login: DIROPS ${num(bd.contas.auth)}, Universidade ${num(bd.contas.auth_uc)}, GED ${num(bd.contas.auth_docs)}.</p>
<p><b>Origem:</b> a aplicação foi desenvolvida na plataforma em nuvem Base44/Supabase e migrada em 2026 para esta instalação local (on-premise). Não existe hoje qualquer ligação ou sincronização com a nuvem.</p>

${h1('c2')}
<div class="arq">
  <div class="lin"><div class="cx ext"><b>Utilizadores</b><small>navegador na rede interna da SGA</small></div></div>
  <div class="seta">▼ HTTP :80</div>
  <div class="lin"><div class="cx"><b>nginx 1.26.2</b><small>serviço dirops-nginx-v2 · 0.0.0.0:80</small>
    <div class="rotas">/ /universidade /documentos → site (nginx\\html)<br>/rest/v1 · /uc/rest/v1 · /gd/rest/v1 → PostgREST<br>/auth/v1 · /uc/auth/v1 · /gd/auth/v1 → GoTrue DIROPS · UC · GED<br>/functions/v1 · /storage · /p/ /s/ /v/ /cert/ → funções Node</div></div></div>
  <div class="seta">▼</div>
  <div class="lin">
    <div class="cx"><b>PostgREST 14.12</b><small>API de dados<br>127.0.0.1:3000</small></div>
    <div class="cx"><b>GoTrue ×3</b><small>logins DIROPS · UC · GED<br>127.0.0.1:9999 · 9998 · 9997</small></div>
    <div class="cx"><b>Funções Node 20</b><small>ficheiros, email, PDF, quiz<br>127.0.0.1:4001</small></div>
  </div>
  <div class="seta">▼</div>
  <div class="lin">
    <div class="cx"><b>PostgreSQL 16.6</b><small>base dirops_sga · 127.0.0.1:5432<br>esquemas public · auth · auth_uc · auth_docs</small></div>
    <div class="cx"><b>storage\\</b><small>ficheiros dos utilizadores<br>uploads · private-uploads</small></div>
    <div class="cx ext"><b>Saídas externas</b><small>relay SMTP mail.sga.co.ao:25<br>dados de voo (HTTPS) · GitHub (SSH)</small></div>
  </div>
</div>
<h2>2.1 Como um pedido é autorizado</h2>
<p>O utilizador entra pelo login da sua plataforma (GoTrue), que emite um <b>token JWT</b> assinado com um segredo comum às três instâncias. O site envia esse token em cada pedido. O PostgREST executa a consulta com o papel <code>authenticated</code> e as <b>regras de acesso por linha (RLS)</b> da base de dados decidem o que a pessoa vê, a partir do email do token, dos perfis em <code>public.users</code> e dos aeroportos a que tem acesso. As funções do servidor verificam o mesmo token e usam a chave de serviço apenas em operações que o próprio código controla.</p>
<h2>2.2 Princípios da instalação</h2>
<ul>
<li>Só o nginx aceita ligações da rede (porta 80); todos os outros serviços escutam apenas em 127.0.0.1.</li>
<li>Os dados nunca são filtrados só no navegador: a base de dados aplica as regras de acesso em todas as tabelas de dados.</li>
<li>Os ficheiros privados (documentos do GED) só se obtêm com endereço assinado e temporário; os PDF são entregues com carimbo de “cópia não controlada”.</li>
</ul>

${h1('c3')}
${tabela(['Item', 'Valor'], [
  ['Nome', esc(sis.host) + ' (srvkms001.sga.net)'], ['Endereço IP', esc(sis.ips)], ['Sistema operativo', 'Windows Server 2019 Datacenter (10.0.17763)'],
  ['Processador', 'Intel Xeon Silver 4110 @ 2,10 GHz — 2 núcleos'], ['Memória', sis.ram_gb + ' GB (≈ 90% ocupada a ' + HOJE + ')'], ['Disco', 'C: 89 GB, 19 GB livres'], ['Fuso horário', 'Angola (UTC+1, sem hora de Verão)'],
])}
${nota('<b>Capacidade:</b> 2 núcleos e 8 GB servem a carga actual, com picos de processador causados sobretudo pelo antivírus Check Point Harmony e por conversões de documentos e vídeo. A memória trabalha perto do limite e o disco C: guarda também as cópias de segurança (recomendações R1, R2 e R6).', 'alerta')}
${nota('<b>Antivírus:</b> o Check Point Harmony já colocou em quarentena, por falso positivo, o supervisor de serviços usado anteriormente (nssm.exe), deixando a plataforma em baixo. O supervisor actual (DiropsServiceHost) é vigiado de hora a hora. Recomenda-se manter <code>C:\\dirops\\sga-onpremise\\</code> na lista de confiança do Check Point.', 'alerta')}

${h1('c4')}
${tabela(['Componente', 'Versão', 'Função'], VERSOES)}
<p>Todo o software do servidor é de código aberto (PostgreSQL, PostgREST, GoTrue, nginx, Node.js, LibreOffice, Tesseract, Ghostscript, ffmpeg), com excepção do Windows e do Chrome. Os instaladores originais estão em <code>C:\\dirops\\sga-onpremise\\installers\\</code>; o código do supervisor DiropsServiceHost está no repositório privado <code>MARCIOSAGER/sga-onpremise-stack</code>.</p>

${h1('c5')}
${tabela(['Serviço Windows', 'Estado', 'Arranque', 'Escuta', 'Função'], ORDEM_SVC.map(n => servicos.find(s => s.nome === n)).filter(Boolean).map(s => [codeNW(s.nome), ESTADO[s.estado] || esc(s.estado), ARRANQUE[s.arranque] || esc(s.arranque), esc(PORTA_SVC[s.nome] || '—'), esc(PAPEL_SVC[s.nome] || s.display)]))}
<p>Os serviços <code>dirops-*-v2</code> correm através do <b>DiropsServiceHost</b> (<code>service-host\\DiropsServiceHost.exe --config service-host\\conf\\&lt;serviço&gt;.ini</code>), que arranca o programa, o reinicia se cair e escreve os registos em <code>logs\\svc-*.log</code>. Contas: LocalSystem; o PostgreSQL usa NetworkService.</p>
<h2>5.1 Matriz de portas</h2>
${tabela(['Porta', 'Endereço', 'Processo', 'Acesso'], [
  ['80/TCP', '0.0.0.0', 'nginx', '<b>Aberta à rede interna da SGA</b>'],
  ['3000/TCP', '127.0.0.1', 'postgrest', 'Só local'], ['4001/TCP', '127.0.0.1', 'node (funções)', 'Só local'], ['5432/TCP', '127.0.0.1', 'postgres', 'Só local'],
  ['9997, 9998, 9999/TCP', '127.0.0.1', 'auth (GoTrue GED, Universidade, DIROPS)', 'Só local'],
])}
<h2>5.2 Ligações de saída</h2>
${tabela(['Destino', 'Porta', 'Para quê'], [
  ['mail.sga.co.ao (relay SMTP interno)', '25', 'Emails: convites, recuperação de senha, relatórios automáticos, alertas.'],
  ['Internet', '443', 'Dados de voo (FR24, FlightAware); pacotes npm ao compilar o site.'],
  ['github.com', '22 (SSH)', 'Envio do código para os repositórios privados (chaves de implementação dedicadas).'],
])}

${h1('c6')}
${tabela(['Pasta', 'Tamanho', 'Conteúdo'], PASTAS.map(p => [code(p[0]), p[1], esc(p[2])]), 'mini')}
${nota('Não apagar nem mover nada em <code>postgres-data\\</code>, <code>storage\\</code>, <code>config\\</code>, <code>secrets\\</code> ou <code>service-migration\\env\\</code> sem parar os serviços e sem cópia de segurança.', 'alerta')}

${h1('c7')}
${tabela(['Item', 'Valor'], [
  ['Motor', 'PostgreSQL ' + esc(bd.versao.match(/PostgreSQL ([\d.]+)/)[1]) + ' (64 bits)'], ['Base de produção', 'dirops_sga — ' + esc(bd.tamanho_bd)], ['Pasta de dados', code('C:\\dirops\\sga-onpremise\\postgres-data')],
  ['Escuta', '127.0.0.1:5432 (só local)'], ['Ligações máximas', esc(bd.parametros.max_connections)], ['shared_buffers / work_mem', '128 MB / 4 MB'],
  ['Arquivo de WAL', 'desligado (wal_level replica, archive_mode off): não há recuperação a um ponto no tempo — ver capítulo 14'],
  ['Extensões', bd.extensoes.map(e => esc(e.nome) + ' ' + esc(e.versao)).join(', ')],
  ['Objectos', `${tabs.filter(t => t.tipo === 'r').length} tabelas, ${tabs.filter(t => t.tipo === 'v').length} vistas, ${num(bd.politicas_total)} regras RLS, ${num(bd.gatilhos)} gatilhos, ${bd.funcoes.reduce((a, f) => a + f.n, 0)} funções`],
])}
<h2>7.1 Esquemas</h2>
${tabela(['Esquema', 'Conteúdo'], [
  [code('public'), 'Dados das três plataformas e funções das regras de acesso.'], [code('auth'), 'Contas e sessões do login do DIROPS (gerido pelo GoTrue).'],
  [code('auth_uc'), 'Contas e sessões do login da Universidade.'], [code('auth_docs'), 'Contas e sessões do login do GED.'],
])}
<h2>7.2 Papéis da base de dados</h2>
${tabela(['Papel', 'Inicia sessão', 'Superutilizador', 'Ignora RLS', 'Utilização'], bd.papeis.map(r => [codeNW(r.nome), r.login ? 'sim' : 'não', r.super ? 'sim' : 'não', r.bypassrls ? 'sim' : 'não',
  ({ postgres: 'Administração (migrações, cópias). Usado também pelos três GoTrue (recomendação R5).', authenticator: 'Ligação do PostgREST; assume anon, authenticated ou service_role conforme o token.', anon: 'Pedidos sem login — limitados ao mínimo.', authenticated: 'Utilizador com login, sujeito às regras RLS.', service_role: 'Funções do servidor, em operações controladas no código.', dirops: 'Proprietário da base dirops_sga, criado na instalação. Não é usado pelos serviços.' })[r.nome] || '']))}
<h2>7.3 Tabelas por plataforma</h2>
${tabela(['Plataforma', 'Tabelas', 'Vistas', 'Linhas', 'Espaço'], ORDEM_PLAT.filter(k => porPlat[k]).map(k => [esc(k), porPlat[k].n, porPlat[k].v, num(porPlat[k].linhas), mb(porPlat[k].bytes)]))}
<h3>Maiores tabelas</h3>
${tabela(['Tabela', 'Plataforma', 'Linhas', 'Espaço'], tabs.filter(t => t.tipo === 'r').sort((a, b) => b.bytes - a.bytes).slice(0, 12).map(t => [codeNW(t.esquema + '.' + t.tabela), esc(t.plat), num(t.linhas), esc(t.tamanho)]))}
<h3>Tabelas principais</h3>
${tabela(['Plataforma', 'Tabelas'], [
  ['DIROPS', 'voo, voo_ligado (pares chegada/partida), calculo_tarifa, tarifa_pouso, tarifa_permanencia, outra_tarifa, taxa_cambio, facturacao_trafego_pp, proforma, companhia_aerea, registo_aeronave, medicao_k_p_i, inspecao, ocorrencia_safety, registo_g_r_f, processo_auditoria, plano_acao_corretiva, credenciamento, ordem_servico, relatorio_agenda'],
  ['Universidade', 'curso, curso_versao, modulo, aula, matricula, progresso_aula, quiz, pergunta, tentativa, tentativa_gabarito, certificado, trilha, sessao_formacao, scorm_estado, universidade_*'],
  ['GED', 'documento, documento_versao, documento_ficheiro, pasta, documento_aprovacao, documento_emenda, documento_leitura, documento_link_partilha, documento_credenciado, documento_pagina_texto, documentos_aeroporto, documentos_acesso_aeroporto, documentos_permissao, documentos_config'],
  ['Comum', 'users (ficha única: perfis, portais, aeroportos), empresa, aeroporto, log_auditoria, regra_permissao, configuracao_sistema, api_key'],
])}
<p>O inventário completo está no Anexo A.</p>
<h2>7.4 Migrações</h2>
<p>A estrutura da base de dados é criada por ficheiros SQL numerados, aplicados por ordem com <code>psql -f</code> pelo utilizador <code>postgres</code> — ${migracoes.length} ficheiros (Anexo B). Os ficheiros 01–171 estão em <code>sga-onpremise\\sql\\</code>; os seguintes em <code>APP_DIROPS_v2\\tools\\&lt;tema&gt;\\</code>. Cada migração deve terminar com <code>NOTIFY pgrst, 'reload schema';</code> para o PostgREST reconhecer as alterações sem reinício.</p>
${bloco(`# ligar à base de dados (PowerShell, como administrador)
$env:PGPASSWORD = (Get-Content C:\\dirops\\sga-onpremise\\secrets\\postgres_password.txt -Raw).Trim()
& "C:\\dirops\\sga-onpremise\\postgres\\bin\\psql.exe" -h 127.0.0.1 -U postgres -d dirops_sga
# aplicar uma migração
& "C:\\dirops\\sga-onpremise\\postgres\\bin\\psql.exe" -h 127.0.0.1 -U postgres -d dirops_sga -f <ficheiro.sql>`)}

${h1('c8')}
<h2>8.1 Três logins independentes</h2>
${tabela(['Login', 'Serviço', 'Esquema', 'Criação de contas'], [
  ['DIROPS', 'dirops-auth-v2 (:9999)', 'auth', 'Registo livre, com aprovação por um administrador (ver 17.2)'],
  ['Universidade', 'dirops-auth-uc-v2 (:9998)', 'auth_uc', 'Só por convite'],
  ['GED', 'dirops-auth-docs-v2 (:9997)', 'auth_docs', 'Só por convite'],
])}
<p>Cada login tem as suas contas e senhas. A separação é reversível: <code>scripts\\activar-universidade-isolada.ps1</code> e <code>scripts\\activar-documentos-isolado.ps1</code>, com a opção <code>-Rollback</code>, repõem o login partilhado com o DIROPS.</p>
<h2>8.2 Perfis</h2>
${tabela(['Plataforma', 'Perfis', 'Onde se gerem'], [
  ['DIROPS', 'administrador, operacoes, infraestrutura, credenciamento, gestor_empresa, visualizador e perfis personalizados', 'DIROPS → Gerir Permissões'],
  ['Universidade', 'formando, instrutor, admin_universidade', 'Universidade → Gestão → Acessos'],
  ['GED', 'leitor, editor, gestor e administrador de documentos, e perfis próprios definidos sobre um destes níveis', 'GED → Gestão → Acessos → Perfis e páginas'],
])}
<p>Os perfis das três plataformas estão na coluna <code>users.perfis</code>; a coluna <code>users.portais</code> autoriza a entrada em cada portal. Estas colunas só são escritas pelo servidor — ninguém se promove a partir do navegador.</p>
<h2>8.3 Regras de acesso aos dados</h2>
<ul>
<li><b>RLS em todas as tabelas de dados</b> (${num(bd.politicas_total)} regras). Funções principais: <code>is_admin()</code>, <code>tem_perfil()</code>, <code>doc_ctx()</code> (contexto do GED, calculado uma vez por pedido) e <code>pode_gerir_formacao()</code>.</li>
<li><b>GED por aeroporto:</b> cada pessoa só vê os documentos dos aeroportos que lhe foram atribuídos (<code>documentos_acesso_aeroporto</code>).</li>
<li><b>Regime AVSEC</b> (NTA 32 e Instrutivo 32.009.001.A): documentos e pastas AVSEC só são visíveis a gestores e a pessoal credenciado (<code>documento_credenciado</code>), com registo de credencial, dever de sigilo e cópias controladas.</li>
<li><b>Auditoria inviolável:</b> <code>log_auditoria</code> não aceita alterações nem apagamentos; <code>log_acesso_documento</code> regista quem viu e descarregou cada documento.</li>
<li><b>Pedidos sem login</b> (papel anon) estão limitados ao mínimo indispensável.</li>
</ul>

${h1('c9')}
<p>O <b>PostgREST</b> expõe as tabelas e funções do esquema public em <code>/rest/v1/…</code> (e <code>/uc/rest/v1</code>, <code>/gd/rest/v1</code>), sempre sujeito às regras RLS do token. As <b>funções do servidor</b> (<code>functions\\dirops-functions\\server.js</code>, porta 4001) tratam o que não pode ficar no navegador:</p>
${tabela(['Função (/functions/…)', 'O que faz'], FUNCOES.map(f => [code(f[0]), esc(f[1])]))}
${nota('Depois de alterar ficheiros em <code>functions\\dirops-functions\\</code> é preciso <code>Restart-Service dirops-functions-v2</code>. O código está versionado no repositório privado <code>MARCIOSAGER/sga-onpremise-stack</code>.')}

${h1('c10')}
${tabela(['Pasta (storage\\)', 'Tamanho', 'Utilização'], [
  ['uploads\\', '2,4 GB', 'Ficheiros do DIROPS e da Universidade (fotografias, anexos, vídeos, pacotes de formação).'],
  ['private-uploads\\', '1,1 GB', 'Ficheiros do GED. Só se obtêm por endereço assinado e temporário; os PDF são carimbados (cabeçalho e rodapé do Instrutivo 22C, marca “cópia não controlada”) no momento da entrega, sem alterar o original.'],
  ['_previsualizacao\\', '2 MB', 'PDF gerados a partir de documentos Office para pré-visualização (cache).'],
  ['tmp\\', '< 1 MB', 'Ficheiros temporários de carregamento.'],
])}
<p>Os ficheiros guardados têm um prefixo aleatório no nome (ex. <code>405c5c727_…pdf</code>) e a ligação ao documento está na base de dados (<code>documento_versao.arquivo_uri</code>, <code>documento_ficheiro</code>). Os ficheiros não devem ser renomeados manualmente.</p>

${h1('c11')}
<ul>
<li>Todo o email sai pelo relay interno <b>mail.sga.co.ao:25</b>, a partir das funções do servidor e dos três GoTrue.</li>
<li>O relay só entrega a endereços <b>@sga.co.ao</b> e trata como spam os envios com muitos destinatários em cópia oculta; por isso o sistema envia uma mensagem por destinatário.</li>
<li>“Enviado” no sistema significa aceite pelo relay. Mensagens devolvidas pelo servidor de correio só se vêem na caixa do remetente.</li>
<li>Os endereços de alertas, suporte e acessos configuram-se no DIROPS (Configurações Gerais → Geral); os relatórios automáticos em DIROPS → Relatórios Automáticos.</li>
</ul>

${h1('c12')}
<p>Uma única aplicação React 18 + Vite 6 serve as três plataformas (rotas <code>/</code>, <code>/universidade</code>, <code>/documentos</code>). O código está em <code>C:\\dirops\\APP_DIROPS_v2</code> (repositório privado ${code('github.com/MARCIOSAGER/APP_DIROPS_v2')}). A compilação vai para <code>dist\\</code> e publica-se copiando para <code>nginx\\html\\</code>:</p>
${bloco(`cd C:\\dirops\\APP_DIROPS_v2
npm test -- --run                      # testes automáticos
Remove-Item -Recurse -Force dist; npm run build
Copy-Item dist\\* C:\\dirops\\sga-onpremise\\nginx\\html\\ -Recurse -Force`)}
<ul>
<li>Variáveis de compilação em <code>.env.production</code>: <code>VITE_UC_ISOLADO=1</code> e <code>VITE_GD_ISOLADO=1</code> (logins independentes).</li>
<li>Após a publicação, quem tem o site aberto recebe um aviso de nova versão; se algo parecer desactualizado, <b>Ctrl+Shift+R</b>.</li>
<li>Nunca publicar se a compilação falhar: a pasta <code>dist\\</code> pode ficar incompleta.</li>
</ul>

${h1('c13')}
<h2>13.1 Verificar o estado</h2>
${bloco(`Get-Service dirops-*, postgresql-x64-16 | Format-Table Name, Status, StartType
Invoke-WebRequest http://127.0.0.1/healthz -UseBasicParsing               # nginx
Invoke-WebRequest http://127.0.0.1/gd/auth/v1/health -UseBasicParsing     # login do GED
Invoke-WebRequest http://127.0.0.1/uc/auth/v1/health -UseBasicParsing     # login da Universidade
Get-Content C:\\dirops\\sga-onpremise\\logs\\integrity-wrapper.log -Tail 1   # última verificação horária`)}
<h2>13.2 Reiniciar</h2>
${bloco(`Restart-Service dirops-functions-v2      # após alterar functions\\dirops-functions\\*.js
Restart-Service dirops-nginx-v2          # após alterar nginx.conf ("nginx -s reload" não funciona como serviço)
Restart-Service dirops-postgrest-v2
Restart-Service dirops-auth-v2, dirops-auth-uc-v2, dirops-auth-docs-v2
Restart-Service postgresql-x64-16        # com cuidado; os outros serviços voltam a ligar-se sozinhos`)}
${nota('O aviso “Waiting for service … to stop…” é normal. O reinício do nginx deixa o site 2 a 4 segundos sem resposta.')}
<h2>13.3 Problemas conhecidos e primeira resposta</h2>
${tabela(['Sintoma', 'Causa habitual', 'O que fazer'], [
  ['Site lento; painel indica “GoTrue fora do ar”', 'Processador saturado (antivírus, conversões)', 'Ver o Gestor de Tarefas; normalmente recupera sozinho.'],
  ['Toda a plataforma em baixo', 'Antivírus colocou um executável em quarentena', 'Restaurar e excluir no Check Point; reiniciar os serviços (scripts\\recovery-wrapper.ps1 se o supervisor faltar).'],
  ['Página antiga depois de publicar', 'Versão em cache no navegador', 'Ctrl+Shift+R.'],
  ['“Could not find column … in schema cache”', 'Migração aplicada sem recarregar o PostgREST', '<code>NOTIFY pgrst, \'reload schema\';</code> no psql.'],
  ['Email não chega', 'Relay recusou ou destinatário externo', 'Ver <code>logs\\svc-functions*.log</code>; o relay só entrega a @sga.co.ao.'],
  ['“Erro na aplicação: insertBefore…”', 'Tradução automática do navegador', 'Desligar a tradução automática para o site.'],
])}

${h1('c14')}
${tabela(['O quê', 'Quando', 'Como', 'Onde', 'Retenção'], [
  ['Base de dados', 'Diário 02:00', code('scripts\\backup-postgres.ps1') + ' (pg_dump, formato custom)', code('backups\\dirops_sga_AAAAMMDD_HHMMSS.dump'), '14 dias'],
  ['Ficheiros (storage)', 'Diário, a seguir à anterior', code('scripts\\backup-storage.ps1') + ' (robocopy acumulativo + manifesto)', code('backups\\storage-arquivo\\'), 'Acumulativo'],
  ['Código do site', 'A cada alteração', 'Git', 'GitHub MARCIOSAGER/APP_DIROPS_v2 (privado)', 'Histórico'],
  ['Código do servidor', 'A cada alteração', 'Git', 'GitHub MARCIOSAGER/sga-onpremise-stack (privado): funções, migrações, nginx.conf, supervisor, scripts', 'Histórico'],
])}
<p>Última execução registada: 20/10/2026, 02:00–02:03 (base de dados; 5 445 ficheiros, 3,36 GB).</p>
<h2>14.1 Objectivos de recuperação</h2>
${tabela(['Indicador', 'Situação actual'], [
  ['Perda máxima de dados (RPO)', 'Até 24 horas — a última cópia nocturna (sem arquivo de WAL).'],
  ['Tempo de reposição (RTO), servidor disponível', 'Cerca de 1 hora: restauro da base (≈ 160 MB) e confirmação dos serviços.'],
  ['Tempo de reposição, perda do servidor', 'Indeterminado: as cópias estão no mesmo disco (recomendação R1).'],
])}
<h2>14.2 Restaurar a base de dados</h2>
${bloco(`$dump = 'C:\\dirops\\sga-onpremise\\backups\\dirops_sga_AAAAMMDD_HHMMSS.dump'
# 1) restaurar numa base temporária e validar
psql -h 127.0.0.1 -U postgres -d postgres -c "CREATE DATABASE dirops_sga_restore"
pg_restore -h 127.0.0.1 -U postgres --dbname=dirops_sga_restore --no-owner --no-acl --jobs=2 $dump
# 2) trocar com a produção
Stop-Service dirops-auth-v2, dirops-auth-uc-v2, dirops-auth-docs-v2, dirops-postgrest-v2, dirops-functions-v2
psql -h 127.0.0.1 -U postgres -d postgres -c "ALTER DATABASE dirops_sga RENAME TO dirops_sga_old"
psql -h 127.0.0.1 -U postgres -d postgres -c "ALTER DATABASE dirops_sga_restore RENAME TO dirops_sga"
Start-Service dirops-postgrest-v2, dirops-auth-v2, dirops-auth-uc-v2, dirops-auth-docs-v2, dirops-functions-v2
# ensaio completo sem tocar na produção
powershell -File C:\\dirops\\sga-onpremise\\scripts\\dr-test.ps1`)}
${nota('<b>Risco principal:</b> as cópias estão no mesmo disco do servidor. Uma avaria do disco ou do servidor, ou um ataque de ransomware, faz perder a produção e as cópias ao mesmo tempo (recomendações R1, R2 e R4).', 'risco')}

${h1('c15')}
<h2>15.1 Tarefas agendadas</h2>
${tabela(['Tarefa', 'Periodicidade', 'O que faz', 'Última execução'], tarefas.map(t => [codeNW(t.Tarefa), DESC_TAREFA[t.Tarefa][0], esc(DESC_TAREFA[t.Tarefa][1]), esc(String(t.Ultima).replace(/^(\d+)\/(\d+)\/(\d{4}) /, (m, a, b, c) => `${b.padStart(2, '0')}/${a.padStart(2, '0')}/${c} `)) + (t.Resultado === 0 ? ' — OK' : ' — código ' + t.Resultado)]))}
<p>Todas correm com a conta SYSTEM; consultam-se no Agendador de Tarefas com uma conta de administrador. Os alertas são enviados para oaeroportos@sga.co.ao.</p>
<h2>15.2 Registos</h2>
${tabela(['O quê', 'Onde'], [
  ['Serviços', code('logs\\svc-<serviço>.out.log / .err.log') + ' e ' + code('logs\\dirops-*.super.log') + ' (supervisor)'],
  ['nginx', code('nginx\\logs\\access.log') + ', ' + code('nginx\\logs\\error.log')],
  ['PostgreSQL', code('postgres-data\\log\\')],
  ['Erros no navegador dos utilizadores', code('logs\\client-errors.jsonl')],
  ['Vigilância e integridade', code('logs\\watchdog.log') + ', ' + code('logs\\integrity-wrapper.log')],
  ['Cópias de segurança', code('backups\\backup.log')],
  ['Relatórios automáticos', code('logs\\relatorios-dispatcher.log')],
])}

${h1('c16')}
<ul>
<li><b>Exposição mínima:</b> só a porta 80 aceita ligações; base de dados, API, logins e funções escutam apenas no próprio servidor.</li>
<li><b>Controlo de acesso na base de dados:</b> regras RLS em todas as tabelas de dados; o navegador nunca recebe dados a que o perfil não dá direito.</li>
<li><b>Contas protegidas:</b> perfis e portais só são alterados pelo servidor; o acesso anónimo está limitado; a auditoria é inviolável.</li>
<li><b>Logins independentes</b> por plataforma; na Universidade e no GED as contas só são criadas por convite.</li>
<li><b>Documentos do GED:</b> ficheiros privados com endereço assinado; carimbo e marca “cópia não controlada” com nome e hora de quem descarrega; registo de cada visualização e descarga; regime AVSEC com credenciação.</li>
<li><b>Avaliações da Universidade</b> corrigidas no servidor, com o gabarito em tabela separada.</li>
<li><b>Credenciais:</b> as pastas <code>secrets\\</code>, <code>config\\</code> e <code>service-migration\\env\\</code> só são acessíveis a Administradores, SYSTEM e à conta de serviço Dirops.</li>
<li><b>Vigilância:</b> verificação dos serviços a cada 5 minutos e da integridade do supervisor a cada hora, com alerta por email.</li>
<li><b>Código versionado</b> em repositórios privados, sem segredos (os segredos ficam só no servidor).</li>
<li>Revisões de segurança realizadas em 29/08/2026 e 03/10/2026; as falhas críticas encontradas foram corrigidas e verificadas.</li>
</ul>

${h1('c17')}
<h2>17.1 Recomendações</h2>
${tabela(['#', 'Prioridade', 'Situação', 'Recomendação', 'Responsável'], [
  ['R1', '<span class="prio-alta">Alta</span>', 'As cópias de segurança ficam só no disco C: do próprio servidor.', 'Copiar diariamente <code>backups\\</code> para outro servidor ou NAS da SGA (ou armazenamento externo), com retenção e teste de restauro periódico.', 'TI (indicar o destino); a Direcção de Operações configura a cópia.'],
  ['R2', '<span class="prio-alta">Alta</span>', 'Disco C: com 19 GB livres de 89 GB; o arquivo de ficheiros cresce continuamente.', 'Aumentar o disco ou acrescentar um disco de dados (D:) para storage e cópias; alerta a 15% livres.', 'TI'],
  ['R3', '<span class="prio-media">Média</span>', 'Windows Server sem activação.', 'Regularizar o licenciamento.', 'TI'],
  ['R4', '<span class="prio-media">Média</span>', 'Sem arquivo de WAL: a recuperação só é possível para a cópia da noite anterior.', 'Activar archive_mode com cópia dos WAL para fora do servidor (recuperação a um ponto no tempo).', 'TI, depois da R1'],
  ['R5', '<span class="prio-baixa">Baixa</span>', 'Os três GoTrue ligam-se à base de dados com o superutilizador postgres.', 'Criar um papel dedicado com privilégios só nos esquemas auth, auth_uc e auth_docs, em janela de manutenção, com teste dos três logins.', 'Direcção de Operações com a TI'],
  ['R6', '<span class="prio-baixa">Baixa</span>', 'Servidor com 2 núcleos e 8 GB (memória ≈ 90% ocupada); picos de processador do antivírus.', 'Avaliar 4 núcleos e 16 GB; confirmar a exclusão das pastas da plataforma no Check Point.', 'TI'],
  ['R7', '<span class="prio-baixa">Baixa</span>', 'Os .env existem em duas pastas (config\\ como origem e service-migration\\env\\ lidos pelos serviços); as chaves não são rodadas desde a instalação.', 'Manter uma só cópia de cada credencial e definir rotação periódica das chaves (JWT, senhas de papéis, SMTP).', 'TI com a Direcção de Operações'],
])}
<h2>17.2 Riscos aceites</h2>
<p>Decisões da Direcção de Operações sobre riscos conhecidos:</p>
${tabela(['Tema', 'Situação', 'Decisão'], [
  ['HTTPS', 'O site é servido em HTTP simples; senhas e sessões circulam sem cifra na rede interna.', 'Site exclusivamente interno; risco aceite. Caso se altere: certificado interno para srvkms001.sga.net e HTTPS no nginx.'],
  ['Registo livre no login do DIROPS', 'Qualquer pessoa na rede pode criar uma conta de login do DIROPS.', 'Mantido: a conta não acede a nada até um administrador a aprovar e lhe atribuir perfil. Na Universidade e no GED as contas são só por convite.'],
])}

${h1('c18')}
${tabela(['Papel', 'Quem', 'Responsabilidades'], [
  ['Responsável funcional', 'Direcção de Operações — oaeroportos@sga.co.ao', 'Prioridades e evolução das plataformas; aprovação de alterações; decisões sobre riscos.'],
  ['Infraestrutura', 'Equipa de TI da SGA', 'Servidor, sistema operativo, rede, antivírus, licenças, capacidade, cópias fora do servidor.'],
  ['Administração das plataformas', 'Administradores definidos em cada portal', 'Contas, perfis, acessos por aeroporto, credenciação AVSEC, conteúdos.'],
  ['Alertas automáticos', 'oaeroportos@sga.co.ao', 'Recebe os alertas da vigilância (serviços, integridade, cópias).'],
])}

${h1('aA')}
<p>Tabelas e vistas do esquema <code>public</code>. Linhas: contagem exacta a ${HOJE}. RLS: regras de acesso activas (número de regras). Os esquemas de login (<code>auth</code>, <code>auth_uc</code>, <code>auth_docs</code>) têm 23 tabelas internas do GoTrue cada um; não estão expostos pela API e não constam desta lista.</p>
${tabela(['Tabela', 'Plataforma', 'Tipo', 'Linhas', 'Espaço', 'RLS', 'Descrição'], pub.slice().sort((a, b) => a.tabela.localeCompare(b.tabela)).map(t => [code(t.tabela), esc(t.plat), t.tipo === 'v' ? 'vista' : 'tabela', t.tipo === 'r' ? num(t.linhas) : '—', esc(t.tamanho), t.tipo === 'r' ? (t.rls ? 'sim (' + t.politicas + ')' : 'não*') : '—', esc((t.comentario || '').replace(/\s+/g, ' ').slice(0, 110) + ((t.comentario || '').length > 110 ? '…' : ''))]), 'mini')}
${semRls.length ? `<p style="font-size:8pt">* ${semRls.map(t => code(t.tabela)).join(', ')}: sem RLS mas também sem permissões para os papéis da API — só as funções do servidor lhe acedem (contador interno de numeração).</p>` : ''}

${h1('aB')}
<p>${migracoes.length} ficheiros, aplicados por ordem numérica. Origem: <code>sga-onpremise\\sql\\</code> (01–171) e <code>APP_DIROPS_v2\\tools\\*\\</code> (172 em diante).</p>
<div style="columns: 2; column-gap: 8mm; font-family: Consolas, monospace; font-size: 7.4pt; line-height: 1.5;">${migracoes.map(m => `<div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${esc(m)}</div>`).join('')}</div>

${h1('aC')}
${tabela(['Ficheiro (em C:\\dirops\\sga-onpremise\\)', 'Conteúdo', 'Usado por'], [
  [code('service-migration\\env\\dirops-auth.env'), 'Ligação à base de dados, segredo JWT, SMTP', 'dirops-auth-v2'],
  [code('service-migration\\env\\dirops-auth-uc.env'), 'Idem, login da Universidade', 'dirops-auth-uc-v2'],
  [code('service-migration\\env\\dirops-auth-docs.env'), 'Idem, login do GED', 'dirops-auth-docs-v2'],
  [code('service-migration\\env\\dirops-functions.env'), 'Endereços internos, segredo JWT, chave de serviço, SMTP', 'dirops-functions-v2'],
  [code('config\\postgrest.conf'), 'Ligação do papel authenticator, segredo JWT', 'dirops-postgrest-v2'],
  [code('config\\auth.env, auth-uc.env, auth-docs.env, functions.env'), 'Cópias de origem dos ficheiros acima', 'Scripts de activação dos logins'],
  [code('secrets\\jwt_secret.txt'), 'Segredo comum de assinatura dos tokens', 'GoTrue ×3, PostgREST, funções'],
  [code('secrets\\anon_key.txt, service_role_key.txt'), 'Chaves JWT anónima e de serviço', 'Site (anónima); funções e ferramentas (serviço)'],
  [code('secrets\\authenticator_password.txt, app_db_password.txt'), 'Senhas dos papéis authenticator e dirops', 'PostgREST; administração'],
  [code('secrets\\smtp_user.txt, smtp_password.txt, smtp_from.txt'), 'Conta de envio de email', 'Funções'],
  [code('secrets\\postgres_password.txt'), 'Senha do superutilizador postgres', 'Administração, cópias, restauro'],
])}
${nota('Quem lê estes ficheiros pode ler e alterar todos os dados. O acesso está limitado a Administradores, SYSTEM e à conta de serviço Dirops e deve manter-se assim.', 'risco')}

${h1('aD')}
${tabela(['Rota', 'Destino'], [
  ['/ , /universidade/… , /documentos/…', 'Site (aplicação de página única)'],
  ['/assets/, /sw.js, /registerSW.js, /manifest.webmanifest, /workbox-*.js', 'Ficheiros estáticos e service worker'],
  ['/rest/v1/ , /uc/rest/v1/ , /gd/rest/v1/', 'PostgREST (:3000)'],
  ['/auth/v1/ , /verify', 'GoTrue DIROPS (:9999)'], ['/uc/auth/v1/ , /universidade/verify', 'GoTrue Universidade (:9998)'], ['/gd/auth/v1/ , /documentos/verify', 'GoTrue GED (:9997)'],
  ['/functions/v1/ , /uc/functions/v1/ , /gd/functions/v1/', 'Funções do servidor (:4001); lms-upload aceita até 1,1 GB em streaming'],
  ['/storage/v1/object/ (e /uc/…, /gd/…)', 'Funções do servidor (ficheiros, com verificação de acesso)'],
  ['/p/ , /s/ , /v/ , /cert/', 'Funções do servidor (links partilháveis, verificação, certificados)'],
  ['/healthz', 'Resposta de saúde do nginx'],
])}

${h1('aE')}
${tabela(['Termo', 'Significado'], [
  ['API', 'Interface de programação: o caminho pelo qual o site pede e grava dados.'],
  ['AVSEC', 'Segurança da aviação civil contra actos de interferência ilícita (NTA 32).'],
  ['GED', 'Gestão Electrónica de Documentos — o Portal de Documentos.'],
  ['GoTrue', 'Serviço de autenticação (login, sessões, recuperação de senha) do ecossistema Supabase.'],
  ['JWT', 'JSON Web Token: credencial assinada que o site envia em cada pedido depois do login.'],
  ['LMS', 'Learning Management System — a Universidade Corporativa.'],
  ['Migração', 'Ficheiro SQL que cria ou altera a estrutura da base de dados.'],
  ['nginx', 'Servidor web que entrega o site e encaminha os pedidos para os serviços internos.'],
  ['PostgREST', 'Serviço que expõe a base de dados como API REST, aplicando as regras de acesso.'],
  ['RLS', 'Row Level Security: regras da base de dados que decidem, linha a linha, o que cada utilizador vê ou altera.'],
  ['RPO / RTO', 'Perda máxima de dados admissível / tempo para repor o serviço após uma falha.'],
  ['SPA', 'Single Page Application: o site é uma única página que carrega o resto no navegador.'],
  ['WAL', 'Write-Ahead Log: registo contínuo das alterações da base de dados; arquivado, permite recuperar a qualquer instante.'],
])}
</body></html>`;
}

// ── duas passagens: páginas dos capítulos, depois o índice com números ──
const HTML = DIR + 'Caderno_Tecnico_Plataformas_SGA.html';
const PDF = DIR + 'Caderno_Tecnico_Plataformas_SGA.pdf';
const imprimir = (html) => {
  fs.writeFileSync(HTML, html, 'utf8');
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${PDF.replace(/\//g, '\\')}`, 'file:///' + HTML], { stdio: 'ignore', timeout: 180000 });
};
function paginasDosCapitulos() {
  const txt = execFileSync('pdftotext', ['-layout', '-enc', 'UTF-8', PDF, '-'], { encoding: 'utf8', maxBuffer: 64 * 1048576 });
  const paginas = txt.split('\f');
  const mapa = {};
  for (const [id, titulo] of [...CAP, ...ANX]) {
    for (let i = 2; i < paginas.length; i++) {             // a partir da 3.ª página (capa e índice ficam de fora)
      if (paginas[i].split(/\r?\n/).some(l => l.trim() === titulo)) { mapa[id] = i + 1; break; }
    }
  }
  return mapa;
}
imprimir(montar({}));
const paginas = paginasDosCapitulos();
const faltam = [...CAP, ...ANX].filter(([id]) => !paginas[id]).map(([, t]) => t);
imprimir(montar(paginas));
const confirm = paginasDosCapitulos();
const mudou = Object.keys(paginas).filter(k => paginas[k] !== confirm[k]);
console.log('PDF:', PDF, fs.statSync(PDF).size, 'bytes ·', Object.keys(confirm).length, 'capítulos localizados', faltam.length ? '· sem página: ' + faltam.join(', ') : '', mudou.length ? '· ATENÇÃO páginas mudaram: ' + mudou.join(',') : '');
