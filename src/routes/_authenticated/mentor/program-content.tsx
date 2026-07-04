import { createFileRoute } from "@tanstack/react-router";
import { ProgramDesign } from "@/components/admin/program-design";

export const Route = createFileRoute("/_authenticated/mentor/program-content")({
  head: () => ({ meta: [{ title: "Program Content · VKM" }] }),
  component: () => <ProgramDesign />,
});
