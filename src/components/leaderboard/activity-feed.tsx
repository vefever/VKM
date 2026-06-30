import { motion, type Variants } from "framer-motion";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActivityItem, ActivityTag } from "@/types/leaderboard";

const feedContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.5 } },
};
const feedItem: Variants = {
  hidden: { opacity: 0, x: 20 },
  show: { opacity: 1, x: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
};

const TAG: Record<ActivityTag, string> = {
  proof: "border-border text-muted-foreground",
  approved: "border-border text-muted-foreground",
  omm: "border-border text-muted-foreground",
  class: "border-border text-muted-foreground",
  milestone: "border-gold/50 text-[oklch(0.5_0.11_80)]",
};

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.45 }}
      className="rounded-2xl border border-border bg-card p-5 shadow-vkm"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold tracking-tight text-foreground">
            Cohort activity
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">Live updates</p>
        </div>
        <Bell className="h-5 w-5 text-muted-foreground" />
      </div>

      <motion.ul
        variants={feedContainer}
        initial="hidden"
        animate="show"
        className="relative mt-4 space-y-4 border-l border-dashed border-border pl-6"
      >
        {items.map((it) => (
          <motion.li key={it.id} variants={feedItem} className="relative">
            <span
              aria-hidden
              className="absolute -left-[27px] top-1.5 inline-flex h-3 w-3 rounded-full bg-gradient-gold ring-4 ring-card"
            />
            <p className="text-sm leading-relaxed text-foreground">
              <button type="button" className="font-semibold text-foreground hover:underline">
                {it.actorName}
              </button>{" "}
              <span className="text-muted-foreground">{it.action}</span>
            </p>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{it.timestamp}</span>
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
                  TAG[it.tagType],
                )}
              >
                {it.tag}
              </span>
            </div>
          </motion.li>
        ))}
      </motion.ul>
    </motion.div>
  );
}
