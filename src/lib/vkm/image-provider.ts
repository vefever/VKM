// Shared, server-only image-generation provider layer.
//
// Every image feature (the admin test panel, the participants' Vision Board)
// goes through this module, so the request shape, config loading and error
// handling live in exactly one place.
//
// TWO WIRE FORMATS, verified against live keys:
//   openai -> POST {base}/images/generations           (Bearer)
//   gemini -> POST {base}/models/{model}:generateContent (x-goog-api-key)
//
// Google does publish an OpenAI-compatible /images/generations surface, but it
// only serves gemini-2.5-flash-image and gemini-3-pro-image-preview; every newer
// model (3.1 flash, 3.1 flash-lite, gemini-3-pro-image) 404s there with
// "not supported for predict". The native generateContent endpoint serves all of
// them, so that is what we use for Gemini.
//
// SECURITY: reads provider API keys from messaging_settings with the SERVICE
// ROLE. Import only from server functions / edge code — never a client
// component. The keys never leave the server.

export type ImageProvider = "openai" | "gemini";

export type ImageConfig = {
  provider: ImageProvider;
  enabled: boolean;
  apiKey: string;
  baseUrl: string;
  model: string;
};

// Defaults are the CHEAPEST model of each family — an image generated for a mood
// board doesn't need the flagship, and this is billed per image on a shared key.
export const IMAGE_PRESETS: Record<
  ImageProvider,
  { baseUrl: string; model: string; label: string; hint: string }
> = {
  openai: {
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-image-1-mini",
    label: "OpenAI",
    hint: "api.openai.com · GPT Image",
  },
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    model: "gemini-3.1-flash-lite-image",
    label: "Google AI Studio (Gemini)",
    hint: "generativelanguage.googleapis.com · Nano Banana",
  },
};

/**
 * Image config from messaging_settings(id='ai_image').
 *
 * Keys are stored per provider (config.keys.openai / config.keys.gemini) so
 * switching provider in the admin UI doesn't require re-pasting the other key.
 * `config.apiKey` is still honoured for rows saved before that change.
 *
 * Falls back to the chat advisor's row (id='ai') for its KEY ONLY when no image
 * row exists, so an OpenAI-backed advisor gives you working images out of the box.
 */
export async function loadImageConfig(): Promise<ImageConfig> {
  const fallback: ImageConfig = {
    provider: "openai",
    enabled: false,
    apiKey: "",
    baseUrl: IMAGE_PRESETS.openai.baseUrl,
    model: IMAGE_PRESETS.openai.model,
  };

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return fallback;

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("messaging_settings")
      .select("id, provider, enabled, config")
      .in("id", ["ai_image", "ai"]);

    const rows = (data ?? []) as {
      id: string;
      provider: string | null;
      enabled: boolean;
      config: Record<string, unknown> | null;
    }[];
    const image = rows.find((r) => r.id === "ai_image");
    const chat = rows.find((r) => r.id === "ai");

    const imgCfg = (image?.config ?? {}) as {
      apiKey?: string;
      baseUrl?: string;
      model?: string;
      keys?: Record<string, string>;
    };
    const provider: ImageProvider = image?.provider === "gemini" ? "gemini" : "openai";
    const imageKey = imgCfg.keys?.[provider] || imgCfg.apiKey || "";

    if (image && imageKey) {
      return {
        provider,
        enabled: !!image.enabled,
        apiKey: imageKey,
        baseUrl: (imgCfg.baseUrl || IMAGE_PRESETS[provider].baseUrl).replace(/\/$/, ""),
        model: imgCfg.model || IMAGE_PRESETS[provider].model,
      };
    }

    // No image row — borrow the chat row's key. Its MODEL is a chat model
    // (gpt-4.1-mini, claude-…) which /images/generations rejects outright, so
    // take the key only and use the default image model.
    const chatCfg = (chat?.config ?? {}) as { apiKey?: string };
    const chatKey = chatCfg.apiKey || "";
    if (chat?.provider === "openai" && chatKey) {
      return { ...fallback, enabled: true, apiKey: chatKey };
    }
    return fallback;
  } catch (err) {
    console.error("loadImageConfig: DB read failed:", (err as Error).message);
    return fallback;
  }
}

