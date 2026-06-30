import { createFileRoute } from "@tanstack/react-router";
import { CommunityPage } from "@/components/community/community-page";

export const Route = createFileRoute("/_authenticated/participant/community")({
  head: () => ({ meta: [{ title: "Member Network · VKM" }] }),
  component: () => <CommunityPage />,
});
