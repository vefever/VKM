import { createFileRoute } from "@tanstack/react-router";
import { CoachPerformance } from "@/components/coach/coach-performance";

export const Route = createFileRoute("/_authenticated/mentor/coach-performance")({
  head: () => ({ meta: [{ title: "Coach Performance · VKM" }] }),
  component: () => <CoachPerformance eyebrow="Mentor · VK" />,
});
