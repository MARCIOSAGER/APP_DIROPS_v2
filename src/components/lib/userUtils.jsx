function hasPerfis(user) {
  return user && Array.isArray(user.perfis);
}

export function hasUserProfile(user, profileToCheck) {
  if (!hasPerfis(user) || !profileToCheck) return false;
  return user.perfis.includes(profileToCheck);
}

export function hasAnyUserProfile(user, profiles) {
  if (!hasPerfis(user) || !Array.isArray(profiles)) return false;
  return profiles.some(profile => user.perfis.includes(profile));
}

export function hasPageAccess(user, pageKey, permissions) {
  if (!hasPerfis(user)) return false;
  if (user.role === 'admin') return true;
  return user.perfis.some(perfil => {
    const allowedPages = permissions[perfil] || [];
    return Array.isArray(allowedPages) && allowedPages.includes(pageKey);
  });
}

export function getPrimaryUserProfile(user) {
  if (!hasPerfis(user) || user.perfis.length === 0) return null;
  return user.perfis[0];
}

export function areUserProfilesLoaded(user) {
  return hasPerfis(user) && user.perfis.length > 0;
}

export function ensureUserProfilesExist(user) {
  if (!user) return user;
  if (!Array.isArray(user.perfis)) user.perfis = [];
  return user;
}

export function isSuperAdmin(user) {
  if (!user) return false;
  return !user.empresa_id && (user.role === 'admin' || hasUserProfile(user, 'administrador'));
}

export function isEmpresaAdmin(user) {
  if (!user) return false;
  return !!user.empresa_id && (user.role === 'admin' || hasUserProfile(user, 'administrador'));
}

export function getAeroportosPermitidos(user, todosAeroportos, effectiveEmpresaId) {
  if (!user || !todosAeroportos) return [];

  // Superadmin (sem empresa_id + admin)
  if (isSuperAdmin(user)) {
    // Se tem uma empresa selecionada, filtrar por essa empresa
    if (effectiveEmpresaId) {
      return todosAeroportos.filter(a => a.empresa_id === effectiveEmpresaId);
    }
    // Sem empresa selecionada → vê tudo
    return todosAeroportos;
  }

  // Filtrar primeiro por empresa (se o utilizador tem empresa_id)
  let aeroportosEmpresa = todosAeroportos;
  if (user.empresa_id) {
    aeroportosEmpresa = todosAeroportos.filter(a => a.empresa_id === user.empresa_id);
  }

  const hasAcessoList = Array.isArray(user.aeroportos_acesso) && user.aeroportos_acesso.length > 0;

  if (isEmpresaAdmin(user)) {
    if (!hasAcessoList) return aeroportosEmpresa;
    const icaoCodes = new Set(user.aeroportos_acesso.map(code => code.trim().toUpperCase()));
    return aeroportosEmpresa.filter(a => icaoCodes.has(a.codigo_icao?.trim().toUpperCase()));
  }

  if (!hasAcessoList) return [];
  const icaoCodes = new Set(user.aeroportos_acesso.map(code => code.trim().toUpperCase()));
  return aeroportosEmpresa.filter(a => icaoCodes.has(a.codigo_icao?.trim().toUpperCase()));
}

export function filtrarDadosPorAcesso(user, dados, campo, todosAeroportos, effectiveEmpresaId) {
  if (!user || !dados) return [];

  // Superadmin com empresa selecionada → filtrar por empresa
  if (isSuperAdmin(user) && effectiveEmpresaId) {
    const aeroportosEmpresa = todosAeroportos.filter(a => a.empresa_id === effectiveEmpresaId);
    const icaosEmpresa = new Set(aeroportosEmpresa.map(a => a.codigo_icao?.trim().toUpperCase()));
    const idsEmpresa = new Set(aeroportosEmpresa.map(a => a.id));
    return dados.filter(item => {
      const val = item[campo]?.trim();
      return icaosEmpresa.has(val?.toUpperCase()) || idsEmpresa.has(val);
    });
  }

  // Superadmin sem empresa selecionada → vê tudo
  if (isSuperAdmin(user)) {
    return dados;
  }

  const aeroportosPermitidos = getAeroportosPermitidos(user, todosAeroportos);
  const icaosPermitidos = new Set(aeroportosPermitidos.map(a => a.codigo_icao?.trim().toUpperCase()));
  const idsPermitidos = new Set(aeroportosPermitidos.map(a => a.id));

  return dados.filter(item => {
    const val = item[campo]?.trim();
    return icaosPermitidos.has(val?.toUpperCase()) || idsPermitidos.has(val);
  });
}

export function filtrarDadosPorAeroportoId(user, dados, campo, todosAeroportos, effectiveEmpresaId) {
  if (!user || !dados) return [];

  // Superadmin com empresa selecionada → filtrar por empresa
  if (isSuperAdmin(user) && effectiveEmpresaId) {
    const aeroportosEmpresa = todosAeroportos.filter(a => a.empresa_id === effectiveEmpresaId);
    const idsEmpresa = new Set(aeroportosEmpresa.map(a => a.id));
    return dados.filter(item => idsEmpresa.has(item[campo]));
  }

  // Superadmin sem empresa selecionada → vê tudo
  if (isSuperAdmin(user)) {
    return dados;
  }

  const aeroportosPermitidos = getAeroportosPermitidos(user, todosAeroportos);
  const idsPermitidos = new Set(aeroportosPermitidos.map(a => a.id));

  return dados.filter(item => idsPermitidos.has(item[campo]));
}

export function filtrarDadosPorEmpresa(dados, campo, todosAeroportos, empresaId) {
  if (!empresaId || !dados || !todosAeroportos) return dados || [];
  const aeroportosEmpresa = todosAeroportos.filter(a => a.empresa_id === empresaId);
  const icaosEmpresa = new Set(aeroportosEmpresa.map(a => a.codigo_icao?.trim().toUpperCase()));
  return dados.filter(item => icaosEmpresa.has(item[campo]?.trim().toUpperCase()));
}

export function getEmailsEmpresa(todosUsers, empresaId) {
  if (!empresaId || !todosUsers) return null;
  return new Set(
    todosUsers
      .filter(u => u.empresa_id === empresaId)
      .map(u => u.email?.toLowerCase())
      .filter(Boolean)
  );
}

export function filtrarDadosPorCriador(dados, emailsEmpresa) {
  if (!emailsEmpresa) return dados || [];
  return (dados || []).filter(item => {
    if (!item.created_by) return false;
    return emailsEmpresa.has(item.created_by.toLowerCase());
  });
}

const DEFAULT_LOGO_URL = '/logo-dirops.png';

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

export function getEmpresaLogoByUser(user, empresas) {
  if (!user?.empresa_id || !empresas) return DEFAULT_LOGO_URL;
  const empresa = empresas.find(e => e.id === user.empresa_id);
  return empresa?.logo_url || DEFAULT_LOGO_URL;
}

export function isAdminProfile(user) {
  if (!user) return false;
  return user.role === 'admin' || hasUserProfile(user, 'administrador');
}

export function isInfraOrAdmin(user) {
  if (!user) return false;
  return hasAnyUserProfile(user, ['administrador', 'infraestrutura']);
}