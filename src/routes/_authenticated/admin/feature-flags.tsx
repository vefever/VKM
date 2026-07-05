import { createFileRoute } from "@tanstack/react-router";
import { SectionUnavailable } from "@/components/vkm/section-unavailable";

export const Route = createFileRoute("/_authenticated/admin/feature-flags")({
  head: () => ({ meta: [{ title: "Feature Flags · VKM" }] }),
  component: () => <SectionUnavailable title="Feature Flags" home="/admin" />,
});
