import { createFileRoute } from "@tanstack/react-router";
import { BroadcastComposer } from "@/components/notifications/broadcast-composer";

export const Route = createFileRoute("/_authenticated/mentor/announcements")({
  head: () => ({ meta: [{ title: "Announcements · VKM" }] }),
  component: () => <BroadcastComposer eyebrow="Mentor · VK" />,
});
