import { createFileRoute } from "@tanstack/react-router";
import { ParticipantHabitsViewer } from "@/components/habits/participant-habits-viewer";

export const Route = createFileRoute("/_authenticated/coach/health")({
  head: () => ({ meta: [{ title: "Participant Habits · VKM" }] }),
  component: () => <ParticipantHabitsViewer eyebrow="Coach" />,
});
