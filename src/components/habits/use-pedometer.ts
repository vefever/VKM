import { useCallback, useEffect, useRef, useState } from "react";

type DeviceMotionEventCtor = typeof DeviceMotionEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

export type PedometerStatus = "idle" | "calibrating" | "tracking" | "denied" | "unsupported";

// ---------------------------------------------------------------------------
// Tuning — a fitness-app style step detector.
// ---------------------------------------------------------------------------
const GRAVITY_ALPHA = 0.9; // slow low-pass → isolates the 9.8 m/s² gravity vector
const SMOOTH_ALPHA = 0.55; // light low-pass on the linear signal → kills jitter
const WINDOW_MS = 1100; // sliding window for the adaptive threshold + amplitude
const MIN_AMPLITUDE = 1.25; // peak-to-peak (m/s²) the window must show to be "active"
const MIN_INTERVAL = 260; // ms between steps → caps cadence at ~3.8 steps/s
const MAX_INTERVAL = 2000; // ms; a longer gap breaks the rhythm (must re-confirm)
const WARMUP_STEPS = 4; // consecutive rhythmic steps required before counting
const CADENCE_TOLERANCE = 0.45; // a step's interval must be within ±45% of the rhythm

type Sample = { t: number; v: number };

interface PedoState {
  gravity: number;
  smoothed: number;
  prevSmoothed: number;
  window: Sample[];
  lastStepTime: number;
  pending: number; // rhythmic steps seen but not yet confirmed
  walking: boolean; // rhythm confirmed → count live
  intervals: number[]; // recent inter-step intervals (for cadence consistency)
}

function freshState(): PedoState {
  return {
    gravity: 9.81,
    smoothed: 0,
    prevSmoothed: 0,
    window: [],
    lastStepTime: 0,
    pending: 0,
    walking: false,
    intervals: [],
  };
}

/**
 * PWA pedometer using the device accelerometer.
 *
 * Why this rejects "phone moving up & down":
 *  1. Gravity is removed via a slow low-pass, leaving only *dynamic* motion.
 *  2. A sliding-window peak-to-peak **amplitude gate** ignores small jitter and
 *     a still phone.
 *  3. A **cadence gate** (260ms–2s) discards taps and shakes that are too fast.
 *  4. **Rhythm confirmation**: a step is only counted once WARMUP_STEPS arrive
 *     with a *consistent* cadence — a few incidental up/down moves never reach
 *     that, so they score nothing. Once walking is confirmed the warm-up steps
 *     are back-filled and subsequent steps count live; a long gap re-arms it.
 *
 * Magnitude-based, so it works regardless of how the phone is held/oriented.
 * Foreground-only (a web/PWA limitation). Calls onStep() per detected step.
 */
export function usePedometer(onStep: () => void) {
  const [status, setStatus] = useState<PedometerStatus>("idle");
  const onStepRef = useRef(onStep);
  onStepRef.current = onStep;
  const stateRef = useRef<PedoState>(freshState());

  const setPhase = useCallback((walking: boolean) => {
    setStatus((s) =>
      s === "denied" || s === "unsupported" ? s : walking ? "tracking" : "calibrating",
    );
  }, []);

  const handler = useCallback(
    (e: DeviceMotionEvent) => {
      // accelerationIncludingGravity is the most widely available source.
      const acc = e.accelerationIncludingGravity || e.acceleration;
      if (!acc || acc.x == null || acc.y == null || acc.z == null) return;

      const s = stateRef.current;
      const now =
        typeof e.timeStamp === "number" && e.timeStamp > 0 ? e.timeStamp : performance.now();

      const mag = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);

      // Gravity estimate (slow) → linear (dynamic) component.
      s.gravity = s.gravity * GRAVITY_ALPHA + mag * (1 - GRAVITY_ALPHA);
      const linear = mag - s.gravity;

      // Light smoothing of the linear signal.
      s.smoothed = s.smoothed * SMOOTH_ALPHA + linear * (1 - SMOOTH_ALPHA);

      // Sliding window → adaptive threshold + amplitude.
      s.window.push({ t: now, v: s.smoothed });
      const cutoff = now - WINDOW_MS;
      while (s.window.length && s.window[0].t < cutoff) s.window.shift();
      if (s.window.length < 4) {
        s.prevSmoothed = s.smoothed;
        return;
      }
      let lo = Infinity;
      let hi = -Infinity;
      for (const p of s.window) {
        if (p.v < lo) lo = p.v;
        if (p.v > hi) hi = p.v;
      }
      const amplitude = hi - lo;
      const threshold = (hi + lo) / 2;

      // A step = the smoothed signal crossing the adaptive midpoint downward,
      // but only when the window shows enough real motion.
      const crossedDown = s.prevSmoothed > threshold && s.smoothed <= threshold;
      s.prevSmoothed = s.smoothed;
      if (!crossedDown || amplitude < MIN_AMPLITUDE) return;

      const interval = now - s.lastStepTime;
      if (interval < MIN_INTERVAL) return; // too fast → debounce, keep rhythm

      if (interval > MAX_INTERVAL) {
        // Rhythm broken — this crossing may start a new walk.
        s.walking = false;
        s.pending = 1;
        s.intervals = [];
        s.lastStepTime = now;
        setPhase(false);
        return;
      }

      // Cadence consistency: the new interval must resemble the recent rhythm.
      if (s.intervals.length) {
        const avg = s.intervals.reduce((a, b) => a + b, 0) / s.intervals.length;
        if (Math.abs(interval - avg) > avg * CADENCE_TOLERANCE) {
          // Irregular → restart the warm-up from this step.
          s.walking = false;
          s.pending = 1;
          s.intervals = [interval];
          s.lastStepTime = now;
          setPhase(false);
          return;
        }
      }
      s.intervals.push(interval);
      if (s.intervals.length > 5) s.intervals.shift();
      s.lastStepTime = now;

      if (s.walking) {
        onStepRef.current();
        return;
      }

      // Warming up — confirm a real walking rhythm before counting.
      s.pending += 1;
      if (s.pending >= WARMUP_STEPS) {
        const backfill = s.pending;
        s.pending = 0;
        s.walking = true;
        setPhase(true);
        for (let i = 0; i < backfill; i++) onStepRef.current(); // back-fill warm-up steps
      }
    },
    [setPhase],
  );

  const start = useCallback(async () => {
    if (typeof window === "undefined" || !("DeviceMotionEvent" in window)) {
      setStatus("unsupported");
      return;
    }
    const DM = window.DeviceMotionEvent as DeviceMotionEventCtor;
    if (typeof DM.requestPermission === "function") {
      try {
        if ((await DM.requestPermission()) !== "granted") return setStatus("denied");
      } catch {
        return setStatus("denied");
      }
    }
    stateRef.current = freshState();
    stateRef.current.lastStepTime = performance.now();
    window.addEventListener("devicemotion", handler, { passive: true });
    setStatus("calibrating");
  }, [handler]);

  const stop = useCallback(() => {
    window.removeEventListener("devicemotion", handler);
    setStatus("idle");
  }, [handler]);

  useEffect(() => () => window.removeEventListener("devicemotion", handler), [handler]);

  return { status, start, stop };
}
