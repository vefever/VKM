import { createFileRoute } from "@tanstack/react-router";
import { MessagingSettings } from "@/components/admin/messaging-settings";

export const Route = createFileRoute("/_authenticated/admin/whatsapp")({
  head: () => ({ meta: [{ title: "WhatsApp · VKM" }] }),
  component: () => <MessagingSettings defaultTab="whatsapp" />,
});
