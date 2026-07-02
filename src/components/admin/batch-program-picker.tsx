import { Layers3 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionCard } from "@/components/vkm/section-card";
import type { ProgramOption } from "@/lib/vkm/program-scope";

// Batch-first content scope selector. Each option is a batch (mapped to its
// program); editing applies to that batch's program only. Shown on every
// content editor (Program Design, Program Builder, Class Videos).
export function BatchProgramPicker({
  options,
  selected,
  onSelect,
  loading,
  hint,
}: {
  options: ProgramOption[];
  selected: string | null;
  onSelect: (programId: string) => void;
  loading: boolean;
  hint?: string;
}) {
  return (
    <SectionCard>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-navy text-primary-foreground">
            <Layers3 className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Batch</p>
            <p className="text-[11px] text-muted-foreground">
              {hint ?? "Choose which batch's content you're editing."}
            </p>
          </div>
        </div>
        {loading ? (
          <span className="text-xs text-muted-foreground">Loading batches…</span>
        ) : options.length === 0 ? (
          <span className="text-xs text-muted-foreground">
            No batch has a program yet — set one in Batches.
          </span>
        ) : (
          <Select value={selected ?? undefined} onValueChange={onSelect}>
            <SelectTrigger className="h-10 w-full rounded-xl sm:w-56">
              <SelectValue placeholder="Select a batch…" />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.programId} value={o.programId}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </SectionCard>
  );
}
