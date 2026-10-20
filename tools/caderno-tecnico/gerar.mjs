// Caderno Técnico das plataformas (DIROPS, Universidade Corporativa, GED) — gera HTML e PDF A4.
// Os números (tabelas, tamanhos, versões, serviços) vêm de tools/caderno-tecnico/dados/*.json, recolhidos no servidor;
// o texto técnico está aqui. Para actualizar: voltar a recolher os dados e correr
//   node tools/caderno-tecnico/gerar.mjs        → tools/caderno-tecnico/Caderno_Tecnico_Plataformas_SGA.pdf
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const DIR = 'C:/dirops/APP_DIROPS_v2/tools/caderno-tecnico/';
const bd = JSON.parse(fs.readFileSync(DIR + 'dados/bd.json', 'utf8'));
const sis = JSON.parse(fs.readFileSync(DIR + 'dados/sistema.json', 'utf8').replace(/^\uFEFF/, ''));
const migracoes = fs.readFileSync(DIR + 'dados/migracoes.txt', 'utf8').split(/\r?\n/).filter(Boolean);
const logo = 'data:image/png;base64,' + fs.readFileSync('C:/dirops/APP_DIROPS_v2/public/logo-sga.png').toString('base64');
const HOJE = '20/10/2026';
const VERSAO = '1.0';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const num = (n) => (n == null ? '—' : Number(n).toLocaleString('pt-PT'));
const tabela = (cab, linhas, cls = '') => `<table class="${cls}"><thead><tr>${cab.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${linhas.map(l => `<tr>${l.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
const code = (s) => `<code>${esc(s)}</code>`;
const bloco = (s) => `<pre>${esc(s)}</pre>`;
const nota = (s, tipo = 'info') => `<div class="nota ${tipo}">${s}</div>`;

// ── plataforma de cada tabela ──
const BK = /^_|_bk_|_bk$|^bk_|_repair_|_bk\d|tarifas_ato_bk/;
function plataforma(t) {
  if (t.esquema === 'auth') return 'Login DIROPS';
  if (t.esquema === 'auth_uc') return 'Login Universidade';
  if (t.esquema === 'auth_docs') return 'Login GED';
  const n = t.tabela;
  if (BK.test(n)) return 'Cópia temporária';
  if (/^(documento|documentos|pasta|log_acesso_documento|conformidade_)/.test(n)) return 'GED';
  if (/^(universidade|aula|curso|certificado|quiz|tentativa|trilha|sessao_|matricula|modulo|pergunta|progresso_aula|scorm|aluno_|distintivo|pontos_formacao|formacao_externa|notificacao_formacao)/.test(n)) return 'Universidade';
  if (/^(users|empresa|aeroporto|log_auditoria|regra_permissao|configuracao_sistema|api_|performance_log|placeholder|ticket_suporte|solicitacao_acesso|grupo_whats_app)/.test(n)) return 'Comum';
  return 'DIROPS';
}
const tabs = bd.tabelas.map(t => ({ ...t, plat: plataforma(t) }));
const porPlat = {};
for (const t of tabs) { const k = t.plat; porPlat[k] = porPlat[k] || { n: 0, bytes: 0, linhas: 0, v: 0 }; if (t.tipo === 'v') porPlat[k].v++; else porPlat[k].n++; porPlat[k].bytes += t.bytes || 0; porPlat[k].linhas += t.linhas || 0; }
const mb = (b) => (b / 1048576).toFixed(1).replace('.', ',') + ' MB';
const bkTabs = tabs.filter(t => t.plat === 'Cópia temporária');
const semRls = tabs.filter(t => t.esquema === 'public' && t.tipo === 'r' && !t.rls && t.plat !== 'Cópia temporária');

const servicos = (Array.isArray(sis.servicos) ? sis.servicos : [sis.servicos]);
const PORTA_SVC = { 'dirops-nginx-v2': '0.0.0.0:80 (rede)', 'dirops-postgrest-v2': '127.0.0.1:3000', 'dirops-functions-v2': '127.0.0.1:4001', 'dirops-auth-v2': '127.0.0.1:9999', 'dirops-auth-uc-v2': '127.0.0.1:9998', 'dirops-auth-docs-v2': '127.0.0.1:9997', 'postgresql-x64-16': '127.0.0.1:5432' };
const PAPEL_SVC = {
  'dirops-nginx-v2': 'Servidor web: entrega o site (as três plataformas) e encaminha os pedidos para os serviços internos.',
  'dirops-postgrest-v2': 'API de dados (REST) sobre a base de dados; aplica as regras de acesso (RLS) de cada utilizador.',
  'dirops-functions-v2': 'Funções do servidor em Node.js: ficheiros, emails, relatórios, links partilháveis, carimbo de PDF, quiz, convites.',
  'dirops-auth-v2': 'Login do DIROPS (GoTrue, esquema auth).',
  'dirops-auth-uc-v2': 'Login da Universidade Corporativa (GoTrue, esquema auth_uc).',
  'dirops-auth-docs-v2': 'Login do Portal de Documentos — GED (GoTrue, esquema auth_docs).',
  'postgresql-x64-16': 'Base de dados PostgreSQL 16 (base dirops_sga).',
};

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
  ['documentos-folhas', 'GED: folhas preliminares do manual (rosto, índice, LEP, registo de emendas).'],
  ['share-link-create / share-link-revoke / share-link-config / share-selection-create', 'GED: links partilháveis com externos (/p/, /s/) e sua revogação.'],
];

