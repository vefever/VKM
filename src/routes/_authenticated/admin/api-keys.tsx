import { createFileRoute } from "@tanstack/react-router";
import { SectionUnavailable } from "@/components/vkm/section-unavailable";

export const Route = createFileRoute("/_authenticated/admin/api-keys")({
  head: () => ({ meta: [{ title: "API Keys · VKM" }] }),
  component: () => <SectionUnavailable title="API Keys" home="/admin" />,
});
