import { createFileRoute } from "@tanstack/react-router";
import { NotificationsPage } from "@/components/notifications/notifications-page";

export const Route = createFileRoute("/_authenticated/mentor/notifications")({
  head: () => ({ meta: [{ title: "Notifications · VKM" }] }),
  component: NotificationsPage,
});
