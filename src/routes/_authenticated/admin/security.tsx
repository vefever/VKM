import { createFileRoute } from "@tanstack/react-router";
import { SecuritySettingsPage } from "@/components/admin/security-settings";

export const Route = createFileRoute("/_authenticated/admin/security")({
  head: () => ({ meta: [{ title: "Security · VKM" }] }),
  component: SecuritySettingsPage,
});
