import {
  Plus, Download, Upload, Send, Check, ArrowUpRight, CalendarPlus, FileDown,
  Trophy, type LucideIcon,
} from "lucide-react";
import { PARTICIPANT_NAV, COACH_NAV, MENTOR_NAV, ADMIN_NAV, type NavGroup } from "./nav-config";
import type {
  PageConfig, Kpi, TabSpec, FeedItem, TableRowData, TableCol, ListItem,
} from "./wireframe-page";
import {
  VKM_PROGRAM, VKM_WEEKS, VKM_POINT_RULES, VKM_STAGES, VKM_MILESTONES,
  VKM_ONBOARDING, VKM_COACH_PLAYBOOK, VKM_VK_CLASS_FORMAT, VKM_AI_ADVISOR,
  weekByNumber, isOfflineWeek,
} from "@/lib/vkm/program";
import { currentWeekNo } from "@/components/coach/coach-data";

// ---------- Nav lookup ----------
const ALL_NAV: NavGroup[] = [...PARTICIPANT_NAV, ...COACH_NAV, ...MENTOR_NAV, ...ADMIN_NAV];
function findNavEntry(path: string) {
  for (const g of ALL_NAV) for (const it of g.items) if (it.to === path) return { item: it, group: g };
  return null;
}
function eyebrowFor(path: string) {
  if (path.startsWith("/participant")) return "Participant";
  if (path.startsWith("/coach")) return "Coach";
  if (path.startsWith("/mentor")) return "Mentor · VK";
  if (path.startsWith("/admin/vk-ops")) return "VK Operations";
  if (path.startsWith("/admin")) return "Super Admin";
  return "VKM";
}

// ---------- Sample VKM cohort data ----------
const CURRENT_WEEK = currentWeekNo(); // demo "today"
const COHORT = [
  { name: "Suresh Reddy", business: "Sri Sai Traders", city: "Hyderabad", weeks: 6, points: 320, stage: "Builder", risk: "On Track" },
  { name: "Anitha Rao", business: "Anitha Designs", city: "Bengaluru", weeks: 7, points: 410, stage: "Operator", risk: "On Track" },
  { name: "Mahesh K", business: "MK Auto Spares", city: "Chennai", weeks: 5, points: 250, stage: "Starter", risk: "On Track" },
  { name: "Ravi Teja", business: "Teja Constructions", city: "Vijayawada", weeks: 6, points: 300, stage: "Builder", risk: "On Track" },
  { name: "Lakshmi N", business: "Lakshmi Sarees", city: "Hyderabad", weeks: 7, points: 360, stage: "Builder", risk: "On Track" },
  { name: "Imran S", business: "Imran Imports", city: "Mumbai", weeks: 5, points: 150, stage: "Starter", risk: "At Risk" },
];
const BATCHES = ["Batch 14", "Batch 15", "Batch 16", "Batch 17"];
const CURRENT_BATCH = "Batch 16";

const COACHES = [
  { name: "Soumya R", role: "Lead Coach", batches: "Batch 16, 17", participants: 12 },
  { name: "Karthik V", role: "Growth Coach", batches: "Batch 15", participants: 8 },
  { name: "Pooja M", role: "Growth Coach", batches: "Batch 16", participants: 6 },
];

// ---------- Feed (real VKM events) ----------
const VKM_FEED: FeedItem[] = [
  { who: "Suresh Reddy", what: "submitted Week 7 proof: CRM live with 240 leads", when: "12m ago", tag: "Proof" },
  { who: "Coach Soumya", what: "approved Anitha Rao's Week 6 GAM minutes", when: "1h ago", tag: "Approved" },
  { who: "Mahesh K", what: "completed daily OMM — 14-day streak", when: "2h ago", tag: "OMM" },
  { who: "VK", what: "posted Tuesday class theme: 'Never lose a lead again'", when: "Yesterday", tag: "Class" },
  { who: "Ravi Teja", what: "unlocked Goal Setter milestone (Wk 3)", when: "Yesterday", tag: "Milestone" },
  { who: "Imran S", what: "missed Week 6 task — coach following up today", when: "2d ago", tag: "At Risk" },
];

// ---------- Builders ----------
function tableTab(id: string, label: string, columns: TableCol[], rows: TableRowData[]): TabSpec {
  return { id, label, kind: "table", columns, rows };
}
function listTab(id: string, label: string, items: ListItem[]): TabSpec {
  return { id, label, kind: "list", items };
}
function gridTab(id: string, label: string, items: ListItem[]): TabSpec {
  return { id, label, kind: "grid", items };
}
function chartTab(id: string, label: string, bars: { label: string; value: number }[]): TabSpec {
  return { id, label, kind: "chart", bars };
}
function formTab(id: string, label: string, fields: { label: string; type?: string; placeholder?: string }[]): TabSpec {
  return { id, label, kind: "form", fields };
}
function feedTab(id: string, label: string, items: FeedItem[]): TabSpec {
  return { id, label, kind: "feed", items };
}

// ---------- Reusable VKM tabs ----------
function curriculumTab(): TabSpec {
  return tableTab("curriculum", "16-Week Curriculum",
    [
      { key: "week", label: "Wk" },
      { key: "phase", label: "Phase" },
      { key: "topic", label: "Topic" },
      { key: "mode", label: "Mode" },
      { key: "task", label: "Task" },
      { key: "proof", label: "Proof" },
    ],
    VKM_WEEKS.map(w => ({
      week: `Wk ${w.week}`,
      phase: w.phase,
      topic: w.topic,
      mode: w.mode,
      task: w.task,
      proof: w.proof,
    })),
  );
}
function weeksAsListTab(label = "Weekly Plan"): TabSpec {
  return listTab("weeks", label, VKM_WEEKS.map(w => ({
    title: `Week ${w.week} · ${w.topic}`,
    meta: `${w.phase} · ${w.mode} · ${w.task}`,
    badge: w.mode,
    progress: w.week < CURRENT_WEEK ? 100 : w.week === CURRENT_WEEK ? 60 : 0,
  })));
}
function pointsRulesTab(): TabSpec {
  return tableTab("points", "How Points Work",
    [{ key: "action", label: "Action" }, { key: "points", label: "Points" }],
    VKM_POINT_RULES.map(r => ({ action: r.action, points: r.points })),
  );
}
function stagesTab(): TabSpec {
  return tableTab("stages", "Growth Stages",
    [{ key: "stage", label: "Stage" }, { key: "from", label: "From" }, { key: "to", label: "To" }],
    VKM_STAGES.map(s => ({ stage: s.name, from: s.min, to: s.max ?? "+" })),
  );
}
function milestonesTab(): TabSpec {
  return listTab("milestones", "3 Milestones", VKM_MILESTONES.map(m => ({
    title: `${m.name} — unlocks Week ${m.unlockWeek}`,
    meta: `Reward kit (~₹${m.costInr.toLocaleString("en-IN")}) · ${m.items.join(" · ")}`,
    badge: m.unlockWeek <= CURRENT_WEEK ? "Unlocked" : "Locked",
    progress: m.unlockWeek <= CURRENT_WEEK ? 100 : 0,
  })));
}

const CURRENT = weekByNumber(CURRENT_WEEK)!;
const PARTICIPANT_KPIS: Kpi[] = [
  { label: "Weeks done", value: `${CURRENT_WEEK - 1} / 16`, accent: "navy" },
  { label: "Total points", value: "320", delta: "+40 this week", trend: "up", accent: "gold" },
  { label: "Current stage", value: "Builder", accent: "success" },
  { label: "Milestones", value: "1 / 3", delta: "Goal Setter unlocked", trend: "up", accent: "gold" },
];

