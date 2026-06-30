import { createFileRoute } from "@tanstack/react-router";
import { MeetingsCalendar } from "@/components/meetings/meetings-calendar";

export const Route = createFileRoute("/_authenticated/participant/meetings")({
  head: () => ({ meta: [{ title: "Meetings · VKM" }] }),
  component: MeetingsCalendar,
});
