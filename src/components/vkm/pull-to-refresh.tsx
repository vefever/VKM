import { useEffect, useRef, useState, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { useAppShell } from "@/hooks/use-app-shell";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

// #16 — pull-to-refresh on the document scroll. Active only on the app shell;
// desktop renders children untouched.
const MAX = 96;
const TRIGGER = 64;

export function PullToRefresh({
  onRefresh,
  children,
}: {
  onRefresh: () => Promise<void> | void;
  children: ReactNode;
}) {
  const { appShell, reducedMotion } = useAppShell();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const pullRef = useRef(0);
  pullRef.current = pull;
  const startY = useRef<number | null>(null);
  const active = useRef(false);
  const refreshingRef = useRef(false);
  refreshingRef.current = refreshing;

  useEffect(() => {
    if (!appShell || reducedMotion) return;

    function onStart(e: TouchEvent) {
      if (refreshingRef.current) return;
      if (window.scrollY <= 0) {
        startY.current = e.touches[0].clientY;
        active.current = true;
      }
    }
    function onMove(e: TouchEvent) {
      if (!active.current || startY.current == null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy > 0 && window.scrollY <= 0) {
        const d = Math.min(MAX, dy * 0.5);
        setPull(d);
        if (d > 6 && e.cancelable) e.preventDefault();
      } else {
        active.current = false;
        setPull(0);
      }
    }
    async function onEnd() {
      if (!active.current) return;
      active.current = false;
      const shouldRefresh = pullRef.current >= TRIGGER;
      setPull(0);
      if (shouldRefresh) {
        setRefreshing(true);
        haptic("tick");
        try {
          await onRefresh();
        } finally {
          window.setTimeout(() => setRefreshing(false), 500);
        }
      }
    }

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
    };
  }, [appShell, reducedMotion, onRefresh]);

  if (!appShell || reducedMotion) return <>{children}</>;

  const offset = refreshing ? TRIGGER * 0.7 : pull;
  const progress = Math.min(1, pull / TRIGGER);

  return (
    <div className="relative">
      <div
        className="pointer-events-none absolute inset-x-0 -top-2 z-10 flex justify-center"
        style={{ transform: `translateY(${offset}px)`, opacity: offset > 4 ? 1 : 0 }}
      >
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card shadow-vkm">
          <RefreshCw
            className={cn("h-4 w-4 text-muted-foreground", refreshing && "animate-spin")}
            style={{ transform: refreshing ? undefined : `rotate(${progress * 270}deg)` }}
          />
        </span>
      </div>
      <div
        style={{
          transform: `translateY(${offset}px)`,
          transition: active.current ? "none" : "transform 0.25s ease",
        }}
      >
        {children}
      </div>
    </div>
  );
}
