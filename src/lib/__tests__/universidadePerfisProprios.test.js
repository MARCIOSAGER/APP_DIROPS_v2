import { describe, it, expect, afterEach } from 'vitest';
import {
  PERFIS_UNIVERSIDADE, PERFIL_UC_LABEL, PERFIS_PORTAL, registarPerfisPersonalizadosUc, perfisPersonalizadosUc,
  perfisPortal, paginasPermitidas, ehPerfilUniversidade, slugPerfilUc, nivelDoPerfilUc, perfisUcTexto, ehNomePerfilUc,
  paginasPadraoUc, perfisEscolhidosUc, contarComPerfil, ehInstrutorUc, PERMISSOES_PADRAO, podeGerirFormacaoUc,
} from '../universidade.js';

const utilizador = (perfis, extra = {}) => ({ email: 'a@sga.co.ao', perfis, status: 'ativo', role: 'user', ...extra });
const COORD = { perfil: 'uc_coord_fnlu', label: 'Coordenação FNLU', cor: '#1d4ed8', descricao: null, nivel: 'instrutor', personalizado: true, paginas: ['formacao', 'gestao', 'gestao_cursos'] };
const VISIT = { perfil: 'uc_visitante', label: 'Formando externo', cor: '#0f766e', descricao: 'Só cursos', nivel: 'formando', personalizado: true, paginas: ['formacao', 'gestao_relatorios'] };

afterEach(() => registarPerfisPersonalizadosUc([]));

