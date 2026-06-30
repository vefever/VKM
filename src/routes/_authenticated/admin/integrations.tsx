import { createFileRoute } from "@tanstack/react-router";
import { IntegrationsSettings } from "@/components/admin/integrations-settings";

export const Route = createFileRoute("/_authenticated/admin/integrations")({
  head: () => ({ meta: [{ title: "Integrations · VKM" }] }),
  component: IntegrationsSettings,
});
