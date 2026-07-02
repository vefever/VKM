import { createFileRoute } from "@tanstack/react-router";
import { PwaSettingsPage } from "@/components/admin/pwa-settings";

export const Route = createFileRoute("/_authenticated/admin/pwa")({
  head: () => ({ meta: [{ title: "Installable App · VKM" }] }),
  component: PwaSettingsPage,
});
