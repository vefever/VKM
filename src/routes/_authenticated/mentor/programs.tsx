import { createFileRoute } from "@tanstack/react-router";
import { ProgramsHub } from "@/components/admin/programs-hub";

export const Route = createFileRoute("/_authenticated/mentor/programs")({
  head: () => ({ meta: [{ title: "Programs · VKM" }] }),
  component: () => <ProgramsHub role="mentor" />,
});
