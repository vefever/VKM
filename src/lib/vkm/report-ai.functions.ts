import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadAiConfig, streamAi } from "@/lib/vkm/ai-provider";

// Generates a clear, written narrative report from a report's raw data. The
// admin/mentor loads the report on screen, then asks the AI to turn the numbers
// into an executive summary with strengths, concerns and recommendations. The
// response streams so the report appears progressively.

export type ReportKind = "individual" | "batch" | "coach" | "mentor";

const NOT_ACTIVATED =
  "The AI report feature isn't activated yet. Ask a Super Admin to configure a provider in Admin → AI Configurations.";

const KIND_FOCUS: Record<ReportKind, string> = {
  individual:
    "a single participant. Cover their program progress (weeks approved vs current week, proof approval rate), daily-habit consistency (completion %, current streak, days active), engagement (points, focus minutes, meetings, last active), their business snapshot if present, milestones earned, and whether they are on track or at risk.",
  batch:
    "an entire batch (cohort). Cover overall completion, points, how many are at risk vs thriving, alumni, coach coverage (unassigned participants are a red flag), the top performers, and the trend over the period.",
  coach:
    "a coach's delivery and their participants' outcomes. Cover their review volume, approval rate and turnaround speed, coaching notes and meetings, how many of their participants are at risk, and how their caseload is doing on daily habits.",
  mentor:
    "a mentor's oversight activity. Cover proofs reviewed / approved / rejected, meetings hosted, tickets resolved, and the review trend over the period.",
};

function validate(input: { kind: ReportKind; title: string; from: string; to: string; data: unknown }) {
  const kind = (["individual", "batch", "coach", "mentor"] as const).includes(input?.kind)
    ? input.kind
    : "individual";
  // Cap the serialized data so a client can't drive up provider cost/latency.
  let dataJson = "";
  try {
    dataJson = JSON.stringify(input?.data ?? {}).slice(0, 8000);
  } catch {
    dataJson = "{}";
  }
  return {
    kind,
    title: String(input?.title ?? "").slice(0, 200),
    from: String(input?.from ?? "").slice(0, 20),
    to: String(input?.to ?? "").slice(0, 20),
    dataJson,
  };
}

export const generateReportNarrativeStream = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(validate)
  .handler(async ({ data, context }) => {
    const headers = {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    };

    // Guard: super admin or mentor only (same as the report RPCs).
    const { data: roleRows } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const roles = (roleRows ?? []).map((r) => r.role as string);
    if (!roles.includes("super_admin") && !roles.includes("mentor")) {
      return new Response("Forbidden: staff only.", { headers, status: 403 });
    }

    const cfg = await loadAiConfig();
    if (!cfg.enabled || !cfg.apiKey) {
      return new Response(NOT_ACTIVATED, { headers });
    }

    const system = `You are a senior analyst at VK Mentorship, a 16-week business-coaching program (6 daily habits; weekly proofs need coach approval; "at risk" = 3+ weeks in and behind on approved proofs; points come from a real ledger). You write clear, honest, decision-ready reports for staff from raw JSON data.

Rules:
- Write in GitHub-flavoured Markdown. Start with a one-line "## Summary" (2–3 sentences).
- Then "### Highlights" (bullets of what's going well) and "### Concerns" (bullets of risks / gaps — say "None material" if truly none).
- Then "### Recommended actions" — 2–4 concrete, specific next steps a staff member can take.
- Cite the actual numbers from the data (e.g. "72% habit completion", "3 weeks behind"). Never invent data not present. If a value is null/0/empty, treat it as unknown or none, not a failure to hide.
- Be concise and specific — no filler, no restating the whole JSON. ~200–350 words total.`;

    const user = `Write a report about ${KIND_FOCUS[data.kind]}

Report: "${data.title}"
Date range: ${data.from} → ${data.to}

Raw data (JSON):
${data.dataJson}`;

    // Reports need more room than the quick chat assistant — raise the cap.
    const reportCfg = { ...cfg, maxTokens: Math.max(cfg.maxTokens, 2000) };
    const stream = streamAi(reportCfg, system, [{ role: "user", content: user }], {}, { temperature: 0.3 });
    return new Response(stream, { headers });
  });
