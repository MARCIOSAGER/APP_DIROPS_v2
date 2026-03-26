import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6";

const ALLOWED_ORIGINS = [
  "https://app.marciosager.com",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, sentry-trace, baggage",
  };
}

// Rate limiting: max 20 emails per IP per minute
const rateLimitMap = new Map<string, number[]>();
function checkRateLimit(ip: string, max = 20): boolean {
  const now = Date.now();
  const timestamps = (rateLimitMap.get(ip) || []).filter(t => now - t < 60000);
  if (timestamps.length >= max) return false;
  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);
  return true;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // C-01 FIX: Require authenticated user (JWT verification)
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "Autenticação obrigatória." }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseAuth = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!
  );
  const { data: { user: authUser }, error: authError } = await supabaseAuth.auth.getUser(
    authHeader.replace("Bearer ", "")
  );
  if (authError || !authUser) {
    return new Response(
      JSON.stringify({ error: "Token inválido ou expirado." }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const clientIp = req.headers.get("x-forwarded-for") || "unknown";
  if (!checkRateLimit(clientIp)) {
    return new Response(
      JSON.stringify({ error: "Demasiados pedidos. Tente novamente em 1 minuto." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const { to, subject, html, text, attachments } = await req.json();

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
    const smtpPort = parseInt(String(smtp.smtp_port || "587"));
    console.log(`SMTP config: ${smtp.smtp_host}:${smtpPort} secure=${smtp.smtp_secure === true || smtpPort === 465} user=${smtp.smtp_user ? 'set' : 'none'}`);

    const transporter = nodemailer.createTransport({
      host: smtp.smtp_host,
      port: smtpPort,
      secure: smtp.smtp_secure === true || smtpPort === 465,
      auth: (smtp.smtp_user && smtp.smtp_password) ? {
        user: smtp.smtp_user,
        pass: smtp.smtp_password,
      } : undefined,
      tls: {
        rejectUnauthorized: true,
      },
      connectionTimeout: 10000,
      socketTimeout: 10000,
      greetingTimeout: 5000,
    });

    // Send email with hard timeout (nodemailer timeouts may not work in Deno)
    const SEND_TIMEOUT = 25000; // 25s hard limit
    const sendPromise = transporter.sendMail({
      from: smtp.smtp_from_name
        ? `"${smtp.smtp_from_name}" <${smtp.smtp_from_email}>`
        : smtp.smtp_from_email,
      to: to,
      subject: subject,
      text: text || "",
      html: html || "",
      ...(attachments?.length ? {
        attachments: attachments.map((att: { filename: string; content: string; contentType?: string }) => ({
          filename: att.filename,
          content: att.content,
          encoding: 'base64',
          contentType: att.contentType || 'application/pdf',
        })),
      } : {}),
    });

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        transporter.close();
        reject(new Error(`SMTP timeout: conexao com ${smtp.smtp_host}:${smtpPort} excedeu ${SEND_TIMEOUT / 1000}s. Tente novamente.`));
      }, SEND_TIMEOUT);
    });

    const info = await Promise.race([sendPromise, timeoutPromise]) as any;

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
