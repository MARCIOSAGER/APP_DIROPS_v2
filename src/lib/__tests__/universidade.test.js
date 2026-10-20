import { describe, it, expect } from 'vitest';
import {
  noPortal, urlFormacao, urlCursoPortal, emailValido, normalizarDominios, dominioPermitido, emailInterno, validarSenha, validarPedido,
  descreverAcao, filtrarAuditoria, agruparPorDia, csvDe, saudacao, primeiroNome, iniciais, estadoConvite, resumoAcessos, destinoSeguro,
  listaEmails, emailsInvalidos, mailtoDe, paginasPermitidas, podeVerPagina, PERMISSOES_PADRAO,
} from '../universidade.js';

describe('caminhos do portal', () => {
  it('detecta o portal pelo prefixo e escolhe a página de formação certa', () => {
    expect(noPortal('/universidade/formacao')).toBe(true);
    expect(noPortal('/Formacao')).toBe(false);
    expect(urlFormacao('?curso=1', '/universidade')).toBe('/universidade/formacao?curso=1');
    expect(urlFormacao('?curso=1', '/Home')).toBe('/Formacao?curso=1');
    expect(urlCursoPortal('abc', '&aula=x')).toBe('/universidade/formacao?curso=abc&aula=x');
  });
  it('só aceita destinos dentro do portal depois do login', () => {
    expect(destinoSeguro('/universidade/gestao/acessos')).toBe('/universidade/gestao/acessos');
    expect(destinoSeguro('//evil.example')).toBe('/universidade');
    expect(destinoSeguro('/Home')).toBe('/universidade');
    expect(destinoSeguro('')).toBe('/universidade');
  });
});

describe('domínios e emails', () => {
  it('normaliza listas escritas de várias formas', () => {
    expect(normalizarDominios('sga.co.ao, @Outra.AO\nterceira.com; sga.co.ao')).toEqual(['sga.co.ao', 'outra.ao', 'terceira.com']);
    expect(normalizarDominios(['x.pt', 'lixo', ''])).toEqual(['x.pt']);
  });
  it('permite subdomínios e lista vazia = tudo', () => {
    expect(dominioPermitido('a@sga.co.ao', ['sga.co.ao'])).toBe(true);
    expect(dominioPermitido('a@ops.sga.co.ao', ['sga.co.ao'])).toBe(true);
    expect(dominioPermitido('a@gmail.com', ['sga.co.ao'])).toBe(false);
    expect(dominioPermitido('a@gmail.com', [])).toBe(true);
    expect(emailInterno('x@sga.co.ao')).toBe(true);
    expect(emailInterno('x@outlook.com')).toBe(false);
    expect(emailValido('sem-arroba')).toBe(false);
  });
});

describe('listas de emails', () => {
  it('normaliza listas com vírgula, ponto e vírgula ou espaços e aponta inválidos', () => {
    expect(listaEmails('A@sga.co.ao; b@sga.co.ao, a@sga.co.ao  c@x.pt')).toEqual(['a@sga.co.ao', 'b@sga.co.ao', 'c@x.pt']);
    expect(listaEmails(['x@y.pt', 'lixo'])).toEqual(['x@y.pt']);
    expect(emailsInvalidos('a@sga.co.ao; lixo, sem-arroba')).toEqual(['lixo', 'sem-arroba']);
    expect(listaEmails('')).toEqual([]);
  });
  it('gera mailto com vários destinatários', () => {
    expect(mailtoDe('a@sga.co.ao; b@sga.co.ao')).toBe('mailto:a@sga.co.ao,b@sga.co.ao');
    expect(mailtoDe('')).toBe('mailto:');
  });
});

