import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { uploadToStorage } from "@/lib/storage-upload";

export const PILLARS = [
  "Revenue & Profit",
  "Team & Culture",
  "Product & Operations",
  "Brand & Market",
  "Personal & Lifestyle",
] as const;
export type Pillar = (typeof PILLARS)[number];

export const GOAL_STATUSES = ["not_started", "on_track", "at_risk", "achieved"] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

// One-tap starting points per pillar — pre-fill the goal name + unit so owners
// who don't know what to write get a head start (they can still type their own).
export type GoalTemplate = { title: string; unit: string };
export const GOAL_TEMPLATES: Record<Pillar, GoalTemplate[]> = {
  "Revenue & Profit": [
    { title: "Hit a monthly revenue target", unit: "₹/mo" },
    { title: "Reach an annual revenue", unit: "Cr" },
    { title: "Improve profit margin", unit: "%" },
    { title: "Add a new revenue stream", unit: "streams" },
  ],
  "Team & Culture": [
    { title: "Make a key hire", unit: "hires" },
    { title: "Grow the team", unit: "people" },
    { title: "Build a leadership layer", unit: "leaders" },
    { title: "Run weekly team rhythms", unit: "weeks" },
  ],
  "Product & Operations": [
    { title: "Launch a new product or service", unit: "launches" },
    { title: "Document core SOPs", unit: "SOPs" },
    { title: "Cut delivery time", unit: "days" },
    { title: "Automate a key process", unit: "processes" },
  ],
  "Brand & Market": [
    { title: "Grow social following", unit: "followers" },
    { title: "Enter a new market or city", unit: "markets" },
    { title: "Publish content consistently", unit: "posts/mo" },
    { title: "Collect customer reviews", unit: "reviews" },
  ],
  "Personal & Lifestyle": [
    { title: "Build a personal habit", unit: "days" },
    { title: "Work fewer hours a week", unit: "hrs/wk" },
    { title: "Take planned time off", unit: "days" },
    { title: "Invest in self-growth", unit: "books" },
  ],
};

export type VisionImage = { url: string; caption?: string };

export type VisionStatement = {
  statement: string | null; // 5-year north star
  statement_1yr: string | null; // 1-year north star (the route you walk now)
  primary_goal: string | null; // short headline goal — shown on the dashboard banner
  target_revenue_inr: number | null;
  target_team_size: number | null;
  lifestyle_goal: string | null;
  images: VisionImage[];
};

export type VisionGoal = {
  id: string;
  year: number;
  title: string;
  category: Pillar;
  target_value: number | null;
  current_value: number | null;
  unit: string | null;
  target_date: string | null;
  status: GoalStatus;
  why: string | null;
  sort_order: number;
};

export type GoalInput = Omit<VisionGoal, "id" | "sort_order">;

const EMPTY_STATEMENT: VisionStatement = {
  statement: null,
  statement_1yr: null,
  primary_goal: null,
  target_revenue_inr: null,
  target_team_size: null,
  lifestyle_goal: null,
  images: [],
};

type GoalRow = {
  id: string;
  year: number;
  title: string;
  category: string;
  target_value: number | null;
  current_value: number | null;
  unit: string | null;
  target_date: string | null;
  status: string;
  why: string | null;
  sort_order: number;
};

function rowToGoal(r: GoalRow): VisionGoal {
  return {
    id: r.id,
    year: r.year,
    title: r.title,
    category: r.category as Pillar,
    target_value: r.target_value,
    current_value: r.current_value,
    unit: r.unit,
    target_date: r.target_date,
    status: r.status as GoalStatus,
    why: r.why,
    sort_order: r.sort_order,
  };
}

