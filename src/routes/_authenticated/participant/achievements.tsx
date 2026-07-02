import { createFileRoute } from "@tanstack/react-router";
import { PointsHistoryPage } from "@/components/participant/points-history";

export const Route = createFileRoute("/_authenticated/participant/achievements")({
  head: () => ({ meta: [{ title: "Points History · VKM" }] }),
  component: PointsHistoryPage,
});