const PASTAS = [
  ['C:\\dirops\\sga-onpremise\\', '—', 'Raiz da instalação de produção.'],
  ['  postgres\\', '212 MB', 'Binários do PostgreSQL 16.6 (psql, pg_dump, pg_restore).'],
  ['  postgres-data\\', '1,0 GB', 'Dados da base de dados (não copiar com o serviço a correr).'],
  ['  postgrest\\', '66 MB', 'Binário do PostgREST 14.12 e configuração.'],
  ['  bin\\', '97 MB', 'auth.exe (GoTrue compilado) e cloudflared.exe.'],
  ['  nginx\\', '1,4 GB', 'nginx 1.26.2: conf\\nginx.conf (rotas), html\\ (site publicado, inclui conteúdos H5P/vídeo), logs\\.'],
  ['  functions\\dirops-functions\\', '7 MB', 'Servidor de funções Node.js: server.js, docs-pdf.js (carimbo), docs-folhas.js, docs-fluxo.js, lms-quiz.js. Cópias *.bak-* de cada alteração.'],
  ['  service-host\\', '112 KB', 'DiropsServiceHost.exe (supervisor próprio dos serviços) e conf\\*.ini de cada serviço.'],
  ['  config\\', '34 KB', 'Ficheiros .env de cada serviço (auth.env, auth-uc.env, auth-docs.env, …). CONTÊM CREDENCIAIS.'],
  ['  secrets\\', '14 KB', 'Chaves e senhas geradas na instalação (índice no Anexo C). CONFIDENCIAL.'],
  ['  sql\\', '1,6 MB', 'Migrações da base de dados 01…171 (as 172…179 estão em APP_DIROPS_v2\\tools\\).'],
  ['  scripts\\', '128 KB', 'Backups, watchdog, limpeza de logs, teste de DR, activação dos logins independentes.'],
  ['  storage\\', '3,4 GB', 'Ficheiros dos utilizadores: uploads\\ (2,4 GB), private-uploads\\ (1,1 GB, só com endereço assinado), _previsualizacao\\, tmp\\.'],
  ['  backups\\', '3,6 GB', 'Cópias diárias da base de dados (*.dump, 14 dias), arquivo de ficheiros (storage-arquivo\\) e manifestos.'],
  ['  logs\\', '74 MB', 'Registos dos serviços (svc-*.log, dirops-*.log), erros do navegador (client-errors.jsonl), watchdog.'],
  ['  email-templates\\', '72 KB', 'Modelos de email dos logins (uc\\, gd\\).'],
  ['  installers\\', '1,6 GB', 'Instaladores guardados (PostgreSQL, nginx, PostgREST, Go, LibreOffice, Chrome, Tesseract, Ghostscript, Python, ffmpeg, eXeLearning, Lumi).'],
  ['  go\\ e gopath\\', '685 MB', 'Ferramentas Go usadas para compilar o GoTrue.'],
  ['  archive\\, _legado-backup-*\\', '47 MB', 'Material antigo (migração do Base44, versões anteriores).'],
  ['C:\\dirops\\APP_DIROPS_v2\\', '1,7 GB', 'Código-fonte da aplicação web (React/Vite) — repositório Git; dist\\ é a compilação; tools\\ tem ferramentas e migrações recentes.'],
];

const VERSOES = [
  ['Sistema operativo', esc(sis.so), 'Microsoft'],
  ['PostgreSQL', esc(bd.versao.split(',')[0]), 'Base de dados'],
  ['PostgREST', '14.12', 'API REST sobre a base de dados'],
  ['GoTrue (Supabase Auth)', 'compilado a partir do código-fonte com Go 1.26.3 (bin\\auth.exe), 3 instâncias', 'Autenticação'],
  ['nginx', '1.26.2', 'Servidor web / proxy'],
  ['Node.js / npm', 'v20.18.0 / 10.8.2', 'Servidor de funções e compilação do site'],
  ['nodemailer', '8.0.x', 'Envio de email (funções)'],
  ['DiropsServiceHost', 'versão própria (C#), código em GitHub MARCIOSAGER/sga-onpremise-stack', 'Supervisor dos serviços Windows'],
  ['LibreOffice', '26.8.0', 'Conversão Office→PDF (GED e Universidade)'],
  ['ffmpeg', 'em installers\\ffmpeg', 'Vídeo da Universidade'],
  ['Tesseract OCR', '5.4.0', 'Leitura de texto em PDF digitalizado (pesquisa do GED)'],
  ['Ghostscript', '10.08', 'Tratamento de PDF'],
  ['Python', '3.12.10 (e o Python do LibreOffice)', 'Ferramentas de conversão'],
  ['Google Chrome Enterprise', 'instalado', 'Geração de PDF / testes'],
  ['Git', '2.45.2', 'Controlo de versões do código'],
  ['cloudflared', 'em bin\\ (não está a correr como serviço)', 'Túnel Cloudflare (preparado, não activo)'],
  ['Frontend: React / Vite', '18.2 / 6.1', 'Site das três plataformas (SPA)'],
  ['supabase-js / TanStack Query', '2.98 / 5.84', 'Cliente de dados no navegador'],
  ['pdf.js / jsPDF / SheetJS (xlsx)', '4.10 / 4.2 / 0.18.5', 'Leitor de PDF, PDFs gerados, Excel'],
];

