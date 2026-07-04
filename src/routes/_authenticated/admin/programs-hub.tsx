import { createFileRoute } from "@tanstack/react-router";
import { ProgramsHub } from "@/components/admin/programs-hub";

export const Route = createFileRoute("/_authenticated/admin/programs-hub")({
  head: () => ({ meta: [{ title: "Manage Programs · VKM" }] }),
  component: () => <ProgramsHub role="admin" />,
});
