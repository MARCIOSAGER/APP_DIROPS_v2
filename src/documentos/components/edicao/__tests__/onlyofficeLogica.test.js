import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabaseClient', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null } }) } } }));

import {
  MIME_DOCX, ehDocx, edicaoNavegadorActiva, escolherVersaoFonte, resolverApiJs, mensagemErroConfig,
} from '../onlyofficeLogica';

describe('edicaoNavegadorActiva', () => {
  it('desligado por omissão (sem colunas da migração 184)', () => {
    expect(edicaoNavegadorActiva({})).toBe(false);
    expect(edicaoNavegadorActiva(null)).toBe(false);
    expect(edicaoNavegadorActiva({ onlyoffice_activo: true })).toBe(false);
    expect(edicaoNavegadorActiva({ onlyoffice_activo: 'true', onlyoffice_url: 'http://x/onlyoffice' })).toBe(false);
  });
  it('ligado só com interruptor e endereço', () => {
    expect(edicaoNavegadorActiva({ onlyoffice_activo: true, onlyoffice_url: 'http://srvkms001/onlyoffice' })).toBe(true);
  });
});

describe('escolherVersaoFonte', () => {
  const v = (versao, estado, mime = MIME_DOCX, extra = {}) => ({ id: 'v' + versao, versao, estado, mime, arquivo_uri: 'f' + versao, ...extra });
  it('escolhe o .docx mais recente em fonte/rascunho/em vigor', () => {
    const lista = [v(7, 'obsoleto'), v(8, 'em_vigor', 'application/pdf'), v(9, 'fonte'), v(3, 'fonte')];
    expect(escolherVersaoFonte(lista).id).toBe('v9');
  });
  it('ignora obsoletas e PDFs', () => {
    expect(escolherVersaoFonte([v(7, 'obsoleto'), v(8, 'em_vigor', 'application/pdf')])).toBeNull();
    expect(escolherVersaoFonte(null)).toBeNull();
  });
  it('reconhece .docx pelo nome quando falta o mime', () => {
    expect(ehDocx({ arquivo_nome: 'Manual.DOCX' })).toBe(true);
    expect(escolherVersaoFonte([v(2, 'rascunho', null, { arquivo_nome: 'a.docx' })]).id).toBe('v2');
  });
});

describe('resolverApiJs', () => {
  it('usa a origem actual quando o Document Server está num caminho (CSP self)', () => {
    expect(resolverApiJs('http://srvkms001/onlyoffice/', 'http://10.1.65.45'))
      .toBe('http://10.1.65.45/onlyoffice/web-apps/apps/api/documents/api.js');
  });
  it('mantém o endereço quando é a raiz de outro servidor', () => {
    expect(resolverApiJs('http://10.1.65.50', 'http://srvkms001')).toBe('http://10.1.65.50/web-apps/apps/api/documents/api.js');
  });
  it('vazio ou inválido', () => {
    expect(resolverApiJs('', 'http://x')).toBeNull();
    expect(resolverApiJs('nada', 'http://x')).toBeNull();
  });
});

describe('mensagemErroConfig', () => {
  it('traduz desligado, reserva e rota ausente', () => {
    expect(mensagemErroConfig(503, { code: 'onlyoffice_desligado' })).toMatch(/desligada/);
    expect(mensagemErroConfig(409, { code: 'sem_reserva', error: 'O documento está reservado por Ana.' })).toMatch(/Ana/);
    expect(mensagemErroConfig(404, null)).toMatch(/patch 31/);
    expect(mensagemErroConfig(500, null)).toMatch(/500/);
  });
});
