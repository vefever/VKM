import { createFileRoute } from "@tanstack/react-router";
import { CoachPerformance } from "@/components/coach/coach-performance";

export const Route = createFileRoute("/_authenticated/admin/coach-performance")({
  head: () => ({ meta: [{ title: "Coach Performance · VKM" }] }),
  component: () => <CoachPerformance eyebrow="Super Admin" />,
});