const html = `<!doctype html><html lang="pt"><head><meta charset="utf-8"><title>Caderno Técnico — Plataformas SGA</title>
<style>
@page { size: A4; margin: 18mm 15mm 18mm 15mm; }
* { box-sizing: border-box; }
body { font-family: "Segoe UI", Arial, sans-serif; font-size: 9.6pt; color: #1e293b; line-height: 1.45; margin: 0; }
h1 { font-size: 18pt; color: #0b3b6f; margin: 0 0 4mm; padding-bottom: 2mm; border-bottom: 2px solid #0b3b6f; page-break-before: always; }
h1.primeiro { page-break-before: auto; }
h2 { font-size: 12.5pt; color: #0b3b6f; margin: 6mm 0 2mm; page-break-after: avoid; }
h3 { font-size: 10.5pt; margin: 4mm 0 1.5mm; color: #334155; page-break-after: avoid; }
p { margin: 1.5mm 0 2.5mm; }
table { width: 100%; border-collapse: collapse; margin: 2mm 0 4mm; font-size: 8.6pt; page-break-inside: auto; }
th { background: #0b3b6f; color: #fff; text-align: left; padding: 1.6mm 2mm; font-weight: 600; }
td { padding: 1.3mm 2mm; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
tr { page-break-inside: avoid; }
tbody tr:nth-child(even) td { background: #f8fafc; }
table.mini { font-size: 7.4pt; } table.mini td, table.mini th { padding: 0.8mm 1.4mm; }
code { font-family: Consolas, monospace; font-size: 8.4pt; background: #f1f5f9; padding: 0 1mm; border-radius: 2px; }
pre { font-family: Consolas, monospace; font-size: 8pt; background: #0f172a; color: #e2e8f0; padding: 3mm; border-radius: 3px; white-space: pre-wrap; page-break-inside: avoid; }
.nota { border-left: 3px solid #0369a1; background: #f0f9ff; padding: 2mm 3mm; margin: 2mm 0 4mm; page-break-inside: avoid; }
.nota.alerta { border-color: #b45309; background: #fffbeb; } .nota.risco { border-color: #b91c1c; background: #fef2f2; }
.capa { height: 255mm; display: flex; flex-direction: column; justify-content: space-between; }
.capa img { width: 62mm; } .capa .titulo { font-size: 30pt; font-weight: 700; color: #0b3b6f; line-height: 1.1; margin-top: 50mm; }
.capa .sub { font-size: 14pt; color: #334155; margin-top: 5mm; }
.capa .meta td { border: none; padding: 1mm 0; background: none !important; font-size: 10pt; } .capa .meta td:first-child { color: #64748b; width: 45mm; }
.diag { font-family: Consolas, monospace; font-size: 7.6pt; background: #f8fafc; border: 1px solid #cbd5e1; padding: 3mm; white-space: pre; page-break-inside: avoid; line-height: 1.3; }
.indice li { margin: 0.6mm 0; } .k { font-weight: 600; } .tag { display: inline-block; border: 1px solid #cbd5e1; border-radius: 2px; padding: 0 1mm; font-size: 7.4pt; }
.prio-alta { color: #b91c1c; font-weight: 700; } .prio-media { color: #b45309; font-weight: 700; } .prio-baixa { color: #0369a1; font-weight: 700; }
</style></head><body>

<section class="capa">
  <div><img src="${logo}" alt="SGA"></div>
  <div>
    <div class="titulo">Caderno Técnico<br>das Plataformas</div>
    <div class="sub">DIROPS · Universidade Corporativa · Portal de Documentos (GED)</div>
  </div>
  <table class="meta"><tbody>
    <tr><td>Servidor</td><td>${esc(sis.host)} — ${esc(sis.ips)} (rede interna SGA)</td></tr>
    <tr><td>Versão do documento</td><td>${VERSAO} — ${HOJE}</td></tr>
    <tr><td>Destinatário</td><td>Equipa de Tecnologias de Informação da SGA</td></tr>
    <tr><td>Responsável funcional</td><td>Direcção de Operações — oaeroportos@sga.co.ao</td></tr>
    <tr><td>Classificação</td><td>Uso interno. Descreve a infraestrutura; <b>não contém senhas nem chaves</b> (indica só onde estão).</td></tr>
  </tbody></table>
</section>

<h1 class="primeiro">Índice</h1>
<ol class="indice">
<li>Identificação e finalidade</li><li>Arquitectura</li><li>Servidor e sistema operativo</li><li>Software instalado e versões</li>
<li>Serviços Windows, portas e rede</li><li>Estrutura de pastas</li><li>Base de dados</li><li>Autenticação, perfis e controlo de acesso</li>
<li>API e funções do servidor</li><li>Armazenamento de ficheiros</li><li>Email</li><li>Aplicação web (frontend) e publicação</li>
<li>Operação do dia-a-dia</li><li>Cópias de segurança e recuperação</li><li>Monitorização e registos</li><li>Segurança: controlos existentes</li>
<li>Riscos e recomendações à TI</li>
<li>Anexo A — Inventário completo das tabelas</li><li>Anexo B — Migrações da base de dados</li><li>Anexo C — Índice de credenciais (sem valores)</li><li>Anexo D — Rotas do servidor web</li>
</ol>
${nota('Este caderno foi gerado a partir de dados recolhidos no próprio servidor a ' + HOJE + ' (versões, serviços, portas, tabelas, tamanhos). O gerador fica em <code>C:\\dirops\\APP_DIROPS_v2\\tools\\caderno-tecnico\\</code> para ser actualizado quando o sistema mudar. Substitui o RUNBOOK.md de 28/05/2026 e a Documentação Técnica de 28/08/2026, que já não reflectem a instalação actual.')}

<h1>1. Identificação e finalidade</h1>
<p>As três plataformas correm num único servidor da rede interna da SGA e partilham a mesma base de dados, mas têm <b>login, perfis e páginas próprios</b>:</p>
${tabela(['Plataforma', 'Endereço', 'Finalidade', 'Login'], [
  ['<b>DIROPS</b>', code('http://10.1.65.45/'), 'Gestão operacional da Direcção de Operações: voos e movimentos, tarifas e facturação (incl. Pronto Pagamento), KPI, Safety (ocorrências, inspecções, GRF), auditorias e PAC, credenciamento, manutenção, relatórios automáticos por email.', 'Próprio (auth)'],
  ['<b>Universidade Corporativa</b>', code('http://10.1.65.45/universidade'), 'Formação (LMS): cursos, aulas, vídeo, SCORM/xAPI, avaliações, certificados, trilhas, sessões presenciais, matriz de formação obrigatória.', 'Próprio desde 01/10/2026 (auth_uc)'],
  ['<b>Portal de Documentos (GED)</b>', code('http://10.1.65.45/documentos'), 'Gestão documental: manuais e procedimentos por aeroporto, versões, aprovação, emendas, Estrutura do MOA/PSA, regime AVSEC (acesso restrito), links para externos (ANAC).', 'Próprio desde 20/10/2026 (auth_docs)'],
])}
<p>Endereços públicos sem login (servidos pelas funções): ${code('/p/…')} e ${code('/s/…')} (links partilháveis do GED), ${code('/v/…')} (verificação), ${code('/cert/…')} (verificação de certificados da Universidade).</p>
<p><b>Utilizadores:</b> ${num(bd.contas.users_activos)} contas activas na ficha comum (<code>public.users</code>); contas de login: DIROPS ${num(bd.contas.auth)}, Universidade ${num(bd.contas.auth_uc)}, GED ${num(bd.contas.auth_docs)}.</p>
<p><b>Origem:</b> a aplicação foi migrada em 2026 da plataforma na nuvem Base44/Supabase para esta instalação local (on-premise). A sincronização nocturna com o Base44 foi desligada e as credenciais da nuvem foram revogadas.</p>

<h1>2. Arquitectura</h1>
<div class="diag">  Navegador (rede SGA)
        │  HTTP :80
        ▼
  ┌───────────────────────── nginx 1.26.2 (dirops-nginx-v2) 
  │  /  /universidade  /documentos   -> site (React, ficheiros em nginx\\html)
  │  /rest/v1   /uc/rest/v1   /gd/rest/v1            -> PostgREST   127.0.0.1:3000
  │  /auth/v1                                         -> GoTrue DIROPS 127.0.0.1:9999
  │  /uc/auth/v1                                      -> GoTrue UC     127.0.0.1:9998
  │  /gd/auth/v1                                      -> GoTrue GED    127.0.0.1:9997
  │  /functions/v1  /uc/functions/v1  /gd/functions/v1, /storage/…, /p/ /s/ /v/ /cert/
  │                                                   -> Funções Node 127.0.0.1:4001
  └
        │                               │
        ▼                               ▼                         ▼
  PostgreSQL 16.6  127.0.0.1:5432   storage\\ (ficheiros)     Saídas externas:
  base dirops_sga                    uploads, private-uploads  · relay SMTP mail.sga.co.ao:25
   · public    (dados + regras RLS)                              · dados de voo (FR24, FlightAware)
   · auth      (login DIROPS)                                     · LibreOffice/ffmpeg locais
   · auth_uc   (login Universidade)
   · auth_docs (login GED)</div>
<h2>2.1 Como um pedido é autorizado</h2>
<p>O utilizador entra pelo login da sua plataforma (GoTrue), que emite um <b>token JWT</b> assinado com um segredo comum às três instâncias. O site envia esse token em cada pedido. O PostgREST executa a consulta na base de dados com o papel <code>authenticated</code> e as <b>regras de acesso por linha (RLS)</b> decidem o que a pessoa vê, a partir do email do token, dos seus perfis em <code>public.users</code> e dos aeroportos a que tem acesso. As funções Node verificam o mesmo token e usam a chave de serviço só para operações que o próprio código controla.</p>
<h2>2.2 Princípios</h2>
<ul>
<li>Só o nginx escuta na rede (porta 80). Todos os outros serviços escutam apenas em 127.0.0.1.</li>
<li>Os dados nunca são filtrados só no navegador: a base de dados aplica as regras (RLS em todas as tabelas de dados).</li>
<li>Os ficheiros privados (documentos do GED) só se obtêm com endereço assinado e temporário, e os PDF saem com carimbo de “cópia não controlada”.</li>
</ul>

<h1>3. Servidor e sistema operativo</h1>
${tabela(['Item', 'Valor'], [
  ['Nome', esc(sis.host) + ' (srvkms001.sga.net)'], ['Endereço IP', esc(sis.ips)], ['Sistema operativo', esc(sis.so)],
  ['Processador', esc(sis.cpu)], ['Memória', sis.ram_gb + ' GB'], ['Disco', esc(sis.discos)], ['Fuso horário', 'Angola (UTC+1, sem hora de Verão)'],
])}
${nota('<b>Capacidade:</b> 2 núcleos e 8 GB servem a carga actual, mas há picos de CPU (sobretudo do antivírus Check Point Harmony e de conversões Office/vídeo). O disco C: tem apenas <b>19 GB livres</b> e guarda também as cópias de segurança (ver capítulo 17).', 'alerta')}
${nota('<b>Antivírus Check Point Harmony:</b> já marcou como falso positivo o supervisor antigo dos serviços (nssm.exe, incidente Gerisk ID 3194) e pôs a plataforma em baixo. O nssm foi substituído pelo DiropsServiceHost; recomenda-se manter a pasta <code>C:\\dirops\\sga-onpremise\\</code> na lista de exclusões/confiança do Check Point.', 'alerta')}

<h1>4. Software instalado e versões</h1>
${tabela(['Componente', 'Versão', 'Função'], VERSOES)}
<p>Todo o software do servidor é de código aberto (PostgreSQL, PostgREST, GoTrue, nginx, Node.js, LibreOffice, Tesseract, ffmpeg) excepto o Windows e o Chrome. Os instaladores originais estão em <code>C:\\dirops\\sga-onpremise\\installers\\</code>.</p>

<h1>5. Serviços Windows, portas e rede</h1>
${tabela(['Serviço', 'Estado / arranque', 'Escuta', 'Função'], servicos.map(s => [code(s.nome), esc(s.estado) + ' / ' + esc(s.arranque), esc(PORTA_SVC[s.nome] || '—'), esc(PAPEL_SVC[s.nome] || s.display)]))}
<p>Os serviços <code>dirops-*-v2</code> correm através do <b>DiropsServiceHost</b> (<code>service-host\\DiropsServiceHost.exe --config service-host\\conf\\&lt;serviço&gt;.ini</code>): arranca o programa, reinicia-o se cair e escreve os registos em <code>logs\\svc-*.log</code>. Todos arrancam automaticamente com o Windows (conta LocalSystem; o PostgreSQL usa NetworkService).</p>
<h2>5.1 Matriz de portas</h2>
${tabela(['Porta', 'Endereço', 'Processo', 'Acesso necessário'], [
  ['80/TCP', '0.0.0.0', 'nginx', '<b>Aberta à rede interna SGA</b> (utilizadores)'],
  ['3000', '127.0.0.1', 'postgrest', 'Só local'], ['4001', '127.0.0.1', 'node (funções)', 'Só local'], ['5432', '127.0.0.1', 'postgres', 'Só local'],
  ['9997 / 9998 / 9999', '127.0.0.1', 'auth (GoTrue GED / UC / DIROPS)', 'Só local'],
])}
<h2>5.2 Ligações de saída</h2>
${tabela(['Destino', 'Porta', 'Para quê'], [
  ['mail.sga.co.ao (relay SMTP interno)', '25', 'Emails: convites, recuperação de senha, relatórios automáticos, alertas. Só entrega a endereços @sga.co.ao.'],
  ['Internet (HTTPS)', '443', 'Dados de voo (FR24, FlightAware), actualizações npm quando se compila o site.'],
])}
${nota('O servidor tem acesso à Internet por Invoke-WebRequest / curl.exe / npm (o curl do Git Bash não resolve nomes externos).')}

<h1>6. Estrutura de pastas</h1>
${tabela(['Pasta', 'Tamanho', 'Conteúdo'], PASTAS.map(p => [code(p[0]), p[1], esc(p[2])]), 'mini')}
${nota('Não apagar nem mover nada dentro de <code>postgres-data\\</code>, <code>storage\\</code> ou <code>config\\</code>/<code>secrets\\</code> sem parar os serviços e sem cópia de segurança.', 'alerta')}

<h1>7. Base de dados</h1>
${tabela(['Item', 'Valor'], [
  ['Motor', esc(bd.versao)], ['Base de produção', 'dirops_sga — ' + esc(bd.tamanho_bd)], ['Pasta de dados', code(bd.parametros.data_directory)],
  ['Escuta', esc(bd.parametros.listen_addresses) + ':' + esc(bd.parametros.port) + ' (só local)'],
  ['Ligações máximas', esc(bd.parametros.max_connections)], ['shared_buffers / work_mem', '128 MB / 4 MB'],
  ['WAL / arquivo de WAL', esc(bd.parametros.wal_level) + ' / ' + esc(bd.parametros.archive_mode) + ' (sem recuperação a um ponto no tempo — ver cap. 14)'],
  ['Extensões', bd.extensoes.map(e => esc(e.nome) + ' ' + esc(e.versao)).join(', ')],
  ['Objectos', `${tabs.filter(t => t.tipo === 'r').length} tabelas, ${tabs.filter(t => t.tipo === 'v').length} vistas, ${num(bd.politicas_total)} regras RLS, ${num(bd.gatilhos)} gatilhos, ${bd.funcoes.reduce((a, f) => a + f.n, 0)} funções`],
])}
<h2>7.1 Esquemas</h2>
${tabela(['Esquema', 'Conteúdo'], [
  [code('public'), 'Dados das três plataformas e funções de regras de acesso.'], [code('auth'), 'Contas e sessões do login do DIROPS (GoTrue).'],
  [code('auth_uc'), 'Contas e sessões do login da Universidade.'], [code('auth_docs'), 'Contas e sessões do login do GED.'],
])}
<h2>7.2 Papéis (roles) da base de dados</h2>
${tabela(['Papel', 'Entra?', 'Superutilizador', 'Ignora RLS', 'Uso'], bd.papeis.filter(r => !/^(dirops_app|supabase)/.test('x') || true).map(r => [code(r.nome), r.login ? 'sim' : 'não', r.super ? 'sim' : 'não', r.bypassrls ? 'sim' : 'não',
  ({ postgres: 'Administração (migrações, cópias). Só local.', authenticator: 'Ligação do PostgREST; troca para anon/authenticated/service_role.', anon: 'Pedidos sem login (muito limitado — migração 169).', authenticated: 'Utilizador com login: sujeito às regras RLS.', service_role: 'Funções do servidor (operações controladas no código).', supabase_auth_admin: 'Ligação dos serviços GoTrue.' })[r.nome] || '']))}
<h2>7.3 Tabelas por plataforma</h2>
${tabela(['Plataforma', 'Tabelas', 'Vistas', 'Linhas (aprox.)', 'Espaço'], Object.entries(porPlat).sort((a, b) => b[1].bytes - a[1].bytes).map(([k, v]) => [esc(k), v.n, v.v, num(v.linhas), mb(v.bytes)]))}
<h3>Maiores tabelas</h3>
${tabela(['Tabela', 'Plataforma', 'Linhas', 'Espaço'], tabs.filter(t => t.tipo === 'r').sort((a, b) => b.bytes - a.bytes).slice(0, 15).map(t => [code(t.esquema + '.' + t.tabela), esc(t.plat), num(t.linhas), esc(t.tamanho)]))}
<h3>Tabelas principais de cada plataforma</h3>
${tabela(['Plataforma', 'Tabelas principais'], [
  ['DIROPS', 'voo, voo_ligado (pares chegada/partida), calculo_tarifa, tarifa_pouso, tarifa_permanencia, outra_tarifa, taxa_cambio, facturacao_trafego_pp, proforma, companhia_aerea, registo_aeronave, medicao_k_p_i, inspecao, ocorrencia_safety, registo_g_r_f, processo_auditoria, plano_acao_corretiva, credenciamento, ordem_servico, relatorio_agenda'],
  ['Universidade', 'curso, curso_versao, modulo, aula, matricula, progresso_aula, quiz, pergunta, tentativa, tentativa_gabarito (gabarito separado), certificado, trilha, sessao_formacao, scorm_estado, universidade_*'],
  ['GED', 'documento, documento_versao, documento_ficheiro, pasta, documento_aprovacao(_passo), documento_emenda, documento_leitura, documento_link_partilha, documento_credenciado (AVSEC), documento_pagina_texto (pesquisa), documentos_aeroporto, documentos_acesso_aeroporto, documentos_permissao, documentos_config'],
  ['Comum', 'users (ficha única: perfis, portais, aeroportos), empresa, aeroporto, log_auditoria (inviolável), regra_permissao, configuracao_sistema, api_key'],
])}
<p>O inventário completo, tabela a tabela, está no <b>Anexo A</b>.</p>
<h2>7.4 Migrações</h2>
<p>A estrutura é criada por ficheiros SQL numerados, aplicados por ordem com <code>psql -f</code> pelo utilizador <code>postgres</code>: <b>${migracoes.length} ficheiros</b> (lista no Anexo B). Os 01–171 estão em <code>sga-onpremise\\sql\\</code>; os mais recentes (172–179) em <code>APP_DIROPS_v2\\tools\\&lt;tema&gt;\\</code>. Todos terminam com <code>NOTIFY pgrst, 'reload schema';</code> para o PostgREST reconhecer as alterações sem reinício.</p>
${bloco(`# ligar à base de dados (PowerShell, como administrador)
$u = (Select-String -Path C:\\dirops\\sga-onpremise\\config\\auth.env -Pattern 'postgres://postgres:([^@]+)@' | Select-Object -First 1).Matches[0].Groups[1].Value
$env:PGPASSWORD = [System.Uri]::UnescapeDataString($u)
& "C:\\dirops\\sga-onpremise\\postgres\\bin\\psql.exe" -h 127.0.0.1 -U postgres -d dirops_sga
# aplicar uma migração
& "C:\\dirops\\sga-onpremise\\postgres\\bin\\psql.exe" -h 127.0.0.1 -U postgres -d dirops_sga -f <ficheiro.sql>`)}
${nota('A senha do utilizador postgres que autentica é a que está em <code>config\\auth.env</code> (URL de ligação do GoTrue). O ficheiro <code>secrets\\postgres_password.txt</code> está desactualizado e não autentica.', 'alerta')}

<h1>8. Autenticação, perfis e controlo de acesso</h1>
<h2>8.1 Três logins independentes</h2>
${tabela(['Login', 'Serviço', 'Esquema', 'Registo livre', 'Desde'], [
  ['DIROPS', 'dirops-auth-v2 :9999', 'auth', '<span class="prio-media">permitido</span> (ver cap. 17)', 'instalação'],
  ['Universidade', 'dirops-auth-uc-v2 :9998', 'auth_uc', 'bloqueado (só por convite)', '01/10/2026'],
  ['GED', 'dirops-auth-docs-v2 :9997', 'auth_docs', 'bloqueado (só por convite)', '20/10/2026'],
])}
<p>As contas do GED foram copiadas do DIROPS com a <b>mesma senha</b>, sem enviar emails. Enquanto a pessoa não entra no GED, a senha continua a acompanhar a do DIROPS; depois do primeiro login, as senhas são independentes. Para quem só tem conta na Universidade existe <code>tools\\ged-perfis\\clonar-conta-uc-para-gd.sql</code>. As activações são reversíveis: <code>scripts\\activar-documentos-isolado.ps1 -Rollback</code> (e o equivalente da Universidade).</p>
<h2>8.2 Perfis</h2>
${tabela(['Plataforma', 'Perfis', 'Onde se gerem'], [
  ['DIROPS', 'administrador, operacoes, infraestrutura, credenciamento, gestor_empresa, visualizador + perfis personalizados (regra_permissao)', 'DIROPS → Gerir Permissões / Gestão de Acessos'],
  ['Universidade', 'formando, instrutor, admin_universidade', 'Universidade → Gestão → Acessos'],
  ['GED', 'leitor, editor, gestor, admin _documentos + perfis próprios «doc_…» sobre um nível base (migração 179)', 'GED → Gestão → Acessos → Perfis e páginas'],
])}
<p>Os perfis das três plataformas vivem na coluna <code>users.perfis</code>; a coluna <code>users.portais</code> autoriza a entrada em cada portal. Estas colunas só são escritas pelo servidor (migração 168: ninguém se promove a partir do navegador).</p>
<h2>8.3 Regras de acesso aos dados</h2>
<ul>
<li><b>RLS em todas as tabelas de dados</b> (${num(bd.politicas_total)} regras). Funções-chave: <code>is_admin()</code>, <code>tem_perfil()</code>, <code>doc_ctx()</code> (contexto do GED calculado uma vez por pedido), <code>pode_gerir_formacao()</code>.</li>
<li><b>GED por aeroporto:</b> cada pessoa só vê os documentos dos aeroportos em <code>documentos_acesso_aeroporto</code>.</li>
<li><b>Regime AVSEC (NTA 32 / Instrutivo 32.009.001.A):</b> documentos e pastas AVSEC só são visíveis a gestores e a pessoal credenciado (<code>documento_credenciado</code>), com registo de credencial, sigilo e cópias controladas (migrações 158, 173–175).</li>
<li><b>Auditoria inviolável:</b> <code>log_auditoria</code> não aceita alterações nem apagamentos (migração 170); <code>log_acesso_documento</code> regista quem viu e descarregou cada documento.</li>
<li><b>Pedidos sem login</b> (papel anon) estão limitados ao mínimo (migração 169).</li>
</ul>

<h1>9. API e funções do servidor</h1>
<p><b>PostgREST</b> expõe as tabelas e funções do esquema public em <code>/rest/v1/…</code> (e <code>/uc/rest/v1</code>, <code>/gd/rest/v1</code>), sempre sujeito às regras RLS do token. <b>As funções Node</b> (<code>functions\\dirops-functions\\server.js</code>, porta 4001) tratam o que não pode ficar no navegador:</p>
${tabela(['Função (/functions/…)', 'O que faz'], FUNCOES.map(f => [code(f[0]), esc(f[1])]))}
${nota('Alterações a <code>server.js</code> exigem <code>Restart-Service dirops-functions-v2</code>. Cada alteração feita até hoje deixou cópia <code>server.js.bak-*</code> na mesma pasta.')}

<h1>10. Armazenamento de ficheiros</h1>
${tabela(['Pasta (storage\\)', 'Tamanho', 'Uso'], [
  ['uploads\\', '2,4 GB', 'Ficheiros do DIROPS e da Universidade (fotos, anexos, vídeos, pacotes).'],
  ['private-uploads\\', '1,1 GB', 'Ficheiros do GED. Só se obtêm por endereço assinado e temporário emitido pelas funções; os PDF são carimbados (cabeçalho/rodapé do Instrutivo 22C e “cópia não controlada”) no momento da entrega, sem alterar o original.'],
  ['_previsualizacao\\', '2 MB', 'PDF gerados a partir de Office para pré-visualização (cache).'],
  ['tmp\\', '<1 MB', 'Temporários de carregamento.'],
])}
<p>Os nomes dos ficheiros guardados têm um prefixo aleatório (ex. <code>405c5c727_…pdf</code>); a ligação ao documento está na base de dados (<code>documento_versao.arquivo_uri</code>, <code>documento_ficheiro</code>). Não renomear ficheiros à mão.</p>

<h1>11. Email</h1>
<ul>
<li>Todo o email sai pelo relay interno <b>mail.sga.co.ao:25</b> (sem autenticação TLS), a partir das funções Node (nodemailer) e dos três GoTrue.</li>
<li>O relay <b>só entrega a endereços @sga.co.ao</b> e trata envios com muitos destinatários em BCC como spam: o sistema envia uma mensagem por destinatário.</li>
<li>“Enviado” no sistema significa aceite pelo relay. Em Julho de 2026 o relay bloqueou temporariamente o servidor de correio (SRVEX003, 421 4.7.0); se voltar a acontecer, as devoluções lêem-se por IMAP.</li>
<li>Emails do sistema: alertas, suporte e acessos configuram-se no DIROPS (Configurações Gerais → Geral). Relatórios automáticos: DIROPS → Relatórios Automáticos (diário, semanal, mensal).</li>
</ul>

<h1>12. Aplicação web (frontend) e publicação</h1>
<p>Uma única aplicação React 18 + Vite 6 serve as três plataformas (rotas <code>/</code>, <code>/universidade</code>, <code>/documentos</code>). O código está em <code>C:\\dirops\\APP_DIROPS_v2</code> (Git, remoto ${code('github.com/MARCIOSAGER/APP_DIROPS_v2')}). A compilação vai para <code>dist\\</code> e publica-se copiando para <code>nginx\\html\\</code>:</p>
${bloco(`cd C:\\dirops\\APP_DIROPS_v2
npm test -- --run          # 366 testes automáticos
Remove-Item -Recurse -Force dist; npm run build
Copy-Item dist\\* C:\\dirops\\sga-onpremise\\nginx\\html\\ -Recurse -Force`)}
<ul>
<li>Variáveis de compilação em <code>.env.production</code>: <code>VITE_UC_ISOLADO=1</code> e <code>VITE_GD_ISOLADO=1</code> (logins independentes).</li>
<li>Depois de publicar, os utilizadores com o site aberto vêem o aviso de nova versão; se algo parecer antigo, <b>Ctrl+Shift+R</b>.</li>
<li>Nunca publicar se a compilação falhar (a pasta <code>dist\\</code> pode ficar incompleta).</li>
</ul>

<h1>13. Operação do dia-a-dia</h1>
<h2>13.1 Verificar o estado</h2>
${bloco(`Get-Service dirops-*, postgresql-x64-16 | Format-Table Name, Status, StartType
Invoke-WebRequest http://127.0.0.1/healthz -UseBasicParsing        # nginx
Invoke-WebRequest http://127.0.0.1/gd/auth/v1/health -UseBasicParsing   # login do GED
Invoke-WebRequest http://127.0.0.1/uc/auth/v1/health -UseBasicParsing   # login da Universidade`)}
<h2>13.2 Reiniciar</h2>
${bloco(`Restart-Service dirops-functions-v2      # depois de alterar server.js / docs-*.js
Restart-Service dirops-nginx-v2          # depois de alterar nginx.conf (nginx -s reload NÃO funciona como serviço)
Restart-Service dirops-postgrest-v2
Restart-Service dirops-auth-v2, dirops-auth-uc-v2, dirops-auth-docs-v2
# PostgreSQL (com cuidado: os outros serviços reconectam-se sozinhos)
Restart-Service postgresql-x64-16`)}
${nota('O aviso amarelo <i>“Waiting for service … to stop…”</i> é normal. O site fica 2–4 segundos sem resposta quando se reinicia o nginx.')}
<h2>13.3 Problemas conhecidos e primeira resposta</h2>
${tabela(['Sintoma', 'Causa habitual', 'O que fazer'], [
  ['Site lento / “GoTrue fora do ar” no painel', 'CPU saturado (Check Point, conversões)', 'Ver Gestor de Tarefas; normalmente recupera sozinho.'],
  ['Toda a plataforma em baixo', 'Antivírus pôs um executável em quarentena', 'Restaurar e excluir no Check Point; reiniciar serviços.'],
  ['Página antiga depois de publicar', 'Navegador com versão em cache', 'Ctrl+Shift+R.'],
  ['“Could not find column … in schema cache”', 'Migração aplicada sem recarregar o PostgREST', '<code>NOTIFY pgrst, \'reload schema\';</code> no psql.'],
  ['Email não chega', 'Relay recusou / destinatário externo', 'Ver <code>logs\\svc-functions*.log</code>; só @sga.co.ao.'],
  ['“Erro na aplicação: insertBefore…”', 'Google Tradutor a alterar a página', 'Desligar a tradução automática (o site já pede para não traduzir).'],
])}

