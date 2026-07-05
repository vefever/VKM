import { createFileRoute } from "@tanstack/react-router";
import { SectionUnavailable } from "@/components/vkm/section-unavailable";

export const Route = createFileRoute("/_authenticated/admin/crm")({
  head: () => ({ meta: [{ title: "CRM · VKM" }] }),
  component: () => <SectionUnavailable title="CRM" home="/admin" />,
});
