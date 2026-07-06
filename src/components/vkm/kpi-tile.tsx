import { useState, type ReactNode } from "react";
import { type LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown, Minus, Info, ArrowRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { MagicCard } from "@/components/vkm/magic-card";
import { AnimatedCounter } from "@/components/vkm/animated-counter";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useAppShell } from "@/hooks/use-app-shell";

const SPARK_STROKE: Record<string, string> = {
  navy: "#3b6fb0",
  gold: "#c79a1e",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
};

export type KpiDetail = { howTo: string; series?: number[] };

type KpiTileProps = {
  label: string;
  value: string;
  delta?: string;
  trend?: "up" | "down" | "flat";
  icon?: LucideIcon;
  accent?: "navy" | "gold" | "success" | "warning" | "danger";
  className?: string;
  index?: number;
  loading?: boolean;
  hint?: string;
  spark?: number[];
  detail?: KpiDetail;
  /** Cursor-following spotlight glow. Default on; set false for a calmer surface. */
  spotlight?: boolean;
};

const accentMap = {
  navy: "bg-gradient-navy text-primary-foreground",
  gold: "bg-gradient-gold text-navy",
  success: "bg-[oklch(0.71_0.14_160)] text-white",
  warning: "bg-[oklch(0.82_0.14_80)] text-navy",
  danger: "bg-destructive text-destructive-foreground",
};

const trendIcon = { up: TrendingUp, down: TrendingDown, flat: Minus } as const;

export function KpiTileSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-vkm",
        className,
      )}
    >
      <span
        aria-hidden
        className="absolute inset-0 -translate-x-full animate-[vkm-shimmer_1.8s_infinite] bg-gradient-to-r from-transparent via-foreground/5 to-transparent"
      />
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-4 w-16 rounded-full" />
        </div>
        <Skeleton className="h-11 w-11 rounded-xl" />
      </div>
    </div>
  );
}

export function KpiTile({
  label,
  value,
  delta,
  trend = "flat",
  icon: Icon,
  accent = "navy",
  className,
  index = 0,
  loading,
  hint,
  spark,
  detail,
  spotlight = true,
}: KpiTileProps) {
  const [open, setOpen] = useState(false);
  if (loading) return <KpiTileSkeleton className={className} />;
  const TrendIcon = trendIcon[trend];
  const interactive = !!detail;

  const cardClass = cn("rounded-2xl border border-border bg-card shadow-vkm hover-lift", className);
  const Wrapper = spotlight
    ? MagicCard
    : ({ children, className: c }: { children: ReactNode; className?: string }) => (
        <div className={cn("group/magic relative overflow-hidden", c)}>
          <div className="relative">{children}</div>
        </div>
      );

  const tile = (
    <Wrapper className={cardClass}>
      <span
        aria-hidden
        className={cn(
          "absolute inset-x-0 top-0 h-[3px] opacity-70",
          accent === "gold" ? "bg-gradient-gold" : "bg-gradient-navy",
        )}
      />
      <div className="p-4 md:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-start gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              <span className="truncate leading-tight">{label}</span>
              {hint && (
                <Info className="mt-0.5 h-3 w-3 shrink-0 opacity-60 transition-opacity group-hover/magic:opacity-100" />
              )}
            </p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
              <AnimatedCounter value={value} />
            </p>
            {delta && (
              <p
                className={cn(
                  "mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-all duration-300 group-hover/magic:scale-105",
                  trend === "up" && "bg-[oklch(0.71_0.14_160/0.12)] text-[oklch(0.45_0.14_160)]",
                  trend === "down" && "bg-destructive/10 text-destructive",
                  trend === "flat" && "bg-secondary text-muted-foreground",
                )}
              >
                <TrendIcon className="h-3 w-3" />
                {delta}
              </p>
            )}
          </div>
          {Icon && (
            <span
              className={cn(
                "relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-vkm transition-transform duration-500 group-hover/magic:rotate-3 group-hover/magic:scale-105",
                accentMap[accent],
              )}
            >
              <Icon className="h-5 w-5" />
              <span aria-hidden className="absolute inset-0 rounded-xl ring-1 ring-white/20" />
            </span>
          )}
        </div>

        {spark && spark.length > 1 && (
          <div className="mt-3">
            <Sparkline data={spark} stroke={SPARK_STROKE[accent] ?? SPARK_STROKE.navy} />
          </div>
        )}

        {interactive && (
          <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground opacity-0 transition-opacity duration-300 group-hover/magic:opacity-100">
            View details <ArrowRight className="h-3 w-3" />
          </p>
        )}
      </div>
    </Wrapper>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.5,
        delay: index * 0.07,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="relative min-w-0"
    >
      {interactive ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="app-press block w-full rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={`${label} — view details`}
        >
          {tile}
        </button>
      ) : hint ? (
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div>{tile}</div>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[240px] text-xs">
              {hint}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        tile
      )}

      {detail && (
        <KpiDrill
          open={open}
          onOpenChange={setOpen}
          label={label}
          value={value}
          delta={delta}
          trend={trend}
          accent={accent}
          spark={detail.series ?? spark}
          howTo={detail.howTo}
        />
      )}
    </motion.div>
  );
}

// Lightweight inline sparkline (no chart lib) — scales to container width.
function Sparkline({
  data,
  stroke,
  className = "h-7 w-full",
}: {
  data: number[];
  stroke: string;
  className?: string;
}) {
  if (!data || data.length < 2) return null;
  const w = 100;
  const h = 28;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((d - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  });
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={className}>
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// Drill-in: bottom sheet on the app shell, dialog on desktop.
function KpiDrill({
  open,
  onOpenChange,
  label,
  value,
  delta,
  trend,
  accent,
  spark,
  howTo,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  label: string;
  value: string;
  delta?: string;
  trend: "up" | "down" | "flat";
  accent: "navy" | "gold" | "success" | "warning" | "danger";
  spark?: number[];
  howTo: string;
}) {
  const { appShell } = useAppShell();
  const TrendIcon = trendIcon[trend];

  const body = (
    <div className="space-y-4 px-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] sm:px-0 sm:pb-0">
      <div className="flex items-end justify-between gap-3">
        <p className="text-3xl font-semibold tracking-tight text-foreground">{value}</p>
        {delta && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
              trend === "up" && "bg-[oklch(0.71_0.14_160/0.12)] text-[oklch(0.45_0.14_160)]",
              trend === "down" && "bg-destructive/10 text-destructive",
              trend === "flat" && "bg-secondary text-muted-foreground",
            )}
          >
            <TrendIcon className="h-3 w-3" />
            {delta}
          </span>
        )}
      </div>

      {spark && spark.length > 1 && (
        <div className="rounded-2xl border border-border bg-secondary/40 p-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Last {spark.length} periods
          </p>
          <Sparkline
            data={spark}
            stroke={SPARK_STROKE[accent] ?? SPARK_STROKE.navy}
            className="h-16 w-full"
          />
        </div>
      )}

      <div className="rounded-2xl bg-gradient-navy p-4 text-primary-foreground">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gold">
          <Sparkles className="h-3.5 w-3.5" /> Earn the next points
        </p>
        <p className="mt-1.5 text-sm text-primary-foreground/85">{howTo}</p>
      </div>
    </div>
  );

  if (appShell) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>{label}</DrawerTitle>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">{body}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}
