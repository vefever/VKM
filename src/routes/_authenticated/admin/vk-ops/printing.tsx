import { createFileRoute } from "@tanstack/react-router";
import { SectionUnavailable } from "@/components/vkm/section-unavailable";

export const Route = createFileRoute("/_authenticated/admin/vk-ops/printing")({
  head: () => ({ meta: [{ title: "Certificate Printing · VKM" }] }),
  component: () => <SectionUnavailable title="Certificate Printing" home="/admin" />,
});
