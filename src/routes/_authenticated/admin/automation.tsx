import { createFileRoute } from "@tanstack/react-router";
import { AutomationSettingsPage } from "@/components/admin/automation-settings";

export const Route = createFileRoute("/_authenticated/admin/automation")({
  head: () => ({ meta: [{ title: "Workflow & Automation · VKM" }] }),
  component: AutomationSettingsPage,
});