<h1>14. Cópias de segurança e recuperação</h1>
${tabela(['O quê', 'Quando', 'Como', 'Onde', 'Retenção'], [
  ['Base de dados', 'Diário 02:00 (tarefa DIROPS-Backup-Daily)', code('scripts\\backup-postgres.ps1') + ' — pg_dump formato custom', code('backups\\dirops_sga_AAAAMMDD_HHMMSS.dump'), '14 dias'],
  ['Ficheiros (storage)', 'Diário 02:00', code('scripts\\backup-storage.ps1') + ' — robocopy acumulativo + manifesto CSV', code('backups\\storage-arquivo\\') + ', ' + code('backups\\manifestos\\'), 'Arquivo nunca apaga'],
  ['Código do site', 'A cada publicação', 'Git', 'GitHub MARCIOSAGER/APP_DIROPS_v2', 'Histórico'],
  ['Supervisor dos serviços', '—', 'Git', 'GitHub MARCIOSAGER/sga-onpremise-stack (+ recovery-wrapper.ps1)', 'Histórico'],
])}
<p>Última execução registada: base de dados ${esc('20/10/2026 02:00')}; ficheiros 20/10/2026 02:00–02:03 (5 445 ficheiros, 3,36 GB).</p>
<h2>14.1 Restaurar a base de dados</h2>
${bloco(`$dump = 'C:\\dirops\\sga-onpremise\\backups\\dirops_sga_AAAAMMDD_HHMMSS.dump'
# 1) restaurar numa base temporária e validar
psql -h 127.0.0.1 -U postgres -d postgres -c "CREATE DATABASE dirops_sga_restore"
pg_restore -h 127.0.0.1 -U postgres --dbname=dirops_sga_restore --no-owner --no-acl --jobs=2 $dump
# 2) trocar com a produção
Stop-Service dirops-auth-v2, dirops-auth-uc-v2, dirops-auth-docs-v2, dirops-postgrest-v2, dirops-functions-v2
psql -h 127.0.0.1 -U postgres -d postgres -c "ALTER DATABASE dirops_sga RENAME TO dirops_sga_old"
psql -h 127.0.0.1 -U postgres -d postgres -c "ALTER DATABASE dirops_sga_restore RENAME TO dirops_sga"
Start-Service dirops-postgrest-v2, dirops-auth-v2, dirops-auth-uc-v2, dirops-auth-docs-v2, dirops-functions-v2
# ensaio sem tocar na produção:
powershell -File C:\\dirops\\sga-onpremise\\scripts\\dr-test.ps1`)}
${nota('<b>Risco:</b> as cópias ficam no mesmo disco C: do servidor. Uma avaria do disco ou do servidor, ou um ataque de ransomware, perde a produção e as cópias ao mesmo tempo. O arquivo de WAL está desligado: a recuperação possível é para a cópia da noite anterior (perda de até 24 h). Ver recomendações R1 e R2.', 'risco')}

