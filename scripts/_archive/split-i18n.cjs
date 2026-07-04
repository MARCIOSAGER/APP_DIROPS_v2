/**
 * Script to split monolithic i18n.jsx into per-namespace JSON files.
 * Run with: node scripts/split-i18n.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const I18N_DIR = path.join(SRC, 'i18n');
const I18N_JSX = path.join(SRC, 'components', 'lib', 'i18n.jsx');

// Read the file
const content = fs.readFileSync(I18N_JSX, 'utf8');
const lines = content.split('\n');

// Find PT and EN boundaries
let ptStart = -1, ptEnd = -1, enStart = -1, enEnd = -1;
for (let i = 0; i < lines.length; i++) {
  const trimmed = lines[i].trim();
  if (ptStart === -1 && /^pt:\s*\{/.test(trimmed)) { ptStart = i + 1; continue; }
  if (ptStart !== -1 && ptEnd === -1 && /^en:\s*\{/.test(trimmed)) { ptEnd = i - 1; enStart = i + 1; continue; }
}
// Find end of EN section
for (let i = lines.length - 1; i > enStart; i--) {
  if (lines[i].trim() === '}') {
    // This is the closing of the translations object
    enEnd = i - 1;
    break;
  }
}

console.log(`PT section: lines ${ptStart + 1} to ${ptEnd + 1}`);
console.log(`EN section: lines ${enStart + 1} to ${enEnd + 1}`);

// Parse key-value pairs from a range of lines
function extractKeys(startLine, endLine) {
  const keys = {};
  for (let i = startLine; i <= endLine; i++) {
    const line = lines[i];
    if (!line) continue;
    // Match: 'key': 'value',  or  'key': 'value'
    // Values may contain escaped quotes
    const match = line.match(/^\s*'([^']+)'\s*:\s*'((?:[^'\\]|\\.)*)'\s*,?\s*$/);
    if (match) {
      // Unescape the value for JSON storage
      keys[match[1]] = match[2].replace(/\\'/g, "'").replace(/\\n/g, '\n');
    }
  }
  return keys;
}

const ptKeys = extractKeys(ptStart, ptEnd);
const enKeys = extractKeys(enStart, enEnd);

console.log(`PT keys extracted: ${Object.keys(ptKeys).length}`);
console.log(`EN keys extracted: ${Object.keys(enKeys).length}`);

// Define namespace mapping: prefix -> filename
// Every first-level prefix maps to a namespace file
const namespaceMap = {
  // Layout & navigation
  'layout': 'layout',
  'sidebar': 'layout',
  'nav': 'layout',
  'menu': 'layout',

  // Common (buttons, labels, messages, status, table)
  'btn': 'common',
  'label': 'common',
  'msg': 'common',
  'status': 'common',
  'table': 'common',
  'common': 'common',
  'general': 'common',
  'validation': 'common',
  'error': 'common',

  // Page titles
  'page': 'page',

  // Tabs
  'tab': 'operacoes',

  // Operacoes (flights, config, FlightAware, etc.)
  'operacoes': 'operacoes',
  'flightaware': 'operacoes',
  'importacao': 'operacoes',
  'monitoramento': 'operacoes',
  'formVoo': 'operacoes',
  'voosTable': 'operacoes',
  'voosLigados': 'operacoes',
  'voosLigadosKPIs': 'operacoes',
  'voosKPIs': 'operacoes',
  'lixeiraVoos': 'operacoes',
  'cacheFA': 'operacoes',
  'comparison': 'operacoes',
  'configAeroportos': 'operacoes',
  'configCompanhias': 'operacoes',
  'configModelos': 'operacoes',
  'configRegistos': 'operacoes',
  'searchProgress': 'operacoes',
  'progressModal': 'operacoes',
  'vooFAReview': 'operacoes',
  'docVoo': 'operacoes',
  'upload': 'operacoes',
  'recursosVoo': 'operacoes',
  'emailPreview': 'operacoes',

  // Tarifas & Proforma & Faturacao
  'tarifas': 'proforma',
  'tarifasModal': 'proforma',
  'cambio': 'proforma',
  'proforma': 'proforma',
  'formTarifaPouso': 'proforma',
  'formTarifaPerm': 'proforma',
  'formTarifaRec': 'proforma',
  'formOutraTarifa': 'proforma',
  'formImposto': 'proforma',
  'gerirTipos': 'proforma',
  'gerarFatura': 'proforma',
  'operGerarFatura': 'proforma',
  'gerarConsolidada': 'proforma',
  'gerarRelatorio': 'proforma',
  'editarFatura': 'proforma',
  'dashFat': 'proforma',

  // Fundo de Maneio
  'fundo': 'fundo',
  'financeiro': 'fundo',
  'formMov': 'fundo',

  // Safety
  'safety': 'safety',

  // Acessos (gestao users, empresas, permissions)
  'acessos': 'acessos',
  'gestao': 'acessos',
  'empresas': 'acessos',
  'permissoes': 'acessos',

  // KPIs
  'kpis': 'kpis',
  'kpi': 'kpis',
  'kpi_config': 'kpis',
  'kpi_dash': 'kpis',

  // Home / Dashboard
  'home': 'home',
  'dashboard': 'home',

  // Auditoria
  'auditoria': 'auditoria',
  'auditoriaList': 'auditoria',
  'auditoriaDetail': 'auditoria',
  'formAuditoria': 'auditoria',
  'formChecklist': 'auditoria',
  'formPAC': 'auditoria',
  'configAuditoria': 'auditoria',
  'checklistItems': 'auditoria',

  // Inspecoes
  'inspecoes': 'inspecoes',
  'inspecoesList': 'inspecoes',
  'formInspecao': 'inspecoes',
  'inspecaoDetail': 'inspecoes',
  'tiposConfig': 'inspecoes',
  'checklist': 'inspecoes',

  // Manutencao
  'manutencao': 'manutencao',
  'manutencaoForm': 'manutencao',
  'manutencaoStats': 'manutencao',
  'configNotif': 'manutencao',
  'osList': 'manutencao',
  'ssList': 'manutencao',
  'ssForm': 'manutencao',
  'ssDetail': 'manutencao',
  'osDetail': 'manutencao',
  'atribuirOS': 'manutencao',
  'analisarSS': 'manutencao',
  'responderOS': 'manutencao',

  // Credenciamento
  'credenciamento': 'credenciamento',
  'cred': 'credenciamento',
  'cred_config': 'credenciamento',
  'credPublico': 'credenciamento',

  // Reclamacoes
  'reclamacoes': 'reclamacoes',
  'recl': 'reclamacoes',
  'recl_form': 'reclamacoes',
  'recl_config': 'reclamacoes',
  'recl_detail': 'reclamacoes',
  'recl_stats': 'reclamacoes',

  // Documentos
  'documentos': 'documentos',
  'doc': 'documentos',
  'docs': 'documentos',
  'pasta': 'documentos',
  'historico': 'documentos',

  // GRF
  'grf': 'grf',

  // Lixeira
  'lixeira': 'lixeira',

  // Servicos Aeroportuarios
  'servicos': 'servicos',

  // Log de Auditoria
  'logAuditoria': 'logauditoria',

  // Login / Auth
  'login': 'auth',
  'auth': 'auth',
  'aguardando': 'auth',
  'aguard': 'auth',
  'boasVindas': 'auth',
  'boas': 'auth',
  'alterarSenha': 'auth',
  'senha': 'auth',
  'configPerfil': 'auth',
  'solicitacao': 'auth',
  'solic': 'auth',
  'perfil': 'auth',
  'validacao': 'auth',
  'termos': 'auth',
  'politica': 'auth',

  // Configuracoes Gerais
  'configGerais': 'configuracoes',

  // Notificacoes
  'notificacoes': 'notificacoes',

  // API Keys
  'apiKeys': 'apikeys',

  // Guia utilizador
  'guia': 'guia',

  // Portal empresa
  'portal': 'portal',

  // Power BI
  'powerbi': 'powerbi',

  // Shared/UI components
  'shared': 'shared',
  'ui': 'shared',
};

function categorizeKeys(keys) {
  const buckets = {};
  const remaining = {};

  for (const [key, value] of Object.entries(keys)) {
    const prefix = key.split('.')[0];
    const namespace = namespaceMap[prefix];
    if (namespace) {
      if (!buckets[namespace]) buckets[namespace] = {};
      buckets[namespace][key] = value;
    } else {
      remaining[key] = value;
    }
  }

  // Put remaining in 'remaining' namespace
  if (Object.keys(remaining).length > 0) {
    console.log(`\nUnmapped prefixes:`);
    const unmappedPrefixes = new Set();
    for (const key of Object.keys(remaining)) {
      unmappedPrefixes.add(key.split('.')[0]);
    }
    console.log([...unmappedPrefixes].sort().join(', '));
    console.log(`Total unmapped keys: ${Object.keys(remaining).length}`);
    buckets['remaining'] = { ...(buckets['remaining'] || {}), ...remaining };
  }

  return buckets;
}

const ptBuckets = categorizeKeys(ptKeys);
const enBuckets = categorizeKeys(enKeys);

// Ensure all namespaces exist in both languages
const allNamespaces = new Set([...Object.keys(ptBuckets), ...Object.keys(enBuckets)]);

// Create directories
fs.mkdirSync(path.join(I18N_DIR, 'pt'), { recursive: true });
fs.mkdirSync(path.join(I18N_DIR, 'en'), { recursive: true });

// Write JSON files
for (const ns of allNamespaces) {
  const ptData = ptBuckets[ns] || {};
  const enData = enBuckets[ns] || {};

  fs.writeFileSync(
    path.join(I18N_DIR, 'pt', `${ns}.json`),
    JSON.stringify(ptData, null, 2) + '\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(I18N_DIR, 'en', `${ns}.json`),
    JSON.stringify(enData, null, 2) + '\n',
    'utf8'
  );

  console.log(`  ${ns}: PT=${Object.keys(ptData).length}, EN=${Object.keys(enData).length}`);
}

// Generate index.js
const sortedNamespaces = [...allNamespaces].sort();
let indexContent = '// Auto-generated — do not edit manually\n// Run `node scripts/split-i18n.js` to regenerate\n\n';

for (const ns of sortedNamespaces) {
  const ptVar = `pt_${ns.replace(/[^a-zA-Z0-9]/g, '_')}`;
  const enVar = `en_${ns.replace(/[^a-zA-Z0-9]/g, '_')}`;
  indexContent += `import ${ptVar} from './pt/${ns}.json';\n`;
  indexContent += `import ${enVar} from './en/${ns}.json';\n`;
}

indexContent += '\nexport const translations = {\n';
indexContent += '  pt: {\n';
for (const ns of sortedNamespaces) {
  const ptVar = `pt_${ns.replace(/[^a-zA-Z0-9]/g, '_')}`;
  indexContent += `    ...${ptVar},\n`;
}
indexContent += '  },\n';
indexContent += '  en: {\n';
for (const ns of sortedNamespaces) {
  const enVar = `en_${ns.replace(/[^a-zA-Z0-9]/g, '_')}`;
  indexContent += `    ...${enVar},\n`;
}
indexContent += '  },\n';
indexContent += '};\n';

fs.writeFileSync(path.join(I18N_DIR, 'index.js'), indexContent, 'utf8');
console.log(`\nWrote ${path.join(I18N_DIR, 'index.js')}`);

// Verify: total key counts match
let ptTotal = 0, enTotal = 0;
for (const ns of allNamespaces) {
  ptTotal += Object.keys(ptBuckets[ns] || {}).length;
  enTotal += Object.keys(enBuckets[ns] || {}).length;
}
console.log(`\nVerification:`);
console.log(`  PT original: ${Object.keys(ptKeys).length}, split total: ${ptTotal} ${Object.keys(ptKeys).length === ptTotal ? '✓' : '✗ MISMATCH!'}`);
console.log(`  EN original: ${Object.keys(enKeys).length}, split total: ${enTotal} ${Object.keys(enKeys).length === enTotal ? '✓' : '✗ MISMATCH!'}`);
