import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { clearMustResetFlag } from "@/lib/vkm/invites.functions";
import { VKMLogo } from "@/components/vkm/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/reset-password")({
  head: () => ({ meta: [{ title: "Set new password · VKM" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const clearFlag = useServerFn(clearMustResetFlag);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return toast.error("Password must be at least 8 characters");
    if (pw !== pw2) return toast.error("Passwords don't match");
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      await clearFlag({});
      toast.success("Password updated", { description: "You're all set." });
      navigate({ to: "/app" });
    } catch (err) {
      toast.error("Could not update password", { description: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
        className="w-full max-w-md space-y-6 rounded-3xl border border-border bg-card p-8 shadow-vkm-float"
      >
        <div className="flex justify-center"><VKMLogo /></div>
        <div className="space-y-1.5 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-[oklch(0.55_0.16_160)]" />
          <h1 className="text-2xl font-semibold">Set your password</h1>
          <p className="text-sm text-muted-foreground">
            {user?.email ? <>For your security, replace the temporary password on <span className="font-medium text-foreground">{user.email}</span>.</>
              : "For your security, replace the temporary password before continuing."}
          </p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><KeyRound className="h-3.5 w-3.5" /> New password</Label>
            <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} minLength={8} required className="h-11 rounded-xl" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Confirm password</Label>
            <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} minLength={8} required className="h-11 rounded-xl" />
          </div>
          <Button type="submit" disabled={busy} className="w-full h-11 rounded-xl bg-gradient-navy shadow-vkm">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save and continue
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
