import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { format, isToday, isYesterday } from "date-fns";
import {
  Coins,
  Loader2,
  ClipboardCheck,
  CalendarDays,
  Activity,
  TrendingUp,
  Users,
  Handshake,
  Gift,
  Star,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/vkm/page-header";
import { SectionCard } from "@/components/vkm/section-card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { stageFor } from "@/lib/vkm/program";

type Row = {
  id: string;
  source: string;
  reference: string | null;
  points: number;
  awarded_at: string;
};

const META: Record<string, { label: string; icon: LucideIcon; color: string }> = {
  task: { label: "Weekly task", icon: ClipboardCheck, color: "#10b981" },
  attend: { label: "Class attendance", icon: CalendarDays, color: "#3b82f6" },
  habit: { label: "Daily habit", icon: Activity, color: "#8b5cf6" },
  revenue: { label: "Revenue milestone", icon: TrendingUp, color: "#C8A84B" },
  leads: { label: "Leads", icon: Users, color: "#0ea5e9" },
  closing: { label: "Closing", icon: Handshake, color: "#f59e0b" },
  bonus: { label: "Bonus", icon: Gift, color: "#ec4899" },
  manual: { label: "Award", icon: Star, color: "#C8A84B" },
};
const metaFor = (s: string) => META[s] ?? { label: "Points", icon: Coins, color: "#6B7280" };

function dayLabel(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "EEEE, MMM d");
}

export function PointsHistoryPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void supabase
      .from("points_ledger")
      .select("id, source, reference, points, awarded_at")
      .eq("user_id", user.id)
      .order("awarded_at", { ascending: false })
      .then(({ data }) => {
        if (!active) return;
        setRows((data ?? []) as Row[]);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const total = useMemo(() => rows.reduce((n, r) => n + r.points, 0), [rows]);
  const stage = stageFor(total);

  // Breakdown by source (for the summary chips).
  const breakdown = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) => m.set(r.source, (m.get(r.source) ?? 0) + r.points));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  // Group rows by calendar day for a clean timeline.
  const groups = useMemo(() => {
    const m = new Map<string, Row[]>();
    rows.forEach((r) => {
      const key = dayLabel(r.awarded_at);
      const arr = m.get(key) ?? [];
      arr.push(r);
      m.set(key, arr);
    });
    return [...m.entries()];
  }, [rows]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      <PageHeader
        eyebrow="Participant"
        title="Points History"
        description="Every XP you've earned — weekly proofs, daily habits, and awards."
        icon={Coins}
      />

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryTile icon={Coins} label="Total XP" value={total.toLocaleString("en-IN")} accent="#C8A84B" />
        <SummaryTile icon={Trophy} label="Stage" value={stage.name} accent="#8b5cf6" />
        <SummaryTile icon={Activity} label="Entries" value={String(rows.length)} accent="#10b981" />
        <SummaryTile
          icon={metaFor(breakdown[0]?.[0] ?? "").icon}
          label="Top source"
          value={breakdown[0] ? metaFor(breakdown[0][0]).label : "—"}
          accent={metaFor(breakdown[0]?.[0] ?? "").color}
        />
      </div>

      {/* Breakdown chips */}
      {breakdown.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {breakdown.map(([source, pts]) => {
            const m = metaFor(source);
            return (
              <span
                key={source}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs"
              >
                <m.icon className="h-3.5 w-3.5" style={{ color: m.color }} />
                {m.label}
                <span className="font-bold tabular-nums text-foreground">+{pts}</span>
              </span>
            );
          })}
        </div>
      )}

      {/* Timeline */}
      <SectionCard title="Activity" subtitle="Newest first" bodyClassName="p-0">
        {loading ? (
          <p className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your points…
          </p>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center text-muted-foreground">
            <Coins className="h-8 w-8 opacity-30" />
            <p className="text-sm">No points yet — submit a weekly proof or complete a habit to start earning XP.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {groups.map(([day, items]) => (
              <div key={day}>
                <div className="flex items-center justify-between bg-secondary/40 px-4 py-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {day}
                  </span>
                  <span className="text-[11px] font-bold tabular-nums text-[oklch(0.5_0.11_80)]">
                    +{items.reduce((n, r) => n + r.points, 0)} XP
                  </span>
                </div>
                <ul>
                  {items.map((r) => {
                    const m = metaFor(r.source);
                    return (
                      <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                        <span
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                          style={{ background: `${m.color}1a`, color: m.color }}
                        >
                          <m.icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {r.reference || m.label}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {m.label} · {format(new Date(r.awarded_at), "h:mm a")}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${
                            r.points >= 0
                              ? "bg-[oklch(0.93_0.06_160)] text-[oklch(0.35_0.12_160)]"
                              : "bg-destructive/15 text-destructive"
                          }`}
                        >
                          {r.points >= 0 ? "+" : ""}
                          {r.points}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </motion.div>
  );
}

function SummaryTile({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" style={{ color: accent }} />
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      </div>
      <p className="mt-1 truncate text-xl font-bold tabular-nums text-foreground">{value}</p>
    </div>
  );
}
