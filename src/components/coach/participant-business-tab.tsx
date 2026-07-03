import { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import { Briefcase, Loader2, TrendingUp, Globe, Users2, Target } from "lucide-react";
import { SectionCard } from "@/components/vkm/section-card";
import { useParticipantSnapshots, type BusinessBrain } from "@/components/coach/coach-data";
import { monthShort, monthLabel } from "@/components/business/business-data";

const inr = (n: number | null | undefined) =>
  n == null ? "—" : `₹${Number(n).toLocaleString("en-IN")}`;

const STATUS_BADGE: Record<string, string> = {
  approved: "bg-[oklch(0.93_0.06_160)] text-[oklch(0.35_0.12_160)]",
  pending: "bg-gold/15 text-[oklch(0.45_0.1_85)]",
  rejected: "bg-[oklch(0.93_0.06_25)] text-[oklch(0.45_0.16_25)]",
};

export function ParticipantBusinessTab({
  userId,
  brain,
  brainLoading,
}: {
  userId: string;
  brain: BusinessBrain | null;
  brainLoading: boolean;
}) {
  const { snapshots, loading: snapLoading } = useParticipantSnapshots(userId);

  const chart = useMemo(
    () => snapshots.map((s) => ({ label: monthShort(s.month), revenue: s.revenue_inr ?? 0 })),
    [snapshots],
  );

  return (
    <div className="space-y-4">
      <SectionCard
        title="Business Brain"
        subtitle="Captured during onboarding — powers the AI Advisor"
      >
        {brainLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !brain ? (
          <p className="py-2 text-sm text-muted-foreground">Business Brain not captured yet.</p>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              {brain.logo_url ? (
                <img
                  src={brain.logo_url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-12 w-12 shrink-0 rounded-xl border border-border object-cover"
                />
              ) : (
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-navy text-primary-foreground">
                  <Briefcase className="h-5 w-5" />
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-foreground">
                  {brain.business_name ?? "—"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {[brain.industry, brain.location].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Years running" value={brain.years_running != null ? String(brain.years_running) : "—"} />
              <Field label="Founded" value={brain.founded_year != null ? String(brain.founded_year) : "—"} />
              <Field label="Legal structure" value={brain.legal_structure ?? "—"} />
              <Field label="Business model" value={brain.business_model ?? "—"} />
              <Field label="Pricing model" value={brain.pricing_model ?? "—"} />
              <Field label="Customers" value={brain.num_customers != null ? String(brain.num_customers) : "—"} />
              <Field label="Current MRR" value={inr(brain.current_mrr_inr)} />
              <Field label="Target MRR" value={inr(brain.target_mrr_inr)} />
              <Field label="Team size" value={brain.team_size != null ? String(brain.team_size) : "—"} />
              <Field label="Monthly leads" value={brain.monthly_leads != null ? String(brain.monthly_leads) : "—"} />
              <Field label="Closing rate" value={brain.closing_rate_pct != null ? `${brain.closing_rate_pct}%` : "—"} />
              <Field label="Avg deal" value={inr(brain.avg_deal_inr)} />
              {brain.website && (
                <Field
                  icon={Globe}
                  label="Website"
                  value={brain.website}
                  href={/^https?:\/\//.test(brain.website) ? brain.website : `https://${brain.website}`}
                />
              )}
              {brain.social_handle && <Field label="Social" value={brain.social_handle} />}
              <Field icon={Target} className="sm:col-span-3" label="Target customer" value={brain.target_customer ?? "—"} />
              <Field icon={Users2} className="sm:col-span-3" label="USP" value={brain.usp ?? "—"} />
              <Field className="sm:col-span-3" label="Top products / services" value={brain.top_products ?? "—"} />
              <Field className="sm:col-span-3" label="Lead sources" value={brain.lead_sources ?? "—"} />
              <Field className="sm:col-span-3" label="Main competitors" value={brain.main_competitors ?? "—"} />
              <Field className="sm:col-span-3" label="Biggest challenges" value={brain.top_challenges ?? "—"} />
              <Field className="sm:col-span-3" label="Success in 4 months" value={brain.success_definition ?? "—"} />
            </dl>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Monthly business snapshots"
        subtitle={`${snapshots.length} month${snapshots.length === 1 ? "" : "s"} logged`}
      >
        {snapLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : snapshots.length === 0 ? (
          <p className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4" /> No monthly numbers logged yet.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="h-[180px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chart} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="biz-rev-area" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0B2545" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#0B2545" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="0" vertical={false} stroke="oklch(0.9 0.01 90)" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={(v) => inr(v)} tickLine={false} axisLine={false} width={52} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => [inr(v), "Revenue"]} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                  <Area type="monotone" dataKey="revenue" stroke="#0B2545" strokeWidth={2} fill="url(#biz-rev-area)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2">
              {[...snapshots].reverse().map((s) => (
                <div key={s.id} className="rounded-xl border border-border bg-card p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">{monthLabel(s.month)}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${STATUS_BADGE[s.status] ?? "bg-muted text-muted-foreground"}`}>
                      {s.status}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-4">
                    <Stat label="Revenue" value={inr(s.revenue_inr)} />
                    <Stat label="MRR" value={inr(s.mrr_inr)} />
                    <Stat label="Leads" value={s.leads != null ? String(s.leads) : "—"} />
                    <Stat label="Deals" value={s.deals != null ? String(s.deals) : "—"} />
                    <Stat label="Pipeline" value={inr(s.pipeline_inr)} />
                    <Stat label="Avg deal" value={inr(s.avg_deal_inr)} />
                    <Stat label="Closing %" value={s.closing_rate_pct != null ? `${s.closing_rate_pct}%` : "—"} />
                    <Stat label="NPS" value={s.nps != null ? String(s.nps) : "—"} />
                  </div>
                  {(s.reflection_win || s.reflection_blocker) && (
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {s.reflection_win && (
                        <p className="rounded-lg bg-[oklch(0.96_0.03_160)] px-2.5 py-1.5 text-xs text-foreground">
                          <span className="font-semibold">Win:</span> {s.reflection_win}
                        </p>
                      )}
                      {s.reflection_blocker && (
                        <p className="rounded-lg bg-[oklch(0.96_0.03_25)] px-2.5 py-1.5 text-xs text-foreground">
                          <span className="font-semibold">Blocker:</span> {s.reflection_blocker}
                        </p>
                      )}
                    </div>
                  )}
                  {s.coach_note && (
                    <p className="mt-2 text-xs text-muted-foreground">Coach note: {s.coach_note}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  value,
  href,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  href?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />} {label}
      </dt>
      <dd className="mt-0.5 text-sm text-foreground">
        {href ? (
          <a href={href} target="_blank" rel="noreferrer" className="text-navy underline">
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}
