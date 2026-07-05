import { createFileRoute } from "@tanstack/react-router";
import { SectionUnavailable } from "@/components/vkm/section-unavailable";

export const Route = createFileRoute("/_authenticated/admin/vk-ops/events")({
  head: () => ({ meta: [{ title: "Event Management · VKM" }] }),
  component: () => <SectionUnavailable title="Event Management" home="/admin" />,
});
