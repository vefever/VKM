import { createFileRoute } from "@tanstack/react-router";
import { SectionUnavailable } from "@/components/vkm/section-unavailable";

export const Route = createFileRoute("/_authenticated/admin/push")({
  head: () => ({ meta: [{ title: "Push Notifications · VKM" }] }),
  component: () => <SectionUnavailable title="Push Notifications" home="/admin" />,
});
