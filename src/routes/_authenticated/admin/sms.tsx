import { createFileRoute } from "@tanstack/react-router";
import { MessagingSettings } from "@/components/admin/messaging-settings";

export const Route = createFileRoute("/_authenticated/admin/sms")({
  head: () => ({ meta: [{ title: "SMS · VKM" }] }),
  component: () => <MessagingSettings defaultTab="sms" />,
});
