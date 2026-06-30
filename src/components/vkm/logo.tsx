import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function VKMLogo({
  className,
  showWordmark = true,
  inverted = false,
}: {
  className?: string;
  showWordmark?: boolean;
  /** Light text for placement on dark / navy backgrounds. */
  inverted?: boolean;
}) {
  return (
    <Link to="/" className={cn("group flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "relative inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-navy text-primary-foreground shadow-vkm transition-transform duration-500 group-hover:rotate-[8deg] group-hover:scale-[1.06]",
          inverted && "ring-1 ring-white/20",
        )}
      >
        <span className="text-[13px] font-bold tracking-tight">VKM</span>
        <span className="absolute -bottom-px left-2 right-2 h-px bg-gradient-gold" />
        <span
          aria-hidden
          className="absolute inset-0 -z-10 rounded-xl bg-gradient-gold opacity-0 blur-md transition-opacity duration-500 group-hover:opacity-60"
        />
      </span>
      {showWordmark && (
        <span className="flex flex-col leading-none">
          <span
            className={cn(
              "text-[15px] font-semibold tracking-tight",
              inverted ? "text-white" : "text-foreground",
            )}
          >
            VK Mentorship
          </span>
          <span
            className={cn(
              "text-[10px] font-medium uppercase tracking-[0.18em]",
              inverted ? "text-white/60" : "text-muted-foreground",
            )}
          >
            Operating System
          </span>
        </span>
      )}
    </Link>
  );
}
