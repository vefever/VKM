import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * ShimmerButton — premium CTA with a traveling light beam on hover.
 * Compose with existing Button variants by passing className.
 */
export const ShimmerButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  function ShimmerButton({ className, children, ...props }, ref) {
    return (
      <button
        ref={ref}
        {...props}
        className={cn(
          "group/shimmer relative inline-flex h-11 items-center justify-center overflow-hidden rounded-xl px-5 text-sm font-medium",
          "bg-gradient-navy text-primary-foreground shadow-vkm transition-transform active:scale-[0.98]",
          "disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100",
          className,
        )}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/35 to-transparent opacity-0 transition-opacity duration-300 group-hover/shimmer:opacity-100 group-hover/shimmer:animate-shimmer group-disabled/shimmer:opacity-0"
        />
        <span className="relative">{children}</span>
      </button>
    );
  },
);
