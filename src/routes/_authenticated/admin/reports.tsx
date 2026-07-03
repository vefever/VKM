import { createFileRoute } from "@tanstack/react-router";
import { ReportsPage } from "@/components/admin/reports-page";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  head: () => ({ meta: [{ title: "Reports · VKM" }] }),
  component: ReportsPage,
});
