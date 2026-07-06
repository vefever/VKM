import { useMemo, useState } from "react";
import { CheckCircle2, XCircle, Loader2, MessageSquareMore, RefreshCw } from "lucide-react";
import { SectionCard } from "@/components/vkm/section-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useWhatsappLog, type WhatsappLogRow } from "@/components/admin/messaging-data";

// Human labels + accent for each WhatsApp `kind` written by the messaging fn.
const KIND_META: Record<string, { label: string; className: string }> = {
  reminder: { label: "Reminder", className: "bg-gold/15 text-[oklch(0.45_0.1_85)]" },
  admin: { label: "Manual send", className: "bg-[oklch(0.93_0.05_200)] text-[oklch(0.4_0.12_200)]" },
  test: { label: "Test", className: "bg-muted text-muted-foreground" },
};

const KIND_FILTERS = ["all", "reminder", "admin", "test"] as const;

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleString();
}

// The WhatsApp audit log — every WhatsApp message the platform has sent, newest
// first, live-updating. Shown on the Messaging "WhatsApp log" tab.
export function WhatsappLogPanel({ limit = 200 }: { limit?: number }) {
  const { rows, loading, reload } = useWhatsappLog(limit);
  const [kind, setKind] = useState<(typeof KIND_FILTERS)[number]>("all");
  const [onlyFailed, setOnlyFailed] = useState(false);

  const filtered = useMemo(
    () => rows.filter((r) => (kind === "all" || r.kind === kind) && (!onlyFailed || r.status === "failed")),
    [rows, kind, onlyFailed],
  );

  const failedCount = rows.filter((r) => r.status === "failed").length;

  return (
    <SectionCard
      title={
        <span className="flex items-center gap-2">
          <MessageSquareMore className="h-4 w-4 text-navy" /> WhatsApp log
        </span>
      }
      subtitle="Every WhatsApp message the platform has sent — updates live"
      action={
        <Button variant="outline" size="sm" className="rounded-full" onClick={() => void reload()}>
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {KIND_FILTERS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={cn(
              "app-press rounded-full px-2.5 py-1 text-xs font-medium capitalize transition-colors",
              kind === k ? "bg-gradient-navy text-primary-foreground" : "bg-secondary/60 text-muted-foreground hover:text-foreground",
            )}
          >
            {k === "all" ? "All" : (KIND_META[k]?.label ?? k)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setOnlyFailed((v) => !v)}
          className={cn(
            "app-press ml-auto rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
            onlyFailed ? "bg-[oklch(0.93_0.06_25)] text-[oklch(0.45_0.16_25)]" : "bg-secondary/60 text-muted-foreground hover:text-foreground",
          )}
        >
          Failed only{failedCount > 0 ? ` (${failedCount})` : ""}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {rows.length === 0 ? "No WhatsApp messages sent yet." : "No messages match this filter."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3 font-medium">When</th>
                <th className="py-2 pr-3 font-medium">Recipient</th>
                <th className="py-2 pr-3 font-medium">Type</th>
                <th className="py-2 pr-3 font-medium">Message</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <WhatsappLogRowView key={r.id} row={r} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

function WhatsappLogRowView({ row }: { row: WhatsappLogRow }) {
  const meta = KIND_META[row.kind] ?? { label: row.kind, className: "bg-secondary text-foreground" };
  const failed = row.status === "failed";
  return (
    <tr className="border-b border-border/60 last:border-0 align-top">
      <td className="whitespace-nowrap py-2.5 pr-3 text-muted-foreground" title={new Date(row.created_at).toLocaleString()}>
        {timeAgo(row.created_at)}
      </td>
      <td className="py-2.5 pr-3 font-medium text-foreground">{row.to_phone}</td>
      <td className="py-2.5 pr-3">
        <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium", meta.className)}>
          {meta.label}
        </span>
      </td>
      <td className="max-w-[240px] truncate py-2.5 pr-3 text-foreground" title={row.body ?? ""}>
        {row.body ?? "—"}
      </td>
      <td className="py-2.5">
        {failed ? (
          <span
            className="inline-flex items-center gap-1 text-xs font-semibold text-[oklch(0.5_0.2_25)]"
            title={row.detail ?? "Failed"}
          >
            <XCircle className="h-3.5 w-3.5" /> Failed
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[oklch(0.5_0.14_160)]">
            <CheckCircle2 className="h-3.5 w-3.5" /> Sent
          </span>
        )}
        {row.provider && <span className="ml-1.5 text-[11px] capitalize text-muted-foreground">· {row.provider}</span>}
      </td>
    </tr>
  );
}
