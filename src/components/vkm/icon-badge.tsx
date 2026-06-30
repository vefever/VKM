import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// #18 — one icon-badge system: consistent sizing + accent → background tint logic.
// Replaces ad-hoc `inline-flex h-9 w-9 rounded-xl bg-…` icon circles across the app.
export type IconBadgeAccent =
  | "navy"
  | "gold"
  | "green"
  | "blue"
  | "purple"
  | "red"
  | "amber"
  | "muted";
export type IconBadgeSize = "sm" | "md" | "lg";

const SOLID: Record<IconBadgeAccent, string> = {
  navy: "bg-gradient-navy text-primary-foreground",
  gold: "bg-gradient-gold text-navy",
  green: "bg-[#10b981] text-white",
  blue: "bg-[#3b82f6] text-white",
  purple: "bg-[#8b5cf6] text-white",
  red: "bg-[#ef4444] text-white",
  amber: "bg-[#f59e0b] text-white",
  muted: "bg-muted text-muted-foreground/70",
};

const TINT: Record<IconBadgeAccent, string> = {
  navy: "bg-navy/10 text-navy",
  gold: "bg-gold/15 text-[oklch(0.45_0.1_85)]",
  green: "bg-[#10b981]/12 text-[#0d7a55]",
  blue: "bg-[#3b82f6]/12 text-[#2563eb]",
  purple: "bg-[#8b5cf6]/12 text-[#7c3aed]",
  red: "bg-[#ef4444]/12 text-[#b91c1c]",
  amber: "bg-[#f59e0b]/15 text-[oklch(0.5_0.12_70)]",
  muted: "bg-muted text-muted-foreground",
};

const SIZE: Record<IconBadgeSize, { box: string; icon: string }> = {
  sm: { box: "h-8 w-8 rounded-lg", icon: "h-4 w-4" },
  md: { box: "h-9 w-9 rounded-xl", icon: "h-4 w-4" },
  lg: { box: "h-11 w-11 rounded-xl", icon: "h-5 w-5" },
};

export function IconBadge({
  icon: Icon,
  accent = "navy",
  size = "md",
  variant = "solid",
  className,
}: {
  icon: LucideIcon;
  accent?: IconBadgeAccent;
  size?: IconBadgeSize;
  variant?: "solid" | "tint";
  className?: string;
}) {
  const s = SIZE[size];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        s.box,
        variant === "solid" && accent !== "muted" && "shadow-vkm",
        variant === "tint" ? TINT[accent] : SOLID[accent],
        className,
      )}
    >
      <Icon className={s.icon} />
    </span>
  );
}
