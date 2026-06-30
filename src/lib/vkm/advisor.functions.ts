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

// Read provider config from server-only env. Whatever the admin wires up in the
// API-keys panel should populate these (any OpenAI-compatible endpoint works:
// OpenAI, OpenRouter, Groq, etc.).
function providerConfig() {
  const apiKey =
    process.env.AI_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.OPENROUTER_API_KEY ||
    "";
  const baseUrl = (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.AI_MODEL || "gpt-4o-mini";
  return { apiKey, baseUrl, model };
}

// Lightweight status check the chat page calls on load.
export const advisorStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { apiKey, model } = providerConfig();
    const { data: brain } = await context.supabase
      .from("business_brains")
      .select("business_name, ai_prompt")
      .eq("user_id", context.userId)
      .maybeSingle();
    return {
      activated: !!apiKey,
      hasBrain: !!brain,
      businessName: brain?.business_name ?? null,
      model,
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
    const { apiKey, baseUrl, model } = providerConfig();

    if (!apiKey) {
      return {
        activated: false,
        content:
          "⚙️ Your AI Advisor isn't activated yet.\n\nAsk your VKM admin to add an AI API key in **Admin → API Keys**. Once it's on, I'll answer using your **Business Brain** — your revenue, leads, team and goals — in Venu Kalyan's methodology.",
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
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: system }, ...recent],
          temperature: 0.4,
          max_tokens: 800,
        }),
      });

      if (!res.ok) {
        // Log the upstream detail server-side; don't echo provider internals to the client.
        const txt = await res.text().catch(() => "");
        console.error(`askAdvisor provider error ${res.status}:`, txt.slice(0, 500));
        return {
          activated: true,
          content: `The advisor hit a provider error (${res.status}). Ask your admin to verify the API key and model.`,
        };
      }

      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content =
        json?.choices?.[0]?.message?.content?.trim() ||
        "I couldn't generate a reply just now — please try again.";

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
