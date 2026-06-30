import { createFileRoute } from "@tanstack/react-router";
import { WireframePage } from "@/components/vkm/wireframe-page";
import { getPageConfig } from "@/components/vkm/page-registry";

export const Route = createFileRoute("/_authenticated/admin/vk-ops/welcome-kit")({
  head: () => ({ meta: [{ title: "Welcome Kit · VKM" }] }),
  component: () => <WireframePage config={getPageConfig("/admin/vk-ops/welcome-kit")} />,
});