<h1>15. Monitorização e registos</h1>
${tabela(['O quê', 'Onde'], [
  ['Serviços (saída/erros)', code('logs\\svc-<serviço>.out.log / .err.log / .log') + ' e ' + code('logs\\dirops-*.super.log') + ' (supervisor)'],
  ['nginx', code('nginx\\logs\\access.log') + ', ' + code('nginx\\logs\\error.log')],
  ['PostgreSQL', code('postgres-data\\log\\')],
  ['Erros no navegador dos utilizadores', code('logs\\client-errors.jsonl') + ' (recolhidos pela função log-error)'],
  ['Cópias de segurança', code('backups\\backup.log')],
  ['Activações dos logins', code('logs\\activar-*.log')],
  ['Relatórios automáticos', code('logs\\relatorios-dispatcher.log')],
  ['Vigilância', 'Tarefa DIROPS-Watchdog (5 em 5 min) — envia alerta para o email de alertas se um serviço falhar (limite 30 min). Script: ' + code('scripts\\watchdog.ps1')],
  ['Limpeza de registos', 'Tarefa diária 03:00 — ' + code('scripts\\cleanup-old-logs.ps1') + ' (apaga registos com mais de 14 dias)'],
])}
${nota('As tarefas agendadas pertencem à conta SYSTEM: consultem-se no Agendador de Tarefas com uma conta de administrador. A tarefa antiga de sincronização com o Base44 (04:00) está neutralizada por código e deve ser removida (R7).')}

