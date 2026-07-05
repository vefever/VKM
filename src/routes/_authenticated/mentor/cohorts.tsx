import { createFileRoute } from "@tanstack/react-router";
import { CohortOverview } from "@/components/coach/cohort-overview";

export const Route = createFileRoute("/_authenticated/mentor/cohorts")({
  head: () => ({ meta: [{ title: "Cohorts · VKM" }] }),
  component: () => <CohortOverview portal="mentor" />,
});
