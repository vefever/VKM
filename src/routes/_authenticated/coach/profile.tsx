import { createFileRoute } from "@tanstack/react-router";
import { ProfileSettings } from "@/components/participant/profile-settings";

export const Route = createFileRoute("/_authenticated/coach/profile")({
  head: () => ({ meta: [{ title: "Profile · VKM" }] }),
  component: () => <ProfileSettings roleLabel="Coach" showBusinessTab={false} />,
});