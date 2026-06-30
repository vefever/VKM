import { createFileRoute } from "@tanstack/react-router";
import { ProgramDesign } from "@/components/admin/program-design";

export const Route = createFileRoute("/_authenticated/admin/programs")({
  head: () => ({ meta: [{ title: "Program Design · VKM" }] }),
  component: () => <ProgramDesign />,
});
