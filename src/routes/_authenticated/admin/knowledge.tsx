import { createFileRoute } from "@tanstack/react-router";
import { KnowledgeBase } from "@/components/admin/knowledge-base";

export const Route = createFileRoute("/_authenticated/admin/knowledge")({
  head: () => ({ meta: [{ title: "VK Knowledge Base · VKM" }] }),
  component: KnowledgeBase,
});
