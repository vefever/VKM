import { createFileRoute } from "@tanstack/react-router";
import { MemberProfileView } from "@/components/community/member-profile-view";

export const Route = createFileRoute("/_authenticated/participant/member/$memberId")({
  head: () => ({ meta: [{ title: "Member Profile · VKM" }] }),
  component: Page,
});

function Page() {
  const { memberId } = Route.useParams();
  return <MemberProfileView memberId={memberId} />;
}
