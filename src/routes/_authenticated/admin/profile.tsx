import { createFileRoute } from "@tanstack/react-router";
import { ProfileSettings } from "@/components/participant/profile-settings";

export const Route = createFileRoute("/_authenticated/admin/profile")({
  head: () => ({ meta: [{ title: "Profile · VKM" }] }),
  component: () => (
    <ProfileSettings roleLabel="Admin" showBusinessTab={false} roleSubtitle="Super Admin" />
  ),
});