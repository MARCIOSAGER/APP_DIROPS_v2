// Função utilitária para verificar perfis de utilizador de forma segura
export function hasUserProfile(user, profileToCheck) {
  // Verificação mais robusta e defensiva
  if (!user || !user.perfis || !Array.isArray(user.perfis)) {
    return false;
  }
  
  if (!profileToCheck) {
    return false;
  }
  
  // Verificar se o perfil específico existe na lista
  return user.perfis.includes(profileToCheck);
}

// Função para verificar se o utilizador tem algum dos perfis especificados
export function hasAnyUserProfile(user, profiles) {
  if (!user || !user.perfis || !Array.isArray(user.perfis) || !Array.isArray(profiles)) {
    return false;
  }
  
  return profiles.some(profile => user.perfis.includes(profile));
}

// Função para verificar se o utilizador tem permissão para aceder a uma página
export function hasPageAccess(user, pageKey, permissions) {
  // Garantir que o utilizador e os perfis existem e são um array antes de continuar
  if (!user || !user.perfis || !Array.isArray(user.perfis)) {
    return false;
  }
  
  if (user.role === 'admin') {
    return true; // Admin tem acesso a tudo
  }
  
  // Verificar se algum dos perfis do utilizador tem acesso à página
  return user.perfis.some(perfil => {
    const allowedPages = permissions[perfil] || [];
    return Array.isArray(allowedPages) && allowedPages.includes(pageKey);
  });
}

// Função para obter o primeiro perfil válido do utilizador
export function getPrimaryUserProfile(user) {
  if (!user || !user.perfis || !Array.isArray(user.perfis) || user.perfis.length === 0) {
    return null;
  }
  
  return user.perfis[0];
}

// Função para verificar se os perfis do utilizador foram carregados
export function areUserProfilesLoaded(user) {
  return user && user.perfis && Array.isArray(user.perfis) && user.perfis.length > 0;
}

// Função para inicializar perfis de utilizador se não existirem
export function ensureUserProfilesExist(user) {
  // Se o utilizador for nulo ou indefinido, retornar imediatamente
  if (!user) return user;

  // Se perfis não existe ou não é um array, inicializar como array vazio
  if (!user.perfis || !Array.isArray(user.perfis)) {
    user.perfis = [];
  }

  return user;
}

// Verifica se o utilizador é superadmin (sem empresa_id = vê tudo)
export function isSuperAdmin(user) {
  if (!user) return false;
  return !user.empresa_id && (user.role === 'admin' || hasUserProfile(user, 'administrador'));
}

// Verifica se o utilizador é admin da sua empresa
export function isEmpresaAdmin(user) {
  if (!user) return false;
  return !!user.empresa_id && (user.role === 'admin' || hasUserProfile(user, 'administrador'));
}

// Filtra aeroportos com base na empresa e permissões do utilizador
// Retorna os aeroportos que o utilizador pode ver
export function getAeroportosPermitidos(user, todosAeroportos) {
  if (!user || !todosAeroportos) return [];

  // Superadmin (sem empresa_id + admin) → vê tudo
  if (isSuperAdmin(user)) {
    return todosAeroportos;
  }

  // Filtrar primeiro por empresa (se o utilizador tem empresa_id)
  let aeroportosEmpresa = todosAeroportos;
  if (user.empresa_id) {
    aeroportosEmpresa = todosAeroportos.filter(a => a.empresa_id === user.empresa_id);
  }

  // Admin da empresa → vê todos os aeroportos da empresa
  if (isEmpresaAdmin(user)) {
    return aeroportosEmpresa;
  }

  // Utilizador normal → filtrar por aeroportos_acesso dentro da empresa
  if (user.aeroportos_acesso && Array.isArray(user.aeroportos_acesso) && user.aeroportos_acesso.length > 0) {
    const userIcaoCodes = new Set(user.aeroportos_acesso.map(code => code.trim().toUpperCase()));
    return aeroportosEmpresa.filter(a => userIcaoCodes.has(a.codigo_icao?.trim().toUpperCase()));
  }

  return [];
}

// Filtra dados operacionais por aeroporto do utilizador
// campo = nome do campo que contém o ICAO do aeroporto no registo (ex: 'aeroporto_operacao', 'aeroporto')
export function filtrarDadosPorAcesso(user, dados, campo, todosAeroportos) {
  if (!user || !dados) return [];

  // Superadmin → vê tudo
  if (isSuperAdmin(user)) {
    return dados;
  }

  const aeroportosPermitidos = getAeroportosPermitidos(user, todosAeroportos);
  const icaosPermitidos = new Set(aeroportosPermitidos.map(a => a.codigo_icao?.trim().toUpperCase()));

  return dados.filter(item => icaosPermitidos.has(item[campo]?.trim().toUpperCase()));
}

// Filtra dados por ID do aeroporto (para entidades que usam aeroporto_id em vez de ICAO)
export function filtrarDadosPorAeroportoId(user, dados, campo, todosAeroportos) {
  if (!user || !dados) return [];

  // Superadmin → vê tudo
  if (isSuperAdmin(user)) {
    return dados;
  }

  const aeroportosPermitidos = getAeroportosPermitidos(user, todosAeroportos);
  const idsPermitidos = new Set(aeroportosPermitidos.map(a => a.id));

  return dados.filter(item => idsPermitidos.has(item[campo]));
}

// Obter logo URL da empresa de um aeroporto (para relatórios/PDFs)
// Recebe a lista de empresas e aeroportos já carregados, e o código ICAO ou ID do aeroporto
// Retorna a URL do logo da empresa ou o fallback DIROPS
const DEFAULT_LOGO_URL = '/logo-dirops.svg';

export function getEmpresaLogoByAeroporto(aeroportoIcaoOrId, aeroportos, empresas) {
  if (!aeroportoIcaoOrId || !aeroportos || !empresas) return DEFAULT_LOGO_URL;

  const aeroporto = aeroportos.find(a =>
    a.id === aeroportoIcaoOrId ||
    a.codigo_icao?.toUpperCase() === String(aeroportoIcaoOrId).toUpperCase()
  );

  if (!aeroporto?.empresa_id) return DEFAULT_LOGO_URL;

  const empresa = empresas.find(e => e.id === aeroporto.empresa_id);
  return empresa?.logo_url || DEFAULT_LOGO_URL;
}

// Obter logo URL da empresa do utilizador (para relatórios genéricos)
export function getEmpresaLogoByUser(user, empresas) {
  if (!user?.empresa_id || !empresas) return DEFAULT_LOGO_URL;
  const empresa = empresas.find(e => e.id === user.empresa_id);
  return empresa?.logo_url || DEFAULT_LOGO_URL;
}