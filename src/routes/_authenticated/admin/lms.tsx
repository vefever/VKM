import { createFileRoute } from "@tanstack/react-router";
import { ClassVideosManager } from "@/components/admin/class-videos-manager";

export const Route = createFileRoute("/_authenticated/admin/lms")({
  head: () => ({ meta: [{ title: "Class Videos · VKM" }] }),
  component: () => <ClassVideosManager />,
});
