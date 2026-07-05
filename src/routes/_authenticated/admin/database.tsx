import { createFileRoute } from "@tanstack/react-router";
import { SectionUnavailable } from "@/components/vkm/section-unavailable";

export const Route = createFileRoute("/_authenticated/admin/database")({
  head: () => ({ meta: [{ title: "Database · VKM" }] }),
  component: () => <SectionUnavailable title="Database" home="/admin" />,
});
