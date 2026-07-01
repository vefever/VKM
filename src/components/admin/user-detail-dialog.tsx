import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2, Trophy, CheckCircle2, Flame, Timer, Target, IndianRupee, Award,
  KeyRound, LogIn, Copy, Users, Clock, ShieldAlert, ArrowRightLeft, Save, UserCog,
  Ban, ShieldCheck, Trash2,
} from "lucide-react";
import { format, formatDistanceToNowStrict } from "date-fns";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useParticipantTeam } from "@/components/coach/coach-data";
import {
  getUserDetail, adminResetPassword, adminSetUserBatch, impersonateUser,
  adminListCoaches, adminSetUserCoach, adminSetUserBlocked, adminDeleteUser,
  type AdminUserDetail,
} from "@/lib/vkm/admin-users.functions";

const UNASSIGNED = "__none__";
type CoachOpt = { id: string; full_name: string | null; email: string; participant_count: number };

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}
function fmt(d: string | null | undefined) {
  if (!d) return "—";
  try { return format(new Date(d), "d MMM yyyy, h:mm a"); } catch { return "—"; }
}
function ago(d: string | null | undefined) {
  if (!d) return "never";
  try { return formatDistanceToNowStrict(new Date(d), { addSuffix: true }); } catch { return "—"; }
}

