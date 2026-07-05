import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Trophy, Loader2, Medal } from "lucide-react";
import { PageHeader } from "@/components/vkm/page-header";
import { SectionCard } from "@/components/vkm/section-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { stageFor } from "@/lib/vkm/program";
import { cn } from "@/lib/utils";

type Row = {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  business_name: string | null;
  batch_id: string;
  batch_name: string;
  points: number;
  weeks_approved: number;
};

// Cross-batch standings for staff — real data from get_leaderboard() (callable
// by any authenticated user; staff are excluded from appearing as rows).
export function MentorLeaderboardsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [batch, setBatch] = useState<string>("all");

  useEffect(() => {
    void supabase.rpc("get_leaderboard").then(({ data }) => {
      setRows((data ?? []) as Row[]);
      setLoading(false);
    });
  }, []);

  const batches = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((r) => r.batch_id && m.set(r.batch_id, r.batch_name));
    return [...m.entries()].map(([id, name]) => ({ id, name }));
  }, [rows]);

  const ranked = useMemo(
    () => rows.filter((r) => batch === "all" || r.batch_id === batch).sort((a, b) => b.points - a.points),
    [rows, batch],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
      className="space-y-5"
    >
      <PageHeader
        eyebrow="Mentor · VK"
        title="Leaderboards"
        description="Live participant standings by points, across every batch."
        icon={Trophy}
        actions={
          <Select value={batch} onValueChange={setBatch}>
            <SelectTrigger className="h-10 w-[180px] rounded-xl"><SelectValue placeholder="All batches" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All batches</SelectItem>
              {batches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />

      <SectionCard bodyClassName="p-0">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : ranked.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No ranked participants yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {ranked.map((r, i) => {
              const initials = (r.full_name || "?").split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();
              const medal = i < 3;
              return (
                <div key={r.user_id} className="flex items-center gap-3 px-4 py-3">
                  <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums", medal ? "bg-gradient-gold text-navy" : "bg-secondary text-muted-foreground")}>
                    {medal ? <Medal className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <Avatar className="h-9 w-9 border border-border">
                    <AvatarImage src={r.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-gradient-navy text-[11px] font-semibold text-primary-foreground">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{r.full_name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{r.business_name || "—"} · {r.batch_name}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold tabular-nums text-foreground">{Number(r.points).toLocaleString("en-IN")}</p>
                    <p className="text-[10px] text-muted-foreground">{stageFor(Number(r.points)).name}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </motion.div>
  );
}
