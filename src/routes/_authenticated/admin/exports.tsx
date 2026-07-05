import { createFileRoute } from "@tanstack/react-router";
import { SectionUnavailable } from "@/components/vkm/section-unavailable";

export const Route = createFileRoute("/_authenticated/admin/exports")({
  head: () => ({ meta: [{ title: "Exports · VKM" }] }),
  component: () => <SectionUnavailable title="Exports" home="/admin" />,
});
