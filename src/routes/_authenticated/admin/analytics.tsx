import { createFileRoute } from "@tanstack/react-router";
import { PlatformAnalyticsPage } from "@/components/admin/platform-analytics";

export const Route = createFileRoute("/_authenticated/admin/analytics")({
  head: () => ({ meta: [{ title: "Platform Analytics · VKM" }] }),
  component: PlatformAnalyticsPage,
});
