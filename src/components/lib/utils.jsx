import { parse, addDays } from 'date-fns';

export function cn(...inputs) {
  // Simple utility to combine class names, avoiding external packages.
  return inputs.filter(Boolean).join(' ');
}

/**
 * Normaliza um código/registo para comparação
 * Remove espaços, hífens e outros caracteres especiais
 * Converte para maiúsculas
 */
export function normalizeCode(code) {
  if (!code || typeof code !== 'string') return '';
  
  return code
    .trim()
    .toUpperCase()
    .replace(/[\s\-_.]/g, '');
}

/**
 * Verifica se dois códigos são duplicados (considerando normalização)
 */
export function areCodesDuplicate(code1, code2) {
  return normalizeCode(code1) === normalizeCode(code2);
}

/**
 * Normaliza um registo de aeronave (alias para normalizeCode)
 */
export function normalizeRegistoAeronave(registo) {
  return normalizeCode(registo);
}

/**
 * Normaliza um registo de aeronave
 * Remove espaços, hífens e converte para maiúsculas
 * Retorna o formato padronizado para armazenamento
 */
export function normalizeAircraftRegistration(registration) {
  if (!registration) return '';
  
  // Remove espaços, hífens e converte para maiúsculas
  const normalized = String(registration).trim().replace(/[\s-]/g, '').toUpperCase();
  
  // Validar formato básico - mínimo 2 caracteres, máximo 8
  if (!normalized || normalized.length < 2 || normalized.length > 8) {
    return null; // Formato inválido
  }
  
  return normalized;
}

/**
 * Formata um registo normalizado para exibição
 * Adiciona o hífen no formato padrão (ex: D2EUA -> D2-EUA)
 */
export function formatAircraftRegistration(registration) {
  if (!registration) return '';
  
  const normalized = normalizeAircraftRegistration(registration);
  
  if (normalized === null) { // Handle case where normalizeAircraftRegistration returned null
    return String(registration); // Or handle error appropriately
  }

  // Detectar padrão comum: 2 letras + hífen + resto
  // Ex: D2-EUA, 9J-ABC, etc.
  if (normalized.length >= 3) {
    return `${normalized.substring(0, 2)}-${normalized.substring(2)}`;
  }
  
  return normalized;
}

/**
 * Normaliza o número de voo removendo espaços, traços e convertendo para maiúsculas
 * @param {string} flightNumber - Número do voo a ser normalizado
 * @returns {string} - Número do voo normalizado (ex: "DT-130" -> "DT130")
 */
export function normalizeFlightNumber(flightNumber) {
  if (!flightNumber) return '';
  
  // Remove espaços, hífens e converte para maiúsculas
  const normalized = String(flightNumber).trim().replace(/[\s-]/g, '').toUpperCase();
  
  return normalized;
}

/**
 * Cria um objeto Date completo a partir de uma data e hora, considerando cruzamento de meia-noite
 * @param {string} dataOperacao - Data no formato YYYY-MM-DD
 * @param {string} horario - Hora no formato HH:MM
 * @param {string} horarioReferencia - Horário de referência (opcional) para detectar cruzamento de meia-noite
 * @returns {Date|null} - Objeto Date completo ou null se inputs inválidos
 */
export function createDateTime(dataOperacao, horario, horarioReferencia = null) {
  if (!dataOperacao || !horario) return null;
  
  try {    
    // Criar datetime inicial
    let dateTime = parse(`${dataOperacao} ${horario}`, 'yyyy-MM-dd HH:mm', new Date());
    
    // Se houver horário de referência, verificar se houve cruzamento de meia-noite
    if (horarioReferencia) {
      const [horaRef, minRef] = horarioReferencia.split(':').map(Number);
      const [hora, min] = horario.split(':').map(Number);
      
      const minutosReferencia = horaRef * 60 + minRef;
      const minutosAtual = hora * 60 + min;
      
      // Se o horário atual é significativamente menor que a referência (ex: 00:15 vs 23:50)
      // E a diferença é maior que 12 horas (720 minutos), assume que cruzou a meia-noite
      const diferenca = minutosReferencia - minutosAtual;
      if (diferenca > 720) { // Mais de 12 horas de diferença
        dateTime = addDays(dateTime, 1);
      }
    }
    
    return dateTime;
  } catch (error) {
    console.error('Erro ao criar DateTime:', error);
    return null;
  }
}