import { createFileRoute } from "@tanstack/react-router";
import { AiSettings } from "@/components/admin/ai-settings";

export const Route = createFileRoute("/_authenticated/admin/ai")({
  head: () => ({ meta: [{ title: "AI Configurations · VKM" }] }),
  component: () => <AiSettings />,
});
