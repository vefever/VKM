import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { LifeBuoy, Search, ChevronLeft, Loader2, Inbox, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/vkm/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { TicketThread } from "@/components/support/ticket-thread";
import { StatusBadge, PriorityDot } from "@/components/support/support-page";
import {
  useStaffTickets,
  CATEGORIES,
  PRIORITIES,
  STATUSES,
  labelFor,
  type SupportTicket,
  type TicketStatus,
  type TicketPriority,
} from "@/components/support/support-data";

function Avatar({ name, src }: { name: string; src: string | null }) {
  if (src) return <img src={src} alt={name} className="h-8 w-8 shrink-0 rounded-full object-cover" />;
  return (
    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-navy text-xs font-semibold text-primary-foreground">
      {name[0]?.toUpperCase()}
    </span>
  );
}

const TABS: { value: "all" | TicketStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
  { value: "all", label: "All" },
];

export function SupportInbox({ eyebrow }: { eyebrow: string }) {
  const { user } = useAuth();
  const { tickets, loading, updateTicket } = useStaffTickets();
  const [openId, setOpenId] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | TicketStatus>("open");
  const [q, setQ] = useState("");

  const counts = useMemo(() => {
    const c = { open: 0, in_progress: 0, resolved: 0, closed: 0 } as Record<TicketStatus, number>;
    tickets.forEach((t) => (c[t.status] += 1));
    return c;
  }, [tickets]);

  const filtered = useMemo(() => {
    let r = tickets;
    if (tab !== "all") r = r.filter((t) => t.status === tab);
    if (q.trim()) {
      const s = q.toLowerCase();
      r = r.filter(
        (t) =>
          t.subject.toLowerCase().includes(s) ||
          (t.requesterName ?? "").toLowerCase().includes(s),
      );
    }
    return r;
  }, [tickets, tab, q]);

  const selected = tickets.find((t) => t.id === openId) ?? null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      <PageHeader
        eyebrow={eyebrow}
        title="Support inbox"
        description="Participant tickets raised to the team — triage, reply, and resolve."
        icon={LifeBuoy}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(["open", "in_progress", "resolved", "closed"] as TicketStatus[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setTab(s)}
            className={cn(
              "rounded-2xl border bg-card px-4 py-3 text-left transition-colors",
              tab === s ? "border-gold/60 shadow-vkm" : "border-border hover:border-gold/30",
            )}
          >
            <p className="text-2xl font-bold tabular-nums text-foreground">{counts[s]}</p>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {STATUSES.find((x) => x.value === s)?.label}
            </p>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_1fr]">
        {/* Queue */}
        <div className={cn("space-y-3", selected && "hidden lg:block")}>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search subject or participant…"
                className="rounded-xl pl-8"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
            {TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTab(t.value)}
                className={cn(
                  "rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                  tab === t.value
                    ? "bg-gradient-navy text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex h-40 items-center justify-center rounded-2xl border border-border bg-card">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center text-muted-foreground">
              <Inbox className="h-8 w-8 opacity-30" />
              <p className="text-sm">No tickets here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setOpenId(t.id)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-2xl border bg-card p-3 text-left transition-all hover:border-gold/40 hover:shadow-vkm",
                    openId === t.id ? "border-gold/60 shadow-vkm" : "border-border",
                  )}
                >
                  <Avatar name={t.requesterName ?? "P"} src={t.requesterAvatar ?? null} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">
                        {t.subject}
                      </span>
                      <StatusBadge status={t.status} />
                    </div>
                    <p className="truncate text-[11px] text-muted-foreground">{t.requesterName}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                      <span>{labelFor(CATEGORIES, t.category)}</span>
                      <PriorityDot priority={t.priority} />
                      <span className="ml-auto">
                        {formatDistanceToNow(new Date(t.last_message_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail */}
        <div className={cn(!selected && "hidden lg:block")}>
          {selected ? (
            <StaffTicketPane
              ticket={selected}
              meId={user?.id ?? ""}
              onBack={() => setOpenId(null)}
              onUpdate={updateTicket}
            />
          ) : (
            <div className="flex h-[60vh] flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card/40 text-center text-muted-foreground">
              <Inbox className="h-10 w-10 opacity-30" />
              <p className="mt-3 text-sm">Select a ticket to respond.</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function StaffTicketPane({
  ticket,
  meId,
  onBack,
  onUpdate,
}: {
  ticket: SupportTicket;
  meId: string;
  onBack: () => void;
  onUpdate: (
    id: string,
    patch: Partial<Pick<SupportTicket, "status" | "priority" | "assigned_to">>,
  ) => Promise<void>;
}) {
  return (
    <div className="flex h-[calc(100dvh-19rem)] min-h-[460px] flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-vkm">
      {/* Header */}
      <div className="border-b border-border px-3 py-2.5 sm:px-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary lg:hidden"
            aria-label="Back"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{ticket.subject}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {ticket.requesterName} · {labelFor(CATEGORIES, ticket.category)}
              {ticket.assigneeName ? ` · assigned to ${ticket.assigneeName}` : " · unassigned"}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <Select
            value={ticket.status}
            onValueChange={(v) =>
              onUpdate(ticket.id, { status: v as TicketStatus }).then(() =>
                toast.success("Status updated"),
              )
            }
          >
            <SelectTrigger className="h-8 w-36 rounded-lg text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={ticket.priority}
            onValueChange={(v) =>
              onUpdate(ticket.id, { priority: v as TicketPriority }).then(() =>
                toast.success("Priority updated"),
              )
            }
          >
            <SelectTrigger className="h-8 w-28 rounded-lg text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {ticket.assigned_to !== meId && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 rounded-lg text-xs"
              onClick={() =>
                onUpdate(ticket.id, { assigned_to: meId }).then(() => toast.success("Assigned to you"))
              }
            >
              <UserCheck className="h-4 w-4" /> Assign to me
            </Button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <TicketThread ticketId={ticket.id} />
      </div>
    </div>
  );
}
