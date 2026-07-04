import { createFileRoute } from "@tanstack/react-router";
import { SystemOverview } from "@/components/admin/system-overview";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "System Overview · VKM" }] }),
  component: SystemOverview,
});
