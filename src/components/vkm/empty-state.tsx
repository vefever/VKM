import { type LucideIcon, Inbox, Sparkles, ArrowRight, ListTodo, Trophy, Bell } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type EmptyStateProps = {
  icon?: LucideIcon;
  eyebrow?: string;
  title: string;
  description?: string;
  primaryAction?: { label: string; onClick?: () => void; icon?: LucideIcon };
  secondaryAction?: { label: string; onClick?: () => void };
  hint?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
};

export function EmptyState({
  icon: Icon = Inbox,
  eyebrow = "Nothing here yet",
  title,
  description,
  primaryAction,
  secondaryAction,
  hint,
  className,
  size = "md",
}: EmptyStateProps) {
  const PrimaryIcon = primaryAction?.icon ?? ArrowRight;
  const pad = size === "sm" ? "py-10 px-6" : size === "lg" ? "py-20 px-8" : "py-14 px-7";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-dashed border-border bg-card text-center",
        pad,
        className,
      )}
    >
      {/* Ambient backdrop */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-48 w-48 rounded-full bg-gradient-gold opacity-20 blur-3xl"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -bottom-24 mx-auto h-48 w-48 rounded-full bg-gradient-navy opacity-10 blur-3xl"
      />

      {/* Icon medallion */}
      <div className="relative mx-auto mb-5 inline-flex">
        <motion.span
          animate={{ scale: [1, 1.06, 1], opacity: [0.55, 0.85, 0.55] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 -m-3 rounded-3xl bg-gradient-gold opacity-30 blur-xl"
        />
        <span className="relative inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-navy text-primary-foreground shadow-vkm-float ring-1 ring-white/15">
          <Icon className="h-7 w-7" />
          <Sparkles className="absolute -right-1.5 -top-1.5 h-4 w-4 text-gold drop-shadow animate-glow-pulse" />
        </span>
      </div>

      <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-gold animate-blink shadow-gold-glow" />
        {eyebrow}
      </p>
      <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground md:text-2xl">
        {title}
      </h3>
      {description && (
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      )}

      {(primaryAction || secondaryAction) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {primaryAction && (
            <Button
              onClick={primaryAction.onClick}
              className="rounded-xl bg-gradient-navy text-primary-foreground shadow-vkm hover:opacity-90"
            >
              <PrimaryIcon className="h-4 w-4" />
              {primaryAction.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="outline" onClick={secondaryAction.onClick} className="rounded-xl">
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}

      {hint && (
        <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {hint}
        </p>
      )}
    </motion.div>
  );
}

// ----- Module presets -----

export function TasksEmpty({ onCreate }: { onCreate?: () => void }) {
  return (
    <EmptyState
      icon={ListTodo}
      eyebrow="No tasks this week"
      title="Your week is wide open"
      description="Plan a focused week — add 3 outcomes you'll ship and we'll keep score for you."
      primaryAction={{ label: "Add first task", onClick: onCreate }}
      secondaryAction={{ label: "Use a template" }}
      hint="Tip · Press ⌘K and type ‘task’"
    />
  );
}

export function LeaderboardEmpty({ onInvite }: { onInvite?: () => void }) {
  return (
    <EmptyState
      icon={Trophy}
      eyebrow="Leaderboard is warming up"
      title="No scores posted yet"
      description="The board fills up as your cohort completes the first weekly check-in."
      primaryAction={{ label: "Invite teammates", onClick: onInvite }}
      secondaryAction={{ label: "View scoring rules" }}
      hint="Updates live every Monday at 9:00"
    />
  );
}

export function NotificationsEmpty({ onConfigure }: { onConfigure?: () => void }) {
  return (
    <EmptyState
      icon={Bell}
      eyebrow="Inbox zero"
      title="You're all caught up"
      description="New mentions, milestone unlocks, and weekly recaps will land here."
      primaryAction={{ label: "Notification settings", onClick: onConfigure }}
      secondaryAction={{ label: "View archive" }}
      hint="Quiet hours respected · 9pm – 7am"
    />
  );
}
