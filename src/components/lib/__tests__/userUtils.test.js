import { describe, it, expect } from 'vitest';
import {
  isSuperAdmin,
  isEmpresaAdmin,
  hasUserProfile,
  hasAnyUserProfile,
  hasPageAccess,
  filtrarDadosPorAcesso,
  filtrarDadosPorEmpresa,
  filtrarDadosPorCriador,
  getAeroportosPermitidos,
  getEmpresaLogoByAeroporto,
  getEmpresaLogoByUser,
} from '../userUtils';

// ── Fixtures ──────────────────────────────────────────────────────────
const superAdmin = { role: 'admin', perfis: ['administrador'], empresa_id: null };
const empresaAdmin = { role: 'admin', perfis: ['administrador'], empresa_id: 'emp1' };
const normalUser = {
  role: 'user',
  perfis: ['operador'],
  empresa_id: 'emp1',
  aeroportos_acesso: ['FNLU', 'FNCB'],
};
const noProfileUser = { role: 'user', perfis: [], empresa_id: 'emp1' };

const aeroportos = [
  { id: 'a1', codigo_icao: 'FNLU', empresa_id: 'emp1' },
  { id: 'a2', codigo_icao: 'FNCB', empresa_id: 'emp1' },
  { id: 'a3', codigo_icao: 'FNHU', empresa_id: 'emp2' },
];

// ── isSuperAdmin ──────────────────────────────────────────────────────
describe('isSuperAdmin', () => {
  it('returns true for admin without empresa_id', () => {
    expect(isSuperAdmin(superAdmin)).toBe(true);
  });
  it('returns false for empresa admin', () => {
    expect(isSuperAdmin(empresaAdmin)).toBe(false);
  });
  it('returns false for null', () => {
    expect(isSuperAdmin(null)).toBe(false);
  });
  it('returns true for administrador profile without empresa_id', () => {
    expect(isSuperAdmin({ perfis: ['administrador'], empresa_id: null })).toBe(true);
  });
});

// ── isEmpresaAdmin ────────────────────────────────────────────────────
describe('isEmpresaAdmin', () => {
  it('returns true for admin with empresa_id', () => {
    expect(isEmpresaAdmin(empresaAdmin)).toBe(true);
  });
  it('returns false for superadmin (no empresa_id)', () => {
    expect(isEmpresaAdmin(superAdmin)).toBe(false);
  });
  it('returns false for normal user', () => {
    expect(isEmpresaAdmin(normalUser)).toBe(false);
  });
  it('returns false for null', () => {
    expect(isEmpresaAdmin(null)).toBe(false);
  });
});

// ── hasUserProfile ────────────────────────────────────────────────────
describe('hasUserProfile', () => {
  it('returns true when profile is present', () => {
    expect(hasUserProfile(normalUser, 'operador')).toBe(true);
  });
  it('returns false when profile is absent', () => {
    expect(hasUserProfile(normalUser, 'administrador')).toBe(false);
  });
  it('returns false for null user', () => {
    expect(hasUserProfile(null, 'operador')).toBe(false);
  });
  it('returns false for null profile', () => {
    expect(hasUserProfile(normalUser, null)).toBe(false);
  });
  it('returns false when perfis is not array', () => {
    expect(hasUserProfile({ perfis: 'operador' }, 'operador')).toBe(false);
  });
});

// ── hasAnyUserProfile ─────────────────────────────────────────────────
describe('hasAnyUserProfile', () => {
  it('returns true when at least one profile matches', () => {
    expect(hasAnyUserProfile(normalUser, ['administrador', 'operador'])).toBe(true);
  });
  it('returns false when none match', () => {
    expect(hasAnyUserProfile(normalUser, ['administrador', 'piloto'])).toBe(false);
  });
  it('returns false for null user', () => {
    expect(hasAnyUserProfile(null, ['operador'])).toBe(false);
  });
  it('returns false when profiles arg is not array', () => {
    expect(hasAnyUserProfile(normalUser, 'operador')).toBe(false);
  });
});

// ── hasPageAccess ─────────────────────────────────────────────────────
describe('hasPageAccess', () => {
  const permissions = {
    operador: ['Voos', 'Operacoes'],
    administrador: ['Voos', 'Operacoes', 'GestaoEmpresas'],
  };

  it('admin role has access to everything', () => {
    expect(hasPageAccess({ role: 'admin', perfis: [] }, 'GestaoEmpresas', permissions)).toBe(true);
  });
  it('profile-based access granted', () => {
    expect(hasPageAccess(normalUser, 'Voos', permissions)).toBe(true);
  });
  it('profile-based access denied', () => {
    expect(hasPageAccess(normalUser, 'GestaoEmpresas', permissions)).toBe(false);
  });
  it('returns false for null user', () => {
    expect(hasPageAccess(null, 'Voos', permissions)).toBe(false);
  });
});

