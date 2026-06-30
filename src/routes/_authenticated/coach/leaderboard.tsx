import { createFileRoute } from "@tanstack/react-router";
import { CoachPerformance } from "@/components/coach/coach-performance";

export const Route = createFileRoute("/_authenticated/coach/leaderboard")({
  head: () => ({ meta: [{ title: "My Performance · VKM" }] }),
  component: () => <CoachPerformance eyebrow="Coach" selfOnly />,
});
