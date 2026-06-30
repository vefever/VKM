import { createFileRoute } from "@tanstack/react-router";
import { HabitTrackerPage } from "@/components/habits/habit-tracker-page";

export const Route = createFileRoute("/_authenticated/participant/omm")({
  head: () => ({ meta: [{ title: "OMM Tracker · VKM" }] }),
  component: HabitTrackerPage,
});
