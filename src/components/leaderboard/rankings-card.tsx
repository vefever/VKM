import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, SlidersHorizontal, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { PinnedUserRow } from "@/components/leaderboard/pinned-user-row";
import { MedalRow } from "@/components/leaderboard/medal-row";
import { StandardRow } from "@/components/leaderboard/standard-row";
import type { LeaderboardEntry, Stage } from "@/types/leaderboard";

const STAGES: Stage[] = ["Operator", "Builder", "Starter"];

function exportCsv(rows: LeaderboardEntry[]) {
  const header = ["Rank", "Name", "Business", "Weeks", "Points", "Stage"];
  const body = rows.map((r) => [
    `#${r.rank}`,
    r.name,
    r.business,
    `${r.weeksCompleted}/${r.totalWeeks}`,
    r.points,
    r.stage,
  ]);
  const csv = [header, ...body]
    .map((line) => line.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "leaderboard-batch-16.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function RankingsCard({ entries }: { entries: LeaderboardEntry[] }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<Stage>>(new Set(STAGES));

  const currentUser = useMemo(() => entries.find((e) => e.isCurrentUser), [entries]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      const matchStage = selected.has(e.stage);
      const matchQuery =
        !q || e.name.toLowerCase().includes(q) || e.business.toLowerCase().includes(q);
      return matchStage && matchQuery;
    });
  }, [entries, query, selected]);

  // Pinned user shows always; medals = ranks 1-3; standard = rest (minus current user).
  const listEntries = filtered.filter((e) => !e.isCurrentUser);
  const medals = listEntries.filter((e) => e.rank <= 3);
  const standard = listEntries.filter((e) => e.rank > 3);

  function toggleStage(s: Stage) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-vkm"
    >
      {/* Gold accent stripe */}
      <div className="h-1 w-full bg-gradient-gold" />

      <div className="p-4 sm:p-5">
        {/* Header */}
        <h3 className="text-base font-semibold tracking-tight text-foreground">Rankings</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">Live data and recent activity</p>

        {/* Toolbar */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[160px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="h-10 rounded-xl pl-9"
            />
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-10 rounded-xl">
                <SlidersHorizontal className="h-5 w-5" /> Filter
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-48">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Stage
              </p>
              <div className="space-y-1">
                {STAGES.map((s) => (
                  <label key={s} className="flex cursor-pointer items-center gap-2 py-1 text-sm">
                    <Checkbox checked={selected.has(s)} onCheckedChange={() => toggleStage(s)} />
                    {s}
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Button
            variant="outline"
            size="sm"
            className="h-10 rounded-xl"
            onClick={() => exportCsv(filtered)}
          >
            <Download className="h-5 w-5" /> Export
          </Button>
        </div>

        {/* List */}
        <div className="mt-4 space-y-2.5">
          {currentUser && <PinnedUserRow entry={currentUser} />}

          <AnimatePresence mode="popLayout">
            {medals.map((e, i) => (
              <MedalRow key={e.id} entry={e} index={i} />
            ))}
            {standard.map((e, i) => (
              <StandardRow key={e.id} entry={e} index={i} />
            ))}
          </AnimatePresence>

          {listEntries.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No participants match your search or filters.
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
