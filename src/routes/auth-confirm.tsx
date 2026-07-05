import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

// Public landing for one-time login links (staff "log in as participant",
// admin impersonation). The link points at OUR domain instead of the raw
// Supabase verify URL; here we exchange its token_hash for a session and then
// hand off to the target page. Open in a private window so it doesn't replace
// your own session.
export const Route = createFileRoute("/auth-confirm")({
  ssr: false,
  component: AuthConfirm,
});

function AuthConfirm() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get("token_hash");
    const type = (params.get("type") || "magiclink") as "magiclink" | "email" | "recovery" | "invite";
    const next = params.get("next") || "/app";
    if (!tokenHash) {
      setError("This login link is missing its token. Ask for a fresh one.");
      return;
    }
    let cancelled = false;
    void (async () => {
      const { error: vErr } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
      if (cancelled) return;
      if (vErr) {
        setError(vErr.message || "This login link has expired or was already used.");
        return;
      }
      // Full navigation so the authenticated layout re-reads the fresh session
      // (and the ?impersonated=1 flag) from scratch.
      window.location.replace(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      {error ? (
        <>
          <span className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-destructive/10 text-destructive">
            <ShieldX className="h-7 w-7" />
          </span>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">Couldn't sign you in</h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">{error}</p>
          <Button asChild className="mt-6 rounded-full bg-gradient-navy shadow-vkm">
            <Link to="/auth">Go to sign in</Link>
          </Button>
        </>
      ) : (
        <>
          <span className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-navy text-primary-foreground">
            <Loader2 className="h-7 w-7 animate-spin" />
          </span>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">Signing you in…</h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">One moment while we verify your one-time link.</p>
        </>
      )}
    </div>
  );
}
