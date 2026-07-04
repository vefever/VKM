import { useEffect, useState } from "react";
import { UserCog, Sparkles, Globe, Lock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalFooter,
} from "@/components/ui/responsive-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useMyMemberProfile, type MemberStatus } from "@/components/community/community-data";

export function EditMemberProfileDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { profile, save, prefillFromBrain } = useMyMemberProfile();
  const [f, setF] = useState({
    headline: "",
    bio: "",
    business_name: "",
    industry: "",
    location: "",
    skills: "",
    batch_label: "",
    status: "active" as MemberStatus,
    is_public: true,
    allow_messages: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setF({
      headline: profile?.headline ?? "",
      bio: profile?.bio ?? "",
      business_name: profile?.business_name ?? "",
      industry: profile?.industry ?? "",
      location: profile?.location ?? "",
      skills: (profile?.skills ?? []).join(", "),
      batch_label: profile?.batch_label ?? "",
      status: profile?.status ?? "active",
      is_public: profile?.is_public ?? true,
      allow_messages: profile?.allow_messages ?? true,
    });
  }, [open, profile]);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  async function prefill() {
    const b = await prefillFromBrain();
    if (!b) {
      toast.info("No business details found to prefill.");
      return;
    }
    setF((p) => ({
      ...p,
      business_name: p.business_name || b.business_name || "",
      industry: p.industry || b.industry || "",
      location: p.location || b.location || "",
    }));
    toast.success("Prefilled from your business — review, then save.");
  }

  async function onSave() {
    setSaving(true);
    try {
      await save({
        headline: f.headline.trim() || null,
        bio: f.bio.trim() || null,
        business_name: f.business_name.trim() || null,
        industry: f.industry.trim() || null,
        location: f.location.trim() || null,
        skills: f.skills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        batch_label: f.batch_label.trim() || null,
        status: f.status,
        is_public: f.is_public,
        allow_messages: f.allow_messages,
      });
      toast.success("Network profile saved");
      onOpenChange(false);
    } catch (e) {
      toast.error("Could not save", { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent className="max-h-[88vh] max-w-lg overflow-y-auto">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle className="flex items-center gap-2 text-base">
            <UserCog className="h-4 w-4 text-navy" /> Your network profile
          </ResponsiveModalTitle>
        </ResponsiveModalHeader>

        <div className="space-y-3">
          <Field label="Headline">
            <Input
              value={f.headline}
              onChange={(e) => set("headline", e.target.value)}
              placeholder="e.g. Founder · scaling a 2-store retail brand"
              className="rounded-lg"
            />
          </Field>
          <Field label="About you">
            <Textarea
              value={f.bio}
              onChange={(e) => set("bio", e.target.value)}
              placeholder="What you do, what you're building, what you can help others with…"
              className="min-h-[72px] rounded-lg"
            />
          </Field>

          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Business
            </p>
            <Button
              size="sm"
              variant="outline"
              className="h-7 rounded-lg text-xs"
              onClick={prefill}
            >
              <Sparkles className="h-3.5 w-3.5" /> Prefill from my business
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Field label="Business">
              <Input
                value={f.business_name}
                onChange={(e) => set("business_name", e.target.value)}
                className="rounded-lg"
              />
            </Field>
            <Field label="Industry">
              <Input
                value={f.industry}
                onChange={(e) => set("industry", e.target.value)}
                className="rounded-lg"
              />
            </Field>
            <Field label="Location">
              <Input
                value={f.location}
                onChange={(e) => set("location", e.target.value)}
                className="rounded-lg"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Batch / cohort">
              <Input
                value={f.batch_label}
                onChange={(e) => set("batch_label", e.target.value)}
                placeholder="Batch 16"
                className="rounded-lg"
              />
            </Field>
            <Field label="Status">
              <div className="flex gap-1.5">
                {(["active", "alumni"] as MemberStatus[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => set("status", s)}
                    className={cn(
                      "flex-1 rounded-lg px-2 py-2 text-xs font-medium capitalize transition-colors",
                      f.status === s
                        ? "bg-gradient-navy text-primary-foreground"
                        : "bg-secondary text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          <Field label="Skills / expertise (comma separated)">
            <Input
              value={f.skills}
              onChange={(e) => set("skills", e.target.value)}
              placeholder="Retail, Hiring, Paid ads, Operations"
              className="rounded-lg"
            />
          </Field>

          {/* Privacy — member-controlled */}
          <div className="space-y-2 rounded-xl border border-border bg-secondary/30 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Privacy — you're in control
            </p>
            <Toggle
              icon={Globe}
              label="List me in the member directory"
              hint="Others can find and view your profile"
              on={f.is_public}
              onClick={() => set("is_public", !f.is_public)}
            />
            <Toggle
              icon={Lock}
              label="Allow direct messages"
              hint="Members can start a 1:1 chat with you"
              on={f.allow_messages}
              onClick={() => set("allow_messages", !f.allow_messages)}
            />
          </div>
        </div>

        <ResponsiveModalFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-gradient-navy text-primary-foreground hover:opacity-90"
            disabled={saving}
            onClick={onSave}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save profile
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function Toggle({
  icon: Icon,
  label,
  hint,
  on,
  onClick,
}: {
  icon: typeof Globe;
  label: string;
  hint: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg bg-card p-2.5 text-left"
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        <span className="block text-[11px] text-muted-foreground">{hint}</span>
      </span>
      <span
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors",
          on ? "bg-[#10b981]" : "bg-muted",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all",
            on ? "left-[18px]" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}
