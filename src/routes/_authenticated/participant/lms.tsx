import { createFileRoute } from "@tanstack/react-router";
import { LmsVideosPage } from "@/components/participant/lms-videos";

export const Route = createFileRoute("/_authenticated/participant/lms")({
  head: () => ({ meta: [{ title: "LMS · VKM" }] }),
  component: () => <LmsVideosPage />,
});
