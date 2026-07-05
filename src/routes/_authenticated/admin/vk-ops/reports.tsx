import { createFileRoute } from "@tanstack/react-router";
import { ReportsPage } from "@/components/admin/reports-page";

export const Route = createFileRoute("/_authenticated/admin/vk-ops/reports")({
  head: () => ({ meta: [{ title: "Reports · VKM" }] }),
  component: () => <ReportsPage eyebrow="Super Admin" />,
});
