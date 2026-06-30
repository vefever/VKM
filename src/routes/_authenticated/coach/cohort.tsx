import { createFileRoute } from "@tanstack/react-router";
import { CohortOverview } from "@/components/coach/cohort-overview";

export const Route = createFileRoute("/_authenticated/coach/cohort")({
  head: () => ({ meta: [{ title: "Cohort Overview · VKM" }] }),
  component: CohortOverview,
});