<h1>16. Segurança: controlos existentes</h1>
<ul>
<li>Exposição mínima: só a porta 80 aceita ligações; base de dados, API, logins e funções escutam apenas no próprio servidor.</li>
<li>Regras de acesso na base de dados (RLS) em todas as tabelas de dados; o navegador nunca recebe dados a que o perfil não dá direito.</li>
<li>Perfis e portais só alterados pelo servidor (migração 168); papel anónimo bloqueado (169); auditoria inviolável (170).</li>
<li>Logins independentes por plataforma (DIROPS, Universidade, GED); registo livre bloqueado na Universidade e no GED.</li>
<li>Documentos do GED: ficheiros privados com endereço assinado, carimbo e marca “cópia não controlada” com nome e hora de quem descarrega; registo de cada visualização e descarga; regime AVSEC com credenciação.</li>
<li>Avaliações da Universidade corrigidas no servidor; gabarito em tabela separada; anti-batota registado.</li>
<li>Varreduras de segurança feitas em 29/08 e 03/10/2026 (23 achados; os críticos corrigidos e provados).</li>
</ul>

<h1>17. Riscos e recomendações à TI</h1>
${tabela(['#', 'Prioridade', 'Situação', 'Recomendação'], [
  ['R1', '<span class="prio-alta">Alta</span>', 'Cópias de segurança só no disco C: do próprio servidor.', 'Copiar diariamente <code>backups\\</code> para outro servidor/NAS da SGA ou armazenamento externo, com retenção e teste de restauro periódico.'],
  ['R2', '<span class="prio-alta">Alta</span>', 'Disco C: com 19 GB livres (de 89 GB); arquivo de ficheiros cresce sempre.', 'Aumentar o disco ou acrescentar um disco de dados (D:) para storage e backups; alerta a 15%.'],
  ['R3', '<span class="prio-alta">Alta</span>', 'Site servido em HTTP simples (sem cifra) na rede interna.', 'Emitir certificado interno (PKI da SGA) para srvkms001.sga.net e activar HTTPS no nginx, com redirecção de :80.'],
  ['R4', '<span class="prio-media">Média</span>', 'Login do DIROPS aceita registo livre (GOTRUE_DISABLE_SIGNUP=false).', 'Mudar para true em <code>config\\auth.env</code> e reiniciar <code>dirops-auth-v2</code> (as contas novas passam a ser só por convite/administrador).'],
  ['R5', '<span class="prio-media">Média</span>', 'Windows Server sem activação (aviso “Activate Windows”).', 'Regularizar o licenciamento.'],
  ['R6', '<span class="prio-media">Média</span>', 'Credenciais em ficheiros de texto (config\\, secrets\\); secrets\\postgres_password.txt desactualizado.', 'Restringir as permissões NTFS dessas pastas a administradores; rodar as chaves com a TI; actualizar ou remover o ficheiro desactualizado.'],
  ['R7', '<span class="prio-media">Média</span>', 'Tarefa agendada antiga de sincronização com Base44 ainda registada (neutralizada).', 'Remover a tarefa DIROPS-Base44Sync-Daily e a chave base44_api_key.txt.'],
  ['R8', '<span class="prio-media">Média</span>', 'Sem arquivo de WAL: recuperação só para a cópia da noite anterior.', 'Avaliar archive_mode=on com cópia dos WAL para fora do servidor (recuperação a um ponto no tempo).'],
  ['R9', '<span class="prio-baixa">Baixa</span>', `${bkTabs.length} tabelas de cópia temporária de correcções antigas (${mb(bkTabs.reduce((a, t) => a + t.bytes, 0))}).`, 'Exportar para arquivo e remover depois de confirmação funcional.'],
  ['R10', '<span class="prio-baixa">Baixa</span>', 'Código-fonte com alterações por registar no Git desde 16/09/2026.', 'Fazer commit e push regulares (o servidor já tem chave de deploy para o GitHub).'],
  ['R11', '<span class="prio-baixa">Baixa</span>', 'Servidor com 2 núcleos e 8 GB; picos de CPU do antivírus.', 'Avaliar 4 núcleos / 16 GB e exclusões do Check Point para as pastas da plataforma.'],
  ['R12', '<span class="prio-baixa">Baixa</span>', 'Documentação operacional antiga (RUNBOOK.md de 28/05).', 'Usar este caderno como referência e regenerá-lo após alterações relevantes.'],
])}
${semRls.length ? nota(`<b>Tabelas sem RLS (${semRls.length}):</b> ${semRls.map(t => code(t.tabela)).join(', ')} — verificado a ${HOJE}: sem permissões para os papéis da API (anon/authenticated); só o servidor (service_role) lhe acede. É o contador interno de numeração. Situação correcta; manter assim.`) : ''}

