const LOGO_URL = '/logo-dirops.png';

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escAttr(str) {
  if (!str) return '';
  return encodeURI(String(str));
}

const baseLayout = (content) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1e3a5f 0%,#1a3050 100%);border-radius:12px 12px 0 0;padding:30px 40px;text-align:center;">
      <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:1px;">DIROPS</h1>
      <p style="margin:4px 0 0;color:#93c5fd;font-size:12px;letter-spacing:0.5px;">Sistema de Gestao Aeroportuaria</p>
    </div>
    <!-- Body -->
    <div style="background:#ffffff;padding:32px 40px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
      ${content}
    </div>
    <!-- Footer -->
    <div style="background:#f8fafc;border-radius:0 0 12px 12px;padding:20px 40px;border:1px solid #e2e8f0;border-top:none;text-align:center;">
      <p style="margin:0;color:#94a3b8;font-size:11px;">
        Este email foi enviado automaticamente pelo DIROPS.
      </p>
      <p style="margin:4px 0 0;color:#cbd5e1;font-size:10px;">
        Sistema de Gestao Aeroportuaria
      </p>
    </div>
  </div>
</body>
</html>`;

export const emailTemplates = {
  // Email de teste SMTP
  smtp_test: () => baseLayout(`
    <div style="text-align:center;padding:10px 0;">
      <div style="width:56px;height:56px;background:#ecfdf5;border-radius:50%;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;">
        <span style="font-size:28px;">&#9989;</span>
      </div>
      <h2 style="margin:0 0 8px;color:#0f172a;font-size:20px;">Configuracao SMTP Validada</h2>
      <p style="margin:0 0 20px;color:#64748b;font-size:14px;line-height:1.6;">
        Se voce esta a receber este email, a configuracao SMTP do DIROPS esta funcionando corretamente.
      </p>
      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:16px;text-align:left;">
        <p style="margin:0;color:#0369a1;font-size:13px;"><strong>Servidor:</strong> Conectado</p>
        <p style="margin:4px 0 0;color:#0369a1;font-size:13px;"><strong>Autenticacao:</strong> Validada</p>
        <p style="margin:4px 0 0;color:#0369a1;font-size:13px;"><strong>Envio:</strong> Sucesso</p>
      </div>
    </div>
  `),

  // Acesso aprovado
  user_approved: ({ full_name, perfis, aeroportos, url }) => baseLayout(`
    <div style="padding:10px 0;">
      <div style="text-align:center;margin-bottom:24px;">
        <div style="width:56px;height:56px;background:#ecfdf5;border-radius:50%;margin:0 auto 12px;display:flex;align-items:center;justify-content:center;">
          <span style="font-size:28px;">&#9989;</span>
        </div>
        <h2 style="margin:0;color:#0f172a;font-size:20px;">Acesso Aprovado</h2>
      </div>
      <p style="color:#334155;font-size:14px;line-height:1.6;">
        Prezado(a) <strong>${escHtml(full_name) || 'Utilizador'}</strong>,
      </p>
      <p style="color:#334155;font-size:14px;line-height:1.6;">
        O seu acesso ao sistema DIROPS foi <strong style="color:#059669;">aprovado</strong> com sucesso.
      </p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:20px 0;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:6px 0;color:#64748b;font-size:13px;width:120px;">Perfis:</td>
            <td style="padding:6px 0;color:#0f172a;font-size:13px;font-weight:600;">${escHtml(Array.isArray(perfis) ? perfis.join(', ') : perfis) || 'Utilizador'}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b;font-size:13px;">Aeroportos:</td>
            <td style="padding:6px 0;color:#0f172a;font-size:13px;font-weight:600;">${escHtml(Array.isArray(aeroportos) ? aeroportos.join(', ') : aeroportos) || 'Todos'}</td>
          </tr>
        </table>
      </div>
      ${url ? `
      <div style="text-align:center;margin:24px 0;">
        <a href="${escAttr(url)}" style="display:inline-block;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600;">
          Aceder ao Sistema
        </a>
      </div>` : ''}
    </div>
  `),

  // Acesso rejeitado
  user_rejected: ({ full_name, motivo }) => baseLayout(`
    <div style="padding:10px 0;">
      <div style="text-align:center;margin-bottom:24px;">
        <div style="width:56px;height:56px;background:#fef2f2;border-radius:50%;margin:0 auto 12px;display:flex;align-items:center;justify-content:center;">
          <span style="font-size:28px;">&#10060;</span>
        </div>
        <h2 style="margin:0;color:#0f172a;font-size:20px;">Solicitacao de Acesso</h2>
      </div>
      <p style="color:#334155;font-size:14px;line-height:1.6;">
        Prezado(a) <strong>${escHtml(full_name) || 'Utilizador'}</strong>,
      </p>
      <p style="color:#334155;font-size:14px;line-height:1.6;">
        Lamentamos informar que a sua solicitacao de acesso ao DIROPS nao foi aprovada neste momento.
      </p>
      ${motivo ? `
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:20px 0;">
        <p style="margin:0;color:#991b1b;font-size:13px;"><strong>Motivo:</strong> ${escHtml(motivo)}</p>
      </div>` : ''}
      <p style="color:#64748b;font-size:13px;line-height:1.6;">
        Para mais informacoes, contacte o administrador do sistema.
      </p>
    </div>
  `),

  // Nova solicitacao de acesso (para admin)
  new_access_request: ({ full_name, email, url }) => baseLayout(`
    <div style="padding:10px 0;">
      <div style="text-align:center;margin-bottom:24px;">
        <div style="width:56px;height:56px;background:#eff6ff;border-radius:50%;margin:0 auto 12px;display:flex;align-items:center;justify-content:center;">
          <span style="font-size:28px;">&#128100;</span>
        </div>
        <h2 style="margin:0;color:#0f172a;font-size:20px;">Nova Solicitacao de Acesso</h2>
      </div>
      <p style="color:#334155;font-size:14px;line-height:1.6;">
        Um novo utilizador solicitou acesso ao sistema DIROPS:
      </p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:20px 0;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:6px 0;color:#64748b;font-size:13px;width:80px;">Nome:</td>
            <td style="padding:6px 0;color:#0f172a;font-size:13px;font-weight:600;">${escHtml(full_name) || '-'}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b;font-size:13px;">Email:</td>
            <td style="padding:6px 0;color:#0f172a;font-size:13px;">${escHtml(email) || '-'}</td>
          </tr>
        </table>
      </div>
      ${url ? `
      <div style="text-align:center;margin:24px 0;">
        <a href="${escAttr(url)}" style="display:inline-block;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600;">
          Gerir Acessos
        </a>
      </div>` : ''}
    </div>
  `),

  // Notificacao generica
  notification: ({ title, message, details, actionUrl, actionLabel }) => baseLayout(`
    <div style="padding:10px 0;">
      <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;text-align:center;">${escHtml(title) || 'Notificacao'}</h2>
      <p style="color:#334155;font-size:14px;line-height:1.6;">${escHtml(message) || ''}</p>
      ${details ? `
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:20px 0;">
        <p style="margin:0;color:#334155;font-size:13px;white-space:pre-line;">${escHtml(details)}</p>
      </div>` : ''}
      ${actionUrl ? `
      <div style="text-align:center;margin:24px 0;">
        <a href="${escAttr(actionUrl)}" style="display:inline-block;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600;">
          ${escHtml(actionLabel) || 'Ver Detalhes'}
        </a>
      </div>` : ''}
    </div>
  `),

  // Recuperacao de senha
  password_reset: ({ full_name, resetUrl }) => baseLayout(`
    <div style="padding:10px 0;">
      <div style="text-align:center;margin-bottom:24px;">
        <div style="width:56px;height:56px;background:#eff6ff;border-radius:50%;margin:0 auto 12px;display:flex;align-items:center;justify-content:center;">
          <span style="font-size:28px;">&#128274;</span>
        </div>
        <h2 style="margin:0;color:#0f172a;font-size:20px;">Recuperacao de Senha</h2>
      </div>
      <p style="color:#334155;font-size:14px;line-height:1.6;">
        Prezado(a) <strong>${escHtml(full_name) || 'Utilizador'}</strong>,
      </p>
      <p style="color:#334155;font-size:14px;line-height:1.6;">
        Recebemos um pedido para redefinir a sua senha no DIROPS. Clique no botao abaixo:
      </p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${escAttr(resetUrl)}" style="display:inline-block;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600;">
          Redefinir Senha
        </a>
      </div>
      <p style="color:#94a3b8;font-size:12px;line-height:1.6;">
        Se nao fez este pedido, ignore este email. O link expira em 24 horas.
      </p>
    </div>
  `),
};
