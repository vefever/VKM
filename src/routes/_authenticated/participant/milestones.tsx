import { createFileRoute } from "@tanstack/react-router";
import { MilestonesPage } from "@/components/participant/milestones-page";

export const Route = createFileRoute("/_authenticated/participant/milestones")({
  head: () => ({ meta: [{ title: "Milestones & Rewards · VKM" }] }),
  component: () => <MilestonesPage />,
});
