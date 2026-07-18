import { motion } from "framer-motion";
import { LineChart as LineChartIcon } from "lucide-react";
import { PageHeader } from "@/components/vkm/page-header";
import { BatchInsights } from "@/components/admin/batch-insights";

/**
 * Platform Analytics — batch-scoped by design.
 *
 * This page used to dump every participant, coach, mentor and batch at once.
 * It now drills down instead: pick a batch → pick a group (participants /
 * coaches / mentors) → pick a person. Every number shown, including the
 * trends, covers only the selected batch.
 */
export function PlatformAnalyticsPage({ eyebrow = "Admin · VK" }: { eyebrow?: string } = {}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      <PageHeader
        eyebrow={eyebrow}
        title="Platform Analytics"
        description="Pick a batch, then a group, then a person — every figure below is scoped to that batch."
        icon={LineChartIcon}
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-3 py-1.5 text-xs font-semibold text-foreground">
            <span className="relative inline-flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[oklch(0.6_0.16_150)] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[oklch(0.6_0.16_150)]" />
            </span>
            Live
          </span>
        }
      />

      <BatchInsights />
    </motion.div>
  );
}
