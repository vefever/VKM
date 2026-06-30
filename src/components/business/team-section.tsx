import { useMemo, useState } from "react";
import {
  Users, UserPlus, Pencil, Trash2, Loader2, Save, Building2, Banknote, UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { SectionCard } from "@/components/vkm/section-card";
import { KpiTile } from "@/components/vkm/kpi-tile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useTeamMembers, type TeamMember, type TeamMemberInput } from "@/components/business/business-data";

const inr = (n: number | null | undefined) => {
  if (n == null) return "—";
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(1)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`;
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(1)}K`;
  return `₹${n}`;
};

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

const EMPTY: TeamMemberInput = {
  name: "", role: "", department: "", email: "", phone: "",
  monthly_salary_inr: null, status: "active", joined_on: null, notes: "",
};

export function TeamSection({ reportedTeamSize }: { reportedTeamSize: number | null }) {
  const { members, loading, save, remove } = useTeamMembers();
  const [draft, setDraft] = useState<{ id: string | null; data: TeamMemberInput } | null>(null);
  const [saving, setSaving] = useState(false);

  const stats = useMemo(() => {
    const active = members.filter((m) => m.status === "active").length;
    const payroll = members.reduce((n, m) => n + (m.monthly_salary_inr ?? 0), 0);
    const depts = new Set(members.map((m) => m.department?.trim()).filter(Boolean)).size;
    return { headcount: members.length, active, payroll, depts };
  }, [members]);

  function openNew() { setDraft({ id: null, data: { ...EMPTY } }); }
  function openEdit(m: TeamMember) {
    setDraft({
      id: m.id,
      data: {
        name: m.name, role: m.role, department: m.department, email: m.email, phone: m.phone,
        monthly_salary_inr: m.monthly_salary_inr, status: m.status, joined_on: m.joined_on, notes: m.notes,
      },
    });
  }

  async function saveDraft() {
    if (!draft) return;
    if (!draft.data.name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    const clean: TeamMemberInput = {
      ...draft.data,
      name: draft.data.name.trim(),
      role: draft.data.role?.trim() || null,
      department: draft.data.department?.trim() || null,
      email: draft.data.email?.trim() || null,
      phone: draft.data.phone?.trim() || null,
      notes: draft.data.notes?.trim() || null,
    };
    const { error } = await save(draft.id, clean);
    setSaving(false);
    if (error) { toast.error("Could not save", { description: error }); return; }
    toast.success(draft.id ? "Team member updated" : "Team member added");
    setDraft(null);
  }

  async function del(m: TeamMember) {
    if (!confirm(`Remove ${m.name} from your team?`)) return;
    await remove(m.id);
    toast.success("Removed");
  }

  const set = (patch: Partial<TeamMemberInput>) =>
    setDraft((d) => (d ? { ...d, data: { ...d.data, ...patch } } : d));

  return (
    <section id="team" className="scroll-mt-32">
      <SectionCard
        title="Team"
        subtitle="Your people — size, roles and payroll at a glance"
        action={
          <Button size="sm" className="rounded-full bg-gradient-navy text-primary-foreground shadow-vkm hover:opacity-90" onClick={openNew}>
            <UserPlus className="h-3.5 w-3.5" /> Add member
          </Button>
        }
      >
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <KpiTile spotlight={false} label="Headcount" value={String(stats.headcount)} icon={Users} accent="navy"
            hint={reportedTeamSize != null && reportedTeamSize !== stats.headcount ? `Reported size: ${reportedTeamSize}` : undefined} />
          <KpiTile spotlight={false} label="Active" value={String(stats.active)} icon={UserCheck} accent="success" />
          <KpiTile spotlight={false} label="Departments" value={String(stats.depts)} icon={Building2} accent="navy" />
          <KpiTile spotlight={false} label="Monthly payroll" value={inr(stats.payroll || null)} icon={Banknote} accent="gold" />
        </div>

        {/* Roster */}
        <div className="mt-4">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : members.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-10 text-center">
              <Users className="h-7 w-7 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No team members yet. Add your first hire to track roles and payroll.</p>
              <Button size="sm" variant="outline" className="rounded-xl" onClick={openNew}><UserPlus className="h-4 w-4" /> Add member</Button>
            </div>
          ) : (
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.id} className="group flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-navy text-[11px] font-bold text-primary-foreground">{initials(m.name)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">{m.name}</p>
                      <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                        m.status === "active" ? "bg-[oklch(0.93_0.06_160)] text-[oklch(0.35_0.12_160)]" : "bg-muted text-muted-foreground")}>
                        {m.status}
                      </span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {[m.role, m.department].filter(Boolean).join(" · ") || "—"}
                      {m.monthly_salary_inr != null && <span className="ml-1">· {inr(m.monthly_salary_inr)}/mo</span>}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" onClick={() => openEdit(m)} title="Edit"><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg text-destructive" onClick={() => del(m)} title="Remove"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionCard>

      {/* Add / edit dialog */}
      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="sm:max-w-[540px] max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit team member" : "Add team member"}</DialogTitle>
            <DialogDescription>Their role, department and pay help you and your coach plan growth.</DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Full name</Label>
                  <Input value={draft.data.name} onChange={(e) => set({ name: e.target.value })} placeholder="Riya Sharma" className="h-10 rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={draft.data.status} onValueChange={(v) => set({ status: v as TeamMember["status"] })}>
                    <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Role</Label>
                  <Input value={draft.data.role ?? ""} onChange={(e) => set({ role: e.target.value })} placeholder="Sales Lead" className="h-10 rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label>Department</Label>
                  <Input value={draft.data.department ?? ""} onChange={(e) => set({ department: e.target.value })} placeholder="Sales" className="h-10 rounded-xl" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Monthly salary (₹)</Label>
                  <Input type="number" inputMode="numeric" value={draft.data.monthly_salary_inr ?? ""} onChange={(e) => set({ monthly_salary_inr: e.target.value ? Number(e.target.value) : null })} placeholder="35000" className="h-10 rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label>Joined on</Label>
                  <Input type="date" value={draft.data.joined_on ?? ""} onChange={(e) => set({ joined_on: e.target.value || null })} className="h-10 rounded-xl" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={draft.data.email ?? ""} onChange={(e) => set({ email: e.target.value })} placeholder="riya@company.com" className="h-10 rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input value={draft.data.phone ?? ""} onChange={(e) => set({ phone: e.target.value })} placeholder="+91-90000 00000" className="h-10 rounded-xl" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Input value={draft.data.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} placeholder="KPIs, responsibilities…" className="h-10 rounded-xl" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setDraft(null)}>Cancel</Button>
            <Button onClick={saveDraft} disabled={saving} className="rounded-xl bg-gradient-navy text-primary-foreground hover:opacity-90">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
