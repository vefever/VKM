import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import {
  Telescope,
  Plus,
  ImagePlus,
  X,
  Loader2,
  Sparkles,
  Target,
  ArrowRight,
  Flag,
  Lightbulb,
  ArrowUp,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/vkm/page-header";
import { SectionCard } from "@/components/vkm/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  useVision,
  goalProgress,
  inrShort,
  PILLARS,
  PILLAR_COLOR,
  type Pillar,
  type VisionGoal,
  type VisionStatement,
  type VisionImage,
} from "@/components/participant/vision-data";
import { GoalCard, GoalEditorDialog } from "@/components/participant/vision-goals";

export function VisionBoardPage() {
  const v = useVision();
  const { statement, goals, loading } = v;
  const baseYear = new Date().getFullYear();

  const [pillar, setPillar] = useState<Pillar | "all">("all");
  const [selectedYear, setSelectedYear] = useState(1);
  const [editor, setEditor] = useState<{ open: boolean; year: number; goal: VisionGoal | null }>({
    open: false,
    year: 1,
    goal: null,
  });

  const filtered = pillar === "all" ? goals : goals.filter((g) => g.category === pillar);
  // "Vision set" = any commitment made: a 1-year or 5-year statement, or a goal.
  const visionSet = !!(
    statement.statement?.trim() ||
    statement.statement_1yr?.trim() ||
    goals.length > 0
  );
  const yearsMapped = new Set(goals.map((g) => g.year)).size;
  const onTrackPct = goals.length
    ? Math.round(
        (goals.filter((g) => g.status === "on_track" || g.status === "achieved").length /
          goals.length) *
          100,
      )
    : 0;
  const overall = goals.length
    ? Math.round(goals.reduce((n, g) => n + goalProgress(g), 0) / goals.length)
    : 0;
  const isEmpty = !loading && !visionSet && goals.length === 0;

  function openEditor(year: number, goal: VisionGoal | null) {
    setEditor({ open: true, year, goal });
  }
  function saveGoal(input: Parameters<typeof v.addGoal>[0]) {
    if (editor.goal) v.updateGoal(editor.goal.id, input);
    else v.addGoal(input);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6 pb-24"
    >
      <PageHeader
        eyebrow="Business"
        title="My Vision"
        description={`Start with this year, then build toward your ${baseYear + 5} picture — define it, then grow into it.`}
        icon={Telescope}
        actions={
          <Button variant="outline" size="sm" className="rounded-full" asChild>
            <Link to="/participant/progress">
              View curriculum <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      />

      <HeroStats
        progress={overall}
        visionSet={visionSet}
        yearsMapped={yearsMapped}
        goalsCount={goals.length}
        onTrackPct={onTrackPct}
      />

      {/* Plain-language intro — what a vision is, and where to start */}
      <p className="px-1 text-sm text-muted-foreground">
        A <span className="font-medium text-foreground">vision</span> is a clear picture of where
        you want your business to go — plus the goals that get you there. Start with{" "}
        <span className="font-medium text-foreground">this year</span>, then zoom out to five.
      </p>

      {isEmpty && <Onboarding />}

      {/* 1-Year Vision — the route you walk now (leads the page) */}
      <div id="this-year" className="scroll-mt-20">
        <OneYearVision
          baseYear={baseYear}
          statement={statement}
          onSave={v.saveStatement}
          goals={goals}
          onAdd={() => openEditor(1, null)}
          onEdit={(g) => openEditor(g.year, g)}
          onDelete={v.deleteGoal}
        />
      </div>

      {/* The 5-year picture — the destination */}
      <div className="flex items-center gap-2">
        <span className="h-px flex-1 bg-border" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          The 5-year picture
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <VisionStatementCard statement={statement} onSave={v.saveStatement} baseYear={baseYear} />

      {/* Pillar filter */}
      <PillarFilter pillar={pillar} onChange={setPillar} />

      {/* 5-year timeline */}
      <FiveYearTimeline
        baseYear={baseYear}
        goals={filtered}
        selectedYear={selectedYear}
        onSelectYear={setSelectedYear}
        onAdd={(year) => openEditor(year, null)}
        onEdit={(g) => openEditor(g.year, g)}
        onDelete={v.deleteGoal}
        onManageThisYear={() =>
          document
            .getElementById("this-year")
            ?.scrollIntoView({ behavior: "smooth", block: "start" })
        }
      />

      {/* Vision imagery */}
      <VisionImagery images={statement.images} onUpload={v.uploadImage} onRemove={v.removeImage} />

      <GoalEditorDialog
        open={editor.open}
        onOpenChange={(open) => setEditor((e) => ({ ...e, open }))}
        year={editor.year}
        initial={editor.goal}
        onSave={saveGoal}
      />
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Hero stats + progress ring
// ---------------------------------------------------------------------------
function HeroStats({
  progress,
  visionSet,
  yearsMapped,
  goalsCount,
  onTrackPct,
}: {
  progress: number;
  visionSet: boolean;
  yearsMapped: number;
  goalsCount: number;
  onTrackPct: number;
}) {
  const stats = [
    { label: "Vision set", value: visionSet ? "Set" : "Not yet" },
    { label: "Years mapped", value: `${yearsMapped}/5` },
    { label: "Goals defined", value: String(goalsCount) },
    { label: "On track", value: `${onTrackPct}%` },
  ];
  return (
    <div className="overflow-hidden rounded-3xl bg-gradient-navy p-4 text-primary-foreground shadow-vkm-float sm:p-5">
      <div className="flex items-center gap-4">
        <Ring value={progress} />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
            Vision progress
          </p>
          <p className="text-lg font-bold sm:text-xl">{progress}% toward your 5-year picture</p>
          <p className="text-xs text-white/70">Rolls up the progress of every goal you set.</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl bg-white/10 px-3 py-2 text-center">
            <p className="text-base font-bold tabular-nums sm:text-lg">{s.value}</p>
            <p className="text-[10px] uppercase tracking-wide text-white/60">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Ring({ value, size = 76, stroke = 8 }: { value: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (Math.max(0, Math.min(100, value)) / 100) * c;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={stroke}
          fill="none"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#vg-grad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: off }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
        <defs>
          <linearGradient id="vg-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f7d774" />
            <stop offset="100%" stopColor="#c79a1e" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold tabular-nums">{value}%</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty-state onboarding
// ---------------------------------------------------------------------------
function Onboarding() {
  const steps = [
    "Write your 1-year north-star — start here",
    "Add 3–5 focused goals for this year",
    "Zoom out: set your 5-year picture & targets",
  ];
  return (
    <SectionCard className="border-gold/40 bg-gold/[0.05]">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-gold text-navy">
          <Sparkles className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-semibold text-foreground">
            Set your vision in 3 steps — start with this year
          </p>
          <ol className="mt-2 space-y-1">
            {steps.map((s, i) => (
              <li key={s} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-navy text-[10px] font-bold text-primary-foreground">
                  {i + 1}
                </span>
                {s}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// 1-Year Vision — the near-term anchor. Leads the page; pulls Year-1 goals.
// ---------------------------------------------------------------------------
function OneYearVision({
  baseYear,
  statement,
  onSave,
  goals,
  onAdd,
  onEdit,
  onDelete,
}: {
  baseYear: number;
  statement: VisionStatement;
  onSave: (patch: Partial<VisionStatement>) => void;
  goals: VisionGoal[];
  onAdd: () => void;
  onEdit: (g: VisionGoal) => void;
  onDelete: (id: string) => void;
}) {
  const [text, setText] = useState(statement.statement_1yr ?? "");
  useEffect(() => setText(statement.statement_1yr ?? ""), [statement.statement_1yr]);
  const [headline, setHeadline] = useState(statement.primary_goal ?? "");
  useEffect(() => setHeadline(statement.primary_goal ?? ""), [statement.primary_goal]);

  const yearGoals = goals.filter((g) => g.year === 1);
  const targets = [
    statement.target_revenue_inr != null
      ? { label: "Revenue", value: inrShort(statement.target_revenue_inr) }
      : null,
    statement.target_team_size != null
      ? { label: "Team", value: `${statement.target_team_size}` }
      : null,
    statement.lifestyle_goal ? { label: "Lifestyle", value: statement.lifestyle_goal } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <SectionCard
      accent
      title={
        <span className="flex items-center gap-2">
          <Flag className="h-4 w-4 text-gold" /> This Year — your 1-year vision
        </span>
      }
      subtitle={`The route you can walk now. Set 3–5 focused goals for ${baseYear + 1}.`}
      action={
        <Button
          size="sm"
          className="rounded-lg bg-gradient-navy text-primary-foreground hover:opacity-90"
          onClick={onAdd}
        >
          <Plus className="h-4 w-4" /> Add goal
        </Button>
      }
    >
      {/* #1 goal — the headline that greets them on the dashboard */}
      <label className="mb-3 block rounded-xl border border-gold/40 bg-gold/[0.06] p-3">
        <span className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gold">
          <Flag className="h-3.5 w-3.5" /> Your #1 goal this year
        </span>
        <Input
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          onBlur={() => onSave({ primary_goal: headline.trim() || null })}
          placeholder="e.g. Reach ₹10L/month in revenue"
          className="rounded-lg border-gold/30 bg-card text-base font-semibold"
        />
        <span className="mt-1 block text-[11px] text-muted-foreground">
          This greets you on your dashboard every time you log in.
        </span>
      </label>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => onSave({ statement_1yr: text.trim() || null })}
        placeholder={`By the end of ${baseYear + 1}, my business will…`}
        className="min-h-[80px] rounded-xl text-sm"
      />

      {targets.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">
            Chipping toward your 5-year targets:
          </span>
          {targets.map((t) => (
            <span
              key={t.label}
              className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-foreground"
            >
              {t.label}: {t.value}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3">
        {yearGoals.length === 0 ? (
          <OneYearEmptyExample onAdd={onAdd} />
        ) : (
          <div className={cn("grid gap-2.5", yearGoals.length > 1 && "sm:grid-cols-2")}>
            {yearGoals.map((g) => (
              <GoalCard
                key={g.id}
                goal={g}
                onEdit={() => onEdit(g)}
                onDelete={() => onDelete(g.id)}
              />
            ))}
          </div>
        )}
      </div>
    </SectionCard>
  );
}

function OneYearEmptyExample({ onAdd }: { onAdd: () => void }) {
  const color = PILLAR_COLOR["Revenue & Profit"];
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-dashed border-gold/50 bg-gold/[0.04] p-3">
        <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gold">
          <Lightbulb className="h-3.5 w-3.5" /> Example — what a good goal looks like
        </div>
        <div className="flex items-start gap-2">
          <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">
              Grow monthly revenue to ₹10L/month
            </p>
            <p className="text-[11px] text-muted-foreground">Revenue &amp; Profit</p>
            <div className="mb-1 mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="tabular-nums">4 / 10 ₹L/mo</span>
              <span className="font-semibold text-foreground tabular-nums">40%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full" style={{ width: "40%", background: color }} />
            </div>
            <p className="mt-1.5 text-xs italic text-muted-foreground">
              “Hitting ₹10L/mo funds my first two hires.”
            </p>
          </div>
        </div>
      </div>
      <Button size="sm" variant="outline" className="rounded-lg" onClick={onAdd}>
        <Plus className="h-4 w-4" /> Add your first goal
      </Button>
    </div>
  );
}

// Compact, read-only row used to mirror Year-1 goals (managed in This Year).
function MirroredGoalRow({ goal }: { goal: VisionGoal }) {
  const pct = goalProgress(goal);
  const color = PILLAR_COLOR[goal.category];
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
        {goal.title}
      </span>
      {goal.target_value != null && (
        <div className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-secondary sm:block">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
        </div>
      )}
      <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
        {pct}%
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vision statement (editable, autosave on blur)
// ---------------------------------------------------------------------------
function VisionStatementCard({
  statement,
  onSave,
  baseYear,
}: {
  statement: VisionStatement;
  onSave: (patch: Partial<VisionStatement>) => void;
  baseYear: number;
}) {
  const [text, setText] = useState(statement.statement ?? "");
  const [rev, setRev] = useState(statement.target_revenue_inr?.toString() ?? "");
  const [team, setTeam] = useState(statement.target_team_size?.toString() ?? "");
  const [life, setLife] = useState(statement.lifestyle_goal ?? "");

  useEffect(() => setText(statement.statement ?? ""), [statement.statement]);
  useEffect(
    () => setRev(statement.target_revenue_inr?.toString() ?? ""),
    [statement.target_revenue_inr],
  );
  useEffect(
    () => setTeam(statement.target_team_size?.toString() ?? ""),
    [statement.target_team_size],
  );
  useEffect(() => setLife(statement.lifestyle_goal ?? ""), [statement.lifestyle_goal]);

  const num = (s: string) => (s.trim() === "" || Number.isNaN(Number(s)) ? null : Number(s));

  return (
    <SectionCard title="Your vision statement" subtitle="The north star everything else points to">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => onSave({ statement: text.trim() || null })}
        placeholder={`In 5 years (by ${baseYear + 5}), my business will…`}
        className="min-h-[80px] rounded-xl text-sm"
      />
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Target revenue
          </span>
          <Input
            inputMode="numeric"
            value={rev}
            onChange={(e) => setRev(e.target.value)}
            onBlur={() => onSave({ target_revenue_inr: num(rev) })}
            placeholder="50000000"
            className="rounded-lg"
          />
          <span className="mt-1 block text-[11px] text-muted-foreground">
            {num(rev) != null ? inrShort(num(rev)) : "₹ per year"}
          </span>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Target team size
          </span>
          <Input
            inputMode="numeric"
            value={team}
            onChange={(e) => setTeam(e.target.value)}
            onBlur={() => onSave({ target_team_size: num(team) })}
            placeholder="50"
            className="rounded-lg"
          />
          <span className="mt-1 block text-[11px] text-muted-foreground">people</span>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Lifestyle goal
          </span>
          <Input
            value={life}
            onChange={(e) => setLife(e.target.value)}
            onBlur={() => onSave({ lifestyle_goal: life.trim() || null })}
            placeholder="4-day week, travel 3×/yr…"
            className="rounded-lg"
          />
          <span className="mt-1 block text-[11px] text-muted-foreground">how life looks</span>
        </label>
      </div>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Pillar filter
// ---------------------------------------------------------------------------
function PillarFilter({
  pillar,
  onChange,
}: {
  pillar: Pillar | "all";
  onChange: (p: Pillar | "all") => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <FilterChip active={pillar === "all"} onClick={() => onChange("all")} label="All pillars" />
      {PILLARS.map((p) => (
        <FilterChip
          key={p}
          active={pillar === p}
          onClick={() => onChange(p)}
          label={p}
          color={PILLAR_COLOR[p]}
        />
      ))}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-transparent bg-gradient-navy text-primary-foreground shadow-vkm"
          : "border-border bg-card text-muted-foreground hover:bg-secondary/60",
      )}
    >
      {color && <span className="h-2 w-2 rounded-full" style={{ background: color }} />}
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// 5-year timeline
// ---------------------------------------------------------------------------
function FiveYearTimeline({
  baseYear,
  goals,
  selectedYear,
  onSelectYear,
  onAdd,
  onEdit,
  onDelete,
  onManageThisYear,
}: {
  baseYear: number;
  goals: VisionGoal[];
  selectedYear: number;
  onSelectYear: (y: number) => void;
  onAdd: (year: number) => void;
  onEdit: (g: VisionGoal) => void;
  onDelete: (id: string) => void;
  onManageThisYear: () => void;
}) {
  const years = [1, 2, 3, 4, 5];
  const yearGoals = goals.filter((g) => g.year === selectedYear);
  const isYearOne = selectedYear === 1;

  return (
    <div className="space-y-3">
      {/* timeline strip */}
      <div className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {years.map((y) => {
          const list = goals.filter((g) => g.year === y);
          const avg = list.length
            ? Math.round(list.reduce((n, g) => n + goalProgress(g), 0) / list.length)
            : 0;
          const active = y === selectedYear;
          return (
            <button
              key={y}
              type="button"
              onClick={() => onSelectYear(y)}
              className={cn(
                "app-press flex min-h-[96px] w-36 shrink-0 flex-col rounded-2xl border p-3 text-left transition-all",
                active
                  ? "border-transparent bg-gradient-navy text-primary-foreground shadow-vkm-float"
                  : "border-border bg-card hover:border-gold/40",
              )}
            >
              <span
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-wider",
                  active ? "text-white/60" : "text-muted-foreground",
                )}
              >
                Year {y}
              </span>
              <span className="text-lg font-bold">{baseYear + y}</span>
              <span
                className={cn("text-[11px]", active ? "text-white/70" : "text-muted-foreground")}
              >
                {list.length} {list.length === 1 ? "goal" : "goals"}
              </span>
              <div
                className={cn(
                  "mt-auto h-1.5 overflow-hidden rounded-full",
                  active ? "bg-white/20" : "bg-secondary",
                )}
              >
                <div
                  className={cn("h-full rounded-full", active ? "bg-gradient-gold" : "bg-navy")}
                  style={{ width: `${avg}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* selected year goals */}
      <SectionCard
        title={`Year ${selectedYear} · ${baseYear + selectedYear}`}
        subtitle={
          isYearOne
            ? "Mirrors your This Year goals above"
            : "Goals that get you to this year's picture"
        }
        action={
          isYearOne ? (
            <Button size="sm" variant="outline" className="rounded-lg" onClick={onManageThisYear}>
              Manage in This Year <ArrowUp className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              size="sm"
              className="rounded-lg bg-gradient-navy text-primary-foreground hover:opacity-90"
              onClick={() => onAdd(selectedYear)}
            >
              <Plus className="h-4 w-4" /> Add goal
            </Button>
          )
        }
      >
        {isYearOne && yearGoals.length > 0 && (
          <div className="mb-2.5 flex items-center gap-2 rounded-lg bg-secondary/50 px-3 py-2 text-[11px] text-muted-foreground">
            <Info className="h-3.5 w-3.5 shrink-0" />
            Same as your <span className="font-medium text-foreground">This Year</span> goals — edit
            them in the 1-year block at the top.
          </div>
        )}

        {yearGoals.length === 0 ? (
          isYearOne ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
                <Flag className="h-5 w-5" />
              </span>
              <p className="text-sm font-medium text-foreground">Your Year-1 goals live up top</p>
              <p className="max-w-xs text-xs text-muted-foreground">
                Add and manage them in the <span className="font-medium">This Year</span> block.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-1 rounded-lg"
                onClick={onManageThisYear}
              >
                Go to This Year <ArrowUp className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
                <Target className="h-5 w-5" />
              </span>
              <p className="text-sm font-medium text-foreground">
                No goals for Year {selectedYear} yet
              </p>
              <p className="max-w-xs text-xs text-muted-foreground">
                Add what this year looks like — a revenue target, a hire, a new market.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-1 rounded-lg"
                onClick={() => onAdd(selectedYear)}
              >
                <Plus className="h-4 w-4" /> Add your first goal
              </Button>
            </div>
          )
        ) : isYearOne ? (
          // Compact read-only mirror — the editable cards live in This Year above.
          <div className="space-y-1.5">
            {yearGoals.map((g) => (
              <MirroredGoalRow key={g.id} goal={g} />
            ))}
          </div>
        ) : (
          <div className={cn("grid gap-2.5", yearGoals.length > 1 && "sm:grid-cols-2")}>
            {yearGoals.map((g) => (
              <GoalCard
                key={g.id}
                goal={g}
                onEdit={() => onEdit(g)}
                onDelete={() => onDelete(g.id)}
              />
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vision imagery (mood board)
// ---------------------------------------------------------------------------
function VisionImagery({
  images,
  onUpload,
  onRemove,
}: {
  images: VisionImage[];
  onUpload: (f: File) => Promise<void>;
  onRemove: (url: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image");
      return;
    }
    setBusy(true);
    try {
      await onUpload(file);
    } catch (err) {
      toast.error("Upload failed", { description: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard title="Vision board" subtitle="Picture the dream — office, lifestyle, milestones">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pick} />
      {images.length === 0 ? (
        // Full-width dropzone until the first image is added.
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="app-press flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border px-4 py-10 text-center text-muted-foreground transition-colors hover:border-gold/40 hover:text-foreground"
        >
          {busy ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <>
              <ImagePlus className="h-6 w-6" />
              <span className="text-sm font-medium text-foreground">Add your first image</span>
              <span className="max-w-xs text-xs text-muted-foreground">
                Drop in a few pictures that capture the future you’re building — your office,
                lifestyle, milestones.
              </span>
            </>
          )}
        </button>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {images.map((img) => (
            <div key={img.url} className="group relative aspect-square overflow-hidden rounded-xl">
              <img
                src={img.url}
                alt={img.caption ?? "Vision"}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => onRemove(img.url)}
                className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="app-press flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-gold/40 hover:text-foreground"
          >
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <ImagePlus className="h-5 w-5" />
                <span className="text-[10px] font-medium">Add image</span>
              </>
            )}
          </button>
        </div>
      )}
    </SectionCard>
  );
}
