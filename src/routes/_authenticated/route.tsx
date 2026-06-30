import { createFileRoute, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [checkedReset, setCheckedReset] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [loading, user, navigate]);

  // Force password reset on first login (when invited)
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

  if (loading || !user || !checkedReset) {
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
