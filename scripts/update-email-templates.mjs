#!/usr/bin/env node
// Update Supabase email templates to PT-PT with DIROPS branding

const PAT = "sbp_e4b404361fd9279d49fed6e5d32b4c2e29075714";
const PROJECT_REF = "glernwcsuwcyzwsnelad";

const header = `<div style="background:linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%);padding:32px;text-align:center;">
<h1 style="margin:0;color:#fff;font-size:28px;font-weight:bold;letter-spacing:1px;">DIROPS</h1>
<p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Sistema de Gest\u00e3o Aeroportu\u00e1ria</p>
</div>`;

const footer = `<div style="background:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0;">
<p style="margin:0;color:#94a3b8;font-size:12px;">\u00a9 2026 DIROPS - Sistema de Gest\u00e3o Aeroportu\u00e1ria</p>
</div>`;

function wrap(content) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.07);">
<tr><td>${header}</td></tr>
<tr><td style="padding:40px 32px;">${content}</td></tr>
<tr><td>${footer}</td></tr>
</table></td></tr></table></body></html>`;
}

function btn(url, text, color = "#2563eb") {
  return `<div style="text-align:center;margin:32px 0;">
<a href="${url}" style="display:inline-block;background:${color};color:#fff;text-decoration:none;padding:14px 40px;border-radius:8px;font-size:16px;font-weight:bold;">${text}</a>
</div>`;
}

const recovery = wrap(`
<div style="text-align:center;margin-bottom:24px;"><span style="font-size:40px;">🔒</span></div>
<h2 style="margin:0 0 16px;text-align:center;color:#1e293b;font-size:22px;">Redefinir a sua Senha</h2>
<p style="margin:0 0 24px;text-align:center;color:#64748b;font-size:15px;line-height:1.6;">
Recebemos um pedido para redefinir a senha da sua conta DIROPS. Clique no bot\u00e3o abaixo para criar uma nova senha:</p>
${btn("{{ .ConfirmationURL }}", "Redefinir Senha")}
<p style="margin:24px 0 0;text-align:center;color:#94a3b8;font-size:13px;line-height:1.5;">
Se n\u00e3o solicitou esta altera\u00e7\u00e3o, ignore este email.<br>A sua senha actual permanece inalterada.</p>`);

const invite = wrap(`
<div style="text-align:center;margin-bottom:24px;"><span style="font-size:40px;">✈️</span></div>
<h2 style="margin:0 0 16px;text-align:center;color:#1e293b;font-size:22px;">Bem-vindo ao DIROPS</h2>
<p style="margin:0 0 24px;text-align:center;color:#64748b;font-size:15px;line-height:1.6;">
Foi convidado para aceder ao sistema DIROPS - Sistema de Gest\u00e3o Aeroportu\u00e1ria.<br>
Clique no bot\u00e3o abaixo para aceitar o convite e definir a sua senha:</p>
${btn("{{ .ConfirmationURL }}", "Aceitar Convite", "#16a34a")}
<p style="margin:24px 0 0;text-align:center;color:#94a3b8;font-size:13px;">
Se n\u00e3o esperava este convite, pode ignorar este email.</p>`);

const confirmation = wrap(`
<div style="text-align:center;margin-bottom:24px;"><span style="font-size:40px;">📧</span></div>
<h2 style="margin:0 0 16px;text-align:center;color:#1e293b;font-size:22px;">Confirmar Registo</h2>
<p style="margin:0 0 24px;text-align:center;color:#64748b;font-size:15px;line-height:1.6;">
Obrigado por se registar no DIROPS. Clique no bot\u00e3o abaixo para confirmar o seu email:</p>
${btn("{{ .ConfirmationURL }}", "Confirmar Email")}
<p style="margin:24px 0 0;text-align:center;color:#94a3b8;font-size:13px;">
Se n\u00e3o criou esta conta, ignore este email.</p>`);

const passwordChanged = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.07);">
${header}
<div style="padding:40px 32px;">
<h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">A sua senha foi alterada</h2>
<p style="color:#64748b;font-size:15px;line-height:1.6;">
Confirmamos que a senha da sua conta <strong>{{ .Email }}</strong> no DIROPS foi alterada com sucesso.</p>
<p style="color:#64748b;font-size:15px;line-height:1.6;">
Se n\u00e3o fez esta altera\u00e7\u00e3o, contacte o administrador imediatamente.</p>
</div>${footer}</div>`;

const emailChanged = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.07);">
${header}
<div style="padding:40px 32px;">
<h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">O seu email foi alterado</h2>
<p style="color:#64748b;font-size:15px;line-height:1.6;">
O endere\u00e7o de email da sua conta DIROPS foi alterado para <strong>{{ .Email }}</strong>.</p>
<p style="color:#64748b;font-size:15px;line-height:1.6;">
Se n\u00e3o fez esta altera\u00e7\u00e3o, contacte o administrador imediatamente.</p>
</div>${footer}</div>`;

const emailChange = wrap(`
<h2 style="margin:0 0 16px;text-align:center;color:#1e293b;font-size:22px;">Confirmar Altera\u00e7\u00e3o de Email</h2>
<p style="margin:0 0 24px;text-align:center;color:#64748b;font-size:15px;line-height:1.6;">
Clique no bot\u00e3o abaixo para confirmar a altera\u00e7\u00e3o do seu endere\u00e7o de email:</p>
${btn("{{ .ConfirmationURL }}", "Confirmar Email")}`);

const magicLink = wrap(`
<h2 style="margin:0 0 16px;text-align:center;color:#1e293b;font-size:22px;">Link de Acesso</h2>
<p style="margin:0 0 24px;text-align:center;color:#64748b;font-size:15px;line-height:1.6;">
Clique no bot\u00e3o abaixo para aceder \u00e0 sua conta DIROPS:</p>
${btn("{{ .ConfirmationURL }}", "Aceder ao DIROPS")}`);

const config = {
  mailer_subjects_recovery: "DIROPS - Redefinir a sua Senha",
  mailer_subjects_invite: "DIROPS - Convite de Acesso",
  mailer_subjects_confirmation: "DIROPS - Confirmar Registo",
  mailer_subjects_email_change: "DIROPS - Confirmar Altera\u00e7\u00e3o de Email",
  mailer_subjects_magic_link: "DIROPS - Link de Acesso",
  mailer_subjects_password_changed_notification: "DIROPS - A sua senha foi alterada",
  mailer_subjects_email_changed_notification: "DIROPS - O seu email foi alterado",
  mailer_templates_recovery_content: recovery,
  mailer_templates_invite_content: invite,
  mailer_templates_confirmation_content: confirmation,
  mailer_templates_email_change_content: emailChange,
  mailer_templates_magic_link_content: magicLink,
  mailer_templates_password_changed_notification_content: passwordChanged,
  mailer_templates_email_changed_notification_content: emailChanged,
};

async function main() {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${PAT}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(config),
  });

  if (res.ok) {
    console.log("OK - Todos os templates atualizados para PT-PT");
  } else {
    const text = await res.text();
    console.error(`Erro ${res.status}: ${text}`);
  }
}

main();