// ---------- Path-keyed overrides ----------
type Build = (label: string) => Partial<PageConfig>;
const PATHS: Record<string, Build> = {

  // =========================== PARTICIPANT ===========================
  "/participant/focus": () => ({
    description: `This week is Week ${CURRENT.week} — ${CURRENT.topic} (${CURRENT.mode}). Focus on the task that earns +40 points.`,
    kpis: [
      { label: "This week", value: `Wk ${CURRENT.week} / 16`, accent: "navy" },
      { label: "Mode", value: CURRENT.mode, accent: CURRENT.mode === "Offline" ? "gold" : "navy" },
      { label: "Task points", value: "+40", accent: "success" },
      { label: "Streak", value: "12d OMM", trend: "up", accent: "gold" },
    ],
    tabs: [
      listTab("today", "Top 3 actions today", [
        { title: `Apply Week ${CURRENT.week} task — ${CURRENT.task}`, meta: `${CURRENT.phase} · Proof: ${CURRENT.proof}`, badge: "Today", progress: 50 },
        { title: "Run today's daily OMM (One Minute Manager)", meta: "Lifestyle · Week 1 habit · 1 min", badge: "Habit", progress: 100 },
        { title: "Update the Master Tracker", meta: "Attendance + this week's proof status", badge: "5 min", progress: 0 },
      ]),
      listTab("week", `This Week · ${CURRENT.topic}`, [
        { title: "Why it matters", meta: CURRENT.why, badge: "WHY" },
        { title: "What to do", meta: CURRENT.task, badge: "TASK" },
        { title: "How you prove it", meta: CURRENT.proof, badge: "PROOF" },
      ]),
    ],
    side: { title: "Cohort activity", feed: VKM_FEED.slice(0, 5) },
  }),

  "/participant/calendar": () => ({
    description: "Tuesday class with VK + your coach 1:1s + offline visits (Weeks 3, 4, 7, 8, 14, 15, 16).",
    actions: [{ label: "Sync to Google", icon: ArrowUpRight, variant: "outline" }],
    kpis: [
      { label: "Class days left", value: `${16 - CURRENT_WEEK + 1}`, accent: "navy" },
      { label: "Offline visits left", value: String(VKM_PROGRAM.offlineWeeks.filter(w => w >= CURRENT_WEEK).length), accent: "gold" },
      { label: "Graduation", value: "Wk 16", accent: "success" },
      { label: "Cadence", value: "Every Tue", accent: "navy" },
    ],
    tabs: [
      listTab("upcoming", "Upcoming", VKM_WEEKS.slice(CURRENT_WEEK - 1, CURRENT_WEEK + 3).map(w => ({
        title: `Tuesday Class — Week ${w.week}: ${w.topic}`,
        meta: `${w.phase} · ${w.mode}${isOfflineWeek(w.week) ? " · Coach visits in person" : ""}`,
        badge: w.mode,
      }))),
      listTab("all", "All 16 weeks", VKM_WEEKS.map(w => ({
        title: `Wk ${w.week} · ${w.topic}`,
        meta: `${w.phase} · ${w.mode}`,
        badge: isOfflineWeek(w.week) ? "Offline" : "Online",
      }))),
    ],
  }),

  "/participant/progress": () => ({
    description: "Your 4-month transformation — Foundation → Systems → Sell → Review.",
    kpis: PARTICIPANT_KPIS,
    tabs: [weeksAsListTab("Your 16-Week Journey"), curriculumTab()],
    side: { title: "Recent wins", feed: VKM_FEED.slice(0, 4) },
  }),

  "/participant/weekly-tasks": () => ({
    description: "Each week has one task + one proof. Complete it to earn +40 points.",
    tabs: [
      tableTab("tasks", "Weekly Tasks",
        [
          { key: "week", label: "Wk" },
          { key: "topic", label: "Topic" },
          { key: "task", label: "Task" },
          { key: "proof", label: "Proof" },
          { key: "status", label: "Status" },
        ],
        VKM_WEEKS.map(w => ({
          week: `Wk ${w.week}`,
          topic: w.topic,
          task: w.task,
          proof: w.proof,
          status: w.week < CURRENT_WEEK ? "Approved" : w.week === CURRENT_WEEK ? "Pending" : "Locked",
        })),
      ),
    ],
  }),

  "/participant/habits": () => ({
    description: "Week 1 habit — discipline & rhythm drive growth. Log your morning routine daily.",
    kpis: [
      { label: "OMM streak", value: "12d", trend: "up", accent: "gold" },
      { label: "Morning routine", value: "5/7", accent: "success" },
      { label: "Daily journal", value: "6/7", accent: "navy" },
      { label: "Habit score", value: "84", delta: "+6", trend: "up", accent: "success" },
    ],
    tabs: [chartTab("week", "Last 7 days", [
      { label: "Mon", value: 5 }, { label: "Tue", value: 7 }, { label: "Wed", value: 6 },
      { label: "Thu", value: 7 }, { label: "Fri", value: 6 }, { label: "Sat", value: 5 }, { label: "Sun", value: 4 },
    ])],
  }),

  "/participant/omm": () => ({
    description: "One Minute Manager — daily 1-min discipline tracker. Week 1's foundation habit.",
    actions: [{ label: "Log today", icon: Check }],
    kpis: [
      { label: "Days logged", value: "32", accent: "navy" },
      { label: "Current streak", value: "12d", accent: "gold" },
      { label: "Longest streak", value: "18d", accent: "success" },
      { label: "Goal", value: "90d", accent: "navy" },
    ],
    tabs: [listTab("recent", "Recent logs", Array.from({ length: 7 }, (_, i) => ({
      title: `Day ${32 - i}`,
      meta: ["Reviewed top 3", "Energy 8/10", "Pushed CRM setup", "Wins call done", "Sales call x10", "Team huddle", "Goal review"][i],
      badge: "✓",
    })))],
  }),

  "/participant/business": () => ({
    description: "Snapshot of your business — drives the monthly bonus points.",
    kpis: [
      { label: "MRR", value: "₹18.0L", delta: "+₹3L MoM", trend: "up", accent: "success" },
      { label: "Target MRR", value: "₹30L", accent: "gold" },
      { label: "Team size", value: "14", accent: "navy" },
      { label: "Closing rate", value: "22%", delta: "+4 pts", trend: "up", accent: "success" },
    ],
    tabs: [chartTab("trend", "Revenue trend (₹L)", [
      { label: "Mo 1", value: 18 }, { label: "Mo 2", value: 22 }, { label: "Mo 3", value: 27 }, { label: "Mo 4 (target)", value: 31 },
    ])],
  }),

  "/participant/revenue": () => ({
    description: "Revenue Up that month → +50 bonus points.",
    kpis: [
      { label: "This month", value: "₹22.4L", delta: "+24% MoM", trend: "up", accent: "success" },
      { label: "Bonus earned", value: "+50", accent: "gold" },
      { label: "vs target", value: "75%", accent: "navy" },
      { label: "Avg deal", value: "₹62k", trend: "up", accent: "success" },
    ],
    tabs: [chartTab("monthly", "Monthly revenue (₹L)", [
      { label: "Month 1", value: 18 }, { label: "Month 2", value: 22 }, { label: "Month 3", value: 27 }, { label: "Month 4", value: 31 },
    ])],
  }),

  "/participant/leads": () => ({
    description: "Leads Up that month → +30 bonus points.",
    kpis: [
      { label: "Leads this month", value: "186", delta: "+38 MoM", trend: "up", accent: "success" },
      { label: "Bonus earned", value: "+30", accent: "gold" },
      { label: "Lead sources", value: "3 live", accent: "navy" },
      { label: "CPL", value: "₹220", trend: "down", accent: "success" },
    ],
  }),

  "/participant/sales": () => ({
    description: "Sales steps + scripts (Week 12) and follow-up system (Week 14).",
    kpis: [
      { label: "Deals closed", value: "41", delta: "+12", trend: "up", accent: "success" },
      { label: "Pipeline", value: "₹38L", accent: "navy" },
      { label: "Script in use", value: "Yes", accent: "success" },
      { label: "Team trained", value: "4 / 4", accent: "gold" },
    ],
  }),

  "/participant/kpis": () => ({
    description: "Closing Rate Up that month → +30 bonus points.",
    kpis: [
      { label: "Closing rate", value: "22%", delta: "+4 pts", trend: "up", accent: "success" },
      { label: "Bonus earned", value: "+30", accent: "gold" },
      { label: "Follow-ups", value: "92%", accent: "navy" },
      { label: "NPS", value: "62", trend: "up", accent: "success" },
    ],
  }),

  "/participant/advisor": () => ({
    description: VKM_AI_ADVISOR.intro,
    actions: [{ label: "Open AI Advisor", icon: ArrowUpRight }],
    tabs: [
      listTab("daily", "Use it daily", VKM_AI_ADVISOR.dailyUse.map((u, i) => ({
        title: u, meta: ["Morning", "Before decisions", "When stuck"][i], badge: ["AM", "Decide", "Stuck"][i],
      }))),
      formTab("prompt", "Your AI prompt (paste into Claude project)", [
        { label: "Project Instructions (ready to paste)", type: "textarea", placeholder: VKM_AI_ADVISOR.promptTemplate },
        { label: "Your name", placeholder: "Suresh Reddy" },
        { label: "Business name", placeholder: "Sri Sai Traders" },
        { label: "Location", placeholder: "Hyderabad" },
      ]),
      listTab("brain", "Business Brain fields (your context)", VKM_AI_ADVISOR.brainFields.map(f => ({
        title: f, meta: "Captured during onboarding kickoff", badge: "Brain",
      }))),
    ],
  }),

  "/participant/brain": () => ({
    description: "Your Business Brain — captured by your coach in the kickoff, powers your AI Advisor.",
    actions: [{ label: "Save brain", icon: Check }],
    tabs: [formTab("brain", "Business Brain", [
      { label: "Business name", placeholder: "Sri Sai Traders" },
      { label: "Industry", placeholder: "Wholesale" },
      { label: "Location", placeholder: "Hyderabad" },
      { label: "Years running", placeholder: "8" },
      { label: "Current monthly revenue (₹)", placeholder: "18,00,000" },
      { label: "Target monthly revenue (₹)", placeholder: "30,00,000" },
      { label: "Team size", placeholder: "14" },
      { label: "Top 3 products / services + margins", type: "textarea", placeholder: "1) ... 2) ... 3) ..." },
      { label: "Main lead sources + monthly lead count", type: "textarea", placeholder: "Referrals, Meta ads, walk-ins — ~150/mo" },
      { label: "Current closing rate (%)", placeholder: "18" },
      { label: "Average deal size (₹)", placeholder: "62,000" },
      { label: "Biggest 3 challenges right now", type: "textarea", placeholder: "1) ... 2) ... 3) ..." },
      { label: "What 'success in 4 months' looks like", type: "textarea", placeholder: "₹30L MRR, trained sales team, CRM live..." },
    ])],
  }),

  "/participant/proof": () => ({
    description: `Submit proof for Week ${CURRENT.week} — ${CURRENT.topic}. Proof required: ${CURRENT.proof}.`,
    actions: [{ label: "Submit for review", icon: Upload }],
    tabs: [formTab("submit", "Submit proof", [
      { label: "Week", placeholder: `Week ${CURRENT.week} — ${CURRENT.topic}` },
      { label: "Proof type", placeholder: CURRENT.proof },
      { label: "Proof URL (Drive / Photo / Doc link)", placeholder: "https://..." },
      { label: "Notes for your coach", type: "textarea", placeholder: "What you did, who was involved, any blockers..." },
    ])],
  }),

  "/participant/lms": () => ({
    description: "VK Mentorship learning library — one module per week, in the order they're taught.",
    tabs: [gridTab("modules", "All 16 modules", VKM_WEEKS.map(w => ({
      title: `Week ${w.week} · ${w.topic}`,
      meta: `${w.phase} · ${w.mode}`,
      badge: w.week < CURRENT_WEEK ? "Done" : w.week === CURRENT_WEEK ? "Current" : "Locked",
      progress: w.week < CURRENT_WEEK ? 100 : w.week === CURRENT_WEEK ? 60 : 0,
    })))],
  }),

  "/participant/leaderboard": () => ({
    description: `${CURRENT_BATCH} leaderboard — points + stage. Updated nightly.`,
    kpis: [
      { label: "Your rank", value: "#4", trend: "up", accent: "gold" },
      { label: "Your points", value: "320", accent: "navy" },
      { label: "Cohort avg", value: "298", accent: "success" },
      { label: "Top score", value: "410", accent: "gold" },
    ],
    tabs: [tableTab("rank", "Rankings",
      [
        { key: "rank", label: "Rank" }, { key: "name", label: "Name" }, { key: "business", label: "Business" },
        { key: "weeks", label: "Wks", align: "right" }, { key: "points", label: "Points", align: "right" },
        { key: "status", label: "Stage" },
      ],
      [...COHORT].sort((a, b) => b.points - a.points).map((p, i) => ({
        rank: `#${i + 1}`, name: p.name, business: p.business,
        weeks: `${p.weeks}/16`, points: p.points, status: p.stage,
      })),
    )],
  }),

  "/participant/achievements": () => ({
    description: "Stages you've reached + milestones unlocked.",
    tabs: [stagesTab(), milestonesTab()],
  }),

  "/participant/milestones": () => ({
    description: "Three escalating milestones — each handed over in front of your team.",
    tabs: [milestonesTab()],
  }),

  "/participant/rewards": () => ({
    description: "Your reward kits (~₹10,000 total per participant). Built to motivate AND market VKM.",
    tabs: [tableTab("rewards", "Rewards",
      [{ key: "name", label: "Milestone" }, { key: "week", label: "Unlock" },
       { key: "cost", label: "Approx cost" }, { key: "items", label: "Items" },
       { key: "status", label: "Status" }],
      VKM_MILESTONES.map(m => ({
        name: m.name,
        week: `Week ${m.unlockWeek}`,
        cost: `₹${m.costInr.toLocaleString("en-IN")}`,
        items: m.items.join(", "),
        status: m.unlockWeek <= CURRENT_WEEK ? "Unlocked" : "Locked",
      })),
    )],
  }),

  "/participant/certificates": () => ({
    description: "Certificate of Transformation — awarded at graduation (Week 16) with your Before-After.",
    kpis: [
      { label: "Status", value: "In progress", accent: "navy" },
      { label: "Graduation", value: `Week ${VKM_PROGRAM.graduationWeek}`, accent: "gold" },
      { label: "Weeks to go", value: `${16 - CURRENT_WEEK}`, accent: "success" },
      { label: "Track", value: "Growth Champion", accent: "gold" },
    ],
  }),

  "/participant/graduation": () => ({
    description: "Your Before / After — the heart of the graduation certificate.",
    tabs: [
      tableTab("ba", "Before vs After (sample)",
        [{ key: "metric", label: "Metric" }, { key: "before", label: "Before" }, { key: "after", label: "After" }, { key: "delta", label: "Δ" }],
        [
          { metric: "Monthly revenue", before: "₹18 L", after: "₹31 L", delta: "+72%" },
          { metric: "Daily leads", before: "5/day", after: "17/day", delta: "3.4×" },
          { metric: "Closing rate", before: "18%", after: "37%", delta: "+19 pts" },
          { metric: "Systems live", before: "0", after: "5", delta: "CRM, GAM, Scripts, Reviews, Automation" },
        ],
      ),
    ],
  }),

  "/participant/referral": () => ({
    description: "Refer a fellow business owner to VK Mentorship — both of you benefit.",
    actions: [{ label: "Copy invite", icon: Send }],
    kpis: [
      { label: "Referred", value: "3", accent: "navy" },
      { label: "Joined", value: "1", accent: "success" },
      { label: "Reward", value: "VK 1:1", accent: "gold" },
      { label: "Pending", value: "2", accent: "warning" },
    ],
  }),

  // =========================== COACH ===========================
  "/coach/followups": () => ({
    description: "Same-day follow-up rule: call the same day a task is missed — don't wait.",
    actions: [{ label: "Mark done", icon: Check }],
    kpis: [
      { label: "Calls today", value: "6", accent: "navy" },
      { label: "Done", value: "3", accent: "success" },
      { label: "At-risk", value: "1", accent: "danger" },
      { label: "On-time %", value: "92%", trend: "up", accent: "success" },
    ],
    tabs: [listTab("today", "Today's follow-ups", COHORT.map(p => ({
      title: `${p.name} — ${p.business}`,
      meta: p.risk === "At Risk"
        ? `MISSED Week 6 task — call today (same-day rule)`
        : `Week ${p.weeks} on track · ${p.stage}`,
      badge: p.risk,
    })))],
  }),

  "/coach/participants": () => ({
    description: `Your assigned participants in ${CURRENT_BATCH}.`,
    actions: [{ label: "Add note", icon: Plus }],
    kpis: [
      { label: "Assigned", value: String(COHORT.length), accent: "navy" },
      { label: "Avg completion", value: "71%", trend: "up", accent: "success" },
      { label: "Avg points", value: "298", accent: "gold" },
      { label: "At risk", value: "1", accent: "danger" },
    ],
    tabs: [tableTab("all", "Cohort",
      [{ key: "name", label: "Participant" }, { key: "business", label: "Business" },
       { key: "city", label: "City" }, { key: "weeks", label: "Wks" },
       { key: "points", label: "Points", align: "right" }, { key: "status", label: "Stage" }],
      COHORT.map(p => ({ ...p, weeks: `${p.weeks}/16`, status: p.stage })),
    )],
  }),

  "/coach/reviews": () => ({
    description: "Weekly 1:1 review log — Review · Connect · Apply · Assign · Commit.",
    tabs: [
      tableTab("1on1", "1:1 structure",
        [{ key: "block", label: "Block" }, { key: "mins", label: "Mins" }, { key: "what", label: "What you do" }],
        VKM_COACH_PLAYBOOK.weekly_1on1.map(b => ({ block: b.block, mins: b.mins, what: b.what })),
      ),
      tableTab("log", "Recent 1:1s",
        [{ key: "name", label: "Participant" }, { key: "week", label: "Wk" },
         { key: "topic", label: "Topic" }, { key: "task", label: "Task assigned" }, { key: "status", label: "Status" }],
        COHORT.slice(0, 5).map((p, i) => ({
          name: p.name, week: `Wk ${p.weeks}`,
          topic: weekByNumber(p.weeks)?.topic ?? "—",
          task: weekByNumber(p.weeks)?.task ?? "—",
          status: i === 4 ? "Pending" : "Completed",
        })),
      ),
    ],
  }),

  "/coach/risk": () => ({
    description: "Same-day call on miss. Escalate to VK / Soumya if stuck 2 weeks in a row.",
    kpis: [
      { label: "At risk", value: "1", accent: "danger" },
      { label: "Escalations open", value: "0", accent: "success" },
      { label: "Risk avg", value: "Low", accent: "success" },
      { label: "Calls due today", value: "1", accent: "warning" },
    ],
    tabs: [tableTab("risk", "Risk register",
      [{ key: "name", label: "Participant" }, { key: "miss", label: "Last miss" }, { key: "weeks", label: "Weeks stuck" }, { key: "status", label: "Action" }],
      [{ name: "Imran S", miss: "Week 6 task", weeks: "1", status: "Same-day call" }],
    )],
  }),

  "/coach/health": () => ({
    description: "Per-participant health: attendance + task completion + monthly results.",
    tabs: [tableTab("health", "Health scores",
      [{ key: "name", label: "Participant" }, { key: "attend", label: "Attend %" },
       { key: "task", label: "Task %" }, { key: "proofs", label: "Proofs" }, { key: "status", label: "Status" }],
      COHORT.map(p => ({
        name: p.name,
        attend: `${80 + (p.weeks % 5) * 3}%`,
        task: `${60 + p.weeks * 4}%`,
        proofs: `${p.weeks}/${p.weeks}`,
        status: p.risk,
      })),
    )],
  }),

  "/coach/brain": () => ({
    description: "Quick view of each participant's Business Brain (powers their AI Advisor).",
    tabs: [tableTab("brains", "Business Brains",
      [{ key: "name", label: "Participant" }, { key: "business", label: "Business" },
       { key: "mrr", label: "MRR" }, { key: "target", label: "Target" }, { key: "status", label: "Status" }],
      COHORT.map((p, i) => ({
        name: p.name, business: p.business,
        mrr: `₹${15 + i * 2}L`, target: `₹${28 + i * 2}L`, status: "Captured",
      })),
    )],
  }),

  "/coach/approve": () => ({
    description: "Approve weekly proofs → awards +40 task points. Always collect proof BEFORE awarding.",
    actions: [{ label: "Approve selected", icon: Check }],
    kpis: [
      { label: "In queue", value: "4", accent: "warning" },
      { label: "Approved (7d)", value: "23", trend: "up", accent: "success" },
      { label: "Rejected (7d)", value: "2", accent: "danger" },
      { label: "Avg response", value: "2h 14m", accent: "navy" },
    ],
    tabs: [tableTab("queue", "Pending proofs",
      [{ key: "name", label: "Participant" }, { key: "week", label: "Wk" },
       { key: "topic", label: "Topic" }, { key: "proof", label: "Proof" }, { key: "status", label: "Status" }],
      COHORT.slice(0, 4).map(p => {
        const w = weekByNumber(p.weeks)!;
        return { name: p.name, week: `Wk ${w.week}`, topic: w.topic, proof: w.proof, status: "Pending" };
      }),
    )],
    side: { title: "Recent decisions", feed: VKM_FEED.slice(0, 4) },
  }),

  "/coach/reject": () => ({
    description: "Reject with a reason → no points awarded. Shrink the task and reassign for a small win.",
    tabs: [tableTab("rejected", "Recently rejected",
      [{ key: "name", label: "Participant" }, { key: "week", label: "Wk" },
       { key: "reason", label: "Reason" }, { key: "status", label: "Status" }],
      [
        { name: "Imran S", week: "Wk 6", reason: "GAM minutes incomplete — missing action items", status: "Rejected" },
        { name: "Mahesh K", week: "Wk 5", reason: "Values doc not signed by team", status: "Rejected" },
      ],
    )],
  }),

  "/coach/points": () => ({
    description: "Manual point award. Use only when standard rules don't fit (rare).",
    tabs: [formTab("award", "Award points", [
      { label: "Participant", placeholder: "Select participant..." },
      { label: "Source", placeholder: "attend / task / revenue / leads / closing / manual" },
      { label: "Reference (week, month, or note)", placeholder: "Week 7 · CRM live" },
      { label: "Points", placeholder: "+40" },
      { label: "Reason", type: "textarea", placeholder: "Why this award..." },
    ])],
  }),

  "/coach/tasks": () => ({
    description: `This week (Wk ${CURRENT.week} — ${CURRENT.topic}) — task to land + proof to collect with every participant.`,
    tabs: [
      listTab("week", "Week task pack", [
        { title: "WHY (Tuesday class)", meta: CURRENT.why, badge: "VK" },
        { title: "TASK (you implement)", meta: CURRENT.task, badge: "Coach" },
        { title: "PROOF (collect before points)", meta: CURRENT.proof, badge: "Proof" },
        { title: "Mode", meta: `${CURRENT.mode}${CURRENT.mode === "Offline" ? " — visit the team in person" : ""}`, badge: CURRENT.mode },
      ]),
      curriculumTab(),
    ],
  }),

  "/coach/gifts": () => ({
    description: "Approve / dispatch milestone gift kits. Hand over in person on offline weeks (3, 14) or live in class (6).",
    tabs: [milestonesTab()],
  }),

  "/coach/visits": () => ({
    description: "Offline weeks: 3, 4, 7, 8, 14, 15, 16. Go in person, work WITH the team, leave with proof in hand.",
    kpis: [
      { label: "Visits done", value: "9", accent: "navy" },
      { label: "Visits left", value: "5", accent: "gold" },
      { label: "Avg notes / visit", value: "320 words", accent: "success" },
      { label: "On-time %", value: "100%", accent: "success" },
    ],
    tabs: [tableTab("planned", "Planned visits",
      [{ key: "name", label: "Participant" }, { key: "week", label: "Week" },
       { key: "topic", label: "Topic" }, { key: "city", label: "City" }, { key: "status", label: "Status" }],
      VKM_PROGRAM.offlineWeeks.slice(0, 6).flatMap(week => COHORT.slice(0, 2).map(p => ({
        name: p.name, week: `Wk ${week}`,
        topic: weekByNumber(week)!.topic, city: p.city,
        status: week < CURRENT_WEEK ? "Done" : week === CURRENT_WEEK ? "This week" : "Planned",
      }))),
    )],
  }),

  "/coach/notes": () => ({
    description: "Field notes from 1:1s and offline visits.",
    actions: [{ label: "New note", icon: Plus }],
    tabs: [listTab("recent", "Recent notes", COHORT.slice(0, 6).map((p, i) => ({
      title: `${p.name} · Wk ${p.weeks}`,
      meta: ["CRM importing 240 leads — needs stage cleanup.", "Goal sheet signed, son aligned. Strong.",
             "Resistance to GAM cadence — try lunch-time slot.", "Sales script in use, 3 wins this week.",
             "Values workshop pending — block 2 hrs next week.", "Owner overwhelmed — shrink task to 1 action."][i],
      badge: `Wk ${p.weeks}`,
    })))],
  }),

  "/coach/attendance": () => ({
    description: "+10 points per class attended.",
    tabs: [tableTab("att", "Attendance grid",
      [{ key: "name", label: "Participant" }, { key: "rate", label: "Attend %" }, { key: "miss", label: "Missed weeks" }, { key: "status", label: "Status" }],
      COHORT.map(p => ({
        name: p.name, rate: `${80 + p.weeks % 5 * 3}%`,
        miss: p.risk === "At Risk" ? "Wk 6" : "—", status: p.risk,
      })),
    )],
  }),

  "/coach/batches": () => ({
    description: `You're coaching ${CURRENT_BATCH} (active) and Batch 15 (wrap-up).`,
    tabs: [tableTab("b", "Batches",
      [{ key: "name", label: "Batch" }, { key: "size", label: "Size" }, { key: "week", label: "Current week" }, { key: "status", label: "Status" }],
      [
        { name: "Batch 16", size: 6, week: `Wk ${CURRENT_WEEK}`, status: "Active" },
        { name: "Batch 15", size: 8, week: "Wk 14", status: "Active" },
        { name: "Batch 14", size: 10, week: "Wk 16", status: "Completed" },
      ],
    )],
  }),

  "/coach/escalations": () => ({
    description: "Stuck 2 weeks in a row → escalate to VK / Soumya. Same-day call still applies.",
    tabs: [tableTab("esc", "Escalations",
      [{ key: "name", label: "Participant" }, { key: "weeks", label: "Stuck weeks" },
       { key: "issue", label: "Issue" }, { key: "to", label: "Escalated to" }, { key: "status", label: "Status" }],
      [{ name: "—", weeks: "—", issue: "No open escalations", to: "—", status: "On Track" }],
    )],
  }),

  "/coach/leaderboard": () => ({
    description: "Coach KPIs: sessions delivered, follow-ups completed, on-time proof %.",
    tabs: [tableTab("coaches", "Coaches",
      [{ key: "name", label: "Coach" }, { key: "sessions", label: "Sessions", align: "right" },
       { key: "follow", label: "Follow-ups", align: "right" }, { key: "onTime", label: "On-time %", align: "right" },
       { key: "status", label: "Status" }],
      COACHES.map((c, i) => ({
        name: c.name, sessions: 48 - i * 6, follow: 92 - i * 5,
        onTime: `${95 - i * 3}%`, status: i === 0 ? "Top" : "Active",
      })),
    )],
  }),

  "/coach/reports": () => ({
    description: "Weekly Master Tracker report — attendance, task, proof, points.",
    actions: [{ label: "Export weekly", icon: Download, variant: "outline" }],
    tabs: [chartTab("trend", "Cohort points trend", [
      { label: "Wk 1", value: 30 }, { label: "Wk 2", value: 80 }, { label: "Wk 3", value: 140 },
      { label: "Wk 4", value: 190 }, { label: "Wk 5", value: 240 }, { label: "Wk 6", value: 280 }, { label: "Wk 7", value: 320 },
    ])],
  }),

  "/coach/profile": () => ({
    description: "Coach Playbook quick-reference — your role + weekly 1:1 structure + do/don'ts.",
    tabs: [
      listTab("role", "Your role", [{ title: VKM_COACH_PLAYBOOK.role, meta: "Engine of implementation", badge: "Role" }]),
      tableTab("1on1", "Weekly 1:1 structure",
        [{ key: "block", label: "Block" }, { key: "mins", label: "Mins" }, { key: "what", label: "What" }],
        VKM_COACH_PLAYBOOK.weekly_1on1.map(b => ({ block: b.block, mins: b.mins, what: b.what })),
      ),
      listTab("dos", "DOs", VKM_COACH_PLAYBOOK.dos.map(d => ({ title: d, badge: "DO" }))),
      listTab("donts", "DON'Ts", VKM_COACH_PLAYBOOK.donts.map(d => ({ title: d, badge: "DON'T" }))),
    ],
  }),

  // =========================== MENTOR (VK) ===========================
  "/mentor/insights": () => ({
    description: `AI-flagged signals for ${CURRENT_BATCH}.`,
    tabs: [listTab("ai", "Insights", [
      { title: "Most owners are in Builder — Systems month is doing its job", meta: "Push Starters before Sell phase begins (Wk 9)", badge: "Action" },
      { title: "Imran S at risk — missed Wk 6 GAM task", meta: "Coach Soumya following up today", badge: "Risk" },
      { title: "Cohort completion 71% — above benchmark 65%", meta: "Batch 16 healthy through Systems phase", badge: "Healthy" },
      { title: "2 candidates tracking to Growth Champion", meta: "Anitha Rao, Lakshmi N", badge: "Champions" },
    ])],
  }),

  "/mentor/analytics": () => ({
    description: "Cohort-level analytics across all batches.",
    kpis: [
      { label: "Active batches", value: "2", accent: "navy" },
      { label: "Active participants", value: "14", accent: "gold" },
      { label: "Avg completion", value: "71%", trend: "up", accent: "success" },
      { label: "Graduation rate", value: "92%", trend: "up", accent: "success" },
    ],
    tabs: [chartTab("trend", "Cohort avg points (Batch 16)", [
      { label: "Wk 1", value: 30 }, { label: "Wk 2", value: 80 }, { label: "Wk 3", value: 140 },
      { label: "Wk 4", value: 190 }, { label: "Wk 5", value: 240 }, { label: "Wk 6", value: 280 }, { label: "Wk 7", value: 320 },
    ])],
  }),

  "/mentor/programs/new": () => ({
    description: "Spin up a new VKM-style program. Default is the 16-week transformation.",
    actions: [{ label: "Create program", icon: Plus }],
    tabs: [formTab("new", "Program details", [
      { label: "Title", placeholder: "VK Mentorship — Cohort 17" },
      { label: "Duration (weeks)", placeholder: "16" },
      { label: "Investment (₹)", placeholder: "8,00,000" },
      { label: "Phases", placeholder: "Foundation · Systems · Sell · Review" },
      { label: "Description", type: "textarea", placeholder: "4 Months · 16 weekly sessions..." },
    ])],
  }),

  "/mentor/programs": () => ({
    description: "All VKM programs.",
    tabs: [gridTab("all", "Programs", [
      { title: "VK Mentorship — 16-Week Transformation", meta: "16 weeks · ₹8 L · Foundation→Systems→Sell→Review", badge: "Active", progress: (CURRENT_WEEK / 16) * 100 },
      { title: "Alumni Circle (post-graduation)", meta: "Ongoing · Monthly check-in", badge: "Draft", progress: 0 },
      { title: "Mastermind 2.0 (graduates only)", meta: "8 weeks · advanced sales OS", badge: "Draft", progress: 0 },
    ])],
  }),

  "/mentor/programs/clone": () => ({
    description: "Clone the 16-week program to launch a new cohort fast.",
    actions: [{ label: "Clone", icon: ArrowUpRight }],
    tabs: [listTab("base", "Pick a base", [
      { title: "VK Mentorship — 16-Week Transformation", meta: "Latest active program", badge: "Recommended" },
    ])],
  }),

  "/mentor/batches": () => ({
    description: "All cohorts.",
    tabs: [tableTab("b", "Batches",
      [{ key: "name", label: "Batch" }, { key: "size", label: "Size" }, { key: "started", label: "Started" }, { key: "week", label: "Current Wk" }, { key: "status", label: "Status" }],
      [
        { name: "Batch 17", size: 8, started: "Apr 1", week: "Wk 2", status: "Active" },
        { name: "Batch 16", size: 6, started: "Feb 15", week: `Wk ${CURRENT_WEEK}`, status: "Active" },
        { name: "Batch 15", size: 8, started: "Dec 10", week: "Wk 14", status: "Active" },
        { name: "Batch 14", size: 10, started: "Sep 5", week: "Wk 16", status: "Completed" },
      ],
    )],
  }),

  "/mentor/classes": () => ({
    description: "Your Tuesday class — 1–2 hrs, whole cohort live. Format below.",
    actions: [{ label: "Schedule next", icon: CalendarPlus }],
    tabs: [
      tableTab("format", "Tuesday class format",
        [{ key: "block", label: "Block" }, { key: "mins", label: "Mins" }, { key: "what", label: "What" }],
        VKM_VK_CLASS_FORMAT.map(b => ({ block: b.block, mins: b.mins, what: b.what })),
      ),
      tableTab("schedule", "Upcoming classes",
        [{ key: "week", label: "Wk" }, { key: "topic", label: "Topic" }, { key: "why", label: "WHY to land" }, { key: "task", label: "Task to assign" }],
        VKM_WEEKS.slice(CURRENT_WEEK - 1, CURRENT_WEEK + 4).map(w => ({
          week: `Wk ${w.week}`, topic: w.topic, why: w.why, task: w.task,
        })),
      ),
    ],
  }),

  "/mentor/coaches": () => ({
    description: "Your growth coaches.",
    tabs: [tableTab("c", "Coaches",
      [{ key: "name", label: "Coach" }, { key: "role", label: "Role" }, { key: "batches", label: "Batches" }, { key: "participants", label: "Participants", align: "right" }],
      COACHES,
    )],
  }),

  "/mentor/participants": () => ({
    description: "All active participants across batches.",
    tabs: [tableTab("all", "Participants",
      [{ key: "name", label: "Participant" }, { key: "business", label: "Business" },
       { key: "city", label: "City" }, { key: "batch", label: "Batch" },
       { key: "points", label: "Points", align: "right" }, { key: "status", label: "Stage" }],
      COHORT.map(p => ({ ...p, batch: CURRENT_BATCH, status: p.stage })),
    )],
  }),

  "/mentor/coach-performance": () => ({
    description: "Sessions, follow-ups, on-time proof %.",
    tabs: [tableTab("perf", "Coach KPIs",
      [{ key: "name", label: "Coach" }, { key: "sessions", label: "Sessions" },
       { key: "follow", label: "Follow-ups" }, { key: "onTime", label: "On-time %" }, { key: "status", label: "Status" }],
      COACHES.map((c, i) => ({
        name: c.name, sessions: 48 - i * 6, follow: 92 - i * 5,
        onTime: `${95 - i * 3}%`, status: "Active",
      })),
    )],
  }),

  "/mentor/participant-performance": () => ({
    description: "Stage distribution + at-risk flags.",
    tabs: [chartTab("stages", "Stage distribution (Batch 16)", [
      { label: "Starter", value: 2 }, { label: "Builder", value: 3 }, { label: "Operator", value: 1 },
      { label: "Closer", value: 0 }, { label: "Growth Champion", value: 0 },
    ])],
  }),

  "/mentor/content": () => ({
    description: "Drop class recordings, frameworks, scripts, GAM templates here.",
    actions: [{ label: "Upload", icon: Upload }],
    tabs: [gridTab("all", "Library", VKM_WEEKS.map(w => ({
      title: `Wk ${w.week} · ${w.topic}`, meta: `${w.phase} class recording + framework`, badge: w.mode,
    })))],
  }),

  "/mentor/assignments": () => ({
    description: "Each week's assignment is the coach's implementation task with its proof.",
    tabs: [curriculumTab()],
  }),

  "/mentor/announcements": () => ({
    description: "Broadcast a Tuesday class theme or program update to the whole cohort.",
    actions: [{ label: "New broadcast", icon: Send }],
    tabs: [listTab("recent", "Recent broadcasts", VKM_WEEKS.slice(0, CURRENT_WEEK).map(w => ({
      title: `Tuesday class — Week ${w.week}: ${w.topic}`,
      meta: w.why, badge: w.mode,
    })))],
  }),

  "/mentor/leaderboards": () => ({
    description: "Champions across all batches.",
    tabs: [tableTab("champs", "Top owners",
      [{ key: "rank", label: "Rank" }, { key: "name", label: "Participant" },
       { key: "batch", label: "Batch" }, { key: "points", label: "Points", align: "right" }, { key: "status", label: "Stage" }],
      [...COHORT].sort((a, b) => b.points - a.points).map((p, i) => ({
        rank: `#${i + 1}`, name: p.name, batch: CURRENT_BATCH, points: p.points, status: p.stage,
      })),
    )],
  }),

  "/mentor/cohorts": () => ({
    description: "Cohort review — stage distribution, completion, at-risk.",
    tabs: [tableTab("co", "Cohorts",
      [{ key: "batch", label: "Batch" }, { key: "active", label: "Active", align: "right" },
       { key: "avg", label: "Avg points", align: "right" }, { key: "completion", label: "Completion %", align: "right" }, { key: "status", label: "Status" }],
      [
        { batch: "Batch 17", active: 8, avg: 50, completion: "10%", status: "Active" },
        { batch: "Batch 16", active: 6, avg: 298, completion: "71%", status: "Active" },
        { batch: "Batch 15", active: 8, avg: 720, completion: "88%", status: "Active" },
        { batch: "Batch 14", active: 10, avg: 1180, completion: "100%", status: "Completed" },
      ],
    )],
  }),

  "/mentor/graduation": () => ({
    description: "Approve graduations (Week 16). Before-After numbers required.",
    tabs: [tableTab("grad", "Graduation queue",
      [{ key: "name", label: "Participant" }, { key: "before", label: "Before MRR" },
       { key: "after", label: "After MRR" }, { key: "delta", label: "Δ" }, { key: "status", label: "Status" }],
      [
        { name: "Suresh Reddy (Batch 14)", before: "₹18L", after: "₹31L", delta: "+72%", status: "Approved" },
        { name: "Anitha Rao (Batch 15, Wk 14)", before: "₹12L", after: "₹19L", delta: "+58%", status: "Pending" },
      ],
    )],
  }),

  "/mentor/certificates": () => ({
    description: "Certificate of Transformation — issued at graduation.",
    tabs: [listTab("issued", "Issued certificates", [
      { title: "Suresh Reddy · Sri Sai Traders", meta: "Growth Champion · +72% revenue · Batch 14", badge: "Issued" },
      { title: "Anitha Rao · Anitha Designs", meta: "Closer · +58% revenue · Batch 15", badge: "Pending" },
    ])],
  }),

  "/mentor/stories": () => ({
    description: "Win stories to share publicly — fuel for marketing.",
    tabs: [gridTab("stories", "Stories", [
      { title: "Suresh Reddy — ₹18L → ₹31L in 16 weeks", meta: "Wholesale · Hyderabad · CRM + sales scripts", badge: "Published" },
      { title: "Anitha Rao — 3.4× daily leads", meta: "Designs · Bengaluru · Content engine", badge: "Reel" },
      { title: "Lakshmi N — Closing 18% → 37%", meta: "Sarees · Hyderabad · Objection handling", badge: "Featured" },
    ])],
  }),

  "/mentor/reports": () => ({
    description: "Mentor-level reporting across batches.",
    tabs: [chartTab("rev", "Avg participant revenue lift by batch (%)", [
      { label: "Batch 12", value: 48 }, { label: "Batch 13", value: 55 }, { label: "Batch 14", value: 67 },
      { label: "Batch 15", value: 62 }, { label: "Batch 16", value: 41 },
    ])],
  }),

  // =========================== SUPER ADMIN ===========================
  "/admin/programs": () => ({
    description: "All programs in the platform.",
    tabs: [gridTab("all", "Programs", [
      { title: "VK Mentorship — 16-Week Transformation", meta: "16 weeks · ₹8 L · 16 modules", badge: "Active", progress: (CURRENT_WEEK / 16) * 100 },
    ])],
  }),

  "/admin/batches": () => ({
    description: "All cohorts across programs.",
    tabs: [tableTab("b", "Batches",
      [{ key: "name", label: "Batch" }, { key: "size", label: "Size" }, { key: "week", label: "Current Wk" }, { key: "status", label: "Status" }],
      [
        { name: "Batch 17", size: 8, week: "Wk 2", status: "Active" },
        { name: "Batch 16", size: 6, week: `Wk ${CURRENT_WEEK}`, status: "Active" },
        { name: "Batch 15", size: 8, week: "Wk 14", status: "Active" },
      ],
    )],
  }),

  "/admin/users": () => ({
    description: "All users — participants, coaches, mentors, super-admins.",
    actions: [{ label: "Invite", icon: Plus }],
    kpis: [
      { label: "Participants", value: "22", accent: "navy" },
      { label: "Coaches", value: "3", accent: "gold" },
      { label: "Mentors", value: "1", accent: "success" },
      { label: "Super Admins", value: "1", accent: "navy" },
    ],
    tabs: [tableTab("all", "Users",
      [{ key: "name", label: "Name" }, { key: "role", label: "Role" }, { key: "batch", label: "Batch" }, { key: "status", label: "Status" }],
      [
        { name: "Venu Kalyan", role: "Mentor", batch: "—", status: "Active" },
        { name: "Soumya R", role: "Coach (Lead)", batch: "Batch 16, 17", status: "Active" },
        ...COHORT.map(p => ({ name: p.name, role: "Participant", batch: CURRENT_BATCH, status: p.risk })),
      ],
    )],
  }),

  "/admin/payments": () => ({
    description: "₹8,00,000 enrolment payments per participant.",
    actions: [{ label: "Record payment", icon: Plus }, { label: "Export CSV", icon: FileDown, variant: "outline" }],
    kpis: [
      { label: "Revenue (Batch 16)", value: "₹48L", accent: "success" },
      { label: "Per seat", value: "₹8,00,000", accent: "navy" },
      { label: "Pending", value: "0", accent: "success" },
      { label: "Seats sold", value: "6 / 15", accent: "gold" },
    ],
    tabs: [tableTab("tx", "Transactions",
      [{ key: "id", label: "Invoice" }, { key: "name", label: "Participant" },
       { key: "amount", label: "Amount", align: "right" }, { key: "method", label: "Method" }, { key: "status", label: "Status" }],
      COHORT.map((p, i) => ({
        id: `VKM-INV-${1600 + i}`, name: p.name, amount: "₹8,00,000",
        method: ["UPI", "NEFT", "UPI", "Card", "NEFT", "UPI"][i] ?? "UPI", status: "Paid",
      })),
    )],
  }),

  // VK Operations (Soumya)
  "/admin/vk-ops/admissions": () => ({
    description: "Step 1 of onboarding — confirm payment and welcome the participant.",
    tabs: [tableTab("queue", "New admissions",
      [{ key: "name", label: "Name" }, { key: "business", label: "Business" },
       { key: "city", label: "City" }, { key: "paid", label: "Paid" }, { key: "status", label: "Status" }],
      COHORT.map(p => ({ ...p, paid: "₹8,00,000", status: "Confirmed" })),
    )],
  }),

  "/admin/vk-ops/payments": () => ({
    description: "Verify the ₹8,00,000 receipt before triggering welcome.",
    tabs: [tableTab("verify", "Payment verification",
      [{ key: "name", label: "Participant" }, { key: "amount", label: "Amount" },
       { key: "ref", label: "Ref" }, { key: "date", label: "Date" }, { key: "status", label: "Status" }],
      COHORT.map((p, i) => ({ name: p.name, amount: "₹8,00,000", ref: `TXN${100200 + i}`, date: `Feb ${10 + i}`, status: "Verified" })),
    )],
  }),

  "/admin/vk-ops/allocation": () => ({
    description: "Assign participants to a cohort (Batch 16 is current).",
    tabs: [tableTab("alloc", "Allocation",
      [{ key: "name", label: "Participant" }, { key: "batch", label: "Batch" }, { key: "start", label: "Starts" }, { key: "status", label: "Status" }],
      COHORT.map(p => ({ name: p.name, batch: CURRENT_BATCH, start: "Feb 15", status: "Allocated" })),
    )],
  }),

  "/admin/vk-ops/coach-assign": () => ({
    description: "Step 3 of onboarding — pair each participant with a Growth Coach.",
    tabs: [tableTab("ca", "Assignments",
      [{ key: "name", label: "Participant" }, { key: "coach", label: "Coach" }, { key: "intro", label: "Intro" }, { key: "status", label: "Status" }],
      COHORT.map((p, i) => ({ name: p.name, coach: COACHES[i % COACHES.length].name, intro: "Day 2", status: "Assigned" })),
    )],
  }),

  "/admin/vk-ops/onboarding": () => ({
    description: "7-step onboarding flow owned by Soumya (Ops & HR).",
    tabs: [tableTab("steps", "Onboarding checklist",
      [{ key: "step", label: "#" }, { key: "desc", label: "Step" }, { key: "owner", label: "Owner" }, { key: "by", label: "Done by" }],
      VKM_ONBOARDING.map(s => ({ step: s.step, desc: s.description, owner: s.owner, by: s.doneBy })),
    )],
  }),

  "/admin/vk-ops/welcome-kit": () => ({
    description: "Digital welcome kit: 16-Week Journey one-pager + Orientation deck.",
    tabs: [listTab("kit", "Welcome kit contents", [
      { title: "16-Week Journey one-pager", meta: "PDF · sent on Day 1", badge: "PDF" },
      { title: "Orientation deck", meta: "Sent on Day 1", badge: "Deck" },
      { title: "WhatsApp group invite", meta: "VKM cohort group", badge: "WhatsApp" },
      { title: "AI Advisor setup link", meta: "Sent after kickoff (Day 5)", badge: "AI" },
    ])],
  }),

  "/admin/vk-ops/whatsapp-groups": () => ({
    description: "Cohort WhatsApp groups — added on Day 1.",
    tabs: [tableTab("g", "Groups",
      [{ key: "batch", label: "Batch" }, { key: "members", label: "Members" }, { key: "admin", label: "Admin" }, { key: "status", label: "Status" }],
      [
        { batch: "Batch 17", members: 9, admin: "Soumya R", status: "Active" },
        { batch: "Batch 16", members: 9, admin: "Soumya R", status: "Active" },
        { batch: "Batch 15", members: 11, admin: "Soumya R", status: "Active" },
      ],
    )],
  }),

  "/admin/vk-ops/support": () => ({
    description: "Participant support tickets handled by Ops.",
    tabs: [tableTab("t", "Tickets",
      [{ key: "name", label: "Participant" }, { key: "issue", label: "Issue" }, { key: "owner", label: "Owner" }, { key: "status", label: "Status" }],
      [
        { name: "Mahesh K", issue: "Can't access AI Advisor", owner: "Soumya R", status: "Open" },
        { name: "Lakshmi N", issue: "Tuesday class recording link", owner: "Soumya R", status: "Resolved" },
      ],
    )],
  }),

  "/admin/vk-ops/printing": () => ({
    description: "Certificate of Transformation — printed for graduates (Week 16).",
    tabs: [tableTab("p", "Print queue",
      [{ key: "name", label: "Participant" }, { key: "batch", label: "Batch" }, { key: "type", label: "Type" }, { key: "status", label: "Status" }],
      [
        { name: "Suresh Reddy", batch: "Batch 14", type: "Certificate + Champion frame", status: "Delivered" },
        { name: "Anitha Rao", batch: "Batch 15", type: "Certificate + Closer's Kit", status: "Printing" },
      ],
    )],
  }),

  "/admin/vk-ops/gifts": () => ({
    description: "3 milestone reward kits per participant (~₹10,000 total). Sourcing per batch.",
    tabs: [
      tableTab("kits", "Gift kits",
        [{ key: "name", label: "Milestone" }, { key: "week", label: "Unlock" }, { key: "cost", label: "Cost" }, { key: "items", label: "Items" }],
        VKM_MILESTONES.map(m => ({
          name: m.name, week: `Wk ${m.unlockWeek}`,
          cost: `₹${m.costInr.toLocaleString("en-IN")}`,
          items: m.items.join(", "),
        })),
      ),
      listTab("sourcing", "Sourcing notes", [
        { title: "Trophies & crystal", meta: "Local trophy/engraving vendors — bulk per batch (15)", badge: "Vendor" },
        { title: "Journal, pen, polo, folder", meta: "Branded merch suppliers — VK Mentorship logo (navy/gold)", badge: "Merch" },
        { title: "Framed goal print", meta: "Print-on-demand — coach sends participant's goal text", badge: "POD" },
        { title: "Hamper", meta: "Dry fruits / sweets — local, ordered fresh near Week 14", badge: "Fresh" },
        { title: "Zero-cost rewards", meta: "Social feature, 1:1 with VK, reel — priceless, use fully", badge: "Free" },
      ]),
    ],
  }),

  "/admin/vk-ops/events": () => ({
    description: "Tuesday classes + offline visit days + graduation events.",
    tabs: [tableTab("e", "Events",
      [{ key: "type", label: "Type" }, { key: "batch", label: "Batch" }, { key: "when", label: "When" }, { key: "status", label: "Status" }],
      [
        { type: "Tuesday Class — Wk 7: CRM Implementation", batch: "Batch 16", when: "Tomorrow 7pm", status: "Scheduled" },
        { type: "Offline visit — Suresh Reddy (Wk 7)", batch: "Batch 16", when: "Thu, Hyderabad", status: "Planned" },
        { type: "Graduation ceremony", batch: "Batch 15", when: "In 2 weeks", status: "Planned" },
      ],
    )],
  }),

  "/admin/vk-ops/graduation": () => ({
    description: "Graduation planning — Week 16 ceremony per cohort.",
    tabs: [listTab("plan", "Graduation plan", [
      { title: "Print certificates + Closer's Kit", meta: "Soumya · 2 weeks before", badge: "Ops" },
      { title: "Schedule before-after capture call", meta: "Coach · Week 15", badge: "Coach" },
      { title: "Book venue / record session", meta: "Soumya · Week 15", badge: "Venue" },
      { title: "Crystal trophy engraving", meta: "Local vendor · Week 14", badge: "Gift" },
      { title: "Story + reel publication", meta: "Marketing · Week 16", badge: "Marketing" },
    ])],
  }),

  "/admin/vk-ops/alumni": () => ({
    description: "Graduates of past cohorts.",
    tabs: [tableTab("a", "Alumni",
      [{ key: "name", label: "Name" }, { key: "business", label: "Business" }, { key: "batch", label: "Batch" }, { key: "lift", label: "Revenue lift" }, { key: "status", label: "Status" }],
      [
        { name: "Suresh Reddy", business: "Sri Sai Traders", batch: "Batch 14", lift: "+72%", status: "Champion" },
        { name: "Past graduate A", business: "—", batch: "Batch 13", lift: "+55%", status: "Closer" },
      ],
    )],
  }),

  "/admin/vk-ops/feedback": () => ({
    description: "Weekly + graduation feedback / NPS.",
    kpis: [
      { label: "NPS (Batch 16)", value: "62", trend: "up", accent: "success" },
      { label: "CSAT", value: "4.7 / 5", accent: "gold" },
      { label: "Responses", value: "5 / 6", accent: "navy" },
      { label: "Trend", value: "↑", accent: "success" },
    ],
  }),

  "/admin/vk-ops/stories": () => ({
    description: "Captured success stories — fuel for marketing & next-cohort sales.",
    tabs: [gridTab("s", "Stories", [
      { title: "Suresh Reddy — ₹18L → ₹31L in 16 weeks", meta: "Wholesale · Hyderabad · CRM + sales scripts", badge: "Published" },
      { title: "Anitha Rao — 3.4× daily leads", meta: "Designs · Bengaluru · Content engine", badge: "Reel" },
    ])],
  }),

  "/admin/vk-ops/campaigns": () => ({
    description: "Marketing campaigns to fill the next cohort.",
    actions: [{ label: "New campaign", icon: Send }],
    tabs: [tableTab("c", "Campaigns",
      [{ key: "name", label: "Campaign" }, { key: "audience", label: "Audience" }, { key: "leads", label: "Leads" }, { key: "status", label: "Status" }],
      [
        { name: "Batch 18 — Founder Webinar", audience: "Lookalike of Batch 16", leads: 184, status: "Active" },
        { name: "Champion stories — Reels", audience: "Public", leads: 96, status: "Active" },
      ],
    )],
  }),

  "/admin/vk-ops/reports": () => ({
    description: "Operational health across all cohorts.",
    tabs: [chartTab("ops", "Onboarding TAT (days, by batch)", [
      { label: "Batch 14", value: 5 }, { label: "Batch 15", value: 4 }, { label: "Batch 16", value: 4 }, { label: "Batch 17", value: 3 },
    ])],
  }),
};

