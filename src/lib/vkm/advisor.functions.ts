import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ChatMsg = { role: "user" | "assistant"; content: string };

// Fallback system prompt if the participant's Business Brain hasn't generated one yet.
const DEFAULT_SYSTEM = `You are a personal business advisor inside Venu Kalyan's VK Mentorship.
Follow VK's methodology: Implementation + Accountability + Systems = Growth.
The owner is in a 4-month, 16-week program (Foundation → Systems → Sell → Review).
Give simple, practical, action-first advice in easy language — never heavy theory.
Always tie advice to revenue, leads, closing, systems, or team.
Ask 3–5 clarifying questions before giving any role-clarity, culture, GAM, marketing, or sales output.
Never invent numbers.`;

type AiConfig = {
  provider: "openai" | "anthropic";
  enabled: boolean;
  apiKey: string;
  baseUrl: string;
  model: string;
  maxTokens: number;
};

// AI provider config lives in messaging_settings(id='ai'), managed by the admin
// (Admin → AI Configurations). Read with the SERVICE ROLE so any authenticated
// participant can use the advisor while the key never leaves the server. Falls
// back to env vars for backward compatibility.
async function loadAiConfig(): Promise<AiConfig> {
  let provider = (process.env.AI_PROVIDER as AiConfig["provider"]) || "openai";
  let apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY || "";
  let baseUrl = process.env.AI_BASE_URL || "https://api.openai.com/v1";
  let model = process.env.AI_MODEL || "gpt-4o-mini";
  let maxTokens = Number(process.env.AI_MAX_TOKENS) || 800;
  let enabled = !!apiKey;

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("messaging_settings")
      .select("provider, enabled, config")
      .eq("id", "ai")
      .maybeSingle();
    if (data) {
      const c = (data.config ?? {}) as Record<string, string>;
      provider = data.provider === "anthropic" ? "anthropic" : "openai";
      apiKey = c.apiKey || apiKey;
      baseUrl = c.baseUrl || baseUrl;
      model = c.model || model;
      maxTokens = Number(c.maxTokens) || maxTokens;
      enabled = !!data.enabled && !!apiKey;
    }
  } catch {
    /* fall back to env */
  }

  return { provider, enabled, apiKey, baseUrl: baseUrl.replace(/\/$/, ""), model, maxTokens };
}

// Retry transient gateway failures (overload / cold start): 429 + 5xx.
const TRANSIENT = new Set([429, 500, 502, 503, 504]);
async function aiFetch(url: string, init: RequestInit, tries = 3): Promise<Response> {
  let res: Response | null = null;
  for (let i = 0; i < tries; i++) {
    res = await fetch(url, init);
    if (res.ok || !TRANSIENT.has(res.status) || i === tries - 1) return res;
    await new Promise((r) => setTimeout(r, 700 * (i + 1)));
  }
  return res as Response;
}

