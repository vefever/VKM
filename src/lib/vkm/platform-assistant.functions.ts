import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadAiConfig, streamAi, type ChatMsg } from "@/lib/vkm/ai-provider";

export type { ChatMsg };

// Hard caps — same rationale as the Business Advisor: a client can't drive up
// provider cost/memory with a huge payload. History is kept shorter than the
// Advisor's (4 turns, not 12) since this is quick wayfinding help, not a
// multi-message coaching conversation — and every extra input token measurably
// slows the reply (see MAX_TOKENS comment below).
const MAX_MESSAGES = 20;
const MAX_CONTENT = 1000;
const HISTORY_TURNS = 4;

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

const NOT_ACTIVATED =
  "⚙️ The AI Assistant isn't activated yet.\n\nAsk your VKM admin to configure a provider in **Admin → AI Configurations**.";

// Kept deliberately terse: the gateway's time-to-first-token scales with
// prompt size, and a verbose system prompt (~2.8k chars) measured 20s+ /
// occasionally never returning, while a short one (~600 chars) reliably
// replies in a few seconds. Every word here costs real latency — favor a
// compact factual index over prose.
const NAV_BY_ROLE: Record<string, string> = {
  participant:
    "Nav: Dashboard(/participant, points/week/streak/habits), Calendar, Program Progress(16-wk plan+proof status), Daily Habits(6 tasks: Walking/Water/Meditation/Affirmation/Gratitude/To-Do), Submit Proof(weekly proof upload), My Business(profile+monthly numbers), AI Business Advisor(SEPARATE tool for revenue/strategy — redirect business Qs there), Vision Board, Coach Chat(msg real coach), Community(directory), Leaderboard, Milestones, Certificates, Profile, Support(tickets). Alumni/past-batch see only Community/Business/Support/Settings.",
  coach:
    "Nav: Dashboard, Proof Reviews(approve/reject weekly+habit proofs), Chat, Coach Calendar, Cohort Overview, My Participants(assigned roster, grid/list, at-risk filter), Habits & Activity(per-participant drilldown+export), Coach Performance, Profile. Roster = direct assignment, not just shared batch.",
  mentor:
    "Nav (org-wide): Dashboard, AI Insights, Analytics, Programs/Batches mgmt, Live Classes, Zoom, Cohort Overview, Coaches, Participants, Coach/Participant Performance, Content upload, Assignments, Announcements, Chat, Community, Leaderboards, Graduation Approval, Certificates, Reports, Support, Settings. Mentors review any proof/ticket platform-wide.",
  super_admin:
    "Nav: System Overview, Analytics(live KPIs+realtime feed), Reports(1:1/batch/coach/mentor, export), User Mgmt, Security, Programs/Batches/LMS/Storage, Payments/Invoices, Email/WhatsApp/SMS/Push settings, AI Configurations(model picker), Workflow & Automation(scheduled reminders), Branding, PWA, SEO & Analytics, Support, Settings, plus VK Operations (admissions, batch allocation, alumni, campaigns, etc).",
};

const CORE_CONCEPTS =
  "16-week program (Foundation→Systems→Sell→Review), tracked from each participant's own start date. 6 daily habits; all 6=completed day. Points from a real ledger (habits, approved proofs, milestones, bonuses) — same source everywhere. 'At risk' = 3+ weeks in, behind on approved proofs. Weekly proof needs coach/mentor approval. Support tickets = account/technical issues.";

function systemPromptFor(roles: string[]): string {
  const uniqueRoles = [...new Set(roles.length ? roles : ["participant"])];
  const navSections = uniqueRoles.map((r) => NAV_BY_ROLE[r]).filter(Boolean).join(" ");
  return `You are VK Mentorship's "AI Assistant" — you explain HOW TO USE this platform (where things are, what pages do). Not the Business Advisor (redirect business/revenue questions there). Be concise (2-4 sentences or a short list), warm, specific — name real pages. If unsure, say so.
${CORE_CONCEPTS}
Role(s): ${uniqueRoles.join(", ")}. ${navSections}`;
}

// ---------------------------------------------------------------------------
// Streaming platform-help assistant. Ephemeral by design (no server-side
// conversation log — this is quick wayfinding help, not a coaching record).
// ---------------------------------------------------------------------------
export const askPlatformAssistantStream = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(validateMessages)
  .handler(async ({ data, context }) => {
    const headers = {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    };

    const cfg = await loadAiConfig();
    if (!cfg.enabled || !cfg.apiKey) {
      return new Response(NOT_ACTIVATED, { headers });
    }

    const { data: roleRows } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const roles = (roleRows ?? []).map((r) => r.role as string);

    const system = systemPromptFor(roles);
    const recent = data.messages
      .slice(-HISTORY_TURNS)
      .map((m) => ({ role: m.role, content: m.content }));
    // Cap output tokens well below the shared Advisor config (which some
    // admins set high for detailed coaching replies) — this assistant's
    // answers are meant to be short, and a smaller cap keeps generation fast.
    const fastCfg = { ...cfg, maxTokens: Math.min(cfg.maxTokens, 350) };
    const stream = streamAi(fastCfg, system, recent, {}, { temperature: 0.4 });

    return new Response(stream, { headers });
  });