// ---------- Regex fallbacks (catch-all by section) ----------
type Override = (path: string, label: string) => Partial<PageConfig>;
const FALLBACKS: Array<[RegExp, Override]> = [
  // Notifications across all roles
  [/\/notifications$/, () => ({
    description: "Everything that needs your attention.",
    actions: [{ label: "Mark all read", icon: Check, variant: "outline" }],
    tabs: [feedTab("all", "All", VKM_FEED)],
  })],

  // Generic chat across roles
  [/\/(chat|community)$/, (_, label) => ({
    description: `${label} — DM coaches and the cohort.`,
    actions: [{ label: "New message", icon: Send }],
    tabs: [listTab("threads", "Threads", [
      { title: "Coach Soumya", meta: "Reviewed your Wk 6 GAM — well done.", badge: "Coach" },
      { title: "Batch 16 group", meta: "Anitha shared her Week 7 CRM screenshot.", badge: "Cohort" },
      { title: "VK", meta: "Tomorrow's class — bring your lead list.", badge: "VK" },
    ])],
  })],

  // Generic announcements
  [/\/announcements$/, () => ({
    description: "Cohort broadcasts from VK and ops.",
    tabs: [listTab("recent", "Recent", VKM_WEEKS.slice(0, CURRENT_WEEK).map(w => ({
      title: `Tuesday class — Wk ${w.week}: ${w.topic}`, meta: w.why, badge: w.mode,
    })))],
  })],

  // Generic meetings
  [/\/meetings$/, () => ({
    description: "Your scheduled meetings.",
    tabs: [listTab("up", "Upcoming", [
      { title: "Tuesday Class with VK", meta: `Tomorrow 7pm · Wk ${CURRENT_WEEK}: ${CURRENT.topic}`, badge: "Class" },
      { title: "Coach 1:1 — Soumya", meta: "Thursday · 11am", badge: "1:1" },
      { title: "Coach offline visit", meta: `Friday · ${CURRENT.mode === "Offline" ? "this week" : "Week 8"}`, badge: "Visit" },
    ])],
  })],

  // Settings / profile / branding / platform
  [/(settings|profile|branding|ai$|api-keys|database|integrations|backup|feature-flags|security|permissions|roles|storage|files|crm|exports|audit|support|lms)$/i, (_, label) => ({
    description: `Configure ${label.toLowerCase()}.`,
    actions: [{ label: "Save", icon: Check }],
    tabs: [formTab("general", "General", [
      { label: "Display name", placeholder: "VK Mentorship" },
      { label: "Workspace", placeholder: "vkm" },
      { label: "Owner email", type: "email", placeholder: "ops@venukalyan.com" },
      { label: "Region", placeholder: "Asia / Kolkata" },
      { label: "Notes", type: "textarea", placeholder: "..." },
    ])],
  })],

  // Messaging
  [/(email|sms|whatsapp$|push)$/i, (_, label) => ({
    description: `${label} — compose, schedule, track.`,
    actions: [{ label: "New", icon: Send }],
    kpis: [
      { label: "Sent (7d)", value: "1,240", accent: "navy" },
      { label: "Delivered", value: "98.4%", accent: "success" },
      { label: "Opens", value: "61%", trend: "up", accent: "gold" },
      { label: "Bounces", value: "0.8%", accent: "warning" },
    ],
  })],

  // Analytics / reports
  [/(analytics|reports)$/i, (_, label) => ({
    description: `${label} — visualise trends and drill down.`,
    actions: [{ label: "Export PDF", icon: Download, variant: "outline" }],
    kpis: [
      { label: "Active", value: "14", accent: "navy" },
      { label: "Avg completion", value: "71%", trend: "up", accent: "success" },
      { label: "Avg points", value: "298", accent: "gold" },
      { label: "Top batch", value: "Batch 15", accent: "navy" },
    ],
    tabs: [chartTab("trend", "Trend", [
      { label: "Wk 1", value: 30 }, { label: "Wk 2", value: 80 }, { label: "Wk 3", value: 140 },
      { label: "Wk 4", value: 190 }, { label: "Wk 5", value: 240 }, { label: "Wk 6", value: 280 }, { label: "Wk 7", value: 320 },
    ])],
  })],

  // Coach calendar fallback
  [/\/calendar$/, (_, label) => ({
    description: `${label} — Tuesday classes, 1:1s, and offline visits (3, 4, 7, 8, 14, 15, 16).`,
    actions: [{ label: "Sync", icon: ArrowUpRight, variant: "outline" }],
    tabs: [listTab("up", "Upcoming", VKM_WEEKS.slice(CURRENT_WEEK - 1, CURRENT_WEEK + 3).map(w => ({
      title: `Wk ${w.week} · ${w.topic}`, meta: `${w.phase} · ${w.mode}`, badge: w.mode,
    })))],
  })],

  // Generic invoices
  [/\/invoices$/, () => ({
    description: "₹8,00,000 enrolment invoices.",
    tabs: [tableTab("inv", "Invoices",
      [{ key: "id", label: "Invoice" }, { key: "name", label: "Participant" },
       { key: "amount", label: "Amount", align: "right" }, { key: "status", label: "Status" }],
      COHORT.map((p, i) => ({ id: `VKM-INV-${1600 + i}`, name: p.name, amount: "₹8,00,000", status: "Paid" })),
    )],
  })],
];

// ---------- Build a config for any path ----------
export function getPageConfig(path: string): PageConfig {
  const nav = findNavEntry(path);
  const label = nav?.item.label ?? "Page";
  const icon = (nav?.item.icon ?? (Trophy as unknown as LucideIcon)) as LucideIcon;
  const base: PageConfig = {
    eyebrow: eyebrowFor(path),
    title: label,
    description: "VK Mentorship — 4 Months · 16 Weeks · One Transformation.",
    icon,
    kpis: PARTICIPANT_KPIS,
    tabs: [curriculumTab()],
    side: { title: "Cohort activity", feed: VKM_FEED.slice(0, 5) },
  };

  // 1. Exact path override wins
  if (PATHS[path]) {
    return { ...base, ...PATHS[path](label) };
  }
  // 2. Regex fallback
  for (const [pat, fn] of FALLBACKS) {
    if (pat.test(path)) {
      return { ...base, ...fn(path, label) };
    }
  }
  return base;
}
