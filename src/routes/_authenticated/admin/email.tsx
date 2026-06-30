import { createFileRoute } from "@tanstack/react-router";
import { MessagingSettings } from "@/components/admin/messaging-settings";

export const Route = createFileRoute("/_authenticated/admin/email")({
  head: () => ({ meta: [{ title: "Email · VKM" }] }),
  component: () => <MessagingSettings defaultTab="email" />,
});
