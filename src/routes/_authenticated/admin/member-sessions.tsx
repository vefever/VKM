import { createFileRoute } from "@tanstack/react-router";
import { MemberSessionsAdmin } from "@/components/admin/member-sessions-admin";

export const Route = createFileRoute("/_authenticated/admin/member-sessions")({
  head: () => ({ meta: [{ title: "Member Sessions · VKM" }] }),
  component: MemberSessionsAdmin,
});
