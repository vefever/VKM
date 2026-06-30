import { createFileRoute } from "@tanstack/react-router";
import { WireframePage } from "@/components/vkm/wireframe-page";
import { getPageConfig } from "@/components/vkm/page-registry";

export const Route = createFileRoute("/_authenticated/admin/exports")({
  head: () => ({ meta: [{ title: "Exports · VKM" }] }),
  component: () => <WireframePage config={getPageConfig("/admin/exports")} />,
});
