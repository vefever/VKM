import { createFileRoute } from "@tanstack/react-router";
import { ParticipantsList } from "@/components/coach/participants-list";

export const Route = createFileRoute("/_authenticated/admin/participants")({
  head: () => ({ meta: [{ title: "Participants · VKM" }] }),
  component: () => <ParticipantsList eyebrow="Super Admin" detailBase="/admin/participant" />,
});
