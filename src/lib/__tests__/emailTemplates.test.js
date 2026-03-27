import { describe, it, expect } from 'vitest';
import { emailTemplates } from '../emailTemplates';

// ── Structure ────────────────────────────────────────────────────────
describe('emailTemplates structure', () => {
  it('exports all expected template keys', () => {
    const keys = Object.keys(emailTemplates);
    expect(keys).toContain('smtp_test');
    expect(keys).toContain('user_approved');
    expect(keys).toContain('user_rejected');
    expect(keys).toContain('new_access_request');
    expect(keys).toContain('notification');
    expect(keys).toContain('password_reset');
  });

  it('every template is a function', () => {
    for (const [key, fn] of Object.entries(emailTemplates)) {
      expect(typeof fn, `${key} should be a function`).toBe('function');
    }
  });
});

// ── Base layout ──────────────────────────────────────────────────────
describe('base layout (via smtp_test)', () => {
  const html = emailTemplates.smtp_test();

  it('produces valid HTML document', () => {
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html>');
    expect(html).toContain('</html>');
  });

  it('includes DIROPS header', () => {
    expect(html).toContain('DIROPS');
    expect(html).toContain('Sistema de Gestao Aeroportuaria');
  });

  it('includes footer auto-send notice', () => {
    expect(html).toContain('enviado automaticamente');
  });
});

// ── smtp_test ────────────────────────────────────────────────────────
describe('emailTemplates.smtp_test', () => {
  it('shows SMTP validation content', () => {
    const html = emailTemplates.smtp_test();
    expect(html).toContain('Configuracao SMTP Validada');
    expect(html).toContain('Conectado');
    expect(html).toContain('Sucesso');
  });
});

// ── user_approved ────────────────────────────────────────────────────
describe('emailTemplates.user_approved', () => {
  it('includes user name and profiles', () => {
    const html = emailTemplates.user_approved({
      full_name: 'Maria Silva',
      perfis: ['administrador', 'operacoes'],
      aeroportos: ['FNLU', 'FNHU'],
      url: 'https://app.example.com',
    });
    expect(html).toContain('Maria Silva');
    expect(html).toContain('administrador, operacoes');
    expect(html).toContain('FNLU, FNHU');
    expect(html).toContain('Acesso Aprovado');
    expect(html).toContain('https://app.example.com');
    expect(html).toContain('Aceder ao Sistema');
  });

  it('handles missing url gracefully (no button)', () => {
    const html = emailTemplates.user_approved({
      full_name: 'Joao',
      perfis: 'operacoes',
      aeroportos: 'FNLU',
    });
    expect(html).toContain('Joao');
    expect(html).not.toContain('Aceder ao Sistema');
  });

  it('escapes HTML in user name to prevent XSS', () => {
    const html = emailTemplates.user_approved({
      full_name: '<script>alert("xss")</script>',
      perfis: [],
      aeroportos: [],
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('defaults to "Utilizador" when no name', () => {
    const html = emailTemplates.user_approved({
      perfis: [],
      aeroportos: [],
    });
    expect(html).toContain('Utilizador');
  });
});

// ── user_rejected ────────────────────────────────────────────────────
describe('emailTemplates.user_rejected', () => {
  it('includes rejection reason', () => {
    const html = emailTemplates.user_rejected({
      full_name: 'Carlos',
      motivo: 'Dados incompletos',
    });
    expect(html).toContain('Carlos');
    expect(html).toContain('Dados incompletos');
    expect(html).toContain('nao foi aprovada');
  });

  it('omits reason block when no motivo', () => {
    const html = emailTemplates.user_rejected({ full_name: 'Ana' });
    expect(html).toContain('Ana');
    expect(html).not.toContain('Motivo:');
  });

  it('escapes HTML in motivo to prevent XSS', () => {
    const html = emailTemplates.user_rejected({
      full_name: 'Test',
      motivo: '<img onerror="alert(1)">',
    });
    // The raw <img> tag should be escaped so it does not render as HTML
    expect(html).not.toContain('<img onerror');
    expect(html).toContain('&lt;img');
    expect(html).toContain('&quot;alert(1)&quot;');
  });
});

// ── new_access_request ───────────────────────────────────────────────
describe('emailTemplates.new_access_request', () => {
  it('includes user info and action link', () => {
    const html = emailTemplates.new_access_request({
      full_name: 'Pedro',
      email: 'pedro@test.com',
      url: 'https://app.example.com/acessos',
    });
    expect(html).toContain('Pedro');
    expect(html).toContain('pedro@test.com');
    expect(html).toContain('Nova Solicitacao de Acesso');
    expect(html).toContain('Gerir Acessos');
  });

  it('omits button when no url', () => {
    const html = emailTemplates.new_access_request({
      full_name: 'Pedro',
      email: 'pedro@test.com',
    });
    expect(html).not.toContain('Gerir Acessos');
  });
});

// ── notification ─────────────────────────────────────────────────────
describe('emailTemplates.notification', () => {
  it('renders title, message, details, and action', () => {
    const html = emailTemplates.notification({
      title: 'Alerta Operacional',
      message: 'Voo atrasado 2 horas.',
      details: 'DT741 FNLU->FNHU',
      actionUrl: 'https://app.example.com/voo/123',
      actionLabel: 'Ver Voo',
    });
    expect(html).toContain('Alerta Operacional');
    expect(html).toContain('Voo atrasado 2 horas.');
    expect(html).toContain('DT741 FNLU-&gt;FNHU');
    expect(html).toContain('Ver Voo');
    expect(html).toContain('https://app.example.com/voo/123');
  });

  it('uses default label "Ver Detalhes" when no actionLabel', () => {
    const html = emailTemplates.notification({
      title: 'Test',
      message: 'Msg',
      actionUrl: 'https://example.com',
    });
    expect(html).toContain('Ver Detalhes');
  });

  it('omits details and action blocks when not provided', () => {
    const html = emailTemplates.notification({
      title: 'Simple',
      message: 'Just a message',
    });
    expect(html).toContain('Simple');
    expect(html).toContain('Just a message');
    expect(html).not.toContain('Ver Detalhes');
  });

  it('defaults title to "Notificacao" when empty', () => {
    const html = emailTemplates.notification({});
    expect(html).toContain('Notificacao');
  });
});

// ── password_reset ───────────────────────────────────────────────────
describe('emailTemplates.password_reset', () => {
  it('includes reset URL and user name', () => {
    const html = emailTemplates.password_reset({
      full_name: 'Admin',
      resetUrl: 'https://app.example.com/reset?token=abc123',
    });
    expect(html).toContain('Admin');
    expect(html).toContain('Recuperacao de Senha');
    expect(html).toContain('Redefinir Senha');
    expect(html).toContain('https://app.example.com/reset?token=abc123');
    expect(html).toContain('expira em 24 horas');
  });
});
