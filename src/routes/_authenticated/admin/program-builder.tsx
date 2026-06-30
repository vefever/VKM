import { createFileRoute } from "@tanstack/react-router";
import { ProgramBuilder } from "@/components/admin/program-builder";

export const Route = createFileRoute("/_authenticated/admin/program-builder")({
  head: () => ({ meta: [{ title: "Program Builder · VKM" }] }),
  component: () => <ProgramBuilder />,
});
