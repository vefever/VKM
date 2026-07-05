import { createFileRoute } from "@tanstack/react-router";
import { SectionUnavailable } from "@/components/vkm/section-unavailable";

export const Route = createFileRoute("/_authenticated/admin/vk-ops/gifts")({
  head: () => ({ meta: [{ title: "Gift Dispatch · VKM" }] }),
  component: () => <SectionUnavailable title="Gift Dispatch" home="/admin" />,
});
