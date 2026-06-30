import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ShieldCheck, Mail, KeyRound, AlertTriangle, ArrowRight, Copy } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { getInviteByToken, acceptInvite } from "@/lib/vkm/invites.functions";
import { VKMLogo } from "@/components/vkm/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/invite/$token")({
  head: () => ({ meta: [{ title: "Accept invite · VKM" }] }),
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const getInvite = useServerFn(getInviteByToken);
  const accept = useServerFn(acceptInvite);
  const [invite, setInvite] = useState<Awaited<ReturnType<typeof getInvite>> | null | undefined>(undefined);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getInvite({ data: { token } }).then(setInvite).catch(() => setInvite(null));
  }, [token, getInvite]);

  async function handleAccept(e: React.FormEvent) {
    e.preventDefault();
    if (!invite?.isUsable) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: invite.email, password });
      if (error) throw error;
      await accept({ data: { token } });
      toast.success("Welcome to VKM", { description: "Please set a new password to continue." });
      navigate({ to: "/reset-password" });
    } catch (err) {
      toast.error("Could not accept invite", { description: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  if (invite === undefined) {
    return <Centered><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></Centered>;
  }

  if (!invite || invite.isRevoked || invite.isExpired || !invite.isUsable) {
    return (
      <Centered>
        <Shell>
          <div className="space-y-3 text-center">
            <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
            <h1 className="text-2xl font-semibold">Invite unavailable</h1>
            <p className="text-sm text-muted-foreground">
              {invite?.isRevoked ? "This invite has been revoked." :
                invite?.isExpired ? "This invite link has expired." :
                  invite?.status === "accepted" ? "This invite has already been used." :
                    "We couldn't find this invite. Ask your admin to send a new one."}
            </p>
            <Button onClick={() => navigate({ to: "/auth" })} className="mt-2 rounded-xl">Go to sign in</Button>
          </div>
        </Shell>
      </Centered>
    );
  }

  return (
    <Centered>
      <Shell>
        <div className="space-y-1.5 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-[oklch(0.55_0.16_160)]" />
          <h1 className="text-2xl font-semibold">Hi {invite.name.split(" ")[0]}, welcome 👋</h1>
          <p className="text-sm text-muted-foreground">
            You've been invited as <span className="font-medium text-foreground">{ROLE_LABEL[invite.role as keyof typeof ROLE_LABEL]}</span>.
            Enter the temporary password from your invite email to continue.
          </p>
        </div>
        <form onSubmit={handleAccept} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Email</Label>
            <Input value={invite.email} readOnly className="h-11 rounded-xl bg-muted" />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><KeyRound className="h-3.5 w-3.5" /> Temporary password</Label>
            <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="VKM-xxxx-xxxx-xxxx" className="h-11 rounded-xl font-mono" required autoFocus />
            <p className="text-xs text-muted-foreground">You'll be asked to set a new password right after.</p>
          </div>
          <Button type="submit" disabled={busy || !password} className="w-full h-11 rounded-xl bg-gradient-navy shadow-vkm">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Continue <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </form>
      </Shell>
    </Centered>
  );
}

const ROLE_LABEL = { participant: "User (Participant)", coach: "Coach", mentor: "Mentor", super_admin: "Admin" } as const;

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      {children}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
      className="w-full max-w-md space-y-6 rounded-3xl border border-border bg-card p-8 shadow-vkm-float"
    >
      <div className="flex justify-center"><VKMLogo /></div>
      {children}
    </motion.div>
  );
}

// Suppress unused-import lint if Copy ever gets dropped
void Copy;
