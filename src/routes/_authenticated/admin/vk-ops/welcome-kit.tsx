import { createFileRoute } from "@tanstack/react-router";
import { SectionUnavailable } from "@/components/vkm/section-unavailable";

export const Route = createFileRoute("/_authenticated/admin/vk-ops/welcome-kit")({
  head: () => ({ meta: [{ title: "Welcome Kit · VKM" }] }),
  component: () => <SectionUnavailable title="Welcome Kit" home="/admin" />,
});
