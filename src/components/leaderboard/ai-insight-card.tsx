import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

export function AiInsightCard() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.45, delay: 1.1 }}
      className="lb-shimmer lb-glow-pulse relative overflow-hidden rounded-[20px] p-4"
      style={{
        background: "linear-gradient(135deg, #C8A84B 0%, #F5A623 100%)",
        ["--lb-shimmer-dur" as string]: "3s",
        border: "1px solid #C8A84B",
      }}
    >
      <div className="relative flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1a0533]/15 text-[#1a0533]">
          <Sparkles className="h-4 w-4" />
        </span>
        <div>
          <p className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#1a0533]">
            AI Insight
          </p>
          <p className="mt-1 text-sm text-[#1a0533]">
            Engagement is trending <span className="font-bold">+12% WoW</span>. Consider scheduling
            a follow-up to maintain momentum.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