describe('perfis próprios da Universidade (migração 188)', () => {
  it('registar acrescenta aos perfis da Universidade e limpa os anteriores', () => {
    registarPerfisPersonalizadosUc([COORD, { perfil: 'formando', paginas: [] }, { perfil: 'instrutor', nivel: 'instrutor', personalizado: false }]);
    expect(PERFIS_UNIVERSIDADE).toEqual(['formando', 'instrutor', 'admin_universidade', 'uc_coord_fnlu']);
    expect(PERFIL_UC_LABEL.uc_coord_fnlu).toBe('Coordenação FNLU');
    registarPerfisPersonalizadosUc([VISIT]);
    expect(PERFIS_UNIVERSIDADE).not.toContain('uc_coord_fnlu');
    expect(PERFIL_UC_LABEL.uc_coord_fnlu).toBeUndefined();
    expect(PERFIL_UC_LABEL.formando).toBe('Formando');
    registarPerfisPersonalizadosUc([]);
    expect(PERFIS_UNIVERSIDADE).toEqual(['formando', 'instrutor', 'admin_universidade']);
  });

  it('a matriz põe os perfis próprios entre o instrutor e o administrador', () => {
    registarPerfisPersonalizadosUc([COORD, VISIT]);
    expect(PERFIS_PORTAL.map(p => p.chave)).toEqual(['formando', 'instrutor', 'uc_coord_fnlu', 'uc_visitante', 'administrador']);
    expect(PERFIS_PORTAL.find(p => p.chave === 'uc_coord_fnlu')).toMatchObject({ personalizado: true, nivel: 'instrutor', cor: '#1d4ed8' });
    expect(PERFIS_PORTAL.find(p => p.chave === 'uc_coord_fnlu').descricao).toMatch(/nível instrutor/);
    expect(PERFIS_PORTAL.find(p => p.chave === 'uc_visitante').descricao).toBe('Só cursos');
  });

  it('ignora linhas inválidas: nome sem uc_, nível admin, sem nome; cor inválida fica nula', () => {
    registarPerfisPersonalizadosUc([
      { ...COORD, perfil: 'doc_coord' }, { ...COORD, perfil: 'uc_admin_x', nivel: 'admin' }, { ...COORD, perfil: 'uc_sem_nome', label: '  ' },
      { ...VISIT, cor: 'red;background:url(x)' },
    ]);
    expect(perfisPersonalizadosUc().map(p => p.perfil)).toEqual(['uc_visitante']);
    expect(perfisPersonalizadosUc()[0].cor).toBeNull();
  });

  it('nome técnico a partir do nome visível', () => {
    expect(slugPerfilUc('Coordenação FNLU')).toBe('uc_coordenacao_fnlu');
    expect(slugPerfilUc('  Formando — externo (ANAC) ')).toBe('uc_formando_externo_anac');
    expect(ehNomePerfilUc(slugPerfilUc('Coordenação FNLU'))).toBe(true);
    expect(ehNomePerfilUc(slugPerfilUc(''))).toBe(false);
    const longo = slugPerfilUc('a'.repeat(80));
    expect(ehNomePerfilUc(longo)).toBe(true);
    expect(longo.length).toBe(43);
    expect(ehNomePerfilUc(slugPerfilUc('x'.repeat(39) + ' y'))).toBe(true); // sem _ no fim depois de cortar
  });

  it('nível de cada perfil', () => {
    registarPerfisPersonalizadosUc([COORD, VISIT]);
    expect(nivelDoPerfilUc('formando')).toBe('formando');
    expect(nivelDoPerfilUc('instrutor')).toBe('instrutor');
    expect(nivelDoPerfilUc('admin_universidade')).toBe('admin');
    expect(nivelDoPerfilUc('uc_coord_fnlu')).toBe('instrutor');
    expect(nivelDoPerfilUc('uc_visitante')).toBe('formando');
    expect(nivelDoPerfilUc('uc_desconhecido')).toBeNull();
    expect(nivelDoPerfilUc('operacoes')).toBeNull();
    expect(paginasPadraoUc('uc_coord_fnlu')).toEqual(PERMISSOES_PADRAO.instrutor);
    expect(paginasPadraoUc('uc_visitante')).toEqual(PERMISSOES_PADRAO.formando);
  });

  it('perfil de nível instrutor dá gestão como o instrutor; nível formando não', () => {
    registarPerfisPersonalizadosUc([COORD, VISIT]);
    expect(perfisPortal(utilizador(['uc_coord_fnlu'])).instrutor).toBe(true);
    expect(ehInstrutorUc(utilizador(['uc_coord_fnlu']))).toBe(true);
    expect(perfisPortal(utilizador(['uc_visitante'])).instrutor).toBe(false);
    expect(perfisPortal(utilizador(['uc_coord_fnlu'])).admin).toBe(false);
    expect(perfisPortal(utilizador(['uc_coord_fnlu'])).proprios).toEqual(['uc_coord_fnlu']);
  });

  it('um uc_… ainda por carregar não dá gestão (o servidor e a base de dados decidem na mesma)', () => {
    expect(perfisPortal(utilizador(['uc_coord_fnlu'])).instrutor).toBe(false);
    expect(ehPerfilUniversidade('uc_coord_fnlu')).toBe(true);
    expect(ehPerfilUniversidade('operacoes')).toBe(false);
  });

  it('páginas: só perfis próprios → só as páginas desses perfis; com formando soma', () => {
    registarPerfisPersonalizadosUc([COORD, VISIT]);
    const perms = { formando: ['formacao', 'sessoes', 'ranking', 'ajuda'], uc_visitante: ['formacao'], uc_coord_fnlu: ['formacao', 'gestao', 'gestao_cursos'] };
    const soVisit = paginasPermitidas(utilizador(['uc_visitante']), perms);
    expect([...soVisit].sort()).toEqual(['conta', 'formacao', 'inicio']);
    const visitFormando = paginasPermitidas(utilizador(['formando', 'uc_visitante']), perms);
    expect(visitFormando.has('ranking')).toBe(true);
    const comDiroPS = paginasPermitidas(utilizador(['operacoes', 'uc_visitante']), perms); // perfis do DIROPS não contam
    expect(comDiroPS.has('ranking')).toBe(false);
    const coord = paginasPermitidas(utilizador(['uc_coord_fnlu']), perms);
    expect(coord.has('gestao_cursos')).toBe(true);
    expect(coord.has('gestao_configuracoes')).toBe(false);
    expect(coord.has('sessoes')).toBe(false);
  });

  it('páginas de gestão nunca valem num perfil de nível formando', () => {
    registarPerfisPersonalizadosUc([VISIT]);
    const s = paginasPermitidas(utilizador(['uc_visitante']), { uc_visitante: ['formacao', 'gestao_relatorios'] });
    expect(s.has('gestao_relatorios')).toBe(false);
    expect(s.has('formacao')).toBe(true);
  });

  it('sem permissões gravadas, o perfil próprio usa as páginas do nível base', () => {
    registarPerfisPersonalizadosUc([COORD]);
    const s = paginasPermitidas(utilizador(['uc_coord_fnlu']), {});
    for (const k of PERMISSOES_PADRAO.instrutor) expect(s.has(k)).toBe(true);
  });

  it('comportamento antigo intacto (sem perfis próprios)', () => {
    expect(paginasPermitidas(utilizador(['operacoes']), null).has('formacao')).toBe(true);
    expect(paginasPermitidas(utilizador(['instrutor']), null).has('gestao_cursos')).toBe(true);
    expect(paginasPermitidas(utilizador(['instrutor']), null).has('ranking')).toBe(true);
    expect(paginasPermitidas(utilizador(['admin_universidade']), null).has('gestao_configuracoes')).toBe(true);
  });

  it('texto dos perfis inclui os próprios', () => {
    registarPerfisPersonalizadosUc([COORD]);
    expect(perfisUcTexto(['operacoes', 'formando', 'uc_coord_fnlu'])).toBe('Formando, Coordenação FNLU');
  });

  it('perfis de um convite', () => {
    expect(perfisEscolhidosUc({})).toEqual(['formando']);
    expect(perfisEscolhidosUc({ instrutor: true })).toEqual(['formando', 'instrutor']);
    expect(perfisEscolhidosUc({ proprio: 'uc_visitante', formando: false })).toEqual(['uc_visitante']);
    expect(perfisEscolhidosUc({ proprio: 'uc_visitante', formando: true })).toEqual(['formando', 'uc_visitante']);
    expect(perfisEscolhidosUc({ proprio: 'doc_x', formando: false })).toEqual(['formando']); // nome inválido ignorado
    expect(perfisEscolhidosUc({ formando: false })).toEqual(['formando']);                  // sem perfil próprio, formando vai sempre
  });

  it('conta quantas pessoas têm um perfil', () => {
    const us = [utilizador(['uc_visitante']), utilizador(['formando', 'uc_visitante']), utilizador(['formando']), { email: 'x' }];
    expect(contarComPerfil(us, 'uc_visitante')).toBe(2);
    expect(contarComPerfil(null, 'uc_visitante')).toBe(0);
  });
});

