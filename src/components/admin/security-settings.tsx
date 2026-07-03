import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ShieldCheck, KeyRound, Mail, Loader2, QrCode, ShieldOff, Check } from "lucide-react";
import { PageHeader } from "@/components/vkm/page-header";
import { SectionCard } from "@/components/vkm/section-card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/use-auth";
import {
  useSecuritySettings,
  useMyMfaFactors,
  verifyTotpFactor,
  unenrollTotp,
  type SecuritySettings,
} from "@/components/admin/security-data";
import { TotpEnrollForm } from "@/components/admin/totp-enroll-form";

export function SecuritySettingsPage() {
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole("super_admin");
  const { settings, loading, saving, save } = useSecuritySettings();
  const [confirmField, setConfirmField] = useState<keyof SecuritySettings | null>(null);

  async function toggle(field: keyof SecuritySettings, next: boolean) {
    if (next) {
      // Turning a 2FA requirement ON affects every coach/mentor/super admin's
      // next login — confirm before flipping a platform-wide security control.
      setConfirmField(field);
      return;
    }
    try {
      await save({ [field]: false });
      toast.success("Updated");
    } catch (e) {
      toast.error("Couldn't update", { description: (e as Error).message });
    }
  }

  async function confirmToggleOn() {
    if (!confirmField) return;
    try {
      await save({ [confirmField]: true });
      toast.success("Enabled");
    } catch (e) {
      toast.error("Couldn't update", { description: (e as Error).message });
    } finally {
      setConfirmField(null);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      <PageHeader
        eyebrow="Super Admin · VK"
        title="Security"
        description="Two-factor authentication for staff logins — authenticator app and email code."
        icon={ShieldCheck}
      />

      <SectionCard
        title="Platform-wide two-factor authentication"
        subtitle="Applies to every coach, mentor, and super admin. Participants are never affected."
      >
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <ToggleRow
              icon={QrCode}
              title="Authenticator app (TOTP)"
              description="Staff scan a QR code with Google Authenticator, Microsoft Authenticator, or any TOTP app. When enabled, anyone without a scanned code is required to set one up at their next login."
              checked={settings.totp_enabled}
              disabled={!isSuperAdmin || saving}
              onChange={(v) => toggle("totp_enabled", v)}
            />
            <ToggleRow
              icon={Mail}
              title="Email code"
              description="A 6-digit code emailed to the staff member as their second factor. Offered as a fallback when authenticator app is also on and they haven't set one up yet; the only option if it's the sole method enabled."
              checked={settings.email_otp_2fa_enabled}
              disabled={!isSuperAdmin || saving}
              onChange={(v) => toggle("email_otp_2fa_enabled", v)}
            />
            {!isSuperAdmin && (
              <p className="text-xs text-muted-foreground">Only super admins can change these settings.</p>
            )}
          </div>
        )}
      </SectionCard>

      <MyTwoFactorCard />

      <AlertDialog open={confirmField !== null} onOpenChange={(open) => !open && setConfirmField(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Require this for all staff?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmField === "totp_enabled"
                ? "Every coach, mentor, and super admin without an authenticator app set up will be required to scan a QR code before they can reach their dashboard at their next login."
                : "Every coach, mentor, and super admin will be sent (or offered) an email code as part of signing in, depending on what's already enabled."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmToggleOn}>Enable it</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}

function ToggleRow({
  icon: Icon,
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-secondary/20 p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-navy text-primary-foreground">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} className="mt-1 shrink-0" />
    </div>
  );
}

// Any staff member enrolls/manages their OWN authenticator factor here —
// Supabase's MFA API always operates on the currently signed-in user, so
// there's no "admin enrolls for someone else" capability by design.
function MyTwoFactorCard() {
  const { loading, reload, verifiedFactor } = useMyMfaFactors();
  const [enrolling, setEnrolling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeCode, setRemoveCode] = useState("");

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
      await reload();
    } catch (e) {
      toast.error("Couldn't remove it", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard title="Your two-factor authentication" subtitle="Manage your own authenticator app">
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : enrolling ? (
        <TotpEnrollForm
          onSuccess={() => {
            setEnrolling(false);
            void reload();
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
    </SectionCard>
  );
}
