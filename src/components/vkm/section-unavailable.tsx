import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Construction, ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/vkm/page-header";
import { SectionCard } from "@/components/vkm/section-card";
import { Button } from "@/components/ui/button";

// Honest placeholder for sections whose underlying feature isn't built yet —
// shows the truth (no data) instead of fabricated numbers. Replaces the old
// WireframePage mock renderer for those routes.
export function SectionUnavailable({ title, home = "/app" }: { title: string; home?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
      className="space-y-5"
    >
      <PageHeader eyebrow="Not available" title={title} icon={Construction} />
      <SectionCard>
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
            <Construction className="h-6 w-6" />
          </span>
          <p className="max-w-md text-sm text-muted-foreground">
            This section isn't set up yet — there's no live data for it. It'll appear here once the
            underlying feature is built, so nothing on this page is placeholder or sample data.
          </p>
          <Button variant="outline" className="rounded-xl" asChild>
            <Link to={home}><ArrowLeft className="h-4 w-4" /> Back to dashboard</Link>
          </Button>
        </div>
      </SectionCard>
    </motion.div>
  );
}
