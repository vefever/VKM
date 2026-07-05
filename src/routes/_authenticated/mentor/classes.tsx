import { createFileRoute } from "@tanstack/react-router";
import { MeetingsCalendar } from "@/components/meetings/meetings-calendar";

export const Route = createFileRoute("/_authenticated/mentor/classes")({
  head: () => ({ meta: [{ title: "Live Classes · VKM" }] }),
  component: () => <MeetingsCalendar />,
});
