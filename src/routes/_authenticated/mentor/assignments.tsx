import { createFileRoute } from "@tanstack/react-router";
import { SectionUnavailable } from "@/components/vkm/section-unavailable";

export const Route = createFileRoute("/_authenticated/mentor/assignments")({
  head: () => ({ meta: [{ title: "Assignments · VKM" }] }),
  component: () => <SectionUnavailable title="Assignments" home="/mentor" />,
});
