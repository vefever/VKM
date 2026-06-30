import { createFileRoute } from "@tanstack/react-router";
import { ChatInbox } from "@/components/chat/chat-inbox";

export const Route = createFileRoute("/_authenticated/mentor/chat")({
  head: () => ({ meta: [{ title: "Chat · VKM" }] }),
  component: () => <ChatInbox eyebrow="Mentor · VK" />,
});
