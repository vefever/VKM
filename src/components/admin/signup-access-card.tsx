import { useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldCheck, ShieldAlert, UserPlus } from "lucide-react";
import { SectionCard } from "@/components/vkm/section-card";
import { Switch } from "@/components/ui/switch";
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
import { useMessagingSetting } from "@/components/admin/messaging-data";

/**
 * Admin control for public self sign-ups. OFF by default (invite-only). Turning
 * it ON opens /auth's "Create account" tab and lets anyone register — so we
 * require an explicit confirmation before enabling. Enforcement is server-side
 * (messaging `public_signup` checks this same flag), so this toggle is the real
 * gate, not just a UI hint.
 */
export function SignupAccessCard() {
  const { setting, loading, save } = useMessagingSetting("general");
  const enabled = setting.config?.signups_enabled === true;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function apply(next: boolean) {
    setBusy(true);
    try {
      await save({ config: { ...setting.config, signups_enabled: next } });
      toast.success(next ? "Public sign-ups enabled" : "Public sign-ups disabled", {
        description: next
          ? "Anyone can now create an account from the sign-in page."
          : "Back to invite-only — only invited people can join.",
      });
    } catch (e) {
      toast.error("Couldn't update", { description: (e as Error).message });
    } finally {
      setBusy(false);
      setConfirmOpen(false);
    }
  }

  function onToggle(next: boolean) {
    // Enabling opens the platform → always confirm. Disabling is safe → apply.
    if (next) setConfirmOpen(true);
    else void apply(false);
  }

  return (
    <>
      <SectionCard
        title={<span className="text-sm font-semibold">Public sign-ups</span>}
        subtitle="Invite-only by default — turn on only to let anyone self-register"
      >
        <div className="flex items-center gap-3">
          <span
            className={
              "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl " +
              (enabled ? "bg-amber-500/15 text-amber-600" : "bg-[oklch(0.93_0.06_160)] text-[oklch(0.4_0.12_160)]")
            }
          >
            {enabled ? <ShieldAlert className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">
              {loading ? "…" : enabled ? "Open — anyone can create an account" : "Closed — invite-only"}
            </p>
            <p className="text-xs text-muted-foreground">
              {enabled
                ? "The “Create account” tab is visible on the sign-in page."
                : "New accounts can only be created via an admin invite."}
            </p>
          </div>
          {busy || loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <Switch checked={enabled} onCheckedChange={onToggle} aria-label="Toggle public sign-ups" />
          )}
        </div>
      </SectionCard>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-amber-600" /> Open public sign-ups?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This is an invite-only platform. Enabling public sign-ups lets{" "}
              <span className="font-medium text-foreground">anyone with the link</span> create an
              account and log in as a participant — without an invite. Only do this if you
              intentionally want an open registration period. You can turn it off again at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep invite-only</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void apply(true);
              }}
              className="bg-amber-600 text-white hover:bg-amber-600/90"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Yes, allow sign-ups"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
