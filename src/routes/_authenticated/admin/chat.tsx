import { createFileRoute } from "@tanstack/react-router";
import { ChatInbox } from "@/components/chat/chat-inbox";

export const Route = createFileRoute("/_authenticated/admin/chat")({
  head: () => ({ meta: [{ title: "Chat · VKM" }] }),
  component: () => <ChatInbox eyebrow="Super Admin" />,
});
