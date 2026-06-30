import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/unauthorized")({
  component: () => (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <span className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-destructive/10 text-destructive">
        <ShieldX className="h-7 w-7" />
      </span>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">You don't have access</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        This area is reserved for a different role. Ask a Super Admin to grant you access, or return to your dashboard.
      </p>
      <Button asChild className="mt-6 rounded-full bg-gradient-navy shadow-vkm">
        <Link to="/app">Back to my dashboard</Link>
      </Button>
    </div>
  ),
});
