import { createFileRoute } from "@tanstack/react-router";
import { MeetingsCalendar } from "@/components/meetings/meetings-calendar";

export const Route = createFileRoute("/_authenticated/mentor/meetings")({
  head: () => ({ meta: [{ title: "Zoom Meetings · VKM" }] }),
  component: MeetingsCalendar,
});
