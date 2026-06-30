// VKM canonical program model — single source of truth.
// Sourced verbatim from VKM_Master_Tracker.xlsx, VK_Class_Playbook, Coach_Playbook,
// Onboarding_Flow, Gift_Sourcing_Guide and AI_Advisor_Setup.

export type Phase = "Foundation" | "Systems" | "Sell" | "Review";
export type Mode = "Online" | "Offline";

export type ProgramWeek = {
  week: number;
  phase: Phase;
  topic: string;
  mode: Mode;
  why: string;
  task: string;
  proof: string;
};

export const VKM_PROGRAM = {
  title: "VK Mentorship",
  tagline: "4 Months · 16 Weeks · One Transformation",
  durationWeeks: 16,
  investmentInr: 800000,
  investmentLabel: "₹8,00,000",
  classCadence: "Every Tuesday · 1–2 hrs · whole cohort live",
  model:
    "Venu Kalyan takes the weekly GROUP class (online). Growth Coaches drive individual implementation.",
  phases: [
    { name: "Foundation" as Phase, weeks: [1, 2, 3, 4] },
    { name: "Systems" as Phase, weeks: [5, 6, 7, 8] },
    { name: "Sell" as Phase, weeks: [9, 10, 11, 12, 13, 14] },
    { name: "Review" as Phase, weeks: [15, 16] },
  ],
  offlineWeeks: [3, 4, 7, 8, 14, 15, 16],
  graduationWeek: 16,
};

export const VKM_WEEKS: ProgramWeek[] = [
  {
    week: 1,
    phase: "Foundation",
    topic: "Lifestyle Changes + OMM",
    mode: "Online",
    why: "Discipline & rhythm drive growth",
    task: "Install morning routine + start daily OMM",
    proof: "OMM running 5+ days; routine log",
  },
  {
    week: 2,
    phase: "Foundation",
    topic: "Business Goals",
    mode: "Online",
    why: "Setting the right number & breaking it down",
    task: "Set annual + monthly goal, cascade to team",
    proof: "Written goal sheet",
  },
  {
    week: 3,
    phase: "Foundation",
    topic: "Team Aspiration + Goal Reveal",
    mode: "Offline",
    why: "Aligning the whole team to one target",
    task: "Run team aspiration + goal reveal session",
    proof: "Team goal board photo",
  },
  {
    week: 4,
    phase: "Foundation",
    topic: "Role Clarity",
    mode: "Offline",
    why: "Who owns what — KRA & KPI",
    task: "Define KRA/KPI for every role",
    proof: "Signed role clarity chart",
  },
  {
    week: 5,
    phase: "Systems",
    topic: "Culture & Values",
    mode: "Online",
    why: "A culture that runs without you",
    task: "Define 3–5 values + expected behaviours",
    proof: "Values document",
  },
  {
    week: 6,
    phase: "Systems",
    topic: "GAM + Review-to-Act",
    mode: "Online",
    why: "The review rhythm that compounds",
    task: "Start monthly GAM + weekly review",
    proof: "First GAM minutes",
  },
  {
    week: 7,
    phase: "Systems",
    topic: "CRM Implementation",
    mode: "Offline",
    why: "Never lose a lead again",
    task: "Set up CRM, import leads, define stages",
    proof: "CRM live with real leads",
  },
  {
    week: 8,
    phase: "Systems",
    topic: "CRM + Automation (Uniklife SAS)",
    mode: "Offline",
    why: "Automate the repetitive work",
    task: "Automate follow-ups & tasks",
    proof: "2+ automations live",
  },
  {
    week: 9,
    phase: "Sell",
    topic: "Branding, USP & 4M Message",
    mode: "Online",
    why: "Why customers should choose you",
    task: "Finalise USP + 4M message",
    proof: "USP + message doc",
  },
  {
    week: 10,
    phase: "Sell",
    topic: "Content + Video Engine",
    mode: "Online",
    why: "Show up consistently",
    task: "Plan + publish content/videos",
    proof: "1 week of content live",
  },
  {
    week: 11,
    phase: "Sell",
    topic: "Lead Generation + Marketing Review",
    mode: "Online",
    why: "Turn on daily leads",
    task: "Launch 1 lead source + weekly review",
    proof: "Leads coming in daily",
  },
  {
    week: 12,
    phase: "Sell",
    topic: "Sales STEPS + SCRIPTS",
    mode: "Online",
    why: "A repeatable sales process",
    task: "Build the sales steps + scripts",
    proof: "Script in use",
  },
  {
    week: 13,
    phase: "Sell",
    topic: "Objection Handling + Closing",
    mode: "Online",
    why: "Convert more, discount less",
    task: "Train objections + closing",
    proof: "Closing rate tracked",
  },
  {
    week: 14,
    phase: "Sell",
    topic: "Follow-up + Sales Team Training",
    mode: "Offline",
    why: "No lead left behind",
    task: "Follow-up system + team role-plays",
    proof: "Sales team trained",
  },
  {
    week: 15,
    phase: "Review",
    topic: "Final Review",
    mode: "Offline",
    why: "What's working, what to fix",
    task: "Full systems + numbers review",
    proof: "Completed review scorecard",
  },
  {
    week: 16,
    phase: "Review",
    topic: "Graduation & Certificate",
    mode: "Offline",
    why: "Celebrate & commit to the next level",
    task: "Before-after + goal reveal + certificate",
    proof: "Before-after results",
  },
];

