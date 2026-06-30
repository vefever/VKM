import { createFileRoute } from "@tanstack/react-router";
import { HabitTrackerPage } from "@/components/habits/habit-tracker-page";

export const Route = createFileRoute("/_authenticated/participant/habits")({
  head: () => ({ meta: [{ title: "Daily Habits · VKM" }] }),
  component: HabitTrackerPage,
});
