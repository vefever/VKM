import { createFileRoute } from "@tanstack/react-router";
import { ProgramsHub } from "@/components/admin/programs-hub";

export const Route = createFileRoute("/_authenticated/mentor/programs/clone")({
  head: () => ({ meta: [{ title: "Clone · VKM" }] }),
  component: () => <ProgramsHub role="mentor" initialAction="clone" />,
});
