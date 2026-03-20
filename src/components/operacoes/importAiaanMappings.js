/**
 * Mapeamentos para importação de dados AIAAN Excel → DIROPS
 * - Cidades (como aparecem no Excel) → Códigos ICAO
 * - Operadores (como aparecem no Excel) → Códigos ICAO de companhia aérea
 */

// Cidade/Destino → Código ICAO do aeroporto
export const CITY_TO_ICAO = {
  // Angola (domésticos)
  'CABINDA': 'FNCA',
  'CATUMBELA': 'FNCT',
  'LUBANGO': 'FNUB',
  'SAURIMO': 'FNSA',
  'SOYO': 'FNSO',
  'HUAMBO': 'FNHU',
  'MOÇÂMEDES': 'FNMO',
  'MOCAMEDES': 'FNMO',
  'MOÇAMEDES': 'FNMO',
  'NAMIBE': 'FNMO',
  'ONDJIVA': 'FNGI',
  'LUENA': 'FNUE',
  'MENONGUE': 'FNME',
  'DUNDO': 'FNDU',
  'KUITO': 'FNKU',
  'CUITO': 'FNKU',
  'LUANDA': 'FNLU',
  'BOM JESUS': 'FNBJ',

  // África
  'JOHANNESBURG': 'FAOR',
  'JOHANESBURGO': 'FAOR',
  'JOHANESBURGOO': 'FAOR',
  'JOHANNESBURGO': 'FAOR',
  'JOANESBURGO': 'FAOR',
  'CAPE TOWN': 'FACT',
  'CAPETOWN': 'FACT',
  'LAGOS': 'DNMM',
  'MAPUTO': 'FQMA',
  'ADDIS ABEBA': 'HAAB',
  'ADDIS ABABA': 'HAAB',
  'ADDIS-ABEBA': 'HAAB',
  'ADIS ABEBA': 'HAAB',
  'ETHIOPIA': 'HAAB',
  'NAIROBI': 'HKJK',
  'WINDHOEK': 'FYWH',
  'KINSHASA': 'FZAA',
  'SÃO TOMÉ': 'FPST',
  'SAO TOME': 'FPST',
  'BRAZZAVILLE': 'FCBB',
  'BRAZAVILLE': 'FCBB',
  'PONTA NEGRA': 'FCPP',
  'PONTA-NEGRA': 'FCPP',
  'LOMÉ': 'DXXX',
  'LOME': 'DXXX',
  'CASABLANCA': 'GMMN',
  'CASA BLANCA': 'GMMN',
  'PORT HARCOURT': 'DNPO',
  'PORTO HARCOURT': 'DNPO',
  'ACCRA': 'DGAA',
  'ABIDJAN': 'DIAP',
  'LANSERIA': 'FALA',
  'LUSAKA': 'FLKK',
  'MAUN': 'FBMN',
  'BANGUI': 'FEFF',
  'BANGUI-M\'POKO': 'FEFF',
  'DOUALA': 'FKKD',
  'COTONOU': 'DBBB',
  'ENTEBBE': 'HUEN',
  'KANO': 'DNKN',
  'CAIRO': 'HECA',
  'MALABO': 'FGSL',
  'NIAMEY': 'DRRN',
  'HARARE': 'FVHA',
  'HARGEISA': 'HCMH',
  'NIGERIA': 'DNMM',
  'BHISHO BULEMBO': 'FABE',
  'REPUBLICA CENTRO AFRICANA': 'FEFF',

  // Europa
  'LISBOA': 'LPPT',
  'PARIS': 'LFPG',
  'FRANKFURT': 'EDDF',
  'PORTO': 'LPPR',
  'ISTAMBUL': 'LTFM',
  'ISTANBUL': 'LTFM',
  'LIÈGE': 'EBLG',
  'LIEGE': 'EBLG',
  'FARO': 'LPFR',
  'ALICANTE': 'LEAL',
  'BEIRUT': 'OLBA',
  'N\'DJAMENA': 'FTTJ',
  'NDJAMENA': 'FTTJ',

  // Médio Oriente
  'DUBAI': 'OMDB',
  'DOHA': 'OTHH',
  'ABU-DABI': 'OMAA',
  'ABU DABI': 'OMAA',
  'SHARJAH': 'OMSJ',
  'JEDDAH': 'OEJN',
  'BAKU': 'UBBB',

  // Américas
  'SÃO PAULO': 'SBGR',
  'SAO PAULO': 'SBGR',
  'GUARULHOS': 'SBGR',
  'GUARULHO': 'SBGR',
  'HAVANA': 'MUHA',
  'VICTORVILLE': 'KVCV',
  'EVERET,EUA': 'KPAE',

  // Ásia
  'HONG KONG': 'VHHH',
  'KUALA LUMPUR': 'WMKK',
};