describe('podeGerirFormacaoUc (= pode_gerir_formacao() na base de dados)', () => {
  it('aceita administradores, admin_universidade, instrutor e perfil próprio de nível instrutor', () => {
    registarPerfisPersonalizadosUc([COORD, VISIT]);
    expect(podeGerirFormacaoUc(utilizador(['admin_universidade']))).toBe(true);
    expect(podeGerirFormacaoUc(utilizador(['administrador']))).toBe(true);
    expect(podeGerirFormacaoUc(utilizador([], { role: 'admin' }))).toBe(true);
    expect(podeGerirFormacaoUc(utilizador(['instrutor']))).toBe(true);
    expect(podeGerirFormacaoUc(utilizador(['uc_coord_fnlu']))).toBe(true);
  });
  it('recusa formando, perfil próprio de nível formando, perfis do DIROPS e sem utilizador', () => {
    registarPerfisPersonalizadosUc([COORD, VISIT]);
    expect(podeGerirFormacaoUc(utilizador(['formando']))).toBe(false);
    expect(podeGerirFormacaoUc(utilizador(['uc_visitante']))).toBe(false);
    expect(podeGerirFormacaoUc(utilizador(['operacoes']))).toBe(false);
    expect(podeGerirFormacaoUc(null)).toBe(false);
  });
  it('perfil próprio ainda por carregar não dá gestão', () => {
    expect(podeGerirFormacaoUc(utilizador(['uc_coord_fnlu']))).toBe(false);
  });
});
