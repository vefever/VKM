import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadAiConfig } from "@/lib/vkm/ai-provider";

// Server-side text-to-speech for the admin voice test. The chat gateway can't
// produce audio, so natural Telugu comes from a dedicated TTS provider. Supports
// Microsoft Azure, Google Cloud TTS, and an OpenAI-compatible /audio/speech
// endpoint (e.g. the Abhibots gateway). Super-admin only. Returns base64 audio
// the browser plays via an <audio> element — no key ever reaches the client.

export type TtsProvider = "azure" | "google" | "openai";

function toBase64(buf: ArrayBuffer): string {
  // nodejs_compat gives us Buffer on the Worker; fall back to manual encode.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (globalThis as any).Buffer.from(buf).toString("base64");
  } catch {
    let bin = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const ttsSynthesize = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: {
    text: string;
    provider: TtsProvider;
    apiKey?: string;
    region?: string;   // azure
    voice?: string;
    baseUrl?: string;  // openai-compatible
    model?: string;    // openai-compatible / google model tier
  }) => input)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (!isAdmin) throw new Error("Forbidden: super admins only");

    const text = (data.text || "").slice(0, 2000).trim();
    if (!text) return { ok: false as const, error: "Nothing to speak.", audioBase64: "", mime: "" };
    const key = (data.apiKey || "").trim();
    if (!key && data.provider !== "openai") {
      return { ok: false as const, error: "Paste the provider API key first.", audioBase64: "", mime: "" };
    }

    try {
      if (data.provider === "azure") {
        const region = (data.region || "").trim();
        if (!region) return { ok: false as const, error: "Azure needs a region (e.g. centralindia).", audioBase64: "", mime: "" };
        const voice = data.voice || "te-IN-ShrutiNeural";
        const ssml =
          `<speak version='1.0' xml:lang='te-IN'><voice xml:lang='te-IN' name='${esc(voice)}'>${esc(text)}</voice></speak>`;
        const r = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
          method: "POST",
          headers: {
            "Ocp-Apim-Subscription-Key": key,
            "Content-Type": "application/ssml+xml",
            "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
            "User-Agent": "vkm-voice-test",
          },
          body: ssml,
        });
        if (!r.ok) return { ok: false as const, error: `Azure TTS: ${(await r.text()).slice(0, 200)}`, audioBase64: "", mime: "" };
        return { ok: true as const, error: "", audioBase64: toBase64(await r.arrayBuffer()), mime: "audio/mpeg" };
      }

      if (data.provider === "google") {
        const voice = data.voice || "te-IN-Standard-A";
        const r = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(key)}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            input: { text },
            voice: { languageCode: "te-IN", name: voice },
            audioConfig: { audioEncoding: "MP3" },
          }),
        });
        const j = (await r.json().catch(() => ({}))) as { audioContent?: string; error?: { message?: string } };
        if (!r.ok || !j.audioContent) {
          return { ok: false as const, error: `Google TTS: ${j.error?.message || r.status}`, audioBase64: "", mime: "" };
        }
        return { ok: true as const, error: "", audioBase64: j.audioContent, mime: "audio/mpeg" };
      }

      // openai-compatible (/audio/speech) — e.g. Abhibots gateway or OpenAI.
      const cfg = await loadAiConfig();
      const baseUrl = (data.baseUrl || cfg.baseUrl || "").replace(/\/$/, "");
      const apiKey = key || cfg.apiKey;
      if (!baseUrl || !apiKey) return { ok: false as const, error: "No base URL / API key for the speech endpoint.", audioBase64: "", mime: "" };
      const r = await fetch(`${baseUrl}/audio/speech`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}`, "x-api-key": apiKey },
        body: JSON.stringify({ model: data.model || "tts-1", voice: data.voice || "alloy", input: text }),
      });
      if (!r.ok) return { ok: false as const, error: `Speech endpoint: ${(await r.text()).slice(0, 200)}`, audioBase64: "", mime: "" };
      return { ok: true as const, error: "", audioBase64: toBase64(await r.arrayBuffer()), mime: r.headers.get("content-type") || "audio/mpeg" };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message, audioBase64: "", mime: "" };
    }
  });
