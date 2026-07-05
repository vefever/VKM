import { createFileRoute } from "@tanstack/react-router";
import { SectionUnavailable } from "@/components/vkm/section-unavailable";

export const Route = createFileRoute("/_authenticated/admin/vk-ops/stories")({
  head: () => ({ meta: [{ title: "Success Stories · VKM" }] }),
  component: () => <SectionUnavailable title="Success Stories" home="/admin" />,
});
