// Shared, server-only AI provider layer.
//
// Both the AI Advisor (advisor.functions.ts) and the PDF business-data
// extractor (business-extract.functions.ts) talk to the same configured
// provider through this module, so the request/response shapes, retry policy
// and config loading live in exactly one place.
//
// SECURITY: this module reads the provider API key from messaging_settings
// (id='ai') with the SERVICE ROLE and must only ever be imported by server
// functions / edge code — never from a client component. The key never leaves
// the server.

export type ChatMsg = { role: "user" | "assistant"; content: string };

export type AiConfig = {
  provider: "openai" | "anthropic";
  enabled: boolean;
  apiKey: string;
  baseUrl: string;
  model: string;
  maxTokens: number;
};

// AI provider config lives in messaging_settings(id='ai'), managed by the admin
// (Admin → AI Configurations). Read with the SERVICE ROLE so any authenticated
// participant can use AI features while the key never leaves the server. Falls
// back to env vars for backward compatibility.
export async function loadAiConfig(): Promise<AiConfig> {
  let provider = (process.env.AI_PROVIDER as AiConfig["provider"]) || "openai";
  let apiKey =
    process.env.AI_API_KEY || process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY || "";
  let baseUrl = process.env.AI_BASE_URL || "https://api.openai.com/v1";
  let model = process.env.AI_MODEL || "gpt-4o-mini";
  let maxTokens = Number(process.env.AI_MAX_TOKENS) || 800;
  let enabled = !!apiKey;

  // The admin DB read is the PREFERRED source (Admin → AI Configurations), but
  // it needs the service-role key. On Cloudflare Workers that key is a secret
  // (.dev.vars / `wrangler secret put`) that may be absent — in which case the
  // advisor is meant to run purely off the AI_* env vars. Skip the DB entirely
  // when the key is missing so we don't construct (and throw from) the admin
  // client and spam the logs; just use the env config above.
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
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
    } catch (err) {
      console.error("loadAiConfig: DB read failed, using env config:", (err as Error).message);
    }
  }

  return { provider, enabled, apiKey, baseUrl: baseUrl.replace(/\/$/, ""), model, maxTokens };
}

// Retry transient gateway failures (overload / cold start): 429 + 5xx.
const TRANSIENT = new Set([429, 500, 502, 503, 504]);

// No outbound AI-provider call ever had a timeout, so a gateway that accepts
// the connection but never replies (rather than erroring) hung the request —
// and the advisor's "..." indicator — forever. Every fetch below now aborts
// after a bound and surfaces as a normal (retryable) 504, so a broken upstream
// always resolves within a bounded time instead of hanging indefinitely.
const REQUEST_TIMEOUT_MS = 30_000;

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    console.error("aiFetch: request failed or timed out:", (err as Error).message);
    return new Response("", { status: 504 }); // synthetic — lets existing !res.ok / TRANSIENT handling apply
  } finally {
    clearTimeout(timer);
  }
}

export async function aiFetch(url: string, init: RequestInit, tries = 3): Promise<Response> {
  let res: Response | null = null;
  for (let i = 0; i < tries; i++) {
    res = await fetchWithTimeout(url, init, REQUEST_TIMEOUT_MS);
    if (res.ok || !TRANSIENT.has(res.status) || i === tries - 1) return res;
    await new Promise((r) => setTimeout(r, 700 * (i + 1)));
  }
  return res as Response;
}

// Calls the configured provider with the right request/response shape.
// `temperature` lets callers ask for deterministic output (e.g. extraction).
export async function callAi(
  cfg: AiConfig,
  system: string,
  messages: ChatMsg[],
  opts: { temperature?: number } = {},
): Promise<{ ok: boolean; status: number; content: string; error: string }> {
  const temperature = opts.temperature ?? 0.4;

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
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: cfg.maxTokens,
        temperature,
        system,
        messages: msgs,
      }),
    });
    if (!res.ok)
      return {
        ok: false,
        status: res.status,
        content: "",
        error: (await res.text().catch(() => "")).slice(0, 600),
      };
    const j = (await res.json()) as { content?: { text?: string }[] };
    const content = (j?.content ?? [])
      .map((b) => b?.text || "")
      .join("")
      .trim();
    return { ok: true, status: res.status, content, error: "" };
  }

  // OpenAI-compatible Chat Completions (OpenAI, OpenRouter, Groq, etc.)
  const res = await aiFetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({
      model: cfg.model,
      messages: [{ role: "system", content: system }, ...messages],
      temperature,
      max_tokens: cfg.maxTokens,
    }),
  });
  if (!res.ok)
    return {
      ok: false,
      status: res.status,
      content: "",
      error: (await res.text().catch(() => "")).slice(0, 600),
    };
  const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = j?.choices?.[0]?.message?.content?.trim() || "";
  return { ok: true, status: res.status, content, error: "" };
}

