import { createFileRoute } from "@tanstack/react-router";
import { SectionUnavailable } from "@/components/vkm/section-unavailable";

export const Route = createFileRoute("/_authenticated/admin/vk-ops/campaigns")({
  head: () => ({ meta: [{ title: "Campaign Management · VKM" }] }),
  component: () => <SectionUnavailable title="Campaign Management" home="/admin" />,
});
