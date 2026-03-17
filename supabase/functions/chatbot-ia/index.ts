import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const ALLOWED_ORIGINS = [
  "https://app.marciosager.com",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

const MAX_MESSAGE_LENGTH = 2000;
const MAX_MESSAGES = 20;

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const messages = body.messages;
    const context = typeof body.context === "string" ? body.context.slice(0, 500) : "";

    // Validate messages input
    if (!Array.isArray(messages) || messages.length > MAX_MESSAGES) {
      return new Response(
        JSON.stringify({ reply: "Número de mensagens inválido." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sanitize messages - truncate and validate roles
    const validRoles = new Set(["user", "assistant"]);
    const sanitizedMessages = messages
      .filter((m: any) => m && typeof m.content === "string" && validRoles.has(m.role))
      .map((m: any) => ({
        role: m.role,
        content: m.content.slice(0, MAX_MESSAGE_LENGTH),
      }));

    // Try OpenAI first, then Anthropic
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!openaiKey && !anthropicKey) {
      return new Response(
        JSON.stringify({
          reply: "Assistente IA nao configurado. Defina OPENAI_API_KEY ou ANTHROPIC_API_KEY nos secrets do Supabase Edge Functions.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const safeContext = context ? `Contexto adicional: ${context}` : "";
    const systemPrompt = `Voce e o assistente virtual do DIROPS-SGA (Sistema de Gestao Aeroportuaria).
Ajude os utilizadores com questoes sobre:
- Operacoes de voo (chegadas, partidas, movimentos)
- Tarifas aeroportuarias e calculos
- Seguranca (Safety) e ocorrencias
- Auditorias e PACs
- Credenciamentos
- Reclamacoes
- Configuracoes do sistema
Responda sempre em portugues. Seja conciso e util.
${safeContext}`;

    let reply = "";

    if (openaiKey) {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            ...sanitizedMessages,
          ],
          max_tokens: 1000,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      reply = data.choices?.[0]?.message?.content || "Sem resposta do modelo.";
    } else if (anthropicKey) {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1000,
          system: systemPrompt,
          messages: sanitizedMessages.length > 0 ? sanitizedMessages : [{ role: "user", content: "Ola" }],
        }),
      });

      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.status}`);
      }

      const data = await response.json();
      reply = data.content?.[0]?.text || "Sem resposta do modelo.";
    }

    return new Response(
      JSON.stringify({ reply }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Chatbot error:", error);
    return new Response(
      JSON.stringify({ reply: "Erro temporário no assistente. Tente novamente." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
