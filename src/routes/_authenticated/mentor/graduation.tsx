import { createFileRoute } from "@tanstack/react-router";
import { GraduationPage } from "@/components/admin/graduation-page";

export const Route = createFileRoute("/_authenticated/mentor/graduation")({
  head: () => ({ meta: [{ title: "Graduation · VKM" }] }),
  component: () => <GraduationPage eyebrow="Mentor · VK" />,
});
