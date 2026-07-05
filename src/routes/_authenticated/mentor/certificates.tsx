import { createFileRoute } from "@tanstack/react-router";
import { GraduationPage } from "@/components/admin/graduation-page";

export const Route = createFileRoute("/_authenticated/mentor/certificates")({
  head: () => ({ meta: [{ title: "Recognition · VKM" }] }),
  component: () => <GraduationPage eyebrow="Mentor · VK" />,
});
