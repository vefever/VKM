import { createFileRoute } from "@tanstack/react-router";
import { SectionUnavailable } from "@/components/vkm/section-unavailable";

export const Route = createFileRoute("/_authenticated/admin/vk-ops/allocation")({
  head: () => ({ meta: [{ title: "Batch Allocation · VKM" }] }),
  component: () => <SectionUnavailable title="Batch Allocation" home="/admin" />,
});