<h1>Anexo A — Inventário completo das tabelas</h1>
<p>Tipo: r = tabela, v = vista. Linhas: estimativa do PostgreSQL. RLS: regras de acesso activas (número de regras).</p>
${tabela(['Esquema.tabela', 'Plataforma', 'Tipo', 'Linhas', 'Espaço', 'RLS'], tabs.slice().sort((a, b) => (a.esquema + a.tabela).localeCompare(b.esquema + b.tabela)).map(t => [code(t.esquema + '.' + t.tabela), esc(t.plat), t.tipo, t.tipo === 'r' ? num(t.linhas) : '—', esc(t.tamanho), t.tipo === 'r' ? (t.rls ? 'sim (' + t.politicas + ')' : 'não') : '—']), 'mini')}

<h1>Anexo B — Migrações da base de dados</h1>
<p>${migracoes.length} ficheiros, aplicados por ordem. Origem: <code>sga-onpremise\\sql\\</code> (até 171) e <code>APP_DIROPS_v2\\tools\\*\\</code> (172–179).</p>
<div style="columns: 3; font-family: Consolas, monospace; font-size: 7.2pt;">${migracoes.map(m => esc(m)).join('<br>')}</div>

<h1>Anexo C — Índice de credenciais (sem valores)</h1>
${tabela(['Ficheiro', 'Conteúdo', 'Usado por'], [
  [code('config\\auth.env'), 'Ligação à BD (utilizador postgres / auth admin), segredo JWT, SMTP', 'dirops-auth-v2; administração (psql)'],
  [code('config\\auth-uc.env'), 'Idem para o login da Universidade', 'dirops-auth-uc-v2'],
  [code('config\\auth-docs.env'), 'Idem para o login do GED', 'dirops-auth-docs-v2'],
  [code('postgrest\\*.conf'), 'Ligação do authenticator, segredo JWT', 'dirops-postgrest-v2'],
  [code('secrets\\jwt_secret.txt'), 'Segredo comum de assinatura dos tokens', 'GoTrue ×3, PostgREST, funções'],
  [code('secrets\\anon_key.txt / service_role_key.txt'), 'Chaves JWT anónima e de serviço', 'Site (anon); funções e ferramentas (service_role)'],
  [code('secrets\\authenticator_password.txt / app_db_password.txt'), 'Senhas de papéis da BD', 'PostgREST'],
  [code('secrets\\smtp_user.txt / smtp_password.txt / smtp_from.txt'), 'Conta de envio de email', 'Funções'],
  [code('secrets\\postgres_password.txt'), '<b>desactualizado</b> — não autentica', '—'],
  [code('secrets\\base44_api_key.txt'), 'Chave da plataforma antiga (revogada)', '— (remover)'],
])}
${nota('Quem tiver acesso de leitura a <code>config\\</code> ou <code>secrets\\</code> consegue ler e alterar todos os dados. Manter acesso só a administradores.', 'risco')}

