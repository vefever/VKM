import { type ReactNode, useRef, type MouseEvent } from "react";
import { cn } from "@/lib/utils";

/**
 * MagicCard — mouse-tracking spotlight border + soft highlight.
 * Uses CSS variables updated on mousemove for zero re-render cost.
 */
export function MagicCard({
  children,
  className,
  spotlightClassName,
  intensity = 0.6,
}: {
  children: ReactNode;
  className?: string;
  spotlightClassName?: string;
  intensity?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      className={cn("group/magic relative overflow-hidden", className)}
      style={{ ["--mx" as string]: "50%", ["--my" as string]: "50%" }}
    >
      {/* spotlight glow */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/magic:opacity-100",
          spotlightClassName,
        )}
        style={{
          background: `radial-gradient(360px circle at var(--mx) var(--my), oklch(0.71 0.135 85 / ${intensity}), transparent 45%)`,
        }}
      />
      {/* border highlight */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover/magic:opacity-100"
        style={{
          background: `radial-gradient(220px circle at var(--mx) var(--my), oklch(0.71 0.135 85 / 0.5), transparent 60%)`,
          WebkitMask:
            "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          padding: "1px",
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}
