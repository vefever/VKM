import { createFileRoute } from "@tanstack/react-router";
import { ParticipantDetail } from "@/components/coach/participant-detail";

export const Route = createFileRoute("/_authenticated/admin/participant/$userId")({
  head: () => ({ meta: [{ title: "Participant · VKM" }] }),
  component: Page,
});

function Page() {
  const { userId } = Route.useParams();
  return <ParticipantDetail userId={userId} eyebrow="Super Admin" backTo="/admin/participants" />;
}
