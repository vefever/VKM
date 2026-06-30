import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import {
  Users, UserPlus, Upload, Download, Search, Trash2, Mail, Filter, Send, Copy, CheckCircle2, Clock, XCircle, Loader2, KeyRound, Link as LinkIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SectionCard } from "@/components/vkm/section-card";
import { KpiTile } from "@/components/vkm/kpi-tile";
import { PageHeader } from "@/components/vkm/page-header";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  createInvite, listInvites, revokeInvite, resendInvite,
  type InviteRole,
} from "@/lib/vkm/invites.functions";
import { Checkbox } from "@/components/ui/checkbox";
import { UserDetailDialog } from "@/components/admin/user-detail-dialog";
import {
  getCoachAssignments, adminListCoaches, adminSetUserCoach, adminBulkAssignCoach,
} from "@/lib/vkm/admin-users.functions";

const UNASSIGNED = "__none__";
type CoachOpt = { id: string; full_name: string | null; email: string; participant_count: number };
type CoachRef = { id: string; name: string };

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({ meta: [{ title: "User Management · VKM" }] }),
  component: UsersPage,
});

type Invite = Awaited<ReturnType<typeof listInvites>>[number];

const ROLE_LABEL: Record<InviteRole, string> = {
  participant: "User (Participant)",
  coach: "Coach",
  mentor: "Mentor",
};
const ROLE_BADGE: Record<InviteRole, string> = {
  participant: "bg-[oklch(0.94_0.05_250)] text-[oklch(0.35_0.12_260)]",
  coach: "bg-[oklch(0.95_0.08_85)] text-[oklch(0.4_0.14_70)]",
  mentor: "bg-[oklch(0.93_0.06_160)] text-[oklch(0.35_0.12_160)]",
};

const CSV_TEMPLATE =
  "name,email,role,phone,batch\nRiya Sharma,riya@example.com,participant,+91-9000000001,Batch 16\nKavya Reddy,kavya@example.com,coach,,\nSoumya Iyer,soumya@example.com,mentor,,\n";

type CsvRow = { name: string; email: string; role: InviteRole; phone?: string; batch?: string };

