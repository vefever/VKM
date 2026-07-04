import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAppShell } from "@/hooks/use-app-shell";

// A small "i" affordance with a plain-language explanation. Hover/focus opens
// a tooltip on desktop; on touch devices a tooltip is unreliable, so it
// becomes a tap-to-open popover with a 44px hit area (visual size unchanged —
// the padding + negative margin trick grows only the touchable zone).
export function InfoHint({ text, className }: { text: string; className?: string }) {
  const { touch } = useAppShell();

  if (touch) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="What does this mean?"
            className={
              "-m-3 inline-flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
              (className ?? "")
            }
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent side="top" className="w-auto max-w-[260px] px-3 py-2 text-xs leading-relaxed">
          {text}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <TooltipProvider delayDuration={120}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="What does this mean?"
            className={
              "inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
              (className ?? "")
            }
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[260px] text-xs leading-relaxed">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