<h1>Anexo D — Rotas do servidor web (nginx.conf)</h1>
${tabela(['Rota', 'Destino'], [
  ['/ , /universidade/… , /documentos/…', 'Site (index.html, aplicação de página única)'],
  ['/assets/, /sw.js, /registerSW.js, /manifest.webmanifest, /workbox-*.js', 'Ficheiros estáticos e service worker'],
  ['/rest/v1/ , /uc/rest/v1/ , /gd/rest/v1/', 'PostgREST :3000'],
  ['/auth/v1/ , /verify', 'GoTrue DIROPS :9999'], ['/uc/auth/v1/ , /universidade/verify', 'GoTrue Universidade :9998'], ['/gd/auth/v1/ , /documentos/verify', 'GoTrue GED :9997'],
  ['/functions/v1/ , /uc/functions/v1/ , /gd/functions/v1/', 'Funções Node :4001 (lms-upload até 1,1 GB, em streaming)'],
  ['/storage/v1/object/ , /uc/… , /gd/…', 'Funções Node (ficheiros, com verificação de acesso)'],
  ['/p/ , /s/ , /v/ , /cert/', 'Funções Node (links partilháveis, verificação, certificados)'],
  ['/healthz', 'Resposta de saúde do nginx'],
])}
<p style="margin-top:8mm;color:#64748b">— Fim do caderno técnico, versão ${VERSAO} (${HOJE}). —</p>
</body></html>`;

fs.writeFileSync(DIR + 'Caderno_Tecnico_Plataformas_SGA.html', html, 'utf8');
const pdf = DIR + 'Caderno_Tecnico_Plataformas_SGA.pdf';
execFileSync('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${pdf.replace(/\//g, '\\')}`,
  'file:///' + (DIR + 'Caderno_Tecnico_Plataformas_SGA.html'),
], { stdio: 'ignore', timeout: 120000 });
console.log('PDF:', pdf, fs.statSync(pdf).size, 'bytes');
