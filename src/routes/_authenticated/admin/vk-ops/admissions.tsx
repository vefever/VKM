import { createFileRoute } from "@tanstack/react-router";
import { SectionUnavailable } from "@/components/vkm/section-unavailable";

export const Route = createFileRoute("/_authenticated/admin/vk-ops/admissions")({
  head: () => ({ meta: [{ title: "Admissions · VKM" }] }),
  component: () => <SectionUnavailable title="Admissions" home="/admin" />,
});
