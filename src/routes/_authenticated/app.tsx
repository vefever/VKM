import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { ROLE_BASE } from "@/components/vkm/nav-config";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppRedirect,
});

function AppRedirect() {
  const { primaryRole, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (loading) return;
    navigate({ to: ROLE_BASE[primaryRole ?? "participant"], replace: true });
  }, [loading, primaryRole, navigate]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-10 w-10 animate-pulse rounded-2xl bg-gradient-navy shadow-vkm" />
    </div>
  );
}
