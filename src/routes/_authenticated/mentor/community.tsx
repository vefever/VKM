import { createFileRoute } from "@tanstack/react-router";
import { CommunityPage } from "@/components/community/community-page";

export const Route = createFileRoute("/_authenticated/mentor/community")({
  head: () => ({ meta: [{ title: "Community · VKM" }] }),
  component: () => <CommunityPage />,
});
