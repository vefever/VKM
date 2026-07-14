import { createFileRoute } from "@tanstack/react-router";
import { MySessionsPage } from "@/components/participant/my-sessions-page";

export const Route = createFileRoute("/_authenticated/participant/sessions")({
  head: () => ({ meta: [{ title: "My Sessions · VKM" }] }),
  component: MySessionsPage,
});
