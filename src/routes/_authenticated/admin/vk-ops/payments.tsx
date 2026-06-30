import { createFileRoute } from "@tanstack/react-router";
import { WireframePage } from "@/components/vkm/wireframe-page";
import { getPageConfig } from "@/components/vkm/page-registry";

export const Route = createFileRoute("/_authenticated/admin/vk-ops/payments")({
  head: () => ({ meta: [{ title: "Payments · VKM" }] }),
  component: () => <WireframePage config={getPageConfig("/admin/vk-ops/payments")} />,
});
