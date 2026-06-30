import { cn } from "@/lib/utils";

/**
 * Modern layered aurora background — premium, depth-rich for auth and heroes.
 * More orbs, refined positioning, stronger presence for a contemporary app feel.
 */
export function AuroraBackground({
  className,
  variant = "warm",
}: {
  className?: string;
  variant?: "warm" | "cool" | "navy";
}) {
  const palette = {
    warm: [
      "bg-gradient-gold",
      "bg-[oklch(0.78_0.13_85)]",
      "bg-[oklch(0.71_0.14_160)]",
      "bg-gradient-navy",
    ],
    cool: [
      "bg-[oklch(0.7_0.13_220)]",
      "bg-[oklch(0.71_0.13_280)]",
      "bg-gradient-gold",
      "bg-[oklch(0.65_0.12_200)]",
    ],
    navy: [
      "bg-gradient-navy",
      "bg-gradient-gold",
      "bg-[oklch(0.32_0.07_264)]",
      "bg-[oklch(0.45_0.08_250)]",
    ],
  }[variant];

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 overflow-hidden",
        className,
      )}
    >
      {/* Layered aurora orbs — softer for the app's cream background */}
      <div className={cn("absolute -top-40 left-1/3 h-[32rem] w-[32rem] rounded-full opacity-35 blur-[120px] animate-aurora", palette[0])} />
      <div className={cn("absolute top-1/4 -right-32 h-[26rem] w-[26rem] rounded-full opacity-30 blur-[100px] animate-aurora [animation-delay:-3s]", palette[1])} />
      <div className={cn("absolute bottom-[-15%] left-[-5%] h-[22rem] w-[22rem] rounded-full opacity-25 blur-[90px] animate-aurora [animation-delay:-6s]", palette[2])} />
      <div className={cn("absolute top-[40%] left-[15%] h-[18rem] w-[18rem] rounded-full opacity-20 blur-[80px] animate-aurora [animation-delay:-9s]", "bg-[oklch(0.78_0.13_85)]")} />
    </div>
  );
}
