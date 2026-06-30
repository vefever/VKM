import { createFileRoute } from "@tanstack/react-router";
import { LeaderboardPage } from "@/components/leaderboard/leaderboard-page";

export const Route = createFileRoute("/_authenticated/participant/leaderboard")({
  head: () => ({ meta: [{ title: "Leaderboard · VKM" }] }),
  component: LeaderboardPage,
});
