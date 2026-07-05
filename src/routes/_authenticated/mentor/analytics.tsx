import { createFileRoute } from "@tanstack/react-router";
import { PlatformAnalyticsPage } from "@/components/admin/platform-analytics";

export const Route = createFileRoute("/_authenticated/mentor/analytics")({
  head: () => ({ meta: [{ title: "Analytics · VKM" }] }),
  component: () => <PlatformAnalyticsPage eyebrow="Mentor · VK" />,
});
