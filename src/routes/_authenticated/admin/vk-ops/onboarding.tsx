import { createFileRoute } from "@tanstack/react-router";
import { SectionUnavailable } from "@/components/vkm/section-unavailable";

export const Route = createFileRoute("/_authenticated/admin/vk-ops/onboarding")({
  head: () => ({ meta: [{ title: "Onboarding · VKM" }] }),
  component: () => <SectionUnavailable title="Onboarding" home="/admin" />,
});