// Operador (como aparece no Excel) → Código ICAO da companhia aérea
export const OPERATOR_TO_ICAO = {
  'TAAG': 'DT',
  'TAP AIR PORTUGAL': 'TP',
  'TAP': 'TP',
  'ETHIOPIAN AIRLINES': 'ET',
  'ETHIOPIAN': 'ET',
  'EMIRATES': 'EK',
  'AIR FRANCE': 'AF',
  'LUFTHANSA': 'LH',
  'QATAR': 'QR',
  'ASKY': 'KP',
  'TURKISH AIRLINES': 'TK',
  'ROYAL AIR MAROC': 'AT',
  'RAM': 'AT',
  'HELIMALONGO': 'HMG',
  'HELI MALONGO': 'HMG',
  'AIRLINK': 'LNK',
  'AIR LINK': 'LNK',
  'MULTIFLIGHT': 'MFT',
  'SKY VISION AIRLINES': 'SVA',
  'NEW WAY CARGO': 'NWC',
  'BESTFLY': 'BFL',
  'COMAIR FLIGTH SERVICES': 'CAW',
  'CAVOK AIR': 'CVK',
  'CAVOKAIR': 'CVK',
  'AFRICA CHARTER AIRLINE': 'FSK',
  'AIR JET': 'AJT',
  'AIR ATLANTA ICELANDIC': 'ABD',
  'AIRATLANTA ICELANDIC': 'ABD',
  'BIDAIR CARGO': 'BDC',
  'FLY PRO': 'FPR',
  'NEW RAYDE': 'NRD',
  'NEWRADE': 'NRD',
  'NEWRAYDE': 'NRD',
  'ETIHAD AIRWAYS': 'EY',
  'SILKWAY AIR LINES': 'AZG',
  'FLY VAAYU': 'FVY',
  'STAR AIR CARGO': 'SRR',
  'GUARDIAN AIR': 'GAR',
  'PEDRO SEBASTIÃO': 'PDS',
  'PROFLIGHT': 'PFZ',
  'UKRAINE AIR ALLIANCE': 'UKL',
  'ALPHA SKY': 'ASK',
};

// Normalizar nomes de destino (limpar encoding issues)
export function normalizeDestino(raw) {
  if (!raw) return '';
  let s = String(raw).trim().toUpperCase();
  // Fix common encoding issues
  s = s.replace(/MO[^\w]*MEDES/i, 'MOÇÂMEDES');
  s = s.replace(/S[^\w]*O PAULO/i, 'SÃO PAULO');
  s = s.replace(/S[^\w]*O TOM[^\w]*/i, 'SÃO TOMÉ');
  s = s.replace(/LOM[^\w]*/i, 'LOMÉ');
  s = s.replace(/LI[^\w]*GE/i, 'LIÈGE');
  s = s.replace(/N[^\w]*DJAMENA/i, 'N\'DJAMENA');
  s = s.replace(/BANGUI-M[^\w]*POKO/i, 'BANGUI');
  return s;
}

// Normalizar nome de operador
export function normalizeOperator(raw) {
  if (!raw) return '';
  let s = String(raw).trim().toUpperCase();
  if (s === '-' || /^\d+$/.test(s)) return '';
  s = s.replace(/PEDRO SEBASTI[^\w]*/i, 'PEDRO SEBASTIÃO');
  return s;
}

// Lookup com fallback
export function lookupICAO(city) {
  const normalized = normalizeDestino(city);
  return CITY_TO_ICAO[normalized] || null;
}

export function lookupOperatorICAO(operator) {
  const normalized = normalizeOperator(operator);
  return OPERATOR_TO_ICAO[normalized] || null;
}
