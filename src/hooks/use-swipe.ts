import { useRef } from "react";
import type { TouchEvent } from "react";

// Lightweight horizontal/vertical swipe detector for touch UIs (#18, gestures).
// Only fires on touch; mouse never triggers it, so it's safe to attach anywhere.
type SwipeOpts = {
  onLeft?: () => void;
  onRight?: () => void;
  onDown?: () => void;
  onUp?: () => void;
  threshold?: number;
};

export function useSwipe({ onLeft, onRight, onDown, onUp, threshold = 50 }: SwipeOpts) {
  const start = useRef<{ x: number; y: number } | null>(null);

  return {
    onTouchStart: (e: TouchEvent) => {
      const t = e.touches[0];
      start.current = { x: t.clientX, y: t.clientY };
    },
    onTouchEnd: (e: TouchEvent) => {
      if (!start.current) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - start.current.x;
      const dy = t.clientY - start.current.y;
      start.current = null;
      if (Math.abs(dx) > Math.abs(dy) * 1.4 && Math.abs(dx) > threshold) {
        if (dx < 0) onLeft?.();
        else onRight?.();
      } else if (Math.abs(dy) > Math.abs(dx) * 1.4 && Math.abs(dy) > threshold) {
        if (dy < 0) onUp?.();
        else onDown?.();
      }
    },
  };
}
