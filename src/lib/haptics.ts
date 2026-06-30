// Haptics (#12) — Vibration API now, swappable for a native plugin later behind
// this same `haptic()` function. Gated by a user setting (#14) and
// prefers-reduced-motion (#15).

export type HapticType = "light" | "medium" | "heavy" | "tick" | "success" | "warning" | "error";

const PATTERNS: Record<HapticType, number | number[]> = {
  light: 10,
  medium: 18,
  heavy: 28,
  tick: 8,
  success: [12, 40, 18],
  warning: [18, 50, 18],
  error: [30, 45, 30],
};

const KEY = "vkm.haptics.enabled.v1";

export function hapticsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const v = localStorage.getItem(KEY);
    return v === null ? true : v === "1";
  } catch {
    return true;
  }
}

export function setHapticsEnabled(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function haptic(type: HapticType = "light") {
  if (typeof window === "undefined") return;
  if (!("vibrate" in navigator)) return;
  if (!hapticsEnabled()) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  try {
    navigator.vibrate(PATTERNS[type]);
  } catch {
    /* ignore */
  }
}
