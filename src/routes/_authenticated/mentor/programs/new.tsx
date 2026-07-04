import { createFileRoute } from "@tanstack/react-router";
import { ProgramsHub } from "@/components/admin/programs-hub";

export const Route = createFileRoute("/_authenticated/mentor/programs/new")({
  head: () => ({ meta: [{ title: "New Program · VKM" }] }),
  component: () => <ProgramsHub role="mentor" initialAction="create" />,
});
