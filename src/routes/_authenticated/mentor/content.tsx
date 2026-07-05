import { createFileRoute } from "@tanstack/react-router";
import { ProgramDesign } from "@/components/admin/program-design";

export const Route = createFileRoute("/_authenticated/mentor/content")({
  head: () => ({ meta: [{ title: "Content · VKM" }] }),
  component: () => <ProgramDesign />,
});
