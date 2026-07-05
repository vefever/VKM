import { createFileRoute } from "@tanstack/react-router";
import { MentorInsightsPage } from "@/components/mentor/insights-page";

export const Route = createFileRoute("/_authenticated/mentor/insights")({
  head: () => ({ meta: [{ title: "Insights · VKM" }] }),
  component: () => <MentorInsightsPage />,
});
