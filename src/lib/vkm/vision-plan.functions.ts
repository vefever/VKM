import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadAiConfig, callAi } from "@/lib/vkm/ai-provider";
import { buildBrainContext } from "@/lib/vkm/business-context";

// The Vision Board's five pillars. Kept in lockstep with PILLARS in
// vision-data.ts — a goal whose category isn't one of these can't be saved.
export const PLAN_PILLARS = [
  "Revenue & Profit",
  "Team & Culture",
  "Product & Operations",
  "Brand & Market",
  "Personal & Lifestyle",
] as const;

export type PlanGoal = {
  title: string;
  category: (typeof PLAN_PILLARS)[number];
  target_value: number | null;
  unit: string | null;
  why: string | null;
};

export type VisionPlan = { statement: string; goals: PlanGoal[] };

// Venu's voice and method, narrowed to this one job. Deliberately NOT the full
// advisor persona: this endpoint returns JSON, not coaching prose, so the
// conversational rhythm would only bloat the prompt and tempt the model into
// writing an essay around the JSON.
const SYSTEM = `You are Venu Kalyan, a Business Growth Strategist for SME owners in Andhra Pradesh and Telangana.

The owner has written their #1 goal for the year. Turn it into a realistic 1-year roadmap for THEIR business, using the real numbers in their business context below.

Method:
- Work backwards from their #1 goal to what has to be true this year.
- Growth = more leads + better conversion. Also consider team, systems, retention and margin — not just revenue.
- Ground every number in their CURRENT numbers. If they do Rs 8L/month today, a Rs 25 Cr year is not one step — say what this year's realistic step is.
- Prefer goals the owner can actually measure weekly.

LANGUAGE: English by default, but you may use natural Tenglish (Telugu written in English letters) the way Telugu SME owners speak. NEVER output Telugu script — English letters only.

Return ONLY a JSON object, no markdown fence, no commentary:
{
  "statement": "One or two sentences completing 'By the end of <year>, my business will…'. Concrete and specific to them.",
  "goals": [
    {
      "title": "Short, measurable goal",
      "category": "one of: Revenue & Profit | Team & Culture | Product & Operations | Brand & Market | Personal & Lifestyle",
      "target_value": 10,
      "unit": "Rs lakh / month",
      "why": "One line: why this goal matters for their #1 goal."
    }
  ]
}

Rules: 3 to 5 goals. Cover at least three different categories. target_value must be a plain number (no commas, no currency symbol) or null. Keep every title under 70 characters.`;

/** Strip a ```json fence if the model adds one despite being told not to. */
function extractJson(raw: string): string {
  const t = raw.trim();
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  // Otherwise take the outermost object, in case of stray prose either side.
  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  return a >= 0 && b > a ? t.slice(a, b + 1) : t;
}

/** A number the DB will accept: finite, non-negative, or null. */
function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

const str = (v: unknown, max: number): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

/**
 * Coerce the model's JSON into something the Vision Board can actually save.
 * Anything malformed is dropped rather than surfaced — a goal with an invalid
 * category would fail the insert, and half a plan is worse than a clear error.
 */
function parsePlan(raw: string): VisionPlan | null {
  let j: unknown;
  try {
    j = JSON.parse(extractJson(raw));
  } catch {
    return null;
  }
  const o = j as { statement?: unknown; goals?: unknown };
  const statement = str(o.statement, 600);
  const goals: PlanGoal[] = [];
  for (const g of Array.isArray(o.goals) ? o.goals : []) {
    const row = g as Record<string, unknown>;
    const title = str(row.title, 120);
    const category = PLAN_PILLARS.find((p) => p === str(row.category, 60));
    if (!title || !category) continue;
    goals.push({
      title,
      category,
      target_value: num(row.target_value),
      unit: str(row.unit, 30) || null,
      why: str(row.why, 300) || null,
    });
    if (goals.length === 5) break;
  }
  if (!statement && !goals.length) return null;
  return { statement, goals };
}

