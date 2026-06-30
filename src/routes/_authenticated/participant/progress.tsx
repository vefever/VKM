import { createFileRoute } from "@tanstack/react-router";
import { ProgramProgress } from "@/components/participant/program-progress";

export const Route = createFileRoute("/_authenticated/participant/progress")({
  head: () => ({ meta: [{ title: "Program Progress · VKM" }] }),
  component: ProgramProgress,
});