export function useVision() {
  const { user } = useAuth();
  const [statement, setStatement] = useState<VisionStatement>(EMPTY_STATEMENT);
  const [goals, setGoals] = useState<VisionGoal[]>([]);
  const [loading, setLoading] = useState(true);

  const stmtRef = useRef(statement);
  stmtRef.current = statement;
  const goalsRef = useRef(goals);
  goalsRef.current = goals;

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const [{ data: s }, { data: g }] = await Promise.all([
        supabase
          .from("vision_statements")
          .select(
            "statement, statement_1yr, primary_goal, target_revenue_inr, target_team_size, lifestyle_goal, images",
          )
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("vision_goals")
          .select(
            "id, year, title, category, target_value, current_value, unit, target_date, status, why, sort_order",
          )
          .eq("user_id", user.id)
          .order("year")
          .order("sort_order"),
      ]);
      if (!active) return;
      if (s)
        setStatement({
          statement: s.statement,
          statement_1yr: s.statement_1yr,
          primary_goal: s.primary_goal,
          target_revenue_inr: s.target_revenue_inr,
          target_team_size: s.target_team_size,
          lifestyle_goal: s.lifestyle_goal,
          images: (s.images as VisionImage[] | null) ?? [],
        });
      setGoals((g ?? []).map(rowToGoal));
      setLoading(false);
    })().catch(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [user]);

  const saveStatement = useCallback(
    async (patch: Partial<VisionStatement>) => {
      if (!user) return;
      const next = { ...stmtRef.current, ...patch };
      setStatement(next);
      await supabase.from("vision_statements").upsert(
        {
          user_id: user.id,
          statement: next.statement,
          statement_1yr: next.statement_1yr,
          primary_goal: next.primary_goal,
          target_revenue_inr: next.target_revenue_inr,
          target_team_size: next.target_team_size,
          lifestyle_goal: next.lifestyle_goal,
          images: next.images,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    },
    [user],
  );

  const addGoal = useCallback(
    async (input: GoalInput) => {
      if (!user) return;
      const sort =
        goalsRef.current
          .filter((g) => g.year === input.year)
          .reduce((m, g) => Math.max(m, g.sort_order), -1) + 1;
      const { data } = await supabase
        .from("vision_goals")
        .insert({ user_id: user.id, ...input, sort_order: sort })
        .select(
          "id, year, title, category, target_value, current_value, unit, target_date, status, why, sort_order",
        )
        .single();
      if (data) setGoals((g) => [...g, rowToGoal(data)]);
    },
    [user],
  );

  const updateGoal = useCallback(async (id: string, patch: Partial<GoalInput>) => {
    setGoals((gs) => gs.map((g) => (g.id === id ? { ...g, ...patch } : g)));
    await supabase
      .from("vision_goals")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id);
  }, []);

  const deleteGoal = useCallback(async (id: string) => {
    setGoals((gs) => gs.filter((g) => g.id !== id));
    await supabase.from("vision_goals").delete().eq("id", id);
  }, []);

  const uploadImage = useCallback(
    async (file: File) => {
      if (!user) return;
      const safe = file.name.replace(/[^\w.-]+/g, "_");
      const path = `${user.id}/${Date.now()}-${safe}`;
      const url = await uploadToStorage("vision-board", path, file);
      await saveStatement({ images: [...stmtRef.current.images, { url }] });
    },
    [user, saveStatement],
  );

  const removeImage = useCallback(
    async (url: string) => {
      await saveStatement({ images: stmtRef.current.images.filter((i) => i.url !== url) });
    },
    [saveStatement],
  );

  return {
    statement,
    goals,
    loading,
    saveStatement,
    addGoal,
    updateGoal,
    deleteGoal,
    uploadImage,
    removeImage,
  };
}

/** Headline goal + this-year progress rollup — for the dashboard banner. */
export function usePrimaryGoal() {
  const { user } = useAuth();
  const [goal, setGoal] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [goalCount, setGoalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const [{ data: s }, { data: g }] = await Promise.all([
        supabase
          .from("vision_statements")
          .select("primary_goal")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("vision_goals")
          .select("target_value, current_value, status")
          .eq("user_id", user.id)
          .eq("year", 1),
      ]);
      if (!active) return;
      setGoal(s?.primary_goal ?? null);
      const rows = g ?? [];
      setGoalCount(rows.length);
      setProgress(
        rows.length
          ? Math.round(rows.reduce((n, r) => n + goalProgress(r), 0) / rows.length)
          : null,
      );
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [user]);

  return { goal, progress, goalCount, loading };
}

// ---- shared display helpers ---------------------------------------------
export const STATUS_META: Record<GoalStatus, { label: string; cls: string }> = {
  not_started: { label: "Not started", cls: "bg-secondary text-muted-foreground" },
  on_track: {
    label: "On track",
    cls: "bg-[oklch(0.93_0.06_160)] text-[oklch(0.35_0.12_160)]",
  },
  at_risk: { label: "At risk", cls: "bg-[oklch(0.95_0.05_70)] text-[oklch(0.45_0.12_70)]" },
  achieved: { label: "Achieved", cls: "bg-gradient-gold text-navy" },
};

export const PILLAR_COLOR: Record<Pillar, string> = {
  "Revenue & Profit": "#10b981",
  "Team & Culture": "#8b5cf6",
  "Product & Operations": "#3b82f6",
  "Brand & Market": "#f59e0b",
  "Personal & Lifestyle": "#ec4899",
};

export function goalProgress(g: {
  status: string;
  target_value: number | null;
  current_value: number | null;
}): number {
  if (g.status === "achieved") return 100;
  if (g.target_value == null || g.target_value === 0 || g.current_value == null) return 0;
  return Math.max(0, Math.min(100, Math.round((g.current_value / g.target_value) * 100)));
}

/** Compact INR formatter (₹1.2Cr / ₹5L / ₹40K). */
export function inrShort(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(n % 1e7 === 0 ? 0 : 1)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(n % 1e5 === 0 ? 0 : 1)}L`;
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(0)}K`;
  return `₹${n}`;
}
