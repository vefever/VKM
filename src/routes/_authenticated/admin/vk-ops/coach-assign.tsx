import { createFileRoute } from "@tanstack/react-router";
import { CoachAssignmentPage } from "@/components/admin/coach-assignment-page";

export const Route = createFileRoute("/_authenticated/admin/vk-ops/coach-assign")({
  head: () => ({ meta: [{ title: "Coach Assignment · VKM" }] }),
  component: () => <CoachAssignmentPage />,
});
