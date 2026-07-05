import { createFileRoute } from "@tanstack/react-router";
import { GraduationPage } from "@/components/admin/graduation-page";

export const Route = createFileRoute("/_authenticated/admin/vk-ops/graduation")({
  head: () => ({ meta: [{ title: "Graduation · VKM" }] }),
  component: () => <GraduationPage eyebrow="Super Admin" />,
});