function Kpi({ icon: Icon, label, value, hint }: { icon: typeof Trophy; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[11px] uppercase tracking-wider">{label}</span>
      </div>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function UserDetailDialog({
  email, name, open, onOpenChange, batches, onChanged,
}: {
  email: string | null;
  name: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  batches: string[];
  onChanged: () => void;
}) {
  const fetchDetail = useServerFn(getUserDetail);
  const resetPw = useServerFn(adminResetPassword);
  const setBatch = useServerFn(adminSetUserBatch);
  const impersonate = useServerFn(impersonateUser);
  const listCoaches = useServerFn(adminListCoaches);
  const setCoach = useServerFn(adminSetUserCoach);
  const setBlocked = useServerFn(adminSetUserBlocked);
  const deleteUser = useServerFn(adminDeleteUser);

  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [batchInput, setBatchInput] = useState("");
  const [coaches, setCoaches] = useState<CoachOpt[]>([]);
  const [coachSel, setCoachSel] = useState<string>(UNASSIGNED);
  const [busy, setBusy] = useState<null | "batch" | "reset" | "login" | "coach" | "block" | "delete">(null);
  const [tempPw, setTempPw] = useState<string | null>(null);
  const [loginLink, setLoginLink] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isParticipant = !!detail?.roles.includes("participant");
  const isSuperAdmin = !!detail?.roles.includes("super_admin");
  const isBlocked = !!detail?.auth.is_banned;
  const { members: team } = useParticipantTeam(detail?.user_id ?? null);

  useEffect(() => {
    if (!open || !email) return;
    setDetail(null); setTempPw(null); setLoginLink(null); setLoading(true);
    fetchDetail({ data: { email } })
      .then((d) => {
        setDetail(d);
        setBatchInput(d.batches.find((b) => b.role === "participant")?.name ?? "");
        setCoachSel(d.assigned_coach?.coach_id ?? UNASSIGNED);
      })
      .catch((e) => toast.error("Could not load user", { description: (e as Error).message }))
      .finally(() => setLoading(false));
    // Coaches list for the assignment picker (cached across opens once loaded).
    if (coaches.length === 0) {
      listCoaches({}).then(setCoaches).catch(() => {});
    }
  }, [open, email, fetchDetail, listCoaches, coaches.length]);

  async function handleSetCoach() {
    if (!email) return;
    setBusy("coach");
    try {
      await setCoach({ data: { participantEmail: email, coachId: coachSel === UNASSIGNED ? "" : coachSel } });
      toast.success(coachSel === UNASSIGNED ? "Coach unassigned" : "Coach assigned");
      const d = await fetchDetail({ data: { email } });
      setDetail(d);
      onChanged();
    } catch (e) { toast.error("Could not update coach", { description: (e as Error).message }); }
    finally { setBusy(null); }
  }

  async function handleMoveBatch() {
    if (!email || !batchInput.trim()) return;
    setBusy("batch");
    try {
      await setBatch({ data: { email, batch: batchInput.trim() } });
      toast.success("Batch updated", { description: `${name} → ${batchInput.trim()}` });
      onChanged();
      const d = await fetchDetail({ data: { email } });
      setDetail(d);
    } catch (e) { toast.error("Could not move batch", { description: (e as Error).message }); }
    finally { setBusy(null); }
  }

  async function handleReset() {
    if (!email) return;
    setBusy("reset"); setTempPw(null);
    try {
      const r = await resetPw({ data: { email } });
      setTempPw(r.tempPassword);
      toast.success("Password reset", { description: "Share the new temporary password." });
      onChanged();
    } catch (e) { toast.error("Could not reset password", { description: (e as Error).message }); }
    finally { setBusy(null); }
  }

  async function handleImpersonate() {
    if (!email) return;
    setBusy("login"); setLoginLink(null);
    try {
      const r = await impersonate({ data: { email } });
      setLoginLink(r.actionLink);
    } catch (e) { toast.error("Could not create login link", { description: (e as Error).message }); }
    finally { setBusy(null); }
  }

  async function handleToggleBlock() {
    if (!email || !detail) return;
    const next = !detail.auth.is_banned;
    setBusy("block");
    try {
      await setBlocked({ data: { email, blocked: next } });
      toast.success(next ? "User blocked" : "User unblocked", {
        description: next ? "They can't sign in until unblocked." : email,
      });
      const d = await fetchDetail({ data: { email } });
      setDetail(d);
      onChanged();
    } catch (e) {
      toast.error("Could not update block status", { description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete() {
    if (!email) return;
    setBusy("delete");
    try {
      await deleteUser({ data: { email } });
      toast.success("User deleted", { description: email });
      setConfirmDelete(false);
      onChanged();
      onOpenChange(false);
    } catch (e) {
      toast.error("Could not delete user", { description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  }

  const p = detail?.performance;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px] max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-gradient-navy text-xs text-primary-foreground">{initials(name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate">{name}</p>
              <p className="truncate text-xs font-normal text-muted-foreground">{email}</p>
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">User detail and admin actions</DialogDescription>
        </DialogHeader>

        {loading || !detail ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4">
            {/* Roles + last active */}
            <div className="flex flex-wrap items-center gap-2">
              {detail.roles.map((r) => (
                <Badge key={r} variant="outline" className="rounded-full capitalize">{r.replace("_", " ")}</Badge>
              ))}
              {detail.profile?.must_reset_password && (
                <Badge variant="outline" className="rounded-full border-amber-400/50 text-amber-600">Pending reset</Badge>
              )}
              {isBlocked && (
                <Badge variant="outline" className="rounded-full border-destructive/50 text-destructive">
                  <Ban className="mr-1 h-3 w-3" /> Blocked
                </Badge>
              )}
              <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> Active {ago(detail.last_active_at)}
              </span>
            </div>

            <Tabs defaultValue="overview">
              <TabsList className="grid w-full grid-cols-3 rounded-xl">
                <TabsTrigger value="overview" className="rounded-lg">Performance</TabsTrigger>
                <TabsTrigger value="activity" className="rounded-lg">Activity & login</TabsTrigger>
                <TabsTrigger value="manage" className="rounded-lg">Manage</TabsTrigger>
              </TabsList>

              {/* PERFORMANCE */}
              <TabsContent value="overview" className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  <Kpi icon={Trophy} label="Points" value={String(p?.points ?? 0)} />
                  <Kpi icon={CheckCircle2} label="Weeks approved" value={String(p?.weeks_approved ?? 0)} hint={`${p?.weeks_pending ?? 0} pending`} />
                  <Kpi icon={Award} label="Milestones" value={String(p?.milestones ?? 0)} />
                  <Kpi icon={Timer} label="Focus 7d" value={`${p?.focus_minutes_7d ?? 0}m`} hint={`${p?.focus_minutes_total ?? 0}m total`} />
                  <Kpi icon={Flame} label="Habit days /30" value={String(p?.habit_days_30 ?? 0)} />
                  <Kpi icon={Target} label="Actions today" value={String(p?.actions_done_today ?? 0)} />
                </div>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  <Kpi icon={IndianRupee} label="Current MRR" value={p?.mrr_inr != null ? `₹${Number(p.mrr_inr).toLocaleString("en-IN")}` : "—"} />
                  <Kpi icon={Users} label="Monthly leads" value={p?.monthly_leads != null ? String(p.monthly_leads) : "—"} />
                  <Kpi icon={Target} label="Business" value={p?.business_name ?? "—"} />
                </div>

                {/* Team roster (read-only, mirrors the participant's My Business) */}
                {isParticipant && (
                  <div>
                    <p className="mb-2 mt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Team {team.length > 0 && `· ${team.length}`}
                    </p>
                    {team.length === 0 ? (
                      <p className="rounded-xl border border-border bg-muted/30 px-3 py-4 text-center text-sm text-muted-foreground">No team members added.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {team.map((m) => (
                          <div key={m.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">{m.name}</p>
                              <p className="truncate text-xs text-muted-foreground">{[m.role, m.department].filter(Boolean).join(" · ") || "—"}</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              {m.monthly_salary_inr != null && <span className="text-xs tabular-nums text-muted-foreground">₹{Number(m.monthly_salary_inr).toLocaleString("en-IN")}/mo</span>}
                              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", m.status === "active" ? "bg-[oklch(0.93_0.06_160)] text-[oklch(0.35_0.12_160)]" : "bg-muted text-muted-foreground")}>{m.status}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>

              {/* ACTIVITY & LOGIN */}
              <TabsContent value="activity" className="mt-4 space-y-4">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="rounded-xl border border-border bg-card p-3">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Last sign-in</p>
                    <p className="mt-0.5 text-sm font-medium">{fmt(detail.auth.last_sign_in_at)}</p>
                    <p className="text-[11px] text-muted-foreground">{ago(detail.auth.last_sign_in_at)}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-3">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Member since</p>
                    <p className="mt-0.5 text-sm font-medium">{fmt(detail.auth.created_at)}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-3">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Email confirmed</p>
                    <p className="mt-0.5 text-sm font-medium">{detail.auth.email_confirmed_at ? "Yes" : "No"}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-3">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Phone</p>
                    <p className="mt-0.5 text-sm font-medium">{detail.profile?.phone || detail.auth.phone || "—"}</p>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent activity</p>
                  {detail.recent_activity.length === 0 ? (
                    <p className="rounded-xl border border-border bg-muted/30 px-3 py-6 text-center text-sm text-muted-foreground">No activity yet.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {detail.recent_activity.map((a, i) => (
                        <li key={i} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm">
                          <span className="flex items-center gap-2">
                            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full",
                              a.kind === "points" ? "bg-gold" : a.kind === "proof" ? "bg-[oklch(0.6_0.13_250)]" : a.kind === "milestone" ? "bg-[oklch(0.6_0.15_300)]" : "bg-[oklch(0.6_0.13_160)]")} />
                            <span className="text-foreground">{a.label}</span>
                          </span>
                          <span className="shrink-0 text-[11px] text-muted-foreground">{ago(a.ts)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </TabsContent>

              {/* MANAGE */}
              <TabsContent value="manage" className="mt-4 space-y-5">
                {/* Assign coach (participants only) */}
                {isParticipant && (
                  <div className="space-y-2 rounded-xl border border-border p-4">
                    <Label className="flex items-center gap-1.5 text-sm font-semibold"><UserCog className="h-4 w-4" /> Assigned coach</Label>
                    <p className="text-xs text-muted-foreground">
                      The coach who sees this member's data and reviews their proofs. Reassign anytime.
                    </p>
                    <div className="flex gap-2">
                      <Select value={coachSel} onValueChange={setCoachSel}>
                        <SelectTrigger className="h-10 flex-1 rounded-xl"><SelectValue placeholder="Select a coach" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                          {coaches.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.full_name || c.email}
                              <span className="ml-1 text-xs text-muted-foreground">· {c.participant_count}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        onClick={handleSetCoach}
                        disabled={busy === "coach" || coachSel === (detail.assigned_coach?.coach_id ?? UNASSIGNED)}
                        className="rounded-xl bg-gradient-navy text-primary-foreground hover:opacity-90"
                      >
                        {busy === "coach" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
                      </Button>
                    </div>
                    {detail.assigned_coach && (
                      <p className="text-xs text-muted-foreground">
                        Currently: <span className="font-medium text-foreground">{detail.assigned_coach.name || detail.assigned_coach.email}</span>
                      </p>
                    )}
                  </div>
                )}

                {/* Move batch */}
                <div className="space-y-2 rounded-xl border border-border p-4">
                  <Label className="flex items-center gap-1.5 text-sm font-semibold"><ArrowRightLeft className="h-4 w-4" /> Move to batch</Label>
                  <div className="flex gap-2">
                    <Input value={batchInput} onChange={(e) => setBatchInput(e.target.value)} placeholder="Batch 13" className="h-10 rounded-xl" list="admin-batch-list" />
                    <datalist id="admin-batch-list">
                      {batches.map((b) => <option key={b} value={b} />)}
                    </datalist>
                    <Button onClick={handleMoveBatch} disabled={busy === "batch" || !batchInput.trim()} className="rounded-xl bg-gradient-navy text-primary-foreground hover:opacity-90">
                      {busy === "batch" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
                    </Button>
                  </div>
                  {detail.batches.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {detail.batches.map((b) => (
                        <Badge key={b.batch_id} variant="outline" className="rounded-full text-[11px]">{b.name} · {b.role}</Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Reset password */}
                <div className="space-y-2 rounded-xl border border-border p-4">
                  <Label className="flex items-center gap-1.5 text-sm font-semibold"><KeyRound className="h-4 w-4" /> Reset password</Label>
                  <p className="text-xs text-muted-foreground">Sets a new temporary password and forces a reset on their next login.</p>
                  <Button variant="outline" onClick={handleReset} disabled={busy === "reset"} className="rounded-xl">
                    {busy === "reset" ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Generate temp password
                  </Button>
                  {tempPw && (
                    <div className="flex gap-2 pt-1">
                      <Input value={tempPw} readOnly className="h-10 rounded-xl font-mono" />
                      <Button variant="outline" className="rounded-xl" onClick={() => copy(tempPw, "Temp password")}><Copy className="h-4 w-4" /></Button>
                    </div>
                  )}
                </div>

                {/* Login as member */}
                <div className="space-y-2 rounded-xl border border-amber-400/40 bg-amber-50/40 p-4 dark:bg-amber-950/10">
                  <Label className="flex items-center gap-1.5 text-sm font-semibold"><LogIn className="h-4 w-4" /> Login as member</Label>
                  <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                    Opens a one-time link that signs you in AS this member. Use a private/incognito window so it doesn't replace your admin session.
                  </p>
                  <Button variant="outline" onClick={handleImpersonate} disabled={busy === "login"} className="rounded-xl border-amber-400/50">
                    {busy === "login" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />} Generate login link
                  </Button>
                  {loginLink && (
                    <div className="flex gap-2 pt-1">
                      <Input value={loginLink} readOnly className="h-10 rounded-xl font-mono text-xs" />
                      <Button variant="outline" className="rounded-xl" onClick={() => copy(loginLink, "Login link")}><Copy className="h-4 w-4" /></Button>
                      <Button className="rounded-xl bg-gradient-navy text-primary-foreground hover:opacity-90" onClick={() => window.open(loginLink, "_blank", "noopener")}>
                        <LogIn className="h-4 w-4" /> Open
                      </Button>
                    </div>
                  )}
                </div>

                {/* Danger zone: block sign-in / delete permanently */}
                <div className="space-y-3 rounded-xl border border-destructive/40 bg-destructive/[0.03] p-4">
                  <Label className="flex items-center gap-1.5 text-sm font-semibold text-destructive">
                    <ShieldAlert className="h-4 w-4" /> Danger zone
                  </Label>

                  {isSuperAdmin ? (
                    <p className="text-xs text-muted-foreground">
                      This account is a super admin and is protected from blocking and deletion.
                    </p>
                  ) : (
                    <>
                      {/* Block / unblock */}
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{isBlocked ? "Account blocked" : "Block sign-in"}</p>
                          <p className="text-xs text-muted-foreground">
                            {isBlocked
                              ? "This user can't sign in. Unblock to restore access."
                              : "Prevent this user from signing in — keeps all their data."}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          onClick={handleToggleBlock}
                          disabled={busy === "block"}
                          className={cn(
                            "rounded-xl",
                            isBlocked ? "border-emerald-500/50 text-emerald-600" : "border-amber-500/50 text-amber-600",
                          )}
                        >
                          {busy === "block" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : isBlocked ? (
                            <ShieldCheck className="h-4 w-4" />
                          ) : (
                            <Ban className="h-4 w-4" />
                          )}
                          {isBlocked ? "Unblock" : "Block"}
                        </Button>
                      </div>

                      {/* Delete permanently */}
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-card p-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">Delete permanently</p>
                          <p className="text-xs text-muted-foreground">
                            Removes the account and all their data. This can't be undone.
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => setConfirmDelete(true)}
                          disabled={busy === "delete"}
                          className="rounded-xl border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        >
                          {busy === "delete" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          Delete
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}

        <AlertDialog open={confirmDelete} onOpenChange={(o) => busy !== "delete" && setConfirmDelete(o)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently deletes <span className="font-medium text-foreground">{email}</span> and
                all of their data (progress, points, proofs, memberships, invites). This action cannot be
                undone. To only stop their access, use Block instead.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy === "delete"}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleDelete();
                }}
                disabled={busy === "delete"}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {busy === "delete" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                Delete permanently
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
