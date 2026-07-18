import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNowStrict } from "date-fns";
import { Check, X, Loader2 } from "lucide-react";
import { SectionCard } from "@/components/vkm/section-card";
import { AvatarBadge } from "@/components/vkm/avatar-badge";
import { Button } from "@/components/ui/button";
import {
  useSnapshotReviewQueue,
  monthLabel,
  type SnapshotReviewItem,
} from "@/components/business/business-data";

const inr = (n: number | null) => (n == null ? "—" : `₹${Number(n).toLocaleString("en-IN")}`);

// Staff review of self-reported monthly business numbers. Drop on any staff page.
export function SnapshotReviewQueue() {
  const { items, loading, review } = useSnapshotReviewQueue();

  return (
    <SectionCard
      title="Business numbers · pending review"
      subtitle="Self-reported monthly figures — approve so they count toward points & leaderboard"
    >
      {loading ? (
        <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      ) : items.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">No numbers awaiting review.</p>
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {items.map((it) => (
              <SnapshotCard key={it.id} item={it} review={review} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </SectionCard>
  );
}

function SnapshotCard({
  item,
  review,
}: {
  item: SnapshotReviewItem;
  review: (id: string, status: "approved" | "rejected", note: string) => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function act(status: "approved" | "rejected") {
    setBusy(true);
    await review(item.id, status, note);
  }

  const rows: [string, string][] = [
    ["Revenue", inr(item.revenue_inr)],
    ["MRR", inr(item.mrr_inr)],
    ["Leads", item.leads == null ? "—" : String(item.leads)],
    ["Deals", item.deals == null ? "—" : String(item.deals)],
    ["Pipeline", inr(item.pipeline_inr)],
    ["Avg deal", inr(item.avg_deal_inr)],
    ["Closing", item.closing_rate_pct == null ? "—" : `${item.closing_rate_pct}%`],
    ["Follow-up", item.followup_pct == null ? "—" : `${item.followup_pct}%`],
    ["NPS", item.nps == null ? "—" : String(item.nps)],
  ];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 40 }}
    >
      <div className="rounded-2xl border border-border bg-card p-4 shadow-vkm">
        <div className="flex items-center gap-3">
          <AvatarBadge name={item.name} src={item.avatar_url} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{item.name}</p>
            <p className="text-xs text-muted-foreground">
              {monthLabel(item.month)} · submitted{" "}
              {formatDistanceToNowStrict(new Date(item.created_at), { addSuffix: true })}
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {rows.map(([k, v]) => (
            <div key={k} className="rounded-xl bg-secondary/50 px-2.5 py-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</p>
              <p className="truncate text-sm font-semibold text-foreground" title={v}>
                {v}
              </p>
            </div>
          ))}
        </div>

        {item.note && (
          <p className="mt-3 rounded-xl bg-secondary/60 px-3 py-2 text-sm text-foreground">
            “{item.note}”
          </p>
        )}

        {(item.reflection_win || item.reflection_blocker) && (
          <div className="mt-3 space-y-1.5 rounded-xl bg-secondary/40 px-3 py-2 text-sm">
            {item.reflection_win && (
              <p>
                <span className="font-medium text-foreground">Worked:</span>{" "}
                <span className="text-muted-foreground">{item.reflection_win}</span>
              </p>
            )}
            {item.reflection_blocker && (
              <p>
                <span className="font-medium text-foreground">Blocker:</span>{" "}
                <span className="text-muted-foreground">{item.reflection_blocker}</span>
              </p>
            )}
          </div>
        )}

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Feedback / reason (sent to the participant)…"
          className="mt-3 min-h-[52px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <div className="mt-3 flex items-center justify-end gap-2">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => act("rejected")}
            className="rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="h-4 w-4" /> Reject
          </Button>
          <Button
            disabled={busy}
            onClick={() => act("approved")}
            className="rounded-xl bg-[#10b981] text-white hover:opacity-90"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Approve
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