describe('perfis × páginas do portal', () => {
  it('formando por omissão vê as páginas do aluno mas não a gestão', () => {
    const s = paginasPermitidas({ perfis: ['formando'] }, null);
    expect([...s]).toEqual(expect.arrayContaining(['inicio', 'conta', 'formacao', 'sessoes', 'ranking', 'ajuda']));
    expect(s.has('gestao')).toBe(false);
  });
  it('quem só tem perfis do DIROPS conta como formando; instrutor soma a gestão; admin vê tudo', () => {
    expect(paginasPermitidas({ perfis: ['operacoes'] }, null).has('formacao')).toBe(true);
    expect(paginasPermitidas({ perfis: ['instrutor'] }, null).has('gestao_cursos')).toBe(true);
    expect(paginasPermitidas({ perfis: ['instrutor'] }, null).has('gestao_configuracoes')).toBe(false);
    expect(paginasPermitidas({ perfis: ['admin_universidade'] }, { administrador: [] }).has('gestao_configuracoes')).toBe(true);
    expect(paginasPermitidas({ role: 'admin', perfis: ['administrador'] }, null).has('gestao_configuracoes')).toBe(true); // conta global
    expect(paginasPermitidas({ role: 'user', perfis: ['administrador'] }, null).has('gestao_configuracoes')).toBe(false); // administrador do DIROPS não é admin do portal
  });
  it('a matriz guardada substitui as predefinições', () => {
    const perm = { formando: ['formacao'], instrutor: ['gestao', 'gestao_configuracoes'] };
    expect(podeVerPagina({ perfis: ['formando'] }, perm, 'ranking')).toBe(false);
    expect(podeVerPagina({ perfis: ['instrutor'] }, perm, 'gestao_configuracoes')).toBe(true);
    expect(podeVerPagina({ perfis: ['instrutor'] }, perm, 'ranking')).toBe(false);
    expect(podeVerPagina({ perfis: ['formando'] }, perm, 'inicio')).toBe(true);
    expect(PERMISSOES_PADRAO.instrutor).not.toContain('gestao_configuracoes');
  });
});

describe('validações de formulários', () => {
  it('senha com as regras do DIROPS', () => {
    expect(validarSenha('Abcdefg1').ok).toBe(true);
    const r = validarSenha('abc');
    expect(r.ok).toBe(false);
    expect(r.erros).toEqual(['pelo menos 8 caracteres', 'uma letra maiúscula', 'um número']);
  });
  it('pedido de acesso respeita os domínios configurados', () => {
    expect(validarPedido({ nome: 'Ana Silva', email: 'ana@sga.co.ao' }, { dominios_permitidos: ['sga.co.ao'] }).ok).toBe(true);
    const r = validarPedido({ nome: 'A', email: 'ana@gmail.com' }, { dominios_permitidos: ['sga.co.ao'] });
    expect(r.ok).toBe(false);
    expect(r.erros.nome).toBeTruthy();
    expect(r.erros.email).toContain('@sga.co.ao');
  });
});