function parseUsersCsv(text: string): { rows: CsvRow[]; errors: string[] } {
  const errors: string[] = [];
  const rows: CsvRow[] = [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { rows, errors: ["File is empty"] };
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const idx = (k: string) => header.indexOf(k);
  const iName = idx("name"), iEmail = idx("email"), iRole = idx("role"), iPhone = idx("phone"), iBatch = idx("batch");
  if (iName < 0 || iEmail < 0 || iRole < 0) return { rows, errors: ["CSV must include name, email, role columns"] };
  for (let r = 1; r < lines.length; r++) {
    const cells = lines[r].split(",").map((c) => c.trim());
    const role = (cells[iRole] || "").toLowerCase();
    if (!["participant", "coach", "mentor"].includes(role)) { errors.push(`Row ${r + 1}: invalid role "${cells[iRole]}"`); continue; }
    const email = cells[iEmail] || "";
    if (!/^\S+@\S+\.\S+$/.test(email)) { errors.push(`Row ${r + 1}: invalid email "${email}"`); continue; }
    rows.push({
      name: cells[iName] || email.split("@")[0],
      email, role: role as InviteRole,
      phone: iPhone >= 0 ? cells[iPhone] || undefined : undefined,
      batch: iBatch >= 0 ? cells[iBatch] || undefined : undefined,
    });
  }
  return { rows, errors };
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function UsersPage() {
  const list = useServerFn(listInvites);
  const coachMapFn = useServerFn(getCoachAssignments);
  const coachesFn = useServerFn(adminListCoaches);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [coachMap, setCoachMap] = useState<Record<string, CoachRef>>({});
  const [coaches, setCoaches] = useState<CoachOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | InviteRole>("all");
  const [q, setQ] = useState("");
  const [batchFilter, setBatchFilter] = useState<string>("all");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [detailUser, setDetailUser] = useState<{ email: string; name: string } | null>(null);
  const [resultOpen, setResultOpen] = useState<null | { name: string; email: string; role: InviteRole; inviteUrl: string; tempPassword: string; emailSent: boolean }>(null);

  async function refresh() {
    try {
      const [inv, assignments, coachList] = await Promise.all([
        list({}),
        coachMapFn({}).catch(() => []),
        coachesFn({}).catch(() => []),
      ]);
      setInvites(inv);
      setCoaches(coachList);
      const map: Record<string, CoachRef> = {};
      for (const c of assignments) {
        if (!c.coach_id) continue;
        map[c.participant_email.toLowerCase()] = { id: c.coach_id, name: c.coach_name || c.coach_email || "Coach" };
      }
      setCoachMap(map);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { refresh(); }, []);

  const counts = useMemo(() => ({
    all: invites.length,
    participant: invites.filter((u) => u.role === "participant").length,
    coach: invites.filter((u) => u.role === "coach").length,
    mentor: invites.filter((u) => u.role === "mentor").length,
  }), [invites]);

  const batches = useMemo(() => {
    const set = new Set<string>();
    invites.forEach((u) => { if (u.batch) set.add(u.batch); });
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
    );
  }, [invites]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return invites
      .filter((u) => tab === "all" || u.role === tab)
      .filter((u) => batchFilter === "all" || (u.batch || "") === batchFilter)
      .filter((u) => !needle || u.name.toLowerCase().includes(needle) || u.email.toLowerCase().includes(needle));
  }, [invites, tab, q, batchFilter]);

  return (
    <div className="space-y-8 px-4 py-6 md:px-8 md:py-8">
      <PageHeader
        eyebrow="Users & Access"
        icon={Users}
        title="User Management"
        description="Invite Users, Coaches, and Mentors with secure, expiring invite links + temporary passwords. New users are forced to reset on first login."
        actions={
          <>
            <Button variant="outline" className="rounded-xl" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" /> Import CSV
            </Button>
            <Button className="rounded-xl bg-gradient-navy text-primary-foreground hover:opacity-90" onClick={() => setInviteOpen(true)}>
              <UserPlus className="h-4 w-4" /> Invite user
            </Button>
          </>
        }
      />

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiTile label="Total invites" value={String(counts.all)} accent="navy" icon={Users} />
        <KpiTile label="Participants" value={String(counts.participant)} accent="navy" />
        <KpiTile label="Coaches" value={String(counts.coach)} accent="gold" />
        <KpiTile label="Mentors" value={String(counts.mentor)} accent="success" />
      </motion.div>

      <SectionCard title="Directory" subtitle="Switch tabs to see users grouped by role" bodyClassName="p-0">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 pt-4">
            <TabsList className="bg-transparent p-0 h-auto gap-1">
              {(["all", "participant", "coach", "mentor"] as const).map((id) => (
                <TabsTrigger key={id} value={id} className="rounded-lg data-[state=active]:bg-gradient-navy data-[state=active]:text-primary-foreground data-[state=active]:shadow-vkm">
                  {id === "all" ? "All" : id === "participant" ? "Users" : id === "coach" ? "Coaches" : "Mentors"}
                  <span className="ml-2 rounded-full bg-muted px-1.5 text-[10px] text-foreground/70 data-[state=active]:bg-white/20">
                    {id === "all" ? counts.all : counts[id]}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
            <div className="flex items-center gap-2 pb-3 md:pb-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email" className="h-9 w-[240px] rounded-xl pl-9" />
              </div>
              <Select value={batchFilter} onValueChange={setBatchFilter}>
                <SelectTrigger className="h-9 w-[160px] rounded-xl">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="All batches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All batches</SelectItem>
                  {batches.map((b) => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <TabsContent value={tab} className="m-0 p-5">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <UsersTable rows={filtered} coachMap={coachMap} coaches={coaches} onChanged={refresh} onOpenDetail={(email, name) => setDetailUser({ email, name })} />
            )}
          </TabsContent>
        </Tabs>
      </SectionCard>

      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onInvited={(r) => { setResultOpen(r); refresh(); }}
      />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} onDone={refresh} />
      <InviteResultDialog data={resultOpen} onOpenChange={(o) => !o && setResultOpen(null)} />
      <UserDetailDialog
        email={detailUser?.email ?? null}
        name={detailUser?.name ?? ""}
        open={!!detailUser}
        onOpenChange={(o) => !o && setDetailUser(null)}
        batches={batches}
        onChanged={refresh}
      />
    </div>
  );
}

function StatusBadge({ inv }: { inv: Invite }) {
  const expired = new Date(inv.expires_at).getTime() < Date.now();
  if (inv.status === "revoked") return <Badge variant="outline" className="rounded-full"><XCircle className="mr-1 h-3 w-3" /> Revoked</Badge>;
  if (inv.status === "accepted") return <Badge className="rounded-full"><CheckCircle2 className="mr-1 h-3 w-3" /> Active</Badge>;
  if (expired) return <Badge variant="outline" className="rounded-full text-destructive border-destructive/40"><Clock className="mr-1 h-3 w-3" /> Expired</Badge>;
  return <Badge variant="outline" className="rounded-full"><Mail className="mr-1 h-3 w-3" /> Invited</Badge>;
}

function UsersTable({ rows, coachMap, coaches, onChanged, onOpenDetail }: { rows: Invite[]; coachMap: Record<string, CoachRef>; coaches: CoachOpt[]; onChanged: () => void; onOpenDetail: (email: string, name: string) => void }) {
  const resend = useServerFn(resendInvite);
  const revoke = useServerFn(revokeInvite);
  const setCoach = useServerFn(adminSetUserCoach);
  const bulkAssign = useServerFn(adminBulkAssignCoach);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [assigningEmail, setAssigningEmail] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCoach, setBulkCoach] = useState<string>(UNASSIGNED);
  const [bulkBusy, setBulkBusy] = useState(false);

  const participantEmails = useMemo(
    () => rows.filter((r) => r.role === "participant").map((r) => r.email),
    [rows],
  );
  const allSelected = participantEmails.length > 0 && participantEmails.every((e) => selected.has(e));

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Users className="h-8 w-8 text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">No users in this view. Click <span className="font-medium text-foreground">Invite user</span> to add one.</p>
      </div>
    );
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(participantEmails));
  }
  function toggleOne(email: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  }

  async function handleInlineCoach(email: string, coachId: string) {
    setAssigningEmail(email);
    try {
      await setCoach({ data: { participantEmail: email, coachId: coachId === UNASSIGNED ? "" : coachId } });
      toast.success(coachId === UNASSIGNED ? "Coach unassigned" : "Coach assigned");
      onChanged();
    } catch (e) { toast.error((e as Error).message); }
    finally { setAssigningEmail(null); }
  }

  async function handleBulkAssign() {
    const emails = [...selected];
    if (emails.length === 0) return;
    setBulkBusy(true);
    try {
      const r = await bulkAssign({ data: { emails, coachId: bulkCoach === UNASSIGNED ? "" : bulkCoach } });
      toast.success(`${r.count} ${bulkCoach === UNASSIGNED ? "unassigned" : "assigned"}`);
      setSelected(new Set());
      setBulkCoach(UNASSIGNED);
      onChanged();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBulkBusy(false); }
  }

  async function handleResend(id: string) {
    setBusyId(id);
    try {
      const r = await resend({ data: { id, origin: window.location.origin } });
      toast.success(r.emailSent ? "Invite email sent" : "Invite link refreshed", {
        description: r.emailSent ? undefined : "Email infra not set up — share the link manually.",
      });
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusyId(null); }
  }
  async function handleRevoke(id: string, email: string) {
    setBusyId(id);
    try {
      await revoke({ data: { id } });
      toast.success("Invite revoked", { description: email });
      onChanged();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusyId(null); }
  }
  function copyLink(token: string) {
    const url = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Invite link copied");
  }

  return (
    <div className="space-y-3">
      {/* Bulk-assign bar — appears when participants are selected */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <span className="text-sm text-muted-foreground">→ assign coach</span>
          <Select value={bulkCoach} onValueChange={setBulkCoach}>
            <SelectTrigger className="h-9 w-[200px] rounded-xl"><SelectValue placeholder="Choose a coach" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={UNASSIGNED}>Unassign</SelectItem>
              {coaches.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.full_name || c.email}<span className="ml-1 text-xs text-muted-foreground">· {c.participant_count}</span></SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" className="rounded-xl bg-gradient-navy text-primary-foreground hover:opacity-90" disabled={bulkBusy} onClick={handleBulkAssign}>
            {bulkBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Apply
          </Button>
          <Button size="sm" variant="ghost" className="rounded-xl" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-10">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all participants" disabled={participantEmails.length === 0} />
              </TableHead>
              <TableHead className="text-xs uppercase tracking-wider">User</TableHead>
              <TableHead className="text-xs uppercase tracking-wider">Role</TableHead>
              <TableHead className="text-xs uppercase tracking-wider">Batch</TableHead>
              <TableHead className="text-xs uppercase tracking-wider">Coach</TableHead>
              <TableHead className="text-xs uppercase tracking-wider">Status</TableHead>
              <TableHead className="text-xs uppercase tracking-wider">Expires</TableHead>
              <TableHead className="text-right text-xs uppercase tracking-wider">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((u) => {
              const isParticipant = u.role === "participant";
              const current = coachMap[u.email.toLowerCase()];
              return (
                <TableRow key={u.id} className="group" data-state={selected.has(u.email) ? "selected" : undefined}>
                  <TableCell>
                    {isParticipant && (
                      <Checkbox checked={selected.has(u.email)} onCheckedChange={() => toggleOne(u.email)} aria-label={`Select ${u.name}`} />
                    )}
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => onOpenDetail(u.email, u.name)}
                      className="flex items-center gap-3 rounded-lg text-left transition-colors hover:opacity-80"
                      title="Open user details"
                    >
                      <Avatar className="h-8 w-8"><AvatarFallback className="bg-gradient-navy text-[10px] text-primary-foreground">{initials(u.name)}</AvatarFallback></Avatar>
                      <div>
                        <p className="font-medium leading-tight underline-offset-2 hover:underline">{u.name}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </button>
                  </TableCell>
                  <TableCell>
                    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", ROLE_BADGE[u.role as InviteRole])}>
                      {ROLE_LABEL[u.role as InviteRole]}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.batch || "—"}</TableCell>
                  <TableCell>
                    {isParticipant ? (
                      <Select
                        value={current?.id ?? UNASSIGNED}
                        onValueChange={(v) => handleInlineCoach(u.email, v)}
                        disabled={assigningEmail === u.email}
                      >
                        <SelectTrigger className="h-8 w-[160px] rounded-lg text-xs">
                          {assigningEmail === u.email ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SelectValue placeholder="Unassigned" />}
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                          {coaches.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.full_name || c.email}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell><StatusBadge inv={u} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground tabular-nums">{new Date(u.expires_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button size="sm" variant="ghost" className="h-8 rounded-lg" onClick={() => copyLink(u.token)} title="Copy invite link">
                        <LinkIcon className="h-4 w-4" /> Copy
                      </Button>
                      {u.status === "pending" && (
                        <Button size="sm" variant="ghost" className="h-8 rounded-lg" disabled={busyId === u.id} onClick={() => handleResend(u.id)}>
                          <Send className="h-4 w-4" /> Resend
                        </Button>
                      )}
                      {u.status !== "accepted" && (
                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg text-destructive" disabled={busyId === u.id} onClick={() => handleRevoke(u.id, u.email)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function InviteDialog({
  open, onOpenChange, onInvited,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  onInvited: (r: { name: string; email: string; role: InviteRole; inviteUrl: string; tempPassword: string; emailSent: boolean }) => void;
}) {
  const invite = useServerFn(createInvite);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<InviteRole>("participant");
  const [batch, setBatch] = useState("Batch 16");
  const [submitting, setSubmitting] = useState(false);

  function reset() { setName(""); setEmail(""); setPhone(""); setRole("participant"); setBatch("Batch 16"); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !/^\S+@\S+\.\S+$/.test(email)) {
      toast.error("Check the form", { description: "Name and a valid email are required." });
      return;
    }
    setSubmitting(true);
    try {
      const res = await invite({
        data: {
          name: name.trim(), email: email.trim(), phone: phone.trim() || undefined,
          role, batch: batch.trim() || undefined,
          origin: window.location.origin,
        },
      });
      toast.success("Invite created", { description: res.emailSent ? `Email sent to ${email}` : `Share the link with ${email}` });
      onInvited({ name: name.trim(), email: email.trim(), role, inviteUrl: res.inviteUrl, tempPassword: res.tempPassword, emailSent: res.emailSent });
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error("Could not invite", { description: (err as Error).message });
    } finally { setSubmitting(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" /> Invite user</DialogTitle>
          <DialogDescription>
            We'll create their account with a temporary password and a secure invite link that expires in 7 days. They must reset their password on first login.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as InviteRole)}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="participant">User (Participant)</SelectItem>
                <SelectItem value="coach">Coach</SelectItem>
                <SelectItem value="mentor">Mentor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Riya Sharma" className="h-11 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91-9000000000" className="h-11 rounded-xl" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" className="h-11 rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="batch">Batch{role === "participant" ? "" : " (optional)"}</Label>
            <Input id="batch" value={batch} onChange={(e) => setBatch(e.target.value)} placeholder="Batch 12" className="h-11 rounded-xl" />
            <p className="text-xs text-muted-foreground">
              Creates the batch if it's new and links this user to it (e.g. Batch 12, 13, 14). Participants also become visible in the Community directory.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting} className="rounded-xl bg-gradient-navy text-primary-foreground hover:opacity-90">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Send invite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InviteResultDialog({
  data, onOpenChange,
}: {
  data: { name: string; email: string; role: InviteRole; inviteUrl: string; tempPassword: string; emailSent: boolean } | null;
  onOpenChange: (open: boolean) => void;
}) {
  if (!data) return null;
  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  }
  return (
    <Dialog open={!!data} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-[oklch(0.55_0.16_160)]" /> Invite ready</DialogTitle>
          <DialogDescription>
            {data.emailSent
              ? <>An email with the secure link was sent to <span className="font-medium text-foreground">{data.email}</span>. The link expires in 7 days.</>
              : <>Email infrastructure isn't set up yet — share these credentials manually with <span className="font-medium text-foreground">{data.email}</span>. The link expires in 7 days.</>}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><LinkIcon className="h-3.5 w-3.5" /> Invite link</Label>
            <div className="flex gap-2">
              <Input value={data.inviteUrl} readOnly className="h-11 rounded-xl font-mono text-xs" />
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => copy(data.inviteUrl, "Invite link")}><Copy className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><KeyRound className="h-3.5 w-3.5" /> Temporary password</Label>
            <div className="flex gap-2">
              <Input value={data.tempPassword} readOnly className="h-11 rounded-xl font-mono" />
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => copy(data.tempPassword, "Temp password")}><Copy className="h-4 w-4" /></Button>
            </div>
            <p className="text-xs text-muted-foreground">User will be forced to set a new password on first login.</p>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} className="rounded-xl bg-gradient-navy text-primary-foreground hover:opacity-90">Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void }) {
  const invite = useServerFn(createInvite);
  const fileRef = useRef<HTMLInputElement>(null);
  const [csvText, setCsvText] = useState("");
  const [running, setRunning] = useState(false);
  const preview = useMemo(() => (csvText ? parseUsersCsv(csvText) : null), [csvText]);

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result || ""));
    reader.readAsText(file);
  }

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "vkm-users-template.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  async function runImport() {
    if (!preview || preview.rows.length === 0) { toast.error("Nothing to import"); return; }
    setRunning(true);
    let added = 0, skipped = 0;
    for (const row of preview.rows) {
      try {
        await invite({ data: { ...row, origin: window.location.origin } });
        added++;
      } catch { skipped++; }
    }
    toast.success("Import complete", { description: `${added} invited, ${skipped} skipped` });
    setCsvText(""); if (fileRef.current) fileRef.current.value = "";
    setRunning(false); onOpenChange(false); onDone();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Upload className="h-5 w-5" /> Import users from CSV</DialogTitle>
          <DialogDescription>
            Columns: <code className="rounded bg-muted px-1">name, email, role, phone, batch</code>.
            Role must be one of <code className="rounded bg-muted px-1">participant</code>, <code className="rounded bg-muted px-1">coach</code>, <code className="rounded bg-muted px-1">mentor</code>.
            Each row creates an account with a temp password and a secure invite link.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" className="rounded-xl" onClick={downloadTemplate}>
              <Download className="h-4 w-4" /> Download template
            </Button>
            <Input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} className="h-11 rounded-xl" />
          </div>
          {preview && (
            <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm">
              <p>
                <span className="font-medium">{preview.rows.length}</span> valid row(s) ready to import.
                {preview.errors.length > 0 && <span className="ml-2 text-destructive">{preview.errors.length} issue(s)</span>}
              </p>
              {preview.errors.length > 0 && (
                <ul className="mt-2 max-h-32 list-disc overflow-auto pl-5 text-xs text-destructive">
                  {preview.errors.slice(0, 8).map((er, i) => <li key={i}>{er}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={runImport} disabled={!preview || preview.rows.length === 0 || running} className="rounded-xl bg-gradient-navy text-primary-foreground hover:opacity-90">
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Import {preview ? `${preview.rows.length}` : ""} users
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
