import { createFileRoute, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/vkm/app-shell";
import { useAuth } from "@/hooks/use-auth";
import { useAccessTier } from "@/hooks/use-access-tier";
import { isPathAllowed, TIER_HOME } from "@/lib/vkm/access";

export const Route = createFileRoute("/_authenticated/participant")({
  component: () => <RoleLayout />,
});

function RoleLayout() {
  const { hasRole, loading } = useAuth();
  const { tier, loading: tierLoading } = useAccessTier();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !hasRole("participant") && !hasRole("super_admin")) {
      navigate({ to: "/unauthorized", replace: true });
    }
  }, [loading, hasRole, navigate]);

  // Access-tier gate: past-cohort / alumni participants can only open their
  // allowed pages — bounce anything else to their home (Community).
  useEffect(() => {
    if (loading || tierLoading) return;
    if (hasRole("super_admin")) return; // admins (incl. impersonation) see everything
    if (!isPathAllowed(tier, location.pathname)) {
      navigate({ to: TIER_HOME[tier], replace: true });
    }
  }, [loading, tierLoading, tier, location.pathname, hasRole, navigate]);

  return (
    <AppShell role="participant">
      <Outlet />
    </AppShell>
  );
}
