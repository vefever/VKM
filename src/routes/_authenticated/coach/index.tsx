import { createFileRoute } from "@tanstack/react-router";
import { CoachDashboard } from "@/components/coach/coach-dashboard";

export const Route = createFileRoute("/_authenticated/coach/")({
  head: () => ({ meta: [{ title: "Coach · VKM" }] }),
  component: CoachDashboard,
});
