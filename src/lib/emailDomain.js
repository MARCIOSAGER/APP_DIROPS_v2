// Email domain helpers for the SGA on-premise install.
// The SGA Exchange relay only accepts recipients on @sga.co.ao; external
// addresses (gmail, hotmail, etc.) bounce with 550. UI uses this to warn the
// user before triggering a flow that depends on email delivery.

const INTERNAL_DOMAINS = ['sga.co.ao'];

export function getEmailDomain(email) {
  if (typeof email !== 'string') return '';
  const at = email.lastIndexOf('@');
  if (at === -1) return '';
  return email.slice(at + 1).trim().toLowerCase();
}

export function isInternalEmail(email) {
  const d = getEmailDomain(email);
  if (!d) return false;
  return INTERNAL_DOMAINS.some(allowed =>
    d === allowed.toLowerCase() || d.endsWith('.' + allowed.toLowerCase())
  );
}

export function isExternalEmail(email) {
  return !!getEmailDomain(email) && !isInternalEmail(email);
}

// Hint shown to user / admin when email is external.
export const EXTERNAL_EMAIL_NOTICE = {
  title: 'Email externo não suportado',
  message:
    'O sistema só envia emails automaticamente para endereços @sga.co.ao (relay interno da SGA).\n\n' +
    'O seu email é externo (Gmail/Outlook/outro). Por isso:\n' +
    '• Não vai receber email de confirmação nem de redefinição de senha.\n' +
    '• Contacte o administrador do sistema para receber a sua senha temporária por outro canal (WhatsApp, telefone) ou para criar um alias @sga.co.ao.',
};

export const ADMIN_CREATING_EXTERNAL_NOTICE = {
  title: 'Email externo — sem envio automático',
  message:
    'O email indicado não é @sga.co.ao.\n\n' +
    'O sistema vai criar a conta normalmente, mas NÃO conseguirá enviar:\n' +
    '• Email de boas-vindas\n' +
    '• Email de redefinição de senha\n\n' +
    'Comunique a senha temporária ao utilizador por outro meio (WhatsApp, telefone). Confirma criar mesmo assim?',
};
