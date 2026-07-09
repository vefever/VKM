import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadAiConfig } from "@/lib/vkm/ai-provider";

// Admin image-generation test: sends a prompt to the AI gateway's
// /images/generations endpoint (OpenAI shape) and returns the generated image
// URL (or base64). Super-admin only; the API key never leaves the server.
export const generateTestImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { prompt?: string; model?: string; size?: string }) => ({
    prompt: String(input?.prompt ?? "").slice(0, 1000).trim(),
    model: input?.model ? String(input.model).slice(0, 100).trim() : "",
    size: input?.size || "1024x1024",
  }))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (!isAdmin) throw new Error("Forbidden: super admins only");
    if (!data.prompt) return { ok: false as const, error: "Enter a prompt.", url: "", b64: "" };

    const cfg = await loadAiConfig();
    if (!cfg.apiKey) return { ok: false as const, error: "AI provider isn't configured yet.", url: "", b64: "" };
    const base = cfg.baseUrl.replace(/\/$/, "");

    try {
      const r = await fetch(`${base}/images/generations`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}`, "x-api-key": cfg.apiKey },
        body: JSON.stringify({ model: data.model || cfg.model, prompt: data.prompt, n: 1, size: data.size }),
      });
      const txt = await r.text();
      if (!r.ok) return { ok: false as const, error: `Image API: ${txt.slice(0, 220)}`, url: "", b64: "" };
      let j: { data?: { url?: string; b64_json?: string }[]; credits?: { balance?: number } } = {};
      try {
        j = JSON.parse(txt);
      } catch {
        return { ok: false as const, error: "Unexpected response from the image API.", url: "", b64: "" };
      }
      const first = j.data?.[0];
      if (!first?.url && !first?.b64_json) return { ok: false as const, error: "No image was returned.", url: "", b64: "" };
      return {
        ok: true as const,
        error: "",
        url: first.url || "",
        b64: first.b64_json || "",
        balance: typeof j.credits?.balance === "number" ? j.credits.balance : null,
      };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message, url: "", b64: "" };
    }
  });
