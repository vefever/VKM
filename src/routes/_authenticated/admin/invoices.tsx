import { createFileRoute } from "@tanstack/react-router";
import { SectionUnavailable } from "@/components/vkm/section-unavailable";

export const Route = createFileRoute("/_authenticated/admin/invoices")({
  head: () => ({ meta: [{ title: "Invoices · VKM" }] }),
  component: () => <SectionUnavailable title="Invoices" home="/admin" />,
});
