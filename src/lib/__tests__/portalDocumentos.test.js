import { describe, it, expect } from 'vitest';
import {
  PORTAL_BASE, PERFIS_DOCUMENTOS, PERFIL_DOC_LABEL, perfisDocTexto, ehPerfilDocumentos,
  contaGlobal, perfisPortal, ehAdminPortal, ehGestorDocs, ehEditorDocs,
  PAGINAS_PORTAL, PERMISSOES_PADRAO, paginasPermitidas, podeVerPagina,
  ESTADO_LABEL, estadoPublicado, diasParaExpirar, estadoValidade, destinoSeguro, iniciais, primeiroNome,
} from '../portalDocumentos.js';

const utilizador = (perfis, extra = {}) => ({ email: 'a@sga.co.ao', perfis, status: 'ativo', ...extra });

describe('perfis do portal de documentos', () => {
  it('os quatro perfis têm nome em português e são reconhecidos', () => {
    expect(PERFIS_DOCUMENTOS).toHaveLength(4);
    for (const p of PERFIS_DOCUMENTOS) {
      expect(ehPerfilDocumentos(p)).toBe(true);
      expect(PERFIL_DOC_LABEL[p]).toBeTruthy();
    }
    expect(ehPerfilDocumentos('operacoes')).toBe(false);
    expect(perfisDocTexto(['leitor_documentos', 'operacoes', 'gestor_documentos'])).toBe('Leitor de documentos, Gestor de documentos');
  });

  it('os níveis encaixam uns nos outros: administrador ⊃ gestor ⊃ editor ⊃ leitor', () => {
    expect(perfisPortal(utilizador(['leitor_documentos']))).toMatchObject({ admin: false, gestor: false, editor: false, membro: true });
    expect(perfisPortal(utilizador(['editor_documentos']))).toMatchObject({ admin: false, gestor: false, editor: true, membro: true });
    expect(perfisPortal(utilizador(['gestor_documentos']))).toMatchObject({ admin: false, gestor: true, editor: true, membro: true });
    expect(perfisPortal(utilizador(['admin_documentos']))).toMatchObject({ admin: true, gestor: true, editor: true, membro: true });
  });

  it('a conta global do dono vê tudo mesmo sem perfis do portal', () => {
    const dono = utilizador([], { role: 'admin' });
    expect(contaGlobal(dono)).toBe(true);
    expect(ehAdminPortal(dono)).toBe(true);
    expect(ehGestorDocs(dono)).toBe(true);
    expect(ehEditorDocs(dono)).toBe(true);
  });

  it('quem não tem nada do portal não é membro', () => {
    expect(perfisPortal(utilizador(['operacoes', 'formando'])).membro).toBe(false);
    expect(perfisPortal(null).membro).toBe(false);
  });
});

describe('páginas visíveis por perfil', () => {
  it('o leitor vê a consulta e não vê a gestão', () => {
    const paginas = paginasPermitidas(utilizador(['leitor_documentos']), null);
    expect(paginas.has('biblioteca')).toBe(true);
    expect(paginas.has('pesquisa')).toBe(true);
    expect(paginas.has('gestao_acessos')).toBe(false);
    expect(paginas.has('gestao_configuracoes')).toBe(false);
  });

  it('o gestor vê a gestão toda menos as configurações', () => {
    const paginas = paginasPermitidas(utilizador(['gestor_documentos']), null);
    expect(paginas.has('gestao_documentos')).toBe(true);
    expect(paginas.has('gestao_acessos')).toBe(true);
    expect(paginas.has('gestao_configuracoes')).toBe(false);
  });

  it('o administrador vê todas as páginas, mesmo com a tabela afinada a menos', () => {
    const paginas = paginasPermitidas(utilizador(['admin_documentos']), { admin_documentos: ['inicio'] });
    for (const p of PAGINAS_PORTAL) expect(paginas.has(p.chave)).toBe(true);
  });

  it('a tabela afinada na gestão manda sobre as predefinições', () => {
    const afinada = { leitor_documentos: ['inicio', 'biblioteca'] };
    const paginas = paginasPermitidas(utilizador(['leitor_documentos']), afinada);
    expect(paginas.has('biblioteca')).toBe(true);
    expect(paginas.has('pesquisa')).toBe(false);
    expect(podeVerPagina(utilizador(['leitor_documentos']), afinada, 'pesquisa')).toBe(false);
  });

  it('o início e a conta estão sempre disponíveis', () => {
    const paginas = paginasPermitidas(utilizador(['leitor_documentos']), { leitor_documentos: [] });
    expect(paginas.has('inicio')).toBe(true);
    expect(paginas.has('conta')).toBe(true);
  });

  it('as predefinições só usam chaves de páginas que existem', () => {
    const chaves = new Set(PAGINAS_PORTAL.map(p => p.chave));
    for (const lista of Object.values(PERMISSOES_PADRAO)) for (const c of lista) expect(chaves.has(c)).toBe(true);
  });
});

describe('estado e validade do documento', () => {
  it('só «em vigor» conta como publicado', () => {
    expect(estadoPublicado('em_vigor')).toBe(true);
    expect(estadoPublicado('rascunho')).toBe(false);
    expect(estadoPublicado(null)).toBe(true); // documentos antigos, sem estado, estão em vigor
    expect(ESTADO_LABEL.em_revisao).toBe('Em revisão');
  });

  it('conta os dias que faltam e classifica a validade', () => {
    const hoje = new Date('2026-10-02T00:00:00Z');
    expect(diasParaExpirar({ expira_em: null }, hoje)).toBe(null);
    expect(diasParaExpirar({ expira_em: '2026-10-12T00:00:00Z' }, hoje)).toBe(10);
    expect(estadoValidade({ expira_em: '2026-09-30T00:00:00Z' }, hoje).chave).toBe('expirado');
    expect(estadoValidade({ expira_em: '2026-10-20T00:00:00Z' }, hoje).chave).toBe('expira_30');
    expect(estadoValidade({ expira_em: '2026-11-20T00:00:00Z' }, hoje).chave).toBe('expira_90');
    expect(estadoValidade({ expira_em: '2027-06-01T00:00:00Z' }, hoje).chave).toBe('valido');
    expect(estadoValidade({}, hoje).chave).toBe('sem_validade');
  });

  it('aceita a coluna antiga data_expiracao', () => {
    const hoje = new Date('2026-10-02T00:00:00Z');
    expect(diasParaExpirar({ data_expiracao: '2026-10-09T00:00:00Z' }, hoje)).toBe(7);
  });

  it('data inválida não rebenta', () => {
    expect(diasParaExpirar({ expira_em: 'nao-e-data' })).toBe(null);
  });
});

describe('navegação e nomes', () => {
  it('só aceita destinos dentro do portal depois do login', () => {
    expect(destinoSeguro('/documentos/biblioteca')).toBe('/documentos/biblioteca');
    expect(destinoSeguro('//evil.example')).toBe(PORTAL_BASE);
    expect(destinoSeguro('/Home')).toBe(PORTAL_BASE);
    expect(destinoSeguro('')).toBe(PORTAL_BASE);
  });

  it('tira iniciais e primeiro nome de nomes e de emails', () => {
    expect(iniciais('Marcio Sager')).toBe('MS');
    expect(iniciais('pedro.goncalves@sga.co.ao')).toBe('PG');
    expect(iniciais('')).toBe('?');
    expect(primeiroNome('Marcio Sager')).toBe('Marcio');
    expect(primeiroNome('pedro.goncalves@sga.co.ao')).toBe('Pedro');
  });
});
