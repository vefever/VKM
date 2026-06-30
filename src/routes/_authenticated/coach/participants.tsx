import { createFileRoute } from "@tanstack/react-router";
import { ParticipantsList } from "@/components/coach/participants-list";

export const Route = createFileRoute("/_authenticated/coach/participants")({
  head: () => ({ meta: [{ title: "My Participants · VKM" }] }),
  component: () => (
    <ParticipantsList eyebrow="Coach" detailBase="/coach/participant" habitsTo="/coach/health" />
  ),
});
