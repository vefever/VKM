import { useState } from "react";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { LifeBuoy, Plus, ChevronLeft, Loader2, CheckCircle2, RotateCcw, Inbox } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/vkm/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { TicketThread } from "@/components/support/ticket-thread";
import {
  useMyTickets,
  CATEGORIES,
  PRIORITIES,
  STATUSES,
  labelFor,
  type SupportTicket,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
} from "@/components/support/support-data";

export function StatusBadge({ status }: { status: TicketStatus }) {
  const s = STATUSES.find((x) => x.value === status);
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", s?.cls)}>
      {s?.label}
    </span>
  );
}

export function PriorityDot({ priority }: { priority: TicketPriority }) {
  const p = PRIORITIES.find((x) => x.value === priority);
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
      <span className="h-2 w-2 rounded-full" style={{ background: p?.dot }} /> {p?.label}
    </span>
  );
}

export function SupportPage() {
  const { tickets, loading, createTicket, closeTicket } = useMyTickets();
  const [openId, setOpenId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const selected = tickets.find((t) => t.id === openId) ?? null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      <PageHeader
        eyebrow="Participant"
        title="Support"
        description="Raise a ticket to your mentors and the VKM team — track replies and resolutions here."
        icon={LifeBuoy}
        actions={
          <Button className="rounded-full bg-gradient-navy shadow-vkm" onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4" /> New ticket
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,360px)_1fr]">
        {/* List */}
        <div className={cn(selected && "hidden lg:block")}>
          <TicketList
            tickets={tickets}
            loading={loading}
            activeId={openId}
            onSelect={setOpenId}
            onNew={() => setNewOpen(true)}
          />
        </div>

        {/* Detail */}
        <div className={cn(!selected && "hidden lg:block")}>
          {selected ? (
            <TicketPane ticket={selected} onBack={() => setOpenId(null)} onSetStatus={closeTicket} />
          ) : (
            <div className="flex h-[60vh] flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card/40 text-center text-muted-foreground">
              <Inbox className="h-10 w-10 opacity-30" />
              <p className="mt-3 text-sm">Select a ticket to view the conversation.</p>
            </div>
          )}
        </div>
      </div>

      <NewTicketDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreate={createTicket}
        onCreated={(id) => setOpenId(id)}
      />
    </motion.div>
  );
}

function TicketList({
  tickets,
  loading,
  activeId,
  onSelect,
  onNew,
}: {
  tickets: SupportTicket[];
  loading: boolean;
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center rounded-3xl border border-border bg-card">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (tickets.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-navy text-primary-foreground">
          <LifeBuoy className="h-6 w-6" />
        </span>
        <div>
          <p className="text-sm font-semibold text-foreground">No tickets yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Stuck on something? Raise a ticket and the team will help.
          </p>
        </div>
        <Button onClick={onNew} className="rounded-full">
          <Plus className="h-4 w-4" /> New ticket
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {tickets.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onSelect(t.id)}
          className={cn(
            "block w-full rounded-2xl border bg-card p-3.5 text-left transition-all hover:border-gold/40 hover:shadow-vkm",
            activeId === t.id ? "border-gold/60 shadow-vkm" : "border-border",
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-semibold text-foreground">{t.subject}</span>
            <StatusBadge status={t.status} />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span>{labelFor(CATEGORIES, t.category)}</span>
            <PriorityDot priority={t.priority} />
            <span className="ml-auto">
              {formatDistanceToNow(new Date(t.last_message_at), { addSuffix: true })}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}

function TicketPane({
  ticket,
  onBack,
  onSetStatus,
}: {
  ticket: SupportTicket;
  onBack: () => void;
  onSetStatus: (id: string, status: TicketStatus) => Promise<void>;
}) {
  const closed = ticket.status === "closed" || ticket.status === "resolved";
  return (
    <div className="flex h-[calc(100dvh-15rem)] min-h-[440px] flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-vkm">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5 sm:px-4">
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
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
            <span>{labelFor(CATEGORIES, ticket.category)}</span>
            <PriorityDot priority={ticket.priority} />
            {ticket.assigneeName && <span>· with {ticket.assigneeName}</span>}
          </div>
        </div>
        <StatusBadge status={ticket.status} />
        {closed ? (
          <Button
            size="sm"
            variant="outline"
            className="rounded-lg"
            onClick={() => onSetStatus(ticket.id, "open").then(() => toast.success("Ticket reopened"))}
          >
            <RotateCcw className="h-4 w-4" /> Reopen
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="rounded-lg"
            onClick={() =>
              onSetStatus(ticket.id, "resolved").then(() => toast.success("Marked as resolved"))
            }
          >
            <CheckCircle2 className="h-4 w-4" /> Resolve
          </Button>
        )}
      </div>
      <div className="min-h-0 flex-1">
        <TicketThread ticketId={ticket.id} readOnly={ticket.status === "closed"} />
      </div>
    </div>
  );
}

function NewTicketDialog({
  open,
  onOpenChange,
  onCreate,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreate: (t: {
    subject: string;
    category: TicketCategory;
    priority: TicketPriority;
    body: string;
  }) => Promise<string>;
  onCreated: (id: string) => void;
}) {
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<TicketCategory>("technical");
  const [priority, setPriority] = useState<TicketPriority>("normal");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  function reset() {
    setSubject("");
    setCategory("technical");
    setPriority("normal");
    setBody("");
  }

  async function submit() {
    if (!subject.trim() || !body.trim() || busy) return;
    setBusy(true);
    try {
      const id = await onCreate({ subject: subject.trim(), category, priority, body });
      toast.success("Ticket raised", { description: "Our team has been notified." });
      reset();
      onOpenChange(false);
      onCreated(id);
    } catch (e) {
      toast.error("Couldn't create the ticket", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-lg rounded-3xl">
        <DialogHeader>
          <DialogTitle>Raise a support ticket</DialogTitle>
          <DialogDescription>
            Share the details — your mentors and the VKM team will get back to you here.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Subject</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Short summary of the issue"
              maxLength={120}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Category</label>
              <Select value={category} onValueChange={(v) => setCategory(v as TicketCategory)}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Priority</label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TicketPriority)}>
                <SelectTrigger className="rounded-xl">
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
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Describe the issue
            </label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              placeholder="What's happening? Include steps, screenshots help too — you can attach them after creating the ticket."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={busy || !subject.trim() || !body.trim()}
            className="bg-gradient-navy"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Raise
            ticket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
