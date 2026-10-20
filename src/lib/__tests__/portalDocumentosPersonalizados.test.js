import { describe, it, expect, afterEach } from 'vitest';
import {
  PERFIS_DOCUMENTOS, PERFIL_DOC_LABEL, PERFIS_PORTAL_DOCS, registarPerfisPersonalizados, perfisPersonalizados,
  perfisPortal, paginasPermitidas, ehPerfilDocumentos, slugPerfilDoc, nivelDoPerfil, perfisDocTexto,
} from '../portalDocumentos.js';

const utilizador = (perfis) => ({ email: 'a@sga.co.ao', perfis, status: 'ativo' });
const AUDITOR = { perfil: 'doc_auditor_anac', label: 'Auditor ANAC', cor: '#1d4ed8', descricao: null, nivel: 'leitor', personalizado: true, paginas: ['inicio', 'biblioteca'] };
const COORD = { perfil: 'doc_coord_qualidade', label: 'Coordenador de Qualidade', nivel: 'gestor', personalizado: true, paginas: ['inicio', 'gestao'] };

afterEach(() => registarPerfisPersonalizados([]));

describe('perfis personalizados do portal de documentos (migração 179)', () => {
  it('registar acrescenta aos perfis do portal e limpa os anteriores', () => {
    registarPerfisPersonalizados([AUDITOR, { perfil: 'leitor_documentos', paginas: [] }]);
    expect(PERFIS_DOCUMENTOS).toContain('doc_auditor_anac');
    expect(PERFIL_DOC_LABEL.doc_auditor_anac).toBe('Auditor ANAC');
    expect(PERFIS_PORTAL_DOCS.find(p => p.chave === 'doc_auditor_anac')).toMatchObject({ personalizado: true, nivel: 'leitor', cor: '#1d4ed8' });
    registarPerfisPersonalizados([COORD]);
    expect(PERFIS_DOCUMENTOS).not.toContain('doc_auditor_anac');
    expect(PERFIL_DOC_LABEL.doc_auditor_anac).toBeUndefined();
    expect(PERFIS_DOCUMENTOS.slice(0, 4)).toEqual(['leitor_documentos', 'editor_documentos', 'gestor_documentos', 'admin_documentos']);
    expect(perfisPersonalizados().map(p => p.perfil)).toEqual(['doc_coord_qualidade']);
  });

  it('ignora linhas inválidas (sem nível, nome fora do padrão, não personalizadas)', () => {
    registarPerfisPersonalizados([{ ...AUDITOR, nivel: 'admin' }, { ...AUDITOR, perfil: 'auditor' }, { ...AUDITOR, personalizado: false }]);
    expect(perfisPersonalizados()).toHaveLength(0);
  });

  it('o nível base dá os poderes: gestor personalizado é gestor, leitor personalizado é só membro', () => {
    registarPerfisPersonalizados([AUDITOR, COORD]);
    expect(perfisPortal(utilizador(['doc_coord_qualidade']))).toMatchObject({ admin: false, gestor: true, editor: true, membro: true });
    expect(perfisPortal(utilizador(['doc_auditor_anac']))).toMatchObject({ gestor: false, editor: false, membro: true });
    expect(nivelDoPerfil('doc_coord_qualidade')).toBe('gestor');
    expect(nivelDoPerfil('gestor_documentos')).toBe('gestor');
    expect(nivelDoPerfil('admin_documentos')).toBe('admin');
  });

  it('um perfil «doc_…» ainda por carregar já deixa entrar como leitor, mas não dá gestão', () => {
    expect(perfisPortal(utilizador(['doc_qualquer_coisa']))).toMatchObject({ membro: true, editor: false, gestor: false });
    expect(ehPerfilDocumentos('doc_qualquer_coisa')).toBe(true);
    expect(ehPerfilDocumentos('formando')).toBe(false);
  });

  it('as páginas vêm da coluna do perfil próprio', () => {
    registarPerfisPersonalizados([AUDITOR]);
    const pags = paginasPermitidas(utilizador(['doc_auditor_anac']), { doc_auditor_anac: AUDITOR.paginas });
    expect(pags.has('biblioteca')).toBe(true);
    expect(pags.has('pesquisa')).toBe(false);
    expect(perfisDocTexto(['doc_auditor_anac', 'formando'])).toBe('Auditor ANAC');
  });

  it('nome técnico a partir do nome visível', () => {
    expect(slugPerfilDoc('Auditor ANAC')).toBe('doc_auditor_anac');
    expect(slugPerfilDoc('Técnico — AVSEC (FNLU)')).toBe('doc_tecnico_avsec_fnlu');
  });
});
