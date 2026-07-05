import { createFileRoute } from "@tanstack/react-router";
import { ProfileSettings } from "@/components/participant/profile-settings";

export const Route = createFileRoute("/_authenticated/mentor/settings")({
  head: () => ({ meta: [{ title: "Settings · VKM" }] }),
  component: () => <ProfileSettings roleLabel="Mentor" showBusinessTab={false} />,
});
