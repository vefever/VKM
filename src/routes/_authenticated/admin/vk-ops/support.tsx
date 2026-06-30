import { createFileRoute } from "@tanstack/react-router";
import { WireframePage } from "@/components/vkm/wireframe-page";
import { getPageConfig } from "@/components/vkm/page-registry";

export const Route = createFileRoute("/_authenticated/admin/vk-ops/support")({
  head: () => ({ meta: [{ title: "Support · VKM" }] }),
  component: () => <WireframePage config={getPageConfig("/admin/vk-ops/support")} />,
});
