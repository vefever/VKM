import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

// #22 — host for the celebratory "+40 pts" flyaway. Mounted once in __root; it
// listens for the event fired by flyPoints() (see lib/fly-points). Reduced-motion
// → a brief static pill. The imperative trigger lives in lib so this file only
// exports a component (fast-refresh friendly).
type Fly = { id: number; text: string };
let seq = 0;

export function FlyPointsHost() {
  const [items, setItems] = useState<Fly[]>([]);

  useEffect(() => {
    const timers = new Set<number>();
    const onFly = (e: Event) => {
      const text = (e as CustomEvent).detail?.text ?? "+pts";
      const id = ++seq;
      setItems((p) => [...p, { id, text }]);
      const t = window.setTimeout(() => {
        timers.delete(t);
        setItems((p) => p.filter((x) => x.id !== id));
      }, 1300);
      timers.add(t);
    };
    window.addEventListener("vkm:flypoints", onFly);
    return () => {
      window.removeEventListener("vkm:flypoints", onFly);
      timers.forEach((t) => clearTimeout(t));
    };
  }, []);

  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-28 z-[70] flex flex-col items-center gap-2">
      <AnimatePresence>
        {items.map((it) => (
          <motion.div
            key={it.id}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.8 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: -44, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -84 }}
            transition={{ duration: reduce ? 0.3 : 1.1, ease: "easeOut" }}
            className="rounded-full bg-gradient-gold px-4 py-2 text-sm font-bold text-navy shadow-vkm-float"
          >
            {it.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
