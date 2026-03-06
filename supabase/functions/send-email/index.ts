import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { to, subject, html, text } = await req.json();

    if (!to || !subject) {
      return new Response(
        JSON.stringify({ error: "Campos 'to' e 'subject' sao obrigatorios." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get SMTP config from DB
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: configs, error: dbError } = await supabase
      .from("configuracao_sistema")
      .select("smtp_host, smtp_port, smtp_user, smtp_password, smtp_from_name, smtp_from_email, smtp_secure")
      .limit(1);

    if (dbError || !configs || configs.length === 0) {
      return new Response(
        JSON.stringify({ error: "Configuracao SMTP nao encontrada. Configure em Configuracoes Gerais." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const smtp = configs[0];
    if (!smtp.smtp_host || !smtp.smtp_from_email) {
      return new Response(
        JSON.stringify({ error: "Configuracao SMTP incompleta. Preencha servidor e email de envio." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: smtp.smtp_host,
      port: parseInt(smtp.smtp_port || "587"),
      secure: smtp.smtp_port === "465",
      auth: (smtp.smtp_user && smtp.smtp_password) ? {
        user: smtp.smtp_user,
        pass: smtp.smtp_password,
      } : undefined,
      tls: {
        rejectUnauthorized: false,
      },
    });

    // Send email
    const info = await transporter.sendMail({
      from: smtp.smtp_from_name
        ? `"${smtp.smtp_from_name}" <${smtp.smtp_from_email}>`
        : smtp.smtp_from_email,
      to: to,
      subject: subject,
      text: text || "",
      html: html || "",
    });

    console.log("Email sent:", info.messageId);

    return new Response(
      JSON.stringify({ success: true, message: `Email enviado para ${to}`, messageId: info.messageId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Erro ao enviar email:", error);
    return new Response(
      JSON.stringify({ error: `Erro ao enviar email: ${error.message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
