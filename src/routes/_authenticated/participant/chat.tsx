import { createFileRoute } from "@tanstack/react-router";
import { ChatPage } from "@/components/chat/chat-page";

export const Route = createFileRoute("/_authenticated/participant/chat")({
  head: () => ({ meta: [{ title: "Chat · VKM" }] }),
  component: ChatPage,
});
