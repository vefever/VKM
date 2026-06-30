import { cn } from "@/lib/utils";

export type AvatarBadgeSize = "sm" | "md" | "lg" | "xl";

const SIZE: Record<AvatarBadgeSize, string> = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-9 w-9 text-xs",
  lg: "h-10 w-10 text-sm",
  xl: "h-16 w-16 text-xl",
};

export function initialsOf(name: string) {
  return (name || "?")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Round display picture used across leaderboards, chat, cohort lists, etc. */
export function AvatarBadge({
  name,
  src,
  size = "md",
  className,
}: {
  name: string;
  src?: string | null;
  size?: AvatarBadgeSize;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-navy font-semibold text-primary-foreground ring-1 ring-border/40",
        SIZE[size],
        className,
      )}
    >
      {src ? (
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        initialsOf(name)
      )}
    </span>
  );
}