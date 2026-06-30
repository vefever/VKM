import { createFileRoute } from "@tanstack/react-router";
import { MeetingsCalendar } from "@/components/meetings/meetings-calendar";

export const Route = createFileRoute("/_authenticated/coach/calendar")({
  head: () => ({ meta: [{ title: "Calendar · VKM" }] }),
  component: MeetingsCalendar,
});
