import { useState } from "react";
import { Loader2, Flag, Compass, ImagePlus } from "lucide-react";
import { SectionCard } from "@/components/vkm/section-card";
import { cn } from "@/lib/utils";
import {
  useVisionFor,
  goalProgress,
  inrShort,
  PILLAR_COLOR,
  type Pillar,
} from "@/components/participant/vision-data";

const YEARS = [1, 2, 3, 4, 5];

export function ParticipantVisionTab({ userId }: { userId: string }) {
  const { statement, goals, loading } = useVisionFor(userId);
  const [year, setYear] = useState(1);

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasAnything =
    statement.statement || statement.statement_1yr || statement.primary_goal || goals.length > 0;

  if (!hasAnything) {
    return (
      <SectionCard>
        <p className="flex items-center gap-2 py-6 text-center text-sm text-muted-foreground">
          <Compass className="h-4 w-4" /> No vision board set up yet.
        </p>
      </SectionCard>
    );
  }

  const yearGoals = goals.filter((g) => g.year === year);

  return (
    <div className="space-y-4">
      {statement.primary_goal && (
        <div className="rounded-2xl border border-gold/40 bg-gold/[0.06] p-4">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gold">
            <Flag className="h-3.5 w-3.5" /> #1 goal this year
          </p>
          <p className="mt-1 text-lg font-semibold text-foreground">{statement.primary_goal}</p>
        </div>
      )}

      <SectionCard title="Vision statements">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              5-year vision
            </p>
            <p className="mt-1 text-sm italic text-foreground">
              {statement.statement ? `"${statement.statement}"` : "Not set yet."}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              1-year vision
            </p>
            <p className="mt-1 text-sm italic text-foreground">
              {statement.statement_1yr ? `"${statement.statement_1yr}"` : "Not set yet."}
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Target revenue
            </p>
            <p className="mt-0.5 text-sm font-semibold text-foreground">
              {inrShort(statement.target_revenue_inr)}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Target team size
            </p>
            <p className="mt-0.5 text-sm font-semibold text-foreground">
              {statement.target_team_size ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Lifestyle goal
            </p>
            <p className="mt-0.5 text-sm font-semibold text-foreground">
              {statement.lifestyle_goal ?? "—"}
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="5-year goals"
        action={
          <div className="flex gap-1">
            {YEARS.map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => setYear(y)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
                  y === year ? "bg-gradient-navy text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground",
                )}
              >
                Y{y}
              </button>
            ))}
          </div>
        }
      >
        {yearGoals.length === 0 ? (
          <p className="py-3 text-sm text-muted-foreground">No goals set for year {year}.</p>
        ) : (
          <div className="space-y-1.5">
            {yearGoals.map((goal) => {
              const pct = goalProgress(goal);
              const color = PILLAR_COLOR[goal.category as Pillar] ?? "#888";
              return (
                <div
                  key={goal.id}
                  className="flex flex-wrap items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5"
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{goal.title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {goal.category}
                      {goal.why ? ` · ${goal.why}` : ""}
                    </p>
                  </div>
                  {goal.target_value != null && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {goal.current_value ?? 0}/{goal.target_value} {goal.unit ?? ""}
                    </span>
                  )}
                  <div className="hidden h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-secondary sm:block">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                  </div>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-foreground">{pct}%</span>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Vision board"
        subtitle={`${statement.images.length} photo${statement.images.length === 1 ? "" : "s"}`}
      >
        {statement.images.length === 0 ? (
          <p className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
            <ImagePlus className="h-4 w-4" /> No mood-board photos added yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {statement.images.map((img, i) => (
              <a
                key={i}
                href={img.url}
                target="_blank"
                rel="noreferrer"
                className="group relative aspect-square overflow-hidden rounded-xl border border-border"
              >
                <img
                  src={img.url}
                  alt={img.caption ?? ""}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
                {img.caption && (
                  <span className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-1.5 py-1 text-[10px] text-white">
                    {img.caption}
                  </span>
                )}
              </a>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