// ── getAeroportosPermitidos ───────────────────────────────────────────
describe('getAeroportosPermitidos', () => {
  it('superadmin sees all airports', () => {
    expect(getAeroportosPermitidos(superAdmin, aeroportos)).toHaveLength(3);
  });
  it('superadmin with effectiveEmpresaId sees only that empresa airports', () => {
    expect(getAeroportosPermitidos(superAdmin, aeroportos, 'emp1')).toHaveLength(2);
  });
  it('empresa admin sees all empresa airports', () => {
    expect(getAeroportosPermitidos(empresaAdmin, aeroportos)).toHaveLength(2);
  });
  it('normal user sees only allowed airports within empresa', () => {
    const result = getAeroportosPermitidos(normalUser, aeroportos);
    expect(result).toHaveLength(2);
    expect(result.map(a => a.codigo_icao)).toEqual(['FNLU', 'FNCB']);
  });
  it('user with no aeroportos_acesso returns empty', () => {
    expect(getAeroportosPermitidos(noProfileUser, aeroportos)).toHaveLength(0);
  });
  it('returns empty for null user', () => {
    expect(getAeroportosPermitidos(null, aeroportos)).toHaveLength(0);
  });
});

// ── filtrarDadosPorAcesso ─────────────────────────────────────────────
describe('filtrarDadosPorAcesso', () => {
  const dados = [
    { id: 1, aeroporto: 'FNLU' },
    { id: 2, aeroporto: 'FNCB' },
    { id: 3, aeroporto: 'FNHU' },
  ];

  it('superadmin sees all data', () => {
    expect(filtrarDadosPorAcesso(superAdmin, dados, 'aeroporto', aeroportos)).toHaveLength(3);
  });
  it('superadmin with effectiveEmpresaId sees empresa data', () => {
    expect(filtrarDadosPorAcesso(superAdmin, dados, 'aeroporto', aeroportos, 'emp1')).toHaveLength(2);
  });
  it('normal user sees only permitted data', () => {
    expect(filtrarDadosPorAcesso(normalUser, dados, 'aeroporto', aeroportos)).toHaveLength(2);
  });
  it('returns empty for null user', () => {
    expect(filtrarDadosPorAcesso(null, dados, 'aeroporto', aeroportos)).toHaveLength(0);
  });
});

// ── filtrarDadosPorEmpresa ────────────────────────────────────────────
describe('filtrarDadosPorEmpresa', () => {
  const dados = [
    { id: 1, aeroporto: 'FNLU' },
    { id: 2, aeroporto: 'FNHU' },
  ];

  it('filters by empresa airports', () => {
    expect(filtrarDadosPorEmpresa(dados, 'aeroporto', aeroportos, 'emp1')).toHaveLength(1);
  });
  it('returns all data when empresaId is null', () => {
    expect(filtrarDadosPorEmpresa(dados, 'aeroporto', aeroportos, null)).toEqual(dados);
  });
});

// ── filtrarDadosPorCriador ────────────────────────────────────────────
describe('filtrarDadosPorCriador', () => {
  const dados = [
    { id: 1, created_by: 'user@emp1.com' },
    { id: 2, created_by: 'other@emp2.com' },
    { id: 3, created_by: null },
  ];

  it('filters by email set', () => {
    const emails = new Set(['user@emp1.com']);
    expect(filtrarDadosPorCriador(dados, emails)).toHaveLength(1);
  });
  it('returns all when emailsEmpresa is null', () => {
    expect(filtrarDadosPorCriador(dados, null)).toHaveLength(3);
  });
  it('handles null dados', () => {
    expect(filtrarDadosPorCriador(null, new Set())).toHaveLength(0);
  });
});

// ── getEmpresaLogoByAeroporto ─────────────────────────────────────────
describe('getEmpresaLogoByAeroporto', () => {
  const empresas = [
    { id: 'emp1', logo_url: 'https://cdn.example.com/logo1.png' },
    { id: 'emp2', logo_url: null },
  ];

  it('returns empresa logo for known airport', () => {
    expect(getEmpresaLogoByAeroporto('FNLU', aeroportos, empresas)).toBe('https://cdn.example.com/logo1.png');
  });
  it('returns default logo when empresa has no logo', () => {
    expect(getEmpresaLogoByAeroporto('FNHU', aeroportos, empresas)).toBe('/logo-dirops.png');
  });
  it('returns default logo for unknown airport', () => {
    expect(getEmpresaLogoByAeroporto('XXXX', aeroportos, empresas)).toBe('/logo-dirops.png');
  });
  it('returns default for null input', () => {
    expect(getEmpresaLogoByAeroporto(null, aeroportos, empresas)).toBe('/logo-dirops.png');
  });
});

// ── getEmpresaLogoByUser ──────────────────────────────────────────────
describe('getEmpresaLogoByUser', () => {
  const empresas = [{ id: 'emp1', logo_url: 'https://cdn.example.com/logo1.png' }];

  it('returns logo for user with empresa', () => {
    expect(getEmpresaLogoByUser(empresaAdmin, empresas)).toBe('https://cdn.example.com/logo1.png');
  });
  it('returns default for superadmin (no empresa)', () => {
    expect(getEmpresaLogoByUser(superAdmin, empresas)).toBe('/logo-dirops.png');
  });
  it('returns default for null user', () => {
    expect(getEmpresaLogoByUser(null, empresas)).toBe('/logo-dirops.png');
  });
});
