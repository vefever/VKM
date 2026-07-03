import { useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldOff, Check, KeyRound, QrCode, Mail } from "lucide-react";
import { SectionCard } from "@/components/vkm/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  useMyMfaFactors,
  useMyMfaPrefs,
  verifyTotpFactor,
  unenrollTotp,
} from "@/components/admin/security-data";
import { TotpEnrollForm } from "@/components/admin/totp-enroll-form";

// Personal two-factor authentication — reused on both the Super Admin
// Security page and the Coach/Mentor profile settings page. Two
// independent parts:
//   1. "Require this on my account" opt-in toggles — a personal choice,
//      separate from whatever the platform-wide Security page toggles are
//      set to (either can trigger the login-time 2FA gate for this user).
//   2. Authenticator app enrollment/removal — Supabase's MFA API always
//      operates on the currently signed-in user, so there's no "admin
//      enrolls for someone else" capability; everyone manages their own.
export function MyTwoFactorSection({ userId }: { userId: string }) {
  const { loading: factorsLoading, reload: reloadFactors, verifiedFactor } = useMyMfaFactors();
  const { prefs, loading: prefsLoading, save: savePrefs } = useMyMfaPrefs(userId);
  const [enrolling, setEnrolling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeCode, setRemoveCode] = useState("");

  async function togglePref(field: "mfa_totp_opt_in" | "mfa_email_otp_opt_in", value: boolean) {
    try {
      await savePrefs({ [field]: value });
      toast.success(value ? "Enabled for your account" : "Turned off for your account");
    } catch (e) {
      toast.error("Couldn't update", { description: (e as Error).message });
    }
  }

  async function confirmRemove(e: React.FormEvent) {
    e.preventDefault();
    if (!verifiedFactor || removeCode.length !== 6) return;
    setBusy(true);
    try {
      // Removing a verified factor requires proving you still control it —
      // re-verify a fresh code, which also elevates the session to aal2,
      // which Supabase's unenroll() requires for a verified factor.
      await verifyTotpFactor(verifiedFactor.id, removeCode);
      await unenrollTotp(verifiedFactor.id);
      toast.success("Authenticator app removed");
      setRemoving(false);
      setRemoveCode("");
      await reloadFactors();
    } catch (e) {
      toast.error("Couldn't remove it", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const loading = factorsLoading || prefsLoading;

  return (
    <SectionCard title="Two-factor authentication" subtitle="Your personal login security — independent of platform-wide settings">
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-3">
            <PrefRow
              icon={QrCode}
              title="Require authenticator app when I sign in"
              description="Prompts for a code from your authenticator app after your password."
              checked={prefs.mfa_totp_opt_in}
              onChange={(v) => togglePref("mfa_totp_opt_in", v)}
            />
            <PrefRow
              icon={Mail}
              title="Require an email code when I sign in"
              description="Emails you a 6-digit code as an extra step after your password."
              checked={prefs.mfa_email_otp_opt_in}
              onChange={(v) => togglePref("mfa_email_otp_opt_in", v)}
            />
          </div>

          <div className="border-t border-border pt-4">
            {enrolling ? (
              <TotpEnrollForm
                onSuccess={() => {
                  setEnrolling(false);
                  void reloadFactors();
                }}
                onCancel={() => setEnrolling(false)}
              />
            ) : verifiedFactor ? (
              removing ? (
                <form onSubmit={confirmRemove} className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Enter a current code from your authenticator app to confirm removal.
                  </p>
                  <Input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={removeCode}
                    onChange={(e) => setRemoveCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    maxLength={6}
                    placeholder="••••••"
                    className="h-11 rounded-xl text-center text-lg tracking-[0.5em]"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" className="rounded-xl" onClick={() => setRemoving(false)} disabled={busy}>
                      Cancel
                    </Button>
                    <Button type="submit" variant="destructive" className="flex-1 rounded-xl" disabled={busy || removeCode.length !== 6}>
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />} Confirm removal
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-secondary/20 p-4">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[oklch(0.93_0.06_160)] text-[oklch(0.35_0.12_160)]">
                      <Check className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Authenticator app connected</p>
                      <p className="text-xs text-muted-foreground">You'll be asked for a code when required at login.</p>
                    </div>
                  </div>
                  <Button variant="outline" className="rounded-xl" onClick={() => setRemoving(true)}>
                    Remove
                  </Button>
                </div>
              )
            ) : (
              <div className="flex items-center justify-between gap-4 rounded-xl border border-dashed border-border p-4">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                    <KeyRound className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">No authenticator app connected</p>
                    <p className="text-xs text-muted-foreground">Set one up so you're ready if it becomes required.</p>
                  </div>
                </div>
                <Button className="rounded-xl bg-gradient-navy shadow-vkm" onClick={() => setEnrolling(true)}>
                  <QrCode className="h-4 w-4" /> Set up
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </SectionCard>
  );
}

function PrefRow({
  icon: Icon,
  title,
  description,
  checked,
  onChange,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-secondary/20 p-3.5">
      <div className="flex items-start gap-2.5">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} className="mt-0.5 shrink-0" />
    </div>
  );
}