// Build the provider request for a STREAMING completion (stream: true).
function streamRequest(
  cfg: AiConfig,
  system: string,
  messages: ChatMsg[],
  temperature: number,
): { url: string; headers: Record<string, string>; body: string } {
  if (cfg.provider === "anthropic") {
    let msgs = messages;
    while (msgs.length && msgs[0].role !== "user") msgs = msgs.slice(1);
    if (!msgs.length) msgs = [{ role: "user", content: "Hello" }];
    return {
      url: `${cfg.baseUrl}/messages`,
      headers: {
        "content-type": "application/json",
        "x-api-key": cfg.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: cfg.maxTokens,
        temperature,
        system,
        messages: msgs,
        stream: true,
      }),
    };
  }
  return {
    url: `${cfg.baseUrl}/chat/completions`,
    headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({
      model: cfg.model,
      messages: [{ role: "system", content: system }, ...messages],
      temperature,
      max_tokens: cfg.maxTokens,
      stream: true,
    }),
  };
}

// Pull the text delta out of one parsed SSE event for either provider.
function deltaText(cfg: AiConfig, json: unknown): string {
  const j = json as {
    type?: string;
    delta?: { type?: string; text?: string };
    choices?: { delta?: { content?: string } }[];
  };
  if (cfg.provider === "anthropic") {
    return j?.type === "content_block_delta" && j?.delta?.type === "text_delta"
      ? j.delta.text || ""
      : "";
  }
  return j?.choices?.[0]?.delta?.content || "";
}

/**
 * Stream a completion as plain UTF-8 text chunks. The provider's SSE is parsed
 * server-side so the client just appends text — first words land in ~1s instead
 * of waiting for the whole answer.
 *
 * Degrades gracefully: if the gateway ignores `stream: true` and returns a
 * normal JSON body, the full reply is emitted in one chunk. On any error a
 * short human message is emitted so the chat never hangs.
 *
 * `hooks.onDone(full)` runs once with the complete text (e.g. to log it).
 */
// Idle window between bytes (connect included). Reset on every chunk received,
// so a slow-but-progressing generation is never cut off — only a connection
// that goes silent for this long is treated as hung.
const STREAM_IDLE_MS = 20_000;

export function streamAi(
  cfg: AiConfig,
  system: string,
  messages: ChatMsg[],
  hooks: { onDone?: (full: string) => void } = {},
  opts: { temperature?: number } = {},
): ReadableStream<Uint8Array> {
  const temperature = opts.temperature ?? 0.4;
  const encoder = new TextEncoder();
  let full = "";

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (t: string) => {
        if (!t) return;
        full += t;
        controller.enqueue(encoder.encode(t));
      };
      const finish = () => {
        if (idleTimer) clearTimeout(idleTimer);
        try {
          hooks.onDone?.(full);
        } catch {
          /* logging is best-effort */
        }
        controller.close();
      };

      // One AbortController spans connect + the whole read loop: aborting it
      // rejects both an in-flight fetch() and an in-flight reader.read() (the
      // Fetch/Streams spec ties a response body's reads to its request signal).
      const abortCtl = new AbortController();
      let idleTimer: ReturnType<typeof setTimeout> | undefined;
      const bumpIdle = () => {
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(() => abortCtl.abort(), STREAM_IDLE_MS);
      };

      try {
        bumpIdle();
        const { url, headers, body } = streamRequest(cfg, system, messages, temperature);
        const res = await fetch(url, { method: "POST", headers, body, signal: abortCtl.signal });
        bumpIdle(); // got a response — reset the clock for the body/first chunk

        if (!res.ok || !res.body) {
          const errTxt = (await res.text().catch(() => "")).slice(0, 300);
          console.error(`streamAi provider error ${res.status}:`, errTxt);
          emit(
            res.status === 429 || res.status >= 500
              ? "The AI service is busy right now — please try again in a moment."
              : `The advisor hit a provider error (${res.status}). Ask your admin to verify the API key and model.`,
          );
          finish();
          return;
        }

        // Gateway ignored stream:true — fall back to a single full chunk.
        if (!(res.headers.get("content-type") || "").includes("event-stream")) {
          const j = await res.json().catch(() => null);
          if (cfg.provider === "anthropic") {
            emit(
              ((j as { content?: { text?: string }[] })?.content ?? [])
                .map((b) => b?.text || "")
                .join(""),
            );
          } else {
            emit(
              (j as { choices?: { message?: { content?: string } }[] })?.choices?.[0]?.message
                ?.content || "",
            );
          }
          finish();
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        for (;;) {
          const { done, value } = await reader.read();
          bumpIdle(); // got a chunk (or a clean close) — push the idle deadline out again
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (!data || data === "[DONE]") continue;
            try {
              emit(deltaText(cfg, JSON.parse(data)));
            } catch {
              /* ignore partial / non-JSON keepalive lines */
            }
          }
        }
        finish();
      } catch (err) {
        const isAbort = (err as Error)?.name === "AbortError";
        console.error(
          isAbort ? "streamAi timed out (idle/connect):" : "streamAi failed:",
          (err as Error).message,
        );
        if (!full) {
          emit(
            isAbort
              ? "The advisor is taking too long to respond — please try again in a moment."
              : "Couldn't reach the AI provider right now. Please try again in a moment.",
          );
        } else if (isAbort) {
          // Partial reply already streamed, then the connection went idle — say
          // so instead of letting a truncated answer look like the full one.
          emit("\n\n_(cut off — the connection stalled. Please try again.)_");
        }
        finish();
      }
    },
  });
}