// Calls the configured provider with the right request/response shape.
async function callAi(
  cfg: AiConfig,
  system: string,
  messages: ChatMsg[],
): Promise<{ ok: boolean; status: number; content: string; error: string }> {
  if (cfg.provider === "anthropic") {
    // Anthropic Messages API: system is a top-level field; messages must start
    // with a user turn and alternate. Used by api.anthropic.com and compatible
    // gateways (e.g. opus.abhibots.com).
    let msgs = messages;
    while (msgs.length && msgs[0].role !== "user") msgs = msgs.slice(1);
    if (!msgs.length) msgs = [{ role: "user", content: "Hello" }];
    const res = await aiFetch(`${cfg.baseUrl}/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": cfg.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model: cfg.model, max_tokens: cfg.maxTokens, system, messages: msgs }),
    });
    if (!res.ok) return { ok: false, status: res.status, content: "", error: (await res.text().catch(() => "")).slice(0, 600) };
    const j = (await res.json()) as { content?: { text?: string }[] };
    const content = (j?.content ?? []).map((b) => b?.text || "").join("").trim();
    return { ok: true, status: res.status, content, error: "" };
  }

  // OpenAI-compatible Chat Completions (OpenAI, OpenRouter, Groq, etc.)
  const res = await aiFetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({
      model: cfg.model,
      messages: [{ role: "system", content: system }, ...messages],
      temperature: 0.4,
      max_tokens: cfg.maxTokens,
    }),
  });
  if (!res.ok) return { ok: false, status: res.status, content: "", error: (await res.text().catch(() => "")).slice(0, 600) };
  const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = j?.choices?.[0]?.message?.content?.trim() || "";
  return { ok: true, status: res.status, content, error: "" };
}

// Lightweight status check the chat page calls on load.
export const advisorStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const cfg = await loadAiConfig();
    const { data: brain } = await context.supabase
      .from("business_brains")
      .select("business_name, ai_prompt")
      .eq("user_id", context.userId)
      .maybeSingle();
    return {
      activated: cfg.enabled && !!cfg.apiKey,
      hasBrain: !!brain,
      businessName: brain?.business_name ?? null,
      model: cfg.model,
    };
  });

// Hard caps so a client can't drive up provider cost or memory with a huge
// payload: at most 24 turns, each trimmed to 4000 chars, only known roles.
const MAX_MESSAGES = 24;
const MAX_CONTENT = 4000;

export const askAdvisor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { messages: ChatMsg[] }) => {
    if (!input || !Array.isArray(input.messages)) {
      throw new Error("messages must be an array");
    }
    const messages: ChatMsg[] = input.messages
      .slice(-MAX_MESSAGES)
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CONTENT) }));
    return { messages };
  })
  .handler(async ({ data, context }) => {
    const cfg = await loadAiConfig();

    if (!cfg.enabled || !cfg.apiKey) {
      return {
        activated: false,
        content:
          "⚙️ Your AI Advisor isn't activated yet.\n\nAsk your VKM admin to configure an AI provider in **Admin → AI Configurations**. Once it's on, I'll answer using your **Business Brain** — your revenue, leads, team and goals — in Venu Kalyan's methodology.",
      };
    }

    const { data: brain } = await context.supabase
      .from("business_brains")
      .select("ai_prompt")
      .eq("user_id", context.userId)
      .maybeSingle();
    const system = brain?.ai_prompt?.trim() || DEFAULT_SYSTEM;

    // Keep the last 12 turns for context without blowing the token budget.
    const recent = data.messages.slice(-12).map((m) => ({ role: m.role, content: m.content }));

    try {
      const r = await callAi(cfg, system, recent);
      if (!r.ok) {
        console.error(`askAdvisor provider error ${r.status}:`, r.error);
        const busy = r.status === 429 || r.status >= 500;
        return {
          activated: true,
          content: busy
            ? "The AI service is busy right now — please try again in a moment."
            : `The advisor hit a provider error (${r.status}). Ask your admin to verify the API key and model.`,
        };
      }
      const content = r.content || "I couldn't generate a reply just now — please try again.";

      // Best-effort log to the participant's own thread (RLS-scoped).
      const lastUser = [...recent].reverse().find((m) => m.role === "user");
      if (lastUser) {
        await context.supabase
          .from("ai_advisor_threads")
          .insert({ user_id: context.userId, prompt: lastUser.content, response: content });
      }

      return { activated: true, content };
    } catch (err) {
      console.error("askAdvisor fetch failed:", (err as Error).message);
      return {
        activated: true,
        content: "Couldn't reach the AI provider right now. Please try again in a moment.",
      };
    }
  });

// ---------------------------------------------------------------------------
// Admin: test the configured AI provider (super-admin only).
// ---------------------------------------------------------------------------
export const testAiProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { prompt?: string }) => input ?? {})
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (!isAdmin) throw new Error("Forbidden: super admins only");

    const cfg = await loadAiConfig();
    if (!cfg.apiKey) return { ok: false, error: "No API key configured." };

    const prompt = (data.prompt || "Reply with a single short sentence confirming you are online.").slice(0, 500);
    const r = await callAi(cfg, "You are a connectivity test. Reply briefly.", [{ role: "user", content: prompt }]);
    if (!r.ok) return { ok: false, error: `Provider error ${r.status}: ${r.error || "request failed"}` };
    return { ok: true, reply: r.content, model: cfg.model, provider: cfg.provider };
  });
