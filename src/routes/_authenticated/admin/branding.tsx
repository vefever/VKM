import { createFileRoute } from "@tanstack/react-router";
import { SectionUnavailable } from "@/components/vkm/section-unavailable";

export const Route = createFileRoute("/_authenticated/admin/branding")({
  head: () => ({ meta: [{ title: "Branding · VKM" }] }),
  component: () => <SectionUnavailable title="Branding" home="/admin" />,
});