export type ImageResult =
  | { ok: true; b64: string; url: string; mime: string; error: "" }
  | { ok: false; b64: ""; url: ""; mime: ""; error: string };

/**
 * A reference image the model should draw FROM — the owner's own face so the
 * person in the picture looks like them, or their own logo so the branding is
 * theirs. Gemini takes these natively as extra parts; OpenAI's
 * /images/generations has no reference slot and simply ignores them.
 */
export type ImageRef = { b64: string; mime: string };

const REQUEST_TIMEOUT_MS = 90_000; // image models are slow; well above chat's 30s

const fail = (error: string): ImageResult => ({
  ok: false,
  b64: "",
  url: "",
  mime: "",
  error,
});

/** OpenAI takes pixel sizes; Gemini takes an aspect ratio. */
function aspectFor(size: string | undefined): string {
  if (!size) return "1:1";
  const [w, h] = size.split("x").map(Number);
  if (!w || !h || w === h) return "1:1";
  return w > h ? "16:9" : "3:4";
}

async function readError(r: Response): Promise<string> {
  const txt = await r.text();
  try {
    const j = JSON.parse(txt) as { error?: { message?: string } };
    if (j.error?.message) return `Image API ${r.status}: ${j.error.message}`;
  } catch {
    /* not JSON — fall through to the raw snippet */
  }
  return `Image API ${r.status}: ${txt.slice(0, 300)}`;
}

/**
 * Generate one image.
 *
 * Returns base64 plus its mime type (Gemini returns JPEG or PNG depending on
 * model, so callers must not assume PNG), or a URL for dall-e-3, which is the
 * only model that still hands back a link instead of bytes.
 */
export async function generateImage(
  cfg: ImageConfig,
  prompt: string,
  opts?: { model?: string; size?: string; refs?: ImageRef[]; hiRes?: boolean },
): Promise<ImageResult> {
  if (!cfg.apiKey) return fail("The image provider isn't configured yet.");

  const base = cfg.baseUrl.replace(/\/$/, "");
  const model = (opts?.model || cfg.model).trim();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    if (cfg.provider === "gemini") {
      const r = await fetch(`${base}/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": cfg.apiKey },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                // Reference images go BEFORE the instruction so the model reads
                // them as the subject the prompt then talks about.
                ...(opts?.refs ?? []).map((ref) => ({
                  inlineData: { mimeType: ref.mime, data: ref.b64 },
                })),
                { text: prompt },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ["IMAGE"],
            imageConfig: {
              aspectRatio: aspectFor(opts?.size),
              // Default output is ~850px on the short edge, which is fine on a
              // screen but too soft to print. "2K" measures 1696x2528 at 2:3 —
              // A4 at roughly 200 DPI, so a printed poster still looks sharp.
              ...(opts?.hiRes ? { imageSize: "2K" } : {}),
            },
          },
        }),
        signal: controller.signal,
      });
      if (!r.ok) return fail(await readError(r));

      const j = (await r.json()) as {
        candidates?: {
          content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] };
        }[];
      };
      const part = (j.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData?.data);
      if (!part?.inlineData?.data) return fail("No image was returned.");
      return {
        ok: true,
        b64: part.inlineData.data,
        url: "",
        mime: part.inlineData.mimeType || "image/png",
        error: "",
      };
    }

    // OpenAI-compatible.
    const body: Record<string, unknown> = { model, prompt, n: 1 };
    if (opts?.size) body.size = opts.size;
    // dall-e-* needs an explicit response_format to return base64; the
    // gpt-image-* models always return b64_json and REJECT the parameter, so it
    // must only be sent for the legacy family.
    if (/^dall-e/i.test(model)) body.response_format = "b64_json";

    const r = await fetch(`${base}/images/generations`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!r.ok) return fail(await readError(r));

    const j = (await r.json()) as { data?: { url?: string; b64_json?: string }[] };
    const first = j.data?.[0];
    if (!first?.b64_json && !first?.url) return fail("No image was returned.");
    return {
      ok: true,
      b64: first.b64_json || "",
      url: first.url || "",
      mime: "image/png",
      error: "",
    };
  } catch (e) {
    const err = e as Error;
    return fail(
      err.name === "AbortError"
        ? "The image provider took too long to respond. Try a simpler prompt."
        : err.message,
    );
  } finally {
    clearTimeout(timer);
  }
}
