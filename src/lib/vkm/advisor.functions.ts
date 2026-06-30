import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { loadAiConfig, callAi, streamAi, type AiConfig, type ChatMsg } from "@/lib/vkm/ai-provider";
import { buildBrainContext } from "@/lib/vkm/business-context";

export type { ChatMsg };

// Fallback system prompt if the participant's Business Brain hasn't generated one yet.
const DEFAULT_SYSTEM = `You are a personal business advisor inside Venu Kalyan's VK Mentorship.
Follow VK's methodology: Implementation + Accountability + Systems = Growth.
The owner is in a 4-month, 16-week program (Foundation → Systems → Sell → Review).
Give simple, practical, action-first advice in easy language — never heavy theory.
Always tie advice to revenue, leads, closing, systems, or team.
Ask 3–5 clarifying questions before giving any role-clarity, culture, GAM, marketing, or sales output.
Never invent numbers.`;

/**
 * Build the full system prompt = persona + the participant's live BUSINESS
 * CONTEXT (profile + recent monthly snapshots, RLS-scoped to the owner) so the
 * advisor answers with real numbers, not generic advice. Shared by the blocking
 * and streaming endpoints.
 */
async function buildAdvisorSystem(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<string> {
  const [{ data: brain }, { data: snaps }] = await Promise.all([
    supabase.from("business_brains").select("*").eq("user_id", userId).maybeSingle(),
    supabase
      .from("business_snapshots")
      .select(
        "month, revenue_inr, mrr_inr, leads, deals, pipeline_inr, avg_deal_inr, closing_rate_pct, followup_pct, nps",
      )
      .eq("user_id", userId)
      .order("month", { ascending: false })
      .limit(6),
  ]);

  const persona = (brain?.ai_prompt as string | undefined)?.trim() || DEFAULT_SYSTEM;
  const businessContext = buildBrainContext(brain, snaps ?? []);
  return businessContext ? `${persona}\n\n${businessContext}` : persona;
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

// Shared validator: clamp the payload so a client can't drive up provider cost
// or memory with a huge body — at most 24 turns, each trimmed, only known roles.
function validateMessages(input: { messages: ChatMsg[] }) {
  if (!input || !Array.isArray(input.messages)) {
    throw new Error("messages must be an array");
  }
  const messages: ChatMsg[] = input.messages
    .slice(-MAX_MESSAGES)
    .filter(
      (m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string",
    )
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CONTENT) }));
  return { messages };
}

// Fire-and-forget log of one turn to the participant's own thread (RLS-scoped).
// Best-effort: never blocks or fails the reply.
function logTurn(
  supabase: SupabaseClient<Database>,
  userId: string,
  prompt: string,
  response: string,
) {
  if (!prompt || !response.trim()) return;
  void supabase
    .from("ai_advisor_threads")
    .insert({ user_id: userId, prompt, response })
    .then(
      () => {},
      () => {},
    );
}

const NOT_ACTIVATED =
  "⚙️ Your AI Advisor isn't activated yet.\n\nAsk your VKM admin to configure an AI provider in **Admin → AI Configurations**. Once it's on, I'll answer using your **Business Brain** — your revenue, leads, team and goals — in Venu Kalyan's methodology.";

export const askAdvisor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(validateMessages)
  .handler(async ({ data, context }) => {
    const cfg = await loadAiConfig();

    if (!cfg.enabled || !cfg.apiKey) {
      return { activated: false, content: NOT_ACTIVATED };
    }

    const system = await buildAdvisorSystem(context.supabase, context.userId);

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

      const lastUser = [...recent].reverse().find((m) => m.role === "user");
      if (lastUser) logTurn(context.supabase, context.userId, lastUser.content, content);

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
// Streaming advisor: same context + prompt as askAdvisor, but the reply is
// streamed to the client token-by-token so the first words land in ~1s instead
// of waiting for the whole completion. Returns a raw text/plain Response whose
// body is a ReadableStream of UTF-8 deltas.
// ---------------------------------------------------------------------------
export const askAdvisorStream = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(validateMessages)
  .handler(async ({ data, context }) => {
    const headers = {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no", // disable proxy buffering so chunks flush live
    };

    const cfg = await loadAiConfig();
    if (!cfg.enabled || !cfg.apiKey) {
      return new Response(NOT_ACTIVATED, { headers });
    }

    const system = await buildAdvisorSystem(context.supabase, context.userId);
    const recent = data.messages.slice(-12).map((m) => ({ role: m.role, content: m.content }));
    const lastUser = [...recent].reverse().find((m) => m.role === "user");

    const stream = streamAi(cfg, system, recent, {
      onDone: (full) => {
        if (lastUser) logTurn(context.supabase, context.userId, lastUser.content, full);
      },
    });

    return new Response(stream, { headers });
  });

// ---------------------------------------------------------------------------
// Admin: test the configured AI provider (super-admin only).
// ---------------------------------------------------------------------------
export const testAiProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: {
      prompt?: string;
      provider?: string;
      baseUrl?: string;
      apiKey?: string;
      model?: string;
      maxTokens?: number;
    }) => input ?? {},
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (!isAdmin) throw new Error("Forbidden: super admins only");

    // Test the values the admin entered on the form (so they can verify BEFORE
    // saving). Fall back to the saved config if the form didn't send a key.
    let cfg: AiConfig;
    if (data.apiKey && data.apiKey.trim()) {
      cfg = {
        provider: data.provider === "anthropic" ? "anthropic" : "openai",
        enabled: true,
        apiKey: data.apiKey.trim(),
        baseUrl: (data.baseUrl || "https://api.openai.com/v1").replace(/\/$/, ""),
        model: (data.model || "gpt-4o-mini").trim(),
        maxTokens: Number(data.maxTokens) || 512,
      };
    } else {
      cfg = await loadAiConfig();
    }
    if (!cfg.apiKey) {
      return { ok: false, error: "No API key — paste your key in the form (and Save) first." };
    }

    const prompt = (
      data.prompt || "Reply with a single short sentence confirming you are online."
    ).slice(0, 500);
    const r = await callAi(cfg, "You are a connectivity test. Reply briefly.", [
      { role: "user", content: prompt },
    ]);
    if (!r.ok)
      return { ok: false, error: `Provider error ${r.status}: ${r.error || "request failed"}` };
    return { ok: true, reply: r.content, model: cfg.model, provider: cfg.provider };
  });
