import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function baseLayout(content: string) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:20px;">
<div style="background:linear-gradient(135deg,#1e3a5f 0%,#1a3050 100%);border-radius:12px 12px 0 0;padding:30px 40px;text-align:center;">
<h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:1px;">DIROPS</h1>
<p style="margin:4px 0 0;color:#93c5fd;font-size:12px;">Sistema de Gestao Aeroportuaria</p>
</div>
<div style="background:#ffffff;padding:32px 40px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
${content}
</div>
<div style="background:#f8fafc;border-radius:0 0 12px 12px;padding:20px 40px;border:1px solid #e2e8f0;border-top:none;text-align:center;">
<p style="margin:0;color:#94a3b8;font-size:11px;">Este email foi enviado automaticamente pelo DIROPS.</p>
</div>
</div></body></html>`;
}

function getTemplateHtml(template: string, data: any): { subject: string; html: string } {
  switch (template) {
    case "user_approved":
      return {
        subject: "Acesso Aprovado - DIROPS",
        html: baseLayout(`
          <div style="text-align:center;margin-bottom:24px;">
            <div style="width:56px;height:56px;background:#ecfdf5;border-radius:50%;margin:0 auto 12px;display:inline-flex;align-items:center;justify-content:center;"><span style="font-size:28px;">&#9989;</span></div>
            <h2 style="margin:0;color:#0f172a;font-size:20px;">Acesso Aprovado</h2>
          </div>
          <p style="color:#334155;font-size:14px;line-height:1.6;">Prezado(a) <strong>${data?.full_name || "Utilizador"}</strong>,</p>
          <p style="color:#334155;font-size:14px;line-height:1.6;">O seu acesso ao sistema DIROPS foi <strong style="color:#059669;">aprovado</strong> com sucesso.</p>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:20px 0;">
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:6px 0;color:#64748b;font-size:13px;width:120px;">Perfis:</td><td style="padding:6px 0;color:#0f172a;font-size:13px;font-weight:600;">${data?.perfis?.join?.(", ") || data?.perfis || "Utilizador"}</td></tr>
              <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Aeroportos:</td><td style="padding:6px 0;color:#0f172a;font-size:13px;font-weight:600;">${data?.aeroportos?.join?.(", ") || data?.aeroportos || "Todos"}</td></tr>
            </table>
          </div>
          ${data?.url ? `<div style="text-align:center;margin:24px 0;"><a href="${data.url}" style="display:inline-block;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600;">Aceder ao Sistema</a></div>` : ""}
        `),
      };

    case "user_rejected":
      return {
        subject: "Solicitacao de Acesso - DIROPS",
        html: baseLayout(`
          <div style="text-align:center;margin-bottom:24px;">
            <div style="width:56px;height:56px;background:#fef2f2;border-radius:50%;margin:0 auto 12px;display:inline-flex;align-items:center;justify-content:center;"><span style="font-size:28px;">&#10060;</span></div>
            <h2 style="margin:0;color:#0f172a;font-size:20px;">Solicitacao de Acesso</h2>
          </div>
          <p style="color:#334155;font-size:14px;line-height:1.6;">Prezado(a) <strong>${data?.full_name || "Utilizador"}</strong>,</p>
          <p style="color:#334155;font-size:14px;line-height:1.6;">Lamentamos informar que a sua solicitacao de acesso ao DIROPS nao foi aprovada neste momento.</p>
          ${data?.motivo ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:20px 0;"><p style="margin:0;color:#991b1b;font-size:13px;"><strong>Motivo:</strong> ${data.motivo}</p></div>` : ""}
          <p style="color:#64748b;font-size:13px;">Para mais informacoes, contacte o administrador do sistema.</p>
        `),
      };

    case "new_access_request":
      return {
        subject: "Nova Solicitacao de Acesso - DIROPS",
        html: baseLayout(`
          <div style="text-align:center;margin-bottom:24px;">
            <div style="width:56px;height:56px;background:#eff6ff;border-radius:50%;margin:0 auto 12px;display:inline-flex;align-items:center;justify-content:center;"><span style="font-size:28px;">&#128100;</span></div>
            <h2 style="margin:0;color:#0f172a;font-size:20px;">Nova Solicitacao de Acesso</h2>
          </div>
          <p style="color:#334155;font-size:14px;line-height:1.6;">Um novo utilizador solicitou acesso ao sistema:</p>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:20px 0;">
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:6px 0;color:#64748b;font-size:13px;width:80px;">Nome:</td><td style="padding:6px 0;color:#0f172a;font-size:13px;font-weight:600;">${data?.full_name || "-"}</td></tr>
              <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Email:</td><td style="padding:6px 0;color:#0f172a;font-size:13px;">${data?.email || "-"}</td></tr>
            </table>
          </div>
          ${data?.url ? `<div style="text-align:center;margin:24px 0;"><a href="${data.url}" style="display:inline-block;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600;">Gerir Acessos</a></div>` : ""}
        `),
      };

    default:
      return { subject: "Notificacao DIROPS", html: "" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { to, subject, body, template, data } = await req.json();
    if (!to) {
      return new Response(JSON.stringify({ error: "Campo 'to' e obrigatorio." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: configs } = await supabase.from("configuracao_sistema").select("smtp_host, smtp_port, smtp_user, smtp_password, smtp_from_name, smtp_from_email").limit(1);
    const smtp = configs?.[0];
    if (!smtp?.smtp_host) {
      return new Response(JSON.stringify({ error: "SMTP nao configurado." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let emailSubject = subject || "Notificacao DIROPS";
    let emailHtml = body || "";

    if (template) {
      const tpl = getTemplateHtml(template, data || {});
      emailSubject = tpl.subject || emailSubject;
      emailHtml = tpl.html || emailHtml;
    } else if (emailHtml && !emailHtml.includes("<!DOCTYPE")) {
      emailHtml = baseLayout(`<p style="color:#334155;font-size:14px;line-height:1.6;">${emailHtml}</p>`);
    }

    const transporter = nodemailer.createTransport({
      host: smtp.smtp_host,
      port: parseInt(smtp.smtp_port || "587"),
      secure: smtp.smtp_port === "465",
      auth: (smtp.smtp_user && smtp.smtp_password) ? { user: smtp.smtp_user, pass: smtp.smtp_password } : undefined,
      tls: { rejectUnauthorized: false },
    });

    await transporter.sendMail({
      from: smtp.smtp_from_name ? `"${smtp.smtp_from_name}" <${smtp.smtp_from_email}>` : smtp.smtp_from_email,
      to, subject: emailSubject, html: emailHtml,
    });

    try {
      await supabase.from("historico_notificacao").insert({ tipo: "email", destinatario: to, assunto: emailSubject, status: "enviado", template: template || null });
    } catch (_) {}

    return new Response(JSON.stringify({ success: true, message: `Email enviado para ${to}` }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Erro:", error);
    return new Response(JSON.stringify({ error: `Erro ao enviar: ${error.message}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