// ---- Points & stages ----
// Weekly task + proof scores 250/week for Weeks 1–14 (3500 total); Weeks 15–16
// score nothing. Each daily habit task ticked is worth 10.
export const VKM_POINTS = {
  taskProofPerWeek: 250, // per week, task done + proof (Weeks 1–14)
  scoringWeeks: 14, // Weeks 15–16 score no points
  programPointsTotal: 3500, // 250 × 14
  habitPerTask: 10, // per daily habit task ticked
} as const;

export const VKM_POINT_RULES = [
  { action: "Complete the weekly task + proof (Weeks 1–14)", points: "+250 / week" },
  { action: "Daily habit — each task ticked", points: "+10 / task" },
  { action: "Weeks 15–16", points: "No points" },
];

export type Stage = { name: string; min: number; max: number | null };
// Bands rescaled for the points-v2 ceiling (weekly 3,500 + habits + bonuses ≈ 10k).
export const VKM_STAGES: Stage[] = [
  { name: "Starter", min: 0, max: 1499 },
  { name: "Builder", min: 1500, max: 3499 },
  { name: "Operator", min: 3500, max: 5999 },
  { name: "Closer", min: 6000, max: 8499 },
  { name: "Growth Champion", min: 8500, max: null },
];

export function stageFor(points: number): Stage {
  return (
    VKM_STAGES.find((s) => points >= s.min && (s.max === null || points <= s.max)) ?? VKM_STAGES[0]
  );
}

// ---- Milestones ----
export type Milestone = {
  code: "goal_setter" | "system_builder" | "growth_champion";
  name: string;
  unlockWeek: number;
  costInr: number;
  reward: string; // headline reward
  description: string; // what it is + why it matters
  items: string[]; // what's included
  handover: string;
};

export const VKM_MILESTONES: Milestone[] = [
  {
    code: "goal_setter",
    name: "Goal Setter",
    unlockWeek: 3,
    costInr: 2000,
    reward: "Elite Lunch with Venu Kalyan",
    description:
      "Celebrate setting your growth goal with an exclusive private lunch with Venu Kalyan — direct mentorship and strategy, one-to-one over the table.",
    items: [
      "Private elite lunch with Venu Kalyan",
      "1:1 goal & strategy conversation",
      "Goal Setter recognition + social shout-out",
    ],
    handover: "Hosted in person once you unlock Week 3",
  },
  {
    code: "system_builder",
    name: "System Builder",
    unlockWeek: 6,
    costInr: 3000,
    reward: "Podcast & Promotional Video with Venu Kalyan",
    description:
      "Feature on Venu Kalyan's podcast and receive a professionally produced promotional video for your business — built to market you while you build your systems.",
    items: [
      "Podcast feature with Venu Kalyan",
      "Professionally produced promotional video for your business",
      "Shared across VK Mentorship channels",
    ],
    handover: "Recorded with the VK team after Week 6",
  },
  {
    code: "growth_champion",
    name: "Growth Champion",
    unlockWeek: 14,
    costInr: 5000,
    reward: "Graduation + 2-Day Offline Workshop with Venu Kalyan",
    description:
      "The grand finale — your graduation certificate, a celebration treat for your business, and an exclusive two-day offline workshop with Venu Kalyan to lock in your next phase of growth.",
    items: [
      "Graduation certificate",
      "Business sweet-treat celebration",
      "Two-day offline workshop with Venu Kalyan",
    ],
    handover: "Awarded at graduation (Week 14–16)",
  },
];

// ---- Onboarding (owned by Soumya) ----
export type OnboardingStep = {
  step: number;
  description: string;
  owner: "Soumya" | "Coach" | "Participant";
  doneBy: string;
};

