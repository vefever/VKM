import { useEffect, useRef, useState } from "react";

// Values that have already played their count-up this session. A duplicate card
// with the same value (e.g. the two "Revenue (mo)" tiles on My Business) — or a
// card that unmounts and remounts while scrolling — snaps straight to the number
// instead of re-running the 0→value animation, which read as jank on scroll.
const playedValues = new Set<string>();

/**
 * Count-up number animation. Parses a leading number (keeps any prefix/suffix
 * like "₹48L" or "92%"), animates 0→value the first time that value is scrolled
 * into view, and re-animates from the current value whenever it changes. Honors
 * prefers-reduced-motion (snaps instead of animating).
 */
export function AnimatedCounter({
  value,
  duration = 900,
  className,
}: {
  value: string | number;
  duration?: number;
  className?: string;
}) {
  const str = String(value);
  const match = str.match(/^([^\d-]*)(-?\d+(?:\.\d+)?)(.*)$/);
  const prefix = match?.[1] ?? "";
  const target = match ? Number(match[2]) : NaN;
  const suffix = match?.[3] ?? "";
  const isNumeric = Number.isFinite(target);

  const [n, setN] = useState(0);
  const nRef = useRef(0);
  nRef.current = n;
  const ref = useRef<HTMLSpanElement | null>(null);
  const started = useRef(false);
  const raf = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!isNumeric) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const run = () => {
      if (reduce) return setN(target);
      if (raf.current) cancelAnimationFrame(raf.current);
      const from = nRef.current;
      const start = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - start) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        setN(from + (target - from) * eased);
        if (p < 1) raf.current = requestAnimationFrame(tick);
        else setN(target);
      };
      raf.current = requestAnimationFrame(tick);
    };

    const key = `${prefix}${target}${suffix}`;

    // After the first reveal, value changes animate immediately.
    if (started.current) {
      playedValues.add(key);
      run();
      return;
    }
    // This value already animated elsewhere (duplicate tile / remount on scroll)
    // — snap to it instead of re-running the count-up.
    if (playedValues.has(key)) {
      started.current = true;
      setN(target);
      return;
    }
    const el = ref.current;
    if (!el) {
      started.current = true;
      playedValues.add(key);
      run();
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !started.current) {
            started.current = true;
            playedValues.add(key);
            run();
            obs.disconnect();
          }
        }
      },
      { threshold: 0.2 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [target, isNumeric, duration, prefix, suffix]);

  useEffect(
    () => () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    },
    [],
  );

  if (!isNumeric) return <span className={className}>{str}</span>;

  const hasDecimal = String(target).includes(".");
  const formatted = hasDecimal ? n.toFixed(1) : Math.round(n).toLocaleString();

  return (
    <span ref={ref} className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
