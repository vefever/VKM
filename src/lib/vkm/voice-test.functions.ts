import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadAiConfig, callAi } from "@/lib/vkm/ai-provider";

// Admin voice-test brain: takes the admin's message and asks the SAME configured
// AI gateway to reply in natural, spoken-style Telugu. The audio itself is
// produced in the browser (Web Speech synthesis) — the gateway is chat-only and
// can't return audio. Super-admin only.
export const aiVoiceReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { text?: string }) => ({ text: String(input?.text ?? "").slice(0, 800) }))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (!isAdmin) throw new Error("Forbidden: super admins only");

    const cfg = await loadAiConfig();
    if (!cfg.enabled || !cfg.apiKey) {
      return { ok: false, error: "AI provider isn't configured — set it up above first.", text: "" };
    }

    const system =
      "You are a warm, friendly Telugu-speaking assistant for VK Mentorship. Reply in natural, " +
      "conversational, spoken-style Telugu (Telugu script) — the way a real person actually talks, " +
      "warm and clear, 2–4 short sentences. If the user writes in Tenglish (Telugu written in English " +
      "letters), you may reply in Tenglish. Keep it simple and human; avoid formal/bookish phrasing.";
    const prompt = data.text || "నమస్తే! కొంచెం నా గురించి మాట్లాడు.";

    const r = await callAi(cfg, system, [{ role: "user", content: prompt }], { temperature: 0.6 });
    if (!r.ok) return { ok: false, error: r.error || "AI request failed.", text: "" };
    return { ok: true, error: "", text: r.content };
  });
