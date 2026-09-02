import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateImage, loadImageConfig } from "@/lib/vkm/image-provider";

// Admin image-generation test: sends a prompt to the configured image provider
// and returns the generated image. Super-admin only; the API key never leaves
// the server. Shares the provider layer with the participants' Vision Board, so
// a green test here means the Vision Board works too.
export const generateTestImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { prompt?: string; model?: string; size?: string }) => ({
    prompt: String(input?.prompt ?? "")
      .slice(0, 1000)
      .trim(),
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

    const cfg = await loadImageConfig();
    if (!cfg.apiKey) {
      return {
        ok: false as const,
        error: "No image provider configured — set one above and save first.",
        url: "",
        b64: "",
      };
    }

    const r = await generateImage(cfg, data.prompt, { model: data.model, size: data.size });
    if (!r.ok) return { ok: false as const, error: r.error, url: "", b64: "" };
    return { ok: true as const, error: "", url: r.url, b64: r.b64 };
  });