export const VKM_ONBOARDING: OnboardingStep[] = [
  {
    step: 1,
    description: "Payment confirmed (₹8,00,000) + welcome sent",
    owner: "Soumya",
    doneBy: "Day 0",
  },
  {
    step: 2,
    description: "Added to WhatsApp group + digital welcome kit",
    owner: "Soumya",
    doneBy: "Day 1",
  },
  { step: 3, description: "Growth Coach assigned & introduced", owner: "Soumya", doneBy: "Day 2" },
  {
    step: 4,
    description: "Kickoff 1:1 + baseline captured (Business Brain)",
    owner: "Coach",
    doneBy: "Day 3–5",
  },
  {
    step: 5,
    description: "AI Advisor + UNIKLIFE.AI + tracker set up",
    owner: "Coach",
    doneBy: "Day 5",
  },
  { step: 6, description: "First Tuesday class attended", owner: "Participant", doneBy: "Week 1" },
  {
    step: 7,
    description: "Week 1 task (Lifestyle + OMM) started",
    owner: "Coach",
    doneBy: "Week 1",
  },
];

// ---- Coach playbook ----
export const VKM_COACH_PLAYBOOK = {
  role: "You are the engine of implementation. VK gives the WHY in the Tuesday class; you make sure each participant actually DOES it in their business.",
  weekly_1on1: [
    { block: "Review", mins: 5, what: "Check last week's task & proof, award points" },
    { block: "Connect", mins: 5, what: "Wins, blockers, mindset" },
    { block: "Apply", mins: 25, what: "Take this week's VK topic and apply it to THEIR business" },
    { block: "Assign", mins: 5, what: "Set the exact task + the proof you'll collect" },
    { block: "Commit", mins: 5, what: "Confirm date, log in tracker, motivate" },
  ],
  dos: [
    "Make them implement in the session — don't just advise",
    "Collect proof BEFORE awarding points",
    "Visit in person on offline weeks (3, 4, 7, 8, 14, 15, 16) and work with the whole team",
    "Call the same day a task is missed — don't wait",
    "Escalate to VK / Soumya if stuck 2 weeks in a row",
  ],
  donts: [
    "Don't do the work FOR them — guide, don't replace",
    "Don't create USPs / taglines / branding yourself — that is VK's team's work",
    "Don't award points without proof",
  ],
  weekly_report: [
    "Update Master Tracker: attendance, task, proof, points",
    "Report cohort progress to VK / Soumya",
    "Flag any at-risk participant early",
  ],
};

// ---- VK (Mentor) Tuesday class format ----
export const VKM_VK_CLASS_FORMAT = [
  { block: "Open & Energy", mins: "5–10", what: "Welcome, this week's theme, set the tone" },
  { block: "Wins Recap", mins: "10", what: "Celebrate last week's results — call out Champions" },
  { block: "Teach the WHY", mins: "20–30", what: "Why this week's topic matters to their money" },
  { block: "Show the WHAT", mins: "20–30", what: "The exact framework / steps they'll implement" },
  { block: "Assign", mins: "5–10", what: "The clear task + what 'done' looks like" },
  { block: "Close", mins: "5", what: "Motivation + hand over to the coaches" },
];

// ---- AI Business Advisor ----
export const VKM_AI_ADVISOR = {
  intro:
    "Every VKM participant gets a Personal AI Business Advisor — a private AI project trained on their own business (their Business Brain). 24/7, in VK's methodology.",
  brainFields: [
    "Business name, industry, location, years running",
    "Current monthly revenue, target revenue, and timeline",
    "Team size and key roles",
    "Top 3 products/services and their margins",
    "Main lead sources today and monthly lead count",
    "Current closing rate and average deal size",
    "Biggest 3 challenges right now",
    "What 'success in 4 months' looks like to them",
  ],
  promptTemplate: `You are the personal business advisor for [NAME], owner of [BUSINESS] in [LOCATION]. You follow Venu Kalyan's methodology: Implementation + Accountability + Systems = Growth. The owner is in the 4-month VK Mentorship (16 weeks: Foundation, Systems, Sell, Review). Use their Business Brain (below) as context. Give simple, practical, action-first advice in easy language — never heavy theory. Always tie advice to revenue, leads, closing, systems, or team. Ask 3–5 clarifying questions before giving any role-clarity, culture, GAM, marketing, or sales output — never generic content. Never invent numbers. [PASTE BUSINESS BRAIN HERE]`,
  dailyUse: [
    "Morning: ask it to plan the day's top 3 actions",
    "Before decisions: ask it to pressure-test the plan",
    "Stuck on a task: ask it for the simplest next step",
  ],
};

// ---- Helpers ----
export function weekByNumber(n: number): ProgramWeek | undefined {
  return VKM_WEEKS.find((w) => w.week === n);
}
export function phaseOf(week: number): Phase {
  return VKM_PROGRAM.phases.find((p) => p.weeks.includes(week))?.name ?? "Foundation";
}
export function isOfflineWeek(week: number): boolean {
  return VKM_PROGRAM.offlineWeeks.includes(week);
}
