import { createFileRoute } from "@tanstack/react-router";
import { ProfileSettings } from "@/components/participant/profile-settings";

export const Route = createFileRoute("/_authenticated/mentor/profile")({
  head: () => ({ meta: [{ title: "Profile · VKM" }] }),
  component: () => <ProfileSettings roleLabel="Mentor" showBusinessTab={false} />,
});