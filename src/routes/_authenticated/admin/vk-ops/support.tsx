import { createFileRoute } from "@tanstack/react-router";
import { SupportInbox } from "@/components/support/support-inbox";

export const Route = createFileRoute("/_authenticated/admin/vk-ops/support")({
  head: () => ({ meta: [{ title: "Support · VKM" }] }),
  component: () => <SupportInbox eyebrow="Super Admin" />,
});
