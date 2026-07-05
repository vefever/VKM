import { createFileRoute } from "@tanstack/react-router";
import { CoachPerformance } from "@/components/coach/coach-performance";

export const Route = createFileRoute("/_authenticated/mentor/coaches")({
  head: () => ({ meta: [{ title: "Coaches · VKM" }] }),
  component: () => <CoachPerformance eyebrow="Mentor · VK" />,
});
