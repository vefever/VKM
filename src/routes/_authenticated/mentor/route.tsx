import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/vkm/app-shell";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/mentor")({
  component: () => <RoleLayout />,
});

function RoleLayout() {
  const { hasRole, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !hasRole("mentor") && !hasRole("super_admin")) {
      navigate({ to: "/unauthorized", replace: true });
    }
  }, [loading, hasRole, navigate]);
  return (
    <AppShell role="mentor">
      <Outlet />
    </AppShell>
  );
}
