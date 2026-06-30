import { useEffect, useRef, useState } from "react";

// easeOutCubic — fast start, gentle settle.
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Animate a number from 0 → target with requestAnimationFrame.
 * Respects prefers-reduced-motion (jumps straight to target) and is SSR-safe.
 */
export function useCountUp(target: number, durationMs = 1200): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (typeof window === "undefined") {
      setValue(target);
      return;
    }
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || target === 0) {
      setValue(target);
      return;
    }

    let startTs: number | null = null;
    const tick = (now: number) => {
      if (startTs === null) startTs = now;
      const progress = Math.min((now - startTs) / durationMs, 1);
      setValue(Math.round(easeOutCubic(progress) * target));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, durationMs]);

  return value;
}
