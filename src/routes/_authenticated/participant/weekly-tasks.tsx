import { createFileRoute } from "@tanstack/react-router";
import { ProgramProgress } from "@/components/participant/program-progress";

// Weekly Tasks now live inside Program Progress (first tab). Kept as a route so
// existing links (e.g. Today's Focus quick access) still land on real content.
export const Route = createFileRoute("/_authenticated/participant/weekly-tasks")({
  head: () => ({ meta: [{ title: "Weekly Tasks · VKM" }] }),
  component: ProgramProgress,
});
