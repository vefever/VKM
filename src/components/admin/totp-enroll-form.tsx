import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { enrollTotp, cancelTotpEnrollment, verifyTotpFactor } from "@/components/admin/security-data";

// Shared QR-scan + verify enrollment flow — used both from the Security
// settings page (self-service, cancelable) and the forced login-time gate
// (no cancel option when it's the only method available).
export function TotpEnrollForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel?: () => void }) {
  const [enrolling, setEnrolling] = useState<{ factorId: string; qrCode: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    try {
      const data = await enrollTotp();
      setEnrolling({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
    } catch (e) {
      toast.error("Couldn't start enrollment", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (!enrolling || code.length !== 6) return;
    setBusy(true);
    try {
      await verifyTotpFactor(enrolling.factorId, code);
      toast.success("Authenticator app connected");
      onSuccess();
    } catch (e) {
      toast.error("That code didn't match", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (enrolling) {
      try {
        await cancelTotpEnrollment(enrolling.factorId);
      } catch {
        /* best-effort cleanup */
      }
    }
    setEnrolling(null);
    setCode("");
    onCancel?.();
  }

  if (!enrolling) {
    return (
      <div className="space-y-3 text-center">
        <p className="text-sm text-muted-foreground">
          Set up an authenticator app (Google Authenticator, Microsoft Authenticator, or any TOTP app).
        </p>
        <div className="flex justify-center gap-2">
          {onCancel && (
            <Button type="button" variant="outline" className="rounded-xl" onClick={onCancel} disabled={busy}>
              Cancel
            </Button>
          )}
          <Button type="button" className="rounded-xl bg-gradient-navy shadow-vkm" onClick={start} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Set up authenticator app
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={confirm} className="space-y-4">
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-secondary/20 p-4 text-center">
        <p className="text-sm text-foreground">Scan this QR code with your authenticator app.</p>
        <img src={enrolling.qrCode} alt="Authenticator QR code" className="h-40 w-40 rounded-lg border border-border bg-white p-2" />
        <p className="text-[11px] text-muted-foreground">Can't scan? Enter this key manually:</p>
        <code className="rounded-lg bg-secondary px-2.5 py-1 text-xs tracking-wider">{enrolling.secret}</code>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="totp-verify-code">Enter the 6-digit code from your app</Label>
        <Input
          id="totp-verify-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          maxLength={6}
          placeholder="••••••"
          className="h-11 rounded-xl text-center text-lg tracking-[0.5em]"
          autoFocus
        />
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="rounded-xl" onClick={cancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1 rounded-xl bg-gradient-navy shadow-vkm" disabled={busy || code.length !== 6}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Verify & connect
        </Button>
      </div>
    </form>
  );
}
