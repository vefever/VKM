import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { KeyRound, Loader2, Mail, QrCode, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { VKMLogo } from "@/components/vkm/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  computeMfaGateMode,
  useMyMfaFactors,
  verifyTotpFactor,
  requestEmailMfaCode,
  verifyEmailMfaCode,
  markEmailMfaVerified,
  type MfaGateMode,
} from "@/components/admin/security-data";
import { TotpEnrollForm } from "@/components/admin/totp-enroll-form";

export const Route = createFileRoute("/_authenticated/verify-2fa")({
  head: () => ({ meta: [{ title: "Verify it's you · VKM" }] }),
  component: Verify2faPage,
});

function Verify2faPage() {
  const navigate = useNavigate();
  const { user, roles } = useAuth();
  const [mode, setMode] = useState<MfaGateMode | "loading">("loading");

  useEffect(() => {
    let alive = true;
    if (!user) return;
    void computeMfaGateMode(user.id, roles).then((m) => {
      if (!alive) return;
      if (m === "none") {
        navigate({ to: "/app", replace: true });
      } else {
        setMode(m);
      }
    });
    return () => {
      alive = false;
    };
  }, [user, roles, navigate]);

  function done() {
    navigate({ to: "/app", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md space-y-6 rounded-3xl border border-border bg-card p-8 shadow-vkm-float"
      >
        <div className="flex justify-center">
          <VKMLogo />
        </div>
        <div className="space-y-1.5 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-[oklch(0.55_0.16_160)]" />
          <h1 className="text-2xl font-semibold">Verify it's you</h1>
          <p className="text-sm text-muted-foreground">
            {user?.email
              ? <>An extra security step is required for <span className="font-medium text-foreground">{user.email}</span>.</>
              : "An extra security step is required to continue."}
          </p>
        </div>

        {mode === "loading" && (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {mode === "totp-challenge" && <TotpChallenge onSuccess={done} />}
        {mode === "totp-enroll" && <TotpEnrollForm onSuccess={done} />}
        {mode === "choose" && <ChooseMethod onPickTotp={() => setMode("totp-enroll")} onPickEmail={() => setMode("email-otp")} />}
        {mode === "email-otp" && <EmailOtpStep userId={user!.id} onSuccess={done} />}
      </motion.div>
    </div>
  );
}

function TotpChallenge({ onSuccess }: { onSuccess: () => void }) {
  const { verifiedFactor, loading } = useMyMfaFactors();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!verifiedFactor || code.length !== 6) return;
    setBusy(true);
    try {
      await verifyTotpFactor(verifiedFactor.id, code);
      onSuccess();
    } catch (err) {
      toast.error("That code didn't match", { description: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5">
          <QrCode className="h-3.5 w-3.5" /> Code from your authenticator app
        </Label>
        <Input
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
      <Button type="submit" disabled={busy || code.length !== 6} className="h-11 w-full rounded-xl bg-gradient-navy shadow-vkm">
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Verify & continue
      </Button>
    </form>
  );
}

function ChooseMethod({ onPickTotp, onPickEmail }: { onPickTotp: () => void; onPickEmail: () => void }) {
  return (
    <div className="space-y-2.5">
      <button
        type="button"
        onClick={onPickTotp}
        className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-secondary/60"
      >
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-navy text-primary-foreground">
          <QrCode className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-semibold text-foreground">Set up authenticator app</p>
          <p className="text-xs text-muted-foreground">Recommended — scan a QR code once, use it every time.</p>
        </div>
      </button>
      <button
        type="button"
        onClick={onPickEmail}
        className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-secondary/60"
      >
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground">
          <Mail className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-semibold text-foreground">Email me a code instead</p>
          <p className="text-xs text-muted-foreground">A one-time code sent to your inbox.</p>
        </div>
      </button>
    </div>
  );
}

function EmailOtpStep({ userId, onSuccess }: { userId: string; onSuccess: () => void }) {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void send();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send() {
    setSending(true);
    try {
      await requestEmailMfaCode();
      setSent(true);
    } catch (err) {
      toast.error("Couldn't send the code", { description: (err as Error).message });
    } finally {
      setSending(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) return;
    setBusy(true);
    try {
      const ok = await verifyEmailMfaCode(code);
      if (!ok) {
        toast.error("That code is wrong or expired");
        return;
      }
      markEmailMfaVerified(userId);
      onSuccess();
    } catch (err) {
      toast.error("Couldn't verify the code", { description: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Mail className="h-4 w-4 text-gold" /> {sending ? "Sending a code to your email…" : "Check your email for a 6-digit code."}
      </p>
      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5">
          <KeyRound className="h-3.5 w-3.5" /> 6-digit code
        </Label>
        <Input
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          maxLength={6}
          placeholder="••••••"
          disabled={sending}
          className="h-11 rounded-xl text-center text-lg tracking-[0.5em]"
          autoFocus
        />
      </div>
      <Button type="submit" disabled={busy || sending || code.length !== 6} className="h-11 w-full rounded-xl bg-gradient-navy shadow-vkm">
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Verify & continue
      </Button>
      <button
        type="button"
        onClick={send}
        disabled={sending}
        className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
      >
        {sent ? "Resend code" : "Send code"}
      </button>
    </form>
  );
}
