import { createFileRoute } from "@tanstack/react-router";
import { SectionUnavailable } from "@/components/vkm/section-unavailable";

export const Route = createFileRoute("/_authenticated/admin/vk-ops/feedback")({
  head: () => ({ meta: [{ title: "Feedback / NPS · VKM" }] }),
  component: () => <SectionUnavailable title="Feedback / NPS" home="/admin" />,
});
