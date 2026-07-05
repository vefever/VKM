import { createFileRoute } from "@tanstack/react-router";
import { GraduationPage } from "@/components/admin/graduation-page";

export const Route = createFileRoute("/_authenticated/admin/vk-ops/alumni")({
  head: () => ({ meta: [{ title: "Alumni · VKM" }] }),
  component: () => <GraduationPage eyebrow="Super Admin" />,
});