describe('registo de auditoria', () => {
  const linhas = [
    { id: '1', quando: '2026-09-30T09:00:00Z', categoria: 'sistema', acao: 'login', actor_email: 'ana@sga.co.ao', detalhe: 'Portal', ip: '10.1.1.1' },
    { id: '2', quando: '2026-09-29T09:00:00Z', categoria: 'avaliacao', acao: 'avaliacao_submetida', actor_email: 'rui@sga.co.ao', detalhe: 'GRF', dados: { eventos: 2 } },
    { id: '3', quando: '2026-09-01T09:00:00Z', categoria: 'avaliacao', acao: 'avaliacao_submetida', actor_email: 'rui@sga.co.ao', detalhe: 'SGSO', dados: { eventos: 0 } },
    { id: '4', quando: '2026-08-01T09:00:00Z', categoria: 'matricula', acao: 'coisa_nova', actor_email: 'zé@sga.co.ao', detalhe: 'x' },
  ];
  it('descreve acções conhecidas e desconhecidas', () => {
    expect(descreverAcao('login').label).toBe('Início de sessão');
    expect(descreverAcao('coisa_nova')).toEqual({ label: 'Coisa nova', cor: 'slate', icone: 'Activity' });
  });
  it('filtra por texto, categoria, datas e integridade', () => {
    expect(filtrarAuditoria(linhas, { texto: 'rui' }).map(l => l.id)).toEqual(['2', '3']);
    expect(filtrarAuditoria(linhas, { categoria: 'sistema' }).map(l => l.id)).toEqual(['1']);
    expect(filtrarAuditoria(linhas, { de: '2026-09-15', ate: '2026-09-30' }).map(l => l.id)).toEqual(['1', '2']);
    expect(filtrarAuditoria(linhas, { soIntegridade: true }).map(l => l.id)).toEqual(['2']);
    expect(filtrarAuditoria(linhas, { texto: 'início de sessão' }).map(l => l.id)).toEqual(['1']);
  });
  it('agrupa por dia com Hoje/Ontem', () => {
    const hoje = new Date('2026-09-30T15:00:00');
    const g = agruparPorDia(linhas, hoje);
    expect(g[0].label).toBe('Hoje');
    expect(g[1].label).toBe('Ontem');
    expect(g[2].label).toMatch(/terça-feira, 01\/09\/2026/);
    expect(g.map(x => x.itens.length)).toEqual([1, 1, 1, 1]);
  });
  it('gera CSV com BOM, ponto e vírgula e aspas escapadas', () => {
    const csv = csvDe([{ a: 'x;y', b: 'diz "olá"', c: { k: 1 } }], [{ label: 'A', chave: 'a' }, { label: 'B', chave: 'b' }, { label: 'C', valor: (l) => l.c }]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('A;B;C\r\n"x;y";"diz ""olá""";"{""k"":1}"');
  });
});

describe('apresentação', () => {
  it('saudação por hora e nomes', () => {
    expect(saudacao(new Date('2026-09-30T08:00:00'))).toBe('Bom dia');
    expect(saudacao(new Date('2026-09-30T15:00:00'))).toBe('Boa tarde');
    expect(saudacao(new Date('2026-09-30T22:00:00'))).toBe('Boa noite');
    expect(primeiroNome('Marcio Sager')).toBe('Marcio');
    expect(primeiroNome('ana.silva@sga.co.ao')).toBe('ana.silva');
    expect(iniciais('Marcio Sager')).toBe('MS');
    expect(iniciais('ana.silva@sga.co.ao')).toBe('AS');
    expect(iniciais('')).toBe('?');
  });
  it('estado dos convites e resumo dos acessos', () => {
    const agora = new Date('2026-09-30T12:00:00Z');
    expect(estadoConvite({ aceite_em: '2026-09-01' }).chave).toBe('aceite');
    expect(estadoConvite({ cancelado_em: '2026-09-01' }).chave).toBe('cancelado');
    expect(estadoConvite({ expira_em: '2026-09-01T00:00:00Z' }, agora).chave).toBe('expirado');
    expect(estadoConvite({ expira_em: '2026-10-05T00:00:00Z', enviado: false }, agora).chave).toBe('nao_enviado');
    expect(estadoConvite({ expira_em: '2026-10-05T00:00:00Z', enviado: true }, agora).chave).toBe('pendente');
    const r = resumoAcessos({
      pedidos: [{ estado: 'pendente' }, { estado: 'aprovado' }],
      convites: [{ expira_em: '2026-10-05T00:00:00Z', enviado: true }, { aceite_em: '2026-09-02' }],
      utilizadores: [{ status: 'ativo', perfis: ['formando'], ultimo_login: '2026-09-29T00:00:00Z' }, { status: 'ativo', perfis: ['operacoes'], ultimo_login: null }, { status: 'inativo', perfis: ['formando'] }],
    }, agora);
    expect(r).toEqual({ pendentes: 1, porAceitar: 1, ativos: 2, formandos: 1, semLogin30d: 1 });
  });
});
