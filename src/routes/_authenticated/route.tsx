import { createFileRoute, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { computeMfaGateMode } from "@/components/admin/security-data";
import { coachPing } from "@/components/coach/coach-performance-data";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, roles, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [checkedReset, setCheckedReset] = useState(false);
  const [checkedMfa, setCheckedMfa] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [loading, user, navigate]);

  // Staff login heartbeat — records that this coach/mentor/admin was active today
  // (server no-ops for non-staff). Builds the real daily-login history behind the
  // Coach Performance login streaks + consistency score. Once per session.
  useEffect(() => {
    if (!user) return;
    const isStaff = roles.some((r) => r === "coach" || r === "mentor" || r === "super_admin");
    if (isStaff) coachPing();
  }, [user, roles]);

  // A staff "log in as participant" support session arrives at /app?impersonated=1.
  // Remember it (for this tab) so the forced-reset gate below is skipped — support
  // staff need the participant's real app, not their onboarding screen. This never
  // touches the participant's own must_reset_password flag.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("impersonated") === "1") {
      try {
        sessionStorage.setItem("vkm.impersonated", "1");
      } catch {
        /* private mode — flag just won't persist */
      }
    }
  }, []);

  // Force password reset on first login (when invited) — unless this is a staff
  // impersonation session.
  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setCheckedReset(false);
      return;
    }
    if (location.pathname === "/reset-password") {
      setCheckedReset(true);
      return;
    }
    const impersonating =
      typeof window !== "undefined" && sessionStorage.getItem("vkm.impersonated") === "1";
    if (impersonating) {
      setCheckedReset(true);
      return;
    }
    supabase
      .from("profiles")
      .select("must_reset_password")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (data?.must_reset_password) {
          navigate({ to: "/reset-password", replace: true });
        } else {
          setCheckedReset(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user, location.pathname, navigate]);

  // Second-factor gate — runs only after the password-reset gate above has
  // resolved (so a forced password reset always completes before a 2FA
  // prompt), and only for staff roles (computeMfaGateMode returns "none"
  // immediately for participants). Re-evaluated on every navigation, same as
  // the reset-password check above, so a setting toggled mid-session by
  // another super admin takes effect on this admin's very next navigation.
  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setCheckedMfa(false);
      return;
    }
    if (!checkedReset) return;
    if (location.pathname === "/reset-password" || location.pathname === "/verify-2fa") {
      setCheckedMfa(true);
      return;
    }
    void computeMfaGateMode(user.id, roles).then((mode) => {
      if (cancelled) return;
      if (mode === "none") {
        setCheckedMfa(true);
      } else {
        navigate({ to: "/verify-2fa", replace: true });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user, roles, checkedReset, location.pathname, navigate]);

  if (loading || !user || !checkedReset || !checkedMfa) {
    return <AppLoadingSkeleton />;
  }

  return <Outlet />;
}

// #1/#2 — a branded skeleton shell instead of a centered spinner, so the load
// reads like an app warming up rather than a blank website flash.
function AppLoadingSkeleton() {
  return (
    <div className="min-h-screen-mobile bg-background">
      <div className="glass sticky top-0 flex h-16 items-center gap-3 border-b border-border px-4">
        <div className="h-8 w-8 animate-pulse rounded-xl bg-gradient-navy" />
        <div className="h-5 w-28 animate-pulse rounded bg-muted" />
        <div className="ml-auto flex items-center gap-2">
          <div className="h-9 w-9 animate-pulse rounded-full bg-muted" />
          <div className="h-9 w-9 animate-pulse rounded-full bg-muted" />
        </div>
      </div>
      <div className="space-y-4 px-4 py-6">
        <div className="h-7 w-48 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-border bg-card" />
          ))}
        </div>
        <div className="h-40 animate-pulse rounded-2xl border border-border bg-card" />
        <div className="h-40 animate-pulse rounded-2xl border border-border bg-card" />
      </div>
    </div>
  );
}
