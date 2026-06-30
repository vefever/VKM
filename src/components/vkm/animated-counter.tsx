import { useEffect, useRef, useState } from "react";

/**
 * Count-up number animation. Parses a leading number (keeps any prefix/suffix
 * like "₹48L" or "92%"), animates 0→value when first scrolled into view, and
 * re-animates from the current value whenever it changes. Honors
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

    // After the first reveal, value changes animate immediately.
    if (started.current) {
      run();
      return;
    }
    const el = ref.current;
    if (!el) {
      started.current = true;
      run();
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !started.current) {
            started.current = true;
            run();
            obs.disconnect();
          }
        }
      },
      { threshold: 0.2 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [target, isNumeric, duration]);

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
