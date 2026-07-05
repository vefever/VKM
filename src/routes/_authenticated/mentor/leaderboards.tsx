import { createFileRoute } from "@tanstack/react-router";
import { MentorLeaderboardsPage } from "@/components/mentor/leaderboards-page";

export const Route = createFileRoute("/_authenticated/mentor/leaderboards")({
  head: () => ({ meta: [{ title: "Leaderboards · VKM" }] }),
  component: () => <MentorLeaderboardsPage />,
});
