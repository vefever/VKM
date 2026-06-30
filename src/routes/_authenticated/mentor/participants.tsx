import { createFileRoute } from "@tanstack/react-router";
import { ParticipantsList } from "@/components/coach/participants-list";

export const Route = createFileRoute("/_authenticated/mentor/participants")({
  head: () => ({ meta: [{ title: "Participants · VKM" }] }),
  component: () => <ParticipantsList eyebrow="Mentor · VK" detailBase="/mentor/participant" />,
});