/**
 * Draft a 1-year roadmap from the owner's #1 goal.
 *
 * Uses the same configured provider and the same business grounding as the AI
 * Advisor, so the plan reflects their real revenue, leads and team rather than
 * generic advice. Returns a proposal only — nothing is written to the Vision
 * Board until the owner applies it.
 */
export const generateVisionPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { headline?: string; year?: number }) => ({
    headline: String(input?.headline ?? "")
      .slice(0, 200)
      .trim(),
    year: Number(input?.year) || new Date().getFullYear() + 1,
  }))
  .handler(async ({ data, context }) => {
    const fail = (error: string) => ({ ok: false as const, plan: null, error });

    if (!data.headline) {
      return fail(
        "Write your #1 goal for this year first — then I'll build the roadmap around it.",
      );
    }

    const cfg = await loadAiConfig();
    if (!cfg.enabled || !cfg.apiKey) {
      return fail(
        "The AI isn't switched on yet. Ask your VKM admin to configure a provider in Admin -> AI Configurations.",
      );
    }

    const [{ data: brain }, { data: snaps }, { data: prof }, { data: vision }] = await Promise.all([
      context.supabase
        .from("business_brains")
        .select("*")
        .eq("user_id", context.userId)
        .maybeSingle(),
      context.supabase
        .from("business_snapshots")
        .select(
          "month, revenue_inr, mrr_inr, leads, deals, pipeline_inr, avg_deal_inr, closing_rate_pct, followup_pct, nps",
        )
        .eq("user_id", context.userId)
        .order("month", { ascending: false })
        .limit(6),
      context.supabase.from("profiles").select("full_name").eq("id", context.userId).maybeSingle(),
      context.supabase
        .from("vision_statements")
        .select("statement, target_revenue_inr, target_team_size, lifestyle_goal")
        .eq("user_id", context.userId)
        .maybeSingle(),
    ]);

    const businessContext = buildBrainContext(brain, snaps ?? [], {
      ownerName: (prof?.full_name as string | null) ?? null,
    });

    // The 5-year picture is the direction this year's step should point in.
    const longRange = [
      vision?.statement ? `Their 5-year vision: ${vision.statement}` : "",
      vision?.target_revenue_inr ? `5-year revenue target: ${vision.target_revenue_inr} INR` : "",
      vision?.target_team_size ? `5-year team target: ${vision.target_team_size} people` : "",
      vision?.lifestyle_goal ? `Lifestyle they want: ${vision.lifestyle_goal}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const system = [SYSTEM, businessContext, longRange].filter(Boolean).join("\n\n");
    const user = `My #1 goal for ${data.year} is: "${data.headline}"\n\nBuild my 1-year roadmap.`;

    // The advisor's cap is tuned for short chat replies (512 by default). A
    // statement plus five goals with reasons doesn't fit in that, and a
    // truncated response is invalid JSON — the whole plan would be lost. Raise
    // the ceiling for this call only; the saved config is untouched.
    const planCfg = { ...cfg, maxTokens: Math.max(cfg.maxTokens, 1400) };

    try {
      const r = await callAi(planCfg, system, [{ role: "user", content: user }]);
      if (!r.ok) {
        console.error(`generateVisionPlan provider error ${r.status}:`, r.error);
        return fail(
          r.status === 429 || r.status >= 500
            ? "The AI service is busy right now — please try again in a moment."
            : `The AI hit a provider error (${r.status}). Ask your admin to check the API key and model.`,
        );
      }
      const plan = parsePlan(r.content || "");
      if (!plan) return fail("The AI didn't return a usable plan. Please try again.");
      return { ok: true as const, plan, error: "" };
    } catch (e) {
      console.error("generateVisionPlan failed:", (e as Error).message);
      return fail("Couldn't reach the AI right now. Please try again in a moment.");
    }
  });
