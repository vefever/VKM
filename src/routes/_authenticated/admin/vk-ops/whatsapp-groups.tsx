import { createFileRoute } from "@tanstack/react-router";
import { SectionUnavailable } from "@/components/vkm/section-unavailable";

export const Route = createFileRoute("/_authenticated/admin/vk-ops/whatsapp-groups")({
  head: () => ({ meta: [{ title: "WhatsApp Groups · VKM" }] }),
  component: () => <SectionUnavailable title="WhatsApp Groups" home="/admin" />,
});
