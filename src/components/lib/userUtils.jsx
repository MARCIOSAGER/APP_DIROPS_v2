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